/* PX.ui.game: the game layer on screen (v1.2, PLAN milestone 5, option B; note G1 §2, §5; ENGINE.md §24).
   Mounted on PX.ui.hooks at load; it edits no screen file:
     summary:panels (45)   grades (an ink stamp), Reach with its cause, firsts, "2 levels from your best",
                           field notes done; the Chimera invite (kind grade) when a grade went up
     today:slots (40, 41)  the weekly Climb (after the Daily) and this week's field notes, with "within
                           reach" and, after a gap of 7 days or more, a fresh-start note
     progress:panels (40)  grades, Reach and records, the Daily's calm history and archive, start versus now
     settings:sections     celebrations (quiet, medium, strong), Climb sounds, rank titles
     exercise:lines (70)   the exercise page: its records (best block, grade), the Atlas count, within reach
     item:notes (60)       at a block end, the firsts this session has made so far (a note between items)
     item:reveal           reserved for the plotter tick and the stretch ring (once the player calls it)
   Everything runs between items. The guard is body.px-stim: css/game.css hides every game element under
   it, fx.run refuses to start while it is set, and a running effect is cut the moment it appears. Effects
   use transform, opacity and stroke-dashoffset only, end within 700 ms, and are skipped under reduced
   motion and at the quiet level. Celebrations use ink and the right-answer green, never the accent
   (the stimulus target colour). Sounds (Web Audio tones, nothing downloaded) play only while the global
   Sound switch is on; the Climb's also need its own switch, on by default (CONTRACT-v1.2 M).

   PX.ui.game = { fx, sound, counter(el, from, to), stamp(def, grade), scale(o), cellText(def, i, j), firstText(first)
                  (null for a first of another version of its exercise), share(o), celebrate(), reduced(), names } */
(function (PX) {
  'use strict';

  var win = window, doc = win.document;
  var ui = PX.ui, h = ui.h, hasOwn = Object.prototype.hasOwnProperty;
  var LINK = 'https://discord.gg/chmr';

  function E() { return PX.engine; }
  function G() { return PX.engine.game; }
  function store() { return PX.core && PX.core.store; }
  function rec() { return store().state; }
  function save() { try { store().save(); } catch (e) { /* saved later */ } }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function nameOf(def) { return def ? def.short || def.name : ''; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function log(m, e) { if (win.console) console.error('PX.ui.game: ' + m, e || ''); }
  function version() { return PX.version || ''; }

  try {
    store().setting('celebrate', { def: 'medium', type: 'enum', values: ['quiet', 'medium', 'strong'] });
    store().setting('climbSound', { def: true, type: 'bool' });
    store().setting('rankTitles', { def: false, type: 'bool' });
  } catch (e) { log('the game settings', e); }

  function settings() { var s = rec() && rec().settings; return isObj(s) ? s : {}; }
  function celebrate() { var c = settings().celebrate; return c === 'quiet' || c === 'strong' ? c : 'medium'; }
  function reduced() {
    var a = doc.documentElement.getAttribute('data-motion');
    if (a === 'reduce') return true;
    if (a === 'full') return false;
    try { return !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function stimOn() { return !!(doc.body && doc.body.classList.contains('px-stim')); }
  // The device's screen class now (Track, Homing and Reckon keep a rating per class; E.game.displayFor).
  function display() { try { return E().est.displayClass(win.innerWidth, win.innerHeight); } catch (e) { return 'large'; } }
  function moving() { return celebrate() !== 'quiet' && !reduced(); }

  /* ---------- the effect scheduler: between items only ---------- */

  // run(el, cls, ms): adds an effect class for ms (≤ 700), then a resting class; never while a stimulus is on
  // screen, and every running effect is cut (its end state shown) as soon as body.px-stim appears.
  var fx = (function () {
    var live = [];
    function finish(x) {
      if (x.done) return;
      x.done = true;
      if (x.timer) win.clearTimeout(x.timer);
      x.cls.forEach(function (c) { x.el.classList.remove(c); });
      x.el.classList.add('gm-fx-done');
      if (typeof x.end === 'function') { try { x.end(); } catch (e) { log('effect end', e); } }
      var i = live.indexOf(x);
      if (i >= 0) live.splice(i, 1);
    }
    function run(el, cls, ms, end) {
      if (!el) return false;
      var x = { el: el, cls: String(cls || '').split(/\s+/).filter(Boolean), end: end, done: false, timer: null };
      if (stimOn() || !moving()) { live.push(x); finish(x); return false; }
      x.cls.forEach(function (c) { el.classList.add(c); });
      live.push(x);
      x.timer = win.setTimeout(function () { finish(x); }, Math.min(700, Math.max(0, ms || 0)));
      return true;
    }
    function cut() { live.slice().forEach(finish); }
    try {
      if (win.MutationObserver && doc.body) new win.MutationObserver(function () { if (stimOn()) cut(); }).observe(doc.body, { attributes: true, attributeFilter: ['class'] });
    } catch (e) { /* no observer: effects end by their timers (≤ 700 ms, under the gap before an item) */ }
    return { run: run, cut: cut, live: function () { return live.length; } };
  })();

  /* ---------- sound: Web Audio tones, after a gesture, never during a stimulus ---------- */

  var sound = (function () {
    var ctx = null, played = 0;
    function Ctor() { return win.AudioContext || win.webkitAudioContext || null; }
    function on(kind) {
      var s = settings();
      if (s.sound !== true) return false;
      return kind === 'climb' ? s.climbSound !== false : true;
    }
    function unlock() {
      try {
        var A = Ctor();
        if (!A) return false;
        if (!ctx) ctx = new A();
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        return true;
      } catch (e) { return false; }
    }
    function tone(freq, at, dur, type, peak) {
      var o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + at;
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak || 0.07, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }
    function ready(kind) { return on(kind) && !!ctx && ctx.state !== 'closed' && !stimOn(); }
    // A rung cleared: one note a semitone higher per rung, from A4 (the board's sketch).
    function rung(height) {
      if (!ready('climb')) return false;
      try { tone(440 * Math.pow(2, (Math.max(1, height) - 1) / 12), 0, 0.14, 'sine', 0.08); played++; return true; } catch (e) { return false; }
    }
    // The end of a run: 'week' (beats this week's best: a short rising pair), 'pb' (a personal best: a
    // richer arpeggio), 'summit' (rung 20: the arpeggio and its octave).
    function reward(kind) {
      if (!ready('climb')) return false;
      try {
        var f = 523.25; // C5
        if (kind === 'week') { tone(f, 0, 0.12, 'sine', 0.07); tone(f * 1.5, 0.1, 0.18, 'sine', 0.07); }
        else {
          [1, 1.25, 1.5, 2].forEach(function (k, i) { tone(f * k, i * 0.09, 0.22, 'triangle', 0.06); tone(f * k * 2, i * 0.09 + 0.01, 0.16, 'sine', 0.025); });
          if (kind === 'summit') { tone(f * 2, 0.4, 0.5, 'triangle', 0.06); tone(f * 3, 0.42, 0.45, 'sine', 0.03); }
        }
        played++;
        return true;
      } catch (e) { return false; }
    }
    // The grade stamp at the strong level: a short dull thud.
    function thud() {
      if (!ready('app')) return false;
      try { tone(110, 0, 0.12, 'triangle', 0.09); played++; return true; } catch (e) { return false; }
    }
    return { on: on, unlock: unlock, rung: rung, reward: reward, thud: thud, get played() { return played; }, ready: function () { return !!ctx; } };
  })();

  /* ---------- the instrument's pieces: counter, stamp, ruled scale ---------- */

  // A mechanical counter that rolls from one value to another (500 ms); still at the quiet level.
  function counter(el, from, to) {
    el.textContent = String(to);
    el.setAttribute('data-value', String(to));
    if (!moving() || stimOn() || !isNum(from) || from === to || !win.requestAnimationFrame) return el;
    var t0 = null, dur = 500;
    el.textContent = String(from);
    function step(ts) {
      if (t0 === null) t0 = ts;
      if (stimOn()) { el.textContent = String(to); return; }
      var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(from + (to - from) * e));
      if (k < 1) win.requestAnimationFrame(step);
    }
    win.requestAnimationFrame(step);
    return el;
  }

  // The level needle sweeps from the old value to the new (a block end, the summary's level rows): the bar's
  // fill scales from old/new to its place in 600 ms (transform only), cut with every other effect under
  // body.px-stim. For play.js's bars (ui.bar): sweep(bar, before, after).
  function sweep(bar, from, to) {
    var fill = bar && bar.querySelector ? bar.querySelector('.px-bar-fill') : null;
    if (!fill || !isNum(from) || !isNum(to) || from === to || to <= 0) return false;
    bar.style.setProperty('--gm-from', String(Math.max(0, Math.min(4, from / to))));
    return fx.run(bar, 'gm-fx-sweep', 600);
  }

  // One line that explains a new number the first time it appears (note G1 §4 option B's control for
  // beginners: one tour line per number, never more), remembered in rec.ui.game.told.
  function firstTime(key, text) {
    var R = rec();
    if (!isObj(R.ui)) R.ui = { lastRoute: null };
    if (!isObj(R.ui.game)) R.ui.game = {};
    if (!isObj(R.ui.game.told)) R.ui.game.told = {};
    if (R.ui.game.told[key]) return null;
    R.ui.game.told[key] = Date.now();
    save();
    return h('p.px-meta.gm-told', { 'data-told': key }, text);
  }

  function lowFirst(s) { s = String(s || ''); return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function settingsLine(def, settingsObj) {
    var X = PX.ui.exinfo, P = PX.ui.play;
    try { if (X && X.settingsText) return X.settingsText(def, settingsObj); } catch (e) { /* below */ }
    try { if (P && P.settingsText) return P.settingsText(def, settingsObj); } catch (e) { /* none */ }
    return '';
  }
  // The grade stamp: "GRADE 6 · FOLD" in ink, its band and an example of its settings beneath. The band deals
  // neighbouring settings too, so they are an example, worded as the player words a level's settings ("At this
  // level, for example: …"; W2-core's request after the lead's fresh-player run, 19 Nov).
  function stamp(def, grade, opts) {
    var b = G().band(def, grade), st = settingsLine(def, b.settings);
    var el = h('div.gm-stamp-wrap', { 'data-grade': String(b.grade), 'data-ex': def.id },
      h('div.gm-stamp', { role: 'img', 'aria-label': 'Grade ' + b.grade + ' on ' + nameOf(def) }, h('span.gm-stamp-k', 'Grade'), h('b.px-num', String(b.grade)), h('span.gm-stamp-x', nameOf(def))),
      h('p.gm-stamp-band.px-meta', 'Levels ' + b.lo + '–' + b.hi + (st ? '. For example: ' + lowFirst(st) + '.' : '.')));
    if (!(opts && opts.still)) {
      if (fx.run(el, 'gm-fx-stamp', 550) && celebrate() === 'strong') sound.thud();
    } else el.classList.add('gm-fx-done');
    return el;
  }

  // A ruled scale (SVG): ticks every unit, a major tick every `major`, a filled run to `value`, notches.
  function scale(o) {
    var n = o.max || 20, w = o.width || 220, pad = 8, step = (w - 2 * pad) / n, NS = 'http://www.w3.org/2000/svg';
    function sv(tag, a) { var e = doc.createElementNS(NS, tag); for (var k in a) if (hasOwn.call(a, k)) e.setAttribute(k, a[k]); return e; }
    var svg = sv('svg', { viewBox: '0 0 ' + w + ' 32', class: 'gm-scale', 'aria-hidden': 'true', focusable: 'false' });
    var x = function (r) { return (pad + r * step).toFixed(1); };
    svg.appendChild(sv('line', { class: 'gm-scale-rule', x1: x(0), y1: 20, x2: x(n), y2: 20 }));
    for (var r = 0; r <= n; r++) svg.appendChild(sv('line', { class: r % (o.major || 5) ? 'gm-scale-t' : 'gm-scale-t5', x1: x(r), y1: 20, x2: x(r), y2: r % (o.major || 5) ? 24 : 27 }));
    if (o.value > 0) svg.appendChild(sv('line', { class: 'gm-scale-fill', x1: x(0), y1: 20, x2: x(Math.min(n, o.value)), y2: 20 }));
    (o.notches || []).forEach(function (v) { svg.appendChild(sv('path', { class: 'gm-scale-notch', d: 'M' + (+x(v) - 3) + ' 30L' + (+x(v) + 3) + ' 30L' + x(v) + ' 25Z' })); });
    if (isNum(o.best) && o.best > 0) svg.appendChild(sv('line', { class: 'gm-scale-best', x1: x(o.best), y1: 13, x2: x(o.best), y2: 27 }));
    svg.appendChild(sv('path', { class: 'gm-scale-mark', d: 'M' + (+x(o.value || 0) - 5) + ' 2L' + (+x(o.value || 0) + 5) + ' 2L' + x(o.value || 0) + ' 10Z' }));
    return svg;
  }

  // The Climb's rule in words, from config.game.climb.spare: { ends: 'the second miss ends the run', ordinal,
  // rule: the whole sentence }.
  var ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
  function climbWords() {
    var sp = E().config.game.climb.spare, ord = ORD[Math.min(ORD.length - 1, Math.max(0, sp))];
    return { ordinal: ord, ends: 'the ' + ord + ' miss ends the run',
      rule: sp > 0 ? 'a miss leaves a notch and the same rung comes again with another item; the ' + ord + ' miss ends the run' : 'the first miss ends the run' };
  }
  function spareLeft(spare, misses) {
    var left = spare - misses;
    return spare < 1 ? 'no spare' : left > 1 ? left + ' spares' : left === 1 ? 'one spare' : spare > 1 ? 'spares used' : 'spare used';
  }

  // "4 folds with 3 punches": a cell of an exercise's Atlas in its own words. A dim the exercise does not use at
  // the cell's settings (def.ignores, read on the cell's easiest combination) is left out, so the words never name
  // a setting that is not dealt (W3-bandA's request on Angles' 9° level, 19 Nov).
  function cellText(def, i, j) {
    var ad = G().atlasDims(def), X = PX.ui.exinfo, e = null, skip = [];
    if (!ad) return '';
    try { e = G().cellEase(def)[i + '.' + j]; } catch (x) { e = null; }
    try { if (e && e.p && PX.ex.ignored) skip = PX.ex.ignored(def, e.p) || []; } catch (x) { skip = []; }
    function one(dim, k) {
      var v = dim.levels[k];
      try { if (X && X.dimText) return X.dimText(def, dim, v); } catch (x) { /* below */ }
      return (dim.label || dim.key) + ' ' + v;
    }
    var parts = [];
    if (skip.indexOf(ad.keys[0]) < 0) parts.push(one(ad.dims[0], i));
    if (ad.dims[1] && skip.indexOf(ad.keys[1]) < 0) parts.push(one(ad.dims[1], j));
    return parts.length ? parts.join(' with ') : one(ad.dims[0], i);
  }
  function cellOfKey(def, key) { var p = String(key).split('.'); return cellText(def, +p[0], +p[1]); }
  // A first in words, read with its exercise's current Atlas pair; a first saved under another version of the
  // exercise (its cells had another pair: Angles before version 3) is left out of the lists (null).
  function firstText(f) {
    var d = f && typeof f.ex === 'string' ? PX.ex.get(f.ex) : null;
    if (!d || !G().firstOk(f) || f.v !== (d.version || 1)) return null;
    return cellOfKey(d, f.cell);
  }

  function share(o) {
    var S = PX.ui.share;
    if (!S || typeof S.open !== 'function') { ui.toast('Sharing is not in this build.', { kind: 'info' }); return null; }
    try { return S.open(o); } catch (e) { log('share', e); return null; }
  }
  function shareButton(label, o, attr) {
    var b = ui.button(label, { kind: 'secondary', small: true, onClick: function () { share(typeof o === 'function' ? o() : o); } });
    b.setAttribute('data-gm-share', attr || '');
    return b;
  }
  function reachWords() { return 'the sum of your best levels in Parallax ' + version(); }
  function gradeCard(def, g, best) {
    var b = G().band(def, g);
    return { kind: 'level', label: 'Grade ' + g + ' · ' + nameOf(def), title: 'Grade ' + g + ' on ' + nameOf(def), lines: ['Best whole block of 10: level ' + best, 'Grade ' + g + ' is levels ' + b.lo + '–' + b.hi + ' of 1–100'], footer: 'Parallax ' + version(),
      text: 'Parallax · grade ' + g + ' on ' + nameOf(def) + ' (best block ' + best + ', levels ' + b.lo + '–' + b.hi + ') · ' + LINK };
  }

  /* ---------- the session summary ---------- */

  var NOTE_WORDS = {
    first: function (n) { return 'A first on ' + nameOf(PX.ex.get(n.ex)) + ': a setting you had not handled yet.'; },
    best: function () { return 'Beat your best block on any exercise.'; },
    review: function (n) { return 'Do the review that is due: ' + nameOf(PX.ex.get(n.ex)) + ', Path stage ' + n.s + '.'; },
    variant: function (n) { var d = PX.ex.get(n.ex), X = PX.ui.exinfo; return 'Play ' + nameOf(d) + '’s least-played version: ' + (X && X.variantName ? X.variantName(d, n.v) : n.v) + '.'; },
    path: function (n) { return 'Pass Path stage ' + n.s + ' on ' + nameOf(PX.ex.get(n.ex)) + '.'; },
    climb: function (n) { return 'Climb one rung higher than last week’s best (' + n.h + ').'; },
    strategy: function () { return 'Report how you solved it when a session asks (the strategy check-in).'; },
    check: function () { return 'Take the Spatial Check that is due.'; },
  };
  function noteText(n) { try { return hasOwn.call(NOTE_WORDS, n.id) ? NOTE_WORDS[n.id](n) : n.id; } catch (e) { return n.id; } }

  function summaryPanel(ctx) {
    var res = ctx && ctx.res, gm = res && res.game;
    if (!gm) return null;
    var grades = gm.grades || [], reach = gm.reach, firsts = (gm.firsts || []).filter(function (f) { return !f.old && firstText(f) !== null; }), nearList = gm.near || [], notes = gm.notes || [];
    var moved = reach && reach.delta > 0;
    if (!grades.length && !moved && !firsts.length && !nearList.length && !notes.length) return null;
    var title = grades.length ? (grades.length > 1 ? 'New grades' : 'New grade') : moved ? 'Reach' : firsts.length ? (firsts.length > 1 ? 'Firsts' : 'A first') : 'Records';
    var K = PX.ui.kit, p = K.panel({ title: title, className: 'pl-panel gm-panel gm-summary' });
    p.el.setAttribute('data-gm', 'summary');
    grades.forEach(function (x) {
      var def = PX.ex.get(x.exId);
      if (!def) return;
      var box = h('div.gm-grade', stamp(def, x.to));
      // W2-core for the first-session fresh test (requests.md): the grade line tells which block made it and what the
      // next grade needs, so it reads as one story with the results' level and the block notes
      box.appendChild(h('p.gm-line', (x.from ? 'Up from grade ' + x.from + ': your' : 'Your first grade on ' + nameOf(def) + ': your') +
        ' best block of 10 ended at level ' + x.level + '.' + (x.to < 10 ? ' A best block that ends at level ' + (x.to * 10 + 1) + ' or more brings grade ' + (x.to + 1) + '.' : '')));
      var t1 = firstTime('grade', 'A grade is the tenth of the 1–100 range that holds your best whole block of 10 on an exercise: grade 6 is levels 51–60, the band of Path stage 6. It never goes down.');
      if (t1) box.appendChild(t1);
      box.appendChild(h('div.px-slot-foot', shareButton('Share this grade', gradeCard(def, x.to, x.level), 'grade')));
      p.body.appendChild(box);
    });
    if (moved) {
      var num = counter(h('b.px-num.gm-reach-num'), reach.before, reach.after);
      var cause = reach.causes.filter(function (c) { return c.to > c.from; }).map(function (c) { var d = PX.ex.get(c.exId); return nameOf(d) + (c.from ? ', best block ' + c.from + ' → ' + c.to : ', a first best block of ' + c.to); }).join('; ');
      p.body.appendChild(h('p.gm-reach', { 'data-reach': String(reach.after) }, h('span.gm-k', 'Reach '), num, h('span.px-meta', ' (+' + reach.delta + (cause ? ': ' + cause : '') + ')')));
      var t2 = firstTime('reach', 'Reach is ' + reachWords() + ': each training exercise outside the DAT-style focus adds its best whole-block level. It rises with each new best and never falls.');
      if (t2) p.body.appendChild(t2);
    }
    if (firsts.length) {
      var lis = firsts.slice(0, 3).map(function (f) { var d = PX.ex.get(f.ex); return h('li', h('span.gm-first-k', 'First'), ' ', firstText(f), h('span.px-meta', ' · ' + nameOf(d))); });
      var ul = h('ul.gm-firsts', { 'data-firsts': String(firsts.length) }, lis);
      if (firsts.length > 3) ul.appendChild(h('li.px-meta', 'and ' + plural(firsts.length - 3, 'more first', 'more firsts') + ' in the Atlas'));
      p.body.appendChild(ul);
      lis.forEach(function (li, i) { fx.run(li, 'gm-fx-type gm-fx-d' + i, 300 + 60 * i); });
      var t3 = firstTime('first', 'A first is a pair of settings you handled for the first time: right answers there that guessing would explain less than one time in ten. The Atlas charts them.');
      if (t3) p.body.appendChild(t3);
    }
    nearList.forEach(function (x) {
      var d = PX.ex.get(x.exId);
      p.body.appendChild(h('p.gm-line.gm-near', nameOf(d) + ': ' + plural(x.gap, 'level', 'levels') + ' from your best block (' + x.best + ').'));
    });
    notes.forEach(function (x) { p.body.appendChild(h('p.gm-line.gm-note-done', h('span.gm-tick', { 'aria-hidden': 'true' }, '✓'), ' Field note done: ' + noteText(x.note))); });
    var foot = h('div.px-slot-foot');
    if (firsts.length) foot.appendChild(ui.button('Open the Atlas', { kind: 'ghost', small: true, go: 'atlas' }));
    if (foot.firstChild) p.body.appendChild(foot);
    var out = { el: p.el, order: 45 };
    if (grades.length) { out.invite = 'grade'; out.inviteOpts = { exId: grades[0].exId, grade: grades[0].to }; }
    return out;
  }

  /* ---------- Today ---------- */

  function climbSlot(ctx) {
    var r = ctx.rec, now = ctx.now, st = null;
    try { st = E().climb.state(r, now); } catch (e) { return null; }
    var K = PX.ui.kit, p = K.panel({ title: 'Weekly Climb', className: 'px-slot gm-slot gm-slot--climb', aside: h('span.px-num', '#' + st.number) });
    p.el.setAttribute('data-gm', 'climb');
    var all = E().climb.letters().length, used = all - st.left;
    var status = st.partial ? 'Attempt ' + st.partial + ' is waiting where you stopped (rung ' + (st.attempts[st.partial].h + 1) + ')' :
      st.left === all ? plural(all, 'attempt', 'attempts') + ' this week' : st.left ? plural(st.left, 'attempt', 'attempts') + ' left this week' : 'All ' + all + ' attempts climbed this week';
    p.body.appendChild(h('p.px-status', { 'data-climb-left': String(st.left) }, status, st.best !== null ? h('span.px-num', ' · best ' + st.best + ' of ' + st.rungs) : null));
    if (st.best !== null) p.body.appendChild(scale({ max: st.rungs, value: st.best, best: st.pb ? st.pb.h : null }));
    p.body.appendChild(h('p.px-slot-text', st.rungs + ' rungs from easy to hard, the same for everyone this week. Untimed; ' + climbWords().rule + '.' + (used === 0 && st.last !== null ? ' Last week’s best: ' + st.last + '.' : '')));
    p.body.appendChild(h('div.px-slot-foot', ui.button(st.partial ? 'Go on climbing' : st.left ? 'Climb' : 'See this week’s Climb', { kind: 'secondary', go: 'climb' })));
    return { el: p.el, after: 'daily', order: 40 };
  }

  function notesSlot(ctx) {
    var r = ctx.rec, now = ctx.now, st = null, fr = null, wr = null;
    try { st = E().notes.state(r, now); } catch (e) { st = null; }
    try { fr = G().fresh(r, now); } catch (e) { fr = null; }
    try { wr = G().withinReach(r, now, null, display()); } catch (e) { wr = null; }
    // a player without a training session yet sees no notes: the first screen stays the two-minute start
    var practised = (Array.isArray(r.sessions) ? r.sessions : []).some(function (x) { return isObj(x) && x.mode !== 'check' && (x.trials || 0) > 0; });
    var offer = st && practised ? st.offer : [];
    if (!offer.length && !fr && !wr) return null;
    var K = PX.ui.kit, p = K.panel({ title: 'This week', className: 'px-slot gm-slot gm-slot--notes', aside: 'field notes' });
    p.el.setAttribute('data-gm', 'notes');
    if (fr) p.body.appendChild(h('p.gm-fresh', { 'data-gm-fresh': '' }, 'Welcome back. Your levels are where you left them; the first block of each exercise checks them again.'));
    if (offer.length) {
      p.body.appendChild(h('p.px-slot-text', 'Keep up to ' + E().config.game.notes.keep + ' for this week. Unfinished ones go quietly on Sunday night.'));
      var ul = h('ul.gm-notes');
      offer.forEach(function (n, i) {
        var kept = st.kept.indexOf(i) >= 0, done = hasOwn.call(st.done, String(i));
        var li = h('li', { 'data-note': n.id, 'data-kept': kept ? '1' : '0', 'data-done': done ? '1' : '0' }, h('span.gm-note-mark', { 'aria-hidden': 'true' }, done ? '✓' : kept ? '•' : ''), h('span.gm-note-t', noteText(n)));
        if (!done) {
          var b = ui.button(kept ? 'Drop' : 'Keep', { kind: 'ghost', small: true, ariaLabel: (kept ? 'Drop: ' : 'Keep: ') + noteText(n), onClick: function () {
            var R = rec();
            if (E().notes.keep(R, Date.now(), i, !kept)) { save(); if (PX.ui.app && typeof PX.ui.app.rerender === 'function') PX.ui.app.rerender(); }
            else ui.toast(plural(E().config.game.notes.keep, 'note is', 'notes are') + ' kept already. Drop one to keep another.', { kind: 'info' });
          } });
          b.setAttribute('data-note-keep', String(i));
          li.appendChild(b);
        } else li.appendChild(h('span.px-meta', ' done'));
        ul.appendChild(li);
      });
      p.body.appendChild(ul);
    }
    if (wr) {
      var def = PX.ex.get(wr.exId);
      p.body.appendChild(h('p.gm-reachable', { 'data-gm-reach': wr.exId + ':' + wr.cell }, h('span.gm-k', 'Within reach '), nameOf(def) + ': ' + cellText(def, wr.i, wr.j) + '.'));
      p.body.appendChild(h('div.px-slot-foot', ui.button('Practise ' + nameOf(def), { kind: 'ghost', small: true, go: 'play?mode=train&exId=' + wr.exId + '&count=1' }), ui.button('Atlas', { kind: 'ghost', small: true, go: 'atlas' })));
    }
    return { el: p.el, after: 'daily', order: 41 };
  }

  /* ---------- Progress ---------- */

  function histogram(hist) {
    var NS = 'http://www.w3.org/2000/svg', bins = [], w = 220, hgt = 44, max = 0, top = E().config.daily2.max, nb = Math.max(1, Math.ceil(top / 4));
    // bins of 4 points; the last bin takes the maximum too (0–3, 4–7, …, 32–36 for a maximum of 36)
    for (var b = 0; b < nb; b++) { var s = 0; for (var k = b * 4; k < (b === nb - 1 ? top + 1 : b * 4 + 4); k++) s += hist[k] || 0; bins.push(s); if (s > max) max = s; }
    var svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + (hgt + 12));
    svg.setAttribute('class', 'gm-hist');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Daily points: ' + bins.map(function (n, i) { return (i * 4) + '–' + (i === nb - 1 ? top : i * 4 + 3) + ': ' + n; }).join(', '));
    bins.forEach(function (n, i) {
      var bw = w / nb - 4, bh = max ? Math.max(n ? 2 : 0, Math.round(hgt * n / max)) : 0, r = doc.createElementNS(NS, 'rect');
      r.setAttribute('x', String(i * (w / nb) + 2)); r.setAttribute('y', String(hgt - bh)); r.setAttribute('width', String(bw)); r.setAttribute('height', String(bh));
      r.setAttribute('class', 'gm-hist-bar');
      svg.appendChild(r);
      var t = doc.createElementNS(NS, 'text');
      t.setAttribute('x', String(i * (w / nb) + w / nb / 2)); t.setAttribute('y', String(hgt + 10)); t.setAttribute('class', 'gm-hist-t');
      t.textContent = String(i * 4);
      svg.appendChild(t);
    });
    return svg;
  }

  // Start versus now: per exercise tried, the first settled level and now (after the third session or the
  // first week), with the accurate line that early gains include getting used to the task.
  function startNow(r, now) {
    var ss = (Array.isArray(r.sessions) ? r.sessions : []).filter(function (s) { return isObj(s) && s.mode !== 'check'; });
    if (ss.length < 3 && !(ss.length && now - ss[0].start >= 7 * E().DAY)) return null;
    var rows = [];
    G()._.reachDefs().concat(PX.ex.list('train').filter(function (d) { return d.pat === true; })).forEach(function (def) {
      var cv = [];
      var dc = G().displayFor(r, def, display());
      try { cv = E().stats.curve(r, def, { display: dc }); } catch (e) { cv = []; }
      if (cv.length < 2) return;
      var first = null;
      for (var i = 0; i < cv.length; i++) if (cv[i].hi - cv[i].lo <= 30) { first = cv[i]; break; }
      first = first || cv[0];
      var lv = E().est.shown(r, def, { display: dc });
      if (!lv || first === cv[cv.length - 1]) return;
      rows.push({ def: def, from: first.level, to: lv.level });
    });
    return rows.length ? rows : null;
  }

  function progressPanel(ctx) {
    var r = ctx.rec, now = ctx.now, K = PX.ui.kit, R = G().reach(r), gs = G().grades(r, now, display());
    var p = K.panel({ title: 'Grades and Reach', className: 'px-panel gm-panel gm-progress', aside: 'the game layer' });
    p.el.setAttribute('data-gm', 'progress');
    var head = h('div.gm-reach-big', h('span.gm-k', 'Reach'), h('b.px-num', { 'data-reach': String(R.value) }, String(R.value)), h('span.px-meta', ' of ' + R.max));
    if (settings().rankTitles === true) head.appendChild(h('span.gm-rank', G().rank(R.value).title));
    p.body.appendChild(head);
    p.body.appendChild(h('p.px-meta', 'Reach is ' + reachWords() + ': each training exercise outside the DAT-style focus adds its best whole-block level (1–100). It rises with each new best and never falls; it is not an ability score.'));
    var tb = h('table.gm-table', h('thead', h('tr', h('th', 'Exercise'), h('th', 'Grade'), h('th', 'Best'), h('th', 'Now'), h('th', 'Atlas'))));
    var body = h('tbody');
    gs.filter(function (x) { return x.best !== null || !x.pat; }).forEach(function (x) {
      var def = PX.ex.get(x.exId), at = G().atlas(r, def);
      body.appendChild(h('tr', { 'data-ex': x.exId }, h('td', nameOf(def)), h('td.px-num', x.grade ? h('span.gm-grade-chip', String(x.grade)) : '–'),
        h('td.px-num', x.best !== null ? String(x.best) : '–'), h('td.px-num', x.level !== null && x.best !== null ? String(x.level) : '–'), h('td.px-num', at ? at.handled + '/' + at.total : '–')));
    });
    tb.appendChild(body);
    p.body.appendChild(h('div.gm-table-wrap', tb));
    p.body.appendChild(h('p.px-meta', 'A grade is the tenth of the range that holds your best whole block of 10: grade 6 is levels 51–60, the band of Path stage 6. The Atlas counts the pairs of settings you have handled: right answers there that guessing would explain less than one time in ten.'));
    // the Climb and the Daily
    var cs = E().climb.state(r, now), dh = E().daily.history(r);
    var rows = h('dl.gm-records');
    rows.appendChild(h('div', h('dt', 'Weekly Climb'), h('dd', cs.pb ? 'Highest run ' + cs.pb.h + ' of ' + cs.rungs + (cs.best !== null ? '; this week ' + cs.best : '') : 'Not climbed yet')));
    rows.appendChild(h('div', h('dt', 'Daily Challenge'), h('dd', dh.played ? plural(dh.played, 'Daily', 'Dailies') + ' played' + (dh.ramp.n ? '; best ' + dh.ramp.best + ' of ' + E().config.daily2.max + ' points' : '') + (dh.archive ? ' (' + dh.archive + ' from the archive)' : '') : 'Not played yet')));
    p.body.appendChild(rows);
    if (dh.ramp.n) p.body.appendChild(h('figure.gm-hist-fig', histogram(dh.ramp.hist), h('figcaption.px-meta', 'Points per Daily since the ramp began (0–' + E().config.daily2.max + ').')));
    var arch = E().daily.archive(r, now, 7).filter(function (x) { return x.state !== 'done'; });
    if (arch.length) {
      p.body.appendChild(h('p.px-meta', 'Missed a day? Past Dailies stay open in the archive: scored once, marked archive, outside that day’s shared result.'));
      p.body.appendChild(h('div.gm-archive', arch.slice(0, 4).map(function (x) {
        var when = '';
        try { when = PX.util.fmtDate(new Date(x.day + 'T12:00:00').getTime(), 'short'); } catch (e) { when = x.day; }
        var b = ui.button('#' + x.number + ' · ' + when + (x.state === 'partial' ? ' (go on)' : ''), { kind: 'ghost', small: true, go: 'play?mode=daily&day=' + x.day });
        b.setAttribute('data-archive', x.day);
        return b;
      })));
    }
    var sn = startNow(r, now);
    if (sn) {
      var sl = h('ul.gm-startnow', sn.slice(0, 8).map(function (x) { return h('li', h('b', nameOf(x.def)), h('span.px-num', ' ' + x.from + ' → ' + x.to)); }));
      p.body.appendChild(h('div.gm-sn', h('h3.gm-h3', 'Start versus now'), sl, h('p.px-meta', 'From your first settled level to now. Early gains include getting used to the task.')));
      p.body.appendChild(h('div.px-slot-foot', shareButton('Share start versus now', function () {
        return { kind: 'session', label: 'Start versus now', title: 'Start versus now', lines: sn.slice(0, 5).map(function (x) { return nameOf(x.def) + ': level ' + x.from + ' → ' + x.to; }).concat(['Early gains include getting used to the task.']), footer: 'Parallax ' + version() };
      }, 'startnow')));
    }
    p.body.appendChild(h('div.px-slot-foot', ui.button('Open the Atlas', { kind: 'secondary', small: true, go: 'atlas' }), ui.button('Weekly Climb', { kind: 'ghost', small: true, go: 'climb' }),
      shareButton('Share Reach', { kind: 'session', label: 'Reach ' + R.value, title: 'Reach ' + R.value, lines: ['Reach ' + R.value + ': ' + reachWords() + '.'], footer: 'Parallax ' + version(), text: 'Parallax · Reach ' + R.value + ' (' + reachWords() + ') · ' + LINK }, 'reach')));
    return { el: p.el, after: 'levels', order: 40 };
  }

  /* ---------- the exercise page: records and the Atlas (exercise:lines) ---------- */

  function exerciseLines(ctx) {
    if (!ctx || !ctx.def || ctx.where !== 'page' || ctx.def.role !== 'train') return null;
    var def = ctx.def, r = ctx.rec, now = isNum(ctx.now) ? ctx.now : Date.now(), b = G().bestOf(r, def.id), at = G().atlas(r, def), wr = null;
    if (!b && !(at && at.tried)) return null;
    try { wr = G().withinReach(r, now, def.id, display()); } catch (e) { wr = null; }
    var parts = [];
    if (b) parts.push('best whole block ' + b.level + (b.at ? ' (' + PX.util.fmtDate(b.at, 'short') + ')' : '') + ', grade ' + G().gradeOf(b.level));
    if (at) parts.push('Atlas ' + at.handled + ' of ' + at.total + ' cells handled');
    var el = h('div.gm-ex-lines', { 'data-gm': 'exercise' }, h('p', h('span.gm-k', 'Records '), parts.join('; ') + '.'));
    if (wr) el.appendChild(h('p', h('span.gm-k', 'Within reach '), cellText(def, wr.i, wr.j) + '.'));
    el.appendChild(h('p', ui.button('Atlas of ' + nameOf(def), { kind: 'ghost', small: true, go: 'atlas?ex=' + def.id })));
    return { el: el, order: 70 };
  }

  /* ---------- Settings ---------- */

  function settingsSection(ctx) {
    var K = PX.ui.kit, s = (ctx && ctx.rec && ctx.rec.settings) || {};
    var p = K.panel({ title: 'Game layer', className: 'px-settings-section' });
    p.el.setAttribute('data-section', 'game');
    function set(key, v) { var R = rec(); R.settings[key] = v; save(); PX.bus.emit('settings', { key: key, value: v }); }
    p.body.appendChild(h('p.px-meta', 'Celebrations between items'));
    p.body.appendChild(K.segmented({ key: 'celebrate', value: celebrate(), options: [{ value: 'quiet', label: 'Quiet' }, { value: 'medium', label: 'Medium' }, { value: 'strong', label: 'Strong' }],
      hint: 'Quiet: marks appear, nothing moves. Medium: ticks draw themselves, a ring marks a right answer to a stretch item, the needle sweeps, the grade stamp presses in. Strong: medium, with a ring on every right answer and a sound at the stamp (while Sound is on). Never while an item is on screen.',
      onChange: function (v) { set('celebrate', v); } }));
    p.body.appendChild(K.toggle({ key: 'climbSound', label: 'Climb sounds', checked: s.climbSound !== false,
      hint: 'Rising tones as you climb and a short reward when a run beats your best. They play while Sound (above) is on.', onChange: function (v) { set('climbSound', !!v); } }));
    p.body.appendChild(K.toggle({ key: 'rankTitles', label: 'Rank titles', checked: s.rankTitles === true,
      hint: 'A survey title beside Reach, one per ' + E().config.game.rankStep + '. It names how far you have charted, never a skill or a comparison.', onChange: function (v) { set('rankTitles', !!v); } }));
    return { el: p.el, after: 'sound' };
  }

  /* ---------- firsts at a block end (item:notes: a note between items, queued like the others) ---------- */

  function blockFirsts(ctx) {
    if (!ctx || !ctx.out || !ctx.out.blockEnd || !ctx.plan || stimOn()) return null;
    var list = [];
    try { list = G().pending(ctx.plan, ctx.rec); } catch (e) { list = []; }
    var shown = ctx.plan.gameFirsts || (ctx.plan.gameFirsts = {});
    var fresh = list.filter(function (f) { var k = f.ex + ':' + f.cell; if (shown[k] || firstText(f) === null) return false; shown[k] = 1; return true; });
    if (!fresh.length) return null;
    var el = h('p.pl-note.gm-block-firsts', { 'data-gm': 'block-firsts' }, h('span.gm-first-k', fresh.length > 1 ? 'Firsts ' : 'First '),
      fresh.slice(0, 3).map(firstText).join('; ') + (fresh.length > 3 ? '; and ' + (fresh.length - 3) + ' more' : '') + '.');
    return el;
  }

  /* ---------- after a verdict (item:reveal, when the player calls it) ---------- */

  function reveal(ctx) {
    if (!ctx || stimOn() || !ctx.verdict || !ctx.tr) return null;
    var ok = ctx.tr.result && ctx.tr.result.correct, icon = ctx.verdict.querySelector('.pl-verdict-icon');
    if (!ok || !icon) return null;
    icon.classList.add('gm-tick');
    fx.run(icon, 'gm-fx-tick', 200);
    var stretch = ctx.step && (ctx.step.kind === 'stretch' || ctx.step.kind === 'stretch1');
    if (stretch || celebrate() === 'strong') {
      var ring = h('span.gm-ring', { 'aria-hidden': 'true' });
      icon.appendChild(ring);
      fx.run(ring, 'gm-fx-ring', 300, function () { if (ring.parentNode) ring.parentNode.removeChild(ring); });
      if (stretch) {
        // W2-core, fresh-player round 5 (Angles: the tag had no explanation): its words as its title and name, and
        // the first time one line under the verdict (rec.ui.seen.stretchNote; the player keeps the marks in view)
        var line = stretchLine();
        ctx.verdict.appendChild(h('span.gm-stretch-tag.px-meta', { title: line, 'aria-label': line }, 'stretch'));
        var u = rec().ui, seen = u && isObj(u.seen) ? u.seen : null;
        if (u && !seen) seen = u.seen = {};
        if (seen && !seen.stretchNote && ctx.P && typeof ctx.P.note === 'function') {
          seen.stretchNote = 1;
          save();
          ctx.P.note(h('p.px-meta.gm-stretch-note', line));
        }
      }
    }
    return null;
  }
  // What a stretch item is, from the engine's mix (C.mix.stretch: the share of stretch items in a deck of ten)
  function stretchLine() {
    var m = E().config && E().config.mix, n = m && m.stretch > 0 ? Math.round(1 / m.stretch) : 10;
    return 'Stretch: an item set above your level (about one in ' + n + '), so a right answer counts for more.';
  }

  var Hk = PX.ui.hooks;
  if (Hk && typeof Hk.on === 'function') {
    Hk.on('summary:panels', function (ctx) { return summaryPanel(ctx); }, { id: 'game.summary', order: 45 });
    Hk.on('today:slots', function (ctx) { return climbSlot(ctx); }, { id: 'game.climb', order: 40 });
    Hk.on('today:slots', function (ctx) { return notesSlot(ctx); }, { id: 'game.notes', order: 41 });
    Hk.on('progress:panels', function (ctx) { return progressPanel(ctx); }, { id: 'game.progress', order: 40 });
    Hk.on('settings:sections', function (ctx) { return settingsSection(ctx); }, { id: 'game.settings', order: 40 });
    Hk.on('exercise:lines', function (ctx) { return exerciseLines(ctx); }, { id: 'game.exercise', order: 70 });
    Hk.on('item:reveal', function (ctx) { return reveal(ctx); }, { id: 'game.reveal', order: 40 });
    Hk.on('item:notes', function (ctx) { return blockFirsts(ctx); }, { id: 'game.firsts', order: 60 });
  }

  PX.ui.game = { fx: fx, sound: sound, counter: counter, stamp: stamp, scale: scale, sweep: sweep, firstTime: firstTime, climbWords: climbWords, spareLeft: spareLeft, cellText: cellText, firstText: firstText, share: share, shareButton: shareButton,
    celebrate: celebrate, reduced: reduced, moving: moving, noteText: noteText, gradeCard: gradeCard, reachWords: reachWords, LINK: LINK,
    _: { summaryPanel: summaryPanel, climbSlot: climbSlot, notesSlot: notesSlot, progressPanel: progressPanel, startNow: startNow, exerciseLines: exerciseLines, blockFirsts: blockFirsts } };
})(window.PX);
