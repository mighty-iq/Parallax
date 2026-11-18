/* PX.ui.frontier: progress on every dimension on the screens (PLAN milestone 7; docs/dev/CONTRACT-v1.2.md R;
   ENGINE.md §19). Mounted through PX.ui.hooks only:
     exercise:lines   the exercise page and How to play: "Settings you handle": per dimension, the hardest
                      setting answered right three times out of four above chance with the other settings at
                      their easiest (PX.engine.dims.frontier), fitted to the player's own answers from
                      config.dims.from answers on; leading items and timed items in one line each
     item:notes       after a fluency item (a timed item inside Train): in time or not, its deadline and the
                      next one, and (once a session) that it moves the Speed level only
   Every number in these texts comes from PX.engine.config (dims, speed). Nothing here runs during a
   stimulus: both points are between items. */
(function (PX) {
  'use strict';

  var ui = PX.ui, h = ui.h, U = PX.util;
  function E() { return PX.engine; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  var ORD = { 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth' };
  var COUNT = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 8: 'eight', 10: 'ten' };
  var MIN = 10; // answers before the panel shows frontiers (the rating has left its starting guess)

  function displayClass() {
    try { return PX.ui.exinfo.display(); } catch (e) { return 'large'; }
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  // A setting in words, as the Library writes it ('10 cubes', 'board turned 90°'); its label as the row's name.
  function words(def, dim, v) {
    try { return PX.ui.exinfo.dimText(def, dim, v); } catch (e) { return String(v); }
  }
  function label(dim) { return cap(dim.label || dim.key); }

  // The panel's rows: per dimension its frontier in words and a ruler of its levels.
  function rows(def, fr) {
    return fr.map(function (f) {
      var dim = def.dims[f.dim], n = f.of, hard = (dim.step || 0) < 0 ? -1 : 1;
      // how far along the dimension's levels, from its easiest to its hardest (1 … n)
      var at = f.floor ? 0 : hard > 0 ? f.level + 1 : n - f.level;
      var txt = f.floor ? 'not yet at its easiest setting (' + words(def, dim, dim.levels[hard > 0 ? 0 : n - 1]) + ')' :
        f.top ? 'the whole range, up to ' + words(def, dim, f.value) : 'up to ' + words(def, dim, f.value);
      var b = ui.bar(at, n, { label: label(dim) + ': ' + at + ' of ' + n + ' settings' });
      b.set(at, n);
      return h('div', { 'data-dim': dim.key }, h('dt', label(dim)), h('dd', h('span.px-frontier-text', txt), b));
    });
  }

  function block(def, rec, now, where) {
    var X = E(), Dm = X && X.dims;
    if (!Dm || !def || def.role !== 'train') return null;
    var C = X.config.dims, disp = displayClass(), st = X.est.get(rec, def, { display: disp });
    var fr = Dm.frontier(rec, def, disp);
    if (!fr.length) return null;
    var head = h('p.px-frontier-head', h('span.px-tag', 'Settings you handle'));
    if (!(st.n >= MIN)) {
      if (where !== 'page') return null;
      return h('div.px-frontier', { 'data-frontier': 'empty', 'data-where': where }, head,
        h('p.px-meta', 'After your first ' + MIN + ' answers here, this shows the hardest setting of each kind you handle.'));
    }
    var s = Dm.state(rec, def, disp), active = !!(s && s.active), many = fr.length > 1;
    var kids = [head, h('dl.px-facts.px-facts--dims.px-frontier-list', rows(def, fr))];
    var expl = 'With the other settings at their easiest, the hardest setting of each kind you would answer right three times out of four above chance.';
    if (where === 'page') {
      if (active) expl += ' Fitted to your own answers: each kind of setting gets its own step from your last ' + Math.min(s.n, C.window) + ' answers, so what comes easier to you is pushed further and what comes harder waits.';
      else expl += ' From ' + C.from + ' answers on (' + (s ? s.n : st.n) + ' so far), Parallax fits each kind of setting to your own answers, so what comes easier to you is pushed further.';
      kids.push(h('p.px-meta.px-frontier-why', expl));
      var more = [];
      if (many && isNum(C.lead) && C.lead >= 2 && ORD[Math.round(C.lead)]) more.push('In Train, every ' + ORD[Math.round(C.lead)] + ' item aimed at your level puts one of these settings at its edge, in turn, with the others easy.');
      var nf = isNum(C.fluency) && C.fluency > 0 ? Math.round(1 / C.fluency) : 0;
      if (nf && COUNT[nf] && Dm.fluencyOpen(rec, def, disp)) more.push('Speed is open here, so about one item in ' + COUNT[nf] + ' comes with a deadline: it trains answering fast on settings you already answer well, and counts for your Speed level only.');
      if (more.length) kids.push(h('p.px-meta.px-frontier-more', more.join(' ')));
    } else kids.push(h('p.px-meta.px-frontier-why', expl));
    return h('div.px-frontier', { 'data-frontier': active ? 'fitted' : 'level', 'data-where': where }, kids);
  }

  if (PX.ui.hooks) {
    PX.ui.hooks.on('exercise:lines', function (ctx) {
      var el = ctx && ctx.def && ctx.rec ? block(ctx.def, ctx.rec, ctx.now, ctx.where === 'howto' ? 'howto' : 'page') : null;
      return el ? { el: el, order: 20 } : null;
    }, { id: 'progress.frontier', order: 20 });

    // After a fluency item: in time or not, the deadline it had and the next one.
    PX.ui.hooks.on('item:notes', function (ctx) {
      var step = ctx && ctx.step, out = ctx && ctx.out, tr = ctx && ctx.tr;
      if (!step || step.kind !== 'fluency' || !out || !out.timed) return null;
      var f = out.fluency || {}, inTime = out.inTime === true;
      var what = inTime ? 'Timed item: right within its ' + U.fmtSecs(step.deadlineMs) + '.' :
        tr && tr.timeout ? 'Timed item: its ' + U.fmtSecs(step.deadlineMs) + ' ran out.' : 'Timed item: not right this time.';
      var next = isNum(f.next) ? ' The next timed item gets ' + U.fmtSecs(f.next) + '.' : '';
      var plan = ctx.plan, first = plan && !plan.uiFluencyNoted;
      if (plan) plan.uiFluencyNoted = true;
      return h('p.pl-note.px-frontier-note', { 'data-fluency': inTime ? 'in-time' : 'missed' }, what + next,
        first ? h('span.px-meta', ' Timed items come now and then once Speed is open: they train answering fast on settings you already answer well, and count for your Speed level, never for this level.') : null);
    }, { id: 'progress.fluency', order: 20 });
  }

  PX.ui.frontier = { block: block };
})(window.PX);
