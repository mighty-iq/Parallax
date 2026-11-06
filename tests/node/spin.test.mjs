/* EX-03 Spin: generator, validator, scorer and shortcut solvers (ARCHITECTURE.md §5, §12; PLAN.md §3, §12).
   The shortcut solvers below are written independently of gen.js (their own polygon geometry). */
import { deepDiff } from './run.mjs';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';

const CHANCE_MARGIN = 0.10;

// Generation time per item: CPU time (what generation costs; wall time on a shared test machine mostly
// measures its load) and wall time, both as p95 in ms.
function timeP95(fn, n) {
  const cpu = [], wall = [];
  for (let i = 0; i < n; i++) {
    const c0 = process.cpuUsage(), w0 = performance.now();
    fn(i);
    const w1 = performance.now(), c1 = process.cpuUsage(c0);
    wall.push(w1 - w0); cpu.push((c1.user + c1.system) / 1000);
  }
  const p95 = (a) => a.sort((x, y) => x - y)[Math.floor(a.length * 0.95)];
  return { cpu: p95(cpu), wall: p95(wall) };
}

/* ---------------------------------------------------------------- independent geometry */
function feats(poly) {
  let A = 0, X2 = 0, Y2 = 0, XY = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [xa, ya] = poly[i], [xb, yb] = poly[(i + 1) % poly.length], c = xa * yb - xb * ya;
    A += c / 2;
    X2 += (xa * xa + xa * xb + xb * xb) * c / 12;
    Y2 += (ya * ya + ya * yb + yb * yb) * c / 12;
    XY += (xa * yb + 2 * xa * ya + 2 * xb * yb + xb * ya) * c / 24;
    x0 = Math.min(x0, xa); x1 = Math.max(x1, xa); y0 = Math.min(y0, ya); y1 = Math.max(y1, ya);
  }
  const s = Math.sign(A);
  A *= s; X2 *= s; Y2 *= s; XY *= s; // figures are centred on their centroid (checked below)
  return {
    area: A, w: x1 - x0, h: y1 - y0, asp: Math.log((x1 - x0) / (y1 - y0)),
    axis: 0.5 * Math.atan2(2 * XY, X2 - Y2) * 180 / Math.PI, elong: Math.hypot(X2 - Y2, 2 * XY) / (X2 + Y2),
  };
}
function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function iou(p, q) {
  let i = 0, u = 0;
  for (let x = -4; x <= 4; x += 0.2) for (let y = -4; y <= 4; y += 0.2) {
    const a = inside(p, x, y), b = inside(q, x, y);
    if (a && b) i++;
    if (a || b) u++;
  }
  return i / u;
}
const fold = (a, m) => { a = ((a % m) + m) % m; return a > m / 2 ? m - a : a; };

// Accuracy of "same if score ≥ τ" with τ fitted on one half and tested on the other (2-fold).
function cvAccuracy(scores, labels) {
  const fit = (idx) => {
    const order = [...idx].sort((a, b) => scores[a] - scores[b]);
    let tp = idx.filter((i) => labels[i]).length, tn = 0;
    let best = { acc: -1, tau: -Infinity, flip: false };
    const consider = (tau, k) => {
      const acc = (tp + tn) / idx.length;
      if (acc > best.acc) best = { acc, tau, flip: false };
      if (1 - acc > best.acc) best = { acc: 1 - acc, tau, flip: true };
    };
    consider(-Infinity);
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      if (labels[i]) tp--; else tn++;
      if (k + 1 < order.length && scores[order[k + 1]] === scores[i]) continue;
      consider(k + 1 < order.length ? (scores[i] + scores[order[k + 1]]) / 2 : Infinity);
    }
    return best;
  };
  const test = (idx, m) => idx.filter((i) => ((scores[i] >= m.tau) !== m.flip) === labels[i]).length;
  const all = scores.map((_, i) => i), A = all.filter((i) => i % 2 === 0), B = all.filter((i) => i % 2 === 1);
  return (test(B, fit(A)) + test(A, fit(B))) / all.length;
}
const top2 = (values) => values.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, 2).map((x) => x[1]).sort((a, b) => a - b);
const sameKey = (a, b) => a[0] === b[0] && a[1] === b[1];
const pct = (x) => (100 * x).toFixed(0) + ' %';

export async function run(t) {
  const PX = t.PX, X = PX.ex, def = X.get('spin');
  t.section('spin: definition');
  if (!t.ok(def, 'spin is defined')) return;
  const L = def.lib;
  t.eq([def.code, def.version, def.abilities, def.cell, def.role], ['EX-03', 1, ['SR'], 'intrinsic-dynamic', 'train'], 'code, version, abilities, cell, role');
  t.eq([def.answer, def.nOptions, def.nCorrect, def.variants], ['multi', 4, 2, ['samediff', 'pick']], 'answer types and variants');
  t.eq(def.answers, { samediff: 'yesno', pick: 'multi' }, 'per-variant answer types are declared');
  t.eq(def.dims.map((d) => d.key), ['angle', 'cells'], 'dims: angle, cells');
  t.ok(def.dims[0].levels[0] <= 10 && def.dims[0].levels.at(-1) >= 170 && def.dims[0].levels.every((a, i, l) => !i || a - l[i - 1] <= 30), 'angle levels span 0–180° in steps of 30° or finer');
  t.eq(def.dims[1].levels, [5, 6, 7, 8, 9], 'cells 5–9');
  const range = X.maxDifficulty(def) - X.minDifficulty(def);
  t.ok(range >= 4, `difficulty range ≥ 4 logits (${range.toFixed(2)})`);
  t.eq([def.chance({ variant: 'samediff' }), def.chance({ variant: 'pick' }), def.chance({})], [0.5, 1 / 6, 0.5], 'chance: 0.5 same/mirror, 1/6 pick two, first variant by default');
  const pBeginner = (v) => { const g = def.chance({ variant: v }), b = X.minDifficulty(def); return g + (1 - g - 0.03) / (1 + Math.exp(b)); };
  t.ok(pBeginner('samediff') > 0.87 && pBeginner('samediff') < 0.93, `easiest samediff ≈ 90 % for a beginner (${pct(pBeginner('samediff'))})`);
  t.ok(pBeginner('pick') > 0.82 && pBeginner('pick') < 0.93, `easiest pick ≈ 85–90 % for a beginner (${pct(pBeginner('pick'))})`);
  L.FIXED.forEach((cells, i) => t.ok(L.shapeOk(L.analyse(cells), L.SHAPES[i]), `fallback shape ${i} meets its level`));

  t.section('spin: 10 000 items');
  const combos = X.enumerate(def), per = Math.ceil(10000 / combos.length), items = [];
  let thrown = 0, invalid = 0, firstInvalid = null, keyWrong = 0, wrongRight = 0, notJson = 0, notCentred = 0, badArea = 0;
  L.stats.fallbacks = 0;
  for (const p of combos) {
    const code = X.paramsCode(def, p);
    for (let s = 0; s < per; s++) {
      const seed = PX.rng.hash('spin-test', code, s);
      let it;
      try { it = def.generate(PX.rng(seed), p); } catch (e) { thrown++; continue; }
      const v = def.validate(it);
      if (v !== true) { invalid++; firstInvalid = firstInvalid || `${X.paramsKey(p)} seed ${seed}: ${v}`; continue; }
      if (deepDiff(JSON.parse(JSON.stringify(it)), it) !== null) notJson++;
      if (!def.score(it, it.key).correct) keyWrong++;
      if (it.answer === 'yesno') {
        if (def.score(it, !it.key).correct || def.score(it, 'yes').correct || def.score(it, undefined).correct) wrongRight++;
      } else {
        for (let m = 0; m < 16; m++) {
          const sub = [0, 1, 2, 3].filter((k) => m & (1 << k));
          if (def.score(it, sub).correct !== sameKey(sub.length === 2 ? sub : [-1, -1], it.key)) wrongRight++;
        }
        if (def.score(it, [it.key[0], it.key[0]]).correct || def.score(it, null).correct) wrongRight++;
        if (!def.score(it, [it.key[1], it.key[0]]).correct) keyWrong++; // order does not matter
      }
      for (const f of [it.ref].concat(it.probe ? [it.probe] : it.options)) {
        const g = feats(f.poly);
        if (Math.abs(g.area - it.shape.n) > 1e-3) badArea++;
        let cx = 0, cy = 0;
        f.poly.forEach(([x, y], i) => { const [x2, y2] = f.poly[(i + 1) % f.poly.length], c = x * y2 - x2 * y; cx += (x + x2) * c; cy += (y + y2) * c; });
        if (Math.hypot(cx, cy) / (6 * g.area) > 1e-3) notCentred++;
      }
      items.push({ p, seed, it });
    }
  }
  t.ok(items.length + invalid + thrown >= 10000, `at least 10 000 items over all ${combos.length} combinations (${items.length + invalid + thrown})`);
  t.eq(thrown, 0, 'generate never throws');
  t.ok(invalid === 0, 'validate passes on every item' + (firstInvalid ? ` (${invalid}; first: ${firstInvalid})` : ''));
  t.eq(keyWrong, 0, 'the key scores right (pick: in any order)');
  t.eq(wrongRight, 0, 'every other answer scores wrong (samediff: the other answer, junk; pick: every other subset, duplicates)');
  t.eq(notJson, 0, 'items survive a JSON round trip unchanged');
  t.eq([badArea, notCentred], [0, 0], 'every figure has the area of its cells and is centred on its centroid');
  t.ok(L.stats.fallbacks <= items.length / 1000, `fallback construction rarely needed (${L.stats.fallbacks})`);

  // Balance of the answers and of the angles.
  const sd = items.filter((x) => x.p.variant === 'samediff'), pk = items.filter((x) => x.p.variant === 'pick');
  const sameRate = sd.filter((x) => x.it.key).length / sd.length;
  t.ok(Math.abs(sameRate - 0.5) < 0.03, `samediff: same ≈ 50 % (${pct(sameRate)})`);
  const pairCounts = {};
  pk.forEach((x) => { const k = x.it.key.join(''); pairCounts[k] = (pairCounts[k] || 0) + 1; });
  t.ok(Object.keys(pairCounts).length === 6 && Object.values(pairCounts).every((c) => Math.abs(c / pk.length - 1 / 6) < 0.03), 'pick: the key pair is uniform over the 6 pairs');
  const dirRate = items.filter((x) => x.it.dir === 1).length / items.length;
  t.ok(Math.abs(dirRate - 0.5) < 0.03, `turns clockwise ≈ 50 % (${pct(dirRate)})`);
  const inBand = items.every(({ p, it }) => Math.abs(it.angle - def.dims[0].levels[p.angle]) <= 15 + 1e-9 && it.angle >= 0 && it.angle <= 180);
  t.ok(inBand, 'every item angle is its level ± 15° within 0–180°');
  const mirrorSlots = pk.reduce((s, x) => s + x.it.options.filter((o) => o.mirror).length, 0);
  t.eq(mirrorSlots, 2 * pk.length, 'pick: always 2 copies and 2 mirrors (no odd one out by chirality)');
  // Copies and mirrors are dealt to the turns at random: the copies are the 2 least-turned options 1/6 of the time.
  const leastTurned = pk.filter((x) => sameKey(top2(x.it.options.map((o) => -Math.abs(o.turn))), x.it.key)).length / pk.length;
  t.ok(leastTurned <= 1 / 6 + 0.03, `pick: copies are not the least-turned options (${pct(leastTurned)})`);

  // Determinism: the same seed gives the same item, here and in a freshly loaded context.
  const fresh = t.context().PX;
  let same = true, sameFresh = true;
  items.filter((_, i) => i % 25 === 0).forEach(({ p, seed, it }) => {
    if (deepDiff(def.generate(PX.rng(seed), p), it) !== null) same = false;
    if (deepDiff(fresh.ex.get('spin').generate(fresh.rng(seed), p), it) !== null) sameFresh = false;
  });
  t.ok(same, 'generation is deterministic (same seed → same item)');
  t.ok(sameFresh, 'generation is deterministic across contexts');
  t.ok(deepDiff(def.generate(PX.rng(1), { angle: 3, cells: 2 }), def.generate(PX.rng(2), { angle: 3, cells: 2 })) !== null, 'different seeds give different items');
  let robust = true;
  for (const bad of [undefined, {}, { angle: 99, cells: -3 }, { angle: 1.5, variant: 'nope' }]) {
    try { if (def.validate(def.generate(PX.rng(5), bad)) !== true) robust = false; } catch { robust = false; }
  }
  t.ok(robust, 'generate clamps malformed params instead of throwing');

  // Fallback construction: valid at every combination.
  let fbOk = true;
  for (const p of combos) for (let s = 0; s < 3; s++) if (def.validate(Object.assign(L.fallback(PX.rng(s), L.normParams(p)), { seed: s })) !== true) fbOk = false;
  t.ok(fbOk, 'the fallback construction is valid at every combination');
  L.stats.fallbacks = 0;

  // Generation time at the hardest level.
  const timings = [];
  for (const variant of def.variants) {
    const hard = { angle: def.dims[0].levels.length - 1, cells: def.dims[1].levels.length - 1, variant };
    const tm = timeP95((s) => def.generate(PX.rng(9000 + s), hard), 400);
    t.ok(tm.cpu < 20, `${variant}: generation p95 < 20 ms at the hardest level (CPU ${tm.cpu.toFixed(2)} ms, wall ${tm.wall.toFixed(2)} ms)`);
    timings.push(`${variant} ${tm.cpu.toFixed(2)} ms`);
  }

  t.section('spin: validate rejects broken items');
  const sdItem = sd.find((x) => !x.it.key).it, pkItem = pk[0].it, copyItem = sd.find((x) => x.it.key && x.it.params.cells === 0).it;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const rejects = (what, it, pattern) => {
    const v = def.validate(it);
    t.ok(typeof v === 'string' && (!pattern || pattern.test(v)), `validate rejects: ${what}` + (typeof v === 'string' ? '' : ' (it passed)') + (typeof v === 'string' && pattern && !pattern.test(v) ? ` (said: ${v})` : ''));
  };
  let m = clone(sdItem); m.key = !m.key; rejects('a wrong samediff key', m, /key/);
  m = clone(pkItem); m.key = [0, 1, 2, 3].filter((k) => !pkItem.key.includes(k)); rejects('a wrong pick key', m, /key/);
  m = clone(sdItem); m.probe.mirror = false; rejects('a mirror flag that contradicts the geometry', m, /mirror flag/);
  m = clone(pkItem); m.options[1].poly = clone(m.options[0].poly); m.options[1].turn = m.options[0].turn; m.options[1].mirror = m.options[0].mirror; rejects('two identical options', m);
  m = clone(copyItem); m.probe.poly = m.probe.poly.map(([x, y]) => [x * 1.1, y * 1.1]); rejects('a polygon off the lattice (scaled)', m, /lattice/);
  m = clone(copyItem); { const c = Math.cos(0.5), s = Math.sin(0.5); m.probe.poly = m.probe.poly.map(([x, y]) => [x * c - y * s, x * s + y * c]); } rejects('a probe turned by another angle than stated', m, /turn/);
  m = clone(copyItem); { const v = m.probe.poly; [v[1], v[2]] = [v[2], v[1]]; } rejects('a polygon that is not a simple outline', m);
  m = clone(copyItem); m.answer = 'multi'; rejects('an answer type that does not match the variant', m, /answer/);
  m = clone(pkItem); { const o = m.options[0], d = 35 * Math.PI / 180, c = Math.cos(d), s = Math.sin(d); o.poly = o.poly.map(([x, y]) => [x * c - y * s, x * s + y * c]); o.turn = Math.round((o.turn + 35) * 100) / 100; } rejects('a pick option far from the item angle', m);
  // An achiral 5-cell figure (the T pentomino) in place of the shape.
  const T = L.analyse([[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]]);
  m = clone(copyItem); m.ref.poly = L.figure(T, 20, false).poly; m.probe.poly = L.figure(T, 20 + m.probe.turn, false).poly; rejects('a figure with a mirror symmetry', m, /symmetry/);
  // A mirror that is the reference reflected across the vertical: seen at once as bilateral symmetry.
  m = clone(sdItem); { const refPhi = ((m.ref.rot % 90) + 90) % 90; m.probe.poly = m.ref.poly.map(([x, y]) => [-x, y]); m.probe.turn = Math.round(((-2 * refPhi) % 90 + 90) % 90 * 100) / 100; m.probe.mirror = true; }
  rejects('a mirror that is a left–right reflection of the reference', m, /reflected/);

  t.section('spin: shortcut solvers');
  const levels = def.dims[0].levels, report = [`hardest-level p95 CPU ${timings.join(', ')}`];
  const byLevel = (list) => levels.map((_, i) => list.filter((x) => x.p.angle === i));
  // samediff: each solver gives a score (higher = "same"); a threshold is fitted on half the items.
  const sdSolvers = {
    'silhouette area': (r, q) => -Math.abs(r.area - q.area),
    'box aspect': (r, q) => -Math.abs(r.asp - q.asp),
    'box aspect (unsigned)': (r, q) => -Math.abs(Math.abs(r.asp) - Math.abs(q.asp)),
    'box size': (r, q) => -(Math.abs(r.w - q.w) + Math.abs(r.h - q.h)),
  };
  for (const [name, fn] of Object.entries(sdSolvers)) {
    const accs = byLevel(sd).map((list) => cvAccuracy(list.map(({ it }) => fn(feats(it.ref.poly), feats(it.probe.poly))), list.map(({ it }) => it.key)));
    const pooled = cvAccuracy(sd.map(({ it }) => fn(feats(it.ref.poly), feats(it.probe.poly))), sd.map(({ it }) => it.key));
    t.ok(Math.max(...accs) <= 0.5 + CHANCE_MARGIN && pooled <= 0.5 + CHANCE_MARGIN, `samediff, ${name}: ≤ 60 % at every angle (${accs.map(pct).join(' ')}; pooled ${pct(pooled)})`);
    report.push(`samediff ${name} ${pct(pooled)} (max ${pct(Math.max(...accs))})`);
  }
  // pick: each solver names two options.
  const vec = (f) => [f.asp, Math.log(f.w * f.h), Math.cos(f.axis * Math.PI / 90), Math.sin(f.axis * Math.PI / 90)];
  const dist = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
  const pkSolvers = {
    'silhouette area': (R, F) => top2(F.map((f) => -Math.abs(f.area - R.area))),
    'box aspect': (R, F) => top2(F.map((f) => -Math.abs(f.asp - R.asp))),
    'box size': (R, F) => top2(F.map((f) => -(Math.abs(f.w - R.w) + Math.abs(f.h - R.h)))),
    'odd one out (stem-blind)': (R, F) => { const V = F.map(vec); return top2(V.map((a) => V.reduce((s, b) => s + dist(a, b), 0))); },
    'most like the others (stem-blind)': (R, F) => { const V = F.map(vec); return top2(V.map((a) => -V.reduce((s, b) => s + dist(a, b), 0))); },
    'closest pair (stem-blind)': (R, F) => {
      const V = F.map(vec); let best = null, bd = Infinity;
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (dist(V[i], V[j]) < bd) { bd = dist(V[i], V[j]); best = [i, j]; }
      return best;
    },
  };
  const pickLimit = 1 / 6 + CHANCE_MARGIN;
  for (const [name, fn] of Object.entries(pkSolvers)) {
    const hit = (list) => list.filter(({ it }) => sameKey(fn(feats(it.ref.poly), it.options.map((o) => feats(o.poly))), it.key)).length / list.length;
    const accs = byLevel(pk).map(hit), pooled = hit(pk);
    t.ok(Math.max(...accs) <= pickLimit && pooled <= pickLimit, `pick, ${name}: ≤ ${pct(pickLimit)} at every angle (${accs.map(pct).join(' ')}; pooled ${pct(pooled)})`);
    report.push(`pick ${name} ${pct(pooled)} (by angle ${accs.map(pct).join(' ')})`);
  }
  // Informational (not asserted): superimposing without turning, and the long-axis turn read against the
  // known level angle (an ideal observer; see the report).
  const sub = sd.filter((_, i) => i % 3 === 0);
  const iouAcc = byLevel(sub).map((list) => cvAccuracy(list.map(({ it }) => iou(it.ref.poly, it.probe.poly)), list.map(({ it }) => it.key)));
  const axisAcc = byLevel(sd).map((list, li) => cvAccuracy(list.map(({ it }) => {
    const a = feats(it.ref.poly), b = feats(it.probe.poly);
    return -Math.abs(fold(b.axis - a.axis, 180) - fold(levels[li], 180));
  }), list.map(({ it }) => it.key)));
  const edgeAcc = byLevel(sd).map((list, li) => cvAccuracy(list.map(({ it }) => {
    const e = (poly) => { const [a, b] = poly; return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; };
    return -Math.abs(fold(e(it.probe.poly) - e(it.ref.poly), 90) - fold(levels[li], 90));
  }), list.map(({ it }) => it.key)));
  t.ok(Math.max(...edgeAcc) <= 0.5 + CHANCE_MARGIN, `samediff, edge turn vs the level angle: ≤ 60 % (${edgeAcc.map(pct).join(' ')})`);
  report.push(`[info] overlap without turning ${iouAcc.map(pct).join(' ')}; long-axis turn vs level (ideal) ${axisAcc.map(pct).join(' ')}`);
  checkLearn(t, PX, def, 'spin', (it) => (it.variant === 'pick' ? 'pick' : it.key ? 'same' : 'mirror'));
  console.log('       EX-03 spin: ' + items.length + ' items; ' + report.join('; '));
}

/* ---------- learn data (js/ex/spin/learn.js): shape, valid params, demo kinds, captions the view uses ---------- */

// Caption keys the view asks for: string literals that start the first argument of cap(…) or follow
// a ? or : inside it (cap(ok ? 'a' : 'b', …)).
function viewCaptionKeys(id) {
  let src = '';
  try { src = readFileSync(new URL('../../js/ex/' + id + '/view.js', import.meta.url), 'utf8'); } catch (e) { return null; }
  const keys = new Set();
  for (const m of src.matchAll(/\bcap\(([^{})]*)[{)]/g)) for (const k of m[1].matchAll(/(?:^|\?|:)\s*'(\w+)'/g)) keys.add(k[1]);
  return [...keys];
}

function checkLearn(t, PX, def, id, kindOf) {
  t.section(id + ': learn');
  const L = PX.ex.learn(id);
  if (!t.ok(L && typeof L === 'object', 'learn data is registered')) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, 'a one-line goal');
  if (def.variants) t.ok(L.goals && def.variants.every((v) => typeof L.goals[v] === 'string'), 'a goal per variant');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 2 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed) && d.kind), 'demo items with valid params, seeds and kinds');
  t.ok(L.demo.every((d) => PX.ex.difficulty(def, d.params) <= PX.ex.minDifficulty(def) + 0.61), 'demos are at the easiest levels');
  for (const d of L.demo) {
    const item = def.generate(PX.rng(d.seed), d.params);
    t.eq(kindOf(item), d.kind, `demo seed ${d.seed} gives a ${d.kind} item`);
    t.ok(!item.fallback && def.validate(item) === true, `demo seed ${d.seed} is a regular, valid item`);
  }
  t.ok(Array.isArray(L.practice) && L.practice.length >= 3 && L.practice.length <= 5 && L.practice.every(valid), '3–5 practice params');
  t.ok(PX.ex.difficulty(def, L.practice[0]) <= PX.ex.minDifficulty(def) + 1e-9, 'practice starts at the easiest level');
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).every((l) => l >= 0 && l < d.levels.length));
    const varOk = !tr.variant || (def.variants || []).indexOf(tr.variant) >= 0;
    t.ok(tip.id && tip.text && dimOk && varOk && (tr.dim || tr.variant), `tip ${tip.id} has a valid trigger`);
  }
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok((L.strategies || []).every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  t.ok(typeof L.bridge === 'string' && /has not been shown to improve/.test(L.bridge), 'the "where it is used" card carries its limitation line');
  const all = JSON.stringify(L).toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered|genius/.test(all), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
  const keys = viewCaptionKeys(id);
  if (keys) {
    const missing = keys.filter((k) => !(L.captions && typeof L.captions[k] === 'string' && L.captions[k].length));
    t.ok(keys.length > 5 && missing.length === 0, `every caption the view uses exists (${keys.length} keys${missing.length ? '; missing ' + missing.join(', ') : ''})`);
  }
}
