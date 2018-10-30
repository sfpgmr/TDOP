import peg from 'pegjs';
import fs from 'fs';
import {exec as exec_} from 'child_process';
import util from 'util';
import Binaryen from './binaryen-wasm.js';


import sgl2 from './sgl2.js';

const exec = util.promisify(exec_);

(async ()=>{
try {
    let binaryen;
    await new Promise((resolve, reject) => {
      binaryen = Binaryen({
        onRuntimeInitialized: m => {
          resolve();
        }
      });
    });

    const testSrc = `0x 100a x`;
  const wasmModule = new binaryen.Module();
  wasmModule.setMemory(1, 1);
  // wasm ライブラリの読み込み
  let bin = await fs.promises.readFile('./sgl2lib.wasm');
  bin = await WebAssembly.instantiate(bin, {});
  let lib = bin.instance.exports;
  console.log(JSON.stringify(sgl2.parse(testSrc,{ binaryen:binaryen,module: wasmModule,lib:lib }),null,2));
} catch (e) {
    console.log(e,e.stack);
}
})();

// (async (pegSrcPath = './sgl2.pegjs') => {

//   const pegSrc = await fs.promises.readFile(pegSrcPath, 'utf-8');
//   //const pegSrc = "start = ('a' / 'b')+";
//   const parser = peg.generate(pegSrc, {
//     format: 'commonjs',
//     output: 'source'
//   });

//   await fs.promises.writeFile('./sgl2-compiler.js', parserSrc, 'utf8');
// //  await exec('node --experimentall')

// })(process.argv[2]);





