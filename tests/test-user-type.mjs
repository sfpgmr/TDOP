'use strict';
import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';


// test('test-type01',async t=>{
//   const testSrc = 
// `
// type Foo {
//   i32 a = 10;
//   i32 b = 2;
// };
//   export i32 main(){
//     Foo foo;
//     return foo.a * foo.b;
//   };
// `;

// const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
// t.equal(inst.exports.main(),20);
//     console.log(inst.exports.main());
// });

// test('test-type02',async t=>{
//   const testSrc = 
// `
// type Foo {
//   i32 a = 10;
//   i32 b = 2;
// };
//   export i32 main(){
//     Foo foo,foo1;
//     foo.a = 3;
//     foo.b = 4;
//     foo1 = foo;
//     return foo1.a * foo.b;
//   };
// `;

// const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
// console.log(inst.exports.main());
//     t.equal(inst.exports.main(),12);
// });


// test('test-type03-nest',async t=>{
//   const testSrc = 
//   `
//   type Bar {
//   public:
//     i32 barA = 3;
//     i32 barB = 4;
//   };
  
//   type Foo {
//   public:
//     i32 a = 1;
//     i32 b = 2;
//     Bar c;
//   };
  
//   export i32 main(){
//     Foo foo,foo1;
//     foo.a = 2;
//     foo1 = foo;  
//     foo.a = 10;
//     return foo.a * foo1.a;
//   };`;

//   const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
//   t.equal(inst.exports.main(),20);
//     console.log(inst.exports.main());
// });



// test('test-type03-nest2',async t=>{
//   const testSrc = 
//   `
//   type Bar {
//   public:
//     i32 barA = 3;
//     i32 barB = 4;
//   };
  
//   type Foo {
//   public:
//     i32 a = 1;
//     i32 b = 2;
//     Bar c;
//   };
  
//   export i32 main(){
//     Foo foo,foo1;
//     foo.c.barA = 20;
//     return foo.c.barA;
//   };`;

//   const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
//   t.equal(inst.exports.main(),20);
//     console.log(inst.exports.main());
// });

// test('test-type04-alias',async t=>{
//   const testSrc = 
//   `
 
//   type Foo {
//   public:
//     i32 a = 1;
//     i32 b = 2;
//   };
  
//   export i32 main(){
//     Foo foo;
//     Foo& foo1 = foo;
//     foo1.a = 2;
//     foo1.b = 2;
//     return foo.a * foo.b;
//   };`;

//   const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
//   t.equal(inst.exports.main(),4);
//     console.log(inst.exports.main());
// });


test('test-type05-pointer',async t=>{
  const testSrc = 
  `
  type Foo {
  public:
    i32 a = 1;
    i32 b = 1;
  };

  Foo fooGlobal;//グローバル変数

  export i32 main(){
    Foo* fooPtr = 0x8000;
    fooPtr.a = 2;
    fooPtr.b = 2;

    Foo fooLocal;// ローカル変数
    fooGlobal.a = 3;
    fooGlobal.b = 3;

    *fooPtr = fooLocal;// ローカル変数→メモリ
    fooPtr += sizeof(Foo);
    *fooPtr = fooGlobal;// グローバル変数→メモリ

    fooGlobal = fooLocal;// ローカル変数→グローバル変数
    fooLocal = fooGlobal;// グローバル変数→ローカル変数

    fooLocal = *fooPtr;// メモリ→ローカル変数
    fooGlobal = *(fooPtr - sizeof(Foo));// メモリ→グローバル変数

    return fooPtr.a * fooPtr.b;
  };`;

  const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
  t.equal(inst.exports.main(),9);
    console.log(inst.exports.main());
});

// test('test-type06-sizeof',async t=>{
//   const testSrc = 
//   `
 
//   type Foo {
//   public:
//     i32 a = 1;
//     i32 b = 2;
//   };
  
//   export i32 main(){
//     return sizeof(Foo);
//   };`;

//   const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
//   t.equal(inst.exports.main(),8);
//     console.log(inst.exports.main());
// });

