import binaryen from 'binaryen';
import tokenize from './tokens.mjs';
import make_parse from './parse.mjs';
import fs from 'fs';

// const testSrc =
//  `
//f64 h,i,j;
//f64 mul(f64 a,f64 b) {
//  h = 2;
//  return a;
//}
//
// void main(){
//   f64 d = 2;
//   f32 b = mul(d,3);
//   return d + b;
// }

// `;
// const testSrc = 
// `
// f64 h = 1.0l,i,𩸽軍団 = 2.0l;
// f64 j = 3.0l;

// i = h + 0x222.222p+5l + j;
// string s = "函館𩸽軍団";

// i32 k = 0x222;
// i32 bit = 0b0001 0001 0001 0000 0000 0000 0000 0100b;

// f64 mul(f64 a,f64 b) {
//   return a * b;
// }


// f64 main(){
//   f64 z = mul(h,i);
//   if(z > 1){
//     return 3.0l;
//   }
//   return 1.0l;
// }
// `;
const testSrc = 
`
f64 main(){
  f64 z = 1.0l;
  if(z > 1.0l){
    return z;
  }
  return -1.0l;
}
`;
const tokens = tokenize(testSrc);
fs.writeFileSync('./tokens.json', JSON.stringify(tokens, null, 4), 'utf8');

const parse = make_parse();
const ast = parse(tokens);
//console.log(ast.find("main"));
const json = JSON.stringify(ast, ['id','token','kind','key', 'name', 'message',
  'value', 'nodeType', 'first', 'second', 'third', 'fourth', 'type', 'assignment'], 4);

fs.writeFileSync('./ast.json', json, 'utf8');