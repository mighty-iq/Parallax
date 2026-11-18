/* PX.engine.rebase: one conversion of stored level numbers when an exercise's difficulty range
   changes (v1.2; note D2 §3.0 A; docs/dev/CONTRACT-v1.2.md B).

   Ratings are logits and never need converting, but some stored numbers are levels on the
   1–100 scale of the range they were written on (est.levelOf): personal bests, Path stages
   (tenths of the range) and the levels in session summaries. A starter band in front of an
   exercise (or any later change of its range) moves that scale, so on load, import and another
   tab's record the store's upgrade hook converts them once:  level' = levelOf(new, bOfLevel(old, level)).

   Stamps: rec.scales = { id: [min, max] }, the range the stored levels of each exercise were written
   on. A record of format < 3 (Parallax 1.1 and older) has none: its levels are on V11, the 1.1
   ranges below. Every defined exercise is stamped after the pass, so the pass is idempotent and a
   later range change converts from the stamp.

     V11                        { id: [min, max, version] } of Parallax 1.1 (computed at 196b942)
     run(rec, fromVersion)      converts and stamps; → [{ id, from: [min, max], to: [min, max] }]
     conv(from, to)             → function (level) → the level on `to` (rounded, 1–100)
     register(fn)               fn(rec, id, conv, from, to): converts other stored levels (later
                                waves: grades, Reach, the Atlas)
     sameRange(a, b)            true within 1e-3 logits at both ends
   Converted here: rec.ex[id].best.block.level; rec.path[id] (stages, see pathConvert); session
   summaries' [exId, n, right, levelBefore, levelAfter] rows. */
(function (PX) {
  'use strict';

  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;
  var E = PX.engine;
  var U = PX.util;
  var C = E.config;
  var M = E.model;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }
  function r4(x) { return Math.round(x * 1e4) / 1e4; }

  // The level ranges of Parallax 1.1 (M.range of every definition at commit 196b942; the third
  // number is that definition's version). Never edit: it describes saved records.
  var V11 = {
    track: [-2.5, 6.35, 1], rotate: [-1.75, 2.45, 1], spin: [-1.75, 2.29, 1], fold: [-2.2, 1.85, 1], nets: [-1.7, 2.4, 1],
    slice: [-2.2, 2.6, 1], views: [-2.4, 1.9, 1], orient: [-2.25, 2.35, 1], span: [-2.5, 4.5, 1], hidden: [-2.3, 1.85, 1],
    homing: [-1.85, 2.25, 2], reckon: [-1.85, 3.25, 1], knots: [-1.75, 3.35, 1], openings: [-2.3, 1.7, 1], patviews: [-2.2, 1.8, 1],
    angles: [-2.2, 1.8, 1], patfold: [-2.3, 0.4, 1], cubes: [-2.3, 1.7, 1], form: [-2.2, 1.8, 1], wordlinks: [-2, 2.3, 1],
    cubematch: [-2.1, 2.1, 1], viewmatch: [-2, 2.1, 1], mechanisms: [-2.1, 2.1, 1], patterns: [-2.1, 2.1, 1], level: [-2.2, 1.95, 1],
  };

  var hooks = [];
  function register(fn) { if (typeof fn === 'function' && hooks.indexOf(fn) < 0) hooks.push(fn); }

  function sameRange(a, b) {
    return isArray(a) && isArray(b) && isNum(a[0]) && isNum(a[1]) && isNum(b[0]) && isNum(b[1]) &&
      Math.abs(a[0] - b[0]) < 1e-3 && Math.abs(a[1] - b[1]) < 1e-3;
  }

  function conv(from, to) {
    return function (level) {
      if (!isNum(level)) return level;
      var b = from[0] + (U.clamp(level, 1, 100) - 1) / 99 * (from[1] - from[0]);
      var span = to[1] - to[0];
      return Math.round(span > 1e-9 ? 1 + 99 * U.clamp((b - to[0]) / span, 0, 1) : 1);
    };
  }

  // Path: stage s covers the s-th tenth of the range. A stage passed on the old range shows
  // competence up to its top, so every new stage whose top lies at or below the highest passed
  // old top is passed, each with the recheck data of the old stage that covers its top. The
  // current stage follows the passed ones; its moving average restarts if its number changes.
  function pathConvert(ps, from, to) {
    if (!isObj(ps)) return;
    var N = C.path.stages, ow = (from[1] - from[0]) / N, nw = (to[1] - to[0]) / N;
    if (!(ow > 0) || !(nw > 0)) return;
    var oldPassed = isObj(ps.passed) ? ps.passed : {}, olds = [];
    Object.keys(oldPassed).forEach(function (k) { var s = +k; if (Number.isInteger(s) && s >= 1 && s <= N && isObj(oldPassed[k])) olds.push(s); });
    olds.sort(function (a, b) { return a - b; });
    var out = {};
    for (var t = 1; t <= N; t++) {
      var nHi = to[0] + t * nw;
      for (var i = 0; i < olds.length; i++) {
        if (from[0] + olds[i] * ow >= nHi - 1e-6) { out[t] = U.deepCopy(oldPassed[olds[i]]); break; }
      }
      if (!out[t]) break; // passed stages stay a run from stage 1
    }
    var top = 0;
    for (var k in out) if (hasOwn.call(out, k)) top = Math.max(top, +k);
    var oldStage = isNum(ps.stage) ? Math.round(ps.stage) : 1;
    var stage = Math.min(N, top + 1);
    if (top === N) stage = N;
    ps.passed = out;
    if (stage !== oldStage) {
      ps.stage = stage;
      ps.ema = C.path.start;
      ps.items = 0;
      delete ps.gema;
      ps.watched = {};
    }
  }

  function convertExercise(rec, id, from, to) {
    var cv = conv(from, to);
    var e = isObj(rec.ex) ? rec.ex[id] : null;
    if (isObj(e) && isObj(e.best) && isObj(e.best.block) && isNum(e.best.block.level)) e.best.block.level = cv(e.best.block.level);
    if (isObj(rec.path) && isObj(rec.path[id])) pathConvert(rec.path[id], from, to);
    (isArray(rec.sessions) ? rec.sessions : []).forEach(function (s) {
      var rows = isObj(s) && isObj(s.summary) && isArray(s.summary.ex) ? s.summary.ex : null;
      if (!rows) return;
      rows.forEach(function (r) {
        if (!isArray(r) || r[0] !== id) return;
        if (isNum(r[3])) r[3] = cv(r[3]);
        if (isNum(r[4])) r[4] = cv(r[4]);
      });
    });
    hooks.forEach(function (fn) {
      try { fn(rec, id, cv, from.slice(), to.slice()); } catch (x) { if (typeof console !== 'undefined') console.error('PX.engine.rebase hook failed', x); }
    });
  }

  function run(rec, fromVersion) {
    var report = [];
    if (!isObj(rec)) return report;
    if (!isObj(rec.scales)) rec.scales = {};
    var old = isNum(fromVersion) && fromVersion < 3;
    PX.ex.list().forEach(function (def) {
      var r = M.range(def), now = [r4(r.min), r4(r.max)], st = rec.scales[def.id];
      var from = isArray(st) && st.length >= 2 && isNum(st[0]) && isNum(st[1]) ? [st[0], st[1]] : null;
      if (!from && old && hasOwn.call(V11, def.id)) from = [V11[def.id][0], V11[def.id][1]];
      if (from && !sameRange(from, now)) {
        convertExercise(rec, def.id, from, now);
        report.push({ id: def.id, from: from, to: now });
      }
      rec.scales[def.id] = now;
    });
    return report;
  }

  E.rebase = { V11: V11, run: run, conv: conv, register: register, sameRange: sameRange, _: { pathConvert: pathConvert } };

  // The store runs it after every guard (load, import, another tab's record): js/core/store.js upgrade().
  var S = PX.core && PX.core.store;
  if (S && typeof S.upgrade === 'function') S.upgrade(function (rec, fromVersion) { run(rec, fromVersion); });
})(window.PX);
