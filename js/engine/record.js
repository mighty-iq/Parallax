/* PX.engine.record: the wave-2 containers of record format 4 (v1.2; docs/dev/CONTRACT-v1.2.md M).
   Pure. Registers, with open repairs, the pooled-export rules and two-tab merges the contract gives:
     plateau  { v: 1, list: [plateau events] }       W2-plateau (events: CONTRACT P)
     bets     { v: 1, … }                           W2-bets (it registers its own merge)
     measure  { v: 1, form0: null | 'A' | 'B' | 'C', … }  W2-measure (it registers its own merge)
     game     { v: 1, reach: { high }, grades, records, firsts, atlas, climb, notes }  milestone 5,
              reserved now so the record migrates once; left out of the pooled export until milestone 5
              gives it a rule (the Climb's weeks and field notes are local weeks)
   (the events table registers itself: js/engine/events.js). The upgrade hook for records of format
   1–3 runs through the store (load, import, another tab's record):
     (a) measure.form0 becomes 'A' when the record holds a check (its baselines were form A);
     (b) each rec.assess entry without `pv` gets the probe versions of format 3 (P3: all 1).
   Nothing else converts: new fields take their defaults; trial rows of formats 1–3 stay valid.

     check(key, fn(value) → repaired | undefined)  an owner's stricter repair of its container, run
                     inside the open one; it must never throw and keeps keys it does not own
     upgrade(rec, from)  the format-4 upgrade (idempotent)     defaults(key) → a container's default
     KEYS, P3, FORMS */
(function (PX) {
  'use strict';

  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;
  var U = PX.util;
  var E = PX.engine;

  var FORMS = ['A', 'B', 'C'];
  // The probes of record format 3 (1.1 and 1.2's first wave) and their versions then.
  var P3 = { wordlinks: 1, cubematch: 1, viewmatch: 1, mechanisms: 1, patterns: 1, level: 1 };
  var KEYS = ['plateau', 'bets', 'measure', 'game'];
  var CHECKS = Object.create(null);

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }
  function copy(x) { try { return U.deepCopy(x); } catch (e) { return undefined; } }

  var DEFAULTS = {
    plateau: function () { return { v: 1, list: [] }; },
    bets: function () { return { v: 1 }; },
    measure: function () { return { v: 1, form0: null }; },
    game: function () { return { v: 1, reach: { high: 0 }, grades: {}, records: {}, firsts: [], atlas: {}, climb: {}, notes: {} }; },
  };
  function defaults(key) { return hasOwn.call(DEFAULTS, key) ? DEFAULTS[key]() : undefined; }

  // The open repairs: a plain object with its named parts of the right type; everything else kept.
  var OPEN = {
    plateau: function (v) {
      v.list = isArray(v.list) ? v.list.filter(isObj) : [];
      return v;
    },
    bets: function (v) { return v; },
    measure: function (v) {
      if (FORMS.indexOf(v.form0) < 0) v.form0 = null;
      return v;
    },
    game: function (v) {
      v.reach = isObj(v.reach) ? v.reach : {};
      v.reach.high = isNum(v.reach.high) && v.reach.high >= 0 ? v.reach.high : 0;
      ['grades', 'records', 'atlas', 'climb', 'notes'].forEach(function (k) { if (!isObj(v[k])) v[k] = {}; });
      if (!isArray(v.firsts)) v.firsts = [];
      return v;
    },
  };
  function repair(key) {
    return function (raw) {
      if (!isObj(raw)) return undefined;
      var v = copy(raw);
      if (!isObj(v)) return undefined;
      v = OPEN[key](v);
      v.v = 1;
      if (CHECKS[key]) {
        var r;
        try { r = CHECKS[key](v); } catch (e) { r = undefined; }
        if (!isObj(r)) return undefined;
        v = r;
        v.v = isNum(v.v) ? v.v : 1;
      }
      return v;
    };
  }
  function check(key, fn) {
    if (KEYS.indexOf(key) < 0) throw new Error('PX.engine.record.check: "' + key + '" is not a reserved container (' + KEYS.join(', ') + ')');
    if (typeof fn !== 'function') throw new Error('PX.engine.record.check("' + key + '"): needs a function');
    if (CHECKS[key]) throw new Error('PX.engine.record.check("' + key + '"): its owner already added a check');
    CHECKS[key] = fn;
  }

  /* ---------- two tabs (CONTRACT M) ---------- */

  // Plateau events: the union of both lists by id; for one id the entry with a verdict, else the later.
  function mergePlateau(theirs, mine, info) {
    var a = repair('plateau')(theirs), b = repair('plateau')(mine);
    if (!a && !b) return undefined;
    var newer = info && info.newer === 'mine' ? (b || a) : (a || b), byId = {}, order = [];
    (a ? a.list : []).concat(b ? b.list : []).forEach(function (x) {
      var id = typeof x.id === 'string' ? x.id : null;
      if (!id) return;
      var y = byId[id];
      if (!y) { byId[id] = x; order.push(id); return; }
      var xv = isObj(x.verdict), yv = isObj(y.verdict);
      if (xv !== yv ? xv : (isNum(x.at) ? x.at : 0) > (isNum(y.at) ? y.at : 0)) byId[id] = x;
    });
    var out = copy(newer);
    out.list = order.map(function (id) { return byId[id]; }).sort(function (x, y) { return (isNum(x.at) ? x.at : 0) - (isNum(y.at) ? y.at : 0); });
    return out;
  }
  // The reserved game container: Reach never falls (the larger high mark); the rest from the newer side.
  function mergeGame(theirs, mine, info) {
    var a = repair('game')(theirs), b = repair('game')(mine);
    if (!a && !b) return undefined;
    var out = copy(info && info.newer === 'mine' ? (b || a) : (a || b));
    out.reach.high = Math.max(a ? a.reach.high : 0, b ? b.reach.high : 0);
    return out;
  }

  /* ---------- the format-4 upgrade ---------- */

  function upgrade(rec, from) {
    if (!isObj(rec) || (isNum(from) && from >= 4)) return rec;
    var list = isArray(rec.assess) ? rec.assess : [];
    var checks = list.filter(function (a) { return isObj(a) && isObj(a.results); });
    // measure exists once its field is registered (app.js does that before the first load); a
    // record without the field gets no stray top-level key here
    if (checks.length && isObj(rec.measure) && FORMS.indexOf(rec.measure.form0) < 0) rec.measure.form0 = 'A';
    checks.forEach(function (a) {
      if (isObj(a.pv)) return;
      var pv = {};
      Object.keys(a.results).forEach(function (id) { pv[id] = hasOwn.call(P3, id) ? P3[id] : 1; });
      a.pv = pv;
    });
    return rec;
  }

  KEYS.forEach(function (key) { E.field(key, DEFAULTS[key], repair(key)); });
  E.pooled('plateau', function (v) { return v; });  // epoch ms, ids and numbers (CONTRACT P)
  E.pooled('bets', function (v) { return v; });     // W2-bets keeps it free of day keys and text
  E.pooled('measure', function (v) { return v; });
  E.pooled('game', false);                          // until milestone 5 gives it a rule
  if (E.merge && typeof E.merge.register === 'function') {
    E.merge.register('plateau', mergePlateau);
    E.merge.register('game', mergeGame);
  }
  var S = PX.core && PX.core.store;
  if (S && typeof S.upgrade === 'function') S.upgrade(function (rec, from) { upgrade(rec, from); });

  E.record = { KEYS: KEYS, P3: P3, FORMS: FORMS, check: check, upgrade: upgrade, defaults: defaults, repair: repair, _: { mergePlateau: mergePlateau, mergeGame: mergeGame } };
})(window.PX);
