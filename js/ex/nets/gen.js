/* EX-05 Nets: cube nets with unoriented marks (pure; ARCHITECTURE.md §5).

   Six squares on a grid (x to the right, y downwards) carry names (letters or digits) and
   colours. The marks are unoriented: no question depends on how a mark is turned (oriented
   cube matching belongs to the probe PR-1).

   Variants (answer 'choice'; items carry their options, so use item.options.length):
   - 'opposite': one face is marked (and lies on the table); which face ends up opposite it?
     4 options (the opposite face and 3 of the 4 faces adjacent to it); chance 1/4.
   - 'edges': two free edges of a net are marked; do they meet when the net is folded into a
     cube (Shepard & Feng 1972)? A shaded base square stays on the table. Options Yes, No
     (key 0 = yes, 1 = no); chance 1/2.
   - 'cube': does this hexomino fold into a cube? One of the 11 nets or of the other 24 free
     hexominoes. Options Yes, No; chance 1/2.
   item.format is 'choice' or 'yesno' for the view.

   Exact folding (generator): each square gets a cube face by rolling a cube over the net from
   the base square (the face that touches the square); a square's edge is the cube edge between
   its face and the face on that side, so two free edges meet when they map to the same cube
   edge; faces are opposite when their codes are; a hexomino folds when it has no 2 × 2 block
   (5 adjacencies, a tree) and the rolling gives six different faces. The validator recomputes
   all of it with a second method: unit squares folded in 3D (integer rotations about the
   hinges), then compared.

   Squares carried (Shepard & Feng): with the base square fixed, a fold at a hinge carries every
   square beyond it that lies on the way to a marked square; summed over the folds that bring
   the marked squares into place, that is Σ depth(s) over the squares on the paths from the base
   to the marked squares (base excluded). 'edges' uses it (dim `carried`, binned); for 'opposite'
   it is fixed by the distance (the marked face is the base), so 'opposite' uses dim `between`
   instead: the faces between the marked face and its opposite along the net (2 or 3). Every
   pair at net distance 2 lies in a straight row (the "skip one" rule decides all of them), and
   the only pairs at distance 5 (the two flaps at opposite ends of a 1-4-1 net) are always the
   farthest faces, so scored 'opposite' items use distances 3 and 4; the others are left to the
   tutorial. Edge pairs on the two squares of a concave corner (they always meet) appear
   only at the lowest `carried` level, as at most half of its "yes" pairs.

   Net shape (dim `shape`): 0 '1-4-1' (a row of four, 6 nets), 1 '2-3-1' (3 nets),
   2 '2-2-2 / 3-3' (2 nets); long rows allow shortcuts (Burte et al. 2019). For 'cube' the level
   also picks the other hexominoes so that "has 4 in a row" says nothing: level 0 pairs the
   1-4-1 nets with the 11 hexominoes that have 4 or more in a row, levels 1–2 pair the other
   nets with hexominoes whose longest row is 3 (level 2: trees only, the most net-like).

   Item: { ex, v, seed, params, key, variant, format, options, squares: [{ x, y, name, colour,
   face, parent, hinge }], base, marked?, edges?: [{ sq, side }, …], info }. For a 3D folding
   animation each square names its parent in a fold tree from the base square and the hinge
   (the parent's side it hangs from: 'N', 'E', 'S', 'W'); face is its cube face by rolling
   ('B' bottom = the base, 'T' top, 'N', 'E', 'S', 'W' sides as seen from the base). 'cube'
   items also give isNet, overlap (squares landing on the same face) and block (a 2 × 2 block). */
(function (PX) {
  'use strict';

  // Globals cached once: inside a node:vm context (the tests) every global lookup is slow.
  var floor = Math.floor, abs = Math.abs, sqrt = Math.sqrt, INF = Infinity, isArray = Array.isArray, isInt = Number.isInteger;

  var VARIANTS = ['opposite', 'edges', 'cube'];
  var CARRIED = [[2, 4], [5, 6], [7, 8], [9, 10], [11, 15]];
  var CARRIED_LABELS = ['2-4', '5-6', '7-8', '9-10', '11-15'];
  var SHAPES = ['1-4-1', '2-3-1', '2-2-2 / 3-3'];
  var BETWEEN = [2, 3];
  var SIDES = ['N', 'E', 'S', 'W'];
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var OPPSIDE = [2, 3, 0, 1];
  var FACES = ['B', 'T', 'N', 'E', 'S', 'W'];
  var OPPF = [1, 0, 4, 5, 2, 3];
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'], DIGITS = ['1', '2', '3', '4', '5', '6'];

  /* ---------- hexominoes ---------- */

  function cellKey(x, y) { return x + ',' + y; }
  function normalise(cells) {
    var mx = INF, my = INF;
    cells.forEach(function (c) { if (c[0] < mx) mx = c[0]; if (c[1] < my) my = c[1]; });
    return cells.map(function (c) { return [c[0] - mx, c[1] - my]; });
  }
  var SYMS = [
    function (c) { return [c[0], c[1]]; }, function (c) { return [-c[1], c[0]]; },
    function (c) { return [-c[0], -c[1]]; }, function (c) { return [c[1], -c[0]]; },
    function (c) { return [-c[0], c[1]]; }, function (c) { return [c[1], c[0]]; },
    function (c) { return [c[0], -c[1]]; }, function (c) { return [-c[1], -c[0]]; },
  ];
  function shapeKey(cells) {
    return normalise(cells).map(function (c) { return cellKey(c[0], c[1]); }).sort().join(';');
  }
  function canonical(cells) {
    var best = null;
    SYMS.forEach(function (f) { var k = shapeKey(cells.map(f)); if (best === null || k < best) best = k; });
    return best;
  }
  function enumerateHexominoes() {
    var polys = {}, list = [[[0, 0]]];
    for (var n = 2; n <= 6; n++) {
      var next = {}, out = [];
      list.forEach(function (cells) {
        var has = {};
        cells.forEach(function (c) { has[cellKey(c[0], c[1])] = true; });
        cells.forEach(function (c) {
          for (var d = 0; d < 4; d++) {
            var q = [c[0] + DX[d], c[1] + DY[d]];
            if (has[cellKey(q[0], q[1])]) continue;
            var cc = normalise(cells.concat([q])), k = canonical(cc);
            if (!next[k]) { next[k] = true; out.push(cc); }
          }
        });
      });
      list = out;
      polys = next;
    }
    // Canonical cell order (reading order of the canonical key) so data does not depend on the search.
    return Object.keys(polys).sort().map(function (k) {
      return k.split(';').map(function (s) { var p = s.split(','); return [+p[0], +p[1]]; }).sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
    });
  }

  // Index of the square at (x, y) in cells, or −1.
  function indexAt(cells, x, y) {
    for (var i = 0; i < cells.length; i++) if (cells[i][0] === x && cells[i][1] === y) return i;
    return -1;
  }
  function neighbours(cells) {
    return cells.map(function (c) {
      var nb = [];
      for (var d = 0; d < 4; d++) nb.push(indexAt(cells, c[0] + DX[d], c[1] + DY[d]));
      return nb; // nb[side] = square index or −1
    });
  }
  function graphDist(nb) {
    return nb.map(function (_, i) {
      var d = nb.map(function () { return -1; }), q = [i];
      d[i] = 0;
      while (q.length) {
        var a = q.shift();
        for (var s = 0; s < 4; s++) { var b = nb[a][s]; if (b >= 0 && d[b] < 0) { d[b] = d[a] + 1; q.push(b); } }
      }
      return d;
    });
  }
  function hasBlock(cells) {
    return cells.some(function (c) {
      return indexAt(cells, c[0] + 1, c[1]) >= 0 && indexAt(cells, c[0], c[1] + 1) >= 0 && indexAt(cells, c[0] + 1, c[1] + 1) >= 0;
    });
  }
  function blockOf(cells) {
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i], a = indexAt(cells, c[0] + 1, c[1]), b = indexAt(cells, c[0], c[1] + 1), d = indexAt(cells, c[0] + 1, c[1] + 1);
      if (a >= 0 && b >= 0 && d >= 0) return [i, a, b, d];
    }
    return null;
  }
  // Longest straight run of squares, and the most parallel maximal runs of exactly 3 (two in
  // the 3-3 net; a 2-3-1 net can have one across and one down, which are not parallel).
  function rows(cells) {
    var longest = 0, threes = [0, 0];
    cells.forEach(function (c) {
      [[1, 0], [0, 1]].forEach(function (d, dir) {
        if (indexAt(cells, c[0] - d[0], c[1] - d[1]) >= 0) return; // not the start of a run
        var k = 0;
        while (indexAt(cells, c[0] + d[0] * k, c[1] + d[1] * k) >= 0) k++;
        if (k > longest) longest = k;
        if (k === 3) threes[dir]++;
      });
    });
    return { longest: longest, threes: threes[0] > threes[1] ? threes[0] : threes[1] };
  }
  function adjacencies(nb) {
    var n = 0;
    nb.forEach(function (row) { if (row[1] >= 0) n++; if (row[2] >= 0) n++; });
    return n;
  }

  /* ---------- rolling a cube over the net (the generator's model) ---------- */

  // Orientation o: o[0] the face down, o[1] up, o[2..5] the faces towards N, E, S, W.
  function roll(o, side) {
    var d = o[0], u = o[1], n = o[2], e = o[3], s = o[4], w = o[5];
    switch (side) {
      case 0: return [n, s, u, e, d, w];  // towards N: the north face goes down
      case 1: return [e, w, n, u, s, d];  // towards E
      case 2: return [s, n, d, e, u, w];  // towards S
      default: return [w, e, n, d, s, u]; // towards W
    }
  }
  // Fold tree from the base (breadth first, sides in N, E, S, W order) and each square's
  // orientation; face[i] = the face on square i (0 'B' on the base).
  function rollNet(cells, nb, base) {
    var n = cells.length, parent = [], hinge = [], orient = [], order = [base];
    for (var i = 0; i < n; i++) { parent.push(-2); hinge.push(-1); orient.push(null); }
    parent[base] = -1;
    orient[base] = [0, 1, 2, 3, 4, 5];
    for (var q = 0; q < order.length; q++) {
      var a = order[q];
      for (var s = 0; s < 4; s++) {
        var b = nb[a][s];
        if (b < 0 || parent[b] !== -2) continue;
        parent[b] = a; hinge[b] = s; orient[b] = roll(orient[a], s);
        order.push(b);
      }
    }
    return { parent: parent, hinge: hinge, orient: orient, order: order, face: orient.map(function (o) { return o ? o[0] : -1; }) };
  }
  // The cube edge (unordered face pair) that square i's side s maps to.
  function cubeEdge(orient, i, s) {
    var a = orient[i][0], b = orient[i][2 + s];
    return a < b ? a * 6 + b : b * 6 + a;
  }
  function isNetShape(cells) {
    var nb = neighbours(cells);
    if (adjacencies(nb) !== 5) return false;
    var f = rollNet(cells, nb, 0).face, seen = {};
    for (var i = 0; i < f.length; i++) { if (seen[f[i]]) return false; seen[f[i]] = true; }
    return true;
  }

  /* ---------- tables (built once, on first use) ---------- */

  var DATA = null;
  function data() {
    if (DATA) return DATA;
    var shapes = enumerateHexominoes().map(function (cells, id) {
      var nb = neighbours(cells), r = rows(cells), net = isNetShape(cells);
      return {
        id: id, cells: cells, nb: nb, dist: graphDist(nb), net: net, block: hasBlock(cells), longest: r.longest,
        group: !net ? -1 : r.longest === 4 ? 0 : r.longest === 2 || r.threes >= 2 ? 2 : 1,
      };
    });
    var nets = shapes.filter(function (s) { return s.net; });
    var cube = [0, 1, 2].map(function (lv) {
      return {
        nets: nets.filter(function (s) { return s.group === lv; }),
        others: shapes.filter(function (s) {
          if (s.net) return false;
          if (lv === 0) return s.longest >= 4;
          return s.longest === 3 && (lv === 1 || !s.block);
        }),
      };
    });
    // 'opposite': the marked square m (the base) and its opposite o at net distance ≥ 3.
    var opposite = [];
    nets.forEach(function (s) {
      for (var m = 0; m < 6; m++) {
        var rn = rollNet(s.cells, s.nb, m), o = rn.face.indexOf(1), d = s.dist[m][o];
        if (d >= 3) opposite.push({ shape: s, m: m, o: o, d: d, adj: [0, 1, 2, 3, 4, 5].filter(function (i) { return i !== m && i !== o; }) });
      }
    });
    // 'edges': every pair of free edges on different squares, with every base square.
    var edges = [];
    nets.forEach(function (s) {
      var rn = rollNet(s.cells, s.nb, 0), free = [];
      for (var i = 0; i < 6; i++) {
        for (var sd = 0; sd < 4; sd++) {
          if (s.nb[i][sd] >= 0) continue;
          free.push({ sq: i, side: sd, ce: cubeEdge(rn.orient, i, sd), mx: s.cells[i][0] + 0.5 + DX[sd] * 0.5, my: s.cells[i][1] + 0.5 + DY[sd] * 0.5 });
        }
      }
      for (var a = 0; a < free.length; a++) {
        for (var b = a + 1; b < free.length; b++) {
          var ea = free[a], eb = free[b];
          if (ea.sq === eb.sq) continue;
          var meet = ea.ce === eb.ce, L = s.dist[ea.sq][eb.sq];
          var fd = sqrt((ea.mx - eb.mx) * (ea.mx - eb.mx) + (ea.my - eb.my) * (ea.my - eb.my));
          for (var base = 0; base < 6; base++) {
            edges.push({ shape: s, e: [ea, eb], base: base, meet: meet, notch: meet && L === 2, L: L, fd: fd, carried: carried(s, base, [ea.sq, eb.sq]) });
          }
        }
      }
    });
    DATA = { shapes: shapes, nets: nets, cube: cube, opposite: opposite, edges: edges };
    return DATA;
  }

  // Shepard & Feng's squares carried: Σ depth(s) over the squares on the paths from the base to
  // the marked squares (the base excluded); each square is carried once per hinge it crosses.
  function carried(s, base, marked) {
    var on = {}, total = 0, dist = s.dist[base];
    marked.forEach(function (t) {
      var cur = t;
      while (cur !== base) {
        on[cur] = true;
        var next = -1;
        for (var sd = 0; sd < 4 && next < 0; sd++) { var b = s.nb[cur][sd]; if (b >= 0 && dist[b] === dist[cur] - 1) next = b; }
        cur = next;
      }
    });
    for (var k in on) total += dist[+k];
    return total;
  }

  /* ---------- items ---------- */

  function rint(r, n) { return floor(r.next() * n); }
  function shuffle(r, arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) { var j = floor(r.next() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }
  function sideOf(dx, dy) { for (var s = 0; s < 4; s++) if (DX[s] === dx && DY[s] === dy) return s; return -1; }

  // A random turn or flip of the shape (square indices kept), with the side map it implies.
  function orient(r, cells) {
    var f = SYMS[rint(r, 8)];
    var sides = [0, 1, 2, 3].map(function (s) { var v = f([DX[s], DY[s]]); return sideOf(v[0], v[1]); });
    return { cells: normalise(cells.map(f)), side: sides };
  }

  // Squares with names, colours, fold tree from the base and rolled faces.
  function buildSquares(r, cells, base) {
    var nb = neighbours(cells), rn = rollNet(cells, nb, base);
    var names = r.next() < 0.5 ? LETTERS : DIGITS, perm = shuffle(r, [0, 1, 2, 3, 4, 5]), col = shuffle(r, [0, 1, 2, 3, 4, 5]);
    var squares = cells.map(function (c, i) {
      return { x: c[0], y: c[1], name: names[perm[i]], colour: col[i], face: rn.face[i] >= 0 ? FACES[rn.face[i]] : null, parent: rn.parent[i], hinge: rn.hinge[i] >= 0 ? SIDES[rn.hinge[i]] : null };
    });
    return { squares: squares, nb: nb, rn: rn };
  }

  function dist2(cells, a, b) { var dx = cells[a][0] - cells[b][0], dy = cells[a][1] - cells[b][1]; return dx * dx + dy * dy; }
  // Expected accuracy of "pick the best-scoring option" (uniform among ties); key at index 0.
  function pickAcc(scores) {
    var best = -INF, ties = 0;
    scores.forEach(function (s) { if (s > best + 1e-9) { best = s; ties = 1; } else if (abs(s - best) <= 1e-9) ties++; });
    return abs(scores[0] - best) <= 1e-9 ? 1 / ties : 0;
  }

  // 'opposite': the configuration (net, marked face at the wanted distance) and the adjacent
  // face left out are chosen against three shortcuts: the option farthest from the marked face
  // in the flat net (straight-line and along the net) and the option square most central among
  // the options. Each should pick the key in about a quarter of the items: per item a random
  // target (hit with probability ¼) for each, and the candidate closest to the targets.
  function genOpposite(r, p) {
    var D = data(), g = p.shape, cfgs = D.opposite.filter(function (c) { return c.shape.group === g; });
    var maxD = 0;
    cfgs.forEach(function (c) { if (c.d > maxD) maxD = c.d; });
    var d = Math.min(BETWEEN[p.between] + 1, maxD);
    cfgs = cfgs.filter(function (c) { return c.d === d; });
    var cands = [];
    cfgs.forEach(function (c) { c.adj.forEach(function (ex) { cands.push({ c: c, opts: [c.o].concat(c.adj.filter(function (a) { return a !== ex; })) }); }); });
    var tE = r.next() < 0.25 ? 1 : 0, tG = tE, tC = r.next() < 0.25 ? 1 : 0, best = null, bestCost = INF; // the two distances agree mostly: one target
    shuffle(r, cands).forEach(function (k) {
      var cells = k.c.shape.cells, m = k.c.m, dist = k.c.shape.dist[m];
      var hE = pickAcc(k.opts.map(function (i) { return dist2(cells, m, i); }));
      var hG = pickAcc(k.opts.map(function (i) { return dist[i]; }));
      var hC = pickAcc(k.opts.map(function (i) { var t = 0; k.opts.forEach(function (j) { t += sqrt(dist2(cells, i, j)); }); return -t; }));
      var cost = abs(hE - tE) + abs(hG - tG) + abs(hC - tC);
      if (cost < bestCost) { bestCost = cost; best = k; }
    });
    var c = best.c, o = orient(r, c.shape.cells), b = buildSquares(r, o.cells, c.m);
    var perm = shuffle(r, [0, 1, 2, 3]), opts = perm.map(function (i) { return best.opts[i]; });
    return {
      variant: 'opposite', format: 'choice', squares: b.squares, base: c.m, marked: c.m,
      nOptions: 4, options: opts.map(function (sq) { return { sq: sq, name: b.squares[sq].name, colour: b.squares[sq].colour }; }),
      key: perm.indexOf(0),
      info: { shape: c.shape.id, group: g, d: d, between: d - 1, carried: d * (d + 1) / 2 },
    };
  }

  // 'edges': the answer is yes or no with probability ½. A "no" pair is matched to a random
  // "yes" pair of the same level by flat distance between the edge midpoints, so closeness in
  // the flat net does not tell whether edges meet.
  var EDGE_CELLS = {};
  function edgeCell(g, lv) {
    var k = g * 10 + lv;
    if (EDGE_CELLS[k]) return EDGE_CELLS[k];
    var rg = CARRIED[lv], yes = [], no = [];
    data().edges.forEach(function (e) {
      if (e.shape.group !== g || e.carried < rg[0] || e.carried > rg[1] || (e.notch && lv > 0)) return;
      (e.meet ? yes : no).push(e);
    });
    EDGE_CELLS[k] = { yes: yes, no: no };
    return EDGE_CELLS[k];
  }
  function genEdges(r, p) {
    // Concave-corner pairs (always meet, 0.71 apart) are at most half of the "yes" pairs.
    var cell = edgeCell(p.shape, p.carried), meet = r.next() < 0.5, corner = r.next() < 0.5;
    var yes = cell.yes.filter(function (e) { return e.notch === corner; });
    if (!yes.length) yes = cell.yes;
    var ref = yes[rint(r, yes.length)], e = ref;
    if (!meet) {
      var bestD = INF, list = [];
      cell.no.forEach(function (x) {
        var dd = abs(x.fd - ref.fd);
        if (dd < bestD - 1e-9) { bestD = dd; list = [x]; } else if (abs(dd - bestD) <= 1e-9) list.push(x);
      });
      e = list[rint(r, list.length)];
    }
    var o = orient(r, e.shape.cells), b = buildSquares(r, o.cells, e.base);
    return {
      variant: 'edges', format: 'yesno', squares: b.squares, base: e.base,
      edges: e.e.map(function (x) { return { sq: x.sq, side: SIDES[o.side[x.side]] }; }),
      nOptions: 2, options: [{ label: 'Yes', value: true }, { label: 'No', value: false }], key: e.meet ? 0 : 1,
      info: { shape: e.shape.id, group: p.shape, carried: e.carried, L: e.L, fd: Math.round(e.fd * 1000) / 1000, meet: e.meet },
    };
  }

  // 'cube': a net of the level's group or one of the level's other hexominoes, ½ each. The base
  // (for the folding animation) is the square closest to all others.
  function genCube(r, p) {
    // Hexominoes with a 2 × 2 block are drawn half as often as the others: "a block never folds"
    // is true but decides at a glance, so it should not decide too many items.
    var pool = data().cube[p.shape], isNet = r.next() < 0.5, list = isNet ? pool.nets : pool.others, s;
    if (isNet) s = list[rint(r, list.length)];
    else {
      var wsum = 0;
      list.forEach(function (x) { wsum += x.block ? 0.5 : 1; });
      var pick = r.next() * wsum;
      for (var q = 0; q < list.length; q++) { pick -= list[q].block ? 0.5 : 1; if (pick < 0 || q === list.length - 1) { s = list[q]; break; } }
    }
    var tot = s.dist.map(function (row) { var t = 0; row.forEach(function (v) { t += v; }); return t; }), mn = INF, centre = [];
    tot.forEach(function (t, i) { if (t < mn) { mn = t; centre = [i]; } else if (t === mn) centre.push(i); });
    var base = centre[rint(r, centre.length)], o = orient(r, s.cells), b = buildSquares(r, o.cells, base);
    var overlap = [];
    for (var i = 0; i < 6; i++) for (var j = i + 1; j < 6; j++) if (b.rn.face[i] === b.rn.face[j]) overlap.push([i, j]);
    return {
      variant: 'cube', format: 'yesno', squares: b.squares, base: base,
      nOptions: 2, options: [{ label: 'Yes', value: true }, { label: 'No', value: false }], key: s.net ? 0 : 1,
      isNet: s.net, overlap: overlap, block: blockOf(o.cells),
      info: { shape: s.id, group: p.shape, longest: s.longest },
    };
  }

  /* ---------- validator: the squares folded in 3D (a second, independent method) ----------
     Every square is 4 integer vertices on z = 0 with its inner normal +z. Along the item's fold
     tree from the base, each child's subtree turns 90° about the hinge it shares with its
     parent, towards the parent's inner side; rotations about axis-aligned hinges keep every
     coordinate an integer. The base is the bottom of the unit cube above it. */

  var CORNERS = [[0, 1], [1, 2], [2, 3], [3, 0]]; // vertex pairs of the N, E, S, W sides
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function addv(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function rot90(w, u, sgn) { var c = cross(u, w), d = dot(u, w); return [sgn * c[0] + d * u[0], sgn * c[1] + d * u[1], sgn * c[2] + d * u[2]]; }

  function fold3d(squares, base) {
    var n = squares.length, V = [], nrm = [], kids = [], i, q;
    for (i = 0; i < n; i++) {
      var s = squares[i];
      V.push([[s.x, s.y, 0], [s.x + 1, s.y, 0], [s.x + 1, s.y + 1, 0], [s.x, s.y + 1, 0]]);
      nrm.push([0, 0, 1]);
      kids.push([]);
    }
    for (i = 0; i < n; i++) if (i !== base) kids[squares[i].parent].push(i);
    var order = [base];
    for (q = 0; q < order.length; q++) order = order.concat(kids[order[q]]);
    function subtree(t) { var out = [t]; for (var k = 0; k < out.length; k++) out = out.concat(kids[out[k]]); return out; }
    for (q = 1; q < order.length; q++) {
      var c = order[q], pa = squares[c].parent, h = SIDES.indexOf(squares[c].hinge);
      var a = V[pa][CORNERS[h][0]], b = V[pa][CORNERS[h][1]], u = sub(b, a);
      var w = sub(addv(V[c][0], V[c][2]), addv(a, b)); // centre − hinge midpoint, doubled
      var sgn = dot(cross(u, w), nrm[pa]) > 0 ? 1 : -1;
      subtree(c).forEach(function (t) {
        for (var k = 0; k < 4; k++) V[t][k] = addv(a, rot90(sub(V[t][k], a), u, sgn));
        nrm[t] = rot90(nrm[t], u, sgn);
      });
    }
    var bx = squares[base].x, by = squares[base].y;
    var centres = [[2 * bx + 1, 2 * by + 1, 0], [2 * bx + 1, 2 * by + 1, 2], [2 * bx + 1, 2 * by, 1], [2 * bx + 2, 2 * by + 1, 1], [2 * bx + 1, 2 * by + 2, 1], [2 * bx, 2 * by + 1, 1]];
    var face = V.map(function (vs) {
      var cc = addv(vs[0], vs[2]);
      for (var f = 0; f < 6; f++) if (cc[0] === centres[f][0] && cc[1] === centres[f][1] && cc[2] === centres[f][2]) return f;
      return -1;
    });
    function edgeKey(t, side) {
      var p1 = V[t][CORNERS[side][0]].join(','), p2 = V[t][CORNERS[side][1]].join(',');
      return p1 < p2 ? p1 + '|' + p2 : p2 + '|' + p1;
    }
    return { V: V, face: face, edgeKey: edgeKey };
  }

  // Folds into a cube: six different faces, and every pair of squares that touch in the flat
  // net still shares that edge on the cube (a 2 × 2 block cannot: four squares at one corner).
  function folds3d(squares, f) {
    var seen = {}, i, s;
    for (i = 0; i < 6; i++) { if (f.face[i] < 0 || seen[f.face[i]]) return false; seen[f.face[i]] = true; }
    for (i = 0; i < 6; i++) {
      for (s = 0; s < 4; s++) {
        var j = indexAt(squares.map(function (q) { return [q.x, q.y]; }), squares[i].x + DX[s], squares[i].y + DY[s]);
        if (j >= 0 && f.edgeKey(i, s) !== f.edgeKey(j, OPPSIDE[s])) return false;
      }
    }
    return true;
  }

  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }

  function check(item) {
    if (!item || item.ex !== 'nets') return 'not a nets item';
    var p = item.params || {}, i, s;
    if (!(isInt(p.carried) && p.carried >= 0 && p.carried < CARRIED.length && isInt(p.shape) && p.shape >= 0 && p.shape < SHAPES.length
      && isInt(p.between) && p.between >= 0 && p.between < BETWEEN.length && VARIANTS.indexOf(p.variant) >= 0)) return 'bad params';
    if (item.variant !== p.variant) return 'variant';
    var sq = item.squares;
    if (!isArray(sq) || sq.length !== 6) return 'six squares';
    var cells = sq.map(function (q) { return [q.x, q.y]; }), names = {}, cols = {};
    for (i = 0; i < 6; i++) {
      if (!isInt(sq[i].x) || !isInt(sq[i].y) || sq[i].x < 0 || sq[i].y < 0) return 'square ' + i + ': position';
      if (indexAt(cells, sq[i].x, sq[i].y) !== i) return 'two squares at one place';
      if (typeof sq[i].name !== 'string' || names[sq[i].name]) return 'names must differ';
      if (!(isInt(sq[i].colour) && sq[i].colour >= 0 && sq[i].colour < 6) || cols[sq[i].colour]) return 'colours must differ';
      names[sq[i].name] = cols[sq[i].colour] = true;
    }
    var base = item.base;
    if (!(isInt(base) && base >= 0 && base < 6) || sq[base].parent !== -1) return 'base';
    for (i = 0; i < 6; i++) {
      if (i === base) continue;
      var pa = sq[i].parent, h = SIDES.indexOf(sq[i].hinge);
      if (!(isInt(pa) && pa >= 0 && pa < 6 && pa !== i) || h < 0) return 'square ' + i + ': fold tree';
      if (sq[pa].x + DX[h] !== sq[i].x || sq[pa].y + DY[h] !== sq[i].y) return 'square ' + i + ': hinge does not join its parent';
      var cur = i, steps = 0;
      while (cur !== base && steps++ < 6) cur = sq[cur].parent;
      if (cur !== base) return 'square ' + i + ': fold tree does not reach the base';
    }
    var f = fold3d(sq, base), foldsUp = folds3d(sq, f);
    if (!isArray(item.options)) return 'options';
    // Net distance (breadth first over touching squares), for the dims.
    var dist = [0, 1, 2, 3, 4, 5].map(function () { return -1; }), queue = [base];
    dist[base] = 0;
    while (queue.length) {
      var a = queue.shift();
      for (s = 0; s < 4; s++) { var b = indexAt(cells, cells[a][0] + DX[s], cells[a][1] + DY[s]); if (b >= 0 && dist[b] < 0) { dist[b] = dist[a] + 1; queue.push(b); } }
    }
    if (dist.indexOf(-1) >= 0) return 'the squares are not connected';

    if (p.variant === 'opposite') {
      if (!foldsUp) return 'not a net';
      if (item.marked !== base) return 'the marked face is the base';
      if (item.options.length !== 4 || item.nOptions !== 4) return 'four options';
      var nOpp = 0, used = {};
      for (i = 0; i < 4; i++) {
        var o = item.options[i];
        if (!o || !isInt(o.sq) || o.sq < 0 || o.sq > 5 || o.sq === base || used[o.sq]) return 'option ' + i + ': square';
        if (o.name !== sq[o.sq].name || o.colour !== sq[o.sq].colour) return 'option ' + i + ': mark';
        used[o.sq] = true;
        var ca = addv(f.V[base][0], f.V[base][2]), cb = addv(f.V[o.sq][0], f.V[o.sq][2]);
        var cube2 = [2 * (2 * sq[base].x + 1), 2 * (2 * sq[base].y + 1), 2]; // twice the cube centre, doubled
        if (ca[0] + cb[0] === cube2[0] && ca[1] + cb[1] === cube2[1] && ca[2] + cb[2] === cube2[2]) {
          nOpp++;
          if (i !== item.key) return 'the opposite face is not the key';
          if (dist[o.sq] < 3) return 'opposite at distance ' + dist[o.sq] + ' (the straight-row rule decides it)';
          if (!item.info || item.info.d !== dist[o.sq]) return 'info.d';
          var dEff = Math.min(BETWEEN[p.between] + 1, [4, 4, 3][p.shape]);
          if (dist[o.sq] !== dEff) return 'distance ' + dist[o.sq] + ' for between level ' + p.between;
        }
      }
      if (nOpp !== 1) return nOpp + ' options are opposite the marked face';
      return true;
    }
    if (item.options.length !== 2 || item.nOptions !== 2 || item.options[0].value !== true || item.options[1].value !== false) return 'options Yes, No';
    if (!(item.key === 0 || item.key === 1)) return 'key';
    if (p.variant === 'edges') {
      if (!foldsUp) return 'not a net';
      var E = item.edges;
      if (!isArray(E) || E.length !== 2) return 'two edges';
      var sideIx = E.map(function (e) { return SIDES.indexOf(e.side); });
      for (i = 0; i < 2; i++) {
        if (!isInt(E[i].sq) || E[i].sq < 0 || E[i].sq > 5 || sideIx[i] < 0) return 'edge ' + i;
        if (indexAt(cells, cells[E[i].sq][0] + DX[sideIx[i]], cells[E[i].sq][1] + DY[sideIx[i]]) >= 0) return 'edge ' + i + ' is a hinge';
      }
      if (E[0].sq === E[1].sq) return 'the edges are on one square';
      var meet = f.edgeKey(E[0].sq, sideIx[0]) === f.edgeKey(E[1].sq, sideIx[1]);
      if (item.key !== (meet ? 0 : 1)) return 'key: the edges ' + (meet ? 'meet' : 'do not meet');
      // Squares carried, from the base: each square on the way to a marked square, once per hinge.
      var on = {}, car = 0;
      E.forEach(function (e) { var cur2 = e.sq; while (cur2 !== base) { on[cur2] = true; cur2 = sq[cur2].parent; } });
      for (var kk in on) car += dist[+kk];
      if (!item.info || item.info.carried !== car) return 'carried ' + car + ' (info ' + (item.info && item.info.carried) + ')';
      if (car < CARRIED[p.carried][0] || car > CARRIED[p.carried][1]) return 'carried ' + car + ' outside level ' + p.carried;
      var L = 0, x0 = E[0].sq, x1 = E[1].sq, up0 = [], cc0 = x0;
      while (true) { up0.push(cc0); if (cc0 === base) break; cc0 = sq[cc0].parent; }
      var cc1 = x1, k1 = 0;
      while (up0.indexOf(cc1) < 0) { cc1 = sq[cc1].parent; k1++; }
      L = up0.indexOf(cc1) + k1;
      if (meet && L === 2 && p.carried !== 0) return 'a concave-corner pair above the lowest level';
      return true;
    }
    // 'cube'
    if (item.key !== (foldsUp ? 0 : 1)) return 'key: the shape ' + (foldsUp ? 'folds' : 'does not fold');
    if (!!item.isNet !== foldsUp) return 'isNet';
    var longest = rows(cells).longest;
    if ((p.shape === 0) !== (longest >= 4)) return 'a row of ' + longest + ' at shape level ' + p.shape;
    return true;
  }

  function score(item, response) { return { correct: response === item.key }; }

  function normParams(params) {
    var p = {};
    ['carried', 'shape', 'between'].forEach(function (k) { var v = params ? params[k] : 0; p[k] = isInt(v) ? v : 0; });
    p.variant = params && VARIANTS.indexOf(params.variant) >= 0 ? params.variant : VARIANTS[0];
    return p;
  }

  // Variant by variant: 'opposite' by the faces between (as far as the shape group allows:
  // distance 4 does not occur in 2-2-2 / 3-3 nets) and shape; 'edges' by squares carried
  // and shape; 'cube' by shape level.
  function difficulty(params) {
    var p = normParams(params);
    if (p.variant === 'opposite') return -0.8 + 0.6 * (Math.min(BETWEEN[p.between] + 1, [4, 4, 3][p.shape]) - 3) + 0.4 * p.shape;
    if (p.variant === 'edges') return -1.4 + 0.75 * p.carried + 0.4 * p.shape;
    return -1.7 + 0.6 * p.shape;
  }

  var fallbackCache = {};
  function generate(rng, params) {
    var p = normParams(params), item = null;
    for (var i = 0; i < 50; i++) {
      var r = i === 0 ? rng : rng.fork('retry' + i);
      var body = p.variant === 'edges' ? genEdges(r, p) : p.variant === 'cube' ? genCube(r, p) : genOpposite(r, p);
      item = { ex: 'nets', v: 1, seed: rng.seed, params: p };
      for (var k in body) item[k] = body[k];
      if (validate(item) === true) return item;
    }
    item = fallbackFor(p) || item; // never reached in the tests
    item.seed = rng.seed;
    item.fallback = true;
    return item;
  }

  // A valid item for these params from a fixed search (the same for every seed, so cached).
  function fallbackFor(params) {
    var p = normParams(params), pk = PX.ex.paramsKey(p);
    for (var j = 0; j < 200 && !fallbackCache[pk]; j++) {
      var r2 = PX.rng(PX.rng.hash('nets-fallback', pk, j));
      var b2 = p.variant === 'edges' ? genEdges(r2, p) : p.variant === 'cube' ? genCube(r2, p) : genOpposite(r2, p), it2 = { ex: 'nets', v: 1, seed: 0, params: p };
      for (var k2 in b2) it2[k2] = b2[k2];
      if (validate(it2) === true) fallbackCache[pk] = it2;
    }
    if (!fallbackCache[pk]) return null;
    var out = PX.util.deepCopy(fallbackCache[pk]);
    out.fallback = true;
    return out;
  }

  /* ---------- for the view: poses at any hinge angle, edge partners ---------- */

  function flatCorners(q) { return [[q.x, q.y, 0], [q.x + 1, q.y, 0], [q.x + 1, q.y + 1, 0], [q.x, q.y + 1, 0]]; }
  // 3 × 4 affine matrices [r00 r01 r02 t0, r10 r11 r12 t1, r20 r21 r22 t2].
  function mmul(A, B) {
    var o = [];
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 4; c++) {
        var v = A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c];
        if (c === 3) v += A[r * 4 + 3];
        o.push(v);
      }
    }
    return o;
  }
  function mapply(M, p) {
    return [M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3], M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7], M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11]];
  }
  // Turn by th (radians) about the line through a with unit direction u (Rodrigues).
  function rotAbout(a, u, th) {
    var c = Math.cos(th), s = Math.sin(th), t = 1 - c, x = u[0], y = u[1], z = u[2];
    var R = [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
    var ra = [R[0] * a[0] + R[1] * a[1] + R[2] * a[2], R[3] * a[0] + R[4] * a[1] + R[5] * a[2], R[6] * a[0] + R[7] * a[1] + R[8] * a[2]];
    return [R[0], R[1], R[2], a[0] - ra[0], R[3], R[4], R[5], a[1] - ra[1], R[6], R[7], R[8], a[2] - ra[2]];
  }
  // The squares' corners in 3D for hinge angles (radians per square; the base's is ignored),
  // along the item's fold tree, every child turning towards its parent's inner side exactly as
  // in fold3d: at π/2 everywhere this is fold3d's cube (the node test checks it). The show-me
  // animation draws these poses. → per square [[x, y, z] × 4] (corners N-W, N-E, S-E, S-W).
  function foldPose(squares, base, angles) {
    var n = squares.length, M = [], kids = [], i, q;
    for (i = 0; i < n; i++) { kids.push([]); M.push(null); }
    for (i = 0; i < n; i++) if (i !== base) kids[squares[i].parent].push(i);
    M[base] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
    var order = [base];
    for (q = 0; q < order.length; q++) order = order.concat(kids[order[q]]);
    for (q = 1; q < order.length; q++) {
      var c = order[q], pa = squares[c].parent, h = SIDES.indexOf(squares[c].hinge);
      var cs = flatCorners(squares[pa]), a = cs[CORNERS[h][0]], b = cs[CORNERS[h][1]];
      var u = [b[0] - a[0], b[1] - a[1], 0];
      var w = [squares[c].x + 0.5 - (a[0] + b[0]) / 2, squares[c].y + 0.5 - (a[1] + b[1]) / 2];
      var sgn = u[0] * w[1] - u[1] * w[0] > 0 ? 1 : -1; // (u × w)·z: towards the inner side
      M[c] = mmul(M[pa], rotAbout(a, u, sgn * (angles[c] || 0)));
    }
    return squares.map(function (sq, k) { return flatCorners(sq).map(function (pt) { return mapply(M[k], pt); }); });
  }
  // The cube edge of every free edge of an item's net, by rolling from its base:
  // code(sq, side) → face-pair code or −1; partner(sq, side) → { sq, side } of the free edge
  // that meets it on the cube, or null.
  function edgeMap(item) {
    var cells = item.squares.map(function (q) { return [q.x, q.y]; }), nb = neighbours(cells), rn = rollNet(cells, nb, item.base);
    function code(sq, side) { var sd = typeof side === 'string' ? SIDES.indexOf(side) : side; return nb[sq][sd] < 0 && rn.orient[sq] ? cubeEdge(rn.orient, sq, sd) : -1; }
    return {
      code: code,
      partner: function (sq, side) {
        var c0 = code(sq, side);
        if (c0 < 0) return null;
        for (var i = 0; i < cells.length; i++) for (var sd = 0; sd < 4; sd++) if ((i !== sq || SIDES[sd] !== side) && code(i, sd) === c0) return { sq: i, side: SIDES[sd] };
        return null;
      },
    };
  }

  PX.ex.define({
    id: 'nets', version: 1, code: 'EX-05', name: 'Cube nets', short: 'Nets',
    abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'train',
    answer: 'choice', nOptions: 4, // 'opposite' 4 options, 'edges' and 'cube' Yes / No: use item.options.length
    dims: [
      { key: 'carried', label: 'Squares carried', levels: CARRIED_LABELS, step: 0.75 },
      { key: 'shape', label: 'Net shape', levels: SHAPES, step: 0.4 },
      { key: 'between', label: 'Faces between', levels: BETWEEN, step: 0.6 },
    ],
    base: -1.7,
    variants: VARIANTS,
    difficulty: difficulty,
    chance: function (params) { return normParams(params).variant === 'opposite' ? 0.25 : 0.5; },
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      VARIANTS: VARIANTS, CARRIED: CARRIED, SHAPES: SHAPES, BETWEEN: BETWEEN, SIDES: SIDES, FACES: FACES,
      data: data, rollNet: rollNet, neighbours: neighbours, fold3d: fold3d, folds3d: folds3d, rows: rows, indexAt: indexAt, carried: carried,
      foldPose: foldPose, edgeMap: edgeMap, fallback: fallbackFor, norm: normParams, CORNERS: CORNERS,
    },
  });
})(window.PX);
