/* PX.engine.merge(theirs, mine) → record: two-tab merge (ARCHITECTURE §8).
   Unions: trials (one trial is one row: second, exercise, mode, settings, seed, outcome and
   response time; two tabs draw seeds from their own copies of the counter, so the same seed can
   belong to two trials, even in the same second), sessions (by id), achievements (earliest date),
   daily results, Spatial Checks (by date), Threshold results (by date), strategy check-ins.
   Each exercise rating (and timed rating, Path progress) comes from the side with more
   trials. Settings, preferences and other plain fields come from the newer side (`updated`).
   Trial rows point into idx name lists, which the two tabs may have extended differently, so
   rows from `mine` are re-indexed into the merged lists. The seed counter takes the larger
   value so new seeds stay unique. Inputs are not changed. The store calls it when a save
   meets a newer record: app.js sets store.merge = PX.engine.merge at boot (the engine itself
   never touches the store). */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }
  function arr(x) { return isArray(x) ? x : []; }
  function obj(x) { return isObj(x) ? x : {}; }
  function cp(x) { return U.deepCopy(x); }

  function nOf(e) {
    if (!isObj(e)) return -1;
    return (isNum(e.n) ? e.n : 0) + (isObj(e.small) && isNum(e.small.n) ? e.small.n : 0);
  }

  function byMore(a, b, size) {
    var out = {}, keys = {};
    Object.keys(obj(a)).concat(Object.keys(obj(b))).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      var x = obj(a)[k], y = obj(b)[k];
      out[k] = cp(size(y) > size(x) ? y : x !== undefined ? x : y);
    });
    return out;
  }

  function union(a, b, keyOf) {
    var seen = {}, out = [];
    arr(a).concat(arr(b)).forEach(function (x) {
      var k = keyOf(x);
      if (k === null || hasOwn.call(seen, k)) return;
      seen[k] = 1;
      out.push(cp(x));
    });
    return out;
  }

  function pathSize(p) {
    if (!isObj(p)) return -1;
    return (isObj(p.passed) ? Object.keys(p.passed).length : 0) * 1e6 + (isNum(p.stage) ? p.stage : 0) * 1e3 + (isNum(p.items) ? p.items : 0);
  }

  function merge(theirs, mine) {
    theirs = obj(theirs); mine = obj(mine);
    var tu = isNum(theirs.updated) ? theirs.updated : 0, mu = isNum(mine.updated) ? mine.updated : 0;
    var newer = mu > tu ? mine : theirs, older = newer === mine ? theirs : mine;
    var out = cp(newer);
    Object.keys(older).forEach(function (k) { if (!hasOwn.call(out, k)) out[k] = cp(older[k]); });

    out.rev = Math.max(isNum(theirs.rev) ? theirs.rev : 0, isNum(mine.rev) ? mine.rev : 0);
    if (isNum(theirs.created) || isNum(mine.created)) {
      out.created = Math.min(isNum(theirs.created) ? theirs.created : Infinity, isNum(mine.created) ? mine.created : Infinity);
    }
    out.updated = Math.max(tu, mu);

    // idx: theirs first (their rows keep their indexes), then names only mine has.
    var ti = obj(theirs.idx), mi = obj(mine.idx);
    var exL = arr(ti.ex).slice(), moL = arr(ti.mode).slice();
    function mapper(src, dst) {
      return arr(src).map(function (name) {
        if (typeof name !== 'string') return -1;
        var i = dst.indexOf(name);
        return i >= 0 ? i : dst.push(name) - 1;
      });
    }
    var mapEx = mapper(mi.ex, exL), mapMo = mapper(mi.mode, moL);
    out.idx = { ex: exL, mode: moL };
    function rowKey(r) {
      return isArray(r) ? [r[0], exL[r[1]] || '#' + r[1], moL[r[2]] || '#' + r[2], r[3], r[4], r[5], isNum(r[6]) ? r[6] : ''].join('|') : null;
    }
    var rows = [], seen = {};
    arr(theirs.trials).forEach(function (r) {
      var k = rowKey(r);
      if (k === null || seen[k]) return;
      seen[k] = 1;
      rows.push(r.slice());
    });
    arr(mine.trials).forEach(function (r) {
      if (!isArray(r)) return;
      var x = r.slice();
      if (mapEx[r[1]] !== undefined && mapEx[r[1]] >= 0) x[1] = mapEx[r[1]];
      if (mapMo[r[2]] !== undefined && mapMo[r[2]] >= 0) x[2] = mapMo[r[2]];
      var k = rowKey(x);
      if (seen[k]) return;
      seen[k] = 1;
      rows.push(x);
    });
    rows.sort(function (a, b) { return a[0] - b[0]; }); // stable: same-second rows keep their order
    out.trials = rows;

    out.sessions = union(theirs.sessions, mine.sessions, function (s) { return isObj(s) && typeof s.id === 'string' ? s.id : null; })
      .sort(function (a, b) { return (a.start || 0) - (b.start || 0); });
    var ach = cp(obj(theirs.achievements));
    Object.keys(obj(mine.achievements)).forEach(function (k) {
      var d = mine.achievements[k];
      if (!hasOwn.call(ach, k) || (typeof d === 'string' && d < ach[k])) ach[k] = d;
    });
    out.achievements = ach;
    out.daily = byMore(theirs.daily, mine.daily, function (x) { return isObj(x) ? (x.answered || x.n || 0) : -1; });
    out.assess = union(theirs.assess, mine.assess, function (a) { return isObj(a) ? String(a.date) + '|' + String(a.form) : null; })
      .sort(function (a, b) { return Date.parse(a.date) - Date.parse(b.date); });
    var mot = {}, tm = obj(theirs.mot), mm = obj(mine.mot);
    Object.keys(tm).concat(Object.keys(mm)).forEach(function (k) {
      if (mot[k]) return;
      mot[k] = union(tm[k], mm[k], function (x) { return isObj(x) ? String(x.date) + '|' + x.threshold : null; });
    });
    if (!mot.core) mot.core = [];
    out.mot = mot;
    out.strategies = union(theirs.strategies, mine.strategies, function (x) { return isObj(x) ? x.exId + '|' + x.t + '|' + x.strategy : null; })
      .sort(function (a, b) { return a.t - b.t; });

    out.ex = byMore(theirs.ex, mine.ex, nOf);
    out.timed = byMore(theirs.timed, mine.timed, nOf);
    out.path = byMore(theirs.path, mine.path, pathSize);
    out.trialDays = byMore(theirs.trialDays, mine.trialDays, function (d) { return isObj(d) ? d.n || 0 : -1; });

    var te = obj(theirs.eng), me = obj(mine.eng);
    out.eng = cp(obj(newer.eng));
    out.eng.seedN = Math.max(isNum(te.seedN) ? te.seedN : 0, isNum(me.seedN) ? me.seedN : 0);
    out.eng.salt = isNum(te.salt) ? te.salt : isNum(me.salt) ? me.salt : null;
    if (isObj(theirs.train) || isObj(mine.train)) {
      out.train = cp(obj(newer.train));
      var st = {};
      [obj(theirs.train).stage, obj(mine.train).stage].forEach(function (m) {
        Object.keys(obj(m)).forEach(function (k) { if (isNum(m[k]) && !(st[k] >= m[k])) st[k] = m[k]; });
      });
      out.train.stage = st;
    }
    var se = obj(theirs.spatial).expect || obj(mine.spatial).expect || null;
    if (isObj(theirs.spatial) || isObj(mine.spatial)) out.spatial = { expect: cp(se) };
    var tl = obj(theirs.lab), ml = obj(mine.lab);
    if (tl.order || ml.order) out.lab = cp(tl.order && (!ml.order || (tl.start || 0) <= (ml.start || 0)) ? tl : ml);
    out.practiceMs = Math.max(isNum(theirs.practiceMs) ? theirs.practiceMs : 0, isNum(mine.practiceMs) ? mine.practiceMs : 0);
    if (isObj(theirs.streak) || isObj(mine.streak)) {
      out.streak = cp(obj(newer.streak));
      out.streak.goals = union(obj(theirs.streak).goals, obj(mine.streak).goals, function (g) { return isArray(g) ? String(g[0]) : null; })
        .sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    }
    if (isObj(theirs.tour) || isObj(mine.tour)) {
      var seenT = cp(obj(obj(theirs.tour).seen));
      Object.keys(obj(obj(mine.tour).seen)).forEach(function (k) { seenT[k] = true; });
      out.tour = { done: !!(obj(theirs.tour).done || obj(mine.tour).done), seen: seenT };
    }
    return out;
  }

  E.merge = merge;
})(window.PX);
