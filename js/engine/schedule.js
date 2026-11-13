/* PX.engine.schedule: the Train session builder (PLAN §5, C §6 and §9d).
   - Review intervals: an exercise is due 3, 7, 14, then 30 days after it was last practised;
     the interval grows only when the exercise was practised while due (rec.ex[id].rev).
   - Interleaving stages per exercise (rec.train.stage): S1 runs of 20 with one variant per run,
     S2 runs of 10 with variants mixed, S3 runs of 5, S4 runs of 2 alternating with a
     similar-looking exercise and no name banner, S5 random with about 70 % switches. Up one
     stage per session at ≥ 40 rated trials and σ ≤ 0.45; back one when the last 20 switch
     trials fall more than 0.10 below their predicted success. Stretch starts at S3.
   - Sessions: focus (pin, else an untried exercise while any is left, in the beginner order of
     config.session.beginner, else the highest learning progress), review (most overdue, else an
     untried one), variety (least practised; a similar-looking partner when the focus is at S4+
     and every exercise has been tried). roleOf maps each exercise to its role, 'new' for an
     untried one that is not pinned. Under the PAT focus (settings.patFocus) the DAT-style
     formats lead the beginner order (config.session.patOrder), and every session holds at least
     one of them when one can run (in the last unpinned slot). Shares follow a softmax of
     the bandit scores, clipped to 20–50 % of trials; the time budget becomes a trial count with
     per-exercise median trial times (defaults by answer type until 10 measured trials exist).

     train(rec)                      the rec.train container (style, variability, pins, stage, sw)
     due(rec, def, now) / practised(rec, def, now)
     stage(rec, exId, style) / stageUp(rec, def, style, opts) / switchNote(rec, exId, x, p, style)
     group(exId) / similar(a, b)
     trialTimes(rec) → { exId: { med, extra, n } }  / trialMs(rec, def, times, params) / typical(...)
     beginOrder(rec) → the beginner order in force (the PAT focus puts patOrder first)
     choose(rec, opts, now) → { exs, roles (role → id), roleOf (id → role or 'new'), info, patPick
                               (the DAT-style format the PAT focus put in, or null) }
     build(rec, opts, now) → the Train part of a plan: exs, roles, quota, total, stage, ...
     nextRun(plan) → sets plan.run { exId, left, len, variant, stage, banner } */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;
  var C = E.config;
  var M = E.model;
  var DAY = E.DAY;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  function train(rec) {
    var t = rec.train;
    if (!isObj(t)) t = rec.train = {};
    if (typeof t.style !== 'string' || !hasOwn.call(C.styles, t.style)) t.style = C.style;
    if (t.variability !== 'low') t.variability = 'high';
    if (!isArray(t.pins)) t.pins = [];
    if (!isObj(t.stage)) t.stage = {};
    if (!isObj(t.sw)) t.sw = {};
    return t;
  }

  // Untimed practice of an exercise over its display slots.
  function totals(rec, def) {
    var e = rec.ex && rec.ex[def.id];
    if (!isObj(e)) return { n: 0, last: null };
    var n = isNum(e.n) ? e.n : 0, last = isNum(e.last) ? e.last : null;
    if (isObj(e.small)) {
      if (isNum(e.small.n)) n += e.small.n;
      if (isNum(e.small.last) && (last === null || e.small.last > last)) last = e.small.last;
    }
    return { n: n, last: last };
  }

  /* ---------- review ---------- */

  function due(rec, def, now) {
    var tt = totals(rec, def);
    if (!(tt.n > 0)) return { due: false, overdue: 0, next: null };
    var e = rec.ex[def.id], rv = e.rev;
    var next = isObj(rv) && isNum(rv.next) ? rv.next : (tt.last !== null ? tt.last : now) + C.session.review[0] * DAY;
    return { due: now >= next, overdue: Math.max(0, (now - next) / DAY), next: next };
  }

  function practised(rec, def, now) {
    var e = E.est.exEntry(rec, def.id), R = C.session.review, rv = e.rev, iv;
    if (!isObj(rv) || !isNum(rv.iv)) iv = 0;
    else {
      iv = U.clamp(Math.round(rv.iv), 0, R.length - 1);
      if (isNum(rv.next) && now >= rv.next) iv = Math.min(iv + 1, R.length - 1);
    }
    e.rev = { iv: iv, next: now + R[iv] * DAY };
    return e.rev;
  }

  /* ---------- stages ---------- */

  function stage(rec, exId, style) {
    var t = train(rec), s = t.stage[exId];
    s = isNum(s) ? U.clamp(Math.round(s), 1, 5) : 1;
    if ((style || t.style) === 'stretch') s = Math.max(s, C.stages.stretchStart);
    return s;
  }

  // Session end: one stage up when the rating is settled enough.
  function stageUp(rec, def, style, opts) {
    var S = C.stages, s = stage(rec, def.id, style), st = E.est.get(rec, def, opts);
    if (s < 5 && st.n >= S.upTrials && st.sd <= S.upSd) {
      train(rec).stage[def.id] = s + 1;
      return s + 1;
    }
    return 0;
  }

  // A trial that followed a different exercise. Returns true when the stage stepped back.
  function switchNote(rec, exId, x, p, style) {
    var S = C.stages, t = train(rec), w = t.sw[exId];
    if (!isArray(w)) w = t.sw[exId] = [];
    w.push([x ? 1 : 0, Math.round(U.clamp(p, 0, 1) * 1000)]);
    if (w.length > S.switchWindow) w.splice(0, w.length - S.switchWindow);
    if (w.length < S.switchWindow) return false;
    var mx = 0, mp = 0;
    for (var i = 0; i < w.length; i++) { mx += w[i][0]; mp += w[i][1] / 1000; }
    mx /= w.length; mp /= w.length;
    if (mx >= mp - S.switchDrop) return false;
    var s = stage(rec, exId, style);
    t.sw[exId] = [];
    if (s <= 1) return false;
    t.stage[exId] = s - 1;
    return true;
  }

  // Every exercise that shares a similarity group with exId (groups may overlap), exId first;
  // null when it is in none.
  function group(exId) {
    var G = C.stages.groups, out = null;
    for (var i = 0; i < G.length; i++) {
      if (G[i].indexOf(exId) < 0) continue;
      if (!out) out = [exId];
      G[i].forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
    }
    return out;
  }
  function similar(a, b) {
    if (!a || !b || a === b) return false;
    var g = group(a);
    return !!g && g.indexOf(b) >= 0;
  }

  /* ---------- automatic choices (CONTRACT-v1.1 H5) ---------- */

  // PAT-format exercises join automatic choices (Train, Today's plan, the beginner order, Path
  // without a chosen exercise) only with the PAT focus on; exercises paused before a test
  // (settings.testPause: { ids, until: 'YYYY-MM-DD' }) stay out of them through that local day.
  // Explicit picks (Library, Free play, a chosen Path, Section, pins) are never filtered.
  function patFocus(rec) { return !!(rec && isObj(rec.settings) && rec.settings.patFocus === true); }
  function testPaused(rec, exId, now) {
    var tp = rec && isObj(rec.settings) ? rec.settings.testPause : null;
    if (!isObj(tp) || !isArray(tp.ids) || typeof tp.until !== 'string' || !isNum(now)) return false;
    return E.day(now) <= tp.until && tp.ids.indexOf(exId) >= 0;
  }
  function auto(rec, def, now) {
    return !!def && (def.pat !== true || patFocus(rec)) && !testPaused(rec, def.id, now);
  }

  /* ---------- trial times ---------- */

  // The expected time from first paint to the answer: the exercise's own estimate when it has
  // one (def.estMs(params), for durations that depend on the settings: Track's tracking time,
  // Span's sequence length, Homing's route), or null.
  function estOf(def, params) {
    if (typeof def.estMs !== 'function' || !params) return null;
    var v;
    try { v = def.estMs(params); } catch (e) { v = null; }
    return isNum(v) && v > 0 ? v : null;
  }

  // Measured wall time between consecutive answers (gaps over 90 s are breaks), attributed to
  // the later trial: per exercise { med, extra, n } over its last 50 timed trials, where extra is
  // the median time beyond def.estMs (feedback, transitions, your own pace). Only exercises with
  // 10 or more timed trials are listed.
  function trialTimes(rec) {
    var rows = isArray(rec.trials) ? rec.trials : [], names = E.log.names(rec);
    var per = {}, ext = {}, maxS = C.session.maxGapMs / 1000, out = {};
    for (var i = rows.length - 1; i > 0 && i > rows.length - 4000; i--) {
      var r = rows[i], q = rows[i - 1];
      if (!isArray(r) || !isArray(q)) continue;
      var dt = r[0] - q[0];
      if (!(dt > 0 && dt <= maxS)) continue;
      var id = names.ex[r[1]];
      if (!id) continue;
      var a = per[id] || (per[id] = []);
      if (a.length >= 50) continue;
      a.push(dt * 1000);
      var def = PX.ex.get(id), p = def && typeof def.estMs === 'function' ? E.log.rowParams(def, r, names.ver[r[1]]) : null;
      var est = p ? estOf(def, p) : null;
      if (est !== null) (ext[id] || (ext[id] = [])).push(dt * 1000 - est);
    }
    for (var k in per) {
      if (!hasOwn.call(per, k) || per[k].length < 10) continue;
      out[k] = { med: U.median(per[k]), extra: ext[k] && ext[k].length >= 10 ? U.median(ext[k]) : null, n: per[k].length };
    }
    return out;
  }

  // Expected wall time of one trial at params (an item the session would show now):
  // estMs(params) + the measured extra (2.5 s until 10 trials are timed); without estMs, the
  // user's own median trial time, or the default for the answer type.
  function trialMs(rec, def, times, params) {
    var t = times && times[def.id], est = estOf(def, params);
    if (est !== null) return Math.max(1000, est + (t && isNum(t.extra) ? t.extra : C.session.overheadMs));
    if (t && isNum(t.med) && t.med > 0) return t.med;
    var d = C.session.trialMs, ans = M.answerOf(def, params);
    return hasOwn.call(d, ans) ? d[ans] : 9000;
  }

  // The item a session would choose now (for time estimates; changes nothing).
  function typical(rec, def, opts, now, k) {
    var r = E.select.pick(def, E.est.get(rec, def, opts, now), { kind: 'target', k: isNum(k) ? k : M.styleK(train(rec).style) });
    return r ? r.params : null;
  }

  /* ---------- choosing the exercises ---------- */

  function trainable(rec, opts, now) {
    var pins = (opts.pin ? [String(opts.pin)] : []).concat(isObj(rec.train) && isArray(rec.train.pins) ? rec.train.pins : []);
    var defs = PX.ex.list('train').filter(function (d) {
      return (!opts.can || opts.can(d)) && (pins.indexOf(d.id) >= 0 || auto(rec, d, now));
    });
    if (E.lab && E.lab.allowed) {
      var ok = E.lab.allowed(rec, now);
      if (ok) {
        var inLab = defs.filter(function (d) { return ok.indexOf(d.id) >= 0; });
        if (inLab.length) defs = inLab;
      }
    }
    return defs;
  }

  function codeCmp(a, b) { return a.def.code < b.def.code ? -1 : a.def.code > b.def.code ? 1 : 0; }
  // The beginner order (config.session.beginner). Under the PAT focus the DAT-style formats lead
  // it in the test's order (config.session.patOrder); turned off, the usual order is back.
  function beginOrder(rec) {
    var b = C.session.beginner || [], p = C.session.patOrder || [];
    if (!patFocus(rec)) return b.slice();
    return p.concat(b.filter(function (id) { return p.indexOf(id) < 0; }));
  }
  // Comparators over one beginner order: untried exercises in that order, others after it by
  // code (newCmp); least practised first, ties among untried ones in that order (leastCmp).
  function orderCmps(order) {
    function rank(x) { var i = order.indexOf(x.def.id); return i < 0 ? 1e3 : i; }
    function newCmp(a, b) { return rank(a) - rank(b) || codeCmp(a, b); }
    function leastCmp(a, b) { return a.n - b.n || (a.n === 0 && b.n === 0 ? newCmp(a, b) : (a.last - b.last) || codeCmp(a, b)); }
    return { newCmp: newCmp, leastCmp: leastCmp };
  }

  function choose(rec, opts, now) {
    opts = opts || {};
    var t = train(rec), style = opts.style || t.style;
    var cmp = orderCmps(beginOrder(rec)), newCmp = cmp.newCmp, leastCmp = cmp.leastCmp;
    var defs = trainable(rec, opts, now);
    var info = defs.map(function (d) {
      var tt = totals(rec, d);
      return {
        def: d, lp: E.bandit.lp(rec, d, opts).lp, score: E.bandit.score(rec, d, now, opts),
        due: due(rec, d, now), n: tt.n, last: tt.last === null ? -Infinity : tt.last, stage: stage(rec, d.id, style),
      };
    });
    var exs = [], roles = {}, used = {}, roleOf = {}, pinned = {};
    function take(x, role) {
      if (!x) return;
      roles[role] = x.def.id; used[x.def.id] = true; exs.push(x.def.id);
      roleOf[x.def.id] = x.n === 0 && !pinned[x.def.id] ? 'new' : role; // untried: 'new', whatever the slot
    }
    function rest() { return info.filter(function (x) { return !used[x.def.id]; }); }
    var want = Math.min(isNum(opts.count) ? Math.max(1, opts.count) : C.session.exercises, info.length);
    if (!want) return { exs: exs, roles: roles, roleOf: roleOf, info: info };
    var pins = (opts.pin ? [opts.pin] : []).concat(t.pins);
    pins.forEach(function (id) { pinned[id] = true; });
    var focus = null;
    for (var i = 0; i < pins.length && !focus; i++) {
      focus = info.filter(function (x) { return x.def.id === pins[i]; })[0] || null;
    }
    if (!focus) {
      // Until every exercise has been tried, the focus goes to an untried one in the beginner
      // order (with the variety slot, two new exercises a session); then to the highest
      // learning progress.
      var untried = info.filter(function (x) { return x.n === 0; });
      focus = untried.length ? untried.slice().sort(newCmp)[0] :
        info.slice().sort(function (a, b) { return b.lp - a.lp || a.last - b.last || codeCmp(a, b); })[0];
    }
    take(focus, 'focus');
    if (exs.length < want) {
      var r = rest(), dueL = r.filter(function (x) { return x.due.due; }), newL = r.filter(function (x) { return x.n === 0; });
      var rv = dueL.sort(function (a, b) { return b.due.overdue - a.due.overdue || codeCmp(a, b); })[0] ||
        newL.sort(newCmp)[0] || r.sort(function (a, b) { return b.score - a.score || a.last - b.last || codeCmp(a, b); })[0];
      take(rv, 'review');
    }
    if (exs.length < want) {
      var pool = rest(), g = group(focus.def.id);
      // At S4 the variety slot goes to a similar-looking partner, unless an exercise has never
      // been tried: new exercises come first, so none is starved.
      if (g && focus.stage >= 4 && !pool.some(function (x) { return x.n === 0; })) {
        var partners = pool.filter(function (x) { return g.indexOf(x.def.id) >= 0; });
        if (partners.length) pool = partners;
      }
      take(pool.sort(leastCmp)[0], 'variety');
    }
    while (exs.length < want) take(rest().sort(leastCmp)[0], 'extra');
    // Under the PAT focus a session holds at least one DAT-style format whenever one can run: if
    // none was chosen, the last slot that is not pinned goes to the format most overdue for
    // review, else the least practised one (untried ones in the test's order). Pins stay.
    var patPick = null;
    if (patFocus(rec) && !exs.some(function (id) { return isPat(id); })) {
      var pats = rest().filter(function (x) { return x.def.pat === true; });
      var j = exs.length - 1;
      while (j >= 0 && pinned[exs[j]]) j--;
      if (pats.length && j >= 0) {
        var px = pats.filter(function (x) { return x.due.due; }).sort(function (a, b) { return b.due.overdue - a.due.overdue || codeCmp(a, b); })[0] ||
          pats.sort(leastCmp)[0];
        var old = exs[j], role = roleOf[old] === 'new' ? null : roleOf[old];
        for (var rk in roles) if (hasOwn.call(roles, rk) && roles[rk] === old) role = rk;
        delete used[old]; delete roleOf[old];
        exs[j] = px.def.id; used[px.def.id] = true;
        if (role) roles[role] = px.def.id;
        roleOf[px.def.id] = px.n === 0 && !pinned[px.def.id] ? 'new' : role || 'extra';
        patPick = px.def.id;
      }
    }
    return { exs: exs, roles: roles, roleOf: roleOf, info: info, patPick: patPick };
  }
  function isPat(id) { var d = PX.ex.get(id); return !!d && d.pat === true; }

  // Largest-remainder rounding of shares × total.
  function quotas(ids, sh, total) {
    var raw = sh.map(function (s) { return s * total; });
    var q = raw.map(Math.floor), left = total - U.sum(q);
    var order = raw.map(function (x, i) { return [x - Math.floor(x), i]; }).sort(function (a, b) { return b[0] - a[0] || a[1] - b[1]; });
    for (var i = 0; i < left; i++) q[order[i % order.length][1]]++;
    var out = {};
    ids.forEach(function (id, j) { out[id] = q[j]; });
    return out;
  }

  function build(rec, opts, now) {
    opts = opts || {};
    var t = train(rec), style = opts.style || t.style;
    var ch = choose(rec, opts, now);
    var budgetMs = Math.max(60000, (isNum(opts.minutes) ? opts.minutes : C.session.minutes) * 60000);
    var out = { exs: ch.exs, roles: ch.roles, roleOf: ch.roleOf, patPick: ch.patPick || null, quota: {}, total: 0, stage: {}, budgetMs: budgetMs, msPer: {} };
    if (!ch.exs.length) return out;
    var byId = {};
    ch.info.forEach(function (x) { byId[x.def.id] = x; });
    var sh = E.bandit.shares(E.bandit.softmax(ch.exs.map(function (id) { return byId[id].score; })), C.session.minShare, C.session.maxShare);
    var times = trialTimes(rec), per = 0, k = M.styleK(style);
    ch.exs.forEach(function (id, i) {
      out.msPer[id] = trialMs(rec, byId[id].def, times, typical(rec, byId[id].def, opts, now, k));
      per += sh[i] * out.msPer[id];
      out.stage[id] = byId[id].stage;
    });
    out.total = Math.max(C.session.minTrials, Math.round(budgetMs / per));
    out.quota = quotas(ch.exs, sh, out.total);
    out.shares = {};
    ch.exs.forEach(function (id, i) { out.shares[id] = sh[i]; });
    return out;
  }

  function runLength(s, rng) {
    var R = C.stages.run;
    if (s <= 4) return R[s - 1];
    var n = 1;
    while (n < 6 && rng.chance(C.stages.stay5)) n++;
    return n;
  }

  function lruVariant(rec, def) {
    if (!def.variants) return undefined;
    var e = rec.ex && rec.ex[def.id], lru = e && isObj(e.lru) ? e.lru : {};
    var best = def.variants[0], at = Infinity;
    def.variants.forEach(function (v) {
      var a = isNum(lru['variant=' + v]) ? lru['variant=' + v] : -1;
      if (a < at) { at = a; best = v; }
    });
    return best;
  }

  // The next run of a Train plan; plan: { exs, quota, count, stage, run, rng, rec, lead? }.
  function nextRun(plan, rec) {
    var exs = plan.exs, prev = plan.run ? plan.run.exId : null;
    var rem = exs.map(function (id) { return (plan.quota[id] || 0) - (plan.count[id] || 0); });
    var open = rem.filter(function (x) { return x > 0; }).length;
    var w = rem.map(function (x) { return x > 0 ? x : 0; });
    if (!open) { w = exs.map(function () { return 1; }); open = exs.length; } // replacements for voided trials
    if (prev !== null && open > 1) w[exs.indexOf(prev)] = 0;
    if (prev !== null && plan.stage[prev] >= 4) {
      // S4+: alternate with a similar-looking partner; other exercises keep a quarter weight so
      // they are interleaved too instead of waiting for the end of the session.
      var hasPartner = w.some(function (x, i) { return x > 0 && similar(prev, exs[i]) && plan.stage[exs[i]] >= 4; });
      if (hasPartner) w = w.map(function (x, i) { return similar(prev, exs[i]) && plan.stage[exs[i]] >= 4 ? x : 0.25 * x; });
    }
    if (!(U.sum(w) > 0)) w = exs.map(function () { return 1; });
    // A session pinned to an exercise (plan.lead, from "Train this exercise") opens with it: the
    // warm-ups and then its first block, which the warm-ups do not shorten.
    var lead = plan.lead && exs.indexOf(plan.lead) >= 0 ? exs.indexOf(plan.lead) : -1;
    plan.lead = null;
    var i = lead >= 0 ? lead : E.bandit.choose(plan.rng, w, C.session.explore);
    var id = exs[i], s = plan.stage[id] || 1;
    var len = runLength(s, plan.rng) + (lead >= 0 ? C.session.warmup : 0);
    if (rem[i] > 0) len = Math.min(len, rem[i]);
    var def = PX.ex.get(id);
    var banner = prev !== id && !(similar(prev, id) && s >= 4 && (plan.stage[prev] || 1) >= 4);
    plan.run = { exId: id, left: Math.max(1, len), len: Math.max(1, len), variant: s === 1 ? lruVariant(rec, def) : undefined, stage: s, banner: banner, fresh: true };
    return plan.run;
  }

  E.schedule = {
    train: train, totals: totals, due: due, practised: practised, stage: stage, stageUp: stageUp,
    switchNote: switchNote, group: group, similar: similar, trialTimes: trialTimes, trialMs: trialMs, typical: typical, estOf: estOf,
    auto: auto, patFocus: patFocus, testPaused: testPaused, beginOrder: beginOrder,
    trainable: trainable, choose: choose, build: build, nextRun: nextRun, runLength: runLength, quotas: quotas,
  };

  E.field('train', function () { return { style: C.style, variability: 'high', pins: [], stage: {}, sw: {} }; }, function (v) {
    if (!isObj(v)) return undefined;
    var F = E.fix;
    return {
      style: typeof v.style === 'string' && hasOwn.call(C.styles, v.style) ? v.style : C.style,
      variability: v.variability === 'low' ? 'low' : 'high',
      pins: (F.list(v.pins, F.id, 3) || []),
      stage: F.map(v.stage, function (x) { return F.int(x, 1, 5); }, F.idKey) || {},
      sw: F.map(v.sw, function (w) {
        return F.list(w, function (r) { return isArray(r) && (r[0] === 0 || r[0] === 1) && F.int(r[1], 0, 1000) !== undefined ? [r[0], F.int(r[1], 0, 1000)] : undefined; }, 20);
      }, F.idKey) || {},
    };
  });
})(window.PX);
