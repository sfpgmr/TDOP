// preprocess.mjs

function error(message, t = this) {
  t.name = 'Parser : SyntaxError';
  t.message = message;
  throw t;
}


// パーサの生成
export default function make_parse() {
  const symbol_table = new Map();
  let token;
  let tokens;
  let token_nr;
  let scope;

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
    if (value && token.value !== value) {
      error('Expected "' + value + '".', token);
    }
    if (token_nr >= tokens.length) {
      token = symbol_table.get('(end)');
      return;
    }
    t = tokens[token_nr];
    token_nr += 1;
    a = t.type;
    v = t.value
    switch(a){
      case 'Name':
        o = scope.find(v, false);
        if (!o) o = symbol_table.get('(name)');
        break;
      case 'Operator':
        o = symbol_table.get(v);
        if (!o) {
          error('Unknown operator.', t);
        }
        break;
      case 'NewLine':
        
        break;
      default:
        error('Unexpected token.', t);
    }

    token = Object.assign(Object.create(o),o);
    token.location = t.location;
    token.value =  v;
    token.nodeType = a;

    return token;
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
      const ret = n.dvd(false);
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
      if (token.id === '(end)') {
        break;
      }
      s = statement();
      setDefaultType();

      if (s instanceof Array) {
        a.push(...s);
      } else {
        a.push(s);
      }
    }
    return a;
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

      this.nodeType = 'binary';
      return this;
    }
  }

  function infix(id, bp, led) {
    return symbol({ id: id, bp: bp, led: led || Infix.prototype.led, cons: Infix });
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
      this.nodeType = 'binary';
      return this;
    }
  }

  function infixr(id, bp, led) {
    return symbol({ id: id, bp: bp, led: led || Infixr.prototype.led, cons: Infixr });
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
      this.assignment = true;
      this.nodeType = 'binary';
      return this;
    }
  }

  function assignment(id) {
    return symbol({ id: id, bp: 10, led: Assignment.prototype.led, cons: Assignment });
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
      this.nodeType = 'unary';
      return this;
    }
  }

  function prefix(id, nud) {
    return symbol({ id: id, nud: nud || Prefix.prototype.nud, cons: Prefix });
  }

  function suffix(id, led = function (left, rvalue = true) {
    this.first = left;
    this.rvalue = this.first.rvalue = rvalue;
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

  sym('(literal)').nud = itself;

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
    return this;
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

  infix('<<',45);//shl
  infix('>>',45);//shr_s
  infix('&',43);// and
  infix('|',43);// or
  infix('^',43);// xor

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
      if ((left.nodeType !== 'unary' || left.nodeType !== 'function') &&  left.nodeType !== 'reference' &&
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
    return this;
  });

  prefix('!');
  prefix('-');
  prefix('~',80);

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

  return function (t) {
    const sourceFiles = [];
    //tokens = t;
    //token_nr = 0;
    scopeTop = createScope();
    for(const node of t){
     switch(node.type){
      case 'PreprocessorDirective':
        break;
      case 'SourceTexts':
        sourceFiles.push(node);
        break;
     }
    }
    scope.pop();
    return {
      scope: scopeTop,
      sources: s
    };
  };
}
