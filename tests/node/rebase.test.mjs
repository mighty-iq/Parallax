/* Re-basing of stored level numbers (v1.2; note D2 §3.0 A; docs/dev/CONTRACT-v1.2.md B;
   js/engine/rebase.js through the store's upgrade hook): a 1.1-shaped save (record format 2) whose
   exercise gained a starter band keeps its ratings and gets its personal best, Path stages and
   session-summary levels converted once; a format-3 record is stamped and never converted twice; a
   later range change converts from the stamp; the V11 table matches every unchanged definition. */
import { createContext } from './run.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 18, 12, 0, 0);

// 'views' as 1.2 makes it: the 1.1 range was [-2.4, 1.9]; a starter level 1.4 below the old floor.
function views12(PX, extra = 0) {
  PX.ex.define({
    id: 'views', code: 'EX-07', name: 'Views', abilities: ['Vz'], cell: null, role: 'train', answer: 'choice', nOptions: 4, version: 2,
    starter: { dim: 'cubes', levels: 1 },
    dims: [{ key: 'cubes', levels: ['3–4', '4–5', '6', '7', '8'], step: 0.6, at: [-1.4, 0, 0.6, 1.2, 1.8] }, { key: 'grid', levels: [3, 4], step: 0.7 + extra }, { key: 'view', levels: [0, 1, 2, 3], step: 0.6 }],
    base: -2.4,
    generate(rng, params) { return { ex: 'views', seed: rng.seed, params, key: 0 }; },
    validate() { return true; },
    score(item, r) { return { correct: r === item.key }; },
  });
}

function save11() {
  return {
    v: 2, rev: 40, created: T0 - 30 * DAY, updated: T0 - DAY, practiceMs: 3600000,
    ex: {
      views: { mu: -0.9, sd: 0.5, n: 120, nRight: 90, last: T0 - DAY, seen: {}, best: { block: { level: 30, acc: 0.8, n: 10, at: T0 - 3 * DAY, beats: 2 } }, hist: [['2026-11-17', -0.9, 0.5]] },
      rotate: { mu: 0.2, sd: 0.5, n: 80, nRight: 60, last: T0 - DAY, seen: {}, best: { block: { level: 41, acc: 0.8, n: 10, at: T0 - 2 * DAY, beats: 0 } }, hist: [] },
    },
    path: {
      views: { stage: 3, ema: 0.7, items: 6, gema: 0.8, passed: { 1: { at: T0 - 9 * DAY, iv: 1, next: T0 + DAY, held: true, maxHeld: 3, last: T0 - 2 * DAY }, 2: { at: T0 - 4 * DAY, iv: 0, next: T0 - DAY, held: true, maxHeld: 0, last: null } }, watched: { 1: true, 2: true, 3: true } },
      rotate: { stage: 2, ema: 0.6, items: 3, passed: { 1: { at: T0 - 9 * DAY, iv: 0, next: T0, held: true, maxHeld: 0, last: null } }, watched: {} },
    },
    sessions: [{ id: 's1', start: T0 - 3 * DAY, end: T0 - 3 * DAY + 900000, mode: 'train', trials: 30, right: 22, practiceMs: 900000, exs: ['views', 'rotate'], summary: { ex: [['views', 20, 15, 22, 30], ['rotate', 10, 7, 40, 41]] } }],
    trials: [], idx: { ex: [], mode: [] },
  };
}

// 'rotate' on its exact 1.1 range [−1.75, 2.45]: a range that did not change.
function rotate11(PX) {
  PX.ex.define({
    id: 'rotate', code: 'EX-02', name: 'Rotate', abilities: ['SR'], cell: null, role: 'train', answer: 'choice', nOptions: 4,
    dims: [{ key: 'angle', levels: [0, 1, 2, 3, 4, 5, 6], step: 0.7 }], base: -1.75,
    generate(rng, params) { return { ex: 'rotate', seed: rng.seed, params, key: 0 }; },
    validate() { return true; },
    score(item, r) { return { correct: r === item.key }; },
  });
}

function env(define) {
  const X = createContext({ store: true, exercises: false });
  rotate11(X.PX);
  define(X.PX);
  X.PX.engine.fields().forEach((f) => X.PX.core.store.field(f.key, f.def, f.fix));
  return X;
}

export async function run(t) {
  t.section('rebase: a 1.1 save whose exercise gained a starter band');
  {
    const X = env((PX) => views12(PX)), PX = X.PX, S = PX.core.store, E = PX.engine;
    const def = PX.ex.get('views'), r = E.model.range(def);
    t.near(r.min, -3.8, 1e-9, 'the fixture\'s new floor is −3.8 (1.1: −2.4)');
    t.near(r.max, 1.9, 1e-9, '…and its top stays 1.9');
    const conv = E.rebase.conv([-2.4, 1.9], [r.min, r.max]);
    const raw = save11(), log = [];
    const g = S.guard(JSON.parse(JSON.stringify(raw)), log);
    t.eq(g.v, 3, 'the record is written in format 3');
    t.eq([g.ex.views.mu, g.ex.views.sd, g.ex.views.n], [-0.9, 0.5, 120], 'the rating (logits) is unchanged');
    t.eq(g.ex.views.best.block.level, conv(30), 'the personal best is converted: ' + 30 + ' → ' + conv(30));
    t.ok(g.ex.views.best.block.level > 30, 'a best on the wider range reads higher');
    t.eq(g.ex.rotate.best.block.level, 41, 'an exercise whose range did not change keeps its best');
    t.eq(g.sessions[0].summary.ex, [['views', 20, 15, conv(22), conv(30)], ['rotate', 10, 7, 40, 41]], 'session-summary levels are converted for the re-based exercise only');
    // Path: old tops −1.97 and −1.54 (stages 1, 2 of [−2.4, 1.9]); new stage tops −3.23, −2.66, −2.09, −1.52, …
    const p = g.path.views;
    t.eq(Object.keys(p.passed).map(Number).sort((a, b) => a - b), [1, 2, 3], 'new stages whose top is at or below the passed old tops are passed');
    t.eq([p.passed[1].at, p.passed[3].at], [raw.path.views.passed[1].at, raw.path.views.passed[1].at], 'each keeps the recheck data of the old stage that covers it');
    t.eq([p.stage, p.items, p.ema, 'gema' in p, Object.keys(p.watched).length], [4, 0, E.config.path.start, false, 0], 'the current stage follows; its moving average restarts');
    t.eq([g.path.rotate.stage, g.path.rotate.passed, g.path.rotate.ema], [2, raw.path.rotate.passed, 0.6], 'an unchanged exercise keeps its Path');
    t.eq(g.scales.views, [-3.8, r.max], 'the range is stamped');
    t.ok(Array.isArray(g.scales.rotate), 'every defined exercise is stamped');
    t.ok(!log.some((x) => /upgrade/.test(x)), 'no hook failed');
    // idempotent: a second pass (now format 3) changes nothing
    const g2 = S.guard(JSON.parse(JSON.stringify(g)));
    t.eq([g2.ex.views.best, g2.path.views, g2.sessions[0].summary], [g.ex.views.best, g.path.views, g.sessions[0].summary], 'a second pass converts nothing');
    // load → save → load through the store itself
    X.storage.set(null, 'parallax.v1', JSON.stringify(raw));
    S.load();
    t.eq(S.state.ex.views.best.block.level, conv(30), 'load() converts a stored 1.1 record');
    S.save(); X.clock.tick(6000);
    S.load();
    t.eq(S.state.ex.views.best.block.level, conv(30), 'and a reload keeps the converted value');
    // import of a 1.1 backup
    const imp = S.importJSON(JSON.stringify(raw));
    t.ok(imp.ok && S.state.ex.views.best.block.level === conv(30), 'importing a 1.1 backup converts it');
  }

  t.section('rebase: format-3 records and later range changes');
  {
    const X = env((PX) => views12(PX)), PX = X.PX, S = PX.core.store, E = PX.engine;
    const now = E.model.range(PX.ex.get('views'));
    const v3 = Object.assign(save11(), { v: 3, scales: { views: [Math.round(now.min * 1e4) / 1e4, Math.round(now.max * 1e4) / 1e4] } });
    const g = S.guard(JSON.parse(JSON.stringify(v3)));
    t.eq(g.ex.views.best.block.level, 30, 'a stamped record on the current range is not converted');
    const fresh = S.guard({ v: 3 });
    t.ok(fresh.scales && Array.isArray(fresh.scales.views), 'a record without stamps in format 3 is stamped as it is');
    // a later version moves the range again: convert from the stamp, not from V11
    const Y = env((PY) => views12(PY, 0.4)), Q = Y.PX, RQ = Q.engine.model.range(Q.ex.get('views'));
    const g3 = Q.core.store.guard(JSON.parse(JSON.stringify(g)));
    t.eq(g3.ex.views.best.block.level, Q.engine.rebase.conv(g.scales.views, [RQ.min, RQ.max])(g.ex.views.best.block.level), 'a later range change converts from the stamp');
  }

  t.section('rebase: a fresh store record is stamped; hooks registered by later waves run');
  {
    const X = env((PX) => views12(PX)), PX = X.PX, S = PX.core.store, E = PX.engine;
    const seen = [];
    E.rebase.register((rec, id, conv, from, to) => { seen.push([id, conv(50), from[0], to[0]]); if (rec.grades && rec.grades[id]) rec.grades[id] = conv(rec.grades[id]); });
    const g = S.guard(Object.assign(save11(), { grades: { views: 30 } }));
    t.eq(seen.length, 1, 'a registered converter runs once per re-based exercise');
    t.eq(seen[0][0], 'views', '…with its id');
    t.ok(!('grades' in g), 'unknown top-level fields are still dropped by the guard (a later wave registers its field)');
    S.load();
    t.ok(S.state.scales && Array.isArray(S.state.scales.views), 'a fresh record is stamped at load');
  }

  t.section('rebase: V11 matches every definition whose version is unchanged');
  {
    const X = createContext({}), PX = X.PX, E = PX.engine;
    let same = 0;
    for (const def of PX.ex.list()) {
      const v = E.rebase.V11[def.id];
      if (!v) continue;
      if ((def.version || 1) !== v[2]) continue; // re-versioned in 1.2: its range may have changed
      const r = E.model.range(def);
      t.ok(E.rebase.sameRange([v[0], v[1]], [r.min, r.max]), def.id + ': V11 range ' + v[0] + '…' + v[1] + ' matches the unchanged definition');
      same++;
    }
    t.ok(same >= 10, same + ' unchanged definitions checked');
  }
}
