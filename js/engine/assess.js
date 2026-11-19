/* PX.engine.assess: measurement on untrained probes (v1.2, PLAN milestone 6: Design A; docs/dev/v1.2/measure-sim.md;
   ENGINE.md §21) and the Lab crossover. Pure: no clock, storage or DOM; `now` comes in.

   Probes are exercises with role 'probe'. They are never trained, give no feedback and never change a rating.
   Every measurement occasion is an entry of rec.assess:
     { date, form, kind, results: { <probe>: { right, n, theta, se, rtMed } }, items: { <probe>: [[b, g, ok, rtMs], …] },
       pv: { <probe>: version }, late?: true, … }
   A probe scored by cells (def.scoreBy 'cells', def.cells(params) = k: Pattern Memory from version 2) stores
   [b, g, ok, rtMs, s, k]: s = squares marked right minus extra marks (at least 0) of the k filled squares, ok the
   exact pattern, b its exact-pattern difficulty; the posterior and the trend read s under the cell model
   (js/engine/trend.js, E.trend.cells; docs/dev/v1.2/measure-sim.md §12), and `right` counts exact patterns.
   kind: full checks 'B1', 'B2' (baselines), 'regular' (the 4-weekly check; also the run-in after a long break),
   'delayed' (after training stops) and, in records from 1.1, 'B3'; Design A adds 'block' (the no-feedback block at
   the start of a training session) and 'week' (a session of the opt-in measurement week). `results` holds each
   probe's posterior under the same prior every time (N(middle of its range, 1.5²)), so entries stay comparable;
   `items` keeps every answer for life, which is what the trend model (js/engine/trend.js) fits; `pv` keeps each
   probe's version, and versions never mix in one trend.

   The mix (config block 'measure', DECISIONS 18 Nov "N14"): a block holds the near probe × 6, two of the three mid
   probes × 2 (rotating), one of the two far probes × 2 (alternating) and the control × 2; a full check holds every
   probe (config.measure.full). Missing probes (not built yet, or not runnable on this device) leave their places
   empty. Items aim at g + (1 − g)·0.6 (a probe's own def.measureK where it has one: Pattern Memory's 0.35, since its
   cells carry the information) under a prior centred on the trend model's prediction for the probe (SD 1.5); a
   probe's first two items ever at 0.85, after its worked example, and while it is new no item more than
   config.measure.climb (1 logit) above the hardest one passed so far.

     start/next/answer/void/finish     the check session (called by modes, mode 'check'; opts.kind picks the kind)
     nextMeasure(rec, now) → { due, kind, when: 'after-tutorial' | 'session-start' | 'check', minutes, why,
                               optional, late, at }   the one answer for the session hooks and Today's line
     meter(rec, now) → { p, mean, lo, hi, unit, milestone, next, line, rungs, occasions } | { p: null, line }
     checks(rec)      full checks only (never 'block' or 'week')       occasions(rec)   every entry, by date
     trendInput(rec), fit(rec)          the trend model's input and its fit (cached per record state)
     due(rec, now), nextCheck(rec, now), report(rec, now)   the full checks' schedule and report
     form(index, rec?), composite, needB3, expect, wire()
   Retest model of the 1.1 report (Scharfen et al. 2018): see report(). */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;
  var mexp = Math.exp, mmax = Math.max, mmin = Math.min, mround = Math.round;

  var U = PX.util;
  var E = PX.engine;
  var C = E.config;
  var M = E.model;
  var DAY = E.DAY;
  var HOUR = 3600000;
  var FORMS = ['A', 'B', 'C'];
  var TRAINING = { train: true, path: true, speed: true, threshold: true, free: true };
  var FULL = { B1: true, B2: true, B3: true, regular: true, delayed: true };
  var SESSION_KIND = { B1: 'baseline', B2: 'baseline', B3: 'baseline', regular: 'check', delayed: 'check', block: 'block', week: 'week', balance: 'lab' };

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  /* ---------- Design A (docs/dev/v1.2/measure-sim.md; DECISIONS 18 Nov, W2-measure) ---------- */

  E.defaults('measure', {
    rungs: { near: ['otherway'], mid: ['cubematch', 'viewmatch', 'patterns'], far: ['mechanisms', 'motiongraphs'] },
    control: 'wordlinks',
    alone: ['level'],                                   // optional probes, reported alone (full checks only)
    // [probes of the rung in each block (rotating), items for each]; the control's items
    block: { near: [1, 6], mid: [2, 2], far: [1, 2], control: 2 },
    week: { near: [1, 6], mid: [2, 6], far: [1, 6], control: 4 },
    // items per probe in a full check (B1, B2, the 4-weekly check, a delayed check): 46 items, 11.5 minutes
    full: { near: 16, mid: 5, far: 5, control: 5, alone: 8 },
    blocksPerWeek: 4,      // at most four blocks in any 7 days
    gapHours: 8,           // occasions at least 8 hours apart (one state per occasion)
    b2Hours: 12,           // B2 from 12 hours after B1
    everyDays: 28,         // the 4-weekly check
    weekDays: 4,           // the opt-in measurement week: the 4 days ending at each 4-weekly mark
    targetSd: 1.5,         // the targeting prior's SD around the trend model's prediction
    k: 0.6, easyFirst: 2, easyK: 0.85,
    // A probe (version) met for the first time climbs: no item more than `climb` logits above the hardest one passed
    // so far (the first item's own level until one is), a pass being a right answer or, scored by cells, `climbPass`
    // of the squares; the estimate is untouched, only how fast items get harder (fresh-player run of 19 Nov: Pattern
    // Memory went from 6 squares to 18 at its third item)
    climb: 1.0, climbPass: 0.75,
    curveMinutes: 240,     // h = 1 − exp(−training minutes since the first occasion / 240): the training-gain curve
    secPerItem: 15,        // for the minutes Today shows
    formRandom: true,      // the record's first form drawn at B1 (O16); false keeps 1.1's A, B, C from A
    // New-exercise learning curves (Lab; note T1 §5.2): exercises added in an update, Central Point first; the first
    // n rated answers give the slope, shown from min answers on; weak priors on the start (around the items) and the
    // slope, only against separation: pooled exports combine slopes with their se, so they must not be shrunk much
    // (60 answers give one player's slope an se of about 1.3 logits)
    curves: { ex: ['centralpoint', 'reckon', 'knots', 'openings', 'patviews', 'angles', 'patfold', 'cubes', 'form'], n: 60, min: 20, startSd: 3, slopeSd: 5 },
    // Lab checks outside the ladder (note T1 §5.2): Balance, the check of Central Point's calibrate bet; its entries
    // go to rec.measure.balance (at most `keep`), never to rec.assess, so the schedule and the meter never see them
    lab: { balance: { items: 12, keep: 24 } },
  });

  /* ---------- the grid posterior of one probe ---------- */

  var GRID = (function () {
    var g = [];
    for (var i = 0; i <= 160; i++) g.push(-8 + i * 0.1);
    return g;
  })();

  function priorCenter(def) { var r = M.range(def); return (r.min + r.max) / 2; }

  function newPost(def, center, sd) {
    var m = isNum(center) ? center : priorCenter(def), s = isNum(sd) && sd > 0 ? sd : C.assess.priorSd;
    return GRID.map(function (th) { return -(th - m) * (th - m) / (2 * s * s); });
  }
  function updatePost(lw, b, g, ok, k, s) {
    var i;
    if (k && E.trend && E.trend.cells) { // scored by cells: the trend model's likelihood of s
      for (i = 0; i < GRID.length; i++) lw[i] += E.trend.cells.logp(GRID[i], b, k, s);
      return;
    }
    for (i = 0; i < GRID.length; i++) {
      var p = M.p(GRID[i], b, g);
      lw[i] += Math.log(ok ? p : 1 - p);
    }
  }
  // A probe scored by cells: its filled squares for these params (0 for every other probe)
  function cellsOf(def, params) {
    if (!def || def.scoreBy !== 'cells' || typeof def.cells !== 'function') return 0;
    var k = def.cells(params);
    return isNum(k) && k >= 1 && k <= 64 && k === Math.floor(k) ? k : 0;
  }
  // A stored row's cells as the trend model reads them, or null
  function rowCells(x) {
    return isArray(x) && x.length >= 6 && isNum(x[5]) && x[5] >= 1 && x[5] <= 64 && x[5] === Math.floor(x[5]) &&
      isNum(x[4]) && x[4] >= 0 && x[4] <= x[5] && x[4] === Math.floor(x[4]) ? { k: x[5], s: x[4] } : null;
  }
  function summary(lw) {
    var mx = -Infinity, i;
    for (i = 0; i < lw.length; i++) if (lw[i] > mx) mx = lw[i];
    var s0 = 0, s1 = 0, s2 = 0;
    for (i = 0; i < lw.length; i++) {
      var w = Math.exp(lw[i] - mx);
      s0 += w; s1 += w * GRID[i]; s2 += w * GRID[i] * GRID[i];
    }
    var m = s1 / s0;
    return { mu: m, sd: Math.sqrt(Math.max(s2 / s0 - m * m, 1e-6)) };
  }

  /* ---------- entries ---------- */

  function valid(a) { return isObj(a) && isObj(a.results) && Date.parse(a.date) >= 0; }
  function byDate(list) { return list.slice().sort(function (a, b) { return Date.parse(a.date) - Date.parse(b.date); }); }
  // Every measurement occasion, by date (the trend model's input).
  function occasions(rec) { return byDate(isArray(rec.assess) ? rec.assess.filter(valid) : []); }
  // Full checks only: never an embedded block or a measurement-week block, so "two baselines", "three checks",
  // Today's count and Progress keep their meaning (CONTRACT-v1.2, conflict 5).
  function checks(rec) { return occasions(rec).filter(function (a) { return a.kind !== 'block' && a.kind !== 'week'; }); }
  function isBlock(a) { return a && (a.kind === 'block' || a.kind === 'week'); }
  function timeOf(a) { return Date.parse(a.date); }

  // Forms rotate A, B, C by full-check index (1.1). Design A starts each record on its own form (O16).
  function form(index, rec) {
    var f0 = rec && isObj(rec.measure) && FORMS.indexOf(rec.measure.form0) >= 0 ? FORMS.indexOf(rec.measure.form0) : 0;
    return { form: FORMS[(f0 + index) % FORMS.length], cycle: Math.floor(index / FORMS.length) };
  }
  // The record's first form, drawn once at B1 from the record's own engine seed (O16: forms counterbalanced across
  // players), or 'A' while config.measure.formRandom is off.
  function drawForm0(rec) {
    return C.measure.formRandom ? E.select.rng(rec, 'measure:form0').pick(FORMS) : 'A';
  }

  function composite(results) {
    var xs = C.assess.composite.filter(function (id) { return results[id] && isNum(results[id].theta) && isNum(results[id].se); });
    if (!xs.length) return null;
    var th = 0, v = 0;
    xs.forEach(function (id) { th += results[id].theta; v += results[id].se * results[id].se; });
    return { theta: th / xs.length, se: Math.sqrt(v) / xs.length, probes: xs };
  }

  // 1.1 added a third baseline when B1 and B2 differed by more than 2 combined standard errors (composite). Design A
  // never does (the trend model weighs every occasion by its precision); records from 1.1 keep their B3.
  function needB3(list) {
    if (list.length < 2) return false;
    var a = composite(list[0].results), b = composite(list[1].results);
    if (!a || !b) return false;
    return Math.abs(b.theta - a.theta) > C.assess.b3Se * Math.sqrt(a.se * a.se + b.se * b.se);
  }
  // The starting checks among the full checks: B1, B2 (and a B3 from 1.1); entries without a kind (1.0): the first two.
  function baselineCount(list) {
    var n = 0, kinds = 0;
    list.forEach(function (a) { if (typeof a.kind === 'string') kinds++; if (a.kind === 'B1' || a.kind === 'B2' || a.kind === 'B3') n++; });
    return kinds ? n : mmin(2, list.length);
  }

  // A training session counts by the same rule as the weekly goal (streak.counts: at least 10 answers or
  // 5 minutes), in a training mode.
  function counted(s) {
    return isObj(s) && TRAINING[s.mode] === true && (E.streak ? E.streak.counts(s) :
      (s.trials || 0) >= C.streak.minTrials || (s.practiceMs || 0) >= C.streak.minMs);
  }
  function sessionsAfter(rec, t, t2) {
    var n = 0;
    (isArray(rec.sessions) ? rec.sessions : []).forEach(function (s) {
      if (counted(s) && s.start > t && (t2 === undefined || s.start <= t2)) n++;
    });
    return n;
  }
  function lastTraining(rec) {
    var t = null;
    (isArray(rec.sessions) ? rec.sessions : []).forEach(function (s) {
      if (counted(s) && (t === null || s.start > t)) t = s.start;
    });
    return t;
  }
  // Rated training before t: any counted training session that started before it.
  function trainedBefore(rec, t) {
    var list = isArray(rec.sessions) ? rec.sessions : [];
    for (var i = 0; i < list.length; i++) if (counted(list[i]) && list[i].start < t) return true;
    return false;
  }

  /* ---------- the full checks ---------- */

  // A delayed check: at least 4 counted sessions after the baselines, then training stopped (none for
  // assess.delayedDays) or slowed (at most one session in the last 28 days after 4 or more in the 28 before), the
  // last full check 21 days or more ago and no full check yet 21 days after the last training.
  function delayedDue(rec, now, list, nb) {
    if (list.length < 2 || nb < 1 || list.length < nb) return false;
    var lastAt = timeOf(list[list.length - 1]), lt = lastTraining(rec);
    var trainedSince = sessionsAfter(rec, timeOf(list[nb - 1])) >= 4;
    var recent = sessionsAfter(rec, now - 28 * DAY, now), before = sessionsAfter(rec, now - 56 * DAY, now - 28 * DAY);
    var stopped = lt !== null && now - lt >= C.assess.delayedDays * DAY;
    var slowed = recent <= 1 && before >= 4;
    return trainedSince && (stopped || slowed) && now - lastAt >= 21 * DAY && lastAt < (lt === null ? now : lt) + 21 * DAY;
  }

  // The next full check (or measurement-week block), for the screens that show "the next check" and for a check
  // started without a kind: nextMeasure's answer when it is one; between them, the next 4-weekly mark (or the start
  // of the week before it, when the measurement week is on). { due, kind, why, next (ms), when, minutes }
  function due(rec, now) {
    var n = nextMeasure(rec, now);
    if (FULL[n.kind] || n.kind === 'week') return { due: n.due, kind: n.kind, why: n.why, next: n.at, when: n.when, minutes: n.minutes };
    var occ = occasions(rec), first = timeOf(occ[0]), step = C.measure.everyDays * DAY;
    var weekOn = isObj(rec.settings) && rec.settings.measureWeek === true, kind = weekOn ? 'week' : 'regular';
    var mark = first + (Math.floor((now - first) / step) + 1) * step, at = weekOn ? mark - C.measure.weekDays * DAY : mark;
    if (at <= now) at = now + 20 * HOUR; // inside the measurement week, today's block done: tomorrow's
    return {
      due: false, kind: kind, next: at, when: weekOn ? 'check' : 'session-start', minutes: minutesOf(mixOf(kind, rec, null, null)),
      why: (weekOn ? 'Your measurement week continues or starts ' : 'Your 4-weekly check comes ') + U.fmtDate(at, 'short') + '; until then a short block opens a session now and then.',
    };
  }

  // The one answer to "when is my next check?" for every screen: { ready, kind, dueAt (ms), dueDate (local day),
  // daysLeft, sessionsLeft (always 0 since Design A: checks follow days, not sessions), why, when, minutes }.
  function nextCheck(rec, now) {
    var d = due(rec, now), at = isNum(d.next) ? d.next : now;
    return {
      ready: d.due === true, kind: d.kind, dueAt: at, dueDate: E.day(at),
      daysLeft: d.due ? 0 : Math.max(0, Math.ceil((at - now) / DAY)), sessionsLeft: 0, why: d.why, when: d.when, minutes: d.minutes,
    };
  }

  /* ---------- the mix ---------- */

  function probeOk(id, can) {
    var def = PX.ex.get(id);
    return !!def && def.role === 'probe' && (!can || can(def));
  }
  function rungIds(r, can) { return (C.measure.rungs[r] || []).filter(function (id) { return probeOk(id, can); }); }

  // A full check: every probe of every rung (1.1's composite order kept among the mid and far probes), the
  // control, and the optional probes when asked.
  function fullMix(opts, can) {
    var out = [], F = C.measure.full, seen = {};
    function add(id, n) { if (!seen[id] && probeOk(id, can) && n > 0) { seen[id] = true; out.push({ id: id, items: n }); } }
    rungIds('near', can).forEach(function (id) { add(id, F.near); });
    C.assess.composite.forEach(function (id) { add(id, C.measure.rungs.far.indexOf(id) >= 0 ? F.far : F.mid); });
    rungIds('mid', can).forEach(function (id) { add(id, F.mid); });
    rungIds('far', can).forEach(function (id) { add(id, F.far); });
    add(C.measure.control, F.control);
    if (opts && opts.optional) C.measure.alone.forEach(function (id) { add(id, F.alone); });
    return out;
  }
  // A block (spec C.measure.block or C.measure.week) number `index`: k of a rung's n probes, starting at index·k mod n.
  function blockMix(spec, index, can) {
    var out = [];
    ['near', 'mid', 'far'].forEach(function (r) {
      var ids = rungIds(r, can), sp = spec[r];
      if (!ids.length || !isArray(sp)) return;
      var k = mmin(sp[0], ids.length);
      for (var x = 0; x < k; x++) out.push({ id: ids[(index * k + x) % ids.length], items: sp[1] });
    });
    if (probeOk(C.measure.control, can) && spec.control > 0) out.push({ id: C.measure.control, items: spec.control });
    return out;
  }
  function blockIndex(rec) { return occasions(rec).filter(isBlock).length; }
  function mixOf(kind, rec, opts, can) {
    return FULL[kind] ? fullMix(opts, can) : blockMix(kind === 'week' ? C.measure.week : C.measure.block, blockIndex(rec), can);
  }
  function itemsOfMix(mix) { var n = 0; mix.forEach(function (m) { n += m.items; }); return n; }

  /* ---------- the trend model's input ---------- */

  function keyOf(id, v) { return id + '@' + (isNum(v) ? v : 1); }

  // Training minutes (training modes, counted sessions) after t0 and by t: a session that ended by t counts, and
  // one that began before t0 (B1 inside the first session, after its tutorial) counts its share after t0.
  function trainingMinutes(rec, t0, t) {
    var ms = 0;
    (isArray(rec.sessions) ? rec.sessions : []).forEach(function (s) {
      if (!counted(s) || !isNum(s.end) || !isNum(s.start) || s.end > t || s.end <= t0 || !isNum(s.practiceMs)) return;
      ms += s.start >= t0 ? s.practiceMs : s.practiceMs * (s.end - t0) / mmax(1, s.end - s.start);
    });
    return ms / 60000;
  }
  function hAt(rec, t0, t) { return 1 - mexp(-trainingMinutes(rec, t0, t) / C.measure.curveMinutes); }

  // The centre of a probe version's range: the definition's own, or for an earlier version the range its upgrade
  // recorded (def.past: { <version>: { min, max } }); null when unknown.
  function centerOfVersion(def, v) {
    if (!isNum(v) || v === def.version) return priorCenter(def);
    var r = isObj(def.past) ? def.past[v] : null;
    return isObj(r) && isNum(r.min) && isNum(r.max) ? (r.min + r.max) / 2 : null;
  }
  // An entry from 1.1 (no items): each probe's posterior under N(c, 1.5²) turned back into a likelihood summary
  // (Gaussian), when the centre c of that version's range is known.
  function fromPosterior(def, r, pv) {
    var c = centerOfVersion(def, isNum(pv) ? pv : def.version);
    if (c === null || !isNum(r.theta) || !isNum(r.se) || !isNum(r.n) || r.n < 1) return null;
    var s0 = C.assess.priorSd, prec = 1 / (r.se * r.se) - 1 / (s0 * s0);
    if (!(prec > 0.05)) return null;
    var y = (r.theta / (r.se * r.se) - c / (s0 * s0)) / prec;
    return { n: r.n, y: y, v: 1 / prec };
  }

  function trendInput(rec) {
    var occ = occasions(rec), out = [], centers = {};
    if (!occ.length) return { occasions: out, centers: centers, t0: null };
    var t0 = timeOf(occ[0]);
    occ.forEach(function (a) {
      var t = timeOf(a), blocks = [], pv = isObj(a.pv) ? a.pv : {};
      Object.keys(a.results).forEach(function (id) {
        var def = PX.ex.get(id);
        if (!def || def.role !== 'probe') return;
        var v = isNum(pv[id]) ? pv[id] : 1, key = keyOf(id, v), its = isObj(a.items) ? a.items[id] : null;
        if (isArray(its) && its.length) {
          var items = its.filter(function (x) { return isArray(x) && isNum(x[0]) && isNum(x[1]); }).map(function (x) {
            var c = rowCells(x);
            return c ? [x[0], x[1], x[2] ? 1 : 0, null, 1, c] : [x[0], x[1], x[2] ? 1 : 0];
          });
          if (items.length) blocks.push({ probe: key, items: items });
        } else {
          var s = fromPosterior(def, a.results[id], pv[id]);
          if (s) blocks.push({ probe: key, n: s.n, y: s.y, v: s.v });
        }
        if (!hasOwn.call(centers, key)) { var cv = centerOfVersion(def, v); centers[key] = cv === null ? priorCenter(def) : cv; }
      });
      if (blocks.length) out.push({ t: t, h: hAt(rec, t0, t), kind: a.kind, blocks: blocks });
    });
    return { occasions: out, centers: centers, t0: t0 };
  }

  // The trend fit of the record's occasions, cached on the state that decides it.
  var CACHE = { key: null, fit: null, input: null };
  function cacheKey(rec) {
    var occ = occasions(rec), s = isArray(rec.sessions) ? rec.sessions : [], last = occ.length ? occ[occ.length - 1] : null;
    var cfg = E.trend ? JSON.stringify([E.trend.config.fam, E.trend.config.tail, E.trend.config.state, E.trend.config.sd, C.measure.curveMinutes]) : '';
    return [isNum(rec.created) ? rec.created : 0, occ.length, last ? last.date : '', s.length, s.length ? s[s.length - 1].end : 0, cfg].join('|');
  }
  function fit(rec) {
    if (!E.trend) return null;
    var key = cacheKey(rec);
    if (CACHE.key === key && CACHE.fit) return CACHE.fit;
    var input = trendInput(rec);
    var f = input.occasions.length ? E.trend.fit(input, { center: input.centers }) : null;
    CACHE.key = key; CACHE.fit = f; CACHE.input = input;
    return f;
  }

  // Where to aim a probe's items: the trend model's prediction for this version, inside the probe's range.
  function centerOf(rec, def, f, now) {
    var c = priorCenter(def);
    if (f && f.ok && E.trend) {
      var input = CACHE.input, t0 = input && isNum(input.t0) ? input.t0 : now;
      var p = E.trend.predict(f, keyOf(def.id, def.version), hAt(rec, t0, now), now);
      if (p && isNum(p.mean)) c = p.mean;
    }
    var r = M.range(def);
    return U.clamp(c, r.min, r.max);
  }

  /* ---------- Design A's schedule: what comes next, and when ---------- */

  function minutesOf(mix) { return mround(itemsOfMix(mix) * C.measure.secPerItem / 60 * 2) / 2; }

  // nextMeasure(rec, now, opts) → the one answer for the session hooks and Today: { due, kind, when, minutes,
  // why, optional, late, at (when it becomes due) }. opts.can: the device's probe filter; opts.optional: Level.
  function nextMeasure(rec, now, opts) {
    wire();
    opts = opts || {};
    var can = opts.can, occ = occasions(rec), full = checks(rec), ms = isObj(rec.measure) ? rec.measure : {};
    var settings = isObj(rec.settings) ? rec.settings : {};
    function out(kind, when, dueNow, at, why, extra) {
      var mix = mixOf(kind, rec, opts, can);
      var o = { due: !!dueNow && mix.length > 0, kind: kind, when: when, minutes: minutesOf(mix), items: itemsOfMix(mix), why: why, optional: true, late: false, at: isNum(at) ? at : now };
      if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
      return o;
    }
    var has = function (k) { return full.some(function (a) { return a.kind === k; }); };
    // B1: right after the first tutorial for a newcomer; at the start of the next session when it was put off
    // ("Later") or when rated training already began (then it is marked late).
    if (!full.length) {
      var trained = trainedBefore(rec, now) || occ.length > 0;
      var putOff = isNum(ms.later);
      return out('B1', trained || putOff ? 'session-start' : 'after-tutorial', true, now,
        trained ? 'Your starting point, measured now: about ' + minutesOf(mixOf('B1', rec, opts, can)) + ' minutes of short tasks without feedback before this session. It comes after some training, so the report says so.' :
          'Your starting point: about ' + minutesOf(mixOf('B1', rec, opts, can)) + ' minutes of short tasks without feedback, right after your first tutorial.',
        { late: trained });
    }
    var last = occ[occ.length - 1], lastAt = timeOf(last), first = timeOf(occ[0]);
    if (!has('B2') && full.length < 2) {
      var at2 = timeOf(full[0]) + C.measure.b2Hours * HOUR;
      return out('B2', 'session-start', now >= at2, at2, 'Your second starting point at the start of the session: the first one also measured getting used to the tasks.');
    }
    // Training stopped or slowed after the baselines: a full check at the next visit shows what lasts.
    if (delayedDue(rec, now, full, baselineCount(full))) {
      return out('delayed', 'session-start', true, now, 'A delayed check, about ' + minutesOf(mixOf('delayed', rec, opts, can)) + ' minutes: some weeks after training slowed, it shows what lasts.');
    }
    // After a break of more than breakDays the run-in restarts: two full checks at the next two session starts.
    var bd = E.trend ? E.trend.config.breakDays : 56;
    var gapAt = -1;
    for (var i = 1; i < occ.length; i++) if (timeOf(occ[i]) - timeOf(occ[i - 1]) > bd * DAY) gapAt = i;
    if (now - lastAt > bd * DAY) return out('regular', 'session-start', true, now, 'Welcome back. After a long break the measurement starts again with a full check, about ' + minutesOf(mixOf('regular', rec, opts, can)) + ' minutes.');
    if (gapAt > 0 && occ.length - gapAt < 2) return out('regular', 'session-start', now - lastAt >= C.measure.gapHours * HOUR, lastAt + C.measure.gapHours * HOUR, 'One more full check after your break steadies the new start.');
    // The Lab's crossover (E.lab): a full check opens it and closes each of its two phases.
    var lab = isObj(rec.lab) && rec.lab.order && isNum(rec.lab.start) && !isNum(rec.lab.left) ? rec.lab : null;
    if (lab) {
      var W = C.lab.weeks * 7 * DAY, pts = [lab.start, lab.start + W, lab.start + 2 * W];
      for (var q = 0; q < pts.length; q++) {
        var pt = pts[q];
        if (now < pt || now > pt + 7 * DAY || full.some(function (a) { return Math.abs(timeOf(a) - pt) <= 7 * DAY; })) continue;
        return out('regular', 'session-start', now - lastAt >= C.measure.gapHours * HOUR, mmax(pt, lastAt + C.measure.gapHours * HOUR),
          q === 0 ? 'Your Lab experiment opens with a full check, about ' + minutesOf(mixOf('regular', rec, opts, can)) + ' minutes.' :
            'A full check closes phase ' + q + ' of your Lab experiment, about ' + minutesOf(mixOf('regular', rec, opts, can)) + ' minutes.');
      }
    }
    // The 4-weekly check (replaced by the measurement week when that is on).
    var mark = first + Math.floor((now - first) / (C.measure.everyDays * DAY)) * C.measure.everyDays * DAY;
    var weekOn = settings.measureWeek === true;
    if (!weekOn && now - first >= C.measure.everyDays * DAY && !full.some(function (a) { return timeOf(a) >= mark; })) {
      return out('regular', 'session-start', now - lastAt >= C.measure.gapHours * HOUR, mmax(mark, lastAt + C.measure.gapHours * HOUR), 'Your 4-weekly check replaces this session’s block: about ' + minutesOf(mixOf('regular', rec, opts, can)) + ' minutes.');
    }
    // The opt-in measurement week: the 4 days ending at each 4-weekly mark, one session a day.
    if (weekOn) {
      var nextMark = first + Math.ceil(mmax(now - first, 1) / (C.measure.everyDays * DAY)) * C.measure.everyDays * DAY;
      var inWeek = nextMark - now <= C.measure.weekDays * DAY && now - first >= (C.measure.everyDays - C.measure.weekDays) * DAY;
      if (inWeek) {
        var today = occ.filter(function (a) { return a.kind === 'week' && now - timeOf(a) < 20 * HOUR; }).length;
        if (!today) return out('week', 'check', now - lastAt >= C.measure.gapHours * HOUR, lastAt + C.measure.gapHours * HOUR, 'Measurement week: one short session a day for four days gives your 4-weekly verdict its sharpest reading.');
      }
    }
    // An embedded block at the start of a training session: at most four in any 7 days, 8 hours apart.
    var week7 = occ.filter(function (a) { return isBlock(a) && now - timeOf(a) < 7 * DAY; });
    var gapOk = now - lastAt >= C.measure.gapHours * HOUR;
    if (week7.length >= C.measure.blocksPerWeek) {
      var free = timeOf(week7[0]) + 7 * DAY;
      return out('block', 'session-start', false, free, 'Four blocks this week already: the next one comes with a session after ' + U.fmtDate(free, 'short') + '.');
    }
    return out('block', 'session-start', gapOk, lastAt + C.measure.gapHours * HOUR, 'A ' + minutesOf(mixOf('block', rec, opts, can)) + '-minute block without feedback opens the session: it keeps your probe trend moving.');
  }

  /* ---------- the check session (called by modes) ---------- */

  function start(plan, rec, opts, now) {
    wire();
    opts = opts || {};
    var occ = occasions(rec), full = checks(rec);
    var lab = opts.kind === 'balance' && isObj(C.measure.lab) && isObj(C.measure.lab.balance);
    var kind = lab ? 'balance' : typeof opts.kind === 'string' && (FULL[opts.kind] || opts.kind === 'block' || opts.kind === 'week') ? opts.kind : due(rec, now).kind;
    var can = function (def) { return def && def.role === 'probe' && (!plan.can || plan.can(def)); };
    var mix = lab ? (can(PX.ex.get('balance')) ? [{ id: 'balance', items: C.measure.lab.balance.items }] : []) : mixOf(kind, rec, opts, can);
    if (!mix.length) { plan.unavailable = 'The Spatial Check needs its probe exercises.'; return; }
    // the record's first form, drawn at B1 (records with an earlier check keep 'A': js/engine/record.js)
    if (kind === 'B1' && isObj(rec.measure) && FORMS.indexOf(rec.measure.form0) < 0 && !full.length) rec.measure.form0 = drawForm0(rec);
    var block = !FULL[kind] && !lab, f = occ.length && !lab ? fit(rec) : null, labN = lab ? balanceList(rec).length : 0;
    var fm = lab ? { form: null, cycle: labN } : block ? { form: null, cycle: blockIndex(rec) } : form(full.length, rec);
    var seen = {};
    occ.forEach(function (a) { Object.keys(a.results).forEach(function (id) { seen[keyOf(id, isObj(a.pv) ? a.pv[id] : 1)] = true; }); });
    var probes = mix.map(function (m) {
      var def = PX.ex.get(m.id), fresh = lab ? labN === 0 : !seen[keyOf(m.id, def.version)];
      // items aim at the trend model's prediction for the probe (B1: the middle of its range); the stored posterior
      // keeps the standard prior N(middle, 1.5²), so every entry stays comparable
      return { id: m.id, v: def.version, n: 0, items: m.items, lw: newPost(def, centerOf(rec, def, f, now), C.measure.targetSd), lwS: newPost(def), right: 0, rts: [], recent: [], voids: 0, log: [],
        fresh: fresh, easy: fresh ? C.measure.easyFirst : 0, top: null };
    });
    plan.exs = probes.map(function (p) { return p.id; });
    // a B1 after rated training began is marked late (its baseline already holds some training)
    plan.check = { index: full.length, form: fm.form, cycle: fm.cycle, kind: kind, block: block, lab: lab, probes: probes, cur: 0,
      late: kind === 'B1' && trainedBefore(rec, now) };
    plan.total = itemsOfMix(mix);
    plan.budgetMs = Infinity;
  }

  function current(plan) {
    var pc = plan.check;
    while (pc.cur < pc.probes.length && pc.probes[pc.cur].n >= pc.probes[pc.cur].items) pc.cur++;
    return pc.probes[pc.cur] || null;
  }

  // A probe's worked examples (learn.js demo: [{ params, seed, kind }]), shown before its items and never scored;
  // check items never use their seeds.
  function demos(id) {
    var L = typeof PX.ex.learn === 'function' ? PX.ex.learn(id) : null;
    return L && isArray(L.demo) ? L.demo.filter(isObj) : [];
  }

  function next(plan, rec) {
    var pr = current(plan);
    if (!pr) return null;
    var def = PX.ex.get(pr.id), post = summary(pr.lw), pc = plan.check;
    // The first items of a probe (version) met for the first time are easy (g + (1 − g)·0.85), so a newcomer meets
    // an easy item right after the worked example; then the usual g + (1 − g)·0.6.
    var k = pr.n < pr.easy ? C.measure.easyK : isNum(def.measureK) && def.measureK > 0 && def.measureK < 1 ? def.measureK : C.measure.k;
    // A probe of several formats (def.cycle 'variant': Other Way Round's strands) reads them in turn: item i is
    // variant i mod n, and its items adapt within the variant.
    var cyc = def.cycle === 'variant' && isArray(def.variants) && def.variants.length ? def.variants[pr.n % def.variants.length] : null;
    var byKind = cyc ? function (c) { return c.params.variant === cyc; } : null, filt = byKind;
    if (pr.fresh && isNum(pr.top) && isNum(C.measure.climb)) {
      var cap = pr.top + C.measure.climb + 1e-9;
      filt = function (c) { return c.b <= cap && (!byKind || byKind(c)); };
    }
    var popt = { kind: 'target', k: k, recent: { keys: pr.recent }, rng: plan.rng, policy: 'high', filter: filt };
    var r = E.select.pick(def, post, popt);
    if (!r && filt !== byKind) { popt.filter = byKind; r = E.select.pick(def, post, popt); } // nothing under the cap
    if (!r) return null;
    pr.recent.push(r.key);
    if (pr.recent.length > C.select.avoid) pr.recent.shift();
    var ex = demos(pr.id), taken = {};
    ex.forEach(function (d) { if (isNum(d.seed)) taken[d.seed] = true; });
    var parts = pc.block ? ['px-block', pr.id, pr.v, pc.cycle, pr.n, pr.voids] : ['px-probe', pr.id, pc.form, pc.cycle, pr.n, pr.voids];
    var seed = E.select.sharedSeed(PX.rng.hash.apply(null, parts));
    for (var salt = 1; taken[seed] === true && salt <= 50; salt++) seed = E.select.sharedSeed(PX.rng.hash.apply(null, parts.concat(['not-a-demo', salt])));
    // the worked example once per probe, before its first item: in every full check (1.1), in a block only for a
    // probe (version) met for the first time; a probe of several formats has one per format (learn.demo with
    // params.variant), each before that format's first item
    var example = null, newVariant = null;
    if (cyc) {
      if (!pr.exampledV) pr.exampledV = {};
      if (!pr.exampledV[cyc] && (!pc.block || pr.fresh)) {
        example = ex.filter(function (d) { return d.params && d.params.variant === cyc; })[0] || null;
        if (!ex.length) newVariant = cyc; // a probe without worked examples (Balance): the kind's own line instead
      }
      pr.exampledV[cyc] = true;
    } else {
      example = !pr.exampled && ex.length && (!pc.block || pr.fresh) ? ex[0] : null;
      pr.exampled = true;
    }
    return E.modes._.makeStep(plan, rec, def, r, 'probe', {
      seed: seed, noNote: true, feedback: false, banner: pr.n === 0, newRun: pr.n === 0,
      probe: { id: pr.id, index: pr.n, of: pr.items, form: pc.form, control: pr.id === C.assess.control, example: example, newVariant: newVariant, kind: pc.kind },
    });
  }

  function byId(plan, id) {
    var ps = plan.check.probes;
    for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i];
    return null;
  }

  function voidStep(plan, rec, step) {
    var pr = byId(plan, step.exId);
    if (pr) pr.voids += 1; // the replacement item gets a different seed
  }

  function answer(plan, rec, step, ok, result) {
    var pr = byId(plan, step.exId);
    if (!pr) return;
    pr.n += 1;
    var rt = result && isNum(result.rt) ? mround(result.rt) : null;
    if (ok) {
      pr.right += 1;
      if (rt !== null) pr.rts.push(rt);
    }
    // scored by cells: s from the score's value (s / k), or from the exact verdict when no value came (a timeout)
    var k = cellsOf(PX.ex.get(pr.id), step.params), s = null;
    if (k) s = result && isNum(result.value) ? Math.max(0, Math.min(k, mround(result.value * k))) : ok ? k : 0;
    // the climb of a probe met for the first time (config.measure.climb): the hardest level passed so far
    if (pr.fresh && isNum(step.b)) {
      var passed = k ? s >= C.measure.climbPass * k : ok;
      if (!isNum(pr.top)) pr.top = step.b; else if (passed && step.b > pr.top) pr.top = step.b;
    }
    updatePost(pr.lw, step.b, step.g, ok, k, s);
    if (pr.lwS) updatePost(pr.lwS, step.b, step.g, ok, k, s);
    if (plan.check.lab) { // Balance: [b, g, ok, rtMs, distance, pull, kind (0 balance point, 1 bus stop), x, y]
      var at = result && isArray(result.at) ? result.at : [];
      pr.log.push([U.round(step.b, 3), U.round(step.g, 3), ok ? 1 : 0, rt, isNum(result && result.value) ? result.value : null,
        isNum(result && result.value2) ? result.value2 : null, step.params && step.params.variant === 'median' ? 1 : 0, isNum(at[0]) ? at[0] : null, isNum(at[1]) ? at[1] : null]);
      return;
    }
    pr.log.push(k ? [U.round(step.b, 3), U.round(step.g, 3), ok ? 1 : 0, rt, s, k] : [U.round(step.b, 3), U.round(step.g, 3), ok ? 1 : 0, rt]);
  }

  function finish(plan, rec, now, res) {
    if (plan.check.lab) return finishLab(plan, rec, now, res);
    var results = {}, items = {}, pv = {};
    plan.check.probes.forEach(function (pr) {
      if (!pr.n) return;
      var s = summary(pr.lwS || pr.lw); // the stored posterior: always the standard prior
      results[pr.id] = {
        right: pr.right, n: pr.n, theta: U.round(s.mu, 4), se: U.round(s.sd, 4),
        rtMed: pr.rts.length ? Math.round(U.median(pr.rts)) : null,
      };
      items[pr.id] = pr.log.slice();
      pv[pr.id] = pr.v;
    });
    if (!Object.keys(results).length) return;
    if (!isArray(rec.assess)) rec.assess = [];
    var entry = { date: new Date(now).toISOString(), form: plan.check.form, kind: plan.check.kind, results: results, items: items, pv: pv };
    if (plan.check.block) entry.bi = plan.check.cycle; // the block's index: its items' shared seeds
    if (plan.check.late) entry.late = true;
    // Extras the screen collected (v1.1: display, viewport and input of the check; the one-tap overlap answer):
    // plain JSON values only, never over the fields above.
    var extra = plan.check.extra;
    if (isObj(extra)) Object.keys(extra).forEach(function (k) {
      var v = extra[k];
      if (hasOwn.call(entry, k) || k === '__proto__' || k === 'constructor' || k === 'prototype' || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k)) return;
      if (v === null || typeof v === 'string' || typeof v === 'boolean' || isNum(v)) entry[k] = typeof v === 'string' ? v.slice(0, 200) : v;
      else if (isObj(v) || isArray(v)) { try { entry[k] = JSON.parse(JSON.stringify(v)); } catch (e) { /* not JSON: dropped */ } }
    });
    rec.assess.push(entry);
    if (isObj(rec.measure) && isNum(rec.measure.later) && FULL[entry.kind]) delete rec.measure.later;
    var verdict = settle(rec, now);
    res.check = { kind: plan.check.kind, form: plan.check.form, block: plan.check.block, results: results, report: report(rec, now), meter: meter(rec, now), verdict: verdict };
  }

  /* ---------- Balance, the Lab check of the calibrate bet (note T1 §5.2) ---------- */
  function balanceList(rec) { return rec && isObj(rec.measure) && isArray(rec.measure.balance) ? rec.measure.balance : []; }
  function finishLab(plan, rec, now, res) {
    var pr = plan.check.probes[0];
    if (!pr || !pr.n) return;
    if (!isObj(rec.measure)) rec.measure = {};
    if (!isArray(rec.measure.balance)) rec.measure.balance = [];
    var entry = { date: new Date(now).toISOString(), form: plan.check.cycle, v: pr.v, n: pr.n, right: pr.right, items: pr.log.slice() };
    rec.measure.balance.push(entry);
    var keep = C.measure.lab.balance.keep || 24;
    if (rec.measure.balance.length > keep) rec.measure.balance.splice(0, rec.measure.balance.length - keep);
    res.check = { kind: 'balance', lab: true, form: null, results: { balance: { right: pr.right, n: pr.n, rtMed: pr.rts.length ? Math.round(U.median(pr.rts)) : null } },
      balance: balanceSummary(entry) };
  }
  // One entry in words and numbers: per kind its items, right answers, mean distance and mean pull (balance point:
  // 1 = far dots at full weight; bus stop: 0 = the middle house, 1 = the mean).
  function balanceSummary(entry) {
    var out = { date: entry.date, n: entry.n };
    [['centroid', 0], ['median', 1]].forEach(function (k) {
      var rows = (isArray(entry.items) ? entry.items : []).filter(function (r) { return isArray(r) && r[6] === k[1] && isNum(r[4]); });
      var pulls = rows.map(function (r) { return r[5]; }).filter(isNum);
      out[k[0]] = { n: rows.length, right: rows.filter(function (r) { return r[2] === 1; }).length,
        dist: rows.length ? U.round(U.mean(rows.map(function (r) { return r[4]; })), 1) : null,
        pull: pulls.length ? U.round(U.median(pulls), 2) : null };
    });
    return out;
  }
  function balanceReport(rec) { return balanceList(rec).map(balanceSummary).reverse(); }

  /* ---------- the meter and the verdicts (Design A) ---------- */

  // At a milestone (days 14, 28, then every 28 after the first occasion; after a run-in), the verdict is computed
  // once, from the data up to the first occasion on or after it, and stored: a later block never rewrites it.
  function settle(rec, now) {
    var f = fit(rec);
    if (!f || !f.ok || !f.gain.comp || !E.trend) return null;
    var m = E.trend.milestoneAt(f.day);
    if (!m || !f.segment.runInDone || !isObj(rec.measure)) return null;
    if (!isArray(rec.measure.verdicts)) rec.measure.verdicts = [];
    if (rec.measure.verdicts.some(function (v) { return v.day === m.day; })) return null;
    var g = f.gain.comp, words = E.trend.verdict(f, m, 'comp');
    var v = { day: m.day, at: now, words: words, p: U.round(g.p, 4), mean: U.round(g.pts.mean, 3), lo: U.round(g.pts.lo, 3), hi: U.round(g.pts.hi, 3) };
    rec.measure.verdicts.push(v);
    return v;
  }

  function latestVerdict(rec) {
    var vs = isObj(rec.measure) && isArray(rec.measure.verdicts) ? rec.measure.verdicts.filter(isObj) : [];
    return vs.length ? vs.reduce(function (a, b) { return b.day > a.day ? b : a; }) : null;
  }

  var WORDS_LINE = {
    'likely gain': 'Likely gain: your probe results rose more than familiarity with the tasks predicts.',
    'likely no change': 'Likely no change so far: any rise beyond familiarity is small at this precision.',
    'unclear yet': 'Unclear yet: the usual verdict for one person at this point, and not the same as no progress.',
  };

  function readout(g) {
    return g ? { p: U.round(g.p, 4), mean: U.round(g.pts.mean, 3), lo: U.round(g.pts.lo, 3), hi: U.round(g.pts.hi, 3) } : null;
  }

  // meter(rec, now) → the probability meter and its one line (CLAUDE.md rules 2 and 10: probe points and words,
  // never an IQ, an index, a percentile, a norm or a brain age).
  function meter(rec, now) {
    var f = fit(rec), occ = occasions(rec);
    if (!f || !f.ok || !f.gain.comp || !(f.hNow > 0) || checks(rec).length < 2) {
      return { p: null, occasions: occ.length, line: meterWait(rec, now, occ) };
    }
    var g = f.gain.comp, v = latestVerdict(rec), day = (now - f.t0) / DAY, nm = nextMilestone(f.t0, now);
    var line;
    var pTxt = Math.round(g.p * 100) + ' %';
    if (v && day - v.day < 7) line = WORDS_LINE[v.words] + ' (verdict at day ' + v.day + ')';
    else line = 'Chance that your probe results rose beyond what familiarity predicts: ' + pTxt + '. It moves with every block; ' +
      (v ? 'the last verdict, at day ' + v.day + ', was “' + v.words + '”; the next comes at day ' + nm.day + '.' : 'the first verdict comes at day ' + nm.day + '.');
    var rungs = {};
    Object.keys(f.gain).forEach(function (k) { if (k !== 'comp') rungs[k] = readout(f.gain[k]); });
    return {
      p: U.round(g.p, 4), mean: U.round(g.pts.mean, 3), lo: U.round(g.pts.lo, 3), hi: U.round(g.pts.hi, 3), unit: 'points',
      milestone: v ? { day: v.day, words: v.words, at: v.at } : null, next: { day: nm.day, at: nm.at }, line: line,
      rungs: rungs, occasions: occ.length, day: U.round(day, 2), late: occ.length ? !!occ[0].late : false,
    };
  }
  // Before the meter starts: what comes next, in plain words (fresh-player run of 19 Nov: "after your two starting
  // points" did not say when the second comes or how long it takes).
  function meterWait(rec, now, occ) {
    if (!occ.length) return 'The meter starts with your starting points.';
    var full = checks(rec);
    if (full.length < 2 && !full.some(function (a) { return a.kind === 'B2'; })) {
      var b2 = mixOf('B2', rec, {}, null), at = full.length ? timeOf(full[0]) + C.measure.b2Hours * HOUR : now;
      var mins = minutesOf(b2), hrs = Math.max(0, Math.round((at - now) / HOUR));
      return 'Your second starting point comes at the start of a session ' + (hrs > 0 ? hrs + ' or more hours from now' : 'from now on') + ': the same kinds of task, about ' +
        (mins % 1 ? mins.toFixed(1) : mins) + ' minutes. The meter starts once you train after it.';
    }
    return 'The meter starts once you train.';
  }
  function nextMilestone(t0, now) {
    var cfg = E.trend.config.milestones, days = cfg.days, d = (now - t0) / DAY;
    for (var i = 0; i < days.length; i++) if (days[i] > d) return { day: days[i], at: t0 + days[i] * DAY };
    var last = days[days.length - 1], k = Math.floor((d - last) / cfg.every) + 1;
    return { day: last + k * cfg.every, at: t0 + (last + k * cfg.every) * DAY };
  }

  /* ---------- the report (Design A: the meter, and the trend model's words at milestones) ---------- */

  // Level change on trained exercises since the end of the baseline (near transfer, for context).
  function near(rec, since, now) {
    var day = E.day(since), out = {};
    PX.ex.list('train').forEach(function (def) {
      var e = rec.ex && rec.ex[def.id];
      if (!isObj(e) || !isArray(e.hist) || !e.hist.length) return;
      var h0 = null;
      for (var i = 0; i < e.hist.length; i++) { if (e.hist[i][0] <= day) h0 = e.hist[i]; else break; }
      if (!h0) h0 = e.hist[0];
      var a = E.est.level(def, { mu: h0[1], sd: h0[2], n: 1 }, { settings: false });
      var b = E.est.level(def, E.est.get(rec, def, null, now), { settings: false });
      out[def.id] = { from: a.level, to: b.level, change: b.level - a.level, lo: b.lo, hi: b.hi };
    });
    return out;
  }

  // report(rec, now) → { status: 'none' | 'baseline' | 'baseline-done' | 'trend', checks (full checks), baselines,
  //   occasions, latest: { date, form, kind }, meter (meter()), verdict (the latest stored: { day, at, words, p, mean,
  //   lo, hi }), verdicts, composite: { outcome (the latest verdict's words, or null before the first milestone), p,
  //   mean, lo, hi, probes }, rungs: { near, mid, far, … : { p, mean, lo, hi } }, near (trained exercises' levels since
  //   the baselines), lines }. Words only at milestones; between them the meter (CLAUDE.md rules 2 and 10).
  function report(rec, now) {
    var list = checks(rec), occ = occasions(rec), nb = baselineCount(list);
    var out = { status: 'none', checks: list.length, baselines: nb, occasions: occ.length, latest: null, meter: null, verdict: null, verdicts: [],
      composite: null, rungs: null, probes: {}, control: null, near: null, lines: [] };
    if (!list.length) { out.lines.push('No Spatial Check yet.'); return out; }
    var last = occ[occ.length - 1];
    out.latest = { date: last.date, form: last.form, kind: last.kind };
    if (nb < 2) { out.status = 'baseline'; out.lines.push('One more starting point, then the meter starts with your training.'); return out; }
    var m = meter(rec, now);
    if (m.p === null) { out.status = 'baseline-done'; out.lines.push('Starting point measured. The meter starts once you train, and moves with every block.'); return out; }
    var v = latestVerdict(rec), f = fit(rec);
    out.status = 'trend';
    out.meter = m;
    out.verdict = v ? U.deepCopy(v) : null;
    out.verdicts = isObj(rec.measure) && isArray(rec.measure.verdicts) ? U.deepCopy(rec.measure.verdicts) : [];
    out.composite = { outcome: v ? v.words : null, p: m.p, mean: m.mean, lo: m.lo, hi: m.hi, probes: f && f.gain.comp ? f.gain.comp.probes.slice() : [] };
    out.rungs = m.rungs;
    out.near = near(rec, timeOf(list[nb - 1]), now);
    out.lines.push(m.line);
    out.lines.push('Familiarity with the tasks raises probe scores on its own, so the meter counts only the rise beyond what familiarity predicts; Word Links, a word task that spatial training should leave alone, steadies the reading against good and bad days.');
    return out;
  }

  /* ---------- expectations (asked once at baseline, for the Lab) ---------- */

  function expect(rec, value, now) {
    if (!isObj(rec.spatial)) rec.spatial = { expect: null };
    if (rec.spatial.expect) return false;
    var v = Math.round(value);
    if (!(v >= 1 && v <= 5) || !isNum(now)) return false;
    rec.spatial.expect = { value: v, t: now };
    return true;
  }

  // "Later" on a baseline (B1 put off): the next session opens with it (nextMeasure), and the event is logged.
  function later(rec, kind, now) {
    wire();
    if (!isObj(rec.measure)) return false;
    if (kind === 'B1' && !checks(rec).length) rec.measure.later = now;
    if (E.events) E.events.add(rec, 'measure', null, { what: kind === 'B1' || kind === 'B2' ? 'baseline-later' : 'block-skip', kind: kind }, now);
    return true;
  }

  /* ---------- Lab crossover (small: assignment, phases, per-phase changes) ---------- */

  function labOf(rec) {
    if (!isObj(rec.lab)) rec.lab = { order: null, start: null, left: null };
    return rec.lab;
  }

  function enroll(rec, now) {
    var L = labOf(rec);
    if (L.order && !isNum(L.left)) return L;
    L.order = E.select.rng(rec, 'lab:' + now).chance(0.5) ? 'AB' : 'BA'; // random order
    L.start = now;
    L.left = null;
    return L;
  }
  function leave(rec, now) { var L = labOf(rec); if (L.order) L.left = now; return L; }

  function labChecks(rec) {
    var L = rec.lab, list = checks(rec), W = C.lab.weeks * 7 * DAY;
    if (!isObj(L) || !isNum(L.start)) return null;
    function near(t) {
      var best = null, bd = 7 * DAY + 1;
      list.forEach(function (c) { var d = Math.abs(timeOf(c) - t); if (d < bd) { bd = d; best = c; } });
      return best;
    }
    var base = list.filter(function (c) { return Math.abs(timeOf(c) - L.start) <= 7 * DAY; }).slice(0, 2);
    return { base: base, mid: near(L.start + W), end: near(L.start + 2 * W) };
  }

  function phase(rec, now) {
    var L = rec.lab;
    if (!isObj(L) || !L.order || !isNum(L.start)) return { enrolled: false };
    if (isNum(L.left)) return { enrolled: false, left: true, order: L.order };
    var W = C.lab.weeks, weeks = (now - L.start) / (7 * DAY);
    var ph = weeks < W ? 1 : weeks < 2 * W ? 2 : 'done';
    var name = ph === 1 ? L.order[0] : ph === 2 ? L.order[1] : null;
    var lc = labChecks(rec);
    return {
      enrolled: true, order: L.order, phase: ph, cluster: name ? C.lab[name].slice() : null, clusterName: name, weeks: weeks,
      checks: { base: lc.base.length, mid: !!lc.mid, end: !!lc.end },
    };
  }

  function allowed(rec, now) {
    var p = phase(rec, now);
    return p.enrolled && p.cluster ? p.cluster : null;
  }

  function diff(a, b, id) {
    var ra = a && a.results[id], rb = b && b.results[id];
    if (!ra || !rb || !isNum(ra.theta) || !isNum(rb.theta)) return null;
    return { change: rb.theta - ra.theta, se: Math.sqrt(ra.se * ra.se + rb.se * rb.se) };
  }

  // Per-phase probe changes: phase 1 = mid − baseline average, phase 2 = end − mid, and per probe the contrast
  // "change while training cluster A − change while training cluster B".
  function labChanges(rec) {
    var L = rec.lab, lc = labChecks(rec);
    if (!lc || !L.order) return null;
    var base = null;
    if (lc.base.length) {
      base = { results: {} };
      Object.keys(lc.base[0].results).forEach(function (id) {
        var rs = lc.base.map(function (c) { return c.results[id]; }).filter(function (r) { return r && isNum(r.theta); });
        if (!rs.length) return;
        base.results[id] = { theta: U.mean(rs.map(function (r) { return r.theta; })), se: Math.sqrt(U.sum(rs.map(function (r) { return r.se * r.se; }))) / rs.length };
      });
    }
    var out = { order: L.order, phases: [], contrast: {} };
    [[base, lc.mid, L.order[0]], [lc.mid, lc.end, L.order[1]]].forEach(function (x) {
      var probes = {};
      if (x[0] && x[1]) Object.keys(x[1].results).forEach(function (id) { var d = diff(x[0], x[1], id); if (d) probes[id] = d; });
      out.phases.push({ cluster: x[2], exercises: C.lab[x[2]].slice(), done: !!(x[0] && x[1]), probes: probes });
    });
    var pA = out.phases[L.order[0] === 'A' ? 0 : 1].probes, pB = out.phases[L.order[0] === 'A' ? 1 : 0].probes;
    Object.keys(pA).forEach(function (id) {
      if (pB[id]) out.contrast[id] = { aMinusB: pA[id].change - pB[id].change, se: Math.sqrt(pA[id].se * pA[id].se + pB[id].se * pB[id].se) };
    });
    return out;
  }

  E.lab = { enroll: enroll, leave: leave, phase: phase, allowed: allowed, changes: labChanges };

  E.field('spatial', function () { return { expect: null }; }, function (v) {
    if (!isObj(v)) return undefined;
    var x = v.expect;
    return { expect: isObj(x) && isNum(x.value) && x.value >= 1 && x.value <= 5 && E.fix.time(x.t) !== undefined ? { value: Math.round(x.value), t: x.t } : null };
  });
  E.field('lab', function () { return { order: null, start: null, left: null }; }, function (v) {
    if (!isObj(v)) return undefined;
    var ok = v.order === 'AB' || v.order === 'BA';
    return { order: ok ? v.order : null, start: ok && E.fix.time(v.start) !== undefined ? v.start : null, left: E.fix.time(v.left) !== undefined ? v.left : null };
  });
  E.pooled('spatial', function (v) { return v; }); // expectation ratings with epoch ms (v1.2)
  E.pooled('lab', function (v) { return v; });

  /* ---------- the measure container, events and the session kind (wired late: those modules load after this file) */

  var WORDS = { 'likely gain': true, 'likely no change': true, 'unclear yet': true };
  // rec.measure (CONTRACT-v1.2 M; record.js registers the open container): { v, form0, verdicts: [{ day, at, words,
  // p, mean, lo, hi }], later: ms | null }. Unknown keys are kept.
  function curveOk(k, x) {
    return /^[a-z0-9]+@\d+$/.test(k) && isObj(x) && x.done === true && isNum(x.n) && isNum(x.slope) && isNum(x.se) && isNum(x.first) && x.ex === k.split('@')[0];
  }
  function checkMeasure(v) {
    if (!isObj(v)) return undefined;
    if (hasOwn.call(v, 'later') && !isNum(v.later)) delete v.later;
    if (hasOwn.call(v, 'balance')) {
      if (!isArray(v.balance)) delete v.balance;
      else v.balance = v.balance.filter(function (e) { return isObj(e) && typeof e.date === 'string' && isNum(e.n) && isArray(e.items); });
    }
    if (hasOwn.call(v, 'curves')) {
      if (!isObj(v.curves)) delete v.curves;
      else Object.keys(v.curves).forEach(function (k) { if (!curveOk(k, v.curves[k])) delete v.curves[k]; });
    }
    if (!hasOwn.call(v, 'verdicts')) return v; // keys are added when first needed, never by the repair
    v.verdicts = (isArray(v.verdicts) ? v.verdicts : []).filter(function (x) {
      return isObj(x) && isNum(x.day) && x.day > 0 && isNum(x.at) && WORDS[x.words] === true;
    }).map(function (x) {
      var o = { day: x.day, at: x.at, words: x.words };
      ['p', 'mean', 'lo', 'hi'].forEach(function (k) { if (isNum(x[k])) o[k] = x[k]; });
      return o;
    }).sort(function (a, b) { return a.day - b.day; });
    var seen = {};
    v.verdicts = v.verdicts.filter(function (x) { if (seen[x.day]) return false; seen[x.day] = true; return true; });
    return v;
  }
  // Two tabs: the verdicts of both (one per milestone day, the earlier), the first form either side drew.
  function mergeMeasure(theirs, mine, info) {
    var a = isObj(theirs) ? checkMeasure(U.deepCopy(theirs)) : null, b = isObj(mine) ? checkMeasure(U.deepCopy(mine)) : null;
    if (!a && !b) return undefined;
    var out = U.deepCopy(info && info.newer === 'mine' ? (b || a) : (a || b)), byDay = {};
    var all = (a && a.verdicts ? a.verdicts : []).concat(b && b.verdicts ? b.verdicts : []);
    all.forEach(function (x) { if (!byDay[x.day] || x.at < byDay[x.day].at) byDay[x.day] = x; });
    if (all.length) out.verdicts = Object.keys(byDay).map(function (d) { return byDay[d]; }).sort(function (x, y) { return x.day - y.day; });
    out.form0 = (a && a.form0) || (b && b.form0) || null;
    var later = (b && isNum(b.later) ? b.later : null) || (a && isNum(a.later) ? a.later : null);
    if (later !== null) out.later = later; else delete out.later;
    var cv = {};
    [a, b].forEach(function (x) {
      if (!x || !isObj(x.curves)) return;
      Object.keys(x.curves).forEach(function (k) { if (!cv[k] || x.curves[k].first < cv[k].first) cv[k] = x.curves[k]; });
    });
    if (Object.keys(cv).length) out.curves = cv; else delete out.curves;
    var bl = {}, lists = [a, b].map(function (x) { return x && isArray(x.balance) ? x.balance : []; });
    lists[0].concat(lists[1]).forEach(function (e) { if (!bl[e.date]) bl[e.date] = e; });
    var ball = Object.keys(bl).sort().map(function (d) { return bl[d]; });
    if (ball.length) out.balance = ball.slice(-((C.measure.lab && C.measure.lab.balance && C.measure.lab.balance.keep) || 24)); else delete out.balance;
    return out;
  }

  /* ---------- new-exercise learning curves (PLAN milestone 6, Lab checks; note T1 §5.2) ---------- */
  // An exercise added in an update is a task nobody has practised. Its first n rated answers (Train, Path or Speed;
  // right or wrong; this version of the exercise; not the timed, fluency, fixed, threshold, probe, daily or Climb items)
  // give a learning slope: P(right) = g + (1 − g − lapse)·σ(θ0 + β·x − b), x from 0 (the first answer) to 1 (the n-th),
  // b the difficulty each answer was rated on and g its guessing rate; θ0 and β by Fisher scoring with weak priors.
  // Exposure: the rated answers per bet before the exercise's first one. Observational (motivation and order confound
  // it), so pooled exports relate slopes to exposure and the Lab calls it exploratory. Pure: reads rec.trials;
  // opts.keep files finished curves in rec.measure.curves, so they outlive the trial cap.
  var CURVE_SKIP = { fluency: 1, fixed: 1, timed: 1, threshold: 1, probe: 1, daily: 1, climb: 1, set: 1 }; // set: W2-core, CONTRACT-v1.2 W4
  var CURVE_MODES = { train: 1, path: 1, speed: 1 };
  function fitCurve(rows, CC) {
    var n = rows.length, bm = 0, lapse = isNum(C.lapse) ? C.lapse : 0.03;
    rows.forEach(function (r) { bm += r.b / n; });
    var th = bm, be = 0, info = null, last = Math.max(1, CC.n - 1);
    for (var it = 0; it < 30; it++) {
      var g0 = -(th - bm) / (CC.startSd * CC.startSd), g1 = -be / (CC.slopeSd * CC.slopeSd);
      var i00 = 1 / (CC.startSd * CC.startSd), i01 = 0, i11 = 1 / (CC.slopeSd * CC.slopeSd);
      rows.forEach(function (r, k) {
        var x = k / last, sg = 1 / (1 + Math.exp(-(th + be * x - r.b))), sc = 1 - r.g - lapse;
        var P = Math.min(1 - 1e-9, Math.max(1e-9, r.g + sc * sg)), dP = sc * sg * (1 - sg);
        var d = (r.y - P) * dP / (P * (1 - P)), w = dP * dP / (P * (1 - P));
        g0 += d; g1 += d * x;
        i00 += w; i01 += w * x; i11 += w * x * x;
      });
      var det = i00 * i11 - i01 * i01;
      if (!(det > 0)) break;
      var s0 = (i11 * g0 - i01 * g1) / det, s1 = (i00 * g1 - i01 * g0) / det;
      th += Math.max(-2, Math.min(2, s0)); be += Math.max(-2, Math.min(2, s1));
      info = { i00: i00, i01: i01, i11: i11, det: det };
      if (Math.abs(s0) + Math.abs(s1) < 1e-6) break;
    }
    var V00 = info ? info.i11 / info.det : CC.startSd * CC.startSd, V01 = info ? -info.i01 / info.det : 0, V11 = info ? info.i00 / info.det : CC.slopeSd * CC.slopeSd;
    var gm = U.median(rows.map(function (r) { return r.g; })), xn = Math.min(1, (n - 1) / last);
    // the chance of a right answer on an item of the answers' mean difficulty, at x, with its 95 % range
    function pAt(x, zs) {
      var sd = Math.sqrt(Math.max(0, V00 + 2 * x * V01 + x * x * V11));
      return r3(gm + (1 - gm - lapse) / (1 + Math.exp(-(th + be * x - bm + zs * sd))));
    }
    return { start: r3(th - bm), slope: r3(be), se: r3(Math.sqrt(V11)), bMean: r3(bm),
      p0: pAt(0, 0), p0lo: pAt(0, -1.96), p0hi: pAt(0, 1.96), p1: pAt(xn, 0), p1lo: pAt(xn, -1.96), p1hi: pAt(xn, 1.96) };
  }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function curves(rec, opts) {
    wire();
    opts = opts || {};
    var CC = C.measure.curves, want = {}, out = {}, bets = {};
    if (!CC || !isArray(CC.ex)) return [];
    CC.ex.forEach(function (id) { var d = PX.ex.get(id); if (d && d.role !== 'probe') want[id] = d; });
    if (E.log && typeof E.log.scan === 'function' && rec && isArray(rec.trials)) {
      E.log.scan(rec, function (row, exId, mode, ver) {
        var oc = row[E.log.COL.outcome];
        if (!CURVE_MODES[mode] || (oc !== 0 && oc !== 1)) return;
        var kc = row[E.log.COL.kind], kind = isNum(kc) && E.log.KINDS[kc] ? E.log.KINDS[kc] : '';
        if (CURVE_SKIP[kind]) return;
        var d = PX.ex.get(exId);
        if (!d || d.role === 'probe') return;
        var w = want[exId];
        if (w && ver === (w.version || 1)) {
          var c = out[exId] || (out[exId] = { ex: exId, ver: ver, bet: w.bet || null, first: row[0], exposure: U.deepCopy(bets), rows: [] });
          if (c.rows.length < CC.n) {
            var p = E.log.rowParams(w, row, ver), b = E.log.bUsed(w, row, ver), g = null;
            try { g = p ? w.chance(p) : null; } catch (e) { g = null; }
            if (isNum(b) && isNum(g)) c.rows.push({ b: b, g: g, y: oc });
          }
        }
        var bet = d.bet || 'none';
        bets[bet] = (bets[bet] || 0) + 1;
      });
    }
    var kept = rec && isObj(rec.measure) && isObj(rec.measure.curves) ? rec.measure.curves : {};
    var list = [];
    CC.ex.forEach(function (id) {
      var w = want[id];
      if (!w) return;
      var key = id + '@' + (w.version || 1), c = out[id], k = kept[key];
      if ((!c || c.rows.length < CC.n) && isObj(k) && k.done) { list.push(U.deepCopy(k)); return; } // rows folded by the cap
      if (!c || c.rows.length < CC.min) return;
      var res = { ex: id, ver: c.ver, bet: c.bet, n: c.rows.length, done: c.rows.length >= CC.n, first: c.first, exposure: c.exposure };
      var f = fitCurve(c.rows, CC);
      for (var x in f) if (hasOwn.call(f, x)) res[x] = f[x];
      if (res.done && opts.keep && rec) {
        if (!isObj(rec.measure)) rec.measure = {};
        if (!isObj(rec.measure.curves)) rec.measure.curves = {};
        if (!isObj(rec.measure.curves[key])) rec.measure.curves[key] = U.deepCopy(res);
      }
      list.push(res);
    });
    return list;
  }

  var wired = { merge: false, record: false, events: false };
  // Registers what needs the modules that load after this one (merge, record, events); idempotent. Called by every
  // public function here and by js/ui/measure.js at load, so the record check runs before the first load.
  function wire() {
    if (!wired.merge && E.merge && typeof E.merge.register === 'function') {
      wired.merge = true;
      try { E.merge.register('measure', mergeMeasure); } catch (e) { /* registered already */ }
    }
    if (!wired.record && E.record && typeof E.record.check === 'function') {
      wired.record = true;
      try { E.record.check('measure', checkMeasure); } catch (e) { /* registered already */ }
    }
    if (!wired.events && E.events && typeof E.events.define === 'function') {
      wired.events = true;
      var have = typeof E.events.kinds === 'function' ? E.events.kinds() : {};
      try { if (!have.measure) E.events.define('measure', { owner: 'W2-measure', fields: { what: 'token', kind: 'token' } }); } catch (e) { /* defined */ }
      try { if (!have.background) E.events.define('background', { owner: 'W2-measure', fields: { q: 'token', a: 'token' } }); } catch (e) { /* W2-bets defined it */ }
    }
  }

  // The session of a measurement says what it was (CONTRACT-v1.2 M: rec.sessions[].kind).
  if (E.modes && typeof E.modes.hook === 'function') {
    E.modes.hook('finish', function (plan, rec, now, res) {
      if (plan.mode !== 'check' || !plan.check || !res.session) return;
      var k = SESSION_KIND[plan.check.kind];
      if (k) res.session.kind = k;
    }, { id: 'measure.session-kind', order: 5 });
  }

  E.assess = {
    start: start, next: next, answer: answer, void: voidStep, finish: finish, due: due, nextCheck: nextCheck, report: report,
    form: form, checks: checks, occasions: occasions, composite: composite, needB3: needB3, expect: expect,
    nextMeasure: nextMeasure, meter: meter, later: later, trendInput: trendInput, fit: fit, settle: settle, wire: wire,
    mix: mixOf, FULL: FULL, curves: curves, balanceReport: balanceReport, balanceSummary: balanceSummary,
    _: { fitCurve: fitCurve, GRID: GRID, newPost: newPost, updatePost: updatePost, summary: summary, priorCenter: priorCenter, drawForm0: drawForm0, cellsOf: cellsOf, rowCells: rowCells,
      checkMeasure: checkMeasure, mergeMeasure: mergeMeasure, hAt: hAt, fromPosterior: fromPosterior, blockMix: blockMix, fullMix: fullMix },
  };
})(window.PX);
