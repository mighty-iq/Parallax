/* PR-3 Mechanisms: geometry, solver, generator, shortcut solvers (≥ 10 000 seeds over every level). */
import { performance } from 'node:perf_hooks';
import { MANIFEST } from './run.mjs';

const SEEDS_PER_COMBO = 210; // 48 combinations → 10 080 items

// An independent direction solver for the tests: meshes by brute force from the geometry (same
// layer, centre distance = sum of radii), belts as given, signs propagated by BFS; a sign conflict
// anywhere in the driver's mechanism is a jam. Speed: product of radius ratios along the BFS tree.
function independent(item) {
  const ax = Object.fromEntries(item.axles.map((a) => [a.id, a]));
  const adj = Object.fromEntries(item.axles.map((a) => [a.id, []]));
  const ws = item.wheels;
  for (let i = 0; i < ws.length; i++) {
    for (let j = i + 1; j < ws.length; j++) {
      const u = ws[i], v = ws[j];
      if (u.axle === v.axle || u.kind !== 'gear' || v.kind !== 'gear' || u.layer !== v.layer) continue;
      const d = Math.hypot(ax[u.axle].x - ax[v.axle].x, ax[u.axle].y - ax[v.axle].y);
      if (Math.abs(d - u.r - v.r) < 1e-6) {
        adj[u.axle].push({ to: v.axle, s: -1, k: u.r / v.r });
        adj[v.axle].push({ to: u.axle, s: -1, k: v.r / u.r });
      }
    }
  }
  const wid = Object.fromEntries(ws.map((w) => [w.id, w]));
  for (const b of item.belts) {
    const A = wid[b.a], B = wid[b.b], s = b.crossed ? -1 : 1;
    adj[A.axle].push({ to: B.axle, s, k: A.r / B.r });
    adj[B.axle].push({ to: A.axle, s, k: B.r / A.r });
  }
  const sign = { [item.driver.axle]: 1 }, speed = { [item.driver.axle]: 1 }, q = [item.driver.axle];
  let jam = false;
  for (let i = 0; i < q.length; i++) {
    for (const e of adj[q[i]]) {
      if (sign[e.to] === undefined) { sign[e.to] = sign[q[i]] * e.s; speed[e.to] = speed[q[i]] * e.k; q.push(e.to); }
      else if (sign[e.to] !== sign[q[i]] * e.s) jam = true;
    }
  }
  const turn = sign[item.target] * item.driver.dir, sp = speed[item.target];
  if (item.question === 'speed') return jam ? 'jam?' : Math.abs(sp - 1) < 1e-9 ? 'same' : sp > 1 ? 'faster' : 'slower';
  if (jam) return 'jam';
  if (item.question === 'dir') return turn > 0 ? 'cw' : 'ccw';
  return turn * (item.rope.side === 'left' ? -1 : 1) < 0 ? 'up' : 'down';
}

export async function run(t) {
  // Only the files this probe needs, so other exercises' work in progress cannot break it.
  const PX = t.context({ files: [...MANIFEST, 'js/ex/mechanisms/gen.js', 'js/ex/mechanisms/learn.js'] }).PX;
  const def = PX.ex.get('mechanisms');
  t.section('mechanisms: definition');
  t.ok(def, 'mechanisms is registered');
  if (!def) return;
  t.eq([def.code, def.role, def.answer, def.cell, def.nOptions, def.version, [...def.abilities]], ['PR-3', 'probe', 'choice', 'intrinsic-dynamic', 3, 1, ['MA']], 'contract fields');
  const range = PX.ex.maxDifficulty(def) - PX.ex.minDifficulty(def);
  t.ok(range >= 4, `difficulty range ≥ 4 logits (got ${range.toFixed(2)})`);
  const H = def.helpers, combos = PX.ex.enumerate(def);
  t.eq(combos.length, 48, '4 route lengths × 4 structures × 3 questions');
  t.ok(combos.every((p) => [0.5, 1 / 3].includes(def.chance(p))), 'chance is 1/2 (no jam possible) or 1/3');

  t.section('mechanisms: geometry helpers');
  {
    // Open belt runs are outer tangents, crossed belt runs cross between the pulleys.
    const open = H.beltRuns(0, 0, 5, 40, 0, 5, false), cr = H.beltRuns(0, 0, 5, 40, 0, 5, true);
    t.ok(Math.abs(open[0][1] - open[0][3]) < 1e-9 && Math.abs(Math.abs(open[0][1]) - 5) < 1e-9, 'open belt between equal pulleys runs parallel at the rims');
    t.ok(Math.sign(cr[0][1]) === -Math.sign(cr[0][3]), 'crossed belt runs cross the centre line');
  }

  t.section('mechanisms: fallback');
  for (const p of combos) {
    const f = H.fallback(1, p);
    t.ok(f && def.validate(f) === true, `fallback valid at ${PX.ex.paramsKey(p)}`);
  }

  t.section('mechanisms: 10 000 seeds');
  let fallbacks = 0, roundTrip = 0, malformed = 0;
  let n = 0, threw = 0, invalid = 0, keyWrong = 0, otherRight = 0, nondet = 0, disagree = 0, firstBad = null;
  const times = [], cpus = [], hard = [];
  const cut = {}; // shortcut → { right, n, byStruct: [[right, n] × 4] }
  const keys = {}; // question → answer → count; and jam share per structure
  const forms = {};
  const note = (name, ans, item) => {
    if (ans === null) return;
    const c = cut[name] || (cut[name] = { right: 0, n: 0, chance: 0, by: [0, 1, 2, 3].map(() => [0, 0]) });
    const ok = ans === item.answers[item.key] ? 1 : 0;
    c.right += ok; c.n++; c.chance += def.chance(item.params);
    c.by[item.params.structure][0] += ok; c.by[item.params.structure][1]++;
  };
  for (const p of combos) {
    const lv = PX.ex.paramsKey(p);
    forms[lv] = [[], [], []];
    for (let s = 0; s < SEEDS_PER_COMBO; s++) {
      const seed = PX.rng.hash('pr3', lv, s);
      let item;
      const t0 = performance.now(), c0 = process.cpuUsage();
      try { item = def.generate(PX.rng(seed), p); } catch (e) { threw++; firstBad = firstBad || `${lv} seed ${seed}: ${e.message}`; continue; }
      const cu = process.cpuUsage(c0), cpu = (cu.user + cu.system) / 1000;
      times.push(performance.now() - t0); cpus.push(cpu);
      if (p.gears === 3 && p.structure === 3) hard.push(cpu);
      n++;
      const v = def.validate(item);
      if (v !== true) { invalid++; firstBad = firstBad || `${lv} seed ${seed}: ${v}`; continue; }
      if (!def.score(item, item.key).correct) keyWrong++;
      for (let i = 0; i < 3; i++) if (i !== item.key && def.score(item, i).correct) otherRight++;
      if (independent(item) !== item.answers[item.key]) { disagree++; firstBad = firstBad || `${lv} seed ${seed}: independent solver says ${independent(item)}`; }
      if (s % 8 === 0 && JSON.stringify(def.generate(PX.rng(seed), p)) !== JSON.stringify(item)) nondet++;

      if (item.fallback) fallbacks++;
      if (s % 8 === 1) {
        const back = JSON.parse(JSON.stringify(item));
        if (def.validate(back) !== true || !def.score(back, back.key).correct) roundTrip++;
        for (const bad of [null, undefined, 'x', -1, 99, 1.5, {}, [item.key]]) {
          try { if (def.score(item, bad).correct) malformed++; } catch (e) { malformed++; }
        }
      }
      const q = item.question, a = item.answers[item.key];
      const K = keys[q] || (keys[q] = { n: 0, by: {}, jam: [0, 1, 2, 3].map(() => [0, 0]) });
      K.n++; K.by[a] = (K.by[a] || 0) + 1;
      K.jam[p.structure][0] += a === 'jam' ? 1 : 0; K.jam[p.structure][1]++;
      for (const name of Object.keys(H.shortcuts)) note(name + ':' + (q === 'speed' ? 'speed' : 'turn'), H.shortcuts[name](item), item);
      forms[lv][s % 3].push(item.axles.length + item.belts.length);
    }
  }
  t.ok(n >= 10000, `at least 10 000 items (got ${n})`);
  t.eq(threw, 0, 'generate never throws' + (firstBad ? ` (${firstBad})` : ''));
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(otherRight, 0, 'every other option scores wrong');
  t.eq(disagree, 0, 'an independent solver agrees with every key' + (firstBad ? ` (${firstBad})` : ''));
  t.eq(nondet, 0, 'same seed → same item');
  // CPU time per item (process.cpuUsage) is what generation costs; wall time on a shared test
  // machine also counts time-slicing, so it is reported but not asserted.
  [times, cpus, hard].forEach((a) => a.sort((x, y) => x - y));
  const q95 = (a) => a[Math.floor(a.length * 0.95)];
  const p95 = q95(cpus), p95h = q95(hard), p95w = q95(times);
  t.ok(p95 < 20 && p95h < 20, `generation p95 < 20 ms CPU (all ${p95.toFixed(2)} ms, longest route at the jams level ${p95h.toFixed(2)} ms; wall ${p95w.toFixed(2)} ms)`);

  t.section('mechanisms: answers');
  const share = (K, a) => (K.by[a] || 0) / K.n;
  t.ok(Math.abs(share(keys.dir, 'cw') - share(keys.dir, 'ccw')) < 0.05, `clockwise and counter-clockwise keys balance (${(100 * share(keys.dir, 'cw')).toFixed(1)} / ${(100 * share(keys.dir, 'ccw')).toFixed(1)} %)`);
  t.ok(Math.abs(share(keys.lift, 'up') - share(keys.lift, 'down')) < 0.05, 'up and down keys balance');
  t.ok(['faster', 'same', 'slower'].every((a) => Math.abs(share(keys.speed, a) - 1 / 3) < 0.04), 'speed keys about one third each');
  const jamShare = (s) => ['dir', 'lift'].reduce((acc, q) => [acc[0] + keys[q].jam[s][0], acc[1] + keys[q].jam[s][1]], [0, 0]);
  t.ok(jamShare(0)[0] + jamShare(1)[0] === 0, 'no jams at the chain and branches levels');
  const j2 = jamShare(2), j3 = jamShare(3);
  t.ok(Math.abs(j2[0] / j2[1] - 1 / 3) < 0.05 && Math.abs(j3[0] / j3[1] - 1 / 2) < 0.05, `jams: ${(100 * j2[0] / j2[1]).toFixed(0)} % at the belts level, ${(100 * j3[0] / j3[1]).toFixed(0)} % at the jams level`);

  t.section('mechanisms: shortcut solvers');
  const pct = (x) => (100 * x).toFixed(1);
  const lines = [];
  for (const [name, c] of Object.entries(cut)) {
    const acc = c.right / c.n, meanChance = c.chance / c.n;
    const by = c.by.map(([r, m]) => (m ? pct(r / m) : '–')).join('/');
    t.ok(acc <= 1 / 3 + 0.10, `${name}: ${pct(acc)} % over the pool ≤ 1/3 + 10 (mean chance ${pct(meanChance)} %; by structure ${by})`);
    lines.push(`${name} ${pct(acc)} (${by})`);
  }


  t.section('mechanisms: learn data and limits');
  {
    const L = PX.ex.learn('mechanisms');
    t.ok(L && typeof L.goal === 'string' && Array.isArray(L.instruction) && L.instruction.length >= 2, 'learn: goal and a one-screen instruction');
    t.ok(L && Array.isArray(L.parts) && L.parts.length >= 2 && L.parts.every((x) => x.id && x.label && x.text), 'learn: labelled parts');
    t.ok(L && Array.isArray(L.demo) && L.demo.length >= 1, 'learn: a worked example');
    for (const d of (L && L.demo) || []) {
      t.ok(PX.ex.validParams(def, d.params) === true, `learn: example params valid (${JSON.stringify(d.params)})`);
      const it = def.generate(PX.rng(d.seed), d.params);
      t.ok(def.validate(it) === true && !it.fallback, 'learn: the example seed gives a valid item');
      t.eq(it.answers[it.key], d.kind, 'learn: the example seed gives the stated item');
    }
    t.ok(!/\bIQ\b|smarter|mastered|genius|brain age/i.test(JSON.stringify(L)), 'learn: wording rules (no IQ, smarter, mastered)');
    t.ok(combos.every((p) => { const ms = def.timeLimit(p); return Number.isFinite(ms) && ms >= 10000 && ms <= 60000; }), 'every level has an item time limit of 10–60 s');
    t.eq(fallbacks, 0, 'no fallback items over the seeds');
    t.eq(roundTrip, 0, 'items survive a JSON round trip (validate, key right)');
    t.eq(malformed, 0, 'malformed responses score wrong without throwing');
  }

  t.section('mechanisms: forms and spread');
  // Alternate forms are seed blocks of one generator: their mean size (axles + belts per item) may
  // differ only by sampling noise (range within 4 standard errors of a difference, every level).
  let worst = 0;
  for (const lv of Object.keys(forms)) {
    const all = forms[lv].flat(), mu = all.reduce((a, x) => a + x, 0) / all.length;
    const sd = Math.sqrt(all.reduce((a, x) => a + (x - mu) ** 2, 0) / (all.length - 1)) || 1e-9;
    const m = forms[lv].map((f) => f.reduce((a, x) => a + x, 0) / f.length);
    worst = Math.max(worst, (Math.max(...m) - Math.min(...m)) / (sd * Math.sqrt(2 / forms[lv][0].length)));
  }
  t.ok(worst < 4, `alternate forms (seed blocks) agree in size within 4 standard errors (worst ${worst.toFixed(2)})`);
  const bs = combos.map((p) => def.difficulty(p));
  const lo = Math.min(...bs), hi = Math.max(...bs), bins = new Array(Math.ceil((hi - lo) / 0.5 + 1e-9)).fill(0);
  for (const b of bs) bins[Math.min(bins.length - 1, Math.floor((b - lo) / 0.5))]++;
  t.ok(bins.every((x) => x > 0), `every 0.5-logit bin from ${lo.toFixed(2)} to ${hi.toFixed(2)} has items: [${bins.join(' ')}]`);
  console.log(`       mechanisms: ${n} items, p95 CPU ${p95.toFixed(2)} ms (hardest ${p95h.toFixed(2)}; wall ${p95w.toFixed(2)}), range ${range.toFixed(2)} logits, bins [${bins.join(' ')}]`);
  console.log(`       mechanisms shortcuts %: ${lines.join('; ')}`);
}
