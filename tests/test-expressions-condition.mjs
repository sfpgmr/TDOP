'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{
const ops = [
  { name: 'eq-1', 'a': '3', 'b': '3', op: '==', result: 1 },
  { name: 'eq-2', 'a': '3', 'b': '2', op: '==', result: 0 },

  { name: 'ne-1', 'a': '3', 'b': '3', op: '!=', result: 0 },
  { name: 'ne-2', 'a': '3', 'b': '2', op: '!=', result: 1 },

  { name: 'ge-1', 'a': '3', 'b': '3', op: '>=', result: 1 },
  { name: 'ge-2', 'a': '2', 'b': '3', op: '>=', result: 0 },
  { name: 'ge-3', 'a': '3', 'b': '2', op: '>=', result: 1 },

  { name: 'gt-1', 'a': '3', 'b': '3', op: '>', result: 0 },
  { name: 'gt-2', 'a': '3', 'b': '2', op: '>', result: 1 },
  { name: 'gt-3', 'a': '2', 'b': '3', op: '>', result: 0 },

  { name: 'le-1', 'a': '3', 'b': '3', op: '<=', result: 1 },
  { name: 'le-2', 'a': '2', 'b': '3', op: '<=', result: 1 },
  { name: 'le-2', 'a': '3', 'b': '2', op: '<=', result: 0 },

  { name: 'lt-1', 'a': '3', 'b': '3', op: '<', result: 0 },
  { name: 'lt-2', 'a': '2', 'b': '3', op: '<', result: 1 },
  { name: 'lt-2', 'a': '3', 'b': '2', op: '<', result: 0 }

];

test('test-expression-condition', async t => {
  for (const tp of types) {
    if (tp.skip) {
      continue;
    }
    if(tp.type.charAt(0) == 'f' && tp.literalSuffix.substring(0,2) != '.0') {
      tp.literalSuffix = '.0' + tp.literalSuffix;
    }
    for (const op of ops) {
      if (op.skip) continue;
      const testSrc =
        `
          export i32 main(){
            ${tp.type} a = ${tp.literalPrefix}${op.a}${tp.literalSuffix},b = ${tp.literalPrefix}${op.b}${tp.literalSuffix};
            if(a ${op.op} b){
              return 1;
            }
            return 0;
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
      t.equal(result, op.result, testName);
    }
  }
});
}


