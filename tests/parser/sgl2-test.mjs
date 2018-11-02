import peg from 'pegjs';
import test from 'tape-async';
import fs from 'fs';
import {exec as exec_} from 'child_process';
import util from 'util';
import Binaryen from '../../binaryen-wasm.js';


//import sgl2 from './sgl2.js';

test('parse-test', async t => {
try {
    let binaryen;
    await new Promise((resolve, reject) => {
      binaryen = Binaryen({
        onRuntimeInitialized: m => {
          resolve();
        }
      });
    });
  const pegSrc = await fs.promises.readFile('./sgl2.pegjs', 'utf-8');
  const parser = peg.generate(pegSrc, {
    format: 'commonjs',
    output: 'source'
  });
  const testDir = './tests/parser/src/'; 
  await fs.promises.writeFile('./sgl2.js', parser, 'utf8');
  let sgl2 = (await import('../../sgl2.js')).default;
  const exec = util.promisify(exec_);
  let testFiles = await fs.promises.readdir(testDir);
  testFiles = testFiles.filter(file=>{
    return fs.statSync(testDir + file).isFile() && /.*\.sgl2$/.test(file); //絞り込み
  });
  console.log(testFiles);
  // wasm ライブラリの読み込み
  let bin = await fs.promises.readFile('./sgl2lib.wasm');
  bin = await WebAssembly.instantiate(bin, {});
  let lib = bin.instance.exports;
  for(const file of testFiles){
    const testSrc = await fs.promises.readFile(testDir + file,'utf8');
    const wasmModule = new binaryen.Module();
    wasmModule.setMemory(1, 1);
		console.log(`***** ${file}をパースします。*****`);
    console.log(JSON.stringify(sgl2.parse(testSrc,{ binaryen:binaryen,module: wasmModule,lib:lib }),null,2));
  }
} catch (e) {
    console.log(e,e.stack);
}
});


