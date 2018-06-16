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
  const labels = new Map();
  let scope;
  let scopeTop;
  let funcScope = new FunctionScope();

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
      const t = def.get(n.value);
      if (t) {
        error((t.reserved)
          ? 'Already reserved.'
          : 'Already defined.', n);
      }
      def.set(n.value, n);
      n.reserved = false;
      n.nud = itself;
      n.led = null;
      n.std = null;
      n.lbp = 0;
      n.scope = scope;
      return n;
    }

    find(n, typedef = n.typedef) {
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
    } else if (a == 'string' || a == 'int' || a == 'f64' || a == 'f32' || a == 'i32' || a == 'i64' || a == 'u32' || a == 'u64') {
      o = symbol_table.get('(literal)');
      type = a;
      a = 'literal';
      if (a.substr(0, 1) == 'i') {
        sign = true;
      } else {
        sign = false;
      }

    } else {
      error('Unexpected token.', t);
    }

    token = Object.assign(Object.create(o),o);
    //token = Object.create(o);
    token.line = t.line;
    token.pos = t.pos;
    token.value = o.typedef ? o.value : v;
    token.nodeType = o.typedef ? o.nodeType : a;
    token.sign = sign;
    o.members && (token.members = o.members);
    o.varIndex && (token.varIndex = o.varIndex);
    //token.type = a;
    type && (token.type = type);
    t.kind && (token.kind = t.kind);
    o.userType && (token.userType = o.userType);
    ref && (token.nodeType = 'reference');
    //(token.ref && token.ref.userType) && (token.userType = token.ref.userType);

    return token;
  }

  function expression(rbp, rvalue = true) {
    //debugger;
    let left;
    let t = token;

    advance();
    left = t.nud(rvalue);
    while (rbp < token.lbp) {
      t = token;
      advance();
      left = t.led(left, rvalue);
      !t.type && (t.type = left.type);
    }
    return left;
  }

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
      return n.dvd(false);
    }

    // 式
    v = expression(0, false);

    // if (!v.assignment && v.id !== '(' && v.nodeType !== 'unary') {
    //   v.error('Bad expression statement.');
    // }
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

      !this.type && (this.type = left.type);
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
      !this.type && (this.type = left.type);
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
      if (left.id !== '.' && left.id !== '[' && left.nodeType !== 'name' && left.nodeType !== 'reference') {
        error('Bad lvalue.', left);
      }
      this.first = left;
      this.rvalue = this.first.rvalue = rvalue;
      this.second = expression(this.lbp - 1, true);
      this.second.rvalue = true;

      !this.type && (this.type = left.type);
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
    nud(rvalue = true) {
      scope.reserve(this);
      this.first = expression(70);
      this.rvalue = this.first.rvalue = rvalue;
      !this.type && (this.type = this.first.type);
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
    !this.type && (this.type = left.type);
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
    !this.type && (this.type = left.type);
    return this;
  });

  infix(':', 20, function (left, rvalue = true) {
    this.first = left;
    this.rvalue = this.first.rvalue = rvalue;
    advance();
    !this.type && (this.type = left.type);
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

  infix('.', 80, function (left, rvalue = true) {
    this.first = left;
    this.rvalue = this.first.rvalue = rvalue;
    if (token.nodeType !== 'name') {
      error('Expected a property name.', token);
    }
    token.nodeType = 'literal';
    this.second = token;
    left.members.some(m=>{
      if(m.value == token.value){
        this.second = m;
        this.second.nodeType = 'reference';
        return true;
      } 
      return false;
    });
    //    this.second.parent = token;
    this.nodeType = 'binary';
    advance();
    !this.type && (this.type = left.type);
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
      if (left.nodeType === 'name') {
        const ft = scope.find(left.value);
        if (ft.nodeType === 'function') {
          this.nodeType = 'call';
        }
      }
      this.first = left;
      this.rvalue = this.first.rvalue = rvalue;
      this.second = a;
      this.second.rvalue = true;
      if ((left.nodeType !== 'unary' || left.nodeType !== 'function') &&
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
    !this.type && (this.type = left.type);
    return this;
  });



  prefix('++');
  prefix('--');
  suffix('++').lbp = 70;
  suffix('--').lbp = 70;

  prefix('!');
  prefix('-');
  //prefix('typeof');

  // ポインタが示す実体を参照する
  prefix('*');
  // 変数のアドレスを取得する
  prefix('&');
  // ポインタメンバの参照
  infix('->', 80, function (left, rvalue = true) {
    this.first = left;
    this.rvalue = this.first.rvalue = rvalue;
    if (token.nodeType !== 'name') {
      error('Expected a property name.', token);
    }
    token.nodeType = 'literal';
    this.second = token;
    this.nodeType = 'binary';
    advance();
    !this.type && (this.type = left.type);
    return this;
  });


  prefix('(', function (rvalue = true) {
    const e = expression(0);
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
    !this.type && (this.type = this.first.type);
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
    this.third = expression(0);
    advance(')');
    // for文の本体
    this.fourth = block();
    this.nodeType = 'statement';
    return this;
  });

  function defineVarAndFunction() {
    //debugger;
    let a = [];
    let n;
    let t;
    advance();
    n = token;
    // ポインタ型かどうか
    if (n.id == '*') {
      advance();
      n = token;
      n.pointer = true;
    }
    let funcptr = false;
    // 関数ポインタ定義かどうか
    if (n.id == '(') {
      advance();
      advance('*');
      n = token;
      n.pointer = true;
      funcptr = true;
    }

    // ローカルスコープですでに定義されているか
    if (scope.def.get(n.value)) {
      error('Already Defined', n);
    }
    // 変数の型を保存
    n.type = this.type;
    if(this.userType){
      // ユーザー定義型の場合は型情報の参照を追加
      n.userType = this.userType;
      n.typeRef = this;
    }
    // export するかどうか
    n.export = this.export;
    // scope に変数名を登録する
    scope.define(n);
    advance();
    if (funcptr) {
      advance('*');
    }

    function assignMembers(node) {
      return node.members.map(m => {
        const member = Object.assign({}, m);
        if(!funcScope.global){
          member.stored = STORED_LOCAL;
          if(!member.userType){
            // ビルトイン型
            member.varIndex = funcScope.index();
          } 
        } else {
          member.stored = STORED_GLOBAL;
        }
        if (member.userType) {
          // ユーザー定義の場合はさらに掘り下げる
          member.members = assignMembers(m.typeRef);
        }
        return member;
      });
    }

    // 関数定義かどうか
    if (token.id === '(') {
      // 関数定義
      advance();
      // 関数内のスコープを開く
      createScope();
      funcScope.scopeIn();
      // 関数の引数があるか
      if (token.id !== ')') {
        // 引数を取り出して配列に格納する
        while (true) {
          if (token.nodeType !== 'define') {
            error('Expected a parameter name.', token);
          }
          advance();
          // 変数名
          const t = token;

          t.type = this.type;
          if(this.userType){
            t.userType = this.userType;
            t.typeRef = this;
          }
          scope.define(t);
          t.rvalue = false;
          advance();
          // 初期値代入
          if (token.id === '=') {

            //const temp = token;
            advance('=');
            t.rvalue = false;
            t.initialExpression = expression(0);
            //n.first = t;
            //debugger;
            //n.second = expression(0);
            //n.second.type = this.type;
            //n.assignment = true;
            //n.nodeType = 'binary';
          }

          if(t.userType){
            t.members = assignMembers(t.typeRef);
          } else {
            t.varIndex = funcScope.index();
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


      // 代入演算子
      if (token.id === '=') {
        // 初期値あり
        //t = token;
        advance('=');
        //t.first = n;
        // 右辺値ではない
        //t.rvalue = t.first.rvalue = false;
        n.rvalue = false;
        //debugger;
        //t.second = expression(0);
        n.initialExpression = expression(0);
        // TODO:型情報は式から得るようにしなければならない
        //t.second.type = this.type;
        //t.nodeType = 'binary';
        a.push(n);
      } else {
        a.push(n);
      }

      // カンマ演算子
      if (token.id !== ',') {
        break;
      }
      advance(',');
      // ポインタ型かどうか
      if (token.id == '*') {
        advance();
        n = token;
        n.pointer = true;
      } else {
        n = token;
      }
      n.type = this.type;
      if(this.userType){
        // ユーザー定義型の場合は型情報の参照を追加
        n.userType = this.userType;
        n.typeRef = this;
      }
      n.rvalue = false;
      scope.define(n);
      advance();
    }

    advance(';');
    a.forEach(d => {
      const ret = d;
      //const ret = d;//Object.assign(Object.create(d), d);
      if (!funcScope.global && !ret.userType) {
        // ビルトイン型
        ret.varIndex = funcScope.index();
        ret.stored = STORED_LOCAL;
      } else {
        ret.stored = STORED_GLOBAL;
      }

      if (ret.userType) {
        // ユーザー定義型
        ret.members = assignMembers(d.typeRef);
      }
      //ret.parent = this;
      //ret.id = 'define';
      ret.nodeType = 'define';
      ret.type = this.type;
      //return ret;
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
    this.value = token.value;
    this.type = token.value;
    this.id = token.value;

    advance();
    switch (token.id) {
    case '{':
    {
      // クラス定義
      this.nodeType = 'class';
      this.userType = true;
      this.typedef = true;
      advance();
      const defs = [];
      let access = constants.ACCESS_PUBLIC;// privateから始まる。
      createScope();

      while (token.id != "}") {
        switch (token.value) {
        case 'public':
          access = ACCESS_PUBLIC;
          advance();
          advance(':');
          break;
        case 'private':
          access = ACCESS_PRIVATE;
          advance();
          advance(':');
          break;
        case 'protected':
          access = ACCESS_PROTECTED;
          advance();
          advance(':');
          break;
        default:
          {
            const def = defineVarAndFunction.bind(token)();
            def.forEach(d => d.access = access);
            defs.push(...def);
          }
          break;
        }
      }
      advance('}');
      advance(';');
      scope.pop();
      this.members = defs;
      this.dvd = defineVarAndFunction;
      //const t = this.first.value;
      // 型をスコープに登録
      scope.define(this);
      return this;
    }
    // 型エイリアス

    case '=':
      break;
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
    // ビルトイン 型
    ['u32', 'u64', 'i32', 'i64', 'f32', 'f64', 'void', 'string']
      .forEach(t => {
        scope.define({ id: 'type', value: t, type: t, nodeType: 'builtin', typedef: true, dvd: defineVarAndFunction, userType: false });
      });
    advance();
    const s = statements();
    advance('(end)');
    scope.pop();
    return {
      id: '(program)',
      scope: scopeTop,
      statements: s
    };
  };
}
