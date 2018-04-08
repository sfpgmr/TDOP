import binaryen from 'binaryen';
import tokenize from './tokens.mjs';
import make_parse from './parse.mjs';
import fs from 'fs';

// const testSrc =
//  `
// f64 h,i,j;
// f64 mul(f64 a,f64 b) {
//   h = 2;
//   return a;
// }

// void main(){
//   f64 d = 2;
//   f32 b = mul(d,3);
//   return d + b;
// }

// `;
const testSrc = 
`
f64 a = 3 * 2;
`;

const tokens = tokenize(testSrc);
fs.writeFileSync('./tokens.json', JSON.stringify(tokens, null, 4), 'utf8');

const parse = make_parse();
debugger;
const ast = parse(tokens);
//console.log(ast.find("main"));
const json = JSON.stringify(ast, ['id', 'key', 'name', 'message',
  'value', 'arity', 'first', 'second', 'third', 'fourth', 'type', 'assignment'], 4);

fs.writeFileSync('./ast.json', json, 'utf8');