
function error (message, t = this) {
  t.name = 'Compiler Error';
  t.message = message;
  throw t;
}

export default async function generateCode(ast,binaryen_) {

  let binaryen;
  await new Promise((resolve,reject)=>{
    binaryen = binaryen_({onRuntimeInitialized:m=>{
     resolve();
    }});
  });
  // debugger;
  // const binaryen = await new Promise(
  //   (resolve,reject)=>{
  //     b.then(function(bin) {
  //       resolve(bin);
  //     });
  //   });
  const module = new binaryen.Module();
  
  //  const exp = new binaryen.Expression();

  //module.setMemory(1, null, 'test1');
  //module.addGlobal('t', binaryen.i32, true, module.i32.const(1));
  let localVars;
  let varIndex = 0;
  let postOpcodes = [];
  let blockId = 0;
  let currentBrakePoint;
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
        if(postOpcodes.length > 0){
          result.push(...postOpcodes);
          postOpcodes.length = 0;
        } 
      });
    } else {
      let ops = generate_(stmts);
      ops instanceof Array ? result.push(...ops):result.push(ops);
      if(postOpcodes.length > 0){
        result.push(...postOpcodes);
        postOpcodes.length = 0;
      } 
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
    console.log('** define_() **');
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

  // 変数定義
  function define_(d,vars = localVars){
    console.log('** define_() **');
    switch (d.nodeType) {
    case 'binary':
      // 初期値あり
      if(binaryen[d.type]){
        // WASM ネイティブ型
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
      } else {
        // ユーザー定義型

      }
      break;
    case 'name':
      //　初期値なし 
      if(binaryen[d.type]){
        // WASM ネイティブ型
        if (d.scope) {
          // ローカル
          vars && vars.push(binaryen[d.type]);
          d.varIndex = varIndex++;
          d.global = false;
          return module.setLocal(d.varIndex, module[d.type].const(0));
        } else {
          // グローバル
          d.global = true;
          return module.addGlobal(d.value, binaryen[d.type], true, module.i32.const(0));
        }
      } else {
        // ユーザー定義型
       
        const typedef = d.scope.find(d.type,true);
        if(!typedef){
          error('Type Not Found.',d);
        }
        const detail = Object.assign(Object.create(typedef.detail),typedef.detail);
        d.members = detail.second;
       
        //console.log(detail);
        const results = [];
        d.members.forEach(member=>{
          const results_ = define(member);
          if(results_ instanceof Array){
            results.push(...results_);
          } else {
            results.push(results_);
          }
        });
        return results;
      }
    }
  }

  // 変数定義
  function define(statement,results = []) {
    console.log('** define() **');
    statement.first.forEach(d => {
      const result = define_(d);
      if(result instanceof Array){
        results.push(...result);
      } else {
        results.push(result);
      }
    });
    return results;
  }


  // 式
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
    console.log('** literal() **');
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
    error('Bad Type',e);
  }
  

  function binary(e) {
    console.log('** binary() **');
    switch (e.value) {
    // 代入
    case '=':
      return assignment(e);
    case '+':
      return binOp('add',e);
    case '-':
      return binOp('sub',e);
    case '*':
      return binOp('mul',e);
    case '%':
      return binOp('rem',e,true);
    case '/':
      return binOp('div',e,true);
    case '+=':
      return setValue(e.first,binOp('add',e),e);
    case '-=':
      return setValue(e.first,binOp('sub',e),e);
    case '*=':
      return setValue(e.first,binOp('mul',e),e);
    case '/=':
      return setValue(e.first,binOp('div',e,true),e);
    case '%=':
      return setValue(e.first,binOp('rem',e,true),e);
    // 比較
    case '==':
      return binOp('eq',e);
    case '>':
      return binOp('gt',e,true);
    case '>=':
      return binOp('ge',e,true);
    case '<':
      return binOp('lt',e,true);
    case '<=':
      return binOp('le',e,true);
    case '!=':
      return binOp('ne',e);
    // 論理
    case '&&':
      return logicalAnd(e);
    case '||':
      return logicalOr(e);
    // ビット演算
    case '^':
      return binOp('xor',e);
    case '&':
      return binOp('and',e);
    case '|':
      return binOp('or',e);
    case '<<<':
      return binOp('shl',e);
    case '>>>':
      return binOp('shr',e,true);
    case '<<':
      return binOp('rotl',e);
    case '>>':
      return binOp('rotr',e);
    // ドット演算子
    case '.':
      return dotOp(e);
    }
    error('Bad Binary Operator',e);
  }

  function setValue(n,v,e)
  {
    console.log('** setValue() **');
    !e && (e = n); 
    if(e.rvalue){
      if(n.global || !n.scope) {
        return module.block(null,[
          module.setGlobal(n.value,v),
          module.getGlobal(n.value,n.type)
        ]);
      } else {
        return module.teeLocal(n.varIndex,v);
      }
    } else {
      return (n.global || !n.scope) ? module.setGlobal(n.value,v) : module.setLocal(n.varIndex,v);
    }
  }

  function getValue(e){
    console.log('** getValue() **');
    const n = e.first; 
    return (n.global || !n.scope) ? module.getGlobal(n.value,n.type) : module.getLocal(n.varIndex,n.type);
  }
  

  function binOp_(name,e,left,right,sign){
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
          error('Bad Operation',left);
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
            error('Bad Operation',left);
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
            error('Bad Operation',left);
          }
        }
        break;
      default:
        {
          const l = expression(left);
          const r = expression(right);
          const lnative = module[l.type];
          const rnative = module[r.type];

          if(lnative && rnative && l.type  == r.type){
            return binOp_(name,e,l,r,sign);
          }
          error('Bad Type',left);
        }
//        error('Bad Type',left);
      }
    }
  }

  function binOp(name,e,sign = false){
    console.log(`** binOp(${name}) **`);

    //debugger;
    const left = e.first,right = e.second;
    return binOp_(name,e,left,right,sign);
  }

  function dotOp(e){
    console.log('** dotOp() **');
    const body = e.first.scope.find(e.first.value);
    const members = body.members;
    const memberName = e.second.value;
    if(e.second.id == '.'){
      return dotOp(e.second);
    }
    for(let i = 0,e = members.length;i < e;++i){
      const memberChilds = members[i].first;
      for(let j = 0,ej = memberChilds.length;j < ej;++j){
        if(memberChilds[j].first.value == memberName){
          return name(memberChilds[j].first);
        };
      }
    }
  }

  function logicalAnd(e){
    const left = e.first,right = e.second;
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
        error('Bad Type.',left);
      }
    }
  }

  function logicalOr(e){
    console.log('** logicalOr() **');

    const left = e.first,right = e.second;
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
        error('Bad Type.',left);
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
    default:
      return error('Bad Operation',left);
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
        error('Bad Type',left);
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
        error('Bad Type',left);
      }
    }
  }

  function name(e) {
    console.log('** name() **');

    if (!e.global) {
      return module.getLocal(e.varIndex, binaryen[e.type]);
    } else {
      return module.getGlobal(e.value, binaryen[e.type]);
    }
  }

  // 左辺のドット構文の解析
  function leftDotOp(e){
    const body = e.first.scope.find(e.first.value);
    const members = body.members;
    const memberName = e.second.value;
    if(e.second.id == '.'){
      return leftDotOp(e.second);
    }
    for(let i = 0,e = members.length;i < e;++i){
      const memberChilds = members[i].first;
      for(let j = 0,ej = memberChilds.length;j < ej;++j){
        if(memberChilds[j].first.value == memberName){
          return memberChilds[j].first;
        };
      }
    }
    error('Member Not Found',e);
  }

  // 代入
  function assignment(e,results = [],top = true) {
    console.log('** assignment() **');
    const left = e.first,right = e.second;
    // 代入する値がネイティブ型かどうか
    if(left.value == '.'){
      return results.push(setValue(leftDotOp(left),expression(right)));
    } else if(e.members){
      e.members.forEach(member=>{
        // 再帰的にassignmentを呼び出す
        assignment(member,results,false);
      });
      if(top){ 
        return module.block(null,results);
      }
    } else if(module[left.type]){
      results.push(setValue(left,expression(right)));
      return;
    } 
  }



  function block(s){
    console.log('** block() **');

    return module.block(null,generate(s.first));
  }

  function statement(s) {
    console.log('** statement() **');

    switch(s.id){
    case 'return':
      return module.return(expression(s.first));
    case 'if':
      return ifStatement(s);
    case 'while':
      return whileStatement(s);
    case 'do':
      return doStatement(s);
    case 'break':
      return breakStatement(s);
    case 'for':
      return forStatement(s);
    default:
      error('Bad Statement.',s);
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

  function not_(c){
    let condition = expression(c);
    
    let type = module[c.type];
    if(type){
      if(type.eqz){
        condition = type.eqz(condition);
      } else {
        switch(c.type){
        case 'f32':
          condition = module.i32.eq(module.f32.reinterpret(condition),module.i32.const(0x80000000));
          break;
        case 'f64':
          condition = module.i64.eq(module.f64.reinterpret(condition),module.i64.const(0,0x80000000));
          break;
        default:
          error('Bad.Type',c);
        }
      }
    } else {
      switch(c){
      case 'u32':
      case 'u64':
        {
          type = module['i' + c.type.slice(-2)];
          condition = type.eqz(condition);
        }
        break;
      default:
        error('Bad Type',c);
      }
    }
    return condition;  
  }

  function whileStatement(s){
    const bid = 'while' + (blockId++).toString(10);
    currentBrakePoint = bid; 
    const lid = 'loop' + (blockId++).toString(10);
    let stmt = generate(s.second);
    stmt = stmt instanceof Array ? stmt : [stmt];
    
    let condition = not_(s.first);
    return module.block(bid,[
      module.loop(lid,module.block(null,[
        module.br_if(bid,condition),
        ...stmt,
        module.break(lid)
      ]))]);
  }

  function doStatement(s){
    const bid = 'do' + (blockId++).toString(10);
    currentBrakePoint = bid; 
    const lid = 'loop' + (blockId++).toString(10);
    let stmt = generate(s.second);
    stmt = stmt instanceof Array ? stmt : [stmt];
    
    let condition = not_(s.first);
    
    return module.block(bid,[
      module.loop(lid,module.block(null,[
        ...stmt,
        module.br_if(bid,condition),
        module.break(lid)
      ]))]);    
  }

  function forStatement(s){

    const bid = 'for' + (blockId++).toString(10);
    currentBrakePoint = bid; 
    const lid = 'loop' + (blockId++).toString(10);

    let initStmt = generate(s.first);
    let condition = not_(s.second);
    let conditionAfter = expression(s.third);
    let stmt = generate(s.fourth);

    initStmt = initStmt instanceof Array ? initStmt : [initStmt]; 
    conditionAfter = conditionAfter instanceof Array ? conditionAfter : [conditionAfter];
    stmt = stmt instanceof Array ? stmt : [stmt];

    return module.block(bid,[
      ...initStmt,
      module.loop(lid,module.block(null,[
        module.br_if(bid,condition),
        ...stmt,
        ...conditionAfter,
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
      error('Bad Operator',s);
    }
  }

  function postInc(s){
    postOpcodes.push(inc(s.first));
    return name(s.first);
  }

  function postDec(s){
    postOpcodes.push(dec(s.first));
    return name(s.first);
  }
  
  generate(statements);

  return module;

}