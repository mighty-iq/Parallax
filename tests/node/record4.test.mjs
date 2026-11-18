/* Record format 4 (v1.2 wave 2; docs/dev/CONTRACT-v1.2.md M, T; js/engine/record.js, js/core/store.js):
   saved records of formats 1, 2 and 3 (tests/node/fixtures/records.mjs) upgrade to 4 with every new
   field at its default and nothing else changed but the two documented conversions (measure.form0
   and the probe versions of earlier checks); the upgrade is idempotent; a filled format-4 record
   survives the guard, its backup's import and a merge with itself; broken values are repaired and
   listed; the pooled export of a filled record holds no local day key and no free text, leaves the
   reserved `game` out and carries the header (formatVersion 2, trial columns and codes). */
import { MANIFEST, deepDiff } from './run.mjs';
import { v1Record, v2Record, v3Record, v4Filled } from './fixtures/records.mjs';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 18, 22, 0, 0);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const NEW = ['events', 'plateau', 'bets', 'measure', 'game'];

// The app's field registrations, without exercises (no re-basing in these tests).
function env(t, opts = {}) {
  const e = t.env({ files: [...MANIFEST], exercises: false, now: T0, ...opts });
  const PX = e.PX, S = PX.core.store;
  PX.engine.fields().forEach((f) => S.field(f.key, f.def, f.fix));
  S.field('hygiene', () => ({ tests: [], focus: [] }));
  S.field('reckon', () => ({ v: 1, hist: [] }));
  S.setting('patFocus', { def: false, type: 'bool' });
  S.setting('testPause', { def: null, type: 'json' });
  S.merge = PX.engine.merge;
  return e;
}
const copy = (x) => JSON.parse(JSON.stringify(x));
// The engine's own fields (registered by the engine files, as a saved 1.2 record has them).
function complete(PX, raw) {
  for (const f of PX.engine.fields()) if (!(f.key in raw)) raw[f.key] = f.def();
  if (!('testPause' in raw.settings)) raw.settings.testPause = null;
  return raw;
}
function walk(x, path, out) {
  if (Array.isArray(x)) x.forEach((v, i) => walk(v, path + '[' + i + ']', out));
  else if (x && typeof x === 'object') for (const k of Object.keys(x)) { out.keys.push([path, k]); walk(x[k], path + '.' + k, out); }
  else if (typeof x === 'string') out.strings.push([path, x]);
  return out;
}

export async function run(t) {
  upgrades(t);
  filled(t);
  repairs(t);
  pooled(t);
  checks(t);
  merges(t);
}

function upgrades(t) {
  for (const [name, mk] of [['format 1 (Parallax 1.0)', v1Record], ['format 2 (Parallax 1.1)', v2Record], ['format 3 (1.2.0-test.1)', v3Record]]) {
    t.section('record 4: a saved record of ' + name + ' upgrades');
    const { PX } = env(t), S = PX.core.store, E = PX.engine;
    const raw = mk(T0), log = [];
    const g = S.guard(copy(raw), log);
    t.eq(g.v, 4, 'it is written in format 4');
    t.eq(S.VERSION, 4, 'the store writes format 4');
    t.eq([g.events, g.plateau, g.bets, g.game], [E.record.defaults('events') || { v: 1, rows: [], folded: {} }, E.record.defaults('plateau'), E.record.defaults('bets'), E.record.defaults('game')], 'the new containers take their defaults');
    t.eq(g.measure, { v: 1, form0: 'A' }, "measure.form0 is 'A': the record holds checks, and its first was form A");
    t.eq(g.assess.map((a) => a.pv), [{ cubematch: 1, wordlinks: 1 }, { cubematch: 1, wordlinks: 1 }], 'each earlier check gets the probe versions of format 3');
    const untouched = ['ex', 'mot', 'sessions', 'trials', 'practiceMs', 'achievements', 'streak', 'daily', 'tour', 'idx', 'trialDays'];
    for (const k of untouched) t.eq(deepDiff(g[k], raw[k]), null, k + ' is unchanged');
    t.eq(g.assess.map((a) => { const b = Object.assign({}, a); delete b.pv; return b; }), raw.assess, 'the checks are unchanged but for pv');
    t.ok(!log.includes('v'), 'the upgrade itself is no repair (missing fields are listed, as for every older format)');
    const g2 = S.guard(copy(g));
    t.eq(deepDiff(g2, g), null, 'the upgrade is idempotent (a second guard changes nothing)');
    const fresh = S.guard({ v: raw.v, created: T0 - DAY, updated: T0 - DAY });
    t.eq(fresh.measure.form0, null, 'a record without checks keeps form0 null (drawn at its first baseline)');
  }
}

function filled(t) {
  t.section('record 4: a filled format-4 record survives the guard, its backup and a merge');
  const e = env(t), PX = e.PX, S = PX.core.store;
  const raw = complete(PX, v4Filled(T0)), log = [];
  const g = S.guard(copy(raw), log);
  t.eq(log, [], 'no repair on a valid record: ' + log.join(', '));
  for (const k of Object.keys(raw)) t.eq(deepDiff(g[k], raw[k]), null, k + ' survives the guard');
  e.storage.set(null, S.KEY, JSON.stringify(raw));
  S.load();
  const backup = S.exportJSON();
  const r = S.importJSON(backup);
  t.ok(r.ok && !(r.repairs || []).length, 'its backup imports with no repair: ' + (r.repairs || []).join(', '));
  for (const k of ['events', 'plateau', 'bets', 'measure', 'game', 'trials', 'sessions', 'assess']) t.eq(deepDiff(S.state[k], raw[k]), null, k + ' after a backup and its import');
  const m = PX.engine.merge(copy(raw), copy(raw));
  for (const k of ['events', 'plateau', 'bets', 'measure', 'game', 'trials', 'sessions', 'assess']) t.eq(deepDiff(m[k], raw[k]), null, k + ' after a merge with itself');
  const sessG = g.sessions[g.sessions.length - 1];
  t.eq([sessG.kind, sessG.ext], ['block', { measure: { block: 3 } }], "a session's kind and ext are kept");
  t.eq(g.trials.map((x) => x.length), [12, 13, 19, 18], 'trial rows of every shape are kept');
}

function repairs(t) {
  t.section('record 4: broken values are repaired and listed');
  const { PX } = env(t), S = PX.core.store;
  const raw = v4Filled(T0);
  raw.events = 'oops';
  raw.plateau = { v: 9, list: 'nope', extra: { keep: 1 } };
  raw.measure = { v: 1, form0: 'Z', more: [1, 2] };
  raw.bets = [1, 2];
  raw.game = { v: 1, reach: { high: -3 }, grades: 'x', firsts: {}, mine: { kept: true } };
  raw.sessions.push({ id: 's-d', start: T0, end: T0 + 1000, mode: 'check', trials: 1, right: 1, practiceMs: 1000, exs: [], summary: null, kind: 'Bad Kind!', ext: { big: 'x'.repeat(5000) } });
  const log = [];
  const g = S.guard(copy(raw), log);
  t.eq(g.events, { v: 1, rows: [], folded: {} }, 'a broken events field takes its default');
  t.ok(log.includes('events') && log.includes('bets'), 'and is listed: ' + log.join(', '));
  t.eq(g.plateau, { v: 1, list: [], extra: { keep: 1 } }, "plateau: a list that is not a list empties, v becomes 1, other keys stay (its owner's check comes later)");
  t.eq(g.measure, { v: 1, form0: null, more: [1, 2] }, 'measure: an unknown form becomes null');
  t.eq(g.bets, { v: 1 }, 'bets: a list is not a container');
  t.eq(g.game, { v: 1, reach: { high: 0 }, grades: {}, records: {}, firsts: [], atlas: {}, climb: {}, notes: {}, mine: { kept: true } }, 'game: the named parts keep their types, unknown parts are kept');
  const sd = g.sessions[g.sessions.length - 1];
  t.ok(!('kind' in sd) && !('ext' in sd), "a session's invalid kind and an ext over 4 KB are dropped");
  t.eq(S.guard(copy(g)).plateau, g.plateau, 'a repaired record is stable');
}

function pooled(t) {
  t.section('record 4: the pooled export');
  const e = env(t), PX = e.PX, S = PX.core.store;
  const raw = complete(PX, v4Filled(T0));
  raw.settings.nickname = 'Ada';
  e.storage.set(null, S.KEY, JSON.stringify(raw));
  S.load();
  const p = S.pooled();
  t.eq([p.format, p.formatVersion, p.record], ['parallax-pooled', 2, 4], 'formatVersion 2, record format 4');
  t.eq(p.trialColumns, ['tSec', 'exIndex', 'modeIndex', 'paramsCode', 'seed', 'outcome', 'rtMs', 'value', 'pPredMilli', 'stage', 'display', 'input', 'value2', 'kind', 'layer', 'amode', 'orient', 'dl', 'bOff'], 'the header names the trial columns');
  t.eq([p.codes.kind, p.codes.layer, p.codes.amode, p.codes.orient, p.codes.dl], [S.KINDS, S.LAYERS, S.AMODES, S.ORIENTS, S.DEADLINES], 'and their codes');
  t.ok(['events', 'plateau', 'bets', 'measure'].every((k) => k in p), 'events, plateau, bets and measure are exported');
  t.ok(!('game' in p), "the reserved game container is left out until milestone 5 gives it a rule");
  t.ok(!('nickname' in p) && !('device' in p), 'no nickname or device facts unless asked');
  const w = walk(p, 'p', { keys: [], strings: [] });
  const dayKeys = w.keys.filter(([, k]) => DAY_RE.test(k)), dayStrings = w.strings.filter(([, s]) => DAY_RE.test(s));
  t.eq([dayKeys, dayStrings], [[], []], 'no local day key or day string anywhere');
  t.ok(!w.strings.some(([, s]) => /\s/.test(s) && s.length > 40 && !/^(UTC seconds|probability × 1000|milli-logits)$/.test(s)), 'no sentence in the export');
  t.throws(() => S.header('events', () => 1), /record field/, 'a header key may not shadow a field');
  t.throws(() => S.header('codes', () => 1), /taken/, 'or another header');
  S.header('w2test', (ctx) => ({ trials: ctx.rec.trials.length, opts: !!ctx.opts }));
  t.eq(S.pooled().w2test, { trials: raw.trials.length, opts: true }, 'a registered header gets a copy of the record and the options');
  S.header('w2broken', () => { throw new Error('no'); });
  t.ok(!('w2broken' in S.pooled()), 'a header that throws is left out');
}

function checks(t) {
  t.section("record 4: an owner's stricter repair (E.record.check)");
  const { PX } = env(t), S = PX.core.store, R = PX.engine.record;
  t.throws(() => R.check('events', () => null), /not a reserved container/, 'only the reserved containers take a check');
  R.check('bets', (v) => { v.plan = v.plan && typeof v.plan === 'object' ? v.plan : {}; return v; });
  t.throws(() => R.check('bets', (v) => v), /already added/, 'one check per container');
  const g = S.guard(Object.assign(v4Filled(T0), { bets: { v: 1, plan: 7, kept: 'x' } }));
  t.eq(g.bets, { v: 1, plan: {}, kept: 'x' }, 'the check runs inside the open repair');
  R.check('measure', () => { throw new Error('broken check'); });
  t.eq(S.guard(v4Filled(T0)).measure, { v: 1, form0: null }, 'a check that throws leaves the default');
}

function merges(t) {
  t.section('record 4: two tabs');
  const { PX } = env(t), E = PX.engine;
  const a = v4Filled(T0), b = v4Filled(T0);
  const ev = a.plateau.list[0];
  b.plateau.list[0] = Object.assign(copy(ev), { verdict: { at: T0, words: 'unclear', diff: 0.1, se: 0.33 } });
  b.plateau.list.push(Object.assign(copy(ev), { id: 'rotate:' + T0, at: T0, verdict: null }));
  a.updated = T0 + 50; b.updated = T0 + 10; // a is newer
  a.game.reach.high = 20; b.game.reach.high = 31;
  b.events.rows.push([Math.floor(T0 / 1000), 'wtg', 'rotate', { result: 'done', ms: 90000, tries: 4, right: 4 }]);
  const m = E.merge(copy(a), copy(b));
  t.eq(m.plateau.list.map((x) => [x.id, !!x.verdict]), [[ev.id, true], ['rotate:' + T0, false]], 'plateau events: the union by id, the one with a verdict kept');
  t.eq(m.game.reach.high, 31, 'Reach never falls: the larger high mark');
  t.eq(m.events.rows.length, a.events.rows.length + 1, 'events: the union of rows');
  t.ok(E.merge.registered().includes('plateau') && E.merge.registered().includes('game') && E.merge.registered().includes('events'), 'events, plateau and game have their own merges');
  t.ok(!E.merge.registered().includes('bets') && !E.merge.registered().includes('measure'), 'bets and measure are left to their owners');
}
