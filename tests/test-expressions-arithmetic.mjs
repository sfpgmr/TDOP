'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';

import types from './test-types.mjs';

{

const ops = [
  { name: 'add', 'a': '3', 'b': '2', op: '+', result: 5 },
  { name: 'sub', 'a': '3', 'b': '2', op: '-', result: 1 },
  { name: 'mul', 'a': '3', 'b': '2', op: '*', result: 6 },
  { name: 'div', 'a': '4', 'b': '2', op: '/', result: 2 },
];

test('test-expression-arithmetic', async t => {
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
            ${tp.type} a = ${tp.literalPrefix}${op.a}${tp.literalSuffix},b = ${tp.literalPrefix}${op.b}${tp.literalSuffix};
            ${tp.type} ans =  a ${op.op} b; 
            if(ans == ${tp.literalPrefix}${op.result}${tp.literalSuffix}){
              return 1;
            } else {
              return 0;
            }
          };
        `;
      const testName = `${t.name}_${tp.type}_${op.name}`;
      let inst,result;
      try {
        inst = await compiler.compileAndInstanciate(testName, testSrc);
        result = inst.exports.main();
      } catch (e) {
        t.fail(testName);
      }
      t.equal(result, 1, testName);
    }
    // inc/dec
    const incDecOps = [
      { name: 'inc', op: '++', result: 1 },
      { name: 'dec', op: '--', result: 1 }
    ];
    for (const op of incDecOps) {
      const testSrc =
        `
      export i32 main(){
        ${tp.type} a,b;
        ${op.op}a;
        if(a != b${op.op}){
          if(a == b){
            return 1;
          } else {
            return 2;
          }
        }
        return 3;
      };
    `;
      let testName = `${t.name}_${tp.type}_${op.name}_1`;
      let inst,result;
      try {
        inst = await compiler.compileAndInstanciate(testName, testSrc);
        result = inst.exports.main();
      } catch (e) {
        console.log(e, e.stack);
        t.fail(testName);
      }
      t.equal(result, op.result, testName);
      const testSrc2 =
        `
      export i32 main(){
        ${tp.type} a,b;
        ${op.op}a;
        b${op.op};
        return a == b;
      };
    `;
      testName = `${t.name}_${tp.type}_${op.name}_2`;
      try {
        inst = await compiler.compileAndInstanciate(testName, testSrc2);
        result = inst.exports.main();
      } catch (e) {
        console.log(e, e.stack);
        t.fail(testName);
      }
      t.equal(result, op.result, testName);

    }
  }
});

}

