import * as compilerConstants from './compilerConstants.mjs';
import fs from 'fs';

const compilerWasmSrc = `
(module
  (export "i32tof32" (func $i32tof32))
  (export "i64tof64" (func $i64tof64))
  (export "i64Neg" (func $i64Neg))
  (memory $memory 1)
  (export "memory" (memory $memory))
  
  ;; IEE754 float32のビットパターンを持つ32ビット整数値をf32に変換する
  (func $i32tof32 (param $i i32) (param $minus i32) (result f32)
    (f32.reinterpret/i32
      (i32.xor
          (get_local $i)
          (get_local $minus)
      )
    )
  )

  ;; IEEE754 float64のビットパターンを持つ2つの32ビット値（high,low）を元にして、64bit floatを返す
  (func $i64tof64 (param $low i32) (param $high i32) (param $minus i32) (result f64)
    (f64.reinterpret/i64
      (i64.xor
        (i64.or
          (i64.shl 
            (i64.extend_u/i32 (get_local $high))
            (i64.const 32) 
          )
          (i64.extend_u/i32 (get_local $low))
        )
        (i64.shl
          (i64.extend_u/i32 (get_local $minus))
          (i64.const 32)
        )
      )
    )
  )

  ;; 整数値の2の補数をとる
  (func $i64Neg (param $low i32) (param $high i32)
    (i64.store
      (i32.const 0)
      (i64.add
        (i64.xor
          (i64.or 
            (i64.extend_u/i32 (get_local $low))
            (i64.shl 
              (i64.extend_u/i32 (get_local $high))
              (i64.const 32) 
            )
          )
          (i64.const 0xffffffffffffffff)
        )
        (i64.const 1)
      )
    )
  )
)
`;

function error(message, t = this) {
  t.name = 'Compiler Error';
  t.message = message;
  throw t;
}

export function getInstance(obj,imports = {}) {
  const bin = new WebAssembly.Module(obj);
  const inst = new WebAssembly.Instance(bin, imports);
  return inst;
}
let binaryen;

export default async function generateCode(ast, binaryen_) {
  let constant = false;
  if (!binaryen) {
    await new Promise((resolve, reject) => {
      binaryen = binaryen_({
        onRuntimeInitialized: m => {
          resolve();
        }
      });
    });
  }
  //debugger;
  // const binaryen = await new Promise(
  //   (resolve,reject)=>{
  //     b.then(function(bin) {
  //       resolve(bin);
  //     });
  //   });
  let module = new binaryen.Module();

//  const literalLib = getInstance(await fs.promises.readFile('./sgl2lib.wasm'));
  const literalLib = getInstance(binaryen.parseText(compilerWasmSrc).emitBinary()).exports;


  const i32_ = module.i32;

  // ビルトインタイプの追加定義情報をセットする
  [
    {type:'i8',alternativeType:'i32'},
    {type:'i16',alternativeType:'i32'},
    {type:'u8',alternativeType:'i32',unsigned:true},
    {type:'u16',alternativeType:'i32',unsigned:true},
    {type:'u32',alternativeType:'i32',unsigned:true},
    {type:'u64',alternativeType:'i64',unsigned:true},
  ].forEach(v=>{
    const t = ast.scope.find(v.type,true);
    t.alternativeType = ast.scope.find(v.alternativeType,true);
    t.unsigned = v.unsigned;
//    t.bitSize = bitSize;
  });

  //  const exp = new binaryen.Expression();

  module.setMemory(1,1);
  //module.addGlobal('t', binaryen.i32, true, module.i32.const(1));
  let localVars;
  let varIndex = 0;
  let postOpcodes;
  class PostOpCodes extends Array {
    constructor() {
      super();
    }
    create() {
      const current = new PostOpCodes();
      current.parent = this;
      postOpcodes = current;
    }
    pop() {
      if (this.parent) {
        postOpcodes = this.parent;
      }
      return this;
    }
  }
  postOpcodes = new PostOpCodes();
  let blockId = 0;
  let currentBrakePoint;
  //module.addMemoryImport('test','test','a');

  const statements = ast.statements;


  function generate(stmts) {
    const result = [];
    if (stmts instanceof Array) {
      stmts.forEach((stmt) => {
        const r = generate_(stmt);
        if (r instanceof Array) {
          result.push(...r);
        } else if (r) {
          result.push(r);
        }
        if (postOpcodes.length > 0) {
          result.push(...postOpcodes);
          postOpcodes.length = 0;
        }
      });
    } else {
      let ops = generate_(stmts);
      ops instanceof Array ? result.push(...ops) : (ops && result.push(ops));
      if (postOpcodes.length > 0) {
        result.push(...postOpcodes);
        postOpcodes.length = 0;
      }
    }
    return result;
  }

  function generate_(s) {
    //console.log('node type: ',!s,s.nodeType);
    switch (s.nodeType) {
      case 'define':
        return define(s);
      case 'function':
        return functionStatement(s);
      case 'unary':
        return expression(s);
      case 'binary':
        return expression(s);
      case 'statement':
        return statement(s);
      case 'block':
        return block(s);
      case 'call':
        return call(s);
      case 'name':
        return name(s);
      case 'literal':
        return literal(s);
      case 'suffix':
        return suffix(s);
      case 'class':
        return classDefinition(s);
      case 'type-alias':
        break;
      default:
        error('unrecognized nodetype', s);
        break;
    }
  }

  // class定義
  function classDefinition(stmt) {
    //return error('まだ実装されてません。',stmt);
  }

  // 関数呼び出し
  function call(stmt) {
    //debugger;
    const func = stmt.first;
    const params = stmt.second;
    return module.call(func.value, params.map(e => expression(e)), binaryen[stmt.type.value]);
  }

  // binaryen type情報の取得
  function getBinaryenType(type){
    return binaryen[type.value] || ((type.alternativeType) ? binaryen[type.alternativeType.value]:null);
  }

  // module type の取得
  function getModuleType(type){
    return module[type.value] || ((type.alternativeType) ? module[type.alternativeType.value]:null);
  }

  function getModuleTypeFromObj(obj){
    return getModuleType(getRealType(obj));
  }

  function getBinaryenTypeFromObj(obj){
    return getBinaryenType(getRealType(obj));
  }

  function getRealType(obj){
    let type = obj.type;
    if(obj.type.alias && !obj.typeRef.userType){
      type = obj.typeRef;
    }
    return type;
  }

  // 関数定義
  function functionStatement(funcNode) {
    //console.log('** defftypine_() **');
    // 関数本体
    const wasmStatement = [];

    // ローカル変数テーブル
    localVars = [];
    varIndex = 0;
    const paramTypes = [];
    const paramInits = [];

    // 関数名
    const funcName = funcNode.value;

    // 戻り値の型
    if(funcNode.export && funcNode.type.bitSize == 64 && funcNode.type.integer){
      error('export関数は、64bit整数の戻り値をサポートしていません。',funcNode);
    }

    let funcReturnType = getBinaryenTypeFromObj(funcNode);

    if (!funcReturnType) {
      // TODO: 戻り値がユーザー定義型だった場合どうする？
      error('不正な戻り値です。', funcNode);
    }


    // 関数パラメータ
    if (funcNode.params) {
      const funcParams = funcNode.params;
      funcParams.forEach(p => {
        paramInits.push(define_(p, null));

        let paramType = getBinaryenTypeFromObj(p);
        if (!paramType) {
          // TODO: 戻り値がユーザー定義型だった場合どうする？
          error('不正なパラメータです。', p);
        }
        paramTypes.push(paramType);
      });
    }
    const statements = generate(funcNode.statements);
    const ftype = module.addFunctionType(funcNode.value, funcReturnType, paramTypes);
    module.addFunction(funcNode.value, ftype, localVars, module.block(null, statements));
    if (funcNode.export) {
      module.addFunctionExport(funcNode.value, funcNode.value);
    }
  }

  // 変数定義
  const constants = new Map();

  function define_(d, vars = localVars) {
    //console.log('** define_() **');
    if(d.const){
      constants.set(d.value,expressionConstant(d.initialExpression));
      return null;
    } else {
      if (!d.userType || (d.typeRef && !d.typeRef.userType)) {
        if(!d.alias){// エイリアスではない。
          // WASM ネイティブ型
          // ローカル
          let varType = getBinaryenTypeFromObj(d);
          let varTypeObj = getModuleTypeFromObj(d);
          (!varType) && error('不正な型です。', d);

          switch (d.stored) {
            case compilerConstants.STORED_LOCAL:
              {
                vars && vars.push(varType);
                if (d.initialExpression) {
                  return module.setLocal(d.varIndex, expression(d.initialExpression));
                }
                return null;
              }
            case compilerConstants.STORED_GLOBAL:
              if (d.initialExpression) {
                return module.addGlobal(d.value, varType, true, expression(d.initialExpression));
              } else {
                return module.addGlobal(d.value, varType, true, varTypeObj.const(0));
              }
          }
        }
      } else {
        // ユーザー定義型かつ型エイリアスの元の型がユーザー定義型である
        const results = [];
        d.members && d.members.forEach(m => {
          const r = define(m);
          (r instanceof Array) ? results.push(...r) : (r && results.push(r));
        });
        return results;
      }
    }
  }

  // 変数定義
  function define(statement, results = []) {
    //console.log('** define() **');
    // statement.first.forEach(d => {
    //   const result = define_(d);
    //   if(result instanceof Array){
    //     results.push(...result);
    //   } else {
    //     results.push(result);
    //   }
    // });
    const result = define_(statement);
    if (result instanceof Array) {
      results.push(...result);
    } else if (result) {
      results.push(result);
    }
    return results;
  }


  // 式
  function expression(e) {
    switch (e.nodeType) {
      case 'literal':
        return literal(e,false);
      case 'binary':
        return binary(e);
      case 'unary':
        return unary(e);
      case 'name':
        return name(e);
      case 'call':
        return call(e);
      case 'suffix':
        return suffix(e);
      case 'reference':
      case 'define':
        return name(e);
      case 'const':
        return getConstant(e);
      case 'cast':
        return cast(e);
      case 'sizeof':
        return sizeof(e);
    }
  }

  function sizeof(e){
    const v = e.first;
    if(v.id == 'type'){
      return module.i32.const(v.size);
    } else {
      if(v.type){
        let typeinfo = v.type;
        if(typeinfo){
          return module.i32.const(typeinfo.size);
        } else {
          error('sizeof',e);
        }
      } else {
        error('sizeof',e);
      }
    }
  }

  function getConstant(e){
    let c = constants.get(e.value);
    if(c) return c;
    throw error('不正な定数を参照しました。',e);
  }
  //const memForConstants = new WebAssembly.Memory({initial:1,maximum:1});

  function expressionConstant(e)
  {
    let backup = module;
    let constantBackup = constant;
    constant = true;
    module = new binaryen.Module();
    module.setMemory(1,1,'output');
    //module.addMemoryExport('0','output');
    //module.addMemoryImport('0','js','mem');
    const ftype = module.addFunctionType('m',binaryen.none);
    let stmt;
    switch(e.type.value){
      case 'i8':
      case 'u8':
        stmt = module.i32.store8(0,0,module.i32.const(0),expression(e));
        break;
      case 'i16':
      case 'u16':
        stmt = module.i32.store16(0,0,module.i32.const(0),expression(e));
        break;
      case 'i32':
      case 'u32':
        stmt = module.i32.store(0,4,module.i32.const(0),expression(e));
        break;
      case 'i64':
      case 'u64':
        stmt = module.i64.store(0,8,module.i32.const(0),expression(e));
        break;
      case 'f32':
        stmt = module.f32.store(0,4,module.i32.const(0),expression(e));
        break;
      case 'f64':
        stmt = module.f64.store(0,8,module.i32.const(0),expression(e));
        break;
      default:
        error('定数式で処理できない型です。',e);
    }

    module.addFunction('m',ftype,[],stmt);
    module.addFunctionExport('m','m');

    let wasmInstance = getInstance(module.emitBinary()/*,{js:{mem:memForConstants}}*/);
    let instruction;
    wasmInstance.exports.m();
    const mem = new DataView(wasmInstance.exports.output.buffer);
    switch(e.type.value){
      case 'i8':
        instruction = (()=> { const v = mem.getInt8(0); return ()=>module.i32.const(v);})();
        break;
      case 'u8':
        instruction = (()=> { const v = mem.getUint8(0); return ()=>module.i32.const(v);})();
        break;
      case 'i16':
        instruction = (()=> { const v = mem.getInt16(0,true); return ()=>module.i32.const(v);})();
        break;
      case 'u16':
        instruction = (()=> { const v = mem.getUint16(0,true); return ()=>module.i32.const(v);})();
        break;
      case 'i32':
        instruction = (()=> { const v = mem.getInt32(0,true); return ()=>module.i32.const(v);})();
        //instruction = module.i32.const(mem.getInt32(0,true));
        break;
      case 'u32':
        instruction = (()=> { const v = mem.getUint32(0,true); return ()=>module.i32.const(v);})();
        //instruction = module.i32.const(mem.getUint32(0,true));
        break;
      case 'i64':
      case 'u64':
        instruction = (()=> { const l = mem.getUint32(0,true),h = mem.getUint32(4,true); return ()=>module.i64.const(l,h);})();
        //instruction = module.i64.const(mem.getUint32(0,true),mem.getUint32(4,true));
        break;
      case 'f32':
        instruction = (()=> { const v = mem.getFloat32(0,true); return ()=>module.f32.const(v);})();
        //instruction = module.f32.const(mem.getFloat32(0,true));
        break;
      case 'f64':
        instruction = (()=> { const v = mem.getFloat64(0,true); return ()=>module.f64.const(v);})();
        //instruction = module.f64.const(mem.getFloat64(0,true));
        break;
      default:
        error('不正な型です。',e);
        break;
    }
    module.dispose();
    module = backup;
    constant = constantBackup;
    return instruction;
  }

  // キャスト
  const castOp_i8 = {
    'i8':'nop',
    'u8':'nop',
    'i16':'nop',
    'u16':'nop',
    'i32':'nop',
    'u32':'nop',
    'i64':module.i32.wrap,
    'u64':module.i32.wrap,
    'f32':module.i32.trunc_s.f32,
    'f64':module.i32.trunc_s.f64
  };

  const castOp_u8 = {
    'i8':'nop',
    'u8':'nop',
    'i16':'nop',
    'u16':'nop',
    'i32':'nop',
    'u32':'nop',
    'i64':module.i32.wrap,
    'u64':module.i32.wrap,
    'f32':module.i32.trunc_u.f32,
    'f64':module.i32.trunc_u.f64
  };

  const castOps = {
    'i8':castOp_i8,
    'u8':castOp_u8,
    'i16':castOp_i8,
    'u16':castOp_u8,
    'i32': {
      'i8':'nop',
      'u8':'nop',
      'i16':'nop',
      'u16':'nop',
      'i32':'nop',
      'u32':'nop',
      'i64':module.i32.wrap,
      'u64':module.i32.wrap,
      'f32':module.i32.trunc_s.f32,
      'f64':module.i32.trunc_s.f64
    },
    'u32': {
      'i8':'nop',
      'u8':'nop',
      'i16':'nop',
      'u16':'nop',
      'i32':'nop',
      'u32':'nop',
      'i64':module.i32.wrap,
      'u64':module.i32.wrap,
      'f32':module.i32.trunc_u.f32,
      'f64':module.i32.trunc_u.f64
    },
    'i64': {
      'i8':module.i64.extend_s,
      'u8':module.i64.extend_s,
      'i16':module.i64.extend_s,
      'u16':module.i64.extend_s,
      'i32':module.i64.extend_s,
      'u32':module.i64.extend_s,
      'i64':'nop',
      'u64':'nop',
      'f32':module.i64.trunc_s.f32,
      'f64':module.i64.trunc_s.f64
    },
    'u64': {
      'i8':module.i64.extend_u,
      'u8':module.i64.extend_u,
      'i16':module.i64.extend_u,
      'u16':module.i64.extend_u,
      'i32':module.i64.extend_u,
      'u32':module.i64.extend_u,
      'i64':'nop',
      'u64':'nop',
      'f32':module.i64.trunc_u.f32,
      'f64':module.i64.trunc_u.f64
    },
    'f32': {
      'i8':module.f32.convert_s.i32,
      'u8':module.f32.convert_u.i32,
      'i16':module.f32.convert_s.i32,
      'u16':module.f32.convert_u.i32,
      'i32':module.f32.convert_s.i32,
      'u32':module.f32.convert_u.i32,
      'i64':module.f32.convert_s.i64,
      'u64':module.f32.convert_u.i64,
      'f32':'nop',
      'f64':module.f32.demote
    },
    'f64': {
      'i8':module.f64.convert_s.i32,
      'u8':module.f64.convert_u.i32,
      'i16':module.f64.convert_s.i32,
      'u16':module.f64.convert_u.i32,
      'i32':module.f64.convert_s.i32,
      'u32':module.f64.convert_u.i32,
      'i64':module.f64.convert_s.i64,
      'u64':module.f64.convert_u.i64,
      'f32':module.f64.promote,
      'f64':'nop'
    }
  };

  const reinterpretCastOps = {
    'i8':{
      'f32':module.i32.reinterpret
    },
    'u8':{
      'f32':module.i32.reinterpret
    },
    'i16':{
      'f32':module.i32.reinterpret
    },
    'u16':{
      'f32':module.i32.reinterpret
    },
    'i32':{
      'f32':module.i32.reinterpret
    },
    'u32':{
      'f32':module.i32.reinterpret
    },
    'i64':{
      'f64':module.i64.reinterpret
    },
    'u64':{
      'f64':module.i64.reinterpret
    },
    'f32':{
      'i32':module.f32.reinterpret,
      'u32':module.f32.reinterpret
    },
    'f64':{
      'i64':module.f64.reinterpret,
      'u64':module.f64.reinterpret
    }
  };

  const pointerCasts = {
    'i8':module.i32.load8_s,
    'u8':module.i32.load8_u,
    'i16':module.i32.load16_s,
    'u16':module.i32.load16_u,
    'i32':module.i32.load,
    'u32':module.i32.load,
    'i64':module.i64.load,
    'u64':module.i64.load,
    'f32':module.f32.load,
    'f64':module.f64.load,
  }

  function cast(e){
    if(e.first.nodeType == 'unary' && e.first.value == '*'){
      // 直下がポインタである場合
      return pointer(e.first);
    } else {
      // それ以外
      const castOps_ = e.reinterpret ? reinterpretCastOps : castOps;
      let castOp = castOps_[e.type.value];
      castOp && (castOp = castOp[e.first.type.value]);
      if(castOp && castOp != 'nop'){
        return castOp(expression(e.first));
      } else if(castOp == 'nop'){
        return expression(e.first);
      }
      if(!castOp){
        error(`キャストができない型です。${e.type.value}`,e);
      }
    }
  };

  function parseInt32(e, minus = false) {
    let retVal = 0;
    switch (e.kind) {
      case 'hex':
        retVal = parseInt(e.value.substr(2, e.value.length - 2), 16) * (minus ? -1 : 1);
        break;
      case 'binary':
        retVal = parseInt(e.value.substr(2, e.value.length - 2), 2) * (minus ? -1 : 1);
        break;
      default:
        retVal = parseInt(e.value, 10) * (minus ? -1 : 1);
    }
    return module.i32.const(retVal);
  }

  /**
 * 整数値をを64ビットの16進数文字列に変換するコード
 */

  // 整数は文字列の形で指定
  //let numString = '-9223372036854775807';
  //let numString = '9223372036854775809';
  function decimalToHex(numString) {
    let numArray = [];
    let minus = false;
    // 数値文字列を分割して配列に保存する
    {
      let i = 0;
      for (const c of numString) {
        if (c == '-') {
          if (i == 0) {
            minus = true;
          } else {
            throw new Error(`不正な文字:${c}`);
          }
        } else {
          if (isNaN(c)) {
            throw new Error(`不正な文字:${c}`);
          }
          numArray.push(parseInt(c, 10));
        }
        ++i;
      }
    }

    // 変換結果を収める
    let hex = [];
    let b = 0;
    let ans = [];
    let remind = 0;

    while (numArray.length > 0 || b > 15) {
      b = 0;
      ans = [];
      remind = 0;
      numArray.forEach(num => {
        b = b * 10 + num;
        if (b > 15) {
          remind = b & 0b1111;
          ans.push(b >> 4);
          b = remind;
        } else {
          ans.push(0 | 0);
          remind = b;
        }
      })

      // 頭の0をとる
      let i = 0;
      while (ans[i] == 0) {
        ++i;
      }
      numArray = ans.slice(i);
      hex.unshift(remind);
    }

    if (hex.length > 16) {
      throw new Error('64bit整数の範囲を超えています。');
    }

    // 桁揃え（16桁に）
    if (hex.length < 16) {
      let l = 16 - hex.length;
      while (l > 0) {
        hex.unshift(0);
        --l;
      }
    }

    // マイナス値の処理
    if (minus) {
      hex = hex.map(d => d ^ 0xf);
      hex[15] += 1;
      if (hex[15] > 15) {
        hex[15] = 0;
        for (let i = 14; i >= 0; --i) {
          hex[i] += 1;
          if (hex[i] < 16) {
            break;
          } else {
            hex[i] = 0;
          }
        }
      }
      hex[0] |= 0b1000;//sign bitを立てる 
    }
    return hex.map(d => d.toString(16)).join('').padStart(16, '0');
  }

  function parseInt64(e, minus = false) {
    let low, high;
    switch (e.kind) {
      case 'hex':
        {
          const hex = e.value.substr(2).padStart(16, '0');
          high = parseInt(hex.substr(0, 8), 16);
          low = parseInt(hex.slice(-8), 16);
        }
        break;
      case 'binary':
        {
          const bin = e.value.substr(2).padStart(64, '0');
          high = parseInt(bin.substr(0, 32), 2);
          low = parseInt(bin.slice(-32), 2);
        }
        break;
      default:
        {
          const hex = decimalToHex(e.value, minus);
          high = parseInt(hex.substr(0, 8), 16);
          low = parseInt(hex.slice(-8), 16);
        }
    }
    if (minus) {
      low = ((low ^ 0xffffffff) + 1) & 0xffffffff;
      high = ((high ^ 0xffffffff) + ((low == 0) ? 1 : 0));
    }
    return module.i64.const(low, high);
  }


  function intToFloat32(intVal, minus) {
    return literalLib.i32tof32(intVal, minus ? 0x80000000 : 0);
  }

  function parseFloat32(e, minus = false) {
    let retVal = 0;
    switch (e.kind) {
      case 'hex':
        {
          retVal = intToFloat32(parseInt(e.value.substr(2), 16), minus);
          //retVal = intToFloat32(parseInt(e.value.substr(2),16),minus);
          break;
        }
      case 'binary':
        {
          retVal = intToFloat32(parseInt(e.value.substr(2), 2), minus);
          break;
        }
      default:
        retVal = parseFloat(e.value, 10) * (minus ? -1 : 1);
    }
    return module.f32.const(retVal);
  }


  function intToFloat64(low, high, minus) {
    return literalLib.i64tof64(low, high, minus ? 0x80000000 : 0);
  }

  function parseFloat64(e, minus = false) {
    let retVal = 0;
    switch (e.kind) {
      case 'hex':
        {
          let value = e.value.substr(2).padStart(16, '0');
          let low = parseInt(value.slice(-8), 16);
          let high = parseInt(value.substr(0, 8), 16);
          retVal = intToFloat64(low, high, minus);
          break;
        }
      case 'binary':
        {
          let value = e.value.substr(2).padStart(64, '0');
          let low = parseInt(value.slice(-32), 2);
          let high = parseInt(value.substr(0, 32), 2);
          retVal = intToFloat64(low, high, minus);
          break;
        }
      default:
        retVal = parseFloat(e.value) * (minus ? -1 : 1);
    }
    return module.f64.const(retVal);
  }

  function literal(e, minus = false) {
    //console.log('** literal() **');
    switch (e.type.value) {
      case 'i8':
      case 'u8':
      case 'i16':
      case 'u16':
      case 'i32':
      case 'u32':
        return parseInt32(e, minus);
      case 'i64':
      case 'u64':
        return parseInt64(e, minus);
      case 'f32':
        return parseFloat32(e, minus);
      case 'f64':
        return parseFloat64(e, minus);
    }
    error('Bad Type', e);
  }


  function binary(e) {
    //console.log('** binary() **');
    switch (e.value) {
      // 代入
      case '=':
        return assignment(e);
      case '+':
        return binOp('add', e);
      case '-':
        return binOp('sub', e);
      case '*':
        return binOp('mul', e);
      case '%':
        return binOp('rem', e, true);
      case '/':
        return binOp('div', e, true);
      case '+=':
        return setValue(e.first, binOp('add', e), e);
      case '-=':
        return setValue(e.first, binOp('sub', e), e);
      case '*=':
        return setValue(e.first, binOp('mul', e), e);
      case '/=':
        return setValue(e.first, binOp('div', e, true), e);
      case '%=':
        return setValue(e.first, binOp('rem', e, true), e);
      // 比較
      case '==':
        return binOp('eq', e);
      case '>':
        return binOp('gt', e, true);
      case '>=':
        return binOp('ge', e, true);
      case '<':
        return binOp('lt', e, true);
      case '<=':
        return binOp('le', e, true);
      case '!=':
        return binOp('ne', e);
      // 論理
      case '&&':
        return logicalAnd(e);
      case '||':
        return logicalOr(e);
      // ビット演算
      case '^':
        return binOp('xor', e);
      case '&':
        return binOp('and', e);
      case '|':
        return binOp('or', e);
      case '<<':
        return binOp('shl', e);
      case '>>':
        return binOp('shr', e, true);
      case '>>>':
        return binOp('shr', e, false);
      case '<<&':
        return binOp('rotl', e);
      case '>>&':
        return binOp('rotr', e);
      // ドット演算子
      case '.':
        return dotOp(e);
      case '[':
        return array(e);
    }
    error('Bad Binary Operator', e);
  }

  function array(e){
    const type = e.type.value;
    switch (type) {
      case 'i8':
        return module.i32.load8_s(0,0,module.i32.add(expression(e.first),expression(e.second)));
      case 'u8':
        return module.i32.load8_u(0,0,module.i32.add(expression(e.first),expression(e.second)));
      case 'i16':
        return module.i32.load16_s(0,0,module.i32.add(expression(e.first),expression(e.second)));
      case 'u16':
        return module.i32.load16_u(0,0,module.i32.add(expression(e.first),expression(e.second)));
      case 'i32':
      case 'u32':
        return module.i32.load(0,4,module.i32.add(expression(e.first),expression(e.second)));
      case 'i64':
      case 'u64':
        return module.i64.load(0,8,module.i32.add(expression(e.first),expression(e.second)));
      case 'f32':
        return module.f32.load(0,4,module.i32.add(expression(e.first),expression(e.second)));
      case 'f64':
        return module.f64.load(0,8,module.i32.add(expression(e.first),expression(e.second)));
      default:
        error('まだ実装できてません。。',e);
    }
  }

  function getRealVar(n){
    if(n.alias){
      return getRealVar(n.alias);
    }
    return n;
  }

  function setValue(n_, v, e) {
    const rvalue = n_.rvalue;
    const n = getRealVar(n_);
    //console.log('** setValue() **');
    !e && (e = n);
    if (rvalue) {
      // 式が右辺値である。
      switch (n.stored) {
        case compilerConstants.STORED_LOCAL:
          return module.teeLocal(n.varIndex, v);
        case compilerConstants.STORED_GLOBAL:
          return module.block(null, [
            module.setGlobal(n.value, v),
            module.getGlobal(n.value, n.type.value)
          ]);
      }
    } else {
      return (n.stored == compilerConstants.STORED_LOCAL) ? module.setLocal(n.varIndex, v) : module.setGlobal(n.value, v);// ** マングル化が必要 ***
    }
  }

  function getValue(e) {
    //console.log('** getValue() **');
    const n = e.first;
    return (n.stored == compilerConstants.STORED_LOCAL) ? module.getLocal(n.varIndex, n.type.value) : module.getGlobal(n.value, n.type.value);
  }


  function binOp_(name, e, left, right, sign) {
    const t = getModuleTypeFromObj(left);
    if (t) {
      const type = getRealType(left);
      switch (type.value) {
        case 'i8':
        case 'u8':
        case 'i16':
        case 'u16':
        case 'i32':
        case 'u32':
        case 'i64':
        case 'u64':
          {
            let op = t[name];
            (!op) && (op = t[sign ? name + '_s' : name + '_u']);

            if (op) {
              return op(expression(left), expression(right));
            } else {
              error('Bad Operation', left);
            }
            break;
          }
        case 'f32':
        case 'f64':
          {
            let op = t[name];
            (!op) && (op = t[sign ? name + '_s' : name + '_u']);
            if (op) {
              return op(expression(left), expression(right));
            } else {
              error('Bad Operation', left);
            }
          }
          break;
      }
    } else {
      const l = expression(left);
      const r = expression(right);
      let op = getModuleTypeFromObj(left)[name];
      (!op) && (op = getModuleTypeFromObj(left)[sign ? name + '_s' : name + '_u']);

      if ((typeof l != 'number') || (typeof r != 'number')) {
        error('Bad Expression', left);
      }
      return op(l, r);
    }
  }

  function binOp(name, e, sign = false) {
    //console.log(`** binOp(${name}) **`);

    //debugger;
    const left = e.first, right = e.second;
    left.sign && (sign = left.sign);
    return binOp_(name, e, left, right, sign);
  }

  function dotOp(e) {
    //console.log('** dotOp() **');

    if (e.second.id == '.') {
      const ret = dotOp(e.second);
      e.type = ret.type;
      return ret;
    }
    e.type = e.second.type;
    return name(e.second);
  }

  function logicalAnd(e) {
    const left = e.first, right = e.second;
    return i32_.and(i32_.ne(expression(left), i32_.const(0, 0)), i32_.ne(expression(right), i32_.const(0, 0)));
  }


  function logicalOr(e) {
    const left = e.first, right = e.second;
    return i32_.or(i32_.ne(expression(left), i32_.const(0)), i32_.ne(expression(right), i32_.const(0)));
  }

  function unary(e) {
    switch (e.value) {
      case '+':
        return expression(e.first);
      case '-':
        return neg(e.first);
      case '!':
        return not(e.first);
      case '~':
        return bitNot(e.first);
      case '++':
        return inc(e.first);
      case '--':
        return dec(e.first);
      case '*':
        return pointer(e);
    }
  }

  function pointer(e,castType) {
    const type = castType || getRealType(e);
    switch (type.value) {
      case 'i8':
        return module[type.alternativeType.value].load8_s(0,0,expression(e.first));
      case 'u8':
        return module[type.alternativeType.value].load8_u(0,0,expression(e.first));
      case 'i16':
        return module[type.alternativeType.value].load16_s(0,0,expression(e.first));
      case 'u16':
        return module[type.alternativeType.value].load16_u(0,0,expression(e.first));
      case 'i32':
      case 'u32':
        return module.i32.load(0,4,expression(e.first));
      case 'i64':
      case 'u64':
        return module.i64.load(0,8,expression(e.first));
      case 'f32':
        return module.f32.load(0,4,expression(e.first));
      case 'f64':
        return module.f64.load(0,8,expression(e.first));
      default:
        error('まだ実装できてません。。',e);
    }
  }

  function neg(left) {
    if (left.nodeType == 'literal') {
      return literal(left, true);
    }
    
    const type = getRealType(left);
    switch (type.value) {
      case 'i8':
      case 'u8':
      case 'i16':
      case 'u16':
      case 'i32':
      case 'u32':
        return module.i32.sub(module.i32.const(0), expression(left));
      case 'i64':
      case 'u64':
        return module.i64.sub(module.i64.const(0, 0), expression(left));
      case 'f32':
      case 'f64':
        return module[left.type.value].neg(expression(left));
    }
  }

  function not(left) {
    return i32_.eqz(expression(left));
  }

  function bitNot(left) {
    const type = getRealType(left);
    switch (type.value) {
      case 'i8':
      case 'u8':
      case 'i16':
      case 'u16':
      case 'i32':
      
      case 'u32':
        return module.i32.xor(expression(left), module.i32.const(0xffffffff));
      case 'i64':
      case 'u64':
        return module.i64.xor(expression(left), module.i64.const(0xffffffff, 0xffffffff));
      default:
        return error('Bad Operation', left);
    }
  }

  function inc(left) {
    const builtinType = getModuleTypeFromObj(left);
    if (builtinType) {
      return setValue(left, builtinType.add(expression(left), builtinType.const(1)));
    } else
    {
      error('Bad Type', left);
    }
  }

  function dec(left) {
    const builtinType = getModuleTypeFromObj(left);
    if (builtinType) {
      return setValue(left, builtinType.sub(expression(left), builtinType.const(1)));
    } else {
      error('Bad Type', left);
    }
  }

  function name(exp) {
    let e = exp;

    if(constant && (!e.const)){
      error('定数式では使用できません',e);
    }

    if(e.const){
      let constant = constants.get(e.value);
      if(constant) return constant();
      error('この定数は定義されていません。',e);
    }

    // 変数エイリアスの場合
    if(e.alias){
      // 変数はe.aliasが指す変数のこと
      // e.alias自体がaliasの可能性もあるため、name()を再起呼び出しする
      return name(e.alias);
    }

    //console.log('** name() **');
    const builtinType = getModuleTypeFromObj(e);
    if (builtinType) {
      switch (e.stored) {
        case compilerConstants.STORED_LOCAL:
          return module.getLocal(e.varIndex, getBinaryenTypeFromObj(e));
        case compilerConstants.STORED_GLOBAL:
          return module.getGlobal(e.value, getBinaryenTypeFromObj(e));
      }
    } else {
      return e.scope.find(e.value);
    }
  }

  // 左辺のドット構文の解析
  function leftDotOp(e) {
    if (e.second.id == '.') {
      const ret = leftDotOp(e.second);
      e.type = ret.type;
      return ret;
    }
    e.type = e.second.type;
    return e.second;
  }

  function getStoreOp(moduleType,targetType){
    switch(targetType.value){
      case 'i8':
      case 'u8':
        return moduleType.store8;
      case 'i16':
      case 'u16':
        return moduleType.store16;
      default:
        return moduleType.store;
    }    
  }

  // 代入 // 
  function assignment(e, results = [], top = true) {
    //console.log('** assignment() **');
    const left = e.first, right = e.second;

    if (left.value == '.') {
      // ユーザー定義型のメンバー
      const l = leftDotOp(left);
      if (getModuleTypeFromObj(l)) {
        const op = setValue(l, expression(right));
        if (top) {
          if (results.length > 0) {
            results.push(op);
            return module.block(null, results);
          } else {
            return op;
          }
        } else {
          results.push(op);
        }
      } else {
        let m = Object.assign(Object.create(e), e);
        m.type = l.type;
        assignment(m, results, false);
      }
    } else if (left.members) {
      // ユーザー定義型
      const leftMembers = left.members;
      const rightMembers = right.members;
      leftMembers.forEach((leftMember, i) => {
        const memberAssignmment = Object.assign(Object.create(e), e);
        memberAssignmment.first = leftMember;
        memberAssignmment.second = rightMembers[i];
        e.type = leftMember.type;
        assignment(memberAssignmment, results, false);
      });
    } else if(left.value == '*'){
      // ポインタ
      let type = getModuleTypeFromObj(right);
      if (!type) {
          error('不正な代入', e);
      }
      let storeOp = getStoreOp(type,right.type);
      results.push(storeOp(0,0,expression(left.first),expression(right)));
    } else if(left.value == '['){
      let type = getModuleTypeFromObj(right);
      if (!type) {
          error('不正な代入', e);
      }
      let storeOp = getStoreOp(type,right.type);
      results.push(storeOp(0,0,module.i32.add(expression(left.first),expression(left.second)),expression(right)));
    } else {
      if (left.type.value != right.type.value) {
        error('不正な代入：左辺と右辺の型が違います', e);
      }
      let type = getModuleTypeFromObj(left);
      if (!type) {
          error('不正な代入', e);
      }
      results.push(setValue(left, expression(right)));
    }

    if (top) {
      return results.length == 1 ? results[0] : module.block(null, results);
    }
  }

  function block(s) {
    //console.log('** block() **');
    let temp = generate(s.first);
    !(temp instanceof Array) && (temp = [temp]);
    return module.block(null, temp);
  }

  function statement(s) {
    //console.log('** statement() **');

    switch (s.id) {
      case 'return':
        return module.return(expression(s.first));
      case 'if':
        return ifStatement(s);
      case 'while':
        return whileStatement(s);
      case 'do':
        return doStatement(s);
      case 'break':
        return breakStatement(s);
      case 'for':
        return forStatement(s);
      default:
        error('Bad Statement.', s);
    }
  }

  function breakStatement(s) {
    return module.break(currentBrakePoint);
  }

  function ifStatement(s) {
    postOpcodes.create();
    const condition = expression(s.first);
    let ops = postOpcodes.pop();
    let thenStatemnts = generate(s.second)[0];
    if (ops.length) {
      thenStatemnts = module.block(null, ops.concat(thenStatemnts));
    }
    let elseStatements = s.third && generate(s.third)[0];
    if (ops.length && elseStatements) {
      elseStatements = module.block(null, ops.concat(elseStatements));
    }
    return module.if(condition, thenStatemnts, elseStatements);
  }

  function not_(c) {
    return module.i32.eqz(expression(c));
    // let condition = expression(c);

    // let type = module[c.type];
    // if(type){
    //   if(type.eqz){
    //     condition = type.eqz(condition);
    //   } else {
    //     switch(c.type){
    //     case 'f32':
    //       condition = module.i32.eq(module.f32.reinterpret(condition),module.i32.const(0x80000000));
    //       break;
    //     case 'f64':
    //       condition = module.i64.eq(module.f64.reinterpret(condition),module.i64.const(0,0x80000000));
    //       break;
    //     default:
    //       error('Bad.Type',c);
    //     }
    //   }
    // } else {
    //   switch(c){
    //   case 'u32':
    //   case 'u64':
    //     {
    //       type = module['i' + c.type.slice(-2)];
    //       condition = type.eqz(condition);
    //     }
    //     break;
    //   default:
    //     error('Bad Type',c);
    //   }
    // }
    // return condition;  
  }

  function whileStatement(s) {
    const bid = 'while' + (blockId++).toString(10);
    currentBrakePoint = bid;
    const lid = 'loop' + (blockId++).toString(10);
    let stmt = generate(s.second);
    stmt = stmt instanceof Array ? stmt : [stmt];

    postOpcodes.create();
    let condition = not_(s.first);
    let ops = postOpcodes.pop();
    return module.block(null, [module.block(bid, [
      module.loop(lid, module.block(null, [
        module.br_if(bid, condition),
        ...ops,
        ...stmt,
        module.break(lid)
      ]))]), ...ops
    ]);
  }

  function doStatement(s) {
    const bid = 'do' + (blockId++).toString(10);
    currentBrakePoint = bid;
    const lid = 'loop' + (blockId++).toString(10);
    let stmt = generate(s.second);
    stmt = stmt instanceof Array ? stmt : [stmt];

    postOpcodes.create();
    let condition = not_(s.first);
    let postOps = postOpcodes.pop();

    return module.block(null, [module.block(bid, [
      module.loop(lid, module.block(null, [
        ...stmt,
        module.br_if(bid, condition),
        ...postOps,
        module.break(lid)
      ]))]), ...postOps
    ]);
  }

  function forStatement(s) {

    const bid = 'for' + (blockId++).toString(10);
    currentBrakePoint = bid;
    const lid = 'loop' + (blockId++).toString(10);

    let initStmt = generate(s.first);

    postOpcodes.create();
    let condition = not_(s.second);
    let postOpsCond = postOpcodes.pop();

    postOpcodes.create();
    let conditionAfter = expression(s.third);
    let postOpsAfter = postOpcodes.pop();

    let stmt = generate(s.fourth);

    initStmt = initStmt instanceof Array ? initStmt : [initStmt];
    conditionAfter = conditionAfter instanceof Array ? conditionAfter : [conditionAfter];
    stmt = stmt instanceof Array ? stmt : [stmt];

    return module.block(null, [module.block(bid, [
      ...initStmt,
      module.loop(lid, module.block(null, [
        module.br_if(bid, condition),
        ...postOpsCond,
        ...stmt,
        ...conditionAfter,
        ...postOpsAfter,
        module.break(lid)
      ]))]),
    ...postOpsCond,
    ...postOpsAfter
    ]);

  }

  function suffix(s) {
    switch (s.id) {
      case '++':
        return postInc(s);
      case '--':
        return postDec(s);
      default:
        error('Bad Operator', s);
    }
  }

  function postInc(s) {
    s.first.rvalue = false;
    if (s.rvalue) {
      postOpcodes.push(inc(s.first));
      return name(s.first);
    } else {
      return inc(s.first);
    }
  }

  function postDec(s) {
    s.first.rvalue = false;
    if (s.rvalue) {
      postOpcodes.push(dec(s.first));
      return name(s.first);
    } else {
      return dec(s.first);
    }
  }

  generate(statements);

  return module;

}
