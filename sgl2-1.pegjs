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

  function buildPostfixExpression(head,tail){
    return tail.reduce((result,element)=>{
        return {
          nodeType: "PostfixExpression",
          operator: element.operator,
          left: result
        };
    },head);
  }

  // ノードクラス定義
  class ASTBaseNode{
    constructor(){
      //this.location = location();
    }
  }
  class CommentNode extends ASTBaseNode {
    constructor(text){
      super();
      this.nodeType = 'Commnet';
      this.text = text;
      this.location = location();
    }
  }
  class NumericConstantNode extends ASTBaseNode  {
    constructor(type,value){
      super();
      this.nodeType = 'NumericConstant';
      this.type = type;
      this.value = value;
    }
  }
  class PrecisionDeclNode  extends ASTBaseNode {
    constructor(precisionQualifier,typeSpecifier){
      super();
      this.nodeType = 'PrecisioniDeclaration';
      this.precisionQualifier = precisionQualifier;
      this.typeSpecifier = typeSpecifier;
    }
  }
  class AssignmentExpressionNode  extends ASTBaseNode {
    constructor(operator,left,right){
      super();
      this.nodeType = 'AssignmentExpression';
      this.operator = operator;
      this.left = left;
      this.right = right;
    }
  }
  class ArrayPointerNode extends ASTBaseNode  {
    constructor(index){
      super();
      this.nodeType = 'ArrayPointer';
      this.operator = "[]";
      this.value = index;
    }
  }

  class FieldSelectorNode extends ASTBaseNode  {
    constructor(selector){
      super();
      this.nodeType = 'FieldSelector';
      this.operator = selector;
    }
  }
  class PostIncDecNode extends ASTBaseNode  {
    constructor(operator){
      super();
      this.nodeType = 'PostIncDec';
      this.operator = operator;
    }
  }
  class TypeSpecifierNode extends ASTBaseNode  {
    constructor(typeName){
      super();
      this.nodeType = 'TypeSpecifier';
      this.typeName = typeName;
    }
  }
  class LayoutQualifierNode extends ASTBaseNode  {
    constructor(idList){
      super();
      this.nodeType = 'LayoutQualifier';
      this.idList = idList;
    }
  }
	
  class MethodCallNode extends ASTBaseNode  {
    constructor(exp,call){
      super();
      this.nodeType = 'MethodCall';
      this.expression = exp;
			this.call = call;
    }
  }
  class ProgramNode extends ASTBaseNode  {
    constructor(program){
      super();
      this.nodeType = 'Program';
			this.program = program;
    }
  }
  
	class FunctionCallNode extends ASTBaseNode  {
    constructor(funcId,params){
      super();
      this.nodeType = 'FunctionCall';
      this.id = funcId;
			this.params = params;
    }
  }

  class UnaryExpressionNode extends ASTBaseNode  {
    constructor(operator,expression){
      super();
      this.nodeType = 'UnaryExpression';
      this.operator = operator;
			this.params = expression;
    }
  }
  class FunctionPrototypeNode extends ASTBaseNode  {
    constructor(prototype){
      super();
      this.nodeType = 'FunctionPrototype';
      this.prototype = prototype;
    }
  }
  class ParameterDeclaratorNode extends ASTBaseNode  {
    constructor(type,id,array){
      super();
      this.nodeType = 'ParameterDeclarator';
      this.type = type;
      this.id = id;
      this.array = array;
    }
  }
  class ParameterDeclarationNode extends ASTBaseNode  {
    constructor(typeQualifier,qualifier,declOrSpec){
      super();
      this.nodeType = 'ParameterDeclaration';
      this.typeQualifier = typeQuaifier;
      this.qualifier = qualifier;
      this.declOrSpec = declOrSpec;
    }
  }
  class ScopeBlockNode extends ASTBaseNode  {
    constructor(statements){
      super();
      this.nodeType = 'ScopeBlock';
      this.statements = statements;
    }
  }
  class NoScopeBlockNode extends ASTBaseNode  {
    constructor(statements){
      super();
      this.nodeType = 'NoScopeBlock';
      this.statements = statements;
    }
  }
  class ExpressionNode extends ASTBaseNode  {
    constructor(expression){
      super();
      this.nodeType = 'Expression';
      this.expression = expression;
    }
  }
  class SelectionStatementNode extends ASTBaseNode  {
    constructor(test,then,else_){
      super();
      this.nodeType = 'SelectionStatement';
      this.test = test;
      this.then = then;
      this.else_ = else_;
    }
  }
  class VariableDeclarationNode extends ASTBaseNode  {
    constructor(type,id,init){
      super();
      this.nodeType = 'VariableDeclaration';
      this.type = type;
      this.id = id;
      this.init = init;
    }
  }
  class SwitchStatementNode extends ASTBaseNode  {
    constructor(condition,caseStatements){
      super();
      this.nodeType = 'SwitchStatement';
      this.condition = condition;
      this.caseStatements = caseStatements;
    }
  }
  class CaseStatementNode extends ASTBaseNode  {
    constructor(condition,statements){
      super();
      this.nodeType = 'CaseStatement';
      this.condition = condition;
      this.statements = statements;
    }
  }
  class WhileStatementNode extends ASTBaseNode  {
    constructor(condition,statements){
      super();
      this.nodeType = 'WhileStatement';
      this.condition = condition;
      this.statements = statements;
    }
  }
  class DoWhileStatementNode extends ASTBaseNode  {
    constructor(condition,statements){
      super();
      this.nodeType = 'DoWhileStatement';
      this.condition = condition;
      this.statements = statements;
    }
  }
  class ForStatementNode extends ASTBaseNode  {
    constructor(init,test,update,statements){
      super();
      this.nodeType = 'ForStatement';
      this.init = init;
      this.test = test;
      this.update = update;
      this.statements = statements;
    }
  }
  class ContinueStatementNode extends ASTBaseNode  {
    constructor(){
      super();
      this.nodeType = 'ContinueStatement';
    }
  }
  class BreakStatementNode extends ASTBaseNode  {
    constructor(){
      super();
      this.nodeType = 'BreakStatement';
    }
  }
  class ReturnStatementNode extends ASTBaseNode  {
    constructor(expression){
      super();
      this.expression = expression;
      this.nodeType = 'ReturnStatement';
    }
  }

  class DiscardStatementNode extends ASTBaseNode  {
    constructor(){
      super();
      this.nodeType = 'DiscardStatement';
    }
  }

  class FunctionDefinitionNode extends ASTBaseNode  {
    constructor(functionPrototype,statement){
      super();
      this.nodeType = 'FunctionDefinition';
      this.functionPrototype = functionPrototype;
      this.statement = statement;
    }
  }

  class StructSpecifierNode extends ASTBaseNode  {
    constructor(id,structDeclarationList){
      super();
      this.nodeType = 'StructSpecifier';
      this.id = id;
      this.structDeclarationList = structDeclarationList;
    }
  }

  class StructDeclarationNode extends ASTBaseNode  {
    constructor(typeQualifier,typeSpecifier,structDeclarationList){
      super();
      this.nodeType = 'StructDeclaration';
			this.typeQualifier = typeQualifier;
			this.typeSpecifier = typeSpecifier;
			this.structDeclarationList = structDeclarationList;
    }
  }


  const typeDefs = [
    {name:'void',size:4,bitSize:32,byteSize:4,max:0,min:0,integer:false,signed:false,wasmType:'i32',kind:'Native'},
    {name:'float',size:4,bitSize:32,byteSize:4,max:3.402823466e+38,min:1.175494351e-38,integer:false,signed:true,wasmType:'f32',kind:'Native'},
    {name:'int',size:4,bitSize:32,byteSize:4,max:0x7fffffff,min:-0x80000000,integer:true,signed:true,wasmType:'i32',kind:'Native'},
    {name:'uint',size:4,bitSize:32,byteSize:4,max:0xffffffff,min:0,integer:true,signed:false,wasmType:'i32',kind:'Native'},
    {name:'bool',size:4,bitSize:32,byteSize:4,max:1,min:0,integer:false,signed:true,wasmType:'i32',kind:'Native'},
    {name:'vec2',memberType:'float',memberCount:2,size:8,byteSize:8,integer:false,signed:true,kind:'vector'},
    {name:'vec3',memberType:'float',memberCount:3,size:12,byteSize:12,integer:false,signed:true,kind:'vector'},
    {name:'vec4',memberType:'float',memberCount:4,size:16,byteSize:16,integer:false,signed:true,kind:'vector'},
    {name:'bvec2',memberType:'bool',memberCount:2,size:8,byteSize:8,integer:true,signed:true,kind:'vector'},
    {name:'bvec3',memberType:'bool',memberCount:3,size:12,byteSize:12,integer:true,signed:true,kind:'vector'},
    {name:'bvec4',memberType:'bool',memberCount:4,size:16,byteSize:16,integer:true,signed:true,kind:'vector'},
    {name:'ivec2',memberType:'int',memberCount:2,size:8,byteSize:8,integer:true,signed:true,kind:'vector'},
    {name:'ivec3',memberType:'int',memberCount:3,size:12,byteSize:12,integer:true,signed:true,kind:'vector'},
    {name:'ivec4',memberType:'int',memberCount:4,size:16,byteSize:16,integer:true,signed:true,kind:'vector'},
    {name:'uvec2',memberType:'uint',memberCount:2,size:8,byteSize:8,integer:true,signed:false,kind:'vector'},
    {name:'uvec3',memberType:'uint',memberCount:3,size:12,byteSize:12,integer:true,signed:false,kind:'vector'},
    {name:'uvec4',memberType:'uint',memberCount:4,size:16,byteSize:16,integer:true,signed:false,kind:'vector'},

  ];
  const typeDefsMap = new Map(typeDefs.map(t=>[t.name,t]));

}

TRANSLATION_UNIT = program:EXTERNAL_DECLARATION*{return new ProgramNode(program);} 

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


CONST = "const" !IDENTIFIER
BOOL = "bool" !IDENTIFIER
FLOAT = "float" !IDENTIFIER
INT = "int" !IDENTIFIER
UINT = "uint" !IDENTIFIER
BREAK = "break" !IDENTIFIER
CONTINUE = "continue" !IDENTIFIER
DO = "do" !IDENTIFIER
ELSE = "else" !IDENTIFIER
FOR = "for" !IDENTIFIER
IF = "if" !IDENTIFIER
DISCARD = "discard" !IDENTIFIER
RETURN = "return" !IDENTIFIER
SWITCH = "switch" !IDENTIFIER
CASE = "case" !IDENTIFIER
DEFAULT = "default" !IDENTIFIER
BVEC2 = "bvec2" !IDENTIFIER
BVEC3 = "bvec3" !IDENTIFIER
BVEC4 = "bvec4" !IDENTIFIER
IVEC2 = "ivec2" !IDENTIFIER
IVEC3 = "ivec3" !IDENTIFIER
IVEC4 = "ivec4" !IDENTIFIER
UVEC2 = "uvec2" !IDENTIFIER
UVEC3 = "uvec3" !IDENTIFIER
UVEC4 = "uvec4" !IDENTIFIER
VEC2 = "vec2" !IDENTIFIER
VEC3 = "vec3" !IDENTIFIER
VEC4 = "vec4" !IDENTIFIER
MAT2 = "mat2" !IDENTIFIER
MAT3 = "mat3" !IDENTIFIER
MAT4 = "mat4" !IDENTIFIER
CENTROID = "centroid" !IDENTIFIER
IN = "in" !IDENTIFIER
OUT = "out" !IDENTIFIER
INOUT = "inout" !IDENTIFIER
UNIFORM = "uniform" !IDENTIFIER
FLAT = "flat" !IDENTIFIER
SMOOTH = "smooth" !IDENTIFIER
LAYOUT = "layout" !IDENTIFIER
MAT2X2 = "mat2x2" !IDENTIFIER
MAT2X3 = "mat2x3" !IDENTIFIER
MAT2X4 = "mat2x4" !IDENTIFIER
MAT3X2 = "mat3x2" !IDENTIFIER
MAT3X3 = "mat3x3" !IDENTIFIER
MAT3X4 = "mat3x4" !IDENTIFIER
MAT4X2 = "mat4x2" !IDENTIFIER
MAT4X3 = "mat4x3" !IDENTIFIER
MAT4X4 = "mat4x4" !IDENTIFIER
SAMPLER2D = "sampler2d" !IDENTIFIER
SAMPLER3D = "sampler3d" !IDENTIFIER
SAMPLERCUBE = "samplercube" !IDENTIFIER
SAMPLER2DSHADOW = "sampler2dshadow" !IDENTIFIER
SAMPLERCUBESHADOW = "samplercubeshadow" !IDENTIFIER
SAMPLER2DARRAY = "sampler2darray" !IDENTIFIER
SAMPLER2DARRAYSHADOW = "sampler2darrayshadow" !IDENTIFIER
ISAMPLER2D = "isampler2d" !IDENTIFIER
ISAMPLER3D = "isampler3d" !IDENTIFIER
ISAMPLERCUBE = "isamplercube" !IDENTIFIER
ISAMPLER2DARRAY = "isampler2darray" !IDENTIFIER
USAMPLER2D = "usampler2d" !IDENTIFIER
USAMPLER3D = "usampler3d" !IDENTIFIER
USAMPLERCUBE = "usamplercube" !IDENTIFIER
USAMPLER2DARRAY = "usampler2darray" !IDENTIFIER

STRUCT = "struct" !IDENTIFIER
VOID = "void" !IDENTIFIER
WHILE = "while" !IDENTIFIER

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

TYPE_NAME = id:IDENTIFIER {

}

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
 (call:FUNCTION_CALL_GENERIC method:(__ DOT __ FUNCTION_CALL_GENERIC)?{method = extractOptional(method,3); return method ? new MethodCall(call,method) : call; }))  
  tail:((LEFT_BRACKET __ index:INTEGER_EXPRESSION __ RIGHT_BRACKET { return new ArrayPointerNode(index);}) / 
  (__ DOT __ selector:FIELD_SELECTION { return new FieldSelectorNode(selector);}))* postIncDec:(__ op:(INC_OP/DEC_OP) {return new PostIncDecNode(op);})? 
  {
    postIncDec = extractOptional(postIncDec,0);
    let exp = !tail.length ? head:buildPostfixExpression(head,tail);
    if(postIncDec){
      postIncDec.left = exp;
      return postIncDec;
    } else {
      return exp;
    }
		// return !tail.length ? head : new PostfixExpressionNode(head,tail); 
	}

INTEGER_EXPRESSION = 
 EXPRESSION

FUNCTION_CALL = 
 FUNCTION_CALL_OR_METHOD

FUNCTION_CALL_OR_METHOD = 
 FUNCTION_CALL_GENERIC / 
 exp:POSTFIX_EXPRESSION __ DOT __ method:FUNCTION_CALL_GENERIC {
	return new MethodCall(exp,method);
 }

FUNCTION_CALL_GENERIC = 
 id:FUNCTION_IDENTIFIER __ LEFT_PAREN params:(void_:( __ VOID ) { return [void_[1]]; } / ( __ head:ASSIGNMENT_EXPRESSION tail:( __ COMMA __ ASSIGNMENT_EXPRESSION )* {return buildList(head,tail,3);}))? __ RIGHT_PAREN {
 return new FunctionCallNode(id,extractOptional(params,0));
}

// Grammar Note =  Constructors look like functions, but lexical analysis recognized most of them as
// keywords. They are now recognized through “type_specifier”.
// Methods (.length) and identifiers are recognized through postfix_expression.

FUNCTION_IDENTIFIER = 
 TYPE_SPECIFIER / 
 IDENTIFIER / 
 FIELD_SELECTION 

UNARY_EXPRESSION = 
 POSTFIX_EXPRESSION / 
 (op:(INC_OP/DEC_OP/UNARY_OPERATOR) exp:UNARY_EXPRESSION {return new UnaryExpressionNode(op,exp);})  

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
 head:SHIFT_EXPRESSION  tail:( __ (RIGHT_ANGLE / LEFT_ANGLE / LE_OP / GE_OP) __ SHIFT_EXPRESSION)* {
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
 left:UNARY_EXPRESSION __ operator:ASSIGNMENT_OPERATOR __ right:ASSIGNMENT_EXPRESSION {
	 return new AssignmentExpressionNode(operator,left,right);
 } / CONDITIONAL_EXPRESSION  

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
 typeQualifier:TYPE_QUALIFIER structDeclaration:(__ idStruct:IDENTIFIER __ LEFT_BRACE __ structDeclarationList:STRUCT_DECLARATION_LIST __ RIGHT_BRACE __ varDecl:(id:IDENTIFIER  array:(__ LEFT_BRACKET length:( __ CONSTANT_EXPRESSION )? __ RIGHT_BRACKET {return {length:extractOptional(length,1)};})? {return {id:id,array:extractOptional(array,0)};})? )? __ SEMICOLON  

FUNCTION_PROTOTYPE = 
 prototype:FUNCTION_DECLARATOR __ RIGHT_PAREN {return new FunctionPrototypeNode(prototype);}

FUNCTION_DECLARATOR = 
 FUNCTION_HEADER 

FUNCTION_HEADER = 
 returnType:FULLY_SPECIFIED_TYPE __ functionName:IDENTIFIER __ LEFT_PAREN __ params:PARAMETER_DECLARATION  paramsTail:(__ COMMA __ PARAMETER_DECLARATION)* {
   return {
     returnType:returnType,
     functionName:functionName,
     params:buildList(params,paramsTail,3)
   };
 }

PARAMETER_DECLARATOR = 
 type:TYPE_SPECIFIER __ id:IDENTIFIER array:(__ LEFT_BRACKET __ length:(CONSTANT_EXPRESSION {return {length:parseInt(length,10)};}) __ RIGHT_BRACKET )? {return new ParameterDeclaratorNode(type,id,array);}

PARAMETER_DECLARATION = 
 typeQualifier:(PARAMETER_TYPE_QUALIFIER __)? qualifier:PARAMETER_QUALIFIER __ declOrSpec:( PARAMETER_DECLARATOR / PARAMETER_TYPE_SPECIFIER ) {
 return new ParameterDeclaratorNode(extractOptional(typeQualifier,0),qualifier,declOrSpec);
}

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
 (INVARIANT __ id:IDENTIFIER) {id.invariant = true; return id; }
// GRAMMAR NOTE =  NO 'ENUM', OR 'TYPEDEF'.

FULLY_SPECIFIED_TYPE = 
 TYPE_SPECIFIER /
 (typeQualifier:TYPE_QUALIFIER __ typeSpecifier:TYPE_SPECIFIER {typeSpecifier.typeQualifier = typeQualifier; return typeSpecifier;})

INVARIANT_QUALIFIER = 
 $INVARIANT

INTERPOLATION_QUALIFIER = 
 $(SMOOTH / 
 FLAT)

LAYOUT_QUALIFIER = 
 LAYOUT __ LEFT_PAREN __ idList:LAYOUT_QUALIFIER_ID_LIST __ RIGHT_PAREN {
  return new LayoutQualifierNode(idList); 
 }

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
 $CONST 

TYPE_QUALIFIER = 
 option:(opt:((ivq:INVARIANT_QUALIFIER? __ ipq:INTERPOLATION_QUALIFIER?{return {invariant:!!ivq,interpolation:ipq};}) / LAYOUT_QUALIFIER) __ {return opt;})? node:STORAGE_QUALIFIER {
  return Object.assign(node,option);
 }


STORAGE_QUALIFIER = 
 CONST {return {const:true}} / 
 (centroid:(CENTROID __)? inout:$(IN / OUT) __ {return {centroid:centroid,inout:inout}}) /
 UNIFORM {return {uniform:true};}

TYPE_SPECIFIER = 
 precision:(PRECISION_QUALIFIER __ )? node:TYPE_SPECIFIER_NO_PREC {
  node.precision = extractOptional(precision,0);
  return node;
 }

TYPE_SPECIFIER_NO_PREC = 
 node:TYPE_SPECIFIER_NONARRAY array:(__ LEFT_BRACKET length:( __ CONSTANT_EXPRESSION )? __ RIGHT_BRACKET {return {length:extractOptional(length,1)};})?{
   array = extractOptional(array,0);
   if(array){node.array = array;}
   return node;
 }

TYPE_SPECIFIER_NONARRAY = 
 ($(VOID / 
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
 USAMPLER2DARRAY){return new TypeSpecifierNode(text());})/ 
 STRUCT_SPECIFIER / 
 TYPE_NAME

PRECISION_QUALIFIER = 
 HIGH_PRECISION / 
 MEDIUM_PRECISION / 
 LOW_PRECISION

STRUCT_SPECIFIER = 
 STRUCT id:( __ IDENTIFIER)? __ LEFT_BRACE __ structDeclarations:STRUCT_DECLARATION_LIST __ RIGHT_BRACE {
	 return new StructSpecifierNode(id,structDeclarations);
 }

STRUCT_DECLARATION_LIST = 
 head:STRUCT_DECLARATION tail:( __ STRUCT_DECLARATION)* {return buildList(head,tail,1);}

STRUCT_DECLARATION = 
 typeQualifier:TYPE_QUALIFIER? __ typeSpecifier:TYPE_SPECIFIER __ structDeclarationList:STRUCT_DECLARATOR_LIST __ SEMICOLON {
	return new StructDeclarationNode(typeQualifier,typeSpecifier,structDeclarationList);
 }

STRUCT_DECLARATOR_LIST = 
 head:STRUCT_DECLARATOR tail:( __ COMMA __ STRUCT_DECLARATOR )* {return buildList(head,tail,3);}

STRUCT_DECLARATOR = 
 id:IDENTIFIER array:( __ LEFT_BRACKET length:(__ CONSTANT_EXPRESSION)? __ RIGHT_BRACKET {return {length:extractOptional(length,1)};})? {
 	return !array ? id : (id.array = array,id) 
 }


INITIALIZER = 
 ASSIGNMENT_EXPRESSION

DECLARATION_STATEMENT = 
 DECLARATION

STATEMENT = 
 __ statement:(COMPOUND_STATEMENT_WITH_SCOPE / 
 SIMPLE_STATEMENT) __ {return statement; }

STATEMENT_NO_NEW_SCOPE = 
 COMPOUND_STATEMENT_NO_NEW_SCOPE / 
 SIMPLE_STATEMENT

STATEMENT_WITH_SCOPE = 
 statement:(COMPOUND_STATEMENT_NO_NEW_SCOPE / 
 SIMPLE_STATEMENT) {
  return new ScopeBlockNode(statement);
 }

// GRAMMAR NOTE =  LABELED STATEMENTS FOR SWITCH ONLY; 'GOTO' IS NOT SUPPORTED.

SIMPLE_STATEMENT = 
 DECLARATION_STATEMENT / 
 JUMP_STATEMENT /
 EXPRESSION_STATEMENT / 
 SELECTION_STATEMENT / 
 SWITCH_STATEMENT / 
 ITERATION_STATEMENT / 
 CASE_LABEL  

COMPOUND_STATEMENT_WITH_SCOPE = 
 LEFT_BRACE statementList:( __ STATEMENT_LIST __ )? __ RIGHT_BRACE {
		return new ScopeBlockNode(extractOptional(statementList,1));
 }

COMPOUND_STATEMENT_NO_NEW_SCOPE = 
 LEFT_BRACE statementList:(__ STATEMENT_LIST __)? __ RIGHT_BRACE {
	 return new NoScopeBlockNode(extractOptional(statementList,1));
 }

STATEMENT_LIST = 
statementList:( __ STATEMENT __ )* {return extractList(statementList,1);} 

EXPRESSION_STATEMENT = 
 expression:(__ EXPRESSION __)? SEMICOLON { return new ExpressionNode(extractOptional(expression,1)); }

SELECTION_STATEMENT = 
 IF __ LEFT_PAREN __ test:EXPRESSION __ RIGHT_PAREN __ statement:SELECTION_REST_STATEMENT __ {
	 return new SelectionStatementNode(test,statement.then,statement["else"]);
 }

SELECTION_REST_STATEMENT = 
 __ then:STATEMENT_WITH_SCOPE else_:( __ ELSE __ STATEMENT_WITH_SCOPE )? {
	 return {then:then,"else":extractOptional(else_,3)};
 }

CONDITION = 
 EXPRESSION / 
 type:FULLY_SPECIFIED_TYPE __ id:IDENTIFIER __ EQUAL __ init:INITIALIZER {
	 return new VariableDeclarationNode(type,id,init);
 }

SWITCH_STATEMENT = 
SWITCH __ LEFT_PAREN __ condition:EXPRESSION __ RIGHT_PAREN __ LEFT_BRACE __ caseStatements:SWITCH_STATEMENT_LIST __ RIGHT_BRACE {
	return new SwitchStatementNode(condition,caseStatements);	
}

SWITCH_STATEMENT_LIST = 
 caseStatements:(__ CASE_STATEMENT __)* {return extractList(caseStatements,1);}

CASE_STATEMENT =
	 caseLabel:CASE_LABEL __ statement:STATEMENT_LIST {return new CaseStatementNode(caseLabel,statement);}

CASE_LABEL = 
 CASE __ condition:EXPRESSION __ COLON {return condition; }/ 
 d:DEFAULT __ COLON {return d;}

ITERATION_STATEMENT = 
 WHILE __ LEFT_PAREN __ condition:CONDITION __ RIGHT_PAREN __ statement:STATEMENT_NO_NEW_SCOPE {return new WhileStatementNode(condition,statement);}/ 
 DO __ statement:STATEMENT_WITH_SCOPE __ WHILE __ LEFT_PAREN __ condition:EXPRESSION __ RIGHT_PAREN __ SEMICOLON {return new DoWhileStatementNode(condition,statement);} / 
 FOR __ LEFT_PAREN __ init:FOR_INIT_STATEMENT __ rest:FOR_REST_STATEMENT __ RIGHT_PAREN __ statement:STATEMENT_NO_NEW_SCOPE {return new ForStatementNode(init,rest.condtion,rest.update,statement);}

FOR_INIT_STATEMENT = 
 EXPRESSION_STATEMENT / 
 DECLARATION_STATEMENT

CONDITIONOPT = 
 CONDITION
 /* EMPTY */

FOR_REST_STATEMENT = 
 condition:CONDITIONOPT __ SEMICOLON update:(__ EXPRESSION)? {return {condition:condition,update:extractOptional(update,1)};}

JUMP_STATEMENT = 
 __ CONTINUE __ SEMICOLON {return new ContinueStatementNode();}/ 
 __ BREAK __ SEMICOLON {return new BreakStatementNode();}/ 
 __ RETURN expression:(__ EXPRESSION)? __ SEMICOLON {return new ReturnStatementNode(extractOptional(expression,1));}/ 
 __ DISCARD __ SEMICOLON {return new DiscardStatement();}// FRAGMENT SHADER ONLY.
// GRAMMAR NOTE =  NO 'GOTO'. GOTOS ARE NOT SUPPORTED.


EXTERNAL_DECLARATION = 
 __ declaration:(FUNCTION_DEFINITION / DECLARATION) __ { return declaration; }

FUNCTION_DEFINITION = 
 functionPrototype:FUNCTION_PROTOTYPE __ statement:COMPOUND_STATEMENT_NO_NEW_SCOPE {return new FunctionDefinitionNode(functionPrototype,statement);}



/* IN GENERAL THE ABOVE GRAMMAR DESCRIBES A SUPER SET OF THE GLSL ES LANGUAGE. CERTAIN CONSTRUCTS THAT ARE
VALID PURELY IN TERMS OF THE GRAMMAR ARE DISALLOWED BY STATEMENTS ELSEWHERE IN THIS SPECIFICATION.
RULES SPECIFYING THE SCOPING ARE PRESENT ONLY TO ASSIST THE UNDERSTANDING OF SCOPING AND THEY DO NOT AFFECT
THE LANGUAGE ACCEPTED BY THE GRAMMAR. IF REQUIRED, THE GRAMMAR CAN BE SIMPLIFIED BY MAKING THE
FOLLOWING SUBSTITUTIONS = 
• REPLACE COMPOUND_STATEMENT_WITH_SCOPE AND COMPOUND_STATEMENT_NO_NEW_SCOPE WITH A NEW
RULE COMPOUND_STATEMENT
• REPLACE STATEMENT_WITH_SCOPE AND STATEMENT_NO_NEW_SCOPE WITH THE EXISTING RULE STATEMENT.*/
