'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';

const types = [
  {type: 'i32',literalPrefix:'',literalSuffix: ''},
  {type: 'u32',literalPrefix:'',literalSuffix: 'u'},
  {type: 'f32',literalPrefix:'',literalSuffix: 'f'},
  {type: 'i64',literalPrefix:'',literalSuffix: ''},
  {type: 'u64',literalPrefix:'',literalSuffix: 'l'},
  {type: 'f64',literalPrefix:'',literalSuffix: 'd'},
  {type: 'string',literalPrefix: ['"',"'"],literalSuffix:['"',"'"]}
 ];

test('test-expression-add',async t=>{
  for(const tp of types){
    if(tp.type.charAt(0) == 'f') {
      tp.literalSuffix = '.0' +  tp.literalSuffix;
    }
    const testSrc = 
    `
      export ${tp.type} main(){
        ${tp.type} a = ${tp.literalPrefix}2${tp.literalSuffix},b = ${tp.literalPrefix}3${tp.literalSuffix};
        return a + b;
      };
    `;
    const testName = `${t.name}_${tp.type}`;
    const inst = await compiler.compileAndInstanciate(testName,testSrc);
    t.equal(inst.exports.main(),5,testName);
  }
}); 


