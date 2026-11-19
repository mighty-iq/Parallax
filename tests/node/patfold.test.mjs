/* EX-17 Hole Punch: generator, validator, scorer, difficulty, shortcut solvers, fallback, timing,
   Fold's unchanged behaviour and learn data (ARCHITECTURE §12; R3 §8.1). Run through
   tests/node/run.mjs. PX_REPORT=1 prints the numbers; PX_TEST_ITEMS=<n> shortens the seed loop. */
import { MANIFEST, deepDiff } from './run.mjs';
import { performance } from 'node:perf_hooks';

const FILES = [...MANIFEST, 'js/ex/fold/gen.js', 'js/ex/patfold/gen.js', 'js/ex/patfold/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // 72 level combinations × 140 (24 on the starter band)
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
    ['patfold', 3, 'EX-17', ['Vz'], 'intrinsic-dynamic', 'train', 'choice', 5, true, false], 'id, version 3 (wrong sheets with other hole counts), code, abilities, cell, role, answer, 5 options, pat');
  t.eq(def.dims.map((d) => d.key), ['folds', 'type', 'idle', 'sheets'], 'dims');
  t.eq([def.dims[3].levels, def.dims[3].at], [['counts may differ', 'all at the key\'s count'], [-0.4, 0]], 'sheets: other hole counts allowed (the official samples), then every sheet at the key\'s count (1.1)');
  t.eq(def.testRange && def.testRange.dims, { folds: ['below', 'test', 'test'], sheets: ['test', 'beyond'] }, 'test range (CONTRACT-v1.2 W3): one fold below it, every sheet at the key\'s count beyond it');
  t.ok(Object.values(def.testRange.notes || {}).every((x) => typeof x === 'string' && x.length <= 240 && !/score|predict|harder than|easier than|DAT/i.test(x)), 'range notes describe format features only');
  t.eq(def.dims[0].levels, ['1 (starter)', 2, 3], 'one fold on the starter band (outside the official format, so labelled), then two or three folds');
  t.eq(def.starter, { dim: 'folds', levels: 1 }, 'the starter band is the first level of folds');
  const all = PX.ex.enumerate(def);
  t.eq(all.length, 72, 'every level combination is enumerated');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 2.5, `difficulty spans at least 2.5 logits (${lo.toFixed(2)} … ${hi.toFixed(2)}; the format caps folds at 3)`);
  t.ok(Math.abs(lo + 3.55) < 1e-9 && Math.abs(def.difficulty({ folds: 0, type: 0, idle: 0, sheets: 1 }) - def.difficulty({ folds: 1, type: 0, idle: 0, sheets: 1 }) + 1.3) < 1e-9,
    `the starter band sits 1.3 below two folds that both matter, 0.85 below the pre-1.2 floor; other hole counts 0.4 lower still (floor ${lo.toFixed(2)}; note D2 §3.6)`);
  t.ok([0, 1, 2].every((ty) => [0, 1, 2].every((id) => Math.abs(def.difficulty({ folds: 1 + Math.floor(ty / 3), type: ty, idle: id, sheets: 1 }) - (-1.85 + 0.45 * ty - 0.45 * Math.min(id, 1))) < 1e-9)),
    'older levels keep their 1.1 difficulty with every sheet at the key\'s count (two folds: base −1.85, type +0.45, an idle fold −0.45)');
  const old0 = { folds: 1, type: 0, idle: 1, sheets: 1 }, g = def.chance(old0);
  const pBeginner = g + (1 - g - 0.03) / (1 + Math.exp(def.difficulty(old0)));
  t.ok(pBeginner > 0.87 && pBeginner < 0.93, `the pre-1.2 floor is about 90 % right at θ = 0 (${(100 * pBeginner).toFixed(1)} %)`);
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
  const ALW = { always0: 0, always1: 0, always2: 0, always3: 0, always4: 0 };
  const acc = { count: 0, sym1: 0, low1: 0, like: 0, odd: 0, under: 0, symAny: 0, count2: 0, most: 0, fewest: 0, layers: 0, ...ALW };
  const band = { count: 0, sym1: 0, low1: 0, like: 0, odd: 0, under: 0, symAny: 0, count2: 0, most: 0, fewest: 0, layers: 0, gate: 0, oneFold: 0, shareUnder: 0, symFoil: 0, ...ALW };
  let sheetsOk = 0;
  const keyPos = [0, 0, 0, 0, 0], holesHist = {}, whyHist = {}, items = [], cs = {};
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
      // dim 'sheets': all five at the key's count, or two wrong sheets at it and two with another count
      const atKey = item.options.filter((o) => o.length === item.holes).length;
      if (item.options.length !== 5 || atKey !== (params.sheets === 1 ? 5 : 3)) optCount++; else sheetsOk++;
      if (n % 50 === 0 && deepDiff(JSON.parse(JSON.stringify(item)), item) !== null) nonJson++;
      if (n % 8 === 0) items.push({ seed, params, item });
      keyPos[item.key]++;
      holesHist[item.holes] = (holesHist[item.holes] || 0) + 1;
      item.why.forEach((w) => { if (w) { const k = w.replace(/\d+/g, '#'); whyHist[k] = (whyHist[k] || 0) + 1; } });
      if (params.folds === 0) def.lib.onSheet((A) => { shortcuts(A, def.lib, item, band); bandChecks(A, item, band); });
      else def.lib.onSheet((A) => { shortcuts(A, def.lib, item, acc); creaseSym(A, item, cs); });
    }
  }
  t.eq(threw, 0, 'generate never throws' + (firstBad && threw ? ` (${firstBad})` : ''));
  t.ok(n >= Math.min(10000, N_ITEMS), `at least ${Math.min(10000, N_ITEMS)} items (${n})`);
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad && invalid ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(foilRight, 0, 'every other option scores wrong');
  t.eq(optCount, 0, `5 options: every sheet at the key's count, or (counts may differ) two wrong sheets at it and two with another count (${sheetsOk} items)`);
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
  // The drawn panels (RV-dat-style-A §4: each of these passed before the per-step check), on the
  // reviewer's item: seed 99, three mixed folds.
  const panelBase = def.generate(PX.rng(99), { folds: 2, type: 3, idle: 0 });
  const last = panelBase.folds.length;
  const panels = [
    ['step 1: a face shifted one cell', (it) => { it.steps[1].faces[0].poly = it.steps[1].faces[0].poly.map(([x, y]) => [x + 1, y]); }],
    ['step 2: the flap flags cleared (no shading, no arrow)', (it) => { it.steps[2].faces.forEach((f) => { f.moved = false; }); }],
    ['step 2: the outline mirrored left to right', (it) => { it.steps[2].outline = it.steps[2].outline.map(([x, y]) => [4 - x, y]); }],
    [`step ${last}: the faces mirrored top to bottom`, (it) => { it.steps[last].faces.forEach((f) => { f.poly = f.poly.map(([x, y]) => [x, 4 - y]); }); }],
    ['step 1: the arrow starts at the wrong place', (it) => { it.steps[1].faces.forEach((f) => { if (f.from) f.from = f.from.map(([x, y]) => [y, x]); }); }],
    [`step ${last}: two faces swap layers`, (it) => { const F = it.steps[last].faces, a = F.reduce((b, f, i) => (f.layer > F[b].layer ? i : b), 0), b = F.reduce((c, f, i) => (f.layer < F[c].layer ? i : c), 0); [F[a].layer, F[b].layer] = [F[b].layer, F[a].layer]; }],
    [`step ${last}: a hole on the wrong face`, (it) => { const F = it.steps[last].faces, a = F.findIndex((f) => f.holes.length), b = F.findIndex((f, i) => i !== a); F[b].holes.push(F[a].holes.pop()); }],
  ];
  t.eq([def.validate(panelBase), panelBase.folds.length], [true, 3], 'the reviewer\'s item is valid as generated (three folds)');
  for (const [name, edit] of panels) {
    const it = JSON.parse(JSON.stringify(panelBase));
    edit(it);
    const v = deepDiff(it, panelBase) !== null ? def.validate(it) : 'no change';
    t.ok(v !== true && v !== 'no change', `rejects: ${name} (${v})`);
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
  for (const k of ['under', 'sym1', 'low1', 'symAny', 'like', 'odd', 'count2', 'most', 'fewest', 'always0', 'always1', 'always2', 'always3', 'always4']) {
    t.ok(acc[k] / acc.count <= bound, `"${NAMES[k]}" ≤ chance + 10 (${pct(acc[k])}, chance 20 %)`);
  }
  console.log(`       info  ${NAMES.layers}: ${pct(acc.layers)} (a third where counts may differ, a fifth where they may not)`);
  creaseReport(cs, [2, 3]);
  t.section('patfold: the starter band (one fold; note D2 §3.6)');
  const bp = (x) => (100 * x / band.count).toFixed(1) + ' %';
  t.ok(band.count >= 2000, `starter band items (${band.count})`);
  t.eq(band.oneFold, band.count, 'one straight fold that matters (the band\'s type 0), or the level\'s one corner or slanted fold; two holes');
  t.eq(band.symFoil, band.count, 'every band item has a foil symmetric about the crease without the punch hole');
  t.ok(band.shareUnder / band.count >= 2.5, `most foils share the punch hole (${(band.shareUnder / band.count).toFixed(2)} of 4 on average)`);
  for (const k of ['under', 'low1', 'symAny', 'like', 'odd', 'count2', 'most', 'fewest']) {
    t.ok(band[k] / band.count <= bound, `starter band: "${NAMES[k]}" ≤ chance + 10 (${bp(band[k])}, chance 20 %)`);
  }
  console.log(`       info  starter band, the format's method (reported, not bounded; PLAN Defaults): crease symmetry alone ${bp(band.sym1)}, punch-gated crease symmetry ${bp(band.gate)}`);
  if (process.env.PX_REPORT) {
    console.log(`       patfold: n ${acc.count}; under ${pct(acc.under)}, sym1 ${pct(acc.sym1)}, low1 ${pct(acc.low1)}, symAny ${pct(acc.symAny)}, like ${pct(acc.like)}, odd ${pct(acc.odd)}, count ${pct(acc.count2)}; CPU p95 ${p95.toFixed(1)} ms`);
    console.log('       holes', JSON.stringify(holesHist), 'keys', keyPos.join(','));
    console.log('       foils', JSON.stringify(whyHist));
  }
  testLearn(t, PX, def);
  testTutorialRepeat(t, PX, def, 'patfold');
}

// Per item, each heuristic's expected accuracy (ties shared). Counting the layers under the punch is the
// format's own method when hole counts differ (the official explanations derive the count from the layers;
// DECISIONS): reported, not bounded. One implementation for this file and tests/node/shortcut-levels.test.mjs.
const NAMES = { sym1: 'most symmetric about the first crease', low1: 'least symmetric about the first crease', symAny: 'most symmetric about any sheet axis',
  like: 'most like the others', odd: 'odd one out', under: 'a hole under the punch', count2: 'the hole count 2^folds', most: 'the most holes', fewest: 'the fewest holes',
  layers: 'as many holes as layers under the punch (the format\'s method, reported)',
  always0: 'always A', always1: 'always B', always2: 'always C', always3: 'always D', always4: 'always E' };
function itemScores(A, lib, item) {
  const opts = item.options, k = item.key, masks = opts.map((o) => A.maskOf(o)), out = {};
  const L1 = item.folds[0].line;
  const s1 = opts.map((o) => A.symScore(o, L1));
  out.sym1 = pickBest(s1, k);
  out.low1 = pickBest(s1, k, false);
  const tot = masks.map((m, i) => masks.reduce((s, m2, j) => s + (i === j ? 0 : A.hamming(m, m2)), 0));
  out.like = pickBest(tot, k, false);
  out.odd = pickBest(tot, k, true);
  const pm = A.maskOf(item.punches);
  out.under = pickBest(masks.map((m) => ((m[0] & pm[0]) === pm[0] && (m[1] & pm[1]) === pm[1] ? 1 : 0)), k);
  out.symAny = pickBest(opts.map((o) => Math.max(...lib.AXES.map((L) => A.symScore(o, L)))), k);
  const want = 2 ** item.folds.length;
  out.count2 = pickBest(opts.map((o) => -Math.abs(o.length - want)), k);
  out.most = pickBest(opts.map((o) => o.length), k);
  out.fewest = pickBest(opts.map((o) => o.length), k, false);
  out.layers = pickBest(opts.map((o) => (o.length === item.holes ? 1 : 0)), k); // the layers under the punch are the true hole count
  for (let j = 0; j < 5; j++) out['always' + j] = k === j ? 1 : 0; // always the same letter
  return out;
}
function shortcuts(A, lib, item, acc) {
  acc.count++;
  const sc = itemScores(A, lib, item);
  for (const key of Object.keys(sc)) acc[key] += sc[key];
}

// Crease symmetry (RV-dat-style-A §1; the lead's decision: the format's analytic method, not a
// shortcut): keep the options with a hole under every punch, then take the one most symmetric about
// the item's own creases (summed). Not bounded; reported as information by fold type, by the number
// of idle folds, by fold count, and by the key's symmetry: every crease a mirror line of the key,
// an idle fold (a crease the punches missed) but no partial flap, or a partial flap (a fold that
// matters, but the key is only partly symmetric about its crease).
const TYPE_NAMES = ['half', 'corner', 'diagonal', 'mixed'];
function creaseSym(H, item, cs) {
  const opts = item.options, k = item.key, lines = item.folds.map((f) => f.line), pm = H.maskOf(item.punches);
  const gate = opts.map((o) => { const m = H.maskOf(o); return (m[0] & pm[0]) === pm[0] && (m[1] & pm[1]) === pm[1] ? 10 : 0; });
  const hit = pickBest(opts.map((o, i) => gate[i] + lines.reduce((s, L) => s + H.symScore(o, L), 0)), k);
  const idle = item.folds.filter((f) => !f.matters).length;
  const shape = item.folds.some((f) => f.matters && H.symScore(opts[k], f.line) < 1) ? 'a partial flap' : idle ? 'an idle fold' : 'every crease a mirror line';
  for (const key of ['all', TYPE_NAMES[item.params.type], 'idle ' + idle, 'folds ' + item.folds.length, shape]) {
    const a = cs[key] = cs[key] || [0, 0]; a[0] += hit; a[1]++;
  }
}
// The starter band's promises: one fold that matters, two holes; at least one foil symmetric about the
// crease without the punch hole; how many foils share the punch hole; the format's method (gate).
function bandChecks(A, item, b) {
  const opts = item.options, k = item.key, pm = A.maskOf(item.punches), L1 = item.folds[0].line;
  const up = opts.map((o) => { const m = A.maskOf(o); return (m[0] & pm[0]) === pm[0] && (m[1] & pm[1]) === pm[1] ? 1 : 0; });
  const s1 = opts.map((o) => A.symScore(o, L1));
  if (item.folds.length === 1 && item.folds[0].matters && item.holes === 2 && (item.params.type !== 0 || item.folds[0].cls === 'H')) b.oneFold++;
  if (opts.some((o, i) => i !== k && !up[i] && s1[i] > 1 - 1e-9)) b.symFoil++;
  b.shareUnder += up.reduce((s, u, i) => s + (i === k ? 0 : u), 0);
  b.gate += pickBest(opts.map((o, i) => up[i] * 10 + s1[i]), k);
}
function creaseReport(cs, folds) {
  const f = (key) => (cs[key] ? (100 * cs[key][0] / cs[key][1]).toFixed(1) : '–');
  const share = (key) => (cs[key] ? (100 * cs[key][1] / cs.all[1]).toFixed(0) : '0');
  console.log(`       info  crease symmetry (the format's analytic method; not bounded): ${f('all')} % of ${cs.all[1]} items | ${TYPE_NAMES.map((x) => `${x} ${f(x)}`).join(', ')} | idle folds ${[0, 1, 2].map((x) => `${x}: ${f('idle ' + x)}`).join(', ')}`);
  console.log(`             folds ${folds.map((x) => `${x}: ${f('folds ' + x)}`).join(', ')} | every crease a mirror line of the key ${f('every crease a mirror line')} (${share('every crease a mirror line')} % of items), an idle fold ${f('an idle fold')} (${share('an idle fold')} %), a partial flap ${f('a partial flap')} (${share('a partial flap')} %)`);
}

/* ---------- learn data (js/ex/patfold/learn.js) ---------- */

function testLearn(t, PX, def) {
  t.section('patfold: learn');
  const L = PX.ex.learn('patfold');
  t.ok(L && typeof L === 'object', 'learn data is registered');
  if (!L) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, `a one-line goal (${(L.goal || '').length} characters)`);
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  // the teaching template (CONTRACT-v1.2 D; note D2 §3.0 C, §3.6, §3.9 item 1)
  t.ok(Array.isArray(L.rules) && L.rules.length >= 2 && L.rules.length <= 4 && L.rules.every((r) => typeof r === 'string' && r.length > 20 && r.length <= 140), 'a rules card of 2–4 short rules');
  t.ok((L.strategies || []).some((x) => x.id === L.strategyFirst) && L.strategies.find((x) => x.id === L.strategyFirst).steps.length === 3, `the strategy card before Try 1 exists, with three steps (${L.strategyFirst})`);
  t.eq(L.minutes, 3, 'the offer card says about three minutes (the worked example included)');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length === 1 && valid(L.demo[0].params) && Number.isInteger(L.demo[0].seed), 'one demo item with valid params');
  t.ok(def.difficulty(L.demo[0].params) <= PX.ex.minDifficulty(def) + 1e-9, 'the Watch is at the starter band (the easiest level)');
  const demoItem = def.generate(PX.rng(L.demo[0].seed), L.demo[0].params);
  t.ok(def.validate(demoItem) === true && !demoItem.fallback && demoItem.folds.length === 1 && demoItem.folds[0].cls === 'H' && demoItem.holes === 2, `demo seed ${L.demo[0].seed}: one straight fold, two holes`);
  t.ok(Array.isArray(L.practice) && L.practice.length === 4 && L.practice.every((e) => e && valid(e.params) && Number.isInteger(e.seed)), 'four Try items, each { params, seed }');
  if (!Array.isArray(L.practice) || L.practice.length !== 4) return;
  const P = L.practice.map((e) => e.params), items = L.practice.map((e) => def.generate(PX.rng(e.seed), e.params));
  // a worked example before the Try item that brings the first hard feature (note D2 addendum C change 4)
  const exE = L.practice[3].example, xe = exE && def.generate(PX.rng(exE.seed), L.practice[3].params);
  t.ok(!!xe && Number.isInteger(exE.seed) && exE.seed !== L.practice[3].seed && def.validate(xe) === true && !xe.fallback && xe.folds.length === 2 && xe.folds.every((f) => f.matters) && xe.key !== items[3].key && L.practice.every((e, i) => i === 3 || e.example === undefined),
    `Try 4 (two folds that matter) comes after a worked example on a sister item with two folds that matter (seed ${exE && exE.seed})`);
  t.ok(items.every((it) => def.validate(it) === true && !it.fallback), 'every Try item is valid and no fallback');
  t.ok(P[0].folds === 0 && P[1].folds === 0 && P[0].type === 0 && P[1].type === 0, 'Try 1 and Try 2 are at the starter band (one straight fold)');
  t.eq(P[2], { folds: 1, type: 0, idle: 1, sheets: 0, task: 'tutorial' }, 'Try 3: two folds, one idle; wrong sheets may have other hole counts (the test range)');
  t.eq(P[3], { folds: 1, type: 0, idle: 0, sheets: 0, task: 'tutorial' }, 'Try 4: two folds that both matter');
  t.ok(['count', 'same'].every((id) => (L.tips || []).some((x) => x.id === id && x.when.dim === 'sheets')), 'tips for counting the layers and for every sheet at the key\'s count');
  t.eq(L.practice[0].assist, { twin: true }, 'Try 1 has its first step done (the twin ringed)');
  t.ok(L.practice.slice(1).every((e) => e.assist === undefined), 'only Try 1 is assisted');
  const tipIds = new Set((L.tips || []).map((x) => x.id));
  t.ok(L.practice[2].tip === 'idle' && L.practice.every((e) => e.tip === undefined || tipIds.has(e.tip)), 'Try 3 shows the idle-fold tip; forced tips exist');
  t.eq(new Set(items.map((it) => it.key)).size, 4, `the Try answers sit in four different places (${items.map((it) => it.key + 1).join(', ')})`);
  const cls = (w) => (/not unfolded|hole missed|extra hole|layer counted/.test(w) ? 'count' : /wrong order/.test(w) ? 'order' : /one cell away|another place/.test(w) ? 'moved' : /turned/.test(w) ? 'turned' : /mirrored/.test(w) ? 'mirrored' : /across/.test(w) ? 'crease' : 'other');
  const kindsOf = (it) => new Set(it.why.filter((w, i) => i !== it.key).map(cls));
  const dk = kindsOf(demoItem), tk = new Set(items.flatMap((it) => [...kindsOf(it)]));
  t.ok([...tk].every((k) => dk.has(k)), `every kind of wrong sheet in Try (${[...tk].join(', ')}) is in the Watch item (${[...dk].join(', ')})`);
  const diffs = P.map((p) => def.difficulty(p));
  t.ok(diffs.every((x, i) => i === 0 || x >= diffs[i - 1] - 1e-9), `practice goes from easy to harder (${diffs.map((x) => x.toFixed(2)).join(', ')})`);
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).length && tr.levels.every((l) => l >= 0 && l < d.levels.length));
    t.ok(tip.id && tip.text && tr.dim && dimOk, `tip ${tip.id} has a valid trigger`);
  }
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['intro', 'punched', 'unfold', 'unfoldIdle', 'done', 'chosen', 'assist'];
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

// v1.2 (fresh-player test): no tutorial item comes back as a rated item. Every learn.js item carries
// params.task 'tutorial'; lib.TUTORIAL holds exactly their stems' hashes; rated items at the tutorial's
// settings never have one of those stems, and an item whose first draw is not one is unchanged.
function testTutorialRepeat(t, PX, def, id) {
  t.section(id + ': tutorial items do not come back');
  const L = PX.ex.learn(id), lib = def.lib, entries = [];
  (L.demo || []).forEach((d) => entries.push([d.params, d.seed]));
  (L.practice || []).forEach((e) => { entries.push([e.params, e.seed]); if (e.example) entries.push([e.example.params || e.params, e.example.seed]); });
  t.ok(entries.every(([p]) => p && p.task === 'tutorial'), 'every Watch, Try and worked-example item is marked task: tutorial');
  t.ok(def.extraParams.indexOf('task') >= 0, 'task is an extra parameter of the definition');
  const sigs = [...new Set(entries.map(([p, s]) => lib.stemSig(def.generate(PX.rng(s), p))))].sort((a, b) => a - b);
  t.eq([...lib.TUTORIAL].sort((a, b) => a - b), sigs, `lib.TUTORIAL is the tutorial items' stems (${sigs.length})`);
  let n = 0, repeats = 0, guarded = 0, changed = 0;
  const sets = entries.map(([p]) => { const q = Object.assign({}, p); delete q.task; return q; });
  for (const q of sets) for (let s = 1; s <= 300; s++) {
    n++;
    const raw = lib.generateRaw(PX.rng(s), q), it = def.generate(PX.rng(s), q);
    const hit = lib.TUTORIAL.indexOf(lib.stemSig(raw)) >= 0;
    if (hit) guarded++;
    if (lib.TUTORIAL.indexOf(lib.stemSig(it)) >= 0) repeats++;
    if (!hit && (lib.stemSig(it) !== lib.stemSig(raw) || it.key !== raw.key)) changed++;
  }
  t.eq(repeats, 0, `no rated item at the tutorial's settings has a tutorial stem (${n} items; ${guarded} first draws were redrawn)`);
  t.eq(changed, 0, 'an item whose first draw is not a tutorial stem is the same as before');
}

/* v1.2 wave 2 (W2-progress): per-item shortcut scores for tests/node/shortcut-levels.test.mjs */
export function shortcutScores(PX, def, item) {
  const out = {};
  def.lib.onSheet((A) => {
    const sc = itemScores(A, def.lib, item);
    // reported: counting the layers (the method where counts differ) and, on the starter band, crease
    // symmetry (the band's method: the key is the punch and its twin across the one crease; DECISIONS)
    for (const k of Object.keys(sc)) out[NAMES[k]] = k === 'layers' || (k === 'sym1' && item.folds.length === 1) ? { hit: sc[k], chance: 0.2, info: true } : { hit: sc[k], chance: 0.2 };
  });
  return out;
}
export const SHORTCUT_EXEMPT = [];
