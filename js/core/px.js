/* Parallax namespace. Loaded first; every other file attaches to window.PX.
   ARCHITECTURE.md §3: PX = { version, core, engine, ex, ui, debug }. */
(function (win) {
  'use strict';
  var PX = win.PX || {};
  PX.version = '1.0.0';
  PX.core = PX.core || {};
  PX.engine = PX.engine || {};
  PX.ex = PX.ex || {};
  PX.ui = PX.ui || {};
  // PX.debug is always present and harmless (§12). The player (ui/play.js)
  // replaces these stubs with the real current/answer/fast.
  PX.debug = PX.debug || {
    current: function () { return null; },
    answer: function () { return false; },
    fast: function (on) { PX.debug.isFast = !!on; return PX.debug.isFast; },
    isFast: false,
  };
  win.PX = PX;
})(window);
