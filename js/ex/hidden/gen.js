/* EX-10 Hidden: embedded figures on a lattice (pure; ARCHITECTURE.md §5, PLAN.md §3,
   research/B-tasks.md §8 and §14c).

   A complex line figure and five simple shapes: which shape is hidden in the figure, at the same
   size and orientation? (Uttal's intrinsic-static example; CHC flexibility of closure, CF.) Our own
   lattice figures, as Huang et al. 2025 generated theirs; nothing is copied from the GEFT or the
   ETS Hidden Figures.

   Lattice. Integer points (x, y), y down. A segment joins two neighbouring points: horizontal (H),
   vertical (V) or diagonal (D "\", A "/"). Both diagonals of one cell may appear in the figure (an
   X), never in a shape. A shape is present when every one of its segments is a segment of the
   figure, wherever the figure's lines go on: lines may continue past the shape's ends (continuation
   camouflage, research §8). The tutorial teaches this rule.

   Shapes (the five options): open or closed polylines of 3–6 segments that visit no point twice (a
   closed one returns to its start), at most 3 × 3 cells, with two or more directions, two or more
   turns (one for 3 segments) and no straight run longer than 2 segments. The five options of an item
   have the same number of segments of each direction (H, V, D, A): counting segments or comparing
   direction histograms ties all five (a 1-in-5 guess). They differ in arrangement only, and are
   pairwise different up to translation, so none contains another.

   Similarity: the share of segments two options have in common at their best overlap, averaged over
   the 10 pairs. low < 0.42 (independent rearrangements of the same segments, any two sharing at most
   (n − 1)/2 segments), medium 0.42–0.62 (one hidden base shape with neighbouring steps swapped in
   different places), high ≥ 0.62 (a shape and its variants with an end segment moved: near misses
   one segment off, research §14c).

   Figure. The key option sits at a uniformly random spot of an N × N grid. Lines grow from it: first
   one segment at each of two different key points (so the key always shares two or more points with
   other lines and is never isolated), then the figure spreads toward the grid size and grows by
   continuing lines and branching at existing points (at most 4 segments meet at a point). A segment
   is never added when it would complete a second copy of the key or any copy of another option, so
   the key is embedded exactly once and the others nowhere. One placement only, so that show-me
   points at one place and difficulty does not vary with accidental copies. Exactly `extra`
   segments are added and the figure is connected.

   Shortcut neutrality: segment counts and direction histograms tie by construction, and the key is
   drawn uniformly among the five options after they are made (growth is retried for the same
   options and key), so every stem-blind rule (the option most like the others, the odd one out, the
   largest) scores 1/5 in expectation.

   validate (independent of the growth bookkeeping): an exhaustive search over every translation for
   every option (exactly one placement of the key, at item.place; none of the others), the shape
   rules from the segment sets alone, equal direction counts, pairwise distinct options, two shared
   points, a connected figure, the counts, the similarity band, the spread and the show-me data.

   Item (JSON):
     { ex: 'hidden', seed, params, key,            key = index of the hidden option (0–4)
       grid: N,                                    the figure lies on points 0..N in x and y
       figure: [[x1, y1, x2, y2], …],              its unit segments
       options: [{ segs: [[x1, y1, x2, y2], …], w, h } × 5],   normalised: min corner at (0, 0)
       place: [dx, dy],                            the key's copy: its segs shifted by (dx, dy)
       near: [{ at: [dx, dy], missing: [[x1, y1, x2, y2], …] } × 5],   each option's best overlap
                                                   with the figure and what is missing there (none
                                                   for the key), for show-me
       n, extra, sim }                             segments per option, extra segments, similarity
     PX.ex.get('hidden').lib exposes the lattice helpers and the shortcut solvers (view, tests).

   Difficulty: additive (dims below) [DJ]: extra lines (density and camouflage, research §8), then
   candidate similarity, then figure size (search area). Base −2.3: a beginner (θ = 0) answers the
   easiest items right about 90 % of the time with the 1-in-5 guessing rate. */
(function (PX) {
  'use strict';

  /* ------------------------------------------------------------ constants */
  var W = 32;                                         // packing: key = ((x · 32) + y) · 4 + class
  var SX = [1, 1, 0, -1, -1, -1, 0, 1], SY = [0, 1, 1, 1, 0, -1, -1, -1];  // E SE S SW W NW N NE (y down)
  var CLS = [0, 2, 1, 3, 0, 2, 1, 3];                 // class of each step: H 0, V 1, D 2 (\), A 3 (/)
  var BASE = [0, 2, 1, 7];                            // one step of each class (E, S, SE, NE)
  var FWD = [0, 2, 1, 3];                             // the step that continues a segment past its second end
  var EXT = [[1, 0], [0, 1], [1, 1], [1, 1]];         // extent of a segment of each class from its anchor
  var RUN = [[1, 0], [0, 1], [1, 1], [-1, 1]];        // anchor shift to the next collinear segment
  var EXTRAS = [6, 10, 14, 19, 25, 32], SIMS = ['low', 'medium', 'high'], SIZES = [5, 6, 7];
  var BANDS = [[0, 0.42], [0.42, 0.62], [0.62, 1.0001]];
  var NSEG = [[3, 6], [4, 6], [4, 6]];                // segments per option, by similarity level
  var MAXBOX = 3, MAXRUN = 2, MAXDEG = 4, NOPT = 5, START = 8;
  var XCELL = 0.25;                                   // chance to accept the second diagonal of a cell (an X)
  var DIFF = { base: -2.3, extra: 0.45, sim: 0.65, size: 0.3 };
  var STATS = { fallbacks: 0 };                       // counted for the tests (generate should never need the fallback)

  /* ------------------------------------------------------------ lattice */
  function opp(s) { return (s + 4) & 7; }
  function ek(x, y, c) { return (x * W + y) * 4 + c; }
  function kx(k) { return k >> 7; }                    // 4 · W = 2^7
  function ky(k) { return (k >> 2) & 31; }             // W − 1
  function kc(k) { return k & 3; }
  function shift(dx, dy) { return (dx * W + dy) * 4; }
  function isInt(x) { return typeof x === 'number' && isFinite(x) && Math.floor(x) === x; }
  // The segment from point (x, y) by step s.
  // −1 when the segment would leave the packed range (a negative coordinate, for instance).
  function edgeOf(x, y, s) {
    var x2 = x + SX[s], y2 = y + SY[s], ax = x < x2 ? x : x2, ay = y < y2 ? y : y2;
    return ax < 0 || ay < 0 || ax >= W - 1 || ay >= W - 1 ? -1 : (ax * W + ay) * 4 + CLS[s];
  }
  function ends(k) {
    var x = kx(k), y = ky(k), c = kc(k);
    return c === 0 ? [[x, y], [x + 1, y]] : c === 1 ? [[x, y], [x, y + 1]] : c === 2 ? [[x, y], [x + 1, y + 1]] : [[x + 1, y], [x, y + 1]];
  }
  function seg(k) { var e = ends(k); return [e[0][0], e[0][1], e[1][0], e[1][1]]; }
  // The key of a segment [x1, y1, x2, y2], or −1 when it is not a unit segment on the lattice.
  function keyOfSeg(s) {
    if (!Array.isArray(s) || s.length !== 4 || !s.every(isInt)) return -1;
    if (Math.min(s[0], s[1], s[2], s[3]) < 0 || Math.max(s[0], s[1], s[2], s[3]) >= W) return -1;
    var dx = s[2] - s[0], dy = s[3] - s[1];
    for (var st = 0; st < 8; st++) if (SX[st] === dx && SY[st] === dy) return edgeOf(s[0], s[1], st);
    return -1;
  }
  // Moves k by (dx, dy), or −1 when it would leave the packed range.
  function moved(k, dx, dy) {
    var x = kx(k) + dx, y = ky(k) + dy;
    return x < 0 || y < 0 || x >= W - 1 || y >= W - 1 ? -1 : ek(x, y, kc(k));
  }
  function box(keys) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var i = 0; i < keys.length; i++) {
      var x = kx(keys[i]), y = ky(keys[i]), e = EXT[kc(keys[i])];
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x + e[0] > x1) x1 = x + e[0];
      if (y + e[1] > y1) y1 = y + e[1];
    }
    return { x0: x0, y0: y0, w: x1 - x0, h: y1 - y0 };
  }
  function normalize(keys) {
    var b = box(keys), off = shift(b.x0, b.y0);
    return keys.map(function (k) { return k - off; }).sort(function (a, c) { return a - c; });
  }
  function classCounts(keys) {
    var h = [0, 0, 0, 0];
    for (var i = 0; i < keys.length; i++) h[kc(keys[i])]++;
    return h;
  }
  // The most segments a and b (normalised) share at any relative translation.
  // Scratch marks, reset by stamping (no allocation in the hot loops; the stamps never change a
  // result): MARK over segment keys, VMARK over points, DMARK/DVAL the diagonal used in a cell.
  var MARK = new Int32Array(W * W * 4), VMARK = new Int32Array(W * W), DMARK = new Int32Array(W * W);
  var DVAL = new Int8Array(W * W), stamp = 0;
  function nextStamp() {
    if (stamp >= 1073741823) { MARK.fill(0); VMARK.fill(0); DMARK.fill(0); stamp = 0; } // before Int32 wraps
    return ++stamp;
  }
  function share(a, b) {
    var st = nextStamp(), best = 0, i;
    for (i = 0; i < a.length; i++) MARK[a[i]] = st;
    for (var dx = -MAXBOX; dx <= MAXBOX; dx++) {
      for (var dy = -MAXBOX; dy <= MAXBOX; dy++) {
        var c = 0, off = shift(dx, dy);
        for (i = 0; i < b.length; i++) {
          var k = b[i];
          if ((k >> 7) + dx >= 0 && ((k >> 2) & 31) + dy >= 0 && MARK[k + off] === st) c++;
        }
        if (c > best) best = c;
      }
    }
    return best;
  }
  function meanShare(sets) {
    var s = 0, pairs = 0;
    for (var i = 0; i < sets.length; i++) for (var j = i + 1; j < sets.length; j++) { s += share(sets[i], sets[j]); pairs++; }
    return s / pairs / sets[0].length;
  }

  /* ------------------------------------------------------------ shapes */
  // The normalised segments of a walk from (8, 8) by steps, or null when it breaks a shape rule.
  function walk(steps) {
    var n = steps.length, x = START, y = START, keys = new Array(n), run = 1, turns = 0, cmask = 0, st = nextStamp();
    var x0 = x, x1 = x, y0 = y, y1 = y;
    VMARK[x * W + y] = st;
    for (var i = 0; i < n; i++) {
      var s = steps[i];
      if (i > 0) {
        if (s === opp(steps[i - 1])) return null;
        if (s === steps[i - 1]) { if (++run > MAXRUN) return null; } else { run = 1; turns++; }
      }
      var k = edgeOf(x, y, s), c = k & 3;
      x += SX[s];
      y += SY[s];
      if (x < x0) x0 = x; else if (x > x1) x1 = x;
      if (y < y0) y0 = y; else if (y > y1) y1 = y;
      cmask |= 1 << c;
      if (c >= 2) {
        if (DMARK[k >> 2] === st && DVAL[k >> 2] !== c) return null;
        DMARK[k >> 2] = st;
        DVAL[k >> 2] = c;
      }
      var v = x * W + y;
      if (VMARK[v] === st && !(i === n - 1 && x === START && y === START && n >= 3)) return null;
      VMARK[v] = st;
      keys[i] = k;
    }
    // A closed walk starts at a corner, so no straight run passes through its start.
    if (x === START && y === START && steps[n - 1] === steps[0]) return null;
    var nc = (cmask & 1) + ((cmask >> 1) & 1) + ((cmask >> 2) & 1) + ((cmask >> 3) & 1);
    if (x1 - x0 > MAXBOX || y1 - y0 > MAXBOX || nc < 2 || turns < (n >= 4 ? 2 : 1)) return null;
    // The lowest point is the lowest segment anchor, so this is normalize() without a box pass.
    var off = shift(x0, y0);
    for (var j = 0; j < n; j++) keys[j] -= off;
    return keys.sort(numeric);
  }
  // A random shape of n segments: a guided walk (no reversal, no run over 2, no revisit, no X,
  // within 3 × 3), checked by walk(). With cnt ([H, V, D, A] counts), it uses exactly those
  // segment classes: a rearrangement of a shape with the same segments.
  var OPTS = [0, 0, 0, 0, 0, 0, 0, 0];
  function guidedShape(r, n, cnt) {
    for (var t = 0; t < 80; t++) {
      var steps = [], left = cnt ? cnt.slice() : null, x = START, y = START, x0 = x, x1 = x, y0 = y, y1 = y, ok = true, st = nextStamp();
      VMARK[x * W + y] = st;
      for (var i = 0; i < n && ok; i++) {
        var no = 0;
        for (var s = 0; s < 8; s++) {
          if (left && !left[CLS[s]]) continue;
          if (i > 0 && s === opp(steps[i - 1])) continue;
          if (i > 1 && s === steps[i - 1] && s === steps[i - 2]) continue;
          var nx = x + SX[s], ny = y + SY[s];
          if (Math.max(x1, nx) - Math.min(x0, nx) > MAXBOX || Math.max(y1, ny) - Math.min(y0, ny) > MAXBOX) continue;
          if (VMARK[nx * W + ny] === st && !(i === n - 1 && nx === START && ny === START && n >= 3)) continue;
          var k = edgeOf(x, y, s), c = k & 3;
          if (c >= 2 && DMARK[k >> 2] === st && DVAL[k >> 2] !== c) continue;
          OPTS[no++] = s;
        }
        if (!no) { ok = false; break; }
        var chosen = OPTS[r.int(0, no - 1)], ke = edgeOf(x, y, chosen);
        if ((ke & 3) >= 2) { DMARK[ke >> 2] = st; DVAL[ke >> 2] = ke & 3; }
        if (left) left[CLS[chosen]]--;
        x += SX[chosen];
        y += SY[chosen];
        VMARK[x * W + y] = st;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        steps.push(chosen);
      }
      if (!ok) continue;
      var keys = walk(steps);
      if (keys) return { steps: steps, keys: keys };
    }
    return null;
  }
  function randomShape(r, n) { return guidedShape(r, n, null); }
  // The same segment classes in a new arrangement.
  function anagram(r, steps) {
    var cnt = [0, 0, 0, 0];
    for (var i = 0; i < steps.length; i++) cnt[CLS[steps[i]]]++;
    return guidedShape(r, steps.length, cnt);
  }
  function reverseSteps(st) { return st.slice().reverse().map(opp); }
  // The last segment moved: the other way at the same end, or to the start (either way).
  function endMoves(st) {
    var n = st.length, c = st[n - 1], core = st.slice(0, n - 1);
    return [core.concat([opp(c)]), [c].concat(core), [opp(c)].concat(core)];
  }
  // Two neighbouring steps swapped (the corner between them flips).
  function swaps(st) {
    var out = [];
    for (var i = 0; i + 1 < st.length; i++) {
      if (st[i] === st[i + 1]) continue;
      var s = st.slice();
      s[i] = st[i + 1];
      s[i + 1] = st[i];
      out.push(s);
    }
    return out;
  }
  function lowMax(n) { return (n - 1) >> 1; }
  // Five distinct shapes with the same segment classes, built for similarity level si.
  function family(r, n, si) {
    var s0 = randomShape(r, n);
    if (!s0) return null;
    var mem = [], seen = {}, i, pool;
    function add(st, keys) {
      keys = keys || walk(st);
      if (!keys) return false;
      var id = keys.join(',');
      if (seen[id]) return false;
      if (si === 0) for (var j = 0; j < mem.length; j++) if (share(mem[j].keys, keys) > lowMax(n)) return false;
      seen[id] = true;
      mem.push({ steps: st, keys: keys });
      return true;
    }
    if (si === 0) {
      add(s0.steps, s0.keys);
      for (i = 0; i < 60 && mem.length < NOPT; i++) {
        // A base whose segments allow few low-overlap rearrangements: start again from another.
        if (i === 20 && mem.length < 3) return null;
        var a = anagram(r, s0.steps);
        if (a) add(a.steps, a.keys);
      }
    } else if (si === 2) {
      add(s0.steps, s0.keys);
      pool = r.shuffle(endMoves(s0.steps).concat(endMoves(reverseSteps(s0.steps))));
      for (i = 0; i < pool.length && mem.length < NOPT; i++) add(pool[i]);
    } else {
      seen[s0.keys.join(',')] = true; // the base shape itself is not an option
      pool = r.shuffle(swaps(s0.steps));
      for (i = 0; i < pool.length && mem.length < NOPT; i++) add(pool[i]);
      for (i = 0; i < 20 && mem.length < NOPT; i++) {
        var once = r.pick(swaps(s0.steps)), twice = once ? r.pick(swaps(once)) : null;
        if (twice) add(twice);
      }
    }
    return mem.length === NOPT ? mem : null;
  }
  // The five options of an item (shuffled), with their similarity inside the level's band.
  function makeOptions(r, P) {
    var n = r.int(NSEG[P.si][0], NSEG[P.si][1]);
    for (var t = 0; t < 30; t++) {
      var fam = family(r, n, P.si);
      if (!fam) continue;
      var sets = fam.map(function (m) { return m.keys; }), sim = meanShare(sets);
      if (sim >= BANDS[P.si][0] && sim < BANDS[P.si][1]) return { sets: r.shuffle(sets), sim: sim, n: n };
    }
    return null;
  }

  /* ------------------------------------------------------------ figure */
  // How far the figure should spread (cells, both axes) for a number of extra segments.
  function reachOf(E, N) { return Math.min(N, 3 + Math.floor(E / 4)); }
  function vkey(p) { return p[0] * W + p[1]; }

  // Endpoint offsets from a segment's anchor, by class: first end (E1), second end (E2).
  var E1X = [0, 0, 0, 1], E1Y = [0, 0, 0, 0], E2X = [1, 0, 1, 0], E2Y = [0, 1, 1, 1];
  // Outward steps: [along x, along y][toward lower, toward higher coordinates].
  var OUT = [[[3, 4, 5], [0, 1, 7]], [[5, 6, 7], [1, 2, 3]]];
  var DIRS = [0, 1, 2, 3, 4, 5, 6, 7], CAND = new Int32Array(512);

  // Grows the figure around option ki of sets; → { keys, tx, ty } or null.
  function grow(r, sets, ki, P) {
    var N = P.N, K = sets[ki], bk = box(K), target = K.length + P.E, i;
    var tx = r.int(0, N - bk.w), ty = r.int(0, N - bk.h), off = shift(tx, ty);
    var has = new Uint8Array(W * W * 4), bad = new Uint8Array(W * W * 4), deg = new Uint8Array(W * W);
    var list = [], boxes = sets.map(box), bx0 = W, by0 = W, bx1 = -1, by1 = -1;
    function put(k) {
      var x = k >> 7, y = (k >> 2) & 31, c = k & 3, ex = x + EXT[c][0], ey = y + EXT[c][1];
      has[k] = 1;
      list.push(k);
      deg[(x + E1X[c]) * W + y + E1Y[c]]++;
      deg[(x + E2X[c]) * W + y + E2Y[c]]++;
      if (x < bx0) bx0 = x;
      if (y < by0) by0 = y;
      if (ex > bx1) bx1 = ex;
      if (ey > by1) by1 = ey;
    }
    // Would k complete a placement of an option? (The key's own placement is complete already.)
    function completes(k) {
      var c = k & 3, x = k >> 7, y = (k >> 2) & 31;
      for (var o = 0; o < sets.length; o++) {
        var ks = sets[o], b = boxes[o];
        for (var j = 0; j < ks.length; j++) {
          if ((ks[j] & 3) !== c) continue;
          var dx = x - (ks[j] >> 7), dy = y - ((ks[j] >> 2) & 31);
          if (dx < 0 || dy < 0 || dx + b.w > N || dy + b.h > N) continue;
          var sh = shift(dx, dy), all = true;
          for (var q = 0; q < ks.length && all; q++) if (ks[q] + sh !== k && !has[ks[q] + sh]) all = false;
          if (all) return true;
        }
      }
      return false;
    }
    function tryAdd(k) {
      if (k < 0) return false;
      var x = k >> 7, y = (k >> 2) & 31, c = k & 3;
      if (x + EXT[c][0] > N || y + EXT[c][1] > N || has[k] || bad[k]) return false;
      if (c >= 2 && has[k - c + (5 - c)] && !r.chance(XCELL)) return false;
      if (deg[(x + E1X[c]) * W + y + E1Y[c]] >= MAXDEG || deg[(x + E2X[c]) * W + y + E2Y[c]] >= MAXDEG) return false;
      if (completes(k)) { bad[k] = 1; return false; }
      put(k);
      return true;
    }
    for (i = 0; i < K.length; i++) put(K[i] + off);
    // 1. One segment at each of two different points of the key.
    var verts = [];
    for (i = 0; i < list.length; i++) {
      var k0 = list[i], x0 = k0 >> 7, y0 = (k0 >> 2) & 31, c0 = k0 & 3;
      var p1 = (x0 + E1X[c0]) * W + y0 + E1Y[c0], p2 = (x0 + E2X[c0]) * W + y0 + E2Y[c0];
      if (verts.indexOf(p1) < 0) verts.push(p1);
      if (verts.indexOf(p2) < 0) verts.push(p2);
    }
    verts = r.shuffle(verts);
    var attached = 0;
    for (i = 0; i < verts.length && attached < 2; i++) {
      var dirs = r.shuffle(DIRS), vx = Math.floor(verts[i] / W), vy = verts[i] % W;
      for (var d = 0; d < 8; d++) if (tryAdd(edgeOf(vx, vy, dirs[d]))) { attached++; break; }
    }
    if (attached < 2) return null;
    // 2. Spread toward the grid size, continue lines, branch at existing points.
    var reach = reachOf(P.E, N);
    for (var guard = 0; list.length < target && guard < 3000; guard++) {
      var w = bx1 - bx0, h = by1 - by0, k = -1, e = list[r.int(0, list.length - 1)];
      var ex0 = e >> 7, ey0 = (e >> 2) & 31, ce = e & 3;
      if ((w < reach || h < reach) && r.chance(0.85)) {
        k = spreadEdge(r, list, w < reach && (h >= reach || r.chance(0.5)), N, bx0, by0, bx1, by1);
      } else if (r.chance(0.45)) {
        k = r.chance(0.5) ? edgeOf(ex0 + E2X[ce], ey0 + E2Y[ce], FWD[ce]) : edgeOf(ex0 + E1X[ce], ey0 + E1Y[ce], opp(FWD[ce]));
      } else {
        var second = r.chance(0.5);
        k = edgeOf(ex0 + (second ? E2X[ce] : E1X[ce]), ey0 + (second ? E2Y[ce] : E1Y[ce]), r.int(0, 7));
      }
      tryAdd(k);
    }
    return list.length === target ? { keys: list, tx: tx, ty: ty } : null;
  }
  // A segment from a point on the low or high side of the figure's box, pointing outward along x
  // (alongX) or y; −1 when neither side can grow.
  function spreadEdge(r, list, alongX, N, bx0, by0, bx1, by1) {
    var lo = alongX ? bx0 : by0, hi = alongX ? bx1 : by1, canLo = lo > 0, canHi = hi < N;
    if (!canLo && !canHi) return -1;
    var up = canLo && canHi ? r.chance(0.5) : canHi, edge = up ? hi : lo, nc = 0;
    for (var i = 0; i < list.length; i++) {
      var k = list[i], x = k >> 7, y = (k >> 2) & 31, c = k & 3;
      var ax = x + E1X[c], ay = y + E1Y[c], bx = x + E2X[c], by = y + E2Y[c];
      if ((alongX ? ax : ay) === edge) CAND[nc++] = ax * W + ay;
      if ((alongX ? bx : by) === edge) CAND[nc++] = bx * W + by;
    }
    var q = CAND[r.int(0, nc - 1)];
    return edgeOf(Math.floor(q / W), q % W, OUT[alongX ? 0 : 1][up ? 1 : 0][r.int(0, 2)]);
  }
  // Each option's best overlap with the figure: the first translation (dx, then dy) with the most
  // segments present, and the segments missing there.
  function nearOf(keys, has, N) {
    var b = box(keys), best = -1, at = [0, 0];
    for (var dx = 0; dx + b.w <= N; dx++) {
      for (var dy = 0; dy + b.h <= N; dy++) {
        var sh = shift(dx, dy), c = 0;
        for (var i = 0; i < keys.length; i++) if (has[keys[i] + sh]) c++;
        if (c > best) { best = c; at = [dx, dy]; }
      }
    }
    var sh2 = shift(at[0], at[1]);
    return { at: at, missing: keys.filter(function (k) { return !has[k + sh2]; }).map(function (k) { return seg(k + sh2); }) };
  }

  /* ------------------------------------------------------------ generate */
  function isLevel(x, n) { return typeof x === 'number' && x >= 0 && x < n && Math.floor(x) === x; }
  // → { E, N, si, ei, zi } or a reason string.
  function resolve(params) {
    if (!params || typeof params !== 'object') return 'params must be an object';
    if (!isLevel(params.extra, EXTRAS.length)) return 'extra must be a level index from 0 to ' + (EXTRAS.length - 1);
    if (!isLevel(params.sim, SIMS.length)) return 'sim must be a level index from 0 to 2';
    if (!isLevel(params.size, SIZES.length)) return 'size must be a level index from 0 to 2';
    if (params.variant !== undefined) return 'hidden has no variants';
    return { E: EXTRAS[params.extra], N: SIZES[params.size], si: params.sim, ei: params.extra, zi: params.size };
  }
  function copyParams(params) {
    var p = {};
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
    return p;
  }
  function assemble(seed, params, P, made, ki, fig) {
    var has = new Uint8Array(W * W * 4);
    fig.keys.forEach(function (k) { has[k] = 1; });
    return {
      ex: 'hidden', seed: seed, params: copyParams(params), key: ki, grid: P.N,
      figure: fig.keys.slice().sort(function (a, c) { return a - c; }).map(seg),
      options: made.sets.map(function (ks) { var b = box(ks); return { segs: ks.map(seg), w: b.w, h: b.h }; }),
      place: [fig.tx, fig.ty],
      near: made.sets.map(function (ks) { return nearOf(ks, has, P.N); }),
      n: made.n, extra: P.E, sim: Math.round(made.sim * 1000) / 1000,
    };
  }
  function attempt(r, P, params, seed) {
    var made = makeOptions(r.fork('options'), P);
    if (!made) return null;
    // The key is drawn after the options exist and kept while growth is retried, so no property
    // of the options predicts which one is hidden.
    var ki = r.fork('key').int(0, NOPT - 1);
    for (var g = 0; g < 6; g++) {
      var fig = grow(r.fork('grow' + g), made.sets, ki, P);
      if (fig) return assemble(seed, params, P, made, ki, fig);
    }
    return null;
  }
  function generate(rng, params) {
    var P = resolve(params);
    if (typeof P === 'string') throw new RangeError('hidden.generate: ' + P);
    for (var i = 0; i < 50; i++) {
      var item = attempt(rng.fork('try' + i), P, params, rng.seed);
      if (item && validate(item) === true) return item;
    }
    STATS.fallbacks++;
    return fallbackItem(params, rng.seed);
  }
  // Known-valid construction: the first of a fixed list of seeds that validates, memoised per
  // params. The tests build it for every combination.
  var fallbackMemo = {};
  function fallbackItem(params, seed) {
    var P = resolve(params);
    if (typeof P === 'string') throw new RangeError('hidden.fallback: ' + P);
    var mk = PX.ex.paramsKey(params);
    if (!(mk in fallbackMemo)) {
      fallbackMemo[mk] = null;
      for (var i = 0; i < 400 && !fallbackMemo[mk]; i++) {
        var it = attempt(PX.rng(PX.rng.hash('hidden-fallback', mk, i)), P, params, 0);
        if (it && validate(it) === true) fallbackMemo[mk] = it;
      }
    }
    if (!fallbackMemo[mk]) throw new Error('hidden.fallback: no item for ' + mk);
    var out = PX.util.deepCopy(fallbackMemo[mk]);
    out.seed = seed === undefined ? 0 : seed;
    return out;
  }

  /* ------------------------------------------------------------ validate (independent) */
  function numeric(a, b) { return a - b; }
  function segText(list) { return list.map(function (s) { return s.join(' '); }).sort().join('|'); }
  // The shape rules, from a segment set alone (no walk): one line or one loop, no branch, no X,
  // within 3 × 3, two directions, no straight run of 3, enough turns.
  function shapeProblem(keys) {
    var n = keys.length, i;
    if (n < 3 || n > 6) return 'a shape must have 3 to 6 segments';
    var b = box(keys);
    if (b.w > MAXBOX || b.h > MAXBOX) return 'a shape is larger than 3 × 3';
    var set = {}, cells = {}, cls = {}, deg = {}, adj = {}, nc = 0;
    for (i = 0; i < n; i++) {
      var k = keys[i], c = kc(k);
      if (set[k]) return 'a shape repeats a segment';
      set[k] = true;
      if (!cls[c]) { cls[c] = true; nc++; }
      if (c >= 2) {
        if (cells[k >> 2] !== undefined) return 'a shape crosses itself';
        cells[k >> 2] = c;
      }
      ends(k).forEach(function (p, j, e) {
        var v = vkey(p);
        deg[v] = (deg[v] || 0) + 1;
        (adj[v] = adj[v] || []).push(vkey(e[1 - j]));
      });
    }
    if (nc < 2) return 'a shape needs two directions';
    var vs = Object.keys(deg), leaves = 0, turns = 0;
    for (i = 0; i < vs.length; i++) {
      if (deg[vs[i]] > 2) return 'a shape branches';
      if (deg[vs[i]] === 1) leaves++;
    }
    if (leaves !== 0 && leaves !== 2) return 'a shape is not a single line';
    var reached = {}, stack = [vs[0]], nr = 0;
    while (stack.length) {
      var v0 = stack.pop();
      if (reached[v0]) continue;
      reached[v0] = true;
      nr++;
      adj[v0].forEach(function (w) { if (!reached[w]) stack.push(String(w)); });
    }
    if (nr !== vs.length) return 'a shape is in pieces';
    for (i = 0; i < n; i++) {
      var r1 = moved(keys[i], RUN[kc(keys[i])][0], RUN[kc(keys[i])][1]), r2 = r1 < 0 ? -1 : moved(r1, RUN[kc(keys[i])][0], RUN[kc(keys[i])][1]);
      if (r1 >= 0 && r2 >= 0 && set[r1] && set[r2]) return 'a shape has a straight run of 3';
    }
    // Turns: points where two segments of different directions meet.
    var byV = {};
    keys.forEach(function (k) { ends(k).forEach(function (p) { (byV[vkey(p)] = byV[vkey(p)] || []).push(kc(k)); }); });
    Object.keys(byV).forEach(function (v) { if (byV[v].length === 2 && byV[v][0] !== byV[v][1]) turns++; });
    if (turns < (n >= 4 ? 2 : 1)) return 'a shape needs more turns';
    return null;
  }
  function validate(item) {
    try { return check(item); } catch (e) { return 'validate failed: ' + (e && e.message); }
  }
  function check(item) {
    if (!item || typeof item !== 'object' || item.ex !== 'hidden') return 'not a hidden item';
    var P = resolve(item.params);
    if (typeof P === 'string') return P;
    var N = P.N, i, j, k, dx, dy;
    if (item.grid !== N) return 'grid ' + item.grid + ' does not match size level ' + P.zi;
    if (!Array.isArray(item.figure)) return 'the figure must be a list of segments';
    var has = new Uint8Array(W * W * 4), fk = [];
    for (i = 0; i < item.figure.length; i++) {
      k = keyOfSeg(item.figure[i]);
      if (k < 0) return 'figure segment ' + i + ' is not a unit segment';
      if (kx(k) + EXT[kc(k)][0] > N || ky(k) + EXT[kc(k)][1] > N) return 'figure segment ' + i + ' leaves the grid';
      if (has[k]) return 'figure segment ' + i + ' is drawn twice';
      has[k] = 1;
      fk.push(k);
    }
    // The options: shapes, normalised, distinct, equal direction counts.
    if (!Array.isArray(item.options) || item.options.length !== NOPT) return 'there must be 5 options';
    var sets = [], ids = {};
    for (i = 0; i < NOPT; i++) {
      var o = item.options[i];
      if (!o || !Array.isArray(o.segs)) return 'option ' + i + ' has no segments';
      var ks = o.segs.map(keyOfSeg);
      if (ks.some(function (x) { return x < 0; })) return 'option ' + i + ' has a segment that is not a unit segment';
      var b = box(ks);
      if (b.x0 !== 0 || b.y0 !== 0 || o.w !== b.w || o.h !== b.h) return 'option ' + i + ' is not normalised';
      var sp = shapeProblem(ks);
      if (sp) return 'option ' + i + ': ' + sp;
      var id = ks.slice().sort(numeric).join(',');
      if (ids[id] !== undefined) return 'options ' + ids[id] + ' and ' + i + ' are the same shape';
      ids[id] = i;
      sets.push(ks);
    }
    var n = sets[0].length, cc = classCounts(sets[0]).join(',');
    for (i = 1; i < NOPT; i++) {
      if (sets[i].length !== n) return 'the options have different numbers of segments';
      if (classCounts(sets[i]).join(',') !== cc) return 'the options have different direction counts';
    }
    if (n < NSEG[P.si][0] || n > NSEG[P.si][1] || item.n !== n) return n + ' segments per option is outside the range of the level';
    if (fk.length !== n + P.E || item.extra !== P.E) return 'the figure must hold the shape and ' + P.E + ' extra segments';
    if (!isInt(item.key) || item.key < 0 || item.key >= NOPT) return 'key must be an option index';
    // Every translation of every option: placements and best overlaps.
    var count = [], first = [], best = [], bestAt = [];
    for (i = 0; i < NOPT; i++) {
      var bi = box(sets[i]);
      count.push(0); first.push(null); best.push(-1); bestAt.push(null);
      for (dx = -bi.w; dx <= N; dx++) {
        for (dy = -bi.h; dy <= N; dy++) {
          var present = 0;
          for (j = 0; j < n; j++) { var m = moved(sets[i][j], dx, dy); if (m >= 0 && has[m]) present++; }
          if (present === n) { count[i]++; if (!first[i]) first[i] = [dx, dy]; }
          if (dx >= 0 && dy >= 0 && dx + bi.w <= N && dy + bi.h <= N && present > best[i]) { best[i] = present; bestAt[i] = [dx, dy]; }
        }
      }
    }
    for (i = 0; i < NOPT; i++) {
      if (i === item.key && count[i] !== 1) return 'the key is embedded ' + count[i] + ' times';
      if (i !== item.key && count[i] !== 0) return 'option ' + i + ' is embedded as well';
    }
    var pl = item.place, at = first[item.key];
    if (!Array.isArray(pl) || pl[0] !== at[0] || pl[1] !== at[1]) return 'place is not where the key is';
    if (!Array.isArray(item.near) || item.near.length !== NOPT) return 'near must describe the 5 options';
    for (i = 0; i < NOPT; i++) {
      var nr = item.near[i], ba = bestAt[i];
      if (!nr || !Array.isArray(nr.at) || nr.at[0] !== ba[0] || nr.at[1] !== ba[1] || !Array.isArray(nr.missing)) return 'near[' + i + '] is not the best overlap';
      var miss = sets[i].map(function (q) { return moved(q, ba[0], ba[1]); }).filter(function (q) { return !has[q]; }).map(seg);
      if (segText(miss) !== segText(nr.missing)) return 'near[' + i + '] lists the wrong missing segments';
    }
    // The key's copy shares two or more points with other lines.
    var copy = {}, kv = {}, sharedN = 0;
    sets[item.key].forEach(function (q) {
      var mq = moved(q, pl[0], pl[1]);
      copy[mq] = true;
      ends(mq).forEach(function (p) { kv[vkey(p)] = false; });
    });
    fk.forEach(function (q) {
      if (copy[q]) return;
      ends(q).forEach(function (p) { if (kv[vkey(p)] === false) kv[vkey(p)] = true; });
    });
    Object.keys(kv).forEach(function (v) { if (kv[v]) sharedN++; });
    if (sharedN < 2) return 'the key shares only ' + sharedN + ' point(s) with other lines';
    // Connected, at most 4 segments at a point, spread.
    var deg = {}, adj = {};
    fk.forEach(function (q) {
      var e = ends(q), a = vkey(e[0]), c2 = vkey(e[1]);
      deg[a] = (deg[a] || 0) + 1; deg[c2] = (deg[c2] || 0) + 1;
      (adj[a] = adj[a] || []).push(c2); (adj[c2] = adj[c2] || []).push(a);
    });
    var vs = Object.keys(deg);
    for (i = 0; i < vs.length; i++) if (deg[vs[i]] > MAXDEG) return 'more than ' + MAXDEG + ' segments meet at a point';
    var seenV = {}, stack = [vs[0]], nv = 0;
    while (stack.length) {
      var v = stack.pop();
      if (seenV[v]) continue;
      seenV[v] = true;
      nv++;
      adj[v].forEach(function (w) { if (!seenV[w]) stack.push(String(w)); });
    }
    if (nv !== vs.length) return 'the figure is in pieces';
    var fb = box(fk), spread = Math.min(fb.w, fb.h);
    if (spread < reachOf(P.E, N) - 1) return 'the figure spreads over only ' + spread + ' cells';
    var sim = meanShare(sets);
    if (!(sim >= BANDS[P.si][0] && sim < BANDS[P.si][1])) return 'similarity ' + sim.toFixed(3) + ' is outside the band for ' + SIMS[P.si];
    if (!(Math.abs(item.sim - sim) < 0.0006)) return 'sim does not match the options';
    return true;
  }

  /* ------------------------------------------------------------ score, shortcut solvers */
  function score(item, response) {
    var ok = response === item.key;
    return { correct: ok, value: ok ? 1 : 0 };
  }
  // Pick weights for "the option with the highest (or lowest) score", ties split evenly.
  function pickWeights(scores, higher) {
    var best = scores[0], i, ties = 0;
    for (i = 1; i < scores.length; i++) if (higher ? scores[i] > best + 1e-9 : scores[i] < best - 1e-9) best = scores[i];
    for (i = 0; i < scores.length; i++) if (Math.abs(scores[i] - best) <= 1e-9) ties++;
    return scores.map(function (s) { return Math.abs(s - best) <= 1e-9 ? 1 / ties : 0; });
  }
  function optionSets(item) { return item.options.map(function (o) { return o.segs.map(keyOfSeg); }); }
  function figureSet(item) { var h = new Uint8Array(W * W * 4); item.figure.forEach(function (s) { var k = keyOfSeg(s); if (k >= 0) h[k] = 1; }); return h; }
  function totals(sets) {
    return sets.map(function (a, i) {
      var t = 0;
      sets.forEach(function (b, j) { if (i !== j) t += share(a, b); });
      return t;
    });
  }
  // Each solver maps an item to pick weights over the five options (its accuracy is the weight on
  // the key). The first six never look for the shape; bestOverlap is the honest solution.
  var solvers = {
    mostSegments: function (item) { return pickWeights(item.options.map(function (o) { return o.segs.length; }), true); },
    fewestSegments: function (item) { return pickWeights(item.options.map(function (o) { return o.segs.length; }), false); },
    histogram: function (item) {
      var fh = classCounts(item.figure.map(keyOfSeg)), ft = item.figure.length;
      return pickWeights(optionSets(item).map(function (s) {
        var h = classCounts(s), d = 0;
        for (var c = 0; c < 4; c++) d += Math.abs(h[c] / s.length - fh[c] / ft);
        return d;
      }), false);
    },
    mostLikeOthers: function (item) { return pickWeights(totals(optionSets(item)), true); },
    oddOneOut: function (item) { return pickWeights(totals(optionSets(item)), false); },
    largest: function (item) { return pickWeights(item.options.map(function (o) { return o.w * o.h; }), true); },
    // Stem-aware, partial: the share of the option's touching segment pairs found somewhere in the
    // figure in the same relative position.
    localPairs: function (item) {
      var has = figureSet(item), fig = item.figure.map(keyOfSeg);
      return pickWeights(optionSets(item).map(function (s) {
        var pairs = 0, found = 0;
        for (var a = 0; a < s.length; a++) {
          for (var b = a + 1; b < s.length; b++) {
            var ea = ends(s[a]), eb = ends(s[b]), touch = false;
            ea.forEach(function (p) { eb.forEach(function (q) { if (p[0] === q[0] && p[1] === q[1]) touch = true; }); });
            if (!touch) continue;
            pairs++;
            for (var f = 0; f < fig.length; f++) {
              if (kc(fig[f]) !== kc(s[a])) continue;
              var mb = moved(s[b], kx(fig[f]) - kx(s[a]), ky(fig[f]) - ky(s[a]));
              if (mb >= 0 && has[mb]) { found++; break; }
            }
          }
        }
        return pairs ? found / pairs : 0;
      }), true);
    },
    bestOverlap: function (item) {
      var has = figureSet(item);
      return pickWeights(optionSets(item).map(function (s) {
        var best = 0;
        for (var dx = 0; dx <= item.grid; dx++) {
          for (var dy = 0; dy <= item.grid; dy++) {
            var c = 0;
            for (var i = 0; i < s.length; i++) { var m = moved(s[i], dx, dy); if (m >= 0 && has[m]) c++; }
            if (c > best) best = c;
          }
        }
        return best / s.length;
      }), true);
    },
  };

  PX.ex.define({
    id: 'hidden', version: 1, code: 'EX-10', name: 'Hidden Shapes', short: 'Hidden',
    abilities: ['CF'], cell: 'intrinsic-static', role: 'train', answer: 'choice', nOptions: NOPT,
    dims: [
      { key: 'extra', label: 'Extra lines', levels: EXTRAS.slice(), step: DIFF.extra },
      { key: 'sim', label: 'Candidate similarity', levels: SIMS.slice(), step: DIFF.sim },
      { key: 'size', label: 'Figure size', levels: SIZES.slice(), step: DIFF.size },
    ],
    base: DIFF.base,
    timeLimit: function () { return null; },
    generate: generate,
    validate: validate,
    score: score,
    lib: Object.freeze({
      STATS: STATS, EXTRAS: EXTRAS, SIMS: SIMS, SIZES: SIZES, BANDS: BANDS, NSEG: NSEG, DIFF: DIFF, MAXBOX: MAXBOX,
      keyOfSeg: keyOfSeg, seg: seg, ends: ends, box: box, normalize: normalize, moved: moved, share: share,
      meanShare: meanShare, classCounts: classCounts, walk: walk, shapeProblem: shapeProblem,
      resolve: resolve, reachOf: reachOf, solvers: solvers, fallback: fallbackItem, attempt: attempt,
    }),
  });
})(window.PX);
