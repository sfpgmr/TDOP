import generateCode from '../generateCode.mjs';
import tokenize from '../tokens.mjs';
import make_parse from '../parse.mjs';
import fs from 'fs';
import binaryen from '../binaryen-wasm';

const parse = make_parse();

export function getInstance(obj){
  const bin = new WebAssembly.Module(obj);
  const inst = new WebAssembly.Instance(bin,{});
  return inst;
}

const exceptProperties = ['parent','typeRef','detail'];

export async function compile(name,src){
    const tokens = tokenize(src);
    const ast = parse(tokens);
    const json = JSON.stringify(ast,
      (key,value)=>{
        return exceptProperties.includes(key) ? undefined : value; 
      } 
      , 2);
    
    fs.writeFileSync(`./tests/out/${name}.json`, json, 'utf8');
    const module = await generateCode(ast,binaryen);
    module.validate();
    fs.writeFileSync(`./tests/out/${name}.wat`,module.emitText(),'utf8');
    const compiled = module.emitBinary();
    fs.writeFileSync(`./tests/out/${name}.wasm`,compiled);
    return compiled;    
}

export async function compileAndInstanciate(name,src){
  const obj = await compile(name,src);
  return getInstance(obj);
}

