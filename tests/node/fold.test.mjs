/* EX-04 Fold: generator, validator, scorer, difficulty, shortcut solvers, fallback, timing and
   learn data (ARCHITECTURE §12, PLAN §3 and §12). Run through tests/node/run.mjs. Set
   PX_REPORT=1 to print the numbers; PX_TEST_ITEMS=<n> shortens the seed loop for quick runs. */
import { MANIFEST, deepDiff } from './run.mjs';
import { performance } from 'node:perf_hooks';

// Only the files this exercise needs: other exercises' work in progress cannot break it.
const FILES = [...MANIFEST, 'js/ex/fold/gen.js', 'js/ex/fold/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // 180 level combinations × 56
const SEEDS_PER_COMBO = Math.max(1, Math.ceil(N_ITEMS / 180));
// CPU time, not wall time (ARCHITECTURE §12): wall time is 3–5× higher while agents share the
// machine. Here process.threadCpuUsage() moves in scheduler ticks (0 or 2–4 ms per call), too coarse
// for one item, so each item is timed with process.cpuUsage() (µs; all threads, so an upper bound
// of the main thread's time) and the main thread's mean per item comes from a whole round.
const procMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
const threadMs = typeof process.threadCpuUsage === 'function'
  ? () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; } : procMs;

export async function run(t) {
  const PX = t.context({ files: FILES }).PX;
  const def = PX.ex.get('fold');
  t.section('fold: definition');
  t.ok(def, 'fold is registered');
  if (!def) return;
  t.eq([def.id, def.version, def.code, def.abilities, def.cell, def.role, def.answer, def.nOptions], ['fold', 1, 'EX-04', ['Vz'], 'intrinsic-dynamic', 'train', 'choice', 5], 'id, version, code, abilities, cell, role, answer, nOptions (the maximum)');
  t.eq(def.dims.map((d) => d.key), ['folds', 'type', 'punches', 'idle'], 'dims');
  t.eq(def.dims[0].levels, [1, 2, 3, 4, 5], 'folds 1–5');
  t.eq(def.dims[1].levels, ['half', 'corner', 'diagonal', 'mixed'], 'fold types');
  t.eq(def.dims[2].levels, [1, 2, 3], 'punches 1–3');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4, `difficulty spans at least 4 logits (${lo.toFixed(2)} … ${hi.toFixed(2)})`);
  const all = PX.ex.enumerate(def);
  t.eq(all.length, 180, 'every level combination is enumerated');
  const easiest = all.reduce((a, p) => (def.difficulty(p) < def.difficulty(a) ? p : a));
  const g = def.chance(easiest);
  const pBeginner = g + (1 - g - 0.03) / (1 + Math.exp(def.difficulty(easiest)));
  t.ok(pBeginner > 0.87 && pBeginner < 0.93, `the easiest item is about 90 % right at θ = 0 (${(100 * pBeginner).toFixed(1)} %)`);
  t.ok(all.every((p) => Math.abs(def.chance(p) - 1 / def.lib.nOptions(p)) < 1e-12), 'chance = 1 / number of options');
  t.ok(all.every((p) => def.difficulty({ ...p, idle: 2 }) >= def.difficulty({ ...p, idle: 0 }) - 0.7 - 1e-9), 'idle folds lower difficulty by at most 2 steps');
  const hardest = all.reduce((a, p) => (def.difficulty(p) > def.difficulty(a) ? p : a));
  t.eq(hardest, { folds: 4, type: 3, punches: 2, idle: 0 }, 'the hardest level is 5 mixed folds, 3 punches, every fold matters');

  t.section('fold: 10 080 items');
  const H = def.lib;
  let threw = 0, invalid = 0, keyWrong = 0, foilRight = 0, nonJson = 0, optCount = 0, fallbacks = 0, firstBad = null;
  let sumChance = 0;
  const acc = { count: 0, sym1: 0, like: 0, odd: 0, punchHoles: 0, symAny: 0, dKey: 0 };
  const holesHist = {}, whyHist = {}, cs = {};
  const items = [];
  let n = 0;
  for (let ci = 0; ci < all.length; ci++) {
    const params = all[ci];
    for (let s = 0; s < SEEDS_PER_COMBO; s++) {
      const seed = PX.rng.hash('fold-test', ci, s);
      let item;
      try { item = def.generate(PX.rng(seed), params); } catch (e) { threw++; firstBad = firstBad || `throw ${JSON.stringify(params)}: ${e.message}`; continue; }
      n++;
      if (item.fallback) fallbacks++;
      const v = def.validate(item);
      if (v !== true) { invalid++; firstBad = firstBad || `${JSON.stringify(params)} seed ${seed}: ${v}`; continue; }
      if (!def.score(item, item.key).correct) keyWrong++;
      for (let i = 0; i < item.options.length; i++) if (i !== item.key && def.score(item, i).correct) foilRight++;
      if (item.options.length !== H.nOptions(params) || item.options.some((o) => o.length !== item.holes)) optCount++;
      if (n % 50 === 0 && deepDiff(JSON.parse(JSON.stringify(item)), item) !== null) nonJson++;
      if (n % 8 === 0) items.push({ seed, params, item });
      holesHist[item.holes] = (holesHist[item.holes] || 0) + 1;
      item.why.forEach((w) => { if (w) { const k = w.replace(/\d+/g, '#'); whyHist[k] = (whyHist[k] || 0) + 1; } });
      sumChance += def.chance(params);
      shortcuts(H, item, acc);
      creaseSym(H, item, cs);
    }
  }
  t.eq(threw, 0, 'generate never throws' + (firstBad && threw ? ` (${firstBad})` : ''));
  t.ok(n >= Math.min(10000, N_ITEMS), `at least ${Math.min(10000, N_ITEMS)} items (${n})`);
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad && invalid ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(foilRight, 0, 'every other option scores wrong');
  t.eq(optCount, 0, '4 options below 4 folds, 5 from 4 folds up, all with the key\'s hole count');
  t.eq(nonJson, 0, 'items survive JSON round trips');
  t.eq(fallbacks, 0, 'no item needed the fallback construction');

  t.section('fold: determinism');
  let diff = 0, firstDiff = null;
  for (const x of items) {
    const again = def.generate(PX.rng(x.seed), x.params);
    const d = deepDiff(again, x.item);
    if (d) { diff++; firstDiff = firstDiff || d; }
  }
  t.eq(diff, 0, `the same seed gives the same item (${items.length} regenerated)` + (firstDiff ? `: ${firstDiff}` : ''));
  const other = t.context({ files: FILES }).PX.ex.get('fold');
  let diff2 = 0;
  for (const x of items.slice(0, 250)) if (deepDiff(other.generate(PX.rng(x.seed), x.params), x.item)) diff2++;
  t.eq(diff2, 0, 'the same items in a freshly loaded context');

  t.section('fold: the validator checks the drawn panels');
  // RV-dat-style-A §4: the stem and show-me are drawn from item.steps, which the checks above
  // compared by area and hole positions only; each of these passed the validator before.
  const pb = def.generate(PX.rng(99), { folds: 2, type: 3, punches: 1, idle: 0 }), last = pb.folds.length;
  const panels = [
    ['step 1: a face shifted one cell', (it) => { it.steps[1].faces[0].poly = it.steps[1].faces[0].poly.map(([x, y]) => [x + 1, y]); }],
    ['step 2: the flap flags cleared (no shading, no arrow)', (it) => { it.steps[2].faces.forEach((f) => { f.moved = false; }); }],
    ['step 2: the outline mirrored left to right', (it) => { it.steps[2].outline = it.steps[2].outline.map(([x, y]) => [8 - x, y]); }],
    [`step ${last}: the faces mirrored top to bottom`, (it) => { it.steps[last].faces.forEach((f) => { f.poly = f.poly.map(([x, y]) => [x, 8 - y]); }); }],
    ['step 1: the arrow starts at the wrong place', (it) => { it.steps[1].faces.forEach((f) => { if (f.from) f.from = f.from.map(([x, y]) => [y, x]); }); }],
    [`step ${last}: two faces swap layers`, (it) => { const F = it.steps[last].faces, a = F.reduce((b, f, i) => (f.layer > F[b].layer ? i : b), 0), b = F.reduce((c, f, i) => (f.layer < F[c].layer ? i : c), 0); [F[a].layer, F[b].layer] = [F[b].layer, F[a].layer]; }],
    [`step ${last}: a hole on the wrong face`, (it) => { const F = it.steps[last].faces, a = F.findIndex((f) => f.holes.length), b = F.findIndex((f, i) => i !== a); F[b].holes.push(F[a].holes.pop()); }],
    [`step ${last}: a back-up flag flipped`, (it) => { it.steps[last].faces[0].back = !it.steps[last].faces[0].back; }],
  ];
  t.eq([def.validate(pb), last], [true, 3], 'the base item is valid as generated (three mixed folds)');
  for (const [name, edit] of panels) {
    const it = JSON.parse(JSON.stringify(pb));
    edit(it);
    const v = deepDiff(it, pb) !== null ? def.validate(it) : 'no change';
    t.ok(v !== true && v !== 'no change', `rejects: ${name} (${v})`);
  }

  t.section('fold: malformed responses and fallback');
  const sample = items.slice(0, 200).map((x) => x.item);
  let malformedRight = 0;
  for (const item of sample) {
    for (const r of [-1, item.options.length, 1.5, String(item.key), null, undefined, NaN, [item.key], {}, true]) {
      let res;
      try { res = def.score(item, r); } catch (e) { res = { correct: true }; }
      if (!res || res.correct !== false) malformedRight++;
    }
  }
  t.eq(malformedRight, 0, 'malformed responses score wrong and never throw');
  let badFallback = 0, firstFallback = null;
  for (const params of all) {
    const it = H.fallback(H.norm(params));
    const v = it ? def.validate(it) : 'no item';
    if (!it || it.fallback !== true || v !== true) { badFallback++; firstFallback = firstFallback || `${JSON.stringify(params)}: ${v}`; }
  }
  t.eq(badFallback, 0, 'the fallback construction is valid for every params combination' + (firstFallback ? ` (${firstFallback})` : ''));

  t.section('fold: timing');
  // Main-thread CPU time per item, the best p95 of three rounds; wall time is reported alongside.
  for (let s = 0; s < 30; s++) def.generate(PX.rng(PX.rng.hash('warm', s)), hardest);
  const q = (a, f) => [...a].sort((x, y) => x - y)[Math.floor(f * (a.length - 1))];
  let p95 = Infinity, med = 0, wall95 = 0, mean = Infinity;
  for (let round = 0; round < 3; round++) {
    const cpu = [], wall = [], th0 = threadMs();
    for (let s = 0; s < 200; s++) {
      const c0 = procMs(), t0 = performance.now();
      def.generate(PX.rng(PX.rng.hash('time', round, s)), hardest);
      wall.push(performance.now() - t0);
      cpu.push(procMs() - c0);
    }
    mean = Math.min(mean, (threadMs() - th0) / 200);
    if (q(cpu, 0.95) < p95) { p95 = q(cpu, 0.95); med = q(cpu, 0.5); wall95 = q(wall, 0.95); }
  }
  t.ok(p95 < 20, `generation p95 at the hardest level under 20 ms (CPU ${p95.toFixed(1)} ms, median ${med.toFixed(1)} ms, main-thread mean ${mean.toFixed(1)} ms; wall p95 ${wall95.toFixed(1)} ms)`);

  t.section('fold: shortcut solvers');
  const chance = sumChance / acc.count;
  const bound = chance + 0.10;
  const pct = (x) => (100 * x / acc.count).toFixed(1) + ' %';
  t.ok(acc.sym1 / acc.count <= bound, `"most symmetric about the first fold line" ≤ chance + 10 (${pct(acc.sym1)}, chance ${(100 * chance).toFixed(1)} %)`);
  t.ok(acc.like / acc.count <= bound, `"most like the others" ≤ chance + 10 (${pct(acc.like)})`);
  t.ok(acc.odd / acc.count <= bound, `"odd one out" ≤ chance + 10 (${pct(acc.odd)})`);
  t.ok(acc.punchHoles / acc.count <= bound, `"a hole under every punch" ≤ chance + 10 (${pct(acc.punchHoles)})`);
  t.ok(acc.symAny / acc.count <= bound, `"most symmetric about any sheet axis" ≤ chance + 10 (${pct(acc.symAny)})`);
  t.ok(acc.dKey / acc.count <= bound, `"the hole count 2^folds × punches" ≤ chance + 10 (${pct(acc.dKey)})`);
  creaseReport(cs, [1, 2, 3, 4, 5]);
  if (process.env.PX_REPORT) {
    console.log(`       fold: n ${acc.count}, chance ${(100 * chance).toFixed(1)} %, sym1 ${pct(acc.sym1)}, like ${pct(acc.like)}, odd ${pct(acc.odd)}, under-punch ${pct(acc.punchHoles)}, sym-any ${pct(acc.symAny)}, count ${pct(acc.dKey)}; CPU p95 ${p95.toFixed(1)} ms, wall p95 ${wall95.toFixed(1)} ms`);
    console.log('       holes', JSON.stringify(holesHist));
    console.log('       foils', JSON.stringify(whyHist));
  }
  testLearn(t, PX, def);
}

/* ---------- learn data (js/ex/fold/learn.js) ---------- */

function testLearn(t, PX, def) {
  t.section('fold: learn');
  const L = PX.ex.learn('fold');
  t.ok(L && typeof L === 'object', 'learn data is registered');
  if (!L) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, `a one-line goal (${(L.goal || '').length} characters)`);
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed)), 'demo items with valid params');
  t.ok(L.demo.every((d) => def.difficulty(d.params) <= PX.ex.minDifficulty(def) + 1e-9), 'demos are at the easiest level');
  for (const d of L.demo) {
    const item = def.generate(PX.rng(d.seed), d.params);
    const kind = item.folds.length === 1 && item.folds[0].cls === 'H' && item.holes === 2 && !item.fallback ? 'half' : 'other';
    t.eq(kind, d.kind, `demo seed ${d.seed} gives a ${d.kind} item (one fold through the middle, two holes)`);
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
  for (const id of ['corner', 'diagonal', 'many', 'punches', 'idle']) t.ok(L.tips.some((x) => x.id === id), `a tip when the ${id} mechanic first appears`);
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['folds', 'punch', 'options', 'punched', 'punchedMany', 'unfold', 'unfoldIdle', 'done', 'chosen'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  t.ok(typeof L.bridge === 'string' && /not been shown/.test(L.bridge), 'a "where it is used" card with its limitation line');
  const o = L.offscreen || {};
  t.ok(o.title && o.text && Array.isArray(o.steps) && o.steps.length >= 3, 'an off-screen challenge with real paper');
  const allText = JSON.stringify(L).toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered/.test(allText), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
}

// Expected accuracy of a heuristic that picks uniformly among the best-scoring options.
function pickBest(scores, key, larger = true) {
  const best = larger ? Math.max(...scores) : Math.min(...scores);
  const ties = scores.filter((s) => Math.abs(s - best) < 1e-9).length;
  return Math.abs(scores[key] - best) < 1e-9 ? 1 / ties : 0;
}

function shortcuts(H, item, acc) {
  const opts = item.options, k = item.key;
  const masks = opts.map((o) => H.maskOf(o));
  acc.count++;
  // Hole count: every option has the same count, so the "2 holes per fold" count cannot choose.
  const want = item.punches.length * 2 ** item.folds.length;
  acc.dKey += pickBest(opts.map((o) => -Math.abs(o.length - want)), k);
  // The option most symmetric about the first fold line.
  const L1 = item.folds[0].line;
  acc.sym1 += pickBest(opts.map((o) => H.symScore(o, L1)), k);
  // Stem-blind: most like the others / odd one out (total Hamming distance).
  const tot = masks.map((m, i) => masks.reduce((s, m2, j) => s + (i === j ? 0 : H.hamming(m, m2)), 0));
  acc.like += pickBest(tot, k, false);
  acc.odd += pickBest(tot, k, true);
  // A hole right under every punch (true of the key).
  const pm = H.maskOf(item.punches);
  acc.punchHoles += pickBest(masks.map((m) => ((m[0] & pm[0]) === pm[0] && (m[1] & pm[1]) === pm[1] ? 1 : 0)), k);
  // Stem-blind symmetry: the option most symmetric about any axis of the sheet.
  const axes = [{ k: 'v', c: H.N / 2 }, { k: 'h', c: H.N / 2 }, { k: 'd', c: 0 }, { k: 'a', c: H.N }];
  acc.symAny += pickBest(opts.map((o) => Math.max(...axes.map((L) => H.symScore(o, L)))), k);
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
function creaseReport(cs, folds) {
  const f = (key) => (cs[key] ? (100 * cs[key][0] / cs[key][1]).toFixed(1) : '–');
  const share = (key) => (cs[key] ? (100 * cs[key][1] / cs.all[1]).toFixed(0) : '0');
  console.log(`       info  crease symmetry (the format's analytic method; not bounded): ${f('all')} % of ${cs.all[1]} items | ${TYPE_NAMES.map((x) => `${x} ${f(x)}`).join(', ')} | idle folds ${[0, 1, 2].map((x) => `${x}: ${f('idle ' + x)}`).join(', ')}`);
  console.log(`             folds ${folds.map((x) => `${x}: ${f('folds ' + x)}`).join(', ')} | every crease a mirror line of the key ${f('every crease a mirror line')} (${share('every crease a mirror line')} % of items), an idle fold ${f('an idle fold')} (${share('an idle fold')} %), a partial flap ${f('a partial flap')} (${share('a partial flap')} %)`);
}
