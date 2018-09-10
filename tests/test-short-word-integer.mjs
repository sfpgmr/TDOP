'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{
  test('test-u8', async t => {
    const types_ = [

    ];
    
    for(const type of types){
      const testSrc = `
      export i32 main(){
        i32 size = sizeof(${type.type});
        if( size == ${type.size}){
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

  test('test-sizeof-2', async t => {
    for(const type of types){
      const testSrc = `
      export i32 main(){
        ${type.type} a = 10${type.literalSuffix};
        i32 size = sizeof(a);
        if( size == ${type.size}){
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


