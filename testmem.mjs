
import binaryen from './binaryen-wasm.js';

export function getInstance(obj,imports = {}){
  const bin = new WebAssembly.Module(obj);
  const inst = new WebAssembly.Instance(bin,imports);
  return inst;
}
const compilerWasmSrc = `
(module
  (export "test" (func $test))
  (memory $memory 1)
  (export "memory" (memory $memory))
  (func $test
    (drop(grow_memory (i32.const 3)));;3ページ分確保
    (i32.store
     (i32.const 0)
     (i32.mul (current_memory) (i32.const 65536));;現在のページ数にサイズ（65536bytes）をかけた数をオフセット0に格納
    )
  )
)
`;

(async ()=>{
  try {
  let binaryen_;
  await new Promise((resolve, reject) => {
    binaryen_ = binaryen({
      onRuntimeInitialized: m => {
        resolve();
      }
    });
  });
  const lib = getInstance(binaryen_.parseText(compilerWasmSrc).emitBinary());
  lib.exports.test();
  const memory = new Int32Array(lib.exports.memory.buffer);
  console.log(memory[0]);
} catch(e) {
  console.log(e,e.stack);
}
 
})();
