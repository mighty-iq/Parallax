#!/usr/bin/env node
/* PLAN milestone 3's acceptance runs for the plateau detector and its changes (note P1 §2.5–2.6, §6), run by
   hand, never by run.mjs (it takes minutes):
     nice -n 15 node tests/node/sim-plateau.mjs --cond <id> [--mode train|path] [--n 300] [--seed 1] [--days 120]
       [--calendar note|sim] [--misspec] [--json out.json]        node tests/node/sim-plateau.mjs --list
   Each run plays N simulated learners (tests/node/fixtures/learner-plateau.mjs) for D days through the real
   engine (E.modes with every hook, js/engine/plateau.js included) on the fixture exercises
   (tests/node/fixtures/exercises.mjs). Every learner has one focus exercise (cycling through Fold, Rotate,
   Nets, Orient, Span, Views, Hidden and Slice: four options, yes/no and pick-two, angles, sequences, a
   guessing rate of 0.2, a custom difficulty with interactions), whose true ability follows the condition's
   shape; the other exercises keep the shared learner model. Train: sessions of 15 or 20 minutes with the
   focus pinned ("Train this exercise": the real rotation of three exercises, interleaving stages, switch
   costs), so the focus gets about 25–55 answers a session as in note P1 §2.3; Path: sessions of 4–6
   minutes on the focus (about 40–60 answers; 8-minute ones hold about 80, too many for 8 sessions in 640
   answers). Calendar 'note': 3 or 4 sessions a week (10 % of playing days hold two), and from week 2 a
   12 % chance each week of a break of 5–11 days; 'sim': the breaks of tests/node/sim.mjs (5–15 days).
   Reported (and checked where the plan sets a bound): false alarms (a plateau or faster event) among
   linear improvers over their first 1,000 answers and over the run; plateaus caught within 400 / 600 / 800
   answers of onset; events before answer 640, inside a trial period, across a gap of more than 14 days,
   or on fewer than 8 sessions or 8 days (checked against the record by a scan of its own, not by the
   engine's); plateau events at the truth's ceiling; verdicts and their period lengths; "clearly up" among
   non-responders and responders; second stalls and the next row; the changes drawn.
   Results: docs/dev/v1.2/plateau-sim.md. The exit code is 1 when a structural check fails (a flag where the
   plan forbids one, a verdict before its period ended); the rates are judged in that file. */
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createContext } from './run.mjs';
import { defineFixtures } from './fixtures/exercises.mjs';
import { newRecord, playSession } from './fixtures/learner.mjs';
import { PlateauLearner } from './fixtures/learner-plateau.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 2, 0, 0, 0); // Monday 2 Nov 2026, as sim.mjs
const FOCUS = ['fold', 'rotate', 'nets', 'orient', 'span', 'views', 'hidden', 'slice'];

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const flag = (name) => process.argv.includes('--' + name);

const plateauShape = (lo, hi) => (r) => ({ type: 'plateau', rise: 0.3, onset: r.int(lo, hi) });
const CONDS = {
  'linear-0.10': { shape: { type: 'linear', slope: 0.10 } },
  'linear-0.15': { shape: { type: 'linear', slope: 0.15 } },
  'linear-0.20': { shape: { type: 'linear', slope: 0.20 } },
  'linear-0.25': { shape: { type: 'linear', slope: 0.25 } },
  'linear-0.30': { shape: { type: 'linear', slope: 0.30 } },
  // rise of 0.3 per 100 answers, flat from a random onset between answers 200 and 900; nothing a change does helps
  plateau: { shape: plateauShape(200, 900) },
  // flat, then +0.6 at answer 700 (a method found)
  step: { shape: { type: 'step', jump: 0.6, at: 700 }, start: 1.75 },
  // the plateau ends after any change: a dip of 0.2 for 40–80 answers, then +0.6 (or +1.0) within 30 answers
  'responder-jump': { shape: plateauShape(200, 700), respond: { to: 'any', dip: 0.2, dipN: [40, 80], kind: 'jump', gain: 0.6, over: 30 } },
  'responder-jump-1.0': { shape: plateauShape(200, 700), respond: { to: 'any', dip: 0.2, dipN: [40, 80], kind: 'jump', gain: 1.0, over: 30 } },
  // ... or the rise of 0.3 per 100 answers resumes after the dip
  'responder-resume': { shape: plateauShape(200, 700), respond: { to: 'any', dip: 0.2, dipN: [40, 80], kind: 'resume', rise: 0.3 } },
  // responds to the other strategy only (the micro-randomised trial should show it)
  selective: { shape: plateauShape(200, 700), respond: { to: 'other-strategy', dip: 0.2, dipN: [40, 80], kind: 'jump', gain: 0.6, over: 30 } },
  // one break of 15–30 days (days 30–70) with forgetting, while improving or on a plateau
  'break-linear': { shape: { type: 'linear', slope: 0.25 }, forget: true, longBreak: [15, 30] },
  'break-plateau': { shape: plateauShape(200, 700), forget: true, longBreak: [15, 30] },
  // a level 2.5 logits past the pool's hardest items
  ceiling: { shape: { type: 'ceiling', above: 2.5 } },
  // a flat level with answers 15 % faster per 100 answers
  faster: { shape: { type: 'linear', slope: 0 }, rtDrop: 0.15 },
};

if (flag('list')) { console.log(Object.keys(CONDS).join('\n')); process.exit(0); }
const COND = arg('cond', 'linear-0.25');
if (!CONDS[COND]) { console.error('unknown --cond ' + COND + ' (--list)'); process.exit(2); }
const MODE = arg('mode', 'train');
const N = Math.max(1, parseInt(arg('n', '300'), 10));
const SEED = parseInt(arg('seed', '1'), 10);
const DAYS = Math.max(14, parseInt(arg('days', '120'), 10));
const CAL = arg('calendar', 'note');
const MISSPEC = flag('misspec');

/* ---------- an independent scan of the record ---------- */

// The focus's rated Train and Path rows up to time `until` (s): [{ t, s (session index or -1) }], oldest first.
function focusRows(rec, exId, untilSec, fromSec) {
  const names = rec.idx.ex.map((s) => String(s).split('@')[0]), modes = rec.idx.mode;
  const ss = rec.sessions.map((s) => [Math.floor(s.start / 1000), Math.ceil(s.end / 1000)]);
  const out = [];
  for (const r of rec.trials) {
    if (r[0] > untilSec || r[0] <= fromSec || names[r[1]] !== exId) continue;
    const m = modes[r[2]];
    if ((m !== 'train' && m !== 'path') || (r[5] !== 0 && r[5] !== 1)) continue;
    if (r.length > 17 && r[17] !== 0 && r[17] !== 1) continue; // Speed deadlines
    if (r.length > 13 && r[13] === 10) continue; // fluency items
    let s = -1;
    for (let i = ss.length - 1; i >= 0; i--) if (ss[i][0] <= r[0] && r[0] <= ss[i][1]) { s = i; break; }
    out.push({ t: r[0], s });
  }
  return out;
}
function localDay(ms) { const d = new Date(ms); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

/* ---------- one learner ---------- */

function calendar(rng, cond) {
  const weekly = rng.pick([3, 4]), maxBreak = CAL === 'sim' ? 14 : 10, out = [];
  const lb = cond.longBreak ? { at: rng.int(30, 70), len: rng.int(cond.longBreak[0], cond.longBreak[1]) } : null;
  let breakUntil = -1;
  for (let d = 0; d < DAYS; d++) {
    if (lb && d === lb.at) breakUntil = Math.max(breakUntil, d + lb.len - 1);
    if (d <= breakUntil) continue;
    if (d % 7 === 0 && d > 0 && rng.chance(0.12)) { breakUntil = d + rng.int(4, maxBreak); continue; }
    if (!rng.chance(weekly / 7)) continue;
    out.push({ d, n: rng.chance(0.1) ? 2 : 1 });
  }
  return { weekly, days: out, lb };
}

function simLearner(PX, cond, i, S) {
  const E = PX.engine, P = E.plateau;
  const rng = PX.rng(PX.rng.hash('sim-plateau', COND, MODE, SEED, i));
  const focus = FOCUS[i % FOCUS.length], def = PX.ex.get(focus);
  const shape = typeof cond.shape === 'function' ? cond.shape(rng) : cond.shape;
  const L = new PlateauLearner(PX, PX.rng.hash('sim-plateau-learner', COND, SEED, i), {
    focus, shape, respond: cond.respond, forget: cond.forget, rtDrop: cond.rtDrop, start: cond.start, misspec: MISSPEC,
  });
  const minutes = MODE === 'train' ? rng.pick([15, 20, 20]) : 20;
  const rec = newRecord(PX, T0 - 3600e3, { weeklyGoal: 3, sessionMin: minutes });
  const cal = calendar(rng, cond);
  const lg = { i, focus, shape, k: 0, sessions: 0, events: [], verdicts: [], bad: [], longBreak: cal.lb };
  const target = (g) => E.model.target(g, E.model.styleK('balanced'));
  for (const { d, n } of cal.days) {
    let now = T0 + d * DAY + (17 + rng.int(0, 4)) * 3600e3 + rng.int(0, 59) * 60e3;
    for (let s = 0; s < n; s++) {
      const opts = MODE === 'train' ? { now, display: 'large', pin: focus } : { now, display: 'large', exId: focus, minutes: rng.pick([4, 5, 6]) };
      const res = playSession(PX, rec, L, MODE, opts, d, { stutterP: 0.01 });
      now = res.now + 60e3;
      lg.sessions += 1;
      if (res.deadEnd) lg.bad.push('dead end ' + res.deadEnd);
      if (res.fin && res.fin.errors && res.fin.errors.length) lg.bad.push('hook error ' + JSON.stringify(res.fin.errors[0]));
      const pl = res.fin && res.fin.plateau;
      if (!pl) continue;
      for (const ev of pl.ended) {
        if (ev.exId !== focus) continue;
        const start = ev.trial.restUntil && ev.trial.restUntil > ev.at ? ev.trial.restUntil : ev.at;
        const rows = focusRows(rec, focus, Math.floor(ev.verdict.at / 1000), Math.floor(start / 1000));
        const sess = new Set(rows.map((r) => r.s)).size;
        lg.verdicts.push({ id: ev.id, change: ev.change, words: ev.verdict.words, diff: ev.verdict.diff, se: ev.verdict.se, k: L.k, given: L.given, answers: rows.length, sessions: sess, resp: !!L.resp });
        if (ev.verdict.diff !== null && (rows.length < 120 || sess < 3)) lg.bad.push(`verdict after ${rows.length} answers in ${sess} sessions`);
      }
      for (const ev of pl.fired) {
        if (ev.exId !== focus) continue;
        // the window, from the record by a scan of its own: the 640 eligible rows before the event, after
        // the end of the focus's earlier events
        const earlier = P.list(rec, focus).filter((e) => e.id !== ev.id && e.at < ev.at);
        const open = earlier.filter((e) => e.kind === 'plateau' && e.trial && (e.trial.end === null || e.trial.end > ev.at));
        const bound = Math.max(0, ...earlier.map((e) => (e.kind === 'plateau' ? e.trial.end : e.at)));
        const W = E.config.plateau.window, rows = focusRows(rec, focus, Math.floor(ev.at / 1000), Math.floor(bound / 1000)).slice(-W);
        let gap = 0;
        for (let j = 1; j < rows.length; j++) gap = Math.max(gap, rows[j].t - rows[j - 1].t);
        const sess = new Set(rows.map((r) => r.s)), days = new Set(rows.map((r) => localDay(r.t * 1000)));
        const x = {
          id: ev.id, kind: ev.kind, change: ev.change, row: ev.row, drawn: ev.drawn, eligible: ev.eligible, k: L.k, given: L.given,
          slope: L.slopeAt(L.k), ceiling: L.trulyAtCeiling(d, L.k, target), resp: !!L.resp, beta: ev.beta, se: ev.se, rt: ev.rt,
          windowRows: rows.length, maxGapDays: gap / 86400, windowSessions: sess.size, windowDays: days.size,
        };
        if (ev.kind !== 'ceiling') {
          if (rows.length < W) lg.bad.push(`${ev.kind} event with ${rows.length} answers in its window (k ${L.k})`);
          if (gap > 14 * 86400) lg.bad.push(`${ev.kind} event across a gap of ${(gap / 86400).toFixed(1)} days`);
          if (sess.size < 8 || days.size < 8) lg.bad.push(`${ev.kind} event on ${sess.size} sessions, ${days.size} days`);
        }
        if (open.length) lg.bad.push(`${ev.kind} event inside a trial period`);
        if (ev.kind === 'plateau' && x.ceiling) S.plateauAtTrueCeiling += 1;
        lg.events.push(x);
        L.onEvent(ev);
      }
    }
  }
  lg.k = L.k;
  lg.given = L.given;
  lg.resp = L.resp;
  return lg;
}

/* ---------- report ---------- */

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '–');
const quart = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? [s[Math.floor(s.length / 4)], s[Math.floor(s.length / 2)], s[Math.floor(3 * s.length / 4)]] : []; };

function report(cond, logs, S, secs) {
  const out = [], flags = (lg) => lg.events.filter((e) => e.kind === 'plateau' || e.kind === 'faster');
  const ks = logs.map((l) => l.given);
  out.push(`== ${COND} · ${MODE} · ${logs.length} learners × ${DAYS} days · calendar ${CAL}${MISSPEC ? ' · misspecified items' : ''}${SET ? ' · config ' + SET : ''} · seed ${SEED} (${secs.toFixed(0)} s)`);
  out.push(`  focus answers per learner: quartiles ${quart(ks).join(' / ')}; sessions per learner median ${quart(logs.map((l) => l.sessions))[1]}`);
  const kinds = {};
  logs.forEach((l) => l.events.forEach((e) => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; }));
  out.push(`  events: ${JSON.stringify(kinds)}; plateau events at the truth's ceiling: ${S.plateauAtTrueCeiling}`);
  const bad = logs.filter((l) => l.bad.length);
  out.push(`  structural checks failed: ${bad.length}${bad.length ? ' (' + bad.slice(0, 3).map((l) => l.i + ': ' + l.bad[0]).join('; ') + ')' : ''}`);
  const minK = Math.min(Infinity, ...logs.flatMap((l) => flags(l).map((e) => e.given))); // answers given
  out.push(`  earliest flag at answer ${minK === Infinity ? '–' : minK} (none before ${WIN} allowed)`);
  const R = { cond: COND, mode: MODE, n: logs.length, kinds, bad: bad.length, minK, plateauAtTrueCeiling: S.plateauAtTrueCeiling };
  if (cond.shape.type === 'linear' || COND === 'break-linear' || COND === 'faster') {
    const by1000 = logs.filter((l) => flags(l).some((e) => e.given <= 1000)).length, any = logs.filter((l) => flags(l).length).length;
    const reach = logs.filter((l) => l.given >= 1000).length;
    out.push(`  false alarms: flagged by answer 1,000: ${by1000}/${logs.length} = ${pct(by1000, logs.length)} % (${reach} learners reached 1,000 answers); flagged at any time: ${pct(any, logs.length)} %`);
    Object.assign(R, { fa1000: by1000 / logs.length, faAny: any / logs.length, reached1000: reach });
    if (COND === 'faster') {
      const firsts = logs.map((l) => flags(l)[0]).filter(Boolean);
      out.push(`  first flags: ${firsts.filter((e) => e.kind === 'faster').length} faster, ${firsts.filter((e) => e.kind === 'plateau').length} plateau, of ${logs.length} learners`);
      R.fasterShare = firsts.filter((e) => e.kind === 'faster').length / Math.max(1, firsts.length);
    }
  }
  if (cond.shape === undefined || typeof cond.shape === 'function' || cond.shape.type === 'plateau') {
    const delays = [], early = [], never = [];
    logs.forEach((l) => {
      const f = flags(l)[0];
      if (!f) { never.push(l); return; }
      if (f.k < l.shape.onset) early.push(f); else delays.push(f.k - l.shape.onset);
    });
    const within = (x) => delays.filter((d) => d <= x).length;
    const n = logs.length;
    out.push(`  plateau caught within 400 / 600 / 800 answers of onset: ${pct(within(400), n)} / ${pct(within(600), n)} / ${pct(within(800), n)} % (quartiles of the delay ${quart(delays).join(' / ')}); flagged before onset (still rising): ${early.length}; never flagged: ${never.length} (their onsets ${never.slice(0, 5).map((l) => l.shape.onset + '→' + l.k).join(', ')})`);
    Object.assign(R, { caught400: within(400) / n, caught600: within(600) / n, caught800: within(800) / n, early: early.length, never: never.length, delays: quart(delays) });
  }
  if (cond.shape.type === 'step') {
    const before = logs.filter((l) => flags(l).some((e) => e.k < 700)).length;
    out.push(`  flagged during the flat stretch before the jump: ${pct(before, logs.length)} %`);
    R.stepBefore = before / logs.length;
  }
  if (cond.shape.type === 'ceiling') {
    out.push(`  plateau or faster events: ${logs.reduce((a, l) => a + flags(l).length, 0)}; ceiling events per learner median ${quart(logs.map((l) => l.events.filter((e) => e.kind === 'ceiling').length))[1]}`);
  }
  // verdicts
  const vs = logs.flatMap((l) => l.verdicts), firstV = logs.map((l) => l.verdicts[0]).filter(Boolean);
  if (vs.length) {
    const w = (list, k) => list.filter((v) => v.words === k).length;
    out.push(`  verdicts: ${vs.length} (up ${w(vs, 'up')}, unclear ${w(vs, 'unclear')}, none ${w(vs, 'none')}; ${vs.filter((v) => v.diff === null).length} after a long gap); first verdict per learner: up ${pct(w(firstV, 'up'), firstV.length)} % of ${firstV.length}; period answers quartiles ${quart(vs.map((v) => v.answers)).join(' / ')}, sessions ${quart(vs.map((v) => v.sessions)).join(' / ')}`);
    const respV = firstV.filter((v) => v.resp), nonV = firstV.filter((v) => !v.resp);
    if (cond.respond) out.push(`  first verdicts of learners who responded: up ${pct(w(respV, 'up'), respV.length)} % of ${respV.length}; of those who did not: up ${pct(w(nonV, 'up'), nonV.length)} % of ${nonV.length}`);
    Object.assign(R, { verdicts: vs.length, upAll: w(vs, 'up') / vs.length, upFirst: w(firstV, 'up') / Math.max(1, firstV.length), firstVerdicts: firstV.length,
      upResp: respV.length ? w(respV, 'up') / respV.length : null, upNon: nonV.length ? w(nonV, 'up') / nonV.length : null });
    if (COND === 'selective') {
      const byCh = {};
      firstV.forEach((v) => { const o = byCh[v.change] || (byCh[v.change] = { n: 0, up: 0 }); o.n++; if (v.words === 'up') o.up++; });
      out.push('  first verdict "up" by change: ' + Object.entries(byCh).map(([c, o]) => `${c} ${o.up}/${o.n}`).join(', '));
      R.byChange = byCh;
    }
  }
  // changes drawn, second stalls
  const pe = logs.flatMap((l) => l.events.filter((e) => e.kind === 'plateau'));
  if (pe.length) {
    const ch = {}, rows = {};
    pe.forEach((e) => { ch[e.change] = (ch[e.change] || 0) + 1; rows[e.row] = (rows[e.row] || 0) + 1; });
    const drawn = pe.filter((e) => e.drawn === 1);
    const elig = {}, got = {};
    drawn.forEach((e) => e.eligible.filter((c) => ['other-strategy', 'wider-mix', 'variant-swap', 'aim-higher', 'stage-forward', 'new-variant'].includes(c)).forEach((c) => { elig[c] = (elig[c] || 0) + 1; if (e.change === c) got[c] = (got[c] || 0) + 1; }));
    out.push(`  changes: ${JSON.stringify(ch)}; rows ${JSON.stringify(rows)}; drawn ${drawn.length}/${pe.length}`);
    out.push('  drawn when eligible: ' + Object.keys(elig).map((c) => `${c} ${got[c] || 0}/${elig[c]}`).join(', '));
    const seconds = logs.filter((l) => l.events.filter((e) => e.kind === 'plateau').length >= 2);
    // the same change again while another was eligible, though the first did not read "clearly up" (after
    // "clearly up" the tried list starts again by design)
    const repeat = seconds.filter((l) => {
      const p = l.events.filter((e) => e.kind === 'plateau'), v = l.verdicts.find((x) => x.id === p[0].id);
      return p[1].change === p[0].change && p[1].eligible.length > 1 && !(v && v.words === 'up');
    }).length;
    out.push(`  second stalls: ${seconds.length} learners; the same change again while another was eligible (no "clearly up" between): ${repeat}`);
    Object.assign(R, { changes: ch, rows, drawn: drawn.length, eligibleDrawn: { elig, got }, seconds: seconds.length, repeat });
  }
  return { text: out.join('\n'), R };
}

/* ---------- main ---------- */

const { PX, loadErrors } = createContext({ exercises: false });
if (loadErrors.length) { console.error(loadErrors.join('\n')); process.exit(2); }
defineFixtures(PX);
// --set '<json>': a patch of E.config.plateau for a lever run (e.g. '{"window":560}'); reported with the results
const SET = arg('set', '');
if (SET) PX.engine.configure({ plateau: JSON.parse(SET) });
const WIN = PX.engine.config.plateau.window;
if (!PX.engine.plateau) { console.error('js/engine/plateau.js is not loaded (tests/node/run.mjs MANIFEST)'); process.exit(2); }
const cond = CONDS[COND], S = { plateauAtTrueCeiling: 0 }, logs = [];
const t0 = performance.now();
for (let i = 0; i < N; i++) logs.push(simLearner(PX, cond, i, S));
const { text, R } = report(cond, logs, S, (performance.now() - t0) / 1000);
console.log(text);
const json = arg('json', '');
if (json) fs.writeFileSync(json, JSON.stringify({ R, logs }, null, 0));
// (plateau events past the truth's ceiling are reported, not failed: the plan's ceiling is the rating's, which
// the detector checks by construction; a learner whose success saturates at its own lapse rate gives no slope)
const structural = logs.some((l) => l.bad.length) || (Number.isFinite(R.minK) && R.minK < WIN);
process.exit(structural ? 1 : 0);
