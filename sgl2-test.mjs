import peg from 'pegjs';
import fs from 'fs';
import {exec as exec_} from 'child_process';
import util from 'util';
const exec = util.promisify(exec_);


(async (pegSrcPath = './sgl2.pegjs') => {

  const pegSrc = await fs.promises.readFile(pegSrcPath, 'utf-8');
  //const pegSrc = "start = ('a' / 'b')+";
  const parserSrc = peg.generate(pegSrc, {
    format: 'commonjs',
    output: 'source'
  });

  await fs.promises.writeFile('./sgl2-compiler.js', parserSrc, 'utf8');
//  await exec('node --experimentall')

})(process.argv[2]);



