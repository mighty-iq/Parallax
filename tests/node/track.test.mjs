/* EX-01 Track (js/ex/track/gen.js): definition, deterministic maths, physics, projection, score,
   validate, speedValue, fallback, 10 000+ seeds (validity, key, determinism, positions), shortcut
   solvers by speed third, and generation time at the hardest level (ARCHITECTURE.md §12).
   PX_REPORT=1 prints the measured numbers. */
import { MANIFEST, deepDiff } from './run.mjs';
import { performance } from 'node:perf_hooks';

// Our own context with only the files we need: other exercises' work in progress cannot break it.
const FILES = [...MANIFEST, 'js/ex/track/gen.js', 'js/ex/track/learn.js'];
const REPORT = !!process.env.PX_REPORT;
const SEEDS = 10000; // every one of the 3 312 level × variant combinations at least 3 times
const comb = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };
const q = (arr, f) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const flat = (list) => list.flat();
const say = (...a) => { if (REPORT) console.log('       · track:', ...a); };
const summary = {}; // the two lines printed after every run

export async function run(t) {
  const PX = t.context({ files: FILES }).PX, def = PX.ex.get('track');
  t.ok(!!def, 'track is defined');
  if (!def) return;
  const L = PX.ex.track;
  const PX2 = t.context({ files: FILES }).PX; // loaded separately: determinism across contexts
  testDefinition(t, PX, def, L);
  testEstMs(t, PX, def);
  testLearn(t, PX, def);
  testMaths(t, L);
  testPhysics(t, PX, def, L);
  testProjection(t, PX, def, L);
  testScore(t, PX, def);
  testRejects(t, PX, def, L);
  testSpeedValue(t, PX, def, L);
  testFallback(t, PX, def, L);
  const pool = testSeeds(t, PX, def, L, PX2);
  testShortcuts(t, pool);
  testTiming(t, PX, def);
  const pc = (x) => (100 * x).toFixed(1), th = (name) => summary[name].map((x) => pc(x.acc)).join(' | ');
  console.log(`       track: ${summary.seeds} items (${summary.attempts} attempts each); hardest level generate p95 ${summary.still.pc.toFixed(1)} ms still, ${summary.orbit.pc.toFixed(1)} ms orbit (CPU); validate p95 ${summary.still.pv.toFixed(1)} / ${summary.orbit.pv.toFixed(1)} ms (CPU)`);
  console.log(`       track shortcuts by speed third (low | mid | high; chance ${summary.near.map((x) => pc(x.ch)).join(' | ')} %): nearest start ${th('near')} %, one-to-one ${th('match')} %, moved least ${th('least')} %`);
}

/* ================================================================ definition */
function testDefinition(t, PX, def, L) {
  t.section('definition');
  t.eq([def.id, def.version, def.code, def.name, def.short], ['track', 1, 'EX-01', 'Track', 'Track'], 'id, version, code, names');
  t.eq([...def.abilities], ['AT'], 'ability AT only (attention practice, not visual memory)');
  t.ok(def.cell === null && def.role === 'train' && def.answer === 'targets' && def.perDisplay === true, 'cell null, role train, answer targets, perDisplay');
  t.eq(def.practice, 'attention', 'labelled attention practice');
  t.eq(def.dims.map((d) => d.key), ['speed', 'targets', 'spheres', 'time'], 'dims');
  t.eq(def.dims.map((d) => d.levels.length), [46, 4, 3, 3], 'level counts');
  t.eq(def.dims.slice(1).map((d) => [...d.levels]), [[2, 3, 4, 5], [6, 8, 10], [5, 8, 12]], 'targets, spheres, tracking time');
  t.eq([...def.variants], ['still', 'orbit'], 'variants');
  t.ok(PX.ex.get('track') === def && PX.ex.track === def.lib, 'PX.ex.track is the definition’s lib');
  const sp = def.dims[0].levels;
  let worst = 0;
  sp.forEach((s, i) => { worst = Math.max(worst, Math.abs(s / (0.15 * 10 ** (0.025 * i)) - 1)); });
  t.ok(worst < 5e-6, 'speed levels are 0.15 × 10^(0.025 i) cube widths/s (6 significant digits)');
  t.ok(sp.every((s, i) => i === 0 || s > sp[i - 1]) && sp[0] === 0.15 && Math.abs(sp[45] - 2) < 1e-3, 'speeds rise from 0.15 to 2.0');
  t.near(Math.log10(sp[22] / sp[20]), 0.05, 2e-5, 'two speed levels = one 0.05 log10 staircase step');

  for (let ti = 0; ti < 4; ti++) for (let si = 0; si < 3; si++) {
    const N = [6, 8, 10][si], K = [2, 3, 4, 5][ti];
    t.near(def.chance({ speed: 0, targets: ti, spheres: si, time: 0 }), 1 / comb(N, K), 1e-15, `chance ${K} of ${N} = 1/C(N, K)`);
  }

  // Difficulty: the easiest item about 90 % right at θ = 0; range ≥ 4 logits; speed the main axis.
  const easy = { speed: 0, targets: 0, spheres: 0, time: 0, variant: 'still' };
  const b0 = def.difficulty(easy), g0 = def.chance(easy);
  t.near(g0 + (1 - g0 - 0.03) / (1 + Math.exp(b0)), 0.9, 0.01, 'the easiest item is about 90 % right at θ = 0');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.eq(lo, b0, 'the easiest corner has the lowest difficulty');
  t.ok(hi - lo >= 4, `the range spans at least 4 logits (${(hi - lo).toFixed(2)})`);
  const at = (o) => def.difficulty({ ...easy, ...o });
  const spans = { speed: at({ speed: 45 }) - b0, targets: at({ targets: 3, spheres: 2 }) - at({ spheres: 2 }), spheres: at({ spheres: 2 }) - b0, time: at({ time: 2 }) - b0 };
  t.ok(spans.speed > spans.targets + spans.spheres + spans.time && spans.speed / (hi - lo) > 0.5, 'speed is the main axis (more than half the range)');
  let mono = true;
  for (let i = 1; i < 46; i++) if (!(at({ speed: i }) > at({ speed: i - 1 }))) mono = false;
  t.ok(mono && at({ time: 2 }) > at({ time: 1 }) && at({ time: 1 }) > b0 && at({ spheres: 2 }) > at({ spheres: 1 }), 'difficulty rises with speed, time and spheres');
  t.near(at({ targets: 2 }), at({ targets: 0 }), 1e-12, '4 of 6 is as hard as 2 of 6 (track the 2 others)');
  t.near(at({ targets: 3 }), at({ targets: 0 }), 1e-12, '5 of 6 counts as 2 of 6 (never easier than the easiest level)');
  t.near(at({ targets: 3, spheres: 1 }), at({ targets: 1, spheres: 1 }), 1e-12, '5 of 8 is as hard as 3 of 8');
  t.ok(at({ targets: 3, spheres: 2 }) > at({ targets: 2, spheres: 2 }), 'with 10 spheres each target adds difficulty');
  t.near(at({ variant: 'orbit' }) - b0, L.DIFF.orbit, 1e-12, 'orbit adds a small offset');

  // Standard preset and the speed scale.
  const S = L.STANDARD;
  t.eq([S.spheres, S.targets, S.dur, S.cue, S.variant, S.rule, S.stepLog10, S.stepLevels, S.trials, S.reversals],
    [8, 4, 8, 2, 'still', '1-up/1-down', 0.05, 2, 20, 4], 'Standard: 8 spheres, 4 targets, 8 s, 2 s cue, still, 1-up/1-down in 0.05 log10, 20 trials, last 4 reversals');
  t.ok(PX.ex.validParams(def, S.params) === true, 'Standard params are valid level indices');
  t.eq(PX.ex.decodeParams(def, PX.ex.paramsCode(def, S.params)), { ...S.params }, 'Standard params round-trip through paramsCode');
  const it = def.generate(PX.rng(5), S.params);
  t.eq([it.n, it.k, it.dur, it.cue, it.cam.dir], [8, 4, 8, 2, 0], 'a Standard item has 8 spheres, 4 targets, 8 s, 2 s cue, a still camera');
  t.near(L.levelSpeed(0), 0.15, 1e-15, 'levelSpeed(0) = 0.15');
  t.near(L.levelSpeed(40), 1.5, 1e-14, 'levelSpeed(40) = 1.5 (one decade)');
  let inv = 0;
  for (let x = -10; x <= 60; x += 0.37) inv = Math.max(inv, Math.abs(L.speedLevel(L.levelSpeed(x)) - x));
  t.ok(inv < 1e-11, 'speedLevel inverts levelSpeed (continuous level index x = 40 log10(s / 0.15))');
  t.ok(sp.every((s, i) => L.nearestLevel(s) === i), 'nearestLevel maps every level speed to its index');
  const stp = L.standardParams(0.4321);
  t.eq(stp, { speed: L.nearestLevel(0.4321), targets: 2, spheres: 1, time: 1, variant: 'still', speedValue: 0.4321 }, 'standardParams(s) carries the speed in speedValue');
  t.eq(def.extraParams, ['speedValue'], 'speedValue is a declared extra param (allowed in params, not part of the code)');
  t.eq(PX.ex.paramsCode(def, stp), PX.ex.paramsCode(def, L.codeParams(stp)), 'paramsCode ignores speedValue: the code is the nearest level …');
  t.eq(PX.ex.paramsCode(def, L.codeParams(stp)), PX.ex.paramsCode(def, { ...S.params, speed: L.nearestLevel(0.4321) }), '… and codeParams() gives the same loggable params');
  t.eq(def.timeLimit({}), null, 'the response is untimed');
}

/* ================================================================ trial time */
function testEstMs(t, PX, def) {
  t.section('trial time');
  const L = def.lib, S = L.STANDARD.params;
  t.ok(typeof def.estMs === 'function', 'the definition has estMs(params)');
  t.eq(def.estMs(S), 2000 + 8000 + 1500 + 4 * 700, 'Standard: 2 s cue + 8 s tracking + picking 4 = 14.3 s');
  t.eq(def.estMs({ speed: 0, targets: 0, spheres: 0, time: 0, variant: 'still' }), 2000 + 5000 + 1500 + 2 * 700, 'the easiest item: 9.9 s');
  let grows = true;
  for (let ti = 1; ti < 4; ti++) if (!(def.estMs({ ...S, targets: ti }) > def.estMs({ ...S, targets: ti - 1 }))) grows = false;
  for (let di = 1; di < 3; di++) if (!(def.estMs({ ...S, time: di }) > def.estMs({ ...S, time: di - 1 }))) grows = false;
  t.ok(grows, 'estMs grows with targets and tracking time');
  t.eq([def.estMs({ ...S, speed: 45 }), def.estMs(L.standardParams(0.7))], [def.estMs(S), def.estMs(S)], 'speed (level or continuous) does not change it');
  t.ok(PX.ex.enumerate(def).every((p) => Number.isFinite(def.estMs(p)) && def.estMs(p) > 0), 'a positive number for every combination');
}

/* ================================================================ learn data */
const VIEW_CAPTIONS = ['notice', 'cue', 'track', 'pick', 'full', 'keys', 'keys10', 'keysStim', 'right', 'wrong', 'legend',
  'paused', 'voidJump', 'voidLost', 'voidPaused', 'voidFallback', 'smStart', 'smForward', 'smSwap', 'smClose', 'smToEnd', 'smAll',
  'smCompare', 'dSpheres', 'dTargets', 'dFollow', 'dPick', 'dAnswer'];

function testLearn(t, PX, def) {
  t.section('learn data');
  const L = PX.ex.learn('track');
  t.ok(!!L && typeof L.goal === 'string' && /attention practice/i.test(L.goal), 'a one-line goal that says attention practice');
  t.ok(!!L.goals && def.variants.every((v) => typeof L.goals[v] === 'string'), 'a goal per variant');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text && (!p.variant || def.variants.includes(p.variant))), 'labelled parts');
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1, 'at least one demo');
  for (const d of L.demo || []) {
    t.ok(PX.ex.validParams(def, d.params) === true, `demo params are valid (${JSON.stringify(d.params)})`);
    t.eq(def.difficulty(d.params), PX.ex.minDifficulty(def), 'the demo is at the easiest level');
    const it = def.generate(PX.rng(d.seed), d.params);
    t.ok(def.validate(it) === true && it.params.variant === d.kind && !it.fallback, `demo seed ${d.seed} gives a valid ${d.kind} item`);
  }
  t.ok(Array.isArray(L.practice) && L.practice.length >= 3 && L.practice.length <= 5, '3–5 practice items');
  t.ok(L.practice.every((p) => PX.ex.validParams(def, p) === true), 'practice params are valid');
  t.ok(L.practice.every((p, i) => i === 0 || def.difficulty(p) >= def.difficulty(L.practice[i - 1])), 'practice goes from easy to harder');
  const dims = Object.fromEntries(def.dims.map((d) => [d.key, d.levels.length]));
  const tipOk = (x) => !!(x.id && x.text && x.when) && ((x.when.variant && def.variants.includes(x.when.variant)) ||
    (x.when.dim in dims && Array.isArray(x.when.levels) && x.when.levels.length > 0 && x.when.levels.every((v) => Number.isInteger(v) && v >= 0 && v < dims[x.when.dim])));
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3 && L.tips.every(tipOk), 'tips name real dims and levels, or variants');
  t.eq(new Set(L.tips.map((x) => x.id)).size, L.tips.length, 'tip ids are unique');
  t.eq(L.strategies.map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'each card has a title, text, steps and when');
  t.eq(VIEW_CAPTIONS.filter((k) => typeof (L.captions || {})[k] !== 'string'), [], 'every caption the view uses is there');
  t.ok(/\{list\}/.test((L.captions || {}).dAnswer || '') && /✓/.test((L.captions || {}).dAnswer || ''), "the demo's last caption names the targets ({list}) and their ✓ mark");
  t.ok(typeof L.bridge === 'string' && /improves this task/.test(L.bridge) && /little or no/.test(L.bridge), 'the bridge card carries its limitation line');
  const text = JSON.stringify(L);
  const banned = [/\bIQ\b/, /smarter/i, /master(ed|y)/i, /brain age/i, /neurotracker/i, /stereo|anaglyph/i, /genius/i];
  t.eq(banned.filter((re) => re.test(text)).map(String), [], 'no banned wording (CLAUDE.md rules 2, 10, 12)');
}

/* ================================================================ maths */
function testMaths(t, L) {
  t.section('deterministic maths');
  let ws = 0;
  for (let d = -720; d <= 720; d += 0.25) {
    const [s, c] = L.sincosDeg(d), r = (d * Math.PI) / 180;
    ws = Math.max(ws, Math.abs(s - Math.sin(r)), Math.abs(c - Math.cos(r)));
  }
  t.ok(ws < 1e-14, `sincosDeg matches Math.sin/cos (max error ${ws.toExponential(1)})`);
  t.eq([L.sincosDeg(0), L.sincosDeg(90), L.sincosDeg(-90), L.sincosDeg(450)].map(([s, c]) => [s + 0, c + 0]), [[0, 1], [1, 0], [-1, 0], [1, 0]], 'quadrant angles are exact');
  let we = 0;
  for (let y = -6; y <= 6; y += 0.01) we = Math.max(we, Math.abs(L.expD(y) / Math.exp(y) - 1));
  t.ok(we < 1e-14, `expD matches Math.exp (max relative error ${we.toExponential(1)})`);
}

/* ================================================================ physics */
// A plain reference: every pair at every step, exactly as the header defines one step.
function refSim(item, steps) {
  const n = item.n, H = 1 / 240, LIM = 0.445, s = item.speed, d2m = item.dmin * item.dmin;
  const p = flat(item.p0), v = [], snaps = new Map();
  for (const d of item.d0) { const f = s / Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]); v.push(d[0] * f, d[1] * f, d[2] * f); }
  const mir = (k, w, nx, ny, nz) => {
    const x = v[k] - w * nx, y = v[k + 1] - w * ny, z = v[k + 2] - w * nz, f = s / Math.sqrt(x * x + y * y + z * z);
    v[k] = x * f; v[k + 1] = y * f; v[k + 2] = z * f;
  };
  const total = Math.round(item.dur * 240);
  for (let st = 1; st <= total; st++) {
    for (let a = 0; a < 3 * n; a++) {
      let x = p[a] + v[a] * H;
      if (x > LIM) { x = 2 * LIM - x; v[a] = -v[a]; } else if (x < -LIM) { x = -2 * LIM - x; v[a] = -v[a]; }
      p[a] = x;
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = p[3 * j] - p[3 * i], dy = p[3 * j + 1] - p[3 * i + 1], dz = p[3 * j + 2] - p[3 * i + 2], d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= d2m || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d;
      const vi = v[3 * i] * nx + v[3 * i + 1] * ny + v[3 * i + 2] * nz, vj = v[3 * j] * nx + v[3 * j + 1] * ny + v[3 * j + 2] * nz;
      if (vi <= vj) continue;
      if (vi > 0) mir(3 * i, 2 * vi, nx, ny, nz);
      if (vj < 0) mir(3 * j, 2 * vj, nx, ny, nz);
    }
    if (steps.has(st)) snaps.set(st, [...p]);
  }
  return { end: p, snaps };
}
const hand = (p0, d0, speed, o = {}) => ({ n: p0.length, p0, d0, speed, dmin: 0.2, dur: 1, ...o });
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function testPhysics(t, PX, def, L) {
  t.section('physics');
  // A wall: the overshoot folds back and the component flips.
  let s = L.sim(hand([[0.443, 0, 0]], [[1, 0, 0]], 1.2)).stepTo(1);
  t.ok(Math.abs(s.p[0] - (0.89 - (0.443 + 1.2 / 240))) < 1e-15 && s.v[0] === -1.2 && s.wall === 1, 'a wall folds the overshoot back and flips the velocity');
  // Head-on: both reverse, symmetric to the last bit, never nearer than d_min minus one step's approach.
  s = L.sim(hand([[-0.2, 0, 0], [0.2, 0, 0]], [[1, 0, 0], [-1, 0, 0]], 1));
  let minD = 1;
  for (let k = 0; k < 60; k++) { s.step(); minD = Math.min(minD, s.p[3] - s.p[0]); }
  t.ok(s.v[0] === -1 && s.v[3] === 1 && s.pair === 1 && s.hits[1] === 1, 'a head-on pair bounces once and both reverse');
  t.ok(s.p[0] === -s.p[3] && minD >= 0.2 - 2 / 240 - 1e-12 && minD > 0.11, 'the bounce is symmetric and the spheres never touch');
  // Catching up: only the sphere that closes in is mirrored.
  s = L.sim(hand([[-0.2, 0, 0], [0, 0, 0]], [[1, 0, 0], [0.6, 0.8, 0]], 1));
  for (let k = 0; k < 40 && !s.pair; k++) s.step();
  t.ok(s.pair === 1 && s.v[0] < 0 && Math.abs(s.v[3] - 0.6) < 1e-12 && Math.abs(s.v[4] - 0.8) < 1e-12, 'a sphere moving away is not mirrored when the other catches up');

  // Generated items: the optimised step equals the plain reference bit for bit; speed is constant;
  // positions(t) are a pure function of the item and t; the y-mirror is exact.
  let refOk = 0, speedOk = 0, atOk = 0, mirOk = 0, interpOk = 0;
  const N = 120;
  for (let i = 0; i < N; i++) {
    const p = PX.ex.decodeParams(def, (i * 1381) % PX.ex.count(def));
    const it = def.generate(PX.rng(PX.rng.hash('track-physics', i)), p);
    const r = PX.rng(i), steps = new Set(Array.from({ length: 12 }, () => r.int(1, it.dur * 240)));
    const ref = refSim(it, steps), sim = L.sim(it);
    let ok = same(ref.end, flat(it.end));
    for (const st of [...steps].sort((a, b) => a - b)) { sim.stepTo(st); if (!same([...sim.p], ref.snaps.get(st))) ok = false; }
    if (ok) refOk++;
    sim.stepTo(sim.steps);
    let sp = true;
    for (let k = 0; k < it.n; k++) if (Math.abs(Math.hypot(sim.v[3 * k], sim.v[3 * k + 1], sim.v[3 * k + 2]) - it.speed) > 1e-12 * it.speed) sp = false;
    if (sp) speedOk++;
    // at(): clamps, order independence, interpolation.
    const ts = Array.from({ length: 30 }, () => r.float(-0.5, it.dur + 0.5));
    const A = L.sim(it), B = L.sim(it), fwd = [...ts].sort((a, b) => a - b).map((x) => [x, [...A.at(x)]]);
    const shuffled = r.shuffle(fwd).slice(0, 6); // backwards calls restart the simulation: a subset
    if (shuffled.every(([x, pos]) => same([...B.at(x)], pos)) && shuffled.slice(0, 3).every(([x, pos]) => same(flat(L.positionsAt(it, x)), pos)) &&
      same([...A.at(0)], flat(it.p0)) && same([...A.at(-1)], flat(it.p0)) && same([...A.at(it.dur)], flat(it.end)) && same([...A.at(it.dur + 3)], flat(it.end))) atOk++;
    const k0 = r.int(0, it.dur * 240 - 2), C = L.sim(it).stepTo(k0), s0 = [...C.p], s1 = [...C.stepTo(k0 + 1).p];
    const mid = [...L.sim(it).at((k0 + 0.5) / 240)];
    if (mid.every((x, a) => Math.abs(x - (s0[a] + s1[a]) / 2) < 1e-12)) interpOk++;
    const m = { ...it, p0: it.p0.map((v) => [v[0], -v[1], v[2]]), d0: it.d0.map((v) => [v[0], -v[1], v[2]]) };
    const me = L.sim(m).stepTo(Math.round(it.dur * 240)).p;
    if (it.end.every((v, k) => me[3 * k] === v[0] && me[3 * k + 1] === -v[1] && me[3 * k + 2] === v[2])) mirOk++;
  }
  t.eq(refOk, N, 'the simulator equals the plain every-pair reference bit for bit (end and 12 sampled steps)');
  t.eq(speedOk, N, 'every sphere keeps the item speed');
  t.eq(atOk, N, 'at(t) clamps to the start and end and does not depend on the order of calls');
  t.eq(interpOk, N, 'between steps at(t) interpolates linearly');
  t.eq(mirOk, N, 'mirroring the start in y mirrors the whole trajectory exactly');
}

/* ================================================================ projection */
// The test's own camera (three.js lookAt from camera(az)) and projection.
function frame(cam) {
  const [ex, ey, ez] = cam.eye, el = Math.hypot(ex, ey, ez), z = [ex / el, ey / el, ez / el];
  const xl = Math.hypot(z[2], z[0]), x = [z[2] / xl, 0, -z[0] / xl];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return { e: cam.eye, x, y, z };
}
function proj(F, P) {
  const qv = [P[0] - F.e[0], P[1] - F.e[1], P[2] - F.e[2]], dot = (a) => qv[0] * a[0] + qv[1] * a[1] + qv[2] * a[2];
  const depth = -dot(F.z);
  return [dot(F.x) / depth, dot(F.y) / depth];
}
function minRatio(pr) {
  let best = Infinity;
  for (let i = 0; i < pr.length; i++) for (let j = i + 1; j < pr.length; j++) {
    best = Math.min(best, Math.hypot(pr[i].x - pr[j].x, pr[i].y - pr[j].y) / (pr[i].rad + pr[j].rad));
  }
  return best;
}

function testProjection(t, PX, def, L) {
  t.section('camera and projection');
  const h = 1 / Math.sqrt(1 + 0.45 * 0.45), c0 = L.camera(0), c90 = L.camera(90);
  t.ok(Math.abs(c0.eye[0]) < 1e-15 && Math.abs(c0.eye[1] - 2.5 * 0.45 * h) < 1e-14 && Math.abs(c0.eye[2] - 2.5 * h) < 1e-14, 'camera(0): distance 2.5, elevation atan 0.45, on +z');
  t.ok(Math.abs(c90.eye[0] - 2.5 * h) < 1e-14 && Math.abs(c90.eye[2]) < 1e-14, 'camera(90) is on +x');
  t.eq([c0.target, c0.up], [[0, 0, 0], [0, 1, 0]], 'looks at the origin, up +y');
  // Centres agree with an independent projection; the radius is the smallest circle around the
  // projected centre that holds the whole image (checked against 4 000 points on the sphere).
  const r = PX.rng(31), golden = Math.PI * (3 - Math.sqrt(5));
  let centre = 0, worstOut = 0, worstTight = 1;
  for (let k = 0; k < 40; k++) {
    const az = r.int(0, 359), F = frame(L.camera(az));
    const c = k < 8 ? [[0.445, 0.445, 0.445], [-0.445, -0.445, 0.445], [0.445, -0.445, -0.445], [0, 0, 0]][k % 4] : [r.float(-0.445, 0.445), r.float(-0.445, 0.445), r.float(-0.445, 0.445)];
    const pr = L.project(az, c, 1)[0], pc = proj(F, c);
    centre = Math.max(centre, Math.abs(pr.x - pc[0]), Math.abs(pr.y - pc[1]));
    let far = 0;
    for (let m = 0; m < 4000; m++) {
      const yv = 1 - (2 * (m + 0.5)) / 4000, rr = Math.sqrt(1 - yv * yv), th = golden * m;
      const s = proj(F, [c[0] + L.R * rr * Math.cos(th), c[1] + L.R * yv, c[2] + L.R * rr * Math.sin(th)]);
      far = Math.max(far, Math.hypot(s[0] - pc[0], s[1] - pc[1]));
    }
    worstOut = Math.max(worstOut, far / pr.rad);
    worstTight = Math.min(worstTight, far / pr.rad);
  }
  t.ok(centre < 1e-12, 'projected centres match an independent projection');
  t.ok(worstOut <= 1 + 1e-9, `no point of a sphere's image lies outside its projected radius (max ${worstOut.toFixed(6)})`);
  t.ok(worstTight > 0.99, `the projected radius is tight (the image reaches ${(worstTight * 100).toFixed(2)} % of it)`);
  // validate's projection (sepRatio) agrees with the public one.
  let agree = 0, M = 120;
  for (let k = 0; k < M; k++) {
    const it = def.generate(PX.rng(400 + k), PX.ex.decodeParams(def, (k * 2711) % PX.ex.count(def)));
    const az = L.endAz(it), a = minRatio(L.project(az, flat(it.end), it.n)), b = L.sepRatio(flat(it.end), it.n, az).ratio;
    if (Math.abs(a / b - 1) < 1e-9 && b >= L.SEP) agree++;
  }
  t.eq(agree, M, 'validate’s image-plane check agrees with the generator’s projection (and passes)');
  // A sphere straight behind another along the line of sight is caught.
  const F = frame(L.camera(0)), a0 = [0, 0, 0.2], dir = [a0[0] - F.e[0], a0[1] - F.e[1], a0[2] - F.e[2]], dl = Math.hypot(...dir);
  const b0 = [a0[0] + (dir[0] / dl) * 0.3, a0[1] + (dir[1] / dl) * 0.3, a0[2] + (dir[2] / dl) * 0.3];
  t.ok(L.sepRatio([...a0, ...b0], 2, 0).ratio < 0.01 && !L.viewClear(0, [...a0, ...b0], 2, new Float64Array(6)), 'an occluded pair fails both view checks');
}

/* ================================================================ score */
function testScore(t, PX, def) {
  t.section('score');
  const it = def.generate(PX.rng(11), { speed: 10, targets: 2, spheres: 1, time: 0, variant: 'still' });
  const key = it.key, others = [...Array(it.n).keys()].filter((i) => !key.includes(i));
  t.eq(def.score(it, key), { correct: true, value: 4, detail: { found: key, wrong: [], missed: [] } }, 'the key is right, 4 found');
  const sw = [...key.slice(1), others[0]].sort((a, b) => a - b);
  t.eq(def.score(it, sw), { correct: false, value: 3, detail: { found: key.slice(1), wrong: [others[0]], missed: [key[0]] } }, 'one target swapped is wrong, 3 found');
  t.ok(def.score(it, [...key].reverse()).correct, 'the order of picks does not matter');
  t.eq(def.score(it, [key[0], key[0], key[1], key[2]]).correct, false, 'a repeated pick is not a full answer');
  t.eq(def.score(it, [...key, others[0]]), { correct: false, value: 3, detail: { found: key, wrong: [others[0]], missed: [] } }, 'an extra pick costs one target');
  t.eq(def.score(it, [...Array(it.n).keys()]).value, 0, 'picking every sphere finds nothing');
  t.eq([def.score(it, null).correct, def.score(it, null).value, def.score(it, [-1, 99, 'a', 1.5]).value, def.score(it, []).value], [false, 0, 0, 0], 'malformed responses score 0');
}

/* ================================================================ validate rejects */
function testRejects(t, PX, def, L) {
  t.section('validate rejects broken items');
  const base = def.generate(PX.rng(21), { speed: 20, targets: 2, spheres: 1, time: 1, variant: 'orbit' });
  t.eq(def.validate(base), true, 'the base item is valid');
  const cases = [
    ['a non-object', () => null, /not an object/],
    ['another exercise', (x) => { x.ex = 'rotate'; }, /ex/],
    ['speedValue inside params', (x) => { x.params.speedValue = 0.3; }, /unknown/],
    ['a level out of range', (x) => { x.params.spheres = 3; }, /level index/],
    ['n that does not follow params', (x) => { x.n = 10; }, /follow/],
    ['a changed speed', (x) => { x.speed *= 1.01; }, /follow/],
    ['a changed d_min', (x) => { x.dmin = 0.15; }, /constants/],
    ['a still camera in an orbit item', (x) => { x.cam.dir = 0; }, /variant/],
    ['a fractional azimuth', (x) => { x.cam.az = 10.5; }, /az/],
    ['another camera distance', (x) => { x.cam.dist = 3; }, /reference camera/],
    ['a missing sphere', (x) => { x.p0.pop(); }, /finite/],
    ['NaN in a direction', (x) => { x.d0[2][1] = NaN; }, /finite/],
    ['a start outside the volume', (x) => { x.p0[0][0] = 0.47; }, /outside/],
    ['two starts nearer than d_min', (x) => { x.p0[1] = [x.p0[0][0] * 0.5, x.p0[0][1] * 0.5, x.p0[0][2] * 0.5 + 0.05]; x.p0[0] = [x.p0[1][0], x.p0[1][1], x.p0[1][2] - 0.1]; }, /closer than d_min/],
    ['a zero direction', (x) => { x.d0[0] = [0, 0, 0]; }, /too short/],
    ['an end state off by 1e-12', (x) => { x.end[3][2] += 1e-12; }, /re-simulation/],
    ['a wrong encounter count', (x) => { x.enc += 1; }, /enc/],
    ['a repeated target', (x) => { x.key[1] = x.key[0]; }, /distinct/],
    ['an unsorted key', (x) => { x.key.reverse(); }, /distinct and sorted/],
    ['a target out of range', (x) => { x.key[x.key.length - 1] = x.n; }, /range/],
    ['too few targets', (x) => { x.key.pop(); }, /ids/],
    ['a bad fallback flag', (x) => { x.fallback = 'yes'; }, /fallback/],
  ];
  for (const [what, f, re] of cases) {
    const x = JSON.parse(JSON.stringify(base)), y = f(x), got = def.validate(y === undefined ? x : y);
    t.ok(typeof got === 'string' && re.test(got), `validate rejects ${what}` + (typeof got === 'string' ? ` (${got})` : ' (it passed)'));
  }
  // An occluded cue: one sphere moved straight behind another, end and encounters recomputed.
  let caught = null;
  for (let k = 0; k < 40 && caught === null; k++) {
    const x = def.generate(PX.rng(900 + k), { speed: 5, targets: 0, spheres: 0, time: 0, variant: 'still' });
    const e = L.camera(x.cam.az).eye, a = x.p0[0], d = [a[0] - e[0], a[1] - e[1], a[2] - e[2]], dl = Math.hypot(...d);
    for (const s of [0.25, -0.25]) {
      const b = a.map((v, i) => v + (d[i] / dl) * s);
      if (b.some((v) => Math.abs(v) > 0.445)) continue;
      const y = JSON.parse(JSON.stringify(x));
      y.p0[1] = b;
      if (y.p0.some((p, i) => i !== 1 && Math.hypot(p[0] - b[0], p[1] - b[1], p[2] - b[2]) < y.dmin)) continue;
      const sim = L.sim(y).stepTo(Math.round(y.dur * 240));
      y.end = L.nested(sim.p, y.n);
      y.enc = L.tdBounces(sim.hits, y.n, y.key);
      caught = def.validate(y);
      break;
    }
  }
  t.ok(typeof caught === 'string' && /cue view/.test(caught), 'validate rejects an occluded cue' + (typeof caught === 'string' ? ` (${caught})` : ''));
  // The per-step checks: spheres passing through each other, a sphere outside, NaN.
  const two = (o) => L.sim({ n: 2, p0: [[-0.2, 0, 0], [0.2, 0, 0]], d0: [[1, 0, 0], [-1, 0, 0]], speed: 1, dmin: 0.2, dur: 1, ...o });
  const ghost = two();
  ghost.dmin = 0; ghost.dmin2 = 0; // no bounces: they pass through each other
  t.ok(/overlap/.test(L.runChecked(ghost)), 'the step check catches overlapping spheres');
  const out = two();
  out.p0[0] = 2; out.reset();
  t.ok(/leaves the volume/.test(L.runChecked(out)), 'the step check catches a sphere outside the volume');
  const nan = two();
  nan.v0[1] = NaN; nan.reset();
  t.ok(/not finite/.test(L.runChecked(nan)), 'the step check catches NaN');
  t.eq(L.runChecked(two()), '', 'a clean head-on bounce passes the step check');
}

/* ================================================================ continuous speed */
function testSpeedValue(t, PX, def, L) {
  t.section('continuous speed (Threshold mode)');
  let ok = 0, settled = 0, coded = 0, regen = 0, firstBad = null;
  const M = 216;
  for (let i = 0; i < M; i++) {
    const p = PX.ex.decodeParams(def, (i * 977) % PX.ex.count(def));
    const sv = L.levelSpeed(PX.rng(PX.rng.hash('track-sv', i)).float(-12, 62)); // past both ends: clamped
    const it = def.generate(PX.rng(i), { ...p, speedValue: sv });
    const want = Math.min(L.SPEED_MAX, Math.max(L.SPEED_MIN, sv));
    const v = def.validate(it);
    if (v === true) ok++; else if (!firstBad) firstBad = v;
    if (it.speed === want && it.speedValue === want && !('speedValue' in it.params) && it.params.speed === L.nearestLevel(want)) settled++;
    try { PX.ex.paramsCode(def, it.params); coded++; } catch { /* counted below */ }
    if (deepDiff(def.generate(PX.rng(i), { ...it.params, speedValue: it.speedValue }), it) === null) regen++;
  }
  t.eq(ok, M, 'items with a continuous speed are valid' + (firstBad ? ` (${firstBad})` : ''));
  t.eq(settled, M, 'the speed is clamped to [SPEED_MIN, SPEED_MAX] and stored in item.speed and item.speedValue; params.speed is the nearest level');
  t.eq(coded, M, 'item.params of such items pass paramsCode');
  t.eq(regen, M, 'item.params plus item.speedValue regenerate the same item');
  const S = L.STANDARD.params, d = (o) => def.difficulty({ ...S, ...o });
  let dd = 0;
  for (let i = 0; i < 46; i++) dd = Math.max(dd, Math.abs(d({ speedValue: L.SPEEDS[i] }) - d({ speed: i })));
  t.ok(dd < 1e-4, 'difficulty at a level’s speed equals the level’s difficulty');
  t.near(d({ speedValue: L.levelSpeed(12.5) }), (d({ speed: 12 }) + d({ speed: 13 })) / 2, 1e-9, 'a speed between levels gets the difficulty in between');
}

/* ================================================================ fallback */
function testFallback(t, PX, def, L) {
  t.section('fallback');
  const speeds = [{ speed: 0 }, { speed: 15 }, { speed: 30 }, { speed: 45 }, { speedValue: L.SPEED_MIN }, { speedValue: L.SPEED_MAX }, { speedValue: 1.234567 }];
  let ok = 0, flagged = 0, total = 0, firstBad = null;
  for (const variant of ['still', 'orbit']) for (let ti = 0; ti < 4; ti++) for (let si = 0; si < 3; si++) for (let di = 0; di < 3; di++) {
    for (const sp of speeds) {
      const it = L.fallback(PX.rng(PX.rng.hash('track-fallback', total)), L.resolve({ speed: 0, targets: ti, spheres: si, time: di, variant, ...sp }));
      total++;
      const v = def.validate(it);
      if (v === true) ok++; else if (!firstBad) firstBad = v;
      if (it.fallback === true && it.enc === 0) flagged++;
    }
  }
  t.eq(ok, total, `every fallback item is valid (${total}: all 72 combinations × 7 speeds)` + (firstBad ? ` (${firstBad})` : ''));
  t.eq(flagged, total, 'fallback items are flagged and have no encounters');
}

/* ================================================================ seeds */
function shortcutRow(it) {
  const n = it.n, K = it.k, P0 = it.p0, E = it.end, isT = new Set(it.key);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const all = [...Array(n).keys()];
  // (1) the K spheres whose end positions are nearest any target's start position
  const near = all.map((j) => [Math.min(...it.key.map((k) => dist(E[j], P0[k]))), j]).sort((a, b) => a[0] - b[0]).slice(0, K).map((x) => x[1]);
  // (1b) the same as a one-to-one matching: closest (target start, end position) pairs first
  const pairs = [];
  for (const k of it.key) for (const j of all) pairs.push([dist(E[j], P0[k]), k, j]);
  pairs.sort((a, b) => a[0] - b[0]);
  const usedT = new Set(), usedJ = new Set(), match = [];
  for (const [, k, j] of pairs) if (!usedT.has(k) && !usedJ.has(j)) { usedT.add(k); usedJ.add(j); match.push(j); }
  // (2) the K spheres that moved least (start to end)
  const least = all.map((j) => [dist(E[j], P0[j]), j]).sort((a, b) => a[0] - b[0]).slice(0, K).map((x) => x[1]);
  const hit = (set) => set.every((j) => isT.has(j));
  return {
    third: it.params.speed < 15 ? 0 : it.params.speed < 30 ? 1 : 2, chance: 1 / comb(n, K),
    near: hit(near), match: hit(match), least: hit(least), cell: `${K} of ${n}, ${it.dur} s`, enc: it.enc,
  };
}

function testSeeds(t, PX, def, L, PX2) {
  t.section(`${SEEDS} seeds`);
  const def2 = PX2.ex.get('track'), L2 = PX2.ex.track, total = PX.ex.count(def), pool = [];
  let threw = 0, invalid = 0, keyOk = 0, swapOk = 0, detItem = 0, detPos = 0, json = 0, jsonN = 0, firstBad = null;
  const fb0 = L.stats.fallbacks, att0 = L.stats.attempts, levels = {};
  def.dims.forEach((dm) => { levels[dm.key] = new Set(); });
  levels.variant = new Set();
  const t0 = performance.now();
  for (let i = 0; i < SEEDS; i++) {
    const p = PX.ex.decodeParams(def, i % total), seed = PX.rng.hash('track-seed', i);
    for (const k in levels) levels[k].add(p[k]);
    let it;
    try { it = def.generate(PX.rng(seed), p); } catch (e) { threw++; if (!firstBad) firstBad = `#${i} threw ${e.message}`; continue; }
    const v = def.validate(it);
    if (v !== true) { invalid++; if (!firstBad) firstBad = `#${i}: ${v}`; continue; }
    if (def.score(it, it.key).correct) keyOk++;
    const r = PX.rng(seed ^ 0x5bd1e995), others = [...Array(it.n).keys()].filter((k) => !it.key.includes(k));
    const sw = it.key.slice();
    sw[r.int(0, sw.length - 1)] = others[r.int(0, others.length - 1)];
    const sc = def.score(it, sw.sort((a, b) => a - b));
    if (!sc.correct && sc.value === it.k - 1) swapOk++;
    // The same seed in the separately loaded context: the same item and the same positions at 50 times.
    const it2 = def2.generate(PX2.rng(seed), p);
    if (deepDiff(it2, it) === null) detItem++;
    const ts = Array.from({ length: 50 }, () => r.float(0, it.dur)).sort((a, b) => a - b), A = L.sim(it), B = L2.sim(it2);
    let posSame = true;
    for (const x of ts) {
      const a = A.at(x), b = B.at(x);
      for (let k = 0; k < a.length && posSame; k++) if (a[k] !== b[k]) posSame = false;
    }
    if (posSame) detPos++;
    if (i % 10 === 0) { jsonN++; if (def.validate(JSON.parse(JSON.stringify(it))) === true) json++; }
    pool.push(shortcutRow(it));
  }
  const ms = performance.now() - t0;
  t.ok(Object.values(levels).every((s, i) => s.size === [46, 4, 3, 3, 2][i]), 'every level of every dim and both variants are covered');
  t.eq(threw, 0, 'generate never throws' + (firstBad ? ` (${firstBad})` : ''));
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad ? ` (${firstBad})` : ''));
  t.eq(keyOk, SEEDS, 'the key scores right');
  t.eq(swapOk, SEEDS, 'the key with one target swapped for a distractor scores wrong (K − 1 found)');
  t.eq(detItem, SEEDS, 'the same seed gives the identical item (in a separately loaded context)');
  t.eq(detPos, SEEDS, 'and identical positions at 50 sampled times');
  t.eq(json, jsonN, 'items survive a JSON round trip (every 10th checked)');
  t.eq(L.stats.fallbacks - fb0, 0, 'the fallback was never needed');
  say(`${SEEDS} seeds in ${(ms / 1000).toFixed(1)} s; ${((L.stats.attempts - att0) / SEEDS).toFixed(2)} attempts per item`);
  summary.seeds = SEEDS;
  summary.attempts = ((L.stats.attempts - att0) / SEEDS).toFixed(2);
  return pool;
}

/* ================================================================ shortcut solvers */
function testShortcuts(t, pool) {
  t.section('shortcut solvers');
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length, pct = (x) => (100 * x).toFixed(1) + ' %';
  const names = { near: 'nearest the targets’ starts', match: 'nearest, one-to-one', least: 'moved least' };
  for (const name of Object.keys(names)) {
    const row = [0, 1, 2].map((th) => {
      const rs = pool.filter((x) => x.third === th);
      return { acc: mean(rs.map((x) => (x[name] ? 1 : 0))), ch: mean(rs.map((x) => x.chance)), n: rs.length };
    });
    for (const th of [1, 2]) {
      t.ok(row[th].acc <= row[th].ch + 0.1, `"${names[name]}" is at most chance + 10 points in speed third ${th + 1}: ${pct(row[th].acc)} vs chance ${pct(row[th].ch)}`);
    }
    say(`shortcut "${names[name]}" by speed third (levels 0–14 | 15–29 | 30–45): ` + row.map((x) => `${pct(x.acc)} (chance ${pct(x.ch)})`).join(' | '));
    summary[name] = row;
  }
  // The cell where nearest-start does best above the lowest third (information only).
  const cells = {};
  for (const x of pool) {
    if (x.third === 0) continue;
    const c = cells[x.cell] || (cells[x.cell] = { n: 0, hit: 0, ch: x.chance });
    c.n++; if (x.near) c.hit++;
  }
  const worst = Object.entries(cells).map(([k, c]) => [k, c.hit / c.n - c.ch]).sort((a, b) => b[1] - a[1])[0];
  if (worst) say(`largest excess of "nearest" above the lowest third: ${worst[0]}, ${(100 * worst[1]).toFixed(1)} points over chance`);
  const enc = [0, 1, 2].map((th) => mean(pool.filter((x) => x.third === th).map((x) => x.enc)).toFixed(1));
  say(`target–distractor bounces per trial by speed third: ${enc.join(' | ')}`);
}

/* ================================================================ timing */
function testTiming(t, PX, def) {
  t.section('generation time');
  // CPU time is the generator's own cost; wall time also counts other processes on the machine.
  for (const variant of ['still', 'orbit']) {
    const p = { speed: 45, targets: 3, spheres: 2, time: 2, variant }; // the hardest level
    for (let s = 0; s < 20; s++) def.generate(PX.rng(7e6 + s), p);
    const wall = [], cpu = [], val = [];
    for (let s = 0; s < 200; s++) {
      const c0 = process.cpuUsage(), w0 = performance.now();
      const it = def.generate(PX.rng(PX.rng.hash('track-time', variant, s)), p);
      wall.push(performance.now() - w0);
      const cu = process.cpuUsage(c0);
      cpu.push((cu.user + cu.system) / 1000);
      const v0 = process.cpuUsage();
      def.validate(it);
      const vu = process.cpuUsage(v0);
      val.push((vu.user + vu.system) / 1000);
    }
    const pc = q(cpu, 0.95), pw = q(wall, 0.95), pv = q(val, 0.95);
    summary[variant] = { pc, pw, pv };
    t.ok(pc < 20, `generate p95 under 20 ms at the hardest level, ${variant}: ${pc.toFixed(1)} ms CPU (${pw.toFixed(1)} ms wall)`);
    say(`hardest level (2.0 cw/s, 5 of 10, 12 s, ${variant}): generate p50 ${q(wall, 0.5).toFixed(1)} / p95 ${pw.toFixed(1)} ms wall, p95 ${pc.toFixed(1)} ms CPU; validate p50 ${q(val, 0.5).toFixed(1)} / p95 ${pv.toFixed(1)} ms CPU`);
  }
}
