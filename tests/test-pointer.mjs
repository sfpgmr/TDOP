'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{
  test('test-pointer', async t => {
    // const testSrc =           `
    //   export i32 main(){
    //     ${tp.type} a = ${tp.literalPrefix}${op.a}${tp.literalSuffix},b=${tp.literalPrefix}${op.b}${tp.literalSuffix},ans;
    //     ans = a ${op.op} b;
    //     if(ans == ${tp.literalPrefix}${op.result}${tp.literalSuffix}){
    //       return 1;
    //     } else {
    //       return 0;
    //     }
    //   };
    // ` ;
    for(const type of types){
      const testSrc = `
      export i32 main(){
        i32 p = 0;
        *p = 32${type.literalSuffix};
        ${type.type} a = *p;
        if( a == 32${type.literalSuffix}){
          return 1;
        } else {
          return 0;
        }
      };
      `;
      const testName = `${t.name}-${type.type}`;
      let inst, result;
      try {
        inst = await compiler.compileAndInstanciate(testName, testSrc);
        result = inst.exports.main();
      } catch (e) {
        console.log(e, e.stack);
        t.fail(testName);
      }
      t.equal(result, 1, testName);
    }
  });
}


