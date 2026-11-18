/* Playtest mode (js/ui/playtest.js; v1.2 milestone 2; CONTRACT-v1.2 G): the build flag and the
   setting, what the log records from the player's events (performance, frames in items, sessions,
   errors, where the player is and quit), the three taps and notes, the report's sections, the
   privacy of the log (left out of backups unless device details are on, never in the community
   export, no folder paths), repairs of a damaged log, caps, nothing recorded while off, and that
   it survives a save and a reload. */
import fs from 'node:fs';
import path from 'node:path';
import { MANIFEST, SharedStorage } from './run.mjs';

const FILE = 'js/ui/playtest.js';
const T0 = Date.UTC(2026, 10, 18, 16, 0, 0);

function env(t, storage) {
  const e = t.env({ files: [...MANIFEST, FILE], exercises: false, storage: storage || new SharedStorage(), now: T0 });
  t.ok(!e.loadErrors.length, 'playtest.js loads in Node: ' + e.loadErrors.join(' | '));
  return e;
}
const frames = { frames: 60, medianMs: 16.7, p95Ms: 17.4, maxGapMs: 33.5, dropped: 1, stutter: false };

export async function run(t) {
  testFlag(t);
  const storage = new SharedStorage();
  testLog(t, storage);
  testReload(t, storage);
  testPrivacy(t);
  testFix(t);
}

function testFlag(t) {
  t.section('build flag and setting');
  const src = fs.readFileSync(path.join(t.root, FILE), 'utf8');
  t.eq((src.match(/var BUILD = '(test|release)';/g) || []).length, 1, 'one build flag, a constant at the top of the file');
  const { PX } = env(t);
  const T = PX.ui.playtest, s = PX.core.store.state.settings;
  t.eq(s.playtest, 'auto', 'the setting starts at auto (follow the build)');
  t.eq(T.on(), false, 'off until the app is ready');
  PX.bus.emit('app:ready', {});
  t.eq(T.on(), T.BUILD === 'test', 'auto: on in a test build, off in a release');
  s.playtest = 'off';
  t.eq(T.on(), false, 'off when switched off');
  T.set(true);
  t.ok(T.on() && s.playtest === 'on', 'set(true) switches it on');
  T.set(false);
  t.ok(!T.on() && s.playtest === 'off', 'set(false) switches it off');
  // browser automation sees the release behaviour unless the test switches the mode on
  const e2 = env(t);
  e2.window.navigator = { webdriver: true };
  e2.PX.bus.emit('app:ready', {});
  t.eq(e2.PX.ui.playtest.on(), false, 'auto is off under browser automation');
  e2.PX.ui.playtest.set(true);
  t.eq(e2.PX.ui.playtest.on(), true, 'and on when a test switches it on');
}

function testLog(t, storage) {
  t.section('the log');
  const e = env(t, storage);
  const { PX } = e;
  const T = PX.ui.playtest, bus = PX.bus, R = PX.core.store.state;
  PX.core.store.state.settings.playtest = 'on';
  bus.emit('app:ready', {});
  bus.emit('route', { cur: { name: 'library', params: {} } });
  bus.emit('play:screen', { screen: 'session', mode: 'train', exId: 'rotate' });
  bus.emit('play:trial', { mode: 'train', exId: 'rotate', practice: false, outcome: 1, rtMs: 2100, timeout: false, voidReason: null, frames });
  bus.emit('play:trial', { mode: 'train', exId: 'rotate', practice: false, outcome: 0, rtMs: 3300, timeout: true, voidReason: null, frames: { ...frames, stutter: true, maxGapMs: 120 } });
  bus.emit('play:trial', { mode: 'train', exId: 'rotate', practice: false, outcome: 1, rtMs: 900, voidReason: 'stutter', frames: null });
  bus.emit('play:trial', { mode: 'train', exId: 'fold', practice: true, outcome: 'right', rtMs: 5000, frames });
  bus.emit('play:session', { mode: 'train', ended: false, practiceMs: 61000, answered: 3, right: 2, exIds: ['rotate', 'fold'] });
  bus.emit('play:error', { where: 'present', message: 'boom' });
  bus.emit('play:error', { where: 'present', message: 'boom' });
  e.dispatch('error', { target: e.window, message: 'TypeError: x is undefined', filename: 'file:///home/someone/parallax/js/ui/play.js', lineno: 77 });
  const L = R.playtest;
  t.eq([L.ex.rotate.n, L.ex.rotate.right, L.ex.rotate.timeouts, L.ex.rotate.voids, L.ex.rotate.rts], [2, 1, 1, 1, [2100]], 'answers, right ones, late ones, voided ones and right answer times per exercise');
  t.eq([L.ex.fold.practice, L.ex.fold.right], [1, 1], 'practice answers count as practice');
  t.eq([L.stim.rotate.trials, L.stim.rotate.dropped, L.stim.rotate.stutter, L.stim.rotate.gapMax], [2, 2, 1, 120], 'frame timings of items');
  t.eq(L.sessions.length, 1, 'the session');
  t.eq(L.errors.map((x) => [x.message, x.n]), [['boom', 2], ['TypeError: x is undefined', 1]], 'errors, a repeat counted once');
  t.eq(L.errors[1].at, 'play.js:77', 'an error keeps its file name and line, never a folder path');
  t.ok(L.trail.some((x) => x[1] === 'library') && L.trail.some((x) => /^play:session \(train rotate\)$/.test(x[1])), 'the trail of screens');
  t.ok(L.visits.length === 1 && L.visits[0].last === 'play:session (train rotate)', 'where the player is now');
  // three taps
  const o = { exId: 'rotate', mode: 'train', key: 'k1' };
  t.ok(T.rate(o, 'fun', 4) && T.rate(o, 'clarity', 5) && T.rate(o, 'diff', 'hard'), 'three taps');
  t.eq(T.rate(o, 'fun', 9), null, 'a value off the scale is refused');
  t.eq(T.rate(o, 'speed', 3), null, 'an unknown dimension is refused');
  T.rate(o, 'fun', 3);
  t.eq(L.ratings.length, 1, 'taps on the same row update one rating');
  t.eq([L.ratings[0].fun, L.ratings[0].clarity, L.ratings[0].diff], [3, 5, 'hard'], 'the latest tap wins');
  T.rate({ exId: 'daily', mode: 'daily', key: 'k2' }, 'diff', 'right');
  t.eq(L.ratings.length, 2, 'another row, another rating');
  // notes
  t.eq(T.addNote('  ', 'x'), 0, 'an empty note is not saved');
  t.eq(T.addNote('The fold demo runs too fast', 'play:summary (train)'), 1, 'a note');
  t.eq(T.addNote('x'.repeat(1500)), 2, 'a long note');
  t.eq(L.notes[1].text.length, 1000, 'notes keep at most 1000 characters');
  // visible time and where the player quit
  e.clock.tick(5 * 60000);
  e.setHidden(true);
  t.ok(L.visits[0].ms >= 5 * 60000 - 1, 'visible time counted up to the moment the page was hidden');
  e.setHidden(false);
  const rep = T.report();
  for (const part of ['PARALLAX PLAYTEST REPORT', 'device: ua', 'played: 1 visit', 'ratings (fun 1-5, clarity 1-5, difficulty):', 'rotate [train]: fun 3, clarity 5, difficulty hard', 'Daily Challenge [daily]: fun -, clarity -, difficulty right',
    'notes:', '"The fold demo runs too fast"', 'performance:', 'rotate: 2 answered, 1 right, median right 2.1 s, 1 late, 1 voided', 'sessions:', '2 answered', 'frames in items:', 'rotate: 2 items', 'errors:', '"boom" x2', '"TypeError: x is undefined" at play.js:77', 'where you quit (last visits):', 'last on play:session (train rotate)', 'trail:']) {
    t.ok(rep.includes(part), 'the report has: ' + part);
  }
  t.ok(!/\/home\//.test(rep), 'no folder path in the report');
  t.eq(T.counts().notes, 2, 'counts');
  // off: nothing recorded
  T.set(false);
  bus.emit('play:trial', { mode: 'train', exId: 'rotate', outcome: 1, rtMs: 100, frames });
  t.eq(L.ex.rotate.n, 2, 'nothing is recorded while the mode is off');
  t.eq(T.addNote('ignored'), 0, 'no notes while off');
  T.set(true);
  PX.core.store.save();
  PX.core.store.flush();
}

function testReload(t, storage) {
  t.section('after a reload');
  const { PX } = env(t, storage);
  PX.bus.emit('app:ready', {});
  const L = PX.core.store.state.playtest;
  t.ok(L.notes.length === 2 && L.ratings.length === 2 && L.ex.rotate.n === 2, 'the log survives a save and a reload');
  t.eq(L.visits.length, 2, 'a new visit');
  PX.ui.playtest.clear();
  t.ok(PX.core.store.state.playtest.notes.length === 0 && PX.core.store.state.playtest.visits.length === 1, 'clear() empties the log and starts a visit');
}

function testPrivacy(t) {
  t.section('privacy');
  const { PX } = env(t);
  const st = PX.core.store;
  st.state.settings.playtest = 'on';
  PX.bus.emit('app:ready', {});
  PX.ui.playtest.addNote('a note', 'home');
  t.ok(!('playtest' in JSON.parse(st.exportJSON())), 'a backup leaves the playtest log out');
  t.ok('playtest' in JSON.parse(st.exportJSON({ device: true })), 'unless device details are on');
  st.state.settings.exportDevice = true;
  t.ok('playtest' in JSON.parse(st.exportJSON()), 'the Settings switch does the same');
  t.ok(!('playtest' in st.pooled({ device: true, nickname: true })), 'never in the community export');
}

function testFix(t) {
  t.section('repairs and caps');
  const { PX } = env(t);
  const fix = PX.ui.playtest.fix;
  t.eq(fix(null), undefined, 'not an object: the default');
  const f = fix({
    ratings: [{ t: 1, ex: 'rotate', fun: 9, clarity: 2, diff: 'meh' }, { t: 'x', ex: 'a' }],
    notes: [{ t: 1, text: 'y'.repeat(2000), where: 'home' }, { t: 2 }],
    errors: [{ t: 1, message: 'm', n: 'a' }],
    frames: [[1, 'boot', 90, 60, 16.7, 17, 18, 0.2, 0], [1, 2, 3]],
    sessions: [{ t: 1, ex: 'rotate' }, { t: 2, ex: ['fold', 3], ms: -5 }],
    visits: [{ start: 1 }],
    trail: [[1, 'home'], ['x', 'y']],
    ex: { rotate: { n: 'a', right: 2, rts: [1, 'b'] }, 'Bad Id': { n: 1 } },
    stim: { rotate: { trials: 3, junk: 1 } },
  });
  t.eq([f.ratings.length, f.ratings[0].fun, f.ratings[0].clarity, f.ratings[0].diff], [1, null, 2, null], 'ratings: values off the scale dropped');
  t.eq([f.notes.length, f.notes[0].text.length], [1, 1000], 'notes: cut to 1000 characters, empty ones dropped');
  t.eq(f.errors[0].n, 1, 'errors: a bad count becomes 1');
  t.eq(f.frames.length, 1, 'frames: malformed samples dropped');
  t.eq(f.sessions.map((s) => [s.ex, s.ms]), [[[], 0], [['fold'], 0]], 'sessions: exercise lists and times repaired');
  t.eq(f.visits[0], { start: 1, ms: 0, last: '?', lastAt: 1 }, 'visits: defaults filled');
  t.eq(f.trail, [[1, 'home']], 'trail: malformed entries dropped');
  t.eq(f.ex, { rotate: { n: 0, right: 2, practice: 0, timeouts: 0, voids: 0, rts: [1] } }, 'performance: repaired, bad ids dropped');
  t.eq(f.stim, { rotate: { trials: 3, medSum: 0, p95Max: 0, gapMax: 0, dropped: 0, stutter: 0 } }, 'frame totals: only known fields');
  const many = fix({ notes: Array.from({ length: 250 }, (_, i) => ({ t: i, text: 'n' + i })) });
  t.eq([many.notes.length, many.notes[0].text], [200, 'n50'], 'notes keep the latest 200');
}
