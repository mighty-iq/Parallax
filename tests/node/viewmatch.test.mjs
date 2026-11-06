/* PR-2 View Match: definition, camera and geometry conventions, the ray validator against the hull
   descriptors, validator negatives, 10 000+ seeds, shortcut solvers, alternate forms and the spread of the
   item model. Run through tests/node/run.mjs. */
import { MANIFEST } from './run.mjs';

const FILE = 'js/ex/viewmatch/gen.js';
const LEARN = 'js/ex/viewmatch/learn.js';
const SEEDS_TOTAL = 10000;
// The core and the registry only (all a generator needs), so engine files being edited never break these checks.
const CORE = MANIFEST.filter((f) => f.startsWith('js/core/') || f === 'js/ex/registry.js');
// Captions js/ex/viewmatch/view.js reads.
const CAPTIONS = ['overview', 'flag', 'options', 'walk', 'match', 'answer', 'tagKey', 'tagOther', 'verdict'];

export async function run(t) {
  // This probe alone (plus the core), so another exercise being edited never breaks these checks.
  const PX = t.context({ files: [...CORE, FILE, LEARN] }).PX;
  const X = PX.ex, def = X.get('viewmatch'), L = def && def.lib;
  t.ok(def && L, 'viewmatch is defined with its lib');
  if (!def) return;
  testDefinition(t, X, def);
  testLearn(t, PX, def, (it, kind) => kind === (it.flag.az > 0 ? 'flag-right' : 'flag-left'));
  t.ok([null, undefined, -1, 4, 1.5, '0', [0], {}].every((r) => [0, 1, 2, 3].every((k) => def.score({ key: k }, r).correct === false)), 'malformed responses score wrong');
  testGeometry(t, PX, def, L);
  testValidator(t, PX, def, L);
  testSeeds(t, PX, X, def, L);
}

function testDefinition(t, X, def) {
  t.section('definition');
  t.eq([def.id, def.version, def.code, def.role, def.answer, def.nOptions, def.cell], ['viewmatch', 1, 'PR-2', 'probe', 'choice', 4, 'extrinsic-dynamic'], 'id, version, code, role, answer, options, cell');
  t.eq([...def.abilities], ['PT'], 'abilities');
  t.eq(def.chance({}), 0.25, 'chance 1/4');
  t.eq(def.dims.map((d) => d.key), ['angle', 'objects', 'foils'], 'dims');
  t.eq([...def.dims[1].levels], [3, 4, 5], 'objects 3/4/5');
  const lo = X.minDifficulty(def), hi = X.maxDifficulty(def);
  t.ok(hi - lo >= 4, `difficulty range ≥ 4 logits (${lo.toFixed(2)} … ${hi.toFixed(2)})`);
}

function testGeometry(t, PX, def, L) {
  t.section('geometry');
  let err = 0;
  for (let a = -720; a <= 720; a += 0.37) {
    const [s, c] = L.sincos(a);
    err = Math.max(err, Math.abs(s - Math.sin(a * Math.PI / 180)), Math.abs(c - Math.cos(a * Math.PI / 180)));
  }
  t.ok(err < 1e-12, `polynomial sincos matches Math.sin/cos (max error ${err.toExponential(1)})`);
  t.eq([L.sep(170, -170), L.sep(-90, 90), L.sep(10, 350), L.sep(45, 45)], [20, 180, 20, 0], 'angular separation wraps');
  const C = L.CAMERA, cam90 = L.optionCam(C, 90), cam0 = L.optionCam(C, 0);
  t.ok(Math.abs(cam90.pos[0] - C.dist) < 1e-12 && Math.abs(cam90.pos[2]) < 1e-12 && cam90.pos[1] === C.height, 'azimuth 90 = the right side (+x)');
  t.ok(Math.abs(cam0.pos[2] - C.dist) < 1e-12, 'azimuth 0 = the viewer side (+z)');
  const tgt = L.project(cam0, C.target);
  t.ok(Math.abs(tgt[0]) < 1e-12 && Math.abs(tgt[1]) < 1e-12, 'the camera target projects to the picture centre');
  const stem = L.stemCam(L.STEM), right = [0.5, 0, 0];
  t.ok(L.project(stem, right)[0] > 0, 'the stem shows +x on the right');
  t.ok(L.project(L.optionCam(C, 180), right)[0] < 0 && L.project(L.optionCam(C, 0), right)[0] > 0, 'from the far side left and right swap');
  // Ray hits: straight down from the stem's height onto each shape at the table centre.
  const down = [0, 2, 0];
  for (const shape of L.SHAPES) {
    const o = { id: 'o1', shape, color: 'red', size: 'medium', x: 0, z: 0, yaw: 0, s: L.HALF.medium, h: Math.round(L.TALL[shape] * L.HALF.medium * 1000) / 1000 };
    const tHit = L.hit(L.solidOf(o, down), 0, -1, 0);
    t.near(tHit, 2 - o.h, 1e-9, `a vertical ray meets the top of the ${shape} at its height`);
    t.ok(L.hit(L.solidOf(o, down), 0.6, -0.8, 0) === Infinity, `a ray that passes beside the ${shape} misses`);
  }
  // The ID buffer agrees with the hull descriptors on generated scenes.
  let firm = 0, xd = 0, vd = 0, n = 0;
  for (let s = 0; s < 40; s++) {
    const p = { angle: s % 5, objects: s % 3, foils: (s >> 2) % 3 };
    const it = def.generate(PX.rng(PX.rng.hash('vm-geo', s)), p);
    for (const o of it.options) {
      const cam = L.optionCam(it.camera, o.az), D = L.describe(it.objects, cam), R = L.rayDescribe(it.objects, cam);
      for (const ob of it.objects) { xd = Math.max(xd, Math.abs(D.x[ob.id] - R.x[ob.id])); vd = Math.max(vd, Math.abs(D.vis[ob.id] - R.vis[ob.id])); }
      for (const k of Object.keys(D.pairs)) { n++; if (D.pairs[k] !== R.pairs[k] && D.pairs[k] !== '?' && R.pairs[k] !== '?') firm++; }
    }
  }
  t.eq(firm, 0, `rays and hulls never disagree on a firm occlusion status (${n} pairs)`);
  t.ok(xd < 0.05, `rays and hulls place object centres alike (max ${xd.toFixed(3)} of the half-width)`);
  t.ok(vd < 0.25, `rays and hulls measure visibility alike (max difference ${vd.toFixed(2)})`);
}

function testValidator(t, PX, def, L) {
  t.section('validator');
  const p = { angle: 2, objects: 2, foils: 1 };
  const it = def.generate(PX.rng(PX.rng.hash('vm-neg')), p);
  t.ok(def.validate(it) === true, 'a generated item passes');
  const copy = () => JSON.parse(JSON.stringify(it));
  const k = it.key, foil = (k + 1) % 4, cases = [];
  let b = copy(); b.key = foil; cases.push(['the key on a foil', b]);
  b = copy(); b.flag.az = b.options[k].az = 10; cases.push(['a flag outside its angle level', b]);
  b = copy(); b.options[foil].az = b.options[k].az + (b.options[k].az > 0 ? -12 : 12); cases.push(['a foil that is a tiny shift of the key', b]);
  b = copy(); b.objects[1].shape = b.objects[0].shape; cases.push(['two objects of the same shape', b]);
  b = copy(); b.objects[2].color = b.objects[0].color; cases.push(['two objects of the same colour', b]);
  b = copy(); b.objects[0].x = 0.85; b.objects[0].z = 0; cases.push(['an object off the table', b]);
  b = copy(); b.objects[1].x = b.objects[0].x; b.objects[1].z = b.objects[0].z; cases.push(['two objects in one place', b]);
  b = copy(); b.camera.fov = 30; cases.push(['other camera settings', b]);
  b = copy(); b.objects.pop(); cases.push(['too few objects for the level', b]);
  b = copy(); b.options[foil].az = 37.5; cases.push(['a fractional azimuth', b]);
  for (const [what, item] of cases) t.ok(def.validate(item) !== true, `validate() rejects ${what}`);
  // A small sphere right behind a large cube, seen from the flag: the rays must find it hidden.
  const three = def.generate(PX.rng(PX.rng.hash('vm-hide')), { angle: 1, objects: 0, foils: 0 });
  const h = JSON.parse(JSON.stringify(three)), cam = L.optionCam(h.camera, h.options[h.key].az);
  const ux = -cam.pos[0] / Math.hypot(cam.pos[0], cam.pos[2]), uz = -cam.pos[2] / Math.hypot(cam.pos[0], cam.pos[2]);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const make = (o, shape, size, x, z) => Object.assign(o, { shape, size, x: r3(x), z: r3(z), yaw: 0, s: L.HALF[size], h: r3(L.TALL[shape] * L.HALF[size]) });
  make(h.objects[0], 'cube', 'large', 0, 0);
  make(h.objects[1], 'sphere', 'small', ux * 0.47, uz * 0.47);
  make(h.objects[2], 'cylinder', 'small', -uz * 0.6, ux * 0.6);
  const why = def.validate(h);
  t.ok(typeof why === 'string' && /hides/.test(why), `validate() rejects a small sphere hidden behind a large cube (${why})`);
}

/* ---------------------------------------------------------------- 10 000+ seeds */

function pickBy(vals, better) { let b = 0; for (let i = 1; i < vals.length; i++) if (better(vals[i], vals[b])) b = i; return b; }
const SHORTCUTS = ['nearest the default view', 'most like the others', 'odd one out', 'like the default picture', 'farthest from the default view'];
// Picks of each shortcut: by camera azimuth, or stem-blind / stem-aware on the pictures' left-right
// orders and occlusions (the generator's hull descriptors).
function shortcutPicks(L, it) {
  const az = it.options.map((o) => o.az), ids = it.objects.map((o) => o.id);
  const D = az.map((a) => L.describe(it.objects, L.optionCam(it.camera, a), null, true));
  const stem = L.describe(it.objects, L.stemCam(it.stem), null, true);
  const tot = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].reduce((s, j) => s + (i === j ? 0 : L.differences(D[i], D[j], ids, 0)), 0));
  return [
    pickBy(az.map(Math.abs), (a, b) => a < b),
    pickBy(tot, (a, b) => a < b),
    pickBy(tot, (a, b) => a > b),
    pickBy(D.map((d) => L.differences(d, stem, ids, 0)), (a, b) => a < b),
    pickBy(az.map(Math.abs), (a, b) => a > b),
  ];
}

function testSeeds(t, PX, X, def, L) {
  t.section('seeds');
  const combos = X.enumerate(def), per = Math.ceil(SEEDS_TOTAL / combos.length);
  const other = t.context({ files: [...CORE, FILE] }).PX.ex.get('viewmatch');
  const c = { n: 0, threw: 0, invalid: 0, keyWrong: 0, otherRight: 0, nondet: 0, crossdet: 0, json: 0, meta: 0 };
  let firstBad = null;
  const times = [], hardTimes = [], keyPos = [0, 0, 0, 0], perCombo = {};
  const acc = Object.fromEntries(SHORTCUTS.map((nm) => [nm, { right: 0, n: 0, lv: {} }]));
  const forms = [0, 1, 2].map(() => ({ n: 0, gap: 0, flag: 0, ego: 0 }));
  for (const p of combos) {
    const code = X.paramsCode(def, p), lv = `angle ${p.angle} foils ${p.foils}`;
    const hardest = p.angle === 4 && p.objects === 2 && p.foils === 2;
    for (let s = 0; s < per; s++) {
      const seed = PX.rng.hash('viewmatch', code, s);
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
      if (s % 10 === 0 && JSON.stringify(def.generate(PX.rng(seed), p)) !== text) c.nondet++;
      if (s % 50 === 0 && JSON.stringify(other.generate(PX.rng(seed), p)) !== text) c.crossdet++;
      keyPos[it.key]++;
      shortcutPicks(L, it).forEach((pick, i) => {
        const a = acc[SHORTCUTS[i]], right = pick === it.key ? 1 : 0;
        a.right += right; a.n++;
        a.lv[lv] = a.lv[lv] || [0, 0]; a.lv[lv][0] += right; a.lv[lv][1]++;
      });
      const f = forms[s % 3], foils = it.options.map((o) => o.az).filter((_, i) => i !== it.key);
      f.n++;
      f.gap += Math.min(...foils.map((a) => L.sep(a, it.flag.az)));
      f.flag += Math.abs(it.flag.az);
      if (foils.some((a) => Math.abs(a) < Math.abs(it.flag.az))) f.ego++;
    }
  }
  t.ok(c.n >= SEEDS_TOTAL, `at least ${SEEDS_TOTAL} seeds across all ${combos.length} combinations (${c.n})`);
  t.eq(Object.keys(perCombo).length, combos.length, 'every combination generated');
  t.eq(c.threw, 0, 'generate never throws' + (firstBad ? ' — ' + firstBad : ''));
  t.eq(c.invalid, 0, 'validate passes on every item' + (firstBad ? ' — ' + firstBad : ''));
  t.eq(c.keyWrong, 0, 'the key scores right');
  t.eq(c.otherRight, 0, 'every other option scores wrong');
  t.eq(c.meta, 0, 'items carry their seed and params');
  t.eq(c.json, 0, 'items are JSON round-trip safe');
  t.eq(c.nondet, 0, 'same seed and params give the same item');
  t.eq(c.crossdet, 0, 'the same item in a separately loaded context');
  const p95 = quant(times, 0.95), hardP95 = quant(hardTimes, 0.95);
  t.ok(p95 < 20 && hardP95 < 20, `generation p95 under 20 ms of CPU time (all ${p95.toFixed(2)} ms, hardest level ${hardP95.toFixed(2)} ms)`);
  t.eq(L.stats.fallbacks, 0, 'no item needed the fallback');
  for (const p of combos) { const fb = L.fallback(p); if (fb.fallback !== true || def.validate(Object.assign(fb, { params: p })) !== true) t.fail('fallback invalid or not marked for ' + JSON.stringify(p)); }

  keyPos.forEach((k, i) => t.ok(Math.abs(k / c.n - 0.25) < 0.02, `the key is option ${i} ${pct(k / c.n)} of the time`));
  const spread = (key) => { const v = forms.map((f) => f[key] / f.n); return Math.max(...v) - Math.min(...v); };
  t.ok(spread('gap') < 2, 'forms: the same mean gap to the nearest foil (within 2°)');
  t.ok(spread('flag') < 2, 'forms: the same mean flag angle (within 2°)');
  t.ok(spread('ego') < 0.04, 'forms: the same share of foils nearer the default view');

  const lines = [];
  for (const [name, a] of Object.entries(acc)) {
    const pooled = a.right / a.n, levels = Object.values(a.lv).map(([r, n]) => r / n);
    t.ok(pooled <= 0.35, `shortcut "${name}" pooled ${pct(pooled)} ≤ 35 %`);
    lines.push(`${name} ${pct(pooled)} (worst level ${pct(Math.max(...levels))})`);
  }
  console.log(`       PR-2 viewmatch: ${c.n} items, p95 ${p95.toFixed(2)} ms; shortcuts: ${lines.join('; ')}`);
  console.log(`       PR-2 spread: ${spreadLine(X, def)}`);
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
