import generateCode from './generateCode.mjs';
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
// const testSrc = 
// `
// i32 p = 1,j;
// i32 main(i32 a = 1,i32 b = 2,i32 e){
//   i32 d = 1;
//   i32 z = a * a;
  
//   if(z > 1){
//     return z;
//   } else {
//     return a;
//   }

//   {
//     i32 c = 1;
//     ++c;
//     c++;
//     z += c;
//   }
//   return -1;
// }
// `;
// const testSrc = 
// `
// i32 𩸽(i32 a,i32 b){
//   return a * b;
// }

// export i32 main(){
//   i32 c = 1,a = 1,b = 0;

//   if(c != 2){
//     c = 2;
//     a += c;
//   } else {
//     c = 3;
//     a += c;
//   }

//   while (b < 2){
//     ++b;
//     while (a > -3){
//       a -= 1;
//       if(a == -1) {
//         break;
//       }
//       ++c;
//     }  
//   }

//  c = 𩸽(a--,c);

//   c += a;
//   return c + b;// 9
// }
// `;
const testSrc = 
`export i32 main(){
  i32 a = 0;

  for(i32 c = 0;c < 4;++c) {
    ++a;
  }
  return a;// 4
}`;
const tokens = tokenize(testSrc);

fs.writeFileSync('./tokens.json', JSON.stringify(tokens, null, 4), 'utf8');


const parse = make_parse();
const ast = parse(tokens);
const json = JSON.stringify(ast,
  (key,value)=>{
    if(key == 'parent')  return undefined;
    return value;
  } 
  , 2);


fs.writeFileSync('./ast.json', json, 'utf8');
console.log('パース完了');

const module = generateCode(ast);
//module.optimize();


fs.writeFileSync('out.wat',module.emitText(),'utf8');
const compiled = module.emitBinary();
fs.writeFileSync('out.wasm',compiled);

console.log('コンパイル完了');

// 実行

//const bin = new WebAssembly.Module(fs.readFileSync('out.wasm'));
const bin = new WebAssembly.Module(compiled);
const inst = new WebAssembly.Instance(bin,{});
console.log(inst.exports.main());

