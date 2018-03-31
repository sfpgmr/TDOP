import binaryen from 'binaryen';
import tokenize from './tokens.mjs';
import make_parse from './parse.mjs';
import fs from 'fs';

const testSrc = 
`
var a = 1;
var b =1;
`;

const tokens = tokenize(testSrc);
const parse = make_parse();
const ast = parse(tokens);
const json = JSON.stringify(ast, ['key', 'name', 'message',
'value', 'arity', 'first', 'second', 'third', 'fourth'], 4);

fs.writeFileSync('./ast.json',json,'utf8');