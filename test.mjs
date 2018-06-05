'use strict';
import test from 'tape-async';
import generateCode from './generateCode.mjs';
import tokenize from './tokens.mjs';
import make_parse from './parse.mjs';
import fs from 'fs';
import path from 'path';
import binaryen from './binaryen-wasm.js';

test('compile test',async t=>{
  const testSrc = 
`
type Foo {
  public:
    i32 a = 1;
    i32 b = 2;
  }
  
  export i32 main(){
    Foo foo,foo1;
    //foo.a = 10;
    foo1 = foo;  
    return foo.a * foo1.b;
  };
    //i32 a = 1;
    //return a;
`;
try {
  const tokens = tokenize(testSrc);

  fs.writeFileSync('./tokens.json', JSON.stringify(tokens, null, 4), 'utf8');
   
  const parse = make_parse();
  const ast = parse(tokens);
  const json = JSON.stringify(ast,
    (key,value)=>{
      if(key == 'parent' || key == 'detail')  return undefined;
      return value;
    } 
    , 2);
  
  fs.writeFileSync('./ast.json', json, 'utf8');
  console.log('パース完了');
     
  const module = await generateCode(ast,binaryen);
  module.validate();
  //module.optimize();
  
  fs.writeFileSync('out.wat',module.emitText(),'utf8');
  
  const compiled = module.emitBinary();
  fs.writeFileSync('out.wasm',compiled);
  
  console.log('コンパイル完了');
  
  // 実行
  
  //const bin = new WebAssembly.Module(fs.readFileSync('out.wasm'));
  const bin = new WebAssembly.Module(compiled);
  const inst = new WebAssembly.Instance(bin,{});
  t.equal(inst.exports.main(),2);
  //console.log(inst.exports.main());

} catch(e){
  console.log(e);
}

});
