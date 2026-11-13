/* EX-16 Angles: rank four angles from smallest to largest (pure; ARCHITECTURE.md §5,
   docs/research/v1.1/R3-dat-pat.md §3.3, §8.3). Perceptual-judgement practice (labelled as such,
   like Track's attention practice): angle ranking is a perceptual drill, and practice tends to stay
   specific to the trained stimuli, so no transfer beyond the format is claimed.

   The item. Four numbered angles (two straight arms from a vertex, no arc: an arc's size would be
   a cue), each in its own square cell (coordinates in cell units, x right, y down). The options are
   four orderings of the numbers, smallest angle first ("3 – 1 – 4 – 2"); exactly one is true.

   Values. The four sizes sit in one size class: near-right (70–110°), acute (25–72°) or obtuse
   (108–155°). Adjacent ranks differ by gaps; the closest gap is the level's δ (6, 5, 4, 3 or 2°)
   and the other two are κ·δ with κ in [1.3, 1.6] (wider spans make tip distance and enclosed
   area follow the angle, see below). The ranks are assigned to the four cells at
   random. The smallest gap on any screen is 2°: R3 asks for a 2° floor on phones (at 90 CSS px a
   2° gap moves a tip by about 3 px), and the generator cannot see the screen, so the floor holds
   everywhere (perDisplay keeps a rating per screen class).

   What has to be resolved (dim `resolve`, R3 §8.3, after Kaplan's elimination strategy). A foil
   is ruled out by any pair it orders wrongly; the easiest such pair is its widest one.
     0  the closest pair is the middle one and every foil differs from the key in its smallest or
        largest angle: the extremes alone separate the key;
     1  the closest pair sits at one end, and one foil swaps only the middle pair (its gap κ·δ);
        no foil hinges on the closest pair;
     2  one foil swaps only the closest pair (gap δ), so that pair has to be judged.
   The foils are then chosen (over every allowed triple) so that the key's rank on total Kendall
   distance to the other options meets a random target: neither "most like the others" nor "odd
   one out" finds it more than about one time in four.

   Arms are drawn after the angles, in [0.3, 1]·L. A quick look could rank by a cue instead of
   the angle: the tip distance, the enclosed area, the arm-length sum, the longer or the shorter
   arm, each either way round; a cue "answers" with the option nearest its order. Every cue gets a
   random target option, and of 400 random arm sets the one whose cues land nearest their targets
   is kept (tip distance weighted 2.5, area 1.5), so no cue picks the key much more than one time
   in four. Within an item the angles differ by up to 4.2·δ, so tip distance, area and arm length
   cannot all be independent of size at the widest gaps (one follows the angle, or the arms must
   shrink as it grows); the weights share that out, and the node test bounds every cue. The widest
   closest gap is 6°, not the 8° R3 lists, for the same reason.
   Pose (dim): aligned (one arm horizontal, the "laser" comparison against a shared base: easier)
   or free (any rotation). Each angle's rotation is the best-fitting of a few random tries, and the
   item's scale L is the largest that fits all four cells with a margin.

   Exactness. Every coordinate comes from deterministic sin/cos polynomials (+ − × ÷ and sqrt
   only), so items are bit-identical in every engine. validate re-measures each angle from the
   drawn endpoints: the order from cosines (dot products and Math.sqrt, no trigonometry, so it is
   exact) and the gaps from a deterministic atan2.

   Difficulty (hand-set; refit from pooled exports): gap 6 → 2° (0.55 per level: the levels are
   roughly even steps in log δ, and discrimination scales with the gap; thresholds of 5–11° for
   single comparisons, Dillon et al. 2019), size near-right → acute → obtuse (0.3; discrimination
   is best near 90°, Dillon et al. 2019; Chen & Levi 1996), resolve 0 → 2 (0.45), pose aligned →
   free (0.3). Base −2.2: the easiest item is about 90 % right at θ = 0 with 4 options; the range
   is 4.0 logits.

   Item: { ex: 'angles', v: 1, seed, params, key, angles: [{ v: [x, y], a: [x, y], b: [x, y] }] (by
   cell, numbered 1–4 on screen), deg: [design degrees by cell], order: [cells, smallest first],
   options: [[cells, smallest first] × 4], gaps: [three adjacent gaps by rank], close: index of the
   closest gap, scale }. */
(function (PX) {
  'use strict';

  var Mth = Math, floor = Mth.floor, abs = Mth.abs, sqrt = Mth.sqrt, isArray = Array.isArray, isInt = Number.isInteger;
  var PI = Mth.PI, DEG = PI / 180, HALF_PI = PI / 2, SQRT3 = sqrt(3);

  var GAPS = [6, 5, 4, 3, 2];
  var SIZES = ['right', 'acute', 'obtuse'];
  var RESOLVE = ['extremes', 'middle', 'closest']; // what has to be judged to find the key (see above)
  var POSES = ['aligned', 'free'];
  var RANGE = { right: [70, 110], acute: [25, 72], obtuse: [108, 155] };
  var KAPPA = [1.3, 1.6];
  var ARM = [0.3, 1.0];
  // The longer arm of each angle is at least LONG_MIN·L (see the header), and the cue weights of
  // chooseArms: tip distance, area, arm sum, longer arm, shorter arm, vertex to the tips' midpoint.
  var LONG_MIN = 0.3;
  var CUE_W = [2.5, 1.5, 1, 1, 1, 2];
  function armMin() { return ARM[0]; }
  var MARGIN = 0.07, LMAX = 0.9, MIN_ARM = 0.1, FLOOR = 2, TOL = 0.02;

  /* ---------- deterministic trigonometry (degrees) ---------- */

  function sinPoly(y) {
    var y2 = y * y;
    return y * (1 - y2 / 6 * (1 - y2 / 20 * (1 - y2 / 42 * (1 - y2 / 72 * (1 - y2 / 110 * (1 - y2 / 156 * (1 - y2 / 210)))))));
  }
  function cosPoly(y) {
    var y2 = y * y;
    return 1 - y2 / 2 * (1 - y2 / 12 * (1 - y2 / 30 * (1 - y2 / 56 * (1 - y2 / 90 * (1 - y2 / 132 * (1 - y2 / 182))))));
  }
  // [sin, cos] of an angle in degrees; exact at multiples of 90°.
  function sincos(deg) {
    var q = Mth.round(deg / 90), y = (deg - 90 * q) * DEG, s = sinPoly(y), c = cosPoly(y);
    q = ((q % 4) + 4) % 4;
    return q === 0 ? [s, c] : q === 1 ? [c, -s] : q === 2 ? [-s, -c] : [-c, s];
  }
  function atanSmall(t) { var t2 = t * t, s = 0; for (var k = 21; k >= 1; k -= 2) s = 1 / k - t2 * s; return t * s; }
  function atan(t) {
    var neg = t < 0; if (neg) t = -t;
    var inv = t > 1; if (inv) t = 1 / t;
    var a = t > 0.2679491924311227 ? PI / 6 + atanSmall((t * SQRT3 - 1) / (t + SQRT3)) : atanSmall(t);
    if (inv) a = HALF_PI - a;
    return neg ? -a : a;
  }
  // Degrees in (−180, 180].
  function atan2d(y, x) {
    var r;
    if (x > 0) r = atan(y / x);
    else if (x < 0) r = y >= 0 ? atan(y / x) + PI : atan(y / x) - PI;
    else r = y > 0 ? HALF_PI : y < 0 ? -HALF_PI : 0;
    return r / DEG;
  }

  /* ---------- small helpers ---------- */

  function rint(r, n) { return floor(r.next() * n); }
  function shuffle(r, arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) { var j = floor(r.next() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }
  function rnd(x, f) { return Mth.round(x * f) / f; }
  var PERMS = (function () {
    var out = [];
    (function rec(cur, left) {
      if (!left.length) { out.push(cur); return; }
      left.forEach(function (x, i) { rec(cur.concat([x]), left.slice(0, i).concat(left.slice(i + 1))); });
    })([], [0, 1, 2, 3]);
    return out;
  })();
  function same(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]; }
  // Kendall distance: pairs ordered differently by two orderings of the same four things.
  function kendall(a, b) {
    var pos = [0, 0, 0, 0], d = 0, i, j;
    for (i = 0; i < 4; i++) pos[b[i]] = i;
    for (i = 0; i < 4; i++) for (j = i + 1; j < 4; j++) if (pos[a[i]] > pos[a[j]]) d++;
    return d;
  }
  // The order (indices, smallest value first) of four numbers; ties by index.
  function orderOf(vals) {
    return [0, 1, 2, 3].sort(function (i, j) { return vals[i] - vals[j] || i - j; });
  }
  // Pairs (x, y) that ordering o puts wrongly, given the true ascending sizes deg (by thing).
  function widestWrong(o, deg) {
    var e = 0;
    for (var i = 0; i < 4; i++) for (var j = i + 1; j < 4; j++) {
      if (deg[o[i]] > deg[o[j]]) e = Mth.max(e, deg[o[i]] - deg[o[j]]);
    }
    return e;
  }

  function normParams(params) {
    var p = {};
    [['gap', GAPS], ['size', SIZES], ['resolve', RESOLVE], ['pose', POSES]].forEach(function (d) {
      var v = params ? params[d[0]] : 0;
      p[d[0]] = isInt(v) && v >= 0 && v < d[1].length ? v : 0;
    });
    return p;
  }

  /* ---------- generator ---------- */

  // Foil orderings (of ranks 0..3) allowed by the resolve level; key = [0, 1, 2, 3].
  function allowedFoils(res, close) {
    var key = [0, 1, 2, 3], middle = [0, 2, 1, 3], swapClose = key.slice();
    swapClose[close] = close + 1; swapClose[close + 1] = close;
    return PERMS.filter(function (o) {
      if (same(o, key)) return false;
      if (res === 0) return o[0] !== 0 || o[3] !== 3;
      if (res === 1) return !same(o, swapClose);
      return true;
    });
  }
  function mustHave(res, close) {
    if (res === 1) return [0, 2, 1, 3];
    if (res === 2) { var s = [0, 1, 2, 3]; s[close] = close + 1; s[close + 1] = close; return s; }
    return null;
  }
  // Answer-only heuristics read the four lists and never the angles. Tables over the 24 orderings
  // (Kendall distance, positions in common, ordered neighbour pairs as bits) keep them cheap.
  var KD = [], PA = [], AD = [];
  PERMS.forEach(function (a, i) {
    var m = 0, q;
    for (q = 0; q < 3; q++) m |= 1 << (a[q] * 4 + a[q + 1]);
    AD.push(m); KD.push([]); PA.push([]);
    PERMS.forEach(function (b) {
      var pa = 0;
      for (q = 0; q < 4; q++) if (a[q] === b[q]) pa++;
      KD[i].push(kendall(a, b)); PA[i].push(pa);
    });
  });
  var PERM_ID = {};
  PERMS.forEach(function (o, i) { PERM_ID[o.join()] = i; });
  function popc(x) { var c = 0; while (x) { x &= x - 1; c++; } return c; }
  // The chance that a pick-the-best rule with these scores lands on option 0 (ties shared).
  function hit0(sc, larger) {
    var best = sc[0], i, t = 0;
    for (i = 1; i < 4; i++) if (larger ? sc[i] > best : sc[i] < best) best = sc[i];
    if (sc[0] !== best) return 0;
    for (i = 0; i < 4; i++) if (sc[i] === best) t++;
    return 1 / t;
  }
  // For four orderings (ids into PERMS, the key first): how often each answer-only rule picks the
  // key. The rules (RV-dat-style-A §3): has another option one swap away; first and last numbers
  // most / least common; first number most common; last number most common; fewest / most ordered
  // neighbour pairs shared with the others; most / fewest positions in common; smallest / largest
  // total Kendall distance (most like the others / odd one out).
  function answerHits(ids) {
    var s1 = [], fl = [], f1 = [], l1 = [], ad = [], pa = [], kt = [], i, j;
    for (i = 0; i < 4; i++) {
      var a = PERMS[ids[i]], d1 = 0, f = 0, l = 0, sh = 0, ag = 0, k = 0;
      for (j = 0; j < 4; j++) {
        var b = PERMS[ids[j]];
        if (a[0] === b[0]) f++;
        if (a[3] === b[3]) l++;
        if (j === i) continue;
        if (KD[ids[i]][ids[j]] === 1) d1 = 1;
        sh += popc(AD[ids[i]] & AD[ids[j]]);
        ag += PA[ids[i]][ids[j]];
        k += KD[ids[i]][ids[j]];
      }
      s1.push(d1); fl.push(f + l); f1.push(f); l1.push(l); ad.push(sh); pa.push(ag); kt.push(k);
    }
    return [hit0(s1, true), hit0(fl, true), hit0(fl, false), hit0(f1, true), hit0(l1, true), hit0(ad, false), hit0(ad, true),
      hit0(pa, true), hit0(pa, false), hit0(kt, false), hit0(kt, true)];
  }
  // Three foils: every allowed triple containing the required foil is scored by how far each
  // answer-only rule's chance of picking the key is from one in four (summed); one triple is drawn
  // at random from those within 0.5 of the best score. The one-swap foil the resolve level needs
  // is then never the key's only near twin, and the first and last numbers do not point to the key.
  function chooseFoils(r, res, close) {
    var cand = allowedFoils(res, close), need = mustHave(res, close), K0 = PERM_ID['0,1,2,3'];
    var ids = cand.map(function (o) { return PERM_ID[o.join()]; }), needId = need ? PERM_ID[need.join()] : -1;
    var scored = [], minCost = Infinity, a, b, c;
    for (a = 0; a < ids.length; a++) for (b = a + 1; b < ids.length; b++) for (c = b + 1; c < ids.length; c++) {
      if (needId >= 0 && ids[a] !== needId && ids[b] !== needId && ids[c] !== needId) continue;
      var h = answerHits([K0, ids[a], ids[b], ids[c]]), cost = 0;
      for (var q = 0; q < h.length; q++) cost += abs(h[q] - 0.25);
      scored.push([cost, a, b, c]);
      if (cost < minCost) minCost = cost;
    }
    var ok = scored.filter(function (x) { return x[0] <= minCost + 0.5 + 1e-9; });
    if (!ok.length) return null;
    var pick = ok[rint(r, ok.length)];
    return [cand[pick[1]], cand[pick[2]], cand[pick[3]]];
  }

  // Arm lengths (relative to L). Cues a quick look could rank by instead of the angle: the tip
  // distance, the enclosed area, the arm-length sum, the longer and the shorter arm, each read
  // either way round. A cue "answers" with the option nearest (Kendall) to the order it gives. Every
  // cue gets a random target option, and of 400 random arm sets the one whose cues land nearest
  // their targets is kept, so each cue picks each option about equally often (one time in four).
  function cueHit(vals, sign, opts, target) {
    var pred = orderOf(sign > 0 ? vals : vals.map(function (x) { return -x; })), best = 7, ties = 0, hit = false;
    for (var o = 0; o < 4; o++) {
      var d = kendall(opts[o], pred);
      if (d < best) { best = d; ties = 1; hit = o === target; } else if (d === best) { ties++; if (o === target) hit = true; }
    }
    return hit ? 1 - 1 / ties : 1;
  }
  function chooseArms(r, deg, opts, lo) {
    var targets = [], t, NC = CUE_W.length;
    for (t = 0; t < 2 * NC; t++) targets.push(rint(r, 4));
    var cs = deg.map(function (d) { return sincos(d); }), best = null, bestCost = Infinity;
    for (var k = 0; k < 400 && bestCost > 0; k++) {
      var arms = [], cue = [[], [], [], [], [], []];
      for (var i = 0; i < 4; i++) {
        var a1, a2;
        do {
          a1 = rnd(lo + r.next() * (ARM[1] - lo), 1000); a2 = rnd(lo + r.next() * (ARM[1] - lo), 1000);
        } while ((a1 > a2 ? a1 : a2) < LONG_MIN);
        arms.push([a1, a2]);
        var cr = 2 * a1 * a2 * cs[i][1];
        cue[0].push(sqrt(a1 * a1 + a2 * a2 - cr));     // tip distance
        cue[1].push(a1 * a2 * cs[i][0]);               // enclosed area (×2)
        cue[2].push(a1 + a2);                          // arm-length sum
        cue[3].push(a1 > a2 ? a1 : a2);                // longer arm
        cue[4].push(a1 > a2 ? a2 : a1);                // shorter arm
        cue[5].push(sqrt(a1 * a1 + a2 * a2 + cr));     // vertex to the tips' midpoint (×2)
      }
      var cost = 0;
      for (t = 0; t < 2 * NC && cost < bestCost; t++) cost += CUE_W[t >> 1] * cueHit(cue[t >> 1], t & 1 ? -1 : 1, opts, targets[t]);
      if (cost < bestCost) { bestCost = cost; best = arms; }
    }
    return best;
  }

  // The bounding box of an angle drawn from the origin: arm 1 at direction phi, arm 2 at phi + s·θ.
  function figure(a1, a2, theta, phi, s) {
    var u = sincos(phi), w = sincos(phi + s * theta);
    var A = [a1 * u[1], a1 * u[0]], B = [a2 * w[1], a2 * w[0]];
    var x0 = Mth.min(0, A[0], B[0]), x1 = Mth.max(0, A[0], B[0]), y0 = Mth.min(0, A[1], B[1]), y1 = Mth.max(0, A[1], B[1]);
    return { A: A, B: B, box: [x0, y0, x1, y1], fit: (1 - 2 * MARGIN) / Mth.max(x1 - x0, y1 - y0) };
  }
  function choosePose(r, a1, a2, theta, aligned) {
    var tries = [], k;
    if (aligned) {
      for (k = 0; k < 8; k++) {
        var swap = k & 4, phi = k & 1 ? 180 : 0, s = k & 2 ? -1 : 1;
        tries.push({ f: figure(swap ? a2 : a1, swap ? a1 : a2, theta, phi, s), phi: phi, s: s, swap: !!swap });
      }
    } else {
      for (k = 0; k < 6; k++) {
        var ph = rnd(r.next() * 360, 100), s2 = r.next() < 0.5 ? -1 : 1;
        tries.push({ f: figure(a1, a2, theta, ph, s2), phi: ph, s: s2, swap: false });
      }
    }
    var top = Mth.max.apply(null, tries.map(function (t) { return t.f.fit; }));
    var good = tries.filter(function (t) { return t.f.fit >= 0.85 * top; });
    return good[rint(r, good.length)];
  }

  function build(r, p) {
    var delta = GAPS[p.gap], cls = SIZES[p.size], res = p.resolve, aligned = POSES[p.pose] === 'aligned';
    var close = res === 0 ? 1 : res === 1 ? (r.next() < 0.5 ? 0 : 2) : rint(r, 3);
    var gaps = [0, 1, 2].map(function (k) {
      return k === close ? delta : rnd(delta * (KAPPA[0] + r.next() * (KAPPA[1] - KAPPA[0])), 10);
    });
    var span = gaps[0] + gaps[1] + gaps[2], R = RANGE[cls], lo = R[0], hi = R[1] - span;
    if (hi < lo) return null;
    var t0 = rnd(lo + r.next() * (hi - lo), 10);
    var byRank = [t0, t0 + gaps[0], t0 + gaps[0] + gaps[1], t0 + span].map(function (x) { return rnd(x, 10); });
    var cellOfRank = shuffle(r, [0, 1, 2, 3]);
    var rankOfCell = [0, 0, 0, 0];
    cellOfRank.forEach(function (c, k) { rankOfCell[c] = k; });
    var deg = rankOfCell.map(function (k) { return byRank[k]; });
    var foils = chooseFoils(r, res, close);
    if (!foils) return null;
    var toCells0 = function (o) { return o.map(function (k) { return cellOfRank[k]; }); };
    var arms = chooseArms(r, deg, [[0, 1, 2, 3]].concat(foils).map(toCells0), armMin(delta));
    var poses = deg.map(function (d, i) { return choosePose(r, arms[i][0], arms[i][1], d, aligned); });
    var L = Mth.min(LMAX, Mth.min.apply(null, poses.map(function (q) { return q.f.fit; })));
    var angles = poses.map(function (q) {
      var b = q.f.box, ox = 0.5 - L * (b[0] + b[2]) / 2, oy = 0.5 - L * (b[1] + b[3]) / 2;
      var pt = function (P) { return [rnd(ox + L * P[0], 1e6), rnd(oy + L * P[1], 1e6)]; };
      return { v: [rnd(ox, 1e6), rnd(oy, 1e6)], a: pt(q.f.A), b: pt(q.f.B) };
    });
    // Options as orderings of cells (smallest angle first), the key among them at random.
    var toCells = function (o) { return o.map(function (k) { return cellOfRank[k]; }); };
    var opts = [[0, 1, 2, 3]].concat(foils).map(toCells), perm = shuffle(r, [0, 1, 2, 3]);
    return {
      ex: 'angles', v: 1, seed: 0, params: p, key: perm.indexOf(0),
      angles: angles, deg: deg, order: toCells([0, 1, 2, 3]), options: perm.map(function (i) { return opts[i]; }),
      gaps: gaps, close: close, scale: rnd(L, 1e4),
    };
  }

  function generate(rng, params) {
    var p = normParams(params), item;
    for (var i = 0; i < 50; i++) {
      item = build(i === 0 ? rng : rng.fork('retry' + i), p);
      if (item) { item.seed = rng.seed; if (validate(item) === true) return item; }
    }
    item = fallbackFor(p);
    item.seed = rng.seed;
    return item;
  }
  var fallbackCache = {};
  function fallbackFor(params) {
    var p = normParams(params), pk = PX.ex.paramsKey(p);
    for (var i = 0; i < 400 && !fallbackCache[pk]; i++) {
      var it = build(PX.rng(PX.rng.hash('angles-fallback', pk, i)), p);
      if (it && validate(it) === true) fallbackCache[pk] = it;
    }
    var out = PX.util.deepCopy(fallbackCache[pk]);
    out.fallback = true;
    return out;
  }

  /* ---------- validator: re-measure the drawn angles ---------- */

  // Each cell's angle from its endpoints: cos from dot products (exact order), degrees from atan2.
  function measure(item) {
    return item.angles.map(function (g) {
      var ux = g.a[0] - g.v[0], uy = g.a[1] - g.v[1], wx = g.b[0] - g.v[0], wy = g.b[1] - g.v[1];
      var lu = sqrt(ux * ux + uy * uy), lw = sqrt(wx * wx + wy * wy), dot = ux * wx + uy * wy, cr = ux * wy - uy * wx;
      return { cos: dot / (lu * lw), deg: atan2d(abs(cr), dot), arms: [lu, lw], horiz: uy === 0 || wy === 0 };
    });
  }
  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  function isPt(q) { return isArray(q) && q.length === 2 && isFinite(q[0]) && isFinite(q[1]) && q[0] >= 0 && q[0] <= 1 && q[1] >= 0 && q[1] <= 1; }
  function check(item) {
    if (!item || item.ex !== 'angles') return 'not an angles item';
    var p = item.params || {};
    if (!(isInt(p.gap) && p.gap >= 0 && p.gap < GAPS.length && isInt(p.size) && p.size >= 0 && p.size < SIZES.length
      && isInt(p.resolve) && p.resolve >= 0 && p.resolve < RESOLVE.length && isInt(p.pose) && p.pose >= 0 && p.pose < POSES.length)) return 'bad params';
    if (!isArray(item.angles) || item.angles.length !== 4) return 'four angles';
    for (var c = 0; c < 4; c++) { var g = item.angles[c]; if (!g || !isPt(g.v) || !isPt(g.a) || !isPt(g.b)) return 'angle ' + (c + 1) + ' leaves its cell'; }
    var m = measure(item), delta = GAPS[p.gap], R = RANGE[SIZES[p.size]];
    var lens = [];
    for (c = 0; c < 4; c++) {
      if (!(m[c].arms[0] >= MIN_ARM && m[c].arms[1] >= MIN_ARM)) return 'angle ' + (c + 1) + ': an arm is too short';
      lens.push(m[c].arms[0], m[c].arms[1]);
      if (!(m[c].deg >= R[0] - TOL && m[c].deg <= R[1] + TOL)) return 'angle ' + (c + 1) + ' outside its size class (' + m[c].deg.toFixed(2) + '°)';
      if (!isArray(item.deg) || abs(m[c].deg - item.deg[c]) > TOL) return 'angle ' + (c + 1) + ': drawn ' + m[c].deg.toFixed(3) + '°, stated ' + (item.deg || [])[c];
      if (POSES[p.pose] === 'aligned' && !m[c].horiz) return 'angle ' + (c + 1) + ': no horizontal arm in the aligned pose';
    }
    if (Mth.max.apply(null, lens) / Mth.min.apply(null, lens) > ARM[1] / armMin(delta) + 1e-6) return 'arm lengths out of range';
    // The true order from cosines (larger cosine = smaller angle): exact, no trigonometry.
    var order = [0, 1, 2, 3].sort(function (i, j) { return m[j].cos - m[i].cos; });
    var sorted = order.map(function (i) { return m[i].deg; });
    var gaps = [sorted[1] - sorted[0], sorted[2] - sorted[1], sorted[3] - sorted[2]];
    var minGap = Mth.min.apply(null, gaps), close = gaps.indexOf(minGap);
    if (minGap < FLOOR - TOL || minGap < delta - TOL) return 'a gap of ' + minGap.toFixed(3) + '° is below ' + delta + '°';
    if (minGap > delta + TOL) return 'the closest gap is ' + minGap.toFixed(3) + '°, not ' + delta + '°';
    if (gaps.filter(function (x) { return x < delta * KAPPA[0] - TOL; }).length !== 1) return 'more than one close pair';
    if (!isArray(item.order) || !same(item.order, order)) return 'stated order differs from the drawn angles';
    // Options: four different orderings of the four cells, exactly one true (the key).
    if (!isArray(item.options) || item.options.length !== 4) return 'four options';
    if (!(isInt(item.key) && item.key >= 0 && item.key < 4)) return 'key out of range';
    var seen = {}, right = 0;
    for (var o = 0; o < 4; o++) {
      var op = item.options[o];
      if (!isArray(op) || op.length !== 4 || op.slice().sort().join() !== '0,1,2,3') return 'option ' + (o + 1) + ' is not an ordering of the four angles';
      if (seen[op.join()]) return 'options ' + seen[op.join()] + ' and ' + (o + 1) + ' are the same';
      seen[op.join()] = o + 1;
      if (same(op, order)) { right++; if (o !== item.key) return 'the true order is not the key'; }
    }
    if (right !== 1) return right + ' options give the true order';
    // What has to be resolved.
    var degOf = m.map(function (x) { return x.deg; }), foils = item.options.filter(function (op, i) { return i !== item.key; });
    var swapAt = function (k) { var s = order.slice(); s[k] = order[k + 1]; s[k + 1] = order[k]; return s; };
    var res = p.resolve;
    if (res === 0) {
      if (close !== 1) return 'resolve 0: the closest pair must be the middle one';
      if (!foils.every(function (op) { return op[0] !== order[0] || op[3] !== order[3]; })) return 'resolve 0: a foil keeps both extremes';
    } else if (res === 1) {
      if (close === 1) return 'resolve 1: the closest pair must sit at one end';
      if (!foils.some(function (op) { return same(op, swapAt(1)); })) return 'resolve 1: no foil swaps the middle pair';
      if (foils.some(function (op) { return widestWrong(op, degOf) < minGap + TOL; })) return 'resolve 1: a foil hinges on the closest pair';
    } else if (!foils.some(function (op) { return same(op, swapAt(close)); })) return 'resolve 2: no foil swaps the closest pair';
    return true;
  }

  function score(item, response) { return { correct: isInt(response) && response === item.key }; }

  PX.ex.define({
    id: 'angles', version: 1, code: 'EX-16', name: 'Angle ranking', short: 'Angles',
    abilities: ['LE'], cell: null, role: 'train', pat: true, perDisplay: true,
    practice: 'perception', // shown as perceptual-judgement practice, not visuospatial training
    answer: 'choice', nOptions: 4,
    dims: [
      { key: 'gap', label: 'Closest gap', levels: GAPS, step: 0.55, unit: '°' },
      { key: 'size', label: 'Size class', levels: SIZES, step: 0.3 },
      { key: 'resolve', label: 'Pair that decides', levels: RESOLVE, step: 0.45 },
      { key: 'pose', label: 'Pose', levels: POSES, step: 0.3 },
    ],
    base: -2.2,
    chance: 0.25,
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      GAPS: GAPS, SIZES: SIZES, RESOLVE: RESOLVE, POSES: POSES, RANGE: RANGE, ARM: ARM,
      sincos: sincos, atan2d: atan2d, measure: measure, kendall: kendall, orderOf: orderOf, widestWrong: widestWrong,
      norm: normParams, fallback: fallbackFor,
    },
  });
})(window.PX);
