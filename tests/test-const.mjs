'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{
  test('test-const', async t => {
    for(const type of types){
      const testSrc = `
      // 定数は常にグローバルスコープとなる
      const CONST_A = 4${type.literalSuffix} * 2${type.literalSuffix};
      const CONST_B = 2${type.literalSuffix} * CONST_A;
      export i32 main(){
        // ローカルスコープ
        ${type.type} a = CONST_A * CONST_B;
        if( a == 128${type.literalSuffix}){
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


