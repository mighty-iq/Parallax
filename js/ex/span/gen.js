/* EX-09 Span: spatial span, a Corsi-type block-tapping task (pure; ARCHITECTURE.md §5, PLAN.md §3,
   research/B-tasks.md §7 and §14c).

   Nine blocks stand at irregular places on a square board. After a lead-in of pace.lead ms they light
   up one at a time (pace.on ms lit, pace.off ms dark: one block per second as in the Corsi standard,
   Kessels et al. 2000; a steady highlight, never faster than 3 Hz). Then the player taps them back,
   in the order shown ('forward') or in reverse ('backward'). With a board turn, the whole board
   turns by 90° or 180° (animated over pace.turnMs: 600 ms for 90°, 800 ms for 180°, after a pause of
   pace.hold) before recall, and the player taps the blocks where they are now: block ids stay
   attached to the blocks as the board turns (spatial updating).

   Board: 1000 × 1000 units, y down, centre (500, 500). Blocks are squares of side 110 centred on
   integer points in [110, 890]². Layout rules (generator and validator):
     - centres within 390 of the board centre: a block's farthest corner is then at most 468 from
       it, inside the round plate the view draws (radius 476), so no block ever leaves the plate or
       the square stage at any angle while the board turns;
     - centres at least 190 apart: tap areas of radius 95 never overlap (44 px targets on any board
       drawn 232 px wide or more);
     - no centre within 120 of the board centre, so every block moves at least 170 units in a turn;
     - no grid regularity: no three centres within 24 units of each other in x (a column) or in y
       (a row), and no tight row in any direction (a centre within 22 units of the segment between
       two others that both lie within 400 of it);
     - clean rows on the recall board (the keyboard labels 1–9 are numbered in reading order: rows
       from the top, left to right; a row is the topmost block left and every block within half a
       block's height, 55, below it): two blocks less than 55 apart in height never fall in
       different rows, so the labels always read along visual rows.
   Path rules (the path joins the centres in the order shown):
     - no block twice (so no immediate repeats either): Corsi sequences never revisit a block, and a
       revisit would make the crossing count and the reverse order ambiguous;
     - each step passes at least 80 units from every other centre (a block's corner is 78 from its
       centre, so the path never seems to run through a block);
     - no step folds back within 25° of the previous one;
     - two non-adjacent steps either cross clearly (the crossing at least 50 from all four end
       blocks) or stay at least 50 apart; the number of crossings lies in the level's range (RANGES);
     - with a turn, ignoring it fails at once: the block now nearest to where the first block to
       recall lit up is another block.

   Shortcut neutrality. Someone who keeps only the set of lit blocks (and maybe the first one) could
   answer in reading order or along the nearest-neighbour path. For an unbiased order these succeed
   with probability 1/L! and 1/(L−1)!, but constrained paths (no crossings, no fold-backs) favour such
   orders. So each item draws whether its key is a nearest-neighbour path (probability 1/(L−1)!) and
   whether it is in reading order on the recall board (1/L!), and is built that way: over the pool
   both shortcuts score at the uniform-order rates, never above.

   Chance: a blind guess of L distinct blocks is the exact sequence with probability
   1/(9·8·…·(9−L+1)): 1.4 % at length 2, under 0.2 % from length 3. It is never 0.

   Item (JSON):
     { ex: 'span', seed, params, key,               key = block ids in recall order
       order: 'forward' | 'backward', len,          len = number of blocks shown
       board: { size: 1000, block: 110 },
       blocks: [[x, y] × 9],                        centres before the turn (block id = index)
       seq: [ids],                                  the order in which blocks light up
       turn: 0 | 90 | 180, dir: 1 | −1,             dir 1 = clockwise on the screen
       after: [[x, y] × 9],                         centres after the turn (= blocks when turn is 0)
       crossings,                                   how often the shown path crosses itself
       pace: { lead: 600, on: 700, off: 300, hold: 500, turnMs } }
     Response: the tapped block ids in order. score → { correct (the whole sequence), value (taps
     right from the start), detail: { prefix, length, given } }.
     PX.ex.get('span').lib exposes the geometry, the fallback and the shortcut solvers (view, tests).

   Difficulty (custom, logits; DIFF below): length dominates (Corsi); crossings cost more on longer
   paths (path crossings lower recall, De Lillo et al. 2016); backward recall costs a little (Corsi
   backward spans are close to forward ones); a turn costs updating, more for longer sequences [DJ].
   Base −2.5: a beginner (θ = 0) gets length 2 right about 89 % of the time.

   Decisions against the brief, with reasons:
     - 'rotated' is the turn dimension (0/90/180°), applying to both recall orders, not a third
       variant: as a variant it would duplicate items (forward at 90° = forward at 0°) and the level
       text (the first variant, all dims) would name a turn for boards that never turn.
     - No 3D lattice: the research support is a room-scale walking version and VR boards
       [unverified]; on a screen, depth adds picking and occlusion problems on phones and needs WebGL,
       while the turned board already gives the spatial-updating variant the research names.
   All geometry is integer or + − × ÷ arithmetic, so the same seed gives the same item everywhere. */
(function (PX) {
  'use strict';

  /* ------------------------------------------------------------ constants */
  var SIZE = 1000, MID = 500, BLOCK = 110, LO = 110, HI = 890;
  var RMAX = 390;                    // centres within 390 of the centre: the turning board never clips a block
  var PLATE = 476;                   // radius of the round plate the view draws (a corner reaches 390 + 78 = 468)
  var ROWTOL = BLOCK / 2;            // reading order: blocks within half a block's height form one row
  var SEP = 190, HOLE = 120, ALIGN = 24, ROW = 22, ROWGAP = 400;
  var CLEAR = 50, PASS = 80;
  var COS2_25 = 0.8213938048432696;  // cos²(25°): a step may not fold back within 25°
  var TAN2_25 = 0.21744283205399903; // tan²(25°): the same rule, as the validator writes it
  var NB = 9, IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  var CENTRE = [MID, MID];
  var LENS = [2, 3, 4, 5, 6, 7, 8, 9];
  var CROSS = ['none', 'some', 'many'];
  var TURNS = [0, 90, 180];
  var ORDERS = ['forward', 'backward'];
  var PACE = { lead: 600, on: 700, off: 300, hold: 500 };
  var TURN_MS = [0, 600, 800];       // 150 and 225 degrees per second: seen as one turn, too quick to track block by block
  var STATS = { fallbacks: 0 };      // counted for the tests (generate should never need the fallback)
  var FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];
  // Crossings allowed per length and level (none, some, many). Lengths 2–3 cannot cross; at length
  // 4 only one crossing is possible, so 'many' equals 'some' there.
  var RANGES = {
    2: [[0, 0], [0, 0], [0, 0]], 3: [[0, 0], [0, 0], [0, 0]],
    4: [[0, 0], [1, 1], [1, 1]], 5: [[0, 0], [1, 1], [2, 3]],
    6: [[0, 0], [1, 2], [3, 5]], 7: [[0, 0], [1, 2], [3, 6]],
    8: [[0, 0], [1, 3], [4, 7]], 9: [[0, 0], [1, 3], [4, 8]],
  };
  var BUDGET = 1500, BUDGET_FREE = 3000, DIRECT_TRIES = 40, LAYOUT_TRIES = 200;

  /* ------------------------------------------------------------ difficulty */
  // Cumulative cost of length over length 2; crossings by length band and effective level;
  // backward; the turn (90°, 180°) plus a per-block share. All [DJ], to be refitted from logs.
  var DIFF = {
    base: -2.5,
    len: [0, 0.45, 0.95, 1.6, 2.4, 3.25, 4.1, 4.95],
    cross: { 4: [0, 0.3, 0.3], 5: [0, 0.3, 0.55], 6: [0, 0.35, 0.7], 7: [0, 0.35, 0.7], 8: [0, 0.4, 0.8], 9: [0, 0.4, 0.8] },
    backward: 0.3,
    turn: [0, 0.5, 0.6], turnPerBlock: 0.05,
  };
  function difficulty(params) {
    var li = params.len | 0, ci = params.cross | 0, ti = params.turn | 0, L = LENS[li] || 2;
    var b = DIFF.base + DIFF.len[li];
    if (DIFF.cross[L]) b += DIFF.cross[L][ci];
    if (params.variant === 'backward') b += DIFF.backward;
    if (ti) b += DIFF.turn[ti] + DIFF.turnPerBlock * (L - 2);
    return Math.round(b * 1e6) / 1e6;
  }

  /* ------------------------------------------------------------ params */
  function isLevel(x, n) { return typeof x === 'number' && x >= 0 && x < n && Math.floor(x) === x; }
  // → { L, li, ci, ti, turn, order, lo, hi } or a reason string.
  function resolve(params) {
    if (!params || typeof params !== 'object') return 'params must be an object';
    if (!isLevel(params.len, LENS.length)) return 'len must be a level index from 0 to ' + (LENS.length - 1);
    if (!isLevel(params.cross, CROSS.length)) return 'cross must be a level index from 0 to 2';
    if (!isLevel(params.turn, TURNS.length)) return 'turn must be a level index from 0 to 2';
    var order = params.variant === undefined ? 'forward' : params.variant;
    if (ORDERS.indexOf(order) < 0) return 'unknown variant ' + JSON.stringify(params.variant);
    var L = LENS[params.len], rg = RANGES[L][params.cross];
    return { L: L, li: params.len, ci: params.cross, ti: params.turn, turn: TURNS[params.turn], order: order, lo: rg[0], hi: rg[1] };
  }

  /* ------------------------------------------------------------ geometry */
  function d2(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy; }
  function orient(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
  // Squared distance from p to the segment ab (clamped projection).
  function segD2(p, a, b) {
    var vx = b[0] - a[0], vy = b[1] - a[1], wx = p[0] - a[0], wy = p[1] - a[1];
    var L = vx * vx + vy * vy, t = L ? (vx * wx + vy * wy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var ex = wx - t * vx, ey = wy - t * vy;
    return ex * ex + ey * ey;
  }
  // Steps ab and cd that share no block: 1 = a clear crossing, 0 = clearly apart, −1 = unclear.
  function relation(a, b, c, d) {
    var o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b), m = CLEAR * CLEAR;
    if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) {
      var t = o3 / (o3 - o4), p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      return d2(p, a) >= m && d2(p, b) >= m && d2(p, c) >= m && d2(p, d) >= m ? 1 : -1;
    }
    return segD2(a, c, d) >= m && segD2(b, c, d) >= m && segD2(c, a, b) >= m && segD2(d, a, b) >= m ? 0 : -1;
  }
  // a → b → c folds back: the angle at b is under 25°.
  function sharp(a, b, c) {
    var ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1], dot = ux * vx + uy * vy;
    return dot > 0 && dot * dot > COS2_25 * (ux * ux + uy * uy) * (vx * vx + vy * vy);
  }
  // Centres after the turn; dir 1 is clockwise on the screen (y down): (vx, vy) → (−vy, vx).
  function turnPoints(pts, turn, dir) {
    return pts.map(function (p) {
      var vx = p[0] - MID, vy = p[1] - MID;
      if (turn === 90) return dir > 0 ? [MID - vy, MID + vx] : [MID + vy, MID - vx];
      if (turn === 180) return [MID - vx, MID - vy];
      return [p[0], p[1]];
    });
  }

  /* ------------------------------------------------------------ layout */
  function layoutProblem(pts) {
    var i, j, k;
    for (i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p[0] < LO || p[0] > HI || p[1] < LO || p[1] > HI) return 'block ' + i + ' lies outside the board area';
      if (d2(p, CENTRE) > RMAX * RMAX) return 'block ' + i + ' lies outside the circle the board turns in';
      if (d2(p, CENTRE) < HOLE * HOLE) return 'block ' + i + ' is too near the board centre';
      for (j = i + 1; j < pts.length; j++) if (d2(p, pts[j]) < SEP * SEP) return 'blocks ' + i + ' and ' + j + ' are closer than ' + SEP;
    }
    for (var axis = 0; axis < 2; axis++) {
      var v = pts.map(function (q) { return q[axis]; }).sort(function (a, b) { return a - b; });
      for (i = 0; i + 2 < v.length; i++) if (v[i + 2] - v[i] <= ALIGN) return 'three blocks form a ' + (axis ? 'row' : 'column');
    }
    for (i = 0; i < pts.length; i++) {
      for (j = i + 1; j < pts.length; j++) {
        for (k = 0; k < pts.length; k++) {
          if (k === i || k === j || d2(pts[i], pts[k]) > ROWGAP * ROWGAP || d2(pts[j], pts[k]) > ROWGAP * ROWGAP) continue;
          if (segD2(pts[k], pts[i], pts[j]) < ROW * ROW) return 'blocks ' + i + ', ' + k + ' and ' + j + ' form a tight row';
        }
      }
    }
    return null;
  }

  // accept(pts), optional: a further rule for the whole layout (the recall rows, which depend on the turn).
  function makeLayout(r, accept) {
    for (var t = 0; t < LAYOUT_TRIES; t++) {
      var pts = [];
      for (var k = 0; pts.length < NB && k < 400; k++) {
        var q = [r.int(LO, HI), r.int(LO, HI)], dc = d2(q, CENTRE);
        if (dc < HOLE * HOLE || dc > RMAX * RMAX) continue;
        var ok = true;
        for (var i = 0; i < pts.length && ok; i++) if (d2(q, pts[i]) < SEP * SEP) ok = false;
        if (ok) pts.push(q);
      }
      if (pts.length === NB && !layoutProblem(pts) && (!accept || accept(pts))) return pts;
    }
    return null;
  }

  /* ------------------------------------------------------------ shortcut solvers */
  function sameList(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  // Rows of the board as it stands at recall, top to bottom, each left to right. A row is the topmost
  // block not yet placed and every block whose centre lies within half a block's height (ROWTOL)
  // below it, so a row is never taller than that.
  function rows(pos, ids) {
    var rest = ids.slice().sort(function (i, j) { return pos[i][1] - pos[j][1] || pos[i][0] - pos[j][0] || i - j; }), out = [];
    while (rest.length) {
      var top = pos[rest[0]][1], row = [], next = [];
      rest.forEach(function (id) { (pos[id][1] - top <= ROWTOL ? row : next).push(id); });
      row.sort(function (i, j) { return pos[i][0] - pos[j][0] || pos[i][1] - pos[j][1] || i - j; });
      out.push(row);
      rest = next;
    }
    return out;
  }
  // Reading order: row by row (the recall labels 1–9 follow it on the whole board).
  function readingOrder(pos, ids) { return [].concat.apply([], rows(pos, ids)); }
  // The rows must be clean on the recall board, or the labels would not read as rows: two blocks
  // less than half a block's height apart always share a row (a row is never split between them).
  function labelProblem(pos) {
    var rs = rows(pos, IDS), rowOf = [];
    rs.forEach(function (row, k) { row.forEach(function (id) { rowOf[id] = k; }); });
    for (var i = 0; i < NB; i++) {
      for (var j = i + 1; j < NB; j++) {
        if (rowOf[i] !== rowOf[j] && Math.abs(pos[i][1] - pos[j][1]) <= ROWTOL) return 'blocks ' + i + ' and ' + j + ' are level but fall in different rows of the recall labels';
      }
    }
    return null;
  }
  // From start, always to the nearest block of ids not yet used (ties: the lower id).
  function nnPath(pos, start, ids, L) {
    var out = [start], left = ids.filter(function (x) { return x !== start; });
    while (out.length < L && left.length) {
      var cur = pos[out[out.length - 1]], bi = 0;
      for (var i = 1; i < left.length; i++) {
        var di = d2(cur, pos[left[i]]), db = d2(cur, pos[left[bi]]);
        if (di < db || (di === db && left[i] < left[bi])) bi = i;
      }
      out.push(left[bi]);
      left.splice(bi, 1);
    }
    return out;
  }
  function isNN(pos, key) { return sameList(nnPath(pos, key[0], key, key.length), key); }
  function isRO(pos, key) { return sameList(readingOrder(pos, key), key); }
  // The block now nearest to where block id lit up (someone who ignores the turn taps it).
  function nearestNow(item, id) {
    var p = item.blocks[id], best = 0;
    for (var j = 1; j < NB; j++) if (d2(item.after[j], p) < d2(item.after[best], p)) best = j;
    return best;
  }
  // Each solver maps an item to a response (block ids in order).
  var solvers = {
    readingOrder: function (item) { return readingOrder(item.after, item.key); },             // knows the set
    readingOrderBlind: function (item) { return readingOrder(item.after, IDS).slice(0, item.key.length); },
    nearest: function (item) { return nnPath(item.after, item.key[0], item.key, item.key.length); }, // knows set + start
    nearestBlind: function (item) { return nnPath(item.after, item.key[0], IDS, item.key.length); },  // knows the start
    ignoreTurn: function (item) { return item.key.map(function (id) { return nearestNow(item, id); }); },
  };

  /* ------------------------------------------------------------ path search */
  // Precomputed for one board: which steps keep clear of other blocks, which blocks may be recalled
  // first under the turn rule, and the step relations (memoised).
  function context(pts, after, P) {
    var pass = [], first = [], i, j, k;
    for (i = 0; i < NB; i++) {
      pass.push([]);
      for (j = 0; j < NB; j++) {
        var ok = i !== j;
        for (k = 0; ok && k < NB; k++) if (k !== i && k !== j && segD2(pts[k], pts[i], pts[j]) < PASS * PASS) ok = false;
        pass[i].push(ok);
      }
      first.push(!P.turn || firstOk(pts, after, i));
    }
    var memo = new Int8Array(NB * NB * NB * NB).fill(2);
    return {
      pts: pts, pos: after, pass: pass, first: first, L: P.L, lo: P.lo, hi: P.hi,
      rel: function (a, b, c, d) {
        var ix = ((a * NB + b) * NB + c) * NB + d;
        if (memo[ix] === 2) memo[ix] = relation(pts[a], pts[b], pts[c], pts[d]);
        return memo[ix];
      },
    };
  }
  // Under a turn, block id may be recalled first only if another block now stands nearer to where
  // id lit up than id itself does.
  function firstOk(pts, after, id) {
    var self = d2(after[id], pts[id]);
    for (var j = 0; j < NB; j++) if (j !== id && d2(after[j], pts[id]) < self) return true;
    return false;
  }
  // Crossings of the path through key, or −1 when it breaks a path rule.
  function pathCross(ctx, key) {
    var n = 0, pts = ctx.pts;
    if (!ctx.first[key[0]]) return -1;
    for (var i = 0; i + 1 < key.length; i++) {
      if (!ctx.pass[key[i]][key[i + 1]]) return -1;
      if (i > 0 && sharp(pts[key[i - 1]], pts[key[i]], pts[key[i + 1]])) return -1;
      for (var j = 0; j + 2 <= i; j++) {
        var r = ctx.rel(key[j], key[j + 1], key[i], key[i + 1]);
        if (r < 0) return -1;
        n += r;
      }
    }
    return n;
  }
  // Depth-first search in random order for a path of ctx.L blocks with lo..hi crossings that
  // satisfies leafOk; prunes on the crossing count (too many, or too few still possible).
  function search(r, ctx, leafOk, budget) {
    var L = ctx.L, lo = ctx.lo, hi = ctx.hi, pts = ctx.pts, seq = [], used = [], nodes = 0, more = [], m, j;
    for (m = 0; m <= L; m++) {
      var s = 0;
      for (j = Math.max(m, 1); j <= L - 1; j++) s += Math.max(0, j - 2);
      more.push(s);
    }
    function rec(cross) {
      if (seq.length === L) return cross >= lo && leafOk(seq);
      if (++nodes > budget) return false;
      var order = r.shuffle(IDS), len = seq.length;
      for (var q = 0; q < NB; q++) {
        var c = order[q], add = 0, bad = false;
        if (used[c]) continue;
        if (len === 0) {
          if (!ctx.first[c]) continue;
        } else {
          var a = seq[len - 1];
          if (!ctx.pass[a][c]) continue;
          if (len >= 2 && sharp(pts[seq[len - 2]], pts[a], pts[c])) continue;
          for (j = 0; j + 2 < len; j++) {
            var rr = ctx.rel(seq[j], seq[j + 1], a, c);
            if (rr < 0) { bad = true; break; }
            add += rr;
          }
          if (bad || cross + add > hi || cross + add + more[len + 1] < lo) continue;
        }
        used[c] = true;
        seq.push(c);
        if (rec(cross + add)) return true;
        seq.pop();
        used[c] = false;
        if (nodes > budget) return false;
      }
      return false;
    }
    return rec(0) ? seq.slice() : null;
  }
  // A key that is a nearest-neighbour path from its first block (and in reading order or not).
  function directNN(r, ctx, wantRO) {
    for (var t = 0; t < DIRECT_TRIES; t++) {
      var start = r.int(0, NB - 1);
      if (!ctx.first[start]) continue;
      var set = [start].concat(r.shuffle(IDS.filter(function (x) { return x !== start; })).slice(0, ctx.L - 1));
      var key = nnPath(ctx.pts, start, set, ctx.L);
      if (isRO(ctx.pos, key) !== wantRO) continue;
      var n = pathCross(ctx, key);
      if (n >= ctx.lo && n <= ctx.hi) return key;
    }
    return null;
  }
  // A key in reading order on the recall board that is not a nearest-neighbour path.
  function directRO(r, ctx) {
    for (var t = 0; t < DIRECT_TRIES; t++) {
      var key = readingOrder(ctx.pos, r.shuffle(IDS).slice(0, ctx.L));
      if (isNN(ctx.pts, key)) continue;
      var n = pathCross(ctx, key);
      if (n >= ctx.lo && n <= ctx.hi) return key;
    }
    return null;
  }
  function buildKey(r, ctx, wantNN, wantRO) {
    var key;
    if (wantNN) key = directNN(r.fork('nn'), ctx, wantRO);
    else if (wantRO) key = directRO(r.fork('ro'), ctx);
    else key = search(r.fork('dfs'), ctx, function (s) { return !isNN(ctx.pts, s) && !isRO(ctx.pos, s); }, BUDGET);
    // When the drawn shape is impossible on this board, any valid path will do.
    if (!key) key = search(r.fork('free'), ctx, function () { return true; }, BUDGET_FREE);
    return key;
  }

  /* ------------------------------------------------------------ generate */
  function copyParams(params) {
    var p = {};
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
    return p;
  }
  function assemble(seed, params, P, pts, after, dir, key, crossings) {
    return {
      ex: 'span', seed: seed, params: copyParams(params), key: key.slice(),
      order: P.order, len: P.L,
      board: { size: SIZE, block: BLOCK },
      blocks: pts.map(function (q) { return [q[0], q[1]]; }),
      seq: P.order === 'backward' ? key.slice().reverse() : key.slice(),
      turn: P.turn, dir: dir,
      after: after.map(function (q) { return [q[0], q[1]]; }),
      crossings: crossings,
      pace: { lead: PACE.lead, on: PACE.on, off: PACE.off, hold: PACE.hold, turnMs: TURN_MS[P.ti] },
    };
  }
  function attempt(r, P, params, seed) {
    var dir = P.turn && r.fork('dir').chance(0.5) ? -1 : 1;
    var pts = makeLayout(r.fork('layout'), function (q) { return !labelProblem(turnPoints(q, P.turn, dir)); });
    if (!pts) return null;
    var after = turnPoints(pts, P.turn, dir);
    // The shortcut shape of this key, drawn at the rates of a uniformly random order.
    var f = r.fork('shape');
    var wantNN = f.chance(1 / FACT[P.L - 1]), wantRO = f.chance(1 / FACT[P.L]);
    var ctx = context(pts, after, P);
    var key = buildKey(r.fork('path'), ctx, wantNN, wantRO);
    return key ? assemble(seed, params, P, pts, after, dir, key, pathCross(ctx, key)) : null;
  }
  function generate(rng, params) {
    var P = resolve(params);
    if (typeof P === 'string') throw new RangeError('span.generate: ' + P);
    for (var i = 0; i < 50; i++) {
      var item = attempt(rng.fork('try' + i), P, params, rng.seed);
      if (item && validate(item) === true) return item;
    }
    STATS.fallbacks++;
    return fallbackItem(params, rng.seed);
  }

  // Known-valid construction: a fixed board (it passes every layout rule) and a deterministic search
  // with a large budget, memoised per params. The tests build it for every combination.
  var FALLBACK_PTS = [[243, 769], [465, 770], [795, 271], [614, 141], [873, 474], [447, 337], [616, 438], [746, 685], [216, 492]];
  var fallbackMemo = {};
  function fallbackItem(params, seed, pts) {
    var P = resolve(params);
    if (typeof P === 'string') throw new RangeError('span.fallback: ' + P);
    var board = pts || FALLBACK_PTS, mk = PX.ex.paramsKey(params) + (pts ? '|' + JSON.stringify(pts) : '');
    if (!(mk in fallbackMemo)) {
      var after = turnPoints(board, P.turn, 1), ctx = context(board, after, P);
      var key = search(PX.rng(PX.rng.hash('span-fallback', mk)), ctx, function () { return true; }, 200000);
      fallbackMemo[mk] = key ? assemble(0, params, P, board, after, 1, key, pathCross(ctx, key)) : null;
    }
    if (!fallbackMemo[mk]) throw new Error('span.fallback: no path for ' + mk);
    var out = PX.util.deepCopy(fallbackMemo[mk]);
    out.seed = seed === undefined ? 0 : seed;
    return out;
  }

  /* ------------------------------------------------------------ validate (independent) */
  function isInt(x) { return typeof x === 'number' && isFinite(x) && Math.floor(x) === x; }
  function isPoint(p) { return Array.isArray(p) && p.length === 2 && isInt(p[0]) && isInt(p[1]); }
  // Squared distance from p to the segment ab, by the cross product.
  function ptSeg2(p, a, b) {
    var abx = b[0] - a[0], aby = b[1] - a[1], apx = p[0] - a[0], apy = p[1] - a[1];
    var dot = abx * apx + aby * apy, len = abx * abx + aby * aby;
    if (dot <= 0) return apx * apx + apy * apy;
    if (dot >= len) { var bx = p[0] - b[0], by = p[1] - b[1]; return bx * bx + by * by; }
    var cr = abx * apy - aby * apx;
    return cr * cr / len;
  }
  // Steps p1p2 and p3p4 by exact parametric intersection: 1 crossing, 0 apart, or a reason.
  function cross2(p1, p2, p3, p4) {
    var rx = p2[0] - p1[0], ry = p2[1] - p1[1], sx = p4[0] - p3[0], sy = p4[1] - p3[1];
    var qx = p3[0] - p1[0], qy = p3[1] - p1[1], m = CLEAR * CLEAR;
    var den = rx * sy - ry * sx, tn = qx * sy - qy * sx, un = qx * ry - qy * rx;
    if (den < 0) { den = -den; tn = -tn; un = -un; }
    if (den > 0 && tn > 0 && tn < den && un > 0 && un < den) {
      var t = tn / den, u = un / den, lr = rx * rx + ry * ry, ls = sx * sx + sy * sy;
      if (t * t * lr < m || (1 - t) * (1 - t) * lr < m || u * u * ls < m || (1 - u) * (1 - u) * ls < m) return 'a crossing lies too near a block';
      return 1;
    }
    if (Math.min(ptSeg2(p1, p3, p4), ptSeg2(p2, p3, p4), ptSeg2(p3, p1, p2), ptSeg2(p4, p1, p2)) < m) return 'two steps nearly touch';
    return 0;
  }
  function validate(item) {
    try { return check(item); } catch (e) { return 'validate failed: ' + (e && e.message); }
  }
  function check(item) {
    if (!item || typeof item !== 'object' || item.ex !== 'span') return 'not a span item';
    var P = resolve(item.params);
    if (typeof P === 'string') return P;
    if (!item.board || item.board.size !== SIZE || item.board.block !== BLOCK) return 'the board must be ' + SIZE + ' units with blocks of ' + BLOCK;
    var B = item.blocks, A = item.after, i, j, k;
    if (!Array.isArray(B) || B.length !== NB || !B.every(isPoint)) return 'blocks must be 9 integer points';
    if (!Array.isArray(A) || A.length !== NB || !A.every(isPoint)) return 'after must be 9 integer points';
    var lp = layoutProblem(B);
    if (lp) return lp;
    // The turn, re-derived with the rotation matrix of the signed angle (y down: + is clockwise).
    if (item.turn !== P.turn) return 'turn ' + item.turn + ' does not match level ' + P.ti;
    if (item.dir !== 1 && !(item.dir === -1 && P.turn)) return 'dir must be 1, or −1 with a turn';
    var ang = P.turn * item.dir, cs = ang === 0 ? [1, 0] : ang === 90 ? [0, 1] : ang === -90 ? [0, -1] : [-1, 0];
    for (i = 0; i < NB; i++) {
      var x = B[i][0] - MID, y = B[i][1] - MID;
      if (A[i][0] !== MID + x * cs[0] - y * cs[1] || A[i][1] !== MID + x * cs[1] + y * cs[0]) return 'block ' + i + ' is not where the turn puts it';
    }
    var lab = labelProblem(A);
    if (lab) return lab;
    // The sequence and the key.
    var S = item.seq, L = P.L, seen = {};
    if (item.len !== L || item.order !== P.order) return 'len or order does not match the params';
    if (!Array.isArray(S) || S.length !== L) return 'the sequence must have ' + L + ' blocks';
    for (i = 0; i < L; i++) {
      if (!isInt(S[i]) || S[i] < 0 || S[i] >= NB) return 'sequence entry ' + i + ' is not a block id';
      if (seen[S[i]]) return 'block ' + S[i] + ' appears twice';
      seen[S[i]] = true;
    }
    var key = P.order === 'backward' ? S.slice().reverse() : S.slice();
    if (!sameList(item.key, key)) return 'the key is not the ' + P.order + ' order of the sequence';
    // Path rules and crossings, recomputed.
    var n = 0;
    for (i = 0; i + 1 < L; i++) {
      var a = B[S[i]], b = B[S[i + 1]];
      for (k = 0; k < NB; k++) if (k !== S[i] && k !== S[i + 1] && ptSeg2(B[k], a, b) < PASS * PASS) return 'step ' + i + ' passes over block ' + k;
      if (i + 2 < L) {
        var c = B[S[i + 2]], ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1];
        var dot = ux * vx + uy * vy, cr = ux * vy - uy * vx;
        if (dot > 0 && cr * cr < TAN2_25 * dot * dot) return 'the path folds back at block ' + S[i + 1];
      }
      for (j = i + 2; j + 1 < L; j++) {
        var res = cross2(a, b, B[S[j]], B[S[j + 1]]);
        if (typeof res === 'string') return res + ' (steps ' + i + ' and ' + j + ')';
        n += res;
      }
    }
    if (n !== item.crossings) return 'the path crosses itself ' + n + ' times; the item says ' + item.crossings;
    if (n < P.lo || n > P.hi) return n + ' crossings is outside ' + P.lo + '–' + P.hi + ' (' + CROSS[P.ci] + ')';
    if (P.turn) {
      var f = key[0], self = d2(A[f], B[f]), other = Infinity;
      for (j = 0; j < NB; j++) if (j !== f) other = Math.min(other, d2(A[j], B[f]));
      if (!(other < self)) return 'ignoring the turn finds the first block';
    }
    var pc = item.pace;
    if (!pc || !(pc.on >= 300) || !(pc.on + pc.off >= 334) || !(pc.hold >= 0) || !(pc.lead >= 0) || pc.turnMs !== TURN_MS[P.ti]) return 'pace must stay at or under 3 Hz, with the turn time of the level';
    return true;
  }

  /* ------------------------------------------------------------ score, chance */
  function score(item, response) {
    var key = item.key, L = key.length, p = 0;
    if (!Array.isArray(response)) return { correct: false, value: 0, detail: { prefix: 0, length: L, given: 0 } };
    while (p < L && p < response.length && response[p] === key[p]) p++;
    return { correct: p === L && response.length === L, value: p, detail: { prefix: p, length: L, given: response.length } };
  }
  // A blind guess of L distinct blocks: 1 / (9 · 8 · … · (9 − L + 1)).
  function chance(params) {
    var L = LENS[params && isLevel(params.len, LENS.length) ? params.len : 0], p = 1;
    for (var i = 0; i < L; i++) p /= NB - i;
    return p;
  }
  // Expected trial time in ms for session planning: the stimulus (lead-in, one second per block,
  // the hold, the turn) and the recall (about 1.5 s to start, then 0.8 s per tap) [DJ].
  function estMs(params) {
    var li = params && isLevel(params.len, LENS.length) ? params.len : 0, ti = params && isLevel(params.turn, TURNS.length) ? params.turn : 0;
    var L = LENS[li];
    return PACE.lead + L * (PACE.on + PACE.off) + PACE.hold + TURN_MS[ti] + 1500 + 800 * L;
  }

  PX.ex.define({
    id: 'span', version: 1, code: 'EX-09', name: 'Block Span', short: 'Span',
    abilities: ['MV', 'WM'], cell: null, role: 'train', answer: 'sequence',
    // step values are the average costs, for display; difficulty() below is what counts.
    dims: [
      { key: 'len', label: 'Length', levels: LENS.slice(), step: 0.71 },
      { key: 'cross', label: 'Path crossings', levels: CROSS.slice(), step: 0.35 },
      { key: 'turn', label: 'Board turn', levels: TURNS.slice(), step: 0.4 },
    ],
    base: DIFF.base,
    difficulty: difficulty,
    variants: ORDERS.slice(),
    chance: chance,
    estMs: estMs,
    timeLimit: function () { return null; },
    generate: generate,
    validate: validate,
    score: score,
    lib: Object.freeze({
      SIZE: SIZE, BLOCK: BLOCK, RMAX: RMAX, PLATE: PLATE, ROWTOL: ROWTOL, SEP: SEP, HOLE: HOLE, CLEAR: CLEAR, PASS: PASS, RANGES: RANGES, LENS: LENS,
      TURNS: TURNS, ORDERS: ORDERS, PACE: PACE, STATS: STATS, estMs: estMs, TURN_MS: TURN_MS, DIFF: DIFF, FALLBACK_PTS: FALLBACK_PTS,
      resolve: resolve, layoutProblem: layoutProblem, makeLayout: makeLayout, turnPoints: turnPoints,
      relation: relation, rows: rows, readingOrder: readingOrder, labelProblem: labelProblem, nnPath: nnPath, isNN: isNN, isRO: isRO,
      nearestNow: nearestNow, solvers: solvers, fallback: fallbackItem, attempt: attempt,
    }),
  });
})(window.PX);
