/* PX.engine.plateau: stall detection and plateau-breaking (PLAN milestone 3; note P1 §2–§3;
   docs/dev/CONTRACT-v1.2.md P and Q; docs/dev/ENGINE.md §20). Pure like the rest of the engine:
   every call takes the record and `now`; randomness comes from PX.rng with a logged seed.

   Detector (note P1 §2.4). After a Train or Path session with at least 10 rated answers on an
   exercise, its last 640 rated answers (per display class where the exercise keeps a rating per
   class; Train and Path rows with outcome 0 or 1, no Speed deadline, no fluency item) are fitted by
   maximum likelihood (Fisher scoring; weak priors a ~ N(μ, 2²), β ~ N(0, 1²), γ ~ N(0, 1²)):
       P(right_i) = g_i + (1 − g_i − 0.03) · σ(a + β·u_i + γ·switch_i − b_i)
   b_i is the difficulty the rating used (the params' difficulty plus a logged person offset), g_i
   the guessing rate, u_i = (index − window mean) / 100, switch_i = 1 when the row before it in the
   same session is another exercise. β is the slope in logits per 100 rated answers; its SE comes
   from the Fisher information inflated by √φ, φ ≥ 1 the between-session over-dispersion (Pearson
   χ² of the sessions' level scores over its degrees of freedom). A stall fires when
   β + 1.645·SE < 0.15.
   Preconditions: 640 answers in the window, ≥ 8 sessions on ≥ 8 local days, no gap of more than
   14 days (the window restarts after one), nothing from an older version of the exercise or from
   before the end of its last plateau event, no change in its trial period. At the pool's ceiling
   (the rating predicts more than the target on the hardest settings) there is no plateau: a full
   window there makes a 'ceiling' event ("top of the range"), whatever its slope.
   Response-time channel (it classifies, never fires): the log time of right answers without a
   deadline on [1, u, b − fitted ability, switch]; when it falls by more than 10 % per 100 answers
   with 95 % confidence, the stall is a 'faster' event (Speed suggested), not a plateau.
   Changes (note P1 §3.9–3.10): rows 1–4 answer their signal first; among the eligible rows 5–8 one
   is drawn with a logged seed; a change tried since the exercise's last "clearly up" is skipped
   while another is eligible. Each change runs a trial of 3 sessions and ≥ 120 rated answers (after
   the rest days, for a rest) and ends 'up' (the lower 95 % bound of the level difference > 0),
   'none' (its upper bound < 0.25 logit) or 'unclear'.

     detect(rec, def, opts, now) → { ready, why, fire, beta, se, n: [n0, n1], sessions, days, rt,
                                     ceiling, faster, disp, a, aSe, gamma, phi }
                                   why: 'trial' | 'answers' | 'break' | 'sessions' | 'days' | 'ceiling'
     signals(rec, def, det, now) → { '<signal id>': null | { change, detail, … }, tried: [ids] }
     choose(signals, rng)        → { row, reason, change, detail, eligible, drawn }
     active(rec, exId, now)      → the exercise's event in its trial period, or null
     card(rec, now)              → the event Today shows, or null
     list(rec, exId?)            → the record's events, oldest first
     finish(plan, rec, now, res) → the finish hook (order 20): follow-ups, then detection;
                                   res.plateau = { fired: [events], ended: [events] }
     progress(rec, ev, now)      → { resting, restUntil, sessions, answers, need, ended }: a trial so far
   At load it registers: modes hooks start (Speed inside Train), kind (drill items), pick (drill,
   aim higher, wider mix, variant swap, new variant) and finish; the schedule's exclude hook (rest
   days); a rebase converter (stored levels); the 'plateau' merge; the 'plateau' events source; the
   container's repair (E.record.check) once those modules exist. */
(function (PX) {
  'use strict';

  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;
  var U = PX.util;
  var E = PX.engine;
  var C = E.config;
  var M = E.model;
  var DAY = E.DAY;
  var mexp = Math.exp, mlog = Math.log, msqrt = Math.sqrt, mabs = Math.abs, mmin = Math.min, mmax = Math.max;
  var mfloor = Math.floor, mround = Math.round, mceil = Math.ceil;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }
  function sig(x) { if (x >= 0) return 1 / (1 + mexp(-x)); var e = mexp(x); return e / (1 + e); }
  function r3(x) { return isNum(x) ? mround(x * 1000) / 1000 : null; }

  /* ---------- defaults (ENGINE.md §20 gives the source of each) ---------- */

  var CFG = E.defaults('plateau', {
    window: 640, z: 1.645, delta: 0.15,             // a stall: β + z·SE < δ (logit per 100 rated answers)
    minAnswers: 10,                                  // evaluated after a session with ≥ 10 rated answers on it
    minSessions: 8, minDays: 8, maxGapDays: 14,      // the window's preconditions
    prior: { a: 2, beta: 1, gamma: 1 },              // prior SDs (a around the rating's μ, β and γ around 0)
    phiPrior: { df: 0, phi: 1 },                     // shrink φ towards phi with df pseudo-degrees of freedom (0: off)
    rt: { minRight: 60, faster: 0.10, z: 1.645 },    // 'faster': time −10 % per 100 answers, one-sided 95 %
    trial: { sessions: 3, answers: 120 },            // a change's trial period
    verdict: { z: 1.96, none: 0.25, skipFirst: true, minRest: 80, maxGapDays: 14 },
    signal: {
      trainShare: 0.5,                               // Train-only changes need half the window from Train
      switchMin: 20, switchGap: 0.05, switchZ: 2,    // row 1: answers right after a switch below prediction
      frontier: 0.15,                                // row 2: a weak level with an item this near the target
      slowRatio: 1.3, slowMin: 60,                   // row 3: median ≥ 1.3 × the fastest quartile (matched)
      declineGap: 0.05, declineZ: 2, declineMin: 20, // row 4: late-session answers below early ones
      massedAnswers: 60, massedTwice: 0.25, massedJump: 2,
      narrowShare: 0.8, topShare: 0.5, topMin: 12,   // row 6: one variant, low variability, few settings
      stretchMin: 15, stretchZ: 1.645, earlyQuits: 0.2, // row 7: stretch items beaten, few early quits
    },
    change: { restDays: 3.5, aimStep: 0.15, aimMin: 0.40, widerTol: 0.10, fluency: 0.3, drill: null },
    card: { days: 7 },                               // a verdict or a suggestion stays on Today this long
    keep: 300,                                       // events kept in the record (open trials always)
  });

  // Signal ids (rows 1–8 of note P1 §3.9) and change ids (CONTRACT-v1.2 P).
  var SIGNALS = ['switch-deficit', 'weak-frontier', 'slow-accurate', 'massed', 'strategy', 'narrow-mix', 'stretch-beaten', 'otherwise'];
  var CHANGES = ['stage-back', 'drill', 'speed-in-train', 'rest', 'other-strategy', 'wider-mix', 'variant-swap', 'aim-higher', 'stage-forward', 'new-variant'];
  var KINDS = ['plateau', 'ceiling', 'faster'];
  var WORDS = ['up', 'unclear', 'none'];

  /* ---------- trial rows (formats 1–4; CONTRACT-v1.2 N) ---------- */

  var LG = E.log || {};
  var COL = LG.COL || { t: 0, ex: 1, mode: 2, code: 3, seed: 4, outcome: 5, rt: 6, value: 7, pp: 8, stage: 9, display: 10, input: 11 };
  var C_KIND = isNum(COL.kind) ? COL.kind : 13, C_DL = isNum(COL.dl) ? COL.dl : 17, C_BOFF = isNum(COL.bOff) ? COL.bOff : 18;
  function codeIn(list, name, d) { var i = isArray(list) ? list.indexOf(name) : -1; return i > 0 ? i : d; }
  var K_FLUENCY = codeIn(LG.KINDS, 'fluency', 10), K_STRETCH = codeIn(LG.KINDS, 'stretch', 4), K_STRETCH1 = codeIn(LG.KINDS, 'stretch1', 5);
  var DL_PACE = codeIn(LG.DEADLINES, 'pace', 1);

  // The pool entry of a params code (b and g as the item model gives them), per definition.
  var codeCache = typeof WeakMap === 'function' ? new WeakMap() : null, codeById = Object.create(null);
  function byCode(def) {
    var hit = codeCache ? codeCache.get(def) : codeById[def.id];
    if (hit && hit.def === def) return hit.map;
    var map = Object.create(null);
    M.pool(def).forEach(function (c) { map[c.code] = c; });
    if (codeCache) codeCache.set(def, { def: def, map: map }); else codeById[def.id] = { def: def, map: map };
    return map;
  }

  // Sessions sorted by start: { a, b (seconds), start (ms), mode, ended, exs }.
  function sessionTable(rec) {
    var ss = rec && isArray(rec.sessions) ? rec.sessions : [], tab = [];
    for (var i = 0; i < ss.length; i++) {
      var s = ss[i];
      if (!isObj(s) || !isNum(s.start)) continue;
      var end = isNum(s.end) && s.end >= s.start ? s.end : s.start;
      tab.push({ a: mfloor(s.start / 1000), b: mceil(end / 1000), start: s.start, mode: s.mode, ended: s.ended, exs: isArray(s.exs) ? s.exs : [] });
    }
    tab.sort(function (x, y) { return x.a - y.a || x.b - y.b; });
    return tab;
  }
  // The session holding second t (an index into the table), or −1.
  function sessionAt(tab, t) {
    var lo = 0, hi = tab.length - 1, k = -1;
    while (lo <= hi) { var mid = (lo + hi) >> 1; if (tab[mid].a <= t) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    for (var j = k; j >= 0 && j >= k - 2; j--) if (tab[j].a <= t && t <= tab[j].b) return j; // overlaps (two tabs)
    return -1;
  }

  function context(rec, now) {
    return { rec: rec, now: now, tab: sessionTable(rec), names: LG.names ? LG.names(rec) : { ex: [], ver: [], mode: [] } };
  }

  function displayOf(def, display) { return def && def.perDisplay ? (display === 'small' ? 'small' : 'large') : null; }

  /* stream(cx, def, disp, opts) → { rows, stop }: the exercise's eligible rows, oldest first:
     { i, t (s), x, b, g, sw, rt, dl, kind, pp, mode, s (session: an index into cx.tab, or a negative
     id for rows no session holds), c (the pool entry) }. opts.fromMs: only rows after it; opts.max:
     the newest max rows; opts.gapDays: stop at a longer gap. stop: 'from' | 'version' | 'gap' | null. */
  function stream(cx, def, disp, opts) {
    opts = opts || {};
    var rows = cx.rec && isArray(cx.rec.trials) ? cx.rec.trials : [], nm = cx.names, out = [];
    var codes = byCode(def), ver = def.version || 1, perD = !!def.perDisplay;
    var from = isNum(opts.fromMs) ? opts.fromMs / 1000 : -Infinity;
    var max = isNum(opts.max) ? opts.max : Infinity, gap = isNum(opts.gapDays) ? opts.gapDays * 86400 : Infinity;
    var later = null, stop = null, pseudo = 0, pseudoT = null;
    for (var i = rows.length - 1; i >= 0 && out.length < max; i--) {
      var r = rows[i];
      if (!isArray(r) || r.length < 7 || !isNum(r[0])) continue;
      if (r[0] <= from) { stop = 'from'; break; }
      if (nm.ex[r[1]] !== def.id) continue;
      if ((nm.ver[r[1]] || 1) !== ver) { stop = 'version'; break; }
      var mode = nm.mode[r[2]];
      if (mode !== 'train' && mode !== 'path') continue;
      var oc = r[5];
      if (oc !== 0 && oc !== 1) continue;
      var dl = r.length > C_DL && isNum(r[C_DL]) ? r[C_DL] : 0;
      if (dl !== 0 && dl !== DL_PACE) continue; // Speed deadlines (fluency items) and set limits stay out
      var kind = r.length > C_KIND && isNum(r[C_KIND]) ? r[C_KIND] : 0;
      if (kind === K_FLUENCY) continue;
      if (perD && (r[COL.display] === 1 ? 'small' : 'large') !== disp) continue;
      var c = codes[r[COL.code]];
      if (!c) continue;
      var t = r[0];
      if (later !== null && later - t > gap) { stop = 'gap'; break; }
      var s = sessionAt(cx.tab, t), sw = 0, p = i > 0 ? rows[i - 1] : null;
      if (isArray(p) && isNum(p[0]) && nm.ex[p[1]] !== def.id) sw = s >= 0 ? (p[0] >= cx.tab[s].a ? 1 : 0) : (t - p[0] <= 90 ? 1 : 0);
      if (s < 0) { // rows no session holds: those within 30 minutes of each other form one
        if (pseudoT === null || pseudoT - t > 1800) pseudo -= 1;
        pseudoT = t;
        s = pseudo;
      }
      out.push({
        i: i, t: t, x: oc, b: c.b + (r.length > C_BOFF && isNum(r[C_BOFF]) ? r[C_BOFF] / 1000 : 0), g: c.g, sw: sw,
        rt: isNum(r[COL.rt]) && r[COL.rt] > 0 ? r[COL.rt] : null, dl: dl, kind: kind, pp: isNum(r[COL.pp]) ? r[COL.pp] / 1000 : null,
        mode: mode, s: s, c: c,
      });
      later = t;
    }
    out.reverse();
    return { rows: out, stop: stop };
  }

  /* ---------- fits ---------- */

  // Solves the k × k system H d = g (k ≤ 4) by Gaussian elimination with partial pivoting.
  function solve(H, g) {
    var k = g.length, A = [], i, j, l;
    for (i = 0; i < k; i++) A.push(H[i].slice().concat([g[i]]));
    for (i = 0; i < k; i++) {
      var p = i;
      for (j = i + 1; j < k; j++) if (mabs(A[j][i]) > mabs(A[p][i])) p = j;
      var tmp = A[i]; A[i] = A[p]; A[p] = tmp;
      var piv = A[i][i];
      if (!(mabs(piv) > 1e-12)) return null;
      for (j = i + 1; j < k; j++) { var f = A[j][i] / piv; for (l = i; l <= k; l++) A[j][l] -= f * A[i][l]; }
    }
    var x = new Array(k);
    for (i = k - 1; i >= 0; i--) { var s = A[i][k]; for (j = i + 1; j < k; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
    return x;
  }
  function inverse(H) {
    var k = H.length, out = [], i, j;
    for (i = 0; i < k; i++) out.push(new Array(k));
    for (j = 0; j < k; j++) {
      var e = []; for (i = 0; i < k; i++) e.push(i === j ? 1 : 0);
      var col = solve(H, e);
      if (!col) return null;
      for (i = 0; i < k; i++) out[i][j] = col[i];
    }
    return out;
  }

  /* fitLogit(rows, X, off, m, s) → { th, cov, P, R, W } | null: the posterior mode of
     P(x_i) = g_i + (1 − g_i − lapse)·σ(off_i + Σ θ_j X_ij) with priors θ_j ~ N(m_j, s_j²), by Fisher
     scoring (steps capped at 1.5 logits). P: fitted success, R: the score per row (∂ log L/∂η),
     W: its information (∂P/∂η)²/(P(1 − P)); cov: the inverse of the information plus the priors. */
  function fitLogit(rows, X, off, m, s) {
    var k = m.length, n = rows.length, th = m.slice(), lapse = C.lapse, i, j, l, it, H, g;
    var P = new Array(n), R = new Array(n), W = new Array(n);
    function pass() {
      H = []; g = [];
      for (j = 0; j < k; j++) { H.push(new Array(k).fill(0)); g.push(0); }
      for (i = 0; i < n; i++) {
        var xi = X[i], eta = off[i];
        for (j = 0; j < k; j++) eta += th[j] * xi[j];
        var sg = sig(eta), gi = rows[i].g, amp = 1 - gi - lapse;
        var p = gi + amp * sg;
        if (p < 1e-9) p = 1e-9; else if (p > 1 - 1e-9) p = 1 - 1e-9;
        var dp = amp * sg * (1 - sg), v = p * (1 - p), r = (rows[i].x - p) * dp / v, w = dp * dp / v;
        P[i] = p; R[i] = r; W[i] = w;
        for (j = 0; j < k; j++) { g[j] += r * xi[j]; for (l = 0; l <= j; l++) H[j][l] += w * xi[j] * xi[l]; }
      }
      for (j = 0; j < k; j++) {
        for (l = 0; l < j; l++) H[l][j] = H[j][l];
        H[j][j] += 1 / (s[j] * s[j]);
        g[j] -= (th[j] - m[j]) / (s[j] * s[j]);
      }
    }
    for (it = 0; it < 40; it++) {
      pass();
      var d = solve(H, g);
      if (!d) return null;
      var big = 0;
      for (j = 0; j < k; j++) { if (d[j] > 1.5) d[j] = 1.5; else if (d[j] < -1.5) d[j] = -1.5; th[j] += d[j]; big = mmax(big, mabs(d[j])); }
      if (big < 1e-8) break;
    }
    pass();
    var cov = inverse(H);
    if (!cov) return null;
    for (j = 0; j < k; j++) if (!isNum(th[j]) || !(cov[j][j] > 0)) return null;
    return { th: th, cov: cov, P: P, R: R, W: W };
  }

  // Between-session over-dispersion: Σ over sessions of U_s² / I_s (the level score and its
  // information) over K − k degrees of freedom, at least 1.
  function overdispersion(rows, R, W, k) {
    var U2 = {}, I = {}, keys = [];
    for (var i = 0; i < rows.length; i++) {
      var s = rows[i].s;
      if (!hasOwn.call(U2, s)) { U2[s] = 0; I[s] = 0; keys.push(s); }
      U2[s] += R[i]; I[s] += W[i];
    }
    var chi = 0;
    keys.forEach(function (s) { if (I[s] > 0) chi += U2[s] * U2[s] / I[s]; });
    // optional shrinkage towards a prior value (CFG.phiPrior: { df, phi }; df 0, the default, is off)
    var pp = isObj(CFG.phiPrior) ? CFG.phiPrior : {}, d0 = isNum(pp.df) && pp.df > 0 ? pp.df : 0, p0 = isNum(pp.phi) ? pp.phi : 1;
    var df = keys.length - k;
    return df + d0 >= 1 && (df >= 1 || d0 > 0) ? mmax(1, (chi + d0 * p0) / (mmax(0, df) + d0)) : 1;
  }

  // The detector's fit over a window (rows oldest first) → { a, beta, gamma, se, aSe, phi, k, P, P0, u }.
  function slopeFit(rows, mu0) {
    var n = rows.length, mid = (n - 1) / 2, hasSw = false, X = [], off = [], u = [], i;
    for (i = 0; i < n; i++) if (rows[i].sw) { hasSw = true; break; }
    for (i = 0; i < n; i++) {
      u.push((i - mid) / 100);
      X.push(hasSw ? [1, u[i], rows[i].sw] : [1, u[i]]);
      off.push(-rows[i].b);
    }
    var P0 = CFG.prior, m = hasSw ? [mu0, 0, 0] : [mu0, 0], s = hasSw ? [P0.a, P0.beta, P0.gamma] : [P0.a, P0.beta];
    var f = fitLogit(rows, X, off, m, s);
    if (!f) return null;
    var k = m.length, phi = overdispersion(rows, f.R, f.W, k), gam = hasSw ? f.th[2] : 0;
    // the fitted success without the switch term (the reference for switch and late-session residuals)
    var Pn = new Array(n), lapse = C.lapse;
    for (i = 0; i < n; i++) {
      var gi = rows[i].g;
      Pn[i] = gi + (1 - gi - lapse) * sig(f.th[0] + f.th[1] * u[i] - rows[i].b);
    }
    return {
      a: f.th[0], beta: f.th[1], gamma: gam, k: k, phi: phi,
      se: msqrt(f.cov[1][1] * phi), aSe: msqrt(f.cov[0][0] * phi), P: f.P, P0: Pn, u: u,
    };
  }

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    var pos = (sorted.length - 1) * q, lo = mfloor(pos), hi = mceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  /* The response-time channel: OLS of log rt (right answers without a deadline) on [1, u, b − ability,
     switch], its slope's SE inflated by the between-session over-dispersion of the residuals.
     → { slope (log time per 100 answers), se, n, faster, ratio (median / fastest quartile at matched
     difficulty) } or null with fewer than CFG.rt.minRight answers. */
  function rtChannel(rows, fit) {
    var sel = [], i, j, l;
    for (i = 0; i < rows.length; i++) if (rows[i].x === 1 && rows[i].rt !== null && rows[i].dl === 0) sel.push(i);
    if (!fit || sel.length < CFG.rt.minRight) return null;
    var hasSw = false;
    for (i = 0; i < sel.length; i++) if (rows[sel[i]].sw) { hasSw = true; break; }
    var k = hasSw ? 4 : 3, XtX = [], Xty = new Array(k).fill(0), X = [], y = [];
    for (j = 0; j < k; j++) XtX.push(new Array(k).fill(0));
    for (i = 0; i < sel.length; i++) {
      var r = rows[sel[i]], uu = fit.u[sel[i]];
      var xi = [1, uu, r.b - (fit.a + fit.beta * uu)];
      if (hasSw) xi.push(r.sw);
      var yi = mlog(r.rt);
      X.push(xi); y.push(yi);
      for (j = 0; j < k; j++) { Xty[j] += xi[j] * yi; for (l = 0; l < k; l++) XtX[j][l] += xi[j] * xi[l]; }
    }
    var coef = solve(XtX, Xty), inv = inverse(XtX);
    if (!coef || !inv) return null;
    var rss = 0, res = [], by = {}, cnt = {}, keys = [];
    for (i = 0; i < X.length; i++) {
      var e = y[i];
      for (j = 0; j < k; j++) e -= coef[j] * X[i][j];
      res.push(e); rss += e * e;
      var s = rows[sel[i]].s;
      if (!hasOwn.call(by, s)) { by[s] = 0; cnt[s] = 0; keys.push(s); }
      by[s] += e; cnt[s] += 1;
    }
    var n = X.length, s2 = rss / mmax(1, n - k);
    if (!(s2 > 0)) return null;
    var chi = 0;
    keys.forEach(function (s) { chi += by[s] * by[s] / (cnt[s] * s2); });
    var df = keys.length - k, phi = df >= 1 ? mmax(1, chi / df) : 1;
    var se = msqrt(s2 * inv[1][1] * phi), slope = coef[1];
    res.sort(function (a, b) { return a - b; });
    return {
      slope: slope, se: se, n: n, phi: phi,
      faster: slope + CFG.rt.z * se < mlog(1 - CFG.rt.faster),
      ratio: mexp(quantile(res, 0.5) - quantile(res, 0.25)),
    };
  }

  /* ---------- the record container (rec.plateau = { v: 1, list }; CONTRACT-v1.2 M and P) ---------- */

  function box(rec) {
    if (!isObj(rec.plateau)) rec.plateau = { v: 1, list: [] };
    if (!isArray(rec.plateau.list)) rec.plateau.list = [];
    if (!isNum(rec.plateau.v)) rec.plateau.v = 1;
    return rec.plateau;
  }
  function events(rec) { return rec && isObj(rec.plateau) && isArray(rec.plateau.list) ? rec.plateau.list : []; }

  function list(rec, exId) {
    return events(rec).filter(function (ev) { return isObj(ev) && (!exId || ev.exId === exId); })
      .sort(function (a, b) { return a.at - b.at; });
  }

  // Open trials of an exercise (plateau events whose trial has not ended), oldest first.
  function openEvents(rec, exId) {
    return list(rec, exId).filter(function (ev) { return ev.kind === 'plateau' && isObj(ev.trial) && ev.trial.end === null; });
  }
  function openEvent(rec, exId) { var L = openEvents(rec, exId); return L.length ? L[L.length - 1] : null; }
  // The exercise's event in its trial period (rest days included), or null.
  function active(rec, exId, now) { void now; return openEvent(rec, exId); }

  // Where the detector's window may start: after the end of the exercise's last event (a plateau's
  // trial period; a ceiling or faster event's own time). ms or null.
  function windowStart(rec, exId) {
    var t = null;
    events(rec).forEach(function (ev) {
      if (!isObj(ev) || ev.exId !== exId) return;
      var end = ev.kind === 'plateau' && isObj(ev.trial) ? ev.trial.end : ev.at;
      if (isNum(end) && (t === null || end > t)) t = end;
    });
    return t;
  }

  // Changes tried on the exercise since its last "clearly up".
  function tried(rec, exId) {
    var out = [];
    list(rec, exId).forEach(function (ev) {
      if (ev.kind !== 'plateau') return;
      if (isObj(ev.verdict) && ev.verdict.words === 'up') { out = []; return; }
      if (CHANGES.indexOf(ev.change) >= 0 && out.indexOf(ev.change) < 0) out.push(ev.change);
    });
    return out;
  }

  function styleOf(rec) {
    var s = rec && isObj(rec.train) ? rec.train.style : null;
    return typeof s === 'string' && hasOwn.call(C.styles, s) ? s : C.style;
  }
  // The variants automatic choices use (null without variants).
  function trainVariants(def) {
    if (!def.variants || def.variants.length < 2) return null;
    return isArray(def.trainVariants) && def.trainVariants.length ? def.trainVariants : def.variants;
  }
  function variantFilter(def, extra) {
    var tv = trainVariants(def);
    if (!tv || tv.length >= def.variants.length) return extra || null;
    return function (c) { return tv.indexOf(c.params.variant) >= 0 && (!extra || extra(c)); };
  }
  function both(f, g) { return f && g ? function (c) { return f(c) && g(c); } : f || g || null; }

  // The rating predicts more than the target on the hardest settings of the pool (in its train variants).
  function atCeiling(rec, def, st) {
    var tv = trainVariants(def), pool = M.pool(def), top = null;
    for (var i = 0; i < pool.length; i++) {
      var c = pool[i];
      if (tv && tv.indexOf(c.params.variant) < 0) continue;
      if (!top || c.b > top.b) top = c;
    }
    return !!top && M.pExp(st.mu, st.sd, top.b, top.g) > M.target(top.g, M.styleK(styleOf(rec)));
  }

  /* ---------- the detector ---------- */

  function detect(rec, def, opts, now, cx) {
    opts = opts || {};
    cx = cx || context(rec, now);
    var disp = displayOf(def, opts.display);
    var st = E.est.get(rec, def, { display: disp || opts.display });
    var out = {
      exId: def.id, disp: disp, ready: false, why: null, fire: false, beta: null, se: null, n: [st.n, st.n],
      sessions: 0, days: 0, rt: null, ceiling: false, faster: false, a: null, aSe: null, gamma: null, phi: null,
    };
    if (openEvent(rec, def.id)) { out.why = 'trial'; return out; }
    if (st.n < CFG.window) { out.why = 'answers'; return out; }
    var s = stream(cx, def, disp, { fromMs: windowStart(rec, def.id), max: CFG.window, gapDays: CFG.maxGapDays });
    var rows = s.rows;
    out.n = [mmax(0, st.n - rows.length), st.n];
    if (rows.length < CFG.window) { out.why = s.stop === 'gap' ? 'break' : 'answers'; return out; }
    var seen = {}, days = {};
    rows.forEach(function (r) {
      if (hasOwn.call(seen, r.s)) return;
      seen[r.s] = true;
      out.sessions += 1;
      var dk = E.day(r.s >= 0 ? cx.tab[r.s].start : r.t * 1000);
      if (!hasOwn.call(days, dk)) { days[dk] = true; out.days += 1; }
    });
    if (out.sessions < CFG.minSessions) { out.why = 'sessions'; return out; }
    if (out.days < CFG.minDays) { out.why = 'days'; return out; }
    var fit = slopeFit(rows, st.mu);
    if (!fit) { out.why = 'fit'; return out; }
    out.beta = fit.beta; out.se = fit.se; out.a = fit.a; out.aSe = fit.aSe; out.gamma = fit.gamma; out.phi = fit.phi;
    out.fire = fit.beta + CFG.z * fit.se < CFG.delta;
    out.rt = rtChannel(rows, fit);
    out.faster = !!(out.rt && out.rt.faster);
    out.ceiling = atCeiling(rec, def, st);
    if (out.ceiling) out.why = 'ceiling';
    else out.ready = true;
    Object.defineProperty(out, '_rows', { value: rows });
    Object.defineProperty(out, '_fit', { value: fit });
    Object.defineProperty(out, '_cx', { value: cx });
    return out;
  }

  /* ---------- signals and the decision table (note P1 §3.9) ---------- */

  function sortNum(a) { return a.slice().sort(function (x, y) { return x - y; }); }
  function leastUsed(tv, counts) {
    var best = null, bn = Infinity;
    tv.forEach(function (v) { var n = counts[v] || 0; if (n < bn) { bn = n; best = v; } });
    return best;
  }
  function isStretch(r, k) {
    if (r.kind > 0) return r.kind === K_STRETCH || r.kind === K_STRETCH1;
    // rows of formats 1–3 carry no kind: a stretch item's logged prediction sits at its own target
    return r.pp !== null && mabs(r.pp - M.target(r.g, C.mix.stretchK)) <= 0.03 && r.pp < M.target(r.g, k) - 0.05;
  }
  // The strategy card a player has not been reported using: 'analytic' after 'whole', 'imagery' after
  // 'parts'; with no report (or 'unsure'), the card other than the one the tutorial opens with.
  function otherCard(def, named) {
    if (named === 'whole') return 'analytic';
    if (named === 'parts') return 'imagery';
    var ld = PX.ex.learn ? PX.ex.learn(def.id) : null, first = ld && typeof ld.strategyFirst === 'string' ? ld.strategyFirst : 'analytic';
    return first === 'imagery' ? 'analytic' : 'imagery';
  }

  /* signals(rec, def, det, now) → { 'switch-deficit', 'weak-frontier', 'slow-accurate', 'massed',
     'strategy', 'narrow-mix', 'stretch-beaten', 'otherwise': null | { change, detail, value?, n? },
     tried: [change ids] }. 'otherwise' is always present. Train-only changes (a stage, Speed inside
     Train, rest days) need half of the window's answers from Train sessions. */
  function signals(rec, def, det, now) {
    var out = { tried: tried(rec, def.id) }, S = CFG.signal, i;
    SIGNALS.forEach(function (id) { out[id] = null; });
    var rows = det && det._rows, fit = det && det._fit, cx = det && det._cx;
    var style = styleOf(rec), k = M.styleK(style), tv = trainVariants(def);
    var stage = E.schedule.stage(rec, def.id, style), minStage = style === 'stretch' ? C.stages.stretchStart : 1;
    var st = E.est.get(rec, def, { display: det && det.disp ? det.disp : undefined });
    if (!rows || !fit || !rows.length) {
      out.otherwise = tv ? { change: 'new-variant', detail: { variant: tv[tv.length - 1] } } : { change: 'wider-mix', detail: {} };
      return out;
    }
    var n = rows.length, nTrain = 0;
    rows.forEach(function (r) { if (r.mode === 'train') nTrain += 1; });
    var trainy = nTrain / n >= S.trainShare;

    // 1. answers right after a switch below the window's own prediction (the switch term left out)
    var swN = 0, swD = 0, swV = 0;
    for (i = 0; i < n; i++) if (rows[i].sw) { swN += 1; swD += fit.P0[i] - rows[i].x; swV += fit.P0[i] * (1 - fit.P0[i]); }
    var deficit = swN ? swD / swN : 0, swZ = swV > 0 ? swD / msqrt(swV) : 0;
    if (trainy && stage - 1 >= minStage && swN >= S.switchMin && deficit >= S.switchGap && swZ >= S.switchZ) {
      out['switch-deficit'] = { change: 'stage-back', detail: { stage: stage - 1 }, value: r3(deficit), n: swN };
    }

    // 2. a weak spot (select.weak) at a level whose items reach the target
    var weak = E.select.weak(rec, def), pool = M.pool(def);
    for (var w = 0; w < weak.length && !out['weak-frontier']; w++) {
      var wk = weak[w], near = false;
      for (i = 0; i < pool.length && !near; i++) {
        var c = pool[i];
        if (c.lv[wk.d] !== wk.lv || (tv && tv.indexOf(c.params.variant) < 0)) continue;
        if (mabs(M.pExp(st.mu, st.sd, c.b, c.g) - M.target(c.g, k)) <= S.frontier) near = true;
      }
      if (near) out['weak-frontier'] = { change: 'drill', detail: { dim: def.dims[wk.d].key, level: wk.lv }, value: r3(wk.m), n: wk.n };
    }

    // 3. accurate but slow: Speed open, no speed-up, right answers at matched difficulty take at least
    // 1.3 × their own fastest quartile
    var open = E.speed && typeof E.speed.open === 'function' ? E.speed.open(rec, def, { display: det.disp || undefined }) : null, rt = det.rt;
    if (trainy && open && open.ok && rt && !rt.faster && rt.n >= S.slowMin && rt.ratio >= S.slowRatio) {
      out['slow-accurate'] = { change: 'speed-in-train', detail: {}, value: r3(rt.ratio), n: rt.n };
    }

    // 4. late-session decline (the second half of each session's answers below the first) or massed practice
    var bySess = {}, order = [];
    for (i = 0; i < n; i++) { var key = rows[i].s; if (!hasOwn.call(bySess, key)) { bySess[key] = []; order.push(key); } bySess[key].push(i); }
    var dSum = 0, dW = 0, dV = 0, sizes = [], dayN = {}, dayList = [], earlyQ = 0, known = 0;
    order.forEach(function (key) {
      var idx = bySess[key];
      sizes.push(idx.length);
      var dk = E.day(rows[idx[0]].t * 1000);
      if (!hasOwn.call(dayN, dk)) { dayN[dk] = 0; dayList.push(dk); }
      dayN[dk] += 1;
      if (cx && key >= 0) { known += 1; if (cx.tab[key].ended === 'early') earlyQ += 1; }
      if (idx.length < S.declineMin) return;
      var h = mfloor(idx.length / 2), e = 0, l = 0, ve = 0, vl = 0;
      for (var q = 0; q < idx.length; q++) {
        var j = idx[q], res = rows[j].x - fit.P[j], v = fit.P[j] * (1 - fit.P[j]);
        if (q < h) { e += res; ve += v; } else { l += res; vl += v; }
      }
      var ne = h, nl = idx.length - h, d = l / nl - e / ne, wt = idx.length;
      dSum += wt * d; dW += wt; dV += wt * wt * (vl / (nl * nl) + ve / (ne * ne));
    });
    var decline = dW > 0 ? dSum / dW : 0, dZ = dV > 0 ? decline / (msqrt(dV) / dW) : 0;
    var twice = dayList.filter(function (dk) { return dayN[dk] >= 2; }).length / mmax(1, dayList.length);
    var third = mfloor(n * 2 / 3), dEarly = {}, dLate = {}, nE = 0, nL = 0;
    for (i = 0; i < n; i++) {
      var dk2 = E.day(rows[i].t * 1000);
      if (i < third) { if (!hasOwn.call(dEarly, dk2)) { dEarly[dk2] = 1; nE += 1; } } else if (!hasOwn.call(dLate, dk2)) { dLate[dk2] = 1; nL += 1; }
    }
    var jump = nE > 0 && nL > 0 && (n - third) / nL >= S.massedJump * (third / nE);
    var massed = quantile(sortNum(sizes), 0.5) >= S.massedAnswers || twice >= S.massedTwice || jump;
    var clearDecline = decline <= -S.declineGap && dZ <= -S.declineZ;
    if (trainy && (clearDecline || (massed && decline < 0))) {
      out.massed = { change: 'rest', detail: { days: CFG.change.restDays }, value: r3(decline), massed: massed ? 1 : 0 };
    }

    // 5. a strategy: the check-ins in the window (else the last one) name one strategy, or none
    var ci = isArray(rec.strategies) ? rec.strategies : [], t0 = rows[0].t * 1000, named = {}, inWin = 0, last = null;
    for (i = 0; i < ci.length; i++) {
      var x = ci[i];
      if (!isObj(x) || x.exId !== def.id) continue;
      last = x;
      if (isNum(x.t) && x.t >= t0) { inWin += 1; if (x.strategy === 'whole' || x.strategy === 'parts') named[x.strategy] = true; }
    }
    if (!inWin && last && (last.strategy === 'whole' || last.strategy === 'parts')) named[last.strategy] = true;
    if (!(named.whole && named.parts)) {
      var one = named.whole ? 'whole' : named.parts ? 'parts' : null;
      out.strategy = { change: 'other-strategy', detail: { strategy: otherCard(def, one) }, value: one || 'none' };
    }

    // 6. a narrow mix: one variant for most answers, low variability, or a few settings for half of them
    var vc = {}, cc = {}, combos = [];
    rows.forEach(function (r) {
      var v = r.c.params.variant;
      if (v !== undefined) vc[v] = (vc[v] || 0) + 1;
      if (!hasOwn.call(cc, r.c.code)) { cc[r.c.code] = 0; combos.push(r.c.code); }
      cc[r.c.code] += 1;
    });
    var dom = 0;
    Object.keys(vc).forEach(function (v) { if (vc[v] > dom) dom = vc[v]; });
    var narrowV = !!tv && tv.length >= 2 && dom / n >= S.narrowShare;
    var low = isObj(rec.train) && rec.train.variability === 'low';
    var counts = combos.map(function (code) { return cc[code]; }).sort(function (a, b) { return b - a; });
    var poolN = tv ? pool.filter(function (c) { return tv.indexOf(c.params.variant) >= 0; }).length : pool.length;
    var top = poolN >= S.topMin && (counts[0] || 0) + (counts[1] || 0) + (counts[2] || 0) >= S.topShare * n;
    if (narrowV || low || top) {
      out['narrow-mix'] = narrowV ? { change: 'variant-swap', detail: { variant: leastUsed(tv, vc) } } : { change: 'wider-mix', detail: {} };
    }

    // 7. stretch items answered better than the fit predicts, and few sessions ended early
    var sN = 0, sR = 0, sV = 0;
    for (i = 0; i < n; i++) if (isStretch(rows[i], k)) { sN += 1; sR += rows[i].x - fit.P[i]; sV += fit.P[i] * (1 - fit.P[i]); }
    var kHigh = r3(k - CFG.change.aimStep);
    if (sN >= S.stretchMin && sV > 0 && sR / msqrt(sV) >= S.stretchZ && earlyQ <= S.earlyQuits * mmax(1, known) && kHigh >= CFG.change.aimMin - 1e-9) {
      out['stretch-beaten'] = { change: 'aim-higher', detail: { k: kHigh }, value: r3(sR / sN), n: sN };
    }

    // 8. otherwise: a stage forward, else a variant used least in the window, else a wider mix
    if (trainy && stage + 1 <= 5 && !(deficit >= S.switchGap) && st.sd <= C.stages.upSd) out.otherwise = { change: 'stage-forward', detail: { stage: stage + 1 } };
    else if (tv && tv.length >= 2) out.otherwise = { change: 'new-variant', detail: { variant: leastUsed(tv, vc) } };
    else out.otherwise = { change: 'wider-mix', detail: {} };
    void now;
    return out;
  }

  /* choose(signals, rng) → { row, reason, change, detail, eligible, drawn }: the first of rows 1–4
     whose signal is present and whose change was not tried since the last "clearly up" (drawn 0);
     else one change drawn with rng among the eligible rows 5–8 (drawn 1; when all were tried, among
     all of rows 5–8). eligible: the changes in force, in row order, each once. */
  function choose(sg, rng) {
    sg = sg || {};
    var tr = isArray(sg.tried) ? sg.tried : [], eligible = [], first = null, pool = [], seen = {}, r, v;
    for (r = 1; r <= 8; r++) {
      v = sg[SIGNALS[r - 1]];
      if (!isObj(v) || CHANGES.indexOf(v.change) < 0 || tr.indexOf(v.change) >= 0 || seen[v.change]) continue;
      seen[v.change] = true;
      eligible.push(v.change);
      if (r <= 4) { if (!first) first = { row: r, v: v }; } else pool.push({ row: r, v: v });
    }
    var pick = first;
    if (!pick) {
      if (!pool.length) {
        seen = {};
        for (r = 5; r <= 8; r++) {
          v = sg[SIGNALS[r - 1]];
          if (isObj(v) && CHANGES.indexOf(v.change) >= 0 && !seen[v.change]) { seen[v.change] = true; pool.push({ row: r, v: v }); }
        }
        eligible = pool.map(function (x) { return x.v.change; });
      }
      if (!pool.length) pool.push({ row: 8, v: { change: 'wider-mix', detail: {} } });
      pick = pool.length > 1 && rng ? rng.pick(pool) : pool[0];
    }
    return {
      row: pick.row, reason: SIGNALS[pick.row - 1], change: pick.v.change, detail: U.deepCopy(isObj(pick.v.detail) ? pick.v.detail : {}),
      eligible: eligible, drawn: first ? 0 : 1,
    };
  }

  /* ---------- events, trial periods and verdicts (note P1 §3.10) ---------- */

  // Train and Path sessions with the exercise so far (the trial's s0).
  function sessionCount(cx, exId) {
    var n = 0;
    cx.tab.forEach(function (s) { if ((s.mode === 'train' || s.mode === 'path') && s.exs.indexOf(exId) >= 0) n += 1; });
    return n;
  }

  // A plateau, ceiling or faster event; a plateau's change is chosen here and starts at once (a stage
  // moves now, rest days start now; the others act through the hooks while the trial runs).
  function fire(rec, def, det, kind, plan, res, now, cx) {
    now = mround(now); // whole milliseconds: the event's id and times
    var disp = det.disp, st = E.est.get(rec, def, { display: disp || plan.display }), lv = E.est.shown(rec, def, { display: disp || plan.display });
    var seed = PX.rng.hash('plateau', def.id, disp || '-', now) >>> 0, ch = null;
    if (kind === 'plateau') ch = choose(signals(rec, def, det, now), PX.rng(seed));
    var ev = {
      id: def.id + ':' + now, exId: def.id, disp: disp, at: now,
      session: res && isObj(res.session) && typeof res.session.id === 'string' ? res.session.id : plan.id, kind: kind,
      n: [det.n[0], det.n[1]], sessions: det.sessions, days: det.days, beta: r3(det.beta), se: r3(det.se),
      rt: det.rt ? { slope: r3(det.rt.slope), se: r3(det.rt.se) } : null,
      level: { lv: lv.level, lo: lv.lo, hi: lv.hi },
      row: ch ? ch.row : 0, reason: ch ? ch.reason : null, change: ch ? ch.change : null, detail: ch ? ch.detail : {},
      eligible: ch ? ch.eligible : [], drawn: ch ? ch.drawn : 0, seed: seed,
      trial: ch ? {
        sessions: CFG.trial.sessions, answers: CFG.trial.answers, s0: sessionCount(cx, def.id), n0: st.n, end: null,
        restUntil: ch.change === 'rest' ? now + mround(CFG.change.restDays * DAY) : null,
      } : null,
      verdict: null, shown: { summary: 0, today: 0 },
      fit: { a: r3(det.a), aSe: r3(det.aSe), gamma: r3(det.gamma), phi: r3(det.phi) },
    };
    if (ch && (ch.change === 'stage-back' || ch.change === 'stage-forward') && isNum(ch.detail.stage)) E.schedule.setStage(rec, def.id, ch.detail.stage);
    box(rec).list.push(ev);
    return ev;
  }

  // The level of the trial period's answers against the window's (the fitted intercepts; the switch
  // term and the over-dispersion kept from the window). The first session of the period is left out
  // when at least CFG.verdict.minRest answers remain (a change often dips first). → { words, diff, se }
  function verdictOf(ev, rows) {
    var V = CFG.verdict, use = rows;
    if (V.skipFirst && rows.length) {
      var j = 0;
      while (j < rows.length && rows[j].s === rows[0].s) j++;
      if (rows.length - j >= V.minRest) use = rows.slice(j);
    }
    var fa = isObj(ev.fit) ? ev.fit : {}, a0 = isNum(fa.a) ? fa.a : 0, g0 = isNum(fa.gamma) ? fa.gamma : 0;
    var phi = isNum(fa.phi) && fa.phi >= 1 ? fa.phi : 1, aSe = isNum(fa.aSe) ? fa.aSe : 0;
    var X = [], off = [];
    use.forEach(function (r) { X.push([1]); off.push(g0 * r.sw - r.b); });
    var f = use.length ? fitLogit(use, X, off, [a0], [CFG.prior.a]) : null;
    if (!f) return { words: 'unclear', diff: null, se: null, n: use.length };
    var diff = f.th[0] - a0, se = msqrt(f.cov[0][0] * phi + aSe * aSe);
    var words = diff - V.z * se > 0 ? 'up' : diff + V.z * se < V.none ? 'none' : 'unclear';
    return { words: words, diff: diff, se: se, n: use.length };
  }

  // A trial period that has run its sessions and answers gets its verdict; a gap of more than 14 days
  // between its sessions ends it as 'unclear' (diff null). Returns true when the trial ended.
  function followUp(cx, ev, def, now) {
    var tr = ev.trial;
    if (!isObj(tr) || tr.end !== null) return false;
    var start = isNum(tr.restUntil) && tr.restUntil > ev.at ? tr.restUntil : ev.at;
    if (now < start) return false;
    var rows = stream(cx, def, ev.disp, { fromMs: start }).rows, firsts = [], seen = {};
    rows.forEach(function (r) { if (!hasOwn.call(seen, r.s)) { seen[r.s] = true; firsts.push(r.t); } });
    var prev = start / 1000, broke = false;
    for (var i = 0; i < firsts.length && !broke; i++) { if (firsts[i] - prev > CFG.verdict.maxGapDays * 86400) broke = true; prev = firsts[i]; }
    var at = mround(now);
    if (broke) { tr.end = at; ev.verdict = { at: at, words: 'unclear', diff: null, se: null }; return true; }
    if (firsts.length < tr.sessions || rows.length < tr.answers) return false;
    var v = verdictOf(ev, rows);
    tr.end = at;
    ev.verdict = { at: at, words: v.words, diff: r3(v.diff), se: r3(v.se) };
    return true;
  }

  /* progress(rec, ev, now) → { resting, restUntil, sessions, answers, need: { sessions, answers } }: how far a
     plateau change's trial period has come (sessions with the exercise and rated answers since it began,
     or since its rest days ended); null for an event without a trial. */
  function progress(rec, ev, now) {
    if (!isObj(ev) || !isObj(ev.trial)) return null;
    var tr = ev.trial, start = isNum(tr.restUntil) && tr.restUntil > ev.at ? tr.restUntil : ev.at;
    var out = { resting: isNum(tr.restUntil) && now < tr.restUntil && tr.end === null, restUntil: isNum(tr.restUntil) ? tr.restUntil : null,
      sessions: 0, answers: 0, need: { sessions: tr.sessions, answers: tr.answers }, ended: tr.end !== null };
    var def = PX.ex.get(ev.exId);
    if (!def) return out;
    var rows = stream(context(rec, now), def, ev.disp, { fromMs: start }).rows, seen = {};
    if (isNum(tr.end)) rows = rows.filter(function (r) { return r.t * 1000 <= tr.end; });
    rows.forEach(function (r) { if (!hasOwn.call(seen, r.s)) { seen[r.s] = true; out.sessions += 1; } });
    out.answers = rows.length;
    return out;
  }

  // While a stage change runs, the session end's own stage-up does not undo it.
  function holdStage(rec, ev, res) {
    if (!ev || (ev.change !== 'stage-back' && ev.change !== 'stage-forward') || !isNum(ev.detail.stage) || !res || !isArray(res.stageUps)) return;
    for (var i = res.stageUps.length - 1; i >= 0; i--) {
      if (res.stageUps[i] && res.stageUps[i].exId === ev.exId) { res.stageUps.splice(i, 1); E.schedule.setStage(rec, ev.exId, ev.detail.stage); }
    }
  }

  function trim(rec) {
    var L = box(rec).list, keep = CFG.keep;
    if (L.length <= keep) return;
    L.sort(function (a, b) { return a.at - b.at; });
    var drop = L.length - keep;
    rec.plateau.list = L.filter(function (ev) {
      if (drop > 0 && !(ev.kind === 'plateau' && isObj(ev.trial) && ev.trial.end === null)) { drop -= 1; return false; }
      return true;
    });
  }

  /* finish(plan, rec, now, res): the modes finish hook (order 20). Train and Path only: the trial
     periods of this session's exercises first (verdicts), then the detector on each exercise with
     at least CFG.minAnswers answers in the session. res.plateau = { fired, ended } (record entries). */
  function finish(plan, rec, now, res) {
    if (!isObj(plan) || (plan.mode !== 'train' && plan.mode !== 'path') || plan.unavailable || !isObj(rec)) return;
    var rated = isObj(plan.rated) ? plan.rated : {}, ids = Object.keys(rated).filter(function (id) { return isObj(rated[id]) && rated[id].n > 0; });
    var out = { fired: [], ended: [] };
    if (res) res.plateau = out;
    if (!ids.length) return;
    var cx = context(rec, now);
    ids.forEach(function (id) {
      var def = PX.ex.get(id), open = openEvents(rec, id);
      if (!def || !open.length) return;
      // two tabs may each have opened one: the latest runs, the others end where it began
      for (var i = 0; i < open.length - 1; i++) open[i].trial.end = open[open.length - 1].at;
      var ev = open[open.length - 1];
      if (followUp(cx, ev, def, now)) out.ended.push(ev);
      else holdStage(rec, ev, res);
    });
    ids.forEach(function (id) {
      var def = PX.ex.get(id);
      if (!def || def.role !== 'train' || rated[id].n < CFG.minAnswers) return;
      var det = detect(rec, def, { display: plan.display }, now, cx), kind = null;
      if (det.ready && det.fire) kind = det.faster ? 'faster' : 'plateau';
      else if (det.why === 'ceiling') kind = 'ceiling'; // top of the range: said once per window, whatever the slope
      if (kind) out.fired.push(fire(rec, def, det, kind, plan, res, now, cx));
    });
    if (out.fired.length) trim(rec);
  }

  /* ---------- the change while its trial runs (hooks) ---------- */

  function changeFor(rec, exId, plan) {
    if (!isObj(plan) || (plan.mode !== 'train' && plan.mode !== 'path')) return null;
    var ev = openEvent(rec, exId);
    return ev && (!ev.disp || ev.disp === plan.display) ? ev : null;
  }
  function dimIndex(def, key) { for (var d = 0; d < def.dims.length; d++) if (def.dims[d].key === key) return d; return -1; }

  // start (Train): Speed inside Train raises the exercise's share of fluency items (W2-progress's kind hook reads it)
  function startHook(plan, rec) {
    if (!isObj(plan) || plan.mode !== 'train' || plan.unavailable || !isArray(plan.exs)) return;
    plan.exs.forEach(function (id) {
      var ev = changeFor(rec, id, plan);
      if (!ev || ev.change !== 'speed-in-train') return;
      if (!isObj(plan.share)) plan.share = {};
      var sh = isObj(plan.share[id]) ? plan.share[id] : (plan.share[id] = {});
      sh.fluency = mmax(isNum(sh.fluency) ? sh.fluency : 0, CFG.change.fluency);
    });
  }

  // kind: a drill turns target items into drill items at the weak-spot share
  function kindHook(plan, rec, def, kind) {
    if (kind !== 'target') return null;
    var ev = changeFor(rec, def.id, plan);
    if (!ev || ev.change !== 'drill' || !plan.rng) return null;
    return plan.rng.chance(isNum(CFG.change.drill) ? CFG.change.drill : C.weak.share) ? 'drill' : null;
  }

  // pick: the select options of the running change
  function pickHook(plan, rec, def, o, ctx) {
    var ev = changeFor(rec, def.id, plan), d = ev && isObj(ev.detail) ? ev.detail : {};
    if (!ev) return null;
    if (ev.change === 'drill') {
      o.weak = null; // the drill takes the weak-spot share (CONTRACT-v1.2 conflict 10)
      var di = dimIndex(def, d.dim);
      if (o.kind === 'drill' && di >= 0 && isNum(d.level)) o.filter = both(o.filter, function (c) { return c.lv[di] === d.level; });
    } else if (ev.change === 'aim-higher') {
      if (isNum(d.k)) o.k = d.k;
    } else if (ev.change === 'wider-mix') {
      o.policy = 'high';
      o.tol = mmax(isNum(o.tol) ? o.tol : C.select.tol, CFG.change.widerTol);
      if (ctx && ctx.run) o.filter = variantFilter(def, null); // Train: every run mixes the variants
    } else if (ev.change === 'variant-swap' || ev.change === 'new-variant') {
      if (typeof d.variant === 'string' && isArray(def.variants) && def.variants.indexOf(d.variant) >= 0) {
        o.filter = both(ctx && !ctx.run ? ctx.runFilter : null, function (c) { return c.params.variant === d.variant; });
      }
    }
    return null;
  }

  // exclude: the rest days keep the exercise out of automatic choices
  function excludeHook(rec, def, now) {
    var ev = openEvent(rec, def.id);
    if (!ev || ev.change !== 'rest' || !isObj(ev.trial) || !isNum(ev.trial.restUntil) || !(now < ev.trial.restUntil)) return null;
    return { why: 'plateau-rest', until: ev.trial.restUntil };
  }

  /* card(rec, now) → the event Today shows: a verdict of the last CFG.card.days days, else a ceiling or
     faster event of those days, else a change in its trial period; the latest of each; events the
     player hid (rec.ui.plateau.hide[id] > now) are skipped. */
  function card(rec, now) {
    var ui = rec && isObj(rec.ui) && isObj(rec.ui.plateau) && isObj(rec.ui.plateau.hide) ? rec.ui.plateau.hide : {};
    var win = CFG.card.days * DAY, best = null, bp = 0, bt = -Infinity;
    events(rec).forEach(function (ev) {
      if (!isObj(ev) || !isNum(ev.at) || (isNum(ui[ev.id]) && ui[ev.id] > now)) return;
      var p = 0, t = ev.at;
      if (isObj(ev.verdict) && isNum(ev.verdict.at) && now - ev.verdict.at <= win) { p = 3; t = ev.verdict.at; }
      else if (ev.kind !== 'plateau' && now - ev.at <= win) p = 2;
      else if (ev.kind === 'plateau' && isObj(ev.trial) && ev.trial.end === null) p = 1;
      if (p > bp || (p === bp && p > 0 && t > bt)) { best = ev; bp = p; bt = t; }
    });
    return best;
  }

  /* ---------- record repair, merge, levels, export rows ---------- */

  var TOKEN = /^[A-Za-z0-9_.:@-]{1,64}$/;
  function tok(x) { return typeof x === 'string' && TOKEN.test(x) ? x : null; }
  function fixDetail(d) {
    var F = E.fix, o = {};
    if (!isObj(d)) return o;
    if (tok(d.dim)) o.dim = d.dim;
    if (F.int(d.level, 0, 999) !== undefined) o.level = F.int(d.level, 0, 999);
    if (tok(d.strategy)) o.strategy = d.strategy;
    if (tok(d.variant)) o.variant = d.variant;
    if (F.num(d.k, 0, 1) !== undefined) o.k = F.num(d.k, 0, 1);
    if (F.num(d.days, 0, 60) !== undefined) o.days = F.num(d.days, 0, 60);
    if (F.int(d.stage, 1, 5) !== undefined) o.stage = F.int(d.stage, 1, 5);
    return o;
  }
  function numOrNull(x) { return isNum(x) ? x : null; }
  function timeOrNull(x) { return E.fix.time(x) !== undefined ? x : null; }
  // One event, cleaned (unknown keys dropped), or undefined when it cannot be kept.
  function fixEvent(ev) {
    var F = E.fix;
    if (!isObj(ev)) return undefined;
    var exId = F.id(ev.exId), at = F.time(ev.at);
    if (!exId || at === undefined || KINDS.indexOf(ev.kind) < 0) return undefined;
    var change = CHANGES.indexOf(ev.change) >= 0 ? ev.change : null, tr = null, vd = null;
    if (ev.kind === 'plateau') {
      if (!change || !isObj(ev.trial)) return undefined;
      var t = ev.trial;
      tr = {
        sessions: F.int(t.sessions, 1, 50) || CFG.trial.sessions, answers: F.int(t.answers, 1, 5000) || CFG.trial.answers,
        s0: F.int(t.s0, 0, 1e7) || 0, n0: F.int(t.n0, 0, 1e9) || 0, end: timeOrNull(t.end), restUntil: timeOrNull(t.restUntil),
      };
    }
    if (isObj(ev.verdict) && F.time(ev.verdict.at) !== undefined && WORDS.indexOf(ev.verdict.words) >= 0) {
      vd = { at: ev.verdict.at, words: ev.verdict.words, diff: numOrNull(ev.verdict.diff), se: numOrNull(ev.verdict.se) };
    }
    var lv = isObj(ev.level) ? ev.level : {};
    var out = {
      id: exId + ':' + at, exId: exId, disp: ev.disp === 'small' || ev.disp === 'large' ? ev.disp : null, at: at,
      session: tok(ev.session), kind: ev.kind,
      n: isArray(ev.n) && ev.n.length === 2 && isNum(ev.n[0]) && isNum(ev.n[1]) ? [mmax(0, mround(ev.n[0])), mmax(0, mround(ev.n[1]))] : [0, 0],
      sessions: F.int(ev.sessions, 0, 1e6) || 0, days: F.int(ev.days, 0, 1e6) || 0,
      beta: numOrNull(ev.beta), se: numOrNull(ev.se),
      rt: isObj(ev.rt) && isNum(ev.rt.slope) && isNum(ev.rt.se) ? { slope: ev.rt.slope, se: ev.rt.se } : null,
      level: { lv: F.int(lv.lv, 1, 100) || 1, lo: F.int(lv.lo, 1, 100) || 1, hi: F.int(lv.hi, 1, 100) || 1 },
      row: F.int(ev.row, 0, 8) || 0, reason: SIGNALS.indexOf(ev.reason) >= 0 ? ev.reason : null, change: change,
      detail: fixDetail(ev.detail),
      eligible: isArray(ev.eligible) ? ev.eligible.filter(function (c, i, a) { return CHANGES.indexOf(c) >= 0 && a.indexOf(c) === i; }) : [],
      drawn: ev.drawn === 1 ? 1 : 0, seed: isNum(ev.seed) && ev.seed >= 0 && ev.seed < 4294967296 ? mfloor(ev.seed) : 0,
      trial: tr, verdict: vd,
      shown: { summary: isObj(ev.shown) && ev.shown.summary === 1 ? 1 : 0, today: isObj(ev.shown) && F.time(ev.shown.today) !== undefined ? ev.shown.today : 0 },
    };
    // the window's fit (the verdict's baseline): kept when the event has one
    if (isObj(ev.fit)) out.fit = { a: numOrNull(ev.fit.a), aSe: numOrNull(ev.fit.aSe), gamma: numOrNull(ev.fit.gamma), phi: numOrNull(ev.fit.phi) };
    return out;
  }
  // The container's repair (E.record.check): events cleaned, one per id (the copy with more done), oldest
  // first; the container's other keys are kept as they are (CONTRACT-v1.2 M: a check keeps keys it does not own).
  function repair(v) {
    var src = isObj(v) && isArray(v.list) ? v.list : [], by = {}, ids = [], out = {};
    if (isObj(v)) for (var k in v) if (hasOwn.call(v, k) && k !== 'list' && k !== 'v') out[k] = v[k];
    src.forEach(function (ev) {
      var r = fixEvent(ev);
      if (!r) return;
      if (!hasOwn.call(by, r.id)) ids.push(r.id);
      by[r.id] = hasOwn.call(by, r.id) ? better(by[r.id], r) : r;
    });
    out.v = 1;
    out.list = ids.map(function (id) { return by[id]; }).sort(function (a, b) { return a.at - b.at; });
    return out;
  }
  // For one id: the copy with a verdict, else the one whose trial ended, else the second; shown flags united.
  function better(x, y) {
    function rank(e) { return (isObj(e.verdict) ? 2 : 0) + (isObj(e.trial) && isNum(e.trial.end) ? 1 : 0); }
    var w = rank(y) >= rank(x) ? y : x, o = w === y ? x : y, out = U.deepCopy(w);
    if (isObj(out.shown) && isObj(o.shown)) {
      out.shown.summary = mmax(out.shown.summary === 1 ? 1 : 0, o.shown.summary === 1 ? 1 : 0);
      out.shown.today = mmax(isNum(out.shown.today) ? out.shown.today : 0, isNum(o.shown.today) ? o.shown.today : 0);
    }
    return out;
  }
  // Two tabs (E.merge.register): the union of the lists by id.
  function mergeBox(theirs, mine) {
    var a = isObj(theirs) && isArray(theirs.list) ? theirs.list : [], b = isObj(mine) && isArray(mine.list) ? mine.list : [];
    return repair({ v: 1, list: a.concat(b) });
  }
  // A changed level scale (E.rebase.register): the levels stored in the exercise's events.
  function convertLevels(rec, id, conv) {
    events(rec).forEach(function (ev) {
      if (!isObj(ev) || ev.exId !== id || !isObj(ev.level)) return;
      ['lv', 'lo', 'hi'].forEach(function (k) { if (isNum(ev.level[k])) ev.level[k] = conv(ev.level[k]); });
    });
  }
  // The 'plateau' rows of the events table (E.events.source; export only): one when an event fires
  // ('fire'; change is the event's kind for a ceiling or faster event) and one at its verdict.
  function sourceRows(rec) {
    var out = [];
    events(rec).forEach(function (ev) {
      if (!isObj(ev) || !isNum(ev.at) || typeof ev.exId !== 'string') return;
      var ch = ev.kind === 'plateau' ? ev.change : ev.kind;
      out.push({ t: ev.at, exId: ev.exId, data: { id: ev.id, phase: 'fire', change: ch } });
      if (isObj(ev.verdict) && isNum(ev.verdict.at)) out.push({ t: ev.verdict.at, exId: ev.exId, data: { id: ev.id, phase: 'verdict', change: ch, words: ev.verdict.words } });
    });
    return out;
  }

  /* ---------- registration and exports ---------- */

  E.plateau = {
    detect: detect, signals: signals, choose: choose, active: active, card: card, list: list, finish: finish, progress: progress,
    SIGNALS: SIGNALS, CHANGES: CHANGES, KINDS: KINDS, WORDS: WORDS,
    _: {
      context: context, stream: stream, fitLogit: fitLogit, slopeFit: slopeFit, rtChannel: rtChannel, atCeiling: atCeiling,
      verdictOf: verdictOf, followUp: followUp, windowStart: windowStart, openEvent: openEvent, tried: tried, fire: fire,
      startHook: startHook, kindHook: kindHook, pickHook: pickHook, excludeHook: excludeHook,
      repair: repair, fixEvent: fixEvent, mergeBox: mergeBox, convertLevels: convertLevels, sourceRows: sourceRows,
    },
  };

  if (E.modes && typeof E.modes.hook === 'function') {
    E.modes.hook('start', startHook, { id: 'plateau.share', order: 20 });
    E.modes.hook('kind', kindHook, { id: 'plateau.drill', order: 20 });
    E.modes.hook('pick', pickHook, { id: 'plateau.pick', order: 20 });
    E.modes.hook('finish', finish, { id: 'plateau.finish', order: 20 });
  }
  if (E.schedule && typeof E.schedule.hook === 'function') E.schedule.hook('exclude', excludeHook, { id: 'plateau.rest', order: 20 });
  if (E.rebase && typeof E.rebase.register === 'function') E.rebase.register(convertLevels);
  if (E.merge && typeof E.merge.register === 'function' && !(typeof E.merge.registered === 'function' && E.merge.registered().indexOf('plateau') >= 0)) {
    E.merge.register('plateau', mergeBox);
  }
  if (E.events && typeof E.events.define === 'function') {
    E.events.define('plateau', { owner: 'W2-plateau', fields: { id: 'token', phase: 'token', change: 'token', words: 'token' } });
    if (typeof E.events.source === 'function') E.events.source('plateau', sourceRows);
  }
  if (E.record && typeof E.record.check === 'function') E.record.check('plateau', repair);
})(window.PX);
