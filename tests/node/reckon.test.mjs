/* EX-12 Reckon (experimental): generator, validator, scorer, shortcut solvers and the error summary
   (ARCHITECTURE.md §5, §12; docs/research/v1.1/R1-path-integration.md §6, §8). Route geometry here is
   written independently of the generators (Math.sin/cos/atan2 on the stored legs and turns).
   Shortcut bounds (RV-reckon-homing B1, the lead's decision (a), 13 Nov 2026): the answers that need no
   integration (a fixed angle or place, turn around, the mirror, the turns reversed, heading not updated)
   stay within chance + 10 points in every route/tolerance cell. v1.2 (version 2; note
   docs/research/v1.2/N1-reckon.md §3.3–3.4, §6 #6–11): every rated route ends with a turn on the spot of
   30–150°, so no cell is exempt any more (1.1's EXEMPT_FIXED is gone); where the legs decide (cells marked
   /L) the turn-only answers are held to at most half the items by construction (two alternatives per item,
   checked here) and at most 50 % + 3 standard errors per cell in the sample. Elsewhere turn-only answers
   (the legs taken as equal, the net-turn prior) are printed per cell as information, not bounded: they
   integrate every turn, which is partial path integration. Return items also print "true direction +
   average distance" (it needs the direction solved). */
import { deepDiff } from './run.mjs';
import { checkLearn, shortcutReport, boundShortcuts, checkGentle } from './homing.test.mjs';
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
  t.eq([def.code, def.version, def.abilities, def.cell, def.role, def.answer, def.perDisplay, def.experimental], ['EX-12', 2, ['NAV'], 'extrinsic-dynamic', 'train', 'angle', true, true], 'code, version (2: v1.2 turns on the spot, the legs dim, a fourth tolerance), abilities, cell, role, answer, perDisplay, experimental');
  t.ok(/experimental/i.test(def.name) && def.short === 'Reckon', 'named "Reckon (experimental)", short "Reckon"');
  t.eq([def.variants, def.answers, def.extraParams], [['point', 'return'], { point: 'angle', return: 'position' }, ['task']], 'variants point (angle) and return (position); task is an extra param');
  t.eq(def.dims.map((d) => d.key), ['route', 'flow', 'speed', 'tolerance', 'legs'], 'dims: route, flow, speed, tolerance, legs');
  t.eq([def.dims[4].levels.length, L.ROT, L.LEG2, L.PATH2, L.D_MIN_RETURN], [2, [30, 150], [3, 15], [10, 28], 3], 'v1.2: legs dim of two levels; turns on the spot of 30–150°; leg-level legs 3–15 m and routes 10–28 m; walks back from 3 m');
  t.eq([def.dims[0].levels.length, def.dims[1].levels, def.dims[2].levels], [8, ['textured', 'sparse', 'short-lived dots'], ['steady', 'varied between legs', 'varied within legs']], 'Homing\'s 8 routes; flow and speed levels');
  t.eq([L.TOL_POINT, L.TOL_RETURN], [[40, 30, 20, 15], [0.5, 0.35, 0.25, 0.2]], 'tolerance: 40/30/20/15° or 50/35/25/20 % of the way back');
  // the leg cells, written out here independently of gen.js (note N1 §3.4 #1; 2 and 3 legs with large turns and 4 legs
  // with large turns from 30°)
  const LEGCELL = { 2: [1, 2, 3], 3: [0, 1, 2, 3], 5: [1, 2, 3], 6: [0, 1, 2, 3], 7: [1, 2, 3] };
  const isLeg = (p) => p.legs === 1 && (LEGCELL[p.route] || []).includes(p.tolerance);
  let modelOk = true, cellsOk = true;
  for (const p of X.enumerate(def)) {
    const r = L.ROUTES[p.route], want = -2.25 + 0.3 + 0.55 * (r.legs - 2) + 0.4 * r.turns + 0.35 * p.flow + 0.3 * p.speed + 0.9 * p.tolerance + (p.variant === 'return' ? 0.5 : 0) + (isLeg(p) ? 0.4 : 0);
    if (Math.abs(def.difficulty(p) - want) > 1e-9) modelOk = false;
    if (L.legCell(L.normParams(p)) !== isLeg(p)) cellsOk = false;
  }
  t.ok(modelOk, 'difficulty: −2.25 + 0.3 (the turn on the spot) + 0.55/leg (a placeholder) + 0.4/turn size + 0.35/flow + 0.3/speed + 0.9/tolerance + 0.5 for return + 0.4 where the legs decide');
  t.ok(cellsOk, 'the legs decide on routes 3 and 6 at every tolerance, and on routes 2, 5 and 7 from 30°; elsewhere the level costs nothing');
  const lo = X.minDifficulty(def), hi = X.maxDifficulty(def);
  t.ok(Math.abs(lo + 1.55) < 1e-9 && Math.abs(hi - 4.85) < 1e-9 && hi - lo >= 4, `range −1.55 to 4.85 (${lo.toFixed(2)} to ${hi.toFixed(2)}; 1.1: −1.85 to 3.25; stored levels are re-based)`);
  t.ok(Math.abs(def.base - def.difficulty({ variant: 'point', route: 0, flow: 0, speed: 0, tolerance: 0, legs: 0 })) < 1e-12, 'base is the easiest point item');
  const cRet = [0.5, 0.35, 0.25, 0.2].map((x) => 2 * Math.asin(x) * 180 / Math.PI / 360);
  t.ok([0, 1, 2, 3].every((k) => Math.abs(def.chance({ variant: 'point', tolerance: k }) - [80, 60, 40, 30][k] / 360) < 1e-12 && Math.abs(def.chance({ variant: 'return', tolerance: k }) - cRet[k]) < 1e-9),
    `chance: point 2τ/360; return 2·asin(τ)/360 (${cRet.map(pct).join(', ')})`);
  const g0 = def.chance({ variant: 'point', tolerance: 0 }), pB = g0 + (1 - g0 - 0.03) / (1 + Math.exp(lo));
  t.ok(pB > 0.82 && pB < 0.9, `easiest ≈ 84 % for a beginner (${pct(pB)}; the turn on the spot costs 0.3 logit)`);
  t.ok(X.enumerate(def).every((p) => Number.isFinite(def.estMs(p)) && def.estMs(p) > 5000), 'estMs(params) gives a time for every combination');

  t.section('reckon: version 2 re-bases stored levels (js/engine/rebase.js)');
  {
    // The final turn on the spot (+0.3), the fourth tolerance level and the legs level move the range, so levels
    // saved by 1.1 (V11: version 1) are converted once on load: the same item difficulty, a new level number.
    const Q = t.context({}).PX, E = Q.engine, d2 = Q.ex.get('reckon'), r = E.model.range(d2), v11 = E.rebase.V11.reckon;
    t.ok(d2.version === 2 && v11[2] === 1 && !E.rebase.sameRange([v11[0], v11[1]], [r.min, r.max]), `version 2 with a new range (1.1: ${v11[0]}…${v11[1]}; now ${r.min.toFixed(2)}…${r.max.toFixed(2)}), so 1.1's stored levels are re-based`);
    const conv = E.rebase.conv([v11[0], v11[1]], [r.min, r.max]);
    t.ok(conv(1) >= 1 && conv(100) <= 100 && conv(50) < 50 && conv(1) <= conv(50) && conv(50) <= conv(100), `1.1's levels 1, 50 and 100 read ${conv(1)}, ${conv(50)} and ${conv(100)} on the new scale`);
  }

  t.section('reckon: 10 000 items per variant');
  const combos = X.enumerate(def), items = [], counts = { point: 0, return: 0 };
  const perCombo = Math.ceil(10000 / (combos.length / 2));
  let thrown = 0, invalid = 0, firstInvalid = null, keyWrong = 0, edgeWrong = 0, overRight = 0, junkRight = 0, notJson = 0, geoBad = 0, firstGeo = null;
  let speedBad = 0, firstSpeed = null, groundBad = 0, stayRight = 0, altBad = 0, firstAlt = null, legItems = 0;
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
      const tol = p.variant === 'point' ? [40, 30, 20, 15][p.tolerance] : [0.5, 0.35, 0.25, 0.2][p.tolerance];
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
      // independent geometry (v1.2: every route ends with a turn on the spot of 30–150°; where the legs decide, legs
      // 3–15 m and routes 10–28 m; walks back from 3 m)
      const lc = isLeg(p), LG = lc ? [3, 15] : [4, 12], PT = lc ? [10, 28] : [12, 28], dMin = p.variant === 'return' ? 3 : 5;
      const ok = adiff(w.key, it.keyDeg) < 0.02 && Math.abs(d - it.distance) < 0.002 && adiff(w.heading, it.heading) < 0.02
        && w.path.every((q, i) => Math.hypot(q[0] - it.path[i][0], q[1] - it.path[i][1]) < 0.003)
        && adiff(w.key, 0) >= Math.max(20, (tolDeg + 2) / 2) && adiff(w.key, 180) >= Math.max(20, (tolDeg + 2) / 2)
        && d >= dMin - 1e-9 && d <= 20 + 1e-9 && sumOf(it.legs) >= PT[0] - 1e-9 && sumOf(it.legs) <= PT[1] + 1e-9
        && w.path.slice(1, -1).every((q, i) => segDist([0, 0], q, w.path[i + 2]) >= 3 - 1e-6)
        && n === rt.legs && it.legs.every((l) => l >= LG[0] && l <= LG[1]) && it.turns.length === n
        && it.turns.slice(0, n - 1).every((x) => Math.abs(x) >= band.lo && Math.abs(x) <= band.hi) && Math.abs(it.turns[n - 1]) >= 30 && Math.abs(it.turns[n - 1]) <= 150
        && (p.variant === 'point' ? it.answer === 'angle' && it.key === it.keyDeg : it.answer === 'position' && Math.hypot(it.key.x - at(w.key, d).x, it.key.z - at(w.key, d).z) < 0.003)
        && Math.abs(it.duration - closedDuration(it)) < 0.011 && it.duration <= 30 + 1e-9 && it.experimental === true && it.frame === 'end';
      if (!ok) { geoBad++; firstGeo = firstGeo || `${X.paramsKey(p)} seed ${seed}`; }
      // the two alternatives, re-derived here from their own legs and the item's turns (note N1 §3.4 #2): both keys
      // follow from their legs, lie more than 2·w + 8° apart (w: tolerance, or asin(τ) for walks back), one is shown
      if (lc) {
        const A = it.alts || [], wHalf = p.variant === 'point' ? tol : Math.asin(tol) * 180 / Math.PI;
        const ks = A.map((a) => walk(it.startHeading, a.legs, it.turns).key);
        const aok = A.length === 2 && ks.every((k, i) => adiff(k, A[i].key) < 0.02) && adiff(ks[0], ks[1]) > 2 * wHalf + 8
          && (it.alt === 0 || it.alt === 1) && A[it.alt].legs.every((l, i) => l === it.legs[i]) && adiff(ks[it.alt], w.key) < 0.02
          && A.every((a) => a.legs.every((l) => l >= 3 && l <= 15) && sumOf(a.legs) >= 10 - 1e-9 && sumOf(a.legs) <= 28 + 1e-9);
        if (!aok) { altBad++; firstAlt = firstAlt || `${X.paramsKey(p)} seed ${seed}`; }
        legItems++;
      } else if (it.alts !== undefined) { altBad++; firstAlt = firstAlt || `${X.paramsKey(p)} seed ${seed}: alternatives outside a leg cell`; }
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
  t.ok(geoBad === 0, 'independent geometry agrees: path, key, home distance 5–20 m (walks back 3–20 m), heading, gap from ahead/behind, never near the start before the end, legs 4–12 m and routes 12–28 m (where the legs decide 3–15 m and 10–28 m), turns in their band, a last turn on the spot of 30–150°, answer key, duration (closed form) ≤ 30 s' + (firstGeo ? ` (first bad: ${firstGeo})` : ''));
  t.ok(altBad === 0 && legItems > 3000, `where the legs decide, both alternatives follow from their legs, lie more than 2·w + 8° apart and one is shown (${legItems} items)` + (firstAlt ? ` (first bad: ${firstAlt})` : ''));
  t.ok(speedBad === 0, 'speeds by level: steady 1.8 ± 10 % at 45°/s; varied 0.5–2.0 m/s at 30–45°/s; within legs two speeds ≥ 0.4 m/s apart; walk back 1.05–1.95 m/s' + (firstSpeed ? ` (first bad: ${firstSpeed})` : ''));
  t.ok(groundBad === 0, 'the ground matches the flow level; no landmarks or objects in any item');
  t.ok(groundSeeds.size >= items.length * 0.999, `the ground is re-seeded every item (${groundSeeds.size} seeds for ${items.length} items)`);
  t.ok(L.stats.fallbacks <= items.length / 1000, `fallback construction rarely needed (${L.stats.fallbacks})`);
  // Shortcuts per cell (RV B1, the lead's decision (a)): the no-integration answers within chance + 10 in every
  // cell, with no exemptions since v1.2 (the final turn on the spot spreads the key); the turn-only family as
  // information outside the cells where the legs decide (/L), bounded there (below). The main sample has about
  // 160 point items per /L cell and its twin, and a CV estimate from so few moves by about 3 points, so the
  // routes with leg cells get 600 more point items per legs level and tolerance for this check.
  const extra = [];
  for (const route of [2, 3, 5, 6, 7]) for (let tol = 0; tol < 4; tol++) for (const legs of [0, 1]) for (let k = 0; k < 600; k++) {
    const p = { variant: 'point', route, flow: k % 3, speed: Math.floor(k / 3) % 3, tolerance: tol, legs };
    extra.push({ p, it: def.generate(PX.rng(PX.rng.hash('reckon-shortcuts', route, tol, legs, k)), p) });
  }
  const isL = (x) => (L.legCell(L.normParams(x.p)) ? 1 : 0);
  const scRows = shortcutReport(def, items.concat(extra), 'Reckon', { cell: isL, levels: [0, 1, 2, 3] });
  boundShortcuts(t, scRows, []);
  // Where the legs decide (N1 §3.4 #2; PLAN milestone 8's acceptance): turn-only answers right in at most half the
  // items. By construction: each item's two alternatives share its turns and their keys lie more than 2·w + 8°
  // apart, so one answer from the turns (a direction, or a place: it lies within asin(τ) of the key it hits) can
  // be right for one of them only, and which one is shown is a fair coin (checked above, per item). In the
  // sample: every turn-only answer of shortcutReport (equal legs, 180 − ΣT/2, the net-turn prior, back along the
  // leg before the last turn) at most 50 % + 3 standard errors in every /L cell.
  {
    const lRows = scRows.filter((r) => r.legs === 1), worst = { d: -1, s: '' };
    for (const r of lRows) for (const [nm, v] of Object.entries(r.I)) {
      if (nm === 'true direction + average distance') continue; // needs the direction solved: not turn-only
      const lim = 0.5 + 3 * Math.sqrt(0.25 / r.n);
      if (v - lim > worst.d) { worst.d = v - lim; worst.s = `${r.cell} ${nm} ${pct(v)} (limit ${pct(lim)}, n ${r.n})`; }
    }
    t.ok(lRows.length >= 30 && worst.d <= 0, `where the legs decide, turn-only answers ≤ 50 % (+ 3 SE) in every cell (${lRows.length} cells; closest: ${worst.s})`);
    // and on both alternatives at once: never both right for any turn-only direction
    let both = 0, checked = 0;
    for (const x of items.concat(extra)) {
      if (!isL(x)) continue;
      const it = x.it, ret = x.p.variant === 'return', T = sumOf(it.turns), ks = it.alts.map((a) => walk(it.startHeading, a.legs, it.turns).key);
      const halfW = ret ? Math.asin(it.tolerance) * 180 / Math.PI : it.tolerance;
      for (const a of [walk(it.startHeading, it.legs.map(() => 1), it.turns).key, 180 - T / 2, 180 - T, 180 - it.turns.at(-1), 90, 270]) {
        checked++; if (ks.every((k) => adiff(a, k) <= halfW)) both++;
      }
    }
    t.ok(both === 0 && checked > 50000, `no turn-only direction lies within the tolerance of both alternatives (${checked} answer × item pairs)`);
  }
  // RV-play-nav-knots 3: the generator never leaves the level's description (the stage text is the player's)
  {
    const all = items.concat(extra), off = all.filter((x) => { const rt = L.ROUTES[x.p.route], band = L.TURNS[rt.turns], n = rt.legs, R = x.it.turns[n - 1]; return x.it.legs.length !== n || x.it.turns.length !== n || !x.it.turns.slice(0, n - 1).every((v) => Math.abs(v) >= band.lo - 1e-9 && Math.abs(v) <= band.hi + 1e-9) || !(Math.abs(R) >= 30 - 1e-9 && Math.abs(R) <= 150 + 1e-9); });
    t.ok(off.length === 0, `every route matches its level: its number of legs, every turn between legs within its band, and a last turn on the spot of 30–150° (${all.length} items, fallbacks included${off.length ? `; ${off.length} off, first at route ${off[0].p.route}` : ''})`);
    const rots = all.map((x) => x.it.turns.at(-1)), right = rots.filter((v) => v > 0).length / rots.length, big = rots.filter((v) => Math.abs(v) >= 140).length / rots.length;
    t.ok(Math.abs(right - 0.5) < 0.02 && big > 0.05 && big < 0.12, `the turn on the spot goes either way (${pct(right)} clockwise) and is 140° or more in about one route in 12 (${pct(big)})`);
  }
  // time as a cue to leg length (RV S1): above 'steady' a leg's walking time says little about its length.
  // v1.2: where the legs decide, legs span 3–15 m (5 : 1) against speeds of 0.5–2 m/s (4 : 1), so a 3 m leg and a
  // 15 m leg can never take the same time: there time carries part of the length by construction (N1 §3.4 #2;
  // DECISIONS). The bound applies to the other items; the legs-decide items are reported.
  const legTime = (list) => [0, 1, 2].map((lv) => {
      const T = [], Ls = [], Vm = [];
      list.filter((x) => x.p.speed === lv).forEach((x) => {
        let i = 0;
        H.plan(x.it, 0).segs.forEach((sg) => { if (sg.kind === 'walk') { T.push(sg.dur); Ls.push(x.it.legs[i]); Vm.push(x.it.legs[i] / sg.dur); i++; } });
      });
      return { r: pearson(T, Ls), rv: pearson(Vm, Ls), n: T.length };
    });
  {
    const byLevel = legTime(items.filter((x) => !isL(x))), byL = legTime(items.filter((x) => isL(x)));
    t.ok(byLevel[0].r > 0.9 && Math.abs(byLevel[1].r) <= 0.5 && Math.abs(byLevel[2].r) <= 0.5,
      `leg time vs leg length: r ${byLevel.map((b) => b.r.toFixed(2)).join(' / ')} at steady / between legs / within legs (≤ 0.5 above steady; steady keeps one speed); r(mean speed, length) ${byLevel.map((b) => b.rv.toFixed(2)).join(' / ')}; ${byLevel.map((b) => b.n).join(' / ')} legs; where the legs decide (reported): r ${byL.map((b) => b.r.toFixed(2)).join(' / ')}`);
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
  const tm = timeP95((s) => def.generate(PX.rng(9000 + s), { variant: 'return', route: 7, flow: 2, speed: 2, tolerance: 3, legs: 1 }), 400);
  const tm2 = timeP95((s) => def.generate(PX.rng(9500 + s), { variant: 'point', route: 7, flow: 2, speed: 2, tolerance: 3, legs: 0 }), 400);
  t.ok(tm.cpu < 20 && tm2.cpu < 20, `generation p95 < 20 ms at the hardest level (CPU ${tm.cpu.toFixed(2)} ms, wall ${tm.wall.toFixed(2)} ms) and at the slowest cell, 4 large turns at ±15° (CPU ${tm2.cpu.toFixed(2)} ms)`);

  t.section('reckon: validate rejects broken items');
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const baseP = items.find((x) => x.p.variant === 'point' && L.ROUTES[x.p.route].legs === 3 && x.p.speed === 2 && !L.legCell(L.normParams(x.p))).it;
  const baseL = items.find((x) => x.p.variant === 'point' && L.legCell(L.normParams(x.p))).it;
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
  m = clone(baseP); m.turns.pop(); m.turnRates.pop(); rejects('a route without its turn on the spot at the end', m, /turns/);
  m = clone(baseP); m.turns[m.turns.length - 1] = 10; rejects('a turn on the spot of less than 30°', m, /turn on the spot/);
  m = clone(baseL); delete m.alts; rejects('a legs-decide item without its two alternatives', m, /alternatives/);
  m = clone(baseL); m.alts[1 - m.alt].key = norm360(m.alts[1 - m.alt].key + 30); rejects('an alternative whose key does not follow from its legs', m, /follow from its legs/);
  m = clone(baseL); m.alts[1 - m.alt] = clone(m.alts[m.alt]); rejects('two alternatives with the same answer', m, /within/);
  m = clone(baseL); m.alt = 1 - m.alt; rejects('an item that shows another alternative than its legs', m, /does not show/);
  m = clone(baseP); m.alts = clone(baseL.alts); m.alt = 0; rejects('alternatives on an item where the turns tell a lot', m, /only a legs-decide/);
  { // Hand-made: a route whose turns cancel (the turn on the spot included), so "heading not updated" lands on the key.
    const legs = [6, 7, 6], turns = [100, -60, -40], h0 = 10, w = walk(h0, legs, turns), k = Math.round(w.key * 100) / 100 % 360;
    const it = clone(baseP);
    Object.assign(it, { params: Object.assign({}, it.params, { route: 3, speed: 0, tolerance: 0, legs: 0 }), legs, turns, startHeading: h0, key: k, keyDeg: k, tolerance: 40, tolDeg: 40,
      path: w.path.map((q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000]), heading: Math.round(w.heading * 100) / 100 % 360,
      distance: Math.round(w.distance * 1000) / 1000, returnBearing: Math.round(compass(-w.path.at(-1)[0], -w.path.at(-1)[1]) * 100) / 100 % 360, pathLength: 19,
      speeds: [[1.8], [1.8], [1.8]], splits: [null, null, null], turnRates: [45, 45, 45] });
    delete it.alts; delete it.alt;
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
  const cellOf = (x) => `${x.p.variant}/${x.p.route}/${x.p.tolerance}` + (isL(x) ? '/L' : '');
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
  for (const variant of ['point', 'return']) for (const ti of [0, 1, 2, 3]) {
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
  const ret = items.filter((x) => x.p.variant === 'return'), retN = ret.filter((x) => !isL(x)), retL = ret.filter((x) => isL(x));
  const outTime = (it) => it.duration - it.turns.reduce((s, x2, i) => s + Math.abs(x2) / it.turnRates[i] + it.ramp, 0); // time spent walking
  const radial = (list, rOf) => list.filter((x) => Math.abs(rOf(x.it) - x.it.distance) <= x.tol * x.it.distance - 1e-9).length / list.length;
  const bestC = (list, f) => { let b = 0, bc = 0; for (let c = 0.05; c <= 1.5; c += 0.01) { const h2 = radial(list, (it) => c * f(it)); if (h2 > b) { b = h2; bc = c; } } return [b, bc]; };
  const dRows = [];
  for (const sl of [0, 1, 2]) {
    const list = retN.filter((x) => x.p.speed === sl), listL = retL.filter((x) => x.p.speed === sl);
    const lastLeg = radial(list, (it) => it.legs.at(-1));
    const [byPath] = bestC(list, (it) => it.pathLength), [byTime] = bestC(list, (it) => outTime(it)), [fixed] = bestC(list, () => 10);
    const [byTimeL] = bestC(listL, (it) => outTime(it)), [fixedL] = bestC(listL, () => 10);
    // v1.2: per route, each with its own factor and its own fixed distance (the player sees how many legs a route
    // has; since 1.2 the home distance's spread differs more between routes, so one factor over all routes reads
    // the route, not the walk: within routes r(walking time, home distance) stays about 0.1)
    const perRoute = (f) => { let h = 0, n = 0; for (let ri = 0; ri < 8; ri++) { const l = list.filter((x) => x.p.route === ri); if (l.length) { h += bestC(l, f)[0] * l.length; n += l.length; } } return h / n; };
    const byTimeR = perRoute((it) => outTime(it)), fixedR = perRoute(() => 10);
    dRows.push(`speed ${sl}: last leg ${pct(lastLeg)}, ∝ path ${pct(byPath)}, ∝ walking time ${pct(byTime)}, best fixed ${pct(fixed)}, per route ∝ walking time ${pct(byTimeR)} vs fixed ${pct(fixedR)} (where the legs decide: ∝ walking time ${pct(byTimeL)}, best fixed ${pct(fixedL)})`);
    // above 'steady', holding Walk for a multiple of the outbound walking time does no better than one fixed distance
    // per route (v1.2: outside the legs level; there, see the leg-time note above)
    if (sl > 0) t.ok(byTimeR <= fixedR + 0.03, `speed level ${sl}: walking time is no better an odometer than a fixed distance, per route (${pct(byTimeR)} vs ${pct(fixedR)}; over all routes ${pct(byTime)} vs ${pct(fixed)}; where the legs decide, reported: ${pct(byTimeL)} vs ${pct(fixedL)})`);
    const corr = (() => { const a = list.map((x) => outTime(x.it)), b = list.map((x) => x.it.distance), ma = sumOf(a) / a.length, mb = sumOf(b) / b.length;
      let sab = 0, saa = 0, sbb = 0; a.forEach((v2, i) => { sab += (v2 - ma) * (b[i] - mb); saa += (v2 - ma) ** 2; sbb += (b[i] - mb) ** 2; }); return sab / Math.sqrt(saa * sbb); })();
    dRows.push(`r(walking time, home distance) ${corr.toFixed(2)}`);
  }
  report.push(`[info] distance heuristics at the true direction: ${dRows.join('; ')}`);
  // Combined: a direction shortcut with a distance heuristic stays near chance.
  const combos2 = { 'turns reversed + last leg': (it) => at(norm360(180 - sumT(it)), it.legs.at(-1)), 'turn around + half the route': (it) => at(180, it.pathLength / 2) };
  for (const [name, fn] of Object.entries(combos2)) {
    let worst = -1, wc = '';
    for (const ti of [0, 1, 2, 3]) for (let ri = 0; ri < 8; ri++) {
      const l = ret.filter((x) => x.p.tolerance === ti && x.p.route === ri), hh = l.filter((x) => def.score(x.it, fn(x.it)).correct).length / l.length, ch = def.chance({ variant: 'return', tolerance: ti });
      if (hh - ch > worst) { worst = hh - ch; wc = `route ${ri} tol ${ti}: ${pct(hh)} vs ${pct(ch)}`; }
    }
    t.ok(worst <= CHANCE_MARGIN, `${name}: ≤ chance + 10 in every route × tolerance cell (worst ${wc})`);
  }

  t.section('reckon: tutorial items (heading, distance)');
  let tOk = true, tFirst = null;
  const taskItems = [];
  for (let s = 0; s < 1000; s++) {
    const p = { variant: s % 2 ? 'return' : 'point', task: s % 2 ? 'distance' : 'heading', route: 0, flow: s % 3, speed: (s >> 1) % 3, tolerance: (s >> 2) % 3 };
    const it = def.generate(PX.rng(PX.rng.hash('task', s)), p), v = def.validate(it);
    taskItems.push(it);
    let bad = v !== true ? v : null;
    if (!bad && it.params.task !== p.task) bad = 'params.task missing (v1.2 O39: tips are aimed by it)';
    // v1.2 (fresh-player retest): the tutorial rungs move slower than rated items, at every speed level
    if (!bad && it.task === 'heading' && !(it.turnRates.length === 1 && it.turnRates[0] === 30)) bad = 'the tutorial turn is not 30°/s';
    if (!bad && it.task === 'distance' && !(it.speeds[0].length === 1 && it.speeds[0][0] >= 1.08 - 1e-9 && it.speeds[0][0] <= 1.32 + 1e-9)) bad = 'the tutorial walk is not 1.2 m/s ± 10 %';
    if (!bad && it.task === 'heading') {
      if (!def.score(it, norm360(-it.turns[0])).correct || def.score(it, 0).correct || def.score(it, it.turns[0]).correct) bad = 'heading key';
    } else if (!bad) {
      const Ld = it.legs[0];
      if (!def.score(it, { x: 0, z: Ld }).correct || def.score(it, { x: 0, z: 0 }).correct || def.score(it, { x: 0, z: 2 * Ld }).correct || Math.abs(it.walkSpeed - it.speeds[0][0]) < 0.4 - 1e-9) bad = 'distance key or speed';
    }
    if (bad) { tOk = false; tFirst = tFirst || `${JSON.stringify(p)}: ${bad}`; }
  }
  t.ok(tOk, '1 000 tutorial items: valid; heading → turning back by the turn is right, not turning or turning on is wrong; distance → L ahead right, 0 and 2L wrong, the second walk at another speed; slower than rated items (30°/s, 1.2 m/s ± 10 %)' + (tFirst ? ` (${tFirst})` : ''));
  t.ok(def.difficulty({ variant: 'point', task: 'heading' }) === lo, 'a task does not change difficulty (tutorial items are never rated)');

  checkGentle(t, H, items.map((x) => x.it).concat(taskItems), 'reckon');

  t.section('reckon: Try tips fit their items (v1.2 O39)');
  {
    // The player's rule (js/ui/play.js tipFor, as Try calls it): the first tip whose `when` holds, the variant
    // (a name or a list) and the levels of the dim (a dim, or an extra param such as task). Items are made as
    // Try makes them (play.js fillParams). In 1.1, Try 2 (a straight walk) showed "After each turn…".
    const learn = X.learn('reckon');
    const firstTip = (item) => (learn.tips || []).find((tp) => {
      const w = tp.when || {};
      const okV = !w.variant || (Array.isArray(w.variant) ? w.variant : [w.variant]).indexOf(item.params.variant) >= 0;
      const okD = !w.dim || (Array.isArray(w.levels) ? w.levels.indexOf(item.params[w.dim]) >= 0 : item.params[w.dim] !== undefined);
      return (w.variant || w.dim) && okV && okD;
    }) || null;
    const fill = (pp) => {
      const out = {};
      def.dims.forEach((d) => { out[d.key] = Number.isInteger(pp[d.key]) && pp[d.key] >= 0 && pp[d.key] < d.levels.length ? pp[d.key] : 0; });
      out.variant = def.variants.indexOf(pp.variant) >= 0 ? pp.variant : def.variants[0];
      (def.extraParams || []).forEach((k) => { if (pp[k] !== undefined) out[k] = pp[k]; });
      return out;
    };
    const rows = learn.practice.map((pp, i) => { const it = def.generate(PX.rng(PX.rng.hash('try-tip', i)), fill(pp)); return { i, it, tp: firstTip(it) }; });
    const name = (r) => `Try ${r.i + 1}: ${r.tp ? r.tp.id : 'none'}`;
    const turnless = rows.filter((r) => r.it.turns.length === 0), legless = rows.filter((r) => r.it.legs.length === 0);
    t.ok(rows.every((r) => r.tp), `every Try item has a tip (${rows.map(name).join(', ')})`);
    t.ok(turnless.length >= 1 && turnless.every((r) => r.tp && !/\bturn/i.test(r.tp.text)), `a Try item without a turn gets no tip about turns (${turnless.map(name).join(', ')})`);
    t.ok(legless.length >= 1 && legless.every((r) => r.tp && !/\bwalk|\bstart is\b|\blegs?\b/i.test(r.tp.text)), `a turn on the spot gets no tip about walking or where the start is (${legless.map(name).join(', ')})`);
    t.ok(rows.filter((r) => r.it.variant === 'return' || r.it.answer === 'position').filter((r) => !r.it.task).every((r) => r.tp && /Walk/.test(r.tp.text)), 'the first return route of Try explains Walk');
  }

  t.section('reckon: feedback numbers and words (v1.2 O40)');
  {
    // An exact walk never reads "0 % too far"; the drift counts the route plus the walk back (and says so) and
    // comes with this item's own limit in the same unit, which is the scoring rule restated.
    let exact = true, sides = true, drift = true, rule = true, firstBad = null;
    const ret = items.filter((x) => x.p.variant === 'return').slice(0, 3000);
    for (const x of ret) {
      const it = x.it, d = it.distance, K = at(it.keyDeg, d);
      if (typeof L.feedback !== 'function') { exact = sides = drift = false; firstBad = 'lib.feedback is missing'; break; }
      const f0 = L.feedback(it, def.score(it, K));
      if (!f0.dist || f0.dist.word !== 'even' || f0.dist.pct !== 0) exact = false;
      const r1 = def.score(it, at(it.keyDeg + 10, d * 0.8)), f1 = L.feedback(it, r1), f2 = L.feedback(it, def.score(it, at(it.keyDeg, d * 1.07)));
      if (f1.dist.word !== 'short' || f1.dist.pct !== 20 || f2.dist.word !== 'long' || f2.dist.pct !== 7) sides = false;
      const walked = it.pathLength + r1.detail.dist;
      if (!f1.drift || f1.drift.walked !== Math.round(walked) || f1.drift.cm !== Math.round(100 * r1.detail.posErr / walked) || f1.drift.limCm !== Math.round(100 * it.tolerance * d / walked)) {
        drift = false; firstBad = firstBad || `${x.seed}: ${JSON.stringify(f1.drift)}`;
      }
      for (const resp of [K, at(it.keyDeg + 25, d), at(it.keyDeg, d * 0.6), at(it.keyDeg - 8, d * 1.3), at(it.keyDeg + 4, d * 0.9)]) {
        const r = def.score(it, resp), w = it.pathLength + r.detail.dist;
        if ((r.detail.posErr / w <= it.tolerance * d / w + 1e-12) !== r.correct) rule = false;
      }
    }
    t.ok(exact, 'walking back exactly the home distance reads "under 1 % off" (word even), never "0 % too far"');
    t.ok(sides, 'short and too far are named with whole percentages (80 % of the way → 20 % short, 107 % → 7 % too far)');
    t.ok(drift, 'the drift: metres off after the route plus the walk back, cm per metre, and the item\'s limit τ·d over the same metres' + (firstBad ? ` (${firstBad})` : ''));
    t.ok(rule, 'the limit restates the scoring rule: right exactly when the drift per metre is within it');
    const fbk = typeof L.feedback === 'function' ? L.feedback : () => ({ dist: undefined, drift: undefined });
    const pt = items.find((x) => x.p.variant === 'point').it, fp = fbk(pt, def.score(pt, pt.key));
    const dItem = def.generate(PX.rng(5), { variant: 'return', task: 'distance' }), fd = fbk(dItem, def.score(dItem, { x: 0, z: dItem.legs[0] }));
    t.ok(fp.dist === null && fp.drift === null && fd.dist && fd.dist.word === 'even' && fd.drift === null, 'point items have no distance words; the distance task walked exactly reads "under 1 % off" and has no drift line');
    const C = (X.learn('reckon') || {}).captions || {};
    t.ok(C.distEven === 'under 1 % off' && /\{dist\}/.test(C.distanceWas) && /\{dist\}/.test(C.walkedWas) && !/\{dpct\}/.test(C.distanceWas + C.walkedWas) && /\{dpct\} % \{dword\}/.test(C.distOff),
      'the distance words come from one place: "{dpct} % {dword}" or "under 1 % off"');
    t.ok(/the route and your walk back/.test(C.drift) && /\{lim\}/.test(C.drift) && /\{per\}/.test(C.drift) && C.perMetreUnder === 'under 1 cm per metre', 'the drift line says it counts the route and the walk back, names the item\'s limit, and never says "about 0 cm"');
    t.ok(C.mapYou === 'your answer', 'the map labels your answer "your answer", not "you"');
    t.ok(/solid/i.test(C.chartNote) && /hollow/i.test(C.chartNote) && /oldest/.test(C.chartNote) && !/Filled: right/.test(C.chartNote) && ['chartFar', 'chartShort', 'chartOld', 'chartNew'].every((k) => C[k]),
      'the habit chart has axis words (too far, too little, older, latest); its note says solid and hollow, not "Filled: right"');
  }

  t.section('reckon: the player\'s own errors (bias over the last 20 routes)');
  {
    // v1.2 wave 2 (W2-bets' request; CONTRACT-v1.2 conflict 9): the bias line and the habit chart are the
    // calibration-detail arm; the plain arm keeps the answer's own errors
    const sd = L.showDetail, src = readFileSync(new URL('../../js/ex/reckon/view.js', import.meta.url), 'utf8');
    t.ok(typeof sd === 'function' && sd({ layer: 'calib-detail' }) && !sd({ layer: '' }) && !sd({ layer: 'produce' }) && sd({}) && sd(null),
      'the detail shows on calib-detail items and where no layer is passed (the dev harness), not in the plain arm');
    t.ok(def.layers && def.layers.calib === true && /var detail = lib\(\)\.showDetail\(st\.ctx\)/.test(src) && /item\.task \|\| !detail \? '' : biasLine\(\)/.test(src) && /item\.task \|\| !detail \? null : chart\(item\)/.test(src),
      'Reckon hosts the calib layer, and its reveal gates the bias line and the chart on it');
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

/* v1.2 wave 2 (W2-progress): per-item shortcut scores for tests/node/shortcut-levels.test.mjs (homing.test.mjs's
   shortcutReport answers per item: the no-integration ones bounded, return items given the true home distance
   (the most generous case) and, for turning around, the last leg; the turn-only family as information) */
export function shortcutScores(PX, def, it, params) {
  const p = params || it.params || {}, chance = def.chance(p), ret = p.variant === 'return', T = sumOf(it.turns), key = ret ? it.keyDeg : it.key;
  if (!ret && p.variant !== 'point') return {};
  const hit = (a, r, info) => ({ hit: def.score(it, ret ? at(a, r === undefined ? it.distance : r) : norm360(a)).correct ? 1 : 0, chance, info: !!info });
  const out = { 'turn around': hit(180), mirror: hit(360 - key), 'turns reversed': hit(180 - T), 'heading not updated': hit(key + T) };
  if (ret) out['turn around, last leg'] = hit(180, it.legs.at(-1));
  const eq = walk(it.startHeading, it.legs.map(() => (ret ? it.pathLength / it.legs.length : 1)), it.turns);
  out['equal legs'] = hit(eq.key, ret ? eq.distance : undefined, true);
  return out;
}
export const SHORTCUT_EXEMPT = [];
