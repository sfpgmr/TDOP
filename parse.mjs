// parse.js
// Parser for Simplified JavaScript written in Simplified JavaScript
// From Top Down Operator Precedence
// http://javascript.crockford.com/tdop/index.html
// Douglas Crockford
// 2016-02-15

//jslint for, this

Object.prototype.error = function (message, t) {
  t = t || this;
  t.name = "SyntaxError";
  t.message = message;
  throw t;
};

export default function make_parse() {
  var scope;
  var symbol_table = {};
  var token;
  var tokens;
  var token_nr;

  function itself() {
    return this;
  }

  var original_scope = {
    define(n) {
      var t = this.def[n.value];
      if (typeof t === "object") {
        n.error((t.reserved)
          ? "Already reserved."
          : "Already defined.");
      }
      this.def[n.value] = n;
      n.reserved = false;
      n.nud = itself;
      n.led = null;
      n.std = null;
      n.lbp = 0;
      n.scope = scope;
      return n;
    },
    find(n) {
      var e = this;
      var o;
      while (true) {
        o = e.def[n];
        if (o && typeof o !== "function") {
          return e.def[n];
        }
        e = e.parent;
        if (!e) {
          o = symbol_table[n];
          return (o && typeof o !== "function")
            ? o
            : symbol_table["(name)"];
        }
      }
    },
    pop() {
      scope = this.parent;
    },
    reserve(n) {
      if (n.arity !== "name" || n.reserved) {
        return;
      }
      var t = this.def[n.value];
      if (t) {
        if (t.reserved) {
          return;
        }
        if (t.arity === "name") {
          n.error("Already defined.");
        }
      }
      this.def[n.value] = n;
      n.reserved = true;
    }
  };

  function new_scope() {
    var s = scope;
    scope = Object.create(original_scope);
    scope.def = {};
    scope.parent = s;
    return scope;
  }

  function advance(id) {
    var a;
    var o;
    var t;
    var v;
    if (id && token.id !== id) {
      token.error("Expected '" + id + "'.");
    }
    if (token_nr >= tokens.length) {
      token = symbol_table["(end)"];
      return;
    }
    t = tokens[token_nr];
    token_nr += 1;
    v = t.value;
    a = t.type;
    if (a === "name") {
      o = scope.find(v);
    } else if (a === "operator") {
      o = symbol_table[v];
      if (!o) {
        t.error("Unknown operator.");
      }
    } else if (a === "string" || a === "number") {
      o = symbol_table["(literal)"];
      a = "literal";
    } else {
      t.error("Unexpected token.");
    }
    token = Object.create(o);
    token.line = t.line;
    token.from = t.from;
    token.to = t.to;
    token.value = v;
    token.arity = a;
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

    if (n.std) {
      advance();
      scope.reserve(n);
      return n.std();
    }
    v = expression(0);
    if (!v.assignment && v.id !== "(") {
      v.error("Bad expression statement.");
    }
    advance(";");
    return v;
  }

  function statements() {
    const a = [];
    let s;
    while (true) {
      if (token.id === "}" || token.id === "(end)") {
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
    advance("{");
    return t.std();
  }

  const original_symbol = {
    nud() {
      this.error("Undefined.");
    },
    led(ignore) {
      this.error("Missing operator.");
    }
  };

  function symbol(id, bp) {
    let s = symbol_table[id];
    bp = bp || 0;
    if (s) {
      if (bp >= s.lbp) {
        s.lbp = bp;
      }
    } else {
      s = Object.create(original_symbol);
      s.id = id;
      s.value = id;
      s.lbp = bp;
      symbol_table[id] = s;
    }
    return s;
  }

  function constant(s, v) {
    const x = symbol(s);
    x.nud = function () {
      scope.reserve(this);
      this.value = symbol_table[this.id].value;
      this.arity = "literal";
      return this;
    };
    x.value = v;
    return x;
  }

  function infix(id, bp, led) {
    const s = symbol(id, bp);
    s.led = led || function (left) {
      this.first = left;
      this.second = expression(bp);
      this.arity = "binary";
      return this;
    };
    return s;
  }

  function infixr(id, bp, led) {
    const s = symbol(id, bp);
    s.led = led || function (left) {
      this.first = left;
      this.second = expression(bp - 1);
      this.arity = "binary";
      return this;
    };
    return s;
  }

  function assignment(id) {
    return infixr(id, 10, function (left) {
      if (left.id !== "." && left.id !== "[" && left.arity !== "name") {
        left.error("Bad lvalue.");
      }
      this.first = left;
      this.second = expression(9);
      this.assignment = true;
      this.arity = "binary";
      return this;
    });
  }

  function prefix(id, nud) {
    var s = symbol(id);
    s.nud = nud || function () {
      scope.reserve(this);
      this.first = expression(70);
      this.arity = "unary";
      return this;
    };
    return s;
  }

  function stmt(s, f) {
    var x = symbol(s);
    x.std = f;
    return x;
  }

  symbol("(end)");
  symbol("(name)");
  symbol(":");
  symbol(";");
  symbol(")");
  symbol("]");
  symbol("}");
  symbol(",");
  symbol("else");

  constant("true", true);
  constant("false", false);
  constant("null", null);
  constant("pi", 3.141592653589793);
  constant("Object", {});
  constant("Array", []);

  symbol('u32');
  symbol('u64');
  symbol('i32');
  symbol('i64');
  symbol('f32');
  symbol('f64');

  symbol("(literal)").nud = itself;

  symbol("this").nud = function () {
    scope.reserve(this);
    this.arity = "this";
    return this;
  };

  assignment("=");
  assignment("+=");
  assignment("-=");

  infix("?", 20, function (left) {
    this.first = left;
    this.second = expression(0);
    advance(":");
    this.third = expression(0);
    this.arity = "ternary";
    return this;
  });

  infix(":", 20, function (left) {
    this.first = left;
    advance();
    this.second = token.name;

  });

  infixr("&&", 30);
  infixr("||", 30);

  infixr("===", 40);
  infixr("!==", 40);
  infixr("<", 40);
  infixr("<=", 40);
  infixr(">", 40);
  infixr(">=", 40);

  infix("+", 50);
  infix("-", 50);

  infix("*", 60);
  infix("/", 60);

  infix(".", 80, function (left) {
    this.first = left;
    if (token.arity !== "name") {
      token.error("Expected a property name.");
    }
    token.arity = "literal";
    this.second = token;
    this.arity = "binary";
    advance();
    return this;
  });

  infix("[", 80, function (left) {
    this.first = left;
    this.second = expression(0);
    this.arity = "binary";
    advance("]");
    return this;
  });

  infix("(", 80, function (left) {
    var a = [];
    if (left.id === "." || left.id === "[") {
      this.arity = "ternary";
      this.first = left.first;
      this.second = left.second;
      this.third = a;
    } else {
      this.arity = "binary";
      if (left.arity === 'name') {
        const ft = scope.find(left.value);
        if (ft.arity === 'function') {
          this.arity = "call";
        }
      }
      this.first = left;
      this.second = a;
      if ((left.arity !== "unary" || left.arity !== "function") &&
                left.arity !== "name" && left.id !== "(" &&
                left.id !== "&&" && left.id !== "||" && left.id !== "?") {
        left.error("Expected a variable name.");
      }
    }
    if (token.id !== ")") {
      while (true) {
        a.push(expression(0));
        if (token.id !== ",") {
          break;
        }
        advance(",");
      }
    }
    advance(")");
    return this;
  });


  prefix("!");
  prefix("-");
  prefix("typeof");

  prefix("(", function () {
    var e = expression(0);
    advance(")");
    return e;
  });

  // const func_ = function () {
  //     // 引数を格納する配列
  //     let a = [];

  //     // 関数名がついてるかどうか
  //     if (token.arity === "name") {
  //         // 名前があれば現在のスコープに定義する
  //         scope.define(token);
  //         // 関数名
  //         this.name = token.value;
  //         advance();
  //     }
  //     // ローカル・スコープを開く
  //     new_scope();
  //     // 1つ進める
  //     advance("(");// 期待する文字は ')'
  //     if (token.id !== ")") {
  //         // 変数を取り出して配列に格納する
  //         while (true) {
  //             if (token.arity !== "name") {
  //                 token.error("Expected a parameter name.");
  //             }
  //             scope.define(token);
  //             a.push(token);
  //             advance();
  //             if (token.id !== ",") {
  //                 break;
  //             }
  //             advance(",");
  //         }
  //     }
  //     // ツリーの左に格納
  //     this.first = a;
  //     advance(")");
  //     // 戻り値の型の指定
  //     advance("{");
  //     // ツリーの右に文を格納
  //     this.second = statements();
  //     scope.pop();
  //     advance("}");
  //     this.arity = "function";
  //     return this;
  // };

  // // function式・文
  // prefix("function", func_)
  //     .std = func_;

  prefix("[", function () {
    var a = [];
    if (token.id !== "]") {
      while (true) {
        a.push(expression(0));
        if (token.id !== ",") {
          break;
        }
        advance(",");
      }
    }
    advance("]");
    this.first = a;
    this.arity = "unary";
    return this;
  });

  prefix("{", function () {
    var a = [];
    var n;
    var v;
    if (token.id !== "}") {
      while (true) {
        n = token;
        if (n.arity !== "name" && n.arity !== "literal") {
          token.error("Bad property name.");
        }
        advance();
        advance(":");
        v = expression(0);
        v.key = n.value;
        a.push(v);
        if (token.id !== ",") {
          break;
        }
        advance(",");
      }
    }
    advance("}");
    this.first = a;
    this.arity = "unary";
    return this;
  });


  stmt("{", function () {
    new_scope();
    var a = statements();
    scope.pop();
    advance("}");
    return a;
  });


  function var_(str, std) {
    stmt(str,
      std || function () {
        //debugger;
        let a = [];
        let n;
        let t;
        while (true) {
          n = token;
          if (n.arity !== "name") {
            n.error("Expected a new variable name.");
          }
          scope.define(n);
          n.type = str;
          advance();
          // 関数定義かどうか
          if (token.id === "(") {
            advance();
            // ローカル・スコープを開く
            new_scope();
            if (token.id !== ")") {
              // 変数を取り出して配列に格納する
              while (true) {
                const t = token;
                if (token.arity !== "name") {
                  token.error("Expected a parameter name.");
                }
                advance();
                token.type = t.value;
                scope.define(token);
                a.push(token);
                advance();
                if (token.id !== ",") {
                  break;
                }
                advance(",");
              }
            }
            // ツリーの左に格納
            n.first = a;
            advance(")");
            // 戻り値の型の指定
            advance("{");
            // ツリーの右に文を格納
            n.second = statements();
            scope.pop();
            advance("}");
            n.arity = "function";
            return n;
          }

          if (token.id === "=") {
            t = token;
            advance("=");
            t.first = n;
            debugger;
            t.second = expression(0);
            t.second.type = str;

            t.arity = "binary";
            a.push(t);
          }


          if (token.id !== ",") {
            break;
          }
          advance(",");
        }
        advance(";");
        return (a.length === 0)
          ? null
          : (a.length === 1)
            ? a[0]
            : a;
      });
  }

  var_("u32");
  var_("u64");
  var_("i32");
  var_("i64");
  var_("f32");
  var_("f64");

  // stmt("var", function () {
  //     var a = [];
  //     var n;
  //     var t;
  //     while (true) {
  //         n = token;
  //         if (n.arity !== "name") {
  //             n.error("Expected a new variable name.");
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
  //         if (token.id === "=") {
  //             t = token;
  //             advance("=");
  //             t.first = n;
  //             t.second = expression(0);
  //             t.second.type = tp.id;
  //             t.arity = "binary";
  //             a.push(t);
  //         }
  //         if (token.id !== ",") {
  //             break;
  //         }
  //         advance(",");
  //     }
  //     advance(";");
  //     return (a.length === 0)
  //         ? null
  //         : (a.length === 1)
  //             ? a[0]
  //             : a;
  // });

  stmt("if", function () {
    advance("(");
    this.first = expression(0);
    advance(")");
    this.second = block();
    if (token.id === "else") {
      scope.reserve(token);
      advance("else");
      this.third = (token.id === "if")
        ? statement()
        : block();
    } else {
      this.third = null;
    }
    this.arity = "statement";
    return this;
  });

  stmt("return", function () {
    if (token.id !== ";") {
      this.first = expression(0);
    }
    advance(";");
    if (token.id !== "}") {
      token.error("Unreachable statement.");
    }
    this.arity = "statement";
    return this;
  });

  stmt("break", function () {
    advance(";");
    if (token.id !== "}") {
      token.error("Unreachable statement.");
    }
    this.arity = "statement";
    return this;
  });

  stmt("while", function () {
    advance("(");
    this.first = expression(0);
    advance(")");
    this.second = block();
    this.arity = "statement";
    return this;
  });

  return function (t) {
    tokens = t;
    //        tokens = source.tokens("=<>!+-*&|/%^", "=<>&|");
    token_nr = 0;
    scope = null;
    new_scope();
    advance();
    var s = statements();
    advance("(end)");
    scope.pop();
    return s;
  };
}
