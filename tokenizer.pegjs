//
// Parsing Exprettion Grammar of SGL2
// ==================
//

{
  let lineNumber = 0;
  let tokens = [];
  class Token {
    constructor(tokenType,value){
      this.tokenType = tokenType;
      this.value = value;
      this.location = location();
    }
  }
}



SOURCE_STRINGS = sourceStrings:(PREPROCESSOR_DIRECTIVE / FLOATING_CONSTANT / INTEGER_CONSTANT / OPERATOR / NAME / SYMBOLS / EOS / CONCATENATE_CHAR / __ )*  {
  sourceStrings.filter(n=>n).forEach(t=>{
    (t instanceof Array) ? tokens.push(...(t.filter(n=>n))) : tokens.push(t);
  });
  return tokens;
}

NAME = head:[0-9a-zA-Z_] tail:([0-9a-zA-Z_] / CONCATENATE_CHAR)* {return new Token('Name',head + (tail ? tail.filter(n=>n).join(''):''));}

//////////////////////////////////////
// 数値定数
//////////////////////////////////////

// Float Constant
FLOATING_CONSTANT = 
	f:FRACTIONAL_CONSTANT e:EXPONENT_PART? FLOATING_SUFFIX? {return new Token('FloatConstant',parseFloat(f + (e || '')));} /
  f:DIGIT_SEQUENCE e:EXPONENT_PART? FLOATING_SUFFIX? {return new Token('FloatConstant',parseFloat(f + (e||'')));}

FRACTIONAL_CONSTANT =
	$(DIGIT_SEQUENCE '.' DIGIT_SEQUENCE /
	'.' DIGIT_SEQUENCE /
	DIGIT_SEQUENCE '.')

FLOATING_SUFFIX = [fF]

SIGN = '+' / '-'

DIGIT_SEQUENCE = 
	$DIGIT+ 

EXPONENT_PART = $([eE] SIGN? DIGIT_SEQUENCE)

INTEGER_CONSTANT = 
	value:(DECIMAL_CONSTANT /
	OCTAL_CONSTANT  /
	HEXADECIMAL_CONSTANT) uint:INTEGER_SUFFIX? {
    return new Token(uint?'Uint':'Int',value);
  }

INTEGER_SUFFIX = [uU]

DECIMAL_CONSTANT = 
	$(NONZERO_DIGIT DIGIT+) {
    return parseInt(text(),10);
  }

OCTAL_CONSTANT = "0" value:OCTAL_DIGIT+ {
  return parseInt(value,8);
}

HEXADECIMAL_CONSTANT = "0" [xX] value:HEXADECIMAL_DIGIT+ {
  return parseInt(value,16);
}

OCTAL_DIGIT = [0-7]
HEXADECIMAL_DIGIT = $(DIGIT / [a-fA-F])
DIGIT = $('0' / NONZERO_DIGIT)
NONZERO_DIGIT = [1-9]

//////////////////////////////////////
// 演算子 operators
//////////////////////////////////////

OPERATOR = head:[=<>\!\+\-\*\&|/%\^] tail:([=<>\+\-\&|] / CONCATENATE_CHAR)* {return new Token('Operator',head + (tail ? tail.filter(n=>n).join(''):''));}
SOURCE_CHARACTER = .

/* The symbols period (.), plus (+), dash (-), slash (/), asterisk (*), percent (%), angled brackets (<
and >), square brackets ( [ and ] ), parentheses ( ( and ) ), braces ( { and } ), caret (^), vertical bar
( | ), ampersand (&), tilde (~), equals (=), exclamation point (!), colon (:), semicolon (;), comma
(,), and question mark (?).*/

SYMBOLS = symbol:('.' / '+' / '+' / '-' / '/' / '*' / '%' / '<' / '>' / '[' / ']' / '(' / ')' / '{' / '}' / '^' / '|' / '&' / '~' / '=' / '!' / ':' / ',' / '?') {return new Token('Symbol',text()); }

//////////////////////////////////////
// プリプロセツサ Preprocessor Directive
//////////////////////////////////////

PREPROCESSOR_DIRECTIVE = '#' ___? head:NAME tail:( ___ / OPERATOR / NAME / SYMBOLS / CONCATENATE_CHAR / EOS )* LINE_TERMINATOR_SEQUENCE {
  const tokens = [head];
  tail && tail.length && tokens.push(...tail.filter(n=>n)); 
  return new Token('PreprocessorDirective',tokens);
}

// 行連結シーケンス
CONCATENATE_CHAR = [\\] LINE_TERMINATOR_SEQUENCE { return null;}

WHITESPACE "whitespace"
  = ("\t"
  / "\v"
  / "\f"
  / " "
  / "\u00A0"
  / "\uFEFF"
  / ZS)
  {
    return null; //new Token('WhiteSpace',' ');
  }

// Separator, Space
ZS = [\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]

LINE_TERMINATOR
  = [\n\r\u2028\u2029] {return new Token('NewLine','\n');}

LINE_TERMINATOR_SEQUENCE "end of line"
  = $("\n"
  / "\r\n"
  / "\r"
  / "\u2028"
  / "\u2029") {return new Token('NewLine','\n');}
  
COMMENT "comment"
  = MULTILINE_COMMENT
  / SINGLE_LINE_COMMENT

MULTILINE_COMMENT
  = "/*" text:$(!"*/" SOURCE_CHARACTER)* "*/" {
    return null;//new Token('WhiteSpace',' ');
  }

MULTILINE_COMMENT_NO_LINE_TERMINATOR
  = "/*" text:(!("*/" / LINE_TERMINATOR) SOURCE_CHARACTER)* "*/" {
    return null;//new Token('WhiteSpace',' ');
  }

SINGLE_LINE_COMMENT
  = "//" text:(!LINE_TERMINATOR SOURCE_CHARACTER)* {
    return null;//new Token('WhiteSpace',' ');    
  }

// Skipped
___
  =  skipped:(CONCATENATE_CHAR / WHITESPACE / COMMENT)+ {
    skipped = skipped.filter(n=>n);
    
    if(skipped.length == 1){
      skipped = skipped[0];
    } else if (!skipped.length){
      skipped = null;
    }

    return skipped;
  }
__
  =  skipped:(CONCATENATE_CHAR / WHITESPACE / LINE_TERMINATOR_SEQUENCE / COMMENT)+ {
    return skipped;
  }
_
  = skipped:(CONCATENATE_CHAR / WHITESPACE / MULTILINE_COMMENT_NO_LINE_TERMINATOR)+ {
    return skipped;
  }

// End of Statement
EOS
  = ';' {return new Token('EOS',text());}
   // _ SINGLE_LINE_COMMENT? LINE_TERMINATOR_SEQUENCE
 // _ &"}" 
 // __ EOF

EOF  = !.

