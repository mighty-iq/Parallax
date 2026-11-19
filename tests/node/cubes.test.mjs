/* EX-18 Painted Cubes: generator, validator (independent recount and ray cast), scorer, difficulty,
   camera, figure sets (version 3: 2–4 questions a figure, five painted sides), shortcut solvers on
   every question, partial counts (O57), an independent solver from the picture with a one-column
   uniqueness proof (O30), Section-mode asks, timing and learn data (ARCHITECTURE §12; R3 §8.4;
   note D1 §6.3). Run through tests/node/run.mjs. PX_REPORT=1 prints the numbers; PX_TEST_ITEMS=<n>
   shortens it. */
import { MANIFEST, deepDiff } from './run.mjs';

const FILES = [...MANIFEST, 'js/ex/cubes/gen.js', 'js/ex/cubes/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // figures: 40 level combinations × 252
// The starter band (v1.2, note D2 §3.3): flat figures (height level 0) and 4–6 cubes (cubes level 0).
const inBand = (p) => p.cubes === 0 || p.height === 0;
const OLD_FLOOR = -2.3, NEW_FLOOR = -3.85;
// Five painted sides: three counts evenly, so the most common answer sits at a third (a scoped
// exception to chance + 10, DECISIONS 19 Nov), held here at FIVE_CAP.
const FIVE_CAP = 0.38;
// Partial counts (O57, DECISIONS 19 Nov): each needs every painted side counted right, so they are
// held at caps per level on stacked figures above the band, not at chance + 10.
const CAPS = { 'visible cubes only': { first: 0.72, later: 0.9 }, 'visible cubes plus one': { first: 0.45, later: 0.45 }, 'column tops only': { first: 0.55, later: 0.6 } };
const procMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };

// One question of a figure as its own item: what generate returns with params.ask = j (the figure
// does not depend on ask; the Section-mode section below regenerates a sample to show it).
export function questionOf(L, item, j) {
  const q = JSON.parse(JSON.stringify(item)), N = item.asks[j], k = L.histogram(item.heights)[N];
  q.params.ask = j; q.pos = j; q.ask = N; q.count = k; q.key = k - 1;
  return q;
}

export async function run(t) {
  const PX = t.context({ files: FILES }).PX;
  const def = PX.ex.get('cubes');
  t.section('cubes: definition');
  t.ok(def, 'cubes is registered');
  if (!def) return;
  const L = def.lib;
  t.eq([def.id, def.version, def.code, def.abilities, def.role, def.answer, def.nOptions, def.pat, def.extraParams],
    ['cubes', 3, 'EX-18', ['Vz'], 'train', 'choice', 5, true, ['ask']], 'id, version 3 (figure sets), code, Vz, choice of 5, pat, extra param ask');
  t.ok(def.set && def.set.param === 'ask' && typeof def.set.size === 'function', 'def.set: the planner\'s questions per figure (param ask, size(params, seed))');
  t.eq(def.dims.map((d) => [d.key, d.levels.length]), [['cubes', 5], ['height', 4], ['asked', 2]], 'dims: a starter level in front of cubes and of tallest column');
  t.eq([def.dims[0].levels[0], def.dims[1].levels[0]], ['4–6', 1], 'the starter levels: 4–6 cubes, flat (one cube high)');
  t.eq(def.starters, [{ dim: 'height', levels: 1 }, { dim: 'cubes', levels: 1 }], 'starters: the flat level and the 4–6 cubes level');
  const all = PX.ex.enumerate(def);
  t.eq(all.length, 40, 'every level combination is enumerated');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4 - 1e-9, `difficulty spans at least 4 logits (${lo.toFixed(2)} … ${hi.toFixed(2)})`);
  t.near(lo, NEW_FLOOR, 1e-9, 'the floor is −3.85 (flat, 4–6 cubes), as in version 2');
  t.near(hi, 1.7, 1e-9, 'the top of the range is the 1.1 top, as in version 2 (the range is unchanged, so stored levels need no re-basing)');
  // Every 1.1 combination keeps its 1.1 difficulty: −2.3 + 0.85 · size + 0.3 · height + 0.85 · asked.
  let same11 = 0, n11 = 0;
  for (const p of all) if (!inBand(p)) { n11++; if (Math.abs(def.difficulty(p) - (OLD_FLOOR + 0.85 * (p.cubes - 1) + 0.3 * (p.height - 1) + 0.85 * p.asked)) < 1e-9) same11++; }
  t.eq(same11, n11, `every 1.1 combination keeps its 1.1 difficulty (${n11})`);
  t.near(def.difficulty({ cubes: 1, height: 0, asked: 0 }), OLD_FLOOR - 0.85, 1e-9, 'flat: Δ −0.85');
  t.near(def.difficulty({ cubes: 0, height: 1, asked: 0 }), OLD_FLOOR - 0.7, 1e-9, '4–6 cubes: Δ −0.7');
  t.ok(def.difficulty({ cubes: 2, height: 0, asked: 0 }) >= OLD_FLOOR - 1e-9, 'flat 10–13 cubes sit at the pre-1.2 floor (strong beginners leave the band; firstband (c))');
  t.ok([0, 1, 2, 3].every((h) => def.difficulty({ cubes: 0, height: h, asked: 1 }) === def.difficulty({ cubes: 0, height: h, asked: 0 })) &&
    def.difficulty({ cubes: 0, height: 3, asked: 0 }) === def.difficulty({ cubes: 0, height: 2, asked: 0 }), '4–6 cubes: unbuildable settings are priced as what is built');
  t.ok(all.every((p) => def.difficulty({ ...p, ask: 2 }) === def.difficulty(p)), 'the extra param ask never changes the price (the first question is the rated one)');
  const easiest11 = all.filter((p) => !inBand(p)).reduce((a, p) => (def.difficulty(p) < def.difficulty(a) ? p : a));
  const pBeginner = 0.2 + (1 - 0.2 - 0.03) / (1 + Math.exp(def.difficulty(easiest11)));
  t.ok(pBeginner > 0.87 && pBeginner < 0.93, `the pre-1.2 floor is about 90 % right at θ = 0 (${(100 * pBeginner).toFixed(1)} %)`);
  const pBand = 0.2 + (1 - 0.2 - 0.03) / (1 + Math.exp(lo));
  t.ok(pBand > pBeginner + 0.05, `the starter floor is easier still (${(100 * pBand).toFixed(1)} % at θ = 0)`);
  // Re-basing (js/engine/rebase.js): version 3 keeps version 2's range, so a stamped record converts
  // nothing; a 1.1 record converts from V11 as before.
  const rb = t.context({ files: [...FILES, 'js/engine/rebase.js'].filter((f, i, a) => a.indexOf(f) === i) }).PX;
  if (rb.engine && rb.engine.rebase) {
    const R = rb.engine.rebase, d3 = rb.ex.get('cubes'), M = rb.engine.model, r = M.range(d3);
    const rec = { scales: { cubes: [Math.round(r.min * 1e4) / 1e4, Math.round(r.max * 1e4) / 1e4] }, ex: { cubes: { best: { block: { level: 40 } } } } };
    R.run(rec, 4);
    t.eq(rec.ex.cubes.best.block.level, 40, 're-basing: a record stamped with version 2\'s range keeps its levels (the range did not change)');
  }

  t.section('cubes: camera');
  const unit = (v) => Math.hypot(...v);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  t.ok([L.D, L.R, L.U].every((v) => Math.abs(unit(v) - 1) < 1e-12) && Math.abs(dot(L.D, L.R)) < 1e-12 && Math.abs(dot(L.D, L.U)) < 1e-12 && Math.abs(dot(L.R, L.U)) < 1e-12, 'the camera basis is orthonormal');
  t.ok(L.D.every((c) => c > 0), 'the view comes from the front right and above (all three faces that show are top, front, right)');
  let minSep = Infinity;
  for (let x = -4; x <= 4; x++) for (let y = -3; y <= 3; y++) for (let z = -4; z <= 4; z++) {
    if (!x && !y && !z) continue;
    const p = L.proj([x, y, z]);
    minSep = Math.min(minSep, Math.hypot(p[0], p[1]));
  }
  t.ok(minSep >= 0.34, `no two cube positions of a 5 × 5 × 4 figure closer than 0.34 cube edges on screen (${minSep.toFixed(3)}; isometric would give 0)`);

  t.section('cubes: items (every question of every figure)');
  const per = Math.max(1, Math.ceil(N_ITEMS / all.length));
  let threw = 0, invalid = 0, keyWrong = 0, foilRight = 0, nonJson = 0, fallbacks = 0, firstBad = null, n = 0, nq = 0, hiddenItems = 0;
  const keyHist = [0, 0, 0, 0, 0], items = [], acc = {}, accBand = {}, laterN = {}, posKeys = {}, cellKeys = [], laterCells = [], asksLen = [0, 0, 0, 0, 0];
  const fiveH = [0, 0, 0, 0, 0, 0], partial = {};
  let asksBad = 0, sizeBad = 0, rayOff = 0, minTopRay = 1, nOld = 0, flatBad = 0, nBand = 0, valueBad = 0, fiveSets = 0, fiveEligible = 0, fiveWrongLevel = 0;
  for (let ci = 0; ci < all.length; ci++) {
    for (let s = 0; s < per; s++) {
      const params = all[ci], seed = PX.rng.hash('cubes-test', ci, s);
      let item;
      try { item = def.generate(PX.rng(seed), params); } catch (e) { threw++; firstBad = firstBad || `throw ${JSON.stringify(params)}: ${e.message}`; continue; }
      n++;
      if (item.fallback) fallbacks++;
      if (!item.fallback && item.asks.length !== def.set.size(params, seed)) sizeBad++;
      asksLen[Math.min(4, item.asks.length)] += inBand(params) ? 0 : 1;
      if (L.fiveOk(params)) { fiveEligible++; if (item.asks.includes(5)) fiveSets++; } else if (item.asks.includes(5)) fiveWrongLevel++;
      if (n % 50 === 0 && deepDiff(JSON.parse(JSON.stringify(item)), item) !== null) nonJson++;
      if (n % 8 === 0) items.push({ seed, params, item });
      if (!inBand(params)) { nOld++; if (item.hidden > 0) hiddenItems++; }
      // Flat figures: no cube hidden, and every cube's count is 5 minus the cubes it touches.
      if (params.height === 0 && (item.hidden !== 0 || L.cubesOf(item.heights).some((q) => q.painted !== 5 - [1, 2, 3, 4].filter((s2) => !q.sides[s2]).length))) flatBad++;
      const hist = L.histogram(item.heights), five = item.asks.includes(5), KR = five ? L.krange5(params) : L.krange(params);
      if (item.asks.some((m, j) => !(j > 0 && m === 5 ? m >= 1 && hist[5] >= 1 && hist[5] <= 3 : KR[m] && hist[m] >= KR[m][0] && hist[m] <= KR[m][1])) || new Set(item.asks).size !== item.asks.length) asksBad++;
      // The validator's ray cast against the generator's z-buffer.
      const rv = L.rayView(item.heights), zv = L.sight(item.heights);
      if (rv.hidden !== zv.hidden || (rv.minTop < 0.5) !== (zv.minTop < 0.5)) rayOff++;
      minTopRay = Math.min(minTopRay, rv.minTop);
      const prevKeys = [], sight = zv;
      for (let j = 0; j < item.asks.length; j++) {
        const q = j === 0 ? item : questionOf(L, item, j);
        nq++;
        const v = def.validate(q);
        if (v !== true) { invalid++; firstBad = firstBad || `${JSON.stringify(q.params)} seed ${seed}: ${v}`; continue; }
        if (!def.score(q, q.key).correct) keyWrong++;
        for (let i = 0; i < 5; i++) if (i !== q.key && def.score(q, i).correct) foilRight++;
        if (def.score(q, q.key).value !== j) valueBad++;
        keyHist[q.key]++;
        (posKeys[j] = posKeys[j] || [0, 0, 0, 0, 0, 0])[q.count]++;
        if (j > 0) (laterN[q.ask] = laterN[q.ask] || [0, 0, 0, 0, 0, 0])[q.count]++;
        if (q.ask === 5) fiveH[q.count]++;
        const sc = solverHits(L, q, prevKeys, sight);
        const pos = j === 0 ? 'first' : 'later';
        for (const [name, hit] of Object.entries(sc)) {
          if (name === '_partial') continue;
          addHit(acc, name, hit); addHit(acc, `${name} | ${pos}`, hit);
          if (inBand(params)) addHit(accBand, name, hit);
        }
        if (!inBand(params) && q.ask !== 5) for (const [name, hit] of Object.entries(sc._partial)) { addHit(partial, `${name} | ${pos} | cubes ${params.cubes}`, hit); addHit(partial, `${name} | ${pos}`, hit); }
        if (j === 0) cellKeys.push([`${params.cubes},${params.height},${q.ask}`, q.count, s % 2, inBand(params)]);
        else laterCells.push([`${params.cubes},${params.height},${q.ask}`, q.count, s % 2]);
        prevKeys.push(q.key);
      }
      if (inBand(params)) nBand++;
    }
  }
  t.eq(threw, 0, 'generate never throws' + (firstBad && threw ? ` (${firstBad})` : ''));
  t.ok(n >= Math.min(10000, N_ITEMS), `at least ${Math.min(10000, N_ITEMS)} figures (${n}; ${nq} questions)`);
  t.eq(invalid, 0, 'validate passes on every question of every figure' + (firstBad && invalid ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(foilRight, 0, 'every other option scores wrong');
  t.eq(valueBad, 0, 'score() reports the question\'s place in its set (the trial row\'s value)');
  t.eq(nonJson, 0, 'items survive JSON round trips');
  t.eq(fallbacks, 0, 'no item needed the fallback construction');
  t.ok(keyHist.every((c) => c / nq <= 0.3 && c / nq >= 0.12), `keys spread over 1–5 cubes, none above 30 % (${keyHist.join(', ')})`);
  t.eq(sizeBad, 0, 'every figure has as many questions as def.set.size(params, seed) says');
  t.eq(asksBad, 0, 'asks: different numbers, each count in its level\'s range (five painted sides: 1–3)');
  t.eq(fiveWrongLevel, 0, 'five painted sides is asked only on stacked figures from 10 cubes up');
  t.ok(fiveSets / fiveEligible > 0.18 && fiveSets / fiveEligible < 0.32, `about a quarter of the figures that can ask five painted sides ask it (${fiveSets} of ${fiveEligible})`);
  const meanAsks = asksLen.reduce((x, c, i) => x + c * i, 0) / nOld;
  t.ok(meanAsks >= 2.3 && asksLen[4] > 0 && asksLen[1] === 0, `above the starter band 2–4 questions a figure (mean ${meanAsks.toFixed(2)}; 2/3/4: ${asksLen.slice(2, 5).join('/')})`);
  t.ok(hiddenItems / nOld > 0.5, `above the starter band most figures hide supports the solver must count (${(100 * hiddenItems / nOld).toFixed(0)} %)`);
  t.eq(flatBad, 0, 'flat figures hide no cube, and every cube has 5 minus its neighbours painted sides');
  // RV-dat-style-A §12: the most common answer per level and N, learned on half the items and
  // tried on the other half (N and k are kept across the figure search's retries); first questions
  // (the rated ones), all items and the starter band's own pool.
  const priorRate = (keys) => {
    const prior = {};
    keys.filter((c) => c[2] === 0).forEach(([cell, k]) => { (prior[cell] = prior[cell] || [0, 0, 0, 0, 0, 0])[k]++; });
    const test = keys.filter((c) => c[2] === 1), guess = (cell) => { const h = prior[cell] || [0, 1, 0, 0, 0, 0]; return h.indexOf(Math.max(...h)); };
    return { hit: test.filter(([cell, k]) => guess(cell) === k).length / test.length, n: test.length };
  };
  for (const [name, keys] of [['first questions', cellKeys], ['starter band', cellKeys.filter((c) => c[3])]]) {
    const pr = priorRate(keys), slack = pr.n < 2000 ? 3 * Math.sqrt(0.25 * 0.75 / pr.n) : 0;
    t.ok(pr.hit <= 0.3 + slack, `"the most common answer for the level and N" (learned on half the items, ${name}) ≤ chance + 10 (${(100 * pr.hit).toFixed(1)} %${slack ? '; quick run, noise allowed' : ''})`);
  }
  t.eq(rayOff, 0, `the validator's ray cast and the generator's z-buffer agree on every figure (smallest column top in view ${minTopRay.toFixed(3)})`);

  t.section('cubes: later questions and positions');
  // Pooled over sizes, as 1.1 bounded Section practice's later questions; at the default size each
  // number has 2,000 or more later questions. Quick runs allow three standard errors of noise.
  for (const [m, h] of Object.entries(laterN)) {
    if (m === '5') continue;
    const tot = h.reduce((x, y) => x + y, 0), top = Math.max(...h), slack = tot < 2000 ? 3 * Math.sqrt(0.25 * 0.75 / tot) : 0;
    t.ok(top / tot <= 0.3 + slack, `later questions about ${m} painted side${m === '1' ? '' : 's'}: the most common answer ≤ chance + 10 (${(100 * top / tot).toFixed(1)} % of ${tot}: ${h.slice(1).join('/')}${slack ? '; quick run, noise allowed' : ''})`);
  }
  for (const [j, h] of Object.entries(posKeys)) {
    const tot = h.reduce((x, y) => x + y, 0), top = Math.max(...h), slack = tot < 2000 ? 3 * Math.sqrt(0.25 * 0.75 / tot) : 0;
    t.ok(top / tot <= 0.3 + slack, `question ${+j + 1} of a figure: the most common answer ≤ chance + 10 (${(100 * top / tot).toFixed(1)} % of ${tot}${slack ? '; quick run, noise allowed' : ''})`);
  }
  const fiveTot = fiveH.reduce((x, y) => x + y, 0), slack5 = N_ITEMS < 10080 ? 3 * Math.sqrt(FIVE_CAP * (1 - FIVE_CAP) / Math.max(1, fiveTot)) : 0; // quick runs only
  t.ok(fiveTot > 0 && Math.max(...fiveH) / fiveTot <= FIVE_CAP + slack5 && fiveH[4] === 0 && fiveH[5] === 0, `five painted sides: 1–3 cubes evenly, the most common at most ${100 * FIVE_CAP} % (scoped; ${fiveH.slice(1, 4).join('/')} of ${fiveTot}${slack5 ? '; quick run, noise allowed' : ''})`);
  const laterPrior = priorRate(laterCells);

  t.section('cubes: partial counts (O57; caps per level on stacked figures above the band)');
  for (const [k, v] of Object.entries(partial)) {
    const [name, pos, lvl] = k.split(' | '), cap = CAPS[name][pos], slack = v.n < 1500 ? 3 * Math.sqrt(cap * (1 - cap) / v.n) : 0;
    t.ok(v.hit / v.n <= cap + slack, `"${name}" on ${pos} questions${lvl ? ', ' + lvl : ''}: at most ${(100 * cap).toFixed(0)} % (${(100 * v.hit / v.n).toFixed(1)} % of ${v.n}${slack ? '; noise allowed' : ''})`);
  }

  t.section('cubes: validator catches broken items');
  const base = items.find((x) => x.item.hidden > 0 && x.item.asks.length >= 2).item;
  const broken = [
    ['the key moved', (it) => { it.key = (it.key + 1) % 5; }],
    ['a floating cube (a column made taller behind the view)', (it) => { it.heights[0][0] = 4; }],
    ['an empty grid cell filled in front, hiding a top', (it) => { const G = it.grid; it.heights[G - 1][G - 1] = 4; }],
    ['options other than 1–5', (it) => { it.options = [0, 1, 2, 3, 4]; }],
    ['asked N changed', (it) => { it.ask = it.ask === 1 ? 2 : 1; }],
    ['a column split in two', (it) => { const G = it.grid; for (let z = 0; z < G; z++) it.heights[z][1] = 0; }],
    ['a later question about 5 painted sides added', (it) => { it.asks.push(5); }],
    ['a later question asked twice', (it) => { it.asks.push(it.asks[0]); }],
    ['a question dropped from the set', (it) => { it.asks.pop(); }],
    ['the question\'s place differs from params.ask', (it) => { it.pos = 1; }],
    ['the hidden count changed', (it) => { it.hidden += 1; }],
  ];
  for (const [name, edit] of broken) {
    const it = JSON.parse(JSON.stringify(base));
    edit(it);
    t.ok(def.validate(it) !== true, `rejects: ${name}`);
  }

  t.section('cubes: Section-mode questions about one figure (params.ask)');
  let askBad = 0;
  for (const { seed, params, item } of items.slice(0, 160)) {
    for (let a = 0; a < item.asks.length; a++) {
      const it = def.generate(PX.rng(seed), { ...params, ask: a });
      const ok = def.validate(it) === true && deepDiff(it.heights, item.heights) === null && it.ask === item.asks[a] && it.pos === a && deepDiff(it, questionOf(L, item, a)) === null;
      if (!ok) askBad++;
    }
  }
  t.eq(askBad, 0, 'params.ask asks the i-th question about the same figure, every one valid and equal to the derived question');

  t.section('cubes: determinism');
  let diff = 0, firstDiff = null;
  for (const x of items) {
    const d = deepDiff(def.generate(PX.rng(x.seed), x.params), x.item);
    if (d) { diff++; firstDiff = firstDiff || d; }
  }
  t.eq(diff, 0, `the same seed gives the same item (${items.length} regenerated)` + (firstDiff ? `: ${firstDiff}` : ''));
  const other = t.context({ files: FILES }).PX.ex.get('cubes');
  let diff2 = 0;
  for (const x of items.slice(0, 200)) if (deepDiff(other.generate(PX.rng(x.seed), x.params), x.item)) diff2++;
  t.eq(diff2, 0, 'the same items in a freshly loaded context');

  t.section('cubes: malformed responses and fallback');
  let malformedRight = 0;
  for (const { item } of items.slice(0, 200)) {
    for (const r of [-1, 5, 1.5, String(item.key), null, undefined, NaN, [item.key], {}, true]) {
      let res;
      try { res = def.score(item, r); } catch (e) { res = { correct: true }; }
      if (!res || res.correct !== false) malformedRight++;
    }
  }
  t.eq(malformedRight, 0, 'malformed responses score wrong and never throw');
  let badFallback = 0, firstFallback = null;
  for (const params of all) {
    const it = L.fallback(params), v = it ? def.validate(it) : 'no item';
    if (!it || it.fallback !== true || v !== true) { badFallback++; firstFallback = firstFallback || `${JSON.stringify(params)}: ${v}`; }
  }
  t.eq(badFallback, 0, 'the fallback construction is valid for every params combination' + (firstFallback ? ` (${firstFallback})` : ''));

  t.section('cubes: timing');
  const hardest = all.reduce((a, p) => (def.difficulty(p) > def.difficulty(a) ? p : a));
  const q = (a, f) => [...a].sort((x, y) => x - y)[Math.floor(f * (a.length - 1))];
  let p95 = Infinity, worst = [];
  for (let round = 0; round < 3; round++) {
    const cpu = [];
    for (let s = 0; s < 150; s++) { const c0 = procMs(); def.generate(PX.rng(PX.rng.hash('time', round, s)), hardest); cpu.push(procMs() - c0); }
    if (q(cpu, 0.95) < p95) { p95 = q(cpu, 0.95); worst = cpu; }
  }
  t.ok(p95 < 20, `generation p95 at the hardest level under 20 ms (CPU ${p95.toFixed(1)} ms, max ${Math.max(...worst).toFixed(1)} ms)`);

  t.section('cubes: shortcut solvers on every question (all, first, later; then the starter band\'s own pool)');
  const bound = 0.2 + 0.10, pct = (x) => (100 * x).toFixed(1) + ' %';
  for (const [k, v] of Object.entries(acc)) {
    const slack = v.n < 2000 ? 3 * Math.sqrt(0.2 * 0.8 / v.n) : 0;
    t.ok(v.hit / v.n <= bound + slack, `"${k}" ≤ chance + 10 (${pct(v.hit / v.n)} of ${v.n}${slack ? ', noise allowed' : ''})`);
  }
  t.ok(nBand >= Math.min(2000, N_ITEMS / 3), `the starter band's pool holds ${nBand} figures`);
  for (const [k, v] of Object.entries(accBand)) {
    const slack = v.n < 2000 ? 3 * Math.sqrt(0.2 * 0.8 / v.n) : 0;
    t.ok(v.hit / v.n <= bound + slack, `starter band: "${k}" ≤ chance + 10 (${pct(v.hit / v.n)}${slack ? ', quick run' : ''})`);
  }

  t.section('cubes: an independent solver from the picture (O30)');
  // This file's own reading of the picture, by ray marching (the generator uses a z-buffer, the
  // validator a slab ray cast). The format's rule says a cube out of sight only holds others up, so
  // every column's top is in view; then a column is as tall as its highest top in view, and the
  // painted sides follow from neighbour tests written here. A brute-force search then changes each
  // column to every other height (0–4): none gives the same tops in view while keeping every
  // column's top in view, so the picture has one reading (with every top in view, any reading with
  // the same tops would rebuild to the same heights).
  const sample = items.filter((x, i) => i % 6 === 0).slice(0, Math.min(150, items.length));
  let solveBad = 0, ruleBad = 0, ambiguous = 0, firstSolve = null, tried = 0;
  for (const { item } of sample) {
    const H = item.heights, G = H.length, seen = topsInView(H, L.D, 3);
    if (!topsAllInView(H, seen)) { ruleBad++; firstSolve = firstSolve || `a column top out of view (seed ${item.seed})`; continue; }
    const R2 = reconstruct(G, seen);
    if (deepDiff(R2, H) !== null) { solveBad++; firstSolve = firstSolve || `heights from the tops in view differ (seed ${item.seed})`; continue; }
    const counts = paintedCounts(R2), hist = L.histogram(H);
    if (item.asks.some((N) => counts[N] !== hist[N])) { solveBad++; firstSolve = firstSolve || `counts differ (seed ${item.seed})`; }
    const key0 = [...topsInView(H, L.D, 2)].sort().join(';');
    for (let z = 0; z < G; z++) for (let x = 0; x < G; x++) for (let h = 0; h <= 4; h++) {
      if (h === H[z][x]) continue;
      const H2 = H.map((row) => row.slice()); H2[z][x] = h;
      tried++;
      const s2 = topsInView(H2, L.D, 2);
      if ([...s2].sort().join(';') === key0 && topsAllInView(H2, s2)) { ambiguous++; firstSolve = firstSolve || `a column of another height reads the same (seed ${item.seed}, ${x},${z} → ${h})`; }
    }
  }
  t.eq(ruleBad, 0, `every column's top is in view by this file's own ray marching (${sample.length} figures)` + (firstSolve && ruleBad ? `: ${firstSolve}` : ''));
  t.eq(solveBad, 0, `every question of every figure is solved from the tops in view alone (${sample.length} figures)` + (firstSolve && solveBad ? `: ${firstSolve}` : ''));
  t.eq(ambiguous, 0, `no column of another height gives the same tops in view under the format's rule (${tried} figures searched)` + (firstSolve && ambiguous ? `: ${firstSolve}` : ''));

  if (process.env.PX_REPORT) {
    console.log('       cubes: ' + Object.entries(acc).map(([k, v]) => `${k} ${pct(v.hit / v.n)}`).join(', '));
    console.log('       cubes, starter band: ' + Object.entries(accBand).map(([k, v]) => `${k} ${pct(v.hit / v.n)}`).join(', '));
    console.log('       partial counts: ' + Object.entries(partial).map(([k, v]) => `${k} ${pct(v.hit / v.n)} (${v.n})`).join(', '));
    console.log(`       keys ${keyHist.join(',')}; positions ${JSON.stringify(posKeys)}; five ${fiveH.slice(1, 4).join('/')}; hidden in ${(100 * hiddenItems / nOld).toFixed(0)} % above the band; CPU p95 ${p95.toFixed(1)} ms`);
    console.log(`       later questions by N (counts 0–5) ${JSON.stringify(laterN)}; questions per figure 2/3/4 ${asksLen.slice(2, 5).join('/')} (mean ${meanAsks.toFixed(2)}); ray cast: smallest top ${minTopRay.toFixed(3)}`);
    console.log(`       info: the most common answer per level and N on later questions (learned on half) ${(100 * laterPrior.hit).toFixed(1)} % of ${laterPrior.n} (unrated questions; bounded per number over all sizes above)`);
  }
  testRange(t, PX, def);
  testLearn(t, PX, def);
}

/* ---------- test-range tags (CONTRACT-v1.2 W3; DECISIONS 19 Nov) ---------- */

function testRange(t, PX, def) {
  t.section('cubes: test-range tags');
  const R = def.testRange;
  t.ok(R && R.dims && R.dims.cubes && R.dims.height, 'a test range on the cubes and the tallest column');
  if (!R || !PX.ex.rangeTag) return;
  t.eq(R.dims.cubes, ['below', 'test', 'test', 'test', 'test'], 'cubes: 4–6 below the test (a starter level), 6–22 inside it');
  t.eq(R.dims.height, ['below', 'test', 'test', 'test'], 'tallest column: flat below the test, 2–4 high inside it');
  t.ok(!R.dims.asked, 'the painted sides asked carry no tag (both classes, and five painted sides, are the format\'s)');
  const all = PX.ex.enumerate(def), tag = (p) => PX.ex.rangeTag(def, p);
  t.ok(all.every((p) => tag(p) === (p.cubes === 0 || p.height === 0 ? 'below' : 'test')), 'rangeTag: below on the starter band, else test range; never beyond');
  t.eq(all.filter((p) => tag(p) === 'test').length, 4 * 3 * 2, 'every stacked figure from 6 cubes up is inside the test range (24 combinations)');
  const notes = Object.values(R.notes || {});
  t.ok(notes.length === 3 && notes.every((x) => typeof x === 'string' && x.length <= 240), 'notes on the cubes, the height and the whole format, each 240 characters or fewer');
  t.ok(/not documented officially/.test(R.notes.cubes) && /not documented officially/.test(R.notes['*']), 'figure sizes and questions per figure: not documented officially (note D1 addendum A.4 row 7)');
  t.ok(!/scor|predict|difficult|easier|harder|forecast/i.test(notes.join(' ')), 'the notes describe format features only: no score, prediction or difficulty of the real test');
}

function addHit(acc, name, hit) { const a = acc[name] = acc[name] || { hit: 0, n: 0 }; a.hit += hit; a.n++; }

// Cheap solvers on one question: each predicts a count and scores when it is the key (a prediction
// outside 1–5 is moved to the nearest option). prevKeys: the keys of the figure's earlier questions.
// _partial: the partial counts of O57 (each needs every painted side counted right).
function solverHits(L, item, prevKeys, sight) {
  const out = {}, k = item.count, N = item.ask, H = item.heights;
  const clampHit = (pred) => (Math.min(5, Math.max(1, pred)) === k ? 1 : 0);
  for (let c = 1; c <= 5; c++) out[`always ${c}`] = k === c ? 1 : 0;
  const cubes = L.total(H), cols = H.flat().filter((h) => h > 0).length;
  out['cubes mod 5'] = clampHit((cubes % 5) + 1);
  out['columns mod 5'] = clampHit((cols % 5) + 1);
  out['tallest column'] = clampHit(Math.max(...H.flat()));
  const s = sight || L.sight(H);
  out['cubes that show N painted faces (the novice error)'] = clampHit(L.shownCount(s, N));
  const pt = L.partials(s, H, N);
  out['counting the bottom as painted'] = clampHit(pt.bottom);
  if (prevKeys && prevKeys.length) {
    const used = new Set(prevKeys);
    out['an answer the figure has not had yet'] = used.has(item.key) ? 0 : 1 / (5 - used.size);
    out['the answer of the question before'] = prevKeys[prevKeys.length - 1] === item.key ? 1 : 0;
  }
  out._partial = {
    'visible cubes only': clampHit(pt.vis), 'visible cubes plus one': clampHit(pt.vis + 1), 'column tops only': clampHit(pt.tops),
  };
  return out;
}

/* ---------- the picture, read with this file's own code (O30) ---------- */

// The tops in view: every column-top face (x, y, z) with a ray from one of n × n points on it that
// reaches the open air towards the viewer (marched in steps of 1/40 of an edge).
function occupied(H, x, y, z) {
  const G = H.length, cx = Math.floor(x), cz = Math.floor(z);
  return cx >= 0 && cz >= 0 && cx < G && cz < G && y >= 0 && y < H[cz][cx];
}
function rayFree(H, P, D) {
  const G = H.length;
  for (let t2 = 0.002; t2 < 40; t2 += 0.025) {
    const x = P[0] + t2 * D[0], y = P[1] + t2 * D[1], z = P[2] + t2 * D[2];
    if (y > 4 || x > G || z > G) return true;
    if (occupied(H, x, y, z)) return false;
  }
  return true;
}
function topsInView(H, D, n) {
  const G = H.length, out = new Set();
  for (let z = 0; z < G; z++) for (let x = 0; x < G; x++) {
    const h = H[z][x];
    if (!h) continue;
    let free = false;
    for (let i = 0; i < n && !free; i++) for (let j = 0; j < n && !free; j++) free = rayFree(H, [x + (i + 0.5) / n, h, z + (j + 0.5) / n], D);
    if (free) out.add(`t${x},${h - 1},${z}`);
  }
  return out;
}
// Heights from the tops in view: a column is as tall as its highest top in view.
function reconstruct(G, seen) {
  const H = Array.from({ length: G }, () => new Array(G).fill(0));
  for (const f of seen) {
    if (f[0] !== 't') continue;
    const [x, y, z] = f.slice(1).split(',').map(Number);
    H[z][x] = Math.max(H[z][x], y + 1);
  }
  return H;
}
function topsAllInView(H, seen) {
  for (let z = 0; z < H.length; z++) for (let x = 0; x < H.length; x++) if (H[z][x] > 0 && !seen.has(`t${x},${H[z][x] - 1},${z}`)) return false;
  return true;
}
// Painted sides by neighbour tests (this file's own count): top if nothing above, each side with no
// neighbour at that height; never the bottom.
function paintedCounts(H) {
  const G = H.length, c = [0, 0, 0, 0, 0, 0], at = (x, z) => (x < 0 || z < 0 || x >= G || z >= G ? 0 : H[z][x]);
  for (let z = 0; z < G; z++) for (let x = 0; x < G; x++) for (let y = 0; y < H[z][x]; y++) {
    c[(y === H[z][x] - 1 ? 1 : 0) + (at(x + 1, z) <= y ? 1 : 0) + (at(x - 1, z) <= y ? 1 : 0) + (at(x, z + 1) <= y ? 1 : 0) + (at(x, z - 1) <= y ? 1 : 0)]++;
  }
  return c;
}

/* ---------- learn data (js/ex/cubes/learn.js) ---------- */

function testLearn(t, PX, def) {
  t.section('cubes: learn');
  const L = PX.ex.learn('cubes');
  t.ok(L && typeof L === 'object', 'learn data is registered');
  if (!L) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, `a one-line goal (${(L.goal || '').length} characters)`);
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  const floor = PX.ex.minDifficulty(def);
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed)), 'demo items with valid params');
  t.ok(L.demo.every((d) => def.difficulty(d.params) <= floor + 1e-9), 'the Watch is at the starter floor (note D2 §3.0 C 2)');
  // The teaching template (CONTRACT-v1.2 D; note D2 §3.0 C, §3.3).
  t.ok(Array.isArray(L.rules) && L.rules.length >= 2 && L.rules.length <= 4 && L.rules.every((r) => (typeof r === 'string' && r.length > 10) || (r && typeof r.text === 'string' && r.text.length > 10 && typeof r.fig === 'string' && r.fig)), 'a rules card: 2–4 rules, each a text or { text, fig }');
  const ruleText = L.rules.map((r) => (typeof r === 'string' ? r : r.text)).join(' ');
  t.ok(/touch/.test(ruleText) && /under/.test(ruleText) && /hold up/.test(ruleText), 'the three rules of note D2 §3.3: touching faces, a cube under another, hidden supports');
  const first = (L.strategies || []).find((x) => x.id === L.strategyFirst);
  t.ok(first && first.steps.length === 3 && /Count by position/.test(first.title), 'strategyFirst names the "Count by position" card, three steps');
  t.ok(Array.isArray(L.practice) && L.practice.length === 4 && L.practice.every((x) => x && valid(x.params) && Number.isInteger(x.seed)), 'four Try items as objects { params, seed, … }');
  const P = L.practice;
  t.ok(P[0].assist && P[0].assist.numbers === 2 && !P[1].assist && !P[3].assist, 'Try 1 has its first step done (every number but two); Try 2 and Try 4 have no help');
  t.ok(P[2].assist && P[2].assist.hidden === true && !P[2].assist.numbers, 'Try 3 draws its hidden support dashed (a faded step between the worked example and Try 4)');
  t.ok(typeof L.captions.assistHidden === 'string' && /\{what\}/.test(L.captions.assistHidden), 'the caption for the dashed hidden cube');
  t.ok(def.difficulty(P[0].params) <= floor + 1e-9 && def.difficulty(P[1].params) <= floor + 1e-9, 'Try 1 and Try 2 at the starter floor');
  t.ok(P[2].params.cubes === 0 && P[2].params.height === 1 && P[2].tip === 'hidden', 'Try 3: the small figures two high, with the hidden-cube tip (one new feature)');
  t.ok(Math.abs(def.difficulty(P[3].params) - OLD_FLOOR) < 1e-9, 'Try 4 at the pre-1.2 floor');
  const ds = P.map((x) => def.difficulty(x.params));
  t.ok(ds.every((x, i) => i === 0 || x >= ds[i - 1]), `Try goes from easy to harder (${ds.map((x) => x.toFixed(2)).join(', ')})`);
  t.ok(P.every((x) => !x.tip || (L.tips || []).some((tip) => tip.id === x.tip)), 'forced tips exist');
  const gen = (x) => def.generate(PX.rng(x.seed), x.params);
  const demoItem = gen(L.demo[0]), tryItems = P.map(gen);
  t.ok([demoItem, ...tryItems].every((it) => !it.fallback && def.validate(it) === true), 'the Watch and Try seeds give valid items, none a fallback');
  const keys = [demoItem, ...tryItems].map((it) => it.key);
  t.ok(keys.every((k, i) => i === 0 || k !== keys[i - 1]), `answers vary their slot from item to item (${keys.map((k) => k + 1).join(', ')})`);
  t.ok(demoItem.hidden === 0 && tryItems[0].hidden === 0 && tryItems[1].hidden === 0, 'the Watch and the first two Try items are flat: nothing hidden');
  t.eq(tryItems[2].hidden, 1, 'Try 3 hides exactly one cube');
  const ex3 = P[2].example ? def.generate(PX.rng(P[2].example.seed), P[2].example.params || P[2].params) : null;
  t.ok(ex3 && !ex3.fallback && def.validate(ex3) === true && ex3.hidden === 1 && JSON.stringify(ex3.heights) !== JSON.stringify(tryItems[2].heights),
    'before Try 3 a worked example with one hidden support (another figure than Try 3\'s)');
  const rr4 = def.lib.render(tryItems[3].heights);
  t.ok(rr4.cubes.some((q, i) => q.painted === tryItems[3].ask && rr4.perCube[i].any === 0), 'Try 4 hides a cube that the count includes');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).length && tr.levels.every((l) => l >= 0 && l < d.levels.length)) ||
      (def.extraParams.includes(tr.dim) && (tr.levels || []).length && tr.levels.every((l) => Number.isInteger(l) && l >= 1 && l <= 3));
    t.ok(tip.id && tip.text && tr.dim && dimOk, `tip ${tip.id} has a valid trigger`);
  }
  t.ok((L.tips || []).length >= 3, 'just-in-time tips');
  t.ok((L.tips || []).some((tip) => tip.id === 'set' && tip.when && tip.when.dim === 'ask'), 'a tip for a figure\'s later questions (version 3: params.ask 1–3)');
  t.ok(/2 to 4 questions/.test(L.parts.find((x) => x.id === 'question').text), 'the question part says that larger figures come with 2 to 4 questions');
  t.ok(/A to E/.test(L.parts.find((x) => x.id === 'options').text) && /A–E/.test(L.parts.find((x) => x.id === 'answer').text), 'answers lettered A to E (the format\'s labelling), keys A–E named');
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['figure', 'hidden', 'question', 'options', 'explode', 'numbers', 'numbersFlat', 'tally', 'tallyHidden', 'skip', 'done', 'chosen', 'assist'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  t.ok(typeof L.bridge === 'string' && /not been shown/.test(L.bridge), 'a "where it is used" card with its limitation line');
  const ADA = 'DAT® and Dental Admission Test are marks of the American Dental Association. Parallax is not affiliated with or endorsed by the ADA. Every item is generated by the app; none is taken from the DAT.';
  const strings = [];
  (function walk(x) { if (typeof x === 'string') strings.push(x); else if (x && typeof x === 'object') Object.values(x).forEach(walk); })(L);
  t.ok(strings.filter((s) => /\bDAT\b|Dental Admission Test/.test(s)).every((s) => s.includes(ADA)), 'every text that names the DAT carries the ADA line');
  const texts = JSON.stringify(L).split(ADA).join('');
  t.ok(!/\b(raise|boost|improve)s? (your )?(DAT|PAT) scores?\b|predicted (DAT|PAT)|DAT score gain/i.test(texts), 'no claim of DAT score gains');
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered/.test(texts.toLowerCase()), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
}

/* v1.2 wave 2 (W2-progress): per-item shortcut scores for tests/node/shortcut-levels.test.mjs */
// Every question of every figure is an item there (shortcutItems: about 11,000 questions on 5,000
// figures over every combination), so the rules this file bounds are checked per level of every
// dimension on first and later questions alike. The partial counts (O57) are reported, not bounded
// (info): they are held at caps per level above.
// The answers are lettered A–E for 1–5 cubes (the sheet's mapping), so "always the same letter" is
// the "always c" family; "the letter the last item had" (lead's fresh-player run of Angles, 19 Nov)
// reads the item before in the stream: the question before on the same figure, or the last
// question of the figure before.
let lastKey = null;
export function shortcutScores(PX, def, item) {
  const L = def.lib, out = {};
  const prev = item.asks.slice(0, item.pos).map((N) => L.histogram(item.heights)[N] - 1);
  for (const [name, hit] of Object.entries(solverHits(L, item, prev))) {
    if (name === '_partial') for (const [pn, ph] of Object.entries(hit)) out[pn] = { hit: ph, chance: 0.2, info: true };
    else out[name] = { hit, chance: 0.2 };
  }
  if (lastKey !== null) out['the letter the last item had'] = { hit: item.key === lastKey ? 1 : 0, chance: 0.2 };
  lastKey = item.key;
  return out;
}
export const SHORTCUT_EXEMPT = [];
export function* shortcutItems(PX, def) {
  const combos = PX.ex.enumerate(def), per = Math.ceil(5000 / combos.length), L = def.lib;
  for (let ci = 0; ci < combos.length; ci++) {
    for (let s = 0; s < per; s++) {
      const item = def.generate(PX.rng(PX.rng.hash('shortcut-levels', 'cubes', ci, s)), combos[ci]);
      if (item.fallback) continue;
      for (let j = 0; j < item.asks.length; j++) { const q = j === 0 ? item : questionOf(L, item, j); yield { params: q.params, item: q }; }
    }
  }
}
