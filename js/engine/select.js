/* PX.engine.select: which item comes next inside one exercise (ARCHITECTURE §7, PLAN §5).
   Every params combination gets its predicted success under the current belief (model.pExp,
   averaged over the rating's uncertainty). Candidates within ±0.05 of the target are "equally
   hard"; among them the variability policy decides:
     'high' (default)  least-recently-used dimension levels and variants, rarely seen combinations
     'low'             change one dimension from the previous item (Hamming distance 1)
   The last 3 combinations are never repeated while an alternative exists. A weak-spot item (a
   dimension level whose answers fall clearly below prediction) is preferred when asked for.

     params(def, st, targetP, policy, recent)   the ARCHITECTURE §7 signature → params
     pick(def, st, opts) → { params, key, code, b, g, p, err, weak, cand } | null
       opts: target (raw P), policy, recent { keys, last, lru, count, seen }, filter(c) → bool,
             weak [{ d, lv }], rng (PX.rng, breaks ties), tol
     note(rec, def, c)          remembers a shown item (lru, recent, seen) in rec.ex[id]
     recent(rec, def)           what pick() needs from that memory
     residual(rec, def, c, x, p) / weak(rec, def)   per dimension-level residuals x − p; flags
     seed(rec)                  a fresh training seed: a bijection of a counter, never repeated
     syncSeeds(rec)             moves the counter past every logged training seed (lost-field guard)
     sharedSeed(n)              Daily and probe seeds, in [2^31, 2^32): never equal to a training seed
     rng(rec, label)            a deterministic PX.rng for engine choices (ties, exploration) */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;
  var C = E.config;
  var M = E.model;

  var mabs = Math.abs, mmin = Math.min, mmax = Math.max, msqrt = Math.sqrt, PI = Math.PI, sig = M.sig;
  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  /* ---------- per-exercise memory (inside rec.ex[id]) ---------- */

  function memo(rec, def) {
    var e = E.est.exEntry(rec, def.id);
    if (!isObj(e.lru)) e.lru = {};
    if (!isArray(e.recent)) e.recent = [];
    if (!isNum(e.count)) e.count = 0;
    if (!isObj(e.res)) e.res = {};
    return e;
  }

  function dimTag(def, d, lv) { return def.dims[d].key + '=' + lv; }

  function note(rec, def, c) {
    var e = memo(rec, def);
    e.count += 1;
    for (var d = 0; d < def.dims.length; d++) e.lru[dimTag(def, d, c.lv[d])] = e.count;
    if (def.variants) e.lru['variant=' + c.params.variant] = e.count;
    e.seen[c.key] = (isNum(e.seen[c.key]) ? e.seen[c.key] : 0) + 1;
    e.recent.push(c.key);
    if (e.recent.length > C.select.avoid) e.recent.splice(0, e.recent.length - C.select.avoid);
    e.lastKey = c.key;
  }

  function recentOf(rec, def) {
    var e = memo(rec, def);
    var last = typeof e.lastKey === 'string' ? M.byKey(def, e.lastKey) : null;
    return { keys: e.recent.slice(), last: last ? last.params : null, lru: e.lru, count: e.count, seen: e.seen };
  }

  /* ---------- weak spots ---------- */

  // Running mean of x − p per dimension level: exact for the first `window` answers, then an
  // exponential average over about the last `window`. Buckets are [mean, n].
  function residual(rec, def, c, x, p) {
    var e = memo(rec, def), W = C.weak.window, r = (x ? 1 : 0) - p;
    for (var d = 0; d < def.dims.length; d++) {
      if (def.dims[d].levels.length < 2) continue;
      var k = dimTag(def, d, c.lv[d]);
      var b = e.res[k];
      if (!isArray(b) || b.length !== 2 || !isNum(b[0]) || !isNum(b[1])) b = e.res[k] = [0, 0];
      b[1] = Math.min(W, b[1] + 1);
      b[0] = U.round(b[0] + (r - b[0]) / b[1], 4);
    }
  }

  // "Clearly below": mean residual under −0.10 and below zero by more than two standard
  // errors (binomial variance taken as 0.2), over at least 15 answers.
  function weak(rec, def) {
    var e = memo(rec, def), out = [];
    for (var d = 0; d < def.dims.length; d++) {
      for (var lv = 0; lv < def.dims[d].levels.length; lv++) {
        var b = e.res[dimTag(def, d, lv)];
        if (!isArray(b) || !(b[1] >= C.weak.minN)) continue;
        var z = b[0] / Math.sqrt(0.2 / b[1]);
        if (b[0] < C.weak.gap && z < -2) out.push({ d: d, lv: lv, key: dimTag(def, d, lv), m: b[0], n: b[1] });
      }
    }
    return out.sort(function (a, b) { return a.m - b.m; });
  }

  /* ---------- choosing ---------- */

  // 1 when the candidate's dimension levels and variant were not used in the exercise's last 12
  // items, less when they were (tags are precomputed per candidate in model.pool).
  function freshness(def, c, recent) {
    var lru = recent && recent.lru;
    if (!lru) return 1;
    var count = isNum(recent.count) ? recent.count : 0, tags = c.tags, sum = 0, n = 0, at, i;
    for (i = 0; i < tags.length; i++) {
      if (tags[i] === null) continue;
      at = lru[tags[i]];
      sum += typeof at === 'number' ? mmin(1, (count - at) / 12) : 1;
      n++;
    }
    if (c.vtag !== null) {
      at = lru[c.vtag];
      sum += 1.5 * (typeof at === 'number' ? mmin(1, (count - at) / 12) : 1);
      n += 1.5;
    }
    return n ? sum / n : 1;
  }

  function hamming(def, c, last) {
    if (!last) return 1;
    var h = 0;
    for (var d = 0; d < def.dims.length; d++) if (c.params[def.dims[d].key] !== last[def.dims[d].key]) h++;
    if (def.variants && c.params.variant !== last.variant) h++;
    return h;
  }

  // Scratch buffers (pick is never re-entered: filters do not call it).
  var ERR = new Float64Array(64), PP = new Float64Array(64), TG = new Float64Array(64);
  function grow(n) {
    if (ERR.length >= n) return;
    var m = ERR.length;
    while (m < n) m *= 2;
    ERR = new Float64Array(m); PP = new Float64Array(m); TG = new Float64Array(m);
  }

  function fullOpts(opts) {
    var o = {};
    for (var key in opts) if (hasOwn.call(opts, key)) o[key] = opts[key];
    o.full = true;
    return o;
  }

  function pick(def, st, opts) {
    opts = opts || {};
    var list = M.pool(def), n = list.length;
    grow(n);
    // A fixed raw target, or one per candidate from the item kind and the style's k (variants
    // may differ in guessing rate, so the raw target follows each candidate's g).
    var fixedT = isNum(opts.target) ? opts.target : null;
    var kind = opts.kind || 'target', k = isNum(opts.k) ? opts.k : M.styleK(C.style);
    var tol = isNum(opts.tol) ? opts.tol : C.select.tol;
    var recent = opts.recent || null;
    var avoid = recent && isArray(recent.keys) ? recent.keys : [];
    var policy = opts.policy === 'low' ? 'low' : 'high';
    var filter = opts.filter || null, lapse = C.lapse;
    // A broken belief (NaN) never throws: it is read as the prior.
    var mu = isNum(st && st.mu) ? st.mu : M.range(def).min + C.prior.offset;
    var sd = isNum(st && st.sd) && st.sd > 0 ? st.sd : C.prior.sd;
    var kk = 1 / msqrt(1 + PI * sd * sd / 8); // model.pExp, hoisted
    var lastG = NaN, lastT = 0, bestErr = Infinity, i, c, e, idxs = [];
    function evalC(j, cc) {
      var pp = cc.g + (1 - cc.g - lapse) * sig((mu - cc.b) * kk), tg;
      if (fixedT !== null) tg = fixedT;
      else {
        if (cc.g !== lastG) { lastG = cc.g; lastT = M.kindTarget(kind, k, cc.g); }
        tg = lastT;
      }
      var er = mabs(pp - tg);
      ERR[j] = er; PP[j] = pp; TG[j] = tg;
      return er;
    }
    // Large pools: within a group of equal guessing rate the predicted P falls with b, so the
    // distance from the target grows on both sides of the ideal difficulty b*. Scanning outward
    // from b* until the distance passes max(0.17, best + 0.02) visits every candidate the
    // choice below can use; the full scan remains the fallback.
    var windowed = n > 64 && !opts.full;
    if (windowed) {
      var groups = M.poolEntry(def).groups;
      for (var gi = 0; gi < groups.length; gi++) {
        var G = groups[gi], gl = G.list, gb = G.bs;
        var bStar = M.bAtExp(mu, sd, fixedT !== null ? fixedT : M.kindTarget(kind, k, G.g), G.g);
        var lo = 0, hi = gb.length;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (gb[mid] < bStar) lo = mid + 1; else hi = mid; }
        for (var r = lo; r < gl.length; r++) {
          c = gl[r];
          if (filter && !filter(c)) continue;
          e = evalC(c.i, c);
          if (e > mmax(0.17, bestErr + 0.02)) break;
          idxs.push(c.i);
          if (e < bestErr) bestErr = e;
        }
        for (var l = lo - 1; l >= 0; l--) {
          c = gl[l];
          if (filter && !filter(c)) continue;
          e = evalC(c.i, c);
          if (e > mmax(0.17, bestErr + 0.02)) break;
          idxs.push(c.i);
          if (e < bestErr) bestErr = e;
        }
      }
      idxs.sort(function (x, y) { return x - y; });
    } else {
      for (i = 0; i < n; i++) {
        c = list[i];
        if (filter && !filter(c)) continue;
        e = evalC(i, c);
        idxs.push(i);
        if (e < bestErr) bestErr = e;
      }
    }
    if (!idxs.length) return null; // every candidate was filtered out
    var cutF = mmax(0.17, bestErr + 0.02);
    var lim = bestErr <= tol ? tol : bestErr + 0.02;
    var fresh = [], near = [], q;
    for (q = 0; q < idxs.length; q++) {
      i = idxs[q];
      if (ERR[i] > lim) continue;
      near.push(i);
      if (avoid.indexOf(list[i].key) < 0) fresh.push(i);
    }
    if (fresh.length > 48) {
      // Dense pools (Track has thousands of combinations): score the 48 closest, plenty for variety.
      fresh.sort(function (x, y) { return ERR[x] - ERR[y] || x - y; });
      fresh.length = 48;
    }
    if (!fresh.length) {
      // Only recent combinations are that close: the nearest others, but variety may cost at
      // most `slack` more than the best error (at a pool's floor or ceiling every other
      // combination lies on the same side); past that the closest come again, with new seeds.
      var others = [], capO = bestErr + (isNum(C.select.slack) ? C.select.slack : Infinity);
      for (q = 0; q < idxs.length; q++) {
        i = idxs[q];
        if (ERR[i] <= capO && (!windowed || ERR[i] <= cutF) && avoid.indexOf(list[i].key) < 0) others.push(i);
      }
      if (windowed && others.length < 4 && capO > cutF) return pick(def, st, fullOpts(opts));
      others.sort(function (x, y) { return ERR[x] - ERR[y] || x - y; });
      fresh = others.slice(0, 4);
      if (!fresh.length) fresh = near;
    }
    var weakHit = false;
    if (opts.weak && opts.weak.length) {
      for (var w = 0; w < opts.weak.length && !weakHit; w++) {
        var wk = opts.weak[w], be = Infinity, wpool = [];
        for (q = 0; q < idxs.length; q++) {
          i = idxs[q];
          if (list[i].lv[wk.d] !== wk.lv || avoid.indexOf(list[i].key) >= 0) continue;
          wpool.push(i);
          if (ERR[i] < be) be = ERR[i];
        }
        if (!wpool.length || be > 0.15) continue; // nothing of that kind near the target
        var cut = mmax(tol, be + 0.02);
        fresh = wpool.filter(function (j) { return ERR[j] <= cut; });
        weakHit = true;
      }
    }
    var last = recent && recent.last, seen = recent && recent.seen;
    // No repeated level on consecutive items for the listed dimensions, while another level is
    // within ±tol of the target.
    var nr = isArray(def.noRepeat) ? def.noRepeat : C.select.noRepeat && C.select.noRepeat[def.id];
    if (last && isArray(nr)) {
      for (var z = 0; z < nr.length; z++) {
        var dk = nr[z], lastLv = last[dk];
        if (lastLv === undefined) continue;
        var alt = fresh.filter(function (j) { return list[j].params[dk] !== lastLv; });
        if (alt.some(function (j) { return ERR[j] <= tol; })) fresh = alt;
      }
    }
    var bestScore = Infinity, ties = [], scale = 0.6 / mmax(tol, 1e-3);
    for (var f = 0; f < fresh.length; f++) {
      i = fresh[f];
      c = list[i];
      var s = ERR[i] * scale;
      if (policy === 'low') {
        s += last ? mabs(hamming(def, c, last) - 1) : 0;
        s += 0.2 * (1 - freshness(def, c, recent));
      } else s += 1 - freshness(def, c, recent);
      var sc = seen ? seen[c.key] : 0;
      if (typeof sc === 'number' && sc > 0) s += 0.05 * mmin(sc, 6);
      if (s < bestScore - 1e-9) { bestScore = s; ties = [i]; } else if (mabs(s - bestScore) <= 1e-9) ties.push(i);
    }
    if (!ties.length) ties = [fresh.length ? fresh[0] : idxs[0]]; // never throws, whatever the scores
    var bi = ties.length > 1 && opts.rng ? opts.rng.pick(ties) : ties[0], bc = list[bi];
    return {
      params: M.copyParams(bc.params), key: bc.key, code: bc.code, b: bc.b, g: bc.g,
      p: PP[bi], err: ERR[bi], target: TG[bi], weak: weakHit, cand: bc,
    };
  }

  // The same result shape for a given combination (Free play with fixed settings, probes).
  function fixed(def, st, params) {
    var c = M.byKey(def, PX.ex.paramsKey(params));
    if (!c) return null;
    var p = M.pExp(st.mu, st.sd, c.b, c.g);
    return { params: M.copyParams(c.params), key: c.key, code: c.code, b: c.b, g: c.g, p: p, err: 0, target: p, weak: false, cand: c };
  }

  function params(def, st, targetP, policy, recent) {
    var r = pick(def, st, { target: targetP, policy: policy, recent: recent });
    return r ? r.params : null;
  }

  /* ---------- seeds ---------- */

  // A bijection on [0, 2^31): xorshifts and odd multipliers modulo 2^31.
  var K1 = 0x2c1b3c6d, K2 = 0x297a2d39;
  function inv(k) { // k⁻¹ modulo 2^32 by Newton's iteration (also the inverse modulo 2^31)
    var x = k;
    for (var i = 0; i < 5; i++) x = Math.imul(x, 2 - Math.imul(k, x));
    return x;
  }
  var I1 = inv(K1), I2 = inv(K2);
  function mix31(x) {
    x &= 0x7fffffff;
    x ^= x >>> 15;
    x = Math.imul(x, K1) & 0x7fffffff;
    x ^= x >>> 12;
    x = Math.imul(x, K2) & 0x7fffffff;
    x ^= x >>> 15;
    return x >>> 0;
  }
  function unshift(y, s) { var x = y; for (var i = 0; i < 3; i++) x = y ^ (x >>> s); return x; }
  function unmix31(y) {
    var x = y & 0x7fffffff;
    x = unshift(x, 15);
    x = Math.imul(x, I2) & 0x7fffffff;
    x = unshift(x, 12);
    x = Math.imul(x, I1) & 0x7fffffff;
    x = unshift(x, 15);
    return x >>> 0;
  }

  function engState(rec) {
    var g = rec.eng;
    if (!isObj(g)) g = rec.eng = {};
    if (!isNum(g.seedN) || g.seedN < 0) g.seedN = 0;
    if (!isNum(g.salt)) g.salt = PX.rng.hash('parallax-salt', isNum(rec.created) ? rec.created : 0) & 0x7fffffff;
    return g;
  }

  // A per-page-load salt (10 bits), fixed by the first plan this page starts (from its time), so
  // two tabs on one record never draw the same training seeds. Daily, friend-challenge, Check
  // and worked-example seeds do not use it; every seed is logged, so replays still work.
  var PAGE_BITS = 10, PAGE_N = 1 << PAGE_BITS, COUNT_N = 0x80000000 / PAGE_N, page = null;
  function pageSalt(v) {
    if (page === null && isNum(v)) page = PX.rng.hash('px-page', v) % PAGE_N;
    return page === null ? 0 : page;
  }

  // Training and Free play seeds: [0, 2^31). The counter and the page salt fill the 31 bits
  // (counter · 2^10 + page), so a record never repeats a seed within its first 2^21 items, and
  // tabs opened at different times draw from disjoint seeds.
  function seed(rec) {
    // The counter never goes back, even when this tab adopted another tab's save mid-session:
    // it stays above every logged seed (an incremental scan of the new rows).
    syncSeeds(rec);
    var g = engState(rec);
    var x = (g.seedN % COUNT_N) * PAGE_N + pageSalt();
    var s = mix31((g.salt + x) & 0x7fffffff);
    g.seedN += 1;
    return s;
  }

  // If the counter was lost (an unregistered field, an old backup), the logged seeds tell how
  // far it had gone: every training seed maps back to its counter value. Rows are scanned once
  // per trials array; later calls read only the new rows.
  var seen = typeof WeakMap === 'function' ? new WeakMap() : null;
  function syncSeeds(rec) {
    var g = engState(rec), rows = isArray(rec.trials) ? rec.trials : [];
    var c = seen && seen.get(rows);
    if (!c || c.salt !== g.salt || c.first !== rows[0] || c.n > rows.length) c = { n: 0, top: -1, first: rows[0], salt: g.salt };
    for (var i = c.n; i < rows.length; i++) {
      var r = rows[i], s = isArray(r) ? r[4] : null;
      if (typeof s !== 'number' || s < 0 || s >= 0x80000000 || s !== s) continue;
      var n = Math.floor(((unmix31(s) - g.salt) & 0x7fffffff) / PAGE_N); // the counter part
      if (n > c.top) c.top = n;
    }
    c.n = rows.length;
    if (seen) seen.set(rows, c);
    if (c.top + 1 > g.seedN) g.seedN = c.top + 1;
    return g.seedN;
  }

  function sharedSeed(n) { return (0x80000000 + mix31(n)) >>> 0; }

  function rngFor(rec, label) {
    var g = engState(rec);
    return PX.rng(PX.rng.hash('px-engine', g.salt, g.seedN, label || ''));
  }

  E.select = {
    pick: pick, params: params, fixed: fixed, note: note, memo: memo, recent: recentOf, residual: residual,
    weak: weak, seed: seed, pageSalt: pageSalt, syncSeeds: syncSeeds, sharedSeed: sharedSeed, mix31: mix31,
    unmix31: unmix31, rng: rngFor, eng: engState, dimTag: dimTag, freshness: freshness,
  };

  E.field('eng', function () { return { seedN: 0, salt: null }; }, function (v) {
    if (!isObj(v)) return undefined;
    var out = U.deepCopy(v);
    out.seedN = E.fix.int(v.seedN, 0, 9007199254740991);
    if (out.seedN === undefined) out.seedN = 0;
    out.salt = isNum(v.salt) ? (v.salt >>> 0) & 0x7fffffff : null;
    return out;
  });
})(window.PX);
