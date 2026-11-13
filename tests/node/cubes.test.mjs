/* EX-18 Painted Cubes: generator, validator (independent recount and z-buffer), scorer, difficulty,
   camera, shortcut solvers, Section-mode asks, timing and learn data (ARCHITECTURE §12; R3 §8.4).
   Run through tests/node/run.mjs. PX_REPORT=1 prints the numbers; PX_TEST_ITEMS=<n> shortens it. */
import { MANIFEST, deepDiff } from './run.mjs';

const FILES = [...MANIFEST, 'js/ex/cubes/gen.js', 'js/ex/cubes/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // 24 level combinations × 420
const procMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };

export async function run(t) {
  const PX = t.context({ files: FILES }).PX;
  const def = PX.ex.get('cubes');
  t.section('cubes: definition');
  t.ok(def, 'cubes is registered');
  if (!def) return;
  const L = def.lib;
  t.eq([def.id, def.version, def.code, def.abilities, def.role, def.answer, def.nOptions, def.pat, def.extraParams],
    ['cubes', 1, 'EX-18', ['Vz'], 'train', 'choice', 5, true, ['ask']], 'id, version, code, Vz, choice of 5, pat, extra param ask');
  const all = PX.ex.enumerate(def);
  t.eq(all.length, 24, 'every level combination is enumerated');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4 - 1e-9, `difficulty spans at least 4 logits (${lo.toFixed(2)} … ${hi.toFixed(2)})`);
  const easiest = all.reduce((a, p) => (def.difficulty(p) < def.difficulty(a) ? p : a));
  const pBeginner = 0.2 + (1 - 0.2 - 0.03) / (1 + Math.exp(def.difficulty(easiest)));
  t.ok(pBeginner > 0.87 && pBeginner < 0.93, `the easiest item is about 90 % right at θ = 0 (${(100 * pBeginner).toFixed(1)} %)`);

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

  t.section('cubes: items');
  const per = Math.max(1, Math.ceil(N_ITEMS / all.length));
  let threw = 0, invalid = 0, keyWrong = 0, foilRight = 0, nonJson = 0, fallbacks = 0, firstBad = null, n = 0, hiddenItems = 0;
  const keyHist = [0, 0, 0, 0, 0], perN = {}, items = [], acc = {}, laterN = {}, cellKeys = [], asksLen = [0, 0, 0, 0, 0, 0];
  let asksBad = 0, rayOff = 0, minTopRay = 1;
  for (let ci = 0; ci < all.length; ci++) {
    for (let s = 0; s < per; s++) {
      const params = all[ci], seed = PX.rng.hash('cubes-test', ci, s);
      let item;
      try { item = def.generate(PX.rng(seed), params); } catch (e) { threw++; firstBad = firstBad || `throw ${JSON.stringify(params)}: ${e.message}`; continue; }
      n++;
      if (item.fallback) fallbacks++;
      const v = def.validate(item);
      if (v !== true) { invalid++; firstBad = firstBad || `${JSON.stringify(params)} seed ${seed}: ${v}`; continue; }
      if (!def.score(item, item.key).correct) keyWrong++;
      for (let i = 0; i < 5; i++) if (i !== item.key && def.score(item, i).correct) foilRight++;
      if (n % 50 === 0 && deepDiff(JSON.parse(JSON.stringify(item)), item) !== null) nonJson++;
      if (n % 8 === 0) items.push({ seed, params, item });
      keyHist[item.key]++;
      (perN[item.ask] = perN[item.ask] || [0, 0, 0, 0, 0])[item.key]++;
      if (item.hidden > 0) hiddenItems++;
      shortcuts(L, item, acc);
      // Section mode's later questions: N in KRANGE at this size (never 5), each count in its range.
      const hist = L.histogram(item.heights), KR = L.KRANGE[params.cubes];
      asksLen[Math.min(5, item.asks.length)]++;
      if (item.asks[0] !== item.ask || new Set(item.asks).size !== item.asks.length || item.asks.some((m) => !KR[m] || hist[m] < KR[m][0] || hist[m] > KR[m][1])) asksBad++;
      item.asks.slice(1).forEach((m) => { (laterN[m] = laterN[m] || [0, 0, 0, 0, 0, 0])[hist[m]]++; });
      cellKeys.push([`${params.cubes},${params.height},${item.ask}`, item.count, s % 2]);
      // The validator's ray cast against the generator's z-buffer.
      const rv = L.rayView(item.heights), zv = L.sight(item.heights);
      if (rv.hidden !== zv.hidden || (rv.minTop < 0.5) !== (zv.minTop < 0.5)) rayOff++;
      minTopRay = Math.min(minTopRay, rv.minTop);
    }
  }
  t.eq(threw, 0, 'generate never throws' + (firstBad && threw ? ` (${firstBad})` : ''));
  t.ok(n >= Math.min(10000, N_ITEMS), `at least ${Math.min(10000, N_ITEMS)} items (${n})`);
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad && invalid ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(foilRight, 0, 'every other option scores wrong');
  t.eq(nonJson, 0, 'items survive JSON round trips');
  t.eq(fallbacks, 0, 'no item needed the fallback construction');
  t.ok(keyHist.every((c) => c / n <= 0.3 && c / n >= 0.12), `keys spread over 1–5 cubes, none above 30 % (${keyHist.join(', ')})`);
  t.ok(!perN[5] && !perN[0], 'never asks for 0 or 5 painted sides');
  const bestPerN = Object.values(perN).reduce((s, h) => s + Math.max(...h), 0) / n;
  t.ok(bestPerN <= 0.3, `"the most common answer for the asked N" ≤ chance + 10 (${(100 * bestPerN).toFixed(1)} %)`);
  t.ok(hiddenItems / n > 0.5, `most figures hide supports the solver must count (${(100 * hiddenItems / n).toFixed(0)} %)`);
  // RV-dat-style-A §12: the most common answer per level and N, learned on half the items and
  // tried on the other half (N and k are kept across the figure search's retries).
  const prior = {};
  cellKeys.filter((c) => c[2] === 0).forEach(([cell, k]) => { (prior[cell] = prior[cell] || [0, 0, 0, 0, 0, 0])[k]++; });
  const test = cellKeys.filter((c) => c[2] === 1), guess = (cell) => { const h = prior[cell] || [0, 1, 0, 0, 0, 0]; return h.indexOf(Math.max(...h)); };
  const priorHit = test.filter(([cell, k]) => guess(cell) === k).length / test.length;
  t.ok(priorHit <= 0.3, `"the most common answer for the level and N" (learned on half the items) ≤ chance + 10 (${(100 * priorHit).toFixed(1)} %)`);
  t.eq(rayOff, 0, `the validator's ray cast and the generator's z-buffer agree on every figure (smallest column top in view ${minTopRay.toFixed(3)})`);

  t.section('cubes: later questions (Section mode)');
  t.eq(asksBad, 0, 'asks: the item\'s own question first, then other N that KRANGE allows at this size, counts in range, never 5');
  for (const [m, h] of Object.entries(laterN)) {
    const tot = h.reduce((x, y) => x + y, 0), top = Math.max(...h);
    t.ok(top / tot <= 0.3, `later questions for ${m} painted side${m === '1' ? '' : 's'}: the most common answer ≤ chance + 10 (${(100 * top / tot).toFixed(1)} % of ${tot}: ${h.slice(1).join('/')})`);
  }
  const meanAsks = asksLen.reduce((x, c, i) => x + c * i, 0) / n;
  t.ok(meanAsks >= 2, `about two or more questions per figure for Section mode (mean ${meanAsks.toFixed(2)}; 1/2/3/4: ${asksLen.slice(1, 5).join('/')})`);

  t.section('cubes: validator catches broken items');
  const base = items.find((x) => x.item.hidden > 0).item;
  const broken = [
    ['the key moved', (it) => { it.key = (it.key + 1) % 5; }],
    ['a floating cube (a column made taller behind the view)', (it) => { it.heights[0][0] = 4; }],
    ['an empty grid cell filled in front, hiding a top', (it) => { const G = it.grid; it.heights[G - 1][G - 1] = 4; }],
    ['options other than 1–5', (it) => { it.options = [0, 1, 2, 3, 4]; }],
    ['asked N changed', (it) => { it.ask = it.ask === 1 ? 2 : 1; }],
    ['a column split in two', (it) => { const G = it.grid; for (let z = 0; z < G; z++) it.heights[z][1] = 0; }],
    ['a later question about 5 painted sides', (it) => { it.asks.push(5); }],
    ['a later question asked twice', (it) => { it.asks.push(it.asks[0]); }],
    ['the hidden count changed', (it) => { it.hidden += 1; }],
  ];
  for (const [name, edit] of broken) {
    const it = JSON.parse(JSON.stringify(base));
    edit(it);
    t.ok(def.validate(it) !== true, `rejects: ${name}`);
  }

  t.section('cubes: Section-mode questions about one figure');
  let askBad = 0;
  for (const { seed, params, item } of items.slice(0, 120)) {
    for (let a = 0; a < item.asks.length; a++) {
      const it = def.generate(PX.rng(seed), { ...params, ask: a });
      const ok = def.validate(it) === true && deepDiff(it.heights, item.heights) === null && it.ask === item.asks[a];
      if (!ok) askBad++;
    }
  }
  t.eq(askBad, 0, 'params.ask asks the i-th question about the same figure, every one valid');

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

  t.section('cubes: shortcut solvers');
  const bound = 0.2 + 0.10, pct = (x) => (100 * x).toFixed(1) + ' %';
  for (const [k, v] of Object.entries(acc)) {
    if (k.startsWith('info:')) continue;
    t.ok(v.hit / v.n <= bound, `"${k}" ≤ chance + 10 (${pct(v.hit / v.n)})`);
  }
  if (process.env.PX_REPORT) {
    console.log('       cubes: ' + Object.entries(acc).map(([k, v]) => `${k} ${pct(v.hit / v.n)}`).join(', '));
    console.log(`       keys ${keyHist.join(',')}; per N ${JSON.stringify(perN)}; hidden in ${(100 * hiddenItems / n).toFixed(0)} %; CPU p95 ${p95.toFixed(1)} ms`);
    console.log(`       later questions by N (counts 0–5) ${JSON.stringify(laterN)}; questions per figure 1/2/3/4 ${asksLen.slice(1, 5).join('/')} (mean ${meanAsks.toFixed(2)}); level prior ${(100 * priorHit).toFixed(1)} %; ray cast: smallest top ${minTopRay.toFixed(3)}`);
  }
  testLearn(t, PX, def);
}

// Cheap solvers: each predicts a count; it scores when the prediction is the key (a prediction
// outside 1–5 is moved to the nearest option).
function shortcuts(L, item, acc) {
  const add = (name, hit) => { const a = acc[name] = acc[name] || { hit: 0, n: 0 }; a.hit += hit; a.n++; };
  const k = item.count, N = item.ask, H = item.heights;
  const clampHit = (pred) => (Math.min(5, Math.max(1, pred)) === k ? 1 : 0);
  for (let c = 1; c <= 5; c++) add(`always ${c}`, k === c ? 1 : 0);
  const cubes = L.total(H), cols = H.flat().filter((h) => h > 0).length;
  add('cubes mod 5', clampHit((cubes % 5) + 1));
  add('columns mod 5', clampHit((cols % 5) + 1));
  add('tallest column', clampHit(Math.max(...H.flat())));
  const s = L.sight(H);
  add('cubes that show N painted faces (the novice error)', clampHit(L.shownCount(s, N)));
  // The bottom counted as painted for cubes on the ground.
  const wrongBottom = L.cubesOf(H).filter((q) => q.painted + (q.y === 0 ? 1 : 0) === N).length;
  add('counting the bottom as painted', clampHit(wrongBottom));
  // Visible cubes only (correct counts, hidden supports missed): a partial solution, reported only.
  const rr = L.render(H), visOnly = rr.cubes.filter((q, i) => q.painted === N && rr.perCube[i].any > 0).length;
  const a = acc['info: visible cubes only'] = acc['info: visible cubes only'] || { hit: 0, n: 0 };
  a.hit += clampHit(visOnly); a.n++;
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
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed)), 'demo items with valid params');
  t.ok(L.demo.every((d) => def.difficulty(d.params) <= PX.ex.minDifficulty(def) + 1e-9), 'demos are at the easiest level');
  t.ok(Array.isArray(L.practice) && L.practice.length >= 3 && L.practice.length <= 5 && L.practice.every(valid), '3–5 practice params');
  const diffs = L.practice.map((p) => def.difficulty(p));
  t.ok(diffs[0] === Math.min(...diffs), 'practice starts at the easiest of its levels');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).length && tr.levels.every((l) => l >= 0 && l < d.levels.length));
    t.ok(tip.id && tip.text && tr.dim && dimOk, `tip ${tip.id} has a valid trigger`);
  }
  t.ok((L.tips || []).length >= 3, 'just-in-time tips');
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['figure', 'question', 'options', 'tally', 'tallyHidden', 'skip', 'done', 'chosen'];
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
