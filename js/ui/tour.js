/* PX.ui.tour: the first-run tour (PLAN §8; ARCHITECTURE §9). The shell's first-run offer
   ("New here? Watch, Try, Go (N min)", from each tutorial's own length) calls PX.ui.tour.start(), which opens the play screen in
   mode 'tour': Watch, Try, Go for Rotate, Fold and Track (each one a slow demo with captions and
   a few practice items that never count; exercises this device cannot show are left out), then
   "Measure your starting point" (its time from the config, as the check says it; no feedback) or Later. Every step can be skipped;
   skipping the baseline only means transfer reports start later. The end screen carries the
   Chimera invite (v1.2, gap C6).
   Flags: store.state.tour.done (true once the tour ended, finished or left) and
   store.state.ui.tour = { started, finished, done: [ids], skipped: [ids], baseline: 'now' | 'later' }.
   PX.ui.tour = { start(), run(host, route, ctx) → cleanup, LIST, minutes() → { minutes, words, short } } */
(function (PX) {
  'use strict';

  var ui = PX.ui, h = ui.h, store = PX.core.store, router = PX.core.router;
  var LIST = ['rotate', 'fold', 'track'];

  function save() { try { store.save(); } catch (e) { /* the next save writes it */ } }
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

  // The tour's length in words, from each tutorial's own estimate (PX.ui.play.tutorialSeconds), for the
  // exercises this device can show; 'about N minutes' and 'N min' for the button.
  function minutes() {
    var P = PX.ui.play, sec = 0;
    LIST.forEach(function (id) {
      var def = PX.ex.get(id);
      if (!def || (P && typeof P.canRun === 'function' && !P.canRun(def, true))) return;
      sec += P && typeof P.tutorialSeconds === 'function' ? P.tutorialSeconds(PX.ex.learn(id)) : 60;
    });
    var m = Math.max(1, Math.round(sec / 60));
    return { minutes: m, words: P && typeof P.minutesWords === 'function' ? P.minutesWords(sec) : m + ' minutes', short: m + ' min' };
  }

  function start() {
    var t = state();
    t.started = Date.now();
    save();
    router.go('play', { mode: 'tour' }, { force: true });
  }

  function run(host) {
    var Play = PX.ui.play, t = state();
    var wrap = h('div.pl-screen', { 'data-mode': 'tour' });
    host.appendChild(wrap);
    var list = LIST.filter(function (id) { var d = PX.ex.get(id); return d && PX.ex.learn(id) && Play.canRun(d); });
    var P = null, alive = true, i = 0;

    function nextEx() {
      if (!alive) return;
      if (i >= list.length) { baseline(false); return; }
      var id = list[i++], def = PX.ex.get(id);
      t.step = id;
      save();
      Play.wtg(P, id, { host: wrap, tour: true, lead: 'Tour · exercise ' + i + ' of ' + list.length + ': ' + (def.short || def.name) }).then(function (r) {
        if (!alive) return;
        (r === 'done' ? t.done : t.skipped).push(id);
        save();
        if (r === 'end') baseline(true); else nextEx();
      });
    }

    function baseline(ended) {
      if (!alive) return;
      if (P) { P.destroy(); P = null; }
      Play.setChrome(false);
      markDone();
      ui.clear(wrap);
      try { window.scrollTo(0, 0); } catch (e) { /* ignore */ } // the end card starts a screen of its own
      var missing = LIST.length - list.length;
      wrap.appendChild(Play.screenHead('Watch, Try, Go', ended ? 'Tour ended' : list.length ? 'That was the tour' : 'Your starting point',
        list.length ? 'Each exercise has its own Watch, Try, Go the first time it appears in a session, and in the Library under How to play.' : 'The guided demos need exercises this device cannot show yet. Each exercise has its own How to play in the Library.'));
      if (missing && list.length) wrap.appendChild(h('p.px-meta.pl-tour-miss', 'Left out here: ' + LIST.filter(function (id) { return list.indexOf(id) < 0; }).map(function (id) { var d = PX.ex.get(id); return d ? d.short || d.name : id; }).join(', ') + ' (not available on this device yet).'));
      var box = h('div.pl-tour-end');
      wrap.appendChild(box);
      // gap C6: the tutorial ends with the invite (a screen of its own, no items on it)
      var inv = PX.ui.chimera && PX.ui.chimera.invite ? PX.ui.chimera.invite('tutorial', { host: wrap, className: 'pl-tour-invite' }) : null;
      if (inv) wrap.appendChild(inv);
      // the check's length from the config, as the check itself says it (W2-measure: PX.ui.measure.minutesOf)
      var Mq = PX.ui.measure, mins = Mq && Mq.minutesOf ? Mq.minutesOf('B1', store.state) : null;
      Play.showCard(box, null, {
        id: 'baseline', title: 'Measure your starting point',
        lines: [(mins ? 'About ' + (mins % 1 ? mins.toFixed(1) : mins) + ' minutes' : 'A few minutes') + ', no feedback: short tasks that Parallax never trains, plus a word task as a control.',
          'Later checks are compared with this starting point, so you can see what practice changes beyond familiarity with the tasks. Skipping only means those reports start later.'],
        actions: [{ label: 'Later', value: 'later' }, { label: 'Measure now' + (mins ? ' (about ' + (mins % 1 ? mins.toFixed(1) : mins) + ' min)' : ''), value: 'now', primary: true }],
      }).then(function (v) {
        t.baseline = v === 'now' ? 'now' : 'later';
        save();
        if (!alive) return;
        if (v === 'now') router.go('play', { mode: 'check' }, { force: true });
        else router.go('home');
      });
    }

    if (!list.length) baseline(false);
    else {
      Play.setChrome(true);
      P = Play.player({ endLabel: 'End the tour' });
      wrap.appendChild(h('h1.px-sr', 'Watch, Try, Go'));
      wrap.appendChild(P.el.root);
      nextEx();
    }

    return function cleanup() {
      alive = false;
      Play.setChrome(false);
      if (Play.closeCards) Play.closeCards(); // an open card goes with its key layer
      if (P) { P.destroy(); P = null; }
      markDone(); // left part-way: the tour counts as seen, and How to play stays in the Library
    };
  }

  PX.ui.tour = { start: start, run: run, LIST: LIST, minutes: minutes };
})(window.PX);
