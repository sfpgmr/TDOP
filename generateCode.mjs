import binaryen from 'binaryen';

Object.prototype.error = function(message, t) {
  t = t || this;
  t.name = 'Error';
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
  //module.addMemoryImport('test','test','a');

  const statements = ast.first;

  function generate(stmts) {
    const result = [];
    if(stmts instanceof Array){
      stmts.forEach((stmt) => {
        const r = generate_(stmt);
        if (r instanceof Array) {
          result.push(...r);
        } else if (r) {
          result.push(r);
        }
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
      return function_(s);
    case 'unary':
      return expression(s);
    case 'binary':
      return expression(s);
    case 'statement':
      return statement(s);
    case 'block':
      return block(s);
    case 'call':
      break;
    case 'name':
      break;
    case 'literal':
      break;
    }
  }



  function function_(funcNode) {

    // 関数本体
    const wasmStatement = [];

    // ローカル変数テーブル
    localVars = [];
    let varIndex = 0;

    // 関数名
    const funcName = funcNode.value;

    // 戻り値の型
    const funcReturnType = binaryen[funcNode.type];

    // 関数パラメータ
    if (funcNode.first) {
      const funcParams = funcNode.first;
      funcParams.forEach(p => {
        switch (p.nodeType) {
        case 'binary':
          {
            if (p.value != '=') throw p;
            const param = p.first;
            localVars[varIndex] = binaryen[param.type];
            param.varIndex = varIndex++;
            wasmStatement.push(assignment(p));
          }
          break;
        case 'name':
          localVars[varIndex] = binaryen[p.type];
          p.varIndex = varIndex++;
          break;
        }
      });

    }




    // funcNode.scope.def.forEach((v,k)=>{
    //   if(v.reserved || !v.type) return;
    //   debugger;
    //   v.varIndex = i++; 
    //   switch(v.nodeType){
    //   case 'name':
    //     locals.push(binaryen[v.type]);
    //     break;
    //   case 'binary':
    //     // 初期化コードの挿入
    //     wasmStmt.push(module.setLocal(i,expression(v.second)));
    //     locals.push(binaryen[v.first.type]);
    //     break;
    //   }
    // });

    
    const statements = generate(funcNode.second);
    const ftype = module.addFunctionType(funcNode.value, binaryen[funcNode.type]);
    module.addFunction(funcNode.value, ftype, localVars, module.block(null, statements));
    if(funcNode.export){
      module.addFunctionExport(funcNode.value,funcNode.value);
    }
  }

  function define(statement) {
    const result = [];
    statement.first.forEach(d => {
      switch (d.nodeType) {
      case 'binary':
        // ローカル
        if (d.first.scope) {
          const left = d.first;
          localVars.push(binaryen[left.type]);
          left.varIndex = localVars.length - 1;
          // 初期値の設定ステートメント
          result.push(module.setLocal(left.varIndex, expression(d.second)));
          d.global = false;
        } else {
          module.addGlobal(d.first.value, binaryen[d.first.type], true, expression(d.second));
          d.global = true;
        }
        break;
      case 'name':
        // ローカル
        if (d.scope) {
          localVars.push(binaryen[d.type]);
          d.varIndex = localVars.length - 1;
          result.push(module.setLocal(d.varIndex, module[d.type].const(0)));
          d.global = false;
        } else {
          module.addGlobal(d.value, binaryen[d.type], true, module.i32.const(0));
          d.global = true;
        }
        break;
      }
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
    debugger;
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
    const t =  module[left.type];
    if(t){
      switch(left.type){
      case 'i32':
      case 'i64':
      {
        const op = t[sign ? name + '_s ' : name];
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
          const op = t[sign ? name + '_s ' : name];
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
      return t.and(t.ne(expression(left),t.const(0)),t.ne(expression(right),t.const(0)));
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
    }
  }

  function neg(left){
    switch(left.type){

    }

  }

  function not(left){

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
    }
  }

  function ifStatement(s){
    const condition = expression(s.first);
    const thenStatemnts = generate(s.second);
    const elseStatements = s.third && generate(s.third);
    return module.if(condition,thenStatemnts,elseStatements);
  }

  generate(statements);

  console.log(localVars);
  return module;

}