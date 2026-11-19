/* PX.engine.trend: one person's probe trend over all measurement occasions (v1.2, PLAN milestone 6;
   docs/research/v1.2/M1-measurement.md §4 and its Addendum; the simulation that set and checked these
   defaults: tests/node/measure-sim.mjs, results in docs/dev/v1.2/measure-sim.md).

   The model, for probe p at occasion j (baselines, embedded blocks, 4-weekly checks, measurement weeks):

     y_pj = α_p + σ_p·(F_p·φ̄_pj + T·n̄_pj + G_r(p)·h_j) + σ_p·(u_j + s_pj) + e_pj     spatial probes
     y_cj = α_c + σ_c·(F_c·φ̄_cj + T_c·n̄_cj)             + σ_c·(u_j + s_cj) + e_cj     the control

   - y: the block's ability on the probe's item scale (logits), e its measurement error;
   - α_p: the probe's own level (flat prior);
   - φ̄: the mean over the block's items of 1 − exp(−n/λ), with n that probe's items answered before: the
     familiarity curve, counted in items; F_p its amplitude (SD units), with the population prior
     (plateau, between-person SD, correlations);
   - n̄: the mean over the block's items of (items before) / 16, with T (spatial, shared) and T_c (control)
     the slow familiarity tails (SD units per 16 items), with a population prior;
   - G_r: the gain of rung r (near, mid, far; Level's own 'alone'), flat prior; h_j the training-gain
     curve at the occasion (any scale), so the gain to date is D = G·h(now);
   - u_j: the occasion's shared state; s_pj: the probe's own state (SD units; together config.state.total);
   - σ_p: the between-person SD of the probe (logits), so F, T, G and the state are in SD units.

   Linear and Gaussian once each block is: the posterior is exact generalised least squares (the same as a
   Kalman smoother over the occasions), with the occasion's state integrated out by Sherman–Morrison.
   Blocks come either as summaries { y, v } or as items [b, g, ok, rtMs?, a?] (the rows rec.assess stores:
   the response time is ignored here; a, the item's slope, defaults to 1 as in the engine) under the item model
   P = g + (1 − g − lapse)·σ(a(θ − b)), or as items scored by cells, [b, g, ok, rtMs, a, { k, s }] (Pattern
   Memory from version 2: k cells, score s = squares marked right minus extra marks, at least 0) under
   P(s) = (1 − lapse)·E_u[Binomial(s; k, σ(θ + u − b + Δ))] + lapse/(k + 1), u ~ N(0, cells.tau²) the pattern's
   own ease, shared by its cells, and Δ = Δ(k, tau) such that the whole pattern is recalled half the time at
   θ = b (b keeps the meaning of an exact-pattern difficulty; docs/dev/v1.2/measure-sim.md §12); items are
   linearised at the block's fitted ability (fixed part plus
   the predicted state) and the fit is iterated to convergence: penalised quasi-likelihood, i.e. the Laplace
   approximation at the joint posterior mode, so blocks of two or three items need no weak per-block prior.

   A gap of more than config.breakDays between occasions starts a new segment: familiarity is taken to have
   lost config.breakLoss of what it had (fast curve and tail alike; Terlecki et al. 2008, note M1 Addendum
   A.1 #5) and the run-in restarts, so verdict words wait for config.runIn occasions in the new segment.

   Verdict words only at milestones (days since the first occasion: config.milestones), computed once with
   the data up to the first occasion on or after the milestone: "likely gain" when P(D > 0) reaches the bar
   (0.975 at day 14, 0.95 later), "likely no change" from day 56 when P(D < 0.2 SD_comp) ≥ 0.90, otherwise
   "unclear yet". Between milestones the meter P(D > 0) moves with every block.

   Pure: no clock, no storage, no randomness. Every parameter is in E.trend.config (one object; DEFAULTS
   below), changed in place by E.trend.configure(patch | 'reset'), so pooled data can replace the
   population values in minutes.

     fit(input, opts?) → { ok, day, gain: { comp, near, mid, far, …per rung }, meter, segment, eta, beta, cov, index }
       input = { occasions: [{ t (ms), h?, blocks: [{ probe, items: [[b, g, ok, rtMs?, a?, cells?], …] } | { probe, n, y, v }] }] }
       gain.x = { mean, sd (SD units of that readout), p = P(D > 0), pNone = P(D < margin), lo, hi (config.range),
                  logits (mean in probe points), pts: { mean, sd, lo, hi } (probe points), sdUnit (SD of the readout
                  in per-probe SD) }; probe keys may carry a version ('cubematch@2': its own probe in the fit)
       opts.eta: linearisation points from an earlier fit of a prefix (warm start); opts.hNow: h for "now"
     track(input, opts?) → one entry per occasion: { day, t, meter, gain, verdict: null | { milestone, words, … } }
     milestoneAt(day) → { index, day, bar, none } | null     verdict(fit, milestone, readout?) → words
     predict(fit, probe, h?) → { mean, sd } (logits) of the probe's next block, for item targeting
     familiarity(n) and afterBreak(state) for tests; configure(patch | 'reset'); config; DEFAULTS
     cells.logp(θ, b, k, s) the log likelihood of a score by cells (the Spatial Check's grid posterior uses it);
     cells.si(θ, b, k, s) → { S, I } its score and expected information; cells.delta(k, tau) */
(function (PX) {
  'use strict';

  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;
  var mexp = Math.exp, mlog = Math.log, msqrt = Math.sqrt, mabs = Math.abs, mmax = Math.max, mmin = Math.min, mfloor = Math.floor;
  var E = PX.engine;
  var DAY = 86400000;

  /* ---------- defaults (sources: note M1 §4.4 and Addendum A.3–A.5; docs/dev/v1.2/measure-sim.md) ---------- */

  var DEFAULTS = {
    // Between-person SD of one probe's true ability, in logits: 1.15 makes a 16-item probe 0.75 reliable
    // (note M1 §4.4); byProbe overrides it per probe once pooled baselines give the real spread.
    sd: { logits: 1.15, byProbe: {} },
    rho: 0.4,                                  // correlation of true ability between probes (SD of a composite)
    // The rung of every probe. Ids of probes still to be built are provisional (Other Way Round,
    // Motion Graphs). 'control' has no gain; 'alone' (Level) gets its own gain, outside the composite.
    probes: {
      otherway: 'near', cubematch: 'mid', viewmatch: 'mid', patterns: 'mid', mechanisms: 'far', motiongraphs: 'far',
      level: 'alone', wordlinks: 'control',
    },
    // The composite: the mean of the probes of these rungs ('probe': each probe weighs the same; 'rung':
    // each rung weighs the same).
    composite: { rungs: ['near', 'mid', 'far'], weights: 'probe' },
    state: { total: 0.5, shared: 0.5 },         // occasion state, SD units (Sliwinski et al. 2018); shared share of its variance
    fam: { plateau: 0.65, sd: 0.2, lambda: 16, corr: 0.5, control: 0.3, corrControl: 0.3 },
    tail: { spatial: 0.045, control: 0.027, sd: 0.02, corr: 0.3, per: 16 },
    // priorSd: a weak prior N(0, priorSd²) on each rung's gain (per-probe SD units); 0 would make it flat, which
    // lets a one-probe rung's gain run off to infinity on early blocks (separation; docs/dev/v1.2/measure-sim.md).
    // h when an occasion gives none: min(1, day / horizonDays)
    gain: { priorSd: 5, horizonDays: 28 },
    breakDays: 56, breakLoss: 0.45, runIn: 3,   // a gap of > 56 days restarts the run-in (3 occasions before words)
    milestones: { days: [14, 28], every: 28 },  // then 56, 84, …
    bars: { 14: 0.975 }, bar: 0.95,             // P(D > 0) for "likely gain" at a milestone
    none: { margin: 0.2, p: 0.90, fromDay: 56 },
    range: 0.90,                                // the meter's range
    // alphaSd: a weak prior on each probe's level, N(the probe's centre (opts.center, else 0), (alphaSd·σ)²),
    // so a level never drifts onto the guessing floor; flat: the precision used for the gains (a flat prior)
    fit: { lapse: 0.03, maxIter: 40, tol: 1e-5, minInfo: 1e-4, startSd: 2, alphaSd: 3, flat: 1e-8 },
    // Items scored by cells: tau, the SD (logits) of a pattern's own ease shared by its cells. 1.5 is the cautious
    // end of the simulated range (0.5–1.5): with it the claimed information never exceeds what the scores carry by
    // more than version 1's exact score does (docs/dev/v1.2/measure-sim.md §12); pooled data can set it.
    cells: { tau: 1.5 },
  };

  function deepCopy(x) {
    if (isArray(x)) return x.map(deepCopy);
    if (x && typeof x === 'object') { var o = {}; for (var k in x) if (hasOwn.call(x, k)) o[k] = deepCopy(x[k]); return o; }
    return x;
  }
  function isPlain(x) { return !!x && typeof x === 'object' && !isArray(x); }
  function mergeInto(dst, src) {
    for (var k in src) {
      if (!hasOwn.call(src, k)) continue;
      if (isPlain(src[k]) && isPlain(dst[k])) mergeInto(dst[k], src[k]);
      else dst[k] = deepCopy(src[k]);
    }
    return dst;
  }
  var config = deepCopy(DEFAULTS);
  function configure(patch) {
    if (patch === 'reset') {
      for (var k in config) if (hasOwn.call(config, k)) delete config[k];
      mergeInto(config, DEFAULTS);
    } else if (isPlain(patch)) mergeInto(config, patch);
    return config;
  }

  /* ---------- small numerics ---------- */

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function sig(x) { if (x >= 0) return 1 / (1 + mexp(-x)); var e = mexp(x); return e / (1 + e); }
  function Phi(x) { // standard normal CDF (erfc by Numerical Recipes' Chebyshev fit, |error| < 1.2e-7)
    var z = mabs(x) / Math.SQRT2, t = 1 / (1 + 0.5 * z);
    var r = t * mexp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
      t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? 1 - r / 2 : r / 2;
  }
  function zOf(p) { // inverse normal CDF (Acklam), for the meter's range
    var a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
    var b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    var c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    var d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    var q, r;
    if (p < 0.02425) { q = msqrt(-2 * mlog(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - 0.02425) { q = msqrt(-2 * mlog(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function zeros(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = 0; return a; }
  function zeroMat(n) { var m = new Array(n); for (var i = 0; i < n; i++) m[i] = zeros(n); return m; }
  // Inverse of a symmetric positive definite matrix by Cholesky; null when it is not positive definite.
  function spdInverse(A) {
    var n = A.length, L = zeroMat(n), i, j, k, s;
    for (i = 0; i < n; i++) {
      for (j = 0; j <= i; j++) {
        s = A[i][j];
        for (k = 0; k < j; k++) s -= L[i][k] * L[j][k];
        if (i === j) { if (!(s > 0)) return null; L[i][i] = msqrt(s); } else L[i][j] = s / L[j][j];
      }
    }
    var Li = zeroMat(n); // inverse of L (lower triangular)
    for (i = 0; i < n; i++) {
      Li[i][i] = 1 / L[i][i];
      for (j = 0; j < i; j++) {
        s = 0;
        for (k = j; k < i; k++) s -= L[i][k] * Li[k][j];
        Li[i][j] = s / L[i][i];
      }
    }
    var X = zeroMat(n); // A⁻¹ = Liᵀ Li
    for (i = 0; i < n; i++) for (j = 0; j <= i; j++) {
      s = 0;
      for (k = i; k < n; k++) s += Li[k][i] * Li[k][j];
      X[i][j] = X[j][i] = s;
    }
    return X;
  }
  function matVec(A, x) { var n = A.length, y = zeros(n); for (var i = 0; i < n; i++) { var s = 0, r = A[i]; for (var j = 0; j < n; j++) s += r[j] * x[j]; y[i] = s; } return y; }

  /* ---------- familiarity bookkeeping ---------- */

  function familiarity(n, lambda) { return 1 - mexp(-n / (lambda || config.fam.lambda)); }
  // A long break: familiarity keeps (1 − loss) of what it had, on the fast curve and the tail alike.
  function afterBreak(st, loss, lambda) {
    var lam = lambda || config.fam.lambda, keep = 1 - (isNum(loss) ? loss : config.breakLoss);
    var f = familiarity(st.n, lam) * keep;
    return { n: f > 0 ? -lam * mlog(1 - f) : 0, nt: st.nt * keep };
  }
  function phiBar(n, m, lam) { var s = 0; for (var k = 0; k < m; k++) s += 1 - mexp(-(n + k) / lam); return s / m; }

  /* ---------- the input ---------- */

  // A probe key may carry its version, 'cubematch@2': each version is its own probe in the fit (its own
  // level and familiarity; versions never mix), while rung and SD come from the id.
  function baseId(key) { var i = key.indexOf('@'); return i > 0 ? key.slice(0, i) : key; }
  function rungOf(key) {
    var id = baseId(key), r = config.probes[id];
    return typeof r === 'string' ? r : 'alone:' + id; // unknown probes: their own gain, outside the composite
  }
  function sdOf(key) { var id = baseId(key), v = config.sd.byProbe && config.sd.byProbe[id]; return isNum(v) && v > 0 ? v : config.sd.logits; }

  function itemsOk(items) {
    if (!isArray(items) || !items.length) return false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!isArray(it) || !isNum(it[0]) || !isNum(it[1]) || it[1] < 0 || it[1] >= 1) return false;
      if (it[5] !== undefined && it[5] !== null && typeof it[5] === 'object' && !cellsOf(it)) return false;
    }
    return true;
  }

  /* ---------- items scored by cells (header; docs/dev/v1.2/measure-sim.md §12) ---------- */

  // u ~ N(0, tau²) by a 17-point rule on z ∈ [−4, 4]: the integrands are smooth, and the error is far below the
  // model's own uncertainty
  var CZ = [], CW = [];
  (function () {
    var i, t = 0;
    for (i = 0; i <= 16; i++) { var z = -4 + 0.5 * i; CZ.push(z); CW.push(mexp(-z * z / 2)); t += CW[i]; }
    for (i = 0; i < CW.length; i++) CW[i] /= t;
  })();
  function softplus(x) { return x > 0 ? x + mlog(1 + mexp(-x)) : mlog(1 + mexp(x)); }
  function isCount(x, lo, hi) { return typeof x === 'number' && x === mfloor(x) && x >= lo && x <= hi; }
  // An item's cells, { k, s } (k from 1 to 64; s from 0 to k), or null
  function cellsOf(it) {
    var c = it && it[5];
    return c && typeof c === 'object' && isCount(c.k, 1, 64) && isCount(c.s, 0, c.k) ? c : null;
  }
  var DELTA = {}, LOGC = {}, INFO = {};
  // Δ(k, tau): the offset that makes E_u[σ(Δ + u)^k] = ½, so the whole pattern is recalled half the time at θ = b
  function cellDelta(k, tau) {
    var key = k + ':' + tau;
    if (hasOwn.call(DELTA, key)) return DELTA[key];
    var lo = -4, hi = 16;
    for (var it = 0; it < 60; it++) {
      var m = (lo + hi) / 2, p = 0;
      for (var j = 0; j < CZ.length; j++) p += CW[j] * mexp(-k * softplus(-(m + tau * CZ[j])));
      if (p < 0.5) lo = m; else hi = m;
    }
    return (DELTA[key] = (lo + hi) / 2);
  }
  function logChoose(k) {
    if (hasOwn.call(LOGC, k)) return LOGC[k];
    var out = [0], acc = 0;
    for (var s = 1; s <= k; s++) { acc += mlog(k - s + 1) - mlog(s); out.push(acc); }
    return (LOGC[k] = out);
  }
  // P(s) and dP(s)/dθ for one s, at x = θ − b (lapse included)
  function cellPD(x, k, s, tau, lapse) {
    var d = cellDelta(k, tau), lc = logChoose(k)[s], P = 0, D = 0;
    for (var j = 0; j < CZ.length; j++) {
      var e = x + d + tau * CZ[j], f = mexp(lc - s * softplus(-e) - (k - s) * softplus(e));
      P += CW[j] * f; D += CW[j] * f * (s - k * sig(e));
    }
    return { P: (1 - lapse) * P + lapse / (k + 1), D: (1 - lapse) * D };
  }
  // The expected information Σ_s D(s)² / P(s) at x = θ − b, every s at once (one pass over the 17 points)
  function cellInfoAt(x, k, tau, lapse) {
    var d = cellDelta(k, tau), lc = logChoose(k), P = zeros(k + 1), D = zeros(k + 1), s, v = 0;
    for (var j = 0; j < CZ.length; j++) {
      var e = x + d + tau * CZ[j], lp = -softplus(-e), lq = -softplus(e), p = sig(e);
      for (s = 0; s <= k; s++) { var f = CW[j] * mexp(lc[s] + s * lp + (k - s) * lq); P[s] += f; D[s] += f * (s - k * p); }
    }
    for (s = 0; s <= k; s++) {
      var Ps = (1 - lapse) * P[s] + lapse / (k + 1), Ds = (1 - lapse) * D[s];
      if (Ps > 0) v += Ds * Ds / Ps;
    }
    return v;
  }
  // … as a table per (k, tau, lapse) on a 0.1 grid over [−10, 10] (beyond it the information is nil), built the first
  // time it is needed (201 places), read by linear interpolation
  function cellInfo(x, k, tau, lapse) {
    var key = k + ':' + tau + ':' + lapse, tab = hasOwn.call(INFO, key) ? INFO[key] : null, i;
    if (!tab) {
      tab = [];
      for (i = 0; i <= 200; i++) tab.push(cellInfoAt(-10 + i * 0.1, k, tau, lapse));
      INFO[key] = tab;
    }
    var t = (mmin(10, mmax(-10, x)) + 10) / 0.1, i0 = mmin(199, mfloor(t)), w = t - i0;
    return tab[i0] * (1 - w) + tab[i0 + 1] * w;
  }
  function cellLogp(theta, b, k, s) {
    var pd = cellPD(theta - b, k, s, config.cells.tau, config.fit.lapse);
    return mlog(mmax(pd.P, 1e-300));
  }
  function cellSI(eta, b, k, s) {
    var tau = config.cells.tau, lapse = config.fit.lapse, pd = cellPD(eta - b, k, s, tau, lapse);
    return { S: pd.P > 0 ? pd.D / pd.P : 0, I: cellInfo(eta - b, k, tau, lapse) };
  }
  // One item's score and expected information at eta: an exact (right or wrong) item, or one scored by cells
  function itemSI(it, eta) {
    var c = cellsOf(it);
    if (c) return cellSI(eta, it[0], c.k, c.s);
    var lapse = config.fit.lapse, b = it[0], g = it[1], ok = it[2] ? 1 : 0, a = isNum(it[4]) && it[4] > 0 ? it[4] : 1;
    var sg = sig(a * (eta - b)), top = 1 - g - lapse, p = g + top * sg;
    if (p < 1e-9) p = 1e-9; else if (p > 1 - 1e-9) p = 1 - 1e-9;
    var dp = top * a * sg * (1 - sg), w = dp / (p * (1 - p));
    return { S: (ok - p) * w, I: dp * w };
  }

  // Occasions sorted by time, with valid blocks only; returns [{ t, h, blocks: [{ probe, items | y, v, n }] }].
  function normalise(input) {
    var occ = (input && isArray(input.occasions) ? input.occasions : []).filter(function (o) { return o && isNum(o.t); });
    occ = occ.map(function (o, i) { return { o: o, i: i }; }).sort(function (a, b) { return a.o.t - b.o.t || a.i - b.i; }).map(function (x) { return x.o; });
    var out = [];
    occ.forEach(function (o) {
      var blocks = (isArray(o.blocks) ? o.blocks : []).filter(function (b) {
        if (!b || typeof b.probe !== 'string') return false;
        if (b.items !== undefined) return itemsOk(b.items);
        return isNum(b.y) && isNum(b.v) && b.v > 0 && isNum(b.n) && b.n >= 1;
      });
      if (blocks.length) out.push({ t: o.t, h: o.h, kind: o.kind, blocks: blocks });
    });
    return out;
  }

  // The parameter layout and every block's covariates; also the exposure state after the last occasion.
  function design(occ) {
    var C = config, lam = C.fam.lambda, per = C.tail.per;
    var probes = [], seen = {};
    occ.forEach(function (o) { o.blocks.forEach(function (b) { if (!seen[b.probe]) { seen[b.probe] = true; probes.push(b.probe); } }); });
    var idx = {}, P = 0, names = [];
    function add(name) { idx[name] = P++; names.push(name); }
    probes.forEach(function (id) { add('a:' + id); });
    probes.forEach(function (id) { add('F:' + id); });
    var spatial = probes.filter(function (id) { return rungOf(id) !== 'control'; });
    var controls = probes.filter(function (id) { return rungOf(id) === 'control'; });
    if (spatial.length) add('T');
    if (controls.length) add('Tc');
    var rungs = [];
    spatial.forEach(function (id) { var r = rungOf(id); if (rungs.indexOf(r) < 0) rungs.push(r); });
    rungs.forEach(function (r) { add('G:' + r); });

    var t0 = occ[0].t, st = {}, segStart = 0, segments = [0], blocks = [];
    probes.forEach(function (id) { st[id] = { n: 0, nt: 0, items: 0 }; });
    occ.forEach(function (o, j) {
      if (j > 0 && o.t - occ[j - 1].t > C.breakDays * DAY) {
        probes.forEach(function (id) { var s = afterBreak(st[id], C.breakLoss, lam); st[id].n = s.n; st[id].nt = s.nt; });
        segStart = j; segments.push(j);
      }
      var day = (o.t - t0) / DAY;
      var h = isNum(o.h) ? o.h : mmin(1, mmax(0, day / C.gain.horizonDays));
      o.blocks.forEach(function (b) {
        var id = b.probe, s = st[id], m = b.items ? b.items.length : b.n, sd = sdOf(id), r = rungOf(id), ctl = r === 'control';
        var xi = [idx['a:' + id], idx['F:' + id], idx[ctl ? 'Tc' : 'T']], xv = [1, sd * phiBar(s.n, m, lam), sd * (s.nt + (m - 1) / 2) / per];
        if (!ctl) { xi.push(idx['G:' + r]); xv.push(sd * h); }
        blocks.push({ j: j, probe: id, sd: sd, xi: xi, xv: xv, items: b.items || null, y: b.y, v: b.v, m: m, day: day, h: h });
        s.n += m; s.nt += m; s.items += m;
      });
    });
    return { probes: probes, spatial: spatial, controls: controls, rungs: rungs, idx: idx, names: names, P: P, blocks: blocks,
      t0: t0, segStart: segStart, segments: segments, state: st, nOcc: occ.length };
  }

  // The prior: mean vector and precision (α weak, G flat unless gain.priorSd > 0).
  function prior(D, centers) {
    var C = config, P = D.P, mu = zeros(P), cov = zeroMat(P), i, j, flat = 1 / C.fit.flat;
    D.probes.forEach(function (id) {
      var ia = D.idx['a:' + id], sa = C.fit.alphaSd * sdOf(id);
      mu[ia] = centers && isNum(centers[id]) ? centers[id] : 0;
      cov[ia][ia] = sa > 0 ? sa * sa : flat;
    });
    var famIds = D.probes, fs = C.fam.sd;
    famIds.forEach(function (a) {
      var ia = D.idx['F:' + a], ca = rungOf(a) === 'control';
      mu[ia] = ca ? C.fam.control : C.fam.plateau;
      famIds.forEach(function (b) {
        var ib = D.idx['F:' + b], cb = rungOf(b) === 'control';
        cov[ia][ib] = fs * fs * (a === b ? 1 : ca !== cb ? C.fam.corrControl : C.fam.corr);
      });
    });
    var ts = mmax(C.tail.sd, 1e-4);
    if (hasOwn.call(D.idx, 'T')) { mu[D.idx.T] = C.tail.spatial; cov[D.idx.T][D.idx.T] = ts * ts; }
    if (hasOwn.call(D.idx, 'Tc')) { mu[D.idx.Tc] = C.tail.control; cov[D.idx.Tc][D.idx.Tc] = ts * ts; }
    if (hasOwn.call(D.idx, 'T') && hasOwn.call(D.idx, 'Tc')) cov[D.idx.T][D.idx.Tc] = cov[D.idx.Tc][D.idx.T] = C.tail.corr * ts * ts;
    D.rungs.forEach(function (r) { var g = D.idx['G:' + r]; cov[g][g] = C.gain.priorSd > 0 ? C.gain.priorSd * C.gain.priorSd : flat; });
    // the covariance is block diagonal: invert the F/T block, the rest is diagonal
    var block = [];
    for (i = 0; i < P; i++) { var off = false; for (j = 0; j < P; j++) if (j !== i && cov[i][j] !== 0) off = true; if (off) block.push(i); }
    var prec = zeroMat(P);
    for (i = 0; i < P; i++) if (block.indexOf(i) < 0) prec[i][i] = 1 / cov[i][i];
    if (block.length) {
      var sub = block.map(function (a) { return block.map(function (b) { return cov[a][b]; }); }), inv = spdInverse(sub);
      if (!inv) throw new Error('trend: the familiarity prior is not positive definite (check config.fam and config.tail)');
      block.forEach(function (a, x) { block.forEach(function (b, y) { prec[a][b] = inv[x][y]; }); });
    }
    return { mu: mu, prec: prec, pmu: matVec(prec, mu) };
  }

  /* ---------- the fit ---------- */

  // A block's working observation at the linearisation point eta: y* = eta + S/I, v = 1/I.
  function linearise(items, eta) {
    var S = 0, I = 0;
    for (var k = 0; k < items.length; k++) { var si = itemSI(items[k], eta); S += si.S; I += si.I; }
    if (I < config.fit.minInfo) I = config.fit.minInfo;
    return { y: eta + S / I, v: 1 / I };
  }
  // A start for a block's linearisation point: its own posterior mode under N(center, startSd²).
  function startEta(items, center) {
    var sd2 = config.fit.startSd * config.fit.startSd, th = center;
    for (var it = 0; it < 20; it++) {
      var gr = -(th - center) / sd2, inf = 1 / sd2;
      for (var k = 0; k < items.length; k++) { var si = itemSI(items[k], th); gr += si.S; inf += si.I; }
      var step = gr / inf;
      if (step > 2) step = 2; else if (step < -2) step = -2;
      th += step;
      if (mabs(step) < 1e-7) break;
    }
    return th;
  }

  function fit(input, opts) {
    opts = opts || {};
    var occ = isArray(input) ? input : normalise(input);
    if (!occ.length) return { ok: false, why: 'no measurement yet' };
    var C = config, D = design(occ), P = D.P, B = D.blocks, pr = prior(D, opts.center);
    var su = C.state.total * msqrt(C.state.shared), ss = C.state.total * msqrt(1 - C.state.shared);
    var su2 = su * su, ss2 = ss * ss;

    // linearisation points: a warm start for the blocks an earlier fit saw, else each block's own mode
    var eta = new Array(B.length), centers = {}, warm = isArray(opts.eta) ? opts.eta : [];
    B.forEach(function (bl, k) {
      if (!bl.items) { eta[k] = bl.y; return; }
      if (isNum(warm[k])) eta[k] = warm[k];
      else {
        var c = isNum(centers[bl.probe]) ? centers[bl.probe] : opts.center && isNum(opts.center[bl.probe]) ? opts.center[bl.probe] : 0;
        eta[k] = startEta(bl.items, c);
      }
      centers[bl.probe] = eta[k];
    });

    // occasions → their blocks
    var byOcc = [];
    B.forEach(function (bl, k) { (byOcc[bl.j] = byOcc[bl.j] || []).push(k); });

    // Fisher scoring on the joint posterior mode of (β, states): each step linearises the item blocks at
    // eta, solves the GLS with the states integrated out (V is the Laplace covariance of β), predicts the
    // states (BLUP), and halves the step while the joint log posterior falls (monotone ascent; plain
    // iteration can cycle when a block sits on the guessing floor, where its information vanishes).
    var beta = null, us = null, sts = null, V = null, ys = new Array(B.length), vs = new Array(B.length), iter = 0, converged = false, change = 0, J = -Infinity;
    for (iter = 1; iter <= C.fit.maxIter; iter++) {
      B.forEach(function (bl, k) {
        if (bl.items) { var w = linearise(bl.items, eta[k]); ys[k] = w.y; vs[k] = w.v; } else { ys[k] = bl.y; vs[k] = bl.v; }
      });
      var Q = pr.prec.map(function (r) { return r.slice(); }), rhs = pr.pmu.slice();
      for (var j = 0; j < byOcc.length; j++) if (byOcc[j]) accumulate(Q, rhs, byOcc[j], B, ys, vs, su2, ss2);
      var Vn = spdInverse(Q);
      if (!Vn) return { ok: false, why: 'the trend model could not be solved' };
      var bn = matVec(Vn, rhs), un = new Array(byOcc.length), sn = new Array(B.length);
      for (var jj = 0; jj < byOcc.length; jj++) {
        if (!byOcc[jj]) continue;
        var st = blup(byOcc[jj], B, ys, vs, bn, su2, ss2);
        un[jj] = st.u;
        byOcc[jj].forEach(function (k, x) { sn[k] = st.s[x]; });
      }
      var Jn = objective(B, byOcc, bn, un, sn, pr, su2, ss2);
      if (beta && Jn < J - 1e-9) { // halve the step towards the new point until the objective rises
        var b0 = bn, u0 = un, s0 = sn, om = 1;
        for (var h = 0; h < 30 && Jn < J - 1e-9; h++) {
          om /= 2;
          bn = mix(beta, b0, om); un = mix(us, u0, om); sn = mix(sts, s0, om);
          Jn = objective(B, byOcc, bn, un, sn, pr, su2, ss2);
        }
        if (Jn < J - 1e-9) { bn = beta; un = us; sn = sts; Jn = J; } // no ascent left: stay
      }
      change = 0;
      B.forEach(function (bl, k) {
        if (!bl.items) return;
        var e = fixedPart(bl, bn) + bl.sd * (un[bl.j] || 0) + (sn[k] || 0);
        if (mabs(e - eta[k]) > change) change = mabs(e - eta[k]);
        eta[k] = e;
      });
      var rise = Jn - J;
      beta = bn; us = un; sts = sn; J = Jn; V = Vn;
      // done when the points stop moving, or when the joint log posterior stops rising (a block on the
      // guessing floor can creep along its flat likelihood for many steps without changing any readout)
      if (change < C.fit.tol || (iter > 3 && rise < 1e-9 * mmax(1, mabs(Jn)))) { converged = true; break; }
    }
    if (iter > C.fit.maxIter) iter = C.fit.maxIter;

    var last = occ[occ.length - 1], day = (last.t - D.t0) / DAY;
    var hNow = isNum(opts.hNow) ? opts.hNow : lastH(B);
    var gain = readouts(D, beta, V, hNow);
    var segOcc = D.nOcc - D.segStart;
    return {
      ok: true, day: day, t0: D.t0, t: last.t, hNow: hNow, gain: gain, meter: gain.comp ? gain.comp.p : null,
      segment: { start: occ[D.segStart].t, index: D.segStart, occasions: segOcc, breaks: D.segments.length - 1, runInDone: segOcc >= C.runIn },
      eta: eta, beta: beta, cov: V, index: D.idx, names: D.names, probes: D.probes, rungs: D.rungs,
      iterations: iter, converged: converged, blocks: B.length, exposure: D.state, design: D,
    };
  }

  function lastH(B) { return B.length ? B[B.length - 1].h : 0; }

  function fixedPart(bl, beta) { var s = 0; for (var i = 0; i < bl.xi.length; i++) s += beta[bl.xi[i]] * bl.xv[i]; return s; }

  // One occasion's rows into the information matrix: R = diag(v + ss²σ²) + su²·σσᵀ, inverted by Sherman–Morrison.
  function accumulate(Q, rhs, ks, B, ys, vs, su2, ss2) {
    var n = ks.length, dinv = new Array(n), A = 0, x, i, a, b2;
    for (x = 0; x < n; x++) { var bl = B[ks[x]]; dinv[x] = 1 / (vs[ks[x]] + ss2 * bl.sd * bl.sd); A += dinv[x] * bl.sd * bl.sd; }
    var c = su2 / (1 + su2 * A), w = {}, wy = 0, keys = [];
    for (x = 0; x < n; x++) {
      var k = ks[x], B1 = B[k], d = dinv[x], y = ys[k], f = d * B1.sd;
      wy += f * y;
      for (i = 0; i < B1.xi.length; i++) {
        a = B1.xi[i];
        var xa = B1.xv[i];
        if (!hasOwn.call(w, a)) { w[a] = 0; keys.push(a); }
        w[a] += f * xa;
        rhs[a] += d * xa * y;
        for (b2 = 0; b2 < B1.xi.length; b2++) Q[a][B1.xi[b2]] += d * xa * B1.xv[b2];
      }
    }
    for (i = 0; i < keys.length; i++) {
      a = keys[i];
      rhs[a] -= c * w[a] * wy;
      for (var q = 0; q < keys.length; q++) Q[a][keys[q]] -= c * w[a] * w[keys[q]];
    }
  }

  // The predicted states of one occasion given beta: u (shared, SD units) and s per block (logits);
  // a block's state in logits is σ·u + s.
  function blup(ks, B, ys, vs, beta, su2, ss2) {
    var n = ks.length, dinv = new Array(n), r = new Array(n), A = 0, Sr = 0, x;
    for (x = 0; x < n; x++) {
      var bl = B[ks[x]];
      dinv[x] = 1 / (vs[ks[x]] + ss2 * bl.sd * bl.sd);
      r[x] = ys[ks[x]] - fixedPart(bl, beta);
      A += dinv[x] * bl.sd * bl.sd; Sr += dinv[x] * bl.sd * r[x];
    }
    var c = su2 / (1 + su2 * A), q = new Array(n), sq = 0;
    for (x = 0; x < n; x++) { q[x] = dinv[x] * r[x] - c * dinv[x] * B[ks[x]].sd * Sr; sq += B[ks[x]].sd * q[x]; }
    var s = new Array(n);
    for (x = 0; x < n; x++) { var sd = B[ks[x]].sd; s[x] = ss2 * sd * sd * q[x]; }
    return { u: su2 * sq, s: s };
  }

  function mix(a, b, w) { var o = new Array(a.length); for (var i = 0; i < a.length; i++) o[i] = a[i] === undefined ? b[i] : a[i] + w * (b[i] - a[i]); return o; }

  // The joint log posterior of (β, states) up to a constant: item log-likelihoods (summaries as Gaussians)
  // plus the state and parameter priors.
  function objective(B, byOcc, beta, u, s, pr, su2, ss2) {
    var J = 0, lapse = config.fit.lapse, k, i;
    for (k = 0; k < B.length; k++) {
      var bl = B[k], eta = fixedPart(bl, beta) + bl.sd * (u[bl.j] || 0) + (s[k] || 0);
      if (bl.items) {
        for (i = 0; i < bl.items.length; i++) {
          var it = bl.items[i], a = isNum(it[4]) && it[4] > 0 ? it[4] : 1, p = it[1] + (1 - it[1] - lapse) * sig(a * (eta - it[0]));
          p = mmin(1 - 1e-12, mmax(1e-12, p));
          J += it[2] ? mlog(p) : mlog(1 - p);
        }
      } else J -= 0.5 * (bl.y - eta) * (bl.y - eta) / bl.v;
      if (ss2 > 0) J -= 0.5 * (s[k] || 0) * (s[k] || 0) / (ss2 * bl.sd * bl.sd);
    }
    if (su2 > 0) for (var j = 0; j < byOcc.length; j++) if (byOcc[j]) J -= 0.5 * (u[j] || 0) * (u[j] || 0) / su2;
    var d = beta.map(function (b, x) { return b - pr.mu[x]; }), Pd = matVec(pr.prec, d);
    for (i = 0; i < d.length; i++) J -= 0.5 * d[i] * Pd[i];
    return J;
  }

  /* ---------- readouts: the composite and each rung ---------- */

  // SD of an equally weighted mean of probes with between-probe correlation rho, in per-probe SD units.
  function compFactor(w) {
    var s2 = 0, s1 = 0;
    for (var i = 0; i < w.length; i++) { s2 += w[i] * w[i]; s1 += w[i]; }
    return msqrt((1 - config.rho) * s2 + config.rho * s1 * s1);
  }

  function readout(D, beta, V, hNow, members) {
    // members: [{ id, w }] (probe ids, each once, Σw = 1); the gain to date in per-probe SD units is
    // Σ w·G_rung(id)·h(now), in probe points (logits) Σ w·σ_id·G_rung(id)·h(now)
    var g = {}, gl = {};
    members.forEach(function (m) {
      var k = D.idx['G:' + rungOf(m.id)];
      g[k] = (g[k] || 0) + m.w;
      gl[k] = (gl[k] || 0) + m.w * sdOf(m.id);
    });
    var keys = Object.keys(g).map(Number), mean = 0, v = 0, ml = 0, vl = 0;
    keys.forEach(function (a) {
      mean += g[a] * beta[a]; ml += gl[a] * beta[a];
      keys.forEach(function (b) { v += g[a] * g[b] * V[a][b]; vl += gl[a] * gl[b] * V[a][b]; });
    });
    mean *= hNow; v *= hNow * hNow; ml *= hNow; vl *= hNow * hNow;
    var f = compFactor(members.map(function (m) { return m.w; })), sd = msqrt(mmax(v, 0)), sl = msqrt(mmax(vl, 0));
    var C = config, z = zOf(0.5 + C.range / 2), mu = mean / f, s = sd / f;
    // with no spread (no training yet, h = 0) the meter reads one half, not a certainty either way
    var p = s > 0 ? Phi(mu / s) : mu > 0 ? 1 : mu < 0 ? 0 : 0.5, pNone = s > 0 ? Phi((C.none.margin - mu) / s) : mu < C.none.margin ? 1 : 0;
    return { mean: mu, sd: s, p: p, pNone: pNone, lo: mu - z * s, hi: mu + z * s, logits: ml, sdUnit: f,
      pts: { mean: ml, sd: sl, lo: ml - z * sl, hi: ml + z * sl }, probes: members.map(function (m) { return m.id; }) };
  }

  // The probe ids (versions folded) of the spatial probes that pass a test, each once, in order.
  function idsWhere(D, test) {
    var out = [];
    D.spatial.forEach(function (key) { var id = baseId(key); if (test(key) && out.indexOf(id) < 0) out.push(id); });
    return out;
  }

  function readouts(D, beta, V, hNow) {
    var C = config, out = {}, comp = [];
    var inComp = idsWhere(D, function (key) { return C.composite.rungs.indexOf(rungOf(key)) >= 0; });
    if (inComp.length) {
      if (C.composite.weights === 'rung') {
        var rs = [];
        inComp.forEach(function (id) { var r = rungOf(id); if (rs.indexOf(r) < 0) rs.push(r); });
        inComp.forEach(function (id) {
          var r = rungOf(id), n = inComp.filter(function (x) { return rungOf(x) === r; }).length;
          comp.push({ id: id, w: 1 / (rs.length * n) });
        });
      } else inComp.forEach(function (id) { comp.push({ id: id, w: 1 / inComp.length }); });
      out.comp = readout(D, beta, V, hNow, comp);
    } else out.comp = null;
    D.rungs.forEach(function (r) {
      var ids = idsWhere(D, function (key) { return rungOf(key) === r; });
      out[r] = readout(D, beta, V, hNow, ids.map(function (id) { return { id: id, w: 1 / ids.length }; }));
    });
    return out;
  }

  /* ---------- milestones and verdicts ---------- */

  // The latest milestone reached on `day` (days since the first occasion), or null before the first.
  function milestoneAt(day) {
    var M = config.milestones, list = M.days, i = 0, at;
    if (!isNum(day) || !list.length || day < list[0]) return null;
    while (i + 1 < list.length && day >= list[i + 1]) i++;
    at = list[i];
    if (i === list.length - 1 && M.every > 0) { var extra = mfloor((day - at) / M.every); i += extra; at += extra * M.every; }
    var bar = hasOwn.call(config.bars, String(at)) ? config.bars[at] : config.bar;
    return { index: i, day: at, bar: bar, none: at >= config.none.fromDay };
  }

  function verdict(f, m, which) {
    var g = f && f.ok && f.gain ? f.gain[which || 'comp'] : null;
    if (!g || !m) return null;
    if (g.p >= m.bar) return 'likely gain';
    if (m.none && g.pNone >= config.none.p) return 'likely no change';
    return 'unclear yet';
  }

  // Walks the occasions in order: a fit after each (the meter) and the verdict words at each milestone,
  // computed once at the first occasion on or after it (and after the run-in of the current segment).
  function track(input, opts) {
    opts = opts || {};
    var occ = normalise(input), out = [], eta = null, done = -1, readoutsWanted = opts.readouts || ['comp'];
    for (var j = 0; j < occ.length; j++) {
      var f = fit(occ.slice(0, j + 1), { eta: eta, center: opts.center });
      if (!f.ok) { out.push({ ok: false }); continue; }
      eta = f.eta;
      var m = milestoneAt(f.day), v = null;
      if (m && m.index > done && f.segment.runInDone) {
        done = m.index;
        v = { milestone: m.day, bar: m.bar };
        readoutsWanted.forEach(function (r) { v[r] = verdict(f, m, r); });
      }
      out.push({ ok: true, day: f.day, t: f.t, meter: f.meter, gain: f.gain, verdict: v, fit: opts.keepFits ? f : undefined });
    }
    return out;
  }

  // The probe's expected ability at its next block (logits), for item targeting.
  function predict(f, probe, h, t) {
    if (!f || !f.ok) return null;
    var D = f.design, id = probe;
    if (!hasOwn.call(D.idx, 'a:' + id)) return null;
    var s = D.state[id], sd = sdOf(id), r = rungOf(id), ctl = r === 'control', lam = config.fam.lambda;
    if (isNum(t) && t - f.t > config.breakDays * DAY) s = afterBreak(s, config.breakLoss, lam);
    var hh = isNum(h) ? h : f.hNow;
    var xi = [D.idx['a:' + id], D.idx['F:' + id], D.idx[ctl ? 'Tc' : 'T']], xv = [1, sd * familiarity(s.n, lam), sd * s.nt / config.tail.per];
    if (!ctl) { xi.push(D.idx['G:' + r]); xv.push(sd * hh); }
    var mean = 0, v = 0, a, b;
    for (a = 0; a < xi.length; a++) { mean += f.beta[xi[a]] * xv[a]; for (b = 0; b < xi.length; b++) v += xv[a] * xv[b] * f.cov[xi[a]][xi[b]]; }
    return { mean: mean, sd: msqrt(mmax(v, 0) + config.state.total * config.state.total * sd * sd) };
  }

  E.trend = {
    DEFAULTS: DEFAULTS, config: config, configure: configure,
    fit: fit, track: track, predict: predict, milestoneAt: milestoneAt, verdict: verdict,
    familiarity: familiarity, afterBreak: afterBreak, normalise: normalise,
    baseId: baseId,
    cells: { logp: cellLogp, si: cellSI, delta: cellDelta, of: cellsOf },
    _: { Phi: Phi, zOf: zOf, spdInverse: spdInverse, linearise: linearise, design: design, prior: prior, compFactor: compFactor, cellPD: cellPD, cellInfo: cellInfo, cellInfoAt: cellInfoAt },
  };
})(window.PX);
