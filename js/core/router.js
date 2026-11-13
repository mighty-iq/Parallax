/* PX.core.router: in-memory routing (ARCHITECTURE.md §1, §4; CLAUDE.md lessons).
   The route lives in memory. The URL hash is only a mirror ('#/exercise/rotate'), written
   with the location.hash setter inside try/catch, never with history.pushState/replaceState
   (they throw in sandboxed srcdoc frames). location.replace('#…') is avoided too: in a
   srcdoc frame it resolves against the parent's URL and navigates the frame away.

   go(route, params?, opts?) → true when the route is valid
       route: 'home' | 'play' | 'library' | 'exercise/<id>' | 'progress' | 'log' | 'lab' |
       'settings' | 'about', optionally with a query: 'play?mode=daily'. Unknown names go home.
       params: any object (kept in memory; only string/number/boolean values reach the hash).
       opts: { mirror: false } skips the hash write; { force: true } notifies even if unchanged.
   current() → { route: 'exercise/rotate', name: 'exercise', arg: 'rotate', params: {} }
   on(fn(cur, prev)) → off     also emitted on PX.bus as 'route' { cur, prev }
   fromHash() → the route the URL hash names (deep link at boot), or null
   parse(text) → { route, name, arg, params } or null
   guard: null or fn(route) → route | null, set by the app: applied to hashes the person goes to
       (back, forward, a typed hash), never to the app's own routes; null opens Today. js/ui/app.js
       uses it so a #/play hash never starts a session by itself (I1 T4), as at boot.

   One delegated click listener handles every [data-go] element: data-go="exercise/rotate"
   (query allowed: data-go="play?mode=daily"). Use it on <button> or <a> elements so the
   keyboard can reach them; the default action (a hash link) is prevented. */
(function (PX) {
  'use strict';

  var win = window;
  var NAMES = ['home', 'play', 'library', 'exercise', 'progress', 'log', 'lab', 'settings', 'about'];
  var SEG_RE = /^[A-Za-z0-9_-]{1,64}$/;
  var hasOwn = Object.prototype.hasOwnProperty;

  var cur = { route: 'home', name: 'home', arg: null, params: {} };
  var listeners = [];
  var lastHash = null;   // the hash this router wrote last (its hashchange is ignored)
  var mirrorOn = true;

  function decode(s) {
    try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { return s; }
  }

  function parse(text) {
    if (typeof text !== 'string') return null;
    var s = text.replace(/^#?\/?/, '');
    var q = s.indexOf('?'), query = '';
    if (q >= 0) { query = s.slice(q + 1); s = s.slice(0, q); }
    s = s.replace(/\/+$/, '');
    var parts = s ? s.split('/') : ['home'];
    var name = parts[0];
    if (NAMES.indexOf(name) < 0) return null;
    var rest = parts.slice(1);
    for (var i = 0; i < rest.length; i++) if (!SEG_RE.test(rest[i])) return null;
    var arg = rest.length ? rest.join('/') : null;
    if (name === 'exercise' && !arg) return null;
    var params = {};
    if (query) {
      query.split('&').forEach(function (kv) {
        if (!kv) return;
        var eq = kv.indexOf('=');
        var k = decode(eq < 0 ? kv : kv.slice(0, eq));
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
        params[k] = eq < 0 ? '' : decode(kv.slice(eq + 1));
      });
    }
    return { route: arg ? name + '/' + arg : name, name: name, arg: arg, params: params };
  }

  function hashFor(r) {
    var q = [];
    Object.keys(r.params).sort().forEach(function (k) {
      var v = r.params[k], t = typeof v;
      if (t === 'string' || t === 'number' || t === 'boolean') q.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    });
    return '#/' + r.route + (q.length ? '?' + q.join('&') : '');
  }

  function readHash() {
    try { return win.location ? String(win.location.hash || '') : ''; } catch (e) { return ''; }
  }

  function writeHash(h) {
    if (!mirrorOn) return;
    try {
      if (!win.location || win.location.hash === h) return;
      lastHash = h;
      win.location.hash = h; // fragment navigation in the same document (also in srcdoc frames)
    } catch (e) {
      mirrorOn = false; // blocked here: stop trying, routing works without it
    }
  }

  function same(a, b) {
    if (a.route !== b.route) return false;
    var ka = Object.keys(a.params), kb = Object.keys(b.params);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) if (!hasOwn.call(b.params, ka[i]) || a.params[ka[i]] !== b.params[ka[i]]) return false;
    return true;
  }

  function copyParams(p) {
    var out = {};
    if (p && typeof p === 'object') for (var k in p) if (hasOwn.call(p, k)) out[k] = p[k];
    return out;
  }

  function go(route, params, opts) {
    opts = opts || {};
    var r = parse(String(route == null ? 'home' : route)), ok = !!r;
    if (!r) {
      if (typeof console !== 'undefined') console.warn('PX.core.router: unknown route ' + JSON.stringify(route) + '; going home');
      r = parse('home');
    }
    var p = r.params;
    if (params && typeof params === 'object') {
      for (var k in params) if (hasOwn.call(params, k)) p[k] = params[k];
    }
    var next = { route: r.route, name: r.name, arg: r.arg, params: p };
    if (opts.mirror !== false) writeHash(hashFor(next));
    if (!opts.force && same(next, cur)) return ok;
    var prev = cur;
    cur = next;
    var list = listeners.slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i](current(), prev); } catch (e) {
        if (typeof console !== 'undefined') console.error('PX.core.router listener failed:', e);
      }
    }
    if (PX.bus) PX.bus.emit('route', { cur: current(), prev: prev });
    return ok;
  }

  function current() {
    return { route: cur.route, name: cur.name, arg: cur.arg, params: copyParams(cur.params) };
  }

  function on(fn) {
    listeners.push(fn);
    return function off() {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function fromHash() {
    var h = readHash();
    return h && h !== '#' ? parse(h) : null;
  }

  function onHashChange() {
    var h = readHash();
    if (h === lastHash) return; // our own mirror write
    lastHash = null;
    var r = h && h !== '#' ? parse(h) : null;
    if (r && typeof api.guard === 'function') {
      var g;
      try { g = api.guard(r); } catch (e) { g = r; }
      if (!g) { go('home', null, { force: true }); return; } // mirrored, so the hash says #/home
      r = g;
    }
    if (r) go(r.route, r.params, { mirror: false }); // back/forward or a typed hash
  }

  function closestGo(node) {
    while (node && node.nodeType !== 1) node = node.parentNode;
    if (!node) return null;
    if (node.closest) return node.closest('[data-go]');
    while (node && node.nodeType === 1) {
      if (node.hasAttribute && node.hasAttribute('data-go')) return node;
      node = node.parentNode;
    }
    return null;
  }

  function onClick(e) {
    if (e.defaultPrevented || (e.button !== undefined && e.button !== 0)) return;
    var el = closestGo(e.target);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault(); // a hash link would leave a srcdoc frame
    go(el.getAttribute('data-go'));
  }

  if (win.document && win.document.addEventListener) win.document.addEventListener('click', onClick);
  try { if (win.addEventListener) win.addEventListener('hashchange', onHashChange); } catch (e) { /* mirror only */ }

  var api = PX.core.router = {
    go: go, current: current, on: on, fromHash: fromHash, parse: parse, NAMES: NAMES,
    mirror: function (on) { if (on !== undefined) mirrorOn = !!on; return mirrorOn; },
    guard: null,
  };
})(window.PX);
