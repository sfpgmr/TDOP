import binaryen from 'binaryen';
import tokenize from './tokens.mjs';
import make_parse from './parse.mjs';
import fs from 'fs';

const testSrc = 
`
f64 func(f64 b) {
  return b;
}

f64 b = func(1.0);
`;

const tokens = tokenize(testSrc);
fs.writeFileSync('./tokens.json',JSON.stringify(tokens,null,4),'utf8');

const parse = make_parse();
const ast = parse(tokens);
const json = JSON.stringify(ast, ['key', 'name', 'message',
'value', 'arity', 'first', 'second', 'third', 'fourth','type','assignment'], 4);

fs.writeFileSync('./ast.json',json,'utf8');