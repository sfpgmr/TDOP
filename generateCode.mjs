import binaryen from 'binaryen';

Object.prototype.error = function(message, t) {
  t = t || this;
  t.name = 'Compiler Error';
  t.message = message;
  throw t;
};

export default function generateCode(ast) {
  // Create a module with a single function
  const module = new binaryen.Module();
  //  const exp = new binaryen.Expression();

  //module.setMemory(1, null, 'test1');
  //module.addGlobal('t', binaryen.i32, true, module.i32.const(1));
  let localVars;
  let varIndex = 0;
  let postOps = [];
  let blockId = 0;
  let currentBrakePoint;
  //module.addMemoryImport('test','test','a');

  const statements = ast.first;

  
  function generate(stmts) {
    const result = [];
    postOps.length = 0;
    if(stmts instanceof Array){
      stmts.forEach((stmt) => {
        const r = generate_(stmt);
        if (r instanceof Array) {
          result.push(...r);
        } else if (r) {
          result.push(r);
        }
        postOps.length && result.push(...postOps);
      });
    } else {
      return generate_(stmts);
    }
    return result;
  }

  function generate_(s) {
    switch (s.nodeType) {
    case 'define':
      return define(s);
    case 'function':
      return functionStatement(s);
    case 'unary':
      return expression(s);
    case 'binary':
      return expression(s);
    case 'statement':
      return statement(s);
    case 'block':
      return block(s);
    case 'call':
      return call(s);
    case 'name':
      return name(s);
    case 'literal':
      return literal(s);
    case 'suffix':
      return suffix(s);
    }
  }

  // 関数呼び出し
  function call(stmt){
    //debugger;
    const func = stmt.first;
    const params = stmt.second;
    return  module.call(func.value,params.map(e=>expression(e)),binaryen[stmt.type]);
  }

  // 関数定義
  function functionStatement(funcNode) {
    // 関数本体
    const wasmStatement = [];

    // ローカル変数テーブル
    localVars = [];
    varIndex = 0;
    const paramTypes = [];
    const paramInits = [];

    // 関数名
    const funcName = funcNode.value;

    // 戻り値の型
    const funcReturnType = binaryen[funcNode.type];

    // 関数パラメータ
    if (funcNode.first) {
      const funcParams = funcNode.first;
      funcParams.forEach(p => {
        paramInits.push(define_(p,null));
        paramTypes.push(binaryen[p.type]);
      });
    }
   
    const statements = generate(funcNode.second);
    const ftype = module.addFunctionType(funcNode.value, binaryen[funcNode.type],paramTypes);
    module.addFunction(funcNode.value, ftype, localVars, module.block(null, statements));
    if(funcNode.export){
      module.addFunctionExport(funcNode.value,funcNode.value);
    }
  }

  function define_(d,vars = localVars){
    switch (d.nodeType) {
    case 'binary':
      // ローカル
      if (d.first.scope) {
        const left = d.first;
        vars && vars.push(binaryen[left.type]);
        left.varIndex = varIndex++;
        // 初期値の設定ステートメント
        d.global = false;
        return  module.setLocal(left.varIndex, expression(d.second));
      } else {
        module.addGlobal(d.first.value, binaryen[d.first.type], true, expression(d.second));
        d.global = true;
      }
      break;
    case 'name':
      // ローカル
      if (d.scope) {
        vars && vars.push(binaryen[d.type]);
        d.varIndex = varIndex++;
        d.global = false;
        return module.setLocal(d.varIndex, module[d.type].const(0));
      } else {
        d.global = true;
        return module.addGlobal(d.value, binaryen[d.type], true, module.i32.const(0));
      }
    }
  }

  function define(statement,result = []) {
    statement.first.forEach(d => {
      result.push(define_(d));
    });
    return result;
  }


  function expression(e) {
    switch (e.nodeType) {
    case 'literal':
      return literal(e);
    case 'binary':
      return binary(e);
    case 'unary':
      return unary(e);
    case 'name':
      return name(e);
    case 'call':
      return call(e);
    case 'suffix':
      return suffix(e);
    }
  }

  function literal(e) {
    switch (e.type) {
    case 'i32':
      // return module.setLocal()
      return module.i32.const(parseInt(e.value, 10));
    case 'i64':
      /* 64bit整数への対応コードが必要 */
      return module.i64.const(parseInt(e.value, 10));
    case 'f32':
      return module.f32.const(parseFloat(e.value));
    case 'f64':
      return module.f64.const(parseFloat(e.value));
    }
    e.error('Bad Type');
  }

  function binary(e) {
    const left = e.first,right = e.second;
    switch (e.value) {
    // 代入
    case '=':
      return assignment(left,right);
    case '+':
      return binOp('add',left,right);
    case '-':
      return binOp('sub',left,right);
    case '*':
      return binOp('mul',left,right);
    case '%':
      return binOp('rem',left,right,true);
    case '/':
      return binOp('div',left,right,true);
    case '+=':
      return setValue(left,binOp('add',left,right));
    case '-=':
      return setValue(left,binOp('sub',left,right));
    case '*=':
      return setValue(left,binOp('mul',left,right));
    case '/=':
      return setValue(left,binOp('div',left,right,true));
    case '%=':
      return setValue(left,binOp('rem',left,right,true));
    // 比較
    case '==':
      return binOp('eq',left,right);
    case '>':
      return binOp('gt',left,right,true);
    case '>=':
      return binOp('ge',left,right,true);
    case '<':
      return binOp('lt',left,right,true);
    case '<=':
      return binOp('le',left,right,true);
    case '!=':
      return binOp('ne',left,right);
    // 論理
    case '&&':
      return logicalAnd(left,right);
    case '||':
      return logicalOr(left,right);
    // ビット演算
    case '^':
      return binOp('xor',left,right);
    case '&':
      return binOp('and',left,right);
    case '|':
      return binOp('or',left,right);
    case '<<<':
      return binOp('shl',left,right);
    case '>>>':
      return binOp('shr',left,right,true);
    case '<<':
      return binOp('rotl',left,right);
    case '>>':
      return binOp('rotr',left,right);
    }
    e.error('Bad Binary Operator');
  }

  function setValue(n,v){
    return (n.global || !n.scope) ? module.setGlobal(n.value,v) : module.setLocal(n.varIndex,v);

  }

  function binOp(name,left,right,sign = false){
    //debugger;
    const t =  module[left.type];
    if(t){
      switch(left.type){
      case 'i32':
      case 'i64':
      {
        const op = t[sign ? name + '_s' : name];
        if(op){
          return op(expression(left),expression(right));
        } else {
          left.error('Bad Operation');
        }
        break;
      }
      case 'f32':
      case 'f64':
        {
          const op = t[sign ? name + '_s' : name];
          if(op) {
            op(expression(left),expression(right));
          } else {
            left.error('Bad Operation');
          }
        }
        break;
      }
    } else {
      switch(left.type){
      case 'u32':
      case 'u64':
        {
          const op = module['i' + left.type.slice(-2)][sign?name + '_u':name];
          if(op) {
            return op(expression(left),expression(right));
          } else {
            left.error('Bad Operation');
          }
        }
        break;
      default:
        left.error('Bad Type');
      }
    }
  }

  function logicalAnd(left,right){
    const t = module[left.type];
    if(t){
      return t.and(t.ne(expression(left),t.const(0,0)),t.ne(expression(right),t.const(0,0)));
    } else {
      switch(left.type){
      case 'u32':
      case 'u64':
      {
        const t = module['i' + left.type.slice(-2)];
        return t.and(t.ne(expression(left),t.const(0)),t.ne(expression(right),t.const(0)));
      }
      default:
        left.error('Bad Type.');
      }
    }
  }

  function logicalOr(left,right){
    const t = module[left.type];
    if(t){
      return t.or(t.ne(expression(left),t.const(0)),t.ne(expression(right),t.const(0)));
    } else {
      switch(left.type){
      case 'u32':
      case 'u64':
      {
        const t = module['i' + left.type.slice(-2)];
        return t.or(t.ne(expression(left),t.const(0)),t.ne(expression(right),t.const(0)));
      }
      default:
        left.error('Bad Type.');
      }
    }
  }

  function unary(e) {
    switch (e.value) {
    case '+':
      return expression(e.first);
    case '-':
      return neg(e.first);
    case '!':
      return not(e.first);
    case '~':
      return bitNot(e.first);
    case '++':
      return inc(e.first);
    case '--':
      return dec(e.first);
    }
  }

  function neg(left){
    switch(left.type){
    case 'i32':
    case 'u32':
      return module.i32.sub(module.i32.const(0),expression(left));
    case 'i64':
    case 'u64':
      return module.i64.sub(module.i64.const(0,0),expression(left));
    case 'f32':
    case 'f64':
      return module[left.type].neg(expression(left));
    }
  }

  function not(left){
    switch(left.type){
    case 'i32':
    case 'u32':
      return module.i32.xor(expression(left),module.i32.const(1));
    case 'i64':
    case 'u64':
      return module.i64.xor(expression(left),module.i64.const(0,1));
    case 'f32':
      return module.i32.reinterpret(
        module.select(
          module.i32.eq(module.f32.reinterpret(expression(left)),module.i32.const(0x80000000)),
          module.i32.const(0x80000000),
          module.f32.reinterpret(expression(left))
        )
      );
    case 'f64':
      return module.i64.reinterpret(
        module.select(
          module.i64.eq(module.f64.reinterpret(expression(left)),module.i64.const(0,0x80000000)),
          module.i64.const(0,0x80000000),
          module.f64.reinterpret(expression(left))
        )
      );

    }
  }

  function bitNot(left){
    switch(left.type){
    case 'i32':
    case 'u32':
      return module.i32.xor(expression(left),module.i32.const(0xffffffff));
    case 'i64':
    case 'u64':
      return module.i64.xor(expression(left),module.i64.const(0xffffffff,0xffffffff));
    case 'f32':
    case 'f64':
      return left.error('Bad Operation');
    }
  }

  function inc(left){
    const builtinType = module[left.type];
    if(builtinType){
      return setValue(left,builtinType.add(expression(left),builtinType.const(1)));
    } else {
      switch(left.type){
      case 'u32':
      case 'u64':
      {
        const t = module['i' + left.type.slice(-2)];
        return setValue(left,t.add(expression(left),t.const(1)));      
      }
      default:
        left.error('Bad Type');
      }
    }
  }

  function dec(left){
    const builtinType = module[left.type];
    if(builtinType){
      return setValue(left,builtinType.sub(expression(left),builtinType.const(1)));
    } else {
      switch(left.type){
      case 'u32':
      case 'u64':
      {
        const t = module['i' + left.type.slice(-2)];
        return setValue(left,t.sub(expression(left),t.const(1)));      
      }
      default:
        left.error('Bad Type');
      }
    }
  }

  function name(e) {
    if (!e.global) {
      return module.getLocal(e.varIndex, binaryen[e.type]);
    } else {
      return module.getGlobal(e.value, binaryen[e.type]);
    }
  }

  function assignment(left,right) {
    return setValue(left,expression(right));
  }


  function block(s){
    return module.block(null,generate(s.first));
  }

  function statement(s) {
    switch(s.id){
    case 'return':
      return module.return(expression(s.first));
    case 'if':
      return ifStatement(s);
    case 'while':
      return whileStatement(s);
    case 'break':
      return breakStatement(s);
    default:
      s.error('Bad Statement.');
    }
  }

  function breakStatement(s){
    return module.break(currentBrakePoint);
  }

  function ifStatement(s){
    const condition = expression(s.first);
    const thenStatemnts = generate(s.second);
    const elseStatements = s.third && generate(s.third);
    return module.if(condition,thenStatemnts,elseStatements);
  }

  function whileStatement(s){
    debugger;
    const bid = 'while' + (blockId++).toString(10);
    currentBrakePoint = bid; 
    const lid = 'loop' + (blockId++).toString(10);
    let stmt = generate(s.second);
    stmt = stmt instanceof Array ? stmt : [stmt];
    
    let condition = expression(s.first);
    
    let type = module[s.first.type];
    if(type){
      if(type.eqz){
        condition = type.eqz(condition);
      } else {
        switch(s.first.type){
        case 'f32':
          condition = module.i32.eq(module.f32.reinterpret(condition),module.i32.const(0x80000000));
          break;
        case 'f64':
          condition = module.i64.eq(module.f64.reinterpret(condition),module.i64.const(0,0x80000000));
          break;
        default:
          s.first.error('Bad.Type');
        }
      }
    } else {
      switch(s.first.type){
      case 'u32':
      case 'u64':
        {
          type = module['i' + s.first.type.slice(-2)];
          condition = type.eqz(condition);
        }
        break;
      default:
        s.first.error('Bad Type');
      }
    }

    return module.block(bid,[
      module.loop(lid,module.block(null,[
        module.br_if(bid,condition),
        ...stmt,
        module.break(lid)
      ]))]);
  }

  function suffix(s){
    switch(s.id){
    case '++':
      return postInc(s);
    case '--':
      return postDec(s);
    default:
      s.error('Bad Operator');
    }
  }

  function postInc(s){
    postOps.push(inc(s.first));
    return name(s.first);
  }

  function postDec(s){
    postOps.push(dec(s.first));
    return name(s.first);
  }
  
  generate(statements);

  return module;

}