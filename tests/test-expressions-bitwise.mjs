'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';

{
  const types = [
    { type: 'i32', literalPrefix: '', literalSuffix: '' },
    { type: 'u32', literalPrefix: '', literalSuffix: 'u' },
    { type: 'i64', literalPrefix: '', literalSuffix: 'l'},
    { type: 'u64', literalPrefix: '', literalSuffix: 'lu'},
  ];
  
    const ops = [
    { name: 'bit-and-1', 'a': '3', 'b': '2', op: '&', result: 2 },
    { name: 'bit-and-2', 'a': '0', 'b': '2', op: '&', result: 0 },
  
    { name: 'bit-or-1', 'a': '3', 'b': '2', op: '|', result: 3 },
    { name: 'bit-or-2', 'a': '0', 'b': '2', op: '|', result: 2 },
 
    { name: 'bit-xor-1', 'a': '3', 'b': '2', op: '^', result: 1 },
    { name: 'bit-xor-2', 'a': '0', 'b': '2', op: '^', result: 2 },
 
    
    { name: 'bit-shift-left', 'a': '1', 'b': '2', op: '<<', result: 4 },
    { name: 'bit-shift-right-signed', 'a': '-4', 'b': '2', op: '>>', result: -1 },
    { name: 'bit-shift-right', 'a': '4', 'b': '2', op: '>>>', result:1 },
    { name: 'bit-rotate-right', 'a': '4', 'b': '2', op: '>>&', result: 1 },
    { name: 'bit-rotate-left', 'a': '1', 'b': '2', op: '<<&', result: 4 },

    { name: 'bit-not-1', 'a': '1',  op: '~', result: -2 },
    { name: 'bit-not-2', 'a': '-1',  op: '~', result: 0 }

  ];
  
test('test-expression-bitwise', async t => {
  for (const tp of types) {
    if (tp.skip) {
      continue;
    }
    if (tp.type.charAt(0) == 'f' && tp.literalSuffix.substring(0,2) != '.0') {
      tp.literalSuffix = '.0' + tp.literalSuffix;
    }

    for(const op of ops){
      const testSrc = op.op != '~' ?
        `
          export i32 main(){
            ${tp.type} a = ${tp.literalPrefix}${op.a}${tp.literalSuffix},b=${tp.literalPrefix}${op.b}${tp.literalSuffix},ans;
            ans = a ${op.op} b;
            if(ans == ${tp.literalPrefix}${op.result}${tp.literalSuffix}){
              return 1;
            } else {
              return 0;
            }
          };
        ` : `
        // not
        export i32 main(){
          ${tp.type} a = ${tp.literalPrefix}${op.a}${tp.literalSuffix};
          a = ${op.op}a;
          if(a == ${tp.literalPrefix}${op.result}${tp.literalSuffix}){
            return 1;
          } else {
            return 0;
          }
        };

        `;
      const testName = `${t.name}_${tp.type}_${op.name}`;
      let inst,result;
      try {
        inst = await compiler.compileAndInstanciate(testName, testSrc,`./tests/out/${t.name}`);
        result = inst.exports.main();
      } catch (e) {
        console.log(e,e.stack);
        t.fail(testName);
      }
      t.equal(result, 1, testName);
    }
  }
});


}


