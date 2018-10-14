import binaryen_ from '../binaryen-wasm';
import fs from 'fs';

export function getInstance(obj,imports = {}) {
  const bin = new WebAssembly.Module(obj);
  const inst = new WebAssembly.Instance(bin, imports);
  return inst;
}

(async ()=>{
  let binaryen;
  await new Promise((resolve, reject) => {
    binaryen = binaryen_({
      onRuntimeInitialized: m => {
        resolve();
      }
    });
  });
  try {
    const lib = getInstance(binaryen.parseText(await fs.promises.readFile('./tests/co-test.wat','utf8')).emitBinary()).exports;
 
    lib.initCo();
    let v;
    while(v = lib.doCo()){
      console.log(v);
    }
  } catch (e){
    console.log(e);
  }
})();

