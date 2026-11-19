#!/usr/bin/env node
/* PLAN milestone 8's acceptance simulation for Reckon's `legs` dim (note docs/research/v1.2/N1-reckon.md §7 #1
   and addendum A3 #2; run by hand, results in docs/dev/v1.2/reckon-sim.md):
     node tests/node/sim-reckon.mjs [--learners 60] [--days 60] [--legs 0,0.4,1.2] [--big 1.5] [--burn 100]
       [--seed 1] [--json out.json]
   Learners of tests/node/fixtures/learner.mjs train Reckon alone in Train mode for D days (2–6 sessions a week
   of 10–30 minutes, breaks of 4–14 days, as in tests/node/sim.mjs), on the real generator. Their true item
   difficulty is the hand-set model's with two errors (tests/node/fixtures/learner-reckon.mjs):
     - the `legs` step is wrong: where the legs decide (lib.legCell), the true step is --legs (one condition per
       value; the model's is 0.4);
     - an item that holds a single turn of 140° or more (between legs or the final turn on the spot) is --big
       logits harder than the model says (Wiener & Mallot 2006, as A3 #2 reads it).
   Reported per condition, on target and leading items after each learner's first --burn answers: the share
   whose true success (without the day's noise and the switch cost) lies within ±0.10 of the target, the mean
   distance, success against target overall, where the legs decide (legs 1 in a leg cell) and elsewhere, on
   items with and without a turn of 140° or more, and per route; the share of leg-cell items the engine plays
   at legs 1 in each third of the run; 95 % coverage of the true ability at each session's end. Nothing is gated
   here: PLAN milestone 8 asks for this check before the levels ship, and docs/dev/v1.2/reckon-sim.md reads it
   (no floor effect where the legs decide: success there stays near the target and the engine keeps using the
   level, with the step at 0, 0.4 and 1.2; --big 0 separates the legs dim from the large-turn error). */
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createContext } from './run.mjs';
import { newRecord, playSession } from './fixtures/learner.mjs';
import { ReckonLearner } from './fixtures/learner-reckon.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 2, 0, 0, 0); // Monday 2 Nov 2026

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const N = Math.max(1, parseInt(arg('learners', '60'), 10));
const DAYS = Math.max(7, parseInt(arg('days', '60'), 10));
const LEGS = arg('legs', '0,0.4,1.2').split(',').map(Number);
const BIG = Number(arg('big', '1.5'));
const BURN = parseInt(arg('burn', '100'), 10);
const SEED = arg('seed', '1');

function blank(legsStep) {
  return {
    legsStep, learners: 0, sessions: 0, items: 0, errors: 0, deadEnds: 0,
    tgt: { n: 0, x: 0, t: 0, pt: 0, in10: 0, abs: 0 },
    groups: {}, thirds: [{ cell: 0, at1: 0 }, { cell: 0, at1: 0 }, { cell: 0, at1: 0 }],
    cov: { n: 0, in: 0, bias: 0 }, levels: [],
  };
}
function add(G, key, x, t, pt) {
  const g = G[key] || (G[key] = { n: 0, x: 0, t: 0, pt: 0, in10: 0 });
  g.n++; g.x += x; g.t += t; g.pt += pt; if (Math.abs(pt - t) <= 0.10) g.in10++;
}

function simLearner(PX, legsStep, i, S) {
  const E = PX.engine, def = PX.ex.get('reckon'), lib = def.lib;
  const rng = PX.rng(PX.rng.hash('sim-reckon-days', SEED, i));
  const L = new ReckonLearner(PX, PX.rng.hash('sim-reckon', SEED, i), { legsStep, big: BIG });
  const weekly = rng.int(2, 6), minutes = rng.pick([10, 15, 20, 20, 20, 30]);
  const rec = newRecord(PX, T0 - 3600e3, { weeklyGoal: weekly, sessionMin: minutes });
  const display = 'large';
  const can = (d) => d.id === 'reckon';
  let answers = 0, breakUntil = -1;
  S.learners++;
  for (let d = 0; d < DAYS; d++) {
    if (d <= breakUntil) continue;
    if (d % 7 === 0 && d > 0 && rng.chance(0.12)) { breakUntil = d + rng.int(4, 14); continue; }
    if (!rng.chance(weekly / 7)) continue;
    const now = T0 + d * DAY + (17 + rng.int(0, 4)) * 3600e3 + rng.int(0, 59) * 60e3;
    const pending = [];
    const res = playSession(PX, rec, L, 'train', { now, display, can }, d, {
      respond(dd, step) {
        const pt = dd.id === 'reckon' ? L.trueP(dd, step, d) : null;
        pending.push(pt);
        return L.respond(dd, step, d, { stutterP: 0.01 });
      },
    });
    S.sessions++;
    if (res.deadEnd) S.deadEnds++;
    if (res.fin && res.fin.errors) S.errors += res.fin.errors.length;
    const third = Math.min(2, Math.floor(3 * d / DAYS));
    res.steps.forEach((s, j) => {
      S.items++;
      const st = s.step, out = s.out;
      if (st.exId !== 'reckon' || !out || out.outcome > 1) return;
      const p = lib.normParams(st.params);
      if (!st.params.task && lib.LEG_CELLS[p.route] && lib.LEG_CELLS[p.route].indexOf(p.tolerance) >= 0) {
        S.thirds[third].cell++; if (p.legs === 1) S.thirds[third].at1++;
      }
      answers++;
      if ((st.kind !== 'target' && st.kind !== 'lead') || answers <= BURN) return;
      const x = out.outcome === 1 ? 1 : 0, pt = pending[j], T = S.tgt;
      T.n++; T.x += x; T.t += st.target; T.pt += pt; T.abs += Math.abs(pt - st.target); if (Math.abs(pt - st.target) <= 0.10) T.in10++;
      add(S.groups, lib.legCell(p) ? 'legs decide' : 'turns tell a lot', x, st.target, pt);
      add(S.groups, L.big(def, st) ? 'a turn ≥ 140°' : 'no turn ≥ 140°', x, st.target, pt);
      add(S.groups, 'route ' + p.route, x, st.target, pt);
      add(S.groups, p.variant, x, st.target, pt);
    });
    // coverage at the session's end (the rating against the true ability at the middle of the dims, as sim.mjs)
    if (res.plan.rated && res.plan.rated.reckon) {
      const est = E.est.get(rec, def, { display }), th = L.theta(def, d), z = (est.mu - th) / est.sd;
      S.cov.n++; S.cov.bias += est.mu - th; if (Math.abs(z) <= 1.96) S.cov.in++;
    }
  }
  const est = E.est.get(rec, def, { display });
  S.levels.push(E.est.levelOf ? E.est.levelOf(def, est.mu) : null);
}

const pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '–');
const out = { args: { N, DAYS, LEGS, BIG, BURN, SEED }, conds: [] };
const t0 = performance.now();
for (const legsStep of LEGS) {
  const ctx = createContext({}), PX = ctx.PX, S = blank(legsStep);
  if (ctx.loadErrors.length) console.log('load errors: ' + ctx.loadErrors.slice(0, 3).join(' ; '));
  for (let i = 0; i < N; i++) simLearner(PX, legsStep, i, S);
  out.conds.push(S);
  const T = S.tgt, lines = [];
  lines.push(`true legs step ${legsStep} (model 0.4), a turn ≥ 140° +${BIG}: ${S.learners} learners, ${S.sessions} sessions, ${S.items} items, errors ${S.errors}, dead ends ${S.deadEnds}`);
  lines.push(`  on target/lead after ${BURN}: n ${T.n}, within ±0.10 ${pc(T.in10, T.n)} %, mean |p − target| ${(T.abs / Math.max(1, T.n)).toFixed(3)}, success ${pc(T.x, T.n)} % (true ${pc(T.pt, T.n)} %) vs target ${pc(T.t, T.n)} %`);
  for (const [k, g] of Object.entries(S.groups).sort()) lines.push(`    ${k.padEnd(18)} n ${String(g.n).padStart(6)}  within ±0.10 ${pc(g.in10, g.n).padStart(5)} %  success ${pc(g.x, g.n).padStart(5)} % (true ${pc(g.pt, g.n).padStart(5)} %) vs target ${pc(g.t, g.n).padStart(5)} %`);
  lines.push(`  legs-decide share of leg-cell items by third of the run: ${S.thirds.map((h) => pc(h.at1, h.cell) + ' % of ' + h.cell).join(' / ')}`);
  lines.push(`  coverage of the true ability at session ends: ${pc(S.cov.in, S.cov.n)} % (bias ${(S.cov.bias / Math.max(1, S.cov.n)).toFixed(3)} logits, n ${S.cov.n})`);
  console.log(lines.join('\n'));
}
console.log(`(${((performance.now() - t0) / 1000).toFixed(0)} s)`);
const jf = arg('json', '');
if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
