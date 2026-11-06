/* PR-4 Pattern Memory (probe; pure; ARCHITECTURE.md §5, PLAN.md §4, research/B-tasks.md §7 and §14b).

   A grid (3×3 up to 6×6) with about half of its cells filled is shown once, briefly (the view times
   it: item.exposureMs = 3 s); then the empty grid; the player taps every cell that was filled and
   confirms. Unlike Span (a sequence of single blocks), this is one static pattern recalled at once,
   in the style of the Visual Patterns Test (own patterns only).

   Difficulty (LLTM, additive): grid size with its filled count, and pattern regularity measured by
   the number of filled-cell clusters (4-connected): few large clusters form nameable shapes and are
   easier; many small clusters (checkerboard-like) are harder. Exposure is fixed at 3 s.
   Regularity bands per size (CLUSTER_BANDS) make the cluster count, not the generator's intent, the
   definition of a level; validate recounts the clusters by flood fill.
   From the 'clusters' level up, no row or column is completely filled (a full line is a nameable
   shortcut); at the 'shapes' level full lines are allowed.

   Item (JSON): { ex: 'patterns', seed, params, key, rows, cols, k, clusters, exposureMs }
     cells are numbered row-major from the top left: id = row × cols + col; key = the filled ids,
     sorted ascending (the response shape of answer 'targets').
   score(item, ids): correct when the tapped set equals the pattern exactly; value = the share of
     cells classified right (filled tapped, empty untapped); detail = { hits, misses, falseAlarms }.
   helpers: clusters(cells, rows, cols), band(params), SIZES, CLUSTER_BANDS (for tests). */
(function (PX) {
  'use strict';

  var EXPOSURE_MS = 3000;
  // [rows, cols, filled]: about half of the cells.
  var SIZES = [[3, 3, 4], [3, 4, 6], [4, 4, 8], [4, 5, 10], [5, 5, 12], [5, 6, 15], [6, 6, 18]];
  var REGULARITY = ['shapes', 'clusters', 'scattered'];
  // Cluster-count bands [lo, hi] per size level for shapes / clusters / scattered.
  var CLUSTER_BANDS = [
    [[1, 1], [2, 2], [3, 4]],
    [[1, 1], [2, 3], [4, 6]],
    [[1, 2], [3, 4], [5, 8]],
    [[1, 2], [3, 5], [6, 10]],
    [[1, 2], [3, 5], [6, 12]],
    [[1, 3], [4, 6], [7, 15]],
    [[1, 3], [4, 7], [8, 18]],
  ];

  function comb(n, k) { var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }

  function neighbours(id, rows, cols) {
    var r = Math.floor(id / cols), c = id % cols, out = [];
    if (r > 0) out.push(id - cols);
    if (r < rows - 1) out.push(id + cols);
    if (c > 0) out.push(id - 1);
    if (c < cols - 1) out.push(id + 1);
    return out;
  }

  // Number of 4-connected clusters of filled cells (flood fill; independent of the generator).
  function clusters(cells, rows, cols) {
    var filled = {}, seen = {}, n = 0, i;
    for (i = 0; i < cells.length; i++) filled[cells[i]] = true;
    for (i = 0; i < cells.length; i++) {
      if (seen[cells[i]]) continue;
      n++;
      var stack = [cells[i]];
      seen[cells[i]] = true;
      while (stack.length) {
        var nb = neighbours(stack.pop(), rows, cols);
        for (var j = 0; j < nb.length; j++) {
          if (filled[nb[j]] && !seen[nb[j]]) { seen[nb[j]] = true; stack.push(nb[j]); }
        }
      }
    }
    return n;
  }

  function fullLines(cells, rows, cols) {
    var rowN = [], colN = [], i, n = 0;
    for (i = 0; i < rows; i++) rowN.push(0);
    for (i = 0; i < cols; i++) colN.push(0);
    for (i = 0; i < cells.length; i++) { rowN[Math.floor(cells[i] / cols)]++; colN[cells[i] % cols]++; }
    for (i = 0; i < rows; i++) if (rowN[i] === cols) n++;
    for (i = 0; i < cols; i++) if (colN[i] === rows) n++;
    return n;
  }

  function band(params) { return CLUSTER_BANDS[params.size][params.regularity]; }

  /* Places c mutually non-touching seed cells, then adds k − c cells one at a time, each touching
     exactly one cluster (so clusters grow but never merge): the pattern has exactly c clusters.
     Returns the sorted cells, or null when no cell can be added (the caller retries). */
  function grow(rng, rows, cols, k, c) {
    var N = rows * cols, owner = [], i, j, n;
    for (i = 0; i < N; i++) owner.push(-1);
    function touching(id) { // the distinct clusters next to cell id
      var nb = neighbours(id, rows, cols), out = [];
      for (var q = 0; q < nb.length; q++) if (owner[nb[q]] !== -1 && out.indexOf(owner[nb[q]]) < 0) out.push(owner[nb[q]]);
      return out;
    }
    for (n = 0; n < c; n++) {
      var seeds = [];
      for (i = 0; i < N; i++) if (owner[i] === -1 && !touching(i).length) seeds.push(i);
      if (!seeds.length) return null;
      owner[rng.pick(seeds)] = n;
    }
    for (j = c; j < k; j++) {
      var cand = [], who = [];
      for (i = 0; i < N; i++) {
        if (owner[i] !== -1) continue;
        var tc = touching(i);
        if (tc.length === 1) { cand.push(i); who.push(tc[0]); }
      }
      if (!cand.length) return null;
      var at = rng.int(0, cand.length - 1);
      owner[cand[at]] = who[at];
    }
    var cells = [];
    for (i = 0; i < N; i++) if (owner[i] !== -1) cells.push(i);
    return cells;
  }

  function attempt(rng, params) {
    var s = SIZES[params.size], rows = s[0], cols = s[1], k = s[2];
    // Draw the cluster count from the band, at most 3 above its floor: random growth rarely
    // reaches near-checkerboard counts, and an even spread keeps levels comparable.
    var b = band(params), c = rng.int(b[0], Math.min(b[1], b[0] + 3));
    var cells = grow(rng, rows, cols, k, c);
    return cells ? build(rng.seed, params, rows, cols, k, cells) : null;
  }

  function build(seed, params, rows, cols, k, cells) {
    return {
      ex: 'patterns', seed: seed, params: { size: params.size, regularity: params.regularity },
      key: cells.slice(), rows: rows, cols: cols, k: k,
      clusters: clusters(cells, rows, cols), exposureMs: EXPOSURE_MS,
    };
  }

  /* Fallback when 50 tries fail (rare): shapes = one block filled row by row over all columns but
     the last (one cluster); scattered = the first k cells of a checkerboard (every cell its own
     cluster); clusters = the first valid pattern from a fixed list of seeds that do not depend on
     the item seed (the tests check that it exists for every level). */
  function fallback(seed, params) {
    var s = SIZES[params.size], rows = s[0], cols = s[1], k = s[2], cells = [], id, item;
    if (params.regularity === 2) {
      for (id = 0; id < rows * cols && cells.length < k; id++) {
        if ((Math.floor(id / cols) + id % cols) % 2 === 0) cells.push(id);
      }
    } else if (params.regularity === 0) {
      for (var r = 0; r < rows && cells.length < k; r++) {
        for (var c = 0; c < cols - 1 && cells.length < k; c++) cells.push(r * cols + c);
      }
    } else {
      for (var i = 0; i < 2000; i++) {
        item = attempt(PX.rng(PX.rng.hash('patterns-fallback', params.size, params.regularity, i)), params);
        if (item && validate(item) === true) { item.seed = seed; item.fallback = true; return item; }
      }
      item = item || build(seed, params, rows, cols, k, cells);
      item.fallback = true;
      return item;
    }
    item = build(seed, params, rows, cols, k, cells);
    item.fallback = true;
    return item;
  }

  function validate(item) {
    if (!item || item.ex !== 'patterns') return 'not a patterns item';
    var p = item.params;
    if (!p || !SIZES[p.size] || !REGULARITY[p.regularity]) return 'bad params';
    var s = SIZES[p.size];
    if (item.rows !== s[0] || item.cols !== s[1] || item.k !== s[2]) return 'grid or filled count does not match the level';
    var cells = item.key, N = s[0] * s[1];
    if (!Array.isArray(cells) || cells.length !== s[2]) return 'filled count ' + (cells && cells.length) + ' ≠ ' + s[2];
    for (var i = 0; i < cells.length; i++) {
      if (!Number.isInteger(cells[i]) || cells[i] < 0 || cells[i] >= N) return 'cell id out of range';
      if (i && cells[i] <= cells[i - 1]) return 'key not sorted or has duplicates';
    }
    var c = clusters(cells, s[0], s[1]), b = band(p);
    if (c !== item.clusters) return 'stored cluster count is wrong';
    if (c < b[0] || c > b[1]) return c + ' clusters is outside the ' + REGULARITY[p.regularity] + ' band ' + b.join('–');
    if (p.regularity > 0 && fullLines(cells, s[0], s[1])) return 'a full row or column above the shapes level';
    if (item.exposureMs !== EXPOSURE_MS) return 'exposure must be 3 s';
    return true;
  }

  function generate(rng, params) {
    for (var i = 0; i < 50; i++) {
      var r = i ? rng.fork('retry' + i) : rng;
      var item = attempt(r, params);
      if (item) {
        item.seed = rng.seed;
        if (validate(item) === true) return item;
      }
    }
    return fallback(rng.seed, params);
  }

  function score(item, response) {
    var N = item.rows * item.cols, inKey = {}, seen = {}, hits = 0, fa = 0, i;
    for (i = 0; i < item.key.length; i++) inKey[item.key[i]] = true;
    var arr = Array.isArray(response) ? response : [];
    for (i = 0; i < arr.length; i++) {
      var id = arr[i];
      if (!Number.isInteger(id) || id < 0 || id >= N || seen[id]) continue;
      seen[id] = true;
      if (inKey[id]) hits++; else fa++;
    }
    var misses = item.key.length - hits;
    return {
      correct: misses === 0 && fa === 0,
      value: (N - misses - fa) / N,
      detail: { hits: hits, misses: misses, falseAlarms: fa },
    };
  }

  // The shared model for the view and the tests (def.lib; def.helpers is the same object).
  var LIB = { clusters: clusters, fullLines: fullLines, band: band, SIZES: SIZES, CLUSTER_BANDS: CLUSTER_BANDS, fallback: fallback, EXPOSURE_MS: EXPOSURE_MS };

  PX.ex.define({
    id: 'patterns', version: 1, code: 'PR-4', name: 'Pattern Memory', short: 'Patterns',
    abilities: ['MV'], cell: 'extrinsic-static', role: 'probe', answer: 'targets',
    dims: [
      { key: 'size', label: 'Grid and filled cells', levels: ['3×3 · 4', '3×4 · 6', '4×4 · 8', '4×5 · 10', '5×5 · 12', '5×6 · 15', '6×6 · 18'], step: 0.45 },
      { key: 'regularity', label: 'Pattern', levels: REGULARITY, step: 0.75 },
    ],
    base: -2.1,
    // A blind guess of the exact set: 1 / C(cells, filled), kept tiny but positive.
    chance: function (params) {
      var s = SIZES[params && SIZES[params.size] ? params.size : 0];
      return Math.max(1 / comb(s[0] * s[1], s[2]), 0.001);
    },
    // Time to mark the cells once the grid is empty (a calm countdown in the view): 15 s + 1 s per filled cell.
    timeLimit: function (params) { var s = SIZES[params && SIZES[params.size] ? params.size : 0]; return 15000 + 1000 * s[2]; },
    exposureMs: EXPOSURE_MS,
    generate: generate,
    validate: validate,
    score: score,
    lib: LIB,
    helpers: LIB,
  });
})(window.PX);
