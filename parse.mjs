// parse.js
// Parser for Simplified JavaScript written in Simplified JavaScript
// From Top Down Operator Precedence
// http://javascript.crockford.com/tdop/index.html
// Douglas Crockford
// 2016-02-15

//jslint for, this

Object.prototype.error = function (message, t) {
  t = t || this;
  t.name = 'SyntaxError';
  t.message = message;
  throw t;
};

// パーサの生成
export default function make_parse() {
  let scope;
  const symbol_table = new Map();
  let token;
  let tokens;
  let token_nr;
  const labels = new Map();
  

  function itself() {
    return this;
  }

  // Scope
  class Scope {
    constructor(){
      this.def = new Map();
      this.typedef = new Map();
      this.parent = scope;
      scope = this;
    }

    define(n)
    {
      const def = n.typedef ? this.typedef : this.def;
      const t = def.get(n.value);
      if (t) {
        n.error((t.reserved)
          ? 'Already reserved.'
          : 'Already defined.');
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
          o = this.def.get(n);
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
          o = this.typedef.get(n);
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
          n.error('Already defined.');
        }
      }
      def.set(n.value,n);
      n.reserved = true;
    }          
  }

  const global = new Scope();


  // var original_scope = {
  //   define(n,typedef = false) {
  //     const def = typedef?this.def:this.typedef;
  //     const t = def[n.value];

  //     if (typeof t === 'object') {
  //       n.error((t.reserved)
  //         ? 'Already reserved.'
  //         : 'Already defined.');
  //     }
  //     this.def[n.value] = n;
  //     n.reserved = false;
  //     n.nud = itself;
  //     n.led = null;
  //     n.std = null;
  //     n.lbp = 0;
  //     n.scope = scope;
  //     return n;
  //   },
  //   find(n) {
  //     var e = this;
  //     var o;
  //     while (true) {
  //       o = e.def[n];
  //       if (o && typeof o !== 'function') {
  //         return e.def[n];
  //       }
  //       e = e.parent;
  //       if (!e) {
  //         o = symbol_table[n];
  //         return (o && typeof o !== 'function')
  //           ? o
  //           : symbol_table['(name)'];
  //       }
  //     }
  //   },
  //   pop() {
  //     scope = this.parent;
  //   },
  //   // 予約語
  //   reserve(n) {
  //     if (n.nodeType !== 'name' || n.reserved) {
  //       return;
  //     }
  //     var t = this.def[n.value];
  //     if (t) {
  //       if (t.reserved) {
  //         return;
  //       }
  //       if (t.nodeType === 'name') {
  //         n.error('Already defined.');
  //       }
  //     }
  //     this.def[n.value] = n;
  //     n.reserved = true;
  //   }
  // };

  // function new_scope() {
  //   var s = scope;
  //   scope = new Scope(s);
  //   //    scope.def = {};
  //   //    scope.parent = s;
  //   return scope;
  // }

  function advance(id) {
    let a;
    let o;
    let t;
    let v;
    if (id && token.id !== id) {
      token.error('Expected "' + id + '".');
    }
    if (token_nr >= tokens.length) {
      token = symbol_table['(end)'];
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
        t.error('Unknown operator.');
      }
    } else if (a === 'string' || a === 'number') {
      o = symbol_table.get('(literal)');
      a = 'literal';
    } else {
      t.error('Unexpected token.');
    }

    token = Object.create(o);
    token.line = t.line;
    token.from = t.from;
    token.to = t.to;
    token.value = o.typedef ? o.value : v;
    token.nodeType = o.typedef ? o.nodeType : a;

    return token;
  }

  function expression(rbp) {
    let left;
    let t = token;
    advance();
    left = t.nud();
    while (rbp < token.lbp) {
      t = token;
      advance();
      left = t.led(left);
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
    
    if (!v.assignment && v.id !== '(') {
      v.error('Bad expression statement.');
    }
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
    return a.length === 0
      ? null
      : a.length === 1
        ? a[0]
        : a;
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
      this.error('Undefined.');
    }
    led(){
      this.error('Missing operator.');
    }
    std(){
      this.error('Not Impl.');
    }
  }

  // const original_symbol = {
  //   nud() {
  //     this.error('Undefined.');
  //   },
  //   led(ignore) {
  //     this.error('Missing operator.');
  //   }
  // };

  function symbol({id, bp = 0,value,nud,led,std,cons}) {
    let s = symbol_table.get(id);
    bp = bp || 0;
    if (s) {
      if (bp >= s.lbp) {
        s.lbp = bp;
      }
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
    return symbol({id:s,value:v,cons:Constant});
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
      this.nodeType = 'binary';
      return this;      
    }
  }

  function infix(id, bp, led) {
    return symbol({id:id,bp:bp,led:led,cons:Infix});
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
      this.nodeType = 'binary';
      return this;
    }
  }

  function infixr(id, bp, led) {
    return symbol({id:id,bp:bp,led:led,cons:Infixr});
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
    constructor(id){
      super({id:id,bp:10});
    }
    led(left){
      if (left.id !== '.' && left.id !== '[' && left.nodeType !== 'name') {
        left.error('Bad lvalue.');
      }
      this.first = left;
      this.second = expression(this.lbp - 1);
      this.assignment = true;
      this.nodeType = 'binary';
      return this;
    }
  }

  function assignment(id) {
    return symbol({id:id,cons:Assignment});
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
      this.nodeType = 'unary';
      return this;
    }
  }

  function prefix(id, nud) {
    return symbol({id:id,nud:nud,cons:Prefix});
    // const s = symbol(id);
    // s.nud = nud || function () {
    //   scope.reserve(this);
    //   this.first = expression(70);
    //   this.nodeType = 'unary';
    //   return this;
    // };
    // return s;
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
    let a = [];
    let n;
    let t;
    debugger;
    advance();

    n = token;
      
    // ローカルスコープですでに定義されているか
    if(scope.def.get(n.value)){
      n.error('Already Defined');
    }

    n.type = this.type;
    scope.define(n);
    advance();

    // 関数定義かどうか
    if (token.id === '(') {
      advance();
      // ローカル・スコープを開く
      new Scope();
      if (token.id !== ')') {
      // 変数を取り出して配列に格納する
        while (true) {
          const t = token;
          if (token.nodeType !== 'define') {
            token.error('Expected a parameter name.');
          }
          advance();
          token.type = t.type;
          scope.define(token);
          a.push(token);
          advance();
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
      scope.pop();
      advance('}');
      n.nodeType = 'function';
      return n;
    }

    while (true) {
      // 代入演算子
      if (token.id === '=') {
        t = token;
        advance('=');
        t.first = n;
        //debugger;
        t.second = expression(0);
        t.second.type = this.value;

        t.nodeType = 'binary';
        a.push(t);
      }

      a.push(n);
      // カンマ演算子
      if (token.id !== ',') {
        break;
      }
      advance(',');
      n = token;
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

  // function stmt_std () {
  //   let a = [];
  //   let n;
  //   let t;

  //   while (true) {

  //     n = token;

  //     // 型名かどうか
  //     let n1 = scope.find(n,true);
  //     if(n1){
  //       // 型名である
  //       n.type = n1.type;
  //       n.typedef = true;
  //       advance();

  //     } else {
  //       // 変数名かどうか
  //       let nvar = scope.find(n,false);
  //       if(!nvar){
  //         n.error('Undefined variable.');
  //       }
  //       n = nvar;
  //     }

  //     // if (n.nodeType !== 'name') {
  //     //   n.error('Expected a new variable name.');
  //     // }
  //     scope.define(n);
  //     n.type = this.value;
  //     advance();
  //     // 関数定義かどうか
  //     if (token.id === '(') {
  //       advance();
  //       // ローカル・スコープを開く
  //       new Scope();
  //       if (token.id !== ')') {
  //         // 変数を取り出して配列に格納する
  //         while (true) {
  //           const t = token;
  //           if (token.nodeType !== 'name') {
  //             token.error('Expected a parameter name.');
  //           }
  //           advance();
  //           token.type = t.value;
  //           scope.define(token);
  //           a.push(token);
  //           advance();
  //           if (token.id !== ',') {
  //             break;
  //           }
  //           advance(',');
  //         }
  //       }
  //       // ツリーの左に格納
  //       n.first = a;
  //       advance(')');
  //       // 戻り値の型の指定
  //       advance('{');
  //       // ツリーの右に文を格納
  //       n.second = statements();
  //       scope.pop();
  //       advance('}');
  //       n.nodeType = 'function';
  //       return n;
  //     }

  //     if (token.id === '=') {
  //       t = token;
  //       advance('=');
  //       t.first = n;
  //       //debugger;
  //       t.second = expression(0);
  //       t.second.type = this.value;

  //       t.nodeType = 'binary';
  //       a.push(t);
  //     }

  //     a.push(n);

  //     if (token.id !== ',') {
  //       break;
  //     }
  //     advance(',');
  //   }
  //   advance(';');
  //   return (a.length === 0)
  //     ? null
  //     : (a.length === 1)
  //       ? a[0]
  //       : a;
  // }

  // stmt('u32',stmt_std);
  // stmt('u64',stmt_std);
  // stmt('i32',stmt_std);
  // stmt('i64',stmt_std);
  // stmt('f32',stmt_std);
  // stmt('f64',stmt_std);
  // stmt('void',stmt_std);

  stmt('(name)');
  // stmt('(name)',function () {
  //   // debugger;
  //   if(scope.find(this.value).id === '(name)'){
  //     this.error('undefined type.');
  //   }

  //   // return stmt_std.bind(this)();
  //   return stmt_std();

  // });

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
    return this;
  });

  infix(':', 20, function (left) {
    this.first = left;
    advance();
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
      token.error('Expected a property name.');
    }
    token.nodeType = 'literal';
    this.second = token;
    this.nodeType = 'binary';
    advance();
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
        left.error('Expected a variable name.');
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
  prefix('typeof');

  prefix('(', function () {
    const e = expression(0);
    advance(')');
    return e;
  });

  // const func_ = function () {
  //     // 引数を格納する配列
  //     let a = [];

  //     // 関数名がついてるかどうか
  //     if (token.nodeType === 'name') {
  //         // 名前があれば現在のスコープに定義する
  //         scope.define(token);
  //         // 関数名
  //         this.name = token.value;
  //         advance();
  //     }
  //     // ローカル・スコープを開く
  //     new_scope();
  //     // 1つ進める
  //     advance('(');// 期待する文字は ')'
  //     if (token.id !== ')') {
  //         // 変数を取り出して配列に格納する
  //         while (true) {
  //             if (token.nodeType !== 'name') {
  //                 token.error('Expected a parameter name.');
  //             }
  //             scope.define(token);
  //             a.push(token);
  //             advance();
  //             if (token.id !== ',') {
  //                 break;
  //             }
  //             advance(',');
  //         }
  //     }
  //     // ツリーの左に格納
  //     this.first = a;
  //     advance(')');
  //     // 戻り値の型の指定
  //     advance('{');
  //     // ツリーの右に文を格納
  //     this.second = statements();
  //     scope.pop();
  //     advance('}');
  //     this.nodeType = 'function';
  //     return this;
  // };

  // // function式・文
  // prefix('function', func_)
  //     .std = func_;

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
          token.error('Bad property name.');
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
    new Scope();
    var a = statements();
    scope.pop();
    advance('}');
    return a;
  });


  // stmt('var', function () {
  //     var a = [];
  //     var n;
  //     var t;
  //     while (true) {
  //         n = token;
  //         if (n.nodeType !== 'name') {
  //             n.error('Expected a new variable name.');
  //         }
  //         scope.define(n);
  //         advance();
  //         if(token.id !== ':'){
  //             token.error('no type specified.');
  //         }
  //         advance(':');
  //         debugger;
  //         const tp = symbol_table[token.value];
  //         if(!tp) token.error('illegal type specified.');
  //         n.type = tp.id;
  //         advance();
  //         if (token.id === '=') {
  //             t = token;
  //             advance('=');
  //             t.first = n;
  //             t.second = expression(0);
  //             t.second.type = tp.id;
  //             t.nodeType = 'binary';
  //             a.push(t);
  //         }
  //         if (token.id !== ',') {
  //             break;
  //         }
  //         advance(',');
  //     }
  //     advance(';');
  //     return (a.length === 0)
  //         ? null
  //         : (a.length === 1)
  //             ? a[0]
  //             : a;
  // });

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
      token.error('Unreachable statement.');
    }
    this.nodeType = 'statement';
    return this;
  });

  stmt('break', function () {
    advance(';');
    if (token.id !== '}') {
      token.error('Unreachable statement.');
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

  return function (t) {
    //debugger;
    tokens = t;
    //        tokens = source.tokens('=<>!+-*&|/%^', '=<>&|');
    token_nr = 0;
    //scope = null;
    //new Scope();
    //global = scope;
 
    // ビルトイン変数
    ['i32','i64','u32','u64','f32','f64']
      .forEach(t=>{
        scope.define({id:t,value:t,type:t,nodeType:'define',typedef:true,dvd:defVar});
      });
    advance();
    const s = statements();
    advance('(end)');
    scope.pop();
    return s;
  };
}
