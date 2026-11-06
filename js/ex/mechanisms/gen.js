/* PR-3 Mechanisms (probe; pure; ARCHITECTURE.md §5, PLAN.md §4, research/B-tasks.md §9 and §14b).

   A 2D drawing of gears, belts and a winch. The driver turns one way (arrow); the player answers
   one question about the marked axle: which way it turns (clockwise / counter-clockwise / it cannot
   turn), whether the weight on its drum goes up or down (or cannot move), or whether it turns
   faster than the driver, at the same speed, or slower. Mental animation (Hegarty 2004): errors and
   time grow along the causal chain; linear gear chains reduce to the parity rule (neighbouring gears
   turn opposite ways; Schwartz & Black), so every item needs more than parity: belts (open belts
   keep the direction, crossed belts reverse it), shared axles (wheels on one axle turn together, at
   the same angular speed), side branches and jams (an odd loop of meshing gears locks everything).

   Geometry (units; canvas W × H, y down, "clockwise" as seen on the screen). Gears mesh when their
   centre distance equals the sum of their radii exactly (pitch circles; teeth = 2 × radius); gears
   that do not mesh keep GAP between pitch circles (tooth tips 3 apart), pulleys and drums 2 units
   from every other axle's wheels; belt runs and the rope keep 3. Two gears on one axle (a compound gear) sit on two
   layers: the big wheel behind (layer 0), the small wheel in front (layer 1); gears mesh only on
   their own layer, and the only overlaps allowed are a front gear crossing the big wheel behind the
   small wheel it meshes with. Pulleys (belts) and drums (rope) sit in front, inside their axle's
   gear when the axle has one (by 4 units). Every mesh contact point and every axle centre stays
   visible. The answer options keep a fixed order (OPTIONS).

   validate rebuilds the meshing graph from the geometry (not from the generator's bookkeeping),
   propagates rotation with exact fractions from the driver, detects jams (a loop whose directions
   disagree), checks that loops run only through single gears (no belt or compound gear in a loop, so a
   jam is never a matter of belt slip or tooth ratios), that a jam sits in the driver's own gear
   group (not beyond a belt), that speed differences are clear (≥ 1.2× or exactly equal), and that
   the item matches its level (path length, belts, branches, loops).

   Item (JSON): { ex: 'mechanisms', seed, params, key, question, options, answers, W, H,
     axles: [{ id, x, y }], wheels: [{ id, axle, kind: 'gear'|'pulley'|'drum', r, layer, teeth? }],
     belts: [{ a: wheelId, b: wheelId, crossed }], driver: { axle, dir: 1 cw | −1 ccw }, target: axleId,
     rope: null | { wheel, side: 'left'|'right', length, weight: [x, y, w, h] }, info: { … generator notes } }
   key = index into options; answers[key] is 'cw' | 'ccw' | 'jam' | 'up' | 'down' | 'faster' | 'same' | 'slower'. */
(function (PX) {
  'use strict';

  var W = 200, H = 140, MARGIN = 3, TOOTH = 1.5; // gear teeth reach TOOTH beyond the pitch circle
  var GAP = 6, BELT_GAP = 3, EPS = 1e-6, SPEED_MARGIN = 1.2; // GAP: between rims of wheels that do not mesh
  var GEAR_R = [8, 10, 12, 14, 16], BIG_R = [14, 16, 18], PULLEY_R = [5, 6, 7, 8, 9, 10], DRUM_R = [5, 6, 7];
  var PATH = [3, 4, 5, 6];
  var STRUCT = ['chain', 'branches', 'belts', 'jams'];
  var QUEST = ['dir', 'lift', 'speed'];
  var OPTIONS = {
    dir: ['clockwise', 'counter-clockwise', 'it cannot turn'],
    lift: ['up', 'down', 'it cannot move'],
    speed: ['faster', 'same speed', 'slower'],
  };
  var ANSWERS = { dir: ['cw', 'ccw', 'jam'], lift: ['up', 'down', 'jam'], speed: ['faster', 'same', 'slower'] };

  /* ---------- geometry ---------- */

  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function segPoint(s, px, py) {
    var dx = s[2] - s[0], dy = s[3] - s[1], L = dx * dx + dy * dy;
    var t = L ? ((px - s[0]) * dx + (py - s[1]) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return dist(s[0] + t * dx, s[1] + t * dy, px, py);
  }
  function orient(ax, ay, bx, by, cx, cy) { var v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); return v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0; }
  function segSeg(a, b) {
    if (orient(a[0], a[1], a[2], a[3], b[0], b[1]) * orient(a[0], a[1], a[2], a[3], b[2], b[3]) < 0 &&
        orient(b[0], b[1], b[2], b[3], a[0], a[1]) * orient(b[0], b[1], b[2], b[3], a[2], a[3]) < 0) return 0;
    return Math.min(segPoint(a, b[0], b[1]), segPoint(a, b[2], b[3]), segPoint(b, a[0], a[1]), segPoint(b, a[2], a[3]));
  }
  // The two straight runs of a belt between circles: open belts on the outer tangents, crossed belts
  // on the inner ones. [[x1, y1, x2, y2], …] or null when the circles are too close.
  function beltRuns(x1, y1, r1, x2, y2, r2, crossed) {
    var d = dist(x1, y1, x2, y2);
    if (d < EPS) return null;
    var ux = (x2 - x1) / d, uy = (y2 - y1) / d, nx = -uy, ny = ux;
    var c = (crossed ? r1 + r2 : r1 - r2) / d;
    if (Math.abs(c) >= 1) return null;
    var s = Math.sqrt(1 - c * c), q = crossed ? -r2 : r2, out = [];
    for (var k = 1; k >= -1; k -= 2) {
      var mx = c * ux + k * s * nx, my = c * uy + k * s * ny;
      out.push([x1 + r1 * mx, y1 + r1 * my, x2 + q * mx, y2 + q * my]);
    }
    return out;
  }
  function reach(w) { return w.r + (w.kind === 'gear' ? TOOTH : 0); }
  function front(w) { return w.kind === 'gear' ? w.layer : 2; }

  /* ---------- exact fractions ---------- */

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  function frac(s, n, d) { var g = gcd(n, d); return { s: s, n: n / g, d: d / g }; }

  /* ---------- the solver (independent of the generator's bookkeeping) ---------- */

  // Checks one pair of wheels on different axles. Returns 'mesh', null (fine) or a problem.
  function gearIn(byAxle, w) {
    var ws = byAxle[w.axle] || [];
    for (var i = 0; i < ws.length; i++) if (ws[i].kind === 'gear') return ws[i];
    return null;
  }
  function pairCheck(w1, w2, byAxle) {
    // A pulley or drum lies inside its axle's gear (when it has one): that gear's own check covers it.
    if ((w1.kind !== 'gear' && gearIn(byAxle, w1)) || (w2.kind !== 'gear' && gearIn(byAxle, w2))) return null;
    var a = w1.axleObj, b = w2.axleObj, d = dist(a.x, a.y, b.x, b.y);
    if (w1.kind === 'gear' && w2.kind === 'gear') {
      if (w1.layer === w2.layer) {
        if (Math.abs(d - (w1.r + w2.r)) < EPS) return 'mesh';
        return d < w1.r + w2.r + GAP ? 'gears ' + w1.id + ' and ' + w2.id + ' overlap or nearly touch' : null;
      }
      var f = w1.layer === 1 ? w1 : w2, k = f === w1 ? w2 : w1; // front gear f, back gear k
      var kw = byAxle[k.axle], small = null;
      for (var i = 0; i < kw.length; i++) if (kw[i].kind === 'gear' && kw[i].layer === 1) small = kw[i];
      if (small && small.r < k.r && Math.abs(dist(f.axleObj.x, f.axleObj.y, k.axleObj.x, k.axleObj.y) - (f.r + small.r)) < EPS) return null;
    }
    // Gears on different layers keep the same gap as on one layer; pulleys and drums (in front, no
    // teeth) keep 2 units clear of every other axle's wheels.
    var both = w1.kind === 'gear' && w2.kind === 'gear';
    return d < (both ? w1.r + w2.r + GAP : reach(w1) + reach(w2) + 2) ? 'wheels ' + w1.id + ' and ' + w2.id + ' overlap' : null;
  }

  function analyse(item) {
    var axles = {}, wheels = {}, byAxle = {}, i, j;
    if (!item || !Array.isArray(item.axles) || !Array.isArray(item.wheels) || !Array.isArray(item.belts)) return { error: 'missing parts' };
    item.axles.forEach(function (a) { axles[a.id] = a; byAxle[a.id] = []; });
    for (i = 0; i < item.wheels.length; i++) {
      var w = item.wheels[i];
      if (!axles[w.axle]) return { error: 'wheel ' + w.id + ' has no axle' };
      w = { id: w.id, axle: w.axle, kind: w.kind, r: w.r, layer: w.layer, axleObj: axles[w.axle] };
      wheels[w.id] = w;
      byAxle[w.axle].push(w);
      var a0 = axles[w.axle];
      if (a0.x - reach(w) < MARGIN || a0.x + reach(w) > item.W - MARGIN || a0.y - reach(w) < MARGIN || a0.y + reach(w) > item.H - MARGIN) return { error: 'wheel ' + w.id + ' leaves the picture' };
    }
    // Wheels sharing an axle.
    for (var id in byAxle) {
      var ws = byAxle[id];
      if (!ws.length || ws.length > 2) return { error: 'axle ' + id + ' needs one or two wheels' };
      if (ws.length === 2) {
        var g = ws.filter(function (x) { return x.kind === 'gear'; });
        if (!g.length) return { error: 'axle ' + id + ' has two wheels and no gear' };
        if (g.length === 2) {
          var big = g[0].r > g[1].r ? g[0] : g[1], sm = big === g[0] ? g[1] : g[0];
          if (big.r < sm.r + GAP || big.layer !== 0 || sm.layer !== 1) return { error: 'compound gear on axle ' + id + ': big wheel behind, small in front, radii ' + GAP + ' apart' };
        } else {
          var other = ws[0] === g[0] ? ws[1] : ws[0];
          if (other.r > g[0].r - 4) return { error: 'pulley or drum on axle ' + id + ' must sit inside its gear' };
        }
      }
    }
    // Pairs of wheels on different axles: meshes from geometry.
    var list = item.wheels.map(function (x) { return wheels[x.id]; }), meshes = [];
    for (i = 0; i < list.length; i++) {
      for (j = i + 1; j < list.length; j++) {
        if (list[i].axle === list[j].axle) continue;
        var pc = pairCheck(list[i], list[j], byAxle);
        if (pc === 'mesh') meshes.push([list[i], list[j]]);
        else if (pc) return { error: pc };
      }
    }
    // Every mesh contact point and every axle centre is visible.
    for (i = 0; i < meshes.length; i++) {
      var m1 = meshes[i][0], m2 = meshes[i][1], A = m1.axleObj, B = m2.axleObj, dd = dist(A.x, A.y, B.x, B.y);
      var px = A.x + (B.x - A.x) * m1.r / dd, py = A.y + (B.y - A.y) * m1.r / dd;
      for (j = 0; j < list.length; j++) {
        var o = list[j];
        if (o.axle === m1.axle || o.axle === m2.axle || front(o) <= m1.layer) continue;
        if (dist(px, py, o.axleObj.x, o.axleObj.y) < o.r + 3) return { error: 'mesh ' + m1.id + '–' + m2.id + ' is hidden' };
      }
    }
    for (id in byAxle) {
      var top = Math.max.apply(null, byAxle[id].map(front)), ax = axles[id];
      for (j = 0; j < list.length; j++) {
        if (list[j].axle !== id && front(list[j]) > top && dist(ax.x, ax.y, list[j].axleObj.x, list[j].axleObj.y) < list[j].r + 2) return { error: 'axle ' + id + ' is hidden' };
      }
    }
    // Belts and the rope: straight runs clear of every other wheel and of each other.
    var runs = [], edges = [];
    for (i = 0; i < item.belts.length; i++) {
      var bt = item.belts[i], pa = wheels[bt.a], pb = wheels[bt.b];
      if (!pa || !pb || pa.kind !== 'pulley' || pb.kind !== 'pulley' || pa.axle === pb.axle) return { error: 'belt ' + i + ' must join pulleys on two axles' };
      var PA = pa.axleObj, PB = pb.axleObj, bd = dist(PA.x, PA.y, PB.x, PB.y);
      if (bd < pa.r + pb.r + (bt.crossed ? 6 : 10)) return { error: 'belt ' + i + ' is too short' };
      var br = beltRuns(PA.x, PA.y, pa.r, PB.x, PB.y, pb.r, bt.crossed);
      if (!br) return { error: 'belt ' + i + ' has no runs' };
      for (var k = 0; k < 2; k++) {
        for (j = 0; j < list.length; j++) {
          if (list[j].axle === pa.axle || list[j].axle === pb.axle) continue;
          if (segPoint(br[k], list[j].axleObj.x, list[j].axleObj.y) < reach(list[j]) + BELT_GAP) return { error: 'belt ' + i + ' runs over wheel ' + list[j].id };
        }
        for (j = 0; j < runs.length; j++) if (segSeg(br[k], runs[j].seg) < 3) return { error: 'belts ' + runs[j].belt + ' and ' + i + ' cross' };
      }
      runs.push({ seg: br[0], belt: i }, { seg: br[1], belt: i });
      edges.push({ u: pa.axle, v: pb.axle, sign: bt.crossed ? -1 : 1, ru: pa.r, rv: pb.r, belt: true });
    }
    meshes.forEach(function (m) { edges.push({ u: m[0].axle, v: m[1].axle, sign: -1, ru: m[0].r, rv: m[1].r, belt: false }); });
    var res = propagate(item, axles, byAxle, edges);
    if (res.error) return res;
    res.meshes = meshes.map(function (m) { return [m[0].id, m[1].id]; });
    res.runs = runs;
    if (item.rope) {
      var rp = ropeCheck(item, wheels, list, runs);
      if (rp) return { error: rp };
    }
    return res;
  }

  // Rotation of every axle relative to the driver, as exact fractions { s: ±1, n, d } (angular
  // speed n/d of the driver's), by breadth-first search over meshes and belts. A loop whose two
  // routes disagree is a jam; loops must run through single gears only.
  function propagate(item, axles, byAxle, edges) {
    var drv = item.driver && axles[item.driver.axle] ? item.driver.axle : null;
    if (!drv) return { error: 'no driver' };
    if (!axles[item.target] || item.target === drv) return { error: 'the marked axle must be another axle' };
    var adj = {}, id;
    for (id in axles) adj[id] = [];
    edges.forEach(function (e, i) {
      adj[e.u].push({ to: e.v, e: i, rf: e.ru, rt: e.rv });
      adj[e.v].push({ to: e.u, e: i, rf: e.rv, rt: e.ru });
    });
    var om = {}, parent = {}, viaBelt = {}, order = [drv], used = {}, loops = [];
    om[drv] = frac(1, 1, 1); parent[drv] = null; viaBelt[drv] = false;
    for (var qi = 0; qi < order.length; qi++) {
      var u = order[qi];
      for (var k = 0; k < adj[u].length; k++) {
        var x = adj[u][k];
        if (used[x.e]) continue;
        used[x.e] = true;
        var e = edges[x.e], f = frac(om[u].s * e.sign, om[u].n * x.rf, om[u].d * x.rt);
        if (om[x.to] === undefined) {
          om[x.to] = f; parent[x.to] = { from: u, e: x.e }; viaBelt[x.to] = viaBelt[u] || e.belt; order.push(x.to);
        } else {
          loops.push({ u: u, v: x.to, e: x.e, ok: om[x.to].s === f.s && om[x.to].n === f.n && om[x.to].d === f.d });
        }
      }
    }
    for (id in axles) if (om[id] === undefined) return { error: 'axle ' + id + ' is not connected to the driver' };
    var jam = false, odd = 0, even = 0, cycles = [];
    for (var i = 0; i < loops.length; i++) {
      var L = loops[i], cyc = cycle(parent, L.u, L.v), bad = edges[L.e].belt;
      cyc.edges.forEach(function (ei) { if (edges[ei].belt) bad = true; });
      // A pulley or drum beside the gear is fine; a second gear would make tooth ratios matter.
      cyc.axles.forEach(function (a) { if (byAxle[a].filter(function (w) { return w.kind === 'gear'; }).length !== 1) bad = true; });
      if (bad) return { error: 'a loop runs through a belt or a compound gear' };
      cycles.push({ axles: cyc.axles, odd: !L.ok });
      if (L.ok) { even++; continue; }
      if (viaBelt[cyc.top]) return { error: 'a jam beyond a belt (the belt would slip)' };
      jam = true; odd++;
    }
    return { jam: jam, omega: om, parent: parent, edges: edges, loops: loops.length, oddLoops: odd, evenLoops: even, cycles: cycles };
  }
  function cycle(parent, u, v) {
    var up = {}, a = u, axlesU = [], edgesU = [];
    while (a !== null) { up[a] = axlesU.length; axlesU.push(a); a = parent[a] ? parent[a].from : null; }
    var b = v, axlesV = [], edgesV = [];
    while (up[b] === undefined) { axlesV.push(b); edgesV.push(parent[b].e); b = parent[b].from; }
    for (var i = 0; i < up[b]; i++) edgesU.push(parent[axlesU[i]].e);
    return { top: b, axles: axlesU.slice(0, up[b] + 1).concat(axlesV), edges: edgesU.concat(edgesV) };
  }

  function boxCircle(cx, top, w, h, x, y) {
    var dx = Math.max(Math.abs(x - cx) - w / 2, 0), dy = Math.max(Math.abs(y - (top + h / 2)) - h / 2, 0);
    return Math.sqrt(dx * dx + dy * dy);
  }
  function ropeCheck(item, wheels, list, runs) {
    var rp = item.rope, dw = wheels[rp.wheel];
    if (!dw || dw.kind !== 'drum' || dw.axle !== item.target) return 'the rope must hang from a drum on the marked axle';
    if (rp.side !== 'left' && rp.side !== 'right') return 'rope side';
    if (!(rp.length >= 12)) return 'the rope is too short';
    var x = dw.axleObj.x + (rp.side === 'left' ? -dw.r : dw.r), y0 = dw.axleObj.y, y1 = y0 + rp.length, wt = rp.weight;
    if (!wt || Math.abs(wt[0] - x) > EPS || Math.abs(wt[1] - y1) > EPS) return 'the weight must hang at the rope end';
    if (x - wt[2] / 2 < MARGIN || x + wt[2] / 2 > item.W - MARGIN || y1 + wt[3] > item.H - MARGIN) return 'the weight leaves the picture';
    var seg = [x, y0, x, y1];
    for (var j = 0; j < list.length; j++) {
      var o = list[j];
      if (o.axle !== dw.axle && segPoint(seg, o.axleObj.x, o.axleObj.y) < reach(o) + BELT_GAP) return 'the rope runs over wheel ' + o.id;
      if (boxCircle(x, y1, wt[2], wt[3], o.axleObj.x, o.axleObj.y) < reach(o) + 3) return 'the weight touches wheel ' + o.id;
    }
    for (j = 0; j < runs.length; j++) if (segSeg(seg, runs[j].seg) < 3) return 'the rope crosses a belt';
    return null;
  }

  function answerOf(item, res) {
    var w = res.omega[item.target];
    if (item.question === 'speed') {
      if (res.jam) return { error: 'speed questions never jam' };
      if (w.n === w.d) return 'same';
      if (w.n >= SPEED_MARGIN * w.d) return 'faster';
      if (w.d >= SPEED_MARGIN * w.n) return 'slower';
      return { error: 'the speed difference is too small to see' };
    }
    if (res.jam) return 'jam';
    var turn = w.s * item.driver.dir; // +1: clockwise on the screen
    if (item.question === 'dir') return turn > 0 ? 'cw' : 'ccw';
    // The drum surface at the rope's tangent point (±R, 0) moves with v = turn · (−ry, rx) = (0, ±turn·R)
    // (y down); the rope leaves it going down, so v·down < 0 reels it in (the weight rises).
    var vy = turn * (item.rope.side === 'left' ? -1 : 1);
    return vy < 0 ? 'up' : 'down';
  }

  // Facts that define the levels: the driver→target route, belts on it, side axles, loops.
  function levelFacts(item, res) {
    var a = item.target, links = 0, belts = 0, onPath = {};
    onPath[a] = true;
    while (res.parent[a]) { links++; if (res.edges[res.parent[a].e].belt) belts++; a = res.parent[a].from; onPath[a] = true; }
    var side = item.axles.filter(function (x) { return !onPath[x.id]; }).length;
    return { pathLinks: links, pathBelts: belts, side: side, loops: res.loops, belts: item.belts.length };
  }

  function validate(item) {
    if (!item || item.ex !== 'mechanisms') return 'not a mechanisms item';
    var p = item.params || {}, q = QUEST[p.question];
    if (PATH[p.gears] === undefined || STRUCT[p.structure] === undefined || !q) return 'bad params';
    if (item.question !== q) return 'the question does not match the level';
    if (JSON.stringify(item.options) !== JSON.stringify(OPTIONS[q]) || JSON.stringify(item.answers) !== JSON.stringify(ANSWERS[q])) return 'wrong options';
    if (!(Number.isInteger(item.key) && item.key >= 0 && item.key < 3)) return 'bad key';
    if (!item.driver || (item.driver.dir !== 1 && item.driver.dir !== -1)) return 'the driver needs a direction';
    if ((q === 'lift') !== !!item.rope) return 'a lift question has a rope, the others none';
    return validateWith(item, analyse(item));
  }
  function validateWith(item, res) {
    if (res.error) return res.error;
    var ans = answerOf(item, res);
    if (typeof ans !== 'string') return ans.error;
    if (item.answers[item.key] !== ans) return 'the key says ' + item.answers[item.key] + ' but the mechanism gives ' + ans;
    var p = item.params, f = levelFacts(item, res), S = p.structure;
    if (f.pathLinks !== PATH[p.gears] - 1) return 'a route of ' + (f.pathLinks + 1) + ' axles; the level wants ' + PATH[p.gears];
    if (res.jam && S < 2) return 'a jam below the belts level';
    if (S === 0 && (f.side || f.loops || f.belts !== 1 || f.pathBelts !== 1)) return 'a chain has one belt on the route and nothing else';
    if (S === 1 && (!f.side || f.loops || f.belts !== 1 || f.pathBelts !== 1)) return 'branches: side gears, one belt on the route, no loops';
    if (S === 2 && f.belts < 2) return 'the belts level needs at least two belts';
    if (S === 3 && (!f.loops || f.belts < 1)) return 'the jams level needs a loop and a belt';
    return true;
  }

  /* ---------- generator ---------- */

  var PICKS = [];
  function pickR(rng, set, lo, hi) { // a radius from set within [lo, hi] (subsets cached: no garbage)
    for (var i = 0; i < PICKS.length; i++) if (PICKS[i].set === set && PICKS[i].lo === lo && PICKS[i].hi === hi) break;
    if (i === PICKS.length) PICKS.push({ set: set, lo: lo, hi: hi, c: set.filter(function (r) { return r >= lo && r <= hi; }) });
    var c = PICKS[i].c;
    return c.length ? c[rng.int(0, c.length - 1)] : null;
  }

  // The builder keeps wheel objects in the validator's own shape, so fits() can run pairCheck.
  function newState() { return { axles: [], wheels: [], belts: [], runs: [], byAxle: {} }; }
  function makeWheels(st, ax, specs) {
    return specs.map(function (s) {
      return { id: 'w' + (st.wheels.length + specs.indexOf(s)), axle: ax.id, kind: s.kind, r: s.r, layer: s.kind === 'gear' ? s.layer : 2, axleObj: ax };
    });
  }
  // Can an axle at (x, y) with these wheels (and an optional new belt) join the picture?
  function fits(st, ax, ws, belt) {
    var i, j;
    for (i = 0; i < ws.length; i++) {
      var R = reach(ws[i]);
      if (ax.x - R < MARGIN || ax.x + R > W - MARGIN || ax.y - R < MARGIN || ax.y + R > H - MARGIN) return false;
    }
    st.byAxle[ax.id] = ws;
    var ok = true;
    for (i = 0; i < ws.length && ok; i++) {
      for (j = 0; j < st.wheels.length && ok; j++) {
        var pc = pairCheck(ws[i], st.wheels[j], st.byAxle);
        if (pc && pc !== 'mesh') ok = false;
      }
      for (j = 0; j < st.runs.length && ok; j++) {
        if (st.runs[j].axles.indexOf(ax.id) < 0 && segPoint(st.runs[j].seg, ax.x, ax.y) < reach(ws[i]) + BELT_GAP) ok = false;
      }
    }
    if (ok && belt) {
      var all = st.wheels.concat(ws);
      for (var k = 0; k < belt.runs.length && ok; k++) {
        for (j = 0; j < all.length && ok; j++) {
          if (belt.axles.indexOf(all[j].axle) >= 0) continue;
          if (segPoint(belt.runs[k], all[j].axleObj.x, all[j].axleObj.y) < reach(all[j]) + BELT_GAP) ok = false;
        }
        for (j = 0; j < st.runs.length && ok; j++) if (segSeg(belt.runs[k], st.runs[j].seg) < 3) ok = false;
      }
    }
    delete st.byAxle[ax.id];
    return ok;
  }
  function addAxle(st, ax, ws, belt) {
    st.axles.push(ax);
    ws.forEach(function (w) { st.wheels.push(w); });
    st.byAxle[ax.id] = ws;
    if (belt) {
      st.belts.push({ a: belt.a, b: belt.b, crossed: belt.crossed });
      belt.runs.forEach(function (s) { st.runs.push({ seg: s, axles: belt.axles }); });
    }
  }
  // A belt between pulley pa (already placed) and pulley pb on the new axle.
  function beltFor(pa, pb, crossed) {
    var A = pa.axleObj, B = pb.axleObj;
    var runs = beltRuns(A.x, A.y, pa.r, B.x, B.y, pb.r, crossed);
    return runs && dist(A.x, A.y, B.x, B.y) >= pa.r + pb.r + (crossed ? 6 : 10) ? { a: pa.id, b: pb.id, crossed: crossed, runs: runs, axles: [pa.axle, pb.axle] } : null;
  }
  function removeLastAxle(st) {
    var ax = st.axles.pop();
    st.wheels = st.wheels.filter(function (w) { return w.axle !== ax.id; });
    delete st.byAxle[ax.id];
  }
  function range(n) { var out = []; for (var i = 0; i < n; i++) out.push(i); return out; }

  // Wheels of each route axle (kinds and layers); radii come from drawRadii.
  function routePlan(rng, types, S) {
    var n = types.length + 1, plan = [], layer = 0, comps = 0, maxComp = S === 0 ? 0 : S === 1 ? 1 : 2;
    for (var i = 0; i < n; i++) {
      var tin = i ? types[i - 1] : null, tout = i < n - 1 ? types[i] : null, a = {};
      if (tin !== 'belt' && tout !== 'belt') {
        if (tin && tout && comps < maxComp && rng.chance(0.4)) {
          comps++;
          a.inK = a.outK = 'gear'; a.inL = layer; a.outL = 1 - layer; a.compound = true; layer = 1 - layer;
        } else { a.inK = a.outK = 'gear'; a.inL = a.outL = layer; a.single = true; }
      } else if (tin === 'belt' && tout === 'mesh') { a.inK = 'pulley'; a.outK = 'gear'; a.outL = layer; }
      else if (tin === 'mesh' && tout === 'belt') { a.inK = 'gear'; a.inL = layer; a.outK = 'pulley'; }
      else { a.inK = a.outK = 'pulley'; a.single = true; }
      plan.push(a);
    }
    return plan;
  }
  function drawRadii(rng, plan, lift) {
    plan.forEach(function (a, i) {
      // A winch drum needs a gear of at least 10 around it.
      if (a.single) a.inR = a.outR = a.inK === 'gear' ? pickR(rng, GEAR_R, lift && i === plan.length - 1 ? 10 : 0, 99) : rng.pick(PULLEY_R);
      else if (a.compound) {
        var big = rng.pick(BIG_R), small = pickR(rng, GEAR_R, 0, big - GAP);
        if (a.inL === 0) { a.inR = big; a.outR = small; } else { a.inR = small; a.outR = big; }
      } else {
        var g = pickR(rng, GEAR_R, 10, 99), p = pickR(rng, PULLEY_R, 0, g - 4);
        if (a.inK === 'gear') { a.inR = g; a.outR = p; } else { a.inR = p; a.outR = g; }
      }
    });
  }
  // |ω target / ω driver| = Π (driving radius / driven radius) along the route.
  function ratioOf(plan) {
    var n = 1, d = 1;
    for (var i = 0; i + 1 < plan.length; i++) { n *= plan[i].outR; d *= plan[i + 1].inR; }
    return [n, d];
  }
  function speedClass(n, d) { return n === d ? 'same' : n >= SPEED_MARGIN * d ? 'faster' : d >= SPEED_MARGIN * n ? 'slower' : null; }
  function sizeClass(rDriver, rTarget) { return rTarget < rDriver ? 'faster' : rTarget === rDriver ? 'same' : 'slower'; }

  // A single gear meshing gear G (with a pulley inside it when withPulley); returns its wheels or null.
  function addSide(st, rng, G, withPulley) {
    for (var t = 0; t < 24; t++) {
      var r = withPulley ? pickR(rng, GEAR_R, 10, 99) : rng.pick(GEAR_R), th = rng.float(0, 2 * Math.PI);
      var ax = { id: 'a' + st.axles.length, x: G.axleObj.x + (G.r + r) * Math.cos(th), y: G.axleObj.y + (G.r + r) * Math.sin(th) };
      var specs = [{ kind: 'gear', r: r, layer: G.layer }];
      if (withPulley) specs.push({ kind: 'pulley', r: pickR(rng, PULLEY_R, 0, r - 4) });
      var ws = makeWheels(st, ax, specs);
      if (fits(st, ax, ws, null)) { addAxle(st, ax, ws, null); return ws; }
    }
    return null;
  }
  function addSideBelt(st, rng) {
    var gears = st.wheels.filter(function (w) { return w.kind === 'gear'; });
    for (var t = 0; t < 6; t++) {
      var hub = addSide(st, rng, rng.pick(gears), true);
      if (!hub) continue;
      for (var u = 0; u < 16; u++) {
        var r2 = rng.pick(PULLEY_R), th = rng.float(0, 2 * Math.PI), d = hub[1].r + r2 + rng.float(14, 34);
        var ax = { id: 'a' + st.axles.length, x: hub[1].axleObj.x + d * Math.cos(th), y: hub[1].axleObj.y + d * Math.sin(th) };
        var ws = makeWheels(st, ax, [{ kind: 'pulley', r: r2 }]), belt = beltFor(hub[1], ws[0], rng.chance(0.5));
        if (belt && fits(st, ax, ws, belt)) { addAxle(st, ax, ws, belt); return true; }
      }
      removeLastAxle(st);
    }
    return false;
  }

  // Axle graph of the builder (meshes from geometry, belts) for loops and the route length.
  function graphOf(st, withBelts) {
    var adj = {}, i, j;
    st.axles.forEach(function (a) { adj[a.id] = []; });
    for (i = 0; i < st.wheels.length; i++) {
      for (j = i + 1; j < st.wheels.length; j++) {
        var u = st.wheels[i], v = st.wheels[j];
        if (u.axle === v.axle || u.kind !== 'gear' || v.kind !== 'gear' || u.layer !== v.layer) continue;
        if (Math.abs(dist(u.axleObj.x, u.axleObj.y, v.axleObj.x, v.axleObj.y) - (u.r + v.r)) < EPS) { adj[u.axle].push(v.axle); adj[v.axle].push(u.axle); }
      }
    }
    if (withBelts) {
      var wa = {};
      st.wheels.forEach(function (w) { wa[w.id] = w.axle; });
      st.belts.forEach(function (b) { adj[wa[b.a]].push(wa[b.b]); adj[wa[b.b]].push(wa[b.a]); });
    }
    return adj;
  }
  function bfs(adj, from, allow) {
    var d = {}, q = [from];
    d[from] = 0;
    for (var i = 0; i < q.length; i++) {
      adj[q[i]].forEach(function (v) { if (d[v] === undefined && (!allow || allow[v])) { d[v] = d[q[i]] + 1; q.push(v); } });
    }
    return d;
  }
  // Closes a loop of single gears: odd (a triangle or a five-loop) in the driver's own gear group,
  // or even (a four-loop) anywhere, by adding one gear that meshes two existing ones.
  function addLoop(st, rng, odd, target, routeLinks) {
    var adj = graphOf(st, false), single = {}, cands = [];
    st.axles.forEach(function (a) { single[a.id] = st.byAxle[a.id].filter(function (w) { return w.kind === 'gear'; }).length === 1; });
    var rigid = bfs(adj, 'a0', null);
    st.axles.forEach(function (A) {
      if (!single[A.id]) return;
      var dd = bfs(adj, A.id, single);
      for (var B in dd) {
        if (B <= A.id || !single[B]) continue;
        var k = dd[B];
        if (odd ? (k === 1 || k === 3) && rigid[A.id] !== undefined && rigid[B] !== undefined : k === 2) cands.push([A.id, B]);
      }
    });
    cands = rng.shuffle(cands);
    if (closeOn(st, rng, cands, target, routeLinks)) return true;
    if (odd) {
      // No pair to close: add a side gear X on a single gear M of the driver's group and close the
      // triangle M–X–N.
      var ms = rng.shuffle(st.axles.filter(function (M) { return single[M.id] && rigid[M.id] !== undefined; }));
      for (var mi = 0; mi < ms.length && mi < 6; mi++) {
        var x1 = addSide(st, rng, gearOf(st, ms[mi].id), false);
        if (!x1) continue;
        if (closeOn(st, rng, [[ms[mi].id, x1[0].axle]], target, routeLinks)) return true;
        removeLastAxle(st);
      }
      return false;
    }
    // No four-loop to close: add a side gear X on a single gear M next to a single gear A, then
    // close M–A–N–X with one more gear N.
    var pairs = [];
    st.axles.forEach(function (M) {
      if (!single[M.id]) return;
      adj[M.id].forEach(function (A) { if (single[A]) pairs.push([M.id, A]); });
    });
    pairs = rng.shuffle(pairs);
    for (var pi = 0; pi < pairs.length && pi < 8; pi++) {
      var xs = addSide(st, rng, gearOf(st, pairs[pi][0]), false);
      if (!xs) continue;
      if (closeOn(st, rng, [[xs[0].axle, pairs[pi][1]]], target, routeLinks)) return true;
      removeLastAxle(st);
    }
    return false;
  }
  function gearOf(st, id) { return st.byAxle[id].filter(function (w) { return w.kind === 'gear'; })[0]; }
  // Adds one gear meshing both gears of a candidate pair (the first that fits and keeps the route).
  function closeOn(st, rng, cands, target, routeLinks) {
    for (var c = 0; c < cands.length && c < 12; c++) {
      var gA = gearOf(st, cands[c][0]), gB = gearOf(st, cands[c][1]), radii = rng.shuffle(GEAR_R);
      for (var ri = 0; ri < radii.length; ri++) {
        var r = radii[ri], P = gA.axleObj, Q = gB.axleObj, R1 = gA.r + r, R2 = gB.r + r, d = dist(P.x, P.y, Q.x, Q.y);
        var a = (R1 * R1 - R2 * R2 + d * d) / (2 * d), h2 = R1 * R1 - a * a;
        if (h2 <= 1) continue;
        var h = Math.sqrt(h2), ux = (Q.x - P.x) / d, uy = (Q.y - P.y) / d;
        for (var s = 1; s >= -1; s -= 2) {
          var ax = { id: 'a' + st.axles.length, x: P.x + a * ux - s * h * uy, y: P.y + a * uy + s * h * ux };
          var ws = makeWheels(st, ax, [{ kind: 'gear', r: r, layer: gA.layer }]);
          if (!fits(st, ax, ws, null)) continue;
          addAxle(st, ax, ws, null);
          if (bfs(graphOf(st, true), 'a0', null)[target] === routeLinks) return true;
          removeLastAxle(st);
        }
      }
    }
    return false;
  }
  var STATS = {};
  // Why attempts fail, counted for diagnostics (helpers.stats); generation never depends on it.
  function miss(why) { why = why.replace(/[0-9]+/g, '#'); STATS[why] = (STATS[why] || 0) + 1; return null; }
  // Targets drawn once per item and kept through the retries (so that hard-to-build variants keep
  // their share): the driver's direction; a jam (belts level 1 in 3, jams level 1 in 2, never for
  // speed); whether the parity shortcut lands on the key (half of the time); the rope side; for speed
  // items the answer (uniform) and whether the size shortcut lands on it (one time in three).
  function targetsFor(rng, params) {
    var q = QUEST[params.question], S = params.structure;
    return {
      dir: rng.chance(0.5) ? 1 : -1,
      jam: q !== 'speed' && S >= 2 && rng.chance(S === 2 ? 1 / 3 : 1 / 2),
      parityRight: rng.chance(0.5),
      side: rng.chance(0.5) ? 'left' : 'right',
      want: rng.pick(ANSWERS.speed),
      sizeRight: rng.chance(1 / 3),
    };
  }
  function attempt(rng, params, tg) {
    var q = QUEST[params.question], S = params.structure, nPath = PATH[params.gears], nLinks = nPath - 1, i;
    tg = tg || targetsFor(rng, params);
    var dir = tg.dir, jam = tg.jam, parityRight = tg.parityRight;
    var nBelts = S <= 1 ? 1 : S === 2 ? Math.min(2, Math.ceil(nLinks / 2)) : (nLinks >= 4 && rng.chance(0.5) ? 2 : 1);
    var slots = rng.shuffle(range(nLinks).filter(function (k) { return !(jam && k === 0) && !(q === 'lift' && k === nLinks - 1); }));
    var pos = [];
    slots.forEach(function (k) { if (pos.length < nBelts && pos.every(function (p) { return Math.abs(p - k) > 1; })) pos.push(k); });
    if (!pos.length && (S <= 1 || !jam)) return miss('belt slots');
    var types = range(nLinks).map(function (k) { return pos.indexOf(k) >= 0 ? 'belt' : 'mesh'; }), crossed = {};
    pos.forEach(function (k) { crossed[k] = rng.chance(0.5); });
    if (!jam && q !== 'speed') {
      // Parity counts every link as a reversal; open belts keep the direction, so it is right exactly
      // when the route has an even number of open belts.
      var open = pos.filter(function (k) { return !crossed[k]; }).length;
      if ((open % 2 === 0) !== parityRight) { var fl = rng.pick(pos); crossed[fl] = !crossed[fl]; }
    }
    var plan = routePlan(rng, types, S), want = null, sizeRight = null;
    if (q === 'speed') {
      // The size shortcut: the marked wheel smaller than the driver → faster.
      want = tg.want; sizeRight = tg.sizeRight;
      var found = false;
      for (i = 0; i < 400 && !found; i++) {
        drawRadii(rng, plan);
        var rt = ratioOf(plan);
        found = speedClass(rt[0], rt[1]) === want && (sizeClass(plan[0].outR, plan[nLinks].inR) === want) === sizeRight;
      }
      if (!found) return miss('speed radii');
    } else drawRadii(rng, plan, q === 'lift');

    var st = newState(), route = [], heading = rng.float(0, 2 * Math.PI);
    for (i = 0; i < nPath; i++) {
      var a = plan[i], specs = [{ kind: a.inK, r: a.inR, layer: a.inK === 'gear' ? a.inL : 2 }];
      if (!a.single) specs.push({ kind: a.outK, r: a.outR, layer: a.outK === 'gear' ? a.outL : 2 });
      var placed = false;
      for (var t = 0; t < 30 && !placed; t++) {
        var ax = { id: 'a' + i, x: rng.float(35, W - 35), y: rng.float(30, H - 30) }, th = heading;
        if (i > 0) {
          var pa = route[i - 1];
          // Early tries keep the heading; later ones turn back towards the middle of the picture.
          th = t < 14 ? heading + rng.float(-1.2, 1.2) : Math.atan2(H / 2 - pa.ax.y, W / 2 - pa.ax.x) + rng.float(-1.4, 1.4);
          var d = pa.out.r + a.inR + (types[i - 1] === 'belt' ? rng.float(14, 36) : 0);
          ax.x = pa.ax.x + d * Math.cos(th);
          ax.y = pa.ax.y + d * Math.sin(th);
        }
        var ws = makeWheels(st, ax, specs), belt = null;
        if (i > 0 && types[i - 1] === 'belt' && !(belt = beltFor(route[i - 1].out, ws[0], crossed[i - 1]))) continue;
        if (fits(st, ax, ws, belt)) {
          addAxle(st, ax, ws, belt);
          route.push({ ax: ax, out: ws[ws.length - 1] });
          heading = th;
          placed = true;
        }
      }
      if (!placed) return miss('route ' + i);
    }
    var target = 'a' + (nPath - 1);
    var nSide = S === 0 ? 0 : S === 1 ? rng.int(1, 3) : S === 2 ? rng.int(1, 2) : rng.int(0, 2);
    for (i = 0; i < nSide; i++) {
      var gears = st.wheels.filter(function (w) { return w.kind === 'gear' && !(q === 'lift' && w.axle === target); });
      var side = null;
      for (var gi = 0; gi < 3 && !side; gi++) side = addSide(st, rng, rng.pick(gears), false);
      if (!side && S === 1 && i === 0) return miss('side');
      if (side && rng.chance(0.3)) addSide(st, rng, side[0], false);
    }
    var needBelts = S === 2 ? 2 : 1;
    while (st.belts.length < needBelts) if (!addSideBelt(st, rng)) return miss('side belt');
    if (S >= 2 && rng.chance(0.25)) addSideBelt(st, rng);
    if (jam) { if (!addLoop(st, rng, true, target, nLinks)) return miss('odd loop'); }
    else if (S === 3 || (S === 2 && rng.chance(0.4))) { if (!addLoop(st, rng, false, target, nLinks) && S === 3) return miss('even loop'); }

    var rope = null, tax = st.axles[nPath - 1];
    if (q === 'lift') {
      var tgear = st.byAxle[target][0], rd = pickR(rng, DRUM_R, 0, tgear.r - 4);
      if (rd === null) return miss('drum');
      var dw = { id: 'w' + st.wheels.length, axle: target, kind: 'drum', r: rd, layer: 2, axleObj: tax };
      st.wheels.push(dw);
      st.byAxle[target] = st.byAxle[target].concat([dw]);
      // The rope side is drawn 50/50; its length is drawn among those that keep rope and weight clear.
      var sd = tg.side, wmap = {}, lens = [];
      st.wheels.forEach(function (w) { wmap[w.id] = w; });
      for (var L = tgear.r + 10; L <= H - MARGIN - 11 - tax.y; L += 4) lens.push(L);
      lens = rng.shuffle(lens);
      for (var flip = 0; flip < 2 && !rope; flip++) {
        if (flip) {
          // Mirror the whole picture top to bottom: meshes, belts and the solver's answer follow it.
          st.axles.forEach(function (x) { x.y = H - x.y; });
          st.runs.forEach(function (r) { r.seg = [r.seg[0], H - r.seg[1], r.seg[2], H - r.seg[3]]; });
          lens = [];
          for (L = tgear.r + 10; L <= H - MARGIN - 11 - tax.y; L += 4) lens.push(L);
          lens = rng.shuffle(lens);
        }
        for (i = 0; i < lens.length && !rope; i++) {
          var cand = { wheel: dw.id, side: sd, length: lens[i], weight: [tax.x + (sd === 'left' ? -rd : rd), tax.y + lens[i], 12, 9] };
          if (!ropeCheck({ rope: cand, target: target, W: W, H: H }, wmap, st.wheels, st.runs)) rope = cand;
        }
      }
      if (!rope) return miss('rope');
    }
    var item = {
      ex: 'mechanisms', seed: rng.seed, params: { gears: params.gears, structure: params.structure, question: params.question },
      key: 0, question: q, options: OPTIONS[q].slice(), answers: ANSWERS[q].slice(), W: W, H: H,
      axles: st.axles.map(function (x) { return { id: x.id, x: x.x, y: x.y }; }),
      wheels: st.wheels.map(function (w) {
        var o = { id: w.id, axle: w.axle, kind: w.kind, r: w.r, layer: w.layer };
        if (w.kind === 'gear') o.teeth = 2 * w.r;
        return o;
      }),
      belts: st.belts.map(function (b) { return { a: b.a, b: b.b, crossed: b.crossed }; }),
      driver: { axle: 'a0', dir: dir }, target: target, rope: rope,
      info: { route: range(nPath).map(function (k) { return 'a' + k; }), jam: jam, parityRight: jam || q === 'speed' ? null : parityRight, speedWant: want, sizeRight: sizeRight },
    };
    var res = analyse(item);
    if (res.error) return miss('check: ' + res.error);
    var ans = answerOf(item, res);
    if (typeof ans !== 'string') return miss('answer: ' + ans.error);
    item.key = item.answers.indexOf(ans);
    var v = validateWith(item, res);
    return v === true ? item : miss('level: ' + v);
  }

  function fallback(seed, params) {
    var item = null;
    for (var i = 0; i < 4000; i++) {
      item = attempt(PX.rng(PX.rng.hash('mechanisms-fallback', params.gears, params.structure, params.question, i)), params);
      if (item && validate(item) === true) { item.seed = seed; item.fallback = true; return item; }
    }
    if (item) item.fallback = true;
    return item;
  }
  // attempt() returns only items that pass validate's checks (run on the same analysis).
  function generate(rng, params) {
    var tg = targetsFor(rng.fork('targets'), params);
    for (var i = 0; i < 80; i++) {
      // Some speed targets cannot be met on some routes (equal end wheels with a pulley inside a
      // gear on the way): after 10 tries the size-shortcut target is drawn afresh each time.
      if (i >= 10) tg.sizeRight = rng.fork('size' + i).chance(1 / 3);
      var item = attempt(rng.fork('retry' + i), params, tg);
      if (item) { item.seed = rng.seed; return item; }
    }
    return fallback(rng.seed, params);
  }

  /* ---------- shortcut solvers (for the tests): each returns an answer code ---------- */

  function routeLinks(item, res) {
    var adj = {};
    item.axles.forEach(function (a) { adj[a.id] = []; });
    res.edges.forEach(function (e) { adj[e.u].push(e.v); adj[e.v].push(e.u); });
    return bfs(adj, item.driver.axle, null)[item.target];
  }
  function turnAnswer(item, turn) {
    if (item.question === 'dir') return turn > 0 ? 'cw' : 'ccw';
    return turn * (item.rope.side === 'left' ? -1 : 1) < 0 ? 'up' : 'down';
  }
  var shortcuts = {
    // Shortest route length, every link (mesh or belt) taken as a reversal; never "cannot turn".
    parity: function (item) {
      if (item.question === 'speed') return null;
      var res = analyse(item), k = routeLinks(item, res);
      return turnAnswer(item, item.driver.dir * (k % 2 ? -1 : 1));
    },
    // Wheel-level route: every mesh, belt and shared-axle step taken as a reversal.
    gearParity: function (item) {
      if (item.question === 'speed') return null;
      var res = analyse(item), adj = {}, byAxle = {};
      item.wheels.forEach(function (w) { adj[w.id] = []; (byAxle[w.axle] || (byAxle[w.axle] = [])).push(w.id); });
      res.meshes.forEach(function (m) { adj[m[0]].push(m[1]); adj[m[1]].push(m[0]); });
      item.belts.forEach(function (b) { adj[b.a].push(b.b); adj[b.b].push(b.a); });
      for (var a in byAxle) if (byAxle[a].length === 2) { adj[byAxle[a][0]].push(byAxle[a][1]); adj[byAxle[a][1]].push(byAxle[a][0]); }
      var from = byAxle[item.driver.axle][0], to = item.wheels.filter(function (w) { return w.axle === item.target && w.kind !== 'drum'; })[0].id;
      var k = bfs(adj, from, null)[to];
      return turnAnswer(item, item.driver.dir * (k % 2 ? -1 : 1));
    },
    // Parity of the number of axles in the picture, as if they formed one chain.
    countAll: function (item) {
      if (item.question === 'speed') return null;
      return turnAnswer(item, item.driver.dir * ((item.axles.length - 1) % 2 ? -1 : 1));
    },
    always: function (item) { return item.answers[0]; }, // clockwise / up / faster
    // Speed: compare the marked wheel's size with the driver's.
    size: function (item) {
      if (item.question !== 'speed') return null;
      var rOf = function (ax) { return item.wheels.filter(function (w) { return w.axle === ax; })[0].r; };
      return sizeClass(rOf(item.driver.axle), rOf(item.target));
    },
  };

  // The shared model for the view and the tests (def.lib; def.helpers is the same object).
  var LIB = {
    analyse: analyse, answerOf: answerOf, levelFacts: levelFacts, beltRuns: beltRuns, shortcuts: shortcuts, fallback: fallback,
    OPTIONS: OPTIONS, ANSWERS: ANSWERS, PATH: PATH, STRUCT: STRUCT, QUEST: QUEST, stats: STATS, TOOTH: TOOTH,
  };

  PX.ex.define({
    id: 'mechanisms', version: 1, code: 'PR-3', name: 'Mechanisms', short: 'Mechanisms',
    abilities: ['MA'], cell: 'intrinsic-dynamic', role: 'probe', answer: 'choice', nOptions: 3,
    dims: [
      { key: 'gears', label: 'Axles on the route', levels: PATH, step: 0.35 },
      { key: 'structure', label: 'Structure', levels: STRUCT, step: 0.75 },
      { key: 'question', label: 'Question', levels: QUEST, step: 0.45 },
    ],
    base: -2.1,
    // Below the belts level nothing can jam, so "it cannot turn" is never right there: a test-wise
    // guess is one in two. Elsewhere one in three.
    chance: function (params) { return params && QUEST[params.question] !== 'speed' && params.structure < 2 ? 0.5 : 1 / 3; },
    // Item time limit (a calm countdown in the view): 30 s, +5 s per extra route axle, +5 s for speed.
    timeLimit: function (params) { var p = params || {}; return 30000 + 5000 * (p.gears || 0) + (QUEST[p.question] === 'speed' ? 5000 : 0); },
    generate: generate,
    validate: validate,
    score: function (item, response) { return { correct: response === item.key }; },
    lib: LIB,
    helpers: LIB,
  });
})(window.PX);
