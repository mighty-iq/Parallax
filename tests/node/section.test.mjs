/* Section practice engine (js/engine/section.js; v1.1 PLAN M5; R3 §9): shape, alternate forms,
   a run's navigation, voids and replacements, logging (mode 'section', no rating change), the
   end, the review list, the live run that survives a reload, and the record field's repairs.
   Fixture exercises with the six PAT ids keep these checks independent of B5/B6's exercises; when
   the real DAT-style exercises exist, every item of the first forms is generated and validated. */
import fs from 'node:fs';
import path from 'node:path';
import { MANIFEST, pureFiles } from './run.mjs';

const T0 = Date.UTC(2026, 10, 13, 10, 0, 0);
const PAT = ['openings', 'patviews', 'angles', 'patfold', 'cubes', 'form'];
const SECTION = 'js/engine/section.js';
const clone = (x) => JSON.parse(JSON.stringify(x));

// Stub DAT-style exercises: choice items whose key comes from the seed. The stub Painted Cubes,
// like the real one, takes the extra param `ask` (the i-th question about one figure) and lists
// the questions its figure allows in item.asks (here 1 to 4, from the seed).
function define(PX, ids = PAT) {
  ids.forEach((id, i) => {
    PX.ex.define({
      id, code: 'PAT-' + (i + 1), name: id, short: id, abilities: ['Vz'], cell: null, role: 'train', pat: true,
      answer: 'choice', nOptions: 4, base: -2,
      dims: [{ key: 'a', label: 'A', levels: [0, 1, 2, 3, 4], step: 0.5 }, { key: 'b', label: 'B', levels: [0, 1, 2], step: 0.4 }],
      variants: i % 2 ? ['x', 'y'] : undefined,
      extraParams: id === 'cubes' ? ['ask'] : [],
      chance() { return 0.25; },
      generate(rng, params) {
        const item = { ex: id, seed: rng.seed, params, key: rng.int(0, 3) };
        if (id === 'cubes') { item.asks = [1, 2, 3, 4].slice(0, 1 + (rng.seed % 4)); item.ask = item.asks[(params.ask || 0) % item.asks.length]; }
        return item;
      },
      validate() { return true; },
      score(item, r) { return { correct: r === item.key }; },
    });
  });
}

function mk(t, ids) {
  const c = t.context({ files: MANIFEST.includes(SECTION) ? MANIFEST : [...MANIFEST, SECTION], exercises: false });
  t.ok(!c.loadErrors.length, 'section.js loads as a pure file: ' + c.loadErrors.join(' | '));
  define(c.PX, ids);
  return c.PX;
}
function rec0() {
  return { settings: {}, ex: {}, sessions: [], trials: [], idx: { ex: [], mode: [] }, practiceMs: 0, section: { runs: [], next: { full: 1, mini: 1 }, live: null } };
}

export async function run(t) {
  testShape(t);
  testForms(t);
  testRun(t);
  testLogging(t);
  testFinish(t);
  testAskLog(t);
  testLive(t);
  testField(t);
  testReal(t);
}

function testShape(t) {
  t.section('section shape');
  let PX = mk(t);
  const S = PX.engine.section;
  t.eq(S.PARTS, PAT, 'parts in the PAT order: openings, patviews, angles, patfold, cubes, form');
  const full = S.shape('full'), mini = S.shape('mini');
  t.eq([full.items, full.budgetMs, full.perPart], [90, 3600000, 15], 'full: 90 items, 60 minutes');
  t.eq([mini.items, mini.budgetMs, mini.perPart], [30, 1200000, 5], 'mini: 30 items, 20 minutes');
  t.eq(S.shape('nonsense').size, 'mini', 'an unknown size is a mini');
  t.eq([S.fmtMinutes(3600000), S.fmtMinutes(1200000), S.fmtMinutes(800000), S.fmtMinutes(60000)], ['60 minutes', '20 minutes', 'about 13 minutes', '1 minute'], 'fmtMinutes');
  const can = S.shape('full', { can: (d) => d.id !== 'angles' });
  t.eq([can.items, can.budgetMs], [75, 3000000], 'a part this device cannot run is left out, keeping 40 s per item');
  t.eq(can.missing, [{ id: 'angles', why: 'cannot run on this device' }], 'and named with its reason');

  PX = mk(t, ['patviews', 'cubes', 'form']);
  const part = PX.engine.section.shape('mini');
  t.eq(part.parts, ['patviews', 'cubes', 'form'], 'missing exercises are skipped, the order kept');
  t.eq(part.missing.map((m) => m.id), ['openings', 'angles', 'patfold'], 'the missing parts are listed');
  t.ok(part.missing.every((m) => m.why === 'not in this version yet'), 'with their reason');
  t.eq([part.items, part.budgetMs], [15, 600000], '15 items in 10 minutes');
  const none = mk(t, []).engine.section.start(rec0(), { size: 'mini', now: T0 });
  t.ok(typeof none.unavailable === 'string' && none.unavailable.length > 10, 'no part at all: start says why');
}

function testForms(t) {
  t.section('section forms');
  const PX = mk(t), S = PX.engine.section, M = PX.engine.model;
  const a = S.formItems('full', 1, 'openings', 15), b = S.formItems('full', 1, 'openings', 15);
  t.eq(a, b, 'a form is fixed: same size, form and part → same items');
  const PX2 = mk(t);
  t.eq(PX2.engine.section.formItems('full', 1, 'openings', 15), a, 'and the same in a fresh context');
  t.ok(a.length === 15, '15 items');
  t.ok(a.every((x) => x.seed >= 2 ** 31 && x.seed < 2 ** 32), 'shared seeds (≥ 2^31), never training seeds');
  const def = PX.ex.get('openings'), r = M.range(def), lo = r.min + 0.35 * (r.max - r.min), hi = r.min + 0.65 * (r.max - r.min);
  t.ok(a.every((x) => x.b >= lo - 1e-9 && x.b <= hi + 1e-9), 'every item sits in the middle band (35–65 % of the range)');
  t.ok(new Set(a.map((x) => x.code)).size >= 4, 'the band is covered by several settings, not one');
  const all = new Set();
  for (const size of ['full', 'mini']) for (let f = 1; f <= 8; f++) for (const id of PAT) S.formItems(size, f, id, size === 'full' ? 15 : 5).forEach((x) => all.add(x.seed + ':' + (x.params.ask ?? '')));
  t.eq(all.size, 8 * 6 * 20, 'items are unique across sizes, forms and parts (a figure’s questions differ in ask)');
  // Painted Cubes: up to three questions about one figure, together, never the same question twice
  for (const [size, n] of [['full', 15], ['mini', 5]]) {
    for (let f = 1; f <= 6; f++) {
      const c = S.formItems(size, f, 'cubes', n);
      const groups = [];
      c.forEach((x) => { const g = groups[groups.length - 1]; if (g && g.seed === x.seed) g.asks.push(x.params.ask); else groups.push({ seed: x.seed, asks: [x.params.ask] }); });
      const allows = (seed) => 1 + (PX.ex.get('cubes').generate(PX.rng(seed), { a: 0, b: 0 }).asks.length - 1);
      t.ok(c.length === n && groups.every((g) => g.asks.length <= 3 && g.asks.every((a, i) => a === i) && g.asks.length <= allows(g.seed)),
        `cubes ${size} form ${f}: ${groups.length} figures, questions ${groups.map((g) => g.asks.length).join('+')} = ${n}, each figure asked only what it allows`);
      t.eq(new Set(groups.map((g) => g.seed)).size, groups.length, `cubes ${size} form ${f}: a figure's questions stay together`);
    }
  }
  t.ok(S.formItems('full', 2, 'openings', 15).some((x, i) => x.seed !== a[i].seed), 'form 2 differs from form 1');
  const v = S.formItems('mini', 3, 'patviews', 5);
  t.ok(v.every((x) => x.params.variant === 'x' || x.params.variant === 'y'), 'variants are part of the params');
  const rec = rec0();
  t.eq(S.nextForm(rec, 'full'), 1, 'the first form is 1');
  rec.section.next.full = 4;
  t.eq([S.nextForm(rec, 'full'), S.nextForm(rec, 'mini'), S.nextForm({}, 'mini')], [4, 1, 1], 'nextForm per size; missing field → 1');
}

function testRun(t) {
  t.section('section run');
  const PX = mk(t), S = PX.engine.section, rec = rec0();
  const run = S.start(rec, { size: 'mini', now: T0, display: 'small' });
  t.eq([run.size, run.form, run.parts.length, run.budgetMs, run.part, run.index, run.display], ['mini', 1, 6, 1200000, 0, 0, 'small'], 'a mini run starts at part 1, item 1');
  t.eq(run.parts.map((p) => p.exId), PAT, 'its parts in order');
  t.eq(run.parts[0].items.map((x) => x.seed), S.formItems('mini', 1, 'openings', 5).map((x) => x.seed), 'its items are the form’s');
  t.ok(run.parts.every((p) => p.items.every((x) => x.status === 'new' && typeof x.p === 'number' && x.p > 0 && x.p < 1)), 'each item new, with a predicted chance');
  t.eq(clone(run), run, 'a run is plain JSON');
  t.eq(S.start(rec, { size: 'full', form: 7, now: T0 }).form, 7, 'a chosen form');
  t.eq(S.current(run).it, run.parts[0].items[0], 'current() is part 1, item 1');
  t.eq(S.go(run, 9), null, 'go() stays inside the current part');
  t.eq(S.go(run, 3), run.parts[0].items[3], 'go(3)');
  S.visit(run, 3, 1500, T0 + 1000);
  t.eq([run.parts[0].items[3].status, run.parts[0].items[3].visits, run.parts[0].items[3].timeMs], ['seen', 1, 1500], 'visit: seen, counted, timed');
  S.flag(run, 3, true);
  t.ok(run.parts[0].items[3].flag, 'flag on');
  S.flag(run, 3);
  t.ok(!run.parts[0].items[3].flag, 'flag toggles');
  let o = S.answer(run, 0, { response: 2, correct: true, rtMs: 4321.4, input: 'touch' }, T0 + 2000);
  t.eq([o.it.status, o.it.correct, o.it.rtMs, o.it.input, o.replaced], ['answered', true, 4321, 'touch', null], 'answer');
  S.answer(run, 0, { response: 1, correct: false, rtMs: 800 }, T0 + 3000);
  t.eq([run.parts[0].items[0].resp, run.parts[0].items[0].correct, run.parts[0].items[0].rtMs], [1, false, 800], 'a later answer replaces the earlier one');
  o = S.answer(run, 1, { voided: true, voidReason: 'turned' }, T0 + 4000);
  const items = run.parts[0].items;
  t.eq([items[1].status, items[1].voidReason, o.replaced, items.length], ['void', 'turned', 5, 6], 'a void is replaced at the end of its part');
  t.eq([items[5].rep, items[5].replaces, items[5].code, items[5].status], [true, 1, items[1].code, 'new'], 'the replacement keeps the settings');
  t.ok(items[5].seed !== items[1].seed && items[5].seed >= 2 ** 31, 'with a seed of its own');
  t.eq(S.answer(run, 1, { response: 0, correct: true }).it.status, 'void', 'a voided item takes no answer');
  t.eq(S.flag(run, 1, true), null, 'and no flag');
  const info = S.partInfo(run);
  t.eq([info.n, info.answered, info.unanswered, info.voided, info.right], [5, 1, 4, 1, undefined], 'partInfo counts the replacement, not the void, and hides right until the end');
}

function play(S, run, rec, answers, t0) {
  // answers: per part, a list of 'r' (right), 'w' (wrong), 's' (seen, skipped), '-' (never shown), 'v' (void)
  let now = t0, used = 0;
  for (let p = 0; p < run.parts.length; p++) {
    const list = answers[p] || [];
    list.forEach((a, i) => {
      if (a === '-') return;
      now += 5000; used += 5000;
      S.visit(run, i, 5000, now);
      if (a === 'r' || a === 'w') S.answer(run, i, { response: 0, correct: a === 'r', rtMs: 3000 }, now);
      if (a === 'v') S.answer(run, i, { voided: true, voidReason: 'stutter' }, now);
    });
    if (p < run.parts.length - 1) S.endPart(run, rec, now, used);
  }
  return { now, used };
}

function testLogging(t) {
  t.section('section logging');
  const PX = mk(t), S = PX.engine.section, rec = rec0();
  const before = clone(rec.ex);
  const run = S.start(rec, { size: 'mini', now: T0 });
  ['r', 'w', 's', '-', 'v'].forEach((a, i) => {
    if (a === '-') return;
    S.visit(run, i, 1000, T0 + (5 - i) * 1000); // visited in reverse time order
    if (a === 'r' || a === 'w') S.answer(run, i, { response: 0, correct: a === 'r', rtMs: 2000 + i }, T0 + (5 - i) * 1000);
    if (a === 'v') S.answer(run, i, { voided: true }, T0 + (5 - i) * 1000);
  });
  t.eq(rec.trials.length, 0, 'nothing is logged while the part runs');
  const nx = S.endPart(run, rec, T0 + 60000, 60000);
  t.eq(nx, 1, 'endPart moves to part 2');
  t.eq([run.part, run.index, run.parts[1].t0, run.parts[0].t1], [1, 0, 60000, 60000], 'with the part times');
  t.eq(rec.trials.length, 4, 'one row per shown item (the never-shown item and the unshown replacement have none)');
  const mode = rec.idx.mode.indexOf('section');
  t.ok(mode >= 0 && rec.trials.every((r) => r[2] === mode), 'mode name "section"');
  t.eq(rec.trials.map((r) => r[5]).sort(), [0, 1, 2, 3], 'outcomes: right 1, wrong 0, void 2, seen but unanswered 3');
  t.ok(rec.trials.every((r, i) => i === 0 || r[0] >= rec.trials[i - 1][0]), 'rows in time order');
  const right = rec.trials.find((r) => r[5] === 1);
  t.eq([right[6], right[4]], [2000, run.parts[0].items[0].seed], 'the row carries the rt and the seed');
  t.ok(right[8] > 0 && right[8] < 1000, 'and the predicted chance × 1000');
  t.eq(rec.idx.ex[right[1]], 'openings@1', 'exercise as id@version');
  t.eq(rec.ex, before, 'no rating changes');
  t.eq(S.endPart(run, rec, T0 + 70000, 70000), 2, 'the next part');
  t.eq(rec.trials.length, 4, 'a part with nothing shown logs nothing');
}

function testFinish(t) {
  t.section('section finish');
  const PX = mk(t), S = PX.engine.section, rec = rec0();
  const run = S.start(rec, { size: 'mini', now: T0 });
  const { now, used } = play(S, run, rec, [['r', 'r', 'w', 's', 'r'], ['r', 'v', 'w'], ['r'], [], [], []], T0);
  t.eq(run.part, 5, 'played to the last part');
  const res = S.finish(run, rec, now, { usedMs: used, pausedMs: 12345, ended: 'time' });
  t.eq([res.total.n, res.total.right, res.total.answered, res.total.unanswered], [30, 5, 7, 23], 'totals: the void’s replacement counts, unanswered = never answered');
  t.eq(res.parts.map((p) => [p.n, p.right, p.answered, p.voided]), [[5, 3, 4, 0], [5, 1, 2, 1], [5, 1, 1, 0], [5, 0, 0, 0], [5, 0, 0, 0], [5, 0, 0, 0]], 'per part');
  t.eq(res.parts.map((p) => p.reached), [true, true, true, true, true, true], 'every part was reached');
  t.eq(res.parts[0].timeMs, 25000, 'part time from the clock readings');
  t.eq([res.summary.ended, res.summary.usedMs, res.summary.pausedMs, res.summary.form, res.summary.size], ['time', used, 12345, 1, 'mini'], 'the summary');
  t.eq(rec.section.runs.length, 1, 'kept in rec.section.runs');
  t.eq([rec.section.next.mini, rec.section.next.full, rec.section.live], [2, 1, null], 'the next mini form is 2; nothing live');
  const s = rec.sessions[0];
  t.eq([s.mode, s.trials, s.right, s.practiceMs, s.id], ['section', 7, 5, used, run.id], 'a session with mode "section", answered items and active time');
  t.eq(rec.practiceMs, used, 'active time joins the practice total');
  t.eq(rec.trials.length, 9, 'every shown item logged once (5 + 3 with the void + 1; the unshown replacement has no row)');
  t.eq(S.finish(run, rec, now + 5000, { usedMs: 1 }), res, 'finishing twice changes nothing');
  t.eq(rec.sessions.length, 1, 'still one session');
  const again = S.review(res), every = S.review(res, 'all');
  t.eq(again.length, 30 - 5, 'look again: wrong, unanswered or flagged');
  t.eq(every.length, 30, 'all: every item that counts (no void)');
  t.ok(again.every((x) => x.status !== 'answered' || !x.correct || x.flag), 'none of them right and unflagged');
  t.ok(every.every((x) => typeof x.seed === 'number' && x.params && typeof x.exId === 'string'), 'each with what show-me needs');

  const rec2 = rec0(), r2 = S.start(rec2, { size: 'full', now: T0 });
  const res2 = S.finish(r2, rec2, T0 + 1000, { usedMs: 1000, ended: 'user' });
  t.eq([res2.total.answered, rec2.sessions.length, rec2.trials.length, rec2.section.runs.length, rec2.section.next.full], [0, 0, 0, 1, 2], 'ended at once: no session, no rows, the form is used');
  t.eq(res2.parts.map((p) => p.reached), [true, false, false, false, false, false], 'only the first part was reached');
}

// Painted Cubes rows keep the question asked (params.ask) in the value column.
function testAskLog(t) {
  t.section('section logging: several questions about one figure');
  const PX = mk(t), S = PX.engine.section, rec = rec0();
  const run = S.start(rec, { size: 'full', now: T0 });
  while (run.part < 4) S.endPart(run, rec, T0 + 1000, 1000);
  t.eq(run.parts[4].exId, 'cubes', 'part 5 is Painted Cubes');
  const items = run.parts[4].items;
  t.ok(items.every((x) => typeof x.p === 'number'), 'a predicted chance even with the extra param');
  items.slice(0, 3).forEach((x, i) => { S.visit(run, i, 1000, T0 + 2000 + i); S.answer(run, i, { response: 0, correct: true, rtMs: 900 }, T0 + 2000 + i); });
  S.endPart(run, rec, T0 + 9000, 9000);
  const rows = rec.trials.slice(-3);
  t.eq(rows.map((r) => r[7]), items.slice(0, 3).map((x) => x.params.ask), 'the value column holds ask');
  t.eq(rows.map((r) => r[4]), items.slice(0, 3).map((x) => x.seed), 'and the seed is the figure’s');
}

function testLive(t) {
  t.section('section live run');
  const PX = mk(t), S = PX.engine.section, rec = rec0();
  const run = S.start(rec, { size: 'mini', now: T0 });
  S.visit(run, 0, 2000, T0 + 2000);
  S.answer(run, 0, { response: 3, correct: true, rtMs: 1900 }, T0 + 2000);
  S.flag(run, 2, true);
  S.save(rec, run, 2500, 100, T0 + 3000);
  t.eq(rec.section.live, run, 'save() keeps the run in rec.section.live');
  t.eq([run.usedMs, run.pausedMs, run.at], [2500, 100, T0 + 3000], 'with the clock readings');
  const stored = clone(rec);
  const back = S.live(stored);
  t.eq(back, clone(run), 'live() reads it back unchanged after a JSON round trip');
  const field = PX.engine.fields().find((f) => f.key === 'section');
  t.ok(!!field, 'the record field "section" is registered with the engine');
  t.eq(field.fix(clone(rec.section)).live, clone(run), 'the field repair keeps a valid live run');
  const bad = clone(rec.section);
  bad.live.parts[0].items[0].seed = 'x';
  t.eq(field.fix(bad).live, null, 'a damaged live run is dropped');
  const done = clone(rec.section);
  done.live.done = true;
  t.eq(field.fix(done).live, null, 'a finished run is not live');
  const odd = clone(rec.section);
  odd.live.index = 99;
  t.eq(field.fix(odd).live.index, 0, 'an index past the part goes to its first item');
  S.drop(rec);
  t.eq(rec.section.live, null, 'drop()');
}

function testField(t) {
  t.section('section field');
  const PX = mk(t);
  const field = PX.engine.fields().find((f) => f.key === 'section');
  t.eq(field.def(), { runs: [], next: { full: 1, mini: 1 }, live: null }, 'defaults');
  t.eq(field.fix('nope'), undefined, 'not an object → the default');
  t.eq(field.fix({ runs: [{ id: 'a', size: 'mini', start: 1 }, { id: 'b', size: 'huge', start: 1 }, null], next: { full: -3, mini: 5 } }),
    { runs: [{ id: 'a', size: 'mini', start: 1 }], next: { full: 1, mini: 5 }, live: null }, 'bad runs dropped, form numbers clamped');
  const many = { runs: Array.from({ length: 250 }, (_, i) => ({ id: 'r' + i, size: 'full', start: i })) };
  const fixed = field.fix(many);
  t.eq([fixed.runs.length, fixed.runs[0].id], [200, 'r50'], 'the latest 200 runs are kept');
}

// Active script lines of index.html (outside the PENDING blocks): what the app ships.
function activeScripts(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<!-- PENDING[\s\S]*?-->/g, '');
  return new Set([...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]));
}

// The real DAT-style exercises, once they exist: every item of the first forms generates and
// validates. Exercises whose gen.js is still pending in index.html (being built) only warn.
function testReal(t) {
  t.section('section with the real exercises');
  const have = PAT.filter((id) => fs.existsSync(path.join(t.root, 'js/ex', id, 'gen.js')));
  if (!have.length) { t.ok(true, 'no DAT-style exercise yet'); return; }
  const active = activeScripts(t.root), warned = {};
  const fail = (id, msg) => {
    if (active.has(`js/ex/${id}/gen.js`)) { t.fail(msg); return; }
    warned[id] = (warned[id] || 0) + 1;
    if (warned[id] <= 2) console.log(`       ! warning (${id} is still pending in index.html): ${msg}`);
  };
  const c = t.context({ files: [...pureFiles(), SECTION] });
  const PX = c.PX, S = PX.engine.section;
  const ok = have.filter((id) => PX.ex.get(id));
  have.filter((id) => !PX.ex.get(id)).forEach((id) => fail(id, id + ': its gen.js does not register'));
  ok.filter((id) => PX.ex.get(id).pat !== true).forEach((id) => fail(id, id + ': not flagged pat'));
  let n = 0;
  for (const size of ['mini', 'full']) {
    for (let f = 1; f <= 3; f++) {
      for (const id of ok) {
        const def = PX.ex.get(id);
        for (const it of S.formItems(size, f, id, S.SIZES[size].perPart)) {
          let item = null, v;
          try { item = def.generate(PX.rng(it.seed), it.params); v = def.validate(item); } catch (e) { v = String(e && e.message); }
          if (v !== true || !item || item.fallback === true) { fail(id, `${id} ${size} form ${f} seed ${it.seed}: ${v === true ? 'fallback item' : v}`); continue; }
          n++;
        }
      }
    }
  }
  t.ok(n > 0 || !ok.length, n + ' items of the first three forms generate and validate');
  Object.keys(warned).forEach((id) => console.log(`       ! ${id}: ${warned[id]} item(s) of the first forms failed (pending, not counted)`));
  const run = S.start({ settings: {}, ex: {}, sessions: [], trials: [], idx: { ex: [], mode: [] } }, { size: 'mini', now: T0 });
  t.eq(run.parts.map((p) => p.exId), ok, 'a real run has the existing parts in PAT order');
}
