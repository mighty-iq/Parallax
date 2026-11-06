/* PR-5 Level (probe): water lines and plumb lines in tilted frames.
   Pure (ARCHITECTURE.md §5); PLAN.md §4; research/B-tasks.md §12 and §14b (P5). Never trained, no feedback.

   Task. water: a tapered glass, tilted, partly full: which line shows the water surface? (true: horizontal
   on the page). plumb: a weight hangs on a string from a pin inside a tilted square frame: which line shows
   the string? (true: vertical on the page). Four pictures show the same glass or frame with one line each;
   key: index of the right option (0–3).

   Page coordinates: x right, y up (an SVG view flips y), the container centred on the origin and turned by
   tilt degrees counterclockwise. Every line passes through the same anchor (water: the glass axis at the
   fill height, so every option holds about the same amount of water; plumb: the pin), so only the angle
   differs. dev = the line's signed angle from the true direction, counterclockwise, in degrees.
   Foils (errors reported in the water-level literature, B-tasks §12, and their plumb analogues):
     frame   parallel to the glass base (water) / to the frame's sides (plumb): dev = tilt (always shown)
     side    perpendicular to one side wall of the glass (water): dev = tilt ± taper
     beyond  past the frame direction: dev = 1.5 × tilt;  steep: twice the frame's turn, dev = 2 × tilt
     half    halfway between the true direction and the frame: dev = tilt / 2
     over    corrected too far, the other way: dev = −tilt / 2
     near    the closest foil, at the level's gap (+ up to 15 %) on either side
   Every foil is at least the level's gap from the true direction (and at most 80° from it), the nearest
   within 15 % of the gap; options are at least max(3°, gap / 3) apart. Among the sets that fit, one is
   drawn so that the key is the stem-blind "middle angle" pick (nearest the mean angle) about 1/4 of the
   time and the "odd one out" (farthest from it) about 1/4, where the level allows; the "parallel to the
   base" pick is always the frame foil. Tilt bins start at the largest gap, so the frame foil always fits.

   Item (JSON):
     { ex: 'level', seed, params, key, task: 'water' | 'plumb', tilt,
       outline: [[x, y], …],        the glass (base left, base right, rim right, rim left) or the frame
       anchor: [x, y],              the point every line passes through
       bob: r | null,               plumb: the weight's radius, drawn at each option's second point
       options: [{ dev, kind, p: [[x, y], [x, y]] }] }
              water: p = where the line meets the left and right walls (the water lies below it);
              plumb: p = [pin, centre of the weight]
   validate (independent of the labels): re-measures every drawn line against the page and the outline:
   exactly one within 1° of the true direction, every foil at least the gap away, the frame foil parallel
   to the drawn base (or sides), lines on the walls and through the anchor, the weight inside the frame. */
(function (PX) {
  'use strict';

  /* ------------------------------------------------------------------ deterministic maths */
  // Only + − × ÷ and Math.sqrt; Math.sin and Math.cos may differ in the last bit between engines.
  // Globals are cached: a lookup of Math in a hot loop is about 100× slower in the tests' vm context.
  var sqrt = Math.sqrt, abs = Math.abs, min = Math.min, max = Math.max, round = Math.round;
  var DEG = Math.PI / 180;
  function sincos(deg) {   // [sin, cos] of an angle in degrees
    var q = round(deg / 90), y = (deg - q * 90) * DEG, y2 = y * y;
    var s = y * (1 - y2 / 6 * (1 - y2 / 20 * (1 - y2 / 42 * (1 - y2 / 72 * (1 - y2 / 110 * (1 - y2 / 156))))));
    var c = 1 - y2 / 2 * (1 - y2 / 12 * (1 - y2 / 30 * (1 - y2 / 56 * (1 - y2 / 90 * (1 - y2 / 132)))));
    q = ((q % 4) + 4) % 4;
    return q === 0 ? [s, c] : q === 1 ? [c, -s] : q === 2 ? [-s, -c] : [-c, s];
  }
  function r1(x) { return round(x * 10) / 10; }
  function r4(x) { return round(x * 10000) / 10000; }
  function rot(p, deg) { var a = sincos(deg); return [p[0] * a[1] - p[1] * a[0], p[0] * a[0] + p[1] * a[1]]; }
  function page(p, deg) { var q = rot(p, deg); return [r4(q[0]), r4(q[1])]; }

  /* ------------------------------------------------------------------ levels and shapes */
  var TASKS = ['water', 'plumb'];
  var TILT_BINS = [[16, 20], [26, 30], [36, 40], [46, 50]];
  var GAPS = [16, 10, 6, 4];
  var GLASS = { base: 0.95, top: 1.6, height: 2.4, fill: [0.42, 0.58], margin: 0.14 };
  var FRAME = { size: 2.2, pin: 0.14, string: 1.0, bob: 0.09, margin: 0.05 };
  var TAPER = 7.7;   // the walls' lean from the axis: atan((top − base) / 2 / height), to 0.1° (checked by the tests)
  var MIDDLE_P = 0.25;
  function tolOf(g) { return max(1, r1(0.15 * g)); }
  function sepOf(g) { return max(3, g / 3); }

  // Line through anchor a (container coordinates) at container angle rho meets the glass walls: [left, right], or null.
  function wallHits(a, rho) {
    var sc = sincos(rho), d = [sc[1], sc[0]], H = GLASS.height, out = [], sides = [-1, 1];
    for (var k = 0; k < 2; k++) {
      var sx = sides[k], p0 = [sx * GLASS.base / 2, -H / 2], p1 = [sx * GLASS.top / 2, H / 2], e = [p1[0] - p0[0], p1[1] - p0[1]];
      // a + t d = p0 + s e  →  s = ((a − p0) × d) / (e × d)
      var den = e[0] * d[1] - e[1] * d[0];
      if (abs(den) < 1e-9) return null;
      var s = ((a[0] - p0[0]) * d[1] - (a[1] - p0[1]) * d[0]) / den;
      var m = GLASS.margin / H;
      if (!(s >= m && s <= 1 - m)) return null;
      out.push([p0[0] + s * e[0], p0[1] + s * e[1]]);
    }
    return out;
  }
  // Weight centre (container coordinates) for a page deviation dev, or null when it would touch the frame.
  function bobAt(pin, tilt, dev) {
    var down = sincos(dev), d = rot([down[0], -down[1]], -tilt), L = FRAME.string;
    var b = [pin[0] + L * d[0], pin[1] + L * d[1]], lim = FRAME.size / 2 - FRAME.bob - FRAME.margin;
    return abs(b[0]) <= lim && abs(b[1]) <= lim ? b : null;
  }
  // Page segment of an option, or null when it does not fit.
  function segment(task, tilt, anchor, dev) {
    if (task === 'water') {
      var h = wallHits(anchor, dev - tilt);
      return h ? [page(h[0], tilt), page(h[1], tilt)] : null;
    }
    var b = bobAt(anchor, tilt, dev);
    return b ? [page(anchor, tilt), page(b, tilt)] : null;
  }
  function outlineOf(task, tilt) {
    var w = task === 'water' ? null : FRAME.size / 2, H = GLASS.height / 2;
    var pts = task === 'water'
      ? [[-GLASS.base / 2, -H], [GLASS.base / 2, -H], [GLASS.top / 2, H], [-GLASS.top / 2, H]]
      : [[-w, -w], [w, -w], [w, w], [-w, w]];
    return pts.map(function (q) { return page(q, tilt); });
  }

  /* ------------------------------------------------------------------ generate */
  function lvl(params, key, n) { var v = params ? params[key] : 0; return Number.isInteger(v) && v >= 0 && v < n ? v : 0; }
  function cleanParams(params) { return { tilt: lvl(params, 'tilt', TILT_BINS.length), task: lvl(params, 'task', TASKS.length), gap: lvl(params, 'gap', GAPS.length) }; }

  // Candidate foils (dev rounded to 0.1°) before the fit and gap filters.
  function candidates(task, tilt, g, jitter) {
    var list = [
      { kind: 'frame', dev: tilt },
      { kind: 'half', dev: r1(tilt / 2) },
      { kind: 'over', dev: r1(-tilt / 2) },
      { kind: 'near', dev: r1(g + jitter) },
      { kind: 'near', dev: r1(-g - jitter) },
    ];
    if (task === 'water') list.push({ kind: 'side', dev: r1(tilt + TAPER) }, { kind: 'side', dev: r1(tilt - TAPER) });
    list.push({ kind: 'beyond', dev: r1(1.5 * tilt) }, { kind: 'steep', dev: 2 * tilt });
    return list.filter(function (c) { return abs(c.dev) <= 80; });
  }
  // The key's place for the stem-blind picks (devs[0] is the key; ties count for the key): 'middle' when
  // it is the option nearest the mean angle, 'odd' when it is the farthest from it, else 'none'.
  function keyRole(devs) {
    var m = (devs[0] + devs[1] + devs[2] + devs[3]) / 4, near = 0, far = 0;
    for (var i = 1; i < 4; i++) {
      if (abs(devs[i] - m) < abs(devs[near] - m)) near = i;
      if (abs(devs[i] - m) > abs(devs[far] - m)) far = i;
    }
    return near === 0 ? 'middle' : far === 0 ? 'odd' : 'none';
  }

  var stats = { tries: 0, nulls: 0, invalid: 0, fallbacks: 0, why: {}, lastInvalid: null };
  function no(reason) { stats.why[reason] = (stats.why[reason] || 0) + 1; return null; }
  function generateOnce(r, p) {
    var task = TASKS[p.task], bin = TILT_BINS[p.tilt], g = GAPS[p.gap], tol = tolOf(g), gapMin = sepOf(g), i, j, k;
    var tilt = r.int(bin[0], bin[1]) * (r.chance(0.5) ? 1 : -1);
    var anchor = task === 'water' ? [0, r4(GLASS.height * (r.float(GLASS.fill[0], GLASS.fill[1]) - 0.5))] : [0, FRAME.size / 2 - FRAME.pin];
    var keySeg = segment(task, tilt, anchor, 0);
    if (!keySeg) return no('key');
    var jitter = r1(r.float(0, tol));
    var cands = candidates(task, tilt, g, jitter).filter(function (c) { return abs(c.dev) >= g && (c.seg = segment(task, tilt, anchor, c.dev)); });
    // Sets of three foils: the frame foil in, the nearest within [g, g + tol], all pairwise ≥ gapMin apart.
    var sets = [];
    for (i = 0; i < cands.length; i++) for (j = i + 1; j < cands.length; j++) for (k = j + 1; k < cands.length; k++) {
      var S = [cands[i], cands[j], cands[k]], devs = [0, S[0].dev, S[1].dev, S[2].dev];
      if (!S.some(function (c) { return c.kind === 'frame'; })) continue;
      if (min(abs(devs[1]), abs(devs[2]), abs(devs[3])) > g + tol + 1e-9) continue;
      if (abs(devs[1] - devs[2]) < gapMin || abs(devs[1] - devs[3]) < gapMin || abs(devs[2] - devs[3]) < gapMin) continue;
      sets.push({ S: S, role: keyRole(devs) });
    }
    if (!sets.length) return no('sets');
    // Target role for the key: middle 1/4, odd 1/4, neither 1/2; an impossible target falls back to 'none'.
    var u = r.next(), want = u < MIDDLE_P ? 'middle' : u < 2 * MIDDLE_P ? 'odd' : 'none';
    var of = function (role) { return sets.filter(function (x) { return x.role === role; }); };
    var pool = of(want);
    if (!pool.length) pool = of('none');
    var pick = r.pick(pool.length ? pool : sets).S;
    var opts = [{ dev: 0, kind: 'true', p: keySeg }].concat(pick.map(function (c) { return { dev: c.dev, kind: c.kind, p: c.seg }; }));
    var order = r.shuffle([0, 1, 2, 3]);
    return {
      key: order.indexOf(0), task: task, tilt: tilt, outline: outlineOf(task, tilt), anchor: page(anchor, tilt),
      bob: task === 'plumb' ? FRAME.bob : null, options: order.map(function (n) { return opts[n]; }),
    };
  }

  /* ------------------------------------------------------------------ validate and score */
  function vsub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function vlen(a) { return sqrt(a[0] * a[0] + a[1] * a[1]); }
  function vcross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
  function lineDist(p, a, b) { var e = vsub(b, a); return abs(vcross(e, vsub(p, a))) / vlen(e); }
  function validate(item) {
    if (!item || item.ex !== 'level') return 'not a level item';
    var p = cleanParams(item.params), task = TASKS[p.task], bin = TILT_BINS[p.tilt], g = GAPS[p.gap], tol = tolOf(g), i, j;
    if (item.task !== task) return 'the task does not match its level';
    if (!Number.isInteger(item.tilt) || abs(item.tilt) < bin[0] || abs(item.tilt) > bin[1]) return 'the tilt is outside its level';
    var O = item.outline, ref = outlineOf(task, item.tilt);
    if (!Array.isArray(O) || O.length !== 4 || O.some(function (q, n) { return vlen(vsub(q, ref[n])) > 1e-3; })) return 'the outline is not the level\'s container';
    var opts = item.options;
    if (!Array.isArray(opts) || opts.length !== 4 || !Number.isInteger(item.key) || item.key < 0 || item.key > 3) return 'four options and a key are needed';
    // Re-measure every drawn line: sine of its angle from the true direction (water: horizontal, left to
    // right; plumb: straight down from the pin).
    var sines = [];
    for (i = 0; i < 4; i++) {
      var a = opts[i].p[0], b = opts[i].p[1], e = vsub(b, a), L = vlen(e);
      if (!(L > 0.2)) return 'option ' + i + ' is too short';
      if (task === 'water' ? e[0] <= 0 : e[1] >= 0) return 'option ' + i + ' points the wrong way';
      var sn = task === 'water' ? e[1] / L : e[0] / L;
      if (abs(sn - sincos(opts[i].dev)[0]) > 0.002) return 'option ' + i + ' is not drawn at its angle';
      sines.push(sn);
    }
    var within1 = [];
    for (i = 0; i < 4; i++) if (abs(sines[i]) <= sincos(1)[0]) within1.push(i);
    if (within1.length !== 1 || within1[0] !== item.key) return 'exactly one line must be within 1° of the true direction, the key';
    var nearest = 90;
    for (i = 0; i < 4; i++) if (i !== item.key) {
      if (abs(sines[i]) < sincos(g - 0.05)[0]) return 'option ' + i + ' is closer than the ' + g + '° gap';
      nearest = min(nearest, abs(opts[i].dev));
    }
    if (nearest > g + tol + 0.05) return 'the nearest foil is ' + nearest + '°, not about ' + g + '°';
    for (i = 0; i < 4; i++) for (j = i + 1; j < 4; j++) if (abs(opts[i].dev - opts[j].dev) < sepOf(g) - 0.05) return 'options ' + i + ' and ' + j + ' are too alike';
    // The frame foil: parallel to the drawn base (water) or to the drawn sides (plumb).
    var ref2 = task === 'water' ? vsub(O[1], O[0]) : vsub(O[0], O[3]), par = 0;
    for (i = 0; i < 4; i++) {
      var d2 = vsub(opts[i].p[1], opts[i].p[0]);
      if (abs(vcross(d2, ref2)) / vlen(d2) / vlen(ref2) < sincos(0.2)[0]) par++;
    }
    if (par !== 1) return 'exactly one option must be parallel to the ' + (task === 'water' ? 'base' : 'sides');
    // Geometry: water lines end on the walls and pass through the anchor; the weight hangs inside the frame.
    for (i = 0; i < 4; i++) {
      var q = opts[i].p;
      if (task === 'water') {
        if (lineDist(item.anchor, q[0], q[1]) > 2e-3) return 'option ' + i + ' misses the anchor';
        if (lineDist(q[0], O[0], O[3]) > 2e-3 || lineDist(q[1], O[1], O[2]) > 2e-3) return 'option ' + i + ' does not end on the walls';
        var m = GLASS.margin - 2e-3;
        if (lineDist(q[0], O[0], O[1]) < m || lineDist(q[0], O[3], O[2]) < m || lineDist(q[1], O[0], O[1]) < m || lineDist(q[1], O[3], O[2]) < m) return 'option ' + i + ' ends too near the base or the rim';
      } else {
        if (vlen(vsub(q[0], item.anchor)) > 2e-3) return 'option ' + i + ' does not hang from the pin';
        for (j = 0; j < 4; j++) {
          var A = O[j], B = O[(j + 1) % 4];
          if (vcross(vsub(B, A), vsub(q[1], A)) / vlen(vsub(B, A)) < FRAME.bob + FRAME.margin - 2e-3) return 'option ' + i + ': the weight touches the frame';
        }
      }
    }
    return true;
  }

  function score(item, response) { return { correct: response === item.key }; }

  function attempt(r, p) {
    stats.tries++;
    var core = generateOnce(r, p);
    if (!core) { stats.nulls++; return null; }
    var item = { ex: 'level', seed: 0, params: p };
    for (var k in core) item[k] = core[k];
    var ok = validate(item);
    if (ok !== true) { stats.invalid++; stats.lastInvalid = ok; return null; }
    return item;
  }
  function fallback(p) {   // fixed seeds per params (the tests check every combination)
    stats.fallbacks++;
    for (var k = 0; k < 500; k++) {
      var item = attempt(PX.rng(PX.rng.hash('level-fallback', p.tilt, p.task, p.gap, k)), p);
      if (item) { item.fallback = true; return item; }   // the engine voids fallback trials (ARCHITECTURE §5)
    }
    throw new Error('level: no valid item could be built');
  }
  function generate(rng, params) {
    var p = cleanParams(params), item = null;
    for (var i = 0; i < 50 && !item; i++) item = attempt(i === 0 ? rng : rng.fork('retry' + i), p);
    if (!item) item = fallback(p);
    item.seed = rng.seed;
    item.params = params ? PX.util.deepCopy(params) : p;
    return item;
  }

  PX.ex.define({
    id: 'level', version: 1, code: 'PR-5', name: 'Level', short: 'Level',
    abilities: ['Vz'], cell: 'extrinsic-static', role: 'probe', answer: 'choice', nOptions: 4,
    // Hand-set item model (DJ, no pilot yet): base + Σ step × level; the gap to the nearest foil dominates.
    dims: [
      { key: 'tilt', label: 'Tilt', levels: ['about 18°', 'about 28°', 'about 38°', 'about 48°'], step: 0.35 },
      { key: 'task', label: 'Task', levels: ['water line', 'plumb line'], step: 0.25 },
      { key: 'gap', label: 'Closest wrong line', levels: ['16° off', '10° off', '6° off', '4° off'], step: 0.95 },
    ],
    base: -2.2,
    timeLimit: function () { return 20000; },
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      TASKS: TASKS, TILT_BINS: TILT_BINS, GAPS: GAPS, GLASS: GLASS, FRAME: FRAME, TAPER: TAPER, MIDDLE_P: MIDDLE_P,
      sincos: sincos, tolOf: tolOf, sepOf: sepOf, wallHits: wallHits, bobAt: bobAt, segment: segment, outlineOf: outlineOf,
      candidates: candidates, keyRole: keyRole, cleanParams: cleanParams, generateOnce: generateOnce, fallback: fallback, stats: stats,
    },
  });
})(window.PX);
