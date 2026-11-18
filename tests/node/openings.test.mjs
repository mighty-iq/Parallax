/* EX-14 Openings (DAT-style format): profiles, exact silhouettes against ray casting, the surface (closed, every
   edge between two different faces), generator, validator, scorer, shortcut solvers, timing,
   learn data. Run through tests/node/run.mjs (filter: openings). */
import { performance } from 'node:perf_hooks';
import { MANIFEST } from './run.mjs';

const FILES = [...MANIFEST, 'js/ex/openings/gen.js', 'js/ex/openings/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // 84 per combination (120 with the starter band)
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
  testTutorialRepeat(t, PX, def, 'openings');
}

const sig = (x) => 1 / (1 + Math.exp(-x));
const pRight = (theta, b, g = CHANCE) => g + (1 - g - 0.03) * sig(theta - b);
const pk = (p) => `${p.features}${p.edges}${p.keyview}${p.pose}${p.foils}`;
const BAND_DELTA = -1.6, OLD_FLOOR = -2.3; // note D2 §3.4, §3.8: the starter level's offset; the pre-1.2 floor

function testDefinition(t, PX, def) {
  t.eq([def.id, def.version, def.code, def.abilities, def.role, def.answer, def.nOptions, def.pat],
    ['openings', 2, 'EX-14', ['Vz'], 'train', 'choice', 5, true], 'definition fields (a PAT-format exercise, five options; version 2: the starter band)');
  t.eq(def.dims.map((d) => [d.key, d.levels.length]), [['features', 5], ['edges', 2], ['keyview', 3], ['pose', 2], ['foils', 2]], 'dims');
  t.eq(def.starter, { dim: 'features', levels: 1 }, 'the starter band is the first level of features');
  t.eq(def.dims[0].at, [BAND_DELTA, 0, 0.6, 1.2, 1.8], 'features: the band offset in front, older levels at their 1.1 difficulty (step 0.6)');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(Math.abs(lo - (OLD_FLOOR + BAND_DELTA)) < 1e-9, `the floor moves to ${OLD_FLOOR + BAND_DELTA} (${lo.toFixed(2)})`);
  t.ok(hi - lo >= 4 - 1e-9, `difficulty spans at least 4 logits (${(hi - lo).toFixed(2)})`);
  const old0 = PX.ex.difficulty(def, { features: 1, edges: 0, keyview: 0, pose: 0, foils: 0 });
  t.ok(Math.abs(old0 - OLD_FLOOR) < 1e-9 && pRight(0, old0) >= 0.88 && pRight(0, old0) <= 0.93, `a beginner at θ = 0 gets the pre-1.2 floor about 90 % right (${pRight(0, old0).toFixed(3)}), the starter band ${pRight(0, lo).toFixed(3)}`);
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
  t.eq(combos.length, 120, '120 combinations (5 × 2 × 3 × 2 × 2)');
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
  let lvlOk = 0, propOk = 0, nProp = 0, axisOk = 0, featOk = 0, chamOk = 0, nCham = 0, sizeOk = 0, nOld = 0;
  let nBand = 0, bandOne = 0, bandSeen = 0, bandCorners = 0, bandSame = 0, bandRead = 0;
  const face = { 2: 0, 0: 0, 1: 0 }, keyMost = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
  const dimsOf = (it, n) => (n === 'F' ? [it.W, it.H] : n === 'T' ? [it.W, it.D] : [it.D, it.H]);
  for (const { p, it } of pool) {
    ranks[it.key]++;
    axes[it.keyAxis] = (axes[it.keyAxis] || 0) + 1;
    it.options.forEach((o, i) => { if (i !== it.key) kinds[o.kind] = (kinds[o.kind] || 0) + 1; });
    const wf = [2, 0, 1].find((w) => L.axisFacing(L.POSES[it.pose], w) === it.keyAxis); // the picture's face of the key
    face[wf]++;
    if (L.KEYVIEW_SETS[p.keyview].includes(wf) && L.POSE_SETS[p.pose].includes(it.pose)) axisOk++;
    const nf = ['F', 'T', 'S'].map((n) => it.feats[n].length);
    if (JSON.stringify(nf.slice().sort()) === JSON.stringify(L.FEATURES[p.features].slice().sort())) featOk++;
    if (it.options.every((o) => Math.max(o.w, o.h) <= L.MAXEXT)) sizeOk++;
    if (p.edges === 1) { nCham++; if (['F', 'T', 'S'].some((n) => it.feats[n].includes('cham'))) chamOk++; }
    const np = it.options.filter((o) => o.kind === 'proportion').length;
    if (p.foils === 1) { nProp++; if (np === 1) propOk++; } else if (np === 0) lvlOk++;
    if (p.features === 0) { // the starter band (note D2 §3.4)
      nBand++;
      const kp = L.PROF_OF[it.keyAxis], kf = it.feats[kp];
      if (kf.length === 1 && ['F', 'T', 'S'].every((n) => n === kp || it.feats[n].length === 0)) bandOne++;
      if (it.options.every((o) => o.tf === L.seenTf(it.pose, o.axis))) bandSeen++;
      const kc = it.options[it.key].poly.length;
      if (it.options.every((o) => o.kind === 'proportion' || o.poly.length === kc)) bandCorners++;
      if (it.options.filter((o) => o.kind === 'feature').length >= (kf[0] === 'cham' ? 1 : 2)) bandSame++;
      // every straight edge of the key's feature is at least two steps long (one unit): readable on a phone
      const runs = L.featureRuns(it.prof[kp], ...dimsOf(it, kp));
      if (runs.length === 1 && runs[0].every(([a, b]) => { const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]); return dx === dy || dx + dy >= 2; })) bandRead++;
      continue;
    }
    // the key's face is the most featured one (ties shared) about as often as any face: a third
    nOld++;
    it.options.forEach((o, i) => { tfs[o.tf]++; if (i === it.key) keyTf[o.tf]++; });
    const mx = Math.max(...nf), top = ['F', 'T', 'S'].filter((n, i) => nf[i] === mx);
    keyMost[p.features][0] += top.includes(L.PROF_OF[it.keyAxis]) ? 1 / top.length : 0; keyMost[p.features][1]++;
  }
  const N = pool.length;
  t.eq(axisOk, N, 'the key is the outline of a face the level allows, in a pose of the level');
  t.ok([2, 0, 1].every((w) => face[w] / N > 0.29 && face[w] / N < 0.38), `over all levels each face of the picture holds the key about a third of the time (front ${(face[2] / N * 100).toFixed(0)} %, side ${(face[0] / N * 100).toFixed(0)} %, top ${(face[1] / N * 100).toFixed(0)} %)`);
  t.eq(featOk, N, 'features in the level\'s counts (starter 1 in all, then 1+1+1, 2+1+1, 2+2+1, 2+2+2)');
  const km = keyMost.slice(1).map(([a, b]) => a / b);
  t.ok(km.every((x) => x < 0.42), `above the starter band the key's face is the most featured one (ties shared) near a third of the time, as any face (${km.map((x) => (x * 100).toFixed(1) + '%').join(' ')} by features level)`);
  t.eq(sizeOk, N, `no option is longer than ${L.MAXEXT} steps (11 px a step at the solid's scale on a 360 px phone)`);
  t.eq(chamOk, nCham, 'chamfer levels have a chamfer');
  t.eq(propOk, nProp, 'foil level 1: exactly one proportion foil');
  t.eq(lvlOk, N - nProp, 'foil level 0: no proportion foil');
  t.ok(ranks.every((r) => r / N > 0.17 && r / N < 0.23), `the key's place is spread (${ranks.map((r) => (r / N * 100).toFixed(0) + '%').join(' ')})`);
  t.ok(keyTf.every((x) => x / nOld > 0.09 && x / nOld < 0.16), `above the starter band the key is shown under every turn and flip (${keyTf.map((x) => (x / nOld * 100).toFixed(0) + '%').join(' ')})`);
  t.ok(['x', 'y', 'z'].every((a) => axes[a] / N > 0.2), `keys along every axis ${JSON.stringify(axes)}`);
  t.ok(nBand >= 2000, `starter band items (${nBand})`);
  t.eq(bandOne, nBand, 'starter band: one feature in all, on the key\'s face (the other two outlines plain)');
  t.eq(bandSeen, nBand, 'starter band: every opening drawn the way its face is seen straight on (the key needs no turn)');
  t.eq(bandCorners, nBand, 'starter band: every foil but a proportion foil has the key\'s corner count');
  t.eq(bandSame, nBand, 'starter band: at least two foils on the key\'s box (one for a chamfer)');
  t.eq(bandRead, nBand, 'starter band: every straight edge of the key\'s feature is at least a unit (two steps) long');
  console.log(`       openings foil kinds ${JSON.stringify(kinds)}`);
}

/* ------------------------------------------------------------------ shortcut solvers */

const shareOf = (scores, key, high) => {
  const best = high ? Math.max(...scores) : Math.min(...scores);
  return scores[key] === best ? 1 / scores.filter((x) => x === best).length : 0;
};

// Two pools, each about 2 000 items: the starter band's own (every band item) and the levels above it
// (every fourth item). On the band one face carries the only feature by construction, so "checks the
// most featured face only" is the method there (reported); above it, it stays bounded at 50 %.
function testShortcuts(t, PX, def, L, pool) {
  t.section('openings: shortcut solvers, starter band');
  shortcutPool(t, L, pool.filter((x) => x.p.features === 0), true);
  t.section('openings: shortcut solvers, levels above the band');
  shortcutPool(t, L, pool.filter((x) => x.p.features > 0).filter((_, i) => i % 4 === 0), false);
}
function shortcutPool(t, L, items, band) {
  const acc = {}, cnt = {}, req = {};
  const add = (name, v, required) => { acc[name] = (acc[name] || 0) + v; cnt[name] = (cnt[name] || 0) + 1; req[name] = required; };
  const mfBy = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
  t.ok(items.length >= 2000, `${items.length} items`);
  for (const { it, p } of items) {
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
    // Counting with the solid in view (review RV-dat-style-B §2): corners of each face outline, the most
    // featured faces (ties: each as likely), and the box as well (reported only: comparing corners and
    // then proportions is the format's analytic method, which the strategy card teaches).
    const outs = ['F', 'T', 'S'].map((n) => ({ n, c: it.prof[n].length, d: n === 'F' ? [it.W, it.H] : n === 'T' ? [it.W, it.D] : [it.D, it.H] }));
    const nfe = outs.map((q) => it.feats[q.n].length), mx = Math.max(...nfe), top = outs.filter((q, i) => nfe[i] === mx);
    add('corners = a face outline\'s', shareOf(corners.map((c) => (outs.some((q) => q.c === c) ? 1 : 0)), key, true), true);
    add('corners = the most featured face\'s', top.reduce((s, q) => s + shareOf(corners.map((c) => (c === q.c ? 1 : 0)), key, true), 0) / top.length, true);
    const boxIs = ([w, h], [a, b]) => (w === a && h === b) || (w === b && h === a);
    add('box and corners = a face outline\'s (reported)', shareOf(corners.map((c, i) => (outs.some((q) => q.c === c && boxIs(dims[i], q.d)) ? 1 : 0)), key, true), false);
    // The most alike pair, shape only (each option scaled to a unit box, best of 8 turns): pick one of the two.
    const N = 24, norm = it.options.map((o) => {
      const xs = o.poly.map((v) => v[0]), ys = o.poly.map((v) => v[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
      return [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
        const g = new Uint8Array(N * N);
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          let u = (i + 0.5) / N, v = (j + 0.5) / N;
          [u, v] = [[u, v], [1 - v, u], [1 - u, 1 - v], [v, 1 - u], [1 - u, v], [u, 1 - v], [v, u], [1 - v, 1 - u]][k];
          g[j * N + i] = L.pip(o.poly, x0 + u * w + 1e-4, y0 + v * h + 1e-4) ? 1 : 0;
        }
        return g;
      });
    });
    let bp = null, bd = Infinity;
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      let d = Infinity; for (let k = 0; k < 8; k++) { let x = 0; const A = norm[i][0], B = norm[j][k]; for (let n = 0; n < A.length; n++) if (A[n] !== B[n]) x++; d = Math.min(d, x); }
      if (d < bd) { bd = d; bp = [i, j]; }
    }
    add('one of the most alike pair (shape, size ignored)', bp.includes(key) ? 0.5 : 0, true);
    if (p.foils === 1) {
      add('one of the most alike pair, proportion level', bp.includes(key) ? 0.5 : 0, true);
      add('avoid the most alike pair, proportion level', bp.includes(key) ? 0 : 1 / 3, true);
    }
    // Partial strategies: checking only the outline on one face of the picture (reported: the keyview
    // dim spreads the key over the faces), or only the most featured profile (bounded at 50 %: it
    // cannot fall to chance while the key's outline carries features; a third of 1 + two thirds of a
    // fifth, 46.7 %, is the share when the key's face is as likely as any face to be the most featured).
    for (const [nm, w] of [['front', 2], ['side', 0], ['top', 1]]) {
      const ax = L.axisFacing(L.POSES[it.pose], w), pr = L.polyRaster(it.prof[L.PROF_OF[ax]]);
      add(`checks the ${nm} face only (reported)`, shareOf(it.options.map((o) => (L.rcompare(o.poly, pr) === 'match' ? 1 : 0)), key, true), false);
    }
    const mf = top.reduce((s, q) => { const pm = L.polyRaster(it.prof[q.n]); return s + shareOf(it.options.map((o) => (L.rcompare(o.poly, pm) === 'match' ? 1 : 0)), key, true); }, 0) / top.length;
    add(band ? 'checks the one featured face (the band\'s method, reported)' : 'checks the most featured face only', mf, band ? false : 'half');
    mfBy[p.features][0] += mf; mfBy[p.features][1]++;
    if (band) { // the openings are unturned on the band: the same solvers on the drawings as they stand
      const sum0 = R.map((a, i) => R.reduce((s, b, j) => { if (i === j) return s; if (a.w !== b.w || a.h !== b.h) return s + a.r.length + b.r.length; let d = 0; for (let n = 0; n < a.r.length; n++) if (a.r[n] !== b.r[n]) d++; return s + d; }, 0));
      add('like the others, as drawn', shareOf(sum0, key, false), true);
      add('odd one out, as drawn', shareOf(sum0, key, true), true);
    }
  }
  const line = [];
  for (const name of Object.keys(acc)) {
    const a = acc[name] / cnt[name];
    line.push(`${name} ${(a * 100).toFixed(1)}%`);
    if (req[name] === 'half') t.ok(a <= 0.5, `partial strategy "${name}" ${(a * 100).toFixed(1)} % ≤ 50 % (by features level: ${mfBy.filter(([, y]) => y).map(([x, y]) => (x / y * 100).toFixed(1) + '%').join(' ')})`);
    else if (req[name]) t.ok(a <= LIMIT, `shortcut "${name}" ${(a * 100).toFixed(1)} % ≤ chance + 10`);
  }
  console.log(`       openings shortcuts${band ? ' (starter band)' : ''}: ` + line.join(', '));
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
  for (const hard of [{ features: 4, edges: 1, keyview: 2, pose: 1, foils: 1 }, { features: 4, edges: 1, keyview: 0, pose: 0, foils: 0 }, { features: 0, edges: 1, keyview: 2, pose: 1, foils: 1 }]) {
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
  const L = PX.ex.learn('openings'), lib = def.lib;
  t.ok(L && typeof L === 'object', 'learn data is registered');
  if (!L) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, 'a one-line goal');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  // the teaching template (CONTRACT-v1.2 D; note D2 §3.0 C, §3.9 item 1)
  t.ok(Array.isArray(L.rules) && L.rules.length >= 2 && L.rules.length <= 4 && L.rules.every((r) => typeof r === 'string' && r.length > 20 && r.length <= 140), 'a rules card of 2–4 short rules');
  t.ok((L.strategies || []).some((x) => x.id === L.strategyFirst), `the strategy card before Try 1 exists (${L.strategyFirst})`);
  t.eq(L.minutes, 3, 'the offer card says about three minutes (the worked example included)');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed)), 'demo items with valid params');
  const demoItem = def.generate(PX.rng(L.demo[0].seed), L.demo[0].params);
  t.ok(def.validate(demoItem) === true && !demoItem.fallback, `demo seed ${L.demo[0].seed} gives a valid item`);
  t.ok(PX.ex.difficulty(def, L.demo[0].params) === PX.ex.minDifficulty(def), 'the Watch is at the starter band (the easiest level)');
  t.ok(Array.isArray(L.practice) && L.practice.length === 4 && L.practice.every((e) => e && valid(e.params) && Number.isInteger(e.seed)), 'four Try items, each { params, seed }');
  if (!Array.isArray(L.practice) || L.practice.length !== 4) return;
  const P = L.practice.map((e) => e.params), items = L.practice.map((e) => def.generate(PX.rng(e.seed), e.params));
  // a worked example before the Try item that brings the first hard feature (note D2 addendum C change 4)
  const exE = L.practice[2].example, xe = exE && def.generate(PX.rng(exE.seed), L.practice[2].params);
  t.ok(!!xe && Number.isInteger(exE.seed) && exE.seed !== L.practice[2].seed && def.validate(xe) === true && !xe.fallback && xe.options[xe.key].tf !== 0 && xe.key !== items[2].key && L.practice.every((e, i) => i === 2 || e.example === undefined),
    `Try 3 (turned openings) comes after a worked example on a sister item whose opening is turned (seed ${exE && exE.seed}, turn ${xe && xe.options[xe.key].tf})`);
  t.ok(items.every((it) => def.validate(it) === true && !it.fallback), 'every Try item is valid and no fallback');
  t.ok(P[0].features === 0 && P[1].features === 0, 'Try 1 and Try 2 are at the starter band');
  t.eq(P[2], { features: 1, edges: 0, keyview: 0, pose: 0, foils: 0, task: 'tutorial' }, 'Try 3 is the pre-1.2 floor (openings turned)');
  t.ok(P[3].features === 1 && P[3].keyview === 1, 'Try 4: the first hard feature the early rated items use (any face can fit)');
  t.eq(L.practice[0].assist, { trace: true }, 'Try 1 has its first step done (the key face traced)');
  t.ok(L.practice.slice(1).every((e) => e.assist === undefined), 'only Try 1 is assisted');
  const tips = new Set((L.tips || []).map((x) => x.id));
  t.ok(L.practice.every((e) => e.tip === undefined || tips.has(e.tip)), 'forced tips exist');
  const face = (it) => [2, 0, 1].find((w) => lib.axisFacing(lib.POSES[it.pose], w) === it.keyAxis);
  t.ok(face(items[0]) === 2 && face(items[1]) === 0 && face(demoItem) === 0, 'the Watch goes in side first, Try 1 front first, Try 2 side first (any face may go in first)');
  t.ok(L.rules.some((r) => /any face may go in first/i.test(r)) && /front, side or top/.test(L.captions.lead), 'the rules card and the Watch say that any face may go in first');
  t.ok(items[2].options[items[2].key].tf !== lib.seenTf(items[2].pose, items[2].keyAxis), 'Try 3\'s key opening is turned or flipped (the new feature, with its tip)');
  t.eq(new Set(items.map((it) => it.key)).size, 4, `the Try answers sit in four different places (${items.map((it) => it.key + 1).join(', ')})`);
  // every foil kind the Try items use appears in the Watch item
  const kindsOf = (it) => new Set(it.options.filter((o, i) => i !== it.key).map((o) => o.kind));
  const dk = kindsOf(demoItem), tk = new Set(items.flatMap((it) => [...kindsOf(it)]));
  t.ok([...tk].every((k) => dk.has(k)), `every foil kind in Try (${[...tk].join(', ')}) is in the Watch item (${[...dk].join(', ')})`);
  const ds = P.map((p) => PX.ex.difficulty(def, p));
  t.ok(ds.every((x, i) => i === 0 || x >= ds[i - 1]), `practice goes from easy to harder (${ds.map((x) => x.toFixed(2)).join(', ')})`);
  for (const tip of L.tips || []) {
    const tr = tip.when || {};
    t.ok(tip.id && tip.text && tr.dim && def.dims.some((d) => d.key === tr.dim && (tr.levels || []).every((l) => l >= 0 && l < d.levels.length)), `tip ${tip.id} has a valid trigger`);
  }
  t.ok((L.tips || []).length >= 3, 'just-in-time tips');
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  t.eq(L.strategies.find((x) => x.id === L.strategyFirst).steps.length, 3, 'the first card has three steps');
  const caps = ['lead', 'turn', 'spin', 'straight', 'land', 'assist', 'whyFeature', 'whyFace', 'whyProportion'];
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
