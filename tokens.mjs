// tokens.mjs
// 2016-01-13

// (c) 2006 Douglas Crockford

// Produce an array of simple token objects from a string.
// A simple token object contains these members:
//      type: 'name', 'string', 'number', 'operator'
//      value: string or number value of the token
//      from: index of first character of the token
//      to: index of the last character + 1

// Comments of the // type are ignored.

// Operators are by default single characters. Multicharacter
// operators can be made by supplying a string of prefix and
// suffix characters.
// characters. For example,
//      '<>+-&', '=>&:'
// will match any of these:
//      <=  >>  >>>  <>  >=  +: -: &: &&: &&

/*jslint this */
"use strict";


// サロゲートペアを考慮した文字列配列化
function stringToArray (str) {
  return str.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\uD800-\uDFFF]/g) || [];
}

function error(message, t = this) {
  t.name = 'Tokenizer : Error';
  t.message = message;
  throw t;
}

export default function tokenize(src, prefix_ = "=<>!+-*&|/%^", suffix_ = "=<>+-&|") {
  let c;                      // The current character.
  //let from;                   // The index of the start of the token.
  let i = 0;                  // The index of the current character.
  let lineNo = 1;
  let posx = 1;
  const source = stringToArray(src);
  
  const prefix = stringToArray(prefix_);
  const suffix = stringToArray(suffix_);

  let length = source.length;
  let q;                      // The quote character.
  let str;                    // The string value.

  let result = [];            // An array to hold the results.


  function make(type, value,opt = {}) {

    // Make a token object.
    const o = Object.assign({
      type: type,
      value: value,
      line: lineNo,
      pos:posx
    },opt);
    return o;
  }



  // Begin tokenization. If the source string is empty, return nothing.

  if (!source) {
    return;
  }

  // If prefix and suffix strings are not provided, supply defaults.

  // Loop through this text, one character at a time.

  c = source[i];
  while (c) {
    //from = i;

    if (c === '\n') {
      ++lineNo;
      posx = 1;
      //from = i = 0;
    }
    // Ignore whitespace.

    if (c <= ' ') {
      ++i;
      ++posx;
      c = source[i];

      // name.

    } else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z' || c > '\u00ff')) {
      str = c;
      ++i;
      ++posx;
      while (true) {
        c = source[i];
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                    (c >= '0' && c <= '9') || c === '_' || c > '\u00ff') {
          str += c;
          ++i;
          ++posx;
        } else {
          break;
        }
      }
      result.push(make('name', str));

      // number.

      // A number cannot start with a decimal point. It must start with a digit,
      // possibly '0'.

    } else if (c >= '0' && c <= '9') {

      str = c;
      ++i;
      ++posx;

      let nc = source[i];

      if(c == '0' && (nc == 'x' || nc == 'X')){
        //debugger;
        let type = 'i32';
        let kind = 'hex';
        let unsigend = false;
        let b64 = false;
        let hexCount = 0;
        let float = false;
        // 16進数
        c = nc;
        //let hexfp = false;
        do {
          if(c != ' ' && c != ''){
            str += c;
            ++hexCount;
          }
          ++i;
          ++posx;
          c = source[i];
        } while((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') || c == ' ' || c == '');

        if(c == 'x' || c == 'X'){
          ++i;
          ++posx;
          c = source[i];
        }
        //  error('Invalid hex literal format.',make('hex',str));
        //}

        // if(c == '.'){
        //   // 16進浮動小数 少数部
        //   do {
        //     str += c;
        //     ++i;
        //     ++posx;
        //     c = source[i];
        //     hexfp = true;
        //   } while((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'));
        // }

        if(c == 'l'){
          b64 = true;
          //str += c;
          ++i;
          ++posx;
          c = source[i];
        }

        if(c == 'u'){
          unsigend = true;
          //str += c;
          ++i;
          ++posx;
          c = source[i];
        }

        if(c == 'f'){
          float = true;
          //str += c;
          ++i;
          ++posx;
          c = source[i];
        }


        // if(c == 'p' || c == 'P'){
        //   // 16進浮動小数 指数部
        //   let first = true;

        //   do {
        //     str += c;
        //     ++i;
        //     ++posx;gitchekou
        //     c = source[i];
        //     if(first && (c == '+' || c == '-')){
        //       first = false;
        //       str += c;
        //       ++i;
        //       ++posx;
        //       c = source[i];
        //       continue;
        //     } 
        //     first = false;
        //   } while((c >= '0' && c <= '9'));
        //   hexfp = true;
        // } else if(hexfp) {
        //   error('Bad hexdecimal floating point number.',make('hexfp',str + c));
        // }

        // if(hexfp){
        //   type = b64 ? 'f64' : 'f32';
        //   kind = 'hex';
        // } else {
        //   type = (unsigend ? 'u' : 'i') + (b64 ? '64':'32');
        //   error('Bad hexdecimal or hexdecimal floating point number.',make('f32',str + c ));
        // }

        // c = source[i];
        
        // フォーマットが正しいか確認する
        if(hexCount > (b64?18:10)){
          error(`hexが${b64?'64':'32'}の範囲を越えてます。。長すぎです。。`,make(type,str,{kind:'hex'}));
        }        
        type = (float ? 'f' : (unsigend ? 'u' : 'i')) + (b64 ? '64':'32');
        result.push(make(type,str,{kind:kind}));

      } else if(c == '0' && (nc == 'b' || nc == 'B')) {
        let type = 'i32';
        let unsigend = false;
        let float = false;
        let b64 = false;
        let bitCount = 0;
        // 2進数リテラル
        
        str = c + nc;

        ++i;
        ++posx;
        c = source[i];
        // 2進数
        do {
          if(c != ' '){
            str += c;
            ++bitCount;
          };
          ++i;
          ++posx;
          c = source[i];
        } while (c == ' ' || c == '0' || c =='1' );

        if(c == 'b' || c == 'B'){
          ++i;
          ++posx;
          c = source[i];
        }

        //   error('Invalid binary literal format.',make('binary',str+c));



        if(c == 'l'){
          b64 = true;
          //str += c;
          ++i;
          ++posx;
          c = source[i];
        }

        if(c == 'u'){
          unsigend = true;
          //str += c;
          ++i;
          ++posx;
          c = source[i];
        }

        if(c == 'f'){
          float = true;
          //str += c;
          ++i;
          ++posx;
          c = source[i];
        }
        // フォーマットが正しいか確認する
        if(bitCount > (b64?66:34)){
          error(`bitパターンが${b64?'64':'32'}の範囲を越えてます。。長すぎです。。`,make(type,str,{kind:'binary'}));
        }

        type = (float ? 'f' : (unsigend ? 'u' : 'i')) + (b64 ? '64':'32');

        result.push(make(type,str,{kind:'binary'}));
      }  else {
        // 数リテラル
        let type = 'i32';
        // Look for more digits.
        
        let int = true;

        while (true) {
          c = source[i];
          if (c < '0' || c > '9') {
            break;
          }
          ++i;
          ++posx;
          str += c;
        }

        // Look for a decimal fraction part.

        if (c === '.') {
          int = false;
          type ='f32';
          ++i;
          ++posx;
          str += c;
          while (true) {
            c = source[i];
            if (c < '0' || c > '9') {
              break;
            }
            ++i;
            ++posx;
            str += c;
          }
        }

        // Look for an exponent part.

        if (c === 'e' || c === 'E') {
          int = false;
          type = 'f32';
          ++i;
          ++posx;
          str += c;
          c = source[i];
          if (c === '-' || c === '+') {
            ++i;
            ++posx;
            str += c;
            c = source[i];
          }
          if (c < '0' || c > '9') {
            error("Bad exponent",make(type, str));
          }
          do {
            ++i;
            ++posx;
            str += c;
            c = source[i];
          } while (c >= '0' && c <= '9');
        }
        let _64 = false;

        if(c == 'l' || c == 'L'){
          // 64bit Type
          _64 = true;
          if(type == 'i32'){
            type = 'i64';
          }
          //str += c;
          ++i;
          ++posx;
          c = source[i];
        }

        if(c == 'f' || c == 'F'){
          type = _64 ? 'f64' : 'f32';
          int = false;
          str += c;
          ++i;
          ++posx;
          c = source[i];
        } else if(c == 'u' || c == 'U'){
          type = _64 ? 'u64' : 'u32';
          int = true;
          //str += c;
          ++i;
          ++posx;
          c = source[i];
        } else if (c >= 'a' && c <= 'z') {
          str += c;
          ++i;
          ++posx;
          error("Bad number",make('number', str));
        } 

        // Convert the string value to a number. If it is finite, then it is a good
        // token.

        // n = +str;
        // if (isFinite(n)) {
        result.push(make(type, str));
        // } else {
        //   make('number', str).error("Bad number");
        // }        

      }



      // string

    } else if (c === '\'' || c === '"') {
      str = '';
      q = c;
      ++i;
      ++posx;
      while (true) {
        c = source[i];
        if (c < ' ') {
          error(
            (c === '\n' || c === '\r' || c === '')
              ? "Unterminated string."
              : "Control character in string.",
            make('', str)
            ,make('string', str));
        }

        // Look for the closing quote.

        if (c === q) {
          break;
        }

        // Look for escapement.

        if (c === '\\') {
          ++i;
          ++posx;
          if (i >= length) {
            error("Unterminated string",make('string', str));
          }
          c = source[i];
          switch (c) {
          case 'b':
            c = '\b';
            break;
          case 'f':
            c = '\f';
            break;
          case 'n':
            c = '\n';
            //++lineNo;
            break;
          case 'r':
            c = '\r';
            break;
          case 't':
            c = '\t';
            break;
          case 'u':
            if (i >= length) {
              error("Unterminated string",make('string', str));
            }
            c = parseInt(source.substr(i + 1, 4), 16);
            if (!isFinite(c) || c < 0) {
              error("Unterminated string",make('string', str));
            }
            c = String.fromCharCode(c);
            i += 4;
            posx += 4;
            break;
          }
        }
        str += c;
        ++i;
        ++posx;
      }
      ++i;
      ++posx;
      result.push(make('string', str));
      c = source[i];

      // comment.

    } else if (c === '/' && source[i + 1] === '/') {
      ++i;
      ++posx;
      while (true) {
        c = source[i];
        if (c === '\n' || c === '\r' || c === '') {
          break;
        }

        ++i;
        ++posx;
      }

      // combining

    } else if (prefix.findIndex(p=>c == p) >= 0) {
      str = c;
      ++i;
      ++posx;
      while (true) {
        c = source[i];
        if (i >= length || suffix.findIndex(p=>c == p) < 0) {
          break;
        }
        str += c;
        ++i;
        ++posx;
      }
      result.push(make('operator', str));

      // single-character operator

    } else {
      ++i;
      ++posx;
      result.push(make('operator', c));
      c = source[i];
    }
  }
  return result;
}

