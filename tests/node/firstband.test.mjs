/* The first band (PLAN milestone 1 acceptance; note D2 §3.8–3.9 item 2): on the real definitions,
   simulated beginners play one pinned 10-minute Train session each (the test suite's Learner).
   A is the population's mean starting ability above the PRE-1.2 floor (E.rebase.V11, the 1.1
   ranges), so "A = 0" is the same people before and after the band.
     (a) Views, Painted Cubes, Openings, Form, Missing View: A = 0 averages 74–84 % right over the
         first 10 rated items;
     (b) Angles and Hole Punch: at least 66 %;
     (c) A = +1.75 reaches the pre-1.2 floor by its 10th rated item (median);
     (d) among an exercise's first 10 rated answers a stretch item moves one setting only from the
         item before it (note D2 §3.0 B2's alternative: each new feature arrives alone).
   An exercise whose band has not landed yet (no def.starters) is reported as pending for (a)–(c). */
import { Learner, newRecord, playSession } from './fixtures/learner.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 19, 17, 0, 0);
const FIVE = ['views', 'cubes', 'openings', 'form', 'patviews'];
const TWO = ['angles', 'patfold'];
const N0 = 160, N1 = 100;

function median(a) { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; }

// One cell: `n` learners at A above the pre-1.2 floor, one pinned session each.
function cell(PX, def, A, n, salt) {
  const E = PX.engine, old = E.rebase.V11[def.id], floorNow = PX.ex.minDifficulty(def);
  let right = 0, items = 0, stretch = 0, badStretch = 0;
  const reach = [];
  for (let i = 0; i < n; i++) {
    const L = new Learner(PX, PX.rng.hash('firstband', def.id, salt, i), { aboveFloor: A + (old[0] - floorNow) });
    const rec = newRecord(PX, T0 - DAY, { patFocus: true });
    rec.settings.patFocus = true;
    const now = T0 + i * 7919 * 1000; // vary the deck order between learners (note D2 §3.9)
    const r = playSession(PX, rec, L, 'train', { now, pin: def.id, minutes: 10 }, 0);
    const all = r.steps.filter((x) => x.step.exId === def.id), mine = all.filter((x) => x.out.rated).slice(0, 10);
    mine.forEach((x) => {
      items++;
      if (x.res.correct) right++;
      if (x.step.kind === 'stretch') { badStretch++; return; } // a full stretch never comes early
      if (x.step.kind !== 'stretch1') return;
      stretch++;
      const prev = all[all.indexOf(x) - 1];
      let moved = 0;
      if (prev) { def.dims.forEach((d) => { if (prev.step.params[d.key] !== x.step.params[d.key]) moved++; }); if (def.variants && prev.step.params.variant !== x.step.params.variant) moved++; }
      if (!prev || moved > 1) badStretch++;
    });
    const at = mine.findIndex((x) => x.step.b >= old[0] - 1e-9);
    reach.push(at < 0 ? Infinity : at + 1);
  }
  return { acc: items ? right / items : NaN, items, stretch, badStretch, reachMedian: median(reach) };
}

export async function run(t) {
  const PX = t.PX, E = PX.engine;
  const report = [];
  t.section('first band: simulated beginners on the real definitions');
  for (const id of [...FIVE, ...TWO]) {
    const def = PX.ex.get(id);
    if (!def) { t.ok(false, id + ' is not defined'); continue; }
    const old = E.rebase.V11[id];
    const band = def.starters && def.starters.length > 0 && PX.ex.minDifficulty(def) < old[0] - 0.1;
    const c0 = cell(PX, def, 0, band ? N0 : 40, 'a0');
    t.eq(c0.badStretch, 0, id + ': early stretch items move one setting only (d; ' + c0.stretch + ' early stretches)');
    if (!band) {
      report.push(id + ': band pending (floor ' + PX.ex.minDifficulty(def).toFixed(2) + ', 1.1 floor ' + old[0] + '); A=0 ' + (100 * c0.acc).toFixed(1) + ' % today');
      t.ok(true, id + ': band pending');
      continue;
    }
    const c1 = cell(PX, def, 1.75, N1, 'a175');
    report.push(id + ': floor ' + old[0] + ' → ' + PX.ex.minDifficulty(def).toFixed(2) + '; A=0 ' + (100 * c0.acc).toFixed(1) + ' %; A=+1.75 reaches the old floor at item ' + c1.reachMedian + ' (median)');
    if (FIVE.includes(id)) t.ok(c0.acc >= 0.74 && c0.acc <= 0.84, id + ': A = 0 averages 74–84 % over the first 10 rated items (a): ' + (100 * c0.acc).toFixed(1) + ' %');
    else t.ok(c0.acc >= 0.66, id + ': A = 0 averages at least 66 % (b): ' + (100 * c0.acc).toFixed(1) + ' %');
    t.ok(c1.reachMedian <= 10, id + ': A = +1.75 reaches the pre-1.2 floor by item 10, median (c): ' + c1.reachMedian);
  }
  console.log('      firstband: ' + report.join(' | '));
}
