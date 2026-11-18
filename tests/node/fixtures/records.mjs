/* Saved records of each format, for the migration tests (tests/node/record4.test.mjs; docs/dev/
   CONTRACT-v1.2.md M). Shapes follow what each version wrote (ARCHITECTURE.md §8, ENGINE.md §15):
     v1Record(T0)  Parallax 1.0: format 1, 10-column trial rows
     v2Record(T0)  Parallax 1.1: format 2, display and input columns, value2, session extras,
                   Section runs, the test-hygiene log and Reckon's route history
     v3Record(T0)  Parallax 1.2 wave 1 (1.2.0-test.1): format 3, scales, the new settings, rounds
     v4Filled(T0)  format 4 with every wave-2 field filled as the contract shapes it
   All data come from a simulated player; times are UTC. Exercise ids are real ones, but the tests
   define no exercises, so re-basing leaves the levels alone. */

const DAY = 86400000;

function base(T0, v) {
  return {
    v, rev: 12, created: T0 - 30 * DAY, updated: T0 - DAY,
    settings: { sessionMin: 20, weeklyGoal: 3, theme: 'auto', reducedMotion: 'auto', sound: false, keyHints: true, textScale: 1, lastBackup: 0 },
    ex: {
      rotate: { mu: 0.4, sd: 0.5, n: 60, nRight: 44, last: T0 - DAY, seen: { 'angle=2,axis=1': 3 }, best: { block: { level: 31, acc: 0.8, n: 10, at: T0 - 2 * DAY, beats: 1 } }, hist: [['2026-11-16', 0.3, 0.55], ['2026-11-17', 0.4, 0.5]] },
    },
    mot: { core: [{ date: '2026-11-10', threshold: 1.15 }] },
    sessions: [{ id: 's-a', start: T0 - 2 * DAY, end: T0 - 2 * DAY + 900000, mode: 'train', trials: 40, right: 30, practiceMs: 900000, exs: ['rotate'], summary: null }],
    trials: [],
    practiceMs: 900000,
    achievements: { 'all-exercises': '2026-11-15T10:00:00.000Z' },
    streak: { goals: [['2026-11-09', 3]] },
    daily: { '2026-11-17': { n: 8, right: 6 } },
    assess: [
      { date: new Date(T0 - 20 * DAY).toISOString(), form: 'A', kind: 'B1', results: { cubematch: { right: 11, n: 16, theta: 0.2, se: 0.5 }, wordlinks: { right: 12, n: 16, theta: 0.4, se: 0.5 } } },
      { date: new Date(T0 - 19 * DAY).toISOString(), form: 'B', kind: 'B2', results: { cubematch: { right: 12, n: 16, theta: 0.35, se: 0.5 }, wordlinks: { right: 12, n: 16, theta: 0.45, se: 0.5 } } },
    ],
    tour: { done: true, seen: { rotate: true } },
    ui: { lastRoute: 'home' },
    idx: { ex: ['rotate@1'], mode: ['train'] },
    trialDays: {},
  };
}

export function v1Record(T0) {
  const r = base(T0, 1);
  const t = Math.floor((T0 - 2 * DAY) / 1000);
  r.trials = [[t, 0, 0, 3, 101, 1, 1500, null, 700, 2], [t + 5, 0, 0, 4, 102, 0, 2100, null, 650, 2]];
  return r;
}

export function v2Record(T0) {
  const r = base(T0, 2);
  const t = Math.floor((T0 - 2 * DAY) / 1000);
  r.trials = [[t, 0, 0, 3, 101, 1, 1500, null, 700, 2, 1, 2], [t + 5, 0, 0, 4, 102, 0, 2100, -12.5, 650, 2, 1, 2, 0.83]];
  r.sessions[0] = Object.assign(r.sessions[0], { display: 'small', viewport: '390x844', input: 'touch', ended: 'complete', budgetMs: 1200000 });
  r.settings.patFocus = false;
  r.hygiene = { tests: [], focus: [] };
  r.reckon = { v: 1, hist: [] };
  return r;
}

export function v3Record(T0) {
  const r = v2Record(T0);
  r.v = 3;
  r.scales = { rotate: [-1.75, 2.45] };
  Object.assign(r.settings, { nickname: '', exportDevice: false, gentleMotion: 'auto' });
  r.ui.welcomed = T0 - 29 * DAY;
  r.sessions[0].rounds = { rotate: [4, 310] };
  r.trials[0][3] = 5;
  return r;
}

export function v4Filled(T0) {
  const r = v3Record(T0);
  r.v = 4;
  const t = Math.floor((T0 - DAY) / 1000);
  r.trials.push([t, 0, 0, 3, 103, 1, 1300, null, 720, 3, 2, 1, null, 9, 0, 1, 1, 0, -250], [t + 4, 0, 0, 3, 104, 0, 1800, null, 680, 3, 2, 1, 1.5, 10, 2, 4, 2, 2]);
  r.events = { v: 1, rows: [[t - 60, 'showme', 'rotate', { seed: 104, auto: 1, ms: 5200, steps: 6, replays: 0, closed: 0 }], [t + 10, 'card', 'rotate', { card: 'analytic', src: 'misses', ms: 8000 }]], folded: { 'wtg|rotate': 1 } };
  r.plateau = { v: 1, list: [{ id: 'rotate:' + (T0 - DAY), exId: 'rotate', disp: null, at: T0 - DAY, session: 's-b', kind: 'plateau', n: [0, 640], sessions: 9, days: 9, beta: 0.01, se: 0.06, rt: null,
    level: { lv: 31, lo: 24, hi: 38 }, row: 6, reason: 'narrow-mix', change: 'wider-mix', detail: {}, eligible: ['wider-mix', 'aim-higher'], drawn: 1, seed: 12345,
    trial: { sessions: 3, answers: 120, s0: 9, n0: 640, end: null, restUntil: null }, verdict: null, shown: { summary: 1, today: 0 } }] };
  r.bets = { v: 1, plan: { compare: { seed: 77, periods: [{ n: 1, start: T0 - 10 * DAY, s0: 3, on: ['rotate'] }] } } };
  r.measure = { v: 1, form0: 'B' };
  r.game = { v: 1, reach: { high: 31 }, grades: { rotate: { g: 4, at: T0 - DAY } }, records: {}, firsts: [{ exId: 'rotate', cell: '2,1', at: T0 - DAY }], atlas: {}, climb: {}, notes: {} };
  r.sessions.push({ id: 's-c', start: T0 - DAY, end: T0 - DAY + 220000, mode: 'check', trials: 14, right: 9, practiceMs: 210000, exs: ['cubematch', 'wordlinks'], summary: null, kind: 'block', ext: { measure: { block: 3 } } });
  r.assess.push({ date: new Date(T0 - DAY).toISOString(), form: 'C', kind: 'block', pv: { cubematch: 1, wordlinks: 1 },
    results: { cubematch: { right: 2, n: 3, theta: 0.5, se: 1.1 }, wordlinks: { right: 1, n: 2, theta: 0.3, se: 1.3 } },
    items: { cubematch: [[0.1, 0.5, 1, 2100], [0.4, 0.5, 1, 1900], [0.7, 0.5, 0, 2500]], wordlinks: [[0.2, 0.25, 1, 3000], [0.5, 0.25, 0, null]] } });
  return r;
}
