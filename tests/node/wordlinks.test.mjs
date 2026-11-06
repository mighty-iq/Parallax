/* PR-0 Word Links: table, generator, validator, shortcut solvers (≥ 10 000 seeds over every level). */
import { performance } from 'node:perf_hooks';
import { MANIFEST } from './run.mjs';

const SEEDS_PER_COMBO = 375; // 27 combinations → 10 125 items

export async function run(t) {
  // Only the files this probe needs, so other exercises' work in progress cannot break it.
  const PX = t.context({ files: [...MANIFEST, 'js/ex/wordlinks/gen.js', 'js/ex/wordlinks/learn.js'] }).PX;
  const def = PX.ex.get('wordlinks');
  t.section('wordlinks: definition');
  t.ok(def, 'wordlinks is registered');
  if (!def) return;
  t.eq([def.code, def.role, def.answer, def.cell, def.nOptions, def.version, [...def.abilities]], ['PR-0', 'probe', 'choice', null, 4, 1, ['VB']], 'contract fields');
  const range = PX.ex.maxDifficulty(def) - PX.ex.minDifficulty(def);
  t.ok(range >= 4, `difficulty range ≥ 4 logits (got ${range.toFixed(2)})`);
  const H = def.helpers, ix = H.index();

  t.section('wordlinks: table');
  const rels = Object.values(ix.rels);
  t.ok(rels.length >= 12, `at least 12 relation types (got ${rels.length})`);
  t.ok(ix.nPairs >= 300, `at least 300 word pairs (got ${ix.nPairs})`);
  t.ok(rels.every((r) => r.pairs.length >= 12), 'every relation has at least 12 pairs');
  let selfPairs = 0, dupPairs = 0, badWords = 0, dupAlts = 0;
  for (const r of rels) {
    const seen = new Set();
    for (const p of r.pairs) {
      if (p.alts.includes(p.a)) selfPairs++;
      const k = p.a + '|' + p.b;
      if (seen.has(k)) dupPairs++;
      seen.add(k);
      if (new Set(p.alts).size !== p.alts.length) dupAlts++;
      for (const w of [p.a, ...p.alts]) if (!/^[a-zé]+(-[a-z]+)?$/.test(w)) badWords++;
    }
  }
  t.eq([selfPairs, dupPairs, dupAlts, badWords], [0, 0, 0, 0], 'no self pairs, duplicate pairs, repeated alternatives or odd spellings');
  const symOk = rels.filter((r) => r.sym).every((r) => r.pairs.every((p) => p.alts.every((x) => H.inRel(r.id, x, p.a))));
  t.ok(symOk, 'symmetric relations hold both ways');
  for (const tier of [0, 1, 2]) t.ok(rels.some((r) => r.tier === tier), `tier ${tier} has relations`);

  t.section('wordlinks: fallback');
  const combos = PX.ex.enumerate(def);
  t.eq(combos.length, 27, '3 × 3 × 3 levels');
  for (const p of combos) {
    const f = H.fallback(1, p);
    t.ok(f && def.validate(f) === true, `fallback valid at ${PX.ex.paramsKey(p)}`);
  }

  t.section('wordlinks: 10 000 seeds');
  let fallbacks = 0, roundTrip = 0, malformed = 0, synonyms = 0, firstSyn = null, inflectedFoils = 0, firstInfl = null;
  // Independent of gen.js: two options are interchangeable when one relation of the table pairs
  // both with the same word on the same side (den and lair for bear; alternatives of one pair).
  const same = new Map();
  for (const r of rels) {
    for (const [a, xs] of Object.entries(r.valid)) {
      for (const x of Object.keys(xs)) {
        for (const [w, slot] of [[x, `${r.id}>${a}`], [a, `${r.id}<${x}`]]) {
          if (!same.has(w)) same.set(w, new Set());
          same.get(w).add(slot);
        }
      }
    }
  }
  const hasSynonymPair = (item) => item.options.some((x, i) => i !== item.key && item.options.some((y, j) => j > i && j !== item.key && [...(same.get(x) || [])].some((k) => (same.get(y) || new Set()).has(k))));
  let n = 0, threw = 0, invalid = 0, keyWrong = 0, otherRight = 0, nondet = 0, firstBad = null;
  const times = [], walls = [], keyPos = [0, 0, 0, 0], relUse = {}, cd = {};
  const sc = { assoc: 0, longest: 0, shortest: 0, alike: 0 }, byLevel = {};
  const forms = [{}, {}, {}];
  for (const p of combos) {
    const lv = PX.ex.paramsKey(p);
    const L = byLevel[lv] = { n: 0, assoc: 0, longest: 0, shortest: 0, alike: 0 };
    cd[lv] = new Set();
    for (let s = 0; s < SEEDS_PER_COMBO; s++) {
      const seed = PX.rng.hash('pr0', lv, s);
      let item;
      const t0 = performance.now(), c0 = process.cpuUsage();
      try { item = def.generate(PX.rng(seed), p); } catch (e) { threw++; firstBad = firstBad || `${lv} seed ${seed}: ${e.message}`; continue; }
      const cu = process.cpuUsage(c0);
      times.push((cu.user + cu.system) / 1000); walls.push(performance.now() - t0);
      n++;
      const v = def.validate(item);
      if (v !== true) { invalid++; firstBad = firstBad || `${lv} seed ${seed}: ${v}`; continue; }
      if (!def.score(item, item.key).correct) keyWrong++;
      for (let i = 0; i < 4; i++) if (i !== item.key && def.score(item, i).correct) otherRight++;
      if (s % 8 === 0 && JSON.stringify(def.generate(PX.rng(seed), p)) !== JSON.stringify(item)) nondet++;

      if (item.fallback) fallbacks++;
      if (s % 8 === 1) {
        const back = JSON.parse(JSON.stringify(item));
        if (def.validate(back) !== true || !def.score(back, back.key).correct) roundTrip++;
        for (const bad of [null, undefined, 'x', -1, 99, 1.5, {}, [item.key], String(item.key)]) {
          try { if (def.score(item, bad).correct) malformed++; } catch (e) { malformed++; }
        }
      }
      if (hasSynonymPair(item)) { synonyms++; firstSyn = firstSyn || `${lv} seed ${seed}: ${item.options.join(', ')}`; }
      // No foil is the plural or singular of a right answer (e.g. "angles" when "angle" is right).
      const rightHere = Object.keys(ix.rels[item.relation].valid[item.c] || {});
      const inflected = (u, v) => u === v + 's' || v === u + 's' || u === v + 'es' || v === u + 'es';
      if (item.options.some((f, i) => i !== item.key && rightHere.some((w) => inflected(w, f)))) { inflectedFoils++; firstInfl = firstInfl || `${lv} seed ${seed}: ${item.c} → ${item.options.join(', ')}`; }
      keyPos[item.key]++;
      relUse[item.relation] = (relUse[item.relation] || 0) + 1;
      const f = forms[s % 3];
      f[item.relation] = (f[item.relation] || 0) + 1;
      cd[lv].add(item.c + ':' + item.options[item.key]);
      L.n++;
      for (const k of Object.keys(sc)) { const c = H.shortcuts[k](item); sc[k] += c; L[k] += c; }
    }
  }
  t.ok(n >= 10000, `at least 10 000 items (got ${n})`);
  t.eq(threw, 0, 'generate never throws' + (firstBad ? ` (${firstBad})` : ''));
  t.eq(invalid, 0, 'validate passes on every item' + (firstBad ? ` (${firstBad})` : ''));
  t.eq(keyWrong, 0, 'the key scores right');
  t.eq(otherRight, 0, 'every other option scores wrong');
  t.eq(nondet, 0, 'same seed → same item');
  t.eq(inflectedFoils, 0, 'no foil is the plural or singular of a right answer' + (firstInfl ? ` (${firstInfl})` : ''));
  t.eq(synonyms, 0, 'no item has two interchangeable foils (e.g. den and lair, both a bear\'s home)' + (firstSyn ? ` (${firstSyn})` : ''));
  {
    const it = def.generate(PX.rng(2201), { relation: 0, words: 0, foils: 0 });
    t.ok(!hasSynonymPair(it) && def.validate(it) === true, `the reviewed item (seed 2201, concrete/common/loose) has no interchangeable foils (${it.options.join(', ')})`);
    t.ok(H.interchangeable('den', 'lair') && H.interchangeable('bark', 'growl') && !H.interchangeable('den', 'bark'), 'interchangeable(): den ~ lair, bark ~ growl, den ≁ bark');
  }
  // CPU time per item is asserted; wall time on a shared machine is reported only.
  times.sort((a, b) => a - b); walls.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)], p95w = walls[Math.floor(walls.length * 0.95)];
  t.ok(p95 < 20, `generation p95 < 20 ms CPU (${p95.toFixed(2)} ms; wall ${p95w.toFixed(2)} ms)`);
  t.ok(keyPos.every((c) => Math.abs(c / n - 0.25) < 0.02), `key position uniform (${keyPos.map((c) => (100 * c / n).toFixed(1)).join(' / ')} %)`);
  t.ok(rels.every((r) => r.tier < 0 || relUse[r.id] > 0), 'every relation type appears in the pool (link-only relations excepted)');
  t.ok(rels.filter((r) => r.tier >= 0).length >= 12, 'at least 12 relation types are asked about');

  t.section('wordlinks: shortcut solvers');
  const lim = 0.25 + 0.10;
  const pct = (x) => (100 * x).toFixed(1);
  for (const k of Object.keys(sc)) {
    const acc = sc[k] / n;
    const worst = Math.max(...Object.values(byLevel).map((L) => L[k] / L.n));
    t.ok(acc <= lim, `${k}: ${pct(acc)} % over the pool ≤ chance + 10 (worst level ${pct(worst)} %)`);
  }


  t.section('wordlinks: learn data and limits');
  {
    const L = PX.ex.learn('wordlinks');
    t.ok(L && typeof L.goal === 'string' && Array.isArray(L.instruction) && L.instruction.length >= 2, 'learn: goal and a one-screen instruction');
    t.ok(L && Array.isArray(L.parts) && L.parts.length >= 2 && L.parts.every((x) => x.id && x.label && x.text), 'learn: labelled parts');
    t.ok(L && Array.isArray(L.demo) && L.demo.length >= 1, 'learn: a worked example');
    for (const d of (L && L.demo) || []) {
      t.ok(PX.ex.validParams(def, d.params) === true, `learn: example params valid (${JSON.stringify(d.params)})`);
      const it = def.generate(PX.rng(d.seed), d.params);
      t.ok(def.validate(it) === true && !it.fallback, 'learn: the example seed gives a valid item');
      t.eq(it.relation, d.kind, 'learn: the example seed gives the stated item');
    }
    t.ok(!/\bIQ\b|smarter|mastered|genius|brain age/i.test(JSON.stringify(L)), 'learn: wording rules (no IQ, smarter, mastered)');
    t.ok(combos.every((p) => { const ms = def.timeLimit(p); return Number.isFinite(ms) && ms >= 10000 && ms <= 60000; }), 'every level has an item time limit of 10–60 s');
    t.eq(fallbacks, 0, 'no fallback items over the seeds');
    t.eq(roundTrip, 0, 'items survive a JSON round trip (validate, key right)');
    t.eq(malformed, 0, 'malformed responses score wrong without throwing');
  }

  t.section('wordlinks: forms and spread');
  // Alternate forms (seed blocks) draw the relations in the same proportions.
  let worstShare = 0;
  for (const r of rels) {
    const sh = forms.map((f) => (f[r.id] || 0) / (n / 3));
    worstShare = Math.max(worstShare, Math.max(...sh) - Math.min(...sh));
  }
  t.ok(worstShare < 0.02, `relation shares agree across forms within 2 points (worst ${pct(worstShare)})`);
  const variety = Math.min(...Object.values(cd).map((s) => s.size));
  t.ok(variety >= 8, `every level draws on at least 8 different C:key pairs (fewest ${variety})`);
  const bs = combos.map((p) => def.difficulty(p));
  const lo = Math.min(...bs), hi = Math.max(...bs), bins = new Array(Math.ceil((hi - lo) / 0.5 + 1e-9)).fill(0);
  for (const b of bs) bins[Math.min(bins.length - 1, Math.floor((b - lo) / 0.5))]++;
  t.ok(bins.every((x) => x > 0), `every 0.5-logit bin from ${lo.toFixed(2)} to ${hi.toFixed(2)} has items: [${bins.join(' ')}]`);
  const worstOf = (k) => pct(Math.max(...Object.values(byLevel).map((L) => L[k] / L.n)));
  console.log(`       wordlinks: worst level assoc ${worstOf("assoc")} %, longest ${worstOf("longest")} %, shortest ${worstOf("shortest")} %, alike ${worstOf("alike")} %`);
  console.log(`       wordlinks: ${ix.nPairs} pairs in ${rels.length} relations; ${n} items, p95 ${p95.toFixed(2)} ms; shortcuts assoc ${pct(sc.assoc / n)} %, longest ${pct(sc.longest / n)} %, alike ${pct(sc.alike / n)} %; fewest C:key per level ${variety}; bins [${bins.join(' ')}]`);
}
