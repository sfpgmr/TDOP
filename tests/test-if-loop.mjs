'use strict';
import test from 'tape-async';
import * as compiler from './compiler.mjs';

test('test-for',async t=>{
  const testSrc = 
  `
  export i32 main(){
    i32 b = 0;
    for(i32 c = 0;c < 4;c+=1) {
      b = b + 1;
    }
    return b;// 4
  };
      `;

      const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
      t.equal(inst.exports.main(),4);
    console.log(inst.exports.main());
});

test('test-if',async t=>{
  const testSrc = 
  `
  export i32 main(i32 a){
    if(a == 1){
      return 1;
    } else {
      return 0;
    }
  };
      `;

    const inst = await compiler.compileAndInstanciate(t.name,testSrc,`./tests/out/${t.name}`);
    t.equal(inst.exports.main(2),0);
    t.equal(inst.exports.main(1),1);
    console.log(inst.exports.main());
});

