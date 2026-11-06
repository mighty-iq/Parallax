/* PX.util: small pure helpers (no DOM, no timers, no Math.random).
   ARCHITECTURE.md §4. Extras beyond the contract: sum, isPlainObject,
   dayKey/dayNum/addDays (local calendar days as 'YYYY-MM-DD'). */
(function (PX) {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Half away from zero; toPrecision(15) absorbs float noise (1.005 → 1.01).
  function round(n, dp) {
    var f = Math.pow(10, dp || 0);
    var s = n < 0 ? -1 : 1;
    return s * Math.round(Number((Math.abs(n) * f).toPrecision(15))) / f;
  }

  function sum(arr) {
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s;
  }
  // Empty input gives NaN, so callers notice missing data.
  function mean(arr) { return arr && arr.length ? sum(arr) / arr.length : NaN; }

  // Sample SD (n − 1) by default; pass pop = true for the population SD. Fewer than two values give 0.
  function sd(arr, pop) {
    var n = arr ? arr.length : 0;
    if (n < 2) return 0;
    var m = mean(arr), ss = 0;
    for (var i = 0; i < n; i++) ss += (arr[i] - m) * (arr[i] - m);
    return Math.sqrt(ss / (pop ? n : n - 1));
  }

  // Linear interpolation between order statistics (R type 7, NumPy default).
  function quantile(arr, q) {
    if (!arr || !arr.length) return NaN;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var pos = clamp(q, 0, 1) * (s.length - 1);
    var lo = Math.floor(pos), hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  }
  function median(arr) { return quantile(arr, 0.5); }

  function logit(p) {
    var q = clamp(p, 1e-9, 1 - 1e-9);
    return Math.log(q / (1 - q));
  }
  // Written so that exp never overflows for large |x|.
  function sigmoid(x) {
    if (x >= 0) return 1 / (1 + Math.exp(-x));
    var e = Math.exp(x);
    return e / (1 + e);
  }

  function deg(radians) { return radians * 180 / Math.PI; }
  function rad(degrees) { return degrees * Math.PI / 180; }

  function isPlainObject(x) {
    if (x === null || typeof x !== 'object' || Array.isArray(x)) return false;
    var p = Object.getPrototypeOf(x);
    return p === null || p === Object.prototype || Object.getPrototypeOf(p) === null;
  }

  // Deep copy of JSON-like data (plain objects, arrays, primitives, Dates).
  function deepCopy(x) {
    if (x === null || typeof x !== 'object') return x;
    if (Array.isArray(x)) {
      var a = new Array(x.length);
      for (var i = 0; i < x.length; i++) a[i] = deepCopy(x[i]);
      return a;
    }
    // toString instead of instanceof: also true for Dates from another realm (iframe, Node vm).
    if (Object.prototype.toString.call(x) === '[object Date]') return new Date(x.getTime());
    var o = {};
    for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = deepCopy(x[k]);
    return o;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Duration in ms → 'm:ss', or 'h:mm:ss' from one hour up.
  function fmtTime(ms) {
    if (typeof ms !== 'number' || !isFinite(ms)) return '–';
    var t = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? h + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
  }

  function toDate(t) {
    if (Object.prototype.toString.call(t) === '[object Date]') return t;
    if (typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
      // A bare day key means local midnight, not UTC midnight.
      var p = t.split('-');
      return new Date(+p[0], +p[1] - 1, +p[2]);
    }
    return new Date(t == null ? Date.now() : t);
  }

  // Local calendar date. style: 'iso' (default, 'YYYY-MM-DD'), 'short' ('30 Oct'),
  // 'long' ('30 Oct 2026'), 'datetime' ('2026-10-30 14:05').
  function fmtDate(t, style) {
    var d = toDate(t);
    if (isNaN(d.getTime())) return '–';
    var iso = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    if (style === 'short') return d.getDate() + ' ' + MONTHS[d.getMonth()];
    if (style === 'long') return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    if (style === 'datetime') return iso + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    return iso;
  }

  // Day keys are local dates 'YYYY-MM-DD'. dayNum counts days since 1970-01-01 so that
  // differences are exact integers (computed in UTC, so DST never shifts them).
  function dayKey(t) { return fmtDate(t); }
  function dayNum(key) {
    var p = String(key).split('-');
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }
  function addDays(key, n) {
    var d = new Date((dayNum(key) + n) * 86400000);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  // Unique id: time + counter + randomness from crypto when present. Not for seeds of items.
  var uidCount = 0;
  function uid() {
    var r = '';
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        var b = new Uint32Array(1);
        crypto.getRandomValues(b);
        r = b[0].toString(36);
      }
    } catch (e) { /* no crypto: time and counter still make it unique in this tab */ }
    uidCount = (uidCount + 1) % 1679616; // 36^4
    return Date.now().toString(36) + '-' + uidCount.toString(36) + (r ? '-' + r : '');
  }

  PX.util = {
    clamp: clamp, lerp: lerp, round: round, sum: sum, mean: mean, sd: sd,
    median: median, quantile: quantile, logit: logit, sigmoid: sigmoid,
    deg: deg, rad: rad, deepCopy: deepCopy, isPlainObject: isPlainObject,
    fmtTime: fmtTime, fmtDate: fmtDate, dayKey: dayKey, dayNum: dayNum, addDays: addDays,
    uid: uid,
  };
})(window.PX);
