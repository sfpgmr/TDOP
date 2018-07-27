'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';
import types from './test-types.mjs';

{
test('test-expression-loop-for', async t => {
  for (const tp of types) {
    if (tp.skip) {
      continue;
    }
    if (tp.type.charAt(0) == 'f' && tp.literalSuffix.substring(0,2) != '.0') {
      tp.literalSuffix = '.0' + tp.literalSuffix;
    }

      const testSrc =
        `
          export i32 main(){
            ${tp.type} ans = ${tp.literalPrefix}0${tp.literalSuffix};
            for(${tp.type} a = ${tp.literalPrefix}0${tp.literalSuffix};a < ${tp.literalPrefix}10${tp.literalSuffix};++a){
              ans++;
            }
            if(ans == ${tp.literalPrefix}10${tp.literalSuffix}){
              return 1;
            } else {
              return 0;
            }
          };
        `;
      const testName = `${t.name}_${tp.type}`;
      let inst,result;
      try {
        inst = await compiler.compileAndInstanciate(testName, testSrc);
        result = inst.exports.main();
      } catch (e) {
        console.log(e,e.stack);
        t.fail(testName);
      }
      t.equal(result, 1, testName);
    }
});

test('test-expression-loop-while', async t => {
  for (const tp of types) {
    if (tp.skip) {
      continue;
    }
    if (tp.type.charAt(0) == 'f' && tp.literalSuffix.substring(0,2) != '.0') {
      tp.literalSuffix = '.0' + tp.literalSuffix;
    }

      const testSrc =
        `
          export i32 main(){
            ${tp.type} ans = ${tp.literalPrefix}0${tp.literalSuffix},a;
            while(a < ${tp.literalPrefix}10${tp.literalSuffix}){
              ++a;
              ans++;
            }
            if(ans == ${tp.literalPrefix}10${tp.literalSuffix}){
              return 1;
            } else {
              return 0;
            }
          };
        `;
      const testName = `${t.name}_${tp.type}`;
      let inst,result;
      try {
        inst = await compiler.compileAndInstanciate(testName, testSrc);
        result = inst.exports.main();
      } catch (e) {
        console.log(e,e.stack);
        t.fail(testName);
      }
      t.equal(result, 1, testName);
    }
});

test('test-expression-do-while', async t => {
  for (const tp of types) {
    if (tp.skip) {
      continue;
    }
    if (tp.type.charAt(0) == 'f' && tp.literalSuffix.substring(0,2) != '.0') {
      tp.literalSuffix = '.0' + tp.literalSuffix;
    }

      const testSrc =
        `
          export i32 main(){
            ${tp.type} ans = ${tp.literalPrefix}0${tp.literalSuffix},a;
            do {
              ++a;
              ans++;
            } while (a <  ${tp.literalPrefix}10${tp.literalSuffix});

            if(ans == ${tp.literalPrefix}10${tp.literalSuffix}){
              return 1;
            } else {
              return 0;
            }
          };
        `;
      const testName = `${t.name}_${tp.type}`;
      let inst,result;
      try {
        inst = await compiler.compileAndInstanciate(testName, testSrc);
        result = inst.exports.main();
      } catch (e) {
        console.log(e,e.stack);
        t.fail(testName);
      }
      t.equal(result, 1, testName);
    }
});
}


