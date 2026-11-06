/* PX.rng: seeded random numbers (pure; ARCHITECTURE.md §4).
   sfc32 generator; its four state words come from xmur3 over the decimal seed.
   PX.rng.hash(...parts) turns strings and numbers into a uint32 seed with cyrb53.
   Only integer maths (Math.imul, bit operations) and float64 + − × ÷ are used, plus
   Math.sqrt (correctly rounded by IEEE 754) in normal(). The logarithm is computed
   here because Math.log may differ in the last bit between engines; so the same seed
   gives the same numbers in every browser and in Node. */
(function (PX) {
  'use strict';

  var TWO32 = 4294967296;
  var LN2 = 0.6931471805599453; // nearest double to ln 2

  // xmur3 string hash: returns a function giving successive 32-bit hashes of str.
  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  // cyrb53 string hash (53-bit result as a float64 integer).
  function cyrb53(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  // Key order is sorted so that equal objects hash equally whatever their construction.
  function stable(x) {
    if (x === null || typeof x !== 'object') return String(x);
    if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
    return '{' + Object.keys(x).sort().map(function (k) { return k + ':' + stable(x[k]); }).join(',') + '}';
  }

  // hash('a', 1) === hash('a', '1'): parts are compared by their text. The separator
  // (U+001F) keeps hash('ab', 'c') apart from hash('a', 'bc').
  function hash() {
    var s = '';
    for (var i = 0; i < arguments.length; i++) s += (i ? '\u001f' : '') + stable(arguments[i]);
    return cyrb53(s) % TWO32;
  }

  // Natural logarithm from float64 arithmetic only (deterministic everywhere).
  // x = m · 2^e with m in [√½, √2], then ln m = 2·atanh(z), z = (m − 1)/(m + 1), |z| ≤ 0.172.
  function ln(x) {
    if (!(x > 0)) return x === 0 ? -Infinity : NaN;
    if (x === Infinity) return Infinity;
    var e = 0;
    while (x >= 2) { x /= 2; e++; }  // exact: halving and doubling only change the exponent
    while (x < 1) { x *= 2; e--; }
    if (x > 1.4142135623730951) { x /= 2; e++; }
    var z = (x - 1) / (x + 1), z2 = z * z, term = z, s = z;
    for (var k = 3; k <= 35; k += 2) { term *= z2; s += term / k; } // z2^17 < 1e-26: converged
    return 2 * s + e * LN2;
  }

  function toSeed(seed) {
    if (seed === undefined || seed === null) return 0;
    if (typeof seed === 'number' && isFinite(seed)) return seed >>> 0;
    return hash(seed);
  }

  function makeRng(seedIn) {
    var seed = toSeed(seedIn);
    var w = xmur3('px-sfc32:' + seed);
    var a = w(), b = w(), c = w(), d = w();

    // sfc32 (Chris Doty-Humphrey's Small Fast Counting generator), 32-bit output.
    function u32() {
      var t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return t >>> 0;
    }
    for (var i = 0; i < 15; i++) u32(); // warm-up: mixes the seed words fully

    // Float in [0, 1) with 32 random bits.
    function next() { return u32() / TWO32; }

    // Integer in [lo, hi], both inclusive; rejection sampling keeps it unbiased.
    function int(lo, hi) {
      lo = Math.ceil(lo); hi = Math.floor(hi);
      if (hi < lo) { var tmp = lo; lo = hi; hi = tmp; }
      var range = hi - lo + 1;
      if (range <= TWO32) {
        var limit = TWO32 - (TWO32 % range), u;
        do { u = u32(); } while (u >= limit);
        return lo + (u % range);
      }
      // Wider than 32 bits: 53 random bits.
      var v = (u32() >>> 11) * TWO32 + u32();
      return lo + Math.floor(v / 9007199254740992 * range);
    }

    function float(lo, hi) {
      if (lo === undefined) return next();
      if (hi === undefined) { hi = lo; lo = 0; }
      return lo + (hi - lo) * next();
    }

    function pick(arr) { return arr && arr.length ? arr[int(0, arr.length - 1)] : undefined; }

    // Returns a shuffled copy (Fisher–Yates); the input is not changed.
    function shuffle(arr) {
      var out = Array.prototype.slice.call(arr || []);
      for (var i = out.length - 1; i > 0; i--) {
        var j = int(0, i), t = out[i];
        out[i] = out[j]; out[j] = t;
      }
      return out;
    }

    // Always draws one number, whatever p is, so the sequence never depends on p.
    function chance(p) { return next() < p; }

    // Standard normal by Marsaglia's polar method; normal(mean, sd) scales it.
    function normal(mean, sd) {
      var u, v, s;
      do {
        u = 2 * next() - 1;
        v = 2 * next() - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      var z = u * Math.sqrt(-2 * ln(s) / s);
      return (mean || 0) + (sd === undefined ? 1 : sd) * z;
    }

    // A labelled, independent stream. It depends only on this generator's seed and the
    // label (not on how many numbers were drawn) and does not advance this generator.
    function fork(label) { return makeRng(hash(seed, '\u0001fork', label)); }

    return {
      seed: seed, next: next, u32: u32, int: int, float: float, pick: pick,
      shuffle: shuffle, chance: chance, normal: normal, fork: fork,
    };
  }

  PX.rng = makeRng;
  PX.rng.hash = hash;
  PX.rng.ln = ln; // exposed for tests
})(window.PX);
