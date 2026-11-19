/* PX.ui.check: the Spatial Check screen (mode 'check'; PLAN §4, §6, v1.2 milestone 6; ENGINE.md §21).
   Most measurements open a session (js/ui/measure.js: baselines, short checks, the 4-weekly check); this screen
   plays one on its own, from Today, Progress or a link: route play?mode=check&kind=<B1|B2|regular|delayed|week>
   (without kind: the engine's next full check, PX.engine.assess.due). The flow: an intro card (what it is, how
   long) → the expectations question once at baseline (PX.engine.assess.expect) → at a full check after the first,
   one outside-practice question (B7) → the occasion itself, played by PX.ui.measure.play (per probe its
   instruction and, on first contact, its worked example; items without feedback; one free skip per probe) → a
   short end screen with the meter or the next step.
   A check counts only when it is complete: one stopped part-way (Stop the check asks first) never becomes a
   result; its answered items stay in the trial log and show in the Log as "not finished".
   Each entry also says what it was taken with (v1.1): display, viewport and input, through plan.check.extra.
   PX.ui.check.run(host, route, ctx) → cleanup   (js/ui/play.js routes mode 'check' here)
   PX.ui.check.session: the running occasion's state ({ plan, answered, done }) for tests. */
(function (PX) {
  'use strict';

  var win = window, ui = PX.ui, h = ui.h, store = PX.core.store, router = PX.core.router;
  var KINDS = { B1: 1, B2: 1, regular: 1, delayed: 1, week: 1, block: 1, balance: 1 };

  function E() { return PX.engine; }
  function rec() { return store.state; }
  function now() { return Date.now(); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function log(m, e) { if (win.console) console.error('PX.ui.check: ' + m, e || ''); }
  function M() { return PX.ui.measure; }
  function name(kind) { return M() && M().names[kind] || 'Spatial Check'; }
  function minutes(m) { return (m % 1 ? m.toFixed(1) : String(m)) + ' minutes'; }

  function run(host, route) {
    var Play = PX.ui.play, p = route.params || {};
    var wrap = h('div.pl-screen', { 'data-mode': 'check' });
    host.appendChild(wrap);
    var S = { plan: null, done: false, stopped: false, answered: 0, P: null };
    PX.ui.check.session = S;
    var r = rec(), t = now(), kind = typeof p.kind === 'string' && KINDS[p.kind] ? p.kind : null, d = null;
    if (!kind) { try { d = E().assess.due(r, t); kind = d.kind; } catch (e) { log('due failed', e); kind = 'B1'; } }
    var mix = [], items = 0;
    try { mix = E().assess.mix(kind, r, { optional: p.optional === '1' || p.optional === true }, function (def) { return Play.canRun(def); }); } catch (e) { mix = []; }
    mix.forEach(function (x) { items += x.items; });
    if (!M() || !mix.length) {
      wrap.appendChild(Play.screenHead('Spatial Check', 'Not available right now', 'The Spatial Check needs its probe tasks.'));
      wrap.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' })));
      return null;
    }
    Play.setChrome(true);
    var P = S.P = Play.player({ endLabel: 'Stop the check', onState: function (st) {
      var cur = M().play.current, c = cur && cur.clock;
      if (!c) return;
      if (st === 'paused') c.pause('sheet'); else c.resume('sheet');
    } });
    wrap.appendChild(h('h1.px-sr', 'Spatial Check'));
    wrap.appendChild(P.el.root);
    P.el.helpBtn.hidden = true;
    function card(o) {
      if (S.done) return Promise.resolve('closed');
      return Play.showCard(wrap, P.el.root, Object.assign({}, o, { hide: P.el.root }));
    }
    var m = Math.round(items * E().config.measure.secPerItem / 30) / 2, baseline = /^B/.test(kind), block = kind === 'block' || kind === 'week', lab = kind === 'balance';
    function intro() {
      if (lab) return card({
        id: 'check-intro', title: 'Lab · ' + name(kind), lines: [
          items + ' items, about ' + minutes(m) + ': questions about dots on a board and houses on a street, one tap each. There is no feedback and no result at the end.',
          'It is not part of the Spatial Check. The Lab keeps your answers for the community\'s pooled exports, which test whether practice changes these judgements.',
        ],
        actions: [{ label: 'Back', value: 'later' }, { label: 'Start', value: 'start', primary: true }],
      });
      var lines = [
        mix.length + ' short tasks that Parallax never trains, ' + items + ' items in all: about ' + minutes(m) + '.',
        'There is no feedback. The items adapt to your answers, so expect roughly 6 to 8 in 10 right, depending on the task: the difficulty you reach carries the information, not the count.',
        'Answer as well as you can, and guess when you are unsure. Each task has a time limit per item, shown as a slow bar.',
        baseline ? 'This is ' + name(kind).toLowerCase() + ': your starting point. Two of them make it steadier, and everything later is compared with them.' :
          block ? 'It adds one more reading to your probe trend; the meter counts only the rise beyond what familiarity with the tasks predicts.' :
            'The meter compares it with your starting points, a word task that training should leave alone, and what familiarity alone would give.',
      ];
      if (d && d.why && !d.due) lines.push('Not due yet: ' + d.why);
      return card({
        id: 'check-intro', title: 'Spatial Check · ' + name(kind), lines: lines,
        actions: [{ label: 'Later', value: 'later' }, { label: 'Start the check', value: 'start', primary: true }],
      });
    }
    function stopScreen() {
      S.done = S.stopped = true;
      P.destroy();
      Play.setChrome(false);
      PX.ui.clear(wrap);
      wrap.appendChild(Play.screenHead('Spatial Check', 'Check stopped', 'A check counts only when it is complete, so this one is not used for your results. Your answers stay in the Log, marked “not finished”. Take it again any time: it takes about ' + minutes(m) + '.'));
      wrap.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' }), ui.button('Open the Log', { kind: 'secondary', go: 'log' })));
    }
    var ctx = { P: P, wrap: wrap, card: card };
    intro().then(function (v) {
      if (S.done) return null;
      if (v !== 'start') {
        S.done = true;
        if (v === 'later' && kind === 'B1') { try { E().assess.later(rec(), 'B1', now()); store.save(); } catch (e) { log('later failed', e); } }
        P.destroy(); Play.setChrome(false); router.go(lab ? 'lab' : 'home');
        return null;
      }
      var Mq = M()._;
      return Promise.resolve(baseline ? Mq.askExpect(ctx, { kind: kind }) : null).then(function () {
        return !baseline && !block && !lab || kind === 'B2' ? Mq.askOverlap(ctx) : null;
      }).then(function (ov) {
        if (S.done) return null;
        var started = M().play({ P: P, wrap: wrap, kind: kind, card: card, clock: null, standalone: true, optional: p.optional === '1' || p.optional === true, extra: ov ? { overlapAnswer: ov } : null });
        var cur = M().play.current;
        if (cur) { cur.stopped = false; PX.ui.check.session = cur; }
        return started.then(function (out) {
          if (S.done) return null;
          if (out.unavailable) { S.done = true; P.destroy(); Play.setChrome(false); PX.ui.clear(wrap); wrap.appendChild(Play.screenHead('Spatial Check', 'Not available right now', out.unavailable)); return null; }
          if (out.stopped || !out.res) { stopScreen(); return null; }
          S.done = true;
          P.destroy();
          Play.setChrome(false);
          PX.ui.clear(wrap);
          renderEnd(wrap, out.res);
          try { win.scrollTo(0, 0); } catch (e) { /* ignore */ }
          return null;
        });
      });
    }).catch(function (e) { log('check failed', e); });

    return function cleanup() {
      Play.setChrome(false);
      S.done = true; // a check left part-way does not count (its answers stay in the Log)
      var cur = M() && M().play.current;
      if (cur && !cur.done) cur.done = true;
      if (Play.closeCards) Play.closeCards(); // open cards and their key layers go with the screen
      if (S.P) S.P.destroy();
      PX.ui.check.session = null;
    };
  }

  function renderEnd(wrap, res) {
    var K = PX.ui.kit, Play = PX.ui.play, c = res && res.check, Mx = M();
    wrap.appendChild(Play.screenHead((c && c.lab ? 'Lab' : 'Spatial Check') + ' · ' + K.fmtWhen(now()), c ? 'Saved' : 'Check ended', null));
    var out = h('div.pl-summary');
    wrap.appendChild(out);
    if (!c) {
      out.appendChild(h('p.px-lead', 'No answers were recorded, so nothing was saved.'));
      out.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' })));
      return;
    }
    if (c.lab) { renderLab(out, c); return; }
    var p = K.panel({ title: name(c.kind), className: 'pl-panel', aside: c.form ? 'form ' + c.form : null });
    p.body.appendChild(h('ul.pl-list.pl-check-list', Object.keys(c.results).map(function (id) {
      var def = PX.ex.get(id), r = c.results[id];
      return h('li', { 'data-probe': id }, h('b', def ? def.short || def.name : id), ': ' + r.n + ' items' + (isNum(r.rtMed) ? ', median time of right answers ' + Play.fmtRt(r.rtMed) : '') + '.');
    })));
    p.body.appendChild(h('p', 'The items adapted to your answers, so roughly 6 to 8 in 10 right is expected. Parallax records the difficulty you reached on each task’s own scale, with its uncertainty, and follows it over time; these are not scores against other people and not an IQ.'));
    out.appendChild(p.el);
    var pn = K.panel({ title: 'Next', className: 'pl-panel pl-next' }), mt = c.meter || {};
    if (c.verdict) pn.body.appendChild(h('p', Mx.words[c.verdict.words] + ' (verdict at day ' + c.verdict.day + ')'));
    if (isNum(mt.p)) pn.body.appendChild(Mx.meterEl(mt));
    if (mt.line) pn.body.appendChild(h('p', mt.line));
    var st = Mx.status(rec(), now());
    pn.body.appendChild(h('p', h('b', st.title + '. '), st.text));
    pn.body.appendChild(h('div.pl-summary-actions', ui.button('Back to Today', { kind: 'primary', go: 'home' }), ui.button('See Progress', { kind: 'secondary', go: 'progress' })));
    out.appendChild(pn.el);
    checkInvite(out);
  }

  // Balance (a Lab check): saved, with no result (a result would teach the weighting it measures; RV-wave2 finding 1).
  function renderLab(out, c) {
    var K = PX.ui.kit, runs = M().balanceRuns(rec()), p = K.panel({ title: name(c.kind), className: 'pl-panel px-ms-balance-end' });
    p.body.appendChild(h('p', 'Saved' + (runs.n > 1 ? ' as run ' + runs.n : '') + '. Balance shows no results, so that every run measures the same thing; your answers stay in your record and go into the community export.'));
    p.body.appendChild(h('div.pl-summary-actions', ui.button('Back to the Lab', { kind: 'primary', go: 'lab' }), ui.button('Back to Today', { kind: 'secondary', go: 'home' })));
    out.appendChild(p.el);
  }

  // W1-rules (v1.2, gap C8): a finished check is a natural point to invite the player in.
  function checkInvite(out) {
    var inv = PX.ui.chimera && PX.ui.chimera.invite ? PX.ui.chimera.invite('check', { host: out }) : null;
    if (inv) out.appendChild(inv);
  }

  PX.ui.check = { run: run, session: null };
})(window.PX);
