/* PX.core.store: the learner record (ARCHITECTURE.md §8). Every storage access in the
   app goes through here.

   Record: one key 'parallax.v1' in localStorage, shape as in §8, plus two fields §8 needs
   but does not name:
     idx: { ex: [exId], mode: [modeName] }  stable lookup tables for the exIndex and
       modeIndex columns of trial rows (append-only, so old rows keep their meaning when
       exercises are added); use exIndex(id) / modeIndex(name) to get an index.
     trialDays: { 'YYYY-MM-DD': { n, right, wrong, stutter, skipped, rtSum, rtN,
       ex: { <exId>: { n, right } } } }  per-day summaries of trials folded out by the cap.

   Use:  var S = PX.core.store.state;  S.practiceMs += 5;  PX.core.store.save();
   The record is read lazily on first use (after every script has loaded), and later
   reloads replace its contents in place, so references to `state` stay valid (references
   to its sub-objects do not: read them through state when you need them).

   Schema guard: guard(raw) never throws and always returns a valid record. Broken fields
   are replaced by their defaults; unknown top-level fields and unknown settings are
   dropped. Open containers keep any JSON data: streak, ui, ex[id].best, daily results,
   session summaries, and extra keys inside ex[id] (engine-owned). New top-level fields
   and settings must be registered at script load with field() / setting(); never read
   `state` at script load.

   Saving: save() is debounced (1 s, at most 5 s after the first request). hold() /
   release() bracket stimulus phases: nothing is written while held; a save requested
   then runs at release(). Pending changes are also written when the page is hidden or
   closed, even while held.

   Two tabs: every write increments `rev`. A `storage` event carrying a higher rev
   replaces the record here (deferred to release() while held) and emits store:reload.
   A save never overwrites a stored record with a higher rev: unless a merge hook is set
   (store.merge = fn(theirs, mine) → record), the newer record is loaded instead and
   store:reload { reason: 'conflict', discarded: true } is emitted.

   No storage (sandboxed iframe: accessing localStorage throws SecurityError; disabled
   storage; a record from a newer version): the app runs from memory; store.volatile is
   true and store:volatile { volatile: true, reason, message } is emitted. The UI shows
   `message` (check store.volatile at boot: the event may fire before anyone listens).
   Failed writes (quota) set the same flag until a write succeeds again.

   Events (PX.bus): store:volatile, store:reload { reason: tab|conflict|merge|import|undo|reset,
   discarded }, store:saved { rev }, store:error { reason, error }. */
(function (PX) {
  'use strict';

  var win = window;
  var U = PX.util;
  var bus = PX.bus;
  var hasOwn = Object.prototype.hasOwnProperty;

  var KEY = 'parallax.v1';
  // Record format. 2 (Parallax 1.1): trial columns 11-12 (display class, input), session
  // display/viewport/input/ended, json settings. A v1 record loads unchanged and is written back
  // as v2; a Parallax 1.0 tab that meets a v2 record runs from memory instead of overwriting it.
  var VERSION = 2;
  var TRIAL_CAP = 20000;
  var DEBOUNCE_MS = 1000;
  var MAX_WAIT_MS = 5000;
  var MESSAGE = "Progress can't be saved in this view; download the file or open it from disk.";
  var OUTCOMES = ['wrong', 'right', 'stutter', 'skipped']; // trial outcome codes 0..3
  // Trial columns 11 and 12 (indexes 10, 11): the display class and the input of the answer.
  var DISPLAYS = ['', 'small', 'large'];                  // 0 unknown (matches est.displayClass)
  var INPUTS = ['', 'mouse', 'touch', 'pen', 'key'];      // 0 unknown
  // The one trial CSV (Settings, the Log and the Lab's research export all write it); js/ui/log.js
  // registers store.csv to fill the session column.
  var CSV_HEADER = ['time_iso', 't_sec', 'exercise', 'version', 'mode', 'session', 'params_code', 'params', 'seed',
    'outcome', 'outcome_label', 'rt_ms', 'value', 'p_pred', 'stage', 'display', 'input'];

  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var ID_RE = /^[a-z][a-z0-9-]{0,39}$/;          // exercise ids (same rule as the registry)
  var NAME_RE = /^[A-Za-z0-9_.:-]{1,64}$/;        // achievement, probe, mode and protocol names
  var EXKEY_RE = /^[a-z][a-z0-9-]{0,39}(@\d{1,4})?$/; // idx.ex entries: 'rotate' or 'rotate@1' (PX.ex.key)
  var DAYEX_RE = /^([a-z][a-z0-9-]{0,39}(@\d{1,4})?|#\d{1,6})$/; // trialDays ex keys ('#3' = unknown index)
  var MAX_INT = 9007199254740991;

  /* ---------- small checks; each returns the (repaired) value or undefined ---------- */

  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function clampN(x, lo, hi) {
    if (lo !== undefined && x < lo) return lo;
    if (hi !== undefined && x > hi) return hi;
    return x;
  }
  function isIntIn(x, lo, hi) { return isNum(x) && Math.floor(x) === x && x >= lo && x <= hi; }
  function badKey(k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; }
  function plain(x) { return U.isPlainObject(x); }
  function note(log, path) { if (log && log.length < 200) log.push(path); }

  function cNum(lo, hi) { return function (v) { return isNum(v) ? clampN(v, lo, hi) : undefined; }; }
  function cInt(lo, hi) { return function (v) { return isNum(v) ? clampN(Math.round(v), lo, hi) : undefined; }; }
  function cStr(max) { return function (v) { return typeof v === 'string' && v.length <= max ? v : undefined; }; }
  function cBool(v) { return typeof v === 'boolean' ? v : undefined; }
  function cNullable(check) { return function (v) { return v === null ? null : check(v); }; }
  // Timestamps are ms since 1970 within the Date range; ISO strings are converted.
  function cTime(v) {
    if (isNum(v)) return v >= 0 && v <= 8.64e15 ? v : undefined;
    if (typeof v === 'string' && v.length <= 40) {
      var t = Date.parse(v);
      return isFinite(t) && t >= 0 ? t : undefined;
    }
    return undefined;
  }
  // Dates stored as strings ('YYYY-MM-DD' or ISO); numbers (ms) become ISO strings.
  function cDate(v) {
    if (typeof v === 'string' && v.length <= 40 && (DAY_RE.test(v) || isFinite(Date.parse(v)))) return v;
    if (isNum(v) && v >= 0 && v < 8.64e15) return new Date(v).toISOString();
    return undefined;
  }

  // Deep copy keeping only JSON data: drops functions and undefined, turns non-finite
  // numbers into null, breaks cycles, limits depth, skips __proto__-like keys.
  function jsonSafe(x, depth, stack) {
    if (x === null) return null;
    var t = typeof x;
    if (t === 'string' || t === 'boolean') return x;
    if (t === 'number') return isFinite(x) ? x : null;
    if (t !== 'object') return undefined;
    depth = depth || 0;
    stack = stack || [];
    if (depth > 16 || stack.indexOf(x) >= 0) return null;
    stack.push(x);
    var out, i;
    if (Array.isArray(x)) {
      out = [];
      for (i = 0; i < x.length && i < 100000; i++) {
        var v = jsonSafe(x[i], depth + 1, stack);
        out.push(v === undefined ? null : v);
      }
    } else if (Object.prototype.toString.call(x) === '[object Date]') {
      out = isFinite(x.getTime()) ? x.toISOString() : null;
    } else {
      out = {};
      var keys = Object.keys(x);
      for (i = 0; i < keys.length; i++) {
        if (badKey(keys[i])) continue;
        var w = jsonSafe(x[keys[i]], depth + 1, stack);
        if (w !== undefined) out[keys[i]] = w;
      }
    }
    stack.pop();
    return out;
  }
  function cJsonObj(v) { return plain(v) ? jsonSafe(v) : undefined; }
  function cJson(v) { return jsonSafe(v); }

  // x[key] through check(); a missing or broken value is noted and replaced by def.
  function take(x, key, check, def, log, path) {
    var v = hasOwn.call(x, key) ? x[key] : undefined;
    var r = check(v);
    if (r === undefined) {
      note(log, path + '.' + key);
      return typeof def === 'function' ? def() : def;
    }
    return r;
  }

  function fixMap(x, keyRe, fixVal, log, path) {
    var out = {};
    if (!plain(x)) return undefined;
    var keys = Object.keys(x);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], v;
      if (badKey(k) || (keyRe && !keyRe.test(k))) { note(log, path + '.' + k); continue; }
      try { v = fixVal(x[k], log, path + '.' + k); } catch (e) { v = undefined; }
      if (v === undefined) { note(log, path + '.' + k); continue; }
      out[k] = v;
    }
    return out;
  }
  function cMap(keyRe, fixVal, log, path) {
    return function (v) { return fixMap(v, keyRe, fixVal, log, path); };
  }

  function fixList(x, fixItem, log, path, max) {
    if (!Array.isArray(x)) return undefined;
    var out = [];
    var n = Math.min(x.length, max || 100000);
    for (var i = 0; i < n; i++) {
      var v;
      try { v = fixItem(x[i], log, path + '[' + i + ']'); } catch (e) { v = undefined; }
      if (v === undefined) note(log, path + '[' + i + ']');
      else out.push(v);
    }
    if (x.length > n) note(log, path + ' (truncated)');
    return out;
  }

  function obj() { return {}; }
  function arr() { return []; }
  function zero() { return 0; }
  function now() { return Date.now(); }

  /* ---------- settings ---------- */

  // type: bool | int | num | enum | token (lower-case word) | str | json. Extend with setting().
  // json: any JSON value (null allowed); spec.check(v) (or spec.fix(v)) → the repaired value or undefined.
  var SETTINGS = {
    sessionMin: { def: 20, type: 'int', min: 1, max: 120 },
    weeklyGoal: { def: 3, type: 'int', min: 2, max: 6 },
    lastBackup: { def: 0, type: 'num', min: 0, max: 1e13 }, // ms timestamp of the last export; 0 = never
    theme: { def: 'auto', type: 'enum', values: ['auto', 'light', 'dark'] },
    reducedMotion: { def: 'auto', type: 'enum', values: ['auto', 'on', 'off'] },
    sound: { def: false, type: 'bool' },
    keyHints: { def: true, type: 'bool' },
    textScale: { def: 1, type: 'num', min: 0.75, max: 2 },
  };

  function checkSetting(spec, v) {
    switch (spec.type) {
      case 'bool': return typeof v === 'boolean' ? v : undefined;
      case 'int': return isNum(v) ? clampN(Math.round(v), spec.min, spec.max) : undefined;
      case 'num': return isNum(v) ? clampN(v, spec.min, spec.max) : undefined;
      case 'enum': return spec.values.indexOf(v) >= 0 ? v : undefined;
      case 'token': return typeof v === 'string' && /^[a-z0-9-]{1,24}$/.test(v) ? v : undefined;
      case 'str': return typeof v === 'string' && v.length <= (spec.max || 200) ? v : undefined;
      case 'json':
        if (v === undefined) return undefined;
        var fixFn = typeof spec.check === 'function' ? spec.check : typeof spec.fix === 'function' ? spec.fix : null;
        if (fixFn) {
          var r;
          try { r = fixFn(v); } catch (e) { r = undefined; }
          return r === undefined ? undefined : jsonSafe(r);
        }
        return v === null || plain(v) || Array.isArray(v) ? jsonSafe(v) : undefined;
    }
    return undefined;
  }
  function settingsDefaults() {
    var out = {};
    for (var k in SETTINGS) if (hasOwn.call(SETTINGS, k)) out[k] = U.deepCopy(SETTINGS[k].def);
    return out;
  }
  function fixSettings(x, log, path) {
    if (!plain(x)) return undefined;
    var out = {};
    for (var k in SETTINGS) {
      if (!hasOwn.call(SETTINGS, k)) continue;
      var r = checkSetting(SETTINGS[k], hasOwn.call(x, k) ? x[k] : undefined);
      if (r === undefined) { note(log, path + '.' + k); r = U.deepCopy(SETTINGS[k].def); }
      out[k] = r;
    }
    for (var u in x) if (hasOwn.call(x, u) && !hasOwn.call(SETTINGS, u)) note(log, path + '.' + u + ' (unknown)');
    return out;
  }

  /* ---------- per-field repairs ---------- */

  function fixExState(x, log, path) {
    if (!plain(x)) return undefined;
    var d = api.exDefaults();
    var out = jsonSafe(x); // keeps engine-owned extra keys
    out.mu = take(x, 'mu', cNum(-50, 50), d.mu, log, path);
    out.sd = take(x, 'sd', function (v) { return isNum(v) && v > 0 ? Math.min(v, 50) : undefined; }, d.sd, log, path);
    out.n = take(x, 'n', cInt(0, MAX_INT), 0, log, path);
    out.nRight = take(x, 'nRight', cInt(0, MAX_INT), 0, log, path);
    if (out.nRight > out.n) { out.nRight = out.n; note(log, path + '.nRight'); }
    out.last = take(x, 'last', cNullable(cTime), null, log, path);
    out.seen = take(x, 'seen', cMap(null, function (v) {
      return isNum(v) && v >= 0 ? Math.round(v) : undefined;
    }, log, path + '.seen'), obj, log, path);
    out.best = take(x, 'best', cJsonObj, obj, log, path);
    out.hist = take(x, 'hist', function (v) {
      return fixList(v, function (r) {
        if (!Array.isArray(r) || r.length < 3) return undefined;
        var day = r[0];
        if (!(typeof day === 'string' ? DAY_RE.test(day) : isNum(day))) return undefined;
        if (!isNum(r[1]) || !isNum(r[2]) || r[2] < 0) return undefined;
        return [day, r[1], r[2]];
      }, log, path + '.hist', 3650);
    }, arr, log, path);
    return out;
  }

  function fixSession(x, log, path) {
    if (!plain(x)) return undefined;
    var start = cTime(x.start);
    if (start === undefined) return undefined; // a session without a start cannot be placed in time
    var out = {
      id: take(x, 'id', function (v) { return typeof v === 'string' && v && v.length <= 64 ? v : undefined; }, U.uid, log, path),
      start: start,
      end: take(x, 'end', cNullable(cTime), null, log, path),
      mode: take(x, 'mode', function (v) { return typeof v === 'string' && NAME_RE.test(v) ? v : undefined; }, 'unknown', log, path),
      trials: take(x, 'trials', cInt(0, MAX_INT), 0, log, path),
      right: take(x, 'right', cInt(0, MAX_INT), 0, log, path),
      practiceMs: take(x, 'practiceMs', cNum(0, 1e12), 0, log, path),
      exs: take(x, 'exs', function (v) {
        return Array.isArray(v) ? v.filter(function (id) { return typeof id === 'string' && ID_RE.test(id); }) : undefined;
      }, arr, log, path),
      summary: take(x, 'summary', cJson, null, log, path),
    };
    if (out.right > out.trials) { out.right = out.trials; note(log, path + '.right'); }
    // Optional (v1.1): the screen class, viewport and main input of the session, and how it ended.
    if (x.display === 'small' || x.display === 'large') out.display = x.display;
    if (typeof x.viewport === 'string' && /^\d{2,5}x\d{2,5}$/.test(x.viewport)) out.viewport = x.viewport;
    if (typeof x.input === 'string' && /^[a-z]{1,12}$/.test(x.input)) out.input = x.input;
    if (x.ended === 'complete' || x.ended === 'early' || x.ended === 'closed') out.ended = x.ended;
    if (isNum(x.budgetMs) && x.budgetMs > 0 && x.budgetMs < 1e9) out.budgetMs = Math.round(x.budgetMs);
    return out;
  }

  // Trial row: [tSec, exIndex, modeIndex, paramsCode, seed, outcome, rtMs, value, pPredMilli?, stage?,
  // display?, input?] (the engine adds the predicted success × 1000 and the interleaving stage; the
  // player the display class 0-2 and the input 0-4 of DISPLAYS / INPUTS; all optional).
  function fixTrial(r) {
    if (!Array.isArray(r) || r.length < 7) return undefined;
    if (!isNum(r[0]) || r[0] < 0 || r[0] > 8.64e12) return undefined; // seconds within the Date range
    if (!isIntIn(r[1], 0, 99999) || !isIntIn(r[2], 0, 99999) || !isIntIn(r[3], 0, MAX_INT) ||
      !isIntIn(r[4], 0, 4294967295) || !isIntIn(r[5], 0, 3)) return undefined;
    var rt = isNum(r[6]) && r[6] >= 0 ? r[6] : null;
    var value = r.length > 7 && isNum(r[7]) ? r[7] : null;
    var row = [r[0], r[1], r[2], r[3], r[4], r[5], rt, value];
    if (r.length > 8) {
      row.push(isIntIn(r[8], 0, 1000) ? r[8] : null);
      if (r.length > 9) row.push(isIntIn(r[9], 0, 99) ? r[9] : null);
      if (r.length > 10) row.push(isIntIn(r[10], 0, DISPLAYS.length - 1) ? r[10] : null);
      if (r.length > 11) row.push(isIntIn(r[11], 0, INPUTS.length - 1) ? r[11] : null);
    }
    return row;
  }
  function fixTrials(x, log, path) {
    var out = fixList(x, fixTrial, log, path, 1000000);
    if (!out) return undefined;
    for (var i = 1; i < out.length; i++) {
      if (out[i][0] < out[i - 1][0]) { // out of order (imported or clock change): stable sort
        out.sort(function (a, b) { return a[0] - b[0]; });
        note(log, path + ' (sorted)');
        break;
      }
    }
    return out;
  }

  function fixProbe(x) {
    if (!plain(x)) return undefined;
    var n = isNum(x.n) && x.n >= 0 ? Math.round(x.n) : undefined;
    var right = isNum(x.right) && x.right >= 0 ? Math.round(x.right) : undefined;
    if (n === undefined || right === undefined) return undefined;
    var out = jsonSafe(x); // keeps engine-owned extras (e.g. rtMed, the median time on right answers)
    out.right = Math.min(right, n); out.n = n;
    out.theta = isNum(x.theta) ? x.theta : null;
    out.se = isNum(x.se) && x.se >= 0 ? x.se : null;
    if (hasOwn.call(x, 'rtMed')) out.rtMed = isNum(x.rtMed) && x.rtMed >= 0 ? x.rtMed : null;
    return out;
  }
  function fixAssess(x, log, path) {
    if (!plain(x)) return undefined;
    var date = cDate(x.date);
    if (date === undefined) return undefined;
    var out = jsonSafe(x); // keeps engine-owned extras (kind: baseline | regular | delayed, …)
    out.date = date;
    out.form = take(x, 'form', function (v) {
      return (typeof v === 'string' && v.length <= 40) || isNum(v) ? v : v === null ? null : undefined;
    }, null, log, path);
    out.results = take(x, 'results', cMap(NAME_RE, fixProbe, log, path + '.results'), obj, log, path);
    if (hasOwn.call(x, 'kind')) out.kind = typeof x.kind === 'string' && NAME_RE.test(x.kind) ? x.kind : null;
    return out;
  }

  function fixMot(x, log, path) {
    var out = fixMap(x, NAME_RE, function (list, l2, p2) {
      return fixList(list, function (e) {
        if (!plain(e)) return undefined;
        var date = cDate(e.date);
        if (date === undefined || !isNum(e.threshold)) return undefined;
        var o = jsonSafe(e);
        o.date = date;
        o.threshold = e.threshold;
        return o;
      }, l2, p2, 5000);
    }, log, path);
    if (out && !out.core) { out.core = []; note(log, path + '.core'); }
    return out;
  }

  function fixTour(x, log, path) {
    if (!plain(x)) return undefined;
    return {
      done: take(x, 'done', cBool, false, log, path),
      seen: take(x, 'seen', cMap(ID_RE, function (v) { return v === true ? true : undefined; }, log, path + '.seen'), obj, log, path),
    };
  }

  function fixUi(x, log, path) {
    if (!plain(x)) return undefined;
    var out = jsonSafe(x);
    out.lastRoute = take(x, 'lastRoute', cNullable(cStr(200)), null, log, path);
    return out;
  }

  // Positions matter (trial rows point into these lists), so a broken or duplicate entry
  // becomes null instead of being removed.
  function fixIdx(x, log, path) {
    if (!plain(x)) return undefined;
    function list(v, re, p) {
      if (!Array.isArray(v)) { note(log, p); return []; }
      var seen = {}, out = [];
      for (var i = 0; i < v.length && i < 100000; i++) {
        var s = v[i];
        if (typeof s === 'string' && re.test(s) && !hasOwn.call(seen, s)) { seen[s] = 1; out.push(s); }
        else { if (s !== null) note(log, p + '[' + i + ']'); out.push(null); }
      }
      return out;
    }
    return { ex: list(x.ex, EXKEY_RE, path + '.ex'), mode: list(x.mode, NAME_RE, path + '.mode') };
  }

  function dayDefaults() { return { n: 0, right: 0, wrong: 0, stutter: 0, skipped: 0, rtSum: 0, rtN: 0, ex: {} }; }
  function fixDay(x, log, path) {
    if (!plain(x)) return undefined;
    var c = cInt(0, MAX_INT);
    return {
      n: take(x, 'n', c, 0, log, path),
      right: take(x, 'right', c, 0, log, path),
      wrong: take(x, 'wrong', c, 0, log, path),
      stutter: take(x, 'stutter', c, 0, log, path),
      skipped: take(x, 'skipped', c, 0, log, path),
      rtSum: take(x, 'rtSum', cNum(0), 0, log, path),
      rtN: take(x, 'rtN', c, 0, log, path),
      ex: take(x, 'ex', cMap(DAYEX_RE, function (v) {
        if (!plain(v) || !isNum(v.n) || !isNum(v.right)) return undefined;
        var n = Math.max(0, Math.round(v.n));
        return { n: n, right: clampN(Math.round(v.right), 0, n) };
      }, log, path + '.ex'), obj, log, path),
    };
  }

  /* ---------- module state ---------- */

  var ls = null;          // window.localStorage when usable
  var memoryOnly = false; // storage unusable for this page: run from memory
  var failing = false;    // the last write failed (quota or similar)
  var volatileReason = null;
  var state = {};         // the live record; contents replaced in place
  var loaded = false;
  var dirty = false;      // changes not yet written
  var holds = 0;
  var timer = null, firstRequest = 0;
  var pendingExternal = null; // text of a newer record from another tab, applied at release()
  var undoSlot = null;
  var corrupt = null;     // unreadable text found in storage
  // Unknown top-level fields and settings seen by the last load(), so that a field() or
  // setting() registered after an early load still picks up its stored value.
  var unknown = { top: {}, settings: {} };

  /* ---------- the field table (order = key order in the saved JSON; v and rev first) ---------- */

  var FIELDS = [];
  // fix(value, log, path) returns the repaired value, or undefined to use def().
  function field(key, def, fix) {
    if (typeof key !== 'string' || badKey(key) || typeof def !== 'function') {
      throw new Error('PX.core.store.field: needs a key and a default function');
    }
    for (var i = 0; i < FIELDS.length; i++) {
      if (FIELDS[i].key === key) throw new Error('PX.core.store.field: "' + key + '" is already defined');
    }
    var f = { key: key, def: def, fix: fix || cJson };
    FIELDS.push(f);
    if (loaded && !hasOwn.call(state, key)) {
      var v;
      try { v = hasOwn.call(unknown.top, key) ? f.fix(unknown.top[key], [], key) : undefined; } catch (e) { v = undefined; }
      state[key] = v === undefined ? def() : v;
    }
  }

  // Older formats (1) are upgraded silently: every v2 field is optional or has a default.
  field('v', function () { return VERSION; }, function (x) { return isIntIn(x, 1, VERSION) ? VERSION : undefined; });
  // Bounded so that rev + 1 stays exact and the JSON keeps plain digits (no exponent).
  field('rev', zero, function (x) { return isNum(x) && x >= 0 && x <= 1e15 ? Math.floor(x) : undefined; });
  field('created', now, cTime);
  field('updated', now, cTime);
  field('settings', settingsDefaults, fixSettings);
  field('ex', obj, function (x, log, p) { return fixMap(x, ID_RE, fixExState, log, p); });
  field('mot', function () { return { core: [] }; }, fixMot);
  field('sessions', arr, function (x, log, p) { return fixList(x, fixSession, log, p, 100000); });
  field('trials', arr, fixTrials);
  field('practiceMs', zero, function (x) { return isNum(x) && x >= 0 ? x : undefined; });
  field('achievements', obj, function (x, log, p) {
    return fixMap(x, NAME_RE, function (v) { return cDate(v); }, log, p);
  });
  field('streak', obj, cJsonObj);
  field('daily', obj, function (x, log, p) { return fixMap(x, DAY_RE, cJson, log, p); });
  field('assess', arr, function (x, log, p) { return fixList(x, fixAssess, log, p, 10000); });
  field('tour', function () { return { done: false, seen: {} }; }, fixTour);
  field('ui', function () { return { lastRoute: null }; }, fixUi);
  field('idx', function () { return { ex: [], mode: [] }; }, fixIdx);
  field('trialDays', obj, function (x, log, p) { return fixMap(x, DAY_RE, fixDay, log, p); });

  function defaults() {
    var out = {};
    for (var i = 0; i < FIELDS.length; i++) out[FIELDS[i].key] = FIELDS[i].def();
    return out;
  }

  // Never throws; always returns a valid record. log (optional array) collects repaired
  // paths; extras (optional { top, settings }) receives the unknown fields and settings.
  function guard(raw, log, extras) {
    log = log || [];
    try {
      if (!plain(raw)) { note(log, '(record)'); raw = {}; }
      var out = {}, known = {};
      for (var i = 0; i < FIELDS.length; i++) {
        var f = FIELDS[i], v;
        known[f.key] = 1;
        try { v = hasOwn.call(raw, f.key) ? f.fix(raw[f.key], log, f.key) : undefined; } catch (e) { v = undefined; }
        if (v === undefined) { note(log, f.key); v = f.def(); }
        out[f.key] = v;
      }
      var keys = Object.keys(raw);
      for (var j = 0; j < keys.length; j++) {
        if (hasOwn.call(known, keys[j]) || badKey(keys[j])) continue;
        note(log, keys[j] + ' (unknown)');
        if (extras) extras.top[keys[j]] = raw[keys[j]];
      }
      if (extras && plain(raw.settings)) {
        for (var s in raw.settings) {
          if (hasOwn.call(raw.settings, s) && !hasOwn.call(SETTINGS, s) && !badKey(s)) extras.settings[s] = raw.settings[s];
        }
      }
      if (capTrials(out, TRIAL_CAP)) note(log, 'trials (capped)');
      return out;
    } catch (e) {
      note(log, '(record: ' + (e && e.message) + ')');
      return defaults();
    }
  }

  /* ---------- trial cap ---------- */

  // Folds the oldest rows beyond `cap` into rec.trialDays. Returns how many were folded.
  function capTrials(rec, cap) {
    var extra = rec.trials.length - cap;
    if (extra <= 0) return 0;
    var old = rec.trials.splice(0, extra);
    for (var i = 0; i < old.length; i++) {
      var r = old[i], o = r[5];
      var day = U.dayKey(r[0] * 1000);
      var d = rec.trialDays[day] || (rec.trialDays[day] = dayDefaults());
      d.n++;
      if (o === 1) d.right++;
      else if (o === 0) d.wrong++;
      else if (o === 2) d.stutter++;
      else d.skipped++;
      if ((o === 0 || o === 1) && r[6] !== null) { d.rtSum += r[6]; d.rtN++; }
      var id = rec.idx.ex[r[1]] || ('#' + r[1]);
      var e = d.ex[id] || (d.ex[id] = { n: 0, right: 0 });
      e.n++;
      if (o === 1) e.right++;
    }
    return extra;
  }

  /* ---------- backend ---------- */

  function emitVolatile() {
    bus.emit('store:volatile', { volatile: memoryOnly || failing, reason: volatileReason, message: MESSAGE });
  }
  function goMemory(reason) {
    if (memoryOnly) return;
    memoryOnly = true;
    volatileReason = reason;
    emitVolatile();
  }

  function probe() {
    try {
      var s = win.localStorage; // throws SecurityError in sandboxed iframes
      if (!s) return null;
      var k = KEY + ':probe';
      s.setItem(k, '1');
      s.removeItem(k);
      return s;
    } catch (e) {
      return null;
    }
  }

  function readRaw() {
    if (memoryOnly) return null;
    try { return ls.getItem(KEY); } catch (e) { goMemory('read-failed'); return null; }
  }

  function parseJSON(text) {
    try { return { ok: true, value: JSON.parse(text) }; } catch (e) { return { ok: false }; }
  }

  // The saved JSON starts with {"v":1,"rev":N, so version and rev can be read without a
  // full parse; other texts fall back to parsing. Unreadable text gives -1 for both.
  function head(text) {
    if (typeof text !== 'string') return { v: -1, rev: -1 };
    var m = /^\{"v":(\d+),"rev":(\d+)[,}]/.exec(text.slice(0, 80));
    if (m) return { v: +m[1], rev: +m[2] };
    var p = parseJSON(text), o = p.ok && plain(p.value) ? p.value : null;
    return { v: o && isNum(o.v) ? o.v : -1, rev: o && isNum(o.rev) ? o.rev : -1 };
  }
  function revOf(text) { return head(text).rev; }
  function storedRev() { return memoryOnly ? -1 : revOf(readRaw()); }

  function replaceState(rec) {
    var k;
    for (k in state) if (hasOwn.call(state, k)) delete state[k];
    for (k in rec) if (hasOwn.call(rec, k)) state[k] = rec[k];
  }

  function cancelTimer() {
    if (timer !== null) { win.clearTimeout(timer); timer = null; }
    firstRequest = 0;
  }

  /* ---------- load and save ---------- */

  function load() {
    loaded = true;
    cancelTimer();
    dirty = false;
    pendingExternal = null;
    unknown = { top: {}, settings: {} };
    var raw = readRaw(), rec;
    if (raw === null || raw === undefined) {
      rec = defaults();
    } else {
      var p = parseJSON(raw);
      if (!p.ok) {
        corrupt = raw;
        // Keep a copy under a second key before the next save overwrites the main one.
        try { ls.setItem(KEY + '.corrupt', raw); } catch (e) { /* full or blocked: the copy in memory remains */ }
        bus.emit('store:error', { reason: 'corrupt', error: 'The saved progress could not be read; starting fresh.' });
        rec = defaults();
      } else {
        // A record from a newer version is never overwritten by this one.
        if (p.value && isNum(p.value.v) && p.value.v > VERSION) goMemory('newer-version');
        rec = guard(p.value, null, unknown);
      }
    }
    replaceState(rec);
    return state;
  }

  function ensure() {
    if (!loaded) load();
    return state;
  }

  function write() {
    dirty = false;
    if (memoryOnly) return true; // nowhere to write; state lives in memory
    var stored = readRaw();
    if (memoryOnly) return true;
    var hd = head(stored);
    // Another tab runs a newer Parallax: never overwrite its record.
    if (hd.v > VERSION) { goMemory('newer-version'); return true; }
    if (hd.rev > state.rev) {
      var p = parseJSON(stored);
      if (p.ok && plain(p.value)) return conflict(guard(p.value));
      state.rev = hd.rev; // unreadable newer text: ours is the valid record
    }
    var prevRev = state.rev, prevUpdated = state.updated;
    state.rev = prevRev + 1;
    state.updated = Date.now();
    var text;
    try {
      text = JSON.stringify(state);
      ls.setItem(KEY, text);
    } catch (e) {
      state.rev = prevRev;
      state.updated = prevUpdated;
      dirty = true;
      bus.emit('store:error', { reason: 'write-failed', error: String(e && (e.name || e.message) || e) });
      if (!failing) { failing = true; volatileReason = 'write-failed'; emitVolatile(); }
      return false;
    }
    if (failing) { failing = false; volatileReason = null; emitVolatile(); }
    bus.emit('store:saved', { rev: state.rev });
    return true;
  }

  // A stored record with a higher rev exists and we have changes.
  function conflict(theirs) {
    if (typeof api.merge === 'function') {
      var merged = null, mine = U.deepCopy(state);
      // The side with unsaved changes is the newer one: its settings and other last-writer fields
      // win (updated is otherwise set only at a write, so mine would always count as older).
      mine.updated = Math.max(Date.now(), isNum(theirs.updated) ? theirs.updated + 1 : 0);
      try { merged = guard(api.merge(theirs, mine)); } catch (e) { merged = null; }
      if (merged) {
        merged.rev = theirs.rev;
        replaceState(merged);
        bus.emit('store:reload', { reason: 'merge', discarded: false });
        return write();
      }
    }
    replaceState(theirs);
    cancelTimer();
    dirty = false; // our unsaved changes are gone; theirs is already stored
    bus.emit('store:reload', { reason: 'conflict', discarded: true });
    return false;
  }

  // Requests a debounced save.
  function save() {
    ensure();
    dirty = true;
    var t = Date.now();
    if (!firstRequest) firstRequest = t;
    if (timer !== null) win.clearTimeout(timer);
    var wait = Math.max(0, Math.min(DEBOUNCE_MS, firstRequest + MAX_WAIT_MS - t));
    timer = win.setTimeout(function () {
      timer = null;
      if (holds === 0) flush(); // while held, release() writes
    }, wait);
  }

  // Writes pending changes now. While held it waits for release(), unless opts.evenIfHeld.
  // Returns true when the record was written.
  function flush(opts) {
    if (!loaded || !dirty) return false;
    if (holds > 0 && !(opts && opts.evenIfHeld)) return false;
    cancelTimer();
    return write();
  }

  function hold() { holds++; }
  function release() {
    if (holds > 0) holds--;
    if (holds > 0) return;
    if (pendingExternal !== null) {
      var text = pendingExternal;
      pendingExternal = null;
      var rec = parseExternal(text);
      if (rec && rec.rev > state.rev) adoptExternal(rec);
    }
    if (dirty) flush();
  }
  function isHeld() { return holds > 0; }

  function adoptExternal(rec) {
    if (dirty) { conflict(rec); return; }
    replaceState(rec);
    cancelTimer();
    bus.emit('store:reload', { reason: 'tab', discarded: false });
  }

  function parseExternal(text) {
    var p = parseJSON(text);
    return p.ok && plain(p.value) ? guard(p.value) : null;
  }

  // Another tab wrote the record.
  function onStorage(e) {
    if (!e || e.key !== KEY || typeof e.newValue !== 'string' || memoryOnly || !loaded) return;
    var hd = head(e.newValue); // cheap: reads only the first bytes
    if (hd.v > VERSION) { goMemory('newer-version'); return; }
    if (hd.rev <= state.rev) return;
    // During a stimulus phase keep only the text: parsing and repairing a large record is
    // real work, and swapping the record mid-trial is never safe. release() applies it.
    if (holds > 0) { pendingExternal = e.newValue; return; }
    var rec = parseExternal(e.newValue);
    if (rec) adoptExternal(rec);
  }

  /* ---------- import, export, undo, reset ---------- */

  function exportJSON() { return JSON.stringify(ensure()); }

  // Replaces the record after validation. Returns { ok, error?, repairs? }.
  function importJSON(text) {
    var s = ensure();
    if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty.' };
    var p = parseJSON(text.replace(/^﻿/, ''));
    if (!p.ok) return { ok: false, error: 'This is not a Parallax progress file (it is not valid JSON).' };
    var raw = p.value;
    if (!plain(raw) || !isNum(raw.v) || raw.v < 1) return { ok: false, error: 'This is not a Parallax progress file.' };
    if (raw.v > VERSION) return { ok: false, error: 'This file was made by a newer version of Parallax.' };
    var log = [];
    var rec = guard(raw, log);
    undoSlot = U.deepCopy(s);
    rec.rev = Math.max(s.rev, storedRev(), rec.rev); // the import wins over every tab
    replaceState(rec);
    dirty = true;
    flush();
    bus.emit('store:reload', { reason: 'import', discarded: false });
    return { ok: true, repairs: log };
  }

  function canUndo() { return !!undoSlot; }

  // Restores the record from before the last import or reset (one step).
  function undo() {
    if (!undoSlot) return false;
    var s = ensure(), prev = undoSlot;
    undoSlot = null;
    prev.rev = Math.max(s.rev, storedRev(), prev.rev);
    replaceState(prev);
    dirty = true;
    flush();
    bus.emit('store:reload', { reason: 'undo', discarded: false });
    return true;
  }

  // Fresh record (undoable once). opts.keepSettings keeps the settings.
  function reset(opts) {
    var s = ensure();
    undoSlot = U.deepCopy(s);
    var rec = defaults();
    if (opts && opts.keepSettings) rec.settings = U.deepCopy(s.settings);
    rec.rev = Math.max(s.rev, storedRev());
    replaceState(rec);
    dirty = true;
    flush();
    bus.emit('store:reload', { reason: 'reset', discarded: false });
  }

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    // A text cell that a spreadsheet would run as a formula (an imported record can hold any
    // string) gets a leading apostrophe; numbers stay numbers.
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // 'angle=60;axis=depth;variant=pick1' through the registry, when it knows the exercise.
  function paramsText(exId, code) {
    var reg = PX.ex;
    if (!exId || !reg || typeof reg.get !== 'function' || typeof reg.decodeParams !== 'function') return '';
    try {
      // idx.ex entries are 'rotate@1' (PX.ex.key); decode only with the same definition version.
      var at = String(exId).indexOf('@');
      var def = reg.get(at < 0 ? exId : String(exId).slice(0, at));
      if (!def) return '';
      if (at >= 0 && String(def.version || 1) !== String(exId).slice(at + 1)) return '';
      var p = reg.decodeParams(def, code), parts = [];
      for (var i = 0; i < def.dims.length; i++) {
        var dim = def.dims[i], lv = dim.levels[p[dim.key]];
        parts.push(dim.key + '=' + (lv !== null && typeof lv === 'object' ? JSON.stringify(lv) : String(lv)));
      }
      if (p.variant !== undefined) parts.push('variant=' + p.variant);
      return parts.join(';');
    } catch (e) {
      return '';
    }
  }

  // Trials as CSV (RFC 4180, CRLF): a header row and one row per kept trial, in the one format of
  // CSV_HEADER. js/ui/log.js registers store.csv(state) → text, which also fills the session
  // column; without it (tests, a build without the Log) the session column stays empty.
  function exportCSV() {
    var s = ensure();
    if (typeof api.csv === 'function') {
      try { var text = api.csv(s); if (typeof text === 'string') return text; } catch (e) { /* the plain export below */ }
    }
    var lines = [CSV_HEADER.join(',')];
    for (var i = 0; i < s.trials.length; i++) {
      var r = s.trials[i];
      var name = s.idx.ex[r[1]] || '', mode = s.idx.mode[r[2]] || '';
      var at = name.indexOf('@'), exId = at < 0 ? name : name.slice(0, at), ver = at < 0 ? 1 : +name.slice(at + 1);
      var d = new Date(r[0] * 1000);
      lines.push([
        isFinite(d.getTime()) ? d.toISOString() : '', r[0], exId, name ? ver : '', mode, '', r[3], paramsText(name, r[3]),
        r[4], r[5], OUTCOMES[r[5]], r[6], r[7], isNum(r[8]) ? Math.round(r[8]) / 1000 : null, r[9],
        DISPLAYS[r[10]] || '', INPUTS[r[11]] || '',
      ].map(csvCell).join(','));
    }
    return lines.join('\r\n') + '\r\n';
  }

  /* ---------- helpers for writers of the record ---------- */

  function lookup(list, name, re, what) {
    // Validate first: repaired lists may hold null slots that indexOf(null) would find.
    if (typeof name !== 'string' || !re.test(name)) throw new TypeError('PX.core.store: invalid ' + what + ' "' + name + '"');
    var i = list.indexOf(name);
    return i >= 0 ? i : list.push(name) - 1;
  }
  function exIndex(id) { return lookup(ensure().idx.ex, id, EXKEY_RE, 'exercise id'); }
  function modeIndex(name) { return lookup(ensure().idx.mode, name, NAME_RE, 'mode name'); }
  function exId(i) { return ensure().idx.ex[i] || null; }
  function modeName(i) { return ensure().idx.mode[i] || null; }

  // The exercise's record entry, created from exDefaults() when missing.
  function exState(id) {
    var s = ensure();
    if (!ID_RE.test(id)) throw new TypeError('PX.core.store.exState: invalid exercise id "' + id + '"');
    return s.ex[id] || (s.ex[id] = api.exDefaults());
  }

  // The codes of trial columns 11-12 from a name or a code (unknown: 0).
  function displayCode(v) { var i = typeof v === 'number' ? v : DISPLAYS.indexOf(v); return isIntIn(i, 1, DISPLAYS.length - 1) ? i : 0; }
  function inputCode(v) {
    if (typeof v === 'number') return isIntIn(v, 1, INPUTS.length - 1) ? v : 0;
    if (v === 'pointer') return 1; // a click without a known pointer type
    var i = INPUTS.indexOf(v);
    return i > 0 ? i : 0;
  }

  // Appends a trial. Accepts a row [tSec, exIndex, modeIndex, paramsCode, seed, outcome,
  // rtMs, value, …] or { t (ms, default now), ex (id), mode (name), code, seed, outcome, rt, value,
  // p (predicted success 0-1), stage, display ('small' | 'large'), input ('mouse' | 'touch' | 'pen' |
  // 'key') }. Returns false (and stores nothing) for an invalid row; an invalid ex id or mode name
  // throws. Does not save: call save() when the trial is logged.
  function addTrial(t) {
    var s = ensure(), row = t;
    if (plain(t)) {
      row = [
        Math.floor((isNum(t.t) ? t.t : Date.now()) / 1000), exIndex(t.ex), modeIndex(t.mode || 'free'),
        t.code, t.seed, t.outcome, isNum(t.rt) ? Math.round(t.rt) : null, isNum(t.value) ? t.value : null,
      ];
      if (t.p !== undefined || t.stage !== undefined || t.display !== undefined || t.input !== undefined) {
        row.push(isNum(t.p) ? Math.round(clampN(t.p, 0, 1) * 1000) : null, isIntIn(t.stage, 0, 99) ? t.stage : null,
          displayCode(t.display), inputCode(t.input));
      }
    }
    var r = fixTrial(row);
    if (!r) return false;
    s.trials.push(r);
    capTrials(s, TRIAL_CAP);
    return true;
  }

  function setting(key, spec) {
    if (!spec || !spec.type || checkSetting(spec, spec.def) === undefined) {
      throw new Error('PX.core.store.setting("' + key + '"): needs { def, type } with a valid def');
    }
    SETTINGS[key] = spec;
    if (loaded && state.settings && !hasOwn.call(state.settings, key)) {
      var v = hasOwn.call(unknown.settings, key) ? checkSetting(spec, unknown.settings[key]) : undefined;
      state.settings[key] = v === undefined ? U.deepCopy(spec.def) : v;
    }
  }

  /* ---------- wiring ---------- */

  var api = {
    KEY: KEY, VERSION: VERSION, TRIAL_CAP: TRIAL_CAP, OUTCOMES: OUTCOMES, MESSAGE: MESSAGE,
    DISPLAYS: DISPLAYS, INPUTS: INPUTS, CSV_HEADER: CSV_HEADER, csvCell: csvCell,
    get state() { return ensure(); },
    get volatile() { ensure(); return memoryOnly || failing; },
    get volatileReason() { ensure(); return volatileReason; },
    get corrupt() { return corrupt; },
    defaults: defaults,
    // The engine may replace this with its prior; used for new and repaired ex entries.
    exDefaults: function () {
      return { mu: 0, sd: 2, n: 0, nRight: 0, last: null, seen: {}, best: {}, hist: [] };
    },
    guard: guard, load: load, save: save, flush: flush,
    hold: hold, release: release, isHeld: isHeld,
    exportJSON: exportJSON, importJSON: importJSON, canUndo: canUndo, undo: undo,
    exportCSV: exportCSV, reset: reset,
    exIndex: exIndex, modeIndex: modeIndex, exId: exId, modeName: modeName,
    exState: exState, addTrial: addTrial, capTrials: capTrials, displayCode: displayCode, inputCode: inputCode,
    field: field, setting: setting, settingsSpec: SETTINGS,
    merge: null, // optional fn(theirs, mine) → record, used when a save meets a newer rev
    csv: null,   // optional fn(state) → the trial CSV (js/ui/log.js), used by exportCSV()
  };

  ls = probe();
  if (!ls) goMemory('unavailable');

  if (win.addEventListener) {
    win.addEventListener('storage', onStorage);
    win.addEventListener('pagehide', function () { flush({ evenIfHeld: true }); });
  }
  var doc = win.document;
  if (doc && doc.addEventListener) {
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) flush({ evenIfHeld: true }); });
  }

  PX.core.store = api;
})(window.PX);
