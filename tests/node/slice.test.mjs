/* EX-06 Slice: generator, validator, scorer, shortcut solvers, timing. Run through tests/node/run.mjs.
   N_ITEMS seeds spread over every level (18 combinations); determinism on every 10th seed. */
import { performance } from 'node:perf_hooks';
import { MANIFEST } from './run.mjs';

// An own context with only the files Slice needs, so other exercises' work in progress
// cannot break this test.
const FILES = [...MANIFEST, 'js/ex/slice/gen.js', 'js/ex/slice/learn.js'];

const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10008); // 556 per level combination (the override is for quick local runs)
const CHANCE = 0.25, LIMIT = CHANCE + 0.10;

export async function run(t) {
  const PX = t.context({ files: FILES }).PX, def = PX.ex.get('slice');
  t.section('slice: definition');
  t.ok(def, 'slice is defined');
  if (!def) return;
  const L = def.lib;
  testDefinition(t, PX, def);
  testMeshes(t, PX, L);
  const pool = testPool(t, PX, def, L);
  testShortcuts(t, PX, L, pool);
  testAnalytic(t, PX, L, pool);
  testTampering(t, PX, def, L, pool);
  testFallback(t, PX, def, L);
  testTiming(t, PX, def);
  testLearn(t, PX, def);
}

/* ------------------------------------------------------------------ helpers */

const sig = (x) => 1 / (1 + Math.exp(-x));
const pRight = (theta, b, g = CHANCE) => g + (1 - g - 0.03) * sig(theta - b);
const key3 = (p) => `${p.structure}${p.cut}${p.curved}`;

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function mvec(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
function mtvec(M, v) { return [M[0] * v[0] + M[3] * v[1] + M[6] * v[2], M[1] * v[0] + M[4] * v[1] + M[7] * v[2], M[2] * v[0] + M[5] * v[1] + M[8] * v[2]]; }
function area2(l) { let s = 0; for (let i = 0; i < l.length; i++) { const a = l[i], b = l[(i + 1) % l.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }

// Signed volume of a closed mesh (divergence theorem); positive when triangles face outward.
function meshVolume(m) {
  let v = 0;
  for (let i = 0; i < m.T.length; i += 3) {
    const a = m.T[i] * 3, b = m.T[i + 1] * 3, c = m.T[i + 2] * 3;
    const A = [m.V[a], m.V[a + 1], m.V[a + 2]], B = [m.V[b], m.V[b + 1], m.V[b + 2]], C = [m.V[c], m.V[c + 1], m.V[c + 2]];
    v += dot(A, cross(B, C)) / 6;
  }
  return v;
}
// Closed and consistently oriented: every directed edge once, and its reverse once.
function manifold(m) {
  const seen = new Map();
  for (let i = 0; i < m.T.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = m.T[i + k], b = m.T[i + (k + 1) % 3], key = a + ',' + b;
      if (a === b || seen.has(key)) return false;
      seen.set(key, true);
    }
  }
  for (const k of seen.keys()) { const [a, b] = k.split(','); if (!seen.has(b + ',' + a)) return false; }
  return true;
}
function primVolume(p) {
  switch (p.type) {
    case 'box': return p.w * p.h * p.d;
    case 'prism': return p.b * p.t / 2 * p.L;
    case 'pyramid': return p.ax * p.az * p.h / 3;
    case 'cylinder': return Math.PI * p.r * p.r * p.h;
    case 'cone': return Math.PI * p.r * p.r * p.h / 3;
    case 'sphere': return 4 / 3 * Math.PI * p.r ** 3;
  }
  return NaN;
}

/* ------------------------------------------------------------------ definition and difficulty */

function testDefinition(t, PX, def) {
  t.eq([def.id, def.version, def.code, def.abilities, def.cell, def.role, def.answer, def.nOptions],
    ['slice', 1, 'EX-06', ['Vz'], 'intrinsic-dynamic', 'train', 'choice', 4], 'definition fields');
  t.eq(def.dims.map((d) => [d.key, d.levels.length]), [['structure', 3], ['cut', 3], ['curved', 2]], 'dims: structure × cut × curved');
  t.ok(def.customDifficulty, 'difficulty has interaction terms (custom)');
  const d = (s, c, k) => def.difficulty({ structure: s, cut: c, curved: k });
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4, `difficulty spans at least 4 logits (${(hi - lo).toFixed(2)})`);
  t.eq(lo, d(0, 0, 0), 'the easiest item is simple, orthogonal, straight-sided');
  t.eq(hi, d(2, 2, 1), 'the hardest item is embedded, double oblique, curved');
  t.near(pRight(0, lo), 0.9, 0.02, 'a beginner (θ = 0) gets the easiest items about 90 % right');
  // SBST interactions (Cohen & Hegarty 2007): joined ≈ simple; oblique hurts embedded items most.
  t.ok(Math.abs(d(1, 0, 0) - d(0, 0, 0)) <= 0.3 && Math.abs(d(1, 1, 0) - d(0, 1, 0)) <= 0.3, 'joined ≈ simple');
  t.ok((d(2, 1, 0) - d(2, 0, 0)) - (d(0, 1, 0) - d(0, 0, 0)) >= 0.9, 'embedded × oblique interaction');
  t.ok(Math.abs(d(2, 0, 0) - d(0, 0, 0)) <= 0.3, 'embedded with an orthogonal cut is about as easy as simple');
  t.ok(d(0, 1, 0) > d(0, 0, 0) && d(0, 2, 0) > d(0, 1, 0) && d(0, 0, 1) > d(0, 0, 0), 'cut and curvature raise difficulty');
  let mono = true;
  for (let s = 0; s < 3; s++) for (let k = 0; k < 2; k++) for (let c = 1; c < 3; c++) if (d(s, c, k) <= d(s, c - 1, k)) mono = false;
  t.ok(mono, 'harder cuts are harder at every structure and curvature');
}

/* ------------------------------------------------------------------ meshes */

function testMeshes(t, PX, L) {
  t.section('slice: meshes');
  const r = PX.rng(606);
  const prims = [];
  for (let i = 0; i < 30; i++) {
    prims.push({ type: 'box', w: r.float(0.5, 2), h: r.float(0.5, 2), d: r.float(0.5, 2) });
    prims.push({ type: 'prism', b: r.float(0.8, 2), t: r.float(0.6, 1.6), L: r.float(1, 2), ax: r.float(-0.4, 0.4) });
    prims.push({ type: 'pyramid', ax: r.float(0.8, 2), az: r.float(0.8, 2), h: r.float(0.8, 2) });
    prims.push({ type: 'cylinder', r: r.float(0.3, 1), h: r.float(0.5, 2) });
    prims.push({ type: 'cone', r: r.float(0.3, 1), h: r.float(0.5, 2) });
    prims.push({ type: 'sphere', r: r.float(0.3, 1.2) });
  }
  let closed = true, vol = true, worst = 0, seg = true;
  for (const p of prims) {
    const m = L.primitiveMesh(p);
    if (!manifold(m)) closed = false;
    const v = meshVolume(m), want = primVolume(p), rel = (want - v) / want;
    worst = Math.max(worst, Math.abs(rel));
    if (!(rel >= -1e-9 && rel < 0.012)) vol = false; // inscribed tessellation: slightly smaller, never larger
    if (p.type === 'cylinder' && m.V.length / 3 < 2 * 64) seg = false;
  }
  t.ok(closed, 'every primitive mesh is closed and consistently oriented');
  t.ok(vol, `primitive mesh volumes match the analytic volumes within 1.2 % (worst ${(worst * 100).toFixed(2)} %)`);
  t.ok(seg, 'curved surfaces have at least 64 segments');
}

/* ------------------------------------------------------------------ the pool */

function testPool(t, PX, def, L) {
  t.section('slice: pool');
  const combos = PX.ex.enumerate(def);
  t.eq(combos.length, 18, '18 level combinations');
  const per = Math.ceil(N_ITEMS / combos.length);
  const items = [];
  let threw = 0, invalid = 0, keyWrong = 0, foilRight = 0, shape = 0, firstBad = null, json = 0, maxBytes = 0, normBad = 0;
  const kinds = {}, solidKinds = {}, statsBefore = { ...L.stats };
  for (const p of combos) {
    for (let s = 0; s < per; s++) {
      const seed = PX.rng.hash('slice-test', key3(p), s);
      let it;
      try { it = def.generate(PX.rng(seed), p); } catch (e) { threw++; firstBad = firstBad || `${key3(p)}#${s} threw ${e.message}`; continue; }
      const v = def.validate(it);
      if (v !== true) { invalid++; firstBad = firstBad || `${key3(p)}#${s}: ${v}`; }
      if (!def.score(it, it.key).correct) keyWrong++;
      for (let i = 0; i < it.options.length; i++) if (i !== it.key && def.score(it, i).correct) foilRight++;
      if (!(it.ex === 'slice' && it.seed === seed && Array.isArray(it.options) && it.options.length === 4 && it.options[it.key].kind === 'key')) shape++;
      // normalised loops: centred on the bounding box, larger half-extent 1
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      it.options.forEach((o) => o.loops.forEach((l) => l.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); })));
      it.options.forEach((o) => {
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        o.loops.forEach((l) => l.forEach(([x, y]) => { a0 = Math.min(a0, x); a1 = Math.max(a1, x); b0 = Math.min(b0, y); b1 = Math.max(b1, y); }));
        if (Math.abs(a0 + a1) > 2e-6 || Math.abs(b0 + b1) > 2e-6 || Math.abs(Math.max(a1, b1) - 1) > 2e-6) normBad++;
      });
      const text = JSON.stringify(it);
      maxBytes = Math.max(maxBytes, text.length);
      if (JSON.stringify(JSON.parse(text)) !== text) json++;
      it.options.forEach((o) => { kinds[o.kind] = (kinds[o.kind] || 0) + 1; });
      solidKinds[it.solid.kind] = (solidKinds[it.solid.kind] || 0) + 1;
      items.push({ p, s, seed, it });
    }
  }
  const n = items.length;
  t.ok(n >= Math.min(10000, N_ITEMS), `at least 10 000 seeds (${n})`);
  t.eq(threw, 0, 'generate never throws' + (firstBad && threw ? ` (${firstBad})` : ''));
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad && invalid ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(foilRight, 0, 'every other option scores wrong');
  t.eq(shape, 0, 'items carry ex, seed, four options and the key option');
  t.eq(normBad, 0, 'option loops are centred and scaled so the larger half-extent is 1');
  t.eq(json, 0, 'items survive a JSON round trip');
  t.ok(maxBytes < 40000, `items stay small (largest ${maxBytes} bytes)`);
  t.eq(L.stats.errors - statsBefore.errors, 0, 'no attempt threw inside generate' + (L.stats.lastError ? ': ' + String(L.stats.lastError).split('\n')[0] : ''));
  t.eq(L.stats.fallbacks - statsBefore.fallbacks, 0, 'no item needed the fallback construction');
  const tries = L.stats.tries - statsBefore.tries;
  t.ok(tries / n < 1.3, `attempts per item ${(tries / n).toFixed(3)}`);
  ['key', 'ego', 'cut', 'solid', 'cut-ego', 'solid-ego', 'proj'].forEach((k) => t.ok(kinds[k] > 0, `option kind ${k} occurs (${kinds[k] || 0})`));
  t.eq(kinds.key, n, 'one key per item');
  t.eq(kinds.ego, n, 'one egocentric foil per item');
  const allKinds = ['cube', 'box', 'pyramid', 'prism', 'cylinder', 'cone', 'house', 'barn', 'L', 'step', 'boxcyl', 'boxcone', 'cylcone', 'cyldome', 'cylcyl', 'bicone'];
  t.ok(allKinds.every((k) => solidKinds[k] > 0), 'every simple and joined solid occurs: ' + allKinds.filter((k) => !solidKinds[k]).join(', '));
  t.ok(Object.keys(solidKinds).filter((k) => k.includes('>')).length >= (N_ITEMS >= 5000 ? 14 : 8), 'embedded pairs occur: ' + Object.keys(solidKinds).filter((k) => k.includes('>')).length);

  t.section('slice: determinism');
  let same = 0, checked = 0;
  for (let i = 0; i < items.length; i += 10) {
    const { p, seed, it } = items[i];
    checked++;
    if (JSON.stringify(def.generate(PX.rng(seed), p)) === JSON.stringify(it)) same++;
  }
  t.eq(same, checked, `the same seed gives the same item (${checked} seeds regenerated)`);
  const seen = new Set(items.map((x) => JSON.stringify(x.it.options[x.it.key].loops)));
  // Some keys repeat by nature (every orthogonal cut of a cube is the same square).
  t.ok(seen.size > 0.9 * n, `keys are varied (${seen.size} distinct of ${n})`);
  return items;
}

/* ------------------------------------------------------------------ shortcut solvers */

// Ties: values a person cannot tell apart share the pick (the expected accuracy splits evenly).
const TIE = { sil: 0.03, raster: 0.03, aspect: 0.06, fill: 0.03 };
function share(scores, key, high, tol = 1e-9) {
  const best = high ? Math.max(...scores) : Math.min(...scores);
  const near = (x) => Math.abs(x - best) <= tol;
  return near(scores[key]) ? 1 / scores.filter(near).length : 0;
}
function iou(g1, g2) {
  let both = 0, any = 0;
  for (let i = 0; i < g1.length; i++) if (g1[i] || g2[i]) { any++; if (g1[i] && g2[i]) both++; }
  return any ? both / any : 1;
}
// The solid's silhouette from the stem's viewpoint, computed here from the mesh (the union of its
// projected triangles; the outer solid when embedded), normalised like an option.
function meshSilhouette(L, solid, M) {
  const mesh = L.solidMeshes(solid)[0], R = L.GRID_R, cell = 2 * R / M, V = L.VIEW;
  const P = [];
  for (let i = 0; i < mesh.V.length; i += 3) { const q = [mesh.V[i], mesh.V[i + 1], mesh.V[i + 2]]; P.push([dot(q, V.right), dot(q, V.up)]); }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, s = 1 / Math.max((x1 - x0) / 2, (y1 - y0) / 2);
  const Q = P.map(([x, y]) => [(x - cx) * s, (y - cy) * s]);
  const g = new Uint8Array(M * M);
  for (let i = 0; i < mesh.T.length; i += 3) {
    const a = Q[mesh.T[i]], b = Q[mesh.T[i + 1]], c = Q[mesh.T[i + 2]];
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) < 1e-14) continue;
    const r0 = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) + R) / cell)), r1 = Math.min(M - 1, Math.floor((Math.max(a[1], b[1], c[1]) + R) / cell));
    const k0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) + R) / cell)), k1 = Math.min(M - 1, Math.floor((Math.max(a[0], b[0], c[0]) + R) / cell));
    for (let r = r0; r <= r1; r++) {
      const y = -R + (r + 0.5) * cell;
      for (let k = k0; k <= k1; k++) {
        const x = -R + (k + 0.5) * cell;
        const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
        if (l1 >= -1e-9 && l2 >= -1e-9 && l1 + l2 <= 1 + 1e-9) g[r * M + k] = 1;
      }
    }
  }
  return g;
}

function testShortcuts(t, PX, L, pool) {
  t.section('slice: shortcut solvers');
  const M = L.SMALL;
  const corners = (d) => d.parts.reduce((s, q) => s + q.corners, 0);
  const sumBy = (n, f) => Array.from({ length: n }, (_, i) => { let s = 0; for (let j = 0; j < n; j++) if (j !== i) s += f(i, j); return s; });
  const solvers = {
    // required by the brief
    'most corners': (x) => share(x.D.map(corners), x.key, true),
    'silhouette': (x) => share(x.G.map((g) => iou(g, x.sil)), x.key, true, TIE.sil),
    'like the others': (x) => { const s = sumBy(4, (i, j) => L.ddist(x.D[i], x.D[j])); return share(s, x.key, false, 0.03 * Math.max(...s)); },
    // further cheap heuristics the generator also balances
    'like the others (rasters)': (x) => share(sumBy(4, (i, j) => L.agreement(x.G[i], x.G[j])), x.key, true, TIE.raster),
    'closest twin': (x) => { const s = x.D.map((d, i) => Math.min(...x.D.map((e, j) => (i === j ? Infinity : L.ddist(d, e))))); return share(s, x.key, false, 0.03 * Math.max(...s)); },
    'roundest': (x) => share(x.D.map((d) => d.parts[0].aspect), x.key, true, TIE.aspect),
    'fullest': (x) => share(x.D.map((d) => d.parts[0].fill), x.key, true, TIE.fill),
  };
  const diagnostics = {
    'fewest corners': (x) => share(x.D.map(corners), x.key, false),
    'odd one out': (x) => { const s = sumBy(4, (i, j) => L.ddist(x.D[i], x.D[j])); return share(s, x.key, true, 0.03 * Math.max(...s)); },
    'flattest': (x) => share(x.D.map((d) => d.parts[0].aspect), x.key, false, TIE.aspect),
    'loop count of the solid': (x) => { const n = x.it.solid.structure === 'embedded' ? 2 : 1, ok = x.D.map((d) => (d.loops === n ? 1 : 0)); return ok[x.key] ? 1 / ok.reduce((a, b) => a + b, 0) : 0; },
  };
  const all = Object.assign({}, solvers, diagnostics), tot = {}, perLevel = {};
  for (const { p, it } of pool) {
    const x = { it, key: it.key, D: it.options.map((o) => L.describe(o.loops)), G: it.options.map((o) => L.rasterize(o.loops, M)), sil: meshSilhouette(L, it.solid, M) };
    const lv = key3(p);
    perLevel[lv] = perLevel[lv] || { n: 0 };
    perLevel[lv].n++;
    for (const [name, f] of Object.entries(all)) {
      const v = f(x);
      tot[name] = (tot[name] || 0) + v;
      perLevel[lv][name] = (perLevel[lv][name] || 0) + v;
    }
  }
  const n = pool.length, line = [];
  for (const name of Object.keys(all)) {
    const acc = tot[name] / n;
    let worst = 0, worstLv = '';
    for (const [lv, o] of Object.entries(perLevel)) if (o[name] / o.n > worst) { worst = o[name] / o.n; worstLv = lv; }
    line.push(`${name} ${(acc * 100).toFixed(1)}%`);
    if (solvers[name]) t.ok(acc <= LIMIT, `shortcut "${name}" ${(acc * 100).toFixed(1)} % ≤ chance + 10 over the pool (worst level ${worstLv}: ${(worst * 100).toFixed(0)} %)`);
    else t.ok(Math.max(acc, (1 - acc) / 3) <= LIMIT, `diagnostic "${name}" ${(acc * 100).toFixed(1)} %: neither it nor eliminating its pick beats chance + 10`);
  }
  console.log('       slice shortcuts over ' + n + ' items: ' + line.join(', '));
}

/* ------------------------------------------------------------------ analytic sections (second method) */

// Convex polyhedra in their own frame: vertices and edges.
function polyhedron(p) {
  const V = [], E = [];
  if (p.type === 'box') {
    for (let i = 0; i < 8; i++) V.push([(i & 1 ? 0.5 : -0.5) * p.w, (i & 2 ? 0.5 : -0.5) * p.h, (i & 4 ? 0.5 : -0.5) * p.d]);
    for (let i = 0; i < 8; i++) for (const b of [1, 2, 4]) if (!(i & b)) E.push([i, i | b]);
  } else if (p.type === 'prism') {
    const tri = [[-p.b / 2, -p.t / 2], [p.b / 2, -p.t / 2], [p.ax, p.t / 2]];
    tri.forEach(([x, y]) => V.push([x, y, -p.L / 2], [x, y, p.L / 2]));
    for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; E.push([2 * i, 2 * j], [2 * i + 1, 2 * j + 1], [2 * i, 2 * i + 1]); }
  } else if (p.type === 'pyramid') {
    V.push([0, p.h / 2, 0]);
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    c.forEach(([a, b]) => V.push([a * p.ax / 2, -p.h / 2, b * p.az / 2]));
    for (let i = 0; i < 4; i++) E.push([0, i + 1], [i + 1, ((i + 1) % 4) + 1]);
  }
  return { V, E };
}
function hull2(points) {
  const P = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 1e-12) lo.pop(); lo.push(q); }
  for (const q of P.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 1e-12) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

function testAnalytic(t, PX, L, pool) {
  t.section('slice: analytic sections');
  let n = 0, areaBad = 0, cornerBad = 0, curvedN = 0, curvedBad = 0, first = null;
  for (const { it } of pool) {
    const sol = it.solid;
    if (sol.structure !== 'simple') continue;
    const part = sol.parts[0], R = L.solidRot(sol);
    const pl = mtvec(R, it.plane.p), nl = mtvec(R, it.plane.n), ul = mtvec(R, it.frame.u), vl = mtvec(R, it.frame.v);
    const key = it.options[it.key], keyArea = Math.abs(area2(key.loops[0])) / (it.norm.s * it.norm.s);
    if (part.type === 'box' || part.type === 'prism' || part.type === 'pyramid') {
      const { V, E } = polyhedron(part), pts = [];
      for (const [a, b] of E) {
        const da = dot(sub(V[a], pl), nl), db = dot(sub(V[b], pl), nl);
        if ((da > 0) === (db > 0)) continue;
        const s = da / (da - db), q = [V[a][0] + (V[b][0] - V[a][0]) * s, V[a][1] + (V[b][1] - V[a][1]) * s, V[a][2] + (V[b][2] - V[a][2]) * s];
        pts.push([dot(sub(q, pl), ul), dot(sub(q, pl), vl)]);
      }
      const h = hull2(pts), A = Math.abs(area2(h));
      n++;
      if (Math.abs(A - keyArea) > 0.003 * A) { areaBad++; first = first || `${sol.kind}: ${A.toFixed(4)} vs ${keyArea.toFixed(4)}`; }
      // A corner is a turn of at least 15° (nearly straight vertices are not counted as corners).
      const turns = h.map((q, i) => {
        const a = h[(i + h.length - 1) % h.length], c = h[(i + 1) % h.length];
        const e1 = [q[0] - a[0], q[1] - a[1]], e2 = [c[0] - q[0], c[1] - q[1]];
        return Math.abs(Math.atan2(e1[0] * e2[1] - e1[1] * e2[0], e1[0] * e2[0] + e1[1] * e2[1])) * 180 / Math.PI;
      });
      const want = turns.filter((x) => x >= 15).length, got = L.describe(key.loops).parts[0].corners;
      if (got !== want && !turns.some((x) => x > 12 && x < 18)) { cornerBad++; first = first || `${sol.kind}: ${want} corners vs ${got}`; }
    } else if (part.type === 'cylinder' || part.type === 'cone') {
      // Cuts across the axis (circles) and along it (cylinder: rectangles) have closed forms.
      const along = Math.abs(nl[1]) < 1e-6, across = Math.abs(Math.abs(nl[1]) - 1) < 1e-6;
      let A = null;
      if (across) { const rho = part.type === 'cylinder' ? part.r : part.r * (part.h / 2 - pl[1]) / part.h; A = Math.PI * rho * rho; }
      else if (along && part.type === 'cylinder') { const d = Math.abs(dot(pl, nl)); A = 2 * Math.sqrt(part.r * part.r - d * d) * part.h; }
      if (A === null) continue;
      curvedN++;
      if (Math.abs(A - keyArea) > 0.006 * A) { curvedBad++; first = first || `${sol.kind}: ${A.toFixed(4)} vs ${keyArea.toFixed(4)}`; }
    }
  }
  t.ok(n > N_ITEMS / 10, `polyhedral sections checked against plane–edge intersections (${n})`);
  t.eq(areaBad, 0, 'the key\'s area equals the analytic section area (0.3 %)' + (first ? ` (${first})` : ''));
  t.eq(cornerBad, 0, 'the key\'s corner count equals the analytic polygon\'s');
  t.ok(curvedN > N_ITEMS / 40, `orthogonal cylinder and cone sections checked against closed forms (${curvedN})`);
  t.eq(curvedBad, 0, 'curved orthogonal sections match their closed-form areas (0.6 %)');
}

/* ------------------------------------------------------------------ tampering, fallback, timing */

function testTampering(t, PX, def, L, pool) {
  t.section('slice: validate rejects broken items');
  const cases = {
    'the key index moved': (it) => { it.key = (it.key + 1) % 4; },
    'a foil replaced by the key': (it) => { const j = (it.key + 2) % 4; it.options[j] = JSON.parse(JSON.stringify(it.options[it.key])); it.options[j].kind = 'cut'; },
    'the key shrunk': (it) => { it.options[it.key].loops = it.options[it.key].loops.map((l) => l.map(([x, y]) => [x * 0.8, y * 0.8])); },
    'the key mirrored': (it) => { it.options[it.key].loops = it.options[it.key].loops.map((l) => l.map(([x, y]) => [-x, y]).reverse()); },
    'the plane moved': (it) => { it.plane.p = it.plane.p.map((x, i) => x + it.plane.n[i] * 0.25); },
    'the solid swapped for a foil\'s related solid': (it) => { const f = it.options.find((o) => o.kind === 'solid'); if (f) it.solid = f.solid; else it.key = (it.key + 1) % 4; },
    'no egocentric foil': (it) => { it.options.forEach((o) => { if (o.kind === 'ego') o.kind = 'cut'; }); },
  };
  for (const [name, f] of Object.entries(cases)) {
    let rejected = 0, tried = 0;
    for (let i = 0; i < pool.length && tried < 60; i += 97) {
      const it = JSON.parse(JSON.stringify(pool[i].it));
      f(it);
      tried++;
      if (def.validate(it) !== true) rejected++;
    }
    // A mirrored key is still right when the section is symmetric, and sliding the plane along its
    // normal leaves the section of a box or prism the same; every other change must be caught.
    if (name === 'the key mirrored') t.ok(rejected >= tried * 0.2, `validate rejects: ${name} (${rejected}/${tried}; symmetric sections stay valid)`);
    else if (name === 'the plane moved') t.ok(rejected >= tried * 0.5, `validate rejects: ${name} (${rejected}/${tried}; prismatic sections stay valid)`);
    else t.eq(rejected, tried, `validate rejects: ${name}`);
  }
}

function testFallback(t, PX, def, L) {
  t.section('slice: fallback');
  let ok = 0;
  const combos = PX.ex.enumerate(def);
  for (const p of combos) {
    let it = null;
    try { it = L.fallback(p); } catch (e) { it = null; }
    if (it && def.validate(it) === true) ok++;
  }
  t.eq(ok, combos.length, 'the fallback construction gives a valid item at every level');
}

// Generation cost per item: main-thread CPU time (other processes on a shared machine stretch wall
// time, not this), with wall time reported next to it. Best of up to three rounds of 200.
const cpuMs = typeof process.threadCpuUsage === 'function'
  ? () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; }
  : () => performance.now();
function p95Rounds(gen) {
  const rounds = [];
  for (let r = 0; r < 3; r++) {
    const cpu = [], wall = [];
    for (let s = 0; s < 200; s++) {
      const c0 = cpuMs(), w0 = performance.now();
      gen(r, s);
      cpu.push(cpuMs() - c0); wall.push(performance.now() - w0);
    }
    cpu.sort((a, b) => a - b); wall.sort((a, b) => a - b);
    rounds.push({ cpu: cpu[190], wall: wall[190] });
    if (rounds[r].cpu < 20) break;
  }
  const best = rounds.reduce((a, b) => (b.cpu < a.cpu ? b : a));
  return { best, text: rounds.map((x) => `${x.cpu.toFixed(1)} (wall ${x.wall.toFixed(1)})`).join(', ') };
}

function testTiming(t, PX, def) {
  t.section('slice: timing');
  const hard = { structure: 2, cut: 2, curved: 1 };
  const r = p95Rounds((round, s) => def.generate(PX.rng(PX.rng.hash('slice-timing', round, s)), hard));
  t.ok(r.best.cpu < 20, `generation p95 at the hardest level ${r.best.cpu.toFixed(1)} ms CPU < 20 ms (rounds: ${r.text})`);
}

/* ------------------------------------------------------------------ learn data */

function testLearn(t, PX, def) {
  t.section('slice: learn');
  const L = PX.ex.learn('slice');
  t.ok(L && typeof L === 'object', 'learn data is registered');
  if (!L) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, 'a one-line goal');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  for (const id of ['solid', 'plane', 'options']) t.ok(L.parts.some((p) => p.id === id), `a part for the ${id}`);
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed)), 'demo items with valid params');
  t.ok(L.demo.every((d) => PX.ex.difficulty(def, d.params) <= PX.ex.minDifficulty(def) + 0.61), 'demos are at the easiest levels');
  for (const d of L.demo) {
    const item = def.generate(PX.rng(d.seed), d.params);
    t.eq(item.solid.kind, d.kind, `demo seed ${d.seed} gives a ${d.kind}`);
    t.ok(def.validate(item) === true && item.options.some((o) => o.kind === 'ego'), `demo seed ${d.seed} is valid and has the slanted-view option the demo talks about`);
  }
  t.ok(Array.isArray(L.practice) && L.practice.length >= 3 && L.practice.length <= 5 && L.practice.every(valid), '3–5 practice params');
  const ds = L.practice.map((p) => PX.ex.difficulty(def, p));
  t.ok(ds.every((x, i) => i === 0 || x >= ds[i - 1]), `practice goes from easy to harder (${ds.map((x) => x.toFixed(2)).join(', ')})`);
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).length && tr.levels.every((l) => l >= 0 && l < d.levels.length));
    t.ok(tip.id && tip.text && dimOk && tr.dim, `tip ${tip.id} has a valid trigger`);
  }
  // A tip the first time each harder mechanic appears: tilted cuts, joined and embedded solids, curves.
  for (const [dim, lv] of [['cut', 1], ['cut', 2], ['structure', 1], ['structure', 2], ['curved', 1]]) {
    t.ok(L.tips.some((x) => x.when.dim === dim && x.when.levels.includes(lv)), `a tip when ${dim} level ${lv} first appears`);
  }
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['solid', 'plane', 'options', 'sweep', 'lift', 'slant', 'slantPicked', 'turn', 'land', 'whyCut', 'whySolid', 'whyProj'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  t.ok(['slant', 'slantPicked', 'land', 'whyCut', 'whySolid', 'whyProj'].every((k) => L.captions[k].includes('{n}')), 'captions that name an option say which ({n})');
  t.ok(typeof L.bridge === 'string' && /has not been shown to improve grades or job performance/.test(L.bridge), 'a "where it is used" line with its limitation beside it');
  const all = JSON.stringify(L).toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered/.test(all), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
}
