/* EX-08 Orient: generator, validator, scorer and shortcut solvers (ARCHITECTURE.md §5, §12; PLAN.md §3, §12).
   Geometry here is written independently of gen.js (Math.atan2 on the stored positions). */
import { deepDiff } from './run.mjs';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';

const CHANCE_MARGIN = 0.10;

// Generation time per item: CPU time (what generation costs; wall time on a shared test machine mostly
// measures its load) and wall time, both as p95 in ms.
function timeP95(fn, n) {
  const cpu = [], wall = [];
  for (let i = 0; i < n; i++) {
    const c0 = process.cpuUsage(), w0 = performance.now();
    fn(i);
    const w1 = performance.now(), c1 = process.cpuUsage(c0);
    wall.push(w1 - w0); cpu.push((c1.user + c1.system) / 1000);
  }
  const p95 = (a) => a.sort((x, y) => x - y)[Math.floor(a.length * 0.95)];
  return { cpu: p95(cpu), wall: p95(wall) };
}
const norm360 = (a) => ((a % 360) + 360) % 360;
const adiff = (a, b) => { const d = norm360(a - b); return d > 180 ? 360 - d : d; };
const bearing = (dx, dy) => Math.atan2(dx, -dy) * 180 / Math.PI; // clockwise from map up, y down
const pct = (x) => (100 * x).toFixed(0) + ' %';

export async function run(t) {
  const PX = t.PX, X = PX.ex, def = X.get('orient');
  t.section('orient: definition');
  if (!t.ok(def, 'orient is defined')) return;
  const L = def.lib;
  t.eq([def.code, def.version, def.abilities, def.cell, def.role, def.answer], ['EX-08', 1, ['PT'], 'extrinsic-dynamic', 'train', 'angle'], 'code, version, abilities, cell, role, answer');
  t.eq(def.dims.map((d) => [d.key, d.levels]), [['shift', ['0–45°', '45–90°', '90–135°', '135–180°']], ['objects', [5, 7, 9]], ['tolerance', [40, 30, 20]]], 'dims: shift bins, objects 5/7/9, tolerance 40/30/20°');
  t.eq(def.variants, null, 'one format');
  const range = X.maxDifficulty(def) - X.minDifficulty(def);
  t.ok(range >= 4, `difficulty range ≥ 4 logits (${range.toFixed(2)})`);
  t.eq([0, 1, 2].map((k) => def.chance({ shift: 0, objects: 0, tolerance: k })), [80 / 360, 60 / 360, 40 / 360], 'chance = 2 × tolerance / 360');
  const g0 = def.chance({ shift: 0, objects: 0, tolerance: 0 }), pB = g0 + (1 - g0 - 0.03) / (1 + Math.exp(X.minDifficulty(def)));
  t.ok(pB > 0.87 && pB < 0.93, `easiest ≈ 90 % for a beginner (${pct(pB)})`);

  t.section('orient: 10 000 items');
  const combos = X.enumerate(def), per = Math.ceil(10000 / combos.length), items = [];
  let thrown = 0, invalid = 0, firstInvalid = null, keyWrong = 0, edgeWrong = 0, overRight = 0, junkRight = 0, notJson = 0, geoBad = 0, firstGeo = null;
  L.stats.fallbacks = 0;
  for (const p of combos) {
    const code = X.paramsCode(def, p);
    for (let s = 0; s < per; s++) {
      const seed = PX.rng.hash('orient-test', code, s);
      let it;
      try { it = def.generate(PX.rng(seed), p); } catch (e) { thrown++; continue; }
      const v = def.validate(it);
      if (v !== true) { invalid++; firstInvalid = firstInvalid || `${X.paramsKey(p)} seed ${seed}: ${v}`; continue; }
      if (deepDiff(JSON.parse(JSON.stringify(it)), it) !== null) notJson++;
      const tol = it.tolerance, k = it.key, sc = def.score(it, k);
      if (!sc.correct || sc.value !== 0) keyWrong++;
      if (!def.score(it, k + 360).correct || !def.score(it, k - 720).correct) keyWrong++; // wrap-around
      if (!def.score(it, k + tol).correct || !def.score(it, k - tol).correct) edgeWrong++;
      for (const off of [tol + 5, -(tol + 5), tol + 0.5, 180]) {
        const r = def.score(it, k + off);
        if (r.correct || Math.abs(r.value - adiff(k + off, k)) > 0.011) overRight++;
      }
      if ([NaN, Infinity, null, undefined, '90', [k]].some((x) => def.score(it, x).correct)) junkRight++;
      // Independent recomputation from the stored positions.
      const A = it.objects[it.at], B = it.objects[it.facing], C = it.objects[it.target];
      const h = bearing(B.x - A.x, B.y - A.y), key = norm360(bearing(C.x - A.x, C.y - A.y) - h);
      const lo = 45 * p.shift, okGeo = adiff(key, k) < 0.02 && Math.abs(h) >= lo - 0.01 && Math.abs(h) <= lo + 45.01
        && adiff(key, 0) >= 20 && adiff(key, 180) >= 20 && new Set([it.at, it.facing, it.target]).size === 3
        && it.objects.every((o, i) => o.x >= 8 && o.x <= 92 && o.y >= 8 && o.y <= 92 && it.objects.every((q, j) => i === j || Math.hypot(o.x - q.x, o.y - q.y) >= 14.8))
        && new Set(it.objects.map((o) => o.id)).size === it.objects.length && new Set(it.objects.map((o) => o.name)).size === it.objects.length
        && it.text.includes(A.name) && it.text.includes(B.name) && it.text.includes(C.name);
      if (!okGeo) { geoBad++; firstGeo = firstGeo || `${X.paramsKey(p)} seed ${seed}`; }
      items.push({ p, seed, it, h, key });
    }
  }
  t.ok(items.length + invalid + thrown >= 10000, `at least 10 000 items over all ${combos.length} combinations (${items.length + invalid + thrown})`);
  t.eq(thrown, 0, 'generate never throws');
  t.ok(invalid === 0, 'validate passes on every item' + (firstInvalid ? ` (${invalid}; first: ${firstInvalid})` : ''));
  t.eq(keyWrong, 0, 'the key scores right with value 0 (also ± 360°)');
  t.eq(edgeWrong, 0, 'key ± tolerance scores right');
  t.eq(overRight, 0, 'key ± (tolerance + 5°), ± (tolerance + 0.5°) and the opposite direction score wrong, value = the error');
  t.eq(junkRight, 0, 'non-numeric responses score wrong');
  t.eq(notJson, 0, 'items survive a JSON round trip unchanged');
  t.ok(geoBad === 0, 'independent geometry agrees: key, shift bin, never collinear, in the map, spaced, distinct, named in the text' + (firstGeo ? ` (first bad: ${firstGeo})` : ''));
  t.ok(L.stats.fallbacks <= items.length / 1000, `fallback construction rarely needed (${L.stats.fallbacks})`);
  // The key is spread over the allowed directions: each 35° sector of [20, 160] ∪ [200, 340] gets about 1/8.
  const sectors = new Array(8).fill(0);
  items.forEach(({ key }) => { const u = key < 180 ? key - 20 : key - 200 + 140; sectors[Math.min(7, Math.floor(u / 35))]++; });
  t.ok(sectors.every((c) => Math.abs(c / items.length - 1 / 8) < 0.02), `answers spread evenly over the allowed directions (${sectors.map((c) => pct(c / items.length)).join(' ')})`);
  const rightTurns = items.filter((x) => x.h > 0).length / items.length;
  t.ok(Math.abs(rightTurns - 0.5) < 0.03, `heading left or right of map up ≈ 50 % (${pct(rightTurns)})`);
  // Where A, B, C land among the objects is random.
  const atFirst = items.filter((x) => x.it.at === 0).length / items.length, meanN = items.reduce((s, x) => s + 1 / x.it.objects.length, 0) / items.length;
  t.ok(Math.abs(atFirst - meanN) < 0.02, 'A is not always the first object');

  // Determinism.
  const fresh = t.context().PX;
  let same = true, sameFresh = true;
  items.filter((_, i) => i % 25 === 0).forEach(({ p, seed, it }) => {
    if (deepDiff(def.generate(PX.rng(seed), p), it) !== null) same = false;
    if (deepDiff(fresh.ex.get('orient').generate(fresh.rng(seed), p), it) !== null) sameFresh = false;
  });
  t.ok(same, 'generation is deterministic (same seed → same item)');
  t.ok(sameFresh, 'generation is deterministic across contexts');
  let robust = true;
  for (const bad of [undefined, {}, { shift: 7, objects: -1, tolerance: 0.5 }]) {
    try { if (def.validate(def.generate(PX.rng(3), bad)) !== true) robust = false; } catch { robust = false; }
  }
  t.ok(robust, 'generate clamps malformed params instead of throwing');
  let fbOk = true, fbFirst = null;
  for (const p of combos) for (let s = 0; s < 4; s++) {
    const v = def.validate(Object.assign(L.fallback(PX.rng(s), L.normParams(p)), { seed: s }));
    if (v !== true) { fbOk = false; fbFirst = fbFirst || `${X.paramsKey(p)}: ${v}`; }
  }
  t.ok(fbOk, 'the fallback construction is valid at every combination' + (fbFirst ? ` (${fbFirst})` : ''));
  L.stats.fallbacks = 0;
  const tm = timeP95((s) => def.generate(PX.rng(7000 + s), { shift: 3, objects: 2, tolerance: 2 }), 500);
  t.ok(tm.cpu < 20, `generation p95 < 20 ms at the hardest level (CPU ${tm.cpu.toFixed(2)} ms, wall ${tm.wall.toFixed(2)} ms)`);

  t.section('orient: validate rejects broken items');
  const base = items.find((x) => x.p.objects === 2).it, clone = (x) => JSON.parse(JSON.stringify(x));
  const rejects = (what, it, pattern) => {
    const v = def.validate(it);
    t.ok(typeof v === 'string' && (!pattern || pattern.test(v)), `validate rejects: ${what}` + (typeof v === 'string' ? (pattern && !pattern.test(v) ? ` (said: ${v})` : '') : ' (it passed)'));
  };
  let m = clone(base); m.key = norm360(m.key + 30); rejects('a key that does not match the map', m, /key/);
  m = clone(base); m.facing = m.at; rejects('A and B the same object', m, /different/);
  m = clone(base); m.objects[3].x = m.objects[4].x + 3; m.objects[3].y = m.objects[4].y; rejects('two objects too close', m, /close/);
  m = clone(base); m.objects[m.target].x = 99; rejects('an object outside the map', m, /outside/);
  m = clone(base); m.objects[1].id = m.objects[0].id; rejects('two objects with the same glyph', m, /glyph/);
  m = clone(base); m.params.shift = (m.params.shift + 2) % 4; rejects('a shift outside its bin', m, /bin/);
  m = clone(base); m.tolerance = 25; rejects('a tolerance that does not match the level', m, /tolerance/);
  { // A hand-made map that is valid except that C is 5° off straight behind (A, B, C nearly collinear).
    const objs = [{ x: 50, y: 50 }, { x: 50, y: 20 }, { x: 52.2, y: 74.9 }, { x: 20, y: 20 }, { x: 80, y: 80 }]
      .map((q, i) => Object.assign({ id: L.GLYPHS[i].id, name: L.GLYPHS[i].name }, q));
    const h = bearing(0, -30), tb = bearing(2.2, 24.9);
    const hand = { ex: 'orient', seed: 1, params: { shift: 0, objects: 0, tolerance: 0 }, key: Math.round(norm360(tb - h) * 100) / 100, tolerance: 40,
      map: { w: 100, h: 100, margin: 8 }, objects: objs, at: 0, facing: 1, target: 2, heading: h, shift: Math.abs(h), targetBearing: Math.round(norm360(tb) * 100) / 100, text: '' };
    rejects('a target 5° from straight behind (A, B, C nearly collinear)', hand, /collinear/);
    const ok = clone(hand), tb2 = bearing(25, 0); // the same map with C moved to the right: valid
    ok.objects[2].x = 75; ok.objects[2].y = 50; ok.key = Math.round(norm360(tb2 - h) * 100) / 100; ok.targetBearing = Math.round(norm360(tb2) * 100) / 100;
    t.eq(def.validate(ok), true, 'the same hand-made map with C to the right of A passes');
  }

  t.section('orient: shortcut solvers');
  // Hit rates under each item's tolerance, per (shift bin, tolerance) cell and pooled.
  const solvers = {
    'egocentric (C as drawn on the map)': ({ it }) => bearing(it.objects[it.target].x - it.objects[it.at].x, it.objects[it.target].y - it.objects[it.at].y),
    'straight ahead': () => 0,
    'straight behind': () => 180,
  };
  const report = [`hardest-level p95 ${tm.cpu.toFixed(2)} ms CPU`];
  for (const [name, fn] of Object.entries(solvers)) {
    let worst = 0, worstCell = '';
    const cells = {};
    for (const x of items) {
      const k = x.p.shift + '/' + x.p.tolerance, c = (cells[k] = cells[k] || { n: 0, hit: 0, chance: def.chance(x.p) });
      c.n++;
      if (def.score(x.it, fn(x)).correct) c.hit++;
    }
    for (const [k, c] of Object.entries(cells)) if (c.hit / c.n - c.chance > worst) { worst = c.hit / c.n - c.chance; worstCell = `${k} ${pct(c.hit / c.n)} vs chance ${pct(c.chance)}`; }
    const pooled = items.filter((x) => def.score(x.it, fn(x)).correct).length / items.length;
    const pooledChance = items.reduce((s, x) => s + def.chance(x.p), 0) / items.length;
    t.ok(worst <= CHANCE_MARGIN, `${name}: ≤ chance + 10 points in every shift × tolerance cell` + (worstCell ? ` (worst: ${worstCell})` : ''));
    const byTol = [0, 1, 2].map((ti) => { const l = items.filter((x) => x.p.tolerance === ti); return pct(l.filter((x) => def.score(x.it, fn(x)).correct).length / l.length); });
    report.push(`${name} ${pct(pooled)} (chance ${pct(pooledChance)}; at tolerance 40/30/20: ${byTol.join(' ')})`);
  }
  // The best single fixed answer (a pointing habit) over the whole pool.
  let bestConst = 0;
  for (let a = 0; a < 360; a += 5) {
    const hit = items.filter((x) => def.score(x.it, a).correct).length / items.length;
    if (hit > bestConst) bestConst = hit;
  }
  const meanChance = items.reduce((s, x) => s + def.chance(x.p), 0) / items.length;
  t.ok(bestConst <= meanChance + CHANCE_MARGIN, `the best fixed answer: ${pct(bestConst)} ≤ chance + 10 (${pct(meanChance)})`);
  report.push(`best fixed answer ${pct(bestConst)}`);
  // Informational: knowing only the side (left or right of the heading) and answering ±90°.
  const side = [0, 1, 2].map((ti) => { const l = items.filter((x) => x.p.tolerance === ti); return pct(l.filter((x) => def.score(x.it, x.key < 180 ? 90 : 270).correct).length / l.length); });
  report.push(`[info] side only, answered ±90°: ${side.join(' ')} at tolerance 40/30/20`);
  checkLearn(t, PX, def, 'orient', (it) => (it.key < 180 ? 'right' : 'left'));
  console.log('       EX-08 orient: ' + items.length + ' items; ' + report.join('; '));
}

/* ---------- learn data (js/ex/orient/learn.js): shape, valid params, demo kinds, captions the view uses ---------- */

// Caption keys the view asks for: string literals that start the first argument of cap(…) or follow
// a ? or : inside it (cap(ok ? 'a' : 'b', …)).
function viewCaptionKeys(id) {
  let src = '';
  try { src = readFileSync(new URL('../../js/ex/' + id + '/view.js', import.meta.url), 'utf8'); } catch (e) { return null; }
  const keys = new Set();
  for (const m of src.matchAll(/\bcap\(([^{})]*)[{)]/g)) for (const k of m[1].matchAll(/(?:^|\?|:)\s*'(\w+)'/g)) keys.add(k[1]);
  return [...keys];
}

function checkLearn(t, PX, def, id, kindOf) {
  t.section(id + ': learn');
  const L = PX.ex.learn(id);
  if (!t.ok(L && typeof L === 'object', 'learn data is registered')) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, 'a one-line goal');
  if (def.variants) t.ok(L.goals && def.variants.every((v) => typeof L.goals[v] === 'string'), 'a goal per variant');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 2 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed) && d.kind), 'demo items with valid params, seeds and kinds');
  t.ok(L.demo.every((d) => PX.ex.difficulty(def, d.params) <= PX.ex.minDifficulty(def) + 0.61), 'demos are at the easiest levels');
  for (const d of L.demo) {
    const item = def.generate(PX.rng(d.seed), d.params);
    t.eq(kindOf(item), d.kind, `demo seed ${d.seed} gives a ${d.kind} item`);
    t.ok(!item.fallback && def.validate(item) === true, `demo seed ${d.seed} is a regular, valid item`);
  }
  t.ok(Array.isArray(L.practice) && L.practice.length >= 3 && L.practice.length <= 5 && L.practice.every(valid), '3–5 practice params');
  t.ok(PX.ex.difficulty(def, L.practice[0]) <= PX.ex.minDifficulty(def) + 1e-9, 'practice starts at the easiest level');
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).every((l) => l >= 0 && l < d.levels.length));
    const varOk = !tr.variant || (def.variants || []).indexOf(tr.variant) >= 0;
    t.ok(tip.id && tip.text && dimOk && varOk && (tr.dim || tr.variant), `tip ${tip.id} has a valid trigger`);
  }
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok((L.strategies || []).every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  t.ok(typeof L.bridge === 'string' && /has not been shown to improve/.test(L.bridge), 'the "where it is used" card carries its limitation line');
  const all = JSON.stringify(L).toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered|genius/.test(all), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
  const keys = viewCaptionKeys(id);
  if (keys) {
    const missing = keys.filter((k) => !(L.captions && typeof L.captions[k] === 'string' && L.captions[k].length));
    t.ok(keys.length > 5 && missing.length === 0, `every caption the view uses exists (${keys.length} keys${missing.length ? '; missing ' + missing.join(', ') : ''})`);
  }
}
