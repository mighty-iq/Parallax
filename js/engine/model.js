/* PX.engine.model, PX.engine.config and what every engine file shares (ARCHITECTURE §7).
   Pure: no DOM, no storage, no timers, no Math.random (PX.rng only). Times are ms since 1970
   and are always passed in (`now`); nothing here reads the clock. docs/dev/ENGINE.md explains
   every formula and default, with sources.

   PX.engine.config              the defaults (one object, read live by every engine file)
   PX.engine.configure(patch)    deep-merges a patch into config (experiments, tests); 'reset' restores
   PX.engine.model:
     p(theta, b, g, lapse?, a?)  P(right) = g + (1 − g − lapse) · σ(a(θ − b)); lapse 0.03, a 1
     pExp(mu, sd, b, g, ...)     the same averaged over θ ~ N(mu, sd²) (probit approximation)
     bAt(theta, p, g, ...)       the difficulty answered right with probability p
     target(g, k)                g + (1 − g) · k   (k is success above chance, 0..1)
     styleK(style)               0.85 comfortable / 0.70 balanced / 0.55 stretch
     kindTarget(kind, k, g)      raw target of an item kind: target, easy (warmup, last), stretch
     pool(def)                   every params combination: { params, key, code, b, g, lv, v } (cached)
     range(def) → {min, max}     refChance(def): median guessing rate over the pool
     nearest(def, b, filter?)    the pool entry whose difficulty is closest to b
   PX.engine.fields()            engine-owned record fields: [{ key, def(), fix(value) }] for
                                 store.field(key, def, fix); registered by the engine files
   PX.engine.log                 reading trial rows: scan(rec, fn), COL, outcome(result), OUT
   PX.engine.day(ms) / days(a, b) local day key; fractional days between two times
   PX.engine.fix                 small repair helpers used by the field fixers */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;
  var DAY = 86400000;
  // Local references: hot loops then never look up globals (slow in Node's vm contexts).
  var mexp = Math.exp, msqrt = Math.sqrt, mmin = Math.min, mround = Math.round, mfloor = Math.floor, PI = Math.PI;
  function sig(x) {
    if (x >= 0) return 1 / (1 + mexp(-x));
    var e = mexp(x);
    return e / (1 + e);
  }

  /* ---------- defaults (ENGINE.md lists the source of each) ---------- */

  var DEFAULTS = {
    lapse: 0.03,                                   // PLAN §5: P = g + (1 − g − 0.03) σ(θ − b)
    styles: { comfortable: 0.85, balanced: 0.70, stretch: 0.55 }, // success above chance (C §1, §9b)
    style: 'balanced',
    levelRef: 0.75,                                // level = difficulty answered right at g + (1 − g)·0.75
    z: 1.96,                                       // 95 % ranges
    mix: { easy: 0.10, stretch: 0.10, easyUp: 0.10, easyCap: 0.95, stretchK: 0.50 },
    prior: { offset: 1.0, sd: 1.0 },               // μ0 = easiest item + 1.0 logit, σ0 = 1.0
    noise: { trial: 0.002, day: 0.01, maxVar: 1.0 }, // process noise (variance) per trial, per day; cap
    grid: { lo: -8, hi: 8, points: 121, width: 6 },  // moment matching on μ ± 6σ inside −8..+8
    // noRepeat: dimensions whose level never repeats on consecutive items while another level is
    // as close to the target (Spin, Rotate: a varied angle weakens a long-axis cue).
    select: { tol: 0.05, slack: 0.05, avoid: 3, variability: 'high', noRepeat: { spin: ['angle'], rotate: ['angle'] } },
    weak: { window: 30, minN: 15, gap: -0.10, share: 0.2 },
    stages: {
      run: [20, 10, 5, 2, 1],                      // S1..S5 run lengths (S5: 1 + stays)
      stay5: 0.3,                                  // S5: chance to stay (≈ 70 % switches)
      upTrials: 40, upSd: 0.45, upSessionTrials: 10,
      switchWindow: 20, switchDrop: 0.10, stretchStart: 3,
      groups: [['fold', 'nets', 'slice', 'views', 'hidden'], ['rotate', 'spin', 'orient']],
    },
    session: {
      minutes: 20, exercises: 3, warmup: 2, explore: 0.15, minShare: 0.20, maxShare: 0.50, minTrials: 10,
      extraShare: 0.25, checkinEvery: 14, checkinAfter: 10,
      // untried exercises come in this order (visuospatial first; Track and Homing last)
      beginner: ['rotate', 'fold', 'spin', 'nets', 'views', 'slice', 'orient', 'hidden', 'span', 'track', 'homing'],
      review: [3, 7, 14, 30], maxGapMs: 90000, maxFactor: 1.6, blockEvery: 10,
      trialMs: { choice: 9000, multi: 11000, yesno: 6000, angle: 10000, targets: 16000, sequence: 12000 }, overheadMs: 2500,
    },
    bandit: { window: 60, clip: 2, fresh: 1.5, snapEvery: 10, snapKeep: 13, temp: 1 },
    path: {
      stages: 10, decay: 0.85, start: 0.6, minItems: 10, gateK: 0.80, modelK: 0.80,
      recheckDays: [3, 7, 14, 30, 60, 90], holdK: 0.70, recheckItems: 5,
    },
    speed: {
      // fluentK: untimed success an item needs, above chance (g + (1 − g)·0.85); maxK caps the
      // deadline's target (style k, at most 0.70 above chance) so a deadline bites below it
      unlockTrials: 60, unlockSd: 0.45, startFactor: 1.5, step: 0.02, fluentK: 0.85, maxK: 0.70, refSessions: 3,
      perHalving: 1.0, defaultRtMs: 4000, minDeadline: 300, maxDeadline: 60000,
    },
    staircase: { harder: 0.025, harderHigh: 0.015, doubleUntil: 2, slope: 10, standard: { step: 0.05, trials: 20, last: 4 } },
    assess: {
      items: 16, k: 0.6, easyFirst: 2, easyK: 0.85, priorSd: 1.5, everyDays: 14, everySessions: 8, delayedDays: 28,
      b3Se: 2, retestShare: 0.5, noChange: 0.25,
      composite: ['cubematch', 'viewmatch', 'mechanisms', 'patterns'], control: 'wordlinks', optional: ['level'],
    },
    streak: { goal: 3, min: 2, max: 6, graceWeeks: 4, minTrials: 10, minMs: 300000 },
    daily: { items: 8, epoch: '2026-11-01', link: 'discord.gg/chmr' },
    lab: { A: ['rotate', 'spin', 'fold', 'nets', 'slice'], B: ['views', 'orient', 'span', 'hidden', 'track', 'homing'], weeks: 3 },
  };

  var config = U.deepCopy(DEFAULTS);

  function mergeInto(dst, src) {
    for (var k in src) {
      if (!hasOwn.call(src, k)) continue;
      if (U.isPlainObject(src[k]) && U.isPlainObject(dst[k])) mergeInto(dst[k], src[k]);
      else dst[k] = U.deepCopy(src[k]);
    }
    return dst;
  }

  // Changes config in place, so the references other engine files hold stay valid.
  function configure(patch) {
    if (patch === 'reset') {
      for (var k in config) if (hasOwn.call(config, k)) delete config[k];
      mergeInto(config, DEFAULTS);
    } else if (patch && typeof patch === 'object') mergeInto(config, patch);
    return config;
  }

  /* ---------- the item model ---------- */

  function num(x, d) { return typeof x === 'number' && isFin(x) ? x : d; }

  // Params are flat ({ dimKey: index, variant }), so a shallow copy is a full copy.
  function copyParams(p) {
    var o = {};
    for (var k in p) if (hasOwn.call(p, k)) o[k] = p[k];
    return o;
  }

  function p(theta, b, g, lapse, a) {
    g = num(g, 0);
    lapse = num(lapse, config.lapse);
    a = num(a, 1);
    return g + (1 - g - lapse) * sig(a * (theta - b));
  }

  // E[σ(a(θ − b))] for θ ~ N(mu, sd²) ≈ σ(a(mu − b) / √(1 + π a² sd² / 8)) (MacKay's probit trick).
  function pExp(mu, sd, b, g, lapse, a) {
    g = num(g, 0);
    lapse = num(lapse, config.lapse);
    a = num(a, 1);
    var k = 1 / msqrt(1 + PI * a * a * sd * sd / 8);
    return g + (1 - g - lapse) * sig(a * (mu - b) * k);
  }

  function bAt(theta, prob, g, lapse, a) {
    g = num(g, 0);
    lapse = num(lapse, config.lapse);
    a = num(a, 1);
    var q = U.clamp((prob - g) / (1 - g - lapse), 1e-6, 1 - 1e-6);
    return theta - U.logit(q) / a;
  }

  function target(g, k) { return g + (1 - g) * k; }

  // The answer type of an item: item.answer, else the variant's (def.answers), else def.answer.
  function answerOf(def, params, item) {
    if (item && typeof item.answer === 'string') return item.answer;
    var a = def && def.answers;
    if (a && params && typeof a[params.variant] === 'string') return a[params.variant];
    return def ? def.answer : null;
  }

  function styleK(style) {
    var s = config.styles;
    return hasOwn.call(s, style) ? s[style] : s[config.style];
  }

  // Raw success target for an item kind (PLAN §5): target p*; easy p* + 0.10 capped at
  // g + (1 − g)·0.95 (also warm-up and the last item); stretch g + (1 − g)·0.5.
  function kindTarget(kind, k, g) {
    var m = config.mix, ps = target(g, k);
    if (kind === 'easy' || kind === 'warmup' || kind === 'last') return mmin(ps + m.easyUp, target(g, m.easyCap));
    if (kind === 'stretch') return target(g, m.stretchK);
    return ps;
  }

  /* ---------- the params pool of an exercise ---------- */

  var pools = typeof Map === 'function' ? new Map() : null;
  var poolsById = Object.create(null);

  function pool(def) {
    var hit = pools ? pools.get(def) : poolsById[def.id];
    if (hit && hit.def === def) return hit.list;
    var list = PX.ex.enumerate(def).map(function (params) {
      var lv = def.dims.map(function (d) { return params[d.key]; });
      return {
        params: params,
        key: PX.ex.paramsKey(params),
        code: PX.ex.paramsCode(def, params),
        b: def.difficulty(params),
        g: def.chance(params),
        lv: lv,
        // dimension-level and variant tags for the variability memory (select.freshness)
        tags: def.dims.map(function (d) { return d.levels.length > 1 ? d.key + '=' + params[d.key] : null; }),
        vtag: def.variants && def.variants.length > 1 ? 'variant=' + params.variant : null,
        v: def.variants ? Math.max(0, def.variants.indexOf(params.variant === undefined ? def.variants[0] : params.variant)) : -1,
      };
    });
    list.forEach(function (c, i) { c.i = i; }); // position in the pool (select.pick's buffers)
    var med = U.median(list.map(function (c) { return c.g; }));
    var entry = { def: def, list: list, byKey: Object.create(null), refChance: isFin(med) ? med : 0, groups: [] };
    list.forEach(function (c) { entry.byKey[c.key] = c; });
    // Groups of equal guessing rate, sorted by difficulty (ties by code): window searches.
    var byG = {};
    list.forEach(function (c) {
      var k = String(c.g);
      (byG[k] || (byG[k] = { g: c.g, list: [] })).list.push(c);
    });
    Object.keys(byG).sort().forEach(function (k) {
      var grp = byG[k];
      grp.list.sort(function (a, b) { return a.b - b.b || a.code - b.code; });
      grp.bs = grp.list.map(function (c) { return c.b; });
      entry.groups.push(grp);
    });
    if (pools) pools.set(def, entry); else poolsById[def.id] = entry;
    return list;
  }
  function poolEntry(def) { pool(def); return pools ? pools.get(def) : poolsById[def.id]; }
  function byKey(def, key) { return poolEntry(def).byKey[key] || null; }
  function refChance(def) { return poolEntry(def).refChance; }
  function range(def) { return { min: PX.ex.minDifficulty(def), max: PX.ex.maxDifficulty(def) }; }

  // Closest difficulty to b; ties go to the lowest code (first variant, lowest levels).
  function nearest(def, b, filter) {
    var best = null, bd = Infinity, list = pool(def);
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (filter && !filter(c)) continue;
      var d = Math.abs(c.b - b);
      if (d < bd - 1e-12 || (Math.abs(d - bd) <= 1e-12 && best && c.code < best.code)) { best = c; bd = d; }
    }
    return best;
  }

  /* ---------- engine-owned record fields ---------- */

  var FIELDS = [];
  function field(key, def, fix) {
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === key) throw new Error('PX.engine field "' + key + '" is registered twice');
    FIELDS.push({ key: key, def: def, fix: fix });
  }
  // For app.js: PX.engine.fields().forEach(f => store.field(f.key, f.def, f.fix)).
  function fields() {
    return FIELDS.map(function (f) { return { key: f.key, def: f.def, fix: f.fix }; });
  }

  // Repair helpers for field fixers: each returns the repaired value or undefined.
  var fix = {
    num: function (v, lo, hi) {
      if (typeof v !== 'number' || !isFin(v)) return undefined;
      return U.clamp(v, lo === undefined ? -Infinity : lo, hi === undefined ? Infinity : hi);
    },
    int: function (v, lo, hi) {
      var n = fix.num(v, lo, hi);
      return n === undefined ? undefined : Math.round(n);
    },
    time: function (v) { return typeof v === 'number' && isFin(v) && v >= 0 && v < 8.64e15 ? v : undefined; },
    id: function (v) { return typeof v === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(v) ? v : undefined; },
    day: function (v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined; },
    // map: plain object whose keys pass keyOk and values pass fixVal (others dropped)
    map: function (v, fixVal, keyOk) {
      if (!U.isPlainObject(v)) return undefined;
      var out = {};
      for (var k in v) {
        if (!hasOwn.call(v, k) || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (keyOk && !keyOk(k)) continue;
        var r;
        try { r = fixVal(v[k], k); } catch (e) { r = undefined; }
        if (r !== undefined) out[k] = r;
      }
      return out;
    },
    list: function (v, fixItem, max) {
      if (!isArray(v)) return undefined;
      var out = [];
      for (var i = Math.max(0, v.length - (max || 100000)); i < v.length; i++) {
        var r;
        try { r = fixItem(v[i]); } catch (e) { r = undefined; }
        if (r !== undefined) out.push(r);
      }
      return out;
    },
    idKey: function (k) { return /^[a-z][a-z0-9-]{0,39}$/.test(k); },
  };

  /* ---------- trial rows ---------- */

  // [tSec, exIndex, modeIndex, paramsCode, seed, outcome, rtMs, value, pPredMilli, stage] (§8)
  var COL = { t: 0, ex: 1, mode: 2, code: 3, seed: 4, outcome: 5, rt: 6, value: 7, pp: 8, stage: 9 };
  var OUT = { wrong: 0, right: 1, stutter: 2, skipped: 3, voided: 2, timeout: 0 };

  // Outcome code from what the player reports: a code, { outcome } (a name in OUT), or
  // { correct, stutter, voided, timeout, skipped }. A stutter or a void wins over a timeout.
  function outcome(r) {
    if (typeof r === 'number') return r === 1 || r === 2 || r === 3 ? r : 0;
    if (!r || typeof r !== 'object') return 3;
    // An item built by an exercise's last-resort construction (item.fallback) is voided.
    if (r.fallback === true || (r.item && r.item.fallback === true)) return 2;
    if (typeof r.outcome === 'number') return outcome(r.outcome);
    if (typeof r.outcome === 'string' && hasOwn.call(OUT, r.outcome)) return OUT[r.outcome];
    if (r.stutter || r.voided) return 2;
    if (r.timeout === true) return 0; // a timed-out item is wrong (probes too), never a skip
    if (r.skipped) return 3;
    return r.correct ? 1 : 0;
  }

  // Index names may be 'id' or 'id@version' (ARCHITECTURE §8 decisions).
  function idxNames(rec) {
    var ex = rec && rec.idx && isArray(rec.idx.ex) ? rec.idx.ex : [];
    var md = rec && rec.idx && isArray(rec.idx.mode) ? rec.idx.mode : [];
    return {
      ex: ex.map(function (s) { return typeof s === 'string' ? s.split('@')[0] : null; }),
      ver: ex.map(function (s) { var m = typeof s === 'string' ? /@(\d+)$/.exec(s) : null; return m ? +m[1] : 1; }),
      mode: md.map(function (s) { return typeof s === 'string' ? s : null; }),
    };
  }

  // fn(row, exId, modeName, version, i); return false to stop. Malformed rows are skipped.
  function scan(rec, fn, from) {
    var rows = rec && isArray(rec.trials) ? rec.trials : [];
    var nm = idxNames(rec);
    for (var i = from || 0; i < rows.length; i++) {
      var r = rows[i];
      if (!isArray(r) || r.length < 7) continue;
      if (fn(r, nm.ex[r[1]] || null, nm.mode[r[2]] || null, nm.ver[r[1]] || 1, i) === false) break;
    }
  }

  // Params of a row when its version matches the definition (else null).
  function rowParams(def, row, version) {
    if (!def || (version || 1) !== (def.version || 1)) return null;
    try { return PX.ex.decodeParams(def, row[COL.code]); } catch (e) { return null; }
  }

  function idx(rec) {
    if (!rec.idx || typeof rec.idx !== 'object') rec.idx = { ex: [], mode: [] };
    if (!isArray(rec.idx.ex)) rec.idx.ex = [];
    if (!isArray(rec.idx.mode)) rec.idx.mode = [];
    return rec.idx;
  }
  // Append-only name lists, as store.exIndex / modeIndex keep them (ARCHITECTURE §8):
  // exercises as 'id@version'.
  function exIndex(rec, def) {
    var list = idx(rec).ex, name = def.id + '@' + (def.version || 1);
    var i = list.indexOf(name);
    return i >= 0 ? i : list.push(name) - 1;
  }
  function modeIndex(rec, mode) {
    var list = idx(rec).mode, i = list.indexOf(mode);
    return i >= 0 ? i : list.push(mode) - 1;
  }

  // [tSec, exIndex, modeIndex, paramsCode, seed, outcome, rtMs, value, pPredMilli, stage]
  function makeRow(rec, def, mode, step, oc, result, now) {
    var rt = result && typeof result.rt === 'number' && isFin(result.rt) && result.rt >= 0 ? mround(result.rt) : null;
    var value = result && typeof result.value === 'number' && isFin(result.value) ? result.value : null;
    var pp = typeof step.pPred === 'number' && isFin(step.pPred) ? mround((step.pPred < 0 ? 0 : step.pPred > 1 ? 1 : step.pPred) * 1000) : null;
    var stage = typeof step.stage === 'number' && isFin(step.stage) ? step.stage : null;
    return [mfloor(now / 1000), exIndex(rec, def), modeIndex(rec, mode), step.code, step.seed, oc, rt, value, pp, stage];
  }
  function append(rec, row) {
    if (!isArray(rec.trials)) rec.trials = [];
    rec.trials.push(row);
    return row;
  }

  /* ---------- days ---------- */

  function day(ms) { return U.dayKey(ms); }
  function days(a, b) { return (b - a) / DAY; }
  function dayDiff(a, b) { return U.dayNum(day(b)) - U.dayNum(day(a)); }

  E.config = config;
  E.DEFAULTS = DEFAULTS;
  E.configure = configure;
  E.DAY = DAY;
  // Difficulty at which pExp(mu, sd, b, g) equals prob (inverse of pExp in b).
  function bAtExp(mu, sd, prob, g, lapse, a) {
    a = num(a, 1);
    var k = 1 / msqrt(1 + PI * a * a * sd * sd / 8);
    return mu - (mu - bAt(mu, prob, g, lapse, a)) / k;
  }

  E.model = {
    sig: sig, copyParams: copyParams, answerOf: answerOf, p: p, pExp: pExp, bAt: bAt, bAtExp: bAtExp, target: target, styleK: styleK, kindTarget: kindTarget,
    pool: pool, poolEntry: poolEntry, byKey: byKey, refChance: refChance, range: range, nearest: nearest,
  };
  E.field = field;
  E.fields = fields;
  E.fix = fix;
  E.log = {
    COL: COL, OUT: OUT, outcome: outcome, scan: scan, names: idxNames, rowParams: rowParams,
    exIndex: exIndex, modeIndex: modeIndex, row: makeRow, append: append,
  };
  E.day = day;
  E.days = days;
  E.dayDiff = dayDiff;
})(window.PX);
