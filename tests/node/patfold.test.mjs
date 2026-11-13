/* EX-17 Hole Punch: generator, validator, scorer, difficulty, shortcut solvers, fallback, timing,
   Fold's unchanged behaviour and learn data (ARCHITECTURE §12; R3 §8.1). Run through
   tests/node/run.mjs. PX_REPORT=1 prints the numbers; PX_TEST_ITEMS=<n> shortens the seed loop. */
import { MANIFEST, deepDiff } from './run.mjs';
import { performance } from 'node:perf_hooks';

const FILES = [...MANIFEST, 'js/ex/fold/gen.js', 'js/ex/patfold/gen.js', 'js/ex/patfold/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // 24 level combinations × 420
const procMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };

// Expected accuracy of a heuristic that picks uniformly among the best-scoring options.
function pickBest(scores, key, larger = true) {
  const best = larger ? Math.max(...scores) : Math.min(...scores);
  const ties = scores.filter((s) => Math.abs(s - best) < 1e-9).length;
  return Math.abs(scores[key] - best) < 1e-9 ? 1 / ties : 0;
}

export async function run(t) {
  const PX = t.context({ files: FILES }).PX;
  const def = PX.ex.get('patfold');
  t.section('patfold: definition');
  t.ok(def, 'patfold is registered');
  if (!def) return;
  t.eq([def.id, def.version, def.code, def.abilities, def.cell, def.role, def.answer, def.nOptions, def.pat, def.perDisplay],
    ['patfold', 1, 'EX-17', ['Vz'], 'intrinsic-dynamic', 'train', 'choice', 5, true, false], 'id, version, code, abilities, cell, role, answer, 5 options, pat');
  t.eq(def.dims.map((d) => d.key), ['folds', 'type', 'idle'], 'dims');
  t.eq(def.dims[0].levels, [2, 3], 'two or three folds (the official rules: more than one fold)');
  const all = PX.ex.enumerate(def);
  t.eq(all.length, 24, 'every level combination is enumerated');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 2.5, `difficulty spans at least 2.5 logits (${lo.toFixed(2)} … ${hi.toFixed(2)}; the format caps folds at 3)`);
  const easiest = all.reduce((a, p) => (def.difficulty(p) < def.difficulty(a) ? p : a));
  const g = def.chance(easiest);
  const pBeginner = g + (1 - g - 0.03) / (1 + Math.exp(def.difficulty(easiest)));
  t.ok(pBeginner > 0.87 && pBeginner < 0.93, `the easiest item is about 90 % right at θ = 0 (${(100 * pBeginner).toFixed(1)} %)`);
  t.ok(all.every((p) => Math.abs(def.chance(p) - 0.2) < 1e-12), 'chance = 1/5');

  t.section('patfold: Fold is unchanged');
  const fold = PX.ex.get('fold');
  t.eq([fold.code, fold.version, fold.lib.N, fold.nOptions], ['EX-04', 1, 8, 5], 'Fold keeps its code, version, sheet size and options');
  const fItem = fold.generate(PX.rng(12345), { folds: 2, type: 3, punches: 1, idle: 0 });
  t.eq([fItem.n, fold.validate(fItem)], [8, true], 'a Fold item after patfold items: 8 × 8 and valid');
  const fRef = t.context({ files: [...MANIFEST, 'js/ex/fold/gen.js'] }).PX.ex.get('fold').generate(PX.rng(12345), { folds: 2, type: 3, punches: 1, idle: 0 });
  def.generate(PX.rng(7), { folds: 1, type: 3, idle: 0 });
  t.eq(deepDiff(fold.generate(PX.rng(12345), { folds: 2, type: 3, punches: 1, idle: 0 }), fRef), null, 'Fold items are identical with and without Hole Punch loaded');
  t.eq(fold.lib.nOptions({ folds: 0 }), 4, 'Fold\'s option count is back to its own rule after a sheet call');

  t.section('patfold: items');
  const per = Math.max(1, Math.ceil(N_ITEMS / all.length));
  let threw = 0, invalid = 0, keyWrong = 0, foilRight = 0, nonJson = 0, optCount = 0, fallbacks = 0, firstBad = null, n = 0;
  const acc = { count: 0, sym1: 0, low1: 0, like: 0, odd: 0, under: 0, symAny: 0, count2: 0 };
  const keyPos = [0, 0, 0, 0, 0], holesHist = {}, whyHist = {}, items = [];
  for (let ci = 0; ci < all.length; ci++) {
    for (let s = 0; s < per; s++) {
      const params = all[ci], seed = PX.rng.hash('patfold-test', ci, s);
      let item;
      try { item = def.generate(PX.rng(seed), params); } catch (e) { threw++; firstBad = firstBad || `throw ${JSON.stringify(params)}: ${e.message}`; continue; }
      n++;
      if (item.fallback) fallbacks++;
      const v = def.validate(item);
      if (v !== true) { invalid++; firstBad = firstBad || `${JSON.stringify(params)} seed ${seed}: ${v}`; continue; }
      if (!def.score(item, item.key).correct) keyWrong++;
      for (let i = 0; i < item.options.length; i++) if (i !== item.key && def.score(item, i).correct) foilRight++;
      if (item.options.length !== 5 || item.options.some((o) => o.length !== item.holes)) optCount++;
      if (n % 50 === 0 && deepDiff(JSON.parse(JSON.stringify(item)), item) !== null) nonJson++;
      if (n % 8 === 0) items.push({ seed, params, item });
      keyPos[item.key]++;
      holesHist[item.holes] = (holesHist[item.holes] || 0) + 1;
      item.why.forEach((w) => { if (w) { const k = w.replace(/\d+/g, '#'); whyHist[k] = (whyHist[k] || 0) + 1; } });
      def.lib.onSheet((A) => shortcuts(A, def.lib, item, acc));
    }
  }
  t.eq(threw, 0, 'generate never throws' + (firstBad && threw ? ` (${firstBad})` : ''));
  t.ok(n >= Math.min(10000, N_ITEMS), `at least ${Math.min(10000, N_ITEMS)} items (${n})`);
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad && invalid ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(foilRight, 0, 'every other option scores wrong');
  t.eq(optCount, 0, '5 options, all with the key\'s hole count');
  t.eq(nonJson, 0, 'items survive JSON round trips');
  t.eq(fallbacks, 0, 'no item needed the fallback construction');
  t.ok(keyPos.every((c) => Math.abs(c / n - 0.2) < Math.max(0.03, 3 * Math.sqrt(0.2 * (1 - 0.2) / n))), `keys spread over the five positions (${keyPos.join(', ')})`);

  t.section('patfold: validator catches broken items');
  const base = items[0].item;
  const broken = [
    ['a foil made right', (it) => { const j = (it.key + 1) % 5; it.options[j] = it.options[it.key].map((c) => c.slice()); }],
    ['a hole moved off the 16 positions', (it) => { it.options[it.key][0] = [4, 0]; }],
    ['the key moved', (it) => { it.key = (it.key + 1) % 5; }],
    ['a second punch', (it) => { it.punches.push([0, 0]); }],
    ['a fold line moved', (it) => { it.folds[0].line.c += 1; }],
    ['a hole of the key moved', (it) => { const c = it.options[it.key][0]; c[0] = (c[0] + 1) % 4; }],
    ['four options', (it) => { it.options.pop(); it.nOptions = 4; }],
  ];
  for (const [name, edit] of broken) {
    const it = JSON.parse(JSON.stringify(base));
    edit(it);
    t.ok(def.validate(it) !== true, `rejects: ${name}`);
  }

  t.section('patfold: determinism');
  let diff = 0, firstDiff = null;
  for (const x of items) {
    const d = deepDiff(def.generate(PX.rng(x.seed), x.params), x.item);
    if (d) { diff++; firstDiff = firstDiff || d; }
  }
  t.eq(diff, 0, `the same seed gives the same item (${items.length} regenerated)` + (firstDiff ? `: ${firstDiff}` : ''));
  const other = t.context({ files: FILES }).PX.ex.get('patfold');
  let diff2 = 0;
  for (const x of items.slice(0, 200)) if (deepDiff(other.generate(PX.rng(x.seed), x.params), x.item)) diff2++;
  t.eq(diff2, 0, 'the same items in a freshly loaded context');

  t.section('patfold: malformed responses and fallback');
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
    const it = def.lib.fallback(params);
    const v = it ? def.validate(it) : 'no item';
    if (!it || it.fallback !== true || v !== true) { badFallback++; firstFallback = firstFallback || `${JSON.stringify(params)}: ${v}`; }
  }
  t.eq(badFallback, 0, 'the fallback construction is valid for every params combination' + (firstFallback ? ` (${firstFallback})` : ''));

  t.section('patfold: timing');
  const hardest = all.reduce((a, p) => (def.difficulty(p) > def.difficulty(a) ? p : a));
  for (let s = 0; s < 30; s++) def.generate(PX.rng(PX.rng.hash('warm', s)), hardest);
  const q = (a, f) => [...a].sort((x, y) => x - y)[Math.floor(f * (a.length - 1))];
  let p95 = Infinity, wall95 = 0;
  for (let round = 0; round < 3; round++) {
    const cpu = [], wall = [];
    for (let s = 0; s < 200; s++) {
      const c0 = procMs(), t0 = performance.now();
      def.generate(PX.rng(PX.rng.hash('time', round, s)), hardest);
      wall.push(performance.now() - t0);
      cpu.push(procMs() - c0);
    }
    if (q(cpu, 0.95) < p95) { p95 = q(cpu, 0.95); wall95 = q(wall, 0.95); }
  }
  t.ok(p95 < 20, `generation p95 at the hardest level under 20 ms (CPU ${p95.toFixed(1)} ms; wall p95 ${wall95.toFixed(1)} ms)`);

  t.section('patfold: shortcut solvers');
  const bound = 0.2 + 0.10;
  const pct = (x) => (100 * x / acc.count).toFixed(1) + ' %';
  for (const [k, name] of [['under', 'a hole under the punch'], ['sym1', 'most symmetric about the first crease'], ['low1', 'least symmetric about the first crease'],
    ['symAny', 'most symmetric about any sheet axis'], ['like', 'most like the others'], ['odd', 'odd one out'], ['count2', 'the hole count 2^folds']]) {
    t.ok(acc[k] / acc.count <= bound, `"${name}" ≤ chance + 10 (${pct(acc[k])}, chance 20 %)`);
  }
  if (process.env.PX_REPORT) {
    console.log(`       patfold: n ${acc.count}; under ${pct(acc.under)}, sym1 ${pct(acc.sym1)}, low1 ${pct(acc.low1)}, symAny ${pct(acc.symAny)}, like ${pct(acc.like)}, odd ${pct(acc.odd)}, count ${pct(acc.count2)}; CPU p95 ${p95.toFixed(1)} ms`);
    console.log('       holes', JSON.stringify(holesHist), 'keys', keyPos.join(','));
    console.log('       foils', JSON.stringify(whyHist));
  }
  testLearn(t, PX, def);
}

function shortcuts(A, lib, item, acc) {
  const opts = item.options, k = item.key, masks = opts.map((o) => A.maskOf(o));
  acc.count++;
  const L1 = item.folds[0].line;
  const s1 = opts.map((o) => A.symScore(o, L1));
  acc.sym1 += pickBest(s1, k);
  acc.low1 += pickBest(s1, k, false);
  const tot = masks.map((m, i) => masks.reduce((s, m2, j) => s + (i === j ? 0 : A.hamming(m, m2)), 0));
  acc.like += pickBest(tot, k, false);
  acc.odd += pickBest(tot, k, true);
  const pm = A.maskOf(item.punches);
  acc.under += pickBest(masks.map((m) => ((m[0] & pm[0]) === pm[0] && (m[1] & pm[1]) === pm[1] ? 1 : 0)), k);
  acc.symAny += pickBest(opts.map((o) => Math.max(...lib.AXES.map((L) => A.symScore(o, L)))), k);
  const want = 2 ** item.folds.length;
  acc.count2 += pickBest(opts.map((o) => -Math.abs(o.length - want)), k);
}

/* ---------- learn data (js/ex/patfold/learn.js) ---------- */

function testLearn(t, PX, def) {
  t.section('patfold: learn');
  const L = PX.ex.learn('patfold');
  t.ok(L && typeof L === 'object', 'learn data is registered');
  if (!L) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, `a one-line goal (${(L.goal || '').length} characters)`);
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed)), 'demo items with valid params');
  t.ok(L.demo.every((d) => def.difficulty(d.params) <= PX.ex.minDifficulty(def) + 1e-9), 'demos are at the easiest level');
  for (const d of L.demo) {
    const item = def.generate(PX.rng(d.seed), d.params);
    const kind = item.folds.every((f) => f.cls === 'H') && item.holes === 2 && !item.fallback ? 'straight' : 'other';
    t.eq(kind, d.kind, `demo seed ${d.seed} gives a ${d.kind} item (straight folds, two holes)`);
  }
  t.ok(Array.isArray(L.practice) && L.practice.length >= 3 && L.practice.length <= 5 && L.practice.every(valid), '3–5 practice params');
  const diffs = L.practice.map((p) => def.difficulty(p));
  t.ok(diffs[0] === Math.min(...diffs), 'practice starts at the easiest of its levels');
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).length && tr.levels.every((l) => l >= 0 && l < d.levels.length));
    t.ok(tip.id && tip.text && tr.dim && dimOk, `tip ${tip.id} has a valid trigger`);
  }
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['folds', 'punch', 'options', 'punched', 'unfold', 'unfoldIdle', 'done', 'chosen'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  t.ok(typeof L.bridge === 'string' && /not been shown/.test(L.bridge), 'a "where it is used" card with its limitation line');
  const ADA = 'DAT® and Dental Admission Test are marks of the American Dental Association. Parallax is not affiliated with or endorsed by the ADA. Every item is generated by the app; none is taken from the DAT.';
  const texts = JSON.stringify(L);
  const namesDat = (s) => /\bDAT\b|Dental Admission Test/.test(s);
  const strings = [];
  (function walk(x) { if (typeof x === 'string') strings.push(x); else if (x && typeof x === 'object') Object.values(x).forEach(walk); })(L);
  t.ok(strings.filter(namesDat).every((s) => s.includes(ADA)), 'every text that names the DAT carries the ADA line');
  t.ok(!/\b(raise|boost|improve)s? (your )?(DAT|PAT) scores?\b|predicted (DAT|PAT)|DAT score gain/i.test(texts.replace(ADA, '')), 'no claim of DAT score gains');
  const allText = texts.toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered/.test(allText), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
}
