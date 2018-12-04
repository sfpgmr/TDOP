//
// Parsing Exprettion Grammar of SGL2
// ==================
//

{
   var TYPES_TO_PROPERTY_NAMES = {
    CallExpression:   "callee",
    MemberExpression: "object",
  };

  function filledArray(count, value) {
    return Array.apply(null, new Array(count))
      .map(function() { return value; });
  }

  function extractOptional(optional, index) {
    return optional ? optional[index] : null;
  }

  function extractList(list, index) {
    return list.map(function(element) { return element[index]; });
  }

  function buildList(head, tail, index) {
    return [head].concat(extractList(tail, index));
  }

  function buildBinaryExpression(head, tail) {
    return tail.reduce(function(result, element) {
      return {
        nodeType: "BinaryExpression",
        operator: element[1],
        left: result,
        right: element[3]
      };
    }, head);
  }

  function buildLogicalExpression(head, tail) {
    return tail.reduce(function(result, element) {
      return {
        nodeType: "LogicalExpression",
        operator: element[1],
        left: result,
        right: element[3]
      };
    }, head);
  }

  function optionalList(value) {
    return value !== null ? value : [];
  }

  // ノードクラス定義
  class CommentNode {
    constructor(text){
      this.nodeType = 'Commnet';
      this.text = text;
      this.location = location();
    }
  }
  class NumericConstantNode {
    constructor(type,value){
      this.nodeType = 'NumericConstant';
      this.type = type;
      this.value = value;
    }
  }
  class PrecisionDeclNode {
    constructor(precisionQualifier,typeSpecifier){
      this.nodeType = 'PrecisioniDeclaration';
      this.precisionQualifier = precisionQualifier;
      this.typeSpecifier = typeSpecifier;
    }
  }
  class AssignmentExpressionNode {
    constructor(left,right){
      this.nodeType = 'AssignmentExpression';
      this.left = left;
      this.right = right;
    }
  }
  class PostfixExpressionNode {
    constructor(head,tail){
      this.nodeType = 'PostfixExpression';
      this.head = head;
      this.tail = tail;
    }
  }
  class ArrayPointerNode {
    constructor(index){
      this.nodeType = 'ArrayPointer';
      this.index = index;
    }
  }

  class FieldSelectorNode {
    constructor(selector){
      this.nodeType = 'FieldSelector';
      this.selector = selector;
    }
  }
}

TRANSLATION_UNIT = EXTERNAL_DECLARATION* 

SOURCECHARACTER = .

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

LINETERMINATOR
  = [\n\r\u2028\u2029] {return null;}

LINETERMINATORSEQUENCE "end of line"
  = ("\n"
  / "\r\n"
  / "\r"
  / "\u2028"
  / "\u2029") {
    return null;
  }
  
COMMENT "comment"
  = MULTILINECOMMENT
  / SINGLELINECOMMENT

MULTILINECOMMENT
  = "/*" text:$(!"*/" SOURCECHARACTER)* "*/" {
    return new CommentNode(text);
  }

MULTILINECOMMENTNOLINETERMINATOR
  = "/*" text:$(!("*/" / LINETERMINATOR) SOURCECHARACTER)* "*/" {
    return new CommentNode(text);
  }

SINGLELINECOMMENT
  = "//" text:$(!LINETERMINATOR SOURCECHARACTER)* {
    return new CommentNode(text);    
  }

// Skipped
__
  =  skipped:(WHITESPACE / LINETERMINATORSEQUENCE / COMMENT)* {
    return skipped.filter(n=>n);
  }
_
  = skipped:(WHITESPACE / MULTILINECOMMENTNOLINETERMINATOR)* {
    return skipped.filter(n=>n);
  }

// End of Statement
EOS
  = __ ";" 
 // _ SINGLELINECOMMENT? LINETERMINATORSEQUENCE
 // _ &"}" 
 // __ EOF

EOF  = !.


CONST = "const" 
BOOL = "bool"
FLOAT = "float"
INT = "int"
UINT = "uint"
BREAK = "break"
CONTINUE = "continue"
DO = "do"
ELSE = "else"
FOR = "for"
IF = "if"
DISCARD = "discard"
RETURN = "return"
SWITCH = "switch"
CASE = "case"
DEFAULT = "default"
BVEC2 = "bvec2"
BVEC3 = "bvec3"
BVEC4 = "bvec4"
IVEC2 = "ivec2"
IVEC3 = "ivec3"
IVEC4 = "ivec4"
UVEC2 = "uvec2"
UVEC3 = "uvec3"
UVEC4 = "uvec4"
VEC2 = "vec2"
VEC3 = "vec3"
VEC4 = "vec4"
MAT2 = "mat2"
MAT3 = "mat3"
MAT4 = "mat4"
CENTROID = "centroid"
IN = "in"
OUT = "out"
INOUT = "inout"
UNIFORM = "uniform"
FLAT = "flat"
SMOOTH = "smooth"
LAYOUT = "layout"
MAT2X2 = "mat2x2"
MAT2X3 = "mat2x3"
MAT2X4 = "mat2x4"
MAT3X2 = "mat3x2"
MAT3X3 = "mat3x3"
MAT3X4 = "mat3x4"
MAT4X2 = "mat4x2"
MAT4X3 = "mat4x3"
MAT4X4 = "mat4x4"
SAMPLER2D = "sampler2d"
SAMPLER3D = "sampler3d"
SAMPLERCUBE = "samplercube"
SAMPLER2DSHADOW = "sampler2dshadow"
SAMPLERCUBESHADOW = "samplercubeshadow"
SAMPLER2DARRAY = "sampler2darray"
SAMPLER2DARRAYSHADOW = "sampler2darrayshadow"
ISAMPLER2D = "isampler2d"
ISAMPLER3D = "isampler3d"
ISAMPLERCUBE = "isamplercube"
ISAMPLER2DARRAY = "isampler2darray"
USAMPLER2D = "usampler2d"
USAMPLER3D = "usampler3d"
USAMPLERCUBE = "usamplercube"
USAMPLER2DARRAY = "usampler2darray"

STRUCT = "struct"
VOID = "void"
WHILE = "while"

RESERVED_KEYWORDS = 
CONST / 
BOOL /
FLOAT /
INT /
UINT /
BREAK /
CONTINUE /
DO /
ELSE /
FOR /
IF /
DISCARD /
RETURN /
SWITCH /
CASE /
DEFAULT /
BVEC2 /
BVEC3 /
BVEC4 /
IVEC2 /
IVEC3 /
IVEC4 /
UVEC2 /
UVEC3 /
UVEC4 /
VEC2 /
VEC3 /
VEC4 /
MAT2 /
MAT3 /
MAT4 /
CENTROID /
IN /
OUT /
INOUT /
UNIFORM /
FLAT /
SMOOTH /
LAYOUT /
MAT2X2 /
MAT2X3 /
MAT2X4 /
MAT3X2 /
MAT3X3 /
MAT3X4 /
MAT4X2 /
MAT4X3 /
MAT4X4 /
SAMPLER2D /
SAMPLER3D /
SAMPLERCUBE /
SAMPLER2DSHADOW /
SAMPLERCUBESHADOW /
SAMPLER2DARRAY /
SAMPLER2DARRAYSHADOW /
ISAMPLER2D /
ISAMPLER3D /
ISAMPLERCUBE /
ISAMPLER2DARRAY /
USAMPLER2D /
USAMPLER3D /
USAMPLERCUBE /
USAMPLER2DARRAY /
STRUCT /
VOID /
WHILE 
// 3.9 Identifiers
/*
識別子は、変数名、関数名、構造体名、およびフィールドセレクタに使用されます（フィールドセレクタは、5.5節「ベクトルコンポーネント」および5.6「マトリックスコンポーネント」で説明されているように、構造フィールドに似たベクトルと行列の要素を選択します）。
*/
IDENTIFIER = $(NONDIGIT (DIGIT / NONDIGIT)*) {
  return {
    nodeType:'identifier',
    name:text()
  }
}

NONDIGIT = [_a-zA-Z]

TYPE_NAME = "type_name"

FLOATING_CONSTANT = 
	f:FRACTIONAL_CONSTANT e:EXPONENT_PART? FLOATING_SUFFIX? {return new NumericConstantNode('float',parseFloat(f + (e || '')));} /
  f:DIGIT_SEQUENCE e:EXPONENT_PART? FLOATING_SUFFIX? {return new NumericConstantNode('float',parseFloat(f + (e||'')));}

FRACTIONAL_CONSTANT =
	$(DIGIT_SEQUENCE DOT DIGIT_SEQUENCE /
	DOT DIGIT_SEQUENCE /
	DIGIT_SEQUENCE DOT)

FLOATING_SUFFIX = [fF]

SIGN = PLUS / MINUS

DIGIT_SEQUENCE = 
	$DIGIT+ 

EXPONENT_PART = $([eE] SIGN? DIGIT_SEQUENCE)

INTEGER_CONSTANT = 
	value:(DECIMAL_CONSTANT /
	OCTAL_CONSTANT  /
	HEXADECIMAL_CONSTANT) uint:INTEGER_SUFFIX? {
    return new NumericConstantNode(uint?'uint':'int',value);
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

BOOLCONSTANT = TRUE / FALSE

TRUE = "true"
FALSE = "false"

//フィールドセレクタは、5.5節「ベクトルコンポーネント」および5.6「マトリックスコンポーネント」で説明されているように、構造フィールドに似たベクトルと行列の要素を選択します
FIELD_SELECTION = "field_selection"

LEFT_OP = "<<"
RIGHT_OP = ">>"
INC_OP = "++"
DEC_OP = "--"
LE_OP = "<="
GE_OP = ">="
EQ_OP = "=="
NE_OP = "!="
AND_OP = "&&"
OR_OP = "||"
XOR_OP = "^^"
MUL_ASSIGN = "*="
DIV_ASSIGN = "/="
ADD_ASSIGN = "+="
MOD_ASSIGN = "%="
LEFT_ASSIGN = "<<="
RIGHT_ASSIGN = ">>="
AND_ASSIGN = "&="
XOR_ASSIGN = "^="
OR_ASSIGN = "|="
SUB_ASSIGN = "-="
LEFT_PAREN = "("
RIGHT_PAREN = ")"
LEFT_BRACKET = "["
RIGHT_BRACKET = "]"
LEFT_BRACE = "{"
RIGHT_BRACE = "}"
DOT = "."
COMMA = ","
COLON = ":"
EQUAL = "="
SEMICOLON = ";"
BANG = "!"
DASH = "'"
TILDE = "~"
PLUS = "+"
MINUS = "-"
STAR = "*"
SLASH = "/"
PERCENT = "%"
LEFT_ANGLE = "<"
RIGHT_ANGLE = ">"
VERTICAL_BAR = "_"
CARET = "^"
AMPERSAND = "&"
QUESTION = "?"
INVARIANT = "invariant"
HIGH_PRECISION = "highp"
MEDIUM_PRECISION = "mediump"
LOW_PRECISION = "lowp"
PRECISION = "precision"

VARIABLE_IDENTIFIER = IDENTIFIER

PRIMARY_EXPRESSION =
 VARIABLE_IDENTIFIER /
 INTEGER_CONSTANT / 
 FLOATING_CONSTANT / 
 BOOLCONSTANT / 
 LEFT_PAREN __ exp:EXPRESSION __ RIGHT_PAREN {  return exp; }

POSTFIX_EXPRESSION =
 head:(PRIMARY_EXPRESSION / 
 (FUNCTION_CALL_GENERIC (__ DOT __ FUNCTION_CALL_GENERIC)?))  
  tail:((LEFT_BRACKET __ index:INTEGER_EXPRESSION __ RIGHT_BRACKET { new ArrayPointerNode(index);}) / 
  (__ DOT __ selector:FIELD_SELECTION { return new FieldSelectorNode(selector);}) / 
  (__ INC_OP }) / 
  (__ DEC_OP))* {
	
		return !tail.length ? head : new PostfixExpressionNode(head,tail); 

	}

INTEGER_EXPRESSION = 
 EXPRESSION

FUNCTION_CALL = 
 FUNCTION_CALL_OR_METHOD

FUNCTION_CALL_OR_METHOD = 
 FUNCTION_CALL_GENERIC / 
 POSTFIX_EXPRESSION __ DOT __ FUNCTION_CALL_GENERIC

FUNCTION_CALL_GENERIC = 
 FUNCTION_CALL_HEADER __ RIGHT_PAREN  

FUNCTION_CALL_HEADER = 
 FUNCTION_IDENTIFIER __ LEFT_PAREN (( __ VOID ) / ( __ ASSIGNMENT_EXPRESSION ( __ COMMA __ ASSIGNMENT_EXPRESSION )*))? 

// Grammar Note =  Constructors look like functions, but lexical analysis recognized most of them as
// keywords. They are now recognized through “type_specifier”.
// Methods (.length) and identifiers are recognized through postfix_expression.

FUNCTION_IDENTIFIER = 
 TYPE_SPECIFIER / 
 IDENTIFIER / 
 FIELD_SELECTION 

UNARY_EXPRESSION = 
 POSTFIX_EXPRESSION / 
 INC_OP UNARY_EXPRESSION / 
 DEC_OP UNARY_EXPRESSION / 
 UNARY_OPERATOR __ UNARY_EXPRESSION 

// Grammar Note =  No traditional style type casts.

UNARY_OPERATOR = 
 $(PLUS / 
 DASH /
 BANG /
 TILDE)

// Grammar Note =  No '*' or '&' unary ops. Pointers are not supported.
MULTIPLICATIVE_EXPRESSION = 
 head:UNARY_EXPRESSION  tail:( __ (STAR / SLASH / PERCENT) __ UNARY_EXPRESSION )* {
  return buildBinaryExpression(head,tail);
}

ADDITIVE_EXPRESSION = 
 head:MULTIPLICATIVE_EXPRESSION tail:( __ (PLUS / DASH) __ MULTIPLICATIVE_EXPRESSION)* {
  return buildBinaryExpression(head,tail);
}


SHIFT_EXPRESSION = 
 head:ADDITIVE_EXPRESSION tail:( __ (LEFT_OP / RIGHT_OP) __ ADDITIVE_EXPRESSION)* {
  return buildBinaryExpression(head,tail);
}


RELATIONAL_EXPRESSION = 
 head:SHIFT_EXPRESSION  tail:( __ (LEFT_ANGLE / LE_OP / GE_OP) __ SHIFT_EXPRESSION)* {
  return buildBinaryExpression(head,tail);
}


EQUALITY_EXPRESSION = 
 head:RELATIONAL_EXPRESSION tail:( __ (EQ_OP / NE_OP) __ RELATIONAL_EXPRESSION)* {
  return buildBinaryExpression(head,tail);
}


AND_EXPRESSION = 
 head:EQUALITY_EXPRESSION tail:( __ AMPERSAND __ EQUALITY_EXPRESSION )* {
  return buildBinaryExpression(head,tail);
}


EXCLUSIVE_OR_EXPRESSION = 
 head:AND_EXPRESSION tail:(__ CARET __ AND_EXPRESSION)* {
  return buildBinaryExpression(head,tail);
}


INCLUSIVE_OR_EXPRESSION = 
 head:EXCLUSIVE_OR_EXPRESSION tail:( __ VERTICAL_BAR __ EXCLUSIVE_OR_EXPRESSION)* {
  return buildBinaryExpression(head,tail);
}


LOGICAL_AND_EXPRESSION = 
 head:INCLUSIVE_OR_EXPRESSION tail:( __ AND_OP __ INCLUSIVE_OR_EXPRESSION)* {
  return buildLogicalExpression(head,tail);
}


LOGICAL_XOR_EXPRESSION = 
 head:LOGICAL_AND_EXPRESSION tail:( __ XOR_OP __ LOGICAL_AND_EXPRESSION)* {
  return buildLogicalExpression(head,tail);
}


LOGICAL_OR_EXPRESSION = 
 head:LOGICAL_XOR_EXPRESSION tail:( __ OR_OP __ LOGICAL_XOR_EXPRESSION)* {
  return buildLogicalExpression(head,tail);
}


CONDITIONAL_EXPRESSION = 
 test:LOGICAL_OR_EXPRESSION op:( __ QUESTION __ consequent:EXPRESSION __ COLON __ alternate:ASSIGNMENT_EXPRESSION {return {consequent:consequent,alternate:alternate}} ) ? {
		return !op ? test : {
			nodeType: "ConditionalExpression",
			test: test,
			consequent: op.consequent,
			alternate: op.alternate
		};
 }



ASSIGNMENT_EXPRESSION = 
 CONDITIONAL_EXPRESSION / 
 left:UNARY_EXPRESSION __ ASSIGNMENT_OPERATOR __ right:ASSIGNMENT_EXPRESSION {
	 return new AssignmentExpressionNode(left,right);
 }

ASSIGNMENT_OPERATOR = 
 $(EQUAL / 
 MUL_ASSIGN / 
 DIV_ASSIGN / 
 MOD_ASSIGN / 
 ADD_ASSIGN / 
 SUB_ASSIGN / 
 LEFT_ASSIGN / 
 RIGHT_ASSIGN / 
 AND_ASSIGN / 
 XOR_ASSIGN / 
 OR_ASSIGN)

EXPRESSION = 
 head:ASSIGNMENT_EXPRESSION  tail:( __  COMMA __ ASSIGNMENT_EXPRESSION)* {
  return buildList(head,tail,3);
 }

CONSTANT_EXPRESSION = 
 CONDITIONAL_EXPRESSION

DECLARATION = 
 (fp:FUNCTION_PROTOTYPE __ SEMICOLON { return fp;}) / 
 (initDecl:INIT_DECLARATOR_LIST __ SEMICOLON {return initDecl;}) / 
 (PRECISION __ precisionQualifier:PRECISION_QUALIFIER __ typeSpecifier:TYPE_SPECIFIER_NO_PREC __ SEMICOLON { return new PrecisioniDeclaration(precisionQualifier,typeSpecifier); })/ 
 TYPE_QUALIFIER (__ IDENTIFIER __ LEFT_BRACE __ STRUCT_DECLARATION_LIST __ RIGHT_BRACE (IDENTIFIER / IDENTIFIER __ LEFT_BRACKET ( __ CONSTANT_EXPRESSION)? __ RIGHT_BRACKET)? )? __ SEMICOLON  

FUNCTION_PROTOTYPE = 
 FUNCTION_DECLARATOR __ RIGHT_PAREN

FUNCTION_DECLARATOR = 
 FUNCTION_HEADER 

FUNCTION_HEADER = 
 FULLY_SPECIFIED_TYPE __ IDENTIFIER __ LEFT_PAREN __ PARAMETER_DECLARATION  (__ COMMA __ PARAMETER_DECLARATION)*

PARAMETER_DECLARATOR = 
 TYPE_SPECIFIER __ IDENTIFIER (__ LEFT_BRACKET __ CONSTANT_EXPRESSION __ RIGHT_BRACKET)?

PARAMETER_DECLARATION = 
 (PARAMETER_TYPE_QUALIFIER __)? PARAMETER_QUALIFIER __ ( PARAMETER_DECLARATOR / PARAMETER_TYPE_SPECIFIER )

PARAMETER_QUALIFIER = 
 /* EMPTY */
 IN / 
 OUT / 
 INOUT 

PARAMETER_TYPE_SPECIFIER = 
 TYPE_SPECIFIER

INIT_DECLARATOR_LIST = 
 head:SINGLE_DECLARATION tail:( __ COMMA __ id:IDENTIFIER array:( __ LEFT_BRACKET __ length:(CONSTANT_EXPRESSION __)?  RIGHT_BRACKET{return {length:extractOptional(length,0)};})? init:( __ EQUAL __ INITIALIZER)?{return {identifier:id,array:!!array,length:array && array.length,initializer:extractOptional(init,3)};})*{
   head.identifiers.push(...tail);
   const node = Object.assign({nodeType:"VariableDeclarationList"}
   ,head);
   return node;
 }

SINGLE_DECLARATION = 
 type:FULLY_SPECIFIED_TYPE id:( __ IDENTIFIER )? array:(__ LEFT_BRACKET length:(__ CONSTANT_EXPRESSION __)?  RIGHT_BRACKET {return {length:extractOptional(length,0)};})? init:(__ EQUAL __ INITIALIZER)? {return {type:type,identifiers:[{identifier:extractOptional(id,1),array:!!array,length:array && array.length,initializer:extractOptional(init,3)}]};}/ 
 INVARIANT __ IDENTIFIER
// GRAMMAR NOTE =  NO 'ENUM', OR 'TYPEDEF'.

FULLY_SPECIFIED_TYPE = 
 TYPE_SPECIFIER /
 TYPE_QUALIFIER __ TYPE_SPECIFIER

INVARIANT_QUALIFIER = 
 INVARIANT

INTERPOLATION_QUALIFIER = 
 SMOOTH / 
 FLAT

LAYOUT_QUALIFIER = 
 LAYOUT __ LEFT_PAREN __ LAYOUT_QUALIFIER_ID_LIST __ RIGHT_PAREN

LAYOUT_QUALIFIER_ID_LIST = 
 head:LAYOUT_QUALIFIER_ID tail:( __ COMMA __ LAYOUT_QUALIFIER_ID)* {
   return buildList(head,tail,3);
 }

LAYOUT_QUALIFIER_ID = 
 id:IDENTIFIER init:( __ EQUAL __ INTEGER_CONSTANT)? {
   return {
     nodeType:"LayoutQualifierID",
     idenitifier:id,
     init:extractOptional(init,3)
   };
 }

PARAMETER_TYPE_QUALIFIER = 
 CONST 

TYPE_QUALIFIER = 
 option:(opt:(ivq:INVARIANT_QUALIFIER? __ ipq:INTERPOLATION_QUALIFIER?{return {invariantQualifier:ivq,interpolationQualifier:ipq};}) / LAYOUT_QUALIFIER __)? STORAGE_QUALIFIER


STORAGE_QUALIFIER = 
 CONST / 
 (CENTROID __)? (IN / OUT) /
 UNIFORM

TYPE_SPECIFIER = 
 precision:(PRECISION_QUALIFIER __ )? node:TYPE_SPECIFIER_NO_PREC {
  
 }

TYPE_SPECIFIER_NO_PREC = 
 TYPE_SPECIFIER_NONARRAY (__ LEFT_BRACKET ( __ CONSTANT_EXPRESSION )? __ RIGHT_BRACKET)?

TYPE_SPECIFIER_NONARRAY = 
 VOID / 
 FLOAT / 
 INT / 
 UINT / 
 BOOL / 
 VEC2 / 
 VEC3 / 
 VEC4 / 
 BVEC2 / 
 BVEC3 / 
 BVEC4  / 
 IVEC2 / 
 IVEC3 / 
 IVEC4 / 
 UVEC2 / 
 UVEC3 / 
 UVEC4 / 
 MAT2 / 
 MAT3 / 
 MAT4 / 
 MAT2X2 / 
 MAT2X3 / 
 MAT2X4 / 
 MAT3X2 / 
 MAT3X3 / 
 MAT3X4 / 
 MAT4X2 / 
 MAT4X3 / 
 MAT4X4 / 
 SAMPLER2D / 
 SAMPLER3D / 
 SAMPLERCUBE / 
 SAMPLER2DSHADOW / 
 SAMPLERCUBESHADOW / 
 SAMPLER2DARRAY / 
 SAMPLER2DARRAYSHADOW / 
 ISAMPLER2D / 
 ISAMPLER3D / 
 ISAMPLERCUBE / 
 ISAMPLER2DARRAY / 
 USAMPLER2D / 
 USAMPLER3D / 
 USAMPLERCUBE / 
 USAMPLER2DARRAY / 
 STRUCT_SPECIFIER / 
 TYPE_NAME

PRECISION_QUALIFIER = 
 HIGH_PRECISION / 
 MEDIUM_PRECISION / 
 LOW_PRECISION

STRUCT_SPECIFIER = 
 STRUCT ( __ IDENTIFIER)? __ LEFT_BRACE __ STRUCT_DECLARATION_LIST __ RIGHT_BRACE  

STRUCT_DECLARATION_LIST = 
 STRUCT_DECLARATION ( __ STRUCT_DECLARATION)*

STRUCT_DECLARATION = 
 TYPE_QUALIFIER? __ TYPE_SPECIFIER __ STRUCT_DECLARATOR_LIST __ SEMICOLON

STRUCT_DECLARATOR_LIST = 
 STRUCT_DECLARATOR ( __ COMMA __ STRUCT_DECLARATOR )*

STRUCT_DECLARATOR = 
 IDENTIFIER ( __ LEFT_BRACKET (__ CONSTANT_EXPRESSION)? __ RIGHT_BRACKET)?

INITIALIZER = 
 ASSIGNMENT_EXPRESSION

DECLARATION_STATEMENT = 
 DECLARATION

STATEMENT = 
 COMPOUND_STATEMENT_WITH_SCOPE / 
 SIMPLE_STATEMENT 

STATEMENT_NO_NEW_SCOPE = 
 COMPOUND_STATEMENT_NO_NEW_SCOPE / 
 SIMPLE_STATEMENT

STATEMENT_WITH_SCOPE = 
 COMPOUND_STATEMENT_NO_NEW_SCOPE / 
 SIMPLE_STATEMENT

// GRAMMAR NOTE =  LABELED STATEMENTS FOR SWITCH ONLY; 'GOTO' IS NOT SUPPORTED.

SIMPLE_STATEMENT = 
 DECLARATION_STATEMENT / 
 EXPRESSION_STATEMENT / 
 SELECTION_STATEMENT / 
 SWITCH_STATEMENT / 
 CASE_LABEL / 
 ITERATION_STATEMENT / 
 JUMP_STATEMENT

COMPOUND_STATEMENT_WITH_SCOPE = 
 LEFT_BRACE ( __ STATEMENT_LIST)? __ RIGHT_BRACE

COMPOUND_STATEMENT_NO_NEW_SCOPE = 
 LEFT_BRACE (__ STATEMENT_LIST)? __ RIGHT_BRACE

STATEMENT_LIST = 
 STATEMENT*

EXPRESSION_STATEMENT = 
 (EXPRESSION __)? SEMICOLON

SELECTION_STATEMENT = 
 IF __ LEFT_PAREN __ EXPRESSION __ RIGHT_PAREN __ SELECTION_REST_STATEMENT

SELECTION_REST_STATEMENT = 
 STATEMENT_WITH_SCOPE ( __ ELSE __ STATEMENT_WITH_SCOPE )?  

CONDITION = 
 EXPRESSION / 
 FULLY_SPECIFIED_TYPE __ IDENTIFIER __ EQUAL __ INITIALIZER

SWITCH_STATEMENT = 
SWITCH __ LEFT_PAREN __ EXPRESSION __ RIGHT_PAREN __ LEFT_BRACE __ SWITCH_STATEMENT_LIST __ RIGHT_BRACE

SWITCH_STATEMENT_LIST = 
 STATEMENT_LIST

CASE_LABEL = 
 CASE __ EXPRESSION __ COLON / 
 DEFAULT __ COLON

ITERATION_STATEMENT = 
 WHILE __ LEFT_PAREN __ CONDITION __ RIGHT_PAREN __ STATEMENT_NO_NEW_SCOPE / 
 DO __ STATEMENT_WITH_SCOPE __ WHILE __ LEFT_PAREN __ EXPRESSION __ RIGHT_PAREN __ SEMICOLON / 
 FOR __ LEFT_PAREN __ FOR_INIT_STATEMENT __ FOR_REST_STATEMENT __ RIGHT_PAREN __ STATEMENT_NO_NEW_SCOPE

FOR_INIT_STATEMENT = 
 EXPRESSION_STATEMENT / 
 DECLARATION_STATEMENT

CONDITIONOPT = 
 CONDITION
 /* EMPTY */

FOR_REST_STATEMENT = 
 CONDITIONOPT __ SEMICOLON (__ EXPRESSION)?

JUMP_STATEMENT = 
 CONTINUE __ SEMICOLON / 
 BREAK __ SEMICOLON / 
 RETURN __ SEMICOLON / 
 RETURN __ EXPRESSION __ SEMICOLON / 
 DISCARD __ SEMICOLON // FRAGMENT SHADER ONLY.
// GRAMMAR NOTE =  NO 'GOTO'. GOTOS ARE NOT SUPPORTED.


EXTERNAL_DECLARATION = 
 __ decl:(FUNCTION_DEFINITION / 
 DECLARATION) __ { return decl; }

FUNCTION_DEFINITION = 
 FUNCTION_PROTOTYPE __ COMPOUND_STATEMENT_NO_NEW_SCOPE


/* IN GENERAL THE ABOVE GRAMMAR DESCRIBES A SUPER SET OF THE GLSL ES LANGUAGE. CERTAIN CONSTRUCTS THAT ARE
VALID PURELY IN TERMS OF THE GRAMMAR ARE DISALLOWED BY STATEMENTS ELSEWHERE IN THIS SPECIFICATION.
RULES SPECIFYING THE SCOPING ARE PRESENT ONLY TO ASSIST THE UNDERSTANDING OF SCOPING AND THEY DO NOT AFFECT
THE LANGUAGE ACCEPTED BY THE GRAMMAR. IF REQUIRED, THE GRAMMAR CAN BE SIMPLIFIED BY MAKING THE
FOLLOWING SUBSTITUTIONS = 
• REPLACE COMPOUND_STATEMENT_WITH_SCOPE AND COMPOUND_STATEMENT_NO_NEW_SCOPE WITH A NEW
RULE COMPOUND_STATEMENT
• REPLACE STATEMENT_WITH_SCOPE AND STATEMENT_NO_NEW_SCOPE WITH THE EXISTING RULE STATEMENT.*/
