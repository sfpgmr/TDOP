//
// Parsing Exprettion Grammar of SGL2
// ==================
//

{

}



SOURCE_STRINGS = sourceStrings:( __ / EOS / TOKEN )* {
  return sourceStrings.filter(n=>n);
}

TOKEN = token:(TOKEN_CHARACTER)* { return token.join(); } 
SOURCE_CHARACTER = .;
TOKEN_CHARACTER = (. !WHITESPACE) / CONCATENATE_CHAR

CONCATENATE_CHAR = [\\] LINE_TERMINATOR_SEQUENCE {return '';}

WHITESPACE "whitespace"
  = ("\t"
  / "\v"
  / "\f"
  / " "
  / "\u00A0"
  / "\uFEFF"
  / ZS)
  {
    return null;
  }

// Separator, Space
ZS = [\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]

LINE_TERMINATOR
  = [\n\r\u2028\u2029] {return '\n';}

LINE_TERMINATOR_SEQUENCE "end of line"
  = ("\n"
  / "\r\n"
  / "\r"
  / "\u2028"
  / "\u2029") {
    return '\n';
  }
  
COMMENT "comment"
  = MULTILINE_COMMENT
  / SINGLE_LINE_COMMENT

MULTILINE_COMMENT
  = "/*" text:$(!"*/" SOURCE_CHARACTER)* "*/" {
    return null;
  }

MULTILINE_COMMENT_NO_LINE_TERMINATOR
  = "/*" text:$(!("*/" / LINE_TERMINATOR) SOURCE_CHARACTER)* "*/" {
    return null;
  }

SINGLE_LINE_COMMENT
  = "//" text:$(!LINE_TERMINATOR SOURCE_CHARACTER)* {
    return null;    
  }

// Skipped
__
  =  skipped:(WHITESPACE / LINE_TERMINATOR_SEQUENCE / COMMENT)* {
    return null;
  }
_
  = skipped:(WHITESPACE / MULTILINE_COMMENT_NO_LINE_TERMINATOR)* {
    return null;
  }

// End of Statement
EOS
  = $';'
   // _ SINGLE_LINE_COMMENT? LINE_TERMINATOR_SEQUENCE
 // _ &"}" 
 // __ EOF

EOF  = !.

