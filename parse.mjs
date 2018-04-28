// parse.js
// Parser for Simplified JavaScript written in Simplified JavaScript
// From Top Down Operator Precedence
// http://javascript.crockford.com/tdop/index.html
// Douglas Crockford
// 2016-02-15

//jslint for, this

function error(message, t = this) {
  t.name = 'Parser : SyntaxError';
  t.message = message;
  throw t;
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

  function createScope(){
    const s = new Scope(scope);
    scope = s;
    return s;  
  }
  
  function itself() {
    return this;
  }
  
  class Scope {
    constructor(s){
      this.def = new Map();
      this.typedef = new Map();
      this.parent = s;
    }
  
    define(n)
    {
      const def = n.typedef ? this.typedef : this.def;
      const t = def.get(n.value);
      if (t) {
        error((t.reserved)
          ? 'Already reserved.'
          : 'Already defined.',n);
      }
      def.set(n.value,n);
      n.reserved = false;
      n.nud = itself;
      n.led = null;
      n.std = null;
      n.lbp = 0;
      n.scope = scope;
      return n;     
    }
  
    find(n,typedef = n.typedef) {
      if(!typedef){
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
            return e.typedef.get(n);
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
          error('Already defined.',n);
        }
      }
      def.set(n.value,n);
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
      error('Expected "' + id + '".',token);
    }
    if (token_nr >= tokens.length) {
      token = symbol_table.get('(end)');
      return;
    }
    t = tokens[token_nr];
    token_nr += 1;
    v = t.value;
    a = t.type;
    if (a === 'name') {
      // 型名かどうか
      o = scope.find(v,true);
      // 変数名かどうか
      if(!o) o = scope.find(v,false);
      if(!o) o = symbol_table.get('(name)');

    } else if (a === 'operator') {
      o = symbol_table.get(v);
      if (!o) {
        error('Unknown operator.',t);
      }
    } else if (a == 'string' || a == 'int' || a == 'f64' || a == 'f32' || a== 'i32' || a == 'i64' || a=='u32' || a== 'u64') {
      o = symbol_table.get('(literal)');
      type = a;
      a = 'literal';
      if(a.substr(0,1) == 'i'){
        sign = true;
      } else {
        sign = false;
      }

    } else {
      error('Unexpected token.',t);
    }

    token = Object.assign(Object.create(o),o);
    token.line = t.line;
    token.pos = t.pos;
    token.value = o.typedef ? o.value : v;
    token.nodeType = o.typedef ? o.nodeType : a;
    token.sign = sign;
    type && (token.type = type);
    t.kind && (token.kind = t.kind);

    return token;
  }

  function expression(rbp) {
    //debugger;
    let left;
    let t = token;
    advance();
    left = t.nud();
    while (rbp < token.lbp) {
      t = token;
      advance();
      left = t.led(left);
      !t.type && (t.type = left.type);
    }
    return left;
  }

  function statement() {
    const n = token;
    let v;

    // ステートメント
    if (n.std) {
      advance();
      scope.reserve(n);
      return n.std();
    }

    // 変数定義
    if(n.dvd){
      return n.dvd();
    }

    // 式
    v = expression(0);
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

      if (s) {
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
    constructor({id ,value,bp = 0,nud,led,std}){
      this.id = id;
      this.value = value;
      this.lbp = bp;
      (typeof nud === 'function') && (this.nud = nud);
      (typeof led === 'function') && (this.led = led);
      (typeof std === 'function') && (this.std = std);
    }
    nud(){
      error('Undefined.',this);
    }
    led(){
      error('Missing operator.',this);
    }
  }

  function symbol({id, bp = 0,value,nud,led,std,cons}) {
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
      symbol_table.set(id,s);
    } else {
      const params = {id:id,value:value?value:id,bp:bp,nud:nud,led:led,std:std};
      s = cons ? new cons(params) : new SymbolBase(params);
      symbol_table.set(id,s);
    }
    return s;
  }

  function sym(s){
    return symbol({id:s});
  }

  class Constant extends SymbolBase {
    constructor({id,value,bp}){
      super({id:id,value:value?value:id,bp:bp});
    }
    nud(){
      scope.reserve(this);
      this.value = symbol_table.get(this.id).value;
      this.nodeType = 'literal';
      return this;
    }
  }

  function constant(s, v) {
    return symbol({id:s,value:v,nud:Constant.prototype.nud,cons:Constant});
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
    constructor({id,bp,led}){
      super({id:id,bp:bp});
      (typeof led === 'function')  && (this.led = led);
    }
    led(left){
      this.first = left;
      this.second = expression(this.lbp);
      !this.type  && (this.type = left.type);
      // if(this.first.type != this.second.type){
      //   this.error('type unmatched.');
      // }
      this.nodeType = 'binary';
      return this;      
    }
  }

  function infix(id, bp, led) {
    return symbol({id:id,bp:bp,led:led || Infix.prototype.led,cons:Infix});
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
    constructor({id,bp,led}){
      super({id:id,bp:bp});
      (typeof led === 'function')  && (this.led = led);
    }
    led(left){
      this.first = left;
      this.second = expression(this.lbp - 1);
      !this.type && (this.type = left.type);
      this.nodeType = 'binary';
      return this;
    }
  }

  function infixr(id, bp, led) {
    return symbol({id:id,bp:bp,led:led || Infixr.prototype.led,cons:Infixr});
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
    constructor({id}){
      super({id:id,bp:10});
    }
    led(left){
      if (left.id !== '.' && left.id !== '[' && left.nodeType !== 'name') {
        error('Bad lvalue.',left);
      }
      this.first = left;
      this.second = expression(this.lbp - 1);
      !this.type && (this.type = left.type);
      this.assignment = true;
      this.nodeType = 'binary';
      return this;
    }
  }

  function assignment(id) {
    return symbol({id:id,bp:10,led:Assignment.prototype.led,cons:Assignment});
    // return infixr(id, 10, function (left) {
    //   if (left.id !== '.' && left.id !== '[' && left.nodeType !== 'name') {
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
    constructor({id,nud}){
      super({id:id});
      if(typeof nud === 'function' ) this.nud = nud;
    }
    nud(){
      scope.reserve(this);
      this.first = expression(70);
      !this.type && (this.type = this.first.type);
      this.nodeType = 'unary';
      return this;
    }
  }

  function prefix(id, nud) {
    return symbol({id:id,nud:nud || Prefix.prototype.nud,cons:Prefix});
    // const s = symbol(id);
    // s.nud = nud || function () {
    //   scope.reserve(this);
    //   this.first = expression(70);
    //   this.nodeType = 'unary';
    //   return this;
    // };
    // return s;
  }

  function suffix(id,led = function(left){
    this.first = left;
    !this.type && (this.type = left.type);
    this.nodeType = 'suffix';
    return this;
  }){
    return symbol({id:id,led:led});
  }

  class Statement extends SymbolBase {
    constructor(id,std){
      super({id:id,std:std});
    }
  }

  function stmt(id, std) {
    return symbol({id:id,std:std});    
    // const x = symbol(s);
    // x.std = f;
    // return x;
  }

  sym('(end)');

  function defVar(){
    //debugger;
    let a = [];
    let n;
    let t;
    advance();

    n = token;
      
    // ローカルスコープですでに定義されているか
    if(scope.def.get(n.value)){
      error('Already Defined',n);
    }

    n.type = this.type;
    n.export = this.export;
    scope.define(n);
    advance();

    // 関数定義かどうか
    if (token.id === '(') {
      advance();
      // ローカル・スコープを開く
      createScope();
      if (token.id !== ')') {
      // 変数を取り出して配列に格納する
        while (true) {
          if (token.nodeType !== 'define') {
            error('Expected a parameter name.',token);
          }
          advance();
          const t = token;
          t.type = this.type;
          scope.define(t);
          advance();
          
          if (token.id === '=') {
            const n = token;
            advance('=');
            n.first = t;
            //debugger;
            n.second = expression(0);
            n.second.type = this.type;
            n.assignment = true;
            n.nodeType = 'binary';
            a.push(n);
          } else {
            a.push(t);
          }

          if (token.id !== ',') {
            break;
          }
          advance(',');
        }
      }
      // ツリーの左に格納
      n.first = a;
      advance(')');
      // 戻り値の型の指定
      advance('{');
      // ツリーの右に文を格納
      n.second = statements();
      n.scope = scope;
      scope.pop();
      advance('}');
      n.nodeType = 'function';
      return n;
    }

    while (true) {
      n.nud = itself;
      // 代入演算子
      if (token.id === '=') {
        t = token;
        advance('=');
        t.first = n;
        //debugger;
        t.second = expression(0);
        t.second.type = this.type;

        t.nodeType = 'binary';
        a.push(t);
      } else {
        a.push(n);
      }

      // カンマ演算子
      if (token.id !== ',') {
        break;
      }
      advance(',');
      n = token;
      n.type = this.type;
      scope.define(n);
      advance();
    }

    advance(';');

    this.first = a;

    return this;
    // return (a.length === 0)
    //   ? null
    //   : (a.length === 1)
    //     ? a[0]
    //     : a;
  }

  stmt('export',function(){
    token.export = true;
    return defVar.bind(token)();
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

  infix('?', 20, function (left) {
    this.first = left;
    this.second = expression(0);
    advance(':');
    this.third = expression(0);
    this.nodeType = 'ternary';
    !this.type && (this.type = left.type);
    return this;
  });

  infix(':', 20, function (left) {
    this.first = left;
    advance();
    !this.type && (this.type = left.type);
    this.second = token.name;

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

  infix('.', 80, function (left) {
    this.first = left;
    if (token.nodeType !== 'name') {
      error('Expected a property name.',token);
    }
    token.nodeType = 'literal';
    this.second = token;
    this.nodeType = 'binary';
    advance();
    !this.type && (this.type = left.type);
    return this;
  });

  infix('[', 80, function (left) {
    this.first = left;
    this.second = expression(0);
    this.nodeType = 'binary';
    advance(']');
    return this;
  });

  infix('(', 80, function (left) {
    var a = [];
    if (left.id === '.' || left.id === '[') {
      this.nodeType = 'ternary';
      this.first = left.first;
      this.second = left.second;
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
      this.second = a;
      if ((left.nodeType !== 'unary' || left.nodeType !== 'function') &&
                left.nodeType !== 'name' && left.id !== '(' &&
                left.id !== '&&' && left.id !== '||' && left.id !== '?') {
        error('Expected a variable name.',left);
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

  prefix('(', function () {
    const e = expression(0);
    advance(')');
    return e;
  });

  prefix('[', function () {
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
          error('Bad property name.',token);
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
      error('Unreachable statement.',token);
    }
    this.nodeType = 'statement';
    !this.type && (this.type = this.first.type);
    return this;
  });

  stmt('break', function () {
    advance(';');
    if (token.id !== '}') {
      error('Unreachable statement.',token);
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
  

  return function (t) {
    tokens = t;
    //        tokens = source.tokens('=<>!+-*&|/%^', '=<>&|');
    token_nr = 0;
    //scope = null;
    //new Scope();
    //global = scope;
    scopeTop = createScope();
    // ビルトイン変数
    ['u32','u64','i32','i64','f32','f64','void','string']
      .forEach(t=>{
        scope.define({id:t,value:t,type:t,nodeType:'define',typedef:true,dvd:defVar});
      });
    advance();
    const s = statements();
    advance('(end)');
    scope.pop();
    return {
      id:'(program)',
      scope: scopeTop,
      first:s
    };
  };
}
