/* EX-10 Hidden: generator, validator, scorer, shortcut solvers (ARCHITECTURE.md §12, PLAN.md §12).
   Loads only the manifest and js/ex/hidden/gen.js, so it does not depend on other exercises.
   A third embedding check, written here on the item's segment lists, backs up validate.
   Prints one summary line with the pool numbers and shortcut accuracies. */
import { performance } from 'node:perf_hooks';
import { MANIFEST, deepDiff } from './run.mjs';

const FILES = [...MANIFEST, 'js/ex/hidden/gen.js', 'js/ex/hidden/learn.js'];
const SEEDS_PER_COMBO = 186; // × 54 combinations = 10 044 items
const pct = (x) => (100 * x).toFixed(2) + ' %';

export async function run(t) {
  const PX = t.context({ files: FILES }).PX;
  const def = PX.ex.get('hidden');
  t.ok(def, 'hidden is defined');
  if (!def) return;
  definition(t, PX, def);
  learnData(t, PX, def);
  const items = pool(t, PX, def);
  crossContext(t, PX, def, items);
  mutations(t, PX, def, items);
  fallbacks(t, PX, def);
  timing(t, PX, def);
}

function definition(t, PX, def) {
  t.section('hidden: definition');
  t.eq([def.id, def.version, def.code, def.role, def.answer, def.cell, def.nOptions], ['hidden', 1, 'EX-10', 'train', 'choice', 'intrinsic-static', 5], 'id, version, code, role, answer, cell, nOptions');
  t.eq([...def.abilities], ['CF'], 'ability CF');
  t.eq(def.variants, null, 'no variants');
  t.eq(def.dims.map((d) => [d.key, [...d.levels]]), [['extra', [6, 10, 14, 19, 25, 32]], ['sim', ['low', 'medium', 'high']], ['size', [5, 6, 7]]], 'dims: extra segments, candidate similarity, figure size');
  t.eq(PX.ex.count(def), 54, '54 combinations');
  t.eq(def.chance({ extra: 0, sim: 0, size: 0 }), 0.2, 'chance 1/5');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4, `difficulty range ≥ 4 logits (${lo} to ${hi})`);
  const pEasy = 0.2 + (1 - 0.2 - 0.03) / (1 + Math.exp(lo));
  t.ok(pEasy > 0.86 && pEasy < 0.94, `the easiest item is right about 90 % of the time at θ = 0 (${pct(pEasy)})`);
}

// Tutorial data (js/ex/hidden/learn.js): shapes as in the exercise guide §7, honest wording, demo
// seeds that give what they promise, and every caption the view reads.
const CAPTIONS = ['figure', 'shapes', 'found', 'runOn', 'notFit', 'notFitMany', 'only'];
const FORBIDDEN = /\bIQ\b|smarter|master(ed|y)|brain age|genius|intelligen/i;
function learnData(t, PX, def) {
  t.section('hidden: learn data');
  const L = PX.ex.learn('hidden');
  t.ok(L && typeof L.goal === 'string' && L.goal.length > 20, 'a one-line goal');
  if (!L) return;
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  const kinds = { low: (it) => it.params.sim === 0 && it.sim < 0.42 && it.extra <= 10 };
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => {
    const it = def.generate(PX.rng(d.seed), d.params);
    return PX.ex.validParams(def, d.params) === true && def.validate(it) === true && kinds[d.kind] && kinds[d.kind](it);
  }), 'demo seeds give easy items of their kind');
  const prac = L.practice || [];
  const easy = Math.min(...prac.map((p) => def.difficulty(p)));
  t.ok(prac.length >= 3 && prac.length <= 5 && prac.every((p) => PX.ex.validParams(def, p) === true) && def.difficulty(prac[0]) === easy, '3–5 valid practice params, the easiest first');
  t.ok(Array.isArray(L.tips) && L.tips.every((tip) => tip.id && tip.text && tip.when && def.dims.some((dm) => dm.key === tip.when.dim &&
    tip.when.levels.every((lv) => Number.isInteger(lv) && lv >= 0 && lv < dm.levels.length))), 'tips name real dim levels');
  const sids = (L.strategies || []).map((s) => s.id);
  t.ok(['imagery', 'analytic', 'switch'].every((id) => sids.includes(id)) && L.strategies.every((s) => s.title && s.text && s.steps.length >= 2 && s.when), 'imagery, analytic and switch strategy cards');
  t.ok(CAPTIONS.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 3), 'every caption the view reads');
  t.ok(typeof L.bridge === 'string' && /not been shown/.test(L.bridge), 'the bridge card says what has not been shown');
  t.ok(!FORBIDDEN.test(JSON.stringify(L)), 'no IQ, smarter or mastered wording');
}

// Independent embedding count on the JSON: segments as unordered endpoint pairs in a Set (a numeric
// code of both points, not the generator's packed keys). Translations cover every position where
// any part of the option overlaps the grid.
const ptCode = (x, y) => (x + 16) * 64 + (y + 16);
const segCode = (x1, y1, x2, y2) => { const a = ptCode(x1, y1), b = ptCode(x2, y2); return a < b ? a * 4096 + b : b * 4096 + a; };
const segKey = (s) => segCode(s[0], s[1], s[2], s[3]);
function placements(item, option) {
  const fig = new Set(item.figure.map(segKey)), found = [], N = item.grid, segs = option.segs;
  for (let dx = -option.w; dx <= N; dx++) {
    for (let dy = -option.h; dy <= N; dy++) {
      let all = true;
      for (let i = 0; i < segs.length && all; i++) { const s = segs[i]; all = fig.has(segCode(s[0] + dx, s[1] + dy, s[2] + dx, s[3] + dy)); }
      if (all) found.push([dx, dy]);
    }
  }
  return found;
}
function sharedPoints(item) {
  const o = item.options[item.key], [dx, dy] = item.place;
  const copy = new Set(o.segs.map((s) => segKey([s[0] + dx, s[1] + dy, s[2] + dx, s[3] + dy])));
  const pts = new Set(o.segs.flatMap((s) => [`${s[0] + dx},${s[1] + dy}`, `${s[2] + dx},${s[3] + dy}`]));
  const shared = new Set();
  for (const s of item.figure) {
    if (copy.has(segKey(s))) continue;
    for (const p of [`${s[0]},${s[1]}`, `${s[2]},${s[3]}`]) if (pts.has(p)) shared.add(p);
  }
  return shared.size;
}

function pool(t, PX, def) {
  t.section('hidden: pool');
  const lib = def.lib, combos = PX.ex.enumerate(def), items = [];
  const names = ['mostSegments', 'fewestSegments', 'histogram', 'mostLikeOthers', 'oddOneOut', 'largest', 'localPairs', 'bestOverlap'];
  const sol = Object.fromEntries(names.map((k) => [k, 0]));
  const simBy = [[], [], []], localTop = { n: 0, w: 0 };
  let threw = 0, invalid = 0, firstBad = null, keyWrong = 0, wrongRight = 0, nondet = 0, embedBad = 0, sharedBad = 0, sizes = 0, n = 0;
  const fb0 = def.lib.STATS.fallbacks, keyAt = [0, 0, 0, 0, 0];
  let roundTrip = 0;
  for (const p of combos) {
    for (let s = 0; s < SEEDS_PER_COMBO; s++) {
      const seed = PX.rng.hash('hidden-test', PX.ex.paramsCode(def, p), s);
      let item;
      try { item = def.generate(PX.rng(seed), p); } catch (e) { threw++; if (!firstBad) firstBad = 'threw: ' + e.message; continue; }
      n++;
      const v = def.validate(item);
      if (v !== true) { invalid++; if (!firstBad) firstBad = PX.ex.paramsKey(p) + ': ' + v; continue; }
      if (!def.score(item, item.key).correct) keyWrong++;
      for (let i = 0; i < 5; i++) if (i !== item.key && def.score(item, i).correct) wrongRight++;
      for (const w of [-1, 5, null, String(item.key), [item.key]]) if (def.score(item, w).correct) wrongRight++;
      if (s % 4 === 0) { // the third check, on every 4th item (2 500)
        item.options.forEach((o, i) => {
          const pl = placements(item, o);
          if (i === item.key ? pl.length !== 1 || pl[0][0] !== item.place[0] || pl[0][1] !== item.place[1] : pl.length !== 0) embedBad++;
        });
        if (sharedPoints(item) < 2) sharedBad++;
        if (new Set(item.options.map((o) => o.segs.length)).size !== 1) sizes++;
      }
      if (s % 10 === 0 && deepDiff(def.generate(PX.rng(seed), p), item) !== null) nondet++;
      if (s % 10 === 5) {
        const back = JSON.parse(JSON.stringify(item));
        if (deepDiff(back, item) !== null || def.validate(back) !== true || !def.score(back, back.key).correct) roundTrip++;
      }
      keyAt[item.key]++;
      for (const k of names) sol[k] += lib.solvers[k](item)[item.key];
      if (p.extra === 5) { localTop.n++; localTop.w += lib.solvers.localPairs(item)[item.key]; }
      simBy[p.sim].push(item.sim);
      if (s < 2) items.push(item);
    }
  }
  t.ok(n + threw >= 10000, `at least 10 000 seeds (${n + threw})`);
  t.eq(threw, 0, 'generate never throws' + (firstBad && threw ? ` (${firstBad})` : ''));
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad && invalid ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(wrongRight, 0, 'every other option (and junk) scores wrong');
  t.eq(embedBad, 0, 'independent search: the key is embedded exactly once, at place; the others nowhere');
  t.eq(sharedBad, 0, 'independent check: the key shares two or more points with other lines');
  t.eq(sizes, 0, 'all options of an item have the same number of segments (none contains another)');
  t.eq(nondet, 0, 'the same seed gives the same item (every 10th item regenerated)');
  t.eq(roundTrip, 0, 'items survive a JSON round trip (every 10th item)');
  t.eq(def.lib.STATS.fallbacks - fb0, 0, 'generate never needed the fallback');
  t.ok(keyAt.every((c) => Math.abs(c / n - 0.2) <= 0.02), `the key is spread evenly over the five positions (${keyAt.map((c) => (100 * c / n).toFixed(1)).join(' / ')} %)`);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sims = simBy.map(mean);
  t.ok(sims[0] < sims[1] && sims[1] < sims[2], `similarity rises with its level (${sims.map((x) => x.toFixed(2)).join(' < ')})`);
  const r = (k) => sol[k] / n;
  // Every shortcut ≤ chance + 10 points; the stem-blind ones and the tied ones at chance ± 3.
  for (const k of ['mostSegments', 'fewestSegments', 'histogram', 'mostLikeOthers', 'oddOneOut', 'largest']) {
    t.ok(r(k) <= 0.30, `${k} ≤ chance + 10 points (${pct(r(k))})`);
    t.ok(Math.abs(r(k) - 0.2) <= 0.03, `${k} stays at chance (${pct(r(k))})`);
  }
  t.ok(r('bestOverlap') === 1, 'the honest solver (best overlap with the figure) always finds the key');
  t.ok(localTop.w / localTop.n <= 0.35, `the local-pairs solver is near chance at the most extra lines (${pct(localTop.w / localTop.n)})`);
  console.log(`       hidden: ${n} items, ${invalid} invalid; shortcuts (chance 20 %): most segments ${pct(r('mostSegments'))}, histogram ${pct(r('histogram'))}, ` +
    `most like others ${pct(r('mostLikeOthers'))}, odd one out ${pct(r('oddOneOut'))}, largest ${pct(r('largest'))}, local pairs ${pct(r('localPairs'))} (${pct(localTop.w / localTop.n)} at 32 extra); similarity ${sims.map((x) => x.toFixed(2)).join(' / ')}`);
  return items;
}

function crossContext(t, PX, def, items) {
  t.section('hidden: determinism across contexts');
  const def2 = t.context({ files: FILES }).PX.ex.get('hidden');
  let diff = null;
  for (let i = items.length - 1; i >= 0 && !diff; i -= 2) diff = deepDiff(def2.generate(PX.rng(items[i].seed), items[i].params), items[i]);
  t.ok(diff === null, 'another context regenerates the same items' + (diff ? ` (${diff})` : ''));
}

function mutations(t, PX, def, items) {
  t.section('hidden: validate rejects broken items');
  const U = PX.util, it = items.find((x) => x.near.some((nr, i) => i !== x.key && nr.missing.length === 1));
  const copy = () => U.deepCopy(it);
  const keyCopy = (c) => new Set(c.options[c.key].segs.map((s) => segKey([s[0] + c.place[0], s[1] + c.place[1], s[2] + c.place[0], s[3] + c.place[1]])));
  const cases = [];
  cases.push(['a key segment removed', (() => { const c = copy(), kc = keyCopy(c); c.figure = c.figure.filter((s, i) => !(kc.has(segKey(s)) && i === c.figure.findIndex((q) => kc.has(segKey(q))))); return c; })(), /embedded|extra|place|near/]);
  cases.push(['a distractor completed', (() => {
    const c = copy(), i = c.near.findIndex((nr, j) => j !== c.key && nr.missing.length === 1);
    c.figure.push(c.near[i].missing[0]);
    const kc = keyCopy(c), drop = c.figure.findIndex((s) => !kc.has(segKey(s)) && segKey(s) !== segKey(c.near[i].missing[0]));
    c.figure.splice(drop, 1); // keep the segment count, so the embedding check is what fails
    return c;
  })(), /embedded|pieces|shares only|near|spreads|segments meet/]);
  cases.push(['two options the same', (() => { const c = copy(), j = (c.key + 1) % 5; c.options[(j + 1) % 5 === c.key ? (j + 2) % 5 : (j + 1) % 5] = U.deepCopy(c.options[j]); return c; })(), /same shape/]);
  cases.push(['the key index moved', (() => { const c = copy(); c.key = (c.key + 1) % 5; return c; })(), /embedded/]);
  cases.push(['place moved', (() => { const c = copy(); c.place = [c.place[0] + 1, c.place[1]]; return c; })(), /place/]);
  cases.push(['similarity misreported', (() => { const c = copy(); c.sim += 0.1; return c; })(), /sim/]);
  cases.push(['show-me data wrong', (() => { const c = copy(), i = (c.key + 1) % 5; c.near[i].missing = []; return c; })(), /near/]);
  cases.push(['a segment off the grid', (() => { const c = copy(); c.figure[0] = [c.grid, 0, c.grid + 1, 0]; return c; })(), /grid|extra/]);
  cases.push(['a segment that is not a unit step', (() => { const c = copy(); c.figure[0] = [0, 0, 2, 0]; return c; })(), /unit segment/]);
  cases.push(['an option not normalised', (() => { const c = copy(), o = c.options[0]; o.segs = o.segs.map((s) => [s[0] + 1, s[1], s[2] + 1, s[3]]); return c; })(), /normalised/]);
  cases.push(['an option of another size', (() => { const c = copy(), o = c.options[(c.key + 1) % 5]; o.segs = o.segs.slice(0, -1); return c; })(), /segments|single line|turns|directions|normalised|pieces/]);
  cases.push(['a level that does not match', (() => { const c = copy(); c.params.extra = (c.params.extra + 1) % 6; return c; })(), /extra/]);
  cases.push(['not an item', null, /not a hidden item/]);
  for (const [what, item, pattern] of cases) {
    const v = def.validate(item);
    t.ok(typeof v === 'string' && pattern.test(v), `validate rejects ${what}` + (typeof v === 'string' && !pattern.test(v) ? ` (said: ${v})` : v === true ? ' (it passed)' : ''));
  }
  // Shape rules, from segment sets alone.
  const lib = def.lib, k = (segs) => segs.map(lib.keyOfSeg);
  t.ok(lib.shapeProblem(k([[0, 0, 1, 0], [1, 0, 2, 0], [2, 0, 3, 0], [3, 0, 3, 1]])) !== null, 'a straight run of 3 is not a shape');
  t.ok(lib.shapeProblem(k([[0, 0, 1, 1], [1, 0, 0, 1], [1, 1, 2, 1]])) !== null, 'a shape may not cross itself');
  t.ok(lib.shapeProblem(k([[0, 0, 1, 0], [1, 0, 1, 1], [0, 1, 1, 1], [0, 0, 0, 1]])) === null, 'a closed square is a shape');
  t.ok(lib.shapeProblem(k([[0, 0, 1, 0], [1, 0, 1, 1], [3, 0, 3, 1]])) !== null, 'a shape in pieces is not a shape');
  t.ok(lib.shapeProblem(k([[0, 1, 1, 1], [1, 1, 2, 1], [1, 0, 1, 1], [1, 1, 1, 2]])) !== null, 'a branching figure is not a shape');
  t.ok(lib.shapeProblem(k([[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 2, 1]])) === null, 'an S of three segments is a shape');
}

function fallbacks(t, PX, def) {
  t.section('hidden: fallback construction');
  let bad = null;
  for (const p of PX.ex.enumerate(def)) {
    let it;
    try { it = def.lib.fallback(p, 7); } catch (e) { bad = PX.ex.paramsKey(p) + ': ' + e.message; break; }
    const v = def.validate(it);
    if (v !== true || it.seed !== 7) { bad = PX.ex.paramsKey(p) + ': ' + v; break; }
  }
  t.ok(bad === null, 'the fallback is valid for every combination' + (bad ? ` (${bad})` : ''));
  t.throws(() => def.generate(PX.rng(1), { extra: 6, sim: 0, size: 0 }), /extra/, 'invalid params are refused');
}

// p95 of the generation time per item at the hardest levels, best of three runs: wall time, and the
// process's CPU time, which other work on a shared machine cannot inflate. The check takes the
// smaller of the two.
function timing(t, PX, def) {
  t.section('hidden: generation time');
  for (const p of [{ extra: 5, sim: 2, size: 2 }, { extra: 5, sim: 0, size: 2 }, { extra: 5, sim: 1, size: 0 }]) {
    let wall = Infinity, cpu = Infinity;
    for (let run = 0; run < 3; run++) {
      const w = [], c = [];
      for (let s = 0; s < 150; s++) {
        const c0 = process.cpuUsage(), t0 = performance.now();
        def.generate(PX.rng(PX.rng.hash('hidden-time', run, s)), p);
        w.push(performance.now() - t0);
        const d = process.cpuUsage(c0);
        c.push((d.user + d.system) / 1000);
      }
      const q = (a) => a.sort((x, y) => x - y)[Math.floor(a.length * 0.95)];
      wall = Math.min(wall, q(w));
      cpu = Math.min(cpu, q(c));
    }
    t.ok(Math.min(wall, cpu) < 20, `p95 under 20 ms at ${PX.ex.paramsKey(p)} (wall ${wall.toFixed(2)} ms, CPU ${cpu.toFixed(2)} ms)`);
  }
}
