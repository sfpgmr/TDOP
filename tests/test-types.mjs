const types = [
  { type: 'i32', literalPrefix: '', literalSuffix: '' },
  { type: 'u32', literalPrefix: '', literalSuffix: 'u' },
  { type: 'f32', literalPrefix: '', literalSuffix: 'f' },
  { type: 'f64', literalPrefix: '', literalSuffix: 'lf' },
  { type: 'i64', literalPrefix: '', literalSuffix: 'l', skip: true },
  { type: 'u64', literalPrefix: '', literalSuffix: 'lu', skip: true },
  // {type: 'string',literalPrefix: ['"',"'"],literalSuffix:['"',"'"]}
];

export default types;
