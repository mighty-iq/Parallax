/* PX.bus: synchronous publish/subscribe (ARCHITECTURE.md §4). No DOM; loads in Node.
   on(evt, fn) → off; once(evt, fn) → off; emit(evt, data) → number of handlers called.
   on('*', fn(evt, data)) sees every event (debugging, logging).
   A handler that throws is reported on the console and does not stop the others.
   Events used by core: store:volatile, store:reload, store:saved, store:error, route. */
(function (PX) {
  'use strict';

  var handlers = Object.create(null);

  function report(evt, err) {
    if (typeof console !== 'undefined' && console.error) console.error('PX.bus handler for "' + evt + '" failed:', err);
  }

  function on(evt, fn) {
    if (typeof fn !== 'function') throw new TypeError('PX.bus.on("' + evt + '"): handler must be a function');
    (handlers[evt] || (handlers[evt] = [])).push(fn);
    var active = true;
    return function off() {
      if (!active) return;
      active = false;
      var list = handlers[evt];
      var i = list ? list.indexOf(fn) : -1;
      if (i >= 0) list.splice(i, 1);
    };
  }

  function once(evt, fn) {
    var off = on(evt, function (data, name) { off(); return fn(data, name); });
    return off;
  }

  function emit(evt, data) {
    var called = 0, i, list = handlers[evt], any = handlers['*'];
    // Copies, so handlers that subscribe or unsubscribe during emit do not disturb this round.
    if (list && list.length) {
      list = list.slice();
      for (i = 0; i < list.length; i++) {
        try { list[i](data, evt); } catch (e) { report(evt, e); }
        called++;
      }
    }
    if (any && any.length && evt !== '*') {
      any = any.slice();
      for (i = 0; i < any.length; i++) {
        try { any[i](evt, data); } catch (e) { report(evt, e); }
      }
    }
    return called;
  }

  function count(evt) { return handlers[evt] ? handlers[evt].length : 0; }

  PX.bus = { on: on, once: once, emit: emit, count: count };
  PX.core.bus = PX.bus; // alias: §4 names it PX.bus, the other services live under PX.core
})(window.PX);
