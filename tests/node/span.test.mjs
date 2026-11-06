/* EX-09 Span: generator, validator, scorer, shortcut solvers (ARCHITECTURE.md §12, PLAN.md §12).
   Loads only the manifest and js/ex/span/gen.js, so it does not depend on other exercises.
   Prints one summary line with the pool numbers and shortcut accuracies. */
import { performance } from 'node:perf_hooks';
import { MANIFEST, deepDiff } from './run.mjs';

const FILES = [...MANIFEST, 'js/ex/span/gen.js', 'js/ex/span/learn.js'];
const SEEDS_PER_COMBO = 70; // × 144 combinations = 10 080 items
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];
const pct = (x) => (100 * x).toFixed(2) + ' %';

export async function run(t) {
  const PX = t.context({ files: FILES }).PX;
  const def = PX.ex.get('span');
  t.ok(def, 'span is defined');
  if (!def) return;
  definition(t, PX, def);
  boardGeometry(t, PX, def);
  learnData(t, PX, def);
  const items = pool(t, PX, def);
  crossContext(t, PX, def, items);
  mutations(t, PX, def, items);
  fallbacks(t, PX, def);
  timing(t, PX, def);
}

function definition(t, PX, def) {
  t.section('span: definition');
  t.eq([def.id, def.version, def.code, def.role, def.answer, def.cell], ['span', 1, 'EX-09', 'train', 'sequence', null], 'id, version, code, role, answer, cell');
  t.eq([...def.abilities], ['MV', 'WM'], 'abilities MV, WM');
  t.eq([...def.variants], ['forward', 'backward'], 'variants: forward and backward recall');
  t.eq(def.dims.map((d) => [d.key, [...d.levels]]), [['len', [2, 3, 4, 5, 6, 7, 8, 9]], ['cross', ['none', 'some', 'many']], ['turn', [0, 90, 180]]], 'dims: length 2–9, crossings, board turn');
  t.eq(PX.ex.count(def), 144, '144 combinations');
  const all = PX.ex.enumerate(def);
  t.ok(all.every((p) => { const c = def.chance(p); return c > 0 && c < 0.02; }), 'chance is small and positive everywhere');
  t.near(def.chance({ len: 0, cross: 0, turn: 0 }), 1 / 72, 1e-12, 'chance at length 2 is 1/72');
  t.near(def.chance({ len: 7, cross: 0, turn: 0 }), 1 / 362880, 1e-15, 'chance at length 9 is 1/9!');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4, `difficulty range ≥ 4 logits (${lo} to ${hi})`);
  const pEasy = def.chance({ len: 0, cross: 0, turn: 0 }) + (1 - 0.03) / (1 + Math.exp(lo));
  t.ok(pEasy > 0.85 && pEasy < 0.93, `the easiest item is right about 90 % of the time at θ = 0 (${pct(pEasy)})`);
  const d = (len, cross, turn, variant) => def.difficulty({ len, cross, turn, variant });
  let mono = true;
  for (let li = 0; li < 8; li++) {
    for (let ti = 0; ti < 3; ti++) {
      for (const v of ['forward', 'backward']) {
        if (li < 7 && !(d(li + 1, 0, ti, v) > d(li, 0, ti, v))) mono = false;
        if (ti < 2 && !(d(li, 0, ti + 1, v) > d(li, 0, ti, v))) mono = false;
        if (li >= 2 && !(d(li, 1, ti, v) > d(li, 0, ti, v))) mono = false;     // length ≥ 4 can cross
        if (li >= 3 && !(d(li, 2, ti, v) > d(li, 1, ti, v))) mono = false;     // length ≥ 5: many > some
        if (li < 2 && d(li, 2, ti, v) !== d(li, 0, ti, v)) mono = false;      // lengths 2–3 cannot cross
      }
      if (!(d(li, 0, ti, 'backward') > d(li, 0, ti, 'forward'))) mono = false;
    }
  }
  t.ok(mono, 'difficulty rises with length, effective crossings, turn and backward recall');
  // estMs: stimulus + recall, for session planning (PHASE-B.md).
  t.ok(typeof def.estMs === 'function' && all.every((p) => def.estMs(p) > 0), 'estMs(params) is positive everywhere');
  const est = (len, turn) => def.estMs({ len, cross: 0, turn, variant: 'forward' });
  t.ok([0, 1, 2, 3, 4, 5, 6].every((li) => est(li + 1, 0) > est(li, 0)) && est(3, 2) > est(3, 1) && est(3, 1) > est(3, 0), 'estMs grows with length and with the turn');
  const pc = def.lib.PACE, stim = (L, ti) => pc.lead + L * (pc.on + pc.off) + pc.hold + def.lib.TURN_MS[ti];
  t.ok(all.every((p) => def.estMs(p) > stim(def.lib.LENS[p.len], p.turn)), 'estMs covers the whole stimulus plus recall');
  t.eq([...def.lib.TURN_MS], [0, 600, 800], 'the board turns in 0.6 s (90°) or 0.8 s (180°)');
}

// The board turns inside its square stage: the plate is round and every block stays inside it at
// any angle. The recall labels read along visual rows (the review found a row labelled 2·1·3).
function boardGeometry(t, PX, def) {
  t.section('span: board geometry and recall labels');
  const lib = def.lib, half = lib.BLOCK / 2;
  t.ok(lib.RMAX + half * Math.SQRT2 <= lib.PLATE - 5 && lib.PLATE <= lib.SIZE / 2 - 20,
    `a block's farthest corner (${(lib.RMAX + half * Math.SQRT2).toFixed(1)}) stays inside the round plate (${lib.PLATE}), and the plate inside the stage (${lib.SIZE / 2})`);
  const ids = [0, 1, 2];
  t.eq(lib.readingOrder([[450, 520], [300, 556], [600, 560]], ids), [1, 0, 2], 'blocks within half a block\'s height form one row, read left to right');
  t.eq(lib.readingOrder([[600, 500], [300, 556], [450, 900]], ids), [0, 1, 2], 'a block more than half a block lower starts the next row');
  const level = [[100, 100], [500, 150], [300, 160], [150, 300], [350, 420], [550, 540], [750, 660], [250, 780], [650, 900]];
  t.ok(/level/.test(String(lib.labelProblem(level))), 'two level blocks split between rows are refused (anchor rows would label the right one first)');
  t.eq(lib.labelProblem([[100, 100], [500, 150], [300, 140], [150, 300], [350, 420], [550, 540], [750, 660], [250, 780], [650, 900]]), null, 'clean rows pass');
  t.eq(lib.layoutProblem(lib.FALLBACK_PTS.map((q, i) => (i ? q : [110, 110]))), 'block 0 lies outside the circle the board turns in', 'a block outside the turning circle is refused');
}

// Labels in reading order must read along visual rows: for every pair, a nearly level pair (within
// half a block's height) is labelled left to right, any other pair top to bottom. Checked directly,
// without lib.rows.
function labelsReadAlongRows(pos, order, tol) {
  const label = []; order.forEach((id, k) => { label[id] = k; });
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (label[i] >= label[j]) continue;
      const dy = pos[j][1] - pos[i][1];
      if (Math.abs(dy) <= tol ? !(pos[i][0] < pos[j][0]) : !(dy > 0)) return false;
    }
  }
  return true;
}

// Tutorial data (js/ex/span/learn.js): shapes as in the exercise guide §7, honest wording, demo
// seeds that give what they promise, and every caption the view reads.
const CAPTIONS = ['board', 'watch', 'path', 'turn', 'forward', 'backward', 'after', 'compare', 'none', 'right', 'try'];
const FORBIDDEN = /\bIQ\b|smarter|master(ed|y)|brain age|genius|intelligen/i;
function learnData(t, PX, def) {
  t.section('span: learn data');
  const L = PX.ex.learn('span');
  t.ok(L && typeof L.goal === 'string' && L.goal.length > 20, 'a one-line goal');
  if (!L) return;
  t.ok(def.variants.every((v) => typeof (L.goals || {})[v] === 'string'), 'a goal for each variant');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  const kinds = { forward: (it) => it.order === 'forward' && it.turn === 0, turn: (it) => it.turn > 0, backward: (it) => it.order === 'backward' && it.turn === 0 };
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => {
    const it = def.generate(PX.rng(d.seed), d.params);
    return PX.ex.validParams(def, d.params) === true && def.validate(it) === true && kinds[d.kind] && kinds[d.kind](it) && it.len <= 4;
  }), 'demo seeds give short items of their kind');
  const prac = L.practice || [];
  const easy = Math.min(...prac.map((p) => def.difficulty(p)));
  t.ok(prac.length >= 3 && prac.length <= 5 && prac.every((p) => PX.ex.validParams(def, p) === true) && def.difficulty(prac[0]) === easy, '3–5 valid practice params, the easiest first');
  t.ok(Array.isArray(L.tips) && L.tips.every((tip) => tip.id && tip.text && tip.when && (
    tip.when.variant ? def.variants.includes(tip.when.variant)
      : def.dims.some((dm) => dm.key === tip.when.dim && tip.when.levels.every((lv) => Number.isInteger(lv) && lv >= 0 && lv < dm.levels.length)))), 'tips name real variants or dim levels');
  const sids = (L.strategies || []).map((s) => s.id);
  t.ok(['imagery', 'analytic', 'switch'].every((id) => sids.includes(id)) && L.strategies.every((s) => s.title && s.text && s.steps.length >= 2 && s.when), 'imagery, analytic and switch strategy cards');
  t.ok(CAPTIONS.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 3), 'every caption the view reads');
  t.ok(typeof L.bridge === 'string' && /not been shown/.test(L.bridge) && /block-tapping/.test(L.bridge), 'the bridge card says what is not shown, and names clinical block-tapping tests');
  t.ok(!FORBIDDEN.test(JSON.stringify(L)), 'no IQ, smarter or mastered wording');
}

// Wrong answers that must score wrong: two neighbouring taps swapped, one tap short, one tap
// too many, the shown order on backward items, a reversal, a non-array.
function wrongAnswers(item) {
  const k = item.key, out = [];
  for (let i = 0; i + 1 < k.length; i++) { const w = k.slice(); [w[i], w[i + 1]] = [w[i + 1], w[i]]; out.push([w, i]); }
  out.push([k.slice(0, -1), k.length - 1]);
  const extra = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((x) => !k.includes(x));
  out.push([k.concat([extra]), k.length]);
  if (item.order === 'backward') out.push([item.seq.slice(), 0]);
  out.push([k.slice().reverse(), 0]);
  return out;
}

function pool(t, PX, def) {
  t.section('span: pool');
  const lib = def.lib, combos = PX.ex.enumerate(def), items = [];
  let threw = 0, invalid = 0, firstBad = null, keyWrong = 0, wrongRight = 0, valueBad = 0, nondet = 0, fallbacks = def.lib.STATS.fallbacks, roundTrip = 0;
  const sol = { readingOrder: 0, readingOrderBlind: 0, nearest: 0, nearestBlind: 0, ignoreTurn: 0 };
  const base = { ro: 0, nn: 0 }, byLen = {};
  let turned = 0, n = 0, outside = 0, labelsBad = 0;
  const IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8], r2 = lib.RMAX * lib.RMAX;
  for (const p of combos) {
    for (let s = 0; s < SEEDS_PER_COMBO; s++) {
      const seed = PX.rng.hash('span-test', PX.ex.paramsCode(def, p), s);
      let item;
      try { item = def.generate(PX.rng(seed), p); } catch (e) { threw++; if (!firstBad) firstBad = 'threw: ' + e.message; continue; }
      n++;
      const v = def.validate(item);
      if (v !== true) { invalid++; if (!firstBad) firstBad = PX.ex.paramsKey(p) + ': ' + v; continue; }
      if (item.seed !== seed) valueBad++;
      const L = item.len, ok = def.score(item, item.key);
      if (!(ok.correct && ok.value === L)) keyWrong++;
      for (const [w, prefix] of wrongAnswers(item)) {
        const r = def.score(item, w);
        if (r.correct) wrongRight++;
        else if (r.value !== prefix) valueBad++;
      }
      if (def.score(item, null).correct || def.score(item, 'abc').correct) wrongRight++;
      if (s % 10 === 0) {
        const back = JSON.parse(JSON.stringify(item));
        if (deepDiff(back, item) !== null || def.validate(back) !== true || !def.score(back, back.key).correct) roundTrip++;
        const again = def.generate(PX.rng(seed), p);
        if (deepDiff(again, item) !== null) nondet++;
      }
      const row = byLen[L] || (byLen[L] = { n: 0, ro: 0, nn: 0 });
      row.n++;
      for (const k of Object.keys(sol)) {
        if (k === 'ignoreTurn' && !item.turn) continue;
        if (def.score(item, lib.solvers[k](item)).correct) { sol[k]++; if (k === 'readingOrder') row.ro++; if (k === 'nearest') row.nn++; }
      }
      if (item.turn) turned++;
      if (item.blocks.some((q) => (q[0] - 500) ** 2 + (q[1] - 500) ** 2 > r2)) outside++;
      if (!labelsReadAlongRows(item.after, lib.readingOrder(item.after, IDS), lib.ROWTOL)) labelsBad++;
      base.ro += 1 / FACT[L];
      base.nn += 1 / FACT[L - 1];
      if (s < 3) items.push(item);
    }
  }
  t.ok(n + threw >= 10000, `at least 10 000 seeds (${n + threw})`);
  t.eq(threw, 0, 'generate never throws' + (firstBad && threw ? ` (${firstBad})` : ''));
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad && invalid ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right, with value = length');
  t.eq(wrongRight, 0, 'every wrong answer scores wrong');
  t.eq(valueBad, 0, 'value counts the taps right from the start; items carry their seed');
  t.eq(nondet, 0, 'the same seed gives the same item (every 10th item regenerated)');
  t.eq(def.lib.STATS.fallbacks - fallbacks, 0, 'generate never needed the fallback');
  t.eq(roundTrip, 0, 'items survive a JSON round trip (every 10th item)');
  t.eq(outside, 0, 'every block lies inside the circle the board turns in (none is clipped while the board turns)');
  t.eq(labelsBad, 0, 'the recall labels read along visual rows on every item (level pairs left to right, others top to bottom)');
  // Shortcut solvers. Set-aware ones (they know which blocks lit) are judged against the rate of a
  // uniformly random order (1/L! and 1/(L−1)!); blind ones against chance + 10 points.
  const rate = (k) => sol[k] / (k === 'ignoreTurn' ? turned : n);
  t.ok(rate('readingOrder') <= base.ro / n + 0.02, `reading order (set known): ${pct(rate('readingOrder'))} ≤ uniform ${pct(base.ro / n)} + 2`);
  t.ok(rate('nearest') <= base.nn / n + 0.02, `nearest neighbour (set and start known): ${pct(rate('nearest'))} ≤ uniform ${pct(base.nn / n)} + 2`);
  let cellsOk = true, worst = '';
  for (const [L, row] of Object.entries(byLen)) {
    if (row.ro / row.n > 1 / FACT[L] + 0.04 || row.nn / row.n > 1 / FACT[L - 1] + 0.04) { cellsOk = false; worst = `length ${L}: RO ${pct(row.ro / row.n)}, NN ${pct(row.nn / row.n)}`; }
  }
  t.ok(cellsOk, 'per length, neither set-aware shortcut beats a random order by more than 4 points ' + worst);
  t.ok(rate('readingOrderBlind') <= 0.10, `blind reading order ≤ chance + 10: ${pct(rate('readingOrderBlind'))}`);
  t.ok(rate('nearestBlind') <= 0.10, `blind nearest neighbour ≤ chance + 10: ${pct(rate('nearestBlind'))}`);
  t.eq(sol.ignoreTurn, 0, 'ignoring the turn never succeeds');
  console.log(`       span: ${n} items, ${invalid} invalid; shortcuts: reading order ${pct(rate('readingOrder'))} (uniform order ${pct(base.ro / n)}), ` +
    `nearest ${pct(rate('nearest'))} (uniform ${pct(base.nn / n)}), blind reading ${pct(rate('readingOrderBlind'))}, blind nearest ${pct(rate('nearestBlind'))}, ignore turn ${pct(rate('ignoreTurn'))}`);
  return items;
}

// A fresh context, items generated in another order: no hidden state changes an item.
function crossContext(t, PX, def, items) {
  t.section('span: determinism across contexts');
  const def2 = t.context({ files: FILES }).PX.ex.get('span');
  let diff = null;
  for (let i = items.length - 1; i >= 0 && !diff; i -= 3) {
    const it = items[i], again = def2.generate(PX.rng(it.seed), it.params);
    diff = deepDiff(again, it);
  }
  t.ok(diff === null, 'another context regenerates the same items' + (diff ? ` (${diff})` : ''));
}

function mutations(t, PX, def, items) {
  t.section('span: validate rejects broken items');
  const lib = def.lib, U = PX.util;
  const pickItem = (fn) => items.find(fn);
  const cases = [];
  const plain = pickItem((it) => it.len >= 5 && it.turn === 0 && it.crossings > 0);
  const turned = pickItem((it) => it.len >= 4 && it.turn === 90);
  const back = pickItem((it) => it.order === 'backward' && it.len >= 3);
  const relayout = (it, fn) => { const c = U.deepCopy(it); fn(c); c.after = lib.turnPoints(c.blocks, c.turn, c.dir); return c; };
  cases.push(['two blocks too close', relayout(plain, (c) => { c.blocks[0] = [c.blocks[1][0] + 40, c.blocks[1][1]]; }), /closer than|row|column|outside|centre/]);
  cases.push(['a block repeated', (() => { const c = U.deepCopy(plain); c.seq[1] = c.seq[0]; c.key = c.order === 'backward' ? c.seq.slice().reverse() : c.seq.slice(); return c; })(), /twice/]);
  cases.push(['the key out of order', (() => { const c = U.deepCopy(plain); [c.key[0], c.key[1]] = [c.key[1], c.key[0]]; return c; })(), /key/]);
  cases.push(['a wrong crossing count', (() => { const c = U.deepCopy(plain); c.crossings += 1; return c; })(), /crosses itself/]);
  cases.push(['a crossing level that does not fit', (() => { const c = U.deepCopy(plain); c.params.cross = 0; return c; })(), /outside/]);
  cases.push(['a block not where the turn puts it', (() => { const c = U.deepCopy(turned); c.after[0][0] += 1; return c; })(), /turn puts it/]);
  cases.push(['the turn of another level', (() => { const c = U.deepCopy(turned); c.params.turn = 2; return c; })(), /turn/]);
  cases.push(['backward key in shown order', (() => { const c = U.deepCopy(back); c.key = c.seq.slice(); return c; })(), /key/]);
  cases.push(['flashing faster than 3 Hz', (() => { const c = U.deepCopy(plain); c.pace.on = 150; c.pace.off = 100; return c; })(), /3 Hz/]);
  cases.push(['three blocks in a column', relayout(plain, (c) => { const x = c.blocks[0][0]; c.blocks[1][0] = x + 5; c.blocks[2][0] = x + 10; }), /column|row|closer|outside|centre/]);
  cases.push(['a sequence too short', (() => { const c = U.deepCopy(plain); c.seq.pop(); c.key = c.order === 'backward' ? c.seq.slice().reverse() : c.seq.slice(); return c; })(), /must have/]);
  cases.push(['not an item', null, /not a span item/]);
  for (const [what, item, pattern] of cases) {
    const v = item === undefined ? 'no sample' : def.validate(item);
    t.ok(typeof v === 'string' && pattern.test(v), `validate rejects ${what}` + (typeof v === 'string' && !pattern.test(v) ? ` (said: ${v})` : v === true ? ' (it passed)' : ''));
  }
  // A path that runs over a block: move a block not in the sequence onto the middle of a step.
  const it = pickItem((x) => x.len <= 5 && x.turn === 0), c = U.deepCopy(it);
  const off = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((b) => !c.seq.includes(b));
  const a = c.blocks[c.seq[0]], b = c.blocks[c.seq[1]];
  c.blocks[off] = [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)];
  c.after = lib.turnPoints(c.blocks, 0, 1);
  t.ok(typeof def.validate(c) === 'string', 'validate rejects a block lying on the path (or too near another block)');
}

function fallbacks(t, PX, def) {
  t.section('span: fallback construction');
  let bad = null;
  for (const p of PX.ex.enumerate(def)) {
    let it;
    try { it = def.lib.fallback(p, 123); } catch (e) { bad = PX.ex.paramsKey(p) + ': ' + e.message; break; }
    const v = def.validate(it);
    if (v !== true || it.seed !== 123) { bad = PX.ex.paramsKey(p) + ': ' + v; break; }
  }
  t.ok(bad === null, 'the fallback is valid for every combination' + (bad ? ` (${bad})` : ''));
  t.ok(def.lib.layoutProblem(def.lib.FALLBACK_PTS) === null, 'the fallback board passes every layout rule');
  t.throws(() => def.generate(PX.rng(1), { len: 8, cross: 0, turn: 0 }), /len/, 'invalid params are refused');
}

// p95 of the generation time per item at the hardest levels, best of three runs: wall time, and the
// process's CPU time, which other work on a shared machine cannot inflate. The check takes the
// smaller of the two.
function timing(t, PX, def) {
  t.section('span: generation time');
  const hardest = [{ len: 7, cross: 2, turn: 2, variant: 'backward' }, { len: 7, cross: 2, turn: 1, variant: 'backward' }, { len: 6, cross: 2, turn: 2, variant: 'forward' }];
  for (const p of hardest) {
    let wall = Infinity, cpu = Infinity;
    for (let run = 0; run < 3; run++) {
      const w = [], c = [];
      for (let s = 0; s < 200; s++) {
        const c0 = process.cpuUsage(), t0 = performance.now();
        def.generate(PX.rng(PX.rng.hash('span-time', run, s)), p);
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
