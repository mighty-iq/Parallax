/* EX-12 Reckon (experimental): generator, validator, scorer, shortcut solvers and the error summary
   (ARCHITECTURE.md §5, §12; docs/research/v1.1/R1-path-integration.md §6, §8). Route geometry here is
   written independently of the generators (Math.sin/cos/atan2 on the stored legs and turns).
   Shortcut bounds (RV-reckon-homing B1, the lead's decision (a), 13 Nov 2026): the answers that need no
   integration (a fixed angle or place, turn around, the mirror, the turns reversed, heading not updated)
   stay within chance + 10 points in every route/tolerance cell; a fixed answer is exempt only where R1's
   item rules leave no room (EXEMPT_FIXED). Turn-only answers (the legs taken as equal, the net-turn prior)
   are printed per cell as information, not bounded: they integrate every turn, which is partial path
   integration, and on 2-leg and small-turn routes the start always lies on the side of the net turn. Return items also print "true direction + average distance" (it needs the direction solved). */
import { deepDiff } from './run.mjs';
import { checkLearn, shortcutReport, boundShortcuts } from './homing.test.mjs';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';

const CHANCE_MARGIN = 0.10;
const FILES = ['js/core/px.js', 'js/core/util.js', 'js/core/rng.js', 'js/core/bus.js', 'js/ex/registry.js',
  'js/ex/homing/gen.js', 'js/ex/reckon/gen.js', 'js/ex/reckon/learn.js'];

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
const norm180 = (a) => { const d = norm360(a); return d > 180 ? d - 360 : d; };
const adiff = (a, b) => Math.abs(norm180(a - b));
const rad = (d) => d * Math.PI / 180;
const compass = (e, n) => norm360(Math.atan2(e, n) * 180 / Math.PI);
const pct = (x) => (100 * x).toFixed(0) + ' %';
const sumOf = (a) => a.reduce((s, x) => s + x, 0);
function walk(h0, legs, turns) {
  let x = 0, y = 0, h = h0;
  const path = [[0, 0]];
  legs.forEach((L, i) => { if (i) h += turns[i - 1]; x += L * Math.sin(rad(h)); y += L * Math.cos(rad(h)); path.push([x, y]); });
  return { path, heading: norm360(h0 + sumOf(turns)), key: norm360(compass(-x, -y) - h0 - sumOf(turns)), distance: Math.hypot(x, y) };
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0));
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
}
// The motion's duration in closed form: a ramp of r s covers rate × r / 2; a blend of b s from v1 to v2
// covers b × (v1 + v2) / 2; cruising covers the rest at its rate.
function closedDuration(it) {
  let s = 0;
  it.legs.forEach((L, i) => {
    const v = it.speeds[i];
    if (v.length === 1) s += L / v[0] + it.ramp;
    else {
      const C = L - v[0] * it.ramp / 2 - it.blend * (v[0] + v[1]) / 2 - v[1] * it.ramp / 2, f = it.splits[i];
      s += it.ramp + f * C / v[0] + it.blend + (1 - f) * C / v[1] + it.ramp;
    }
  });
  it.turns.forEach((x, i) => { s += Math.abs(x) / it.turnRates[i] + it.ramp; });
  return s;
}
function simpson(f, T, n = 200) {
  const h = T / n;
  let s = f(0) + f(T);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(i * h);
  return s * h / 3;
}
// A position at direction a (° clockwise from ahead) and distance r in the frame 'end' (x right, z ahead).
const at = (a, r) => ({ x: r * Math.sin(rad(a)), z: r * Math.cos(rad(a)) });
function pearson(a, b) {
  const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; }
  return ab / Math.sqrt(aa * bb);
}

export async function run(t) {
  const PX = t.context({ files: FILES }).PX, X = PX.ex, def = X.get('reckon');
  t.section('reckon: definition');
  if (!t.ok(def, 'reckon is defined (on top of Homing\'s route model)')) return;
  const L = def.lib, H = L.homing;
  t.ok(H === X.get('homing').lib && typeof H.search === 'function', 'it reuses Homing\'s route model (lib.homing is Homing\'s lib)');
  t.eq([def.code, def.version, def.abilities, def.cell, def.role, def.answer, def.perDisplay, def.experimental], ['EX-12', 1, ['NAV'], 'extrinsic-dynamic', 'train', 'angle', true, true], 'code, version, abilities, cell, role, answer, perDisplay, experimental');
  t.ok(/experimental/i.test(def.name) && def.short === 'Reckon', 'named "Reckon (experimental)", short "Reckon"');
  t.eq([def.variants, def.answers, def.extraParams], [['point', 'return'], { point: 'angle', return: 'position' }, ['task']], 'variants point (angle) and return (position); task is an extra param');
  t.eq(def.dims.map((d) => d.key), ['route', 'flow', 'speed', 'tolerance'], 'dims: route, flow, speed, tolerance');
  t.eq([def.dims[0].levels.length, def.dims[1].levels, def.dims[2].levels], [8, ['textured', 'sparse', 'short-lived dots'], ['steady', 'varied between legs', 'varied within legs']], 'Homing\'s 8 routes; flow and speed levels');
  t.eq([L.TOL_POINT, L.TOL_RETURN], [[40, 30, 20], [0.5, 0.35, 0.25]], 'tolerance: 40/30/20° or 50/35/25 % of the way back');
  let modelOk = true;
  for (const p of X.enumerate(def)) {
    const r = L.ROUTES[p.route], want = -2.25 + 0.55 * (r.legs - 2) + 0.4 * r.turns + 0.35 * p.flow + 0.3 * p.speed + 0.9 * p.tolerance + (p.variant === 'return' ? 0.5 : 0);
    if (Math.abs(def.difficulty(p) - want) > 1e-9) modelOk = false;
  }
  t.ok(modelOk, 'difficulty: −2.25 + 0.55/leg + 0.4/turn size + 0.35/flow + 0.3/speed + 0.9/tolerance + 0.5 for return (R1 §8.4)');
  const lo = X.minDifficulty(def), hi = X.maxDifficulty(def);
  t.ok(Math.abs(lo + 1.85) < 1e-9 && Math.abs(hi - 3.25) < 1e-9 && hi - lo >= 4, `range −1.85 to 3.25 (${lo.toFixed(2)} to ${hi.toFixed(2)}, ≥ 4 logits)`);
  t.ok(Math.abs(def.base - def.difficulty({ variant: 'point', route: 0, flow: 0, speed: 0, tolerance: 0 })) < 1e-12, 'base is the easiest point item');
  const cRet = [0.5, 0.35, 0.25].map((x) => 2 * Math.asin(x) * 180 / Math.PI / 360);
  t.ok([0, 1, 2].every((k) => Math.abs(def.chance({ variant: 'point', tolerance: k }) - [80, 60, 40][k] / 360) < 1e-12 && Math.abs(def.chance({ variant: 'return', tolerance: k }) - cRet[k]) < 1e-9),
    `chance: point 2τ/360; return 2·asin(τ)/360 (${cRet.map(pct).join(', ')})`);
  const g0 = def.chance({ variant: 'point', tolerance: 0 }), pB = g0 + (1 - g0 - 0.03) / (1 + Math.exp(lo));
  t.ok(pB > 0.85 && pB < 0.93, `easiest ≈ 87 % for a beginner (${pct(pB)})`);
  t.ok(X.enumerate(def).every((p) => Number.isFinite(def.estMs(p)) && def.estMs(p) > 5000), 'estMs(params) gives a time for every combination');

  t.section('reckon: 10 000 items per variant');
  const combos = X.enumerate(def), items = [], counts = { point: 0, return: 0 };
  const perCombo = Math.ceil(10000 / (combos.length / 2));
  let thrown = 0, invalid = 0, firstInvalid = null, keyWrong = 0, edgeWrong = 0, overRight = 0, junkRight = 0, notJson = 0, geoBad = 0, firstGeo = null;
  let speedBad = 0, firstSpeed = null, groundBad = 0, stayRight = 0;
  const groundSeeds = new Set();
  L.stats.fallbacks = L.stats.builds = L.stats.onTarget = L.stats.full = 0;
  for (const p of combos) {
    const code = X.paramsCode(def, p);
    for (let s = 0; s < perCombo; s++) {
      const seed = PX.rng.hash('reckon-test', code, s);
      let it;
      try { it = def.generate(PX.rng(seed), p); } catch (e) { thrown++; continue; }
      counts[p.variant]++;
      const v = def.validate(it);
      if (v !== true) { invalid++; firstInvalid = firstInvalid || `${X.paramsKey(p)} seed ${seed}: ${v}`; continue; }
      if (deepDiff(JSON.parse(JSON.stringify(it)), it) !== null) notJson++;
      const w = walk(it.startHeading, it.legs, it.turns), n = it.legs.length, rt = L.ROUTES[p.route], band = L.TURNS[rt.turns], d = w.distance;
      const tol = p.variant === 'point' ? [40, 30, 20][p.tolerance] : [0.5, 0.35, 0.25][p.tolerance];
      const tolDeg = p.variant === 'point' ? tol : 2 * Math.asin(tol / 2) * 180 / Math.PI;
      // scoring
      if (p.variant === 'point') {
        const k = it.key, sc = def.score(it, k);
        if (!sc.correct || sc.value !== 0 || !def.score(it, k + 360).correct) keyWrong++;
        if (!def.score(it, k + tol).correct || !def.score(it, k - tol).correct) edgeWrong++;
        // value: the signed angle error (+ clockwise of the start), the same number as detail.signed
        for (const off of [tol + 5, -(tol + 5), tol + 0.5, 180]) { const r = def.score(it, k + off); if (r.correct || Math.abs(Math.abs(r.value) - adiff(k + off, k)) > 0.011 || r.value !== r.detail.signed || (off !== 180 && Math.sign(r.value) !== Math.sign(off))) overRight++; }
        if ([NaN, null, undefined, '120', {}, { x: 1, z: 1 }].some((x) => def.score(it, x).correct)) junkRight++;
      } else {
        const K = at(w.key, d), sc = def.score(it, K);
        // value: the signed angle error of the way walked; value2: walked ÷ true distance
        if (!sc.correct || Math.abs(sc.value) > 0.11 || Math.abs(sc.value2 - 1) > 0.001) keyWrong++;
        { const r = def.score(it, at(w.key + 30, 0.6 * d)); if (Math.abs(r.value - 30) > 0.11 || Math.abs(r.value2 - 0.6) > 0.0011) keyWrong++; }
        // just inside and just outside the disk, in four directions round the start
        for (const ang of [0, 90, 180, 270]) {
          const inn = { x: K.x + 0.99 * tol * d * Math.sin(rad(ang)), z: K.z + 0.99 * tol * d * Math.cos(rad(ang)) };
          const out = { x: K.x + 1.02 * tol * d * Math.sin(rad(ang)), z: K.z + 1.02 * tol * d * Math.cos(rad(ang)) };
          if (!def.score(it, inn).correct) edgeWrong++;
          if (def.score(it, out).correct) overRight++;
        }
        if (def.score(it, { x: 0, z: 0 }).correct) stayRight++; // staying at the end is never right
        if (def.score(it, at(w.key + 180, d)).correct || def.score(it, at(w.key, d * (1 + tol + 0.05))).correct) overRight++;
        if ([NaN, null, undefined, 120, { x: 1 }, { x: 'a', z: 1 }].some((x) => def.score(it, x).correct)) junkRight++;
      }
      // independent geometry
      const ok = adiff(w.key, it.keyDeg) < 0.02 && Math.abs(d - it.distance) < 0.002 && adiff(w.heading, it.heading) < 0.02
        && w.path.every((q, i) => Math.hypot(q[0] - it.path[i][0], q[1] - it.path[i][1]) < 0.003)
        && adiff(w.key, 0) >= Math.max(20, (tolDeg + 2) / 2) && adiff(w.key, 180) >= Math.max(20, (tolDeg + 2) / 2)
        && d >= 5 && d <= 20 + 1e-9 && sumOf(it.legs) >= 12 - 1e-9 && sumOf(it.legs) <= 28 + 1e-9
        && w.path.slice(1, -1).every((q, i) => segDist([0, 0], q, w.path[i + 2]) >= 3 - 1e-6)
        && n === rt.legs && it.legs.every((l) => l >= 4 && l <= 12) && it.turns.length === n - 1
        && it.turns.every((x) => Math.abs(x) >= band.lo && Math.abs(x) <= band.hi)
        && (p.variant === 'point' ? it.answer === 'angle' && it.key === it.keyDeg : it.answer === 'position' && Math.hypot(it.key.x - at(w.key, d).x, it.key.z - at(w.key, d).z) < 0.003)
        && Math.abs(it.duration - closedDuration(it)) < 0.011 && it.duration <= 30 + 1e-9 && it.experimental === true && it.frame === 'end';
      if (!ok) { geoBad++; firstGeo = firstGeo || `${X.paramsKey(p)} seed ${seed}`; }
      // speeds by level, within the comfort limits
      const flat = it.speeds.flat(), sOk = flat.every((v2) => v2 >= 0.5 - 1e-9 && v2 <= 2 + 1e-9) && it.turnRates.every((w2) => w2 >= 30 && w2 <= 45)
        && (p.speed === 0 ? it.speeds.every((v2) => v2.length === 1 && v2[0] === it.speeds[0][0] && v2[0] >= 1.62 - 1e-9 && v2[0] <= 1.98 + 1e-9) && it.turnRates.every((w2) => w2 === 45)
          : p.speed === 1 ? it.speeds.every((v2) => v2.length === 1) : it.speeds.every((v2) => v2.length === 2 && Math.abs(v2[0] - v2[1]) >= 0.4 - 1e-9))
        && it.walkSpeed >= 1.05 && it.walkSpeed <= 1.95;
      if (!sOk) { speedBad++; firstSpeed = firstSpeed || `${X.paramsKey(p)} seed ${seed}`; }
      const f = [['blobs', 0.35], ['blobs', 0.12], ['dots', 0.6]][p.flow];
      if (it.ground.kind !== f[0] || it.ground.density !== f[1] || it.landmarks !== undefined || !Number.isInteger(it.ground.seed)) groundBad++;
      groundSeeds.add(it.ground.seed);
      items.push({ p, seed, it, w, tol, tolDeg });
    }
  }
  t.ok(counts.point >= 10000 && counts.return >= 10000, `at least 10 000 items per variant (point ${counts.point}, return ${counts.return}) over ${combos.length} combinations`);
  t.eq(thrown, 0, 'generate never throws');
  t.ok(invalid === 0, 'validate passes on every item' + (firstInvalid ? ` (${invalid}; first: ${firstInvalid})` : ''));
  t.eq(keyWrong, 0, 'the key scores right (point: value 0, also + 360°; return: position error 0)');
  t.eq(edgeWrong, 0, 'point: key ± tolerance scores right; return: just inside the disk round the start scores right');
  t.eq(overRight, 0, 'point: key ± (tolerance + 0.5° or 5°) and the opposite score wrong; return: just outside the disk, the opposite direction and overshooting score wrong');
  t.eq(stayRight, 0, 'return: staying at the end of the route is never right (the disk never holds the end)');
  t.eq(junkRight, 0, 'malformed responses score wrong');
  t.eq(notJson, 0, 'items survive a JSON round trip unchanged');
  t.ok(geoBad === 0, 'independent geometry agrees: path, key, distance 5–20 m, heading, gap from ahead/behind, never near the start before the end, legs 4–12 m, routes 12–28 m, turns, answer key, duration (closed form) ≤ 30 s' + (firstGeo ? ` (first bad: ${firstGeo})` : ''));
  t.ok(speedBad === 0, 'speeds by level: steady 1.8 ± 10 % at 45°/s; varied 0.5–2.0 m/s at 30–45°/s; within legs two speeds ≥ 0.4 m/s apart; walk back 1.05–1.95 m/s' + (firstSpeed ? ` (first bad: ${firstSpeed})` : ''));
  t.ok(groundBad === 0, 'the ground matches the flow level; no landmarks or objects in any item');
  t.ok(groundSeeds.size >= items.length * 0.999, `the ground is re-seeded every item (${groundSeeds.size} seeds for ${items.length} items)`);
  t.ok(L.stats.fallbacks <= items.length / 1000, `fallback construction rarely needed (${L.stats.fallbacks})`);
  // Shortcuts per cell (RV B1, the lead's decision (a)): the no-integration answers within chance + 10 in every
  // cell (a fixed answer except in the structural cells, EXEMPT_FIXED); the turn-only family as information.
  // The cells where answers can spread (3–4 legs, medium or large turns) sit a few points under the bound for a
  // fixed angle (at 40° the axis gap alone allows 29 % against 32.2 %), and a CV estimate from ~420 items moves
  // by about 2 points, so their point items get 2 000 more each for this check.
  const extra = [];
  for (const route of [3, 5, 6, 7]) for (let tol = 0; tol < 3; tol++) for (let k = 0; k < 2000; k++) {
    const p = { variant: 'point', route, flow: k % 3, speed: Math.floor(k / 3) % 3, tolerance: tol };
    extra.push({ p, it: def.generate(PX.rng(PX.rng.hash('reckon-shortcuts', route, tol, k)), p) });
  }
  boundShortcuts(t, shortcutReport(def, items.concat(extra), 'Reckon'));
  // RV-play-nav-knots 3: the generator never leaves the level's description (the stage text is the player's)
  {
    const all = items.concat(extra), off = all.filter((x) => { const rt = L.ROUTES[x.p.route], band = L.TURNS[rt.turns]; return x.it.legs.length !== rt.legs || x.it.turns.length !== rt.legs - 1 || !x.it.turns.every((v) => Math.abs(v) >= band.lo - 1e-9 && Math.abs(v) <= band.hi + 1e-9); });
    t.ok(off.length === 0, `every route matches its level: its number of legs and every turn within its band (${all.length} items, fallbacks included${off.length ? `; ${off.length} off, first at route ${off[0].p.route}` : ''})`);
  }
  // time as a cue to leg length (RV S1): above 'steady' a leg's walking time says little about its length
  {
    const byLevel = [0, 1, 2].map((lv) => {
      const T = [], Ls = [], Vm = [];
      items.filter((x) => x.p.speed === lv).forEach((x) => {
        let i = 0;
        H.plan(x.it, 0).segs.forEach((sg) => { if (sg.kind === 'walk') { T.push(sg.dur); Ls.push(x.it.legs[i]); Vm.push(x.it.legs[i] / sg.dur); i++; } });
      });
      return { r: pearson(T, Ls), rv: pearson(Vm, Ls), n: T.length };
    });
    t.ok(byLevel[0].r > 0.9 && Math.abs(byLevel[1].r) <= 0.5 && Math.abs(byLevel[2].r) <= 0.5,
      `leg time vs leg length: r ${byLevel.map((b) => b.r.toFixed(2)).join(' / ')} at steady / between legs / within legs (≤ 0.5 above steady; steady keeps one speed); r(mean speed, length) ${byLevel.map((b) => b.rv.toFixed(2)).join(' / ')}; ${byLevel.map((b) => b.n).join(' / ')} legs`);
  }
  const rightSide = items.filter((x) => x.it.keyDeg < 180).length / items.length;
  t.ok(Math.abs(rightSide - 0.5) < 0.03, `the start lies to the right ≈ 50 % (${pct(rightSide)})`);

  // motion: Simpson over each piece's rate covers each leg and turn; rates start and stop at 0
  let covered = true, ramps = true, firstCov = null;
  items.filter((_, i) => i % 50 === 0).forEach(({ it }) => {
    const pl = H.plan(it, 1.2);
    let w = 0, k = 0;
    pl.segs.forEach((s, si) => {
      if (s.kind === 'stand') return;
      const want = s.kind === 'walk' ? it.legs[w++] : Math.abs(it.turns[k++]);
      const got = s.pieces.reduce((acc, p) => acc + simpson((tt) => H.rateAt(p, tt), p.dur), 0);
      if (Math.abs(got - want) > 1e-6 * Math.max(1, want)) { covered = false; firstCov = firstCov || `${si}: ${got} vs ${want}`; }
      if (H.rateAt(s.pieces[0], 0) > 1e-9 || H.rateAt(s.pieces.at(-1), s.pieces.at(-1).dur) > 1e-6) ramps = false;
    });
  });
  t.ok(covered && ramps, 'every leg and turn covers its length or angle (Simpson over the rate), starting and stopping smoothly' + (firstCov ? ` (${firstCov})` : ''));

  const fresh = t.context({ files: FILES }).PX;
  let same = true, sameFresh = true;
  items.filter((_, i) => i % 40 === 0).forEach(({ p, seed, it }) => {
    if (deepDiff(def.generate(PX.rng(seed), p), it) !== null) same = false;
    if (deepDiff(fresh.ex.get('reckon').generate(fresh.rng(seed), p), it) !== null) sameFresh = false;
  });
  t.ok(same && sameFresh, 'generation is deterministic (same seed → same item, also across contexts)');
  let robust = true;
  for (const bad of [undefined, {}, { variant: 'x', route: 99, flow: 'x', speed: 1.5, tolerance: -1 }, { task: 'nope' }]) {
    try { if (def.validate(def.generate(PX.rng(4), bad)) !== true) robust = false; } catch { robust = false; }
  }
  t.ok(robust, 'generate clamps malformed params instead of throwing');
  let fbOk = true, fbFirst = null;
  for (const p of combos) for (let s = 0; s < 2; s++) {
    const v = def.validate(Object.assign(L.fallback(PX.rng(s), L.normParams(p)), { seed: s }));
    if (v !== true) { fbOk = false; fbFirst = fbFirst || `${X.paramsKey(p)}: ${v}`; }
  }
  t.ok(fbOk, 'the fallback construction is valid at every combination' + (fbFirst ? ` (${fbFirst})` : ''));
  L.stats.fallbacks = 0;
  const tm = timeP95((s) => def.generate(PX.rng(9000 + s), { variant: 'return', route: 7, flow: 2, speed: 2, tolerance: 2 }), 400);
  t.ok(tm.cpu < 20, `generation p95 < 20 ms at the hardest level (CPU ${tm.cpu.toFixed(2)} ms, wall ${tm.wall.toFixed(2)} ms)`);

  t.section('reckon: validate rejects broken items');
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const baseP = items.find((x) => x.p.variant === 'point' && L.ROUTES[x.p.route].legs === 3 && x.p.speed === 2).it;
  const baseR = items.find((x) => x.p.variant === 'return' && x.p.speed === 0).it;
  const rejects = (what, it, pattern) => {
    const v = def.validate(it);
    t.ok(typeof v === 'string' && (!pattern || pattern.test(v)), `validate rejects: ${what}` + (typeof v === 'string' ? (pattern && !pattern.test(v) ? ` (said: ${v})` : '') : ' (it passed)'));
  };
  let m = clone(baseP); m.key = m.keyDeg = norm360(m.key + 45); rejects('a key that does not match the route', m, /key/);
  m = clone(baseR); m.key.x += 1; rejects('a return key off the start', m, /answer key/);
  m = clone(baseP); m.landmarks = [{ id: 'peak' }]; rejects('a landmark in the scene', m, /landmarks/);
  m = clone(baseP); m.ground.kind = m.ground.kind === 'dots' ? 'blobs' : 'dots'; rejects('ground marks of another flow level', m, /ground/);
  m = clone(baseP); m.speeds[0] = [2.4, 1.6]; rejects('a leg faster than 2 m/s', m, /speed|limits/);
  m = clone(baseR); m.speeds[1] = [m.speeds[0][0] + 0.05]; rejects('the steady level with a second speed', m, /steady/);
  m = clone(baseP); m.turnRates[0] = 60; rejects('a turn faster than 45°/s', m, /rate/);
  m = clone(baseP); m.walkSpeed = 2.5; rejects('a walk back faster than the range', m, /walkSpeed/);
  m = clone(baseP); m.answer = 'position'; rejects('the wrong answer type for the variant', m, /answer type/);
  m = clone(baseP); m.duration += 1; rejects('a duration that does not match the motion', m, /duration/);
  { // Hand-made: a route whose turns cancel, so "heading not updated" lands on the key.
    const legs = [6, 7, 6], turns = [100, -95], h0 = 10, w = walk(h0, legs, turns), k = Math.round(w.key * 100) / 100 % 360;
    const it = clone(baseP);
    Object.assign(it, { params: Object.assign({}, it.params, { route: 3, speed: 0, tolerance: 0 }), legs, turns, startHeading: h0, key: k, keyDeg: k, tolerance: 40, tolDeg: 40,
      path: w.path.map((q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000]), heading: Math.round(w.heading * 100) / 100 % 360,
      distance: Math.round(w.distance * 1000) / 1000, returnBearing: Math.round(compass(-w.path.at(-1)[0], -w.path.at(-1)[1]) * 100) / 100 % 360, pathLength: 19,
      speeds: [[1.8], [1.8], [1.8]], splits: [null, null, null], turnRates: [45, 45] });
    it.duration = Math.round(closedDuration(it) * 100) / 100;
    rejects('turns that cancel out (heading not updated would be right)', it, /shortcut/);
  }

  t.section('reckon: shortcut solvers');
  const sumT = (it) => sumOf(it.turns);
  // Direction solvers (° from the final heading). For return items they are paired with the true home
  // distance (the most generous case) and scored as positions.
  const dirSolvers = {
    'turn around (180°)': (it) => 180,
    'turns reversed (180° − Σ turns)': (it) => norm360(180 - sumT(it)),
    'heading not updated (from the first heading)': (it) => norm360(compass(-it.path.at(-1)[0], -it.path.at(-1)[1]) - it.startHeading),
    'mirror (sides swapped)': (it) => norm360(360 - it.keyDeg),
    'turns only, legs taken as equal': (it) => walk(it.startHeading, it.legs.map(() => 1), it.turns).key,
  };
  const hit = (x, a, r) => def.score(x.it, x.p.variant === 'point' ? a : at(a, r === undefined ? x.it.distance : r)).correct;
  const cellOf = (x) => `${x.p.variant}/${x.p.route}/${x.p.tolerance}`;
  const report = [`hardest p95 ${tm.cpu.toFixed(2)} ms CPU`];
  for (const [name, fn] of Object.entries(dirSolvers)) {
    const cells = {};
    for (const x of items) {
      const c = (cells[cellOf(x)] = cells[cellOf(x)] || { n: 0, hit: 0, chance: def.chance(x.p) });
      c.n++; if (hit(x, fn(x.it))) c.hit++;
    }
    let worst = -1, worstCell = '';
    for (const [k, c] of Object.entries(cells)) if (c.hit / c.n - c.chance > worst) { worst = c.hit / c.n - c.chance; worstCell = `${k} ${pct(c.hit / c.n)} vs chance ${pct(c.chance)}`; }
    const pooled = ['point', 'return'].map((v) => { const l = items.filter((x) => x.p.variant === v); return pct(l.filter((x) => hit(x, fn(x.it))).length / l.length); });
    if (name.startsWith('turns only')) report.push(`[info] ${name}: point ${pooled[0]}, return ${pooled[1]}`);
    else {
      t.ok(worst <= CHANCE_MARGIN, `${name}: ≤ chance + 10 points in every variant × route × tolerance cell (worst: ${worstCell})`);
      report.push(`${name}: point ${pooled[0]}, return ${pooled[1]}, worst cell ${worstCell}`);
    }
  }
  const strictMiss = items.filter((x) => ['turns reversed (180° − Σ turns)', 'heading not updated (from the first heading)', 'mirror (sides swapped)']
    .some((nm) => adiff(dirSolvers[nm](x.it), x.it.keyDeg) <= x.tolDeg + 2)).length;
  t.eq(strictMiss, 0, 'reversed, heading-not-updated and mirror answers miss every item by more than the tolerance + 2° (diagnosable errors)');
  // A habitual turn: the cross-validated best fixed answer where answers can spread (3–4 legs, medium or
  // large turns), point items.
  const bestFixed = (list) => {
    let b = 0, a0 = 0;
    for (let a = 0; a < 360; a += 5) { const hh = list.filter((x) => hit(x, a)).length / list.length; if (hh > b) { b = hh; a0 = a; } }
    return [b, a0];
  };
  const cvFixed = (list) => {
    const A = list.filter((_, i) => i % 2 === 0), B = list.filter((_, i) => i % 2 === 1), h2 = (l, a) => l.filter((x) => hit(x, a)).length;
    return (h2(B, bestFixed(A)[1]) + h2(A, bestFixed(B)[1])) / list.length;
  };
  const cvs = [];
  for (const variant of ['point', 'return']) for (const ti of [0, 1, 2]) {
    const list = items.filter((x) => x.p.variant === variant && x.p.tolerance === ti && L.spreads(x.p)), cv = cvFixed(list);
    // information only: the per-cell bound on larger samples (shortcutReport, boundShortcuts) is the check
    cvs.push(`${variant[0]}${ti} ${pct(cv)}`);
  }
  report.push(`[info] best fixed direction where answers spread (main sample): ${cvs.join(' ')}`);
  // The encoding-error model's answer (Fujita 1993 as fitted by Loomis 1993: L' = 0.6 L + 1.2, |T'| = 0.48 |T| + 44°):
  // a typical human error, reported only.
  const encHit = items.filter((x) => x.p.variant === 'point').filter((x) => {
    const w = walk(x.it.startHeading, x.it.legs.map((l) => 0.6 * l + 1.2), x.it.turns.map((tt) => Math.sign(tt) * (0.48 * Math.abs(tt) + 44)));
    return hit(x, w.key);
  }).length / items.filter((x) => x.p.variant === 'point').length;
  report.push(`[info] encoding-error model answer, point: ${pct(encHit)}`);

  t.section('reckon: distance heuristics (return items, with the true direction)');
  const ret = items.filter((x) => x.p.variant === 'return');
  const outTime = (it) => it.duration - it.turns.reduce((s, x2, i) => s + Math.abs(x2) / it.turnRates[i] + it.ramp, 0); // time spent walking
  const radial = (list, rOf) => list.filter((x) => Math.abs(rOf(x.it) - x.it.distance) <= x.tol * x.it.distance - 1e-9).length / list.length;
  const bestC = (list, f) => { let b = 0, bc = 0; for (let c = 0.05; c <= 1.5; c += 0.01) { const h2 = radial(list, (it) => c * f(it)); if (h2 > b) { b = h2; bc = c; } } return [b, bc]; };
  const dRows = [];
  for (const sl of [0, 1, 2]) {
    const list = ret.filter((x) => x.p.speed === sl);
    const lastLeg = radial(list, (it) => it.legs.at(-1));
    const [byPath] = bestC(list, (it) => it.pathLength), [byTime] = bestC(list, (it) => outTime(it)), [fixed] = bestC(list, () => 10);
    dRows.push(`speed ${sl}: last leg ${pct(lastLeg)}, ∝ path ${pct(byPath)}, ∝ walking time ${pct(byTime)}, best fixed ${pct(fixed)}`);
    // above 'steady', holding Walk for a multiple of the outbound walking time does no better than one fixed distance
    if (sl > 0) t.ok(byTime <= fixed + 0.03, `speed level ${sl}: walking time is no better an odometer than a fixed distance (${pct(byTime)} vs ${pct(fixed)})`);
    const corr = (() => { const a = list.map((x) => outTime(x.it)), b = list.map((x) => x.it.distance), ma = sumOf(a) / a.length, mb = sumOf(b) / b.length;
      let sab = 0, saa = 0, sbb = 0; a.forEach((v2, i) => { sab += (v2 - ma) * (b[i] - mb); saa += (v2 - ma) ** 2; sbb += (b[i] - mb) ** 2; }); return sab / Math.sqrt(saa * sbb); })();
    dRows.push(`r(walking time, home distance) ${corr.toFixed(2)}`);
  }
  report.push(`[info] distance heuristics at the true direction: ${dRows.join('; ')}`);
  // Combined: a direction shortcut with a distance heuristic stays near chance.
  const combos2 = { 'turns reversed + last leg': (it) => at(norm360(180 - sumT(it)), it.legs.at(-1)), 'turn around + half the route': (it) => at(180, it.pathLength / 2) };
  for (const [name, fn] of Object.entries(combos2)) {
    let worst = -1, wc = '';
    for (const ti of [0, 1, 2]) for (let ri = 0; ri < 8; ri++) {
      const l = ret.filter((x) => x.p.tolerance === ti && x.p.route === ri), hh = l.filter((x) => def.score(x.it, fn(x.it)).correct).length / l.length, ch = def.chance({ variant: 'return', tolerance: ti });
      if (hh - ch > worst) { worst = hh - ch; wc = `route ${ri} tol ${ti}: ${pct(hh)} vs ${pct(ch)}`; }
    }
    t.ok(worst <= CHANCE_MARGIN, `${name}: ≤ chance + 10 in every route × tolerance cell (worst ${wc})`);
  }

  t.section('reckon: tutorial items (heading, distance)');
  let tOk = true, tFirst = null;
  for (let s = 0; s < 1000; s++) {
    const p = { variant: s % 2 ? 'return' : 'point', task: s % 2 ? 'distance' : 'heading', route: 0, flow: s % 3, speed: (s >> 1) % 3, tolerance: (s >> 2) % 3 };
    const it = def.generate(PX.rng(PX.rng.hash('task', s)), p), v = def.validate(it);
    let bad = v !== true ? v : null;
    if (!bad && it.task === 'heading') {
      if (!def.score(it, norm360(-it.turns[0])).correct || def.score(it, 0).correct || def.score(it, it.turns[0]).correct) bad = 'heading key';
    } else if (!bad) {
      const Ld = it.legs[0];
      if (!def.score(it, { x: 0, z: Ld }).correct || def.score(it, { x: 0, z: 0 }).correct || def.score(it, { x: 0, z: 2 * Ld }).correct || Math.abs(it.walkSpeed - it.speeds[0][0]) < 0.4 - 1e-9) bad = 'distance key or speed';
    }
    if (bad) { tOk = false; tFirst = tFirst || `${JSON.stringify(p)}: ${bad}`; }
  }
  t.ok(tOk, '1 000 tutorial items: valid; heading → turning back by the turn is right, not turning or turning on is wrong; distance → L ahead right, 0 and 2L wrong, the second walk at another speed' + (tFirst ? ` (${tFirst})` : ''));
  t.ok(def.difficulty({ variant: 'point', task: 'heading' }) === lo, 'a task does not change difficulty (tutorial items are never rated)');

  t.section('reckon: the player\'s own errors (bias over the last 20 routes)');
  {
    const mkE = (k, q, d, r) => [0, r >= 0 ? 1 : 0, k, q, d, r, 20, 0];
    const over = Array.from({ length: 20 }, (_, i) => mkE(i % 2 ? 100 : 260, i % 2 ? 115 : 245, 10, i % 4 === 1 ? 8 : -1));
    const b = L.bias(over, 20);
    t.ok(b.turn === 15 && b.ratio === 0.8 && b.swaps === 0, `turning 15° too far on both sides and walking 80 % reads as turn +15, ratio 0.80 (${JSON.stringify(b)})`);
    const sw = L.bias([mkE(100, 260, 10, -1), mkE(250, 110, 10, -1), mkE(120, 130, 10, -1)], 20);
    t.ok(sw.swaps === 2 && sw.turn === null, `answers on the other side count as swaps; fewer than 5 same-side answers give no turn bias (${JSON.stringify(sw)})`);
    const few = L.bias([mkE(100, 100, 10, 12), mkE(100, 100, 10, 12)], 20);
    t.ok(few.ratio === null, 'fewer than 3 walked answers give no distance bias');
    const it0 = baseR, res = def.score(it0, at(it0.keyDeg + 10, it0.distance * 0.9)), e = L.entry(it0, at(it0.keyDeg + 10, it0.distance * 0.9), res, 1234);
    t.ok(e && e.length === 8 && e[1] === 1 && Math.abs(adiff(e[3], it0.keyDeg) - 10) < 0.11 && Math.abs(e[5] - it0.distance * 0.9) < 0.011, `entry() keeps the answer's direction and walked distance (${JSON.stringify(e)})`);
    t.ok(L.entry(def.generate(PX.rng(1), { task: 'heading' }), 0, { correct: false, detail: {} }, 0) === null, 'tutorial items are not kept');
  }

  t.section('reckon: timing');
  const estOk = [];
  for (const variant of ['point', 'return']) for (let ri = 0; ri < 8; ri++) {
    const l = items.filter((x) => x.p.variant === variant && x.p.route === ri);
    const mean = sumOf(l.map((x) => L.LEAD_MS + 1000 * x.it.duration + L.RESPONSE_MS + (variant === 'return' ? 1000 * x.it.distance / x.it.walkSpeed + L.STOP_MS : 0))) / l.length;
    const est = sumOf(l.map((x) => def.estMs(x.p))) / l.length;
    estOk.push([variant[0] + ri, est / mean]);
  }
  t.ok(estOk.every(([, r]) => Math.abs(r - 1) <= 0.15), `estMs within 15 % of the mean trial time in every variant × route (${estOk.map(([k, r]) => k + ' ' + r.toFixed(2)).join(', ')})`);
  report.push(`answers on their target ${pct(L.stats.onTarget / Math.max(1, L.stats.builds))}`);

  checkLearn(t, PX, def, 'reckon', (it) => (it.keyDeg < 180 ? 'right' : 'left'));
  const learn = X.learn('reckon');
  t.ok(learn && learn.goals && ['point', 'return', 'heading', 'distance'].every((k) => typeof learn.goals[k] === 'string'), 'goals for both variants and both tutorial tasks');
  t.ok(learn && learn.practice.some((p) => p.task === 'heading') && learn.practice.some((p) => p.task === 'distance') && learn.practice.some((p) => p.variant === 'return' && !p.task), 'Try: the heading and distance rungs, then point and return routes (R1 §8.5)');
  const allText = JSON.stringify(learn || {}).toLowerCase();
  t.ok(!((learn || {}).parts || []).some((pt) => pt.id === 'landmarks') && /nothing to steer by/.test(allText) && /none/.test(JSON.stringify(((learn || {}).parts || [])[0] || {})), 'no landmarks part (as Homing has); the first card says there are no fixes; the texts say there is nothing to steer by');
  t.ok(/fix/.test(allText) && /dead reckoning/.test(allText), 'the "why no landmarks" card explains fixes and dead reckoning');
  // Caption keys the shared Homing kit asks for through Reckon's caption function exist too.
  const kitSrc = readFileSync(new URL('../../js/ex/homing/view.js', import.meta.url), 'utf8');
  const kitKeys = [...new Set([...kitSrc.matchAll(/\bkc\('(\w+)'/g)].map((mm) => mm[1]))];
  const missing = kitKeys.filter((k) => !(learn && learn.captions && typeof learn.captions[k] === 'string'));
  t.ok(missing.length === 0, `every caption the shared view kit uses exists for Reckon (${kitKeys.length} keys${missing.length ? '; missing ' + missing.join(', ') : ''})`);
  console.log('       EX-12 reckon: ' + items.length + ' items; ' + report.join('; '));
}
