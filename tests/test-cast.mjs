'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{
  test('test-cast-normal', async t => {
    for(const type of types){
      for(const type2 of types){
        const testSrc = `
        export i32 main(){
          
          ${type.type} a = 10${type.literalSuffix};
          ${type2.type} b = (${type2.type})(a + 10${type.literalSuffix});
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

  const reinterpretCastTests = [
    {
      'type':'i32',
      'value':'0x3e200000x',
      'castType':'f32',
      'result':'0.15625f'
    },
    {
      'type':'u32',
      'value':'0x3e200000x',
      'castType':'f32',
      'result':'0.15625f'
    },
    {
      'type':'i64',
      'value':'0x3fc4 0000 00000000xl',
      'castType':'f64',
      'result':'0.15625lf'
    },
    {
      'type':'u64',
      'value':'0x3fc4 0000 00000000xl',
      'castType':'f64',
      'result':'0.15625lf'
    },

    {
      'castType':'i32',
      'result':'0x3e200000x',
      'type':'f32',
      'value':'0.15625f'
    },
    {
      'castType':'u32',
      'result':'0x3e200000x',
      'type':'f32',
      'value':'0.15625f'
    },
    {
      'castType':'i64',
      'result':'0x3fc4 0000 00000000xl',
      'type':'f64',
      'value':'0.15625lf'
    },
    {
      'castType':'u64',
      'result':'0x3fc4 0000 00000000xl',
      'type':'f64',
      'value':'0.15625lf'
    }, 

  ];

  test('test-cast-reinterpret', async t => {
    for(const testParams of reinterpretCastTests){
      const testSrc = `
      export i32 main(){
        ${testParams.type} a = ${testParams.value};
        ${testParams.castType} b = (^${testParams.castType})a;
        if( b == ${testParams.result}){
          return 1;
        } else {
          return 0;
        }
      };
      `;
      const testName = `${t.name}-${testParams.type}-${testParams.castType}`;
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

  test('test-cast-pointer', async t => {
      const testSrc = `
      export i32 main(){
        i32 ptr = 0x800;
        *ptr = 0x3e200000x;
        i32 a = (i32)((f32)*ptr + 2.0f);
        if( a == 2){
          return 1;
        } else {
          return 0;
        }
      };
      `;
      const testName = `${t.name}`;
      let inst, result;
      try {
        inst = await compiler.compileAndInstanciate(testName, testSrc,`./tests/out/${t.name}`);
        result = inst.exports.main();
      } catch (e) {
        console.log(e, e.stack);
        t.fail(testName);
      }
      t.equal(result, 1, testName);
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


