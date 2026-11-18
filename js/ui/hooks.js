/* PX.ui.hooks: the hook points of the player and the screens (v1.2 wave 2; docs/dev/CONTRACT-v1.2.md R).
   The first file of js/ui, so every screen module can register at load. Builders of wave 2 mount their
   cards, panels and lines here and never edit the screen files (play.js, home.js, library.js,
   settings.js, lab.js, progress.js, about.js), whose owner places the calls.

     on(point, fn, { id, order }) → off   id: a unique name such as 'plateau.card'; order: lower first
                                          (default 50; ties in registration order)
     run(point, ctx) → Promise<value|null> async points: handlers in order; the first result that is
                                          not null or undefined ends the run and is returned
     collect(point, ctx) → [values]       sync points: every handler's result that is not null or
                                          undefined, in order (a handler may return a list: its items
                                          are added one by one)
     list(point) → [{ id, order }]        POINTS: the known points and whether each is async
     place(container, results, opts)      puts screen results ({ el, after, replace, order }) into a
                                          screen: after or in place of a part named by data-slot,
                                          data-section or title; the rest at the end (opts.before)
     screen(point, container, ctx, opts)  collect, then place (the screens' call sites)
   A handler that throws, rejects or (async) returns something that is not a promise or a value is
   skipped and reported as 'play:error' on PX.bus (playtest mode shows it). Points:
     session:start (async), item:before (async), item:notes, summary:panels, today:slots,
     today:session, exercise:lines, settings:sections, lab:panels, progress:panels, about:sections,
     item:reveal (reserved for milestone 5). Their context is CONTRACT-v1.2 R's table. */
(function (PX) {
  'use strict';

  var hasOwn = Object.prototype.hasOwnProperty;
  var POINTS = {
    'session:start': { async: true }, 'item:before': { async: true },
    'item:notes': { async: false }, 'summary:panels': { async: false }, 'today:slots': { async: false }, 'today:session': { async: false },
    'exercise:lines': { async: false }, 'settings:sections': { async: false }, 'lab:panels': { async: false }, 'progress:panels': { async: false },
    'about:sections': { async: false }, 'item:reveal': { async: false },
  };
  var LISTS = {};
  var seq = 0;

  function point(name, who) {
    if (typeof name !== 'string' || !hasOwn.call(POINTS, name)) throw new Error('PX.ui.hooks.' + who + ': unknown point ' + JSON.stringify(name) + ' (' + Object.keys(POINTS).join(', ') + ')');
    return LISTS[name] || (LISTS[name] = []);
  }
  function on(name, fn, opts) {
    var list = point(name, 'on');
    if (typeof fn !== 'function') throw new Error('PX.ui.hooks.on("' + name + '"): needs a function');
    var id = opts && typeof opts.id === 'string' && opts.id ? opts.id : null;
    if (!id) throw new Error('PX.ui.hooks.on("' + name + '"): opts.id (a unique name) is required');
    for (var i = 0; i < list.length; i++) if (list[i].id === id) throw new Error('PX.ui.hooks.on("' + name + '"): "' + id + '" is already registered');
    var h = { id: id, order: opts && typeof opts.order === 'number' && isFinite(opts.order) ? opts.order : 50, seq: ++seq, fn: fn };
    list.push(h);
    list.sort(function (a, b) { return a.order - b.order || a.seq - b.seq; });
    return function off() { var j = list.indexOf(h); if (j >= 0) list.splice(j, 1); };
  }
  function list(name) { return (LISTS[name] || []).map(function (h) { return { id: h.id, order: h.order }; }); }

  function report(name, h, e) {
    var msg = 'hook ' + h.id + ' at ' + name + ' failed: ' + String(e && e.message || e);
    try { if (window.console) console.error('PX.ui.hooks: ' + msg, e); } catch (x) { /* no console */ }
    try { if (PX.bus) PX.bus.emit('play:error', { where: 'hook:' + name + ':' + h.id, message: String(e && e.message || e) }); } catch (x) { /* a listener failed */ }
  }

  function collect(name, ctx) {
    var hs = point(name, 'collect').slice(), out = [];
    if (POINTS[name].async) throw new Error('PX.ui.hooks.collect: "' + name + '" is an async point (use run)');
    for (var i = 0; i < hs.length; i++) {
      var v;
      try { v = hs[i].fn(ctx); } catch (e) { report(name, hs[i], e); continue; }
      if (v === null || v === undefined) continue;
      if (Array.isArray(v)) v.forEach(function (x) { if (x !== null && x !== undefined) out.push(x); });
      else out.push(v);
    }
    return out;
  }

  function run(name, ctx) {
    var hs = point(name, 'run').slice();
    if (!POINTS[name].async) return Promise.reject(new Error('PX.ui.hooks.run: "' + name + '" is a sync point (use collect)'));
    var i = 0;
    function next() {
      if (i >= hs.length) return Promise.resolve(null);
      var h = hs[i++], p;
      try { p = Promise.resolve(h.fn(ctx)); } catch (e) { report(name, h, e); return next(); }
      return p.then(function (v) {
        return v === null || v === undefined ? next() : v;
      }, function (e) { report(name, h, e); return next(); });
    }
    return next();
  }

  /* ---------- placing a screen point's results (the screens' call sites) ---------- */

  // A part of a screen is named by its data-slot, its data-section or its title (a panel's
  // .px-panel-title, or a section's first h2).
  function named(node, name) {
    if (!node || node.nodeType !== 1 || typeof name !== 'string' || !name) return false;
    if (node.getAttribute('data-slot') === name || node.getAttribute('data-section') === name) return true;
    var t = node.querySelector('.px-panel-title, h2');
    return !!t && String(t.textContent || '').replace(/\s+/g, ' ').trim() === name;
  }
  // place(container, results, opts) → the elements placed, in order. A result is { el, after,
  // replace, order } (a bare element counts as { el }): replace takes the place of the child named
  // so (which is removed; its data-slot, data-section and id pass to el when el has none, and
  // opts.onReplace(el, old, name) may copy more); after follows that child (and what was placed
  // after it before); the rest, and any whose name matches nothing, go before opts.before (a child
  // of container) or at the end. Results for one place keep their order (order, default 50, then
  // as given).
  function place(container, results, opts) {
    opts = opts || {};
    var placed = [];
    if (!container || !Array.isArray(results)) return placed;
    var list = results.map(function (r, i) {
      var x = r && r.nodeType === 1 ? { el: r } : r;
      if (!x || !x.el || x.el.nodeType !== 1) return null;
      return { el: x.el, after: x.after, replace: x.replace, order: typeof x.order === 'number' && isFinite(x.order) ? x.order : 50, i: i };
    }).filter(Boolean).sort(function (a, b) { return a.order - b.order || a.i - b.i; });
    var tail = {};
    list.forEach(function (x) {
      var rep = typeof x.replace === 'string' && x.replace ? x.replace : null;
      var name = rep || (typeof x.after === 'string' && x.after ? x.after : null), ref = null;
      if (name && tail[name] && tail[name].parentNode === container) ref = tail[name];
      var kids = Array.prototype.slice.call(container.children || []);
      if (!ref && name) for (var c = 0; c < kids.length; c++) if (kids[c] !== x.el && named(kids[c], name)) { ref = kids[c]; break; }
      try {
        if (ref && rep && ref !== tail[name]) {
          ['data-slot', 'data-section'].forEach(function (a) { if (ref.hasAttribute(a) && !x.el.hasAttribute(a)) x.el.setAttribute(a, ref.getAttribute(a)); });
          if (ref.id && !x.el.id) { var id = ref.id; ref.removeAttribute('id'); x.el.id = id; }
          if (typeof opts.onReplace === 'function') opts.onReplace(x.el, ref, name);
          container.insertBefore(x.el, ref);
          container.removeChild(ref);
        } else if (ref) container.insertBefore(x.el, kids[kids.indexOf(ref) + 1] || null);
        else container.insertBefore(x.el, opts.before && opts.before.parentNode === container ? opts.before : null);
      } catch (e) { report('place', { id: name || '(end)' }, e); return; }
      if (name) tail[name] = x.el;
      placed.push(x.el);
    });
    return placed;
  }
  // screen(point, container, ctx, opts): collect(point, ctx), then place the results (above).
  function screen(name, container, ctx, opts) {
    var res = [];
    try { res = collect(name, ctx); } catch (e) { report(name, { id: '(collect)' }, e); res = []; }
    return place(container, res, opts);
  }

  PX.ui.hooks = { on: on, run: run, collect: collect, list: list, place: place, screen: screen, POINTS: POINTS };
})(window.PX);
