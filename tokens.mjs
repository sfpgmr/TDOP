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

export default function tokenize(src, prefix_ = "=<>!+-*&|/%^", suffix_ = "=<>&|") {
  let c;                      // The current character.
  let from;                   // The index of the start of the token.
  let i = 0;                  // The index of the current character.
  let lineNo = 1;
  const source = stringToArray(src);
  
  const prefix = stringToArray(prefix_);
  const suffix = stringToArray(suffix_);

  let length = source.length;
  let n;                      // The number value.
  let q;                      // The quote character.
  let str;                    // The string value.

  var result = [];            // An array to hold the results.


  var make = function (type, value) {

    // Make a token object.

    return {
      type: type,
      value: value,
      line: lineNo,
      from: from,
      to: i
    };
  };



    // Begin tokenization. If the source string is empty, return nothing.

  if (!source) {
    return;
  }

  // If prefix and suffix strings are not provided, supply defaults.

  // Loop through this text, one character at a time.

  c = source[i];
  while (c) {
    from = i;

    if (c === '\n') {
      ++lineNo;
      //from = i = 0;
    }
    // Ignore whitespace.

    if (c <= ' ') {
      i += 1;
      c = source[i];

      // name.

    } else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z' || c > '\u00ff')) {
      str = c;
      i += 1;
      while (true) {
        c = source[i];
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                    (c >= '0' && c <= '9') || c === '_' || c > '\u00ff') {
          str += c;
          i += 1;
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

      let nc = source[i];

      if(c == '0' && (nc == 'x' || nc == 'X')){
        //debugger;
        let type = 'hex';
        // 16進数
        c = nc;
        let hexfp = false;
        do {
          str += c;
          ++i;
          c = source[i];
        } while((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'));

        if(c == '.'){
          // 16進浮動小数 少数部
          do {
            str += c;
            ++i;
            c = source[i];
            hexfp = true;
          } while((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'));
        }

        if(c == 'p' || c == 'P'){
          // 16進浮動小数 指数部
          let first = true;

          do {
            str += c;
            ++i;
            c = source[i];
            if(first && (c == '+' || c == '-')){
              first = false;
              str += c;
              ++i;
              c = source[i];
              continue;
            } 
            first = false;
          } while((c >= '0' && c <= '9'));
          hexfp = true;
        } else if(hexfp) {
          make('hexfp',str + c).error('Bad hexdecimal floating point number.');
        }

        if(c == 'f' || c == 'F'){
          if(hexfp){
            str += c;
            ++i;
            type = 'hexfp32';
          } else {
            make('hex',str + c ).error('Bad hexdecimal or hexdecimal floating point number.');
          }
        } else if(c == 'l' || c == 'L') {
          if(hexfp){
            str += c;
            ++i;
            type = 'hexfp64';
          } else {
            make('hex',str + c ).error('Bad hexdecimal or hexdecimal floating point number.');
          }
        } else if(hexfp) {
          make('hex',str + c ).error('Bad hexdecimal or hexdecimal floating point number.');
        }

        c = source[i];
        result.push(make(type,str));

      } else if(c == '0' && (nc == 'b' || nc == 'B')) {
        debugger;
        str = c + nc;
        ++i;
        c = source[i];
        // 2進数
        do {
          c != ' ' && (str += c);
          ++i;
          c = source[i];
        } while (c == ' ' || c == '0' || c =='1' || c == 'b' || c == 'B');
        
        (str.charAt(str.length - 1) != 'b') && make('binary',str+c).error('Invalid binary literal format.');
        make('binary',str);
      }  else {

        let type = 'integer';
        // Look for more digits.
        
        let integer = true;

        while (true) {
          c = source[i];
          if (c < '0' || c > '9') {
            break;
          }
          i += 1;
          str += c;
        }

        // Look for a decimal fraction part.

        if (c === '.') {
          integer = false;
          type ='fp32';
          i += 1;
          str += c;
          while (true) {
            c = source[i];
            if (c < '0' || c > '9') {
              break;
            }
            i += 1;
            str += c;
          }
        }

        // Look for an exponent part.

        if (c === 'e' || c === 'E') {
          integer = false;
          type = 'fp32';
          i += 1;
          str += c;
          c = source[i];
          if (c === '-' || c === '+') {
            i += 1;
            str += c;
            c = source[i];
          }
          if (c < '0' || c > '9') {
            make(type, str).error("Bad exponent");
          }
          do {
            i += 1;
            str += c;
            c = source[i];
          } while (c >= '0' && c <= '9');
        }

        if(c == 'f'){
          if(!integer){
            str += c;
          } else {
            make()
          }
        }

        // Make sure the next character is not a letter.

        if (c >= 'a' && c <= 'z') {
          str += c;
          i += 1;
          make('number', str).error("Bad number");
        }

        // Convert the string value to a number. If it is finite, then it is a good
        // token.

        n = +str;
        if (isFinite(n)) {
          result.push(make('number', n));
        } else {
          make('number', str).error("Bad number");
        }        

      }



      // string

    } else if (c === '\'' || c === '"') {
      str = '';
      q = c;
      i += 1;
      while (true) {
        c = source[i];
        if (c < ' ') {
          make('string', str).error(
            (c === '\n' || c === '\r' || c === '')
              ? "Unterminated string."
              : "Control character in string.",
            make('', str)
          );
        }

        // Look for the closing quote.

        if (c === q) {
          break;
        }

        // Look for escapement.

        if (c === '\\') {
          i += 1;
          if (i >= length) {
            make('string', str).error("Unterminated string");
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
              make('string', str).error("Unterminated string");
            }
            c = parseInt(source.substr(i + 1, 4), 16);
            if (!isFinite(c) || c < 0) {
              make('string', str).error("Unterminated string");
            }
            c = String.fromCharCode(c);
            i += 4;
            break;
          }
        }
        str += c;
        i += 1;
      }
      i += 1;
      result.push(make('string', str));
      c = source[i];

      // comment.

    } else if (c === '/' && source[i + 1] === '/') {
      i += 1;
      while (true) {
        c = source[i];
        if (c === '\n' || c === '\r' || c === '') {
          break;
        }

        i += 1;
      }

      // combining

    } else if (prefix.findIndex(p=>c == p) >= 0) {
      str = c;
      i += 1;
      while (true) {
        c = source[i];
        if (i >= length || suffix.findIndex(p=>c == p) < 0) {
          break;
        }
        str += c;
        i += 1;
      }
      result.push(make('operator', str));

      // single-character operator

    } else {
      i += 1;
      result.push(make('operator', c));
      c = source[i];
    }
  }
  return result;
}

