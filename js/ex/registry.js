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
   answer 'multi'), perDisplay (default false), cell (null = outside the 2×2), pat (default false: a
   PAT-format exercise, trained only under the player's PAT focus; v1.1), experimental (default false).
   v1.2 (docs/dev/CONTRACT-v1.2.md A): starters (a list of { dim, levels }; starter: its first entry
   or null), trainVariants (the variants
   automatic choices use; all by default), pace (a deadline spec or null), roundScore (function or
   null), bet (one of BETS or null); a dim may carry `at` (per-level difficulty contributions).
   v1.2 wave 2 (CONTRACT-v1.2 S): format (a token, a frozen { variant | '*': token } or null), layers
   (frozen { compare, produce, bridge, calib } or null; the produce variant stays out of trainVariants
   and out of the range) and atlas ([dimA, dimB] or null).
   v1.2 milestone 8 (CONTRACT-v1.2 W3, W4): testRange (frozen { dims, variants, notes } or null) with
   rangeTag(def, params) → 'below' | 'test' | 'beyond' | null and RANGE_TAGS; set (frozen { param, size }
   or null) with setSize(def, params, seed) → 1 … SET_MAX. A view may declare optionKeys 'letters' (W1).
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
  // position (v1.1): a point on the ground plane, { x, z } in metres in the item's own frame (Reckon's walk-back).
  // point (v1.2): a point on the item's own lattice, { x, y } in its units (Central Point's half-step answers).
  var ANSWERS = ['choice', 'multi', 'yesno', 'angle', 'targets', 'sequence', 'position', 'point'];
  // v1.2 (PLAN milestone 4, gap T2): the transfer bet an exercise makes, one of nine ids.
  var BETS = ['attention', 'load', 'variety', 'strategy', 'compare', 'bridge', 'produce', 'calibrate', 'format'];
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
  function isPlainObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x) && Object.prototype.toString.call(x) === '[object Object]'; }
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
    // pat (v1.1): a PAT-format exercise (DAT-style formats), in Train only under the PAT focus.
    if (d.pat === undefined) d.pat = false;
    else if (typeof d.pat !== 'boolean') fail(id, 'pat must be true or false');
    if (d.experimental === undefined) d.experimental = false;
    else if (typeof d.experimental !== 'boolean') fail(id, 'experimental must be true or false');
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
      // at (v1.2): per-level difficulty contributions, used instead of step × index (a starter
      // level in front: at = [Δ, 0, step, 2·step, …] keeps every old combination's difficulty)
      if (dim.at !== undefined) {
        if (!Array.isArray(dim.at) || dim.at.length !== dim.levels.length || !dim.at.every(isNum)) {
          fail(id, 'dim "' + dim.key + '": at must be an array of numbers, one per level (' + dim.levels.length + ')');
        }
      }
      var copy = {};
      for (var p in dim) if (hasOwn.call(dim, p)) copy[p] = dim[p];
      copy.label = isStr(dim.label) ? dim.label : dim.key;
      copy.levels = Object.freeze(dim.levels.slice());
      if (dim.at !== undefined) copy.at = Object.freeze(dim.at.slice());
      return Object.freeze(copy);
    });
    if (!isNum(d.base)) fail(id, 'base must be a number (difficulty in logits with every dim at level 0)');
    // starter (v1.2, note D2 §3.0 A): the first `levels` levels of dim `dim` are the starter band
    // below the pre-1.2 floor; a list of such entries when the band sits on several dims (Painted
    // Cubes). Normalised: def.starters (a frozen list, [] when none) and def.starter (its first
    // entry or null). Display only: the engine needs nothing else.
    var sIn = d.starter === undefined || d.starter === null ? [] : Array.isArray(d.starter) ? d.starter : [d.starter], sSeen = {};
    d.starters = Object.freeze(sIn.map(function (sd) {
      var sdim = sd && typeof sd === 'object' ? d.dims.filter(function (x) { return x.key === sd.dim; })[0] : null;
      if (!sdim) fail(id, 'starter must be { dim, levels } (or a list of them) naming one of the dims');
      if (sSeen[sd.dim]) fail(id, 'starter names dim "' + sd.dim + '" twice');
      sSeen[sd.dim] = true;
      if (!(Number.isInteger(sd.levels) && sd.levels >= 1 && sd.levels < sdim.levels.length)) {
        fail(id, 'starter.levels must be an integer from 1 to ' + (sdim.levels.length - 1));
      }
      return Object.freeze({ dim: sd.dim, levels: sd.levels });
    }));
    d.starter = d.starters.length ? d.starters[0] : null;

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
    // trainVariants (v1.2): the variants automatic choices use (Train, Path, Today's plan, the
    // Daily); explicit picks (Free play, the Library, Speed) may use any. Default: all.
    if (d.trainVariants === undefined || d.trainVariants === null) d.trainVariants = d.variants ? d.variants.slice() : null;
    else {
      if (!d.variants) fail(id, 'trainVariants needs variants');
      if (!Array.isArray(d.trainVariants) || !d.trainVariants.length || d.trainVariants.some(function (v) { return d.variants.indexOf(v) < 0; })) {
        fail(id, 'trainVariants must be a non-empty list of the exercise\'s variants');
      }
      d.trainVariants = d.trainVariants.slice();
    }
    // pace (v1.2): items of these variants carry a deadline in Train, Path, Free play and the
    // Daily, from a per-exercise staircase (js/engine/pace.js; CONTRACT-v1.2 A and E).
    if (d.pace === undefined || d.pace === null) d.pace = null;
    else {
      var pc = d.pace;
      if (!pc || typeof pc !== 'object') fail(id, 'pace must be an object { startMs, minMs, maxMs, … }');
      if (!(isNum(pc.minMs) && isNum(pc.maxMs) && isNum(pc.startMs) && pc.minMs > 0 && pc.minMs <= pc.startMs && pc.startMs <= pc.maxMs)) {
        fail(id, 'pace needs minMs ≤ startMs ≤ maxMs (milliseconds, > 0)');
      }
      if (pc.variants !== undefined && pc.variants !== null && (!d.variants || !Array.isArray(pc.variants) || pc.variants.some(function (v) { return d.variants.indexOf(v) < 0; }))) {
        fail(id, 'pace.variants must list variants of the exercise');
      }
      var tgt = pc.target === undefined ? 0.85 : pc.target, stp = pc.step === undefined ? 0.03 : pc.step;
      if (!(isNum(tgt) && tgt >= 0.5 && tgt < 1)) fail(id, 'pace.target must be in [0.5, 1)');
      if (!(isNum(stp) && stp > 0 && stp <= 0.2)) fail(id, 'pace.step must be in (0, 0.2] (log10 units)');
      d.pace = Object.freeze({ variants: pc.variants ? Object.freeze(pc.variants.slice()) : null, startMs: pc.startMs, minMs: pc.minMs, maxMs: pc.maxMs, target: tgt, step: stp });
    }
    if (d.roundScore !== undefined && d.roundScore !== null && !isFn(d.roundScore)) fail(id, 'roundScore must be a function or left out');
    if (d.roundScore === undefined) d.roundScore = null;
    if (d.bet === undefined) d.bet = null;
    else if (d.bet !== null && BETS.indexOf(d.bet) < 0) fail(id, 'bet must be one of ' + BETS.join(', ') + ' (got ' + JSON.stringify(d.bet) + ')');
    checkWave2(d, id);

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
    checkWave3(d, id);
    return d;
  }

  // v1.2 wave 2 (docs/dev/CONTRACT-v1.2.md S): format, layers and atlas, all optional until their
  // owners fill them (W2-bets, W2-measure; milestone 5).
  //   format: a token, or { <variant | '*'>: token } ('*' for the variants not named)
  //   layers: { compare: [principle ids], produce: '<variant>', bridge: '<set id>', calib: true }; the
  //           produce variant is one of the exercise's variants and not one of its trainVariants
  //   atlas:  [dimA, dimB], two different dim keys (reserved for milestone 5)
  var TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,47}$/;
  function isToken(x) { return typeof x === 'string' && TOKEN_RE.test(x); }
  function checkWave2(d, id) {
    if (d.format === undefined || d.format === null) d.format = null;
    else if (typeof d.format === 'string') { if (!isToken(d.format)) fail(id, 'format must be a token (letters, digits, _ . : -) or { variant: token }'); }
    else if (isPlainObj(d.format)) {
      var fm = {}, fk = Object.keys(d.format);
      if (!fk.length) fail(id, 'format must name at least one variant (or "*")');
      fk.forEach(function (k) {
        if (k !== '*' && !(d.variants && d.variants.indexOf(k) >= 0)) fail(id, 'format names "' + k + '", which is not a variant of the exercise (or "*")');
        if (!isToken(d.format[k])) fail(id, 'format["' + k + '"] must be a token');
        fm[k] = d.format[k];
      });
      d.format = Object.freeze(fm);
    } else fail(id, 'format must be a token, { variant: token } or left out');

    if (d.layers === undefined || d.layers === null) d.layers = null;
    else {
      var L = d.layers, out = {};
      if (!isPlainObj(L)) fail(id, 'layers must be an object { compare, produce, bridge, calib }');
      Object.keys(L).forEach(function (k) {
        if (['compare', 'produce', 'bridge', 'calib'].indexOf(k) < 0) fail(id, 'layers.' + k + ' is not a layer (compare, produce, bridge, calib)');
      });
      if (L.compare !== undefined) {
        if (!Array.isArray(L.compare) || !L.compare.length || !L.compare.every(isToken)) fail(id, 'layers.compare must be a non-empty list of principle ids (tokens)');
        out.compare = Object.freeze(L.compare.slice());
      }
      if (L.produce !== undefined) {
        if (!d.variants || d.variants.indexOf(L.produce) < 0) fail(id, 'layers.produce must name one of the exercise\'s variants');
        if (d.trainVariants && d.trainVariants.indexOf(L.produce) >= 0) fail(id, 'layers.produce ("' + L.produce + '") must be left out of trainVariants (declare trainVariants without it)');
        out.produce = L.produce;
      }
      if (L.bridge !== undefined) {
        if (!isToken(L.bridge)) fail(id, 'layers.bridge must be a bridge set id (a token)');
        out.bridge = L.bridge;
      }
      if (L.calib !== undefined) {
        if (typeof L.calib !== 'boolean') fail(id, 'layers.calib must be true or false');
        out.calib = L.calib;
      }
      d.layers = Object.freeze(out);
    }

    if (d.atlas === undefined || d.atlas === null) d.atlas = null;
    else {
      var keys = d.dims.map(function (x) { return x.key; });
      if (!Array.isArray(d.atlas) || d.atlas.length !== 2 || d.atlas[0] === d.atlas[1] || d.atlas.some(function (k) { return keys.indexOf(k) < 0; })) {
        fail(id, 'atlas must be [dimA, dimB]: two different dim keys of the exercise');
      }
      d.atlas = Object.freeze(d.atlas.slice());
    }
  }
  // v1.2 milestone 8 (docs/dev/CONTRACT-v1.2.md W3, W4), both optional:
  //   testRange: { dims: { <dim key>: [a tag per level] }, variants: { <variant>: tag }, notes: { <dim key | variant |
  //     '*'>: text } }, tags 'below' (the test: starter levels and scaffolds), 'test' (inside the format the official
  //     instructions document) and 'beyond' (the test). Tags describe format features only: never the real test's
  //     difficulty, never a score forecast (note D1 §6.0, §6.9 #2). Notes are plain words for the Library, e.g. where
  //     only test takers' reports exist ("not documented officially", note D1 addendum A.4 row 7).
  //   set: { param, size(params, seed) → n }: several questions about one figure (Painted Cubes, note D1 §6.3); param
  //     is one of extraParams (the question's index, 0 first) and size is pure and cheap (n from 1 to SET_MAX).
  var RANGE_TAGS = ['below', 'test', 'beyond'];
  var SET_MAX = 5;
  function checkWave3(d, id) {
    if (d.testRange === undefined || d.testRange === null) d.testRange = null;
    else {
      var R = d.testRange, out = { dims: {}, variants: {}, notes: {} };
      if (!isPlainObj(R)) fail(id, 'testRange must be { dims, variants, notes }');
      Object.keys(R).forEach(function (k) { if (['dims', 'variants', 'notes'].indexOf(k) < 0) fail(id, 'testRange.' + k + ' is not part of a test range (dims, variants, notes)'); });
      if (R.dims !== undefined) {
        if (!isPlainObj(R.dims)) fail(id, 'testRange.dims must be { <dim key>: [a tag per level] }');
        Object.keys(R.dims).forEach(function (k) {
          var dim = d.dims.filter(function (x) { return x.key === k; })[0], a = R.dims[k];
          if (!dim) fail(id, 'testRange.dims names "' + k + '", which is not a dim of the exercise');
          if (!Array.isArray(a) || a.length !== dim.levels.length || a.some(function (t) { return RANGE_TAGS.indexOf(t) < 0; })) {
            fail(id, 'testRange.dims.' + k + ' must give one of ' + RANGE_TAGS.join(', ') + ' for each of its ' + dim.levels.length + ' levels');
          }
          out.dims[k] = Object.freeze(a.slice());
        });
      }
      if (R.variants !== undefined) {
        if (!d.variants || !isPlainObj(R.variants)) fail(id, 'testRange.variants must be { <variant>: tag }, for an exercise with variants');
        Object.keys(R.variants).forEach(function (v) {
          if (d.variants.indexOf(v) < 0) fail(id, 'testRange.variants names "' + v + '", which is not a variant of the exercise');
          if (RANGE_TAGS.indexOf(R.variants[v]) < 0) fail(id, 'testRange.variants.' + v + ' must be one of ' + RANGE_TAGS.join(', '));
          out.variants[v] = R.variants[v];
        });
      }
      if (!Object.keys(out.dims).length && !Object.keys(out.variants).length) fail(id, 'testRange must tag at least one dim or variant');
      if (R.notes !== undefined) {
        if (!isPlainObj(R.notes)) fail(id, 'testRange.notes must be { <dim key | variant | "*">: text }');
        Object.keys(R.notes).forEach(function (k) {
          if (k !== '*' && !out.dims[k] && !hasOwn.call(out.variants, k)) fail(id, 'testRange.notes names "' + k + '", which the test range does not tag (a dim key, a variant or "*")');
          if (!isStr(R.notes[k]) || R.notes[k].length > 240) fail(id, 'testRange.notes.' + k + ' must be plain text of at most 240 characters');
          out.notes[k] = R.notes[k];
        });
      }
      // at least one combination inside the test range, or "test range only" would have nothing to play: a 'test'
      // level on every tagged dim and a variant that is not tagged below or beyond
      var dimsOk = Object.keys(out.dims).every(function (k) { return out.dims[k].indexOf('test') >= 0; });
      var varOk = !d.variants || d.variants.some(function (v) { return !hasOwn.call(out.variants, v) || out.variants[v] === 'test'; });
      if (!dimsOk || !varOk) fail(id, 'testRange tags no combination as test (every tagged dim needs a test level, and a variant must be test or untagged)');
      d.testRange = Object.freeze({ dims: Object.freeze(out.dims), variants: Object.freeze(out.variants), notes: Object.freeze(out.notes) });
    }
    if (d.set === undefined || d.set === null) d.set = null;
    else {
      if (!isPlainObj(d.set)) fail(id, 'set must be { param, size(params, seed) }');
      if (typeof d.set.param !== 'string' || d.extraParams.indexOf(d.set.param) < 0) fail(id, 'set.param must name one of extraParams (the question index the generator reads)');
      if (!isFn(d.set.size)) fail(id, 'set.size(params, seed) must be a function');
      d.set = Object.freeze({ param: d.set.param, size: d.set.size });
    }
  }
  // rangeTag(def, params) → 'below' | 'test' | 'beyond', or null when the exercise declares no test range: 'beyond'
  // when a tagged dim level or the variant is beyond the test, else 'below' when one is below it, else 'test'
  // (untagged dims and variants are neutral).
  function rangeTag(defOrId, params) {
    var d = typeof defOrId === 'string' ? defs[defOrId] : defOrId, R = d && d.testRange, below = false, k, t;
    if (!d || !R || !params || typeof params !== 'object') return null;
    for (k in R.dims) {
      if (!hasOwn.call(R.dims, k)) continue;
      t = R.dims[k][params[k]];
      if (t === 'beyond') return 'beyond';
      if (t === 'below') below = true;
    }
    if (d.variants && typeof params.variant === 'string' && hasOwn.call(R.variants, params.variant)) {
      t = R.variants[params.variant];
      if (t === 'beyond') return 'beyond';
      if (t === 'below') below = true;
    }
    return below ? 'below' : 'test';
  }
  // setSize(def, params, seed) → how many questions the figure of this seed has (1 without a set; at most SET_MAX)
  function setSize(defOrId, params, seed) {
    var d = typeof defOrId === 'string' ? defs[defOrId] : defOrId, n = 1;
    if (!d || !d.set) return 1;
    try { n = d.set.size(params, seed); } catch (e) { n = 1; }
    return Number.isInteger(n) ? Math.max(1, Math.min(SET_MAX, n)) : 1;
  }

  // The produce variant (layers.produce) never moves the level scale (conflict 12 of CONTRACT-v1.2):
  // the range and, in js/engine/model.js, the reference guessing rate leave it out.
  function produceOf(d) { return d.layers && typeof d.layers.produce === 'string' ? d.layers.produce : null; }

  function define(input) {
    var d = check(input);
    if (defs[d.id]) fail(d.id, 'this id is already defined');
    for (var k in defs) {
      if (defs[k].code === d.code) fail(d.id, 'code ' + d.code + ' is already used by "' + k + '"');
    }
    Object.freeze(d.abilities);
    if (d.variants) Object.freeze(d.variants);
    if (d.trainVariants) Object.freeze(d.trainVariants);
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
    ['mount', 'unmount', 'showMe', 'demo', 'collect', 'drawOption', 'reveal', 'layoutFor'].forEach(function (fn) {
      if (v[fn] !== undefined && !isFn(v[fn])) throw new Error(where + fn + ' must be a function or left out');
    });
    // v1.2 wave 2 (CONTRACT-v1.2 S): layoutFor(item) → 'custom' gives one item of a stem+options view its
    // own input (a draw-the-answer variant); the view then collects and reveals that item itself
    if (v.layoutFor !== undefined) {
      if (v.layout !== 'stem+options') throw new Error(where + 'layoutFor is for stem+options views (a custom view collects every item)');
      if (!isFn(v.collect) || !isFn(v.reveal)) throw new Error(where + 'layoutFor needs collect(…) and reveal(…) for the items it gives their own input');
    }
    // v1.2 milestone 8 (CONTRACT-v1.2 W1): optionKeys 'letters' letters a stem+options view's options A–E (keys A–E
    // and 1–5); 'digits' (the default) numbers them
    if (v.optionKeys !== undefined) {
      if (v.optionKeys !== 'letters' && v.optionKeys !== 'digits') throw new Error(where + 'optionKeys must be "letters" or "digits"');
      if (v.layout !== 'stem+options') throw new Error(where + 'optionKeys is for stem+options views (a custom view draws its own input)');
      var nMax = defs[id].nOptions;
      if (v.optionKeys === 'letters' && nMax > 5) throw new Error(where + 'optionKeys "letters" holds at most five options (A–E; the exercise has ' + nMax + ')');
    }
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
      ix = Number.isInteger(ix) ? ix : 0;
      b += dim.at ? (ix >= 0 && ix < dim.at.length ? dim.at[ix] : 0) : dim.step * ix;
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
        if (dim.at) { // per-level contributions (v1.2): the smallest and the largest
          lo += Math.min.apply(null, dim.at);
          hi += Math.max.apply(null, dim.at);
          return;
        }
        var span = dim.step * (dim.levels.length - 1);
        lo += Math.min(0, span);
        hi += Math.max(0, span);
      });
    } else {
      // Exact for up to 5 000 combinations; over the deterministic sample beyond that, with the
      // corners (every dim at its first, then its last level) of every scale variant.
      lo = Infinity; hi = -Infinity;
      var prod = produceOf(d);
      var seen = function (p) {
        if (prod !== null && p.variant === prod) return;
        var b = d.difficulty(p);
        if (b < lo) lo = b;
        if (b > hi) hi = b;
      };
      enumerate(d).forEach(seen);
      if (prod !== null) {
        d.variants.forEach(function (v) {
          if (v === prod) return;
          [false, true].forEach(function (top) {
            var p = { variant: v };
            d.dims.forEach(function (dim) { p[dim.key] = top ? dim.levels.length - 1 : 0; });
            seen(p);
          });
        });
      }
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
  PX.ex.BETS = BETS;
  PX.ex.ENUM_LIMIT = ENUM_LIMIT;
  PX.ex.ENUM_SAMPLE = ENUM_SAMPLE;
  PX.ex.rangeTag = rangeTag; // v1.2 milestone 8 (CONTRACT-v1.2 W3)
  PX.ex.RANGE_TAGS = RANGE_TAGS;
  PX.ex.setSize = setSize;   // v1.2 milestone 8 (CONTRACT-v1.2 W4)
  PX.ex.SET_MAX = SET_MAX;
})(window.PX);
