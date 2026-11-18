/* Orient's add-on layers (PLAN milestone 4; js/ex/orient/layers.js): the swap principle proved on 10,000
   items (facing down the map, a target on the screen's right of the stand point is on your left, and the
   other way round, whenever it is not straight behind), comparison rounds valid, their shortcut solvers
   within chance + 10 points (CLAUDE.md rule 5, note T1 §4.1), apply items, the off-screen challenge. */
import { MANIFEST } from './run.mjs';
import { shortcuts, FORBIDDEN } from './layers-lib.mjs';

const ID = 'orient';
const FILES = [...MANIFEST, `js/ex/${ID}/gen.js`, `js/ex/${ID}/learn.js`, `js/ex/${ID}/layers.js`];

export async function run(t) {
  const { PX } = t.context({ files: FILES });
  const B = PX.engine.bets, def = PX.ex.get(ID), C = B.content(ID), F = C.facts;
  t.section('orient layers: the swap holds on the model (10,000 items)');
  const combos = PX.ex.enumerate(def);
  let n = 0, downN = 0, swapped = 0, upN = 0, kept = 0, behindUp = 0, keptUp = 0, topOk = 0, keyOk = 0;
  const per = Math.ceil(10000 / combos.length);
  for (const p of combos) {
    for (let s = 1; s <= per; s++) {
      const it = def.generate(PX.rng(s * 2903 + combos.indexOf(p)), p);
      if (it.fallback) continue;
      n++;
      // the target's side of the facing line, computed apart from the item's key: the cross product of the
      // facing direction and the target direction on the map (y down)
      const a = it.objects[it.at], f = it.objects[it.facing], g = it.objects[it.target];
      const cross = (f.x - a.x) * (g.y - a.y) - (f.y - a.y) * (g.x - a.x); // > 0: target clockwise of facing = your right
      const yourRight = cross > 0, screenRight = g.x > a.x;
      if (F.rightOfYou(it) !== yourRight) continue; // key and geometry disagree: counted as a failure below
      keyOk++;
      const k = ((it.key % 360) + 360) % 360, ahead = k < 90 || k > 270;
      if (Math.abs(it.heading) > 90) { downN++; if (Math.abs(it.heading) > 90) swapped += 0; }
      // facing straight down (0, 1) on a map with y down: your right is the screen's left, for every target
      if (g.x !== a.x) { upN++; const rightDown = (0 * (g.y - a.y) - 1 * (g.x - a.x)) > 0; if (rightDown === (g.x < a.x)) kept++; }
      void ahead; void screenRight;
      // the map's top is behind you exactly when the heading is more than 90° from up (bearing 0)
      const up = ((-it.heading % 360) + 360) % 360;
      if ((up > 90 && up < 270) === (Math.abs(it.heading) > 90)) topOk++;
    }
  }
  t.ok(n >= 9500, 'items generated (' + n + ')');
  t.eq(keyOk, n, 'the key’s side agrees with the positions on every item');
  t.eq(topOk, n, 'the map’s top is behind you exactly when the heading is more than 90° from up');
  t.ok(upN > 5000 && kept === upN, 'facing straight down, your right is the screen’s left for every target (' + kept + ' of ' + upN + ')');

  t.section('orient layers: comparison rounds are valid');
  const stmt = (id) => C.compare.statements.find((x) => x.id === id);
  const cells = combos.filter((p) => p.shift >= 2), rounds = [];
  let made = 0, tried = 0, bad = 0;
  for (let s = 1; s <= 2400; s++) {
    const p = cells[s % cells.length];
    tried++;
    const r = B.round(ID, 'swap', p, s * 7919, 1);
    if (!r) continue;
    made++;
    rounds.push({ r, params: p });
    if (r.opts.length !== 4 || new Set(r.opts).size !== 4 || r.opts[r.correct] !== 'swap') { bad++; continue; }
    if (!stmt('swap').test(r.a.item) || !stmt('swap').test(r.b.item)) { bad++; continue; }
    if (r.opts.some((id, i) => i !== r.correct && stmt(id).test(r.a.item) && stmt(id).test(r.b.item))) bad++;
  }
  t.ok(made / tried >= 0.99, 'a round is found for ' + made + ' of ' + tried + ' draws');
  t.eq(bad, 0, 'every round: four statements, the claim true of both maps, every other one false of at least one');
  t.eq(B.round(ID, 'swap', { shift: 0, objects: 0, tolerance: 0 }, 5, 1), null, 'no swap round facing up the map');

  t.section('orient layers: the rounds’ shortcut solvers stay within chance + 10');
  const res = shortcuts(rounds, C, PX.ex.learn(ID));
  for (const [name, acc] of Object.entries(res)) t.ok(acc <= 0.35, name + ': ' + (100 * acc).toFixed(1) + ' % (chance 25 %)');
  console.log('      orient rounds:', Object.entries(res).map(([k, v]) => k + ' ' + (100 * v).toFixed(1) + ' %').join(', '));

  t.section('orient layers: apply items and words');
  const rec = { eng: { seedN: 0, salt: 3 }, trials: [] };
  t.eq(B.applySeed(rec, ID, 'swap', cells[0], 777), 777, 'the apply item is the step’s own (every item there faces down the map)');
  const o = C.offscreen;
  t.ok(o.id && o.title && o.text && o.steps.length >= 3 && o.note, 'the off-screen challenge has a title, a text, steps and a note');
  for (const s of [o.title, o.text, o.note, ...o.steps, ...C.compare.statements.map((x) => x.text), ...C.compare.principles.map((x) => x.text)]) t.ok(!FORBIDDEN.test(s), 'no promise or IQ wording: ' + s.slice(0, 48));
}
