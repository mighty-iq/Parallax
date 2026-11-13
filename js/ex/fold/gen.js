/* EX-04 Fold: paper folding and punching (pure; ARCHITECTURE.md §5).

   The task. A square sheet of N × N cells (N = 8; x to the right, y downwards, the sheet is
   [0, N]²) is folded 1–5 times, shown step by step, then punched 1–3 times through every layer.
   Which unfolded sheet is right? 4 options (5 from 4 folds up); every option has the same
   number of holes.

   Model (exact). Fold lines are vertical or horizontal grid lines (x = c, y = c) or 45° lines
   through grid vertices (x − y = c, x + y = c), c an integer. Every fold is a simple fold: all
   layers on the moving side are reflected across the line and land on top. A fold is legal
   only when both sides hold paper, the flap covers at least 2 cells, and the flap lands inside
   the stationary part (no overhang). The folded footprint is therefore always the convex
   polygon "sheet ∩ stationary half-planes", fully covered by paper, and it is one piece.
   Holes sit at cell centres; reflections across these lines map cell centres to cell centres.
   A punch at a cell of the folded state is allowed only when that cell lies wholly on the
   folded paper and no layer under it is cut by a crease (so no punch sits on an edge or a
   fold line, and every hole is a clean circle away from every crease). It makes one hole in
   every original cell whose centre lies under it.

   Fold classes (item.folds[k].cls): H straight (vertical or horizontal; through the centre of
   the current shape when that is possible, otherwise a narrower flap), D diagonal (a 45° line
   through the centre of the current shape's bounding box: the whole square along its
   diagonal, or a triangle in half), C corner (a 45° line that cuts a corner flap off; the
   moving side does not hold the centre). Type levels: half = all H; corner = at least one C,
   the rest H; diagonal = 45° folds only (at least one D); mixed = at least one D and one H
   (one fold: a D fold). Straight folds may be off-centre because pure halving gives 2^folds
   layers everywhere (32 holes per punch at 5 folds) and would leave no fold that can miss
   the punch.

   Folds that matter (Burte et al. 2018: the number of folds relevant to the answer predicts
   accuracy better than the total). A fold matters when the punches go through its flap
   (unfolding it adds holes). Dim `idle` = how many of the folds do not matter, at most
   folds − 1. Holes per item ≤ 16.

   Foils come from neighbouring problems, never from small edits of the key. Each punch
   unfolds on its own, and a foil gives every punch either its true holes or the holes of a
   mistake: one fold unfolded across a wrong line (a parallel line 1–3 cells away, or another
   kind of line through the crease's midpoint or the shape's centre), two folds unfolded across
   wrong lines, or two folds unfolded in the wrong order. Consistent foils make one mistake for
   every punch; mixed foils make it for some punches only (so foils lie near each other and the
   key is not the option most like the others). Rationed extras: a punch one cell away in the
   folded state, the answer mirrored, mirrors of other foils. Every option has the key's hole
   count. The set is then chosen against the shortcuts: the key's rank on total Hamming
   distance ("most like the others" / "odd one out") meets a random target; a key fully
   symmetric about the first fold line gets foils just as symmetric (otherwise a random rank
   target); and since the key always has a hole right under each punch, foils without one are
   rationed by the number of folds that matter.

   Item: { ex, v, seed, params, key, n, nOptions, holes, folds: [{ cls, line: {k, c}, move,
   dir, seg, matters }], punches: [[i, j]], options: [[[i, j], …]], why: [null | text],
   steps: [{ outline, holes, faces: [{ poly, layer, back, moved, from?, holes }] }] }.
   line.k: 'v' x = c, 'h' y = c, 'd' x − y = c, 'a' x + y = c. move: the moving side is where
   move × side(x, y) > 0 (side: x − c, y − c, x − y − c, x + y − c). dir: the direction the flap
   travels (−move × gradient). seg: the crease segment on the shape before the fold. Cells are
   [column, row] = [i, j]. steps[k] is the state after k folds (steps[0] the flat sheet):
   outline (convex polygon), holes (cells where punched layers lie in that state; steps[F]
   holes = the punches, steps[0] holes = the key), faces (paper pieces that moved rigidly
   together, in layer order: higher layer on top; back = the back of the paper faces up;
   moved = moved by fold k; from = where a moved face was before fold k; holes on that face).
   why[i] names the neighbouring problem that made option i (null for the key).
   def.lib exposes the geometry helpers (for views and tests). */
(function (PX) {
  'use strict';

  // Globals cached once: inside a node:vm context (the tests) every global lookup is slow.
  var floor = Math.floor, ceil = Math.ceil, round = Math.round, abs = Math.abs;
  var INF = Infinity, isArray = Array.isArray, okeys = Object.keys, isInt = Number.isInteger;
  var I32 = Int32Array, U8 = Uint8Array, F64 = Float64Array;

  var N = 8;
  var FOLDS = [1, 2, 3, 4, 5];
  var TYPES = ['half', 'corner', 'diagonal', 'mixed'];
  var PUNCHES = [1, 2, 3];
  var IDLE = [0, 1, 2];
  var HMAX = 16;
  var KINDS = ['v', 'h', 'd', 'a'];
  var AXES = ['v', 'h', 'd', 'a'];
  var NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  var EPS = 1e-9;

  function nOpt(params) { return FOLDS[params.folds] >= 4 ? 5 : 4; }
  function idleOf(params) { return Math.min(IDLE[params.idle], FOLDS[params.folds] - 1); }
  function typeOf(params) { return TYPES[params.type]; }
  // The type a fold count can carry: one fold cannot mix, so "mixed" with one fold is a D fold.
  function typeIndexEff(params) { return FOLDS[params.folds] === 1 && params.type === 3 ? 2 : params.type; }

  /* ---------- lines and reflections ---------- */

  function side(L, x, y) {
    var c = L.c;
    switch (L.k) {
      case 'v': return x - c;
      case 'h': return y - c;
      case 'd': return x - y - c;
      default: return x + y - c;
    }
  }
  function grad(k) { return k === 'v' ? [1, 0] : k === 'h' ? [0, 1] : k === 'd' ? [1, -1] : [1, 1]; }
  function reflPt(L, p) {
    var c = L.c, x = p[0], y = p[1];
    switch (L.k) {
      case 'v': return [2 * c - x, y];
      case 'h': return [x, 2 * c - y];
      case 'd': return [y + c, x - c];
      default: return [c - y, c - x];
    }
  }
  // The cell [i, j] (centre i + ½, j + ½) reflected across L.
  function reflCell(L, i, j) {
    var c = L.c;
    switch (L.k) {
      case 'v': return [2 * c - 1 - i, j];
      case 'h': return [i, 2 * c - 1 - j];
      case 'd': return [j + c, i - c];
      default: return [c - j - 1, c - i - 1];
    }
  }
  // Affine maps p → m·p + t (m a signed permutation matrix: isometries of the grid).
  var ID = { m: [1, 0, 0, 1], t: [0, 0] };
  function reflMap(L) {
    var c = L.c;
    switch (L.k) {
      case 'v': return { m: [-1, 0, 0, 1], t: [2 * c, 0] };
      case 'h': return { m: [1, 0, 0, -1], t: [0, 2 * c] };
      case 'd': return { m: [0, 1, 1, 0], t: [c, -c] };
      default: return { m: [0, -1, -1, 0], t: [c, c] };
    }
  }
  function mapPt(T, p) {
    var m = T.m;
    return [m[0] * p[0] + m[1] * p[1] + T.t[0], m[2] * p[0] + m[3] * p[1] + T.t[1]];
  }
  function compose(A, B) { // A after B
    var a = A.m, b = B.m;
    return {
      m: [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]],
      t: [a[0] * B.t[0] + a[1] * B.t[1] + A.t[0], a[2] * B.t[0] + a[3] * B.t[1] + A.t[1]],
    };
  }
  function invert(T) {
    var m = T.m, mi = [m[0], m[2], m[1], m[3]]; // orthogonal: the inverse is the transpose
    return { m: mi, t: [-(mi[0] * T.t[0] + mi[1] * T.t[1]), -(mi[2] * T.t[0] + mi[3] * T.t[1])] };
  }
  function det(T) { return T.m[0] * T.m[3] - T.m[1] * T.m[2]; }

  // Mirror of a cell across a symmetry axis of the sheet.
  function mirrorCell(ax, i, j) {
    switch (ax) {
      case 'v': return [N - 1 - i, j];
      case 'h': return [i, N - 1 - j];
      case 'd': return [j, i];
      default: return [N - 1 - j, N - 1 - i];
    }
  }

  /* ---------- convex polygons (vertices are multiples of ½) ---------- */

  function snap(v) { return round(v * 2) / 2; }
  function samePt(p, q) { return p[0] === q[0] && p[1] === q[1]; }
  function pushPt(arr, p) { if (!arr.length || !samePt(arr[arr.length - 1], p)) arr.push(p); }
  function area(P) {
    var s = 0;
    for (var i = 0, n = P.length; i < n; i++) {
      var p = P[i], q = P[(i + 1) % n];
      s += p[0] * q[1] - q[0] * p[1];
    }
    return abs(s) / 2;
  }
  // The part of P where sgn × side(L) ≥ 0, or null when it has no area.
  function clip(P, L, sgn) {
    var out = [], n = P.length;
    for (var i = 0; i < n; i++) {
      var p = P[i], q = P[(i + 1) % n];
      var sp = sgn * side(L, p[0], p[1]), sq = sgn * side(L, q[0], q[1]);
      if (sp >= 0) pushPt(out, p);
      if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
        var t = sp / (sp - sq);
        pushPt(out, [snap(p[0] + t * (q[0] - p[0])), snap(p[1] + t * (q[1] - p[1]))]);
      }
    }
    if (out.length > 1 && samePt(out[0], out[out.length - 1])) out.pop();
    return out.length >= 3 && area(out) > EPS ? out : null;
  }
  // Inside or on the boundary of a convex polygon.
  function inside(P, x, y) {
    var pos = false, neg = false;
    for (var i = 0, n = P.length; i < n; i++) {
      var p = P[i], q = P[(i + 1) % n];
      var cr = (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
      if (cr > EPS) pos = true; else if (cr < -EPS) neg = true;
      if (pos && neg) return false;
    }
    return true;
  }
  // Strictly inside: on the same side of every edge of non-zero length.
  function strictlyInside(P, x, y) {
    var sgn = 0;
    for (var i = 0, n = P.length; i < n; i++) {
      var p = P[i], q = P[(i + 1) % n];
      if (samePt(p, q)) continue;
      var cr = (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
      if (abs(cr) <= EPS) return false;
      var s = cr > 0 ? 1 : -1;
      if (sgn && s !== sgn) return false;
      sgn = s;
    }
    return true;
  }
  function bbox(P) {
    var b = [INF, INF, -INF, -INF];
    P.forEach(function (p) {
      if (p[0] < b[0]) b[0] = p[0];
      if (p[1] < b[1]) b[1] = p[1];
      if (p[0] > b[2]) b[2] = p[0];
      if (p[1] > b[3]) b[3] = p[1];
    });
    return b;
  }
  function centreOf(P) { var b = bbox(P); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; }
  // The crease: the vertices of the clipped part that lie on the line (its two ends).
  function crease(part, L) {
    var on = part.filter(function (p) { return side(L, p[0], p[1]) === 0; });
    if (on.length < 2) return null;
    var best = null, bd = -1;
    for (var a = 0; a < on.length; a++) {
      for (var b = a + 1; b < on.length; b++) {
        var d = abs(on[a][0] - on[b][0]) + abs(on[a][1] - on[b][1]);
        if (d > bd) { bd = d; best = [on[a].slice(), on[b].slice()]; }
      }
    }
    return best;
  }
  function square(n) { return [[0, 0], [n, 0], [n, n], [0, n]]; }

  /* ---------- cells, keys and bit masks ---------- */

  // Cell keys allow cells off the sheet (foils may reflect holes off it before filtering).
  function ckey(i, j) { return (i + 64) * 256 + (j + 64); }
  function onSheet(c) { return c[0] >= 0 && c[0] < N && c[1] >= 0 && c[1] < N; }
  function popcount(x) {
    x = x - ((x >>> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
  }
  // A hole set on the sheet as two 32-bit words (bit j·N + i), or null when a cell is off it.
  function maskOf(cells) {
    var lo = 0, hi = 0;
    for (var k = 0; k < cells.length; k++) {
      var c = cells[k];
      if (!onSheet(c)) return null;
      var b = c[1] * N + c[0];
      if (b < 32) lo |= 1 << b; else hi |= 1 << (b - 32);
    }
    return [lo >>> 0, hi >>> 0];
  }
  function maskKey(m) { return m[0] + ':' + m[1]; }
  function hamming(a, b) { return popcount((a[0] ^ b[0]) >>> 0) + popcount((a[1] ^ b[1]) >>> 0); }
  function sortCells(cells) {
    return cells.map(function (c) { return [c[0], c[1]]; }).sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
  }
  function hasCell(cells, c) {
    for (var k = 0; k < cells.length; k++) if (cells[k][0] === c[0] && cells[k][1] === c[1]) return true;
    return false;
  }
  // symScore for a mask, without building cell lists.
  function symMask(m, L) {
    var n = 0, tot = 0;
    for (var b = 0; b < N * N; b++) {
      if (!(b < 32 ? (m[0] >>> b) & 1 : (m[1] >>> (b - 32)) & 1)) continue;
      tot++;
      var rc = reflCell(L, b % N, floor(b / N));
      if (!onSheet(rc)) continue;
      var b2 = rc[1] * N + rc[0];
      if (b2 < 32 ? (m[0] >>> b2) & 1 : (m[1] >>> (b2 - 32)) & 1) n++;
    }
    return tot ? n / tot : 0;
  }
  // Fraction of the holes whose mirror across L is also a hole (mask: the set as maskOf gives).
  function symScore(cells, L, mask) {
    if (!cells.length) return 0;
    var m = mask || maskOf(cells), n = 0;
    for (var q = 0; q < cells.length; q++) {
      var rc = reflCell(L, cells[q][0], cells[q][1]);
      if (!onSheet(rc)) continue;
      var b = rc[1] * N + rc[0];
      if (b < 32 ? (m[0] >>> b) & 1 : (m[1] >>> (b - 32)) & 1) n++;
    }
    return n / cells.length;
  }

  /* ---------- generator model: the convex outline and every cell's centre ---------- */

  // Integer in [0, n) and a shuffled copy, from rng.next() (exact for small n; no global lookups).
  function rint(r, n) { return floor(r.next() * n); }
  function shuffle(r, arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) { var j = floor(r.next() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }

  function pickW(r, weights) {
    var sum = 0, i;
    for (i = 0; i < weights.length; i++) sum += weights[i];
    var x = r.next() * sum;
    for (i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
    return weights.length - 1;
  }

  // Every legal fold of the outline O for the allowed classes ({ H, C, D }). The flap fits
  // when its mirror image lies inside O (the image is on the stationary side by construction);
  // since the crease points map to themselves, only O's vertices on the moving side need the
  // test. Areas come from the clipped outline's shoelace sum, without building it.
  var SV = new F64(64);
  function candidates(O, allowed, centreW, smallFlaps, first) {
    var cc = centreOf(O), cx = cc[0], cy = cc[1], out = [], aO = area(O), n = O.length;
    for (var ki = 0; ki < 4; ki++) {
      var k = KINDS[ki], straight = ki < 2;
      if (straight ? !allowed.H : !(allowed.D || allowed.C)) continue;
      var L0 = { k: k, c: 0 }, lo = INF, hi = -INF, v;
      for (v = 0; v < n; v++) { var s0 = side(L0, O[v][0], O[v][1]); if (s0 < lo) lo = s0; if (s0 > hi) hi = s0; }
      for (var c = ceil(lo + EPS); c < hi - EPS; c++) {
        var L = { k: k, c: c }, sc = side(L, cx, cy);
        for (v = 0; v < n; v++) SV[v] = side(L, O[v][0], O[v][1]);
        for (var s = 0; s < 2; s++) {
          var m = s ? -1 : 1, cls;
          if (straight) cls = 'H';
          else if (sc === 0) cls = 'D';
          else if (m * sc < 0) cls = 'C';
          else continue;
          if (!allowed[cls]) continue;
          var am = clipArea(O, n, m);
          if (am < 2 - EPS || am > aO / 2 + EPS) continue;
          var fits = true;
          for (v = 0; v < n && fits; v++) {
            if (m * SV[v] <= 0) continue;
            var rp = reflPt(L, O[v]);
            fits = inside(O, rp[0], rp[1]);
          }
          if (!fits) continue;
          // Many folds: favour smaller flaps, so layers stay countable and some flaps can miss a
          // punch. A first fold over the whole shape always matters (every layer lies under its
          // flap): favoured when every fold must matter, avoided when some must not.
          var keep = 1 - am / aO, w = (straight && sc === 0 ? centreW : 1) * (smallFlaps ? keep * keep : 1);
          if (first && abs(am - aO / 2) < EPS) w *= first;
          out.push({ line: L, move: m, cls: cls, w: w, mov: null });
        }
      }
    }
    return out;
  }
  // Area of the part of O where sgn × side ≥ 0, from the side values in SV.
  function clipArea(P, n, sgn) {
    var sum = 0, fx = 0, fy = 0, px = 0, py = 0, started = false;
    function emit(x, y) {
      if (!started) { fx = x; fy = y; started = true; } else sum += px * y - x * py;
      px = x; py = y;
    }
    for (var i = 0; i < n; i++) {
      var p = P[i], q = P[(i + 1) % n], sp = sgn * SV[i], sq = sgn * SV[(i + 1) % n];
      if (sp >= 0) emit(p[0], p[1]);
      if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
        var t = sp / (sp - sq);
        emit(snap(p[0] + t * (q[0] - p[0])), snap(p[1] + t * (q[1] - p[1])));
      }
    }
    if (!started) return 0;
    sum += px * fy - fx * py;
    return abs(sum) / 2;
  }

  function allowedFor(type, F) {
    switch (type) {
      case 'half': return { H: 1 };
      case 'corner': return { H: 1, C: 1 };
      case 'diagonal': return { D: 1, C: 1 };
      default: return F === 1 ? { D: 1 } : { H: 1, D: 1, C: 1 };
    }
  }
  function requiredFor(type, F) {
    switch (type) {
      case 'half': return [];
      case 'corner': return ['C'];
      case 'diagonal': return ['D'];
      default: return F === 1 ? ['D'] : ['D', 'H'];
    }
  }
  function typeMatches(type, classes) {
    var F = classes.length, has = { H: 0, C: 0, D: 0 };
    classes.forEach(function (c) { has[c]++; });
    switch (type) {
      case 'half': return has.H === F;
      case 'corner': return has.C >= 1 && has.D === 0;
      case 'diagonal': return has.D >= 1 && has.H === 0;
      default: return F === 1 ? has.D === 1 : has.D >= 1 && has.H >= 1;
    }
  }

  // Cells are indexed c = j·N + i; x, y hold the current centre of each original cell.
  function newState() {
    var n = N * N, st = { x: new F64(n), y: new F64(n), mask: new I32(n), creased: new U8(n), inCell: new U8(n), outline: square(N), hist: [], folds: [] };
    for (var c = 0; c < n; c++) { st.x[c] = (c % N) + 0.5; st.y[c] = floor(c / N) + 0.5; st.inCell[c] = 1; }
    return st;
  }
  function snapshot(st) { return { x: st.x.slice(), y: st.y.slice() }; }
  function applyFold(st, f, k) {
    foldArrays(st.x, st.y, st.mask, st.creased, st.inCell, f, k);
    st.outline = f.sta;
  }
  function foldArrays(xs, ys, mask, creased, inCell, f, k) {
    var L = f.line, m = f.move, c;
    var kind = L.k, lc = L.c;
    for (c = 0; c < N * N; c++) {
      var x = xs[c], y = ys[c], s = m * (kind === 'v' ? x - lc : kind === 'h' ? y - lc : kind === 'd' ? x - y - lc : x + y - lc);
      if (s > 0) {
        if (kind === 'v') xs[c] = 2 * lc - x;
        else if (kind === 'h') ys[c] = 2 * lc - y;
        else if (kind === 'd') { xs[c] = y + lc; ys[c] = x - lc; }
        else { xs[c] = lc - y; ys[c] = lc - x; }
        mask[c] |= 1 << k;
      } else if (s === 0) creased[c] = 1; // the crease runs through this cell's centre
    }
    // Plane cell [i, j] stays wholly on the paper when its farthest corner is not on the moving side.
    var g = grad(L.k), ex = (m * g[0] > 0 ? m * g[0] : 0) + (m * g[1] > 0 ? m * g[1] : 0);
    for (c = 0; c < N * N; c++) {
      if (inCell[c] && m * side(L, c % N, floor(c / N)) + ex > 0) inCell[c] = 0;
    }
  }

  // Scratch buffers for trying a fold without allocating (single-threaded, never re-entered).
  var SX = new F64(N * N), SY = new F64(N * N), SM = new I32(N * N), SC = new U8(N * N), SI = new U8(N * N);
  var PCNT = new I32(N * N), PMSK = new I32(N * N), PBAD = new U8(N * N), VM = new I32(N * N), VN = new I32(N * N), VUSE = new U8(N * N);

  // Would fold f (as fold k) keep the item possible? Its flap must be punchable somewhere, and
  // P punches within HMAX holes must still be able to make at least `need` folds matter
  // (greedy: each punch adds the most new folds, fewest layers first).
  function foldKeepsFeasible(st, f, k, P, need) {
    SX.set(st.x); SY.set(st.y); SM.set(st.mask); SC.set(st.creased); SI.set(st.inCell);
    foldArrays(SX, SY, SM, SC, SI, f, k);
    PCNT.fill(0); PMSK.fill(0); PBAD.fill(0);
    var c, nv = 0, bits = 0;
    for (c = 0; c < N * N; c++) {
      var pos = (SY[c] - 0.5) * N + SX[c] - 0.5;
      PCNT[pos]++; PMSK[pos] |= SM[c];
      if (SC[c]) PBAD[pos] = 1;
    }
    for (c = 0; c < N * N; c++) {
      if (SI[c] && PCNT[c] && !PBAD[c]) { VM[nv] = PMSK[c]; VN[nv] = PCNT[c]; VUSE[nv] = 0; nv++; bits |= PMSK[c]; }
    }
    if (!(bits & (1 << k))) return false;
    var covered = 0, used = 0;
    for (var q = 0; q < P; q++) {
      var best = -1, bestGain = -1, bestN = INF;
      for (var i = 0; i < nv; i++) {
        if (VUSE[i] || used + VN[i] > HMAX) continue;
        var gain = popcount(VM[i] & ~covered);
        if (gain > bestGain || (gain === bestGain && VN[i] < bestN)) { best = i; bestGain = gain; bestN = VN[i]; }
      }
      if (best < 0) return false;
      VUSE[best] = 1; covered |= VM[best]; used += VN[best];
    }
    return popcount(covered) >= need;
  }

  function cloneState(st) {
    return { x: st.x.slice(), y: st.y.slice(), mask: st.mask.slice(), creased: st.creased.slice(), inCell: st.inCell.slice(), outline: st.outline, hist: st.hist.slice(), folds: st.folds.slice() };
  }

  // Folds one by one, depth first with backtracking (at most 150 folds tried per item). A fold
  // is kept only if its flap can be punched right after it (some cell of the flap is wholly on
  // the paper with no creased layer: a fold that could never matter is not worth showing) and
  // P punches within the hole limit could still make enough folds matter.
  function chooseFolds(r, F, type, idle, P) {
    var st = newState();
    st.hist.push(snapshot(st));
    var g = { r: r, F: F, P: P, idle: idle, allowed: allowedFor(type, F), req: requiredFor(type, F), centreW: idle > 0 ? 1 : 3, budget: 150 };
    return foldStep(g, st, 0, {});
  }

  function foldStep(g, st, k, used) {
    if (k === g.F) return st;
    var cands = candidates(st.outline, g.allowed, g.centreW, g.F >= 4, k === 0 ? (g.idle ? 0.3 : 6) : 0);
    var missing = g.req.filter(function (c) { return !used[c]; });
    var byCls = {}, classes = [];
    cands.forEach(function (c) {
      if (!byCls[c.cls]) { byCls[c.cls] = []; classes.push(c.cls); }
      byCls[c.cls].push(c);
    });
    if (missing.length >= g.F - k) classes = classes.filter(function (c) { return missing.indexOf(c) >= 0; });
    while (classes.length && g.budget > 0) { // weighted draws without replacement
      g.budget--;
      // A missing class is likelier; a missing D first, while the shape is still square.
      var ci = pickW(g.r, classes.map(function (c) { return missing.indexOf(c) < 0 ? 1 : c === 'D' ? 16 : 4; }));
      var list = byCls[classes[ci]], fi = pickW(g.r, list.map(function (c) { return c.w; })), f = list[fi];
      list.splice(fi, 1);
      if (!list.length) classes.splice(ci, 1);
      f.mov = clip(st.outline, f.line, f.move);
      f.sta = clip(st.outline, f.line, -f.move);
      if (!foldKeepsFeasible(st, f, k, g.P, k + 1 - g.idle)) continue;
      var ns = cloneState(st);
      applyFold(ns, f, k);
      f.prev = st.outline;
      f.seg = crease(f.mov, f.line);
      ns.folds.push(f);
      ns.hist.push(snapshot(ns));
      var u2 = {};
      for (var key in used) u2[key] = used[key];
      u2[f.cls] = true;
      var res = foldStep(g, ns, k + 1, u2);
      if (res) return res;
    }
    return null;
  }

  // Cells of the folded state that may be punched: wholly on the paper, no layer creased.
  function punchCells(st) {
    var byPos = [], out = [];
    for (var c = 0; c < N * N; c++) {
      var kk = (st.y[c] - 0.5) * N + st.x[c] - 0.5; // the paper never leaves the sheet
      (byPos[kk] = byPos[kk] || []).push(c);
    }
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        if (!st.inCell[j * N + i]) continue;
        var layers = byPos[j * N + i];
        if (!layers) continue;
        var ok = true, mask = 0;
        for (var q = 0; q < layers.length; q++) {
          if (st.creased[layers[q]]) ok = false;
          mask |= st.mask[layers[q]];
        }
        if (ok) out.push({ cell: [i, j], layers: layers, mask: mask, n: layers.length });
      }
    }
    return out;
  }

  // P punches whose layers make exactly `mt` folds matter, with at most `cap` holes in all:
  // a uniform pick among all such sets (first under the soft cap, then under HMAX).
  function choosePunches(r, valid, P, mt, soft) {
    if (valid.length < P) return null;
    var order = shuffle(r, valid), caps = soft < HMAX ? [soft, HMAX] : [HMAX], combos = null;
    if (choose(order.length, P) <= 4000) combos = allCombos(order.length, P);
    for (var pass = 0; pass < caps.length; pass++) {
      var good = [], tries = combos ? combos.length : 1500;
      for (var t = 0; t < tries; t++) {
        var idx = combos ? combos[t] : sampleIdx(r, order.length, P), m = 0, n = 0;
        for (var q = 0; q < P; q++) { m |= order[idx[q]].mask; n += order[idx[q]].n; }
        if (popcount(m) === mt && n <= caps[pass]) good.push(idx);
      }
      if (good.length) return good[rint(r, good.length)].map(function (i) { return order[i]; });
    }
    return null;
  }
  function sampleIdx(r, n, k) {
    var idx = [];
    while (idx.length < k) { var i = rint(r, n); if (idx.indexOf(i) < 0) idx.push(i); }
    return idx;
  }

  /* ---------- unfolding and foils from neighbouring problems ---------- */

  // Unfold hole cells, applying the folds in `order` (normally last fold first):
  // H ← H ∪ R_k(H ∩ flap_k). For a partial fold, flap_k is the set of cells where fold k's flap
  // lies right after fold k (img, a U8 per sheet cell); for a fold whose flap covers the whole
  // folded shape (full) it is every hole on the stationary side of the fold line, which is how
  // a solver unfolds it even when an earlier mistake put a hole off the paper. alt: { k: line }
  // replaces the reflection of fold k (a wrong-line error). Stops early (null) once more than
  // `limit` holes appear.
  function unfoldCells(start, steps, order, limit, alt) {
    var cur = start.map(function (c) { return [c[0], c[1]]; });
    for (var o = 0; o < order.length; o++) {
      var k = order[o], s = steps[k], R = alt && alt[k] ? alt[k] : s.L, n0 = cur.length;
      for (var q = 0; q < n0; q++) {
        var h = cur[q];
        if (s.full ? s.move * side(s.L, h[0] + 0.5, h[1] + 0.5) >= 0 : !onSheet(h) || !s.img[h[1] * N + h[0]]) continue;
        var rc = reflCell(R, h[0], h[1]);
        if (!hasCell(cur, rc)) {
          cur.push(rc);
          if (limit && cur.length > limit) return null;
        }
      }
    }
    return cur;
  }

  // The same unfolding on integer-encoded cells ((i + 64)·256 + j + 64), straight to a hole mask:
  // null when a hole leaves the sheet, two holes coincide or more than `limit` appear.
  var UB = new I32(64);
  function unfoldMask(start, steps, order, limit, alt) {
    var n = 0, q, i, j;
    for (q = 0; q < start.length; q++) UB[n++] = (start[q][0] + 64) * 256 + start[q][1] + 64;
    for (var o = 0; o < order.length; o++) {
      var k = order[o], s = steps[k], R = alt && alt[k] ? alt[k] : s.L, n0 = n, rk = R.k, rc = R.c, sk = s.L.k, sc = s.L.c;
      for (q = 0; q < n0; q++) {
        i = (UB[q] >> 8) - 64; j = (UB[q] & 255) - 64;
        if (s.full) {
          var x = i + 0.5, y = j + 0.5, sd = sk === 'v' ? x - sc : sk === 'h' ? y - sc : sk === 'd' ? x - y - sc : x + y - sc;
          if (s.move * sd >= 0) continue;
        } else if (i < 0 || j < 0 || i >= N || j >= N || !s.img[j * N + i]) continue;
        var ni, nj;
        if (rk === 'v') { ni = 2 * rc - 1 - i; nj = j; }
        else if (rk === 'h') { ni = i; nj = 2 * rc - 1 - j; }
        else if (rk === 'd') { ni = j + rc; nj = i - rc; }
        else { ni = rc - j - 1; nj = rc - i - 1; }
        if (ni < -64 || nj < -64 || ni > 190 || nj > 190) return null;
        var e = (ni + 64) * 256 + nj + 64, dup = false;
        for (var w = 0; w < n && !dup; w++) dup = UB[w] === e;
        if (dup) continue;
        if (n >= limit || n >= 63) return null;
        UB[n++] = e;
      }
    }
    var lo = 0, hi = 0;
    for (q = 0; q < n; q++) {
      i = (UB[q] >> 8) - 64; j = (UB[q] & 255) - 64;
      if (i < 0 || j < 0 || i >= N || j >= N) return null;
      var b = j * N + i;
      if (b < 32) lo |= 1 << b; else hi |= 1 << (b - 32);
    }
    return n === limit ? [lo >>> 0, hi >>> 0] : null;
  }

  // Wrong lines for one unfolding step: parallel lines one to three cells away, and lines of
  // the three other kinds (perpendicular, diagonal) through the crease's midpoint and through
  // the centre of the shape that was folded.
  function altLines(f) {
    var L = f.line, out = [], seen = {};
    function add(k, c) {
      if (k === L.k && c === L.c) return;
      if (seen[k + c]) return;
      seen[k + c] = true;
      out.push({ k: k, c: c });
    }
    [-1, 1, -2, 2, -3, 3].forEach(function (d) { add(L.k, L.c + d); });
    var pts = [centreOf(f.prev)];
    if (f.seg) pts.push([(f.seg[0][0] + f.seg[1][0]) / 2, (f.seg[0][1] + f.seg[1][1]) / 2]);
    KINDS.forEach(function (k) {
      if (k === L.k) return;
      pts.forEach(function (pt) {
        var v = side({ k: k, c: 0 }, pt[0], pt[1]);
        add(k, floor(v));
        add(k, ceil(v));
      });
    });
    return out;
  }

  function mirrorCells(cells, ax) { return cells.map(function (c) { return mirrorCell(ax, c[0], c[1]); }); }

  // Each punch unfolds on its own (holes of different punches never meet), so a foil picks, for
  // every punch, either its true holes or one of its wrong unfoldings: one fold or two folds
  // unfolded across other lines, or two folds unfolded in the wrong order. Consistent foils
  // make the same mistake for every punch; mixed foils make it for some punches only, which
  // puts foils near each other and keeps the key from being the option most like the others.
  // Rationed extras (they lack a hole under a punch): a punch one cell away, mirrors.
  function foilPool(ctx) {
    var F = ctx.folds.length, order = [], lim = ctx.key.length, alts = [], k, k2;
    for (k = F - 1; k >= 0; k--) order.push(k);
    for (k = 0; k < F; k++) alts.push(altLines(ctx.folds[k]));
    // Mistakes, as unfolding variants shared by every punch.
    var mistakes = [];
    for (k = 0; k < F; k++) {
      alts[k].forEach(function (L2) {
        var alt = {};
        alt[k] = L2;
        mistakes.push({ alt: alt, order: order, why: 'fold ' + (k + 1) + ' unfolded across another line' });
      });
    }
    for (k = 0; k < F; k++) {
      for (k2 = k + 1; k2 < F; k2++) {
        var a1 = shuffle(ctx.r, alts[k]).slice(0, 2), a2 = shuffle(ctx.r, alts[k2]).slice(0, 2);
        a1.forEach(function (L1) {
          a2.forEach(function (L2) {
            var alt = {};
            alt[k] = L1; alt[k2] = L2;
            mistakes.push({ alt: alt, order: order, why: 'folds ' + (k + 1) + ' and ' + (k2 + 1) + ' unfolded across other lines' });
          });
        });
      }
    }
    for (k = 0; k + 1 < F; k++) {
      var o2 = order.slice(), ia = o2.indexOf(k), ib = o2.indexOf(k + 1);
      o2[ia] = k + 1; o2[ib] = k;
      mistakes.push({ alt: null, order: o2, why: 'folds ' + (k + 1) + ' and ' + (k + 2) + ' unfolded in the wrong order' });
    }
    // Per punch: its true holes and, for each mistake, its holes under that mistake (same count),
    // as bit masks; a foil is the union of one choice per punch (disjoint by construction check).
    var P = ctx.punches.length, size = lim;
    var truthCells = ctx.punches.map(function (p) { return unfoldCells([p], ctx.steps, order); });
    var tsz = truthCells.map(function (c) { return c.length; });
    var truth = truthCells.map(function (c) { return maskOf(c); });
    var vars = ctx.punches.map(function (p, pi) {
      return mistakes.map(function (mk) { return unfoldMask([p], ctx.steps, mk.order, tsz[pi], mk.alt); });
    });
    var pool = [], seen = {};
    seen[maskKey(ctx.keyMask)] = true;
    function add(m, why) {
      if (!m || popcount(m[0]) + popcount(m[1]) !== size) return;
      var kk = maskKey(m);
      if (seen[kk]) return;
      seen[kk] = true;
      pool.push({ mask: m, why: why });
    }
    function whyOf(choice) {
      var why = [];
      for (var pi = 0; pi < P; pi++) if (choice[pi] >= 0) why.push(P > 1 ? 'punch ' + (pi + 1) + ': ' + mistakes[choice[pi]].why : mistakes[choice[pi]].why);
      return why.join('; ');
    }
    function combine(choice) { // choice[pi]: mistake index or −1 (true holes)
      var lo = 0, hi = 0;
      for (var pi = 0; pi < P; pi++) {
        var m = choice[pi] < 0 ? truth[pi] : vars[pi][choice[pi]];
        if (!m) return;
        lo |= m[0]; hi |= m[1];
      }
      add([lo >>> 0, hi >>> 0], choice); // repeated cells show up as a smaller count
    }
    var mi, pi2;
    for (mi = 0; mi < mistakes.length; mi++) {
      var all = [];
      for (pi2 = 0; pi2 < P; pi2++) all.push(mi);
      combine(all); // the same mistake for every punch
      if (P > 1) {
        for (pi2 = 0; pi2 < P; pi2++) { // the mistake for one punch only
          var one = [];
          for (var q = 0; q < P; q++) one.push(q === pi2 ? mi : -1);
          combine(one);
        }
      }
    }
    for (var s2 = 0; P > 1 && s2 < 40; s2++) { // random mixes of different mistakes
      var mix = [];
      for (pi2 = 0; pi2 < P; pi2++) mix.push(rint(ctx.r, mistakes.length + 1) - 1);
      combine(mix);
    }
    var nFirst = pool.length;
    ctx.punches.forEach(function (p, pi) {
      NB8.forEach(function (d) {
        var q2 = [p[0] + d[0], p[1] + d[1]];
        if (hasCell(ctx.punches, q2)) return;
        var lay = ctx.layersAt(q2);
        if (!lay.length) return;
        var cells = lay.slice();
        ctx.punches.forEach(function (p2, pj) { if (pj !== pi) cells = cells.concat(ctx.layersAt(p2)); });
        if (cells.length === size) add(maskOf(cells), 'punch ' + (pi + 1) + ' one cell away');
      });
    });
    ctx.whyOf = whyOf;
    var some = shuffle(ctx.r, pool.slice(0, nFirst)).slice(0, 12);
    AXES.forEach(function (ax) {
      add(maskOf(mirrorCells(ctx.key, ax)), 'the answer mirrored');
      some.forEach(function (f) { add(maskOf(mirrorCells(maskCells(f.mask), ax)), { mirrorOf: f.why }); });
    });
    return pool;
  }
  // The cells of a mask, in reading order.
  function maskCells(m) {
    var out = [];
    for (var b = 0; b < N * N; b++) if (b < 32 ? (m[0] >>> b) & 1 : (m[1] >>> (b - 32)) & 1) out.push([b % N, floor(b / N)]);
    return out;
  }

  function choose(n, k) { var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return round(r); }
  function allCombos(n, k) {
    var out = [], cur = [];
    (function rec(start) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (var i = start; i <= n - (k - cur.length); i++) { cur.push(i); rec(i + 1); cur.pop(); }
    })(0);
    return out;
  }
  function rankCost(target, lo, hi) { return target < lo ? lo - target : target > hi ? target - hi : 0; }

  // Picks nf foils against three shortcuts. (1) "Most symmetric about the first fold line": the
  // foils split into more, equally and less symmetric than the key. A fully symmetric key gets
  // as many equally symmetric foils as the pool allows (the shortcut then cannot choose);
  // otherwise a random target rank ts is filled with more symmetric foils, then with equally
  // symmetric ones (ties widen the key's range of ranks). (2) "Most like the others" / "odd
  // one out": the key's rank on total Hamming distance to the other options matches a random
  // target tc (a target inside the key's tie range costs 0). (3) The key always has a hole
  // right under each punch (the bottom layer there never moves), so foils lacking one are
  // rationed by the number of folds that matter (mt): with one, one or two (there the foils
  // symmetric about that fold line are exactly the ones that lack a hole), with 2–3 at most one
  // in half the items, with more at most one in a quarter.
  function selectFoils(r, keyCells, keyMask, pool, nf, line1, relaxed, punchMask, mt) {
    if (pool.length < nf) return null;
    var n = nf + 1, tc = rint(r, n), ts = rint(r, n), keySym = symScore(keyCells, line1, keyMask);
    var maxLack = relaxed ? 1 : mt === 1 ? 1 + rint(r, 2) : mt <= 3 ? rint(r, 2) : rint(r, 4) === 0 ? 1 : 0, full = keySym > 1 - EPS;
    var G = { up: [[], []], tie: [[], []], down: [[], []] }; // [no lack, lack]
    pool.forEach(function (f) {
      f.sym = symMask(f.mask, line1);
      f.dk = hamming(f.mask, keyMask);
      f.lack = (f.mask[0] & punchMask[0]) !== punchMask[0] || (f.mask[1] & punchMask[1]) !== punchMask[1];
      var g = f.sym > keySym + EPS ? G.up : abs(f.sym - keySym) <= EPS ? G.tie : G.down;
      g[f.lack ? 1 : 0].push(f);
    });
    var best = null, bestCost = INF;
    var rest = { 0: G.tie[0].concat(G.down[0]), 1: G.tie[1].concat(G.down[1]) };
    for (var t = 0; t < 150 && bestCost > 0; t++) {
      // Odd tries cluster the foils around the first one (so the key can be the odd one out).
      var budget = { lack: maxLack, cluster: t & 1 }, opt = [];
      if (full) take(r, G.tie, nf, budget, opt);
      else {
        take(r, G.up, ts, budget, opt);
        take(r, G.tie, ts - opt.length, budget, opt);
      }
      take(r, rest, nf - opt.length, budget, opt);
      if (opt.length < nf) take(r, G.up, nf - opt.length, budget, opt);
      if (opt.length < nf) continue;
      if (relaxed) return opt;
      var tot = [0], q, w;
      for (q = 0; q < nf; q++) { tot[0] += opt[q].dk; tot.push(opt[q].dk); }
      for (q = 0; q < nf; q++) for (w = q + 1; w < nf; w++) { var d = hamming(opt[q].mask, opt[w].mask); tot[q + 1] += d; tot[w + 1] += d; }
      var below = 0, tie = 0, sAbove = 0, sTie = 0;
      for (q = 1; q <= nf; q++) {
        if (tot[q] < tot[0]) below++; else if (tot[q] === tot[0]) tie++;
        if (opt[q - 1].sym > keySym + EPS) sAbove++; else if (abs(opt[q - 1].sym - keySym) <= EPS) sTie++;
      }
      var symCost = full ? nf - sTie : rankCost(ts, sAbove, sAbove + sTie);
      var cost = rankCost(tc, below, below + tie) + symCost;
      if (cost < bestCost) { bestCost = cost; best = opt; }
    }
    return best;
  }
  // Adds up to k foils from group g ([no lack, lack]) to out: random ones without a lacking
  // punch hole first, then lacking ones within budget.lack. No foil is taken twice.
  function take(r, g, k, budget, out) {
    for (var side2 = 0; side2 < 2 && k > 0; side2++) {
      var list = g[side2], tries = 0;
      if (!list.length) continue;
      while (k > 0 && tries++ < 64) {
        if (side2 === 1 && budget.lack <= 0) break;
        var f = list[rint(r, list.length)];
        if (out.indexOf(f) >= 0) continue;
        if (budget.cluster && out.length) { // the nearest to out[0] of a few random candidates
          for (var c = 0; c < 11; c++) {
            var f2 = list[rint(r, list.length)];
            if (out.indexOf(f2) < 0 && hamming(f2.mask, out[0].mask) < hamming(f.mask, out[0].mask)) f = f2;
          }
        }
        out.push(f); k--;
        if (side2 === 1) budget.lack--;
      }
    }
  }

  /* ---------- show-me states: faces (paper pieces that moved together) ---------- */

  function stateOut(faces, outline, keyCells, L) {
    var seen = {}, all = [];
    var out = faces.slice().sort(function (a, b) { return a.layer - b.layer; }).map(function (fc) {
      var poly = fc.src.map(function (p) { return mapPt(fc.T, p); }), holes = [];
      keyCells.forEach(function (c) {
        var cx = c[0] + 0.5, cy = c[1] + 0.5;
        if (!strictlyInside(fc.src, cx, cy)) return;
        var q = mapPt(fc.T, [cx, cy]), cell = [q[0] - 0.5, q[1] - 0.5];
        holes.push(cell);
        var kk = ckey(cell[0], cell[1]);
        if (!seen[kk]) { seen[kk] = true; all.push(cell); }
      });
      var o = { poly: poly, layer: fc.layer, back: det(fc.T) < 0, moved: !!fc.moved, holes: sortCells(holes) };
      if (fc.moved && L) o.from = poly.map(function (p) { return reflPt(L, p); });
      return o;
    });
    return { outline: outline.map(function (p) { return p.slice(); }), holes: sortCells(all), faces: out };
  }

  // Every fold puts the flap on top: moved faces get layers above all others, in reverse order.
  function buildSteps(folds, keyCells) {
    var faces = [{ src: square(N), T: ID, layer: 0, moved: false }], states = [];
    states.push(stateOut(faces, square(N), keyCells, null));
    folds.forEach(function (f) {
      var L = f.line, m = f.move, R = reflMap(L), top = 0, next = [];
      faces.forEach(function (fc) { if (fc.layer > top) top = fc.layer; });
      faces.forEach(function (fc) {
        var cur = fc.src.map(function (p) { return mapPt(fc.T, p); }), Ti = invert(fc.T);
        var sta = clip(cur, L, -m), mov = clip(cur, L, m);
        if (sta) next.push({ src: sta.map(function (p) { return mapPt(Ti, p); }), T: fc.T, layer: fc.layer, moved: false });
        if (mov) next.push({ src: mov.map(function (p) { return mapPt(Ti, p); }), T: compose(R, fc.T), layer: 2 * top + 1 - fc.layer, moved: true });
      });
      faces = next;
      states.push(stateOut(faces, f.sta, keyCells, L));
    });
    return states;
  }

  /* ---------- items ---------- */

  function normParams(params) {
    var p = {};
    ['folds', 'type', 'punches', 'idle'].forEach(function (k) {
      var v = params ? params[k] : 0;
      p[k] = isInt(v) ? v : 0;
    });
    return p;
  }

  function cellOf(c) { return [c % N, floor(c / N)]; }

  function attempt(r, p, relaxed) {
    var F = FOLDS[p.folds], type = typeOf(p), P = PUNCHES[p.punches], idle = idleOf(p), n = nOpt(p), k, c;
    var st = chooseFolds(r, F, type, idle, P);
    if (!st) return null;
    var pick = choosePunches(r, punchCells(st), P, F - idle, relaxed ? HMAX : Math.min(HMAX, 2 + 3 * P + F));
    if (!pick) return null;
    var punches = pick.map(function (v) { return v.cell.slice(); }), keyCells = [], matterMask = 0;
    pick.forEach(function (v) {
      matterMask |= v.mask;
      v.layers.forEach(function (cc) { keyCells.push(cellOf(cc)); });
    });
    var keyMask = maskOf(keyCells);
    // Img_k: where fold k's flap lies right after fold k.
    var steps = st.folds.map(function (f, kk) {
      var img = new U8(N * N), h = st.hist[kk + 1];
      for (var cc = 0; cc < N * N; cc++) if (st.mask[cc] & (1 << kk)) img[(h.y[cc] - 0.5) * N + h.x[cc] - 0.5] = 1;
      return { L: f.line, move: f.move, img: img, full: abs(area(f.mov) - area(f.sta)) < EPS };
    });
    var order = [];
    for (k = F - 1; k >= 0; k--) order.push(k);
    // Two bookkeepings must agree: the layers under the punches and the unfolded punches.
    var back = maskOf(unfoldCells(punches, steps, order));
    if (!keyMask || !back || maskKey(back) !== maskKey(keyMask)) return null;
    var finalPos = {};
    for (c = 0; c < N * N; c++) {
      var kk2 = ckey(st.x[c] - 0.5, st.y[c] - 0.5);
      (finalPos[kk2] = finalPos[kk2] || []).push(cellOf(c));
    }
    var ctx = { r: r, folds: st.folds, steps: steps, punches: punches, key: keyCells, keyMask: keyMask, layersAt: function (q) { return finalPos[ckey(q[0], q[1])] || []; } };
    var pool = foilPool(ctx);
    var foils = selectFoils(r, keyCells, keyMask, pool, n - 1, st.folds[0].line, relaxed, maskOf(punches), F - idle);
    if (!foils) return null;
    var whyText = function (w) { return typeof w === 'string' ? w : w.mirrorOf !== undefined ? whyText(w.mirrorOf) + ', mirrored' : ctx.whyOf(w); };
    var opts = [{ cells: keyCells, why: null }].concat(foils.map(function (f) { return { cells: maskCells(f.mask), why: whyText(f.why) }; }));
    var perm = shuffle(r, opts.map(function (_, i) { return i; }));
    return {
      ex: 'fold', v: 1, seed: 0, params: p, key: perm.indexOf(0), n: N, nOptions: n, holes: keyCells.length,
      folds: st.folds.map(function (f, kk) {
        var g = grad(f.line.k);
        return { cls: f.cls, line: { k: f.line.k, c: f.line.c }, move: f.move, dir: [-f.move * g[0] + 0, -f.move * g[1] + 0], seg: f.seg, matters: !!(matterMask & (1 << kk)) };
      }),
      punches: sortCells(punches),
      options: perm.map(function (i) { return sortCells(opts[i].cells); }),
      why: perm.map(function (i) { return opts[i].why; }),
      steps: buildSteps(st.folds, keyCells),
    };
  }

  var fallbackCache = {};
  function generate(rng, params) {
    var p = normParams(params), item, i;
    for (i = 0; i < 50; i++) {
      item = attempt(i === 0 ? rng : rng.fork('retry' + i), p, false);
      if (item) { item.seed = rng.seed; if (validate(item) === true) return item; }
    }
    item = fallbackFor(p);
    item.seed = rng.seed;
    return item;
  }

  // Fallback: a valid item for these params from a fixed search (the same for every seed, so
  // cached), with the soft limits relaxed; marked fallback: true (the engine voids such trials).
  function fallbackFor(params) {
    var p = normParams(params), pk = PX.ex.paramsKey(p), item;
    for (var i = 0; i < 400 && !fallbackCache[pk]; i++) {
      item = attempt(PX.rng(PX.rng.hash('fold-fallback', pk, i)), p, i >= 200);
      if (item && validate(item) === true) fallbackCache[pk] = item;
    }
    item = PX.util.deepCopy(fallbackCache[pk] || fixedItem(p));
    item.fallback = true;
    return item;
  }

  // Last resort (never reached in the tests): one half fold, one punch.
  function fixedItem(p) {
    var r = PX.rng(7), st = newState(), f = candidates(st.outline, { H: 1 }, 1, false).filter(function (c) { return c.line.k === 'v' && c.line.c === 4 && c.move === -1; })[0];
    f.mov = clip(st.outline, f.line, f.move); f.sta = clip(st.outline, f.line, -f.move);
    f.prev = st.outline; f.seg = crease(f.mov, f.line);
    applyFold(st, f, 0); st.folds.push(f);
    var keyCells = [[5, 3], [2, 3]], foils = [[[6, 3], [1, 3]], [[5, 2], [2, 2]], [[4, 3], [3, 3]], [[5, 4], [2, 4]]];
    var opts = [keyCells].concat(foils.slice(0, nOpt(p) - 1));
    var perm = shuffle(r, opts.map(function (_, i) { return i; }));
    return {
      ex: 'fold', v: 1, seed: 0, params: p, key: perm.indexOf(0), n: N, nOptions: opts.length, holes: 2,
      folds: [{ cls: 'H', line: { k: 'v', c: 4 }, move: -1, dir: [1, 0], seg: f.seg, matters: true }],
      punches: [[5, 3]], options: perm.map(function (i) { return sortCells(opts[i]); }), why: perm.map(function (i) { return i ? 'fixed foil' : null; }),
      steps: buildSteps(st.folds, keyCells),
    };
  }

  /* ---------- validator: an independent re-simulation on 4·N² triangles ----------
     Each cell is cut by its diagonals into 4 triangles (q: 0 top, 1 right, 2 bottom, 3 left);
     a triangle is tracked by its centroid in units of 1/6 cell, so every reflection is exact
     integer arithmetic and no triangle ever straddles a fold line. */

  var QX = [3, 5, 3, 1], QY = [1, 3, 5, 3];
  // Edge neighbours of a triangle, as centroid offsets, by its kind (top, right, bottom, left).
  var NBX = [[2, -2, 0], [-2, -2, 2], [2, -2, 0], [2, 2, -2]];
  var NBY = [[2, 2, -2], [-2, 2, 0], [-2, -2, 2], [-2, 2, 0]];
  function triKind(rx, ry) { return ry === 1 ? 0 : rx === 5 ? 1 : ry === 5 ? 2 : 3; }
  function side6(L, X, Y) {
    var c = 6 * L.c;
    switch (L.k) {
      case 'v': return X - c;
      case 'h': return Y - c;
      case 'd': return X - Y - c;
      default: return X + Y - c;
    }
  }

  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }

  function check(item) {
    if (!item || item.ex !== 'fold') return 'not a fold item';
    var p = item.params || {}, t, k, q, x, y;
    if (!(isInt(p.folds) && p.folds >= 0 && p.folds < FOLDS.length && isInt(p.type) && p.type >= 0 && p.type < TYPES.length
      && isInt(p.punches) && p.punches >= 0 && p.punches < PUNCHES.length && isInt(p.idle) && p.idle >= 0 && p.idle < IDLE.length)) return 'bad params';
    var F = FOLDS[p.folds], P = PUNCHES[p.punches], nO = nOpt(p), n = item.n;
    if (n !== N) return 'sheet size ' + n;
    if (!isArray(item.folds) || item.folds.length !== F) return 'expected ' + F + ' folds';
    if (!isArray(item.punches) || item.punches.length !== P) return 'expected ' + P + ' punches';
    if (!isArray(item.options) || item.options.length !== nO) return 'expected ' + nO + ' options';
    if (!(isInt(item.key) && item.key >= 0 && item.key < nO)) return 'key out of range';
    var W = 6 * n, TT = 4 * n * n, X = new I32(TT), Y = new I32(TT), moved = new I32(TT);
    for (t = 0; t < TT; t++) { var c0 = t >> 2; X[t] = 6 * (c0 % n) + QX[t & 3]; Y[t] = 6 * floor(c0 / n) + QY[t & 3]; }
    var snaps = [[X.slice(), Y.slice()]], classes = [], occ = new U8(W * W), grid2 = new U8(W * W);
    for (k = 0; k < F; k++) {
      var f = item.folds[k], L = f && f.line, tag = 'fold ' + (k + 1) + ': ';
      if (!L || KINDS.indexOf(L.k) < 0 || !isInt(L.c) || (f.move !== 1 && f.move !== -1)) return tag + 'bad line';
      occ.fill(0); grid2.fill(0);
      var nMov = 0, nSta = 0, nMovPos = 0, bx0 = INF, by0 = INF, bx1 = -INF, by1 = -INF;
      for (t = 0; t < TT; t++) {
        x = X[t]; y = Y[t];
        var rx = x % 6, ry = y % 6, i6 = x - rx, j6 = y - ry;
        var ex0 = rx === 5 ? i6 + 3 : i6, ex1 = rx === 1 ? i6 + 3 : i6 + 6, ey0 = ry === 5 ? j6 + 3 : j6, ey1 = ry === 1 ? j6 + 3 : j6 + 6;
        if (ex0 < bx0) bx0 = ex0;
        if (ey0 < by0) by0 = ey0;
        if (ex1 > bx1) bx1 = ex1;
        if (ey1 > by1) by1 = ey1;
        var s = f.move * side6(L, x, y);
        if (s === 0) return tag + 'a triangle lies on the line';
        if (s > 0) { nMov++; if (!grid2[y * W + x]) { grid2[y * W + x] = 1; nMovPos++; } }
        else { nSta++; occ[y * W + x] = 1; }
      }
      if (!nMov || !nSta) return tag + 'one side holds no paper';
      if (nMovPos < 8) return tag + 'the flap is smaller than 2 cells';
      var sc = side6(L, (bx0 + bx1) / 2, (by0 + by1) / 2);
      var cls = L.k === 'v' || L.k === 'h' ? 'H' : sc === 0 ? 'D' : f.move * sc < 0 ? 'C' : null;
      if (!cls) return tag + 'a 45° flap holds the centre of the shape';
      if (cls !== f.cls) return tag + 'class ' + f.cls + ', geometry says ' + cls;
      var g = grad(L.k);
      if (!isArray(f.dir) || f.dir[0] !== -f.move * g[0] || f.dir[1] !== -f.move * g[1]) return tag + 'dir';
      var c6 = 6 * L.c;
      for (t = 0; t < TT; t++) {
        x = X[t]; y = Y[t];
        if (f.move * side6(L, x, y) <= 0) continue;
        var nx, ny;
        switch (L.k) {
          case 'v': nx = 2 * c6 - x; ny = y; break;
          case 'h': nx = x; ny = 2 * c6 - y; break;
          case 'd': nx = y + c6; ny = x - c6; break;
          default: nx = c6 - y; ny = c6 - x;
        }
        if (nx < 0 || ny < 0 || nx >= W || ny >= W || !occ[ny * W + nx]) return tag + 'the flap overhangs the paper';
        X[t] = nx; Y[t] = ny; moved[t] |= 1 << k;
      }
      classes.push(cls);
      snaps.push([X.slice(), Y.slice()]);
    }
    if (!typeMatches(TYPES[p.type], classes)) return 'folds ' + classes.join('') + ' do not fit type ' + TYPES[p.type];

    // One piece: the final footprint is edge-connected.
    occ.fill(0); grid2.fill(0);
    var nOcc = 0, stack = new I32(TT + 1), sp = 0, reached = 0;
    for (t = 0; t < TT; t++) { var ps0 = Y[t] * W + X[t]; if (!occ[ps0]) { occ[ps0] = 1; nOcc++; } }
    stack[sp++] = Y[0] * W + X[0]; grid2[stack[0]] = 1;
    while (sp) {
      var cur = stack[--sp], cx0 = cur % W, cy0 = (cur - cx0) / W, kind = triKind(cx0 % 6, cy0 % 6);
      reached++;
      for (q = 0; q < 3; q++) {
        var ax = cx0 + NBX[kind][q], ay = cy0 + NBY[kind][q];
        if (ax < 0 || ay < 0 || ax >= W || ay >= W) continue;
        var ai = ay * W + ax;
        if (occ[ai] && !grid2[ai]) { grid2[ai] = 1; stack[sp++] = ai; }
      }
    }
    if (reached !== nOcc) return 'the folded paper is not one piece';

    // Punches: the cell wholly on paper; every layer under it a whole, uncreased cell.
    var holes = [], isHole = new U8(n * n), punchSeen = new U8(n * n);
    for (var pi = 0; pi < P; pi++) {
      var pc = item.punches[pi];
      if (!isArray(pc) || !isInt(pc[0]) || !isInt(pc[1]) || !onSheet(pc)) return 'punch ' + (pi + 1) + ' off the sheet';
      if (punchSeen[pc[1] * n + pc[0]]++) return 'repeated punch';
      for (q = 0; q < 4; q++) if (!occ[(6 * pc[1] + QY[q]) * W + 6 * pc[0] + QX[q]]) return 'punch ' + (pi + 1) + ' is not wholly on the paper';
      var nUnder = 0;
      for (t = 0; t < TT; t += 4) {
        var inCell = 0, kinds = 0;
        for (q = 0; q < 4; q++) {
          if (floor(X[t + q] / 6) === pc[0] && floor(Y[t + q] / 6) === pc[1]) { inCell++; kinds |= 1 << triKind(X[t + q] % 6, Y[t + q] % 6); }
        }
        if (!inCell) continue;
        if (inCell !== 4) return 'punch ' + (pi + 1) + ' cuts a partial hole';
        if (kinds !== 15) return 'punch ' + (pi + 1) + ' lies on a crease';
        var cc = t >> 2;
        isHole[cc] = 1; nUnder++;
        holes.push([cc % n, floor(cc / n)]);
      }
      if (!nUnder) return 'punch ' + (pi + 1) + ' goes through no paper';
    }
    if (holes.length > HMAX) return 'too many holes (' + holes.length + ')';

    // Folds that matter: unfolding them adds holes.
    var matter = 0;
    for (t = 0; t < TT; t++) if (isHole[t >> 2]) matter |= moved[t];
    if (popcount(matter) !== F - idleOf(p)) return popcount(matter) + ' folds matter, expected ' + (F - idleOf(p));
    for (k = 0; k < F; k++) if (!!item.folds[k].matters !== !!(matter & (1 << k))) return 'fold ' + (k + 1) + ': matters flag';

    // Options: same hole count, exactly one equal to the true holes (the key), pairwise different.
    var trueKey = maskKey(maskOf(holes)), seenOpt = {}, nRight = 0;
    for (var oi = 0; oi < nO; oi++) {
      var opt = item.options[oi];
      if (!isArray(opt) || opt.length !== holes.length) return 'option ' + (oi + 1) + ': hole count';
      for (q = 0; q < opt.length; q++) if (!isArray(opt[q]) || !isInt(opt[q][0]) || !isInt(opt[q][1])) return 'option ' + (oi + 1) + ': cells';
      var m = maskOf(opt);
      if (!m || popcount(m[0]) + popcount(m[1]) !== opt.length) return 'option ' + (oi + 1) + ': cells off the sheet or repeated';
      var ok = maskKey(m);
      if (seenOpt[ok]) return 'options ' + seenOpt[ok] + ' and ' + (oi + 1) + ' are the same';
      seenOpt[ok] = oi + 1;
      if (ok === trueKey) { nRight++; if (oi !== item.key) return 'the right option is not the key'; }
    }
    if (nRight !== 1) return nRight + ' options match the true holes';

    // Show-me states agree with this simulation (the explanation uses the grading model).
    if (!isArray(item.steps) || item.steps.length !== F + 1) return 'steps';
    for (var si = 0; si <= F; si++) {
      var stp = item.steps[si], SX = snaps[si][0], SY = snaps[si][1], nS = 0, hs = [];
      occ.fill(0);
      for (t = 0; t < TT; t++) { var kp = SY[t] * W + SX[t]; if (!occ[kp]) { occ[kp] = 1; nS++; } }
      if (!stp || !isArray(stp.outline) || abs(area(stp.outline) * 4 - nS) > EPS) return 'step ' + si + ': outline area';
      var fa = 0;
      for (q = 0; q < stp.faces.length; q++) fa += area(stp.faces[q].poly);
      if (abs(fa - n * n) > EPS) return 'step ' + si + ': faces do not cover the sheet once';
      for (t = 0; t < TT; t += 4) if (isHole[t >> 2]) hs.push([floor(SX[t] / 6), floor(SY[t] / 6)]);
      var hm = maskOf(hs), sm = maskOf(stp.holes || []);
      if (!hm || !sm || maskKey(hm) !== maskKey(sm) || popcount(sm[0]) + popcount(sm[1]) !== stp.holes.length) return 'step ' + si + ': hole positions';
    }
    if (maskKey(maskOf(item.steps[F].holes)) !== maskKey(maskOf(item.punches))) return 'last step holes are not the punches';
    return true;
  }

  function score(item, response) { return { correct: response === item.key }; }

  // Difficulty: one-fold "mixed" is a diagonal fold; idle folds count only up to folds − 1.
  function difficulty(params) {
    var p = normParams(params);
    return -2.2 + 0.6 * p.folds + 0.35 * typeIndexEff(p) + 0.3 * p.punches - 0.35 * idleOf(p);
  }

  PX.ex.define({
    id: 'fold', version: 1, code: 'EX-04', name: 'Paper folding', short: 'Fold',
    abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'train',
    answer: 'choice', nOptions: 5, // 4 options below 4 folds, 5 from 4 folds up: use item.options.length
    dims: [
      { key: 'folds', label: 'Folds', levels: FOLDS, step: 0.6 },
      { key: 'type', label: 'Fold type', levels: TYPES, step: 0.35 },
      { key: 'punches', label: 'Punches', levels: PUNCHES, step: 0.3 },
      { key: 'idle', label: 'Folds that do not matter', levels: IDLE, step: -0.35 },
    ],
    base: -2.2,
    difficulty: difficulty,
    chance: function (params) { return 1 / nOpt(normParams(params)); },
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      N: N, FOLDS: FOLDS, TYPES: TYPES, PUNCHES: PUNCHES, IDLE: IDLE, HMAX: HMAX,
      nOptions: function (params) { return nOpt(normParams(params)); },
      side: side, reflPt: reflPt, reflCell: reflCell, mirrorCell: mirrorCell, symScore: symScore,
      maskOf: maskOf, hamming: hamming, popcount: popcount, area: area, clip: clip,
      candidates: function (O, allowed) { return candidates(O, allowed, 1, false); }, typeMatches: typeMatches,
      fallback: fallbackFor, norm: normParams, grad: grad,
    },
  });

  /* ===== v1.1 EXPORT BLOCK (owner: B5; used by PAT-4 Hole Punch, js/ex/patfold/gen.js) =====
     A non-breaking addition: nothing above changes, and Fold's ids, ratings, items and lib keys
     stay as they were. Hole Punch runs this exact model on a 4 × 4 sheet. sheet(n, fn) sets the
     sheet size to n for the duration of one synchronous call of fn and always restores 8 in a
     finally block, so Fold's own generate and validate never see another size. Every size-
     dependent function above reads N when it runs (the scratch arrays are allocated for 8 × 8 and
     are large enough for 4 × 4). Fold's fallback cache is not reachable from here: it is keyed by
     Fold's params alone, so the caller keeps its own fallbacks.
     fn receives { n, attempt(rng, params, relaxed) → item | null (ex 'fold', item.n = n),
     check(item) → true | reason (the triangle re-simulation; item.ex must be 'fold'),
     norm, maskOf, maskCells, maskKey, hamming, popcount, symScore, symMask, mirrorCell, reflCell,
     onSheet, unfoldMask(start, ctx.steps, order, count, alt) }.
     Optional hooks, active for the same call only (a small sheet has few neighbouring problems,
     so Hole Punch widens the foil pool and balances its own shortcuts):
       hooks.pool(ctx, pool) → pool    runs after foilPool(ctx); ctx as built in attempt()
                                       (r, folds, steps, punches, key, keyMask, layersAt, whyOf)
       hooks.select(r, keyCells, keyMask, pool, nf, line1, relaxed, punchMask, mt) → foils | null
                                       replaces selectFoils (same arguments and result);
       hooks.nOptions(params) → count  replaces nOpt (attempt builds, and check expects, that
                                       many options). */
  PX.ex.get('fold').lib.sheet = function (n, fn, hooks) {
    if (n !== 4 && n !== 8) throw new Error('fold lib.sheet: the sheet size must be 4 or 8 (got ' + n + ')');
    var keepN = N, keepPool = foilPool, keepSelect = selectFoils, keepNOpt = nOpt;
    N = n;
    if (hooks && typeof hooks.pool === 'function') foilPool = function (ctx) { return hooks.pool(ctx, keepPool(ctx)); };
    if (hooks && typeof hooks.select === 'function') selectFoils = hooks.select;
    if (hooks && typeof hooks.nOptions === 'function') nOpt = hooks.nOptions;
    try {
      return fn({
        n: n, attempt: attempt, check: check, norm: normParams,
        maskOf: maskOf, maskCells: maskCells, maskKey: maskKey, hamming: hamming, popcount: popcount,
        symScore: symScore, symMask: symMask, mirrorCell: mirrorCell, reflCell: reflCell, onSheet: onSheet,
        unfoldMask: unfoldMask,
      });
    } finally { N = keepN; foilPool = keepPool; selectFoils = keepSelect; nOpt = keepNOpt; }
  };
  /* ===== end of the v1.1 export block ===== */
})(window.PX);
