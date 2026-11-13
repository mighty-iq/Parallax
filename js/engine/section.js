/* PX.engine.section: Section practice, a timed rehearsal of the six DAT-style formats in the order
   of the Perceptual Ability Test (v1.1 PLAN M5; docs/research/v1.1/R3-dat-pat.md §2, §9). Pure: no
   DOM, no timers, no storage. Every call that needs the time takes `now` (ms); the UI measures the
   section's active time with PX.core.clock and passes it in. It never changes a rating, predicts
   no score and logs its trials with the mode name 'section'.

   Shape
     PARTS  the PAT order: openings, patviews, angles, patfold, cubes, form (config.parts overrides
            it in tests run before those exercises exist)
     SIZES  full 15 items a part, mini 5; PACE_MS 40 000 (60 minutes for 90 items), so a section
            missing parts keeps the test's pace: budget = items × 40 s
     parts(opts) → [{ id, def, ok, why }]            opts.can(def): this device can run it; opts.why(def): the reason when not
     shape(size, opts) → { size, parts: [id], missing: [{ id, why }], perPart, items, budgetMs }
   Alternate forms: form k of a size is the same for everyone with the same exercise versions. Its
   items sit in the middle band of each exercise's difficulty range (35–65 %), stratified across the
   band, with shared seeds from hash('px-section', size, k, exId, j).
     nextForm(rec, size) → k         formItems(size, k, exId, n) → [{ params, seed, code, b, g }]
   A run is plain JSON, kept in rec.section.live between items so that a reload can resume it:
     start(rec, { size, form, now, display, can }) → run, or { unavailable: text }
     current(run) → { part, index, it, exId }        go(run, index) → it (current part only)
     visit(run, index, ms) adds viewing time         flag(run, index, on)
     answer(run, index, { response, correct, rtMs, input, voided, voidReason }, now) → { it, replaced, capped?, broken? }
       a voided item does not count: a replacement (same settings, new seed) joins the end of its
       part, at most one per original item (capped); ERR_RUN 'error' voids in a row end the part
       (broken: its never-shown items do not count, and the screen moves on with a note)
     breakPart(run, p, why)          the same for a part that cannot be shown at all (no view, no WebGL)
     partInfo(run, p) → { n, answered, unanswered, flagged, right? }   (right only after the run ends)
     endPart(run, rec, now, usedMs) → the next part index, or -1 when it was the last
     finish(run, rec, now, { usedMs, pausedMs, ended: 'done' | 'time' | 'user' }) → result
       logs what is not logged yet, pushes a session (mode 'section') and a summary to
       rec.section.runs, adds the active time to rec.practiceMs, clears rec.section.live
     review(result, which) → [{ part, index, exId, seed, params, status, resp, correct, flag }]   shown items only
   Trial rows (one per presented item, written when its part ends): 1 right, 0 wrong, 3 seen but
   unanswered, 2 voided; the row's time is the item's last answer (or visit). For an exercise with
   the extra param `ask` (Painted Cubes: several questions about one figure), the row's value
   column holds ask, so seed + params code + value regenerate the exact item. */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;
  var M = E.model;

  var PARTS = ['openings', 'patviews', 'angles', 'patfold', 'cubes', 'form'];
  var SIZES = { full: { perPart: 15, label: 'full' }, mini: { perPart: 5, label: 'mini' } };
  var PACE_MS = 40000;
  var BAND = [0.35, 0.65];
  var MODE = 'section';
  var MAX_RUNS = 200;
  var ERR_RUN = 3;   // a part whose items fail to draw this many times in a row ends ("broken")
  var config = { parts: null, paceMs: null }; // tests: other parts, a faster pace

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }
  function sizeOf(s) { return hasOwn.call(SIZES, s) ? s : 'mini'; }
  function partIds() { return isArray(config.parts) && config.parts.length ? config.parts.slice() : PARTS.slice(); }

  function fmtMinutes(ms) {
    var m = ms / 60000, r = Math.round(m);
    if (Math.abs(m - r) < 0.02) return r + (r === 1 ? ' minute' : ' minutes');
    return 'about ' + Math.max(1, r) + (r === 1 ? ' minute' : ' minutes');
  }

  /* ---------- shape ---------- */

  function parts(opts) {
    opts = opts || {};
    return partIds().map(function (id) {
      var def = PX.ex.get(id);
      if (!def || def.role !== 'train') return { id: id, def: null, ok: false, why: 'not in this version yet' };
      var ok = !opts.can || !!opts.can(def);
      return { id: id, def: def, ok: ok, why: ok ? null : (opts.why && opts.why(def)) || 'cannot run on this device' };
    });
  }

  function shape(size, opts) {
    size = sizeOf(size);
    var list = parts(opts), per = SIZES[size].perPart;
    var ok = list.filter(function (p) { return p.ok; });
    return {
      size: size, perPart: per, parts: ok.map(function (p) { return p.id; }),
      missing: list.filter(function (p) { return !p.ok; }).map(function (p) { return { id: p.id, why: p.why }; }),
      items: ok.length * per, budgetMs: ok.length * per * (isNum(config.paceMs) && config.paceMs > 0 ? config.paceMs : PACE_MS), of: list.length,
    };
  }

  /* ---------- forms ---------- */

  function sec(rec) {
    if (!isObj(rec.section)) rec.section = defaults();
    var s = rec.section;
    if (!isArray(s.runs)) s.runs = [];
    if (!isObj(s.next)) s.next = { full: 1, mini: 1 };
    if (s.live === undefined) s.live = null;
    return s;
  }

  function nextForm(rec, size) {
    var s = isObj(rec.section) && isObj(rec.section.next) ? rec.section.next[sizeOf(size)] : null;
    return isNum(s) && s >= 1 ? Math.floor(s) : 1;
  }

  // n items in the middle band of the exercise's range, stratified so the band is covered; the
  // order within the part is shuffled by the form's own generator. An exercise with the extra
  // param `ask` (Painted Cubes) asks up to PER_FIGURE questions about one figure, as the test's
  // cube-counting part does (R3 §2.2): the questions share the figure's seed, differ in `ask`, and
  // stay together.
  var PER_FIGURE = 3;
  function band(def) {
    var r = M.range(def), lo = r.min + BAND[0] * (r.max - r.min), hi = r.min + BAND[1] * (r.max - r.min);
    var cands = M.pool(def).filter(function (c) { return c.b >= lo - 1e-9 && c.b <= hi + 1e-9; });
    if (!cands.length) cands = [M.nearest(def, (r.min + r.max) / 2)].filter(Boolean);
    return cands.slice().sort(function (a, b) { return a.b - b.b || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0); });
  }
  function asks(def) { return isArray(def.extraParams) && def.extraParams.indexOf('ask') >= 0; }
  function baseParams(def, p) {
    var out = M.copyParams(p);
    (def.extraParams || []).forEach(function (k) { delete out[k]; });
    return out;
  }
  function figureItems(def, size, form, exId, n, cands, rng) {
    var F = Math.max(1, Math.ceil(n / PER_FIGURE)), figs = [], count = 0, used = {};
    for (var f = 0; count < n && f < 4 * n; f++) {
      var c = cands[Math.min(cands.length - 1, Math.floor(((f % F) + rng.next()) / F * cands.length))];
      var seed = E.select.sharedSeed(PX.rng.hash('px-section', size, form, exId, 'figure', f));
      while (used[seed]) seed = E.select.sharedSeed(PX.rng.hash('px-section', size, form, exId, 'figure', f, seed));
      used[seed] = true;
      var m = 1; // how many different questions the figure allows (item.asks)
      try { var it0 = def.generate(PX.rng(seed), M.copyParams(c.params)); m = it0 && isArray(it0.asks) && it0.asks.length ? it0.asks.length : 1; } catch (e) { m = 1; }
      var q = Math.max(1, Math.min(PER_FIGURE, m, n - count)), group = [];
      for (var i = 0; i < q; i++) {
        var p = M.copyParams(c.params);
        p.ask = i;
        group.push({ params: p, seed: seed, code: c.code, b: c.b, g: c.g });
      }
      figs.push(group);
      count += q;
    }
    var out = [];
    rng.shuffle(figs).forEach(function (g) { out = out.concat(g); });
    return out.slice(0, n);
  }
  function formItems(size, form, exId, n) {
    var def = PX.ex.get(exId);
    if (!def) return [];
    var cands = band(def);
    var rng = PX.rng(PX.rng.hash('px-section-params', size, form, exId)), out = [], used = {};
    if (asks(def)) return figureItems(def, size, form, exId, n, cands, rng);
    for (var j = 0; j < n; j++) {
      var at = Math.min(cands.length - 1, Math.floor((j + rng.next()) / n * cands.length));
      var c = cands[at];
      var seed = E.select.sharedSeed(PX.rng.hash('px-section', size, form, exId, j));
      while (used[seed]) seed = E.select.sharedSeed(PX.rng.hash('px-section', size, form, exId, j, seed));
      used[seed] = true;
      out.push({ params: M.copyParams(c.params), seed: seed, code: c.code, b: c.b, g: c.g });
    }
    return rng.shuffle(out);
  }

  function newItem(spec, j, extra) {
    var it = {
      j: j, seed: spec.seed, params: spec.params, code: spec.code, b: spec.b, g: spec.g, p: isNum(spec.p) ? spec.p : null,
      status: 'new', resp: null, correct: null, rtMs: null, timeMs: 0, visits: 0, flag: false, input: null, at: null,
    };
    if (extra) for (var k in extra) if (hasOwn.call(extra, k)) it[k] = extra[k];
    return it;
  }

  /* ---------- a run ---------- */

  function start(rec, opts) {
    opts = opts || {};
    var now = isNum(opts.now) ? opts.now : 0, size = sizeOf(opts.size);
    var sh = shape(size, opts);
    if (!sh.parts.length) return { unavailable: 'Section practice needs at least one of the DAT-style exercises, and none can run here yet.' };
    var form = isNum(opts.form) && opts.form >= 1 ? Math.floor(opts.form) : nextForm(rec, size);
    var display = opts.display === 'small' ? 'small' : 'large';
    var run = {
      v: 1, id: 'sec' + Math.floor(now).toString(36), size: size, form: form, start: now, at: now,
      budgetMs: sh.budgetMs, usedMs: 0, pausedMs: 0, display: display,
      part: 0, index: 0, missing: sh.missing, done: false, ended: null,
      parts: sh.parts.map(function (id) {
        var def = PX.ex.get(id), st = E.est.get(rec, def, { display: display }, now);
        var items = formItems(size, form, id, sh.perPart).map(function (s, j) {
          var c = M.byKey(def, PX.ex.paramsKey(baseParams(def, s.params)));
          s.p = c ? M.pExp(st.mu, st.sd, c.b, c.g) : null;
          return newItem(s, j);
        });
        return { exId: id, version: def.version || 1, items: items, logged: false, t0: null, t1: null };
      }),
    };
    run.parts[0].t0 = 0;
    return run;
  }

  function partOf(run, p) { return run.parts[isNum(p) ? p : run.part] || null; }
  function current(run) {
    var P = partOf(run), it = P ? P.items[run.index] || null : null;
    return { part: run.part, index: run.index, it: it, exId: P ? P.exId : null };
  }
  function go(run, index) {
    var P = partOf(run);
    if (!P || run.done || !(index >= 0 && index < P.items.length)) return null;
    run.index = index;
    return P.items[index];
  }
  function itemAt(run, index) { var P = partOf(run); return P ? P.items[index] || null : null; }

  function originals(P) { var n = 0; P.items.forEach(function (x) { if (!x.rep) n++; }); return n; }
  function reps(P) { return P.items.length - originals(P); }
  // A part that cannot be shown (its exercise does not mount, or keeps failing to draw): it ends,
  // and its items that were never shown do not count.
  function breakPart(run, p, why) {
    var P = partOf(run, p);
    if (P && !P.broken) P.broken = typeof why === 'string' && why ? why.slice(0, 60) : 'could not be shown here';
    return P;
  }

  function visit(run, index, ms, now) {
    var it = itemAt(run, index);
    if (!it) return null;
    if (isNum(ms) && ms > 0) partOf(run).errRun = 0; // it was on screen: the part draws
    if (it.status === 'new') it.status = 'seen';
    it.visits += 1;
    if (isNum(ms) && ms > 0) it.timeMs += Math.round(ms);
    if (isNum(now) && it.status === 'seen') it.at = now;
    return it;
  }

  function flag(run, index, on) {
    var it = itemAt(run, index);
    if (!it || it.status === 'void') return null;
    it.flag = on === undefined ? !it.flag : !!on;
    return it;
  }

  function answer(run, index, r, now) {
    var P = partOf(run), it = itemAt(run, index);
    if (!it || run.done || it.status === 'void') return { it: it, replaced: null };
    r = r || {};
    it.at = isNum(now) ? now : it.at;
    if (r.voided) {
      it.status = 'void';
      it.voidReason = typeof r.voidReason === 'string' ? r.voidReason.slice(0, 24) : 'void';
      it.flag = false;
      // Items that keep failing to draw end the part; replacements stop at one per original item.
      P.errRun = it.voidReason === 'error' ? (P.errRun || 0) + 1 : 0;
      if (P.errRun >= ERR_RUN) { P.broken = P.broken || 'could not be shown here'; return { it: it, replaced: null, broken: P.broken }; }
      if (reps(P) >= originals(P)) return { it: it, replaced: null, capped: true };
      // The replacement keeps the settings, with a seed of its own (R3 §9: replaced at the end of its part).
      var k = reps(P) + 1;
      var seed = E.select.sharedSeed(PX.rng.hash('px-section', run.size, run.form, P.exId, it.j, 'r', k));
      var rep = newItem({ params: U.deepCopy(it.params), seed: seed, code: it.code, b: it.b, g: it.g, p: it.p }, it.j, { rep: true, replaces: index });
      P.items.push(rep);
      return { it: it, replaced: P.items.length - 1 };
    }
    P.errRun = 0;
    it.status = 'answered';
    it.resp = r.response === undefined ? null : U.deepCopy(r.response);
    it.correct = !!r.correct;
    it.rtMs = isNum(r.rtMs) ? Math.round(r.rtMs) : null;
    it.input = typeof r.input === 'string' ? r.input.slice(0, 12) : null;
    return { it: it, replaced: null };
  }

  function counts(items, withRight, broken) {
    var o = { n: 0, answered: 0, unanswered: 0, flagged: 0, voided: 0, seen: 0 };
    if (withRight) o.right = 0;
    items.forEach(function (it) {
      if (it.status === 'void') { o.voided++; return; }
      if (broken && it.status === 'new') return; // a broken part: what was never shown does not count
      o.n++;
      if (it.status === 'answered') { o.answered++; if (withRight && it.correct) o.right++; } else o.unanswered++;
      if (it.status !== 'new') o.seen++;
      if (it.flag) o.flagged++;
    });
    return o;
  }
  function partInfo(run, p) { var P = partOf(run, p); return P ? counts(P.items, run.done, !!P.broken) : null; }

  /* ---------- logging ---------- */

  function logPart(run, rec, P, now) {
    if (P.logged) return 0;
    P.logged = true;
    var def = PX.ex.get(P.exId);
    if (!def || (def.version || 1) !== P.version) return 0; // the exercise changed under a resumed run
    var rows = [];
    P.items.forEach(function (it) {
      if (it.status === 'new') return; // never shown: nothing to log
      var oc = it.status === 'void' ? 2 : it.status === 'answered' ? (it.correct ? 1 : 0) : 3;
      var step = { code: it.code, seed: it.seed, pPred: it.p, stage: null, display: run.display };
      var result = { correct: it.correct === true, rt: it.status === 'answered' ? it.rtMs : null, input: it.input, display: run.display };
      if (isNum(it.params.ask)) result.value = it.params.ask; // the question asked about the figure (Painted Cubes), for regenerating the item
      var t = isNum(it.at) ? Math.min(it.at, now) : now;
      rows.push(E.log.row(rec, def, MODE, step, oc, result, t));
    });
    rows.sort(function (a, b) { return a[0] - b[0]; });
    rows.forEach(function (row) { E.log.append(rec, row); });
    return rows.length;
  }

  function endPart(run, rec, now, usedMs) {
    var P = partOf(run);
    if (!P || run.done) return -1;
    if (isNum(usedMs)) { P.t1 = usedMs; run.usedMs = Math.max(run.usedMs, usedMs); }
    logPart(run, rec, P, now);
    if (run.part + 1 >= run.parts.length) return -1;
    run.part += 1;
    run.index = 0;
    run.parts[run.part].t0 = isNum(usedMs) ? usedMs : run.usedMs;
    return run.part;
  }

  /* ---------- the end ---------- */

  function finish(run, rec, now, o) {
    o = o || {};
    if (run.done && run.result) return run.result;
    var used = Math.min(isNum(o.usedMs) ? Math.max(0, Math.round(o.usedMs)) : run.usedMs, run.budgetMs); // never more than the clock had
    var P = partOf(run);
    if (P && !isNum(P.t1)) P.t1 = used;
    run.parts.forEach(function (x) { logPart(run, rec, x, now); });
    run.done = true;
    run.ended = o.ended === 'time' || o.ended === 'user' ? o.ended : 'done';
    run.usedMs = used;
    run.pausedMs = isNum(o.pausedMs) ? Math.max(0, Math.round(o.pausedMs)) : run.pausedMs;
    var parts2 = run.parts.map(function (x) {
      var c = counts(x.items, true, !!x.broken);
      var t = isNum(x.t0) ? Math.max(0, Math.round((isNum(x.t1) ? x.t1 : used) - x.t0)) : 0;
      // reached: at least one of its items was shown (a part left during its instructions was not)
      return { exId: x.exId, n: c.n, right: c.right, answered: c.answered, unanswered: c.unanswered, flagged: c.flagged, voided: c.voided, seen: c.seen, timeMs: t, reached: c.seen > 0, broken: x.broken || null };
    });
    var tot = parts2.reduce(function (a, x) { a.n += x.n; a.right += x.right; a.answered += x.answered; a.unanswered += x.unanswered; return a; }, { n: 0, right: 0, answered: 0, unanswered: 0 });
    var summary = {
      id: run.id, size: run.size, form: run.form, start: run.start, end: now, usedMs: used, pausedMs: run.pausedMs,
      budgetMs: run.budgetMs, ended: run.ended, right: tot.right, n: tot.n, answered: tot.answered, unanswered: tot.unanswered,
      app: typeof PX.version === 'string' ? PX.version : null, // forms come from the item models of this version
      parts: parts2.map(function (x) {
        var o2 = { exId: x.exId, n: x.n, right: x.right, answered: x.answered, flagged: x.flagged, voided: x.voided, seen: x.seen, reached: x.reached, timeMs: x.timeMs };
        if (x.broken) o2.broken = x.broken;
        return o2;
      }),
    };
    var s = sec(rec);
    s.runs.push(summary);
    if (s.runs.length > MAX_RUNS) s.runs.splice(0, s.runs.length - MAX_RUNS);
    s.next[run.size] = Math.max(nextForm(rec, run.size), run.form + 1);
    s.live = null;
    var session = null;
    if (tot.answered > 0) {
      session = {
        id: run.id, start: run.start, end: Math.max(now, run.start), mode: MODE, trials: tot.answered, right: tot.right,
        practiceMs: used, exs: parts2.filter(function (x) { return x.reached; }).map(function (x) { return x.exId; }),
        summary: { section: { size: run.size, form: run.form, right: tot.right, n: tot.n, unanswered: tot.unanswered, ended: run.ended } },
      };
      if (!isArray(rec.sessions)) rec.sessions = [];
      rec.sessions.push(session);
      rec.practiceMs = (isNum(rec.practiceMs) ? rec.practiceMs : 0) + used;
    }
    run.result = { summary: summary, parts: parts2, total: tot, session: session, run: run };
    return run.result;
  }

  // Items to look at again ('again': wrong, skipped or flagged) or every item ('all'): only items
  // that were shown (never-shown items, as in a part not reached, are not listed).
  function review(result, which) {
    var out = [];
    if (!result || !result.run) return out;
    result.run.parts.forEach(function (P, p) {
      P.items.forEach(function (it, i) {
        if (it.status === 'void' || it.status === 'new') return;
        var again = it.status !== 'answered' || !it.correct || it.flag;
        if (which !== 'all' && !again) return;
        out.push({ part: p, index: i, exId: P.exId, seed: it.seed, params: it.params, status: it.status, resp: it.resp, correct: it.correct, flag: it.flag, rtMs: it.rtMs, timeMs: it.timeMs });
      });
    });
    return out;
  }

  /* ---------- the live run and the record field ---------- */

  function save(rec, run, usedMs, pausedMs, now) {
    if (isNum(usedMs)) run.usedMs = Math.max(run.usedMs, Math.round(usedMs));
    if (isNum(pausedMs)) run.pausedMs = Math.round(pausedMs);
    if (isNum(now)) run.at = now;
    sec(rec).live = run.done ? null : run;
  }
  function live(rec) {
    var r = isObj(rec.section) ? rec.section.live : null;
    return fixLive(r) || null;
  }
  function drop(rec) { sec(rec).live = null; }

  function defaults() { return { runs: [], next: { full: 1, mini: 1 }, live: null }; }
  var F = E.fix;
  function fixItem(x) {
    if (!isObj(x) || !isNum(x.seed) || !isObj(x.params) || !isNum(x.code)) return undefined;
    var st = ['new', 'seen', 'answered', 'void'].indexOf(x.status) >= 0 ? x.status : 'new';
    var out = U.deepCopy(x);
    out.status = st;
    out.timeMs = F.num(x.timeMs, 0, 1e9) || 0;
    out.visits = F.int(x.visits, 0, 1e6) || 0;
    out.flag = x.flag === true;
    out.correct = st === 'answered' ? x.correct === true : null;
    return out;
  }
  // A saved run, repaired: replacements beyond the cap (one per original item) that were never
  // shown are dropped (a run saved by an older build could hold thousands); a part without original
  // items, a damaged item or part, or a finished run is refused; a budget outside 1 s to 10 min an
  // item is recomputed at the test's pace.
  function fixLive(r) {
    if (!isObj(r) || !hasOwn.call(SIZES, r.size) || !isArray(r.parts) || !r.parts.length || r.done === true) return null;
    var parts2 = [], nOrig = 0;
    for (var i = 0; i < r.parts.length; i++) {
      var P = r.parts[i];
      if (!isObj(P) || !F.id(P.exId) || !isArray(P.items)) return null;
      var items = P.items.map(fixItem);
      if (items.some(function (x) { return x === undefined; })) return null;
      var orig = items.filter(function (x) { return !x.rep; }).length, kept = 0;
      if (!orig) return null;
      items = items.filter(function (x) {
        if (!x.rep) return true;
        if (x.status !== 'new') { kept++; return true; }
        return kept < orig ? (kept++, true) : false;
      });
      if (items.length > 2 * orig) return null; // more shown replacements than items: not a run this app made
      nOrig += orig;
      var Q = { exId: P.exId, version: F.int(P.version, 1, 9999) || 1, items: items, logged: P.logged === true, t0: isNum(P.t0) ? P.t0 : null, t1: isNum(P.t1) ? P.t1 : null };
      if (typeof P.broken === 'string' && P.broken) Q.broken = P.broken.slice(0, 60);
      if (isNum(P.errRun)) Q.errRun = F.int(P.errRun, 0, 1e4) || 0;
      parts2.push(Q);
    }
    var out = U.deepCopy(r);
    out.parts = parts2;
    out.part = F.int(r.part, 0, parts2.length - 1) || 0;
    out.index = F.int(r.index, 0, 1e4) || 0;
    out.usedMs = F.num(r.usedMs, 0, 1e9) || 0;
    out.pausedMs = F.num(r.pausedMs, 0, 1e10) || 0;
    var b = r.budgetMs;
    out.budgetMs = isNum(b) && b >= nOrig * 1000 && b <= nOrig * 600000 ? b : nOrig * PACE_MS;
    out.form = F.int(r.form, 1, 1e6) || 1;
    if (out.index >= parts2[out.part].items.length) out.index = 0;
    return out;
  }
  E.field('section', defaults, function (v) {
    if (!isObj(v)) return undefined;
    var runs = F.list(v.runs, function (x) { return isObj(x) && typeof x.id === 'string' && hasOwn.call(SIZES, x.size) && isNum(x.start) ? U.deepCopy(x) : undefined; }, MAX_RUNS) || [];
    var next = { full: F.int(v.next && v.next.full, 1, 1e6) || 1, mini: F.int(v.next && v.next.mini, 1, 1e6) || 1 };
    return { runs: runs, next: next, live: fixLive(v.live) };
  });

  E.section = {
    PARTS: PARTS, SIZES: SIZES, PACE_MS: PACE_MS, BAND: BAND, MODE: MODE, config: config,
    parts: parts, shape: shape, nextForm: nextForm, formItems: formItems, fmtMinutes: fmtMinutes,
    start: start, current: current, go: go, item: itemAt, visit: visit, flag: flag, answer: answer, breakPart: breakPart,
    partInfo: partInfo, endPart: endPart, finish: finish, review: review, ERR_RUN: ERR_RUN,
    save: save, live: live, drop: drop, fixLive: fixLive, defaults: defaults,
  };
})(window.PX);
