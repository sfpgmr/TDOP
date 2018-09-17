import generateCode from '../generateCode.mjs';
import tokenize from '../tokens.mjs';
import make_parse from '../parse.mjs';
import fs from 'fs';
import binaryen from '../binaryen-wasm';
import path from 'path';

const parse = make_parse();

export function getInstance(obj){
  const bin = new WebAssembly.Module(obj);
  const inst = new WebAssembly.Instance(bin,{});
  return inst;
}

const exceptProperties = ['parent','typeRef','detail'];

export async function compile(name,src,basePath='./tests/out'){
  try {
    fs.statSync(basePath)
  } catch (e) {
    if(e.code == 'ENOENT'){
      basePath
      .split(path.sep)
      .reduce((acc,cv)=>{
        const cd = path.join(acc, cv);
        try {
          fs.mkdirSync(cd);
        } catch (err) {
          (err.code !== 'EEXIST' || !fs.statSync(cd).isDirectory())
            && console.log(err.toString());
        } finally {
          return cd;
        }
      });
    } else {
      throw e;
    }
  }

  const tokens = tokenize(src);
  //await fs.promises.writeFile(`${basePath}/${name}-token.json`, JSON.stringify(tokens,null,1), 'utf8');
  const ast = parse(tokens);
  const json = JSON.stringify(ast,
    (key,value)=>{
      return exceptProperties.includes(key) ? undefined : value; 
    } 
    , 2);


  await fs.promises.writeFile(`${basePath}/${name}.sgl2`, src, 'utf8');
  await fs.promises.writeFile(`${basePath}/${name}.json`, json, 'utf8');
  const module = await generateCode(ast,binaryen);
  const wat = module.emitText();
  await fs.promises.writeFile(`${basePath}/${name}.wat`,wat,'utf8');
  module.validate();
  const compiled = module.emitBinary();
  await fs.promises.writeFile(`${basePath}/${name}.wasm`,compiled);
  return compiled;    
}

export async function compileAndInstanciate(name,src,basePath='./tests/out'){
  const obj = await compile(name,src,basePath);
  return getInstance(obj);
}

