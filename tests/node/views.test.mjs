/* EX-07 Views: generator, validator, scorer, shortcut solvers, timing. Run through tests/node/run.mjs.
   N_ITEMS seeds spread over every level and variant (90 combinations); determinism on every 10th. */
import { performance } from 'node:perf_hooks';
import { MANIFEST } from './run.mjs';

// An own context with only the files Views needs, so other exercises' work in progress
// cannot break this test.
const FILES = [...MANIFEST, 'js/ex/views/gen.js', 'js/ex/views/learn.js'];

const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10152); // 94 per combination (the override is for quick local runs)
const CHANCE = 0.25, LIMIT = CHANCE + 0.10;
// The starter level (v1.2, note D2 §3.1): cubes level 0 for toview (3–4 cubes, ≤ 2 high, no mirror).
const inBand = (p) => p.cubes === 0 && p.variant === 'toview';
const oldLevel = (p) => (p.cubes > 0 ? p.cubes - 1 : 0);
const OLD_FLOOR = -2.4, OLD_TOVIEW_FLOOR = -2.2, NEW_FLOOR = -3.8;

export async function run(t) {
  const PX = t.context({ files: FILES }).PX, def = PX.ex.get('views');
  t.section('views: definition');
  t.ok(def, 'views is defined');
  if (!def) return;
  const L = def.lib;
  testDefinition(t, PX, def);
  testMethods(t, PX, L);
  const pool = testPool(t, PX, def, L);
  testVariants(t, PX, def, L, pool);
  testShortcuts(t, PX, def, L, pool);
  testTampering(t, PX, def, L, pool);
  testFallback(t, PX, def, L);
  testTiming(t, PX, def);
  testLearn(t, PX, def);
}

const sig = (x) => 1 / (1 + Math.exp(-x));
const pRight = (theta, b, g = CHANCE) => g + (1 - g - 0.03) * sig(theta - b);
const pk = (p) => `${p.variant}:${p.cubes}${p.grid}${p.view}`;

/* ------------------------------------------------------------------ definition and difficulty */

function testDefinition(t, PX, def) {
  t.eq([def.id, def.version, def.code, def.abilities, def.cell, def.role, def.answer, def.nOptions],
    ['views', 2, 'EX-07', ['Vz'], 'intrinsic-static', 'train', 'choice', 4], 'definition fields (version 2: the starter level)');
  t.eq(def.dims.map((d) => [d.key, d.levels.length]), [['cubes', 6], ['grid', 2], ['view', 3]], 'dims: cubes × grid × view');
  t.eq(def.dims[0].levels, ['3–4', 4, 6, 8, 10, 12], 'cubes: the starter level, then 4–12 in steps of two');
  t.eq(def.starter, { dim: 'cubes', levels: 1 }, 'starter: the first cubes level');
  t.eq(def.variants, ['toview', 'toobject', 'count'], 'variants');
  const stepSpan = def.dims.reduce((s, d, i) => s + d.step * (d.levels.length - (i === 0 ? 2 : 1)), 0);
  t.ok(stepSpan >= 4, `the 1.1 dims' steps span at least 4 logits (${stepSpan.toFixed(2)})`);
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4, `difficulty spans at least 4 logits (${(hi - lo).toFixed(2)})`);
  t.near(lo, NEW_FLOOR, 1e-9, 'the new floor is −3.8 (toview, Δ −1.6)');
  t.near(hi, 1.9, 1e-9, 'the top of the range is the 1.1 top');
  const d = (variant, cubes, grid, view) => def.difficulty({ cubes, grid, view, variant });
  // every 1.1 combination keeps its difficulty, one level up; the band: toview Δ −1.6, others = level 0
  const all = PX.ex.enumerate(def);
  let same = 0, n11 = 0;
  const v11 = (p) => -2.2 + 0.65 * oldLevel(p) + 0.6 * p.grid + (p.variant === 'toview' ? [0, 0.45, 0.9][p.view] : 0) + { toview: 0, toobject: 0.9, count: -0.2 }[p.variant];
  for (const p of all) if (p.cubes > 0) { n11++; if (Math.abs(def.difficulty(p) - v11(p)) < 1e-9) same++; }
  t.eq(same, n11, `every 1.1 combination keeps its 1.1 difficulty (${n11})`);
  t.ok(all.filter((p) => p.cubes === 0).every((p) => Math.abs(def.difficulty(p) - (v11(p) + (p.variant === 'toview' ? -1.6 : 0))) < 1e-9),
    'the starter level: toview Δ −1.6; count and toobject as at level 0');
  t.ok(pRight(0, OLD_TOVIEW_FLOOR) >= 0.88 && pRight(0, OLD_TOVIEW_FLOOR) <= 0.93 && Math.abs(d('toview', 1, 0, 0) - OLD_TOVIEW_FLOOR) < 1e-9,
    `a beginner gets the pre-1.2 toview floor about 90 % right (${pRight(0, OLD_TOVIEW_FLOOR).toFixed(3)})`);
  t.ok(pRight(0, lo) > pRight(0, OLD_TOVIEW_FLOOR) + 0.04, `the starter floor is easier still (${pRight(0, lo).toFixed(3)} at θ = 0)`);
  t.ok(d('toview', 5, 1, 2) > d('toview', 1, 0, 0) && d('toview', 1, 0, 2) > d('toview', 1, 0, 1) && d('toview', 1, 0, 1) > d('toview', 1, 0, 0), 'more cubes, a larger grid and the front or right view are harder');
  t.ok(d('toobject', 3, 0, 0) > d('toview', 3, 0, 0), 'three views to one object is harder than one view');
  t.eq(d('count', 3, 1, 0), d('count', 3, 1, 2), 'the view dim does not change count items');
}

/* ------------------------------------------------------------------ two methods agree */

function testMethods(t, PX, L) {
  t.section('views: methods');
  const r = PX.rng(707);
  let views = 0, viewsOk = 0, vis = 0, visOk = 0, codes = 0;
  for (let k = 0; k < 1500; k++) {
    const G = k % 2 ? 4 : 3, h = L.randomStructure(r, G, 4 + (k % 9));
    const vx = L.voxels(h);
    for (const dir of L.DIRS) {
      views++;
      const a = L.drawing(L.depthImage(h, dir)), b = L.imageEdges(L.rayImage(vx, dir));
      if (L.linesEdges(a) === b) viewsOk++;
      if (L.viewCode(h, dir) === a.code) codes++;
    }
    vis++;
    const lat = L.isoFaces(h), ray = L.rayVisibility(h).faces;
    if (JSON.stringify(lat) === JSON.stringify(ray) && L.allVisible(h) === ray.every((f) => f.includes(2))) visOk++;
  }
  t.eq(viewsOk, views, 'height-map views equal ray-cast views (5 directions, 1 500 structures)');
  t.eq(codes, views, 'the fast view code matches the full drawing');
  t.eq(visOk, vis, 'lattice visibility equals ray-cast visibility');
  // A hand-made case: an L of three columns, heights 1, 2, 3.
  const h = [[0, 0, 0], [0, 0, 0], [1, 2, 3]];
  t.eq(L.view(h, 'front').area, 6, 'front view area of a 1-2-3 staircase');
  t.eq(L.view(h, 'top').area, 3, 'top view area = footprint');
  t.eq([L.view(h, 'right').w, L.view(h, 'right').h], [1, 3], 'right view of a row is one cell wide and three high');
}

/* ------------------------------------------------------------------ the pool */

function testPool(t, PX, def, L) {
  t.section('views: pool');
  const combos = PX.ex.enumerate(def);
  t.eq(combos.length, 108, '108 combinations (6 × 2 × 3 levels × 3 variants)');
  const per = Math.ceil(N_ITEMS / combos.length), items = [];
  let threw = 0, invalid = 0, keyWrong = 0, foilRight = 0, json = 0, first = null;
  const before = { ...L.stats };
  for (const p of combos) {
    for (let s = 0; s < per; s++) {
      const seed = PX.rng.hash('views-test', pk(p), s);
      let it;
      try { it = def.generate(PX.rng(seed), p); } catch (e) { threw++; first = first || `${pk(p)}#${s} threw ${e.message}`; continue; }
      const v = def.validate(it);
      if (v !== true) { invalid++; first = first || `${pk(p)}#${s}: ${v}`; }
      if (!def.score(it, it.key).correct) keyWrong++;
      for (let i = 0; i < 4; i++) if (i !== it.key && def.score(it, i).correct) foilRight++;
      const text = JSON.stringify(it);
      if (JSON.stringify(JSON.parse(text)) !== text) json++;
      items.push({ p, s, seed, it });
    }
  }
  const n = items.length;
  t.ok(n >= Math.min(10000, N_ITEMS), `at least 10 000 seeds (${n})`);
  t.eq(threw, 0, 'generate never throws' + (threw ? ` (${first})` : ''));
  t.eq(invalid, 0, 'validate passes on every item' + (invalid ? ` (${first})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(foilRight, 0, 'every other option scores wrong');
  t.eq(json, 0, 'items survive a JSON round trip');
  t.eq(L.stats.errors - before.errors, 0, 'no attempt threw inside generate' + (L.stats.lastError ? ': ' + String(L.stats.lastError).split('\n')[0] : ''));
  t.eq(L.stats.fallbacks - before.fallbacks, 0, 'no item needed the fallback construction');
  t.ok((L.stats.tries - before.tries) / n < 1.3, `attempts per item ${((L.stats.tries - before.tries) / n).toFixed(3)}`);

  t.section('views: determinism');
  let same = 0, checked = 0;
  for (let i = 0; i < items.length; i += 10) {
    checked++;
    if (JSON.stringify(def.generate(PX.rng(items[i].seed), items[i].p)) === JSON.stringify(items[i].it)) same++;
  }
  t.eq(same, checked, `the same seed gives the same item (${checked} seeds regenerated)`);
  const distinct = new Set(items.map((x) => x.p.variant + JSON.stringify(x.it.heights)));
  t.ok(distinct.size > 0.6 * n, `structures are varied (${distinct.size} distinct of ${n})`);
  // the starter level: 3–4 cubes at most 2 high, no mirror foil, no foil near the mirrored key
  const band = items.filter((x) => inBand(x.p));
  const bandOk = band.filter(({ it }) => { const N = L.total(it.heights); return N >= 3 && N <= 4 && L.maxHeight(it.heights) <= 2 && it.options.every((o) => o.kind !== 'mirror'); }).length;
  t.eq(bandOk, band.length, `starter level: 3–4 cubes, at most 2 high, no mirror foil (${band.length} items)`);
  const nearMirror = band.filter(({ it }) => { const want = L.linesEdges(it.options[it.key].drawing), mir = L.mirrorEdges(want); return it.options.some((o, i) => i !== it.key && L.edgeDiff(L.linesEdges(o.drawing), mir) < 3); }).length;
  t.eq(nearMirror, 0, 'starter level: no foil within 3 unit edges of the key\'s mirror image');
  t.ok(items.filter((x) => !inBand(x.p) && x.p.variant === 'toview').every(({ it }) => L.total(it.heights) >= 4), 'above the starter level toview structures keep 4–12 cubes');
  return items;
}

/* ------------------------------------------------------------------ per variant */

function testVariants(t, PX, def, L, pool) {
  t.section('views: variants');
  const kinds = { toview: {}, toobject: {} };
  let viewOk = 0, nView = 0, matchOk = 0, nObj = 0, countOk = 0, nCount = 0, visOk = 0;
  const ranks = [0, 0, 0, 0], values = {};
  for (const { p, it } of pool) {
    if (L.rayVisibility(it.heights).faces.every((f) => f.includes(2))) visOk++;
    if (p.variant === 'toview') {
      nView++;
      if (it.view === L.ASKED[p.view] && it.options.every((o) => o.drawing && Array.isArray(o.drawing.lines))) viewOk++;
      it.options.forEach((o, i) => { if (i !== it.key) kinds.toview[o.kind] = (kinds.toview[o.kind] || 0) + 1; });
    } else if (p.variant === 'toobject') {
      nObj++;
      const nk = L.total(it.heights);
      const ok = it.options.every((o, i) => (i === it.key ? o.matches.length === 3 : o.matches.length >= 1 && o.matches.length <= 2) && Math.abs(L.total(o.heights) - nk) <= 1);
      if (ok && it.views && it.views.top && it.views.front && it.views.right) matchOk++;
      it.options.forEach((o, i) => { if (i !== it.key) kinds.toobject[o.kind] = (kinds.toobject[o.kind] || 0) + 1; });
    } else {
      nCount++;
      const lo = 4 + oldLevel(p), hi = 8 + oldLevel(p), o = it.options;
      if (o.every((x) => x >= lo && x <= hi) && o[it.key] === L.total(it.heights)) countOk++;
      ranks[it.key]++;
      values[o[it.key] - lo] = (values[o[it.key] - lo] || 0) + 1;
    }
  }
  t.eq(visOk, pool.length, 'every shown structure shows a whole face of every cube');
  t.eq(viewOk, nView, 'toview items ask for their level\'s view and give line drawings');
  t.ok(['direction', 'mirror', 'neighbour'].every((k) => kinds.toview[k] > 0), 'toview foils: other direction, mirror, neighbouring structure ' + JSON.stringify(kinds.toview));
  t.eq(matchOk, nObj, 'toobject foils match one or two of the three views and differ from the key by at most one cube');
  t.ok(kinds.toobject.match1 > 0 && kinds.toobject.match2 > 0, 'toobject foils match one view and two views ' + JSON.stringify(kinds.toobject));
  t.eq(countOk, nCount, 'count options lie in the level\'s five-number window and the key is the cube count');
  t.ok(ranks.every((r) => r / nCount > 0.15 && r / nCount < 0.35), `count: the key's place among the options is spread (${ranks.map((r) => (r / nCount * 100).toFixed(0) + '%').join(' ')})`);
  t.ok([0, 1, 2, 3, 4].every((v) => (values[v] || 0) / nCount > 0.12), 'count: every number of the window is a key');
}

/* ------------------------------------------------------------------ shortcut solvers */

function share(scores, key, high) {
  const best = high ? Math.max(...scores) : Math.min(...scores);
  return scores[key] === best ? 1 / scores.filter((x) => x === best).length : 0;
}
const sums = (n, f) => Array.from({ length: n }, (_, i) => { let s = 0; for (let j = 0; j < n; j++) if (j !== i) s += f(i, j); return s; });

function testShortcuts(t, PX, def, L, pool) {
  t.section('views: shortcut solvers');
  const acc = {}, cnt = {}, req = {};
  const add = (name, v, required) => { acc[name] = (acc[name] || 0) + v; cnt[name] = (cnt[name] || 0) + 1; if (required !== undefined) req[name] = required; };
  // The starter level's own pool: the pool's band items plus more, at least 2,000 in all.
  const bandItems = pool.filter((x) => inBand(x.p)).map((x) => x.it);
  for (let s = 0; bandItems.length < 2000 && s < 4000; s++) {
    const p = { cubes: 0, grid: s % 2, view: Math.floor(s / 2) % 3, variant: 'toview' };
    bandItems.push(def.generate(PX.rng(PX.rng.hash('views-band', s)), p));
  }
  const bacc = {};
  const badd = (name, v) => { const a = bacc[name] = bacc[name] || { v: 0, n: 0 }; a.v += v; a.n++; };
  let bandInvalid = 0;
  for (const it of bandItems) {
    if (def.validate(it) !== true) { bandInvalid++; continue; }
    const T = L.footprint(it.heights), E = it.options.map((o) => L.linesEdges(o.drawing)), lines = E.map((e) => e.split(' ').length);
    badd('filled area = top cells', share(it.options.map((o) => -Math.abs(o.drawing.area - T)), it.key, true));
    badd('like the others', share(sums(4, (i, j) => L.edgeDiff(E[i], E[j])), it.key, false));
    badd('most lines', share(lines, it.key, true));
    badd('fewest lines', share(lines, it.key, false));
    badd('largest drawing', share(it.options.map((o) => o.drawing.w * o.drawing.h), it.key, true));
    badd('smallest drawing', share(it.options.map((o) => o.drawing.w * o.drawing.h), it.key, false));
    badd('odd one out', share(sums(4, (i, j) => L.edgeDiff(E[i], E[j])), it.key, true));
  }
  t.eq(bandInvalid, 0, `starter level: every extra item is valid (${bandItems.length} in the pool)`);
  for (const [name, a] of Object.entries(bacc)) t.ok(a.v / a.n <= LIMIT, `starter level: "${name}" ${(100 * a.v / a.n).toFixed(1)} % ≤ chance + 10 (${a.n} items)`);
  console.log('       views starter-level shortcuts: ' + Object.entries(bacc).map(([k, a]) => `${k} ${(100 * a.v / a.n).toFixed(1)}%`).join(', '));
  for (const { p, it } of pool) {
    if (p.variant === 'toview') {
      const T = L.footprint(it.heights), E = it.options.map((o) => L.linesEdges(o.drawing)), lines = E.map((e) => e.split(' ').length);
      add('toview: filled area = top cells', share(it.options.map((o) => -Math.abs(o.drawing.area - T)), it.key, true), true);
      add('toview: like the others', share(sums(4, (i, j) => L.edgeDiff(E[i], E[j])), it.key, false), true);
      add('toview: most lines', share(lines, it.key, true), false);
      add('toview: fewest lines', share(lines, it.key, false), false);
      add('toview: largest drawing', share(it.options.map((o) => o.drawing.w * o.drawing.h), it.key, true), false);
      add('toview: smallest drawing', share(it.options.map((o) => o.drawing.w * o.drawing.h), it.key, false), false);
      add('toview: odd one out', share(sums(4, (i, j) => L.edgeDiff(E[i], E[j])), it.key, true), false);
    } else if (p.variant === 'toobject') {
      const H = it.options.map((o) => o.heights), n = H.map(L.total), mean = n.reduce((a, b) => a + b, 0) / 4;
      add('toobject: like the others', share(sums(4, (i, j) => L.hdist(H[i], H[j])), it.key, false), true);
      add('toobject: most cubes', share(n, it.key, true), false);
      add('toobject: fewest cubes', share(n, it.key, false), false);
      add('toobject: cubes nearest the mean', share(n.map((x) => -Math.abs(x - mean)), it.key, true), false);
      L.ASKED.forEach((v) => add('toobject: checks the ' + v + ' view only', 1 / it.options.filter((o) => o.matches.includes(v)).length));
    } else {
      add('count: the middle option', it.key === 1 || it.key === 2 ? 0.5 : 0, true);
      add('count: like the others', share(sums(4, (i, j) => Math.abs(it.options[i] - it.options[j])), it.key, false), true);
      const lo = 4 + oldLevel(p), hi = 8 + oldLevel(p), inWin = it.options.map((x) => (x >= lo && x <= hi ? 1 : 0));
      add('count: the level\'s typical count', inWin[it.key] / inWin.reduce((a, b) => a + b, 0), false);
    }
  }
  const line = [];
  for (const name of Object.keys(acc)) {
    const a = acc[name] / cnt[name];
    line.push(`${name} ${(a * 100).toFixed(1)}%`);
    if (req[name] === true) t.ok(a <= LIMIT, `shortcut "${name}" ${(a * 100).toFixed(1)} % ≤ chance + 10`);
    else if (req[name] === false) t.ok(a <= LIMIT, `balanced heuristic "${name}" ${(a * 100).toFixed(1)} % ≤ chance + 10`);
  }
  console.log('       views shortcuts: ' + line.join(', '));
}

/* ------------------------------------------------------------------ tampering, fallback, timing */

function testTampering(t, PX, def, L, pool) {
  t.section('views: validate rejects broken items');
  const pick = (variant) => pool.filter((x) => x.p.variant === variant).filter((_, i) => i % 37 === 0).slice(0, 40).map((x) => JSON.parse(JSON.stringify(x.it)));
  const cases = [
    ['toview', 'the key index moved', (it) => { it.key = (it.key + 1) % 4; }],
    ['toview', 'a foil replaced by the key', (it) => { const j = (it.key + 1) % 4; it.options[j] = JSON.parse(JSON.stringify(it.options[it.key])); }],
    ['toview', 'the asked view changed', (it) => { it.view = it.view === 'top' ? 'front' : 'top'; }],
    ['toobject', 'the key index moved', (it) => { it.key = (it.key + 2) % 4; }],
    ['toobject', 'a foil replaced by the key', (it) => { const j = (it.key + 1) % 4; it.options[j] = JSON.parse(JSON.stringify(it.options[it.key])); }],
    ['toobject', 'two stem views swapped', (it) => { const f = it.views.front; it.views.front = it.views.right; it.views.right = f; }],
    ['count', 'the key index moved', (it) => { it.key = (it.key + 1) % 4; }],
    ['count', 'a cube added', (it) => { const h = it.heights; for (let z = 0; z < h.length; z++) for (let x = 0; x < h.length; x++) if (h[z][x] > 0 && h[z][x] < 4) { h[z][x]++; return; } }],
  ];
  for (const [variant, name, f] of cases) {
    // A small starter structure can have equal top and front views; changing the asked view then
    // leaves a valid item (the key is that view too), which is not a broken one.
    const sameView = (it) => it.view && L.linesEdges(L.view(it.heights, it.view === 'top' ? 'front' : 'top')) === L.linesEdges(it.options[it.key].drawing);
    const items = pick(variant).filter((it) => name !== 'the asked view changed' || !sameView(it));
    let rejected = 0;
    items.forEach((it) => { f(it); if (def.validate(it) !== true) rejected++; });
    // Swapping front and right can leave a symmetric structure valid; the rest must always fail.
    if (name === 'two stem views swapped') t.ok(rejected >= items.length * 0.6, `validate rejects (${variant}): ${name} (${rejected}/${items.length})`);
    else t.eq(rejected, items.length, `validate rejects (${variant}): ${name}`);
  }
}

function testFallback(t, PX, def, L) {
  t.section('views: fallback');
  let ok = 0;
  const combos = PX.ex.enumerate(def);
  for (const p of combos) {
    let it = null;
    try { it = L.fallback(L.cleanParams(p)); } catch (e) { it = null; }
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
  t.section('views: timing');
  for (const hard of [{ cubes: 4, grid: 1, view: 2, variant: 'toview' }, { cubes: 4, grid: 1, view: 0, variant: 'toobject' }, { cubes: 4, grid: 0, view: 0, variant: 'toobject' }]) {
    const r = p95Rounds((round, s) => def.generate(PX.rng(PX.rng.hash('views-timing', round, s)), hard));
    t.ok(r.best.cpu < 20, `generation p95 at ${hard.variant} ${hard.cubes},${hard.grid},${hard.view}: ${r.best.cpu.toFixed(1)} ms CPU < 20 ms (rounds: ${r.text})`);
  }
}

/* ------------------------------------------------------------------ learn data */

function testLearn(t, PX, def) {
  t.section('views: learn');
  const L = PX.ex.learn('views');
  t.ok(L && typeof L === 'object', 'learn data is registered');
  if (!L) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, 'a one-line goal');
  t.ok(L.goals && def.variants.every((v) => typeof L.goals[v] === 'string' && L.goals[v].length <= 120), 'a one-line goal per variant');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text && (!p.variant || def.variants.includes(p.variant))), 'labelled parts');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed)), 'demo items with valid params');
  // The easiest level of each variant (variants differ in difficulty by design).
  const easiest = (v) => Math.min(...def.dims[2].levels.map((_, i) => PX.ex.difficulty(def, { cubes: 0, grid: 0, view: i, variant: v })));
  t.ok(L.demo.every((d) => PX.ex.difficulty(def, d.params) <= easiest(d.params.variant) + 0.01), 'demos are at the easiest level of their variant (toview: the starter level)');
  t.eq(L.demo[0].params.variant, 'toview', 'the first demo (the one the player plays) is the main variant');
  for (const d of L.demo) {
    const item = def.generate(PX.rng(d.seed), d.params);
    t.ok(item.variant === d.kind && def.validate(item) === true && !item.fallback, `demo seed ${d.seed} gives a valid ${d.kind} item`);
  }
  // The teaching template (CONTRACT-v1.2 D; note D2 §3.0 C, §3.1).
  t.ok(Array.isArray(L.rules) && L.rules.length >= 2 && L.rules.length <= 4 && L.rules.every((r) => (typeof r === 'string' && r.length > 10) || (r && typeof r.text === 'string' && r.text.length > 10 && typeof r.fig === 'string' && r.fig)), 'a rules card: 2–4 rules, each a text or { text, fig }');
  const ruleText = L.rules.map((r) => (typeof r === 'string' ? r : r.text)).join(' ');
  t.ok(/thick edge/.test(ruleText) && /arrow/.test(ruleText) && /steps nearer or farther/.test(ruleText) && /top view the front is at the bottom/.test(ruleText), 'the three rules of note D2 §3.1: the front and the arrow, lines only at steps, the top view\'s front at the bottom');
  const first = (L.strategies || []).find((x) => x.id === L.strategyFirst);
  t.ok(first && first.steps.length === 3 && /Outline first/.test(first.title), 'strategyFirst names the "Outline first, then inner lines" card, three steps');
  t.ok(Array.isArray(L.practice) && L.practice.length === 4 && L.practice.every((x) => x && valid(x.params) && Number.isInteger(x.seed)), 'four Try items as objects { params, seed, … }');
  const P = L.practice;
  t.ok(P.every((x) => x.params.variant === 'toview'), 'Try stays in toview (the variant of Train\'s first run)');
  t.ok(P[0].assist && P[0].assist.outline === true && P.slice(1).every((x) => !x.assist), 'Try 1 alone has its first step done (the outline drawn)');
  t.ok(inBand(P[0].params) && P[0].params.view === 0 && inBand(P[1].params) && P[1].params.view === 1, 'Try 1: the starter level, top view; Try 2: the starter level, front view');
  t.ok(inBand(P[2].params) && P[2].params.view === 2 && P[2].tip === 'right' && P[3].params.cubes === 1 && P[3].params.view === 0,
    'Try 3: the starter level, right view, with its tip (the right view is taught before Go); Try 4: the pre-1.2 floor, top view');
  const ds = P.map((x) => PX.ex.difficulty(def, x.params));
  t.ok(ds.every((x, i) => i === 0 || x >= ds[i - 1]), `Try goes from easy to harder (${ds.map((x) => x.toFixed(2)).join(', ')})`);
  t.ok(P.every((x) => !x.tip || (L.tips || []).some((tip) => tip.id === x.tip)), 'forced tips exist');
  const gen = (x) => def.generate(PX.rng(x.seed), x.params);
  const watch = gen(L.demo[0]), tries = P.map(gen);
  t.ok(tries.every((it) => !it.fallback && def.validate(it) === true), 'the Try seeds give valid items, none a fallback');
  const kindsOf = (it) => new Set(it.options.filter((o, i) => i !== it.key).map((o) => o.kind));
  const wk = kindsOf(watch), missing = [];
  tries.forEach((it, i) => kindsOf(it).forEach((k) => { if (!wk.has(k)) missing.push(`Try ${i + 1}: ${k}`); }));
  t.eq(missing, [], `every foil kind in the Try items appears in the Watch item (Watch: ${[...wk].join(', ')}; note D2 §3.9 item 1)`);
  const keys = [watch, ...tries].map((it) => it.key);
  t.ok(keys.every((k, i) => i === 0 || k !== keys[i - 1]), `answers vary their slot from item to item (${keys.map((k) => k + 1).join(', ')})`);
  const kd = tries[0].options[tries[0].key].drawing, same = tries[0].options.filter((o, i) => i !== tries[0].key && o.drawing.w === kd.w && o.drawing.h === kd.h).length;
  t.ok(same >= 1 && same <= 2, `Try 1: the drawn outline leaves ${same + 1} drawings of its size (one more step to do)`);
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).length && tr.levels.every((l) => l >= 0 && l < d.levels.length));
    const varOk = !tr.variant || [].concat(tr.variant).every((v) => def.variants.indexOf(v) >= 0); // one variant or a list
    t.ok(tip.id && tip.text && dimOk && varOk && (tr.dim || tr.variant), `tip ${tip.id} has a valid trigger`);
  }
  // A view tip on a 'count' item would talk about a view nobody asked for (validity review).
  t.ok(L.tips.filter((x) => x.when.dim === 'view').every((x) => x.when.variant && [].concat(x.when.variant).indexOf('count') < 0),
    'the view tips are limited to the variants that ask for or draw views (never count)');
  for (const v of ['toobject', 'count']) t.ok(L.tips.some((x) => x.when.variant === v), `a tip when the ${v} variant first appears`);
  for (const lv of [0, 1, 2]) t.ok(L.tips.some((x) => x.when.dim === 'view' && x.when.levels.includes(lv)), `a tip for the ${def.dims[2].levels[lv]} view`);
  t.eq((L.strategies || []).map((s) => s.id), ['outline', 'imagery', 'analytic', 'switch'], 'strategy cards: outline first, imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['structure', 'threeViews', 'arrow', 'optionsToview', 'optionsToobject', 'optionsCount', 'look', 'move', 'trace', 'land',
    'whyDirection', 'whyMirror', 'whyNeighbour', 'objIntro', 'objMove', 'objTrace', 'objMatch', 'objWrong', 'objDiffer', 'countIntro', 'countCol', 'countTop', 'countKey',
    'tint', 'outline', 'outlineAll', 'inner', 'innerTop', 'innerSide', 'whyDirectionTurn', 'whyMirrorFlip', 'whyNeighbourLines', 'assist', 'assistLabel'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  t.ok(typeof L.bridge === 'string' && /has not been shown to improve grades or job performance/.test(L.bridge), 'a "where it is used" line with its limitation beside it');
  const o = L.offscreen || {};
  t.ok(o.title && o.text && Array.isArray(o.steps) && o.steps.length >= 3 && o.note, 'an off-screen challenge: build the structure and sketch its three views');
  t.ok(/block|cube|brick/i.test(o.text) && /sketch|draw/i.test(JSON.stringify(o)), 'the challenge uses real blocks and a pencil sketch');
  const all = JSON.stringify(L).toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered/.test(all), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
}
