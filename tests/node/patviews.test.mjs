/* EX-15 Missing View (DAT-style format): drawings (two methods), the class-free proofs, the exhaustive search against
   brute force, generator, validator, scorer, shortcut solvers, timing, learn data.
   Run through tests/node/run.mjs (filter: patviews). */
import { performance } from 'node:perf_hooks';
import { MANIFEST } from './run.mjs';

const FILES = [...MANIFEST, 'js/ex/views/gen.js', 'js/ex/patviews/gen.js', 'js/ex/patviews/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // 112 per combination (90 with the starter band)
const CHANCE = 0.25, LIMIT = CHANCE + 0.10;

export async function run(t) {
  const c = t.context({ files: FILES }), PX = c.PX, def = PX.ex.get('patviews');
  t.section('patviews: definition');
  t.ok(def, 'patviews is defined');
  if (!def) return;
  const L = def.lib, VL = PX.ex.get('views').lib;
  testDefinition(t, PX, def);
  testMethods(t, PX, L, VL);
  testSearch(t, PX, L, VL);
  const pool = testPool(t, PX, def, L);
  testKinds(t, PX, def, L, pool);
  testShortcuts(t, PX, def, L, pool);
  testTampering(t, PX, def, L, pool);
  testFallback(t, PX, def, L);
  testTiming(t, PX, def);
  testLearn(t, PX, def);
  testTutorialRepeat(t, PX, def, 'patviews');
}

const sig = (x) => 1 / (1 + Math.exp(-x));
const pRight = (theta, b, g = CHANCE) => g + (1 - g - 0.03) * sig(theta - b);
const pk = (p) => `${p.cubes}${p.grid}${p.missing}${p.foil}`;

function testDefinition(t, PX, def) {
  t.eq([def.id, def.version, def.code, def.abilities, def.cell, def.role, def.answer, def.nOptions, def.pat],
    ['patviews', 2, 'EX-15', ['Vz'], 'intrinsic-static', 'train', 'choice', 4, true], 'definition fields (a PAT-format exercise; version 2: the starter band)');
  t.eq(def.dims.map((d) => [d.key, d.levels.length]), [['cubes', 5], ['grid', 2], ['missing', 3], ['foil', 3]], 'dims');
  t.eq(def.requires, ['views'], 'declares that it reads Views\' block model');
  t.eq(def.starter, { dim: 'cubes', levels: 1 }, 'the starter band is the first level of cubes');
  t.eq(def.dims[0].at, [-1.6, 0, 0.5, 1.0, 1.5], 'cubes: the band offset in front, older levels at their 1.1 difficulty (step 0.5)');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(Math.abs(lo + 3.8) < 1e-9, `the floor moves to −3.8 (${lo.toFixed(2)}; note D2 §3.7)`);
  t.ok(hi - lo >= 4 - 1e-9, `difficulty spans at least 4 logits (${(hi - lo).toFixed(2)})`);
  const old0 = PX.ex.difficulty(def, { cubes: 1, grid: 0, missing: 0, foil: 0 });
  t.ok(Math.abs(old0 + 2.2) < 1e-9 && pRight(0, old0) >= 0.88 && pRight(0, old0) <= 0.93, `a beginner at θ = 0 gets the pre-1.2 floor about 90 % right (${pRight(0, old0).toFixed(3)}), the starter band ${pRight(0, lo).toFixed(3)}`);
}

/* ------------------------------------------------------------------ drawings and proofs */

function testMethods(t, PX, L, VL) {
  t.section('patviews: methods');
  const r = PX.rng(4242);
  let n = 0, same = 0, hullOk = 0, alignOk = 0, k;
  for (k = 0; k < 3000; k++) {
    const G = k % 2 ? 4 : 3, b = L.boxOf(VL.randomStructure(r, G, 4 + (k % 9))), rows = L.rowsOf(b);
    const v3 = {};
    for (const v of L.VIEWS) { n++; v3[v] = L.drawView(b, v); if (L.sameGrid(v3[v], L.drawRay(rows, b.W, b.H, b.D, v))) same++; }
    if (!L.hullFails(v3.top, v3.front, v3.end, b.W, b.H, b.D)) hullOk++;
    if (!L.alignFails(v3.top, v3.front, v3.end)) alignOk++;
  }
  t.eq(same, n, `segment drawings equal edge-marching drawings (${n} views)`);
  t.eq(hullOk, 3000, 'a real structure never fails the silhouette-hull proof');
  t.eq(alignOk, 3000, 'a real structure never fails the line-alignment proof (random 3 × 3 and 4 × 4)');
  // Line alignment is a proof only if it holds for every structure in the class: all height maps
  // in a 3 × 3 box up to 2 high, and in a 2 × 4 box up to 3 high (disconnected ones included).
  let all = 0, bad = 0, first = '';
  for (const [W, D, H] of [[3, 3, 2], [2, 4, 3], [4, 2, 3]]) {
    const cells = W * D, total = (H + 1) ** cells;
    for (let code = 0; code < total; code++) {
      const hm = new Int8Array(cells);
      let x = code, mx = 0;
      for (let i = 0; i < cells; i++) { hm[i] = x % (H + 1); x = Math.floor(x / (H + 1)); if (hm[i] > mx) mx = hm[i]; }
      if (!mx) continue;
      const b = { W, H: mx, D, hm };
      all++;
      const v3 = { top: L.drawView(b, 'top'), front: L.drawView(b, 'front'), end: L.drawView(b, 'end') };
      if (L.alignFails(v3.top, v3.front, v3.end) || L.hullFails(v3.top, v3.front, v3.end, W, mx, D)) { bad++; first = first || JSON.stringify([W, D, Array.from(hm)]); }
    }
  }
  t.eq(bad, 0, `alignment and hull hold for every height map in small boxes (${all} maps)` + (bad ? ' first: ' + first : ''));
  // A hand-made case: a tall column in front of a short one hides a step (dotted in front and end).
  const b = { W: 1, H: 3, D: 2, hm: new Int8Array([1, 3]) };
  const f = L.drawView(b, 'front');
  t.eq([f.hs[1], f.hs[3]], [2, 1], 'front view: the step behind the tall column is dotted, the top is solid');
  t.eq(L.drawView(b, 'top').hs.indexOf(2), -1, 'top views of stacks have no dotted lines');
}

// The search returns every structure with the two given views: compared with brute force.
function testSearch(t, PX, L, VL) {
  t.section('patviews: search');
  let cases = 0, agree = 0, holds = 0, first = '';
  for (const [W, D, H] of [[2, 2, 3], [3, 2, 2], [2, 3, 3], [3, 3, 2]]) {
    const cells = W * D, total = (H + 1) ** cells, groups = {};
    const views = [];
    for (let code = 0; code < total; code++) {
      const hm = new Int8Array(cells);
      let x = code;
      for (let i = 0; i < cells; i++) { hm[i] = x % (H + 1); x = Math.floor(x / (H + 1)); }
      const b = { W, H, D, hm };
      views.push({ hm, v: { top: L.drawView(b, 'top'), front: L.drawView(b, 'front'), end: L.drawView(b, 'end') } });
    }
    const r = PX.rng(W * 100 + D * 10 + H);
    for (let s = 0; s < 40; s++) {
      const pick = views[Math.floor(r.next() * views.length)];
      for (const miss of L.VIEWS) {
        const given = {};
        for (const v of L.VIEWS) if (v !== miss) given[v] = pick.v[v];
        const res = L.search(given, W, H, D);
        const brute = views.filter((o) => Object.keys(given).every((v) => L.sameGrid(o.v[v], given[v]))).map((o) => Array.from(o.hm).join('')).sort();
        const got = res.sols.map((hm) => Array.from(hm).join('')).sort();
        cases++;
        if (!res.over && JSON.stringify(brute) === JSON.stringify(got)) agree++; else first = first || `${W}x${D}x${H} ${miss}: brute ${brute.length}, search ${got.length}`;
        if (got.includes(Array.from(pick.hm).join(''))) holds++;
      }
    }
  }
  t.eq(agree, cases, `the search finds exactly the structures brute force finds (${cases} cases)` + (first ? ' ' + first : ''));
  t.eq(holds, cases, 'the search always contains the structure the views came from');
  // The validator's second search (drawRay only, sharing nothing with search()) against brute force
  // on drawRay's own views.
  let cases2 = 0, agree2 = 0, first2 = '';
  for (const [W, D, H] of [[2, 2, 3], [3, 2, 2], [2, 3, 3], [3, 3, 2]]) {
    const cells = W * D, total = (H + 1) ** cells, views = [];
    for (let code = 0; code < total; code++) {
      const rows = [];
      let x = code;
      for (let z = 0; z < D; z++) { const row = []; for (let i = 0; i < W; i++) { row.push(x % (H + 1)); x = Math.floor(x / (H + 1)); } rows.push(row); }
      views.push({ key: JSON.stringify(rows), v: { top: L.drawRay(rows, W, H, D, 'top'), front: L.drawRay(rows, W, H, D, 'front'), end: L.drawRay(rows, W, H, D, 'end') } });
    }
    const r = PX.rng(W * 1000 + D * 10 + H + 7);
    for (let s = 0; s < 30; s++) {
      const pick = views[Math.floor(r.next() * views.length)];
      for (const miss of L.VIEWS) {
        const given = {};
        for (const v of L.VIEWS) if (v !== miss) given[v] = pick.v[v];
        const res = L.searchRay(given, W, H, D);
        const brute = views.filter((o) => Object.keys(given).every((v) => L.sameGrid(o.v[v], given[v]))).map((o) => o.key).sort();
        const got = res.sols.map((rows) => JSON.stringify(rows)).sort();
        cases2++;
        if (!res.over && JSON.stringify(brute) === JSON.stringify(got)) agree2++; else first2 = first2 || `${W}x${D}x${H} ${miss}: brute ${brute.length}, second search ${got.length}`;
      }
    }
  }
  t.eq(agree2, cases2, `the validator's second search finds exactly what brute force finds (${cases2} cases)` + (first2 ? ' ' + first2 : ''));
}

/* ------------------------------------------------------------------ the pool */

function testPool(t, PX, def, L) {
  t.section('patviews: pool');
  const combos = PX.ex.enumerate(def);
  t.eq(combos.length, 90, '90 combinations (5 × 2 × 3 × 3)');
  const per = Math.ceil(N_ITEMS / combos.length), items = [];
  let threw = 0, invalid = 0, keyWrong = 0, foilRight = 0, json = 0, first = null, malformed = 0;
  const before = { ...L.stats };
  for (const p of combos) {
    for (let s = 0; s < per; s++) {
      const seed = PX.rng.hash('patviews-test', pk(p), s);
      let it;
      try { it = def.generate(PX.rng(seed), p); } catch (e) { threw++; first = first || `${pk(p)}#${s} threw ${e.message}`; continue; }
      const v = def.validate(it);
      if (v !== true) { invalid++; first = first || `${pk(p)}#${s}: ${v}`; }
      if (!def.score(it, it.key).correct) keyWrong++;
      for (let i = 0; i < 4; i++) if (i !== it.key && def.score(it, i).correct) foilRight++;
      for (const bad of [null, undefined, -1, 4, '0', 1.5, [it.key]]) if (def.score(it, bad).correct) malformed++;
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
  console.log(`       patviews attempts per item ${((L.stats.tries - before.tries) / n).toFixed(2)}, search over bound ${L.stats.over - before.over}`);
  let same = 0, checked = 0;
  for (let i = 0; i < items.length; i += 10) {
    checked++;
    if (JSON.stringify(def.generate(PX.rng(items[i].seed), items[i].p)) === JSON.stringify(items[i].it)) same++;
  }
  t.eq(same, checked, `the same seed gives the same item (${checked} seeds regenerated)`);
  // The starter band draws from a small enumerated list of structures (4–6 cubes, two high), so variety
  // is judged above it; the band reports its own count.
  const above = items.filter((x) => x.p.cubes > 0), band = items.filter((x) => x.p.cubes === 0);
  const distinct = new Set(above.map((x) => x.it.missing + JSON.stringify(x.it.heights)));
  t.ok(distinct.size > 0.6 * above.length, `structures are varied above the band (${distinct.size} distinct of ${above.length})`);
  const dBand = new Set(band.map((x) => x.it.missing + JSON.stringify(x.it.heights)));
  t.ok(dBand.size >= 150, `the starter band uses many of its structures (${dBand.size} distinct of ${band.length})`);
  return items;
}

function testKinds(t, PX, def, L, pool) {
  t.section('patviews: foils');
  const why = {}, kinds = {}, ranks = [0, 0, 0, 0];
  let lvl0 = 0, n0 = 0, lvl1 = 0, n1 = 0, lvl2 = 0, n2 = 0, size = 0, missOk = 0, unique = 0, countOk = 0;
  let nBand = 0, bandBox = 0, bandSolid = 0, bandProof = 0;
  for (const { p, it } of pool) {
    ranks[it.key]++;
    const nc = it.heights.flat().reduce((a, b) => a + b, 0), win = L.CUBES[p.cubes];
    if (nc >= win[0] && nc <= win[1]) countOk++;
    if (p.cubes === 0) { // the starter band (note D2 §3.7)
      nBand++;
      if (it.H === 2 && it.W >= 2 && it.D >= 2 && Math.max(it.W, it.D) <= 3 && (p.grid === 1 || it.missing === 'front' || Math.min(it.W, it.D) <= 2)) bandBox++;
      if (it.options.every((o) => o.drawing.segs.every((q) => q[4] === 1))) bandSolid++;
      if (it.options.every((o, i) => i === it.key || o.why === 'hull' || o.why === 'align')) bandProof++;
      if (p.foil === 2) { // the band's subtlest level: same outline, every foil within three units of the key
        n2++;
        const g = it.options.map((o) => L.grid(o.drawing)), kg = g[it.key];
        if (it.options.every((o, i) => i === it.key || o.kind !== 'outline') && g.every((x) => L.gdist(x, kg) <= 3)) lvl2++;
      }
      if (p.foil === 0) { n0++; if (it.options.filter((_, i) => i !== it.key).every((o) => o.kind === 'outline')) lvl0++; }
      if (p.foil === 1) { n1++; const f = it.options.filter((_, i) => i !== it.key); if (f.every((o) => o.kind !== 'outline') && f.filter((o) => o.kind === 'lines').length >= 2) lvl1++; }
      if (it.missing === L.MISSING[p.missing] && Object.keys(it.given).length === 2) missOk++;
      const kd = it.options[it.key].drawing;
      if (it.options.every((o) => o.drawing.w === kd.w && o.drawing.h === kd.h)) size++;
      it.options.forEach((o, i) => { if (i !== it.key) { why[o.why] = (why[o.why] || 0) + 1; kinds[o.kind] = (kinds[o.kind] || 0) + 1; } });
      continue;
    }
    if (it.missing === L.MISSING[p.missing] && Object.keys(it.given).length === 2) missOk++;
    if (it.possible === 1) unique++;
    const foils = it.options.filter((_, i) => i !== it.key);
    foils.forEach((o) => { why[o.why] = (why[o.why] || 0) + 1; kinds[o.kind] = (kinds[o.kind] || 0) + 1; });
    const k = it.options[it.key].drawing;
    if (foils.every((o) => o.drawing.w === k.w && o.drawing.h === k.h)) size++;
    if (p.foil === 0) { n0++; if (foils.every((o) => o.kind === 'outline')) lvl0++; }
    if (p.foil === 1) { n1++; if (foils.every((o) => o.kind !== 'outline') && foils.filter((o) => o.kind === 'lines').length >= 2) lvl1++; }
    if (p.foil === 2) {
      n2++;
      const g = it.options.map((o) => L.grid(o.drawing)), kg = g[it.key];
      const ok = foils.every((o) => o.kind !== 'outline') && (it.missing === 'top' ? g.every((x) => L.gdist(x, kg) <= 3) : foils.some((o) => o.kind === 'dashes'));
      if (ok) lvl2++;
    }
  }
  const N = pool.length;
  t.eq(countOk, N, 'the shown structure has the level\'s cube count (the labels hold)');
  t.ok(nBand >= 2000, `starter band items (${nBand})`);
  t.eq(bandBox, nBand, 'starter band: two high, in a box of at most 2 × 3 (grid level 1, or a missing front view: 3 × 3)');
  t.eq(bandSolid, nBand, 'starter band: no option has a dotted line (the key never does)');
  t.eq(bandProof, nBand, 'starter band: every foil fails the hull or the line test (none needs the exhaustive search)');
  t.eq(missOk, N, 'every item asks for its level\'s missing view and gives the other two');
  t.eq(size, N, 'every option has the size the two given views require');
  t.eq(lvl0, n0, 'foil level 0: every foil has another outline');
  t.eq(lvl1, n1, 'foil level 1: every foil shares the key\'s outline, at least two differ in their lines');
  t.eq(lvl2, n2, 'foil level 2: a solid/dotted foil (front, end), or one-line foils (top)');
  t.ok(ranks.every((r) => r / N > 0.22 && r / N < 0.28), `the key's place is spread (${ranks.map((r) => (r / N * 100).toFixed(0) + '%').join(' ')})`);
  console.log(`       patviews foil kinds ${JSON.stringify(kinds)}, proofs ${JSON.stringify(why)}, two views fix the third in ${(unique / N * 100).toFixed(0)} % of items`);
  t.ok(why.search > 0 && why.hull > 0, 'some foils fall to the hull proof, some need the exhaustive search');
}

/* ------------------------------------------------------------------ shortcut solvers */

const shareOf = (scores, key, high) => {
  const best = high ? Math.max(...scores) : Math.min(...scores);
  return scores[key] === best ? 1 / scores.filter((x) => x === best).length : 0;
};

// Lines only: unit segments present in one drawing and not the other, solid and dotted taken alike (own code).
function linesApart(a, b) {
  let n = 0;
  for (let k = 0; k < a.hs.length; k++) if (!a.hs[k] !== !b.hs[k]) n++;
  for (let k = 0; k < a.vs.length; k++) if (!a.vs[k] !== !b.vs[k]) n++;
  return n;
}
function testShortcuts(t, PX, def, L, pool) {
  t.section('patviews: shortcut solvers, starter band');
  shortcutPool(t, L, pool.filter((x) => x.p.cubes === 0), true);
  t.section('patviews: shortcut solvers, levels above the band');
  shortcutPool(t, L, pool.filter((x) => x.p.cubes > 0), false);
}
// Per item, every shortcut solver's share of the key (ties shared). One implementation for this file's pools
// and for tests/node/shortcut-levels.test.mjs (the export at the end).
function itemScores(L, it) {
  const out = {}, add = (name, v) => { out[name] = v; };
  {
    const g = it.options.map((o) => L.grid(o.drawing)), c = g.map(L.counts), key = it.key;
    'ABCD'.split('').forEach((ch, j) => add('always ' + ch, key === j ? 1 : 0)); // always the same letter
    const sum = g.map((a, i) => g.reduce((s, b, j) => s + (i === j ? 0 : L.gdist(a, b)), 0));
    const sumL = g.map((a, i) => g.reduce((s, b, j) => s + (i === j ? 0 : linesApart(a, b)), 0));
    add('like the others (lines only)', shareOf(sumL, key, false));
    add('odd one out (lines only)', shareOf(sumL, key, true));
    add('most solid', shareOf(c.map((x) => x.solid), key, true));
    add('fewest solid', shareOf(c.map((x) => x.solid), key, false));
    add('most dotted', shareOf(c.map((x) => x.dotted), key, true));
    add('fewest dotted', shareOf(c.map((x) => x.dotted), key, false));
    add('most lines', shareOf(c.map((x) => x.solid + x.dotted), key, true));
    add('fewest lines', shareOf(c.map((x) => x.solid + x.dotted), key, false));
    add('largest area', shareOf(c.map((x) => x.area), key, true));
    add('smallest area', shareOf(c.map((x) => x.area), key, false));
    add('like the others', shareOf(sum, key, false));
    add('odd one out', shareOf(sum, key, true));
    add('size fits the stem', 1 / 4); // every option has the stem's size (checked above)
    // Stem-based: the option most like a given view of the same size (as drawn, or mirrored).
    const gv = Object.keys(it.given).map((v) => L.grid(it.given[v]));
    const like = g.map((o) => Math.min(...gv.filter((x) => x.w === o.w && x.h === o.h).map((x) => L.gdist(o, x)).concat([99])));
    add('most like a given view', shareOf(like, key, false));
    // Stem-based: solid units equal to a given view's.
    const sc = gv.map((x) => L.counts(x).solid);
    add('as many solid units as a given view', shareOf(c.map((x) => (sc.includes(x.solid) ? 1 : 0)), key, true));
  }
  return out;
}
function shortcutPool(t, L, pool, band) {
  t.ok(pool.length >= 2000, `${pool.length} items`);
  const acc = {}, cnt = {}, cell = {};
  for (const { it, p } of pool) {
    const tag = 'foil ' + p.foil + ', ' + it.missing + ' missing';
    for (const [name, v] of Object.entries(itemScores(L, it))) {
      acc[name] = (acc[name] || 0) + v; cnt[name] = (cnt[name] || 0) + 1;
      const k = name + ' @ ' + tag; cell[k] = cell[k] || [0, 0]; cell[k][0] += v; cell[k][1]++;
    }
  }
  const line = [];
  for (const name of Object.keys(acc)) {
    const a = acc[name] / cnt[name];
    line.push(`${name} ${(a * 100).toFixed(1)}%`);
    t.ok(a <= LIMIT, `shortcut "${name}" ${(a * 100).toFixed(1)} % ≤ chance + 10`);
  }
  console.log(`       patviews shortcuts${band ? ' (starter band)' : ''}: ` + line.join(', '));
  // Per foil level and missing view too (review RV-dat-style-B §9), apart from the constant "size fits".
  const over = Object.entries(cell).filter(([k, v]) => !k.startsWith('size fits') && v[0] / v[1] > LIMIT).map(([k, v]) => `${k} ${(v[0] / v[1] * 100).toFixed(1)}% (n ${v[1]})`);
  t.ok(!over.length, 'every solver stays within chance + 10 at each foil level and missing view' + (over.length ? ': ' + over.join('; ') : ''));
}

/* ------------------------------------------------------------------ tampering, fallback, timing */

function testTampering(t, PX, def, L, pool) {
  t.section('patviews: validate rejects broken items');
  const pick = (f) => pool.filter((x, i) => i % 41 === 0 && (!f || f(x.it))).slice(0, 40).map((x) => JSON.parse(JSON.stringify(x.it)));
  const cases = [
    ['the key index moved', null, (it) => { it.key = (it.key + 1) % 4; }],
    ['a foil replaced by the key', null, (it) => { const j = (it.key + 1) % 4; it.options[j] = JSON.parse(JSON.stringify(it.options[it.key])); }],
    ['a cube added on top', null, (it) => { const r = it.heights; for (const row of r) for (let x = 0; x < row.length; x++) if (row[x] > 0 && row[x] < it.H) { row[x]++; return; } r[0][0] = r[0][0] ? r[0][0] - 1 : 1; }],
    ['the missing view renamed', null, (it) => { const m = ['top', 'front', 'end'].filter((v) => v !== it.missing)[0]; it.missing = m; }],
    ['a dotted line of the key made solid', (it) => it.options[it.key].drawing.segs.some((q) => q[4] === 2), (it) => { const q = it.options[it.key].drawing.segs.find((s) => s[4] === 2); q[4] = 1; }],
    ['a foil\'s reason changed', null, (it) => { const j = (it.key + 1) % 4; it.options[j].why = it.options[j].why === 'search' ? 'hull' : 'search'; }],
  ];
  for (const [name, f, mod] of cases) {
    const items = pick(f);
    let rejected = 0;
    items.forEach((it) => { mod(it); if (def.validate(it) !== true) rejected++; });
    t.eq(rejected, items.length, `validate rejects: ${name} (${items.length} items)`);
  }
}

function testFallback(t, PX, def, L) {
  t.section('patviews: fallback');
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
  t.section('patviews: timing');
  for (const hard of [{ cubes: 4, grid: 1, missing: 2, foil: 2 }, { cubes: 4, grid: 1, missing: 1, foil: 2 }, { cubes: 4, grid: 1, missing: 0, foil: 0 }]) {
    let best = Infinity, text = [];
    for (let r = 0; r < 3 && best >= 20; r++) {
      const cpu = [], wall = [];
      for (let s = 0; s < 200; s++) {
        const c0 = cpuMs(), w0 = performance.now();
        def.generate(PX.rng(PX.rng.hash('patviews-timing', r, s)), hard);
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
  t.section('patviews: learn');
  const L = PX.ex.learn('patviews');
  t.ok(L && typeof L === 'object', 'learn data is registered');
  if (!L) return;
  t.ok(typeof L.goal === 'string' && L.goal.length > 10 && L.goal.length <= 120, 'a one-line goal');
  t.ok(Array.isArray(L.parts) && L.parts.length >= 3 && L.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  // the teaching template (CONTRACT-v1.2 D; note D2 §3.0 C, §3.7, §3.9 item 1)
  t.ok(Array.isArray(L.rules) && L.rules.length >= 2 && L.rules.length <= 4 && L.rules.every((r) => typeof r === 'string' && r.length > 20 && r.length <= 140), 'a rules card of 2–4 short rules');
  t.ok((L.strategies || []).some((x) => x.id === L.strategyFirst) && L.strategies.find((x) => x.id === L.strategyFirst).steps.length === 3, `the strategy card before Try 1 exists, with three steps (${L.strategyFirst})`);
  t.eq(L.minutes, 3, 'the offer card says about three minutes (the worked example included)');
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length === 1 && valid(L.demo[0].params) && Number.isInteger(L.demo[0].seed), 'one demo item with valid params');
  const di = def.generate(PX.rng(L.demo[0].seed), L.demo[0].params);
  t.ok(def.validate(di) === true && !di.fallback && di.missing === 'end', `demo seed ${L.demo[0].seed} gives a valid item, the end view missing`);
  t.ok(PX.ex.difficulty(def, L.demo[0].params) === PX.ex.minDifficulty(def), 'the Watch is at the starter band (the easiest level)');
  // the Watch's dotted-line step plays (O52: it waits for a tap): the demo's given views show a dotted line
  const dotted = Object.values(di.given).reduce((a, d) => a + d.segs.filter((q) => q[4] === 2).length, 0);
  t.ok(dotted >= 1, `the demo item shows dotted lines in its given views (${dotted}), so the Watch holds on them`);
  t.ok(Array.isArray(L.practice) && L.practice.length === 4 && L.practice.every((e) => e && valid(e.params) && Number.isInteger(e.seed)), 'four Try items, each { params, seed }');
  if (!Array.isArray(L.practice) || L.practice.length !== 4) return;
  const P = L.practice.map((e) => e.params), items = L.practice.map((e) => def.generate(PX.rng(e.seed), e.params));
  // a worked example before the Try item that brings the first hard feature (note D2 addendum C change 4)
  const exE = L.practice[2].example, xe = exE && def.generate(PX.rng(exE.seed), L.practice[2].params);
  t.ok(!!xe && Number.isInteger(exE.seed) && exE.seed !== L.practice[2].seed && def.validate(xe) === true && !xe.fallback && xe.options[xe.key].drawing.segs.some((q) => q[4] === 2) && xe.key !== items[2].key && L.practice.every((e, i) => i === 2 || e.example === undefined),
    `Try 3 (a dotted line) comes after a worked example on a sister item whose answer has a dotted line (seed ${exE && exE.seed})`);
  t.ok(items.every((it) => def.validate(it) === true && !it.fallback), 'every Try item is valid and no fallback');
  t.ok(P[0].cubes === 0 && P[1].cubes === 0 && items[0].missing === 'end' && items[1].missing === 'front', 'Try 1 (end view) and Try 2 (front view) are at the starter band');
  t.eq(L.practice[0].assist, { proj: true }, 'Try 1 has its first step done (projection lines in the slot)');
  t.ok(L.practice.slice(1).every((e) => e.assist === undefined), 'only Try 1 is assisted');
  t.ok(P[2].cubes === 1 && items[2].options[items[2].key].drawing.segs.some((q) => q[4] === 2) && L.practice[2].tip === 'hidden', 'Try 3: the pre-1.2 floor, structure hidden, a dotted line in the answer, with its tip');
  t.ok(P[3].cubes === 1 && items[3].options.some((o) => o.why === 'search') && L.practice[3].tip === 'search', 'Try 4: a foil that only building the structure rules out, with its tip');
  t.eq(new Set(items.map((it) => it.key)).size, 4, `the Try answers sit in four different places (${items.map((it) => it.key + 1).join(', ')})`);
  const kindsOf = (it) => new Set(it.options.filter((o, i) => i !== it.key).map((o) => o.kind));
  const dk = kindsOf(di), tk = new Set(items.flatMap((it) => [...kindsOf(it)]));
  t.ok([...tk].every((k) => dk.has(k)), `every foil kind in Try (${[...tk].join(', ')}) is in the Watch item (${[...dk].join(', ')})`);
  const ds = P.map((p) => PX.ex.difficulty(def, p));
  t.ok(ds.every((x, i) => i === 0 || x >= ds[i - 1] - 1e-9), `practice goes from easy to harder (${ds.map((x) => x.toFixed(2)).join(', ')})`);
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips) {
    const tr = tip.when || {};
    const dimOk = tr.dim && def.dims.some((d) => d.key === tr.dim && (tr.levels || []).length && tr.levels.every((l) => l >= 0 && l < d.levels.length));
    t.ok(tip.id && tip.text && dimOk, `tip ${tip.id} has a valid trigger`);
  }
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['views', 'slot', 'intro', 'project', 'turn', 'fade', 'fadeNone', 'lay', 'dotted', 'land', 'shown', 'assist', 'whyHull', 'whyAlign', 'whySearch', 'object', 'diffDotted', 'diffSolid', 'diffExtra', 'diffMissing', 'diffMixed'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  const all = JSON.stringify(L);
  t.ok(all.includes(ADA), 'the ADA line sits wherever the DAT is named');
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered|boost|raise your|score gain|predict/i.test(all), 'no IQ, "mastered", score-gain or prediction claims');
  t.ok(typeof L.bridge === 'string' && /not measured|has not been shown|has not measured/i.test(L.bridge), 'a "where it is used" line with its limitation beside it');
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

/* v1.2 wave 2 (W2-progress): per-item shortcut scores for tests/node/shortcut-levels.test.mjs */
export function shortcutScores(PX, def, item) {
  const out = {};
  for (const [name, hit] of Object.entries(itemScores(def.lib, item))) out[name] = name === 'size fits the stem' ? { hit, chance: 0.25, info: true } : { hit, chance: 0.25 };
  return out;
}
export const SHORTCUT_EXEMPT = ['size fits the stem'];
