/* EX-18 Painted Cubes: how many cubes have exactly N painted sides? (pure; ARCHITECTURE.md §5,
   docs/research/v1.1/R3-dat-pat.md §3.5, §8.4; version 3: docs/research/v1.2/D1-pat-formats.md §2.5, §6.3
   and its addendum A.1 rows 6–8).

   The figure. Equal cubes stacked on a G × G grid as a height map heights[z][x] (x = 0 left …
   G − 1 right, z = 0 back … G − 1 front, y up; 1–4 high), with a 4-connected footprint: every
   cube stands on the ground or on another cube. The figure is painted on every exposed side
   except the bottom it rests on, so a cube's painted sides are its top (when nothing sits on it)
   and each of its four sides with no neighbour: 0–5. Cubes carry no marks at all: oriented marks
   on cubes belong to the Spatial Check's Cube Match probe (R3 §5.3).

   The view. A parallel (axonometric) projection from the front right, 31° round from the front
   and 33.5° above the ground. Not isometric: in true isometric a cube one step right, up and
   forward lands on the same spot, so a column can pass for a shorter one in front of it. At this
   angle no two cube positions of a 5 × 5 × 4 figure come closer than 0.348 cube edges on screen
   (the node test searches every pair; cube corners can come within 0.12 edges). The official
   sample is drawn in another projection, so no single view is "the" test look (note D1 addendum
   A.1 row 8); view.js draws the format's plain line drawing (white faces, black edges) in the
   test range and keeps the three face tones for the starter band and show me.

   The rules the viewer relies on (taught in learn.js): a cube out of sight is there only to hold
   up others. So every column's top cube must be visible: the generator renders the figure into a
   software z-buffer and keeps it only when at least half of every column's top face shows, and
   validate checks the same with its own ray cast (8 × 8 rays per face; RV-dat-style-A §13), so
   the visible tops fix every column's height and the figure has exactly one reading.

   One figure, several questions (version 3; the format asks 2 to 5 questions about each figure,
   about 3, note D1 §2.5, §6.3). Every figure carries its questions, item.asks, and params.ask (an
   extra param, not a dim) picks the i-th; the figure never depends on it, so the seed, the params
   and ask regenerate one question about one figure (Section practice, and Train, Path and Free
   play once the planner holds a figure: def.set, CONTRACT request of 19 Nov 09:41 UTC). How many
   questions a figure has follows from the seed and the level alone (setSize, def.set.size): one at
   4–6 cubes (the starter band's single question), otherwise two or three, and four on some figures
   that ask about five painted sides (below; SET_P, FOUR_FROM). asks[0] is the item's own question:
   N from the level's class, its count k drawn evenly from N's range first (KRANGE), then figures
   with exactly k such cubes are searched (a failed search keeps N and k), so neither N nor the
   figure's size points to an answer. The other questions are other N whose count lies in N's
   range, each kept with a probability that evens out its answers per size (NAT, KEEP); a figure
   that cannot carry its number of questions is redrawn. Their answers are even per number asked
   over all sizes (no answer above 30 %), not within each size, where the geometry makes some
   counts rare (18–22 cubes rarely have exactly three cubes with two painted sides): drawing their
   counts first like the first question's made the search about five times slower and still fell
   back on the rare ones (spike, 19 Nov); the planner does not rate them (they reuse the tally).
   Every question, not only the first, is held near chance on the novice errors: counting cubes
   that *show* N painted faces in the picture (Kurtuluş & Yolcu 2013), redrawn three times in four
   when it gives the count, and counting the bottom of ground cubes as painted, redrawn half the
   time. Counting visible cubes only (hidden supports missed) and column tops only are partial
   counts, not cheap heuristics: each needs every painted side counted right; the first is redrawn
   VO_REDRAW of the time, and both are held at caps per level in the test (O57; DECISIONS).

   Five painted sides (version 3; the official sheet lists questions from one to all five painted
   sides, note D1 addendum A.1 row 6). A cube has five painted sides only on top of a column taller
   than all four of its neighbours, and random figures rarely hold more than one such column (1 / 2 /
   3 at about 80 / 17 / 3 % of those with any), so asking it of random figures would make "1 cube"
   the safe answer (82 %, RV-dat-style-A §5). From 10 cubes up, FIVE_SHARE of the stacked figures ask
   it as a later question: its count is drawn evenly from 1–3 first and the figure is built with
   exactly that many such columns (peakFigure), so each answer is a third of them. Four such columns
   rarely fit a figure whose every top shows (under 1 % of constructions below 18 cubes, about 4 %
   at 18–22; spike, 19 Nov), so "the most common answer" for this question sits at 33 % against
   the 30 % bound of chance + 10: a scoped exception (DECISIONS), held at 38 % in the test. The
   figure's first question stays from the level's class (3–4 or 1–2 painted sides).

   Dims (hand-set; refit from pooled exports): cubes 4–6, 6–9, 10–13, 14–17, 18–22 (0.85: accuracy
   falls with more cubes and more hidden faces, Kurtuluş & Yolcu 2013; hidden supports come with
   size, since a figure whose every top shows hides only cubes under taller back columns, so they
   are not a separate dim); tallest column 1 ("flat"), 2, 3, 4 (0.3); asked N 3–4 or 1–2 (0.85:
   cubes with few painted sides sit inside the figure or under others, R3 §8.4). The difficulty is
   the first question's: later questions reuse the player's tally of the same figure, so the
   planner rates only the first (note D1 §6.3). Base −2.3: the pre-1.2 floor (6–9 cubes, 2 high,
   N 3–4) is about 90 % right at θ = 0 with 5 options.

   The starter band (v1.2, version 2; docs/research/v1.2/D2-first-band.md §3.3): two levels in
   front. Flat figures (every column one cube high: no cube is hidden and no top is covered, so a
   cube's painted sides are 5 minus the cubes it touches), Δ −0.85; and 4–6 cubes on a 3 × 3 grid,
   Δ −0.7 (the note's 4–5 cubes at −0.85, widened to 6 so that every question there has four
   possible counts, and its Δ scaled to the smaller step in cubes: 2.5 cubes below 6–9 against 3).
   Flat −0.85 (the note: −1.0) prices flat 10–13-cube figures at the pre-1.2 floor, so strong
   beginners leave the band within about 10 items (PLAN milestone 1 acceptance (c), firstband
   test); a population at the pre-1.2 floor gets about 77 % of its first 10 items right. Old
   combinations keep their exact difficulty, so the floor moves from −2.3 to −3.85. Two
   combinations cannot be built at 4–6 cubes, and the generator builds the nearest one that can,
   priced the same (eff(), difficulty()): a question about 1 or 2 painted sides (at most two such
   cubes exist, so the key would be guessable: 4–6 cubes always ask about 3 or 4), and a 4-high
   column (a tower whose counts are nearly fixed: 4–6 cubes stand at most 3 high). Flat figures
   and 4–6 cubes have their own count ranges (KRANGE_FLAT, KRANGE_SMALL, measured like KRANGE).

   Item: { ex: 'cubes', v: 3, seed, params, key, grid, heights, ask: N, count, asks, pos (the
   question's place in asks), options: [1, 2, 3, 4, 5], hidden (cubes with no visible pixel) }.
   key = count − 1; score() returns value = pos (the trial row's value column, as Section logs it). */
(function (PX) {
  'use strict';

  var Mth = Math, floor = Mth.floor, abs = Mth.abs, sqrt = Mth.sqrt, isArray = Array.isArray, isInt = Number.isInteger;

  var CUBES = [[4, 6], [6, 9], [10, 13], [14, 17], [18, 22]];
  var HEIGHT = [1, 2, 3, 4];
  var ASKED = ['many', 'few'];
  var ASK_OF = { many: [3, 4], few: [1, 2] };
  // Difficulty contributions per level (logits): the starter levels in front (Δ, note D2 §3.3),
  // then the 1.1 steps, so every 1.1 combination keeps its difficulty.
  var BASE = -2.3, CUBES_AT = [-0.7, 0, 0.85, 1.7, 2.55], HEIGHT_AT = [-0.85, 0, 0.3, 0.6], ASK_STEP = 0.85;
  // The counts each question can have at each size (measured over random valid figures: every k in
  // the range turns up in at least 3 % of them). The key is drawn evenly from N's range, so the
  // question alone never points to an answer; N without a range of three or more is not asked.
  // N = 5 (all five sides painted) needs a column taller than all four neighbours, which random
  // figures rarely hold more than one of: it is asked only of figures built for it (FIVE below).
  var KRANGE = [                                          // columns 2–4 high
    null,                                                 // 4–6 cubes: KRANGE_SMALL, by height
    { 2: [1, 4], 3: [1, 5], 4: [1, 4] },                  // 6–9 cubes (one painted side: almost never)
    { 1: [1, 3], 2: [1, 5], 3: [1, 5], 4: [1, 5] },       // 10–13
    { 1: [1, 5], 2: [2, 5], 3: [2, 5], 4: [1, 5] },       // 14–17
    { 1: [1, 5], 2: [3, 5], 3: [3, 5], 4: [1, 5] },       // 18–22
  ];
  // 4–6 cubes 2 or 3 high (v1.2 spike, 20,000 random figures each): one question, the one whose
  // count has an even range of four there (2 high: 4 painted sides; 3 high: 3). With 4–5 cubes no
  // question reaches four counts, so the starter level holds up to 6 (the starter band's own pool
  // keeps "the most common answer for the level and N" at chance + 10 that way).
  var KRANGE_SMALL = { 2: { 4: [1, 4] }, 3: { 3: [1, 4] } };
  // Flat figures (v1.2 spike, 20,000 random flat figures per size): ends (4 painted sides) rarely
  // number four or more, a cube touching four others (1 painted side) needs ten cubes or so, and
  // from about fourteen cubes up most cubes touch three others, so N = 2 has no even range there.
  var KRANGE_FLAT = [
    { 3: [1, 4] },                                        // 4–6 (4 painted sides: at most three)
    { 2: [1, 4], 3: [2, 5], 4: [1, 3] },                  // 6–9
    { 1: [1, 3], 2: [2, 5], 3: [2, 5], 4: [1, 3] },       // 10–13
    { 1: [1, 5], 3: [2, 5], 4: [1, 3] },                  // 14–17
    { 1: [3, 5], 3: [3, 5], 4: [1, 3] },                  // 18–22
  ];
  // Five painted sides (version 3, see the header): from cubes level FIVE_FROM up on stacked figures
  // with two or more questions, FIVE_SHARE of the figures ask it, with its count drawn evenly from
  // FIVE_RANGE and built in (peakFigure).
  var FIVE_FROM = 2, FIVE_SHARE = 0.25, FIVE_RANGE = [1, 3];
  // Questions per figure (version 3), by the kind of level (setKind): one at 4–6 cubes; otherwise
  // two or three (SET_P: the share of three). Where five painted sides is planned (from 10 cubes up
  // on stacked figures, FIVE_SHARE of them) it takes one of those places, and from FOUR_FROM cubes
  // up, with a first question about 3 or 4 painted sides, it comes as a fourth question after
  // three. Four questions need five painted sides: four of the other numbers rarely all have a
  // count in their range on one figure (3.7 % of 18–22-cube figures three high), and on figures
  // built for five painted sides, counts of 1 or 2 painted sides are rare below 14 cubes (spikes,
  // 19 Nov), which made those sets slow to find.
  var SET_P = { pair: 0.4, full: 0.5 }, FOUR_FROM = 3;
  // Counting visible cubes only (hidden supports missed) gives the count: the question is redrawn
  // this often (O57; v1.1 and version 2: 0.6 on the first question only).
  var VO_REDRAW = 0.6;
  // What an item really is: at 4–6 cubes the question is always about 3 or 4 painted sides and the
  // tallest column at most 3 (see the header); everywhere else the params themselves.
  function eff(p) {
    var h = p.height, a = p.asked;
    if (p.cubes === 0) { if (h > 2) h = 2; a = 0; }
    return { cubes: p.cubes, height: h, asked: a, flat: HEIGHT[h] === 1 };
  }
  function krange(p) { var e = eff(p); return e.flat ? KRANGE_FLAT[e.cubes] : e.cubes === 0 ? KRANGE_SMALL[HEIGHT[e.height]] : KRANGE[e.cubes]; }
  // The ranges of a figure built for five painted sides (KRANGE5): stacked, from FIVE_FROM up.
  function krange5(p) { var e = eff(p); return KRANGE5[e.cubes] ? KRANGE5[e.cubes][e.height - 1] : null; }
  // The kind of question set a level gets (see the header): 'one', 'pair' (two or three) or 'full'.
  function setKind(p) { var e = eff(p); return e.cubes === 0 ? 'one' : e.flat || e.cubes === 1 ? 'pair' : 'full'; }
  // How many questions the figure of this seed has: pure and cheap (def.set.size), from the seed and
  // the level alone, so the planner knows it before the item exists. Extra params (ask) are ignored.
  function setOf(params, seed) {
    var p = normParams(params), kind = setKind(p);
    if (kind === 'one') return { m: 1, five: false };
    var r = PX.rng(PX.rng.hash('cubes-set', isFinite(seed) ? seed : 0)), m = r.next() < SET_P[kind] ? 3 : 2;
    var five = fiveOk(p) && r.next() < FIVE_SHARE;
    if (five) {
      // five takes one of the places, or comes fourth after three (from FOUR_FROM up, first question
      // about 3 or 4) where three other numbers have a range on such figures (KRANGE5)
      var nN = Object.keys(krange5(p)).length;
      m = m === 3 && p.asked === 0 && p.cubes >= FOUR_FROM && nN >= 3 ? 4 : Mth.min(m, nN + 1);
    }
    return { m: m, five: five };
  }
  function setSize(params, seed) { return setOf(params, seed).m; }
  // Five painted sides can be asked at this level (a stacked figure from FIVE_FROM up).
  function fiveOk(p) { var e = eff(p); return !e.flat && e.cubes >= FIVE_FROM; }
  // Later questions about the same figure (params.ask ≥ 1; version 3 in every mode). NAT: how
  // often each count 1–5 turns up for a candidate later question N at each size (per mille of the
  // generator's accepted figures, all heights and classes pooled; measured on version 3's own
  // figures). Only N in KRANGE at that size with a count in its range is asked later, and it is kept
  // with probability KEEP[size][N][count], which aims at no count above 26 % of that question's
  // later answers (a range of three counts made even). The redraws for the novice errors then
  // select among figures too, so the test bounds the result per number asked over all sizes (as
  // 1.1 did for Section practice), where neither "1 cube" nor any other answer is a safe guess for
  // a later question (RV-dat-style-A §5).
  var NAT = [ // version 3's own figures, without five painted sides (spike, 19 Nov: 9,600 figures)
    null,                                                     // 4–6: one question per figure
    { 2: [314, 269, 181, 94, 0], 3: [236, 239, 224, 211, 85], 4: [134, 326, 352, 149, 1] },
    { 1: [390, 190, 102, 2, 0], 2: [107, 211, 264, 251, 144], 3: [40, 109, 197, 283, 267], 4: [106, 247, 269, 264, 101] },
    { 1: [241, 286, 253, 172, 31], 2: [12, 85, 150, 191, 258], 3: [1, 50, 98, 199, 276], 4: [80, 214, 251, 304, 135] },
    { 1: [36, 118, 235, 296, 265], 2: [0, 3, 39, 80, 174], 3: [0, 8, 61, 135, 231], 4: [69, 159, 247, 302, 186] },
  ];
  var NAT_FLAT = [ // the same for flat figures
    null,                                                     // 4–6: one question per figure
    { 2: [297, 230, 307, 133, 3], 3: [11, 333, 330, 193, 131], 4: [334, 347, 183, 2, 0] },
    { 1: [346, 321, 259, 0, 0], 2: [11, 66, 188, 217, 345], 3: [4, 113, 180, 363, 243], 4: [473, 293, 105, 2, 0] },
    { 1: [177, 243, 330, 207, 40], 3: [2, 103, 191, 331, 263], 4: [306, 381, 221, 5, 2] },
    { 1: [3, 3, 240, 243, 290], 3: [0, 16, 263, 333, 342], 4: [327, 399, 242, 11, 2] },
  ];
  // Figures built for five painted sides (version 3, peakFigure) have counts of their own: few cubes
  // with one painted side below 18 cubes, few with four on low figures, and they shift with the
  // number of five-sided columns. KRANGE5 holds the counts every such figure can give (by cubes
  // level 2–4, then height level 1–3): each count of a range turns up in at least 3 % of the figures
  // in view for one, two and three five-sided columns alike, at least three counts (2,500 figures
  // per level and number; spike, 19 Nov). NAT5: their per-mille counts 1–5, averaged over the three,
  // for KEEP5. Such a figure's first question is an N of the level's class with a range here, its
  // count drawn evenly from it; its other questions use these ranges too.
  var KRANGE5 = [null, null,
    [{ 2: [2, 5], 3: [3, 5] }, { 2: [1, 5], 3: [3, 5], 4: [1, 3] }, { 2: [1, 4], 3: [3, 5], 4: [2, 4] }],
    [{ 2: [3, 5], 3: [3, 5] }, { 2: [2, 5], 3: [3, 5], 4: [1, 4] }, { 2: [2, 5], 3: [3, 5], 4: [1, 5] }],
    [{ 1: [1, 4], 3: [3, 5], 4: [1, 3] }, { 1: [1, 4], 3: [3, 5], 4: [1, 4] }, { 1: [1, 3], 2: [3, 5], 3: [3, 5], 4: [2, 5] }],
  ];
  var NAT5 = [null, null,
    [{ 2: [106, 127, 295, 176, 180], 3: [10, 72, 142, 235, 218] }, { 2: [207, 235, 262, 151, 87], 3: [11, 53, 171, 218, 278], 4: [305, 402, 216, 35, 3] }, { 2: [347, 239, 214, 93, 39], 3: [13, 56, 158, 250, 271], 4: [63, 352, 359, 182, 34] }],
    [{ 2: [8, 27, 87, 133, 220], 3: [5, 24, 119, 198, 221] }, { 2: [27, 79, 179, 214, 214], 3: [6, 28, 100, 177, 217], 4: [224, 360, 274, 81, 13] }, { 2: [64, 141, 199, 209, 178], 3: [6, 31, 86, 173, 213], 4: [60, 227, 337, 237, 96] }],
    [{ 1: [181, 186, 161, 142, 110], 3: [3, 14, 69, 153, 205], 4: [443, 228, 45, 5, 1] }, { 1: [204, 221, 204, 139, 86], 3: [1, 16, 61, 130, 201], 4: [156, 342, 315, 137, 30] }, { 1: [246, 235, 163, 120, 55], 2: [8, 25, 71, 127, 174], 3: [3, 18, 59, 107, 182], 4: [45, 173, 303, 277, 135] }],
  ];
  var LATER_MAX = 0.26;
  // The largest cap t with max(min(nat, t)) / Σ min(nat, t) ≤ smax (bisection; the share grows with t).
  function capFor(nat, smax) {
    var lo = Mth.min.apply(null, nat), hi = Mth.max.apply(null, nat);
    var share = function (t) { var s = 0; nat.forEach(function (v) { s += Mth.min(v, t); }); return Mth.min(hi, t) / s; };
    if (share(hi) <= smax) return hi;
    for (var i = 0; i < 50; i++) { var mid = (lo + hi) / 2; if (share(mid) <= smax + 1e-12) lo = mid; else hi = mid; }
    return lo;
  }
  function keepOne(kr, nt) {
    var out = {};
    if (!kr || !nt) return out;
    Object.keys(kr).forEach(function (key) {
      var n = +key, lo = kr[n][0], hi = kr[n][1], nat = nt[n].slice(lo - 1, hi), keep = [0, 0, 0, 0, 0, 0];
      var cap = capFor(nat, Mth.max(LATER_MAX, 1 / nat.length));
      for (var j = lo; j <= hi; j++) keep[j] = nt[n][j - 1] > 0 ? Mth.min(1, cap / nt[n][j - 1]) : 1;
      out[n] = keep;
    });
    return out;
  }
  function keepTables(KR, NT) { return KR.map(function (kr, c) { return keepOne(kr, NT[c]); }); }
  var KEEP = keepTables(KRANGE, NAT), KEEP_FLAT = keepTables(KRANGE_FLAT, NAT_FLAT);
  var KEEP5 = KRANGE5.map(function (byH, c) { return byH ? byH.map(function (kr, h) { return keepOne(kr, NAT5[c][h]); }) : null; });
  var GRIDS = [[3], [3, 4], [4], [4, 5], [5]];
  var OPTIONS = [1, 2, 3, 4, 5];
  var TOP_SHOW = 0.5, CLEAR = 0.2;
  var AZ = 31, EL = 33.5;
  // Camera basis (constants, so items are identical in every engine): d points from the figure to
  // the viewer; R is screen right, U screen up. Values for az 31°, el 33.5°.
  var D = [0.42948294849226226, 0.5519369853120581, 0.7147796591950765];
  var R = [0.8571673007021123, 0, -0.5150380749100542];
  var U = [-0.2842685623867813, 0.8338858220671682, -0.4731023358575983];
  var SCALE = 14; // raster pixels per cube edge (validator and generator checks)

  function rint(r, n) { return floor(r.next() * n); }
  function shuffle(r, arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) { var j = floor(r.next() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }
  function normParams(params) {
    var p = {};
    [['cubes', CUBES], ['height', HEIGHT], ['asked', ASKED]].forEach(function (d) {
      var v = params ? params[d[0]] : 0;
      p[d[0]] = isInt(v) && v >= 0 && v < d[1].length ? v : 0;
    });
    if (params && isInt(params.ask) && params.ask >= 0) p.ask = params.ask;
    return p;
  }

  /* ---------- the model: painted sides by neighbour tests ---------- */

  function hAt(H, x, z) { var G = H.length; return x < 0 || z < 0 || x >= G || z >= G ? 0 : H[z][x]; }
  // Every cube as { x, y, z, painted, sides: [top, front +z, right +x, back −z, left −x] exposed }.
  function cubesOf(H) {
    var G = H.length, out = [];
    for (var z = 0; z < G; z++) for (var x = 0; x < G; x++) {
      for (var y = 0; y < H[z][x]; y++) {
        var s = [y === H[z][x] - 1, hAt(H, x, z + 1) <= y, hAt(H, x + 1, z) <= y, hAt(H, x, z - 1) <= y, hAt(H, x - 1, z) <= y];
        var n = 0;
        for (var k = 0; k < 5; k++) if (s[k]) n++;
        out.push({ x: x, y: y, z: z, painted: n, sides: s });
      }
    }
    return out;
  }
  // How many cubes have 0–5 painted sides (the generator's count; validate recounts on its own).
  function histogram(H) {
    var c = [0, 0, 0, 0, 0, 0], G = H.length;
    for (var z = 0; z < G; z++) {
      var row = H[z], fr = z + 1 < G ? H[z + 1] : null, bk = z > 0 ? H[z - 1] : null;
      for (var x = 0; x < G; x++) {
        var h = row[x], hf = fr ? fr[x] : 0, hb = bk ? bk[x] : 0, hr = x + 1 < G ? row[x + 1] : 0, hl = x > 0 ? row[x - 1] : 0;
        for (var y = 0; y < h; y++) c[(y === h - 1 ? 1 : 0) + (hf <= y ? 1 : 0) + (hb <= y ? 1 : 0) + (hr <= y ? 1 : 0) + (hl <= y ? 1 : 0)]++;
      }
    }
    return c;
  }
  function total(H) { var n = 0; H.forEach(function (row) { row.forEach(function (h) { n += h; }); }); return n; }
  function maxH(H) { var m = 0; H.forEach(function (row) { row.forEach(function (h) { if (h > m) m = h; }); }); return m; }
  function connected(H) {
    var G = H.length, seen = {}, stack = [], cells = 0, start = null, x, z;
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) if (H[z][x] > 0) { cells++; if (!start) start = [x, z]; }
    if (!start) return false;
    stack.push(start); seen[start[0] + ',' + start[1]] = true;
    var reached = 0;
    while (stack.length) {
      var c = stack.pop();
      reached++;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = c[0] + d[0], nz = c[1] + d[1], k = nx + ',' + nz;
        if (hAt(H, nx, nz) > 0 && !seen[k]) { seen[k] = true; stack.push([nx, nz]); }
      });
    }
    return reached === cells;
  }

  /* ---------- the view: faces, projection and a software z-buffer ---------- */

  function proj(P) { return [P[0] * R[0] + P[1] * R[1] + P[2] * R[2], -(P[0] * U[0] + P[1] * U[1] + P[2] * U[2])]; }
  function depth(P) { return P[0] * D[0] + P[1] * D[1] + P[2] * D[2]; }
  // The exposed faces that turn towards the viewer (top, front, right), as 3D corner lists
  // [origin, edge u, edge v] with the cube index; painted faces only (every exposed face is).
  function facesOf(cubes) {
    var out = [];
    cubes.forEach(function (q, i) {
      var x = q.x, y = q.y, z = q.z;
      if (q.sides[0]) out.push({ cube: i, side: 0, o: [x, y + 1, z], u: [1, 0, 0], v: [0, 0, 1] });
      if (q.sides[1]) out.push({ cube: i, side: 1, o: [x, y, z + 1], u: [1, 0, 0], v: [0, 1, 0] });
      if (q.sides[2]) out.push({ cube: i, side: 2, o: [x + 1, y, z], u: [0, 0, 1], v: [0, 1, 0] });
    });
    return out;
  }
  // Visible pixels per face (z-buffer at SCALE px per edge; a pixel belongs to the nearest face
  // whose parallelogram contains its centre).
  function render(H) {
    var cubes = cubesOf(H), faces = facesOf(cubes), G = H.length;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    faces.forEach(function (f) {
      f.p0 = proj(f.o); f.pu = proj(f.u); f.pv = proj(f.v);
      var pts = [f.p0, [f.p0[0] + f.pu[0], f.p0[1] + f.pu[1]], [f.p0[0] + f.pv[0], f.p0[1] + f.pv[1]], [f.p0[0] + f.pu[0] + f.pv[0], f.p0[1] + f.pu[1] + f.pv[1]]];
      f.box = [Infinity, Infinity, -Infinity, -Infinity];
      pts.forEach(function (q) { f.box[0] = Mth.min(f.box[0], q[0]); f.box[1] = Mth.min(f.box[1], q[1]); f.box[2] = Mth.max(f.box[2], q[0]); f.box[3] = Mth.max(f.box[3], q[1]); });
      x0 = Mth.min(x0, f.box[0]); y0 = Mth.min(y0, f.box[1]); x1 = Mth.max(x1, f.box[2]); y1 = Mth.max(y1, f.box[3]);
      f.d0 = depth(f.o); f.du = depth(f.u); f.dv = depth(f.v);
      f.det = f.pu[0] * f.pv[1] - f.pu[1] * f.pv[0];
    });
    var W = Mth.ceil((x1 - x0) * SCALE) + 1, Ht = Mth.ceil((y1 - y0) * SCALE) + 1, n = W * Ht;
    var zb = new Float64Array(n), own = new Int32Array(n), i, f, px, py;
    for (i = 0; i < n; i++) { zb[i] = -Infinity; own[i] = -1; }
    for (var fi = 0; fi < faces.length; fi++) {
      f = faces[fi];
      var ax = Mth.max(0, floor((f.box[0] - x0) * SCALE)), bx = Mth.min(W - 1, Mth.ceil((f.box[2] - x0) * SCALE));
      var ay = Mth.max(0, floor((f.box[1] - y0) * SCALE)), by = Mth.min(Ht - 1, Mth.ceil((f.box[3] - y0) * SCALE));
      for (py = ay; py <= by; py++) {
        for (px = ax; px <= bx; px++) {
          var sx = x0 + (px + 0.5) / SCALE - f.p0[0], sy = y0 + (py + 0.5) / SCALE - f.p0[1];
          var a = (sx * f.pv[1] - sy * f.pv[0]) / f.det, b = (f.pu[0] * sy - f.pu[1] * sx) / f.det;
          if (a < 0 || a > 1 || b < 0 || b > 1) continue;
          var dz = f.d0 + a * f.du + b * f.dv, k = py * W + px;
          if (dz > zb[k] + 1e-9) { zb[k] = dz; own[k] = fi; }
        }
      }
    }
    var total0 = faces.map(function () { return 0; }), shown = faces.map(function () { return 0; });
    // a face's full area in pixels: |det| · SCALE²
    faces.forEach(function (fc, j) { total0[j] = abs(fc.det) * SCALE * SCALE; });
    for (i = 0; i < n; i++) if (own[i] >= 0) shown[own[i]]++;
    var perCube = cubes.map(function () { return { best: 0, any: 0, faces: [0, 0, 0] }; });
    faces.forEach(function (fc, j) {
      var frac = Mth.min(1, shown[j] / total0[j]), pc = perCube[fc.cube];
      pc.faces[fc.side] = frac;
      if (frac > pc.best) pc.best = frac;
      pc.any += shown[j];
    });
    // img: the raster itself (the owning face per pixel, -1 for none), for the view's badges, which sit
    // on the most interior point of a face's visible pixels (fresh-player run, 19 Nov: badges at joins).
    return { cubes: cubes, faces: faces, perCube: perCube, G: G, img: { own: own, W: W, H: Ht, x0: x0, y0: y0, scale: SCALE } };
  }
  // What the picture shows: the top-face share of every column's top cube, the hidden cubes, and
  // how many painted faces each cube shows clearly (for the novice-error shortcut).
  function sight(H) {
    var rr = render(H), tops = [], hidden = 0, faint = 0, showN = [], hid = [];
    rr.cubes.forEach(function (q, i) {
      var pc = rr.perCube[i];
      if (q.sides[0]) tops.push(pc.faces[0]);
      if (pc.any === 0) hidden++; else if (pc.best < CLEAR) faint++;
      hid.push(pc.any === 0);
      var sN = 0;
      for (var s = 0; s < 3; s++) if (pc.faces[s] >= CLEAR) sN++;
      showN.push(sN);
    });
    return { minTop: tops.length ? Mth.min.apply(null, tops) : 0, hidden: hidden, faint: faint, showN: showN, hid: hid, cubes: rr.cubes };
  }

  /* ---------- generator ---------- */

  // A random figure: a connected footprint grown from a random cell, with columns raised more
  // often towards the back left. Tall columns at the back keep their tops in view over the front
  // ones, and the cubes under them become the hidden supports the format allows.
  function randomFigure(r, G, nLo, nHi, hMax) {
    var target = nLo + rint(r, nHi - nLo + 1), H = [], x, z;
    for (z = 0; z < G; z++) { H.push([]); for (x = 0; x < G; x++) H[z].push(0); }
    var cells = [[rint(r, G), rint(r, G)]];
    H[cells[0][1]][cells[0][0]] = 1;
    var count = 1, guard = 0;
    while (count < target && guard++ < 400) {
      // grow sideways (a new column) or up (a taller column)
      var up = r.next() < 0.5;
      if (up) {
        var c = cells[rint(r, cells.length)];
        var bias = (G - 1 - c[1]) + (G - 1 - c[0]);
        if (H[c[1]][c[0]] < hMax && r.next() < 0.35 + 0.65 * bias / (2 * (G - 1) || 1)) { H[c[1]][c[0]]++; count++; }
      } else {
        var from = cells[rint(r, cells.length)], d = [[1, 0], [-1, 0], [0, 1], [0, -1]][rint(r, 4)];
        var nx = from[0] + d[0], nz = from[1] + d[1];
        if (nx >= 0 && nz >= 0 && nx < G && nz < G && H[nz][nx] === 0) { H[nz][nx] = 1; cells.push([nx, nz]); count++; }
      }
    }
    return count === target ? H : null;
  }

  // A figure with exactly P cubes painted on all five sides (version 3): P columns taller than all
  // four of their neighbours. The P columns are placed first, never side by side, and the cells
  // straight behind, to the left of and behind-left of each are kept empty, since a column taller
  // than its neighbours would hide their tops (the view looks from the front right, above); then the
  // footprint grows from them through the other cells, one cube high, until it is one piece of F
  // columns; the P columns stand two high and one of them the level's height; then single cubes go
  // where they keep every such column the tallest of its neighbourhood and make no new one (a column
  // beside one stays lower than it, any other keeps a neighbour at least as tall), towards the back
  // left as randomFigure raises columns. null when it cannot be done (the caller draws again).
  var RAISE = [0, 0, 2, 6, 10]; // by the level's height (index 2–4)
  function peakFigure(r, G, nLo, nHi, hMax, P) {
    var n = nLo + rint(r, nHi - nLo + 1), GG = G * G, i, j, q;
    // F: the columns. The cubes above the footprint and the P columns go where the rules allow, which
    // is little room at two high (only away from the P columns, beside a column as tall), so the
    // footprint takes most cubes when the figure is low: at most RAISE[hMax] single cubes are left.
    var maxF = Mth.min(GG, n - P - (hMax - 2)), minF = Mth.max(P + 1, maxF - RAISE[hMax]);
    if (maxF < minF) return null;
    var F = minF + rint(r, maxF - minF + 1);
    // cells as indices c = z·G + x; NB[c]: the 4-neighbours (−1 off the grid)
    var NB = NBS[G], peak = new Int8Array(GG), bad = new Int8Array(GG), foot = new Int8Array(GG), h = new Int8Array(GG);
    var peaks = [], order = [];
    for (i = 0; i < GG; i++) order.push(i);
    order = shuffle(r, order);
    for (i = 0; i < GG && peaks.length < P; i++) {
      var c = order[i], x = c % G, z = (c - x) / G, ok = !bad[c];
      for (q = 0; q < 4 && ok; q++) if (NB[c * 4 + q] >= 0 && peak[NB[c * 4 + q]]) ok = false;
      // nothing of another such column may stand where this one would hide it
      if (ok && ((x + 1 < G && peak[c + 1]) || (z + 1 < G && peak[c + G]) || (x + 1 < G && z + 1 < G && peak[c + G + 1]))) ok = false;
      if (!ok) continue;
      peak[c] = 1; peaks.push(c);
      if (x > 0) bad[c - 1] = 1;
      if (z > 0) bad[c - G] = 1;
      if (x > 0 && z > 0) bad[c - G - 1] = 1;
    }
    if (peaks.length < P) return null;
    // grow one piece: from a random cell of the footprint into a free neighbour (union-find keeps the
    // number of pieces), until it is one piece of at least F columns; once F is reached, only cells
    // that join two pieces are added
    var parent = new Int16Array(GG), cells = [], pieces = 0;
    function find(k) { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; }
    function add(k) {
      foot[k] = 1; h[k] = 1; parent[k] = k; cells.push(k); pieces++;
      for (var u = 0; u < 4; u++) {
        var nk = NB[k * 4 + u];
        if (nk >= 0 && foot[nk]) { var ra = find(k), rb = find(nk); if (ra !== rb) { parent[ra] = rb; pieces--; } }
      }
    }
    for (i = 0; i < P; i++) add(peaks[i]);
    for (var guard = 0; guard < 600 && (cells.length < F || pieces > 1); guard++) {
      var nk = NB[cells[rint(r, cells.length)] * 4 + rint(r, 4)];
      if (nk < 0 || foot[nk] || bad[nk]) continue;
      if (cells.length >= F) {
        var r0 = -1, joins = false;
        for (q = 0; q < 4; q++) {
          var ak = NB[nk * 4 + q];
          if (ak >= 0 && foot[ak]) { var ra = find(ak); if (r0 < 0) r0 = ra; else if (ra !== r0) joins = true; }
        }
        if (!joins) continue;
      }
      add(nk);
    }
    if (pieces > 1 || cells.length > n - P - (hMax - 2)) return null;
    for (i = 0; i < P; i++) h[peaks[i]] = 2;
    h[peaks[rint(r, P)]] = hMax;
    var count = cells.length + P + (hMax - 2), cand = [], wt = [];
    while (count < n) {
      var nc = 0, ws = 0;
      for (i = 0; i < cells.length; i++) {
        var cc = cells[i], hh = h[cc] + 1, good = hh <= hMax;
        if (good && !peak[cc]) {
          var tall = false;
          for (j = 0; j < 4 && good; j++) {
            var bk = NB[cc * 4 + j];
            if (bk < 0) continue;
            if (peak[bk] && h[bk] <= hh) good = false;
            if (h[bk] >= hh) tall = true;
          }
          good = good && tall;
        }
        if (good) { var cx = cc % G, w = 0.35 + 0.65 * ((G - 1 - (cc - cx) / G) + (G - 1 - cx)) / (2 * (G - 1) || 1); cand[nc] = cc; wt[nc] = w; ws += w; nc++; }
      }
      if (!nc) return null;
      var uu = r.next() * ws, pick = cand[nc - 1];
      for (i = 0; i < nc; i++) { uu -= wt[i]; if (uu <= 0) { pick = cand[i]; break; } }
      h[pick]++;
      count++;
    }
    var H = [];
    for (var zz = 0; zz < G; zz++) { var row = []; for (var xx = 0; xx < G; xx++) row.push(h[zz * G + xx]); H.push(row); }
    return H;
  }
  // The 4-neighbours of every cell of a G × G grid (indices z·G + x; −1 off the grid), G = 3–5.
  var NBS = {};
  [3, 4, 5].forEach(function (G) {
    var t = new Int8Array(G * G * 4);
    for (var c = 0; c < G * G; c++) {
      var x = c % G, z = (c - x) / G;
      t[c * 4] = x + 1 < G ? c + 1 : -1; t[c * 4 + 1] = x > 0 ? c - 1 : -1;
      t[c * 4 + 2] = z + 1 < G ? c + G : -1; t[c * 4 + 3] = z > 0 ? c - G : -1;
    }
    NBS[G] = t;
  });

  // The generator's figures are one piece by construction (randomFigure grows from a cell's
  // neighbours, peakFigure joins its pieces); validate checks it on every item.
  function figureOk(H, p) {
    var n = total(H), cr = CUBES[p.cubes];
    return n >= cr[0] && n <= cr[1] && maxH(H) === HEIGHT[eff(p).height];
  }
  // Cubes that show exactly N painted faces in the picture (the novice error).
  function shownCount(s, N) { var c = 0; s.showN.forEach(function (v) { if (v === N) c++; }); return c; }
  // The partial counts a question is held against (lib, for the tests too): cubes with N painted
  // sides that show in the picture (hidden supports missed), that are column tops, and cubes whose
  // count is N when the bottom of a ground cube is taken as painted.
  function partials(s, H, N) {
    var vis = 0, tops = 0, bottom = 0;
    s.cubes.forEach(function (q, i) {
      if (q.painted === N && !s.hid[i]) vis++;
      if (q.painted === N && q.y === H[q.z][q.x] - 1) tops++;
      if (q.painted + (q.y === 0 ? 1 : 0) === N) bottom++;
    });
    return { vis: vis, tops: tops, bottom: bottom };
  }
  // Every question is held near chance on the novice errors (see the header): false = redraw. Flat
  // figures hide no cube, and a cube with five painted sides is always a column top in view, so
  // counting visible cubes only is the true count there by construction.
  // On 4–6 cubes three high, counting the bottom as painted gives the count far more often (towers
  // of a few cubes: 41 % of their questions at a redraw of 0.5, per-level check of 19 Nov): its count
  // there is 0 for nearly every figure with one cube of three painted sides, which "1 cube" (the
  // nearest answer) then gets right, and equals two in 60 % of the figures with two; so it is
  // redrawn 95 % of the time there.
  function askOk(r, e, s, H, N, k) {
    if (shownCount(s, N) === k && r.next() < 0.75) return false;
    var pt = partials(s, H, N);
    if (!e.flat && N !== 5 && pt.vis === k && r.next() < VO_REDRAW) return false;
    if (pt.bottom === k && r.next() < (e.cubes === 0 && HEIGHT[e.height] === 3 ? 0.95 : 0.5)) return false;
    return true;
  }

  // A cheap look before the z-buffer (version 3): four rays from each column's top face towards the
  // viewer; a top with three or four of them blocked is very rarely half in view, so the figure is
  // drawn again without rendering it (most figures that fail TOP_SHOW fail here first). The z-buffer
  // still decides every figure kept, and validate's own ray cast checks it.
  var TOP_RAYS = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  function topsLikely(H) {
    var G = H.length;
    for (var z = 0; z < G; z++) for (var x = 0; x < G; x++) {
      var h = H[z][x];
      if (!h) continue;
      var free = 0;
      for (var i = 0; i < 4; i++) if (!blocked(H, x + TOP_RAYS[i][0], h + EPS_RAY, z + TOP_RAYS[i][1])) free++;
      if (free < 2) return false;
    }
    return true;
  }

  // The plan of a figure: its first question (N from the level's class, the count k evenly from N's
  // range), how many questions it has (setSize) and, where five painted sides is asked, its count.
  function question(r, p, KR) {
    var asks0 = ASK_OF[ASKED[eff(p).asked]].filter(function (n) { return KR[n]; });
    var N = asks0[rint(r, asks0.length)], kr = KR[N];
    return [N, kr[0] + rint(r, kr[1] - kr[0] + 1)];
  }
  function plan(r, p, seed) {
    var set = setOf(p, seed), q = question(r, p, set.five ? krange5(p) : krange(p)), k5 = 0;
    if (set.five) k5 = FIVE_RANGE[0] + rint(r, FIVE_RANGE[1] - FIVE_RANGE[0] + 1);
    return { N: q[0], k: q[1], m: set.m, k5: k5 };
  }
  // relax (version 3): after RELAX[0] failed searches the later questions skip KEEP, after RELAX[1]
  // also the novice-error redraws; the first question, the set's size and five's count never relax.
  // Rare plans (a count its level seldom gives, with two more questions in range) then still find a
  // figure; the tests measure the later answers with it.
  var RELAX = [2, 4], REPLAN = 20;
  function build(r, p, pl, relax) {
    var Gs = GRIDS[p.cubes], cr = CUBES[p.cubes], e = eff(p), hMax = HEIGHT[e.height], N = pl.N, k = pl.k;
    for (var t = 0; t < 400; t++) {
      var G = Gs[rint(r, Gs.length)];
      var H = pl.k5 ? peakFigure(r, G, cr[0], cr[1], hMax, pl.k5) : randomFigure(r, G, cr[0], cr[1], hMax);
      if (!H || !figureOk(H, p)) continue;
      var hist = histogram(H);
      if (hist[N] !== k || (pl.k5 && hist[5] !== pl.k5)) continue;
      // the later questions' counts first (cheap), the picture after
      var kept = keptLater(r, p, pl, hist, relax);
      if (!kept) continue;
      if (!topsLikely(H)) continue;
      var s = sight(H);
      if (s.minTop < TOP_SHOW) continue;
      if (!askOk(r, e, s, H, N, k)) continue;
      if (pl.k5 && !askOk(r, e, s, H, 5, pl.k5)) continue;
      var later = laterQuestions(r, e, pl, H, hist, s, kept, relax);
      if (!later) continue;
      return finish(p, H, [N].concat(later), hist, s.hidden);
    }
    return null;
  }
  // The questions after the first: other N in KRANGE at this size (KRANGE5 beside five painted
  // sides) whose count lies in N's range, in a seeded order, each kept by KEEP (keptLater: counts
  // only) and then held on the novice errors (laterQuestions: the picture), until the figure has its
  // number of questions (five painted sides, when planned, at a random later place); null when the
  // figure cannot carry them. After RELAX[0] failed searches KEEP is skipped, after RELAX[1] the
  // novice-error redraws of these questions too.
  function keptLater(r, p, pl, hist, relax) {
    var e = eff(p), KR = pl.k5 ? krange5(p) : krange(p), need = pl.m - 1 - (pl.k5 ? 1 : 0), out = [];
    var keep = (pl.k5 ? KEEP5[p.cubes][e.height - 1] : (e.flat ? KEEP_FLAT : KEEP)[p.cubes]) || {};
    if (need <= 0) return out;
    shuffle(r, Object.keys(KR).map(Number)).forEach(function (n) {
      var c = hist[n];
      if (n === pl.N || n === 5 || c < KR[n][0] || c > KR[n][1]) return;
      if (relax >= 1 || r.next() < (keep[n] ? keep[n][c] : 1)) out.push(n);
    });
    return out.length >= need ? out : null;
  }
  function laterQuestions(r, e, pl, H, hist, s, kept, relax) {
    var need = pl.m - 1 - (pl.k5 ? 1 : 0), out = [];
    for (var i = 0; i < kept.length && out.length < need; i++) if (relax >= 2 || askOk(r, e, s, H, kept[i], hist[kept[i]])) out.push(kept[i]);
    if (out.length < need) return null;
    if (pl.k5) out.splice(rint(r, out.length + 1), 0, 5);
    return out;
  }
  // The item: the question params.ask picks from the figure's list (its first without it).
  function finish(p, H, asks, hist, hidden) {
    var pos = isInt(p.ask) ? p.ask % asks.length : 0, ask = asks[pos];
    return {
      ex: 'cubes', v: 3, seed: 0, params: p, key: hist[ask] - 1, grid: H.length, heights: H.map(function (row) { return row.slice(); }),
      ask: ask, count: hist[ask], asks: asks, pos: pos, options: OPTIONS.slice(), hidden: hidden,
    };
  }

  // The plan (N and k, the number of questions, five's count) is drawn once and kept across retries
  // (only the figure search is retried), so hard counts are not under-represented in any level
  // (RV-dat-style-A §12).
  function generate(rng, params) {
    var p = normParams(params), pl = plan(rng, p, rng.seed), item;
    for (var i = 0; i < 50; i++) {
      // a plan no figure met in REPLAN searches gets its first question drawn again from its own stream
      // (the number of questions and five's count stay, so neither leans towards what is easy): rare
      if (i === REPLAN) { var q2 = plan(rng.fork('replan'), p, rng.seed); pl = { N: q2.N, k: q2.k, m: pl.m, k5: pl.k5 }; }
      item = build(i === 0 ? rng : rng.fork('retry' + i), p, pl, i >= RELAX[1] ? 2 : i >= RELAX[0] ? 1 : 0);
      if (item) { item.seed = rng.seed; if (validate(item) === true) return item; }
    }
    item = fallbackFor(p);
    item.seed = rng.seed;
    return item;
  }
  // The last resort (the engine voids it): a figure for these params found by a fixed search, with
  // its own number of questions (validate skips the set size check on it).
  var fallbackCache = {};
  function fallbackFor(params) {
    var p = normParams(params), base = { cubes: p.cubes, height: p.height, asked: p.asked }, pk = PX.ex.paramsKey(base);
    for (var i = 0; i < 300 && !fallbackCache[pk]; i++) {
      var r = PX.rng(PX.rng.hash('cubes-fallback', pk, i)), it = build(r, base, plan(r, base, r.seed), 2);
      if (it) { it.seed = r.seed; it.fallback = true; if (validate(it) === true) fallbackCache[pk] = it; }
    }
    var out = PX.util.deepCopy(fallbackCache[pk]);
    if (isInt(p.ask)) { out.params.ask = p.ask; out.pos = p.ask % out.asks.length; out.ask = out.asks[out.pos]; out.count = histogram(out.heights)[out.ask]; out.key = out.count - 1; }
    out.fallback = true;
    return out;
  }

  /* ---------- validator ---------- */

  // The validator's own view, independent of the generator's z-buffer (R3 §8.4; RV-dat-style-A
  // §13): a ray cast. From RAYS × RAYS points on each face that turns towards the viewer, a ray
  // runs towards the viewer (D, which points right, up and to the front); it is blocked when it
  // crosses a column's footprint below that column's top (the ray climbs, so inside a footprint it
  // is lowest where it enters). Returns the smallest share of a column top in view and the number
  // of cubes with no ray getting out.
  var RAYS = 8, EPS_RAY = 1e-7;
  function blocked(H, px, py, pz) {
    var G = H.length, x0 = Mth.max(0, floor(px)), z0 = Mth.max(0, floor(pz));
    for (var z = z0; z < G; z++) for (var x = x0; x < G; x++) {
      var h = H[z][x];
      if (!h) continue;
      var tIn = Mth.max(0, (x - px) / D[0], (z - pz) / D[2]), tOut = Mth.min((x + 1 - px) / D[0], (z + 1 - pz) / D[2]);
      if (tIn < tOut && py + tIn * D[1] < h) return true;
    }
    return false;
  }
  // Rays out of one face (side 0 top, 1 front, 2 right) of the cube at x, y, z: how many are free.
  function freeRays(H, x, y, z, side, stopAtOne) {
    var free = 0;
    for (var i = 0; i < RAYS; i++) for (var j = 0; j < RAYS; j++) {
      var a = (i + 0.5) / RAYS, b = (j + 0.5) / RAYS, P;
      if (side === 0) P = [x + a, y + 1 + EPS_RAY, z + b];
      else if (side === 1) P = [x + a, y + b, z + 1 + EPS_RAY];
      else P = [x + 1 + EPS_RAY, y + a, z + b];
      if (!blocked(H, P[0], P[1], P[2])) { free++; if (stopAtOne) return 1; }
    }
    return free;
  }
  function rayView(H) {
    var G = H.length, minTop = 1, hidden = 0;
    for (var z = 0; z < G; z++) for (var x = 0; x < G; x++) {
      var h = H[z][x];
      if (!h) continue;
      minTop = Mth.min(minTop, freeRays(H, x, h - 1, z, 0, false) / (RAYS * RAYS));
      // A column's top cube shows its top (held to TOP_SHOW above); the others show a front or a
      // right side or nothing.
      for (var y = 0; y < h - 1; y++) {
        if (!((hAt(H, x, z + 1) <= y && freeRays(H, x, y, z, 1, true)) || (hAt(H, x + 1, z) <= y && freeRays(H, x, y, z, 2, true)))) hidden++;
      }
    }
    return { minTop: minTop, hidden: hidden };
  }

  function validate(item) {
    try { return check(item); } catch (e) { return 'validate threw: ' + (e && e.message); }
  }
  function check(item) {
    if (!item || item.ex !== 'cubes') return 'not a cubes item';
    var p = item.params || {};
    if (!(isInt(p.cubes) && p.cubes >= 0 && p.cubes < CUBES.length && isInt(p.height) && p.height >= 0 && p.height < HEIGHT.length && isInt(p.asked) && p.asked >= 0 && p.asked < ASKED.length)) return 'bad params';
    var H = item.heights, G = item.grid;
    if (!isInt(G) || GRIDS[p.cubes].indexOf(G) < 0 || !isArray(H) || H.length !== G) return 'grid size';
    for (var z = 0; z < G; z++) {
      if (!isArray(H[z]) || H[z].length !== G) return 'grid row ' + z;
      for (var x = 0; x < G; x++) if (!isInt(H[z][x]) || H[z][x] < 0 || H[z][x] > 4) return 'height at ' + x + ',' + z;
    }
    var n = total(H), cr = CUBES[p.cubes];
    if (n < cr[0] || n > cr[1]) return n + ' cubes, expected ' + cr[0] + '–' + cr[1];
    var e = eff(p);
    if (maxH(H) !== HEIGHT[e.height]) return 'tallest column ' + maxH(H) + ', expected ' + HEIGHT[e.height];
    if (!connected(H)) return 'the footprint is not one piece';
    // Painted sides, recounted cube by cube from the voxels with neighbour tests.
    var counts = [0, 0, 0, 0, 0, 0];
    for (z = 0; z < G; z++) for (x = 0; x < G; x++) for (var y = 0; y < H[z][x]; y++) {
      var c = 0;
      if (y + 1 >= H[z][x]) c++;                       // top: nothing above
      if (!(hAt(H, x, z + 1) > y)) c++;                // front
      if (!(hAt(H, x, z - 1) > y)) c++;                // back
      if (!(hAt(H, x + 1, z) > y)) c++;                // right
      if (!(hAt(H, x - 1, z) > y)) c++;                // left (the bottom is never painted)
      counts[c]++;
    }
    var N = item.ask;
    if (!isInt(N) || N < 1 || N > 5) return 'asked N out of 1–5';
    if (counts[N] < 1 || counts[N] > 5) return counts[N] + ' cubes have ' + N + ' painted sides (must be 1–5)';
    if (item.count !== counts[N]) return 'stated count differs from the recount';
    if (!(isInt(item.key) && item.key === counts[N] - 1)) return 'key does not match the recount';
    if (!isArray(item.options) || item.options.join() !== '1,2,3,4,5') return 'options must be 1–5 cubes';
    // The questions (version 3): the first from the level's class; later ones any other N in KRANGE
    // at this size with a count in its range, or five painted sides where the level asks it (a
    // stacked figure from FIVE_FROM up) with its count in FIVE_RANGE; all different. A figure has
    // as many questions as its seed and level give (setSize), except the voided last resort.
    var asks = item.asks, seenN = {};
    if (!isArray(asks) || asks.length < 1 || asks.length > 4) return 'asks: one to four questions';
    var five = asks.indexOf(5) > 0;
    if (five && (e.flat || p.cubes < FIVE_FROM)) return 'five painted sides asked at a level without it';
    var KR = five ? KRANGE5[p.cubes][e.height - 1] : e.flat ? KRANGE_FLAT[p.cubes] : p.cubes === 0 ? KRANGE_SMALL[HEIGHT[e.height]] : KRANGE[p.cubes];
    if (item.fallback !== true) {
      var set = setOf(p, item.seed);
      if (asks.length !== set.m || five !== set.five) return asks.length + ' questions' + (five ? ' with' : ' without') + ' five painted sides, the seed gives ' + set.m + (set.five ? ' with' : ' without');
    }
    if (ASK_OF[ASKED[e.asked]].indexOf(asks[0]) < 0 || !KR[asks[0]]) return 'N ' + asks[0] + ' not asked at this level';
    for (var a = 0; a < asks.length; a++) {
      var na = asks[a], rg = na === 5 && a > 0 ? FIVE_RANGE : KR[na];
      if (!isInt(na) || seenN[na] || !rg || counts[na] < rg[0] || counts[na] > rg[1]) return 'asks: N ' + na;
      seenN[na] = true;
    }
    var pos = isInt(p.ask) ? p.ask % asks.length : 0;
    if (item.pos !== pos || N !== asks[pos]) return 'the asked N is not the question params.ask picks';
    // The picture, by the validator's own ray cast: every column's top at least half visible, so
    // the tops fix every height and a cube out of sight can only be a support.
    var s = rayView(H);
    if (s.minTop < TOP_SHOW) return 'a column top is only ' + (100 * s.minTop).toFixed(0) + ' % visible (ray cast)';
    if (item.hidden !== s.hidden) return 'stated hidden count differs from the ray cast (' + s.hidden + ')';
    if (e.flat && s.hidden !== 0) return 'a flat figure hides a cube';
    return true;
  }

  // value: the question's place in its figure's set (0 for the first), for the trial row.
  function score(item, response) { return { correct: isInt(response) && response === item.key, value: isInt(item.pos) ? item.pos : 0 }; }

  // Custom only because the starter band's unbuildable combinations are priced as what is built.
  function difficulty(params) {
    var e = eff(normParams(params));
    return BASE + CUBES_AT[e.cubes] + HEIGHT_AT[e.height] + ASK_STEP * e.asked;
  }

  PX.ex.define({
    id: 'cubes', version: 3, code: 'EX-18', name: 'Painted cubes', short: 'Painted Cubes',
    abilities: ['Vz'], cell: 'intrinsic-static', role: 'train', pat: true,
    bet: 'format', format: 'cubes:count-painted-sides', // v1.2 wave 2 (W2-bets): PLAN milestone 4, CONTRACT-v1.2 S; note T1 §3.2
    answer: 'choice', nOptions: 5,
    extraParams: ['ask'],
    // Questions per figure (version 3): the planner asks a figure's questions in a row, ask 0 … n − 1
    // (W2-core's planner; the field's name is proposed in docs/dev/v1.2/requests.md, 19 Nov 09:41 UTC).
    set: { param: 'ask', size: setSize },
    dims: [
      { key: 'cubes', label: 'Cubes', levels: ['4–6', '6–9', '10–13', '14–17', '18–22'], step: 0.85, at: CUBES_AT.slice() },
      { key: 'height', label: 'Tallest column', levels: HEIGHT, step: 0.3, at: HEIGHT_AT.slice() },
      { key: 'asked', label: 'Painted sides asked', levels: ['3–4', '1–2'], step: ASK_STEP },
    ],
    base: BASE,
    starter: [{ dim: 'height', levels: 1 }, { dim: 'cubes', levels: 1 }],
    // Test range (CONTRACT-v1.2 W3; DECISIONS 19 Nov): the starter levels are below the test; stacked
    // figures from 6 cubes up are the format (the official sample is about the size of 1.1's largest
    // figures, note D1 addendum A.1 row 8); both question classes and five painted sides are the
    // format's (row 6), so the asked dim carries no tag.
    testRange: {
      dims: { cubes: ['below', 'test', 'test', 'test', 'test'], height: ['below', 'test', 'test', 'test'] },
      notes: {
        cubes: 'Figure sizes on the test are not documented officially. 4–6 cubes is a starter level.',
        height: 'Flat figures, one cube high with nothing hidden, are a starter level: the format stacks cubes, and hidden cubes hold others up.',
        '*': 'How many questions a figure gets on the test is not documented officially.',
      },
    },
    difficulty: difficulty,
    chance: 0.2,
    generate: generate,
    validate: validate,
    score: score,
    lib: {
      CUBES: CUBES, HEIGHT: HEIGHT, ASKED: ASKED, ASK_OF: ASK_OF, KRANGE: KRANGE, GRIDS: GRIDS, AZ: AZ, EL: EL, D: D, R: R, U: U,
      cubesOf: cubesOf, histogram: histogram, total: total, connected: connected, proj: proj, depth: depth, facesOf: facesOf,
      render: render, sight: sight, rayView: rayView, shownCount: shownCount, norm: normParams, fallback: fallbackFor, KEEP: KEEP, NAT: NAT,
      KRANGE_FLAT: KRANGE_FLAT, KRANGE_SMALL: KRANGE_SMALL, NAT_FLAT: NAT_FLAT, KEEP_FLAT: KEEP_FLAT, CUBES_AT: CUBES_AT, HEIGHT_AT: HEIGHT_AT, eff: eff, krange: krange,
      randomFigure: randomFigure, peakFigure: peakFigure, partials: partials, setSize: setSize, setOf: setOf, setKind: setKind, fiveOk: fiveOk,
      FIVE_FROM: FIVE_FROM, FIVE_SHARE: FIVE_SHARE, FIVE_RANGE: FIVE_RANGE, KRANGE5: KRANGE5, NAT5: NAT5, KEEP5: KEEP5, krange5: krange5, SET_P: SET_P, FOUR_FROM: FOUR_FROM, RELAX: RELAX, REPLAN: REPLAN, VO_REDRAW: VO_REDRAW, keepTables: keepTables,
    },
  });
})(window.PX);
