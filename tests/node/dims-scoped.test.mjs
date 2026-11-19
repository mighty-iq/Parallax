/* Leading and fluency items (PLAN milestone 7) never land on a scoped shortcut cell (E.dims.scoped; CLAUDE.md
   rule 5; DECISIONS 2026-11-19, W2-progress and W3-misc). Many Train sessions of simulated learners on the real
   exercises that Train deals and that have such cells (Nets, Slice, Fold, Painted Cubes, Homing; Cube Match and
   Pattern Memory are probes, never trained, so they get no leading item): first as sessions come, then under a
   plateau change that replaces the pick filter after dims' own hook (a wider mix; a variant swap), then with a
   later hook that steers leading items into the cells (modes' fallback, which drops every filter, would deal
   them), and once without the last pick hook (dims.scoped) to show what it guards. Every lead and fluency item is
   checked on its params and its seed (E.dims.isScoped). */
import { Learner, newRecord, playSession } from './fixtures/learner.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 16, 18, 0, 0); // Monday 16 Nov 2026
const TRAINED = ['nets', 'slice', 'fold', 'cubes', 'homing'];

export async function run(t) {
  units(t);
  plain(t);
  plateauChanges(t);
  steered(t);
}

// A plateau change in its trial period for the exercise (the shape plateau.fire writes), kept open: its trial
// never ends, and it is the exercise's latest event. The detector is off in these contexts (minSessions).
function openChange(rec, exId, change, detail, at) {
  if (!rec.plateau || !Array.isArray(rec.plateau.list)) rec.plateau = { v: 1, list: [] };
  const id = 'test:' + exId;
  let ev = rec.plateau.list.find((e) => e.id === id);
  if (!ev) {
    ev = {
      id, exId, disp: null, at, session: 'test', kind: 'plateau', n: [0, 0], sessions: 0, days: 0, beta: 0, se: 0, rt: null,
      level: { lv: 0, lo: 0, hi: 0 }, row: 0, reason: 'otherwise', change, detail: detail || {}, eligible: [change], drawn: 0, seed: 1,
      trial: { sessions: 1e6, answers: 1e6, s0: 0, n0: 0, end: null, restUntil: null },
      verdict: null, shown: { summary: 0, today: 0 }, fit: { a: 0, aSe: 0, gamma: 0, phi: 1 },
    };
    rec.plateau.list.push(ev);
  }
  ev.at = at;
  ev.trial.end = null;
  ev.verdict = null;
}

// Train sessions of `learners` simulated learners, one a day for `days` days, on one exercise. Counts the
// leading, fluency and target items and those of them in a scoped cell.
function play(PX, exId, { learners = 2, days = 9, seed = 1, change = null, detail = null } = {}) {
  const E = PX.engine, def = PX.ex.get(exId);
  const can = (d) => d.id === exId;
  const c = { lead: 0, flu: 0, tgt: 0, leadIn: 0, fluIn: 0, tgtIn: 0, deadEnds: 0, bad: [], seq: [] };
  for (let l = 0; l < learners; l++) {
    // the DAT-style formats (Painted Cubes) train only under the PAT focus (settings.patFocus, DECISIONS D2)
    const rec = newRecord(PX, T0 - DAY, def.pat === true ? { patFocus: true } : {}), L = new Learner(PX, seed * 100 + l);
    for (let d = 0; d < days; d++) {
      const now = T0 + d * DAY + 3600e3;
      if (change) openChange(rec, exId, change, detail, now - 1000);
      const { steps, deadEnd } = playSession(PX, rec, L, 'train', { now, display: 'large', can, minutes: 20 }, d);
      if (deadEnd) c.deadEnds++;
      for (const { step } of steps) {
        c.seq.push(step.exId + ':' + step.kind + ':' + step.code + ':' + step.seed);
        if (step.exId !== exId) continue;
        const inCell = E.dims.isScoped(def, step.params, step.seed);
        if (step.kind === 'lead') { c.lead++; if (inCell) c.leadIn++; } else if (step.kind === 'fluency') { c.flu++; if (inCell) c.fluIn++; } else if (step.kind === 'target' || step.kind === 'weak') { c.tgt++; if (inCell) c.tgtIn++; }
        if (inCell && (step.kind === 'lead' || step.kind === 'fluency') && c.bad.length < 4) c.bad.push(step.kind + ' ' + JSON.stringify(step.params) + ' seed ' + step.seed);
      }
    }
  }
  return c;
}

function quiet(PX) { PX.engine.configure({ plateau: { minSessions: 1e9 } }); return PX; } // no detector events of its own
function fresh(t) { return quiet(t.context().PX); }
function line(id, c) { return `${id}: ${c.leadIn} of ${c.lead} leading and ${c.fluIn} of ${c.flu} fluency items in a scoped cell (target items there: ${c.tgtIn} of ${c.tgt})`; }

// scopedPick on its own: which items it touches and what it leaves the pick.
function units(t) {
  t.section('dims.scoped: the last pick hook');
  const PX = t.PX, E = PX.engine, M = E.model;
  const h = E.modes.hooks('pick'), last = h[h.length - 1];
  t.ok(last && last.id === 'dims.scoped' && last.order === 90 && h.some((x) => x.id === 'dims.pick' && x.order === 10), 'dims.scoped runs last among the pick hooks (order 90; dims.pick stays at 10)');
  const fold = PX.ex.get('fold'), rotate = PX.ex.get('rotate'), rec = newRecord(PX, T0), plan = { mode: 'train', pos: 1 };
  const inCell = (c) => E.dims.isScoped(fold, c.params);
  const list = M.pool(fold);
  t.ok(list.some(inCell) && list.some((c) => !inCell(c)), 'Fold\'s pool has items in its scoped cell (one fold) and outside it');
  let o = { kind: 'lead', filter: null };
  E.dims._.scopedPick(plan, rec, fold, o, { kind: 'lead' });
  t.ok(typeof o.filter === 'function' && !list.filter(o.filter).some(inCell) && list.filter(o.filter).length === list.filter((c) => !inCell(c)).length,
    'a leading item with no filter left (a plateau\'s wider mix): every setting but the scoped cell');
  const tv = (c) => c.params.variant === 'choose';
  o = { kind: 'fluency', filter: tv };
  E.dims._.scopedPick(plan, rec, fold, o, { kind: 'fluency' });
  t.ok(list.filter(o.filter).every((c) => tv(c) && !inCell(c)) && list.filter(o.filter).length === list.filter((c) => tv(c) && !inCell(c)).length, 'a fluency item keeps its filter, less the cell');
  o = { kind: 'lead', filter: inCell };
  E.dims._.scopedPick(plan, rec, fold, o, { kind: 'lead' });
  const auto = E.modes._.autoFilter(fold, null);
  t.ok(list.filter(o.filter).length > 0 && list.filter(o.filter).every((c) => !inCell(c) && (!auto || auto(c))),
    'a filter that leaves nothing off the cell: the fallback\'s Train variants, off the cell (so modes never drops every filter)');
  for (const kind of ['target', 'easy', 'stretch', 'weak', 'warmup', 'drill']) {
    o = { kind, filter: null };
    E.dims._.scopedPick(plan, rec, fold, o, { kind });
    if (o.filter !== null) { t.fail(kind + ' items are left as they are'); break; }
  }
  t.ok(true, 'target, easy, stretch, weak, warm-up and drill items are left as they are');
  o = { kind: 'lead', filter: null };
  E.dims._.scopedPick(plan, rec, rotate, o, { kind: 'lead' });
  t.eq(o.filter, null, 'an exercise without scoped cells is left as it is');
  const cubes = PX.ex.get('cubes');
  o = { kind: 'lead', filter: null };
  E.dims._.scopedPick(plan, rec, cubes, o, { kind: 'lead' });
  t.eq(o.filter, null, 'a cell only the seed names (Painted Cubes) is left to seedFor');
  t.ok(['cubematch', 'patterns'].every((id) => PX.ex.get(id) && PX.ex.get(id).role === 'probe') && TRAINED.every((id) => PX.ex.get(id).role === 'train'),
    'Cube Match and Pattern Memory are probes (no Train, no leading items); Nets, Slice, Fold, Painted Cubes and Homing train');
  t.eq(E.dims.scoped.filter((e) => PX.ex.get(e.ex) && PX.ex.get(e.ex).role === 'train').map((e) => e.ex).filter((x, i, a) => a.indexOf(x) === i).sort(), [...TRAINED].sort(),
    'the trained exercises with scoped cells are exactly the five played below');
}

// Sessions as they come; there dims' own hook already keeps leading and fluency items off the cells, so the
// last hook changes no item: the same items, kinds and seeds come without it (the mix and targeting unchanged).
function plain(t) {
  t.section('dims.scoped: Train sessions on the five exercises');
  const PX = fresh(t), PB = fresh(t);
  PB.engine.dims._.unhookScoped();
  let leads = 0, flu = 0;
  const same = [];
  for (const id of TRAINED) {
    const c = play(PX, id, { seed: 11 });
    leads += c.lead; flu += c.flu;
    t.ok(c.leadIn + c.fluIn === 0 && c.deadEnds === 0, line(id, c), c.bad.join('; '));
    const b = play(PB, id, { seed: 11 });
    same.push(`${id} ${b.seq.length === c.seq.length && b.seq.every((x, i) => x === c.seq[i]) ? 'same' : 'DIFFERENT'} (${c.seq.length} items)`);
  }
  t.ok(leads > 200 && flu > 50, `leading and fluency items come (${leads} leading, ${flu} fluency in all)`);
  t.ok(same.every((x) => / same /.test(x)), `without the last hook the same sessions deal the same items: ${same.join(', ')}`);
}

// A plateau change ordered after dims (order 20) replaces a leading or fluency item's filter: a wider mix
// (every variant Train mixes, or no filter) and a variant swap (Nets: the variant that holds its cell).
function plateauChanges(t) {
  t.section('dims.scoped: under a plateau change that replaces the filter');
  const PX = fresh(t);
  const cases = TRAINED.map((id) => ({ id, change: 'wider-mix' })).concat([{ id: 'nets', change: 'variant-swap', detail: { variant: 'opposite' } }]);
  let leads = 0;
  for (const k of cases) {
    const c = play(PX, k.id, { seed: 21, change: k.change, detail: k.detail });
    leads += c.lead;
    t.ok(c.leadIn + c.fluIn === 0 && c.deadEnds === 0, k.change + ', ' + line(k.id, c), c.bad.join('; '));
  }
  t.ok(leads > 200, `leading items still come under the changes (${leads})`);
  // The same sessions without the last pick hook: the changes did hand leading and fluency items to the cells.
  const PB = fresh(t);
  PB.engine.dims._.unhookScoped();
  t.ok(!PB.engine.modes.hooks('pick').some((x) => x.id === 'dims.scoped'), 'without dims.scoped (this context only)');
  let inCells = 0;
  const per = [];
  for (const k of cases) {
    const c = play(PB, k.id, { seed: 21, change: k.change, detail: k.detail });
    inCells += c.leadIn + c.fluIn;
    per.push(`${k.id} ${k.change} ${c.leadIn + c.fluIn}`);
  }
  t.ok(inCells > 0, `... the same sessions put ${inCells} leading and fluency items in scoped cells (${per.join(', ')}): what the hook guards`);
}

// A later hook that leaves a leading item nothing but the scoped cells: modes' fallback would drop every filter;
// dims.scoped keeps a candidate off the cells, so the item is still dealt, as a leading item, off them.
function steered(t) {
  t.section('dims.scoped: a later hook that steers leading items into the cells');
  const PX = fresh(t), E = PX.engine;
  const off = E.modes.hook('pick', (plan, rec, def, o) => {
    if (o.kind === 'lead' || o.kind === 'fluency') o.filter = (c) => E.dims.isScoped(def, c.params);
    return null;
  }, { id: 'test.steer', order: 50 });
  try {
    for (const id of ['fold', 'slice', 'nets']) {
      const c = play(PX, id, { seed: 31, learners: 1, days: 6 });
      t.ok(c.lead > 10 && c.leadIn + c.fluIn === 0 && c.deadEnds === 0, line(id, c), c.bad.join('; '));
    }
  } finally {
    off();
  }
}
