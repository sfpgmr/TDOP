const types = [
  { type: 'i8', literalPrefix: '', literalSuffix: 's',size:1 },
  { type: 'u8', literalPrefix: '', literalSuffix: 'su',size:1 },
  { type: 'i16', literalPrefix: '', literalSuffix: 'w',size:2 },
  { type: 'u16', literalPrefix: '', literalSuffix: 'wu',size:2 },
  { type: 'i32', literalPrefix: '', literalSuffix: '',size:4 },
  { type: 'u32', literalPrefix: '', literalSuffix: 'u',size:4 },
  { type: 'f32', literalPrefix: '', literalSuffix: 'f',size:4 },
  { type: 'f64', literalPrefix: '', literalSuffix: 'lf',size:8 },
  { type: 'i64', literalPrefix: '', literalSuffix: 'l',size:8 },
  { type: 'u64', literalPrefix: '', literalSuffix: 'lu',size:8 },
  // {type: 'string',literalPrefix: ['"',"'"],literalSuffix:['"',"'"]}
];

export default types;
