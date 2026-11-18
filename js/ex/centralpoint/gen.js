/* EX-20 Central Point: tap the spot closest to all the targets in total (pure; ARCHITECTURE.md §5; design:
   docs/research/v1.2/C1-central-point.md §3–§5, PLAN.md milestone 8 and its Defaults).

   The board. Targets sit on a 7 × 7 lattice of dots; answers lie on the 13 × 13 lattice of half-steps
   (every dot, every midpoint between two dots, every cell centre). Coordinates are in half-steps: x 0–12
   left to right, y 0–12 top to bottom, so a target's coordinates are even. A 7 × 7 answer grid collapses
   to "which neighbour of the average?" (C1 §4.3: the key sat next to the average's pick in 85–100 % of
   items), hence the half-steps. The response is { x, y } on that lattice (answer type 'point',
   CONTRACT-v1.2 A); the key is the best answer point.

   The task. The total distance S(p) = Σ |p − tᵢ| is convex with one minimum, the geometric median
   (Fermat–Weber point), unique because items never have collinear targets. An answer is right when
   S(answer) lies within the level's band of the best total on the answer lattice, S* = min S over the
   169 points: 1 %, 0.5 % or 0.25 % (C1 §3.3). Credit is 1 inside the band and falls linearly to 0 at
   four times the band; the rating uses right or wrong only, as for every exercise. Logged: value = the
   excess over S* in per cent; value2 = the correction ratio, the share of the way from the average
   position to the best spot that the answer covered (projection; 0 = the average, 1 = the best spot,
   above 1 = past it), which tracks the concept change the exercise bets on (C1 §3.3, §6).

   Rated items (C1 §3.2, §4.4–4.5, the strict policy). Dims targets 4–8 × band (15 cells), and on every
   rated item: (1) the trap: the average position lies at least 1 dot from the continuous best spot;
   (2) no target lies inside the band (the best spot is always empty: no "nearest target" or medoid
   shortcut); (3) none of the eleven cheap picks lies inside the band: grid centre, average, middle of
   the bounding box, column/row median, centre of the smallest circle round the targets, centroid of
   the convex hull, medoid, target nearest the centre, target nearest the average, centre of the
   densest group (targets within 1 dot, the spike's radius), average without the farthest target.
   A pick that falls exactly between two answer points counts both ways, and tied picks (two medoids)
   all count, so the policy does not depend on a rounding convention or the target order. (4) A margin:
   no answer point's excess lies within 1e-9 of the band's edge, so the set of right answers is the same
   in every engine. "Nudge the average towards the group" is partial skill, reported, not bounded
   (PLAN.md Defaults, C1 §9 #2).

   Generation. Rejection from a mixture of layouts (uniform; one group plus spread targets; two groups;
   C1 §4.1), cheapest and most selective tests first: a best spot on a target (the pulls test), the best
   spot by Newton from the average and the trap (if Newton does not settle, the lattice first, then
   Weiszfeld), the lattice totals from a table of square roots (169 × k look-ups) and targets in the
   band, the picks, the margin, and a band in one piece (8-neighbours). Acceptance is 0.5–9.7 % per
   candidate (C1 §9 #1), so one item draws up to MAX_TRIES candidates from its seeded stream, then falls
   back to a stored valid item for its cell (fallback: true; the player voids it). The node test reports
   p95 CPU time per cell (about 3.4 ms at 8 targets and 1 %, the slowest cell, on the build machine).
   validate() re-derives everything with separately written code: brute-force totals with Math.sqrt,
   the picks (other algorithms: Welzl's circle, a gift-wrapped hull, selection medians), Weiszfeld
   (Vardi–Zhang) for the best spot, and the cross-check that the continuous best spot is never worse
   than the best answer point and lies within a dot of it.

   Tutorial items (extraParams.task, never chosen by the engine; Reckon's pattern): 'watch' (the Watch:
   four targets close together inside a 3 × 3 block of dots and one far target), 'kite' (Try 1: four
   targets round a gap, where the diagonals cross), 'group' (Try 2: like the Watch, a new layout) and
   'loose' (Try 3: five targets under the strict policy). They use a 2 % band (C1 §3.2: practice cells, outside the
   rated pool); the Watch and Try 2 have a trap of at least 1 dot, Try 3 the strict policy and a trap of
   half a dot. The last Try item carries a 20 s deadline in the quick form (item.deadlineMs).

   Forms (variants; PLAN.md milestone 8, DECISIONS 18 Nov; CONTRACT-v1.2 A and E): 'quick' (the only
   form automatic choices use, trainVariants; a deadline from the engine's pace staircase that tightens
   as the player gets faster; one tap places the marker and a second tap or Confirm answers; a round
   score from closeness and pace, roundScore(); right for the rating is the band before the deadline)
   and 'exact' (an explicit pick in the Library and Free play: no deadline, drag and nudge controls,
   Confirm). Both use the same items.
   Difficulty (hand-set, provisional; C1 §3.2, logged in docs/dev/progress/W1-central.md): +0.25 logit
   per extra target, +0.6 per band level (the band moves accuracy most in the simulation, 0.3–0.5 per
   level, and human errors are assumed heavier-tailed than a Gaussian), and the exact form 0.6 easier
   (no deadline, fine control): at one rating it gets a band level tighter. The span is 2.2 logits per
   form, short of the guide's 4 (no human data; pooled exports refit it). The base is 0: a model observer
   who places the best spot with a 0.3-dot scatter gets about 61 % at the easiest cell (C1 §3.2), so the
   guide's 90 % at θ = 0 cannot be set honestly.

   Item (JSON): { ex: 'centralpoint', seed, params: { variant, targets, band, task? }, answer: 'point',
     form, targets: [[x, y], …] (half-steps, even), band (share), trapMin (dots), key: { x, y },
     gm: [x, y] (the continuous best spot, 6 decimals), fam, task?, deadlineMs?, fallback? } */
(function (PX) {
  'use strict';

  var sqrt = Math.sqrt, abs = Math.abs, floor = Math.floor, round = Math.round, isArray = Array.isArray;
  function isInt(x) { return typeof x === 'number' && isFinite(x) && floor(x) === x; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  /* ------------------------------------------------------------ board, levels and constants */
  var DOTS = 7, F = 2, N = 13, NP = 169, MID = 6;   // half-steps: N = (DOTS − 1)·F + 1
  var VARIANTS = ['quick', 'exact'];
  var TARGETS = [4, 5, 6, 7, 8];
  var BANDS = [0.01, 0.005, 0.0025];                // right within this share of the best total
  var TRAP = 1;                                     // dots: the average lies at least this far from the best spot
  var MODEL = { base: 0, target: 0.25, band: 0.6, exact: -0.6 };
  // chance(params): the mean share of answer points inside the band on generated items (the node test
  // re-measures it and checks these within 0.3 points); C1 §3.2 measured 1.3–1.8 / 0.9–1.2 / 0.7–0.9 %.
  var CHANCE = [0.0155, 0.0105, 0.0080];
  var MAX_TRIES = 4000;                             // candidates per item (acceptance 0.5–9 %)
  var MARGIN_GEN = 2e-9, MARGIN = 1e-9;             // band-edge margins: generator, validator
  var TIE = 1e-9;                                   // equal scores among the picks
  var HALF = 1e-9;                                  // a pick this close to a half step rounds both ways
  var DENSE_R = 2;                                  // half-steps: the densest group's radius (1 dot)
  var TRAP_EPS = 1e-6;                              // the generator asks for the trap plus this
  // Tutorial tasks (extraParams.task): unrated practice cells with a 2 % band (C1 §3.2, §5.4).
  var TASKS = {
    watch: { k: 5, band: 0.02, trap: 1, strict: false, deadlineMs: null },
    kite: { k: 4, band: 0.02, trap: 0, strict: false, deadlineMs: null },
    group: { k: 5, band: 0.02, trap: 1, strict: false, deadlineMs: null },
    loose: { k: 5, band: 0.02, trap: 0.5, strict: true, deadlineMs: 20000 },
  };
  var TASK_NAMES = ['watch', 'kite', 'group', 'loose'];
  // Quick form: the deadline (def.pace; the engine's staircase in js/engine/pace.js runs it). It starts
  // generous for a first gut estimate, moves 0.03 log10 down after any answer before the deadline and
  // 0.17 up after a time-out, so about 85 % of answers come in time: it follows the player's pace while
  // the band ladder follows accuracy. 2.5 s is about a confident tap, tap (C1 §5.5); hand-set.
  var PACE = { variants: ['quick'], startMs: 15000, minMs: 2500, maxMs: 30000, target: 0.85, step: 0.03 };
  var LATE = 0.25;                                  // the round score's pace factor for a marker left unconfirmed

  function clampInt(x, n) { x = isInt(x) ? x : 0; return x < 0 ? 0 : x >= n ? n - 1 : x; }
  function normParams(params) {
    var p = params || {};
    var out = { variant: VARIANTS.indexOf(p.variant) >= 0 ? p.variant : VARIANTS[0], targets: clampInt(p.targets, TARGETS.length), band: clampInt(p.band, BANDS.length) };
    if (TASK_NAMES.indexOf(p.task) >= 0) out.task = p.task;
    return out;
  }
  // The cell an item is built for: rated (dims) or a tutorial task.
  function cellOf(p) {
    if (p.task) { var t = TASKS[p.task]; return { k: t.k, band: t.band, trap: t.trap, strict: t.strict, task: p.task, deadlineMs: t.deadlineMs }; }
    return { k: TARGETS[p.targets], band: BANDS[p.band], trap: TRAP, strict: true, task: null, deadlineMs: null };
  }
  function difficulty(params) {
    var p = normParams(params);
    return MODEL.base + MODEL.target * p.targets + MODEL.band * p.band + (p.variant === 'exact' ? MODEL.exact : 0);
  }
  function chance(params) { var p = normParams(params); return p.task ? 0.03 : CHANCE[p.band]; }
  // Expected time from the first paint to the answer (schedule.js): quick about a gut estimate's
  // pace, exact longer (nudges and a check). Hand-set; trialTimes() adds the measured extra.
  function estMs(params) {
    var p = normParams(params), k = TARGETS[p.targets];
    return p.variant === 'exact' ? 12000 + 1500 * (k - 4) : 6000 + 750 * (k - 4);
  }

  /* ------------------------------------------------------------ the generator's fast path */
  // Square roots of a² + b² for a, b in 0..12, so a lattice total is 169 × k look-ups. Math.sqrt is
  // correctly rounded, so these are the very doubles a direct computation gives.
  var DT = new Float64Array(N * N);
  (function () { for (var a = 0; a < N; a++) for (var b = 0; b < N; b++) DT[a * N + b] = sqrt(a * a + b * b); })();
  var SB = new Float64Array(NP);
  function dtab(dx, dz) { return DT[(dx < 0 ? -dx : dx) * N + (dz < 0 ? -dz : dz)]; }
  function totalsFast(T, S) {
    var k = T.length, x, z, j, s;
    for (z = 0; z < N; z++) for (x = 0; x < N; x++) {
      s = 0;
      for (j = 0; j < k; j++) s += dtab(x - T[j][0], z - T[j][1]);
      S[z * N + x] = s;
    }
  }
  function totalAt(T, x, z) { var s = 0; for (var j = 0; j < T.length; j++) { var dx = x - T[j][0], dz = z - T[j][1]; s += sqrt(dx * dx + dz * dz); } return s; }
  function meanOf(T) { var x = 0, z = 0; for (var j = 0; j < T.length; j++) { x += T[j][0]; z += T[j][1]; } return [x / T.length, z / T.length]; }
  function collinear(T) {
    for (var j = 2; j < T.length; j++) {
      if ((T[1][0] - T[0][0]) * (T[j][1] - T[0][1]) - (T[1][1] - T[0][1]) * (T[j][0] - T[0][0]) !== 0) return false;
    }
    return true;
  }
  function clampN(v) { return v < 0 ? 0 : v > N - 1 ? N - 1 : v; }
  // Lattice values for one coordinate: both neighbours when it sits on a half step.
  function rounds(v) {
    var f = floor(v), d = v - f;
    if (abs(d - 0.5) < HALF) return [clampN(f), clampN(f + 1)];
    return [clampN(round(v))];
  }
  function snapAll(x, z, out) {
    var xs = rounds(x), zs = rounds(z);
    for (var a = 0; a < xs.length; a++) for (var b = 0; b < zs.length; b++) out.push(zs[b] * N + xs[a]);
  }
  // The eleven picks (C1 §4.1), as answer-point indices; ties and half steps give several.
  function picksFast(T, mean) {
    var k = T.length, out = [], i, j, d, best, xs = [], zs = [];
    out.push(MID * N + MID);                                            // grid centre
    snapAll(mean[0], mean[1], out);                                     // average
    var x0 = 99, x1 = -1, z0 = 99, z1 = -1;
    for (j = 0; j < k; j++) {
      xs.push(T[j][0]); zs.push(T[j][1]);
      if (T[j][0] < x0) x0 = T[j][0]; if (T[j][0] > x1) x1 = T[j][0];
      if (T[j][1] < z0) z0 = T[j][1]; if (T[j][1] > z1) z1 = T[j][1];
    }
    snapAll((x0 + x1) / 2, (z0 + z1) / 2, out);                         // middle of the bounding box
    snapAll(median1(xs), median1(zs), out);                             // column/row median
    var c = circleBrute(T); snapAll(c[0], c[1], out);                   // smallest circle's centre
    var hc = hullCentroidChain(T); snapAll(hc[0], hc[1], out);          // hull centroid
    var tot = [];                                                       // medoid
    for (i = 0; i < k; i++) { d = 0; for (j = 0; j < k; j++) d += dtab(T[i][0] - T[j][0], T[i][1] - T[j][1]); tot.push(d); }
    pushArgmin(T, tot, out);
    var dc = [], dm = [];                                               // nearest the centre, nearest the average
    for (i = 0; i < k; i++) {
      dc.push(dtab(T[i][0] - MID, T[i][1] - MID));
      var ax = T[i][0] - mean[0], az = T[i][1] - mean[1];
      dm.push(sqrt(ax * ax + az * az));
    }
    pushArgmin(T, dc, out);
    pushArgmin(T, dm, out);
    denseFast(T, out);                                                  // densest group
    if (k < 4) snapAll(mean[0], mean[1], out);                          // average without the farthest
    else {
      best = -1;
      for (i = 0; i < k; i++) if (dm[i] > best) best = dm[i];
      for (i = 0; i < k; i++) {
        if (dm[i] < best - TIE) continue;
        var sx = 0, sz = 0;
        for (j = 0; j < k; j++) if (j !== i) { sx += T[j][0]; sz += T[j][1]; }
        snapAll(sx / (k - 1), sz / (k - 1), out);
      }
    }
    return out;
  }
  function pushArgmin(T, v, out) {
    var m = Infinity, i;
    for (i = 0; i < v.length; i++) if (v[i] < m) m = v[i];
    for (i = 0; i < v.length; i++) if (v[i] <= m + TIE) out.push(T[i][1] * N + T[i][0]);
  }
  function median1(a) {
    var s = a.slice().sort(function (p, q) { return p - q; }), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  function denseFast(T, out) {
    var k = T.length, cnt = [], sum = [], i, j, d, bc = -1, bs = Infinity;
    for (i = 0; i < k; i++) {
      var c = 0, s = 0;
      for (j = 0; j < k; j++) { d = dtab(T[i][0] - T[j][0], T[i][1] - T[j][1]); if (d <= DENSE_R + 1e-9) { c++; s += d; } }
      cnt.push(c); sum.push(s);
      if (c > bc) { bc = c; bs = s; } else if (c === bc && s < bs) bs = s;
    }
    for (i = 0; i < k; i++) {
      if (cnt[i] !== bc || sum[i] > bs + TIE) continue;
      var x = 0, z = 0, n = 0;
      for (j = 0; j < k; j++) if (dtab(T[i][0] - T[j][0], T[i][1] - T[j][1]) <= DENSE_R + 1e-9) { x += T[j][0]; z += T[j][1]; n++; }
      snapAll(x / n, z / n, out);
    }
  }
  // Smallest enclosing circle by brute force over pairs and triples (k ≤ 8).
  function circleBrute(T) {
    var k = T.length, best = null, i, j, l;
    function covers(cx, cz, r) { for (var q = 0; q < k; q++) { var dx = T[q][0] - cx, dz = T[q][1] - cz; if (sqrt(dx * dx + dz * dz) > r + 1e-9) return false; } return true; }
    for (i = 0; i < k; i++) for (j = i + 1; j < k; j++) {
      var cx = (T[i][0] + T[j][0]) / 2, cz = (T[i][1] + T[j][1]) / 2, dx = T[i][0] - cx, dz = T[i][1] - cz, r = sqrt(dx * dx + dz * dz);
      if ((!best || r < best[2]) && covers(cx, cz, r)) best = [cx, cz, r];
    }
    for (i = 0; i < k; i++) for (j = i + 1; j < k; j++) for (l = j + 1; l < k; l++) {
      var c = circum(T[i], T[j], T[l]);
      if (c && (!best || c[2] < best[2]) && covers(c[0], c[1], c[2])) best = c;
    }
    return best || [T[0][0], T[0][1], 0];
  }
  function circum(a, b, c) {
    var d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (d === 0) return null;
    var a2 = a[0] * a[0] + a[1] * a[1], b2 = b[0] * b[0] + b[1] * b[1], c2 = c[0] * c[0] + c[1] * c[1];
    var ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
    var uz = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
    var dx = a[0] - ux, dz = a[1] - uz;
    return [ux, uz, sqrt(dx * dx + dz * dz)];
  }
  // Area centroid of the convex hull (monotone chain, then the shoelace formula).
  function hullCentroidChain(T) {
    var P = T.slice().sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; }), lo = [], up = [], i;
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    for (i = 0; i < P.length; i++) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], P[i]) <= 0) lo.pop(); lo.push(P[i]); }
    for (i = P.length - 1; i >= 0; i--) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], P[i]) <= 0) up.pop(); up.push(P[i]); }
    up.pop(); lo.pop();
    var H = lo.concat(up), A = 0, cx = 0, cz = 0;
    for (i = 0; i < H.length; i++) {
      var p = H[i], q = H[(i + 1) % H.length], c = p[0] * q[1] - q[0] * p[1];
      A += c; cx += (p[0] + q[0]) * c; cz += (p[1] + q[1]) * c;
    }
    return [cx / (3 * A), cz / (3 * A)];
  }
  // The continuous best spot: Newton with backtracking from a nearby answer point (fast when the best
  // spot lies between targets, which the policy guarantees), else Weiszfeld (Vardi–Zhang).
  function bestSpot(T, x0, z0) {
    var x = x0, z = z0, k = T.length, it, j, ok = true;
    for (it = 0; it < 40; it++) {
      var gx = 0, gz = 0, hxx = 0, hxz = 0, hzz = 0, s0 = 0;
      for (j = 0; j < k; j++) {
        var dx = T[j][0] - x, dz = T[j][1] - z, d = sqrt(dx * dx + dz * dz);
        if (d < 1e-9) { ok = false; break; }
        var ux = dx / d, uz = dz / d;
        gx -= ux; gz -= uz; hxx += (1 - ux * ux) / d; hxz -= ux * uz / d; hzz += (1 - uz * uz) / d; s0 += d;
      }
      if (!ok) break;
      var det = hxx * hzz - hxz * hxz;
      if (!(det > 1e-18)) { ok = false; break; }
      var sx = -(hzz * gx - hxz * gz) / det, sz = -(hxx * gz - hxz * gx) / det, t = 1;
      while (t > 1e-9 && totalAt(T, x + t * sx, z + t * sz) > s0) t /= 2;
      if (t <= 1e-9) break;
      x += t * sx; z += t * sz;
      if (abs(t * sx) + abs(t * sz) < 1e-13) break;
    }
    if (ok && resid(T, x, z) < 1e-8) return [x, z];
    return weiszfeld(T, 20000, 1e-13);
  }
  function resid(T, x, z) {
    var rx = 0, rz = 0;
    for (var j = 0; j < T.length; j++) { var dx = T[j][0] - x, dz = T[j][1] - z, d = sqrt(dx * dx + dz * dz); if (d < 1e-12) return Infinity; rx += dx / d; rz += dz / d; }
    return sqrt(rx * rx + rz * rz);
  }

  /* ------------------------------------------------------------ layouts (dots 0–6; C1 §4.1) */
  function addDot(T, used, cx, cz) {
    if (cx < 0 || cz < 0 || cx >= DOTS || cz >= DOTS) return false;
    var key = cz * DOTS + cx;
    if (used[key]) return false;
    used[key] = 1; T.push([cx, cz]); return true;
  }
  function anyDot(r, T, used, k) { while (T.length < k) addDot(T, used, r.int(0, DOTS - 1), r.int(0, DOTS - 1)); }
  function famUniform(r, k) { var T = [], used = {}; anyDot(r, T, used, k); return T; }
  // One group of a third to two thirds of the targets within 1.5 dots of a centre, the rest at least
  // 2.8 dots from it (anywhere, if the board has no room).
  function famCluster(r, k) {
    var T = [], used = {}, m = Math.max(2, Math.min(k - 1, r.int(Math.ceil(k / 3), floor(2 * k / 3))));
    var cx = r.int(0, DOTS - 1), cz = r.int(0, DOTS - 1), g = 0, x, z;
    while (T.length < m && g++ < 1000) { x = cx + r.int(-2, 2); z = cz + r.int(-2, 2); if ((x - cx) * (x - cx) + (z - cz) * (z - cz) <= 2.25) addDot(T, used, x, z); }
    g = 0;
    while (T.length < k && g++ < 5000) { x = r.int(0, DOTS - 1); z = r.int(0, DOTS - 1); if ((x - cx) * (x - cx) + (z - cz) * (z - cz) >= 7.84) addDot(T, used, x, z); }
    anyDot(r, T, used, k);
    return T;
  }
  // Two small groups (a third of the targets each, at least 3 dots apart), the rest anywhere.
  function famTwo(r, k) {
    var T = [], used = {}, ax = r.int(0, DOTS - 1), az = r.int(0, DOTS - 1), bx, bz, g = 0;
    do { bx = r.int(0, DOTS - 1); bz = r.int(0, DOTS - 1); } while ((ax - bx) * (ax - bx) + (az - bz) * (az - bz) < 9 && g++ < 100);
    var na = Math.max(1, floor(k / 3));
    g = 0; while (T.length < na && g++ < 500) addDot(T, used, ax + r.int(-1, 1), az + r.int(-1, 1));
    g = 0; while (T.length < 2 * na && g++ < 500) addDot(T, used, bx + r.int(-1, 1), bz + r.int(-1, 1));
    anyDot(r, T, used, k);
    return T;
  }
  var FAMS = ['uniform', 'cluster', 'two'];
  function mixture(r, k) {
    var u = r.next(), fam = u < 1 / 3 ? 'uniform' : u < 2 / 3 ? 'cluster' : 'two';
    return { fam: fam, D: fam === 'uniform' ? famUniform(r, k) : fam === 'cluster' ? famCluster(r, k) : famTwo(r, k) };
  }
  // Tutorial layouts. kite: four targets in convex position round a dot, on two crossing diagonals
  // (axis-aligned or at 45°), so the diagonals cross on that dot, the best spot (C1 §2.5 #4).
  // group: four targets inside a 3 × 3 block of dots and one far target (at least 4 dots from them).
  function tutorialLayout(r, task) {
    var T = [], used = {}, i;
    if (task === 'kite') {
      var cx = r.int(1, DOTS - 2), cz = r.int(1, DOTS - 2), diag = r.chance(0.5), arms = [];
      for (i = 0; i < 4; i++) arms.push(r.int(1, 3));
      var dirs = diag ? [[-1, -1], [1, 1], [1, -1], [-1, 1]] : [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (i = 0; i < 4; i++) if (!addDot(T, used, cx + dirs[i][0] * arms[i], cz + dirs[i][1] * arms[i])) return null;
      return { fam: 'kite', D: T };
    }
    if (task === 'watch' || task === 'group') {
      var gx = r.int(0, DOTS - 3), gz = r.int(0, DOTS - 3), g = 0;
      while (T.length < 4 && g++ < 200) addDot(T, used, gx + r.int(0, 2), gz + r.int(0, 2));
      if (T.length < 4) return null;
      var mx = (T[0][0] + T[1][0] + T[2][0] + T[3][0]) / 4, mz = (T[0][1] + T[1][1] + T[2][1] + T[3][1]) / 4, fx, fz;
      g = 0;
      do { fx = r.int(0, DOTS - 1); fz = r.int(0, DOTS - 1); } while (((fx - mx) * (fx - mx) + (fz - mz) * (fz - mz) < 16 || used[fz * DOTS + fx]) && g++ < 200);
      if (!addDot(T, used, fx, fz)) return null;
      return { fam: task, D: T };
    }
    return mixture(r, TASKS[task].k);
  }

  /* ------------------------------------------------------------ acceptance (the generator's checks) */
  var stats = { tried: 0, accepted: 0, fallbacks: 0, rescued: 0, fail: { collinear: 0, target: 0, trap: 0, pick: 0, margin: 0, far: 0, split: 0 } };
  function bump(why) { stats.fail[why]++; return null; }
  // The best spot sits on target j when the other targets' pulls on j sum to at most 1 (C1 §3.1);
  // such a layout always has a target in the band, so it is dropped before any solving.
  function vertexMedian(T) {
    var k = T.length, i, j;
    for (j = 0; j < k; j++) {
      var rx = 0, rz = 0;
      for (i = 0; i < k; i++) {
        if (i === j) continue;
        var dx = T[i][0] - T[j][0], dz = T[i][1] - T[j][1], d = dtab(dx, dz);
        rx += dx / d; rz += dz / d;
      }
      if (rx * rx + rz * rz <= 1 + 1e-9) return true;
    }
    return false;
  }
  // The band as one region of answer points (8-neighbours), holding the best point.
  function bandJoined(S, Sb, band, b) {
    var inB = new Uint8Array(NP), n = 0, q, got = 0, stack = [b];
    for (q = 0; q < NP; q++) if (S[q] / Sb - 1 <= band) { inB[q] = 1; n++; }
    inB[b] = 2;
    while (stack.length) {
      var c = stack.pop(), cx = c % N, cz = (c - cx) / N;
      got++;
      for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) {
        var nx = cx + dx, nz = cz + dz, nq = nz * N + nx;
        if (nx < 0 || nz < 0 || nx >= N || nz >= N || inB[nq] !== 1) continue;
        inB[nq] = 2; stack.push(nq);
      }
    }
    return got === n;
  }
  // Newton with backtracking from the average (one or two dots from the best spot on rated items);
  // null when it does not settle (a best spot hugging a target: that layout fails anyway).
  function spotFromMean(T, mean) {
    var x = mean[0], z = mean[1], k = T.length, it, j;
    for (it = 0; it < 60; it++) {
      var gx = 0, gz = 0, hxx = 0, hxz = 0, hzz = 0, s0 = 0;
      for (j = 0; j < k; j++) {
        var dx = T[j][0] - x, dz = T[j][1] - z, d = sqrt(dx * dx + dz * dz);
        if (d < 1e-9) return null;
        var ux = dx / d, uz = dz / d;
        gx -= ux; gz -= uz; hxx += (1 - ux * ux) / d; hxz -= ux * uz / d; hzz += (1 - uz * uz) / d; s0 += d;
      }
      var det = hxx * hzz - hxz * hxz;
      if (!(det > 1e-18)) return null;
      var sx = -(hzz * gx - hxz * gz) / det, sz = -(hxx * gz - hxz * gx) / det, t = 1;
      while (t > 1e-9 && totalAt(T, x + t * sx, z + t * sz) > s0) t /= 2;
      if (t <= 1e-9) break;
      x += t * sx; z += t * sz;
      if (abs(t * sx) + abs(t * sz) < 1e-13) break;
    }
    return resid(T, x, z) < 1e-8 ? [x, z] : null;
  }
  function accept(lay, cell, p) {
    var D = lay.D, k = D.length, T = [], j, e, band = cell.band;
    D.sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; }); // reading order: the order says nothing
    for (j = 0; j < k; j++) T.push([D[j][0] * F, D[j][1] * F]);
    if (collinear(T)) return bump('collinear');
    if (vertexMedian(T)) return bump('target');
    var mean = meanOf(T), gm = spotFromMean(T, mean), b = -1, Sb = Infinity;
    function lattice() {
      totalsFast(T, SB);
      b = 0; Sb = SB[0];
      for (var q = 1; q < NP; q++) if (SB[q] < Sb) { Sb = SB[q]; b = q; }
      for (var u = 0; u < k; u++) if (SB[T[u][1] * N + T[u][0]] / Sb - 1 <= band) return false;
      return true;
    }
    if (!gm) {
      // Newton from the average did not settle (the best spot hugs a target, usually): solve the
      // lattice first, then the best spot from the best answer point (Weiszfeld if need be).
      stats.rescued++;
      if (!lattice()) return bump('target');
      gm = bestSpot(T, b % N, (b - b % N) / N);
    }
    var tx = mean[0] - gm[0], tz = mean[1] - gm[1], trap = sqrt(tx * tx + tz * tz) / F;
    if (cell.trap > 0 && trap < cell.trap + TRAP_EPS) return bump('trap');
    if (b < 0 && !lattice()) return bump('target');
    if (cell.strict) {
      var picks = picksFast(T, mean);
      for (j = 0; j < picks.length; j++) if (SB[picks[j]] / Sb - 1 <= band) return bump('pick');
    }
    for (j = 0; j < NP; j++) { e = SB[j] / Sb - 1; if (abs(e - band) < MARGIN_GEN) return bump('margin'); }
    var bx = b % N, bz = (b - bx) / N, gx = gm[0] - bx, gz = gm[1] - bz;
    if (gx * gx + gz * gz > F * F) return bump('far'); // the best answer point lies within 1 dot of the best spot
    if (!bandJoined(SB, Sb, band, b)) return bump('split');
    stats.accepted++;
    var item = {
      ex: 'centralpoint', seed: 0, params: copyParams(p), answer: 'point', form: p.variant,
      targets: T, band: band, trapMin: cell.trap, key: { x: bx, y: bz },
      gm: [round(gm[0] * 1e6) / 1e6, round(gm[1] * 1e6) / 1e6], fam: lay.fam,
    };
    if (cell.task) { item.task = cell.task; if (cell.deadlineMs && p.variant === 'quick') item.deadlineMs = cell.deadlineMs; }
    return item;
  }
  function copyParams(p) { var o = { variant: p.variant, targets: p.targets, band: p.band }; if (p.task) o.task = p.task; return o; }
  function build(r, cell, p) {
    stats.tried++;
    var lay = cell.task ? tutorialLayout(r, cell.task) : mixture(r, cell.k);
    return lay ? accept(lay, cell, p) : null;
  }
  function generate(rng, params) {
    var p = normParams(params), cell = cellOf(p), item = null;
    for (var i = 0; i < MAX_TRIES && !item; i++) item = build(rng, cell, p);
    if (!item) { stats.fallbacks++; item = fallbackFor(p); }
    item.seed = rng.seed;
    return item;
  }
  // A valid item per cell from a fixed-seed search (the node test checks every cell), marked fallback.
  var fallbackCache = {};
  function fallbackFor(params) {
    var p = normParams(params), cell = cellOf(p), pk = PX.ex.paramsKey(p);
    for (var i = 0; i < 40 && !fallbackCache[pk]; i++) {
      var r = PX.rng(PX.rng.hash('centralpoint-fallback', pk, i));
      for (var j = 0; j < MAX_TRIES && !fallbackCache[pk]; j++) {
        var it = build(r, cell, p);
        if (it && validate(it) === true) fallbackCache[pk] = it;
      }
    }
    var out = JSON.parse(JSON.stringify(fallbackCache[pk]));
    out.fallback = true;
    return out;
  }

  /* ------------------------------------------------------------ the grading model (lib: score, view, tests) */
  // Totals at every answer point (Math.sqrt, targets in their stored order: the generator's table gives
  // the same doubles), the best total S*, the first best point and the band (indices z·13 + x).
  function solve(item) {
    var T = item.targets, S = new Array(NP), best = Infinity, key = 0, p, x, z, j, s, dx, dz;
    for (p = 0; p < NP; p++) {
      x = p % N; z = (p - x) / N; s = 0;
      for (j = 0; j < T.length; j++) { dx = x - T[j][0]; dz = z - T[j][1]; s += sqrt(dx * dx + dz * dz); }
      S[p] = s;
      if (s < best) { best = s; key = p; }
    }
    var band = [];
    for (p = 0; p < NP; p++) if (S[p] / best - 1 <= item.band) band.push(p);
    return { S: S, best: best, key: key, band: band };
  }
  // The continuous best spot from the average, Weiszfeld with the Vardi–Zhang step (converges from any
  // start, handles a best spot on a target): the model the view draws from (item.gm is its stored copy).
  function weiszfeld(T, maxIter, tol) {
    var m = meanOf(T), x = m[0], z = m[1], it, j;
    for (it = 0; it < (maxIter || 20000); it++) {
      var nx = 0, nz = 0, den = 0, rx = 0, rz = 0, eta = 0;
      for (j = 0; j < T.length; j++) {
        var dx = T[j][0] - x, dz = T[j][1] - z, d = sqrt(dx * dx + dz * dz);
        if (d < 1e-12) { eta += 1; continue; }
        nx += T[j][0] / d; nz += T[j][1] / d; den += 1 / d; rx += dx / d; rz += dz / d;
      }
      var tx = nx / den, tz = nz / den;
      if (eta > 0) {
        var rr = sqrt(rx * rx + rz * rz);
        if (rr <= eta) return [x, z];
        var a = Math.max(0, 1 - eta / rr), b = Math.min(1, eta / rr);
        tx = a * tx + b * x; tz = a * tz + b * z;
      }
      var step = abs(tx - x) + abs(tz - z);
      x = tx; z = tz;
      if (step < (tol || 1e-12)) break;
    }
    return [x, z];
  }
  // Equal pulls: the unit vector from (x, z) to every target (null on a target) and their sum, whose
  // direction is the way the total falls fastest (C1 §3.1); the sum is zero at the best spot.
  function pulls(T, x, z) {
    var u = [], sx = 0, sz = 0;
    for (var j = 0; j < T.length; j++) {
      var dx = T[j][0] - x, dz = T[j][1] - z, d = sqrt(dx * dx + dz * dz);
      if (d < 1e-9) { u.push(null); continue; }
      u.push([dx / d, dz / d]); sx += dx / d; sz += dz / d;
    }
    return { u: u, sum: [sx, sz] };
  }
  function credit(e, band) { return e <= band ? 1 : Math.max(0, 1 - (e - band) / (3 * band)); }
  // The share of the way from the average to the best spot that (x, z) covered (projection on that
  // line); null when the two are closer than a quarter of a dot (no trap to correct: Watch, kites).
  function correction(item, x, z) {
    var m = meanOf(item.targets), vx = item.gm[0] - m[0], vz = item.gm[1] - m[1], L2 = vx * vx + vz * vz;
    if (L2 < 0.25) return null;
    return ((x - m[0]) * vx + (z - m[1]) * vz) / L2;
  }
  // Quick's round score (def.roundScore; CONTRACT-v1.2 E): closeness (the credit) times pace, pace = 1
  // for an instant answer and ½ at the deadline, so a near miss still earns and a fast one earns more;
  // a marker left unconfirmed at the deadline earns a quarter of its closeness (confirming always pays);
  // untimed items (the exact form) earn their closeness. Never a lifetime total.
  function roundScore(item, result, info) {
    var cr = result && isNum(result.credit) ? result.credit : result && result.detail && isNum(result.detail.credit) ? result.detail.credit : 0;
    info = info || {};
    if (!(cr > 0)) return 0;
    if (info.timeout) return round(100 * cr * LATE);
    var dl = info.deadlineMs, rt = info.rtMs;
    if (!(isNum(dl) && dl > 0) || !isNum(rt)) return round(100 * cr);
    var pace = 0.5 + 0.5 * Math.max(0, Math.min(1, 1 - rt / dl));
    return round(100 * cr * pace);
  }
  // A level line of the total, S = level, as a closed polygon round the best spot: S grows along every
  // ray from its minimum (convex), so each ray is cut by bisection. Points may lie off the board (the
  // view clips them).
  function contour(T, gm, level, n) {
    var out = [], i, k;
    n = n || 72;
    for (i = 0; i < n; i++) {
      var a = 2 * Math.PI * i / n, ux = Math.cos(a), uz = Math.sin(a), lo = 0, hi = 1;
      while (totalAt(T, gm[0] + hi * ux, gm[1] + hi * uz) < level && hi < 64) hi *= 2;
      for (k = 0; k < 40; k++) { var mid = (lo + hi) / 2; if (totalAt(T, gm[0] + mid * ux, gm[1] + mid * uz) < level) lo = mid; else hi = mid; }
      out.push([gm[0] + hi * ux, gm[1] + hi * uz]);
    }
    return out;
  }

  /* ------------------------------------------------------------ validator (written apart from the generator) */
  // Re-derives everything from the stored targets: brute-force totals summed in reverse order (the
  // band-edge margin absorbs the rounding difference), the picks by other algorithms (selection
  // medians, Welzl's circle, a gift-wrapped hull with a triangle fan), its own Weiszfeld from the best
  // answer point, and the cross-checks of C1 §3.5. It never calls the generator's search.
  function validate(item) {
    try { return vCheck(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  function vDist(a, b) { var dx = a[0] - b[0], dz = a[1] - b[1]; return Math.sqrt(dx * dx + dz * dz); }
  function vCheck(item) {
    if (!item || item.ex !== 'centralpoint') return 'not a centralpoint item';
    var p = item.params;
    if (!p || VARIANTS.indexOf(p.variant) < 0 || !isInt(p.targets) || p.targets < 0 || p.targets >= TARGETS.length || !isInt(p.band) || p.band < 0 || p.band >= BANDS.length) return 'bad params';
    if (p.task !== undefined && TASK_NAMES.indexOf(p.task) < 0) return 'unknown task';
    var cell = cellOf(normParams(p));
    if (item.answer !== 'point' || item.form !== p.variant) return 'the answer type or form does not match';
    if (item.band !== cell.band || item.trapMin !== cell.trap) return 'the band or trap does not match the level';
    if ((item.task || null) !== cell.task) return 'the task does not match';
    var T = item.targets, k = cell.k, i, j, l, q;
    if (!isArray(T) || T.length !== k) return 'expected ' + k + ' targets';
    var seen = {};
    for (j = 0; j < k; j++) {
      var t = T[j];
      if (!isArray(t) || t.length !== 2 || !isInt(t[0]) || !isInt(t[1]) || t[0] < 0 || t[1] < 0 || t[0] >= N || t[1] >= N || t[0] % F || t[1] % F) return 'target ' + j + ' is not on a dot';
      if (seen[t[0] + ',' + t[1]]) return 'two targets on one dot';
      seen[t[0] + ',' + t[1]] = 1;
    }
    var flat = true;
    for (i = 0; i < k && flat; i++) for (j = i + 1; j < k && flat; j++) for (l = j + 1; l < k && flat; l++) {
      if ((T[j][0] - T[i][0]) * (T[l][1] - T[i][1]) - (T[j][1] - T[i][1]) * (T[l][0] - T[i][0]) !== 0) flat = false;
    }
    if (flat) return 'the targets lie on one line';
    var S = [], best = Infinity, x, z, s;
    for (z = 0; z < N; z++) for (x = 0; x < N; x++) {
      s = 0;
      for (j = k - 1; j >= 0; j--) s += vDist([x, z], T[j]);
      S.push(s);
      if (s < best) best = s;
    }
    var band = item.band, kq = item.key;
    function ex(i2) { return S[i2] / best - 1; }
    if (!kq || !isInt(kq.x) || !isInt(kq.y) || kq.x < 0 || kq.y < 0 || kq.x >= N || kq.y >= N) return 'bad key';
    var key = kq.y * N + kq.x;
    if (ex(key) > 1e-12) return 'the key is not the best answer point';
    for (q = 0; q < NP; q++) if (abs(ex(q) - band) < MARGIN) return 'answer point ' + q + ' sits on the band edge';
    for (j = 0; j < k; j++) if (ex(T[j][1] * N + T[j][0]) <= band) return 'target ' + j + ' lies inside the band';
    // the band is one region (8-neighbours) round the key
    var inB = {}, nb = 0, reach = {}, stack = [key], got = 0;
    for (q = 0; q < NP; q++) if (ex(q) <= band) { inB[q] = 1; nb++; }
    reach[key] = 1;
    while (stack.length) {
      var c = stack.pop(), cx = c % N, cz = (c - cx) / N;
      got++;
      for (var ddz = -1; ddz <= 1; ddz++) for (var ddx = -1; ddx <= 1; ddx++) {
        var nx = cx + ddx, nz = cz + ddz, nq = nz * N + nx;
        if (nx < 0 || nz < 0 || nx >= N || nz >= N || reach[nq] || !inB[nq]) continue;
        reach[nq] = 1; stack.push(nq);
      }
    }
    if (got !== nb) return 'the band falls apart';
    // the continuous best spot (its own Weiszfeld from the key) and the cross-checks
    var g = vWeiszfeld(T, [kq.x, kq.y]);
    if (!g) return 'Weiszfeld did not settle';
    var Sg = 0;
    for (j = 0; j < k; j++) Sg += vDist(g, T[j]);
    if (Sg > best * (1 + 1e-9)) return 'the continuous best spot is worse than the best answer point';
    if (!isArray(item.gm) || !(abs(item.gm[0] - g[0]) <= 1e-5) || !(abs(item.gm[1] - g[1]) <= 1e-5)) return 'the stored best spot is off';
    if (vDist(g, [kq.x, kq.y]) > F) return 'the best answer point lies more than a dot from the best spot';
    var m = [0, 0];
    for (j = 0; j < k; j++) { m[0] += T[j][0] / k; m[1] += T[j][1] / k; }
    if (cell.trap > 0 && vDist(m, g) / F < cell.trap) return 'the trap is ' + (vDist(m, g) / F).toFixed(3) + ' dots, under ' + cell.trap;
    if (cell.strict) {
      var P = vPicks(T);
      for (var name in P) for (q = 0; q < P[name].length; q++) if (ex(P[name][q]) <= band) return 'the shortcut "' + name + '" lands in the band';
    }
    var wantDl = cell.deadlineMs && p.variant === 'quick' ? cell.deadlineMs : undefined;
    if (item.deadlineMs !== wantDl) return 'the deadline does not match';
    return true;
  }
  // Vardi–Zhang Weiszfeld from a given start; null if it has not settled.
  function vWeiszfeld(T, start) {
    var x = start[0], z = start[1], k = T.length;
    for (var it = 0; it < 200000; it++) {
      var wx = 0, wz = 0, w = 0, rx = 0, rz = 0, at = 0;
      for (var j = 0; j < k; j++) {
        var d = vDist([x, z], T[j]);
        if (d < 1e-12) { at++; continue; }
        wx += T[j][0] / d; wz += T[j][1] / d; w += 1 / d; rx += (T[j][0] - x) / d; rz += (T[j][1] - z) / d;
      }
      var nx = wx / w, nz = wz / w;
      if (at) {
        var r = Math.sqrt(rx * rx + rz * rz);
        if (r <= at) return [x, z];
        nx = (1 - at / r) * nx + (at / r) * x; nz = (1 - at / r) * nz + (at / r) * z;
      }
      var moved = Math.sqrt((nx - x) * (nx - x) + (nz - z) * (nz - z));
      x = nx; z = nz;
      if (moved < 1e-12) return [x, z];
    }
    return null;
  }
  // Lattice points a person could take for (x, z): both when a coordinate sits half-way.
  function vSnap(x, z) {
    function cand(v) {
      var lo = Math.floor(v);
      var c = Math.abs(v - lo - 0.5) < HALF ? [lo, lo + 1] : [Math.round(v)];
      return c.map(function (u) { return Math.min(N - 1, Math.max(0, u)); });
    }
    var out = [];
    cand(x).forEach(function (a) { cand(z).forEach(function (b) { out.push(b * N + a); }); });
    return out;
  }
  function vSelectMedian(vals) {
    var a = vals.slice(), n = a.length, i;
    function takeMin() { var bi = 0; for (var u = 1; u < a.length; u++) if (a[u] < a[bi]) bi = u; return a.splice(bi, 1)[0]; }
    for (i = 0; i < floor((n - 1) / 2); i++) takeMin();
    var lo = takeMin();
    return n % 2 ? lo : (lo + takeMin()) / 2;
  }
  function vCircle(T) {
    function inside(c, pt) { return vDist([c[0], c[1]], pt) <= c[2] + 1e-9; }
    function two(a, b) { var c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; return [c[0], c[1], vDist(c, a)]; }
    function three(a, b, c) {
      var bx = b[0] - a[0], bz = b[1] - a[1], cx = c[0] - a[0], cz = c[1] - a[1], d = 2 * (bx * cz - bz * cx);
      if (d === 0) { var w = [two(a, b), two(a, c), two(b, c)]; w.sort(function (u, v) { return v[2] - u[2]; }); return w[0]; }
      var b2 = bx * bx + bz * bz, c2 = cx * cx + cz * cz, ux = (cz * b2 - bz * c2) / d, uz = (bx * c2 - cx * b2) / d;
      return [a[0] + ux, a[1] + uz, Math.sqrt(ux * ux + uz * uz)];
    }
    var c = null;
    for (var i = 0; i < T.length; i++) {
      if (c && inside(c, T[i])) continue;
      c = [T[i][0], T[i][1], 0];
      for (var j = 0; j < i; j++) {
        if (inside(c, T[j])) continue;
        c = two(T[i], T[j]);
        for (var l = 0; l < j; l++) if (!inside(c, T[l])) c = three(T[i], T[j], T[l]);
      }
    }
    return c;
  }
  function vHullCentroid(T) {
    var k = T.length, start = 0, i;
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    function d2(a, b) { return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]); }
    for (i = 1; i < k; i++) if (T[i][0] < T[start][0] || (T[i][0] === T[start][0] && T[i][1] < T[start][1])) start = i;
    var H = [], cur = start, guard = 0;
    do {
      H.push(T[cur]);
      var nxt = cur === 0 ? 1 : 0;
      for (i = 0; i < k; i++) {
        if (i === cur) continue;
        var cr = cross(T[cur], T[nxt], T[i]);
        if (cr < 0 || (cr === 0 && d2(T[cur], T[i]) > d2(T[cur], T[nxt]))) nxt = i;
      }
      cur = nxt;
    } while (cur !== start && ++guard <= k);
    var A = 0, cx = 0, cz = 0;
    for (i = 1; i + 1 < H.length; i++) {
      var a = cross(H[0], H[i], H[i + 1]) / 2;
      A += a; cx += a * (H[0][0] + H[i][0] + H[i + 1][0]) / 3; cz += a * (H[0][1] + H[i][1] + H[i + 1][1]) / 3;
    }
    return [cx / A, cz / A];
  }
  // The eleven picks by name, each a list of answer points (lib.picks for the tests and the reports).
  function vPicks(T) {
    var k = T.length, m = [0, 0], i, j, out = {};
    for (j = 0; j < k; j++) { m[0] += T[j][0]; m[1] += T[j][1]; }
    m = [m[0] / k, m[1] / k];
    function nearest(score) { // every target within TIE of the least score
      var v = T.map(score), lo = Math.min.apply(null, v), res = [];
      v.forEach(function (s, u) { if (s <= lo + TIE) res.push(T[u][1] * N + T[u][0]); });
      return res;
    }
    out.gridCentre = [MID * N + MID];
    out.average = vSnap(m[0], m[1]);
    var xs = T.map(function (t) { return t[0]; }), zs = T.map(function (t) { return t[1]; });
    out.box = vSnap((Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, (Math.min.apply(null, zs) + Math.max.apply(null, zs)) / 2);
    out.colRowMedian = vSnap(vSelectMedian(xs), vSelectMedian(zs));
    var c = vCircle(T);
    out.circle = vSnap(c[0], c[1]);
    var h = vHullCentroid(T);
    out.hull = vSnap(h[0], h[1]);
    out.medoid = nearest(function (t) { var s = 0; T.forEach(function (o) { s += vDist(t, o); }); return s; });
    out.nearCentre = nearest(function (t) { return vDist(t, [MID, MID]); });
    out.nearAverage = nearest(function (t) { return vDist(t, m); });
    var groups = T.map(function (t) {
      var mem = T.filter(function (o) { return vDist(t, o) <= DENSE_R + 1e-9; }), s = 0;
      mem.forEach(function (o) { s += vDist(t, o); });
      return { n: mem.length, s: s, mem: mem };
    });
    var top = Math.max.apply(null, groups.map(function (g2) { return g2.n; }));
    var low = Math.min.apply(null, groups.filter(function (g2) { return g2.n === top; }).map(function (g2) { return g2.s; }));
    out.dense = [];
    groups.forEach(function (g2) {
      if (g2.n !== top || g2.s > low + TIE) return;
      var gx = 0, gz = 0;
      g2.mem.forEach(function (o) { gx += o[0]; gz += o[1]; });
      out.dense = out.dense.concat(vSnap(gx / g2.n, gz / g2.n));
    });
    if (k < 4) out.trimmed = out.average.slice();
    else {
      var far = T.map(function (t) { return vDist(t, m); }), hi = Math.max.apply(null, far);
      out.trimmed = [];
      for (i = 0; i < k; i++) {
        if (far[i] < hi - TIE) continue;
        var tx = 0, tz = 0;
        for (j = 0; j < k; j++) if (j !== i) { tx += T[j][0]; tz += T[j][1]; }
        out.trimmed = out.trimmed.concat(vSnap(tx / (k - 1), tz / (k - 1)));
      }
    }
    return out;
  }

  /* ------------------------------------------------------------ scorer */
  // response: { x, y } on the answer lattice. Right when its total lies within the band of the best;
  // value = the excess in per cent (2 decimals), value2 = the correction ratio (3 decimals, when the
  // item has a trap to correct); detail: excess, credit, the two totals in dots, the band.
  function score(item, response) {
    if (!item || !isArray(item.targets) || !isNum(item.band) || !response || typeof response !== 'object') return { correct: false };
    var x = response.x, y = response.y;
    if (!isInt(x) || !isInt(y) || x < 0 || y < 0 || x >= N || y >= N) return { correct: false };
    var sol = solve(item), e = sol.S[y * N + x] / sol.best - 1;
    if (e < 0) e = 0;
    var c = credit(e, item.band);
    var out = {
      correct: e <= item.band, value: round(e * 1e4) / 100, credit: c,
      detail: { excess: e, credit: c, total: sol.S[y * N + x] / F, best: sol.best / F, band: item.band },
    };
    var cr = isArray(item.gm) ? correction(item, x, y) : null;
    if (cr !== null && isNum(cr)) out.value2 = round(cr * 1000) / 1000;
    return out;
  }

  /* ------------------------------------------------------------ definition */
  PX.ex.define({
    id: 'centralpoint', version: 1, code: 'EX-20', name: 'Central Point', short: 'Central Point',
    // LE: judging distances by eye (the nearest CHC narrow ability), then Vz: weighing a layout's pulls.
    // Extrinsic-static: a place relative to several others, nothing moves.
    abilities: ['LE', 'Vz'], cell: 'extrinsic-static', role: 'train', answer: 'point',
    bet: 'calibrate', // docs/research/v1.2/T1-transfer-portfolio.md §3.3
    variants: VARIANTS.slice(), trainVariants: ['quick'], pace: PACE, roundScore: roundScore, extraParams: ['task'],
    dims: [
      // +0.25 logit per extra target: more pulls to balance (no human data; the simulated observers
      // barely felt it, C1 §3.2).
      { key: 'targets', label: 'Targets', levels: TARGETS.slice(), step: MODEL.target },
      // +0.6 logit per level: the simulated observers lost 0.3–0.5 per level; heavier human tails assumed.
      { key: 'band', label: 'Precision', levels: [1, 0.5, 0.25], step: MODEL.band, unit: '%' },
    ],
    base: MODEL.base, difficulty: difficulty, chance: chance, estMs: estMs,
    generate: generate, validate: validate, score: score,
    lib: {
      DOTS: DOTS, F: F, N: N, NP: NP, MID: MID, TARGETS: TARGETS, BANDS: BANDS, TRAP: TRAP, TASKS: TASKS, PACE: PACE, LATE: LATE,
      MODEL: MODEL, CHANCE: CHANCE, MAX_TRIES: MAX_TRIES, DENSE_R: DENSE_R, VARIANTS: VARIANTS,
      normParams: normParams, cellOf: cellOf, solve: solve, weiszfeld: weiszfeld, pulls: pulls, total: totalAt,
      mean: meanOf, credit: credit, correction: correction, roundScore: roundScore,
      contour: contour,
      picks: vPicks, picksFast: picksFast, bestSpot: bestSpot, fallbackFor: fallbackFor, stats: stats,
    },
  });
})(window.PX);
