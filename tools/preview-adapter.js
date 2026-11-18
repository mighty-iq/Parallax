/* preview-adapter.js: only for a private test-build preview served by the Claude artifact host.
   tools/build-preview.mjs appends it to a copy of dist/Parallax.html; the app, the repository's
   pages and the single-file build never contain it.

   When the host offers its database (claude.use('db') resolves to a namespace), the playtest
   report (PX.ui.playtest.report(), the same text as "Copy playtest report") is saved to the
   document playtest/<device>, where <device> is a random id kept in this browser, so the lead can
   read the ratings and notes without a paste. Elsewhere it does nothing.

   It changes nothing in the app and adds no work while an item is on screen (body.px-item, which
   covers every stimulus): a save waits until the item is gone. A save follows a few seconds after a new rating, note,
   error, session or visit (checked when the screens change and every 30 s), and once more when
   the page is hidden; one at a time. One short notice ("saved for the lead") follows the first
   save that holds a new rating or note. Declare the page with
   { db: { rules: [{ path: 'playtest', read: 'admin', write: 'owner' }] }, user: {} }. */
(function () {
  'use strict';
  var w = window;
  if (!w.claude || typeof w.claude.use !== 'function') return;

  var KEY = 'px-preview-device', DOC = 'playtest/';
  var dev = '';
  try { dev = w.localStorage.getItem(KEY) || ''; } catch (e) { /* storage blocked */ }
  if (!/^[a-z0-9]{6,12}$/.test(dev)) {
    dev = Math.random().toString(36).slice(2, 10) || 'device';
    try { w.localStorage.setItem(KEY, dev); } catch (e) { /* this visit only */ }
  }

  var ref = null, timer = 0, inFlight = false, dead = false, retried = false;
  var lastBody = '', lastSig = '', lastMarks = -1, noticed = false;

  function pt() { return w.PX && w.PX.ui && w.PX.ui.playtest; }
  function stim() { var b = document.body; return !!(b && (b.classList.contains('px-item') || b.classList.contains('px-stim'))); }
  function soon(ms, force) { if (dead) return; clearTimeout(timer); timer = setTimeout(function () { save(force); }, ms); }
  function marks(c) { return c ? (c.ratings || 0) + (c.notes || 0) : 0; }

  function save(force) {
    timer = 0;
    var P = pt();
    if (!ref || dead || !P || typeof P.on !== 'function' || !P.on()) return;
    if (stim()) { soon(4000, force); return; }
    if (inFlight) { soon(3000, force); return; }
    var counts, sig;
    try { counts = P.counts(); sig = JSON.stringify(counts); } catch (e) { return; }
    if (!force && sig === lastSig) return;
    var text;
    try { text = String(P.report()); } catch (e) { return; }
    var body = text.split('\n').slice(1).join('\n'); // the first line carries the current time
    if (body === lastBody) { lastSig = sig; return; }
    var newMark = marks(counts) > lastMarks && lastMarks >= 0;
    inFlight = true;
    ref.set({
      updatedAt: new Date().toISOString(),
      version: String(w.PX.version || ''),
      counts: counts || null,
      report: text.length > 400000 ? text.slice(0, 400000) + '\n[cut at 400 000 characters]' : text,
    }).then(function () {
      inFlight = false;
      retried = false;
      lastBody = body;
      lastSig = sig;
      lastMarks = marks(counts);
      if (newMark && !noticed && !stim() && w.PX.ui && typeof w.PX.ui.toast === 'function') {
        noticed = true;
        w.PX.ui.toast('Playtest notes saved for the lead. Copy playtest report still works.', { kind: 'ok', ms: 3500 });
      }
    }, function (err) {
      inFlight = false;
      var code = err && err.code;
      if (code === 'unavailable' && !retried) { retried = true; soon(15000, force); return; }
      if (code === 'permission-denied' || code === 'unauthenticated' || code === 'failed-precondition') dead = true;
    });
  }

  function hook() {
    var bus = w.PX && w.PX.bus;
    if (bus && typeof bus.on === 'function') {
      ['play:summary', 'play:session', 'play:wtg', 'route', 'settings'].forEach(function (ev) {
        bus.on(ev, function () { soon(2500); });
      });
    }
    setInterval(function () { if (!timer) soon(0); }, 30000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && !stim()) { clearTimeout(timer); timer = 0; save(true); }
    });
    var P = pt();
    try { lastMarks = P && P.counts ? marks(P.counts()) : 0; } catch (e) { lastMarks = 0; }
    soon(5000, true);
  }

  var limit = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 10000); });
  Promise.race([w.claude.use('db'), limit]).then(function (db) {
    if (!db || typeof db.doc !== 'function') return;
    try { ref = db.doc(DOC + dev); } catch (e) { return; }
    var wait = setInterval(function () {
      if (w.PX && w.PX.ui && w.PX.ui.playtest && document.documentElement.getAttribute('data-px-ready') === '1') {
        clearInterval(wait);
        hook();
      }
    }, 500);
  }, function () { /* no database here */ });
})();
