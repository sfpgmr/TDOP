'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{

  const ops = [
    { name: 'literal-hex-i32', type: 'i32', 'a': '0xffx', result: '255' },
    { name: 'literal-hex-u32', type: 'u32', 'a': '0xffxu', result: '255u' },
    { name: 'literal-hex-i64', type: 'i64', 'a': '0xffxl', result: '255l' },
    { name: 'literal-hex-u64', type: 'u64', 'a': '0xffxlu', result: '255lu' },

    { name: 'literal-bin-i32', type: 'i32', 'a': '0b1111 1111 1111 1111b', result: '65535' },
    { name: 'literal-bin-u32', type: 'u32', 'a': '0b1111 1111bu', result: '255u' },
    { name: 'literal-bin-i64', type: 'i64', 'a': '0b1111 1111bl', result: '255l' },
    { name: 'literal-bin-u64', type: 'u64', 'a': '0b1111 1111blu', result: '255lu' },

    { name: 'literal-bin-f32', type: 'f32', 'a': '0b 0 01111100 0100000 00000000 00000000 bf', result: '0.15625f' },
    { name: 'literal-bin-f64', type: 'f64', 'a': '0b 0 01111111100 0100000000000000000000000000000000000000000000000000 blf', result: '0.15625lf' },
    { name: 'literal-hex-f32-1', type: 'f32', 'a': '0x3e200000xf', result: '0.15625f' },
    { name: 'literal-hex-f32-2', type: 'f32', 'a': '0xbe200000xf', result: '-0.15625f' },
    { name: 'literal-hex-f32-3', type: 'f32', 'a': '-0x3e200000xf', result: '-0.15625f' },
    { name: 'literal-hex-f32-3', type: 'f32', 'a': '-0xbe200000xf', result: '0.15625f' },
    { name: 'literal-hex-f64', type: 'f64', 'a': '0x3fc4 0000 0000 0000xlf', result: '0.15625lf' },

    { name: 'literal-numeric-i32', type: 'i32', 'a': '65536', result: '65536' },
    { name: 'literal-numeric-i32', type: 'i32', 'a': '-65536', result: '-65536' },
    { name: 'literal-numeric-u32', type: 'u32', 'a': '65536u', result: '65536u' },
    { name: 'literal-numeric-i64', type: 'i64', 'a': '9223372036854775808l', result: '9223372036854775808l' },
    { name: 'literal-numeric-u64', type: 'u64', 'a': '17293822569102704640lu', result: '17293822569102704640lu' },
    { name: 'literal-numeric-f32-1', type: 'f32', 'a': '0.15625f', result: '0.15625f' },
    { name: 'literal-numeric-f32-2', type: 'f32', 'a': '-0.15625f', result: '-0.15625f' },
    { name: 'literal-numeric-f64-3', type: 'f64', 'a': '0.15625lf', result: '0.15625lf' },
    { name: 'literal-numeric-f64-4', type: 'f64', 'a': '-0.15625lf', result: '-0.15625lf' },

  ];

  test('test-expression-literal', async t => {
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
    for (const op of ops) {
      const testSrc = `
      export i32 main(){
        ${op.type} a = ${op.a};
        if( a == ${op.result}){
          return 1;
        } else {
          return 0;
        }
      };
      `;
      const testName = `${op.name}`;
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


