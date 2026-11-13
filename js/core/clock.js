/* PX.core.clock: the active-time clock (docs/dev/CONTRACT-v1.1.md "Clock API";
   docs/research/v1.1/I1-timing-bugs.md §6). One clock measures a session's practice time, and
   that one number feeds the session's end, the stored practice time, the HUD, the summary, the
   Log, the share card and the weekly goal.

   It runs only while started and while no pause reason is active. Reasons are flags (setting one
   twice is the same as once): 'sheet' (the pause sheet), 'modal' (any modal or sheet), 'hidden'
   (the tab is hidden; the clock listens for visibilitychange itself), 'idle' (no input for
   opts.idleMs, default 60 s: the clock stops at the moment the quiet stretch reaches the cap, so
   the stretch beyond it never counts; any input resumes it) and 'user' (a caller's own).
   Time comes from PX.core.timing.now() (performance.now(): monotonic, immune to changes of the
   wall clock), else Date.now(); opts.now overrides both (tests).

     C = PX.core.clock.create(opts)   opts: { idleMs: 60000, tickMs: 5000, now: fn, doc, win }
     C.start(t?)                     starts counting (again after stop())
     C.stop(t?)                      freezes the reading (a session's end)
     C.pause(reason, t?) / C.resume(reason, t?)
     C.activeMs(t?)                  active time so far, ms
     C.running() · C.started() · C.reasons() → ['modal', …] · C.idleMs
     C.touch(t?)                     activity without an input event (keeps 'idle' away)
     C.poll(t?)                      the idle and tick check (the clock's own timer calls it)
     C.on(evt, fn) → off             'tick' { activeMs } every tickMs while running; 'idle' when the
                                     idle cap stops it; 'pause' / 'resume' { reason } on changes
     C.destroy()                     stops it and removes its listeners and timer
   PX.core.clock.fmtMinutes(ms)    the one formatter for practice time: '0 min', 'under 1 min',
                                   '7 min', '1 h 05 min' (whole minutes, rounded)
   PX.core.clock.fmtLeft(ms)       the HUD countdown, whole minutes rounded down (it never claims time
                                   that is gone): 'about 7 min left', 'less than 1 min left'
   Listeners only store a time stamp, so the clock does no work during stimulus phases (rule 7). */
(function (PX) {
  'use strict';

  var win = window;
  // Input that shows someone is there. A person's scroll always comes with one of these (a touch,
  // the wheel, a key, a drag); 'scroll' itself is not listened to, because the app's own scrolling
  // (bringing the item or its marks into view) fires it too and would look like someone there.
  var DOC_INPUTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
  var REASONS = ['sheet', 'modal', 'hidden', 'idle', 'user'];

  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function defaultNow() {
    var T = PX.core && PX.core.timing;
    if (T && typeof T.now === 'function') return T.now();
    return Date.now();
  }

  // Whole minutes, rounded; under a minute says so instead of "0 min" or "1 min".
  function fmtMinutes(ms) {
    if (!isNum(ms) || ms <= 0) return '0 min';
    if (ms < 60000) return 'under 1 min';
    var m = Math.round(ms / 60000);
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h ' + pad2(m % 60) + ' min';
  }
  // The countdown rounds down, so it never claims time that is gone: 2:30 left is "about 2 min".
  function fmtLeft(ms) {
    if (!isNum(ms) || ms < 60000) return 'less than 1 min left';
    var m = Math.floor(ms / 60000);
    return 'about ' + (m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + pad2(m % 60) + ' min') + ' left';
  }

  function create(opts) {
    opts = opts || {};
    var idleMs = isNum(opts.idleMs) && opts.idleMs > 0 ? opts.idleMs : 60000;
    var tickMs = isNum(opts.tickMs) && opts.tickMs > 0 ? opts.tickMs : 5000;
    var d = opts.doc !== undefined ? opts.doc : (win.document || null);
    var w = opts.win || win;
    var nowFn = typeof opts.now === 'function' ? opts.now : defaultNow;
    var reasons = {}, acc = 0, runStart = 0, isRunning = false, on = false, dead = false;
    var lastInput = nowFn(), timer = null, nextTick = 0, subs = {};

    function t0(t) { return isNum(t) ? t : nowFn(); }
    function anyReason() { for (var k in reasons) if (reasons[k] === true) return true; return false; }
    function emit(evt, data) {
      var list = (subs[evt] || []).slice();
      for (var i = 0; i < list.length; i++) {
        try { list[i](data); } catch (e) { if (win.console) console.error('PX.core.clock: a "' + evt + '" listener failed', e); }
      }
    }

    function clearTimer() {
      if (timer !== null) { try { w.clearTimeout(timer); } catch (e) { /* ignore */ } timer = null; }
    }
    // One timer while running: at the next tick or at the idle cap, whichever comes first.
    function schedule(t) {
      clearTimer();
      if (!isRunning || dead || typeof w.setTimeout !== 'function') return;
      var at = Math.min(nextTick, lastInput + idleMs);
      timer = w.setTimeout(function () { timer = null; poll(); }, Math.max(0, at - t));
    }

    // Starts or stops the running span after a change; `at` backdates a stop (the idle cap).
    function sync(t, reason, at) {
      var want = on && !dead && !anyReason();
      if (want && !isRunning) {
        isRunning = true;
        runStart = t;
        lastInput = Math.max(lastInput, t); // a resume is someone coming back
        nextTick = t + tickMs;
        schedule(t);
        emit('resume', { reason: reason || null, activeMs: acc });
      } else if (!want && isRunning) {
        var end = isNum(at) ? Math.min(t, Math.max(runStart, at)) : t;
        acc += Math.max(0, end - runStart);
        isRunning = false;
        clearTimer();
        emit('pause', { reason: reason || null, activeMs: acc });
      }
    }

    // The idle cap on the reading itself: running time never counts more than idleMs past the last
    // input, even when the clock's own timer comes late (a laptop waking from sleep, a throttled
    // tab), so the cap holds whichever of activeMs, touch, pause, stop or poll comes first.
    function capIdle(t) {
      if (dead || !isRunning || reasons.idle === true || t - lastInput < idleMs) return false;
      reasons.idle = true;
      sync(t, 'idle', lastInput + idleMs);
      emit('idle', { activeMs: acc, since: lastInput });
      return true;
    }

    function activeMs(t) {
      t = t0(t);
      if (!isRunning) return acc;
      var end = Math.min(t, Math.max(runStart, lastInput + idleMs)); // a pure read: capped, never mutated
      return acc + Math.max(0, end - runStart);
    }

    function poll(t) {
      t = t0(t);
      if (dead) return;
      if (capIdle(t)) return;
      if (isRunning && t >= nextTick) {
        nextTick = t + tickMs;
        emit('tick', { activeMs: activeMs(t) });
      }
      schedule(t);
    }

    function pause(reason, t) {
      reason = String(reason || 'user');
      if (reasons[reason] === true) return false;
      t = t0(t);
      capIdle(t);
      reasons[reason] = true;
      sync(t, reason);
      return true;
    }
    function resume(reason, t) {
      reason = String(reason || 'user');
      if (reasons[reason] !== true) return false;
      delete reasons[reason];
      t = t0(t);
      if (reason === 'idle' || reason === 'hidden') lastInput = Math.max(lastInput, t);
      sync(t, reason);
      return true;
    }

    function touch(t) {
      t = t0(t);
      capIdle(t); // a quiet stretch past the cap ends at the cap, even if no timer said so
      lastInput = Math.max(lastInput, t);
      if (reasons.idle === true) resume('idle', t);
    }

    function onInput() { if (!dead) touch(); }
    function onVisibility() {
      if (dead || !d) return;
      if (d.hidden) pause('hidden'); else resume('hidden');
    }

    function listen(add) {
      var m = add ? 'addEventListener' : 'removeEventListener';
      if (d && typeof d[m] === 'function') {
        d[m]('visibilitychange', onVisibility);
        DOC_INPUTS.forEach(function (type) { d[m](type, onInput, { capture: true, passive: true }); });
      }
    }
    listen(true);
    if (d && d.hidden) reasons.hidden = true;

    var C = {
      idleMs: idleMs,
      start: function (t) {
        if (dead) return C;
        t = t0(t);
        on = true;
        delete reasons.idle; // starting is someone there
        lastInput = Math.max(lastInput, t);
        sync(t, 'start');
        return C;
      },
      stop: function (t) { t = t0(t); capIdle(t); on = false; sync(t, 'stop'); return C; },
      pause: pause,
      resume: resume,
      activeMs: activeMs,
      running: function () { return isRunning; },
      started: function () { return on; },
      reasons: function () { return REASONS.concat(Object.keys(reasons).filter(function (k) { return REASONS.indexOf(k) < 0; })).filter(function (k) { return reasons[k] === true; }); },
      touch: touch,
      poll: poll,
      on: function (evt, fn) {
        if (typeof fn !== 'function') return function () {};
        (subs[evt] || (subs[evt] = [])).push(fn);
        return function off() { var l = subs[evt] || [], i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
      },
      destroy: function (t) {
        if (dead) return;
        C.stop(t);
        dead = true;
        clearTimer();
        listen(false);
        subs = {};
      },
    };
    return C;
  }

  PX.core.clock = { create: create, fmtMinutes: fmtMinutes, fmtLeft: fmtLeft, REASONS: REASONS };
})(window.PX);
