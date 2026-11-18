/* Spin's add-on layers (PLAN milestone 4; js/ex/spin/layers.js): the principle proved on the model over
   10,000 items (every figure chiral; a mirror option turned back by its turn is the reference reflected,
   never the reference), comparison rounds valid, their shortcut solvers within chance + 10 points
   (CLAUDE.md rule 5, note T1 §4.1), the apply item, the words. */
import { MANIFEST } from './run.mjs';
import { shortcuts, FORBIDDEN } from './layers-lib.mjs';

const ID = 'spin';
const FILES = [...MANIFEST, `js/ex/${ID}/gen.js`, `js/ex/${ID}/learn.js`, `js/ex/${ID}/layers.js`];

export async function run(t) {
  const { PX } = t.context({ files: FILES });
  const B = PX.engine.bets, def = PX.ex.get(ID), C = B.content(ID), lib = def.lib;
  t.section('spin layers: the principle holds on the model (10,000 items)');
  const combos = PX.ex.enumerate(def);
  // Written apart from the generator: cells read back from each drawn polygon (lib.cellsFromPoly turns it
  // back to the lattice), then turns and a reflection of our own and a key of our own.
  const key = (cells) => { const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]), mx = Math.min(...xs), my = Math.min(...ys); return cells.map((c) => (c[0] - mx) + ',' + (c[1] - my)).sort().join(';'); };
  const quarter = (cells) => cells.map((c) => [-c[1], c[0]]);
  const turns = (cells) => { const out = []; let c = cells; for (let k = 0; k < 4; k++) { out.push(key(c)); c = quarter(c); } return out; };
  const flip = (cells) => cells.map((c) => [-c[0], c[1]]);
  const read = (poly) => { const g = lib.cellsFromPoly(poly); return typeof g === 'string' ? null : g.cells; };
  let n = 0, chiral = 0, mirrorOk = 0, mirrorsSeen = 0;
  const per = Math.ceil(10000 / combos.length);
  for (const p of combos) {
    for (let s = 1; s <= per; s++) {
      const it = def.generate(PX.rng(s * 6151 + p.angle * 17 + p.cells), p);
      if (it.fallback) continue;
      n++;
      const R = read(it.ref.poly);
      if (!R) continue;
      const tR = turns(R), tF = turns(flip(R));
      if (!tR.some((k) => tF.includes(k))) chiral++;
      for (const m of C.facts.mirrors(it)) {
        mirrorsSeen++;
        const M = read(m.poly);
        if (M && tF.includes(key(M)) && !tR.includes(key(M))) mirrorOk++;
      }
    }
  }
  t.ok(n >= 9500, 'items generated (' + n + ')');
  t.eq(chiral, n, 'every shape is chiral: its eight lattice forms differ, so no turn maps it onto its mirror image');
  t.eq(mirrorOk, mirrorsSeen, 'every mirror figure is a turn of the reflected shape and of no turn of the shape (' + mirrorsSeen + ')');

  t.section('spin layers: comparison rounds are valid');
  const rounds = [];
  let made = 0, tried = 0, bad = 0;
  const stmt = (id) => C.compare.statements.find((x) => x.id === id);
  for (let s = 1; s <= 2400; s++) {
    const p = combos[(s * 7) % combos.length];
    tried++;
    const r = B.round(ID, 'mirror-never', p, s * 7919, s % 3 === 0 ? 2 : 1);
    if (!r) continue;
    made++;
    rounds.push({ r, params: p });
    if (r.opts.length !== 4 || new Set(r.opts).size !== 4 || r.opts[r.correct] !== 'mirror-never') { bad++; continue; }
    if (!stmt('mirror-never').test(r.a.item) || !stmt('mirror-never').test(r.b.item)) { bad++; continue; }
    if (r.opts.some((id, i) => i !== r.correct && stmt(id).test(r.a.item) && stmt(id).test(r.b.item))) bad++;
  }
  t.ok(made / tried >= 0.99, 'a round is found for ' + made + ' of ' + tried + ' draws');
  t.eq(bad, 0, 'every round: four statements, the claim true of both items, every other one false of at least one');

  t.section('spin layers: the rounds’ shortcut solvers stay within chance + 10');
  const res = shortcuts(rounds, C, PX.ex.learn(ID));
  for (const [name, acc] of Object.entries(res)) t.ok(acc <= 0.35, name + ': ' + (100 * acc).toFixed(1) + ' % (chance 25 %)');
  console.log('      spin rounds:', Object.entries(res).map(([k, v]) => k + ' ' + (100 * v).toFixed(1) + ' %').join(', '));

  t.section('spin layers: apply items and words');
  const rec = { eng: { seedN: 0, salt: 99 }, trials: [] };
  t.eq(B.applySeed(rec, ID, 'mirror-never', { angle: 3, cells: 1, variant: 'samediff' }, 4242), 4242, 'the apply item is the step’s own (no "mirror" given away)');
  for (const s of [...C.compare.statements.map((x) => x.text), ...C.compare.principles.map((x) => x.text)]) t.ok(!FORBIDDEN.test(s), 'no promise or IQ wording: ' + s.slice(0, 48));
}
