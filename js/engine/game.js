/* PX.engine.game: the game layer (v1.2, PLAN milestone 5, option B; note G1 §2; ENGINE.md §24). Pure: it
   takes the record and `now`, never reads the clock, storage or the DOM, and draws no randomness but
   seeded hashes. Everything here is between items: the finish hook runs after a session is stored.

   The eight rules (note G1 §2.0), with the code that keeps them:
     1 every number is about skill and matches the code        grades, Reach and cells come from levels and
                                                               right answers only
     2 nothing pays for time, logins, sessions or finishing     no lifetime points; challenge points only in
                                                               the Daily and the Climb (fixed items, scored once)
     3 nothing on screen during an item but the task and its   the UI mounts between items only; css/game.css
       counter                                                 hides every game element under body.px-stim
     4 no count of consecutive days anywhere                   nothing here counts days in a row (a test)
     5 compare with your own past by default                   no board; cards and codes only
     6 feedback scales with how good the answer was            the ring only on a stretch item answered right
     7 uncertainty lives in the task, never in prizes          no random reward anywhere
     8 the theme frames the instrument, never the stimuli      names, the Atlas, the cards

     gradeOf(level) → 0–10            grade 1 = levels 1–10 … grade 10 = 91–100; 0 without a best block
     band(def, grade) → { lo, hi, settings }   the tenth of the range a grade stands for, with its typical
                                     settings (the Path stage of the same number covers the same band)
     grades(rec, now) → [{ exId, grade, best, at, level }]   per training exercise
     reach(rec) → { value, sum, high, parts: [{ exId, best }] }   the sum of best block levels over the
                                     training exercises outside the DAT-style focus; value never falls
     atlasDims(def) → { keys: [a, b|null], dims: [dimA, dimB|null] } | null
     atlas(rec, def) → { keys, cols, rows, cells: { 'i.j': { n, r, g, handled } }, handled, tried, total }
     tail(n, r, g) → P(at least r right of n by guessing at rate g)      handled when < config.game.p
     withinReach(rec, now, exId?) → { exId, cell, i, j, b } | null   the nearest unhandled cell at the level
     fresh(rec, now) → { days } | null   a fresh-start note after a gap of config.game.gapDays or more
     climb: see the Climb section below; notes: see the field notes section below
     update(plan, rec, now, res) → res.game   (the finish hook, order 40)
     merge(theirs, mine, info)       the game container's own two-tab merge (record.js may delegate to it) */
(function (PX) {
  'use strict';

  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;
  var U = PX.util;
  var E = PX.engine;
  var M = E.model;
  var DAY = E.DAY;

  E.defaults('game', {
    p: 0.1,              // the guessing rule: a cell is handled once guessing alone explains its right answers less often
    gapDays: 7,          // the fresh-start note after a gap of at least this many days
    rankStep: 100,       // optional rank titles: one per 100 of Reach
    firstsCap: 2000,     // firsts kept (the oldest go first; the cells keep their handled mark)
    // modes whose answers fill the Atlas (never the Spatial Check, Threshold or Section practice)
    atlasModes: ['train', 'path', 'speed', 'free', 'daily', 'climb'],
    climb: { rungs: 20, spare: 1, attempts: ['A', 'B', 'C'], epoch: '2026-11-16', keepWeeks: 26 },
    notes: { offer: 3, keep: 2 },
  });
  function cfg() { return E.config.game; }

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }
  function defOf(id) { return PX.ex && typeof PX.ex.get === 'function' ? PX.ex.get(id) : null; }
  function trainDefs() { return PX.ex && typeof PX.ex.list === 'function' ? PX.ex.list('train') : []; }
  function reachDefs() { return trainDefs().filter(function (d) { return d.pat !== true; }); }

  // The game container (record format 4 reserves it; CONTRACT-v1.2 M). A record without it (a pure test
  // record) gets the default here.
  function game(rec) {
    if (!isObj(rec.game)) rec.game = E.record && E.record.defaults ? E.record.defaults('game') : { v: 1, reach: { high: 0 }, grades: {}, records: {}, firsts: [], atlas: {}, climb: {}, notes: {} };
    var g = rec.game;
    if (!isObj(g.reach)) g.reach = { high: 0 };
    if (!isNum(g.reach.high) || g.reach.high < 0) g.reach.high = 0;
    ['grades', 'records', 'atlas', 'climb', 'notes'].forEach(function (k) { if (!isObj(g[k])) g[k] = {}; });
    if (!isArray(g.firsts)) g.firsts = [];
    return g;
  }

  /* ---------- grades ---------- */

  function gradeOf(level) {
    if (!isNum(level) || level < 1) return 0;
    return Math.min(10, Math.max(1, Math.ceil(Math.round(level) / 10)));
  }
  function band(def, grade) {
    var g = Math.min(10, Math.max(1, Math.round(grade) || 1)), lo = (g - 1) * 10 + 1, hi = g * 10, s = null;
    try { s = E.est.settingsAt(def, E.est.bOfLevel(def, (lo + hi) / 2)); } catch (e) { s = null; }
    return { grade: g, lo: lo, hi: hi, settings: s };
  }
  function bestOf(rec, id) {
    var e = rec && isObj(rec.ex) ? rec.ex[id] : null, b = isObj(e) && isObj(e.best) && isObj(e.best.block) ? e.best.block : null;
    return b && isNum(b.level) && b.level >= 1 ? { level: Math.round(b.level), at: isNum(b.at) ? b.at : null } : null;
  }
  // The display class whose rating an exercise is read from. Track, Homing and Reckon keep one rating per
  // screen class (perDisplay); the game layer reads the one the player trains on: `display` (the device's
  // class now) when it has answers, else the class answered last. Every other exercise has one rating.
  function displayFor(rec, def, display) {
    if (!def || !def.perDisplay) return 'large';
    var e = rec && isObj(rec.ex) ? rec.ex[def.id] : null, sm = isObj(e) && isObj(e.small) ? e.small : null;
    var nL = isObj(e) && isNum(e.n) ? e.n : 0, nS = sm && isNum(sm.n) ? sm.n : 0;
    if (display === 'small' && nS > 0) return 'small';
    if (display === 'large' && nL > 0) return 'large';
    if (!nS) return 'large';
    if (!nL) return 'small';
    var lL = isNum(e.last) ? e.last : -1, lS = isNum(sm.last) ? sm.last : -1;
    return lS >= lL ? 'small' : 'large';
  }
  function grades(rec, now, display) {
    return trainDefs().map(function (def) {
      var b = bestOf(rec, def.id), lv = null;
      try { lv = E.est.shown(rec, def, { display: displayFor(rec, def, display) }); } catch (e) { lv = null; }
      return { exId: def.id, pat: def.pat === true, grade: b ? gradeOf(b.level) : 0, best: b ? b.level : null, at: b ? b.at : null, level: lv && isNum(lv.level) ? lv.level : null };
    });
  }

  /* ---------- Reach: the sum of best block levels (never falls) ---------- */

  // Each exercise's part is the highest of its best block and the part kept in rec.game.reach.bests (the best
  // seen so far, on the current scale: a range change converts it with the best, E.rebase.register below), so
  // Reach never falls and rises with every new best; reach.high is the sum at its highest (kept for two tabs).
  function storedParts(rec) { var r = rec && isObj(rec.game) && isObj(rec.game.reach) ? rec.game.reach : null; return r && isObj(r.bests) ? r.bests : {}; }
  function partOf(rec, id, stored) {
    var b = bestOf(rec, id), k = stored || storedParts(rec), v = isNum(k[id]) ? k[id] : 0;
    return Math.max(b ? b.level : 0, v);
  }
  function reach(rec) {
    var k = storedParts(rec);
    var parts = reachDefs().map(function (def) { return { exId: def.id, best: partOf(rec, def.id, k) }; });
    var sum = parts.reduce(function (s, p) { return s + p.best; }, 0);
    var high = rec && isObj(rec.game) && isObj(rec.game.reach) && isNum(rec.game.reach.high) ? rec.game.reach.high : 0;
    return { value: sum, sum: sum, high: high, parts: parts, max: 100 * parts.length };
  }
  // Optional rank titles (setting rankTitles, off by default): one per config.game.rankStep of Reach, in the
  // survey's words; none implies mastery or a norm (note G1 §2.2).
  var RANKS = ['Sketcher', 'Pacer', 'Chainer', 'Leveller', 'Plane-tabler', 'Traverser', 'Triangulator', 'Baseliner', 'Mapper',
    'Chart-maker', 'Contour-runner', 'Sounder', 'Meridian-walker', 'Long-surveyor'];
  function rank(value) {
    var i = Math.max(0, Math.floor((isNum(value) ? value : 0) / cfg().rankStep));
    return { index: i, title: RANKS[Math.min(i, RANKS.length - 1)], from: i * cfg().rankStep, to: (i + 1) * cfg().rankStep };
  }

  /* ---------- the Atlas: cells of two settings, handled by the guessing rule ---------- */

  // Two dimensions per exercise (def.atlas wins; CONTRACT-v1.2 S reserves it): pairs with 9–45 cells,
  // chosen so a cell is a setting a player can name ("4 folds with 3 punches"). Track's speed has 46
  // levels, so its pair is targets × spheres.
  var ATLAS = {
    track: ['targets', 'spheres'], rotate: ['angle', 'cubes'], spin: ['angle', 'cells'], fold: ['folds', 'punches'],
    nets: ['carried', 'shape'], slice: ['structure', 'cut'], views: ['cubes', 'view'], orient: ['shift', 'objects'],
    span: ['len', 'cross'], hidden: ['extra', 'sim'], homing: ['route', 'landmarks'], reckon: ['route', 'flow'],
    knots: ['rope', 'spacing'], openings: ['features', 'keyview'], patviews: ['cubes', 'missing'], angles: ['gap', 'size'],
    patfold: ['folds', 'type'], cubes: ['cubes', 'height'], form: ['solid', 'marks'], centralpoint: ['targets', 'band'],
  };
  function dimIndex(def, key) {
    if (!def || !isArray(def.dims)) return -1;
    for (var i = 0; i < def.dims.length; i++) if (def.dims[i] && def.dims[i].key === key) return i;
    return -1;
  }
  var dimsCache = {};
  function atlasDims(def) {
    if (!def || !isArray(def.dims) || !def.dims.length) return null;
    var ck = def.id + '@' + (def.version || 1);
    if (hasOwn.call(dimsCache, ck)) return dimsCache[ck];
    var pick = null;
    [def.atlas, ATLAS[def.id]].some(function (p) {
      if (!isArray(p) || p.length !== 2 || p[0] === p[1]) return false;
      var a = dimIndex(def, p[0]), b = dimIndex(def, p[1]);
      if (a < 0 || b < 0) return false;
      pick = [a, b];
      return true;
    });
    if (!pick) { // the two dimensions with the most levels (ties: the first)
      var idx = def.dims.map(function (d, i) { return i; }).sort(function (x, y) { return def.dims[y].levels.length - def.dims[x].levels.length || x - y; });
      pick = idx.length > 1 ? [idx[0], idx[1]].sort(function (x, y) { return x - y; }) : [idx[0], -1];
    }
    var out = { keys: [def.dims[pick[0]].key, pick[1] >= 0 ? def.dims[pick[1]].key : null], dims: [def.dims[pick[0]], pick[1] >= 0 ? def.dims[pick[1]] : null] };
    dimsCache[ck] = out;
    return out;
  }
  function cellOf(def, params) {
    var ad = atlasDims(def);
    if (!ad || !isObj(params)) return null;
    var i = params[ad.keys[0]], j = ad.keys[1] ? params[ad.keys[1]] : 0;
    if (!isNum(i) || !isNum(j) || i < 0 || j < 0 || i >= ad.dims[0].levels.length || (ad.dims[1] && j >= ad.dims[1].levels.length)) return null;
    return { key: i + '.' + j, i: i, j: j };
  }

  // P(X ≥ r) for X ~ Binomial(n, g): the chance that guessing alone gives at least r right of n. With every
  // answer right (r = n) it is g^n, so a four-option cell needs 2 right, a yes/no cell 4 and an open answer 1
  // (note G1 §2.4).
  var LF = [0];
  function logFact(n) { for (var k = LF.length; k <= n; k++) LF[k] = LF[k - 1] + Math.log(k); return LF[n]; }
  function tail(n, r, g) {
    n = Math.max(0, Math.round(n)); r = Math.max(0, Math.round(r));
    if (r <= 0) return 1;
    if (r > n) return 0;
    if (!(g > 0)) return 0;
    if (g >= 1) return 1;
    if (n > 20000) { r = Math.round(r * 20000 / n); n = 20000; }
    var lg = Math.log(g), lq = Math.log(1 - g), s = 0, ln = logFact(n);
    for (var k = r; k <= n; k++) s += Math.exp(ln - logFact(k) - logFact(n - k) + k * lg + (n - k) * lq);
    return Math.min(1, s);
  }
  // Handled when guessing alone explains the right answers less than one time in ten: tail < p (strictly, as
  // the texts say; a hair below p for the rounding of exp/log).
  function handledBy(n, r, g) { return r >= 1 && tail(n, r, g) < cfg().p - 1e-12; }

  // One exercise's cells: { v: version, c: { 'i.j': [n, right, g × 1000 (the highest seen), handled 0|1] } }.
  function slotOf(g, def) {
    var a = g.atlas[def.id], v = def.version || 1;
    if (!isObj(a) || a.v !== v || !isObj(a.c)) a = g.atlas[def.id] = { v: v, c: {} };
    return a;
  }
  // Counts one answer; → the first (a newly handled cell) or null.
  function tally(g, def, params, ok, gRate, t, old) {
    var cell = cellOf(def, params);
    if (!cell) return null;
    var a = slotOf(g, def), x = a.c[cell.key];
    if (!isArray(x) || x.length < 4) x = a.c[cell.key] = [0, 0, 0, 0];
    x[0] += 1;
    if (ok) x[1] += 1;
    var gq = Math.round(1000 * (isNum(gRate) ? Math.min(1, Math.max(0, gRate)) : 0));
    if (gq > x[2]) x[2] = gq;
    if (x[3] === 1 || !ok) return null;
    if (!handledBy(x[0], x[1], x[2] / 1000)) return null;
    x[3] = 1;
    var f = { ex: def.id, v: def.version || 1, cell: cell.key, at: Math.round(isNum(t) ? t : 0) };
    if (old) f.old = 1;
    g.firsts.push(f);
    var cap = cfg().firstsCap;
    if (g.firsts.length > cap) g.firsts.splice(0, g.firsts.length - cap);
    return f;
  }
  function chanceOf(def, params) {
    try { var c = def.chance(params); return isNum(c) ? c : 0; } catch (e) { return 0; }
  }
  function atlasMode(mode) { return cfg().atlasModes.indexOf(mode) >= 0; }

  // A record that predates the game layer: its trial rows fill the Atlas once (firsts from them are marked
  // old: never announced). Rows folded into day totals hold no settings and are lost to it.
  function seedAtlas(rec, g) {
    E.log.scan(rec, function (row, id, mode, ver) {
      if (!id || !atlasMode(mode) || (row[5] !== 0 && row[5] !== 1)) return;
      var def = defOf(id);
      if (!def || def.role !== 'train') return;
      var p = E.log.rowParams(def, row, ver);
      if (p) tally(g, def, p, row[5] === 1, chanceOf(def, p), row[0] * 1000, true);
    });
    g.seeded = 1;
  }

  function atlas(rec, def) {
    var ad = atlasDims(def);
    if (!ad) return null;
    var g = rec && isObj(rec.game) ? rec.game : null, a = g && isObj(g.atlas) ? g.atlas[def.id] : null;
    var cells = {}, handled = 0, tried = 0, rows = ad.dims[1] ? ad.dims[1].levels.length : 1, cols = ad.dims[0].levels.length;
    if (isObj(a) && a.v === (def.version || 1) && isObj(a.c)) Object.keys(a.c).forEach(function (k) {
      var x = a.c[k];
      if (!isArray(x) || !(x[0] > 0)) return;
      cells[k] = { n: x[0], r: x[1], g: x[2] / 1000, handled: x[3] === 1 };
      tried++;
      if (x[3] === 1) handled++;
    });
    return { exId: def.id, keys: ad.keys, dims: ad.dims, cols: cols, rows: rows, cells: cells, handled: handled, tried: tried, total: cols * rows };
  }

  // The easiest pool entry of each cell (the exercise's automatic variants), cached per definition.
  var easyCache = {};
  function cellEase(def) {
    var ck = def.id + '@' + (def.version || 1);
    if (hasOwn.call(easyCache, ck)) return easyCache[ck];
    var out = {}, tv = isArray(def.trainVariants) && def.trainVariants.length ? def.trainVariants : null;
    M.pool(def).forEach(function (c) {
      if (tv && def.variants && tv.indexOf(c.params.variant) < 0) return;
      var cell = cellOf(def, c.params);
      if (cell && (!hasOwn.call(out, cell.key) || c.b < out[cell.key].b)) out[cell.key] = { b: c.b, i: cell.i, j: cell.j };
    });
    easyCache[ck] = out;
    return out;
  }
  // "Within reach": the unhandled cell whose easiest item sits nearest the difficulty the level aims at
  // (ties: the easier). exId: that exercise, else the exercises of the latest session. display: the device's
  // screen class (displayFor picks the rating of a perDisplay exercise).
  function withinReach(rec, now, exId, display) {
    var ids = exId ? [exId] : [];
    if (!ids.length) {
      var ss = isArray(rec.sessions) ? rec.sessions : [];
      for (var s = ss.length - 1; s >= 0 && !ids.length; s--) if (isObj(ss[s]) && ss[s].mode !== 'check' && isArray(ss[s].exs)) ids = ss[s].exs.slice();
    }
    var best = null;
    ids.forEach(function (id) {
      var def = defOf(id);
      if (!def || def.role !== 'train' || !atlasDims(def)) return;
      var st = E.est.get(rec, def, { display: displayFor(rec, def, display) }, now);
      if (!st || !(st.n > 0)) return;
      var aim = E.est.bRef(def, st.mu), at = atlas(rec, def), ease = cellEase(def);
      Object.keys(ease).forEach(function (k) {
        if (at.cells[k] && at.cells[k].handled) return;
        var d = Math.abs(ease[k].b - aim);
        if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && ease[k].b < best.b)) best = { exId: id, cell: k, i: ease[k].i, j: ease[k].j, b: ease[k].b, d: d };
      });
    });
    return best;
  }

  // A gap since the last practice (a check is not practice): the note says levels wait where they were.
  function fresh(rec, now) {
    var ss = isArray(rec.sessions) ? rec.sessions : [], last = null;
    for (var i = ss.length - 1; i >= 0; i--) {
      var s = ss[i];
      if (isObj(s) && s.mode !== 'check' && isNum(s.end) && s.end <= now) { last = s.end; break; }
    }
    if (last === null) return null;
    var days = Math.floor((now - last) / DAY);
    return days >= cfg().gapDays ? { days: days, since: last } : null;
  }

  // The firsts a session has made so far, without writing anything (between items: a block end's note):
  // the session's answers counted on a copy of its exercises' cells.
  function pending(plan, rec) {
    if (!plan || !isArray(plan.log) || !atlasMode(plan.mode)) return [];
    var g = rec && isObj(rec.game) ? rec.game : null;
    if (!g || g.seeded !== 1) return [];
    var shadow = { atlas: {}, firsts: [] }, out = [];
    plan.log.forEach(function (x) {
      if (!x || (x.oc !== 0 && x.oc !== 1)) return;
      var def = defOf(x.exId), p = null;
      if (!def || def.role !== 'train') return;
      if (!hasOwn.call(shadow.atlas, def.id)) shadow.atlas[def.id] = isObj(g.atlas[def.id]) ? U.deepCopy(g.atlas[def.id]) : undefined;
      try { p = PX.ex.decodeParams(def, x.code); } catch (e) { p = null; }
      if (!p) return;
      var f = tally(shadow, def, p, x.oc === 1, isNum(x.g) ? x.g : chanceOf(def, p), 0, false);
      if (f) out.push(f);
    });
    return out;
  }

  /* ---------- the finish hook: what a session changed in the game layer ---------- */

  // How close this session's best block came to the exercise's best (a personal-best goal in small-area
  // words: "2 levels from your best"); said only when it came within 3 and set no new best (note G1 §2.3).
  function near(plan, rec, res) {
    var out = [], bests = isArray(res.bests) ? res.bests.map(function (b) { return b.exId; }) : [];
    Object.keys(isObj(plan.blocks) ? plan.blocks : {}).forEach(function (id) {
      if (bests.indexOf(id) >= 0) return;
      var b = bestOf(rec, id), top = null;
      plan.blocks[id].forEach(function (x) { if (isNum(x.level) && (top === null || x.level > top)) top = x.level; });
      if (b && top !== null && b.level - top >= 1 && b.level - top <= 3) out.push({ exId: id, best: b.level, top: top, gap: b.level - top });
    });
    return out;
  }

  function update(plan, rec, now, res) {
    if (!plan || !res || plan.unavailable || !isNum(now)) return null;
    var g = game(rec), out = { reach: null, grades: [], firsts: [], notes: [], near: [], seeded: !!plan.gameSeeded };
    // the Atlas: a record from before the game layer is seeded from its rows once (this session's rows
    // are already stored, so its firsts are new; older ones are marked old)
    if (g.seeded !== 1) {
      var n0 = g.firsts.length;
      seedAtlas(rec, g);
      g.firsts.slice(n0).forEach(function (f) { if (f.at >= plan.start) { delete f.old; out.firsts.push(f); } });
      out.seeded = true;
    } else if (atlasMode(plan.mode) && isArray(plan.log)) {
      plan.log.forEach(function (x) {
        if (!x || (x.oc !== 0 && x.oc !== 1)) return;
        var def = defOf(x.exId), p = null;
        if (!def || def.role !== 'train') return;
        try { p = PX.ex.decodeParams(def, x.code); } catch (e) { p = null; }
        if (!p) return;
        var f = tally(g, def, p, x.oc === 1, isNum(x.g) ? x.g : chanceOf(def, p), now, false);
        if (f) out.firsts.push(f);
      });
    }
    // Reach and grades move only with a new best block (res.bests: Train and Path): each part before this
    // session is the larger of its kept part and its best before (b.previous for this session's new bests)
    var bests = isArray(res.bests) ? res.bests : [], k = isObj(g.reach.bests) ? g.reach.bests : (g.reach.bests = {});
    var prevBest = {};
    bests.forEach(function (b) { prevBest[b.exId] = isNum(b.previous) ? b.previous : 0; });
    var before = 0, after = 0, causes = [];
    reachDefs().forEach(function (def) {
      var id = def.id, kept = isNum(k[id]) ? k[id] : 0, now1 = partOf(rec, id, k);
      var was = Math.max(kept, hasOwn.call(prevBest, id) ? prevBest[id] : now1);
      before += was; after += now1;
      if (now1 > was) causes.push({ exId: id, from: was, to: now1 });
      if (now1 > 0) k[id] = now1;
    });
    g.reach.high = Math.max(g.reach.high, after);
    out.reach = { before: before, after: after, delta: after - before, causes: causes, high: g.reach.high };
    bests.forEach(function (b) {
      var from = gradeOf(b.previous), to = gradeOf(b.level), def = defOf(b.exId);
      if (def && to > from) out.grades.push({ exId: b.exId, from: from, to: to, level: b.level, band: band(def, to) });
    });
    out.near = near(plan, rec, res);
    res.game = out; // field notes read the firsts above
    try { if (E.notes) out.notes = E.notes.check(rec, now, plan, res); } catch (e) { out.notes = []; }
    // events (the reserved kinds of CONTRACT-v1.2 O): grades, firsts, Climb runs and done notes
    if (E.events && typeof E.events.add === 'function') {
      out.grades.forEach(function (x) { E.events.add(rec, 'grade', x.exId, { grade: x.to }, now); });
      out.firsts.slice(0, 20).forEach(function (f) { E.events.add(rec, 'first', f.ex, { cell: f.cell }, now); });
      if (res.climb && plan.mode === 'climb') E.events.add(rec, 'climb', null, { attempt: res.climb.attempt, height: res.climb.height, misses: res.climb.misses, done: res.climb.complete, practice: res.climb.practice }, now);
      out.notes.forEach(function (x) { E.events.add(rec, 'note', x.note.ex || null, { note: x.note.id, phase: 'done' }, now); });
    }
    return out;
  }

  /* ---------- the container's repair and its two-tab merge ---------- */

  function firstOk(f) { return isObj(f) && typeof f.ex === 'string' && isNum(f.v) && typeof f.cell === 'string' && /^\d{1,3}\.\d{1,3}$/.test(f.cell) && isNum(f.at); }

  var CELL_RE = /^\d{1,3}\.\d{1,3}$/, WEEK_RE = /^\d{4}-\d{2}-\d{2}$/, LETTER_RE = /^[A-Z]$/;
  function int(x, lo) { return isNum(x) && x >= (lo || 0) ? Math.round(x) : null; }
  function cleanCell(x) {
    if (!isArray(x) || x.length < 4) return null;
    var n = int(x[0]), r = int(x[1]), gq = int(x[2]);
    if (n === null || r === null || gq === null || r > n || gq > 1000) return null;
    return [n, r, gq, x[3] === 1 ? 1 : 0];
  }
  function cleanRun(x) {
    if (!isObj(x)) return null;
    var h = int(x.h), m = int(x.m), r = int(x.r, 1);
    if (h === null || m === null) return null;
    var y = { r: r === null ? h + 1 : r, h: h, m: m, n: isArray(x.n) ? x.n.filter(function (v) { return int(v, 1) !== null; }).slice(0, 4) : [], t: int(x.t) || 0 };
    if (x.p === 1) y.p = 1;
    return y;
  }
  // E.record.check('game'): the named parts keep their shapes; a part that cannot be read is dropped
  // (it never throws; unknown keys stay).
  function repair(v) {
    if (!isObj(v)) return undefined;
    if (v.reach.bests !== undefined) {
      if (!isObj(v.reach.bests)) delete v.reach.bests;
      else Object.keys(v.reach.bests).forEach(function (id) { var x = v.reach.bests[id]; if (!(isNum(x) && x >= 1 && x <= 100 && Math.round(x) === x)) delete v.reach.bests[id]; });
    }
    Object.keys(v.atlas).forEach(function (id) {
      var a = v.atlas[id];
      if (!isObj(a) || !int(a.v, 1) || !isObj(a.c)) { delete v.atlas[id]; return; }
      Object.keys(a.c).forEach(function (k) { var c = CELL_RE.test(k) ? cleanCell(a.c[k]) : null; if (c) a.c[k] = c; else delete a.c[k]; });
    });
    // firsts: entries that are not objects go; an object of another shape is kept as it is (the open
    // container's rule) and every reader skips it (firstOk)
    v.firsts = v.firsts.filter(isObj);
    var c = v.climb;
    if (c.w !== undefined) {
      if (!isObj(c.w)) c.w = {};
      Object.keys(c.w).forEach(function (wk) {
        var w = c.w[wk];
        if (!WEEK_RE.test(wk) || !isObj(w)) { delete c.w[wk]; return; }
        Object.keys(w).forEach(function (a) { var y = LETTER_RE.test(a) ? cleanRun(w[a]) : null; if (y) w[a] = y; else delete w[a]; });
      });
    }
    if (c.pb !== undefined && !(isObj(c.pb) && int(c.pb.h) !== null)) delete c.pb;
    var n = v.notes;
    if (n.week !== undefined && !(typeof n.week === 'string' && WEEK_RE.test(n.week) && isArray(n.offer))) v.notes = {};
    if (v.seeded !== undefined && v.seeded !== 1) delete v.seeded;
    return v;
  }

  // Two tabs: Reach's high mark the larger; cells per cell the larger counts and handled on either side;
  // firsts the union (the earlier of one cell); Climb runs per attempt the one further up; field notes from
  // the newer side with both sides' done marks for the same week. The merged trial rows are the truth for
  // the counts, so the next session re-reads them (seeded 0).
  function merge(theirs, mine, info) {
    var rep = E.record && E.record.repair ? E.record.repair('game') : function (x) { return x; };
    var a = rep(theirs), b = rep(mine);
    if (!a && !b) return undefined;
    if (!a || !b) return a || b;
    var newer = info && info.newer === 'mine' ? b : a, older = newer === a ? b : a;
    var out = U.deepCopy(newer);
    out.reach.high = Math.max(a.reach.high, b.reach.high);
    if (isObj(a.reach.bests) || isObj(b.reach.bests)) { // each part the larger
      var kb = out.reach.bests = isObj(out.reach.bests) ? out.reach.bests : {}, ob = isObj(older.reach.bests) ? older.reach.bests : {};
      Object.keys(ob).forEach(function (id) { if (!(kb[id] >= ob[id])) kb[id] = ob[id]; });
    }
    Object.keys(older.atlas).forEach(function (id) {
      var o = older.atlas[id], m = out.atlas[id];
      if (!isObj(m) || m.v !== o.v) { if (!isObj(m) || o.v > m.v) out.atlas[id] = U.deepCopy(o); return; }
      Object.keys(o.c).forEach(function (k) {
        var x = o.c[k], y = m.c[k];
        m.c[k] = !y ? x.slice() : [Math.max(x[0], y[0]), Math.max(x[1], y[1]), Math.max(x[2], y[2]), x[3] === 1 || y[3] === 1 ? 1 : 0];
      });
    });
    var seen = {};
    out.firsts = a.firsts.concat(b.firsts).filter(function (f) {
      if (!firstOk(f)) { var j = 'x:' + JSON.stringify(f); if (hasOwn.call(seen, j)) return false; seen[j] = f; return true; } // another shape: once
      var k = f.ex + '@' + f.v + ':' + f.cell;
      if (hasOwn.call(seen, k)) { if (f.at < seen[k].at) seen[k].at = f.at; return false; }
      seen[k] = f;
      return true;
    }).sort(function (x, y) { return (isNum(x.at) ? x.at : 0) - (isNum(y.at) ? y.at : 0); });
    var ow = isObj(older.climb.w) ? older.climb.w : {}, cw = isObj(out.climb.w) ? out.climb.w : null;
    if (!cw && Object.keys(ow).length) cw = out.climb.w = {}; // only when a side has runs: a merge with itself changes nothing
    Object.keys(ow).forEach(function (wk) {
      var w = cw[wk] || (cw[wk] = {});
      Object.keys(ow[wk]).forEach(function (l) {
        var x = ow[wk][l], y = w[l];
        if (!y || (y.p === 1 && x.p !== 1) || (!!y.p === !!x.p && x.r > y.r)) w[l] = U.deepCopy(x);
      });
    });
    var pa = isObj(a.climb.pb) ? a.climb.pb : null, pb = isObj(b.climb.pb) ? b.climb.pb : null;
    if (pa || pb) out.climb.pb = U.deepCopy(!pa ? pb : !pb ? pa : pb.h > pa.h ? pb : pa);
    if (isObj(older.notes) && isObj(out.notes) && older.notes.week === out.notes.week && isObj(older.notes.done)) {
      if (!isObj(out.notes.done)) out.notes.done = {};
      Object.keys(older.notes.done).forEach(function (k) { if (!hasOwn.call(out.notes.done, k)) out.notes.done[k] = older.notes.done[k]; });
    }
    delete out.seeded;
    return out;
  }

  // A changed level scale (E.rebase.register: after the exercise's best block is converted): its kept Reach
  // part moves with the same conversion, and the high mark becomes the sum of the parts on the new scales. A
  // record whose parts were never kept takes them from the (converted) best blocks first.
  function convertReach(rec, id, cv) {
    if (!isObj(rec) || !isObj(rec.game) || !isObj(rec.game.reach)) return;
    var r = rec.game.reach;
    if (!isObj(r.bests)) { r.bests = {}; reachDefs().forEach(function (def) { var b = bestOf(rec, def.id); if (b) r.bests[def.id] = b.level; }); }
    else if (isNum(r.bests[id])) r.bests[id] = cv(r.bests[id]);
    r.high = reachDefs().reduce(function (s, def) { return s + partOf(rec, def.id, r.bests); }, 0);
  }
  if (E.rebase && typeof E.rebase.register === 'function') E.rebase.register(convertReach);

  // The start hook seeds the Atlas of a record from before the game layer, before its first item (so a
  // block end can name this session's firsts); the finish hook (after the session is stored, before the
  // weekly goal and achievements; CONTRACT Q) counts the session.
  E.modes.hook('start', function (plan, rec) {
    if (!rec || plan.unavailable) return;
    var g = game(rec);
    if (g.seeded !== 1) { seedAtlas(rec, g); plan.gameSeeded = true; }
  }, { id: 'game.seed', order: 40 });
  E.modes.hook('finish', function (plan, rec, now, res) { update(plan, rec, now, res); }, { id: 'game.finish', order: 40 });
  if (E.record && typeof E.record.check === 'function') E.record.check('game', repair);
  if (E.events && typeof E.events.define === 'function') {
    E.events.define('grade', { owner: 'W3-game', fields: { grade: 'int' } });
    E.events.define('first', { owner: 'W3-game', fields: { cell: 'token' } });
    E.events.define('climb', { owner: 'W3-game', fields: { attempt: 'token', height: 'int', misses: 'int', done: 'bool', practice: 'bool' } });
    E.events.define('note', { owner: 'W3-game', fields: { note: 'token', phase: 'token' } });
  }

  E.game = {
    ATLAS: ATLAS, RANKS: RANKS, game: game, gradeOf: gradeOf, band: band, bestOf: bestOf, grades: grades, reach: reach, rank: rank,
    atlasDims: atlasDims, cellOf: cellOf, tail: tail, handledBy: handledBy, atlas: atlas, cellEase: cellEase, displayFor: displayFor,
    withinReach: withinReach, fresh: fresh, update: update, merge: merge, repair: repair, firstOk: firstOk, pending: pending,
    _: { tally: tally, seedAtlas: seedAtlas, slotOf: slotOf, chanceOf: chanceOf, atlasMode: atlasMode, trainDefs: trainDefs, reachDefs: reachDefs, defOf: defOf, near: near, convertReach: convertReach },
  };
})(window.PX);
