//===========================================================================
//
//  Parsing Expression Grammar of sgl2 
//
//---------------------------------------------------------------------------

{
  const wasmModule = options.module;
  const emulationTypes 

}


//-------------------------------------------------------------------------
//  Declaration
//-------------------------------------------------------------------------

Statements = Statement* 
Statement = Declaration / Expression

Declaration = VariableDeclaration / FunctionDeclation / TypeDeclaration / ConstDeclation
VariableDeclaration = TypeSpecifier Pointer? _ ( Identfier _ '=' Expression _ )+ ';'
FunctionDeclation = Export? _+ Type _+ Pointer? _+ Identfier _+ '('  VariableDeclaration* ')'
_+ '{' _+  Statements '}' _+ ';'

Type = BuiltinType / CustomType

BuiltinType = NativeType / EmulationType
NativeType = t:'i32' / 'i64' / 'f32' / 'f64'
EmulationType = t:'i8' / 'u8' / 'i16' / 'u16' / 'u32' / 'u64' / 'void' / 'bool'

CustomType = Identifier;

TypeDeclaration = CustomTypeDeclaration / TypeAliasDeclation
CustomTypeDeclaration = 'type'

Export = 'export';

__ = _+;
_ = [\r\n ];