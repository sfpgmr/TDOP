# The SGL2 Language Specification

(c) 2019 Satoshi Fujiwara

## Introduction
### Changes
### OverView
### Error Handling
### Typographical Conventions
### Compatibility
## Basics
### Logical Phases of Compilation
### Character Set
### Source Strings
### Version Declaration
### Preprocessor 
### Comments
### Tokens
### Keywords
### Identifiers
### Definitions
### Static Use
### Uniform and Non-Uniform Control Flow
### Dynamically Uniform Expressions
## Variables and Types
### Basic Types
#### Void
#### Booleans
#### Integers
#### Floats
#### Vectors
#### Matrices
#### Opaque Types
#####  Samplers
#### Structures
#### Arrays
#### Definitions of Terms
### Scoping
#### Definition of Terms
#### Types of Scope
#### Redeclaring Names
#### Global Scope
#### Shared Globals
### Storage Qualifiers
#### Default Storage Qualifier
#### Constant Qualifier
#### Constant Expressions
#### Input Variables
#### Uniform Variables
#### Output Variables
#### Interface Blocks
#### Layout Qualifiers
#####  Input Layout Qualifiers
#####  Output Layout Qualifiers
#####  Uniform Block Layout Qualifiers
#### Interpolation
#### Linking of Vertex Outputs and Fragment Inputs
### Parameter Qualifiers
### Precision and Precision Qualifiers
#### Range and Precision
#### Conversion between precisions
#### Precision Qualifiers
#### Default Precision Qualifiers
### Variance and the Invariant Qualifier
#### The Invariant Qualifier
#### Invariance Within a Shader
#### Invariance of Constant Expressions
#### Invariance of Undefined Values
### Order of Qualification
### Empty Declarations
## Operators and Expressions
### Operators
### Array Operations
### Function Calls
### Constructors
#### Conversion and Scalar Constructors
#### Vector and Matrix Constructors
#### Structure Constructors
#### Array Constructors
### Vector Components
### Matrix Components
### Structure and Array Operations
### Assignments
### Expressions
### Vector and Matrix Operations
### Evaluation of expressions
## Statements and Structure
### Function Definitions
#### Function Calling Conventions
### Selection
### Iteration
### Jumps
## Built-in Variables
### Vertex Shader Special Variables
### Fragment Shader Special Variables
### Built-In Constants
### Built-In Uniform State
## Built-in Functions
### Angle and Trigonometry Functions
### Exponential Functions
### Common Functions
### Floating-Point Pack and Unpack Functions
### Geometric Functions
### Matrix Functions
### Vector Relational Functions
### Texture Lookup Functions
### Fragment Processing Functions
## Shading Language Grammar
## Errors
### Preprocessor Errors
### Lexer/Parser Errors
### Semantic Errors
### Linker
## Counting of Inputs and Outputs
## Issues
### Compatibility with OpenGL ES 2.0
### Convergence with OpenGL
### Numeric Precision
### Floating Point Representation and Functionality
### Precision Qualifiers
### Function and Variable Name Spaces
### Local Function Declarations and Function Hiding
### Overloading main()
### Error Reporting
### Structure Declarations
### Embedded Structure Definitions
### Redefining Built-in Functions
### Global Scope
### Constant Expressions
### Varying Linkage
### gl_Position
### Preprocessor
### Character set
### Line Continuation
### Phases of Compilation
### Maximum Number of Varyings
### Array Declarations
### Invariance
### Invariance Within a shader
### While-loop Declarations
### Cross Linking Between Shaders
### Visibility of Declarations
### Language Version
### Samplers
### Dynamic Indexing
### Maximum Number of Texture Units
### On-target Error Reporting
### Rounding of Integer Division
### Undefined Return Values
### Precisions of Operations
### Compiler Transforms
### Expansion of Function-like Macros in the Preprocessor
### Should Extension Macros be Globally Defined?
### Minimum Requirements
### Packing Functions
### Boolean logical vector operations
### Range Checking of literals
### Sequence operator and constant expressions
### Version Directive
### Use of Unsigned Integers
### Vertex Attribute Aliasing
### Does a vertex input Y collide with a fragment uniform Y?
## Acknowledgments
## Normative References