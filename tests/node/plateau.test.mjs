/* PLAN milestone 3 (plateau-breaking): unit tests of js/engine/plateau.js on the fixture exercises,
   with records built here (trial rows, sessions, a rating). The acceptance runs over simulated
   learners live in tests/node/sim-plateau.mjs (by hand); docs/dev/v1.2/plateau-sim.md has the results. */
import fs from 'node:fs';
import path from 'node:path';
import { defineFixtures } from './fixtures/exercises.mjs';
import { MANIFEST, SharedStorage } from './run.mjs';
import { installDom } from './chimera-dom.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 2, 17, 0, 0);

function ctx(t) {
  const c = t.context({ exercises: false });
  defineFixtures(c.PX, { probes: false });
  if (!c.PX.engine.plateau) throw new Error('js/engine/plateau.js is not loaded (MANIFEST)');
  return c.PX;
}

function sig(x) { return 1 / (1 + Math.exp(-x)); }

/* world(PX, o): a record that grows one session at a time on one exercise (o.ex, default Fold):
   w.session(theta, { per, gap, every }) adds a session of `per` rated answers (one a day from T0 unless
   o.every or a gap in days), the true ability theta(k) at the k-th answer, items near the target, a
   row of another exercise before every `switchEvery`-th answer (a switch, costing switchCost logits),
   response times o.rt(k, b, th, rng) (ms), display o.display ('large'); o.cols writes the wave-2
   columns (kind o.kindOf(k), deadline o.dlOf(k)). The rating follows the true ability (sd 0.25).
   build(PX, o): o.sessions sessions at once (o.gaps: { session index: days }), then o.mu / o.sd / o.n. */
function world(PX, o) {
  const E = PX.engine, def = PX.ex.get(o.ex || 'fold'), pool = E.model.pool(def);
  const other = PX.ex.get(o.other || 'nets'), oPool = E.model.pool(other);
  const rng = PX.rng(PX.rng.hash('plateau-test', o.seed || 1));
  const rec = {
    v: 3, created: T0 - DAY, settings: {}, ex: {}, sessions: [], trials: [], idx: { ex: [], mode: [] },
    train: { style: 'balanced', variability: 'high', pins: [], stage: {}, sw: {} }, strategies: [], path: {}, ui: {},
  };
  const exI = rec.idx.ex.push(def.id + '@' + (o.version || def.version || 1)) - 1;
  const otI = rec.idx.ex.push(other.id + '@' + (other.version || 1)) - 1;
  const modeI = rec.idx.mode.push(o.mode || 'train') - 1;
  const w = { rec, def, n: 0, day: 0, now: T0, last: null };
  w.session = function (theta, so = {}) {
    if (so.gap) w.day += so.gap;
    const start = T0 + w.day * DAY, per = so.per || o.per;
    let t = start;
    for (let j = 0; j < per; j++) {
      const th = theta(w.n), sw = o.switchEvery && j % o.switchEvery === 0 && j > 0 ? 1 : 0;
      if (sw) {
        const c2 = oPool[rng.int(0, oPool.length - 1)];
        t += 4000;
        rec.trials.push([Math.floor(t / 1000), otI, modeI, c2.code, rng.int(1, 1e9), rng.chance(0.7) ? 1 : 0, 5000, null, 700, 3, 2, 1]);
      }
      // an item whose predicted success is near 0.78 at the true ability (with some spread)
      const want = th - 1.0 + rng.normal(0, 0.5);
      let best = pool[0];
      for (const c of pool) if (Math.abs(c.b - want) < Math.abs(best.b - want)) best = c;
      const p = best.g + (1 - best.g - 0.03) * sig(th - best.b - (sw ? (o.switchCost || 0) : 0));
      const x = rng.chance(p) ? 1 : 0;
      const rt = o.rt ? o.rt(w.n, best.b, th, rng) : 6000 * Math.exp(rng.normal(0, 0.35));
      t += 8000;
      const row = [Math.floor(t / 1000), exI, modeI, best.code, rng.int(1, 1e9), x, Math.round(rt), null, Math.round(1000 * p), 3,
        o.display === 'small' ? 1 : 2, 1];
      if (o.cols) row.push(null, o.kindOf ? o.kindOf(w.n) : 2, 0, 1, 1, o.dlOf ? o.dlOf(w.n) : 0);
      rec.trials.push(row);
      w.n += 1;
      w.last = t;
    }
    rec.sessions.push({ id: 's' + rec.sessions.length, start, end: t + 1000, mode: o.mode || 'train', trials: per, right: 0, exs: o.switchEvery ? [def.id, other.id] : [def.id], ended: o.ended ? o.ended(rec.sessions.length) : 'complete', display: o.display || 'large' });
    const slot = { mu: theta(w.n - 1), sd: 0.25, n: w.n, nRight: 0, last: w.last, hist: [] };
    if (def.perDisplay && o.display === 'small') rec.ex[def.id] = Object.assign(rec.ex[def.id] || { mu: 0, sd: 1, n: 0, nRight: 0, last: null }, { small: slot });
    else rec.ex[def.id] = Object.assign(rec.ex[def.id] || {}, slot);
    w.day += so.every || o.every || 1;
    w.now = w.last + 60000;
    return w;
  };
  return w;
}
function build(PX, o) {
  const w = world(PX, o);
  for (let s = 0; s < o.sessions; s++) w.session(o.theta, { gap: o.gaps && o.gaps[s] });
  const slot = o.display === 'small' && w.def.perDisplay ? w.rec.ex[w.def.id].small : w.rec.ex[w.def.id];
  if (o.mu !== undefined) slot.mu = o.mu;
  if (o.sd !== undefined) slot.sd = o.sd;
  if (o.n !== undefined) slot.n = o.n;
  return { rec: w.rec, def: w.def, now: w.now, n: w.n, w };
}

const rising = (s) => (k) => -0.4 + s * k / 100;
const flat = () => 0.8;

function planFor(id, n, display) { return { mode: 'train', id: 'sx', rated: { [id]: { n: n || 40, right: 0, rt: [] } }, exs: [id], display: display || 'large' }; }

export async function run(t) {
  t.section('module');
  {
    const PX = ctx(t), E = PX.engine, P = E.plateau;
    for (const f of ['detect', 'signals', 'choose', 'active', 'card', 'list', 'finish']) t.ok(typeof P[f] === 'function', 'E.plateau.' + f);
    const cfg = E.config.plateau;
    t.eq([cfg.window, cfg.z, cfg.delta, cfg.minSessions, cfg.minDays, cfg.maxGapDays, cfg.trial.sessions, cfg.trial.answers],
      [640, 1.645, 0.15, 8, 8, 14, 3, 120], 'the plan\'s numbers (PLAN milestone 3, note P1 §2.4, §3.10)');
    const ids = (p) => E.modes.hooks(p).map((h) => h.id);
    t.ok(ids('start').includes('plateau.share') && ids('kind').includes('plateau.drill') && ids('pick').includes('plateau.pick') && ids('finish').includes('plateau.finish'), 'modes hooks registered');
    t.ok(E.schedule.hooks('exclude').some((h) => h.id === 'plateau.rest'), 'the exclude hook is registered');
    t.ok(E.modes.hooks('finish').find((h) => h.id === 'plateau.finish').order === 20, 'finish hook order 20 (CONTRACT-v1.2 Q)');
    const src = fs.readFileSync(path.join(t.root, 'js/engine/plateau.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    t.ok(!/Date\.now|new Date|Math\.random|localStorage|document\./.test(src), 'pure: no clock, storage, DOM or Math.random');
    t.eq(P.SIGNALS, ['switch-deficit', 'weak-frontier', 'slow-accurate', 'massed', 'strategy', 'narrow-mix', 'stretch-beaten', 'otherwise'], 'signal ids in row order');
  }

  t.section('the slope fit');
  {
    const PX = ctx(t), P = PX.engine.plateau;
    let hits = 0, sumZ = 0, sumZ2 = 0, ses = [];
    for (let seed = 1; seed <= 24; seed++) {
      for (const s of [0, 0.3]) {
        const b = build(PX, { sessions: 16, per: 40, theta: rising(s), seed });
        const det = P.detect(b.rec, b.def, {}, b.now);
        t.ok(det.ready, `ready (seed ${seed}, slope ${s}): ${det.why}`);
        const z = (det.beta - s) / det.se;
        sumZ += z; sumZ2 += z * z; ses.push(det.se);
        if (Math.abs(z) <= 1.96) hits++;
      }
    }
    const m = sumZ / 48, sd = Math.sqrt(sumZ2 / 48 - m * m);
    t.ok(hits >= 41, `the slope's 95 % interval holds the true slope in ${hits}/48 records`);
    t.ok(Math.abs(m) < 0.5 && sd < 1.4, `z of the slope: mean ${m.toFixed(2)}, sd ${sd.toFixed(2)}`);
    const medSe = ses.sort((a, b) => a - b)[24];
    t.ok(medSe > 0.05 && medSe < 0.12, `SE about 0.075 per 100 answers at W = 640 (median ${medSe.toFixed(3)}; note P1 §2.5)`);
  }

  t.section('detection: fires on a flat stretch, not on a rise');
  {
    const PX = ctx(t), P = PX.engine.plateau;
    let flatFire = 0, riseFire = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const a = build(PX, { sessions: 16, per: 42, theta: flat, seed });
      const da = P.detect(a.rec, a.def, {}, a.now);
      if (da.ready && da.fire) flatFire++;
      const r = build(PX, { sessions: 16, per: 42, theta: rising(0.4), seed: seed + 100 });
      const dr = P.detect(r.rec, r.def, {}, r.now);
      if (dr.ready && dr.fire) riseFire++;
    }
    t.ok(flatFire >= 17, `a flat stretch fires (${flatFire}/20)`);
    t.ok(riseFire === 0, `a rise of 0.4 per 100 answers never fires (${riseFire}/20)`);
  }

  t.section('preconditions');
  {
    const PX = ctx(t), P = PX.engine.plateau;
    let b = build(PX, { sessions: 15, per: 42, theta: flat });
    let d = P.detect(b.rec, b.def, {}, b.now);
    t.eq([d.ready, d.why, d.fire], [false, 'answers', false], 'fewer than 640 answers: no evaluation');
    b = build(PX, { sessions: 7, per: 100, theta: flat });
    d = P.detect(b.rec, b.def, {}, b.now);
    t.eq([d.ready, d.why], [false, 'sessions'], '640 answers in 7 sessions: no evaluation');
    b = build(PX, { sessions: 16, per: 42, theta: flat, every: 2 / 24 });
    d = P.detect(b.rec, b.def, {}, b.now);
    t.eq([d.ready, d.why], [false, 'days'], '16 sessions two hours apart (2–3 days): no evaluation');
    b = build(PX, { sessions: 20, per: 42, theta: flat, gaps: { 10: 15 } });
    d = P.detect(b.rec, b.def, {}, b.now);
    t.eq([d.ready, d.why], [false, 'break'], 'a gap of 15 days restarts the window (420 answers after it)');
    b = build(PX, { sessions: 30, per: 42, theta: flat, gaps: { 10: 15 } });
    d = P.detect(b.rec, b.def, {}, b.now);
    t.ok(d.ready && d.n[1] - d.n[0] === 640, 'enough answers after the gap: evaluated again, on answers after it');
    b = build(PX, { sessions: 16, per: 42, theta: () => 3.2, sd: 0.2 });
    d = P.detect(b.rec, b.def, {}, b.now);
    t.eq([d.ready, d.why], [false, 'ceiling'], 'a rating above the target on the pool\'s hardest items: the ceiling');
    const rc = {};
    P.finish(planFor('fold', 42), b.rec, b.now, rc);
    t.eq(rc.plateau.fired.map((e) => [e.kind, e.change, e.trial]), [['ceiling', null, null]], 'a ceiling event: no change, no trial period');
    rc.plateau = null;
    P.finish(planFor('fold', 42), b.rec, b.now + 1000, rc);
    t.eq(rc.plateau.fired.length, 0, '... once per window');
    b = build(PX, { sessions: 16, per: 42, theta: flat, version: 7 });
    d = P.detect(b.rec, b.def, {}, b.now);
    t.eq(d.why, 'answers', 'rows of another version of the exercise never enter the window');
    // Speed deadlines and fluency items stay out; Quick-paced rows count (CONTRACT-v1.2 conflict 1)
    b = build(PX, { sessions: 16, per: 42, theta: flat, cols: true, dlOf: (k) => (k % 2 ? 2 : 0) });
    d = P.detect(b.rec, b.def, {}, b.now);
    t.eq(d.why, 'answers', 'rows with a Speed deadline are left out');
    b = build(PX, { sessions: 16, per: 42, theta: flat, cols: true, kindOf: (k) => (k % 2 ? 10 : 2) });
    d = P.detect(b.rec, b.def, {}, b.now);
    t.eq(d.why, 'answers', 'fluency items are left out');
    b = build(PX, { sessions: 16, per: 42, theta: flat, cols: true, dlOf: () => 1 });
    d = P.detect(b.rec, b.def, {}, b.now);
    t.ok(d.ready, 'Quick-paced rows count');
    // per display class
    b = build(PX, { ex: 'track', other: 'nets', sessions: 16, per: 42, theta: (k) => -1 + 0 * k, display: 'small' });
    t.eq(P.detect(b.rec, b.def, { display: 'large' }, b.now).why, 'answers', 'Track on a large screen: the small screen\'s rows are another class');
    t.ok(P.detect(b.rec, b.def, { display: 'small' }, b.now).ready, 'Track on a small screen: its own rows');
  }

  t.section('switches and the response-time channel');
  {
    const PX = ctx(t), P = PX.engine.plateau;
    const b = build(PX, { sessions: 16, per: 42, theta: flat, switchEvery: 5, switchCost: 0.8, seed: 3 });
    const d = P.detect(b.rec, b.def, {}, b.now);
    t.ok(d.ready && d.gamma < -0.3, `the switch term absorbs a switch cost (γ ${d.gamma && d.gamma.toFixed(2)})`);
    const fast = build(PX, { sessions: 16, per: 42, theta: flat, seed: 4, rt: (k, bb, th, rng) => 9000 * Math.exp(-0.25 * k / 100) * Math.exp(rng.normal(0, 0.3)) });
    const df = P.detect(fast.rec, fast.def, {}, fast.now);
    t.ok(df.ready && df.fire && df.faster, `answers 22 % faster per 100 at a flat level: a 'faster' stall (slope ${df.rt && df.rt.slope.toFixed(3)})`);
    const same = P.detect(build(PX, { sessions: 16, per: 42, theta: flat, seed: 4 }).rec, fast.def, {}, fast.now);
    t.ok(same.rt && !same.rt.faster, 'steady times: not faster');
  }

  t.section('the decision table');
  {
    const PX = ctx(t), P = PX.engine.plateau;
    const sg = (o) => Object.assign({ tried: [] }, Object.fromEntries(P.SIGNALS.map((id) => [id, null])), o);
    let c = P.choose(sg({ 'weak-frontier': { change: 'drill', detail: { dim: 'folds', level: 3 } }, massed: { change: 'rest', detail: { days: 3.5 } }, otherwise: { change: 'stage-forward', detail: { stage: 4 } } }), PX.rng(1));
    t.eq([c.row, c.reason, c.change, c.drawn], [2, 'weak-frontier', 'drill', 0], 'rows 1–4 answer their signal first');
    t.eq(c.eligible, ['drill', 'rest', 'stage-forward'], 'eligible changes in row order');
    c = P.choose(sg({ 'weak-frontier': { change: 'drill', detail: {} }, massed: { change: 'rest', detail: {} }, otherwise: { change: 'stage-forward', detail: {} }, tried: ['drill'] }), PX.rng(1));
    t.eq(c.change, 'rest', 'a change tried since the last "clearly up" is skipped (the next row)');
    const counts = {};
    for (let s = 1; s <= 3000; s++) {
      const x = P.choose(sg({ strategy: { change: 'other-strategy', detail: { strategy: 'imagery' } }, 'narrow-mix': { change: 'wider-mix', detail: {} }, 'stretch-beaten': { change: 'aim-higher', detail: { k: 0.55 } }, otherwise: { change: 'stage-forward', detail: { stage: 3 } } }), PX.rng(s));
      counts[x.change] = (counts[x.change] || 0) + 1;
      if (x.drawn !== 1) t.ok(false, 'rows 5–8 are drawn');
    }
    t.ok(Object.values(counts).length === 4 && Object.values(counts).every((v) => v > 650 && v < 850), 'rows 5–8 drawn about evenly: ' + JSON.stringify(counts));
    c = P.choose(sg({ 'narrow-mix': { change: 'wider-mix', detail: {} }, otherwise: { change: 'wider-mix', detail: {} } }), PX.rng(5));
    t.eq([c.eligible, c.change], [['wider-mix'], 'wider-mix'], 'one change counts once in the draw');
    c = P.choose(sg({ strategy: { change: 'other-strategy', detail: {} }, otherwise: { change: 'stage-forward', detail: {} }, tried: ['other-strategy', 'stage-forward'] }), PX.rng(5));
    t.ok(['other-strategy', 'stage-forward'].includes(c.change) && c.drawn === 1, 'all tried: drawn among rows 5–8 again');
    t.eq(JSON.stringify(P.choose(sg({ otherwise: { change: 'stage-forward', detail: {} }, strategy: { change: 'other-strategy', detail: {} } }), PX.rng(77))),
      JSON.stringify(P.choose(sg({ otherwise: { change: 'stage-forward', detail: {} }, strategy: { change: 'other-strategy', detail: {} } }), PX.rng(77))), 'the same seed draws the same change');
  }

  t.section('signals');
  {
    const PX = ctx(t), E = PX.engine, P = E.plateau;
    let b = build(PX, { sessions: 16, per: 42, theta: flat, switchEvery: 3, switchCost: 1.2, seed: 9 });
    b.rec.train.stage.fold = 4;
    let d = P.detect(b.rec, b.def, {}, b.now), s = P.signals(b.rec, b.def, d, b.now);
    t.eq(s['switch-deficit'] && [s['switch-deficit'].change, s['switch-deficit'].detail.stage], ['stage-back', 3], 'answers after a switch below prediction: a stage back');
    b.rec.train.stage.fold = 1;
    s = P.signals(b.rec, b.def, d, b.now);
    t.eq(s['switch-deficit'], null, 'no stage back from S1');
    b = build(PX, { sessions: 16, per: 42, theta: flat, seed: 10 });
    d = P.detect(b.rec, b.def, {}, b.now);
    s = P.signals(b.rec, b.def, d, b.now);
    t.eq(s['switch-deficit'], null, 'no switch rows: no deficit');
    t.ok(s.otherwise && ['stage-forward', 'new-variant', 'wider-mix'].includes(s.otherwise.change), 'otherwise is always present');
    t.eq(s.strategy && [s.strategy.change, s.strategy.detail.strategy], ['other-strategy', 'imagery'], 'no check-in: the card the tutorial does not open with');
    b.rec.strategies.push({ exId: 'fold', strategy: 'whole', t: b.now - 2 * DAY });
    t.eq(P.signals(b.rec, b.def, d, b.now).strategy.detail.strategy, 'analytic', '"whole" reported: the analytic card');
    b.rec.strategies.push({ exId: 'fold', strategy: 'parts', t: b.now - DAY });
    t.eq(P.signals(b.rec, b.def, d, b.now).strategy, null, 'both reported in the window: no strategy row');
    b.rec.train.variability = 'low';
    t.eq(P.signals(b.rec, b.def, d, b.now)['narrow-mix'].change, 'wider-mix', 'low variability: a wider mix');
    // a weak spot near the frontier
    const e = E.est.exEntry(b.rec, 'fold');
    e.res = { 'folds=2': [-0.25, 30] };
    t.eq(P.signals(b.rec, b.def, d, b.now)['weak-frontier'], { change: 'drill', detail: { dim: 'folds', level: 2 }, value: -0.25, n: 30 }, 'a weak level near the target: drill it');
    e.res = { 'folds=4': [-0.25, 30] };
    b.rec.ex.fold.mu = -3;
    t.eq(P.signals(b.rec, b.def, d, b.now)['weak-frontier'], null, 'a weak level far above the target: no drill');
  }

  t.section('the finish hook: an event, its change and its trial');
  {
    const PX = ctx(t), E = PX.engine, P = E.plateau;
    const b = build(PX, { sessions: 16, per: 42, theta: flat, seed: 21 });
    const res = { session: { id: 's15' }, stageUps: [] };
    P.finish(planFor('fold', 42), b.rec, b.now, res);
    t.ok(res.plateau && res.plateau.fired.length === 1, 'one event fires');
    const ev = res.plateau.fired[0];
    for (const k of ['id', 'exId', 'disp', 'at', 'session', 'kind', 'n', 'sessions', 'days', 'beta', 'se', 'rt', 'level', 'row', 'reason', 'change', 'detail', 'eligible', 'drawn', 'seed', 'trial', 'verdict', 'shown']) t.ok(k in ev, 'event field ' + k);
    t.eq([ev.id, ev.exId, ev.kind, ev.session, ev.n[1] - ev.n[0], ev.trial.sessions, ev.trial.answers, ev.trial.end], ['fold:' + b.now, 'fold', 'plateau', 's15', 640, 3, 120, null], 'the event (CONTRACT-v1.2 P)');
    t.ok(ev.level.lo <= ev.level.lv && ev.level.lv <= ev.level.hi, 'a shown level with its range');
    t.eq(P._.repair(JSON.parse(JSON.stringify(b.rec.plateau))).list[0], JSON.parse(JSON.stringify(ev)), 'the event survives its own repair unchanged');
    t.eq(P.active(b.rec, 'fold', b.now), ev, 'active: the event in its trial period');
    const res2 = { stageUps: [] };
    P.finish(planFor('fold', 42), b.rec, b.now + 1000, res2);
    t.eq(res2.plateau.fired.length, 0, 'no second event while the trial runs');
    t.eq(P.detect(b.rec, b.def, {}, b.now).why, 'trial', 'detect says why');
    // the same record and time give the same event
    const b2 = build(PX, { sessions: 16, per: 42, theta: flat, seed: 21 });
    const r2 = { session: { id: 's15' }, stageUps: [] };
    P.finish(planFor('fold', 42), b2.rec, b2.now, r2);
    t.eq(JSON.stringify(r2.plateau.fired[0]), JSON.stringify(ev), 'deterministic');
    t.eq(planFor('fold', 9) && (() => { const r = {}; P.finish(planFor('fold', 9), build(PX, { sessions: 16, per: 42, theta: flat, seed: 21 }).rec, b.now, r); return r.plateau.fired.length; })(), 0, 'fewer than 10 answers in the session: not evaluated');
  }

  t.section('trial periods and verdicts');
  {
    const PX = ctx(t), E = PX.engine, P = E.plateau;
    // sessions at a flat level until the detector fires (it looks after every session), then the
    // trial's sessions at `level`; extra: { seed, sessions, gaps: { trial session: days }, change, restUntil }
    function after(level, extra) {
      const w = world(PX, { per: 42, seed: extra.seed || 31 });
      for (let s = 0; s < 15; s++) w.session(flat);
      let ev = null;
      for (let g = 0; g < 40 && !ev; g++) {
        w.session(flat);
        const r = { session: { id: 'x' + g }, stageUps: [] };
        P.finish(planFor('fold', 42), w.rec, w.now, r);
        ev = r.plateau.fired[0] || null;
      }
      if (!ev) throw new Error('no event in 40 sessions (seed ' + (extra.seed || 31) + ')');
      if (extra.change) { ev.change = extra.change; ev.trial.restUntil = extra.restUntil ? ev.at + extra.restUntil : null; }
      let ended = null;
      for (let s = 0; s < (extra.sessions || 3); s++) {
        w.session(() => level, { gap: extra.gaps && extra.gaps[s] });
        const r = { stageUps: [] };
        P.finish(planFor('fold', 42), w.rec, w.now, r);
        if (r.plateau.ended.length && !ended) ended = { ev: r.plateau.ended[0], s: s + 1 };
      }
      return { ev, ended, rec: w.rec };
    }
    let a = after(2.0, {});
    t.ok(a.ended && a.ended.s === 3, 'the trial ends after its 3rd session');
    t.eq(a.ev.verdict && a.ev.verdict.words, 'up', 'a clear rise reads "clearly up"');
    t.ok(a.ev.trial.end !== null && P.active(a.rec, 'fold', a.ev.trial.end + 1) === null, 'no longer active');
    a = after(0.8, { seed: 32 });
    t.ok(['unclear', 'none'].includes(a.ev.verdict && a.ev.verdict.words), 'the same level: "unclear yet" or "no change yet", never "clearly up"');
    let ups = 0;
    for (let s = 40; s < 70; s++) { const x = after(0.8, { seed: s }); if (x.ev.verdict && x.ev.verdict.words === 'up') ups++; }
    t.ok(ups <= 3, `the same level reads "clearly up" ${ups}/30 times`);
    a = after(0.8, { seed: 33, sessions: 2 });
    t.eq(a.ev.verdict, null, 'two sessions: no verdict yet');
    a = after(2.0, { seed: 34, gaps: { 1: 15 } });
    t.ok(a.ev.verdict && a.ev.verdict.words === 'unclear' && a.ev.verdict.diff === null, 'a gap of 15 days inside the trial: "unclear yet", no comparison');
    a = after(2.0, { seed: 35, change: 'rest', restUntil: 2.5 * DAY, sessions: 5 });
    t.ok(a.ended && a.ended.s === 5, 'a rest: the sessions during the rest days do not count');
  }

  t.section('a trial\'s progress and the optional shrinkage of the over-dispersion');
  {
    const PX = ctx(t), E = PX.engine, P = E.plateau;
    const w = world(PX, { per: 42, seed: 71 });
    for (let s = 0; s < 15; s++) w.session(flat);
    let ev = null;
    for (let g = 0; g < 40 && !ev; g++) {
      w.session(flat);
      const r = { session: { id: 'x' + g }, stageUps: [] };
      P.finish(planFor('fold', 42), w.rec, w.now, r);
      ev = r.plateau.fired[0] || null;
    }
    t.ok(!!ev, 'an event to follow');
    if (ev) {
      ev.change = 'rest'; ev.trial.restUntil = ev.at + 3.5 * DAY;
      let pr = P.progress(w.rec, ev, ev.at + DAY);
      t.eq([pr.resting, pr.sessions, pr.answers, pr.need.sessions, pr.need.answers], [true, 0, 0, 3, 120], 'resting: nothing counted yet');
      for (let s = 0; s < 5; s++) w.session(flat); // days 1–3 fall inside the 3.5 rest days, days 4 and 5 after them
      pr = P.progress(w.rec, ev, w.now);
      t.eq([pr.resting, pr.sessions, pr.answers], [false, 2, 84], 'after the rest days: the sessions after them');
    }
    const det = P.detect(build(PX, { sessions: 16, per: 42, theta: flat, seed: 72 }).rec, PX.ex.get('fold'), {}, w.now + 1e9);
    E.configure({ plateau: { phiPrior: { df: 1000, phi: 1 } } });
    const b2 = build(PX, { sessions: 16, per: 42, theta: flat, seed: 72 });
    const det2 = P.detect(b2.rec, b2.def, {}, b2.now);
    E.configure({ plateau: { phiPrior: { df: 0, phi: 1 } } });
    t.ok(det2.phi < 1.02 && det2.se <= det.se + 1e-9, `a strong prior pulls φ to 1 (${det.phi && det.phi.toFixed(2)} → ${det2.phi && det2.phi.toFixed(2)})`);
  }

  t.section('changes act through the hooks');
  {
    const PX = ctx(t), E = PX.engine, P = E.plateau, H = P._;
    const b = build(PX, { sessions: 16, per: 42, theta: flat, seed: 41 });
    P.finish(planFor('fold', 42), b.rec, b.now, { stageUps: [] });
    const ev = P.active(b.rec, 'fold', b.now);
    const plan = { mode: 'train', display: 'large', rng: PX.rng(3), exs: ['fold'], share: {} };
    const o = () => ({ kind: 'target', k: 0.7, policy: 'low', filter: null, weak: [{ d: 0, lv: 1 }], tol: 0.05 });
    ev.change = 'aim-higher'; ev.detail = { k: 0.55 };
    let x = o(); H.pickHook(plan, b.rec, b.def, x, { run: {} }); t.eq(x.k, 0.55, 'aim higher: the target k');
    ev.change = 'wider-mix'; ev.detail = {};
    x = o(); H.pickHook(plan, b.rec, b.def, x, { run: {} }); t.eq([x.policy, x.tol], ['high', 0.1], 'a wider mix: high variability, ±0.10');
    const views = PX.ex.get('views');
    b.rec.plateau.list.push(Object.assign({}, ev, { id: 'views:' + b.now, exId: 'views', change: 'variant-swap', detail: { variant: 'count' } }));
    x = o(); H.pickHook(plan, b.rec, views, x, { run: {}, runFilter: (c) => c.params.variant === 'toView' });
    t.ok(x.filter && x.filter({ params: { variant: 'count' } }) && !x.filter({ params: { variant: 'toView' } }), 'a variant swap: that variant only');
    ev.change = 'drill'; ev.detail = { dim: 'folds', level: 3 };
    x = o(); x.kind = 'drill'; H.pickHook(plan, b.rec, b.def, x, { run: {} });
    t.ok(x.weak === null && x.filter({ lv: [3, 0, 0] }) && !x.filter({ lv: [2, 0, 0] }), 'a drill: the level, and no weak-spot item on top (conflict 10)');
    let drills = 0;
    for (let i = 0; i < 2000; i++) if (H.kindHook(plan, b.rec, b.def, 'target', {}) === 'drill') drills++;
    t.ok(drills > 330 && drills < 470, `a drill takes the weak-spot share of target items (${drills}/2000)`);
    t.eq(H.kindHook(plan, b.rec, b.def, 'easy', {}), null, 'only target items become drill items');
    const dims0 = E.dims;
    E.dims = Object.assign({}, dims0 || {}, { room: () => 0 });
    let full = 0;
    for (let i = 0; i < 200; i++) if (H.kindHook(plan, b.rec, b.def, 'target', {}) === 'drill') full++;
    E.dims = dims0;
    t.eq(full, 0, 'no drill item when the deck has no room for another changed target item (E.dims.room, conflict 10)');
    ev.change = 'speed-in-train';
    H.startHook(plan, b.rec, {}, b.now);
    t.eq(plan.share.fold && plan.share.fold.fluency, E.config.plateau.change.fluency, 'Speed inside Train: the fluency share');
    ev.change = 'rest'; ev.trial.restUntil = b.now + 3.5 * DAY;
    t.eq(E.schedule.excluded(b.rec, b.def, b.now + DAY), { why: 'plateau-rest', until: b.now + 3.5 * DAY, by: 'plateau.rest' }, 'rest days: out of automatic choices');
    t.eq(E.schedule.excluded(b.rec, b.def, b.now + 4 * DAY), null, '... until they end');
    t.eq(H.pickHook({ mode: 'free', display: 'large' }, b.rec, b.def, o(), {}), null, 'Free play is never changed');
    ev.change = 'stage-back'; ev.detail = { stage: 2 };
    const res = { stageUps: [{ exId: 'fold', stage: 3 }] };
    b.rec.train.stage.fold = 3;
    P.finish(planFor('fold', 5), b.rec, b.now + DAY, res);
    t.eq([res.stageUps.length, b.rec.train.stage.fold], [0, 2], 'a stage back holds while its trial runs');
  }

  t.section('record: repair, merge, levels, export rows, card');
  {
    const PX = ctx(t), E = PX.engine, P = E.plateau, H = P._;
    const b = build(PX, { sessions: 16, per: 42, theta: flat, seed: 51 });
    P.finish(planFor('fold', 42), b.rec, b.now, { stageUps: [] });
    const ev = b.rec.plateau.list[0];
    const junk = JSON.parse(JSON.stringify(ev));
    junk.text = 'free text'; junk.detail.note = 'x'; junk.verdict = { at: 'yesterday' };
    const rep = H.repair({ v: 1, list: [junk, { exId: 'Bad Id', at: 1 }, 'x', ev] });
    t.eq(rep.list.length, 1, 'invalid entries dropped, one per id');
    t.ok(!('text' in rep.list[0]) && !('note' in rep.list[0].detail) && rep.list[0].verdict === null, 'unknown keys dropped');
    t.eq(H.repair(rep), rep, 'the repair is idempotent');
    const done = JSON.parse(JSON.stringify(ev));
    done.trial.end = ev.at + DAY; done.verdict = { at: ev.at + DAY, words: 'up', diff: 0.9, se: 0.3 };
    const other = Object.assign(JSON.parse(JSON.stringify(ev)), { id: 'nets:5', exId: 'nets', at: 5 });
    const m = H.mergeBox({ v: 1, list: [done] }, { v: 1, list: [ev, other] });
    t.eq(m.list.map((e) => e.id), ['nets:5', ev.id], 'merge: the union, oldest first');
    t.eq(m.list[1].verdict.words, 'up', 'merge: for one id the copy with a verdict');
    const lv = JSON.parse(JSON.stringify(ev.level));
    H.convertLevels(b.rec, 'fold', (x) => x + 10);
    t.eq([ev.level.lv, ev.level.lo, ev.level.hi], [lv.lv + 10, lv.lo + 10, lv.hi + 10], 'a rebase converts the stored levels');
    ev.verdict = { at: ev.at + DAY, words: 'unclear', diff: 0.1, se: 0.3 }; ev.trial.end = ev.at + DAY;
    const rows = H.sourceRows(b.rec);
    t.eq(rows.map((r) => [r.exId, r.data.phase, r.data.change === ev.change, r.data.words]), [['fold', 'fire', true, undefined], ['fold', 'verdict', true, 'unclear']], 'events rows: fire and verdict');
    t.ok(rows.every((r) => Object.values(r.data).every((v) => typeof v === 'string' && /^[A-Za-z0-9_.:@-]{1,64}$/.test(v))), 'tokens only');
    t.eq(P.card(b.rec, ev.at + 2 * DAY), ev, 'Today: a verdict of the last 7 days');
    t.eq(P.card(b.rec, ev.at + 9 * DAY), null, '... not after 7 days');
    b.rec.ui.plateau = { hide: { [ev.id]: ev.at + 30 * DAY } };
    t.eq(P.card(b.rec, ev.at + 2 * DAY), null, 'a hidden card stays hidden');
  }

  t.section('the events table and the record repair (CONTRACT-v1.2 M, O)');
  {
    const PX = ctx(t), E = PX.engine, P = E.plateau;
    if (E.events && E.record) {
      const b = build(PX, { sessions: 16, per: 42, theta: flat, seed: 81 });
      let ev = null;
      for (let g = 0; g < 30 && !ev; g++) {
        const r = { session: { id: 'e' + g }, stageUps: [] };
        P.finish(planFor('fold', 42), b.rec, b.now + g * 1000, r);
        ev = r.plateau.fired[0] || null;
        if (!ev) b.w.session(flat);
      }
      t.ok(!!ev, 'an event');
      if (ev) {
        t.eq(E.events.kinds().plateau, { owner: 'W2-plateau', fields: { id: 'token', phase: 'token', change: 'token', words: 'token' } }, "the 'plateau' kind");
        const rows = E.events.table(b.rec).filter((x) => x.kind === 'plateau');
        t.eq(rows.map((x) => [x.exId, x.data.phase, x.data.change]), [['fold', 'fire', ev.change]], 'the events table holds its fire row');
        const raw = JSON.parse(JSON.stringify(b.rec.plateau));
        raw.list.push({ id: 'x', exId: 'Bad', at: 'now' });
        raw.list[0].note = 'free text';
        const fixed = E.record.repair('plateau')(raw);
        t.ok(fixed.list.length === 1 && !('note' in fixed.list[0]), 'the record repair runs the plateau check (bad entries and unknown keys dropped)');
      }
    } else t.ok(true, 'events.js or record.js not loaded');
  }

  t.section('the words on the cards (js/ui/plateau.js)');
  {
    const e = t.env({ files: [...MANIFEST, 'js/core/keys.js', 'js/core/svg.js', 'js/core/ui.js', 'js/ui/plateau.js'], exercises: false, storage: new SharedStorage() });
    t.ok(!e.loadErrors.length, 'the UI file loads: ' + e.loadErrors.join(' | '));
    installDom(e.document, e.window);
    const PX = e.PX, E = PX.engine, P = E.plateau, U = PX.ui.plateau;
    defineFixtures(PX, { probes: false });
    PX.ui.kit = { panel(o) { const body = PX.ui.h('div.px-panel-body'); return { el: PX.ui.h('section.px-panel', PX.ui.h('h2', o.title || ''), body), body }; } };
    const b = build(PX, { sessions: 16, per: 42, theta: flat, seed: 61 });
    const res = { session: { id: 's' }, stageUps: [] };
    P.finish(planFor('fold', 42), b.rec, b.now, res);
    const ev = res.plateau.fired[0], cfg = E.config.plateau, def = b.def;
    const text = (o) => o.map((x) => x.textContent).join(' ');
    const BAD = /\bIQ\b|smarter|master|guarantee|will improve|brain age|percentile/i;
    const k0 = E.model.styleK('balanced'), g = E.model.refChance(def);
    const cases = {
      'stage-back': { detail: { stage: 2 }, want: ['mixing stage 2 of 5'] },
      drill: { detail: { dim: 'folds', level: 3 }, want: ['1 in ' + Math.round(1 / E.config.weak.share)] },
      'speed-in-train': { detail: {}, want: ['deadline', 'untimed level does not count them'] },
      rest: { detail: { days: 3.5 }, want: ['rests until'] },
      'other-strategy': { detail: { strategy: 'imagery' }, want: ['the other method', 'does not count against it'] },
      'wider-mix': { detail: {}, want: ['within ' + Math.round(100 * cfg.change.widerTol) + ' points', 'instead of ' + Math.round(100 * E.config.select.tol)] },
      'variant-swap': { detail: { variant: 'x' }, want: ['least lately'] },
      'aim-higher': { detail: { k: 0.55 }, want: [Math.round(100 * E.model.target(g, 0.55)) + ' % right instead of ' + Math.round(100 * E.model.target(g, k0)) + ' %'] },
      'stage-forward': { detail: { stage: 4 }, want: ['mixing stage 4 of 5'] },
      'new-variant': { detail: { variant: 'x' }, want: ['instead'] },
    };
    for (const [change, c] of Object.entries(cases)) {
      const x = Object.assign({}, ev, { change, detail: c.detail, trial: Object.assign({}, ev.trial, { restUntil: change === 'rest' ? ev.at + 3.5 * DAY : null }) });
      const words = text(U._.body(x, b.rec, 'fire'));
      t.ok(c.want.every((w) => words.includes(w)), change + ': ' + words.slice(0, 160));
      t.ok(words.includes('your next ' + cfg.trial.sessions + ' ') && words.includes('at least ' + cfg.trial.answers + ' answers'), change + ': the trial period in the words matches the config');
      t.ok(words.includes('level ' + ev.level.lv + ' (likely ' + ev.level.lo + '–' + ev.level.hi + ')') && words.includes((ev.n[1] - ev.n[0]) + ' answers'), change + ': the flat stretch from the event');
      t.ok(!BAD.test(words), change + ': no promise or forbidden word');
    }
    const vd = (words, diff) => text(U._.body(Object.assign({}, ev, { verdict: { at: ev.at + DAY, words, diff, se: 0.3 } }), b.rec, 'verdict'));
    t.ok(/clearly up/.test(vd('up', 0.9)) && /about \d+ levels above/.test(vd('up', 0.9)), 'verdict: clearly up, in levels');
    t.ok(/unclear yet/.test(vd('unclear', 0.1)) && vd('unclear', 0.1).includes(cfg.trial.sessions + ' sessions are few'), 'verdict: unclear yet');
    t.ok(/no change yet/.test(vd('none', -0.5)) && !/didn.t work|failed/i.test(vd('none', -0.5)), 'verdict: no change yet, never "it did not work"');
    t.ok(/long break/.test(vd('unclear', null)), 'verdict: a long break');
    const panel = U.summaryPanel({ mode: 'train', res, rec: b.rec, now: b.now });
    t.ok(panel && panel.invite === 'plateau' && panel.order < 50 && panel.el.querySelector('[data-plateau-event]'), 'the summary panel: before the bests, with the plateau invite');
    t.eq(ev.shown.summary, 1, 'the summary marks the event shown');
    const slot = U.todaySlot({ rec: b.rec, now: b.now + DAY });
    t.ok(slot && slot.after === 'session' && slot.el.textContent.includes('So far: 0 of 3 sessions'), 'Today: after the session slot, with its progress');
    const fast = Object.assign(JSON.parse(JSON.stringify(ev)), { id: 'fold:1', kind: 'faster', change: null, trial: null, rt: { slope: -0.2, se: 0.03 }, at: b.now + 2 * DAY });
    b.rec.plateau.list.push(fast);
    const s2 = U.todaySlot({ rec: b.rec, now: b.now + 2 * DAY + 1000 });
    t.ok(s2 && s2.replace === 'suggest' && s2.el.textContent.includes(Math.round(100 * (1 - Math.exp(-0.2))) + ' % faster'), 'Today: a faster event takes the suggestion\'s place');
    t.ok(!BAD.test(s2.el.textContent), 'faster: no forbidden word');
    const line = U.todayLine({ rec: b.rec, now: b.now + DAY, plan: { exs: ['fold'] } });
    t.ok(line && /session 1 of 3/.test(line.textContent), 'the line under Today\'s plan');
    const hist = U.progressPanel({ rec: b.rec, now: b.now + 3 * DAY });
    t.ok(hist && hist.el.textContent.includes('about ' + cfg.window + ' answers'), 'Progress: the history says the window from the config');
  }
}
