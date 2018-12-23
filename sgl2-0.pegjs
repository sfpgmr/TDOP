//
// Parsing Exprettion Grammar of SGL2
// ==================
//

{
  let lineNumber = 0;
  let tokens = [];
}



SOURCE_STRINGS = sourceStrings:(__ / TOKEN / SYMBOLS / LINE_TERMINATOR_SEQUENCE / CONCATENATE_CHAR )*  {
  return sourceStrings.filter(n=>n);
}

TOKEN = head:[0-9a-zA-Z_] tail:([0-9a-zA-Z_] / CONCATENATE_CHAR)* {return head + tail.filter(n=>n).join('');}

SOURCE_CHARACTER = .

/* The symbols period (.), plus (+), dash (-), slash (/), asterisk (*), percent (%), angled brackets (<
and >), square brackets ( [ and ] ), parentheses ( ( and ) ), braces ( { and } ), caret (^), vertical bar
( | ), ampersand (&), tilde (~), equals (eses ( ( and ) ), braces ( { and } ), caret (^), vertical bar
( | ), ampersand (&), tilde (~), equals (=), exclamation point (!), colon (:), semicolon (;), comma
(,), and question mark (?).*/

SYMBOLS = $('.' / '+' / '+' / '-' / '/' / '*' / '%' / '<' / '>' / '[' / ']' / '(' / ')' / '{' / '}' / '^' / '|' / '&' / '~' / '=' / '!' / ':' / ';' / ',' / '?')

PREPROCESSOR_DIRECTIVE = '#' __ 


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
    ++lineNumber; return null;
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
  / "\u2029") {return '\n'}
  
COMMENT "comment"
  = MULTILINE_COMMENT
  / SINGLE_LINE_COMMENT

MULTILINE_COMMENT
  = "/*" text:$(!"*/" SOURCE_CHARACTER)* "*/" {
    return ' ';
  }

MULTILINE_COMMENT_NO_LINE_TERMINATOR
  = "/*" text:$(!("*/" / LINE_TERMINATOR) SOURCE_CHARACTER)* "*/" {
    return ' ';
  }

SINGLE_LINE_COMMENT
  = "//" text:$(!LINE_TERMINATOR SOURCE_CHARACTER)* {
    return ' ';    
  }

// Skipped
__
  =  skipped:(WHITESPACE / LINE_TERMINATOR_SEQUENCE / COMMENT)+ {
    return skipped;
  }
_
  = skipped:(WHITESPACE / MULTILINE_COMMENT_NO_LINE_TERMINATOR)+ {
    return skipped;
  }

// End of Statement
EOS
  = $';'
   // _ SINGLE_LINE_COMMENT? LINE_TERMINATOR_SEQUENCE
 // _ &"}" 
 // __ EOF

EOF  = !.

