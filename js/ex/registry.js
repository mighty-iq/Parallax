/* PX.ex: exercise registry (pure; ARCHITECTURE.md §5 and §6).
   define(def) → def        validates (throws a clear Error naming the problem) and registers
   check(def) → def         the same validation and normalisation without registering (tests)
   get(id) / has(id)        the normalised definition, or null / false
   list(role?)              definitions sorted by code ('EX-02' before 'EX-10'); role 'train' | 'probe'
   view(id, viewDef)        registers the view (js/ex/<id>/view.js); view(id) returns it or null.
                            Needs present + drawOption (stem+options) or present + collect +
                            reveal (custom); the other §6 functions are optional
   learn(id, data)          registers tutorial data (js/ex/<id>/learn.js); learn(id) returns it or null
   Helpers (exDef or id as first argument where named):
   difficulty(def, params)  def.difficulty(params): base + Σ step × level index unless overridden
   paramsKey(params)        stable text key, keys sorted: 'angle=2,axis=1,variant=pick1'
   paramsCode(def, params)  integer: mixed-radix digits, first dim least significant, variant last
   decodeParams(def, code)  inverse of paramsCode
   validParams(def, params) true or a reason string
   count(def)               number of combinations (levels × variants)
   enumerate(def, opts?)    every combination as params objects (code order); above 5 000, a
                            deterministic sample of 400 that always holds the all-first and
                            all-last level corners for the first and last variant
   minDifficulty(def) / maxDifficulty(def)  exact (custom difficulty functions: over enumerate)

   Normalised definitions always have: short, variants (array or null), difficulty(params),
   chance(params) (a number in the definition becomes a function; only choice (1/nOptions)
   and yesno (0.5) have defaults, the other answer types must give it), timeLimit(params)
   (default null = untimed), customDifficulty (boolean), version (default 1), nCorrect (1 unless
   answer 'multi'), perDisplay (default false), cell (null = outside the 2×2).
   key(def) → 'id@version' (how trial logs index exercises). Definitions are frozen after define. */
(function (PX) {
  'use strict';

  var ID_RE = /^[a-z][a-z0-9-]{0,39}$/;
  var CODE_RE = /^([A-Z]{1,4})-(\d{1,4})$/;
  var DIMKEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
  var VARIANT_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/;
  // CHC Gv narrow abilities, then other codes used here (ARCHITECTURE §11): AT attentional tracking,
  // WM working memory, PT perspective taking, NAV navigation, MA mental animation, VB verbal (control).
  var ABILITIES = ['Vz', 'SR', 'CS', 'CF', 'MV', 'SS', 'PI', 'LE', 'IL', 'PN', 'IM', 'AT', 'WM', 'PT', 'NAV', 'MA', 'VB'];
  var CELLS = ['intrinsic-static', 'intrinsic-dynamic', 'extrinsic-static', 'extrinsic-dynamic', null]; // null: outside the 2×2 (a checklist label only)
  var ROLES = ['train', 'probe'];
  var ANSWERS = ['choice', 'multi', 'yesno', 'angle', 'targets', 'sequence'];
  var LAYOUTS = ['stem+options', 'custom'];
  var ENUM_LIMIT = 5000;
  var ENUM_SAMPLE = 400;
  var MAX_COMBOS = 9007199254740991; // codes must stay exact integers

  var defs = Object.create(null);
  var views = Object.create(null);
  var learns = Object.create(null);
  var ranges = Object.create(null);
  var hasOwn = Object.prototype.hasOwnProperty;

  function fail(id, msg) { throw new Error('PX.ex.define(' + (id ? '"' + id + '"' : '?') + '): ' + msg); }
  function isFn(f) { return typeof f === 'function'; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function isStr(s) { return typeof s === 'string' && s.trim().length > 0; }
  function comb(n, k) { var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }

  function check(input) {
    if (!input || typeof input !== 'object') fail(null, 'the definition must be an object');
    var id = input.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      fail(typeof id === 'string' ? id : null, 'id must be lower-case letters, digits and hyphens, starting with a letter (got ' + JSON.stringify(id) + ')');
    }
    var d = {};
    for (var k in input) if (hasOwn.call(input, k)) d[k] = input[k];

    if (typeof d.code !== 'string' || !CODE_RE.test(d.code)) fail(id, 'code must look like "EX-02" (got ' + JSON.stringify(d.code) + ')');
    if (!isStr(d.name)) fail(id, 'name is missing');
    if (d.short === undefined) d.short = d.name;
    else if (!isStr(d.short)) fail(id, 'short must be a non-empty string');

    if (!Array.isArray(d.abilities) || !d.abilities.length) fail(id, 'abilities must be a non-empty array of codes such as ["SR", "Vz"]');
    d.abilities.forEach(function (a) {
      if (ABILITIES.indexOf(a) < 0) fail(id, 'unknown ability code ' + JSON.stringify(a) + ' (known: ' + ABILITIES.join(', ') + ')');
    });
    if (d.cell === undefined) d.cell = null;
    if (CELLS.indexOf(d.cell) < 0) fail(id, 'cell must be one of ' + CELLS.join(', ') + ' (got ' + JSON.stringify(d.cell) + ')');
    if (ROLES.indexOf(d.role) < 0) fail(id, 'role must be "train" or "probe" (got ' + JSON.stringify(d.role) + ')');
    if (ANSWERS.indexOf(d.answer) < 0) fail(id, 'answer must be one of ' + ANSWERS.join(', ') + ' (got ' + JSON.stringify(d.answer) + ')');
    if (d.answer === 'choice' || d.answer === 'multi') {
      // Keys 1–9 pick options, so a choice grid holds at most 9.
      if (!(Number.isInteger(d.nOptions) && d.nOptions >= 2 && d.nOptions <= 9)) {
        fail(id, 'answer "' + d.answer + '" needs nOptions, an integer from 2 to 9 (got ' + JSON.stringify(d.nOptions) + ')');
      }
    }
    // multi: exactly nCorrect options must be picked (e.g. "pick the two that match").
    if (d.answer === 'multi') {
      if (!(Number.isInteger(d.nCorrect) && d.nCorrect >= 1 && d.nCorrect < d.nOptions)) {
        fail(id, 'answer "multi" needs nCorrect, an integer from 1 to nOptions − 1 (got ' + JSON.stringify(d.nCorrect) + ')');
      }
    } else if (d.nCorrect !== undefined && d.nCorrect !== 1) fail(id, 'nCorrect is only for answer "multi"');
    else d.nCorrect = 1;
    // version: bump when dims or levels change incompatibly; trial logs index exercises as "id@version".
    if (d.version === undefined) d.version = 1;
    else if (!(Number.isInteger(d.version) && d.version >= 1)) fail(id, 'version must be an integer ≥ 1 (got ' + JSON.stringify(d.version) + ')');
    // perDisplay: ratings kept per screen class (Track, Homing: viewing distance changes difficulty).
    if (d.perDisplay === undefined) d.perDisplay = false;
    else if (typeof d.perDisplay !== 'boolean') fail(id, 'perDisplay must be true or false');
    // extraParams: params keys that are not difficulty dims (e.g. Track's continuous speedValue for
    // staircases). Allowed in params, ignored by paramsCode, so logs keep the nearest level only.
    if (d.extraParams === undefined) d.extraParams = [];
    else if (!Array.isArray(d.extraParams) || d.extraParams.some(function (k) { return typeof k !== 'string' || !DIMKEY_RE.test(k) || k === 'variant'; })) {
      fail(id, 'extraParams must be an array of identifiers other than "variant"');
    }
    d.extraParams = d.extraParams.slice();

    if (!Array.isArray(d.dims)) fail(id, 'dims must be an array (it may be empty)');
    var keys = {};
    d.dims = d.dims.map(function (dim, i) {
      var where = 'dims[' + i + ']';
      if (!dim || typeof dim !== 'object') fail(id, where + ' must be an object');
      if (typeof dim.key !== 'string' || !DIMKEY_RE.test(dim.key)) fail(id, where + '.key must be an identifier (got ' + JSON.stringify(dim.key) + ')');
      if (dim.key === 'variant') fail(id, where + '.key "variant" is reserved for variants');
      if (keys[dim.key]) fail(id, where + '.key "' + dim.key + '" is used twice');
      keys[dim.key] = true;
      if (!Array.isArray(dim.levels) || !dim.levels.length) fail(id, 'dim "' + dim.key + '" needs a non-empty levels array');
      if (!isNum(dim.step)) fail(id, 'dim "' + dim.key + '" needs a numeric step (got ' + JSON.stringify(dim.step) + ')');
      var copy = {};
      for (var p in dim) if (hasOwn.call(dim, p)) copy[p] = dim[p];
      copy.label = isStr(dim.label) ? dim.label : dim.key;
      copy.levels = Object.freeze(dim.levels.slice());
      return Object.freeze(copy);
    });
    if (!isNum(d.base)) fail(id, 'base must be a number (difficulty in logits with every dim at level 0)');

    if (d.variants === undefined || d.variants === null) d.variants = null;
    else {
      if (!Array.isArray(d.variants) || !d.variants.length) fail(id, 'variants must be a non-empty array of names, or left out');
      var seenV = {};
      d.variants.forEach(function (v) {
        if (typeof v !== 'string' || !VARIANT_RE.test(v)) fail(id, 'variant names must be identifiers (got ' + JSON.stringify(v) + ')');
        if (seenV[v]) fail(id, 'variant "' + v + '" is listed twice');
        seenV[v] = true;
      });
      d.variants = d.variants.slice();
    }

    ['generate', 'validate', 'score'].forEach(function (fn) {
      if (!isFn(d[fn])) fail(id, fn + '(…) is missing (generate, validate and score are required)');
    });

    if (d.difficulty === undefined) {
      d.customDifficulty = false;
      d.difficulty = function (params) { return defaultDifficulty(d, params); };
    } else if (isFn(d.difficulty)) d.customDifficulty = true;
    else fail(id, 'difficulty must be a function or left out');

    if (isNum(d.chance)) {
      var c = d.chance;
      if (c < 0 || c >= 1) fail(id, 'chance must be in [0, 1)');
      d.chance = function () { return c; };
    } else if (d.chance === undefined) {
      // Defaults only where the guessing rate follows from the answer type.
      if (d.answer !== 'choice' && d.answer !== 'yesno' && d.answer !== 'multi') {
        fail(id, 'chance(params) is missing: for answer "' + d.answer + '" the guessing rate depends on the task (only choice, multi and yesno have a default)');
      }
      var dc = d.answer === 'choice' ? 1 / d.nOptions : 0.5;
      if (d.answer === 'multi') dc = 1 / comb(d.nOptions, d.nCorrect);
      d.chance = function () { return dc; };
    } else if (!isFn(d.chance)) fail(id, 'chance must be a function, a number or left out');

    if (d.timeLimit === undefined) d.timeLimit = function () { return null; };
    else if (!isFn(d.timeLimit)) fail(id, 'timeLimit must be a function or left out');

    var total = count(d);
    if (!(total <= MAX_COMBOS)) fail(id, 'too many level combinations (' + total + ') to encode as integers');
    return d;
  }

  function define(input) {
    var d = check(input);
    if (defs[d.id]) fail(d.id, 'this id is already defined');
    for (var k in defs) {
      if (defs[k].code === d.code) fail(d.id, 'code ' + d.code + ' is already used by "' + k + '"');
    }
    Object.freeze(d.abilities);
    if (d.variants) Object.freeze(d.variants);
    Object.freeze(d.dims);
    defs[d.id] = Object.freeze(d);
    return d;
  }

  function get(id) { return typeof id === 'string' && defs[id] ? defs[id] : null; }
  function has(id) { return !!get(id); }

  function resolve(defOrId, who) {
    var d = typeof defOrId === 'string' ? defs[defOrId] : defOrId;
    if (!d || !Array.isArray(d.dims)) throw new Error('PX.ex.' + who + ': unknown exercise ' + JSON.stringify(defOrId));
    return d;
  }

  function codeOrder(a, b) {
    var ma = CODE_RE.exec(a.code), mb = CODE_RE.exec(b.code);
    if (ma[1] !== mb[1]) return ma[1] < mb[1] ? -1 : 1;
    if (+ma[2] !== +mb[2]) return +ma[2] - +mb[2];
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  function list(role) {
    var out = [];
    for (var k in defs) if (!role || defs[k].role === role) out.push(defs[k]);
    return out.sort(codeOrder);
  }

  function view(id, v) {
    if (arguments.length < 2) return typeof id === 'string' && views[id] ? views[id] : null;
    var where = 'PX.ex.view("' + id + '"): ';
    if (!defs[id]) throw new Error(where + 'define the exercise (gen.js) before its view');
    if (views[id]) throw new Error(where + 'a view is already registered');
    if (!v || typeof v !== 'object') throw new Error(where + 'the view must be an object');
    if (LAYOUTS.indexOf(v.layout) < 0) throw new Error(where + 'layout must be "stem+options" or "custom"');
    // stem+options may leave reveal out: the player can mark its own choice grid.
    var need = v.layout === 'custom' ? ['present', 'collect', 'reveal'] : ['present', 'drawOption'];
    need.forEach(function (fn) {
      if (!isFn(v[fn])) throw new Error(where + fn + '(…) is missing (layout "' + v.layout + '" needs ' + need.join(', ') + ')');
    });
    ['mount', 'unmount', 'showMe', 'demo', 'collect', 'drawOption', 'reveal'].forEach(function (fn) {
      if (v[fn] !== undefined && !isFn(v[fn])) throw new Error(where + fn + ' must be a function or left out');
    });
    views[id] = v;
    return v;
  }

  function learn(id, data) {
    if (arguments.length < 2) return typeof id === 'string' && learns[id] ? learns[id] : null;
    var where = 'PX.ex.learn("' + id + '"): ';
    if (!defs[id]) throw new Error(where + 'define the exercise (gen.js) before its learn data');
    if (learns[id]) throw new Error(where + 'learn data is already registered');
    if (!data || typeof data !== 'object') throw new Error(where + 'the data must be an object');
    learns[id] = data;
    return data;
  }

  /* ---------- params ---------- */

  function defaultDifficulty(d, params) {
    var b = d.base;
    for (var i = 0; i < d.dims.length; i++) {
      var dim = d.dims[i], ix = params ? params[dim.key] : 0;
      b += dim.step * (Number.isInteger(ix) ? ix : 0);
    }
    return b;
  }

  function difficulty(defOrId, params) { return resolve(defOrId, 'difficulty').difficulty(params); }

  function paramsKey(params) {
    if (!params || typeof params !== 'object') return '';
    return Object.keys(params).sort().filter(function (k) {
      return params[k] !== undefined;
    }).map(function (k) { return k + '=' + params[k]; }).join(',');
  }

  function count(d) {
    var n = d.variants ? d.variants.length : 1;
    for (var i = 0; i < d.dims.length; i++) n *= d.dims[i].levels.length;
    return n;
  }

  function validParams(defOrId, params) {
    var d = resolve(defOrId, 'validParams');
    if (!params || typeof params !== 'object') return 'params must be an object';
    for (var i = 0; i < d.dims.length; i++) {
      var dim = d.dims[i], ix = params[dim.key];
      if (!Number.isInteger(ix) || ix < 0 || ix >= dim.levels.length) {
        return dim.key + ' must be a level index from 0 to ' + (dim.levels.length - 1) + ' (got ' + JSON.stringify(ix) + ')';
      }
    }
    if (params.variant !== undefined) {
      if (!d.variants) return 'this exercise has no variants (got ' + JSON.stringify(params.variant) + ')';
      if (d.variants.indexOf(params.variant) < 0) return 'unknown variant ' + JSON.stringify(params.variant);
    }
    for (var k in params) {
      if (hasOwn.call(params, k) && k !== 'variant' && d.extraParams.indexOf(k) < 0 && !d.dims.some(function (x) { return x.key === k; })) {
        return 'unknown param "' + k + '"';
      }
    }
    for (var e = 0; e < d.extraParams.length; e++) {
      var ev = params[d.extraParams[e]];
      if (ev !== undefined && !(isNum(ev) || typeof ev === 'string' || typeof ev === 'boolean')) {
        return d.extraParams[e] + ' must be a number, string or boolean (got ' + JSON.stringify(ev) + ')';
      }
    }
    return true;
  }

  // A missing variant counts as the first one.
  function paramsCode(defOrId, params) {
    var d = resolve(defOrId, 'paramsCode');
    var ok = validParams(d, params);
    if (ok !== true) throw new RangeError('PX.ex.paramsCode("' + d.id + '"): ' + ok);
    var code = 0, mul = 1;
    for (var i = 0; i < d.dims.length; i++) {
      code += params[d.dims[i].key] * mul;
      mul *= d.dims[i].levels.length;
    }
    if (d.variants) code += (params.variant === undefined ? 0 : d.variants.indexOf(params.variant)) * mul;
    return code;
  }

  function decodeParams(defOrId, code) {
    var d = resolve(defOrId, 'decodeParams');
    if (!Number.isInteger(code) || code < 0 || code >= count(d)) {
      throw new RangeError('PX.ex.decodeParams("' + d.id + '"): code must be an integer from 0 to ' + (count(d) - 1) + ' (got ' + JSON.stringify(code) + ')');
    }
    var p = {}, rest = code;
    for (var i = 0; i < d.dims.length; i++) {
      var n = d.dims[i].levels.length;
      p[d.dims[i].key] = rest % n;
      rest = Math.floor(rest / n);
    }
    if (d.variants) p.variant = d.variants[rest];
    return p;
  }

  // opts: { max (5000), sample (400), seed } for tests; the defaults follow the contract.
  function enumerate(defOrId, opts) {
    var d = resolve(defOrId, 'enumerate');
    var max = opts && opts.max > 0 ? opts.max : ENUM_LIMIT;
    var want = opts && opts.sample > 0 ? opts.sample : ENUM_SAMPLE;
    var total = count(d), out = [], c;
    if (total <= max) {
      for (c = 0; c < total; c++) out.push(decodeParams(d, c));
      return out;
    }
    var picked = {}, codes = [];
    function add(code) { if (!picked[code]) { picked[code] = true; codes.push(code); } }
    // Corners first: every dim at its first level and every dim at its last level.
    var lastV = d.variants ? d.variants.length - 1 : 0;
    [0, lastV].forEach(function (vi) {
      [false, true].forEach(function (top) {
        var p = {};
        d.dims.forEach(function (dim) { p[dim.key] = top ? dim.levels.length - 1 : 0; });
        if (d.variants) p.variant = d.variants[vi];
        add(paramsCode(d, p));
      });
    });
    var rng = PX.rng(opts && opts.seed !== undefined ? opts.seed : PX.rng.hash('px-enumerate', d.id));
    while (codes.length < Math.min(want, total)) add(rng.int(0, total - 1));
    codes.sort(function (a, b) { return a - b; });
    for (c = 0; c < codes.length; c++) out.push(decodeParams(d, codes[c]));
    return out;
  }

  function range(d) {
    if (ranges[d.id] && defs[d.id] === d) return ranges[d.id];
    var lo, hi;
    if (!d.customDifficulty) {
      lo = hi = d.base;
      d.dims.forEach(function (dim) {
        var span = dim.step * (dim.levels.length - 1);
        lo += Math.min(0, span);
        hi += Math.max(0, span);
      });
    } else {
      // Exact for up to 5 000 combinations; over the deterministic sample beyond that.
      lo = Infinity; hi = -Infinity;
      enumerate(d).forEach(function (p) {
        var b = d.difficulty(p);
        if (b < lo) lo = b;
        if (b > hi) hi = b;
      });
    }
    var r = { min: lo, max: hi };
    if (defs[d.id] === d) ranges[d.id] = r; // cache only registered (frozen) definitions
    return r;
  }
  function minDifficulty(defOrId) { return range(resolve(defOrId, 'minDifficulty')).min; }
  function maxDifficulty(defOrId) { return range(resolve(defOrId, 'maxDifficulty')).max; }

  PX.ex.define = define;
  PX.ex.check = check;
  PX.ex.get = get;
  PX.ex.key = function (def) { var d = typeof def === 'string' ? get(def) : def; return d ? d.id + '@' + (d.version || 1) : null; };
  PX.ex.has = has;
  PX.ex.list = list;
  PX.ex.view = view;
  PX.ex.learn = learn;
  PX.ex.difficulty = difficulty;
  PX.ex.paramsKey = paramsKey;
  PX.ex.paramsCode = paramsCode;
  PX.ex.decodeParams = decodeParams;
  PX.ex.validParams = validParams;
  PX.ex.count = count;
  PX.ex.enumerate = enumerate;
  PX.ex.minDifficulty = minDifficulty;
  PX.ex.maxDifficulty = maxDifficulty;
  PX.ex.ABILITIES = ABILITIES;
  PX.ex.CELLS = CELLS;
  PX.ex.ANSWERS = ANSWERS;
  PX.ex.ENUM_LIMIT = ENUM_LIMIT;
  PX.ex.ENUM_SAMPLE = ENUM_SAMPLE;
})(window.PX);
