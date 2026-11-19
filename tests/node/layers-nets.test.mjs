/* Nets' add-on layers (PLAN milestone 4; js/ex/nets/layers.js): the principles proved on every net of
   10,000 items (whenever two squares are the ends of a Z of four, their rolled faces are opposite; whenever
   two marked edges run along a concave corner, they meet), every scored opposite item with two faces
   between decided by the Z rule, comparison rounds valid, their shortcut solvers within chance + 10 points
   (CLAUDE.md rule 5, note T1 §4.1), apply items and words. */
import { MANIFEST } from './run.mjs';
import { shortcuts, FORBIDDEN } from './layers-lib.mjs';

const ID = 'nets';
const FILES = [...MANIFEST, `js/ex/${ID}/gen.js`, `js/ex/${ID}/learn.js`, `js/ex/${ID}/layers.js`];
const OPP = { B: 'T', T: 'B', N: 'S', S: 'N', E: 'W', W: 'E' };

export async function run(t) {
  const { PX } = t.context({ files: FILES });
  const B = PX.engine.bets, def = PX.ex.get(ID), C = B.content(ID), F = C.facts;
  t.section('nets layers: the principles hold on the model (10,000 items)');
  const combos = PX.ex.enumerate(def);
  let n = 0, zPairs = 0, zOpp = 0, d3 = 0, d3z = 0, corners = 0, cornerMeet = 0;
  const per = Math.ceil(10000 / combos.length);
  for (const p of combos) {
    for (let s = 1; s <= per; s++) {
      const it = def.generate(PX.rng(s * 4099 + combos.indexOf(p)), p);
      if (it.fallback) continue;
      n++;
      const sq = it.squares;
      if (sq.every((q) => q.face) && (it.variant !== 'cube' || it.isNet)) { // a net (not one of the other hexominoes): every pair
        for (let a = 0; a < 6; a++) for (let d = 0; d < 6; d++) {
          if (a === d || !F.zPath(sq, a, d)) continue;
          zPairs++;
          if (OPP[sq[a].face] === sq[d].face) zOpp++;
        }
      }
      if (it.variant === 'opposite' && it.info.d === 3) { d3++; if (F.zPath(sq, it.marked, F.opposite(it))) d3z++; }
      if (it.variant === 'edges' && F.cornerOf(it)) { corners++; if (it.key === 0) cornerMeet++; }
    }
  }
  t.ok(n >= 9500, 'items generated (' + n + ')');
  t.ok(zPairs > 1000 && zOpp === zPairs, 'every pair at the ends of a Z of four lands opposite (' + zOpp + ' of ' + zPairs + ' pairs)');
  t.ok(d3 > 100 && d3z === d3, 'every scored opposite item with two faces between is a Z (' + d3z + ' of ' + d3 + ')');
  t.ok(corners > 20 && cornerMeet === corners, 'edges along a concave corner always meet (' + cornerMeet + ' of ' + corners + ')'); // > 20: since 19 Nov concave corners are a tenth of the first squares-carried level's yes pairs (gen.js NOTCH_SHARE)

  t.section('nets layers: comparison rounds are valid');
  const stmt = (id) => C.compare.statements.find((x) => x.id === id);
  const rounds = [];
  let made = 0, tried = 0, bad = 0;
  const cells = combos.filter((p) => p.variant === 'opposite' && p.between === 0);
  t.ok(cells.length > 0, 'the Z rule has cells (' + cells.length + ')');
  for (let s = 1; s <= 2400; s++) {
    const p = cells[s % cells.length];
    tried++;
    const r = B.round(ID, 'z-ends', p, s * 7919, 1);
    if (!r) continue;
    made++;
    rounds.push({ r, params: p });
    if (r.opts.length !== 4 || new Set(r.opts).size !== 4 || r.opts[r.correct] !== 'z-ends') { bad++; continue; }
    if (!stmt('z-ends').test(r.a.item) || !stmt('z-ends').test(r.b.item)) { bad++; continue; }
    if (r.opts.some((id, i) => i !== r.correct && stmt(id).test(r.a.item) && stmt(id).test(r.b.item))) bad++;
  }
  t.ok(made / tried >= 0.99, 'a round is found for ' + made + ' of ' + tried + ' draws');
  t.eq(bad, 0, 'every round: four statements, the claim true of both nets, every other one false of at least one');
  t.eq(B.round(ID, 'z-ends', { variant: 'opposite', between: 1, shape: 0 }, 5, 1), null, 'no Z round where three faces lie between');

  t.section('nets layers: the rounds’ shortcut solvers stay within chance + 10');
  const res = shortcuts(rounds, C, PX.ex.learn(ID));
  for (const [name, acc] of Object.entries(res)) t.ok(acc <= 0.35, name + ': ' + (100 * acc).toFixed(1) + ' % (chance 25 %)');
  console.log('      nets rounds:', Object.entries(res).map(([k, v]) => k + ' ' + (100 * v).toFixed(1) + ' %').join(', '));

  t.section('nets layers: apply items and words');
  const rec = { eng: { seedN: 0, salt: 5 }, trials: [] };
  t.eq(B.applySeed(rec, ID, 'z-ends', cells[0], 31337), 31337, 'the apply item is the step’s own (every such item is decided by the rule)');
  t.eq(B.applySeed(rec, ID, 'z-ends', { variant: 'edges', carried: 0, shape: 0 }, 9), null, 'none for an edges item');
  for (const s of [...C.compare.statements.map((x) => x.text), ...C.compare.principles.map((x) => x.text)]) t.ok(!FORBIDDEN.test(s), 'no promise or IQ wording: ' + s.slice(0, 48));
}
