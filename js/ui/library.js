/* PX.ui.screens.library and PX.ui.screens.exercise: the Library (PHASE-3 "Builder B", PLAN §3,
   §5–§8). Every training exercise from PX.ex.list('train') as a specimen card: code, name, ability
   codes, level 1–100 with its likely range and the real settings handled, Path stage, How to play
   (PX.ui.play.howTo / watch when the player is loaded, else a sheet from learn.js), Practise
   (Train with the exercise as focus, Path, Speed once open, Threshold where a protocol exists,
   Free play through the player's own setup screen), and the exercise page (route exercise/<id>) with strategy cards, the "where spatial
   thinking is used" card with its limitation line, and the off-screen challenge where present.
   Track is labelled attention practice; Homing and exercises flagged `experimental` (Reckon) are
   labelled experimental. An exercise whose view is not registered yet (or needs WebGL that is
   missing) says so instead of starting.
   v1.1 (B7): the DAT-style formats (def.pat) form their own group with the PAT focus switch, the
   Section practice entry (route 'section'), the where-used card with its limitation line and the
   ADA line (R3 §6, §8.0); an exercise page shows its "Also in tests" note (PX.ui.overlap, R4 §6.3).

   PX.ui.exinfo: helpers shared by the Library, Progress, Log and Lab (and share.js):
     defs()                       training definitions in code order
     entry(id)                    { id, def, code, name, kind, abilities, blurb, note }
     display()                    'small' | 'large' (the screen class Track and Homing rate per)
     level(rec, def, now)         { n, level, lo, hi, sd, settings (text), last } or { n: 0 }
     settingsText(def, settings)  'angle 120°, axis vertical, 10 cubes' from est.level().settings
     paramsText(def, params)      the same from level indices (variant included)
     variantName(def, v)          'same or mirror', 'pick two', …
     unavailable(def)             null, 'coming soon', or why this device cannot run it
     explain(def, why)            the coming-soon / unavailable notice
     start(def, route)            router.go('play', route) unless unavailable (then explain)
     tags(def)                    [{ text, kind }]: attention practice, experimental
     modeName(mode)               'Train', 'Spatial Check', …
     pct(x), secs(ms), when(t)    formatting */
(function (PX) {
  'use strict';

  var ui = PX.ui;
  var h = ui.h;
  var U = PX.util;
  var hasOwn = Object.prototype.hasOwnProperty;

  var VARIANTS = {
    samediff: 'same or mirror', pick: 'pick two', opposite: 'opposite face', edges: 'meeting edges',
    cube: 'does it fold into a cube', toview: 'object to view', toobject: 'views to object', count: 'count blocks',
    forward: 'forward', backward: 'backward', still: 'still camera', orbit: 'orbiting camera',
    point: 'point home', 'return': 'walk back home',
    pull: 'pull the ends', untie: 'which crossing unties it', tie: 'which crossing ties it', link: 'linked or apart',
    quick: 'quick estimate, against a clock', exact: 'exact answer, no clock', // Central Point
  };
  // A few words after the name on cards and pages (R1 §8.1 d: Homing is the stage with landmarks).
  var NAME_TAIL = { homing: 'with landmarks', reckon: 'no landmarks' };
  // A tag for exercises new in this version, shown until the player has rated answers on it (the
  // Library lists them by code, so a new one can sit away from where a player looks).
  var NEW_IN = { centralpoint: '1.2' };
  // Notes under an experimental exercise's lead (B3's wording for Homing and Reckon).
  var EXPERIMENTAL = {
    // the middle sentence follows the per-cell tables in tests/node/{homing,reckon}.test.mjs: turns alone are right
    // less often with bigger turns, at tighter tolerances and on walks back (not simply on longer routes)
    homing: 'Homing is experimental: its item model is new and untested. It is the landmark-aided stage before Reckon: far landmarks correct dead-reckoning errors. On the easier routes the turns alone tell you much of the way home; distances matter more with bigger turns and at tighter tolerances. Each answer\'s angle error is logged.',
    reckon: 'Reckon is experimental: dead reckoning with no landmarks or fixes of any kind. On the easier routes the turns alone tell you much of the way home; distances matter more with bigger turns, at tighter tolerances and when you walk back. Angle and distance errors are logged separately. Hard at first? Practise Homing, where landmarks help, then come back.',
  };
  var CARD_NOTE = { reckon: 'Hard at first? Practise Homing, where landmarks help, then come back.' };
  var MODES = { train: 'Train', path: 'Path', speed: 'Speed', threshold: 'Threshold', free: 'Free play', daily: 'Daily Challenge', check: 'Spatial Check', section: 'Section practice' };
  // Which situations each mode suits (gap M3; docs/research/v1.2/P1-plateaus-progress.md §5): the
  // practise sheet, the exercise page and the Lab say it in these words.
  var MODE_WHEN = {
    train: 'Right when you want the most progress per minute without choosing anything: mixed exercises at the edge of your level, with reviews spaced out.',
    path: 'Right when an exercise is new to you, or mixed practice feels like too much: one band at a time, with a clear finish line.',
    speed: 'Right when you answer an exercise accurately but slowly, or your test is timed: deadlines on items you already solve, with a separate timed level.',
    threshold: 'Right when you want one number to compare over months. It measures; it does not change your level.',
    free: 'Right when you want to explore a setting, replay a friend’s code or rehearse exactly what you will meet, without touching your level.',
  };
  var PROTOCOL_NAMES = {
    'track-standard': 'Track Standard 3D-MOT protocol',
    'track': 'Track speed at your target',
    'span-length': 'Span length',
    'spin-deadline': 'Spin deadline',
  };

  function E() { return PX.engine; }
  function defs() { return PX.ex.list('train'); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  function entry(id) {
    var def = PX.ex.get(id), cat = null;
    try { cat = PX.ui.home && PX.ui.home.catalog ? PX.ui.home.catalog().filter(function (c) { return c.id === id; })[0] : null; } catch (e) { cat = null; }
    return {
      id: id, def: def, code: def ? def.code : (cat && cat.code) || '', name: def ? def.short : (cat && cat.name) || id,
      kind: (cat && cat.kind) || (def ? def.name : ''), abilities: def ? def.abilities.slice() : (cat && cat.abilities) || [],
      blurb: (cat && cat.blurb) || '', note: cat && cat.note,
    };
  }

  function display() {
    try { return E().est.displayClass(window.innerWidth, window.innerHeight); } catch (e) { return 'large'; }
  }

  function numText(v) {
    if (!isNum(v)) return String(v);
    return Math.round(v) === v ? String(v) : String(U.round(v, 2));
  }
  function valueText(dim, v) {
    var unit = dim.unit || '';
    return numText(v) + unit;
  }
  // 'angle 120°' / 'axis vertical' / '10 cubes': count-like dims read "<n> <label>", and a few
  // settings have their own phrasing.
  var COUNT_DIMS = /^(cubes|cells|spheres|targets|folds|punches|objects|extra lines|legs)$/i;
  var PHRASE = {
    'span.len': function (v) { return v + ' blocks'; },
    'span.turn': function (v) { return v ? 'board turned ' + v + '°' : 'no board turn'; },
    'slice.curved': function (v) { return v === 'yes' ? 'curved solid' : 'flat-sided solid'; },
    'fold.folds': function (v) { return v === 1 ? 'one fold' : v + ' folds'; },
    'fold.punches': function (v) { return v === 1 ? 'one punch' : v + ' punches'; },
    // O59: with fewer folds the generator caps the idle ones at folds − 1, so "up to"
    'fold.idle': function (v) { return v === 0 ? 'every fold matters' : 'up to ' + (v === 1 ? 'one fold that does not matter' : v + ' folds that do not matter'); },
    // Fold's and Hole Punch's fold types (all straight; a corner among straight ones; 45° only; both)
    'fold.type': function (v) { return FOLD_TYPE[v] || v + ' folds'; },
    'patfold.type': function (v) { return FOLD_TYPE[v] || v + ' folds'; },
    // Hole Punch: folds whose flap the punch misses (at most folds − 1 of them)
    // the starter level (note D2 §3.6): one fold, outside the test's format ('1 (starter)')
    'patfold.folds': function (v) { var n = parseInt(v, 10); return /starter/.test(String(v)) ? 'one fold (starter: outside the test’s format)' : n === 1 ? 'one fold' : n + ' folds'; },
    'patfold.idle': function (v) { return v === 0 ? 'every fold matters' : 'up to ' + (v === 1 ? 'one fold' : v + ' folds') + ' the punch misses'; },
    // Openings: the cuts dealt over the three faces, the outline that fits, the wrong openings
    'openings.features': function (v) { var n = String(v).split('+').reduce(function (a, x) { return a + (parseInt(x, 10) || 0); }, 0); return n === 1 ? 'one cut, on one face (starter)' : n === 3 ? 'one cut on each face' : n + ' cuts over the three faces'; },
    'openings.edges': function (v) { return v === 'chamfers' ? 'slanted cuts too' : 'right-angled cuts only'; },
    'openings.keyview': function (v) { return v === 'front, side or top' ? 'any of the three outlines fits' : 'mostly the ' + String(v).split(',')[0] + ' outline fits (sometimes the side)'; },
    'openings.pose': function (v) { return v === 'lying' ? 'solid shown lying on its side' : 'solid shown upright'; },
    'openings.foils': function (v) { return v === 'proportion' ? 'one wrong opening with the wrong proportions' : 'wrong openings differ in a cut'; },
    // Missing View
    'patviews.cubes': function (v) { return v + ' cubes'; },
    'patviews.grid': function (v) { return 'on a ' + v + ' grid'; },
    'patviews.missing': function (v) { return 'the ' + v + ' view to find'; },
    'patviews.foil': function (v) { return v === 'same outline' ? 'wrong drawings with the same outline' : v === 'solid or dotted' ? 'wrong drawings that differ in one line (solid or dotted)' : 'wrong drawings with another outline'; },
    // Angles (size ranges from the generator)
    // the starter level (9°) ignores the size class: all near a right angle (note D2 §3.2)
    'angles.gap': function (v) { return 'closest two angles ' + v + '° apart' + (v === 9 ? ', all near a right angle' : ''); },
    'angles.size': function (v) {
      var d = PX.ex.get('angles'), r = d && d.lib && d.lib.RANGE ? d.lib.RANGE[v] : null, span = r ? ' (' + r[0] + '–' + r[1] + '°)' : '';
      return (v === 'right' ? 'angles near a right angle' : v + ' angles') + span;
    },
    'angles.resolve': function (v) { return v === 'extremes' ? 'the smallest and largest settle it' : 'the ' + (v === 'middle' ? 'middle' : 'closest') + ' two settle it'; },
    'angles.pose': function (v) { return v === 'aligned' ? 'one arm of each angle horizontal' : 'angles turned any way'; },
    // Painted Cubes
    'cubes.cubes': function (v) { return v + ' cubes'; },
    // the starter level (note D2 §3.4): one layer
    'cubes.height': function (v) { return v === 1 ? 'flat: one layer, no cube on another' : 'columns up to ' + v + ' cubes high'; },
    'cubes.asked': function (v) { return 'asked for cubes with ' + v + ' painted sides'; },
    // Form
    'form.solid': function (v) { return v === 'frusta and five-sided' ? 'cut-off pyramids and five-sided prisms' : String(v); },
    'form.marks': function (v) { return FORM_MARKS[v] || 'marks: ' + v; },
    'form.view': function (v) { return 'solids pictured ' + v; },
    'form.foil': function (v) { return v === 'marks only' ? 'wrong solids differ only in their marks' : 'wrong solids differ in size or in marks'; },
    'views.view': function (v) { return v + ' view'; },
    'views.cubes': function (v) { return v + ' cubes'; }, // the starter level's value is a range ('3–4')
    // Central Point (EX-20): right within a share of the best total distance
    'centralpoint.band': function (v) { return 'right within ' + v + ' % of the best total'; },
    'homing.route': function (v) { return String(v).replace(', ', ' with '); }, // '3 legs with small turns (30–60°)': no comma inside a list
    'homing.landmarks': function (v) { return v === 'none' ? 'no landmarks' : v === 'one' ? 'one landmark' : v + ' landmarks'; },
    'reckon.route': function (v) { return String(v).replace(', ', ' with '); },
    'reckon.flow': function (v) { return v === 'textured' || v === 'sparse' ? v + ' ground' : v + ' on the ground'; },
    'reckon.speed': function (v) { return v === 'steady' ? 'steady speed' : 'speed ' + String(v).replace(/^varied/, 'varies'); },
    'reckon.tolerance': function (v) { return 'right within ' + v; },
    'track.time': function (v) { return v + ' s of tracking'; },
    'knots.rope': function (v) { var m = /^(\d+)( slide-over)?$/.exec(String(v)); return m ? m[1] + ' crossings' + (m[2] ? ' with a slide-over move' : '') : String(v); },
    'knots.spacing': function (v) { return v === 'open' ? 'strands far apart' : v === 'close' ? 'strands close together' : v === 'tight' ? 'strands tightly packed' : v + ' spacing'; },
  };
  var FOLD_TYPE = { half: 'straight folds only', corner: 'a corner folded in among straight folds', diagonal: 'diagonal folds only', mixed: 'diagonal and straight folds' };
  var FORM_MARKS = {
    'shaded and half': 'one shaded face and one half-shaded', 'two shaded and half': 'two shaded faces and one half-shaded',
    'shaded and two halves': 'one shaded face and two half-shaded',
  };
  function dimText(def, dim, v) {
    var f = def && PHRASE[def.id + '.' + dim.key];
    if (f) return f(v);
    var label = dim.label || dim.key, low = label.charAt(0).toLowerCase() + label.slice(1);
    return isNum(v) && !dim.unit && COUNT_DIMS.test(label) ? numText(v) + ' ' + low : low + ' ' + valueText(dim, v);
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function settingsText(def, settings) {
    if (!def || !settings || !settings.dims) return '';
    return cap(settings.dims.map(function (d) {
      var dim = def.dims.filter(function (x) { return x.key === d.key; })[0] || d;
      return dimText(def, dim, d.value);
    }).join(', '));
  }
  function variantName(def, v) { return v === undefined || v === null ? '' : hasOwn.call(VARIANTS, v) ? VARIANTS[v] : String(v); }
  function paramsText(def, params) {
    if (!def || !params) return '';
    var parts = def.dims.map(function (d) { return dimText(def, d, d.levels[params[d.key] || 0]); });
    if (def.variants && params.variant !== undefined) parts.push(variantName(def, params.variant));
    return cap(parts.join(', '));
  }

  // The rating shown on this screen (Track and Homing: this screen class). total counts the
  // answers of every screen class. starter: { toNext, needOf5 } while the shown level is 1 on an
  // exercise with starter items (CONTRACT-v1.2 C), else null.
  function level(rec, def, now) {
    var opts = { display: display() }, total = 0;
    try { total = E().schedule.totals(rec, def).n; } catch (e) { total = 0; }
    try {
      var st = E().est.get(rec, def, opts, now);
      if (!(st.n > 0)) return { n: 0, total: total };
      var lv = E().est.level(def, st), sb = null;
      try { sb = def.starter && typeof E().est.starter === 'function' ? E().est.starter(def, st) : null; } catch (e2) { sb = null; }
      return { n: st.n, total: total, level: lv.level, lo: lv.lo, hi: lv.hi, sd: st.sd, last: st.last, settings: settingsText(def, lv.settings), params: lv.settings ? lv.settings.params : null, exact: lv.exact, starter: sb };
    } catch (e) { return { n: 0, total: total }; }
  }
  // 'level 1 · starter items' or 'level 12': the player's wording on every screen (CONTRACT-v1.2 C)
  function levelText(n) {
    var P = PX.ui.play;
    if (P && typeof P.levelText === 'function') return P.levelText(n);
    return isNum(n) ? (n <= 1 ? 'level 1 · starter items' : 'level ' + Math.round(n)) : 'level –';
  }

  function unavailable(def) {
    if (!def) return 'not in this version';
    var v = PX.ex.view(def.id);
    if (!v) return 'coming soon';
    var needs = v.needs ? [].concat(v.needs) : [];
    if (needs.indexOf('webgl') >= 0) {
      var s3 = PX.core.stage3d;
      var ok = false;
      try { ok = !!(s3 && s3.available()); } catch (e) { ok = false; }
      if (!ok) return 'This exercise draws in 3D, and 3D graphics (WebGL) are not available in this browser' + (s3 && s3.reason ? ': ' + s3.reason() : '') + '.';
    }
    return null;
  }

  function explain(def, why) {
    var name = def ? def.short : 'This exercise';
    var soon = why === 'coming soon';
    return ui.modal({
      title: soon ? name + ' is coming soon' : name + ' is not available here',
      className: 'px-soon',
      body: [
        h('p', soon ? 'Its screen is still being built. It will appear in the Library with its own How to play as soon as it is ready.' : why),
        h('p.px-meta', soon ? 'Your other exercises and your progress are not affected.' : 'Other exercises still work. Try another browser or device for this one.'),
      ],
      actions: [{ label: 'OK', kind: 'secondary', autofocus: true }],
    });
  }

  function start(def, route) {
    var why = unavailable(def);
    if (why) { explain(def, why); return false; }
    PX.core.router.go('play', route);
    return true;
  }

  function experimental(def) { return !!def && (def.experimental === true || def.id === 'homing'); }
  function tags(def) {
    var out = [];
    if (def.practice === 'attention') out.push({ text: 'attention practice', kind: 'signal' });
    if (def.practice === 'perception') out.push({ text: 'perceptual-judgement practice', kind: 'signal' });
    if (def.pat === true) out.push({ text: 'DAT-style', kind: null });
    if (experimental(def)) out.push({ text: 'experimental', kind: 'warn' });
    return out;
  }
  function tagEls(def, extra, inGroup) {
    // inGroup: a card inside the DAT-style group, whose heading already says it
    return tags(def).filter(function (t) { return !(inGroup && t.text === 'DAT-style'); }).concat(extra || [])
      .map(function (t) { return h('span', { class: ['px-tag', t.kind ? 'px-tag--' + t.kind : null] }, t.text); });
  }

  function modeName(m) { return hasOwn.call(MODES, m) ? MODES[m] : m ? m.charAt(0).toUpperCase() + m.slice(1) : 'Unknown'; }
  function pct(x) { return isNum(x) ? Math.round(x * 100) + ' %' : '–'; }
  // O5: the one answer-time format of every screen (js/core/util.js)
  function secs(ms) { return U.fmtSecs ? U.fmtSecs(ms) : isNum(ms) ? U.round(ms / 1000, 1) + ' s' : '–'; }
  function when(t) { return PX.ui.kit ? PX.ui.kit.fmtWhen(t) : U.fmtDate(t, 'datetime'); }
  function ago(t, now) {
    if (!isNum(t)) return 'never';
    var d = Math.floor((U.dayNum(U.dayKey(now)) - U.dayNum(U.dayKey(t))));
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
  }

  /* ---------- How to play ---------- */

  function playApi(name) { return PX.ui.play && typeof PX.ui.play[name] === 'function' ? PX.ui.play[name] : null; }

  // The fallback sheet when the player is not loaded: the goal, the labelled parts, the keys.
  function howToSheet(def) {
    var L = PX.ex.learn(def.id);
    if (!L) { explain(def, 'coming soon'); return null; }
    var parts = (L.parts || []).map(function (p) {
      return h('li', h('b', p.label), p.variant ? h('span.px-meta', ' (' + variantName(def, p.variant) + ')') : null, h('span', p.text));
    });
    return ui.modal({
      title: 'How to play ' + def.short, className: 'px-howto',
      body: [
        h('p.px-howto-goal', L.goal || ''),
        parts.length ? h('ul.px-howto-parts', parts) : null,
        h('p.px-meta', 'Keys: 1–9 pick an option, Enter confirms, Space goes on, Esc pauses, S shows the solution.'),
      ],
      actions: [{ label: 'Close', kind: 'secondary' }],
    });
  }

  function howTo(def) {
    var f = playApi('howTo');
    if (f && !unavailable(def)) { try { return f(def.id); } catch (e) { if (window.console) console.error('PX.ui.play.howTo failed:', e); } }
    return howToSheet(def);
  }
  function watch(def) {
    var why = unavailable(def);
    if (why) { explain(def, why); return; }
    var f = playApi('watch');
    if (f) { try { f(def.id); return; } catch (e) { if (window.console) console.error('PX.ui.play.watch failed:', e); } }
    ui.toast('The demo plays in the trainer, which is not in this build yet. How to play describes it.', { kind: 'info' });
  }

  /* ---------- Practise ---------- */

  function protocolsOf(def) {
    var P = E().threshold ? E().threshold.PROTOCOLS : {}, out = [];
    Object.keys(P).forEach(function (pid) {
      if (P[pid].ex !== def.id) return;
      var pr = E().threshold.protocol(pid);
      out.push({ id: pid, name: PROTOCOL_NAMES[pid] || pid, label: P[pid].label, ok: !pr.unavailable, why: pr.unavailable || null });
    });
    return out;
  }

  // Every way to practise one exercise: [{ id, title, desc, ok, why, run() }].
  // Never played: no answer on any screen class and its Watch, Try, Go not seen (the player's
  // record of tutorials, rec.tour.seen).
  function neverPlayed(rec, def, now) {
    var seen = rec.tour && rec.tour.seen && rec.tour.seen[def.id] === true;
    return !seen && !(level(rec, def, now).total > 0);
  }

  function practiseOptions(def, rec, now) {
    var id = def.id, out = [], disp = display(), fresh = neverPlayed(rec, def, now);
    var ps = rec.path && rec.path[id], stage = ps && isNum(ps.stage) ? ps.stage : 1;
    // The tutorial comes first for every exercise, and is the default for one never played
    // (fresh-player tests: a newcomer who taps Practise must meet it).
    out.push({ id: 'watch', title: 'Watch, Try, Go', primary: fresh, tag: fresh ? 'start here' : null,
      desc: 'Learn it first: a slow demo with captions, a few practice items that don’t count, then easy items that do.',
      when: 'Right when ' + def.short + ' is new to you, or you want to see how it is solved again.',
      ok: true, run: function () { watch(def); } });
    out.push({ id: 'train', title: 'Train, with ' + def.short + ' as focus', primary: !fresh,
      desc: 'A session at your target success: ' + def.short + ' leads, mixed with two other exercises.', when: MODE_WHEN.train,
      ok: true, run: function () { start(def, { mode: 'train', exId: id, pin: id }); } });
    out.push({ id: 'path', title: 'Path, stage ' + stage + ' of 10',
      desc: 'Blocked practice, one tenth of the range at a time. A stage passes when your success stays high.', when: MODE_WHEN.path,
      ok: true, run: function () { start(def, { mode: 'path', exId: id }); } });
    var sp = { ok: false, why: '' };
    try { sp = E().speed.open(rec, def, { display: disp }); } catch (e) { sp = { ok: false, why: 'Speed is not available.' }; }
    out.push({ id: 'speed', title: 'Speed', desc: sp.ok ? 'Items you answer well, against a deadline that adapts to you. It has its own timed level.' : sp.why, when: MODE_WHEN.speed,
      ok: !!sp.ok, why: sp.ok ? null : sp.why, run: function () { start(def, { mode: 'speed', exId: id }); } });
    protocolsOf(def).forEach(function (pr) {
      out.push({ id: 'threshold:' + pr.id, title: 'Threshold: ' + pr.name, desc: pr.label + '. Changes no level.', when: MODE_WHEN.threshold, ok: pr.ok, why: pr.why,
        run: function () { start(def, { mode: 'threshold', protocol: pr.id, exId: id }); } });
    });
    out.push({ id: 'free', title: 'Free play', desc: 'Choose adaptive or fixed settings, a timer and the length. Logged, never rated.', when: MODE_WHEN.free, ok: true,
      run: function () { freePlay(def); } });
    out.push({ id: 'challenge', title: 'Challenge a friend', desc: 'A code for the same 8 items at your level. Your friend pastes it into Play a challenge.', ok: true,
      run: function () {
        var why = unavailable(def);
        if (why) { explain(def, why); return; }
        var lv = level(rec, def, now);
        PX.ui.share.challenge.share({ exId: id, params: lv.params || {}, n: 8 });
      } });
    return out;
  }

  function optionList(def, rec, now, onPick) {
    var list = h('ul.px-practise', { 'data-unavailable': unavailable(def) ? '' : null });
    practiseOptions(def, rec, now).forEach(function (o) {
      var b = h('button', { type: 'button', class: ['px-practise-item', o.primary ? 'is-primary' : null], 'data-practise': o.id, 'aria-disabled': o.ok ? null : 'true' },
        h('b', o.title, o.tag ? h('span.px-tag.px-practise-tag', o.tag) : null), h('span', o.desc), o.when ? h('span.px-practise-when', o.when) : null);
      if (o.primary) b.setAttribute('data-autofocus', ''); // the sheet opens on the default choice
      b.addEventListener('click', function () {
        if (!o.ok) { ui.toast(o.why || 'Not available yet.', { kind: 'info' }); return; }
        if (onPick) onPick();
        o.run();
      });
      list.appendChild(h('li', b));
    });
    return list;
  }

  // The player's Free play setup (exercise preselected): format, settings, timer, length.
  function freePlay(def) { return start(def, { mode: 'free', exId: def.id }); }

  function practiseSheet(def, rec, now) {
    var close = null;
    close = ui.modal({
      title: 'Practise ' + def.short, className: 'px-sheet px-practise-sheet',
      body: [optionList(def, rec, now, function () { if (close) close(); })],
    });
    if (close.el && close.el.parentNode) close.el.parentNode.classList.add('px-modal-backdrop--sheet');
    return close;
  }

  /* ---------- pieces ---------- */

  function levelBlock(def, lv, big) {
    if (!lv.n) {
      var other = lv.total > 0 && def.perDisplay;
      return h('div.px-lvl.is-empty', h('p.px-lvl-empty', other
        ? 'No level on ' + (display() === 'small' ? 'small' : 'larger') + ' screens yet. ' + def.short + ' is rated separately by screen size, and your ' + lv.total + ' answers so far were on ' + (display() === 'small' ? 'larger' : 'small') + ' screens.'
        : 'No level yet. It appears after your first few items, with a range that narrows as you practise.'));
    }
    var bar = ui.bar(lv.level, 100, { band: [lv.lo, lv.hi], label: def.short + ' level', kind: 'signal' });
    bar.setAttribute('aria-valuetext', levelText(lv.level) + ', likely between ' + lv.lo + ' and ' + lv.hi);
    var sb = lv.starter;
    return h('div', { class: ['px-lvl', big ? 'px-lvl--big' : null] },
      h('div.px-lvl-row',
        h('div.px-lvl-bar', bar),
        h('div.px-lvl-num', { 'aria-hidden': 'true' }, h('b', String(lv.level)), h('span', lv.lo + '–' + lv.hi))),
      lv.level <= 1 && def.starter ? h('p.px-lvl-starter', { 'data-starter': '' }, 'Starter items' +
        (sb && isNum(sb.needOf5) ? ': level 2 comes at about ' + sb.needOf5 + ' of 5 right over a block.' : '.')) : null,
      lv.settings ? h('p.px-lvl-set', 'Handles ', lv.settings.charAt(0).toLowerCase() + lv.settings.slice(1), '.') : null,
      def.perDisplay ? h('p.px-meta', 'Rated separately on small and larger screens; this is your level on ' + (display() === 'small' ? 'small' : 'larger') + ' screens.') : null);
  }

  function pathInfo(rec, def) {
    var ps = rec.path && rec.path[def.id];
    var stage = ps && isNum(ps.stage) ? ps.stage : 1, passed = ps && ps.passed ? Object.keys(ps.passed).length : 0;
    return { stage: stage, passed: passed, started: !!(ps && ps.items > 0) };
  }

  function stateTags(def, lv, why, due) {
    var out = [];
    if (why === 'coming soon') out.push({ text: 'coming soon', kind: null });
    else if (why) out.push({ text: 'not available here', kind: 'warn' });
    if (!lv.n && NEW_IN[def.id] && !why) out.push({ text: 'new in ' + NEW_IN[def.id], kind: null });
    if (lv.n && due && due.due) out.push({ text: 'review due', kind: null });
    return out;
  }

  function factsList(rows) {
    return h('dl.px-facts', rows.filter(Boolean).map(function (r) { return h('div', h('dt', r[0]), h('dd', r[1])); }));
  }

  /* ---------- the Library ---------- */

  function card(def, rec, now) {
    var e = entry(def.id), lv = level(rec, def, now), why = unavailable(def), pi = pathInfo(rec, def);
    var due = null;
    try { due = E().schedule.due(rec, def, now); } catch (err) { due = null; }
    var name = h('button.px-excard-name', { type: 'button', 'data-go': 'exercise/' + def.id }, e.name);
    var practise = ui.button('Practise', { kind: 'secondary', small: true, onClick: function () { practiseSheet(def, PX.core.store.state, Date.now()); } });
    practise.setAttribute('data-card', 'practise');
    var how = ui.button('How to play', { kind: 'ghost', small: true, onClick: function () { howTo(def); } });
    how.setAttribute('data-card', 'howto');
    var more = ui.button('Details', { kind: 'ghost', small: true, go: 'exercise/' + def.id });
    return h('article', { class: ['px-panel', 'px-excard'], 'data-ex': def.id, 'data-state': why === 'coming soon' ? 'soon' : why ? 'off' : 'ready' },
      h('div.px-excard-head', PX.ui.kit.spec([e.code, e.kind, e.abilities.join(' ')]), h('span.px-excard-tags', tagEls(def, stateTags(def, lv, why, due), def.pat === true))),
      h('h2.px-excard-title', name, NAME_TAIL[def.id] ? h('span.px-excard-tail', ' · ' + NAME_TAIL[def.id]) : null),
      e.blurb ? h('p.px-excard-blurb', e.blurb) : null,
      CARD_NOTE[def.id] ? h('p.px-meta.px-excard-note', CARD_NOTE[def.id]) : null,
      levelBlock(def, lv),
      factsList([
        ['Path', 'stage ' + pi.stage + ' of 10' + (pi.passed ? ', ' + pi.passed + ' passed' : '')],
        lv.n ? ['Answers', String(lv.n) + ', last ' + ago(lv.last, now)] : null,
      ]),
      h('div.px-excard-actions', practise, how, more));
  }

  function renderLibrary(host) {
    var rec = PX.core.store.state, now = Date.now(), list = defs();
    var main = list.filter(function (d) { return d.pat !== true; }), pat = list.filter(function (d) { return d.pat === true; });
    var started = list.filter(function (d) { return level(rec, d, now).n > 0; }).length;
    host.appendChild(h('div.px-screen-head',
      h('p.px-screen-meta', list.length + ' training exercises · ' + (started ? started + ' started' : 'none started yet')),
      h('h1', 'Library'),
      h('p.px-lead', 'Every exercise with your level, how to play it, and the ways to practise it. Tasks used to measure change are kept out of training, so they are not here.')));
    var box = PX.ui.share && PX.ui.share.challenge ? PX.ui.share.challenge.box({ className: 'px-panel px-lib-challenge' }) : null;
    if (box) host.appendChild(box);
    var grid = h('div.px-excards', { 'data-group': 'main' });
    main.forEach(function (def) { grid.appendChild(card(def, rec, now)); });
    host.appendChild(grid);
    if (pat.length) host.appendChild(patGroup(pat, rec, now));
    if (!started) {
      host.appendChild(h('p.px-lib-foot', 'New here? Today’s session picks three exercises for you. ',
        ui.button('Go to Today', { kind: 'ghost', small: true, go: 'home' })));
    }
  }

  /* ---------- the DAT-style formats (v1.1 PLAN M5; R3 §6, §8.0, §9) ---------- */

  // How long a Section is here, from the engine (parts missing in this build shorten it).
  function sectionText() {
    var S = E().section;
    if (!S || typeof S.shape !== 'function') return null;
    var o = { can: function (d) { return !unavailable(d); } }; // as the Section screen counts them
    var mini = S.shape('mini', o), full = S.shape('full', o);
    if (!mini.items) return null;
    return { mini: mini, full: full, text: 'a mini section of ' + mini.items + ' items in ' + S.fmtMinutes(mini.budgetMs) + ', or a full one of ' + full.items + ' items in ' + S.fmtMinutes(full.budgetMs) };
  }

  function patGroup(list, rec, now) {
    var O = PX.ui.overlap, K = PX.ui.kit, store = PX.core.store;
    var panel = h('div.px-panel.px-lib-pat');
    if (O) {
      panel.appendChild(K.toggle({
        key: 'patFocus', label: 'DAT-style focus', checked: rec.settings.patFocus === true,
        hint: 'On: these formats join Train and Today’s plan. Off: they stay here, in Free play and in Section practice.',
        onChange: function (on) {
          O.setFocus(store.state, on, Date.now());
          store.save();
          PX.bus.emit('settings', { key: 'patFocus', value: !!on });
        },
      }));
    }
    var st = sectionText();
    if (st) {
      var go = function (size) {
        var b = ui.button(size === 'mini' ? 'Mini section' : 'Full section', { kind: size === 'mini' ? 'primary' : 'secondary', small: true, go: 'section?size=' + size });
        b.setAttribute('data-section-start', size);
        return b;
      };
      panel.appendChild(h('div.px-lib-section', { 'data-lib': 'section' },
        h('h3', 'Section practice'),
        h('p', 'The parts in the test’s order against one clock: ' + st.text + '. No feedback until a review at the end, with a show-me for every item; your levels do not change.'),
        h('div.px-data-row', go('mini'), go('full'))));
    }
    panel.appendChild(h('p.px-lib-pat-use', 'These formats appear in the Perceptual Ability Test of the Dental Admission Test. ',
      h('span.px-limit', 'Practice on a format usually raises scores on that format. Parallax has not measured any effect on DAT scores, and PAT scores relate only modestly to dental-school grades.')));
    if (O) panel.appendChild(h('p.px-meta.px-overlap-legal', O.ADA));
    var grid = h('div.px-excards', { 'data-group': 'pat' });
    list.forEach(function (def) { grid.appendChild(card(def, rec, now)); });
    return h('section.px-lib-group', { 'data-group': 'pat', 'aria-labelledby': 'px-lib-pat-h' },
      h('div.px-lib-group-head',
        h('h2', { id: 'px-lib-pat-h' }, 'DAT-style formats'),
        h('p.px-lead', 'Practice in the six question formats of the Perceptual Ability Test (PAT) of the Dental Admission Test (DAT®). Every item is generated by Parallax.')),
      panel, grid);
  }

  /* ---------- one exercise ---------- */

  var LIMIT = 'Practice improves the practised task and often similar spatial tests. Effects on grades, work, sport or IQ have not been shown.';
  var STRAT_KIND = { imagery: 'picture it', analytic: 'reason it out', switch: 'switch between them' };

  function section(title, kids, attrs) {
    var p = PX.ui.kit.panel({ title: title, className: 'px-ex-section' });
    if (attrs) for (var k in attrs) if (hasOwn.call(attrs, k)) p.el.setAttribute(k, attrs[k]);
    [].concat(kids).forEach(function (k) { if (k) p.body.appendChild(k); });
    return p.el;
  }

  function strategyCards(L) {
    var list = (L && L.strategies) || [];
    if (!list.length) return null;
    return h('div.px-strats', list.map(function (s) {
      return h('article.px-strat', { 'data-strategy': s.id },
        h('p.px-strat-kind', STRAT_KIND[s.id] || s.id),
        h('h3', s.title),
        s.text ? h('p', s.text) : null,
        s.steps && s.steps.length ? h('ol.px-strat-steps', s.steps.map(function (t) { return h('li', t); })) : null,
        s.when ? h('p.px-strat-when', h('b', 'When: '), s.when) : null);
    }));
  }

  // v1.2 wave 2 (CONTRACT-v1.2 R): lines other modules add to the page's first section (the bet, the
  // settings handled per dimension, the last plateau change), by their order.
  function exerciseLines(def, rec, now) {
    var Hk = PX.ui.hooks, res = [];
    if (!Hk) return [];
    try { res = Hk.collect('exercise:lines', { def: def, rec: rec, now: now, where: 'page' }); } catch (e) { if (window.console) console.error('PX.ui.library: exercise:lines failed', e); return []; }
    return res.map(function (x, i) {
      var el = x && x.nodeType === 1 ? x : x && x.el && x.el.nodeType === 1 ? x.el : null;
      return el ? { el: el, order: x && typeof x.order === 'number' && isFinite(x.order) ? x.order : 50, i: i } : null;
    }).filter(Boolean).sort(function (a, b) { return a.order - b.order || a.i - b.i; }).map(function (x) { return x.el; });
  }

  function renderExercise(host, route) {
    var def = PX.ex.get(route.arg);
    var rec = PX.core.store.state, now = Date.now();
    host.appendChild(h('p.px-back', ui.button('Library', { kind: 'ghost', small: true, go: 'library', ariaLabel: 'Back to the Library' })));
    if (!def || def.role !== 'train') {
      host.appendChild(h('div.px-screen-head', h('h1', 'Exercise not found'),
        h('p.px-lead', def ? 'This task is a Spatial Check probe: it is never trained, so it has no page here.' : 'There is no exercise called “' + route.arg + '” in this version.')));
      return;
    }
    var e = entry(def.id), L = PX.ex.learn(def.id), lv = level(rec, def, now), why = unavailable(def), pi = pathInfo(rec, def);
    var best = rec.ex && rec.ex[def.id] && rec.ex[def.id].best && rec.ex[def.id].best.block;
    host.appendChild(h('div.px-screen-head.px-ex-head',
      h('p.px-screen-meta', PX.ui.kit.spec([e.code, e.kind, e.abilities.join(' ')])),
      h('h1', e.name, NAME_TAIL[def.id] ? h('span.px-ex-tail', ' · ' + NAME_TAIL[def.id]) : null, ' ', h('span.px-ex-tags', tagEls(def, stateTags(def, lv, why, null)))),
      h('p.px-lead', (L && L.goal) || e.blurb)));
    if (def.practice === 'attention') host.appendChild(h('p.px-notice.px-ex-note', PX.ui.kit.icon('about'), h('span', 'Track is attention practice: it trains following several moving objects at once, which relates to attention and working memory rather than to visuospatial ability, and evidence that its gains carry over to other tasks is weak.')));
    if (def.practice === 'perception' && L && L.labelLine) host.appendChild(h('p.px-notice.px-ex-note', PX.ui.kit.icon('about'), h('span', L.labelLine)));
    // O43: one plain line here; the research terms wait below How to play, after the rule
    if (experimental(def)) host.appendChild(h('p.px-notice.px-ex-note', { 'data-note': 'experimental' }, PX.ui.kit.icon('about'),
      h('span', def.short + ' is experimental: its items are new and still being tested.' + (EXPERIMENTAL[def.id] ? ' More under “About this exercise” below.' : ''))));
    var adaBelow = !!(L && typeof L.bridge === 'string' && /American Dental Association/.test(L.bridge)); // the bridge carries the ADA line
    var ov = PX.ui.overlap ? PX.ui.overlap.noteNode(def.id, 'px-notice px-ex-note', { legal: !adaBelow }) : null;
    if (ov) host.appendChild(ov);
    if (why) host.appendChild(h('p.px-notice.px-notice--warn.px-ex-note', PX.ui.kit.icon('warn'), h('span', why === 'coming soon' ? 'This exercise is coming soon: its screen is still being built. Your level and its settings below are already kept.' : why)));

    var top = h('div.px-ex-top');
    var lvPanel = section('Your level', [
      levelBlock(def, lv, true),
      factsList([
        ['Path', 'stage ' + pi.stage + ' of 10' + (pi.passed ? ', ' + pi.passed + (pi.passed === 1 ? ' stage passed' : ' stages passed') : '')],
        ['Answers', lv.n ? lv.n + ', last ' + ago(lv.last, now) : 'none yet'],
        best ? ['Best whole block', levelText(best.level) + ' (' + Math.round(best.acc * 10) + ' of 10 right), ' + U.fmtDate(best.at, 'long')] : null,
      ]),
      lv.n ? h('div.px-data-row', ui.button('Learning curve', { kind: 'ghost', small: true, go: 'progress?ex=' + def.id }), ui.button('Trials in the Log', { kind: 'ghost', small: true, go: 'log?ex=' + def.id })) : null,
    ].concat(exerciseLines(def, rec, now)), { 'data-section': 'level' });
    var prPanel = section('Practise', [optionList(def, rec, now)], { 'data-section': 'practise' });
    top.appendChild(lvPanel);
    top.appendChild(prPanel);
    host.appendChild(top);

    var howKids = [];
    var watchBtn = ui.button('Watch, Try, Go', { kind: 'primary', onClick: function () { watch(def); } });
    watchBtn.setAttribute('data-ex-action', 'watch');
    var howBtn = ui.button('How to play', { kind: 'ghost', onClick: function () { howTo(def); } });
    howBtn.setAttribute('data-ex-action', 'howto');
    howKids.push(h('div.px-data-row', watchBtn, howBtn));
    if (L && L.parts && L.parts.length) {
      howKids.push(h('dl.px-parts', L.parts.map(function (p) {
        return h('div', h('dt', p.label, p.variant ? h('span.px-meta', ' · ' + variantName(def, p.variant)) : null), h('dd', p.text));
      })));
    } else if (!L) howKids.push(h('p.px-meta', 'How to play arrives with the exercise.'));
    host.appendChild(section('How to play', howKids, { 'data-section': 'howto' }));
    if (experimental(def) && EXPERIMENTAL[def.id]) host.appendChild(section('About this exercise', [h('p', EXPERIMENTAL[def.id])], { 'data-section': 'experimental' }));

    var strats = strategyCards(L);
    if (strats) host.appendChild(section('Strategies', [h('p.px-muted.px-ex-intro', 'Two ways to solve the same item. On rotation tasks, people who switch strategies tend to score higher; elsewhere this is untested, so try both.'), strats], { 'data-section': 'strategies' }));

    if (L && L.bridge) {
      var lim = /not been shown|not been studied|little or no|not established/i.test(L.bridge) ? null : h('p.px-limit', LIMIT);
      host.appendChild(section(def.practice === 'attention' || def.practice === 'perception' ? 'Where this skill is used' : 'Where spatial thinking is used', [h('p', L.bridge), lim], { 'data-section': 'bridge' }));
    }
    if (L && L.offscreen) {
      var o = L.offscreen;
      host.appendChild(section('Off-screen challenge', [
        h('h3.px-off-title', o.title),
        o.text ? h('p', o.text) : null,
        o.steps && o.steps.length ? h('ol.px-off-steps', o.steps.map(function (t) { return h('li', t); })) : null,
        o.note ? h('p.px-meta', o.note) : null,
      ], { 'data-section': 'offscreen' }));
    }

    // What changes as the level rises: the settings and the formats
    var rows = def.dims.map(function (d) {
      var vals = d.levels.map(function (v) { return valueText(d, v); });
      return h('div', h('dt', d.label), h('dd', vals.length > 8 ? vals[0] + ' to ' + vals[vals.length - 1] + ' (' + vals.length + ' steps)' : vals.join(', ')));
    });
    var fmts = def.variants ? h('ul.px-formats', def.variants.map(function (v) {
      return h('li', h('b', cap(variantName(def, v))), L && L.goals && L.goals[v] ? h('span', L.goals[v]) : null);
    })) : null;
    host.appendChild(section('What changes as you go up', [
      h('p.px-muted.px-ex-intro', 'Items get harder along these settings. Your level is placed on this exercise’s own range: level 1 is its easiest item, level 100 its hardest.'),
      h('dl.px-facts.px-facts--dims', rows),
      def.dims.some(function (d) { return /cw\/s/.test(d.unit || ''); }) ? h('p.px-meta', 'cw/s: widths of the box per second, Parallax’s own unit of speed.') : null,
      fmts ? h('p.px-setting-label', 'Formats') : null, fmts,
    ], { 'data-section': 'settings' }));
  }

  PX.ui.exinfo = {
    defs: defs, entry: entry, display: display, level: level, settingsText: settingsText, paramsText: paramsText,
    variantName: variantName, valueText: valueText, dimText: dimText, unavailable: unavailable, explain: explain, start: start, // dimText(def, dim, value): '10 cubes', 'board turned 90°'… (Free play's labels)
    tags: tags, tagEls: tagEls, modeName: modeName, pct: pct, secs: secs, when: when, ago: ago,
    protocolsOf: protocolsOf, PROTOCOL_NAMES: PROTOCOL_NAMES, MODES: MODES, MODE_WHEN: MODE_WHEN, levelText: levelText,
  };
  PX.ui.library = { practiseSheet: practiseSheet, freePlay: freePlay, howTo: howTo, watch: watch, options: practiseOptions };
  PX.ui.screens = PX.ui.screens || {};
  PX.ui.screens.library = { title: 'Library', render: renderLibrary };
  PX.ui.screens.exercise = {
    title: function (route) { var d = route && PX.ex.get(route.arg); return d ? d.short : 'Exercise'; },
    render: renderExercise,
  };
})(window.PX);
