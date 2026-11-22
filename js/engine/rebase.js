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

   Which build wrote a stamp (RV-code-1.2 L5): rec.scalev = { id: [definition version, PX.version] }.
   Conversions only go forward: a stamp written by a newer definition of the exercise, or by a newer
   build at the same definition version, is never converted, and its levels and stamp are left as they
   are. Two builds of one record format open at once (an old tab and the updated Pages copy) would
   otherwise convert each other's levels back and forth, each round trip losing a level to rounding now
   and then and restarting Path's moving average. The older build shows such levels on its own scale
   until it is closed, and a level it writes meanwhile is read on the newer scale (off by at most the
   two ranges' difference, once). A stamp without a writer (older 1.2 test builds) converts as before.
   So the pass is idempotent however often two builds exchange the record. A range change comes with a
   definition-version bump (every 1.2 change did); within one definition version the build's PX.version
   orders them, and two builds with equal versions and different ranges convert as before.

     V11                        { id: [min, max, version] } of Parallax 1.1 (computed at 196b942)
     run(rec, fromVersion)      converts and stamps; → [{ id, from: [min, max], to: [min, max] }]
     conv(from, to)             → function (level) → the level on `to` (rounded, 1–100)
     register(fn)               fn(rec, id, conv, from, to): converts other stored levels (later
                                waves: grades, Reach, the Atlas)
     sameRange(a, b)            true within 1e-3 logits at both ends
     newer(a, b)                writer a ([version, PX.version]) is newer than writer b
     cmpApp(a, b)               −1, 0 or 1: PX.version strings in semver order (a test build before its
                                release); 0 when either does not parse
     align(theirs, mine)        → [theirs, mine] with every exercise on the newer writer's range (copies
                                where converted); E.merge runs it first (wrapped below, register kept)
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

  /* ---------- which build wrote a stamp (RV-code-1.2 L5) ---------- */

  // PX.version strings ('1.2.0', '1.2.0-test.4') in semver order; 0 when either does not parse.
  function cmpApp(a, b) {
    var re = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/, x = re.exec(String(a)), y = re.exec(String(b));
    if (!x || !y) return 0;
    for (var i = 1; i <= 3; i++) if (+x[i] !== +y[i]) return +x[i] < +y[i] ? -1 : 1;
    if (x[4] === y[4]) return 0;
    if (x[4] === undefined) return 1;  // a release is newer than its test builds
    if (y[4] === undefined) return -1;
    var p = x[4].split('.'), q = y[4].split('.');
    for (var j = 0; j < Math.max(p.length, q.length); j++) {
      if (p[j] === undefined) return -1;
      if (q[j] === undefined) return 1;
      var pn = /^\d+$/.test(p[j]), qn = /^\d+$/.test(q[j]);
      if (pn && qn) { if (+p[j] !== +q[j]) return +p[j] < +q[j] ? -1 : 1; } else if (p[j] !== q[j]) return pn ? -1 : qn ? 1 : p[j] < q[j] ? -1 : 1;
    }
    return 0;
  }
  function isWriter(w) { return isArray(w) && w.length === 2 && Number.isInteger(w[0]) && w[0] >= 1 && typeof w[1] === 'string'; }
  function newer(a, b) {
    if (!isWriter(a) || !isWriter(b)) return false;
    return a[0] !== b[0] ? a[0] > b[0] : cmpApp(a[1], b[1]) > 0;
  }
  function writerOf(def) { return [Number.isInteger(def.version) && def.version >= 1 ? def.version : 1, String(PX.version || '')]; }

  // rec.scalev: { id: [definition version, PX.version] } (backups carry it, as they carry the stamps).
  if (typeof E.field === 'function') {
    E.field('scalev', function () { return {}; }, function (v) {
      return E.fix.map(v, function (w) {
        return isArray(w) && w.length === 2 && Number.isInteger(w[0]) && w[0] >= 1 && w[0] <= 1e6 && typeof w[1] === 'string' && w[1].length <= 40 ? [w[0], w[1]] : undefined;
      }, E.fix.idKey);
    });
  }

  function run(rec, fromVersion) {
    var report = [];
    if (!isObj(rec)) return report;
    if (!isObj(rec.scales)) rec.scales = {};
    // the writers live in rec.scalev, a registered field (the app registers every engine field); a record without
    // it (a store that did not register it) is stamped as before, without writers
    var sv = isObj(rec.scalev) ? rec.scalev : null;
    var old = isNum(fromVersion) && fromVersion < 3;
    PX.ex.list().forEach(function (def) {
      var r = M.range(def), now = [r4(r.min), r4(r.max)], st = rec.scales[def.id], me = writerOf(def);
      var from = isArray(st) && st.length >= 2 && isNum(st[0]) && isNum(st[1]) ? [st[0], st[1]] : null;
      var by = from && sv && isWriter(sv[def.id]) ? sv[def.id] : null;
      if (!from && old && hasOwn.call(V11, def.id)) { from = [V11[def.id][0], V11[def.id][1]]; by = [V11[def.id][2], '1.1.0']; }
      if (from && by && newer(by, me)) return; // a newer build's levels: left as they are, stamp and all
      if (from && !sameRange(from, now)) {
        convertExercise(rec, def.id, from, now);
        report.push({ id: def.id, from: from, to: now });
      }
      rec.scales[def.id] = now;
      if (sv) sv[def.id] = me;
    });
    return report;
  }

  /* Two-tab merges (the store's conflict → E.merge). Merge takes plain fields such as the stamps from the newer
     side and each exercise's levels from the side with more answers, so two sides stamped on different ranges
     would pair one side's levels with the other's stamp (and the newer build would then convert its own levels a
     second time). align() first brings, for every exercise the two sides stamped on different ranges, a copy of
     the side with the older writer forward to the newer writer's range (the inputs are not changed); equal
     writers have no order, and both sides were already guarded onto this build's range. */
  function stampOf(rec, id) {
    var s = isObj(rec) && isObj(rec.scales) ? rec.scales[id] : null;
    if (!(isArray(s) && s.length >= 2 && isNum(s[0]) && isNum(s[1]))) return null;
    var w = isObj(rec.scalev) && isWriter(rec.scalev[id]) ? rec.scalev[id] : null;
    return { range: [s[0], s[1]], by: w };
  }
  function align(theirs, mine) {
    var t = theirs, m = mine, tCopy = false, mCopy = false, ids = {};
    [t, m].forEach(function (r) { if (isObj(r) && isObj(r.scales)) Object.keys(r.scales).forEach(function (k) { ids[k] = 1; }); });
    Object.keys(ids).forEach(function (id) {
      var ts = stampOf(t, id), ms = stampOf(m, id);
      if (!ts || !ms || !ts.by || !ms.by || sameRange(ts.range, ms.range)) return;
      if (newer(ts.by, ms.by)) {
        if (!mCopy) { m = U.deepCopy(m); mCopy = true; }
        forward(m, id, ms.range, ts.range, ts.by);
      } else if (newer(ms.by, ts.by)) {
        if (!tCopy) { t = U.deepCopy(t); tCopy = true; }
        forward(t, id, ts.range, ms.range, ms.by);
      }
    });
    return [t, m];
  }
  function forward(rec, id, from, to, by) {
    convertExercise(rec, id, from, to);
    if (!isObj(rec.scalev)) rec.scalev = {};
    rec.scales[id] = to.slice();
    rec.scalev[id] = by.slice();
  }
  if (typeof E.merge === 'function' && !E.merge.aligned) {
    var plainMerge = E.merge;
    var alignedMerge = function (theirs, mine) { var p = align(theirs, mine); return plainMerge(p[0], p[1]); };
    alignedMerge.register = plainMerge.register; // the fields' own merges stay merge.js's
    alignedMerge.registered = plainMerge.registered;
    alignedMerge.plain = plainMerge;
    alignedMerge.aligned = true;
    E.merge = alignedMerge;
  }

  E.rebase = { V11: V11, run: run, conv: conv, register: register, sameRange: sameRange, newer: newer, cmpApp: cmpApp, align: align, _: { pathConvert: pathConvert } };

  // The store runs it after every guard (load, import, another tab's record): js/core/store.js upgrade().
  var S = PX.core && PX.core.store;
  if (S && typeof S.upgrade === 'function') S.upgrade(function (rec, fromVersion) { run(rec, fromVersion); });
})(window.PX);
