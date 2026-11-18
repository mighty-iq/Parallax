/* PX.ui.playtest: playtest mode (v1.2 milestone 2; docs/dev/CONTRACT-v1.2.md G; the owner's
   standing rules, "Interactive check-ins"). It is for the person testing a build: three taps after
   each exercise (fun, clarity, difficulty), a note button on every screen, and "Copy playtest
   report": one text that sets the ratings and notes beside what explains them (device, frame
   timing, errors, results, play time, and the screen where each visit stopped).

   BUILD is the one switch for a release: 'test' builds have playtest mode on by default; set it
   to 'release' and playtest mode waits behind its Settings switch, off by default. The setting
   `playtest` is 'auto' (follow BUILD), 'on' or 'off'. Under browser automation (navigator.webdriver)
   'auto' means off, so the app's own browser tests see the release behaviour unless they switch
   the mode on.

   What it listens to (PX.bus, emitted by js/ui/play.js): play:screen { screen, mode, exId },
   play:trial { mode, exId, practice, outcome, rtMs, timeout, voidReason, display, input, frames,
   presentMs }, play:summary { mode, exIds, res, slot, wrap }, play:wtg { exId, result, slot },
   play:session { mode, ended, practiceMs, answered, right, exIds }, play:error { where, message };
   and route, app:ready, settings. Window errors and frame sampling are its own: short bursts of
   requestAnimationFrame outside stimuli, never while body.px-stim is set (a burst that meets one
   is dropped).

   Its log is the record field `playtest`, private: left out of backups unless device details are
   on, and never in the pooled export (store.exportRule). Nothing is recorded while the mode is off.

   PX.ui.playtest
     BUILD                 'test' | 'release'
     on() → bool           playtest mode is active now
     set(on)               the Settings switch ('on' / 'off')
     rateRow(o) → element  three taps for one exercise: { exId, mode, key, label }
     noteButton(label) → element | null   a "Playtest note" button for other screens (the pause
                           sheet); null while the mode is off
     openNote(label)       the note sheet for the current screen (label: what the screen is)
     report() → string     the playtest report
     copyReport() → Promise<bool>   copies it (async clipboard, then execCommand); when both are
                           blocked it opens the text, selected, with a Copy button
     showReport(blocked?)  the report in a dialog with Copy
     clear()               empties the log
     counts() → { ratings, notes, errors, sessions, visits }
     where() → string      the current screen as the log names it */
(function (PX) {
  'use strict';

  var BUILD = 'test'; // ← 'release' at release (CLAUDE.md, "Releasing")

  // PX.ui's DOM helpers are used at run time only, so the log and the report also run in Node tests.
  var ui = PX.ui = PX.ui || {}, bus = PX.bus, store = PX.core.store, win = window, doc = window.document;
  function h() { return ui.h.apply(null, arguments); }
  var hasOwn = Object.prototype.hasOwnProperty;
  var CAP = { ratings: 400, notes: 200, errors: 100, frames: 60, sessions: 100, visits: 60, trail: 40, rts: 60 };
  var NOTE_MAX = 1000;

  /* ---------- the setting and the log ---------- */

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function str(x, max) { return typeof x === 'string' ? x.slice(0, max || 200) : null; }
  function list(v, fn, cap) {
    if (!Array.isArray(v)) return [];
    var out = [];
    v.forEach(function (x) { var y = fn(x); if (y !== undefined) out.push(y); });
    return out.slice(-cap);
  }
  function blank() {
    return { v: 1, first: 0, ratings: [], notes: [], errors: [], frames: [], stim: {}, ex: {}, sessions: [], visits: [], trail: [] };
  }
  var LEVEL = [1, 2, 3, 4, 5];
  var DIFF = ['easy', 'right', 'hard'];
  function fix(v) {
    if (!isObj(v)) return undefined;
    var out = blank();
    out.first = isNum(v.first) ? v.first : 0;
    out.ratings = list(v.ratings, function (r) {
      if (!isObj(r) || !isNum(r.t) || !str(r.ex, 40)) return undefined;
      return { t: r.t, k: str(r.k, 60) || '', ex: str(r.ex, 40), mode: str(r.mode, 20) || '',
        fun: LEVEL.indexOf(r.fun) >= 0 ? r.fun : null, clarity: LEVEL.indexOf(r.clarity) >= 0 ? r.clarity : null,
        diff: DIFF.indexOf(r.diff) >= 0 ? r.diff : null };
    }, CAP.ratings);
    out.notes = list(v.notes, function (n) {
      return isObj(n) && isNum(n.t) && str(n.text, NOTE_MAX) ? { t: n.t, where: str(n.where, 120) || '', text: str(n.text, NOTE_MAX) } : undefined;
    }, CAP.notes);
    out.errors = list(v.errors, function (e) {
      return isObj(e) && isNum(e.t) && str(e.message, 300) ? { t: e.t, where: str(e.where, 120) || '', message: str(e.message, 300), n: isNum(e.n) ? e.n : 1, at: str(e.at, 120) || '' } : undefined;
    }, CAP.errors);
    out.frames = list(v.frames, function (f) { return Array.isArray(f) && f.length === 9 && f.every(function (x, i) { return i === 1 ? typeof x === 'string' : isNum(x); }) ? f : undefined; }, CAP.frames);
    out.sessions = list(v.sessions, function (s) {
      if (!isObj(s) || !isNum(s.t)) return undefined;
      return { t: s.t, mode: str(s.mode, 20) || '', ended: str(s.ended, 20) || '', ms: num(s.ms), answered: num(s.answered), right: num(s.right),
        ex: Array.isArray(s.ex) ? s.ex.filter(function (x) { return typeof x === 'string'; }).map(function (x) { return x.slice(0, 40); }).slice(0, 12) : [] };
    }, CAP.sessions);
    out.visits = list(v.visits, function (s) {
      return isObj(s) && isNum(s.start) ? { start: s.start, ms: num(s.ms), last: str(s.last, 120) || '?', lastAt: isNum(s.lastAt) ? s.lastAt : s.start } : undefined;
    }, CAP.visits);
    out.trail = list(v.trail, function (s) { return Array.isArray(s) && isNum(s[0]) && typeof s[1] === 'string' ? [s[0], s[1].slice(0, 120)] : undefined; }, CAP.trail);
    var EXF = ['n', 'right', 'practice', 'timeouts', 'voids'], STF = ['trials', 'medSum', 'p95Max', 'gapMax', 'dropped', 'stutter'];
    [['ex', EXF], ['stim', STF]].forEach(function (kf) {
      var k = kf[0];
      if (!isObj(v[k])) return;
      Object.keys(v[k]).slice(0, 80).forEach(function (id) {
        var x = v[k][id];
        if (!/^[a-z][a-z0-9-]{0,39}$/.test(id) || !isObj(x)) return;
        var y = {};
        kf[1].forEach(function (f) { y[f] = num(x[f]); });
        if (k === 'ex') y.rts = Array.isArray(x.rts) ? x.rts.filter(isNum).slice(-CAP.rts) : [];
        out[k][id] = y;
      });
    });
    return out;
  }
  function num(x) { return isNum(x) && x >= 0 ? x : 0; }

  var registered = false;
  if (store) {
    try {
      store.setting('playtest', { def: 'auto', type: 'enum', values: ['auto', 'on', 'off'] });
      store.field('playtest', blank, fix);
      if (typeof store.exportRule === 'function') store.exportRule('playtest', { private: true, pooled: false });
      registered = true;
    } catch (e) { if (win.console) console.warn('PX.ui.playtest: not registered: ' + (e && e.message)); }
  }

  var ready = false;
  // Browser automation (navigator.webdriver) gets the release behaviour unless a test switches the
  // mode on: a floating button must not catch the clicks of the app's own browser tests.
  function automated() { try { return !!(win.navigator && win.navigator.webdriver); } catch (e) { return false; } }
  function on() {
    if (!registered || !ready) return false;
    var s = store.state.settings.playtest;
    return s === 'on' || (s !== 'off' && BUILD === 'test' && !automated());
  }
  function log() {
    var R = store.state;
    if (!isObj(R.playtest)) R.playtest = blank();
    var L = R.playtest;
    if (!L.first) L.first = Date.now();
    return L;
  }
  function push(arr, x, cap) { arr.push(x); if (arr.length > cap) arr.splice(0, arr.length - cap); return x; }
  function save() { try { store.save(); } catch (e) { /* the next save writes it */ } }

  /* ---------- where the player is ---------- */

  var here = 'starting', hereEx = null, visit = null, visibleSince = 0;
  function routeName(cur) {
    if (!cur) return 'unknown';
    var p = cur.params || {}, out = cur.name || 'unknown';
    if (cur.arg) out += ':' + cur.arg;
    if (p.mode) out += ' (' + p.mode + (p.exId ? ' ' + p.exId : '') + ')';
    return out;
  }
  function setWhere(w, exId) {
    here = String(w).slice(0, 120);
    hereEx = exId || null;
    if (!on()) return;
    var L = log(), now = Date.now(), tr = L.trail, last = tr[tr.length - 1];
    if (!last || last[1] !== here) push(tr, [now, here], CAP.trail);
    if (visit) { tick(now); visit.last = here; visit.lastAt = now; }
    save();
  }
  function where() { return here; }

  // Visible time of this visit (a page load), and where it ended.
  function tick(now) {
    if (!visit || !visibleSince) return;
    visit.ms += Math.max(0, now - visibleSince);
    visibleSince = now;
  }
  function startVisit() {
    var L = log(), now = Date.now();
    visit = push(L.visits, { start: now, ms: 0, last: here, lastAt: now }, CAP.visits);
    visibleSince = doc.visibilityState === 'hidden' ? 0 : now;
    save();
  }
  doc.addEventListener('visibilitychange', function () {
    if (!on() || !visit) return;
    var now = Date.now();
    if (doc.visibilityState === 'hidden') {
      tick(now);
      visibleSince = 0;
      visit.lastAt = now;
      save();
      try { store.flush({ evenIfHeld: true }); } catch (e) { /* the store writes on hide too */ }
    } else visibleSince = now;
  });

  /* ---------- errors (the module's own window listeners, plus the player's log) ---------- */

  var early = [];
  function addError(where, message, at) {
    var e = { t: Date.now(), where: String(where || '').slice(0, 120), message: String(message || 'unknown error').slice(0, 300), at: String(at || '').slice(0, 120), n: 1 };
    if (!ready) { if (early.length < 20) early.push(e); return; }
    if (!on()) return;
    var L = log(), last = L.errors[L.errors.length - 1];
    if (last && last.message === e.message && last.where === e.where) { last.n++; last.t = e.t; } else push(L.errors, e, CAP.errors);
    save();
  }
  function fileOf(f) { return f ? String(f).split('/').pop().split('?')[0] : ''; } // the file name only, never a folder path
  win.addEventListener('error', function (ev) {
    if (!ev || ev.target !== win && ev.target && ev.target.tagName) return; // a failed image or script load: not a script error
    addError(here, ev.message || (ev.error && ev.error.message), fileOf(ev.filename) + (ev.lineno ? ':' + ev.lineno : ''));
  });
  win.addEventListener('unhandledrejection', function (ev) {
    var r = ev && ev.reason;
    addError(here, 'unhandled promise: ' + (r && r.message ? r.message : String(r)), '');
  });
  bus.on('play:error', function (e) { addError(e && e.where ? 'play: ' + e.where : here, e && e.message, ''); });

  /* ---------- frame timing (own samples, outside stimuli) ---------- */

  var lastSample = 0, sampling = false;
  function stim() { return !!(doc.body && doc.body.classList.contains('px-stim')); }
  function quantile(sorted, q) { if (!sorted.length) return 0; var i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1)))); return sorted[i]; }
  function sample(label) {
    if (sampling || !on() || stim() || doc.visibilityState === 'hidden' || typeof win.requestAnimationFrame !== 'function') return;
    sampling = true;
    lastSample = Date.now();
    var times = [], N = 91;
    function frame(t) {
      if (stim() || doc.visibilityState === 'hidden') { sampling = false; return; } // a stimulus started: drop it
      times.push(t);
      if (times.length < N) { win.requestAnimationFrame(frame); return; }
      sampling = false;
      var d = [];
      for (var i = 1; i < times.length; i++) d.push(times[i] - times[i - 1]);
      var s = d.slice().sort(function (a, b) { return a - b; }), med = quantile(s, 0.5);
      var mean = d.reduce(function (a, b) { return a + b; }, 0) / d.length;
      var sd = Math.sqrt(d.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / d.length);
      var long = d.filter(function (x) { return x > med * 1.5; }).length / d.length;
      var r1 = function (x) { return Math.round(x * 10) / 10; };
      push(log().frames, [Date.now(), String(label).slice(0, 60), d.length, Math.round(1000 / (med || 16.7)), r1(med), r1(quantile(s, 0.95)), r1(quantile(s, 0.99)), r1(sd), Math.round(long * 1000) / 10], CAP.frames);
      save();
    }
    win.requestAnimationFrame(frame);
  }
  function sampleSoon(label, ms) {
    win.setTimeout(function () { if (Date.now() - lastSample >= 20000) sample(label); }, ms || 700);
  }

  /* ---------- what the player does (play.js hooks) ---------- */

  function right(o) { return o === 1 || o === true || o === 'right'; }
  bus.on('play:screen', function (e) {
    if (!e) return;
    setWhere('play:' + (e.screen || '?') + (e.mode ? ' (' + e.mode + (e.exId ? ' ' + e.exId : '') + ')' : e.exId ? ' (' + e.exId + ')' : ''), e.exId);
  });
  bus.on('play:trial', function (e) {
    if (!on() || !e || !e.exId) return;
    var L = log(), id = String(e.exId).slice(0, 40);
    var x = L.ex[id] || (L.ex[id] = { n: 0, right: 0, practice: 0, timeouts: 0, voids: 0, rts: [] });
    if (e.practice) x.practice++;
    if (e.voidReason) x.voids++;
    else {
      x.n++;
      if (right(e.outcome)) { x.right++; if (isNum(e.rtMs)) { x.rts.push(Math.round(e.rtMs)); if (x.rts.length > CAP.rts) x.rts.splice(0, x.rts.length - CAP.rts); } }
    }
    if (e.timeout) x.timeouts++;
    var f = e.frames;
    if (isObj(f) && isNum(f.medianMs)) {
      var s = L.stim[id] || (L.stim[id] = { trials: 0, medSum: 0, p95Max: 0, gapMax: 0, dropped: 0, stutter: 0 });
      s.trials++;
      s.medSum += f.medianMs;
      if (isNum(f.p95Ms)) s.p95Max = Math.max(s.p95Max, f.p95Ms);
      if (isNum(f.maxGapMs)) s.gapMax = Math.max(s.gapMax, f.maxGapMs);
      if (isNum(f.dropped)) s.dropped += f.dropped;
      if (f.stutter) s.stutter++;
    }
    save();
  });
  bus.on('play:session', function (e) {
    if (!on() || !e) return;
    push(log().sessions, { t: Date.now(), mode: str(e.mode, 20) || '', ended: e.ended ? String(e.ended === true ? 'early' : e.ended).slice(0, 20) : '', ms: isNum(e.practiceMs) ? Math.round(e.practiceMs) : 0,
      answered: isNum(e.answered) ? e.answered : 0, right: isNum(e.right) ? e.right : 0, ex: Array.isArray(e.exIds) ? e.exIds.slice(0, 12) : [] }, CAP.sessions);
    save();
  });
  // Three taps per exercise at the top of a session's summary; the Daily and the check as a whole.
  bus.on('play:summary', function (e) {
    if (!on() || !e || !e.slot) return;
    var ids = e.mode === 'daily' || e.mode === 'check' ? [e.mode] : (Array.isArray(e.exIds) ? e.exIds : []);
    if (!ids.length) return;
    var key = 's' + Date.now().toString(36);
    var box = h('div.pt-rate-box', { 'data-playtest': 'summary' },
      h('p.pt-rate-head', h('b', 'Playtest'), ' · three taps per exercise: fun, clarity, difficulty'));
    ids.forEach(function (id) { box.appendChild(rateRow({ exId: id, mode: e.mode, key: key })); });
    e.slot.appendChild(box);
  });
  bus.on('play:wtg', function (e) {
    if (!on() || !e || !e.slot || !e.exId) return;
    e.slot.appendChild(h('div.pt-rate-box', { 'data-playtest': 'wtg' },
      h('p.pt-rate-head', h('b', 'Playtest'), ' · how was this tutorial?'),
      rateRow({ exId: e.exId, mode: 'tutorial', key: 'w' + Date.now().toString(36) })));
  });
  bus.on('route', function (e) {
    var cur = e && e.cur;
    setWhere(routeName(cur), cur && cur.params && cur.params.exId);
    if (on()) sampleSoon(routeName(cur));
  });

  /* ---------- three taps ---------- */

  function nameOf(id) {
    if (id === 'daily') return 'Daily Challenge';
    if (id === 'check') return 'Spatial Check';
    var d = PX.ex && PX.ex.get ? PX.ex.get(id) : null;
    return d ? d.short || d.name : id;
  }
  var DIMS = [
    { key: 'fun', label: 'Fun', opts: LEVEL.map(function (n) { return { v: n, text: String(n), aria: 'fun ' + n + ' of 5' }; }), ends: ['dull', 'fun'] },
    { key: 'clarity', label: 'Clarity', opts: LEVEL.map(function (n) { return { v: n, text: String(n), aria: 'clarity ' + n + ' of 5' }; }), ends: ['confusing', 'clear'] },
    { key: 'diff', label: 'Difficulty', opts: [{ v: 'easy', text: 'Too easy' }, { v: 'right', text: 'Right' }, { v: 'hard', text: 'Too hard' }] },
  ];
  function entry(o) {
    var L = log(), k = o.key || '', r = null;
    for (var i = L.ratings.length - 1; i >= 0 && !r; i--) if (L.ratings[i].k === k && L.ratings[i].ex === o.exId) r = L.ratings[i];
    if (!r) r = push(L.ratings, { t: Date.now(), k: k, ex: String(o.exId).slice(0, 40), mode: String(o.mode || '').slice(0, 20), fun: null, clarity: null, diff: null }, CAP.ratings);
    return r;
  }
  // One tap: o = { exId, mode, key }, dim 'fun' | 'clarity' | 'diff'. → the rating entry, or null.
  function rate(o, dim, value) {
    if (!on() || !o || !o.exId) return null;
    var ok = dim === 'diff' ? DIFF.indexOf(value) >= 0 : (dim === 'fun' || dim === 'clarity') && LEVEL.indexOf(value) >= 0;
    if (!ok) return null;
    var r = entry(o);
    r[dim] = value;
    r.t = Date.now();
    save();
    return r;
  }

  function rateRow(o) {
    var row = h('div.pt-rate', { 'data-rate': o.exId, role: 'group', 'aria-label': 'Playtest ratings for ' + nameOf(o.exId) });
    row.appendChild(h('p.pt-rate-name', o.label || nameOf(o.exId)));
    var groups = h('div.pt-rate-dims');
    DIMS.forEach(function (d) {
      var seg = h('div.pt-rate-seg', { role: 'radiogroup', 'aria-label': d.label + (d.ends ? ' (1 ' + d.ends[0] + ', 5 ' + d.ends[1] + ')' : '') });
      d.opts.forEach(function (op) {
        var b = h('button.pt-rate-btn', { type: 'button', role: 'radio', 'aria-checked': 'false', 'data-dim': d.key, 'data-value': String(op.v), 'aria-label': op.aria || null }, op.text);
        b.addEventListener('click', function () {
          if (!rate(o, d.key, op.v)) return;
          Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
        });
        seg.appendChild(b);
      });
      groups.appendChild(h('div.pt-rate-dim', h('span.pt-rate-label', d.label), seg,
        d.ends ? h('span.pt-rate-ends', { 'aria-hidden': 'true' }, d.ends[0] + ' → ' + d.ends[1]) : null));
    });
    row.appendChild(groups);
    return row;
  }

  /* ---------- notes ---------- */

  function openNote(label) {
    var at = label || here;
    var id = 'pt-note-' + Date.now().toString(36);
    var ta = h('textarea.px-textarea.pt-note-text', { id: id, rows: '4', maxlength: String(NOTE_MAX), spellcheck: 'true', placeholder: 'What did you notice here? Anything confusing, broken, slow, too hard or fun.' });
    var count = h('p.px-meta.pt-note-count', countsText());
    var copy = ui.button('Copy playtest report', { kind: 'ghost', small: true, onClick: function () { copyReport(); } });
    copy.setAttribute('data-playtest', 'copy');
    var close = ui.modal({
      title: 'Playtest note', className: 'pt-sheet',
      body: [h('p.px-meta', h('span', 'About: '), h('span.px-num.pt-note-where', at)),
        h('label.px-sr', { for: id }, 'Your note'), ta, count, h('div.px-data-row', copy)],
      actions: [{ label: 'Cancel', value: 'cancel', kind: 'secondary' }, { label: 'Save note', value: 'save', kind: 'primary' }],
      onClose: function (v) {
        if (v !== 'save') return;
        var n = addNote(ta.value, at);
        if (n) ui.toast('Note saved (' + n + (n === 1 ? ' note' : ' notes') + ').', { kind: 'ok' });
      },
    });
    if (close.el) close.el.setAttribute('data-playtest-sheet', '');
    try { ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    return close;
  }

  // → the number of notes, or 0 when nothing was saved (empty text, mode off).
  function addNote(text, at) {
    var t = String(text || '').trim();
    if (!t || !on()) return 0;
    var L = log();
    push(L.notes, { t: Date.now(), where: String(at || here).slice(0, 120), text: t.slice(0, NOTE_MAX) }, CAP.notes);
    save();
    return L.notes.length;
  }

  function noteButton(label) {
    if (!on()) return null;
    var b = ui.button('Playtest note', { kind: 'ghost', small: true, className: 'pt-note-inline', onClick: function () { openNote(label); } });
    b.setAttribute('data-playtest', 'note');
    return b;
  }

  var fab = null;
  function syncFab() {
    var want = on();
    if (want && !fab && doc.body) {
      fab = h('button.pt-fab', { type: 'button', 'data-playtest': 'fab', 'aria-label': 'Playtest note about this screen', title: 'Playtest note about this screen' },
        pencil(), h('span.pt-fab-text', 'Note'));
      fab.addEventListener('click', function () { openNote(); });
      doc.body.appendChild(fab);
    } else if (!want && fab) {
      if (fab.parentNode) fab.parentNode.removeChild(fab);
      fab = null;
    }
  }
  function pencil() {
    var S = PX.core.svg, r = S.el('svg', { viewBox: '0 0 24 24', class: 'px-icon', 'aria-hidden': 'true', focusable: 'false' });
    r.appendChild(S.el('path', { d: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4' }));
    return r;
  }

  /* ---------- the report ---------- */

  function iso(t) { try { return new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; } catch (e) { return '?'; } }
  function hm(t) { try { return new Date(t).toISOString().slice(11, 16); } catch (e) { return '?'; } }
  function mins(ms) { return Math.round((ms || 0) / 6000) / 10 + ' min'; }
  function secs(ms) { return PX.util.fmtSecs ? PX.util.fmtSecs(ms) : (Math.round(ms / 100) / 10).toFixed(1) + ' s'; }
  function median(a) { if (!a || !a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor((s.length - 1) / 2)]; }
  function q(s) { return '"' + String(s).replace(/\s+/g, ' ').replace(/"/g, "'") + '"'; }
  function mq(x) { try { return !!(win.matchMedia && win.matchMedia(x).matches); } catch (e) { return false; } }

  function webgl() {
    try {
      var S3 = PX.core.stage3d;
      if (!S3 || !S3.available()) return 'unavailable' + (S3 && S3.reason && S3.reason() ? ' (' + S3.reason() + ')' : '');
      var r = S3.renderer(), gl = r && r.getContext ? r.getContext() : null, out = 'webgl2';
      var ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) out += ' ' + q(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
      return out;
    } catch (e) { return 'unknown'; }
  }
  function device() {
    var f = {}, n = win.navigator || {}, sc = win.screen || {};
    try { f = typeof store.deviceFacts === 'function' ? store.deviceFacts() : {}; } catch (e) { f = {}; }
    var d = PX.ui.welcome && PX.ui.welcome.device ? PX.ui.welcome.device() : {};
    var env = PX.ui.app && PX.ui.app.env ? PX.ui.app.env : {};
    var o = '';
    try { o = sc.orientation && sc.orientation.type ? sc.orientation.type : ''; } catch (e) { o = ''; }
    return [
      'ua ' + q(f.ua || n.userAgent || ''),
      'lang ' + (f.lang || n.language || '?') + ', tz ' + (f.tz || '?'),
      'screen ' + (f.screen || ((sc.width || 0) + 'x' + (sc.height || 0))) + ' dpr ' + (win.devicePixelRatio || 1) + ', viewport ' + (win.innerWidth || 0) + 'x' + (win.innerHeight || 0) + (o ? ' ' + o : ''),
      'pointer ' + (mq('(pointer: coarse)') ? 'coarse' : mq('(pointer: fine)') ? 'fine' : 'none') + ', touch points ' + (n.maxTouchPoints || 0) + ', hover ' + (mq('(hover: hover)') ? 'yes' : 'no'),
      'home screen ' + (d.standalone ? 'yes' : 'no') + ', in-app browser ' + (d.inApp ? 'yes' : 'no') + ', framed ' + (env.framed ? 'yes' : 'no') + (env.sandboxed ? ' (sandboxed)' : '') + ', ' + String(win.location && win.location.protocol || '?').replace(':', ''),
      'storage ' + (store.volatile ? 'memory only (' + (store.volatileReason || '?') + ')' : 'ok') + ', ' + webgl(),
      'motion ' + (PX.ui.app && PX.ui.app.motionReduced && PX.ui.app.motionReduced() ? 'reduced' : 'full') + ', theme ' + (PX.ui.app && PX.ui.app.isDark && PX.ui.app.isDark() ? 'dark' : 'light') + ', text ' + Math.round((store.state.settings.textScale || 1) * 100) + ' %, sound ' + (store.state.settings.sound ? 'on' : 'off'),
    ];
  }

  function report() {
    var L = log(), R = store.state, now = Date.now(), out = [];
    if (visit) tick(now);
    var visMs = L.visits.reduce(function (a, v) { return a + (v.ms || 0); }, 0);
    var prMs = L.sessions.reduce(function (a, s) { return a + (s.ms || 0); }, 0);
    out.push('PARALLAX PLAYTEST REPORT · v' + PX.version + ' (' + BUILD + ' build) · ' + iso(now));
    out.push('device: ' + device().join('; '));
    out.push('played: ' + L.visits.length + (L.visits.length === 1 ? ' visit, ' : ' visits, ') + mins(visMs) + ' on screen, ' + mins(prMs) + ' of practice in ' + L.sessions.length + (L.sessions.length === 1 ? ' session' : ' sessions') + (L.first ? '; log since ' + iso(L.first) : '') + '; record: ' + (R.sessions || []).length + ' sessions, ' + (R.trials || []).length + ' trials');
    out.push('ratings (fun 1-5, clarity 1-5, difficulty):' + (L.ratings.length ? '' : ' none'));
    L.ratings.forEach(function (r) {
      out.push('  ' + hm(r.t) + ' ' + nameOf(r.ex) + ' [' + r.mode + ']: fun ' + (r.fun || '-') + ', clarity ' + (r.clarity || '-') + ', difficulty ' + (r.diff || '-'));
    });
    out.push('notes:' + (L.notes.length ? '' : ' none'));
    L.notes.forEach(function (n) { out.push('  ' + hm(n.t) + ' on ' + n.where + ': ' + q(n.text)); });
    var ids = Object.keys(L.ex);
    out.push('performance:' + (ids.length ? '' : ' no answers yet'));
    ids.forEach(function (id) {
      var x = L.ex[id], m = median(x.rts);
      out.push('  ' + nameOf(id) + ': ' + x.n + ' answered, ' + x.right + ' right' + (m !== null ? ', median right ' + secs(m) : '') +
        (x.practice ? ', ' + x.practice + ' practice' : '') + (x.timeouts ? ', ' + x.timeouts + ' late' : '') + (x.voids ? ', ' + x.voids + ' voided' : ''));
    });
    out.push('sessions:' + (L.sessions.length ? '' : ' none'));
    L.sessions.slice(-20).forEach(function (s) {
      out.push('  ' + hm(s.t) + ' ' + s.mode + ' ' + mins(s.ms) + ', ' + s.answered + ' answered, ' + s.right + ' right (' + s.ex.map(nameOf).join(', ') + '), ' + (s.ended ? 'ended ' + s.ended : 'finished'));
    });
    var fr = L.frames;
    if (fr.length) {
      var meds = fr.map(function (f) { return f[4]; }), p95 = fr.map(function (f) { return f[5]; }), p99 = fr.map(function (f) { return f[6]; });
      out.push('frames outside items: ' + fr.length + ' samples of ' + fr[0][2] + ' frames; about ' + Math.round(1000 / median(meds)) + ' Hz; median ' + median(meds) + ' ms, p95 ' + median(p95) + ', p99 max ' + Math.max.apply(null, p99) +
        ', sd ' + median(fr.map(function (f) { return f[7]; })) + ', long frames ' + median(fr.map(function (f) { return f[8]; })) + ' %');
    } else out.push('frames outside items: no samples');
    var st = Object.keys(L.stim);
    out.push('frames in items:' + (st.length ? '' : ' none recorded'));
    st.forEach(function (id) {
      var s = L.stim[id];
      out.push('  ' + nameOf(id) + ': ' + s.trials + ' items, median ' + Math.round(s.medSum / Math.max(1, s.trials) * 10) / 10 + ' ms, p95 max ' + Math.round(s.p95Max * 10) / 10 + ', longest gap ' + Math.round(s.gapMax) + ' ms, dropped ' + s.dropped + ', stutter ' + s.stutter);
    });
    out.push('errors:' + (L.errors.length ? '' : ' none'));
    L.errors.slice(-15).forEach(function (e) { out.push('  ' + hm(e.t) + ' on ' + e.where + ': ' + q(e.message) + (e.at ? ' at ' + e.at : '') + (e.n > 1 ? ' x' + e.n : '')); });
    var vs = L.visits.slice(-5).map(function (v) { return iso(v.start) + ', ' + mins(v.ms) + ', last on ' + v.last; });
    out.push('where you quit (last visits): ' + (vs.length ? vs.join(' | ') : '?'));
    out.push('trail: ' + L.trail.slice(-12).map(function (x) { return hm(x[0]) + ' ' + x[1]; }).join(' > '));
    return out.join('\n');
  }

  function countsText() {
    var c = counts();
    return c.ratings + (c.ratings === 1 ? ' rating, ' : ' ratings, ') + c.notes + (c.notes === 1 ? ' note' : ' notes') + ' and ' + c.errors + (c.errors === 1 ? ' error' : ' errors') + ' in the playtest log.';
  }
  function counts() {
    var L = registered && ready ? log() : blank();
    return { ratings: L.ratings.length, notes: L.notes.length, errors: L.errors.length, sessions: L.sessions.length, visits: L.visits.length };
  }

  // The report in a dialog with Copy (Settings' "Show the report", and the fallback when copying
  // is blocked: then the text opens selected).
  function showReport(blocked) {
    var text = report(), K = PX.ui.kit, field = K.copyField(text, { rows: 12, ariaLabel: 'Playtest report', label: 'Copy' });
    if (!blocked) field.button.setAttribute('data-autofocus', ''); // focusing the text would select it all
    var close = ui.modal({ title: 'Playtest report', className: 'pt-report', body: [
      h('p', blocked ? 'Copying is blocked here. The report is selected below: press Ctrl+C (Cmd+C on a Mac), or long-press it and choose Copy.'
        : 'Everything in the playtest log, with this device’s facts. Copy it and send it with your feedback.'), field],
      actions: [{ label: 'Done', kind: 'secondary' }] });
    if (close.el) close.el.setAttribute('data-playtest-report', blocked ? 'blocked' : '');
    if (blocked) { try { field.textarea.focus(); field.textarea.select(); } catch (e) { /* ignore */ } }
    return close;
  }
  function copyReport() {
    var text = report();
    return ui.copyText(text).then(function (ok) {
      if (ok) { ui.toast('Playtest report copied (' + text.split('\n').length + ' lines).', { kind: 'ok' }); return true; }
      showReport(true);
      return false;
    });
  }

  function clear() {
    store.state.playtest = blank();
    visit = null;
    if (on()) startVisit();
    save();
  }
  function set(value) {
    store.state.settings.playtest = value ? 'on' : 'off';
    save();
    bus.emit('settings', { key: 'playtest', value: store.state.settings.playtest });
  }

  bus.on('settings', function (e) {
    if (!e || e.key !== 'playtest') return;
    syncFab();
    if (on() && !visit) startVisit();
  });
  bus.on('store:reload', function () { visit = null; if (on()) startVisit(); syncFab(); });
  bus.on('app:ready', function () {
    ready = true;
    var R = store.state;
    if (on()) {
      startVisit();
      setWhere(PX.core.router ? routeName(PX.core.router.current()) : here);
      early.splice(0).forEach(function (e) { push(log().errors, e, CAP.errors); });
      save();
      sampleSoon('boot', 1500);
    }
    early.length = 0;
    void R;
    syncFab();
  });

  PX.ui.playtest = {
    BUILD: BUILD, on: on, set: set, rate: rate, rateRow: rateRow, addNote: addNote, noteButton: noteButton, openNote: openNote,
    report: report, copyReport: copyReport, showReport: showReport, clear: clear, counts: counts, where: where, fix: fix,
  };
})(window.PX);
