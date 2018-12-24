//
// Parsing Exprettion Grammar of SGL2
// ==================
//

{
  let lineNumber = 0;
  let tokens = [];
  class Token {
    constructor(tokenType,string){
      this.tokenType = tokenType;
      this.string = string;
      this.location = location();
    }
  }
}



SOURCE_STRINGS = sourceStrings:(__ / TOKEN / SYMBOLS / PREPROCESSOR_DIRECTIVE / EOS / LINE_TERMINATOR_SEQUENCE / CONCATENATE_CHAR )*  {
  return sourceStrings.filter(n=>n);
}

TOKEN = head:[0-9a-zA-Z_] tail:([0-9a-zA-Z_] / CONCATENATE_CHAR)* {return new Token('Token',head + tail.filter(n=>n).join(''));}

SOURCE_CHARACTER = .

/* The symbols period (.), plus (+), dash (-), slash (/), asterisk (*), percent (%), angled brackets (<
and >), square brackets ( [ and ] ), parentheses ( ( and ) ), braces ( { and } ), caret (^), vertical bar
( | ), ampersand (&), tilde (~), equals (eses ( ( and ) ), braces ( { and } ), caret (^), vertical bar
( | ), ampersand (&), tilde (~), equals (=), exclamation point (!), colon (:), semicolon (;), comma
(,), and question mark (?).*/

SYMBOLS = symbol:('.' / '+' / '+' / '-' / '/' / '*' / '%' / '<' / '>' / '[' / ']' / '(' / ')' / '{' / '}' / '^' / '|' / '&' / '~' / '=' / '!' / ':' / ',' / '?') {return new Token('Symbol',text()); }

PREPROCESSOR_DIRECTIVE = '#' {return new Token('PreprocessorDirective',text());}


CONCATENATE_CHAR = [\\] LINE_TERMINATOR_SEQUENCE {  return null;}

WHITESPACE "whitespace"
  = ("\t"
  / "\v"
  / "\f"
  / " "
  / "\u00A0"
  / "\uFEFF"
  / ZS)
  {
    return new Token('WhiteSpace',' ');
  }

// Separator, Space
ZS = [\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]

LINE_TERMINATOR
  = [\n\r\u2028\u2029] {return '\n';}

LINE_TERMINATOR_SEQUENCE "end of line"
  = $("\n"
  / "\r\n"
  / "\r"
  / "\u2028"
  / "\u2029") {return null;}
  
COMMENT "comment"
  = MULTILINE_COMMENT
  / SINGLE_LINE_COMMENT

MULTILINE_COMMENT
  = "/*" text:$(!"*/" SOURCE_CHARACTER)* "*/" {
    return null;
  }

MULTILINE_COMMENT_NO_LINE_TERMINATOR
  = "/*" text:(!("*/" / LINE_TERMINATOR) SOURCE_CHARACTER)* "*/" {
    return null;
  }

SINGLE_LINE_COMMENT
  = "//" text:(!LINE_TERMINATOR SOURCE_CHARACTER)* {
    return null;    
  }

// Skipped
__
  =  skipped:(WHITESPACE / LINE_TERMINATOR_SEQUENCE / COMMENT)+ {
    return null;
  }
_
  = skipped:(WHITESPACE / MULTILINE_COMMENT_NO_LINE_TERMINATOR)+ {
    return null;
  }

// End of Statement
EOS
  = ';' {return new Token('EOS',text());}
   // _ SINGLE_LINE_COMMENT? LINE_TERMINATOR_SEQUENCE
 // _ &"}" 
 // __ EOF

EOF  = !.

