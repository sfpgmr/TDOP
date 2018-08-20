'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{
  // test('test-cast-normal', async t => {
  //   for(const type of types){
  //     for(const type2 of types){
  //       const testSrc = `
  //       export i32 main(){
          
  //         ${type.type} a = 10${type.literalSuffix};
  //         ${type2.type} b = (${type2.type})(a + 10${type.literalSuffix});
  //         if( b == 20${type2.literalSuffix}){
  //           return 1;
  //         } else {
  //           return 0;
  //         }
  //       };
  //       `;
  //       const testName = `${t.name}-${type.type}-${type2.type}`;
  //       let inst, result;
  //       try {
  //         inst = await compiler.compileAndInstanciate(testName, testSrc,`./tests/out/${t.name}`);
  //         result = inst.exports.main();
  //       } catch (e) {
  //         console.log(e, e.stack);
  //         t.fail(testName);
  //       }
  //       t.equal(result, 1, testName);
  //     }
  //   }
  // });

  test('test-cast-reinterpret', async t => {
    for(const type of types){
      for(const type2 of types){
        const testSrc = `
        export i32 main(){
          
          ${type.type} a = 10${type.literalSuffix};
          ${type2.type} b = (~${type2.type})(a + 10${type.literalSuffix});
          if( b == 20${type2.literalSuffix}){
            return 1;
          } else {
            return 0;
          }
        };
        `;
        const testName = `${t.name}-${type.type}-${type2.type}`;
        let inst, result;
        try {
          inst = await compiler.compileAndInstanciate(testName, testSrc,`./tests/out/${t.name}`);
          result = inst.exports.main();
        } catch (e) {
          console.log(e, e.stack);
          t.fail(testName);
        }
        t.equal(result, 1, testName);
      }
    }
  });
  // test('test-cast-2', async t => {
  //   for(const type of types){
  //     const testSrc = `
  //     export i32 main(){
  //       i32 p = 0;
  //       i32 a = 0x 3e200000 x;
  //       *p = (${type.type}*)a;
  //       ${type.type} a = *p;
  //       if( a == 0x 3e200000 xf${type.literalSuffix}){
  //         return 1;
  //       } else {
  //         return 0;
  //       }
  //     };
  //     `;
  //     const testName = `${t.name}-${type.type}`;
  //     let inst, result;
  //     try {
  //       inst = await compiler.compileAndInstanciate(testName, testSrc);
  //       result = inst.exports.main();
  //     } catch (e) {
  //       console.log(e, e.stack);
  //       t.fail(testName);
  //     }
  //     t.equal(result, 1, testName);
  //   }
  // });
}


