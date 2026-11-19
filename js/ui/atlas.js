/* PX.ui.screens.atlas: the Atlas (route 'atlas', reached from Progress; v1.2 PLAN milestone 5; note G1 §2.4,
   §5.5, §6.3). Per exercise, a hairline grid over two of its settings (js/engine/game.js atlasDims): each
   cell unseen (empty), tried (a ring) or handled (a filled square: right answers there that guessing would
   explain less than one time in ten), with the band of the current level outlined and the nearest unhandled
   cell at that level marked "within reach". Cells fill from Train, Path, Speed, Free play, the Daily and the
   Climb, never from the Spatial Check. Nothing unlocks: the Atlas only charts what was handled. A cell flips
   once; at most 12 cells animate when the screen opens after new firsts (still under reduced motion and at
   the quiet level). */
(function (PX) {
  'use strict';

  var win = window, doc = win.document;
  var ui = PX.ui, h = ui.h;
  var store = PX.core.store, router = PX.core.router;

  if (router && Array.isArray(router.NAMES) && router.NAMES.indexOf('atlas') < 0) router.NAMES.push('atlas');

  function E() { return PX.engine; }
  function G() { return PX.engine.game; }
  function GU() { return PX.ui.game; }
  function rec() { return store.state; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function nameOf(def) { return def ? def.short || def.name : ''; }
  function uiRec() { var r = rec(); if (!isObj(r.ui)) r.ui = { lastRoute: null }; if (!isObj(r.ui.atlas)) r.ui.atlas = {}; return r.ui.atlas; }
  function dimLabel(def, dim, k) {
    var X = PX.ui.exinfo, v = dim.levels[k];
    try { if (X && X.dimText) return X.dimText(def, dim, v); } catch (e) { /* below */ }
    return String(v);
  }

  // The x axis shows each level's value alone (its title names the setting); the rows say it in words.
  function shortVal(dim, k) {
    var X = PX.ui.exinfo, v = dim.levels[k];
    try { if (X && X.valueText) { var t = String(X.valueText(dim, v)); if (t.length <= 5) return t; } } catch (e) { /* below */ }
    return typeof v === 'number' ? String(v) : String(k + 1);
  }

  function defs(r) {
    var list = PX.ex.list('train').filter(function (d) { return !!G().atlasDims(d); });
    return list.filter(function (d) { return d.pat !== true || E().schedule.totals(r, d).n > 0; });
  }

  function render(host, route) {
    var r = rec(), now = Date.now(), list = defs(r), p = route.params || {};
    var wrap = h('div.gm-atlas-screen');
    host.appendChild(wrap);
    try { if (PX.bus) PX.bus.emit('play:screen', { screen: 'atlas', mode: null, exId: null }); } catch (e) { /* a listener failed */ }
    var P = PX.ui.play;
    var lead = 'Each cell is a pair of settings. A cell is handled once your right answers there are more than guessing would explain (less than one time in ten). Cells fill from Train, Path, Speed, Free play, the Daily and the Climb.';
    wrap.appendChild(P && P.screenHead ? P.screenHead(null, 'Atlas', lead) : h('div.px-screen-head', h('h1', 'Atlas'), h('p.px-lead', lead)));
    if (!list.length) { wrap.appendChild(h('p', 'No exercise has an Atlas in this build.')); return null; }
    var tried = list.filter(function (d) { return E().schedule.totals(r, d).n > 0; });
    var pick = typeof p.ex === 'string' && PX.ex.get(p.ex) ? p.ex : uiRec().last && PX.ex.get(uiRec().last) ? uiRec().last : (tried[0] || list[0]).id;
    var chips = h('div.gm-atlas-chips', { role: 'tablist', 'aria-label': 'Exercises' });
    var body = h('div.gm-atlas-body');
    list.forEach(function (def) {
      var at = G().atlas(r, def), on = def.id === pick;
      var b = h('button.gm-chip', { type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false', 'data-atlas-ex': def.id },
        h('span', nameOf(def)), h('span.px-num.gm-chip-n', at.handled + '/' + at.total));
      if (!E().schedule.totals(r, def).n) b.classList.add('is-untried');
      b.addEventListener('click', function () {
        uiRec().last = def.id;
        try { store.save(); } catch (e) { /* later */ }
        Array.prototype.forEach.call(chips.children, function (c) { c.setAttribute('aria-selected', c === b ? 'true' : 'false'); });
        show(def);
      });
      chips.appendChild(b);
    });
    wrap.appendChild(chips);
    wrap.appendChild(body);
    function show(def) { ui.clear(body); body.appendChild(sheet(rec(), def, Date.now())); }
    show(PX.ex.get(pick));
    var on = chips.querySelector('[aria-selected="true"]');
    if (on && chips.scrollWidth > chips.clientWidth) { try { chips.scrollLeft = Math.max(0, on.offsetLeft - 16); } catch (e) { /* ignore */ } }
    wrap.appendChild(h('div.pl-summary-actions', ui.button('Progress', { kind: 'ghost', go: 'progress' }), ui.button('Back to Today', { kind: 'ghost', go: 'home' })));
    return null;
  }

  // One exercise's survey sheet: the grid, its legend and its firsts.
  function sheet(r, def, now) {
    var at = G().atlas(r, def), ad = G().atlasDims(def), K = PX.ui.kit;
    var p = K.panel({ title: nameOf(def), className: 'gm-panel gm-atlas-sheet', aside: h('span.px-num', at.handled + ' of ' + at.total + ' cells handled') });
    p.el.setAttribute('data-atlas', def.id);
    var st = E().est.get(r, def, { display: 'large' }, now), aim = st && st.n > 0 ? E().est.bRef(def, st.mu) : null;
    var ease = G().cellEase(def), wr = st && st.n > 0 ? G().withinReach(r, now, def.id) : null;
    var seen = uiRec().seen || (uiRec().seen = {}), seenAt = isNum(seen[def.id]) ? seen[def.id] : 0;
    var fresh = (r.game && Array.isArray(r.game.firsts) ? r.game.firsts : []).filter(function (f) { return G().firstOk(f) && f.ex === def.id && !f.old && f.at > seenAt; }).map(function (f) { return f.cell; });
    var cols = at.cols, rows = at.rows;
    // a static chart, not a widget: table semantics (a screen reader reads each cell's words)
    var grid = h('div.gm-atlas-grid', { role: 'table', 'aria-label': nameOf(def) + ': ' + (ad.dims[0].label || ad.dims[0].key) + (ad.dims[1] ? ' by ' + (ad.dims[1].label || ad.dims[1].key) : ''), style: '--cols:' + cols });
    var animated = 0;
    for (var j = rows - 1; j >= 0; j--) {
      var row = h('div.gm-atlas-row', { role: 'row' });
      if (ad.dims[1]) row.appendChild(h('div.gm-atlas-ylab', { role: 'rowheader' }, dimLabel(def, ad.dims[1], j)));
      for (var i = 0; i < cols; i++) {
        var key = i + '.' + j, c = at.cells[key], e = ease[key];
        var state = c && c.handled ? 'handled' : c ? 'tried' : 'unseen';
        var band = aim !== null && e && Math.abs(e.b - aim) <= 0.5;
        var cell = h('div.gm-cell', { role: 'cell', 'data-cell': key, 'data-state': state, 'aria-label': GU().cellText(def, i, j) + ': ' + (state === 'handled' ? 'handled' : state === 'tried' ? 'tried, ' + c.r + ' of ' + c.n + ' right' : e ? 'not tried yet' : 'not in the automatic mix') },
          h('span.gm-cell-mark', { 'aria-hidden': 'true' }));
        if (!e) cell.classList.add('is-out');
        if (band) cell.classList.add('is-band');
        if (wr && wr.cell === key) { cell.classList.add('is-reach'); cell.setAttribute('data-reach', ''); }
        if (state === 'handled' && fresh.indexOf(key) >= 0 && animated < 12) { GU().fx.run(cell, 'gm-fx-flip gm-fx-d' + Math.min(animated, 11), 200 + 40 * animated); animated++; }
        row.appendChild(cell);
      }
      grid.appendChild(row);
    }
    var xl = h('div.gm-atlas-xlabs', { 'aria-hidden': 'true' }, ad.dims[1] ? h('span.gm-atlas-ylab') : null);
    for (var x = 0; x < cols; x++) xl.appendChild(h('span.gm-atlas-xlab', shortVal(ad.dims[0], x)));
    var xt = h('div.gm-atlas-xtitle', { 'aria-hidden': 'true' }, ad.dims[1] ? h('span.gm-atlas-ylab') : null, h('span', (ad.dims[0].label || ad.dims[0].key) + ' →'));
    p.body.appendChild(h('div.gm-atlas-scroll', grid, xl, xt));
    p.body.appendChild(h('ul.gm-legend', h('li', h('span.gm-cell.gm-key', { 'data-state': 'handled' }, h('span.gm-cell-mark')), 'handled'),
      h('li', h('span.gm-cell.gm-key', { 'data-state': 'tried' }, h('span.gm-cell-mark')), 'tried'),
      h('li', h('span.gm-cell.gm-key', { 'data-state': 'unseen' }, h('span.gm-cell-mark')), 'not yet'),
      aim !== null ? h('li', h('span.gm-cell.gm-key.is-band', { 'data-state': 'unseen' }, h('span.gm-cell-mark')), 'at your level now') : null,
      wr ? h('li', h('span.gm-cell.gm-key.is-reach', { 'data-state': 'unseen' }, h('span.gm-cell-mark')), 'within reach') : null));
    if (wr) p.body.appendChild(h('p.gm-reachable', h('span.gm-k', 'Within reach '), GU().cellText(def, wr.i, wr.j) + '.'));
    var firsts = (r.game && Array.isArray(r.game.firsts) ? r.game.firsts : []).filter(function (f) { return G().firstOk(f) && f.ex === def.id && f.v === (def.version || 1); }).slice(-6).reverse();
    if (firsts.length) {
      p.body.appendChild(h('h3.gm-h3', 'Latest firsts'));
      p.body.appendChild(h('ul.gm-firsts', firsts.map(function (f) {
        var pp = f.cell.split('.');
        return h('li', h('span.gm-first-k', 'First'), ' ', GU().cellText(def, +pp[0], +pp[1]), f.at ? h('span.px-meta', ' · ' + PX.util.fmtDate(f.at, 'short')) : null);
      })));
    }
    var foot = h('div.px-slot-foot');
    foot.appendChild(ui.button('Practise ' + nameOf(def), { kind: 'secondary', small: true, go: 'play?mode=train&exId=' + def.id + '&count=1' }));
    if (at.handled) foot.appendChild(GU().shareButton('Share this sheet', { kind: 'session', label: nameOf(def) + ' atlas', title: nameOf(def) + ' atlas: ' + at.handled + ' of ' + at.total + ' cells',
      lines: [at.handled + ' of ' + at.total + ' pairs of settings handled'], footer: 'Parallax ' + (PX.version || ''), text: 'Parallax · ' + nameOf(def) + ' atlas: ' + at.handled + ' of ' + at.total + ' cells · ' + GU().LINK }, 'atlas'));
    p.body.appendChild(foot);
    seen[def.id] = Date.now();
    try { store.save(); } catch (e) { /* later */ }
    return p.el;
  }

  PX.ui.screens = PX.ui.screens || {};
  PX.ui.screens.atlas = { title: 'Atlas', render: render };
  PX.ui.atlas = { sheet: sheet };
  void doc;
})(window.PX);
