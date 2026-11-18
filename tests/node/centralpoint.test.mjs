/* EX-20 Central Point: definition, generator, independent validator, scorer, shortcut solvers, timing,
   tutorial items, the grading model's helpers and the learn data (ARCHITECTURE.md §5, §12;
   docs/research/v1.2/C1-central-point.md §3–§5; PLAN.md milestone 8).
   Items per rated cell: PX_TEST_ITEMS (default 10 000) in the quick form, a tenth in the exact form.
   The shortcut table (C1 §4) is printed per cell: first-order picks (excluded by construction), the
   second-order guesses bounded at chance + 10 points, and partial skill reported, not bounded (PLAN.md
   Defaults: "nudge the average towards the group" is a scoped exception, monitored per level). */
import { performance } from 'node:perf_hooks';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = ['js/core/px.js', 'js/core/util.js', 'js/core/rng.js', 'js/core/bus.js', 'js/ex/registry.js', 'js/ex/centralpoint/gen.js'];
const N = 13, NP = 169, F = 2;
const pct = (x, d = 1) => (100 * x).toFixed(d);
const hyp = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const idxOf = (x, z) => z * N + x;
const xzOf = (q) => [q % N, Math.floor(q / N)];
const clampN = (v) => Math.max(0, Math.min(N - 1, v));
const snap1 = (x, z) => idxOf(clampN(Math.round(x)), clampN(Math.round(z)));
function ring(q, r) {
  const [x, z] = xzOf(q), out = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const X = x + dx, Z = z + dz;
    if (X >= 0 && Z >= 0 && X < N && Z < N) out.push(idxOf(X, Z));
  }
  return out;
}
function cpuP95(fn, n) {
  const cpu = [];
  for (let i = 0; i < n; i++) { const c0 = process.cpuUsage(); fn(i); const c1 = process.cpuUsage(c0); cpu.push((c1.user + c1.system) / 1000); }
  cpu.sort((a, b) => a - b);
  return cpu[Math.floor(n * 0.95)];
}
// Guesses that read only the targets (C1 §4.1), each a single answer point.
function meanOf(T) { return [T.reduce((s, t) => s + t[0], 0) / T.length, T.reduce((s, t) => s + t[1], 0) / T.length]; }
function denseCentre(T, r) {
  let best = null;
  for (const t of T) {
    const mem = T.filter((o) => hyp(t, o) <= r + 1e-9), s = mem.reduce((a, o) => a + hyp(t, o), 0);
    if (!best || mem.length > best.n || (mem.length === best.n && s < best.s - 1e-9)) best = { n: mem.length, s, c: meanOf(mem) };
  }
  return best.c;
}
function farthestFromMean(T) { const m = meanOf(T); let f = T[0]; for (const t of T) if (hyp(t, m) > hyp(f, m)) f = t; return f; }
function oneWeiszfeldStep(T) {
  const m = meanOf(T); let x = 0, z = 0, w = 0;
  for (const t of T) { const d = Math.max(1e-9, hyp(t, m)); x += t[0] / d; z += t[1] / d; w += 1 / d; }
  return [x / w, z / w];
}

export async function run(t) {
  const hasLearn = existsSync(path.join(t.root, 'js/ex/centralpoint/learn.js'));
  const ctx = t.context({ files: hasLearn ? [...BASE, 'js/ex/centralpoint/learn.js'] : BASE });
  const PX = ctx.PX, X = PX.ex, def = X.get('centralpoint');
  t.section('centralpoint: definition');
  t.eq(ctx.loadErrors, [], 'gen.js (and learn.js) load without errors');
  if (!t.ok(def, 'centralpoint is defined')) return;
  const L = def.lib;
  t.eq([def.code, def.version, def.abilities, def.cell, def.role, def.answer, def.perDisplay, def.bet], ['EX-20', 1, ['LE', 'Vz'], 'extrinsic-static', 'train', 'point', false, 'calibrate'], 'code, version, abilities, cell, role, answer (point), perDisplay, bet');
  t.eq([def.trainVariants, def.pace && def.pace.variants, typeof def.roundScore], [['quick'], ['quick'], 'function'], 'automatic choices use the quick form only; it carries the pace deadline and a round score (CONTRACT-v1.2 A, E)');
  t.ok(def.pace.minMs <= def.pace.startMs && def.pace.startMs <= def.pace.maxMs && def.pace.target === 0.85, `pace: start ${def.pace.startMs} ms, ${def.pace.minMs}–${def.pace.maxMs} ms, 85 % in time, step ${def.pace.step}`);
  t.eq([def.name, def.short, def.variants, def.extraParams], ['Central Point', 'Central Point', ['quick', 'exact'], ['task']], 'name, variants quick (first: the default) and exact, task as an extra param');
  t.eq(def.dims.map((d) => [d.key, d.levels]), [['targets', [4, 5, 6, 7, 8]], ['band', [1, 0.5, 0.25]]], 'dims: targets 4–8 × band 1 / 0.5 / 0.25 % (15 cells)');
  t.eq([L.DOTS, L.N, L.BANDS, L.TRAP], [7, 13, [0.01, 0.005, 0.0025], 1], 'a 7 × 7 dot board, 13 × 13 answers, the bands as shares, trap 1 dot');
  let modelOk = true;
  for (const p of X.enumerate(def)) {
    const want = 0.25 * p.targets + 0.6 * p.band + (p.variant === 'exact' ? -0.6 : 0);
    if (Math.abs(def.difficulty(p) - want) > 1e-12) modelOk = false;
  }
  t.ok(modelOk, 'difficulty: 0 + 0.25 per extra target + 0.6 per band level, exact 0.6 easier (provisional, C1 §3.2)');
  t.ok(Math.abs(X.minDifficulty(def) + 0.6) < 1e-12 && Math.abs(X.maxDifficulty(def) - 2.2) < 1e-12, `range −0.6 to 2.2 (${X.minDifficulty(def)} to ${X.maxDifficulty(def)}); 2.2 logits per form, short of 4 (logged as provisional)`);
  t.ok([0, 1, 2].every((b) => def.chance({ band: b, targets: 0 }) === L.CHANCE[b]), 'chance by band: ' + L.CHANCE.map((c) => pct(c, 2) + ' %').join(', '));
  t.ok(X.enumerate(def).every((p) => Number.isFinite(def.estMs(p)) && def.estMs(p) >= 5000) && def.timeLimit({}) === null, 'estMs for every cell; no params-based time limit (the quick deadline is per player)');
  t.eq(X.validParams(def, { variant: 'quick', targets: 0, band: 0, task: 'watch' }), true, 'a tutorial task is a valid extra param');

  /* ---------------------------------------------------------------- rated items */
  const ITEMS = Number(process.env.PX_TEST_ITEMS) > 0 ? Number(process.env.PX_TEST_ITEMS) : 10000;
  t.section(`centralpoint: ${ITEMS} items per rated cell (quick), ${Math.ceil(ITEMS / 10)} (exact)`);
  const rows = [], timing = [];
  let thrown = 0, invalid = 0, firstInvalid = null, keyWrong = 0, jsonBad = 0, detBad = 0, fallbacks = 0, scoreDisagree = 0, outsideRight = 0;
  let v2Missing = 0, v2KeyOff = 0, creditBad = 0, firstPickHits = 0, pickDisagree = 0, wrongForm = 0;
  for (const variant of ['quick', 'exact']) for (let b = 0; b < 3; b++) for (let ti = 0; ti < 5; ti++) {
    const p = { variant, targets: ti, band: b }, n = variant === 'quick' ? ITEMS : Math.ceil(ITEMS / 10), band = L.BANDS[b], k = L.TARGETS[ti];
    const z = { chance: 0, bandPts: 0, keyFreq: new Float64Array(NP), nbAvg: 0, ring2: 0, parity: 0, betweenKeys: 0, dense15: 0, dense2: 0,
      w1: 0, toward: [0, 0, 0, 0], away: [0, 0, 0, 0], obs03: 0, obs05: 0, avgUser: 0, crKey: [], fam: {} };
    const cpu = [];
    const obsRng = PX.rng(PX.rng.hash('centralpoint-observers', variant, b, ti));
    for (let s = 0; s < n; s++) {
      const seed = PX.rng.hash('centralpoint-test', variant, ti, b, s);
      let it;
      const c0 = process.cpuUsage();
      try { it = def.generate(PX.rng(seed), p); } catch (e) { thrown++; continue; }
      const c1 = process.cpuUsage(c0); cpu.push((c1.user + c1.system) / 1000);
      if (it.fallback) fallbacks++;
      if (it.form !== variant) wrongForm++;
      const v = def.validate(it);
      if (v !== true) { invalid++; if (!firstInvalid) firstInvalid = `${variant}/${k}/${band}/${s}: ${v}`; continue; }
      const sk = def.score(it, it.key);
      if (!sk.correct) keyWrong++;
      const j = JSON.parse(JSON.stringify(it));
      if (def.validate(j) !== true || JSON.stringify(def.score(j, it.key)) !== JSON.stringify(sk)) jsonBad++;
      if (s % 25 === 0 && JSON.stringify(def.generate(PX.rng(seed), p)) !== JSON.stringify(it)) detBad++;
      // the grading model, once: band membership, and score() on the band and three other points
      const sol = L.solve(it), E = sol.S.map((s2) => s2 / sol.best - 1), inB = (q) => E[q] <= band;
      const others = [];
      for (let u = 0; u < 3; u++) others.push(obsRng.int(0, NP - 1));
      for (const q of sol.band.concat(others)) {
        const r = def.score(it, { x: q % N, y: Math.floor(q / N) });
        if (r.correct !== inB(q)) scoreDisagree++;
        if (Math.abs(r.detail.credit - L.credit(E[q], band)) > 1e-12) creditBad++;
      }
      // the nearest point outside the band scores wrong but keeps most of its credit
      let out = -1;
      for (let q = 0; q < NP; q++) if (!inB(q) && (out < 0 || E[q] < E[out])) out = q;
      const ro = def.score(it, { x: out % N, y: Math.floor(out / N) });
      if (ro.correct) outsideRight++;
      // the correction ratio is logged on every rated item; near 1 at the key
      if (!Number.isFinite(sk.value2)) v2Missing++;
      else { z.crKey.push(sk.value2); if (sk.value2 < 0.3 || sk.value2 > 1.7) v2KeyOff++; }
      // shortcut picks: the validator's (by name) must all miss; the generator's agree with them
      const P = L.picks(it.targets), fast = L.picksFast(it.targets, L.mean(it.targets));
      const all = new Set(Object.values(P).flat());
      if ([...all].some(inB)) firstPickHits++;
      if (fast.some((q) => !all.has(q)) || [...all].some((q) => fast.indexOf(q) < 0)) pickDisagree++;
      // second-order and partial-skill guesses
      const T = it.targets, m = meanOf(T), mPick = snap1(m[0], m[1]);
      z.bandPts += sol.band.length; z.chance += sol.band.length / NP;
      for (const q of sol.band) z.keyFreq[q]++;
      const r1 = ring(mPick, 1), r2 = ring(mPick, 2);
      z.nbAvg += r1.filter(inB).length / r1.length;
      z.ring2 += r2.filter(inB).length / r2.length;
      const between = sol.band.filter((q) => (q % N) % 2 || Math.floor(q / N) % 2).length;
      z.parity += between / 120;
      const [kx, kz] = [it.key.x, it.key.y];
      if (kx % 2 || kz % 2) z.betweenKeys++;
      const d15 = denseCentre(T, 3), d2 = denseCentre(T, 4);
      if (inB(snap1(d15[0], d15[1]))) z.dense15++;
      if (inB(snap1(d2[0], d2[1]))) z.dense2++;
      const w1 = oneWeiszfeldStep(T);
      if (inB(snap1(w1[0], w1[1]))) z.w1++;
      const dc = denseCentre(T, 2), far = farthestFromMean(T), dd = hyp(dc, m), fd = hyp(far, m);
      for (let sh = 1; sh <= 4; sh++) {
        const tw = dd < 1e-9 ? mPick : snap1(m[0] + sh * (dc[0] - m[0]) / dd, m[1] + sh * (dc[1] - m[1]) / dd);
        const aw = fd < 1e-9 ? mPick : snap1(m[0] - sh * (far[0] - m[0]) / fd, m[1] - sh * (far[1] - m[1]) / fd);
        if (inB(tw)) z.toward[sh - 1]++;
        if (inB(aw)) z.away[sh - 1]++;
      }
      const g = it.gm;
      if (inB(snap1(g[0] + 0.3 * F * obsRng.normal(), g[1] + 0.3 * F * obsRng.normal()))) z.obs03++;
      if (inB(snap1(g[0] + 0.5 * F * obsRng.normal(), g[1] + 0.5 * F * obsRng.normal()))) z.obs05++;
      if (inB(snap1(m[0] + 0.3 * F * obsRng.normal(), m[1] + 0.3 * F * obsRng.normal()))) z.avgUser++;
      z.fam[it.fam] = (z.fam[it.fam] || 0) + 1;
    }
    cpu.sort((a, c) => a - c);
    const p95 = cpu[Math.floor(cpu.length * 0.95)], mean = cpu.reduce((a, c) => a + c, 0) / cpu.length;
    timing.push({ variant, k, band, p95, mean, max: cpu[cpu.length - 1] });
    const ch = z.chance / n;
    rows.push({
      variant, k, band, n, chance: ch, bandPts: z.bandPts / n, fixed: Math.max(...z.keyFreq) / n, nbAvg: z.nbAvg / n, ring2: z.ring2 / n,
      parity: z.parity / n, between: z.betweenKeys / n, dense15: z.dense15 / n, dense2: z.dense2 / n, w1: z.w1 / n,
      toward: z.toward.map((c) => c / n), away: z.away.map((c) => c / n), obs03: z.obs03 / n, obs05: z.obs05 / n, avgUser: z.avgUser / n,
      crKey: z.crKey.sort((a, c) => a - c)[Math.floor(z.crKey.length / 2)], fam: z.fam,
    });
  }
  t.eq(thrown, 0, 'generate never throws');
  t.ok(invalid === 0, `every item validates (${invalid} invalid${firstInvalid ? '; first: ' + firstInvalid : ''})`);
  t.eq(fallbacks, 0, 'no fallback items at these seeds');
  t.eq(wrongForm, 0, 'item.form is the variant');
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(jsonBad, 0, 'items survive a JSON round trip (validate and score alike)');
  t.eq(detBad, 0, 'generation is deterministic (every 25th seed regenerated)');
  t.eq(scoreDisagree, 0, 'score() agrees with the band on every band point and three other points per item');
  t.eq(outsideRight, 0, 'the nearest point outside the band scores wrong');
  t.eq(creditBad, 0, 'detail.credit = 1 in the band, falling to 0 at four times the band');
  t.eq(firstPickHits, 0, 'none of the eleven shortcut picks (ties and half steps counted both ways) lies in the band');
  t.eq(pickDisagree, 0, "the generator's picks and the validator's (other algorithms) are the same points");
  t.eq(v2Missing, 0, 'the correction ratio (value2) is logged on every rated item');
  t.eq(v2KeyOff, 0, 'value2 at the key lies within 0.3–1.7 (the key sits within a dot of the best spot, the trap is at least a dot)');

  t.section('centralpoint: chance and the shortcut table (hit rates in %)');
  console.log('    cell (form targets band) | n | band pts | chance | fixed | next to avg | ring 2 | between dots | dense 1.5 / 2 dots | 1 Weiszfeld step | avg→group 1–4 half-steps | avg away from far 1–4 | observer 0.3 / 0.5 | avg user | value2 at key (median) | keys between dots');
  for (const r of rows) {
    console.log(`    ${r.variant} ${r.k} ${r.band * 100}% | ${r.n} | ${r.bandPts.toFixed(2)} | ${pct(r.chance, 2)} | ${pct(r.fixed)} | ${pct(r.nbAvg)} | ${pct(r.ring2)} | ${pct(r.parity, 2)} | ${pct(r.dense15)} / ${pct(r.dense2)} | ${pct(r.w1)} | ${r.toward.map((x) => pct(x, 0)).join('/')} | ${r.away.map((x) => pct(x, 0)).join('/')} | ${pct(r.obs03, 0)} / ${pct(r.obs05, 0)} | ${pct(r.avgUser)} | ${r.crKey.toFixed(2)} | ${pct(r.between, 0)}`);
  }
  for (const r of rows.filter((x) => x.variant === 'quick')) {
    const lim = r.chance + 0.10, cell = `${r.k} targets, ${r.band * 100} %`;
    t.ok(Math.abs(r.chance - L.CHANCE[L.BANDS.indexOf(r.band)]) <= 0.003, `${cell}: chance ${pct(r.chance, 2)} % is within 0.3 points of the stored ${pct(L.CHANCE[L.BANDS.indexOf(r.band)], 2)} %`);
    const bounded = { fixed: r.fixed, 'next to the average': r.nbAvg, 'ring 2 round the average': r.ring2, 'a point between dots': r.parity, 'dense group, 1.5 dots': r.dense15, 'dense group, 2 dots': r.dense2 };
    const over = Object.entries(bounded).filter(([, v]) => v > lim);
    t.ok(over.length === 0, `${cell}: second-order guesses within chance + 10 (${over.length ? over.map(([k2, v]) => k2 + ' ' + pct(v)).join(', ') : 'worst ' + pct(Math.max(...Object.values(bounded))) + ' %'})`);
  }
  const fams = rows.filter((r) => r.variant === 'quick').map((r) => Object.keys(r.fam).length);
  t.ok(fams.every((c) => c === 3), 'every rated cell draws on all three layout families');

  t.section('centralpoint: generation time (CPU, ms per item)');
  for (const r of timing.filter((x) => x.variant === 'quick')) console.log(`    ${r.k} targets, ${r.band * 100} %: mean ${r.mean.toFixed(2)}, p95 ${r.p95.toFixed(2)} (a phone at 4× slower: ${(4 * r.p95).toFixed(1)}), max ${r.max.toFixed(1)}`);
  const worst = timing.filter((x) => x.variant === 'quick').reduce((a, c) => (c.p95 > a.p95 ? c : a));
  t.ok(worst.p95 < 20, `p95 CPU time under 20 ms in every cell (slowest: ${worst.k} targets at ${worst.band * 100} %, ${worst.p95.toFixed(2)} ms; about ${(4 * worst.p95).toFixed(0)} ms on a phone 4× slower)`);

  /* ---------------------------------------------------------------- tutorial items */
  t.section('centralpoint: tutorial tasks (2 % band, never rated)');
  for (const task of ['watch', 'kite', 'group', 'loose']) for (const variant of ['quick', 'exact']) {
    let bad = 0, first = null, kiteOff = 0, trapLow = 0, dl = 0;
    for (let s = 0; s < 400; s++) {
      const it = def.generate(PX.rng(PX.rng.hash('centralpoint-task', task, variant, s)), { variant, task });
      const v = def.validate(it);
      if (v !== true || it.fallback || it.task !== task || it.band !== 0.02) { bad++; first = first || String(v); continue; }
      if (task === 'kite') {
        // the diagonals cross on a dot, and that dot is the best spot and the key
        if (Math.abs(it.gm[0] - it.key.x) > 1e-6 || Math.abs(it.gm[1] - it.key.y) > 1e-6 || it.key.x % 2 || it.key.y % 2) kiteOff++;
      }
      const m = meanOf(it.targets);
      if ((task === 'watch' || task === 'group') && hyp(m, it.gm) / F < 1) trapLow++;
      if (it.deadlineMs) dl++;
    }
    t.ok(bad === 0, `${task} (${variant}): 400 valid, regular items${first ? ' (first problem: ' + first + ')' : ''}`);
    if (task === 'kite') t.eq(kiteOff, 0, `kite (${variant}): the best spot is the dot where the diagonals cross`);
    if (task === 'watch' || task === 'group') t.eq(trapLow, 0, `${task} (${variant}): the average lies at least a dot from the best spot`);
    t.eq(dl, task === 'loose' && variant === 'quick' ? 400 : 0, `${task} (${variant}): a 20 s deadline only on the last Try item of the quick form`);
  }

  t.section('centralpoint: fallbacks');
  let fbBad = 0;
  for (const p of X.enumerate(def)) { const f = L.fallbackFor(p); if (f.fallback !== true || def.validate(f) !== true || !def.score(f, f.key).correct) fbBad++; }
  for (const task of ['watch', 'kite', 'group', 'loose']) { const f = L.fallbackFor({ task }); if (f.fallback !== true || def.validate(f) !== true) fbBad++; }
  t.eq(fbBad, 0, 'a valid fallback item exists for every cell and task, marked fallback');

  /* ---------------------------------------------------------------- the validator catches broken items */
  t.section('centralpoint: validator');
  const base = def.generate(PX.rng(77), { variant: 'quick', targets: 2, band: 0 });
  const sol0 = L.solve(base), E0 = sol0.S.map((s) => s / sol0.best - 1);
  const mutate = (fn) => { const c = JSON.parse(JSON.stringify(base)); fn(c); return c; };
  let notBest = -1;
  for (let q = 0; q < NP; q++) if (E0[q] > 0.001 && E0[q] <= 0.05) { notBest = q; break; }
  const cases = {
    'a key that is not the best point': mutate((c) => { c.key = { x: notBest % N, y: Math.floor(notBest / N) }; }),
    'a target off the dots': mutate((c) => { c.targets[0] = [c.targets[0][0] + 1, c.targets[0][1]]; }),
    'two targets on one dot': mutate((c) => { c.targets[1] = c.targets[0].slice(); }),
    'a missing target': mutate((c) => { c.targets.pop(); }),
    'a band that does not match the level': mutate((c) => { c.band = 0.02; }),
    'a stored best spot that is off': mutate((c) => { c.gm = [c.gm[0] + 0.5, c.gm[1]]; }),
    'a target moved into the band': mutate((c) => { c.targets[0] = [c.key.x - (c.key.x % 2), c.key.y - (c.key.y % 2)]; }),
    'the wrong form': mutate((c) => { c.form = 'exact'; }),
    'a deadline on a rated item': mutate((c) => { c.deadlineMs = 5000; }),
    'collinear targets': mutate((c) => { c.targets = [[0, 0], [2, 2], [4, 4], [6, 6], [8, 8], [10, 10]]; }),
    'not an item': null,
  };
  for (const [name, c] of Object.entries(cases)) t.ok(typeof def.validate(c) === 'string', `validate rejects ${name}`);
  // the trap rule and the shortcut rule, on layouts built to break them
  const flatTrap = { ...base, targets: [[2, 2], [10, 2], [2, 10], [10, 10], [4, 6], [8, 6]] };
  { const s2 = L.solve(flatTrap); flatTrap.key = { x: s2.key % N, y: Math.floor(s2.key / N) }; flatTrap.gm = L.weiszfeld(flatTrap.targets, 50000, 1e-13); }
  t.ok(/trap|band|shortcut/.test(String(def.validate(flatTrap))), 'validate rejects a symmetric layout (no trap; the grid centre and the average are the answer)');

  /* ---------------------------------------------------------------- scorer */
  t.section('centralpoint: scorer');
  for (const r of [null, undefined, 3, 'x', [], {}, { x: 1.5, y: 2 }, { x: -1, y: 0 }, { x: 13, y: 0 }, { x: 4 }, { x: '4', y: '4' }, { x: NaN, y: 1 }, { x: 4, z: 4 }]) {
    t.eq(def.score(base, r).correct, false, `malformed response ${JSON.stringify(r)} scores wrong`);
  }
  t.eq(def.score(null, base.key).correct, false, 'a missing item scores wrong');
  const sk = def.score(base, base.key);
  t.ok(sk.value === 0 && sk.detail.credit === 1 && Math.abs(sk.detail.total - sol0.best / 2) < 1e-12, 'the key: excess 0, credit 1, totals in dots');
  const m0 = L.mean(base.targets);
  t.ok(Math.abs(L.correction(base, m0[0], m0[1])) < 1e-12 && Math.abs(L.correction(base, base.gm[0], base.gm[1]) - 1) < 1e-12, 'the correction ratio is 0 at the average and 1 at the best spot');
  t.ok(L.credit(0.01, 0.01) === 1 && Math.abs(L.credit(0.025, 0.01) - 0.5) < 1e-12 && L.credit(0.04, 0.01) === 0 && L.credit(0.2, 0.01) === 0, 'credit: 1 at the band, ½ at 2.5 bands, 0 from 4 bands on');

  /* ---------------------------------------------------------------- the model's helpers */
  t.section('centralpoint: model helpers (pulls, contours, quick deadline, round score)');
  let pullOff = 0, contourOff = 0;
  for (let s = 0; s < 300; s++) {
    const it = def.generate(PX.rng(PX.rng.hash('centralpoint-helpers', s)), { targets: s % 5, band: s % 3 });
    const pu = L.pulls(it.targets, it.gm[0], it.gm[1]);
    if (Math.hypot(pu.sum[0], pu.sum[1]) > 1e-5 || pu.u.some((u) => !u || Math.abs(Math.hypot(u[0], u[1]) - 1) > 1e-12)) pullOff++;
    const sol = L.solve(it), lvl = sol.best * (1 + it.band);
    for (const pt of L.contour(it.targets, it.gm, lvl, 36)) if (Math.abs(L.total(it.targets, pt[0], pt[1]) - lvl) > 1e-6) contourOff++;
  }
  t.eq(pullOff, 0, 'at the best spot the equal pulls cancel (|sum| < 1e-5), each a unit vector');
  t.eq(contourOff, 0, 'contour points lie on their level line');
  { // the engine's staircase rule (js/engine/pace.js) with these numbers settles near 85 % in time for a
    // player with a lognormal pace (median 4 s)
    const pc = def.pace, r = PX.rng(5); let x = Math.log10(pc.startMs), inT = 0, n2 = 0;
    for (let i = 0; i < 6000; i++) {
      const ms = Math.min(pc.maxMs, Math.max(pc.minMs, Math.round(10 ** x))), ok = 4000 * Math.exp(0.35 * r.normal()) <= ms;
      if (i >= 1000) { n2++; if (ok) inT++; }
      x = Math.log10(ms) + (ok ? -pc.step : pc.step * pc.target / (1 - pc.target));
    }
    t.ok(Math.abs(inT / n2 - pc.target) < 0.03, `the pace staircase settles near ${pct(pc.target, 0)} % in time (${pct(inT / n2)} %)`);
  }
  const res = (cr) => ({ correct: cr === 1, credit: cr, detail: { credit: cr } });
  const R = def.roundScore;
  t.ok(R(base, res(1), { rtMs: 0, deadlineMs: 10000 }) === 100 && R(base, res(1), { rtMs: 10000, deadlineMs: 10000 }) === 50 && R(base, res(0.5), { rtMs: 5000, deadlineMs: 10000 }) === 38,
    'round score: closeness × pace (1 at once, ½ at the deadline)');
  t.ok(R(base, res(0.8), { timeout: true, deadlineMs: 10000 }) === 20 && R(base, res(0), { rtMs: 100, deadlineMs: 10000 }) === 0 && R(base, res(0.8), { rtMs: 3000 }) === 80 && R(base, {}, {}) === 0 && R(base, { detail: { credit: 1 } }, null) === 100,
    'a marker left at the deadline earns a quarter of its closeness, no credit earns 0, untimed items earn their closeness');
  t.ok(R(base, def.score(base, base.key), { rtMs: 2000, deadlineMs: 8000 }) === 88, 'the round score reads the credit of a real score() result');

  /* ---------------------------------------------------------------- learn data and the view's rule on the average */
  if (hasLearn) checkLearnCP(t, PX, def);
  const viewFile = path.join(t.root, 'js/ex/centralpoint/view.js');
  if (existsSync(viewFile)) {
    t.section('centralpoint: the average is drawn only in the tutorial Watch (PLAN.md Defaults)');
    const src = readFileSync(viewFile, 'utf8');
    const a = src.indexOf('/* WATCH-ONLY: the average */'), b = src.indexOf('/* END WATCH-ONLY */');
    const outside = a >= 0 && b > a ? src.slice(0, a) + src.slice(b) : src;
    t.ok(a >= 0 && b > a, 'view.js marks its one Watch-only block');
    t.ok(!/\.mean\(|meanOf|average(Pos|Point|Mark)/.test(outside), 'outside that block the view never computes or marks the average position');
  }
}

function checkLearnCP(t, PX, def) {
  t.section('centralpoint: learn');
  const L = PX.ex.learn('centralpoint');
  if (!t.ok(L && typeof L === 'object', 'learn data is registered')) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, 'a one-line goal');
  t.ok(L.goals && def.variants.every((v) => typeof L.goals[v] === 'string' && L.goals[v].length <= 140), 'a goal per form');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length === 2 && L.demo.every((d) => valid(d.params) && d.params.task === 'watch' && Number.isInteger(d.seed) && d.kind === 'watch'), 'a Watch per form (task watch, fixed seeds)');
  for (const d of L.demo) {
    const item = def.generate(PX.rng(d.seed), d.params);
    t.ok(!item.fallback && def.validate(item) === true && item.form === d.params.variant, `the Watch seed ${d.seed} (${d.params.variant}) gives a regular, valid item`);
  }
  t.eq(L.demo[0].seed, L.demo[1].seed, 'both forms watch the same layout');
  t.ok(Array.isArray(L.practice) && L.practice.length === 3 && L.practice.every(valid), '3 Try items');
  t.eq(L.practice.map((p) => p.task), ['kite', 'group', 'loose'], 'Try: the kite, the group with a far target, a rated-style item');
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).every((l) => l >= 0 && l < d.levels.length));
    const varOk = !tr.variant || def.variants.indexOf(tr.variant) >= 0;
    t.ok(tip.id && tip.text && dimOk && varOk && (tr.dim || tr.variant), `tip ${tip.id} has a valid trigger`);
  }
  t.eq((L.strategies || []).map((s) => [s.id, s.title]), [['imagery', 'Balance the pulls'], ['analytic', 'Count the sides'], ['switch', 'First count, then balance']], 'strategy cards: Balance the pulls, Count the sides, and when to use which');
  t.ok((L.strategies || []).every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  t.ok(/average/i.test(L.strategies[0].text + L.strategies[0].steps.join(' ')), 'the imagery card says in words that the average is not the answer');
  t.ok(typeof L.bridge === 'string' && /whether practice here changes/i.test(L.bridge), 'the "where it is used" line carries its limitation');
  const all = JSON.stringify(L).toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered|genius/.test(all), 'no IQ, intelligence or "mastered" claims');
  const viewFile = path.join(t.root, 'js/ex/centralpoint/view.js');
  if (existsSync(viewFile)) {
    const keys = [...new Set([...readFileSync(viewFile, 'utf8').matchAll(/cap\('([a-zA-Z0-9]+)'/g)].map((m) => m[1]))];
    const missing = keys.filter((k) => !(L.captions && typeof L.captions[k] === 'string' && L.captions[k].length));
    t.ok(keys.length > 10 && missing.length === 0, `every caption the view uses exists (${keys.length} keys${missing.length ? '; missing ' + missing.join(', ') : ''})`);
  }
}
