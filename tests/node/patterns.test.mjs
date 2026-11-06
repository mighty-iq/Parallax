/* PR-4 Pattern Memory: generator, validator, scorer (≥ 10 000 seeds over every level). */
import { performance } from 'node:perf_hooks';
import { MANIFEST } from './run.mjs';

const SEEDS_PER_COMBO = 480; // 21 combinations → 10 080 items

export async function run(t) {
  // Only the files this probe needs, so other exercises' work in progress cannot break it.
  const PX = t.context({ files: [...MANIFEST, 'js/ex/patterns/gen.js', 'js/ex/patterns/learn.js'] }).PX;
  const def = PX.ex.get('patterns');
  t.section('patterns: definition');
  t.ok(def, 'patterns is registered');
  if (!def) return;
  t.eq([def.code, def.role, def.answer, def.cell, def.version, [...def.abilities]], ['PR-4', 'probe', 'targets', 'extrinsic-static', 1, ['MV']], 'contract fields');
  const range = PX.ex.maxDifficulty(def) - PX.ex.minDifficulty(def);
  t.ok(range >= 4, `difficulty range ≥ 4 logits (got ${range.toFixed(2)})`);
  const combos = PX.ex.enumerate(def);
  t.eq(combos.length, 21, '7 sizes × 3 regularity levels');
  t.ok(combos.every((p) => def.chance(p) > 0 && def.chance(p) < 0.01), 'chance is tiny but positive');
  t.eq(def.exposureMs, 3000, 'exposure fixed at 3 s');

  t.section('patterns: fallback');
  for (const p of combos) t.ok(def.validate(def.helpers.fallback(1, p)) === true, `fallback valid at ${PX.ex.paramsKey(p)}`);

  t.section('patterns: 10 000 seeds');
  const H = def.helpers;
  let fallbacks = 0, roundTrip = 0, malformed = 0;
  let n = 0, threw = 0, invalid = 0, keyWrong = 0, wrongAccepted = 0, nondet = 0, firstBad = null;
  const times = [], hardTimes = [], walls = [];
  const perLevel = {};
  const fill = {}; // size → per-cell counts
  for (const p of combos) {
    const lv = PX.ex.paramsKey(p);
    perLevel[lv] = { n: 0, clusters: [], forms: [[], [], []] };
    for (let s = 0; s < SEEDS_PER_COMBO; s++) {
      const seed = PX.rng.hash('pr4', lv, s);
      let item;
      const t0 = performance.now(), c0 = process.cpuUsage();
      try { item = def.generate(PX.rng(seed), p); } catch (e) { threw++; firstBad = firstBad || `${lv} seed ${seed}: ${e.message}`; continue; }
      const cu = process.cpuUsage(c0), dt = (cu.user + cu.system) / 1000;
      times.push(dt); walls.push(performance.now() - t0);
      if (p.size === 6 && p.regularity === 2) hardTimes.push(dt);
      n++;
      const v = def.validate(item);
      if (v !== true) { invalid++; firstBad = firstBad || `${lv} seed ${seed}: ${v}`; continue; }
      const r = def.score(item, item.key.slice());
      if (!(r.correct && r.value === 1)) keyWrong++;
      if (def.score(item, item.key.slice().reverse()).correct !== true) keyWrong++;
      // Wrong responses: one cell missing, one extra, one swapped, empty, all cells.
      const N = item.rows * item.cols;
      const empty = []; for (let id = 0; id < N; id++) if (!item.key.includes(id)) empty.push(id);
      const wrongs = [item.key.slice(1), [...item.key, empty[0]].sort((a, b) => a - b), [...item.key.slice(1), empty[s % empty.length]].sort((a, b) => a - b), [], [...Array(N).keys()]];
      for (const w of wrongs) { const x = def.score(item, w); if (x.correct || !(x.value < 1)) wrongAccepted++; }
      if (s % 8 === 0) {
        const again = def.generate(PX.rng(seed), p);
        if (JSON.stringify(again) !== JSON.stringify(item)) nondet++;
      }

      if (item.fallback) fallbacks++;
      if (s % 8 === 1) {
        const back = JSON.parse(JSON.stringify(item));
        if (def.validate(back) !== true || !def.score(back, back.key).correct) roundTrip++;
        for (const bad of [null, undefined, 'x', -1, 99, 1.5, {}, [[-1]], 'abc', [item.key.length]]) {
          try { if (def.score(item, bad).correct) malformed++; } catch (e) { malformed++; }
        }
      }
      const L = perLevel[lv];
      L.n++; L.clusters.push(item.clusters); L.forms[s % 3].push(item.clusters);
      const f = fill[p.size] || (fill[p.size] = { n: 0, cells: new Array(N).fill(0) });
      f.n++; for (const id of item.key) f.cells[id]++;
    }
  }
  t.ok(n >= 10000, `at least 10 000 items (got ${n})`);
  t.eq(threw, 0, 'generate never throws' + (firstBad ? ` (${firstBad})` : ''));
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right with value 1 (any order)');
  t.eq(wrongAccepted, 0, 'wrong responses score wrong with value < 1');
  t.eq(nondet, 0, 'same seed → same item');
  // CPU time per item is asserted; wall time on a shared machine is reported only.
  [times, hardTimes, walls].forEach((a) => a.sort((x, y) => x - y));
  const p95 = times[Math.floor(times.length * 0.95)], p95h = hardTimes[Math.floor(hardTimes.length * 0.95)], p95w = walls[Math.floor(walls.length * 0.95)];
  t.ok(p95 < 20 && p95h < 20, `generation p95 < 20 ms CPU (all ${p95.toFixed(2)} ms, hardest level ${p95h.toFixed(2)} ms; wall ${p95w.toFixed(2)} ms)`);

  t.section('patterns: scoring details');
  {
    const item = def.generate(PX.rng(7), { size: 2, regularity: 1 });
    const N = item.rows * item.cols;
    const r = def.score(item, item.key.slice(2));
    t.eq([r.correct, r.detail.misses, r.detail.falseAlarms], [false, 2, 0], 'two misses');
    t.near(r.value, (N - 2) / N, 1e-12, 'value = share of cells right');
    t.eq(def.score(item, [...item.key, ...item.key, -1, 99, 1.5, 'x']).correct, true, 'duplicates and invalid ids are ignored');
    t.eq(def.score(item, null).correct, false, 'no response is wrong');
  }

  t.section('patterns: levels and forms');
  let bandsOk = true, formsOk = true, worstForm = 0;
  for (const p of combos) {
    const L = perLevel[PX.ex.paramsKey(p)], b = H.band(p);
    if (!L.clusters.every((c) => c >= b[0] && c <= b[1])) bandsOk = false;
    const m = L.forms.map((f) => f.reduce((a, x) => a + x, 0) / f.length);
    const spread = Math.max(...m) - Math.min(...m);
    worstForm = Math.max(worstForm, spread);
    if (spread > 0.35) formsOk = false;
  }
  t.ok(bandsOk, 'every item’s cluster count lies in its level’s band');
  t.ok(formsOk, `alternate forms (seed blocks) match: mean clusters differ by ≤ 0.35 (worst ${worstForm.toFixed(2)})`);

  // Positional bias: every cell filled at a rate near k/N; the best positional-prior responder
  // (tap the k cells filled most often) scores near chance.
  let biasOk = true, worstRate = [1, 0];
  for (const [size, f] of Object.entries(fill)) {
    const [rows, cols, k] = H.SIZES[size];
    const base = k / (rows * cols);
    for (const c of f.cells) {
      const rate = c / f.n;
      worstRate = [Math.min(worstRate[0], rate / base), Math.max(worstRate[1], rate / base)];
      if (rate < base * 0.6 || rate > base * 1.4) biasOk = false;
    }
  }
  t.ok(biasOk, `cell fill rates within ±40 % of k/N (ratio range ${worstRate.map((x) => x.toFixed(2)).join('–')})`);
  let priorRight = 0, priorN = 0, priorValue = 0, randValue = 0;
  for (const p of combos) {
    const f = fill[p.size], [rows, cols, k] = H.SIZES[p.size], N = rows * cols;
    const prior = f.cells.map((c, id) => [c, id]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, k).map((x) => x[1]).sort((a, b) => a - b);
    for (let s = 0; s < 60; s++) {
      const item = def.generate(PX.rng(PX.rng.hash('pr4-prior', PX.ex.paramsKey(p), s)), p);
      const r = def.score(item, prior);
      priorN++; if (r.correct) priorRight++; priorValue += r.value;
      randValue += 1 - 2 * (k * (N - k) / N) / N; // expected value of k random cells
    }
  }
  t.ok(priorRight / priorN <= 0.01 && priorValue / priorN < randValue / priorN + 0.05,
    `positional-prior responder: exact ${(100 * priorRight / priorN).toFixed(1)} %, cells right ${(100 * priorValue / priorN).toFixed(1)} % vs random ${(100 * randValue / priorN).toFixed(1)} %`);


  t.section('patterns: learn data and limits');
  {
    const L = PX.ex.learn('patterns');
    t.ok(L && typeof L.goal === 'string' && Array.isArray(L.instruction) && L.instruction.length >= 2, 'learn: goal and a one-screen instruction');
    t.ok(L && Array.isArray(L.parts) && L.parts.length >= 2 && L.parts.every((x) => x.id && x.label && x.text), 'learn: labelled parts');
    t.ok(L && Array.isArray(L.demo) && L.demo.length >= 1, 'learn: a worked example');
    for (const d of (L && L.demo) || []) {
      t.ok(PX.ex.validParams(def, d.params) === true, `learn: example params valid (${JSON.stringify(d.params)})`);
      const it = def.generate(PX.rng(d.seed), d.params);
      t.ok(def.validate(it) === true && !it.fallback, 'learn: the example seed gives a valid item');
      t.eq(it.key.join('.'), d.kind, 'learn: the example seed gives the stated item');
    }
    t.ok(!/\bIQ\b|smarter|mastered|genius|brain age/i.test(JSON.stringify(L)), 'learn: wording rules (no IQ, smarter, mastered)');
    t.ok(combos.every((p) => { const ms = def.timeLimit(p); return Number.isFinite(ms) && ms >= 10000 && ms <= 60000; }), 'every level has an item time limit of 10–60 s');
    t.eq(fallbacks, 0, 'no fallback items over the seeds');
    t.eq(roundTrip, 0, 'items survive a JSON round trip (validate, key right)');
    t.eq(malformed, 0, 'malformed responses score wrong without throwing');
  }

  t.section('patterns: difficulty spread');
  const bs = combos.map((p) => def.difficulty(p));
  const lo = Math.min(...bs), hi = Math.max(...bs), bins = new Array(Math.ceil((hi - lo) / 0.5 + 1e-9)).fill(0);
  for (const b of bs) bins[Math.min(bins.length - 1, Math.floor((b - lo) / 0.5))]++;
  t.ok(bins.every((x) => x > 0), `every 0.5-logit bin from ${lo.toFixed(2)} to ${hi.toFixed(2)} has items: [${bins.join(' ')}]`);
  t.summary = { n, p95, p95h, range, bins, worstForm, prior: priorRight / priorN };
  console.log(`       patterns: ${n} items, p95 ${p95.toFixed(2)} ms, range ${range.toFixed(2)} logits, bins [${bins.join(' ')}], forms Δ ≤ ${worstForm.toFixed(2)}, cell-rate ratio ${worstRate.map((x) => x.toFixed(2)).join('–')}`);
}
