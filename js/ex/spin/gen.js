/* EX-03 Spin: 2D speeded mental rotation (pure; ARCHITECTURE.md §5, PLAN.md §3, research/B-tasks.md §2, §14c).

   Stimuli are random polyominoes of 5–9 cells with no symmetry at all: the 8 lattice forms (4 rotations,
   each with and without a reflection) are all different, so the figure is chiral and has no rotational
   symmetry either (the shown angle is the effective angle). The outline is one simple polygon (no holes,
   no cells meeting only at a corner).

   Variants
     samediff  two figures: the reference and a probe turned by the item angle; the probe is the same
               figure or its mirror image. answer 'yesno' (true = same), chance 0.5.
     pick      the reference and 4 options: 2 turned copies and 2 turned mirror images, at 4 different
               angles that lie within 40° of each other around the item angle; copies and mirrors are
               dealt to those angles at random, so the angle gives no clue. answer 'multi' (the sorted
               indices of the two copies; right only if exactly both are picked), chance 1/6.
     The exercise declares answer 'multi' (nOptions 4, nCorrect 2) for the registry; every item carries
     its own `answer`, which the player must use (see `answers` on the definition).

   Dims: angle (9 overlapping bands: the item angle is the level angle ± 15°, clipped to 0–180°) and
   cells (5–9, with a range of concave corners per level). Turns go either way (dir).

   Mirror images reflect the figure across the lattice line (grid line or diagonal) nearest to its
   principal axis, so a mirror image keeps the edge directions, the long axis (within SHAPES[].eps) and
   the heavy end of the figure: at the same turn a copy and a mirror look alike except for their
   handedness (L vs J), and the turn read from the edges is the same for both. Cue control (measured by
   tests/node/spin.test.mjs): the base orientation of the reference is chosen by rules that never look at
   the answer (every figure position is treated as if a mirror could stand there): (1) no mirror may be
   the reference reflected across a line within 12° of the screen's vertical or horizontal (bilateral
   symmetry between two figures is seen without any rotation); (2) of a few orientations passing (1), the
   one where, at every figure position, a copy's and a mirror's bounding box would lie equally far from
   the reference's (aspect and size), so comparing boxes says nothing about which figures are copies.

   Coordinates: screen units (x right, y down), 1 = one cell. Angles in degrees, clockwise on screen.
   Item (JSON):
     { ex: 'spin', seed, params: { angle, cells, variant }, variant, answer: 'yesno' | 'multi', key,
       nOptions (2 | 4), nCorrect (pick: 2): the player's grid (yesno: option 1 = Same = true, 2 = Mirror),
       angle,                       the item angle: the turn of the probe (samediff) or the centre of the
                                    option turns (pick), 0–180
       dir,                         +1 clockwise, −1 counter-clockwise (all turns of the item share it)
       shape: { n, concave, cells, outline, radius, axis, mirrorAxis },
              cells: the polyomino as [x, y] lattice cells; outline: its boundary polygon around the
              centroid, unturned; radius: largest centroid–vertex distance (scale every figure of an item
              by the same factor, e.g. box / (2 · radius)); axis: principal axis (deg); mirrorAxis: the
              lattice line used for mirror images (deg, in the outline's frame)
       ref:   { rot, mirror: false, poly }
       probe: { rot, mirror, turn, poly }               samediff
       options: [{ rot, mirror, turn, poly }] × 4        pick
              rot: absolute turn applied to the outline (after the reflection when mirror); turn: the
              turn from the reference (exact for copies; for mirrors the turn after which only the flip
              is left); poly: the drawn polygon, centred on (0, 0). A mirror figure equals the copy at
              the same rot flipped across the screen line at angle rot + mirrorAxis through its centre.
     PX.ex.get('spin').lib exposes the model (analyse, figure, cellsFromPoly, …) for the view and tests.

   validate re-derives everything from the drawn polygons alone: each polygon is turned back by its edge
   direction, snapped to the lattice and filled; the cells' lattice forms give each figure's class (copy
   or mirror of the reference) and its exact turn; then it checks the chirality, the key, the turns
   against the level, that pick options are pairwise distinct and within 40° of each other, the pair
   symmetry rule, and that nothing is degenerate (simple outline, area = cells, concave corners). */
(function (PX) {
  'use strict';

  /* ------------------------------------------------------------ deterministic maths */
  // Only + − × ÷, Math.sqrt (correctly rounded) and Math.round/floor/abs are used, so the same seed gives
  // the same item in every engine (Math.sin, cos and atan2 may differ in the last bit between engines).
  var PI = Math.PI, TAU = 2 * Math.PI, HALF_PI = Math.PI / 2, SQRT3 = Math.sqrt(3), DEG = Math.PI / 180;

  function sinPoly(y) {
    var y2 = y * y;
    return y * (1 - y2 / 6 * (1 - y2 / 20 * (1 - y2 / 42 * (1 - y2 / 72 * (1 - y2 / 110 *
      (1 - y2 / 156 * (1 - y2 / 210 * (1 - y2 / 272 * (1 - y2 / 342)))))))));
  }
  function cosPoly(y) {
    var y2 = y * y;
    return 1 - y2 / 2 * (1 - y2 / 12 * (1 - y2 / 30 * (1 - y2 / 56 * (1 - y2 / 90 *
      (1 - y2 / 132 * (1 - y2 / 182 * (1 - y2 / 240 * (1 - y2 / 306))))))));
  }
  // [sin, cos] of an angle in degrees; exact at multiples of 90°.
  function sincos(d) {
    if (d % 90 === 0) {
      var k = ((d / 90) % 4 + 4) % 4;
      return k === 0 ? [0, 1] : k === 1 ? [1, 0] : k === 2 ? [0, -1] : [-1, 0];
    }
    var x = d * DEG, r = x - Math.round(x / TAU) * TAU, q = Math.round(r / HALF_PI);
    var y = r - q * HALF_PI, s = sinPoly(y), c = cosPoly(y);
    q = ((q % 4) + 4) % 4;
    return q === 0 ? [s, c] : q === 1 ? [c, -s] : q === 2 ? [-s, -c] : [-c, s];
  }
  function atanSmall(t) { // |t| ≤ tan 15°
    var t2 = t * t, s = 0;
    for (var k = 29; k >= 1; k -= 2) s = 1 / k - t2 * s;
    return t * s;
  }
  function atan(t) {
    var neg = t < 0; if (neg) t = -t;
    var inv = t > 1; if (inv) t = 1 / t;
    var a = t > 0.2679491924311227 ? PI / 6 + atanSmall((t * SQRT3 - 1) / (t + SQRT3)) : atanSmall(t);
    if (inv) a = HALF_PI - a;
    return neg ? -a : a;
  }
  // Degrees in (−180, 180].
  function atan2d(y, x) {
    var a;
    if (x > 0) a = atan(y / x);
    else if (x < 0) a = y >= 0 ? atan(y / x) + PI : atan(y / x) - PI;
    else a = y > 0 ? HALF_PI : y < 0 ? -HALF_PI : 0;
    return a / DEG;
  }
  function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }          // [0, 360)
  function norm180(a) { a = norm360(a); return a >= 180 ? a - 360 : a; } // [−180, 180)
  function rnd(x, f) { return Math.round(x * f) / f; }
  function r2(x) { return rnd(x, 100); }
  function r4(x) { return rnd(x, 10000); }
  // Distance of a line direction (deg, mod 180) from the nearest multiple of `m` degrees.
  function offGrid(a, m) { var x = norm360(a) % m; return x > m / 2 ? m - x : x; }

  function rotate(p, sc) { return [p[0] * sc[1] - p[1] * sc[0], p[0] * sc[0] + p[1] * sc[1]]; } // clockwise on screen
  // Reflection across the line through the origin at angle g (deg).
  function reflect(p, g) { var sc = sincos(2 * g); return [p[0] * sc[1] + p[1] * sc[0], p[0] * sc[0] - p[1] * sc[1]]; }

  /* ------------------------------------------------------------ polyominoes */
  var DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function ck(x, y) { return x + ',' + y; }

  // The 8 lattice symmetries acting on cell centres (x + ½, y + ½): t = 0–3 turn by 0/90/180/270°
  // clockwise on screen; t = 4–7 reflect x → −x first.
  function xform(cells, t) {
    var out = [];
    for (var i = 0; i < cells.length; i++) {
      var x = cells[i][0] + 0.5, y = cells[i][1] + 0.5, X, Y;
      if (t >= 4) x = -x;
      switch (t & 3) {
        case 0: X = x; Y = y; break;
        case 1: X = -y; Y = x; break;
        case 2: X = -x; Y = -y; break;
        default: X = y; Y = -x;
      }
      out[i] = [X - 0.5, Y - 0.5];
    }
    return out;
  }
  // Translation-free text form of a cell set.
  function canon(cells) {
    var mx = Infinity, my = Infinity, i;
    for (i = 0; i < cells.length; i++) { if (cells[i][0] < mx) mx = cells[i][0]; if (cells[i][1] < my) my = cells[i][1]; }
    var keys = cells.map(function (c) { return (c[0] - mx) * 64 + (c[1] - my); });
    keys.sort(function (a, b) { return a - b; });
    return keys.join('.');
  }
  // forms[t] for t = 0–7 (see xform).
  function forms(cells) { var f = []; for (var t = 0; t < 8; t++) f.push(canon(xform(cells, t))); return f; }
  function distinctCount(list) { var seen = {}, n = 0; list.forEach(function (k) { if (!seen[k]) { seen[k] = true; n++; } }); return n; }

  // Random polyomino of n cells grown edge to edge (part branching, part snake-like).
  function grow(r, n) {
    var cells = [[0, 0]], has = {}, snake = r.float(0, 0.6);
    has[ck(0, 0)] = true;
    for (var guard = 0; cells.length < n && guard < 400; guard++) {
      var base = r.chance(snake) ? cells[cells.length - 1] : cells[r.int(0, cells.length - 1)];
      var d = DIRS[r.int(0, 3)], x = base[0] + d[0], y = base[1] + d[1];
      if (!has[ck(x, y)]) { has[ck(x, y)] = true; cells.push([x, y]); }
    }
    return cells.length === n ? cells : null;
  }

  // Boundary of a cell set as one simple polygon (clockwise on screen) with collinear vertices removed,
  // or null when the boundary is not one simple loop (a hole, or cells meeting only at a corner).
  function outlineOf(cells) {
    var has = {}, next = {}, count = 0, ok = true, first = null;
    cells.forEach(function (c) { has[ck(c[0], c[1])] = true; });
    function edge(x1, y1, x2, y2) {
      var k = ck(x1, y1);
      if (next[k]) { ok = false; return; } // two edges leave one corner: a pinch
      next[k] = [x2, y2]; count++;
      if (!first) first = [x1, y1];
    }
    cells.forEach(function (c) {
      var x = c[0], y = c[1];
      if (!has[ck(x, y - 1)]) edge(x, y, x + 1, y);
      if (!has[ck(x + 1, y)]) edge(x + 1, y, x + 1, y + 1);
      if (!has[ck(x, y + 1)]) edge(x + 1, y + 1, x, y + 1);
      if (!has[ck(x - 1, y)]) edge(x, y + 1, x, y);
    });
    if (!ok || !first) return null;
    var loop = [], p = first, steps = 0;
    do {
      loop.push(p);
      p = next[ck(p[0], p[1])];
      if (!p || ++steps > count) return null;
    } while (p[0] !== first[0] || p[1] !== first[1]);
    if (steps !== count) return null; // more than one loop: a hole
    var out = [];
    for (var i = 0; i < loop.length; i++) {
      var a = loop[(i + loop.length - 1) % loop.length], b = loop[i], c = loop[(i + 1) % loop.length];
      if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push(b);
    }
    return out;
  }

  // Turn direction at each vertex of a closed polygon: +1 clockwise (convex for a clockwise outline), −1.
  function turnsOf(poly) {
    var n = poly.length, out = [];
    for (var i = 0; i < n; i++) {
      var a = poly[(i + n - 1) % n], b = poly[i], c = poly[(i + 1) % n];
      var cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      out.push(cr > 0 ? 1 : cr < 0 ? -1 : 0);
    }
    return out;
  }
  function areaOf(poly) { // signed: positive for clockwise on screen (y down)
    var s = 0;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return s / 2;
  }

  // Everything the generator, the validator and the view need about one cell set, or null when its
  // outline is not one simple polygon. Cells are normalised (smallest x and y = 0) and sorted.
  function analyse(cellsIn) {
    var mx = Infinity, my = Infinity, Mx = -Infinity, My = -Infinity, i, n = cellsIn.length;
    for (i = 0; i < n; i++) {
      var c = cellsIn[i];
      if (c[0] < mx) mx = c[0]; if (c[1] < my) my = c[1];
      if (c[0] > Mx) Mx = c[0]; if (c[1] > My) My = c[1];
    }
    var cells = cellsIn.map(function (q) { return [q[0] - mx, q[1] - my]; });
    cells.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var outline = outlineOf(cells);
    if (!outline) return null;
    var tv = turnsOf(outline), convex = 0, concave = 0;
    tv.forEach(function (t) { if (t > 0) convex++; else if (t < 0) concave++; });
    if (convex - concave !== 4 || convex + concave !== outline.length) return null;
    var cx = 0, cy = 0;
    cells.forEach(function (q) { cx += q[0] + 0.5; cy += q[1] + 0.5; });
    cx /= n; cy /= n;
    var sxx = 1 / 12, syy = 1 / 12, sxy = 0; // unit squares: 1/12 about their own centre
    cells.forEach(function (q) {
      var dx = q[0] + 0.5 - cx, dy = q[1] + 0.5 - cy;
      sxx += dx * dx / n; syy += dy * dy / n; sxy += dx * dy / n;
    });
    var axis = 0.5 * atan2d(2 * sxy, sxx - syy);                       // (−90, 90]
    var elong = Math.sqrt((sxx - syy) * (sxx - syy) + 4 * sxy * sxy) / (sxx + syy);
    var near = 45 * Math.round(axis / 45);                            // nearest lattice line
    var rel = outline.map(function (p) { return [p[0] - cx, p[1] - cy]; });
    var radius = 0;
    rel.forEach(function (p) { var d = Math.sqrt(p[0] * p[0] + p[1] * p[1]); if (d > radius) radius = d; });
    var f = forms(cells);
    return {
      n: n, cells: cells, outline: rel, concave: concave, w: Mx - mx + 1, h: My - my + 1,
      axis: axis, elong: elong, mirrorAxis: norm360(near) % 180, eps: 2 * (axis - near),
      radius: radius, forms: f, distinct: distinctCount(f),
    };
  }

  // A figure: the outline (reflected across the shape's lattice line when mirror), turned by rot.
  function figure(shape, rot, mirror) {
    rot = r2(norm360(rot));
    var sc = sincos(rot);
    var poly = shape.outline.map(function (p) {
      var q = rotate(mirror ? reflect(p, shape.mirrorAxis) : p, sc);
      return [r4(q[0]), r4(q[1])];
    });
    return { rot: rot, mirror: !!mirror, poly: poly };
  }

  /* ------------------------------------------------------------ levels */
  var VARIANTS = ['samediff', 'pick'];
  var ANGLES = [10, 30, 50, 70, 90, 110, 130, 150, 170];
  var JITTER = 15;                      // the item angle is the level angle ± 15° (bands overlap; 0–180° covered)
  var CELLS = [5, 6, 7, 8, 9];
  // Complexity: cells, concave corners (outline vertices = 4 + 2 × concave), largest extent in cells, and
  // eps: the most a mirror's long axis may differ from the copy's at the same turn (degrees; eps is twice
  // the tilt of the principal axis from the nearest lattice line). Small polyominoes have tilted axes, so
  // the bound is looser where few shapes would pass (5 cells: 3 free shapes; 6 cells: 4).
  var SHAPES = [
    { n: 5, cmin: 1, cmax: 3, ext: 4, eps: 22 },
    { n: 6, cmin: 2, cmax: 3, ext: 4, eps: 20 },
    { n: 7, cmin: 2, cmax: 4, ext: 4, eps: 18 },
    { n: 8, cmin: 3, cmax: 5, ext: 5, eps: 18 },
    { n: 9, cmin: 3, cmax: 6, ext: 5, eps: 18 },
  ];
  var SPREAD = [-18, -6, 6, 18];        // pick: option turns around the item angle (± 2° each)
  var SPREAD_JITTER = 2;
  var SPAN_MAX = 40;                    // pick: all option turns lie within 40° of each other
  var DISTINCT_MIN = 6;                 // pick: option turns differ by at least this
  var PAIR_AXIS_MIN = 12;               // see the header: no mirror pair across a near-vertical/horizontal line

  function clampInt(x, n) { x = Number.isInteger(x) ? x : 0; return x < 0 ? 0 : x >= n ? n - 1 : x; }
  function normParams(params) {
    var p = params || {};
    return {
      angle: clampInt(p.angle, ANGLES.length),
      cells: clampInt(p.cells, SHAPES.length),
      variant: VARIANTS.indexOf(p.variant) >= 0 ? p.variant : VARIANTS[0],
    };
  }
  function angleRange(p) {
    var A = ANGLES[p.angle];
    return [Math.max(0, A - JITTER), Math.min(180, A + JITTER)];
  }
  function shapeOk(a, lv) {
    return !!a && a.n === lv.n && Math.max(a.w, a.h) <= lv.ext && a.concave >= lv.cmin && a.concave <= lv.cmax &&
      a.distinct === 8 && Math.abs(a.eps) <= lv.eps + 1e-9;
  }
  // Cheap tests on the raw cells first (extent, then the principal axis), so that the outline and the
  // lattice forms are only worked out for shapes that can pass.
  function quickOk(cells, lv) {
    var n = cells.length, mx = Infinity, my = Infinity, Mx = -Infinity, My = -Infinity, cx = 0, cy = 0, i;
    for (i = 0; i < n; i++) {
      var x = cells[i][0], y = cells[i][1];
      if (x < mx) mx = x; if (x > Mx) Mx = x; if (y < my) my = y; if (y > My) My = y;
      cx += x; cy += y;
    }
    if (Mx - mx + 1 > lv.ext || My - my + 1 > lv.ext) return false;
    cx /= n; cy /= n;
    var sxx = 0, syy = 0, sxy = 0;
    for (i = 0; i < n; i++) { var dx = cells[i][0] - cx, dy = cells[i][1] - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    var axis = 0.5 * atan2d(2 * sxy, sxx - syy);
    return Math.abs(2 * (axis - 45 * Math.round(axis / 45))) <= lv.eps + 1e-9;
  }
  function makeShape(r, lv) {
    for (var i = 0; i < 1500; i++) {
      var cells = grow(r, lv.n);
      if (!cells || !quickOk(cells, lv)) continue;
      var a = analyse(cells);
      if (shapeOk(a, lv)) return a;
    }
    return null;
  }

  /* ------------------------------------------------------------ items */
  // Line across which a mirror at `turn` would reflect the reference (deg, mod 180).
  function pairAxis(beta, shape, turn) { return beta + shape.mirrorAxis + turn / 2; }
  // Axis-aligned bounding box of the outline turned by rot (after the reflection when mirror): [w, h].
  function bbox(shape, rot, mirror) {
    var sc = sincos(rot), x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (var i = 0; i < shape.outline.length; i++) {
      var p = shape.outline[i], q = rotate(mirror ? reflect(p, shape.mirrorAxis) : p, sc);
      if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
      if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
    }
    return [x1 - x0, y1 - y0];
  }
  // How much the bounding boxes would tell copies from mirrors, read the way a box heuristic reads them:
  // at each turn of the item, how differently far a copy's box and a mirror's box lie from the
  // reference's box (in log aspect, and in width + height relative to the reference's), summed over the
  // turns. Zero means the boxes rank the options the same whichever are the copies.
  function boxGap(shape, beta, turns) {
    var R = bbox(shape, beta, false), lr = PX.rng.ln(R[0] / R[1]), span = R[0] + R[1], g = 0;
    for (var j = 0; j < turns.length; j++) {
      var a = bbox(shape, beta + turns[j], false), b = bbox(shape, beta + turns[j], true);
      var dA = Math.abs(PX.rng.ln(a[0] / a[1]) - lr), dB = Math.abs(PX.rng.ln(b[0] / b[1]) - lr);
      var sA = Math.abs(a[0] - R[0]) + Math.abs(a[1] - R[1]), sB = Math.abs(b[0] - R[0]) + Math.abs(b[1] - R[1]);
      g += Math.abs(dA - dB) + Math.abs(sA - sB) / span;
    }
    return g;
  }
  // Base orientation of the reference. The rule never looks at the answer: it treats every turn of the
  // item as if a mirror could stand there. Hard rule: no mirror would be the reference reflected across a
  // line within PAIR_AXIS_MIN of the screen's vertical or horizontal. Soft rule: of BETA_TRIES orientations
  // that pass, the one with the smallest boxGap (boxes then rank copies and mirrors alike).
  var BETA_TRIES = 12;
  function pickBeta(r, shape, turns) {
    var best = null, bestGap = Infinity, worst = 0, worstGap = -1, found = 0;
    for (var i = 0; i < 80 && found < BETA_TRIES; i++) {
      var b = r2(r.float(0, 360)), gap = Infinity;
      for (var j = 0; j < turns.length; j++) gap = Math.min(gap, offGrid(pairAxis(b, shape, turns[j]), 90));
      if (gap >= PAIR_AXIS_MIN + 0.5) {
        found++;
        var g = boxGap(shape, b, turns);
        if (g < bestGap) { bestGap = g; best = b; }
      } else if (gap > worstGap) { worstGap = gap; worst = b; }
    }
    return best === null ? worst : best;
  }

  function shapeOut(shape) {
    return {
      n: shape.n, concave: shape.concave, cells: shape.cells.map(function (c) { return c.slice(); }),
      outline: shape.outline.map(function (p) { return [r4(p[0]), r4(p[1])]; }),
      radius: r4(shape.radius), axis: r2(shape.axis), mirrorAxis: shape.mirrorAxis,
    };
  }

  // One attempt; shape may be given (fallback). Returns an item without seed (generate adds it).
  function build(r, p, shape) {
    shape = shape || makeShape(r.fork('shape'), SHAPES[p.cells]);
    if (!shape) return null;
    var ar = angleRange(p), theta = r2(r.float(ar[0], ar[1])), dir = r.chance(0.5) ? 1 : -1;
    var item = {
      ex: 'spin', params: { angle: p.angle, cells: p.cells, variant: p.variant }, variant: p.variant,
      answer: p.variant === 'pick' ? 'multi' : 'yesno', nOptions: p.variant === 'pick' ? 4 : 2,
      key: null, angle: theta, dir: dir, shape: shapeOut(shape),
    };
    if (p.variant === 'pick') item.nCorrect = 2;
    if (p.variant === 'samediff') {
      var same = r.chance(0.5), turn = r2(norm180(dir * theta));
      if (turn === -180) turn = 180;
      var beta = pickBeta(r, shape, [turn]);
      item.ref = figure(shape, beta, false);
      item.probe = figure(shape, beta + turn, !same);
      item.probe.turn = turn;
      item.key = same;
      return item;
    }
    var turns = SPREAD.map(function (d) {
      var t = r2(norm180(dir * (theta + d + r.float(-SPREAD_JITTER, SPREAD_JITTER))));
      return t === -180 ? 180 : t;
    });
    var slots = r.shuffle([0, 1, 2, 3]), copy = {};
    copy[slots[0]] = true; copy[slots[1]] = true;
    var b2 = pickBeta(r, shape, turns), order = r.shuffle([0, 1, 2, 3]), key = [];
    item.ref = figure(shape, b2, false);
    item.options = order.map(function (slot, k) {
      var f = figure(shape, b2 + turns[slot], !copy[slot]);
      f.turn = turns[slot];
      if (copy[slot]) key.push(k);
      return f;
    });
    item.key = key; // built in index order, so already sorted
    return item;
  }

  var stats = { fallbacks: 0 };
  function generate(rng, params) {
    var p = normParams(params), item = null;
    for (var i = 0; i < 50 && !item; i++) {
      var it = build(i === 0 ? rng : rng.fork('retry' + i), p);
      if (it && validate(it) === true) item = it;
    }
    if (!item) { item = fallback(rng, p); item.fallback = true; } // ARCHITECTURE §5: the engine voids fallback trials
    item.seed = rng.seed;
    return item;
  }

  // Known-good shapes (one per complexity level, checked by the tests at every angle and variant).
  var FIXED = [
    [[0, 0], [0, 1], [0, 2], [0, 3], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [3, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [2, 0], [2, 1]],
    [[0, 0], [0, 1], [0, 4], [1, 1], [1, 2], [1, 3], [1, 4], [2, 1]],
    [[0, 1], [0, 2], [1, 1], [1, 2], [1, 3], [1, 4], [2, 0], [2, 1], [2, 4]],
  ];

  function fallback(rng, p) {
    stats.fallbacks++;
    var shape = analyse(FIXED[p.cells]);
    for (var i = 0; i < 50; i++) {
      var it = build(rng.fork('fallback' + i), p, shape);
      if (it && validate(it) === true) return it;
    }
    return build(rng.fork('fallback'), p, shape); // unreachable for the fixed shapes (tested)
  }

  /* ------------------------------------------------------------ validation (from the polygons alone) */
  function isPt(p) { return Array.isArray(p) && p.length === 2 && isFinite(p[0]) && isFinite(p[1]) && typeof p[0] === 'number' && typeof p[1] === 'number'; }
  function inside(poly, x, y) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }

  // Cells of a drawn figure: turn the polygon back by its edge direction (mod 90°), snap it to the
  // lattice and fill it. → { cells, phi, poly } (poly: the snapped polygon), or a reason string.
  function cellsFromPoly(poly) {
    if (!Array.isArray(poly) || poly.length < 6 || poly.length > 40) return 'a polygon has a wrong number of vertices';
    var n = poly.length, sx = 0, sy = 0, ang = [], i;
    for (i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n];
      if (!isPt(a)) return 'a polygon vertex is not a pair of numbers';
      var dx = b[0] - a[0], dy = b[1] - a[1];
      if (!(dx * dx + dy * dy > 0.81)) return 'a polygon edge is shorter than a cell';
      var t = 4 * atan2d(dy, dx), sc = sincos(t);
      sx += sc[1]; sy += sc[0]; ang.push(t);
    }
    var phi = norm360(atan2d(sy, sx)) / 4; // [0, 90)
    for (i = 0; i < n; i++) if (Math.abs(norm180(ang[i] - 4 * phi)) > 0.2) return 'polygon edges are not at right angles';
    var back = sincos(-phi), pts = poly.map(function (p) { return rotate(p, back); });
    var mx = Infinity, my = Infinity;
    pts.forEach(function (p) { if (p[0] < mx) mx = p[0]; if (p[1] < my) my = p[1]; });
    var W = 0, H = 0, snapped = [];
    for (i = 0; i < n; i++) {
      var x = pts[i][0] - mx, y = pts[i][1] - my, X = Math.round(x), Y = Math.round(y);
      if (Math.abs(x - X) > 0.01 || Math.abs(y - Y) > 0.01) return 'polygon vertices are not on a lattice';
      snapped.push([X, Y]);
      if (X > W) W = X; if (Y > H) H = Y;
    }
    if (W > 12 || H > 12) return 'a figure is too large';
    var cells = [];
    for (var cx = 0; cx < W; cx++) for (var cy = 0; cy < H; cy++) if (inside(snapped, cx + 0.5, cy + 0.5)) cells.push([cx, cy]);
    return { cells: cells, phi: phi, poly: snapped, w: W, h: H };
  }

  // One figure: its cells, and a check that the polygon is exactly their simple outline.
  function readFigure(fig, lv) {
    if (!fig || typeof fig !== 'object') return 'a figure is missing';
    var g = cellsFromPoly(fig.poly);
    if (typeof g === 'string') return g;
    if (g.cells.length !== lv.n) return 'a figure has ' + g.cells.length + ' cells, not ' + lv.n;
    if (Math.abs(Math.abs(areaOf(g.poly)) - lv.n) > 1e-6) return 'a figure outline is not simple (area ≠ cells)';
    var ol = outlineOf(g.cells);
    if (!ol || ol.length !== g.poly.length) return 'a figure outline is not the simple outline of its cells';
    var concave = 0;
    turnsOf(ol).forEach(function (t) { if (t < 0) concave++; });
    if (concave < lv.cmin || concave > lv.cmax) return 'a figure has ' + concave + ' concave corners (level allows ' + lv.cmin + '–' + lv.cmax + ')';
    if (Math.max(g.w, g.h) > lv.ext) return 'a figure is wider than ' + lv.ext + ' cells';
    g.form = canon(g.cells);
    return g;
  }

  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  function check(item) {
    if (!item || item.ex !== 'spin') return 'not a spin item';
    var p = item.params;
    if (!p || !Number.isInteger(p.angle) || p.angle < 0 || p.angle >= ANGLES.length) return 'params.angle out of range';
    if (!Number.isInteger(p.cells) || p.cells < 0 || p.cells >= SHAPES.length) return 'params.cells out of range';
    if (VARIANTS.indexOf(p.variant) < 0 || item.variant !== p.variant) return 'unknown or inconsistent variant';
    var pick = p.variant === 'pick';
    if (item.answer !== (pick ? 'multi' : 'yesno') || item.nOptions !== (pick ? 4 : 2) || (pick && item.nCorrect !== 2)) return 'answer format does not match the variant';
    var lv = SHAPES[p.cells], ar = angleRange(p);
    if (!(item.angle >= ar[0] - 1e-9 && item.angle <= ar[1] + 1e-9)) return 'item angle outside the level';
    if (item.dir !== 1 && item.dir !== -1) return 'dir must be ±1';
    var others = pick ? item.options : [item.probe];
    if (!Array.isArray(others) || others.length !== (pick ? 4 : 1)) return 'wrong number of options';

    var ref = readFigure(item.ref, lv);
    if (typeof ref === 'string') return 'reference: ' + ref;
    var f = forms(ref.cells);
    if (distinctCount(f) !== 8) return 'the figure has a symmetry (it must be chiral, with no rotational symmetry)';
    if (!item.shape || !Array.isArray(item.shape.cells) || f.slice(0, 4).indexOf(canon(item.shape.cells)) < 0) return 'shape.cells is not the drawn figure';
    if (!Array.isArray(item.shape.outline) || Math.abs(Math.abs(areaOf(item.shape.outline)) - lv.n) > 0.01) return 'shape.outline is not the outline of the cells';

    var copies = [], derived = [];
    for (var i = 0; i < others.length; i++) {
      var fig = others[i], g = readFigure(fig, lv);
      if (typeof g === 'string') return 'option ' + i + ': ' + g;
      var k = f.indexOf(g.form);
      if (k < 0) return 'option ' + i + ' is neither a turned copy nor a turned mirror of the reference';
      var isCopy = k < 4, turn;
      if (isCopy) {
        turn = norm180(g.phi - ref.phi + 90 * k);
        if (Math.abs(norm180(turn - fig.turn)) > 0.05) return 'option ' + i + ': its turn is ' + r2(turn) + '°, not ' + fig.turn + '°';
        copies.push(i);
      } else {
        if (offGrid(g.phi - ref.phi - fig.turn, 90) > 0.05) return 'option ' + i + ': mirror edges do not match its turn';
        // The line across which this mirror reflects the reference, from the geometry.
        var axis = 90 + (ref.phi + g.phi + 90 * (k - 4)) / 2;
        if (offGrid(axis, 90) < PAIR_AXIS_MIN - 0.01) return 'option ' + i + ' is the reference reflected across a near-vertical or near-horizontal line';
      }
      if (!!fig.mirror === isCopy) return 'option ' + i + ': the mirror flag does not match the geometry';
      derived.push(fig.turn);
    }

    if (!pick) {
      if (item.key !== (copies.length === 1)) return 'the key does not match the probe';
      if (Math.abs(Math.abs(item.probe.turn) - item.angle) > 0.011) return 'probe turn does not match the item angle';
      if (item.angle > 0 && item.angle < 180 && Math.sign(item.probe.turn) !== item.dir) return 'probe turn has the wrong direction';
      return true;
    }
    if (copies.length !== 2) return 'pick needs exactly 2 copies and 2 mirrors (found ' + copies.length + ' copies)';
    if (!Array.isArray(item.key) || item.key.length !== 2 || item.key[0] !== copies[0] || item.key[1] !== copies[1]) return 'the key is not the sorted list of the copies';
    var centre = item.dir * item.angle;
    for (i = 0; i < 4; i++) {
      if (Math.abs(norm180(derived[i] - centre)) > SPAN_MAX / 2 + 0.01) return 'option ' + i + ' is more than 20° from the item angle';
      for (var j = i + 1; j < 4; j++) {
        var d = Math.abs(norm180(derived[i] - derived[j]));
        if (d > SPAN_MAX + 0.01) return 'options ' + i + ' and ' + j + ' are more than 40° apart';
        if (d < DISTINCT_MIN) return 'options ' + i + ' and ' + j + ' are at nearly the same angle';
      }
    }
    return true;
  }

  /* ------------------------------------------------------------ scoring */
  function score(item, response) {
    if (item.answer === 'yesno') {
      if (typeof response !== 'boolean') return { correct: false, detail: { invalid: true } };
      return { correct: response === item.key, detail: { same: item.key } };
    }
    if (!Array.isArray(response)) return { correct: false, detail: { invalid: true } };
    var resp = response.slice().sort(function (a, b) { return a - b; }), hits = 0, seen = {}, ok = resp.length === item.key.length;
    for (var i = 0; i < resp.length; i++) {
      if (item.key.indexOf(resp[i]) >= 0 && !seen[resp[i]]) hits++;
      seen[resp[i]] = true;
      if (resp[i] !== item.key[i]) ok = false;
    }
    return { correct: ok, value: hits, detail: { picked: resp.length, hits: hits } };
  }

  PX.ex.define({
    id: 'spin', version: 1, code: 'EX-03', name: '2D speeded rotation', short: 'Spin',
    abilities: ['SR'], cell: 'intrinsic-dynamic', role: 'train',
    // The registry holds one answer type; samediff items are 'yesno' (item.answer says which).
    answer: 'multi', nOptions: 4, nCorrect: 2,
    answers: { samediff: 'yesno', pick: 'multi' },
    dims: [
      { key: 'angle', label: 'Angle', levels: ANGLES, step: 0.33, unit: '°' },
      { key: 'cells', label: 'Cells', levels: CELLS, step: 0.35 },
    ],
    base: -1.75,
    variants: VARIANTS,
    chance: function (params) { return params && params.variant === 'pick' ? 1 / 6 : 0.5; },
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      ANGLES: ANGLES, SHAPES: SHAPES, BETA_TRIES: BETA_TRIES, bbox: bbox, boxGap: boxGap, FIXED: FIXED, JITTER: JITTER, SPREAD: SPREAD, PAIR_AXIS_MIN: PAIR_AXIS_MIN,
      stats: stats,
      sincos: sincos, atan2d: atan2d, norm180: norm180, norm360: norm360,
      xform: xform, canon: canon, forms: forms, grow: grow, outlineOf: outlineOf, analyse: analyse, shapeOk: shapeOk,
      figure: figure, quickOk: quickOk, reflect: reflect, rotate: rotate, areaOf: areaOf, cellsFromPoly: cellsFromPoly,
      build: build, fallback: fallback, normParams: normParams,
    },
  });
})(window.PX);
