import * as constants from './compilerConstants.mjs';

const compilerWasmSrc = `
(module
  (export "i32tof32" $i32tof32)
  (export "i64tof64" $i64tof64)
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
            (i64.extend_u(get_local $high))
            (i64.const 32) 
          )
          (i64.extend_u (get_local $low))
        )
        (i64.shl
          (i64.extend_u(get_local $minus))
          (i64.const 32)
        )
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

export function getInstance(obj){
  const bin = new WebAssembly.Module(obj);
  const inst = new WebAssembly.Instance(bin,{});
  return inst;
}
let binaryen;

export default async function generateCode(ast, binaryen_) {

  if (!binaryen) {
    await new Promise((resolve, reject) => {
      binaryen = binaryen_({
        onRuntimeInitialized: m => {
          resolve();
        }
      });
    });
  }
  // debugger;
  // const binaryen = await new Promise(
  //   (resolve,reject)=>{
  //     b.then(function(bin) {
  //       resolve(bin);
  //     });
  //   });
  const module = new binaryen.Module();
  const literalLib = getInstance(binaryen.parseText(compilerWasmSrc).emitBinary()).exports;


  const i32_ = module.i32;


  //  const exp = new binaryen.Expression();

  //module.setMemory(1, null, 'test1');
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
      default:
        error('unrecognized nodetype', s);
        break;
    }
  }

  function classDefinition(stmt) {
    return null;
  }

  // 関数呼び出し
  function call(stmt) {
    //debugger;
    const func = stmt.first;
    const params = stmt.second;
    return module.call(func.value, params.map(e => expression(e)), binaryen[stmt.type]);
  }

  // 関数定義
  function functionStatement(funcNode) {
    //console.log('** define_() **');
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
    let funcReturnType = binaryen[funcNode.type];

    if (!funcReturnType) {
      switch (funcNode.type) {
        case 'u32':
        case 'u64':
          const realType = 'i' + funcNode.type.slice(-2);
          funcReturnType = binaryen[realType];
          break;
        default:
          // TODO: 戻り値がユーザー定義型だった場合どうする？
          error('Bad Return Type', funcNode);
      }
    }


    // 関数パラメータ
    if (funcNode.params) {
      const funcParams = funcNode.params;
      funcParams.forEach(p => {
        paramInits.push(define_(p, null));

        let paramType = binaryen[p.type];
        if (!paramType) {
          switch (p.type) {
            case 'u32':
            case 'u64':
              const realType = 'i' + p.type.slice(-2);
              paramType = binaryen[realType];
              break;
            default:
              // TODO: 戻り値がユーザー定義型だった場合どうする？
              error('Bad Parameter Type', p);
          }
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
  function define_(d, vars = localVars) {
    //console.log('** define_() **');
    if (!d.userType) {
      // WASM ネイティブ型
      // ローカル
      let varType = binaryen[d.type];
      let varTypeObj = module[d.type];
      if (!varType) {
        const t = 'i' + d.type.slice(-2);
        varType = binaryen[t];
        varTypeObj = module[t];
      }
      (!varType) && error('Bad Type', d.type);
      switch (d.stored) {
        case constants.STORED_LOCAL:
          {
            vars && vars.push(varType);
            if (d.initialExpression) {
              return module.setLocal(d.varIndex, expression(d.initialExpression));
            }
            return null;
          }
        case constants.STORED_GLOBAL:
          if (d.initialExpression) {
            return module.addGlobal(d.value, varType, true, expression(d.initialExpression));
          } else {
            return module.addGlobal(d.value, varType, true, varTypeObj.const(0));
          }
      }
    } else {
      // ユーザー定義型
      const results = [];
      d.members && d.members.forEach(m => {
        const r = define(m);
        (r instanceof Array) ? results.push(...r) : (r && results.push(r));
      });
      return results;
    }
    // switch (d.nodeType) {
    // case 'binary':
    //   // 初期値あり
    //   if(binaryen[d.type]){
    //     // WASM ネイティブ型
    //     // ローカル
    //     if (d.first.scope) {
    //       const left = d.first;
    //       vars && vars.push(binaryen[left.type]);
    //       left.varIndex = varIndex++;
    //       // 初期値の設定ステートメント
    //       d.global = false;
    //       return  module.setLocal(left.varIndex, expression(d.second));
    //     } else {
    //       module.addGlobal(d.first.value, binaryen[d.first.type], true, expression(d.second));
    //       d.global = true;
    //     }
    //   } else {
    //     // ユーザー定義型

    //   }
    //   break;
    // case 'name':
    //   //　初期値なし 
    //   if(binaryen[d.type]){
    //     // WASM ネイティブ型
    //     if (d.scope) {
    //       // ローカル
    //       vars && vars.push(binaryen[d.type]);
    //       d.varIndex = varIndex++;
    //       d.global = false;
    //       return module.setLocal(d.varIndex, module[d.type].const(0));
    //     } else {
    //       // グローバル
    //       d.global = true;
    //       return module.addGlobal(d.value, binaryen[d.type], true, module.i32.const(0));
    //     }
    //   } else {
    //     // ユーザー定義型

    //     const typedef = d.scope.find(d.type,true);
    //     if(!typedef){
    //       error('Type Not Found.',d);
    //     }
    //     const detail = typedef.detail.second;
    //     d.members = new Map();
    //     detail.forEach(d=>{
    //       //d.members.set()          

    //     });
    //     d.members = detail.map(d=>{
    //       return {
    //         ref:d

    //       };
    //       Object.assign(Object.create(d),d)
    //     });

    //     //console.log(detail);
    //     const results = [];
    //     d.members.forEach(member=>{
    //       const results_ = define(member);
    //       if(results_ instanceof Array){
    //         results.push(...results_);
    //       } else {
    //         results.push(results_);
    //       }
    //     });
    //     return results;
    //   }
    // }
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
        return literal(e);
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
    }
  }

  function parseInt32(e, minus = false) {
    let retVal = 0;
    switch (e.kind) {
      case 'hex':
        retVal =  parseInt(e.value.substr(2, e.value.length - 2), 16) * (minus ? -1 : 1);
        break;
      case 'binary':
        retVal =  parseInt(e.value.substr(2, e.value.length - 2), 2) * (minus ? -1 : 1);
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
          const hex = decimalToHex(e.value,minus);
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


  function intToFloat32(intVal,minus){
    return literalLib.i32tof32(intVal,minus?0x80000000:0);
  }

  function parseFloat32(e, minus = false) {
    let retVal = 0;
    switch (e.kind) {
      case 'hex':
      {
        retVal = intToFloat32(parseInt(e.value.substr(2),16),minus);
        //retVal = intToFloat32(parseInt(e.value.substr(2),16),minus);
        break;
      }
      case 'binary':
      {
        retVal = intToFloat32(parseInt(e.value.substr(2),2),minus);
        break;
      }
      default:
        retVal =  parseFloat(e.value, 10) * (minus ? -1 : 1);
    }
    return module.f32.const(retVal);
  }

  
  function intToFloat64(low,high,minus){
    return literalLib.i64tof64(low,high,minus?0x80000000:0);
  }

  function parseFloat64(e, minus = false) {
    let retVal = 0;
    switch (e.kind) {
      case 'hex':
        {
          let value = e.value.substr(2).padStart(16,'0');
          let low = parseInt(value.slice(-8),16);
          let high = parseInt(value.substr(0,8),16);
          retVal = intToFloat64(low,high,minus);
          break;
        }
      case 'binary':
      {
        let value = e.value.substr(2).padStart(64,'0');
        let low = parseInt(value.slice(-32),2);
        let high = parseInt(value.substr(0,32),2);
        retVal =  intToFloat64(low,high,minus);
        break;
      }
      default:
      retVal =  parseFloat(e.value) * (minus ? -1 : 1);
    }
    return module.f64.const(retVal);
  }

  function literal(e, minus = false) {
    //console.log('** literal() **');
    switch (e.type) {
      case 'i32':
      case 'u32':
        return parseInt32(e, minus);
      case 'i64':
      case 'u64':
        return parseInt64(e,minus);
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
    }
    error('Bad Binary Operator', e);
  }

  function setValue(n, v, e) {
    //console.log('** setValue() **');
    !e && (e = n);
    if (e.rvalue) {
      switch (n.stored) {
        case constants.STORED_LOCAL:
          return module.teeLocal(n.varIndex, v);
        case constants.STORED_GLOBAL:
          return module.block(null, [
            module.setGlobal(n.value, v),
            module.getGlobal(n.value, n.type)
          ]);
      }
    } else {
      return (n.stored == constants.STORED_LOCAL) ? module.setLocal(n.varIndex, v) : module.setGlobal(n.value, v);// ** マングル化が必要 ***
    }
  }

  function getValue(e) {
    //console.log('** getValue() **');
    const n = e.first;
    return (n.stored == constants.STORED_LOCAL) ? module.getLocal(n.varIndex, n.type) : module.getGlobal(n.value, n.type);
  }


  function binOp_(name, e, left, right, sign) {
    const t = module[left.type];
    if (t) {
      switch (left.type) {
        case 'i32':
        case 'i64':
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
      switch (left.type) {
        case 'u32':
        case 'u64':
          {
            const realType = 'i' + left.type.slice(-2);
            const t = module[realType];
            let op = t[name];
            (!op) && (op = t[sign ? name + '_s' : name + '_u']);

            if (op) {
              return op(expression(left), expression(right));
            } else {
              error('Bad Operation', left);
            }
          }
          break;
        default:
          {
            const l = expression(left);
            const r = expression(right);
            let op = module['i' + left.type.slice(-2)][name];
            (!op) && (op = module['i' + left.type.slice(-2)][sign ? name + '_s' : name + '_u']);
            if ((typeof l != 'number') || (typeof r != 'number')) {
              error('Bad Expression', left);
            }
            return op(l, r);
            //const lnative = module[l.type];
            //const rnative = module[r.type];

            //if(lnative && rnative && l.type  == r.type){
            //  return binOp_(name,e,l,r,sign);
            //}
          }
        //        error('Bad Type',left);
      }
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
    const t = module[left.type];
    //if(t){
    return i32_.and(i32_.ne(expression(left), i32_.const(0, 0)), i32_.ne(expression(right), i32_.const(0, 0)));
    /*} else {
      switch(left.type){
      case 'u32':
      case 'u64':
      {
        //const t = module['i' + left.type.slice(-2)];
        return i32_.and(i32_.ne(expression(left),i32_.const(0)),i32_.ne(expression(right),i32_.const(0)));
      }
      default:
        error('Bad Type.',left);
      }
    }*/
  }


  function logicalOr(e) {
    //console.log('** logicalOr() **');

    const left = e.first, right = e.second;
    //const t = module[left.type];
    //if(t){
    return i32_.or(i32_.ne(expression(left), i32_.const(0)), i32_.ne(expression(right), i32_.const(0)));
    /*} else {
      switch(left.type){
      case 'u32':
      case 'u64':
      {
        const t = module['i' + left.type.slice(-2)];
        return module.i32.or(module.i32.ne(expression(left),t.const(0)),module.i32.ne(expression(right),t.const(0)));
      }
      default:
        error('Bad Type.',left);
      }
    }*/
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
    }
  }

  function neg(left) {
    if (left.nodeType == 'literal') {
      return literal(left, true);
    }
    switch (left.type) {
      case 'i32':
      case 'u32':
        return module.i32.sub(module.i32.const(0), expression(left));
      case 'i64':
      case 'u64':
        return module.i64.sub(module.i64.const(0, 0), expression(left));
      case 'f32':
      case 'f64':
        return module[left.type].neg(expression(left));
    }
  }

  function not(left) {
    return i32_.eqz(expression(left));
    // switch(left.type){
    // case 'i32':
    // case 'u32':
    //   return module.i32.xor(expression(left),module.i32.const(1));
    // case 'i64':
    // case 'u64':
    //   return module.i64.xor(expression(left),module.i64.const(0,1));
    // case 'f32':
    //   return module.i32.reinterpret(
    //     module.select(
    //       module.i32.eq(module.f32.reinterpret(expression(left)),module.i32.const(0x80000000)),
    //       module.i32.const(0x80000000),
    //       module.f32.reinterpret(expression(left))
    //     )
    //   );
    // case 'f64':
    //   return module.i64.reinterpret(
    //     module.select(
    //       module.i64.eq(module.f64.reinterpret(expression(left)),module.i64.const(0,0x80000000)),
    //       module.i64.const(0,0x80000000),
    //       module.f64.reinterpret(expression(left))
    //     )
    //   );

    // }
  }

  function bitNot(left) {
    switch (left.type) {
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
    const builtinType = module[left.type];
    if (builtinType) {
      return setValue(left, builtinType.add(expression(left), builtinType.const(1)));
    } else {
      switch (left.type) {
        case 'u32':
        case 'u64':
          {
            const t = module['i' + left.type.slice(-2)];
            return setValue(left, t.add(expression(left), t.const(1)));
          }
        default:
          error('Bad Type', left);
      }
    }
  }

  function dec(left) {
    const builtinType = module[left.type];
    if (builtinType) {
      return setValue(left, builtinType.sub(expression(left), builtinType.const(1)));
    } else {
      switch (left.type) {
        case 'u32':
        case 'u64':
          {
            const t = module['i' + left.type.slice(-2)];
            return setValue(left, t.sub(expression(left), t.const(1)));
          }
        default:
          error('Bad Type', left);
      }
    }
  }

  function name(e) {
    //console.log('** name() **');
    const nativeType = binaryen[e.type];
    if (nativeType) {
      switch (e.stored) {
        case constants.STORED_LOCAL:
          return module.getLocal(e.varIndex, binaryen[e.type]);
        case constants.STORED_GLOBAL:
          return module.getGlobal(e.value, binaryen[e.type]);
      }
    } else {
      switch (e.type) {
        case 'u32':
        case 'u64':
          {
            const type = 'i' + e.type.slice(-2);
            switch (e.stored) {
              case constants.STORED_LOCAL:
                return module.getLocal(e.varIndex, binaryen[type]);
              case constants.STORED_GLOBAL:
                return module.getGlobal(e.value, binaryen[type]);
            }
          }
        default:
          return e.scope.find(e.value);
      }
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

  // 代入 // 
  function assignment(e, results = [], top = true) {
    //console.log('** assignment() **');
    const left = e.first, right = e.second;


    if (left.value == '.') {
      const l = leftDotOp(left);
      if (module[l.type]) {
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
      if (top) {
        return results.length == 1 ? results[0] : module.block(null, results);
      }
    } else if (left.members) {
      const leftMembers = left.members;
      const rightMembers = right.members;
      leftMembers.forEach((leftMember, i) => {
        const memberAssignmment = Object.assign(Object.create(e), e);
        memberAssignmment.first = leftMember;
        memberAssignmment.second = rightMembers[i];
        e.type = leftMember.type;
        assignment(memberAssignmment, results, false);
      });
      if (top) {
        return results.length == 1 ? results[0] : module.block(null, results);
      }
    } else {
      if (left.type != right.type) {
        error('不正な代入：左辺と右辺の型が違います', e);
      }
      let type = module[left.type];
      if (!type) {
        type = module['i' + left.type.slice(-2)];
        if (!type) {
          error('不正な代入', e);
        }
      }
      results.push(setValue(left, expression(right)));
      if (top) {
        return results.length == 1 ? results[0] : module.block(null, results);
      }
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