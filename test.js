
/**
 * 整数値をを64ビットの16進数文字列に変換するコード
 */

 // 整数は文字列の形で指定
let numString = '-123';
let numArray = [];
let minus = false;
{
  let i = 0;
  for(const c of numString){
    if(c == '-'){
      if(i == 0){
        minus = true;
      } else {
        throw new Error(`不正な文字:${c}`);
      }
    } else {
      if(isNaN(c)){
        throw new Error(`不正な文字:${c}`);
      }
      numArray.push(parseInt(c,10));
    }
    ++i;
  }
}

// 変換結果を収める
let hex = [];
let b = 0;
let ans = [];
let remind = 0;

while(numArray.length > 0 || b > 15){
  b = 0;
  ans = [];
  remind = 0;
  numArray.forEach(num=>{
    b = b * 10 + num;
    if(b > 15){
      remind = b & 0b1111;
      ans.push(b >> 4);
      b = remind;
    } else {
      ans.push(0);
      remind = b;
    }
  })

  // 頭の0をとる

  let i = 0;
  while(ans[i] == 0){
    ++i;
  }
  numArray = ans.slice(i);
  // 16進文字列に変換する
  hex.unshift(remind);  
}

console.log(b,remind,hex,numArray);

if(minus){
  if(hex.length < 16){
    let l = 16 - hex.length;
    while(l > 0){
      hex.unshift(0);
      --l;
    }
  }
  hex = hex.map(d=>d ^ 0xf);
  hex[15] += 1;
}
//hex.push(b);

console.log(hex.map(d=>d.toString(16)).join(''));
// 58936e53d139afefabb2683f150b684045f15

