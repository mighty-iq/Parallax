/* PAT-3 Angles: generator, validator, scorer, difficulty, shortcut solvers, timing and learn data
   (ARCHITECTURE §12; R3 §8.3). Run through tests/node/run.mjs. PX_REPORT=1 prints the numbers;
   PX_TEST_ITEMS=<n> shortens the seed loop. */
import { MANIFEST, deepDiff } from './run.mjs';
import { performance } from 'node:perf_hooks';

const FILES = [...MANIFEST, 'js/ex/angles/gen.js', 'js/ex/angles/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // 90 level combinations × 112
const procMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };

export async function run(t) {
  const PX = t.context({ files: FILES }).PX;
  const def = PX.ex.get('angles');
  t.section('angles: definition');
  t.ok(def, 'angles is registered');
  if (!def) return;
  const L = def.lib;
  t.eq([def.id, def.version, def.code, def.abilities, def.cell, def.role, def.answer, def.nOptions, def.pat, def.perDisplay, def.practice],
    ['angles', 1, 'PAT-3', ['LE'], null, 'train', 'choice', 4, true, true, 'perception'], 'id, version, code, LE, no cell, choice of 4, pat, per display, perceptual practice');
  t.eq(def.dims.map((d) => d.key), ['gap', 'size', 'resolve', 'pose'], 'dims');
  t.ok(def.dims[0].levels.every((g) => g >= 2), 'no gap below 2° (the phone floor holds on every screen)');
  const all = PX.ex.enumerate(def);
  t.eq(all.length, 90, 'every level combination is enumerated');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4 - 1e-9, `difficulty spans at least 4 logits (${lo.toFixed(2)} … ${hi.toFixed(2)})`);
  const easiest = all.reduce((a, p) => (def.difficulty(p) < def.difficulty(a) ? p : a));
  const pBeginner = 0.25 + (1 - 0.25 - 0.03) / (1 + Math.exp(def.difficulty(easiest)));
  t.ok(pBeginner > 0.87 && pBeginner < 0.93, `the easiest item is about 90 % right at θ = 0 (${(100 * pBeginner).toFixed(1)} %)`);

  t.section('angles: deterministic trigonometry');
  let trigErr = 0;
  for (let d = -720; d <= 720; d += 0.37) {
    const sc = L.sincos(d);
    trigErr = Math.max(trigErr, Math.abs(sc[0] - Math.sin(d * Math.PI / 180)), Math.abs(sc[1] - Math.cos(d * Math.PI / 180)));
    const a = L.atan2d(sc[0], sc[1]), want = Math.atan2(sc[0], sc[1]) * 180 / Math.PI;
    trigErr = Math.max(trigErr, Math.abs(a - want) * Math.PI / 180);
  }
  t.ok(trigErr < 1e-12, `sincos and atan2d match Math within 1e-12 (${trigErr.toExponential(1)})`);
  t.eq([L.sincos(90), L.sincos(180)], [[1, 0], [0, -1]].map((x) => x.map((v) => v + 0)), 'exact at multiples of 90°');

  t.section('angles: items');
  const per = Math.max(1, Math.ceil(N_ITEMS / all.length));
  let threw = 0, invalid = 0, keyWrong = 0, foilRight = 0, nonJson = 0, fallbacks = 0, firstBad = null, n = 0;
  const keyPos = [0, 0, 0, 0], cues = {}, items = [];
  let minArmPx = Infinity, sumScale = 0;
  for (let ci = 0; ci < all.length; ci++) {
    for (let s = 0; s < per; s++) {
      const params = all[ci], seed = PX.rng.hash('angles-test', ci, s);
      let item;
      try { item = def.generate(PX.rng(seed), params); } catch (e) { threw++; firstBad = firstBad || `throw ${JSON.stringify(params)}: ${e.message}`; continue; }
      n++;
      if (item.fallback) fallbacks++;
      const v = def.validate(item);
      if (v !== true) { invalid++; firstBad = firstBad || `${JSON.stringify(params)} seed ${seed}: ${v}`; continue; }
      if (!def.score(item, item.key).correct) keyWrong++;
      for (let i = 0; i < 4; i++) if (i !== item.key && def.score(item, i).correct) foilRight++;
      if (n % 50 === 0 && deepDiff(JSON.parse(JSON.stringify(item)), item) !== null) nonJson++;
      if (n % 8 === 0) items.push({ seed, params, item });
      keyPos[item.key]++;
      sumScale += item.scale;
      L.measure(item).forEach((m) => { minArmPx = Math.min(minArmPx, m.arms[0], m.arms[1]); });
      shortcuts(L, item, cues);
    }
  }
  t.eq(threw, 0, 'generate never throws' + (firstBad && threw ? ` (${firstBad})` : ''));
  t.ok(n >= Math.min(10000, N_ITEMS), `at least ${Math.min(10000, N_ITEMS)} items (${n})`);
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad && invalid ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(foilRight, 0, 'every other option scores wrong');
  t.eq(nonJson, 0, 'items survive JSON round trips');
  t.eq(fallbacks, 0, 'no item needed the fallback construction');
  t.ok(keyPos.every((c) => Math.abs(c / n - 0.25) < Math.max(0.03, 3 * Math.sqrt(0.25 * (1 - 0.25) / n))), `keys spread over the four positions (${keyPos.join(', ')})`);

  t.section('angles: validator catches broken items');
  const base = items[0].item;
  const broken = [
    ['an arm moved by 3°', (it) => { const g = it.angles[it.order[0]], dx = g.a[0] - g.v[0], dy = g.a[1] - g.v[1], c = Math.cos(0.05), s2 = Math.sin(0.05); g.a = [g.v[0] + c * dx - s2 * dy, g.v[1] + s2 * dx + c * dy]; }],
    ['the key moved', (it) => { it.key = (it.key + 1) % 4; }],
    ['two equal options', (it) => { it.options[(it.key + 1) % 4] = it.options[(it.key + 2) % 4].slice(); }],
    ['a stated degree changed', (it) => { it.deg[0] += 0.5; }],
    ['a point outside its cell', (it) => { it.angles[1].a = [1.2, 0.5]; }],
  ];
  for (const [name, edit] of broken) {
    const it = JSON.parse(JSON.stringify(base));
    edit(it);
    t.ok(def.validate(it) !== true, `rejects: ${name}`);
  }
  // Resolve rules hold on every level (validate checks them; count them here as well).
  t.ok(items.every(({ item }) => {
    const m = L.measure(item).map((x) => x.deg), foils = item.options.filter((_, i) => i !== item.key);
    const e = foils.map((o) => L.widestWrong(o, m)), sorted = item.order.map((c) => m[c]);
    const gaps = [sorted[1] - sorted[0], sorted[2] - sorted[1], sorted[3] - sorted[2]], close = Math.min(...gaps);
    return item.params.resolve === 2 ? Math.min(...e) < close + 0.05 : Math.min(...e) > close + 0.05;
  }), 'the closest pair must be judged at resolve 2 and never below it');

  t.section('angles: determinism');
  let diff = 0, firstDiff = null;
  for (const x of items) {
    const d = deepDiff(def.generate(PX.rng(x.seed), x.params), x.item);
    if (d) { diff++; firstDiff = firstDiff || d; }
  }
  t.eq(diff, 0, `the same seed gives the same item (${items.length} regenerated)` + (firstDiff ? `: ${firstDiff}` : ''));
  const other = t.context({ files: FILES }).PX.ex.get('angles');
  let diff2 = 0;
  for (const x of items.slice(0, 200)) if (deepDiff(other.generate(PX.rng(x.seed), x.params), x.item)) diff2++;
  t.eq(diff2, 0, 'the same items in a freshly loaded context');

  t.section('angles: malformed responses and fallback');
  let malformedRight = 0;
  for (const { item } of items.slice(0, 200)) {
    for (const r of [-1, 4, 1.5, String(item.key), null, undefined, NaN, [item.key], {}, true]) {
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

  t.section('angles: timing');
  const hardest = all.reduce((a, p) => (def.difficulty(p) > def.difficulty(a) ? p : a));
  const q = (a, f) => [...a].sort((x, y) => x - y)[Math.floor(f * (a.length - 1))];
  let p95 = Infinity;
  for (let round = 0; round < 3; round++) {
    const cpu = [];
    for (let s = 0; s < 150; s++) { const c0 = procMs(); def.generate(PX.rng(PX.rng.hash('time', round, s)), hardest); cpu.push(procMs() - c0); }
    p95 = Math.min(p95, q(cpu, 0.95));
  }
  t.ok(p95 < 20, `generation p95 at the hardest level under 20 ms (CPU ${p95.toFixed(1)} ms)`);

  t.section('angles: shortcut solvers');
  const bound = 0.25 + 0.10, pct = (x) => (100 * x).toFixed(1) + ' %';
  for (const [k, v] of Object.entries(cues)) {
    const rate = v.hit / v.n;
    t.ok(rate <= bound, `"${k}" ≤ chance + 10 (${pct(rate)} over ${v.n} items)`);
  }
  if (process.env.PX_REPORT) {
    console.log('       angles: ' + Object.entries(cues).map(([k, v]) => `${k} ${pct(v.hit / v.n)}`).join(', '));
    console.log(`       keys ${keyPos.join(',')}; mean scale ${(sumScale / n).toFixed(2)}; shortest arm ${minArmPx.toFixed(3)} cell; CPU p95 ${p95.toFixed(1)} ms`);
  }
  testLearn(t, PX, def);
}

// A cue solver ranks the angles by a cheap feature and picks the option nearest (Kendall) to that
// order, uniformly among ties. Every feature is read both ways round.
function nearest(L, pred, options, key) {
  const d = options.map((o) => L.kendall(o, pred)), best = Math.min(...d);
  return d[key] === best ? 1 / d.filter((x) => x === best).length : 0;
}
function shortcuts(L, item, acc) {
  const add = (name, hit) => { const a = acc[name] = acc[name] || { hit: 0, n: 0 }; a.hit += hit; a.n++; };
  const f = item.angles.map((g) => {
    const ux = g.a[0] - g.v[0], uy = g.a[1] - g.v[1], wx = g.b[0] - g.v[0], wy = g.b[1] - g.v[1];
    const lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy), xs = [g.v[0], g.a[0], g.b[0]], ys = [g.v[1], g.a[1], g.b[1]];
    const bis = Math.atan2(uy / lu + wy / lw, ux / lu + wx / lw);
    return {
      'tip distance': Math.hypot(g.a[0] - g.b[0], g.a[1] - g.b[1]), area: Math.abs(ux * wy - uy * wx), 'arm sum': lu + lw,
      'longer arm': Math.max(lu, lw), 'shorter arm': Math.min(lu, lw),
      'bounding box': (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)),
      'bisector slope': ((bis % Math.PI) + Math.PI) % Math.PI, 'bisector height': Math.abs(Math.sin(bis)),
      'vertex x': g.v[0], 'vertex y': g.v[1],
    };
  });
  const aligned = L.POSES[item.params.pose] === 'aligned';
  for (const name of Object.keys(f[0])) {
    // With one arm horizontal, the bisector's slope is half the angle itself: the skill, not a cue.
    if (aligned && /bisector/.test(name)) continue;
    const vals = f.map((x) => x[name]);
    add(name + ' (larger = larger)', nearest(L, L.orderOf(vals), item.options, item.key));
    add(name + ' (larger = smaller)', nearest(L, L.orderOf(vals.map((x) => -x)), item.options, item.key));
  }
  // Stem-blind: the ordering most like the others / the odd one out; the numbers in order.
  const tot = item.options.map((o, i) => item.options.reduce((s, o2, j) => s + (i === j ? 0 : L.kendall(o, o2)), 0));
  const mn = Math.min(...tot), mx = Math.max(...tot);
  add('most like the others', tot[item.key] === mn ? 1 / tot.filter((x) => x === mn).length : 0);
  add('odd one out', tot[item.key] === mx ? 1 / tot.filter((x) => x === mx).length : 0);
  add('numbers in order 1-2-3-4', nearest(L, [0, 1, 2, 3], item.options, item.key));
  add('numbers reversed 4-3-2-1', nearest(L, [3, 2, 1, 0], item.options, item.key));
}

/* ---------- learn data (js/ex/angles/learn.js) ---------- */

function testLearn(t, PX, def) {
  t.section('angles: learn');
  const L = PX.ex.learn('angles');
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
  const caps = ['angles', 'options', 'order', 'overlay', 'pair', 'done', 'chosen'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  t.ok(typeof L.bridge === 'string' && /not been shown/.test(L.bridge), 'a "where it is used" card with its limitation line');
  t.ok(/perceptual/i.test(L.label || '') && /perceptual/i.test(L.bridge), 'labelled perceptual-judgement practice');
  const ADA = 'DAT® and Dental Admission Test are marks of the American Dental Association. Parallax is not affiliated with or endorsed by the ADA. Every item is generated by the app; none is taken from the DAT.';
  const strings = [];
  (function walk(x) { if (typeof x === 'string') strings.push(x); else if (x && typeof x === 'object') Object.values(x).forEach(walk); })(L);
  t.ok(strings.filter((s) => /\bDAT\b|Dental Admission Test/.test(s)).every((s) => s.includes(ADA)), 'every text that names the DAT carries the ADA line');
  const texts = JSON.stringify(L).split(ADA).join('');
  t.ok(!/\b(raise|boost|improve)s? (your )?(DAT|PAT) scores?\b|predicted (DAT|PAT)|DAT score gain/i.test(texts), 'no claim of DAT score gains');
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered/.test(texts.toLowerCase()), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
}
