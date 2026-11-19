/* PR-1 Cube Match (probe), version 2 (v1.2, W2-measure; PLAN milestone 6's probe upgrades, note M1 §4.3): which of four
   drawings shows the reference cube, turned? One option is the cube turned by a turn of the level's class; each of the
   other three is a turned drawing with one difference of the level's kind (two drawn faces swapped, or one shared
   symbol turned), so no cube that agrees with the reference fits it. Against cheap answers (tests/node/cubematch.test):
   where the class has four or more turns (quarter, two-step), every option comes from a different turn, so the key is
   not the centre of the others; for spin (two turns) and flip (three) the options come as two pairs one difference
   apart (the key and a foil on one turn; a foil and a second foil made from it on another turn), so both pairs look
   alike. Version 1 (1.0–1.1) asked "same or different?" of one pair of drawings; its range is in def.past, and the
   trend keeps the two versions apart (CONTRACT-v1.2; js/engine/trend.js). The notes below describe the shared
   machinery (cube, symbols, turns, differences, the independent solver).

   Version 1's task, kept for the record: are two drawings of a cube with oriented symbols the same cube?
   Pure (ARCHITECTURE.md §5); PLAN.md §4; research/B-tasks.md §3 and §14b (P1). Never trained, no feedback.

   Task. A cube carries six different symbols, one per face, each with a visible orientation. Two drawings
   each show three faces (top, front, right). Answer true ("same cube": the second drawing is the first
   cube turned) or false ("different": no turn of any cube that agrees with the first drawing gives the
   second; faces hidden in the first drawing may carry any of the other symbols, in any orientation).
   key: true = same cube. Responses: true / false.

   Coordinates. y up, z toward the viewer, x to the right; a drawing looks at the corner (+x, +y, +z).
   Face directions by index: 0 +x, 1 −x, 2 +y, 3 −y, 4 +z, 5 −z. Drawn faces in face coordinates
   (u to the right, v up, as seen from outside the cube; u × v = the outward normal):
     top (+y): u = +x, v = −z      front (+z): u = +x, v = +y      right (+x): u = −z, v = +y
   A symbol's rot (0, 90, 180 or 270) is its clockwise turn in those coordinates: rot 90 means the top of
   the symbol points along +u. To draw: glyph point (x, y) → (x c + y s, −x s + y c) with c = cos rot,
   s = sin rot; then face point = face centre + scale × (x' u + y' v); then the isometric projection.

   Glyphs: lib.GLYPHS[id].lines, polylines on a unit lattice centred on their bounding box (|x|, |y| ≤ 2),
   x right, y up; every stroke is horizontal, vertical or at 45°. Three pools set the confusability:
   'shapes' (pictograms), 'letters' (letters and digits), 'similar' (one stem-and-top-bar family). Measured in
   unit strokes on the lattice (edgeDist): no glyph has a turn symmetry (a turn by 90, 180 or 270 changes
   at least MIN_TURN strokes), and two glyphs of a pool differ under every relative turn by at least
   MIN_PAIR[pool] strokes, so no symbol can pass for another one turned.

   Rotation levels (the turn from drawing 1 to drawing 2; "shared" = faces, so symbols, seen in both):
     spin    120° about the viewing diagonal: the three faces trade places (3 shared)
     quarter 90° about a face axis: one shared face stays in place, the other moves (2 shared)
     flip    180° about an edge axis: the two shared faces trade places (2 shared)
     one     one shared face: 180° about its axis (it stays in place, upside down; 3 of the 9 turns) or
             120° about a body diagonal other than the viewing one (it moves; 6 of 9). The two are one
             level on purpose: a swap turns either look into the other, so as separate levels "the shared
             symbol moved" would give the answer away (same items keep it in place 1/3 of the time,
             and so do swapped ones).
   No level has 0 shared faces: any three symbols not in the first drawing fit its three hidden faces, so
   a "different" item without a shared symbol cannot exist (B-tasks §3) and such a level would always be
   "same". Swaps at 3 and 2 shared faces give arrangements no turn can make (the classic position error);
   turns keep the arrangement and differ only in orientation.
   Differences (false items; the symbols shown stay the same set as in the true drawing, so counting
   shared symbols never tells): 'swap' exchanges two drawn faces of the second drawing (symbol and rot
   together; at least one of them is shared); 'turn' turns one shared symbol by 90, 180 or 270.

   Item (JSON):
     { ex: 'cubematch', seed, params, key: true | false,
       pool: 'shapes' | 'letters' | 'similar', symbols: [the six glyph ids on the cube],
       views: [{ top: { sym, rot }, front: { sym, rot }, right: { sym, rot } }, { … }],
       cube: [{ sym, up: [x, y, z] } for faces 0–5],  the first drawing's cube (up = where the symbol's top points)
       turn: { cls, m: [9 numbers, row-major] },       world of drawing 2 = m · world of drawing 1
       change: null | { kind: 'swap', slots: [a, b] } | { kind: 'turn', slot, by } }
   validate (independent of the generator's cube): rebuilds the 24 rotations by search from two quarter
   turns and matches faces as sticker points (face centre and symbol top) between the drawings; "same"
   exactly when some rotation fits, and then the fitting rotation is unique and of the level's class. */
(function (PX) {
  'use strict';

  /* ------------------------------------------------------------------ glyphs */
  // Source polylines on a lattice (x right, y up); centred and checked at load.
  var SRC = {
    shapes: {
      arrow: [[[0, 2], [4, 2]], [[2, 4], [4, 2], [2, 0]]],
      flag: [[[0, 0], [0, 4], [2, 4], [0, 2]]],
      hook: [[[3, 4], [3, 1], [2, 0], [1, 0], [0, 1]]],
      bell: [[[0, 0], [4, 0]], [[1, 0], [1, 3], [2, 4], [3, 3], [3, 0]]],
      boot: [[[1, 4], [1, 0], [4, 0], [4, 1], [2, 1]]],
      step: [[[0, 0], [0, 2], [2, 2], [2, 4], [4, 4]]],
      tee: [[[0, 4], [4, 4]], [[2, 4], [2, 0]]],
      fork: [[[2, 0], [2, 2], [0, 4]], [[2, 2], [4, 4]]],
      axe: [[[0, 0], [3, 3]], [[2, 4], [4, 2]]],
    },
    letters: {
      F: [[[2, 4], [0, 4], [0, 0]], [[0, 2], [2, 2]]],
      G: [[[2, 4], [0, 4], [0, 0], [2, 0], [2, 2], [1, 2]]],
      J: [[[1, 4], [2, 4], [2, 0], [0, 0], [0, 1]]],
      K: [[[0, 4], [0, 0]], [[2, 4], [0, 2], [2, 0]]],
      L: [[[0, 4], [0, 0], [2, 0]]],
      R: [[[0, 0], [0, 4], [2, 4], [2, 2], [0, 2]], [[1, 2], [2, 1], [2, 0]]],
      seven: [[[0, 4], [2, 4], [2, 3], [0, 1], [0, 0]]],
      four: [[[2, 0], [2, 4], [0, 2], [3, 2]]],
      Y: [[[0, 4], [1, 3], [2, 4]], [[1, 3], [1, 0]]],
      r: [[[0, 0], [0, 3]], [[0, 2], [1, 3], [2, 3]]],
      t: [[[1, 4], [1, 0], [2, 0]], [[0, 3], [2, 3]]],
    },
    // One family (a stem with a top bar, plus one part), every two at least 3 strokes apart: only two of
    // them differ by a bar's height alone (sLow, sHigh: two units apart), so an item never hinges on a
    // one-unit shift of a short bar (validity review, 6 Nov).
    similar: {
      sHook: [[[0, 0], [0, 4], [2, 4], [2, 3]]],
      sArmHook: [[[0, 0], [0, 4], [2, 4]], [[0, 2], [2, 2], [2, 1]]],
      sE: [[[0, 0], [0, 4], [2, 4]], [[0, 2], [1, 2]], [[0, 0], [1, 0]]],
      sP: [[[0, 0], [0, 4], [2, 4], [2, 2], [0, 2]]],
      sLow: [[[0, 0], [0, 4], [2, 4]], [[0, 1], [2, 1]]],
      sHigh: [[[0, 0], [0, 4], [2, 4]], [[0, 3], [2, 3]]],
      sDiag: [[[0, 0], [0, 4], [2, 4]], [[0, 2], [2, 0]]],
      sLeg: [[[0, 0], [0, 4], [2, 4]], [[0, 2], [1, 2], [1, 0]]],
    },
  };
  var POOL_KEYS = ['shapes', 'letters', 'similar'];
  var MIN_PAIR = { shapes: 6, letters: 4, similar: 3 };
  var MIN_TURN = 4;

  function ekey(a, b) {
    return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? a[0] + ',' + a[1] + ',' + b[0] + ',' + b[1] : b[0] + ',' + b[1] + ',' + a[0] + ',' + a[1];
  }
  // Unit strokes in doubled coordinates (so centring on a half-unit stays integral).
  function strokes(lines2) {
    var set = {};
    lines2.forEach(function (l) {
      for (var i = 1; i < l.length; i++) {
        var x = l[i - 1][0], y = l[i - 1][1], X = l[i][0], Y = l[i][1];
        var dx = Math.sign(X - x) * 2, dy = Math.sign(Y - y) * 2, n = Math.max(Math.abs(X - x), Math.abs(Y - y)) / 2;
        if (!(x === X || y === Y || Math.abs(X - x) === Math.abs(Y - y))) throw new Error('cubematch: glyph stroke not on the lattice');
        for (var k = 0; k < n; k++) { set[ekey([x, y], [x + dx, y + dy])] = true; x += dx; y += dy; }
      }
    });
    return set;
  }
  // k clockwise quarter turns: (x, y) → (y, −x).
  function turnSet(set, k) {
    var out = {};
    Object.keys(set).forEach(function (s) {
      var p = s.split(',').map(Number), a = [p[0], p[1]], b = [p[2], p[3]];
      for (var i = 0; i < k; i++) { a = [a[1], -a[0]]; b = [b[1], -b[0]]; }
      out[ekey(a, b)] = true;
    });
    return out;
  }
  function edgeDist(A, B) {
    var n = 0, k;
    for (k in A) if (!B[k]) n++;
    for (k in B) if (!A[k]) n++;
    return n;
  }

  var GLYPHS = {}, POOLS = {};
  POOL_KEYS.forEach(function (pool) {
    POOLS[pool] = Object.keys(SRC[pool]);
    POOLS[pool].forEach(function (id) {
      var src = SRC[pool][id], xs = [], ys = [];
      src.forEach(function (l) { l.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
      var cx2 = Math.min.apply(null, xs) + Math.max.apply(null, xs), cy2 = Math.min.apply(null, ys) + Math.max.apply(null, ys);
      var lines2 = src.map(function (l) { return l.map(function (p) { return [2 * p[0] - cx2, 2 * p[1] - cy2]; }); });
      var base = strokes(lines2);
      GLYPHS[id] = {
        id: id, pool: pool,
        lines: lines2.map(function (l) { return l.map(function (p) { return [p[0] / 2, p[1] / 2]; }); }),
        turned: [0, 1, 2, 3].map(function (k) { return turnSet(base, k); }),
      };
    });
  });
  // Strokes that differ between glyph a turned by k quarter turns and glyph b (unturned).
  function strokeDiff(a, k, b) { return edgeDist(GLYPHS[a].turned[((k % 4) + 4) % 4], GLYPHS[b].turned[0]); }
  // Smallest difference between two glyphs under any relative turn.
  function glyphDist(a, b) {
    var m = Infinity;
    for (var k = 0; k < 4; k++) m = Math.min(m, strokeDiff(a, k, b));
    return m;
  }

  /* ------------------------------------------------------------------ cube geometry */
  var DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  var SLOTS = ['top', 'front', 'right'];
  var SLOT_DIR = { top: 2, front: 4, right: 0 };
  var FRAME = { top: { u: [1, 0, 0], v: [0, 0, -1] }, front: { u: [1, 0, 0], v: [0, 1, 0] }, right: { u: [0, 0, -1], v: [0, 1, 0] } };
  var ROT_LEVELS = ['spin', 'quarter', 'flip', 'one'];
  var LEVEL_CLASSES = { spin: ['spin'], quarter: ['quarter'], flip: ['flip'], one: ['half', 'corner'] };
  var SHARED = { spin: 3, quarter: 2, flip: 2, one: 1 };
  var CHANGE_LEVELS = ['swap', 'turn'];
  var I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  function mv(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
  function mt(M) { return [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]]; }
  function mm(A, B) {
    var C = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) C.push(A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]);
    return C;
  }
  function eq3(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
  function neg(a) { return [-a[0], -a[1], -a[2]]; }
  function dirIndex(v) { for (var i = 0; i < 6; i++) if (eq3(DIRS[i], v)) return i; return -1; }
  function perpDirs(f) { return DIRS.filter(function (d) { return d[0] * DIRS[f][0] + d[1] * DIRS[f][1] + d[2] * DIRS[f][2] === 0; }); }

  // The 24 rotations as signed permutation matrices with determinant +1.
  var ROTS = (function () {
    var perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]], out = [];
    perms.forEach(function (p) {
      for (var s = 0; s < 8; s++) {
        var M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (var i = 0; i < 3; i++) M[i * 3 + p[i]] = (s >> i) & 1 ? -1 : 1;
        var det = M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);
        if (det === 1) out.push(M);
      }
    });
    return out;
  })();
  // Class of a turn (world of drawing 2 = M · world of drawing 1), or null (identity; 0 shared faces).
  function classOf(M) {
    var tr = M[0] + M[4] + M[8], MT = mt(M), shared = 0;
    SLOTS.forEach(function (s) { if (SLOTS.some(function (t) { return eq3(mv(MT, DIRS[SLOT_DIR[s]]), DIRS[SLOT_DIR[t]]); })) shared++; });
    if (tr === 3 || shared === 0) return null;
    if (tr === 1) return 'quarter';
    if (tr === 0) return shared === 3 ? 'spin' : 'corner';
    return shared === 2 ? 'flip' : 'half';
  }
  // Turns per level (the 'one' level draws uniformly from its 9 turns).
  var CLASS_ROTS = {};
  ROT_LEVELS.forEach(function (lv) { CLASS_ROTS[lv] = ROTS.filter(function (M) { return LEVEL_CLASSES[lv].indexOf(classOf(M)) >= 0; }); });

  // Where a symbol's top points (world) ↔ its clockwise turn in a drawn face.
  function slotRot(slot, up) {
    var F = FRAME[slot];
    return eq3(up, F.v) ? 0 : eq3(up, F.u) ? 90 : eq3(up, neg(F.v)) ? 180 : eq3(up, neg(F.u)) ? 270 : -1;
  }
  function upOf(slot, rot) {
    var F = FRAME[slot];
    return rot === 0 ? F.v : rot === 90 ? F.u : rot === 180 ? neg(F.v) : neg(F.u);
  }
  function drawView(cube, M) {
    var MT = mt(M), out = {};
    SLOTS.forEach(function (s) {
      var f = dirIndex(mv(MT, DIRS[SLOT_DIR[s]]));
      out[s] = { sym: cube[f].sym, rot: slotRot(s, mv(M, cube[f].up)) };
    });
    return out;
  }
  function sameView(a, b) { return SLOTS.every(function (s) { return a[s].sym === b[s].sym && a[s].rot === b[s].rot; }); }
  function inView(v, sym) { return SLOTS.some(function (s) { return v[s].sym === sym; }); }

  /* ------------------------------------------------------------------ consistency (generator side) */
  function facts(view) {
    var out = {};
    SLOTS.forEach(function (s) { out[SLOT_DIR[s]] = { sym: view[s].sym, up: upOf(s, view[s].rot) }; });
    return out;
  }
  // Turns that carry some cube agreeing with drawing v1 onto drawing v2.
  function fits(v1, v2) {
    var f1 = facts(v1), f2 = facts(v2), shown = {};
    SLOTS.forEach(function (s) { shown[v1[s].sym] = true; });
    return ROTS.filter(function (M) {
      var MT = mt(M);
      return SLOTS.every(function (s) {
        var d2 = SLOT_DIR[s], a = f1[dirIndex(mv(MT, DIRS[d2]))], b = f2[d2];
        if (!a) return !shown[b.sym];
        return a.sym === b.sym && eq3(mv(MT, b.up), a.up);
      });
    });
  }

  /* ------------------------------------------------------------------ independent solver (validate) */
  // The 24 rotations again, by breadth-first search from quarter turns about x and y.
  var VROTS = (function () {
    var gens = [[1, 0, 0, 0, 0, -1, 0, 1, 0], [0, 0, 1, 0, 1, 0, -1, 0, 0]], list = [I3], seen = {};
    seen[I3.join()] = true;
    for (var i = 0; i < list.length; i++) {
      gens.forEach(function (g) {
        var n = mm(g, list[i]);
        if (!seen[n.join()]) { seen[n.join()] = true; list.push(n); }
      });
    }
    return list;
  })();
  // A drawn face as two sticker points: its centre (the outward normal) and the symbol's top (centre + up).
  function stickers(view) {
    return SLOTS.map(function (s) {
      var c = DIRS[SLOT_DIR[s]], up = upOf(s, view[s].rot);
      return { sym: view[s].sym, c: c, t: [c[0] + up[0], c[1] + up[1], c[2] + up[2]] };
    });
  }
  // Every rotation R (drawing-2 world = R · drawing-1 world) under which drawing 2 can show the cube of drawing 1.
  function solve(v1, v2) {
    var a = stickers(v1), b = stickers(v2), shown = {}, hits = [];
    a.forEach(function (x) { shown[x.sym] = true; });
    VROTS.forEach(function (R) {
      var ok = b.every(function (y) {
        var from = null;
        a.forEach(function (x) { if (eq3(mv(R, x.c), y.c)) from = x; });
        if (!from) return !shown[y.sym];          // a face hidden in drawing 1: any other symbol fits it
        return from.sym === y.sym && eq3(mv(R, from.t), y.t);
      });
      if (ok) hits.push(R);
    });
    return hits;
  }

  /* ------------------------------------------------------------------ generate */
  function lvl(params, key, n) { var v = params ? params[key] : 0; return Number.isInteger(v) && v >= 0 && v < n ? v : 0; }
  function cleanParams(params) {
    return { rotation: lvl(params, 'rotation', ROT_LEVELS.length), change: lvl(params, 'change', CHANGE_LEVELS.length), glyphs: lvl(params, 'glyphs', POOL_KEYS.length) };
  }
  function copyView(v) { var o = {}; SLOTS.forEach(function (s) { o[s] = { sym: v[s].sym, rot: v[s].rot }; }); return o; }

  // A false second drawing: the first candidate change (in random order) that no cube fits.
  function alter(r, v1, v2, kind) {
    var cands = [];
    if (kind === 'swap') {
      [['top', 'front'], ['top', 'right'], ['front', 'right']].forEach(function (pr) {
        if (inView(v1, v2[pr[0]].sym) || inView(v1, v2[pr[1]].sym)) cands.push({ kind: 'swap', slots: pr });
      });
    } else {
      SLOTS.forEach(function (s) {
        if (!inView(v1, v2[s].sym)) return;     // a symbol never seen before may point anywhere
        [90, 180, 270].forEach(function (by) {
          if (strokeDiff(v2[s].sym, by / 90, v2[s].sym) >= MIN_TURN) cands.push({ kind: 'turn', slot: s, by: by });
        });
      });
    }
    cands = r.shuffle(cands);
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i], v = copyView(v2);
      if (c.kind === 'swap') { var t = v[c.slots[0]]; v[c.slots[0]] = v[c.slots[1]]; v[c.slots[1]] = t; }
      else v[c.slot].rot = (v[c.slot].rot + c.by) % 360;
      if (!fits(v1, v).length) return { change: c, view: v };
    }
    return null;
  }

  var N_OPT = 4;
  // What a glance at one option against the reference gives without turning anything: how many shared symbols sit
  // in their reference slot, and how many point as they did there. A foil keeps its own turned drawing's values, so
  // these never single out the key. Spin and flip with swaps are tight: three faces (spin) or two traded faces (flip)
  // leave few arrangements, so a spin swap takes two swaps to keep the first value, and the pairs still make "how
  // like the other options" find the key about half the time at those two cells (a scoped exception, DECISIONS
  // 2026-11-19; tests/node/cubematch.test.mjs reports them; pooled over the probe every cheap answer stays within
  // chance + 10 points, as in version 1).
  function feats(ref, v) {
    var st = 0, la = 0;
    SLOTS.forEach(function (s2) {
      var at = null;
      SLOTS.forEach(function (u) { if (ref[u].sym === v[s2].sym) at = u; });
      if (at === null) return;
      if (at === s2) st++;
      if (ref[at].rot === v[s2].rot) la++;
    });
    return st + ':' + la;
  }
  function rotsInPlace(ref, v) { return SLOTS.filter(function (s2) { return v[s2].rot === ref[s2].rot; }).length; }
  function applyChange(v, c) {
    var o = copyView(v);
    if (c.kind === 'swap') { var t = o[c.slots[0]]; o[c.slots[0]] = o[c.slots[1]]; o[c.slots[1]] = t; }
    else o[c.slot].rot = (o[c.slot].rot + c.by) % 360;
    return o;
  }
  // A foil from drawing v (base: the turned drawing whose glance values it must keep): one difference of the kind,
  // or for swaps, when no single one keeps the values, two. Returns { view, changes } or null.
  function alterLike(r, ref, v, base, kind, plain) {
    var want = feats(ref, base), singles = [];
    if (kind === 'swap') {
      [['top', 'front'], ['top', 'right'], ['front', 'right']].forEach(function (pr) {
        if (inView(ref, v[pr[0]].sym) || inView(ref, v[pr[1]].sym)) singles.push({ kind: 'swap', slots: pr });
      });
    } else {
      SLOTS.forEach(function (s2) {
        if (!inView(ref, v[s2].sym)) return;     // a symbol never seen before may point anywhere
        [90, 180, 270].forEach(function (by) {
          if (strokeDiff(v[s2].sym, by / 90, v[s2].sym) >= MIN_TURN) singles.push({ kind: 'turn', slot: s2, by: by });
        });
      });
    }
    var cands = r.shuffle(singles).map(function (c) { return [c]; });
    if (plain) { // quarter and two-step turns: one difference, as in version 1 (four different turns already hide the key);
      // first choice for swaps: one that keeps the count of faces turned as in the reference's same place
      for (var pp = 0; pp < 2; pp++) {
        for (var q = 0; q < cands.length; q++) {
          var x = applyChange(v, cands[q][0]);
          if (fits(ref, x).length || (pp === 0 && kind === 'swap' && rotsInPlace(ref, x) !== rotsInPlace(ref, v))) continue;
          return { view: x, changes: [cands[q][0]] };
        }
      }
      return null;
    }
    if (kind === 'swap') {
      var doubles = [];
      singles.forEach(function (a) { singles.forEach(function (b) { if (a !== b) doubles.push([a, b]); }); });
      cands = cands.concat(r.shuffle(doubles));
    }
    var spinSwap = kind === 'swap' && SLOTS.every(function (s2) { return inView(ref, base[s2].sym); }) && feats(ref, base).charAt(0) === '0';
    for (var pass = 0; pass < (spinSwap ? 2 : 1); pass++) {
      for (var i = 0; i < cands.length; i++) {
        var w = v;
        cands[i].forEach(function (c) { w = applyChange(w, c); });
        if (sameView(w, v) || fits(ref, w).length) continue;
        var f = feats(ref, w);
        if (pass === 0 ? f !== want : f.split(':')[1] !== want.split(':')[1]) continue;
        return { view: w, changes: cands[i].map(function (c) { return c.kind === 'swap' ? { kind: 'swap', slots: c.slots.slice() } : { kind: 'turn', slot: c.slot, by: c.by }; }) };
      }
    }
    return null;
  }
  function generateOnce(r, p) {
    var pool = POOL_KEYS[p.glyphs], cls = ROT_LEVELS[p.rotation], kind = CHANGE_LEVELS[p.change];
    var symbols = r.shuffle(POOLS[pool]).slice(0, 6);
    var cube = symbols.map(function (sym, f) { return { sym: sym, up: r.pick(perpDirs(f)).slice() }; });
    var ref = drawView(cube, I3), rots = CLASS_ROTS[cls], key, i, a;
    var opts = new Array(N_OPT), turns = new Array(N_OPT), changes = new Array(N_OPT);
    if (rots.length >= N_OPT) { // four different turns: the key is not the centre of the others
      var pick = r.shuffle(rots.slice()).slice(0, N_OPT);
      key = r.int(0, N_OPT - 1);
      for (i = 0; i < N_OPT; i++) {
        turns[i] = pick[i];
        var v = drawView(cube, pick[i]);
        if (i === key) { opts[i] = v; changes[i] = null; continue; }
        a = alterLike(r, ref, v, v, kind, true);
        if (!a) return null;
        opts[i] = a.view; changes[i] = a.changes;
      }
    } else { // spin and flip: two pairs one difference apart (the key and a foil; a foil and one made from it)
      var Ma = r.pick(rots), Mb = r.pick(rots.filter(function (M) { return M !== Ma; }));
      var pos = r.shuffle([0, 1, 2, 3]);
      key = pos[0];
      var va = drawView(cube, Ma), vb = drawView(cube, Mb), fa = alterLike(r, ref, va, va, kind), b1 = alterLike(r, ref, vb, vb, kind);
      if (!fa || !b1) return null;
      var b2 = alterLike(r, ref, b1.view, vb, kind);
      if (!b2 || sameView(b2.view, vb)) return null;
      opts[pos[0]] = va; turns[pos[0]] = Ma; changes[pos[0]] = null;
      opts[pos[1]] = fa.view; turns[pos[1]] = Ma; changes[pos[1]] = fa.changes;
      opts[pos[2]] = b1.view; turns[pos[2]] = Mb; changes[pos[2]] = b1.changes;
      opts[pos[3]] = b2.view; turns[pos[3]] = Mb; changes[pos[3]] = b1.changes.concat(b2.changes);
    }
    for (i = 0; i < N_OPT; i++) for (var j = i + 1; j < N_OPT; j++) if (sameView(opts[i], opts[j])) return null;
    return { key: key, pool: pool, symbols: symbols.slice().sort(), ref: ref, options: opts, cube: cube,
      turn: { cls: classOf(turns[key]), m: turns[key].slice() }, turns: turns.map(function (M) { return M.slice(); }), changes: changes };
  }

  /* ------------------------------------------------------------------ validate and score */
  var ROT_VALUES = [0, 90, 180, 270];
  function viewProblem(v, syms, what) {
    var seen = {};
    for (var j = 0; j < 3; j++) {
      var face = v && v[SLOTS[j]];
      if (!face || syms.indexOf(face.sym) < 0) return what + ' shows a symbol that is not on the cube';
      if (ROT_VALUES.indexOf(face.rot) < 0) return what + ' has a bad rot';
      if (seen[face.sym]) return what + ' shows a symbol twice';
      seen[face.sym] = true;
    }
    return null;
  }
  function validate(item) {
    if (!item || item.ex !== 'cubematch') return 'not a cubematch item';
    var p = cleanParams(item.params), pool = POOL_KEYS[p.glyphs], cls = ROT_LEVELS[p.rotation], kind = CHANGE_LEVELS[p.change], syms = item.symbols, i, j, k;
    if (item.pool !== pool) return 'the pool does not match the glyphs level';
    if (!Array.isArray(syms) || syms.length !== 6) return 'a cube needs six symbols';
    for (i = 0; i < 6; i++) {
      if (!GLYPHS[syms[i]] || GLYPHS[syms[i]].pool !== pool) return 'symbol ' + syms[i] + ' is not in the ' + pool + ' pool';
      if (syms.indexOf(syms[i]) !== i) return 'symbol ' + syms[i] + ' is on two faces';
      for (k = 1; k < 4; k++) if (strokeDiff(syms[i], k, syms[i]) < MIN_TURN) return 'symbol ' + syms[i] + ' looks the same turned';
      for (j = i + 1; j < 6; j++) if (glyphDist(syms[i], syms[j]) < MIN_PAIR[pool]) return 'symbols ' + syms[i] + ' and ' + syms[j] + ' are too alike';
    }
    if (!Array.isArray(item.options) || item.options.length !== N_OPT) return 'four options are needed';
    if (!Number.isInteger(item.key) || item.key < 0 || item.key >= N_OPT) return 'the key is not an option';
    var bad = viewProblem(item.ref, syms, 'the reference');
    if (bad) return bad;
    for (i = 0; i < N_OPT; i++) { bad = viewProblem(item.options[i], syms, 'option ' + (i + 1)); if (bad) return bad; }
    if (!Array.isArray(item.cube) || item.cube.length !== 6 || !sameView(drawView(item.cube, I3), item.ref)) return 'the reference does not show the cube';
    for (i = 0; i < N_OPT; i++) {
      var o = item.options[i], shared = SLOTS.filter(function (s2) { return inView(item.ref, o[s2].sym); }).length;
      if (shared !== SHARED[cls]) return 'option ' + (i + 1) + ' shares ' + shared + ' symbols; level ' + cls + ' needs ' + SHARED[cls];
      var hits = solve(item.ref, o);
      if (i === item.key) {
        if (hits.length !== 1) return 'the key fits ' + hits.length + ' turns';
        if (LEVEL_CLASSES[cls].indexOf(classOf(hits[0])) < 0) return 'the key\'s turn is a ' + classOf(hits[0]) + ' turn, not level ' + cls;
        if (!item.turn || !sameView(drawView(item.cube, item.turn.m), o)) return 'the key is not the cube turned';
      } else {
        if (hits.length) return 'option ' + (i + 1) + ' fits a turn of the cube';
        var ch = item.changes && item.changes[i];
        if (!Array.isArray(ch) || !ch.length || !ch.every(function (c) { return c && c.kind === kind; })) return 'option ' + (i + 1) + ' needs a ' + kind + ' difference';
      }
      for (j = i + 1; j < N_OPT; j++) if (sameView(o, item.options[j])) return 'options ' + (i + 1) + ' and ' + (j + 1) + ' are the same drawing';
    }
    return true;
  }

  function score(item, response) { return { correct: Number.isInteger(response) && response === item.key }; }

  var stats = { tries: 0, nulls: 0, invalid: 0, fallbacks: 0, lastInvalid: null };
  function attempt(r, p) {
    stats.tries++;
    var core = generateOnce(r, p);
    if (!core) { stats.nulls++; return null; }
    var item = { ex: 'cubematch', seed: 0, params: p };
    for (var k in core) item[k] = core[k];
    var ok = validate(item);
    if (ok !== true) { stats.invalid++; stats.lastInvalid = ok; return null; }
    return item;
  }
  // Fixed seeds per params (the tests check every combination).
  function fallback(p) {
    stats.fallbacks++;
    for (var k = 0; k < 500; k++) {
      var item = attempt(PX.rng(PX.rng.hash('cubematch-fallback', p.rotation, p.change, p.glyphs, k)), p);
      if (item) { item.fallback = true; return item; }   // the engine voids fallback trials (ARCHITECTURE §5)
    }
    throw new Error('cubematch: no valid item could be built');
  }
  function generate(rng, params) {
    var p = cleanParams(params), item = null;
    for (var i = 0; i < 50 && !item; i++) item = attempt(i === 0 ? rng : rng.fork('retry' + i), p);
    if (!item) item = fallback(p);
    item.seed = rng.seed;
    item.params = params ? PX.util.deepCopy(params) : p;
    return item;
  }

  PX.ex.define({
    id: 'cubematch', version: 2, code: 'PR-1', name: 'Cube Match', short: 'Cube Match',
    abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'probe', answer: 'choice', nOptions: N_OPT,
    format: 'cubematch:symbol-cubes-four-options', // v1.2 (W2-measure): a reserved format, never in training material (tests/node/formats.test.mjs)
    // version 1 (same or different, 1.0–1.1): its difficulty range, so the trend can read 1.1's entries (js/engine/assess.js)
    past: { 1: { min: -2.1, max: 2.1 } },
    // Hand-set item model (DJ, no pilot yet): base + Σ step × level, 4.2 logits wide.
    dims: [
      { key: 'rotation', label: 'Rotation', levels: ['spin, 3 faces shared', 'quarter turn, 2 shared', 'edge flip, 2 shared', 'two-step turn, 1 shared'], step: 0.7 },
      { key: 'change', label: 'Difference', levels: ['swapped symbols', 'turned symbol'], step: 0.8 },
      { key: 'glyphs', label: 'Symbols', levels: ['shapes', 'letters', 'similar'], step: 0.65 },
    ],
    base: -1.8,
    chance: function () { return 0.25; },
    timeLimit: function () { return 40000; },
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      GLYPHS: GLYPHS, POOLS: POOLS, POOL_KEYS: POOL_KEYS, MIN_PAIR: MIN_PAIR, MIN_TURN: MIN_TURN,
      DIRS: DIRS, SLOTS: SLOTS, SLOT_DIR: SLOT_DIR, FRAME: FRAME, ROT_LEVELS: ROT_LEVELS, CHANGE_LEVELS: CHANGE_LEVELS,
      SHARED: SHARED, LEVEL_CLASSES: LEVEL_CLASSES, ROTS: ROTS, VROTS: VROTS, CLASS_ROTS: CLASS_ROTS, classOf: classOf, drawView: drawView,
      upOf: upOf, slotRot: slotRot, fits: fits, solve: solve, strokeDiff: strokeDiff, glyphDist: glyphDist,
      cleanParams: cleanParams, generateOnce: generateOnce, fallback: fallback, stats: stats, N_OPT: N_OPT, sameView: sameView,
    },
  });
})(window.PX);
