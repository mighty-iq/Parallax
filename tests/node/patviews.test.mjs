/* PAT-2 Missing View: drawings (two methods), the class-free proofs, the exhaustive search against
   brute force, generator, validator, scorer, shortcut solvers, timing, learn data.
   Run through tests/node/run.mjs (filter: patviews). */
import { performance } from 'node:perf_hooks';
import { MANIFEST } from './run.mjs';

const FILES = [...MANIFEST, 'js/ex/views/gen.js', 'js/ex/patviews/gen.js', 'js/ex/patviews/learn.js'];
const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10080); // 140 per combination
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
}

const sig = (x) => 1 / (1 + Math.exp(-x));
const pRight = (theta, b, g = CHANCE) => g + (1 - g - 0.03) * sig(theta - b);
const pk = (p) => `${p.cubes}${p.grid}${p.missing}${p.foil}`;

function testDefinition(t, PX, def) {
  t.eq([def.id, def.version, def.code, def.abilities, def.cell, def.role, def.answer, def.nOptions, def.pat],
    ['patviews', 1, 'PAT-2', ['Vz'], 'intrinsic-static', 'train', 'choice', 4, true], 'definition fields (a PAT-format exercise)');
  t.eq(def.dims.map((d) => [d.key, d.levels.length]), [['cubes', 4], ['grid', 2], ['missing', 3], ['foil', 3]], 'dims');
  t.eq(def.requires, ['views'], 'declares that it reads Views\' block model');
  const lo = PX.ex.minDifficulty(def), hi = PX.ex.maxDifficulty(def);
  t.ok(hi - lo >= 4 - 1e-9, `difficulty spans at least 4 logits (${(hi - lo).toFixed(2)})`);
  t.ok(pRight(0, lo) >= 0.88 && pRight(0, lo) <= 0.93, `a beginner gets the easiest items about 90 % right (${pRight(0, lo).toFixed(3)})`);
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
}

/* ------------------------------------------------------------------ the pool */

function testPool(t, PX, def, L) {
  t.section('patviews: pool');
  const combos = PX.ex.enumerate(def);
  t.eq(combos.length, 72, '72 combinations (4 × 2 × 3 × 3)');
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
  const distinct = new Set(items.map((x) => x.it.missing + JSON.stringify(x.it.heights)));
  t.ok(distinct.size > 0.6 * n, `structures are varied (${distinct.size} distinct of ${n})`);
  return items;
}

function testKinds(t, PX, def, L, pool) {
  t.section('patviews: foils');
  const why = {}, kinds = {}, ranks = [0, 0, 0, 0];
  let lvl0 = 0, n0 = 0, lvl1 = 0, n1 = 0, lvl2 = 0, n2 = 0, size = 0, missOk = 0, unique = 0;
  for (const { p, it } of pool) {
    ranks[it.key]++;
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

function testShortcuts(t, PX, def, L, pool) {
  t.section('patviews: shortcut solvers');
  const acc = {}, cnt = {};
  const add = (name, v) => { acc[name] = (acc[name] || 0) + v; cnt[name] = (cnt[name] || 0) + 1; };
  for (const { it } of pool) {
    const g = it.options.map((o) => L.grid(o.drawing)), c = g.map(L.counts), key = it.key;
    const sum = g.map((a, i) => g.reduce((s, b, j) => s + (i === j ? 0 : L.gdist(a, b)), 0));
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
  const line = [];
  for (const name of Object.keys(acc)) {
    const a = acc[name] / cnt[name];
    line.push(`${name} ${(a * 100).toFixed(1)}%`);
    t.ok(a <= LIMIT, `shortcut "${name}" ${(a * 100).toFixed(1)} % ≤ chance + 10`);
  }
  console.log('       patviews shortcuts: ' + line.join(', '));
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
  for (const hard of [{ cubes: 3, grid: 1, missing: 2, foil: 2 }, { cubes: 3, grid: 1, missing: 1, foil: 2 }, { cubes: 3, grid: 1, missing: 0, foil: 0 }]) {
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
  const valid = (p) => PX.ex.validParams(def, p) === true;
  t.ok(Array.isArray(L.demo) && L.demo.length >= 1 && L.demo.every((d) => valid(d.params) && Number.isInteger(d.seed)), 'demo items with valid params');
  for (const d of L.demo) {
    const item = def.generate(PX.rng(d.seed), d.params);
    t.ok(def.validate(item) === true && !item.fallback, `demo seed ${d.seed} gives a valid item`);
  }
  t.ok(PX.ex.difficulty(def, L.demo[0].params) === PX.ex.minDifficulty(def), 'the demo is at the easiest level');
  t.ok(Array.isArray(L.practice) && L.practice.length >= 3 && L.practice.length <= 5 && L.practice.every(valid), '3–5 practice params');
  const ds = L.practice.map((p) => PX.ex.difficulty(def, p));
  t.ok(ds.every((x, i) => i === 0 || x >= ds[i - 1]), `practice goes from easy to harder (${ds.map((x) => x.toFixed(2)).join(', ')})`);
  t.ok(new Set(L.practice.map((p) => p.missing)).size === 3, 'practice asks for each of the three views once');
  t.ok(Array.isArray(L.tips) && L.tips.length >= 3, 'just-in-time tips');
  for (const tip of L.tips) {
    const tr = tip.when || {};
    const dimOk = tr.dim && def.dims.some((d) => d.key === tr.dim && (tr.levels || []).length && tr.levels.every((l) => l >= 0 && l < d.levels.length));
    t.ok(tip.id && tip.text && dimOk, `tip ${tip.id} has a valid trigger`);
  }
  t.eq((L.strategies || []).map((s) => s.id), ['imagery', 'analytic', 'switch'], 'strategy cards: imagery, analytic, when to switch');
  t.ok(L.strategies.every((s) => s.title && s.text && Array.isArray(s.steps) && s.steps.length >= 2 && s.when), 'every card has a title, a text, steps and when to use it');
  const caps = ['views', 'slot', 'options', 'project', 'build', 'dotted', 'land', 'whyHull', 'whyAlign', 'whySearch', 'object'];
  t.ok(caps.every((k) => typeof (L.captions || {})[k] === 'string' && L.captions[k].length > 5), 'every caption the view plays is there');
  const all = JSON.stringify(L);
  t.ok(all.includes(ADA), 'the ADA line sits wherever the DAT is named');
  t.ok(!/\biq\b|smarter|intelligence|brain age|mastered|boost|raise your|score gain|predict/i.test(all), 'no IQ, "mastered", score-gain or prediction claims');
  t.ok(typeof L.bridge === 'string' && /not measured|has not been shown|has not measured/i.test(L.bridge), 'a "where it is used" line with its limitation beside it');
}
