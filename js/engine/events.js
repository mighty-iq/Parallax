/* PX.engine.events: the events table (v1.2 wave 2; docs/dev/CONTRACT-v1.2.md O). Pure: every call
   takes the record and the time; nothing reads the clock or storage.

   The record field `events` = { v: 1, rows: [[tSec, kind, exId | null, data | null], …],
   folded: { '<kind>|<exId or ->': n } }: one compact row per event, in time order (tSec in UTC
   seconds). Beyond CAP rows the oldest fold into counts. Every kind declares its data fields with
   types that admit numbers, ids and tokens only, so no text a player typed can reach a row (and so
   never an export).

     define(kind, { owner, fields: { <name>: type } })   a kind (each owner in its own file); types:
                     'int', 'num', 'bool' (stored 0 or 1), 'token' (/^[A-Za-z0-9_.:@-]{1,64}$/),
                     'seed' (uint32), 'ms' (epoch ms), 'list' (at most 20 items, each a number, a
                     token or such a list, two levels deep)
     add(rec, kind, exId, data, now) → the row, or null (an unknown kind, an invalid exercise id or
                     time); unknown fields and values of the wrong type are dropped
     list(rec, { kind, exId, since, until }) → [{ t (ms), kind, exId, data }] (stored rows)
     count(rec, kind, exId?) → how many, folded rows included
     source(kind, fn(rec) → [{ t (ms), exId, data }])   rows built from other fields for the export
                     (checkins from rec.strategies here; plateau rows from rec.plateau)
     table(rec) → every stored and sourced row as { t, kind, exId, data }, by time (the events CSV)
     kinds() → { <kind>: { owner, fields } }; CAP; fix(value) (the store's repair)
   Callers add events between items, never during a stimulus, and then save the record. */
(function (PX) {
  'use strict';

  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;
  var U = PX.util;
  var E = PX.engine;

  var CAP = 5000;
  var KIND_RE = /^[a-z][a-z0-9-]{0,23}$/;
  var ID_RE = /^[a-z][a-z0-9-]{0,39}$/;
  var FIELD_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
  var TOKEN_RE = /^[A-Za-z0-9_.:@-]{1,64}$/;
  var TYPES = { int: 1, num: 1, bool: 1, token: 1, seed: 1, ms: 1, list: 1 };
  var KINDS = Object.create(null);
  var SOURCES = Object.create(null);

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  /* ---------- kinds ---------- */

  function define(kind, spec) {
    if (typeof kind !== 'string' || !KIND_RE.test(kind)) throw new Error('PX.engine.events.define: a kind is a lower-case name (got ' + JSON.stringify(kind) + ')');
    if (KINDS[kind]) throw new Error('PX.engine.events.define: "' + kind + '" is already defined (by ' + KINDS[kind].owner + ')');
    if (!isObj(spec) || typeof spec.owner !== 'string' || !spec.owner || !isObj(spec.fields)) throw new Error('PX.engine.events.define("' + kind + '"): needs { owner, fields }');
    var fields = {};
    Object.keys(spec.fields).forEach(function (name) {
      var type = spec.fields[name];
      if (!FIELD_RE.test(name) || !hasOwn.call(TYPES, type)) throw new Error('PX.engine.events.define("' + kind + '"): field ' + JSON.stringify(name) + ' needs a type of ' + Object.keys(TYPES).join(', '));
      fields[name] = type;
    });
    KINDS[kind] = { owner: spec.owner, fields: fields };
    return KINDS[kind];
  }
  function kinds() {
    var out = {};
    Object.keys(KINDS).sort().forEach(function (k) { out[k] = { owner: KINDS[k].owner, fields: U.deepCopy(KINDS[k].fields) }; });
    return out;
  }

  /* ---------- values ---------- */

  function listOf(v, depth) {
    if (!isArray(v) || v.length > 20) return undefined;
    var out = [];
    for (var i = 0; i < v.length; i++) {
      var x = v[i];
      if (isNum(x) || (typeof x === 'string' && TOKEN_RE.test(x))) out.push(x);
      else if (x === null) out.push(null);
      else if (isArray(x) && depth < 2) { var y = listOf(x, depth + 1); if (y === undefined) return undefined; out.push(y); }
      else return undefined;
    }
    return out;
  }
  function valueOf(type, v) {
    switch (type) {
      case 'int': return isNum(v) && Math.abs(v) <= 9007199254740991 ? Math.round(v) : undefined;
      case 'num': return isNum(v) ? v : undefined;
      case 'bool': return v === true || v === 1 ? 1 : v === false || v === 0 ? 0 : undefined;
      case 'token': return typeof v === 'string' && TOKEN_RE.test(v) ? v : undefined;
      case 'seed': return isNum(v) && v >= 0 && v <= 4294967295 && Math.floor(v) === v ? v : undefined;
      case 'ms': return isNum(v) && v >= 0 && v < 8.64e15 ? Math.round(v) : undefined;
      case 'list': return listOf(v, 0);
    }
    return undefined;
  }
  // The data of a defined kind: its fields only, each of its type.
  function dataOf(spec, data) {
    if (!isObj(data)) return null;
    var out = {}, n = 0;
    for (var name in spec.fields) {
      if (!hasOwn.call(spec.fields, name) || !hasOwn.call(data, name)) continue;
      var v = valueOf(spec.fields[name], data[name]);
      if (v !== undefined) { out[name] = v; n++; }
    }
    return n ? out : null;
  }
  // The data of a stored row whose kind is unknown here (a module this build does not load): kept
  // when every value is a number, a token or such a list (the same shapes define() admits).
  function looseData(data) {
    if (data === null) return null;
    if (!isObj(data)) return undefined;
    var out = {}, n = 0;
    for (var name in data) {
      if (!hasOwn.call(data, name) || !FIELD_RE.test(name)) continue;
      var x = data[name], v = isNum(x) || (typeof x === 'string' && TOKEN_RE.test(x)) ? x : listOf(x, 0);
      if (v !== undefined) { out[name] = v; n++; }
    }
    return n ? out : null;
  }

  /* ---------- the field ---------- */

  function blank() { return { v: 1, rows: [], folded: {} }; }
  function slot(rec) {
    var ev = rec.events;
    if (!isObj(ev)) ev = rec.events = blank();
    if (!isArray(ev.rows)) ev.rows = [];
    if (!isObj(ev.folded)) ev.folded = {};
    ev.v = 1;
    return ev;
  }
  function foldKey(row) { return row[1] + '|' + (row[2] || '-'); }
  // Keeps the newest CAP rows; the older ones become counts.
  function cap(ev) {
    var extra = ev.rows.length - CAP;
    if (extra <= 0) return 0;
    var old = ev.rows.splice(0, extra);
    old.forEach(function (r) { var k = foldKey(r); ev.folded[k] = (isNum(ev.folded[k]) ? ev.folded[k] : 0) + 1; });
    return extra;
  }
  function rowOf(r) {
    if (!isArray(r) || r.length < 2) return undefined;
    if (!isNum(r[0]) || r[0] < 0 || r[0] > 8.64e12 || typeof r[1] !== 'string' || !KIND_RE.test(r[1])) return undefined;
    var ex = r[2] === null || r[2] === undefined ? null : typeof r[2] === 'string' && ID_RE.test(r[2]) ? r[2] : undefined;
    if (ex === undefined) return undefined;
    var spec = KINDS[r[1]], data = r.length > 3 ? (spec ? dataOf(spec, r[3]) : looseData(r[3])) : null;
    if (data === undefined) return undefined;
    return [Math.floor(r[0]), r[1], ex, data];
  }
  // The store's repair: valid rows kept (in time order), broken ones dropped, counts kept.
  function fix(v) {
    if (!isObj(v)) return undefined;
    var out = blank(), rows = isArray(v.rows) ? v.rows : [];
    for (var i = 0; i < rows.length && i < 100000; i++) { var r = rowOf(rows[i]); if (r) out.rows.push(r); }
    out.rows.sort(function (a, b) { return a[0] - b[0]; }); // stable: same-second rows keep their order
    if (isObj(v.folded)) {
      Object.keys(v.folded).forEach(function (k) {
        var n = v.folded[k];
        if (/^[a-z][a-z0-9-]{0,23}\|([a-z][a-z0-9-]{0,39}|-)$/.test(k) && isNum(n) && n > 0) out.folded[k] = Math.round(n);
      });
    }
    cap(out);
    return out;
  }

  /* ---------- writing and reading ---------- */

  function add(rec, kind, exId, data, now) {
    var spec = typeof kind === 'string' ? KINDS[kind] : null;
    if (!spec || !rec || typeof rec !== 'object') return null;
    var ex = exId === null || exId === undefined ? null : typeof exId === 'string' && ID_RE.test(exId) ? exId : undefined;
    if (ex === undefined || !isNum(now) || now < 0) return null;
    var ev = slot(rec), row = [Math.floor(now / 1000), kind, ex, dataOf(spec, data)];
    var rows = ev.rows;
    if (rows.length && rows[rows.length - 1][0] > row[0]) { // a clock that went back: keep the time order
      var i = rows.length;
      while (i > 0 && rows[i - 1][0] > row[0]) i--;
      rows.splice(i, 0, row);
    } else rows.push(row);
    cap(ev);
    return row;
  }

  function asEvent(r) { return { t: r[0] * 1000, kind: r[1], exId: r[2], data: r[3] ? U.deepCopy(r[3]) : null }; }
  function list(rec, q) {
    q = q || {};
    var ev = rec && isObj(rec.events) && isArray(rec.events.rows) ? rec.events.rows : [];
    var out = [];
    for (var i = 0; i < ev.length; i++) {
      var r = ev[i];
      if (!isArray(r)) continue;
      if (q.kind && r[1] !== q.kind) continue;
      if (q.exId !== undefined && r[2] !== q.exId) continue;
      if (isNum(q.since) && r[0] * 1000 < q.since) continue;
      if (isNum(q.until) && r[0] * 1000 > q.until) continue;
      out.push(asEvent(r));
    }
    return out;
  }
  function count(rec, kind, exId) {
    var ev = rec && isObj(rec.events) ? rec.events : null;
    if (!ev) return 0;
    var n = 0, rows = isArray(ev.rows) ? ev.rows : [];
    for (var i = 0; i < rows.length; i++) if (isArray(rows[i]) && rows[i][1] === kind && (exId === undefined || rows[i][2] === exId)) n++;
    var f = isObj(ev.folded) ? ev.folded : {};
    Object.keys(f).forEach(function (k) {
      var at = k.indexOf('|'), kk = k.slice(0, at), ex = k.slice(at + 1);
      if (kk === kind && (exId === undefined || ex === (exId === null ? '-' : exId)) && isNum(f[k])) n += f[k];
    });
    return n;
  }

  function source(kind, fn) {
    if (typeof kind !== 'string' || !KIND_RE.test(kind) || typeof fn !== 'function') throw new Error('PX.engine.events.source: needs a kind and a function');
    if (SOURCES[kind]) throw new Error('PX.engine.events.source: "' + kind + '" already has a source');
    SOURCES[kind] = fn;
  }
  function table(rec) {
    var out = list(rec, {});
    Object.keys(SOURCES).sort().forEach(function (kind) {
      var rows = [];
      try { rows = SOURCES[kind](rec) || []; } catch (e) { rows = []; }
      rows.forEach(function (x) {
        if (!isObj(x) || !isNum(x.t)) return;
        var ex = typeof x.exId === 'string' && ID_RE.test(x.exId) ? x.exId : null;
        out.push({ t: x.t, kind: kind, exId: ex, data: isObj(x.data) ? looseData(x.data) : null });
      });
    });
    return out.map(function (x, i) { return [x, i]; }).sort(function (a, b) { return a[0].t - b[0].t || a[1] - b[1]; }).map(function (p) { return p[0]; });
  }

  /* ---------- the two-tab merge ---------- */

  // Round 10 (RV-code-1.2 L4: two full tables counted the rows one side had folded twice, as rows and as counts): a side
  // that folded rows holds none from before its oldest kept row, so the other side's rows from before then are among the
  // ones it folded; they come off before the union (both sides share one history: two tabs of one record)
  function sinceFold(x, y) {
    if (!y.rows.length || !Object.keys(y.folded).length) return x.rows;
    var t0 = y.rows[0][0];
    return x.rows.filter(function (r) { return r[0] >= t0; });
  }
  function merge(theirs, mine) {
    var a = fix(theirs) || blank(), b = fix(mine) || blank(), seen = {}, rows = [];
    sinceFold(a, b).concat(sinceFold(b, a)).forEach(function (r) {
      var k = JSON.stringify(r);
      if (seen[k]) return;
      seen[k] = 1;
      rows.push(r);
    });
    rows.sort(function (x, y) { return x[0] - y[0]; });
    var out = { v: 1, rows: rows, folded: {} };
    [a.folded, b.folded].forEach(function (f) {
      Object.keys(f).forEach(function (k) { if (!(out.folded[k] >= f[k])) out.folded[k] = f[k]; });
    });
    cap(out);
    return out;
  }

  /* ---------- W2-core's kinds (the player and Today emit them) ---------- */

  define('showme', { owner: 'W2-core', fields: { seed: 'seed', auto: 'bool', ms: 'int', steps: 'int', replays: 'int', closed: 'bool' } });
  define('card', { owner: 'W2-core', fields: { card: 'token', src: 'token', ms: 'int' } });
  define('wtg', { owner: 'W2-core', fields: { result: 'token', ms: 'int', tries: 'int', right: 'int' } });
  define('suggest', { owner: 'W2-core', fields: { key: 'token', mode: 'token', act: 'token' } });
  define('checkin', { owner: 'W2-core', fields: { answer: 'token' } });
  // strategy check-ins stay in rec.strategies (since 1.0); the export table reads them from there
  source('checkin', function (rec) {
    return (isArray(rec.strategies) ? rec.strategies : []).filter(function (x) { return isObj(x) && isNum(x.t); }).map(function (x) {
      return { t: x.t, exId: x.exId, data: { answer: x.strategy } };
    });
  });

  E.field('events', blank, fix);
  E.pooled('events', function (v) { return v; }); // UTC seconds, ids, tokens and numbers only
  if (E.merge && typeof E.merge.register === 'function') E.merge.register('events', merge);

  E.events = {
    CAP: CAP, define: define, kinds: kinds, add: add, list: list, count: count, source: source, table: table, fix: fix,
    _: { merge: merge, valueOf: valueOf, dataOf: dataOf, looseData: looseData, cap: cap },
  };
})(window.PX);
