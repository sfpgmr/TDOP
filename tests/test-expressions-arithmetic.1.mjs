'use strict';

import test from 'tape-async';
import * as compiler from './compiler.mjs';

const types = [
  {type: 'i32',literalPrefix:'',literalSuffix: ''},
  {type: 'u32',literalPrefix:'',literalSuffix: 'u'},
  {type: 'f32',literalPrefix:'',literalSuffix: 'f'},
  {type: 'f64',literalPrefix:'',literalSuffix: 'lf'},
  {type: 'i64',literalPrefix:'',literalSuffix: 'l'},
  {type: 'u64',literalPrefix:'',literalSuffix: 'lu'},
 // {type: 'string',literalPrefix: ['"',"'"],literalSuffix:['"',"'"]}
 ];

 const ops = [
   { name : 'add','a':'3','b':'2',op: '+',result:5 },
   { name : 'sub','a':'3','b':'2',op: '-',result:1 },
   { name : 'mul','a':'3','b':'2',op: '*',result:6 },
   { name : 'div','a':'4','b':'2',op: '/',result:2 },
 ];


test('test-expression-arithmetic',async t=>{
  for(const tp of types){
    if(tp.type.charAt(0) == 'f') {
      tp.literalSuffix = '.0' +  tp.literalSuffix;
    }
    for(const op of ops){
      const testSrc = 
      `
        export ${tp.type} main(){
          ${tp.type} a = ${tp.literalPrefix}${op.a}${tp.literalSuffix},b = ${tp.literalPrefix}${op.b}${tp.literalSuffix};
          return a ${op.op} b;
        };
      `;
      const testName = `${t.name}_${tp.type}_${op.name}`;
      try  {
        const inst = await compiler.compileAndInstanciate(testName,testSrc);
        const result = inst.exports.main();
        t.equal(result,op.result,testName);
      } catch (e){
        t.fail(e + ' : ' + e.stack);
      }
    }
  }
}); 


