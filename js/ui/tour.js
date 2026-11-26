/* PX.ui.tour: the first-run tutorial (PLAN §8; ARCHITECTURE §9; the owner's first-session choice of 19 Nov, DECISIONS).
   The shell's first-run offer ("New here? Watch, Try, Go (N min)", N from the tutorial's own length) calls
   PX.ui.tour.start(), which opens the play screen in mode 'tour': Watch, Try, Go for ONE exercise, the simplest to
   learn (LIST: Spin; a slow demo with captions, then a few practice items that never count). Its end screen offers
   the starting point (Baseline 1: its time from the config, as the check says it; no feedback) with Later, and both
   answers lead straight into a Train session that opens with the exercise just learned:
     Measure now → play?mode=train&exId=<id>&baseline=now: the session plays Baseline 1 first without asking again
       (js/ui/measure.js, hook 'measure.session'), then trains;
     Later → the put-off is logged (PX.engine.assess.later) and play?mode=train&exId=<id>&baseline=later trains at
       once; the next session opens with the baseline.
   The other exercises keep their own Watch, Try, Go offer the first time a session meets them. The tutorial can be
   skipped. The end screen carries the Chimera invite (v1.2, gap C6) and, in a test build, the playtest taps.
   Flags: store.state.tour.done (true once the tutorial ended, finished or left) and
   store.state.ui.tour = { started, finished, done: [ids], skipped: [ids], baseline: 'now' | 'later' | 'none' }.
   PX.ui.tour = { start(), run(host, route, ctx) → cleanup, LIST, minutes() → { minutes, words, short, names },
     baseline1() → { minutes, text } while Baseline 1 is due, else null (the standalone Go screen says it too) } */
(function (PX) {
  'use strict';

  var ui = PX.ui, h = ui.h, store = PX.core.store, router = PX.core.router;
  var LIST = ['spin'];

  function save() { try { store.save(); } catch (e) { /* the next save writes it */ } }
  function log(m, e) { if (window.console) console.error('PX.ui.tour: ' + m, e || ''); }
  function state() {
    var r = store.state;
    if (!r.ui || typeof r.ui !== 'object') r.ui = { lastRoute: null };
    var t = r.ui.tour;
    if (!t || typeof t !== 'object' || Array.isArray(t)) t = r.ui.tour = {};
    if (!Array.isArray(t.done)) t.done = [];
    if (!Array.isArray(t.skipped)) t.skipped = [];
    return t;
  }
  function markDone() {
    var r = store.state;
    if (!r.tour || typeof r.tour !== 'object') r.tour = { done: false, seen: {} };
    r.tour.done = true;
    state().finished = state().finished || Date.now();
    save();
  }
  function nameOf(id) { var d = PX.ex.get(id); return d ? d.short || d.name : id; }
  function runnable(cheap) {
    var P = PX.ui.play;
    return LIST.filter(function (id) {
      var d = PX.ex.get(id);
      return d && PX.ex.learn(id) && !(P && typeof P.canRun === 'function' && !P.canRun(d, cheap));
    });
  }

  // The tutorial's length in words, from its own estimate (PX.ui.play.tutorialSeconds): 'about N minutes',
  // 'N min' for the button, and the exercise's name for the offer.
  function minutes() {
    var P = PX.ui.play, sec = 0, ids = runnable(true);
    ids.forEach(function (id) { sec += P && typeof P.tutorialSeconds === 'function' ? P.tutorialSeconds(PX.ex.learn(id)) : 60; });
    var m = Math.max(1, Math.round(sec / 60));
    return { minutes: m, words: P && typeof P.minutesWords === 'function' ? P.minutesWords(sec) : m + ' minutes', short: m + ' min',
      names: ids.map(nameOf).join(', ') };
  }

  function start() {
    var t = state();
    t.started = Date.now();
    save();
    router.go('play', { mode: 'tour' }, { force: true });
  }

  // Baseline 1 as the check says it (W2-measure: PX.ui.measure.status and minutesOf), or null when it is not next.
  function baseline1() {
    var Mq = PX.ui.measure, st = null, mins = null;
    try { st = Mq && Mq.status ? Mq.status(store.state, Date.now()) : null; } catch (e) { log('status failed', e); }
    if (!st || st.kind !== 'B1' || !st.due) return null;
    try { mins = Mq.minutesOf ? Mq.minutesOf('B1', store.state) : null; } catch (e) { mins = null; }
    return { minutes: mins, text: mins ? (mins % 1 ? mins.toFixed(1) : String(mins)) : null };
  }

  function run(host) {
    var Play = PX.ui.play, t = state();
    var wrap = h('div.pl-screen', { 'data-mode': 'tour' });
    host.appendChild(wrap);
    var list = runnable(false), P = null, alive = true, slot = h('div.pl-playtest-slot');

    function tutorial() {
      var id = list[0];
      t.step = id;
      save();
      Play.wtg(P, id, { host: wrap, tour: true, slot: slot, lead: 'Your first exercise: ' + nameOf(id) }).then(function (r) {
        if (!alive) return;
        (r === 'done' ? t.done : t.skipped).push(id);
        save();
        end(id, r);
      });
    }

    // The tutorial's end: what comes next, the starting point offered with Later, then Train either way.
    function end(id, r) {
      if (!alive) return;
      if (P) { P.destroy(); P = null; }
      Play.setChrome(false);
      markDone();
      ui.clear(wrap);
      try { window.scrollTo(0, 0); } catch (e) { /* ignore */ } // the end screen starts a screen of its own
      var done = r === 'done', name = id ? nameOf(id) : '';
      if (done) { // Go is a step of its own (as the standalone Watch, Try, Go's end screen)
        wrap.appendChild(h('ol.pl-wtg-steps.pl-go-steps', { 'aria-label': 'Watch, Try, Go: step 3 of 3' }, ['Watch', 'Try', 'Go'].map(function (n, i) {
          return h('li.pl-wtg-step' + (i < 2 ? '.is-done' : '.is-current'), i === 2 ? { 'aria-current': 'step' } : null, h('span.pl-wtg-n.px-num', String(i + 1)), h('span.pl-wtg-name', n));
        })));
      }
      var rest = 'Other exercises show their own Watch, Try, Go when they first come up.';
      wrap.appendChild(done ? Play.screenHead('Watch, Try, Go · step 3', 'Go: ' + name + ' for real', 'That was the tutorial; nothing was logged. Training starts with easier ' + name + ' items, then follows your level. ' + rest)
        : id ? Play.screenHead('Watch, Try, Go', 'Tutorial skipped', 'Training follows your level from its first item. ' + rest + ' How to play stays in the Library.')
          : Play.screenHead('Watch, Try, Go', 'Ready to train', 'The guided demo needs an exercise this device cannot show yet. Each exercise has its own How to play in the Library.'));
      var box = h('div.pl-tour-end');
      wrap.appendChild(box);
      wrap.appendChild(slot); // playtest taps for the tutorial (CONTRACT-v1.2 G)
      // gap C6: the tutorial ends with the invite (a screen of its own, no items on it)
      var inv = PX.ui.chimera && PX.ui.chimera.invite ? PX.ui.chimera.invite('tutorial', { host: wrap, className: 'pl-tour-invite', exId: id || undefined }) : null;
      if (inv) wrap.appendChild(inv);
      var train = { mode: 'train' };
      if (done) train.exId = id; // the session opens with the exercise just learned
      var b1 = baseline1();
      if (!b1) {
        t.baseline = 'none';
        save();
        var sm = store.state.settings && store.state.settings.sessionMin;
        Play.showCard(box, null, { id: 'train', title: 'Your first session', lines: ['Training starts with easier items, then follows your level' + (sm > 0 ? ': ' + sm + ' minutes of active time' : '') + '. End session stops it whenever you like.'],
          actions: [{ label: 'Start training', value: 'train', primary: true }] }).then(function (v) {
          if (alive && v === 'train') router.go('play', train, { force: true });
        });
        return;
      }
      var about = b1.text ? 'about ' + b1.text + ' minutes' : 'a few minutes';
      Play.showCard(box, null, {
        id: 'baseline', title: 'Next: your starting point',
        lines: [about.charAt(0).toUpperCase() + about.slice(1) + ', no feedback: short tasks that Parallax never trains, plus a word task as a control.',
          'Later checks are compared with this starting point, so you can see whether practice changes anything beyond familiarity with the tasks.',
          'Training follows either way. Later starts it now, and your next session opens with the check.'],
        actions: [{ label: 'Later', value: 'later' }, { label: 'Measure now' + (b1.text ? ' (' + b1.text + ' min)' : ''), value: 'now', primary: true }],
      }).then(function (v) {
        if (!alive || (v !== 'now' && v !== 'later')) return; // the screen was left with the card open
        t.baseline = v;
        if (v === 'later') { try { PX.engine.assess.later(store.state, 'B1', Date.now()); } catch (e) { log('later failed', e); } }
        save();
        train.baseline = v; // js/ui/measure.js: 'now' plays Baseline 1 first without a second ask; 'later' leaves this session alone
        router.go('play', train, { force: true });
      });
    }

    if (!list.length) end(null, 'none');
    else {
      Play.setChrome(true);
      P = Play.player({ endLabel: 'End the tutorial' });
      wrap.appendChild(h('h1.px-sr', 'Watch, Try, Go'));
      wrap.appendChild(P.el.root);
      tutorial();
    }

    return function cleanup() {
      alive = false;
      Play.setChrome(false);
      if (Play.closeCards) Play.closeCards(); // an open card goes with its key layer
      if (P) { P.destroy(); P = null; }
      markDone(); // left part-way: the tutorial counts as seen, and How to play stays in the Library
    };
  }

  PX.ui.tour = { start: start, run: run, LIST: LIST, minutes: minutes, baseline1: baseline1 };
})(window.PX);
