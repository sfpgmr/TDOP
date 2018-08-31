'use strict';
import test from 'tape-async';
import * as compiler from './compiler.mjs';
import './test-expressions-arithmetic.mjs';
import './test-expressions-condition.mjs';
import './test-expressions-logical.mjs';
import './test-expressions-bitwise.mjs';
import './test-expressions-loop.mjs';
import './test-literal.mjs';
import './test-pointer.mjs';
import './test-cast.mjs';
import './test-array.mjs';
import './test-const.mjs';


//test_expression_add();

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

const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
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

const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
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

  const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
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

  const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
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

    const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
    t.equal(inst.exports.main(),4);
    console.log(inst.exports.main());
});

test('test-for',async t=>{
  const testSrc = 
  `
  export i32 main(){
    i32 b = 0;
    for(i32 c = 0;c < 4;c+=1) {
      b = b + 1;
    }
    return b;// 4
  };
      `;

      const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
      t.equal(inst.exports.main(),4);
    console.log(inst.exports.main());
});

test('test-if',async t=>{
  const testSrc = 
  `
  export i32 main(i32 a){
    if(a == 1){
      return 1;
    } else {
      return 0;
    }
  };
      `;

    const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
    t.equal(inst.exports.main(2),0);
    t.equal(inst.exports.main(1),1);
    console.log(inst.exports.main());
});

