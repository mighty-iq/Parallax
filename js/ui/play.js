/* PX.ui.play: the trial player, sessions for every mode, feedback and Watch, Try, Go
   (PHASE-3 brief; ARCHITECTURE.md §6, §9; PLAN.md §5, §7, §8; docs/dev/ENGINE.md §17).
   tests/dev/harness.js is the reference for the trial flow; this file copies it.

   A trial: ready (generate, the grid laid out but hidden, drawOption for every option) →
   present (the stem; the grid shows in the same frame; the answer clock starts at the paint
   timestamp present resolves with) → respond (grid or the view's collect) → reveal (icon, word
   and colour within 0.5 s; the right answer; show me) → next. Nothing is saved from ready to
   reveal (store.hold / release). A frame monitor runs over present; when present lasted long
   enough to be a moving or timed stimulus, its verdict voids the trial (unless the view judged
   itself, like Track). 'trial:void', ctx.voidTrial, 'stage3d:lost' and item.fallback void it too;
   voided trials are logged as stutters and never rated. Esc pauses (the view owns Esc during
   its stimulus); a second pause keeps the first pause's start; the item is hidden while paused;
   Skip this item counts nowhere.

   Keys: 1–9 pick · Enter confirm (pick two) or next · Space next · Esc pause · S show me ·
   ? keys · during show me: Space pause, → step, R replay, Esc close.

   PX.ui.play
     watch(exId)          Watch, Try, Go for one exercise (the play screen, mode 'watch')
     howTo(exId)          a short How to play sheet (goal, parts, keys, strategy cards)
     player(opts)         a trial player (check.js and tour.js use it): see createPlayer below
     wtg(P, exId, opts)   Watch, Try, Go inside a player → Promise<'done' | 'skipped' | 'none'>
     canRun(def)          true when this device can show the exercise (view registered, WebGL)
     settingsText(def, s) "Angle 120°, Axis depth, Cubes 10" for E.est.level(...).settings
     homePlan(rec, now) / homeLevels(rec)   what Today's hooks show (js/ui/home.js)
     fast(on)             short animations and waits (tests); also PX.debug.fast
     state()              the current player state; window.__play is the test API
   Route: PX.core.router.go('play', { mode, exId?, variant?, protocol?, params?, minutes?,
   deadlineMs?, trials?, challenge? }); mode: train | path | speed | threshold | free | daily |
   check (js/ui/check.js) | tour (js/ui/tour.js) | watch. Train with exId pins it as the focus. */
(function (PX) {
  'use strict';

  var win = window, doc = win.document;
  var ui = PX.ui, h = ui.h, U = PX.util, bus = PX.bus;
  var keys = PX.core.keys, timing = PX.core.timing, store = PX.core.store, router = PX.core.router;
  var S3 = PX.core.stage3d;
  var hasOwn = Object.prototype.hasOwnProperty;
  // v1.2 O22 (W3-phones): Settings → Sound and keys → Confirm taps (touch; off by default)
  store.setting('confirmTaps', { def: false, type: 'bool' });
  function confirmTaps() { var st = store.state && store.state.settings; return !!(st && st.confirmTaps === true); }

  var FAST = false;
  // Test knobs: slowMs overrides the "See solution" threshold; limitScale scales time limits;
  // budgetMs replaces a time-boxed session's budget of active time (sessions of a few seconds).
  var CONFIG = { slowMs: null, limitScale: 1, budgetMs: null };
  var AUTO_SHOWME = 3;      // automatic show-me replays per exercise, then a "Why?" button instead
  var VOID_NOTICE = 3;      // voided trials in a row before the calm device notice
  var DYNAMIC_MS = 400;     // a present() longer than this held a moving or timed stimulus
  var DEMO_MS = 5000;       // a Watch demo lasts at least this long (slow, with captions)
  var DEMO_CAPTION_MS = 3000; // and each of its captions stays on the screen at least this long
  // Fresh-player round 3 (Central Point, phone): a walkthrough after an answer ignores taps from the
  // item at first (they were meant as answers); after a time-out it starts a moment after the
  // verdict; and when it ends, its bar's place takes no tap for a moment (the tap was meant for it).
  var SHOWME_TAP_GRACE_MS = 1500, TIMEOUT_SHOWME_DELAY_MS = 900, AFTER_SHOWME_LOCK_MS = 700;
  // Motion comfort (v1.2, O36; note N1 §5.4): a check-in after 3 min of motion in a session, then
  // every 5; a person with under 10 min of motion before is offered to stop after 5 min.
  var MOTION = { first: 180000, every: 300000, newLimit: 300000, newPlayer: 600000 };
  // v1.2 wave 2 (CONTRACT-v1.2 R): the modes whose sessions run the player hooks (session:start,
  // item:before, item:notes); the Daily, Threshold and friend challenges keep their fixed items
  var HOOK_MODES = { train: 1, path: 1, speed: 1, free: 1 };
  var MODE_NAMES = { train: 'Train', path: 'Path', speed: 'Speed', threshold: 'Threshold', free: 'Free play', daily: 'Daily Challenge', check: 'Spatial Check', watch: 'Watch, Try, Go', tour: 'Watch, Try, Go' };

  function E() { return PX.engine; }
  function rec() { return store.state; }
  function now() { return Date.now(); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function log(msg, e) {
    if (win.console) console.error('PX.ui.play: ' + msg, e || '');
    emit('play:error', { where: String(msg), message: e ? String(e && e.message || e) : '' }); // playtest hooks (CONTRACT-v1.2 G)
  }
  // Playtest and other listeners never break the player (CONTRACT-v1.2 G).
  function emit(name, payload) { try { bus.emit(name, payload); } catch (e) { if (win.console) console.error('PX.ui.play: a ' + name + ' listener failed', e); } }
  function save() { try { store.save(); } catch (e) { log('save failed', e); } }

  /* ---------- what this device can run ---------- */

  function viewOf(id) { try { return PX.ex.view(id) || null; } catch (e) { return null; } }
  function needsGL(v) { var n = v && v.needs; return n === 'webgl' || (Array.isArray(n) && n.indexOf('webgl') >= 0); }
  // cheap: true skips creating the WebGL context (Today's preview); the session start checks it.
  function canRun(def, cheap) {
    var v = def && viewOf(def.id);
    if (!v) return false;
    if (!needsGL(v)) return true;
    if (cheap) return !!(win.WebGL2RenderingContext && S3);
    return !!(S3 && S3.available());
  }
  function canCheap(def) { return canRun(def, true); }
  function display() { try { return E().est.displayClass(win.innerWidth, win.innerHeight); } catch (e) { return 'large'; } }
  function reducedMotion() { try { return !!(PX.ui.app && PX.ui.app.motionReduced()); } catch (e) { return false; } }
  function dark() { try { return !!(PX.ui.app && PX.ui.app.isDark()); } catch (e) { return false; } }

  /* ---------- small record helpers (store.state.ui is an open container) ---------- */

  function uiRec() {
    var r = rec();
    if (!isObj(r.ui)) r.ui = { lastRoute: null };
    return r.ui;
  }
  function seenMap() { var u = uiRec(); if (!isObj(u.seen)) u.seen = {}; return u.seen; }
  function isSeen(k) { return !!seenMap()[k]; }
  function markSeen(k) { var s = seenMap(); if (!s[k]) { s[k] = now(); save(); } }
  function tourRec() { var r = rec(); if (!isObj(r.tour)) r.tour = { done: false, seen: {} }; if (!isObj(r.tour.seen)) r.tour.seen = {}; return r.tour; }
  function wtgSeen(exId) { return tourRec().seen[exId] === true; }
  function markWtg(exId) { var t = tourRec(); if (t.seen[exId] !== true) { t.seen[exId] = true; save(); } }
  // Watch demos wait for a tap at each caption; Auto-play (the player's choice, kept) plays them at the timed pace
  function autoplay() { return uiRec().autoplay === true; }
  function setAutoplay(on) { uiRec().autoplay = !!on; save(); }
  function counter(name, exId) { var u = uiRec(); if (!isObj(u[name])) u[name] = {}; return u[name][exId] || 0; }
  function bump(name, exId) { var u = uiRec(); if (!isObj(u[name])) u[name] = {}; u[name][exId] = (u[name][exId] || 0) + 1; }
  function tipsShown(exId) { var u = uiRec(); if (!isObj(u.tips)) u.tips = {}; if (!Array.isArray(u.tips[exId])) u.tips[exId] = []; return u.tips[exId]; }

  /* ---------- items ---------- */

  // v1.2 wave 2 (CONTRACT-v1.2 S; W2-bets' request): a stem+options view may give one item its own input
  // (a draw-the-answer variant): view.layoutFor(item) → 'custom' runs that item with the view's collect()
  // and no answer grid, its answer type from item.answer or def.answers; every other item keeps the
  // view's layout. The timing rules are the same for both: the answer clock runs from the painted frame.
  function layoutOf(view, item) {
    if (!view) return null;
    if (view.layout === 'stem+options' && typeof view.layoutFor === 'function' && typeof view.collect === 'function') {
      var l = null;
      try { l = view.layoutFor(item); } catch (e) { log('layoutFor failed', e); l = null; }
      if (l === 'custom') return 'custom';
    }
    return view.layout;
  }
  function answerType(def, item) {
    return (item && item.answer) || (def.answers && item && item.params && def.answers[item.params.variant]) || def.answer;
  }
  function nOptions(def, item) {
    if (answerType(def, item) === 'yesno') return 2;
    if (item && Array.isArray(item.options) && item.options.length >= 2) return item.options.length;
    return (item && item.nOptions) || def.nOptions || 2;
  }
  function nCorrect(def, item) { return (item && item.nCorrect) || def.nCorrect || 1; }
  function safeScore(def, item, response) {
    try { var r = def.score(item, response); return r && typeof r === 'object' ? r : { correct: false }; } catch (e) { log('score threw', e); return { correct: false }; }
  }
  // A response that scores right (or wrong) for the item: tests and PX.debug.answer.
  function responseFor(def, item, correct) {
    var key = item.key, type = answerType(def, item), n = nOptions(def, item);
    if (correct) return Array.isArray(key) ? key.slice() : key;
    var cands = [];
    if (type === 'yesno') cands = [!key];
    else if (type === 'choice') for (var i = 1; i < n; i++) cands.push((key + i) % n);
    else if (type === 'angle') cands = [(key + 180) % 360, (key + 90) % 360];
    else if (type === 'position' && key && isNum(key.x) && isNum(key.z)) cands = [{ x: -key.x, z: -key.z }, { x: key.x * 3 + 5, z: key.z * 3 + 5 }];
    else if (type === 'point' && key && isNum(key.x) && isNum(key.y)) { // v1.2: the item's own wrong response, else the farthest lattice corner
      var nl = isNum(item.lattice) ? item.lattice - 1 : 12;
      cands = (item.wrongResponse ? [item.wrongResponse] : []).concat([{ x: key.x < nl / 2 ? nl : 0, y: key.y < nl / 2 ? nl : 0 }]);
    }
    else if (Array.isArray(key)) {
      cands.push(key.slice().reverse());
      if (key.length > 1) cands.push(key.slice(1).concat(key[0]));
      var other = [];
      for (var j = 0; j < Math.max(n, 12); j++) if (key.indexOf(j) < 0) other.push(j);
      if (other.length) cands.push(key.slice(0, -1).concat(other[0]).sort(function (a, b) { return a - b; }));
      cands.push([]);
    }
    for (var k = 0; k < cands.length; k++) if (!safeScore(def, item, cands[k]).correct) return cands[k];
    return null;
  }
  function seedOf(parts) { return PX.rng.hash.apply(null, parts) >>> 0; }

  // In the Library's words when it is loaded (PX.ui.exinfo.dimText: '10 cubes', 'speed 0.22 cw/s').
  function settingsText(def, s) {
    if (!s || !Array.isArray(s.dims)) return '';
    var X = PX.ui.exinfo, out = s.dims.filter(function (d) { return d.of > 1; }).map(function (d) {
      var dim = (def.dims || []).filter(function (x) { return x.key === d.key; })[0] || {};
      if (X && typeof X.dimText === 'function' && dim.key) { try { return X.dimText(def, dim, d.value); } catch (e) { /* plain text below */ } }
      var v = typeof d.value === 'number' ? Number(d.value.toPrecision(3)) + (dim.unit || '') : String(d.value);
      return d.label + ' ' + v;
    }).join(', ');
    return out.charAt(0).toUpperCase() + out.slice(1);
  }
  function fmtRt(ms) { return U.fmtSecs(ms); } // the one answer-time format (v1.2, O5)
  // The level as every screen names it (v1.2, note D2 §3.0 B3; CONTRACT-v1.2 C).
  // Shorter forms of a session's title-row meta, for a narrow row: "Train · 19 min left", then
  // "19 min left"; "Train · 3 of 12", then "3 of 12".
  function shortMeta(t) {
    var a = String(t || '').replace(/ · item (\d)/, ' · $1').replace(/\babout (\d)/, '$1').replace(/less than 1 min/, 'under 1 min');
    var out = a !== t ? [a] : [], parts = a.split(' · ');
    if (parts.length > 1) out.push(parts[parts.length - 1]);
    return out;
  }
  function levelText(lv) {
    var n = isObj(lv) ? lv.level : lv;
    if (!isNum(n)) return 'level –';
    return n <= 1 ? 'level 1 · starter items' : 'level ' + Math.round(n);
  }
  // "1 item", "2 items": counts in sentences.
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many || one + 's'); }
  function specOf(def) { return PX.ui.kit ? PX.ui.kit.spec([def.code, def.short || def.name, (def.abilities || []).join(' ')]) : h('span', def.code); }
  // The goal line: an item's own task (Reckon's tutorial items), then its variant, then the exercise's goal.
  function goalOf(learn, item) {
    if (!learn) return '';
    var g = learn.goals || {}, t = item && typeof item.task === 'string' ? item.task : null;
    var v = item && item.params ? item.params.variant : null;
    return (t && g[t]) || (v && g[v]) || learn.goal || '';
  }
  // The first tip (learn.tips) that matches the item and was never shown to this person.
  function tipFor(exId, learn, item, always) {
    if (!learn || !Array.isArray(learn.tips) || !item || !item.params) return null;
    var shown = tipsShown(exId);
    for (var i = 0; i < learn.tips.length; i++) {
      var t = learn.tips[i], w = t.when || {};
      if (!always && shown.indexOf(t.id) >= 0) continue;
      // Every condition in `when` holds: the variant (a name or a list of names) and the levels of the dim.
      var okV = !w.variant || (Array.isArray(w.variant) ? w.variant : [w.variant]).indexOf(item.params.variant) >= 0;
      var okD = !w.dim || (Array.isArray(w.levels) ? w.levels.indexOf(item.params[w.dim]) >= 0 : item.params[w.dim] !== undefined);
      if ((w.variant || w.dim) && okV && okD) {
        if (shown.indexOf(t.id) < 0) shown.push(t.id);
        return t;
      }
    }
    return null;
  }
  // What kind of practice an exercise is, in one line: its learn data's own labelLine first (Angles),
  // then attention practice (Track), perceptual-judgement practice, experimental (Homing, Reckon).
  function labelLine(def) {
    var learn = PX.ex.learn(def.id), name = def.short || def.name;
    if (learn && typeof learn.labelLine === 'string' && learn.labelLine) return learn.labelLine;
    if (def.practice === 'attention') return 'Track is attention practice: it trains keeping track of moving objects, not visuospatial ability itself.';
    if (def.practice === 'perception') return name + ' is perceptual-judgement practice: it trains judging by eye, and the gains tend to stay with this kind of figure.';
    if (def.experimental) return name + ' is experimental: its item model is new and untested.';
    return '';
  }
  function tagOf(def) {
    if (def.practice === 'attention') return 'attention practice';
    if (def.practice === 'perception') return 'perceptual-judgement practice';
    if (def.experimental) return 'experimental';
    return null;
  }

  /* ---------- the step runner the views use for show me and demo (ctx.play) ----------
     steps: [{ ms, caption?, enter?(), update?(k ∈ [0, 1]), exit?(), hold? }]. Pause, Step (finish this
     step and hold), Replay (from the first step), Close (finish every step at once). fast: 2 % of
     the time; reduced motion: 75 % and keyframes about 400 ms apart (≤ 2.5 Hz). Time from rAF dt.
     hold: true (v1.2, O52): at the end of that step the runner waits for a tap on Continue (the
     Pause button) before the next step; fast mode never waits. Copied from tests/dev/harness.js play(). */
  function makeRunner(P) {
    var cur = null;
    function cmd(name) { if (cur && cur[name]) cur[name](); }
    function play(steps, opts) {
      opts = opts || {};
      if (cur) cur.close();
      steps = Array.isArray(steps) ? steps : [];
      return new Promise(function (resolve) {
        var i = 0, t = 0, paused = false, done = false, stop = null, prev = P.state, lastK = -1, waiting = false, waited = -1, lastNoted = false;
        var seen = 0, replays = 0, closed = false; // for the showme event (CONTRACT-v1.2 O)
        var rm = reducedMotion(), scale = FAST ? 0.02 : rm ? 0.75 : 1;
        // A Watch demo plays slowly: at least DEMO_MS in all (PLAN §8), unless motion is reduced.
        var total = steps.reduce(function (a, st) { return a + Math.max(0, (st && st.ms) || 0); }, 0);
        if (P.demoing && !FAST && !rm && total > 0 && total < DEMO_MS) scale = DEMO_MS / total;
        // v1.2 (fresh-player tests, three of four Angles testers missed a caption): a Watch caption
        // waits for a tap. Groups: a captioned step and the steps after it up to the next caption.
        // A group ends with a wait for Next (or a tap on the figure), unless it moves (a step with
        // motion: true, or one that animates in a view that moves on its own: Reckon, Homing,
        // Track) and the group after it moves too: during motion the captions keep the timed pace,
        // and the motion ends with a Next. Auto-play (rec.ui.autoplay) brings back the timed pace
        // everywhere. Show-me after an answer keeps its pace; fast mode never waits.
        var demo = !!P.demoing && !FAST;
        // a show-me after an answer has the reading strip's Next in its bar too (same place as the strip's)
        var answered = !P.demoing && !!P.last && (prev === 'reveal' || prev === 'showme');
        // round 3 (Form fresh test: after a wrong answer two of three steps played by while the tester
        // read the first): a walkthrough after an answer waits for Next at each caption too
        var tapped = (demo || answered) && !FAST;
        var moving = !!(P.view && P.view.motion === true) || !!(P.def && P.def.practice === 'attention');
        var group = [], g = -1;
        steps.forEach(function (st, a) { if (a === 0 || (st && st.caption)) g++; group.push(g); });
        var gMove = [];
        steps.forEach(function (st, a) {
          var m = st && (typeof st.motion === 'boolean' ? st.motion : moving && typeof st.update === 'function');
          if (m) gMove[group[a]] = true;
        });
        function lastOf(a) { return a + 1 >= steps.length || group[a + 1] !== group[a]; }
        function tapMode() { return tapped && !autoplay(); }
        function waitsAt(a) {
          if (!tapMode() || !lastOf(a)) return false;
          var gg = group[a];
          return !gMove[gg] || a + 1 >= steps.length || !gMove[gg + 1];
        }
        // ...and with the timed pace every caption of a Watch demo stays up at least DEMO_CAPTION_MS
        // (RV-play-dat: about 1.7 s a caption was too fast to read): a hold at the end of the
        // caption's last step, after its motion, also with reduced motion (reading is not motion).
        var holds = steps.map(function () { return 0; });
        if (demo) {
          for (var a = 0; a < steps.length; a++) {
            if (!steps[a] || !steps[a].caption) continue;
            var b = a, sum = 0;
            do { sum += Math.max(1, ((steps[b] && steps[b].ms) || 0) * scale); b++; } while (b < steps.length && !(steps[b] && steps[b].caption));
            if (sum < DEMO_CAPTION_MS) holds[b - 1] += DEMO_CAPTION_MS - sum;
          }
        }
        function hold(a) { return tapMode() && !gMove[group[a]] ? 0 : holds[a]; } // a tap ends a still caption
        // A demo plays before any answer, when the feedback area is hidden: its controls show anyway.
        var fbHidden = P.el.feedback.hidden;
        if (fbHidden) { P.el.feedback.hidden = false; P.el.actions.hidden = true; }
        var caption = opts.caption || function (text) { P.el.caption.textContent = text; };
        var t0 = timing.now();
        function dur() { return Math.max(1, (steps[i].ms || 0) * scale); }
        function safe(fn, k) { try { if (fn) fn(k); } catch (e) { log('show-me step failed', e); } }
        function enter(k) {
          if (waiting) { waiting = false; label(); }
          i = k; t = 0; lastK = 0; waiting = false;
          if (k + 1 > seen) seen = k + 1;
          var s = steps[i];
          if (s.caption) caption(s.caption);
          safe(s.enter); safe(s.update, 0);
        }
        function finish() { var s = steps[i]; safe(s.update, 1); safe(s.exit); }
        function label() {
          var tap = tapMode();
          P.el.pPause.firstChild.textContent = waiting && !tap ? 'Continue' : paused && !waiting ? 'Resume' : 'Pause';
          P.el.pPause.disabled = !!(tap && waiting); // nothing moves while a caption waits
          // round 3 (Views fresh test: two buttons named Pause): where captions wait for taps and Auto-play
          // sets the pace, the header's Pause is the only one
          P.el.pPause.hidden = tapped;
          P.el.pNext.hidden = !(demo || answered); P.el.pStep.hidden = demo || answered;
          P.el.pNext.toggleAttribute('data-answered', answered); // wide screens keep the strip's own Next
          P.el.pNext.classList.toggle('is-waiting', !!waiting);
          // while a caption's steps still play, the first tap finishes them: say so; at the demo's last
          // caption the tap hands the item over, and Watch, Try, Go's line says so (fresh-player tests)
          var lastWait = demo && tap && waiting && i === steps.length - 1;
          // round 3: "Skip ahead" read as skipping the whole demo; the tap finishes the caption's steps.
          // At the last caption a demo hands the item over; a walkthrough after an answer is done.
          var lastTap = tap && waiting && i === steps.length - 1;
          // round 4 (first-session test: "Finish step" moved on a caption per tap): while steps play, the words
          // say what a tap does: a still caption's steps finish and wait there; a moving one goes on
          var gEnd = i;
          while (gEnd + 1 < steps.length && group[gEnd + 1] === group[i]) gEnd++;
          var stays = !!(steps[gEnd] && steps[gEnd].hold && !FAST) || waitsAt(gEnd), playing = tapped && tap && !waiting;
          P.el.pNext.firstChild.textContent = playing ? (stays ? 'Finish step' : gEnd + 1 >= steps.length ? (demo ? 'Your turn' : 'Done') : 'Next step')
            : lastWait ? 'Your turn' : lastTap ? 'Done' : 'Next step';
          if (lastWait && !lastNoted) {
            lastNoted = true;
            try { if (P.demoCfg && typeof P.demoCfg.onLastWait === 'function') P.demoCfg.onLastWait(); } catch (e) { log('onLastWait failed', e); }
          }
          P.el.pAuto.hidden = !tapped;
          P.el.pAuto.setAttribute('aria-pressed', autoplay() ? 'true' : 'false');
          P.el.player.toggleAttribute('data-waiting', !!waiting);
        }
        function wait() {
          waited = i; waiting = true; paused = true; label();
          try { P.el[tapMode() ? 'pNext' : 'pPause'].focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        }
        function end() {
          if (done) return;
          done = true;
          P.played.finished++;
          P.played.ms = Math.round(timing.now() - t0);
          P.played.last = { steps: seen, of: steps.length, replays: replays, closed: closed, ms: P.played.ms };
          if (closed) { try { caption(''); } catch (e) { /* the view's caption */ } } // round 4: no caption left beside the answer after Close
          if (stop) stop();
          cur = null;
          P.el.player.hidden = true;
          if (fbHidden) { P.el.actions.hidden = false; if (prev !== 'reveal' && prev !== 'showme') P.el.feedback.hidden = true; }
          waiting = false; paused = false; label();
          P.el.pNext.hidden = true; P.el.pAuto.hidden = true; P.el.pStep.hidden = false;
          if (P.state === 'showme') P.setState(prev === 'showme' ? 'reveal' : prev);
          if (answered && !FAST) P.nextLockUntil = timing.now() + AFTER_SHOWME_LOCK_MS; // a tap meant for the walkthrough's Next
          resolve();
        }
        function frame(dt) {
          if (done) return false;
          if (paused) return true;
          t += dt;
          var d = dur(), k = Math.min(1, t / d);
          if (rm && k < 1) { var nk = Math.max(1, Math.round(d / 400)); k = Math.floor(k * nk) / nk; }
          if (steps[i].update && k !== lastK) safe(steps[i].update, k);
          lastK = k;
          if (t >= d + hold(i)) {
            // a step that waits for a tap (O52 hold, or the end of a caption in a Watch demo)
            if (((steps[i].hold && !FAST) || waitsAt(i)) && waited !== i) { wait(); return true; }
            finish();
            if (i + 1 < steps.length) enter(i + 1); else { end(); return false; }
          }
          return true;
        }
        // Next: go on from a wait; while a caption's steps still play, finish them and wait there
        // (a tap never skips a caption unseen); in motion, finish the motion and wait.
        var lastCmd = -1e9; // a tap on the figure that a view already turned into a step is not a second Next
        function next() {
          if (done) return;
          lastCmd = timing.now();
          if (waiting) { waiting = false; paused = false; label(); return; }
          paused = false;
          if (!tapMode()) { // Auto-play, and a show-me after an answer: on to the next caption (Next means the same in both players)
            var g0 = group[i];
            while (!done && group[i] === g0) { finish(); if (i + 1 < steps.length) enter(i + 1); else end(); }
            label();
            return;
          }
          while (!done) {
            if ((steps[i].hold && !FAST) || waitsAt(i)) {
              if (lastK !== 1) { safe(steps[i].update, 1); lastK = 1; }
              t = dur() + hold(i);
              wait();
              return;
            }
            finish();
            if (i + 1 < steps.length) enter(i + 1); else end();
          }
        }
        cur = {
          pause: function () {
            if (waiting) { if (tapMode()) return; waiting = false; paused = false; label(); return; }
            paused = !paused; label();
          },
          step: function () {
            if (tapMode()) { next(); return; }
            finish(); if (i + 1 < steps.length) { enter(i + 1); paused = true; label(); } else end();
          },
          next: next,
          // a tap on the figure: Next, while a caption waits
          tap: function () { if (waiting && tapMode() && timing.now() - lastCmd > 250) next(); },
          replay: function () { replays++; paused = false; waited = -1; lastNoted = false; enter(0); label(); },
          close: function () { if (!done) closed = true; while (!done) { finish(); if (i + 1 < steps.length) { i++; safe(steps[i].enter); } else end(); } },
          auto: function () {
            setAutoplay(!autoplay());
            if (!tapMode() && waiting && !steps[i].hold) { waiting = false; paused = false; } // the timed pace goes on from here
            label();
          },
          isPaused: function () { return paused; },
          tapMode: tapMode,
        };
        P.played.started++;
        P.played.plannedMs = Math.round(steps.reduce(function (a, st, k) { return a + Math.max(1, (st.ms || 0) * scale) + holds[k]; }, 0));
        if (!steps.length) { end(); return; }
        if (prev !== 'showme') P.setState('showme');
        label();
        P.el.player.hidden = false;
        enter(0);
        // Phones pin the caption and the show-me bar to the bottom (css/play.css): keep the stage
        // above them for a show-me after an answer too, as Watch does for its demo (B2's gap).
        stageIntoView(P, true);
        stop = timing.loop(function (dt) { return frame(dt); });
      });
    }
    play.cmd = cmd;
    play.running = function () { return !!cur; };
    play.paused = function () { return !!(cur && cur.isPaused()); };
    play.tapMode = function () { return !!(cur && cur.tapMode()); };
    return play;
  }

  /* =====================================================================================
     The trial player
     createPlayer(opts) → P   opts: { endLabel ('End session'), onHelp }
       P.el.root                 the element to place on the screen
       P.use(exId) → bool        mounts the exercise's view (unmounting the previous one)
       P.run(item, cfg) → Promise<trial>   ready → present → respond (→ reveal). cfg: { feedback
                                 (default true), limitMs (the item ends as a time-out), limitBar
                                 (draw the player's own countdown), practice, goal, tip, hideItem }
                                 trial: { item, response, result, rtMs, source, meta, timeout,
                                 outcome: right | wrong | stutter | skipped | aborted, voidReason, end }
       P.waitNext(o) → Promise   shows Next (o.label); without feedback a short gap instead
       P.demo(item, cfg)         presents the item, plays view.demo with captions, back to respond
       P.note(node) / P.clearNotes()   lines under the verdict (level changes, check-ins…)
       P.setLabel(def | null, text) · P.setMeta(text) · P.setProgress(v, max) · P.setGoal(t)
       P.setTip(t) · P.notice(node | null) · P.abort() · P.destroy() · P.when(state)
     States: idle, ready, present, respond, paused, reveal, showme, done, unavailable.
     ===================================================================================== */

  function createPlayer(opts) {
    opts = opts || {};
    var P = {
      state: 'idle', exId: null, def: null, view: null, learn: null, ctx: null, item: null, cfg: {},
      grid: null, offGrid: null, paintTs: 0, pauseStart: 0, pausedMs: 0, presentDone: false, presentMs: 0,
      frames: null, voided: false, voidReason: null, token: 0, held: false, resolve: null, last: null,
      waiters: [], nextWaiter: null, nextRequested: false, popPause: null, lastPointer: null,
      limit: { timer: null, left: null, start: 0 }, played: { started: 0, finished: 0, ms: 0, plannedMs: 0, demos: 0 }, motionMs: 0, howTo: null, fbPause: null, mode: opts.mode || null,
      el: {}, offs: [], history: [],
    };
    var el = P.el;
    var runner = makeRunner(P);

    /* ---------- DOM ---------- */
    el.label = h('div.pl-hud-id');
    el.meta = h('div.pl-hud-meta.px-num', { 'aria-live': 'polite' });
    el.helpBtn = ui.button('Keys', { kind: 'ghost', small: true, key: '?', ariaLabel: 'Keyboard keys', onClick: function () { help(); } });
    el.helpBtn.setAttribute('data-help', '');
    el.helpBtn.classList.add('pl-hud-keys');
    // H2: the goal and the tip live in one container; Help shows or hides it (css decides when it
    // is hidden: on phones during items).
    P.guideId = 'pl-guide-' + (++playerSeq);
    el.guideBtn = ui.button('Help', { kind: 'ghost', small: true, ariaLabel: 'Goal and tips', onClick: function () { toggleGuide(); } });
    el.guideBtn.classList.add('pl-hud-guide');
    el.guideBtn.setAttribute('data-guide', '');
    el.guideBtn.setAttribute('aria-expanded', 'false');
    el.guideBtn.setAttribute('aria-controls', P.guideId);
    el.guideBtn.hidden = true;
    el.pauseBtn = ui.button('Pause', { kind: 'secondary', small: true, key: 'Escape', onClick: function () { togglePause(); } });
    // When an answer's scroll takes the title row off a phone's screen, a copy of Pause stays at the
    // top corner (Openings fresh test: Pause was out of reach after each answer). css/play.css shows
    // it on phones only, while the row is out of view (data-hud-off on the player).
    el.floatPause = ui.button('Pause', { kind: 'secondary', small: true, ariaLabel: 'Pause', onClick: function () { el.pauseBtn.click(); } });
    el.floatPause.classList.add('pl-float-pause');
    el.floatPause.setAttribute('data-float-pause', '');
    el.pauseBtn.setAttribute('data-pause', '');
    // "How to solve" (v1.2, note D2 §3.0 C3): the strategy card shown before Try 1, again on a tap
    // through Try and an exercise's first session (P.setHowTo). A sheet pauses the item under it.
    el.howBtn = ui.button('How to solve', { kind: 'ghost', small: true, ariaLabel: 'How to solve: the strategy card', onClick: function () { if (P.howTo) strategySheet(P.howTo.def, P.howTo.card); } });
    el.howBtn.classList.add('pl-hud-how');
    el.howBtn.setAttribute('data-howto', '');
    el.howBtn.hidden = true;
    el.bar = ui.bar(0, 1, { label: 'Progress', kind: 'signal' });
    el.hud = h('div.pl-hud', h('div.pl-hud-row', el.label, el.meta, h('div.pl-hud-tools', el.howBtn, el.guideBtn, el.helpBtn, el.pauseBtn)), h('div.pl-hud-bar', el.bar));
    el.goal = h('p.pl-goal', { hidden: true });
    el.tip = h('p.pl-tip', { role: 'note', hidden: true });
    el.guide = h('div.pl-guide', { id: P.guideId }, el.goal, el.tip);
    el.notice = h('div.pl-notice-slot');
    el.host = h('div.pl-host');
    // a tap on the figure is Next while a Watch caption waits for one
    el.host.addEventListener('click', function () {
      if (P.showmeAt && !FAST && timing.now() - P.showmeAt < SHOWME_TAP_GRACE_MS) return; // round 3: an answer tap, not a Next
      if (P.state === 'showme' && runner.tapMode()) runner.cmd('tap');
    });
    el.grid = h('div.pl-grid');
    // A tap in the gap between two answer tiles answers nothing (Angles fresh test: a tap at the middle
    // of a 390-px phone answered with the right-hand tile). Phones move a tap that lands near a button
    // onto it (touch adjustment, which a wider gap does not stop), so a tile's click is checked against
    // where the finger came down: pointerdown keeps that point, the click has the moved one.
    el.grid.addEventListener('pointerdown', function (e) {
      P.lastPointer = e.pointerType || 'mouse';
      // the event goes to the adjusted tile, but its coordinates are where the finger came down
      var tile = e.target && e.target.closest ? e.target.closest('.px-choice') : null, r = tile ? tile.getBoundingClientRect() : null;
      P.lastDown = { t: timing.now(), touch: e.pointerType === 'touch', onTile: !!(r && e.clientX >= r.left - 0.5 && e.clientX <= r.right + 0.5 && e.clientY >= r.top - 0.5 && e.clientY <= r.bottom + 0.5) };
    }, true);
    el.grid.addEventListener('click', function (e) {
      var d = P.lastDown;
      if (!d || !d.touch || d.onTile || timing.now() - d.t > 1500) return;
      if (!(e.target && e.target.closest && e.target.closest('.px-choice'))) return;
      e.preventDefault(); e.stopPropagation(); // the finger was in the gap
    }, true);
    el.confirm = ui.button('Confirm', { kind: 'primary', key: 'Enter', onClick: function () { confirmMulti('pointer'); } });
    el.confirm.setAttribute('data-confirm', '');
    el.confirmText = h('span.pl-confirm-text');
    el.confirmRow = h('div.pl-confirm', { hidden: true }, el.confirmText, el.confirm);
    el.limitFill = h('div.pl-limit-fill');
    el.limit = h('div.pl-limit.px-keep-motion', { hidden: true, 'aria-hidden': 'true' }, el.limitFill); // labelled by data-label (css/play.css)
    el.resume = ui.button('Resume', { kind: 'primary', key: 'Escape', onClick: function () { resume(); } });
    el.resume.setAttribute('data-resume', '');
    el.skip = ui.button('Skip this item', { kind: 'secondary', onClick: function () { skipItem(false); } });
    el.skip.setAttribute('data-skip', '');
    el.end = ui.button(opts.endLabel || 'End session', { kind: 'ghost', onClick: function () { if (P.fbPause) endFromFeedback(); else skipItem(true); } });
    el.end.setAttribute('data-end', '');
    el.pauseText = h('p.pl-pause-text');
    el.pauseNote = h('p.pl-pause-note.px-meta', 'A skipped item counts nowhere and is replaced.'); // the Spatial Check rewords it
    el.pauseExtra = h('div.pl-pause-extra'); // playtest mode's note button (W1-rules' request, CONTRACT-v1.2 G)
    el.pause = h('div.pl-pause', { hidden: true },
      h('div.pl-pause-in', h('p.pl-pause-title', 'Paused'), el.pauseText,
        h('div.pl-pause-actions', el.resume, el.skip, el.end), el.pauseNote, el.pauseExtra));
    // Playtest notes during a session go through the pause sheet (the floating note button hides
    // while an item is on screen); null when playtest mode is off.
    function pauseExtras() {
      ui.clear(el.pauseExtra);
      var nb = null;
      try { nb = PX.ui.playtest && typeof PX.ui.playtest.noteButton === 'function' ? PX.ui.playtest.noteButton('session: ' + (P.def ? P.def.short || P.def.name : P.exId || '')) : null; } catch (e) { nb = null; }
      if (nb) el.pauseExtra.appendChild(nb);
    }
    el.trial = h('section.pl-trial', { 'aria-label': 'Item', tabindex: '-1' }, el.host, el.grid, el.limit, el.confirmRow, el.pause);
    el.verdict = h('div.pl-verdict', { role: 'status', 'aria-live': 'polite' });
    el.notes = h('div.pl-notes');
    el.caption = h('p.pl-caption', { 'aria-live': 'polite' });
    el.pPause = ui.button('Pause', { kind: 'secondary', small: true, key: 'Space', onClick: function () { runner.cmd('pause'); } });
    el.pStep = ui.button('Step', { kind: 'secondary', small: true, key: '→', onClick: function () { runner.cmd('step'); } });
    el.pReplay = ui.button('Replay', { kind: 'secondary', small: true, key: 'r', onClick: function () { runner.cmd('replay'); } });
    el.pClose = ui.button('Close', { kind: 'ghost', small: true, key: 'Escape', onClick: function () { runner.cmd('close'); } });
    // a Watch demo's own two: Next (each caption waits for it, or for a tap on the figure) and Auto-play
    el.pNext = ui.button('Next', { kind: 'primary', small: true, key: 'Enter', onClick: function () { runner.cmd('next'); } });
    el.pNext.setAttribute('data-showme-next', '');
    el.pNext.hidden = true;
    el.pAuto = ui.button('Auto-play', { kind: 'ghost', small: true, ariaLabel: 'Auto-play: the captions go on by themselves', onClick: function () { runner.cmd('auto'); } });
    el.pAuto.setAttribute('data-showme-auto', '');
    el.pAuto.setAttribute('aria-pressed', 'false');
    el.pAuto.hidden = true;
    el.player = h('div.pl-showme', { hidden: true, role: 'group', 'aria-label': 'Show me controls' }, el.caption,
      h('div.pl-showme-buttons', el.pPause, el.pStep, el.pReplay, el.pClose, el.pAuto, el.pNext));
    el.showBtn = ui.button('Show me', { kind: 'secondary', key: 's', onClick: function () { showMe(false); } });
    el.showBtn.setAttribute('data-showme', '');
    el.nextBtn = ui.button('Next', { kind: 'primary', key: 'Space', onClick: function () {
      if (P.nextLockUntil && timing.now() < P.nextLockUntil) return; // round 3: a tap meant for the walkthrough's Next
      goNext();
    } });
    el.nextBtn.setAttribute('data-next', '');
    // Space and Enter on the focused Next go through the player's keys: during show me Space
    // pauses it (as its bar and the Keys sheet say); Next comes once it ends or is closed.
    el.nextBtn.setAttribute('data-px-keys', '');
    el.actions = h('div.pl-actions', el.showBtn, el.nextBtn);
    el.feedback = h('section.pl-feedback', { hidden: true, 'aria-label': 'Result' },
      h('div.pl-feedback-main', el.verdict, el.actions), el.player, el.notes);
    el.root = h('div.pl-player', { 'data-state': 'idle' }, el.hud, el.guide, el.notice, el.trial, el.feedback, el.floatPause);
    try {
      if (win.IntersectionObserver) {
        var hudSeen = new win.IntersectionObserver(function (es) {
          var e = es[es.length - 1];
          // round 3 (Form fresh test): a row half cut at the screen's top edge counts as off too
          el.root.toggleAttribute('data-hud-off', !!(e && e.boundingClientRect.top < -4 && e.intersectionRatio < 0.95));
        }, { threshold: [0, 0.25, 0.5, 0.75, 0.95, 1] });
        hudSeen.observe(el.hud);
        P.offs.push(function () { hudSeen.disconnect(); });
      }
    } catch (e) { /* the title row stays the only Pause */ }
    function toggleGuide(on) {
      var open = on === undefined ? !el.root.classList.contains('pl-guide-open') : !!on;
      el.root.classList.toggle('pl-guide-open', open);
      el.guideBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      return open;
    }
    // Help is offered only when the guide holds something.
    function syncGuide() { el.guideBtn.hidden = el.goal.hidden && el.tip.hidden; }
    P.toggleGuide = toggleGuide;

    /* ---------- state ---------- */
    function setState(s) {
      P.state = s;
      el.root.setAttribute('data-state', s);
      el.pauseBtn.disabled = !(s === 'respond' || s === 'paused' || s === 'present' || ((s === 'reveal' || s === 'showme') && !opts.noFeedbackPause)); // O4: also while feedback shows
      el.pauseBtn.firstChild.textContent = s === 'paused' ? 'Resume' : 'Pause'; // it resumes while paused
      syncBody();
      var w = P.waiters.slice();
      P.waiters = P.waiters.filter(function (x) { return x.state !== s; });
      w.forEach(function (x) { if (x.state === s) x.resolve(s); });
      if (opts.onState) try { opts.onState(s); } catch (e) { /* ignore */ }
    }
    function when(s) {
      if (P.state === s) return Promise.resolve(s);
      return new Promise(function (resolve) { P.waiters.push({ state: s, resolve: resolve }); });
    }
    P.setState = setState;
    P.when = when;

    // H1: px-item on <body> while this player has an item mounted (any state from ready on; the
    // pause sheet keeps it), px-stim while a stimulus plays (present) or a timed item runs.
    var ITEM_STATES = { ready: 1, present: 1, respond: 1, paused: 1, reveal: 1, showme: 1, done: 1 };
    function syncBody() {
      P.itemOn = ITEM_STATES[P.state] === 1 && !!P.item;
      P.stimOn = P.state === 'present' || (P.state === 'respond' && !!P.limit.timer);
      bodyClasses();
    }

    function holdStore() { if (!P.held) { P.held = true; try { store.hold(); } catch (e) { /* ignore */ } } }
    function releaseStore() { if (P.held) { P.held = false; try { store.release(); } catch (e) { /* ignore */ } } }

    /* ---------- the exercise ---------- */
    function makeCtx() {
      var rm = reducedMotion();
      return {
        host: el.host, stage3d: S3, svg: PX.core.svg, ui: PX.ui, keys: keys, timing: timing,
        theme: dark() ? 'dark' : 'light', fast: FAST, reducedMotion: rm, play: runner,
        settings: { reducedMotion: rm ? 'on' : 'off', keyHints: rec().settings.keyHints !== false },
        voidTrial: function (reason) { voidNow(reason || 'void'); },
        seen: seenMap(), markSeen: markSeen,
        // v1.2 (CONTRACT-v1.2 D, F): the Try item's first step done by the app; motion the view has
        // shown (ms), counted per session for the comfort cards; the gentle motion profile
        assist: null,
        addMotion: function (ms) { if (isNum(ms) && ms > 0) { P.motionMs += ms; if (opts.onMotion) { try { opts.onMotion(ms); } catch (e) { log('onMotion failed', e); } } } },
        // the show-me runner's own commands for a view ('step', 'pause', 'replay', 'close'): a tap on
        // the board may step a Watch or a show-me (W1-central's request)
        playCmd: function (name) {
          // round 3: at the start of a walkthrough after an answer, taps on the item were meant as answers
          if (P.showmeAt && !FAST && timing.now() - P.showmeAt < SHOWME_TAP_GRACE_MS) return;
          if (name === 'step' || name === 'pause' || name === 'replay' || name === 'close') runner.cmd(name);
        },
        gentleMotion: gentleMotion(),
      };
    }
    function unmountView() {
      runner.cmd('close');
      destroyGrid();
      if (P.view && P.view.unmount) { try { P.view.unmount(P.ctx); } catch (e) { log('unmount failed', e); } }
      ui.clear(el.host);
      if (P.exId) el.trial.classList.remove('ex-' + P.exId);
      P.exId = null; P.def = null; P.view = null; P.learn = null; P.ctx = null;
    }
    function use(exId, force) {
      if (!force && P.exId === exId && P.view) return true;
      unmountView();
      var def = PX.ex.get(exId), view = viewOf(exId);
      if (!def || !view || !canRun(def)) return false;
      P.exId = exId; P.def = def; P.view = view; P.learn = PX.ex.learn(exId);
      el.trial.classList.add('ex-' + exId);
      P.ctx = makeCtx();
      if (S3 && needsGL(view)) { try { S3.refreshTheme(); } catch (e) { /* cosmetic */ } }
      try { if (view.mount) view.mount(P.ctx); } catch (e) { log('mount failed (' + exId + ')', e); unmountView(); return false; }
      return true;
    }
    P.use = use;

    function destroyGrid() {
      if (P.offGrid) { P.offGrid(); P.offGrid = null; }
      if (P.grid) { P.grid.destroy(); P.grid = null; }
      ui.clear(el.grid);
    }

    /* ---------- one trial ---------- */
    function resetTrialUi() {
      el.feedback.hidden = true;
      el.player.hidden = true;
      el.showBtn.hidden = true;
      el.caption.textContent = '';
      ui.clear(el.verdict);
      el.verdict.removeAttribute('data-kind');
      clearNotes();
      el.pause.hidden = true;
      el.trial.removeAttribute('data-paused');
      setInert(false);
      el.limit.hidden = true;
      el.limit.classList.remove('is-running');
      if (P.popPause) { P.popPause(); P.popPause = null; }
    }
    // While paused, the item under the pause sheet takes no focus, clicks or keys.
    function setInert(on) {
      [el.host, el.grid, el.confirmRow, el.limit].forEach(function (x) { if (on) x.setAttribute('inert', ''); else x.removeAttribute('inert'); });
    }
    function stopLimit() {
      if (P.limit.timer) win.clearTimeout(P.limit.timer);
      P.limit = { timer: null, left: null, start: 0 };
      el.limit.classList.remove('is-running');
      el.limitFill.style.animationPlayState = '';
      syncBody();
    }
    function startLimit() {
      var ms = P.cfg.limitMs > 0 ? Math.max(1, Math.round(P.cfg.limitMs * (CONFIG.limitScale > 0 ? CONFIG.limitScale : 1))) : 0;
      if (!(ms > 0) || P.limit.timer || P.state !== 'respond') return;
      var t = timing.now();
      if (P.limit.left === null) {
        P.limit.left = ms;
        // The limit runs from the paint, the same stamp the answer time is measured from, so an
        // answer is never judged late while the timer still runs (I1 T7).
        P.limit.start = P.paintTs > 0 && P.paintTs <= t ? P.paintTs : t;
        if (P.cfg.limitBar) {
          // the bar says what it is (fresh-player tests); the label is the limit, the bar the time left
          el.limit.setAttribute('data-label', 'Limit · ' + Math.round(ms / 1000) + ' s');
          el.limit.hidden = false;
          el.limitFill.style.animationPlayState = '';
          el.limitFill.style.animationDuration = ms + 'ms';
          el.limitFill.style.animationDelay = -Math.round(t - P.limit.start) + 'ms';
          void el.limitFill.offsetWidth; // restart the countdown for this item
          el.limit.classList.add('is-running');
        }
      } else P.limit.start = t;
      var token = P.token;
      P.limit.timer = win.setTimeout(function () {
        P.limit.timer = null;
        P.limit.left = 0;
        if (token === P.token && P.state === 'respond') respond(deadlineResponse(), 'timeout');
      }, Math.max(0, P.limit.left - (t - P.limit.start)));
      syncBody();
    }
    function pauseLimit() {
      if (!P.limit.timer) return;
      win.clearTimeout(P.limit.timer);
      P.limit.timer = null;
      P.limit.left = Math.max(0, P.limit.left - (timing.now() - P.limit.start));
      syncBody();
    }

    // At the deadline a custom view may hand in what is on screen (Central Point's placed marker):
    // view.atDeadline(item, ctx) → a response or null (CONTRACT-v1.2 E). It counts as a time-out.
    function deadlineResponse() {
      if (!P.view || typeof P.view.atDeadline !== 'function') return null;
      try { var r = P.view.atDeadline(P.item, P.ctx); return r === undefined ? null : r; } catch (e) { log('atDeadline failed (' + P.exId + ')', e); return null; }
    }

    function markVoid(reason) { if (!P.voided) { P.voided = true; P.voidReason = reason || 'void'; } }
    function voidNow(reason) {
      if (P.state === 'ready' || P.state === 'present' || P.state === 'respond' || P.state === 'paused') markVoid(reason);
    }

    function finishTrial(tr) {
      var r = P.resolve;
      P.resolve = null;
      if (tr) {
        P.history.push({ exId: tr.exId, outcome: tr.outcome, source: tr.source, rtMs: tr.rtMs, timeout: !!tr.timeout, voidReason: tr.voidReason || null });
        if (P.history.length > 50) P.history.shift();
        var f = P.frames;
        emit('play:trial', { // playtest hooks (CONTRACT-v1.2 G)
          mode: P.mode, exId: tr.exId, practice: !!(P.cfg && P.cfg.practice), outcome: tr.outcome, rtMs: isNum(tr.rtMs) ? tr.rtMs : null,
          timeout: !!tr.timeout, voidReason: tr.voidReason || null, display: tr.display || null, input: tr.input || null,
          frames: f ? { frames: f.frames, medianMs: f.medianMs, p95Ms: f.p95Ms, maxGapMs: f.maxGapMs, dropped: f.dropped, stutter: !!f.stutter } : null,
          presentMs: isNum(P.presentMs) ? Math.round(P.presentMs) : null,
        });
      }
      if (r) r(tr);
    }

    // Ready → present → respond. Resolves with the trial once the response is in.
    function run(item, cfg) {
      abort();
      cfg = cfg || {};
      if (cfg.feedback === undefined) cfg.feedback = true;
      var def = P.def, view = P.view;
      // Per item, for the view (B3's request): practice items (Watch, Try, and other unrated
      // items) and the item a Watch demo plays. Views read them if present.
      if (P.ctx) { P.ctx.practice = !!cfg.practice; P.ctx.demo = !!cfg.demo; P.ctx.assist = cfg.assist !== undefined ? cfg.assist : null; P.ctx.gentleMotion = gentleMotion(); }
      // v1.2 wave 2 (CONTRACT-v1.2 R): the step's add-on layer ('' when none), e.g. calib-detail feedback
      if (P.ctx) P.ctx.layer = typeof cfg.layer === 'string' ? cfg.layer : '';
      return new Promise(function (resolve) {
        var token = ++P.token;
        P.resolve = resolve; P.item = item; P.cfg = cfg; P.last = null;
        P.voided = false; P.voidReason = null;
        if (item && item.fallback === true) markVoid('fallback');
        P.paintTs = 0; P.pauseStart = 0; P.pausedMs = 0; P.presentDone = false; P.presentMs = 0; P.frames = null;
        P.nextWaiter = null; P.nextRequested = false;
        stopLimit();
        resetTrialUi();
        toggleGuide(false); // Help opens the guide for the item at hand; it never covers the next one
        setTip(cfg.tip || null);
        if (cfg.goal !== undefined) setGoal(cfg.goal);
        if (!def || !view) { setState('unavailable'); finishTrial({ item: item, outcome: 'skipped', result: { correct: false }, exId: P.exId }); return; }
        holdStore();
        setState('ready');
        el.trial.style.visibility = 'hidden';
        destroyGrid();
        var type = answerType(def, item), n = nOptions(def, item);
        P.layout = layoutOf(view, item); // the item's own layout (a draw-the-answer item: 'custom')
        try {
          if (P.layout === 'stem+options') {
            P.grid = ui.choiceGrid(n, {
              cols: view.gridCols ? view.gridCols(item) : undefined, multi: type === 'multi', label: 'Answer options',
              labels: function (i) { return view.optionLabel ? view.optionLabel(item, i) : 'Option ' + (i + 1); },
            });
            el.grid.appendChild(P.grid.el);
            for (var i = 0; i < n; i++) view.drawOption(P.grid.cells[i], item, i, P.ctx);
            P.offGrid = P.grid.onPick(onPick);
            P.armed = -1; // O22: nothing marked by a first tap yet
          }
        } catch (e) { log('drawing the options failed (' + P.exId + ')', e); el.trial.style.visibility = ''; failTrial(token); return; }
        el.confirmRow.hidden = type !== 'multi' || P.layout !== 'stem+options'; // an item with its own input confirms there
        el.confirm.disabled = true;
        el.confirmText.textContent = type === 'multi' ? 'Pick ' + nCorrect(def, item) + ', then confirm.' : '';
        // Never under a modal (the Chimera pop-up after a reload, the keys sheet): the item
        // waits, hidden, until the last one closes (the 'modal:close' handler below).
        el.trial.setAttribute('data-item-layout', P.layout || ''); // css: a draw-the-answer item has no grid
        if (ui.modalOpen()) P.presentLater = presentNow; else presentNow();
        function presentNow() {
          P.presentLater = null;
          if (token !== P.token) return;
          el.trial.style.visibility = '';
          bringIntoView();
          P.shape0 = shape(); // H3: a turn or a new screen class during the stimulus voids it
          setState('present');
          var mon = P.mon = timing.monitor(), t0 = timing.now(), p;
          try { p = Promise.resolve(view.present(item, P.ctx)); } catch (e) { p = Promise.reject(e); }
          motionNotice(view, token);
          p.then(function (paint) {
            var frames = mon.stop(); // also when the trial was skipped or left: the monitor holds a rAF loop
            if (P.mon === mon) P.mon = null;
            if (token !== P.token) return;
            P.frames = frames;
            P.presentMs = timing.now() - t0;
            P.presentDone = true;
            P.paintTs = isNum(paint) ? paint : timing.now();
            // A custom view takes its answer from now on, but never while paused: its key layer
            // would sit above the pause layer and its answer would be dropped; resume() calls it.
            if (P.state === 'paused') { if (!P.pauseStart) P.pauseStart = P.paintTs; P.collectLater = P.layout === 'custom'; }
            else { setState('respond'); collect(); }
            if (P.state === 'respond') startLimit();
            focusTrial();
          }, function (e) {
            mon.stop();
            if (P.mon === mon) P.mon = null;
            if (token !== P.token) return;
            log('present failed (' + P.exId + ')', e);
            failTrial(token);
          });
        }
      });
    }
    P.run = run;

    function collect() {
      P.collectLater = false;
      if (!P.view || P.layout !== 'custom') return;
      try { P.view.collect(P.item, P.ctx, function (r, meta) { return respond(r, 'view', meta); }); } catch (e) { log('collect failed (' + P.exId + ')', e); }
    }

    // The motion notice is shown once per person (store.state.ui.seen.motionNotice). Track
    // shows its own notice before its first trial on every page load; for someone who has seen
    // it, the player starts the trial from the notice at once (the view's own Start button).
    function motionNotice(view, token) {
      var ph = null;
      try { ph = typeof view.phase === 'function' ? view.phase() : null; } catch (e) { ph = null; }
      if (ph !== 'notice') return;
      var btn = el.host.querySelector('[data-notice-start], .ex-track-notice .px-btn');
      if (isSeen('motionNotice') && btn) { btn.click(); return; }
      var poll = win.setInterval(function () {
        var now2 = null;
        try { now2 = view.phase(); } catch (e) { now2 = null; }
        if (token !== P.token || now2 !== 'notice') {
          win.clearInterval(poll);
          if (token === P.token && now2) markSeen('motionNotice'); // saved at release, never mid-stimulus
        }
      }, 250);
    }

    // A trial the view could not draw: logged as voided (never rated) and replaced.
    function failTrial(token) {
      if (token !== P.token) return;
      markVoid('error');
      stopLimit();
      releaseStore();
      var tr = { item: P.item, response: null, result: { correct: false }, rtMs: null, source: 'error', outcome: 'stutter', voidReason: 'error', exId: P.exId, error: true };
      P.last = tr;
      setState('done');
      if (P.exId) use(P.exId, true); // a clean view for the next item
      finishTrial(tr);
    }

    function onPick(ix, source) {
      if (P.state !== 'respond') return;
      var type = answerType(P.def, P.item);
      // v1.2 O22 (W3-phones): with "Confirm taps" on, a touch tap on a single-choice answer first marks it (the
      // grid shows it selected) and a second tap on the same answer gives it, so a scroll that ends on a tile
      // never answers; keys and a mouse answer at once, and the answer clock runs to the answer as before
      if ((type === 'yesno' || type === 'choice') && source === 'pointer' && P.lastPointer === 'touch' && confirmTaps() && P.armed !== ix) {
        P.armed = ix;
        return;
      }
      if (type === 'yesno') respond(ix === 0, source);
      else if (type === 'choice') respond(ix, source);
      else if (type === 'multi') el.confirm.disabled = P.grid.selected().length !== nCorrect(P.def, P.item);
    }
    function confirmMulti(source) {
      if (P.state !== 'respond' || !P.grid || answerType(P.def, P.item) !== 'multi') return false;
      var sel = P.grid.selected();
      if (sel.length !== nCorrect(P.def, P.item)) return false;
      respond(sel, source);
      return true;
    }

    function inputOf(source, meta) {
      if (typeof meta === 'string') return meta;
      if (isObj(meta) && typeof (meta.input || meta.source) === 'string') return meta.input || meta.source;
      if (source === 'view') {
        try { var ti = P.view.trialInfo && P.view.trialInfo(); if (ti && typeof ti.input === 'string') return ti.input; } catch (e) { /* ignore */ }
        var at = el.host.querySelector('[data-input]');
        return at ? at.getAttribute('data-input') : 'pointer';
      }
      if (source === 'pointer' && P.lastPointer === 'touch') return 'touch';
      return source || 'api';
    }

    // meta: what a custom view sends with its response (Track: { frames, jump, late, void }).
    // A response outside the answer phase (paused, revealed) is ignored and returns false; views
    // that keep their controls live (Orient, Homing) let the person send it again.
    function respond(response, source, meta) {
      if (P.state !== 'respond') return false;
      var t = timing.now(), item = P.item, def = P.def, cfg = P.cfg, timeout = source === 'timeout';
      if (P.pauseStart) { P.pausedMs += t - P.pauseStart; P.pauseStart = 0; }
      // The countdown bar stays where the time stood (empty after a time-out) instead of refilling.
      if (P.limit.timer) { win.clearTimeout(P.limit.timer); P.limit.timer = null; }
      el.limitFill.style.animationPlayState = 'paused';
      var result = timeout ? { correct: false, timeout: true } : safeScore(def, item, response);
      // A response handed in at the deadline (view.atDeadline) is scored for its closeness but
      // counts as a time-out: wrong for the rating (CONTRACT-v1.2 E).
      if (timeout && response !== null && response !== undefined) result = Object.assign({}, safeScore(def, item, response), { correct: false, timeout: true, late: true });
      var rt = timeout ? Math.round(cfg.limitMs) : Math.max(0, Math.round(t - P.paintTs - P.pausedMs));
      // A per-item round score (def.roundScore; Central Point's Quick form): never in a demo.
      if (typeof def.roundScore === 'function' && !cfg.demo && cfg.feedback !== false) {
        var rs = null;
        try { rs = def.roundScore(item, result, { rtMs: rt, deadlineMs: cfg.limitMs > 0 ? cfg.limitMs : null, timeout: timeout, practice: !!cfg.practice }); } catch (e) { log('roundScore failed (' + P.exId + ')', e); }
        if (isNum(rs)) result = Object.assign({}, result, { round: U.clamp(Math.round(rs), 0, 100) });
      }
      // The frame verdict: the generic rule for long stimuli, unless the view judged itself.
      var own = isObj(meta) && (meta.frames !== undefined || meta.void !== undefined);
      if (!own && P.frames && P.presentMs > DYNAMIC_MS) {
        if (P.frames.stutter) markVoid(P.frames.contextLost ? 'lost' : 'stutter');
        if (S3 && needsGL(P.view)) { try { S3.noteTrial(!!P.frames.stutter); } catch (e) { /* ignore */ } }
      }
      if (isObj(meta) && meta.void) markVoid(String(meta.void));
      // A view that times its own exposure (Pattern Memory) says whether that exposure stuttered.
      if (P.view && typeof P.view.exposure === 'function') {
        try { var ex = P.view.exposure(); if (ex && ex.stutter) markVoid('stutter'); } catch (e) { /* ignore */ }
      }
      var tr = {
        item: item, response: response, result: result, rtMs: rt, source: timeout ? 'timeout' : inputOf(source, meta), meta: isObj(meta) ? meta : null,
        timeout: timeout, outcome: P.voided ? 'stutter' : result.correct ? 'right' : 'wrong', voidReason: P.voided ? P.voidReason : null,
        pausedMs: Math.round(P.pausedMs), exId: P.exId,
        // H4: the input of the answering event and the screen class the item was shown on
        input: timeout ? null : inputName(source, t), display: P.shape0 ? P.shape0.c : display(),
        // v1.2 wave 2 (CONTRACT-v1.2 N): the control the answer came through, and the window's shape
        // when the stimulus painted
        amode: timeout ? null : amodeOf(source, meta, !!P.grid), orient: P.shape0 ? P.shape0.o : shape().o,
      };
      P.last = tr;
      if (P.grid) P.grid.lock(true);
      el.confirmRow.hidden = true;
      releaseStore();
      if (cfg.feedback !== false) { setState('reveal'); reveal(tr); }
      else {
        setState('done');
        if (cfg.hideItem !== false) el.trial.style.visibility = 'hidden';
        if (P.layout === 'custom' && timeout) use(P.exId, true); // its input may still be live
      }
      finishTrial(tr);
      return true;
    }

    function revealResponse(def, item, response) {
      if (response !== null && response !== undefined) return response;
      var type = answerType(def, item);
      return type === 'multi' || type === 'targets' || type === 'sequence' ? [] : null;
    }
    function markGrid(def, item, response) {
      var g = P.grid, type = answerType(def, item), n = nOptions(def, item), key = item.key;
      var picked = type === 'yesno' ? (response === true ? [0] : response === false ? [1] : []) : type === 'multi' ? (Array.isArray(response) ? response : []) : (isNum(response) ? [response] : []);
      var right = type === 'yesno' ? [key ? 0 : 1] : type === 'multi' ? key : [key];
      for (var i = 0; i < n; i++) {
        var p = picked.indexOf(i) >= 0, r = right.indexOf(i) >= 0;
        g.mark(i, p && r ? 'right' : p ? 'wrong' : r ? 'missed' : 'dim');
      }
    }

    var VOID_TEXT = {
      stutter: 'The display stuttered', lost: 'The 3D view was interrupted', paused: 'Paused while the item played',
      fallback: 'A back-up item was used', error: 'The item could not be drawn', jump: 'The display skipped frames',
      late: 'Many frames came late', turned: 'The screen turned or changed size while the item played',
    };
    function voidText(reason) { return (VOID_TEXT[reason] || 'The item was interrupted') + ', so it does not count.'; }

    // Feedback within 0.5 s: an icon, a word and a colour; the right answer marked; show me.
    function reveal(tr) {
      var def = P.def, item = tr.item, cfg = P.cfg, ok = !!tr.result.correct;
      if (P.grid) markGrid(def, item, tr.response);
      var done = null;
      try { done = P.view.reveal ? P.view.reveal(item, revealResponse(def, item, tr.response), tr.result, P.ctx) : null; } catch (e) { log('reveal failed (' + P.exId + ')', e); }
      ui.clear(el.verdict);
      var kind = ok ? 'right' : tr.timeout ? 'timeout' : 'wrong';
      el.verdict.setAttribute('data-kind', kind);
      el.verdict.appendChild(h('span.pl-verdict-icon', { 'aria-hidden': 'true' }, ok ? '✓' : '✗'));
      el.verdict.appendChild(h('strong.pl-verdict-word', ok ? 'Correct' : tr.timeout ? 'Time is up' : 'Incorrect'));
      if (isNum(tr.result.round)) el.verdict.appendChild(h('span.pl-verdict-round.px-num', { 'data-round': String(tr.result.round) }, 'Round score ' + tr.result.round));
      if (tr.result.late) el.verdict.appendChild(h('span.pl-verdict-text', 'Your placed answer earned the round score; it counts as late.'));
      // No time on the Watch item: the demo has just solved it, so a time says nothing (RV-play-dat).
      if (!tr.timeout && isNum(tr.rtMs) && !cfg.demo) el.verdict.appendChild(h('span.pl-verdict-rt.px-num', fmtRt(tr.rtMs)));
      if (!ok) el.verdict.appendChild(h('span.pl-verdict-text', P.grid ? 'The right answer is marked ✓.' : 'The right answer is shown.'));
      if (tr.outcome === 'stutter') el.verdict.appendChild(h('span.pl-verdict-void', voidText(tr.voidReason)));
      else sound.play(ok ? 'right' : 'wrong'); // a short tone when the setting is on (never during a stimulus)
      var canShow = !!(P.view && P.view.showMe);
      // "See solution" after a slow right answer, and after any right practice answer (W1-fixes' request)
      var slow = ok && (cfg.practice || (isNum(tr.rtMs) && tr.rtMs > slowMs(P.exId)));
      var auto = !ok && canShow && (cfg.practice || counter('showMe', P.exId) < AUTO_SHOWME);
      el.showBtn.firstChild.textContent = !ok ? (auto ? 'Show me again' : 'Why?') : 'See solution';
      el.showBtn.hidden = !canShow || (ok && !slow) || auto;
      el.nextBtn.hidden = false;
      el.actions.hidden = false;
      el.feedback.hidden = false;
      marksIntoView();
      try { el.nextBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      Promise.resolve(done).then(function () {
        if (P.last !== tr || P.state !== 'reveal' || !auto) return null;
        // round 3: after a time-out the person was still placing an answer: the verdict first
        return tr.timeout && !FAST ? timing.wait(TIMEOUT_SHOWME_DELAY_MS) : null;
      }).then(function () {
        if (P.last !== tr || P.state !== 'reveal' || !auto) return;
        if (!cfg.practice) bump('showMe', P.exId);
        save();
        showMe(true);
      });
    }

    // The reading strip sticks to the bottom of the window: the marked options (or the stage's
    // marks) are scrolled up above it, as far as the stem allows.
    // The scroll is the least that clears the strip, so what lies above the Pause row (Watch, Try, Go's
    // stepper) goes first and the row itself only when the options need it (fit.py: no option under
    // the strip; the marks are the feedback).
    function marksIntoView() {
      try {
        var t = (P.grid ? el.grid : el.host).getBoundingClientRect(), f = el.feedback.getBoundingClientRect();
        if (!t.height || t.bottom <= f.top) return;
        var by = Math.min(t.bottom - f.top + 12, Math.max(0, t.top - 64));
        if (by > 0) win.scrollBy(0, by);
      } catch (e) { /* cosmetic */ }
    }

    // On phones the options can push the stem off screen: show me and demos bring it back. With
    // Watch, Try, Go's header above the player, that header stays in view when the stem fits.
    function stemIntoView() {
      try {
        var r = el.host.getBoundingClientRect(), top = 64, vh = win.innerHeight || 800;
        var prev = el.root.previousElementSibling, head = prev && prev.classList && prev.classList.contains('pl-wtg') ? prev.getBoundingClientRect() : null;
        if (head && r.height && r.bottom - head.top <= vh - top - 8) {
          if (head.top < top || r.bottom > vh) win.scrollTo(0, Math.max(0, (win.pageYOffset || 0) + head.top - top));
          return;
        }
        if (r.height && (r.top < top || r.top > vh * 0.45)) win.scrollTo(0, Math.max(0, (win.pageYOffset || 0) + r.top - top));
      } catch (e) { /* ignore */ }
    }
    function showMe(auto) {
      if (P.state !== 'reveal' || !P.view || !P.view.showMe || !P.last || P.cfg.feedback === false) return Promise.resolve(false);
      var tr = P.last, p, cfg = P.cfg, exId = P.exId, n0 = P.played.finished, t0 = timing.now();
      P.showmeAt = t0;
      el.showBtn.hidden = true;
      stemIntoView();
      try { p = Promise.resolve(P.view.showMe(tr.item, revealResponse(P.def, tr.item, tr.response), P.ctx)); } catch (e) { log('show me failed', e); p = Promise.resolve(); }
      return p.then(function () {
        // the showme event (CONTRACT-v1.2 O): after the answer, in its feedback, never mid-stimulus
        var pl = P.played.finished > n0 ? P.played.last : null;
        logEvent('showme', exId, { seed: isNum(cfg.seed) ? cfg.seed >>> 0 : undefined, auto: !!auto, ms: pl ? pl.ms : Math.round(timing.now() - t0),
          steps: pl ? pl.steps : 0, replays: pl ? pl.replays : 0, closed: !!(pl && pl.closed) });
        if (P.last === tr && P.state === 'reveal') {
          el.showBtn.firstChild.textContent = 'Show me again';
          el.showBtn.hidden = false;
        }
        return true;
      }, function (e) { log('show me failed', e); return false; });
    }
    P.showMe = showMe;
    // The show-me runner from outside (Watch, Try, Go's Parts on phones: O8)
    P.showmeCmd = function (name) { runner.cmd(name); };
    P.showmePaused = function () { return runner.paused(); };

    // Resolves 'next', 'abort' or 'end' (End chosen on a pause between items: O4).
    function waitNext(o) {
      o = o || {};
      if (P.endRequested) { P.endRequested = false; return Promise.resolve('end'); }
      if (P.state !== 'reveal' && P.state !== 'showme' && !P.fbPause) return timing.wait(o.gapMs !== undefined ? o.gapMs : FAST ? 0 : 300);
      el.nextBtn.firstChild.textContent = o.label || 'Next';
      return new Promise(function (resolve) {
        P.nextWaiter = resolve;
        if (P.nextRequested) goNext();
      });
    }
    function goNext() {
      if (P.state === 'showme') runner.cmd('close');
      if (P.state !== 'reveal') return false;
      if (!P.nextWaiter) { P.nextRequested = true; return true; }
      var w = P.nextWaiter;
      P.nextWaiter = null;
      P.nextRequested = false;
      w('next');
      return true;
    }
    P.waitNext = waitNext;
    P.goNext = goNext;

    // Watch: the item is presented, view.demo plays its solution with captions, then the
    // player is back in 'respond' and the item can be answered (practice, never logged).
    // cfg.turn: { skip } shows "Your turn" in the reading strip when the demo ends, with a
    // button (label skip) that leaves the item unanswered and goes on.
    function demo(item, cfg) {
      cfg = cfg || {};
      var p = run(item, Object.assign({ practice: true, demo: true }, cfg));
      var tok = P.token;
      when('respond').then(function () { playDemo(item, cfg, tok); });
      return p;
    }
    // Plays view.demo on the item in 'respond'; afterwards the item can be answered. "Watch again"
    // in the Your turn strip plays it again until the first answer (W1-fixes' request).
    function playDemo(item, cfg, tok) {
      if (tok !== P.token || !P.view || !P.view.demo || P.last) return;
      if (P.grid) P.grid.lock(true);
      stemIntoView();
      var d;
      P.demoing = true;
      P.demoCfg = cfg;
      try { d = Promise.resolve(P.view.demo(item, P.ctx, null)); } catch (e) { d = Promise.reject(e); }
      d.catch(function (e) { log('demo failed (' + P.exId + ')', e); }).then(function () {
        P.demoing = false;
        P.played.demos++;
        if (tok !== P.token || P.last) return;
        if (P.state === 'showme' || P.state === 'reveal') setState('respond');
        // The answer clock starts again now: the demo's time is never answer time.
        P.paintTs = timing.now(); P.pausedMs = 0; P.pauseStart = 0;
        if (P.grid) P.grid.lock(false);
        if (typeof cfg.onDemoEnd === 'function') cfg.onDemoEnd();
        if (cfg.turn) yourTurn(cfg.turn, function () { playDemo(item, cfg, tok); });
      });
    }
    P.demo = demo;

    // After a Watch demo the next step is said where the demo's controls were (the reading strip),
    // so the screen is never a dead end: answer it as the demo did, or go on (RV-play-dat).
    // v1.2 (W1-fixes' request, fresh-player retests): the strip says it loudly, the HUD says it
    // too, and "Watch again" replays the demo until the first answer.
    function yourTurn(o, again) {
      if (P.state !== 'respond') return;
      ui.clear(el.verdict);
      el.verdict.setAttribute('data-kind', 'turn');
      el.verdict.appendChild(h('span.pl-verdict-icon', { 'aria-hidden': 'true' }, '→'));
      el.verdict.appendChild(h('strong.pl-verdict-word', 'Your turn'));
      el.verdict.appendChild(h('span.pl-verdict-text', P.grid ? 'Answer it the way the demo did: pick the answer it found.' : 'Answer it yourself, the way the demo did.'));
      var row = h('span.pl-turn-actions');
      if (typeof again === 'function' && P.view && P.view.demo) {
        var w = ui.button('Watch again', { kind: 'secondary', small: true, onClick: function () { if (P.state === 'respond' && !P.last) again(); } });
        w.setAttribute('data-turn-again', '');
        row.appendChild(w);
      }
      if (o.skip) {
        var b = ui.button(o.skip, { kind: 'ghost', small: true, onClick: function () { skipItem(false); } });
        b.setAttribute('data-turn-skip', '');
        row.appendChild(b);
      }
      if (row.firstChild) el.verdict.appendChild(row);
      setMeta('Your turn');
      el.actions.hidden = true;
      el.feedback.hidden = false;
      marksIntoView();
    }

    /* ---------- pause, emergency skip, abort ---------- */
    // quiet: a pause under a modal, which keeps its own key layer and focus on top.
    function pause(quiet) {
      // O4: while feedback shows, Pause opens the sheet with Resume and End (no item to skip)
      if ((P.state === 'reveal' || P.state === 'showme') && quiet !== true && !opts.noFeedbackPause) return pauseFeedback();
      if (P.state !== 'respond' && P.state !== 'present') return false;
      // Esc during a stimulus the view did not take (it owns Esc while it plays): the item
      // cannot be judged fairly any more, so it is voided and replaced. A notice before the
      // stimulus (Track's motion notice) has shown nothing yet: no void.
      if (P.state === 'present') {
        if (viewPhase() !== 'notice') markVoid('paused');
        // a view with its own moving stimulus (Homing, Reckon) freezes it under the sheet
        if (P.view && typeof P.view.pause === 'function') { try { P.view.pause(P.ctx); } catch (e) { log('view pause failed', e); } P.viewPaused = true; }
      }
      else if (!P.pauseStart) P.pauseStart = timing.now(); // a second pause keeps the first start
      pauseLimit();
      setState('paused');
      el.trial.setAttribute('data-paused', '');
      setInert(true);
      el.pauseText.textContent = P.voidReason === 'paused'
        ? 'This item was paused while it played, so it will not count. Resume to answer it anyway, or skip it.'
        : 'The clock is stopped and the item is hidden, so a pause never counts as thinking time.';
      pauseExtras();
      el.pause.hidden = false;
      if (quiet === true) return true;
      if (!P.popPause) P.popPause = keys.push({ Escape: function () { resume(); }, '*': function () { return false; } });
      try { el.resume.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      return true;
    }
    // O4 (v1.2): a pause between items, while the verdict or a show-me is on screen. The session
    // clock stops with the sheet (state 'paused'); Resume puts the feedback back; End ends the
    // session from the Next waiter (waitNext resolves 'end').
    function pauseFeedback() {
      var running = P.state === 'showme' && runner.running && runner.running();
      var toggled = running && !runner.paused();
      if (toggled) runner.cmd('pause'); // freeze the show-me under the sheet
      P.fbPause = { prev: P.state, runner: toggled };
      setState('paused');
      el.skip.hidden = true;
      el.pauseText.textContent = 'Paused between items. Resume, or end the session here; everything you answered is kept.';
      pauseExtras();
      el.pause.hidden = false;
      el.trial.setAttribute('data-paused', '');
      el.feedback.setAttribute('inert', ''); // Next and Show me wait under the sheet (and are hidden: css/play.css)
      el.pauseNote.hidden = true; // no item is on screen to skip
      if (!P.popPause) P.popPause = keys.push({ Escape: function () { resume(); }, '*': function () { return false; } });
      try { el.resume.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      emit('play:screen', { screen: 'card:pause', mode: P.mode, exId: P.exId });
      return true;
    }
    function leaveFeedbackPause() {
      var fp = P.fbPause;
      P.fbPause = null;
      if (P.popPause) { P.popPause(); P.popPause = null; }
      el.skip.hidden = false;
      el.pauseNote.hidden = false;
      el.pause.hidden = true;
      el.trial.removeAttribute('data-paused');
      el.feedback.removeAttribute('inert');
      setState(fp && fp.prev === 'showme' && runner.running && runner.running() ? 'showme' : 'reveal');
      if (fp && fp.runner && runner.running && runner.running()) runner.cmd('pause'); // the show-me goes on
      try { el.nextBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      return fp;
    }
    function endFromFeedback() {
      leaveFeedbackPause();
      if (P.state === 'showme') runner.cmd('close');
      P.endRequested = true;
      if (P.nextWaiter) { var w = P.nextWaiter; P.nextWaiter = null; P.nextRequested = false; P.endRequested = false; w('end'); }
      return true;
    }
    P.endFromFeedback = endFromFeedback;

    function resume() {
      if (P.state === 'paused' && P.fbPause) { leaveFeedbackPause(); return true; }
      if (P.state !== 'paused') return false;
      if (P.pauseStart && P.presentDone) { P.pausedMs += timing.now() - P.pauseStart; P.pauseStart = 0; }
      if (P.viewPaused) { P.viewPaused = false; if (P.view && typeof P.view.resume === 'function') { try { P.view.resume(P.ctx); } catch (e) { log('view resume failed', e); } } }
      if (P.popPause) { P.popPause(); P.popPause = null; }
      el.trial.removeAttribute('data-paused');
      setInert(false);
      el.pause.hidden = true;
      el.trial.style.visibility = '';
      if (P.presentDone) {
        setState('respond');
        if (P.collectLater) collect(); // present ended during the pause
        // Re-show what answering needs (a lost control once soft-locked a trial).
        if (P.grid) { P.grid.lock(false); el.grid.hidden = false; }
        el.confirmRow.hidden = !(P.grid && answerType(P.def, P.item) === 'multi');
        startLimit();
      } else setState('present');
      focusTrial();
      return true;
    }
    function togglePause() { return P.state === 'paused' ? resume() : pause(); }
    P.pause = pause;
    P.resume = resume;

    // Skip this item (counts nowhere, the engine replaces it); end: true also ends the session.
    function skipItem(end) {
      if (['ready', 'present', 'respond', 'paused'].indexOf(P.state) < 0) return false;
      var tr = { item: P.item, response: null, result: { correct: false }, rtMs: null, source: 'skip', outcome: 'skipped', end: !!end, exId: P.exId };
      stopActive();
      P.last = tr;
      setState('done');
      if (P.exId && P.view && P.layout === 'custom') use(P.exId, true); // stops its stimulus and input
      finishTrial(tr);
      return true;
    }
    P.skip = skipItem;

    function stopActive() {
      P.token++;
      runner.cmd('close');
      stopLimit();
      if (P.mon) { try { P.mon.stop(); } catch (e) { /* ignore */ } P.mon = null; }
      P.presentLater = null; P.collectLater = false; P.modalPause = false; P.demoing = false; P.viewPaused = false; P.fbPause = null; P.endRequested = false;
      el.skip.hidden = false;
      el.feedback.removeAttribute('inert');
      if (P.popPause) { P.popPause(); P.popPause = null; }
      el.pause.hidden = true;
      el.trial.removeAttribute('data-paused');
      setInert(false);
      releaseStore();
    }
    function viewPhase() {
      try { return P.view && typeof P.view.phase === 'function' ? P.view.phase() : null; } catch (e) { return null; }
    }
    // Ends whatever runs (a pending trial resolves as 'aborted', nothing is logged by the player).
    function abort() {
      var pending = !!P.resolve;
      stopActive();
      if (pending) {
        finishTrial({ item: P.item, response: null, result: { correct: false }, outcome: 'aborted', exId: P.exId });
        if (P.exId && P.view && P.layout === 'custom') use(P.exId, true);
      }
      if (P.nextWaiter) { var w = P.nextWaiter; P.nextWaiter = null; w('abort'); }
      if (P.state !== 'idle' && P.state !== 'unavailable') setState('done');
    }
    P.abort = abort;

    /* ---------- screen pieces ---------- */
    function setLabel(def, text) {
      ui.clear(el.label);
      if (def) {
        el.label.appendChild(specOf(def));
        var tag = tagOf(def);
        if (tag) el.label.appendChild(h('span.px-tag.pl-tag', tag));
      } else if (text) el.label.appendChild(h('span.pl-hud-text', text));
    }
    // (aria-live: the text is replaced only when it changes, so the countdown's ticks are quiet)
    // The title row's meta keeps to its line (Angles fresh test: "Train · about 19 mi…" on a phone
    // with three tools): the full text, else the first shorter form given that fits.
    function setMeta(text, alts) {
      var list = [text || ''].concat(Array.isArray(alts) ? alts : []);
      for (var k = 0; k < list.length; k++) {
        if (el.meta.textContent !== list[k]) el.meta.textContent = list[k];
        if (k === list.length - 1 || !(el.meta.scrollWidth > el.meta.clientWidth + 1)) return;
      }
    }
    function setProgress(v, max) { el.bar.set(v, Math.max(1, max)); el.bar.setAttribute('aria-valuetext', Math.min(v, max) + ' of ' + max); }
    function setGoal(text) { el.goal.textContent = text || ''; el.goal.hidden = !text; syncGuide(); }
    function setTip(t) {
      ui.clear(el.tip);
      el.tip.hidden = !t;
      syncGuide();
      if (!t) return;
      el.tip.appendChild(h('span.pl-tip-k', 'Tip'));
      el.tip.appendChild(h('span', typeof t === 'string' ? t : t.text));
    }
    function note(node) { if (node) el.notes.appendChild(node); el.feedback.hidden = el.feedback.hidden && !node; return node; }
    function clearNotes() { ui.clear(el.notes); }
    function notice(node) { ui.clear(el.notice); if (node) el.notice.appendChild(node); }
    P.setLabel = setLabel; P.setMeta = setMeta; P.setProgress = setProgress; P.setGoal = setGoal;
    P.setTip = setTip; P.note = note; P.clearNotes = clearNotes; P.notice = notice;
    // The "How to solve" button: P.setHowTo(def, card) shows it, P.setHowTo(null) hides it.
    P.setHowTo = function (def, card) { P.howTo = def && card ? { def: def, card: card } : null; el.howBtn.hidden = !P.howTo; };
    P.showHud = function (on) { el.hud.hidden = !on; };

    function focusTrial() {
      var a = doc.activeElement;
      if (a && a !== doc.body && el.root.contains(a) && !el.feedback.contains(a)) return;
      try { el.trial.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    function bringIntoView() {
      try {
        var top = el.root, prev = el.root.previousElementSibling; // a Watch, Try, Go header belongs to the player
        if (prev && prev.classList && prev.classList.contains('pl-wtg')) top = prev;
        var r = top.getBoundingClientRect();
        if (r.top < 0 || r.top > (win.innerHeight || 800) * 0.4) win.scrollTo(0, Math.max(0, r.top + (win.pageYOffset || 0) - 64));
      } catch (e) { /* ignore */ }
    }

    function help() {
      var custom = P.view && P.layout === 'custom';
      function row(k, t) { return h('li', h('kbd.px-kbd', k), h('span', t)); }
      ui.modal({
        title: 'Keys',
        className: 'pl-keys',
        body: [
          h('ul.pl-keylist',
            row('1–9', custom ? 'Pick (as shown on the item)' : 'Pick an option'),
            row('Enter', 'Confirm a choice of two, or go on'),
            row('Space', 'Next item'),
            row('Esc', 'Pause; during a moving display the exercise pauses itself'),
            row('S', 'Show me the solution'),
            row('?', 'This list')),
          h('p.px-meta', 'While a solution plays: Space pauses, → steps, R replays and Esc closes it.'),
        ],
        actions: [{ label: 'Close', kind: 'secondary' }],
      });
    }
    P.help = help;

    /* ---------- keys, events ---------- */
    var popKeys = keys.push({
      Enter: function () {
        if (P.state === 'respond') return confirmMulti('key') ? undefined : false;
        if (P.state === 'reveal') { goNext(); return undefined; }
        if (P.state === 'showme') { if (runner.tapMode()) runner.cmd('next'); return undefined; } // a demo's Next; after an answer, Next waits until show me ends or is closed
        return false;
      },
      Space: function () {
        if (P.state === 'showme') { runner.cmd('pause'); return undefined; }
        if (P.state === 'reveal') { goNext(); return undefined; }
        return false;
      },
      Escape: function () {
        if (P.state === 'showme') { runner.cmd('close'); return undefined; }
        if (P.state === 'respond' || P.state === 'present' || P.state === 'paused' || (P.state === 'reveal' && !opts.noFeedbackPause)) { togglePause(); return undefined; }
        return false;
      },
      ArrowRight: function () { if (P.state === 'showme') { runner.cmd('step'); return undefined; } return false; },
      r: function () { if (P.state === 'showme') { runner.cmd('replay'); return undefined; } return false; },
      s: function () { if (P.state === 'reveal') { showMe(false); return undefined; } return false; },
      '?': function () { help(); },
    }, { through: true });

    P.offs.push(bus.on('stage3d:lost', function () { voidNow('lost'); }));
    P.offs.push(bus.on('trial:void', function (e) {
      if (e && e.seed !== undefined && P.item && e.seed !== P.item.seed) return; // an older trial
      voidNow((e && e.reason) || 'void');
    }));
    P.offs.push(bus.on('stage3d:dead', function () {
      var b = ui.button('Restart 3D', { kind: 'secondary', small: true, onClick: function () { try { S3.restart(); } catch (e) { /* ignore */ } notice(null); } });
      notice(h('div.px-notice.px-notice--warn.pl-notice', h('span', 'The 3D view stopped and did not come back. Restart it, or reload the page.'), b));
    }));
    P.offs.push(bus.on('theme', function () { if (S3 && P.view && needsGL(P.view)) { try { S3.refreshTheme(); } catch (e) { /* ignore */ } } if (P.ctx) P.ctx.theme = dark() ? 'dark' : 'light'; }));
    // A modal (the keys sheet, the More sheet) pauses the item under it, so its clock and time
    // limit stop; when the last modal closes, the item goes on (or is presented: run() waits).
    P.offs.push(bus.on('modal:open', function () {
      if ((P.state === 'respond' || P.state === 'present') && pause(true)) P.modalPause = true;
    }));
    P.offs.push(bus.on('modal:close', function () {
      if (ui.modalOpen()) return;
      if (P.presentLater) P.presentLater();
      if (P.modalPause) { P.modalPause = false; resume(); }
    }));
    function onVisibility() { if (doc.hidden && P.state === 'respond') pause(); }
    doc.addEventListener('visibilitychange', onVisibility);

    // H3: the shape of the screen (orientation and screen class); a change while a stimulus plays
    // or a timed item runs voids the trial (CLAUDE.md rule 7).
    function shape() {
      var w = win.innerWidth || 0, hh = win.innerHeight || 0;
      return { o: w > hh ? 'landscape' : 'portrait', c: display() };
    }
    function onShape() {
      if (!P.stimOn || !P.shape0) return;
      var now2 = shape();
      if (now2.o !== P.shape0.o || now2.c !== P.shape0.c) voidNow('turned');
    }
    P.shape = shape;
    win.addEventListener('resize', onShape);
    win.addEventListener('orientationchange', onShape);
    // H4: the last input event (pointer type or key) tells how an answer was given; a tap also
    // lets the browser play sounds (it needs a user gesture).
    function onInputEv(e) {
      P.lastInput = { kind: e.type === 'keydown' ? 'key' : e.pointerType === 'touch' || e.pointerType === 'pen' ? e.pointerType : 'mouse', t: timing.now() };
      if (sound.wanted()) sound.unlock();
    }
    doc.addEventListener('pointerdown', onInputEv, true);
    doc.addEventListener('keydown', onInputEv, true);
    function inputName(source, t) {
      if (source === 'api' || source === 'timeout' || source === 'skip' || source === 'error') return null;
      var li = P.lastInput;
      if (li && t - li.t <= 3000) return li.kind; // the event that gave the answer (a click by Enter is a key)
      return source === 'key' ? 'key' : source === 'touch' ? 'touch' : source === 'pointer' ? (P.lastPointer === 'touch' ? 'touch' : 'mouse') : null;
    }

    P.answer = function (correct) {
      if (P.state !== 'respond') return Promise.reject(new Error('not answering now (state ' + P.state + ')'));
      var def = P.def, item = P.item, type = answerType(def, item), resp = responseFor(def, item, correct);
      if (resp === null) return Promise.reject(new Error('no ' + (correct ? 'right' : 'wrong') + ' response found'));
      if (P.grid) {
        if (type === 'multi') { P.grid.select(null); resp.forEach(function (i) { P.grid.pick(i, 'api'); }); confirmMulti('api'); }
        else P.grid.pick(type === 'yesno' ? (resp ? 0 : 1) : resp, 'api');
      } else {
        // a view that judges its own stimulus (Track, Homing) gives the meta its own answers carry
        var meta;
        try { meta = P.view && typeof P.view.answerMeta === 'function' ? P.view.answerMeta() || undefined : undefined; } catch (e) { meta = undefined; }
        respond(resp, 'api', meta);
      }
      return Promise.resolve(P.last ? P.last.result : null);
    };
    P.setFast = function (on) { if (P.ctx) P.ctx.fast = !!on; };
    P.destroy = function () {
      abort();
      unmountView();
      popKeys();
      P.offs.forEach(function (off) { off(); });
      P.offs = [];
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('resize', onShape);
      win.removeEventListener('orientationchange', onShape);
      doc.removeEventListener('pointerdown', onInputEv, true);
      doc.removeEventListener('keydown', onInputEv, true);
      if (el.root.parentNode) el.root.parentNode.removeChild(el.root);
      P.item = null;
      setState('idle');
      var at = livePlayers.indexOf(P);
      if (at >= 0) livePlayers.splice(at, 1);
      bodyClasses();
      if (current === P) current = null;
    };
    current = P;
    livePlayers.push(P);
    return P;
  }

  var current = null; // the live player (tests, PX.debug)
  var playerSeq = 0, livePlayers = [];
  // H1: the body classes say whether any live player has an item mounted or a stimulus playing.
  function bodyClasses() {
    var b = doc.body, item = false, stim = false;
    if (!b) return;
    livePlayers.forEach(function (x) { if (x.itemOn) item = true; if (x.stimOn) stim = true; });
    b.classList.toggle('px-item', item);
    b.classList.toggle('px-stim', stim);
  }

  /* Sounds (settings.sound, off by default): short synthesized tones after an answer, a rising
     pair when right and one low tone when not; never while a stimulus plays (body.px-stim). The
     browser lets a page play sound only after a user gesture, so the first tap or key after the
     setting is on creates (or resumes) the AudioContext; Settings plays a sample on the tap that
     turns it on. Nothing is downloaded: the tones are made with Web Audio oscillators. */
  var sound = (function () {
    var ctx = null;
    function Ctor() { return win.AudioContext || win.webkitAudioContext || null; }
    function wanted() { try { return !!(store.state.settings && store.state.settings.sound === true); } catch (e) { return false; } }
    function unlock() {
      try {
        var A = Ctor();
        if (!A) return false;
        if (!ctx) ctx = new A();
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        return true;
      } catch (e) { return false; }
    }
    function tone(freq, start, dur, type, peak) {
      var o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + start;
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }
    // kind: 'right' | 'wrong'. Returns true when a tone was scheduled.
    function play(kind) {
      if (!wanted() || !ctx || ctx.state === 'closed') return false;
      if (doc.body && doc.body.classList.contains('px-stim')) return false;
      try {
        if (kind === 'right') { tone(660, 0, 0.09, 'sine', 0.07); tone(880, 0.08, 0.12, 'sine', 0.07); }
        else tone(220, 0, 0.18, 'triangle', 0.08);
        sound.played++;
        return true;
      } catch (e) { return false; }
    }
    return { wanted: wanted, unlock: unlock, play: play, ready: function () { return !!ctx; }, played: 0 };
  })();

  // A correct answer slower than this gets "See solution": 1.5 × the person's median right
  // answer time on the exercise (last 30), at least 4 s; 15 s before 5 right answers exist.
  var slowCache = {};
  function slowMs(exId) {
    if (isNum(CONFIG.slowMs)) return CONFIG.slowMs;
    var r = rec(), key = ((r.trials ? r.trials.length : 0) / 10) | 0;
    if (slowCache[exId] && slowCache[exId].key === key) return slowCache[exId].ms;
    var rts = [];
    try {
      var names = E().log.names(r), rows = r.trials || [];
      for (var i = rows.length - 1; i >= 0 && rts.length < 30 && i >= rows.length - 3000; i--) {
        var row = rows[i];
        if (Array.isArray(row) && names.ex[row[1]] === exId && row[5] === 1 && isNum(row[6])) rts.push(row[6]);
      }
    } catch (e) { rts = []; }
    var ms = rts.length >= 5 ? Math.max(4000, 1.5 * U.median(rts)) : 15000;
    slowCache[exId] = { key: key, ms: ms };
    return ms;
  }

  /* =====================================================================================
     Cards (a panel with a choice, shown in place of the player) and the focus chrome
     ===================================================================================== */

  // o: { title, def, lines: [text | node], actions: [{ label, value, primary, kind }], hide: el }
  // → Promise<value>. Enter or Space picks the primary action unless a button has focus.
  // A screen's cleanup calls closeCards(): the open cards go with their key layers and resolve
  // with 'closed' (their callers ignore results once their session is done).
  var openCards = [];
  function closeCards() { openCards.slice().forEach(function (done) { done('closed'); }); }

  // A tutorial's length (O6; fresh-player round 4: the tour's "3 min" hid three demos and a dozen Try
  // items): learn.minutes where the exercise measured it, else from its content: about 30 s for the demo,
  // 20 s for each Try item (at most 5 play), 20 s for a rules card and 15 s for a strategy card.
  function wtgSeconds(learn) {
    if (learn && isNum(learn.minutes) && learn.minutes > 0) return learn.minutes * 60;
    var L = learn || {}, rules = Array.isArray(L.rules) && L.rules.length > 0;
    var tries = Array.isArray(L.practice) ? Math.min(5, L.practice.length) : 0;
    return 30 + 20 * tries + (rules ? 20 : 0) + (rules || typeof L.strategyFirst === 'string' ? 15 : 0);
  }
  function minutesWords(sec) {
    var m = Math.max(1, Math.round(sec / 60));
    return m === 1 ? 'a minute' : m === 2 ? 'two minutes' : m === 3 ? 'three minutes' : m + ' minutes';
  }
  function wtgMinutes(learn) { return minutesWords(wtgSeconds(learn)); }
  // The Chimera line every share text ends with (the full link; PX.ui.chimera.LINE when present).
  function chimeraLine() {
    var L = PX.ui.chimera && typeof PX.ui.chimera.LINE === 'string' && PX.ui.chimera.LINE ? PX.ui.chimera.LINE : '';
    return L || 'Built by the Chimera community on Discord: https://discord.gg/chmr';
  }
  // A Chimera invite (CONTRACT-v1.2 H): W1-rules' component, or nothing while it is missing.
  function invite(kind, opts) {
    try { return PX.ui.chimera && typeof PX.ui.chimera.invite === 'function' ? PX.ui.chimera.invite(kind, opts || {}) || null : null; } catch (e) { log('invite failed', e); return null; }
  }
  // PLAN milestone 5's needle sweep (W3-game: PX.ui.game.sweep): where a shown level moves on a bar (a block's
  // level note, a summary row), once the bar is in the page; the game module decides whether it plays
  // (never at the quiet level, under reduced motion or during a stimulus).
  function sweep(bar, before, after) {
    try { if (bar && bar.isConnected && PX.ui.game && typeof PX.ui.game.sweep === 'function') PX.ui.game.sweep(bar, before, after); } catch (e) { log('sweep failed', e); }
  }
  // The one invite of a summary goes to the highest kind (CONTRACT-v1.2 R): lower ranks first.
  var INVITE_ORDER = ['best', 'path', 'grade', 'plateau', 'achievement', 'check'];
  function INVITE_RANK(kind) { var r = INVITE_ORDER.indexOf(kind); return r < 0 ? INVITE_ORDER.length : r; }
  // v1.2 wave 2 (CONTRACT-v1.2 O): an event row (typed fields only), added between items, then saved.
  function logEvent(kind, exId, data) {
    try {
      var Ev = E().events;
      if (Ev && typeof Ev.add === 'function' && Ev.add(rec(), kind, exId || null, data, now())) save();
    } catch (e) { log('event failed (' + kind + ')', e); }
  }
  // The hook points of CONTRACT-v1.2 R (js/ui/hooks.js): a point's results, never an exception.
  function hookCollect(point, ctx) {
    var Hk = PX.ui.hooks;
    if (!Hk) return [];
    try { return Hk.collect(point, ctx); } catch (e) { log('hooks at ' + point + ' failed', e); return []; }
  }
  function hookRun(point, ctx) {
    var Hk = PX.ui.hooks;
    if (!Hk || !Hk.list(point).length) return Promise.resolve(null);
    try { return Hk.run(point, ctx).then(null, function (e) { log('hooks at ' + point + ' failed', e); return null; }); } catch (e) { log('hooks at ' + point + ' failed', e); return Promise.resolve(null); }
  }
  // The answer control of a trial (CONTRACT-v1.2 N, E.log.AMODES): a custom view's respond meta
  // `amode` (or Homing's and Reckon's `mode`), else 'option' for the answer grid.
  var AMODE_NAMES = { option: 1, drag: 1, dial: 1, fine: 1, keys: 1, place: 1, draw: 1 };
  function amodeOf(source, meta, grid) {
    if (isObj(meta) && typeof meta.amode === 'string' && hasOwn.call(AMODE_NAMES, meta.amode)) return meta.amode;
    if (isObj(meta) && typeof meta.mode === 'string' && hasOwn.call(AMODE_NAMES, meta.mode)) return meta.mode;
    return grid && source !== 'view' ? 'option' : null;
  }

  // The gentle motion profile for Homing and Reckon (v1.2, O36; CONTRACT-v1.2 F): the setting, or
  // 'auto' with the app's reduced motion on.
  function gentleMotion() {
    var g = 'auto';
    try { g = rec().settings.gentleMotion || 'auto'; } catch (e) { g = 'auto'; }
    return g === 'on' || (g === 'auto' && reducedMotion());
  }
  // The strategy card the teaching template shows before Try 1 (note D2 §3.0 C3): learn.strategyFirst,
  // else the first analytic card, else the first.
  function firstStrategy(learn) {
    var list = learn && Array.isArray(learn.strategies) ? learn.strategies.filter(isObj) : [];
    if (!list.length) return null;
    var want = learn.strategyFirst;
    return list.filter(function (x) { return want && x.id === want; })[0] || list.filter(function (x) { return x.id === 'analytic'; })[0] || list[0];
  }
  function strategyBody(card) {
    return [h('p', card.text || ''), Array.isArray(card.steps) && card.steps.length ? h('ol.pl-strategy-steps', card.steps.map(function (x) { return h('li', x); })) : null,
      card.when ? h('p.px-meta', card.when) : null];
  }
  // src: where the card was opened, for the card event (CONTRACT-v1.2 O): 'howto' (the player's
  // "How to solve" button)
  function strategySheet(def, card, src) {
    var t0 = now();
    return ui.modal({ title: card.title || 'How to solve ' + (def.short || def.name), className: 'pl-strategies pl-howto-card', body: [h('section.pl-strategy', strategyBody(card))], actions: [{ label: 'Close', kind: 'secondary' }],
      onClose: function () { logEvent('card', def.id, { card: card.id, src: src || 'howto', ms: Math.max(0, now() - t0) }); } });
  }
  function showCard(parent, before, o) {
    return new Promise(function (resolve) {
      var K = PX.ui.kit, p = K.panel({ title: o.title, className: ['pl-card', o.className].filter(Boolean).join(' '), aside: o.aside || null }), primary = null, popK = null, closed = false;
      if (o.def) {
        var tag = tagOf(o.def);
        p.body.appendChild(h('div.pl-card-spec', specOf(o.def), tag ? h('span.px-tag', tag) : null));
      }
      (o.lines || []).forEach(function (l) { if (l) p.body.appendChild(typeof l === 'string' ? h('p', l) : l); });
      var row = h('div.pl-card-actions');
      function done(v) {
        if (closed) return;
        closed = true;
        var at = openCards.indexOf(done);
        if (at >= 0) openCards.splice(at, 1);
        if (popK) popK();
        if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
        if (o.hide) o.hide.hidden = false;
        resolve(v);
      }
      (o.actions || []).forEach(function (a) {
        var b = ui.button(a.label, { kind: a.primary ? 'primary' : a.kind || 'secondary', key: a.primary ? 'Enter' : null, onClick: function () { done(a.value); } });
        b.setAttribute('data-card', a.value);
        if (a.primary) primary = { b: b, v: a.value };
        row.appendChild(b);
      });
      p.body.appendChild(row);
      if (o.hide) o.hide.hidden = true;
      parent.insertBefore(p.el, before && before.parentNode === parent ? before : null);
      p.el.setAttribute('data-card-box', o.id || '');
      var go = function () { if (primary) done(primary.v); return primary ? undefined : false; };
      popK = keys.push({ Enter: go, Space: go }, { through: true });
      p.done = done;
      openCards.push(done);
      if (o.onShow) o.onShow(p, done);
      if (primary) { try { primary.b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      // o.top (Watch, Try, Go's stepper): the card screen opens at that element's top, under a
      // sticky header if there is one (W1-band-A's request: the stepper was cut at the top edge)
      try {
        var r = p.el.getBoundingClientRect();
        if (o.top && o.top.isConnected) {
          var off = 8, hd = doc.querySelector('.px-header'), hs = hd ? win.getComputedStyle(hd) : null;
          if (hs && hs.display !== 'none' && /sticky|fixed/.test(hs.position)) off = Math.max(8, hd.getBoundingClientRect().bottom + 8);
          var tr = o.top.getBoundingClientRect();
          if (Math.abs(tr.top - off) > 1) win.scrollTo(0, Math.max(0, tr.top + (win.pageYOffset || 0) - off));
        } else if (r.top < 0 || r.bottom > win.innerHeight) win.scrollTo(0, Math.max(0, r.top + (win.pageYOffset || 0) - 72));
      } catch (e) { /* ignore */ }
    });
  }

  // While items run, the footer and the phone tab bar step aside (css/play.css).
  function setChrome(focus) {
    try { if (focus) doc.documentElement.setAttribute('data-chrome', 'focus'); else doc.documentElement.removeAttribute('data-chrome'); } catch (e) { /* ignore */ }
  }

  function fillParams(def, p) {
    var out = {};
    p = p || {};
    def.dims.forEach(function (d) { var v = p[d.key]; out[d.key] = Number.isInteger(v) && v >= 0 && v < d.levels.length ? v : 0; });
    if (def.variants) out.variant = def.variants.indexOf(p.variant) >= 0 ? p.variant : def.variants[0];
    (def.extraParams || []).forEach(function (k) { if (p[k] !== undefined) out[k] = p[k]; });
    return out;
  }

  /* =====================================================================================
     Watch, Try, Go (learn.js data; PLAN §8): a slow demo with captions (view.demo), 3–5
     practice items that are never logged, with tips when they are needed; the scored start is
     the caller's (a session's first items of an exercise come from its easy end).
     v1.2 teaching template (note D2 §3.0 C; CONTRACT-v1.2 D), for exercises whose learn.js has
     `rules` or `strategyFirst`: a rules card before the Watch (on phones too), the strategy card
     before Try 1 and a "How to solve" button after it; practice entries may be { params, assist,
     tip, seed } (Try 1's first step done: ctx.assist).
     wtg(P, exId, { host, before, tour }) → Promise<'done' | 'skipped' | 'end' | 'none'>
     ===================================================================================== */

  // The reading strip's height after an answer on a phone (verdict line and one row of buttons)
  function stripRoom() { // portrait phones only: held sideways the item needs every pixel of height
    try { if (!(win.matchMedia && win.matchMedia('(max-width: 719px) and (min-height: 501px)').matches)) return 0; } catch (e) { return 0; }
    var rem = 16;
    try { rem = parseFloat(win.getComputedStyle(doc.documentElement).fontSize) || 16; } catch (e) { /* default */ }
    return Math.round(6.75 * rem);
  }
  function isPhone() {
    try { return !!(win.matchMedia && win.matchMedia('(max-width: 719px), (max-height: 500px)').matches); } catch (e) { return false; }
  }
  // Keeps the item on the screen once it plays: its stimulus and every answer control above what is
  // pinned to the bottom (a show-me's caption and bar on phones, the reading strip on wider screens),
  // and a top edge in view: the status strip (HUD), or while a demo or show-me runs the item itself
  // (the strip and the goal may scroll away above it then). Under the sticky header on wide screens.
  // When both cannot hold, the top wins. pinned: a demo or show-me runs, or is about to (before its
  // bar is up, phones keep 7.5rem for it). Watch, Try, Go's own header may scroll away above.
  function stageIntoView(P, pinned) {
    try {
      var vh = win.innerHeight || 640, top = 0, rem = parseFloat(win.getComputedStyle(doc.documentElement).fontSize) || 16;
      var head = doc.querySelector('.px-header');
      if (head && win.getComputedStyle(head).display !== 'none') { var hr = head.getBoundingClientRect(); if (hr.bottom > 0 && hr.top <= 0) top = hr.bottom; }
      var hud = P.el.hud.getBoundingClientRect(), bottom = 0, itemTop = vh;
      [P.el.host, P.el.grid, P.el.confirmRow].forEach(function (e) {
        if (!e || e.hidden) return;
        var r = e.getBoundingClientRect();
        if (r.height) { bottom = Math.max(bottom, r.bottom); itemTop = Math.min(itemTop, r.top); }
      });
      if (!bottom || !hud.height) return;
      var anchor = pinned ? itemTop - 8 : hud.top;
      var limit = vh - 8;
      if (pinned) {
        var found = false;
        [P.el.feedback, P.el.root.querySelector('.pl-showme-buttons'), P.el.host.querySelector('.ex-caption'), P.el.caption].forEach(function (e) {
          if (!e || e.closest('[hidden]')) return;
          var cs = win.getComputedStyle(e);
          if (cs.display === 'none' || (cs.position !== 'fixed' && cs.position !== 'sticky')) return;
          var r = e.getBoundingClientRect();
          if (r.height && r.top > top && r.top < vh) { limit = Math.min(limit, r.top - 4); found = true; }
        });
        if (!found && isPhone()) limit = Math.min(limit, vh - 7.5 * rem);
      }
      var by = 0;
      if (bottom > limit) by = Math.min(bottom - limit, anchor - top);
      else if (anchor < top) by = Math.max(anchor - top, bottom - limit);
      if (Math.abs(by) >= 1) win.scrollBy(0, by);
    } catch (e) { /* cosmetic */ }
  }

  function wtg(P, exId, o) {
    o = o || {};
    var def = PX.ex.get(exId), learn = PX.ex.learn(exId);
    if (!def || !learn || !P.use(exId)) return Promise.resolve('none');
    // learn.demo may hold one demo per variant (Views has three): the item's own, else the first.
    var demos = Array.isArray(learn.demo) ? learn.demo.filter(isObj) : [];
    var demoSpec = P.view.demo ? demos.filter(function (d) { return o.variant && d.params && d.params.variant === o.variant; })[0] || demos[0] || null : null;
    // Practice entries: plain params, or { params, assist, tip, seed } (v1.2)
    var practice = (Array.isArray(learn.practice) ? learn.practice : []).slice(0, 5).map(function (x) { return isObj(x) && isObj(x.params) ? x : { params: x }; });
    // round 4 (first-session test): in the tour, attention practice (Track) keeps every Try item at the first
    // entry's settings; its ladder (more targets, a turning view) belongs to its own Watch, Try, Go
    if (o.tour && def.practice === 'attention' && practice.length) practice = practice.map(function () { return { params: practice[0].params }; });
    var rules = (Array.isArray(learn.rules) ? learn.rules : []).map(function (r) {
      return typeof r === 'string' ? { text: r } : isObj(r) && typeof r.text === 'string' ? r : null;
    }).filter(Boolean);
    var template = rules.length > 0 || typeof learn.strategyFirst === 'string';
    var card = template ? firstStrategy(learn) : null;
    var host = o.host || P.el.root.parentNode, skipped = false, ended = false, partsPaused = false;
    var t0 = now(), tries = 0, rightN = 0; // the wtg event (CONTRACT-v1.2 O)
    var names = ['Watch', 'Try', 'Go'];
    var marks = names.map(function (n, i) { return h('li.pl-wtg-step', h('span.pl-wtg-n.px-num', String(i + 1)), h('span.pl-wtg-name', n)); });
    var text = h('p.pl-wtg-text', { 'aria-live': 'polite' });
    // The labelled parts: listed in full on a wide screen; on a phone folded behind "Parts", so the
    // demo item stays on the screen (css/play.css).
    var parts = h('ul.pl-parts', { id: 'pl-parts-' + exId });
    function setParts(open) {
      head.classList.toggle('is-parts-open', open);
      partsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      partsBtn.firstChild.textContent = open ? 'Hide parts' : 'Parts'; // the open list has a visible way out (fresh-player test)
    }
    var partsBtn = ui.button('Parts', { kind: 'ghost', small: true, ariaLabel: 'What the parts of the item are', onClick: function () {
      var open = !head.classList.contains('is-parts-open');
      setParts(open);
      // O8: on a phone the list sits above the item, so a playing demo waits while it is open
      if (open && isPhone() && P.state === 'showme' && !P.showmePaused()) { P.showmeCmd('pause'); partsPaused = true; }
      else if (!open && partsPaused) { partsPaused = false; if (P.state === 'showme' && P.showmePaused()) P.showmeCmd('pause'); }
    } });
    partsBtn.classList.add('pl-parts-btn');
    partsBtn.setAttribute('aria-expanded', 'false');
    partsBtn.setAttribute('aria-controls', parts.id);
    function partsOn(on) { parts.hidden = !on; partsBtn.hidden = !on; }
    var skipBtn = ui.button(o.tour ? 'Skip this exercise' : 'Skip', { kind: 'ghost', small: true, onClick: function () { skipped = true; closeCards(); P.abort(); } });
    skipBtn.setAttribute('data-wtg-skip', '');
    var endBtn = o.tour ? ui.button('End the tour', { kind: 'ghost', small: true, onClick: function () { skipped = true; ended = true; closeCards(); P.abort(); } }) : null;
    if (endBtn) endBtn.setAttribute('data-tour-end', '');
    var head = h('section.pl-wtg', { 'aria-label': 'Watch, Try, Go: ' + (def.short || def.name), 'data-wtg': exId },
      h('div.pl-wtg-top', h('ol.pl-wtg-steps', marks), h('div.pl-wtg-tools', partsBtn, skipBtn, endBtn)), text, parts);
    partsOn(false);
    if (o.lead) head.insertBefore(h('p.pl-wtg-lead.px-meta', o.lead), head.firstChild);
    host.insertBefore(head, P.el.root);
    host.classList.add('is-wtg'); // css/play.css sizes Watch, Try, Go to fit one screen
    P.setLabel(def);
    P.setMeta('Watch, Try, Go'); // its own step count follows (a session's count waits meanwhile)
    P.setProgress(0, practice.length + 1);
    function stage(n, t) {
      marks.forEach(function (m, i) { m.classList.toggle('is-current', i === n); m.classList.toggle('is-done', i < n); if (i === n) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current'); });
      text.textContent = t;
    }
    function showParts(item) {
      ui.clear(parts);
      var v = item && item.params ? item.params.variant : null;
      (learn.parts || []).filter(function (pt) { return !pt.variant || pt.variant === v; }).forEach(function (pt) {
        parts.appendChild(h('li', h('b', pt.label), h('span', pt.text)));
      });
      if (parts.firstChild) { // phones: a Close button at the end of the open list (desktop shows the list anyway)
        var pc = ui.button('Close the parts', { kind: 'secondary', small: true, onClick: function () { setParts(false); if (partsPaused) { partsPaused = false; if (P.state === 'showme' && P.showmePaused()) P.showmeCmd('pause'); } } });
        pc.setAttribute('data-parts-close', '');
        parts.appendChild(h('li.pl-parts-close', pc));
      }
      partsOn(!!parts.firstChild);
    }
    // The header above the item can push it down: just before an item plays (its first frame comes
    // after this), the item is brought onto the screen (the header may scroll away). A demo is
    // fitted again when it starts, under its pinned caption and bar (makeRunner).
    // A Try item on a phone is sized to leave the reading strip's room (makeRoom), so at the reveal
    // the scroll is about the stepper's height and the Pause row stays (W1-band-A's request).
    function stageSoon(item, demo) {
      P.when('present').then(function () { if (P.item === item) stageIntoView(P, demo); });
      // and once its answer controls are up (Span's Undo and Done, Reckon's Walk and Here come then)
      if (!demo) P.when('respond').then(function () { if (P.item === item) stageIntoView(P, false); });
    }
    // Phones size the item from --pl-avail (css/play.css), the screen less the status strip. Here a
    // Try item's goal and tip shown above it take their share first (--pl-extra on the host, read by
    // .is-wtg), so a Try item fits like a scored one (RV-play-dat). In Watch the strip and the goal
    // scroll away while the demo plays (stageIntoView), and the item gives up what the show-me
    // caption and bar pinned under it need beyond that strip's room: 7.5rem less about 3.5rem.
    function makeRoom(goal, tip, demo) {
      if (!isPhone()) { host.style.removeProperty('--pl-extra'); return; }
      try {
        P.setGoal(goal); P.setTip(tip); // run() sets the same again
        var g = P.el.guide, gh = g ? g.getBoundingClientRect().height : 0;
        var rem = parseFloat(win.getComputedStyle(doc.documentElement).fontSize) || 16;
        var extra = demo ? 4 * rem : (gh > 0 ? gh + 0.5 * rem : 0) + stripRoom();
        host.style.setProperty('--pl-extra', Math.round(extra) + 'px');
      } catch (e) { /* the item keeps its usual size */ }
    }
    // The answers so far (the demo's, then each Try item's): a Try item's answer differs from the one
    // before, and yes/no never comes three times the same in a row (RV-play-dat: Hole Punch's Try
    // answers were 2, 2, 2, 2, 2). Deterministic: the first of a few seeded candidates that passes.
    var answers = [];
    function keyOf(it) {
      var k = it ? it.key : null;
      return typeof k === 'number' || typeof k === 'boolean' ? k : Array.isArray(k) ? k.join(',') : null;
    }
    function varied(k) {
      if (k === null || !answers.length) return true;
      var prev = answers[answers.length - 1];
      if (typeof k === 'boolean') return !(answers.length >= 2 && prev === k && answers[answers.length - 2] === k);
      return k !== prev;
    }
    // The rules card (v1.2): the format's rules in plain words, each with a small picture when the
    // view draws one (view.drawRule), on screen before the demo, phones included.
    function rulesStep() {
      if (!rules.length || skipped) return Promise.resolve();
      stage(0, 'Watch: first the rules, then one item solved slowly.');
      emit('play:screen', { screen: 'wtg-rules', mode: P.mode, exId: exId });
      var list = h('ol.pl-rules', rules.map(function (r) {
        var fig = null;
        if (r.fig !== undefined && P.view && typeof P.view.drawRule === 'function') {
          fig = h('div.pl-rule-fig', { 'aria-hidden': 'true' });
          try { P.view.drawRule(fig, r.fig, P.ctx); } catch (e) { log('drawRule failed (' + exId + ')', e); fig = null; }
        }
        return h('li.pl-rule', fig, h('span.pl-rule-text', r.text));
      }));
      return showCard(host, P.el.root, {
        id: 'wtg-rules', title: 'The rules of ' + (def.short || def.name), className: 'pl-rules-card', hide: P.el.root, lines: [list], top: head,
        actions: [{ label: 'Watch it solved', value: 'watch', primary: true }],
      }).then(function (v) { if (v !== 'watch') skipped = true; });
    }
    // The strategy card before Try 1 (v1.2): three steps in the format's own terms, one tap to
    // close; then "How to solve" reopens it.
    function strategyStep() {
      if (!card || skipped || !practice.length) return Promise.resolve();
      stage(1, 'Try: first a way to solve it, then practice items that never count.');
      emit('play:screen', { screen: 'card:wtg-strategy', mode: P.mode, exId: exId });
      var c0 = now();
      return showCard(host, P.el.root, {
        id: 'wtg-strategy', title: card.title || 'How to solve it', className: 'pl-strategy-card', hide: P.el.root, lines: strategyBody(card), top: head,
        actions: [{ label: 'Got it: try one', value: 'try', primary: true }],
      }).then(function (v) {
        if (v !== 'closed') logEvent('card', exId, { card: card.id, src: 'wtg', ms: Math.max(0, now() - c0) });
        if (v !== 'try') { skipped = true; return; }
        P.setHowTo(def, card);
      });
    }
    function watchStep() {
      if (!demoSpec || skipped) return Promise.resolve();
      emit('play:screen', { screen: 'wtg-watch', mode: P.mode, exId: exId });
      var item;
      try { item = def.generate(PX.rng(demoSpec.seed >>> 0), fillParams(def, demoSpec.params)); } catch (e) { log('demo item failed', e); return Promise.resolve(); }
      stage(0, 'Watch: one item solved step by step. Tap Next, or the figure, for each caption.');
      showParts(item);
      P.setMeta('Watch');
      P.setProgress(0, practice.length + 1);
      answers.push(keyOf(item));
      makeRoom(goalOf(learn, item), null, true);
      stageSoon(item, true);
      return P.demo(item, {
        goal: goalOf(learn, item),
        turn: { skip: practice.length ? 'Skip to Try' : 'Skip to Go' },
        onLastWait: function () { text.textContent = 'Watch: that was the last step. Tap “Your turn” and answer the item yourself.'; },
        onDemoEnd: function () { text.textContent = 'Your turn: answer the demo item yourself. Practice never counts.'; partsOn(false); }, // the item and its options fit again
      }).then(function (tr) {
        if (tr.outcome === 'aborted' || skipped) return null;
        if (tr.end) { skipped = true; ended = true; return null; } // End session (or the tour) from the pause sheet
        return P.waitNext({ label: practice.length ? 'Try it' : 'Go' }).then(function (w) { if (w === 'end') { skipped = true; ended = true; } return w; });
      });
    }
    // A worked example before a Try item (practice entry `example: { seed, params? }`; note D2
    // addendum C): the demo solves one more item, then the Try item comes.
    function exampleStep(entry) {
      var ex = entry && entry.example;
      if (!isObj(ex) || !isNum(ex.seed) || skipped || !P.view || !P.view.demo) return Promise.resolve();
      var item = null;
      try { item = def.generate(PX.rng(ex.seed >>> 0), fillParams(def, isObj(ex.params) ? ex.params : entry.params)); } catch (e) { log('example item failed', e); }
      if (!item) return Promise.resolve();
      stage(1, 'Try: first one more item solved for you, then your turn.');
      P.setMeta('Example');
      makeRoom(goalOf(learn, item), null, true);
      stageSoon(item, true);
      emit('play:screen', { screen: 'wtg-example', mode: P.mode, exId: exId });
      return P.demo(item, { goal: goalOf(learn, item), turn: { skip: 'Now your turn' },
        onLastWait: function () { text.textContent = 'Try: that was the worked example. Tap “Your turn”, then go on to your own item.'; },
      }).then(function (tr) {
        if (tr.outcome === 'aborted' || skipped) return null;
        if (tr.end) { skipped = true; ended = true; return null; }
        if (tr.outcome === 'skipped') return null;
        return P.waitNext({ label: 'Now your turn' }).then(function (w) { if (w === 'end') { skipped = true; ended = true; } });
      });
    }
    function tryStep(i) {
      if (skipped || i >= practice.length) return Promise.resolve();
      return exampleStep(practice[i]).then(function () { return skipped ? null : tryItem(i); });
    }
    function tryItem(i) {
      var entry = practice[i], params = fillParams(def, entry.params), item = null, seed0 = ['px-try', exId, i, counter('tries', exId)];
      if (isNum(entry.seed)) { // a fixed Try item (learn.js chose it, e.g. for its assist)
        try { item = def.generate(PX.rng(entry.seed >>> 0), params); } catch (e) { log('practice item failed', e); }
      }
      var first = null;
      for (var c = 0; c < 6 && !item; c++) {
        var cand = null;
        try { cand = def.generate(PX.rng(seedOf(c ? seed0.concat([c]) : seed0)), params); } catch (e) { log('practice item failed', e); }
        if (!cand) continue;
        if (!first) first = cand;
        if (varied(keyOf(cand))) { item = cand; break; }
      }
      if (!item) item = first;
      if (!item) return tryStep(i + 1);
      answers.push(keyOf(item));
      // a Try item against the clock is announced before it starts (Central Point's Quick form)
      var dl0 = isNum(item.deadlineMs) && item.deadlineMs > 0 ? item.deadlineMs : null;
      stage(1, 'Try: practice item ' + (i + 1) + ' of ' + practice.length + (dl0 ? ', against the clock: answer within ' + Math.round(dl0 / 1000) + ' s; the bar under the item shows the time left.' : '. Practice items never count.'));
      partsOn(false); // the labelled parts belong to Watch; Try keeps the item in view
      P.setMeta('Try ' + (i + 1) + ' of ' + practice.length);
      P.setProgress(i + 1, practice.length + 1);
      // a tip the entry names (v1.2), else the first that fits the item
      var tip = typeof entry.tip === 'string' && Array.isArray(learn.tips) ? learn.tips.filter(function (x) { return isObj(x) && x.id === entry.tip; })[0] || null : null;
      if (!tip) tip = tipFor(exId, learn, item, true);
      makeRoom(goalOf(learn, item), tip ? tip.text : null, false);
      stageSoon(item);
      if (i === 0) emit('play:screen', { screen: 'wtg-try', mode: P.mode, exId: exId });
      // a Try item may carry its own deadline (Central Point's Quick form meets the clock once in Try)
      var dl = isNum(item.deadlineMs) && item.deadlineMs > 0 ? item.deadlineMs : null;
      return P.run(item, { practice: true, goal: goalOf(learn, item), tip: tip ? tip.text : null, assist: entry.assist !== undefined ? entry.assist : null, limitMs: dl, limitBar: !!dl }).then(function (tr) {
        if (tr.outcome === 'aborted' || skipped) return null;
        if (tr.end) { skipped = true; ended = true; return null; }
        if (tr.outcome === 'skipped' || tr.error) return tryStep(i + 1);
        if (tr.outcome === 'right' || tr.outcome === 'wrong') { tries++; if (tr.outcome === 'right') rightN++; }
        var last = i + 1 >= practice.length;
        // The step strip stays on Try while a Try item is on screen (fresh-player test: "3 Go" showed
        // over "Try 3 of 3"); Go comes when it is done (below, and the tutorial's end screen).
        return P.waitNext({ label: !last ? 'Next practice item' : o.tour ? 'Continue' : 'Go' }).then(function (w) {
          if (w === 'end') { skipped = true; ended = true; return null; }
          return w === 'abort' ? null : tryStep(i + 1);
        });
      });
    }
    return rulesStep().then(watchStep).then(function (w) { return w === 'end' ? null : strategyStep(); }).then(function () { return tryStep(0); }).then(function () {
      bump('tries', exId);
      markWtg(exId);
      // In the tour no scored items follow, so Go says honestly where they come: a session's first items.
      stage(2, o.tour ? 'Go: in your sessions, the first ' + (def.short || def.name) + ' items are easy ones, and they count.' : 'Go: the next items count.');
      if (head.parentNode) head.parentNode.removeChild(head);
      host.classList.remove('is-wtg');
      host.style.removeProperty('--pl-extra');
      P.setTip(null);
      var result = ended ? 'end' : skipped ? 'skipped' : 'done';
      logEvent('wtg', exId, { result: result, ms: Math.max(0, now() - t0), tries: tries, right: rightN });
      emit('play:wtg', { exId: exId, result: result, slot: o.slot || null }); // playtest hooks (CONTRACT-v1.2 G)
      return result;
    });
  }

  /* =====================================================================================
     Sessions: train, path, speed, threshold, free, daily (ENGINE.md §17)
     ===================================================================================== */

  function startOpts(p) {
    var o = { now: now(), display: display(), can: function (d) { return canRun(d); } };
    if (Number(p.minutes) > 0) o.minutes = Number(p.minutes);
    if (p.exId) o.exId = String(p.exId);
    if (p.variant) o.variant = String(p.variant);
    if (p.protocol) o.protocol = String(p.protocol);
    if (isObj(p.params)) o.params = p.params;
    if (Number(p.deadlineMs) > 0) o.deadlineMs = Number(p.deadlineMs);
    if (Number(p.trials) > 0) o.trials = Math.round(Number(p.trials));
    if (typeof p.style === 'string') o.style = p.style;
    if (p.mode === 'train' && p.exId) o.pin = String(p.exId);
    if (Number(p.count) > 0) o.count = Math.round(Number(p.count)); // Train: how many exercises (1 = the pinned one only)
    if (typeof p.day === 'string') o.day = p.day;
    return o;
  }

  function sessionScreen(host, route) {
    var p = route.params || {};
    // A friend challenge: the code alone decides the exercise, settings, length and seeds (the
    // URL's other params can be stale after a reload, or crafted); a code that does not decode
    // is refused, so the intro's "the same items" always holds.
    if (typeof p.challenge === 'string' && p.challenge) {
      var CH = PX.ui.share && PX.ui.share.challenge, ch = CH ? CH.decode(p.challenge) : { ok: false, error: 'Challenges are not in this build.' };
      if (!ch.ok) {
        var w0 = h('div.pl-screen', { 'data-mode': 'free' });
        host.appendChild(w0);
        renderUnavailable(w0, 'free', ch.error);
        return null;
      }
      p = CH.route(ch);
    }
    var mode = hasOwn.call(E().modes.MODES, p.mode) && p.mode !== 'check' ? String(p.mode) : 'train';
    var S = { mode: mode, plan: null, step: null, res: null, done: false, ended: false, answered: 0, voidRun: 0, skipRun: 0,
      misses: {}, offered: {}, noticed: false, hidden: false, named: false, challenge: typeof p.challenge === 'string' ? p.challenge : null,
      params: routeParams(p), itemNo: 1, inputs: {}, offs: [], clock: null, viewport: viewport(),
      // v1.2: round scores per exercise ([rounds, total]); motion this session (CONTRACT-v1.2 F)
      rounds: {}, motion: { ms: 0, nextCard: MOTION.first, before: isNum(uiRec().motionMs) ? uiRec().motionMs : 0, newOffered: false }, gentle: false,
      // v1.2 wave 2 (CONTRACT-v1.2 R): the player hooks run in Train, Path, Speed and Free play, never
      // in the Daily, Threshold or a friend challenge (their items are fixed for everyone)
      hooks: hasOwn.call(HOOK_MODES, mode) && typeof p.challenge !== 'string', started: false, firstSeen: {}, afterWtg: false, endMsg: null };
    var wrap = h('div.pl-screen', { 'data-mode': mode });
    host.appendChild(wrap);
    var P = null;
    try { S.plan = E().modes.start(rec(), mode, startOpts(p)); } catch (e) { log('start failed', e); S.plan = { unavailable: 'This session could not start.', done: true }; }
    if (S.plan.unavailable) { renderUnavailable(wrap, mode, S.plan.unavailable); return function () { setChrome(false); }; }
    if (S.plan.boxed && isNum(CONFIG.budgetMs) && CONFIG.budgetMs > 0) S.plan.budgetMs = CONFIG.budgetMs; // tests only
    setChrome(true);
    // The session's one clock (PX.core.clock): it starts with the first item (after an intro card)
    // and stops for the pause sheet, any modal or sheet, a hidden tab and idle time over 60 s.
    var CK = PX.core.clock;
    S.clock = CK.create({ idleMs: 60000, tickMs: 5000 });
    P = createPlayer({ endLabel: mode === 'daily' ? 'End now' : 'End session', mode: mode, onState: function (st) {
      if (!S.clock) return;
      if (st === 'paused') S.clock.pause('sheet'); else S.clock.resume('sheet');
    }, onMotion: function (ms) { // the view's motion, for the comfort cards (never saved mid-stimulus: save() waits for release)
      S.motion.ms += ms;
      var u = uiRec();
      u.motionMs = (isNum(u.motionMs) ? u.motionMs : 0) + ms;
    } });
    emit('play:screen', { screen: 'session', mode: mode, exId: S.plan.exs && S.plan.exs[0] || null });
    if (ui.modalOpen()) S.clock.pause('modal');
    S.offs.push(bus.on('modal:open', function () { if (S.clock) S.clock.pause('modal'); }));
    S.offs.push(bus.on('modal:close', function () { if (S.clock && !ui.modalOpen()) S.clock.resume('modal'); }));
    // The HUD's minutes move on their own (every 5 s), never while a stimulus plays.
    S.clock.on('tick', function () { if (!S.done && !(doc.body && doc.body.classList.contains('px-stim'))) progress(); });
    S.clock.on('resume', function () { if (!S.done) progress(); });
    wrap.appendChild(h('h1.px-sr', MODE_NAMES[mode]));
    wrap.appendChild(P.el.root);
    session.S = S;
    session.P = P;
    // Train has no intro card: one line names what is coming, until the first answer.
    if (mode === 'train' && S.plan.exs && S.plan.exs.length) {
      var exNames = S.plan.exs.map(function (id) { var d = PX.ex.get(id); return d ? d.short || d.name : id; });
      var exList = exNames.length > 1 ? exNames.slice(0, -1).join(', ') + ' and ' + exNames[exNames.length - 1] : exNames[0];
      S.introLine = h('p.px-meta.pl-session-line', 'This session: ' + exList + ', about ' + CK.fmtMinutes(S.plan.budgetMs) + ' of practice.');
      P.notice(S.introLine);
    }

    function progress() {
      var pl = S.plan, total, done, txt;
      if (!P || S.wtg) return; // Watch, Try, Go shows its own step count

      if (mode === 'daily' && pl.daily) {
        total = pl.daily.items.length; done = pl.daily.n;
        txt = 'Daily #' + pl.daily.number + (pl.daily.scored ? '' : ' · practice') + ' · item ' + Math.min(total, S.itemNo) + ' of ' + total;
      } else if (pl.boxed) {
        // A time-boxed session counts down its active minutes ("item 1 of about 105" reads as a
        // mountain); the bar shows the time used.
        var act = S.clock ? S.clock.activeMs() : pl.activeMs || 0;
        txt = MODE_NAMES[mode] + ' · ' + (pl.lastServed ? 'last item' : CK.fmtLeft(pl.budgetMs - act));
        P.setProgress(Math.round(Math.min(act, pl.budgetMs) / 1000), Math.round(pl.budgetMs / 1000));
        P.el.bar.setAttribute('aria-valuetext', CK.fmtMinutes(act) + ' of ' + CK.fmtMinutes(pl.budgetMs) + ' practised');
        P.setMeta(txt, shortMeta(txt));
        return;
      } else if (mode === 'threshold') {
        total = pl.total; done = pl.sc ? pl.sc.n : S.answered;
        txt = 'Threshold · item ' + Math.min(total, S.itemNo) + ' of ' + total;
      } else {
        total = Math.max(1, pl.total + Math.min(pl.extra || 0, Math.ceil(pl.total * 0.25))); done = S.answered;
        txt = MODE_NAMES[mode] + ' · item ' + Math.min(total, S.itemNo) + ' of ' + total;
      }
      P.setMeta(txt, shortMeta(txt));
      P.setProgress(done, total);
    }
    function hud(step, def, item) {
      var learn = PX.ex.learn(def.id);
      if (step.banner || !S.named) { S.named = true; S.hidden = false; P.setLabel(def); }
      else if (step.switched) { S.hidden = true; P.setLabel(null, 'Mixed set'); } // S4+: no name banner
      if (!S.hidden) P.setGoal(goalOf(learn, item)); else P.setGoal('');
      P.setHowTo(howToFor(def, learn), firstStrategy(learn)); // v1.2: the strategy card through the first session
      // the number of the item on screen (it stays during its feedback)
      S.itemNo = step.daily ? step.daily.index + 1 : S.answered + 1;
      progress();
    }
    function clockNow() { return { activeMs: S.clock ? S.clock.activeMs() : 0 }; }
    // "How to solve" in a session: exercises with the teaching template, while their rating has
    // fewer than 20 answers (an exercise's first session); never in a mixed set with its name hidden.
    function howToFor(def, learn) {
      if (!learn || S.hidden || !(Array.isArray(learn.rules) && learn.rules.length || typeof learn.strategyFirst === 'string') || !firstStrategy(learn)) return null;
      var n = 0;
      try { n = E().est.get(rec(), def, { display: S.plan.display }).n; } catch (e) { n = 0; }
      return n < 20 ? def : null;
    }
    // Motion comfort between items (v1.2, O36; note N1 §5.4; CONTRACT-v1.2 F): before an item of a
    // view that moves on its own (view.motion), a one-time notice; a new player's offer to stop
    // after about 5 minutes of motion; a check-in after 3 minutes, then every 5. → 'end' or null.
    function motionGate(def) {
      var v = viewOf(def.id);
      if (!v || v.motion !== true || S.done) return Promise.resolve(null);
      if (gentleMotion()) S.gentle = true;
      var M = S.motion, learn = PX.ex.learn(def.id) || {};
      if (!isSeen('walkNotice')) {
        var text = typeof learn.motionNotice === 'string' && learn.motionNotice ? learn.motionNotice : 'The view moves on its own. If you feel unwell, pause or stop. Gentle motion is in Settings.';
        emit('play:screen', { screen: 'card:motion-notice', mode: mode, exId: def.id });
        return showCard(wrap, P.el.root, { id: 'motion-notice', title: 'A view that moves', def: def, hide: P.el.root, lines: [text],
          actions: [{ label: 'Gentle motion', value: 'gentle' }, { label: 'Start', value: 'start', primary: true }] }).then(function (c) {
          markSeen('walkNotice');
          if (c === 'gentle') setGentle();
          return null;
        });
      }
      if (!M.newOffered && M.before < MOTION.newPlayer && M.ms >= MOTION.newLimit) {
        M.newOffered = true;
        M.nextCard = Math.max(M.nextCard, M.ms + MOTION.every);
        emit('play:screen', { screen: 'card:motion-new', mode: mode, exId: def.id });
        return showCard(wrap, P.el.root, { id: 'motion-new', title: 'About five minutes of motion', def: def, hide: P.el.root,
          lines: ['That was about 5 minutes of moving view. Getting used to it goes best in short sessions spread over days.', 'End here for today, or go on if you feel fine.'],
          actions: [{ label: 'Go on', value: 'go' }, { label: 'End the session', value: 'end', primary: true }] }).then(function (c) { return c === 'end' ? 'end' : null; });
      }
      if (M.ms >= M.nextCard) {
        M.nextCard = M.ms + MOTION.every;
        emit('play:screen', { screen: 'card:motion-checkin', mode: mode, exId: def.id });
        return showCard(wrap, P.el.root, { id: 'motion-checkin', title: 'How do you feel?', def: def, hide: P.el.root,
          lines: [Math.round(M.ms / 60000) + ' minutes of moving view this session. If you feel at all unwell, stop for now; it passes. Gentle motion moves slower and steadier.'],
          actions: [{ label: 'End session', value: 'end' }, { label: 'Gentle motion', value: 'gentle' }, { label: 'Go on', value: 'go', primary: true }] }).then(function (c) {
          if (c === 'gentle') setGentle();
          return c === 'end' ? 'end' : null;
        });
      }
      return Promise.resolve(null);
    }
    function setGentle() {
      try { rec().settings.gentleMotion = 'on'; save(); } catch (e) { log('gentle motion setting failed', e); }
      S.gentle = true;
      if (P && P.ctx) P.ctx.gentleMotion = true;
    }
    function cfgFor(step, def, item) {
      var learn = PX.ex.learn(def.id), tip = step.feedback !== false && !S.hidden ? tipFor(def.id, learn, item) : null;
      var limit = step.deadlineMs || (def.timeLimit ? def.timeLimit(item.params) : null) || null;
      return { feedback: step.feedback !== false, limitMs: limit, limitBar: !!limit, tip: tip ? tip.text : null,
        layer: typeof step.layer === 'string' ? step.layer : '', seed: step.seed }; // v1.2 wave 2: the view's layer; the showme event's seed
    }

    // v1.2 wave 2 (CONTRACT-v1.2 R): what every player hook gets. card(o) shows a card above the
    // item (o: id, title, def, lines, actions [{ label, value, primary }]) and resolves the value
    // tapped ('closed' when the session ends under it); clock.pause/resume(reason) hold the session
    // clock ('measure': a measurement is never practice time); end(msg) ends the session after the
    // hook, with msg on the summary. The player resumes 'measure' when the point's run ends.
    function hookCtx(extra) {
      var c = {
        mode: mode, plan: S.plan, rec: rec(), now: now(), P: P, wrap: wrap,
        card: function (o) {
          o = isObj(o) ? o : {};
          var id = typeof o.id === 'string' && o.id ? o.id : 'hook';
          if (S.done || !P) return Promise.resolve('closed');
          emit('play:screen', { screen: 'card:' + id, mode: mode, exId: o.def && o.def.id ? o.def.id : S.step ? S.step.exId : null });
          return showCard(wrap, P.el.root, Object.assign({}, o, { id: id, hide: P.el.root }));
        },
        clock: {
          pause: function (reason) { if (S.clock) S.clock.pause(typeof reason === 'string' && reason ? reason : 'measure'); },
          resume: function (reason) { if (S.clock) S.clock.resume(typeof reason === 'string' && reason ? reason : 'measure'); },
        },
        end: function (msg) { S.ended = true; if (typeof msg === 'string' && msg) S.endMsg = msg; },
      };
      return Object.assign(c, extra || {});
    }
    // item:before may give the step another seed (the item is generated again) and a layer; never
    // for a step that measures with its own item (a Path recheck, a probe, a Daily or Threshold item)
    var FIXED_KINDS = { recheck: 1, probe: 1, daily: 1, threshold: 1 };
    function itemBefore(step, def, item) {
      if (!S.hooks) return Promise.resolve({ item: item });
      var seed0 = step.seed, key = def.id + '|' + (item.params && item.params.variant || ''), first = !S.firstSeen[def.id];
      var lastOut = S.last && S.last.out ? S.last.out : null;
      var ctx = hookCtx({ step: step, def: def, last: S.last || null, afterTutorial: S.afterWtg, first: first,
        blockEnd: lastOut && lastOut.blockEnd ? lastOut.blockEnd : null, misses: S.misses[key] || 0 });
      S.afterWtg = false;
      return hookRun('item:before', ctx).then(function (r) {
        if (S.clock) S.clock.resume('measure'); // a hook's measurement pause ends with its run
        if (r === 'end') return { end: true };
        if (step.seed === seed0) return { item: item };
        if (step.recheck || hasOwn.call(FIXED_KINDS, step.kind) || !isNum(step.seed)) { step.seed = seed0; return { item: item }; }
        step.seed = step.seed >>> 0;
        var it2 = null;
        try { it2 = def.generate(PX.rng(step.seed), step.params); } catch (e) { log('generate failed (' + step.exId + ', hook seed)', e); }
        if (!it2) { step.seed = seed0; return { item: item }; }
        return { item: it2 };
      });
    }

    function loop() {
      if (S.done) return;
      if (S.ended) { end(); return; }
      // v1.2 wave 2 (CONTRACT-v1.2 R): session:start, after the intro card, before the first item and
      // before the clock starts (a baseline block due now, a measurement week); 'end' ends the session
      if (!S.started) {
        S.started = true;
        if (S.hooks && PX.ui.hooks && PX.ui.hooks.list('session:start').length) {
          hookRun('session:start', hookCtx({})).then(function (r) {
            if (S.clock) S.clock.resume('measure'); // a hook's measurement pause ends with its run
            if (S.done) return;
            if (r === 'end') S.ended = true;
            loop();
          });
          return;
        }
      }
      if (!S.clock.started()) {
        S.clock.start();
        // a new session: an earlier kept summary is no longer the last screen (a tab killed without
        // pagehide then reopens on Today, not on that older summary; review N5)
        if (isObj(uiRec().lastSummary)) uiRec().lastSummary = null;
      }
      S.clock.touch(); // going on to an item is activity (also when a test drives the player)
      var step;
      try { step = E().modes.next(S.plan, rec(), now(), clockNow()); } catch (e) { log('next failed', e); end(); return; }
      if (!step || step.done) { end(); return; }
      // A friend challenge: item i takes the code's seed i, and i moves on only for counted
      // answers, so a voided or skipped item's replacement is the same item (same as the friend's).
      if (S.challenge && PX.ui.share && PX.ui.share.challenge) {
        try { var cs = PX.ui.share.challenge.seedAt(S.challenge, S.answered); if (isNum(cs)) step.seed = cs >>> 0; } catch (e) { /* the engine's seed stays */ }
      }
      S.step = step;
      var def = PX.ex.get(step.exId), item = null;
      if (!def || !P.use(step.exId)) { skipStep(step); return; }
      try { item = def.generate(PX.rng(step.seed), step.params); } catch (e) { log('generate failed (' + step.exId + ')', e); }
      if (!item) { skipStep(step); return; }
      S.skipRun = 0;
      // Train's line naming the session stays until the next item: removed at the answer, it moved
      // the item up at its reveal (W1-band-A's request)
      if (S.introLine && S.answered > 0) { if (S.introLine.parentNode) P.notice(null); S.introLine = null; }
      hud(step, def, item);
      var pre = Promise.resolve(null);
      if (!wtgSeen(def.id) && mode !== 'speed' && mode !== 'threshold') { // the intro's choice never reaches a later stage
        S.wtg = true;
        pre = offerWtg(def).then(function (r) { S.wtg = false; S.afterWtg = r === 'done'; return r; }, function (e) { S.wtg = false; throw e; });
        S.introDemo = undefined;
      }
      else if (step.watch && S.introDemo !== undefined) { pre = S.introDemo ? stageDemo(step, def) : Promise.resolve(null); S.introDemo = undefined; } // asked on the intro card
      else if (step.watch) pre = stageWatch(step, def);
      pre.then(function (r) {
        if (S.done) return null;
        if (r === 'end') { S.ended = true; end(); return null; }
        return motionGate(def).then(function (m) {
          if (S.done) return null;
          if (m === 'end') { S.ended = true; end(); return null; }
          return itemBefore(step, def, item);
        }).then(function (b) {
          if (!b || S.done) return null;
          if (b.end || S.ended) { S.ended = true; end(); return null; }
          item = b.item;
          S.firstSeen[def.id] = true;
          if (!P.use(step.exId)) { skipStep(step); return null; }
          hud(step, def, item);
          return P.run(item, cfgFor(step, def, item)).then(function (tr) { return afterTrial(step, def, item, tr); });
        });
      }).catch(function (e) { log('trial failed', e); end(); });
    }

    // An exercise that cannot be shown: logged as skipped (counts nowhere), never a dead end.
    function skipStep(step) {
      try { E().modes.answer(S.plan, rec(), step, { correct: false, outcome: 'skipped' }, now(), clockNow()); } catch (e) { log('answer failed', e); }
      if (++S.skipRun > 4) { end('Some items could not be shown on this device, so the session ended early.'); return; }
      loop();
    }

    function afterTrial(step, def, item, tr) {
      if (S.done || tr.outcome === 'aborted') return null;
      if (S.clock && tr.outcome !== 'skipped' && !tr.timeout) S.clock.touch(); // an answer is activity, however it came; a time-out is not
      // value2 (trial column 13): the exercise's score() result, else the view's respond meta
      var v2 = tr.result && isNum(tr.result.value2) ? tr.result.value2 : tr.meta && isNum(tr.meta.value2) ? tr.meta.value2 : undefined;
      var result = { correct: !!(tr.result && tr.result.correct), rt: tr.rtMs, value: tr.result ? tr.result.value : undefined, value2: v2, timeout: !!tr.timeout,
        input: tr.input || null, display: tr.display || undefined, amode: tr.amode || null, orient: tr.orient || null }; // v1.2 wave 2: columns 16-17
      if (tr.result && isNum(tr.result.round) && tr.outcome !== 'stutter' && tr.outcome !== 'skipped') { // Quick round scores (v1.2)
        result.round = tr.result.round;
        var rr = S.rounds[def.id] || (S.rounds[def.id] = [0, 0]);
        rr[0] += 1; rr[1] += tr.result.round;
      }
      if (tr.outcome === 'stutter') { result.outcome = 'stutter'; result.voided = true; }
      else if (tr.outcome === 'skipped') result.outcome = 'skipped';
      if (item.fallback === true) result.fallback = true;
      if (tr.input) S.inputs[tr.input] = (S.inputs[tr.input] || 0) + 1;
      var out;
      try { out = E().modes.answer(S.plan, rec(), step, result, now(), clockNow()); } catch (e) { log('answer failed', e); out = { done: false, outcome: 3 }; }
      save();
      S.last = { step: step, tr: tr, out: out };
      if (out.outcome === 0 || out.outcome === 1) { S.answered++; S.voidRun = 0; }
      else if (out.outcome === 2) { S.voidRun++; if (S.voidRun >= VOID_NOTICE && !S.noticed) deviceNotice(); }
      progress();
      if (tr.end) S.ended = true;
      if (tr.outcome === 'skipped' || tr.error) { loop(); return null; }
      notes(step, def, item, tr, out);
      // PLAN milestone 5's game feel (CONTRACT-v1.2 R, item:reveal; W3-game mounts 'game.reveal'): after the
      // verdict is drawn, in every mode whose item gives feedback; it touches only the verdict and ends before
      // the next item paints
      if (step.feedback !== false && (tr.outcome === 'right' || tr.outcome === 'wrong')) {
        hookCollect('item:reveal', { mode: mode, step: step, def: def, item: item, tr: tr, out: out, verdict: P.el.verdict, P: P });
      }
      return P.waitNext({ label: out.done || S.ended ? 'Finish' : 'Next item' }).then(function (w) { // round 3: not the walkthrough's "Next step"
        if (w === 'end') S.ended = true; // End on a pause between items (O4)
        if (w !== 'abort') loop();
      });
    }

    // One panel (level, strategy offer, check-in) per reveal; the others wait for the next
    // reveals, so the item and its marks stay in view.
    function notes(step, def, item, tr, out) {
      var panels = 0;
      if (out.blockEnd && out.blockEnd.after) {
        var timed = mode === 'speed', first = false;
        try { first = E().est.get(rec(), def, { display: S.plan.display, timed: timed }, now()).n <= E().config.session.blockEvery; } catch (e) { first = false; }
        var last5 = S.plan.log.filter(function (x) { return x.exId === def.id && (x.oc === 0 || x.oc === 1); }).slice(-5).map(function (x) { return x.oc; });
        var st0 = null;
        try { st0 = E().est.starter(def, E().est.get(rec(), def, { display: S.plan.display, timed: timed })); } catch (e) { st0 = null; }
        var ln = levelNote(def, out.blockEnd, { first: first, timed: timed, last5: last5, starter: st0 });
        P.note(ln);
        panels++;
        var bb = out.blockEnd.before, ba = out.blockEnd.after;
        if (!first && bb && ba && bb.level !== ba.level) sweep(ln.querySelector('.px-bar'), bb.level, ba.level);
      }
      if (out.path) P.note(pathNote(def, out.path));
      if (mode === 'speed' && out.rated) {
        P.note(h('p.pl-note', out.inTime ? 'In time.' : tr.timeout ? 'The deadline passed.' : 'Not right in time.',
          isNum(out.deadlineMs) ? h('span.px-num', ' Next deadline ' + fmtRt(out.deadlineMs) + '.') : null));
      }
      var ok = tr.outcome === 'right', key = def.id + '|' + (item.params && item.params.variant || '');
      if (tr.outcome === 'wrong') S.misses[key] = (S.misses[key] || 0) + 1; else if (ok) S.misses[key] = 0;
      var learn = PX.ex.learn(def.id);
      var later = [];
      if (S.misses[key] >= 2 && !S.offered[def.id] && learn && Array.isArray(learn.strategies) && learn.strategies.length && step.feedback !== false) {
        S.offered[def.id] = true;
        later.push(function () { return strategyOffer(def, learn); });
      }
      try { if (checkinFits(def) && E().modes.checkinDue(rec(), S.plan, def.id, now())) later.push(function () { return checkinNote(def); }); } catch (e) { /* optional */ }
      // v1.2 wave 2 (CONTRACT-v1.2 R): notes other modules add (fluency notes, apply-item notes):
      // an element, or a function that returns one; they wait their turn like the panels above
      if (S.hooks && step.feedback !== false) {
        hookCollect('item:notes', { mode: mode, plan: S.plan, rec: rec(), now: now(), step: step, def: def, item: item, tr: tr, out: out }).forEach(function (x) {
          if (typeof x === 'function') later.push(x);
          else if (x && x.nodeType === 1) later.push(function () { return x; });
        });
      }
      S.queue = (S.queue || []).concat(later);
      while (!panels && S.queue.length && step.feedback !== false) {
        var node = null;
        try { node = S.queue.shift()(); } catch (e) { log('a note failed', e); node = null; }
        if (node) { P.note(node); panels++; }
      }
    }

    function deviceNotice() {
      S.noticed = true;
      var hide = ui.button('Hide', { kind: 'ghost', small: true, onClick: function () { P.notice(null); } });
      P.notice(h('div.px-notice.pl-notice', { role: 'status' }, PX.ui.kit.icon('warn'),
        h('span', 'The last three items were interrupted by the display, so they did not count. Parallax has already lowered its 3D quality; closing other tabs or apps can help too.'), hide));
    }

    function offerWtg(def) {
      var learn = PX.ex.learn(def.id) || {};
      return showCard(wrap, P.el.root, {
        id: 'wtg-offer', title: 'New: ' + (def.short || def.name), def: def, hide: P.el.root,
        lines: [learn.goal || '', labelLine(def), 'Watch, Try, Go shows how it works in about ' + wtgMinutes(learn) + ': ' + (Array.isArray(learn.rules) && learn.rules.length ? 'the rules, ' : '') + 'a slow demo, a few practice items that never count, then the real items.'],
        actions: [{ label: 'Skip', value: 'skip' }, { label: 'Watch, Try, Go', value: 'go', primary: true }],
      }).then(function (v) {
        if (S.done) return null; // the screen was left with the card open
        if (v !== 'go') { markWtg(def.id); return 'skipped'; }
        return wtg(P, def.id, { host: wrap, variant: S.step && S.step.params ? S.step.params.variant : null });
      });
    }

    // Path: the first item of a new stage names its settings and offers the demo (the session's
    // first stage asks on the intro card instead, so there is one card, not two: I1 B12).
    function stageWatch(step, def) {
      var set = step.preset ? settingsText(def, step.preset) : '';
      return showCard(wrap, P.el.root, {
        id: 'stage', title: 'Path stage ' + step.pathStage + ' of 10', def: def, hide: P.el.root,
        lines: [set ? 'This stage goes up to: ' + set + '. Its items mix easier settings too.' : '', 'A short demo shows how this stage’s items look. It never counts.'],
        actions: [{ label: 'Start the stage', value: 'start' }, { label: 'Watch the demo', value: 'watch', primary: true }],
      }).then(function (v) {
        if (S.done || v !== 'watch') return null;
        return stageDemo(step, def);
      });
    }
    function stageDemo(step, def) {
      if (S.done || !P.view || !P.view.demo) return Promise.resolve(null);
      var params = step.preset && step.preset.params ? fillParams(def, step.preset.params) : step.params, item;
      try { item = def.generate(PX.rng(seedOf(['px-stage', def.id, step.pathStage])), params); } catch (e) { return Promise.resolve(null); }
      P.setMeta('Demo · never counts');
      return P.demo(item, { goal: goalOf(PX.ex.learn(def.id), item) }).then(function (tr) {
        if (tr.outcome === 'aborted') return null;
        if (tr.end) return 'end';
        return P.waitNext({ label: 'Start the stage' });
      });
    }

    // The engine's finish with the clock's reading: how it ended, and where it was played.
    function finishPlan(ended) {
      if (S.clock) S.clock.stop(); // first: the reading stored is the reading kept
      var t = clockNow(), best = null;
      Object.keys(S.inputs).forEach(function (k) { if (!best || S.inputs[k] > S.inputs[best]) best = k; });
      t.ended = ended;
      t.session = { viewport: S.viewport, input: best || undefined };
      if (Object.keys(S.rounds).length) t.session.rounds = S.rounds; // Quick round scores (v1.2)
      if (S.gentle) t.session.gentle = true; // the gentle motion profile was on (v1.2, O36)
      var res = null;
      try { res = E().modes.finish(S.plan, rec(), now(), t); } catch (e) { log('finish failed', e); }
      var sm = res && res.summary;
      emit('play:session', { mode: mode, ended: S.plan.ended || ended || null, practiceMs: isNum(t.activeMs) ? Math.round(t.activeMs) : null,
        answered: sm ? sm.trials : 0, right: sm ? sm.right : 0, exIds: (S.plan.exs || []).slice() });
      return res;
    }
    function dropClock() {
      S.offs.forEach(function (off) { off(); });
      S.offs = [];
      if (S.clock) { S.clock.destroy(); }
    }
    S.finishPlan = finishPlan;
    S.dropClock = dropClock;

    function end(msg) {
      if (S.done) return;
      S.done = true;
      msg = msg || S.endMsg || null; // a hook's end(msg) (CONTRACT-v1.2 R)
      if (P) P.abort();
      var res = finishPlan(S.ended ? 'early' : undefined);
      keepSummary(S, res, msg || null);
      dropClock();
      save();
      try { store.flush(); } catch (e) { /* the debounced save runs later */ }
      S.res = res;
      if (P) { P.destroy(); P = null; }
      setChrome(false);
      ui.clear(wrap);
      if (mode === 'daily') renderDailyEnd(wrap, S, res);
      else renderSummary(wrap, S, res, msg);
      try { win.scrollTo(0, 0); } catch (e) { /* ignore */ }
      var hd = wrap.querySelector('h1');
      if (hd) { hd.setAttribute('tabindex', '-1'); try { hd.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
    S.end = end;

    // Intros: Today's Start button is Train's intro; the other modes say what comes. The clock
    // starts with the first item, after the card.
    var intro = introFor(mode, S.plan, p);
    if (intro) {
      showCard(wrap, P.el.root, Object.assign({ id: 'intro', hide: P.el.root }, intro)).then(function (v) {
        if (S.done) return;
        if (v === 'back') { S.done = true; dropClock(); router.go('home'); return; }
        if (v === 'free-setup') { S.done = true; dropClock(); router.go('play', { mode: 'free', exId: p.exId, setup: '1' }, { force: true }); return; }
        if (mode === 'path' && intro.offersDemo) S.introDemo = v === 'watch'; // the first stage's demo was offered here
        loop();
      });
    } else loop();

    return function cleanup() {
      setChrome(false);
      if (!S.done && S.plan && !S.plan.unavailable) {
        S.done = true;
        if (P) P.abort();
        keepSummary(S, finishPlan('early'), null);
        save();
      }
      dropClock();
      closeCards();
      if (P) { P.destroy(); P = null; }
      if (session.S === S) { session.S = null; session.P = null; }
    };
  }
  var session = { S: null, P: null }; // the running session (tests)

  // A reload or a closed tab ends a running session the way leaving its screen does (the
  // cleanup above): what was answered becomes a saved session (ended: 'closed'), so the weekly
  // goal, the Log and the achievements count it, and its summary is kept: the reopened page shows
  // it instead of starting a session by itself (bootRoute). A page kept in the back/forward cache
  // (persisted) may come back and goes on where it was. A Spatial Check left part-way is never
  // saved (js/ui/check.js).
  win.addEventListener('pagehide', function (e) {
    var S = session.S;
    if ((e && e.persisted) || !S || S.done || !S.plan || S.plan.unavailable) return;
    S.done = true;
    if (session.P) { try { session.P.abort(); } catch (x) { /* ignore */ } }
    var res = S.finishPlan ? S.finishPlan('closed') : null;
    keepSummary(S, res, S.mode === 'daily' ? null : 'The page closed during this session. Everything you answered was saved.');
    if (S.dropClock) S.dropClock();
    save();
    try { store.flush({ evenIfHeld: true }); } catch (x) { /* nothing more can be done while the page goes */ }
  });

  /* ---------- reloads (I1 T4): #/play never starts a session by itself ---------- */

  var RESTORE_MS = 12 * 3600000; // a summary older than this is not brought back
  function viewport() { return Math.round(win.innerWidth || 0) + 'x' + Math.round(win.innerHeight || 0); }
  // The route params worth keeping for "Again" (plain values; never the restore marker).
  function routeParams(p) {
    var out = {};
    for (var k in p) if (hasOwn.call(p, k) && k !== 'restore' && k !== 'setup') { var v = p[k]; if (v === null || typeof v !== 'object' || k === 'params') out[k] = v; }
    return out;
  }
  // The finished session's summary, kept in the record (store.state.ui.lastSummary) so that a
  // reloaded or reopened page shows it again.
  function keepSummary(S, res, msg) {
    try {
      // nothing answered: nothing to bring back (a reload then opens Today)
      if (!res || (!res.session && !(res.daily && res.daily.answered))) { uiRec().lastSummary = null; return; }
      var D = S.plan && S.plan.daily;
      uiRec().lastSummary = JSON.parse(JSON.stringify({
        id: S.plan && S.plan.id || null, at: now(), mode: S.mode, msg: msg || null, params: S.params || {}, start: S.plan && S.plan.start || now(),
        daily: D ? { day: D.day, number: D.number, items: D.items.map(function (it) { return { exId: it.exId }; }), outcomes: D.outcomes.slice(), scored: D.scored } : null,
        res: res || null,
      }));
    } catch (e) { log('keeping the summary failed', e); }
  }
  // The route to open at boot instead of a #/play hash (js/ui/app.js): the kept summary of that
  // session when it is recent, else null (Today). Free play's setup form starts nothing and stays.
  function bootRoute(r) {
    var p = (r && r.params) || {}, m = String(p.mode || 'train');
    if (m === 'free' && !p.run && !p.params && !p.challenge) return r;
    var L = uiRec().lastSummary;
    // a Daily attempt belongs to its day: after midnight its summary is not brought back
    var dayOk = !(isObj(L) && L.mode === 'daily') || (isObj(L.daily) && L.daily.day === E().daily.day(now()));
    if (isObj(L) && dayOk && isNum(L.at) && now() - L.at >= 0 && now() - L.at < RESTORE_MS && L.mode === m && (L.res || L.daily)) {
      return { route: 'play', params: { mode: m, restore: '1' } };
    }
    return null;
  }
  function restoreScreen(host) {
    var L = uiRec().lastSummary;
    var wrap = h('div.pl-screen', { 'data-mode': isObj(L) ? L.mode : 'train', 'data-restored': '' });
    host.appendChild(wrap);
    if (!isObj(L) || !(L.res || L.daily)) {
      wrap.appendChild(screenHead(null, 'Nothing to show here', 'This session’s summary is no longer kept. Your answers are in the Log.'));
      wrap.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' }), ui.button('Open the Log', { kind: 'secondary', go: 'log' })));
      return null;
    }
    var S = { mode: L.mode, plan: { id: L.id, start: L.start, daily: L.daily }, params: L.params || {}, restored: true };
    if (L.mode === 'daily') renderDailyEnd(wrap, S, L.res);
    else renderSummary(wrap, S, L.res, L.msg);
    return null;
  }

  /* ---------- notes under the verdict ---------- */

  // o: { first: no level existed before this block, timed: Speed's own (timed) level }
  function levelNote(def, be, o) {
    o = o || {};
    var a = be.after, b = be.before, name = (def.short || def.name) + (o.timed ? ' Speed' : '');
    var moved = !o.first && b && b.level !== a.level;
    var bar = ui.bar(a.level, 100, { band: [a.lo, a.hi], label: name + ' level', kind: 'signal' });
    bar.setAttribute('aria-valuetext', levelText(a) + ', likely between ' + a.lo + ' and ' + a.hi);
    var set = a.settings ? settingsText(def, a.settings) : '';
    // Level 1 shows its way to level 2 (v1.2, note D2 §3.0 B3): the last five answers and what level 2 asks for.
    var st = a.level <= 1 && o.starter ? o.starter : null, l5 = Array.isArray(o.last5) ? o.last5 : [];
    var right5 = l5.filter(function (x) { return x === 1; }).length;
    return h('div.pl-note.pl-note--level', { 'data-note': 'level' },
      h('p', h('strong', o.first ? name + ': first ' + levelText(a) : moved ? name + ' level ' + b.level + ' → ' + levelText(a) : name + ' ' + levelText(a) + ', unchanged'),
        h('span.px-num.pl-note-range', ' likely ' + a.lo + '–' + a.hi), ' after the last 10 items'),
      h('div.pl-note-bar', bar),
      st ? h('p.px-meta.pl-note-starter', { 'data-starter': String(Math.round(st.toNext * 100)) }, (l5.length ? right5 + ' of your last ' + l5.length + ' right; ' : '') + 'level 2 comes at about ' + st.needOf5 + ' of 5 right over a block.') : null,
      set ? h('p.px-meta', 'Typical at this level: ' + set + '.') : null);
  }

  function pathNote(def, x) {
    var t;
    if (x.passed) t = 'Stage ' + x.passed + ' passed.' + (x.stage ? ' Stage ' + x.stage + ' opens: its items are a little harder.' : ' That was the last stage; practice goes on, and passed stages come back for rechecks.');
    else if (x.recheck) t = x.held ? 'Recheck: stage ' + x.recheck + ' still holds. The next recheck comes later.' : 'Recheck: stage ' + x.recheck + ' needs more practice, so it opens again.';
    return t ? h('p.pl-note', { 'data-note': 'path' }, t) : null;
  }

  function strategyCards(def, learn) {
    var t0 = now();
    var body = (learn.strategies || []).map(function (s) {
      return h('section.pl-strategy', h('h3', s.title), h('p', s.text),
        Array.isArray(s.steps) && s.steps.length ? h('ol', s.steps.map(function (x) { return h('li', x); })) : null,
        s.when ? h('p.px-meta', s.when) : null);
    });
    // the card event (CONTRACT-v1.2 O): every card at once, opened from the offer after two misses
    ui.modal({ title: 'Ways to solve ' + (def.short || def.name), className: 'pl-strategies', body: body, actions: [{ label: 'Close', kind: 'secondary' }],
      onClose: function () { logEvent('card', def.id, { card: 'all', src: 'misses', ms: Math.max(0, now() - t0) }); } });
  }
  function strategyOffer(def, learn) {
    var box = h('div.pl-note.pl-note--offer', { 'data-note': 'strategy' });
    box.appendChild(h('p', 'Two misses in a row on this kind of item. A strategy card may help; it takes half a minute.'));
    var show = ui.button('Show strategy cards', { kind: 'secondary', small: true, onClick: function () { strategyCards(def, learn); } });
    var no = ui.button('Not now', { kind: 'ghost', small: true, onClick: function () { box.hidden = true; } });
    box.appendChild(h('div.pl-note-actions', show, no));
    return box;
  }

  // The strategy question fits exercises solved by picturing or comparing; an exercise's learn.js
  // may word the answers (checkin: { whole, parts, unsure }) or opt out (checkin: false). Track,
  // attention practice, never gets it.
  function checkinFits(def) {
    var learn = PX.ex.learn(def.id);
    return def.practice !== 'attention' && !(learn && learn.checkin === false);
  }
  function checkinNote(def) {
    var box = h('div.pl-note.pl-note--checkin', { 'data-note': 'checkin' });
    var name = def.short || def.name, learn = PX.ex.learn(def.id), w = learn && isObj(learn.checkin) ? learn.checkin : {};
    box.appendChild(h('p', h('strong', 'A quick question. '), 'How did you solve the last few ' + name + ' items?'));
    var row = h('div.pl-note-actions');
    [['whole', w.whole || 'Pictured the whole thing'], ['parts', w.parts || 'Compared it part by part'], ['unsure', w.unsure || 'Not sure, or both']].forEach(function (c) {
      var b = ui.button(c[1], { kind: 'secondary', small: true, onClick: function () {
        try { E().modes.checkin(rec(), def.id, c[0], now()); save(); } catch (e) { log('check-in failed', e); }
        ui.clear(box);
        box.appendChild(h('p.px-meta', 'Noted. Neither way is always better: when one stalls, try the other.'));
      } });
      b.setAttribute('data-checkin', c[0]);
      row.appendChild(b);
    });
    row.appendChild(ui.button('Skip', { kind: 'ghost', small: true, onClick: function () { box.hidden = true; } }));
    box.appendChild(row);
    return box;
  }

  /* ---------- intros ---------- */

  function introFor(mode, plan, p) {
    var def = plan.exs && plan.exs[0] ? PX.ex.get(plan.exs[0]) : null;
    var back = { label: 'Back', value: 'back' }, go = { label: 'Start', value: 'start', primary: true };
    if (mode === 'path' && def) {
      var st = plan.pathStage0 || 1, pre = null, ps = rec().path && rec().path[def.id];
      try { pre = E().path.preset(def, st); } catch (e) { pre = null; }
      // A stage not yet watched offers its demo here, on the one card (I1 B12).
      // (not while Watch, Try, Go is still to come: its offer, with its own demo, takes stage 1's place)
      var watchIt = !(plan.rechecks && plan.rechecks.length) && !(isObj(ps) && isObj(ps.watched) && ps.watched[st]) && !!(viewOf(def.id) && viewOf(def.id).demo) && wtgSeen(def.id);
      var acts = watchIt ? [back, { label: 'Start the stage', value: 'start' }, { label: 'Watch the demo', value: 'watch', primary: true }] : [back, go];
      return { title: 'Path · stage ' + st + ' of 10', def: def, actions: acts, offersDemo: watchIt, lines: [
        pre ? 'This stage goes up to: ' + settingsText(def, pre) + '. Its items mix easier settings too.' : '',
        'Ten stages from easy to hard, practised one at a time. A stage is passed when your recent answers and your level both show it holds; passed stages come back now and then for a short recheck.',
        plan.rechecks && plan.rechecks.length ? 'First, a short recheck of stage ' + plan.rechecks[0].s + '.' : '',
        watchIt ? 'A short demo shows how this stage’s items look. It never counts.' : '',
      ] };
    }
    if (mode === 'speed' && def) {
      return { title: 'Speed', def: def, actions: [back, go], lines: [
        'Every item has a deadline, shown as a bar under it. The deadline shortens after a right answer in time and grows after a miss, so it settles where you are both quick and accurate.',
        'Items come from settings you already answer well without a clock. Speed keeps its own rating; your untimed level does not change.',
      ] };
    }
    if (mode === 'threshold' && plan.protocol) {
      var pr = plan.protocol;
      return { title: 'Threshold', def: pr.def, actions: [back, go], lines: [
        pr.label + '.',
        pr.trials + ' items. One setting moves after each answer: harder after a success, easier after a miss, so it settles at your threshold. Everything else stays fixed.',
        'Threshold runs are measurements: they never change your levels.',
      ] };
    }
    if (mode === 'free' && p.challenge) {
      return { title: 'Challenge', def: def, actions: [back, go], lines: [
        'The same ' + plan.total + ' items as the person who shared code ' + p.challenge + '.',
        'Free play: everything is logged, and your levels do not change.',
      ] };
    }
    if (mode === 'daily' && plan.daily) {
      var D = plan.daily, prev = rec().daily && rec().daily[D.day];
      return { title: 'Daily Challenge #' + D.number, actions: [back, D.resumed ? { label: 'Go on', value: 'start', primary: true } : go], lines: [
        D.items.length + ' items, the same for everyone on this date, at a medium difficulty.',
        D.resumed ? 'Your scored attempt goes on where it stopped: ' + D.n + ' of ' + D.items.length + ' answered so far. Items do not change your levels.' :
          D.scored ? 'One scored attempt a day: this one. It counts once all ' + D.items.length + ' items are answered; if you stop, it goes on later today. Items do not change your levels.' :
          'Today’s scored attempt is done' + (prev ? ' (' + prev.right + '/' + prev.n + ')' : '') + '. This round is practice.',
        'Compare notes in the Chimera Discord afterwards.',
      ] };
    }
    return null;
  }

  function screenHead(meta, title, lead) {
    return h('div.px-screen-head', meta ? h('p.px-screen-meta', meta) : null, h('h1', title), lead ? h('p.px-lead', lead) : null);
  }

  function renderUnavailable(wrap, mode, why) {
    wrap.appendChild(screenHead(MODE_NAMES[mode] || 'Session', 'Not available right now', why));
    wrap.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' }), ui.button('Open the Library', { kind: 'secondary', go: 'library' })));
  }

  function openShare(opts) {
    if (PX.ui.share && typeof PX.ui.share.open === 'function') {
      try { return PX.ui.share.open(opts); } catch (e) { log('share failed', e); }
    }
    var text = opts.text || [opts.title].concat(opts.lines || [], [opts.footer || '', chimeraLine()]).filter(Boolean).join('\n');
    return ui.modal({ title: 'Share', body: [h('p', 'Copy the text and paste it wherever you like.'), PX.ui.kit.copyField(text, { rows: 5, ariaLabel: 'Text to share' })], actions: [{ label: 'Done', kind: 'secondary' }] });
  }

  function weekDots(st) {
    var names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], letters = 'MTWTFSS';
    var days = st && st.week && Array.isArray(st.week.days) ? st.week.days : [];
    return h('ol.pl-week', { 'aria-label': 'Days practised this week' }, names.map(function (n, i) {
      return h('li', { class: days[i] ? 'is-done' : null }, h('span.pl-week-k', { 'aria-hidden': 'true' }, letters[i]),
        h('span.pl-week-box', { 'aria-hidden': 'true' }, days[i] ? '✓' : ''), h('span.px-sr', n + (days[i] ? ': practised' : ': not practised')));
    }));
  }

  function nextSuggestion(res) {
    var av = null;
    try { av = E().modes.available(rec(), now(), { can: canCheap, display: display() }); } catch (e) { av = null; }
    var st = res && res.streak;
    if (av && av.check && av.check.due) return { text: av.check.why, label: av.check.kind && /^B/.test(av.check.kind) ? 'Measure your starting point' : 'Take the Spatial Check', go: 'play?mode=check' };
    if (st && st.week && st.week.left > 0) return { text: st.week.left + (st.week.left === 1 ? ' more session' : ' more sessions') + ' this week meets your goal of ' + st.week.goal + '. Any days work, and spreading them out helps.' };
    if (av && av.daily && av.daily.partial) return { text: 'Today’s Daily Challenge is waiting where you stopped: ' + av.daily.partial.answered + ' of ' + av.daily.partial.n + ' answered.', label: 'Go on with the Daily Challenge', go: 'play?mode=daily' };
    if (av && av.daily && !av.daily.done) return { text: 'Today’s Daily Challenge is open: ' + E().config.daily.items + ' items, the same for everyone.', label: 'Play the Daily Challenge', go: 'play?mode=daily' };
    return { text: 'Weekly goal met. Extra sessions still count in your log, and a rest day is fine too.' };
  }

  /* ---------- the session summary (results against the person's own past) ---------- */

  function resultRow(r, timed, rounds, sweeps) { // timed: Speed's own level, labelled so; rounds: [n, total] (Quick); sweeps: [[bar, before, after]]
    var def = PX.ex.get(r.exId) || { code: '', short: r.exId, abilities: [] }, lv = r.level;
    // O7: the median is of the right answers' times, and says so
    var stats = r.n + (r.n === 1 ? ' item' : ' items') + ' · ' + r.right + ' right' + (isNum(r.rtMed) ? ' · median time of right answers ' + fmtRt(r.rtMed) : '');
    if (Array.isArray(rounds) && rounds[0] > 0) stats += ' · round score ' + rounds[1] + ' over ' + plural(rounds[0], 'round') + ' (mean ' + Math.round(rounds[1] / rounds[0]) + ')';
    var kids = [h('div.pl-res-head', specOf(def), tagOf(def) ? h('span.px-tag', tagOf(def)) : null), h('p.pl-res-stats.px-num', stats)];
    if (lv && isNum(lv.after)) {
      // A first level (no rated answers before this session) has nothing to compare with.
      // (Speed's level is its own timed rating, kept in rec.timed.)
      var host = timed === true ? rec().timed : rec().ex, st = host && host[r.exId], first = !isObj(st) || !isNum(st.n) || st.n + (isObj(st.small) && isNum(st.small.n) ? st.small.n : 0) <= r.n;
      if (first) lv = { before: null, after: lv.after, lo: lv.lo, hi: lv.hi, settings: lv.settings };
      var moved = lv.before !== null && lv.before !== undefined && lv.before !== lv.after;
      var bar = ui.bar(lv.after, 100, { band: [lv.lo, lv.hi], label: (def.short || def.name) + ' level', kind: 'signal' });
      bar.setAttribute('aria-valuetext', levelText(lv.after) + ', likely between ' + lv.lo + ' and ' + lv.hi);
      if (moved && Array.isArray(sweeps)) sweeps.push([bar, lv.before, lv.after]);
      kids.push(h('div.pl-res-level',
        h('p.pl-res-lv', h('span.pl-res-lvk', timed === true ? 'Speed level' : 'Level'), h('b.px-num', moved ? lv.before + ' → ' + lv.after : String(lv.after)),
          lv.after <= 1 ? h('span.pl-res-starter', ' · starter items') : null, h('span.px-num.pl-res-range', 'likely ' + lv.lo + '–' + lv.hi)),
        h('div.pl-res-bar', bar),
        h('p.px-meta', lv.before === null || lv.before === undefined ? 'A first level: it narrows as you practise.' :
          r.clear ? 'A clear change: larger than the usual ±' + r.noise + ' between sessions.' : 'Within the usual session-to-session noise (±' + r.noise + ').'),
        lv.settings ? h('p.px-meta', 'Typical at this level: ' + settingsText(def, lv.settings) + '.') : null));
    }
    return h('li.pl-res', { 'data-ex': r.exId }, kids);
  }

  // The session's practice time, from the one clock (the same number the Log and share card show).
  function practiceOf(res) {
    if (res && res.session && isNum(res.session.practiceMs)) return res.session.practiceMs;
    var sm = res && res.summary;
    return sm && isNum(sm.ms) ? sm.ms : sm && isNum(sm.minutes) ? sm.minutes * 60000 : null;
  }
  function renderSummary(wrap, S, res, msg) {
    var K = PX.ui.kit, mode = S.mode, sm = res && res.summary, pl = S.plan, ms = practiceOf(res);
    var when = K.fmtWhen(pl.start || now());
    var meta = MODE_NAMES[mode] + ' · ' + when + (sm && isNum(ms) ? ' · ' + PX.core.clock.fmtMinutes(ms) : '');
    wrap.appendChild(screenHead(meta, sm ? 'Session summary' : 'Session ended', msg || null));
    // Playtest mode's taps after each exercise go here (CONTRACT-v1.2 G); empty otherwise.
    var slot = h('div.pl-playtest-slot');
    wrap.appendChild(slot);
    var out = h('div.pl-summary');
    wrap.appendChild(out);
    if (!sm) {
      out.appendChild(h('p.px-lead', 'No answers were recorded, so nothing changed.'));
    } else {
      var p1 = K.panel({ title: 'Results', className: 'pl-panel', aside: sm.trials + ' answered' });
      var pastTxt = sm.past && sm.past.sessions && isNum(sm.past.accMedian) ? ' Your last ' + (sm.past.sessions === 1 ? MODE_NAMES[mode] + ' session: ' : sm.past.sessions + ' ' + MODE_NAMES[mode] + ' sessions: a median of ') + Math.round(sm.past.accMedian * 100) + ' % right.' : '';
      p1.body.appendChild(h('p.pl-sum-line', 'This session: ' + sm.right + ' of ' + sm.trials + ' right' + (isNum(sm.acc) ? ' (' + Math.round(sm.acc * 100) + ' %)' : '') +
        (isNum(ms) ? ', ' + PX.core.clock.fmtMinutes(ms) + ' of practice' : '') + '.' + pastTxt));
      if (sm.lines && sm.lines[0] && E().modes.RATED[mode]) p1.body.appendChild(h('p.px-meta.pl-sum-noise', sm.lines[0]));
      if (mode === 'free') p1.body.appendChild(h('p.px-meta', 'Free play is logged; it does not change your levels.'));
      var rounds = res && res.session && isObj(res.session.rounds) ? res.session.rounds : S.rounds || {};
      var sweeps = [];
      p1.body.appendChild(h('ul.pl-results', sm.per.map(function (r) { return resultRow(r, mode === 'speed', rounds[r.exId], sweeps); })));
      out.appendChild(p1.el);
      sweeps.forEach(function (x) { sweep(x[0], x[1], x[2]); }); // the bars are in the page now (milestone 5's needle)
    }
    var extra = modeExtras(mode, res);
    if (extra) out.appendChild(extra);
    // v1.2 wave 2 (CONTRACT-v1.2 R): panels other modules add (the plateau card, the measurement
    // meter): order below 50 before Personal bests, 50 or more after Achievements.
    // A summary brought back after a reload asks again, with restored: true.
    var hooked = hasOwn.call(HOOK_MODES, mode) && !(S.params && typeof S.params.challenge === 'string' && S.params.challenge);
    var hp = (hooked ? hookCollect('summary:panels', { mode: mode, res: res, plan: pl, rec: rec(), now: now(), restored: !!S.restored }) : []).map(function (x, i) {
      return isObj(x) && x.el && x.el.nodeType === 1 ? { el: x.el, order: isNum(x.order) ? x.order : 50, invite: typeof x.invite === 'string' && x.invite ? x.invite : null, inviteOpts: isObj(x.inviteOpts) ? x.inviteOpts : {}, i: i } : null;
    }).filter(Boolean).sort(function (a, b) { return a.order - b.order || a.i - b.i; });
    // One Chimera invite at the session's highest point (CONTRACT-v1.2 H, R): the summary's own (a
    // personal best, a passed Path stage, an achievement) or a panel's, whichever ranks highest
    // (best > path > grade > plateau > achievement > check); placed under its panel, never between items.
    var inv = res && res.bests && res.bests.length ? 'best' : res && res.path && res.path.passed && res.path.passed.length && extra ? 'path' : res && res.achievements && res.achievements.length ? 'achievement' : null;
    var invPanel = null;
    hp.forEach(function (x) { if (x.invite && (inv === null || INVITE_RANK(x.invite) < INVITE_RANK(inv))) { inv = x.invite; invPanel = x; } });
    function hookPanel(x) {
      out.appendChild(x.el);
      if (x === invPanel) { var ix = invite(x.invite, Object.assign({}, x.inviteOpts, { host: out })); if (ix) out.appendChild(ix); }
    }
    if (inv === 'path' && !invPanel) { var ip = invite('path', { host: out, exId: res.path.exId, stage: res.path.passed[res.path.passed.length - 1] }); if (ip) out.appendChild(ip); }
    hp.filter(function (x) { return x.order < 50; }).forEach(hookPanel);
    if (res && res.bests && res.bests.length) {
      var pb = K.panel({ title: 'Personal bests', className: 'pl-panel' });
      pb.body.appendChild(h('ul.pl-list', res.bests.map(function (b) {
        var def = PX.ex.get(b.exId) || { short: b.exId };
        // The engine's best is the level shown after a strong whole block (the same scale as the notes).
        return h('li', h('b', def.short || def.name), ': your highest level after a whole block of 10, ' + b.level + (b.previous ? ' (best before: ' + b.previous + ')' : ' (your first full block)') + '.');
      })));
      out.appendChild(pb.el);
      if (inv === 'best' && !invPanel) { var ib = invite('best', { host: out, exId: res.bests[0].exId, level: res.bests[0].level }); if (ib) out.appendChild(ib); }
    }
    if (res && res.achievements && res.achievements.length) {
      var pa = K.panel({ title: 'Achievements', className: 'pl-panel' });
      pa.body.appendChild(h('ul.pl-ach', res.achievements.map(function (a) {
        return h('li', K.icon('award', 'pl-ach-mark'), h('div', h('b', a.name), h('span', a.desc)));
      })));
      out.appendChild(pa.el);
      if (inv === 'achievement' && !invPanel) { var ia = invite('achievement', { host: out, id: res.achievements[0].id }); if (ia) out.appendChild(ia); }
    }
    hp.filter(function (x) { return x.order >= 50; }).forEach(hookPanel);
    if (res && res.streak) {
      var pw = K.panel({ title: 'This week', className: 'pl-panel', aside: 'goal ' + res.streak.goal + ' a week' });
      pw.body.appendChild(h('p', res.streak.text + (res.streak.week && isNum(res.streak.week.ms) ? ' Practice this week: ' + PX.core.clock.fmtMinutes(res.streak.week.ms) + '.' : '')));
      // a session too short to count says so, with the rule's own numbers (fresh-player tests)
      var EN = E(), sc = res.session, CS = EN && EN.config && EN.config.streak;
      if (sc && CS && EN.streak && typeof EN.streak.counts === 'function' && sc.mode !== 'check' && !EN.streak.counts(sc)) {
        pw.body.appendChild(h('p.px-meta.pl-week-short', 'This session does not count toward the week yet: a session counts from ' + CS.minTrials + ' answers or ' + Math.round(CS.minMs / 60000) + ' minutes of practice (this one: ' + (sc.trials || 0) + ' answers, ' + PX.core.clock.fmtMinutes(sc.practiceMs || 0) + ').'));
      }
      pw.body.appendChild(weekDots(res.streak));
      if (res.streak.current > 1) pw.body.appendChild(h('p.px-meta', res.streak.current + ' weeks in a row at your goal. One missed week in four is forgiven automatically.'));
      out.appendChild(pw.el);
    }
    var nx = nextSuggestion(res);
    var pn = K.panel({ title: 'Next', className: 'pl-panel pl-next' });
    pn.body.appendChild(h('p', nx.text));
    var acts = h('div.pl-summary-actions');
    if (nx.go) acts.appendChild(ui.button(nx.label, { kind: 'primary', go: nx.go }));
    if (sm) {
      var sh = ui.button('Share', { kind: 'secondary', onClick: function () { shareSession(S, res); } });
      sh.setAttribute('data-share', '');
      acts.appendChild(sh);
    }
    var again = ui.button(mode === 'train' ? 'Another session' : 'Again', { kind: nx.go ? 'secondary' : 'primary', onClick: function () {
      var prm = {}, src = S.params || router.current().params || {};
      for (var k in src) if (hasOwn.call(src, k) && k !== 'restore') prm[k] = src[k];
      prm.mode = mode;
      router.go('play', prm, { force: true });
    } });
    again.setAttribute('data-again', '');
    acts.appendChild(again);
    acts.appendChild(ui.button('Back to Today', { kind: 'ghost', go: 'home' }));
    pn.body.appendChild(acts);
    out.appendChild(pn.el);
    out.appendChild(h('p.px-meta.pl-sum-foot', K.backupLine(), '. ', K.storageText()));
    emit('play:screen', { screen: 'summary', mode: mode, exId: null });
    emit('play:summary', { mode: mode, exIds: sm ? sm.per.map(function (r) { return r.exId; }) : [], res: res, slot: slot, wrap: wrap });
  }

  function modeExtras(mode, res) {
    var K = PX.ui.kit, p, rows = [];
    if (!res) return null;
    if (mode === 'path' && res.path) {
      var def = PX.ex.get(res.path.exId);
      p = K.panel({ title: 'Path', className: 'pl-panel', aside: 'stage ' + res.path.stage + ' of 10' });
      if (res.path.passed && res.path.passed.length) rows.push('Passed this session: stage ' + res.path.passed.join(', ') + '.');
      if (res.path.preset && def) rows.push('Stage ' + res.path.stage + ' goes up to: ' + settingsText(def, res.path.preset) + '.');
      (res.path.rechecks || []).forEach(function (r) { rows.push('Recheck of stage ' + r.s + ': ' + (r.held === false ? 'it opens again for practice.' : 'it still holds.')); });
      rows.push('A stage counts as passed only while it holds: passed stages come back for short rechecks after 3, 7, 14, 30 and 60 days.');
    } else if (mode === 'speed' && res.speed) {
      var s = res.speed;
      p = K.panel({ title: 'Speed', className: 'pl-panel', aside: 'deadline now ' + fmtRt(s.deadlineMs) });
      if (isNum(s.rcs)) rows.push('Right answers in time: ' + U.round(s.rcs, 1) + ' a minute (' + Math.round(s.pc * 100) + ' % of ' + s.n + ').');
      if (isNum(s.bis)) rows.push('Balanced score against your first timed sessions: ' + (s.bis > 0 ? '+' : '') + U.round(s.bis, 2) + ' (speed and accuracy together; 0 is where you started).');
    } else if (mode === 'threshold' && res.threshold && res.threshold.stopped) {
      var ts = res.threshold;
      p = K.panel({ title: 'Threshold', className: 'pl-panel', aside: ts.n + ' of ' + plural(ts.trials, 'item') });
      rows.push('The run stopped after ' + ts.n + ' of its ' + ts.trials + ' items, so no threshold was saved: a threshold needs the whole run. Your answers are in the Log.');
    } else if (mode === 'threshold' && res.threshold) {
      var t = res.threshold;
      p = K.panel({ title: 'Threshold', className: 'pl-panel', aside: plural(t.n, 'item') + ' · ' + plural(t.reversals, 'reversal') });
      rows.push('Threshold: ' + thresholdText(t) + '.');
      rows.push(t.ok ? 'The staircase settled, so this estimate is usable. Runs on other days show how much it moves.' : 'The staircase did not settle yet, so treat this as a rough estimate; another run makes it steadier.');
    }
    if (!p) return null;
    rows.forEach(function (r) { p.body.appendChild(h('p', r)); });
    return p.el;
  }

  // A threshold in its own unit (I1 B8): a deadline in seconds, Track's speed in cw/s (widths of
  // the box per second, rule 9), a span length in items.
  function thresholdText(t) {
    var v = t.threshold;
    if (!isNum(v)) return '–';
    if (t.unit === 'ms') return fmtRt(v);
    if (t.unit === 'speed') return U.round(v, 2) + ' cw/s (widths of the box per second)';
    if (t.unit === 'items') return U.round(v, 1) + ' items';
    return U.round(v, 2) + ' ' + t.unit;
  }

  function shareSession(S, res) {
    var sm = res.summary, ms = practiceOf(res), lines = [plural(sm.trials, 'item') + (isNum(ms) ? ' in ' + PX.core.clock.fmtMinutes(ms) : '')];
    sm.per.forEach(function (r) {
      var def = PX.ex.get(r.exId), name = def ? def.short || def.name : r.exId, lv = r.level;
      if (!lv || !isNum(lv.after)) { lines.push(name + ': ' + plural(r.n, 'item')); return; }
      // As on the summary: the likely range and the noise word; a first level has nothing to compare with.
      var host = S.mode === 'speed' ? rec().timed : rec().ex, st = host && host[r.exId], first = !isObj(st) || !isNum(st.n) || st.n + (isObj(st.small) && isNum(st.small.n) ? st.small.n : 0) <= r.n;
      var range = ' (likely ' + lv.lo + '–' + lv.hi + ')';
      if (first || lv.before === null || lv.before === undefined) lines.push(name + ': first level ' + lv.after + range);
      else lines.push(name + ': level ' + (lv.before !== lv.after ? lv.before + ' → ' : '') + lv.after + range + ', ' + (r.clear ? 'a clear change' : 'within usual noise'));
    });
    // The card carries the Parallax name in its header, so its title does not repeat it; the
    // copied text names it once.
    var title = MODE_NAMES[S.mode] + ' session', foot = U.fmtDate(now(), 'long');
    openShare({ kind: 'session', title: title, lines: lines.slice(0, 5), footer: foot,
      text: ['Parallax · ' + title].concat(lines.slice(0, 5), [foot, chimeraLine()]).join('\n') });
  }

  /* ---------- the Daily Challenge result ---------- */

  function renderDailyEnd(wrap, S, res) {
    var K = PX.ui.kit, d = res && res.daily, D = S.plan.daily;
    wrap.appendChild(screenHead('Daily Challenge · ' + (D ? D.day : ''), d ? 'Daily #' + d.number : 'Daily Challenge', null));
    var out = h('div.pl-summary.pl-daily');
    wrap.appendChild(out);
    emit('play:screen', { screen: 'daily-end', mode: 'daily', exId: null });
    if (!d) {
      out.appendChild(h('p.px-lead', 'No answers were recorded, so today’s attempt is still open.'));
      out.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' })));
      return;
    }
    // 1 right, 0 wrong, null not answered (never drawn as wrong: I1 T6)
    var outs = Array.isArray(d.outcomes) ? d.outcomes : D.items.map(function (it, i) { return D.outcomes[i] === 1 || D.outcomes[i] === 0 ? D.outcomes[i] : null; });
    var marks = outs.map(function (o) { return o === 1 ? 1 : o === 0 ? 0 : null; });
    var today = false;
    try { today = d.day === E().daily.day(now()); } catch (e) { today = false; }
    // Daily v2 (milestone 5, W3-game): a ramp of points (item k is worth k, 36 in all); a past Daily from the archive
    var ramp = !!d.ramp && isNum(d.points), worth = Array.isArray(d.worth) ? d.worth : [];
    var p = K.panel({ title: d.partial && d.scored ? (today ? 'Today’s attempt so far' : 'An attempt left open') : d.archive && d.scored ? 'From the archive' : d.scored ? 'Today’s score' : 'Practice round', className: 'pl-panel', aside: d.day });
    p.body.appendChild(h('p.pl-daily-score', h('b.px-num', d.right + '/' + d.n), h('span', ' right'),
      ramp ? h('span.pl-daily-points', ' · ', h('b.px-num', d.points + ' of ' + (isNum(d.max) ? d.max : 36)), ' points') : null,
      d.partial ? h('span.px-meta', ' · ' + (isNum(d.answered) ? d.answered : outs.filter(function (o) { return o !== null; }).length) + ' of ' + d.n + ' answered') : null));
    p.body.appendChild(h('ol.pl-marks', { 'aria-label': 'Items: right, wrong or not answered' }, D.items.map(function (it, i) {
      var def = PX.ex.get(it.exId), o = marks[i], cls = o === 1 ? 'is-right' : o === 0 ? 'is-wrong' : 'is-open';
      var w = ramp && isNum(worth[i]) && worth[i] > 0 ? worth[i] : null;
      return h('li', { class: cls }, h('span.pl-mark-g', { 'aria-hidden': 'true' }, o === 1 ? '✓' : o === 0 ? '✗' : '–'),
        h('span.pl-mark-n.px-num', String(i + 1)), h('span.pl-mark-x', def ? def.short || def.name : it.exId),
        w ? h('span.pl-mark-w.px-num', { 'data-worth': String(w) }, ' · ' + w + (w === 1 ? ' point' : ' points')) : null,
        h('span.px-sr', o === 1 ? ': right' : o === 0 ? ': wrong' : ': not answered'));
    })));
    if (d.partial && d.scored && !today) { // its day is over: it can no longer be finished
      p.body.appendChild(h('p', 'This attempt was left open on ' + d.day + ', so it has no score. A new challenge opens every day.'));
      p.body.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' })));
      out.appendChild(p.el);
      return;
    }
    if (d.partial && d.scored) {
      var go = ui.button('Go on now', { kind: 'primary', onClick: function () { router.go('play', { mode: 'daily' }, { force: true }); } });
      go.setAttribute('data-daily-resume', '');
      p.body.appendChild(h('p', 'The scored attempt counts once all ' + d.n + ' items are answered. It goes on where it stopped whenever you open it today.'));
      p.body.appendChild(h('div.pl-summary-actions', go, ui.button('Back to Today', { kind: 'ghost', go: 'home' })));
      out.appendChild(p.el);
      return;
    }
    if (!d.scored) {
      var prev = rec().daily && rec().daily[d.day];
      p.body.appendChild(h('p.px-meta', 'A practice round: today’s scored result stays ' + (prev ? prev.right + '/' + prev.n : 'as it was') + '.'));
    }
    out.appendChild(p.el);
    var prevR = rec().daily && rec().daily[d.day], ED = E().daily;
    var line = d.scored ? d.share : (prevR ? (typeof ED.shareOf === 'function' ? ED.shareOf(d.day, prevR) : ED.share(d.number, prevR.right, prevR.n)) : d.share);
    var ps = K.panel({ title: 'Share', className: 'pl-panel' });
    ps.body.appendChild(h('p', 'Your share line. Paste it in the Chimera Discord to compare notes.'));
    ps.body.appendChild(K.copyField(line, { rows: 1, ariaLabel: 'Daily share line', label: 'Copy' }));
    var card = ui.button('Share card', { kind: 'secondary', onClick: function () {
      openShare({ kind: 'daily', title: 'Daily Challenge #' + d.number, label: 'Daily #' + d.number, lines: [d.right + ' of ' + d.n + ' right'].concat(ramp ? [d.points + ' of ' + (isNum(d.max) ? d.max : 36) + ' points'] : []), footer: d.day, marks: marks.map(function (m) { return m === 1 ? 1 : 0; }), text: line });
    } });
    card.setAttribute('data-share', '');
    ps.body.appendChild(h('div.pl-summary-actions', card));
    if (PX.ui.chimera && PX.ui.chimera.linkCopy) ps.body.appendChild(PX.ui.chimera.linkCopy({ label: 'Chimera Discord address' }));
    out.appendChild(ps.el);
    if (PX.ui.share && PX.ui.share.challenge && typeof PX.ui.share.challenge.box === 'function') {
      try {
        var pc = K.panel({ className: 'pl-panel' }); // the box carries its own heading and text
        pc.body.appendChild(PX.ui.share.challenge.box());
        out.appendChild(pc.el);
      } catch (e) { log('challenge box failed', e); }
    }
    var again = ui.button('Play again for practice', { kind: 'ghost', onClick: function () { router.go('play', { mode: 'daily' }, { force: true }); } });
    again.setAttribute('data-again', '');
    var acts = h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' }), again);
    out.appendChild(acts);
  }

  /* =====================================================================================
     Free play setup (exercise, settings, timer, length), Watch, Try, Go on its own, How to play
     ===================================================================================== */

  function freeSetup(host, route) {
    var K = PX.ui.kit, p = route.params || {};
    var defs = PX.ex.list('train').filter(function (d) { return canRun(d, true); });
    host.appendChild(screenHead(null, 'Free play', 'Choose an exercise and how it runs. Everything is logged; your levels do not change.'));
    if (!defs.length) { host.appendChild(h('p', 'No exercise can be shown on this device.')); return null; }
    var st = { exId: defs.some(function (d) { return d.id === p.exId; }) ? String(p.exId) : defs[0].id, fixed: false, params: null, timer: 0, items: 20 };
    var form = h('div.pl-free');
    host.appendChild(form);
    // Human labels from the Library's wording (PX.ui.exinfo: '10 cubes', 'board turned 90°',
    // 'same or mirror'); without it, numbers show at most 3 significant digits.
    var X = PX.ui.exinfo || {};
    function label(def, d, v) {
      if (typeof X.dimText === 'function') { try { return X.dimText(def, d, v); } catch (e) { /* plain text below */ } }
      return typeof v === 'number' ? Number(v.toPrecision(3)) + (d.unit || '') : String(v);
    }
    function variantLabel(def, v) {
      if (typeof X.variantName === 'function') { try { return X.variantName(def, v) || v; } catch (e) { /* the name */ } }
      return v;
    }
    function draw() {
      ui.clear(form);
      var def = PX.ex.get(st.exId);
      if (!st.params || st.params.__ex !== st.exId) { st.params = fillParams(def, {}); st.params.__ex = st.exId; }
      var pnl = K.panel({ title: 'Exercise', className: 'pl-panel' });
      var sel = h('select.px-select', { 'aria-label': 'Exercise', 'data-free': 'exercise' }, defs.map(function (d) {
        return h('option', { value: d.id, selected: d.id === st.exId }, d.code + ' · ' + (d.short || d.name) + (tagOf(d) ? ' (' + tagOf(d) + ')' : ''));
      }));
      sel.addEventListener('change', function () { st.exId = sel.value; draw(); });
      pnl.body.appendChild(h('label.px-field', h('span.px-sr', 'Exercise'), sel));
      var learn = PX.ex.learn(st.exId);
      if (learn && learn.goal) pnl.body.appendChild(h('p.px-meta', learn.goal));
      form.appendChild(pnl.el);
      var ps = K.panel({ title: 'Settings', className: 'pl-panel' });
      ps.body.appendChild(K.segmented({ key: 'free-mode', legend: 'Items', value: st.fixed ? 'fixed' : 'adaptive',
        options: [{ value: 'adaptive', label: 'Adaptive' }, { value: 'fixed', label: 'Fixed settings' }],
        hint: st.fixed ? 'Every item uses the settings below.' : 'Items follow your level, as in Train.',
        onChange: function (v) { st.fixed = v === 'fixed'; draw(); } }));
      if (st.fixed) {
        var grid = h('div.pl-free-dims');
        if (def.variants) {
          var vs = h('select.px-select', { 'aria-label': 'Variant', 'data-free': 'variant' }, def.variants.map(function (v) { return h('option', { value: v, selected: v === st.params.variant }, variantLabel(def, v)); }));
          vs.addEventListener('change', function () { st.params.variant = vs.value; });
          grid.appendChild(h('label.px-field', h('span.px-field-label', 'Variant'), vs));
        }
        def.dims.forEach(function (d) {
          var s = h('select.px-select', { 'aria-label': d.label, 'data-free': d.key }, d.levels.map(function (v, i) { return h('option', { value: String(i), selected: i === st.params[d.key] }, label(def, d, v)); }));
          s.addEventListener('change', function () { st.params[d.key] = Number(s.value) || 0; });
          grid.appendChild(h('label.px-field', h('span.px-field-label', d.label), s));
        });
        ps.body.appendChild(grid);
      }
      ps.body.appendChild(K.segmented({ key: 'free-timer', legend: 'Timer', value: String(st.timer), num: true,
        options: [0, 5, 10, 20, 30].map(function (s) { return { value: String(s), label: s ? s + ' s' : 'Off', aria: s ? s + ' seconds per item' : 'No timer' }; }),
        hint: 'With a timer, an item ends when its time is up.', onChange: function (v) { st.timer = Number(v) || 0; } }));
      ps.body.appendChild(K.segmented({ key: 'free-items', legend: 'Length', value: String(st.items), num: true,
        options: [10, 20, 30].map(function (n) { return { value: String(n), label: n + ' items' }; }), onChange: function (v) { st.items = Number(v) || 20; } }));
      form.appendChild(ps.el);
      var start = ui.button('Start free play', { kind: 'primary', onClick: function () {
        var prm = { mode: 'free', exId: st.exId, run: '1', trials: st.items };
        if (st.fixed) { var cp = {}; for (var k in st.params) if (hasOwn.call(st.params, k) && k !== '__ex') cp[k] = st.params[k]; prm.params = cp; }
        if (st.timer) prm.deadlineMs = st.timer * 1000;
        router.go('play', prm, { force: true });
      } });
      start.setAttribute('data-free-start', '');
      form.appendChild(h('div.pl-summary-actions', start, ui.button('How to play', { kind: 'ghost', onClick: function () { howTo(st.exId); } })));
    }
    draw();
    return null;
  }

  function watchScreen(host, route) {
    var exId = String((route.params || {}).exId || ''), def = PX.ex.get(exId);
    var wrap = h('div.pl-screen', { 'data-mode': 'watch' });
    host.appendChild(wrap);
    if (!def || !canRun(def)) { renderUnavailable(wrap, 'watch', 'This exercise cannot be shown on this device yet.'); return null; }
    setChrome(true);
    var P = createPlayer({ endLabel: 'End' }), alive = true;
    wrap.appendChild(h('h1.px-sr', 'Watch, Try, Go: ' + (def.short || def.name)));
    wrap.appendChild(P.el.root);
    var slot = h('div.pl-playtest-slot'); // playtest taps for the tutorial (CONTRACT-v1.2 G)
    wtg(P, exId, { host: wrap, slot: slot }).then(function (r) {
      if (!alive) return;
      P.destroy();
      setChrome(false);
      ui.clear(wrap);
      var name = def.short || def.name, done = r !== 'skipped' && r !== 'end';
      // The third step is a step of its own (Angles fresh test: "Go" seemed to skip it): the
      // stepper stays, with 3 Go current, and the screen opens at its top.
      if (done) {
        wrap.appendChild(h('ol.pl-wtg-steps.pl-go-steps', { 'aria-label': 'Watch, Try, Go: step 3 of 3' }, ['Watch', 'Try', 'Go'].map(function (n, i) {
          return h('li.pl-wtg-step' + (i < 2 ? '.is-done' : '.is-current'), i === 2 ? { 'aria-current': 'step' } : null, h('span.pl-wtg-n.px-num', String(i + 1)), h('span.pl-wtg-name', n));
        })));
      }
      wrap.appendChild(done
        ? screenHead('Watch, Try, Go · step 3', 'Go: ' + name + ' for real', 'That was the tutorial; nothing was logged. In Go the items count: a session starts with easier ' + name + ' items, then follows your level.')
        : screenHead('Watch, Try, Go', name + ': ready', 'Skipped. How to play stays in the Library.'));
      emit('play:screen', { screen: 'watch-end', mode: 'watch', exId: exId });
      var start = ui.button(done ? 'Go: start a session with ' + name : 'Start a session with ' + name, { kind: 'primary', onClick: function () { router.go('play', { mode: 'train', exId: exId }, { force: true }); } });
      start.setAttribute('data-card', 'session');
      wrap.appendChild(h('div.pl-summary-actions', start,
        ui.button('Free play', { kind: 'secondary', onClick: function () { router.go('play', { mode: 'free', exId: exId }, { force: true }); } }),
        ui.button('Back to the Library', { kind: 'ghost', go: 'library' })));
      wrap.appendChild(slot);
      var iv = invite('tutorial', { host: wrap, exId: exId }); // the tutorial's end (gap C6)
      if (iv) wrap.appendChild(iv);
      try { win.scrollTo(0, 0); } catch (e) { /* ignore */ }
      var hd = wrap.querySelector('h1');
      if (hd) { hd.setAttribute('tabindex', '-1'); try { hd.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    });
    return function () { alive = false; setChrome(false); P.destroy(); };
  }

  function watch(exId) { return router.go('play', { mode: 'watch', exId: String(exId) }, { force: true }); }

  function howTo(exId) {
    var def = PX.ex.get(exId), learn = PX.ex.learn(exId);
    if (!def) return null;
    var body = [h('div.pl-card-spec', specOf(def), tagOf(def) ? h('span.px-tag', tagOf(def)) : null)];
    if (learn && learn.goal) body.push(h('p.pl-howto-goal', learn.goal));
    if (labelLine(def)) body.push(h('p.px-meta', labelLine(def)));
    if (learn && Array.isArray(learn.parts) && learn.parts.length) {
      body.push(h('ul.pl-parts', learn.parts.map(function (pt) { return h('li', h('b', pt.label), h('span', pt.text)); })));
    }
    // "Also in tests": the formats this exercise shares with published tests (B7, js/ui/overlap.js).
    var ov = null;
    try { ov = PX.ui.overlap && PX.ui.overlap.noteFor ? PX.ui.overlap.noteFor(exId) : null; } catch (e) { ov = null; }
    if (ov) {
      var node = null;
      try { node = PX.ui.overlap.noteNode ? PX.ui.overlap.noteNode(exId, 'pl-howto-note') : null; } catch (e) { node = null; }
      body.push(node || h('p.px-meta.px-overlap-note', h('b', (ov.label || 'Also in tests') + ': '), ov.text || String(ov)));
    }
    // v1.2 wave 2 (CONTRACT-v1.2 R): lines other modules add (the bet, the settings handled per
    // dimension, the last plateau change), by their order
    hookCollect('exercise:lines', { def: def, rec: rec(), now: now(), where: 'howto' }).map(function (x, i) {
      var el0 = x && x.nodeType === 1 ? x : isObj(x) && x.el && x.el.nodeType === 1 ? x.el : null;
      return el0 ? { el: el0, order: isObj(x) && isNum(x.order) ? x.order : 50, i: i } : null;
    }).filter(Boolean).sort(function (a, b) { return a.order - b.order || a.i - b.i; }).forEach(function (x) { body.push(x.el); });
    // The key line is for keyboards: touch screens leave it out (css/play.css).
    body.push(h('p.px-meta.pl-howto-keys', 'Keys: 1–9 pick · Enter confirm · Space next · Esc pause · S show me the solution.'));
    if (learn && Array.isArray(learn.strategies) && learn.strategies.length) {
      body.push(h('h3.pl-howto-h', 'Ways to solve it'));
      body.push(h('ul.pl-list', learn.strategies.map(function (s) { return h('li', h('b', s.title), ': ', s.text); })));
    }
    if (learn && learn.bridge) body.push(h('p.px-meta', learn.bridge));
    if (!canRun(def, true)) body.push(h('p.px-notice', 'This exercise cannot be shown on this device yet.'));
    var close = ui.modal({
      title: 'How to play ' + (def.short || def.name), className: 'pl-howto', body: body,
      actions: [{ label: 'Close', kind: 'secondary', value: 'close' }, canRun(def, true) ? { label: 'Watch, Try, Go', kind: 'primary', value: 'watch' } : null],
      onClose: function (v) { if (v === 'watch') watch(exId); },
    });
    // A long sheet opens at its title (focusing the bottom button had scrolled it to the end).
    try {
      close.el.focus({ preventScroll: true });
      [close.el, close.el.parentNode, close.el.querySelector('.px-modal-body')].forEach(function (x) { if (x) x.scrollTop = 0; });
    } catch (e) { /* cosmetic */ }
    return close;
  }

  /* =====================================================================================
     Today's hooks (js/ui/home.js calls PX.ui.home.plan / levels, which call these)
     ===================================================================================== */

  var planCache = { key: null, val: null };
  function styleName(s) { s = String(s || 'balanced'); return s.charAt(0).toUpperCase() + s.slice(1); }
  function homePlan(r, t) {
    r = r || rec();
    t = isNum(t) ? t : now();
    var key = [r.rev, (r.trials || []).length, (r.sessions || []).length, U.dayKey(t), r.settings.sessionMin, Math.floor(t / 3600000), Object.keys(r.tour && r.tour.seen || {}).length,
      r.settings.patFocus === true, JSON.stringify(r.settings.testPause || null)].join(':');
    if (planCache.key === key) return planCache.val;
    var val = null;
    try {
      var copy = U.deepCopy(r), plan = E().modes.start(copy, 'train', { now: t, display: display(), can: canCheap });
      if (!plan.unavailable && plan.exs && plan.exs.length) {
        var minutes = r.settings.sessionMin || 20, inv = {}, pins = copy.train && Array.isArray(copy.train.pins) ? copy.train.pins : [];
        Object.keys(plan.roles || {}).forEach(function (role) { inv[plan.roles[role]] = role; });
        var blocks = plan.exs.map(function (id) {
          var def = PX.ex.get(id), role = inv[id] || 'extra', tt = E().schedule.totals(copy, def), why;
          if (role === 'focus') why = pins.indexOf(id) >= 0 ? 'Pinned in the Library' : !tt.n ? 'New: not tried yet' : 'Improving fastest lately';
          else if (role === 'review') {
            var d = E().schedule.due(copy, def, t), days = tt.last ? Math.max(1, Math.round((t - tt.last) / 86400000)) : null;
            why = !tt.n ? 'New: not tried yet' : d.due ? 'Due for review' + (days ? ': last practised ' + days + (days === 1 ? ' day' : ' days') + ' ago' : '') : 'Rested longest';
          } else why = !tt.n ? 'New: not tried yet' : 'Practised least so far';
          // the DAT-style format the PAT focus put in (schedule.choose): say why it is there
          if (id === plan.patPick && tt.n) why = 'DAT-style focus: ' + (E().schedule.due(copy, def, t).due ? 'due for review' : 'practised least of the formats');
          var ms = (plan.quota[id] || 0) * (plan.msPer[id] || 0);
          return { role: role.charAt(0).toUpperCase() + role.slice(1), ex: id, min: Math.max(1, Math.round(ms / 60000)), why: why, pat: !!def && def.pat === true };
        });
        var used = blocks.reduce(function (a, b) { return a + b.min; }, 0);
        blocks[0].min = Math.max(1, blocks[0].min + minutes - used);
        val = { minutes: minutes, mode: 'Train', style: styleName(plan.style), blocks: blocks, patFocus: E().schedule.patFocus(r) };
      }
    } catch (e) { log('Today’s plan failed', e); val = null; }
    planCache = { key: key, val: val };
    return val;
  }

  function homeLevels(r) {
    r = r || rec();
    try {
      return E().stats.overview(r, now(), { display: display() }).filter(function (x) { return x.n > 0; })
        .sort(function (a, b) { return (b.last || 0) - (a.last || 0); })
        .map(function (x) {
          var def = PX.ex.get(x.exId), ps = r.path && r.path[x.exId];
          var onPath = isObj(ps) && ((ps.items || 0) > 0 || Object.keys(ps.passed || {}).length > 0 || (ps.stage || 1) > 1);
          return { ex: x.exId, n: x.n, last: x.last, level: x.level, lo: x.lo, hi: x.hi, settings: def ? settingsText(def, x.settings) : '', stage: onPath ? x.path : null,
            text: levelText(x) }; // v1.2: 'level 1 · starter items' (CONTRACT-v1.2 C)
        });
    } catch (e) { log('Today’s levels failed', e); return null; }
  }

  /* =====================================================================================
     The screen, the API and the test hooks
     ===================================================================================== */

  PX.ui.screens = PX.ui.screens || {};
  PX.ui.screens.play = {
    title: function (route) {
      var m = route && route.params && route.params.mode;
      return m === 'daily' ? 'Daily Challenge' : m === 'check' ? 'Spatial Check' : m === 'tour' || m === 'watch' ? 'Watch, Try, Go' : m === 'free' ? 'Free play' : 'Session';
    },
    render: function (host, route, ctx) {
      var p = route.params || {}, m = String(p.mode || 'train');
      host.classList.add('pl-host-screen');
      if (m === 'tour') {
        if (PX.ui.tour && typeof PX.ui.tour.run === 'function') return PX.ui.tour.run(host, route, ctx);
        m = 'train';
      }
      if (m === 'check') {
        if (PX.ui.check && typeof PX.ui.check.run === 'function') return PX.ui.check.run(host, route, ctx);
        renderUnavailable(host, 'check', 'The Spatial Check is not in this build.');
        return null;
      }
      if (p.restore) return restoreScreen(host); // a reloaded or reopened page: the kept summary
      if (m === 'watch') return watchScreen(host, route);
      if (m === 'free' && !p.run && !isObj(p.params) && !p.challenge) return freeSetup(host, route);
      return sessionScreen(host, route);
    },
  };

  function setFast(on) {
    if (on !== undefined) FAST = !!on;
    if (current) current.setFast(FAST);
    PX.debug.isFast = FAST;
    return FAST;
  }

  PX.ui.play = {
    watch: watch, howTo: howTo, player: createPlayer, wtg: wtg, canRun: canRun, settingsText: settingsText,
    homePlan: homePlan, homeLevels: homeLevels, fast: setFast, showCard: showCard, closeCards: closeCards, setChrome: setChrome,
    fillParams: fillParams, responseFor: responseFor, openShare: openShare, screenHead: screenHead,
    goalOf: goalOf, specOf: specOf, tagOf: tagOf, fmtRt: fmtRt, MODE_NAMES: MODE_NAMES, levelText: levelText,
    firstStrategy: firstStrategy, gentleMotion: gentleMotion, MOTION: MOTION, tutorialSeconds: wtgSeconds, minutesWords: minutesWords,
    bootRoute: bootRoute, sound: sound, thresholdText: thresholdText,
    isFast: function () { return FAST; },
    config: CONFIG,
    state: function () { return current ? current.state : 'idle'; },
    current: function () { return current; },
  };

  PX.debug.current = function () { var P = current; return P && P.item ? { exId: P.exId, item: P.item, key: P.item.key, state: P.state } : null; };
  PX.debug.answer = function (c) { if (!current) return false; current.answer(c).catch(function () { /* not answering now */ }); return true; };
  PX.debug.fast = setFast;

  // window.__play: the test API (Playwright). answer(true|false) goes through the grid like a
  // click (custom layouts: the same path as the view's respond).
  win.__play = {
    get state() { return current ? current.state : 'idle'; },
    get exId() { return current ? current.exId : null; },
    get item() { return current ? current.item : null; },
    get key() { return current && current.item ? current.item.key : null; },
    get last() { return current ? current.last : null; },
    get played() { return current ? Object.assign({}, current.played) : null; },
    get history() { return current ? current.history.slice() : []; },
    get paused() { return current ? { start: current.pauseStart, ms: current.pausedMs } : null; },
    get session() {
      var S = session.S;
      return S ? { mode: S.mode, answered: S.answered, done: S.done, voidRun: S.voidRun, res: S.res, planDone: !!(S.plan && S.plan.done),
        activeMs: S.clock ? S.clock.activeMs() : null, clock: S.clock ? S.clock.reasons() : null, running: S.clock ? S.clock.running() : false,
        budgetMs: S.plan ? S.plan.budgetMs : null, lastServed: !!(S.plan && S.plan.lastServed), hud: session.P ? session.P.el.meta.textContent : null } : null;
    },
    get sound() { return { ready: sound.ready(), played: sound.played }; },
    answer: function (c) { return current ? current.answer(c) : Promise.reject(new Error('no player')); },
    next: function () { return current ? current.goNext() : false; },
    pause: function () { return current ? current.pause() : false; },
    resume: function () { return current ? current.resume() : false; },
    skip: function (end) { return current ? current.skip(!!end) : false; },
    showMe: function () { return current ? current.showMe(false) : Promise.resolve(false); },
    end: function () { if (session.S && session.S.end) { session.S.ended = true; session.S.end(); return true; } return false; },
    fast: setFast,
  };
})(window.PX);
