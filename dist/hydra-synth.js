(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Hydra = f()}})(function(){var define,module,exports;return (function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],2:[function(require,module,exports){
const Output = require('./src/output.js')
const loop = require('raf-loop')
const Source = require('./src/hydra-source.js')
const Mouse = require('mouse-change')()
const Audio = require('./src/lib/audio.js')
const VidRecorder = require('./src/lib/video-recorder.js')
const ArrayUtils = require('./src/lib/array-utils.js')
const Sandbox = require('./src/eval-sandbox.js')

const Generator = require('./src/generator-factory.js')

// to do: add ability to pass in certain uniforms and transforms
class HydraRenderer {

  constructor ({
    pb = null,
    width = 1280,
    height = 720,
    numSources = 4,
    numOutputs = 4,
    makeGlobal = true,
    autoLoop = true,
    detectAudio = true,
    enableStreamCapture = true,
    canvas,
    precision = 'mediump',
    extendTransforms = {} // add your own functions on init
  } = {}) {

    ArrayUtils.init()

    this.pb = pb

    this.width = width
    this.height = height
    this.renderAll = false
    this.detectAudio = detectAudio

    this._initCanvas(canvas)


    // object that contains all properties that will be made available on the global context and during local evaluation
    this.synth = {
      time: 0,
      bpm: 30,
      width: this.width,
      height: this.height,
      fps: undefined,
      stats: {
        fps: 0
      },
      speed: 1,
      mouse: Mouse,
      render: this._render.bind(this),
      setResolution: this.setResolution.bind(this),
      update: (dt) => {},// user defined update function
      hush: this.hush.bind(this)
    }

    this.timeSinceLastUpdate = 0
    this._time = 0 // for internal use, only to use for deciding when to render frames

  //  window.synth = this.synth

    // only allow valid precision options
    let precisionOptions = ['lowp','mediump','highp']
    let precisionValid = precisionOptions.includes(precision.toLowerCase())

    this.precision = precisionValid ? precision.toLowerCase() : 'mediump'

    if(!precisionValid){
      console.warn('[hydra-synth warning]\nConstructor was provided an invalid floating point precision value of "' + precision + '". Using default value of "mediump" instead.')
    }

    this.extendTransforms = extendTransforms

    // boolean to store when to save screenshot
    this.saveFrame = false

    // if stream capture is enabled, this object contains the capture stream
    this.captureStream = null

    this.generator = undefined

    this._initRegl()
    this._initOutputs(numOutputs)
    this._initSources(numSources)
    this._generateGlslTransforms()

    this.synth.screencap = () => {
      this.saveFrame = true
    }

    if (enableStreamCapture) {
      this.captureStream = this.canvas.captureStream(25)
      // to do: enable capture stream of specific sources and outputs
      this.synth.vidRecorder = new VidRecorder(this.captureStream)
    }

    if(detectAudio) this._initAudio()

    if(autoLoop) loop(this.tick.bind(this)).start()

    // final argument is properties that the user can set, all others are treated as read-only
    this.sandbox = new Sandbox(this.synth, makeGlobal, ['speed', 'update', 'bpm', 'fps'])
  }

  eval(code) {
    this.sandbox.eval(code)
  }

  getScreenImage(callback) {
    this.imageCallback = callback
    this.saveFrame = true
  }

  hush() {
    this.s.forEach((source) => {
      source.clear()
    })
    this.o.forEach((output) => {
      this.synth.solid(1, 1, 1, 0).out(output)
    })
  }

  setResolution(width, height) {
  //  console.log(width, height)
    this.canvas.width = width
    this.canvas.height = height
    this.width = width
    this.height = height
    this.o.forEach((output) => {
      output.resize(width, height)
    })
    this.s.forEach((source) => {
      source.resize(width, height)
    })
     console.log(this.canvas.width)
  }

  canvasToImage (callback) {
    const a = document.createElement('a')
    a.style.display = 'none'

    let d = new Date()
    a.download = `hydra-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}.${d.getMinutes()}.${d.getSeconds()}.png`
    document.body.appendChild(a)
    var self = this
    this.canvas.toBlob( (blob) => {
        if(self.imageCallback){
          self.imageCallback(blob)
          delete self.imageCallback
        } else {
          a.href = URL.createObjectURL(blob)
          console.log(a.href)
          a.click()
        }
    }, 'image/png')
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(a.href);
    }, 300);
  }

  _initAudio () {
    const that = this
    this.synth.a = new Audio({
      numBins: 4,
      // changeListener: ({audio}) => {
      //   that.a = audio.bins.map((_, index) =>
      //     (scale = 1, offset = 0) => () => (audio.fft[index] * scale + offset)
      //   )
      //
      //   if (that.makeGlobal) {
      //     that.a.forEach((a, index) => {
      //       const aname = `a${index}`
      //       window[aname] = a
      //     })
      //   }
      // }
    })
  }

  // create main output canvas and add to screen
  _initCanvas (canvas) {
    if (canvas) {
      this.canvas = canvas
      this.width = canvas.width
      this.height = canvas.height
    } else {
      this.canvas = document.createElement('canvas')
      this.canvas.width = this.width
      this.canvas.height = this.height
      this.canvas.style.width = '100%'
      this.canvas.style.height = '100%'
      this.canvas.style.imageRendering = 'pixelated'
      document.body.appendChild(this.canvas)
    }
  }

  _initRegl () {
    this.regl = require('regl')({
    //  profile: true,
      canvas: this.canvas,
      pixelRatio: 1//,
      // extensions: [
      //   'oes_texture_half_float',
      //   'oes_texture_half_float_linear'
      // ],
      // optionalExtensions: [
      //   'oes_texture_float',
      //   'oes_texture_float_linear'
     //]
   })

    // This clears the color buffer to black and the depth buffer to 1
    this.regl.clear({
      color: [0, 0, 0, 1]
    })

    this.renderAll = this.regl({
      frag: `
      precision ${this.precision} float;
      varying vec2 uv;
      uniform sampler2D tex0;
      uniform sampler2D tex1;
      uniform sampler2D tex2;
      uniform sampler2D tex3;

      void main () {
        vec2 st = vec2(1.0 - uv.x, uv.y);
        st*= vec2(2);
        vec2 q = floor(st).xy*(vec2(2.0, 1.0));
        int quad = int(q.x) + int(q.y);
        st.x += step(1., mod(st.y,2.0));
        st.y += step(1., mod(st.x,2.0));
        st = fract(st);
        if(quad==0){
          gl_FragColor = texture2D(tex0, st);
        } else if(quad==1){
          gl_FragColor = texture2D(tex1, st);
        } else if (quad==2){
          gl_FragColor = texture2D(tex2, st);
        } else {
          gl_FragColor = texture2D(tex3, st);
        }

      }
      `,
      vert: `
      precision ${this.precision} float;
      attribute vec2 position;
      varying vec2 uv;

      void main () {
        uv = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
      }`,
      attributes: {
        position: [
          [-2, 0],
          [0, -2],
          [2, 2]
        ]
      },
      uniforms: {
        tex0: this.regl.prop('tex0'),
        tex1: this.regl.prop('tex1'),
        tex2: this.regl.prop('tex2'),
        tex3: this.regl.prop('tex3')
      },
      count: 3,
      depth: { enable: false }
    })

    this.renderFbo = this.regl({
      frag: `
      precision ${this.precision} float;
      varying vec2 uv;
      uniform vec2 resolution;
      uniform sampler2D tex0;

      void main () {
        gl_FragColor = texture2D(tex0, vec2(1.0 - uv.x, uv.y));
      }
      `,
      vert: `
      precision ${this.precision} float;
      attribute vec2 position;
      varying vec2 uv;

      void main () {
        uv = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
      }`,
      attributes: {
        position: [
          [-2, 0],
          [0, -2],
          [2, 2]
        ]
      },
      uniforms: {
        tex0: this.regl.prop('tex0'),
        resolution: this.regl.prop('resolution')
      },
      count: 3,
      depth: { enable: false }
    })
  }

  _initOutputs (numOutputs) {
    const self = this
    this.o = (Array(numOutputs)).fill().map((el, index) => {
      var o = new Output({
        regl: this.regl,
        width: this.width,
        height: this.height,
        precision: this.precision
      })
    //  o.render()
      o.id = index
      self.synth['o'+index] = o
      return o
    })

    // set default output
    this.output = this.o[0]
  }

  _initSources (numSources) {
    this.s = []
    for(var i = 0; i < numSources; i++) {
      this.createSource()
    }
  }

  createSource () {
    let s = new Source({regl: this.regl, pb: this.pb, width: this.width, height: this.height})
    this.synth['s' + this.s.length] = s
    this.s.push(s)
    return s
  }

  _generateGlslTransforms () {
    var self = this
    this.generator = new Generator({
      defaultOutput: this.o[0],
      defaultUniforms: this.o[0].uniforms,
      extendTransforms: this.extendTransforms,
      changeListener: ({type, method, synth}) => {
          if (type === 'add') {
            self.synth[method] = synth.generators[method]
            if(self.sandbox) self.sandbox.add(method)
          } else if (type === 'remove') {
            // what to do here? dangerously deleting window methods
            //delete window[method]
          }
      //  }
      }
    })
    this.synth.setFunction = this.generator.setFunction.bind(this.generator)
  }

  _render (output) {
    if (output) {
      this.output = output
      this.isRenderingAll = false
    } else {
      this.isRenderingAll = true
    }
  }

  // dt in ms
  tick (dt, uniforms) {
    this.sandbox.tick()
    if(this.detectAudio === true) this.synth.a.tick()
  //  let updateInterval = 1000/this.synth.fps // ms
    if(this.synth.update) {
      try { this.synth.update(dt) } catch (e) { console.log(error) }
    }

    this.sandbox.set('time', this.synth.time += dt * 0.001 * this.synth.speed)
    this.timeSinceLastUpdate += dt
    if(!this.synth.fps || this.timeSinceLastUpdate >= 1000/this.synth.fps) {
    //  console.log(1000/this.timeSinceLastUpdate)
      this.synth.stats.fps = Math.ceil(1000/this.timeSinceLastUpdate)
    //  console.log(this.synth.speed, this.synth.time)
      for (let i = 0; i < this.s.length; i++) {
        this.s[i].tick(this.synth.time)
      }
    //  console.log(this.canvas.width, this.canvas.height)
      for (let i = 0; i < this.o.length; i++) {
        this.o[i].tick({
          time: this.synth.time,
          mouse: this.synth.mouse,
          bpm: this.synth.bpm,
          resolution: [this.canvas.width, this.canvas.height]
        })
      }
      if (this.isRenderingAll) {
        this.renderAll({
          tex0: this.o[0].getCurrent(),
          tex1: this.o[1].getCurrent(),
          tex2: this.o[2].getCurrent(),
          tex3: this.o[3].getCurrent(),
          resolution: [this.canvas.width, this.canvas.height]
        })
      } else {

        this.renderFbo({
          tex0: this.output.getCurrent(),
          resolution: [this.canvas.width, this.canvas.height]
        })
      }
      this.timeSinceLastUpdate = 0
    }
    if(this.saveFrame === true) {
      this.canvasToImage()
      this.saveFrame = false
    }
  //  this.regl.poll()
  }


}

module.exports = HydraRenderer

},{"./src/eval-sandbox.js":3,"./src/generator-factory.js":4,"./src/hydra-source.js":9,"./src/lib/array-utils.js":10,"./src/lib/audio.js":11,"./src/lib/video-recorder.js":15,"./src/output.js":17,"mouse-change":20,"raf-loop":24,"regl":26}],3:[function(require,module,exports){
// handles code evaluation and attaching relevant objects to global and evaluation contexts

const Sandbox = require('./lib/sandbox.js')
const ArrayUtils = require('./lib/array-utils.js')

class EvalSandbox {
  constructor(parent, makeGlobal, userProps = []) {
    this.makeGlobal = makeGlobal
    this.sandbox = Sandbox(parent)
    this.parent = parent
    var properties = Object.keys(parent)
    properties.forEach((property) => this.add(property))
    this.userProps = userProps
  }

  add(name) {
    if(this.makeGlobal) window[name] = this.parent[name]
    this.sandbox.addToContext(name, `parent.${name}`)
  }

// sets on window as well as synth object if global (not needed for objects, which can be set directly)

  set(property, value) {
    if(this.makeGlobal) {
      window[property] = value
    }
    this.parent[property] = value
  }

  tick() {
    if(this.makeGlobal) {
      this.userProps.forEach((property) => {
        this.parent[property] = window[property]
      })
      //  this.parent.speed = window.speed
    } else {

    }
  }

  eval(code) {
    this.sandbox.eval(code)
  }
}

module.exports = EvalSandbox

},{"./lib/array-utils.js":10,"./lib/sandbox.js":13}],4:[function(require,module,exports){
const glslTransforms = require('./glsl/glsl-functions.js')
const GlslSource = require('./glsl-source.js')

class GeneratorFactory {
  constructor ({
      defaultUniforms,
      defaultOutput,
      extendTransforms = [],
      changeListener = (() => {})
    } = {}
    ) {
    this.defaultOutput = defaultOutput
    this.defaultUniforms = defaultUniforms
    this.changeListener = changeListener
    this.extendTransforms = extendTransforms
    this.generators = {}
    this.init()
  }
  init () {
    this.glslTransforms = {}
    this.generators = Object.entries(this.generators).reduce((prev, [method, transform]) => {
      this.changeListener({type: 'remove', synth: this, method})
      return prev
    }, {})

    this.sourceClass = (() => {
      return class extends GlslSource {
      }
    })()

    let functions = glslTransforms
    // const addTransforms = (transforms) =>
    //   Object.entries(transforms).forEach(([method, transform]) => {
    //     functions[method] = transform
    //   })

    // const addTransforms =
    //
    // addTransforms(glslTransforms)
    // //addTransforms(renderpassFunctions)
    //
    // if (typeof this.extendTransforms === 'function') {
    //   functions = this.extendTransforms(functions)
    // } else
    if (Array.isArray(this.extendTransforms)) {
      functions.concat(this.extendTransforms)
    } else if (typeof this.extendTransforms === 'object') {
      functions.push(this.extendTransforms)
    }

  //  console.log(functions)
    //
    // Object.entries(functions).forEach(([method, transform]) => {
    //   if (typeof transform.glsl_return_type === 'undefined' && transform.glsl) {
    //     transform.glsl_return_type = transform.glsl.replace(new RegExp(`^(?:[\\s\\S]*\\W)?(\\S+)\\s+${method}\\s*[(][\\s\\S]*`, 'ugm'), '$1')
    //   }
    //
    //   functions[method] = this._addMethod(method, transform)
    // })

    return functions.map((transform) => this.setFunction(transform))
 }

 _addMethod (method, transform) {
//   console.log('adding', method, transform)
    this.glslTransforms[method] = transform
    if (transform.type === 'src') {
      const func = (...args) => new this.sourceClass({
        name: method,
        transform: transform,
        userArgs: args,
        defaultOutput: this.defaultOutput,
        defaultUniforms: this.defaultUniforms,
        synth: this
      })
      this.generators[method] = func
      this.changeListener({type: 'add', synth: this, method})
      return func
    } else  {
      this.sourceClass.prototype[method] = function (...args) {
        this.transforms.push({name: method, transform: transform, userArgs: args})
        return this
      }
    }
    return undefined
  }

  setFunction(obj) {
    var processedGlsl = processGlsl(obj)
  //  console.log(processedGlsl)
    if(processedGlsl) this._addMethod(obj.name, processedGlsl)
  }
}



const typeLookup = {
  'src': {
    returnType: 'vec4',
    args: ['vec2 _st']
  },
  'coord': {
    returnType: 'vec2',
    args: ['vec2 _st']
  },
  'color': {
    returnType: 'vec4',
    args: ['vec4 _c0']
  },
  'combine': {
    returnType: 'vec4',
    args: ['vec4 _c0', 'vec4 _c1']
  },
  'combineCoord': {
    returnType: 'vec2',
    args: ['vec2 _st', 'vec4 _c0']
  }
}
// expects glsl of format
// {
//   name: 'osc', // name that will be used to access function as well as within glsl
//   type: 'src', // can be src: vec4(vec2 _st), coord: vec2(vec2 _st), color: vec4(vec4 _c0), combine: vec4(vec4 _c0, vec4 _c1), combineCoord: vec2(vec2 _st, vec4 _c0)
//   inputs: [
//     {
//       name: 'freq',
//       type: 'float', // 'float'   //, 'texture', 'vec4'
//       default: 0.2
//     },
//     {
//           name: 'sync',
//           type: 'float',
//           default: 0.1
//         },
//         {
//           name: 'offset',
//           type: 'float',
//           default: 0.0
//         }
//   ],
   //  glsl: `
   //    vec2 st = _st;
   //    float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
   //    float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
   //    float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
   //    return vec4(r, g, b, 1.0);
   // `
// }

// // generates glsl function:
// `vec4 osc(vec2 _st, float freq, float sync, float offset){
//  vec2 st = _st;
//  float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
//  float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
//  float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
//  return vec4(r, g, b, 1.0);
// }`

function processGlsl(obj) {
  let t = typeLookup[obj.type]
  if(t) {
  let baseArgs = t.args.map((arg) => arg).join(", ")
  // @todo: make sure this works for all input types, add validation
  let customArgs = obj.inputs.map((input) => `${input.type} ${input.name}`).join(', ')
  let args = `${baseArgs}${customArgs.length > 0 ? ', '+ customArgs: ''}`
//  console.log('args are ', args)

    let glslFunction =
`
  ${t.returnType} ${obj.name}(${args}) {
      ${obj.glsl}
  }
`
  //  console.log('function', glslFunction)
    // {
    //   name: 'color',
    //   type: 'vec4'
    // },

  // add extra input to beginning for backward combatibility @todo update compiler so this is no longer necessary
    if(obj.type === 'combine' || obj.type === 'combineCoord') obj.inputs.unshift({
        name: 'color',
        type: 'vec4'
      })
    return Object.assign({}, obj, { glsl: glslFunction})
  } else {
    console.warn(`type ${obj.type} not recognized`)
  }

}

module.exports = GeneratorFactory

},{"./glsl-source.js":5,"./glsl/glsl-functions.js":7}],5:[function(require,module,exports){
const generateGlsl = require('./glsl-utils.js').generateGlsl
const formatArguments = require('./glsl-utils.js').formatArguments

// const glslTransforms = require('./glsl/composable-glsl-functions.js')
const utilityGlsl = require('./glsl/utility-functions.js')

var GlslSource = function (obj) {
  this.transforms = []
  this.transforms.push(obj)
  this.defaultOutput = obj.defaultOutput
  this.synth = obj.synth
  this.defaultUniforms = obj.defaultUniforms
  return this
}

GlslSource.prototype.addTransform = function (obj)  {
    this.transforms.push(obj)
}

GlslSource.prototype.out = function (_output) {
  var output = _output || this.defaultOutput
  var glsl = this.glsl(output)
  this.synth.currentFunctions = []
 // output.renderPasses(glsl)
  if(output) try{
    output.render(glsl)
  } catch (error) {
    console.log('shader could not compile', error)
  }
}

GlslSource.prototype.glsl = function () {
  //var output = _output || this.defaultOutput
  var self = this
  // uniforms included in all shaders
//  this.defaultUniforms = output.uniforms
  var passes = []
  var transforms = []
//  console.log('output', output)
  this.transforms.forEach((transform) => {
    if(transform.transform.type === 'renderpass'){
      // if (transforms.length > 0) passes.push(this.compile(transforms, output))
      // transforms = []
      // var uniforms = {}
      // const inputs = formatArguments(transform, -1)
      // inputs.forEach((uniform) => { uniforms[uniform.name] = uniform.value })
      //
      // passes.push({
      //   frag: transform.transform.frag,
      //   uniforms: Object.assign({}, self.defaultUniforms, uniforms)
      // })
      // transforms.push({name: 'prev', transform:  glslTransforms['prev'], synth: this.synth})
      console.warn('no support for renderpass')
    } else {
      transforms.push(transform)
    }
  })

  if (transforms.length > 0) passes.push(this.compile(transforms))

  return passes
}

GlslSource.prototype.compile = function (transforms) {

  var shaderInfo = generateGlsl(transforms)
  var uniforms = {}
  shaderInfo.uniforms.forEach((uniform) => { uniforms[uniform.name] = uniform.value })

  var frag = `
  precision mediump float;
  ${Object.values(shaderInfo.uniforms).map((uniform) => {
    let type = uniform.type
    switch (uniform.type) {
      case 'texture':
        type = 'sampler2D'
        break
    }
    return `
      uniform ${type} ${uniform.name};`
  }).join('')}
  uniform float time;
  uniform vec2 resolution;
  varying vec2 uv;
  uniform sampler2D prevBuffer;

  ${Object.values(utilityGlsl).map((transform) => {
  //  console.log(transform.glsl)
    return `
            ${transform.glsl}
          `
  }).join('')}

  ${shaderInfo.glslFunctions.map((transform) => {
    return `
            ${transform.transform.glsl}
          `
  }).join('')}

  void main () {
    vec4 c = vec4(1, 0, 0, 1);
    vec2 st = gl_FragCoord.xy/resolution.xy;
    gl_FragColor = ${shaderInfo.fragColor};
  }
  `

  return {
    frag: frag,
    uniforms: Object.assign({}, this.defaultUniforms, uniforms)
  }

}

module.exports = GlslSource

},{"./glsl-utils.js":6,"./glsl/utility-functions.js":8}],6:[function(require,module,exports){
// converts a tree of javascript functions to a shader

// Add extra functionality to Array.prototype for generating sequences in time
const arrayUtils = require('./lib/array-utils.js')

// [WIP] how to treat different dimensions (?)
const DEFAULT_CONVERSIONS = {
  float: {
    'vec4': {name: 'sum', args: [[1, 1, 1, 1]]},
    'vec2': {name: 'sum', args: [[1, 1]]}
  }
}

module.exports = {
  generateGlsl: function (transforms) {
    var shaderParams = {
      uniforms: [], // list of uniforms used in shader
      glslFunctions: [], // list of functions used in shader
      fragColor: ''
    }

    var gen = generateGlsl(transforms, shaderParams)('st')
    shaderParams.fragColor = gen
    return shaderParams
  },
  formatArguments: formatArguments
}
// recursive function for generating shader string from object containing functions and user arguments. Order of functions in string depends on type of function
// to do: improve variable names
function generateGlsl (transforms, shaderParams) {

  // transform function that outputs a shader string corresponding to gl_FragColor
  var fragColor = () => ''
  // var uniforms = []
  // var glslFunctions = []
  transforms.forEach((transform) => {
    var inputs = formatArguments(transform, shaderParams.uniforms.length)
    inputs.forEach((input) => {
      if(input.isUniform) shaderParams.uniforms.push(input)
    })

   // add new glsl function to running list of functions
    if(!contains(transform, shaderParams.glslFunctions)) shaderParams.glslFunctions.push(transform)

    // current function for generating frag color shader code
    var f0 = fragColor
    if (transform.transform.type === 'src') {
      fragColor = (uv) => `${shaderString(uv, transform.name, inputs, shaderParams)}`
    } else if (transform.transform.type === 'coord') {
      fragColor = (uv) => `${f0(`${shaderString(uv, transform.name, inputs, shaderParams)}`)}`
    } else if (transform.transform.type === 'color') {
      fragColor = (uv) =>  `${shaderString(`${f0(uv)}`, transform.name, inputs, shaderParams)}`
    } else if (transform.transform.type === 'combine') {
      // combining two generated shader strings (i.e. for blend, mult, add funtions)
      var f1 = inputs[0].value && inputs[0].value.transforms ?
        (uv) => `${generateGlsl(inputs[0].value.transforms, shaderParams)(uv)}` :
        (inputs[0].isUniform ? () => inputs[0].name : () => inputs[0].value)
      fragColor = (uv) => `${shaderString(`${f0(uv)}, ${f1(uv)}`, transform.name, inputs.slice(1), shaderParams)}`
    } else if (transform.transform.type === 'combineCoord') {
      // combining two generated shader strings (i.e. for modulate functions)
      var f1 = inputs[0].value && inputs[0].value.transforms ?
        (uv) => `${generateGlsl(inputs[0].value.transforms, shaderParams)(uv)}` :
        (inputs[0].isUniform ? () => inputs[0].name : () => inputs[0].value)
      fragColor = (uv) => `${f0(`${shaderString(`${uv}, ${f1(uv)}`, transform.name, inputs.slice(1), shaderParams)}`)}`


    }
  })

  return fragColor
}

// assembles a shader string containing the arguments and the function name, i.e. 'osc(uv, frequency)'
function shaderString (uv, method, inputs, shaderParams) {
  const str = inputs.map((input) => {
    if (input.isUniform) {
      return input.name
    } else if (input.value && input.value.transforms) {
      // this by definition needs to be a generator, hence we start with 'st' as the initial value for generating the glsl fragment
      return `${generateGlsl(input.value.transforms, shaderParams)('st')}`
    }
    return input.value
  }).reduce((p, c) => `${p}, ${c}`, '')

  return `${method}(${uv}${str})`
}

// merge two arrays and remove duplicates
function mergeArrays (a, b) {
  return a.concat(b.filter(function (item) {
    return a.indexOf(item) < 0;
  }))
}

// check whether array
function contains(object, arr) {
  for(var i = 0; i < arr.length; i++){
    if(object.name == arr[i].name) return true
  }
  return false
}

function fillArrayWithDefaults (arr, len) {
  // fill the array with default values if it's too short
  while (arr.length < len) {
    if (arr.length === 3) { // push a 1 as the default for .a in vec4
      arr.push(1.0)
    } else {
      arr.push(0.0)
    }
  }
  return arr.slice(0, len)
}

const ensure_decimal_dot = (val) => {
  val = val.toString()
  if (val.indexOf('.') < 0) {
    val += '.'
  }
  return val
}

function formatArguments (transform, startIndex) {
//  console.log('processing args', transform, startIndex)
  const defaultArgs = transform.transform.inputs
  const userArgs = transform.userArgs
  return defaultArgs.map( (input, index) => {
    const typedArg = {
      value: input.default,
      type: input.type, //
      isUniform: false,
      name: input.name,
      vecLen: 0
    //  generateGlsl: null // function for creating glsl
    }

    if(typedArg.type === 'float') typedArg.value = ensure_decimal_dot(input.default)
    if (input.type.startsWith('vec')) {
      try {
        typedArg.vecLen = Number.parseInt(input.type.substr(3))
      } catch (e) {
        console.log(`Error determining length of vector input type ${input.type} (${input.name})`)
      }
    }

    // if user has input something for this argument
    if(userArgs.length > index) {
      typedArg.value = userArgs[index]
      // do something if a composite or transform

      if (typeof userArgs[index] === 'function') {
        if (typedArg.vecLen > 0) { // expected input is a vector, not a scalar
          typedArg.value = (context, props, batchId) => (fillArrayWithDefaults(userArgs[index](props), typedArg.vecLen))
        } else {
          typedArg.value = (context, props, batchId) => {
           try {
             return userArgs[index](props)
           } catch (e) {
             console.log('ERROR', e)
             return input.default
           }
         }
        }

        typedArg.isUniform = true
      } else if (userArgs[index].constructor === Array) {
        if (typedArg.vecLen > 0) { // expected input is a vector, not a scalar
          typedArg.isUniform = true
          typedArg.value = fillArrayWithDefaults(typedArg.value, typedArg.vecLen)
        } else {
      //  console.log("is Array")
          typedArg.value = (context, props, batchId) => arrayUtils.getValue(userArgs[index])(props)
          typedArg.isUniform = true
        }
      }
    }

    if(startIndex< 0){
    } else {
    if (typedArg.value && typedArg.value.transforms) {
      const final_transform = typedArg.value.transforms[typedArg.value.transforms.length - 1]



      if (final_transform.transform.glsl_return_type !== input.type) {
        const defaults = DEFAULT_CONVERSIONS[input.type]
        if (typeof defaults !== 'undefined') {
          const default_def = defaults[final_transform.transform.glsl_return_type]
          if (typeof default_def !== 'undefined') {
            const {name, args} = default_def
            typedArg.value = typedArg.value[name](...args)
          }
        }
      }

      typedArg.isUniform = false
    } else if (typedArg.type === 'float' && typeof typedArg.value === 'number') {
      typedArg.value = ensure_decimal_dot(typedArg.value)
    } else if (typedArg.type.startsWith('vec') && typeof typedArg.value === 'object' && Array.isArray(typedArg.value)) {
      typedArg.isUniform = false
      typedArg.value = `${typedArg.type}(${typedArg.value.map(ensure_decimal_dot).join(', ')})`
    } else if (input.type === 'sampler2D') {
      // typedArg.tex = typedArg.value
      var x = typedArg.value
      typedArg.value = () => (x.getTexture())
      typedArg.isUniform = true
    } else {
      // if passing in a texture reference, when function asks for vec4, convert to vec4
      if (typedArg.value.getTexture && input.type === 'vec4') {
        var x1 = typedArg.value
        typedArg.value = src(x1)
        typedArg.isUniform = false
      }
    }

    // add tp uniform array if is a function that will pass in a different value on each render frame,
    // or a texture/ external source

      if(typedArg.isUniform) {
         typedArg.name += startIndex
      //  shaderParams.uniforms.push(typedArg)
      }
}
    return typedArg
  })
}

},{"./lib/array-utils.js":10}],7:[function(require,module,exports){
/*
Format for adding functions to hydra. For each entry in this file, hydra automatically generates a glsl function and javascript function with the same name. You can also add functions dynamically using setFunction(object).

{
  name: 'osc', // name that will be used to access function in js as well as in glsl
  type: 'src', // can be 'src', 'color', 'combine', 'combineCoords'. see below for more info
  inputs: [
    {
      name: 'freq',
      type: 'float',
      default: 0.2
    },
    {
      name: 'sync',
      type: 'float',
      default: 0.1
    },
    {
      name: 'offset',
      type: 'float',
      default: 0.0
    }
  ],
    glsl: `
      vec2 st = _st;
      float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
      float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
      float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
      return vec4(r, g, b, 1.0);
   `
}

// The above code generates the glsl function:
`vec4 osc(vec2 _st, float freq, float sync, float offset){
 vec2 st = _st;
 float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
 float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
 float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
 return vec4(r, g, b, 1.0);
}`


Types and default arguments for hydra functions.
The value in the 'type' field lets the parser know which type the function will be returned as well as default arguments.

const types = {
  'src': {
    returnType: 'vec4',
    args: ['vec2 _st']
  },
  'coord': {
    returnType: 'vec2',
    args: ['vec2 _st']
  },
  'color': {
    returnType: 'vec4',
    args: ['vec4 _c0']
  },
  'combine': {
    returnType: 'vec4',
    args: ['vec4 _c0', 'vec4 _c1']
  },
  'combineCoord': {
    returnType: 'vec2',
    args: ['vec2 _st', 'vec4 _c0']
  }
}

*/

module.exports = [
  {
    name: 'noise',
    type: 'src',
    inputs: [
      {
        type: 'float',
        name: 'scale',
        default: 10,
      },
      {
        type: 'float',
        name: 'offset',
        default: 0.1,
      }
    ],
    glsl:
      `   return vec4(vec3(_noise(vec3(_st*scale, offset*time))), 1.0);`
  },
  {
    name: 'voronoi',
    type: 'src',
    inputs: [
      {
        type: 'float',
        name: 'scale',
        default: 5,
      },
      {
        type: 'float',
        name: 'speed',
        default: 0.3,
      },
      {
        type: 'float',
        name: 'blending',
        default: 0.3,
      }
    ],
    glsl:
      `   vec3 color = vec3(.0);
   // Scale
   _st *= scale;
   // Tile the space
   vec2 i_st = floor(_st);
   vec2 f_st = fract(_st);
   float m_dist = 10.;  // minimun distance
   vec2 m_point;        // minimum point
   for (int j=-1; j<=1; j++ ) {
   for (int i=-1; i<=1; i++ ) {
   vec2 neighbor = vec2(float(i),float(j));
   vec2 p = i_st + neighbor;
   vec2 point = fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
   point = 0.5 + 0.5*sin(time*speed + 6.2831*point);
   vec2 diff = neighbor + point - f_st;
   float dist = length(diff);
   if( dist < m_dist ) {
   m_dist = dist;
   m_point = point;
   }
   }
   }
   // Assign a color using the closest point position
   color += dot(m_point,vec2(.3,.6));
   color *= 1.0 - blending*m_dist;
   return vec4(color, 1.0);`
  },
  {
    name: 'osc',
    type: 'src',
    inputs: [
      {
        type: 'float',
        name: 'frequency',
        default: 60,
      },
      {
        type: 'float',
        name: 'sync',
        default: 0.1,
      },
      {
        type: 'float',
        name: 'offset',
        default: 0,
      }
    ],
    glsl:
      `   vec2 st = _st;
   float r = sin((st.x-offset/frequency+time*sync)*frequency)*0.5  + 0.5;
   float g = sin((st.x+time*sync)*frequency)*0.5 + 0.5;
   float b = sin((st.x+offset/frequency+time*sync)*frequency)*0.5  + 0.5;
   return vec4(r, g, b, 1.0);`
  },
  {
    name: 'shape',
    type: 'src',
    inputs: [
      {
        type: 'float',
        name: 'sides',
        default: 3,
      },
      {
        type: 'float',
        name: 'radius',
        default: 0.3,
      },
      {
        type: 'float',
        name: 'smoothing',
        default: 0.01,
      }
    ],
    glsl:
      `   vec2 st = _st * 2. - 1.;
   // Angle and radius from the current pixel
   float a = atan(st.x,st.y)+3.1416;
   float r = (2.*3.1416)/sides;
   float d = cos(floor(.5+a/r)*r-a)*length(st);
   return vec4(vec3(1.0-smoothstep(radius,radius + smoothing,d)), 1.0);`
  },
  {
    name: 'gradient',
    type: 'src',
    inputs: [
      {
        type: 'float',
        name: 'speed',
        default: 0,
      }
    ],
    glsl:
      `   return vec4(_st, sin(time*speed), 1.0);`
  },
  {
    name: 'src',
    type: 'src',
    inputs: [
      {
        type: 'sampler2D',
        name: 'tex',
        default: NaN,
      }
    ],
    glsl:
      `   //  vec2 uv = gl_FragCoord.xy/vec2(1280., 720.);
   return texture2D(tex, fract(_st));`
  },
  {
    name: 'solid',
    type: 'src',
    inputs: [
      {
        type: 'float',
        name: 'r',
        default: 0,
      },
      {
        type: 'float',
        name: 'g',
        default: 0,
      },
      {
        type: 'float',
        name: 'b',
        default: 0,
      },
      {
        type: 'float',
        name: 'a',
        default: 1,
      }
    ],
    glsl:
      `   return vec4(r, g, b, a);`
  },
  {
    name: 'rotate',
    type: 'coord',
    inputs: [
      {
        type: 'float',
        name: 'angle',
        default: 10,
      },
      {
        type: 'float',
        name: 'speed',
        default: 0,
      }
    ],
    glsl:
      `   vec2 xy = _st - vec2(0.5);
   float ang = angle + speed *time;
   xy = mat2(cos(angle),-sin(ang), sin(ang),cos(ang))*xy;
   xy += 0.5;
   return xy;`
  },
  {
    name: 'scale',
    type: 'coord',
    inputs: [
      {
        type: 'float',
        name: 'amount',
        default: 1.5,
      },
      {
        type: 'float',
        name: 'xMult',
        default: 1,
      },
      {
        type: 'float',
        name: 'yMult',
        default: 1,
      },
      {
        type: 'float',
        name: 'offsetX',
        default: 0.5,
      },
      {
        type: 'float',
        name: 'offsetY',
        default: 0.5,
      }
    ],
    glsl:
      `   vec2 xy = _st - vec2(offsetX, offsetY);
   xy*=(1.0/vec2(amount*xMult, amount*yMult));
   xy+=vec2(offsetX, offsetY);
   return xy;
   `
  },
  {
    name: 'pixelate',
    type: 'coord',
    inputs: [
      {
        type: 'float',
        name: 'pixelX',
        default: 20,
      },
      {
        type: 'float',
        name: 'pixelY',
        default: 20,
      }
    ],
    glsl:
      `   vec2 xy = vec2(pixelX, pixelY);
   return (floor(_st * xy) + 0.5)/xy;`
  },
  {
    name: 'posterize',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'bins',
        default: 3,
      },
      {
        type: 'float',
        name: 'gamma',
        default: 0.6,
      }
    ],
    glsl:
      `   vec4 c2 = pow(_c0, vec4(gamma));
   c2 *= vec4(bins);
   c2 = floor(c2);
   c2/= vec4(bins);
   c2 = pow(c2, vec4(1.0/gamma));
   return vec4(c2.xyz, _c0.a);`
  },
  {
    name: 'shift',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'r',
        default: 0.5,
      },
      {
        type: 'float',
        name: 'g',
        default: 0,
      },
      {
        type: 'float',
        name: 'b',
        default: 0,
      },
      {
        type: 'float',
        name: 'a',
        default: 0,
      }
    ],
    glsl:
      `   vec4 c2 = vec4(_c0);
   c2.r = fract(c2.r + r);
   c2.g = fract(c2.g + g);
   c2.b = fract(c2.b + b);
   c2.a = fract(c2.a + a);
   return vec4(c2.rgba);`
  },
  {
    name: 'repeat',
    type: 'coord',
    inputs: [
      {
        type: 'float',
        name: 'repeatX',
        default: 3,
      },
      {
        type: 'float',
        name: 'repeatY',
        default: 3,
      },
      {
        type: 'float',
        name: 'offsetX',
        default: 0,
      },
      {
        type: 'float',
        name: 'offsetY',
        default: 0,
      }
    ],
    glsl:
      `   vec2 st = _st * vec2(repeatX, repeatY);
   st.x += step(1., mod(st.y,2.0)) * offsetX;
   st.y += step(1., mod(st.x,2.0)) * offsetY;
   return fract(st);`
  },
  {
    name: 'modulateRepeat',
    type: 'combineCoord',
    inputs: [
      {
        type: 'float',
        name: 'repeatX',
        default: 3,
      },
      {
        type: 'float',
        name: 'repeatY',
        default: 3,
      },
      {
        type: 'float',
        name: 'offsetX',
        default: 0.5,
      },
      {
        type: 'float',
        name: 'offsetY',
        default: 0.5,
      }
    ],
    glsl:
      `   vec2 st = _st * vec2(repeatX, repeatY);
   st.x += step(1., mod(st.y,2.0)) + _c0.r * offsetX;
   st.y += step(1., mod(st.x,2.0)) + _c0.g * offsetY;
   return fract(st);`
  },
  {
    name: 'repeatX',
    type: 'coord',
    inputs: [
      {
        type: 'float',
        name: 'reps',
        default: 3,
      },
      {
        type: 'float',
        name: 'offset',
        default: 0,
      }
    ],
    glsl:
      `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y += step(1., mod(st.x,2.0))* offset;
   return fract(st);`
  },
  {
    name: 'modulateRepeatX',
    type: 'combineCoord',
    inputs: [
      {
        type: 'float',
        name: 'reps',
        default: 3,
      },
      {
        type: 'float',
        name: 'offset',
        default: 0.5,
      }
    ],
    glsl:
      `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y += step(1., mod(st.x,2.0)) + _c0.r * offset;
   return fract(st);`
  },
  {
    name: 'repeatY',
    type: 'coord',
    inputs: [
      {
        type: 'float',
        name: 'reps',
        default: 3,
      },
      {
        type: 'float',
        name: 'offset',
        default: 0,
      }
    ],
    glsl:
      `   vec2 st = _st * vec2(1.0, reps);
   //  float f =  mod(_st.y,2.0);
   st.x += step(1., mod(st.y,2.0))* offset;
   return fract(st);`
  },
  {
    name: 'modulateRepeatY',
    type: 'combineCoord',
    inputs: [
      {
        type: 'float',
        name: 'reps',
        default: 3,
      },
      {
        type: 'float',
        name: 'offset',
        default: 0.5,
      }
    ],
    glsl:
      `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.x += step(1., mod(st.y,2.0)) + _c0.r * offset;
   return fract(st);`
  },
  {
    name: 'kaleid',
    type: 'coord',
    inputs: [
      {
        type: 'float',
        name: 'nSides',
        default: 4,
      }
    ],
    glsl:
      `   vec2 st = _st;
   st -= 0.5;
   float r = length(st);
   float a = atan(st.y, st.x);
   float pi = 2.*3.1416;
   a = mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return r*vec2(cos(a), sin(a));`
  },
  {
    name: 'modulateKaleid',
    type: 'combineCoord',
    inputs: [
      {
        type: 'float',
        name: 'nSides',
        default: 4,
      }
    ],
    glsl:
      `   vec2 st = _st - 0.5;
   float r = length(st);
   float a = atan(st.y, st.x);
   float pi = 2.*3.1416;
   a = mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return (_c0.r+r)*vec2(cos(a), sin(a));`
  },
  {
    name: 'scroll',
    type: 'coord',
    inputs: [
      {
        type: 'float',
        name: 'scrollX',
        default: 0.5,
      },
      {
        type: 'float',
        name: 'scrollY',
        default: 0.5,
      },
      {
        type: 'float',
        name: 'speedX',
        default: 0,
      },
      {
        type: 'float',
        name: 'speedY',
        default: 0,
      }
    ],
    glsl:
      `
   _st.x += scrollX + time*speedX;
   _st.y += scrollY + time*speedY;
   return _st;`
  },
  {
    name: 'scrollX',
    type: 'coord',
    inputs: [
      {
        type: 'float',
        name: 'scrollX',
        default: 0.5,
      },
      {
        type: 'float',
        name: 'speed',
        default: 0,
      }
    ],
    glsl:
      `   _st.x += scrollX + time*speed;
   return _st;`
  },
  {
    name: 'modulateScrollX',
    type: 'combineCoord',
    inputs: [
      {
        type: 'float',
        name: 'scrollX',
        default: 0.5,
      },
      {
        type: 'float',
        name: 'speed',
        default: 0,
      }
    ],
    glsl:
      `   _st.x += _c0.r*scrollX + time*speed;
   return _st;`
  },
  {
    name: 'scrollY',
    type: 'coord',
    inputs: [
      {
        type: 'float',
        name: 'scrollY',
        default: 0.5,
      },
      {
        type: 'float',
        name: 'speed',
        default: 0,
      }
    ],
    glsl:
      `   _st.y += scrollY + time*speed;
   return _st;`
  },
  {
    name: 'modulateScrollY',
    type: 'combineCoord',
    inputs: [
      {
        type: 'float',
        name: 'scrollY',
        default: 0.5,
      },
      {
        type: 'float',
        name: 'speed',
        default: 0,
      }
    ],
    glsl:
      `   _st.y += _c0.r*scrollY + time*speed;
   return _st;`
  },
  {
    name: 'add',
    type: 'combine',
    inputs: [
      {
        type: 'float',
        name: 'amount',
        default: 1,
      }
    ],
    glsl:
      `   return (_c0+_c1)*amount + _c0*(1.0-amount);`
  },
  {
    name: 'sub',
    type: 'combine',
    inputs: [
      {
        type: 'float',
        name: 'amount',
        default: 1,
      }
    ],
    glsl:
      `   return (_c0-_c1)*amount + _c0*(1.0-amount);`
  },
  {
    name: 'layer',
    type: 'combine',
    inputs: [

    ],
    glsl:
      `   return vec4(mix(_c0.rgb, _c1.rgb, _c1.a), _c0.a+_c1.a);`
  },
  {
    name: 'blend',
    type: 'combine',
    inputs: [
      {
        type: 'float',
        name: 'amount',
        default: 0.5,
      }
    ],
    glsl:
      `   return _c0*(1.0-amount)+_c1*amount;`
  },
  {
    name: 'mult',
    type: 'combine',
    inputs: [
      {
        type: 'float',
        name: 'amount',
        default: 1,
      }
    ],
    glsl:
      `   return _c0*(1.0-amount)+(_c0*_c1)*amount;`
  },
  {
    name: 'diff',
    type: 'combine',
    inputs: [

    ],
    glsl:
      `   return vec4(abs(_c0.rgb-_c1.rgb), max(_c0.a, _c1.a));`
  },
  {
    name: 'modulate',
    type: 'combineCoord',
    inputs: [
      {
        type: 'float',
        name: 'amount',
        default: 0.1,
      }
    ],
    glsl:
      `   //  return fract(st+(_c0.xy-0.5)*amount);
   return _st + _c0.xy*amount;`
  },
  {
    name: 'modulateScale',
    type: 'combineCoord',
    inputs: [
      {
        type: 'float',
        name: 'multiple',
        default: 1,
      },
      {
        type: 'float',
        name: 'offset',
        default: 1,
      }
    ],
    glsl:
      `   vec2 xy = _st - vec2(0.5);
   xy*=(1.0/vec2(offset + multiple*_c0.r, offset + multiple*_c0.g));
   xy+=vec2(0.5);
   return xy;`
  },
  {
    name: 'modulatePixelate',
    type: 'combineCoord',
    inputs: [
      {
        type: 'float',
        name: 'multiple',
        default: 10,
      },
      {
        type: 'float',
        name: 'offset',
        default: 3,
      }
    ],
    glsl:
      `   vec2 xy = vec2(offset + _c0.x*multiple, offset + _c0.y*multiple);
   return (floor(_st * xy) + 0.5)/xy;`
  },
  {
    name: 'modulateRotate',
    type: 'combineCoord',
    inputs: [
      {
        type: 'float',
        name: 'multiple',
        default: 1,
      },
      {
        type: 'float',
        name: 'offset',
        default: 0,
      }
    ],
    glsl:
      `   vec2 xy = _st - vec2(0.5);
   float angle = offset + _c0.x * multiple;
   xy = mat2(cos(angle),-sin(angle), sin(angle),cos(angle))*xy;
   xy += 0.5;
   return xy;`
  },
  {
    name: 'modulateHue',
    type: 'combineCoord',
    inputs: [
      {
        type: 'float',
        name: 'amount',
        default: 1,
      }
    ],
    glsl:
      `   return _st + (vec2(_c0.g - _c0.r, _c0.b - _c0.g) * amount * 1.0/resolution);`
  },
  {
    name: 'invert',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'amount',
        default: 1,
      }
    ],
    glsl:
      `   return vec4((1.0-_c0.rgb)*amount + _c0.rgb*(1.0-amount), _c0.a);`
  },
  {
    name: 'contrast',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'amount',
        default: 1.6,
      }
    ],
    glsl:
      `   vec4 c = (_c0-vec4(0.5))*vec4(amount) + vec4(0.5);
   return vec4(c.rgb, _c0.a);`
  },
  {
    name: 'brightness',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'amount',
        default: 0.4,
      }
    ],
    glsl:
      `   return vec4(_c0.rgb + vec3(amount), _c0.a);`
  },
  {
    name: 'mask',
    type: 'combine',
    inputs: [

    ],
    glsl:
      `   float a = _luminance(_c1.rgb);
   return vec4(_c0.rgb*a, a);`
  },
  {
    name: 'luma',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'threshold',
        default: 0.5,
      },
      {
        type: 'float',
        name: 'tolerance',
        default: 0.1,
      }
    ],
    glsl:
      `   float a = smoothstep(threshold-tolerance, threshold+tolerance, _luminance(_c0.rgb));
   return vec4(_c0.rgb*a, a);`
  },
  {
    name: 'thresh',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'threshold',
        default: 0.5,
      },
      {
        type: 'float',
        name: 'tolerance',
        default: 0.04,
      }
    ],
    glsl:
      `   return vec4(vec3(smoothstep(threshold-tolerance, threshold+tolerance, _luminance(_c0.rgb))), _c0.a);`
  },
  {
    name: 'color',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'r',
        default: 1,
      },
      {
        type: 'float',
        name: 'g',
        default: 1,
      },
      {
        type: 'float',
        name: 'b',
        default: 1,
      },
      {
        type: 'float',
        name: 'a',
        default: 1,
      }
    ],
    glsl:
      `   vec4 c = vec4(r, g, b, a);
   vec4 pos = step(0.0, c); // detect whether negative
   // if > 0, return r * _c0
   // if < 0 return (1.0-r) * _c0
   return vec4(mix((1.0-_c0)*abs(c), c*_c0, pos));`
  },
  {
    name: 'saturate',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'amount',
        default: 2,
      }
    ],
    glsl:
      `   const vec3 W = vec3(0.2125, 0.7154, 0.0721);
   vec3 intensity = vec3(dot(_c0.rgb, W));
   return vec4(mix(intensity, _c0.rgb, amount), _c0.a);`
  },
  {
    name: 'hue',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'hue',
        default: 0.4,
      }
    ],
    glsl:
      `   vec3 c = _rgbToHsv(_c0.rgb);
   c.r += hue;
   //  c.r = fract(c.r);
   return vec4(_hsvToRgb(c), _c0.a);`
  },
  {
    name: 'colorama',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'amount',
        default: 0.005,
      }
    ],
    glsl:
      `   vec3 c = _rgbToHsv(_c0.rgb);
   c += vec3(amount);
   c = _hsvToRgb(c);
   c = fract(c);
   return vec4(c, _c0.a);`
  },
  {
    name: 'prev',
    type: 'src',
    inputs: [

    ],
    glsl:
      `   return texture2D(prevBuffer, fract(_st));`
  },
  {
    name: 'sum',
    type: 'color',
    inputs: [
      {
        type: 'vec4',
        name: 'scale',
        default: 1,
      }
    ],
    glsl:
      `   vec4 v = _c0 * s;
   return v.r + v.g + v.b + v.a;
   }
   float sum(vec2 _st, vec4 s) { // vec4 is not a typo, because argument type is not overloaded
   vec2 v = _st.xy * s.xy;
   return v.x + v.y;`
  },
  {
    name: 'r',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'scale',
        default: 1,
      },
      {
        type: 'float',
        name: 'offset',
        default: 0,
      }
    ],
    glsl:
      `   return vec4(_c0.r * scale + offset);`
  },
  {
    name: 'g',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'scale',
        default: 1,
      },
      {
        type: 'float',
        name: 'offset',
        default: 0,
      }
    ],
    glsl:
      `   return vec4(_c0.g * scale + offset);`
  },
  {
    name: 'b',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'scale',
        default: 1,
      },
      {
        type: 'float',
        name: 'offset',
        default: 0,
      }
    ],
    glsl:
      `   return vec4(_c0.b * scale + offset);`
  },
  {
    name: 'a',
    type: 'color',
    inputs: [
      {
        type: 'float',
        name: 'scale',
        default: 1,
      },
      {
        type: 'float',
        name: 'offset',
        default: 0,
      }
    ],
    glsl:
      `   return vec4(_c0.a * scale + offset);`
  },
  {
    name: 'chromatic',
    type: 'combineCoord',
    inputs: [
      {
        type: 'float',
        name: 'offsetX',
        default: 0.5,
      },
      {
        type: 'float',
        name: 'offsetY',
        default: 0.5,
      }
    ],
    glsl:
      ` vec2 st = _st * vec2(offsetX, offsetY);
        return vec2( st.x * _c0.r, st.y * _c0.g);
      `
  },
  {
    name: 'audiovisual',
    type: 'src',
    inputs: [
      {
        type: 'float',
        name: 'wave',
        default: 1.0,
      }
    ],
    glsl:
    ` 
      vec2 uv = -1.0+2.0*_st;	
      vec3 c = vec3(0.0);
      for(int i = 1; i<20; i++)
      {
          float t = 2.*3.14*float(i)/20.* (time*.9);
          float x = sin(t)*1.8*smoothstep( 0.0, 0.15, abs(wave - uv.y));
          float y = sin(.5*t) *smoothstep( 0.0, 0.15, abs(wave - uv.y));
          y*=.5;
          vec2 o = .4*vec2(x*cos(time*.5),y*sin(time*.3));
          float red = fract(t);
          float green = 1.-red;
          c+=0.016/(length(uv-o))*vec3(red,green,sin(time));
      }
      return vec4(c,1.0);
    `
  },
  {
    name: 'flaring',
    type: 'src',
    inputs: [
      {
        type: 'float',
        name: 'curvature',
        default: 10.0,
      }
    ],
    glsl:
    ` 
      float t = -time*0.03;
      vec2 uv = 2. * _st - 1.;
      uv.x *= resolution.x/resolution.y;
      uv*= curvature*.05+0.0001;
      float r  = sqrt(dot(uv,uv));
      float x = dot(normalize(uv), vec2(.5,0.))+t;	
      float y = dot(normalize(uv), vec2(.0,.5))+t;
      float gamma = 4.;
      float ray_density = 3.14;
      float val;
      val = _fbm(vec2(r+y*ray_density,r+x*ray_density-y));
      val = smoothstep(gamma*.02-.1,20.+(gamma*0.02-.1)+.001,val);
      val = sqrt(val);
      float red = 2.9;
      float green = .7;
      float blue = 3.5;
      vec3 col = val/vec3(red,green,blue);
      col = clamp(1.-col,0.,1.);
      col = mix(col,vec3(1.),.95-r/0.1/curvature*200./1.5);
      return vec4(col,1.0);
    `
  }

]

},{}],8:[function(require,module,exports){
// functions that are only used within other functions

module.exports = {
  _luminance: {
    type: 'util',
    glsl: `float _luminance(vec3 rgb){
      const vec3 W = vec3(0.2125, 0.7154, 0.0721);
      return dot(rgb, W);
    }`
  },
  _noise: {
    type: 'util',
    glsl: `
    //	Simplex 3D Noise
    //	by Ian McEwan, Ashima Arts
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float _noise(vec3 v){
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    //  x0 = x0 - 0. + 0.0 * C
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
    i = mod(i, 289.0 );
    vec4 p = permute( permute( permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
    float n_ = 1.0/7.0; // N=7
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

  //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

  // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }
    `
  },


  _rgbToHsv: {
    type: 'util',
    glsl: `vec3 _rgbToHsv(vec3 c){
            vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
            vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
            vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

            float d = q.x - min(q.w, q.y);
            float e = 1.0e-10;
            return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }`
  },
  _hsvToRgb: {
    type: 'util',
    glsl: `vec3 _hsvToRgb(vec3 c){
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }`
  },
  _hash1: {
    type: 'util',
    glsl: `
      float _hash1(float f){
        return fract(sin(f)*43758.5453);
      }
    `
  },
  _noise21: {
    type: 'util',
    glsl: `
      float _noise21(vec2 x) {
        x *= 1.75;
        vec2 p = floor(x);
        vec2 f = fract(x);
        f = f*f*(3.0-2.0*f);
        float n = p.x + p.y*57.0;
        float res = mix(mix( _hash1(n+  0.0), _hash1(n+  1.0),f.x),
                        mix( _hash1(n+ 57.0), _hash1(n+ 58.0),f.x),f.y);
        return res;	
      }
    `
  },
  _fbm: {
    type: 'util',
    glsl: `
    float _fbm( vec2 p ) {	
      float z=2.;
      float rz = 0.;
      p *= 0.25;
      for (float i= 1.;i < 6.;i++ )
      {		
        rz+= (sin(_noise21(p)*15.)*0.5+0.5) /z;		
        z = z*2.;
        p = p*2.*mat2( 0.80,  0.60, -0.60,  0.80 );
      }
      return rz;
    }
    `
  }
}

},{}],9:[function(require,module,exports){
const Webcam = require('./lib/webcam.js')
const Screen = require('./lib/screenmedia.js')

class HydraSource  {

  constructor (opts) {
    this.regl = opts.regl
    this.src = null
    this.dynamic = true
    this.width = opts.width
    this.height = opts.height
    this.tex = this.regl.texture({
      shape: [1, 1]
    //  shape: [opts.width, opts.height]
    })
    this.pb = opts.pb
  }

  init (opts) {
    if (opts.src) {
      this.src = opts.src
      this.tex = this.regl.texture(this.src)
    }
    if(opts.dynamic) this.dynamic = opts.dynamic
  }

  initCam (index) {
    const self = this
    Webcam(index).then((response) => {
      self.src = response.video
      self.tex = self.regl.texture(self.src)
    }).catch((err) => console.log('could not get camera', err))
  }

  initStream (streamName) {
  //  console.log("initing stream!", streamName)
    let self = this
    if (streamName && this.pb) {
        this.pb.initSource(streamName)

        this.pb.on("got video", function(nick, video){
          if(nick === streamName) {
            self.src = video
            self.tex = self.regl.texture(self.src)
          }
        })

    }
  }

  initScreen () {
    const self = this
    Screen().then(function (response) {
       self.src = response.video
       self.tex = self.regl.texture(self.src)
     //  console.log("received screen input")
   }).catch((err) => console.log('could not get screen', err))
  }

  resize (width, height) {
    this.width = width
    this.height = height
  }

  clear () {
    if(this.src && this.src.srcObject) {
      if (this.src.srcObject.getTracks) {
        this.src.srcObject.getTracks().forEach((track) => track.stop())
      }
    }
    this.src = null
    this.tex = this.regl.texture({
      shape: [1, 1]
    })
  }

  tick (time) {
    //  console.log(this.src, this.tex.width, this.tex.height)
    if (this.src !== null && this.dynamic === true) {
        if(this.src.videoWidth && this.src.videoWidth !== this.tex.width) {
          console.log(this.src.videoWidth, this.src.videoHeight, this.tex.width, this.tex.height)
          this.tex.resize(this.src.videoWidth, this.src.videoHeight)
        }

        if(this.src.width && this.src.width !== this.tex.width)   this.tex.resize(this.src.width, this.src.height)

        this.tex.subimage(this.src)
    }
  }

  getTexture () {
    return this.tex
  }
}

module.exports = HydraSource

},{"./lib/screenmedia.js":14,"./lib/webcam.js":16}],10:[function(require,module,exports){
// WIP utils for working with arrays
// Possibly should be integrated with lfo extension, etc.
// to do: transform time rather than array values, similar to working with coordinates in hydra

var easing = require('./easing-functions.js')

var map = (num, in_min, in_max, out_min, out_max) => {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

module.exports = {
  init: () => {

    Array.prototype.fast = function(speed = 1) {
      this._speed = speed
      return this
    }

    Array.prototype.smooth = function(smooth = 1) {
      this._smooth = smooth
      return this
    }

    Array.prototype.ease = function(ease = 'linear') {
      if (typeof ease == 'function') {
        this._smooth = 1
        this._ease = ease
      }
      else if (easing[ease]){
        this._smooth = 1
        this._ease = easing[ease]
      }
      return this
    }

    Array.prototype.offset = function(offset = 0.5) {
      this._offset = offset%1.0
      return this
    }

    // Array.prototype.bounce = function() {
    //   this.modifiers.bounce = true
    //   return this
    // }

    Array.prototype.fit = function(low = 0, high =1) {
      let lowest = Math.min(...this)
      let highest =  Math.max(...this)
      var newArr = this.map((num) => map(num, lowest, highest, low, high))
      newArr._speed = this._speed
      newArr._smooth = this._smooth
      newArr._ease = this._ease
      return newArr
    }
  },

  getValue: (arr = []) => ({time, bpm}) =>{
    let speed = arr._speed ? arr._speed : 1
    let smooth = arr._smooth ? arr._smooth : 0
    let index = time * speed * (bpm / 60) + (arr._offset || 0)

    if (smooth!==0) {
      let ease = arr._ease ? arr._ease : easing['linear']
      let _index = index - (smooth / 2)
      let currValue = arr[Math.floor(_index % (arr.length))]
      let nextValue = arr[Math.floor((_index + 1) % (arr.length))]
      let t = Math.min((_index%1)/smooth,1)
      return ease(t) * (nextValue - currValue) + currValue
    }
    else {
      return arr[Math.floor(index % (arr.length))]
    }
  }
}

},{"./easing-functions.js":12}],11:[function(require,module,exports){
const Meyda = require('meyda')

class Audio {
  constructor ({
    numBins = 4,
    cutoff = 2,
    smooth = 0.4,
    max = 15,
    scale = 10,
    isDrawing = false
  }) {
    this.vol = 0
    this.scale = scale
    this.max = max
    this.cutoff = cutoff
    this.smooth = smooth
    this.setBins(numBins)

    // beat detection from: https://github.com/therewasaguy/p5-music-viz/blob/gh-pages/demos/01d_beat_detect_amplitude/sketch.js
    this.beat = {
      holdFrames: 20,
      threshold: 40,
      _cutoff: 0, // adaptive based on sound state
      decay: 0.98,
      _framesSinceBeat: 0 // keeps track of frames
    }

    this.onBeat = () => {
    //  console.log("beat")
    }

    this.canvas = document.createElement('canvas')
    this.canvas.width = 100
    this.canvas.height = 80
    this.canvas.style.width = "100px"
    this.canvas.style.height = "80px"
    this.canvas.style.position = 'absolute'
    this.canvas.style.right = '0px'
    this.canvas.style.bottom = '0px'
    document.body.appendChild(this.canvas)

    this.isDrawing = isDrawing
    this.ctx = this.canvas.getContext('2d')
    this.ctx.fillStyle="#DFFFFF"
    this.ctx.strokeStyle="#0ff"
    this.ctx.lineWidth=0.5

    window.navigator.mediaDevices.getUserMedia({video: false, audio: true})
      .then((stream) => {
      //  console.log('got mic stream', stream)
        this.stream = stream
        this.context = new AudioContext()
        //  this.context = new AudioContext()
        let audio_stream = this.context.createMediaStreamSource(stream)

      //  console.log(this.context)
        this.meyda = Meyda.createMeydaAnalyzer({
          audioContext: this.context,
          source: audio_stream,
          featureExtractors: [
            'loudness',
            //  'perceptualSpread',
            //  'perceptualSharpness',
            //  'spectralCentroid'
          ]
        })
      })
      .catch((err) => console.log('ERROR', err))
  }

  detectBeat (level) {
    //console.log(level,   this.beat._cutoff)
    if (level > this.beat._cutoff && level > this.beat.threshold) {
      this.onBeat()
      this.beat._cutoff = level *1.2
      this.beat._framesSinceBeat = 0
    } else {
      if (this.beat._framesSinceBeat <= this.beat.holdFrames){
        this.beat._framesSinceBeat ++;
      } else {
        this.beat._cutoff *= this.beat.decay
        this.beat._cutoff = Math.max(  this.beat._cutoff, this.beat.threshold);
      }
    }
  }

  tick() {
   if(this.meyda){
     var features = this.meyda.get()
     if(features && features !== null){
       this.vol = features.loudness.total
       this.detectBeat(this.vol)
       // reduce loudness array to number of bins
       const reducer = (accumulator, currentValue) => accumulator + currentValue;
       let spacing = Math.floor(features.loudness.specific.length/this.bins.length)
       this.prevBins = this.bins.slice(0)
       this.bins = this.bins.map((bin, index) => {
         return features.loudness.specific.slice(index * spacing, (index + 1)*spacing).reduce(reducer)
       }).map((bin, index) => {
         // map to specified range

        // return (bin * (1.0 - this.smooth) + this.prevBins[index] * this.smooth)
          return (bin * (1.0 - this.settings[index].smooth) + this.prevBins[index] * this.settings[index].smooth)
       })
       // var y = this.canvas.height - scale*this.settings[index].cutoff
       // this.ctx.beginPath()
       // this.ctx.moveTo(index*spacing, y)
       // this.ctx.lineTo((index+1)*spacing, y)
       // this.ctx.stroke()
       //
       // var yMax = this.canvas.height - scale*(this.settings[index].scale + this.settings[index].cutoff)
       this.fft = this.bins.map((bin, index) => (
        // Math.max(0, (bin - this.cutoff) / (this.max - this.cutoff))
         Math.max(0, (bin - this.settings[index].cutoff)/this.settings[index].scale)
       ))
       if(this.isDrawing) this.draw()
     }
   }
  }

  setCutoff (cutoff) {
    this.cutoff = cutoff
    this.settings = this.settings.map((el) => {
      el.cutoff = cutoff
      return el
    })
  }

  setSmooth (smooth) {
    this.smooth = smooth
    this.settings = this.settings.map((el) => {
      el.smooth = smooth
      return el
    })
  }

  setBins (numBins) {
    this.bins = Array(numBins).fill(0)
    this.prevBins = Array(numBins).fill(0)
    this.fft = Array(numBins).fill(0)
    this.settings = Array(numBins).fill(0).map(() => ({
      cutoff: this.cutoff,
      scale: this.scale,
      smooth: this.smooth
    }))
    // to do: what to do in non-global mode?
    this.bins.forEach((bin, index) => {
      window['a' + index] = (scale = 1, offset = 0) => () => (a.fft[index] * scale + offset)
    })
  //  console.log(this.settings)
  }

  setScale(scale){
    this.scale = scale
    this.settings = this.settings.map((el) => {
      el.scale = scale
      return el
    })
  }

  setMax(max) {
    this.max = max
    console.log('set max is deprecated')
  }
  hide() {
    this.isDrawing = false
    this.canvas.style.display = 'none'
  }

  show() {
    this.isDrawing = true
    this.canvas.style.display = 'block'

  }

  draw () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    var spacing = this.canvas.width / this.bins.length
    var scale = this.canvas.height / (this.max * 2)
  //  console.log(this.bins)
    this.bins.forEach((bin, index) => {

      var height = bin * scale

     this.ctx.fillRect(index * spacing, this.canvas.height - height, spacing, height)

  //   console.log(this.settings[index])
     var y = this.canvas.height - scale*this.settings[index].cutoff
     this.ctx.beginPath()
     this.ctx.moveTo(index*spacing, y)
     this.ctx.lineTo((index+1)*spacing, y)
     this.ctx.stroke()

     var yMax = this.canvas.height - scale*(this.settings[index].scale + this.settings[index].cutoff)
     this.ctx.beginPath()
     this.ctx.moveTo(index*spacing, yMax)
     this.ctx.lineTo((index+1)*spacing, yMax)
     this.ctx.stroke()
    })


    /*var y = this.canvas.height - scale*this.cutoff
    this.ctx.beginPath()
    this.ctx.moveTo(0, y)
    this.ctx.lineTo(this.canvas.width, y)
    this.ctx.stroke()
    var yMax = this.canvas.height - scale*this.max
    this.ctx.beginPath()
    this.ctx.moveTo(0, yMax)
    this.ctx.lineTo(this.canvas.width, yMax)
    this.ctx.stroke()*/
  }
}

module.exports = Audio

},{"meyda":19}],12:[function(require,module,exports){
// from https://gist.github.com/gre/1650294

module.exports = {
  // no easing, no acceleration
  linear: function (t) { return t },
  // accelerating from zero velocity
  easeInQuad: function (t) { return t*t },
  // decelerating to zero velocity
  easeOutQuad: function (t) { return t*(2-t) },
  // acceleration until halfway, then deceleration
  easeInOutQuad: function (t) { return t<.5 ? 2*t*t : -1+(4-2*t)*t },
  // accelerating from zero velocity
  easeInCubic: function (t) { return t*t*t },
  // decelerating to zero velocity
  easeOutCubic: function (t) { return (--t)*t*t+1 },
  // acceleration until halfway, then deceleration
  easeInOutCubic: function (t) { return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1 },
  // accelerating from zero velocity
  easeInQuart: function (t) { return t*t*t*t },
  // decelerating to zero velocity
  easeOutQuart: function (t) { return 1-(--t)*t*t*t },
  // acceleration until halfway, then deceleration
  easeInOutQuart: function (t) { return t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t },
  // accelerating from zero velocity
  easeInQuint: function (t) { return t*t*t*t*t },
  // decelerating to zero velocity
  easeOutQuint: function (t) { return 1+(--t)*t*t*t*t },
  // acceleration until halfway, then deceleration
  easeInOutQuint: function (t) { return t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t },
  // sin shape
  sin: function (t) { return (1 + Math.sin(Math.PI*t-Math.PI/2))/2 }
}

},{}],13:[function(require,module,exports){
// attempt custom evaluation sandbox for hydra functions
// for now, just avoids polluting the global namespace
// should probably be replaced with an abstract syntax tree

module.exports = (parent) => {
  var initialCode = ``

  var sandbox = createSandbox(initialCode)

  var addToContext = (name, object) => {
    initialCode += `
      var ${name} = ${object}
    `
    sandbox = createSandbox(initialCode)
  }


  return {
    addToContext: addToContext,
    eval: (code) => sandbox.eval(code)
  }

  function createSandbox (initial) {
    eval(initial)
    // optional params
    var localEval = function (code)  {
      eval(code)
    }

    // API/data for end-user
    return {
      eval: localEval
    }
  }
}

},{}],14:[function(require,module,exports){

module.exports = function (options) {
  return new Promise(function(resolve, reject) {
    //  async function startCapture(displayMediaOptions) {
    navigator.mediaDevices.getDisplayMedia(options).then((stream) => {
      const video = document.createElement('video')
      video.srcObject = stream
      video.addEventListener('loadedmetadata', () => {
        video.play()
        resolve({video: video})
      })
    }).catch((err) => reject(err))
  })
}

},{}],15:[function(require,module,exports){
class VideoRecorder {
  constructor(stream) {
    this.mediaSource = new MediaSource()
    this.stream = stream

    // testing using a recording as input
    this.output = document.createElement('video')
    this.output.autoplay = true
    this.output.loop = true

    let self = this
    this.mediaSource.addEventListener('sourceopen', () => {
      console.log('MediaSource opened');
      self.sourceBuffer = self.mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
      console.log('Source buffer: ', sourceBuffer);
    })
  }

  start() {
  //  let options = {mimeType: 'video/webm'};

//   let options = {mimeType: 'video/webm;codecs=h264'};
   let options = {mimeType: 'video/webm;codecs=vp9'};

    this.recordedBlobs = []
    try {
     this.mediaRecorder = new MediaRecorder(this.stream, options)
    } catch (e0) {
     console.log('Unable to create MediaRecorder with options Object: ', e0)
     try {
       options = {mimeType: 'video/webm,codecs=vp9'}
       this.mediaRecorder = new MediaRecorder(this.stream, options)
     } catch (e1) {
       console.log('Unable to create MediaRecorder with options Object: ', e1)
       try {
         options = 'video/vp8' // Chrome 47
         this.mediaRecorder = new MediaRecorder(this.stream, options)
       } catch (e2) {
         alert('MediaRecorder is not supported by this browser.\n\n' +
           'Try Firefox 29 or later, or Chrome 47 or later, ' +
           'with Enable experimental Web Platform features enabled from chrome://flags.')
         console.error('Exception while creating MediaRecorder:', e2)
         return
       }
     }
   }
   console.log('Created MediaRecorder', this.mediaRecorder, 'with options', options);
   this.mediaRecorder.onstop = this._handleStop.bind(this)
   this.mediaRecorder.ondataavailable = this._handleDataAvailable.bind(this)
   this.mediaRecorder.start(100) // collect 100ms of data
   console.log('MediaRecorder started', this.mediaRecorder)
 }

  
   stop(){
     this.mediaRecorder.stop()
   }

 _handleStop() {
   //const superBuffer = new Blob(recordedBlobs, {type: 'video/webm'})
   // const blob = new Blob(this.recordedBlobs, {type: 'video/webm;codecs=h264'})
  const blob = new Blob(this.recordedBlobs, {type: this.mediaRecorder.mimeType})
   const url = window.URL.createObjectURL(blob)
   this.output.src = url

    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    let d = new Date()
    a.download = `hydra-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}.${d.getMinutes()}.${d.getSeconds()}.webm`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 300);
  }

  _handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
      this.recordedBlobs.push(event.data);
    }
  }
}

module.exports = VideoRecorder

},{}],16:[function(require,module,exports){
//const enumerateDevices = require('enumerate-devices')

module.exports = function (deviceId) {
  return navigator.mediaDevices.enumerateDevices()
    .then(devices => devices.filter(devices => devices.kind === 'videoinput'))
    .then(cameras => {
      let constraints = { audio: false, video: true}
      if (cameras[deviceId]) {
        constraints['video'] = {
          deviceId: { exact: cameras[deviceId].deviceId }
        }
      }
    //  console.log(cameras)
      return window.navigator.mediaDevices.getUserMedia(constraints)
    })
    .then(stream => {
      const video = document.createElement('video')
      //  video.src = window.URL.createObjectURL(stream)
      video.srcObject = stream
      return new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', () => {
          video.play().then(() => resolve({video: video}))
        })
      })
    })
    .catch(console.log.bind(console))
}

},{}],17:[function(require,module,exports){
//const transforms = require('./glsl-transforms.js')

var Output = function (opts) {
  this.regl = opts.regl
  this.precision = opts.precision
  this.positionBuffer = this.regl.buffer([
    [-2, 0],
    [0, -2],
    [2, 2]
  ])

  this.draw = () => {}
  this.init()
  this.pingPongIndex = 0

  // for each output, create two fbos for pingponging
  this.fbos = (Array(2)).fill().map(() => this.regl.framebuffer({
    color: this.regl.texture({
      mag: 'nearest',
      width: opts.width,
      height: opts.height,
      format: 'rgba'
    }),
    depthStencil: false
  }))

  // array containing render passes
//  this.passes = []
}

Output.prototype.resize = function(width, height) {
  this.fbos.forEach((fbo) => {
    fbo.resize(width, height)
  })
//  console.log(this)
}


Output.prototype.getCurrent = function () {
  return this.fbos[this.pingPongIndex]
}

Output.prototype.getTexture = function () {
   var index = this.pingPongIndex ? 0 : 1
  return this.fbos[index]
}

Output.prototype.init = function () {
//  console.log('clearing')
  this.transformIndex = 0
  this.fragHeader = `
  precision ${this.precision} float;

  uniform float time;
  varying vec2 uv;
  `
  this.fragBody = ``

  this.vert = `
  precision ${this.precision} float;
  attribute vec2 position;
  varying vec2 uv;

  void main () {
    uv = position;
    gl_Position = vec4(2.0 * position - 1.0, 0, 1);
  }`

  this.attributes = {
    position: this.positionBuffer
  }
  this.uniforms = {
    time: this.regl.prop('time'),
    resolution: this.regl.prop('resolution')
  }

  this.frag = `
       ${this.fragHeader}

      void main () {
        vec4 c = vec4(0, 0, 0, 0);
        vec2 st = uv;
        ${this.fragBody}
        gl_FragColor = c;
      }
  `
  return this
}


Output.prototype.render = function (passes) {
  let pass = passes[0]
  //console.log('pass', pass, this.pingPongIndex)
  var self = this
      var uniforms = Object.assign(pass.uniforms, { prevBuffer:  () =>  {
             //var index = this.pingPongIndex ? 0 : 1
          //   var index = self.pingPong[(passIndex+1)%2]
          //  console.log('ping pong', self.pingPongIndex)
            return self.fbos[self.pingPongIndex]
          }
        })

  self.draw = self.regl({
    frag: pass.frag,
    vert: self.vert,
    attributes: self.attributes,
    uniforms: uniforms,
    count: 3,
    framebuffer: () => {
      self.pingPongIndex = self.pingPongIndex ? 0 : 1
      return self.fbos[self.pingPongIndex]
    }
  })
}


Output.prototype.tick = function (props) {
//  console.log(props)
  this.draw(props)
}

module.exports = Output

},{}],18:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],19:[function(require,module,exports){
!function(t,r){"object"==typeof exports&&"object"==typeof module?module.exports=r():"function"==typeof define&&define.amd?define([],r):"object"==typeof exports?exports.Meyda=r():t.Meyda=r()}(this,function(){return function(t){function r(n){if(e[n])return e[n].exports;var o=e[n]={i:n,l:!1,exports:{}};return t[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}var e={};return r.m=t,r.c=e,r.i=function(t){return t},r.d=function(t,e,n){r.o(t,e)||Object.defineProperty(t,e,{configurable:!1,enumerable:!0,get:n})},r.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return r.d(e,"a",e),e},r.o=function(t,r){return Object.prototype.hasOwnProperty.call(t,r)},r.p="",r(r.s=23)}([function(t,r,e){"use strict";function n(t){if(Array.isArray(t)){for(var r=0,e=Array(t.length);r<t.length;r++)e[r]=t[r];return e}return Array.from(t)}function o(t){for(;t%2==0&&t>1;)t/=2;return 1===t}function i(t,r){for(var e=[],n=0;n<Math.min(t.length,r.length);n++)e[n]=t[n]*r[n];return e}function a(t,r){if("rect"!==r){if(""!==r&&r||(r="hanning"),g[r]||(g[r]={}),!g[r][t.length])try{g[r][t.length]=b[r](t.length)}catch(t){throw new Error("Invalid windowing function")}t=i(t,g[r][t.length])}return t}function u(t,r,e){for(var n=new Float32Array(t),o=0;o<n.length;o++)n[o]=o*r/e,n[o]=13*Math.atan(n[o]/1315.8)+3.5*Math.atan(Math.pow(n[o]/7518,2));return n}function c(t){return Float32Array.from(t)}function f(t){return 700*(Math.exp(t/1125)-1)}function l(t){return 1125*Math.log(1+t/700)}function s(t,r,e){for(var n=new Float32Array(t+2),o=new Float32Array(t+2),i=r/2,a=l(0),u=l(i),c=u-a,s=c/(t+1),p=Array(t+2),m=0;m<n.length;m++)n[m]=m*s,o[m]=f(n[m]),p[m]=Math.floor((e+1)*o[m]/r);for(var y=Array(t),h=0;h<y.length;h++){y[h]=Array.apply(null,new Array(e/2+1)).map(Number.prototype.valueOf,0);for(var b=p[h];b<p[h+1];b++)y[h][b]=(b-p[h])/(p[h+1]-p[h]);for(var g=p[h+1];g<p[h+2];g++)y[h][g]=(p[h+2]-g)/(p[h+2]-p[h+1])}return y}function p(t,r){return Math.log2(16*t/r)}function m(t){var r=t[0].map(function(){return 0}),e=t.reduce(function(t,r){return r.forEach(function(r,e){t[e]+=Math.pow(r,2)}),t},r).map(Math.sqrt);return t.map(function(t,r){return t.map(function(t,r){return t/(e[r]||1)})})}function y(t,r,e){var o=arguments.length>3&&void 0!==arguments[3]?arguments[3]:5,i=arguments.length>4&&void 0!==arguments[4]?arguments[4]:2,a=!(arguments.length>5&&void 0!==arguments[5])||arguments[5],u=arguments.length>6&&void 0!==arguments[6]?arguments[6]:440,c=Math.floor(e/2)+1,f=new Array(e).fill(0).map(function(n,o){return t*p(r*o/e,u)});f[0]=f[1]-1.5*t;var l=f.slice(1).map(function(t,r){return Math.max(t-f[r])},1).concat([1]),s=Math.round(t/2),y=new Array(t).fill(0).map(function(r,e){return f.map(function(r){return(10*t+s+r-e)%t-s})}),h=y.map(function(t,r){return t.map(function(t,e){return Math.exp(-.5*Math.pow(2*y[r][e]/l[e],2))})});if(h=m(h),i){var b=f.map(function(r){return Math.exp(-.5*Math.pow((r/t-o)/i,2))});h=h.map(function(t){return t.map(function(t,r){return t*b[r]})})}return a&&(h=[].concat(n(h.slice(3)),n(h.slice(0,3)))),h.map(function(t){return t.slice(0,c)})}function h(t,r,e){if(t.length<r)throw new Error("Buffer is too short for frame length");if(e<1)throw new Error("Hop length cannot be less that 1");if(r<1)throw new Error("Frame length cannot be less that 1");var n=1+Math.floor((t.length-r)/e);return new Array(n).fill(0).map(function(n,o){return t.slice(o*e,o*e+r)})}r.b=o,r.a=a,r.c=u,r.f=c,r.d=s,r.e=y,r.g=h;var b=e(25),g={}},function(t,r,e){"use strict";function n(t,r){for(var e=0,n=0,o=0;o<r.length;o++)e+=Math.pow(o,t)*Math.abs(r[o]),n+=r[o];return e/n}r.a=n},function(t,r,e){"use strict";var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(t){if("object"!==n(t.ampSpectrum)||"object"!==n(t.barkScale))throw new TypeError;var r=new Float32Array(24),e=0,o=t.ampSpectrum,i=new Int32Array(25);i[0]=0;for(var a=t.barkScale[o.length-1]/24,u=1,c=0;c<o.length;c++)for(;t.barkScale[c]>a;)i[u++]=c,a=u*t.barkScale[o.length-1]/24;i[24]=o.length-1;for(var f=0;f<24;f++){for(var l=0,s=i[f];s<i[f+1];s++)l+=o[s];r[f]=Math.pow(l,.23)}for(var p=0;p<r.length;p++)e+=r[p];return{specific:r,total:e}}},function(t,r,e){"use strict";var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(){if("object"!==n(arguments[0].ampSpectrum))throw new TypeError;for(var t=new Float32Array(arguments[0].ampSpectrum.length),r=0;r<t.length;r++)t[r]=Math.pow(arguments[0].ampSpectrum[r],2);return t}},function(t,r,e){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),e.d(r,"buffer",function(){return v}),e.d(r,"complexSpectrum",function(){return w}),e.d(r,"amplitudeSpectrum",function(){return x});var n=e(13),o=e(9),i=e(20),a=e(14),u=e(18),c=e(15),f=e(21),l=e(19),s=e(17),p=e(22),m=e(2),y=e(12),h=e(11),b=e(10),g=e(8),S=e(3),d=e(16);e.d(r,"rms",function(){return n.a}),e.d(r,"energy",function(){return o.a}),e.d(r,"spectralSlope",function(){return i.a}),e.d(r,"spectralCentroid",function(){return a.a}),e.d(r,"spectralRolloff",function(){return u.a}),e.d(r,"spectralFlatness",function(){return c.a}),e.d(r,"spectralSpread",function(){return f.a}),e.d(r,"spectralSkewness",function(){return l.a}),e.d(r,"spectralKurtosis",function(){return s.a}),e.d(r,"zcr",function(){return p.a}),e.d(r,"loudness",function(){return m.a}),e.d(r,"perceptualSpread",function(){return y.a}),e.d(r,"perceptualSharpness",function(){return h.a}),e.d(r,"powerSpectrum",function(){return S.a}),e.d(r,"mfcc",function(){return b.a}),e.d(r,"chroma",function(){return g.a}),e.d(r,"spectralFlux",function(){return d.a});var v=function(t){return t.signal},w=function(t){return t.complexSpectrum},x=function(t){return t.ampSpectrum}},function(t,r){var e;e=function(){return this}();try{e=e||Function("return this")()||(0,eval)("this")}catch(t){"object"==typeof window&&(e=window)}t.exports=e},function(t,r,e){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e(0),o=e(4),i=e(28),a=(e.n(i),e(24)),u="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},c={audioContext:null,spn:null,bufferSize:512,sampleRate:44100,melBands:26,chromaBands:12,callback:null,windowingFunction:"hanning",featureExtractors:o,EXTRACTION_STARTED:!1,_featuresToExtract:[],windowing:n.a,_errors:{notPow2:new Error("Meyda: Buffer size must be a power of 2, e.g. 64 or 512"),featureUndef:new Error("Meyda: No features defined."),invalidFeatureFmt:new Error("Meyda: Invalid feature format"),invalidInput:new Error("Meyda: Invalid input."),noAC:new Error("Meyda: No AudioContext specified."),noSource:new Error("Meyda: No source node specified.")},createMeydaAnalyzer:function(t){return new a.a(t,c)},extract:function(t,r,e){if(!r)throw this._errors.invalidInput;if("object"!=(void 0===r?"undefined":u(r)))throw this._errors.invalidInput;if(!t)throw this._errors.featureUndef;if(!n.b(r.length))throw this._errors.notPow2;void 0!==this.barkScale&&this.barkScale.length==this.bufferSize||(this.barkScale=n.c(this.bufferSize,this.sampleRate,this.bufferSize)),void 0!==this.melFilterBank&&this.barkScale.length==this.bufferSize&&this.melFilterBank.length==this.melBands||(this.melFilterBank=n.d(this.melBands,this.sampleRate,this.bufferSize)),void 0!==this.chromaFilterBank&&this.chromaFilterBank.length==this.chromaBands||(this.chromaFilterBank=n.e(this.chromaBands,this.sampleRate,this.bufferSize)),void 0===r.buffer?this.signal=n.f(r):this.signal=r;var o=f(r,this.windowingFunction,this.bufferSize);if(this.signal=o.windowedSignal,this.complexSpectrum=o.complexSpectrum,this.ampSpectrum=o.ampSpectrum,e){var i=f(e,this.windowingFunction,this.bufferSize);this.previousSignal=i.windowedSignal,this.previousComplexSpectrum=i.complexSpectrum,this.previousAmpSpectrum=i.ampSpectrum}if("object"===(void 0===t?"undefined":u(t))){for(var a={},c=0;c<t.length;c++)a[t[c]]=this.featureExtractors[t[c]]({ampSpectrum:this.ampSpectrum,chromaFilterBank:this.chromaFilterBank,complexSpectrum:this.complexSpectrum,signal:this.signal,bufferSize:this.bufferSize,sampleRate:this.sampleRate,barkScale:this.barkScale,melFilterBank:this.melFilterBank,previousSignal:this.previousSignal,previousAmpSpectrum:this.previousAmpSpectrum,previousComplexSpectrum:this.previousComplexSpectrum});return a}if("string"==typeof t)return this.featureExtractors[t]({ampSpectrum:this.ampSpectrum,chromaFilterBank:this.chromaFilterBank,complexSpectrum:this.complexSpectrum,signal:this.signal,bufferSize:this.bufferSize,sampleRate:this.sampleRate,barkScale:this.barkScale,melFilterBank:this.melFilterBank,previousSignal:this.previousSignal,previousAmpSpectrum:this.previousAmpSpectrum,previousComplexSpectrum:this.previousComplexSpectrum});throw this._errors.invalidFeatureFmt}},f=function(t,r,o){var a={};void 0===t.buffer?a.signal=n.f(t):a.signal=t,a.windowedSignal=n.a(a.signal,r),a.complexSpectrum=e.i(i.fft)(a.windowedSignal),a.ampSpectrum=new Float32Array(o/2);for(var u=0;u<o/2;u++)a.ampSpectrum[u]=Math.sqrt(Math.pow(a.complexSpectrum.real[u],2)+Math.pow(a.complexSpectrum.imag[u],2));return a};r.default=c,"undefined"!=typeof window&&(window.Meyda=c)},function(t,r,e){"use strict";(function(r){/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function n(t,r){if(t===r)return 0;for(var e=t.length,n=r.length,o=0,i=Math.min(e,n);o<i;++o)if(t[o]!==r[o]){e=t[o],n=r[o];break}return e<n?-1:n<e?1:0}function o(t){return r.Buffer&&"function"==typeof r.Buffer.isBuffer?r.Buffer.isBuffer(t):!(null==t||!t._isBuffer)}function i(t){return Object.prototype.toString.call(t)}function a(t){return!o(t)&&("function"==typeof r.ArrayBuffer&&("function"==typeof ArrayBuffer.isView?ArrayBuffer.isView(t):!!t&&(t instanceof DataView||!!(t.buffer&&t.buffer instanceof ArrayBuffer))))}function u(t){if(v.isFunction(t)){if(E)return t.name;var r=t.toString(),e=r.match(M);return e&&e[1]}}function c(t,r){return"string"==typeof t?t.length<r?t:t.slice(0,r):t}function f(t){if(E||!v.isFunction(t))return v.inspect(t);var r=u(t);return"[Function"+(r?": "+r:"")+"]"}function l(t){return c(f(t.actual),128)+" "+t.operator+" "+c(f(t.expected),128)}function s(t,r,e,n,o){throw new _.AssertionError({message:e,actual:t,expected:r,operator:n,stackStartFunction:o})}function p(t,r){t||s(t,!0,r,"==",_.ok)}function m(t,r,e,u){if(t===r)return!0;if(o(t)&&o(r))return 0===n(t,r);if(v.isDate(t)&&v.isDate(r))return t.getTime()===r.getTime();if(v.isRegExp(t)&&v.isRegExp(r))return t.source===r.source&&t.global===r.global&&t.multiline===r.multiline&&t.lastIndex===r.lastIndex&&t.ignoreCase===r.ignoreCase;if(null!==t&&"object"==typeof t||null!==r&&"object"==typeof r){if(a(t)&&a(r)&&i(t)===i(r)&&!(t instanceof Float32Array||t instanceof Float64Array))return 0===n(new Uint8Array(t.buffer),new Uint8Array(r.buffer));if(o(t)!==o(r))return!1;u=u||{actual:[],expected:[]};var c=u.actual.indexOf(t);return-1!==c&&c===u.expected.indexOf(r)||(u.actual.push(t),u.expected.push(r),h(t,r,e,u))}return e?t===r:t==r}function y(t){return"[object Arguments]"==Object.prototype.toString.call(t)}function h(t,r,e,n){if(null===t||void 0===t||null===r||void 0===r)return!1;if(v.isPrimitive(t)||v.isPrimitive(r))return t===r;if(e&&Object.getPrototypeOf(t)!==Object.getPrototypeOf(r))return!1;var o=y(t),i=y(r);if(o&&!i||!o&&i)return!1;if(o)return t=x.call(t),r=x.call(r),m(t,r,e);var a,u,c=A(t),f=A(r);if(c.length!==f.length)return!1;for(c.sort(),f.sort(),u=c.length-1;u>=0;u--)if(c[u]!==f[u])return!1;for(u=c.length-1;u>=0;u--)if(a=c[u],!m(t[a],r[a],e,n))return!1;return!0}function b(t,r,e){m(t,r,!0)&&s(t,r,e,"notDeepStrictEqual",b)}function g(t,r){if(!t||!r)return!1;if("[object RegExp]"==Object.prototype.toString.call(r))return r.test(t);try{if(t instanceof r)return!0}catch(t){}return!Error.isPrototypeOf(r)&&!0===r.call({},t)}function S(t){var r;try{t()}catch(t){r=t}return r}function d(t,r,e,n){var o;if("function"!=typeof r)throw new TypeError('"block" argument must be a function');"string"==typeof e&&(n=e,e=null),o=S(r),n=(e&&e.name?" ("+e.name+").":".")+(n?" "+n:"."),t&&!o&&s(o,e,"Missing expected exception"+n);var i="string"==typeof n,a=!t&&v.isError(o),u=!t&&o&&!e;if((a&&i&&g(o,e)||u)&&s(o,e,"Got unwanted exception"+n),t&&o&&e&&!g(o,e)||!t&&o)throw o}var v=e(33),w=Object.prototype.hasOwnProperty,x=Array.prototype.slice,E=function(){return"foo"===function(){}.name}(),_=t.exports=p,M=/\s*function\s+([^\(\s]*)\s*/;_.AssertionError=function(t){this.name="AssertionError",this.actual=t.actual,this.expected=t.expected,this.operator=t.operator,t.message?(this.message=t.message,this.generatedMessage=!1):(this.message=l(this),this.generatedMessage=!0);var r=t.stackStartFunction||s;if(Error.captureStackTrace)Error.captureStackTrace(this,r);else{var e=new Error;if(e.stack){var n=e.stack,o=u(r),i=n.indexOf("\n"+o);if(i>=0){var a=n.indexOf("\n",i+1);n=n.substring(a+1)}this.stack=n}}},v.inherits(_.AssertionError,Error),_.fail=s,_.ok=p,_.equal=function(t,r,e){t!=r&&s(t,r,e,"==",_.equal)},_.notEqual=function(t,r,e){t==r&&s(t,r,e,"!=",_.notEqual)},_.deepEqual=function(t,r,e){m(t,r,!1)||s(t,r,e,"deepEqual",_.deepEqual)},_.deepStrictEqual=function(t,r,e){m(t,r,!0)||s(t,r,e,"deepStrictEqual",_.deepStrictEqual)},_.notDeepEqual=function(t,r,e){m(t,r,!1)&&s(t,r,e,"notDeepEqual",_.notDeepEqual)},_.notDeepStrictEqual=b,_.strictEqual=function(t,r,e){t!==r&&s(t,r,e,"===",_.strictEqual)},_.notStrictEqual=function(t,r,e){t===r&&s(t,r,e,"!==",_.notStrictEqual)},_.throws=function(t,r,e){d(!0,t,r,e)},_.doesNotThrow=function(t,r,e){d(!1,t,r,e)},_.ifError=function(t){if(t)throw t};var A=Object.keys||function(t){var r=[];for(var e in t)w.call(t,e)&&r.push(e);return r}}).call(r,e(5))},function(t,r,e){"use strict";function n(t){if(Array.isArray(t)){for(var r=0,e=Array(t.length);r<t.length;r++)e[r]=t[r];return e}return Array.from(t)}var o=(e(0),"function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t});r.a=function(t){if("object"!==o(t.ampSpectrum))throw new TypeError("Valid ampSpectrum is required to generate chroma");if("object"!==o(t.chromaFilterBank))throw new TypeError("Valid chromaFilterBank is required to generate chroma");var r=t.chromaFilterBank.map(function(r,e){return t.ampSpectrum.reduce(function(t,e,n){return t+e*r[n]},0)}),e=Math.max.apply(Math,n(r));return e?r.map(function(t){return t/e}):r}},function(t,r,e){"use strict";var n=e(7),o=(e.n(n),"function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t});r.a=function(){if("object"!==o(arguments[0].signal))throw new TypeError;for(var t=0,r=0;r<arguments[0].signal.length;r++)t+=Math.pow(Math.abs(arguments[0].signal[r]),2);return t}},function(t,r,e){"use strict";var n=e(3),o=(e(0),"function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t}),i=e(26);r.a=function(t){if("object"!==o(t.ampSpectrum))throw new TypeError("Valid ampSpectrum is required to generate MFCC");if("object"!==o(t.melFilterBank))throw new TypeError("Valid melFilterBank is required to generate MFCC");for(var r=e.i(n.a)(t),a=t.melFilterBank.length,u=Array(a),c=new Float32Array(a),f=0;f<c.length;f++){u[f]=new Float32Array(t.bufferSize/2),c[f]=0;for(var l=0;l<t.bufferSize/2;l++)u[f][l]=t.melFilterBank[f][l]*r[l],c[f]+=u[f][l];c[f]=Math.log(c[f]+1)}var s=Array.prototype.slice.call(c);return i(s).slice(0,13)}},function(t,r,e){"use strict";var n=e(2),o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(){if("object"!==o(arguments[0].signal))throw new TypeError;for(var t=e.i(n.a)(arguments[0]),r=t.specific,i=0,a=0;a<r.length;a++)i+=a<15?(a+1)*r[a+1]:.066*Math.exp(.171*(a+1));return i*=.11/t.total}},function(t,r,e){"use strict";var n=e(2),o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(){if("object"!==o(arguments[0].signal))throw new TypeError;for(var t=e.i(n.a)(arguments[0]),r=0,i=0;i<t.specific.length;i++)t.specific[i]>r&&(r=t.specific[i]);return Math.pow((t.total-r)/t.total,2)}},function(t,r,e){"use strict";var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(t){if("object"!==n(t.signal))throw new TypeError;for(var r=0,e=0;e<t.signal.length;e++)r+=Math.pow(t.signal[e],2);return r/=t.signal.length,r=Math.sqrt(r)}},function(t,r,e){"use strict";var n=e(1),o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(){if("object"!==o(arguments[0].ampSpectrum))throw new TypeError;return e.i(n.a)(1,arguments[0].ampSpectrum)}},function(t,r,e){"use strict";var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(){if("object"!==n(arguments[0].ampSpectrum))throw new TypeError;for(var t=0,r=0,e=0;e<arguments[0].ampSpectrum.length;e++)t+=Math.log(arguments[0].ampSpectrum[e]),r+=arguments[0].ampSpectrum[e];return Math.exp(t/arguments[0].ampSpectrum.length)*arguments[0].ampSpectrum.length/r}},function(t,r,e){"use strict";var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(t){if("object"!==n(t.signal)||"object"!=n(t.previousSignal))throw new TypeError;for(var r=0,e=-t.bufferSize/2;e<signal.length/2-1;e++)x=Math.abs(t.signal[e])-Math.abs(t.previousSignal[e]),r+=(x+Math.abs(x))/2;return r}},function(t,r,e){"use strict";var n=e(1),o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(){if("object"!==o(arguments[0].ampSpectrum))throw new TypeError;var t=arguments[0].ampSpectrum,r=e.i(n.a)(1,t),i=e.i(n.a)(2,t),a=e.i(n.a)(3,t),u=e.i(n.a)(4,t);return(-3*Math.pow(r,4)+6*r*i-4*r*a+u)/Math.pow(Math.sqrt(i-Math.pow(r,2)),4)}},function(t,r,e){"use strict";var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(){if("object"!==n(arguments[0].ampSpectrum))throw new TypeError;for(var t=arguments[0].ampSpectrum,r=arguments[0].sampleRate/(2*(t.length-1)),e=0,o=0;o<t.length;o++)e+=t[o];for(var i=.99*e,a=t.length-1;e>i&&a>=0;)e-=t[a],--a;return(a+1)*r}},function(t,r,e){"use strict";var n=e(1),o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(t){if("object"!==o(t.ampSpectrum))throw new TypeError;var r=e.i(n.a)(1,t.ampSpectrum),i=e.i(n.a)(2,t.ampSpectrum),a=e.i(n.a)(3,t.ampSpectrum);return(2*Math.pow(r,3)-3*r*i+a)/Math.pow(Math.sqrt(i-Math.pow(r,2)),3)}},function(t,r,e){"use strict";var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(t){if("object"!==n(t.ampSpectrum))throw new TypeError;for(var r=0,e=0,o=new Float32Array(t.ampSpectrum.length),i=0,a=0,u=0;u<t.ampSpectrum.length;u++){r+=t.ampSpectrum[u];var c=u*t.sampleRate/t.bufferSize;o[u]=c,i+=c*c,e+=c,a+=c*t.ampSpectrum[u]}return(t.ampSpectrum.length*a-e*r)/(r*(i-Math.pow(e,2)))}},function(t,r,e){"use strict";var n=e(1),o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(t){if("object"!==o(t.ampSpectrum))throw new TypeError;return Math.sqrt(e.i(n.a)(2,t.ampSpectrum)-Math.pow(e.i(n.a)(1,t.ampSpectrum),2))}},function(t,r,e){"use strict";var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};r.a=function(){if("object"!==n(arguments[0].signal))throw new TypeError;for(var t=0,r=0;r<arguments[0].signal.length;r++)(arguments[0].signal[r]>=0&&arguments[0].signal[r+1]<0||arguments[0].signal[r]<0&&arguments[0].signal[r+1]>=0)&&t++;return t}},function(t,r,e){t.exports=e(6).default},function(t,r,e){"use strict";function n(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}e.d(r,"a",function(){return u});var o=e(0),i=e(4),a=function(){function t(t,r){for(var e=0;e<r.length;e++){var n=r[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(r,e,n){return e&&t(r.prototype,e),n&&t(r,n),r}}(),u=function(){function t(r,e){var a=this;if(n(this,t),this._m=e,!r.audioContext)throw this._m.errors.noAC;if(r.bufferSize&&!o.b(r.bufferSize))throw this._m._errors.notPow2;if(!r.source)throw this._m._errors.noSource;this._m.audioContext=r.audioContext,this._m.bufferSize=r.bufferSize||this._m.bufferSize||256,this._m.hopSize=r.hopSize||this._m.hopSize||this._m.bufferSize,this._m.sampleRate=r.sampleRate||this._m.audioContext.sampleRate||44100,this._m.callback=r.callback,this._m.windowingFunction=r.windowingFunction||"hanning",this._m.featureExtractors=i,this._m.EXTRACTION_STARTED=r.startImmediately||!1,this._m.spn=this._m.audioContext.createScriptProcessor(this._m.bufferSize,1,1),this._m.spn.connect(this._m.audioContext.destination),this._m._featuresToExtract=r.featureExtractors||[],this._m.barkScale=o.c(this._m.bufferSize,this._m.sampleRate,this._m.bufferSize),this._m.melFilterBank=o.d(this._m.melBands,this._m.sampleRate,this._m.bufferSize),this._m.inputData=null,this._m.previousInputData=null,this._m.frame=null,this._m.previousFrame=null,this.setSource(r.source),this._m.spn.onaudioprocess=function(t){if(null!==a._m.inputData&&(a._m.previousInputData=a._m.inputData),a._m.inputData=t.inputBuffer.getChannelData(0),a._m.previousInputData){var r=new Float32Array(a._m.previousInputData.length+a._m.inputData.length-a._m.hopSize);r.set(a._m.previousInputData.slice(a._m.hopSize)),r.set(a._m.inputData,a._m.previousInputData.length-a._m.hopSize)}else var r=a._m.inputData;o.g(r,a._m.bufferSize,a._m.hopSize).forEach(function(t){a._m.frame=t;var r=a._m.extract(a._m._featuresToExtract,a._m.frame,a._m.previousFrame);"function"==typeof a._m.callback&&a._m.EXTRACTION_STARTED&&a._m.callback(r),a._m.previousFrame=a._m.frame})}}return a(t,[{key:"start",value:function(t){this._m._featuresToExtract=t||this._m._featuresToExtract,this._m.EXTRACTION_STARTED=!0}},{key:"stop",value:function(){this._m.EXTRACTION_STARTED=!1}},{key:"setSource",value:function(t){t.connect(this._m.spn)}},{key:"get",value:function(t){return this._m.inputData?this._m.extract(t||this._m._featuresToExtract,this._m.inputData,this._m.previousInputData):null}}]),t}()},function(t,r,e){"use strict";function n(t){for(var r=new Float32Array(t),e=2*Math.PI/(t-1),n=2*e,o=0;o<t/2;o++)r[o]=.42-.5*Math.cos(o*e)+.08*Math.cos(o*n);for(var i=t/2;i>0;i--)r[t-i]=r[i-1];return r}function o(t){for(var r=Math.PI/(t-1),e=new Float32Array(t),n=0;n<t;n++)e[n]=Math.sin(r*n);return e}function i(t){for(var r=new Float32Array(t),e=0;e<t;e++)r[e]=.5-.5*Math.cos(2*Math.PI*e/(t-1));return r}function a(t){for(var r=new Float32Array(t),e=0;e<t;e++)r[e]=.54-.46*Math.cos(2*Math.PI*(e/t-1));return r}Object.defineProperty(r,"__esModule",{value:!0}),r.blackman=n,r.sine=o,r.hanning=i,r.hamming=a},function(t,r,e){t.exports=e(27)},function(t,r){function e(t,r){var e=t.length;return r=r||2,cosMap&&cosMap[e]||n(e),t.map(function(){return 0}).map(function(n,o){return r*t.reduce(function(t,r,n,i){return t+r*cosMap[e][n+o*e]},0)})}cosMap=null;var n=function(t){cosMap=cosMap||{},cosMap[t]=new Array(t*t);for(var r=Math.PI/t,e=0;e<t;e++)for(var n=0;n<t;n++)cosMap[t][n+e*t]=Math.cos(r*(n+.5)*e)};t.exports=e},function(t,r,e){"use strict";var n=e(29),o=function(t){var r={};void 0===t.real||void 0===t.imag?r=n.constructComplexArray(t):(r.real=t.real.slice(),r.imag=t.imag.slice());var e=r.real.length,o=Math.log2(e);if(Math.round(o)!=o)throw new Error("Input size must be a power of 2.");if(r.real.length!=r.imag.length)throw new Error("Real and imaginary components must have the same length.");for(var i=n.bitReverseArray(e),a={real:[],imag:[]},u=0;u<e;u++)a.real[i[u]]=r.real[u],a.imag[i[u]]=r.imag[u];for(var c=0;c<e;c++)r.real[c]=a.real[c],r.imag[c]=a.imag[c];for(var f=1;f<=o;f++)for(var l=Math.pow(2,f),s=0;s<l/2;s++)for(var p=n.euler(s,l),m=0;m<e/l;m++){var y=l*m+s,h=l*m+s+l/2,b={real:r.real[y],imag:r.imag[y]},g={real:r.real[h],imag:r.imag[h]},S=n.multiply(p,g),d=n.subtract(b,S);r.real[h]=d.real,r.imag[h]=d.imag;var v=n.add(S,b);r.real[y]=v.real,r.imag[y]=v.imag}return r},i=function(t){if(void 0===t.real||void 0===t.imag)throw new Error("IFFT only accepts a complex input.");for(var r=t.real.length,e={real:[],imag:[]},i=0;i<r;i++){var a={real:t.real[i],imag:t.imag[i]},u=n.conj(a);e.real[i]=u.real,e.imag[i]=u.imag}var c=o(e);return e.real=c.real.map(function(t){return t/r}),e.imag=c.imag.map(function(t){return t/r}),e};t.exports={fft:o,ifft:i}},function(t,r,e){"use strict";function n(t){if(Array.isArray(t)){for(var r=0,e=Array(t.length);r<t.length;r++)e[r]=t[r];return e}return Array.from(t)}var o={},i={},a=function(t){var r={};r.real=void 0===t.real?t.slice():t.real.slice();var e=r.real.length;return void 0===i[e]&&(i[e]=Array.apply(null,Array(e)).map(Number.prototype.valueOf,0)),r.imag=i[e].slice(),r},u=function(t){if(void 0===o[t]){for(var r=(t-1).toString(2).length,e="0".repeat(r),i={},a=0;a<t;a++){var u=a.toString(2);u=e.substr(u.length)+u,u=[].concat(n(u)).reverse().join(""),i[a]=parseInt(u,2)}o[t]=i}return o[t]},c=function(t,r){return{real:t.real*r.real-t.imag*r.imag,imag:t.real*r.imag+t.imag*r.real}},f=function(t,r){return{real:t.real+r.real,imag:t.imag+r.imag}},l=function(t,r){return{real:t.real-r.real,imag:t.imag-r.imag}},s=function(t,r){var e=-2*Math.PI*t/r;return{real:Math.cos(e),imag:Math.sin(e)}},p=function(t){return t.imag*=-1,t};t.exports={bitReverseArray:u,multiply:c,add:f,subtract:l,euler:s,conj:p,constructComplexArray:a}},function(t,r){function e(){throw new Error("setTimeout has not been defined")}function n(){throw new Error("clearTimeout has not been defined")}function o(t){if(l===setTimeout)return setTimeout(t,0);if((l===e||!l)&&setTimeout)return l=setTimeout,setTimeout(t,0);try{return l(t,0)}catch(r){try{return l.call(null,t,0)}catch(r){return l.call(this,t,0)}}}function i(t){if(s===clearTimeout)return clearTimeout(t);if((s===n||!s)&&clearTimeout)return s=clearTimeout,clearTimeout(t);try{return s(t)}catch(r){try{return s.call(null,t)}catch(r){return s.call(this,t)}}}function a(){h&&m&&(h=!1,m.length?y=m.concat(y):b=-1,y.length&&u())}function u(){if(!h){var t=o(a);h=!0;for(var r=y.length;r;){for(m=y,y=[];++b<r;)m&&m[b].run();b=-1,r=y.length}m=null,h=!1,i(t)}}function c(t,r){this.fun=t,this.array=r}function f(){}var l,s,p=t.exports={};!function(){try{l="function"==typeof setTimeout?setTimeout:e}catch(t){l=e}try{s="function"==typeof clearTimeout?clearTimeout:n}catch(t){s=n}}();var m,y=[],h=!1,b=-1;p.nextTick=function(t){var r=new Array(arguments.length-1);if(arguments.length>1)for(var e=1;e<arguments.length;e++)r[e-1]=arguments[e];y.push(new c(t,r)),1!==y.length||h||o(u)},c.prototype.run=function(){this.fun.apply(null,this.array)},p.title="browser",p.browser=!0,p.env={},p.argv=[],p.version="",p.versions={},p.on=f,p.addListener=f,p.once=f,p.off=f,p.removeListener=f,p.removeAllListeners=f,p.emit=f,p.prependListener=f,p.prependOnceListener=f,p.listeners=function(t){return[]},p.binding=function(t){throw new Error("process.binding is not supported")},p.cwd=function(){return"/"},p.chdir=function(t){throw new Error("process.chdir is not supported")},p.umask=function(){return 0}},function(t,r){"function"==typeof Object.create?t.exports=function(t,r){t.super_=r,t.prototype=Object.create(r.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}})}:t.exports=function(t,r){t.super_=r;var e=function(){};e.prototype=r.prototype,t.prototype=new e,t.prototype.constructor=t}},function(t,r){t.exports=function(t){return t&&"object"==typeof t&&"function"==typeof t.copy&&"function"==typeof t.fill&&"function"==typeof t.readUInt8}},function(t,r,e){(function(t,n){function o(t,e){var n={seen:[],stylize:a};return arguments.length>=3&&(n.depth=arguments[2]),arguments.length>=4&&(n.colors=arguments[3]),h(e)?n.showHidden=e:e&&r._extend(n,e),w(n.showHidden)&&(n.showHidden=!1),w(n.depth)&&(n.depth=2),w(n.colors)&&(n.colors=!1),w(n.customInspect)&&(n.customInspect=!0),n.colors&&(n.stylize=i),c(n,t,n.depth)}function i(t,r){var e=o.styles[r];return e?"["+o.colors[e][0]+"m"+t+"["+o.colors[e][1]+"m":t}function a(t,r){return t}function u(t){var r={};return t.forEach(function(t,e){r[t]=!0}),r}function c(t,e,n){if(t.customInspect&&e&&A(e.inspect)&&e.inspect!==r.inspect&&(!e.constructor||e.constructor.prototype!==e)){var o=e.inspect(n,t);return d(o)||(o=c(t,o,n)),o}var i=f(t,e);if(i)return i;var a=Object.keys(e),h=u(a);if(t.showHidden&&(a=Object.getOwnPropertyNames(e)),M(e)&&(a.indexOf("message")>=0||a.indexOf("description")>=0))return l(e);if(0===a.length){if(A(e)){var b=e.name?": "+e.name:"";return t.stylize("[Function"+b+"]","special")}if(x(e))return t.stylize(RegExp.prototype.toString.call(e),"regexp");if(_(e))return t.stylize(Date.prototype.toString.call(e),"date");if(M(e))return l(e)}var g="",S=!1,v=["{","}"];if(y(e)&&(S=!0,v=["[","]"]),A(e)){g=" [Function"+(e.name?": "+e.name:"")+"]"}if(x(e)&&(g=" "+RegExp.prototype.toString.call(e)),_(e)&&(g=" "+Date.prototype.toUTCString.call(e)),M(e)&&(g=" "+l(e)),0===a.length&&(!S||0==e.length))return v[0]+g+v[1];if(n<0)return x(e)?t.stylize(RegExp.prototype.toString.call(e),"regexp"):t.stylize("[Object]","special");t.seen.push(e);var w;return w=S?s(t,e,n,h,a):a.map(function(r){return p(t,e,n,h,r,S)}),t.seen.pop(),m(w,g,v)}function f(t,r){if(w(r))return t.stylize("undefined","undefined");if(d(r)){var e="'"+JSON.stringify(r).replace(/^"|"$/g,"").replace(/'/g,"\\'").replace(/\\"/g,'"')+"'";return t.stylize(e,"string")}return S(r)?t.stylize(""+r,"number"):h(r)?t.stylize(""+r,"boolean"):b(r)?t.stylize("null","null"):void 0}function l(t){return"["+Error.prototype.toString.call(t)+"]"}function s(t,r,e,n,o){for(var i=[],a=0,u=r.length;a<u;++a)z(r,String(a))?i.push(p(t,r,e,n,String(a),!0)):i.push("");return o.forEach(function(o){o.match(/^\d+$/)||i.push(p(t,r,e,n,o,!0))}),i}function p(t,r,e,n,o,i){var a,u,f;if(f=Object.getOwnPropertyDescriptor(r,o)||{value:r[o]},f.get?u=f.set?t.stylize("[Getter/Setter]","special"):t.stylize("[Getter]","special"):f.set&&(u=t.stylize("[Setter]","special")),z(n,o)||(a="["+o+"]"),u||(t.seen.indexOf(f.value)<0?(u=b(e)?c(t,f.value,null):c(t,f.value,e-1),u.indexOf("\n")>-1&&(u=i?u.split("\n").map(function(t){return"  "+t}).join("\n").substr(2):"\n"+u.split("\n").map(function(t){return"   "+t}).join("\n"))):u=t.stylize("[Circular]","special")),w(a)){if(i&&o.match(/^\d+$/))return u;a=JSON.stringify(""+o),a.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)?(a=a.substr(1,a.length-2),a=t.stylize(a,"name")):(a=a.replace(/'/g,"\\'").replace(/\\"/g,'"').replace(/(^"|"$)/g,"'"),a=t.stylize(a,"string"))}return a+": "+u}function m(t,r,e){var n=0;return t.reduce(function(t,r){return n++,r.indexOf("\n")>=0&&n++,t+r.replace(/\u001b\[\d\d?m/g,"").length+1},0)>60?e[0]+(""===r?"":r+"\n ")+" "+t.join(",\n  ")+" "+e[1]:e[0]+r+" "+t.join(", ")+" "+e[1]}function y(t){return Array.isArray(t)}function h(t){return"boolean"==typeof t}function b(t){return null===t}function g(t){return null==t}function S(t){return"number"==typeof t}function d(t){return"string"==typeof t}function v(t){return"symbol"==typeof t}function w(t){return void 0===t}function x(t){return E(t)&&"[object RegExp]"===T(t)}function E(t){return"object"==typeof t&&null!==t}function _(t){return E(t)&&"[object Date]"===T(t)}function M(t){return E(t)&&("[object Error]"===T(t)||t instanceof Error)}function A(t){return"function"==typeof t}function j(t){return null===t||"boolean"==typeof t||"number"==typeof t||"string"==typeof t||"symbol"==typeof t||void 0===t}function T(t){return Object.prototype.toString.call(t)}function F(t){return t<10?"0"+t.toString(10):t.toString(10)}function k(){var t=new Date,r=[F(t.getHours()),F(t.getMinutes()),F(t.getSeconds())].join(":");return[t.getDate(),R[t.getMonth()],r].join(" ")}function z(t,r){return Object.prototype.hasOwnProperty.call(t,r)}var O=/%[sdj%]/g;r.format=function(t){if(!d(t)){for(var r=[],e=0;e<arguments.length;e++)r.push(o(arguments[e]));return r.join(" ")}for(var e=1,n=arguments,i=n.length,a=String(t).replace(O,function(t){if("%%"===t)return"%";if(e>=i)return t;switch(t){case"%s":return String(n[e++]);case"%d":return Number(n[e++]);case"%j":try{return JSON.stringify(n[e++])}catch(t){return"[Circular]"}default:return t}}),u=n[e];e<i;u=n[++e])b(u)||!E(u)?a+=" "+u:a+=" "+o(u);return a},r.deprecate=function(e,o){function i(){if(!a){if(n.throwDeprecation)throw new Error(o);n.traceDeprecation?console.trace(o):console.error(o),a=!0}return e.apply(this,arguments)}if(w(t.process))return function(){return r.deprecate(e,o).apply(this,arguments)};if(!0===n.noDeprecation)return e;var a=!1;return i};var B,D={};r.debuglog=function(t){if(w(B)&&(B=n.env.NODE_DEBUG||""),t=t.toUpperCase(),!D[t])if(new RegExp("\\b"+t+"\\b","i").test(B)){var e=n.pid;D[t]=function(){var n=r.format.apply(r,arguments);console.error("%s %d: %s",t,e,n)}}else D[t]=function(){};return D[t]},r.inspect=o,o.colors={bold:[1,22],italic:[3,23],underline:[4,24],inverse:[7,27],white:[37,39],grey:[90,39],black:[30,39],blue:[34,39],cyan:[36,39],green:[32,39],magenta:[35,39],red:[31,39],yellow:[33,39]},o.styles={special:"cyan",number:"yellow",boolean:"yellow",undefined:"grey",null:"bold",string:"green",date:"magenta",regexp:"red"},r.isArray=y,r.isBoolean=h,r.isNull=b,r.isNullOrUndefined=g,r.isNumber=S,r.isString=d,r.isSymbol=v,r.isUndefined=w,r.isRegExp=x,r.isObject=E,r.isDate=_,r.isError=M,r.isFunction=A,r.isPrimitive=j,r.isBuffer=e(32);var R=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];r.log=function(){console.log("%s - %s",k(),r.format.apply(r,arguments))},r.inherits=e(31),r._extend=function(t,r){if(!r||!E(r))return t;for(var e=Object.keys(r),n=e.length;n--;)t[e[n]]=r[e[n]];return t}}).call(r,e(5),e(30))}])});

},{}],20:[function(require,module,exports){
'use strict'

module.exports = mouseListen

var mouse = require('mouse-event')

function mouseListen (element, callback) {
  if (!callback) {
    callback = element
    element = window
  }

  var buttonState = 0
  var x = 0
  var y = 0
  var mods = {
    shift: false,
    alt: false,
    control: false,
    meta: false
  }
  var attached = false

  function updateMods (ev) {
    var changed = false
    if ('altKey' in ev) {
      changed = changed || ev.altKey !== mods.alt
      mods.alt = !!ev.altKey
    }
    if ('shiftKey' in ev) {
      changed = changed || ev.shiftKey !== mods.shift
      mods.shift = !!ev.shiftKey
    }
    if ('ctrlKey' in ev) {
      changed = changed || ev.ctrlKey !== mods.control
      mods.control = !!ev.ctrlKey
    }
    if ('metaKey' in ev) {
      changed = changed || ev.metaKey !== mods.meta
      mods.meta = !!ev.metaKey
    }
    return changed
  }

  function handleEvent (nextButtons, ev) {
    var nextX = mouse.x(ev)
    var nextY = mouse.y(ev)
    if ('buttons' in ev) {
      nextButtons = ev.buttons | 0
    }
    if (nextButtons !== buttonState ||
      nextX !== x ||
      nextY !== y ||
      updateMods(ev)) {
      buttonState = nextButtons | 0
      x = nextX || 0
      y = nextY || 0
      callback && callback(buttonState, x, y, mods)
    }
  }

  function clearState (ev) {
    handleEvent(0, ev)
  }

  function handleBlur () {
    if (buttonState ||
      x ||
      y ||
      mods.shift ||
      mods.alt ||
      mods.meta ||
      mods.control) {
      x = y = 0
      buttonState = 0
      mods.shift = mods.alt = mods.control = mods.meta = false
      callback && callback(0, 0, 0, mods)
    }
  }

  function handleMods (ev) {
    if (updateMods(ev)) {
      callback && callback(buttonState, x, y, mods)
    }
  }

  function handleMouseMove (ev) {
    if (mouse.buttons(ev) === 0) {
      handleEvent(0, ev)
    } else {
      handleEvent(buttonState, ev)
    }
  }

  function handleMouseDown (ev) {
    handleEvent(buttonState | mouse.buttons(ev), ev)
  }

  function handleMouseUp (ev) {
    handleEvent(buttonState & ~mouse.buttons(ev), ev)
  }

  function attachListeners () {
    if (attached) {
      return
    }
    attached = true

    element.addEventListener('mousemove', handleMouseMove)

    element.addEventListener('mousedown', handleMouseDown)

    element.addEventListener('mouseup', handleMouseUp)

    element.addEventListener('mouseleave', clearState)
    element.addEventListener('mouseenter', clearState)
    element.addEventListener('mouseout', clearState)
    element.addEventListener('mouseover', clearState)

    element.addEventListener('blur', handleBlur)

    element.addEventListener('keyup', handleMods)
    element.addEventListener('keydown', handleMods)
    element.addEventListener('keypress', handleMods)

    if (element !== window) {
      window.addEventListener('blur', handleBlur)

      window.addEventListener('keyup', handleMods)
      window.addEventListener('keydown', handleMods)
      window.addEventListener('keypress', handleMods)
    }
  }

  function detachListeners () {
    if (!attached) {
      return
    }
    attached = false

    element.removeEventListener('mousemove', handleMouseMove)

    element.removeEventListener('mousedown', handleMouseDown)

    element.removeEventListener('mouseup', handleMouseUp)

    element.removeEventListener('mouseleave', clearState)
    element.removeEventListener('mouseenter', clearState)
    element.removeEventListener('mouseout', clearState)
    element.removeEventListener('mouseover', clearState)

    element.removeEventListener('blur', handleBlur)

    element.removeEventListener('keyup', handleMods)
    element.removeEventListener('keydown', handleMods)
    element.removeEventListener('keypress', handleMods)

    if (element !== window) {
      window.removeEventListener('blur', handleBlur)

      window.removeEventListener('keyup', handleMods)
      window.removeEventListener('keydown', handleMods)
      window.removeEventListener('keypress', handleMods)
    }
  }

  // Attach listeners
  attachListeners()

  var result = {
    element: element
  }

  Object.defineProperties(result, {
    enabled: {
      get: function () { return attached },
      set: function (f) {
        if (f) {
          attachListeners()
        } else {
          detachListeners()
        }
      },
      enumerable: true
    },
    buttons: {
      get: function () { return buttonState },
      enumerable: true
    },
    x: {
      get: function () { return x },
      enumerable: true
    },
    y: {
      get: function () { return y },
      enumerable: true
    },
    mods: {
      get: function () { return mods },
      enumerable: true
    }
  })

  return result
}

},{"mouse-event":21}],21:[function(require,module,exports){
'use strict'

function mouseButtons(ev) {
  if(typeof ev === 'object') {
    if('buttons' in ev) {
      return ev.buttons
    } else if('which' in ev) {
      var b = ev.which
      if(b === 2) {
        return 4
      } else if(b === 3) {
        return 2
      } else if(b > 0) {
        return 1<<(b-1)
      }
    } else if('button' in ev) {
      var b = ev.button
      if(b === 1) {
        return 4
      } else if(b === 2) {
        return 2
      } else if(b >= 0) {
        return 1<<b
      }
    }
  }
  return 0
}
exports.buttons = mouseButtons

function mouseElement(ev) {
  return ev.target || ev.srcElement || window
}
exports.element = mouseElement

function mouseRelativeX(ev) {
  if(typeof ev === 'object') {
    if('offsetX' in ev) {
      return ev.offsetX
    }
    var target = mouseElement(ev)
    var bounds = target.getBoundingClientRect()
    return ev.clientX - bounds.left
  }
  return 0
}
exports.x = mouseRelativeX

function mouseRelativeY(ev) {
  if(typeof ev === 'object') {
    if('offsetY' in ev) {
      return ev.offsetY
    }
    var target = mouseElement(ev)
    var bounds = target.getBoundingClientRect()
    return ev.clientY - bounds.top
  }
  return 0
}
exports.y = mouseRelativeY

},{}],22:[function(require,module,exports){
(function (process){
// Generated by CoffeeScript 1.12.2
(function() {
  var getNanoSeconds, hrtime, loadTime, moduleLoadTime, nodeLoadTime, upTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - nodeLoadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    moduleLoadTime = getNanoSeconds();
    upTime = process.uptime() * 1e9;
    nodeLoadTime = moduleLoadTime - upTime;
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);



}).call(this,require('_process'))
},{"_process":23}],23:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],24:[function(require,module,exports){
var inherits = require('inherits')
var EventEmitter = require('events').EventEmitter
var now = require('right-now')
var raf = require('raf')

module.exports = Engine
function Engine(fn) {
    if (!(this instanceof Engine)) 
        return new Engine(fn)
    this.running = false
    this.last = now()
    this._frame = 0
    this._tick = this.tick.bind(this)

    if (fn)
        this.on('tick', fn)
}

inherits(Engine, EventEmitter)

Engine.prototype.start = function() {
    if (this.running) 
        return
    this.running = true
    this.last = now()
    this._frame = raf(this._tick)
    return this
}

Engine.prototype.stop = function() {
    this.running = false
    if (this._frame !== 0)
        raf.cancel(this._frame)
    this._frame = 0
    return this
}

Engine.prototype.tick = function() {
    this._frame = raf(this._tick)
    var time = now()
    var dt = time - this.last
    this.emit('tick', dt)
    this.last = time
}
},{"events":1,"inherits":18,"raf":25,"right-now":27}],25:[function(require,module,exports){
(function (global){
var now = require('performance-now')
  , root = typeof window === 'undefined' ? global : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = root['request' + suffix]
  , caf = root['cancel' + suffix] || root['cancelRequest' + suffix]

for(var i = 0; !raf && i < vendors.length; i++) {
  raf = root[vendors[i] + 'Request' + suffix]
  caf = root[vendors[i] + 'Cancel' + suffix]
      || root[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  return raf.call(root, fn)
}
module.exports.cancel = function() {
  caf.apply(root, arguments)
}
module.exports.polyfill = function(object) {
  if (!object) {
    object = root;
  }
  object.requestAnimationFrame = raf
  object.cancelAnimationFrame = caf
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"performance-now":22}],26:[function(require,module,exports){
(function(ka,N){"object"===typeof exports&&"undefined"!==typeof module?module.exports=N():"function"===typeof define&&define.amd?define(N):ka.createREGL=N()})(this,function(){function ka(a,b){this.id=Bb++;this.type=a;this.data=b}function N(a){if(0===a.length)return[];var b=a.charAt(0),c=a.charAt(a.length-1);if(1<a.length&&b===c&&('"'===b||"'"===b))return['"'+a.substr(1,a.length-2).replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"'];if(b=/\[(false|true|null|\d+|'[^']*'|"[^"]*")\]/.exec(a))return N(a.substr(0,
b.index)).concat(N(b[1])).concat(N(a.substr(b.index+b[0].length)));b=a.split(".");if(1===b.length)return['"'+a.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"'];a=[];for(c=0;c<b.length;++c)a=a.concat(N(b[c]));return a}function bb(a){return"["+N(a).join("][")+"]"}function Cb(){var a={"":0},b=[""];return{id:function(c){var e=a[c];if(e)return e;e=a[c]=b.length;b.push(c);return e},str:function(a){return b[a]}}}function Db(a,b,c){function e(){var b=window.innerWidth,e=window.innerHeight;a!==document.body&&
(e=a.getBoundingClientRect(),b=e.right-e.left,e=e.bottom-e.top);d.width=c*b;d.height=c*e;H(d.style,{width:b+"px",height:e+"px"})}var d=document.createElement("canvas");H(d.style,{border:0,margin:0,padding:0,top:0,left:0});a.appendChild(d);a===document.body&&(d.style.position="absolute",H(a.style,{margin:0,padding:0}));window.addEventListener("resize",e,!1);e();return{canvas:d,onDestroy:function(){window.removeEventListener("resize",e);a.removeChild(d)}}}function Eb(a,b){function c(c){try{return a.getContext(c,
b)}catch(d){return null}}return c("webgl")||c("experimental-webgl")||c("webgl-experimental")}function cb(a){return"string"===typeof a?a.split():a}function db(a){return"string"===typeof a?document.querySelector(a):a}function Fb(a){var b=a||{},c,e,d,g;a={};var r=[],n=[],u="undefined"===typeof window?1:window.devicePixelRatio,q=!1,t=function(a){},l=function(){};"string"===typeof b?c=document.querySelector(b):"object"===typeof b&&("string"===typeof b.nodeName&&"function"===typeof b.appendChild&&"function"===
typeof b.getBoundingClientRect?c=b:"function"===typeof b.drawArrays||"function"===typeof b.drawElements?(g=b,d=g.canvas):("gl"in b?g=b.gl:"canvas"in b?d=db(b.canvas):"container"in b&&(e=db(b.container)),"attributes"in b&&(a=b.attributes),"extensions"in b&&(r=cb(b.extensions)),"optionalExtensions"in b&&(n=cb(b.optionalExtensions)),"onDone"in b&&(t=b.onDone),"profile"in b&&(q=!!b.profile),"pixelRatio"in b&&(u=+b.pixelRatio)));c&&("canvas"===c.nodeName.toLowerCase()?d=c:e=c);if(!g){if(!d){c=Db(e||document.body,
t,u);if(!c)return null;d=c.canvas;l=c.onDestroy}a.premultipliedAlpha=a.premultipliedAlpha||!1;g=Eb(d,a)}return g?{gl:g,canvas:d,container:e,extensions:r,optionalExtensions:n,pixelRatio:u,profile:q,onDone:t,onDestroy:l}:(l(),t("webgl not supported, try upgrading your browser or graphics drivers http://get.webgl.org"),null)}function Gb(a,b){function c(b){b=b.toLowerCase();var c;try{c=e[b]=a.getExtension(b)}catch(d){}return!!c}for(var e={},d=0;d<b.extensions.length;++d){var g=b.extensions[d];if(!c(g))return b.onDestroy(),
b.onDone('"'+g+'" extension is not supported by the current WebGL context, try upgrading your system or a different browser'),null}b.optionalExtensions.forEach(c);return{extensions:e,restore:function(){Object.keys(e).forEach(function(a){if(e[a]&&!c(a))throw Error("(regl): error restoring extension "+a);})}}}function A(a,b){for(var c=Array(a),e=0;e<a;++e)c[e]=b(e);return c}function eb(a){var b,c;b=(65535<a)<<4;a>>>=b;c=(255<a)<<3;a>>>=c;b|=c;c=(15<a)<<2;a>>>=c;b|=c;c=(3<a)<<1;return b|c|a>>>c>>1}function fb(){function a(a){a:{for(var b=
16;268435456>=b;b*=16)if(a<=b){a=b;break a}a=0}b=c[eb(a)>>2];return 0<b.length?b.pop():new ArrayBuffer(a)}function b(a){c[eb(a.byteLength)>>2].push(a)}var c=A(8,function(){return[]});return{alloc:a,free:b,allocType:function(b,c){var g=null;switch(b){case 5120:g=new Int8Array(a(c),0,c);break;case 5121:g=new Uint8Array(a(c),0,c);break;case 5122:g=new Int16Array(a(2*c),0,c);break;case 5123:g=new Uint16Array(a(2*c),0,c);break;case 5124:g=new Int32Array(a(4*c),0,c);break;case 5125:g=new Uint32Array(a(4*
c),0,c);break;case 5126:g=new Float32Array(a(4*c),0,c);break;default:return null}return g.length!==c?g.subarray(0,c):g},freeType:function(a){b(a.buffer)}}}function X(a){return!!a&&"object"===typeof a&&Array.isArray(a.shape)&&Array.isArray(a.stride)&&"number"===typeof a.offset&&a.shape.length===a.stride.length&&(Array.isArray(a.data)||G(a.data))}function gb(a,b,c,e,d,g){for(var r=0;r<b;++r)for(var n=a[r],u=0;u<c;++u)for(var q=n[u],t=0;t<e;++t)d[g++]=q[t]}function hb(a,b,c,e,d){for(var g=1,r=c+1;r<
b.length;++r)g*=b[r];var n=b[c];if(4===b.length-c){var u=b[c+1],q=b[c+2];b=b[c+3];for(r=0;r<n;++r)gb(a[r],u,q,b,e,d),d+=g}else for(r=0;r<n;++r)hb(a[r],b,c+1,e,d),d+=g}function Ga(a){return Ha[Object.prototype.toString.call(a)]|0}function ib(a,b){for(var c=0;c<b.length;++c)a[c]=b[c]}function jb(a,b,c,e,d,g,r){for(var n=0,u=0;u<c;++u)for(var q=0;q<e;++q)a[n++]=b[d*u+g*q+r]}function Hb(a,b,c,e){function d(b){this.id=u++;this.buffer=a.createBuffer();this.type=b;this.usage=35044;this.byteLength=0;this.dimension=
1;this.dtype=5121;this.persistentData=null;c.profile&&(this.stats={size:0})}function g(b,c,k){b.byteLength=c.byteLength;a.bufferData(b.type,c,k)}function r(a,b,c,h,f,p){a.usage=c;if(Array.isArray(b)){if(a.dtype=h||5126,0<b.length)if(Array.isArray(b[0])){f=kb(b);for(var m=h=1;m<f.length;++m)h*=f[m];a.dimension=h;b=Ra(b,f,a.dtype);g(a,b,c);p?a.persistentData=b:z.freeType(b)}else"number"===typeof b[0]?(a.dimension=f,f=z.allocType(a.dtype,b.length),ib(f,b),g(a,f,c),p?a.persistentData=f:z.freeType(f)):
G(b[0])&&(a.dimension=b[0].length,a.dtype=h||Ga(b[0])||5126,b=Ra(b,[b.length,b[0].length],a.dtype),g(a,b,c),p?a.persistentData=b:z.freeType(b))}else if(G(b))a.dtype=h||Ga(b),a.dimension=f,g(a,b,c),p&&(a.persistentData=new Uint8Array(new Uint8Array(b.buffer)));else if(X(b)){f=b.shape;var v=b.stride,m=b.offset,e=0,d=0,q=0,n=0;1===f.length?(e=f[0],d=1,q=v[0],n=0):2===f.length&&(e=f[0],d=f[1],q=v[0],n=v[1]);a.dtype=h||Ga(b.data)||5126;a.dimension=d;f=z.allocType(a.dtype,e*d);jb(f,b.data,e,d,q,n,m);g(a,
f,c);p?a.persistentData=f:z.freeType(f)}else b instanceof ArrayBuffer&&(a.dtype=5121,a.dimension=f,g(a,b,c),p&&(a.persistentData=new Uint8Array(new Uint8Array(b))))}function n(c){b.bufferCount--;e(c);a.deleteBuffer(c.buffer);c.buffer=null;delete q[c.id]}var u=0,q={};d.prototype.bind=function(){a.bindBuffer(this.type,this.buffer)};d.prototype.destroy=function(){n(this)};var t=[];c.profile&&(b.getTotalBufferSize=function(){var a=0;Object.keys(q).forEach(function(b){a+=q[b].stats.size});return a});return{create:function(l,
e,k,h){function f(b){var l=35044,e=null,d=0,k=0,g=1;Array.isArray(b)||G(b)||X(b)||b instanceof ArrayBuffer?e=b:"number"===typeof b?d=b|0:b&&("data"in b&&(e=b.data),"usage"in b&&(l=lb[b.usage]),"type"in b&&(k=Ia[b.type]),"dimension"in b&&(g=b.dimension|0),"length"in b&&(d=b.length|0));p.bind();e?r(p,e,l,k,g,h):(d&&a.bufferData(p.type,d,l),p.dtype=k||5121,p.usage=l,p.dimension=g,p.byteLength=d);c.profile&&(p.stats.size=p.byteLength*ia[p.dtype]);return f}b.bufferCount++;var p=new d(e);q[p.id]=p;k||f(l);
f._reglType="buffer";f._buffer=p;f.subdata=function(b,c){var l=(c||0)|0,h;p.bind();if(G(b)||b instanceof ArrayBuffer)a.bufferSubData(p.type,l,b);else if(Array.isArray(b)){if(0<b.length)if("number"===typeof b[0]){var e=z.allocType(p.dtype,b.length);ib(e,b);a.bufferSubData(p.type,l,e);z.freeType(e)}else if(Array.isArray(b[0])||G(b[0]))h=kb(b),e=Ra(b,h,p.dtype),a.bufferSubData(p.type,l,e),z.freeType(e)}else if(X(b)){h=b.shape;var d=b.stride,k=e=0,g=0,q=0;1===h.length?(e=h[0],k=1,g=d[0],q=0):2===h.length&&
(e=h[0],k=h[1],g=d[0],q=d[1]);h=Array.isArray(b.data)?p.dtype:Ga(b.data);h=z.allocType(h,e*k);jb(h,b.data,e,k,g,q,b.offset);a.bufferSubData(p.type,l,h);z.freeType(h)}return f};c.profile&&(f.stats=p.stats);f.destroy=function(){n(p)};return f},createStream:function(a,b){var c=t.pop();c||(c=new d(a));c.bind();r(c,b,35040,0,1,!1);return c},destroyStream:function(a){t.push(a)},clear:function(){J(q).forEach(n);t.forEach(n)},getBuffer:function(a){return a&&a._buffer instanceof d?a._buffer:null},restore:function(){J(q).forEach(function(b){b.buffer=
a.createBuffer();a.bindBuffer(b.type,b.buffer);a.bufferData(b.type,b.persistentData||b.byteLength,b.usage)})},_initBuffer:r}}function Ib(a,b,c,e){function d(a){this.id=u++;n[this.id]=this;this.buffer=a;this.primType=4;this.type=this.vertCount=0}function g(e,d,g,h,f,p,m){e.buffer.bind();var v;d?((v=m)||G(d)&&(!X(d)||G(d.data))||(v=b.oes_element_index_uint?5125:5123),c._initBuffer(e.buffer,d,g,v,3)):(a.bufferData(34963,p,g),e.buffer.dtype=v||5121,e.buffer.usage=g,e.buffer.dimension=3,e.buffer.byteLength=
p);v=m;if(!m){switch(e.buffer.dtype){case 5121:case 5120:v=5121;break;case 5123:case 5122:v=5123;break;case 5125:case 5124:v=5125}e.buffer.dtype=v}e.type=v;d=f;0>d&&(d=e.buffer.byteLength,5123===v?d>>=1:5125===v&&(d>>=2));e.vertCount=d;d=h;0>h&&(d=4,h=e.buffer.dimension,1===h&&(d=0),2===h&&(d=1),3===h&&(d=4));e.primType=d}function r(a){e.elementsCount--;delete n[a.id];a.buffer.destroy();a.buffer=null}var n={},u=0,q={uint8:5121,uint16:5123};b.oes_element_index_uint&&(q.uint32=5125);d.prototype.bind=
function(){this.buffer.bind()};var t=[];return{create:function(a,b){function k(a){if(a)if("number"===typeof a)h(a),f.primType=4,f.vertCount=a|0,f.type=5121;else{var b=null,c=35044,e=-1,d=-1,l=0,n=0;if(Array.isArray(a)||G(a)||X(a))b=a;else if("data"in a&&(b=a.data),"usage"in a&&(c=lb[a.usage]),"primitive"in a&&(e=Ta[a.primitive]),"count"in a&&(d=a.count|0),"type"in a&&(n=q[a.type]),"length"in a)l=a.length|0;else if(l=d,5123===n||5122===n)l*=2;else if(5125===n||5124===n)l*=4;g(f,b,c,e,d,l,n)}else h(),
f.primType=4,f.vertCount=0,f.type=5121;return k}var h=c.create(null,34963,!0),f=new d(h._buffer);e.elementsCount++;k(a);k._reglType="elements";k._elements=f;k.subdata=function(a,b){h.subdata(a,b);return k};k.destroy=function(){r(f)};return k},createStream:function(a){var b=t.pop();b||(b=new d(c.create(null,34963,!0,!1)._buffer));g(b,a,35040,-1,-1,0,0);return b},destroyStream:function(a){t.push(a)},getElements:function(a){return"function"===typeof a&&a._elements instanceof d?a._elements:null},clear:function(){J(n).forEach(r)}}}
function nb(a){for(var b=z.allocType(5123,a.length),c=0;c<a.length;++c)if(isNaN(a[c]))b[c]=65535;else if(Infinity===a[c])b[c]=31744;else if(-Infinity===a[c])b[c]=64512;else{ob[0]=a[c];var e=Jb[0],d=e>>>31<<15,g=(e<<1>>>24)-127,e=e>>13&1023;b[c]=-24>g?d:-14>g?d+(e+1024>>-14-g):15<g?d+31744:d+(g+15<<10)+e}return b}function oa(a){return Array.isArray(a)||G(a)}function la(a){return"[object "+a+"]"}function pb(a){return Array.isArray(a)&&(0===a.length||"number"===typeof a[0])}function qb(a){return Array.isArray(a)&&
0!==a.length&&oa(a[0])?!0:!1}function Y(a){return Object.prototype.toString.call(a)}function Ua(a){if(!a)return!1;var b=Y(a);return 0<=Kb.indexOf(b)?!0:pb(a)||qb(a)||X(a)}function rb(a,b){36193===a.type?(a.data=nb(b),z.freeType(b)):a.data=b}function Ja(a,b,c,e,d,g){a="undefined"!==typeof w[a]?w[a]:S[a]*Z[b];g&&(a*=6);if(d){for(e=0;1<=c;)e+=a*c*c,c/=2;return e}return a*c*e}function Lb(a,b,c,e,d,g,r){function n(){this.format=this.internalformat=6408;this.type=5121;this.flipY=this.premultiplyAlpha=this.compressed=
!1;this.unpackAlignment=1;this.colorSpace=37444;this.channels=this.height=this.width=0}function u(a,b){a.internalformat=b.internalformat;a.format=b.format;a.type=b.type;a.compressed=b.compressed;a.premultiplyAlpha=b.premultiplyAlpha;a.flipY=b.flipY;a.unpackAlignment=b.unpackAlignment;a.colorSpace=b.colorSpace;a.width=b.width;a.height=b.height;a.channels=b.channels}function q(a,b){if("object"===typeof b&&b){"premultiplyAlpha"in b&&(a.premultiplyAlpha=b.premultiplyAlpha);"flipY"in b&&(a.flipY=b.flipY);
"alignment"in b&&(a.unpackAlignment=b.alignment);"colorSpace"in b&&(a.colorSpace=Mb[b.colorSpace]);"type"in b&&(a.type=K[b.type]);var c=a.width,f=a.height,e=a.channels,d=!1;"shape"in b?(c=b.shape[0],f=b.shape[1],3===b.shape.length&&(e=b.shape[2],d=!0)):("radius"in b&&(c=f=b.radius),"width"in b&&(c=b.width),"height"in b&&(f=b.height),"channels"in b&&(e=b.channels,d=!0));a.width=c|0;a.height=f|0;a.channels=e|0;c=!1;"format"in b&&(c=b.format,f=a.internalformat=B[c],a.format=M[f],c in K&&!("type"in b)&&
(a.type=K[c]),c in V&&(a.compressed=!0),c=!0);!d&&c?a.channels=S[a.format]:d&&!c&&a.channels!==Ma[a.format]&&(a.format=a.internalformat=Ma[a.channels])}}function t(b){a.pixelStorei(37440,b.flipY);a.pixelStorei(37441,b.premultiplyAlpha);a.pixelStorei(37443,b.colorSpace);a.pixelStorei(3317,b.unpackAlignment)}function l(){n.call(this);this.yOffset=this.xOffset=0;this.data=null;this.needsFree=!1;this.element=null;this.needsCopy=!1}function F(a,b){var c=null;Ua(b)?c=b:b&&(q(a,b),"x"in b&&(a.xOffset=b.x|
0),"y"in b&&(a.yOffset=b.y|0),Ua(b.data)&&(c=b.data));if(b.copy){var f=d.viewportWidth,e=d.viewportHeight;a.width=a.width||f-a.xOffset;a.height=a.height||e-a.yOffset;a.needsCopy=!0}else if(!c)a.width=a.width||1,a.height=a.height||1,a.channels=a.channels||4;else if(G(c))a.channels=a.channels||4,a.data=c,"type"in b||5121!==a.type||(a.type=Ha[Object.prototype.toString.call(c)]|0);else if(pb(c)){a.channels=a.channels||4;f=c;e=f.length;switch(a.type){case 5121:case 5123:case 5125:case 5126:e=z.allocType(a.type,
e);e.set(f);a.data=e;break;case 36193:a.data=nb(f)}a.alignment=1;a.needsFree=!0}else if(X(c)){f=c.data;Array.isArray(f)||5121!==a.type||(a.type=Ha[Object.prototype.toString.call(f)]|0);var e=c.shape,h=c.stride,g,m,k,p;3===e.length?(k=e[2],p=h[2]):p=k=1;g=e[0];m=e[1];e=h[0];h=h[1];a.alignment=1;a.width=g;a.height=m;a.channels=k;a.format=a.internalformat=Ma[k];a.needsFree=!0;g=p;c=c.offset;k=a.width;p=a.height;m=a.channels;for(var y=z.allocType(36193===a.type?5126:a.type,k*p*m),I=0,U=0;U<p;++U)for(var ea=
0;ea<k;++ea)for(var aa=0;aa<m;++aa)y[I++]=f[e*ea+h*U+g*aa+c];rb(a,y)}else if(Y(c)===Va||Y(c)===Wa||Y(c)===sb)Y(c)===Va||Y(c)===Wa?a.element=c:a.element=c.canvas,a.width=a.element.width,a.height=a.element.height,a.channels=4;else if(Y(c)===tb)a.element=c,a.width=c.width,a.height=c.height,a.channels=4;else if(Y(c)===ub)a.element=c,a.width=c.naturalWidth,a.height=c.naturalHeight,a.channels=4;else if(Y(c)===vb)a.element=c,a.width=c.videoWidth,a.height=c.videoHeight,a.channels=4;else if(qb(c)){f=a.width||
c[0].length;e=a.height||c.length;h=a.channels;h=oa(c[0][0])?h||c[0][0].length:h||1;g=Na.shape(c);k=1;for(p=0;p<g.length;++p)k*=g[p];k=z.allocType(36193===a.type?5126:a.type,k);Na.flatten(c,g,"",k);rb(a,k);a.alignment=1;a.width=f;a.height=e;a.channels=h;a.format=a.internalformat=Ma[h];a.needsFree=!0}}function k(b,c,f,h,d){var g=b.element,m=b.data,k=b.internalformat,p=b.format,v=b.type,y=b.width,I=b.height;t(b);g?a.texSubImage2D(c,d,f,h,p,v,g):b.compressed?a.compressedTexSubImage2D(c,d,f,h,k,y,I,m):
b.needsCopy?(e(),a.copyTexSubImage2D(c,d,f,h,b.xOffset,b.yOffset,y,I)):a.texSubImage2D(c,d,f,h,y,I,p,v,m)}function h(){return L.pop()||new l}function f(a){a.needsFree&&z.freeType(a.data);l.call(a);L.push(a)}function p(){n.call(this);this.genMipmaps=!1;this.mipmapHint=4352;this.mipmask=0;this.images=Array(16)}function m(a,b,c){var f=a.images[0]=h();a.mipmask=1;f.width=a.width=b;f.height=a.height=c;f.channels=a.channels=4}function v(a,b){var c=null;if(Ua(b))c=a.images[0]=h(),u(c,a),F(c,b),a.mipmask=
1;else if(q(a,b),Array.isArray(b.mipmap))for(var f=b.mipmap,e=0;e<f.length;++e)c=a.images[e]=h(),u(c,a),c.width>>=e,c.height>>=e,F(c,f[e]),a.mipmask|=1<<e;else c=a.images[0]=h(),u(c,a),F(c,b),a.mipmask=1;u(a,a.images[0])}function Q(b,c){for(var f=b.images,h=0;h<f.length&&f[h];++h){var d=f[h],g=c,m=h,k=d.element,p=d.data,v=d.internalformat,y=d.format,I=d.type,U=d.width,ea=d.height;t(d);k?a.texImage2D(g,m,y,y,I,k):d.compressed?a.compressedTexImage2D(g,m,v,U,ea,0,p):d.needsCopy?(e(),a.copyTexImage2D(g,
m,y,d.xOffset,d.yOffset,U,ea,0)):a.texImage2D(g,m,y,U,ea,0,y,I,p||null)}}function C(){var a=A.pop()||new p;n.call(a);for(var b=a.mipmask=0;16>b;++b)a.images[b]=null;return a}function wa(a){for(var b=a.images,c=0;c<b.length;++c)b[c]&&f(b[c]),b[c]=null;A.push(a)}function fa(){this.magFilter=this.minFilter=9728;this.wrapT=this.wrapS=33071;this.anisotropic=1;this.genMipmaps=!1;this.mipmapHint=4352}function mb(a,b){"min"in b&&(a.minFilter=O[b.min],0<=Nb.indexOf(a.minFilter)&&!("faces"in b)&&(a.genMipmaps=
!0));"mag"in b&&(a.magFilter=T[b.mag]);var c=a.wrapS,f=a.wrapT;if("wrap"in b){var e=b.wrap;"string"===typeof e?c=f=ma[e]:Array.isArray(e)&&(c=ma[e[0]],f=ma[e[1]])}else"wrapS"in b&&(c=ma[b.wrapS]),"wrapT"in b&&(f=ma[b.wrapT]);a.wrapS=c;a.wrapT=f;"anisotropic"in b&&(a.anisotropic=b.anisotropic);if("mipmap"in b){c=!1;switch(typeof b.mipmap){case "string":a.mipmapHint=x[b.mipmap];c=a.genMipmaps=!0;break;case "boolean":c=a.genMipmaps=b.mipmap;break;case "object":a.genMipmaps=!1,c=!0}!c||"min"in b||(a.minFilter=
9984)}}function Sa(c,f){a.texParameteri(f,10241,c.minFilter);a.texParameteri(f,10240,c.magFilter);a.texParameteri(f,10242,c.wrapS);a.texParameteri(f,10243,c.wrapT);b.ext_texture_filter_anisotropic&&a.texParameteri(f,34046,c.anisotropic);c.genMipmaps&&(a.hint(33170,c.mipmapHint),a.generateMipmap(f))}function R(b){n.call(this);this.mipmask=0;this.internalformat=6408;this.id=P++;this.refCount=1;this.target=b;this.texture=a.createTexture();this.unit=-1;this.bindCount=0;this.texInfo=new fa;r.profile&&
(this.stats={size:0})}function ta(b){a.activeTexture(33984);a.bindTexture(b.target,b.texture)}function Aa(){var b=W[0];b?a.bindTexture(b.target,b.texture):a.bindTexture(3553,null)}function D(b){var c=b.texture,f=b.unit,e=b.target;0<=f&&(a.activeTexture(33984+f),a.bindTexture(e,null),W[f]=null);a.deleteTexture(c);b.texture=null;b.params=null;b.pixels=null;b.refCount=0;delete E[b.id];g.textureCount--}var x={"don't care":4352,"dont care":4352,nice:4354,fast:4353},ma={repeat:10497,clamp:33071,mirror:33648},
T={nearest:9728,linear:9729},O=H({mipmap:9987,"nearest mipmap nearest":9984,"linear mipmap nearest":9985,"nearest mipmap linear":9986,"linear mipmap linear":9987},T),Mb={none:0,browser:37444},K={uint8:5121,rgba4:32819,rgb565:33635,"rgb5 a1":32820},B={alpha:6406,luminance:6409,"luminance alpha":6410,rgb:6407,rgba:6408,rgba4:32854,"rgb5 a1":32855,rgb565:36194},V={};b.ext_srgb&&(B.srgb=35904,B.srgba=35906);b.oes_texture_float&&(K.float32=K["float"]=5126);b.oes_texture_half_float&&(K.float16=K["half float"]=
36193);b.webgl_depth_texture&&(H(B,{depth:6402,"depth stencil":34041}),H(K,{uint16:5123,uint32:5125,"depth stencil":34042}));b.webgl_compressed_texture_s3tc&&H(V,{"rgb s3tc dxt1":33776,"rgba s3tc dxt1":33777,"rgba s3tc dxt3":33778,"rgba s3tc dxt5":33779});b.webgl_compressed_texture_atc&&H(V,{"rgb atc":35986,"rgba atc explicit alpha":35987,"rgba atc interpolated alpha":34798});b.webgl_compressed_texture_pvrtc&&H(V,{"rgb pvrtc 4bppv1":35840,"rgb pvrtc 2bppv1":35841,"rgba pvrtc 4bppv1":35842,"rgba pvrtc 2bppv1":35843});
b.webgl_compressed_texture_etc1&&(V["rgb etc1"]=36196);var w=Array.prototype.slice.call(a.getParameter(34467));Object.keys(V).forEach(function(a){var b=V[a];0<=w.indexOf(b)&&(B[a]=b)});var xa=Object.keys(B);c.textureFormats=xa;var ba=[];Object.keys(B).forEach(function(a){ba[B[a]]=a});var ya=[];Object.keys(K).forEach(function(a){ya[K[a]]=a});var ca=[];Object.keys(T).forEach(function(a){ca[T[a]]=a});var Ea=[];Object.keys(O).forEach(function(a){Ea[O[a]]=a});var ga=[];Object.keys(ma).forEach(function(a){ga[ma[a]]=
a});var M=xa.reduce(function(a,c){var f=B[c];6409===f||6406===f||6409===f||6410===f||6402===f||34041===f||b.ext_srgb&&(35904===f||35906===f)?a[f]=f:32855===f||0<=c.indexOf("rgba")?a[f]=6408:a[f]=6407;return a},{}),L=[],A=[],P=0,E={},ja=c.maxTextureUnits,W=Array(ja).map(function(){return null});H(R.prototype,{bind:function(){this.bindCount+=1;var b=this.unit;if(0>b){for(var c=0;c<ja;++c){var f=W[c];if(f){if(0<f.bindCount)continue;f.unit=-1}W[c]=this;b=c;break}r.profile&&g.maxTextureUnits<b+1&&(g.maxTextureUnits=
b+1);this.unit=b;a.activeTexture(33984+b);a.bindTexture(this.target,this.texture)}return b},unbind:function(){--this.bindCount},decRef:function(){0>=--this.refCount&&D(this)}});r.profile&&(g.getTotalTextureSize=function(){var a=0;Object.keys(E).forEach(function(b){a+=E[b].stats.size});return a});return{create2D:function(b,c){function e(a,b){var c=d.texInfo;fa.call(c);var f=C();"number"===typeof a?"number"===typeof b?m(f,a|0,b|0):m(f,a|0,a|0):a?(mb(c,a),v(f,a)):m(f,1,1);c.genMipmaps&&(f.mipmask=(f.width<<
1)-1);d.mipmask=f.mipmask;u(d,f);d.internalformat=f.internalformat;e.width=f.width;e.height=f.height;ta(d);Q(f,3553);Sa(c,3553);Aa();wa(f);r.profile&&(d.stats.size=Ja(d.internalformat,d.type,f.width,f.height,c.genMipmaps,!1));e.format=ba[d.internalformat];e.type=ya[d.type];e.mag=ca[c.magFilter];e.min=Ea[c.minFilter];e.wrapS=ga[c.wrapS];e.wrapT=ga[c.wrapT];return e}var d=new R(3553);E[d.id]=d;g.textureCount++;e(b,c);e.subimage=function(a,b,c,g){b|=0;c|=0;g|=0;var m=h();u(m,d);m.width=0;m.height=0;
F(m,a);m.width=m.width||(d.width>>g)-b;m.height=m.height||(d.height>>g)-c;ta(d);k(m,3553,b,c,g);Aa();f(m);return e};e.resize=function(b,c){var f=b|0,h=c|0||f;if(f===d.width&&h===d.height)return e;e.width=d.width=f;e.height=d.height=h;ta(d);for(var m=0;d.mipmask>>m;++m){var g=f>>m,y=h>>m;if(!g||!y)break;a.texImage2D(3553,m,d.format,g,y,0,d.format,d.type,null)}Aa();r.profile&&(d.stats.size=Ja(d.internalformat,d.type,f,h,!1,!1));return e};e._reglType="texture2d";e._texture=d;r.profile&&(e.stats=d.stats);
e.destroy=function(){d.decRef()};return e},createCube:function(b,c,e,d,p,n){function l(a,b,c,f,e,d){var h,na=x.texInfo;fa.call(na);for(h=0;6>h;++h)D[h]=C();if("number"===typeof a||!a)for(a=a|0||1,h=0;6>h;++h)m(D[h],a,a);else if("object"===typeof a)if(b)v(D[0],a),v(D[1],b),v(D[2],c),v(D[3],f),v(D[4],e),v(D[5],d);else if(mb(na,a),q(x,a),"faces"in a)for(a=a.faces,h=0;6>h;++h)u(D[h],x),v(D[h],a[h]);else for(h=0;6>h;++h)v(D[h],a);u(x,D[0]);x.mipmask=na.genMipmaps?(D[0].width<<1)-1:D[0].mipmask;x.internalformat=
D[0].internalformat;l.width=D[0].width;l.height=D[0].height;ta(x);for(h=0;6>h;++h)Q(D[h],34069+h);Sa(na,34067);Aa();r.profile&&(x.stats.size=Ja(x.internalformat,x.type,l.width,l.height,na.genMipmaps,!0));l.format=ba[x.internalformat];l.type=ya[x.type];l.mag=ca[na.magFilter];l.min=Ea[na.minFilter];l.wrapS=ga[na.wrapS];l.wrapT=ga[na.wrapT];for(h=0;6>h;++h)wa(D[h]);return l}var x=new R(34067);E[x.id]=x;g.cubeCount++;var D=Array(6);l(b,c,e,d,p,n);l.subimage=function(a,b,c,e,d){c|=0;e|=0;d|=0;var aa=h();
u(aa,x);aa.width=0;aa.height=0;F(aa,b);aa.width=aa.width||(x.width>>d)-c;aa.height=aa.height||(x.height>>d)-e;ta(x);k(aa,34069+a,c,e,d);Aa();f(aa);return l};l.resize=function(b){b|=0;if(b!==x.width){l.width=x.width=b;l.height=x.height=b;ta(x);for(var c=0;6>c;++c)for(var f=0;x.mipmask>>f;++f)a.texImage2D(34069+c,f,x.format,b>>f,b>>f,0,x.format,x.type,null);Aa();r.profile&&(x.stats.size=Ja(x.internalformat,x.type,l.width,l.height,!1,!0));return l}};l._reglType="textureCube";l._texture=x;r.profile&&
(l.stats=x.stats);l.destroy=function(){x.decRef()};return l},clear:function(){for(var b=0;b<ja;++b)a.activeTexture(33984+b),a.bindTexture(3553,null),W[b]=null;J(E).forEach(D);g.cubeCount=0;g.textureCount=0},getTexture:function(a){return null},restore:function(){for(var b=0;b<ja;++b){var c=W[b];c&&(c.bindCount=0,c.unit=-1,W[b]=null)}J(E).forEach(function(b){b.texture=a.createTexture();a.bindTexture(b.target,b.texture);for(var c=0;32>c;++c)if(0!==(b.mipmask&1<<c))if(3553===b.target)a.texImage2D(3553,
c,b.internalformat,b.width>>c,b.height>>c,0,b.internalformat,b.type,null);else for(var f=0;6>f;++f)a.texImage2D(34069+f,c,b.internalformat,b.width>>c,b.height>>c,0,b.internalformat,b.type,null);Sa(b.texInfo,b.target)})}}}function Ob(a,b,c,e,d,g){function r(a,b,c){this.target=a;this.texture=b;this.renderbuffer=c;var f=a=0;b?(a=b.width,f=b.height):c&&(a=c.width,f=c.height);this.width=a;this.height=f}function n(a){a&&(a.texture&&a.texture._texture.decRef(),a.renderbuffer&&a.renderbuffer._renderbuffer.decRef())}
function u(a,b,c){a&&(a.texture?a.texture._texture.refCount+=1:a.renderbuffer._renderbuffer.refCount+=1)}function q(b,c){c&&(c.texture?a.framebufferTexture2D(36160,b,c.target,c.texture._texture.texture,0):a.framebufferRenderbuffer(36160,b,36161,c.renderbuffer._renderbuffer.renderbuffer))}function t(a){var b=3553,c=null,f=null,e=a;"object"===typeof a&&(e=a.data,"target"in a&&(b=a.target|0));a=e._reglType;"texture2d"===a?c=e:"textureCube"===a?c=e:"renderbuffer"===a&&(f=e,b=36161);return new r(b,c,f)}
function l(a,b,c,f,h){if(c)return a=e.create2D({width:a,height:b,format:f,type:h}),a._texture.refCount=0,new r(3553,a,null);a=d.create({width:a,height:b,format:f});a._renderbuffer.refCount=0;return new r(36161,null,a)}function F(a){return a&&(a.texture||a.renderbuffer)}function k(a,b,c){a&&(a.texture?a.texture.resize(b,c):a.renderbuffer&&a.renderbuffer.resize(b,c),a.width=b,a.height=c)}function h(){this.id=z++;w[this.id]=this;this.framebuffer=a.createFramebuffer();this.height=this.width=0;this.colorAttachments=
[];this.depthStencilAttachment=this.stencilAttachment=this.depthAttachment=null}function f(a){a.colorAttachments.forEach(n);n(a.depthAttachment);n(a.stencilAttachment);n(a.depthStencilAttachment)}function p(b){a.deleteFramebuffer(b.framebuffer);b.framebuffer=null;g.framebufferCount--;delete w[b.id]}function m(b){var f;a.bindFramebuffer(36160,b.framebuffer);var e=b.colorAttachments;for(f=0;f<e.length;++f)q(36064+f,e[f]);for(f=e.length;f<c.maxColorAttachments;++f)a.framebufferTexture2D(36160,36064+
f,3553,null,0);a.framebufferTexture2D(36160,33306,3553,null,0);a.framebufferTexture2D(36160,36096,3553,null,0);a.framebufferTexture2D(36160,36128,3553,null,0);q(36096,b.depthAttachment);q(36128,b.stencilAttachment);q(33306,b.depthStencilAttachment);a.checkFramebufferStatus(36160);a.isContextLost();a.bindFramebuffer(36160,Q.next?Q.next.framebuffer:null);Q.cur=Q.next;a.getError()}function v(a,b){function c(a,b){var d,h=0,g=0,k=!0,p=!0;d=null;var v=!0,n="rgba",q="uint8",r=1,fa=null,ca=null,Q=null,ga=
!1;if("number"===typeof a)h=a|0,g=b|0||h;else if(a){"shape"in a?(g=a.shape,h=g[0],g=g[1]):("radius"in a&&(h=g=a.radius),"width"in a&&(h=a.width),"height"in a&&(g=a.height));if("color"in a||"colors"in a)d=a.color||a.colors,Array.isArray(d);if(!d){"colorCount"in a&&(r=a.colorCount|0);"colorTexture"in a&&(v=!!a.colorTexture,n="rgba4");if("colorType"in a&&(q=a.colorType,!v))if("half float"===q||"float16"===q)n="rgba16f";else if("float"===q||"float32"===q)n="rgba32f";"colorFormat"in a&&(n=a.colorFormat,
0<=C.indexOf(n)?v=!0:0<=wa.indexOf(n)&&(v=!1))}if("depthTexture"in a||"depthStencilTexture"in a)ga=!(!a.depthTexture&&!a.depthStencilTexture);"depth"in a&&("boolean"===typeof a.depth?k=a.depth:(fa=a.depth,p=!1));"stencil"in a&&("boolean"===typeof a.stencil?p=a.stencil:(ca=a.stencil,k=!1));"depthStencil"in a&&("boolean"===typeof a.depthStencil?k=p=a.depthStencil:(Q=a.depthStencil,p=k=!1))}else h=g=1;var M=null,z=null,w=null,R=null;if(Array.isArray(d))M=d.map(t);else if(d)M=[t(d)];else for(M=Array(r),
d=0;d<r;++d)M[d]=l(h,g,v,n,q);h=h||M[0].width;g=g||M[0].height;fa?z=t(fa):k&&!p&&(z=l(h,g,ga,"depth","uint32"));ca?w=t(ca):p&&!k&&(w=l(h,g,!1,"stencil","uint8"));Q?R=t(Q):!fa&&!ca&&p&&k&&(R=l(h,g,ga,"depth stencil","depth stencil"));k=null;for(d=0;d<M.length;++d)u(M[d],h,g),M[d]&&M[d].texture&&(p=Xa[M[d].texture._texture.format]*Oa[M[d].texture._texture.type],null===k&&(k=p));u(z,h,g);u(w,h,g);u(R,h,g);f(e);e.width=h;e.height=g;e.colorAttachments=M;e.depthAttachment=z;e.stencilAttachment=w;e.depthStencilAttachment=
R;c.color=M.map(F);c.depth=F(z);c.stencil=F(w);c.depthStencil=F(R);c.width=e.width;c.height=e.height;m(e);return c}var e=new h;g.framebufferCount++;c(a,b);return H(c,{resize:function(a,b){var f=Math.max(a|0,1),d=Math.max(b|0||f,1);if(f===e.width&&d===e.height)return c;for(var h=e.colorAttachments,g=0;g<h.length;++g)k(h[g],f,d);k(e.depthAttachment,f,d);k(e.stencilAttachment,f,d);k(e.depthStencilAttachment,f,d);e.width=c.width=f;e.height=c.height=d;m(e);return c},_reglType:"framebuffer",_framebuffer:e,
destroy:function(){p(e);f(e)},use:function(a){Q.setFBO({framebuffer:c},a)}})}var Q={cur:null,next:null,dirty:!1,setFBO:null},C=["rgba"],wa=["rgba4","rgb565","rgb5 a1"];b.ext_srgb&&wa.push("srgba");b.ext_color_buffer_half_float&&wa.push("rgba16f","rgb16f");b.webgl_color_buffer_float&&wa.push("rgba32f");var fa=["uint8"];b.oes_texture_half_float&&fa.push("half float","float16");b.oes_texture_float&&fa.push("float","float32");var z=0,w={};return H(Q,{getFramebuffer:function(a){return"function"===typeof a&&
"framebuffer"===a._reglType&&(a=a._framebuffer,a instanceof h)?a:null},create:v,createCube:function(a){function b(a){var f,d={color:null},h=0,g=null;f="rgba";var m="uint8",k=1;if("number"===typeof a)h=a|0;else if(a){"shape"in a?h=a.shape[0]:("radius"in a&&(h=a.radius|0),"width"in a?h=a.width|0:"height"in a&&(h=a.height|0));if("color"in a||"colors"in a)g=a.color||a.colors,Array.isArray(g);g||("colorCount"in a&&(k=a.colorCount|0),"colorType"in a&&(m=a.colorType),"colorFormat"in a&&(f=a.colorFormat));
"depth"in a&&(d.depth=a.depth);"stencil"in a&&(d.stencil=a.stencil);"depthStencil"in a&&(d.depthStencil=a.depthStencil)}else h=1;if(g)if(Array.isArray(g))for(a=[],f=0;f<g.length;++f)a[f]=g[f];else a=[g];else for(a=Array(k),g={radius:h,format:f,type:m},f=0;f<k;++f)a[f]=e.createCube(g);d.color=Array(a.length);for(f=0;f<a.length;++f)k=a[f],h=h||k.width,d.color[f]={target:34069,data:a[f]};for(f=0;6>f;++f){for(k=0;k<a.length;++k)d.color[k].target=34069+f;0<f&&(d.depth=c[0].depth,d.stencil=c[0].stencil,
d.depthStencil=c[0].depthStencil);if(c[f])c[f](d);else c[f]=v(d)}return H(b,{width:h,height:h,color:a})}var c=Array(6);b(a);return H(b,{faces:c,resize:function(a){var f=a|0;if(f===b.width)return b;var d=b.color;for(a=0;a<d.length;++a)d[a].resize(f);for(a=0;6>a;++a)c[a].resize(f);b.width=b.height=f;return b},_reglType:"framebufferCube",destroy:function(){c.forEach(function(a){a.destroy()})}})},clear:function(){J(w).forEach(p)},restore:function(){Q.cur=null;Q.next=null;Q.dirty=!0;J(w).forEach(function(b){b.framebuffer=
a.createFramebuffer();m(b)})}})}function Ya(){this.w=this.z=this.y=this.x=this.state=0;this.buffer=null;this.size=0;this.normalized=!1;this.type=5126;this.divisor=this.stride=this.offset=0}function Pb(a,b,c,e,d){function g(a){if(a!==h.currentVAO){var c=b.oes_vertex_array_object;a?c.bindVertexArrayOES(a.vao):c.bindVertexArrayOES(null);h.currentVAO=a}}function r(c){if(c!==h.currentVAO){if(c)c.bindAttrs();else for(var d=b.angle_instanced_arrays,e=0;e<l.length;++e){var g=l[e];g.buffer?(a.enableVertexAttribArray(e),
a.vertexAttribPointer(e,g.size,g.type,g.normalized,g.stride,g.offfset),d&&d.vertexAttribDivisorANGLE(e,g.divisor)):(a.disableVertexAttribArray(e),a.vertexAttrib4f(e,g.x,g.y,g.z,g.w))}h.currentVAO=c}}function n(a){J(k).forEach(function(a){a.destroy()})}function u(){this.id=++F;this.attributes=[];var a=b.oes_vertex_array_object;this.vao=a?a.createVertexArrayOES():null;k[this.id]=this;this.buffers=[]}function q(){b.oes_vertex_array_object&&J(k).forEach(function(a){a.refresh()})}var t=c.maxAttributes,
l=Array(t);for(c=0;c<t;++c)l[c]=new Ya;var F=0,k={},h={Record:Ya,scope:{},state:l,currentVAO:null,targetVAO:null,restore:b.oes_vertex_array_object?q:function(){},createVAO:function(a){function b(a){for(var f=0;f<c.buffers.length;++f)c.buffers[f].destroy();c.buffers.length=0;f=c.attributes;f.length=a.length;for(var e=0;e<a.length;++e){var h=a[e],g=f[e]=new Ya;Array.isArray(h)||G(h)||X(h)?(h=d.create(h,34962,!1,!0),g.buffer=d.getBuffer(h),g.size=g.buffer.dimension|0,g.normalized=!1,g.type=g.buffer.dtype,
g.offset=0,g.stride=0,g.divisor=0,g.state=1,c.buffers.push(h)):d.getBuffer(h)?(g.buffer=d.getBuffer(h),g.size=g.buffer.dimension|0,g.normalized=!1,g.type=g.buffer.dtype,g.offset=0,g.stride=0,g.divisor=0,g.state=1):d.getBuffer(h.buffer)?(g.buffer=d.getBuffer(h.buffer),g.size=(+h.size||g.buffer.dimension)|0,g.normalized=!!h.normalized||!1,g.type="type"in h?Ia[h.type]:g.buffer.dtype,g.offset=(h.offset||0)|0,g.stride=(h.stride||0)|0,g.divisor=(h.divisor||0)|0,g.state=1):"x"in h&&(g.x=+h.x||0,g.y=+h.y||
0,g.z=+h.z||0,g.w=+h.w||0,g.state=2)}c.refresh();return b}var c=new u;e.vaoCount+=1;b.destroy=function(){c.destroy()};b._vao=c;b._reglType="vao";return b(a)},getVAO:function(a){return"function"===typeof a&&a._vao?a._vao:null},destroyBuffer:function(b){for(var c=0;c<l.length;++c){var e=l[c];e.buffer===b&&(a.disableVertexAttribArray(c),e.buffer=null)}},setVAO:b.oes_vertex_array_object?g:r,clear:b.oes_vertex_array_object?n:function(){}};u.prototype.bindAttrs=function(){for(var c=b.angle_instanced_arrays,
e=this.attributes,h=0;h<e.length;++h){var d=e[h];d.buffer?(a.enableVertexAttribArray(h),a.bindBuffer(34962,d.buffer.buffer),a.vertexAttribPointer(h,d.size,d.type,d.normalized,d.stride,d.offset),c&&c.vertexAttribDivisorANGLE(h,d.divisor)):(a.disableVertexAttribArray(h),a.vertexAttrib4f(h,d.x,d.y,d.z,d.w))}for(c=e.length;c<t;++c)a.disableVertexAttribArray(c)};u.prototype.refresh=function(){var a=b.oes_vertex_array_object;a&&(a.bindVertexArrayOES(this.vao),this.bindAttrs(),h.currentVAO=this)};u.prototype.destroy=
function(){if(this.vao){var a=b.oes_vertex_array_object;this===h.currentVAO&&(h.currentVAO=null,a.bindVertexArrayOES(null));a.deleteVertexArrayOES(this.vao);this.vao=null}k[this.id]&&(delete k[this.id],--e.vaoCount)};return h}function Qb(a,b,c,e){function d(a,b,c,e){this.name=a;this.id=b;this.location=c;this.info=e}function g(a,b){for(var c=0;c<a.length;++c)if(a[c].id===b.id){a[c].location=b.location;return}a.push(b)}function r(c,f,e){e=35632===c?q:t;var d=e[f];if(!d){var g=b.str(f),d=a.createShader(c);
a.shaderSource(d,g);a.compileShader(d);e[f]=d}return d}function n(a,b){this.id=k++;this.fragId=a;this.vertId=b;this.program=null;this.uniforms=[];this.attributes=[];e.profile&&(this.stats={uniformsCount:0,attributesCount:0})}function u(c,f,k){var l;l=r(35632,c.fragId);var n=r(35633,c.vertId);f=c.program=a.createProgram();a.attachShader(f,l);a.attachShader(f,n);if(k)for(l=0;l<k.length;++l)n=k[l],a.bindAttribLocation(f,n[0],n[1]);a.linkProgram(f);n=a.getProgramParameter(f,35718);e.profile&&(c.stats.uniformsCount=
n);var q=c.uniforms;for(k=0;k<n;++k)if(l=a.getActiveUniform(f,k))if(1<l.size)for(var u=0;u<l.size;++u){var t=l.name.replace("[0]","["+u+"]");g(q,new d(t,b.id(t),a.getUniformLocation(f,t),l))}else g(q,new d(l.name,b.id(l.name),a.getUniformLocation(f,l.name),l));n=a.getProgramParameter(f,35721);e.profile&&(c.stats.attributesCount=n);c=c.attributes;for(k=0;k<n;++k)(l=a.getActiveAttrib(f,k))&&g(c,new d(l.name,b.id(l.name),a.getAttribLocation(f,l.name),l))}var q={},t={},l={},F=[],k=0;e.profile&&(c.getMaxUniformsCount=
function(){var a=0;F.forEach(function(b){b.stats.uniformsCount>a&&(a=b.stats.uniformsCount)});return a},c.getMaxAttributesCount=function(){var a=0;F.forEach(function(b){b.stats.attributesCount>a&&(a=b.stats.attributesCount)});return a});return{clear:function(){var b=a.deleteShader.bind(a);J(q).forEach(b);q={};J(t).forEach(b);t={};F.forEach(function(b){a.deleteProgram(b.program)});F.length=0;l={};c.shaderCount=0},program:function(a,b,e,d){var g=l[b];g||(g=l[b]={});var k=g[a];if(k&&!d)return k;b=new n(b,
a);c.shaderCount++;u(b,e,d);k||(g[a]=b);F.push(b);return b},restore:function(){q={};t={};for(var a=0;a<F.length;++a)u(F[a],null,F[a].attributes.map(function(a){return[a.location,a.name]}))},shader:r,frag:-1,vert:-1}}function Rb(a,b,c,e,d,g,r){function n(d){var g;g=null===b.next?5121:b.next.colorAttachments[0].texture._texture.type;var l=0,n=0,k=e.framebufferWidth,h=e.framebufferHeight,f=null;G(d)?f=d:d&&(l=d.x|0,n=d.y|0,k=(d.width||e.framebufferWidth-l)|0,h=(d.height||e.framebufferHeight-n)|0,f=d.data||
null);c();d=k*h*4;f||(5121===g?f=new Uint8Array(d):5126===g&&(f=f||new Float32Array(d)));a.pixelStorei(3333,4);a.readPixels(l,n,k,h,6408,g,f);return f}function u(a){var c;b.setFBO({framebuffer:a.framebuffer},function(){c=n(a)});return c}return function(a){return a&&"framebuffer"in a?u(a):n(a)}}function ua(a){return Array.prototype.slice.call(a)}function Ba(a){return ua(a).join("")}function Sb(){function a(){var a=[],b=[];return H(function(){a.push.apply(a,ua(arguments))},{def:function(){var d="v"+
c++;b.push(d);0<arguments.length&&(a.push(d,"="),a.push.apply(a,ua(arguments)),a.push(";"));return d},toString:function(){return Ba([0<b.length?"var "+b.join(",")+";":"",Ba(a)])}})}function b(){function b(a,e){d(a,e,"=",c.def(a,e),";")}var c=a(),d=a(),e=c.toString,g=d.toString;return H(function(){c.apply(c,ua(arguments))},{def:c.def,entry:c,exit:d,save:b,set:function(a,d,e){b(a,d);c(a,d,"=",e,";")},toString:function(){return e()+g()}})}var c=0,e=[],d=[],g=a(),r={};return{global:g,link:function(a){for(var b=
0;b<d.length;++b)if(d[b]===a)return e[b];b="g"+c++;e.push(b);d.push(a);return b},block:a,proc:function(a,c){function d(){var a="a"+e.length;e.push(a);return a}var e=[];c=c||0;for(var g=0;g<c;++g)d();var g=b(),F=g.toString;return r[a]=H(g,{arg:d,toString:function(){return Ba(["function(",e.join(),"){",F(),"}"])}})},scope:b,cond:function(){var a=Ba(arguments),c=b(),d=b(),e=c.toString,g=d.toString;return H(c,{then:function(){c.apply(c,ua(arguments));return this},"else":function(){d.apply(d,ua(arguments));
return this},toString:function(){var b=g();b&&(b="else{"+b+"}");return Ba(["if(",a,"){",e(),"}",b])}})},compile:function(){var a=['"use strict";',g,"return {"];Object.keys(r).forEach(function(b){a.push('"',b,'":',r[b].toString(),",")});a.push("}");var b=Ba(a).replace(/;/g,";\n").replace(/}/g,"}\n").replace(/{/g,"{\n");return Function.apply(null,e.concat(b)).apply(null,d)}}}function Pa(a){return Array.isArray(a)||G(a)||X(a)}function wb(a){return a.sort(function(a,c){return"viewport"===a?-1:"viewport"===
c?1:a<c?-1:1})}function P(a,b,c,e){this.thisDep=a;this.contextDep=b;this.propDep=c;this.append=e}function va(a){return a&&!(a.thisDep||a.contextDep||a.propDep)}function C(a){return new P(!1,!1,!1,a)}function L(a,b){var c=a.type;return 0===c?(c=a.data.length,new P(!0,1<=c,2<=c,b)):4===c?(c=a.data,new P(c.thisDep,c.contextDep,c.propDep,b)):new P(3===c,2===c,1===c,b)}function Tb(a,b,c,e,d,g,r,n,u,q,t,l,F,k,h){function f(a){return a.replace(".","_")}function p(a,b,c){var d=f(a);La.push(a);Da[d]=qa[d]=
!!c;ra[d]=b}function m(a,b,c){var d=f(a);La.push(a);Array.isArray(c)?(qa[d]=c.slice(),Da[d]=c.slice()):qa[d]=Da[d]=c;sa[d]=b}function v(){var a=Sb(),c=a.link,d=a.global;a.id=ua++;a.batchId="0";var e=c(la),f=a.shared={props:"a0"};Object.keys(la).forEach(function(a){f[a]=d.def(e,".",a)});var g=a.next={},h=a.current={};Object.keys(sa).forEach(function(a){Array.isArray(qa[a])&&(g[a]=d.def(f.next,".",a),h[a]=d.def(f.current,".",a))});var da=a.constants={};Object.keys(Z).forEach(function(a){da[a]=d.def(JSON.stringify(Z[a]))});
a.invoke=function(b,d){switch(d.type){case 0:var e=["this",f.context,f.props,a.batchId];return b.def(c(d.data),".call(",e.slice(0,Math.max(d.data.length+1,4)),")");case 1:return b.def(f.props,d.data);case 2:return b.def(f.context,d.data);case 3:return b.def("this",d.data);case 4:return d.data.append(a,b),d.data.ref}};a.attribCache={};var za={};a.scopeAttrib=function(a){a=b.id(a);if(a in za)return za[a];var d=q.scope[a];d||(d=q.scope[a]=new ja);return za[a]=c(d)};return a}function Q(a){var b=a["static"];
a=a.dynamic;var c;if("profile"in b){var d=!!b.profile;c=C(function(a,b){return d});c.enable=d}else if("profile"in a){var e=a.profile;c=L(e,function(a,b){return a.invoke(b,e)})}return c}function z(a,b){var c=a["static"],d=a.dynamic;if("framebuffer"in c){var e=c.framebuffer;return e?(e=n.getFramebuffer(e),C(function(a,b){var c=a.link(e),d=a.shared;b.set(d.framebuffer,".next",c);d=d.context;b.set(d,".framebufferWidth",c+".width");b.set(d,".framebufferHeight",c+".height");return c})):C(function(a,b){var c=
a.shared;b.set(c.framebuffer,".next","null");c=c.context;b.set(c,".framebufferWidth",c+".drawingBufferWidth");b.set(c,".framebufferHeight",c+".drawingBufferHeight");return"null"})}if("framebuffer"in d){var f=d.framebuffer;return L(f,function(a,b){var c=a.invoke(b,f),d=a.shared,e=d.framebuffer,c=b.def(e,".getFramebuffer(",c,")");b.set(e,".next",c);d=d.context;b.set(d,".framebufferWidth",c+"?"+c+".width:"+d+".drawingBufferWidth");b.set(d,".framebufferHeight",c+"?"+c+".height:"+d+".drawingBufferHeight");
return c})}return null}function w(a,b,c){function d(a){if(a in e){var c=e[a];a=!0;var g=c.x|0,y=c.y|0,h,U;"width"in c?h=c.width|0:a=!1;"height"in c?U=c.height|0:a=!1;return new P(!a&&b&&b.thisDep,!a&&b&&b.contextDep,!a&&b&&b.propDep,function(a,b){var d=a.shared.context,e=h;"width"in c||(e=b.def(d,".","framebufferWidth","-",g));var f=U;"height"in c||(f=b.def(d,".","framebufferHeight","-",y));return[g,y,e,f]})}if(a in f){var k=f[a];a=L(k,function(a,b){var c=a.invoke(b,k),d=a.shared.context,e=b.def(c,
".x|0"),f=b.def(c,".y|0"),g=b.def('"width" in ',c,"?",c,".width|0:","(",d,".","framebufferWidth","-",e,")"),c=b.def('"height" in ',c,"?",c,".height|0:","(",d,".","framebufferHeight","-",f,")");return[e,f,g,c]});b&&(a.thisDep=a.thisDep||b.thisDep,a.contextDep=a.contextDep||b.contextDep,a.propDep=a.propDep||b.propDep);return a}return b?new P(b.thisDep,b.contextDep,b.propDep,function(a,b){var c=a.shared.context;return[0,0,b.def(c,".","framebufferWidth"),b.def(c,".","framebufferHeight")]}):null}var e=
a["static"],f=a.dynamic;if(a=d("viewport")){var g=a;a=new P(a.thisDep,a.contextDep,a.propDep,function(a,b){var c=g.append(a,b),d=a.shared.context;b.set(d,".viewportWidth",c[2]);b.set(d,".viewportHeight",c[3]);return c})}return{viewport:a,scissor_box:d("scissor.box")}}function H(a,b){var c=a["static"];if("string"===typeof c.frag&&"string"===typeof c.vert){if(0<Object.keys(b.dynamic).length)return null;var c=b["static"],d=Object.keys(c);if(0<d.length&&"number"===typeof c[d[0]]){for(var e=[],f=0;f<d.length;++f)e.push([c[d[f]]|
0,d[f]]);return e}}return null}function E(a,c,d){function e(a){if(a in f){var c=b.id(f[a]);a=C(function(){return c});a.id=c;return a}if(a in g){var d=g[a];return L(d,function(a,b){var c=a.invoke(b,d);return b.def(a.shared.strings,".id(",c,")")})}return null}var f=a["static"],g=a.dynamic,h=e("frag"),da=e("vert"),za=null;va(h)&&va(da)?(za=t.program(da.id,h.id,null,d),a=C(function(a,b){return a.link(za)})):a=new P(h&&h.thisDep||da&&da.thisDep,h&&h.contextDep||da&&da.contextDep,h&&h.propDep||da&&da.propDep,
function(a,b){var c=a.shared.shader,d;d=h?h.append(a,b):b.def(c,".","frag");var e;e=da?da.append(a,b):b.def(c,".","vert");return b.def(c+".program("+e+","+d+")")});return{frag:h,vert:da,progVar:a,program:za}}function G(a,b){function c(a,b){if(a in d){var g=d[a]|0;return C(function(a,c){b&&(a.OFFSET=g);return g})}if(a in e){var h=e[a];return L(h,function(a,c){var d=a.invoke(c,h);b&&(a.OFFSET=d);return d})}return b&&f?C(function(a,b){a.OFFSET="0";return 0}):null}var d=a["static"],e=a.dynamic,f=function(){if("elements"in
d){var a=d.elements;Pa(a)?a=g.getElements(g.create(a,!0)):a&&(a=g.getElements(a));var b=C(function(b,c){if(a){var d=b.link(a);return b.ELEMENTS=d}return b.ELEMENTS=null});b.value=a;return b}if("elements"in e){var c=e.elements;return L(c,function(a,b){var d=a.shared,e=d.isBufferArgs,d=d.elements,f=a.invoke(b,c),g=b.def("null"),e=b.def(e,"(",f,")"),f=a.cond(e).then(g,"=",d,".createStream(",f,");")["else"](g,"=",d,".getElements(",f,");");b.entry(f);b.exit(a.cond(e).then(d,".destroyStream(",g,");"));
return a.ELEMENTS=g})}return null}(),h=c("offset",!0);return{elements:f,primitive:function(){if("primitive"in d){var a=d.primitive;return C(function(b,c){return Ta[a]})}if("primitive"in e){var b=e.primitive;return L(b,function(a,c){var d=a.constants.primTypes,e=a.invoke(c,b);return c.def(d,"[",e,"]")})}return f?va(f)?f.value?C(function(a,b){return b.def(a.ELEMENTS,".primType")}):C(function(){return 4}):new P(f.thisDep,f.contextDep,f.propDep,function(a,b){var c=a.ELEMENTS;return b.def(c,"?",c,".primType:",
4)}):null}(),count:function(){if("count"in d){var a=d.count|0;return C(function(){return a})}if("count"in e){var b=e.count;return L(b,function(a,c){return a.invoke(c,b)})}return f?va(f)?f?h?new P(h.thisDep,h.contextDep,h.propDep,function(a,b){return b.def(a.ELEMENTS,".vertCount-",a.OFFSET)}):C(function(a,b){return b.def(a.ELEMENTS,".vertCount")}):C(function(){return-1}):new P(f.thisDep||h.thisDep,f.contextDep||h.contextDep,f.propDep||h.propDep,function(a,b){var c=a.ELEMENTS;return a.OFFSET?b.def(c,
"?",c,".vertCount-",a.OFFSET,":-1"):b.def(c,"?",c,".vertCount:-1")}):null}(),instances:c("instances",!1),offset:h}}function R(a,b){var c=a["static"],d=a.dynamic,e={};La.forEach(function(a){function b(f,h){if(a in c){var y=f(c[a]);e[g]=C(function(){return y})}else if(a in d){var I=d[a];e[g]=L(I,function(a,b){return h(a,b,a.invoke(b,I))})}}var g=f(a);switch(a){case "cull.enable":case "blend.enable":case "dither":case "stencil.enable":case "depth.enable":case "scissor.enable":case "polygonOffset.enable":case "sample.alpha":case "sample.enable":case "depth.mask":return b(function(a){return a},
function(a,b,c){return c});case "depth.func":return b(function(a){return $a[a]},function(a,b,c){return b.def(a.constants.compareFuncs,"[",c,"]")});case "depth.range":return b(function(a){return a},function(a,b,c){a=b.def("+",c,"[0]");b=b.def("+",c,"[1]");return[a,b]});case "blend.func":return b(function(a){return[Fa["srcRGB"in a?a.srcRGB:a.src],Fa["dstRGB"in a?a.dstRGB:a.dst],Fa["srcAlpha"in a?a.srcAlpha:a.src],Fa["dstAlpha"in a?a.dstAlpha:a.dst]]},function(a,b,c){function d(a,e){return b.def('"',
a,e,'" in ',c,"?",c,".",a,e,":",c,".",a)}a=a.constants.blendFuncs;var e=d("src","RGB"),f=d("dst","RGB"),e=b.def(a,"[",e,"]"),g=b.def(a,"[",d("src","Alpha"),"]"),f=b.def(a,"[",f,"]");a=b.def(a,"[",d("dst","Alpha"),"]");return[e,f,g,a]});case "blend.equation":return b(function(a){if("string"===typeof a)return[W[a],W[a]];if("object"===typeof a)return[W[a.rgb],W[a.alpha]]},function(a,b,c){var d=a.constants.blendEquations,e=b.def(),f=b.def();a=a.cond("typeof ",c,'==="string"');a.then(e,"=",f,"=",d,"[",
c,"];");a["else"](e,"=",d,"[",c,".rgb];",f,"=",d,"[",c,".alpha];");b(a);return[e,f]});case "blend.color":return b(function(a){return A(4,function(b){return+a[b]})},function(a,b,c){return A(4,function(a){return b.def("+",c,"[",a,"]")})});case "stencil.mask":return b(function(a){return a|0},function(a,b,c){return b.def(c,"|0")});case "stencil.func":return b(function(a){return[$a[a.cmp||"keep"],a.ref||0,"mask"in a?a.mask:-1]},function(a,b,c){a=b.def('"cmp" in ',c,"?",a.constants.compareFuncs,"[",c,".cmp]",
":",7680);var d=b.def(c,".ref|0");b=b.def('"mask" in ',c,"?",c,".mask|0:-1");return[a,d,b]});case "stencil.opFront":case "stencil.opBack":return b(function(b){return["stencil.opBack"===a?1029:1028,Qa[b.fail||"keep"],Qa[b.zfail||"keep"],Qa[b.zpass||"keep"]]},function(b,c,d){function e(a){return c.def('"',a,'" in ',d,"?",f,"[",d,".",a,"]:",7680)}var f=b.constants.stencilOps;return["stencil.opBack"===a?1029:1028,e("fail"),e("zfail"),e("zpass")]});case "polygonOffset.offset":return b(function(a){return[a.factor|
0,a.units|0]},function(a,b,c){a=b.def(c,".factor|0");b=b.def(c,".units|0");return[a,b]});case "cull.face":return b(function(a){var b=0;"front"===a?b=1028:"back"===a&&(b=1029);return b},function(a,b,c){return b.def(c,'==="front"?',1028,":",1029)});case "lineWidth":return b(function(a){return a},function(a,b,c){return c});case "frontFace":return b(function(a){return xb[a]},function(a,b,c){return b.def(c+'==="cw"?2304:2305')});case "colorMask":return b(function(a){return a.map(function(a){return!!a})},
function(a,b,c){return A(4,function(a){return"!!"+c+"["+a+"]"})});case "sample.coverage":return b(function(a){return["value"in a?a.value:1,!!a.invert]},function(a,b,c){a=b.def('"value" in ',c,"?+",c,".value:1");b=b.def("!!",c,".invert");return[a,b]})}});return e}function ta(a,b){var c=a["static"],d=a.dynamic,e={};Object.keys(c).forEach(function(a){var b=c[a],d;if("number"===typeof b||"boolean"===typeof b)d=C(function(){return b});else if("function"===typeof b){var f=b._reglType;if("texture2d"===f||
"textureCube"===f)d=C(function(a){return a.link(b)});else if("framebuffer"===f||"framebufferCube"===f)d=C(function(a){return a.link(b.color[0])})}else oa(b)&&(d=C(function(a){return a.global.def("[",A(b.length,function(a){return b[a]}),"]")}));d.value=b;e[a]=d});Object.keys(d).forEach(function(a){var b=d[a];e[a]=L(b,function(a,c){return a.invoke(c,b)})});return e}function J(a,c){var e=a["static"],f=a.dynamic,g={};Object.keys(e).forEach(function(a){var c=e[a],f=b.id(a),h=new ja;if(Pa(c))h.state=1,
h.buffer=d.getBuffer(d.create(c,34962,!1,!0)),h.type=0;else{var y=d.getBuffer(c);if(y)h.state=1,h.buffer=y,h.type=0;else if("constant"in c){var I=c.constant;h.buffer="null";h.state=2;"number"===typeof I?h.x=I:Ca.forEach(function(a,b){b<I.length&&(h[a]=I[b])})}else{var y=Pa(c.buffer)?d.getBuffer(d.create(c.buffer,34962,!1,!0)):d.getBuffer(c.buffer),k=c.offset|0,l=c.stride|0,ea=c.size|0,n=!!c.normalized,m=0;"type"in c&&(m=Ia[c.type]);c=c.divisor|0;h.buffer=y;h.state=1;h.size=ea;h.normalized=n;h.type=
m||y.dtype;h.offset=k;h.stride=l;h.divisor=c}}g[a]=C(function(a,b){var c=a.attribCache;if(f in c)return c[f];var d={isStream:!1};Object.keys(h).forEach(function(a){d[a]=h[a]});h.buffer&&(d.buffer=a.link(h.buffer),d.type=d.type||d.buffer+".dtype");return c[f]=d})});Object.keys(f).forEach(function(a){var b=f[a];g[a]=L(b,function(a,c){function d(a){c(y[a],"=",e,".",a,"|0;")}var e=a.invoke(c,b),f=a.shared,g=a.constants,h=f.isBufferArgs,f=f.buffer,y={isStream:c.def(!1)},I=new ja;I.state=1;Object.keys(I).forEach(function(a){y[a]=
c.def(""+I[a])});var k=y.buffer,U=y.type;c("if(",h,"(",e,")){",y.isStream,"=true;",k,"=",f,".createStream(",34962,",",e,");",U,"=",k,".dtype;","}else{",k,"=",f,".getBuffer(",e,");","if(",k,"){",U,"=",k,".dtype;",'}else if("constant" in ',e,"){",y.state,"=",2,";","if(typeof "+e+'.constant === "number"){',y[Ca[0]],"=",e,".constant;",Ca.slice(1).map(function(a){return y[a]}).join("="),"=0;","}else{",Ca.map(function(a,b){return y[a]+"="+e+".constant.length>"+b+"?"+e+".constant["+b+"]:0;"}).join(""),"}}else{",
"if(",h,"(",e,".buffer)){",k,"=",f,".createStream(",34962,",",e,".buffer);","}else{",k,"=",f,".getBuffer(",e,".buffer);","}",U,'="type" in ',e,"?",g.glTypes,"[",e,".type]:",k,".dtype;",y.normalized,"=!!",e,".normalized;");d("size");d("offset");d("stride");d("divisor");c("}}");c.exit("if(",y.isStream,"){",f,".destroyStream(",k,");","}");return y})});return g}function D(a,b){var c=a["static"],d=a.dynamic;if("vao"in c){var e=c.vao;null!==e&&null===q.getVAO(e)&&(e=q.createVAO(e));return C(function(a){return a.link(q.getVAO(e))})}if("vao"in
d){var f=d.vao;return L(f,function(a,b){var c=a.invoke(b,f);return b.def(a.shared.vao+".getVAO("+c+")")})}return null}function x(a){var b=a["static"],c=a.dynamic,d={};Object.keys(b).forEach(function(a){var c=b[a];d[a]=C(function(a,b){return"number"===typeof c||"boolean"===typeof c?""+c:a.link(c)})});Object.keys(c).forEach(function(a){var b=c[a];d[a]=L(b,function(a,c){return a.invoke(c,b)})});return d}function ma(a,b,d,e,g){function h(a){var b=n[a];b&&(Za[a]=b)}var k=H(a,b),l=z(a,g),n=w(a,l,g),m=G(a,
g),Za=R(a,g),p=E(a,g,k);h("viewport");h(f("scissor.box"));var r=0<Object.keys(Za).length,l={framebuffer:l,draw:m,shader:p,state:Za,dirty:r,scopeVAO:null,drawVAO:null,useVAO:!1,attributes:{}};l.profile=Q(a,g);l.uniforms=ta(d,g);l.drawVAO=l.scopeVAO=D(a,g);if(!l.drawVAO&&p.program&&!k&&c.angle_instanced_arrays){var t=!0;a=p.program.attributes.map(function(a){a=b["static"][a];t=t&&!!a;return a});if(t&&0<a.length){var v=q.getVAO(q.createVAO(a));l.drawVAO=new P(null,null,null,function(a,b){return a.link(v)});
l.useVAO=!0}}k?l.useVAO=!0:l.attributes=J(b,g);l.context=x(e,g);return l}function T(a,b,c){var d=a.shared.context,e=a.scope();Object.keys(c).forEach(function(f){b.save(d,"."+f);e(d,".",f,"=",c[f].append(a,b),";")});b(e)}function O(a,b,c,d){var e=a.shared,f=e.gl,g=e.framebuffer,h;Ka&&(h=b.def(e.extensions,".webgl_draw_buffers"));var k=a.constants,e=k.drawBuffer,k=k.backBuffer;a=c?c.append(a,b):b.def(g,".next");d||b("if(",a,"!==",g,".cur){");b("if(",a,"){",f,".bindFramebuffer(",36160,",",a,".framebuffer);");
Ka&&b(h,".drawBuffersWEBGL(",e,"[",a,".colorAttachments.length]);");b("}else{",f,".bindFramebuffer(",36160,",null);");Ka&&b(h,".drawBuffersWEBGL(",k,");");b("}",g,".cur=",a,";");d||b("}")}function S(a,b,c){var d=a.shared,e=d.gl,g=a.current,h=a.next,k=d.current,l=d.next,n=a.cond(k,".dirty");La.forEach(function(b){b=f(b);if(!(b in c.state)){var d,I;if(b in h){d=h[b];I=g[b];var m=A(qa[b].length,function(a){return n.def(d,"[",a,"]")});n(a.cond(m.map(function(a,b){return a+"!=="+I+"["+b+"]"}).join("||")).then(e,
".",sa[b],"(",m,");",m.map(function(a,b){return I+"["+b+"]="+a}).join(";"),";"))}else d=n.def(l,".",b),m=a.cond(d,"!==",k,".",b),n(m),b in ra?m(a.cond(d).then(e,".enable(",ra[b],");")["else"](e,".disable(",ra[b],");"),k,".",b,"=",d,";"):m(e,".",sa[b],"(",d,");",k,".",b,"=",d,";")}});0===Object.keys(c.state).length&&n(k,".dirty=false;");b(n)}function K(a,b,c,d){var e=a.shared,f=a.current,g=e.current,h=e.gl;wb(Object.keys(c)).forEach(function(e){var k=c[e];if(!d||d(k)){var l=k.append(a,b);if(ra[e]){var n=
ra[e];va(k)?l?b(h,".enable(",n,");"):b(h,".disable(",n,");"):b(a.cond(l).then(h,".enable(",n,");")["else"](h,".disable(",n,");"));b(g,".",e,"=",l,";")}else if(oa(l)){var m=f[e];b(h,".",sa[e],"(",l,");",l.map(function(a,b){return m+"["+b+"]="+a}).join(";"),";")}else b(h,".",sa[e],"(",l,");",g,".",e,"=",l,";")}})}function B(a,b){pa&&(a.instancing=b.def(a.shared.extensions,".angle_instanced_arrays"))}function V(a,b,c,d,e){function f(){return"undefined"===typeof performance?"Date.now()":"performance.now()"}
function g(a){q=b.def();a(q,"=",f(),";");"string"===typeof e?a(m,".count+=",e,";"):a(m,".count++;");k&&(d?(t=b.def(),a(t,"=",r,".getNumPendingQueries();")):a(r,".beginQuery(",m,");"))}function h(a){a(m,".cpuTime+=",f(),"-",q,";");k&&(d?a(r,".pushScopeStats(",t,",",r,".getNumPendingQueries(),",m,");"):a(r,".endQuery();"))}function l(a){var c=b.def(p,".profile");b(p,".profile=",a,";");b.exit(p,".profile=",c,";")}var n=a.shared,m=a.stats,p=n.current,r=n.timer;c=c.profile;var q,t;if(c){if(va(c)){c.enable?
(g(b),h(b.exit),l("true")):l("false");return}c=c.append(a,b);l(c)}else c=b.def(p,".profile");n=a.block();g(n);b("if(",c,"){",n,"}");a=a.block();h(a);b.exit("if(",c,"){",a,"}")}function N(a,b,c,d,e){function f(a){switch(a){case 35664:case 35667:case 35671:return 2;case 35665:case 35668:case 35672:return 3;case 35666:case 35669:case 35673:return 4;default:return 1}}function g(c,d,e){function f(){b("if(!",m,".buffer){",l,".enableVertexAttribArray(",n,");}");var c=e.type,g;g=e.size?b.def(e.size,"||",
d):d;b("if(",m,".type!==",c,"||",m,".size!==",g,"||",ea.map(function(a){return m+"."+a+"!=="+e[a]}).join("||"),"){",l,".bindBuffer(",34962,",",U,".buffer);",l,".vertexAttribPointer(",[n,g,c,e.normalized,e.stride,e.offset],");",m,".type=",c,";",m,".size=",g,";",ea.map(function(a){return m+"."+a+"="+e[a]+";"}).join(""),"}");pa&&(c=e.divisor,b("if(",m,".divisor!==",c,"){",a.instancing,".vertexAttribDivisorANGLE(",[n,c],");",m,".divisor=",c,";}"))}function k(){b("if(",m,".buffer){",l,".disableVertexAttribArray(",
n,");",m,".buffer=null;","}if(",Ca.map(function(a,b){return m+"."+a+"!=="+p[b]}).join("||"),"){",l,".vertexAttrib4f(",n,",",p,");",Ca.map(function(a,b){return m+"."+a+"="+p[b]+";"}).join(""),"}")}var l=h.gl,n=b.def(c,".location"),m=b.def(h.attributes,"[",n,"]");c=e.state;var U=e.buffer,p=[e.x,e.y,e.z,e.w],ea=["buffer","normalized","offset","stride"];1===c?f():2===c?k():(b("if(",c,"===",1,"){"),f(),b("}else{"),k(),b("}"))}var h=a.shared;d.forEach(function(d){var h=d.name,k=c.attributes[h],l;if(k){if(!e(k))return;
l=k.append(a,b)}else{if(!e(yb))return;var n=a.scopeAttrib(h);l={};Object.keys(new ja).forEach(function(a){l[a]=b.def(n,".",a)})}g(a.link(d),f(d.info.type),l)})}function xa(a,c,d,e,f){for(var g=a.shared,h=g.gl,k,l=0;l<e.length;++l){var n=e[l],m=n.name,p=n.info.type,r=d.uniforms[m],n=a.link(n)+".location",q;if(r){if(!f(r))continue;if(va(r)){m=r.value;if(35678===p||35680===p)p=a.link(m._texture||m.color[0]._texture),c(h,".uniform1i(",n,",",p+".bind());"),c.exit(p,".unbind();");else if(35674===p||35675===
p||35676===p)m=a.global.def("new Float32Array(["+Array.prototype.slice.call(m)+"])"),r=2,35675===p?r=3:35676===p&&(r=4),c(h,".uniformMatrix",r,"fv(",n,",false,",m,");");else{switch(p){case 5126:k="1f";break;case 35664:k="2f";break;case 35665:k="3f";break;case 35666:k="4f";break;case 35670:k="1i";break;case 5124:k="1i";break;case 35671:k="2i";break;case 35667:k="2i";break;case 35672:k="3i";break;case 35668:k="3i";break;case 35673:k="4i";break;case 35669:k="4i"}c(h,".uniform",k,"(",n,",",oa(m)?Array.prototype.slice.call(m):
m,");")}continue}else q=r.append(a,c)}else{if(!f(yb))continue;q=c.def(g.uniforms,"[",b.id(m),"]")}35678===p?c("if(",q,"&&",q,'._reglType==="framebuffer"){',q,"=",q,".color[0];","}"):35680===p&&c("if(",q,"&&",q,'._reglType==="framebufferCube"){',q,"=",q,".color[0];","}");m=1;switch(p){case 35678:case 35680:p=c.def(q,"._texture");c(h,".uniform1i(",n,",",p,".bind());");c.exit(p,".unbind();");continue;case 5124:case 35670:k="1i";break;case 35667:case 35671:k="2i";m=2;break;case 35668:case 35672:k="3i";
m=3;break;case 35669:case 35673:k="4i";m=4;break;case 5126:k="1f";break;case 35664:k="2f";m=2;break;case 35665:k="3f";m=3;break;case 35666:k="4f";m=4;break;case 35674:k="Matrix2fv";break;case 35675:k="Matrix3fv";break;case 35676:k="Matrix4fv"}c(h,".uniform",k,"(",n,",");if("M"===k.charAt(0)){var n=Math.pow(p-35674+2,2),t=a.global.def("new Float32Array(",n,")");c("false,(Array.isArray(",q,")||",q," instanceof Float32Array)?",q,":(",A(n,function(a){return t+"["+a+"]="+q+"["+a+"]"}),",",t,")")}else 1<
m?c(A(m,function(a){return q+"["+a+"]"})):c(q);c(");")}}function ba(a,b,c,d){function e(f){var g=m[f];return g?g.contextDep&&d.contextDynamic||g.propDep?g.append(a,c):g.append(a,b):b.def(l,".",f)}function f(){function a(){c(v,".drawElementsInstancedANGLE(",[p,r,u,q+"<<(("+u+"-5121)>>1)",t],");")}function b(){c(v,".drawArraysInstancedANGLE(",[p,q,r,t],");")}n?ca?a():(c("if(",n,"){"),a(),c("}else{"),b(),c("}")):b()}function g(){function a(){c(k+".drawElements("+[p,r,u,q+"<<(("+u+"-5121)>>1)"]+");")}
function b(){c(k+".drawArrays("+[p,q,r]+");")}n?ca?a():(c("if(",n,"){"),a(),c("}else{"),b(),c("}")):b()}var h=a.shared,k=h.gl,l=h.draw,m=d.draw,n=function(){var e=m.elements,f=b;if(e){if(e.contextDep&&d.contextDynamic||e.propDep)f=c;e=e.append(a,f)}else e=f.def(l,".","elements");e&&f("if("+e+")"+k+".bindBuffer(34963,"+e+".buffer.buffer);");return e}(),p=e("primitive"),q=e("offset"),r=function(){var e=m.count,f=b;if(e){if(e.contextDep&&d.contextDynamic||e.propDep)f=c;e=e.append(a,f)}else e=f.def(l,
".","count");return e}();if("number"===typeof r){if(0===r)return}else c("if(",r,"){"),c.exit("}");var t,v;pa&&(t=e("instances"),v=a.instancing);var u=n+".type",ca=m.elements&&va(m.elements);pa&&("number"!==typeof t||0<=t)?"string"===typeof t?(c("if(",t,">0){"),f(),c("}else if(",t,"<0){"),g(),c("}")):f():g()}function ya(a,b,c,d,e){b=v();e=b.proc("body",e);pa&&(b.instancing=e.def(b.shared.extensions,".angle_instanced_arrays"));a(b,e,c,d);return b.compile().body}function ca(a,b,c,d){B(a,b);c.useVAO?
c.drawVAO?b(a.shared.vao,".setVAO(",c.drawVAO.append(a,b),");"):b(a.shared.vao,".setVAO(",a.shared.vao,".targetVAO);"):(b(a.shared.vao,".setVAO(null);"),N(a,b,c,d.attributes,function(){return!0}));xa(a,b,c,d.uniforms,function(){return!0});ba(a,b,b,c)}function Ea(a,b){var c=a.proc("draw",1);B(a,c);T(a,c,b.context);O(a,c,b.framebuffer);S(a,c,b);K(a,c,b.state);V(a,c,b,!1,!0);var d=b.shader.progVar.append(a,c);c(a.shared.gl,".useProgram(",d,".program);");if(b.shader.program)ca(a,c,b,b.shader.program);
else{c(a.shared.vao,".setVAO(null);");var e=a.global.def("{}"),f=c.def(d,".id"),g=c.def(e,"[",f,"]");c(a.cond(g).then(g,".call(this,a0);")["else"](g,"=",e,"[",f,"]=",a.link(function(c){return ya(ca,a,b,c,1)}),"(",d,");",g,".call(this,a0);"))}0<Object.keys(b.state).length&&c(a.shared.current,".dirty=true;")}function ga(a,b,c,d){function e(){return!0}a.batchId="a1";B(a,b);N(a,b,c,d.attributes,e);xa(a,b,c,d.uniforms,e);ba(a,b,b,c)}function M(a,b,c,d){function e(a){return a.contextDep&&g||a.propDep}function f(a){return!e(a)}
B(a,b);var g=c.contextDep,h=b.def(),k=b.def();a.shared.props=k;a.batchId=h;var l=a.scope(),m=a.scope();b(l.entry,"for(",h,"=0;",h,"<","a1",";++",h,"){",k,"=","a0","[",h,"];",m,"}",l.exit);c.needsContext&&T(a,m,c.context);c.needsFramebuffer&&O(a,m,c.framebuffer);K(a,m,c.state,e);c.profile&&e(c.profile)&&V(a,m,c,!1,!0);d?(c.useVAO?c.drawVAO?e(c.drawVAO)?m(a.shared.vao,".setVAO(",c.drawVAO.append(a,m),");"):l(a.shared.vao,".setVAO(",c.drawVAO.append(a,l),");"):l(a.shared.vao,".setVAO(",a.shared.vao,
".targetVAO);"):(l(a.shared.vao,".setVAO(null);"),N(a,l,c,d.attributes,f),N(a,m,c,d.attributes,e)),xa(a,l,c,d.uniforms,f),xa(a,m,c,d.uniforms,e),ba(a,l,m,c)):(b=a.global.def("{}"),d=c.shader.progVar.append(a,m),k=m.def(d,".id"),l=m.def(b,"[",k,"]"),m(a.shared.gl,".useProgram(",d,".program);","if(!",l,"){",l,"=",b,"[",k,"]=",a.link(function(b){return ya(ga,a,c,b,2)}),"(",d,");}",l,".call(this,a0[",h,"],",h,");"))}function X(a,b){function c(a){return a.contextDep&&e||a.propDep}var d=a.proc("batch",
2);a.batchId="0";B(a,d);var e=!1,f=!0;Object.keys(b.context).forEach(function(a){e=e||b.context[a].propDep});e||(T(a,d,b.context),f=!1);var g=b.framebuffer,h=!1;g?(g.propDep?e=h=!0:g.contextDep&&e&&(h=!0),h||O(a,d,g)):O(a,d,null);b.state.viewport&&b.state.viewport.propDep&&(e=!0);S(a,d,b);K(a,d,b.state,function(a){return!c(a)});b.profile&&c(b.profile)||V(a,d,b,!1,"a1");b.contextDep=e;b.needsContext=f;b.needsFramebuffer=h;f=b.shader.progVar;if(f.contextDep&&e||f.propDep)M(a,d,b,null);else if(f=f.append(a,
d),d(a.shared.gl,".useProgram(",f,".program);"),b.shader.program)M(a,d,b,b.shader.program);else{d(a.shared.vao,".setVAO(null);");var g=a.global.def("{}"),h=d.def(f,".id"),k=d.def(g,"[",h,"]");d(a.cond(k).then(k,".call(this,a0,a1);")["else"](k,"=",g,"[",h,"]=",a.link(function(c){return ya(M,a,b,c,2)}),"(",f,");",k,".call(this,a0,a1);"))}0<Object.keys(b.state).length&&d(a.shared.current,".dirty=true;")}function Y(a,c){function d(b){var g=c.shader[b];g&&e.set(f.shader,"."+b,g.append(a,e))}var e=a.proc("scope",
3);a.batchId="a2";var f=a.shared,g=f.current;T(a,e,c.context);c.framebuffer&&c.framebuffer.append(a,e);wb(Object.keys(c.state)).forEach(function(b){var d=c.state[b].append(a,e);oa(d)?d.forEach(function(c,d){e.set(a.next[b],"["+d+"]",c)}):e.set(f.next,"."+b,d)});V(a,e,c,!0,!0);["elements","offset","count","instances","primitive"].forEach(function(b){var d=c.draw[b];d&&e.set(f.draw,"."+b,""+d.append(a,e))});Object.keys(c.uniforms).forEach(function(d){e.set(f.uniforms,"["+b.id(d)+"]",c.uniforms[d].append(a,
e))});Object.keys(c.attributes).forEach(function(b){var d=c.attributes[b].append(a,e),f=a.scopeAttrib(b);Object.keys(new ja).forEach(function(a){e.set(f,"."+a,d[a])})});c.scopeVAO&&e.set(f.vao,".targetVAO",c.scopeVAO.append(a,e));d("vert");d("frag");0<Object.keys(c.state).length&&(e(g,".dirty=true;"),e.exit(g,".dirty=true;"));e("a1(",a.shared.context,",a0,",a.batchId,");")}function ia(a){if("object"===typeof a&&!oa(a)){for(var b=Object.keys(a),c=0;c<b.length;++c)if(ha.isDynamic(a[b[c]]))return!0;
return!1}}function ka(a,b,c){function d(a,b){g.forEach(function(c){var d=e[c];ha.isDynamic(d)&&(d=a.invoke(b,d),b(m,".",c,"=",d,";"))})}var e=b["static"][c];if(e&&ia(e)){var f=a.global,g=Object.keys(e),h=!1,k=!1,l=!1,m=a.global.def("{}");g.forEach(function(b){var c=e[b];if(ha.isDynamic(c))"function"===typeof c&&(c=e[b]=ha.unbox(c)),b=L(c,null),h=h||b.thisDep,l=l||b.propDep,k=k||b.contextDep;else{f(m,".",b,"=");switch(typeof c){case "number":f(c);break;case "string":f('"',c,'"');break;case "object":Array.isArray(c)&&
f("[",c.join(),"]");break;default:f(a.link(c))}f(";")}});b.dynamic[c]=new ha.DynamicVariable(4,{thisDep:h,contextDep:k,propDep:l,ref:m,append:d});delete b["static"][c]}}var ja=q.Record,W={add:32774,subtract:32778,"reverse subtract":32779};c.ext_blend_minmax&&(W.min=32775,W.max=32776);var pa=c.angle_instanced_arrays,Ka=c.webgl_draw_buffers,qa={dirty:!0,profile:h.profile},Da={},La=[],ra={},sa={};p("dither",3024);p("blend.enable",3042);m("blend.color","blendColor",[0,0,0,0]);m("blend.equation","blendEquationSeparate",
[32774,32774]);m("blend.func","blendFuncSeparate",[1,0,1,0]);p("depth.enable",2929,!0);m("depth.func","depthFunc",513);m("depth.range","depthRange",[0,1]);m("depth.mask","depthMask",!0);m("colorMask","colorMask",[!0,!0,!0,!0]);p("cull.enable",2884);m("cull.face","cullFace",1029);m("frontFace","frontFace",2305);m("lineWidth","lineWidth",1);p("polygonOffset.enable",32823);m("polygonOffset.offset","polygonOffset",[0,0]);p("sample.alpha",32926);p("sample.enable",32928);m("sample.coverage","sampleCoverage",
[1,!1]);p("stencil.enable",2960);m("stencil.mask","stencilMask",-1);m("stencil.func","stencilFunc",[519,0,-1]);m("stencil.opFront","stencilOpSeparate",[1028,7680,7680,7680]);m("stencil.opBack","stencilOpSeparate",[1029,7680,7680,7680]);p("scissor.enable",3089);m("scissor.box","scissor",[0,0,a.drawingBufferWidth,a.drawingBufferHeight]);m("viewport","viewport",[0,0,a.drawingBufferWidth,a.drawingBufferHeight]);var la={gl:a,context:F,strings:b,next:Da,current:qa,draw:l,elements:g,buffer:d,shader:t,attributes:q.state,
vao:q,uniforms:u,framebuffer:n,extensions:c,timer:k,isBufferArgs:Pa},Z={primTypes:Ta,compareFuncs:$a,blendFuncs:Fa,blendEquations:W,stencilOps:Qa,glTypes:Ia,orientationType:xb};Ka&&(Z.backBuffer=[1029],Z.drawBuffer=A(e.maxDrawbuffers,function(a){return 0===a?[0]:A(a,function(a){return 36064+a})}));var ua=0;return{next:Da,current:qa,procs:function(){var a=v(),b=a.proc("poll"),d=a.proc("refresh"),f=a.block();b(f);d(f);var g=a.shared,h=g.gl,k=g.next,l=g.current;f(l,".dirty=false;");O(a,b);O(a,d,null,
!0);var m;pa&&(m=a.link(pa));c.oes_vertex_array_object&&d(a.link(c.oes_vertex_array_object),".bindVertexArrayOES(null);");for(var n=0;n<e.maxAttributes;++n){var p=d.def(g.attributes,"[",n,"]"),q=a.cond(p,".buffer");q.then(h,".enableVertexAttribArray(",n,");",h,".bindBuffer(",34962,",",p,".buffer.buffer);",h,".vertexAttribPointer(",n,",",p,".size,",p,".type,",p,".normalized,",p,".stride,",p,".offset);")["else"](h,".disableVertexAttribArray(",n,");",h,".vertexAttrib4f(",n,",",p,".x,",p,".y,",p,".z,",
p,".w);",p,".buffer=null;");d(q);pa&&d(m,".vertexAttribDivisorANGLE(",n,",",p,".divisor);")}d(a.shared.vao,".currentVAO=null;",a.shared.vao,".setVAO(",a.shared.vao,".targetVAO);");Object.keys(ra).forEach(function(c){var e=ra[c],g=f.def(k,".",c),m=a.block();m("if(",g,"){",h,".enable(",e,")}else{",h,".disable(",e,")}",l,".",c,"=",g,";");d(m);b("if(",g,"!==",l,".",c,"){",m,"}")});Object.keys(sa).forEach(function(c){var e=sa[c],g=qa[c],m,n,p=a.block();p(h,".",e,"(");oa(g)?(e=g.length,m=a.global.def(k,
".",c),n=a.global.def(l,".",c),p(A(e,function(a){return m+"["+a+"]"}),");",A(e,function(a){return n+"["+a+"]="+m+"["+a+"];"}).join("")),b("if(",A(e,function(a){return m+"["+a+"]!=="+n+"["+a+"]"}).join("||"),"){",p,"}")):(m=f.def(k,".",c),n=f.def(l,".",c),p(m,");",l,".",c,"=",m,";"),b("if(",m,"!==",n,"){",p,"}"));d(p)});return a.compile()}(),compile:function(a,b,c,d,e){var f=v();f.stats=f.link(e);Object.keys(b["static"]).forEach(function(a){ka(f,b,a)});Ub.forEach(function(b){ka(f,a,b)});c=ma(a,b,c,
d,f);Ea(f,c);Y(f,c);X(f,c);return f.compile()}}}function zb(a,b){for(var c=0;c<a.length;++c)if(a[c]===b)return c;return-1}var H=function(a,b){for(var c=Object.keys(b),e=0;e<c.length;++e)a[c[e]]=b[c[e]];return a},Bb=0,ha={DynamicVariable:ka,define:function(a,b){return new ka(a,bb(b+""))},isDynamic:function(a){return"function"===typeof a&&!a._reglType||a instanceof ka},unbox:function(a,b){return"function"===typeof a?new ka(0,a):a},accessor:bb},ab={next:"function"===typeof requestAnimationFrame?function(a){return requestAnimationFrame(a)}:
function(a){return setTimeout(a,16)},cancel:"function"===typeof cancelAnimationFrame?function(a){return cancelAnimationFrame(a)}:clearTimeout},Ab="undefined"!==typeof performance&&performance.now?function(){return performance.now()}:function(){return+new Date},z=fb();z.zero=fb();var Vb=function(a,b){var c=1;b.ext_texture_filter_anisotropic&&(c=a.getParameter(34047));var e=1,d=1;b.webgl_draw_buffers&&(e=a.getParameter(34852),d=a.getParameter(36063));var g=!!b.oes_texture_float;if(g){g=a.createTexture();
a.bindTexture(3553,g);a.texImage2D(3553,0,6408,1,1,0,6408,5126,null);var r=a.createFramebuffer();a.bindFramebuffer(36160,r);a.framebufferTexture2D(36160,36064,3553,g,0);a.bindTexture(3553,null);if(36053!==a.checkFramebufferStatus(36160))g=!1;else{a.viewport(0,0,1,1);a.clearColor(1,0,0,1);a.clear(16384);var n=z.allocType(5126,4);a.readPixels(0,0,1,1,6408,5126,n);a.getError()?g=!1:(a.deleteFramebuffer(r),a.deleteTexture(g),g=1===n[0]);z.freeType(n)}}n=!0;"undefined"!==typeof navigator&&(/MSIE/.test(navigator.userAgent)||
/Trident\//.test(navigator.appVersion)||/Edge/.test(navigator.userAgent))||(n=a.createTexture(),r=z.allocType(5121,36),a.activeTexture(33984),a.bindTexture(34067,n),a.texImage2D(34069,0,6408,3,3,0,6408,5121,r),z.freeType(r),a.bindTexture(34067,null),a.deleteTexture(n),n=!a.getError());return{colorBits:[a.getParameter(3410),a.getParameter(3411),a.getParameter(3412),a.getParameter(3413)],depthBits:a.getParameter(3414),stencilBits:a.getParameter(3415),subpixelBits:a.getParameter(3408),extensions:Object.keys(b).filter(function(a){return!!b[a]}),
maxAnisotropic:c,maxDrawbuffers:e,maxColorAttachments:d,pointSizeDims:a.getParameter(33901),lineWidthDims:a.getParameter(33902),maxViewportDims:a.getParameter(3386),maxCombinedTextureUnits:a.getParameter(35661),maxCubeMapSize:a.getParameter(34076),maxRenderbufferSize:a.getParameter(34024),maxTextureUnits:a.getParameter(34930),maxTextureSize:a.getParameter(3379),maxAttributes:a.getParameter(34921),maxVertexUniforms:a.getParameter(36347),maxVertexTextureUnits:a.getParameter(35660),maxVaryingVectors:a.getParameter(36348),
maxFragmentUniforms:a.getParameter(36349),glsl:a.getParameter(35724),renderer:a.getParameter(7937),vendor:a.getParameter(7936),version:a.getParameter(7938),readFloat:g,npotTextureCube:n}},G=function(a){return a instanceof Uint8Array||a instanceof Uint16Array||a instanceof Uint32Array||a instanceof Int8Array||a instanceof Int16Array||a instanceof Int32Array||a instanceof Float32Array||a instanceof Float64Array||a instanceof Uint8ClampedArray},J=function(a){return Object.keys(a).map(function(b){return a[b]})},
Na={shape:function(a){for(var b=[];a.length;a=a[0])b.push(a.length);return b},flatten:function(a,b,c,e){var d=1;if(b.length)for(var g=0;g<b.length;++g)d*=b[g];else d=0;c=e||z.allocType(c,d);switch(b.length){case 0:break;case 1:e=b[0];for(b=0;b<e;++b)c[b]=a[b];break;case 2:e=b[0];b=b[1];for(g=d=0;g<e;++g)for(var r=a[g],n=0;n<b;++n)c[d++]=r[n];break;case 3:gb(a,b[0],b[1],b[2],c,0);break;default:hb(a,b,0,c,0)}return c}},Ha={"[object Int8Array]":5120,"[object Int16Array]":5122,"[object Int32Array]":5124,
"[object Uint8Array]":5121,"[object Uint8ClampedArray]":5121,"[object Uint16Array]":5123,"[object Uint32Array]":5125,"[object Float32Array]":5126,"[object Float64Array]":5121,"[object ArrayBuffer]":5121},Ia={int8:5120,int16:5122,int32:5124,uint8:5121,uint16:5123,uint32:5125,"float":5126,float32:5126},lb={dynamic:35048,stream:35040,"static":35044},Ra=Na.flatten,kb=Na.shape,ia=[];ia[5120]=1;ia[5122]=2;ia[5124]=4;ia[5121]=1;ia[5123]=2;ia[5125]=4;ia[5126]=4;var Ta={points:0,point:0,lines:1,line:1,triangles:4,
triangle:4,"line loop":2,"line strip":3,"triangle strip":5,"triangle fan":6},ob=new Float32Array(1),Jb=new Uint32Array(ob.buffer),Nb=[9984,9986,9985,9987],Ma=[0,6409,6410,6407,6408],S={};S[6409]=S[6406]=S[6402]=1;S[34041]=S[6410]=2;S[6407]=S[35904]=3;S[6408]=S[35906]=4;var Va=la("HTMLCanvasElement"),Wa=la("OffscreenCanvas"),sb=la("CanvasRenderingContext2D"),tb=la("ImageBitmap"),ub=la("HTMLImageElement"),vb=la("HTMLVideoElement"),Kb=Object.keys(Ha).concat([Va,Wa,sb,tb,ub,vb]),Z=[];Z[5121]=1;Z[5126]=
4;Z[36193]=2;Z[5123]=2;Z[5125]=4;var w=[];w[32854]=2;w[32855]=2;w[36194]=2;w[34041]=4;w[33776]=.5;w[33777]=.5;w[33778]=1;w[33779]=1;w[35986]=.5;w[35987]=1;w[34798]=1;w[35840]=.5;w[35841]=.25;w[35842]=.5;w[35843]=.25;w[36196]=.5;var E=[];E[32854]=2;E[32855]=2;E[36194]=2;E[33189]=2;E[36168]=1;E[34041]=4;E[35907]=4;E[34836]=16;E[34842]=8;E[34843]=6;var Wb=function(a,b,c,e,d){function g(a){this.id=q++;this.refCount=1;this.renderbuffer=a;this.format=32854;this.height=this.width=0;d.profile&&(this.stats=
{size:0})}function r(b){var c=b.renderbuffer;a.bindRenderbuffer(36161,null);a.deleteRenderbuffer(c);b.renderbuffer=null;b.refCount=0;delete t[b.id];e.renderbufferCount--}var n={rgba4:32854,rgb565:36194,"rgb5 a1":32855,depth:33189,stencil:36168,"depth stencil":34041};b.ext_srgb&&(n.srgba=35907);b.ext_color_buffer_half_float&&(n.rgba16f=34842,n.rgb16f=34843);b.webgl_color_buffer_float&&(n.rgba32f=34836);var u=[];Object.keys(n).forEach(function(a){u[n[a]]=a});var q=0,t={};g.prototype.decRef=function(){0>=
--this.refCount&&r(this)};d.profile&&(e.getTotalRenderbufferSize=function(){var a=0;Object.keys(t).forEach(function(b){a+=t[b].stats.size});return a});return{create:function(b,c){function k(b,c){var e=0,g=0,l=32854;"object"===typeof b&&b?("shape"in b?(g=b.shape,e=g[0]|0,g=g[1]|0):("radius"in b&&(e=g=b.radius|0),"width"in b&&(e=b.width|0),"height"in b&&(g=b.height|0)),"format"in b&&(l=n[b.format])):"number"===typeof b?(e=b|0,g="number"===typeof c?c|0:e):b||(e=g=1);if(e!==h.width||g!==h.height||l!==
h.format)return k.width=h.width=e,k.height=h.height=g,h.format=l,a.bindRenderbuffer(36161,h.renderbuffer),a.renderbufferStorage(36161,l,e,g),d.profile&&(h.stats.size=E[h.format]*h.width*h.height),k.format=u[h.format],k}var h=new g(a.createRenderbuffer());t[h.id]=h;e.renderbufferCount++;k(b,c);k.resize=function(b,c){var e=b|0,g=c|0||e;if(e===h.width&&g===h.height)return k;k.width=h.width=e;k.height=h.height=g;a.bindRenderbuffer(36161,h.renderbuffer);a.renderbufferStorage(36161,h.format,e,g);d.profile&&
(h.stats.size=E[h.format]*h.width*h.height);return k};k._reglType="renderbuffer";k._renderbuffer=h;d.profile&&(k.stats=h.stats);k.destroy=function(){h.decRef()};return k},clear:function(){J(t).forEach(r)},restore:function(){J(t).forEach(function(b){b.renderbuffer=a.createRenderbuffer();a.bindRenderbuffer(36161,b.renderbuffer);a.renderbufferStorage(36161,b.format,b.width,b.height)});a.bindRenderbuffer(36161,null)}}},Xa=[];Xa[6408]=4;Xa[6407]=3;var Oa=[];Oa[5121]=1;Oa[5126]=4;Oa[36193]=2;var Ca=["x",
"y","z","w"],Ub="blend.func blend.equation stencil.func stencil.opFront stencil.opBack sample.coverage viewport scissor.box polygonOffset.offset".split(" "),Fa={0:0,1:1,zero:0,one:1,"src color":768,"one minus src color":769,"src alpha":770,"one minus src alpha":771,"dst color":774,"one minus dst color":775,"dst alpha":772,"one minus dst alpha":773,"constant color":32769,"one minus constant color":32770,"constant alpha":32771,"one minus constant alpha":32772,"src alpha saturate":776},$a={never:512,
less:513,"<":513,equal:514,"=":514,"==":514,"===":514,lequal:515,"<=":515,greater:516,">":516,notequal:517,"!=":517,"!==":517,gequal:518,">=":518,always:519},Qa={0:0,zero:0,keep:7680,replace:7681,increment:7682,decrement:7683,"increment wrap":34055,"decrement wrap":34056,invert:5386},xb={cw:2304,ccw:2305},yb=new P(!1,!1,!1,function(){}),Xb=function(a,b){function c(){this.endQueryIndex=this.startQueryIndex=-1;this.sum=0;this.stats=null}function e(a,b,d){var e=r.pop()||new c;e.startQueryIndex=a;e.endQueryIndex=
b;e.sum=0;e.stats=d;n.push(e)}if(!b.ext_disjoint_timer_query)return null;var d=[],g=[],r=[],n=[],u=[],q=[];return{beginQuery:function(a){var c=d.pop()||b.ext_disjoint_timer_query.createQueryEXT();b.ext_disjoint_timer_query.beginQueryEXT(35007,c);g.push(c);e(g.length-1,g.length,a)},endQuery:function(){b.ext_disjoint_timer_query.endQueryEXT(35007)},pushScopeStats:e,update:function(){var a,c;a=g.length;if(0!==a){q.length=Math.max(q.length,a+1);u.length=Math.max(u.length,a+1);u[0]=0;var e=q[0]=0;for(c=
a=0;c<g.length;++c){var k=g[c];b.ext_disjoint_timer_query.getQueryObjectEXT(k,34919)?(e+=b.ext_disjoint_timer_query.getQueryObjectEXT(k,34918),d.push(k)):g[a++]=k;u[c+1]=e;q[c+1]=a}g.length=a;for(c=a=0;c<n.length;++c){var e=n[c],h=e.startQueryIndex,k=e.endQueryIndex;e.sum+=u[k]-u[h];h=q[h];k=q[k];k===h?(e.stats.gpuTime+=e.sum/1E6,r.push(e)):(e.startQueryIndex=h,e.endQueryIndex=k,n[a++]=e)}n.length=a}},getNumPendingQueries:function(){return g.length},clear:function(){d.push.apply(d,g);for(var a=0;a<
d.length;a++)b.ext_disjoint_timer_query.deleteQueryEXT(d[a]);g.length=0;d.length=0},restore:function(){g.length=0;d.length=0}}};return function(a){function b(){if(0===B.length)w&&w.update(),ba=null;else{ba=ab.next(b);t();for(var a=B.length-1;0<=a;--a){var c=B[a];c&&c(A,null,0)}k.flush();w&&w.update()}}function c(){!ba&&0<B.length&&(ba=ab.next(b))}function e(){ba&&(ab.cancel(b),ba=null)}function d(a){a.preventDefault();e();V.forEach(function(a){a()})}function g(a){k.getError();f.restore();D.restore();
R.restore();x.restore();N.restore();T.restore();J.restore();w&&w.restore();O.procs.refresh();c();X.forEach(function(a){a()})}function r(a){function b(a){var c={},d={};Object.keys(a).forEach(function(b){var e=a[b];ha.isDynamic(e)?d[b]=ha.unbox(e,b):c[b]=e});return{dynamic:d,"static":c}}function c(a){for(;m.length<a;)m.push(null);return m}var d=b(a.context||{}),e=b(a.uniforms||{}),f=b(a.attributes||{}),g=b(function(a){function b(a){if(a in c){var d=c[a];delete c[a];Object.keys(d).forEach(function(b){c[a+
"."+b]=d[b]})}}var c=H({},a);delete c.uniforms;delete c.attributes;delete c.context;delete c.vao;"stencil"in c&&c.stencil.op&&(c.stencil.opBack=c.stencil.opFront=c.stencil.op,delete c.stencil.op);b("blend");b("depth");b("cull");b("stencil");b("polygonOffset");b("scissor");b("sample");"vao"in a&&(c.vao=a.vao);return c}(a));a={gpuTime:0,cpuTime:0,count:0};var d=O.compile(g,f,e,d,a),h=d.draw,k=d.batch,l=d.scope,m=[];return H(function(a,b){var d;if("function"===typeof a)return l.call(this,null,a,0);if("function"===
typeof b)if("number"===typeof a)for(d=0;d<a;++d)l.call(this,null,b,d);else if(Array.isArray(a))for(d=0;d<a.length;++d)l.call(this,a[d],b,d);else return l.call(this,a,b,0);else if("number"===typeof a){if(0<a)return k.call(this,c(a|0),a|0)}else if(Array.isArray(a)){if(a.length)return k.call(this,a,a.length)}else return h.call(this,a)},{stats:a})}function n(a,b){var c=0;O.procs.poll();var d=b.color;d&&(k.clearColor(+d[0]||0,+d[1]||0,+d[2]||0,+d[3]||0),c|=16384);"depth"in b&&(k.clearDepth(+b.depth),c|=
256);"stencil"in b&&(k.clearStencil(b.stencil|0),c|=1024);k.clear(c)}function u(a){B.push(a);c();return{cancel:function(){function b(){var a=zb(B,b);B[a]=B[B.length-1];--B.length;0>=B.length&&e()}var c=zb(B,a);B[c]=b}}}function q(){var a=S.viewport,b=S.scissor_box;a[0]=a[1]=b[0]=b[1]=0;A.viewportWidth=A.framebufferWidth=A.drawingBufferWidth=a[2]=b[2]=k.drawingBufferWidth;A.viewportHeight=A.framebufferHeight=A.drawingBufferHeight=a[3]=b[3]=k.drawingBufferHeight}function t(){A.tick+=1;A.time=z();q();
O.procs.poll()}function l(){q();O.procs.refresh();w&&w.update()}function z(){return(Ab()-C)/1E3}a=Fb(a);if(!a)return null;var k=a.gl,h=k.getContextAttributes();k.isContextLost();var f=Gb(k,a);if(!f)return null;var p=Cb(),m={vaoCount:0,bufferCount:0,elementsCount:0,framebufferCount:0,shaderCount:0,textureCount:0,cubeCount:0,renderbufferCount:0,maxTextureUnits:0},v=f.extensions,w=Xb(k,v),C=Ab(),E=k.drawingBufferWidth,L=k.drawingBufferHeight,A={tick:0,time:0,viewportWidth:E,viewportHeight:L,framebufferWidth:E,
framebufferHeight:L,drawingBufferWidth:E,drawingBufferHeight:L,pixelRatio:a.pixelRatio},G=Vb(k,v),R=Hb(k,m,a,function(a){return J.destroyBuffer(a)}),J=Pb(k,v,G,m,R),P=Ib(k,v,R,m),D=Qb(k,p,m,a),x=Lb(k,v,G,function(){O.procs.poll()},A,m,a),N=Wb(k,v,G,m,a),T=Ob(k,v,G,x,N,m),O=Tb(k,p,v,G,R,P,x,T,{},J,D,{elements:null,primitive:4,count:-1,offset:0,instances:-1},A,w,a),p=Rb(k,T,O.procs.poll,A,h,v,G),S=O.next,K=k.canvas,B=[],V=[],X=[],Y=[a.onDestroy],ba=null;K&&(K.addEventListener("webglcontextlost",d,!1),
K.addEventListener("webglcontextrestored",g,!1));var Z=T.setFBO=r({framebuffer:ha.define.call(null,1,"framebuffer")});l();h=H(r,{clear:function(a){if("framebuffer"in a)if(a.framebuffer&&"framebufferCube"===a.framebuffer_reglType)for(var b=0;6>b;++b)Z(H({framebuffer:a.framebuffer.faces[b]},a),n);else Z(a,n);else n(null,a)},prop:ha.define.bind(null,1),context:ha.define.bind(null,2),"this":ha.define.bind(null,3),draw:r({}),buffer:function(a){return R.create(a,34962,!1,!1)},elements:function(a){return P.create(a,
!1)},texture:x.create2D,cube:x.createCube,renderbuffer:N.create,framebuffer:T.create,framebufferCube:T.createCube,vao:J.createVAO,attributes:h,frame:u,on:function(a,b){var c;switch(a){case "frame":return u(b);case "lost":c=V;break;case "restore":c=X;break;case "destroy":c=Y}c.push(b);return{cancel:function(){for(var a=0;a<c.length;++a)if(c[a]===b){c[a]=c[c.length-1];c.pop();break}}}},limits:G,hasExtension:function(a){return 0<=G.extensions.indexOf(a.toLowerCase())},read:p,destroy:function(){B.length=
0;e();K&&(K.removeEventListener("webglcontextlost",d),K.removeEventListener("webglcontextrestored",g));D.clear();T.clear();N.clear();x.clear();P.clear();R.clear();J.clear();w&&w.clear();Y.forEach(function(a){a()})},_gl:k,_refresh:l,poll:function(){t();w&&w.update()},now:z,stats:m});a.onDone(null,h);return h}});

},{}],27:[function(require,module,exports){
(function (global){
module.exports =
  global.performance &&
  global.performance.now ? function now() {
    return performance.now()
  } : Date.now || function now() {
    return +new Date
  }

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[2])(2)
});