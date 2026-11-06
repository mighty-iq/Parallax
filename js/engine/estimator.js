/* PX.engine.est: the rating of one exercise as a Gaussian belief over ability θ (logits).
   ARCHITECTURE §7, PLAN §5; formulas and sources in docs/dev/ENGINE.md.

   State: { mu, sd, n, nRight, last }  (last = ms of the last rated trial, or null)
     prior(def)                    { mu: easiest item + 1.0, sd: 1.0 }: the first items are easy
     drift(st, trials, days)       variance + 0.002 per trial + 0.01 per idle day (capped at 1.0)
     post(mu, sd, b, g, correct)   moment matching on a grid (μ ± 6σ inside −8..+8 logits)
     update(st, b, g, correct)     post() plus counters; no drift (rate() adds it)
     level(def, st)                { level 1–100, lo, hi, exact, b, settings }: the difficulty answered
                                   right at g + (1 − g)·0.75, on the exercise's range; lo–hi from μ ± 1.96σ
     levelOf(def, b) / bOfLevel(def, level)   the linear map between difficulty and level
     settingsAt(def, b)            the most even dimension setting near difficulty b (for display)
     predict(st, b, g)             expected success averaged over the belief
   Record helpers (rec = the learner record; opts.display 'small' | 'large', opts.timed):
     slot(rec, def, opts)          the live state object inside rec (created; prior when n = 0)
     get(rec, def, opts)           a copy of it
     shown(rec, def, opts)         the level shown for the stored rating: level(def, get(…)) without
                                   idle drift, so a level and its range change only with answers.
                                   Every level a session shows (block ends, summary, bests) is this.
     rate(rec, def, params, correct, now, opts)  drift + update + history; returns before/after
     displayClass(w, h)            'small' when the short side is under 600 CSS px
   Stuttered or skipped trials never reach rate(): the callers (modes, assess) skip them. */
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

  function prior(def) {
    var r = M.range(def);
    return { mu: r.min + C.prior.offset, sd: C.prior.sd };
  }

  function fresh(def) {
    var p = prior(def);
    return { mu: p.mu, sd: p.sd, n: 0, nRight: 0, last: null };
  }

  function clean(st, def) {
    var ok = st && isNum(st.mu) && isNum(st.sd) && st.sd > 0 && Math.abs(st.mu) <= 50;
    var n = st && isNum(st.n) && st.n > 0 ? Math.floor(st.n) : 0;
    if (!ok || n === 0) {
      var p = prior(def);
      return { mu: p.mu, sd: p.sd, n: ok ? n : 0, nRight: n && st && isNum(st.nRight) ? Math.min(n, st.nRight) : 0, last: st && isNum(st.last) ? st.last : null };
    }
    return {
      mu: U.clamp(st.mu, C.grid.lo, C.grid.hi),
      sd: U.clamp(st.sd, 0.05, 3),
      n: n,
      nRight: isNum(st.nRight) ? U.clamp(Math.floor(st.nRight), 0, n) : 0,
      last: isNum(st.last) ? st.last : null,
    };
  }

  // Wider belief for learning (per trial) and forgetting (per idle day). The cap applies only
  // to the growth: a belief already wider than the cap is never narrowed here.
  function drift(st, trials, days) {
    var v = st.sd * st.sd;
    var add = C.noise.trial * Math.max(0, trials || 0) + C.noise.day * Math.max(0, days || 0);
    var nv = v + add;
    if (nv > C.noise.maxVar) nv = Math.max(v, C.noise.maxVar);
    var out = {};
    for (var k in st) if (hasOwn.call(st, k)) out[k] = st[k];
    out.sd = Math.sqrt(nv);
    return out;
  }

  var mexp = Math.exp, msqrt = Math.sqrt, mmax = Math.max, mmin = Math.min, sig = M.sig;

  // Posterior mean and SD of θ after one answer, by moment matching on a grid.
  function post(mu, sd, b, g, correct, lapse) {
    var G = C.grid, N = mmax(21, G.points | 0);
    var lo = mmax(G.lo, mu - G.width * sd), hi = mmin(G.hi, mu + G.width * sd);
    if (!(hi - lo > 1e-6)) { lo = G.lo; hi = G.hi; }
    var gg = isNum(g) ? g : 0, la = isNum(lapse) ? lapse : C.lapse, amp = 1 - gg - la;
    var step = (hi - lo) / (N - 1), inv = 1 / (2 * sd * sd);
    var w = new Array(N), s0 = 0, s1 = 0, i, th;
    for (i = 0; i < N; i++) {
      th = lo + i * step;
      var pc = gg + amp * sig(th - b);
      w[i] = mexp(-(th - mu) * (th - mu) * inv) * (correct ? pc : 1 - pc);
      s0 += w[i];
      s1 += w[i] * th;
    }
    if (!(s0 > 0)) return { mu: mu, sd: sd };
    var m = s1 / s0, s2 = 0;
    for (i = 0; i < N; i++) { th = lo + i * step - m; s2 += w[i] * th * th; }
    return { mu: m, sd: msqrt(mmax(s2 / s0, 1e-6)) };
  }

  function update(st, b, g, correct, opts) {
    var r = post(st.mu, st.sd, b, g, !!correct, opts && opts.lapse);
    var out = {};
    for (var k in st) if (hasOwn.call(st, k)) out[k] = st[k];
    out.mu = r.mu;
    out.sd = r.sd;
    out.n = (st.n || 0) + 1;
    out.nRight = (st.nRight || 0) + (correct ? 1 : 0);
    if (opts && isNum(opts.now)) out.last = opts.now;
    return out;
  }

  function predict(st, b, g) { return M.pExp(st.mu, st.sd, b, g); }

  /* ---------- levels ---------- */

  function levelOf(def, b) {
    var r = M.range(def), span = r.max - r.min;
    if (!(span > 1e-9)) return 1;
    return 1 + 99 * U.clamp((b - r.min) / span, 0, 1);
  }
  function bOfLevel(def, level) {
    var r = M.range(def);
    return r.min + (U.clamp(level, 1, 100) - 1) / 99 * (r.max - r.min);
  }
  // The difficulty answered right at the fixed reference g + (1 − g)·0.75 by ability θ.
  function bRef(def, theta) {
    var g = M.refChance(def);
    return M.bAt(theta, M.target(g, C.levelRef), g);
  }

  var settingsCache = typeof WeakMap === 'function' ? new WeakMap() : null;

  // The most even setting (every dimension at a similar share of its range) whose difficulty is
  // within 0.15 logits of the closest one to b; first variant; ties by the lowest code.
  // Cached per definition at a resolution of 0.05 logits; the result is shared and frozen.
  function settingsAt(def, b) {
    var key = mround(b * 20), cache = settingsCache && settingsCache.get(def);
    if (cache && hasOwn.call(cache, key)) return cache[key];
    var out = settingsAtRaw(def, key / 20); // the bucket's own value: independent of call order
    if (out) {
      Object.freeze(out.params);
      out.dims.forEach(Object.freeze);
      Object.freeze(out.dims);
      Object.freeze(out);
    }
    if (settingsCache) {
      if (!cache) settingsCache.set(def, cache = {});
      cache[key] = out;
    }
    return out;
  }

  function settingsAtRaw(def, b) {
    var list = M.pool(def), first = def.variants ? def.variants[0] : undefined, dims = def.dims;
    var best = Infinity, i, c, d;
    for (i = 0; i < list.length; i++) {
      c = list[i];
      if (first !== undefined && c.params.variant !== first) continue;
      var dd = c.b > b ? c.b - b : b - c.b;
      if (dd < best) best = dd;
    }
    var pick = null, pickSpread = Infinity;
    for (i = 0; i < list.length; i++) {
      c = list[i];
      if (first !== undefined && c.params.variant !== first) continue;
      if ((c.b > b ? c.b - b : b - c.b) > best + 0.15) continue;
      // spread of the levels' shares of their ranges (population SD), without allocations
      var m = 0, cnt = 0, ss = 0;
      for (d = 0; d < dims.length; d++) { var L = dims[d].levels.length; if (L > 1) { m += c.lv[d] / (L - 1); cnt++; } }
      if (cnt > 1) {
        m /= cnt;
        for (d = 0; d < dims.length; d++) { var L2 = dims[d].levels.length; if (L2 > 1) { var x = c.lv[d] / (L2 - 1) - m; ss += x * x; } }
      }
      var spread = cnt > 1 ? msqrt(ss / cnt) : 0;
      if (spread < pickSpread - 1e-9 || ((spread - pickSpread <= 1e-9 && pickSpread - spread <= 1e-9) && pick && c.code < pick.code)) {
        pick = c;
        pickSpread = spread;
      }
    }
    if (!pick) return null;
    return {
      params: M.copyParams(pick.params),
      b: pick.b,
      dims: def.dims.map(function (dim, d) {
        return { key: dim.key, label: dim.label, index: pick.lv[d], of: dim.levels.length, value: dim.levels[pick.lv[d]] };
      }),
    };
  }

  function level(def, st, opts) {
    var s = clean(st, def);
    var z = opts && isNum(opts.z) ? opts.z : C.z;
    var b = bRef(def, s.mu);
    var exact = levelOf(def, b);
    var lo = levelOf(def, bRef(def, s.mu - z * s.sd));
    var hi = levelOf(def, bRef(def, s.mu + z * s.sd));
    return {
      level: Math.round(exact), lo: Math.round(lo), hi: Math.round(hi), exact: exact, b: b,
      settings: opts && opts.settings === false ? null : settingsAt(def, b),
    };
  }

  function displayClass(w, h) {
    var s = Math.min(isNum(w) ? w : 1024, isNum(h) ? h : 768);
    return s < 600 ? 'small' : 'large';
  }

  /* ---------- where ratings live in the record ---------- */

  function exEntry(rec, id) {
    if (!rec.ex || typeof rec.ex !== 'object') rec.ex = {};
    var e = rec.ex[id];
    if (!e || typeof e !== 'object' || isArray(e)) {
      e = rec.ex[id] = { mu: 0, sd: 2, n: 0, nRight: 0, last: null, seen: {}, best: {}, hist: [] };
    }
    if (!e.seen || typeof e.seen !== 'object' || isArray(e.seen)) e.seen = {};
    if (!e.best || typeof e.best !== 'object' || isArray(e.best)) e.best = {};
    if (!isArray(e.hist)) e.hist = [];
    return e;
  }

  // The stored state of a slot, or null, without creating anything.
  function peek(rec, def, opts) {
    var small = def.perDisplay && opts && opts.display === 'small';
    var host = opts && opts.timed ? (rec && isObj(rec.timed) ? rec.timed[def.id] : null) : (rec && isObj(rec.ex) ? rec.ex[def.id] : null);
    if (!isObj(host)) return null;
    var st = small ? host.small : host;
    return isObj(st) ? st : null;
  }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  // Untimed: rec.ex[id] itself ('large', or every display for ordinary exercises), or
  // rec.ex[id].small. Timed (Speed mode): rec.timed[id] (or rec.timed[id].small).
  function slot(rec, def, opts) {
    var small = def.perDisplay && opts && opts.display === 'small';
    var host;
    if (opts && opts.timed) {
      if (!rec.timed || typeof rec.timed !== 'object' || isArray(rec.timed)) rec.timed = {};
      host = rec.timed[def.id];
      if (!host || typeof host !== 'object' || isArray(host)) host = rec.timed[def.id] = {};
    } else host = exEntry(rec, def.id);
    var st = host;
    if (small) {
      st = host.small;
      if (!st || typeof st !== 'object' || isArray(st)) st = host.small = {};
    }
    var c = clean(st, def);
    st.mu = c.mu; st.sd = c.sd; st.n = c.n; st.nRight = c.nRight; st.last = c.last;
    if (!isArray(st.hist)) st.hist = [];
    return st;
  }

  // A copy of the state; with `now`, widened by the idle days since the last rated trial (the
  // belief the next item is chosen with). The stored state is not changed.
  function get(rec, def, opts, now) {
    var s = clean(peek(rec, def, opts), def); // reading never creates record entries
    var out = { mu: s.mu, sd: s.sd, n: s.n, nRight: s.nRight, last: s.last };
    if (isNum(now) && isNum(s.last) && now > s.last) out.sd = drift(out, 0, (now - s.last) / DAY).sd;
    return out;
  }

  // The one function that turns a stored rating into the level a session shows.
  function shown(rec, def, opts) {
    var st = get(rec, def, opts), lv = level(def, st);
    return { level: lv.level, lo: lv.lo, hi: lv.hi, exact: lv.exact, settings: lv.settings, mu: st.mu, sd: st.sd };
  }

  // One rated answer: drift (one trial + idle days), moment-matching update, history.
  function rate(rec, def, params, correct, now, opts) {
    var st = slot(rec, def, opts);
    var b = opts && isNum(opts.b) ? opts.b : def.difficulty(params);
    var g = opts && isNum(opts.g) ? opts.g : def.chance(params);
    var before = { mu: st.mu, sd: st.sd };
    var days = isNum(st.last) && isNum(now) && now > st.last ? (now - st.last) / DAY : 0;
    var d = drift(st, 1, days);
    var pPred = predict(d, b, g);
    var r = post(d.mu, d.sd, b, g, !!correct);
    st.mu = r.mu;
    st.sd = r.sd;
    st.n += 1;
    if (correct) st.nRight += 1;
    if (isNum(now)) st.last = now;
    history(st, now);
    return { b: b, g: g, p: pPred, before: before, after: { mu: st.mu, sd: st.sd }, n: st.n };
  }

  // Day keys change only at local midnight, which always falls on a multiple of 15 minutes
  // (every time zone offset is one), so a 15-minute bucket can reuse the last key.
  var mfloor = Math.floor, mround = Math.round, dayAt = -1, dayKey = null;
  function dayOf(now) {
    var bucket = mfloor(now / 900000);
    if (bucket !== dayAt) { dayAt = bucket; dayKey = E.day(now); }
    return dayKey;
  }
  function r4(x) { return mround(x * 1e4) / 1e4; }

  // hist: one [dayKey, mu, sd] per practice day (the day's last value); snap: [n, mu, sd]
  // every 10 rated trials (the last 13 kept) for learning progress.
  function history(st, now) {
    var day = isNum(now) ? dayOf(now) : null;
    var mu = r4(st.mu), sd = r4(st.sd);
    if (day) {
      var h = st.hist, last = h.length ? h[h.length - 1] : null;
      if (last && last[0] === day) { last[1] = mu; last[2] = sd; } else h.push([day, mu, sd]);
      if (h.length > 3650) h.splice(0, h.length - 3650);
    }
    if (!isArray(st.snap)) st.snap = [];
    if (st.n % C.bandit.snapEvery === 0) {
      st.snap.push([st.n, mu, sd]);
      if (st.snap.length > C.bandit.snapKeep) st.snap.splice(0, st.snap.length - C.bandit.snapKeep);
    }
  }

  E.est = {
    prior: prior, fresh: fresh, clean: clean, drift: drift, post: post, update: update,
    predict: predict, level: level, levelOf: levelOf, bOfLevel: bOfLevel, bRef: bRef,
    settingsAt: settingsAt, displayClass: displayClass, slot: slot, peek: peek, get: get, shown: shown, rate: rate,
    exEntry: exEntry,
  };
})(window.PX);
