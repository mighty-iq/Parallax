/* PLAN milestone 7's acceptance, "shortcut solvers within chance + 10 at every dimension level" (note P1 §4.4
   guard (a); CLAUDE.md rule 5). Per-dimension offsets push a player's strong dimension further, so a cheap
   heuristic that pays at some levels of a dimension would make that dimension look strong. Rule 5's bound
   on each item pool is therefore checked on each level of each dimension.

   Each exercise's own test file keeps its shortcut solvers and exports, in a marked block at its end:
     shortcutScores(PX, def, item, params) → { <solver name>: entry }, one entry per solver:
        { hit, chance }            hit: the solver's expected accuracy on this item (ties shared); chance: the
                                   rate it is bounded against
        { score, label, chance }   a threshold solver on a yes/no item: the cue's value and the item's key;
                                   in each cell the best threshold (either direction) is fitted on half the
                                   items and scored on the other half, both ways (two-fold cross-validation)
        info: true (either kind)   reported, not bounded (the file's own test scopes it, e.g. Track's slowest
                                   speed third); such items do not enter the bounded cells
     SHORTCUT_EXEMPT              names reported without a bound (scoped exceptions in DECISIONS)
     shortcutItems(PX, def) → [{ params, item }] (optional: the items to judge, when generating
                                    10 000 of them again would be slow)
   Where gen.js itself exposes the solvers (BUILTIN below), this file reads them there. For every exercise
   that has scores, this test generates at least 10 000 items over every combination (unless the file
   gives its items), and checks in each cell (solver × level of a dimension) of at least 200 items that the
   solver's accuracy is at most the cell's mean chance + 0.10. A cell over the bound by less than two
   standard errors of its own accuracy is printed as sampling noise, not failed (cells of 200–300 items
   would otherwise fail at random near the bound); cells listed in KNOWN below are printed, not failed. Exercises without scores yet are listed as
   pending (docs/dev/v1.2/requests.md, 18 Nov 22:11 UTC); the list is printed, not failed. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const N_ITEMS = +(process.env.PX_TEST_ITEMS || 10000);
const MIN_CELL = 200;

// Exercises whose gen.js exposes its shortcut solvers in the form the exercise test bounds them.
const BUILTIN = {
  // Hidden (tests/node/hidden.test.mjs): lib.solvers[k](item) gives each option's probability; bounded at
  // chance + 10 (five options); localPairs is reported there with its own looser bound at 32 extra lines.
  hidden: {
    scores(PX, def, item) {
      const S = def.lib.solvers, out = {}, ch = def.chance(item.params || {});
      for (const k of ['mostSegments', 'fewestSegments', 'histogram', 'mostLikeOthers', 'oddOneOut', 'largest']) out[k] = { hit: S[k](item)[item.key], chance: ch };
      out.localPairs = { hit: S.localPairs(item)[item.key], chance: ch };
      return out;
    },
    exempt: ['localPairs'],
  },
  // Span (tests/node/span.test.mjs): lib.solvers[k](item) gives an answer. Each is bounded against a random
  // answer that knows as much as it does: the set-aware ones (they know which blocks lit) against a random
  // order of the lit blocks (1/L!; nearest knows the start: 1/(L−1)!), the blind ones against a random
  // sequence of L of the N blocks ((N−L)!/N!; nearest, which knows the start: (N−L)!/(N−1)!); "ignore the
  // turn" only on turned items.
  span: {
    scores(PX, def, item) {
      const S = def.lib.solvers, L = item.len, N = item.after.length, hit = (k) => (def.score(item, S[k](item)).correct ? 1 : 0), out = {};
      out.readingOrder = { hit: hit('readingOrder'), chance: 1 / FACT[L] };
      out.nearest = { hit: hit('nearest'), chance: 1 / FACT[L - 1] };
      out.readingOrderBlind = { hit: hit('readingOrderBlind'), chance: FACT[N - L] / FACT[N] };
      out.nearestBlind = { hit: hit('nearestBlind'), chance: FACT[N - L] / FACT[N - 1] };
      if (item.turn) out.ignoreTurn = { hit: hit('ignoreTurn'), chance: 0 };
      return out;
    },
    exempt: [],
  },
};
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];

// Cells over the bound when this check first ran (18 Nov 2026, W2-progress), each a request to the exercise's
// owner in docs/dev/v1.2/requests.md and a failed acceptance line in docs/dev/v1.2/progress-sim.md: they are
// printed on every run, not failed, so the suite stays usable while the generators are rebalanced; a known
// cell fails again if it grows by more than 2 points, and any other cell over the bound fails. Delete an
// entry when its generator is fixed. (gap: accuracy − chance at that run)
// Scoped exceptions (CLAUDE.md rule 5: a DECISIONS line and a cap): one list in the engine, E.dims.scoped
// (js/engine/dims.js), which leading and fluency items also stay off. Each entry with a cell named by params
// and a cap is checked here on the cell itself (every key of its when; at least MIN_CELL items), at its cap
// instead of chance + 10; a level cell that a one-key entry covers is reported, not bounded.
const KNOWN = {
};

// Two-fold cross-validated accuracy of the best single threshold (either direction) on a yes/no cue.
function cvThreshold(s, y) {
  const fit = (I) => {
    const v = I.map((i) => [s[i], y[i]]).sort((a, b) => a[0] - b[0]), N = v.length, Y = v.filter((x) => x[1]).length;
    let best = { acc: Y / N, tau: -Infinity, flip: false }, noBelow = 0, yesBelow = 0;
    if (1 - Y / N > best.acc) best = { acc: 1 - Y / N, tau: -Infinity, flip: true };
    for (let i = 0; i < N; i++) {
      if (v[i][1]) yesBelow++; else noBelow++;
      if (i + 1 < N && v[i + 1][0] === v[i][0]) continue;
      const tau = i + 1 < N ? (v[i][0] + v[i + 1][0]) / 2 : Infinity, up = (noBelow + Y - yesBelow) / N;
      if (up > best.acc) best = { acc: up, tau, flip: false };
      if (1 - up > best.acc) best = { acc: 1 - up, tau, flip: true };
    }
    return best;
  };
  const all = s.map((_, i) => i), A = all.filter((i) => i % 2 === 0), B = all.filter((i) => i % 2 === 1);
  const test = (I, m) => I.filter((i) => ((s[i] > m.tau) !== m.flip) === y[i]).length;
  return (test(B, fit(A)) + test(A, fit(B))) / all.length;
}

async function loadScores(root, id) {
  if (BUILTIN[id]) return { scores: BUILTIN[id].scores, exempt: BUILTIN[id].exempt || [], items: null, from: 'gen.js' };
  const file = path.join(root, 'tests/node', id + '.test.mjs');
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8');
  if (!/export\s+function\s+shortcutScores\b/.test(src)) return null;
  const mod = await import(pathToFileURL(file).href);
  return { scores: mod.shortcutScores, exempt: Array.isArray(mod.SHORTCUT_EXEMPT) ? mod.SHORTCUT_EXEMPT : [], items: typeof mod.shortcutItems === 'function' ? mod.shortcutItems : null, from: id + '.test.mjs' };
}

// The trained combinations (a variant outside def.trainVariants, such as a produce form, is never dealt as a
// training item with options).
function* itemsOf(PX, def) {
  const tv = def.trainVariants, combos = PX.ex.enumerate(def).filter((p) => !tv || p.variant === undefined || tv.includes(p.variant));
  const per = Math.max(1, Math.ceil(N_ITEMS / combos.length));
  for (let ci = 0; ci < combos.length; ci++) {
    for (let s = 0; s < per; s++) {
      const params = combos[ci];
      let item = null;
      try { item = def.generate(PX.rng(PX.rng.hash('shortcut-levels', def.id, ci, s)), params); } catch (e) { item = null; }
      if (item && !item.fallback) yield { params, item };
    }
  }
}

export async function run(t) {
  const PX = t.PX, pending = [], done = [];
  const only = (process.env.PX_SHORTCUT_IDS || '').split(',').filter(Boolean); // e.g. PX_SHORTCUT_IDS=spin,fold
  for (const def of PX.ex.list('train')) {
    if (only.length && !only.includes(def.id)) { pending.push(def.id + ' (filtered)'); continue; }
    const sc = await loadScores(t.root, def.id);
    if (!sc) { pending.push(def.id); continue; }
    t.section('shortcut solvers per dimension level: ' + def.id + ' (' + sc.from + ')');
    const cells = new Map(); // `${solver}|${dim}=${level}` → { n, hit, ch, s, y } (s, y: threshold cues)
    const scoped = ((PX.engine.dims && PX.engine.dims.scoped) || []).filter((e) => e.ex === def.id && e.when && (typeof e.cap === 'number' || typeof e.over === 'number'));
    const covered = new Set(), ecells = scoped.map((e) => ({ e, per: {} }));
    scoped.forEach((e) => { const ks = Object.keys(e.when); if (ks.length === 1) e.solvers.forEach((sv) => covered.add(sv + '|' + ks[0] + '=' + e.when[ks[0]])); });
    const inCell = (w, p) => Object.keys(w).every((k) => p[k] === w[k]);
    let n = 0, bad = 0, firstErr = '';
    const src = sc.items ? sc.items(PX, def) : itemsOf(PX, def);
    const t0 = Date.now();
    for (const { params, item } of src) {
      let s;
      try { s = sc.scores(PX, def, item, params); } catch (e) { bad++; if (!firstErr) firstErr = e.message; continue; }
      n++;
      for (const ec of ecells) {
        if (!inCell(ec.e.when, params)) continue;
        for (const sv of ec.e.solvers) {
          const v = s && s[sv];
          if (!v || typeof v.chance !== 'number') continue;
          const thr = typeof v.score === 'number' && typeof v.label === 'boolean', c = ec.per[sv] || (ec.per[sv] = { n: 0, hit: 0, ch: 0, s: thr ? [] : null, y: thr ? [] : null });
          c.n++; c.ch += v.chance;
          if (thr) { c.s.push(v.score); c.y.push(v.label); } else c.hit += v.hit;
        }
      }
      for (const [name0, v] of Object.entries(s || {})) {
        if (!v || typeof v.chance !== 'number') continue;
        const thr = typeof v.score === 'number' && typeof v.label === 'boolean';
        if (!thr && typeof v.hit !== 'number') continue;
        const name = v.info ? name0 + ' (info)' : name0;
        for (const dim of def.dims) {
          if (dim.levels.length < 2) continue;
          const key = name + '|' + dim.key + '=' + params[dim.key];
          const c = cells.get(key) || { n: 0, hit: 0, ch: 0, s: thr ? [] : null, y: thr ? [] : null, info: !!v.info };
          c.n++; c.ch += v.chance;
          if (thr) { c.s.push(v.score); c.y.push(v.label); } else c.hit += v.hit;
          cells.set(key, c);
        }
      }
    }
    t.eq(bad, 0, def.id + ': the scores never throw' + (firstErr ? ' (' + firstErr + ')' : ''));
    t.ok(n >= Math.min(N_ITEMS, 10000) || !!sc.items, def.id + ': at least ' + Math.min(N_ITEMS, 10000) + ' items (' + n + ', ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
    let worst = null, nCells = 0;
    const over = [], near = [], known = [], info = [], K = KNOWN[def.id] || {};
    for (const [key, c] of cells) {
      if (c.n < MIN_CELL) continue;
      if (c.s) c.hit = c.n * cvThreshold(c.s, c.y);
      const name = key.split('|')[0], gap = (c.hit - c.ch) / c.n, acc = c.hit / c.n, se = Math.sqrt(acc * (1 - acc) / c.n);
      const tag = key + ' ' + (gap >= 0 ? '+' : '') + (100 * gap).toFixed(1) + ' (' + c.n + ')';
      if (c.info || sc.exempt.includes(name)) { if (gap > 0.10) info.push(tag); continue; }
      nCells++;
      if (!worst || gap > worst.gap) worst = { key, gap, n: c.n };
      if (gap <= 0.10) continue;
      if (covered.has(key)) { known.push(tag + ' (scoped)'); continue; }
      if (key in K) { (gap <= K[key] + 0.02 ? known : over).push(tag + (gap > K[key] + 0.02 ? ' (known at +' + (100 * K[key]).toFixed(1) + ')' : '')); continue; }
      (gap > 0.10 + 2 * se ? over : near).push(tag);
    }
    // the scoped cells themselves, at their caps
    const held = [], broke = [];
    for (const ec of ecells) {
      for (const [sv, c] of Object.entries(ec.per)) {
        if (c.n < MIN_CELL) continue;
        const acc = c.s ? cvThreshold(c.s, c.y) : c.hit / c.n, lim = typeof ec.e.cap === 'number' ? ec.e.cap : c.ch / c.n + ec.e.over;
        const tag = sv + ' at ' + Object.entries(ec.e.when).map(([k, v]) => k + '=' + v).join('&') + ' ' + (100 * acc).toFixed(1) + ' % (cap ' + (100 * lim).toFixed(0) + ' %, ' + c.n + ')';
        (acc <= lim ? held : broke).push(tag);
      }
    }
    if (held.length) console.log('       ' + def.id + ': scoped cells (E.dims.scoped) within their caps: ' + held.join(', '));
    if (scoped.length) t.ok(broke.length === 0, def.id + ': its scoped cells (E.dims.scoped) within their caps' + (held.length ? ': ' + held.join(', ') : '') + (broke.length ? '; over: ' + broke.join(', ') : ''));
    t.ok(over.length === 0, def.id + ': every solver within chance + 10 points at every dimension level (' + nCells + ' cells of ≥ ' + MIN_CELL + ' items' + (worst ? '; closest ' + worst.key + ' ' + (worst.gap >= 0 ? '+' : '') + (100 * worst.gap).toFixed(1) + ' over ' + worst.n : '') + ')' + (over.length ? '; over: ' + over.slice(0, 6).join(', ') : ''));
    if (near.length) console.log('       ' + def.id + ': over chance + 10 by less than two standard errors of the cell (sampling noise, not failed): ' + near.join(', '));
    if (known.length) console.log('       ' + def.id + ': KNOWN or scoped cells over chance + 10 (KNOWN: requests.md, 18 Nov 23:47 UTC; scoped: DECISIONS): ' + known.join(', '));
    if (info.length) console.log('       ' + def.id + ': reported, not bounded (' + (sc.exempt.concat('info').join(', ')) + '), cells over chance + 10: ' + info.slice(0, 6).join(', ') + (info.length > 6 ? ' … (' + info.length + ')' : ''));
    done.push(def.id);
  }
  console.log('       shortcut-levels: checked ' + (done.join(', ') || 'none') + '; pending (no per-item scores exported yet): ' + (pending.join(', ') || 'none'));
  t.ok(done.length + pending.length === PX.ex.list('train').length, 'every training exercise is checked or listed as pending');
}
