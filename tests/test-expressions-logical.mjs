'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';

const types = [
  { type: 'i32', literalPrefix: '', literalSuffix: '' },
  { type: 'u32', literalPrefix: '', literalSuffix: 'u' },
  { type: 'f32', literalPrefix: '', literalSuffix: 'f' },
  { type: 'f64', literalPrefix: '', literalSuffix: 'lf' },
  { type: 'i64', literalPrefix: '', literalSuffix: 'l', skip: true },
  { type: 'u64', literalPrefix: '', literalSuffix: 'lu', skip: true },
  // {type: 'string',literalPrefix: ['"',"'"],literalSuffix:['"',"'"]}
];

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
    if (tp.type.charAt(0) == 'f') {
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
        const inst = await compiler.compileAndInstanciate(testName, testSrc);
        const result = inst.exports.main();
        t.equal(result, op.result, testName);
      } catch (e) {
        t.fail(e + ' : ' + e.stack);
      }
    }
    // Not Test
    const testSrc = `
   export i32 main(${tp.type} b){
     ${tp.type} a = ${tp.literalPrefix}1${tp.literalSuffix};
     if(!(a == b)){
       return 1;
     } else {
       return 0;
     }
   }
   `;
    try {
      let testName = `${t.name}_${tp.type}_not`;
      const inst = await compiler.compileAndInstanciate(testName, testSrc);
      let result = inst.exports.main(1);
      t.equal(result, 0, testName + '_1');
      result = inst.exports.main(2);
      t.equal(result, 1, testName + '_2');
    } catch (e) {
      t.fail(e + ' : ' + e.stack);
    }
  }
});


