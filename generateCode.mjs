import binaryen from 'binaryen';

export default function generateCode(ast){
  // Create a module with a single function
  const module = new binaryen.Module();
  //  const exp = new binaryen.Expression();
  
  module.setMemory(1,null,'test1');
  module.addGlobal('t',binaryen.i32,true,module.i32.const(1));
  const localVars = [];
  //module.addMemoryImport('test','test','a');

  const statements = ast.first;

  function generate(statements,module){
    statements.forEach((statement)=>{
      generate_(statement,module);
    });
  }

  function generate_(s){
    switch(s.nodeType){
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

  function function_(funcStatement){
    const wasmStmt = [];
    const locals = [];
    
    let i = 0;
    funcStatement.scope.def.forEach((v,k)=>{
      if(v.reserved || !v.type) return;
      debugger;
      v.varIndex = i++; 
      switch(v.nodeType){
      case 'name':
        locals.push(binaryen[v.type]);
        break;
      case 'binary':
        // 初期化コードの挿入
        wasmStmt.push(module.setLocal(i,expression(v.second)));
        locals.push(binaryen[v.first.type]);
        break;
      }
    });

    //const statements = generate(funcStatement.second);
    const ftype = module.addFunctionType(funcStatement.value,binaryen[funcStatement.type]);
    module.addFunction(funcStatement.value,ftype,locals,module.block(null,wasmStmt));

  }

  function define(statement){
    statement.first.forEach(d=>{
      switch(d.nodeType){
      case 'binary':
        // ローカル
        if(d.scope && d.scope.parent){
          localVars.push(d);
        } else {
          module.addGlobal(d.first.value,binaryen[d.first.type],true,expression(d.second));
        }
        break;
      case 'name':
        // ローカル
        if(d.scope && d.scope.parent){
          localVars.push(d);
        } else {
          module.addGlobal(d.value,binaryen[d.type],true,module.i32.const(0));
        }
        break;
      }
    });
  }

  function expression(e){
    switch (e.nodeType){
    case 'literal':
      switch(e.type){
      case 'i32':
        // return module.setLocal()
        return module.i32.const(parseInt(e.value,10));
      case 'i64':
        /* 64bit整数への対応コードが必要 */
        return module.i64.const(parseInt(e.value,10));
      case 'f32':
        return module.f32.const(parseFloat(e.value));
      case 'f64':
        return module.f64.const(parseFloat(e.value));
      }
      break;
    case 'binary':
      switch(e.value){
      case '=':
        break;
      case '+':
        break;
      case '-':
        break;
      case '*':
        break;
      case '/':
        break;
      }
      break;
    }
  }

  function statement(statement){

  }

  generate(statements,module);

  console.log(localVars);
  return module;

}