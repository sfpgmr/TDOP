'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{
  test('test-array', async t => {
    for(const type of types){
      const testSrc = `
      export i32 main(){
        i32 p = 0;
        for(i32 i = 0;i < 10;++i){
          p[i] = (${type.type})i;
        }
        ${type.type} a = p[9];
        if( a == 10${type.literalSuffix}){
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


