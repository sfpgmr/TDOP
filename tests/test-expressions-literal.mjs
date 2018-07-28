'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{

  const ops = [
    { name: 'bit-and-hex', type: 'i32', 'a': '0xff', result: 255 },
    { name: 'bit-and-hex_2', type: 'i32', 'a': '0xff', result: 255 },
    { name: 'bit-and-hex_3', 'a': '', result: 0 },

    { name: 'bit-or-1', 'a': '3', 'b': '2', op: '|', result: 3 },
    { name: 'bit-or-2', 'a': '0', 'b': '2', op: '|', result: 2 },

    { name: 'bit-xor-1', 'a': '3', 'b': '2', op: '^', result: 1 },
    { name: 'bit-xor-2', 'a': '0', 'b': '2', op: '^', result: 2 },


    { name: 'bit-shift-left', 'a': '1', 'b': '2', op: '<<', result: 4 },
    { name: 'bit-shift-right-signed', 'a': '-4', 'b': '2', op: '>>', result: -1 },
    { name: 'bit-shift-right', 'a': '4', 'b': '2', op: '>>>', result: 1 },
    { name: 'bit-rotate-right', 'a': '4', 'b': '2', op: '>>&', result: 1 },
    { name: 'bit-rotate-left', 'a': '1', 'b': '2', op: '<<&', result: 4 },

    { name: 'bit-not-1', 'a': '1', op: '~', result: -2 },
    { name: 'bit-not-2', 'a': '-1', op: '~', result: 0 }

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
    const testSrc = `
        export i32 main(){
          i32 a = 0xffff;
          if( a == 65536 ){
            return 1;
          } else {
            return 0;
          }
        };
        `;
    const testName = `${t.name}_${tp.type}_${op.name}`;
    let inst, result;
    try {
      inst = await compiler.compileAndInstanciate(testName, testSrc);
      result = inst.exports.main();
    } catch (e) {
      console.log(e, e.stack);
      t.fail(testName);
    }
    t.equal(result, 1, testName);
  });
}


