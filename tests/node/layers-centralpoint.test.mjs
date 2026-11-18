/* Central Point's add-on layers (PLAN milestone 4; js/ex/centralpoint/layers.js): the principles' sentences
   proved on the model over 10,000 rated items, comparison rounds valid (the claim true of both items, every
   other statement offered false of at least one), the rounds' shortcut solvers within chance + 10 points
   (fixed position, longest statement, most words shared with the item's tips; CLAUDE.md rule 5, note T1
   §4.1), apply items, and the off-screen challenge's words. */
import { MANIFEST } from './run.mjs';
import { shortcuts, FORBIDDEN } from './layers-lib.mjs';

const ID = 'centralpoint';
const FILES = [...MANIFEST, `js/ex/${ID}/gen.js`, `js/ex/${ID}/learn.js`, `js/ex/${ID}/layers.js`];

export async function run(t) {
  const { PX } = t.context({ files: FILES });
  const B = PX.engine.bets, def = PX.ex.get(ID), C = B.content(ID);
  t.section('centralpoint layers: registered');
  t.ok(!!C && !!C.compare && !!C.offscreen, 'content registered: rounds and an off-screen challenge');
  const F = C.facts;

  t.section('centralpoint layers: the principles hold on the model (10,000 rated items)');
  const cells = [];
  for (let targets = 0; targets <= 4; targets++) for (let band = 0; band <= 2; band++) cells.push({ variant: 'quick', targets, band });
  let n = 0, pulls = 0, cross4 = 0, n4 = 0, cross5 = 0, onT = 0, maxSum = 0;
  const per = Math.ceil(10000 / cells.length);
  for (const p of cells) {
    for (let s = 1; s <= per; s++) {
      const it = def.generate(PX.rng(s * 7919 + p.targets * 31 + p.band), p);
      if (it.fallback) continue;
      n++;
      const sum = F.pullSum(it.targets, it.gm);
      if (sum !== null && sum > maxSum) maxSum = sum;
      if (F.equalPulls(it)) pulls++;
      if (it.targets.length === 4) { n4++; if (F.crossing(it)) cross4++; } else if (F.crossing(it)) cross5++;
      if (it.targets.some((q) => q[0] === it.key.x && q[1] === it.key.y)) onT++;
    }
  }
  t.ok(n >= 9500, 'items generated (' + n + ')');
  t.eq(pulls, n, 'equal pulls: the unit pulls cancel at the best spot on every item (largest leftover ' + maxSum.toExponential(1) + ')');
  t.eq(cross4, n4, 'four targets: the lines joining opposite targets cross at the best spot on every one (' + n4 + ')');
  t.eq(cross5, 0, 'with five or more targets the crossing statement is never true');
  t.eq(onT, 0, 'the best spot is never on a target (so "on a target" is false on every rated item)');

  t.section('centralpoint layers: comparison rounds are valid');
  const rounds = [];
  let made = 0, tried = 0;
  for (const pid of ['equal-pulls', 'crossing']) {
    for (const p of cells) {
      if (pid === 'crossing' && p.targets !== 0) continue;
      const k = pid === 'crossing' ? 400 : 100;
      for (let s = 1; s <= k; s++) {
        tried++;
        const stage = s % 3 === 0 && pid === 'equal-pulls' ? 2 : 1;
        const r = B.round(ID, pid, p, s * 104729 + p.band, stage);
        if (!r) continue;
        made++;
        rounds.push({ r, params: p });
      }
    }
  }
  t.ok(made / tried >= 0.99, 'a round is found for ' + made + ' of ' + tried + ' draws');
  const stmt = (id) => C.compare.statements.find((x) => x.id === id);
  let bad = 0;
  for (const { r } of rounds) {
    const claim = C.compare.principles.find((x) => x.id === r.principle).claim;
    if (r.opts.length !== 4 || new Set(r.opts).size !== 4 || r.opts[r.correct] !== claim) { bad++; continue; }
    if (!stmt(claim).test(r.a.item) || !stmt(claim).test(r.b.item)) { bad++; continue; }
    if (r.opts.some((id, i) => i !== r.correct && stmt(id).test(r.a.item) && stmt(id).test(r.b.item))) bad++;
    if (r.a.seed === r.b.seed) bad++;
  }
  t.eq(bad, 0, 'every round: four statements, the claim true of both items, every other one false of at least one');
  const stage2 = rounds.filter(({ r }) => r.stage === 2 && r.a.params.targets !== r.b.params.targets).length;
  t.ok(stage2 > 0, 'stage 2 pairs differ in their settings (' + stage2 + ')');

  t.section('centralpoint layers: the rounds’ shortcut solvers stay within chance + 10');
  const L = PX.ex.learn(ID);
  const res = shortcuts(rounds.map(({ r, params }) => ({ r, params })), C, L);
  t.ok(rounds.length >= 2000, 'at least 2,000 rounds (' + rounds.length + ')');
  for (const [name, acc] of Object.entries(res)) t.ok(acc <= 0.35, name + ': ' + (100 * acc).toFixed(1) + ' % (chance 25 %)');
  console.log('      centralpoint rounds:', Object.entries(res).map(([k, v]) => k + ' ' + (100 * v).toFixed(1) + ' %').join(', '));

  t.section('centralpoint layers: apply items');
  const rec = { eng: { seedN: 0, salt: 12345 }, trials: [] };
  t.eq(B.applySeed(rec, ID, 'equal-pulls', { variant: 'quick', targets: 2, band: 1 }, 777), 777, 'equal pulls: the step’s own item (every item shows it)');
  let found = 0;
  for (let s = 1; s <= 40; s++) {
    const sd = B.applySeed(rec, ID, 'crossing', { variant: 'quick', targets: 0, band: s % 3 }, s);
    if (sd !== null && stmt('crossing').test(def.generate(PX.rng(sd), { variant: 'quick', targets: 0, band: s % 3 }))) found++;
  }
  t.eq(found, 40, 'crossing: a four-target item that shows it, every time');
  t.eq(B.applySeed(rec, ID, 'crossing', { variant: 'quick', targets: 2, band: 0 }, 5), null, 'crossing does not apply to six targets');

  t.section('centralpoint layers: words');
  const o = C.offscreen;
  t.ok(o.id && o.title && o.text && o.steps.length >= 3 && o.note, 'the off-screen challenge has a title, a text, steps and a note');
  for (const s of [o.title, o.text, o.note, ...o.steps, ...C.compare.statements.map((x) => x.text), ...C.compare.principles.map((x) => x.text)]) {
    t.ok(!FORBIDDEN.test(s), 'no promise or IQ wording: ' + s.slice(0, 48));
  }
  t.ok(![o.text, ...o.steps, ...C.compare.statements.map((x) => x.text), ...C.compare.principles.map((x) => x.text)].some((s) => /average|centre of (mass|gravity)/i.test(s)), 'no round or challenge names the average position (the Balance check stays untrained)');
}
