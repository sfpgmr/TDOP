'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{
  test('test-alias-1', async t => {
    for(const type of types){
      const testSrc = `
      export i32 main(){
        ${type.type} a = 1${type.literalSuffix};        
        ${type.type}& b = a; 
        ++a;
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


