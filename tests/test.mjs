'use strict';
import test from 'tape-async';
import generateCode from '../generateCode.mjs';
import tokenize from '../tokens.mjs';
import make_parse from '../parse.mjs';
import fs from 'fs';
import path from 'path';
import binaryen from '../binaryen-wasm.js';

const parse = make_parse();

test('mul test',async t=>{
  const testSrc = 
`
  export i32 main(){
    i32 a = 2,b = 3;
    return a * b;
  };
`;

    const obj = await compile('test01',testSrc);
    //const bin = new WebAssembly.Module(fs.readFileSync('out.wasm'));
    const inst = getInstance(obj);
    t.equal(inst.exports.main(),6);
    console.log(inst.exports.main());
});

test('compile testx',async t=>{
  const testSrc = 
`
type Foo {
  i32 a = 10;
  i32 b = 2;
};
  export i32 main(){
    Foo foo;
//    foo.a = 10;
    return foo.a * foo.b;
  };
`;

    const obj = await compile('test01',testSrc);
    //const bin = new WebAssembly.Module(fs.readFileSync('out.wasm'));
    const inst = getInstance(obj);
    t.equal(inst.exports.main(),20);
    console.log(inst.exports.main());
});

test('** type test ** ',async t=>{
  const testSrc = 
  `
  type Bar {
  public:
    i32 barA = 3;
    i32 barB = 4;
  };
  
  type Foo {
  public:
    i32 a = 1;
    i32 b = 2;
    Bar c;
  };
  
  export i32 main(){
    Foo foo,foo1;
    foo.a = 10;
    foo1 = foo;  
    return foo.a * foo1.b;
  };`;

    const obj = await compile('test01',testSrc);
    //const bin = new WebAssembly.Module(fs.readFileSync('out.wasm'));
    const inst = getInstance(obj);
    t.equal(inst.exports.main(),20);
    console.log(inst.exports.main());
});


function getInstance(obj){
  const bin = new WebAssembly.Module(obj);
  const inst = new WebAssembly.Instance(bin,{});
  return inst;
}

const exceptProperties = ['parent','typeRef','detail'];

async function compile(name,src){
    const tokens = tokenize(src);
    const ast = parse(tokens);
    const json = JSON.stringify(ast,
      (key,value)=>{
        return exceptProperties.includes(key) ? undefined : value; 
      } 
      , 2);
    
    fs.writeFileSync(`./tests/out/${name}.json`, json, 'utf8');
    const module = await generateCode(ast,binaryen);
    module.validate();
    fs.writeFileSync(`./tests/out/${name}.wat`,module.emitText(),'utf8');
    const compiled = module.emitBinary();
    fs.writeFileSync(`./tests/out/${name}.wasm`,compiled);
    return compiled;    
}
