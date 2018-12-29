import peg from 'pegjs';
import test from 'tape-async';
import fs from 'fs';
import {exec as exec_} from 'child_process';
import util from 'util';
import Binaryen from '../../binaryen-wasm.js';

test('parse-test', async t => {
try {
  const pegSrc = await fs.promises.readFile('./tokenizer.pegjs', 'utf-8');
  const parser = peg.generate(pegSrc, {
    format: 'commonjs',
    output: 'source',
    trace:false
  });
  const testDir = './tests/parser/src/'; 
  await fs.promises.writeFile('./tokenizer.js', parser, 'utf8');
  let sgl2 = (await import('../../tokenizer.js')).default;
  const exec = util.promisify(exec_);
  let testFiles = await fs.promises.readdir(testDir);
  testFiles = testFiles.filter(file=>{
    return fs.statSync(testDir + file).isFile() && /.*\.sgl2$/.test(file); //絞り込み
  });
  console.log(testFiles);
  for(const file of testFiles){
    const testSrc = (await fs.promises.readFile(testDir + file,'utf8'));
    console.log(`***** ${file}をパースします。*****`);
    const ast =  JSON.stringify(sgl2.parse(testSrc,{ }),null,2);
    await fs.promises.writeFile('./tests/parser/result/' + file + '.token.json',ast,'utf8');
  }
} catch (e) {
    console.log(e,e.stack);
}
});


