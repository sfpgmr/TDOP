'use strict';
import test from 'tape-async';
import generateCode from '../generateCode.mjs';
import tokenize from '../tokens.mjs';
import make_parse from '../parse.mjs';
import fs from 'fs';
import path from 'path';
import binaryen from '../binaryen-wasm.js';

const parse = make_parse();

test('test-expression-add',async t=>{
  const testSrc = 
`
  export i32 main(){
    i32 a = 2,b = 3;
    return a + b;
  };
`;
    const inst = await compileAndInstanciate(t.name,testSrc);
    t.equal(inst.exports.main(),5);
});

test('test-expression-sub',async t=>{
  const testSrc = 
`
  export i32 main(){
    i32 a = 2,b = 3;
    return a - b;
  };
`;

    const obj = await compile(t.name,testSrc);
    const inst = getInstance(obj);
    t.equal(inst.exports.main(),-1);
    console.log(inst.exports.main());
});


test('test-expression-mul',async t=>{
  const testSrc = 
`
  export i32 main(){
    i32 a = 2,b = 3;
    return a * b;
  };
`;

    const obj = await compile('test-expression-mul',testSrc);
    const inst = getInstance(obj);
    t.equal(inst.exports.main(),6);
    console.log(inst.exports.main());
});

test('test-expression-div',async t=>{
  const testSrc = 
`
  export i32 main(){
    i32 a = 6,b = 3;
    return a / b;
  };
`;

    const obj = await compile(t.name,testSrc);
    const inst = getInstance(obj);
    t.equal(inst.exports.main(),2);
    console.log(inst.exports.main());
});


test('test-type01',async t=>{
  const testSrc = 
`
type Foo {
  i32 a = 10;
  i32 b = 2;
};
  export i32 main(){
    Foo foo;
    return foo.a * foo.b;
  };
`;

    const obj = await compile(t.name,testSrc);
    const inst = getInstance(obj);
    t.equal(inst.exports.main(),20);
    console.log(inst.exports.main());
});

test('test-type02',async t=>{
  const testSrc = 
`
type Foo {
  i32 a = 10;
  i32 b = 2;
};
  export i32 main(){
    Foo foo,foo1;
    foo.a = 3;
    foo.b = 4;
    foo1 = foo;
    return foo1.a * foo.b;
  };
`;

    const obj = await compile(t.name,testSrc);
    const inst = getInstance(obj);
    console.log(inst.exports.main());
    t.equal(inst.exports.main(),12);
});


test('test-type03-nest',async t=>{
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
    foo.a = 2;
    foo1 = foo;  
    foo.a = 10;
    return foo.a * foo1.a;
  };`;

    const obj = await compile(t.name,testSrc);
    const inst = getInstance(obj);
    t.equal(inst.exports.main(),20);
    console.log(inst.exports.main());
});

test('test-type03-nest2',async t=>{
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
    foo.c.barA = 20;
    return foo.c.barA;
  };`;

    const obj = await compile(t.name,testSrc);
    const inst = getInstance(obj);
    t.equal(inst.exports.main(),20);
    console.log(inst.exports.main());
});

test('test-fucntion-call',async t=>{
  const testSrc = 
  `
  i32 𩸽(i32 a,i32 b){
    return a * b;
  };
  
  export i32 main(){
  i32 b = 2;
 
  return 𩸽(b,b);// 4
  };
    `;

    const obj = await compile(t.name,testSrc);
    const inst = getInstance(obj);
    t.equal(inst.exports.main(),4);
    console.log(inst.exports.main());
});

test('test-for',async t=>{
  const testSrc = 
  `
  export i32 main(){
    i32 b = 0;
    for(i32 c = 0;c < 4;++c) {
      b = b + 1;
    }
    return b;// 4
  };
      `;

    const obj = await compile(t.name,testSrc);
    const inst = getInstance(obj);
    t.equal(inst.exports.main(),4);
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

async function compileAndInstanciate(name,src){
  const obj = await compile(name,src);
  return getInstance(obj);
}

