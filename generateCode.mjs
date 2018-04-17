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

  module.setMemory(1, null, 'test1');
  module.addGlobal('t', binaryen.i32, true, module.i32.const(1));
  const localVars = [];
  //module.addMemoryImport('test','test','a');

  const statements = ast.first;

  function generate(statements, module) {
    statements.forEach((statement) => {
      generate_(statement, module);
    });
  }

  function generate_(s) {
    switch (s.nodeType) {
    case 'define':
      define(s);
      break;
    case 'function':
      function_(s);
      break;
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
    const localVars = [];
    let varIndex = 0;

    // 関数名
    const funcName = funcNode.value;

    // 戻り値の型
    const funcReturnType = binaryen[funcNode.type];

    // 関数パラメータ
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

    // //const statements = generate(funcNode.second);
    // const ftype = module.addFunctionType(funcNode.value,binaryen[funcNode.type]);
    // module.addFunction(funcNode.value,ftype,locals,module.block(null,wasmStmt));

  }

  function define(statement, localVars) {
    statement.first.forEach(d => {
      switch (d.nodeType) {
      case 'binary':
        // ローカル
        if (d.scope && d.scope.parent) {
          localVars.push(d);
        } else {
          module.addGlobal(d.first.value, binaryen[d.first.type], true, expression(d.second));
          d.global = true;
        }
        break;
      case 'name':
        // ローカル
        if (d.scope && d.scope.parent) {
          localVars.push(d);
        } else {
          module.addGlobal(d.value, binaryen[d.type], true, module.i32.const(0));
          d.global = true;
        }
        break;
      }
    });
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
    }
    e.error('Bad Binary Operator');
  }

  function unary(e) {
    switch (e.value) {
    case '+':
      return expression(e);
    case '-':
      if(e.first.type == 'i32')
      return module.f64.neg()

    }

  }

  function name(e) {

  }

  function assignment(e) {
    const left = e.first;
    const right = expression(e.second);
    if (left.global) {
      return module.setGlobal(left.value, right);
    } else {
      return module.setLocal(left.varIndex, right);
    }
  }

  function add(e) {
    return module[e.type].add(expression(e.first), expression(e.second));
  }

  function statement(statement) {

  }

  generate(statements, module);

  console.log(localVars);
  return module;

}