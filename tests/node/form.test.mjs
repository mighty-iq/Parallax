/* EX-19 Form (DAT-style format): solids, nets that fold back (closure), symmetry groups, generator, validator, scorer,
   shortcut solvers, timing, learn data. Run through tests/node/run.mjs (filter: form). */
import { performance } from 'node:perf_hooks';
import { MANIFEST } from './run.mjs';

const FILES = [...MANIFEST, 'js/ex/form/gen.js', 'js/ex/form/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // 140 per combination (72 with the starter band)
const CHANCE = 0.25, LIMIT = CHANCE + 0.10;

export async function run(t) {
  const PX = t.context({ files: FILES }).PX, def = PX.ex.get('form');
  t.section('form: definition');
  t.ok(def, 'form is defined');
  if (!def) return;
  const L = def.lib;
  testDefinition(t, PX, def);
  testModel(t, PX, L);
  const pool = testPool(t, PX, def, L);
  testItems(t, PX, def, L, pool);
  testShortcuts(t, PX, def, L, pool);
  testTampering(t, PX, def, L, pool);
  testFallback(t, PX, def, L);
  testTiming(t, PX, def);
  testLearn(t, PX, def);
  testTutorialRepeat(t, PX, def, 'form');
}

const sig = (x) => 1 / (1 + Math.exp(-x));
// A face's shape, turn and flip ignored: corner count, sorted sides, sorted diagonals (own code, not the generator's).
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function shapeOfPts(P) {
  const n = P.length, s = [], d = [];
  for (let i = 0; i < n; i++) { s.push(dist3(P[i], P[(i + 1) % n])); for (let j = i + 2; j < n; j++) if (!(i === 0 && j === n - 1)) d.push(dist3(P[i], P[j])); }
  return n + ':' + s.sort((x, y) => x - y).map((x) => x.toFixed(2)).join(',') + '/' + d.sort((x, y) => x - y).map((x) => x.toFixed(2)).join(',');
}
const shapeOf = (S, f) => shapeOfPts(S.faces[f].map((v) => S.verts[v]));
const pRight = (theta, b, g = CHANCE) => g + (1 - g - 0.03) * sig(theta - b);
const pk = (p) => `${p.solid}${p.marks}${p.view}${p.foil}`;

function testDefinition(t, PX, def) {
  t.eq([def.id, def.version, def.code, def.abilities, def.role, def.answer, def.nOptions, def.pat],
    ['form', 2, 'EX-19', ['Vz'], 'train', 'choice', 4, true], 'definition fields (a PAT-format exercise; version 2: the starter band)');
  t.eq(def.dims.map((d) => [d.key, d.levels.length]), [['solid', 3], ['marks', 4], ['view', 3], ['foil', 2]], 'dims');
  t.eq(def.starter, { dim: 'marks', levels: 1 }, 'the starter band is the first level of marks');
  t.eq(def.dims[1].at, [-1.5, 0, 0.6, 1.2], 'marks: the band offset in front, older levels at their 1.1 difficulty (step 0.6)');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(Math.abs(lo + 3.7) < 1e-9, `the floor moves to −3.7 (${lo.toFixed(2)}; note D2 §3.5)`);
  t.ok(hi - lo >= 4 - 1e-9, `difficulty spans at least 4 logits (${(hi - lo).toFixed(2)})`);
  const old0 = PX.ex.difficulty(def, { solid: 0, marks: 1, view: 0, foil: 0 });
  t.ok(Math.abs(old0 + 2.2) < 1e-9 && pRight(0, old0) >= 0.88 && pRight(0, old0) <= 0.93, `a beginner at θ = 0 gets the pre-1.2 floor about 90 % right (${pRight(0, old0).toFixed(3)}), the starter band ${pRight(0, lo).toFixed(3)}`);
}

/* ------------------------------------------------------------------ the model */

function testModel(t, PX, L) {
  t.section('form: model');
  const r = PX.rng(31), SYM = { box: [4], tri: [2], trap: [2], pyr: [2], frus: [2, 4], house: [2], tet: [1, 3], wedge: [1, 2] }; // a square frustum has four
  const ALL = ['box', 'tri', 'trap', 'wedge', 'pyr', 'tet', 'frus', 'house']; // every kind built ('tet' is not used by items)
  t.eq(L.KINDS.flat().sort(), ALL.filter((k) => k !== 'tet').sort(), 'items use every kind with a four-sided face (half marks need one)');
  let n = 0, closed = 0, symOk = 0, solidOk = 0, nets = 0, mirrorOk = 0, first = '';
  for (let k = 0; k < 600; k++) {
    const kind = ALL[k % 8], S = L.build(kind, L.randomDims(r, kind));
    n++;
    if (L.okSolid(S)) solidOk++;
    const g = L.matchings(S, S).length;
    if (SYM[kind].includes(g)) symOk++; else first = first || `${kind} ${JSON.stringify(S.dims)} has ${g} turns onto itself`;
    const net = L.unfold(r, S);
    if (!net) continue;
    nets++;
    if (L.validNet({ solid: S, net }) === true) closed++;
    // the mirror image is the same solid (all kinds are mirror-symmetric), so some turn carries one onto the other
    if (L.matchings(S, L.mirrored(S)).length === g) mirrorOk++;
  }
  t.eq(solidOk, n, `every built solid is closed and convex (${n})`);
  t.eq(symOk, n, 'turn groups: box 4, prisms and pyramids 2 (square frustum 4), uneven wedge and three-sided pyramid 1' + (first ? ' first: ' + first : ''));
  t.ok(nets >= 0.9 * n, `random spanning trees unfold without overlap mostly (${nets}/${n})`);
  t.eq(closed, nets, 'every unfolded net folds back into its solid (the validator\'s fold)');
  t.eq(mirrorOk, nets, 'mirror images are congruent solids (marks decide chirality)');
  // A box net with a face moved does not close.
  const S = L.build('box', [2, 3, 4]), net = L.unfold(PX.rng(5), S), bad = JSON.parse(JSON.stringify(net));
  bad[bad.length - 1].poly = bad[bad.length - 1].poly.map(([x, y]) => [x + 0.5, y]);
  t.ok(net && L.validNet({ solid: S, net: bad }) !== true, 'a net with a shifted piece is rejected');
}

/* ------------------------------------------------------------------ the pool */

function testPool(t, PX, def, L) {
  t.section('form: pool');
  const combos = PX.ex.enumerate(def);
  t.eq(combos.length, 72, '72 combinations (3 × 4 × 3 × 2)');
  const per = Math.ceil(N_ITEMS / combos.length), items = [];
  let threw = 0, invalid = 0, keyWrong = 0, foilRight = 0, malformed = 0, json = 0, first = null;
  const before = { ...L.stats };
  for (const p of combos) {
    for (let s = 0; s < per; s++) {
      const seed = PX.rng.hash('form-test', pk(p), s);
      let it;
      try { it = def.generate(PX.rng(seed), p); } catch (e) { threw++; first = first || `${pk(p)}#${s} threw ${e.message}`; continue; }
      const v = def.validate(it);
      if (v !== true) { invalid++; first = first || `${pk(p)}#${s}: ${v}`; }
      if (!def.score(it, it.key).correct) keyWrong++;
      for (let i = 0; i < 4; i++) if (i !== it.key && def.score(it, i).correct) foilRight++;
      for (const bad of [null, undefined, -1, 4, '0', 1.5]) if (def.score(it, bad).correct) malformed++;
      const text = JSON.stringify(it);
      if (JSON.stringify(JSON.parse(text)) !== text) json++;
      items.push({ p, s, seed, it });
    }
  }
  const n = items.length;
  t.ok(n >= Math.min(10000, N_ITEMS), `at least 10 000 seeds (${n})`);
  t.eq(threw, 0, 'generate never throws' + (threw ? ` (${first})` : ''));
  t.eq(invalid, 0, 'validate passes on every item' + (invalid ? ` (${first})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(foilRight, 0, 'every other option scores wrong');
  t.eq(malformed, 0, 'malformed responses score wrong');
  t.eq(json, 0, 'items survive a JSON round trip');
  t.eq(L.stats.errors - before.errors, 0, 'no attempt threw inside generate' + (L.stats.lastError ? ': ' + String(L.stats.lastError).split('\n')[0] : ''));
  t.eq(L.stats.fallbacks - before.fallbacks, 0, 'no item needed the fallback construction');
  console.log(`       form attempts per item ${((L.stats.tries - before.tries) / n).toFixed(2)}`);
  let same = 0, checked = 0;
  for (let i = 0; i < items.length; i += 10) {
    checked++;
    if (JSON.stringify(def.generate(PX.rng(items[i].seed), items[i].p)) === JSON.stringify(items[i].it)) same++;
  }
  t.eq(same, checked, `the same seed gives the same item (${checked} seeds regenerated)`);
  const distinct = new Set(items.map((x) => JSON.stringify([x.it.solid.dims, x.it.marks, x.it.net.map((q) => q.face)])));
  t.ok(distinct.size > 0.6 * n, `items are varied (${distinct.size} distinct of ${n})`);
  return items;
}

function testItems(t, PX, def, L, pool) {
  t.section('form: items');
  const ranks = [0, 0, 0, 0], kinds = {}, solids = {};
  let lvl = 0, marksOk = 0, viewOk = 0, shapeOk = 0, nShape = 0, noCube = 0, seen3 = 0, congruentOk = 0, nFoil = 0;
  let nBand = 0, band2x2 = 0, bandOff = 0, bandKinds = 0;
  for (const { p, it } of pool) {
    ranks[it.key]++;
    solids[it.solid.kind] = (solids[it.solid.kind] || 0) + 1;
    if (L.KINDS[p.solid].includes(it.solid.kind)) lvl++;
    const m = it.marks, ones = m.filter((x) => x === 1).length, halves = m.filter((x) => typeof x === 'object').length;
    if ((p.marks === 0 && ones === 1 && halves === 0) || (p.marks === 1 && ones === 1 && halves === 1) || (p.marks === 2 && ones === 2 && halves === 1) || (p.marks === 3 && ones === 1 && halves === 2)) marksOk++;
    if (p.marks === 0) { // the starter band (note D2 §3.5)
      nBand++;
      if (p.solid > 0 || ['box', 'tri'].includes(it.solid.kind)) bandKinds++;
      // a 2 × 2 of right or wrong size and right or wrong shaded face shape
      const sz = it.options.map((o) => o.solid.dims.join() === it.solid.dims.join()), shadeKey = (o) => shapeOf(o.solid, o.marks.indexOf(1));
      const keyShade = shadeKey(it.options[it.key]), stretched = it.options.filter((o, i) => !sz[i]);
      const cls = it.options.map((o, i) => (sz[i] ? 'S' : 'W') + (i === it.key || (sz[i] ? false : stretched.length === 2 && JSON.stringify(o.marks) === JSON.stringify(it.marks)) ? 'k' : 'm'));
      if (JSON.stringify(cls.slice().sort()) === JSON.stringify(['Sk', 'Sm', 'Wk', 'Wm']) && stretched.length === 2 && stretched[0].solid.dims.join() === stretched[1].solid.dims.join()
        && it.options.filter((o, i) => sz[i] && i !== it.key).every((o) => shadeKey(o) !== keyShade)) band2x2++;
      const need = p.foil === 0 ? 0.4 : 0.25;
      if (stretched.every((o) => { const d = o.solid.dims.map((x, j) => Math.abs(x - it.solid.dims[j]) / it.solid.dims[j]).filter((x) => x > 1e-9); return d.length === 1 && d[0] >= need - 1e-9 && d[0] < (p.foil === 0 ? 0.6 : 0.4) + 1e-9; })) bandOff++;
      it.options.forEach((o, i) => { if (i !== it.key) kinds[o.kind] = (kinds[o.kind] || 0) + 1; });
      if (it.options.every((o) => L.TILT_SETS[p.view].includes(o.view.tilt))) viewOk++;
      if (!(it.solid.kind === 'box' && new Set(it.solid.dims).size < 3)) noCube++;
      if (it.options.every((o) => L.seenFaces(o.solid, o.view).length >= 2)) seen3++;
      continue;
    }
    // Foils move marks only to congruent faces (R3 §8.6): per face shape, as many shaded and half-shaded
    // faces as in the pattern; the proportion foil carries the pattern's own marks.
    const tally = (S, mk) => { const o = {}; mk.forEach((x, f) => { if (x) { const k = shapeOf(S, f) + (typeof x === 'object' ? '#h' : '#f'); o[k] = (o[k] || 0) + 1; } }); return JSON.stringify(Object.entries(o).sort()); };
    const kt = tally(it.solid, m);
    it.options.forEach((o, i) => {
      if (i === it.key) return;
      nFoil++;
      if (o.kind === 'shape' ? JSON.stringify(o.marks) === JSON.stringify(m) : tally(o.solid, o.marks) === kt && JSON.stringify(o.solid.verts) === JSON.stringify(it.solid.verts)) congruentOk++;
    });
    if (it.options.every((o) => L.TILT_SETS[p.view].includes(o.view.tilt))) viewOk++;
    if (!(it.solid.kind === 'box' && new Set(it.solid.dims).size < 3)) noCube++;
    if (it.options.every((o) => L.seenFaces(o.solid, o.view).length >= 2)) seen3++;
    const sh = it.options.filter((o) => o.kind === 'shape').length;
    if (p.foil === 0) { nShape++; if (sh === 1) shapeOk++; } else if (sh === 0) shapeOk++;
    it.options.forEach((o, i) => { if (i !== it.key) kinds[o.kind] = (kinds[o.kind] || 0) + 1; });
  }
  const N = pool.length;
  t.eq(lvl, N, 'the solid is of the level\'s kinds');
  t.eq(marksOk, N, 'marks as the level says (starter: one shaded; shaded + half; two shaded + half; shaded + two halves)');
  t.eq(congruentOk, nFoil, `above the band, mark foils move marks only to congruent faces; proportion foils keep the pattern's marks (${nFoil} foils)`);
  t.eq(viewOk, N, 'every picture turns the solid as the level says');
  t.eq(noCube, N, 'no box is a cube (oriented marks on cubes belong to the Cube Match probe)');
  t.eq(shapeOk, N - nBand, 'above the band, foil level 0: exactly one proportion foil; level 1: none');
  t.ok(nBand >= 2000, `starter band items (${nBand})`);
  t.eq(bandKinds, nBand, 'starter band, easiest solids: boxes and triangular prisms only');
  t.eq(band2x2, nBand, 'starter band: a 2 × 2 of right or wrong size and right or wrong shaded face (one mark foil with the shade on a face of another shape; one stretched solid twice)');
  t.eq(bandOff, nBand, 'starter band: a wrong size is one length off by 40–60 % (foil level 0) or 25–39 % (foil level 1)');
  t.eq(seen3, N, 'every picture shows at least two faces clearly (three where the solid allows it)');
  t.ok(ranks.every((r) => r / N > 0.22 && r / N < 0.28), `the key's place is spread (${ranks.map((r) => (r / N * 100).toFixed(0) + '%').join(' ')})`);
  t.ok(kinds.mirror > 0, `mirror foils occur ${JSON.stringify(kinds)}`);
  console.log(`       form solids ${JSON.stringify(solids)}, foil kinds ${JSON.stringify(kinds)}`);
}

/* ------------------------------------------------------------------ shortcut solvers */

const shareOf = (scores, key, high) => {
  const best = high ? Math.max(...scores) : Math.min(...scores);
  return scores[key] === best ? 1 / scores.filter((x) => x === best).length : 0;
};

// Face-shape solvers (no folding; review RV-dat-style-B §1): a seen face's shape decides its mark. "Rough"
// compares shapes with slack: same corner count, longest side within 25 %, every side (as a share of the
// longest) within 0.2.
const sides = (k) => k.split(':')[1].split('/')[0].split(',').map(Number);
const corners = (k) => k.split(':')[0];
function alike(a, b) {
  if (corners(a) !== corners(b)) return false;
  const x = sides(a), y = sides(b), mx = Math.max(...x), my = Math.max(...y);
  if (Math.abs(mx - my) > 0.25 * Math.max(mx, my)) return false;
  return x.every((v, k) => Math.abs(v / mx - y[k] / my) <= 0.2);
}
const mtype = (m) => (!m ? 0 : typeof m === 'object' ? 2 : 1);
function shapeSolvers(L, it) {
  const net = it.net.map((n) => ({ k: shapeOfPts(n.poly.map(([x, y]) => [x, y, 0])), m: mtype(it.marks[n.face]) }));
  const O = it.options.map((o) => {
    const c = L.facing(o.solid, o.view), faces = o.solid.faces.map((G, g) => ({ c: c[g], k: shapeOf(o.solid, g), m: mtype(o.marks[g]) }));
    return { clear: faces.filter((f) => f.c >= L.SEEN), drawn: faces.filter((f) => f.c > 0) };
  });
  const out = {};
  for (const [name, same] of [['exact', (a, b) => a === b], ['rough', alike]]) {
    // face by face: a clearly seen face whose shape the pattern shows only marked (or only plain) must agree
    const contra = O.map((o) => o.clear.filter((x) => { const s = net.filter((y) => same(y.k, x.k)); if (!s.length) return name === 'exact'; const ty = new Set(s.map((y) => y.m)); return ty.size === 1 && !ty.has(x.m); }).length);
    out[`face by face, shape decides the mark (${name})`] = contra;
    // every drawn mark sits on a face shaped like a pattern face with that mark
    out[`marks on faces shaped like the pattern's marked faces (${name})`] = O.map((o) => (o.drawn.filter((x) => x.m).every((x) => net.some((y) => y.m === x.m && same(y.k, x.k))) ? 0 : 1));
  }
  out['every drawn face shaped like a pattern face'] = O.map((o) => (o.drawn.every((x) => net.some((y) => y.k === x.k)) ? 0 : 1));
  return out;
}

// Two pools: the starter band's own (every band item) and the levels above it. On the band, face shape
// decides the one mark foil by design (PLAN Defaults: face-shape matching is Form's format method there),
// so the face-shape solvers are reported on the band and bounded above it.
function testShortcuts(t, PX, def, L, pool) {
  t.section('form: shortcut solvers, starter band');
  shortcutPool(t, L, pool.filter((x) => x.p.marks === 0), true);
  t.section('form: shortcut solvers, levels above the band');
  shortcutPool(t, L, pool.filter((x) => x.p.marks > 0), false);
}
function shortcutPool(t, L, pool, band) {
  const acc = {}, cnt = {}, req = {}, byFoil = {};
  const add = (name, v, required, p) => {
    acc[name] = (acc[name] || 0) + v; cnt[name] = (cnt[name] || 0) + 1; req[name] = required;
    if (p) { const k = name + ' @ foil ' + p.foil; byFoil[k] = byFoil[k] || [0, 0, name]; byFoil[k][0] += v; byFoil[k][1]++; }
  };
  t.ok(pool.length >= 2000, `${pool.length} items`);
  for (const { it, p } of pool) {
    for (const [name, scores] of Object.entries(shapeSolvers(L, it))) add(band ? name + ' (the band\'s method, reported)' : name, shareOf(scores, it.key, false), !band, band ? null : p);
    if (band) { // the band's own cheap counts: the shaded face's shape most common, the shape most common
      const sk = it.options.map((o) => shapeOf(o.solid, o.marks.indexOf(1))), c1 = {}, c2 = {};
      sk.forEach((k) => { c1[k] = (c1[k] || 0) + 1; });
      it.options.forEach((o) => { const k = o.solid.dims.join(); c2[k] = (c2[k] || 0) + 1; });
      add('the most common shaded-face shape', shareOf(sk.map((k) => c1[k]), it.key, true), true);
      add('the least common shaded-face shape', shareOf(sk.map((k) => c1[k]), it.key, false), true);
      add('the most common solid size', shareOf(it.options.map((o) => c2[o.solid.dims.join()]), it.key, true), true);
    }
    const F = it.options.map((o) => L.feats(o)), key = it.key;
    add('most marks seen', shareOf(F.map((x) => x.marked), key, true), true);
    add('fewest marks seen', shareOf(F.map((x) => x.marked), key, false), true);
    add('most faces seen', shareOf(F.map((x) => x.seen), key, true), true);
    add('fewest faces seen', shareOf(F.map((x) => x.seen), key, false), true);
    const d = (a, b) => Math.abs(a.marked - b.marked) + Math.abs(a.seen - b.seen) + Math.abs(a.halves - b.halves) + (a.shape !== b.shape ? 2 : 0);
    const sum = F.map((a) => F.reduce((s, b) => s + d(a, b), 0));
    add('like the others', shareOf(sum, key, false), true);
    add('odd one out', shareOf(sum, key, true), true);
    const netAdj = L.netTouch(it.net, it.marks);
    add('marks touch only as in the net', shareOf(it.options.map((o) => L.touchRule(o, netAdj)), key, true), true);
    const nm = it.marks.filter((x) => x).length;
    add('as many marks seen as the pattern has', shareOf(F.map((x) => (x.marked === nm ? 1 : 0)), key, true), true);
    add('a half mark seen', shareOf(F.map((x) => x.halves), key, true), true);
    // Partial strategy (reported): proportions only (rule out the wrong shape, then guess).
    add('proportions only', shareOf(it.options.map((o) => (o.solid.dims.join() === it.solid.dims.join() ? 1 : 0)), key, true), false);
  }
  const line = [];
  for (const name of Object.keys(acc)) {
    const a = acc[name] / cnt[name];
    line.push(`${name} ${(a * 100).toFixed(1)}%`);
    if (req[name]) t.ok(a <= LIMIT, `shortcut "${name}" ${(a * 100).toFixed(1)} % ≤ chance + 10`);
  }
  console.log(`       form shortcuts${band ? ' (starter band)' : ''}: ` + line.join(', '));
  // The face-shape solvers also per foil level (the proportion foil is the only foil they can rule out).
  const over = Object.entries(byFoil).filter(([, v]) => v[0] / v[1] > LIMIT).map(([k, v]) => `${k} ${(v[0] / v[1] * 100).toFixed(1)}%`);
  t.ok(!over.length, 'face-shape solvers stay within chance + 10 at each foil level' + (over.length ? ': ' + over.join('; ') : ''));
}

/* ------------------------------------------------------------------ tampering, fallback, timing */

function testTampering(t, PX, def, L, pool) {
  t.section('form: validate rejects broken items');
  const pick = () => pool.filter((_, i) => i % 61 === 0).slice(0, 40).map((x) => JSON.parse(JSON.stringify(x.it)));
  const cases = [
    ['the key index moved', (it) => { it.key = (it.key + 1) % 4; }],
    ['a foil replaced by the key', (it) => { const j = (it.key + 1) % 4; it.options[j] = JSON.parse(JSON.stringify(it.options[it.key])); }],
    ['a net piece shifted', (it) => { const n = it.net[it.net.length - 1]; n.poly = n.poly.map(([x, y]) => [x, y + 0.4]); }],
    ['the solid made a cube', (it) => { it.solid.kind = 'box'; it.solid.dims = [2, 2, 2]; }],
    ['a plain face the key shows clearly made shaded', (it) => { const o = it.options[it.key], c = L.facing(o.solid, o.view), f = o.marks.findIndex((x, g) => !x && c[g] >= L.SEEN); if (f >= 0) o.marks[f] = 1; else it.key = (it.key + 1) % 4; }],
    ['the key\'s half marks turned where they show', (it) => { const o = it.options[it.key], c = L.facing(o.solid, o.view); o.marks = o.marks.map((x, f) => (typeof x === 'object' && c[f] >= L.SEEN ? { h: (x.h + 1) % 4 } : x)); if (!o.marks.some((x, f) => typeof x === 'object' && c[f] >= L.SEEN)) it.key = (it.key + 1) % 4; }],
    ['a fold line drawn where no piece hangs', (it) => { const n = it.net.find((q) => q.parent >= 0); n.parent = it.net.find((q) => q.face !== n.face && q.face !== n.parent).face; }],
  ];
  for (const [name, mod] of cases) {
    const items = pick();
    let rejected = 0;
    items.forEach((it) => { mod(it); if (def.validate(it) !== true) rejected++; });
    t.eq(rejected, items.length, `validate rejects: ${name} (${items.length} items)`);
  }
}

function testFallback(t, PX, def, L) {
  t.section('form: fallback');
  let ok = 0;
  const combos = PX.ex.enumerate(def);
  for (const p of combos) {
    let it = null;
    try { it = L.fallback(L.cleanParams(p)); } catch (e) { it = null; }
    if (it && def.validate(it) === true) ok++;
  }
  t.eq(ok, combos.length, 'the fallback construction gives a valid item at every level');
}

const cpuMs = typeof process.threadCpuUsage === 'function'
  ? () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; }
  : () => performance.now();
function testTiming(t, PX, def) {
  t.section('form: timing');
  for (const hard of [{ solid: 2, marks: 3, view: 2, foil: 1 }, { solid: 1, marks: 1, view: 2, foil: 1 }, { solid: 2, marks: 0, view: 2, foil: 1 }]) {
    let best = Infinity; const text = [];
    for (let r = 0; r < 3 && best >= 20; r++) {
      const cpu = [], wall = [];
      for (let s = 0; s < 200; s++) {
        const c0 = cpuMs(), w0 = performance.now();
        def.generate(PX.rng(PX.rng.hash('form-timing', r, s)), hard);
        cpu.push(cpuMs() - c0); wall.push(performance.now() - w0);
      }
      cpu.sort((a, b) => a - b); wall.sort((a, b) => a - b);
      best = Math.min(best, cpu[190]);
      text.push(`${cpu[190].toFixed(1)} (wall ${wall[190].toFixed(1)})`);
    }
    t.ok(best < 20, `generation p95 at ${JSON.stringify(hard)}: ${best.toFixed(1)} ms CPU < 20 ms (rounds: ${text.join(', ')})`);
  }
}

/* ------------------------------------------------------------------ learn data */

const ADA = 'DAT® and Dental Admission Test are marks of the American Dental Association. Parallax is not affiliated with or endorsed by the ADA. Every item is generated by the app; none is taken from the DAT.';

function testLearn(t, PX, def) {
  t.section('form: learn');
  const L = PX.ex.learn('form');
  t.ok(L && typeof L === 'object', 'learn data is registered');
  if (!L) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, 'a one-line goal');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  // the teaching template (CONTRACT-v1.2 D; note D2 §3.0 C, §3.5, §3.9 item 1)
  t.ok(Array.isArray(L.rules) && L.rules.length >= 2 && L.rules.length <= 4 && L.rules.every((r) => typeof r === 'string' && r.length > 20 && r.length <= 140), 'a rules card of 2–4 short rules');
  t.ok((L.strategies || []).some((x) => x.id === L.strategyFirst) && L.strategies.find((x) => x.id === L.strategyFirst).steps.length === 3, `the strategy card before Try 1 exists, with three steps (${L.strategyFirst})`);
  t.eq(L.minutes, 3, 'the offer card says about three minutes (the worked example included)');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length === 1 && valid(L.demo[0].params) && Number.isInteger(L.demo[0].seed), 'one demo item with valid params');
  const demoItem = def.generate(PX.rng(L.demo[0].seed), L.demo[0].params);
  t.ok(def.validate(demoItem) === true && !demoItem.fallback && demoItem.solid.kind === 'box', `demo seed ${L.demo[0].seed} gives a valid box`);
  t.ok(PX.ex.difficulty(def, L.demo[0].params) === PX.ex.minDifficulty(def), 'the Watch is at the starter band (the easiest level)');
  t.ok(Array.isArray(L.practice) && L.practice.length === 4 && L.practice.every((e) => e && valid(e.params) && Number.isInteger(e.seed)), 'four Try items, each { params, seed }');
  if (!Array.isArray(L.practice) || L.practice.length !== 4) return;
  const P = L.practice.map((e) => e.params), items = L.practice.map((e) => def.generate(PX.rng(e.seed), e.params));
  // a worked example before the Try item that brings the first hard feature (note D2 addendum C change 4)
  // the right solid shows its half mark clearly (the face turned at least 0.5 toward the viewer)
  const halfSeen = (it) => { const k = it.options[it.key], g = k.marks.findIndex((m) => m && typeof m === 'object'); return g >= 0 && def.lib.facing(k.solid, k.view)[g] >= 0.5; };
  const exE = L.practice[2].example, xe = exE && def.generate(PX.rng(exE.seed), L.practice[2].params);
  t.ok(!!xe && Number.isInteger(exE.seed) && exE.seed !== L.practice[2].seed && def.validate(xe) === true && !xe.fallback && xe.marks.some((m) => m && typeof m === 'object') && xe.options.some((o) => o.kind === 'mirror') && xe.key !== items[2].key && halfSeen(xe) && L.practice.every((e, i) => i === 2 || e.example === undefined),
    `Try 3 (the half mark) comes after a worked example of a half mark on a sister item, with a mirror image among its solids and the half mark clearly seen on the right one (seed ${exE && exE.seed})`);
  t.ok(items.every((it) => def.validate(it) === true && !it.fallback), 'every Try item is valid and no fallback');
  t.ok(P[0].marks === 0 && P[1].marks === 0 && items[0].solid.kind === 'box' && items[1].solid.kind !== 'box', 'Try 1 (a box) and Try 2 (a prism) are at the starter band');
  t.eq(P[2], { solid: 0, marks: 1, view: 0, foil: 0, task: 'tutorial' }, 'Try 3 is the pre-1.2 floor (a half mark)');
  t.ok(P[3].marks === 2, 'Try 4: a third mark');
  t.eq(L.practice[0].assist, { letters: true }, 'Try 1 has its second step done (the shaded face\'s neighbours lettered)');
  t.ok(L.practice[2].assist && L.practice[2].assist.half && L.practice[2].tip === 'half', 'Try 3 brings the half mark with its tip and its corner dotted');
  t.ok(items[2].options.some((o) => o.kind === 'mirror'), 'Try 3 has a mirror-image foil (its first appearance, with the tip)');
  const tipIds = new Set((L.tips || []).map((x) => x.id));
  t.ok(L.practice.every((e) => e.tip === undefined || tipIds.has(e.tip)), 'forced tips exist');
  t.eq(new Set(items.map((it) => it.key)).size, 4, `the Try answers sit in four different places (${items.map((it) => it.key + 1).join(', ')})`);
  // every kind of wrong solid in Try appears in the Watch item, except the mirror image, which the band
  // cannot have (one shade has no handedness): Try 3 brings it with its tip and its dotted corner
  const kindsOf = (it) => new Set(it.options.filter((o, i) => i !== it.key).map((o) => o.kind));
  const dk = kindsOf(demoItem), tk = new Set(items.flatMap((it) => [...kindsOf(it)]));
  t.ok([...tk].every((k) => dk.has(k) || k === 'mirror'), `every foil kind in Try (${[...tk].join(', ')}) is in the Watch item (${[...dk].join(', ')}), the mirror image apart`);
  t.ok(items.every((it, i) => !kindsOf(it).has('mirror') || i >= 2), 'mirror images appear only from Try 3 on');
  const ds = P.map((p) => PX.ex.difficulty(def, p));
  t.ok(ds.every((x, i) => i === 0 || x >= ds[i - 1] - 1e-9), `practice goes from easy to harder (${ds.map((x) => x.toFixed(2)).join(', ')})`);
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    t.ok(tip.id && tip.text && tr.dim && def.dims.some((d) => d.key === tr.dim && (tr.levels || []).every((l) => l >= 0 && l < d.levels.length)), `tip ${tip.id} has a valid trigger`);
  }
  t.ok((L.tips || []).length >= 3, 'just-in-time tips');
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['sizes', 'landmark', 'landmarkAlone', 'match', 'matchAlone', 'halfCorner', 'matchHalf', 'whyShape', 'whyShapeAny', 'whyMarks', 'whyMirror', 'assist', 'assistHalf'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  const all = JSON.stringify(L);
  t.ok(all.includes(ADA), 'the ADA line sits wherever the DAT is named');
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered|boost|raise your|score gain|predict/i.test(all), 'no IQ, "mastered", score-gain or prediction claims');
  t.ok(typeof L.bridge === 'string' && /has not measured/i.test(L.bridge), 'a "where it is used" line with its limitation beside it');
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
