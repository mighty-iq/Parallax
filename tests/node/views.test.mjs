/* EX-07 Views: generator, validator, scorer, shortcut solvers, timing. Run through tests/node/run.mjs.
   N_ITEMS seeds spread over every level and variant (90 combinations); determinism on every 10th. */
import { performance } from 'node:perf_hooks';
import { MANIFEST } from './run.mjs';

// An own context with only the files Views needs, so other exercises' work in progress
// cannot break this test.
const FILES = [...MANIFEST, 'js/ex/views/gen.js', 'js/ex/views/learn.js'];

const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // 112 per combination (the override is for quick local runs)
const CHANCE = 0.25, LIMIT = CHANCE + 0.10;

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
    ['views', 1, 'EX-07', ['Vz'], 'intrinsic-static', 'train', 'choice', 4], 'definition fields');
  t.eq(def.dims.map((d) => [d.key, d.levels.length]), [['cubes', 5], ['grid', 2], ['view', 3]], 'dims: cubes × grid × view');
  t.eq(def.dims[0].levels, [4, 6, 8, 10, 12], 'cubes 4–12 in steps of two');
  t.eq(def.variants, ['toview', 'toobject', 'count'], 'variants');
  const stepSpan = def.dims.reduce((s, d) => s + d.step * (d.levels.length - 1), 0);
  t.ok(stepSpan >= 4, `the dims' steps span at least 4 logits (${stepSpan.toFixed(2)})`);
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4, `difficulty spans at least 4 logits (${(hi - lo).toFixed(2)})`);
  t.ok(pRight(0, lo) >= 0.88 && pRight(0, lo) <= 0.93, `a beginner gets the easiest items about 90 % right (${pRight(0, lo).toFixed(3)})`);
  const d = (variant, cubes, grid, view) => def.difficulty({ cubes, grid, view, variant });
  t.ok(d('toview', 4, 1, 2) > d('toview', 0, 0, 0) && d('toview', 0, 0, 2) > d('toview', 0, 0, 1) && d('toview', 0, 0, 1) > d('toview', 0, 0, 0), 'more cubes, a larger grid and the front or right view are harder');
  t.ok(d('toobject', 2, 0, 0) > d('toview', 2, 0, 0), 'three views to one object is harder than one view');
  t.eq(d('count', 2, 1, 0), d('count', 2, 1, 2), 'the view dim does not change count items');
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
  t.eq(combos.length, 90, '90 combinations (5 × 2 × 3 levels × 3 variants)');
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
      const lo = 4 + p.cubes, hi = 8 + p.cubes, o = it.options;
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
  for (const { p, it } of pool) {
    if (p.variant === 'toview') {
      const T = L.footprint(it.heights), E = it.options.map((o) => L.linesEdges(o.drawing)), lines = E.map((e) => e.split(' ').length);
      add('toview: filled area = top cells', share(it.options.map((o) => -Math.abs(o.drawing.area - T)), it.key, true), true);
      add('toview: like the others', share(sums(4, (i, j) => L.edgeDiff(E[i], E[j])), it.key, false), true);
      add('toview: most lines', share(lines, it.key, true), false);
      add('toview: fewest lines', share(lines, it.key, false), false);
      add('toview: largest drawing', share(it.options.map((o) => o.drawing.w * o.drawing.h), it.key, true), false);
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
      const lo = 4 + p.cubes, hi = 8 + p.cubes, inWin = it.options.map((x) => (x >= lo && x <= hi ? 1 : 0));
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
    const items = pick(variant);
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
  t.ok(L.demo.every((d) => PX.ex.difficulty(def, d.params) <= easiest(d.params.variant) + 0.01), 'demos are at the easiest level of their variant');
  t.eq(L.demo[0].params.variant, 'toview', 'the first demo (the one the player plays) is the main variant');
  for (const d of L.demo) {
    const item = def.generate(PX.rng(d.seed), d.params);
    t.ok(item.variant === d.kind && def.validate(item) === true, `demo seed ${d.seed} gives a valid ${d.kind} item`);
  }
  t.ok(Array.isArray(L.practice) && L.practice.length >= 3 && L.practice.length <= 5 && L.practice.every(valid), '3–5 practice params');
  t.ok(def.variants.every((v) => L.practice.some((p) => p.variant === v)), 'practice tries every variant');
  const ds = L.practice.map((p) => PX.ex.difficulty(def, p));
  t.ok(ds.every((x, i) => i === 0 || x >= ds[i - 1]), `practice goes from easy to harder (${ds.map((x) => x.toFixed(2)).join(', ')})`);
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
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['structure', 'threeViews', 'arrow', 'optionsToview', 'optionsToobject', 'optionsCount', 'look', 'move', 'trace', 'land',
    'whyDirection', 'whyMirror', 'whyNeighbour', 'objIntro', 'objMove', 'objTrace', 'objMatch', 'objWrong', 'objDiffer', 'countIntro', 'countCol', 'countTop', 'countKey'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  t.ok(typeof L.bridge === 'string' && /has not been shown to improve grades or job performance/.test(L.bridge), 'a "where it is used" line with its limitation beside it');
  const o = L.offscreen || {};
  t.ok(o.title && o.text && Array.isArray(o.steps) && o.steps.length >= 3 && o.note, 'an off-screen challenge: build the structure and sketch its three views');
  t.ok(/block|cube|brick/i.test(o.text) && /sketch|draw/i.test(JSON.stringify(o)), 'the challenge uses real blocks and a pencil sketch');
  const all = JSON.stringify(L).toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered/.test(all), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
}
