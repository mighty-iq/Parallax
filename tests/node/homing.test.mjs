/* EX-11 Homing (experimental): generator, validator, scorer and shortcut solvers (ARCHITECTURE.md §5, §12).
   Route geometry here is written independently of gen.js (Math.sin/cos/atan2 on the stored legs and turns). */
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
const rad = (d) => d * Math.PI / 180;
const compass = (e, n) => norm360(Math.atan2(e, n) * 180 / Math.PI);
const pct = (x) => (100 * x).toFixed(0) + ' %';
function walk(h0, legs, turns) {
  let x = 0, y = 0, h = h0;
  const path = [[0, 0]];
  legs.forEach((L, i) => { if (i) h += turns[i - 1]; x += L * Math.sin(rad(h)); y += L * Math.cos(rad(h)); path.push([x, y]); });
  return { path, heading: norm360(h), key: norm360(compass(-x, -y) - h), distance: Math.hypot(x, y) };
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0));
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
}

export async function run(t) {
  const PX = t.PX, X = PX.ex, def = X.get('homing');
  t.section('homing: definition');
  if (!t.ok(def, 'homing is defined')) return;
  const L = def.lib;
  t.eq([def.code, def.version, def.abilities, def.cell, def.role, def.answer, def.perDisplay], ['EX-11', 1, ['NAV'], 'extrinsic-dynamic', 'train', 'angle', true], 'code, version, abilities, cell, role, answer, perDisplay');
  t.ok(def.experimental === true && /experimental/i.test(def.name), 'labelled experimental');
  t.eq(def.dims.map((d) => d.key), ['route', 'landmarks', 'tolerance'], 'dims: route, landmarks, tolerance');
  t.eq([def.dims[1].levels, def.dims[2].levels], [['several', 'one', 'none'], [40, 30, 20]], 'landmarks several/one/none, tolerance 40/30/20°');
  t.eq(L.TURNS.map((b) => [b.lo, b.hi]), [[30, 60], [60, 120], [120, 160]], 'turn sizes small 30–60°, medium 60–120°, large 120–160°');
  t.eq(L.ROUTES.map((r) => `${r.legs}${'sml'[r.turns]}`), ['2m', '3s', '2l', '3m', '4s', '3l', '4m', '4l'], 'route levels: legs × turn size, 2 legs with small turns left out');
  t.eq(def.dims[0].levels.length, L.ROUTES.length, 'one route label per level');
  const dRoute = L.ROUTES.map((_, i) => def.difficulty({ route: i, landmarks: 0, tolerance: 0 }));
  t.ok(dRoute.every((d, i) => !i || d > dRoute[i - 1]), `route levels in order of difficulty (${dRoute.map((d) => d.toFixed(2)).join(' ')})`);
  let modelOk = true;
  for (const p of X.enumerate(def)) {
    const r = L.ROUTES[p.route], want = -2.25 + 0.55 * (r.legs - 2) + 0.4 * r.turns + 0.4 * p.landmarks + 0.9 * p.tolerance;
    if (Math.abs(def.difficulty(p) - want) > 1e-9) modelOk = false;
  }
  t.ok(modelOk, 'difficulty keeps the per-dimension model for every combination (−2.25 + 0.55/leg + 0.4/turn size + 0.4/landmark level + 0.9/tolerance level)');
  t.ok(def.customDifficulty && Math.abs(def.base - def.difficulty({ route: 0, landmarks: 0, tolerance: 0 })) < 1e-12, 'base is the difficulty at every dim level 0');
  const range = X.maxDifficulty(def) - X.minDifficulty(def);
  t.ok(range >= 4, `difficulty range ≥ 4 logits (${range.toFixed(2)})`);
  t.eq([0, 1, 2].map((k) => def.chance({ route: 0, landmarks: 0, tolerance: k })), [80 / 360, 60 / 360, 40 / 360], 'chance = 2 × tolerance / 360');
  const g0 = def.chance({ tolerance: 0 }), pB = g0 + (1 - g0 - 0.03) / (1 + Math.exp(X.minDifficulty(def)));
  t.ok(pB > 0.85 && pB < 0.93, `easiest ≈ 87–90 % for a beginner (${pct(pB)})`);
  t.ok(typeof def.estMs === 'function' && X.enumerate(def).every((p) => Number.isFinite(def.estMs(p)) && def.estMs(p) > 5000), 'estMs(params) gives a time for every combination');

  t.section('homing: 10 000 items');
  const combos = X.enumerate(def), per = Math.ceil(10000 / combos.length), items = [];
  let thrown = 0, invalid = 0, firstInvalid = null, keyWrong = 0, edgeWrong = 0, overRight = 0, junkRight = 0, notJson = 0, geoBad = 0, firstGeo = null;
  L.stats.fallbacks = L.stats.builds = L.stats.onTarget = L.stats.full = 0;
  for (const p of combos) {
    const code = X.paramsCode(def, p);
    for (let s = 0; s < per; s++) {
      const seed = PX.rng.hash('homing-test', code, s);
      let it;
      try { it = def.generate(PX.rng(seed), p); } catch (e) { thrown++; continue; }
      const v = def.validate(it);
      if (v !== true) { invalid++; firstInvalid = firstInvalid || `${X.paramsKey(p)} seed ${seed}: ${v}`; continue; }
      if (deepDiff(JSON.parse(JSON.stringify(it)), it) !== null) notJson++;
      const tol = it.tolerance, k = it.key, sc = def.score(it, k);
      if (!sc.correct || sc.value !== 0 || !def.score(it, k + 360).correct) keyWrong++;
      if (!def.score(it, k + tol).correct || !def.score(it, k - tol).correct) edgeWrong++;
      for (const off of [tol + 5, -(tol + 5), tol + 0.5, 180]) {
        const r = def.score(it, k + off);
        if (r.correct || Math.abs(r.value - adiff(k + off, k)) > 0.011) overRight++;
      }
      if ([NaN, null, undefined, '120', {}].some((x) => def.score(it, x).correct)) junkRight++;
      // Independent geometry from the stored route.
      const rt = L.ROUTES[p.route], w = walk(it.startHeading, it.legs, it.turns), n = it.legs.length, band = L.TURNS[rt.turns];
      const ok = adiff(w.key, k) < 0.02 && Math.abs(w.distance - it.distance) < 0.002 && adiff(w.heading, it.heading) < 0.02
        && w.path.every((q, i) => Math.hypot(q[0] - it.path[i][0], q[1] - it.path[i][1]) < 0.003)
        && adiff(w.key, 0) >= 20 && adiff(w.key, 180) >= 20 && w.distance >= 5
        && w.path.slice(1, -1).every((q, i) => segDist([0, 0], q, w.path[i + 2]) >= 3 - 1e-6)
        && n === rt.legs && it.legs.every((l) => l >= 6 && l <= 18) && it.turns.length === n - 1
        && it.turns.every((x) => Math.abs(x) >= band.lo && Math.abs(x) <= band.hi)
        && it.landmarks.length === [3, 1, 0][p.landmarks] && new Set(it.landmarks.map((m) => m.id)).size === it.landmarks.length
        && it.landmarks.every((m, i) => m.dist >= 200 && it.landmarks.every((o, j) => i === j || adiff(m.bearing, o.bearing) >= 59.9))
        && Math.abs(it.duration - (it.legs.reduce((s2, l) => s2 + l, 0) / it.speed + it.turns.reduce((s2, x) => s2 + Math.abs(x), 0) / it.turnRate)) < 0.011
        && it.experimental === true;
      if (!ok) { geoBad++; firstGeo = firstGeo || `${X.paramsKey(p)} seed ${seed}`; }
      items.push({ p, seed, it, w });
    }
  }
  t.ok(items.length + invalid + thrown >= 10000, `at least 10 000 items over all ${combos.length} combinations (${items.length + invalid + thrown})`);
  t.eq(thrown, 0, 'generate never throws');
  t.ok(invalid === 0, 'validate passes on every item' + (firstInvalid ? ` (${invalid}; first: ${firstInvalid})` : ''));
  t.eq(keyWrong, 0, 'the key scores right with value 0 (also + 360°)');
  t.eq(edgeWrong, 0, 'key ± tolerance scores right');
  t.eq(overRight, 0, 'key ± (tolerance + 5°), ± (tolerance + 0.5°) and the opposite direction score wrong, value = the error');
  t.eq(junkRight, 0, 'non-numeric responses score wrong');
  t.eq(notJson, 0, 'items survive a JSON round trip unchanged');
  t.ok(geoBad === 0, 'independent geometry agrees: path, key, distance, heading; never near ahead/behind; never near the start before the end; legs, turns, landmarks, duration' + (firstGeo ? ` (first bad: ${firstGeo})` : ''));
  t.ok(L.stats.fallbacks <= items.length / 1000, `fallback construction rarely needed (${L.stats.fallbacks})`);
  const rightFirst = items.filter((x) => x.it.turns[0] > 0).length / items.length;
  t.ok(Math.abs(rightFirst - 0.5) < 0.03, `first turn to the right ≈ 50 % (${pct(rightFirst)})`);

  const fresh = t.context().PX;
  let same = true, sameFresh = true;
  items.filter((_, i) => i % 25 === 0).forEach(({ p, seed, it }) => {
    if (deepDiff(def.generate(PX.rng(seed), p), it) !== null) same = false;
    if (deepDiff(fresh.ex.get('homing').generate(fresh.rng(seed), p), it) !== null) sameFresh = false;
  });
  t.ok(same, 'generation is deterministic (same seed → same item)');
  t.ok(sameFresh, 'generation is deterministic across contexts');
  let robust = true;
  for (const bad of [undefined, {}, { route: 99, landmarks: 'x', tolerance: 1.5 }, { legs: 2, turns: 0 }]) {
    try { if (def.validate(def.generate(PX.rng(4), bad)) !== true) robust = false; } catch { robust = false; }
  }
  t.ok(robust, 'generate clamps malformed params instead of throwing');
  let fbOk = true, fbFirst = null;
  for (const p of combos) for (let s = 0; s < 3; s++) {
    const v = def.validate(Object.assign(L.fallback(PX.rng(s), L.normParams(p)), { seed: s }));
    if (v !== true) { fbOk = false; fbFirst = fbFirst || `${X.paramsKey(p)}: ${v}`; }
  }
  t.ok(fbOk, 'the fallback construction is valid at every combination' + (fbFirst ? ` (${fbFirst})` : ''));
  L.stats.fallbacks = 0;
  const tm = timeP95((s) => def.generate(PX.rng(5000 + s), { route: L.ROUTES.length - 1, landmarks: 2, tolerance: 2 }), 500);
  t.ok(tm.cpu < 20, `generation p95 < 20 ms at the hardest level (CPU ${tm.cpu.toFixed(2)} ms, wall ${tm.wall.toFixed(2)} ms)`);
  const hardTiming = tm;

  t.section('homing: validate rejects broken items');
  const clone = (x) => JSON.parse(JSON.stringify(x)), base = items.find((x) => L.ROUTES[x.p.route].legs === 3 && x.p.landmarks === 0).it;
  const rejects = (what, it, pattern) => {
    const v = def.validate(it);
    t.ok(typeof v === 'string' && (!pattern || pattern.test(v)), `validate rejects: ${what}` + (typeof v === 'string' ? (pattern && !pattern.test(v) ? ` (said: ${v})` : '') : ' (it passed)'));
  };
  let m = clone(base); m.key = norm360(m.key + 45); rejects('a key that does not match the route', m, /key/);
  m = clone(base); m.legs[1] = 3; rejects('a leg too short to see', m, /short/);
  m = clone(base); m.turns[0] = m.turns[0] > 0 ? 170 : -170; rejects('a turn outside its band', m, /band/);
  m = clone(base); m.path[2][0] += 1; rejects('a path that does not follow from the legs and turns', m, /path/);
  m = clone(base); m.landmarks.pop(); rejects('the wrong number of landmarks', m, /landmark/);
  { // Hand-made routes that break one rule each (2 legs, large turns, tolerance 20°).
    const mk = (h0, legs, turns) => {
      const w = walk(h0, legs, turns), r2 = (x) => Math.round(x * 100) / 100;
      const route = L.ROUTES.findIndex((r) => r.legs === legs.length && r.turns === 2);
      return { ex: 'homing', seed: 1, params: { route, landmarks: 2, tolerance: 2 }, key: r2(w.key) % 360, tolerance: 20, experimental: true,
        startHeading: h0, legs, turns, path: w.path.map((q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000]),
        heading: r2(w.heading) % 360, distance: Math.round(w.distance * 1000) / 1000, returnBearing: r2(compass(-w.path.at(-1)[0], -w.path.at(-1)[1])) % 360,
        speed: 3, turnRate: 60, duration: 0, landmarks: [] };
    };
    t.eq(def.validate(mk(0, [12, 10], [130])), true, 'a hand-made 2-leg route passes');
    // Leg 2 passes 2 m from the start (6 m out, then a 160° turn); the end is 6 m away, start at 121°.
    rejects('a route that passes within 3 m of the start before the end', mk(0, [6, 14, 10], [160, 130]), /passes within/);
    // A short first leg and a long second one: the start ends up 18.7° from straight behind.
    rejects('a start within 20° of straight behind', mk(0, [6, 18], [125]), /behind/);
  }

  t.section('homing: shortcut solvers');
  const cellKey = (p) => `${p.route}/${p.tolerance}`, cellName = (k) => { const [r, o] = k.split('/').map(Number); return `${L.ROUTES[r].legs}${'sml'[L.ROUTES[r].turns]}@${[40, 30, 20][o]}°`; };
  const solvers = {
    'turn around (180°)': (it) => 180,
    'sum of the turns reversed (180° − Σ turns)': (it) => norm360(180 - it.turns.reduce((s2, x) => s2 + x, 0)),
  };
  const report = [`hardest-level p95 ${hardTiming.cpu.toFixed(2)} ms CPU`], degenerate = new Set(L.DEGENERATE.map(cellKey));
  t.eq([...degenerate], [], 'no route × tolerance cell is degenerate (2 legs with small turns is not a route level)');
  // Why that combination is left out, checked by brute force: no valid 2-leg route with a 30–60° turn
  // beats both shortcuts at 30° tolerance.
  const rr = PX.rng(77);
  let clean = 0;
  for (let i = 0; i < 20000; i++) {
    const t1 = (rr.chance(0.5) ? 1 : -1) * rr.float(30, 60), w = walk(rr.float(0, 360), [rr.float(6, 18), rr.float(6, 18)], [t1]);
    if (adiff(w.key, 0) < 20 || adiff(w.key, 180) < 20) continue;
    if (adiff(w.key, 180) > 30 && adiff(w.key, norm360(180 - t1)) > 30) clean++;
  }
  t.eq(clean, 0, 'brute force: 2 legs with a 30–60° turn can never beat both shortcuts at 30° (why it is no route level)');
  for (const [name, fn] of Object.entries(solvers)) {
    const cells = {};
    for (const x of items) {
      const c = (cells[cellKey(x.p)] = cells[cellKey(x.p)] || { n: 0, hit: 0, chance: def.chance(x.p) });
      c.n++;
      if (def.score(x.it, fn(x.it)).correct) c.hit++;
    }
    let worst = -1, worstCell = '';
    const degen = [];
    for (const [k, c] of Object.entries(cells)) {
      if (degenerate.has(k)) { degen.push(`${cellName(k)} ${pct(c.hit / c.n)}`); continue; }
      if (c.hit / c.n - c.chance > worst) { worst = c.hit / c.n - c.chance; worstCell = `${cellName(k)} ${pct(c.hit / c.n)} vs chance ${pct(c.chance)}`; }
    }
    t.ok(worst <= CHANCE_MARGIN, `${name}: ≤ chance + 10 points in every route × tolerance cell (worst: ${worstCell})`);
    const byTol = [0, 1, 2].map((ti) => {
      const l = items.filter((x) => x.p.tolerance === ti), hit = l.filter((x) => def.score(x.it, fn(x.it)).correct).length / l.length;
      t.ok(hit <= def.chance({ tolerance: ti }) + CHANCE_MARGIN, `${name}: pooled over all cells at tolerance ${[40, 30, 20][ti]}° ≤ chance + 10 (${pct(hit)})`);
      return pct(hit);
    });
    report.push(`${name}: ${byTol.join(' ')} at tolerance 40/30/20, worst cell ${worstCell}` + (degen.length ? ` (degenerate: ${degen.join(', ')})` : ''));
  }
  // A habitual turn (one fixed answer). Where geometry lets answers spread (3–4 legs, medium or large
  // turns) it must stay near chance; elsewhere it is reported: after short, nearly straight walks the
  // start is behind, 120–160° to either side (accepted at these easy levels: the side must be worked out).
  const bestFixed = (list) => {
    let b = 0, at = 0;
    for (let a = 0; a < 360; a += 5) { const h = list.filter((x) => def.score(x.it, a).correct).length / list.length; if (h > b) { b = h; at = a; } }
    return [b, at];
  };
  // Cross-validated: the answer is chosen on one half of the items and scored on the other (2-fold), so
  // picking the best of 72 answers on the same sample does not inflate it.
  const cvFixed = (list) => {
    const A = list.filter((_, i) => i % 2 === 0), B = list.filter((_, i) => i % 2 === 1), hit = (l, a) => l.filter((x) => def.score(x.it, a).correct).length;
    return (hit(B, bestFixed(A)[1]) + hit(A, bestFixed(B)[1])) / list.length;
  };
  const spreads = (x) => L.ROUTES[x.p.route].legs >= 3 && L.ROUTES[x.p.route].turns >= 1, cvs = [];
  for (const ti of [0, 1, 2]) {
    const list = items.filter((x) => x.p.tolerance === ti && spreads(x)), cv = cvFixed(list), [b, at] = bestFixed(list);
    t.ok(cv <= def.chance({ tolerance: ti }) + CHANCE_MARGIN, `best fixed answer, 3–4 legs with medium/large turns, tolerance ${[40, 30, 20][ti]}°: ≤ chance + 10 (${pct(cv)} cross-validated; ${pct(b)} at ${at}° in-sample)`);
    cvs.push(pct(cv));
  }
  report.push(`best fixed answer where answers can spread (3–4 legs, medium/large turns): ${cvs.join(' ')} at tolerance 40/30/20 (cross-validated)`);
  const pooledFixed = [0, 1, 2].map((ti) => { const [b, at] = bestFixed(items.filter((x) => x.p.tolerance === ti)); return `${pct(b)} at ${at}°`; });
  const byRoute = L.ROUTES.map((_, ri) => pct(bestFixed(items.filter((x) => x.p.route === ri && x.p.tolerance === 0))[0]));
  report.push(`[info] best fixed answer, all cells: ${pooledFixed.join(', ')} at tolerance 40/30/20 (chance 22/17/11 %); by route at 40°: ${byRoute.join(' ')}`);
  report.push(`answers on their target ${pct(L.stats.onTarget / Math.max(1, L.stats.builds))}`);
  // Informational: path integration from the turns alone (legs taken as equal), by turn size.
  const eqHit = [0, 1, 2].map((ti) => {
    const l = items.filter((x) => L.ROUTES[x.p.route].turns === ti);
    return pct(l.filter((x) => def.score(x.it, walk(x.it.startHeading, x.it.legs.map(() => 1), x.it.turns).key).correct).length / l.length);
  });
  report.push(`[info] turns only, legs taken as equal: ${eqHit.join(' ')} for small/medium/large turns`);
  // estMs: within 10 % of the mean trial time of the generated routes (lead-in + route + response).
  const estOk = L.ROUTES.map((_, ri) => {
    const l = items.filter((x) => x.p.route === ri), mean = L.LEAD_MS + L.RESPONSE_MS + 1000 * l.reduce((s2, x) => s2 + x.it.duration, 0) / l.length;
    return [def.estMs({ route: ri, landmarks: 0, tolerance: 0 }), mean];
  });
  t.ok(estOk.every(([e, m]) => Math.abs(e / m - 1) <= 0.10), `estMs within 10 % of the mean trial time on every route (${estOk.map(([e, m]) => (e / 1000).toFixed(1) + '/' + (m / 1000).toFixed(1) + ' s').join(', ')})`);
  report.push(`estMs by route ${estOk.map(([e]) => (e / 1000).toFixed(1)).join('/')} s`);
  checkLearn(t, PX, def, 'homing', (it) => (it.key < 180 ? 'right' : 'left'));
  console.log('       EX-11 homing: ' + items.length + ' items; ' + report.join('; '));
}

/* ---------- learn data (js/ex/homing/learn.js): shape, valid params, demo kinds, captions the view uses ---------- */

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
  t.ok(typeof L.bridge === 'string' && /improves this task; whether it helps real wayfinding has not been studied/.test(L.bridge), 'the "where it is used" card carries its limitation line');
  const all = JSON.stringify(L).toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered|genius/.test(all), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
  const keys = viewCaptionKeys(id);
  if (keys) {
    const missing = keys.filter((k) => !(L.captions && typeof L.captions[k] === 'string' && L.captions[k].length));
    t.ok(keys.length > 5 && missing.length === 0, `every caption the view uses exists (${keys.length} keys${missing.length ? '; missing ' + missing.join(', ') : ''})`);
  }
}
