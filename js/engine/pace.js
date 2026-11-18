/* PX.engine.pace: an exercise's Quick deadline (v1.2; docs/dev/CONTRACT-v1.2.md A and E; PLAN
   milestone 8, Central Point's Quick form: "a deadline that tightens as the player improves, as in
   Speed").

   An exercise with def.pace gives the items of its pace variants (all when def.pace.variants is
   null) a deadline in Train, Path, Free play and the Daily (modes.js makeStep; Speed and the
   deadline protocol keep their own). One deadline per exercise lives in rec.ex[id].pace =
   { ms, n }: a weighted up/down staircase on log10(ms) that moves def.pace.step down after an
   answer given before the deadline (right or wrong: the rating judges accuracy) and
   step · target / (1 − target) up after a time-out, so about def.pace.target of the answers come
   in time (Kaernbach 1991's weighted rule). Only rated Train and Path answers move it.

     applies(def, params) → true when the item carries the deadline
     ms(rec, def)         → the current deadline in ms (def.pace.startMs for a new player)
     step(rec, def, inTime) → moves the staircase and returns the new deadline */
(function (PX) {
  'use strict';

  var isFin = isFinite, isArray = Array.isArray;
  var E = PX.engine;
  var U = PX.util;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  function applies(def, params) {
    var p = def && def.pace;
    if (!p) return false;
    if (!p.variants) return true;
    var v = params && params.variant !== undefined ? params.variant : def.variants ? def.variants[0] : undefined;
    return p.variants.indexOf(v) >= 0;
  }

  function clampMs(def, ms) { return U.clamp(Math.round(ms), def.pace.minMs, def.pace.maxMs); }

  function ms(rec, def) {
    if (!def || !def.pace) return null;
    var e = rec && isObj(rec.ex) ? rec.ex[def.id] : null, s = isObj(e) && isObj(e.pace) ? e.pace : null;
    return clampMs(def, s && isNum(s.ms) && s.ms > 0 ? s.ms : def.pace.startMs);
  }

  function step(rec, def, inTime) {
    if (!def || !def.pace) return null;
    var p = def.pace, e = E.est.exEntry(rec, def.id);
    if (!isObj(e.pace)) e.pace = { ms: p.startMs, n: 0 };
    var s = e.pace, x = Math.log(isNum(s.ms) && s.ms > 0 ? s.ms : p.startMs) / Math.LN10;
    x += inTime ? -p.step : p.step * p.target / (1 - p.target);
    s.ms = clampMs(def, Math.pow(10, x));
    s.n = (isNum(s.n) && s.n >= 0 ? Math.floor(s.n) : 0) + 1;
    return s.ms;
  }

  E.pace = { applies: applies, ms: ms, step: step };
})(window.PX);
