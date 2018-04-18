import binaryen from 'binaryen';

Object.prototype.error = function (message, t) {
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
    stmts.forEach((stmt) => {
      const r = generate_(stmt);
      if(r instanceof Array){
        result.push(...r);
      } else if(r){
        result.push(r);
      }
    });
    return result;
  }

  function generate_(s) {
    switch (s.nodeType) {
    case 'define':
      return define(s);
    case 'function':
      return function_(s);
    case 'unary':
      break;
    case 'binary':
      break;
    case 'statement':
      statement(s);
      break;
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
    if(funcNode.first){
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

    debugger;
    const statements = generate(funcNode.second);
    const ftype = module.addFunctionType(funcNode.value,binaryen[funcNode.type]);
    module.addFunction(funcNode.value,ftype,localVars,module.block(null,statements));

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
          left.varIndex = d.localVars - 1;
          // 初期値の設定ステートメント
          result.push(module.setLocal(left.varIndex,expression(d.second)));
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
          d.varIndex = d.localVars - 1;
          result.push(module.setLocal(d.varIndex,module[d.type].const(0)));
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
    switch (e.value) {
    case '=':
      return assignment(e);
    case '+':
      return add(e);
    case '-':
      return sub(e);
    case '*':
      return mul(e);
    case '/':
      return div(e);
    case '(name)':
      return name(e);
    case '(literal)':
      return literal(e);
    }
    e.error('Bad Binary Operator');
  }

  function unary(e) {
    switch (e.value) {
    case '+':
      return expression(e);
    case '-':
      //if(e.first.type == 'i32')
      //return module.f64.neg()
      break;
    }

  }

  function name(e) {
    if(!e.global){
      return module.getLocal(e.varIndex,e.type);
    } else {
      return module.getGlobal(e.value,e.type);
    }
  }

  function assignment(e) {
    const left = e.first;
    const right = expression(e.second);
    if (left.global) {
      return module.setGlobal(left.value, right);
    } else {
      return module.setLocal(left.varIndex,right);
    }
  }

  function add(e) {
    return module[e.type].add(expression(e.first), expression(e.second));
  }

  function sub(e) {
    return module[e.type].sub(expression(e.first), expression(e.second));
  }

  function mul(e) {
    return module[e.type].mul(expression(e.first), expression(e.second));
  }

  function div(e) {
    return module[e.type].mul(expression(e.first), expression(e.second));
  }

  function statement(s) {

  }

  generate(statements);

  console.log(localVars);
  return module;

}