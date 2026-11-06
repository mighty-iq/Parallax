/* PX.core.timing: frame-accurate timing (ARCHITECTURE.md §4, CLAUDE.md rule 6).
   All times are on the performance.now() timeline, the same one rAF timestamps and
   event.timeStamp use, so answer times can be measured against the paint timestamp.
   nextPaint() → Promise<t>   resolves in the rAF after the DOM change is committed (double rAF)
   loop(fn(dtMs, now)) → stop  dt clamped to 100 ms; paused while the document is hidden
                               (the first dt after resuming is 0); fn returning false stops it
   monitor(opts) → { stop() → {frames, medianMs, p95Ms, dropped, maxGapMs, stutter, contextLost,
                               meanMs, hidden} }
   wait(ms) → Promise          plain timeout, for reveal pauses and the like
   now() → ms */
(function (PX) {
  'use strict';

  var win = window;
  var MAX_DT = 100;       // ms; longer frames are clamped so motion never jumps
  var STUTTER_GAP = 150;  // ms; one gap longer than this marks the trial as stuttered (motion is time-based, so shorter gaps never misplace anything; exercises with fast motion add their own rule, e.g. Track voids on jumps > 1.5 sphere diameters)
  var DROP_FACTOR = 1.5;  // a frame longer than 1.5 × the median frame time counts as dropped
  var DROP_SHARE = 0.15;  // more dropped frames than this share of all frames marks it as stuttered (5 % voided most trials on slow devices)

  function doc() { return win.document || null; }

  function now() {
    return win.performance && win.performance.now ? win.performance.now() : Date.now();
  }

  // Without rAF (very old engines) fall back to ~60 Hz timers on the same timeline.
  function raf(cb) {
    if (win.requestAnimationFrame) return win.requestAnimationFrame(cb);
    return win.setTimeout(function () { cb(now()); }, 16);
  }
  function caf(id) {
    if (win.cancelAnimationFrame) win.cancelAnimationFrame(id);
    else win.clearTimeout(id);
  }

  // The first rAF runs before the frame that paints the change; the second runs at the
  // start of the next frame, so its timestamp is the best estimate of stimulus onset.
  function nextPaint() {
    return new Promise(function (resolve) {
      raf(function () { raf(function (t) { resolve(t); }); });
    });
  }

  function loop(fn) {
    var id = 0, last = -1, stopped = false, paused = false;
    var d = doc();

    function frame(t) {
      id = 0;
      if (stopped || paused) return;
      var dt = last < 0 ? 0 : t - last;
      if (dt < 0) dt = 0;
      if (dt > MAX_DT) dt = MAX_DT;
      last = t;
      var r;
      try { r = fn(dt, t); } catch (e) { stop(); throw e; }
      if (r === false) { stop(); return; }
      if (!stopped && !paused) id = raf(frame);
    }
    function onVisibility() {
      if (stopped) return;
      if (d.hidden) {
        paused = true;
        if (id) { caf(id); id = 0; }
      } else if (paused) {
        paused = false;
        last = -1; // time spent hidden is never integrated into motion
        if (!id) id = raf(frame);
      }
    }
    function stop() {
      if (stopped) return;
      stopped = true;
      if (id) { caf(id); id = 0; }
      if (d && d.removeEventListener) d.removeEventListener('visibilitychange', onVisibility);
    }

    if (d && d.addEventListener) d.addEventListener('visibilitychange', onVisibility);
    if (d && d.hidden) paused = true;
    else id = raf(frame);
    return stop;
  }

  // Frame monitor for stimulus phases. It only stores timestamps while running; the
  // statistics are computed in stop(). The §4 rule: a frame is dropped when it is longer
  // than 1.5 × the median frame time (relative, so it holds at 30, 60 or 120 Hz: a fixed
  // 16.7 ms limit would flag a quarter of smooth 60 Hz frames, which measure 16.8 ms);
  // stutter = maxGap > 150 ms, or dropped > 15 % of frames, or a WebGL context loss during
  // the phase (PX.core.stage3d emits 'stage3d:lost' on the bus; opts.contextLost() is an
  // extra check for other sources).
  function monitor(opts) {
    var times = [], id = 0, active = true, hidden = false, lost = false, result = null;
    var start = now();
    var d = doc();
    var offLost = PX.bus && PX.bus.on ? PX.bus.on('stage3d:lost', function () { lost = true; }) : null;

    function frame(t) {
      if (!active) return;
      times.push(t);
      id = raf(frame);
    }
    function onVisibility() { if (d.hidden) hidden = true; }

    if (d && d.addEventListener) d.addEventListener('visibilitychange', onVisibility);
    if (d && d.hidden) hidden = true;
    id = raf(frame);

    function stop() {
      if (result) return result;
      active = false;
      if (id) caf(id);
      if (d && d.removeEventListener) d.removeEventListener('visibilitychange', onVisibility);
      if (offLost) offLost();
      if (opts && typeof opts.contextLost === 'function') {
        try { if (opts.contextLost()) lost = true; } catch (e) { /* a broken probe must not break the trial */ }
      }
      var end = now();
      var gaps = [], sum = 0, maxGap = 0, i;
      for (i = 1; i < times.length; i++) {
        var g = times[i] - times[i - 1];
        gaps.push(g);
        sum += g;
        if (g > maxGap) maxGap = g;
      }
      // A freeze between the last frame and stop() is a stall during the stimulus. The time
      // before the first frame is not counted: it holds the stimulus set-up, which happens
      // before onset (the answer clock starts at the paint). No frame at all: the whole span.
      if (times.length) maxGap = Math.max(maxGap, end - times[times.length - 1]);
      else maxGap = end - start;
      var q = PX.util.quantile;
      var median = gaps.length ? q(gaps, 0.5) : 0;
      var dropped = 0;
      for (i = 0; i < gaps.length; i++) if (gaps[i] > DROP_FACTOR * median) dropped++;
      var frames = times.length;
      result = {
        frames: frames,
        medianMs: median,
        p95Ms: gaps.length ? q(gaps, 0.95) : 0,
        dropped: dropped,
        maxGapMs: maxGap,
        contextLost: lost,
        meanMs: gaps.length ? sum / gaps.length : 0,
        hidden: hidden, // reported only: hiding stops rAF, so the gap rule catches it
        stutter: maxGap > STUTTER_GAP || dropped > DROP_SHARE * frames || lost, // the §4 rule
      };
      return result;
    }
    return { stop: stop };
  }

  function wait(ms) {
    return new Promise(function (resolve) { win.setTimeout(resolve, Math.max(0, ms || 0)); });
  }

  PX.core.timing = {
    now: now, nextPaint: nextPaint, loop: loop, monitor: monitor, wait: wait,
    MAX_DT: MAX_DT, STUTTER_GAP: STUTTER_GAP, DROP_FACTOR: DROP_FACTOR, DROP_SHARE: DROP_SHARE,
  };
})(window.PX);
