/* PAT-1 Openings: profiles, exact silhouettes against ray casting, the surface (closed, every
   edge between two different faces), generator, validator, scorer, shortcut solvers, timing,
   learn data. Run through tests/node/run.mjs (filter: openings). */
import { performance } from 'node:perf_hooks';
import { MANIFEST } from './run.mjs';

const FILES = [...MANIFEST, 'js/ex/openings/gen.js', 'js/ex/openings/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // 105 per combination
const CHANCE = 0.2, LIMIT = CHANCE + 0.10;

export async function run(t) {
  const PX = t.context({ files: FILES }).PX, def = PX.ex.get('openings');
  t.section('openings: definition');
  t.ok(def, 'openings is defined');
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
const pRight = (theta, b, g = CHANCE) => g + (1 - g - 0.03) * sig(theta - b);
const pk = (p) => `${p.features}${p.edges}${p.keyview}${p.pose}${p.foils}`;

function testDefinition(t, PX, def) {
  t.eq([def.id, def.version, def.code, def.abilities, def.role, def.answer, def.nOptions, def.pat],
    ['openings', 1, 'PAT-1', ['Vz'], 'train', 'choice', 5, true], 'definition fields (a PAT-format exercise, five options)');
  t.eq(def.dims.map((d) => [d.key, d.levels.length]), [['features', 4], ['edges', 2], ['keyview', 3], ['pose', 2], ['foils', 2]], 'dims');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4 - 1e-9, `difficulty spans at least 4 logits (${(hi - lo).toFixed(2)})`);
  t.ok(pRight(0, lo) >= 0.88 && pRight(0, lo) <= 0.93, `a beginner gets the easiest items about 90 % right (${pRight(0, lo).toFixed(3)})`);
}

/* ------------------------------------------------------------------ the model */

function testModel(t, PX, L) {
  t.section('openings: model');
  const r = PX.rng(99);
  let n = 0, silOk = 0, closed = 0, faceOk = 0, edgeOk = 0, tfOk = 0, multi = 0, first = '';
  for (let k = 0; k < 400; k++) {
    const dims = r.shuffle([6, 7, 8, 9, 10]).slice(0, 3), [W, H, D] = dims, feats = { F: [], T: [], S: [] }, dm = { F: [W, H], T: [W, D], S: [D, H] };
    for (let f = 0; f < 1 + (k % 5); f++) {
      const nm = ['F', 'T', 'S'][Math.floor(r.next() * 3)], nf = L.randomFeature(r, dm[nm][0], dm[nm][1], k % 2 === 1);
      if (nf && L.profile(dm[nm][0], dm[nm][1], feats[nm].concat([nf]))) feats[nm].push(nf);
    }
    const P = L.buildProfiles(W, H, D, feats), polys = P && L.polysOf(P);
    if (!polys) continue;
    n++;
    // Exact quarter silhouettes against ray casting through the polygons (any interaction).
    const S = L.sils(P);
    let ok = true;
    for (const a of L.AXES) {
      const loops = L.outline(L.crop(S[a]));
      if (!loops || loops.length !== 1) { multi++; continue; } // a silhouette in two pieces: compared below by area only
      const byRay = L.raySil(polys, W, H, D, a);
      if (L.rcompare(loops[0], byRay) !== 'match') { ok = false; first = first || `${a} ${JSON.stringify(polys)}`; }
    }
    if (ok) silOk++;
    // The surface is closed (every lattice piece of an edge borders an even number of faces), and
    // its area-weighted normals sum to zero.
    const faces = L.surface(P.F, P.T, P.S), E = L.edges(faces);
    if (E.open === 0) closed++;
    let nx = 0, ny = 0, nz = 0;
    faces.forEach((f) => { let ax = 0, ay = 0, az = 0; const q = f.pts; for (let i = 0; i < q.length; i++) { const u = q[i], v = q[(i + 1) % q.length]; ax += (u[1] - v[1]) * (u[2] + v[2]); ay += (u[2] - v[2]) * (u[0] + v[0]); az += (u[0] - v[0]) * (u[1] + v[1]); } nx += ax; ny += ay; nz += az; });
    if (Math.abs(nx) + Math.abs(ny) + Math.abs(nz) < 1e-6) faceOk++;
    // Every face point is on the solid's surface: just inside along -n is in, just outside is out.
    let good = true;
    for (const f of faces.slice(0, 40)) {
      const c = f.pts.reduce((s, p) => [s[0] + p[0] / f.pts.length, s[1] + p[1] / f.pts.length, s[2] + p[2] / f.pts.length], [0, 0, 0]);
      const inP = L.inSolid(polys, c[0] - 0.01 * f.n[0], c[1] - 0.01 * f.n[1], c[2] - 0.01 * f.n[2]);
      const outP = L.inSolid(polys, c[0] + 0.01 * f.n[0], c[1] + 0.01 * f.n[1], c[2] + 0.01 * f.n[2]);
      if (!inP || outP) good = false;
    }
    if (good) edgeOk++;
    // Turns and flips agree between grids and polygons.
    const g = P.F, poly = polys.F, kk = k % 8, a2 = L.polyRaster(L.outline(L.tfGrid(g, kk))[0]);
    if (L.rcompare(L.tfPoly(poly, kk, g.A, g.B), a2) === 'match' && L.rcompare(poly, L.polyRaster(poly, kk)) === 'match') tfOk++;
  }
  t.ok(n >= 300, `random solids built (${n}; ${multi} silhouettes in two pieces skipped)`);
  t.eq(silOk, n, 'exact quarter silhouettes equal the ray-cast ones along all three axes' + (first ? ' first: ' + first : ''));
  t.eq(closed, n, 'every surface is closed');
  t.eq(faceOk, n, 'face normals sum to zero (a closed surface)');
  t.eq(edgeOk, n, 'face normals point outward (inside just behind, outside just in front)');
  t.eq(tfOk, n, 'turns and flips of grids and polygons agree');
}

/* ------------------------------------------------------------------ the pool */

function testPool(t, PX, def, L) {
  t.section('openings: pool');
  const combos = PX.ex.enumerate(def);
  t.eq(combos.length, 96, '96 combinations (4 × 2 × 3 × 2 × 2)');
  const per = Math.ceil(N_ITEMS / combos.length), items = [];
  let threw = 0, invalid = 0, keyWrong = 0, foilRight = 0, malformed = 0, json = 0, first = null;
  const before = { ...L.stats };
  for (const p of combos) {
    for (let s = 0; s < per; s++) {
      const seed = PX.rng.hash('openings-test', pk(p), s);
      let it;
      try { it = def.generate(PX.rng(seed), p); } catch (e) { threw++; first = first || `${pk(p)}#${s} threw ${e.message}`; continue; }
      const v = def.validate(it);
      if (v !== true) { invalid++; first = first || `${pk(p)}#${s}: ${v}`; }
      if (!def.score(it, it.key).correct) keyWrong++;
      for (let i = 0; i < 5; i++) if (i !== it.key && def.score(it, i).correct) foilRight++;
      for (const bad of [null, undefined, -1, 5, '0', 1.5]) if (def.score(it, bad).correct) malformed++;
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
  console.log(`       openings attempts per item ${((L.stats.tries - before.tries) / n).toFixed(2)}, hidden features ${L.stats.unseen - before.unseen}, interactions ${L.stats.interact - before.interact}`);
  let same = 0, checked = 0;
  for (let i = 0; i < items.length; i += 10) {
    checked++;
    if (JSON.stringify(def.generate(PX.rng(items[i].seed), items[i].p)) === JSON.stringify(items[i].it)) same++;
  }
  t.eq(same, checked, `the same seed gives the same item (${checked} seeds regenerated)`);
  const distinct = new Set(items.map((x) => JSON.stringify(x.it.prof)));
  t.ok(distinct.size > 0.6 * n, `solids are varied (${distinct.size} distinct of ${n})`);
  return items;
}

function testItems(t, PX, def, L, pool) {
  t.section('openings: items');
  const ranks = [0, 0, 0, 0, 0], tfs = Array(8).fill(0), keyTf = Array(8).fill(0), axes = {}, kinds = {};
  let lvlOk = 0, propOk = 0, nProp = 0, axisOk = 0, featOk = 0, chamOk = 0, nCham = 0;
  for (const { p, it } of pool) {
    ranks[it.key]++;
    axes[it.keyAxis] = (axes[it.keyAxis] || 0) + 1;
    it.options.forEach((o, i) => { tfs[o.tf]++; if (i === it.key) keyTf[o.tf]++; else kinds[o.kind] = (kinds[o.kind] || 0) + 1; });
    const want = L.axisFacing(L.POSES[it.pose], [2, 0, 1][p.keyview]);
    if (it.keyAxis === want && L.POSE_SETS[p.pose].includes(it.pose)) axisOk++;
    const nf = it.feats.F.length + it.feats.T.length + it.feats.S.length;
    if (nf === p.features + 1 && it.feats[L.PROF_OF[it.keyAxis]].length >= 1) featOk++;
    if (p.edges === 1) { nCham++; if (['F', 'T', 'S'].some((n) => it.feats[n].includes('cham'))) chamOk++; }
    const np = it.options.filter((o) => o.kind === 'proportion').length;
    if (p.foils === 1) { nProp++; if (np === 1) propOk++; } else if (np === 0) lvlOk++;
  }
  const N = pool.length;
  t.eq(axisOk, N, 'the key is the outline along the axis the level asks for, in a pose of the level');
  t.eq(featOk, N, 'the solid has the level\'s number of features, at least one on the key\'s profile');
  t.eq(chamOk, nCham, 'chamfer levels have a chamfer');
  t.eq(propOk, nProp, 'foil level 1: exactly one proportion foil');
  t.eq(lvlOk, N - nProp, 'foil level 0: no proportion foil');
  t.ok(ranks.every((r) => r / N > 0.17 && r / N < 0.23), `the key's place is spread (${ranks.map((r) => (r / N * 100).toFixed(0) + '%').join(' ')})`);
  t.ok(keyTf.every((x) => x / N > 0.09 && x / N < 0.16), `the key is shown under every turn and flip (${keyTf.map((x) => (x / N * 100).toFixed(0) + '%').join(' ')})`);
  t.ok(['x', 'y', 'z'].every((a) => axes[a] / N > 0.2), `keys along every axis ${JSON.stringify(axes)}`);
  console.log(`       openings foil kinds ${JSON.stringify(kinds)}`);
}

/* ------------------------------------------------------------------ shortcut solvers */

const shareOf = (scores, key, high) => {
  const best = high ? Math.max(...scores) : Math.min(...scores);
  return scores[key] === best ? 1 / scores.filter((x) => x === best).length : 0;
};

function testShortcuts(t, PX, def, L, pool) {
  t.section('openings: shortcut solvers');
  const acc = {}, cnt = {}, req = {};
  const add = (name, v, required) => { acc[name] = (acc[name] || 0) + v; cnt[name] = (cnt[name] || 0) + 1; req[name] = required; };
  for (const { it } of pool.filter((_, i) => i % 3 === 0)) {
    const R = it.options.map((o) => L.polyRaster(o.poly)), key = it.key;
    const area = R.map((x) => x.r.reduce((s, v) => s + v, 0)), corners = it.options.map((o) => o.poly.length);
    const dims = it.options.map((o) => [o.w, o.h]);
    const O = it.options.map((o) => [0, 1, 2, 3, 4, 5, 6, 7].map((k) => L.polyRaster(o.poly, k)));
    const D = R.map((a, i) => R.map((b) => {
      let best = Infinity;
      for (let k = 0; k < 8; k++) { const q = O[i][k]; if (q.w !== b.w || q.h !== b.h) continue; let d = 0; for (let n = 0; n < q.r.length; n++) if (q.r[n] !== b.r[n]) d++; best = Math.min(best, d); }
      return best === Infinity ? a.r.length + b.r.length : best;
    }));
    const sum = D.map((row, i) => row.reduce((s, v, j) => s + (i === j ? 0 : v), 0));
    add('largest area', shareOf(area, key, true), true);
    add('smallest area', shareOf(area, key, false), true);
    add('most corners', shareOf(corners, key, true), true);
    add('fewest corners', shareOf(corners, key, false), true);
    add('like the others', shareOf(sum, key, false), true);
    add('odd one out', shareOf(sum, key, true), true);
    const pairs = [[it.W, it.H], [it.W, it.D], [it.D, it.H]];
    add('box fits the solid', shareOf(dims.map(([w, h]) => (pairs.some(([a, b]) => (a === w && b === h) || (a === h && b === w)) ? 1 : 0)), key, true), true);
    add('squarest box', shareOf(dims.map(([w, h]) => -Math.abs(w - h)), key, true), true);
    // Partial strategies (reported, not limited): checking only the outline on the picture's front
    // face, or only the profile with the most features.
    const front = L.axisFacing(L.POSES[it.pose], 2), pr = L.polyRaster(it.prof[L.PROF_OF[front]]);
    add('checks the front face only', shareOf(it.options.map((o) => (L.rcompare(o.poly, pr) === 'match' ? 1 : 0)), key, true), false);
    const most = ['F', 'T', 'S'].sort((a, b) => it.feats[b].length - it.feats[a].length)[0], pm = L.polyRaster(it.prof[most]);
    add('checks the most featured profile only', shareOf(it.options.map((o) => (L.rcompare(o.poly, pm) === 'match' ? 1 : 0)), key, true), false);
  }
  const line = [];
  for (const name of Object.keys(acc)) {
    const a = acc[name] / cnt[name];
    line.push(`${name} ${(a * 100).toFixed(1)}%`);
    if (req[name]) t.ok(a <= LIMIT, `shortcut "${name}" ${(a * 100).toFixed(1)} % ≤ chance + 10`);
  }
  console.log('       openings shortcuts: ' + line.join(', '));
}

/* ------------------------------------------------------------------ tampering, fallback, timing */

function testTampering(t, PX, def, L, pool) {
  t.section('openings: validate rejects broken items');
  const pick = () => pool.filter((_, i) => i % 53 === 0).slice(0, 30).map((x) => JSON.parse(JSON.stringify(x.it)));
  const cases = [
    ['the key index moved', (it) => { it.key = (it.key + 1) % 5; }],
    ['a foil replaced by the key', (it) => { const j = (it.key + 1) % 5; it.options[j] = JSON.parse(JSON.stringify(it.options[it.key])); }],
    ['a foil replaced by a turned key', (it) => { const j = (it.key + 2) % 5, o = it.options[it.key]; it.options[j] = { kind: 'feature', tf: 0, w: o.h, h: o.w, poly: L.tfPoly(o.poly, 1, o.w, o.h) }; }],
    ['the key stretched by a step', (it) => { const o = it.options[it.key]; o.poly = o.poly.map(([x, y]) => [x > o.w / 2 ? x + 1 : x, y]); }],
    ['a profile changed', (it) => { const p = it.prof[L.PROF_OF[it.keyAxis]]; it.prof[L.PROF_OF[it.keyAxis]] = p.map(([x, y]) => [x, y]).reverse(); it.W = it.W === 6 ? 7 : it.W - 1 === it.H || it.W - 1 === it.D ? it.W : it.W - 1; }],
  ];
  for (const [name, mod] of cases) {
    const items = pick();
    let rejected = 0;
    items.forEach((it) => { mod(it); if (def.validate(it) !== true) rejected++; });
    t.eq(rejected, items.length, `validate rejects: ${name} (${items.length} items)`);
  }
}

function testFallback(t, PX, def, L) {
  t.section('openings: fallback');
  let ok = 0;
  const combos = PX.ex.enumerate(def).filter((_, i) => i % 4 === 0);
  for (const p of combos) {
    let it = null;
    try { it = L.fallback(L.cleanParams(p)); } catch (e) { it = null; }
    if (it && def.validate(it) === true) ok++;
  }
  t.eq(ok, combos.length, `the fallback construction gives a valid item (${combos.length} levels sampled)`);
}

const cpuMs = typeof process.threadCpuUsage === 'function'
  ? () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; }
  : () => performance.now();
function testTiming(t, PX, def) {
  t.section('openings: timing');
  for (const hard of [{ features: 3, edges: 1, keyview: 2, pose: 1, foils: 1 }, { features: 3, edges: 1, keyview: 0, pose: 0, foils: 0 }]) {
    let best = Infinity; const text = [];
    for (let r = 0; r < 3 && best >= 20; r++) {
      const cpu = [], wall = [];
      for (let s = 0; s < 200; s++) {
        const c0 = cpuMs(), w0 = performance.now();
        def.generate(PX.rng(PX.rng.hash('openings-timing', r, s)), hard);
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
  t.section('openings: learn');
  const L = PX.ex.learn('openings');
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
  const caps = ['solid', 'openings', 'rules', 'turn', 'outline', 'land', 'whyFeature', 'whyProportion'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  const all = JSON.stringify(L);
  t.ok(all.includes(ADA), 'the ADA line sits wherever the DAT is named');
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered|boost|raise your|score gain|predict/i.test(all), 'no IQ, "mastered", score-gain or prediction claims');
  t.ok(typeof L.bridge === 'string' && /has not measured/i.test(L.bridge), 'a "where it is used" line with its limitation beside it');
}
