'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{
  // test('test-alias-define-var', async t => {
  //   for(const type of types){
  //     const testSrc = `
  //     ${type.type} g = 2${type.literalSuffix};// グローバル変数
  //     export i32 main(){
  //       ${type.type} a = 1${type.literalSuffix};        
  //       ${type.type}& b = a; 
  //       ${type.type}& c = b; 
  //       ${type.type}& ga = g;
  //       ++c;
  //       c += ga;
  //       if(a == 4${type.literalSuffix} && b == 4${type.literalSuffix} && c == a){
  //         return 1;
  //       } else {
  //         return 0;
  //       }
  //     };
  //     `;
  //     const testName = `${t.name}-${type.type}`;
  //     let inst, result;
  //     try {
  //       inst = await compiler.compileAndInstanciate(testName, testSrc,`./tests/out/${t.name}`);
  //       result = inst.exports.main();
  //     } catch (e) {
  //       console.log(e, e.stack);
  //       t.fail(testName);
  //     }
  //     t.equal(result, 1, testName);
  //   }
  // });

  test('test-alias-type', async t => {
    for(const type of types){
      const testSrc = `
      export i32 main(){
        type& T = ${type.type};        
        type& T1 = T;        
        T a = 1${type.literalSuffix}; 
        T1 b = 1${type.literalSuffix}; 
        ++a;
        ++b;
        if(a == 2${type.literalSuffix} && b == 2${type.literalSuffix}){
          return 1;
        } else {
          return 0;
        }
      };
      `;
      const testName = `${t.name}-${type.type}`;
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
  });


}


