var Binaryen = function(Binaryen) {
  Binaryen = Binaryen || {};

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
// if (!Module)` is crucial for Closure Compiler here as it will otherwise replace every `Module` occurrence with a string
var Module;
if (!Module) Module = typeof Binaryen !== 'undefined' ? Binaryen : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)

  var old = Module['onRuntimeInitialized'];
Module['onRuntimeInitialized'] = function(){
  postSetup();
  old && old();
};



// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// The environment setup code below is customized to use Module.
// *** Environment setup code ***

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (ENVIRONMENT_IS_NODE) {


  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  // MODULARIZE will export the module in the proper place outside, we don't need to export here

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', function(reason, p) {
    err('node.js exiting due to unhandled promise rejection');
    process['exit'](1);
  });

  Module['quit'] = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
} else
if (ENVIRONMENT_IS_SHELL) {


  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status) {
      quit(status);
    }
  }
} else
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {


  Module['read'] = function shell_read(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  Module['setWindowTitle'] = function(title) { document.title = title };
} else
{
  throw new Error('environment detection error');
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
// If the user provided Module.print or printErr, use that. Otherwise,
// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
var out = Module['print'] || (typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null));
var err = Module['printErr'] || (typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || out));

// *** Environment setup code ***

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = setTempRet0 = getTempRet0 = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  assert(!staticSealed);
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  assert(STATICTOP < TOTAL_MEMORY, 'not enough memory for static allocation - increase TOTAL_MEMORY');
  return ret;
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR>>2] = ret;
      return 0;
    }
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  var ret = size = Math.ceil(size / factor) * factor;
  return ret;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

var asm2wasmImports = { // special asm2wasm imports
    "f64-rem": function(x, y) {
        return x % y;
    },
    "debugger": function() {
        debugger;
    }
};



var jsCallStartIndex = 1;
var functionPointers = new Array(0);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
  if (typeof sig === 'undefined') {
    err('warning: addFunction(): You should provide a wasm function signature string as a second argument. This is not necessary for asm.js and asm2wasm, but is required for the LLVM wasm backend, so it is recommended for full portability.');
  }
  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}


function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // FIXME backwards compatibility layer for ports. Support some Runtime.*
  //       for now, fix it there, then remove it from here. That way we
  //       can minimize any period of breakage.
  dynCall: dynCall, // for SDL2 port
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 1024;


// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  'stackSave': function() {
    stackSave()
  },
  'stackRestore': function() {
    stackRestore()
  },
  // type conversion from js to c
  'arrayToC' : function(arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  'stringToC' : function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) { // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};

// For fast lookup of conversion functions
var toC = {
  'string': JSfuncs['stringToC'], 'array': JSfuncs['arrayToC']
};


// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  function convertReturnValue(ret) {
    if (returnType === 'string') return Pointer_stringify(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

function demangle(func) {
  var __cxa_demangle_func = Module['___cxa_demangle'] || Module['__cxa_demangle'];
  assert(__cxa_demangle_func);
  try {
    var s =
      func.substr(1);
    var len = lengthBytesUTF8(s)+1;
    var buf = _malloc(len);
    stringToUTF8(s, buf, len);
    var status = _malloc(4);
    var ret = __cxa_demangle_func(buf, 0, 0, status);
    if (HEAP32[((status)>>2)] === 0 && ret) {
      return Pointer_stringify(ret);
    }
    // otherwise, libcxxabi failed
  } catch(e) {
    // ignore problems here
  } finally {
    if (buf) _free(buf);
    if (status) _free(status);
    if (ret) _free(ret);
  }
  // failure when using libcxxabi, don't demangle
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}


function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}

if (!Module['reallocBuffer']) Module['reallocBuffer'] = function(size) {
  var ret;
  try {
    if (ArrayBuffer.transfer) {
      ret = ArrayBuffer.transfer(buffer, size);
    } else {
      var oldHEAP8 = HEAP8;
      ret = new ArrayBuffer(size);
      var temp = new Int8Array(ret);
      temp.set(oldHEAP8);
    }
  } catch(e) {
    return false;
  }
  var success = _emscripten_replace_memory(ret);
  if (!success) return false;
  return ret;
};

function enlargeMemory() {
  // TOTAL_MEMORY is the current size of the actual array, and DYNAMICTOP is the new top.
  assert(HEAP32[DYNAMICTOP_PTR>>2] > TOTAL_MEMORY); // This function should only ever be called after the ceiling of the dynamic heap has already been bumped to exceed the current total size of the asm.js heap.


  var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE; // In wasm, heap size must be a multiple of 64KB. In asm.js, they need to be multiples of 16MB.
  var LIMIT = 2147483648 - PAGE_MULTIPLE; // We can do one page short of 2GB as theoretical maximum.

  if (HEAP32[DYNAMICTOP_PTR>>2] > LIMIT) {
    err('Cannot enlarge memory, asked to go up to ' + HEAP32[DYNAMICTOP_PTR>>2] + ' bytes, but the limit is ' + LIMIT + ' bytes!');
    return false;
  }

  var OLD_TOTAL_MEMORY = TOTAL_MEMORY;
  TOTAL_MEMORY = Math.max(TOTAL_MEMORY, MIN_TOTAL_MEMORY); // So the loop below will not be infinite, and minimum asm.js memory size is 16MB.

  while (TOTAL_MEMORY < HEAP32[DYNAMICTOP_PTR>>2]) { // Keep incrementing the heap size as long as it's less than what is requested.
    if (TOTAL_MEMORY <= 536870912) {
      TOTAL_MEMORY = alignUp(2 * TOTAL_MEMORY, PAGE_MULTIPLE); // Simple heuristic: double until 1GB...
    } else {
      // ..., but after that, add smaller increments towards 2GB, which we cannot reach
      TOTAL_MEMORY = Math.min(alignUp((3 * TOTAL_MEMORY + 2147483648) / 4, PAGE_MULTIPLE), LIMIT);
      if (TOTAL_MEMORY === OLD_TOTAL_MEMORY) {
        warnOnce('Cannot ask for more memory since we reached the practical limit in browsers (which is just below 2GB), so the request would have failed. Requesting only ' + TOTAL_MEMORY);
      }
    }
  }

  var start = Date.now();

  var replacement = Module['reallocBuffer'](TOTAL_MEMORY);
  if (!replacement || replacement.byteLength != TOTAL_MEMORY) {
    err('Failed to grow the heap from ' + OLD_TOTAL_MEMORY + ' bytes to ' + TOTAL_MEMORY + ' bytes, not enough memory!');
    if (replacement) {
      err('Expected to get back a buffer of size ' + TOTAL_MEMORY + ' bytes, but instead got back a buffer of size ' + replacement.byteLength);
    }
    // restore the state to before this call, we failed
    TOTAL_MEMORY = OLD_TOTAL_MEMORY;
    return false;
  }

  // everything worked

  updateGlobalBuffer(replacement);
  updateGlobalBufferViews();

  if (!Module["usingWasm"]) {
    err('Warning: Enlarging memory arrays, this is not fast! ' + [OLD_TOTAL_MEMORY, TOTAL_MEMORY]);
  }


  return true;
}

var byteLength;
try {
  byteLength = Function.prototype.call.bind(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get);
  byteLength(new ArrayBuffer(4)); // can fail on older ie
} catch(e) { // can fail on older node/v8
  byteLength = function(buffer) { return buffer.byteLength; };
}

var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) err('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  if (typeof WebAssembly === 'object' && typeof WebAssembly.Memory === 'function') {
    assert(TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
    Module['wasmMemory'] = new WebAssembly.Memory({ 'initial': TOTAL_MEMORY / WASM_PAGE_SIZE });
    buffer = Module['wasmMemory'].buffer;
  } else
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

assert(Math['imul'] && Math['fround'] && Math['clz32'] && Math['trunc'], 'this is a legacy browser, build with LEGACY_VM_SUPPORT');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}




function integrateWasmJS() {
  // wasm.js has several methods for creating the compiled code module here:
  //  * 'native-wasm' : use native WebAssembly support in the browser
  //  * 'interpret-s-expr': load s-expression code from a .wast and interpret
  //  * 'interpret-binary': load binary wasm and interpret
  //  * 'interpret-asm2wasm': load asm.js code, translate to wasm, and interpret
  //  * 'asmjs': no wasm, just load the asm.js code and use that (good for testing)
  // The method is set at compile time (BINARYEN_METHOD)
  // The method can be a comma-separated list, in which case, we will try the
  // options one by one. Some of them can fail gracefully, and then we can try
  // the next.

  // inputs

  var method = 'native-wasm';

  var wasmTextFile = 'binaryen-wasm.wast';
  var wasmBinaryFile = 'binaryen-wasm.wasm';
  var asmjsCodeFile = 'binaryen-wasm.temp.asm.js';

  if (typeof Module['locateFile'] === 'function') {
    if (!isDataURI(wasmTextFile)) {
      wasmTextFile = Module['locateFile'](wasmTextFile);
    }
    if (!isDataURI(wasmBinaryFile)) {
      wasmBinaryFile = Module['locateFile'](wasmBinaryFile);
    }
    if (!isDataURI(asmjsCodeFile)) {
      asmjsCodeFile = Module['locateFile'](asmjsCodeFile);
    }
  }

  // utilities

  var wasmPageSize = 64*1024;

  var info = {
    'global': null,
    'env': null,
    'asm2wasm': asm2wasmImports,
    'parent': Module // Module inside wasm-js.cpp refers to wasm-js.cpp; this allows access to the outside program.
  };

  var exports = null;


  function mergeMemory(newBuffer) {
    // The wasm instance creates its memory. But static init code might have written to
    // buffer already, including the mem init file, and we must copy it over in a proper merge.
    // TODO: avoid this copy, by avoiding such static init writes
    // TODO: in shorter term, just copy up to the last static init write
    var oldBuffer = Module['buffer'];
    if (newBuffer.byteLength < oldBuffer.byteLength) {
      err('the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here');
    }
    var oldView = new Int8Array(oldBuffer);
    var newView = new Int8Array(newBuffer);


    newView.set(oldView);
    updateGlobalBuffer(newBuffer);
    updateGlobalBufferViews();
  }

  function fixImports(imports) {
    return imports;
  }

  function getBinary() {
    try {
      if (Module['wasmBinary']) {
        return new Uint8Array(Module['wasmBinary']);
      }
      if (Module['readBinary']) {
        return Module['readBinary'](wasmBinaryFile);
      } else {
        throw "on the web, we need the wasm binary to be preloaded and set on Module['wasmBinary']. emcc.py will do that for you when generating HTML (but not JS)";
      }
    }
    catch (err) {
      abort(err);
    }
  }

  function getBinaryPromise() {
    // if we don't have the binary yet, and have the Fetch api, use that
    // in some environments, like Electron's render process, Fetch api may be present, but have a different context than expected, let's only use it on the Web
    if (!Module['wasmBinary'] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === 'function') {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(function () {
        return getBinary();
      });
    }
    // Otherwise, getBinary should be able to get it synchronously
    return new Promise(function(resolve, reject) {
      resolve(getBinary());
    });
  }

  // do-method functions


  function doNativeWasm(global, env, providedBuffer) {
    if (typeof WebAssembly !== 'object') {
      // when the method is just native-wasm, our error message can be very specific
      abort('No WebAssembly support found. Build with -s WASM=0 to target JavaScript instead.');
      err('no native wasm support detected');
      return false;
    }
    // prepare memory import
    if (!(Module['wasmMemory'] instanceof WebAssembly.Memory)) {
      err('no native wasm Memory in use');
      return false;
    }
    env['memory'] = Module['wasmMemory'];
    // Load the wasm module and create an instance of using native support in the JS engine.
    info['global'] = {
      'NaN': NaN,
      'Infinity': Infinity
    };
    info['global.Math'] = Math;
    info['env'] = env;
    // handle a generated wasm instance, receiving its exports and
    // performing other necessary setup
    function receiveInstance(instance, module) {
      exports = instance.exports;
      if (exports.memory) mergeMemory(exports.memory);
      Module['asm'] = exports;
      Module["usingWasm"] = true;
      removeRunDependency('wasm-instantiate');
    }
    addRunDependency('wasm-instantiate');

    // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
    // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
    // to any other async startup actions they are performing.
    if (Module['instantiateWasm']) {
      try {
        return Module['instantiateWasm'](info, receiveInstance);
      } catch(e) {
        err('Module.instantiateWasm callback failed with error: ' + e);
        return false;
      }
    }

    // Async compilation can be confusing when an error on the page overwrites Module
    // (for example, if the order of elements is wrong, and the one defining Module is
    // later), so we save Module and check it later.
    var trueModule = Module;
    function receiveInstantiatedSource(output) {
      // 'output' is a WebAssemblyInstantiatedSource object which has both the module and instance.
      // receiveInstance() will swap in the exports (to Module.asm) so they can be called
      assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
      trueModule = null;
      receiveInstance(output['instance'], output['module']);
    }
    function instantiateArrayBuffer(receiver) {
      getBinaryPromise().then(function(binary) {
        return WebAssembly.instantiate(binary, info);
      }).then(receiver).catch(function(reason) {
        err('failed to asynchronously prepare wasm: ' + reason);
        abort(reason);
      });
    }
    // Prefer streaming instantiation if available.
    if (!Module['wasmBinary'] &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, { credentials: 'same-origin' }), info)
        .then(receiveInstantiatedSource)
        .catch(function(reason) {
          // We expect the most common failure cause to be a bad MIME type for the binary,
          // in which case falling back to ArrayBuffer instantiation should work.
          err('wasm streaming compile failed: ' + reason);
          err('falling back to ArrayBuffer instantiation');
          instantiateArrayBuffer(receiveInstantiatedSource);
        });
    } else {
      instantiateArrayBuffer(receiveInstantiatedSource);
    }
    return {}; // no exports yet; we'll fill them in later
  }


  // We may have a preloaded value in Module.asm, save it
  Module['asmPreload'] = Module['asm'];

  // Memory growth integration code

  var asmjsReallocBuffer = Module['reallocBuffer'];

  var wasmReallocBuffer = function(size) {
    var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE; // In wasm, heap size must be a multiple of 64KB. In asm.js, they need to be multiples of 16MB.
    size = alignUp(size, PAGE_MULTIPLE); // round up to wasm page size
    var old = Module['buffer'];
    var oldSize = old.byteLength;
    if (Module["usingWasm"]) {
      // native wasm support
      try {
        var result = Module['wasmMemory'].grow((size - oldSize) / wasmPageSize); // .grow() takes a delta compared to the previous size
        if (result !== (-1 | 0)) {
          // success in native wasm memory growth, get the buffer from the memory
          return Module['buffer'] = Module['wasmMemory'].buffer;
        } else {
          return null;
        }
      } catch(e) {
        console.error('Module.reallocBuffer: Attempted to grow from ' + oldSize  + ' bytes to ' + size + ' bytes, but got error: ' + e);
        return null;
      }
    }
  };

  Module['reallocBuffer'] = function(size) {
    if (finalMethod === 'asmjs') {
      return asmjsReallocBuffer(size);
    } else {
      return wasmReallocBuffer(size);
    }
  };

  // we may try more than one; this is the final one, that worked and we are using
  var finalMethod = '';

  // Provide an "asm.js function" for the application, called to "link" the asm.js module. We instantiate
  // the wasm module at that time, and it receives imports and provides exports and so forth, the app
  // doesn't need to care that it is wasm or olyfilled wasm or asm.js.

  Module['asm'] = function(global, env, providedBuffer) {
    env = fixImports(env);

    // import table
    if (!env['table']) {
      var TABLE_SIZE = Module['wasmTableSize'];
      if (TABLE_SIZE === undefined) TABLE_SIZE = 1024; // works in binaryen interpreter at least
      var MAX_TABLE_SIZE = Module['wasmMaxTableSize'];
      if (typeof WebAssembly === 'object' && typeof WebAssembly.Table === 'function') {
        if (MAX_TABLE_SIZE !== undefined) {
          env['table'] = new WebAssembly.Table({ 'initial': TABLE_SIZE, 'maximum': MAX_TABLE_SIZE, 'element': 'anyfunc' });
        } else {
          env['table'] = new WebAssembly.Table({ 'initial': TABLE_SIZE, element: 'anyfunc' });
        }
      } else {
        env['table'] = new Array(TABLE_SIZE); // works in binaryen interpreter at least
      }
      Module['wasmTable'] = env['table'];
    }

    if (!env['memoryBase']) {
      env['memoryBase'] = Module['STATIC_BASE']; // tell the memory segments where to place themselves
    }
    if (!env['tableBase']) {
      env['tableBase'] = 0; // table starts at 0 by default, in dynamic linking this will change
    }

    // try the methods. each should return the exports if it succeeded

    var exports;
    exports = doNativeWasm(global, env, providedBuffer);

    assert(exports, 'no binaryen method succeeded. consider enabling more options, like interpreting, if you want that: https://github.com/kripken/emscripten/wiki/WebAssembly#binaryen-methods');


    return exports;
  };

  var methodHandler = Module['asm']; // note our method handler, as we may modify Module['asm'] later
}

integrateWasmJS();

// === Body ===

var ASM_CONSTS = [];





STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 133104;
/* global initializers */  __ATINIT__.push({ func: function() { __GLOBAL__I_000101() } }, { func: function() { __GLOBAL__sub_I_pass_cpp() } }, { func: function() { __GLOBAL__sub_I_iostream_cpp() } }, { func: function() { ___emscripten_environ_constructor() } }, { func: function() { __GLOBAL__sub_I_wasm_cpp() } }, { func: function() { __GLOBAL__sub_I_wasm_emscripten_cpp() } }, { func: function() { __GLOBAL__sub_I_threads_cpp() } }, { func: function() { __GLOBAL__sub_I_TrapMode_cpp() } }, { func: function() { __GLOBAL__sub_I_SSAify_cpp() } }, { func: function() { __GLOBAL__sub_I_SafeHeap_cpp() } }, { func: function() { __GLOBAL__sub_I_RelooperJumpThreading_cpp() } }, { func: function() { __GLOBAL__sub_I_Precompute_cpp() } }, { func: function() { __GLOBAL__sub_I_binaryen_c_cpp() } }, { func: function() { __GLOBAL__sub_I_OptimizeInstructions_cpp() } }, { func: function() { __GLOBAL__sub_I_Metrics_cpp() } }, { func: function() { __GLOBAL__sub_I_LogExecution_cpp() } }, { func: function() { __GLOBAL__sub_I_LegalizeJSInterface_cpp() } }, { func: function() { __GLOBAL__sub_I_InstrumentMemory_cpp() } }, { func: function() { __GLOBAL__sub_I_InstrumentLocals_cpp() } }, { func: function() { __GLOBAL__sub_I_simple_ast_cpp() } }, { func: function() { __GLOBAL__sub_I_parser_cpp() } }, { func: function() { __GLOBAL__sub_I_optimizer_shared_cpp() } }, { func: function() { __GLOBAL__sub_I_shared_constants_cpp() } });







var STATIC_BUMP = 133104;
Module["STATIC_BASE"] = STATIC_BASE;
Module["STATIC_BUMP"] = STATIC_BUMP;

/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  function ___assert_fail(condition, filename, line, func) {
      abort('Assertion failed: ' + Pointer_stringify(condition) + ', at: ' + [filename ? Pointer_stringify(filename) : 'unknown filename', line, func ? Pointer_stringify(func) : 'unknown function']);
    }

  
  var ENV={};function ___buildEnvironment(environ) {
      // WARNING: Arbitrary limit!
      var MAX_ENV_VALUES = 64;
      var TOTAL_ENV_SIZE = 1024;
  
      // Statically allocate memory for the environment.
      var poolPtr;
      var envPtr;
      if (!___buildEnvironment.called) {
        ___buildEnvironment.called = true;
        // Set default values. Use string keys for Closure Compiler compatibility.
        ENV['USER'] = ENV['LOGNAME'] = 'web_user';
        ENV['PATH'] = '/';
        ENV['PWD'] = '/';
        ENV['HOME'] = '/home/web_user';
        ENV['LANG'] = 'C.UTF-8';
        ENV['_'] = Module['thisProgram'];
        // Allocate memory.
        poolPtr = getMemory(TOTAL_ENV_SIZE);
        envPtr = getMemory(MAX_ENV_VALUES * 4);
        HEAP32[((envPtr)>>2)]=poolPtr;
        HEAP32[((environ)>>2)]=envPtr;
      } else {
        envPtr = HEAP32[((environ)>>2)];
        poolPtr = HEAP32[((envPtr)>>2)];
      }
  
      // Collect key=value lines.
      var strings = [];
      var totalSize = 0;
      for (var key in ENV) {
        if (typeof ENV[key] === 'string') {
          var line = key + '=' + ENV[key];
          strings.push(line);
          totalSize += line.length;
        }
      }
      if (totalSize > TOTAL_ENV_SIZE) {
        throw new Error('Environment size exceeded TOTAL_ENV_SIZE!');
      }
  
      // Make new.
      var ptrSize = 4;
      for (var i = 0; i < strings.length; i++) {
        var line = strings[i];
        writeAsciiToMemory(line, poolPtr);
        HEAP32[(((envPtr)+(i * ptrSize))>>2)]=poolPtr;
        poolPtr += line.length + 1;
      }
      HEAP32[(((envPtr)+(strings.length * ptrSize))>>2)]=0;
    }

  function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }

  
  var EXCEPTIONS={last:0,caught:[],infos:{},deAdjust:function (adjusted) {
        if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
        for (var key in EXCEPTIONS.infos) {
          var ptr = +key; // the iteration key is a string, and if we throw this, it must be an integer as that is what we look for
          var info = EXCEPTIONS.infos[ptr];
          if (info.adjusted === adjusted) {
            return ptr;
          }
        }
        return adjusted;
      },addRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount++;
      },decRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        assert(info.refcount > 0);
        info.refcount--;
        // A rethrown exception can reach refcount 0; it must not be discarded
        // Its next handler will clear the rethrown flag and addRef it, prior to
        // final decRef and destruction here
        if (info.refcount === 0 && !info.rethrown) {
          if (info.destructor) {
            Module['dynCall_vi'](info.destructor, ptr);
          }
          delete EXCEPTIONS.infos[ptr];
          ___cxa_free_exception(ptr);
        }
      },clearRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount = 0;
      }};function ___cxa_begin_catch(ptr) {
      var info = EXCEPTIONS.infos[ptr];
      if (info && !info.caught) {
        info.caught = true;
        __ZSt18uncaught_exceptionv.uncaught_exception--;
      }
      if (info) info.rethrown = false;
      EXCEPTIONS.caught.push(ptr);
      EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
      return ptr;
    }

  
  function ___cxa_free_exception(ptr) {
      try {
        return _free(ptr);
      } catch(e) { // XXX FIXME
        err('exception during cxa_free_exception: ' + e);
      }
    }function ___cxa_end_catch() {
      // Clear state flag.
      Module['setThrew'](0);
      // Call destructor if one is registered then clear it.
      var ptr = EXCEPTIONS.caught.pop();
      if (ptr) {
        EXCEPTIONS.decRef(EXCEPTIONS.deAdjust(ptr));
        EXCEPTIONS.last = 0; // XXX in decRef?
      }
    }

  function ___cxa_find_matching_catch_2() {
          return ___cxa_find_matching_catch.apply(null, arguments);
        }

  function ___cxa_find_matching_catch_3() {
          return ___cxa_find_matching_catch.apply(null, arguments);
        }

  function ___cxa_find_matching_catch_4() {
          return ___cxa_find_matching_catch.apply(null, arguments);
        }


  function ___cxa_pure_virtual() {
      ABORT = true;
      throw 'Pure virtual function called!';
    }

  function ___cxa_rethrow() {
      var ptr = EXCEPTIONS.caught.pop();
      ptr = EXCEPTIONS.deAdjust(ptr);
      if (!EXCEPTIONS.infos[ptr].rethrown) {
        // Only pop if the corresponding push was through rethrow_primary_exception
        EXCEPTIONS.caught.push(ptr)
        EXCEPTIONS.infos[ptr].rethrown = true;
      }
      EXCEPTIONS.last = ptr;
      throw ptr;
    }

  
  function _atexit(func, arg) {
      warnOnce('atexit() called, but NO_EXIT_RUNTIME is set, so atexits() will not be called. set NO_EXIT_RUNTIME to 0 (see the FAQ)');
      __ATEXIT__.unshift({ func: func, arg: arg });
    }function ___cxa_thread_atexit() {
  return _atexit.apply(null, arguments)
  }

  
  
  function ___resumeException(ptr) {
      if (!EXCEPTIONS.last) { EXCEPTIONS.last = ptr; }
      throw ptr;
    }function ___cxa_find_matching_catch() {
      var thrown = EXCEPTIONS.last;
      if (!thrown) {
        // just pass through the null ptr
        return ((setTempRet0(0),0)|0);
      }
      var info = EXCEPTIONS.infos[thrown];
      var throwntype = info.type;
      if (!throwntype) {
        // just pass through the thrown ptr
        return ((setTempRet0(0),thrown)|0);
      }
      var typeArray = Array.prototype.slice.call(arguments);
  
      var pointer = Module['___cxa_is_pointer_type'](throwntype);
      // can_catch receives a **, add indirection
      if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
      HEAP32[((___cxa_find_matching_catch.buffer)>>2)]=thrown;
      thrown = ___cxa_find_matching_catch.buffer;
      // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.
      for (var i = 0; i < typeArray.length; i++) {
        if (typeArray[i] && Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)) {
          thrown = HEAP32[((thrown)>>2)]; // undo indirection
          info.adjusted = thrown;
          return ((setTempRet0(typeArray[i]),thrown)|0);
        }
      }
      // Shouldn't happen unless we have bogus data in typeArray
      // or encounter a type for which emscripten doesn't have suitable
      // typeinfo defined. Best-efforts match just in case.
      thrown = HEAP32[((thrown)>>2)]; // undo indirection
      return ((setTempRet0(throwntype),thrown)|0);
    }function ___cxa_throw(ptr, type, destructor) {
      EXCEPTIONS.infos[ptr] = {
        ptr: ptr,
        adjusted: ptr,
        type: type,
        destructor: destructor,
        refcount: 0,
        caught: false,
        rethrown: false
      };
      EXCEPTIONS.last = ptr;
      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exception = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exception++;
      }
      throw ptr;
    }

  function ___cxa_uncaught_exception() {
      return !!__ZSt18uncaught_exceptionv.uncaught_exception;
    }

  function ___gxx_personality_v0() {
    }

  function ___lock() {}

  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};
  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else err('failed to set errno from JS');
      return value;
    }function ___map_file(pathname, size) {
      ___setErrNo(ERRNO_CODES.EPERM);
      return -1;
    }


  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall145(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // readv
      var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      return SYSCALLS.doReadv(stream, iov, iovcnt);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var printChar = ___syscall146.printChar;
      if (!printChar) return;
      var buffers = ___syscall146.buffers;
      if (buffers[1].length) printChar(1, 10);
      if (buffers[2].length) printChar(2, 10);
    }function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffers) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall221(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // fcntl64
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall5(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // open
      var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get() // optional TODO
      var stream = FS.open(pathname, flags, mode);
      return stream.fd;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall91(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // munmap
      var addr = SYSCALLS.get(), len = SYSCALLS.get();
      // TODO: support unmmap'ing parts of allocations
      var info = SYSCALLS.mappings[addr];
      if (!info) return 0;
      if (len === info.len) {
        var stream = FS.getStream(info.fd);
        SYSCALLS.doMsync(addr, stream, len, info.flags)
        FS.munmap(stream);
        SYSCALLS.mappings[addr] = null;
        if (info.allocated) {
          _free(info.malloc);
        }
      }
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___unlock() {}

  function _abort() {
      Module['abort']();
    }

  
  function _emscripten_get_now() { abort() }
  
  function _emscripten_get_now_is_monotonic() {
      // return whether emscripten_get_now is guaranteed monotonic; the Date.now
      // implementation is not :(
      return ENVIRONMENT_IS_NODE || (typeof dateNow !== 'undefined') ||
          ((ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && self['performance'] && self['performance']['now']);
    }function _clock_gettime(clk_id, tp) {
      // int clock_gettime(clockid_t clk_id, struct timespec *tp);
      var now;
      if (clk_id === 0) {
        now = Date.now();
      } else if (clk_id === 1 && _emscripten_get_now_is_monotonic()) {
        now = _emscripten_get_now();
      } else {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      }
      HEAP32[((tp)>>2)]=(now/1000)|0; // seconds
      HEAP32[(((tp)+(4))>>2)]=((now % 1000)*1000*1000)|0; // nanoseconds
      return 0;
    }

  
  function __exit(status) {
      // void _exit(int status);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/exit.html
      exit(status);
    }function _exit(status) {
      __exit(status);
    }

  function _getenv(name) {
      // char *getenv(const char *name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/getenv.html
      if (name === 0) return 0;
      name = Pointer_stringify(name);
      if (!ENV.hasOwnProperty(name)) return 0;
  
      if (_getenv.ret) _free(_getenv.ret);
      _getenv.ret = allocateUTF8(ENV[name]);
      return _getenv.ret;
    }

   

  var _llvm_ceil_f32=Math_ceil;

  var _llvm_ceil_f64=Math_ceil;

  function _llvm_copysign_f32(x, y) {
      return y < 0 || (y === 0 && 1/y < 0) ? -Math_abs(x) : Math_abs(x);
    }

  function _llvm_copysign_f64(x, y) {
      return y < 0 || (y === 0 && 1/y < 0) ? -Math_abs(x) : Math_abs(x);
    }

  var _llvm_ctlz_i32=true;

  function _llvm_eh_typeid_for(type) {
      return type;
    }

  var _llvm_fabs_f64=Math_abs;

  var _llvm_floor_f32=Math_floor;

  var _llvm_floor_f64=Math_floor;

  var _llvm_nacl_atomic_cmpxchg_i32=undefined;

  
    

  
    

  var _llvm_sqrt_f32=Math_sqrt;

  var _llvm_sqrt_f64=Math_sqrt;

  function _llvm_stackrestore(p) {
      var self = _llvm_stacksave;
      var ret = self.LLVM_SAVEDSTACKS[p];
      self.LLVM_SAVEDSTACKS.splice(p, 1);
      stackRestore(ret);
    }

  function _llvm_stacksave() {
      var self = _llvm_stacksave;
      if (!self.LLVM_SAVEDSTACKS) {
        self.LLVM_SAVEDSTACKS = [];
      }
      self.LLVM_SAVEDSTACKS.push(stackSave());
      return self.LLVM_SAVEDSTACKS.length-1;
    }

  function _llvm_trap() {
      abort('trap!');
    }

  var _llvm_trunc_f32=Math_trunc;

  var _llvm_trunc_f64=Math_trunc;

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

   

   

   

  function _pthread_cond_destroy() { return 0; }

  function _pthread_cond_signal() { return 0; }

  function _pthread_cond_wait() { return 0; }

  function _pthread_equal(x, y) { return x == y }

  
  var PTHREAD_SPECIFIC={};function _pthread_getspecific(key) {
      return PTHREAD_SPECIFIC[key] || 0;
    }

  function _pthread_join() {}

  
  var PTHREAD_SPECIFIC_NEXT_KEY=1;function _pthread_key_create(key, destructor) {
      if (key == 0) {
        return ERRNO_CODES.EINVAL;
      }
      HEAP32[((key)>>2)]=PTHREAD_SPECIFIC_NEXT_KEY;
      // values start at 0
      PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
      PTHREAD_SPECIFIC_NEXT_KEY++;
      return 0;
    }

  function _pthread_mutex_destroy() {}

   

   

  function _pthread_once(ptr, func) {
      if (!_pthread_once.seen) _pthread_once.seen = {};
      if (ptr in _pthread_once.seen) return;
      Module['dynCall_v'](func);
      _pthread_once.seen[ptr] = 1;
    }

  function _pthread_setspecific(key, value) {
      if (!(key in PTHREAD_SPECIFIC)) {
        return ERRNO_CODES.EINVAL;
      }
      PTHREAD_SPECIFIC[key] = value;
      return 0;
    }

   

  
  
  function __isLeapYear(year) {
        return year%4 === 0 && (year%100 !== 0 || year%400 === 0);
    }
  
  function __arraySum(array, index) {
      var sum = 0;
      for (var i = 0; i <= index; sum += array[i++]);
      return sum;
    }
  
  
  var __MONTH_DAYS_LEAP=[31,29,31,30,31,30,31,31,30,31,30,31];
  
  var __MONTH_DAYS_REGULAR=[31,28,31,30,31,30,31,31,30,31,30,31];function __addDays(date, days) {
      var newDate = new Date(date.getTime());
      while(days > 0) {
        var leap = __isLeapYear(newDate.getFullYear());
        var currentMonth = newDate.getMonth();
        var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
  
        if (days > daysInCurrentMonth-newDate.getDate()) {
          // we spill over to next month
          days -= (daysInCurrentMonth-newDate.getDate()+1);
          newDate.setDate(1);
          if (currentMonth < 11) {
            newDate.setMonth(currentMonth+1)
          } else {
            newDate.setMonth(0);
            newDate.setFullYear(newDate.getFullYear()+1);
          }
        } else {
          // we stay in current month 
          newDate.setDate(newDate.getDate()+days);
          return newDate;
        }
      }
  
      return newDate;
    }function _strftime(s, maxsize, format, tm) {
      // size_t strftime(char *restrict s, size_t maxsize, const char *restrict format, const struct tm *restrict timeptr);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/strftime.html
  
      var tm_zone = HEAP32[(((tm)+(40))>>2)];
  
      var date = {
        tm_sec: HEAP32[((tm)>>2)],
        tm_min: HEAP32[(((tm)+(4))>>2)],
        tm_hour: HEAP32[(((tm)+(8))>>2)],
        tm_mday: HEAP32[(((tm)+(12))>>2)],
        tm_mon: HEAP32[(((tm)+(16))>>2)],
        tm_year: HEAP32[(((tm)+(20))>>2)],
        tm_wday: HEAP32[(((tm)+(24))>>2)],
        tm_yday: HEAP32[(((tm)+(28))>>2)],
        tm_isdst: HEAP32[(((tm)+(32))>>2)],
        tm_gmtoff: HEAP32[(((tm)+(36))>>2)],
        tm_zone: tm_zone ? Pointer_stringify(tm_zone) : ''
      };
  
      var pattern = Pointer_stringify(format);
  
      // expand format
      var EXPANSION_RULES_1 = {
        '%c': '%a %b %d %H:%M:%S %Y',     // Replaced by the locale's appropriate date and time representation - e.g., Mon Aug  3 14:02:01 2013
        '%D': '%m/%d/%y',                 // Equivalent to %m / %d / %y
        '%F': '%Y-%m-%d',                 // Equivalent to %Y - %m - %d
        '%h': '%b',                       // Equivalent to %b
        '%r': '%I:%M:%S %p',              // Replaced by the time in a.m. and p.m. notation
        '%R': '%H:%M',                    // Replaced by the time in 24-hour notation
        '%T': '%H:%M:%S',                 // Replaced by the time
        '%x': '%m/%d/%y',                 // Replaced by the locale's appropriate date representation
        '%X': '%H:%M:%S'                  // Replaced by the locale's appropriate date representation
      };
      for (var rule in EXPANSION_RULES_1) {
        pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule]);
      }
  
      var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
      function leadingSomething(value, digits, character) {
        var str = typeof value === 'number' ? value.toString() : (value || '');
        while (str.length < digits) {
          str = character[0]+str;
        }
        return str;
      };
  
      function leadingNulls(value, digits) {
        return leadingSomething(value, digits, '0');
      };
  
      function compareByDay(date1, date2) {
        function sgn(value) {
          return value < 0 ? -1 : (value > 0 ? 1 : 0);
        };
  
        var compare;
        if ((compare = sgn(date1.getFullYear()-date2.getFullYear())) === 0) {
          if ((compare = sgn(date1.getMonth()-date2.getMonth())) === 0) {
            compare = sgn(date1.getDate()-date2.getDate());
          }
        }
        return compare;
      };
  
      function getFirstWeekStartDate(janFourth) {
          switch (janFourth.getDay()) {
            case 0: // Sunday
              return new Date(janFourth.getFullYear()-1, 11, 29);
            case 1: // Monday
              return janFourth;
            case 2: // Tuesday
              return new Date(janFourth.getFullYear(), 0, 3);
            case 3: // Wednesday
              return new Date(janFourth.getFullYear(), 0, 2);
            case 4: // Thursday
              return new Date(janFourth.getFullYear(), 0, 1);
            case 5: // Friday
              return new Date(janFourth.getFullYear()-1, 11, 31);
            case 6: // Saturday
              return new Date(janFourth.getFullYear()-1, 11, 30);
          }
      };
  
      function getWeekBasedYear(date) {
          var thisDate = __addDays(new Date(date.tm_year+1900, 0, 1), date.tm_yday);
  
          var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
          var janFourthNextYear = new Date(thisDate.getFullYear()+1, 0, 4);
  
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
  
          if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
            // this date is after the start of the first week of this year
            if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
              return thisDate.getFullYear()+1;
            } else {
              return thisDate.getFullYear();
            }
          } else { 
            return thisDate.getFullYear()-1;
          }
      };
  
      var EXPANSION_RULES_2 = {
        '%a': function(date) {
          return WEEKDAYS[date.tm_wday].substring(0,3);
        },
        '%A': function(date) {
          return WEEKDAYS[date.tm_wday];
        },
        '%b': function(date) {
          return MONTHS[date.tm_mon].substring(0,3);
        },
        '%B': function(date) {
          return MONTHS[date.tm_mon];
        },
        '%C': function(date) {
          var year = date.tm_year+1900;
          return leadingNulls((year/100)|0,2);
        },
        '%d': function(date) {
          return leadingNulls(date.tm_mday, 2);
        },
        '%e': function(date) {
          return leadingSomething(date.tm_mday, 2, ' ');
        },
        '%g': function(date) {
          // %g, %G, and %V give values according to the ISO 8601:2000 standard week-based year. 
          // In this system, weeks begin on a Monday and week 1 of the year is the week that includes 
          // January 4th, which is also the week that includes the first Thursday of the year, and 
          // is also the first week that contains at least four days in the year. 
          // If the first Monday of January is the 2nd, 3rd, or 4th, the preceding days are part of 
          // the last week of the preceding year; thus, for Saturday 2nd January 1999, 
          // %G is replaced by 1998 and %V is replaced by 53. If December 29th, 30th, 
          // or 31st is a Monday, it and any following days are part of week 1 of the following year. 
          // Thus, for Tuesday 30th December 1997, %G is replaced by 1998 and %V is replaced by 01.
          
          return getWeekBasedYear(date).toString().substring(2);
        },
        '%G': function(date) {
          return getWeekBasedYear(date);
        },
        '%H': function(date) {
          return leadingNulls(date.tm_hour, 2);
        },
        '%I': function(date) {
          var twelveHour = date.tm_hour;
          if (twelveHour == 0) twelveHour = 12;
          else if (twelveHour > 12) twelveHour -= 12;
          return leadingNulls(twelveHour, 2);
        },
        '%j': function(date) {
          // Day of the year (001-366)
          return leadingNulls(date.tm_mday+__arraySum(__isLeapYear(date.tm_year+1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon-1), 3);
        },
        '%m': function(date) {
          return leadingNulls(date.tm_mon+1, 2);
        },
        '%M': function(date) {
          return leadingNulls(date.tm_min, 2);
        },
        '%n': function() {
          return '\n';
        },
        '%p': function(date) {
          if (date.tm_hour >= 0 && date.tm_hour < 12) {
            return 'AM';
          } else {
            return 'PM';
          }
        },
        '%S': function(date) {
          return leadingNulls(date.tm_sec, 2);
        },
        '%t': function() {
          return '\t';
        },
        '%u': function(date) {
          var day = new Date(date.tm_year+1900, date.tm_mon+1, date.tm_mday, 0, 0, 0, 0);
          return day.getDay() || 7;
        },
        '%U': function(date) {
          // Replaced by the week number of the year as a decimal number [00,53]. 
          // The first Sunday of January is the first day of week 1; 
          // days in the new year before this are in week 0. [ tm_year, tm_wday, tm_yday]
          var janFirst = new Date(date.tm_year+1900, 0, 1);
          var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7-janFirst.getDay());
          var endDate = new Date(date.tm_year+1900, date.tm_mon, date.tm_mday);
          
          // is target date after the first Sunday?
          if (compareByDay(firstSunday, endDate) < 0) {
            // calculate difference in days between first Sunday and endDate
            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth()-1)-31;
            var firstSundayUntilEndJanuary = 31-firstSunday.getDate();
            var days = firstSundayUntilEndJanuary+februaryFirstUntilEndMonth+endDate.getDate();
            return leadingNulls(Math.ceil(days/7), 2);
          }
  
          return compareByDay(firstSunday, janFirst) === 0 ? '01': '00';
        },
        '%V': function(date) {
          // Replaced by the week number of the year (Monday as the first day of the week) 
          // as a decimal number [01,53]. If the week containing 1 January has four 
          // or more days in the new year, then it is considered week 1. 
          // Otherwise, it is the last week of the previous year, and the next week is week 1. 
          // Both January 4th and the first Thursday of January are always in week 1. [ tm_year, tm_wday, tm_yday]
          var janFourthThisYear = new Date(date.tm_year+1900, 0, 4);
          var janFourthNextYear = new Date(date.tm_year+1901, 0, 4);
  
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
  
          var endDate = __addDays(new Date(date.tm_year+1900, 0, 1), date.tm_yday);
  
          if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
            // if given date is before this years first week, then it belongs to the 53rd week of last year
            return '53';
          } 
  
          if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
            // if given date is after next years first week, then it belongs to the 01th week of next year
            return '01';
          }
  
          // given date is in between CW 01..53 of this calendar year
          var daysDifference;
          if (firstWeekStartThisYear.getFullYear() < date.tm_year+1900) {
            // first CW of this year starts last year
            daysDifference = date.tm_yday+32-firstWeekStartThisYear.getDate()
          } else {
            // first CW of this year starts this year
            daysDifference = date.tm_yday+1-firstWeekStartThisYear.getDate();
          }
          return leadingNulls(Math.ceil(daysDifference/7), 2);
        },
        '%w': function(date) {
          var day = new Date(date.tm_year+1900, date.tm_mon+1, date.tm_mday, 0, 0, 0, 0);
          return day.getDay();
        },
        '%W': function(date) {
          // Replaced by the week number of the year as a decimal number [00,53]. 
          // The first Monday of January is the first day of week 1; 
          // days in the new year before this are in week 0. [ tm_year, tm_wday, tm_yday]
          var janFirst = new Date(date.tm_year, 0, 1);
          var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7-janFirst.getDay()+1);
          var endDate = new Date(date.tm_year+1900, date.tm_mon, date.tm_mday);
  
          // is target date after the first Monday?
          if (compareByDay(firstMonday, endDate) < 0) {
            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth()-1)-31;
            var firstMondayUntilEndJanuary = 31-firstMonday.getDate();
            var days = firstMondayUntilEndJanuary+februaryFirstUntilEndMonth+endDate.getDate();
            return leadingNulls(Math.ceil(days/7), 2);
          }
          return compareByDay(firstMonday, janFirst) === 0 ? '01': '00';
        },
        '%y': function(date) {
          // Replaced by the last two digits of the year as a decimal number [00,99]. [ tm_year]
          return (date.tm_year+1900).toString().substring(2);
        },
        '%Y': function(date) {
          // Replaced by the year as a decimal number (for example, 1997). [ tm_year]
          return date.tm_year+1900;
        },
        '%z': function(date) {
          // Replaced by the offset from UTC in the ISO 8601:2000 standard format ( +hhmm or -hhmm ).
          // For example, "-0430" means 4 hours 30 minutes behind UTC (west of Greenwich).
          var off = date.tm_gmtoff;
          var ahead = off >= 0;
          off = Math.abs(off) / 60;
          // convert from minutes into hhmm format (which means 60 minutes = 100 units)
          off = (off / 60)*100 + (off % 60);
          return (ahead ? '+' : '-') + String("0000" + off).slice(-4);
        },
        '%Z': function(date) {
          return date.tm_zone;
        },
        '%%': function() {
          return '%';
        }
      };
      for (var rule in EXPANSION_RULES_2) {
        if (pattern.indexOf(rule) >= 0) {
          pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_2[rule](date));
        }
      }
  
      var bytes = intArrayFromString(pattern, false);
      if (bytes.length > maxsize) {
        return 0;
      } 
  
      writeArrayToMemory(bytes, s);
      return bytes.length-1;
    }function _strftime_l(s, maxsize, format, tm) {
      return _strftime(s, maxsize, format, tm); // no locale support yet
    }

  var ___dso_handle=STATICTOP; STATICTOP += 16;;
if (ENVIRONMENT_IS_NODE) {
    _emscripten_get_now = function _emscripten_get_now_actual() {
      var t = process['hrtime']();
      return t[0] * 1e3 + t[1] / 1e6;
    };
  } else if (typeof dateNow !== 'undefined') {
    _emscripten_get_now = dateNow;
  } else if (typeof self === 'object' && self['performance'] && typeof self['performance']['now'] === 'function') {
    _emscripten_get_now = function() { return self['performance']['now'](); };
  } else if (typeof performance === 'object' && typeof performance['now'] === 'function') {
    _emscripten_get_now = function() { return performance['now'](); };
  } else {
    _emscripten_get_now = Date.now;
  };
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

var ASSERTIONS = true;

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}



function nullFunc_i(x) { err("Invalid function pointer called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_id(x) { err("Invalid function pointer called with signature 'id'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_ii(x) { err("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iid(x) { err("Invalid function pointer called with signature 'iid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iii(x) { err("Invalid function pointer called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { err("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiii(x) { err("Invalid function pointer called with signature 'iiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiid(x) { err("Invalid function pointer called with signature 'iiiiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiii(x) { err("Invalid function pointer called with signature 'iiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiiid(x) { err("Invalid function pointer called with signature 'iiiiiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiiii(x) { err("Invalid function pointer called with signature 'iiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiiiii(x) { err("Invalid function pointer called with signature 'iiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiiiiii(x) { err("Invalid function pointer called with signature 'iiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiiiiiiiii(x) { err("Invalid function pointer called with signature 'iiiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiij(x) { err("Invalid function pointer called with signature 'iiiiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iij(x) { err("Invalid function pointer called with signature 'iij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_ji(x) { err("Invalid function pointer called with signature 'ji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_jii(x) { err("Invalid function pointer called with signature 'jii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_v(x) { err("Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vi(x) { err("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vii(x) { err("Invalid function pointer called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viii(x) { err("Invalid function pointer called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiii(x) { err("Invalid function pointer called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiii(x) { err("Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiii(x) { err("Invalid function pointer called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiiii(x) { err("Invalid function pointer called with signature 'viiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiiiiiii(x) { err("Invalid function pointer called with signature 'viiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiiiiiiiiiiii(x) { err("Invalid function pointer called with signature 'viiiiiiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viij(x) { err("Invalid function pointer called with signature 'viij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viijii(x) { err("Invalid function pointer called with signature 'viijii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vij(x) { err("Invalid function pointer called with signature 'vij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

Module['wasmTableSize'] = 176256;

Module['wasmMaxTableSize'] = 176256;

function invoke_i(index) {
  var sp = stackSave();
  try {
    return Module["dynCall_i"](index);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_id(index,a1) {
  var sp = stackSave();
  try {
    return Module["dynCall_id"](index,a1);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_ii(index,a1) {
  var sp = stackSave();
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iid(index,a1,a2) {
  var sp = stackSave();
  try {
    return Module["dynCall_iid"](index,a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  var sp = stackSave();
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiiii"](index,a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiiid(index,a1,a2,a3,a4,a5) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiiiid"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiiii(index,a1,a2,a3,a4,a5) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiiiid(index,a1,a2,a3,a4,a5,a6) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiiiiid"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7,a8);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiiiiiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiiij(index,a1,a2,a3,a4,a5,a6) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiiiij"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iij(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    return Module["dynCall_iij"](index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_ji(index,a1) {
  var sp = stackSave();
  try {
    return Module["dynCall_ji"](index,a1);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_jii(index,a1,a2) {
  var sp = stackSave();
  try {
    return Module["dynCall_jii"](index,a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_v(index) {
  var sp = stackSave();
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  var sp = stackSave();
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  var sp = stackSave();
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    Module["dynCall_viii"](index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiii(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    Module["dynCall_viiii"](index,a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  var sp = stackSave();
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  var sp = stackSave();
  try {
    Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  var sp = stackSave();
  try {
    Module["dynCall_viiiiiii"](index,a1,a2,a3,a4,a5,a6,a7);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10) {
  var sp = stackSave();
  try {
    Module["dynCall_viiiiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiiiiiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15) {
  var sp = stackSave();
  try {
    Module["dynCall_viiiiiiiiiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viij(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    Module["dynCall_viij"](index,a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viijii(index,a1,a2,a3,a4,a5,a6) {
  var sp = stackSave();
  try {
    Module["dynCall_viijii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vij(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    Module["dynCall_vij"](index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = {};

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_i": nullFunc_i, "nullFunc_id": nullFunc_id, "nullFunc_ii": nullFunc_ii, "nullFunc_iid": nullFunc_iid, "nullFunc_iii": nullFunc_iii, "nullFunc_iiii": nullFunc_iiii, "nullFunc_iiiii": nullFunc_iiiii, "nullFunc_iiiiid": nullFunc_iiiiid, "nullFunc_iiiiii": nullFunc_iiiiii, "nullFunc_iiiiiid": nullFunc_iiiiiid, "nullFunc_iiiiiii": nullFunc_iiiiiii, "nullFunc_iiiiiiii": nullFunc_iiiiiiii, "nullFunc_iiiiiiiii": nullFunc_iiiiiiiii, "nullFunc_iiiiiiiiiiii": nullFunc_iiiiiiiiiiii, "nullFunc_iiiiij": nullFunc_iiiiij, "nullFunc_iij": nullFunc_iij, "nullFunc_ji": nullFunc_ji, "nullFunc_jii": nullFunc_jii, "nullFunc_v": nullFunc_v, "nullFunc_vi": nullFunc_vi, "nullFunc_vii": nullFunc_vii, "nullFunc_viii": nullFunc_viii, "nullFunc_viiii": nullFunc_viiii, "nullFunc_viiiii": nullFunc_viiiii, "nullFunc_viiiiii": nullFunc_viiiiii, "nullFunc_viiiiiii": nullFunc_viiiiiii, "nullFunc_viiiiiiiiii": nullFunc_viiiiiiiiii, "nullFunc_viiiiiiiiiiiiiii": nullFunc_viiiiiiiiiiiiiii, "nullFunc_viij": nullFunc_viij, "nullFunc_viijii": nullFunc_viijii, "nullFunc_vij": nullFunc_vij, "invoke_i": invoke_i, "invoke_id": invoke_id, "invoke_ii": invoke_ii, "invoke_iid": invoke_iid, "invoke_iii": invoke_iii, "invoke_iiii": invoke_iiii, "invoke_iiiii": invoke_iiiii, "invoke_iiiiid": invoke_iiiiid, "invoke_iiiiii": invoke_iiiiii, "invoke_iiiiiid": invoke_iiiiiid, "invoke_iiiiiii": invoke_iiiiiii, "invoke_iiiiiiii": invoke_iiiiiiii, "invoke_iiiiiiiii": invoke_iiiiiiiii, "invoke_iiiiiiiiiiii": invoke_iiiiiiiiiiii, "invoke_iiiiij": invoke_iiiiij, "invoke_iij": invoke_iij, "invoke_ji": invoke_ji, "invoke_jii": invoke_jii, "invoke_v": invoke_v, "invoke_vi": invoke_vi, "invoke_vii": invoke_vii, "invoke_viii": invoke_viii, "invoke_viiii": invoke_viiii, "invoke_viiiii": invoke_viiiii, "invoke_viiiiii": invoke_viiiiii, "invoke_viiiiiii": invoke_viiiiiii, "invoke_viiiiiiiiii": invoke_viiiiiiiiii, "invoke_viiiiiiiiiiiiiii": invoke_viiiiiiiiiiiiiii, "invoke_viij": invoke_viij, "invoke_viijii": invoke_viijii, "invoke_vij": invoke_vij, "___assert_fail": ___assert_fail, "___buildEnvironment": ___buildEnvironment, "___cxa_allocate_exception": ___cxa_allocate_exception, "___cxa_begin_catch": ___cxa_begin_catch, "___cxa_end_catch": ___cxa_end_catch, "___cxa_find_matching_catch": ___cxa_find_matching_catch, "___cxa_find_matching_catch_2": ___cxa_find_matching_catch_2, "___cxa_find_matching_catch_3": ___cxa_find_matching_catch_3, "___cxa_find_matching_catch_4": ___cxa_find_matching_catch_4, "___cxa_free_exception": ___cxa_free_exception, "___cxa_pure_virtual": ___cxa_pure_virtual, "___cxa_rethrow": ___cxa_rethrow, "___cxa_thread_atexit": ___cxa_thread_atexit, "___cxa_throw": ___cxa_throw, "___cxa_uncaught_exception": ___cxa_uncaught_exception, "___gxx_personality_v0": ___gxx_personality_v0, "___lock": ___lock, "___map_file": ___map_file, "___resumeException": ___resumeException, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall145": ___syscall145, "___syscall146": ___syscall146, "___syscall221": ___syscall221, "___syscall5": ___syscall5, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___syscall91": ___syscall91, "___unlock": ___unlock, "__addDays": __addDays, "__arraySum": __arraySum, "__exit": __exit, "__isLeapYear": __isLeapYear, "_abort": _abort, "_atexit": _atexit, "_clock_gettime": _clock_gettime, "_emscripten_get_now": _emscripten_get_now, "_emscripten_get_now_is_monotonic": _emscripten_get_now_is_monotonic, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_exit": _exit, "_getenv": _getenv, "_llvm_ceil_f32": _llvm_ceil_f32, "_llvm_ceil_f64": _llvm_ceil_f64, "_llvm_copysign_f32": _llvm_copysign_f32, "_llvm_copysign_f64": _llvm_copysign_f64, "_llvm_eh_typeid_for": _llvm_eh_typeid_for, "_llvm_fabs_f64": _llvm_fabs_f64, "_llvm_floor_f32": _llvm_floor_f32, "_llvm_floor_f64": _llvm_floor_f64, "_llvm_sqrt_f32": _llvm_sqrt_f32, "_llvm_sqrt_f64": _llvm_sqrt_f64, "_llvm_stackrestore": _llvm_stackrestore, "_llvm_stacksave": _llvm_stacksave, "_llvm_trap": _llvm_trap, "_llvm_trunc_f32": _llvm_trunc_f32, "_llvm_trunc_f64": _llvm_trunc_f64, "_pthread_cond_destroy": _pthread_cond_destroy, "_pthread_cond_signal": _pthread_cond_signal, "_pthread_cond_wait": _pthread_cond_wait, "_pthread_equal": _pthread_equal, "_pthread_getspecific": _pthread_getspecific, "_pthread_join": _pthread_join, "_pthread_key_create": _pthread_key_create, "_pthread_mutex_destroy": _pthread_mutex_destroy, "_pthread_once": _pthread_once, "_pthread_setspecific": _pthread_setspecific, "_strftime": _strftime, "_strftime_l": _strftime_l, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "___dso_handle": ___dso_handle };
// EMSCRIPTEN_START_ASM
var asm =Module["asm"]// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real__BinaryenAbsFloat32 = asm["_BinaryenAbsFloat32"]; asm["_BinaryenAbsFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAbsFloat32.apply(null, arguments);
};

var real__BinaryenAbsFloat64 = asm["_BinaryenAbsFloat64"]; asm["_BinaryenAbsFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAbsFloat64.apply(null, arguments);
};

var real__BinaryenAddExport = asm["_BinaryenAddExport"]; asm["_BinaryenAddExport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddExport.apply(null, arguments);
};

var real__BinaryenAddFloat32 = asm["_BinaryenAddFloat32"]; asm["_BinaryenAddFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddFloat32.apply(null, arguments);
};

var real__BinaryenAddFloat64 = asm["_BinaryenAddFloat64"]; asm["_BinaryenAddFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddFloat64.apply(null, arguments);
};

var real__BinaryenAddFunction = asm["_BinaryenAddFunction"]; asm["_BinaryenAddFunction"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddFunction.apply(null, arguments);
};

var real__BinaryenAddFunctionExport = asm["_BinaryenAddFunctionExport"]; asm["_BinaryenAddFunctionExport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddFunctionExport.apply(null, arguments);
};

var real__BinaryenAddFunctionImport = asm["_BinaryenAddFunctionImport"]; asm["_BinaryenAddFunctionImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddFunctionImport.apply(null, arguments);
};

var real__BinaryenAddFunctionType = asm["_BinaryenAddFunctionType"]; asm["_BinaryenAddFunctionType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddFunctionType.apply(null, arguments);
};

var real__BinaryenAddGlobal = asm["_BinaryenAddGlobal"]; asm["_BinaryenAddGlobal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddGlobal.apply(null, arguments);
};

var real__BinaryenAddGlobalExport = asm["_BinaryenAddGlobalExport"]; asm["_BinaryenAddGlobalExport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddGlobalExport.apply(null, arguments);
};

var real__BinaryenAddGlobalImport = asm["_BinaryenAddGlobalImport"]; asm["_BinaryenAddGlobalImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddGlobalImport.apply(null, arguments);
};

var real__BinaryenAddImport = asm["_BinaryenAddImport"]; asm["_BinaryenAddImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddImport.apply(null, arguments);
};

var real__BinaryenAddInt32 = asm["_BinaryenAddInt32"]; asm["_BinaryenAddInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddInt32.apply(null, arguments);
};

var real__BinaryenAddInt64 = asm["_BinaryenAddInt64"]; asm["_BinaryenAddInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddInt64.apply(null, arguments);
};

var real__BinaryenAddMemoryExport = asm["_BinaryenAddMemoryExport"]; asm["_BinaryenAddMemoryExport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddMemoryExport.apply(null, arguments);
};

var real__BinaryenAddMemoryImport = asm["_BinaryenAddMemoryImport"]; asm["_BinaryenAddMemoryImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddMemoryImport.apply(null, arguments);
};

var real__BinaryenAddTableExport = asm["_BinaryenAddTableExport"]; asm["_BinaryenAddTableExport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddTableExport.apply(null, arguments);
};

var real__BinaryenAddTableImport = asm["_BinaryenAddTableImport"]; asm["_BinaryenAddTableImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAddTableImport.apply(null, arguments);
};

var real__BinaryenAndInt32 = asm["_BinaryenAndInt32"]; asm["_BinaryenAndInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAndInt32.apply(null, arguments);
};

var real__BinaryenAndInt64 = asm["_BinaryenAndInt64"]; asm["_BinaryenAndInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAndInt64.apply(null, arguments);
};

var real__BinaryenAtomicCmpxchg = asm["_BinaryenAtomicCmpxchg"]; asm["_BinaryenAtomicCmpxchg"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicCmpxchg.apply(null, arguments);
};

var real__BinaryenAtomicCmpxchgGetBytes = asm["_BinaryenAtomicCmpxchgGetBytes"]; asm["_BinaryenAtomicCmpxchgGetBytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicCmpxchgGetBytes.apply(null, arguments);
};

var real__BinaryenAtomicCmpxchgGetExpected = asm["_BinaryenAtomicCmpxchgGetExpected"]; asm["_BinaryenAtomicCmpxchgGetExpected"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicCmpxchgGetExpected.apply(null, arguments);
};

var real__BinaryenAtomicCmpxchgGetOffset = asm["_BinaryenAtomicCmpxchgGetOffset"]; asm["_BinaryenAtomicCmpxchgGetOffset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicCmpxchgGetOffset.apply(null, arguments);
};

var real__BinaryenAtomicCmpxchgGetPtr = asm["_BinaryenAtomicCmpxchgGetPtr"]; asm["_BinaryenAtomicCmpxchgGetPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicCmpxchgGetPtr.apply(null, arguments);
};

var real__BinaryenAtomicCmpxchgGetReplacement = asm["_BinaryenAtomicCmpxchgGetReplacement"]; asm["_BinaryenAtomicCmpxchgGetReplacement"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicCmpxchgGetReplacement.apply(null, arguments);
};

var real__BinaryenAtomicCmpxchgId = asm["_BinaryenAtomicCmpxchgId"]; asm["_BinaryenAtomicCmpxchgId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicCmpxchgId.apply(null, arguments);
};

var real__BinaryenAtomicLoad = asm["_BinaryenAtomicLoad"]; asm["_BinaryenAtomicLoad"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicLoad.apply(null, arguments);
};

var real__BinaryenAtomicRMW = asm["_BinaryenAtomicRMW"]; asm["_BinaryenAtomicRMW"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMW.apply(null, arguments);
};

var real__BinaryenAtomicRMWAdd = asm["_BinaryenAtomicRMWAdd"]; asm["_BinaryenAtomicRMWAdd"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMWAdd.apply(null, arguments);
};

var real__BinaryenAtomicRMWAnd = asm["_BinaryenAtomicRMWAnd"]; asm["_BinaryenAtomicRMWAnd"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMWAnd.apply(null, arguments);
};

var real__BinaryenAtomicRMWGetBytes = asm["_BinaryenAtomicRMWGetBytes"]; asm["_BinaryenAtomicRMWGetBytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMWGetBytes.apply(null, arguments);
};

var real__BinaryenAtomicRMWGetOffset = asm["_BinaryenAtomicRMWGetOffset"]; asm["_BinaryenAtomicRMWGetOffset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMWGetOffset.apply(null, arguments);
};

var real__BinaryenAtomicRMWGetOp = asm["_BinaryenAtomicRMWGetOp"]; asm["_BinaryenAtomicRMWGetOp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMWGetOp.apply(null, arguments);
};

var real__BinaryenAtomicRMWGetPtr = asm["_BinaryenAtomicRMWGetPtr"]; asm["_BinaryenAtomicRMWGetPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMWGetPtr.apply(null, arguments);
};

var real__BinaryenAtomicRMWGetValue = asm["_BinaryenAtomicRMWGetValue"]; asm["_BinaryenAtomicRMWGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMWGetValue.apply(null, arguments);
};

var real__BinaryenAtomicRMWId = asm["_BinaryenAtomicRMWId"]; asm["_BinaryenAtomicRMWId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMWId.apply(null, arguments);
};

var real__BinaryenAtomicRMWOr = asm["_BinaryenAtomicRMWOr"]; asm["_BinaryenAtomicRMWOr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMWOr.apply(null, arguments);
};

var real__BinaryenAtomicRMWSub = asm["_BinaryenAtomicRMWSub"]; asm["_BinaryenAtomicRMWSub"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMWSub.apply(null, arguments);
};

var real__BinaryenAtomicRMWXchg = asm["_BinaryenAtomicRMWXchg"]; asm["_BinaryenAtomicRMWXchg"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMWXchg.apply(null, arguments);
};

var real__BinaryenAtomicRMWXor = asm["_BinaryenAtomicRMWXor"]; asm["_BinaryenAtomicRMWXor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicRMWXor.apply(null, arguments);
};

var real__BinaryenAtomicStore = asm["_BinaryenAtomicStore"]; asm["_BinaryenAtomicStore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicStore.apply(null, arguments);
};

var real__BinaryenAtomicWait = asm["_BinaryenAtomicWait"]; asm["_BinaryenAtomicWait"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicWait.apply(null, arguments);
};

var real__BinaryenAtomicWaitGetExpected = asm["_BinaryenAtomicWaitGetExpected"]; asm["_BinaryenAtomicWaitGetExpected"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicWaitGetExpected.apply(null, arguments);
};

var real__BinaryenAtomicWaitGetExpectedType = asm["_BinaryenAtomicWaitGetExpectedType"]; asm["_BinaryenAtomicWaitGetExpectedType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicWaitGetExpectedType.apply(null, arguments);
};

var real__BinaryenAtomicWaitGetPtr = asm["_BinaryenAtomicWaitGetPtr"]; asm["_BinaryenAtomicWaitGetPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicWaitGetPtr.apply(null, arguments);
};

var real__BinaryenAtomicWaitGetTimeout = asm["_BinaryenAtomicWaitGetTimeout"]; asm["_BinaryenAtomicWaitGetTimeout"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicWaitGetTimeout.apply(null, arguments);
};

var real__BinaryenAtomicWaitId = asm["_BinaryenAtomicWaitId"]; asm["_BinaryenAtomicWaitId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicWaitId.apply(null, arguments);
};

var real__BinaryenAtomicWake = asm["_BinaryenAtomicWake"]; asm["_BinaryenAtomicWake"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicWake.apply(null, arguments);
};

var real__BinaryenAtomicWakeGetPtr = asm["_BinaryenAtomicWakeGetPtr"]; asm["_BinaryenAtomicWakeGetPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicWakeGetPtr.apply(null, arguments);
};

var real__BinaryenAtomicWakeGetWakeCount = asm["_BinaryenAtomicWakeGetWakeCount"]; asm["_BinaryenAtomicWakeGetWakeCount"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicWakeGetWakeCount.apply(null, arguments);
};

var real__BinaryenAtomicWakeId = asm["_BinaryenAtomicWakeId"]; asm["_BinaryenAtomicWakeId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenAtomicWakeId.apply(null, arguments);
};

var real__BinaryenBinary = asm["_BinaryenBinary"]; asm["_BinaryenBinary"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBinary.apply(null, arguments);
};

var real__BinaryenBinaryGetLeft = asm["_BinaryenBinaryGetLeft"]; asm["_BinaryenBinaryGetLeft"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBinaryGetLeft.apply(null, arguments);
};

var real__BinaryenBinaryGetOp = asm["_BinaryenBinaryGetOp"]; asm["_BinaryenBinaryGetOp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBinaryGetOp.apply(null, arguments);
};

var real__BinaryenBinaryGetRight = asm["_BinaryenBinaryGetRight"]; asm["_BinaryenBinaryGetRight"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBinaryGetRight.apply(null, arguments);
};

var real__BinaryenBinaryId = asm["_BinaryenBinaryId"]; asm["_BinaryenBinaryId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBinaryId.apply(null, arguments);
};

var real__BinaryenBlock = asm["_BinaryenBlock"]; asm["_BinaryenBlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBlock.apply(null, arguments);
};

var real__BinaryenBlockGetChild = asm["_BinaryenBlockGetChild"]; asm["_BinaryenBlockGetChild"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBlockGetChild.apply(null, arguments);
};

var real__BinaryenBlockGetName = asm["_BinaryenBlockGetName"]; asm["_BinaryenBlockGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBlockGetName.apply(null, arguments);
};

var real__BinaryenBlockGetNumChildren = asm["_BinaryenBlockGetNumChildren"]; asm["_BinaryenBlockGetNumChildren"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBlockGetNumChildren.apply(null, arguments);
};

var real__BinaryenBlockId = asm["_BinaryenBlockId"]; asm["_BinaryenBlockId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBlockId.apply(null, arguments);
};

var real__BinaryenBreak = asm["_BinaryenBreak"]; asm["_BinaryenBreak"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBreak.apply(null, arguments);
};

var real__BinaryenBreakGetCondition = asm["_BinaryenBreakGetCondition"]; asm["_BinaryenBreakGetCondition"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBreakGetCondition.apply(null, arguments);
};

var real__BinaryenBreakGetName = asm["_BinaryenBreakGetName"]; asm["_BinaryenBreakGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBreakGetName.apply(null, arguments);
};

var real__BinaryenBreakGetValue = asm["_BinaryenBreakGetValue"]; asm["_BinaryenBreakGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBreakGetValue.apply(null, arguments);
};

var real__BinaryenBreakId = asm["_BinaryenBreakId"]; asm["_BinaryenBreakId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenBreakId.apply(null, arguments);
};

var real__BinaryenCall = asm["_BinaryenCall"]; asm["_BinaryenCall"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCall.apply(null, arguments);
};

var real__BinaryenCallGetNumOperands = asm["_BinaryenCallGetNumOperands"]; asm["_BinaryenCallGetNumOperands"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallGetNumOperands.apply(null, arguments);
};

var real__BinaryenCallGetOperand = asm["_BinaryenCallGetOperand"]; asm["_BinaryenCallGetOperand"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallGetOperand.apply(null, arguments);
};

var real__BinaryenCallGetTarget = asm["_BinaryenCallGetTarget"]; asm["_BinaryenCallGetTarget"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallGetTarget.apply(null, arguments);
};

var real__BinaryenCallId = asm["_BinaryenCallId"]; asm["_BinaryenCallId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallId.apply(null, arguments);
};

var real__BinaryenCallImport = asm["_BinaryenCallImport"]; asm["_BinaryenCallImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallImport.apply(null, arguments);
};

var real__BinaryenCallImportGetNumOperands = asm["_BinaryenCallImportGetNumOperands"]; asm["_BinaryenCallImportGetNumOperands"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallImportGetNumOperands.apply(null, arguments);
};

var real__BinaryenCallImportGetOperand = asm["_BinaryenCallImportGetOperand"]; asm["_BinaryenCallImportGetOperand"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallImportGetOperand.apply(null, arguments);
};

var real__BinaryenCallImportGetTarget = asm["_BinaryenCallImportGetTarget"]; asm["_BinaryenCallImportGetTarget"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallImportGetTarget.apply(null, arguments);
};

var real__BinaryenCallImportId = asm["_BinaryenCallImportId"]; asm["_BinaryenCallImportId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallImportId.apply(null, arguments);
};

var real__BinaryenCallIndirect = asm["_BinaryenCallIndirect"]; asm["_BinaryenCallIndirect"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallIndirect.apply(null, arguments);
};

var real__BinaryenCallIndirectGetNumOperands = asm["_BinaryenCallIndirectGetNumOperands"]; asm["_BinaryenCallIndirectGetNumOperands"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallIndirectGetNumOperands.apply(null, arguments);
};

var real__BinaryenCallIndirectGetOperand = asm["_BinaryenCallIndirectGetOperand"]; asm["_BinaryenCallIndirectGetOperand"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallIndirectGetOperand.apply(null, arguments);
};

var real__BinaryenCallIndirectGetTarget = asm["_BinaryenCallIndirectGetTarget"]; asm["_BinaryenCallIndirectGetTarget"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallIndirectGetTarget.apply(null, arguments);
};

var real__BinaryenCallIndirectId = asm["_BinaryenCallIndirectId"]; asm["_BinaryenCallIndirectId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCallIndirectId.apply(null, arguments);
};

var real__BinaryenCeilFloat32 = asm["_BinaryenCeilFloat32"]; asm["_BinaryenCeilFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCeilFloat32.apply(null, arguments);
};

var real__BinaryenCeilFloat64 = asm["_BinaryenCeilFloat64"]; asm["_BinaryenCeilFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCeilFloat64.apply(null, arguments);
};

var real__BinaryenClzInt32 = asm["_BinaryenClzInt32"]; asm["_BinaryenClzInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenClzInt32.apply(null, arguments);
};

var real__BinaryenClzInt64 = asm["_BinaryenClzInt64"]; asm["_BinaryenClzInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenClzInt64.apply(null, arguments);
};

var real__BinaryenConst = asm["_BinaryenConst"]; asm["_BinaryenConst"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConst.apply(null, arguments);
};

var real__BinaryenConstGetValueF32 = asm["_BinaryenConstGetValueF32"]; asm["_BinaryenConstGetValueF32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConstGetValueF32.apply(null, arguments);
};

var real__BinaryenConstGetValueF64 = asm["_BinaryenConstGetValueF64"]; asm["_BinaryenConstGetValueF64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConstGetValueF64.apply(null, arguments);
};

var real__BinaryenConstGetValueI32 = asm["_BinaryenConstGetValueI32"]; asm["_BinaryenConstGetValueI32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConstGetValueI32.apply(null, arguments);
};

var real__BinaryenConstGetValueI64 = asm["_BinaryenConstGetValueI64"]; asm["_BinaryenConstGetValueI64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConstGetValueI64.apply(null, arguments);
};

var real__BinaryenConstGetValueI64High = asm["_BinaryenConstGetValueI64High"]; asm["_BinaryenConstGetValueI64High"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConstGetValueI64High.apply(null, arguments);
};

var real__BinaryenConstGetValueI64Low = asm["_BinaryenConstGetValueI64Low"]; asm["_BinaryenConstGetValueI64Low"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConstGetValueI64Low.apply(null, arguments);
};

var real__BinaryenConstId = asm["_BinaryenConstId"]; asm["_BinaryenConstId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConstId.apply(null, arguments);
};

var real__BinaryenConvertSInt32ToFloat32 = asm["_BinaryenConvertSInt32ToFloat32"]; asm["_BinaryenConvertSInt32ToFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConvertSInt32ToFloat32.apply(null, arguments);
};

var real__BinaryenConvertSInt32ToFloat64 = asm["_BinaryenConvertSInt32ToFloat64"]; asm["_BinaryenConvertSInt32ToFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConvertSInt32ToFloat64.apply(null, arguments);
};

var real__BinaryenConvertSInt64ToFloat32 = asm["_BinaryenConvertSInt64ToFloat32"]; asm["_BinaryenConvertSInt64ToFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConvertSInt64ToFloat32.apply(null, arguments);
};

var real__BinaryenConvertSInt64ToFloat64 = asm["_BinaryenConvertSInt64ToFloat64"]; asm["_BinaryenConvertSInt64ToFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConvertSInt64ToFloat64.apply(null, arguments);
};

var real__BinaryenConvertUInt32ToFloat32 = asm["_BinaryenConvertUInt32ToFloat32"]; asm["_BinaryenConvertUInt32ToFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConvertUInt32ToFloat32.apply(null, arguments);
};

var real__BinaryenConvertUInt32ToFloat64 = asm["_BinaryenConvertUInt32ToFloat64"]; asm["_BinaryenConvertUInt32ToFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConvertUInt32ToFloat64.apply(null, arguments);
};

var real__BinaryenConvertUInt64ToFloat32 = asm["_BinaryenConvertUInt64ToFloat32"]; asm["_BinaryenConvertUInt64ToFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConvertUInt64ToFloat32.apply(null, arguments);
};

var real__BinaryenConvertUInt64ToFloat64 = asm["_BinaryenConvertUInt64ToFloat64"]; asm["_BinaryenConvertUInt64ToFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenConvertUInt64ToFloat64.apply(null, arguments);
};

var real__BinaryenCopySignFloat32 = asm["_BinaryenCopySignFloat32"]; asm["_BinaryenCopySignFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCopySignFloat32.apply(null, arguments);
};

var real__BinaryenCopySignFloat64 = asm["_BinaryenCopySignFloat64"]; asm["_BinaryenCopySignFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCopySignFloat64.apply(null, arguments);
};

var real__BinaryenCtzInt32 = asm["_BinaryenCtzInt32"]; asm["_BinaryenCtzInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCtzInt32.apply(null, arguments);
};

var real__BinaryenCtzInt64 = asm["_BinaryenCtzInt64"]; asm["_BinaryenCtzInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCtzInt64.apply(null, arguments);
};

var real__BinaryenCurrentMemory = asm["_BinaryenCurrentMemory"]; asm["_BinaryenCurrentMemory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenCurrentMemory.apply(null, arguments);
};

var real__BinaryenDemoteFloat64 = asm["_BinaryenDemoteFloat64"]; asm["_BinaryenDemoteFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenDemoteFloat64.apply(null, arguments);
};

var real__BinaryenDivFloat32 = asm["_BinaryenDivFloat32"]; asm["_BinaryenDivFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenDivFloat32.apply(null, arguments);
};

var real__BinaryenDivFloat64 = asm["_BinaryenDivFloat64"]; asm["_BinaryenDivFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenDivFloat64.apply(null, arguments);
};

var real__BinaryenDivSInt32 = asm["_BinaryenDivSInt32"]; asm["_BinaryenDivSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenDivSInt32.apply(null, arguments);
};

var real__BinaryenDivSInt64 = asm["_BinaryenDivSInt64"]; asm["_BinaryenDivSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenDivSInt64.apply(null, arguments);
};

var real__BinaryenDivUInt32 = asm["_BinaryenDivUInt32"]; asm["_BinaryenDivUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenDivUInt32.apply(null, arguments);
};

var real__BinaryenDivUInt64 = asm["_BinaryenDivUInt64"]; asm["_BinaryenDivUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenDivUInt64.apply(null, arguments);
};

var real__BinaryenDrop = asm["_BinaryenDrop"]; asm["_BinaryenDrop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenDrop.apply(null, arguments);
};

var real__BinaryenDropGetValue = asm["_BinaryenDropGetValue"]; asm["_BinaryenDropGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenDropGetValue.apply(null, arguments);
};

var real__BinaryenDropId = asm["_BinaryenDropId"]; asm["_BinaryenDropId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenDropId.apply(null, arguments);
};

var real__BinaryenEqFloat32 = asm["_BinaryenEqFloat32"]; asm["_BinaryenEqFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenEqFloat32.apply(null, arguments);
};

var real__BinaryenEqFloat64 = asm["_BinaryenEqFloat64"]; asm["_BinaryenEqFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenEqFloat64.apply(null, arguments);
};

var real__BinaryenEqInt32 = asm["_BinaryenEqInt32"]; asm["_BinaryenEqInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenEqInt32.apply(null, arguments);
};

var real__BinaryenEqInt64 = asm["_BinaryenEqInt64"]; asm["_BinaryenEqInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenEqInt64.apply(null, arguments);
};

var real__BinaryenEqZInt32 = asm["_BinaryenEqZInt32"]; asm["_BinaryenEqZInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenEqZInt32.apply(null, arguments);
};

var real__BinaryenEqZInt64 = asm["_BinaryenEqZInt64"]; asm["_BinaryenEqZInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenEqZInt64.apply(null, arguments);
};

var real__BinaryenExportGetKind = asm["_BinaryenExportGetKind"]; asm["_BinaryenExportGetKind"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExportGetKind.apply(null, arguments);
};

var real__BinaryenExportGetName = asm["_BinaryenExportGetName"]; asm["_BinaryenExportGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExportGetName.apply(null, arguments);
};

var real__BinaryenExportGetValue = asm["_BinaryenExportGetValue"]; asm["_BinaryenExportGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExportGetValue.apply(null, arguments);
};

var real__BinaryenExpressionGetId = asm["_BinaryenExpressionGetId"]; asm["_BinaryenExpressionGetId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExpressionGetId.apply(null, arguments);
};

var real__BinaryenExpressionGetType = asm["_BinaryenExpressionGetType"]; asm["_BinaryenExpressionGetType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExpressionGetType.apply(null, arguments);
};

var real__BinaryenExpressionPrint = asm["_BinaryenExpressionPrint"]; asm["_BinaryenExpressionPrint"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExpressionPrint.apply(null, arguments);
};

var real__BinaryenExtendS16Int32 = asm["_BinaryenExtendS16Int32"]; asm["_BinaryenExtendS16Int32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExtendS16Int32.apply(null, arguments);
};

var real__BinaryenExtendS16Int64 = asm["_BinaryenExtendS16Int64"]; asm["_BinaryenExtendS16Int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExtendS16Int64.apply(null, arguments);
};

var real__BinaryenExtendS32Int64 = asm["_BinaryenExtendS32Int64"]; asm["_BinaryenExtendS32Int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExtendS32Int64.apply(null, arguments);
};

var real__BinaryenExtendS8Int32 = asm["_BinaryenExtendS8Int32"]; asm["_BinaryenExtendS8Int32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExtendS8Int32.apply(null, arguments);
};

var real__BinaryenExtendS8Int64 = asm["_BinaryenExtendS8Int64"]; asm["_BinaryenExtendS8Int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExtendS8Int64.apply(null, arguments);
};

var real__BinaryenExtendSInt32 = asm["_BinaryenExtendSInt32"]; asm["_BinaryenExtendSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExtendSInt32.apply(null, arguments);
};

var real__BinaryenExtendUInt32 = asm["_BinaryenExtendUInt32"]; asm["_BinaryenExtendUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExtendUInt32.apply(null, arguments);
};

var real__BinaryenExternalFunction = asm["_BinaryenExternalFunction"]; asm["_BinaryenExternalFunction"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExternalFunction.apply(null, arguments);
};

var real__BinaryenExternalGlobal = asm["_BinaryenExternalGlobal"]; asm["_BinaryenExternalGlobal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExternalGlobal.apply(null, arguments);
};

var real__BinaryenExternalMemory = asm["_BinaryenExternalMemory"]; asm["_BinaryenExternalMemory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExternalMemory.apply(null, arguments);
};

var real__BinaryenExternalTable = asm["_BinaryenExternalTable"]; asm["_BinaryenExternalTable"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenExternalTable.apply(null, arguments);
};

var real__BinaryenFloat32 = asm["_BinaryenFloat32"]; asm["_BinaryenFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFloat32.apply(null, arguments);
};

var real__BinaryenFloat64 = asm["_BinaryenFloat64"]; asm["_BinaryenFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFloat64.apply(null, arguments);
};

var real__BinaryenFloorFloat32 = asm["_BinaryenFloorFloat32"]; asm["_BinaryenFloorFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFloorFloat32.apply(null, arguments);
};

var real__BinaryenFloorFloat64 = asm["_BinaryenFloorFloat64"]; asm["_BinaryenFloorFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFloorFloat64.apply(null, arguments);
};

var real__BinaryenFunctionGetBody = asm["_BinaryenFunctionGetBody"]; asm["_BinaryenFunctionGetBody"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionGetBody.apply(null, arguments);
};

var real__BinaryenFunctionGetName = asm["_BinaryenFunctionGetName"]; asm["_BinaryenFunctionGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionGetName.apply(null, arguments);
};

var real__BinaryenFunctionGetNumParams = asm["_BinaryenFunctionGetNumParams"]; asm["_BinaryenFunctionGetNumParams"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionGetNumParams.apply(null, arguments);
};

var real__BinaryenFunctionGetNumVars = asm["_BinaryenFunctionGetNumVars"]; asm["_BinaryenFunctionGetNumVars"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionGetNumVars.apply(null, arguments);
};

var real__BinaryenFunctionGetParam = asm["_BinaryenFunctionGetParam"]; asm["_BinaryenFunctionGetParam"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionGetParam.apply(null, arguments);
};

var real__BinaryenFunctionGetResult = asm["_BinaryenFunctionGetResult"]; asm["_BinaryenFunctionGetResult"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionGetResult.apply(null, arguments);
};

var real__BinaryenFunctionGetType = asm["_BinaryenFunctionGetType"]; asm["_BinaryenFunctionGetType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionGetType.apply(null, arguments);
};

var real__BinaryenFunctionGetVar = asm["_BinaryenFunctionGetVar"]; asm["_BinaryenFunctionGetVar"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionGetVar.apply(null, arguments);
};

var real__BinaryenFunctionOptimize = asm["_BinaryenFunctionOptimize"]; asm["_BinaryenFunctionOptimize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionOptimize.apply(null, arguments);
};

var real__BinaryenFunctionRunPasses = asm["_BinaryenFunctionRunPasses"]; asm["_BinaryenFunctionRunPasses"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionRunPasses.apply(null, arguments);
};

var real__BinaryenFunctionSetDebugLocation = asm["_BinaryenFunctionSetDebugLocation"]; asm["_BinaryenFunctionSetDebugLocation"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionSetDebugLocation.apply(null, arguments);
};

var real__BinaryenFunctionTypeGetName = asm["_BinaryenFunctionTypeGetName"]; asm["_BinaryenFunctionTypeGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionTypeGetName.apply(null, arguments);
};

var real__BinaryenFunctionTypeGetNumParams = asm["_BinaryenFunctionTypeGetNumParams"]; asm["_BinaryenFunctionTypeGetNumParams"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionTypeGetNumParams.apply(null, arguments);
};

var real__BinaryenFunctionTypeGetParam = asm["_BinaryenFunctionTypeGetParam"]; asm["_BinaryenFunctionTypeGetParam"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionTypeGetParam.apply(null, arguments);
};

var real__BinaryenFunctionTypeGetResult = asm["_BinaryenFunctionTypeGetResult"]; asm["_BinaryenFunctionTypeGetResult"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenFunctionTypeGetResult.apply(null, arguments);
};

var real__BinaryenGeFloat32 = asm["_BinaryenGeFloat32"]; asm["_BinaryenGeFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGeFloat32.apply(null, arguments);
};

var real__BinaryenGeFloat64 = asm["_BinaryenGeFloat64"]; asm["_BinaryenGeFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGeFloat64.apply(null, arguments);
};

var real__BinaryenGeSInt32 = asm["_BinaryenGeSInt32"]; asm["_BinaryenGeSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGeSInt32.apply(null, arguments);
};

var real__BinaryenGeSInt64 = asm["_BinaryenGeSInt64"]; asm["_BinaryenGeSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGeSInt64.apply(null, arguments);
};

var real__BinaryenGeUInt32 = asm["_BinaryenGeUInt32"]; asm["_BinaryenGeUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGeUInt32.apply(null, arguments);
};

var real__BinaryenGeUInt64 = asm["_BinaryenGeUInt64"]; asm["_BinaryenGeUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGeUInt64.apply(null, arguments);
};

var real__BinaryenGetDebugInfo = asm["_BinaryenGetDebugInfo"]; asm["_BinaryenGetDebugInfo"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGetDebugInfo.apply(null, arguments);
};

var real__BinaryenGetFunction = asm["_BinaryenGetFunction"]; asm["_BinaryenGetFunction"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGetFunction.apply(null, arguments);
};

var real__BinaryenGetFunctionTypeBySignature = asm["_BinaryenGetFunctionTypeBySignature"]; asm["_BinaryenGetFunctionTypeBySignature"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGetFunctionTypeBySignature.apply(null, arguments);
};

var real__BinaryenGetGlobal = asm["_BinaryenGetGlobal"]; asm["_BinaryenGetGlobal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGetGlobal.apply(null, arguments);
};

var real__BinaryenGetGlobalGetName = asm["_BinaryenGetGlobalGetName"]; asm["_BinaryenGetGlobalGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGetGlobalGetName.apply(null, arguments);
};

var real__BinaryenGetGlobalId = asm["_BinaryenGetGlobalId"]; asm["_BinaryenGetGlobalId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGetGlobalId.apply(null, arguments);
};

var real__BinaryenGetLocal = asm["_BinaryenGetLocal"]; asm["_BinaryenGetLocal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGetLocal.apply(null, arguments);
};

var real__BinaryenGetLocalGetIndex = asm["_BinaryenGetLocalGetIndex"]; asm["_BinaryenGetLocalGetIndex"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGetLocalGetIndex.apply(null, arguments);
};

var real__BinaryenGetLocalId = asm["_BinaryenGetLocalId"]; asm["_BinaryenGetLocalId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGetLocalId.apply(null, arguments);
};

var real__BinaryenGetOptimizeLevel = asm["_BinaryenGetOptimizeLevel"]; asm["_BinaryenGetOptimizeLevel"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGetOptimizeLevel.apply(null, arguments);
};

var real__BinaryenGetShrinkLevel = asm["_BinaryenGetShrinkLevel"]; asm["_BinaryenGetShrinkLevel"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGetShrinkLevel.apply(null, arguments);
};

var real__BinaryenGrowMemory = asm["_BinaryenGrowMemory"]; asm["_BinaryenGrowMemory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGrowMemory.apply(null, arguments);
};

var real__BinaryenGtFloat32 = asm["_BinaryenGtFloat32"]; asm["_BinaryenGtFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGtFloat32.apply(null, arguments);
};

var real__BinaryenGtFloat64 = asm["_BinaryenGtFloat64"]; asm["_BinaryenGtFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGtFloat64.apply(null, arguments);
};

var real__BinaryenGtSInt32 = asm["_BinaryenGtSInt32"]; asm["_BinaryenGtSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGtSInt32.apply(null, arguments);
};

var real__BinaryenGtSInt64 = asm["_BinaryenGtSInt64"]; asm["_BinaryenGtSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGtSInt64.apply(null, arguments);
};

var real__BinaryenGtUInt32 = asm["_BinaryenGtUInt32"]; asm["_BinaryenGtUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGtUInt32.apply(null, arguments);
};

var real__BinaryenGtUInt64 = asm["_BinaryenGtUInt64"]; asm["_BinaryenGtUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenGtUInt64.apply(null, arguments);
};

var real__BinaryenHasFeature = asm["_BinaryenHasFeature"]; asm["_BinaryenHasFeature"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenHasFeature.apply(null, arguments);
};

var real__BinaryenHost = asm["_BinaryenHost"]; asm["_BinaryenHost"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenHost.apply(null, arguments);
};

var real__BinaryenHostGetNameOperand = asm["_BinaryenHostGetNameOperand"]; asm["_BinaryenHostGetNameOperand"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenHostGetNameOperand.apply(null, arguments);
};

var real__BinaryenHostGetNumOperands = asm["_BinaryenHostGetNumOperands"]; asm["_BinaryenHostGetNumOperands"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenHostGetNumOperands.apply(null, arguments);
};

var real__BinaryenHostGetOp = asm["_BinaryenHostGetOp"]; asm["_BinaryenHostGetOp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenHostGetOp.apply(null, arguments);
};

var real__BinaryenHostGetOperand = asm["_BinaryenHostGetOperand"]; asm["_BinaryenHostGetOperand"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenHostGetOperand.apply(null, arguments);
};

var real__BinaryenHostId = asm["_BinaryenHostId"]; asm["_BinaryenHostId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenHostId.apply(null, arguments);
};

var real__BinaryenIf = asm["_BinaryenIf"]; asm["_BinaryenIf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenIf.apply(null, arguments);
};

var real__BinaryenIfGetCondition = asm["_BinaryenIfGetCondition"]; asm["_BinaryenIfGetCondition"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenIfGetCondition.apply(null, arguments);
};

var real__BinaryenIfGetIfFalse = asm["_BinaryenIfGetIfFalse"]; asm["_BinaryenIfGetIfFalse"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenIfGetIfFalse.apply(null, arguments);
};

var real__BinaryenIfGetIfTrue = asm["_BinaryenIfGetIfTrue"]; asm["_BinaryenIfGetIfTrue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenIfGetIfTrue.apply(null, arguments);
};

var real__BinaryenIfId = asm["_BinaryenIfId"]; asm["_BinaryenIfId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenIfId.apply(null, arguments);
};

var real__BinaryenImportGetBase = asm["_BinaryenImportGetBase"]; asm["_BinaryenImportGetBase"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenImportGetBase.apply(null, arguments);
};

var real__BinaryenImportGetFunctionType = asm["_BinaryenImportGetFunctionType"]; asm["_BinaryenImportGetFunctionType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenImportGetFunctionType.apply(null, arguments);
};

var real__BinaryenImportGetGlobalType = asm["_BinaryenImportGetGlobalType"]; asm["_BinaryenImportGetGlobalType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenImportGetGlobalType.apply(null, arguments);
};

var real__BinaryenImportGetKind = asm["_BinaryenImportGetKind"]; asm["_BinaryenImportGetKind"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenImportGetKind.apply(null, arguments);
};

var real__BinaryenImportGetModule = asm["_BinaryenImportGetModule"]; asm["_BinaryenImportGetModule"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenImportGetModule.apply(null, arguments);
};

var real__BinaryenImportGetName = asm["_BinaryenImportGetName"]; asm["_BinaryenImportGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenImportGetName.apply(null, arguments);
};

var real__BinaryenInt32 = asm["_BinaryenInt32"]; asm["_BinaryenInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenInt32.apply(null, arguments);
};

var real__BinaryenInt64 = asm["_BinaryenInt64"]; asm["_BinaryenInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenInt64.apply(null, arguments);
};

var real__BinaryenInvalidId = asm["_BinaryenInvalidId"]; asm["_BinaryenInvalidId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenInvalidId.apply(null, arguments);
};

var real__BinaryenLeFloat32 = asm["_BinaryenLeFloat32"]; asm["_BinaryenLeFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLeFloat32.apply(null, arguments);
};

var real__BinaryenLeFloat64 = asm["_BinaryenLeFloat64"]; asm["_BinaryenLeFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLeFloat64.apply(null, arguments);
};

var real__BinaryenLeSInt32 = asm["_BinaryenLeSInt32"]; asm["_BinaryenLeSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLeSInt32.apply(null, arguments);
};

var real__BinaryenLeSInt64 = asm["_BinaryenLeSInt64"]; asm["_BinaryenLeSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLeSInt64.apply(null, arguments);
};

var real__BinaryenLeUInt32 = asm["_BinaryenLeUInt32"]; asm["_BinaryenLeUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLeUInt32.apply(null, arguments);
};

var real__BinaryenLeUInt64 = asm["_BinaryenLeUInt64"]; asm["_BinaryenLeUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLeUInt64.apply(null, arguments);
};

var real__BinaryenLiteralFloat32 = asm["_BinaryenLiteralFloat32"]; asm["_BinaryenLiteralFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLiteralFloat32.apply(null, arguments);
};

var real__BinaryenLiteralFloat32Bits = asm["_BinaryenLiteralFloat32Bits"]; asm["_BinaryenLiteralFloat32Bits"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLiteralFloat32Bits.apply(null, arguments);
};

var real__BinaryenLiteralFloat64 = asm["_BinaryenLiteralFloat64"]; asm["_BinaryenLiteralFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLiteralFloat64.apply(null, arguments);
};

var real__BinaryenLiteralFloat64Bits = asm["_BinaryenLiteralFloat64Bits"]; asm["_BinaryenLiteralFloat64Bits"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLiteralFloat64Bits.apply(null, arguments);
};

var real__BinaryenLiteralInt32 = asm["_BinaryenLiteralInt32"]; asm["_BinaryenLiteralInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLiteralInt32.apply(null, arguments);
};

var real__BinaryenLiteralInt64 = asm["_BinaryenLiteralInt64"]; asm["_BinaryenLiteralInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLiteralInt64.apply(null, arguments);
};

var real__BinaryenLoad = asm["_BinaryenLoad"]; asm["_BinaryenLoad"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLoad.apply(null, arguments);
};

var real__BinaryenLoadGetAlign = asm["_BinaryenLoadGetAlign"]; asm["_BinaryenLoadGetAlign"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLoadGetAlign.apply(null, arguments);
};

var real__BinaryenLoadGetBytes = asm["_BinaryenLoadGetBytes"]; asm["_BinaryenLoadGetBytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLoadGetBytes.apply(null, arguments);
};

var real__BinaryenLoadGetOffset = asm["_BinaryenLoadGetOffset"]; asm["_BinaryenLoadGetOffset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLoadGetOffset.apply(null, arguments);
};

var real__BinaryenLoadGetPtr = asm["_BinaryenLoadGetPtr"]; asm["_BinaryenLoadGetPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLoadGetPtr.apply(null, arguments);
};

var real__BinaryenLoadId = asm["_BinaryenLoadId"]; asm["_BinaryenLoadId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLoadId.apply(null, arguments);
};

var real__BinaryenLoadIsAtomic = asm["_BinaryenLoadIsAtomic"]; asm["_BinaryenLoadIsAtomic"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLoadIsAtomic.apply(null, arguments);
};

var real__BinaryenLoadIsSigned = asm["_BinaryenLoadIsSigned"]; asm["_BinaryenLoadIsSigned"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLoadIsSigned.apply(null, arguments);
};

var real__BinaryenLoop = asm["_BinaryenLoop"]; asm["_BinaryenLoop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLoop.apply(null, arguments);
};

var real__BinaryenLoopGetBody = asm["_BinaryenLoopGetBody"]; asm["_BinaryenLoopGetBody"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLoopGetBody.apply(null, arguments);
};

var real__BinaryenLoopGetName = asm["_BinaryenLoopGetName"]; asm["_BinaryenLoopGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLoopGetName.apply(null, arguments);
};

var real__BinaryenLoopId = asm["_BinaryenLoopId"]; asm["_BinaryenLoopId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLoopId.apply(null, arguments);
};

var real__BinaryenLtFloat32 = asm["_BinaryenLtFloat32"]; asm["_BinaryenLtFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLtFloat32.apply(null, arguments);
};

var real__BinaryenLtFloat64 = asm["_BinaryenLtFloat64"]; asm["_BinaryenLtFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLtFloat64.apply(null, arguments);
};

var real__BinaryenLtSInt32 = asm["_BinaryenLtSInt32"]; asm["_BinaryenLtSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLtSInt32.apply(null, arguments);
};

var real__BinaryenLtSInt64 = asm["_BinaryenLtSInt64"]; asm["_BinaryenLtSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLtSInt64.apply(null, arguments);
};

var real__BinaryenLtUInt32 = asm["_BinaryenLtUInt32"]; asm["_BinaryenLtUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLtUInt32.apply(null, arguments);
};

var real__BinaryenLtUInt64 = asm["_BinaryenLtUInt64"]; asm["_BinaryenLtUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenLtUInt64.apply(null, arguments);
};

var real__BinaryenMaxFloat32 = asm["_BinaryenMaxFloat32"]; asm["_BinaryenMaxFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenMaxFloat32.apply(null, arguments);
};

var real__BinaryenMaxFloat64 = asm["_BinaryenMaxFloat64"]; asm["_BinaryenMaxFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenMaxFloat64.apply(null, arguments);
};

var real__BinaryenMinFloat32 = asm["_BinaryenMinFloat32"]; asm["_BinaryenMinFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenMinFloat32.apply(null, arguments);
};

var real__BinaryenMinFloat64 = asm["_BinaryenMinFloat64"]; asm["_BinaryenMinFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenMinFloat64.apply(null, arguments);
};

var real__BinaryenModuleAddDebugInfoFileName = asm["_BinaryenModuleAddDebugInfoFileName"]; asm["_BinaryenModuleAddDebugInfoFileName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleAddDebugInfoFileName.apply(null, arguments);
};

var real__BinaryenModuleAllocateAndWrite = asm["_BinaryenModuleAllocateAndWrite"]; asm["_BinaryenModuleAllocateAndWrite"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleAllocateAndWrite.apply(null, arguments);
};

var real__BinaryenModuleAutoDrop = asm["_BinaryenModuleAutoDrop"]; asm["_BinaryenModuleAutoDrop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleAutoDrop.apply(null, arguments);
};

var real__BinaryenModuleCreate = asm["_BinaryenModuleCreate"]; asm["_BinaryenModuleCreate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleCreate.apply(null, arguments);
};

var real__BinaryenModuleDispose = asm["_BinaryenModuleDispose"]; asm["_BinaryenModuleDispose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleDispose.apply(null, arguments);
};

var real__BinaryenModuleGetDebugInfoFileName = asm["_BinaryenModuleGetDebugInfoFileName"]; asm["_BinaryenModuleGetDebugInfoFileName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleGetDebugInfoFileName.apply(null, arguments);
};

var real__BinaryenModuleInterpret = asm["_BinaryenModuleInterpret"]; asm["_BinaryenModuleInterpret"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleInterpret.apply(null, arguments);
};

var real__BinaryenModuleOptimize = asm["_BinaryenModuleOptimize"]; asm["_BinaryenModuleOptimize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleOptimize.apply(null, arguments);
};

var real__BinaryenModuleParse = asm["_BinaryenModuleParse"]; asm["_BinaryenModuleParse"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleParse.apply(null, arguments);
};

var real__BinaryenModulePrint = asm["_BinaryenModulePrint"]; asm["_BinaryenModulePrint"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModulePrint.apply(null, arguments);
};

var real__BinaryenModulePrintAsmjs = asm["_BinaryenModulePrintAsmjs"]; asm["_BinaryenModulePrintAsmjs"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModulePrintAsmjs.apply(null, arguments);
};

var real__BinaryenModuleRead = asm["_BinaryenModuleRead"]; asm["_BinaryenModuleRead"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleRead.apply(null, arguments);
};

var real__BinaryenModuleRunPasses = asm["_BinaryenModuleRunPasses"]; asm["_BinaryenModuleRunPasses"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleRunPasses.apply(null, arguments);
};

var real__BinaryenModuleValidate = asm["_BinaryenModuleValidate"]; asm["_BinaryenModuleValidate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleValidate.apply(null, arguments);
};

var real__BinaryenModuleWrite = asm["_BinaryenModuleWrite"]; asm["_BinaryenModuleWrite"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleWrite.apply(null, arguments);
};

var real__BinaryenModuleWriteWithSourceMap = asm["_BinaryenModuleWriteWithSourceMap"]; asm["_BinaryenModuleWriteWithSourceMap"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenModuleWriteWithSourceMap.apply(null, arguments);
};

var real__BinaryenMulFloat32 = asm["_BinaryenMulFloat32"]; asm["_BinaryenMulFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenMulFloat32.apply(null, arguments);
};

var real__BinaryenMulFloat64 = asm["_BinaryenMulFloat64"]; asm["_BinaryenMulFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenMulFloat64.apply(null, arguments);
};

var real__BinaryenMulInt32 = asm["_BinaryenMulInt32"]; asm["_BinaryenMulInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenMulInt32.apply(null, arguments);
};

var real__BinaryenMulInt64 = asm["_BinaryenMulInt64"]; asm["_BinaryenMulInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenMulInt64.apply(null, arguments);
};

var real__BinaryenNeFloat32 = asm["_BinaryenNeFloat32"]; asm["_BinaryenNeFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenNeFloat32.apply(null, arguments);
};

var real__BinaryenNeFloat64 = asm["_BinaryenNeFloat64"]; asm["_BinaryenNeFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenNeFloat64.apply(null, arguments);
};

var real__BinaryenNeInt32 = asm["_BinaryenNeInt32"]; asm["_BinaryenNeInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenNeInt32.apply(null, arguments);
};

var real__BinaryenNeInt64 = asm["_BinaryenNeInt64"]; asm["_BinaryenNeInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenNeInt64.apply(null, arguments);
};

var real__BinaryenNearestFloat32 = asm["_BinaryenNearestFloat32"]; asm["_BinaryenNearestFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenNearestFloat32.apply(null, arguments);
};

var real__BinaryenNearestFloat64 = asm["_BinaryenNearestFloat64"]; asm["_BinaryenNearestFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenNearestFloat64.apply(null, arguments);
};

var real__BinaryenNegFloat32 = asm["_BinaryenNegFloat32"]; asm["_BinaryenNegFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenNegFloat32.apply(null, arguments);
};

var real__BinaryenNegFloat64 = asm["_BinaryenNegFloat64"]; asm["_BinaryenNegFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenNegFloat64.apply(null, arguments);
};

var real__BinaryenNone = asm["_BinaryenNone"]; asm["_BinaryenNone"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenNone.apply(null, arguments);
};

var real__BinaryenNop = asm["_BinaryenNop"]; asm["_BinaryenNop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenNop.apply(null, arguments);
};

var real__BinaryenNopId = asm["_BinaryenNopId"]; asm["_BinaryenNopId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenNopId.apply(null, arguments);
};

var real__BinaryenOrInt32 = asm["_BinaryenOrInt32"]; asm["_BinaryenOrInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenOrInt32.apply(null, arguments);
};

var real__BinaryenOrInt64 = asm["_BinaryenOrInt64"]; asm["_BinaryenOrInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenOrInt64.apply(null, arguments);
};

var real__BinaryenPageSize = asm["_BinaryenPageSize"]; asm["_BinaryenPageSize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenPageSize.apply(null, arguments);
};

var real__BinaryenPopcntInt32 = asm["_BinaryenPopcntInt32"]; asm["_BinaryenPopcntInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenPopcntInt32.apply(null, arguments);
};

var real__BinaryenPopcntInt64 = asm["_BinaryenPopcntInt64"]; asm["_BinaryenPopcntInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenPopcntInt64.apply(null, arguments);
};

var real__BinaryenPromoteFloat32 = asm["_BinaryenPromoteFloat32"]; asm["_BinaryenPromoteFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenPromoteFloat32.apply(null, arguments);
};

var real__BinaryenReinterpretFloat32 = asm["_BinaryenReinterpretFloat32"]; asm["_BinaryenReinterpretFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenReinterpretFloat32.apply(null, arguments);
};

var real__BinaryenReinterpretFloat64 = asm["_BinaryenReinterpretFloat64"]; asm["_BinaryenReinterpretFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenReinterpretFloat64.apply(null, arguments);
};

var real__BinaryenReinterpretInt32 = asm["_BinaryenReinterpretInt32"]; asm["_BinaryenReinterpretInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenReinterpretInt32.apply(null, arguments);
};

var real__BinaryenReinterpretInt64 = asm["_BinaryenReinterpretInt64"]; asm["_BinaryenReinterpretInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenReinterpretInt64.apply(null, arguments);
};

var real__BinaryenRemSInt32 = asm["_BinaryenRemSInt32"]; asm["_BinaryenRemSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenRemSInt32.apply(null, arguments);
};

var real__BinaryenRemSInt64 = asm["_BinaryenRemSInt64"]; asm["_BinaryenRemSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenRemSInt64.apply(null, arguments);
};

var real__BinaryenRemUInt32 = asm["_BinaryenRemUInt32"]; asm["_BinaryenRemUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenRemUInt32.apply(null, arguments);
};

var real__BinaryenRemUInt64 = asm["_BinaryenRemUInt64"]; asm["_BinaryenRemUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenRemUInt64.apply(null, arguments);
};

var real__BinaryenRemoveExport = asm["_BinaryenRemoveExport"]; asm["_BinaryenRemoveExport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenRemoveExport.apply(null, arguments);
};

var real__BinaryenRemoveFunction = asm["_BinaryenRemoveFunction"]; asm["_BinaryenRemoveFunction"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenRemoveFunction.apply(null, arguments);
};

var real__BinaryenRemoveFunctionType = asm["_BinaryenRemoveFunctionType"]; asm["_BinaryenRemoveFunctionType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenRemoveFunctionType.apply(null, arguments);
};

var real__BinaryenRemoveImport = asm["_BinaryenRemoveImport"]; asm["_BinaryenRemoveImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenRemoveImport.apply(null, arguments);
};

var real__BinaryenReturn = asm["_BinaryenReturn"]; asm["_BinaryenReturn"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenReturn.apply(null, arguments);
};

var real__BinaryenReturnGetValue = asm["_BinaryenReturnGetValue"]; asm["_BinaryenReturnGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenReturnGetValue.apply(null, arguments);
};

var real__BinaryenReturnId = asm["_BinaryenReturnId"]; asm["_BinaryenReturnId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenReturnId.apply(null, arguments);
};

var real__BinaryenRotLInt32 = asm["_BinaryenRotLInt32"]; asm["_BinaryenRotLInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenRotLInt32.apply(null, arguments);
};

var real__BinaryenRotLInt64 = asm["_BinaryenRotLInt64"]; asm["_BinaryenRotLInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenRotLInt64.apply(null, arguments);
};

var real__BinaryenRotRInt32 = asm["_BinaryenRotRInt32"]; asm["_BinaryenRotRInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenRotRInt32.apply(null, arguments);
};

var real__BinaryenRotRInt64 = asm["_BinaryenRotRInt64"]; asm["_BinaryenRotRInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenRotRInt64.apply(null, arguments);
};

var real__BinaryenSelect = asm["_BinaryenSelect"]; asm["_BinaryenSelect"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSelect.apply(null, arguments);
};

var real__BinaryenSelectGetCondition = asm["_BinaryenSelectGetCondition"]; asm["_BinaryenSelectGetCondition"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSelectGetCondition.apply(null, arguments);
};

var real__BinaryenSelectGetIfFalse = asm["_BinaryenSelectGetIfFalse"]; asm["_BinaryenSelectGetIfFalse"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSelectGetIfFalse.apply(null, arguments);
};

var real__BinaryenSelectGetIfTrue = asm["_BinaryenSelectGetIfTrue"]; asm["_BinaryenSelectGetIfTrue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSelectGetIfTrue.apply(null, arguments);
};

var real__BinaryenSelectId = asm["_BinaryenSelectId"]; asm["_BinaryenSelectId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSelectId.apply(null, arguments);
};

var real__BinaryenSetAPITracing = asm["_BinaryenSetAPITracing"]; asm["_BinaryenSetAPITracing"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetAPITracing.apply(null, arguments);
};

var real__BinaryenSetDebugInfo = asm["_BinaryenSetDebugInfo"]; asm["_BinaryenSetDebugInfo"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetDebugInfo.apply(null, arguments);
};

var real__BinaryenSetFunctionTable = asm["_BinaryenSetFunctionTable"]; asm["_BinaryenSetFunctionTable"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetFunctionTable.apply(null, arguments);
};

var real__BinaryenSetGlobal = asm["_BinaryenSetGlobal"]; asm["_BinaryenSetGlobal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetGlobal.apply(null, arguments);
};

var real__BinaryenSetGlobalGetName = asm["_BinaryenSetGlobalGetName"]; asm["_BinaryenSetGlobalGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetGlobalGetName.apply(null, arguments);
};

var real__BinaryenSetGlobalGetValue = asm["_BinaryenSetGlobalGetValue"]; asm["_BinaryenSetGlobalGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetGlobalGetValue.apply(null, arguments);
};

var real__BinaryenSetGlobalId = asm["_BinaryenSetGlobalId"]; asm["_BinaryenSetGlobalId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetGlobalId.apply(null, arguments);
};

var real__BinaryenSetLocal = asm["_BinaryenSetLocal"]; asm["_BinaryenSetLocal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetLocal.apply(null, arguments);
};

var real__BinaryenSetLocalGetIndex = asm["_BinaryenSetLocalGetIndex"]; asm["_BinaryenSetLocalGetIndex"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetLocalGetIndex.apply(null, arguments);
};

var real__BinaryenSetLocalGetValue = asm["_BinaryenSetLocalGetValue"]; asm["_BinaryenSetLocalGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetLocalGetValue.apply(null, arguments);
};

var real__BinaryenSetLocalId = asm["_BinaryenSetLocalId"]; asm["_BinaryenSetLocalId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetLocalId.apply(null, arguments);
};

var real__BinaryenSetLocalIsTee = asm["_BinaryenSetLocalIsTee"]; asm["_BinaryenSetLocalIsTee"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetLocalIsTee.apply(null, arguments);
};

var real__BinaryenSetMemory = asm["_BinaryenSetMemory"]; asm["_BinaryenSetMemory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetMemory.apply(null, arguments);
};

var real__BinaryenSetOptimizeLevel = asm["_BinaryenSetOptimizeLevel"]; asm["_BinaryenSetOptimizeLevel"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetOptimizeLevel.apply(null, arguments);
};

var real__BinaryenSetShrinkLevel = asm["_BinaryenSetShrinkLevel"]; asm["_BinaryenSetShrinkLevel"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetShrinkLevel.apply(null, arguments);
};

var real__BinaryenSetStart = asm["_BinaryenSetStart"]; asm["_BinaryenSetStart"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSetStart.apply(null, arguments);
};

var real__BinaryenShlInt32 = asm["_BinaryenShlInt32"]; asm["_BinaryenShlInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenShlInt32.apply(null, arguments);
};

var real__BinaryenShlInt64 = asm["_BinaryenShlInt64"]; asm["_BinaryenShlInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenShlInt64.apply(null, arguments);
};

var real__BinaryenShrSInt32 = asm["_BinaryenShrSInt32"]; asm["_BinaryenShrSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenShrSInt32.apply(null, arguments);
};

var real__BinaryenShrSInt64 = asm["_BinaryenShrSInt64"]; asm["_BinaryenShrSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenShrSInt64.apply(null, arguments);
};

var real__BinaryenShrUInt32 = asm["_BinaryenShrUInt32"]; asm["_BinaryenShrUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenShrUInt32.apply(null, arguments);
};

var real__BinaryenShrUInt64 = asm["_BinaryenShrUInt64"]; asm["_BinaryenShrUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenShrUInt64.apply(null, arguments);
};

var real__BinaryenSqrtFloat32 = asm["_BinaryenSqrtFloat32"]; asm["_BinaryenSqrtFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSqrtFloat32.apply(null, arguments);
};

var real__BinaryenSqrtFloat64 = asm["_BinaryenSqrtFloat64"]; asm["_BinaryenSqrtFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSqrtFloat64.apply(null, arguments);
};

var real__BinaryenStore = asm["_BinaryenStore"]; asm["_BinaryenStore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenStore.apply(null, arguments);
};

var real__BinaryenStoreGetAlign = asm["_BinaryenStoreGetAlign"]; asm["_BinaryenStoreGetAlign"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenStoreGetAlign.apply(null, arguments);
};

var real__BinaryenStoreGetBytes = asm["_BinaryenStoreGetBytes"]; asm["_BinaryenStoreGetBytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenStoreGetBytes.apply(null, arguments);
};

var real__BinaryenStoreGetOffset = asm["_BinaryenStoreGetOffset"]; asm["_BinaryenStoreGetOffset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenStoreGetOffset.apply(null, arguments);
};

var real__BinaryenStoreGetPtr = asm["_BinaryenStoreGetPtr"]; asm["_BinaryenStoreGetPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenStoreGetPtr.apply(null, arguments);
};

var real__BinaryenStoreGetValue = asm["_BinaryenStoreGetValue"]; asm["_BinaryenStoreGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenStoreGetValue.apply(null, arguments);
};

var real__BinaryenStoreId = asm["_BinaryenStoreId"]; asm["_BinaryenStoreId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenStoreId.apply(null, arguments);
};

var real__BinaryenStoreIsAtomic = asm["_BinaryenStoreIsAtomic"]; asm["_BinaryenStoreIsAtomic"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenStoreIsAtomic.apply(null, arguments);
};

var real__BinaryenSubFloat32 = asm["_BinaryenSubFloat32"]; asm["_BinaryenSubFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSubFloat32.apply(null, arguments);
};

var real__BinaryenSubFloat64 = asm["_BinaryenSubFloat64"]; asm["_BinaryenSubFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSubFloat64.apply(null, arguments);
};

var real__BinaryenSubInt32 = asm["_BinaryenSubInt32"]; asm["_BinaryenSubInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSubInt32.apply(null, arguments);
};

var real__BinaryenSubInt64 = asm["_BinaryenSubInt64"]; asm["_BinaryenSubInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSubInt64.apply(null, arguments);
};

var real__BinaryenSwitch = asm["_BinaryenSwitch"]; asm["_BinaryenSwitch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSwitch.apply(null, arguments);
};

var real__BinaryenSwitchGetCondition = asm["_BinaryenSwitchGetCondition"]; asm["_BinaryenSwitchGetCondition"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSwitchGetCondition.apply(null, arguments);
};

var real__BinaryenSwitchGetDefaultName = asm["_BinaryenSwitchGetDefaultName"]; asm["_BinaryenSwitchGetDefaultName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSwitchGetDefaultName.apply(null, arguments);
};

var real__BinaryenSwitchGetName = asm["_BinaryenSwitchGetName"]; asm["_BinaryenSwitchGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSwitchGetName.apply(null, arguments);
};

var real__BinaryenSwitchGetNumNames = asm["_BinaryenSwitchGetNumNames"]; asm["_BinaryenSwitchGetNumNames"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSwitchGetNumNames.apply(null, arguments);
};

var real__BinaryenSwitchGetValue = asm["_BinaryenSwitchGetValue"]; asm["_BinaryenSwitchGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSwitchGetValue.apply(null, arguments);
};

var real__BinaryenSwitchId = asm["_BinaryenSwitchId"]; asm["_BinaryenSwitchId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenSwitchId.apply(null, arguments);
};

var real__BinaryenTeeLocal = asm["_BinaryenTeeLocal"]; asm["_BinaryenTeeLocal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTeeLocal.apply(null, arguments);
};

var real__BinaryenTruncFloat32 = asm["_BinaryenTruncFloat32"]; asm["_BinaryenTruncFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTruncFloat32.apply(null, arguments);
};

var real__BinaryenTruncFloat64 = asm["_BinaryenTruncFloat64"]; asm["_BinaryenTruncFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTruncFloat64.apply(null, arguments);
};

var real__BinaryenTruncSFloat32ToInt32 = asm["_BinaryenTruncSFloat32ToInt32"]; asm["_BinaryenTruncSFloat32ToInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTruncSFloat32ToInt32.apply(null, arguments);
};

var real__BinaryenTruncSFloat32ToInt64 = asm["_BinaryenTruncSFloat32ToInt64"]; asm["_BinaryenTruncSFloat32ToInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTruncSFloat32ToInt64.apply(null, arguments);
};

var real__BinaryenTruncSFloat64ToInt32 = asm["_BinaryenTruncSFloat64ToInt32"]; asm["_BinaryenTruncSFloat64ToInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTruncSFloat64ToInt32.apply(null, arguments);
};

var real__BinaryenTruncSFloat64ToInt64 = asm["_BinaryenTruncSFloat64ToInt64"]; asm["_BinaryenTruncSFloat64ToInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTruncSFloat64ToInt64.apply(null, arguments);
};

var real__BinaryenTruncUFloat32ToInt32 = asm["_BinaryenTruncUFloat32ToInt32"]; asm["_BinaryenTruncUFloat32ToInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTruncUFloat32ToInt32.apply(null, arguments);
};

var real__BinaryenTruncUFloat32ToInt64 = asm["_BinaryenTruncUFloat32ToInt64"]; asm["_BinaryenTruncUFloat32ToInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTruncUFloat32ToInt64.apply(null, arguments);
};

var real__BinaryenTruncUFloat64ToInt32 = asm["_BinaryenTruncUFloat64ToInt32"]; asm["_BinaryenTruncUFloat64ToInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTruncUFloat64ToInt32.apply(null, arguments);
};

var real__BinaryenTruncUFloat64ToInt64 = asm["_BinaryenTruncUFloat64ToInt64"]; asm["_BinaryenTruncUFloat64ToInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTruncUFloat64ToInt64.apply(null, arguments);
};

var real__BinaryenTypeAuto = asm["_BinaryenTypeAuto"]; asm["_BinaryenTypeAuto"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTypeAuto.apply(null, arguments);
};

var real__BinaryenTypeFloat32 = asm["_BinaryenTypeFloat32"]; asm["_BinaryenTypeFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTypeFloat32.apply(null, arguments);
};

var real__BinaryenTypeFloat64 = asm["_BinaryenTypeFloat64"]; asm["_BinaryenTypeFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTypeFloat64.apply(null, arguments);
};

var real__BinaryenTypeInt32 = asm["_BinaryenTypeInt32"]; asm["_BinaryenTypeInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTypeInt32.apply(null, arguments);
};

var real__BinaryenTypeInt64 = asm["_BinaryenTypeInt64"]; asm["_BinaryenTypeInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTypeInt64.apply(null, arguments);
};

var real__BinaryenTypeNone = asm["_BinaryenTypeNone"]; asm["_BinaryenTypeNone"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTypeNone.apply(null, arguments);
};

var real__BinaryenTypeUnreachable = asm["_BinaryenTypeUnreachable"]; asm["_BinaryenTypeUnreachable"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenTypeUnreachable.apply(null, arguments);
};

var real__BinaryenUnary = asm["_BinaryenUnary"]; asm["_BinaryenUnary"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenUnary.apply(null, arguments);
};

var real__BinaryenUnaryGetOp = asm["_BinaryenUnaryGetOp"]; asm["_BinaryenUnaryGetOp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenUnaryGetOp.apply(null, arguments);
};

var real__BinaryenUnaryGetValue = asm["_BinaryenUnaryGetValue"]; asm["_BinaryenUnaryGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenUnaryGetValue.apply(null, arguments);
};

var real__BinaryenUnaryId = asm["_BinaryenUnaryId"]; asm["_BinaryenUnaryId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenUnaryId.apply(null, arguments);
};

var real__BinaryenUndefined = asm["_BinaryenUndefined"]; asm["_BinaryenUndefined"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenUndefined.apply(null, arguments);
};

var real__BinaryenUnreachable = asm["_BinaryenUnreachable"]; asm["_BinaryenUnreachable"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenUnreachable.apply(null, arguments);
};

var real__BinaryenUnreachableId = asm["_BinaryenUnreachableId"]; asm["_BinaryenUnreachableId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenUnreachableId.apply(null, arguments);
};

var real__BinaryenWrapInt64 = asm["_BinaryenWrapInt64"]; asm["_BinaryenWrapInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenWrapInt64.apply(null, arguments);
};

var real__BinaryenXorInt32 = asm["_BinaryenXorInt32"]; asm["_BinaryenXorInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenXorInt32.apply(null, arguments);
};

var real__BinaryenXorInt64 = asm["_BinaryenXorInt64"]; asm["_BinaryenXorInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__BinaryenXorInt64.apply(null, arguments);
};

var real___GLOBAL__I_000101 = asm["__GLOBAL__I_000101"]; asm["__GLOBAL__I_000101"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__I_000101.apply(null, arguments);
};

var real___GLOBAL__sub_I_InstrumentLocals_cpp = asm["__GLOBAL__sub_I_InstrumentLocals_cpp"]; asm["__GLOBAL__sub_I_InstrumentLocals_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_InstrumentLocals_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_InstrumentMemory_cpp = asm["__GLOBAL__sub_I_InstrumentMemory_cpp"]; asm["__GLOBAL__sub_I_InstrumentMemory_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_InstrumentMemory_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_LegalizeJSInterface_cpp = asm["__GLOBAL__sub_I_LegalizeJSInterface_cpp"]; asm["__GLOBAL__sub_I_LegalizeJSInterface_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_LegalizeJSInterface_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_LogExecution_cpp = asm["__GLOBAL__sub_I_LogExecution_cpp"]; asm["__GLOBAL__sub_I_LogExecution_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_LogExecution_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_Metrics_cpp = asm["__GLOBAL__sub_I_Metrics_cpp"]; asm["__GLOBAL__sub_I_Metrics_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_Metrics_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_OptimizeInstructions_cpp = asm["__GLOBAL__sub_I_OptimizeInstructions_cpp"]; asm["__GLOBAL__sub_I_OptimizeInstructions_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_OptimizeInstructions_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_Precompute_cpp = asm["__GLOBAL__sub_I_Precompute_cpp"]; asm["__GLOBAL__sub_I_Precompute_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_Precompute_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_RelooperJumpThreading_cpp = asm["__GLOBAL__sub_I_RelooperJumpThreading_cpp"]; asm["__GLOBAL__sub_I_RelooperJumpThreading_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_RelooperJumpThreading_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_SSAify_cpp = asm["__GLOBAL__sub_I_SSAify_cpp"]; asm["__GLOBAL__sub_I_SSAify_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_SSAify_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_SafeHeap_cpp = asm["__GLOBAL__sub_I_SafeHeap_cpp"]; asm["__GLOBAL__sub_I_SafeHeap_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_SafeHeap_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_TrapMode_cpp = asm["__GLOBAL__sub_I_TrapMode_cpp"]; asm["__GLOBAL__sub_I_TrapMode_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_TrapMode_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_binaryen_c_cpp = asm["__GLOBAL__sub_I_binaryen_c_cpp"]; asm["__GLOBAL__sub_I_binaryen_c_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_binaryen_c_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_iostream_cpp = asm["__GLOBAL__sub_I_iostream_cpp"]; asm["__GLOBAL__sub_I_iostream_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_iostream_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_optimizer_shared_cpp = asm["__GLOBAL__sub_I_optimizer_shared_cpp"]; asm["__GLOBAL__sub_I_optimizer_shared_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_optimizer_shared_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_parser_cpp = asm["__GLOBAL__sub_I_parser_cpp"]; asm["__GLOBAL__sub_I_parser_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_parser_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_pass_cpp = asm["__GLOBAL__sub_I_pass_cpp"]; asm["__GLOBAL__sub_I_pass_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_pass_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_shared_constants_cpp = asm["__GLOBAL__sub_I_shared_constants_cpp"]; asm["__GLOBAL__sub_I_shared_constants_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_shared_constants_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_simple_ast_cpp = asm["__GLOBAL__sub_I_simple_ast_cpp"]; asm["__GLOBAL__sub_I_simple_ast_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_simple_ast_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_threads_cpp = asm["__GLOBAL__sub_I_threads_cpp"]; asm["__GLOBAL__sub_I_threads_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_threads_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_wasm_cpp = asm["__GLOBAL__sub_I_wasm_cpp"]; asm["__GLOBAL__sub_I_wasm_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_wasm_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_wasm_emscripten_cpp = asm["__GLOBAL__sub_I_wasm_emscripten_cpp"]; asm["__GLOBAL__sub_I_wasm_emscripten_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_wasm_emscripten_cpp.apply(null, arguments);
};

var real___ZSt18uncaught_exceptionv = asm["__ZSt18uncaught_exceptionv"]; asm["__ZSt18uncaught_exceptionv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___ZSt18uncaught_exceptionv.apply(null, arguments);
};

var real____cxa_can_catch = asm["___cxa_can_catch"]; asm["___cxa_can_catch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____cxa_can_catch.apply(null, arguments);
};

var real____cxa_demangle = asm["___cxa_demangle"]; asm["___cxa_demangle"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____cxa_demangle.apply(null, arguments);
};

var real____cxa_is_pointer_type = asm["___cxa_is_pointer_type"]; asm["___cxa_is_pointer_type"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____cxa_is_pointer_type.apply(null, arguments);
};

var real____emscripten_environ_constructor = asm["___emscripten_environ_constructor"]; asm["___emscripten_environ_constructor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____emscripten_environ_constructor.apply(null, arguments);
};

var real___get_environ = asm["__get_environ"]; asm["__get_environ"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___get_environ.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real__llvm_bswap_i32 = asm["_llvm_bswap_i32"]; asm["_llvm_bswap_i32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__llvm_bswap_i32.apply(null, arguments);
};

var real__llvm_nearbyint_f32 = asm["_llvm_nearbyint_f32"]; asm["_llvm_nearbyint_f32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__llvm_nearbyint_f32.apply(null, arguments);
};

var real__llvm_nearbyint_f64 = asm["_llvm_nearbyint_f64"]; asm["_llvm_nearbyint_f64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__llvm_nearbyint_f64.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__memmove = asm["_memmove"]; asm["_memmove"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__memmove.apply(null, arguments);
};

var real__pthread_cond_broadcast = asm["_pthread_cond_broadcast"]; asm["_pthread_cond_broadcast"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pthread_cond_broadcast.apply(null, arguments);
};

var real__pthread_mutex_lock = asm["_pthread_mutex_lock"]; asm["_pthread_mutex_lock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pthread_mutex_lock.apply(null, arguments);
};

var real__pthread_mutex_unlock = asm["_pthread_mutex_unlock"]; asm["_pthread_mutex_unlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__pthread_mutex_unlock.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_getTempRet0.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setTempRet0.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setThrew.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};
Module["asm"] = asm;
var _BinaryenAbsFloat32 = Module["_BinaryenAbsFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAbsFloat32"].apply(null, arguments) };
var _BinaryenAbsFloat64 = Module["_BinaryenAbsFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAbsFloat64"].apply(null, arguments) };
var _BinaryenAddExport = Module["_BinaryenAddExport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddExport"].apply(null, arguments) };
var _BinaryenAddFloat32 = Module["_BinaryenAddFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddFloat32"].apply(null, arguments) };
var _BinaryenAddFloat64 = Module["_BinaryenAddFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddFloat64"].apply(null, arguments) };
var _BinaryenAddFunction = Module["_BinaryenAddFunction"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddFunction"].apply(null, arguments) };
var _BinaryenAddFunctionExport = Module["_BinaryenAddFunctionExport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddFunctionExport"].apply(null, arguments) };
var _BinaryenAddFunctionImport = Module["_BinaryenAddFunctionImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddFunctionImport"].apply(null, arguments) };
var _BinaryenAddFunctionType = Module["_BinaryenAddFunctionType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddFunctionType"].apply(null, arguments) };
var _BinaryenAddGlobal = Module["_BinaryenAddGlobal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddGlobal"].apply(null, arguments) };
var _BinaryenAddGlobalExport = Module["_BinaryenAddGlobalExport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddGlobalExport"].apply(null, arguments) };
var _BinaryenAddGlobalImport = Module["_BinaryenAddGlobalImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddGlobalImport"].apply(null, arguments) };
var _BinaryenAddImport = Module["_BinaryenAddImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddImport"].apply(null, arguments) };
var _BinaryenAddInt32 = Module["_BinaryenAddInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddInt32"].apply(null, arguments) };
var _BinaryenAddInt64 = Module["_BinaryenAddInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddInt64"].apply(null, arguments) };
var _BinaryenAddMemoryExport = Module["_BinaryenAddMemoryExport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddMemoryExport"].apply(null, arguments) };
var _BinaryenAddMemoryImport = Module["_BinaryenAddMemoryImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddMemoryImport"].apply(null, arguments) };
var _BinaryenAddTableExport = Module["_BinaryenAddTableExport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddTableExport"].apply(null, arguments) };
var _BinaryenAddTableImport = Module["_BinaryenAddTableImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAddTableImport"].apply(null, arguments) };
var _BinaryenAndInt32 = Module["_BinaryenAndInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAndInt32"].apply(null, arguments) };
var _BinaryenAndInt64 = Module["_BinaryenAndInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAndInt64"].apply(null, arguments) };
var _BinaryenAtomicCmpxchg = Module["_BinaryenAtomicCmpxchg"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicCmpxchg"].apply(null, arguments) };
var _BinaryenAtomicCmpxchgGetBytes = Module["_BinaryenAtomicCmpxchgGetBytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicCmpxchgGetBytes"].apply(null, arguments) };
var _BinaryenAtomicCmpxchgGetExpected = Module["_BinaryenAtomicCmpxchgGetExpected"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicCmpxchgGetExpected"].apply(null, arguments) };
var _BinaryenAtomicCmpxchgGetOffset = Module["_BinaryenAtomicCmpxchgGetOffset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicCmpxchgGetOffset"].apply(null, arguments) };
var _BinaryenAtomicCmpxchgGetPtr = Module["_BinaryenAtomicCmpxchgGetPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicCmpxchgGetPtr"].apply(null, arguments) };
var _BinaryenAtomicCmpxchgGetReplacement = Module["_BinaryenAtomicCmpxchgGetReplacement"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicCmpxchgGetReplacement"].apply(null, arguments) };
var _BinaryenAtomicCmpxchgId = Module["_BinaryenAtomicCmpxchgId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicCmpxchgId"].apply(null, arguments) };
var _BinaryenAtomicLoad = Module["_BinaryenAtomicLoad"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicLoad"].apply(null, arguments) };
var _BinaryenAtomicRMW = Module["_BinaryenAtomicRMW"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMW"].apply(null, arguments) };
var _BinaryenAtomicRMWAdd = Module["_BinaryenAtomicRMWAdd"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMWAdd"].apply(null, arguments) };
var _BinaryenAtomicRMWAnd = Module["_BinaryenAtomicRMWAnd"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMWAnd"].apply(null, arguments) };
var _BinaryenAtomicRMWGetBytes = Module["_BinaryenAtomicRMWGetBytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMWGetBytes"].apply(null, arguments) };
var _BinaryenAtomicRMWGetOffset = Module["_BinaryenAtomicRMWGetOffset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMWGetOffset"].apply(null, arguments) };
var _BinaryenAtomicRMWGetOp = Module["_BinaryenAtomicRMWGetOp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMWGetOp"].apply(null, arguments) };
var _BinaryenAtomicRMWGetPtr = Module["_BinaryenAtomicRMWGetPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMWGetPtr"].apply(null, arguments) };
var _BinaryenAtomicRMWGetValue = Module["_BinaryenAtomicRMWGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMWGetValue"].apply(null, arguments) };
var _BinaryenAtomicRMWId = Module["_BinaryenAtomicRMWId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMWId"].apply(null, arguments) };
var _BinaryenAtomicRMWOr = Module["_BinaryenAtomicRMWOr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMWOr"].apply(null, arguments) };
var _BinaryenAtomicRMWSub = Module["_BinaryenAtomicRMWSub"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMWSub"].apply(null, arguments) };
var _BinaryenAtomicRMWXchg = Module["_BinaryenAtomicRMWXchg"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMWXchg"].apply(null, arguments) };
var _BinaryenAtomicRMWXor = Module["_BinaryenAtomicRMWXor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicRMWXor"].apply(null, arguments) };
var _BinaryenAtomicStore = Module["_BinaryenAtomicStore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicStore"].apply(null, arguments) };
var _BinaryenAtomicWait = Module["_BinaryenAtomicWait"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicWait"].apply(null, arguments) };
var _BinaryenAtomicWaitGetExpected = Module["_BinaryenAtomicWaitGetExpected"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicWaitGetExpected"].apply(null, arguments) };
var _BinaryenAtomicWaitGetExpectedType = Module["_BinaryenAtomicWaitGetExpectedType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicWaitGetExpectedType"].apply(null, arguments) };
var _BinaryenAtomicWaitGetPtr = Module["_BinaryenAtomicWaitGetPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicWaitGetPtr"].apply(null, arguments) };
var _BinaryenAtomicWaitGetTimeout = Module["_BinaryenAtomicWaitGetTimeout"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicWaitGetTimeout"].apply(null, arguments) };
var _BinaryenAtomicWaitId = Module["_BinaryenAtomicWaitId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicWaitId"].apply(null, arguments) };
var _BinaryenAtomicWake = Module["_BinaryenAtomicWake"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicWake"].apply(null, arguments) };
var _BinaryenAtomicWakeGetPtr = Module["_BinaryenAtomicWakeGetPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicWakeGetPtr"].apply(null, arguments) };
var _BinaryenAtomicWakeGetWakeCount = Module["_BinaryenAtomicWakeGetWakeCount"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicWakeGetWakeCount"].apply(null, arguments) };
var _BinaryenAtomicWakeId = Module["_BinaryenAtomicWakeId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenAtomicWakeId"].apply(null, arguments) };
var _BinaryenBinary = Module["_BinaryenBinary"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBinary"].apply(null, arguments) };
var _BinaryenBinaryGetLeft = Module["_BinaryenBinaryGetLeft"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBinaryGetLeft"].apply(null, arguments) };
var _BinaryenBinaryGetOp = Module["_BinaryenBinaryGetOp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBinaryGetOp"].apply(null, arguments) };
var _BinaryenBinaryGetRight = Module["_BinaryenBinaryGetRight"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBinaryGetRight"].apply(null, arguments) };
var _BinaryenBinaryId = Module["_BinaryenBinaryId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBinaryId"].apply(null, arguments) };
var _BinaryenBlock = Module["_BinaryenBlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBlock"].apply(null, arguments) };
var _BinaryenBlockGetChild = Module["_BinaryenBlockGetChild"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBlockGetChild"].apply(null, arguments) };
var _BinaryenBlockGetName = Module["_BinaryenBlockGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBlockGetName"].apply(null, arguments) };
var _BinaryenBlockGetNumChildren = Module["_BinaryenBlockGetNumChildren"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBlockGetNumChildren"].apply(null, arguments) };
var _BinaryenBlockId = Module["_BinaryenBlockId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBlockId"].apply(null, arguments) };
var _BinaryenBreak = Module["_BinaryenBreak"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBreak"].apply(null, arguments) };
var _BinaryenBreakGetCondition = Module["_BinaryenBreakGetCondition"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBreakGetCondition"].apply(null, arguments) };
var _BinaryenBreakGetName = Module["_BinaryenBreakGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBreakGetName"].apply(null, arguments) };
var _BinaryenBreakGetValue = Module["_BinaryenBreakGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBreakGetValue"].apply(null, arguments) };
var _BinaryenBreakId = Module["_BinaryenBreakId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenBreakId"].apply(null, arguments) };
var _BinaryenCall = Module["_BinaryenCall"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCall"].apply(null, arguments) };
var _BinaryenCallGetNumOperands = Module["_BinaryenCallGetNumOperands"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallGetNumOperands"].apply(null, arguments) };
var _BinaryenCallGetOperand = Module["_BinaryenCallGetOperand"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallGetOperand"].apply(null, arguments) };
var _BinaryenCallGetTarget = Module["_BinaryenCallGetTarget"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallGetTarget"].apply(null, arguments) };
var _BinaryenCallId = Module["_BinaryenCallId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallId"].apply(null, arguments) };
var _BinaryenCallImport = Module["_BinaryenCallImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallImport"].apply(null, arguments) };
var _BinaryenCallImportGetNumOperands = Module["_BinaryenCallImportGetNumOperands"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallImportGetNumOperands"].apply(null, arguments) };
var _BinaryenCallImportGetOperand = Module["_BinaryenCallImportGetOperand"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallImportGetOperand"].apply(null, arguments) };
var _BinaryenCallImportGetTarget = Module["_BinaryenCallImportGetTarget"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallImportGetTarget"].apply(null, arguments) };
var _BinaryenCallImportId = Module["_BinaryenCallImportId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallImportId"].apply(null, arguments) };
var _BinaryenCallIndirect = Module["_BinaryenCallIndirect"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallIndirect"].apply(null, arguments) };
var _BinaryenCallIndirectGetNumOperands = Module["_BinaryenCallIndirectGetNumOperands"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallIndirectGetNumOperands"].apply(null, arguments) };
var _BinaryenCallIndirectGetOperand = Module["_BinaryenCallIndirectGetOperand"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallIndirectGetOperand"].apply(null, arguments) };
var _BinaryenCallIndirectGetTarget = Module["_BinaryenCallIndirectGetTarget"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallIndirectGetTarget"].apply(null, arguments) };
var _BinaryenCallIndirectId = Module["_BinaryenCallIndirectId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCallIndirectId"].apply(null, arguments) };
var _BinaryenCeilFloat32 = Module["_BinaryenCeilFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCeilFloat32"].apply(null, arguments) };
var _BinaryenCeilFloat64 = Module["_BinaryenCeilFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCeilFloat64"].apply(null, arguments) };
var _BinaryenClzInt32 = Module["_BinaryenClzInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenClzInt32"].apply(null, arguments) };
var _BinaryenClzInt64 = Module["_BinaryenClzInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenClzInt64"].apply(null, arguments) };
var _BinaryenConst = Module["_BinaryenConst"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConst"].apply(null, arguments) };
var _BinaryenConstGetValueF32 = Module["_BinaryenConstGetValueF32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConstGetValueF32"].apply(null, arguments) };
var _BinaryenConstGetValueF64 = Module["_BinaryenConstGetValueF64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConstGetValueF64"].apply(null, arguments) };
var _BinaryenConstGetValueI32 = Module["_BinaryenConstGetValueI32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConstGetValueI32"].apply(null, arguments) };
var _BinaryenConstGetValueI64 = Module["_BinaryenConstGetValueI64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConstGetValueI64"].apply(null, arguments) };
var _BinaryenConstGetValueI64High = Module["_BinaryenConstGetValueI64High"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConstGetValueI64High"].apply(null, arguments) };
var _BinaryenConstGetValueI64Low = Module["_BinaryenConstGetValueI64Low"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConstGetValueI64Low"].apply(null, arguments) };
var _BinaryenConstId = Module["_BinaryenConstId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConstId"].apply(null, arguments) };
var _BinaryenConvertSInt32ToFloat32 = Module["_BinaryenConvertSInt32ToFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConvertSInt32ToFloat32"].apply(null, arguments) };
var _BinaryenConvertSInt32ToFloat64 = Module["_BinaryenConvertSInt32ToFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConvertSInt32ToFloat64"].apply(null, arguments) };
var _BinaryenConvertSInt64ToFloat32 = Module["_BinaryenConvertSInt64ToFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConvertSInt64ToFloat32"].apply(null, arguments) };
var _BinaryenConvertSInt64ToFloat64 = Module["_BinaryenConvertSInt64ToFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConvertSInt64ToFloat64"].apply(null, arguments) };
var _BinaryenConvertUInt32ToFloat32 = Module["_BinaryenConvertUInt32ToFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConvertUInt32ToFloat32"].apply(null, arguments) };
var _BinaryenConvertUInt32ToFloat64 = Module["_BinaryenConvertUInt32ToFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConvertUInt32ToFloat64"].apply(null, arguments) };
var _BinaryenConvertUInt64ToFloat32 = Module["_BinaryenConvertUInt64ToFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConvertUInt64ToFloat32"].apply(null, arguments) };
var _BinaryenConvertUInt64ToFloat64 = Module["_BinaryenConvertUInt64ToFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenConvertUInt64ToFloat64"].apply(null, arguments) };
var _BinaryenCopySignFloat32 = Module["_BinaryenCopySignFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCopySignFloat32"].apply(null, arguments) };
var _BinaryenCopySignFloat64 = Module["_BinaryenCopySignFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCopySignFloat64"].apply(null, arguments) };
var _BinaryenCtzInt32 = Module["_BinaryenCtzInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCtzInt32"].apply(null, arguments) };
var _BinaryenCtzInt64 = Module["_BinaryenCtzInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCtzInt64"].apply(null, arguments) };
var _BinaryenCurrentMemory = Module["_BinaryenCurrentMemory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenCurrentMemory"].apply(null, arguments) };
var _BinaryenDemoteFloat64 = Module["_BinaryenDemoteFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenDemoteFloat64"].apply(null, arguments) };
var _BinaryenDivFloat32 = Module["_BinaryenDivFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenDivFloat32"].apply(null, arguments) };
var _BinaryenDivFloat64 = Module["_BinaryenDivFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenDivFloat64"].apply(null, arguments) };
var _BinaryenDivSInt32 = Module["_BinaryenDivSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenDivSInt32"].apply(null, arguments) };
var _BinaryenDivSInt64 = Module["_BinaryenDivSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenDivSInt64"].apply(null, arguments) };
var _BinaryenDivUInt32 = Module["_BinaryenDivUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenDivUInt32"].apply(null, arguments) };
var _BinaryenDivUInt64 = Module["_BinaryenDivUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenDivUInt64"].apply(null, arguments) };
var _BinaryenDrop = Module["_BinaryenDrop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenDrop"].apply(null, arguments) };
var _BinaryenDropGetValue = Module["_BinaryenDropGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenDropGetValue"].apply(null, arguments) };
var _BinaryenDropId = Module["_BinaryenDropId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenDropId"].apply(null, arguments) };
var _BinaryenEqFloat32 = Module["_BinaryenEqFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenEqFloat32"].apply(null, arguments) };
var _BinaryenEqFloat64 = Module["_BinaryenEqFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenEqFloat64"].apply(null, arguments) };
var _BinaryenEqInt32 = Module["_BinaryenEqInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenEqInt32"].apply(null, arguments) };
var _BinaryenEqInt64 = Module["_BinaryenEqInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenEqInt64"].apply(null, arguments) };
var _BinaryenEqZInt32 = Module["_BinaryenEqZInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenEqZInt32"].apply(null, arguments) };
var _BinaryenEqZInt64 = Module["_BinaryenEqZInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenEqZInt64"].apply(null, arguments) };
var _BinaryenExportGetKind = Module["_BinaryenExportGetKind"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExportGetKind"].apply(null, arguments) };
var _BinaryenExportGetName = Module["_BinaryenExportGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExportGetName"].apply(null, arguments) };
var _BinaryenExportGetValue = Module["_BinaryenExportGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExportGetValue"].apply(null, arguments) };
var _BinaryenExpressionGetId = Module["_BinaryenExpressionGetId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExpressionGetId"].apply(null, arguments) };
var _BinaryenExpressionGetType = Module["_BinaryenExpressionGetType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExpressionGetType"].apply(null, arguments) };
var _BinaryenExpressionPrint = Module["_BinaryenExpressionPrint"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExpressionPrint"].apply(null, arguments) };
var _BinaryenExtendS16Int32 = Module["_BinaryenExtendS16Int32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExtendS16Int32"].apply(null, arguments) };
var _BinaryenExtendS16Int64 = Module["_BinaryenExtendS16Int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExtendS16Int64"].apply(null, arguments) };
var _BinaryenExtendS32Int64 = Module["_BinaryenExtendS32Int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExtendS32Int64"].apply(null, arguments) };
var _BinaryenExtendS8Int32 = Module["_BinaryenExtendS8Int32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExtendS8Int32"].apply(null, arguments) };
var _BinaryenExtendS8Int64 = Module["_BinaryenExtendS8Int64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExtendS8Int64"].apply(null, arguments) };
var _BinaryenExtendSInt32 = Module["_BinaryenExtendSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExtendSInt32"].apply(null, arguments) };
var _BinaryenExtendUInt32 = Module["_BinaryenExtendUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExtendUInt32"].apply(null, arguments) };
var _BinaryenExternalFunction = Module["_BinaryenExternalFunction"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExternalFunction"].apply(null, arguments) };
var _BinaryenExternalGlobal = Module["_BinaryenExternalGlobal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExternalGlobal"].apply(null, arguments) };
var _BinaryenExternalMemory = Module["_BinaryenExternalMemory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExternalMemory"].apply(null, arguments) };
var _BinaryenExternalTable = Module["_BinaryenExternalTable"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenExternalTable"].apply(null, arguments) };
var _BinaryenFloat32 = Module["_BinaryenFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFloat32"].apply(null, arguments) };
var _BinaryenFloat64 = Module["_BinaryenFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFloat64"].apply(null, arguments) };
var _BinaryenFloorFloat32 = Module["_BinaryenFloorFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFloorFloat32"].apply(null, arguments) };
var _BinaryenFloorFloat64 = Module["_BinaryenFloorFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFloorFloat64"].apply(null, arguments) };
var _BinaryenFunctionGetBody = Module["_BinaryenFunctionGetBody"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionGetBody"].apply(null, arguments) };
var _BinaryenFunctionGetName = Module["_BinaryenFunctionGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionGetName"].apply(null, arguments) };
var _BinaryenFunctionGetNumParams = Module["_BinaryenFunctionGetNumParams"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionGetNumParams"].apply(null, arguments) };
var _BinaryenFunctionGetNumVars = Module["_BinaryenFunctionGetNumVars"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionGetNumVars"].apply(null, arguments) };
var _BinaryenFunctionGetParam = Module["_BinaryenFunctionGetParam"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionGetParam"].apply(null, arguments) };
var _BinaryenFunctionGetResult = Module["_BinaryenFunctionGetResult"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionGetResult"].apply(null, arguments) };
var _BinaryenFunctionGetType = Module["_BinaryenFunctionGetType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionGetType"].apply(null, arguments) };
var _BinaryenFunctionGetVar = Module["_BinaryenFunctionGetVar"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionGetVar"].apply(null, arguments) };
var _BinaryenFunctionOptimize = Module["_BinaryenFunctionOptimize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionOptimize"].apply(null, arguments) };
var _BinaryenFunctionRunPasses = Module["_BinaryenFunctionRunPasses"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionRunPasses"].apply(null, arguments) };
var _BinaryenFunctionSetDebugLocation = Module["_BinaryenFunctionSetDebugLocation"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionSetDebugLocation"].apply(null, arguments) };
var _BinaryenFunctionTypeGetName = Module["_BinaryenFunctionTypeGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionTypeGetName"].apply(null, arguments) };
var _BinaryenFunctionTypeGetNumParams = Module["_BinaryenFunctionTypeGetNumParams"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionTypeGetNumParams"].apply(null, arguments) };
var _BinaryenFunctionTypeGetParam = Module["_BinaryenFunctionTypeGetParam"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionTypeGetParam"].apply(null, arguments) };
var _BinaryenFunctionTypeGetResult = Module["_BinaryenFunctionTypeGetResult"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenFunctionTypeGetResult"].apply(null, arguments) };
var _BinaryenGeFloat32 = Module["_BinaryenGeFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGeFloat32"].apply(null, arguments) };
var _BinaryenGeFloat64 = Module["_BinaryenGeFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGeFloat64"].apply(null, arguments) };
var _BinaryenGeSInt32 = Module["_BinaryenGeSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGeSInt32"].apply(null, arguments) };
var _BinaryenGeSInt64 = Module["_BinaryenGeSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGeSInt64"].apply(null, arguments) };
var _BinaryenGeUInt32 = Module["_BinaryenGeUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGeUInt32"].apply(null, arguments) };
var _BinaryenGeUInt64 = Module["_BinaryenGeUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGeUInt64"].apply(null, arguments) };
var _BinaryenGetDebugInfo = Module["_BinaryenGetDebugInfo"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGetDebugInfo"].apply(null, arguments) };
var _BinaryenGetFunction = Module["_BinaryenGetFunction"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGetFunction"].apply(null, arguments) };
var _BinaryenGetFunctionTypeBySignature = Module["_BinaryenGetFunctionTypeBySignature"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGetFunctionTypeBySignature"].apply(null, arguments) };
var _BinaryenGetGlobal = Module["_BinaryenGetGlobal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGetGlobal"].apply(null, arguments) };
var _BinaryenGetGlobalGetName = Module["_BinaryenGetGlobalGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGetGlobalGetName"].apply(null, arguments) };
var _BinaryenGetGlobalId = Module["_BinaryenGetGlobalId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGetGlobalId"].apply(null, arguments) };
var _BinaryenGetLocal = Module["_BinaryenGetLocal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGetLocal"].apply(null, arguments) };
var _BinaryenGetLocalGetIndex = Module["_BinaryenGetLocalGetIndex"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGetLocalGetIndex"].apply(null, arguments) };
var _BinaryenGetLocalId = Module["_BinaryenGetLocalId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGetLocalId"].apply(null, arguments) };
var _BinaryenGetOptimizeLevel = Module["_BinaryenGetOptimizeLevel"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGetOptimizeLevel"].apply(null, arguments) };
var _BinaryenGetShrinkLevel = Module["_BinaryenGetShrinkLevel"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGetShrinkLevel"].apply(null, arguments) };
var _BinaryenGrowMemory = Module["_BinaryenGrowMemory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGrowMemory"].apply(null, arguments) };
var _BinaryenGtFloat32 = Module["_BinaryenGtFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGtFloat32"].apply(null, arguments) };
var _BinaryenGtFloat64 = Module["_BinaryenGtFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGtFloat64"].apply(null, arguments) };
var _BinaryenGtSInt32 = Module["_BinaryenGtSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGtSInt32"].apply(null, arguments) };
var _BinaryenGtSInt64 = Module["_BinaryenGtSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGtSInt64"].apply(null, arguments) };
var _BinaryenGtUInt32 = Module["_BinaryenGtUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGtUInt32"].apply(null, arguments) };
var _BinaryenGtUInt64 = Module["_BinaryenGtUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenGtUInt64"].apply(null, arguments) };
var _BinaryenHasFeature = Module["_BinaryenHasFeature"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenHasFeature"].apply(null, arguments) };
var _BinaryenHost = Module["_BinaryenHost"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenHost"].apply(null, arguments) };
var _BinaryenHostGetNameOperand = Module["_BinaryenHostGetNameOperand"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenHostGetNameOperand"].apply(null, arguments) };
var _BinaryenHostGetNumOperands = Module["_BinaryenHostGetNumOperands"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenHostGetNumOperands"].apply(null, arguments) };
var _BinaryenHostGetOp = Module["_BinaryenHostGetOp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenHostGetOp"].apply(null, arguments) };
var _BinaryenHostGetOperand = Module["_BinaryenHostGetOperand"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenHostGetOperand"].apply(null, arguments) };
var _BinaryenHostId = Module["_BinaryenHostId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenHostId"].apply(null, arguments) };
var _BinaryenIf = Module["_BinaryenIf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenIf"].apply(null, arguments) };
var _BinaryenIfGetCondition = Module["_BinaryenIfGetCondition"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenIfGetCondition"].apply(null, arguments) };
var _BinaryenIfGetIfFalse = Module["_BinaryenIfGetIfFalse"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenIfGetIfFalse"].apply(null, arguments) };
var _BinaryenIfGetIfTrue = Module["_BinaryenIfGetIfTrue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenIfGetIfTrue"].apply(null, arguments) };
var _BinaryenIfId = Module["_BinaryenIfId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenIfId"].apply(null, arguments) };
var _BinaryenImportGetBase = Module["_BinaryenImportGetBase"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenImportGetBase"].apply(null, arguments) };
var _BinaryenImportGetFunctionType = Module["_BinaryenImportGetFunctionType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenImportGetFunctionType"].apply(null, arguments) };
var _BinaryenImportGetGlobalType = Module["_BinaryenImportGetGlobalType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenImportGetGlobalType"].apply(null, arguments) };
var _BinaryenImportGetKind = Module["_BinaryenImportGetKind"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenImportGetKind"].apply(null, arguments) };
var _BinaryenImportGetModule = Module["_BinaryenImportGetModule"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenImportGetModule"].apply(null, arguments) };
var _BinaryenImportGetName = Module["_BinaryenImportGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenImportGetName"].apply(null, arguments) };
var _BinaryenInt32 = Module["_BinaryenInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenInt32"].apply(null, arguments) };
var _BinaryenInt64 = Module["_BinaryenInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenInt64"].apply(null, arguments) };
var _BinaryenInvalidId = Module["_BinaryenInvalidId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenInvalidId"].apply(null, arguments) };
var _BinaryenLeFloat32 = Module["_BinaryenLeFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLeFloat32"].apply(null, arguments) };
var _BinaryenLeFloat64 = Module["_BinaryenLeFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLeFloat64"].apply(null, arguments) };
var _BinaryenLeSInt32 = Module["_BinaryenLeSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLeSInt32"].apply(null, arguments) };
var _BinaryenLeSInt64 = Module["_BinaryenLeSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLeSInt64"].apply(null, arguments) };
var _BinaryenLeUInt32 = Module["_BinaryenLeUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLeUInt32"].apply(null, arguments) };
var _BinaryenLeUInt64 = Module["_BinaryenLeUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLeUInt64"].apply(null, arguments) };
var _BinaryenLiteralFloat32 = Module["_BinaryenLiteralFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLiteralFloat32"].apply(null, arguments) };
var _BinaryenLiteralFloat32Bits = Module["_BinaryenLiteralFloat32Bits"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLiteralFloat32Bits"].apply(null, arguments) };
var _BinaryenLiteralFloat64 = Module["_BinaryenLiteralFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLiteralFloat64"].apply(null, arguments) };
var _BinaryenLiteralFloat64Bits = Module["_BinaryenLiteralFloat64Bits"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLiteralFloat64Bits"].apply(null, arguments) };
var _BinaryenLiteralInt32 = Module["_BinaryenLiteralInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLiteralInt32"].apply(null, arguments) };
var _BinaryenLiteralInt64 = Module["_BinaryenLiteralInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLiteralInt64"].apply(null, arguments) };
var _BinaryenLoad = Module["_BinaryenLoad"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLoad"].apply(null, arguments) };
var _BinaryenLoadGetAlign = Module["_BinaryenLoadGetAlign"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLoadGetAlign"].apply(null, arguments) };
var _BinaryenLoadGetBytes = Module["_BinaryenLoadGetBytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLoadGetBytes"].apply(null, arguments) };
var _BinaryenLoadGetOffset = Module["_BinaryenLoadGetOffset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLoadGetOffset"].apply(null, arguments) };
var _BinaryenLoadGetPtr = Module["_BinaryenLoadGetPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLoadGetPtr"].apply(null, arguments) };
var _BinaryenLoadId = Module["_BinaryenLoadId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLoadId"].apply(null, arguments) };
var _BinaryenLoadIsAtomic = Module["_BinaryenLoadIsAtomic"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLoadIsAtomic"].apply(null, arguments) };
var _BinaryenLoadIsSigned = Module["_BinaryenLoadIsSigned"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLoadIsSigned"].apply(null, arguments) };
var _BinaryenLoop = Module["_BinaryenLoop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLoop"].apply(null, arguments) };
var _BinaryenLoopGetBody = Module["_BinaryenLoopGetBody"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLoopGetBody"].apply(null, arguments) };
var _BinaryenLoopGetName = Module["_BinaryenLoopGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLoopGetName"].apply(null, arguments) };
var _BinaryenLoopId = Module["_BinaryenLoopId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLoopId"].apply(null, arguments) };
var _BinaryenLtFloat32 = Module["_BinaryenLtFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLtFloat32"].apply(null, arguments) };
var _BinaryenLtFloat64 = Module["_BinaryenLtFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLtFloat64"].apply(null, arguments) };
var _BinaryenLtSInt32 = Module["_BinaryenLtSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLtSInt32"].apply(null, arguments) };
var _BinaryenLtSInt64 = Module["_BinaryenLtSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLtSInt64"].apply(null, arguments) };
var _BinaryenLtUInt32 = Module["_BinaryenLtUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLtUInt32"].apply(null, arguments) };
var _BinaryenLtUInt64 = Module["_BinaryenLtUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenLtUInt64"].apply(null, arguments) };
var _BinaryenMaxFloat32 = Module["_BinaryenMaxFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenMaxFloat32"].apply(null, arguments) };
var _BinaryenMaxFloat64 = Module["_BinaryenMaxFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenMaxFloat64"].apply(null, arguments) };
var _BinaryenMinFloat32 = Module["_BinaryenMinFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenMinFloat32"].apply(null, arguments) };
var _BinaryenMinFloat64 = Module["_BinaryenMinFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenMinFloat64"].apply(null, arguments) };
var _BinaryenModuleAddDebugInfoFileName = Module["_BinaryenModuleAddDebugInfoFileName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleAddDebugInfoFileName"].apply(null, arguments) };
var _BinaryenModuleAllocateAndWrite = Module["_BinaryenModuleAllocateAndWrite"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleAllocateAndWrite"].apply(null, arguments) };
var _BinaryenModuleAutoDrop = Module["_BinaryenModuleAutoDrop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleAutoDrop"].apply(null, arguments) };
var _BinaryenModuleCreate = Module["_BinaryenModuleCreate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleCreate"].apply(null, arguments) };
var _BinaryenModuleDispose = Module["_BinaryenModuleDispose"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleDispose"].apply(null, arguments) };
var _BinaryenModuleGetDebugInfoFileName = Module["_BinaryenModuleGetDebugInfoFileName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleGetDebugInfoFileName"].apply(null, arguments) };
var _BinaryenModuleInterpret = Module["_BinaryenModuleInterpret"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleInterpret"].apply(null, arguments) };
var _BinaryenModuleOptimize = Module["_BinaryenModuleOptimize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleOptimize"].apply(null, arguments) };
var _BinaryenModuleParse = Module["_BinaryenModuleParse"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleParse"].apply(null, arguments) };
var _BinaryenModulePrint = Module["_BinaryenModulePrint"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModulePrint"].apply(null, arguments) };
var _BinaryenModulePrintAsmjs = Module["_BinaryenModulePrintAsmjs"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModulePrintAsmjs"].apply(null, arguments) };
var _BinaryenModuleRead = Module["_BinaryenModuleRead"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleRead"].apply(null, arguments) };
var _BinaryenModuleRunPasses = Module["_BinaryenModuleRunPasses"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleRunPasses"].apply(null, arguments) };
var _BinaryenModuleValidate = Module["_BinaryenModuleValidate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleValidate"].apply(null, arguments) };
var _BinaryenModuleWrite = Module["_BinaryenModuleWrite"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleWrite"].apply(null, arguments) };
var _BinaryenModuleWriteWithSourceMap = Module["_BinaryenModuleWriteWithSourceMap"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenModuleWriteWithSourceMap"].apply(null, arguments) };
var _BinaryenMulFloat32 = Module["_BinaryenMulFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenMulFloat32"].apply(null, arguments) };
var _BinaryenMulFloat64 = Module["_BinaryenMulFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenMulFloat64"].apply(null, arguments) };
var _BinaryenMulInt32 = Module["_BinaryenMulInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenMulInt32"].apply(null, arguments) };
var _BinaryenMulInt64 = Module["_BinaryenMulInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenMulInt64"].apply(null, arguments) };
var _BinaryenNeFloat32 = Module["_BinaryenNeFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenNeFloat32"].apply(null, arguments) };
var _BinaryenNeFloat64 = Module["_BinaryenNeFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenNeFloat64"].apply(null, arguments) };
var _BinaryenNeInt32 = Module["_BinaryenNeInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenNeInt32"].apply(null, arguments) };
var _BinaryenNeInt64 = Module["_BinaryenNeInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenNeInt64"].apply(null, arguments) };
var _BinaryenNearestFloat32 = Module["_BinaryenNearestFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenNearestFloat32"].apply(null, arguments) };
var _BinaryenNearestFloat64 = Module["_BinaryenNearestFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenNearestFloat64"].apply(null, arguments) };
var _BinaryenNegFloat32 = Module["_BinaryenNegFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenNegFloat32"].apply(null, arguments) };
var _BinaryenNegFloat64 = Module["_BinaryenNegFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenNegFloat64"].apply(null, arguments) };
var _BinaryenNone = Module["_BinaryenNone"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenNone"].apply(null, arguments) };
var _BinaryenNop = Module["_BinaryenNop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenNop"].apply(null, arguments) };
var _BinaryenNopId = Module["_BinaryenNopId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenNopId"].apply(null, arguments) };
var _BinaryenOrInt32 = Module["_BinaryenOrInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenOrInt32"].apply(null, arguments) };
var _BinaryenOrInt64 = Module["_BinaryenOrInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenOrInt64"].apply(null, arguments) };
var _BinaryenPageSize = Module["_BinaryenPageSize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenPageSize"].apply(null, arguments) };
var _BinaryenPopcntInt32 = Module["_BinaryenPopcntInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenPopcntInt32"].apply(null, arguments) };
var _BinaryenPopcntInt64 = Module["_BinaryenPopcntInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenPopcntInt64"].apply(null, arguments) };
var _BinaryenPromoteFloat32 = Module["_BinaryenPromoteFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenPromoteFloat32"].apply(null, arguments) };
var _BinaryenReinterpretFloat32 = Module["_BinaryenReinterpretFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenReinterpretFloat32"].apply(null, arguments) };
var _BinaryenReinterpretFloat64 = Module["_BinaryenReinterpretFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenReinterpretFloat64"].apply(null, arguments) };
var _BinaryenReinterpretInt32 = Module["_BinaryenReinterpretInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenReinterpretInt32"].apply(null, arguments) };
var _BinaryenReinterpretInt64 = Module["_BinaryenReinterpretInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenReinterpretInt64"].apply(null, arguments) };
var _BinaryenRemSInt32 = Module["_BinaryenRemSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenRemSInt32"].apply(null, arguments) };
var _BinaryenRemSInt64 = Module["_BinaryenRemSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenRemSInt64"].apply(null, arguments) };
var _BinaryenRemUInt32 = Module["_BinaryenRemUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenRemUInt32"].apply(null, arguments) };
var _BinaryenRemUInt64 = Module["_BinaryenRemUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenRemUInt64"].apply(null, arguments) };
var _BinaryenRemoveExport = Module["_BinaryenRemoveExport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenRemoveExport"].apply(null, arguments) };
var _BinaryenRemoveFunction = Module["_BinaryenRemoveFunction"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenRemoveFunction"].apply(null, arguments) };
var _BinaryenRemoveFunctionType = Module["_BinaryenRemoveFunctionType"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenRemoveFunctionType"].apply(null, arguments) };
var _BinaryenRemoveImport = Module["_BinaryenRemoveImport"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenRemoveImport"].apply(null, arguments) };
var _BinaryenReturn = Module["_BinaryenReturn"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenReturn"].apply(null, arguments) };
var _BinaryenReturnGetValue = Module["_BinaryenReturnGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenReturnGetValue"].apply(null, arguments) };
var _BinaryenReturnId = Module["_BinaryenReturnId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenReturnId"].apply(null, arguments) };
var _BinaryenRotLInt32 = Module["_BinaryenRotLInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenRotLInt32"].apply(null, arguments) };
var _BinaryenRotLInt64 = Module["_BinaryenRotLInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenRotLInt64"].apply(null, arguments) };
var _BinaryenRotRInt32 = Module["_BinaryenRotRInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenRotRInt32"].apply(null, arguments) };
var _BinaryenRotRInt64 = Module["_BinaryenRotRInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenRotRInt64"].apply(null, arguments) };
var _BinaryenSelect = Module["_BinaryenSelect"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSelect"].apply(null, arguments) };
var _BinaryenSelectGetCondition = Module["_BinaryenSelectGetCondition"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSelectGetCondition"].apply(null, arguments) };
var _BinaryenSelectGetIfFalse = Module["_BinaryenSelectGetIfFalse"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSelectGetIfFalse"].apply(null, arguments) };
var _BinaryenSelectGetIfTrue = Module["_BinaryenSelectGetIfTrue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSelectGetIfTrue"].apply(null, arguments) };
var _BinaryenSelectId = Module["_BinaryenSelectId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSelectId"].apply(null, arguments) };
var _BinaryenSetAPITracing = Module["_BinaryenSetAPITracing"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetAPITracing"].apply(null, arguments) };
var _BinaryenSetDebugInfo = Module["_BinaryenSetDebugInfo"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetDebugInfo"].apply(null, arguments) };
var _BinaryenSetFunctionTable = Module["_BinaryenSetFunctionTable"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetFunctionTable"].apply(null, arguments) };
var _BinaryenSetGlobal = Module["_BinaryenSetGlobal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetGlobal"].apply(null, arguments) };
var _BinaryenSetGlobalGetName = Module["_BinaryenSetGlobalGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetGlobalGetName"].apply(null, arguments) };
var _BinaryenSetGlobalGetValue = Module["_BinaryenSetGlobalGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetGlobalGetValue"].apply(null, arguments) };
var _BinaryenSetGlobalId = Module["_BinaryenSetGlobalId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetGlobalId"].apply(null, arguments) };
var _BinaryenSetLocal = Module["_BinaryenSetLocal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetLocal"].apply(null, arguments) };
var _BinaryenSetLocalGetIndex = Module["_BinaryenSetLocalGetIndex"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetLocalGetIndex"].apply(null, arguments) };
var _BinaryenSetLocalGetValue = Module["_BinaryenSetLocalGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetLocalGetValue"].apply(null, arguments) };
var _BinaryenSetLocalId = Module["_BinaryenSetLocalId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetLocalId"].apply(null, arguments) };
var _BinaryenSetLocalIsTee = Module["_BinaryenSetLocalIsTee"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetLocalIsTee"].apply(null, arguments) };
var _BinaryenSetMemory = Module["_BinaryenSetMemory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetMemory"].apply(null, arguments) };
var _BinaryenSetOptimizeLevel = Module["_BinaryenSetOptimizeLevel"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetOptimizeLevel"].apply(null, arguments) };
var _BinaryenSetShrinkLevel = Module["_BinaryenSetShrinkLevel"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetShrinkLevel"].apply(null, arguments) };
var _BinaryenSetStart = Module["_BinaryenSetStart"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSetStart"].apply(null, arguments) };
var _BinaryenShlInt32 = Module["_BinaryenShlInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenShlInt32"].apply(null, arguments) };
var _BinaryenShlInt64 = Module["_BinaryenShlInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenShlInt64"].apply(null, arguments) };
var _BinaryenShrSInt32 = Module["_BinaryenShrSInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenShrSInt32"].apply(null, arguments) };
var _BinaryenShrSInt64 = Module["_BinaryenShrSInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenShrSInt64"].apply(null, arguments) };
var _BinaryenShrUInt32 = Module["_BinaryenShrUInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenShrUInt32"].apply(null, arguments) };
var _BinaryenShrUInt64 = Module["_BinaryenShrUInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenShrUInt64"].apply(null, arguments) };
var _BinaryenSqrtFloat32 = Module["_BinaryenSqrtFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSqrtFloat32"].apply(null, arguments) };
var _BinaryenSqrtFloat64 = Module["_BinaryenSqrtFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSqrtFloat64"].apply(null, arguments) };
var _BinaryenStore = Module["_BinaryenStore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenStore"].apply(null, arguments) };
var _BinaryenStoreGetAlign = Module["_BinaryenStoreGetAlign"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenStoreGetAlign"].apply(null, arguments) };
var _BinaryenStoreGetBytes = Module["_BinaryenStoreGetBytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenStoreGetBytes"].apply(null, arguments) };
var _BinaryenStoreGetOffset = Module["_BinaryenStoreGetOffset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenStoreGetOffset"].apply(null, arguments) };
var _BinaryenStoreGetPtr = Module["_BinaryenStoreGetPtr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenStoreGetPtr"].apply(null, arguments) };
var _BinaryenStoreGetValue = Module["_BinaryenStoreGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenStoreGetValue"].apply(null, arguments) };
var _BinaryenStoreId = Module["_BinaryenStoreId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenStoreId"].apply(null, arguments) };
var _BinaryenStoreIsAtomic = Module["_BinaryenStoreIsAtomic"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenStoreIsAtomic"].apply(null, arguments) };
var _BinaryenSubFloat32 = Module["_BinaryenSubFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSubFloat32"].apply(null, arguments) };
var _BinaryenSubFloat64 = Module["_BinaryenSubFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSubFloat64"].apply(null, arguments) };
var _BinaryenSubInt32 = Module["_BinaryenSubInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSubInt32"].apply(null, arguments) };
var _BinaryenSubInt64 = Module["_BinaryenSubInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSubInt64"].apply(null, arguments) };
var _BinaryenSwitch = Module["_BinaryenSwitch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSwitch"].apply(null, arguments) };
var _BinaryenSwitchGetCondition = Module["_BinaryenSwitchGetCondition"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSwitchGetCondition"].apply(null, arguments) };
var _BinaryenSwitchGetDefaultName = Module["_BinaryenSwitchGetDefaultName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSwitchGetDefaultName"].apply(null, arguments) };
var _BinaryenSwitchGetName = Module["_BinaryenSwitchGetName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSwitchGetName"].apply(null, arguments) };
var _BinaryenSwitchGetNumNames = Module["_BinaryenSwitchGetNumNames"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSwitchGetNumNames"].apply(null, arguments) };
var _BinaryenSwitchGetValue = Module["_BinaryenSwitchGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSwitchGetValue"].apply(null, arguments) };
var _BinaryenSwitchId = Module["_BinaryenSwitchId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenSwitchId"].apply(null, arguments) };
var _BinaryenTeeLocal = Module["_BinaryenTeeLocal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTeeLocal"].apply(null, arguments) };
var _BinaryenTruncFloat32 = Module["_BinaryenTruncFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTruncFloat32"].apply(null, arguments) };
var _BinaryenTruncFloat64 = Module["_BinaryenTruncFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTruncFloat64"].apply(null, arguments) };
var _BinaryenTruncSFloat32ToInt32 = Module["_BinaryenTruncSFloat32ToInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTruncSFloat32ToInt32"].apply(null, arguments) };
var _BinaryenTruncSFloat32ToInt64 = Module["_BinaryenTruncSFloat32ToInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTruncSFloat32ToInt64"].apply(null, arguments) };
var _BinaryenTruncSFloat64ToInt32 = Module["_BinaryenTruncSFloat64ToInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTruncSFloat64ToInt32"].apply(null, arguments) };
var _BinaryenTruncSFloat64ToInt64 = Module["_BinaryenTruncSFloat64ToInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTruncSFloat64ToInt64"].apply(null, arguments) };
var _BinaryenTruncUFloat32ToInt32 = Module["_BinaryenTruncUFloat32ToInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTruncUFloat32ToInt32"].apply(null, arguments) };
var _BinaryenTruncUFloat32ToInt64 = Module["_BinaryenTruncUFloat32ToInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTruncUFloat32ToInt64"].apply(null, arguments) };
var _BinaryenTruncUFloat64ToInt32 = Module["_BinaryenTruncUFloat64ToInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTruncUFloat64ToInt32"].apply(null, arguments) };
var _BinaryenTruncUFloat64ToInt64 = Module["_BinaryenTruncUFloat64ToInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTruncUFloat64ToInt64"].apply(null, arguments) };
var _BinaryenTypeAuto = Module["_BinaryenTypeAuto"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTypeAuto"].apply(null, arguments) };
var _BinaryenTypeFloat32 = Module["_BinaryenTypeFloat32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTypeFloat32"].apply(null, arguments) };
var _BinaryenTypeFloat64 = Module["_BinaryenTypeFloat64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTypeFloat64"].apply(null, arguments) };
var _BinaryenTypeInt32 = Module["_BinaryenTypeInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTypeInt32"].apply(null, arguments) };
var _BinaryenTypeInt64 = Module["_BinaryenTypeInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTypeInt64"].apply(null, arguments) };
var _BinaryenTypeNone = Module["_BinaryenTypeNone"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTypeNone"].apply(null, arguments) };
var _BinaryenTypeUnreachable = Module["_BinaryenTypeUnreachable"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenTypeUnreachable"].apply(null, arguments) };
var _BinaryenUnary = Module["_BinaryenUnary"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenUnary"].apply(null, arguments) };
var _BinaryenUnaryGetOp = Module["_BinaryenUnaryGetOp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenUnaryGetOp"].apply(null, arguments) };
var _BinaryenUnaryGetValue = Module["_BinaryenUnaryGetValue"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenUnaryGetValue"].apply(null, arguments) };
var _BinaryenUnaryId = Module["_BinaryenUnaryId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenUnaryId"].apply(null, arguments) };
var _BinaryenUndefined = Module["_BinaryenUndefined"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenUndefined"].apply(null, arguments) };
var _BinaryenUnreachable = Module["_BinaryenUnreachable"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenUnreachable"].apply(null, arguments) };
var _BinaryenUnreachableId = Module["_BinaryenUnreachableId"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenUnreachableId"].apply(null, arguments) };
var _BinaryenWrapInt64 = Module["_BinaryenWrapInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenWrapInt64"].apply(null, arguments) };
var _BinaryenXorInt32 = Module["_BinaryenXorInt32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenXorInt32"].apply(null, arguments) };
var _BinaryenXorInt64 = Module["_BinaryenXorInt64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_BinaryenXorInt64"].apply(null, arguments) };
var __GLOBAL__I_000101 = Module["__GLOBAL__I_000101"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__I_000101"].apply(null, arguments) };
var __GLOBAL__sub_I_InstrumentLocals_cpp = Module["__GLOBAL__sub_I_InstrumentLocals_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_InstrumentLocals_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_InstrumentMemory_cpp = Module["__GLOBAL__sub_I_InstrumentMemory_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_InstrumentMemory_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_LegalizeJSInterface_cpp = Module["__GLOBAL__sub_I_LegalizeJSInterface_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_LegalizeJSInterface_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_LogExecution_cpp = Module["__GLOBAL__sub_I_LogExecution_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_LogExecution_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_Metrics_cpp = Module["__GLOBAL__sub_I_Metrics_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_Metrics_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_OptimizeInstructions_cpp = Module["__GLOBAL__sub_I_OptimizeInstructions_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_OptimizeInstructions_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_Precompute_cpp = Module["__GLOBAL__sub_I_Precompute_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_Precompute_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_RelooperJumpThreading_cpp = Module["__GLOBAL__sub_I_RelooperJumpThreading_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_RelooperJumpThreading_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_SSAify_cpp = Module["__GLOBAL__sub_I_SSAify_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_SSAify_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_SafeHeap_cpp = Module["__GLOBAL__sub_I_SafeHeap_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_SafeHeap_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_TrapMode_cpp = Module["__GLOBAL__sub_I_TrapMode_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_TrapMode_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_binaryen_c_cpp = Module["__GLOBAL__sub_I_binaryen_c_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_binaryen_c_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_iostream_cpp = Module["__GLOBAL__sub_I_iostream_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_iostream_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_optimizer_shared_cpp = Module["__GLOBAL__sub_I_optimizer_shared_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_optimizer_shared_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_parser_cpp = Module["__GLOBAL__sub_I_parser_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_parser_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_pass_cpp = Module["__GLOBAL__sub_I_pass_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_pass_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_shared_constants_cpp = Module["__GLOBAL__sub_I_shared_constants_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_shared_constants_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_simple_ast_cpp = Module["__GLOBAL__sub_I_simple_ast_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_simple_ast_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_threads_cpp = Module["__GLOBAL__sub_I_threads_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_threads_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_wasm_cpp = Module["__GLOBAL__sub_I_wasm_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_wasm_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_wasm_emscripten_cpp = Module["__GLOBAL__sub_I_wasm_emscripten_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_wasm_emscripten_cpp"].apply(null, arguments) };
var __ZSt18uncaught_exceptionv = Module["__ZSt18uncaught_exceptionv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZSt18uncaught_exceptionv"].apply(null, arguments) };
var ___cxa_can_catch = Module["___cxa_can_catch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___cxa_can_catch"].apply(null, arguments) };
var ___cxa_demangle = Module["___cxa_demangle"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___cxa_demangle"].apply(null, arguments) };
var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___cxa_is_pointer_type"].apply(null, arguments) };
var ___emscripten_environ_constructor = Module["___emscripten_environ_constructor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___emscripten_environ_constructor"].apply(null, arguments) };
var __get_environ = Module["__get_environ"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__get_environ"].apply(null, arguments) };
var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_emscripten_replace_memory"].apply(null, arguments) };
var _free = Module["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_free"].apply(null, arguments) };
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_llvm_bswap_i32"].apply(null, arguments) };
var _llvm_nearbyint_f32 = Module["_llvm_nearbyint_f32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_llvm_nearbyint_f32"].apply(null, arguments) };
var _llvm_nearbyint_f64 = Module["_llvm_nearbyint_f64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_llvm_nearbyint_f64"].apply(null, arguments) };
var _malloc = Module["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_malloc"].apply(null, arguments) };
var _memcpy = Module["_memcpy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memcpy"].apply(null, arguments) };
var _memmove = Module["_memmove"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memmove"].apply(null, arguments) };
var _memset = Module["_memset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memset"].apply(null, arguments) };
var _pthread_cond_broadcast = Module["_pthread_cond_broadcast"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pthread_cond_broadcast"].apply(null, arguments) };
var _pthread_mutex_lock = Module["_pthread_mutex_lock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pthread_mutex_lock"].apply(null, arguments) };
var _pthread_mutex_unlock = Module["_pthread_mutex_unlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pthread_mutex_unlock"].apply(null, arguments) };
var _sbrk = Module["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sbrk"].apply(null, arguments) };
var establishStackSpace = Module["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["establishStackSpace"].apply(null, arguments) };
var getTempRet0 = Module["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["getTempRet0"].apply(null, arguments) };
var runPostSets = Module["runPostSets"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["runPostSets"].apply(null, arguments) };
var setTempRet0 = Module["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["setTempRet0"].apply(null, arguments) };
var setThrew = Module["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["setThrew"].apply(null, arguments) };
var stackAlloc = Module["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackAlloc"].apply(null, arguments) };
var stackRestore = Module["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackRestore"].apply(null, arguments) };
var stackSave = Module["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackSave"].apply(null, arguments) };
var dynCall_i = Module["dynCall_i"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_i"].apply(null, arguments) };
var dynCall_id = Module["dynCall_id"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_id"].apply(null, arguments) };
var dynCall_ii = Module["dynCall_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_ii"].apply(null, arguments) };
var dynCall_iid = Module["dynCall_iid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iid"].apply(null, arguments) };
var dynCall_iii = Module["dynCall_iii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iii"].apply(null, arguments) };
var dynCall_iiii = Module["dynCall_iiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiii"].apply(null, arguments) };
var dynCall_iiiii = Module["dynCall_iiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiii"].apply(null, arguments) };
var dynCall_iiiiid = Module["dynCall_iiiiid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiid"].apply(null, arguments) };
var dynCall_iiiiii = Module["dynCall_iiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiii"].apply(null, arguments) };
var dynCall_iiiiiid = Module["dynCall_iiiiiid"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiiid"].apply(null, arguments) };
var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiiii"].apply(null, arguments) };
var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiiiii"].apply(null, arguments) };
var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiiiiii"].apply(null, arguments) };
var dynCall_iiiiiiiiiiii = Module["dynCall_iiiiiiiiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiiiiiiiii"].apply(null, arguments) };
var dynCall_iiiiij = Module["dynCall_iiiiij"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiij"].apply(null, arguments) };
var dynCall_iij = Module["dynCall_iij"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iij"].apply(null, arguments) };
var dynCall_ji = Module["dynCall_ji"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_ji"].apply(null, arguments) };
var dynCall_jii = Module["dynCall_jii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_jii"].apply(null, arguments) };
var dynCall_v = Module["dynCall_v"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_v"].apply(null, arguments) };
var dynCall_vi = Module["dynCall_vi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vi"].apply(null, arguments) };
var dynCall_vii = Module["dynCall_vii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vii"].apply(null, arguments) };
var dynCall_viii = Module["dynCall_viii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viii"].apply(null, arguments) };
var dynCall_viiii = Module["dynCall_viiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiii"].apply(null, arguments) };
var dynCall_viiiii = Module["dynCall_viiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiii"].apply(null, arguments) };
var dynCall_viiiiii = Module["dynCall_viiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiiii"].apply(null, arguments) };
var dynCall_viiiiiii = Module["dynCall_viiiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiiiii"].apply(null, arguments) };
var dynCall_viiiiiiiiii = Module["dynCall_viiiiiiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiiiiiiii"].apply(null, arguments) };
var dynCall_viiiiiiiiiiiiiii = Module["dynCall_viiiiiiiiiiiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiiiiiiiiiiiii"].apply(null, arguments) };
var dynCall_viij = Module["dynCall_viij"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viij"].apply(null, arguments) };
var dynCall_viijii = Module["dynCall_viijii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viijii"].apply(null, arguments) };
var dynCall_vij = Module["dynCall_vij"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vij"].apply(null, arguments) };
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayToString"]) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["ccall"]) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["cwrap"]) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["setValue"]) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getValue"]) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocate"]) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getMemory"]) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function() { abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["AsciiToString"]) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToAscii"]) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackTrace"]) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnInit"]) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnExit"]) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addRunDependency"]) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS"]) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPath"]) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLink"]) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_unlink"]) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["GL"]) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["staticAlloc"]) Module["staticAlloc"] = function() { abort("'staticAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["warnOnce"]) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getLEB"]) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["registerFunctions"]) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addFunction"]) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["removeFunction"]) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["prettyPrint"]) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["makeBigInt"]) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynCall"]) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackSave"]) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackRestore"]) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackAlloc"]) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["establishStackSpace"]) Module["establishStackSpace"] = function() { abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["print"]) Module["print"] = function() { abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["printErr"]) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", { get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", { get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STATIC"]) Object.defineProperty(Module, "ALLOC_STATIC", { get: function() { abort("'ALLOC_STATIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", { get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", { get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });



// Modularize mode returns a function, which can be called to
// create instances. The instances provide a then() method,
// must like a Promise, that receives a callback. The callback
// is called when the module is ready to run, with the module
// as a parameter. (Like a Promise, it also returns the module
// so you can use the output of .then(..)).
Module['then'] = function(func) {
  // We may already be ready to run code at this time. if
  // so, just queue a call to the callback.
  if (Module['calledRun']) {
    func(Module);
  } else {
    // we are not ready to call then() yet. we must call it
    // at the same time we would call onRuntimeInitialized.
    var old = Module['onRuntimeInitialized'];
    Module['onRuntimeInitialized'] = function() {
      if (old) old();
      func(Module);
    };
  }
  return Module;
};

/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in NO_FILESYSTEM
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = out;
  var printErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch(e) {}
  out = print;
  err = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set NO_EXIT_RUNTIME to 0 (see the FAQ), or make sure to emit a newline when you printf etc.');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      err('exit(' + status + ') called, but NO_EXIT_RUNTIME is set, so halting execution but not exiting the runtime or preventing further async execution (build with NO_EXIT_RUNTIME=0, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  Module['quit'](status, new ExitStatus(status));
}

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    out(what);
    err(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



// export friendly API methods

function preserveStack(func) {
  try {
    var stack = stackSave();
    return func();
  } finally {
    stackRestore(stack);
  }
}

function strToStack(str) {
  if (!str) return 0;
  return allocate(intArrayFromString(str), 'i8', ALLOC_STACK);
}

function i32sToStack(i32s) {
  var ret = stackAlloc(i32s.length << 2);
  for (var i = 0; i < i32s.length; i++) {
    HEAP32[ret + (i << 2) >> 2] = i32s[i];
  }
  return ret;
}

function postSetup(){

// Types
Module['none'] = Module['_BinaryenTypeNone']();
Module['i32'] = Module['_BinaryenTypeInt32']();
Module['i64'] = Module['_BinaryenTypeInt64']();
Module['f32'] = Module['_BinaryenTypeFloat32']();
Module['f64'] = Module['_BinaryenTypeFloat64']();
Module['unreachable'] = Module['_BinaryenTypeUnreachable']();
Module['auto'] = /* deprecated */ Module['undefined'] = Module['_BinaryenTypeAuto']();

// Expression ids
Module['InvalidId'] = Module['_BinaryenInvalidId']();
Module['BlockId'] = Module['_BinaryenBlockId']();
Module['IfId'] = Module['_BinaryenIfId']();
Module['LoopId'] = Module['_BinaryenLoopId']();
Module['BreakId'] = Module['_BinaryenBreakId']();
Module['SwitchId'] = Module['_BinaryenSwitchId']();
Module['CallId'] = Module['_BinaryenCallId']();
Module['CallImportId'] = Module['_BinaryenCallImportId']();
Module['CallIndirectId'] = Module['_BinaryenCallIndirectId']();
Module['GetLocalId'] = Module['_BinaryenGetLocalId']();
Module['SetLocalId'] = Module['_BinaryenSetLocalId']();
Module['GetGlobalId'] = Module['_BinaryenGetGlobalId']();
Module['SetGlobalId'] = Module['_BinaryenSetGlobalId']();
Module['LoadId'] = Module['_BinaryenLoadId']();
Module['StoreId'] = Module['_BinaryenStoreId']();
Module['ConstId'] = Module['_BinaryenConstId']();
Module['UnaryId'] = Module['_BinaryenUnaryId']();
Module['BinaryId'] = Module['_BinaryenBinaryId']();
Module['SelectId'] = Module['_BinaryenSelectId']();
Module['DropId'] = Module['_BinaryenDropId']();
Module['ReturnId'] = Module['_BinaryenReturnId']();
Module['HostId'] = Module['_BinaryenHostId']();
Module['NopId'] = Module['_BinaryenNopId']();
Module['UnreachableId'] = Module['_BinaryenUnreachableId']();
Module['AtomicCmpxchgId'] = Module['_BinaryenAtomicCmpxchgId']();
Module['AtomicRMWId'] = Module['_BinaryenAtomicRMWId']();
Module['AtomicWaitId'] = Module['_BinaryenAtomicWaitId']();
Module['AtomicWakeId'] = Module['_BinaryenAtomicWakeId']();

// External kinds
Module['ExternalFunction'] = Module['_BinaryenExternalFunction']();
Module['ExternalTable'] = Module['_BinaryenExternalTable']();
Module['ExternalMemory'] = Module['_BinaryenExternalMemory']();
Module['ExternalGlobal'] = Module['_BinaryenExternalGlobal']();

// Operations
Module['ClzInt32'] = Module['_BinaryenClzInt32']();
Module['CtzInt32'] = Module['_BinaryenCtzInt32']();
Module['PopcntInt32'] = Module['_BinaryenPopcntInt32']();
Module['NegFloat32'] = Module['_BinaryenNegFloat32']();
Module['AbsFloat32'] = Module['_BinaryenAbsFloat32']();
Module['CeilFloat32'] = Module['_BinaryenCeilFloat32']();
Module['FloorFloat32'] = Module['_BinaryenFloorFloat32']();
Module['TruncFloat32'] = Module['_BinaryenTruncFloat32']();
Module['NearestFloat32'] = Module['_BinaryenNearestFloat32']();
Module['SqrtFloat32'] = Module['_BinaryenSqrtFloat32']();
Module['EqZInt32'] = Module['_BinaryenEqZInt32']();
Module['ClzInt64'] = Module['_BinaryenClzInt64']();
Module['CtzInt64'] = Module['_BinaryenCtzInt64']();
Module['PopcntInt64'] = Module['_BinaryenPopcntInt64']();
Module['NegFloat64'] = Module['_BinaryenNegFloat64']();
Module['AbsFloat64'] = Module['_BinaryenAbsFloat64']();
Module['CeilFloat64'] = Module['_BinaryenCeilFloat64']();
Module['FloorFloat64'] = Module['_BinaryenFloorFloat64']();
Module['TruncFloat64'] = Module['_BinaryenTruncFloat64']();
Module['NearestFloat64'] = Module['_BinaryenNearestFloat64']();
Module['SqrtFloat64'] = Module['_BinaryenSqrtFloat64']();
Module['EqZInt64'] = Module['_BinaryenEqZInt64']();
Module['ExtendSInt32'] = Module['_BinaryenExtendSInt32']();
Module['ExtendUInt32'] = Module['_BinaryenExtendUInt32']();
Module['WrapInt64'] = Module['_BinaryenWrapInt64']();
Module['TruncSFloat32ToInt32'] = Module['_BinaryenTruncSFloat32ToInt32']();
Module['TruncSFloat32ToInt64'] = Module['_BinaryenTruncSFloat32ToInt64']();
Module['TruncUFloat32ToInt32'] = Module['_BinaryenTruncUFloat32ToInt32']();
Module['TruncUFloat32ToInt64'] = Module['_BinaryenTruncUFloat32ToInt64']();
Module['TruncSFloat64ToInt32'] = Module['_BinaryenTruncSFloat64ToInt32']();
Module['TruncSFloat64ToInt64'] = Module['_BinaryenTruncSFloat64ToInt64']();
Module['TruncUFloat64ToInt32'] = Module['_BinaryenTruncUFloat64ToInt32']();
Module['TruncUFloat64ToInt64'] = Module['_BinaryenTruncUFloat64ToInt64']();
Module['ReinterpretFloat32'] = Module['_BinaryenReinterpretFloat32']();
Module['ReinterpretFloat64'] = Module['_BinaryenReinterpretFloat64']();
Module['ConvertSInt32ToFloat32'] = Module['_BinaryenConvertSInt32ToFloat32']();
Module['ConvertSInt32ToFloat64'] = Module['_BinaryenConvertSInt32ToFloat64']();
Module['ConvertUInt32ToFloat32'] = Module['_BinaryenConvertUInt32ToFloat32']();
Module['ConvertUInt32ToFloat64'] = Module['_BinaryenConvertUInt32ToFloat64']();
Module['ConvertSInt64ToFloat32'] = Module['_BinaryenConvertSInt64ToFloat32']();
Module['ConvertSInt64ToFloat64'] = Module['_BinaryenConvertSInt64ToFloat64']();
Module['ConvertUInt64ToFloat32'] = Module['_BinaryenConvertUInt64ToFloat32']();
Module['ConvertUInt64ToFloat64'] = Module['_BinaryenConvertUInt64ToFloat64']();
Module['PromoteFloat32'] = Module['_BinaryenPromoteFloat32']();
Module['DemoteFloat64'] = Module['_BinaryenDemoteFloat64']();
Module['ReinterpretInt32'] = Module['_BinaryenReinterpretInt32']();
Module['ReinterpretInt64'] = Module['_BinaryenReinterpretInt64']();
Module['AddInt32'] = Module['_BinaryenAddInt32']();
Module['SubInt32'] = Module['_BinaryenSubInt32']();
Module['MulInt32'] = Module['_BinaryenMulInt32']();
Module['DivSInt32'] = Module['_BinaryenDivSInt32']();
Module['DivUInt32'] = Module['_BinaryenDivUInt32']();
Module['RemSInt32'] = Module['_BinaryenRemSInt32']();
Module['RemUInt32'] = Module['_BinaryenRemUInt32']();
Module['AndInt32'] = Module['_BinaryenAndInt32']();
Module['OrInt32'] = Module['_BinaryenOrInt32']();
Module['XorInt32'] = Module['_BinaryenXorInt32']();
Module['ShlInt32'] = Module['_BinaryenShlInt32']();
Module['ShrUInt32'] = Module['_BinaryenShrUInt32']();
Module['ShrSInt32'] = Module['_BinaryenShrSInt32']();
Module['RotLInt32'] = Module['_BinaryenRotLInt32']();
Module['RotRInt32'] = Module['_BinaryenRotRInt32']();
Module['EqInt32'] = Module['_BinaryenEqInt32']();
Module['NeInt32'] = Module['_BinaryenNeInt32']();
Module['LtSInt32'] = Module['_BinaryenLtSInt32']();
Module['LtUInt32'] = Module['_BinaryenLtUInt32']();
Module['LeSInt32'] = Module['_BinaryenLeSInt32']();
Module['LeUInt32'] = Module['_BinaryenLeUInt32']();
Module['GtSInt32'] = Module['_BinaryenGtSInt32']();
Module['GtUInt32'] = Module['_BinaryenGtUInt32']();
Module['GeSInt32'] = Module['_BinaryenGeSInt32']();
Module['GeUInt32'] = Module['_BinaryenGeUInt32']();
Module['AddInt64'] = Module['_BinaryenAddInt64']();
Module['SubInt64'] = Module['_BinaryenSubInt64']();
Module['MulInt64'] = Module['_BinaryenMulInt64']();
Module['DivSInt64'] = Module['_BinaryenDivSInt64']();
Module['DivUInt64'] = Module['_BinaryenDivUInt64']();
Module['RemSInt64'] = Module['_BinaryenRemSInt64']();
Module['RemUInt64'] = Module['_BinaryenRemUInt64']();
Module['AndInt64'] = Module['_BinaryenAndInt64']();
Module['OrInt64'] = Module['_BinaryenOrInt64']();
Module['XorInt64'] = Module['_BinaryenXorInt64']();
Module['ShlInt64'] = Module['_BinaryenShlInt64']();
Module['ShrUInt64'] = Module['_BinaryenShrUInt64']();
Module['ShrSInt64'] = Module['_BinaryenShrSInt64']();
Module['RotLInt64'] = Module['_BinaryenRotLInt64']();
Module['RotRInt64'] = Module['_BinaryenRotRInt64']();
Module['EqInt64'] = Module['_BinaryenEqInt64']();
Module['NeInt64'] = Module['_BinaryenNeInt64']();
Module['LtSInt64'] = Module['_BinaryenLtSInt64']();
Module['LtUInt64'] = Module['_BinaryenLtUInt64']();
Module['LeSInt64'] = Module['_BinaryenLeSInt64']();
Module['LeUInt64'] = Module['_BinaryenLeUInt64']();
Module['GtSInt64'] = Module['_BinaryenGtSInt64']();
Module['GtUInt64'] = Module['_BinaryenGtUInt64']();
Module['GeSInt64'] = Module['_BinaryenGeSInt64']();
Module['GeUInt64'] = Module['_BinaryenGeUInt64']();
Module['AddFloat32'] = Module['_BinaryenAddFloat32']();
Module['SubFloat32'] = Module['_BinaryenSubFloat32']();
Module['MulFloat32'] = Module['_BinaryenMulFloat32']();
Module['DivFloat32'] = Module['_BinaryenDivFloat32']();
Module['CopySignFloat32'] = Module['_BinaryenCopySignFloat32']();
Module['MinFloat32'] = Module['_BinaryenMinFloat32']();
Module['MaxFloat32'] = Module['_BinaryenMaxFloat32']();
Module['EqFloat32'] = Module['_BinaryenEqFloat32']();
Module['NeFloat32'] = Module['_BinaryenNeFloat32']();
Module['LtFloat32'] = Module['_BinaryenLtFloat32']();
Module['LeFloat32'] = Module['_BinaryenLeFloat32']();
Module['GtFloat32'] = Module['_BinaryenGtFloat32']();
Module['GeFloat32'] = Module['_BinaryenGeFloat32']();
Module['AddFloat64'] = Module['_BinaryenAddFloat64']();
Module['SubFloat64'] = Module['_BinaryenSubFloat64']();
Module['MulFloat64'] = Module['_BinaryenMulFloat64']();
Module['DivFloat64'] = Module['_BinaryenDivFloat64']();
Module['CopySignFloat64'] = Module['_BinaryenCopySignFloat64']();
Module['MinFloat64'] = Module['_BinaryenMinFloat64']();
Module['MaxFloat64'] = Module['_BinaryenMaxFloat64']();
Module['EqFloat64'] = Module['_BinaryenEqFloat64']();
Module['NeFloat64'] = Module['_BinaryenNeFloat64']();
Module['LtFloat64'] = Module['_BinaryenLtFloat64']();
Module['LeFloat64'] = Module['_BinaryenLeFloat64']();
Module['GtFloat64'] = Module['_BinaryenGtFloat64']();
Module['GeFloat64'] = Module['_BinaryenGeFloat64']();
Module['PageSize'] = Module['_BinaryenPageSize']();
Module['CurrentMemory'] = Module['_BinaryenCurrentMemory']();
Module['GrowMemory'] = Module['_BinaryenGrowMemory']();
Module['HasFeature'] = Module['_BinaryenHasFeature']();
Module['AtomicRMWAdd'] = Module['_BinaryenAtomicRMWAdd']();
Module['AtomicRMWSub'] = Module['_BinaryenAtomicRMWSub']();
Module['AtomicRMWAnd'] = Module['_BinaryenAtomicRMWAnd']();
Module['AtomicRMWOr'] = Module['_BinaryenAtomicRMWOr']();
Module['AtomicRMWXor'] = Module['_BinaryenAtomicRMWXor']();
Module['AtomicRMWXchg'] = Module['_BinaryenAtomicRMWXchg']();

// 'Module' interface
Module['Module'] = function(module) {
  if (!module) module = Module['_BinaryenModuleCreate']();
  this['ptr'] = module;

  // 'Expression' creation
  this['block'] = function(name, children, type) {
    return preserveStack(function() {
      return Module['_BinaryenBlock'](module, name ? strToStack(name) : 0,
                                      i32sToStack(children), children.length,
                                      typeof type !== 'undefined' ? type : Module['none']);
    });
  };
  this['if'] = function(condition, ifTrue, ifFalse) {
    return Module['_BinaryenIf'](module, condition, ifTrue, ifFalse);
  };
  this['loop'] = function(label, body) {
    return preserveStack(function() {
      return Module['_BinaryenLoop'](module, strToStack(label), body);
    });
  };
  this['break'] = this['br'] = function(label, condition, value) {
    return preserveStack(function() {
      return Module['_BinaryenBreak'](module, strToStack(label), condition, value);
    });
  };
  this['br_if'] = function(label, condition, value) {
    assert(condition);
    return this['br'](label, condition, value);
  };
  this['switch'] = function(names, defaultName, condition, value) {
    return preserveStack(function() {
      var namei32s = [];
      names.forEach(function(name) {
        namei32s.push(strToStack(name));
      });
      return Module['_BinaryenSwitch'](module, i32sToStack(namei32s), namei32s.length,
                                       strToStack(defaultName), condition, value);
    });
  };
  this['call'] = function(name, operands, type) {
    return preserveStack(function() {
      return Module['_BinaryenCall'](module, strToStack(name), i32sToStack(operands), operands.length, type);
    });
  };
  this['callImport'] = this['call_import'] = function(name, operands, type) {
    return preserveStack(function() {
      return Module['_BinaryenCallImport'](module, strToStack(name), i32sToStack(operands), operands.length, type);
    });
  };
  this['callIndirect'] = this['call_indirect'] = function(target, operands, type) {
    return preserveStack(function() {
      return Module['_BinaryenCallIndirect'](module, target, i32sToStack(operands), operands.length, strToStack(type));
    });
  };
  this['getLocal'] = this['get_local'] = function(index, type) {
    return Module['_BinaryenGetLocal'](module, index, type);
  };
  this['setLocal'] = this['set_local'] = this['set_local'] = function(index, value) {
    return Module['_BinaryenSetLocal'](module, index, value);
  };
  this['teeLocal'] = this['tee_local'] = function(index, value) {
    return Module['_BinaryenTeeLocal'](module, index, value);
  };
  this['getGlobal'] = this['get_global'] = function(name, type) {
    return Module['_BinaryenGetGlobal'](module, strToStack(name), type);
  }
  this['setGlobal'] = this['set_global'] = function(name, value) {
    return Module['_BinaryenSetGlobal'](module, strToStack(name), value);
  }
  this['currentMemory'] = this['current_memory'] = function() {
    return Module['_BinaryenHost'](module, Module['CurrentMemory']);
  }
  this['growMemory'] = this['grow_memory'] = function(value) {
    return Module['_BinaryenHost'](module, Module['GrowMemory'], null, i32sToStack([value]), 1);
  }
  this['hasFeature'] = this['has_feature'] = function(name) {
    return Module['_BinaryenHost'](module, Module['HasFeature'], strToStack(name));
  }

  // The Const creation API is a little different: we don't want users to
  // need to make their own Literals, as the C API handles them by value,
  // which means we would leak them. Instead, this is the only API that
  // accepts Literals, so fuse it with Literal creation
  var temp = _malloc(16); // a single literal in memory. the LLVM C ABI
                          // makes us pass pointers to this.

  this['i32'] = {
    'load': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 4, true, offset, align, Module['i32'], ptr);
    },
    'load8_s': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 1, true, offset, align, Module['i32'], ptr);
    },
    'load8_u': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 1, false, offset, align, Module['i32'], ptr);
    },
    'load16_s': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 2, true, offset, align, Module['i32'], ptr);
    },
    'load16_u': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 2, false, offset, align, Module['i32'], ptr);
    },
    'store': function(offset, align, ptr, value) {
      return Module['_BinaryenStore'](module, 4, offset, align, ptr, value, Module['i32']);
    },
    'store8': function(offset, align, ptr, value) {
      return Module['_BinaryenStore'](module, 1, offset, align, ptr, value, Module['i32']);
    },
    'store16': function(offset, align, ptr, value) {
      return Module['_BinaryenStore'](module, 2, offset, align, ptr, value, Module['i32']);
    },
    'const': function(x) {
      Module['_BinaryenLiteralInt32'](temp, x);
      return Module['_BinaryenConst'](module, temp);
    },
    'clz': function(value) {
      return Module['_BinaryenUnary'](module, Module['ClzInt32'], value);
    },
    'ctz': function(value) {
      return Module['_BinaryenUnary'](module, Module['CtzInt32'], value);
    },
    'popcnt': function(value) {
      return Module['_BinaryenUnary'](module, Module['PopcntInt32'], value);
    },
    'eqz': function(value) {
      return Module['_BinaryenUnary'](module, Module['EqZInt32'], value);
    },
    'trunc_s': {
      'f32': function(value) {
        return Module['_BinaryenUnary'](module, Module['TruncSFloat32ToInt32'], value);
      },
      'f64': function(value) {
        return Module['_BinaryenUnary'](module, Module['TruncSFloat64ToInt32'], value);
      },
    },
    'trunc_u': {
      'f32': function(value) {
        return Module['_BinaryenUnary'](module, Module['TruncUFloat32ToInt32'], value);
      },
      'f64': function(value) {
        return Module['_BinaryenUnary'](module, Module['TruncUFloat64ToInt32'], value);
      },
    },
    'reinterpret': function(value) {
      return Module['_BinaryenUnary'](module, Module['ReinterpretFloat32'], value);
    },
    'wrap': function(value) {
      return Module['_BinaryenUnary'](module, Module['WrapInt64'], value);
    },
    'add': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['AddInt32'], left, right);
    },
    'sub': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['SubInt32'], left, right);
    },
    'mul': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['MulInt32'], left, right);
    },
    'div_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['DivSInt32'], left, right);
    },
    'div_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['DivUInt32'], left, right);
    },
    'rem_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['RemSInt32'], left, right);
    },
    'rem_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['RemUInt32'], left, right);
    },
    'and': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['AndInt32'], left, right);
    },
    'or': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['OrInt32'], left, right);
    },
    'xor': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['XorInt32'], left, right);
    },
    'shl': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['ShlInt32'], left, right);
    },
    'shr_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['ShrUInt32'], left, right);
    },
    'shr_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['ShrSInt32'], left, right);
    },
    'rotl': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['RotLInt32'], left, right);
    },
    'rotr': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['RotRInt32'], left, right);
    },
    'eq': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['EqInt32'], left, right);
    },
    'ne': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['NeInt32'], left, right);
    },
    'lt_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['LtSInt32'], left, right);
    },
    'lt_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['LtUInt32'], left, right);
    },
    'le_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['LeSInt32'], left, right);
    },
    'le_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['LeUInt32'], left, right);
    },
    'gt_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['GtSInt32'], left, right);
    },
    'gt_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['GtUInt32'], left, right);
    },
    'ge_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['GeSInt32'], left, right);
    },
    'ge_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['GeUInt32'], left, right);
    },
    'atomic':{
      'load': function(offset, ptr) {
        return Module['_BinaryenAtomicLoad'](module, 4, offset, Module['i32'], ptr);
      },
      'load8_u': function(offset, ptr) {
        return Module['_BinaryenAtomicLoad'](module, 1, offset, Module['i32'], ptr);
      },
      'load16_u': function(offset, ptr) {
        return Module['_BinaryenAtomicLoad'](module, 2, offset, Module['i32'], ptr);
      },
      'store': function(offset, ptr, value) {
        return Module['_BinaryenAtomicStore'](module, 4, offset, ptr, value, Module['i32']);
      },
      'store8': function(offset, ptr, value) {
        return Module['_BinaryenAtomicStore'](module, 1, offset, ptr, value, Module['i32']);
      },
      'store16': function(offset, ptr, value) {
        return Module['_BinaryenAtomicStore'](module, 2, offset, ptr, value, Module['i32']);
      },
      'rmw': {
        'add': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAdd'], 4, offset, ptr, value, Module['i32']);
        },
        'sub': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWSub'], 4, offset, ptr, value, Module['i32']);
        },
        'and': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAnd'], 4, offset, ptr, value, Module['i32']);
        },
        'or': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWOr'], 4, offset, ptr, value, Module['i32']);
        },
        'xor': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXor'], 4, offset, ptr, value, Module['i32']);
        },
        'xchg': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXchg'], 4, offset, ptr, value, Module['i32']);
        },
        'cmpxchg': function(offset, ptr, expected, replacement) {
          return Module['_BinaryenAtomicCmpxchg'](module, 4, offset, ptr, expected, replacement, Module['i32'])
        },
      },
      'rmw8_u': {
        'add': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAdd'], 1, offset, ptr, value, Module['i32']);
        },
        'sub': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWSub'], 1, offset, ptr, value, Module['i32']);
        },
        'and': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAnd'], 1, offset, ptr, value, Module['i32']);
        },
        'or': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWOr'], 1, offset, ptr, value, Module['i32']);
        },
        'xor': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXor'], 1, offset, ptr, value, Module['i32']);
        },
        'xchg': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXchg'], 1, offset, ptr, value, Module['i32']);
        },
        'cmpxchg': function(offset, ptr, expected, replacement) {
          return Module['_BinaryenAtomicCmpxchg'](module, 1, offset, ptr, expected, replacement, Module['i32'])
        },
      },
      'rmw16_u': {
        'add': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAdd'], 2, offset, ptr, value, Module['i32']);
        },
        'sub': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWSub'], 2, offset, ptr, value, Module['i32']);
        },
        'and': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAnd'], 2, offset, ptr, value, Module['i32']);
        },
        'or': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWOr'], 2, offset, ptr, value, Module['i32']);
        },
        'xor': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXor'], 2, offset, ptr, value, Module['i32']);
        },
        'xchg': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXchg'], 2, offset, ptr, value, Module['i32']);
        },
        'cmpxchg': function(offset, ptr, expected, replacement) {
          return Module['_BinaryenAtomicCmpxchg'](module, 2, offset, ptr, expected, replacement, Module['i32'])
        },
      },
    },
    'wait': function(ptr, expected, timeout) {
      return Module['_BinaryenAtomicWait'](module, ptr, expected, timeout, Module['i32']);
    },
  };

  this['i64'] = {
    'load': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 8, true, offset, align, Module['i64'], ptr);
    },
    'load8_s': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 1, true, offset, align, Module['i64'], ptr);
    },
    'load8_u': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 1, false, offset, align, Module['i64'], ptr);
    },
    'load16_s': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 2, true, offset, align, Module['i64'], ptr);
    },
    'load16_u': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 2, false, offset, align, Module['i64'], ptr);
    },
    'load32_s': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 4, true, offset, align, Module['i64'], ptr);
    },
    'load32_u': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 4, false, offset, align, Module['i64'], ptr);
    },
    'store': function(offset, align, ptr, value) {
      return Module['_BinaryenStore'](module, 8, offset, align, ptr, value, Module['i64']);
    },
    'store8': function(offset, align, ptr, value) {
      return Module['_BinaryenStore'](module, 1, offset, align, ptr, value, Module['i64']);
    },
    'store16': function(offset, align, ptr, value) {
      return Module['_BinaryenStore'](module, 2, offset, align, ptr, value, Module['i64']);
    },
    'store32': function(offset, align, ptr, value) {
      return Module['_BinaryenStore'](module, 4, offset, align, ptr, value, Module['i64']);
    },
    'const': function(x, y) {
      Module['_BinaryenLiteralInt64'](temp, x, y);
      return Module['_BinaryenConst'](module, temp);
    },
    'clz': function(value) {
      return Module['_BinaryenUnary'](module, Module['ClzInt64'], value);
    },
    'ctz': function(value) {
      return Module['_BinaryenUnary'](module, Module['CtzInt64'], value);
    },
    'popcnt': function(value) {
      return Module['_BinaryenUnary'](module, Module['PopcntInt64'], value);
    },
    'eqz': function(value) {
      return Module['_BinaryenUnary'](module, Module['EqZInt64'], value);
    },
    'trunc_s': {
      'f32': function(value) {
        return Module['_BinaryenUnary'](module, Module['TruncSFloat32ToInt64'], value);
      },
      'f64': function(value) {
        return Module['_BinaryenUnary'](module, Module['TruncSFloat64ToInt64'], value);
      },
    },
    'trunc_u': {
      'f32': function(value) {
        return Module['_BinaryenUnary'](module, Module['TruncUFloat32ToInt64'], value);
      },
      'f64': function(value) {
        return Module['_BinaryenUnary'](module, Module['TruncUFloat64ToInt64'], value);
      },
    },
    'reinterpret': function(value) {
      return Module['_BinaryenUnary'](module, Module['ReinterpretFloat64'], value);
    },
    'extend_s': function(value) {
      return Module['_BinaryenUnary'](module, Module['ExtendSInt32'], value);
    },
    'extend_u': function(value) {
      return Module['_BinaryenUnary'](module, Module['ExtendUInt32'], value);
    },
    'add': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['AddInt64'], left, right);
    },
    'sub': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['SubInt64'], left, right);
    },
    'mul': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['MulInt64'], left, right);
    },
    'div_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['DivSInt64'], left, right);
    },
    'div_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['DivUInt64'], left, right);
    },
    'rem_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['RemSInt64'], left, right);
    },
    'rem_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['RemUInt64'], left, right);
    },
    'and': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['AndInt64'], left, right);
    },
    'or': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['OrInt64'], left, right);
    },
    'xor': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['XorInt64'], left, right);
    },
    'shl': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['ShlInt64'], left, right);
    },
    'shr_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['ShrUInt64'], left, right);
    },
    'shr_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['ShrSInt64'], left, right);
    },
    'rotl': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['RotLInt64'], left, right);
    },
    'rotr': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['RotRInt64'], left, right);
    },
    'eq': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['EqInt64'], left, right);
    },
    'ne': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['NeInt64'], left, right);
    },
    'lt_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['LtSInt64'], left, right);
    },
    'lt_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['LtUInt64'], left, right);
    },
    'le_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['LeSInt64'], left, right);
    },
    'le_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['LeUInt64'], left, right);
    },
    'gt_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['GtSInt64'], left, right);
    },
    'gt_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['GtUInt64'], left, right);
    },
    'ge_s': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['GeSInt64'], left, right);
    },
    'ge_u': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['GeUInt64'], left, right);
    },
    'atomic':{
      'load': function(offset, ptr) {
        return Module['_BinaryenAtomicLoad'](module, 8, offset, Module['i64'], ptr);
      },
      'load8_u': function(offset, ptr) {
        return Module['_BinaryenAtomicLoad'](module, 1, offset, Module['i64'], ptr);
      },
      'load16_u': function(offset, ptr) {
        return Module['_BinaryenAtomicLoad'](module, 2, offset, Module['i64'], ptr);
      },
      'load32_u': function(offset, ptr) {
        return Module['_BinaryenAtomicLoad'](module, 4, offset, Module['i64'], ptr);
      },
      'store': function(offset, ptr, value) {
        return Module['_BinaryenAtomicStore'](module, 8, offset, ptr, value, Module['i64']);
      },
      'store8': function(offset, ptr, value) {
        return Module['_BinaryenAtomicStore'](module, 1, offset, ptr, value, Module['i64']);
      },
      'store16': function(offset, ptr, value) {
        return Module['_BinaryenAtomicStore'](module, 2, offset, ptr, value, Module['i64']);
      },
      'store32': function(offset, ptr, value) {
        return Module['_BinaryenAtomicStore'](module, 4, offset, ptr, value, Module['i64']);
      },
      'rmw': {
        'add': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAdd'], 8, offset, ptr, value, Module['i64']);
        },
        'sub': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWSub'], 8, offset, ptr, value, Module['i64']);
        },
        'and': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAnd'], 8, offset, ptr, value, Module['i64']);
        },
        'or': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWOr'], 8, offset, ptr, value, Module['i64']);
        },
        'xor': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXor'], 8, offset, ptr, value, Module['i64']);
        },
        'xchg': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXchg'], 8, offset, ptr, value, Module['i64']);
        },
        'cmpxchg': function(offset, ptr, expected, replacement) {
          return Module['_BinaryenAtomicCmpxchg'](module, 8, offset, ptr, expected, replacement, Module['i64'])
        },
      },
      'rmw8_u': {
        'add': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAdd'], 1, offset, ptr, value, Module['i64']);
        },
        'sub': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWSub'], 1, offset, ptr, value, Module['i64']);
        },
        'and': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAnd'], 1, offset, ptr, value, Module['i64']);
        },
        'or': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWOr'], 1, offset, ptr, value, Module['i64']);
        },
        'xor': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXor'], 1, offset, ptr, value, Module['i64']);
        },
        'xchg': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXchg'], 1, offset, ptr, value, Module['i64']);
        },
        'cmpxchg': function(offset, ptr, expected, replacement) {
          return Module['_BinaryenAtomicCmpxchg'](module, 1, offset, ptr, expected, replacement, Module['i64'])
        },
      },
      'rmw16_u': {
        'add': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAdd'], 2, offset, ptr, value, Module['i64']);
        },
        'sub': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWSub'], 2, offset, ptr, value, Module['i64']);
        },
        'and': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAnd'], 2, offset, ptr, value, Module['i64']);
        },
        'or': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWOr'], 2, offset, ptr, value, Module['i64']);
        },
        'xor': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXor'], 2, offset, ptr, value, Module['i64']);
        },
        'xchg': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXchg'], 2, offset, ptr, value, Module['i64']);
        },
        'cmpxchg': function(offset, ptr, expected, replacement) {
          return Module['_BinaryenAtomicCmpxchg'](module, 2, offset, ptr, expected, replacement, Module['i64'])
        },
      },
      'rmw32_u': {
        'add': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAdd'], 4, offset, ptr, value, Module['i64']);
        },
        'sub': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWSub'], 4, offset, ptr, value, Module['i64']);
        },
        'and': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWAnd'], 4, offset, ptr, value, Module['i64']);
        },
        'or': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWOr'], 4, offset, ptr, value, Module['i64']);
        },
        'xor': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXor'], 4, offset, ptr, value, Module['i64']);
        },
        'xchg': function(offset, ptr, value) {
          return Module['_BinaryenAtomicRMW'](module, Module['AtomicRMWXchg'], 4, offset, ptr, value, Module['i64']);
        },
        'cmpxchg': function(offset, ptr, expected, replacement) {
          return Module['_BinaryenAtomicCmpxchg'](module, 4, offset, ptr, expected, replacement, Module['i64'])
        },
      },
    },
    'wait': function(ptr, expected, timeout) {
      return Module['_BinaryenAtomicWait'](module, ptr, expected, timeout, Module['i64']);
    },
  };

  this['f32'] = {
    'load': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 4, true, offset, align, Module['f32'], ptr);
    },
    'store': function(offset, align, ptr, value) {
      return Module['_BinaryenStore'](module, 4, offset, align, ptr, value, Module['f32']);
    },
    'const': function(x) {
      Module['_BinaryenLiteralFloat32'](temp, x);
      return Module['_BinaryenConst'](module, temp);
    },
    'const_bits': function(x) {
      Module['_BinaryenLiteralFloat32Bits'](temp, x);
      return Module['_BinaryenConst'](module, temp);
    },
    'neg': function(value) {
      return Module['_BinaryenUnary'](module, Module['NegFloat32'], value);
    },
    'abs': function(value) {
      return Module['_BinaryenUnary'](module, Module['AbsFloat32'], value);
    },
    'ceil': function(value) {
      return Module['_BinaryenUnary'](module, Module['CeilFloat32'], value);
    },
    'floor': function(value) {
      return Module['_BinaryenUnary'](module, Module['FloorFloat32'], value);
    },
    'trunc': function(value) {
      return Module['_BinaryenUnary'](module, Module['TruncFloat32'], value);
    },
    'nearest': function(value) {
      return Module['_BinaryenUnary'](module, Module['NearestFloat32'], value);
    },
    'sqrt': function(value) {
      return Module['_BinaryenUnary'](module, Module['SqrtFloat32'], value);
    },
    'reinterpret': function(value) {
      return Module['_BinaryenUnary'](module, Module['ReinterpretInt32'], value);
    },
    'convert_s': {
      'i32': function(value) {
        return Module['_BinaryenUnary'](module, Module['ConvertSInt32ToFloat32'], value);
      },
      'i64': function(value) {
        return Module['_BinaryenUnary'](module, Module['ConvertSInt64ToFloat32'], value);
      },
    },
    'convert_u': {
      'i32': function(value) {
        return Module['_BinaryenUnary'](module, Module['ConvertUInt32ToFloat32'], value);
      },
      'i64': function(value) {
        return Module['_BinaryenUnary'](module, Module['ConvertUInt64ToFloat32'], value);
      },
    },
    'demote': function(value) {
      return Module['_BinaryenUnary'](module, Module['DemoteFloat64'], value);
    },
    'add': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['AddFloat32'], left, right);
    },
    'sub': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['SubFloat32'], left, right);
    },
    'mul': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['MulFloat32'], left, right);
    },
    'div': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['DivFloat32'], left, right);
    },
    'copysign': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['CopySignFloat32'], left, right);
    },
    'min': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['MinFloat32'], left, right);
    },
    'max': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['MaxFloat32'], left, right);
    },
    'eq': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['EqFloat32'], left, right);
    },
    'ne': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['NeFloat32'], left, right);
    },
    'lt': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['LtFloat32'], left, right);
    },
    'le': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['LeFloat32'], left, right);
    },
    'gt': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['GtFloat32'], left, right);
    },
    'ge': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['GeFloat32'], left, right);
    },
  };

  this['f64'] = {
    'load': function(offset, align, ptr) {
      return Module['_BinaryenLoad'](module, 8, true, offset, align, Module['f64'], ptr);
    },
    'store': function(offset, align, ptr, value) {
      return Module['_BinaryenStore'](module, 8, offset, align, ptr, value, Module['f64']);
    },
    'const': function(x) {
      Module['_BinaryenLiteralFloat64'](temp, x);
      return Module['_BinaryenConst'](module, temp);
    },
    'const_bits': function(x, y) {
      Module['_BinaryenLiteralFloat64Bits'](temp, x, y);
      return Module['_BinaryenConst'](module, temp);
    },
    'neg': function(value) {
      return Module['_BinaryenUnary'](module, Module['NegFloat64'], value);
    },
    'abs': function(value) {
      return Module['_BinaryenUnary'](module, Module['AbsFloat64'], value);
    },
    'ceil': function(value) {
      return Module['_BinaryenUnary'](module, Module['CeilFloat64'], value);
    },
    'floor': function(value) {
      return Module['_BinaryenUnary'](module, Module['FloorFloat64'], value);
    },
    'trunc': function(value) {
      return Module['_BinaryenUnary'](module, Module['TruncFloat64'], value);
    },
    'nearest': function(value) {
      return Module['_BinaryenUnary'](module, Module['NearestFloat64'], value);
    },
    'sqrt': function(value) {
      return Module['_BinaryenUnary'](module, Module['SqrtFloat64'], value);
    },
    'reinterpret': function(value) {
      return Module['_BinaryenUnary'](module, Module['ReinterpretInt64'], value);
    },
    'convert_s': {
      'i32': function(value) {
        return Module['_BinaryenUnary'](module, Module['ConvertSInt32ToFloat64'], value);
      },
      'i64': function(value) {
        return Module['_BinaryenUnary'](module, Module['ConvertSInt64ToFloat64'], value);
      },
    },
    'convert_u': {
      'i32': function(value) {
        return Module['_BinaryenUnary'](module, Module['ConvertUInt32ToFloat64'], value);
      },
      'i64': function(value) {
        return Module['_BinaryenUnary'](module, Module['ConvertUInt64ToFloat64'], value);
      },
    },
    'promote': function(value) {
      return Module['_BinaryenUnary'](module, Module['PromoteFloat32'], value);
    },
    'add': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['AddFloat64'], left, right);
    },
    'sub': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['SubFloat64'], left, right);
    },
    'mul': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['MulFloat64'], left, right);
    },
    'div': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['DivFloat64'], left, right);
    },
    'copysign': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['CopySignFloat64'], left, right);
    },
    'min': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['MinFloat64'], left, right);
    },
    'max': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['MaxFloat64'], left, right);
    },
    'eq': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['EqFloat64'], left, right);
    },
    'ne': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['NeFloat64'], left, right);
    },
    'lt': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['LtFloat64'], left, right);
    },
    'le': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['LeFloat64'], left, right);
    },
    'gt': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['GtFloat64'], left, right);
    },
    'ge': function(left, right) {
      return Module['_BinaryenBinary'](module, Module['GeFloat64'], left, right);
    },
  };

  this['select'] = function(condition, ifTrue, ifFalse) {
    return Module['_BinaryenSelect'](module, condition, ifTrue, ifFalse);
  };
  this['drop'] = function(value) {
    return Module['_BinaryenDrop'](module, value);
  };
  this['return'] = function(value) {
    return Module['_BinaryenReturn'](module, value);
  };
  this['host'] = function(op, name, operands) {
    if (!operands) operands = [];
    return preserveStack(function() {
      return Module['_BinaryenHost'](module, op, strToStack(name), i32sToStack(operands), operands.length);
    });
  };
  this['nop'] = function() {
    return Module['_BinaryenNop'](module);
  };
  this['unreachable'] = function() {
    return Module['_BinaryenUnreachable'](module);
  };
  this['wake'] = function(ptr, wakeCount) {
    return Module['_BinaryenAtomicWake'](module, ptr, wakeCount);
  };

  // 'Module' operations
  this['addFunctionType'] = function(name, result, paramTypes) {
    if (!paramTypes) paramTypes = [];
    return preserveStack(function() {
      return Module['_BinaryenAddFunctionType'](module, strToStack(name), result,
                                                i32sToStack(paramTypes), paramTypes.length);
    });
  };
  this['getFunctionTypeBySignature'] = function(result, paramTypes) {
    if (!paramTypes) paramTypes = [];
    return preserveStack(function() {
      return Module['_BinaryenGetFunctionTypeBySignature'](module, result,
                                                           i32sToStack(paramTypes), paramTypes.length);
    });
  };
  this['addFunction'] = function(name, functionType, varTypes, body) {
    return preserveStack(function() {
      return Module['_BinaryenAddFunction'](module, strToStack(name), functionType, i32sToStack(varTypes), varTypes.length, body);
    });
  };
  this['getFunction'] = function(name) {
    return preserveStack(function() {
      return Module['_BinaryenGetFunction'](module, strToStack(name));
    });
  };
  this['removeFunction'] = function(name) {
    return preserveStack(function() {
      return Module['_BinaryenRemoveFunction'](module, strToStack(name));
    });
  };
  this['addGlobal'] = function(name, type, mutable, init) {
    return preserveStack(function() {
      return Module['_BinaryenAddGlobal'](module, strToStack(name), type, mutable, init);
    });
  }
  this['addImport'] = // deprecated
  this['addFunctionImport'] = function(internalName, externalModuleName, externalBaseName, functionType) {
    return preserveStack(function() {
      return Module['_BinaryenAddFunctionImport'](module, strToStack(internalName), strToStack(externalModuleName), strToStack(externalBaseName), functionType);
    });
  };
  this['addTableImport'] = function(internalName, externalModuleName, externalBaseName) {
    return preserveStack(function() {
      return Module['_BinaryenAddTableImport'](module, strToStack(internalName), strToStack(externalModuleName), strToStack(externalBaseName));
    });
  };
  this['addMemoryImport'] = function(internalName, externalModuleName, externalBaseName) {
    return preserveStack(function() {
      return Module['_BinaryenAddMemoryImport'](module, strToStack(internalName), strToStack(externalModuleName), strToStack(externalBaseName));
    });
  };
  this['addGlobalImport'] = function(internalName, externalModuleName, externalBaseName, globalType) {
    return preserveStack(function() {
      return Module['_BinaryenAddGlobalImport'](module, strToStack(internalName), strToStack(externalModuleName), strToStack(externalBaseName), globalType);
    });
  };
  this['removeImport'] = function(internalName) {
    return preserveStack(function() {
      return Module['_BinaryenRemoveImport'](module, strToStack(internalName));
    });
  };
  this['addExport'] = // deprecated
  this['addFunctionExport'] = function(internalName, externalName) {
    return preserveStack(function() {
      return Module['_BinaryenAddFunctionExport'](module, strToStack(internalName), strToStack(externalName));
    });
  };
  this['addTableExport'] = function(internalName, externalName) {
    return preserveStack(function() {
      return Module['_BinaryenAddTableExport'](module, strToStack(internalName), strToStack(externalName));
    });
  };
  this['addMemoryExport'] = function(internalName, externalName) {
    return preserveStack(function() {
      return Module['_BinaryenAddMemoryExport'](module, strToStack(internalName), strToStack(externalName));
    });
  };
  this['addGlobalExport'] = function(internalName, externalName) {
    return preserveStack(function() {
      return Module['_BinaryenAddGlobalExport'](module, strToStack(internalName), strToStack(externalName));
    });
  };
  this['removeExport'] = function(externalName) {
    return preserveStack(function() {
      return Module['_BinaryenRemoveExport'](module, strToStack(externalName));
    });
  };
  this['setFunctionTable'] = function(funcs) {
    return preserveStack(function() {
      return Module['_BinaryenSetFunctionTable'](module, i32sToStack(funcs), funcs.length);
    });
  };
  this['setMemory'] = function(initial, maximum, exportName, segments) {
    // segments are assumed to be { offset: expression ref, data: array of 8-bit data }
    if (!segments) segments = [];
    return preserveStack(function() {
      return Module['_BinaryenSetMemory'](
        module, initial, maximum, strToStack(exportName),
        i32sToStack(
          segments.map(function(segment) {
            return allocate(segment.data, 'i8', ALLOC_STACK);
          })
        ),
        i32sToStack(
          segments.map(function(segment) {
            return segment.offset;
          })
        ),
        i32sToStack(
          segments.map(function(segment) {
            return segment.data.length;
          })
        ),
        segments.length
      );
    });
  };
  this['setStart'] = function(start) {
    return Module['_BinaryenSetStart'](module, start);
  };
  this['emitText'] = function() {
    var old = Module['print'];
    var ret = '';
    Module['print'] = function(x) { ret += x + '\n' };
    Module['_BinaryenModulePrint'](module);
    Module['print'] = old;
    return ret;
  };
  this['emitAsmjs'] = function() {
    var old = Module['print'];
    var ret = '';
    Module['print'] = function(x) { ret += x + '\n' };
    Module['_BinaryenModulePrintAsmjs'](module);
    Module['print'] = old;
    return ret;
  };
  this['validate'] = function() {
    return Module['_BinaryenModuleValidate'](module);
  };
  this['optimize'] = function() {
    return Module['_BinaryenModuleOptimize'](module);
  };
  this['optimizeFunction'] = function(func) {
    if (typeof func === 'string') func = this['getFunction'](func);
    return Module['_BinaryenFunctionOptimize'](func, module);
  };
  this['runPasses'] = function(passes) {
    return preserveStack(function() {
      return Module['_BinaryenModuleRunPasses'](module, i32sToStack(
        passes.map(strToStack)
      ), passes.length);
    });
  };
  this['runPassesOnFunction'] = function(func, passes) {
    if (typeof func === 'string') func = this['getFunction'](func);
    return preserveStack(function() {
      return Module['_BinaryenFunctionRunPasses'](func, module, i32sToStack(
        passes.map(strToStack)
      ), passes.length);
    });
  };
  this['autoDrop'] = function() {
    return Module['_BinaryenModuleAutoDrop'](module);
  };
  this['dispose'] = function() {
    Module['_BinaryenModuleDispose'](module);
  };
  this['emitBinary'] = function(sourceMapUrl) {
    return preserveStack(function() {
      Module['_BinaryenModuleAllocateAndWrite'](temp, module, strToStack(sourceMapUrl));
      var binaryPtr    = HEAPU32[ temp >>> 2     ];
      var binaryBytes  = HEAPU32[(temp >>> 2) + 1];
      var sourceMapPtr = HEAPU32[(temp >>> 2) + 2];
      try {
        var buffer = new Uint8Array(binaryBytes);
        buffer.set(HEAPU8.subarray(binaryPtr, binaryPtr + binaryBytes));
        return typeof sourceMapUrl === 'undefined'
          ? buffer
          : { 'binary': buffer, 'sourceMap': Pointer_stringify(sourceMapPtr) };
      } finally {
        _free(binaryPtr);
        if (sourceMapPtr) _free(sourceMapPtr);
      }
    });
  };
  this['interpret'] = function() {
    return Module['_BinaryenModuleInterpret'](module);
  };
  this['addDebugInfoFileName'] = function(filename) {
    return preserveStack(function() {
      return Module['_BinaryenModuleAddDebugInfoFileName'](module, strToStack(filename));
    });
  };
  this['getDebugInfoFileName'] = function(index) {
    return Pointer_stringify(Module['_BinaryenModuleGetDebugInfoFileName'](module, index));
  };
  this['setDebugLocation'] = function(func, expr, fileIndex, lineNumber, columnNumber) {
    return Module['_BinaryenFunctionSetDebugLocation'](func, expr, fileIndex, lineNumber, columnNumber);
  };
};

// 'Relooper' interface
Module['Relooper'] = function(relooper) {
  if (!relooper) relooper = Module['_RelooperCreate']();
  this.ptr = relooper;

  this['addBlock'] = function(code) {
    return Module['_RelooperAddBlock'](relooper, code);
  };
  this['addBranch'] = function(from, to, condition, code) {
    return Module['_RelooperAddBranch'](from, to, condition, code);
  };
  this['addBlockWithSwitch'] = function(code, condition) {
    return Module['_RelooperAddBlockWithSwitch'](relooper, code, condition);
  };
  this['addBranchForSwitch'] = function(from, to, indexes, code) {
    return preserveStack(function() {
      return Module['_RelooperAddBranchForSwitch'](from, to, i32sToStack(indexes), indexes.length, code);
    });
  };
  this['renderAndDispose'] = function(entry, labelHelper, module) {
    return Module['_RelooperRenderAndDispose'](relooper, entry, labelHelper, module['ptr']);
  };
};

function getAllNested(ref, numFn, getFn) {
  var num = numFn(ref);
  var ret = new Array(num);
  for (var i = 0; i < num; ++i) ret[i] = getFn(ref, i);
  return ret;
}

// Gets the specific id of an 'Expression'
Module['getExpressionId'] = function(expr) {
  return Module['_BinaryenExpressionGetId'](expr);
};

// Gets the result type of an 'Expression'
Module['getExpressionType'] = function(expr) {
  return Module['_BinaryenExpressionGetType'](expr);
};

// Obtains information about an 'Expression'
Module['getExpressionInfo'] = function(expr) {
  var id = Module['_BinaryenExpressionGetId'](expr);
  var type = Module['_BinaryenExpressionGetType'](expr);
  switch (id) {
    case Module['BlockId']:
      return {
        'id': id,
        'type': type,
        'name': Pointer_stringify(Module['_BinaryenBlockGetName'](expr)),
        'children': getAllNested(expr, Module['_BinaryenBlockGetNumChildren'], Module['_BinaryenBlockGetChild'])
      };
    case Module['IfId']:
      return {
        'id': id,
        'type': type,
        'condition': Module['_BinaryenIfGetCondition'](expr),
        'ifTrue': Module['_BinaryenIfGetIfTrue'](expr),
        'ifFalse': Module['_BinaryenIfGetIfFalse'](expr)
      };
    case Module['LoopId']:
      return {
        'id': id,
        'type': type,
        'name': Pointer_stringify(Module['_BinaryenLoopGetName'](expr)),
        'body': Module['_BinaryenLoopGetBody'](expr)
      };
    case Module['BreakId']:
      return {
        'id': id,
        'type': type,
        'name': Pointer_stringify(Module['_BinaryenBreakGetName'](expr)),
        'condition': Module['_BinaryenBreakGetCondition'](expr),
        'value': Module['_BinaryenBreakGetValue'](expr)
      };
    case Module['SwitchId']:
      return {
        'id': id,
        'type': type,
        'names': getAllNested(expr, Module['_BinaryenSwitchGetNumNames'], Module['_BinaryenSwitchGetName']).map(Pointer_stringify),
        'defaultName': Pointer_stringify(Module['_BinaryenSwitchGetDefaultName'](expr)),
        'condition': Module['_BinaryenSwitchGetCondition'](expr),
        'value': Module['_BinaryenSwitchGetValue'](expr)
      };
    case Module['CallId']:
      return {
        'id': id,
        'type': type,
        'target': Pointer_stringify(Module['_BinaryenCallGetTarget'](expr)),
        'operands': getAllNested(expr, Module[ '_BinaryenCallGetNumOperands'], Module['_BinaryenCallGetOperand'])
      };
    case Module['CallImportId']:
      return {
        'id': id,
        'type': type,
        'target': Pointer_stringify(Module['_BinaryenCallImportGetTarget'](expr)),
        'operands': getAllNested(expr, Module['_BinaryenCallImportGetNumOperands'], Module['_BinaryenCallImportGetOperand']),
      };
    case Module['CallIndirectId']:
      return {
        'id': id,
        'type': type,
        'target': Module['_BinaryenCallIndirectGetTarget'](expr),
        'operands': getAllNested(expr, Module['_BinaryenCallIndirectGetNumOperands'], Module['_BinaryenCallIndirectGetOperand'])
      };
    case Module['GetLocalId']:
      return {
        'id': id,
        'type': type,
        'index': Module['_BinaryenGetLocalGetIndex'](expr)
      };
    case Module['SetLocalId']:
      return {
        'id': id,
        'type': type,
        'isTee': Boolean(Module['_BinaryenSetLocalIsTee'](expr)),
        'index': Module['_BinaryenSetLocalGetIndex'](expr),
        'value': Module['_BinaryenSetLocalGetValue'](expr)
      };
    case Module['GetGlobalId']:
      return {
        'id': id,
        'type': type,
        'name': Pointer_stringify(Module['_BinaryenGetGlobalGetName'](expr))
      };
    case Module['SetGlobalId']:
      return {
        'id': id,
        'type': type,
        'name': Pointer_stringify(Module['_BinaryenSetGlobalGetName'](expr)),
        'value': Module['_BinaryenSetGlobalGetValue'](expr)
      };
    case Module['LoadId']:
      return {
        'id': id,
        'type': type,
        'isAtomic': Boolean(Module['_BinaryenLoadIsAtomic'](expr)),
        'isSigned': Boolean(Module['_BinaryenLoadIsSigned'](expr)),
        'offset': Module['_BinaryenLoadGetOffset'](expr),
        'bytes': Module['_BinaryenLoadGetBytes'](expr),
        'align': Module['_BinaryenLoadGetAlign'](expr),
        'ptr': Module['_BinaryenLoadGetPtr'](expr)
      };
    case Module['StoreId']:
      return {
        'id': id,
        'type': type,
        'isAtomic': Boolean(Module['_BinaryenStoreIsAtomic'](expr)),
        'offset': Module['_BinaryenStoreGetOffset'](expr),
        'bytes': Module['_BinaryenStoreGetBytes'](expr),
        'align': Module['_BinaryenStoreGetAlign'](expr),
        'ptr': Module['_BinaryenStoreGetPtr'](expr),
        'value': Module['_BinaryenStoreGetValue'](expr)
      };
    case Module['ConstId']: {
      var value;
      switch (type) {
        case Module['i32']: value = Module['_BinaryenConstGetValueI32'](expr); break;
        case Module['i64']: value = { 'low': Module['_BinaryenConstGetValueI64Low'](expr), 'high': Module['_BinaryenConstGetValueI64High'](expr) }; break;
        case Module['f32']: value = Module['_BinaryenConstGetValueF32'](expr); break;
        case Module['f64']: value =  Module['_BinaryenConstGetValueF64'](expr); break;
        default: throw Error('unexpected type: ' + type);
      }
      return {
        'id': id,
        'type': type,
        'value': value
      };
    }
    case Module['UnaryId']:
      return {
        'id': id,
        'type': type,
        'op': Module['_BinaryenUnaryGetOp'](expr),
        'value': Module['_BinaryenUnaryGetValue'](expr)
      };
    case Module['BinaryId']:
      return {
        'id': id,
        'type': type,
        'op': Module['_BinaryenBinaryGetOp'](expr),
        'left': Module['_BinaryenBinaryGetLeft'](expr),
        'right':  Module['_BinaryenBinaryGetRight'](expr)
      };
    case Module['SelectId']:
      return {
        'id': id,
        'type': type,
        'ifTrue': Module['_BinaryenSelectGetIfTrue'](expr),
        'ifFalse': Module['_BinaryenSelectGetIfFalse'](expr),
        'condition': Module['_BinaryenSelectGetCondition'](expr)
      };
    case Module['DropId']:
      return {
        'id': id,
        'type': type,
        'value': Module['_BinaryenDropGetValue'](expr)
      };
    case Module['ReturnId']:
      return {
        'id': id,
        'type': type,
        'value': Module['_BinaryenReturnGetValue'](expr)
      };
    case Module['NopId']:
    case Module['UnreachableId']:
      return {
        'id': id,
        'type': type
      };
    case Module['HostId']:
      return {
        'id': id,
        'type': type,
        'op': Module['_BinaryenHostGetOp'](expr),
        'nameOperand': Pointer_stringify(Module['_BinaryenHostGetNameOperand'](expr)),
        'operands': getAllNested(expr, Module['_BinaryenHostGetNumOperands'], Module['_BinaryenHostGetOperand'])
      };
    case Module['AtomicRMWId']:
      return {
        'id': id,
        'type': type,
        'op': Module['_BinaryenAtomicRMWGetOp'](expr),
        'bytes': Module['_BinaryenAtomicRMWGetBytes'](expr),
        'offset': Module['_BinaryenAtomicRMWGetOffset'](expr),
        'ptr': Module['_BinaryenAtomicRMWGetPtr'](expr),
        'value': Module['_BinaryenAtomicRMWGetValue'](expr)
      };
    case Module['AtomicCmpxchgId']:
      return {
        'id': id,
        'type': type,
        'bytes': Module['_BinaryenAtomicCmpxchgGetBytes'](expr),
        'offset': Module['_BinaryenAtomicCmpxchgGetOffset'](expr),
        'ptr': Module['_BinaryenAtomicCmpxchgGetPtr'](expr),
        'expected': Module['_BinaryenAtomicCmpxchgGetExpected'](expr),
        'replacement': Module['_BinaryenAtomicCmpxchgGetReplacement'](expr)
      };
    case Module['AtomicWaitId']:
      return {
        'id': id,
        'type': type,
        'ptr': Module['_BinaryenAtomicWaitGetPtr'](expr),
        'expected': Module['_BinaryenAtomicWaitGetExpected'](expr),
        'timeout': Module['_BinaryenAtomicWaitGetTimeout'](expr),
        'expectedType': Module['_BinaryenAtomicWaitGetExpectedType'](expr)
      };
    case Module['AtomicWakeId']:
      return {
        'id': id,
        'type': type,
        'ptr': Module['_BinaryenAtomicWakeGetPtr'](expr),
        'wakeCount': Module['_BinaryenAtomicWakeGetWakeCount'](expr)
      };
    default:
      throw Error('unexpected id: ' + id);
  }
};

// Obtains information about a 'FunctionType'
Module['getFunctionTypeInfo'] = function(func) {
  return {
    'name': Pointer_stringify(Module['_BinaryenFunctionTypeGetName'](func)),
    'params': getAllNested(func, Module['_BinaryenFunctionTypeGetNumParams'], Module['_BinaryenFunctionTypeGetParam']),
    'result': Module['_BinaryenFunctionTypeGetResult'](func)
  };
};

// Obtains information about a 'Function'
Module['getFunctionInfo'] = function(func) {
  return {
    'name': Pointer_stringify(Module['_BinaryenFunctionGetName'](func)),
    'type': Pointer_stringify(Module['_BinaryenFunctionGetType'](func)),
    'params': getAllNested(func, Module['_BinaryenFunctionGetNumParams'], Module['_BinaryenFunctionGetParam']),
    'result': Module['_BinaryenFunctionGetResult'](func),
    'vars': getAllNested(func, Module['_BinaryenFunctionGetNumVars'], Module['_BinaryenFunctionGetVar']),
    'body': Module['_BinaryenFunctionGetBody'](func)
  };
};

// Obtains information about an 'Import'
Module['getImportInfo'] = function(import_) {
  return {
    'kind': Module['_BinaryenImportGetKind'](import_),
    'module': Pointer_stringify(Module['_BinaryenImportGetModule'](import_)),
    'base': Pointer_stringify(Module['_BinaryenImportGetBase'](import_)),
    'name': Pointer_stringify(Module['_BinaryenImportGetName'](import_)),
    'globalType': Module['_BinaryenImportGetGlobalType'](import_),
    'functionType': Pointer_stringify(Module['_BinaryenImportGetFunctionType'](import_))
  };
};

// Obtains information about an 'Export'
Module['getExportInfo'] = function(export_) {
  return {
    'kind': Module['_BinaryenExportGetKind'](export_),
    'name': Pointer_stringify(Module['_BinaryenExportGetName'](export_)),
    'value': Pointer_stringify(Module['_BinaryenExportGetValue'](export_))
  };
};

// Emits text format of an expression or a module
Module['emitText'] = function(expr) {
  if (typeof expr === 'object') {
    return expr.emitText();
  }
  var old = Module['print'];
  var ret = '';
  Module['print'] = function(x) { ret += x + '\n' };
  Module['_BinaryenExpressionPrint'](expr);
  Module['print'] = old;
  return ret;
};

// Parses a binary to a module
Module['readBinary'] = function(data) {
  var buffer = allocate(data, 'i8', ALLOC_NORMAL);
  var ptr = Module['_BinaryenModuleRead'](buffer, data.length);
  _free(buffer);
  return new Module['Module'](ptr);
};

// Parses text format to a module
Module['parseText'] = function(text) {
  var buffer = _malloc(text.length + 1);
  writeAsciiToMemory(text, buffer);
  var ptr = Module['_BinaryenModuleParse'](buffer);
  _free(buffer);
  return new Module['Module'](ptr);
};

// Gets the currently set optimize level. 0, 1, 2 correspond to -O0, -O1, -O2, etc.
Module['getOptimizeLevel'] = function() {
  return Module['_BinaryenGetOptimizeLevel']();
};

// Sets the optimization level to use. 0, 1, 2 correspond to -O0, -O1, -O2, etc.
Module['setOptimizeLevel'] = function(level) {
  return Module['_BinaryenSetOptimizeLevel'](level);
};

// Gets the currently set shrink level. 0, 1, 2 correspond to -O0, -Os, -Oz.
Module['getShrinkLevel'] = function() {
  return Module['_BinaryenGetShrinkLevel']();
};

// Sets the shrink level to use. 0, 1, 2 correspond to -O0, -Os, -Oz.
Module['setShrinkLevel'] = function(level) {
  return Module['_BinaryenSetShrinkLevel'](level);
};

// Gets whether generating debug information is currently enabled or not.
Module['getDebugInfo'] = function() {
  return Boolean(Module['_BinaryenGetDebugInfo']());
};

// Enables or disables debug information in emitted binaries.
Module['setDebugInfo'] = function(on) {
  return Module['_BinaryenSetDebugInfo'](on);
};

// Enables or disables C-API tracing
Module['setAPITracing'] = function(on) {
  return Module['_BinaryenSetAPITracing'](on);
};
}



  return Binaryen;
};
if (typeof exports === 'object' && typeof module === 'object')
    module.exports = Binaryen;
  else if (typeof define === 'function' && define['amd'])
    define([], function() { return Binaryen; });
  else if (typeof exports === 'object')
    exports["Binaryen"] = Binaryen;
  