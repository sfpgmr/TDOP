const types = [
  { type: 'i8', literalPrefix: '', literalSuffix: 's', size: 1, max: 127, min: -128, integer: true },
  { type: 'u8', literalPrefix: '', literalSuffix: 'su', size: 1, max: 255, min: 0, integer: true },
  { type: 'i16', literalPrefix: '', literalSuffix: 'w', size: 2, max: 32767, min: -32768, integer: true },
  { type: 'u16', literalPrefix: '', literalSuffix: 'wu', size: 2, max: 65535, min: 0, integer: true },
  { type: 'i32', literalPrefix: '', literalSuffix: '', size: 4, max: 0x7fffffff, min: -0x8000000, integer: true },
  { type: 'u32', literalPrefix: '', literalSuffix: 'u', size: 4, max: 0xffffffff, min: 0, integer: true },
  { type: 'f32', literalPrefix: '', literalSuffix: 'f', size: 4, max: 3.402823466e+38, min: 1.175494351e-38, integer: false },
  { type: 'f64', literalPrefix: '', literalSuffix: 'lf', size: 8, max: Number.MAX_VALUE, min: Number.MIN_VALUE, integer: false },
  { type: 'i64', literalPrefix: '', literalSuffix: 'l', size: 8, max: { low: 0xffffffff, high: 0x7fffffff }, min: { low: 0, high: 0x80000000 }, integer: true },
  { type: 'u64', literalPrefix: '', literalSuffix: 'lu', size: 8, max: { low: 0xffffffff, high: 0xffffffff }, min: { low: 0, high: 0 }, integer: true },
  // {type: 'string',literalPrefix: ['"',"'"],literalSuffix:['"',"'"]}
];

export const typeMap = new Map(types.map(d=>{
  return [d.type,d];
}));

export default types;
