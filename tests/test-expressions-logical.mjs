'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{
const ops = [
  { name: 'and', a: 3, b: 3, c: 3, op: '&&', result: 1 },
  { name: 'and', a: 3, b: 3, c: 2, op: '&&', result: 0 },
  { name: 'or', a: 3, b: 3, c: 3, op: '||', result: 1 },
  { name: 'or', a: 3, b: 3, c: 2, op: '||', result: 1 },
  { name: 'or', a: 3, b: 1, c: 2, op: '||', result: 0 },
];


test('test-expression-logical', async t => {
  for (const tp of types) {
    if (tp.skip) {
      continue;
    }
    if (tp.type.charAt(0) == 'f' && tp.literalSuffix.substring(0,2) != '.0') {
      tp.literalSuffix = '.0' + tp.literalSuffix;
    }
    for (const op of ops) {
      if (op.skip) continue;
      const testSrc =
        `
          export i32 main(){
            ${tp.type} a = ${tp.literalPrefix}${op.a}${tp.literalSuffix},b = ${tp.literalPrefix}${op.b}${tp.literalSuffix},c = ${tp.literalPrefix}${op.c}${tp.literalSuffix};
            if(a == b ${op.op} b == c){
              return 1;
            } else {
              return 0;
            }
          };
        `;
      const testName = `${t.name}_${tp.type}_${op.name}`;
      try {
        const inst = await compiler.compileAndInstanciate(testName, testSrc,`./tests/out/${t.name}`);
        const result = inst.exports.main();
        t.equal(result, op.result, testName);
      } catch (e) {
        console.log(e,e.stack);
        t.fail(testName);
      }
    }
    // Not Test
    const testSrc = `
   export i32 main(){
     ${tp.type} a = ${tp.literalPrefix}1${tp.literalSuffix},b = ${tp.literalPrefix}2${tp.literalSuffix};
     if(!(a == b)){
       return 1;
     } else {
       return 0;
     }
   };
   `;
   let testName = `${t.name}_${tp.type}_not`;
   let inst,result1,result2;
   try {
      inst = await compiler.compileAndInstanciate(testName, testSrc,`./tests/out/${t.name}`);
      result1 = inst.exports.main(1);
    } catch (e) {
      console.log(e,e.stack);
      t.fail(testName);
    }
    t.equal(result1, 1, testName + '_1');
  }
});

}


