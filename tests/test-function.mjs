'use strict';
import test from 'tape-async';
import * as compiler from './compiler.mjs';

test('test-fucntion-call',async t=>{
  const testSrc = 
  `
  i32 𩸽(i32 a,i32 b){
    return a * b;
  };
  
  export i32 main(){
  i32 b = 2;
 
  return 𩸽(b,b);// 4
  };
    `;

    const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
    t.equal(inst.exports.main(),4);
    console.log(inst.exports.main());
});



