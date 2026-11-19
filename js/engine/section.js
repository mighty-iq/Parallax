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
   items sit in the middle band of each exercise's difficulty range (35–65 %; v1.2: the range without
   the exercise's starter levels, and for an exercise with a test range only its 'test' settings), stratified
   across the band, with shared seeds from
   hash('px-section', size, k, exId, j).
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
     numberOf(run, index, p) → the item's number, which never shifts (v1.2 O11): its place in the form
       (j + 1); a replacement takes the number of the item it replaces (it is still shown at the part's
       end); numberCount(run, p) → the part's numbers (its original items)
   Test conditions (v1.2, PLAN milestone 8; note docs/research/v1.2/D1-pat-formats.md addendum A.4). A run made
   by this version (v 2, nav 'free') starts with every part's instructions, before its clock (begun false until
   begin(run)); then the player moves freely across the parts, as test takers describe the screen:
     go(run, index, part) opens any item of any part      step(run, dir, from?) → { part, index } of the next
       (dir 1) or previous (−1) item across parts, skipping voided items and broken parts; null at either end
     strike(run, index, option, on?, part?) → the item's struck-out options (a sorted list; on toggles when absent)
     list(run, 'marked' | 'unanswered' | 'all') → [{ part, index, no, exId, answered, flag, seen, current }],
       the review list (never-shown items count as unanswered; voided items and broken parts are left out)
   Its trials are logged when it ends (finish), and a part's time is the time its items were on screen (the
   sum of their visits); runs from 1.1 keep their part-by-part flow (endPart, part times from the clock).
   Painted Cubes' figures carry 2 to 5 questions (item.asks), and a form asks each figure all of them that fit.
   The last finished run (v1.2 O10: a reload during the review lost it) is kept in rec.section.last, a
   compact copy of its items and answers with `open` while its review is on screen:
     last(rec) → that copy or null; lastResult(rec, now) → a result as finish() returns it (no session),
       or null when an exercise of the run is missing or at another version; lastOpen(rec, on, now)
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
    if (s.last === undefined) s.last = null;
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
  var PER_FIGURE = 3; // 1.1's cap; since v1.2 a figure keeps all its questions, up to SET_MAX (the format asks 2 to 5)
  var SET_MAX = 5;
  // The band is taken from the range the exercise spans without its starter levels (v1.2: a first band in
  // front, note D2 §3.0 A, must not make test-conditions practice easier; W1-band-A's request). For an
  // exercise without starter levels this is M.range(def), so its forms are unchanged.
  // v1.2 (PLAN milestone 8, CONTRACT-v1.2 W3; W1-band-B's request): an exercise that declares a test range is
  // dealt at its test-range settings only (PX.ex.rangeTag 'test': the features the official instructions show),
  // so starter levels and anything tagged below or beyond the format stay out (Missing View's cube stacks among
  // them); the middle band is then taken within those settings. Forms stay seeded and the same for everyone.
  function band(def) {
    var starters = isArray(def.starters) ? def.starters : def.starter ? [def.starter] : [];
    var all = M.pool(def), list = all.filter(function (c) {
      return starters.every(function (st) { return !(c.params[st.dim] < st.levels); });
    });
    if (def.testRange && PX.ex.rangeTag) {
      var inRange = all.filter(function (c) { return PX.ex.rangeTag(def, c.params) === 'test'; });
      if (inRange.length) list = inRange;
    }
    if (!list.length) list = all;
    var min = Infinity, max = -Infinity, inList = {};
    list.forEach(function (c) { if (c.b < min) min = c.b; if (c.b > max) max = c.b; inList[c.key] = true; });
    var lo = min + BAND[0] * (max - min), hi = min + BAND[1] * (max - min);
    var cands = list.filter(function (c) { return c.b >= lo - 1e-9 && c.b <= hi + 1e-9; });
    if (!cands.length) cands = [M.nearest(def, (min + max) / 2, function (c) { return inList[c.key] === true; })].filter(Boolean);
    return cands.slice().sort(function (a, b) { return a.b - b.b || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0); });
  }
  function asks(def) { return isArray(def.extraParams) && def.extraParams.indexOf('ask') >= 0; }
  function baseParams(def, p) {
    var out = M.copyParams(p);
    (def.extraParams || []).forEach(function (k) { delete out[k]; });
    return out;
  }
  function figureItems(def, size, form, exId, n, cands, rng) {
    var F = Math.max(1, Math.ceil(n / PER_FIGURE)), figs = [], count = 0, used = {}; // F: how many figure slots stratify the band
    for (var f = 0; count < n && f < 4 * n; f++) {
      var c = cands[Math.min(cands.length - 1, Math.floor(((f % F) + rng.next()) / F * cands.length))];
      var seed = E.select.sharedSeed(PX.rng.hash('px-section', size, form, exId, 'figure', f));
      while (used[seed]) seed = E.select.sharedSeed(PX.rng.hash('px-section', size, form, exId, 'figure', f, seed));
      used[seed] = true;
      var m = 1; // how many different questions the figure allows (item.asks)
      try { var it0 = def.generate(PX.rng(seed), M.copyParams(c.params)); m = it0 && isArray(it0.asks) && it0.asks.length ? it0.asks.length : 1; } catch (e) { m = 1; }
      var q = Math.max(1, Math.min(SET_MAX, m, n - count)), group = [];
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
      v: 2, nav: 'free', begun: false, id: 'sec' + Math.floor(now).toString(36), size: size, form: form, start: now, at: now,
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
  function go(run, index, part) {
    if (isNum(part) && part !== run.part) {
      // another part: only a free run moves across parts (a 1.1 run closes each part with endPart)
      var Q = run.nav === 'free' ? run.parts[part] : null;
      if (!Q || run.done || !(index >= 0 && index < Q.items.length)) return null;
      run.part = part;
      run.index = index;
      return Q.items[index];
    }
    var P = partOf(run);
    if (!P || run.done || !(index >= 0 && index < P.items.length)) return null;
    run.index = index;
    return P.items[index];
  }
  // The positions a free run can open, in order: every item that is not voided, in parts that are not broken.
  function positions(run) {
    var out = [];
    run.parts.forEach(function (P, p) {
      if (P.broken || P.logged) return; // logged: a part a 1.1 run closed before it went on freely
      P.items.forEach(function (it, i) { if (it.status !== 'void') out.push({ part: p, index: i }); });
    });
    return out;
  }
  function step(run, dir, from) {
    var p = from && isNum(from.part) ? from.part : run.part, i = from && isNum(from.index) ? from.index : run.index;
    var list = positions(run), after = function (q) { return q.part > p || (q.part === p && q.index > i); };
    if (dir < 0) {
      for (var k = list.length - 1; k >= 0; k--) if (!after(list[k]) && !(list[k].part === p && list[k].index === i)) return list[k];
      return null;
    }
    for (var j = 0; j < list.length; j++) if (after(list[j])) return list[j];
    return null;
  }
  var STRIKE_MAX = 10;
  function strike(run, index, opt, on, part) {
    var P = partOf(run, part), it = P ? P.items[index] : null;
    if (!it || run.done || it.status === 'void' || !(isNum(opt) && opt >= 0 && opt < STRIKE_MAX && opt === Math.floor(opt))) return null;
    var s = isArray(it.struck) ? it.struck.slice() : [], at = s.indexOf(opt), want = on === undefined ? at < 0 : !!on;
    if (want && at < 0) s.push(opt);
    if (!want && at >= 0) s.splice(at, 1);
    s.sort(function (a, b) { return a - b; });
    if (s.length) it.struck = s; else delete it.struck;
    return s;
  }
  function list(run, which) {
    var out = [];
    run.parts.forEach(function (P, p) {
      if (P.broken || P.logged) return;
      P.items.forEach(function (it, i) {
        if (it.status === 'void') return;
        var answered = it.status === 'answered';
        if (which === 'marked' && !it.flag) return;
        if (which === 'unanswered' && answered) return;
        out.push({ part: p, index: i, no: numberOf(run, i, p), exId: P.exId, answered: answered, flag: !!it.flag, seen: it.status !== 'new', current: p === run.part && i === run.index });
      });
    });
    return out;
  }
  function begin(run) { if (run && !run.done) run.begun = true; return run; }
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

  // Item numbers (v1.2 O11). In 1.1 an item's number was its place among the part's items that count, so a
  // void earlier in the part moved every later number down ("item 4", flagged, became "item 3"). Now an item
  // keeps its place in the form, j + 1, and a replacement the number of the item it replaces. A run saved
  // without j falls back to the 1.1 count.
  function numberOf(run, index, p) {
    var P = partOf(run, p), it = P ? P.items[index] : null;
    if (!it) return null;
    if (isNum(it.j) && it.j >= 0 && it.j === Math.floor(it.j)) return it.j + 1;
    var n = 0;
    for (var i = 0; i <= index && i < P.items.length; i++) if (P.items[i].status !== 'void') n++;
    return n;
  }
  function numberCount(run, p) { var P = partOf(run, p); return P ? originals(P) : 0; }

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
    run.end = now;
    var tl = tally(run), parts2 = tl.parts, tot = tl.total, summary = tl.summary;
    var s = sec(rec);
    s.last = keep(run); // the review survives a reload (v1.2 O10)
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

  // The counts of a finished run: its parts, totals and summary (finish, and the kept run's review).
  function tally(run) {
    var used = run.usedMs;
    var parts2 = run.parts.map(function (x) {
      var c = counts(x.items, true, !!x.broken);
      var t = run.nav === 'free' ? x.items.reduce(function (a, it) { return a + (it.status === 'void' ? 0 : isNum(it.timeMs) ? it.timeMs : 0); }, 0)
        : isNum(x.t0) ? Math.max(0, Math.round((isNum(x.t1) ? x.t1 : used) - x.t0)) : 0;
      // reached: at least one of its items was shown (a part left during its instructions was not)
      return { exId: x.exId, n: c.n, right: c.right, answered: c.answered, unanswered: c.unanswered, flagged: c.flagged, voided: c.voided, seen: c.seen, timeMs: t, reached: c.seen > 0, broken: x.broken || null };
    });
    var tot = parts2.reduce(function (a, x) { a.n += x.n; a.right += x.right; a.answered += x.answered; a.unanswered += x.unanswered; return a; }, { n: 0, right: 0, answered: 0, unanswered: 0 });
    var summary = {
      id: run.id, size: run.size, form: run.form, start: run.start, end: run.end, usedMs: used, pausedMs: run.pausedMs,
      budgetMs: run.budgetMs, ended: run.ended, right: tot.right, n: tot.n, answered: tot.answered, unanswered: tot.unanswered,
      app: typeof PX.version === 'string' ? PX.version : null, // forms come from the item models of this version
      parts: parts2.map(function (x) {
        var o2 = { exId: x.exId, n: x.n, right: x.right, answered: x.answered, flagged: x.flagged, voided: x.voided, seen: x.seen, reached: x.reached, timeMs: x.timeMs };
        if (x.broken) o2.broken = x.broken;
        return o2;
      }),
    };
    return { parts: parts2, total: tot, summary: summary };
  }

  /* ---------- the last finished run, kept for its review (v1.2 O10) ---------- */

  // what the review and its counts need of an item (the rest stays in the trial log)
  var KEEP_ITEM = ['j', 'seed', 'params', 'code', 'status', 'resp', 'correct', 'rtMs', 'timeMs', 'flag', 'rep', 'replaces'];
  function keep(run) {
    return {
      v: 1, nav: run.nav === 'free' ? 'free' : undefined, id: run.id, size: run.size, form: run.form, start: run.start, end: run.end, budgetMs: run.budgetMs, usedMs: run.usedMs,
      pausedMs: run.pausedMs, display: run.display, ended: run.ended, missing: U.deepCopy(run.missing || []), open: true,
      parts: run.parts.map(function (P) {
        var Q = { exId: P.exId, version: P.version, t0: P.t0, t1: P.t1, items: P.items.map(function (it) {
          var o = {};
          KEEP_ITEM.forEach(function (k) { if (it[k] !== undefined) o[k] = U.deepCopy(it[k]); });
          return o;
        }) };
        if (P.broken) Q.broken = P.broken;
        return Q;
      }),
    };
  }
  function fixLast(r) {
    if (!isObj(r) || typeof r.id !== 'string' || !hasOwn.call(SIZES, r.size) || !isArray(r.parts) || !r.parts.length || r.parts.length > 12) return null;
    var parts2 = [];
    for (var i = 0; i < r.parts.length; i++) {
      var P = r.parts[i];
      if (!isObj(P) || !F.id(P.exId) || !isArray(P.items) || !P.items.length || P.items.length > 2 * SIZES.full.perPart) return null;
      var items = P.items.map(fixItem);
      if (items.some(function (x) { return x === undefined; })) return null;
      var Q = { exId: P.exId, version: F.int(P.version, 1, 9999) || 1, items: items, t0: isNum(P.t0) ? P.t0 : null, t1: isNum(P.t1) ? P.t1 : null };
      if (typeof P.broken === 'string' && P.broken) Q.broken = P.broken.slice(0, 60);
      parts2.push(Q);
    }
    var out = U.deepCopy(r);
    out.parts = parts2;
    out.open = r.open === true;
    out.ended = r.ended === 'time' || r.ended === 'user' ? r.ended : 'done';
    out.usedMs = F.num(r.usedMs, 0, 1e9) || 0;
    out.pausedMs = F.num(r.pausedMs, 0, 1e10) || 0;
    out.budgetMs = F.num(r.budgetMs, 0, 1e9) || 0;
    out.form = F.int(r.form, 1, 1e6) || 1;
    out.start = isNum(r.start) ? r.start : 0;
    out.end = isNum(r.end) ? r.end : out.start;
    out.missing = isArray(r.missing) ? r.missing.filter(function (m) { return isObj(m) && F.id(m.id); }).map(function (m) { return { id: m.id, why: typeof m.why === 'string' ? m.why.slice(0, 60) : null }; }) : [];
    return out;
  }
  function last(rec) { return isObj(rec.section) ? fixLast(rec.section.last) : null; }
  // A result for the review, from the kept run: null when an exercise of it is gone or at another version
  // (its items would not be the ones the run showed). The run comes back finished, with its own summary.
  function lastResult(rec) {
    var L = last(rec);
    if (!L) return null;
    for (var i = 0; i < L.parts.length; i++) {
      var def = PX.ex.get(L.parts[i].exId);
      if (!def || (def.version || 1) !== L.parts[i].version) return null;
    }
    var run = L;
    run.done = true; run.part = run.parts.length - 1; run.index = 0;
    var tl = tally(run);
    return { summary: tl.summary, parts: tl.parts, total: tl.total, session: null, run: run, kept: true };
  }
  // The kept run's review is open (a reload reopens it) or closed (the setup screen offers it instead).
  function lastOpen(rec, on) {
    var s = isObj(rec.section) ? rec.section : null;
    if (!s || !isObj(s.last)) return false;
    s.last.open = !!on;
    return true;
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

  function defaults() { return { runs: [], next: { full: 1, mini: 1 }, live: null, last: null }; }
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
    // struck-out options (v1.2): distinct whole numbers 0–9, sorted; anything else is dropped
    var sk = isArray(x.struck) ? x.struck.filter(function (v, i, a) { return isNum(v) && v >= 0 && v < STRIKE_MAX && v === Math.floor(v) && a.indexOf(v) === i; }).sort(function (a, b) { return a - b; }) : [];
    if (sk.length) out.struck = sk; else delete out.struck;
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
    // v1.2: a free run (test conditions) and whether its clock has started; a 1.1 run had always begun
    if (r.nav === 'free') out.nav = 'free'; else delete out.nav;
    out.begun = r.begun !== false;
    return out;
  }
  E.field('section', defaults, function (v) {
    if (!isObj(v)) return undefined;
    var runs = F.list(v.runs, function (x) { return isObj(x) && typeof x.id === 'string' && hasOwn.call(SIZES, x.size) && isNum(x.start) ? U.deepCopy(x) : undefined; }, MAX_RUNS) || [];
    var next = { full: F.int(v.next && v.next.full, 1, 1e6) || 1, mini: F.int(v.next && v.next.mini, 1, 1e6) || 1 };
    return { runs: runs, next: next, live: fixLive(v.live), last: fixLast(v.last) }; // last: v1.2, absent before (null)
  });

  E.section = {
    PARTS: PARTS, SIZES: SIZES, PACE_MS: PACE_MS, BAND: BAND, MODE: MODE, config: config,
    parts: parts, shape: shape, nextForm: nextForm, formItems: formItems, fmtMinutes: fmtMinutes,
    start: start, current: current, go: go, item: itemAt, visit: visit, flag: flag, answer: answer, breakPart: breakPart,
    partInfo: partInfo, endPart: endPart, finish: finish, review: review, ERR_RUN: ERR_RUN,
    save: save, live: live, drop: drop, fixLive: fixLive, defaults: defaults,
    numberOf: numberOf, numberCount: numberCount, last: last, lastResult: lastResult, lastOpen: lastOpen, fixLast: fixLast, tally: tally,
    begin: begin, step: step, strike: strike, list: list, STRIKE_MAX: STRIKE_MAX, SET_MAX: SET_MAX,
  };
})(window.PX);
