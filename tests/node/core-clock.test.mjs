/* PX.core.clock: the active-time clock (CONTRACT-v1.1 "Clock API", PLAN M1). Run through
   tests/node/run.mjs (filter: core-clock). The clock loads in a fake browser context (fake
   document, timers and Date.now from run.mjs); its time source here is Date.now (no timing.js). */
import { MANIFEST, T0 } from './run.mjs';

const FILES = [...MANIFEST.filter((f) => !f.startsWith('js/engine/') && f !== 'js/ex/registry.js'), 'js/core/clock.js'];

export async function run(t) {
  formatter(t);
  basics(t);
  reasons(t);
  idle(t);
  hidden(t);
  ticks(t);
  lateTimers(t);
}

function env(t) {
  const e = t.env({ files: FILES, exercises: false });
  return { e, K: e.PX.core.clock, tick: (ms) => e.clock.tick(ms), now: () => e.clock.now };
}

function formatter(t) {
  t.section('clock formatter');
  const { K } = env(t);
  const F = K.fmtMinutes;
  t.eq([F(0), F(-5), F(NaN), F(null)], ['0 min', '0 min', '0 min', '0 min'], 'no time reads 0 min');
  t.eq([F(1), F(42000), F(59999)], ['under 1 min', 'under 1 min', 'under 1 min'], 'under a minute says so');
  t.eq([F(60000), F(89999), F(90000), F(7 * 60000), F(59 * 60000 + 29000)], ['1 min', '1 min', '2 min', '7 min', '59 min'], 'whole minutes, rounded');
  t.eq([F(59 * 60000 + 31000), F(65 * 60000), F(200 * 60000)], ['1 h 00 min', '1 h 05 min', '3 h 20 min'], 'hours and two-digit minutes');
  t.eq([K.fmtLeft(5 * 60000), K.fmtLeft(61000), K.fmtLeft(59000), K.fmtLeft(0), K.fmtLeft(-3)],
    ['about 5 min left', 'about 1 min left', 'less than 1 min left', 'less than 1 min left', 'less than 1 min left'], 'the countdown in minutes');
  t.eq([K.fmtLeft(150000), K.fmtLeft(119000), K.fmtLeft(299999), K.fmtLeft(3659000)],
    ['about 2 min left', 'about 1 min left', 'about 4 min left', 'about 1 h 00 min left'], 'the countdown rounds down: it never claims time that is gone');
}

function basics(t) {
  t.section('clock basics');
  const { K, tick, now } = env(t);
  const C = K.create();
  t.eq([C.activeMs(), C.running(), C.started()], [0, false, false], 'a new clock reads 0 and does not run');
  tick(5000);
  t.eq(C.activeMs(), 0, 'nothing counts before start()');
  C.start();
  tick(30000);
  t.eq(C.activeMs(), 30000, 'it counts while started');
  C.stop();
  tick(30000);
  t.eq([C.activeMs(), C.running()], [30000, false], 'stop() freezes the reading');
  C.start();
  tick(10000);
  t.eq(C.activeMs(), 40000, 'start() after stop() goes on from the same reading');
  t.eq(C.activeMs(now() + 1000), 41000, 'activeMs(t) reads at a given time');
  C.destroy();
  tick(10000);
  t.eq(C.activeMs(), 40000, 'destroy() stops it for good');
  C.start();
  t.eq(C.running(), false, 'a destroyed clock never starts again');
}

function reasons(t) {
  t.section('clock reasons');
  const { K, tick } = env(t);
  const C = K.create({ idleMs: 1e9 });
  const ev = [];
  C.on('pause', (x) => ev.push('pause:' + x.reason));
  C.on('resume', (x) => ev.push('resume:' + x.reason));
  C.start();
  tick(10000);
  t.ok(C.pause('sheet'), 'pause() reports a change');
  tick(100000);
  t.eq(C.activeMs(), 10000, 'the pause sheet stops the clock');
  t.ok(C.pause('modal') && !C.pause('modal'), 'a reason already set changes nothing');
  t.eq(C.reasons(), ['sheet', 'modal'], 'reasons() lists the active reasons');
  C.resume('sheet');
  tick(5000);
  t.eq([C.activeMs(), C.running()], [10000, false], 'it runs only when no reason is left');
  C.resume('modal');
  tick(5000);
  t.eq([C.activeMs(), C.running()], [15000, true], 'the last resume starts it again');
  t.ok(!C.resume('modal'), 'resuming a reason that is not set changes nothing');
  t.eq(ev, ['resume:start', 'pause:sheet', 'resume:modal'], 'pause and resume events name the reason');
  C.pause('user');
  C.stop();
  C.start();
  tick(5000);
  t.eq(C.activeMs(), 15000, 'start() does not override an active reason');
  C.resume('user');
  tick(5000);
  t.eq(C.activeMs(), 20000, 'the caller\'s own reason');
}

function idle(t) {
  t.section('clock idle');
  const { K, e, tick } = env(t);
  const C = K.create({ idleMs: 60000, tickMs: 1e9 });
  let idles = 0;
  C.on('idle', () => idles++);
  C.start();
  tick(70000);
  t.eq([C.activeMs(), C.running(), idles], [60000, false, 1], 'after 60 s without input it stops at the cap: the 10 s beyond never count');
  tick(100000);
  t.eq(C.activeMs(), 60000, 'it stays stopped while nobody is there');
  C.touch(); // what every input event does (pointer, key, wheel, touch, scroll listeners)
  tick(20000);
  t.eq([C.activeMs(), C.running()], [80000, true], 'input resumes it at once');
  C.touch();
  for (let i = 0; i < 5; i++) { tick(50000); C.touch(); }
  t.eq([C.activeMs(), idles], [330000, 1], 'input every 50 s keeps it running');
  tick(65000);
  t.eq([C.activeMs(), idles], [390000, 2], 'a second quiet stretch stops it again at the cap');
  C.pause('sheet');
  C.touch();
  tick(10000);
  t.eq([C.activeMs(), C.reasons()], [390000, ['sheet']], 'input ends idle but not the other reasons');
  C.resume('sheet');
  tick(59000);
  t.eq([C.activeMs(), C.running()], [449000, true], 'a resume restarts the idle countdown');
  C.destroy();
  t.eq(C.activeMs(), 449000, 'destroy keeps the reading');
  void e;
}

function hidden(t) {
  t.section('clock hidden tab');
  const { K, e, tick } = env(t);
  const C = K.create({ idleMs: 1e9 });
  C.start();
  tick(10000);
  e.setHidden(true);
  tick(100000);
  t.eq([C.activeMs(), C.reasons()], [10000, ['hidden']], 'a hidden tab stops the clock (its own visibilitychange listener)');
  e.setHidden(false);
  tick(10000);
  t.eq(C.activeMs(), 20000, 'it goes on when the tab is visible again');
  e.setHidden(true);
  const C2 = K.create({ idleMs: 1e9 });
  C2.start();
  tick(10000);
  t.eq(C2.activeMs(), 0, 'a clock made while the tab is hidden waits for it');
  e.setHidden(false);
  tick(1000);
  t.eq(C2.activeMs(), 1000, 'and starts when it shows');
  C.destroy(); C2.destroy();
  e.setHidden(true);
  e.setHidden(false);
  t.eq(C.running(), false, 'a destroyed clock no longer listens');
}

function ticks(t) {
  t.section('clock ticks');
  const { K, tick } = env(t);
  const C = K.create({ idleMs: 1e9, tickMs: 5000 });
  const seen = [];
  C.on('tick', (x) => seen.push(x.activeMs));
  const off = C.on('tick', () => seen.push('second'));
  off();
  C.start();
  tick(16000);
  t.eq(seen, [5000, 10000, 15000], 'a tick every 5 s while running, with the reading; off() removes a listener');
  C.pause('sheet');
  tick(20000);
  t.eq(seen.length, 3, 'no ticks while stopped');
  C.resume('sheet');
  tick(5000);
  t.eq(seen.slice(3), [21000], 'ticks resume with the clock');
  C.destroy();
  void T0;
}

// The idle cap holds on the reading itself, also when the clock's own timer never comes (a laptop
// waking from sleep, a throttled tab): a scripted time source and timers that never fire.
function lateTimers(t) {
  t.section('clock late timers');
  const { K } = env(t);
  let T = 1000;
  const C = K.create({ idleMs: 60000, tickMs: 5000, now: () => T, win: { setTimeout: () => 1, clearTimeout: () => {} }, doc: null });
  C.start();
  T += 3600000; // an hour of quiet, and no timer ran
  t.eq([C.activeMs(), C.running()], [60000, true], 'activeMs() never counts more than 60 s past the last input');
  C.touch(); // an input before the late timer
  t.eq([C.activeMs(), C.running(), C.reasons()], [60000, true, []], 'an input then resumes from the cap: the hour is not practice');
  T += 10000;
  t.eq(C.activeMs(), 70000, 'and counts on from the input');
  T += 3600000;
  C.stop(); // the page closes before any timer
  t.eq(C.activeMs(), 120000, 'stop() after another quiet hour stores the cap too (60 s past the input)');
  C.start();
  t.eq([C.running(), C.reasons()], [true, []], 'start() after stop() runs again, even after the idle cap (no idle reason left)');
  T += 120000;
  C.pause('sheet');
  t.eq([C.activeMs(), C.reasons()], [180000, ['sheet', 'idle']], 'pause() applies the cap first');
  C.destroy();
}
