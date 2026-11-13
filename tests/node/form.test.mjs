/* EX-19 Form (DAT-style format): solids, nets that fold back (closure), symmetry groups, generator, validator, scorer,
   shortcut solvers, timing, learn data. Run through tests/node/run.mjs (filter: form). */
import { performance } from 'node:perf_hooks';
import { MANIFEST } from './run.mjs';

const FILES = [...MANIFEST, 'js/ex/form/gen.js', 'js/ex/form/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10044); // 186 per combination
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
    ['form', 1, 'EX-19', ['Vz'], 'train', 'choice', 4, true], 'definition fields (a PAT-format exercise)');
  t.eq(def.dims.map((d) => [d.key, d.levels.length]), [['solid', 3], ['marks', 3], ['view', 3], ['foil', 2]], 'dims');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4 - 1e-9, `difficulty spans at least 4 logits (${(hi - lo).toFixed(2)})`);
  t.ok(pRight(0, lo) >= 0.88 && pRight(0, lo) <= 0.93, `a beginner gets the easiest items about 90 % right (${pRight(0, lo).toFixed(3)})`);
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
  t.eq(combos.length, 54, '54 combinations (3 × 3 × 3 × 2)');
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
  for (const { p, it } of pool) {
    ranks[it.key]++;
    solids[it.solid.kind] = (solids[it.solid.kind] || 0) + 1;
    if (L.KINDS[p.solid].includes(it.solid.kind)) lvl++;
    const m = it.marks, ones = m.filter((x) => x === 1).length, halves = m.filter((x) => typeof x === 'object').length;
    if ((p.marks === 0 && ones === 1 && halves === 1) || (p.marks === 1 && ones === 2 && halves === 1) || (p.marks === 2 && ones === 1 && halves === 2)) marksOk++;
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
  t.eq(marksOk, N, 'marks as the level says (shaded + half; two shaded + half; shaded + two halves)');
  t.eq(congruentOk, nFoil, `mark foils move marks only to congruent faces; proportion foils keep the pattern's marks (${nFoil} foils)`);
  t.eq(viewOk, N, 'every picture turns the solid as the level says');
  t.eq(noCube, N, 'no box is a cube (oriented marks on cubes belong to the Cube Match probe)');
  t.eq(shapeOk, N, 'foil level 0: exactly one proportion foil; level 1: none');
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

function testShortcuts(t, PX, def, L, pool) {
  t.section('form: shortcut solvers');
  const acc = {}, cnt = {}, req = {}, byFoil = {};
  const add = (name, v, required, p) => {
    acc[name] = (acc[name] || 0) + v; cnt[name] = (cnt[name] || 0) + 1; req[name] = required;
    if (p) { const k = name + ' @ foil ' + p.foil; byFoil[k] = byFoil[k] || [0, 0, name]; byFoil[k][0] += v; byFoil[k][1]++; }
  };
  for (const { it, p } of pool) {
    for (const [name, scores] of Object.entries(shapeSolvers(L, it))) add(name, shareOf(scores, it.key, false), true, p);
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
  console.log('       form shortcuts: ' + line.join(', '));
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
  for (const hard of [{ solid: 2, marks: 2, view: 2, foil: 1 }, { solid: 1, marks: 0, view: 2, foil: 1 }]) {
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
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed)), 'demo items with valid params');
  for (const d of L.demo) { const item = def.generate(PX.rng(d.seed), d.params); t.ok(def.validate(item) === true && !item.fallback, `demo seed ${d.seed} gives a valid item`); }
  t.ok(PX.ex.difficulty(def, L.demo[0].params) === PX.ex.minDifficulty(def), 'the demo is at the easiest level');
  t.ok(Array.isArray(L.practice) && L.practice.length >= 3 && L.practice.length <= 5 && L.practice.every(valid), '3–5 practice params');
  const ds = L.practice.map((p) => PX.ex.difficulty(def, p));
  t.ok(ds.every((x, i) => i === 0 || x >= ds[i - 1]), `practice goes from easy to harder (${ds.map((x) => x.toFixed(2)).join(', ')})`);
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    t.ok(tip.id && tip.text && tr.dim && def.dims.some((d) => d.key === tr.dim && (tr.levels || []).every((l) => l >= 0 && l < d.levels.length)), `tip ${tip.id} has a valid trigger`);
  }
  t.ok((L.tips || []).length >= 3, 'just-in-time tips');
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['pattern', 'solids', 'landmark', 'match', 'land', 'whyShape', 'whyMarks', 'whyMirror'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  const all = JSON.stringify(L);
  t.ok(all.includes(ADA), 'the ADA line sits wherever the DAT is named');
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered|boost|raise your|score gain|predict/i.test(all), 'no IQ, "mastered", score-gain or prediction claims');
  t.ok(typeof L.bridge === 'string' && /has not measured/i.test(L.bridge), 'a "where it is used" line with its limitation beside it');
}
