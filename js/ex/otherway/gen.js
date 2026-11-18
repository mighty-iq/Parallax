/* PR-6 Other Way Round: the trained operations asked the other way round (pure; PLAN milestone 6, the ladder's near
   rung; note T1 §5.1; reserved formats: tests/node/formats.test.mjs). A probe: never trained, no feedback.

   Six strands, one per trained operation, each a variant; a probe block cycles them (def.cycle: item i reads strand
   i mod 6), and items adapt within a strand (dim `level`). Every item has four options and one right answer.
     turn      (Rotate, Spin)    a cube figure with an axis, a curved arrow and the angle: which picture shows it after
                                 that turn? Foils: the other direction, another axis, the turn of another size, the
                                 mirror of the answer; every foil differs from the answer where it shows.
     foldback  (Fold)            an unfolded sheet with holes: which fold-and-punch plan made it? Foils: the punch
                                 mirrored, a crease moved, the folds in another order, a flap folded the other way;
                                 every plan gives the same number of holes and punches over a hole of the sheet.
     cutback   (Slice)           a cut face drawn straight on, at true scale: which solid with which plane gives it?
                                 Foils: other planes through the same solid with as many sides and other proportions,
                                 the solid's own face (the outline error), another solid.
     netback   (Nets)            a cube with lettered colour faces seen from two corners: which net folds into it?
                                 Foils: one opposite pair swapped (the mirror cube) twice, two neighbours swapped.
     viewfrom  (Views)           a cube structure and one flat view: from which side was the view drawn?
     whereami  (Orient, Reckon,  a map with marked spots and an arrow circle with landmarks at their directions from
                Homing)          "ahead": where are you standing? Foils match the circle mirrored or for two of three
                                 landmarks only.
   Pictures of cubes are isometric from above the front-right corner (x right-front, y left-front, z up); the face map
   of a picture (which face shows in each triangle of the isometric lattice) decides whether two pictures differ.

   Item: { ex, v, seed, params, strand, key, nOptions: 4, answer: 'choice', …strand data } (see each strand).
   Hand-set item model: base + the strand's offset + 0.8 per level (no pilot yet; pooled data refit it). */
(function (PX) {
  'use strict';

  var isArray = Array.isArray;
  var mabs = Math.abs, mmin = Math.min, mmax = Math.max, msqrt = Math.sqrt, mround = Math.round, mfloor = Math.floor;
  var mcos = Math.cos, msin = Math.sin, matan2 = Math.atan2, PI = Math.PI;

  var STRANDS = ['turn', 'foldback', 'cutback', 'netback', 'viewfrom', 'whereami'];
  var OFFSET = { turn: 0.2, foldback: 0.0, cutback: 0.4, netback: 0.5, viewfrom: -0.2, whereami: 0.3 };
  var FORMAT = {
    turn: 'otherway:turn-axis-arrow', foldback: 'otherway:sheet-to-fold-sequence', cutback: 'otherway:section-to-solid-plane',
    netback: 'otherway:cube-to-net', viewfrom: 'otherway:view-to-direction', whereami: 'otherway:arrow-circle-to-position',
  };
  var LIMIT = { turn: 30000, foldback: 45000, cutback: 45000, netback: 45000, viewfrom: 30000, whereami: 45000 };
  var BASE = -1.0, STEP = 0.8;

  function strandOf(params) { return params && STRANDS.indexOf(params.variant) >= 0 ? params.variant : 'turn'; }
  function levelOf(params) { var l = params ? params.level : 0; return l === 1 || l === 2 ? l : 0; }

  /* ---------- small helpers ---------- */

  function vk(c) { return c[0] + ',' + c[1] + ',' + c[2]; }
  function norm(cells) {
    var m = [Infinity, Infinity, Infinity];
    cells.forEach(function (c) { for (var i = 0; i < 3; i++) if (c[i] < m[i]) m[i] = c[i]; });
    return cells.map(function (c) { return [c[0] - m[0], c[1] - m[1], c[2] - m[2]]; })
      .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; });
  }
  function key3(cells) { return norm(cells).map(vk).join(';'); }
  function copyCells(cells) { return cells.map(function (c) { return c.slice(); }); }
  function choose(rng, arr, k) { return rng.shuffle(arr).slice(0, k); }
  // Picks k foils from pool ({ opt, … }) so that the answer's rank on each feature (a number per option; rank = foils
  // below the answer, ties half) lands near a random target: "most like the others", "odd one out", "largest" and the
  // like then find the answer about one time in four. comp(foils) → bool keeps a required mix of foil kinds.
  function balanced(rng, keyOpt, pool, feats, comp, k) {
    k = k || 3;
    if (pool.length < k) return null;
    var targets = feats.map(function () { return rng.int(0, 3); }), best = null, bestScore = Infinity;
    var tries = mmin(500, mmax(80, pool.length * pool.length));
    for (var t = 0; t < tries; t++) {
      var tri = choose(rng, pool, k);
      if (comp && !comp(tri)) continue;
      var opts = [keyOpt].concat(tri.map(function (c) { return c.opt; })), sc = 0;
      for (var fi = 0; fi < feats.length; fi++) {
        var vals = opts.map(function (o) { return feats[fi](o, opts); }), r = 0;
        for (var i = 1; i < vals.length; i++) r += vals[i] < vals[0] - 1e-9 ? 1 : mabs(vals[i] - vals[0]) <= 1e-9 ? 0.5 : 0;
        sc += mabs(r - targets[fi]);
      }
      if (sc < bestScore) { bestScore = sc; best = tri; if (sc === 0) break; }
    }
    return best;
  }
  function totalTo(dist) { return function (o, opts) { var s = 0; opts.forEach(function (x) { if (x !== o) s += dist(o, x); }); return s; }; }
  function placeOptions(rng, keyOpt, foils) {
    var order = rng.shuffle([0, 1, 2, 3]), options = [], why = [], key = -1;
    order.forEach(function (o, i) {
      if (o === 0) { options.push(keyOpt); why.push(null); key = i; } else { options.push(foils[o - 1].opt); why.push(foils[o - 1].why); }
    });
    return { options: options, why: why, key: key };
  }

  /* ---------- isometric pictures of unit cubes ---------- */

  var C30 = msqrt(3) / 2;
  function isoPt(p) { return [(p[0] - p[1]) * C30, (p[0] + p[1]) / 2 - p[2]]; }
  // a face's corners in the order whose split (0,1,2)(0,2,3) follows the isometric lattice
  function facePts(c, kind) {
    var x = c[0], y = c[1], z = c[2];
    if (kind === 'top') return [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]];
    if (kind === 'right') return [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]];
    return [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]];
  }
  var KINDS = [['top', [0, 0, 1]], ['right', [1, 0, 0]], ['left', [0, 1, 0]]];
  function lat(p) { return [p[0] - p[1], p[0] + p[1] - 2 * p[2]]; }
  // iso(cells) → { faces: [{ kind, pts (2D), cube }] in painter order, map: { triangle → kind } }
  function iso(cells) {
    var set = {}, faces = [], map = {};
    cells.forEach(function (c) { set[vk(c)] = true; });
    var order = cells.slice().sort(function (a, b) { return (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]) || a[2] - b[2] || a[0] - b[0]; });
    order.forEach(function (c) {
      KINDS.forEach(function (k) {
        if (set[vk([c[0] + k[1][0], c[1] + k[1][1], c[2] + k[1][2]])]) return;
        var P = facePts(c, k[0]), L = P.map(lat);
        map[(L[0][0] + L[1][0] + L[2][0]) + ':' + (L[0][1] + L[1][1] + L[2][1])] = k[0];
        map[(L[0][0] + L[2][0] + L[3][0]) + ':' + (L[0][1] + L[2][1] + L[3][1])] = k[0];
        faces.push({ kind: k[0], pts: P.map(isoPt), cube: c });
      });
    });
    return { faces: faces, map: map };
  }
  function normMap(map) {
    var ka = Infinity, kb = Infinity, out = {};
    Object.keys(map).forEach(function (k) { var p = k.split(':'); ka = mmin(ka, +p[0]); kb = mmin(kb, +p[1]); });
    Object.keys(map).forEach(function (k) { var p = k.split(':'); out[(+p[0] - ka) + ':' + (+p[1] - kb)] = map[k]; });
    return out;
  }
  // triangles whose face differs between two pictures (translation removed)
  function picDiff(a, b) {
    var A = normMap(iso(a).map), B = normMap(iso(b).map), n = 0, k;
    for (k in A) if (A[k] !== B[k]) n++;
    for (k in B) if (!(k in A)) n++;
    return n;
  }

  /* ---------- rotations of integer points ---------- */

  function rot90(c, axis, dir) {
    var x = c[0], y = c[1], z = c[2];
    if (axis === 0) return dir > 0 ? [x, -z, y] : [x, z, -y];
    if (axis === 1) return dir > 0 ? [z, y, -x] : [-z, y, x];
    return dir > 0 ? [-y, x, z] : [y, -x, z];
  }
  // q quarter turns (1, 2, 3) about axis: +90° maps the next axis onto the one after it (x→y about z, y→z about x, z→x about y)
  function rotate(cells, axis, q) {
    return cells.map(function (c) { var p = c; for (var i = 0; i < q; i++) p = rot90(p, axis, 1); return p; });
  }
  function mirror(cells) { return cells.map(function (c) { return [-c[0], c[1], c[2]]; }); }
  var ROTS = null; // the 24 proper rotations as functions of a point
  function rotations() {
    if (ROTS) return ROTS;
    var seen = {}, out = [], q = [[0, 0, 0, 0]];
    function apply(ops, c) { var p = c; ops.forEach(function (a) { p = rot90(p, a, 1); }); return p; }
    var probe = [[1, 2, 3], [4, 5, 6]];
    var queue = [[]];
    while (queue.length && out.length < 24) {
      var ops = queue.shift(), sig = probe.map(function (c) { return apply(ops, c).join(','); }).join('|');
      if (seen[sig]) continue;
      seen[sig] = true;
      out.push(ops);
      [0, 1, 2].forEach(function (a) { queue.push(ops.concat([a])); });
    }
    void q;
    ROTS = out.map(function (ops) { return function (c) { return apply(ops, c); }; });
    return ROTS;
  }
  function canon(cells) {
    var best = null;
    rotations().forEach(function (R) { var k = key3(cells.map(R)); if (best === null || k < best) best = k; });
    return best;
  }

  /* ======================================================================= turn */

  function polycube(rng, n) {
    for (var tries = 0; tries < 400; tries++) {
      var cells = [[0, 0, 0]], set = { '0,0,0': true };
      while (cells.length < n) {
        var c = rng.pick(cells), d = rng.pick([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]);
        var p = [c[0] + d[0], c[1] + d[1], c[2] + d[2]];
        if (set[vk(p)]) continue;
        set[vk(p)] = true;
        cells.push(p);
      }
      cells = norm(cells);
      var ext = [0, 1, 2].map(function (i) { return mmax.apply(null, cells.map(function (c) { return c[i]; })); });
      if (ext.some(function (e) { return e < 1; })) continue;           // a figure in three dimensions
      if (ext.some(function (e) { return e > 2; })) continue;           // compact enough to read
      if (canon(cells) === canon(mirror(cells))) continue;              // chiral: its mirror is another figure
      return cells;
    }
    return null;
  }

  var TURN_LEVELS = [
    { axes: [2], qs: [1, 3], n: [4, 5] },
    { axes: [0, 1], qs: [1, 3], n: [5] },
    { axes: [0, 1], qs: [1, 3, 2], n: [5, 6] },
  ];
  var MIN_DIFF = 4; // triangles: two faces' worth

  function turnGen(rng, level) {
    var L = TURN_LEVELS[level];
    for (var tries = 0; tries < 60; tries++) {
      var fig = polycube(rng, rng.pick(L.n));
      if (!fig) continue;
      var axis = rng.pick(L.axes), q = rng.pick(L.qs);
      var keyCells = norm(rotate(fig, axis, q));
      if (picDiff(fig, keyCells) < MIN_DIFF) continue; // the turn must show
      var cands = [];
      if (q !== 2) cands.push({ why: 'other-direction', cells: rotate(fig, axis, 4 - q) });
      [0, 1, 2].forEach(function (a) { if (a !== axis) cands.push({ why: 'other-axis', cells: rotate(fig, a, q) }); });
      cands.push({ why: 'other-size', cells: rotate(fig, axis, q === 2 ? 1 : 2) });
      if (q === 2) cands.push({ why: 'other-size', cells: rotate(fig, axis, 3) });
      cands.push({ why: 'mirror', cells: mirror(keyCells) });
      cands = cands.map(function (c) { return { why: c.why, cells: norm(c.cells) }; }).filter(function (c) {
        // differs from the answer where it shows, and is not the figure as it stood (that would be a giveaway)
        return key3(c.cells) !== key3(keyCells) && picDiff(c.cells, keyCells) >= MIN_DIFF && picDiff(c.cells, fig) >= MIN_DIFF;
      });
      var uniq = [];
      cands.forEach(function (c) { if (uniq.every(function (u) { return picDiff(u.cells, c.cells) >= MIN_DIFF; })) uniq.push(c); });
      if (uniq.length < 3 || !uniq.some(function (c) { return c.why === 'mirror'; })) continue;
      // foil sets with the mirror; the answer's rank on "most like the others" goes to a random target
      var sets = [], mi = uniq.findIndex(function (c) { return c.why === 'mirror'; }), rest = uniq.filter(function (c, i) { return i !== mi; });
      for (var a = 0; a < rest.length; a++) for (var b = a + 1; b < rest.length; b++) sets.push([uniq[mi], rest[a], rest[b]]);
      var target = rng.int(0, 3), pick = null;
      rng.shuffle(sets).forEach(function (s) {
        if (pick) return;
        var opts = [keyCells].concat(s.map(function (c) { return c.cells; }));
        if (rankOfFirst(opts) === target) pick = s;
      });
      if (!pick) pick = sets[0];
      var order = rng.shuffle([0, 1, 2, 3]), options = [], whys = [], key = -1;
      order.forEach(function (o, i) {
        if (o === 0) { options.push(keyCells); whys.push(null); key = i; } else { options.push(pick[o - 1].cells); whys.push(pick[o - 1].why); }
      });
      return { strand: 'turn', fig: fig, axis: axis, q: q, options: options, why: whys, key: key };
    }
    return null;
  }
  // rank (0 = most like the others) of option 0 by total picture difference to the other options
  function rankOfFirst(opts) {
    var tot = opts.map(function (a, i) { var s = 0; opts.forEach(function (b, j) { if (i !== j) s += picDiff(a, b); }); return s; });
    return tot.filter(function (t, i) { return i > 0 && t < tot[0]; }).length;
  }
  function turnValidate(it) {
    if (!isArray(it.options) || it.options.length !== 4) return 'four options';
    var k = key3(rotate(it.fig, it.axis, it.q)), hits = it.options.filter(function (o) { return key3(o) === k; }).length;
    if (hits !== 1 || key3(it.options[it.key]) !== k) return 'exactly one option is the turned figure';
    if (picDiff(it.fig, it.options[it.key]) < MIN_DIFF) return 'the turn shows';
    for (var i = 0; i < 4; i++) for (var j = i + 1; j < 4; j++) if (picDiff(it.options[i], it.options[j]) < MIN_DIFF) return 'options differ where they show';
    if (canon(it.fig) === canon(mirror(it.fig))) return 'the figure is chiral';
    return true;
  }

  /* =================================================================== foldback */
  // A sheet of N × N cells (x right, y down). A fold: { k: 'v' | 'h', c, move: -1 | 1 } — the line x = c (v) or
  // y = c (h) of the current rectangle; move −1 folds the part below c (left or top) over, +1 the part above c.
  // Legal: the flap is narrower than or as wide as what stays (it lands on paper) and at least one cell.
  // A punch at a cell of the folded rectangle makes a hole in every layer: unfolding reflects it back.

  var FN = 6;
  function fold1(R, f) { // R: [x0, y0, x1, y1] → the rectangle after the fold, or null if illegal
    var lo = f.k === 'v' ? R[0] : R[1], hi = f.k === 'v' ? R[2] : R[3];
    if (!(f.c > lo && f.c < hi)) return null;
    var flap = f.move < 0 ? f.c - lo : hi - f.c, stay = f.move < 0 ? hi - f.c : f.c - lo;
    if (flap < 1 || flap > stay) return null;
    var out = R.slice();
    if (f.k === 'v') { if (f.move < 0) out[0] = f.c; else out[2] = f.c; } else { if (f.move < 0) out[1] = f.c; else out[3] = f.c; }
    return out;
  }
  function rects(folds) {
    var R = [0, 0, FN, FN], out = [R];
    for (var i = 0; i < folds.length; i++) { R = fold1(R, folds[i]); if (!R) return null; out.push(R); }
    return out;
  }
  function refl(p, f) { return f.k === 'v' ? [2 * f.c - p[0], p[1]] : [p[0], 2 * f.c - p[1]]; }
  // holes (cell centres, doubled to stay integer) of a plan: unfold the punch through the folds in reverse
  function holes(plan) {
    var Rs = rects(plan.folds);
    if (!Rs) return null;
    var last = Rs[Rs.length - 1];
    if (!(plan.punch[0] >= last[0] && plan.punch[0] < last[2] && plan.punch[1] >= last[1] && plan.punch[1] < last[3])) return null; // on the paper
    var pts = [[2 * plan.punch[0] + 1, 2 * plan.punch[1] + 1]];
    for (var i = plan.folds.length - 1; i >= 0; i--) {
      var f = plan.folds[i], before = Rs[i], next = [];
      var F = { k: f.k, c: 2 * f.c };
      pts.forEach(function (p) {
        next.push(p);
        var q = refl(p, F), x0 = 2 * before[0], y0 = 2 * before[1], x1 = 2 * before[2], y1 = 2 * before[3];
        var onFlap = f.k === 'v' ? (f.move < 0 ? q[0] < F.c : q[0] > F.c) : (f.move < 0 ? q[1] < F.c : q[1] > F.c);
        if (onFlap && q[0] > x0 && q[0] < x1 && q[1] > y0 && q[1] < y1) next.push(q);
      });
      pts = next;
    }
    var seen = {}, out = [];
    pts.forEach(function (p) { var k = ((p[0] - 1) / 2) + ',' + ((p[1] - 1) / 2); if (!seen[k]) { seen[k] = true; out.push([(p[0] - 1) / 2, (p[1] - 1) / 2]); } });
    return out.sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
  }
  function holeKey(h) { return h.map(function (p) { return p[0] + ',' + p[1]; }).join(';'); }
  // how far apart two plans look: folds that differ (axis, line or side), and the punch
  function planDist(a, b) {
    var n = 0;
    for (var i = 0; i < mmax(a.folds.length, b.folds.length); i++) {
      var f = a.folds[i], g = b.folds[i];
      if (!f || !g || f.k !== g.k || f.c !== g.c || f.move !== g.move) n++;
    }
    return n + (a.punch[0] === b.punch[0] && a.punch[1] === b.punch[1] ? 0 : 1);
  }
  function planKey(plan) { return plan.folds.map(function (f) { return f.k + f.c + (f.move < 0 ? 'a' : 'b'); }).join('-') + '/' + plan.punch.join(','); }
  var FOLD_LEVELS = [{ folds: 1 }, { folds: 2 }, { folds: 3 }];
  function randomFold(rng, R) {
    for (var t = 0; t < 30; t++) {
      var k = rng.chance(0.5) ? 'v' : 'h', lo = k === 'v' ? R[0] : R[1], hi = k === 'v' ? R[2] : R[3];
      if (hi - lo < 2) continue;
      var f = { k: k, c: rng.int(lo + 1, hi - 1), move: rng.chance(0.5) ? -1 : 1 };
      if (fold1(R, f)) return f;
    }
    return null;
  }
  function foldGen(rng, level) {
    var nf = FOLD_LEVELS[level].folds;
    for (var tries = 0; tries < 200; tries++) {
      var folds = [], R = [0, 0, FN, FN], ok = true;
      for (var i = 0; i < nf; i++) { var f = randomFold(rng, R); if (!f) { ok = false; break; } folds.push(f); R = fold1(R, f); }
      if (!ok) continue;
      var punch = [rng.int(R[0], R[2] - 1), rng.int(R[1], R[3] - 1)], plan = { folds: folds, punch: punch };
      var H = holes(plan);
      if (!H || H.length < 2 || (level > 0 && H.length < 3)) continue; // every fold should matter at least once
      var hk = holeKey(H), n = H.length, sheet = {};
      H.forEach(function (p) { sheet[p[0] + ',' + p[1]] = true; });
      // candidate foils: mistakes on the plan, kept when they give as many holes, another sheet, and punch over a hole
      var cands = [];
      function add(why, pl) {
        var h = holes(pl);
        if (!h || h.length !== n || holeKey(h) === hk || !sheet[pl.punch[0] + ',' + pl.punch[1]]) return;
        if (cands.some(function (c) { return holeKey(c.holes) === holeKey(h) || planKey(c.plan) === planKey(pl); })) return;
        cands.push({ why: why, plan: pl, holes: h });
      }
      var RR = rects(folds), last = RR[RR.length - 1];
      add('punch-mirrored', { folds: folds, punch: [last[0] + last[2] - 1 - punch[0], punch[1]] });
      add('punch-mirrored', { folds: folds, punch: [punch[0], last[1] + last[3] - 1 - punch[1]] });
      folds.forEach(function (f, j) {
        [-2, -1, 1, 2].forEach(function (d) { var g = folds.slice(); g[j] = { k: f.k, c: f.c + d, move: f.move }; if (rects(g)) add('crease-moved', { folds: g, punch: punch }); });
        var g2 = folds.slice(); g2[j] = { k: f.k, c: f.c, move: -f.move }; if (rects(g2)) add('flap-reversed', { folds: g2, punch: punch });
        for (var c2 = 1; c2 < FN; c2++) [-1, 1].forEach(function (mv) { // the fold across the other way
          var g4 = folds.slice(); g4[j] = { k: f.k === 'v' ? 'h' : 'v', c: c2, move: mv };
          if (rects(g4)) add('other-crease', { folds: g4, punch: punch });
        });
      });
      if (folds.length >= 2) for (var a = 0; a < folds.length - 1; a++) {
        var g3 = folds.slice(); g3[a] = folds[a + 1]; g3[a + 1] = folds[a];
        if (rects(g3)) add('order-changed', { folds: g3, punch: punch });
      }
      // two mistakes at once, so the answer is not the plan in the middle of the others
      cands.slice().forEach(function (c) {
        c.plan.folds.forEach(function (f, j) {
          [-1, 1].forEach(function (d) { var g = c.plan.folds.slice(); g[j] = { k: f.k, c: f.c + d, move: f.move }; if (rects(g)) add(c.why + '+', { folds: g, punch: c.plan.punch }); });
        });
      });
      // plans of their own (as many folds, punched over a hole of the sheet), so the foils are not all near the answer
      for (var t5 = 0; t5 < 60 && cands.length < 40; t5++) {
        var g5 = [], R5 = [0, 0, FN, FN], ok5 = true;
        for (var i5 = 0; i5 < nf; i5++) { var f5 = randomFold(rng, R5); if (!f5) { ok5 = false; break; } g5.push(f5); R5 = fold1(R5, f5); }
        if (!ok5) continue;
        var inR = H.filter(function (p) { return p[0] >= R5[0] && p[0] < R5[2] && p[1] >= R5[1] && p[1] < R5[3]; });
        if (inR.length) add('other-plan', { folds: g5, punch: rng.pick(inR).slice() });
      }
      if (cands.length < 3) continue;
      var pool = cands.map(function (c) { return { opt: c.plan, why: c.why }; });
      var pick = balanced(rng, plan, pool, [totalTo(planDist)]);
      if (!pick) continue;
      var placed = placeOptions(rng, plan, pick);
      return { strand: 'foldback', n: FN, holes: H, options: placed.options, why: placed.why, key: placed.key };
    }
    return null;
  }
  function foldValidate(it) {
    if (!isArray(it.options) || it.options.length !== 4) return 'four options';
    var hk = holeKey(it.holes), hits = 0, sheet = {};
    it.holes.forEach(function (p) { sheet[p[0] + ',' + p[1]] = true; });
    for (var i = 0; i < 4; i++) {
      var h = holes(it.options[i]);
      if (!h) return 'every plan is legal';
      if (h.length !== it.holes.length) return 'every plan gives as many holes';
      if (!sheet[it.options[i].punch[0] + ',' + it.options[i].punch[1]]) return 'every punch is over a hole';
      if (holeKey(h) === hk) { hits++; if (i !== it.key) return 'the key is the plan that makes the sheet'; }
    }
    if (hits !== 1) return 'exactly one plan makes the sheet';
    // an independent check: fold a sheet of layers forward and punch it
    var fw = forwardHoles(it.options[it.key]);
    if (holeKey(fw) !== hk) return 'the forward fold agrees';
    return true;
  }
  // Forward model for the validator: every original cell carries its position; folding moves the flap's cells.
  function forwardHoles(plan) {
    var cells = [];
    for (var y = 0; y < FN; y++) for (var x = 0; x < FN; x++) cells.push({ o: [x, y], p: [x + 0.5, y + 0.5] });
    plan.folds.forEach(function (f) {
      cells.forEach(function (c) {
        var v = f.k === 'v' ? c.p[0] : c.p[1];
        var onFlap = f.move < 0 ? v < f.c : v > f.c;
        if (onFlap) c.p = f.k === 'v' ? [2 * f.c - c.p[0], c.p[1]] : [c.p[0], 2 * f.c - c.p[1]];
      });
    });
    var px = plan.punch[0] + 0.5, py = plan.punch[1] + 0.5;
    return cells.filter(function (c) { return mabs(c.p[0] - px) < 1e-9 && mabs(c.p[1] - py) < 1e-9; }).map(function (c) { return c.o; })
      .sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
  }

  /* ==================================================================== cutback */
  // Solids (convex polyhedra, unit-ish sizes) and planes; the section is the convex polygon solid ∩ plane, compared
  // with the stem up to rotation and reflection (side lengths and angles in cyclic order).

  function v3sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function v3add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function v3dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function v3cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function v3len(a) { return msqrt(v3dot(a, a)); }
  function v3scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function v3norm(a) { var l = v3len(a); return l > 0 ? v3scale(a, 1 / l) : [0, 0, 0]; }

  function solid(kind, d) {
    var V, E;
    if (kind === 'box') {
      var a = d[0], b = d[1], c = d[2];
      V = [[0, 0, 0], [a, 0, 0], [a, b, 0], [0, b, 0], [0, 0, c], [a, 0, c], [a, b, c], [0, b, c]];
      E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    } else if (kind === 'prism') { // triangular prism: a right triangle × length along y
      var w = d[0], L = d[1], hgt = d[2];
      V = [[0, 0, 0], [w, 0, 0], [0, 0, hgt], [0, L, 0], [w, L, 0], [0, L, hgt]];
      E = [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [0, 3], [1, 4], [2, 5]];
    } else { // square pyramid
      var s = d[0], hp = d[1];
      V = [[0, 0, 0], [s, 0, 0], [s, s, 0], [0, s, 0], [s / 2, s / 2, hp]];
      E = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4]];
    }
    return { kind: kind, d: d, V: V, E: E };
  }
  // the section polygon (3D points in cyclic order) of the solid by the plane n·p = k, or null
  function section(S, pl) {
    var pts = [];
    S.E.forEach(function (e) {
      var a = S.V[e[0]], b = S.V[e[1]], da = v3dot(pl.n, a) - pl.k, db = v3dot(pl.n, b) - pl.k;
      if (mabs(da) < 1e-9) pts.push(a);
      if (mabs(db) < 1e-9) pts.push(b);
      if ((da < -1e-9 && db > 1e-9) || (da > 1e-9 && db < -1e-9)) { var t = da / (da - db); pts.push(v3add(a, v3scale(v3sub(b, a), t))); }
    });
    var uniq = [];
    pts.forEach(function (p) { if (uniq.every(function (q) { return v3len(v3sub(p, q)) > 1e-6; })) uniq.push(p); });
    if (uniq.length < 3) return null;
    var c = [0, 0, 0];
    uniq.forEach(function (p) { c = v3add(c, p); });
    c = v3scale(c, 1 / uniq.length);
    var u = v3norm(v3sub(uniq[0], c)), w = v3cross(v3norm(pl.n), u);
    uniq.sort(function (p, q) { var a = v3sub(p, c), b = v3sub(q, c); return matan2(v3dot(a, w), v3dot(a, u)) - matan2(v3dot(b, w), v3dot(b, u)); });
    // drop points on a straight run
    var out = uniq.filter(function (p, i) {
      var a = uniq[(i + uniq.length - 1) % uniq.length], b = uniq[(i + 1) % uniq.length];
      return v3len(v3cross(v3sub(p, a), v3sub(b, p))) > 1e-6;
    });
    return out.length >= 3 ? out : null;
  }
  // 2D outline of a section, straight on: coordinates in the plane, centred
  function flat(poly, n) {
    var c = [0, 0, 0];
    poly.forEach(function (p) { c = v3add(c, p); });
    c = v3scale(c, 1 / poly.length);
    var u = v3norm(v3sub(poly[0], c)), w = v3cross(v3norm(n), u);
    return poly.map(function (p) { var a = v3sub(p, c); return [v3dot(a, u), v3dot(a, w)]; });
  }
  // shape signature: side lengths and turning angles; distance between shapes up to rotation and reflection
  function sig(poly2) {
    var n = poly2.length, sides = [], angs = [];
    for (var i = 0; i < n; i++) {
      var a = poly2[(i + n - 1) % n], b = poly2[i], c = poly2[(i + 1) % n];
      sides.push(msqrt((c[0] - b[0]) * (c[0] - b[0]) + (c[1] - b[1]) * (c[1] - b[1])));
      var u = [a[0] - b[0], a[1] - b[1]], v = [c[0] - b[0], c[1] - b[1]];
      angs.push(mabs(matan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])));
    }
    return { n: n, sides: sides, angs: angs };
  }
  // vertex i of A ↦ vertex s + i of B (or s − i, reflected); the side after vertex i ↦ the side after s + i (or the
  // side after s − i − 1); the distance is the largest relative side difference or angle difference (radians)
  function shapeDist(A, B) {
    if (A.n !== B.n) return Infinity;
    var n = A.n, best = Infinity;
    for (var s = 0; s < n; s++) {
      for (var dir = 1; dir >= -1; dir -= 2) {
        var d = 0;
        for (var i = 0; i < n; i++) {
          var v = ((s + dir * i) % n + n) % n, side = dir > 0 ? v : ((s - i - 1) % n + n) % n;
          d = mmax(d, mabs(A.sides[i] - B.sides[side]) / mmax(A.sides[i], 1e-9), mabs(A.angs[i] - B.angs[v]));
        }
        if (d < best) best = d;
      }
    }
    return best;
  }
  function polyArea(poly) { var a = 0; for (var i = 0; i < poly.length; i++) { var p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return mabs(a) / 2; }
  var SOLIDS = [
    { kind: 'box', dims: [[2, 2, 2], [3, 2, 2], [2, 2, 3], [3, 2, 1.5], [3, 3, 2], [2, 1.5, 3], [3, 1.5, 1.5], [2.5, 2, 2], [3, 3, 1.5]] },
    { kind: 'prism', dims: [[2, 3, 2], [2, 3, 3], [3, 3, 2]] },
    { kind: 'pyramid', dims: [[3, 2.5], [3, 3.5]] },
  ];
  var CUT_LEVELS = [{ kinds: ['box'], oblique: false }, { kinds: ['box', 'prism'], oblique: true }, { kinds: ['box', 'prism', 'pyramid'], oblique: true }];
  function randomPlane(rng, S, oblique) {
    var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    S.V.forEach(function (p) { for (var i = 0; i < 3; i++) { lo[i] = mmin(lo[i], p[i]); hi[i] = mmax(hi[i], p[i]); } });
    var n;
    if (!oblique || rng.chance(0.3)) { var ax = rng.int(0, 2); n = [0, 0, 0]; n[ax] = 1; }
    else n = v3norm([rng.pick([0, 1, -1, 2]) * 0.5, rng.pick([0, 1, -1]) * 0.5, rng.pick([1, 2]) * 0.5]);
    if (v3len(n) < 1e-9) n = [0, 0, 1];
    var ctr = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    var spread = [0, 1, 2].map(function (i) { return (hi[i] - lo[i]) * 0.3; });
    var p = [ctr[0] + rng.float(-spread[0], spread[0]), ctr[1] + rng.float(-spread[1], spread[1]), ctr[2] + rng.float(-spread[2], spread[2])];
    return { n: n, k: v3dot(n, p) };
  }
  var MARGIN = 0.15; // shape distance between the answer's section and every foil's
  function cutGen(rng, level) {
    var L = CUT_LEVELS[level];
    for (var tries = 0; tries < 300; tries++) {
      var kind = rng.pick(L.kinds), spec = SOLIDS.filter(function (s) { return s.kind === kind; })[0];
      var S = solid(kind, rng.pick(spec.dims)), pl = randomPlane(rng, S, L.oblique), sec = section(S, pl);
      if (!sec || sec.length < 3) continue;
      var sg = sig(flat(sec, pl.n));
      if (sg.sides.some(function (x) { return x < 0.6; })) continue; // no sliver sides
      var cands = [];
      for (var t = 0; t < 60 && cands.length < 9; t++) {
        var kind2 = rng.chance(0.7) ? kind : rng.pick(['box', 'prism', 'pyramid']);
        var spec2 = SOLIDS.filter(function (s) { return s.kind === kind2; })[0], S2 = kind2 === kind && rng.chance(0.6) ? S : solid(kind2, rng.pick(spec2.dims));
        var pl2 = randomPlane(rng, S2, L.oblique), sec2 = section(S2, pl2);
        if (!sec2) continue;
        var sg2 = sig(flat(sec2, pl2.n));
        if (sg2.sides.some(function (x) { return x < 0.6; })) continue;
        if (shapeDist(sg, sg2) < MARGIN) continue;
        if (sg2.n !== sg.n) continue; // as many sides: the proportions decide
        if (cands.some(function (c) { return shapeDist(c.sig, sg2) < MARGIN; })) continue;
        cands.push({ why: S2 === S ? 'other-plane' : 'other-solid', solid: S2, plane: pl2, sig: sg2 });
      }
      if (cands.length < 3) continue;
      var keyOpt = { kind: S.kind, d: S.d, plane: pl };
      var pool = cands.map(function (c) { return { opt: { kind: c.solid.kind, d: c.solid.d, plane: c.plane }, why: c.why }; });
      var areaOf = function (o) { var sc = section(solid(o.kind, o.d), o.plane); return sc ? polyArea(flat(sc, o.plane.n)) : 0; };
      var solidDist = function (a, b) { return (a.kind === b.kind ? 0 : 1) + (JSON.stringify(a.d) === JSON.stringify(b.d) ? 0 : 1); };
      var pick = balanced(rng, keyOpt, pool, [areaOf, totalTo(solidDist)]);
      if (!pick) continue;
      var placed = placeOptions(rng, keyOpt, pick);
      return { strand: 'cutback', face: flat(sec, pl.n), options: placed.options, why: placed.why, key: placed.key };
    }
    return null;
  }
  function cutValidate(it) {
    if (!isArray(it.options) || it.options.length !== 4) return 'four options';
    var target = sig(it.face), hits = 0;
    for (var i = 0; i < 4; i++) {
      var o = it.options[i], S = solid(o.kind, o.d), sec = section(S, o.plane);
      if (!sec) return 'every plane cuts its solid';
      var d = shapeDist(target, sig(flat(sec, o.plane.n)));
      if (d < 0.02) { hits++; if (i !== it.key) return 'the key is the matching cut'; }
      else if (d < MARGIN) return 'every other cut differs by the margin';
    }
    return hits === 1 ? true : 'exactly one cut matches';
  }

  /* ==================================================================== netback */
  // Faces 0..5: B (down), T (up), N (−y), E (+x), S (+y), W (−x), as in Nets (js/ex/nets/gen.js).
  var OPP = [1, 0, 4, 5, 2, 3];
  var LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
  function netsLib() { var d = PX.ex.get('nets'); return d && d.lib ? d.lib : null; }
  // the 24 orientations: o[i] = the face that sits at position i
  var ORIENT = null;
  function orientations() {
    if (ORIENT) return ORIENT;
    function rollN(o) { return [o[2], o[4], o[1], o[3], o[0], o[5]]; } // the N face goes down
    function spin(o) { return [o[0], o[1], o[5], o[2], o[3], o[4]]; }  // seen from above: W→N, N→E, E→S, S→W
    var seen = {}, out = [], q = [[0, 1, 2, 3, 4, 5]];
    while (q.length) {
      var o = q.shift(), k = o.join('');
      if (seen[k]) continue;
      seen[k] = true;
      out.push(o);
      q.push(rollN(o), spin(o));
    }
    ORIENT = out;
    return out;
  }
  // labels by position; same cube ⇔ one orientation maps one onto the other
  function sameCube(a, b) {
    return orientations().some(function (o) { for (var i = 0; i < 6; i++) if (a[o[i]] !== b[i]) return false; return true; });
  }
  var NET_LEVELS = [0, 1, 2]; // the Nets shape groups: 1-4-1, 2-3-1, 2-2-2 / 3-3
  function netGen(rng, level) {
    var lib = netsLib();
    if (!lib) return null;
    var nets = lib.data().nets.filter(function (s) { return s.group === NET_LEVELS[level]; });
    for (var tries = 0; tries < 40; tries++) {
      var shape = rng.pick(nets), base = rng.int(0, 5), rn = lib.rollNet(shape.cells, shape.nb, base);
      var cube = rng.shuffle(LABELS);                       // cube[f]: the label on face f
      var keyNet = rn.face.map(function (f) { return cube[f]; });
      // wrong cubes: the mirror cube (one opposite pair swapped), and cubes with two neighbours swapped; each may lie
      // on the net in any of its 24 orientations, so the nets differ from the answer's by more than one swap
      var mirrorCube = swap(cube, 2, 4), others = [], pool = [], seenNet = {};
      seenNet[keyNet.join('')] = true;
      for (var a = 0; a < 6; a++) for (var b = a + 1; b < 6; b++) if (OPP[a] !== b) others.push(swap(cube, a, b));
      function placeAll(wc, kind) {
        orientations().forEach(function (o) {
          var placed = [];
          for (var i = 0; i < 6; i++) placed[i] = wc[o[i]];
          var net = rn.face.map(function (f) { return placed[f]; }), k = net.join('');
          if (seenNet[k]) return;
          seenNet[k] = true;
          pool.push({ opt: net, why: kind, mirror: kind === 'mirror' });
        });
      }
      placeAll(mirrorCube, 'mirror');
      choose(rng, others, 3).forEach(function (wc) { placeAll(wc, 'neighbours'); });
      var pick = balanced(rng, keyNet, pool, [totalTo(hamming6)], function (tri) { return tri.filter(function (c) { return c.mirror; }).length === 2; });
      if (!pick) continue;
      var placed = placeOptions(rng, keyNet, pick);
      return { strand: 'netback', cells: shape.cells, base: base, cube: cube, options: placed.options, why: placed.why, key: placed.key, group: shape.group,
        // the two pictures: [top, left-front, right-front]; the second is the cube turned over (T↔B through a half turn)
        views: [[cube[1], cube[4], cube[3]], [cube[0], cube[5], cube[2]]] };
    }
    return null;
  }
  function swap(arr, i, j) { var o = arr.slice(), t = o[i]; o[i] = o[j]; o[j] = t; return o; }
  function hamming6(a, b) { var n = 0; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }
  function netValidate(it) {
    var lib = netsLib();
    if (!lib) return 'the Nets library is loaded';
    if (!isArray(it.options) || it.options.length !== 4) return 'four options';
    // an independent fold: unit squares turned about their hinges in 3D (lib.fold3d)
    var nb = lib.neighbours(it.cells), rn = lib.rollNet(it.cells, nb, it.base);
    var squares = it.cells.map(function (c, i) { return { x: c[0], y: c[1], parent: rn.parent[i], hinge: rn.hinge[i] >= 0 ? ['N', 'E', 'S', 'W'][rn.hinge[i]] : null }; });
    var f3 = lib.fold3d(squares, it.base).face;
    if (f3.some(function (f, i) { return f !== rn.face[i]; })) return 'the 3D fold agrees with the rolling';
    // the pictures show the cube
    var cube = [];
    f3.forEach(function (f, i) { cube[f] = it.options[it.key][i]; });
    var pic = [[cube[1], cube[4], cube[3]], [cube[0], cube[5], cube[2]]];
    if (JSON.stringify(pic) !== JSON.stringify(it.views)) return 'the pictures show the answer\'s cube';
    var hits = 0;
    for (var i = 0; i < 4; i++) {
      var c = [];
      f3.forEach(function (f, s) { c[f] = it.options[i][s]; });
      if (sameCube(c, cube)) { hits++; if (i !== it.key) return 'the key folds into the cube'; }
      if (new Set(it.options[i]).size !== 6) return 'six different labels';
    }
    for (var a = 0; a < 4; a++) for (var b = a + 1; b < 4; b++) if (it.options[a].join('') === it.options[b].join('')) return 'options differ';
    return hits === 1 ? true : 'exactly one net folds into the cube';
  }

  /* =================================================================== viewfrom */
  // heights h[x][y] on a G × G grid; views as column heights, left to right as the viewer sees them:
  // front (from +y): x increasing; right (from +x): y decreasing; back (from −y): x decreasing; left (from −x): y increasing.
  var DIRS = ['front', 'right', 'back', 'left'];
  var VIEW_LEVELS = [{ g: 3, hmax: 2, dirs: [0, 1, 2, 3] }, { g: 3, hmax: 3, dirs: [0, 1, 2, 3] }, { g: 4, hmax: 3, dirs: [0, 1, 2, 3] }];
  function views(h) {
    var G = h.length, f = [], r = [];
    for (var x = 0; x < G; x++) { var m = 0; for (var y = 0; y < G; y++) m = mmax(m, h[x][y]); f.push(m); }
    for (var yy = G - 1; yy >= 0; yy--) { var m2 = 0; for (var xx = 0; xx < G; xx++) m2 = mmax(m2, h[xx][yy]); r.push(m2); }
    return [f, r, f.slice().reverse(), r.slice().reverse()];
  }
  function viewGen(rng, level) {
    var L = VIEW_LEVELS[level];
    for (var tries = 0; tries < 400; tries++) {
      var G = L.g, h = [], n = 0;
      for (var x = 0; x < G; x++) { h.push([]); for (var y = 0; y < G; y++) { var v = rng.chance(0.75) ? rng.int(1, L.hmax) : 0; h[x].push(v); n += v; } }
      if (n < G + 2) continue;
      var V = views(h), keys = V.map(function (v) { return v.join(''); });
      if (new Set(keys).size !== 4) continue;                 // every side looks different
      if (V.some(function (v) { return v.indexOf(0) >= 0; })) continue; // no empty column in any view
      var dir = rng.pick(L.dirs);
      return { strand: 'viewfrom', h: h, dir: dir, view: V[dir], options: DIRS.slice(), key: dir };
    }
    return null;
  }
  function viewValidate(it) {
    var V = views(it.h), shown = it.view.join(''), hits = V.filter(function (v) { return v.join('') === shown; }).length;
    if (hits !== 1 || V[it.key].join('') !== shown) return 'exactly one side gives the view';
    return true;
  }
  function cellsOfHeights(h) {
    var out = [];
    h.forEach(function (col, x) { col.forEach(function (v, y) { for (var z = 0; z < v; z++) out.push([x, y, z]); }); });
    return out;
  }

  /* =================================================================== whereami */
  // A 100 × 100 map (x right, y down = south); bearings in degrees clockwise from north. The circle shows
  // landmarks at bearing − facing (clockwise from ahead). A spot matches when some facing puts every shown
  // landmark within TOL of its place on the circle.
  var TOL = 10, FAR = 25;
  var WHERE_LEVELS = [{ marks: 5, shown: 2 }, { marks: 6, shown: 3 }, { marks: 7, shown: 3 }];
  function dist2(a, b) { return msqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])); }
  function bearing(a, b) { var d = matan2(b[0] - a[0], -(b[1] - a[1])) * 180 / PI; return (d + 360) % 360; }
  function angDiff(a, b) { var d = mabs(((a - b) % 360 + 540) % 360 - 180); return d; }
  // the best facing's worst error, and how many landmarks fit within TOL at that facing (sign −1: mirrored)
  function fit(spot, marks, shown, rel, sign) {
    var best = Infinity, bestFit = 0, b = shown.map(function (i) { return bearing(spot, marks[i]); });
    for (var f = 0; f < 360; f += 1) {
      var worst = 0, ok = 0;
      for (var i = 0; i < shown.length; i++) {
        var e = angDiff((b[i] - f + 360) % 360, (sign * rel[i] + 360) % 360);
        worst = mmax(worst, e);
        if (e <= TOL) ok++;
      }
      if (worst < best) best = worst;
      if (ok > bestFit) bestFit = ok;
    }
    return { worst: best, most: bestFit };
  }
  function whereGen(rng, level) {
    var L = WHERE_LEVELS[level];
    for (var tries = 0; tries < 200; tries++) {
      var marks = [];
      for (var mt = 0; mt < 300 && marks.length < L.marks; mt++) {
        var p = [rng.int(8, 92), rng.int(8, 92)];
        if (marks.every(function (q) { return msqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1])) >= 18; })) marks.push(p);
      }
      if (marks.length < L.marks) continue;
      function free(p, others) {
        return marks.every(function (q) { return msqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1])) >= 12; }) &&
          others.every(function (q) { return msqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1])) >= 18; });
      }
      var spot = null;
      for (var t = 0; t < 50 && !spot; t++) { var s = [rng.int(10, 90), rng.int(10, 90)]; if (free(s, [])) spot = s; }
      if (!spot) continue;
      var facing = rng.int(0, 359), shown = choose(rng, marks.map(function (m, i) { return i; }), L.shown);
      var rel = shown.map(function (i) { return mround((bearing(spot, marks[i]) - facing + 360) % 360); });
      // the shown landmarks must be well apart on the circle
      var apart = true;
      for (var a = 0; a < rel.length; a++) for (var b = a + 1; b < rel.length; b++) if (angDiff(rel[a], rel[b]) < 40) apart = false;
      if (!apart) continue;
      var mirrorSpots = [], partSpots = [], otherSpots = [];
      var mid = shown.reduce(function (acc, i) { return [acc[0] + marks[i][0] / shown.length, acc[1] + marks[i][1] / shown.length]; }, [0, 0]);
      for (var t2 = 0; t2 < 260; t2++) {
        // half of the candidates near the shown landmarks or the map's centre, so foils are not all farther away
        var c = t2 % 2 ? [rng.int(8, 92), rng.int(8, 92)] :
          (t2 % 4 ? [mround(mid[0] + rng.int(-28, 28)), mround(mid[1] + rng.int(-28, 28))] : [rng.int(30, 70), rng.int(30, 70)]);
        if (c[0] < 8 || c[0] > 92 || c[1] < 8 || c[1] > 92) continue;
        if (!free(c, [spot])) continue;
        var ft = fit(c, marks, shown, rel, 1);
        if (ft.worst <= FAR) continue;                       // every foil misses clearly
        var fm = fit(c, marks, shown, rel, -1);
        if (fm.worst <= TOL) mirrorSpots.push(c);
        else if (shown.length === 3 && ft.most >= 2) partSpots.push(c);
        else otherSpots.push(c);
      }
      var pool = [];
      mirrorSpots.forEach(function (c) { pool.push({ opt: c, why: 'mirror' }); });
      partSpots.forEach(function (c) { pool.push({ opt: c, why: 'two-of-three' }); });
      otherSpots.forEach(function (c) { pool.push({ opt: c, why: 'other' }); });
      pool = pool.filter(function (c, i) { return pool.slice(0, i).every(function (d) { return dist2(c.opt, d.opt) >= 18; }); });
      if (pool.length < 3) continue;
      var near = function (o) { return shown.reduce(function (sum, i) { return sum + dist2(o, marks[i]); }, 0); };
      var centre = function (o) { return dist2(o, [50, 50]); };
      var hasM = level > 0 && mirrorSpots.length > 0, hasP = level > 0 && partSpots.length > 0;
      var pick = balanced(rng, spot, pool, [near, centre, totalTo(dist2)], function (tri) {
        if (tri.some(function (c, i) { return tri.slice(0, i).some(function (d) { return dist2(c.opt, d.opt) < 18; }); })) return false;
        return (!hasM || tri.some(function (c) { return c.why === 'mirror'; })) && (!hasP || tri.some(function (c) { return c.why === 'two-of-three'; }));
      });
      if (!pick) continue;
      // the spot that fits sees its landmarks well apart, so it tends to lie among them: items where it is also the
      // spot nearest the shown landmarks (or the map's centre) are thinned out, so those guesses stay near chance
      var fo = pick.map(function (c) { return c.opt; });
      if (fo.every(function (o) { return near(o) > near(spot); }) && !rng.chance(0.6)) continue;
      if (fo.every(function (o) { return centre(o) > centre(spot); }) && !rng.chance(0.7)) continue;
      var placed = placeOptions(rng, spot, pick);
      return { strand: 'whereami', marks: marks, shown: shown, rel: rel, options: placed.options, why: placed.why, key: placed.key, facing: facing };
    }
    return null;
  }
  function whereValidate(it) {
    if (!isArray(it.options) || it.options.length !== 4) return 'four options';
    var hits = 0;
    for (var i = 0; i < 4; i++) {
      var f = fit(it.options[i], it.marks, it.shown, it.rel, 1);
      if (f.worst <= TOL) { hits++; if (i !== it.key) return 'the key is the spot that fits'; }
      else if (f.worst <= FAR) return 'every other spot misses by more than ' + FAR + '°';
    }
    return hits === 1 ? true : 'exactly one spot fits';
  }

  /* ============================================================== the definition */

  var GEN = { turn: turnGen, foldback: foldGen, cutback: cutGen, netback: netGen, viewfrom: viewGen, whereami: whereGen };
  var VAL = { turn: turnValidate, foldback: foldValidate, cutback: cutValidate, netback: netValidate, viewfrom: viewValidate, whereami: whereValidate };

  function generate(rng, params) {
    var strand = strandOf(params), level = levelOf(params), it = null;
    for (var t = 0; t < 6 && !it; t++) it = GEN[strand](rng, level);
    if (!it) it = GEN[strand](PX.rng(PX.rng.hash('otherway-fallback', strand, level)), 0) || fallback(strand);
    it.ex = 'otherway'; it.v = 1; it.seed = rng.seed; it.params = { variant: strand, level: level };
    it.answer = 'choice'; it.nOptions = 4;
    return it;
  }
  // a fixed item per strand (used only if the generator fails: never seen in 10 000 seeds per strand and level)
  function fallback(strand) {
    var it = GEN[strand](PX.rng(1), 0) || GEN[strand](PX.rng(2), 0);
    if (it) it.fallback = true;
    return it;
  }
  function validate(item) {
    if (!item || STRANDS.indexOf(item.strand) < 0) return 'a strand';
    if (!(item.key >= 0 && item.key < 4)) return 'a key';
    return VAL[item.strand](item);
  }
  function score(item, response) { return { correct: response === item.key }; }
  function difficulty(params) { return BASE + OFFSET[strandOf(params)] + STEP * levelOf(params); }

  PX.ex.define({
    id: 'otherway', version: 1, code: 'PR-6', name: 'Other Way Round', short: 'Other Way Round',
    abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'probe', answer: 'choice', nOptions: 4,
    format: FORMAT, // v1.2 (W2-measure): reserved formats, never in training material (tests/node/formats.test.mjs)
    variants: STRANDS.slice(),
    cycle: 'variant', // a probe block reads the strands in turn (js/engine/assess.js)
    dims: [{ key: 'level', label: 'Level', levels: [0, 1, 2], step: STEP }],
    base: BASE, difficulty: difficulty,
    chance: function () { return 0.25; },
    timeLimit: function (params) { return LIMIT[strandOf(params)]; },
    generate: generate, validate: validate, score: score,
    lib: {
      STRANDS: STRANDS, OFFSET: OFFSET, FORMAT: FORMAT, DIRS: DIRS, TOL: TOL, FN: FN, LABELS: LABELS,
      iso: iso, isoPt: isoPt, picDiff: picDiff, rotate: rotate, mirror: mirror, canon: canon, norm: norm, key3: key3,
      holes: holes, forwardHoles: forwardHoles, rects: rects, solid: solid, section: section, flat: flat, sig: sig, shapeDist: shapeDist,
      sameCube: sameCube, views: views, cellsOfHeights: cellsOfHeights, bearing: bearing, angDiff: angDiff, fit: fit,
      v3: { sub: v3sub, add: v3add, dot: v3dot, cross: v3cross, norm: v3norm }, copyCells: copyCells,
    },
  });
})(window.PX);
