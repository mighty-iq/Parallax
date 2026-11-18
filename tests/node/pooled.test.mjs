/* Export privacy (v1.2; docs/dev/CONTRACT-v1.2.md I; the owner's standing rules, Privacy):
   the backup and the pooled (community) export carry no name but a typed nickname, no user-agent,
   language or time zone unless the player turned device details on, and the pooled export holds no
   local day key (dropped or reduced to undated totals; times stay epoch ms or UTC ISO with a Z). */
import { createContext } from './run.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 18, 22, 30, 0);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Every object key and string value in x, with its path.
function walk(x, path, out) {
  if (Array.isArray(x)) x.forEach((v, i) => walk(v, path + '[' + i + ']', out));
  else if (x && typeof x === 'object') for (const k of Object.keys(x)) { out.keys.push([path, k]); walk(x[k], path + '.' + k, out); }
  else if (typeof x === 'string') out.strings.push([path, x]);
  return out;
}

function fill(S) {
  const s = S.state;
  s.settings.nickname = 'Ada';
  s.ex.rotate = { mu: 0.3, sd: 0.6, n: 40, nRight: 30, last: T0 - DAY, seen: {}, best: { block: { level: 22, acc: 0.8, n: 10, at: T0 - DAY, beats: 1 } }, hist: [['2026-11-17', 0.2, 0.7], ['2026-11-18', 0.3, 0.6]] };
  s.ex.track = { mu: 0.1, sd: 0.6, n: 20, nRight: 15, last: T0, seen: {}, best: {}, hist: [['2026-11-18', 0.1, 0.6]], small: { mu: 0, sd: 0.8, n: 5, nRight: 3, last: T0, hist: [['2026-11-18', 0, 0.8]] } };
  s.daily['2026-11-18'] = { n: 8, right: 6 };
  s.trialDays['2026-11-01'] = { n: 10, right: 5, wrong: 3, stutter: 1, skipped: 1, rtSum: 9000, rtN: 8, ex: { rotate: { n: 10, right: 5, a: 8 } } };
  s.trialDays['2026-11-02'] = { n: 4, right: 2, wrong: 2, stutter: 0, skipped: 0, rtSum: 4000, rtN: 4, ex: { rotate: { n: 4, right: 2 } } };
  s.streak = { weeks: { '2026-11-16': 3 } };
  s.achievements = { 'first-steps': '2026-11-18', 'new-best': new Date(T0).toISOString() };
  s.assess.push({ date: '2026-10-28', form: 'A', results: {} }, { date: new Date(T0).toISOString(), form: 'B', results: {} });
  s.mot.core.push({ date: '2026-11-03', threshold: 1.2 });
  s.timed = { rotate: { sessions: [['2026-11-18', 0.7, 2100, 20, 1]], deadline: 2400, mu: 0.1, sd: 0.5, n: 20, hist: [['2026-11-18', 0.1, 0.5]] } };
  s.sessions.push({ id: 's1', start: T0 - 3600000, end: T0 - 3000000, mode: 'train', trials: 20, right: 15, practiceMs: 600000, exs: ['rotate'], summary: null, viewport: '390x844' });
  S.addTrial({ t: T0 - 3500000, ex: 'rotate', mode: 'train', code: 3, seed: 12, outcome: 1, rt: 1500, value: null });
  s.ui.lastRoute = 'home';
}

export async function run(t) {
  t.section('export privacy: the pooled export');
  {
    const X = createContext({ store: true });
    X.window.navigator = { userAgent: 'UA-SENTINEL/1.0', language: 'xx-SENTINEL' };
    const S = X.PX.core.store;
    X.PX.engine.fields().forEach((f) => S.field(f.key, f.def, f.fix));
    fill(S);
    const P = S.pooled();
    const text = JSON.stringify(P), w = walk(P, '', { keys: [], strings: [] });
    t.eq(w.keys.filter(([, k]) => DAY_RE.test(k)), [], 'no object key is a local day');
    t.eq(w.strings.filter(([, v]) => DAY_RE.test(v)), [], 'no value is a day-only date');
    t.ok(w.strings.filter(([, v]) => /^\d{4}-\d{2}-\d{2}T/.test(v)).every(([, v]) => /Z$/.test(v)), 'every full date is UTC ISO (ends in Z)');
    t.ok(!/Ada/.test(text), 'no nickname unless asked');
    t.ok(!/SENTINEL/.test(text) && !('device' in P), 'no user-agent or language without the switch');
    t.ok(!('settings' in P) && !('ui' in P) && !('daily' in P) && !('streak' in P) && !('tour' in P), 'settings, ui, the Daily by date, the weekly streak and the tour stay out');
    t.ok(!('hist' in P.ex.rotate) && !('hist' in P.ex.track.small) && P.ex.rotate.best.block.level === 22, 'ratings keep their numbers and bests, without the per-day history');
    t.eq(P.trialDays, { n: 14, right: 7, wrong: 5, stutter: 1, skipped: 1, rtSum: 13000, rtN: 12, ex: { rotate: { n: 14, right: 7, a: 8 } }, days: 2 }, 'folded days become one undated total');
    t.eq(P.achievements, ['first-steps', 'new-best'], 'achievements as ids only');
    t.eq([P.assess[0].date, P.assess[1].date], [null, new Date(T0).toISOString()], 'a day-only check date is dropped; UTC ISO dates stay');
    t.eq(P.timed.rotate.sessions[0], [null, 0.7, 2100, 20, 1], "Speed's day column is dropped");
    t.ok(P.trials.length === 1 && P.idx.ex.length === 1 && P.sessions[0].viewport === '390x844', 'trials, their lookup tables and sessions are kept');
    t.ok(!('eng' in P), 'the seed counters stay out');
    t.ok(P.format === 'parallax-pooled' && P.record === S.VERSION, 'the export names its format');
    const P2 = S.pooled({ nickname: true, device: true });
    t.eq(P2.nickname, 'Ada', 'the typed nickname only when asked');
    t.ok(P2.device && P2.device.ua === 'UA-SENTINEL/1.0' && P2.device.lang === 'xx-SENTINEL' && 'tz' in P2.device, 'device details with the switch');
    S.state.settings.exportDevice = true;
    t.ok(S.pooled().device && S.pooled({ device: false }).device === undefined, 'the setting turns device details on; opts.device overrides it');
    S.state.settings.exportDevice = false;
  }

  t.section('export privacy: fields registered by others, and the backup');
  {
    const X = createContext({ store: true });
    const S = X.PX.core.store;
    X.PX.engine.fields().forEach((f) => S.field(f.key, f.def, f.fix));
    S.field('notes', () => ({ list: [] }));
    S.field('playlog', () => ({ ua: '' }), (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : undefined));
    S.field('climb', () => ({ weeks: {} }));
    S.exportRule('playlog', { private: true, pooled: false });
    S.exportRule('climb', { pooled: (v, ctx) => ({ runs: Object.keys(v.weeks).length, at: ctx.utcDay(T0) }) });
    S.state.notes.list.push('x');
    S.state.playlog.ua = 'UA-SENTINEL/2.0';
    S.state.climb.weeks['2026-11-16'] = { best: 9 };
    const P = S.pooled();
    t.ok(!('notes' in P), 'a field without a rule stays out of the pooled export');
    t.ok(!('playlog' in P), 'a private field stays out of it');
    t.eq(P.climb, { runs: 1, at: '2026-11-18' }, 'a field with a rule appears through it (ctx.utcDay gives the UTC day)');
    const B = JSON.parse(S.exportJSON());
    t.ok(!('playlog' in B) && 'notes' in B && 'climb' in B, 'the backup leaves out private fields only');
    t.ok(JSON.parse(S.exportJSON({ device: true })).playlog.ua === 'UA-SENTINEL/2.0', '…unless device details are on');
    t.ok(S.exportJSON().startsWith('{"v":' + S.VERSION + ',"rev":'), 'the backup keeps its head');
    // a backup re-imports cleanly: the private field it leaves out is no repair (long run, 18 Nov)
    const back = S.exportJSON(), imp = S.importJSON(back);
    t.ok(imp.ok && imp.repairs.length === 0, 'a backup re-imports without repairs (' + JSON.stringify(imp.repairs) + ')');
    t.ok(S.state.playlog.ua === '' && S.state.notes.list[0] === 'x', '…the private field starts empty, the others come back');
    const broken = JSON.parse(back); broken.playlog = 'not an object';
    t.ok(S.importJSON(JSON.stringify(broken)).repairs.indexOf('playlog') >= 0, '…but a private field that is there and broken is still a repair');
    t.throws(() => S.exportRule('x', { pooled: 'yes' }), /pooled must be/, 'a pooled rule must be a function or false');
  }
}
