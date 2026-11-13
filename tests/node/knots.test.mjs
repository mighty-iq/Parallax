/* EX-13 Knots: knot mathematics against known values, generator, validator, scorer, difficulty,
   shortcut solvers per variant, show-me replay, fallback, timing and learn data (ARCHITECTURE §12,
   PLAN M4, docs/research/v1.1/R2-knots.md). Run through tests/node/run.mjs.
   PX_REPORT=1 prints the numbers; PX_TEST_ITEMS=<n> sets the items per variant (default 10 000). */
import { MANIFEST, deepDiff } from './run.mjs';
import { performance } from 'node:perf_hooks';

const FILES = [...MANIFEST, 'js/ex/knots/gen.js', 'js/ex/knots/learn.js'];
const PER_VARIANT = +(process.env.PX_TEST_ITEMS || 10000);
const REPORT = !!process.env.PX_REPORT;
const procMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
const pct = (x) => (100 * x).toFixed(1) + ' %';

export async function run(t) {
  const PX = t.context({ files: FILES }).PX;
  const def = PX.ex.get('knots');
  t.section('knots: definition');
  t.ok(def, 'knots is registered');
  if (!def) return;
  const H = def.lib;
  t.eq([def.id, def.version, def.code, def.abilities, def.cell, def.role, def.answer], ['knots', 1, 'EX-13', ['Vz'], 'intrinsic-dynamic', 'train', 'yesno'], 'id, version, code, abilities, cell, role, answer');
  t.eq(def.variants, ['pull', 'untie', 'tie', 'link'], 'variants');
  t.eq(def.dims.map((d) => [d.key, d.levels.length, d.step]), [['rope', 10, 0.40], ['spacing', 3, 0.25]], 'dims: rope (10 rungs, 0.40) × spacing (3 levels, 0.25)');
  t.eq(def.variants.map((v) => def.chance({ variant: v })), [0.5, 0.25, 0.25, 0.5], 'chance by variant');
  const all = PX.ex.enumerate(def);
  t.eq(all.length, 120, 'every combination is enumerated');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4, `difficulty spans at least 4 logits (${lo.toFixed(2)} … ${hi.toFixed(2)})`);
  const easiest = all.reduce((a, p) => (def.difficulty(p) < def.difficulty(a) ? p : a));
  const g = def.chance(easiest), pB = g + (1 - g - 0.03) / (1 + Math.exp(def.difficulty(easiest)));
  t.ok(pB > 0.87 && pB < 0.93, `the easiest item is about 90 % right at θ = 0 (${(100 * pB).toFixed(1)} %, ${easiest.variant})`);
  t.eq(easiest, { rope: 0, spacing: 0, variant: 'pull' }, 'the easiest item: pull, 5 crossings, open spacing');
  const hardest = all.reduce((a, p) => (def.difficulty(p) > def.difficulty(a) ? p : a));
  t.eq(hardest, { rope: 9, spacing: 2, variant: 'link' }, 'the hardest item: link, top rung, tight spacing');

  knownValues(t, PX, H);
  moveChecks(t, PX, H);
  const pools = itemChecks(t, PX, def, H, all);
  fallbackAndTiming(t, PX, def, H, all, hardest);
  shortcuts(t, H, pools);
  replays(t, H, pools);
  testLearn(t, PX, def, H);
}

/* ---------- knot mathematics against published values ---------- */

// PD codes in the KnotTheory convention (X[a, b, c, d]: a the incoming under-strand, then
// counter-clockwise); the values are mathematical facts (Rolfsen table via the Knot Atlas).
const PDS = {
  '3_1': { pd: [[1, 4, 2, 5], [3, 6, 4, 1], [5, 2, 6, 3]], det: 3, V: { '-1': 1, '-3': 1, '-4': -1 } },
  '4_1': { pd: [[4, 2, 5, 1], [8, 6, 1, 5], [6, 3, 7, 4], [2, 7, 3, 8]], det: 5, V: { 2: 1, 1: -1, 0: 1, '-1': -1, '-2': 1 } },
  '5_1': { pd: [[1, 6, 2, 7], [3, 8, 4, 9], [5, 10, 6, 1], [7, 2, 8, 3], [9, 4, 10, 5]], det: 5, V: { '-2': 1, '-4': 1, '-5': -1, '-6': 1, '-7': -1 } },
  '5_2': { pd: [[1, 4, 2, 5], [3, 8, 4, 9], [5, 10, 6, 1], [9, 6, 10, 7], [7, 2, 8, 3]], det: 7, V: { '-1': 1, '-2': -1, '-3': 2, '-4': -1, '-5': 1, '-6': -1 } },
};
// A slot diagram straight from a PD code: each label joins its two slots; the over-strand comes in
// at slot 1 when the label at slot 3 follows the one at slot 1, else at slot 3.
function fromPD(list) {
  const n = list.length, N = 2 * n;
  const D = { n, link: new Int32Array(4 * n), oin: new Int8Array(n), cu: new Int8Array(n), co: new Int8Array(n), id: new Int32Array(n), alive: new Uint8Array(n).fill(1), live: n, free: 0, cl: -1 };
  const occ = {};
  list.forEach((X, x) => { D.id[x] = x; X.forEach((L, s) => { (occ[L] = occ[L] || []).push(4 * x + s); }); });
  for (const L in occ) { const [a, b] = occ[L]; D.link[a] = b; D.link[b] = a; }
  const nx = (a) => (a % N) + 1;
  list.forEach(([, b, , d], x) => { D.oin[x] = d === nx(b) ? 1 : 3; });
  return D;
}
// V (a polynomial in A) as { exponent of t: coefficient }, t = A^−4.
function tMap(V) {
  const m = {};
  V.c.forEach((c, k) => { if (c) m[String(-(V.lo + k) / 4)] = c; });
  return m;
}
const sameMap = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
const mirrorMap = (a) => Object.fromEntries(Object.entries(a).map(([e, c]) => [String(-e), c]));
const RIGHT_TREFOIL = { 1: 1, 3: 1, 4: -1 };

function knownValues(t, PX, H) {
  t.section('knots: known values');
  for (const [name, k] of Object.entries(PDS)) {
    const D = fromPD(k.pd), V = tMap(H.jones(D));
    t.eq(H.determinant(D), k.det, `${name}: determinant ${k.det}`);
    t.ok(sameMap(V, k.V) || sameMap(mirrorMap(V), k.V), `${name}: the Jones polynomial up to mirror image (${JSON.stringify(V)})`);
    t.eq(H.faces(D).length, D.n + 2, `${name}: n + 2 faces`);
    t.ok(H.classify(D).knot === true, `${name}: classified as a knot`);
  }
  // 4_1 is amphichiral, 3_1 and 5_2 are not: V(t) = V(1/t) only for 4_1
  const chir = (name) => { const V = H.jones(fromPD(PDS[name].pd)); return !H.peq(V, H.pmirror(V)); };
  t.eq([chir('3_1'), chir('4_1'), chir('5_2')], [true, false, true], 'chirality: 3_1 and 5_2 chiral, 4_1 amphichiral');
  // The hand: a trefoil of writhe +3 (right-handed) has V = t + t³ − t⁴ (from the skein relation).
  const D3 = fromPD(PDS['3_1'].pd), w3 = H.writhe(D3), V3 = tMap(H.jones(D3));
  t.ok(Math.abs(w3) === 3 && sameMap(w3 > 0 ? V3 : mirrorMap(V3), RIGHT_TREFOIL), `the trefoil's polynomial matches its hand (writhe ${w3})`);
  t.ok(H.pIsOne(H.jones(H.switched(fromPD(PDS['3_1'].pd), 0))), 'trefoil with one crossing switched: V = 1');
  t.ok(H.pIsOne(H.jones(H.switched(fromPD(PDS['4_1'].pd), 1))), 'figure-eight with one crossing switched: V = 1');
  t.eq(H.determinant(H.switched(fromPD(PDS['5_1'].pd), 2)), 3, '5_1 with one crossing switched: det 3 (a trefoil)');
  // 5_2: switching a clasp crossing unties it, a twist crossing leaves a trefoil (R2 §3.2)
  const D52 = fromPD(PDS['5_2'].pd), kinds = [];
  for (let x = 0; x < 5; x++) { const S = H.switched(D52, x); kinds.push(H.pIsOne(H.jones(S)) ? 'U' : H.determinant(S) === 3 ? '3' : '?'); }
  t.eq(kinds.slice().sort().join(''), '333UU', `5_2: two crossings untie it, three leave a trefoil (${kinds.join('')})`);
  // Two drawn circles crossing twice: over then under is the Hopf link (linking number ±1, its
  // Jones polynomial unlike the unlink's); over at both comes apart by moves.
  const circle = (cx) => { const q = []; for (let i = 0; i < 12; i++) { const a = 2 * Math.PI * i / 12; q.push([Math.round(cx + 70 * Math.cos(a)), Math.round(160 + 70 * Math.sin(a))]); } return q; };
  const loops = [{ pts: circle(125), closed: true }, { pts: circle(195), closed: true }];
  const hopf = H.diagramOf(loops, [true, false]), split = H.diagramOf(loops, [true, true]);
  if (typeof hopf !== 'string' && typeof split !== 'string') {
    t.eq(hopf.X.length, 2, 'two drawn circles cross twice');
    t.eq(Math.abs(H.linking(hopf.D)), 1, 'over then under: linking number ±1');
    t.ok(!H.peq(H.jones(hopf.D), H.V_UNLINK2) && H.linkKind(hopf.D).kind === 'L', 'over then under: linked (Jones unlike the unlink\'s)');
    const sk = H.linkKind(split.D);
    t.ok(sk && sk.kind === 'U' && H.peq(H.jones(split.D), H.V_UNLINK2), 'over at both: apart, by moves');
  } else t.fail('circles: ' + hopf + ' ' + split);

  // Geometry: a closed trefoil drawn from integer control points; alternating flags.
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const a = 2 * Math.PI * i / 18;
    pts.push([Math.round(160 + 40 * (Math.sin(a) + 2 * Math.sin(2 * a))), Math.round(160 - 40 * (Math.cos(a) - 2 * Math.cos(2 * a)))]);
  }
  const cv = [{ pts, closed: true }], X = H.crossingsOf(cv).list;
  t.eq(X.length, 3, 'a drawn trefoil outline has 3 crossings');
  const alt = H.diagramOf(cv, [true, false, true]), alt2 = H.diagramOf(cv, [false, true, false]);
  const other = H.diagramOf(cv, [true, true, true]);
  if (typeof alt !== 'string') {
    t.eq(H.determinant(alt.D), 3, 'the drawn alternating trefoil: det 3');
    const w2 = H.writhe(alt.D), Vt = tMap(H.jones(alt.D));
    t.ok(Math.abs(w2) === 3 && sameMap(w2 > 0 ? Vt : mirrorMap(Vt), RIGHT_TREFOIL), `the drawn trefoil's polynomial matches its hand as drawn (writhe ${w2})`);
    t.ok(H.peq(H.jones(alt2.D), H.pmirror(H.jones(alt.D))), 'switching every crossing gives the mirror image (V(1/t))');
    t.ok(H.pIsOne(H.jones(other.D)) && H.classify(other.D).proof === 'moves', 'the same outline with a non-alternating choice is the unknot, by moves');
  } else t.fail('the drawn trefoil: ' + alt);
  // Unknot diagrams: a lone curl, and a scrambled loop (R2 then R1)
  const curl = H.diagramOf([{ pts: [[-60, 160], [-20, 160], [40, 160], [120, 160], [200, 160], [240, 160], [240, 100], [200, 60], [160, 100], [160, 200], [160, 260], [200, 300], [260, 300], [380, 300], [420, 300]], closed: false }], [true]);
  if (typeof curl !== 'string') t.ok(curl.X.length === 1 && H.classify(curl.D).knot === false, 'an open rope with one curl: no knot');
  else t.fail('curl: ' + curl);
}

/* ---------- moves keep the knot ---------- */

function moveChecks(t, PX, H) {
  t.section('knots: moves');
  const rng = PX.rng(PX.rng.hash('knots-moves'));
  let r3 = 0, r3Bad = 0, simp = 0, simpBad = 0, sw = 0, swBad = 0, euler = 0, cert = 0, certBad = 0;
  for (let k = 0; k < 120; k++) {
    const dg = H.ropeShadow(rng, H.SPACING[k % 3], 5 + (k % 8), false);
    if (!dg) continue;
    const over = dg.X.map(() => rng.next() < 0.5), D = H.withOver(dg, over).D, V = H.jones(D);
    if (H.faces(D).length !== D.n + 2) euler++;
    for (const f of H.faces(D)) {
      if (!H.isR3(D, f)) continue;
      const E = H.cloneD(D); H.applyR3(E, f); r3++;
      if (!H.peq(H.jones(E), V) || H.faces(E).length !== E.live + 2) r3Bad++;
    }
    const s = H.simplify(D, 2); simp++;
    if (!H.peq(H.jones(s.D), V)) simpBad++;
    // a certificate empties exactly the unknots
    const c = H.classify(D);
    if (c.proof === 'moves') { cert++; if (!H.pIsOne(V)) certBad++; }
    if (c.knot && H.pIsOne(V)) certBad++;
    // switching twice is no switch; switching flips the sign
    const x = rng.int(0, D.n - 1), S1 = H.switched(D, x), S2 = H.switched(S1, x); sw++;
    if (!H.peq(H.jones(S2), V) || H.writhe(S1) !== H.writhe(D) - 2 * (D.oin[x] === 3 ? 1 : -1)) swBad++;
  }
  t.eq(euler, 0, 'every rope diagram has n + 2 faces');
  t.ok(r3 > 20 && r3Bad === 0, `slide-overs (R3) keep the Jones polynomial and the faces (${r3} checked)`);
  t.eq(simpBad, 0, `simplification keeps the Jones polynomial (${simp} ropes)`);
  t.eq(certBad, 0, `move certificates only for unknots, knots never V = 1 (${cert} certificates)`);
  t.eq(swBad, 0, `switching a crossing twice changes nothing; once flips its sign (${sw} checked)`);
}

/* ---------- items: 10 000 per variant ---------- */

function itemChecks(t, PX, def, H, all) {
  const pools = {};
  for (const variant of def.variants) {
    t.section(`knots: ${variant} items`);
    const combos = all.filter((p) => p.variant === variant), per = Math.max(1, Math.ceil(PER_VARIANT / combos.length));
    let threw = 0, invalid = 0, keyWrong = 0, otherRight = 0, malformedRight = 0, nonJson = 0, fallbacks = 0, n = 0, firstBad = null;
    const items = [], cpu = [], keys = [0, 0, 0, 0];
    let yes = 0;
    for (let ci = 0; ci < combos.length; ci++) {
      for (let s = 0; s < per; s++) {
        const seed = PX.rng.hash('knots-test', variant, ci, s);
        let item, c0 = procMs();
        try { item = def.generate(PX.rng(seed), combos[ci]); } catch (e) { threw++; firstBad = firstBad || `throw ${JSON.stringify(combos[ci])}: ${e.message}`; continue; }
        cpu.push(procMs() - c0);
        n++;
        if (item.fallback) fallbacks++;
        const v = def.validate(item);
        if (v !== true) { invalid++; firstBad = firstBad || `${JSON.stringify(combos[ci])} seed ${seed}: ${v}`; continue; }
        if (!def.score(item, item.key).correct) keyWrong++;
        if (item.answer === 'yesno') { if (def.score(item, !item.key).correct) otherRight++; yes += item.key ? 1 : 0; }
        else { for (let i = 0; i < 4; i++) if (i !== item.key && def.score(item, i).correct) otherRight++; keys[item.key]++; }
        if (n % 40 === 0) {
          for (const r of [-1, 4, 0.5, '1', null, undefined, NaN, [item.key], {}, item.answer === 'yesno' ? 1 : true]) {
            let res;
            try { res = def.score(item, r); } catch (e) { res = { correct: true }; }
            if (!res || res.correct !== false) malformedRight++;
          }
          if (deepDiff(JSON.parse(JSON.stringify(item)), item) !== null) nonJson++;
        }
        items.push({ seed, params: combos[ci], item });
      }
    }
    t.eq(threw, 0, 'generate never throws' + (threw ? ` (${firstBad})` : ''));
    t.ok(n >= Math.min(10000, PER_VARIANT), `at least ${Math.min(10000, PER_VARIANT)} items (${n})`);
    t.eq(invalid, 0, 'validate passes on every item' + (invalid ? ` (${firstBad})` : ''));
    t.eq(keyWrong, 0, 'the key scores right');
    t.eq(otherRight, 0, 'every other response scores wrong');
    t.eq(malformedRight, 0, 'malformed responses score wrong and never throw');
    t.eq(nonJson, 0, 'items survive JSON round trips');
    t.ok(fallbacks <= Math.ceil(n / 1000), `fallbacks at most 1 in 1 000 (${fallbacks})`);
    if (variant === 'pull' || variant === 'link') {
      const r = yes / items.length, tol = Math.max(0.02, 3 * Math.sqrt(0.25 / items.length));
      t.ok(Math.abs(r - 0.5) < tol, `${variant}: yes and no are balanced (${pct(r)} ${variant === 'pull' ? 'knots' : 'linked'})`);
    } else {
      const tot = keys.reduce((a, b) => a + b, 0), worst = Math.max(...keys.map((k) => Math.abs(k / tot - 0.25)));
      t.ok(worst < Math.max(0.03, 4 * Math.sqrt(0.1875 / tot)), `${variant}: keys spread over the four tags (${keys.join(', ')})`);
    }
    // a moved key is always caught by the validator
    let caught = 0, tried = 0;
    for (const x of items.slice(0, 300)) {
      const bad = JSON.parse(JSON.stringify(x.item));
      bad.key = bad.answer === 'yesno' ? !bad.key : (bad.key + 1) % 4;
      tried++;
      if (def.validate(bad) !== true) caught++;
    }
    t.eq(caught, tried, 'a changed key is always rejected');
    // the validator follows the geometry and flags, not the bookkeeping: switch one crossing; when
    // that changes what the rope is, the item must be rejected
    let changed = 0, caught2 = 0;
    for (const x of items.slice(0, 120)) {
      const bad = JSON.parse(JSON.stringify(x.item)), c = (x.seed >>> 3) % bad.over.length;
      bad.over[c] = !bad.over[c];
      const dg = H.diagramOf(H.curvesOf(bad), bad.over);
      if (typeof dg === 'string') continue;
      const truth = variant === 'link' ? (H.linkKind(dg.D) || {}).kind === 'L' : variant === 'pull' ? H.classify(dg.D).knot : null;
      if (truth === null || truth === bad.key) continue;
      changed++;
      if (def.validate(bad) !== true) caught2++;
    }
    if (variant === 'pull' || variant === 'link') t.eq(caught2, changed, `a switched crossing that changes the answer is always rejected (${changed} cases)`);
    // determinism, here and in a freshly loaded context
    let diff = 0, firstDiff = null;
    for (const x of items.filter((_, i) => i % 50 === 0)) {
      const d = deepDiff(def.generate(PX.rng(x.seed), x.params), x.item);
      if (d) { diff++; firstDiff = firstDiff || d; }
    }
    t.eq(diff, 0, 'the same seed gives the same item' + (firstDiff ? `: ${firstDiff}` : ''));
    const other = t.context({ files: FILES }).PX.ex.get('knots');
    let diff2 = 0;
    for (const x of items.filter((_, i) => i % 200 === 0)) if (deepDiff(other.generate(PX.rng(x.seed), x.params), x.item)) diff2++;
    t.eq(diff2, 0, 'the same items in a freshly loaded context');
    cpu.sort((a, b) => a - b);
    const p50 = cpu[cpu.length >> 1], p95 = cpu[Math.floor(cpu.length * 0.95)];
    if (REPORT) console.log(`       knots ${variant}: ${n} items, CPU per item p50 ${p50.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms, max ${cpu[cpu.length - 1].toFixed(1)} ms; fallbacks ${fallbacks}`);
    pools[variant] = { items, p50, p95 };
  }
  return pools;
}

function fallbackAndTiming(t, PX, def, H, all, hardest) {
  t.section('knots: fallback and timing');
  let bad = 0, first = null;
  for (const params of all) {
    const it = H.fallback(H.norm(params)), v = it ? def.validate(it) : 'no item';
    if (!it || it.fallback !== true || v !== true || it.variant !== params.variant) { bad++; first = first || `${JSON.stringify(params)}: ${v}`; }
  }
  t.eq(bad, 0, 'the fallback construction is valid for every params combination' + (first ? ` (${first})` : ''));
  for (let s = 0; s < 20; s++) def.generate(PX.rng(PX.rng.hash('warm', s)), hardest);
  const q = (a, f) => [...a].sort((x, y) => x - y)[Math.floor(f * (a.length - 1))];
  let p95 = Infinity, p50 = Infinity, wall95 = 0;
  for (let round = 0; round < 3; round++) {
    const cpu = [], wall = [];
    for (let s = 0; s < 120; s++) {
      const c0 = procMs(), t0 = performance.now();
      def.generate(PX.rng(PX.rng.hash('time', round, s)), hardest);
      wall.push(performance.now() - t0);
      cpu.push(procMs() - c0);
    }
    if (q(cpu, 0.95) < p95) { p95 = q(cpu, 0.95); p50 = q(cpu, 0.5); wall95 = q(wall, 0.95); }
  }
  t.ok(p95 < 20, `generation p95 at the hardest level under 20 ms (CPU p50 ${p50.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms; wall p95 ${wall95.toFixed(2)} ms)`);
  if (REPORT) console.log(`       knots timing at the hardest level (${JSON.stringify(hardest)}): CPU p50 ${p50.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`);
}

/* ---------- shortcut solvers (CLAUDE.md rule 5: ≤ chance + 10 points) ---------- */

// The best single threshold, either direction, for a yes/no key.
function bestThreshold(values, keys) {
  const v = values.map((x, i) => [x, keys[i]]).sort((a, b) => a[0] - b[0]), N = v.length, totY = v.filter((x) => x[1]).length;
  let best = Math.max(totY, N - totY) / N, yBelow = 0;
  for (let i = 0; i < N; i++) {
    if (v[i][1]) yBelow++;
    if (i + 1 < N && v[i + 1][0] === v[i][0]) continue;
    const acc = (N - (i + 1) - (totY - yBelow) + yBelow) / N;
    best = Math.max(best, acc, 1 - acc);
  }
  return best;
}
// Expected accuracy of "pick the best-scoring option" with ties broken at random.
function pickBest(scores, key) {
  const best = Math.max(...scores), ties = scores.filter((s) => Math.abs(s - best) < 1e-9).length;
  return Math.abs(scores[key] - best) < 1e-9 ? 1 / ties : 0;
}
function plateStats(H, item) {
  let len = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const cv of H.curvesOf(item)) {
    const s = H.sampleCurve(cv);
    for (let j = 1; j < s.m; j++) {
      const a = [s.x[j - 1], s.y[j - 1]], b = [s.x[j], s.y[j]];
      if (Math.min(a[0], a[1], b[0], b[1]) < 0 || Math.max(a[0], a[1], b[0], b[1]) > 320) continue;
      len += Math.hypot(b[0] - a[0], b[1] - a[1]);
      x0 = Math.min(x0, b[0]); x1 = Math.max(x1, b[0]); y0 = Math.min(y0, b[1]); y1 = Math.max(y1, b[1]);
    }
  }
  return { len, aspect: (x1 - x0) / Math.max(1, y1 - y0) };
}

function shortcuts(t, H, pools) {
  t.section('knots: shortcut solvers');
  const lines = [];
  // pull: every cheap count, best threshold ≤ 60 %
  {
    const its = pools.pull.items.map((x) => x.item), keys = its.map((it) => it.key), F = its.map((it) => {
      const dg = H.diagramOf(H.curvesOf(it), it.over), f = H.ropeFeatures(dg), ps = plateStats(H, it);
      return Object.assign(f, { altFrac: f.alt / Math.max(1, 2 * f.n - 1), aw: Math.abs(f.writhe), r12: f.r1 + f.r2, len: ps.len, aspect: ps.aspect });
    });
    const feats = { crossings: 'n', alternations: 'alt', 'alternations (closed)': 'altClosed', 'alternation share': 'altFrac', '|writhe|': 'aw', writhe: 'writhe', curls: 'r1', 'loops on top': 'r2', 'curls + loops': 'r12', bigons: 'bigons', 'slide-over triangles': 'r3', 'rope length': 'len', 'aspect': 'aspect' };
    const res = [];
    for (const [name, k] of Object.entries(feats)) {
      const acc = bestThreshold(F.map((f) => f[k]), keys);
      t.ok(acc <= 0.6, `pull: "${name}" decides ≤ 60 % (${pct(acc)})`);
      res.push(`${name} ${pct(acc)}`);
    }
    const mono = F.filter((f, i) => f.mono === !keys[i]).length / F.length;
    const monoGuess = F.reduce((a, f, i) => a + (f.mono ? (keys[i] ? 0 : 1) : 0.5), 0) / F.length;
    t.ok(mono <= 0.6 && monoGuess <= 0.6, `pull: "descending from an end ⇒ no knot" ≤ 60 % (${pct(mono)}; with guessing ${pct(monoGuess)})`);
    lines.push('pull: ' + res.join(', ') + `, descending ${pct(mono)}`);
  }
  // untie / tie: per option, max / min / odd one out / most like the others, ≤ 35 %
  for (const variant of ['untie', 'tie']) {
    const acc = {}, add = (k, v) => { acc[k] = (acc[k] || 0) + v; };
    const its = pools[variant].items.map((x) => x.item);
    for (const it of its) {
      const dg = H.diagramOf(H.curvesOf(it), it.over), fc = H.shadowFacts(dg);
      const fs = it.tags.map((c) => H.switchFeatures(dg, fc, it.over, c));
      const vis = it.tags.map((c) => { const o = it.over.slice(); o[c] = !o[c]; const f = H.ropeFeatures(H.withOver(dg, o)); return f.r1 + f.r2; });
      const feats = {
        'switch makes a loop slide off': fs.map((f) => f[0]), 'twist region': fs.map((f) => f[1]),
        'change in alternations': fs.map((f) => f[2]), 'change in alternations (closed)': fs.map((f) => f[3]),
        'visible moves after the switch': vis, 'distance from the centre': it.tags.map((c) => Math.hypot(dg.X[c].x - 160, dg.X[c].y - 160)),
        handedness: it.tags.map((c) => (dg.D.oin[c] === 3 ? 1 : -1)), 'crossing angle': it.tags.map((c) => Math.round(dg.X[c].sin * 100)),
      };
      for (const [name, v] of Object.entries(feats)) {
        add(name + ': most', pickBest(v, it.key)); add(name + ': least', pickBest(v.map((x) => -x), it.key));
        add(name + ': odd one out', pickBest(v.map((x) => -v.filter((y) => Math.abs(y - x) < 1e-9).length), it.key));
        add(name + ': most like the others', pickBest(v.map((x) => v.filter((y) => Math.abs(y - x) < 1e-9).length), it.key));
      }
    }
    const worst = Object.entries(acc).map(([k, v]) => [k, v / its.length]).sort((a, b) => b[1] - a[1]);
    for (const [k, v] of worst) t.ok(v <= 0.35, `${variant}: "${k}" ≤ 35 % (${pct(v)})`);
    lines.push(`${variant}: worst ` + worst.slice(0, 4).map(([k, v]) => `${k} ${pct(v)}`).join(', '));
  }
  // link: parity of A-over-B crossings (sound when odd), loops wholly on top, cheap counts
  {
    const its = pools.link.items.map((x) => x.item), keys = its.map((it) => it.key);
    let odd = 0, layered = 0, parity = 0, signed = 0;
    const alts = [], aw = [], r2 = [];
    for (const it of its) {
      const dg = H.diagramOf(H.curvesOf(it), it.over), fc = H.linkFacts(dg), sg = H.linkSig(fc, it.over);
      const a = sg.a, inter = fc.inter.filter(Boolean).length;
      if (a % 2) odd++;
      if (a === 0 || a === inter) layered++;
      parity += a % 2 ? (it.key ? 1 : 0) : 0.5;
      signed += (H.linking(dg.D) !== 0) === it.key ? 1 : 0;
      const parts = sg.key.split('|');
      alts.push(parts[1].split(',').map(Number)); aw.push(Math.abs(+parts[2])); r2.push(+parts[3]);
    }
    t.eq(layered, 0, 'link: no item has one loop wholly on top');
    t.ok(odd / its.length <= 0.2 * 0.5 + 1e-9 || odd === 0, `link: at most 20 % of linked items have an odd A-over-B count (${odd} of ${its.length} items)`);
    t.ok(parity / its.length <= 0.6, `link: "odd A-over-B count ⇒ linked" ≤ 60 % (${pct(parity / its.length)})`);
    const accA = bestThreshold(alts.map((x) => x[0]), keys), accB = bestThreshold(alts.map((x) => x[1]), keys);
    const accW = bestThreshold(aw, keys), accR = bestThreshold(r2, keys);
    t.ok(accA <= 0.6 && accB <= 0.6, `link: alternations round each loop ≤ 60 % (${pct(accA)}, ${pct(accB)})`);
    t.ok(accW <= 0.6, `link: |writhe| ≤ 60 % (${pct(accW)})`);
    t.ok(accR <= 0.6, `link: visible slides ≤ 60 % (${pct(accR)})`);
    lines.push(`link: parity ${pct(parity / its.length)}, alternations ${pct(accA)}/${pct(accB)}, |writhe| ${pct(accW)}, slides ${pct(accR)}, signed count (a strategy, reported) ${pct(signed / its.length)}`);
  }
  if (REPORT) lines.forEach((l) => console.log('       knots ' + l));
}

/* ---------- show me: the simplifier replayed on the drawn rope ---------- */

function replays(t, H, pools) {
  t.section('knots: show me');
  const lines = [];
  for (const variant of ['pull', 'untie', 'tie', 'link']) {
    const sample = pools[variant].items.filter((_, i) => i % Math.max(1, Math.floor(pools[variant].items.length / 300)) === 0);
    let n = 0, reached = 0, finished = 0, wrong = 0, steps = 0;
    for (const x of sample) {
      const it = x.item, cv = H.curvesOf(it);
      let over = it.over, apart;
      if (variant === 'pull') apart = !it.key;
      else if (variant === 'link') apart = !it.key;
      else { over = it.over.slice(); over[it.tags[it.key]] = !over[it.tags[it.key]]; apart = variant === 'untie'; }
      const R = H.replay(cv, over, { split: variant === 'link' && apart });
      n++;
      if (R.broken) continue;
      finished++; steps += R.steps.length;
      if (apart && R.reached) reached++;
      // never wrong: a knot (a link) is still one at the end; every step was checked as it went
      if (!apart) {
        reached++;
        if (variant === 'link' ? H.interCount(R.end.D) === 0 : R.end.D.live === 0) wrong++;
      }
    }
    t.ok(reached / n >= 0.85, `${variant}: show me plays to the end for most items (${reached} of ${n})`);
    t.eq(wrong, 0, `${variant}: show me never turns a knot (or linked loops) into something else`);
    lines.push(`${variant} ${reached}/${n} reach the end (${finished} without a broken step), ${(steps / Math.max(1, finished)).toFixed(1)} moves each`);
  }
  if (REPORT) console.log('       knots show me: ' + lines.join('; '));
}

/* ---------- learn data (js/ex/knots/learn.js) ---------- */

function testLearn(t, PX, def, H) {
  t.section('knots: learn');
  const L = PX.ex.learn('knots');
  t.ok(L && typeof L === 'object', 'learn data is registered');
  if (!L) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, 'a one-line goal');
  t.ok(def.variants.every((v) => typeof (L.goals || {})[v] === 'string' && L.goals[v].length <= 120), 'a one-line goal per variant');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text && (!p.variant || def.variants.includes(p.variant))), 'labelled parts');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length >= 2 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed)), 'demo items with valid params');
  const kindOf = (it) => it.fallback ? 'fallback' : it.variant === 'pull' ? (it.key ? 'knot' : 'no-knot') : it.variant === 'link' ? (it.key ? 'linked' : 'apart') : it.variant;
  for (const d of L.demo) {
    const it = def.generate(PX.rng(d.seed), d.params);
    t.eq(kindOf(it), d.kind, `demo seed ${d.seed} gives a ${d.kind} item`);
    let over = it.over;
    if (it.tags) { over = it.over.slice(); over[it.tags[it.key]] = !over[it.tags[it.key]]; }
    const apart = it.variant === 'tie' ? false : it.variant === 'untie' ? true : !it.key;
    const R = H.replay(H.curvesOf(it), over, { split: it.variant === 'link' && apart });
    t.ok(R && !R.broken && (!apart || R.reached), `demo seed ${d.seed}: show me plays to the end`);
  }
  t.ok(def.variants.every((v) => L.demo.some((d) => d.params.variant === v)), 'a demo for every variant');
  t.ok(Array.isArray(L.practice) && L.practice.length >= 3 && L.practice.length <= 5 && L.practice.every(valid), '3–5 practice params');
  t.ok(L.practice.every((p, i) => i === 0 || def.difficulty(p) >= def.difficulty(L.practice[i - 1]) - 1e-9), 'practice items easiest first');
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    const dimOk = !tr.dim || def.dims.some((d) => d.key === tr.dim && (tr.levels || []).length && tr.levels.every((l) => l >= 0 && l < d.levels.length));
    const varOk = !tr.variant || def.variants.includes(tr.variant);
    t.ok(tip.id && tip.text && (tr.dim || tr.variant) && dimOk && varOk, `tip ${tip.id} has a valid trigger`);
  }
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['gap', 'pair', 'curl', 'slide', 'slideUnder', 'over', 'none', 'knot', 'knotCore', 'broken', 'switchKey', 'unties', 'ties', 'stays', 'apart', 'linked', 'linkedZero', 'moves'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  t.ok(typeof L.bridge === 'string' && /not been shown/.test(L.bridge), 'a "where it is used" text with its limitation line');
  const allText = JSON.stringify(L).toLowerCase();
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered/.test(allText), 'no IQ, intelligence or "mastered" claims (CLAUDE.md rules 2 and 12)');
}
