/* PR-5 Level: definition, geometry conventions, validator negatives, 10 000+ seeds re-measured from the
   drawn segments, shortcut solvers, alternate forms and the spread of the item model.
   Run through tests/node/run.mjs. */
import { MANIFEST } from './run.mjs';

const FILE = 'js/ex/level/gen.js';
const LEARN = 'js/ex/level/learn.js';
const SEEDS_TOTAL = 10000;
// The core and the registry only (all a generator needs), so engine files being edited never break these checks.
const CORE = MANIFEST.filter((f) => f.startsWith('js/core/') || f === 'js/ex/registry.js');
// Captions js/ex/level/view.js reads (tag_<kind> for every foil family the generator uses).
const CAPTIONS = ['uprightWater', 'uprightPlumb', 'tiltedWater', 'tiltedPlumb', 'options', 'guideWater', 'guidePlumb', 'matchWater', 'matchPlumb',
  'answer', 'tagLevel', 'tagDown', 'verdictWater', 'verdictPlumb'].concat(['frame', 'side', 'half', 'over', 'beyond', 'steep', 'near'].map((k) => 'kind_' + k));

export async function run(t) {
  // This probe alone (plus the core), so another exercise being edited never breaks these checks.
  const PX = t.context({ files: [...CORE, FILE, LEARN] }).PX;
  const X = PX.ex, def = X.get('level'), L = def && def.lib;
  t.ok(def && L, 'level is defined with its lib');
  if (!def) return;
  testDefinition(t, X, def, L);
  testLearn(t, PX, def, (it, kind) => kind === it.task, ['task']);
  t.ok([null, undefined, -1, 4, 1.5, '0', [0], {}].every((r) => [0, 1, 2, 3].every((k) => def.score({ key: k }, r).correct === false)), 'malformed responses score wrong');
  testValidator(t, PX, def, L);
  testSeeds(t, PX, X, def, L);
}

// Deviation (degrees, counterclockwise) of a drawn option from the true direction, measured with Math.
function measured(it, o) {
  const [a, b] = o.p, dx = b[0] - a[0], dy = b[1] - a[1];
  return it.task === 'water' ? Math.atan2(dy, dx) * 180 / Math.PI : Math.atan2(dx, -dy) * 180 / Math.PI;
}

function testDefinition(t, X, def, L) {
  t.section('definition');
  t.eq([def.id, def.version, def.code, def.role, def.answer, def.nOptions, def.cell], ['level', 1, 'PR-5', 'probe', 'choice', 4, 'extrinsic-static'], 'id, version, code, role, answer, options, cell');
  t.eq([...def.abilities], ['Vz'], 'abilities');
  t.eq(def.chance({}), 0.25, 'chance 1/4');
  t.eq(def.dims.map((d) => d.key), ['tilt', 'task', 'gap'], 'dims');
  const lo = X.minDifficulty(def), hi = X.maxDifficulty(def);
  t.ok(hi - lo >= 4, `difficulty range ≥ 4 logits (${lo.toFixed(2)} … ${hi.toFixed(2)})`);
  let err = 0;
  for (let a = -400; a <= 400; a += 0.29) {
    const [s, c] = L.sincos(a);
    err = Math.max(err, Math.abs(s - Math.sin(a * Math.PI / 180)), Math.abs(c - Math.cos(a * Math.PI / 180)));
  }
  t.ok(err < 1e-12, `polynomial sincos matches Math.sin/cos (max error ${err.toExponential(1)})`);
  const G = L.GLASS, taper = Math.atan((G.top - G.base) / 2 / G.height) * 180 / Math.PI;
  t.ok(Math.abs(taper - L.TAPER) < 0.05, `TAPER ${L.TAPER}° matches the drawn walls (${taper.toFixed(3)}°)`);
  t.ok(L.TILT_BINS[0][0] >= Math.max(...L.GAPS), 'the smallest tilt is at least the largest gap, so the base-parallel foil always fits');
  const o = L.outlineOf('water', 20);
  t.ok(o[1][1] > o[0][1], 'a positive tilt turns the glass counterclockwise (the right end of the base rises)');
  t.near(Math.atan2(o[1][1] - o[0][1], o[1][0] - o[0][0]) * 180 / Math.PI, 20, 0.01, 'the drawn base lies at the tilt (coordinates rounded to 1e-4)');
}

function testValidator(t, PX, def, L) {
  t.section('validator');
  for (const task of [0, 1]) {
    const p = { tilt: 2, task, gap: 2 };
    const it = def.generate(PX.rng(PX.rng.hash('lv-neg', task)), p), name = L.TASKS[task];
    t.ok(def.validate(it) === true, `${name}: a generated item passes`);
    const copy = () => JSON.parse(JSON.stringify(it));
    const k = it.key, foil = (k + 1) % 4, cases = [];
    let b = copy(); b.key = foil; cases.push(['the key on a foil', b]);
    b = copy(); b.options[foil].dev += 5; cases.push(['a foil drawn at another angle than its dev', b]);
    b = copy();
    const g = L.GAPS[p.gap], local = it.task === 'water' ? [0, rotBack(it.anchor, it.tilt)[1]] : [0, L.FRAME.size / 2 - L.FRAME.pin];
    const seg = L.segment(it.task, it.tilt, local, g / 2);
    if (seg) { b.options[foil] = { dev: g / 2, kind: 'near', p: seg }; cases.push(['a foil closer than the gap', b]); }
    b = copy(); b.options[foil] = JSON.parse(JSON.stringify(b.options[(foil + 1) % 4 === k ? (foil + 2) % 4 : (foil + 1) % 4])); cases.push(['two identical options', b]);
    b = copy(); b.outline[2][0] += 0.2; cases.push(['another container shape', b]);
    b = copy(); b.tilt = b.tilt > 0 ? 60 : -60; cases.push(['a tilt outside its level', b]);
    b = copy(); b.task = it.task === 'water' ? 'plumb' : 'water'; cases.push(['the other task', b]);
    b = copy(); b.options[k].p = b.options[k].p.map(([x, y]) => [x, y + 0.1]); cases.push(['a key line moved off the anchor (or the pin)', b]);
    for (const [what, item] of cases) t.ok(def.validate(item) !== true, `${name}: validate() rejects ${what}`);
  }
}
function rotBack(p, deg) { const a = -deg * Math.PI / 180; return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)]; }

/* ---------------------------------------------------------------- 10 000+ seeds */

function pickBy(vals, better) { let b = 0; for (let i = 1; i < vals.length; i++) if (better(vals[i], vals[b])) b = i; return b; }
// "parallel to the base": the line most nearly parallel to the drawn base (water) or sides (plumb);
// the rest are stem-blind: they see only the four lines' angles on the page.
const SHORTCUTS = {
  'parallel to the base': (it) => {
    const O = it.outline, ref = it.task === 'water' ? [O[1][0] - O[0][0], O[1][1] - O[0][1]] : [O[0][0] - O[3][0], O[0][1] - O[3][1]];
    return pickBy(it.options.map((o) => { const d = [o.p[1][0] - o.p[0][0], o.p[1][1] - o.p[0][1]]; return Math.abs(d[0] * ref[1] - d[1] * ref[0]) / Math.hypot(...d) / Math.hypot(...ref); }), (a, b) => a < b);
  },
  'middle angle': (it) => { const a = it.options.map((o) => measured(it, o)), m = a.reduce((s, x) => s + x, 0) / 4; return pickBy(a.map((x) => Math.abs(x - m)), (u, v) => u < v); },
  'second smallest angle': (it) => it.options.map((o, i) => [measured(it, o), i]).sort((u, v) => u[0] - v[0])[1][1],
  'second largest angle': (it) => it.options.map((o, i) => [measured(it, o), i]).sort((u, v) => u[0] - v[0])[2][1],
  'odd one out': (it) => { const a = it.options.map((o) => measured(it, o)), m = a.reduce((s, x) => s + x, 0) / 4; return pickBy(a.map((x) => Math.abs(x - m)), (u, v) => u > v); },
  'most like the others': (it) => { const a = it.options.map((o) => measured(it, o)); return pickBy(a.map((x) => a.reduce((s, y) => s + Math.abs(x - y), 0)), (u, v) => u < v); },
};

function testSeeds(t, PX, X, def, L) {
  t.section('seeds');
  const combos = X.enumerate(def), per = Math.ceil(SEEDS_TOTAL / combos.length);
  const other = t.context({ files: [...CORE, FILE] }).PX.ex.get('level');
  const c = { n: 0, threw: 0, invalid: 0, keyWrong: 0, otherRight: 0, nondet: 0, crossdet: 0, json: 0, meta: 0, within1: 0, gapLow: 0, gapHigh: 0 };
  let firstBad = null;
  const times = [], hardTimes = [], keyPos = [0, 0, 0, 0], perCombo = {};
  const acc = Object.fromEntries(Object.keys(SHORTCUTS).map((nm) => [nm, { right: 0, n: 0, lv: {} }]));
  const forms = [0, 1, 2].map(() => ({ n: 0, tilt: 0, gap: 0, kinds: {} }));
  for (const p of combos) {
    const code = X.paramsCode(def, p), lv = `tilt ${p.tilt} task ${p.task} gap ${p.gap}`, g = L.GAPS[p.gap], tol = L.tolOf(g);
    const hardest = p.tilt === 3 && p.task === 1 && p.gap === 3;
    for (let s = 0; s < per; s++) {
      const seed = PX.rng.hash('level', code, s);
      let it;
      const t0 = process.cpuUsage();
      try { it = def.generate(PX.rng(seed), p); } catch (e) { c.threw++; firstBad = firstBad || 'threw: ' + e.message; continue; }
      const cpu = process.cpuUsage(t0), ms = (cpu.user + cpu.system) / 1000;   // CPU time: robust when other jobs load the machine
      times.push(ms);
      if (hardest) hardTimes.push(ms);
      c.n++;
      perCombo[code] = (perCombo[code] || 0) + 1;
      const ok = def.validate(it);
      if (ok !== true) { c.invalid++; firstBad = firstBad || `invalid (${JSON.stringify(p)} seed ${seed}): ${ok}`; }
      if (!def.score(it, it.key).correct) c.keyWrong++;
      for (let i = 0; i < 4; i++) if (i !== it.key && def.score(it, i).correct) c.otherRight++;
      if (it.seed !== seed || JSON.stringify(it.params) !== JSON.stringify(p)) c.meta++;
      const text = JSON.stringify(it);
      if (JSON.stringify(JSON.parse(text)) !== text) c.json++;
      if (JSON.stringify(def.generate(PX.rng(seed), p)) !== text) c.nondet++;
      if (s % 20 === 0 && JSON.stringify(other.generate(PX.rng(seed), p)) !== text) c.crossdet++;
      keyPos[it.key]++;
      // Re-measured with Math.atan2 from the drawn segments, independently of validate().
      const devs = it.options.map((o) => measured(it, o));
      if (devs.filter((d) => Math.abs(d) <= 1).length !== 1 || Math.abs(devs[it.key]) > 1) c.within1++;
      const foils = devs.filter((_, i) => i !== it.key).map(Math.abs), nearest = Math.min(...foils);
      if (nearest < g - 0.05) c.gapLow++;
      if (nearest > g + tol + 0.05) c.gapHigh++;
      for (const [name, fn] of Object.entries(SHORTCUTS)) {
        const a = acc[name], right = fn(it) === it.key ? 1 : 0;
        a.right += right; a.n++;
        a.lv[lv] = a.lv[lv] || [0, 0]; a.lv[lv][0] += right; a.lv[lv][1]++;
      }
      const f = forms[s % 3];
      f.n++; f.tilt += Math.abs(it.tilt); f.gap += nearest;
      it.options.forEach((o) => { f.kinds[o.kind] = (f.kinds[o.kind] || 0) + 1; });
    }
  }
  t.ok(c.n >= SEEDS_TOTAL, `at least ${SEEDS_TOTAL} seeds across all ${combos.length} combinations (${c.n})`);
  t.eq(Object.keys(perCombo).length, combos.length, 'every combination generated');
  t.eq(c.threw, 0, 'generate never throws' + (firstBad ? ' — ' + firstBad : ''));
  t.eq(c.invalid, 0, 'validate passes on every item' + (firstBad ? ' — ' + firstBad : ''));
  t.eq(c.keyWrong, 0, 'the key scores right');
  t.eq(c.otherRight, 0, 'every other option scores wrong');
  t.eq(c.within1, 0, 'measured: exactly one line within 1° of the true direction, the key');
  t.eq(c.gapLow, 0, 'measured: every foil at least the level\'s gap away');
  t.eq(c.gapHigh, 0, 'measured: the nearest foil within 15 % of the gap');
  t.eq(c.meta, 0, 'items carry their seed and params');
  t.eq(c.json, 0, 'items are JSON round-trip safe');
  t.eq(c.nondet, 0, 'same seed and params give the same item');
  t.eq(c.crossdet, 0, 'the same item in a separately loaded context');
  const p95 = quant(times, 0.95), hardP95 = quant(hardTimes, 0.95);
  t.ok(p95 < 20 && hardP95 < 20, `generation p95 under 20 ms of CPU time (all ${p95.toFixed(3)} ms, hardest level ${hardP95.toFixed(3)} ms)`);
  t.eq(L.stats.fallbacks, 0, 'no item needed the fallback');
  for (const p of combos) { const fb = L.fallback(p); if (fb.fallback !== true || def.validate(Object.assign(fb, { params: p })) !== true) t.fail('fallback invalid or not marked for ' + JSON.stringify(p)); }

  keyPos.forEach((k, i) => t.ok(Math.abs(k / c.n - 0.25) < 0.02, `the key is option ${i} ${pct(k / c.n)} of the time`));
  const spread = (fn) => { const v = forms.map(fn); return Math.max(...v) - Math.min(...v); };
  t.ok(spread((f) => f.tilt / f.n) < 0.5, 'forms: the same mean tilt (within 0.5°)');
  t.ok(spread((f) => f.gap / f.n) < 0.3, 'forms: the same mean gap to the nearest foil (within 0.3°)');
  for (const kind of ['frame', 'half', 'over', 'near', 'side', 'beyond', 'steep']) {
    t.ok(spread((f) => (f.kinds[kind] || 0) / f.n) < 0.04, `forms: the same share of "${kind}" foils`);
  }

  const lines = [];
  for (const [name, a] of Object.entries(acc)) {
    const pooled = a.right / a.n, levels = Object.values(a.lv).map(([r, n]) => r / n);
    t.ok(pooled <= 0.35, `shortcut "${name}" pooled ${pct(pooled)} ≤ 35 %`);
    if (name === 'parallel to the base') t.ok(levels.every((x) => x <= 0.35), 'shortcut "parallel to the base" ≤ 35 % at every level');
    lines.push(`${name} ${pct(pooled)} (worst level ${pct(Math.max(...levels))})`);
  }
  console.log(`       PR-5 level: ${c.n} items, p95 ${p95.toFixed(3)} ms; shortcuts: ${lines.join('; ')}`);
  console.log(`       PR-5 spread: ${spreadLine(X, def)}`);
}

function spreadLine(X, def) {
  const bs = X.enumerate(def).map((p) => def.difficulty(p)).sort((a, b) => a - b);
  let gap = 0;
  for (let i = 1; i < bs.length; i++) gap = Math.max(gap, bs[i] - bs[i - 1]);
  const lo = bs[0], hi = bs[bs.length - 1], bins = [];
  for (let x = lo; x < hi + 1e-9; x += 1) bins.push(bs.filter((b) => b >= x - 1e-9 && (b < x + 1 - 1e-9 || (x + 1 > hi && b <= hi + 1e-9))).length);
  return `${bs.length} combinations over ${lo.toFixed(2)} … ${hi.toFixed(2)} (${(hi - lo).toFixed(2)} logits), largest gap ${gap.toFixed(2)}, per 1-logit bin ${bins.join(' ')}`;
}
function quant(a, q) { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; }
function pct(x) { return Math.round(100 * x) + ' %'; }

/* ---------------------------------------------------------------- learn data */

// The one-screen instruction, the worked examples (fixed seeds of the stated kind, easiest level)
// and every caption the view uses; probe wording (no practice, no praise, no IQ claims).
function testLearn(t, PX, def, kindOk, freeDims = []) {
  t.section('learn');
  const Ld = PX.ex.learn(def.id);
  t.ok(Ld && typeof Ld.goal === 'string' && Ld.goal.length > 10, 'learn.js registers a goal');
  if (!Ld) return;
  t.ok(Array.isArray(Ld.parts) && Ld.parts.length >= 3 && Ld.parts.every((p) => p.id && p.label && p.text), 'labelled parts');
  t.ok(Ld.instruction && Ld.instruction.title === def.name && Array.isArray(Ld.instruction.lines) && Ld.instruction.lines.length >= 2, 'a one-screen instruction titled with the probe name');
  t.ok(Array.isArray(Ld.demo) && Ld.demo.length >= 1, 'at least one worked example');
  (Ld.demo || []).forEach((d, i) => {
    t.ok(PX.ex.validParams(def, d.params) === true && Number.isInteger(d.seed), `example ${i}: valid params and a fixed seed`);
    t.ok(def.dims.every((dim) => freeDims.includes(dim.key) || d.params[dim.key] === 0), `example ${i} is at the easiest level`);
    const it = def.generate(PX.rng(d.seed), d.params);
    t.ok(def.validate(it) === true && kindOk(it, d.kind), `example ${i} (seed ${d.seed}) gives a valid "${d.kind}" item`);
  });
  const missing = CAPTIONS.filter((k) => !(Ld.captions && typeof Ld.captions[k] === 'string' && Ld.captions[k].length));
  t.eq(missing, [], 'every caption the view uses exists');
  t.ok(!/\bIQ\b|smarter|mastered|genius|brain age|well done|great job/i.test(JSON.stringify(Ld)), 'wording: no IQ, "smarter", "mastered" or praise');
  t.ok(!Ld.practice || Ld.practice.length === 0, 'no practice items (a probe is never trained)');
}
