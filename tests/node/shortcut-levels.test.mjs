/* PLAN milestone 7's acceptance, "shortcut solvers within chance + 10 at every dimension level" (note P1 §4.4
   guard (a); CLAUDE.md rule 5). Per-dimension offsets push a player's strong dimension further, so a cheap
   heuristic that pays at some levels of a dimension would make that dimension look strong. Rule 5's bound
   on each item pool is therefore checked on each level of each dimension.

   Each exercise's own test file keeps its shortcut solvers (one implementation) and exports, in a marked
   block at its end:
     shortcutScores(PX, def, item) → { <solver name>: { hit, chance } }   hit: the solver's expected accuracy
                                    on this item (ties shared); chance: the rate it is bounded against
     SHORTCUT_EXEMPT              names reported without a bound (scoped exceptions in DECISIONS)
     shortcutItems(PX, def) → [{ params, item }] (optional: the items to judge, when generating
                                    10 000 of them again would be slow)
   Where gen.js itself exposes the solvers (BUILTIN below), this file reads them there. For every exercise
   that has scores, this test generates at least 10 000 items over every combination (unless the file
   gives its items), averages hit and chance per level of every dimension, and checks
   hit ≤ chance + 0.10 in each cell of at least 200 items. Exercises without scores yet are listed as
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
};

async function loadScores(root, id) {
  if (BUILTIN[id]) return { scores: BUILTIN[id].scores, exempt: BUILTIN[id].exempt || [], items: null, from: 'gen.js' };
  const file = path.join(root, 'tests/node', id + '.test.mjs');
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8');
  if (!/export\s+function\s+shortcutScores\b/.test(src)) return null;
  const mod = await import(pathToFileURL(file).href);
  return { scores: mod.shortcutScores, exempt: Array.isArray(mod.SHORTCUT_EXEMPT) ? mod.SHORTCUT_EXEMPT : [], items: typeof mod.shortcutItems === 'function' ? mod.shortcutItems : null, from: id + '.test.mjs' };
}

function* itemsOf(PX, def) {
  const combos = PX.ex.enumerate(def), per = Math.max(1, Math.ceil(N_ITEMS / combos.length));
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
  for (const def of PX.ex.list('train')) {
    const sc = await loadScores(t.root, def.id);
    if (!sc) { pending.push(def.id); continue; }
    t.section('shortcut solvers per dimension level: ' + def.id + ' (' + sc.from + ')');
    const cells = new Map(); // `${solver}|${dim}=${level}` → { n, hit, ch }
    let n = 0, bad = 0;
    const src = sc.items ? sc.items(PX, def) : itemsOf(PX, def);
    for (const { params, item } of src) {
      let s;
      try { s = sc.scores(PX, def, item); } catch (e) { bad++; continue; }
      n++;
      for (const [name, v] of Object.entries(s || {})) {
        if (!v || typeof v.hit !== 'number' || typeof v.chance !== 'number') continue;
        for (const dim of def.dims) {
          if (dim.levels.length < 2) continue;
          const key = name + '|' + dim.key + '=' + params[dim.key];
          const c = cells.get(key) || { n: 0, hit: 0, ch: 0 };
          c.n++; c.hit += v.hit; c.ch += v.chance;
          cells.set(key, c);
        }
      }
    }
    t.eq(bad, 0, def.id + ': the scores never throw');
    t.ok(n >= Math.min(N_ITEMS, 10000) || !!sc.items, def.id + ': at least ' + Math.min(N_ITEMS, 10000) + ' items (' + n + ')');
    let worst = null, over = [], info = [];
    for (const [key, c] of cells) {
      if (c.n < MIN_CELL) continue;
      const name = key.split('|')[0], gap = (c.hit - c.ch) / c.n;
      if (sc.exempt.includes(name)) { if (gap > 0.10) info.push(key + ' ' + (100 * gap).toFixed(1)); continue; }
      if (!worst || gap > worst.gap) worst = { key, gap, n: c.n };
      if (gap > 0.10) over.push(key + ' +' + (100 * gap).toFixed(1));
    }
    t.ok(over.length === 0, def.id + ': every solver within chance + 10 points at every dimension level' + (worst ? ' (closest: ' + worst.key + ' ' + (worst.gap >= 0 ? '+' : '') + (100 * worst.gap).toFixed(1) + ' over ' + worst.n + ' items)' : '') + (over.length ? '; over: ' + over.slice(0, 5).join(', ') : ''));
    if (info.length) console.log('       ' + def.id + ': reported, not bounded (' + sc.exempt.join(', ') + '): ' + info.slice(0, 6).join(', '));
    done.push(def.id);
  }
  console.log('       shortcut-levels: checked ' + (done.join(', ') || 'none') + '; pending (no per-item scores exported yet): ' + (pending.join(', ') || 'none'));
  t.ok(done.length + pending.length === PX.ex.list('train').length, 'every training exercise is checked or listed as pending');
}
