// parse.js
// Parser for Simplified JavaScript written in Simplified JavaScript
// From Top Down Operator Precedence
// http://javascript.crockford.com/tdop/index.html
// Douglas Crockford
// 2016-02-15

//jslint for, this


import * as constants from './compilerConstants.mjs';

function error(message, t = this) {
  t.name = 'Parser : SyntaxError';
  t.message = message;
  throw t;
}
// 型が決定してない識別子たち
const undeterminedTypeIds = [

];

class FunctionScope {
  constructor() {
    this.funcVars = [];
    this.length = 0;
  }
  scopeIn() {
    this.funcVars.push(0);
    this.length = this.funcVars.length;
    this.stackTop = this.length - 1;
    this.current = 0;
  }

  scopeOut() {
    if (this.length == 0) throw new Error('配列インデックスの上限を超えています。');

    this.funcVars.pop();
    this.length = this.funcVars.length;
    if (this.length >= 1) {
      this.stackTop = this.length - 1;
      this.current = this.funcVars[this.stackTop];
    } else {
      this.stackTop = undefined;
      this.current = undefined;
    }
  }

  index(inc = true) {
    if (inc) {
      const ret = this.current;
      this.incIndex();
      return ret;
    } else {
      return this.current;
    }
  }

  incIndex() {
    ++this.current;
    this.funcVars[this.stackTop] = this.current;
  }

  get global() {
    return this.current === undefined;
  }
}



// パーサの生成
export default function make_parse() {
  //  let scope = new Scope();
  const symbol_table = new Map();
  let token;
  let tokens;
  let token_nr;
  let scope;
  let scopeTop;
  let funcScope = new FunctionScope();
  let currentType = null;
  let DefaultType;


  function createScope() {
    const s = new Scope(scope);
    scope = s;
    return s;
  }

  function itself(rvalue = true) {
    this.rvalue = rvalue;
    return this;
  }

  class Scope {
    constructor(s) {
      this.def = new Map();
      this.typedef = new Map();
      this.parent = s;
    }

    define(n) {
      const def = n.typedef ? this.typedef : this.def;
      const varName = n.varName ? n.varName : n.value;
      const t = def.get(varName);
      if (t) {
        error((t.reserved)
          ? 'Already reserved.'
          : 'Already defined.', n);
      }
      def.set(varName, n);
      n.reserved = false;
      n.nud = itself;
      n.led = null;
      n.std = null;
      n.lbp = 0;
      n.scope = scope;
      return n;
    }

    find(n, typedef = false) {
      if (!typedef) {
        let e = this;
        let o;
        while (true) {
          o = e.def.get(n);
          if (o && typeof o !== 'function') {
            return e.def.get(n);
          }
          e = e.parent;
          if (!e) {
            o = symbol_table.get(n);
            return (o && typeof o !== 'function')
              ? o
              : null/*symbol_table.get('(name)')*/;
          }
        }
      } else {
        let e = this;
        let o;
        while (e) {
          o = e.typedef.get(n);
          if (o && typeof o !== 'function') {
            return o;
          }
          e = e.parent;
        }
        return null;
      }
    }
    pop() {
      scope = this.parent;
    }
    // 予約語
    reserve(n) {
      const def = n.typedef ? this.typedef : this.def;
      if (n.nodeType !== 'name' || n.reserved) {
        return;
      }
      const t = def.get(n.value);
      if (t) {
        if (t.reserved) {
          return;
        }
        if (t.nodeType === 'name') {
          error('Already defined.', n);
        }
      }
      def.set(n.value, n);
      n.reserved = true;
    }
  }

  // tokenを進める
  function advance(id) {
    let a;
    let o;
    let t;
    let v;
    let sign = true;
    let type;
    if (id && token.id !== id) {
      error('Expected "' + id + '".', token);
    }
    if (token_nr >= tokens.length) {
      token = symbol_table.get('(end)');
      return;
    }
    t = tokens[token_nr];
    token_nr += 1;
    v = t.value;
    a = t.type;
    let ref = false;
    if (a === 'name') {
      // 型名かどうか
      o = scope.find(v, true);
      // 変数名かどうか
      if (!o) {
        o = scope.find(v, false);
        o && (ref = true);
      }
      if (!o) o = symbol_table.get('(name)');
    } else if (a === 'operator') {
      o = symbol_table.get(v);
      if (!o) {
        error('Unknown operator.', t);
      }
    } else if (a == 'i8' || a == 'u8' || a == 'u16' || a == 'i16' || a == 'string' || a == 'f64' || a == 'f32' || a == 'i32' || a == 'i64' || a == 'u32' || a == 'u64') {
      o = symbol_table.get('(literal)');
      type = scope.find(a, true);
      //type = a;
      a = 'literal';
      if (a.substr(0, 1) == 'i') {
        sign = true;
      } else {
        sign = false;
      }

    } else {
      error('Unexpected token.', t);
    }

    token = Object.assign(Object.create(o), o);
    //token = Object.create(o);
    // TODO:このへんのいい加減コードも整理せんといかんですなあ。。
    token.line = t.line;
    token.pos = t.pos;
    token.value = o.typedef ? o.value : v;
    token.nodeType = o.typedef ? o.nodeType : a;
    token.sign = sign;
    o.members && (token.members = o.members);
    o.varIndex && (token.varIndex = o.varIndex);
    //token.type = a;
    if (type) {
      token.type = type;
      currentType = type;
    }
    ((typeof token.type) == 'string') && (token.type = scope.find(token.type, true));
    t.kind && (token.kind = t.kind);
    o.userType && (token.userType = o.userType);
    // 変数参照はnodeTypeを'reference'とする
    ref && (token.nodeType = 'reference');
    //(token.ref && token.ref.userType) && (token.userType = token.ref.userType);

    return token;
  }

  function checkType(t, left) {
    let type = t.type;
    if (!type) {
      let leftType = left.type;
      if (leftType && t.value != '*') {
        t.type = leftType;
        undeterminedTypeIds.forEach(id => {
          if (!id.type) {
            id.type = leftType;
          }
        });
        undeterminedTypeIds.length = 0;
      } else {
        //        if(t.value == '*'){
        undeterminedTypeIds.push(t);
        //        }

      }
    }
  }

  function setDefaultType() {
    undeterminedTypeIds.forEach(id => {
      if (!id.type) {
        id.type = currentType || DefaultType;
      }
    });
    undeterminedTypeIds.length = 0;
    currentType = null;
  }

  // タイプエイリアスから実際の型を取り出す
  function getRealType(t) {
    return !t.alias ? t : getRealType(t.alias);
  }

  // 式
  function expression(rbp, rvalue = true) {

    let left;
    let t = token;

    advance();
    left = t.nud(rvalue);
    while (rbp < token.lbp) {
      t = token;
      advance();
      left = t.led(left, rvalue);
      checkType(t, left);
    }
    return left;
  }


  // ステートメント
  function statement() {
    const n = token;
    n.rvalue = false;
    let v;

    // ステートメント
    if (n.std) {
      advance();
      const scope_ = scope;
      const ret = n.std(false);
      scope_.reserve(n);
      return ret;
    }

    // 変数定義
    if (n.dvd) {
      const ret = n.dvd(false);
      //undeterminedTypeIds.forEach(d=>{d.type = 'i32'});
      //undeterminedTypeIds.length = 0;
      return ret;
    }

    // 式
    v = expression(0, false);

    // if (!v.assignment && v.id !== '(' && v.nodeType !== 'unary') {
    //   v.error('Bad expression statement.');
    // }
    //undeterminedTypeIds.forEach(d=>{d.type = 'i32'});
    //undeterminedTypeIds.length = 0;
    advance(';');
    return v;
  }

  function statements() {
    const a = [];
    let s;
    while (true) {
      if (token.id === '}' || token.id === '(end)') {
        break;
      }
      s = statement();
      setDefaultType();

      // 未決定の型の識別子があれば既定値に設定する
      //undeterminedTypeIds.forEach(d=>{(!d.type)&&(d.type = 'i32')});
      //undeterminedTypeIds.length = 0;

      if (s instanceof Array) {
        a.push(...s);
      } else {
        a.push(s);
      }
    }
    return a;
    // .length === 0
    //   ? null
    //   : a.length === 1
    //     ? a[0]
    //     : a;
  }

  function block() {
    var t = token;
    advance('{');
    return t.std();
  }


  class SymbolBase {
    constructor({ id, value, bp = 0, nud, led, std }) {
      this.id = id;
      this.value = value;
      this.lbp = bp;
      (typeof nud === 'function') && (this.nud = nud);
      (typeof led === 'function') && (this.led = led);
      (typeof std === 'function') && (this.std = std);
    }
    nud() {
      error('Undefined.', this);
    }
    led() {
      error('Missing operator.', this);
    }
  }

  function symbol({ id, bp = 0, value, nud, led, std, cons }) {
    let s = symbol_table.get(id);
    bp = bp || 0;
    if (s) {
      if (bp >= s.lbp) {
        s.lbp = bp;
      }
      nud && (s.nud = nud);
      std && (s.std = std);
      led && (s.led = led);
      value && (s.value = value);
      symbol_table.set(id, s);
    } else {
      const params = { id: id, value: value ? value : id, bp: bp, nud: nud, led: led, std: std };
      s = cons ? new cons(params) : new SymbolBase(params);
      symbol_table.set(id, s);
    }
    return s;
  }

  function sym(s) {
    return symbol({ id: s });
  }

  class Constant extends SymbolBase {
    constructor({ id, value, bp }) {
      super({ id: id, value: value ? value : id, bp: bp });
    }
    nud(rvalue = true) {
      scope.reserve(this);
      this.value = symbol_table.get(this.id).value;
      this.rvalue = rvalue;
      this.nodeType = 'literal';
      return this;
    }
  }

  function constant(s, v) {
    return symbol({ id: s, value: v, nud: Constant.prototype.nud, cons: Constant });
    // x.nud = function () {
    //   scope.reserve(this);
    //   this.value = symbol_table.get(this.id).value;
    //   this.nodeType = 'literal';
    //   return this;
    // };
    // x.value = v;
    // return x;
  }

  class Infix extends SymbolBase {
    constructor({ id, bp, led }) {
      super({ id: id, bp: bp });
      (typeof led === 'function') && (this.led = led);
    }
    led(left, rvalue = true) {
      this.first = left;
      this.rvalue = rvalue;
      this.first.rvalue = rvalue;
      this.second = expression(this.lbp);
      this.second.rvalue = true;

      checkType(this, left);
      //!this.type && (this.type = left.type);
      // if(this.first.type != this.second.type){
      //   this.error('type unmatched.');
      // }
      this.nodeType = 'binary';
      return this;
    }
  }

  function infix(id, bp, led) {
    return symbol({ id: id, bp: bp, led: led || Infix.prototype.led, cons: Infix });
    // const s = symbol(id, bp);
    // s.led = led || function (left) {
    //   this.first = left;
    //   this.second = expression(bp);
    //   this.nodeType = 'binary';
    //   return this;
    // };
    // return s;
  }

  class Infixr extends SymbolBase {
    constructor({ id, bp, led }) {
      super({ id: id, bp: bp });
      (typeof led === 'function') && (this.led = led);
    }
    led(left, rvalue = true) {
      this.first = left;
      this.rvalue = this.first.rvalue = rvalue;
      this.second = expression(this.lbp - 1, true);
      this.second.rvalue = true;
      checkType(this, left)
      //!this.type && (this.type = left.type);
      this.nodeType = 'binary';
      return this;
    }
  }

  function infixr(id, bp, led) {
    return symbol({ id: id, bp: bp, led: led || Infixr.prototype.led, cons: Infixr });
    // const s = symbol(id, bp);
    // s.led = led || function (left) {
    //   this.first = left;
    //   this.second = expression(bp - 1);
    //   this.nodeType = 'binary';
    //   return this;
    // };
    // return s;
  }

  class Assignment extends SymbolBase {
    constructor({ id }) {
      super({ id: id, bp: 10 });
    }
    led(left, rvalue = true) {
      if (left.id !== '*' && left.id !== '.' && left.id !== '[' && left.nodeType !== 'name' && left.nodeType !== 'reference') {
        error('Bad lvalue.', left);
      }
      this.first = left;
      this.rvalue = this.first.rvalue = rvalue;
      this.second = expression(this.lbp - 1, true);
      this.second.rvalue = true;
      // if(this.first.type != this.second.type ){
      //   error('type unmatch',this);
      // }

      checkType(this, left);
      //!this.type && (this.type = left.type);
      this.assignment = true;
      this.nodeType = 'binary';
      return this;
    }
  }
  //   if (left.id !== '.' && left.id !== '[' && left.nodeType !== 'name') {

  function assignment(id) {
    return symbol({ id: id, bp: 10, led: Assignment.prototype.led, cons: Assignment });
    // return infixr(id, 10, function (left) {
    //     left.error('Bad lvalue.');
    //   }
    //   this.first = left;
    //   this.second = expression(9);
    //   this.assignment = true;
    //   this.nodeType = 'binary';
    //   return this;
    // });
  }

  class Prefix extends SymbolBase {
    constructor({ id, nud }) {
      super({ id: id });
      if (typeof nud === 'function') this.nud = nud;
    }
    nud(rvalue = false) {
      scope.reserve(this);
      this.first = expression(70);
      this.rvalue = this.first.rvalue = rvalue;
      checkType(this, this.first);
      //!this.type && (this.type = this.first.type);
      this.nodeType = 'unary';
      return this;
    }
  }

  function prefix(id, nud) {
    return symbol({ id: id, nud: nud || Prefix.prototype.nud, cons: Prefix });
    // const s = symbol(id);
    // s.nud = nud || function () {
    //   scope.reserve(this);
    //   this.first = expression(70);
    //   this.nodeType = 'unary';
    //   return this;
    // };
    // return s;
  }

  function suffix(id, led = function (left, rvalue = true) {
    this.first = left;
    this.rvalue = this.first.rvalue = rvalue;
    checkType(this, left);
    //!this.type && (this.type = left.type);
    this.nodeType = 'suffix';
    return this;
  }) {
    return symbol({ id: id, led: led });
  }

  class Statement extends SymbolBase {
    constructor(id, std) {
      super({ id: id, std: std });
    }
  }

  function stmt(id, std) {
    return symbol({ id: id, std: std });
    // const x = symbol(s);
    // x.std = f;
    // return x;
  }

  sym('(end)');



  stmt('export', function () {
    token.export = true;
    return defineVarAndFunction.bind(token)();
  });

  stmt('const', function () {
    token.const = true;
    return defineVarAndFunction.bind(token)();
  });



  stmt('(name)');

  sym(':');
  sym(';');
  sym(')');
  sym(']');
  sym('}');
  sym(',');
  sym('else');

  //constant('true', true);
  //constant('false', false);
  //constant('null', null);
  //constant('pi', 3.141592653589793);
  //constant('Object', {});
  //constant('Array', []);

  sym('(literal)').nud = itself;

  // sym('this').nud = function () {
  //   scope.reserve(this);
  //   this.nodeType = 'this';
  //   return this;
  // };

  assignment('=');
  assignment('+=');
  assignment('-=');

  infix('?', 20, function (left, rvalue = true) {
    this.first = left;
    this.rvalue = this.first.rvalue = rvalue;
    this.second = expression(0);
    this.second.rvalue = true;
    advance(':');
    this.third = expression(0);
    this.nodeType = 'ternary';
    checkType(this, left);
    return this;
  });

  infix(':', 20, function (left, rvalue = true) {
    this.first = left;
    this.rvalue = this.first.rvalue = rvalue;
    advance();
    checkType(this, left);
    this.second = token.name;
    this.second.rvalue = true;
  });

  infixr('&&', 30);
  infixr('||', 30);

  infixr('==', 40);
  infixr('!=', 40);
  infixr('<', 40);
  infixr('<=', 40);
  infixr('>', 40);
  infixr('>=', 40);

  infix('+', 50);
  infix('-', 50);

  infix('*', 60);
  infix('/', 60);

  infix('<<', 45);//shl
  infix('>>', 45);//shr_s
  infix('>>>', 45);//shr_u
  infix('<<&', 45);// rotl
  infix('>>&', 45);// rotr
  infix('&', 43);// and
  infix('|', 43);// or
  infix('^', 43);// xor


  infix('.', 80, function (left, rvalue = true) {
    this.first = left;
    this.rvalue = this.first.rvalue = rvalue;
    if (token.nodeType !== 'name') {
      error('Expected a property name.', token);
    }
    token.nodeType = 'literal';
    this.second = token;
    this.second.parent = left;
    function findMembers(target) {
      if (target.members) {
        return target.members;
      }
      if (target.second) {
        return findMembers(target.second);
      }
      error('not find members', left);
    }
    const members = findMembers(left);

    members.some(m => {
      if (m.value == token.value) {
        this.second = m;
        this.second.nodeType = 'reference';
        return true;
      }
      return false;
    });
    this.nodeType = 'binary';
    advance();
    checkType(this, left);
    return this;
  });

  infix('[', 80, function (left, rvalue = true) {
    this.first = left;
    this.rvalue = this.first.rvalue = rvalue;
    this.second = expression(0);
    this.second.rvalue = true;
    this.nodeType = 'binary';
    advance(']');
    return this;
  });

  infix('(', 80, function (left, rvalue = true) {
    var a = [];
    if (left.id === '.' || left.id === '[') {
      this.nodeType = 'ternary';
      this.first = left.first;
      this.rvalue = this.first.rvalue = rvalue;
      this.second = left.second;
      this.second.rvalue = true;
      this.third = a;
    } else {
      this.nodeType = 'binary';
      if (left.nodeType === 'name' || left.nodeType === 'reference') {
        // 関数呼び出しではないか?
        const ft = scope.find(left.value);
        if (ft.nodeType === 'function') {
          this.nodeType = 'call';
        }
      }
      this.first = left;
      this.rvalue = this.first.rvalue = rvalue;
      this.second = a;
      this.second.rvalue = true;
      if ((left.nodeType !== 'unary' || left.nodeType !== 'function') && left.nodeType !== 'reference' &&
        left.nodeType !== 'name' && left.id !== '(' &&
        left.id !== '&&' && left.id !== '||' && left.id !== '?') {
        error('Expected a variable name.', left);
      }
    }
    if (token.id !== ')') {
      while (true) {
        a.push(expression(0));
        if (token.id !== ',') {
          break;
        }
        advance(',');
      }
    }
    advance(')');
    checkType(this, left);
    return this;
  });

  // new 
  prefix('new',80,function(left,rvalue = true){
    console.log('new');

  });


  prefix('++');
  prefix('--');
  suffix('++').lbp = 70;
  suffix('--').lbp = 70;

  // 参照
  // suffix('&',80,function(left,rvalue = false){
  //   console.log('reference');
  //   return this;
  // });

  prefix('!');
  prefix('-');
  //prefix('typeof');

  // ポインタが示す実体を参照する
  prefix('*').lbp = 70;
  // ポインタメンバの参照
  // infix('->', 80, function (left, rvalue = true) {
  //   this.first = left;
  //   this.rvalue = this.first.rvalue = rvalue;
  //   if (token.nodeType !== 'name') {
  //     error('Expected a property name.', token);
  //   }
  //   token.nodeType = 'literal';
  //   this.second = token;
  //   this.nodeType = 'binary';
  //   advance();
  //   checkType(this,left);
  //   return this;
  // });

  prefix('~', 80);

  prefix('sizeof', function (rvalue = true) {

    advance('(');
    this.first = expression(80, rvalue);
    this.rvalue = rvalue;
    this.nodeType = 'sizeof';
    advance(')');
    return this;
  });

  prefix('(', function (rvalue = true) {
    let reinterpret = false;
    if (token.id == '^') {
      reinterpret = true;
      advance();
    }
    let e = token;
    if (e.id == 'type') {
      // キャストである
      advance();
      // e.id = 'cast';
      e.nodeType = 'cast';
      e.reinterpret = reinterpret;
      e.rvalue = rvalue;
      advance(')');
      e.first = expression(80, rvalue);
      return e;
    } else {
      e = expression(0, rvalue);
    }
    this.rvalue = rvalue;
    advance(')');
    return e;
  });


  prefix('[', function (rvalue = true) {
    const a = [];
    if (token.id !== ']') {
      while (true) {
        a.push(expression(0));
        if (token.id !== ',') {
          break;
        }
        advance(',');
      }
    }
    advance(']');
    this.first = a;
    this.nodeType = 'unary';
    return this;
  });

  prefix('{', function () {
    const a = [];
    let n;
    let v;
    if (token.id !== '}') {
      while (true) {
        n = token;
        if (n.nodeType !== 'name' && n.nodeType !== 'literal') {
          error('Bad property name.', token);
        }
        advance();
        advance(':');
        v = expression(0);
        v.key = n.value;
        a.push(v);
        if (token.id !== ',') {
          break;
        }
        advance(',');
      }
    }
    advance('}');
    this.first = a;
    this.nodeType = 'unary';
    return this;
  });


  stmt('{', function () {
    createScope(scope);
    var a = statements();
    scope.pop();
    advance('}');
    this.nodeType = 'block';
    this.first = a;
    this.rvalue = false;

    return this;
  });

  stmt('if', function () {
    advance('(');
    this.first = expression(0);
    advance(')');
    this.second = block();
    if (token.id === 'else') {
      scope.reserve(token);
      advance('else');
      this.third = (token.id === 'if')
        ? statement()
        : block();
    } else {
      this.third = null;
    }
    this.nodeType = 'statement';
    return this;
  });

  stmt('return', function () {
    if (token.id !== ';') {
      this.first = expression(0);
    }
    advance(';');
    if (token.id !== '}') {
      error('Unreachable statement.', token);
    }
    this.nodeType = 'statement';
    checkType(this, this.first);
    return this;
  });

  stmt('break', function () {
    advance(';');
    if (token.id !== '}') {
      error('Unreachable statement.', token);
    }
    this.nodeType = 'statement';
    return this;
  });

  stmt('while', function () {
    advance('(');
    this.first = expression(0);
    advance(')');
    this.second = block();
    this.nodeType = 'statement';
    return this;
  });

  stmt('do', function () {
    this.second = block();
    advance('while');
    advance('(');
    this.first = expression(0);
    advance(')');
    advance(';');
    this.nodeType = 'statement';
    return this;
  });

  stmt('for', function () {
    advance('(');
    // 初期設定
    this.first = statement();
    // 終了条件
    this.second = statement();
    // ループ終端時の動作
    this.third = expression(0, false);
    advance(')');
    // for文の本体
    this.fourth = block();
    this.nodeType = 'statement';
    return this;
  });

  // 変数・関数定義ノードを作成する
  function defineVarAndFunction(typedef = false) {

    // 定数定義の場合
    if (this.const) { // constフラグが立っていると定数定義
      advance();
      // 初期値の定数式を処理
      if (token.id == '=') {
        const t = token;
        advance('=');
        this.rvalue = false;
        this.initialExpression = expression(0);
        // 型チェック
        checkType(this, this.initialExpression);
        this.nodeType = 'define';
        scope.define(this);
        advance(';');
        return this;
      } else {
        error('文法エラー：初期値が必要です。', this);
      }
    }

    let a = [];
    let n;
    let alias = false;
    let pointer = false;

    advance();
    n = token;

    // alias
    if (n.id == '&') {
      advance();
      n = token;
      alias = true;
    }

    if (n.id == '*') {
      pointer = true;
      advance();
      n = token;
      n.pointer = true;
    }

    let funcptr = false;
    // 関数ポインタ定義かどうか
    // if (n.id == '(') {
    //   advance();
    //   advance('*');
    //   n = token;
    //   n.pointer = true;
    //   funcptr = true;
    // }

    // ローカルスコープですでに定義されているか

    if (typedef) {// 型定義の場合はそのまま
      n.varName = n.value;
    } else {
      n.varName = n.parent ? (n.parent.varName ? n.parent.varName + '.' + n.value : n.parent.value + '.' + n.value) : n.value;
    }

    if (scope.def.get(n.varName)) {
      error('Already Defined', n);
    }

    // 変数の型を保存
    n.type = this;

    if (this.userType) {
      // ユーザー定義型の場合は型情報の参照を追加
      n.userType = this.userType;
      //n.typeRef = getRealType(this);
    }

    // export するかどうか
    n.export = this.export;
    // scope に変数名を登録する
    (!typedef) && scope.define(n);
    advance();
    if (funcptr) {
      advance('*');
    }

    function assignMembers(node) {
      const parentVarName = node.varName;
      //const typeRef = node.typeRef;
      return node.type.members.map(m => {
        const member = Object.assign({}, m);
        member.varName = parentVarName + '.' + member.value;
        scope.define(member);
        if (!funcScope.global) {
          member.stored = constants.STORED_LOCAL;
          if (!member.userType) {
            // ビルトイン型
            member.varIndex = funcScope.index();
          }
        } else {
          member.stored = constants.STORED_GLOBAL;
        }
        if (member.userType) {
          // ユーザー定義の場合はさらに掘り下げる
          member.members = assignMembers(member/*.typeRef*/);
        }
        return member;
      });
    }

  // 関数定義かどうか
  if (token.id === '(') {

    // 関数定義かユーザー定義型かを調べる //

    advance();

    let isFunc = false;
    if(token.id == ')'){
      // 引数なしの関数かもしれないので、次のトークンを調べる
      let next = tokens[token_nr];
      if(next.value == '{'){
        // ブレスで始まっているので関数である
        isFunc = true;
      }
    }

    if(!isFunc && (token.nodeType != 'builtin' && token.nodeType != 'user-type' && token.nodeType != 'type-alias')){
      // ユーザー定義型のコンストラクタである
      let initialExpressions = [];
      while(token.id != ')'){
        initialExpressions.push(expression(0));
        if(token.id == ')'){
          break;
        } else {
          advance(',');
        }
      }
      n.initialExpression = initialExpressions;
      n.nodeType = 'define';
      n.userType = true;
      advance();
      advance(';');
      //scope.define(n);
      return n;
    }

    // ** 関数定義である ** //

    // 関数内のスコープを開く
    createScope();
    funcScope.scopeIn();
    // 関数の引数があるか
    if (token.id !== ')') {

      // 引数を取り出して配列に格納する
      while (true) {
        let pointer = false;
        if (token.nodeType !== 'define' && token.nodeType !== 'builtin') {
          error('Expected a parameter name.', token);
        } 

        const type = token;
        advance();

        if(token.id == '&'){
          error('関数の引数にエイリアスは指定できません。',token);
        }
        
        if(token.id == '*'){
          pointer = true;
        } else {
          pointer = false;
        }

        // 変数名
        const t = token;
        t.type = type;
        t.pointer = pointer;

        if (type.userType) {
          t.userType = true;
          //t.typeRef = type;
        }
        scope.define(t);
        t.rvalue = false;
        advance();

        // 変数の初期値
        if (token.id === '=') {
          // 初期値あり
          advance('=');
          t.rvalue = false;
          (!token.type) && (token.type = t.type);
          t.initialExpression = expression(0);
          checkType(t.initialExpression, t);
        }

        // ユーザー定義型かどうか
        if (t.userType) {
          t.members = assignMembers(t);
        } else {
          t.varIndex = funcScope.index();
          t.stored = constants.STORED_LOCAL;
        }

        a.push(t);

        if (token.id !== ',') {
          break;
        }
        advance(',');
      }
    }
    // 引数情報を格納
    n.params = a;
    advance(')');
    if (!funcptr) {
      // 関数ボディのパース
      advance('{');
      // ツリーの右に文を格納
      n.statements = statements();
    }
    n.scope = scope;
    scope.pop();
    funcScope.scopeOut();
    if (!funcptr) {
      advance('}');
    }
    advance(';');
    n.id = 'type';
    n.nodeType = 'function';
    return n;
  }

  while (true) {

    // 変数名
    n.nud = itself;

    // 初期値の代入演算子があるか（エイリアスの場合は必須）
    if (token.id === '=') {
      // 初期値あり
      advance('=');

      // 代入される変数は右辺値ではない
      n.rvalue = false;
      // 右辺値の型情報がない場合は左辺値の型情報を代入する
      (!token.type) && (token.type = n.type);

      // 初期値の処理を行う。
      {
        // 初期化式の評価
        const initExpression = expression(0);

        if (alias) {
          // エイリアス->参照する変数をaliasプロパティに代入する
          if (initExpression.nodeType != 'reference') {
            error('変数エイリアスの初期化式に指定できるのは変数のみです。', e);
          } else {
            n.alias = initExpression;
            n.type = n.alias.type;
          }
        } else {
          // 変数定義->式評価を行う
          n.initialExpression = initExpression;
          // 型情報
          checkType(n.initialExpression, n);
        }
      }
      a.push(n);
    } else {
      if (!alias) {
        a.push(n);
      } else {
        // エイリアスは初期値が必要
        error('エイリアスは初期値が必要です', n);
      }
    }

    // カンマ演算子
    if (token.id !== ',') {
      break;
    }

    advance(',');
    n = token;
    n.type = this;
    n.pointer = pointer;

    if (this.userType) {
      // ユーザー定義型の場合は型情報の参照を追加
      n.userType = this.userType;
      //n.typeRef = getRealType(this);
    }
    n.rvalue = false;
    (!typedef) && scope.define(n);
    advance();
  }

  advance(';');
  a.forEach(d => {
    const ret = d;

    if (!alias) {// 変数エイリアスには不要な情報
      //const ret = d;//Object.assign(Object.create(d), d);
      if (!typedef && !funcScope.global && (!ret.userType || (ret.typeRef && !ret.typeRef.userType))) {
        // ビルトイン型
        ret.varIndex = funcScope.index();
        ret.stored = constants.STORED_LOCAL;
      } else {
        ret.stored = constants.STORED_GLOBAL;
      }

      // 型エイリアスの場合、typeRef
      if (ret.typeRef && ret.typeRef.userType) {
        // ユーザー定義型
        if (!typedef) {
          ret.members = assignMembers(ret);
        }
      }
    }
    ret.nodeType = 'define';
    ret.type = this;
  });
  //this.defines = a;

  return a;
  // return (a.length === 0)
  //   ? null
  //   : (a.length === 1)
  //     ? a[0]
  //     : a;
}

// ** type 定義 ** //
stmt('type', function () {
  //this.first = token;

  let alias = false;
  if (token.id == '&') {
    alias = true;
    advance();
  }

  this.value = token.value;
  this.type = token;
  this.id = token.value;

  advance();

  switch (token.id) {
    case '{':
      {
        // ユーザー定義
        this.nodeType = 'userType';
        this.userType = true;
        this.typedef = true;
        advance();
        const defs = [];
        let access = constants.ACCESS_PUBLIC;// publicから始まる。
        //createScope();
 
        let size = 0;
        while (token.id != "}") {
          const def = defineVarAndFunction.bind(token, true)();
          def.forEach(d => d.access = access);
          defs.push(...def);
        }
        advance('}');
        //scope.pop();
        
        // バイトサイズを求める
        defs.forEach(d=>{
          size += d.type.size;
        });
        this.size = size;

        this.members = defs;
        
        this.dvd = defineVarAndFunction;
        //const t = this.first.value;
        // 型をスコープに登録
        scope.define(this);
        advance(';');
        return this;
      }
    // 型エイリアス
    case '=':
      advance('=');
      this.alias = token;
      this.typedef = true;
      this.userType = true;
      this.dvd = defineVarAndFunction;
      advance();
      scope.define(this);
      this.nodeType = 'type-alias';
      advance(';');
      return this;
  }
});

return function (t) {
  tokens = t;
  //        tokens = source.tokens('=<>!+-*&|/%^', '=<>&|');
  token_nr = 0;
  //scope = null;
  //new Scope();
  //global = scope;
  scopeTop = createScope();
  // ビルトイン型
  const builtinTypes = new Map(
    [
      ['i8', { size: 1, bitSize: 8, max: 127, min: -128, integer: true }],
      ['i16', { size: 2, bitSize: 16, max: 32767, min: -32768, integer: true }],
      ['u8', { size: 1, bitSize: 8, max: 255, min: 0, integer: true }],
      ['u16', { size: 2, bitSize: 16, max: 65535, min: 0, integer: true }],
      ['u32', { size: 4, bitSize: 32, max: 0xffffffff, min: 0, integer: true }],
      ['u64', { size: 8, bitSize: 64, max: { low: 0xffffffff, high: 0xffffffff }, min: { low: 0, high: 0 }, integer: true }],
      ['i32', { size: 4, bitSize: 32, max: 0x7fffffff, min: -0x8000000, integer: true }],
      ['i64', { size: 8, bitSize: 64, max: { low: 0xffffffff, high: 0x7fffffff }, min: { low: 0, high: 0x80000000 }, integer: true }],
      ['f32', { size: 4, bitSize: 32, max: 3.402823466e+38, min: 1.175494351e-38, integer: false }],
      ['f64', { size: 8, bitSize: 64, max: Number.MAX_VALUE, min: Number.MIN_VALUE, integer: false }],
      ['void', { size: 0 }],
      ['string', {}]
    ]);
  builtinTypes.forEach((v, k) => {
    scope.define({ id: 'type', value: k, type: k, nodeType: 'builtin', typedef: true, dvd: defineVarAndFunction, userType: false, size: v.size, bitSize: v.bitSize, integer: v.integer, max: v.max, min: v.min });
  });
  DefaultType = scope.find('i32', true);
  advance();
  const s = statements();
  advance('(end)');
  scope.pop();
  console.log('** parse end **');
  return {
    id: '(program)',
    scope: scopeTop,
    builtInTypes: builtinTypes,
    statements: s
  };
};
}
