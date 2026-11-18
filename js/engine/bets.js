/* PX.engine.bets: the transfer bets and the add-on layers' bet trials (v1.2 wave 2; PLAN milestone 4;
   docs/dev/CONTRACT-v1.2.md Q, S, T; docs/research/v1.2/T1-transfer-portfolio.md §3–§5;
   docs/dev/v1.2/measure-sim.md §8; ENGINE.md §22). Pure: every call takes the record and `now`;
   randomness comes from PX.rng only; nothing reads the clock, storage or the DOM.

   The bets (CLAUDE.md rule 15): every training exercise names one in its definition (`def.bet`).
     VERSION                 BETS_VERSION, written into the exports (a change of wording or grade bumps it)
     IDS, INFO[id]           { label, line, mechanism, grade, evidence, isNew }: the words the exercise page,
                             How to play, About, the Lab and the guide use (the guide quotes `line`)
     GRADES[grade]           what a grade means (note T1 §3)
     of(def) / exercises(bet) / byExercise() / formats()   lookups (the export header's tables)

   The add-on layers (note T1 §4): comparison rounds ('compare'), bridge sets ('bridge'), draw-the-answer
   variants ('produce') and detailed calibration feedback ('calib'). An exercise hosts a layer when its
   definition says so (`def.layers`, CONTRACT S) and its content is registered (register(exId, content)
   from js/ex/<id>/layers.js). A within-player crossover switches each layer on or off per unit for
   periods of at least 28 days and 8 Train or Path sessions (the later of the two), so the pooled exports
   form randomised trials (note T1 §5.3). Units are the near probe's strands (STRANDS; the exercises that
   share a strand go together); a host without a strand is a unit of its own with a fair coin. The draw
   for the strands is the one simulated in docs/dev/v1.2/measure-sim.md §8 (drawUnits).
     joined(rec)             the player is in the bet trials (setting `betTrials`, on by default)
     period(rec, now)        { n, from, until, cycle, half, started } (n from 1; virtual before the first)
     arm(rec, exId, layer, now) → 'on' | 'off' | null   null: the exercise does not host the layer, or the
                             player left the bet trials (every hosted layer then runs: active() is true)
     active(rec, exId, layer, now) → bool                 the layer runs for this exercise now
     due(rec, plan, exId, now, ctx) → { kind: 'compare' | 'bridge', principle, stage, set } | null
     Hooks: pick (order 30: the produce variant's share and the calib-detail layer → step.layer);
            finish (order 30: periods, assign events).
   Recording (callers save the record): compared(rec, plan, info, now), bridged(rec, plan, info, now),
   offscreen(rec, exId, challenge, did, now), expect(rec, bet, rating, when, now), join(rec, on, now).
   dose(rec) → per exercise and week, per bet and layer (the Lab and the research export). */
(function (PX) {
  'use strict';

  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;
  var U = PX.util;
  var E = PX.engine;
  var DAY = 86400000, WEEK = 7 * DAY;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }
  function cfg() { return E.config.bets; }
  function defOf(id) { return PX.ex && typeof PX.ex.get === 'function' ? PX.ex.get(id) : null; }

  /* ---------- the bets (note T1 §3.1–3.2; numbers from §2.3) ---------- */

  var VERSION = 1;
  var IDS = ['attention', 'load', 'variety', 'strategy', 'compare', 'bridge', 'produce', 'calibrate', 'format'];
  var INFO = {
    attention: { label: 'Attention control', grade: 'C', mechanism: 'Top-down control of attention',
      line: 'Following several moving objects against distraction exercises the control of attention that other tasks draw on.',
      evidence: 'Action-game training improved top-down attention (g = 0.52); training on tracking itself gives large gains on that task and little transfer.' },
    load: { label: 'Load at the edge', grade: 'C', mechanism: 'A steady gap between demand and capacity',
      line: 'Working at the edge of what you can hold stretches what you can hold.',
      evidence: 'Working-memory training carried over to tasks like the trained one (d = 0.54 to 0.90) and barely beyond them (0.11 to 0.16).' },
    variety: { label: 'Variety', grade: 'B', mechanism: 'Learning the process when no shortcut works',
      line: 'When no shortcut works, you practise the transformation itself, and other tasks use it too.',
      evidence: 'Rotation and paper-folding practice carried over to each other; spatial training transferred across kinds of task about as well as within one (0.55 against 0.51).' },
    strategy: { label: 'Named strategies', grade: 'B-', mechanism: 'Portable routines and a flexible choice between them',
      line: 'Two named ways to solve, and knowing when to switch, carry over to new problems.',
      evidence: 'Teaching both an imagery and an analytic strategy closed a gap on chemistry problems; checking a figure’s overall shape went with accurate rotation (r = .37).' },
    compare: { label: 'Comparison', grade: 'B/D', mechanism: 'Analogical encoding: the shared rule of two cases',
      line: 'Seeing what two different problems share makes the shared rule easier to spot elsewhere.',
      evidence: 'Comparing two cases taught principles better than other ways of studying them (d = 0.50; 1.18 when the principle was given after the comparison); on spatial transfer it is untested.' },
    bridge: { label: 'Bridging', grade: 'C/D', mechanism: 'Mapping the practised task onto real settings',
      line: 'Solving the same kind of problem in real settings helps you notice where it applies.',
      evidence: 'In a game, choosing the reason for each move from a list helped on a transfer level (d = 1.20 and 0.71) while typing it did not; whole programmes give mixed results.' },
    produce: { label: 'Producing the answer', grade: 'C', mechanism: 'A complete prediction, made visible and checked',
      line: 'Building the answer yourself, before seeing options, builds a fuller picture in your head.',
      evidence: 'Sketching a prediction before seeing the answer helped on new items (d = 0.51 over predicting without a sketch, 0.58 over copying).' },
    calibrate: { label: 'Calibration', grade: 'D', isNew: true, mechanism: 'Recalibrating an intuitive estimate with exact feedback',
      line: 'Exact feedback on your estimates corrects a habit you may also use away from the game.',
      evidence: 'Feedback on every trial removed an overshoot within one session of a steering task; whether such a correction carries over to other tasks has not been tested, which makes this the new bet.' },
    format: { label: 'Format practice', grade: 'A', mechanism: 'The same task routines (identical elements)',
      line: 'Practising a test’s own question types builds the routines those question types need.',
      evidence: 'Retest and coaching gains on a format are well established (coaching about 0.70 SD); they stay mostly with that format.' },
  };
  var GRADES = {
    A: 'Meta-analytic or replicated evidence for this kind of transfer.',
    B: 'Meta-analytic evidence for the mechanism in learning generally, or several controlled spatial studies.',
    'B-': 'Some controlled spatial studies, and correlations.',
    'B/D': 'Strong evidence for learning a principle; untested for spatial transfer.',
    C: 'One or a few controlled studies, near transfer only, or mixed results.',
    'C/D': 'Mixed results; untested for spatial skills.',
    D: 'Untested for spatial training: a new bet.',
  };

  function of(def) {
    var d = typeof def === 'string' ? defOf(def) : def;
    return d && typeof d.bet === 'string' && hasOwn.call(INFO, d.bet) ? d.bet : null;
  }
  function trainDefs() { return PX.ex && typeof PX.ex.list === 'function' ? PX.ex.list('train') : []; }
  function exercises(bet) { return trainDefs().filter(function (d) { return d.bet === bet; }).map(function (d) { return d.id; }); }
  function keyOf(d) { return d.id + '@' + (d.version || 1); }
  // The export header's tables (CONTRACT T): { 'id@v': bet } and { 'id@v': { <variant or *>: format } }.
  function byExercise() {
    var out = {};
    trainDefs().forEach(function (d) { if (of(d)) out[keyOf(d)] = d.bet; });
    return out;
  }
  function formats() {
    var out = {};
    (PX.ex && typeof PX.ex.list === 'function' ? PX.ex.list() : []).forEach(function (d) {
      var f = d.format;
      if (typeof f === 'string') out[keyOf(d)] = { '*': f };
      else if (isObj(f)) out[keyOf(d)] = U.deepCopy(f);
    });
    return out;
  }

  /* ---------- config (E.config.bets; configure('reset') restores it) ---------- */

  E.defaults('bets', {
    periodDays: 28, periodSessions: 8,       // a crossover period: the later of 4 weeks and 8 sessions (note T1 §5.3)
    modes: ['train', 'path'],                 // where the layers run and whose sessions count
    produceShare: 0.25,                       // the share of target items drawn in a produce variant
    compare: {
      perSession: 2, firstAfter: 10,          // at most two rounds a session; the first after the exercise's first block
      spacing: [3, 7, 14], recheck: 30,       // days to the next round of a principle; a retired principle's recheck
      retireAfter: 2, missGapDays: 1,         // two right picks with right apply items retire it; a round after two misses
      tries: 40,                              // seeds tried for a pair or an apply item
    },
    bridge: { everyDays: 14, sdMax: 0.6, perSession: 1 }, // note T1 §4.2
    calib: { window: 10, every: 5, keep: 20 },  // the detail note: over the last 10 answers, after every 5th
  });

  /* ---------- layer content (js/ex/<id>/layers.js) ---------- */

  var LAYER_IDS = ['compare', 'bridge', 'produce', 'calib'];
  var ROW_LAYER = { compare: 'compare-apply', produce: 'produce', calib: 'calib-detail', bridge: 'bridge' };
  var CONTENT = Object.create(null);
  // register(exId, { compare: { principles, statements, … }, bridge: { sets … }, offscreen: {…} })
  function register(exId, content) {
    if (typeof exId !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(exId) || !isObj(content)) throw new Error('PX.engine.bets.register: needs an exercise id and an object');
    if (CONTENT[exId]) throw new Error('PX.engine.bets.register("' + exId + '"): already registered');
    CONTENT[exId] = content;
    return content;
  }
  function content(exId) { return typeof exId === 'string' && CONTENT[exId] ? CONTENT[exId] : null; }
  // Does the exercise host the layer: its definition declares it and (compare, bridge) its content exists.
  function hosts(def, layer) {
    var d = typeof def === 'string' ? defOf(def) : def, L = d && isObj(d.layers) ? d.layers : null;
    if (!L || d.role !== 'train') return false;
    var c = content(d.id);
    if (layer === 'compare') return isArray(L.compare) && L.compare.length > 0 && !!(c && c.compare);
    if (layer === 'bridge') return typeof L.bridge === 'string' && !!(c && c.bridge);
    if (layer === 'produce') return typeof L.produce === 'string' && isArray(d.variants) && d.variants.indexOf(L.produce) >= 0;
    if (layer === 'calib') return L.calib === true;
    return false;
  }
  function hostsOf(layer) { return trainDefs().filter(function (d) { return hosts(d, layer); }).map(function (d) { return d.id; }); }

  /* ---------- the crossover (note T1 §5.3; docs/dev/v1.2/measure-sim.md §8) ---------- */

  var STRANDS = ['turn', 'fold-back', 'cut-back', 'net-back', 'view-from', 'where-am-I'];
  var STRAND_OF = { rotate: 0, spin: 0, fold: 1, slice: 2, nets: 3, views: 4, orient: 5, reckon: 5, homing: 5 };
  // Each layer's strand units, in the order of the simulation (its shuffle depends on the order).
  var UNITS = { compare: [0, 1, 2, 3, 4, 5], bridge: [0, 1, 2, 3, 4, 5], produce: [4, 1, 2], calib: [5] };

  // The draw of the simulation: a seeded shuffle of the units; the first half (⌈n/2⌉ or ⌊n/2⌋ by the draw)
  // is on in the first period of the cycle. Cycle 0 is exactly measure-cross.mjs's assign(); later cycles
  // draw afresh. → { <unit>: 1 | 2 } (the half of the cycle in which the unit's layer is on).
  function drawUnits(seed, layer, cycle) {
    var units = UNITS[layer] || [];
    var r = PX.rng(cycle ? PX.rng.hash('bet-assign', seed, layer, cycle) : PX.rng.hash('bet-assign', seed, layer)), u = units.slice();
    for (var i = u.length - 1; i > 0; i--) { var j = r.int(0, i); var x = u[i]; u[i] = u[j]; u[j] = x; }
    var k = u.length % 2 ? (r.chance(0.5) ? Math.ceil(u.length / 2) : Math.floor(u.length / 2)) : u.length / 2;
    var first = {};
    u.forEach(function (s, i) { first[s] = i < k ? 1 : 2; });
    return first;
  }
  // A host without a strand: a fair coin of its own per layer and cycle.
  function drawOwn(seed, layer, exId, cycle) {
    return PX.rng(PX.rng.hash('bet-assign-own', seed, layer, exId, cycle || 0)).chance(0.5) ? 1 : 2;
  }
  function unitOf(exId, layer) {
    var s = hasOwn.call(STRAND_OF, exId) ? STRAND_OF[exId] : null;
    return s !== null && (UNITS[layer] || []).indexOf(s) >= 0 ? s : null;
  }

  // The player's assignment seed: stored in rec.bets once written; until then derived the same way from
  // the record's own salt (a hash of its creation time), so reading never writes.
  function seedOf(rec) {
    var b = rec && isObj(rec.bets) ? rec.bets : null;
    if (b && isNum(b.seed) && b.seed >= 0) return b.seed >>> 0;
    var g = rec && isObj(rec.eng) ? rec.eng : null;
    var salt = g && isNum(g.salt) ? g.salt : PX.rng.hash('parallax-salt', rec && isNum(rec.created) ? rec.created : 0) & 0x7fffffff;
    return PX.rng.hash('bet-seed', salt) >>> 0;
  }
  function joined(rec) { return !(rec && isObj(rec.settings) && rec.settings.betTrials === false); }
  function periodsOf(rec) {
    var b = rec && isObj(rec.bets) ? rec.bets : null;
    return b && isArray(b.periods) ? b.periods.filter(isNum) : [];
  }
  // The period that holds `now`: n from 1; before the first one is stored, period 1 from now (virtual).
  function period(rec, now) {
    var P = periodsOf(rec), n = 1, from = now;
    if (P.length) {
      n = 1; from = P[0];
      for (var i = 1; i < P.length; i++) if (P[i] <= now) { n = i + 1; from = P[i]; }
    }
    var c = cfg();
    return { n: n, from: from, until: from + c.periodDays * DAY, cycle: Math.floor((n - 1) / 2), half: (n - 1) % 2 + 1, started: P.length > 0 };
  }
  function arm(rec, exId, layer, now) {
    if (LAYER_IDS.indexOf(layer) < 0 || !hosts(exId, layer) || !joined(rec)) return null;
    var p = period(rec, now), seed = seedOf(rec), u = unitOf(exId, layer);
    var half = u !== null ? drawUnits(seed, layer, p.cycle)[u] : drawOwn(seed, layer, exId, p.cycle);
    return half === p.half ? 'on' : 'off';
  }
  // The layer runs for this exercise now: on in its period, or always when the player left the trials.
  function active(rec, exId, layer, now) {
    if (!hosts(exId, layer)) return false;
    var a = arm(rec, exId, layer, now);
    return a === null ? !joined(rec) : a === 'on';
  }

  /* ---------- the record container (CONTRACT M: rec.bets; no day keys, no text) ----------
     { v: 1, seed, periods: [ms…] (the starts of periods 1, 2, …),
       cmp: { <exId>: { last, n, p: { <principle>: { n, ok, k, last, next, pend } } } },   comparison rounds
       brg: { <exId>: { last, n } },                                                     bridge sets
       off: { <exId>: { seen, last, did } },                                             off-screen challenges
       cal: { <exId>: [[tSec, value], …] },                                              the detail note's last answers
       exp: { <bet>: { baseline, w4, at } } }                                            expectation ratings */

  function slot(rec) {
    var b = rec.bets;
    if (!isObj(b)) b = rec.bets = { v: 1 };
    if (!isNum(b.seed)) b.seed = seedOf(rec);
    if (!isArray(b.periods)) b.periods = [];
    ['cmp', 'brg', 'off', 'cal', 'exp'].forEach(function (k) { if (!isObj(b[k])) b[k] = {}; });
    return b;
  }
  var EX_RE = /^[a-z][a-z0-9-]{0,39}$/, TOKEN_RE = /^[A-Za-z0-9_.:@-]{1,64}$/;
  function time(v) { return isNum(v) && v >= 0 && v < 8.64e15 ? Math.round(v) : undefined; }
  function cnt(v) { return isNum(v) && v >= 0 ? Math.round(v) : 0; }
  function mapOf(v, keyOk, fn) {
    var out = {};
    if (!isObj(v)) return out;
    Object.keys(v).forEach(function (k) {
      if (!keyOk(k) || k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      var x = fn(v[k]);
      if (x !== undefined) out[k] = x;
    });
    return out;
  }
  function fixPrinciple(x) {
    if (!isObj(x)) return undefined;
    var o = { n: cnt(x.n), ok: cnt(x.ok), k: cnt(x.k) };
    ['last', 'next'].forEach(function (k) { var t = time(x[k]); if (t !== undefined) o[k] = t; });
    if (isObj(x.pend) && (x.pend.choice === 0 || x.pend.choice === 1)) o.pend = { choice: x.pend.choice, at: time(x.pend.at) || 0 };
    if (x.retired === 1) o.retired = 1;
    return o;
  }
  // The owner's check (E.record.check): the parts present are repaired, nothing is added (a default
  // container stays { v: 1 }), unknown keys are kept.
  var PARTS = {
    cmp: function (x) {
      if (!isObj(x)) return undefined;
      var o = { n: cnt(x.n), p: mapOf(x.p, function (k) { return TOKEN_RE.test(k); }, fixPrinciple) }, t = time(x.last);
      if (t !== undefined) o.last = t;
      return o;
    },
    brg: function (x) {
      if (!isObj(x)) return undefined;
      var o = { n: cnt(x.n) }, t = time(x.last);
      if (t !== undefined) o.last = t;
      return o;
    },
    off: function (x) {
      if (!isObj(x)) return undefined;
      var o = { did: cnt(x.did) };
      ['seen', 'last'].forEach(function (k) { var t = time(x[k]); if (t !== undefined) o[k] = t; });
      return o;
    },
    cal: function (x) {
      if (!isArray(x)) return undefined;
      return x.filter(function (r) { return isArray(r) && r.length === 2 && isNum(r[0]) && r[0] >= 0 && isNum(r[1]); }).slice(-cfg().calib.keep);
    },
    exp: function (x) {
      if (!isObj(x)) return undefined;
      var o = {};
      ['baseline', 'w4'].forEach(function (k) { if (isNum(x[k]) && x[k] >= 1 && x[k] <= 5) o[k] = Math.round(x[k]); });
      var t = time(x.at);
      if (t !== undefined) o.at = t;
      return o;
    },
  };
  function check(v) {
    var out = U.deepCopy(v);
    if (hasOwn.call(v, 'seed')) {
      if (isNum(v.seed) && v.seed >= 0 && v.seed <= 4294967295) out.seed = Math.floor(v.seed);
      else delete out.seed;
    }
    if (hasOwn.call(v, 'periods')) {
      out.periods = (isArray(v.periods) ? v.periods : []).map(time).filter(function (t) { return t !== undefined; }).sort(function (a, b) { return a - b; })
        .filter(function (t, i, a) { return !i || t !== a[i - 1]; });
    }
    Object.keys(PARTS).forEach(function (k) {
      if (!hasOwn.call(v, k)) return;
      out[k] = mapOf(v[k], k === 'exp' ? function (b) { return hasOwn.call(INFO, b); } : function (id) { return EX_RE.test(id); }, PARTS[k]);
    });
    out.v = 1;
    return out;
  }
  // Two tabs (E.merge.register): the longer period list (ties: the earlier start); per exercise the entry
  // with the later `last`; the detail note's answers as a union; ratings from both, the first one kept.
  function merge(theirs, mine) {
    var a = isObj(theirs) ? check(theirs) : null, b = isObj(mine) ? check(mine) : null;
    if (!a || !b) return a || b || undefined;
    var PARTS6 = ['periods', 'cmp', 'brg', 'off', 'cal', 'exp'], had = {};
    PARTS6.forEach(function (k) {
      had[k] = hasOwn.call(a, k) || hasOwn.call(b, k);
      if (!hasOwn.call(a, k)) a[k] = k === 'periods' ? [] : {};
      if (!hasOwn.call(b, k)) b[k] = k === 'periods' ? [] : {};
    });
    var out = U.deepCopy(b);
    var pa = a.periods, pb = b.periods;
    out.periods = (pa.length !== pb.length ? pa.length > pb.length : (pa[0] || Infinity) < (pb[0] || Infinity)) ? pa.slice() : pb.slice();
    if (!isNum(out.seed) && isNum(a.seed)) out.seed = a.seed;
    ['cmp', 'brg', 'off'].forEach(function (k) {
      Object.keys(a[k]).forEach(function (id) {
        var x = a[k][id], y = out[k][id];
        if (!y || (x.last || 0) > (y.last || 0)) out[k][id] = x;
      });
    });
    Object.keys(a.cal).forEach(function (id) {
      var seen = {}, rows = (out.cal[id] || []).concat(a.cal[id]).filter(function (r) { var s = r.join(','); if (seen[s]) return false; seen[s] = 1; return true; });
      out.cal[id] = rows.sort(function (x, y) { return x[0] - y[0]; }).slice(-cfg().calib.keep);
    });
    Object.keys(a.exp).forEach(function (bet) {
      var x = a.exp[bet], y = out.exp[bet] || (out.exp[bet] = {});
      ['baseline', 'w4'].forEach(function (k) { if (y[k] === undefined && x[k] !== undefined) y[k] = x[k]; });
      if (y.at === undefined && x.at !== undefined) y.at = x.at;
    });
    PARTS6.forEach(function (k) { if (!had[k]) delete out[k]; });
    return out;
  }

  /* ---------- periods and assign events ---------- */

  function sessionsSince(rec, from) {
    var modes = cfg().modes, n = 0;
    (isArray(rec.sessions) ? rec.sessions : []).forEach(function (s) {
      if (isObj(s) && isNum(s.start) && s.start >= from && modes.indexOf(s.mode) >= 0) n++;
    });
    return n;
  }
  // The arm of a layer for an exercise in period n (the crossover, whatever the player's choice).
  function armAt(rec, exId, layer, n) {
    var cycle = Math.floor((n - 1) / 2), half = (n - 1) % 2 + 1, seed = seedOf(rec), u = unitOf(exId, layer);
    var h = u !== null ? drawUnits(seed, layer, cycle)[u] : drawOwn(seed, layer, exId, cycle);
    return h === half ? 'on' : 'off';
  }
  // One assign event per hosted layer and exercise when period n starts (CONTRACT O: 'assign').
  function assignEvents(rec, n, from, now) {
    if (!E.events || !joined(rec)) return 0;
    var k = 0, until = from + cfg().periodDays * DAY, seed = seedOf(rec);
    LAYER_IDS.forEach(function (layer) {
      hostsOf(layer).forEach(function (exId) {
        var u = unitOf(exId, layer);
        if (E.events.add(rec, 'assign', exId, { layer: layer, arm: armAt(rec, exId, layer, n), period: n, from: from, until: until, seed: seed, unit: u !== null ? STRANDS[u] : 'own' }, now)) k++;
      });
    });
    return k;
  }
  // After a Train or Path session: the first period starts with the first such session; a period ends
  // when it has lasted periodDays and held periodSessions sessions, and the next one starts at once.
  function advance(rec, plan, now) {
    var b = slot(rec), c = cfg();
    now = Math.round(now); // stored times are whole ms (the store's repair rounds them)
    if (!b.periods.length) {
      var t0 = Math.round(isNum(plan && plan.start) ? plan.start : now);
      b.periods.push(t0);
      return { started: 1, events: assignEvents(rec, 1, t0, now) };
    }
    var p = period(rec, now);
    if (p.n !== b.periods.length || now < p.until || sessionsSince(rec, p.from) < c.periodSessions) return null;
    b.periods.push(now);
    return { started: p.n + 1, events: assignEvents(rec, p.n + 1, now, now) };
  }

  /* ---------- dose rules (note T1 §4.1–4.2) ---------- */

  // What this session has used: plan.bets = { rounds, sets, ex: { <exId>: 1 } } (the plan is the session's).
  function planUse(plan) {
    if (!isObj(plan.bets)) plan.bets = { rounds: 0, sets: 0, ex: {}, setEx: {} };
    return plan.bets;
  }
  function inModes(plan) { return !!plan && cfg().modes.indexOf(plan.mode) >= 0; }
  function principles(def) {
    var c = content(def.id), want = def.layers && isArray(def.layers.compare) ? def.layers.compare : [];
    var list = c && c.compare && isArray(c.compare.principles) ? c.compare.principles : [];
    return list.filter(function (p) { return p && want.indexOf(p.id) >= 0; });
  }
  function ratedN(rec, def, plan) {
    try { return E.est.get(rec, def, { display: plan.display }).n || 0; } catch (e) { return 0; }
  }
  // The principle a round should take now, or null. ctx: { params (the step's), misses, newRun }.
  function compareDue(rec, plan, def, now, ctx, use) {
    var c = cfg().compare;
    if (!hosts(def, 'compare') || !active(rec, def.id, 'compare', now)) return null;
    if (use.rounds >= c.perSession || use.ex[def.id]) return null;
    if (ratedN(rec, def, plan) < c.firstAfter) return null;
    var st = rec.bets && isObj(rec.bets.cmp) && isObj(rec.bets.cmp[def.id]) ? rec.bets.cmp[def.id] : { n: 0, p: {} };
    var missed = (ctx.misses || 0) >= 2 && (!isNum(st.last) || now - st.last >= c.missGapDays * DAY);
    if (!ctx.newRun && !missed) return null;
    var best = null;
    principles(def).forEach(function (p) {
      if (typeof p.applies === 'function' && ctx.params && !p.applies(ctx.params)) return;
      var s = isObj(st.p) && isObj(st.p[p.id]) ? st.p[p.id] : null;
      var at = s ? (isNum(s.next) ? s.next : 0) : -1; // never taken: first
      if (!missed && at > now) return;
      if (!best || at < best.at) best = { p: p, s: s, at: at };
    });
    if (!best) return null;
    return { kind: 'compare', principle: best.p.id, stage: best.s && best.s.n >= 2 ? 2 : 1 };
  }
  function bridgeDue(rec, plan, def, now, ctx, use) {
    var c = cfg().bridge, cont = content(def.id);
    if (!ctx.newRun || !hosts(def, 'bridge') || !active(rec, def.id, 'bridge', now)) return null;
    if (use.sets >= c.perSession || use.ex[def.id]) return null;
    var st;
    try { st = E.est.get(rec, def, { display: plan.display }, now); } catch (e) { return null; }
    var bMin = cont.bridge && isNum(cont.bridge.b) ? cont.bridge.b : PX.ex.minDifficulty(def);
    if (!(st.n >= cfg().compare.firstAfter && st.sd <= c.sdMax && st.mu >= bMin)) return null;
    var last = rec.bets && isObj(rec.bets.brg) && isObj(rec.bets.brg[def.id]) ? rec.bets.brg[def.id].last : null;
    if (isNum(last) && now - last < c.everyDays * DAY) return null;
    return { kind: 'bridge', set: def.layers.bridge };
  }
  // The add-on due before the step's item (CONTRACT Q): a bridge set first (rarer), else a round.
  function due(rec, plan, exId, now, ctx) {
    if (!inModes(plan)) return null;
    var def = defOf(exId);
    if (!def || !isObj(def.layers)) return null;
    var use = planUse(plan);
    ctx = ctx || {};
    return bridgeDue(rec, plan, def, now, ctx, use) || compareDue(rec, plan, def, now, ctx, use);
  }

  /* ---------- comparison rounds: the pair, the menu and the apply item (note T1 §4.1) ----------
     A principle (content.compare.principles[]) is { id, claim: <statement id>, text: the principle in one
     sentence, applies(params)?, anyItem? (every item shows it: the apply item is the step's own),
     decides(item)? (the apply item must show it), vary(params, rng)? (stage 2: the second item's settings) }.
     A statement (content.compare.statements[]) is { id, text, test(item) → bool }. A round is valid when
     the claim is true of both items and every other statement offered is false of at least one of them
     (so the right one is never the odd one out, and no wrong one is true of both). */

  function gen(def, seed, params) {
    try { var it = def.generate(PX.rng(seed), params); return it && !it.fallback ? it : null; } catch (e) { return null; }
  }
  function stmtOf(cc, id) {
    var list = cc && isArray(cc.statements) ? cc.statements : [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }
  function truth(st, item) { try { return !!st.test(item); } catch (e) { return null; } }
  // round(exId, principle, params, seed, stage) → { exId, principle, stage, a: { seed, params, item }, b,
  // opts: [statement ids], correct (index), text } | null. Deterministic in its arguments.
  function round(exId, pid, params, seed, stage) {
    var def = defOf(exId), c = content(exId), cc = c && c.compare;
    var p = cc && isArray(cc.principles) ? cc.principles.filter(function (x) { return x && x.id === pid; })[0] : null;
    var claim = p ? stmtOf(cc, p.claim) : null;
    if (!def || !p || !claim) return null;
    var r = PX.rng(PX.rng.hash('bets-round', exId, pid, seed >>> 0, stage || 1)), first = null, tries = cfg().compare.tries;
    for (var k = 0; k < tries; k++) {
      var ps = first && stage === 2 && typeof p.vary === 'function' ? p.vary(params, r) : params;
      var sd = r.u32() & 0x7fffffff, it = ps ? gen(def, sd, ps) : null;
      if (!it || truth(claim, it) !== true) continue;
      if (!first) { first = { seed: sd, params: ps, item: it }; continue; }
      if (typeof p.pair === 'function' && !p.pair(first.item, it)) continue;
      var b = { seed: sd, params: ps, item: it };
      var pool = cc.statements.filter(function (st) {
        if (!st || st.id === claim.id) return false;
        var ta = truth(st, first.item), tb = truth(st, b.item);
        return ta !== null && tb !== null && !(ta && tb);
      });
      if (pool.length < 3) continue;
      var opts = r.shuffle([claim.id].concat(r.shuffle(pool).slice(0, 3).map(function (st) { return st.id; })));
      return { exId: exId, principle: pid, stage: stage || 1, a: first, b: b, opts: opts, correct: opts.indexOf(claim.id), text: p.text };
    }
    return null;
  }
  // The apply item's seed at the step's settings: the step's own when its item shows the principle (or
  // every item does), else the first of a few fresh training seeds (E.select.seed: the record's counter, so
  // the logged row's seed stays one the counter knows) whose item shows it and is decided by it. null: none.
  function applySeed(rec, exId, pid, params, seed) {
    var def = defOf(exId), c = content(exId), cc = c && c.compare;
    var p = cc && isArray(cc.principles) ? cc.principles.filter(function (x) { return x && x.id === pid; })[0] : null;
    var claim = p ? stmtOf(cc, p.claim) : null;
    if (!def || !p || !claim || (typeof p.applies === 'function' && !p.applies(params))) return null;
    if (p.anyItem) return seed >>> 0;
    function shows(it) { return !!it && truth(claim, it) === true && (typeof p.decides !== 'function' || p.decides(it)); }
    if (shows(gen(def, seed >>> 0, params))) return seed >>> 0;
    for (var k = 0, n = Math.min(cfg().compare.tries, 24); k < n; k++) {
      var sd = E.select.seed(rec);
      if (shows(gen(def, sd, params))) return sd;
    }
    return null;
  }

  /* ---------- recording (callers add between items, then save the record) ---------- */

  // A comparison round ended. info: { exId, principle, stage, a, aSeed, b, bSeed, choice, correct, rt,
  // apply (the apply item's seed, 0 when none), opts (statement ids in order), pos }.
  function compared(rec, plan, info, now) {
    var use = plan ? planUse(plan) : null, b = slot(rec), id = info.exId;
    now = Math.round(now);
    if (use) { use.rounds += 1; use.ex[id] = 1; }
    var st = b.cmp[id] || (b.cmp[id] = { n: 0, p: {} });
    st.n = cnt(st.n) + 1;
    st.last = now;
    if (!isObj(st.p)) st.p = {};
    var s = st.p[info.principle] || (st.p[info.principle] = { n: 0, ok: 0, k: 0 });
    s.n += 1;
    s.last = now;
    if (info.apply) s.pend = { choice: info.correct ? 1 : 0, at: now }; // judged with its apply item
    else settle(s, !!info.correct, now);
    return E.events ? E.events.add(rec, 'compare', id, {
      a: info.a, aSeed: info.aSeed, b: info.b, bSeed: info.bSeed, principle: info.principle, stage: info.stage, choice: info.choice,
      correct: !!info.correct, rt: info.rt, apply: info.apply || 0, opts: info.opts, pos: info.pos,
    }, now) : null;
  }
  // Spacing (note T1 §4.1): a right round (a right pick, and a right apply item when there was one) is
  // reviewed after 3, then 7, then 14 days; two right rounds in a row retire the principle until its
  // recheck after 30 days; a wrong round starts the spacing again at 3 days.
  function settle(s, ok, now) {
    var c = cfg().compare, sp = c.spacing;
    delete s.pend;
    if (ok) {
      s.ok += 1;
      if (s.ok >= c.retireAfter) { s.retired = 1; s.next = now + c.recheck * DAY; }
      else s.next = now + sp[Math.min(s.k, sp.length - 1)] * DAY;
      s.k += 1;
    } else {
      s.ok = 0; s.k = 0;
      delete s.retired;
      s.next = now + sp[0] * DAY;
    }
  }
  // The apply item of a round was answered (the engine's answer hook; step.betPrinciple names it).
  function applied(rec, step, ok, now) {
    var b = rec.bets, id = step && step.exId;
    now = Math.round(now);
    var s = b && isObj(b.cmp) && isObj(b.cmp[id]) && isObj(b.cmp[id].p) ? b.cmp[id].p[step.betPrinciple] : null;
    if (!isObj(s) || !isObj(s.pend)) return false;
    settle(s, s.pend.choice === 1 && !!ok, now);
    return true;
  }
  // A bridge set ended. info: { exId, set, map, mapOk, items: [[seed, code, outcome, rt]…], use, other, rt }.
  function bridged(rec, plan, info, now) {
    var use = plan ? planUse(plan) : null, b = slot(rec), id = info.exId;
    now = Math.round(now);
    if (use) { use.sets += 1; use.ex[id] = 1; }
    var st = b.brg[id] || (b.brg[id] = { n: 0 });
    st.n = cnt(st.n) + 1;
    st.last = now;
    return E.events ? E.events.add(rec, 'bridge', id, {
      set: info.set, map: info.map, mapOk: !!info.mapOk, items: info.items, use: info.use, other: !!info.other, rt: info.rt,
    }, now) : null;
  }
  // An off-screen challenge was viewed (did false) or reported done (did true).
  function offscreen(rec, exId, challenge, did, now) {
    var b = slot(rec), st = b.off[exId] || (b.off[exId] = { did: 0 });
    now = Math.round(now);
    if (!isNum(st.seen)) st.seen = now;
    st.last = now;
    if (did) st.did = cnt(st.did) + 1;
    return E.events ? E.events.add(rec, 'offscreen', exId, { challenge: challenge, did: !!did }, now) : null;
  }
  // An expectation rating (1–5) for a bet, at the baseline or at week 4 (a covariate, note T1 §5.3).
  function expect(rec, bet, rating, when, now) {
    if (!hasOwn.call(INFO, bet) || (when !== 'baseline' && when !== 'w4') || !(rating >= 1 && rating <= 5)) return null;
    var b = slot(rec), x = b.exp[bet] || (b.exp[bet] = {});
    x[when] = Math.round(rating);
    if (when === 'baseline') x.at = Math.round(now);
    return E.events ? E.events.add(rec, 'expect', null, { bet: bet, rating: Math.round(rating), when: when }, now) : null;
  }
  // The rating to ask for now among the bets of the session's exercises: a baseline once, then week 4.
  function expectDue(rec, bets, now) {
    var x = rec && isObj(rec.bets) && isObj(rec.bets.exp) ? rec.bets.exp : {};
    for (var i = 0; i < bets.length; i++) {
      var bet = bets[i], r = x[bet];
      if (!hasOwn.call(INFO, bet)) continue;
      if (!r || r.baseline === undefined) return { bet: bet, when: 'baseline' };
      if (r.w4 === undefined && isNum(r.at) && now - r.at >= 28 * DAY) return { bet: bet, when: 'w4' };
    }
    return null;
  }
  // The player joined (on) or left the bet trials; joining mid-period logs the current period's arms.
  function join(rec, on, now) {
    var ev = E.events ? E.events.add(rec, 'join', null, { on: !!on }, now) : null;
    if (on && periodsOf(rec).length) { var p = period(rec, now); assignEvents(rec, p.n, p.from, now); }
    return ev;
  }
  // The detail note's data: the last answers' signed values (an angle error, a correction ratio).
  function calibPush(rec, exId, value, now) {
    if (!isNum(value)) return;
    var b = slot(rec), list = isArray(b.cal[exId]) ? b.cal[exId] : (b.cal[exId] = []);
    list.push([Math.floor(now / 1000), Math.round(value * 1000) / 1000]);
    if (list.length > cfg().calib.keep) list.splice(0, list.length - cfg().calib.keep);
  }
  function calibSummary(rec, exId, n) {
    var list = rec && isObj(rec.bets) && isObj(rec.bets.cal) && isArray(rec.bets.cal[exId]) ? rec.bets.cal[exId] : [];
    var xs = list.slice(-(n || cfg().calib.window)).map(function (r) { return r[1]; });
    if (!xs.length) return { n: 0, mean: null, sd: null, abs: null };
    var m = xs.reduce(function (a, x) { return a + x; }, 0) / xs.length;
    var v = xs.reduce(function (a, x) { return a + (x - m) * (x - m); }, 0) / Math.max(1, xs.length - 1);
    return { n: xs.length, mean: m, sd: Math.sqrt(v), abs: xs.reduce(function (a, x) { return a + Math.abs(x); }, 0) / xs.length };
  }

  /* ---------- engine hooks (CONTRACT Q) ---------- */

  // pick (order 30): the calibration detail on every item of a calib host while it is on; a share of a
  // produce host's target items in its draw-the-answer variant, in place of the run's own variant (Train
  // only: Path keeps its stage filter).
  // The draw uses its own stream (E.select.rng), so the plan's other choices are never shifted.
  function pickHook(plan, rec, def, o, ctx) {
    if (!inModes(plan) || !def || !isObj(def.layers)) return null;
    var now = ctx && isNum(ctx.now) ? ctx.now : plan.lastAt, extra = null;
    if (hosts(def, 'calib') && active(rec, def.id, 'calib', now)) extra = { layer: ROW_LAYER.calib };
    if (plan.mode === 'train' && ctx && ctx.kind === 'target' && hosts(def, 'produce') && active(rec, def.id, 'produce', now)) {
      var r = E.select.rng(rec, 'bets:produce:' + plan.id + ':' + plan.pos);
      if (r.chance(cfg().produceShare)) {
        // only settings the variant can draw (Slice marks straight solids only: lib.produceOk)
        var pv = def.layers.produce, okFn = def.lib && typeof def.lib.produceOk === 'function' ? def.lib.produceOk : null;
        o.filter = function (c) { return c.params.variant === pv && (!okFn || okFn(c.params)); };
        extra = { layer: ROW_LAYER.produce };
      }
    }
    return extra;
  }
  // answer: a round's apply item settles its principle's spacing (right pick and right apply item).
  function answerHook(plan, rec, step, result, out, now) {
    if (!step || step.layer !== ROW_LAYER.compare || typeof step.betPrinciple !== 'string') return;
    if (out && (out.outcome === 0 || out.outcome === 1)) applied(rec, step, out.outcome === 1, now);
  }
  // finish (order 30): periods and their assign events, after a Train or Path session with answers.
  function finishHook(plan, rec, now, res) {
    if (!inModes(plan) || !res || !res.session) return;
    var a = advance(rec, plan, now);
    if (a) res.bets = { period: a.started, events: a.events };
  }
  if (E.modes && typeof E.modes.hook === 'function') {
    E.modes.hook('pick', pickHook, { id: 'bets.pick', order: 30 });
    E.modes.hook('answer', answerHook, { id: 'bets.apply', order: 30 });
    E.modes.hook('finish', finishHook, { id: 'bets.periods', order: 30 });
  }

  /* ---------- dose (the Lab and the research export; note T1 §5.3) ---------- */

  // Weeks count from the record's first trial or session (UTC seconds), never from local days.
  function dose(rec) {
    var rows = rec && isArray(rec.trials) ? rec.trials : [], t0 = null, PRACTICE = { train: 1, path: 1, speed: 1, free: 1, daily: 1, threshold: 1 };
    E.log.scan(rec, function (r) { if (t0 === null || r[0] < t0) t0 = r[0]; });
    (isArray(rec && rec.sessions) ? rec.sessions : []).forEach(function (s) {
      var t = isObj(s) && isNum(s.start) ? Math.floor(s.start / 1000) : null;
      if (t !== null && t0 !== null && t < t0) t0 = t; // a session starts before its first answer
    });
    var weeks = {}, bets = {}, layers = { compare: { rounds: 0, right: 0, apply: 0 }, bridge: { sets: 0, items: 0 }, produce: { items: 0 }, calib: { items: 0 }, offscreen: { seen: 0, did: 0 } };
    var stages = {}, exSessions = {};
    function wk(tSec) { return t0 === null ? 0 : Math.floor((tSec - t0) / (WEEK / 1000)); }
    E.log.scan(rec, function (r, exId, mode) {
      if (!exId || !hasOwn.call(PRACTICE, mode) || (r[5] !== 0 && r[5] !== 1)) return;
      var w = wk(r[0]), W = weeks[w] || (weeks[w] = {}), x = W[exId] || (W[exId] = { n: 0, rated: 0, ms: 0 });
      x.n++;
      if (mode === 'train' || mode === 'path') x.rated++;
      x.ms += isNum(r[6]) && r[6] > 0 ? Math.min(r[6], 120000) : 0;
      var bet = of(exId);
      if (bet) { var B = bets[bet] || (bets[bet] = { n: 0, ms: 0 }); B.n++; B.ms += isNum(r[6]) && r[6] > 0 ? Math.min(r[6], 120000) : 0; }
      var lay = r.length > 14 ? r[14] : 0;
      if (lay === 1) layers.compare.apply++;
      else if (lay === 2) layers.produce.items++;
      else if (lay === 3) layers.calib.items++;
      if (isNum(r[9])) stages[r[9]] = (stages[r[9]] || 0) + 1;
    });
    (isArray(rec && rec.sessions) ? rec.sessions : []).forEach(function (s) {
      if (!isObj(s) || !isNum(s.start) || !isArray(s.exs) || !hasOwn.call(PRACTICE, s.mode)) return;
      var w = wk(Math.floor(s.start / 1000));
      s.exs.forEach(function (id) {
        if (typeof id !== 'string') return;
        var W = weeks[w] || (weeks[w] = {}), x = W[id] || (W[id] = { n: 0, rated: 0, ms: 0 });
        x.sessions = (x.sessions || 0) + 1;
        (exSessions[id] || (exSessions[id] = [])).push(s.start);
      });
    });
    if (E.events) {
      E.events.list(rec, { kind: 'compare' }).forEach(function (e) { layers.compare.rounds++; if (e.data && e.data.correct === 1) layers.compare.right++; });
      E.events.list(rec, { kind: 'bridge' }).forEach(function (e) { layers.bridge.sets++; layers.bridge.items += e.data && isArray(e.data.items) ? e.data.items.length : 0; });
      E.events.list(rec, { kind: 'offscreen' }).forEach(function (e) { if (e.data && e.data.did === 1) layers.offscreen.did++; else layers.offscreen.seen++; });
    }
    var spacing = {};
    Object.keys(exSessions).forEach(function (id) {
      var t = exSessions[id].sort(function (a, b) { return a - b; }), gaps = [];
      for (var i = 1; i < t.length; i++) gaps.push((t[i] - t[i - 1]) / DAY);
      if (gaps.length) spacing[id] = Math.round(gaps.reduce(function (a, g) { return a + g; }, 0) / gaps.length * 10) / 10;
    });
    var outWeeks = Object.keys(weeks).map(Number).sort(function (a, b) { return a - b; }).map(function (w) {
      var ex = {};
      Object.keys(weeks[w]).sort().forEach(function (id) { var x = weeks[w][id]; ex[id] = { trials: x.n, rated: x.rated, minutes: Math.round(x.ms / 6000) / 10, sessions: x.sessions || 0 }; });
      return { week: w, ex: ex };
    });
    var outBets = {};
    IDS.forEach(function (id) { if (bets[id]) outBets[id] = { trials: bets[id].n, minutes: Math.round(bets[id].ms / 6000) / 10 }; });
    return { version: VERSION, firstTrial: t0, weeks: outWeeks, bets: outBets, layers: layers, spacing: spacing, stages: stages, rows: rows.length };
  }

  /* ---------- wiring: events, the record, exports, the setting ---------- */

  if (E.events && typeof E.events.define === 'function') {
    var EV = E.events, have = EV.kinds();
    EV.define('compare', { owner: 'W2-bets', fields: { a: 'token', aSeed: 'seed', b: 'token', bSeed: 'seed', principle: 'token', stage: 'int', choice: 'token', correct: 'bool', rt: 'int', apply: 'seed', opts: 'list', pos: 'int' } });
    EV.define('bridge', { owner: 'W2-bets', fields: { set: 'token', map: 'token', mapOk: 'bool', items: 'list', use: 'token', other: 'bool', rt: 'int' } });
    EV.define('offscreen', { owner: 'W2-bets', fields: { challenge: 'token', did: 'bool' } });
    EV.define('assign', { owner: 'W2-bets', fields: { layer: 'token', arm: 'token', period: 'int', from: 'ms', until: 'ms', seed: 'seed', unit: 'token' } });
    EV.define('expect', { owner: 'W2-bets', fields: { bet: 'token', rating: 'int', when: 'token' } });
    EV.define('join', { owner: 'W2-bets', fields: { on: 'bool' } });
    // shared with W2-measure (CONTRACT O): whichever module loads first defines it
    if (!have.background) EV.define('background', { owner: 'W2-bets', fields: { q: 'token', a: 'token' } });
  }
  if (E.record && typeof E.record.check === 'function') E.record.check('bets', check);
  if (E.merge && typeof E.merge.register === 'function') E.merge.register('bets', merge);
  var S = PX.core && PX.core.store;
  if (S && typeof S.header === 'function') {
    // CONTRACT T's { version, byExercise, joined } plus what an analysis of the bet trials needs. Its key
    // is 'betsInfo': 'bets' is the record field (CONTRACT M), whose pooled copy would replace a header.
    S.header('betsInfo', function (ctx) {
      var layers = {};
      LAYER_IDS.forEach(function (l) { hostsOf(l).forEach(function (id) { var d = defOf(id); (layers[keyOf(d)] || (layers[keyOf(d)] = [])).push(l); }); });
      var units = {};
      Object.keys(STRAND_OF).forEach(function (id) { units[id] = STRANDS[STRAND_OF[id]]; });
      return { version: VERSION, byExercise: byExercise(), joined: joined(ctx && ctx.rec), layers: layers, strands: units,
        period: { days: cfg().periodDays, sessions: cfg().periodSessions }, dose: dose(ctx && ctx.rec) };
    });
    S.header('formats', function () { return formats(); });
  }
  // the setting `betTrials` (default on) is registered by js/ui/bets.js; joined() reads a missing one as on

  E.bets = {
    VERSION: VERSION, IDS: IDS, INFO: INFO, GRADES: GRADES, STRANDS: STRANDS, LAYERS: LAYER_IDS, ROW_LAYER: ROW_LAYER,
    of: of, exercises: exercises, byExercise: byExercise, formats: formats,
    register: register, content: content, hosts: hosts, hostsOf: hostsOf,
    joined: joined, period: period, arm: arm, active: active, due: due, round: round, applySeed: applySeed,
    compared: compared, applied: applied, bridged: bridged, offscreen: offscreen, expect: expect, expectDue: expectDue, join: join,
    calibPush: calibPush, calibSummary: calibSummary, dose: dose,
    _: { drawUnits: drawUnits, drawOwn: drawOwn, unitOf: unitOf, seedOf: seedOf, armAt: armAt, advance: advance, check: check, merge: merge,
      sessionsSince: sessionsSince, assignEvents: assignEvents, pickHook: pickHook, planUse: planUse, UNITS: UNITS, STRAND_OF: STRAND_OF },
  };
})(window.PX);
