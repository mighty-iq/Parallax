/* PR-4 Pattern Memory: generator, validator, scorer (≥ 10 000 seeds over every level); version 2 scores by cells:
   an independent recount of the cell score, and rule 5's shortcut responses per level (answers that never look at
   the pattern stay within the score of k random cells + 10 points). */
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
  t.eq([def.code, def.role, def.answer, def.cell, def.version, [...def.abilities]], ['PR-4', 'probe', 'targets', 'extrinsic-static', 2, ['MV']], 'contract fields (version 2: scored by cells)');
  t.eq(JSON.parse(JSON.stringify(def.past)), { 1: { min: -2.1, max: 2.1 } }, "version 1's range kept in def.past for the trend model");
  t.ok(def.scoreBy === 'cells' && typeof def.cells === 'function' && def.measureK === 0.35, 'scored by cells, aimed at a whole-pattern chance of 0.35');
  const range = PX.ex.maxDifficulty(def) - PX.ex.minDifficulty(def);
  t.ok(range >= 4, `difficulty range ≥ 4 logits (got ${range.toFixed(2)})`);
  const combos = PX.ex.enumerate(def);
  t.eq(combos.length, 21, '7 sizes × 3 regularity levels');
  t.ok(combos.every((p) => def.chance(p) > 0 && def.chance(p) < 0.01), 'chance is tiny but positive');
  t.ok(combos.every((p) => def.cells(p) === def.helpers.SIZES[p.size][2]), 'cells(params) = the filled squares of the level');
  t.eq(Math.min(...combos.map((p) => def.difficulty(p))), -2.1, 'the levels keep version 1’s difficulties (lowest −2.1)');
  t.near(Math.max(...combos.map((p) => def.difficulty(p))), 2.1, 1e-9, '… highest 2.1');
  t.eq(def.exposureMs, 3000, 'exposure fixed at 3 s');

  t.section('patterns: fallback');
  for (const p of combos) t.ok(def.validate(def.helpers.fallback(1, p)) === true, `fallback valid at ${PX.ex.paramsKey(p)}`);

  t.section('patterns: 10 000 seeds');
  const H = def.helpers;
  let fallbacks = 0, roundTrip = 0, malformed = 0;
  let n = 0, threw = 0, invalid = 0, keyWrong = 0, wrongAccepted = 0, nondet = 0, firstBad = null, cellsWrong = 0;
  const byLevel = {}; // level → items (rule 5's shortcut responses)
  // the cell score, recounted independently: squares marked right minus extra marks, at least 0
  const recount = (item, resp) => {
    const key = new Set(item.key), seen = new Set();
    let right = 0, extra = 0;
    for (const id of resp) { if (seen.has(id)) continue; seen.add(id); if (key.has(id)) right++; else extra++; }
    return Math.max(0, right - extra);
  };
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
      for (const w of wrongs) {
        const x = def.score(item, w);
        if (x.correct || !(x.value < 1)) wrongAccepted++;
        const c = recount(item, w);
        if (x.detail.cells !== c || Math.abs(x.value - c / item.k) > 1e-12) cellsWrong++;
      }
      const expect = [item.k - 1, item.k - 1, item.k - 2, 0, Math.max(0, 2 * item.k - N)];
      if (wrongs.some((w, i) => def.score(item, w).detail.cells !== expect[i])) cellsWrong++;
      (byLevel[lv] || (byLevel[lv] = [])).push(item);
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
      if (!L.fill) L.fill = new Array(N).fill(0);
      for (const id of item.key) L.fill[id]++;
      const f = fill[p.size] || (fill[p.size] = { n: 0, cells: new Array(N).fill(0) });
      f.n++; for (const id of item.key) f.cells[id]++;
    }
  }
  t.ok(n >= 10000, `at least 10 000 items (got ${n})`);
  t.eq(threw, 0, 'generate never throws' + (firstBad ? ` (${firstBad})` : ''));
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right with value 1 (any order)');
  t.eq(wrongAccepted, 0, 'wrong responses score wrong with value < 1');
  t.eq(cellsWrong, 0, 'the cell score equals an independent recount (one square missing, one extra, one swapped, none, all)');
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
    t.eq([r.correct, r.detail.misses, r.detail.falseAlarms, r.detail.cells], [false, 2, 0, item.k - 2], 'two misses');
    t.near(r.value, (item.k - 2) / item.k, 1e-12, 'value = cells / k');
    const empty = []; for (let id = 0; id < N; id++) if (!item.key.includes(id)) empty.push(id);
    const r2 = def.score(item, [...item.key.slice(1), empty[0], empty[1]]);
    t.eq([r2.detail.hits, r2.detail.falseAlarms, r2.detail.cells], [item.k - 1, 2, item.k - 3], 'a wrong mark costs as much as a missed square');
    t.eq(def.score(item, [...Array(N).keys()]).detail.cells, Math.max(0, 2 * item.k - N), 'marking every square scores 0 when about half are filled');
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
  // The expected cell score of k random squares: h ~ Hypergeometric(N, k, k), score max(0, 2h − k) / k.
  const comb = (n, r) => { let x = 1; for (let i = 1; i <= r; i++) x = x * (n - r + i) / i; return x; };
  const randomScore = (N, k) => { let e = 0; for (let h = 0; h <= k; h++) e += comb(k, h) * comb(N - k, k - h) / comb(N, k) * Math.max(0, 2 * h - k) / k; return e; };
  let priorRight = 0, priorN = 0;
  for (const p of combos) {
    const f = fill[p.size], [, , k] = H.SIZES[p.size];
    const prior = f.cells.map((c, id) => [c, id]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, k).map((x) => x[1]).sort((a, b) => a - b);
    for (let s = 0; s < 60; s++) {
      const item = def.generate(PX.rng(PX.rng.hash('pr4-prior', PX.ex.paramsKey(p), s)), p);
      priorN++; if (def.score(item, prior).correct) priorRight++;
    }
  }
  t.ok(priorRight / priorN <= 0.01, `positional-prior responder: exact ${(100 * priorRight / priorN).toFixed(1)} %`);

  // Rule 5 for a recall task scored by cells: responses that never look at the pattern (the shared list in
  // def.helpers.shortcuts, the positional prior learnt from the same items, and k random squares) stay within the
  // score of k random squares + 10 points at every level.
  t.section('patterns: shortcut responses by level (scored by cells)');
  // Scoped exceptions (DECISIONS 19 Nov, Pattern Memory version 2): at the smallest grids and the scattered patterns
  // of 3×3 to 4×5, where the grid's geometry fixes where single squares and small shapes sit, the squares filled most
  // often score above k random squares; there the cap is chance + 25 points, and a blind answer still reads as an
  // ability below the pool's easiest item (the check below).
  const SCOPED = { 'regularity=0,size=0': 0.25, 'regularity=0,size=1': 0.25, 'regularity=2,size=0': 0.25,
    'regularity=2,size=1': 0.25, 'regularity=2,size=2': 0.25, 'regularity=2,size=3': 0.25 };
  const worst = {}, blind = {};
  let shortcutsOk = true;
  const lines = [];
  for (const p of combos) {
    const lv = PX.ex.paramsKey(p), items = byLevel[lv] || [], [rows, cols, k] = H.SIZES[p.size], N = rows * cols;
    const chance = randomScore(N, k), f = fill[p.size];
    const sc = H.shortcuts(rows, cols, k);
    const top = (counts, m) => counts.map((c, id) => [c, id]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, m).map((x) => x[1]).sort((a, b) => a - b);
    // the positional prior: the squares filled most often at this size (k of them), and at this level (any number
    // from 1 to N), learnt from 480 other items of the level (other seeds), as a player could learn them
    const fl = new Array(N).fill(0);
    for (let q = 0; q < 480; q++) for (const id of def.generate(PX.rng(PX.rng.hash('pr4-learn', lv, q)), p).key) fl[id]++;
    sc.prior = top(f.cells, k);
    for (let m = 1; m <= N; m++) sc['priorLevel' + m] = top(fl, m);
    let best = ['', -1];
    for (const [name, resp] of Object.entries(sc)) {
      const m = items.reduce((a, it) => a + def.score(it, resp).value, 0) / items.length;
      const nm = /^priorLevel\d+$/.test(name) ? 'priorLevelM' : name;
      if (!worst[nm] || m - chance > worst[nm][0]) worst[nm] = [m - chance, lv];
      if (m > best[1]) best = [name, m];
      const cap = SCOPED[lv] || 0.10;
      if (m > chance + cap) { shortcutsOk = false; lines.push(`${name} at ${lv}: ${(100 * m).toFixed(1)} % vs chance ${(100 * chance).toFixed(1)} % + ${100 * cap}`); }
    }
    blind[lv] = best[1];
    // k random squares (drawn per item)
    const rng = PX.rng(PX.rng.hash('pr4-random', lv));
    const mr = items.reduce((a, it) => { const ids = [...Array(N).keys()]; for (let i = N - 1; i > 0; i--) { const j = rng.int(0, i); [ids[i], ids[j]] = [ids[j], ids[i]]; } return a + def.score(it, ids.slice(0, k)).value; }, 0) / items.length;
    if (Math.abs(mr - chance) > 0.03) { shortcutsOk = false; lines.push(`random at ${lv}: ${(100 * mr).toFixed(1)} % vs expected ${(100 * chance).toFixed(1)} %`); }
    const cap = SCOPED[lv] || 0.10;
    t.ok(best[1] <= chance + cap, `${lv}: best shortcut ${best[0]} ${(100 * best[1]).toFixed(1)} % ≤ chance ${(100 * chance).toFixed(1)} % + ${100 * cap}${SCOPED[lv] ? ' (scoped exception)' : ''}`);
  }
  t.eq(Object.keys(SCOPED).length, 6, 'six scoped levels, no more');
  t.ok(shortcutsOk, 'every shortcut response within chance + 10 points (the scoped levels + 25)' + (lines.length ? ': ' + lines.join('; ') : ''));

  // What a blind answer is worth in a check: a responder who earns the best blind score of whatever level comes
  // (every time, rounded up) goes through a 5-item check as the Spatial Check runs it (items aimed on the exact curve
  // at 0.35, the first two at 0.85; the posterior under N(0, 1.5²) with the cell model). It must read below −2.5,
  // under the pool's easiest item (−2.1), while recalling 3 of 4 squares on the easiest grid reads above it.
  const T = PX.engine && PX.engine.trend;
  t.ok(T && T.cells, 'the trend model’s cell likelihood is loaded');
  if (T && T.cells) {
    const G = []; for (let x = -8; x <= 8.0001; x += 0.05) G.push(x);
    const sig = (x) => 1 / (1 + Math.exp(-x));
    const estimate = (answer) => {
      const lw = G.map((x) => -(x * x) / (2 * 2.25)), recent = [];
      for (let i = 0; i < 5; i++) {
        let mx = -Infinity; for (const v of lw) mx = Math.max(mx, v);
        let s0 = 0, s1 = 0, s2 = 0; G.forEach((x, q) => { const w = Math.exp(lw[q] - mx); s0 += w; s1 += w * x; s2 += w * x * x; });
        const mu = s1 / s0, sd = Math.sqrt(Math.max(s2 / s0 - mu * mu, 1e-9)), kk = 1 / Math.sqrt(1 + Math.PI * sd * sd / 8);
        const target = i < 2 ? 0.85 : def.measureK;
        let pick = null, err = Infinity;
        for (const p of combos) {
          if (recent.includes(PX.ex.paramsKey(p))) continue;
          const g = def.chance(p), b = def.difficulty(p), pp = g + (1 - g - 0.03) * sig((mu - b) * kk), e = Math.abs(pp - (g + (1 - g) * target));
          if (e < err) { err = e; pick = p; }
        }
        recent.push(PX.ex.paramsKey(pick)); if (recent.length > 3) recent.shift();
        const k = def.cells(pick), sObs = answer(pick, k), b = def.difficulty(pick);
        G.forEach((x, q) => { lw[q] += T.cells.logp(x, b, k, sObs); });
      }
      let mx = -Infinity; for (const v of lw) mx = Math.max(mx, v);
      let s0 = 0, s1 = 0; G.forEach((x, q) => { const w = Math.exp(lw[q] - mx); s0 += w; s1 += w * x; });
      return s1 / s0;
    };
    const blindTheta = estimate((p, k) => Math.ceil(blind[PX.ex.paramsKey(p)] * k));
    const partialTheta = (() => { const G2 = G.map((x) => -(x * x) / (2 * 2.25)); for (let i = 0; i < 5; i++) G.forEach((x, q) => { G2[q] += T.cells.logp(x, -2.1, 4, 3); }); let mx = Math.max(...G2), s0 = 0, s1 = 0; G.forEach((x, q) => { const w = Math.exp(G2[q] - mx); s0 += w; s1 += w * x; }); return s1 / s0; })();
    t.ok(blindTheta < -2.5, `a blind answer of the best positional squares reads ${blindTheta.toFixed(2)} in a 5-item check (< −2.5)`);
    t.ok(partialTheta > -2.5, `3 of 4 squares on the easiest grid, five times, reads ${partialTheta.toFixed(2)} (> −2.5)`);
    console.log(`       patterns: a blind answer in a 5-item check reads ${blindTheta.toFixed(2)}; 3 of 4 squares on the easiest grid ${partialTheta.toFixed(2)}`);
  }
  console.log('       patterns shortcuts, worst margin over chance: ' + Object.entries(worst).map(([nm, [d, lv]]) => `${nm} ${(100 * d).toFixed(1)} (${lv})`).join(', '));


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
