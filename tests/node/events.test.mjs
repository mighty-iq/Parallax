/* The events table (v1.2 wave 2; docs/dev/CONTRACT-v1.2.md O; js/engine/events.js): kinds and their
   typed fields (no free text gets in), add, the cap with folded counts, list and count, the export
   table with sources (check-ins from rec.strategies), the store's repair, the pooled export and the
   two-tab merge. */
import { MANIFEST } from './run.mjs';

const T0 = Date.UTC(2026, 10, 18, 21, 0, 0);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function recOf() { return { events: { v: 1, rows: [], folded: {} }, strategies: [] }; }

export async function run(t) {
  kinds(t);
  adding(t);
  capAndCount(t);
  table(t);
  repair(t);
  store(t);
}

function kinds(t) {
  t.section('events: kinds');
  const V = t.PX.engine.events;
  const k = V.kinds();
  t.eq(Object.keys(k).filter((x) => ['showme', 'card', 'wtg', 'suggest', 'checkin'].includes(x)).sort(), ['card', 'checkin', 'showme', 'suggest', 'wtg'], "W2-core's kinds are defined");
  t.eq(k.showme, { owner: 'W2-core', fields: { seed: 'seed', auto: 'bool', ms: 'int', steps: 'int', replays: 'int', closed: 'bool' } }, 'with typed fields');
  t.throws(() => V.define('showme', { owner: 'x', fields: {} }), /already defined/, 'a kind is defined once');
  t.throws(() => V.define('Bad Kind', { owner: 'x', fields: {} }), /lower-case/, 'a kind is a lower-case name');
  t.throws(() => V.define('freetext', { owner: 'x', fields: { note: 'text' } }), /needs a type/, 'there is no text type');
  t.throws(() => V.define('nofields', { owner: 'x' }), /owner, fields/, 'a kind needs its owner and fields');
  V.define('w2probe', { owner: 'test', fields: { n: 'int', x: 'num', ok: 'bool', tag: 'token', seed: 'seed', at: 'ms', items: 'list' } });
  t.ok(V.kinds().w2probe && V.kinds().w2probe.owner === 'test', 'another owner defines its own kind');
}

function adding(t) {
  t.section('events: add');
  const V = t.PX.engine.events;
  if (!V.kinds().w2probe) V.define('w2probe', { owner: 'test', fields: { n: 'int', x: 'num', ok: 'bool', tag: 'token', seed: 'seed', at: 'ms', items: 'list' } });
  const rec = recOf();
  const row = V.add(rec, 'w2probe', 'fold', { n: 3.6, x: 0.25, ok: true, tag: 'a.b:c@1-2_3', seed: 4294967295, at: T0, items: [[1, 2, 'x'], [3, 4, 'y']], extra: 9 }, T0 + 1500);
  t.eq(row, [Math.floor((T0 + 1500) / 1000), 'w2probe', 'fold', { n: 4, x: 0.25, ok: 1, tag: 'a.b:c@1-2_3', seed: 4294967295, at: T0, items: [[1, 2, 'x'], [3, 4, 'y']] }], 'a row: UTC seconds, kind, exercise, typed data (unknown fields dropped)');
  t.eq(rec.events.rows.length, 1, 'it is stored');
  const bad = V.add(rec, 'w2probe', null, { n: 'x', x: Infinity, ok: 'yes', tag: 'two words', seed: -1, at: -5, items: [{ a: 1 }] }, T0 + 2000);
  t.eq(bad[3], null, 'values of the wrong type are dropped, and data without a valid field is null');
  t.eq(V.add(rec, 'w2probe', null, { tag: 'I typed my name here' }, T0)[3], null, 'a sentence is not a token: free text never gets in');
  t.eq(V.add(rec, 'w2probe', null, { tag: 'x'.repeat(65) }, T0)[3], null, 'nor does a token over 64 characters');
  t.eq(V.add(rec, 'w2probe', null, { items: Array.from({ length: 21 }, () => 1) }, T0)[3], null, 'lists hold at most 20 items');
  t.eq(V.add(rec, 'w2probe', null, { items: [[[[1]]]] }, T0)[3], null, 'and nest two levels at most');
  t.eq(V.add(rec, 'nokind', null, {}, T0), null, 'an unknown kind is refused');
  t.eq(V.add(rec, 'w2probe', 'Not An Id', {}, T0), null, 'an invalid exercise id is refused');
  t.eq(V.add(rec, 'w2probe', null, {}, NaN), null, 'an invalid time is refused');
  const r2 = { };
  V.add(r2, 'showme', 'rotate', { seed: 12, auto: false, ms: 4200.4, steps: 5, replays: 0, closed: 1 }, T0);
  t.eq(r2.events, { v: 1, rows: [[T0 / 1000, 'showme', 'rotate', { seed: 12, auto: 0, ms: 4200, steps: 5, replays: 0, closed: 1 }]], folded: {} }, 'a record without the field gets it');
  V.add(r2, 'showme', 'rotate', { seed: 13 }, T0 - 5000);
  t.eq(r2.events.rows.map((r) => r[3].seed), [13, 12], 'a row from an earlier time keeps the time order');
}

function capAndCount(t) {
  t.section('events: the cap, folded counts, list and count');
  const V = t.PX.engine.events;
  const rec = recOf();
  for (let i = 0; i < V.CAP + 7; i++) V.add(rec, i % 2 ? 'card' : 'showme', i % 3 ? 'fold' : null, { ms: i }, T0 + i * 1000);
  t.eq(V.CAP, 5000, 'the cap is 5,000 rows');
  t.eq(rec.events.rows.length, V.CAP, 'beyond it the oldest rows go');
  t.eq(Object.values(rec.events.folded).reduce((a, b) => a + b, 0), 7, 'into folded counts');
  t.eq(rec.events.rows[0][0], Math.floor((T0 + 7000) / 1000), 'the newest stay');
  const nShow = Array.from({ length: V.CAP + 7 }, (_, i) => i).filter((i) => i % 2 === 0).length;
  t.eq(V.count(rec, 'showme'), nShow, 'count() includes folded rows');
  const nShowFold = Array.from({ length: V.CAP + 7 }, (_, i) => i).filter((i) => i % 2 === 0 && i % 3).length;
  t.eq(V.count(rec, 'showme', 'fold'), nShowFold, 'by exercise');
  const nShowNone = Array.from({ length: V.CAP + 7 }, (_, i) => i).filter((i) => i % 2 === 0 && !(i % 3)).length;
  t.eq(V.count(rec, 'showme', null), nShowNone, 'and without one');
  const l = V.list(rec, { kind: 'card', exId: 'fold', since: T0 + 100000, until: T0 + 110000 });
  t.ok(l.length > 0 && l.every((e) => e.kind === 'card' && e.exId === 'fold' && e.t >= T0 + 100000 && e.t <= T0 + 110000), 'list() filters by kind, exercise and time');
  t.eq(Object.keys(l[0]).sort(), ['data', 'exId', 'kind', 't'], 'as { t (ms), kind, exId, data }');
  l[0].data.ms = -1;
  t.ok(V.list(rec, { kind: 'card' }).every((e) => e.data.ms >= 0), 'list() returns copies');
}

function table(t) {
  t.section('events: the export table and its sources');
  const V = t.PX.engine.events;
  const rec = recOf();
  V.add(rec, 'card', 'nets', { card: 'imagery', src: 'misses', ms: 9000 }, T0 + 60000);
  rec.strategies = [{ exId: 'rotate', strategy: 'whole', t: T0 }, { exId: 'nets', strategy: 'parts', t: T0 + 120000 }, { bad: true }];
  t.throws(() => V.source('checkin', () => []), /already has a source/, 'one source per kind');
  V.source('w2plat', (r) => [{ t: T0 + 30000, exId: 'fold', data: { id: 'fold:1', phase: 'fire', words: 'a sentence would be dropped' } }]);
  const tab = V.table(rec);
  t.eq(tab.map((e) => [e.t, e.kind, e.exId]), [[T0, 'checkin', 'rotate'], [T0 + 30000, 'w2plat', 'fold'], [T0 + 60000, 'card', 'nets'], [T0 + 120000, 'checkin', 'nets']], 'stored and sourced rows, by time');
  t.eq(tab[0].data, { answer: 'whole' }, 'check-ins come from rec.strategies');
  t.eq(tab[1].data, { id: 'fold:1', phase: 'fire' }, 'sourced data keeps tokens only');
}

function repair(t) {
  t.section("events: the store's repair and the two-tab merge");
  const V = t.PX.engine.events;
  const v = {
    v: 1, rows: [
      [T0 / 1000 + 5, 'card', 'fold', { card: 'imagery', src: 'howto', ms: 1200, note: 'free text' }],
      [T0 / 1000, 'showme', null, null],
      ['x', 'card', null, null], [T0 / 1000, 'Bad', null, null], [T0 / 1000, 'card', 'Bad Id', null],
      [T0 / 1000 + 9, 'future-kind', 'nets', { a: 1, b: 'tok', c: [1, 'x'], d: 'two words', e: { deep: 1 } }],
    ],
    folded: { 'card|fold': 3, 'bad key': 2, 'showme|-': -1 },
  };
  const f = V.fix(v);
  t.eq(f.rows.map((r) => r[1]), ['showme', 'card', 'future-kind'], 'broken rows go, the rest in time order');
  t.eq(f.rows[1][3], { card: 'imagery', src: 'howto', ms: 1200 }, "a known kind keeps its own fields only");
  t.eq(f.rows[2][3], { a: 1, b: 'tok', c: [1, 'x'] }, "a kind this build does not know keeps numbers, tokens and lists only");
  t.eq(f.folded, { 'card|fold': 3 }, 'valid folded counts are kept');
  t.eq(V.fix('nope'), undefined, 'a broken field is replaced by its default');
  const a = { v: 1, rows: [[100, 'card', 'fold', { ms: 1 }], [200, 'card', 'fold', { ms: 2 }]], folded: { 'card|fold': 4 } };
  const b = { v: 1, rows: [[100, 'card', 'fold', { ms: 1 }], [150, 'showme', null, { seed: 3 }]], folded: { 'card|fold': 2, 'showme|-': 1 } };
  const m = V._.merge(a, b);
  t.eq(m.rows.map((r) => r[0]), [100, 150, 200], 'the merge unites both sides, each row once, in time order');
  t.eq(m.folded, { 'card|fold': 4, 'showme|-': 1 }, 'folded: the larger count per key');
  t.eq(V._.merge(undefined, b).rows.length, 2, 'a side without the field');
  // round 10 (RV-code-1.2 L4): two tabs share 5,000 rows, one adds 10 (its cap folds its 10 oldest): 5,010 events, not 5,020
  const total = (x) => x.rows.length + Object.values(x.folded).reduce((p, q) => p + q, 0);
  const base = { events: { v: 1, rows: [], folded: {} } };
  for (let i = 0; i < 5000; i++) V.add(base, 'showme', 'rotate', { seed: i, auto: 1, ms: 100, steps: 3, replays: 0, closed: 0 }, 1e12 + i * 1000);
  const A = JSON.parse(JSON.stringify(base)), B = JSON.parse(JSON.stringify(base));
  for (let i = 0; i < 10; i++) V.add(A, 'showme', 'rotate', { seed: 9000 + i, auto: 1, ms: 100, steps: 3, replays: 0, closed: 0 }, 2e12 + i * 1000);
  t.eq([total(V._.merge(A.events, B.events)), total(V._.merge(B.events, A.events))], [5010, 5010], 'full tables: each event counted once, whichever side merges (5,010)');
  for (let i = 0; i < 25; i++) V.add(B, 'card', 'fold', { card: 'imagery', src: 'howto', ms: 10 }, 3e12 + i * 1000);
  const mAB = V._.merge(A.events, B.events);
  t.eq([total(mAB), mAB.rows.length], [5035, 5000], 'both sides folded, each its own new rows: 5,035 events, 5,000 rows kept');
}

function store(t) {
  t.section('events: in the record, the pooled export and two tabs');
  const e = t.env({ files: [...MANIFEST], exercises: false, now: T0 });
  const PX = e.PX, S = PX.core.store;
  PX.engine.fields().forEach((f) => S.field(f.key, f.def, f.fix));
  S.merge = PX.engine.merge;
  S.load();
  t.eq(S.state.events, { v: 1, rows: [], folded: {} }, 'a fresh record has the field');
  PX.engine.events.add(S.state, 'wtg', 'fold', { result: 'done', ms: 95000, tries: 4, right: 3 }, T0);
  S.save(); S.flush();
  const back = JSON.parse(e.storage.get(S.KEY));
  t.eq(back.events.rows, [[T0 / 1000, 'wtg', 'fold', { result: 'done', ms: 95000, tries: 4, right: 3 }]], 'it is saved');
  const pooled = S.pooled();
  t.eq(pooled.events, back.events, 'the pooled export carries it as is');
  const walk = (x, out) => { if (Array.isArray(x)) x.forEach((v) => walk(v, out)); else if (x && typeof x === 'object') Object.keys(x).forEach((k) => { out.push(k); walk(x[k], out); }); else if (typeof x === 'string') out.push(x); return out; };
  t.ok(!walk(pooled.events, []).some((s) => DAY_RE.test(s)), 'with no local day key');
  t.ok(PX.engine.merge.registered().includes('events'), 'events has its own two-tab merge');
}
