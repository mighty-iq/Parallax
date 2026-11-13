/* EX-11 Homing (experimental): generator, validator, scorer and shortcut solvers (ARCHITECTURE.md §5, §12).
   Route geometry here is written independently of gen.js (Math.sin/cos/atan2 on the stored legs and turns).
   Shortcut bounds (RV-reckon-homing B1, the lead's decision (a), 13 Nov 2026): the answers that need no
   integration (a fixed angle or place, turn around, the mirror, the turns reversed, heading not updated)
   stay within chance + 10 points in every route/tolerance cell; a fixed answer is exempt only where R1's
   item rules leave no room (EXEMPT_FIXED). Turn-only answers (the legs taken as equal, the net-turn prior)
   are printed per cell as information, not bounded: they integrate every turn, which is partial path
   integration, and on 2-leg and small-turn routes the start always lies on the side of the net turn. */
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
// Duration of a route with raised-cosine ramps (independent closed form): every leg takes L / v + ramp,
// every turn |t| / ω + ramp (a ramp of r seconds covers rate × r / 2).
function closedDuration(it) {
  return it.legs.reduce((s, l) => s + l / it.speed + it.ramp, 0) + it.turns.reduce((s, x) => s + Math.abs(x) / it.turnRate + it.ramp, 0);
}
// Simpson's rule over a rate function on [0, T] (n even).
function simpson(f, T, n = 200) {
  const h = T / n;
  let s = f(0) + f(T);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(i * h);
  return s * h / 3;
}

export async function run(t) {
  const PX = t.PX, X = PX.ex, def = X.get('homing');
  t.section('homing: definition');
  if (!t.ok(def, 'homing is defined')) return;
  const L = def.lib;
  t.eq([def.code, def.version, def.abilities, def.cell, def.role, def.answer, def.perDisplay], ['EX-11', 2, ['NAV'], 'extrinsic-dynamic', 'train', 'angle', true], 'code, version (2: v1.1 motion and legs), abilities, cell, role, answer, perDisplay');
  t.eq([L.SPEED, L.TURN_RATE, L.RAMP, L.LEG, L.PATH], [1.8, 45, 0.4, [4, 12], [12, 28]], 'v1.1 motion: 1.8 m/s, 45°/s, 0.4 s ramps; legs 4–12 m, routes 12–28 m');
  t.ok(L.SPEED <= 2 && L.TURN_RATE <= 45 && L.V_MAX === 2 && L.W_MAX === 45, 'comfort limits: ≤ 2 m/s and ≤ 45°/s (R1 §7.2)');
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
        && n === rt.legs && it.legs.every((l) => l >= 4 && l <= 12) && it.turns.length === n - 1
        && it.pathLength >= 12 - 1e-9 && it.pathLength <= 28 + 1e-9 && Math.abs(it.pathLength - it.legs.reduce((s2, l) => s2 + l, 0)) < 0.006
        && it.turns.every((x) => Math.abs(x) >= band.lo && Math.abs(x) <= band.hi)
        && it.landmarks.length === [3, 1, 0][p.landmarks] && new Set(it.landmarks.map((m) => m.id)).size === it.landmarks.length
        && it.landmarks.every((m, i) => m.dist >= 200 && it.landmarks.every((o, j) => i === j || adiff(m.bearing, o.bearing) >= 59.9))
        && Math.abs(it.duration - closedDuration(it)) < 0.011
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
  m = clone(base); m.speed = 2.4; m.duration = Math.round(closedDuration(m) * 100) / 100; rejects('a walk faster than 2 m/s', m, /limits/);
  m = clone(base); m.turnRate = 60; m.duration = Math.round(closedDuration(m) * 100) / 100; rejects('a turn faster than 45°/s', m, /limits/);
  m = clone(base); m.duration += 1; rejects('a duration that does not match the motion', m, /duration/);
  m = clone(base); m.pathLength += 1; rejects('a pathLength that does not match the legs', m, /pathLength/);
  { // Hand-made routes that break one rule each (large turns, tolerance 20°).
    const mk = (h0, legs, turns) => {
      const w = walk(h0, legs, turns), r2 = (x) => Math.round(x * 100) / 100;
      const route = L.ROUTES.findIndex((r) => r.legs === legs.length && r.turns === 2);
      const it = { ex: 'homing', seed: 1, params: { route, landmarks: 2, tolerance: 2 }, key: r2(w.key) % 360, tolerance: 20, experimental: true,
        startHeading: h0, legs, turns, path: w.path.map((q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000]),
        heading: r2(w.heading) % 360, distance: Math.round(w.distance * 1000) / 1000, returnBearing: r2(compass(-w.path.at(-1)[0], -w.path.at(-1)[1])) % 360,
        pathLength: legs.reduce((a, b) => a + b, 0), speed: 1.8, turnRate: 45, ramp: 0.4, duration: 0, landmarks: [] };
      it.duration = Math.round(closedDuration(it) * 100) / 100;
      return it;
    };
    t.eq(def.validate(mk(0, [12, 10], [130])), true, 'a hand-made 2-leg route passes');
    // Leg 2 passes 2.05 m from the start (6 m out, then a 160° turn); the end is 5.9 m away.
    rejects('a route that passes within 3 m of the start before the end', mk(0, [6, 10, 10], [160, 125]), /passes within/);
    // A short first leg and a long second one: the start ends up 18.7° from straight behind.
    rejects('a start within 20° of straight behind', mk(0, [4, 12], [125]), /behind/);
    rejects('a route longer than 28 m', mk(0, [12, 10, 9], [130, 130]), /longer than/);
  }

  t.section('homing: motion (raised-cosine ramps)');
  { // Each leg and turn, integrated numerically from the rate (Simpson), covers its length or angle; rates
    // stay within the comfort limits; poses join up at segment ends and the walk ends on the route's end.
    let covered = true, limits = true, joins = true, ends = true, ramps = true, firstBad = null;
    items.filter((_, i) => i % 40 === 0).forEach(({ it }) => {
      const pl = L.plan(it, 1), n = it.legs.length;
      let w = 0, k = 0;
      pl.segs.forEach((s, si) => {
        if (s.kind === 'stand') return;
        const want = s.kind === 'walk' ? it.legs[w++] : Math.abs(it.turns[k++]), lim = s.kind === 'walk' ? 2 : 45;
        let off = 0;
        const rate = (tt) => { let acc = 0; for (const p of s.pieces) { if (tt <= acc + p.dur) return L.rateAt(p, tt - acc); acc += p.dur; } return 0; };
        s.pieces.forEach((p) => { off += simpson((tt) => L.rateAt(p, tt), p.dur); });
        if (Math.abs(off - want) > 1e-6 * Math.max(1, want)) { covered = false; firstBad = firstBad || `seg ${si}: ${off} vs ${want}`; }
        for (let tt = 0; tt <= s.dur; tt += s.dur / 50) if (rate(tt) > lim + 1e-9) limits = false;
        if (rate(0) > 1e-9 || rate(s.dur) > 1e-6) ramps = false; // every start and stop is smooth
      });
      let tAcc = 0;
      pl.segs.forEach((s, si) => {
        tAcc += s.dur;
        const a = L.poseAt(pl, tAcc - 1e-9), b = L.poseAt(pl, tAcc + 1e-9);
        if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-4 || adiff(a.h, b.h) > 1e-4) joins = false;
      });
      const e = L.poseAt(pl, pl.total + 5), E = it.path[n];
      if (Math.hypot(e.x - E[0], e.y - E[1]) > 0.003 || adiff(e.h, it.heading) > 0.02) ends = false;
      if (Math.abs(pl.motion - it.duration) > 0.006 || Math.abs(pl.total - pl.motion - 1) > 1e-9) ends = false;
    });
    t.ok(covered, 'every leg and turn covers its length or angle (Simpson over the rate)' + (firstBad ? ` (${firstBad})` : ''));
    t.ok(limits, 'rates stay ≤ 2 m/s and ≤ 45°/s throughout');
    t.ok(ramps, 'every leg and turn starts and stops at rate 0 (no instant starts)');
    t.ok(joins, 'poses join up at every segment boundary (no jumps)');
    t.ok(ends, 'the walk ends on the route\'s end and final heading; plan duration = item duration (+ the stand)');
    const longest = Math.max(...items.map((x) => x.it.duration));
    t.ok(longest <= 30, `the longest route moves for at most 30 s (${longest.toFixed(1)} s)`);
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
  // Shortcuts per cell (RV B1, decision (a)): the no-integration answers are bounded at chance + 10 in every
  // cell (a fixed angle except in EXEMPT_FIXED); the turn-only family is printed as information.
  // the spread cells (3–4 legs, medium or large turns) sit a few points under the bound for a fixed angle (29 %
  // floor at 40°): 2 000 more items each, as a CV estimate from ~420 items moves by about 2 points
  const extra = [];
  for (const route of [3, 5, 6, 7]) for (let tol = 0; tol < 3; tol++) for (let k = 0; k < 2000; k++) {
    const p = { route, landmarks: k % 3, tolerance: tol };
    extra.push({ p, it: def.generate(PX.rng(PX.rng.hash('homing-shortcuts', route, tol, k)), p) });
  }
  const scRows = shortcutReport(def, items.concat(extra), 'Homing');
  boundShortcuts(t, scRows);
  // estMs: within 10 % of the mean trial time of the generated routes (lead-in + route + response).
  const estOk = L.ROUTES.map((_, ri) => {
    const l = items.filter((x) => x.p.route === ri), mean = L.LEAD_MS + L.RESPONSE_MS + 1000 * l.reduce((s2, x) => s2 + x.it.duration, 0) / l.length;
    return [def.estMs({ route: ri, landmarks: 0, tolerance: 0 }), mean];
  });
  t.ok(estOk.every(([e, m]) => Math.abs(e / m - 1) <= 0.10), `estMs within 10 % of the mean trial time on every route (${estOk.map(([e, m]) => (e / 1000).toFixed(1) + '/' + (m / 1000).toFixed(1) + ' s').join(', ')})`);
  report.push(`estMs by route ${estOk.map(([e]) => (e / 1000).toFixed(1)).join('/')} s`);
  checkLearn(t, PX, def, 'homing', (it) => (it.key < 180 ? 'right' : 'left'));
  { // The first-person kit in homing/view.js asks for its captions through kc('…') (Homing's and Reckon's).
    const kitSrc = readFileSync(new URL('../../js/ex/homing/view.js', import.meta.url), 'utf8');
    const kitKeys = [...new Set([...kitSrc.matchAll(/\bkc\('(\w+)'/g)].map((mm) => mm[1]))];
    const hl = PX.ex.learn('homing'), miss = kitKeys.filter((k) => !(hl && hl.captions && typeof hl.captions[k] === 'string'));
    t.ok(kitKeys.length > 10 && miss.length === 0, `every caption the view kit asks for exists (${kitKeys.length} keys${miss.length ? '; missing ' + miss.join(', ') : ''})`);
    t.ok(!/larger screen/i.test(JSON.stringify(hl)) && !/smallScreen|larger screen/.test(kitSrc), 'no "larger screen" notice left (v1.1 brief)');
  }
  console.log('       EX-11 homing: ' + items.length + ' items; ' + report.join('; '));
}

/* ---------- learn data (js/ex/homing/learn.js): shape, valid params, demo kinds, captions the view uses ---------- */

// Caption keys the view asks for: string literals that start the first argument of cap(…) or follow
// a ? or : inside it (cap(ok ? 'a' : 'b', …)).
// Shortcuts per route × tolerance cell (RV-reckon-homing B1; the lead's decision (a), 13 Nov). Bounded at
// chance + 10 points: the answers that need no integration at all (a fixed angle or place, turn around, the
// mirror, the turns reversed, heading not updated). Reported as information: the turn-only family (equal
// legs, the net-turn prior, the last turn): it integrates every turn, which is partial path integration, and on
// 2-leg and small-turn routes the start always lies on the side of the net turn, so no generator can hold it
// down there. Return items also report "true direction + average distance" (it needs the direction solved).
// Reviewer's definitions; fitted constants cross-validated in two folds. items: [{ p: { route, tolerance,
// variant? }, it }]. Returns { rows, bounded, exemptFixed } and prints the tables.
// exemptFixed: the cells where R1's item rules (reversed, heading not updated and mirror always miss, keys
// 20° off the axis) leave no room to spread the answer past chance + 10 for one fixed angle: minimax over
// route pools (B3's progress notes): routes 0, 1, 4 at every tolerance, route 2 at 40° and 30°.
export const EXEMPT_FIXED = ['0/0', '0/1', '0/2', '1/0', '1/1', '1/2', '4/0', '4/1', '4/2', '2/0', '2/1'];
export function shortcutReport(def, items, label) {
  const sgn = (x) => (x >= 0 ? 1 : -1), sum = (a) => a.reduce((x, y) => x + y, 0);
  const at = (a, r) => ({ x: r * Math.sin(rad(a)), z: r * Math.cos(rad(a)) });
  const eqKey = (it, len) => walk(it.startHeading, it.legs.map(() => len || 1), it.turns);
  const cvBest = (list, cand, hit) => {
    const A = list.filter((_, i) => i % 2 === 0), B = list.filter((_, i) => i % 2 === 1);
    const best = (l) => { let b = -1, bc = cand[0]; for (const c of cand) { let h = 0; for (const y of l) if (hit(y, c)) h++; if (h > b) { b = h; bc = c; } } return bc; };
    const ca = best(A), cb = best(B);
    let h = 0; for (const y of B) if (hit(y, ca)) h++; for (const y of A) if (hit(y, cb)) h++;
    return h / list.length;
  };
  const cells = new Map();
  for (const x of items) { const k = `${x.p.variant || 'point'}/${x.p.route}/${x.p.tolerance}`; (cells.get(k) || cells.set(k, []).get(k)).push(x); }
  const rows = [];
  for (const [k, list] of cells) {
    const [variant] = k.split('/'), ch = def.chance(list[0].p), ret = variant === 'return';
    const hitA = (x, a) => def.score(x.it, ret ? at(a, x.it.distance) : norm360(a)).correct;
    const hitP = (x, q) => def.score(x.it, q).correct;
    const keyOf = (it) => (ret ? it.keyDeg : it.key), T = (it) => sum(it.turns), Tl = (it) => it.turns.at(-1);
    const rate = (f) => list.filter(f).length / list.length;
    const meanD = sum(list.map((x) => x.it.distance)) / list.length;
    const B = {}, I = {};
    if (!ret) {
      B['fixed angle'] = cvBest(list, Array.from({ length: 72 }, (_, i) => i * 5), (x, a) => hitA(x, a));
      B['turn around'] = rate((x) => hitA(x, 180));
      B['mirror'] = rate((x) => hitA(x, 360 - keyOf(x.it)));
      B['turns reversed'] = rate((x) => hitA(x, 180 - T(x.it)));
      B['heading not updated'] = rate((x) => hitA(x, keyOf(x.it) + T(x.it)));
      I['equal legs'] = rate((x) => hitA(x, eqKey(x.it).key));
      I['180 − ΣT/2'] = rate((x) => hitA(x, 180 - T(x.it) / 2));
      I['net-turn prior'] = cvBest(list, Array.from({ length: 37 }, (_, i) => i * 5), (x, A) => hitA(x, 180 - sgn(T(x.it)) * A));
      I['back along the leg before the last turn'] = rate((x) => hitA(x, 180 - Tl(x.it)));
    } else {
      const grid = [], sgrid = [];
      for (let a = 0; a < 360; a += 10) for (let r = 3; r <= 20; r += 1) grid.push([a, r]);
      for (let A = 0; A <= 180; A += 10) for (let r = 3; r <= 20; r += 1) sgrid.push([A, r]);
      B['fixed place'] = cvBest(list, grid, (x, g) => hitP(x, at(g[0], g[1])));
      B['turn around, average distance'] = rate((x) => hitP(x, at(180, meanD)));
      B['turn around, last leg'] = rate((x) => hitP(x, at(180, x.it.legs.at(-1))));
      B['mirror'] = rate((x) => hitP(x, at(360 - keyOf(x.it), x.it.distance)));
      B['turns reversed'] = rate((x) => hitP(x, at(180 - T(x.it), x.it.distance)));
      B['heading not updated'] = rate((x) => hitP(x, at(keyOf(x.it) + T(x.it), x.it.distance)));
      I['equal legs'] = rate((x) => { const n = x.it.legs.length, e = eqKey(x.it, x.it.pathLength / n); return hitP(x, at(e.key, e.distance)); });
      I['net-turn prior'] = cvBest(list, sgrid, (x, g) => hitP(x, at(180 - sgn(T(x.it)) * g[0], g[1])));
      I['true direction + average distance'] = rate((x) => hitP(x, at(keyOf(x.it), meanD)));
    }
    rows.push({ cell: k, rt: k.split('/').slice(1).join('/'), n: list.length, chance: ch, B, I });
  }
  rows.sort((a, b) => a.cell.localeCompare(b.cell, 'en', { numeric: true }));
  const lines = [`       ${label}: shortcuts per route/tolerance cell (bounded at chance + 10 points; n per cell ${Math.min(...rows.map((r) => r.n))}–${Math.max(...rows.map((r) => r.n))})`];
  const mat = (rv, f) => [0, 1, 2].map((ti) => rv.filter((r) => r.cell.endsWith('/' + ti)).map((r) => String(Math.round(100 * f(r))).padStart(3)).join('')).join(' |');
  for (const v of [...new Set(rows.map((r) => r.cell.split('/')[0]))]) {
    const rv = rows.filter((r) => r.cell.startsWith(v + '/'));
    for (const [kind, key] of [['bounded', 'B'], ['info', 'I']]) {
      for (const nm of Object.keys(rv[0][key])) {
        const over = rv.filter((r) => r[key][nm] > r.chance + 0.10), w = rv.reduce((m, r) => (r[key][nm] - r.chance > m.d ? { d: r[key][nm] - r.chance, r } : m), { d: -1, r: null });
        lines.push(`         ${v} · ${kind} · ${nm}: over in ${over.length} of ${rv.length}; worst ${w.r.rt} ${pct(w.r[key][nm])} vs chance ${pct(w.r.chance)}`);
      }
    }
    const fixedName = v === 'return' ? 'fixed place' : 'fixed angle';
    lines.push(`         ${v} · ${fixedName} by route 0–7 (rows: tolerance level 0 | 1 | 2), %: ${mat(rv, (r) => r.B[fixedName])}`);
    lines.push(`         ${v} · equal legs by route 0–7, %: ${mat(rv, (r) => r.I['equal legs'])}`);
    lines.push(`         ${v} · chance + 10 by tolerance level, %: ${[0, 1, 2].map((ti) => pct(rv.find((r) => r.cell.endsWith('/' + ti)).chance + 0.1)).join(' / ')}`);
  }
  console.log(lines.join('\n'));
  return rows;
}

export function boundShortcuts(t, rows) {
  for (const nm of [...new Set(rows.flatMap((r) => Object.keys(r.B)))]) {
    const fixed = nm.startsWith('fixed'), mine = rows.filter((r) => nm in r.B);
    const over = mine.filter((r) => r.B[nm] > r.chance + 0.10 && !(fixed && EXEMPT_FIXED.includes(r.rt)));
    const ex = fixed ? mine.filter((r) => EXEMPT_FIXED.includes(r.rt)).map((r) => `${r.cell} ${pct(r.B[nm])}`).join(', ') : '';
    t.ok(over.length === 0, `${nm}: within chance + 10 in every cell${fixed ? ' (structural exceptions, reported: ' + ex + ')' : ''}` + (over.length ? ` — over: ${over.map((r) => r.cell + ' ' + pct(r.B[nm])).join(', ')}` : ''));
  }
}

export function viewCaptionKeys(id) {
  let src = '';
  try { src = readFileSync(new URL('../../js/ex/' + id + '/view.js', import.meta.url), 'utf8'); } catch (e) { return null; }
  const keys = new Set();
  for (const m of src.matchAll(/\bcap\(([^{})]*)[{)]/g)) for (const k of m[1].matchAll(/(?:^|\?|:)\s*'(\w+)'/g)) keys.add(k[1]);
  return [...keys];
}

export function checkLearn(t, PX, def, id, kindOf) {
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
  // a tutorial task item (Reckon's turn-back item) may use short-lived dots so that the ground pattern cannot be
  // matched (RV N11): its route, speed and tolerance are still the easiest; the ground level is not counted
  const p0 = L.practice[0].task ? Object.assign({}, L.practice[0], { flow: 0 }) : L.practice[0];
  t.ok(PX.ex.difficulty(def, p0) <= PX.ex.minDifficulty(def) + 1e-9, 'practice starts at the easiest level');
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).every((l) => l >= 0 && l < d.levels.length));
    const varOk = !tr.variant || (def.variants || []).indexOf(tr.variant) >= 0;
    t.ok(tip.id && tip.text && dimOk && varOk && (tr.dim || tr.variant), `tip ${tip.id} has a valid trigger`);
  }
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok((L.strategies || []).every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  t.ok(typeof L.bridge === 'string' && /improves this task; whether it helps real wayfinding has not been tested in any study we found/.test(L.bridge), 'the "where it is used" card carries its limitation line');
  const all = JSON.stringify(L).toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered|genius/.test(all), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
  const keys = viewCaptionKeys(id);
  if (keys) {
    const missing = keys.filter((k) => !(L.captions && typeof L.captions[k] === 'string' && L.captions[k].length));
    t.ok(keys.length > 5 && missing.length === 0, `every caption the view uses exists (${keys.length} keys${missing.length ? '; missing ' + missing.join(', ') : ''})`);
  }
}
