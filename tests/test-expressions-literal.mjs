'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{

  const ops = [
    { name: 'bit-and-hex-1', type: 'i32', 'a': '0xff', result: '255' },
    { name: 'bit-and-hex-2', type: 'u32', 'a': '0xffu', result: '255u' },
    { name: 'bit-and-hex-1', type: 'i64', 'a': '0xffl', result: '255l' },
    { name: 'bit-and-hex-2', type: 'u64', 'a': '0xfflu', result: '255lu' },

    { name: 'bit-and-hex-1', type: 'i32', 'a': '0b1111 1111 1111 1111b', result: '65535' },
    { name: 'bit-and-hex-2', type: 'u32', 'a': '0b1111 1111bu', result: '255u' },
    { name: 'bit-and-hex-1', type: 'i64', 'a': '0b1111 1111bl', result: '255l' },
    { name: 'bit-and-hex-2', type: 'u64', 'a': '0b1111 1111blu', result: '255lu' },

    { name: 'bit-and-hex-f32', type: 'f32', 'a': '0b 0 01111100 0100000 00000000 00000000 bf', result: '0.15625f' },
    { name: 'bit-and-hex-f64', type: 'f64', 'a': '0b 0 00001111100 0000010000000000000000000000000000000000000000000000 blf', result: '0.15625lf' },

    { name: 'numeric-i32', type: 'i32', 'a': '65536', result: '65536' },
    { name: 'numeric-u32', type: 'u32', 'a': '65536u', result: '65536u' },
    { name: 'numericbit-and-hex-1', type: 'i64', 'a': '9223372036854775808l', result: '255l' },
    { name: 'bit-and-hex-2', type: 'u64', 'a': '17293822569102704640lu', result: '255lu' },

    { name: 'bit-and-hex-f32', type: 'f32', 'a': '0.15625f', result: '0.15625f' },
    { name: 'bit-and-hex-f64', type: 'f64', 'a': '0.15625lf', result: '0.15625lf' }
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


