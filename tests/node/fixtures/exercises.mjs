/* Fake exercise definitions for the engine tests and the simulated learners.
   They use the real ids and codes (PLAN §3–§4) so that similar-looking groups, Threshold
   protocols and achievements find what they expect, with answer types, guessing rates, ranges
   and pool sizes shaped like the real exercises: choice with 4 options, yes/no, pick-two,
   open answers (angle, sequence), a continuous speed on a log grid (track) and the coarse
   18-combination pool with interactions of the real Slice. Items are stubs: the engine never
   generates items; tests and simulations answer with simulated learners.

   defineFixtures(PX, { probes = true, only = null }) registers them in a context loaded without
   the real exercises (createContext({ exercises: false })). */

function stub(id) {
  return {
    generate(rng, params) { return { ex: id, seed: rng.seed, params, key: 0 }; },
    validate() { return true; },
    score(item, response) { return { correct: response === item.key }; },
  };
}

function comb(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }

const SPEEDS = Array.from({ length: 46 }, (_, i) => 0.15 * Math.pow(10, i / 40));

// The real Slice difficulty model (js/ex/slice/gen.js, 30 Oct): custom, with interactions.
const SLICE = { base: -2.2, cut: [0, 1.5, 2.6], structure: [0, 0.15, 0.1], curved: 0.6, embXcut: [0, 1.0, 1.2], curvedXcut: [0, 0.3, 0.3] };

export const TRAIN = [
  {
    // Like js/ex/track/gen.js: 46 speed levels 0.025 log10 apart, a continuous speedValue for
    // Threshold mode, five targets only harder than four among enough spheres, lib.STANDARD.
    id: 'track', code: 'EX-01', name: 'Track', abilities: ['AT'], cell: null, role: 'train', answer: 'targets', perDisplay: true,
    variants: ['still', 'orbit'], extraParams: ['speedValue'],
    dims: [
      { key: 'speed', label: 'Speed', levels: SPEEDS, step: 0.12 },
      { key: 'targets', label: 'Targets', levels: [2, 3, 4, 5], step: 0.6 },
      { key: 'spheres', label: 'Spheres', levels: [6, 8, 10], step: 0.4 },
      { key: 'time', label: 'Tracking time', levels: [5, 8, 12], step: 0.35 },
    ],
    base: -2.5,
    difficulty(p) {
      const x = typeof p.speedValue === 'number' ? 40 * Math.log10(Math.min(4, Math.max(0.05, p.speedValue)) / 0.15) : (p.speed || 0);
      const n = [6, 8, 10][p.spheres || 0], k = [2, 3, 4, 5][p.targets || 0], kEff = Math.max(2, Math.min(k, n - k));
      return -2.5 + 0.12 * x + 0.6 * (kEff - 2) + 0.4 * (p.spheres || 0) + 0.35 * (p.time || 0) + (p.variant === 'orbit' ? 0.15 : 0);
    },
    chance(p) { const n = [6, 8, 10][p.spheres || 0], k = [2, 3, 4, 5][p.targets || 0]; return 1 / comb(n, k); },
    lib: { STANDARD: { params: { speed: 12, targets: 2, spheres: 1, time: 1, variant: 'still' }, cue: 2, startLevel: 12 }, SPEED_MIN: 0.05, SPEED_MAX: 4 },
    estMs(p) { return 1000 * (2 + [5, 8, 12][p.time || 0] + 3); }, // cue + tracking + picking
  },
  {
    id: 'rotate', code: 'EX-02', name: 'Mental Rotation', short: 'Rotate', abilities: ['Vz', 'SR'], cell: 'intrinsic-dynamic', role: 'train',
    answer: 'multi', nOptions: 4, nCorrect: 2, variants: ['samediff', 'pick'], answers: { samediff: 'yesno', pick: 'multi' },
    dims: [
      { key: 'angle', label: 'Angle', levels: [20, 50, 80, 110, 140, 180], step: 0.3 },
      { key: 'axis', label: 'Axis', levels: ['vertical', 'horizontal', 'picture', 'oblique'], step: 0.4 },
      { key: 'cubes', label: 'Cubes', levels: [6, 8, 10, 12], step: 0.45 },
    ],
    base: -2.2,
    chance(p) { return p.variant === 'pick' ? 1 / 6 : 0.5; },
  },
  {
    id: 'spin', code: 'EX-03', name: 'Spin', abilities: ['SR'], cell: 'intrinsic-dynamic', role: 'train', answer: 'multi', nOptions: 4, nCorrect: 2,
    variants: ['samediff', 'pick'], answers: { samediff: 'yesno', pick: 'multi' },
    dims: [
      { key: 'angle', label: 'Angle', levels: [0, 30, 60, 90, 120, 150, 180], step: 0.45 },
      { key: 'cells', label: 'Cells', levels: [6, 9, 12, 15], step: 0.45 },
    ],
    base: -2.0,
    chance(p) { return p.variant === 'pick' ? 1 / 6 : 0.5; },
  },
  {
    id: 'fold', code: 'EX-04', name: 'Fold', abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'train', answer: 'choice', nOptions: 4,
    dims: [
      { key: 'folds', label: 'Folds', levels: [1, 2, 3, 4, 5], step: 0.6 },
      { key: 'type', label: 'Fold type', levels: ['half', 'corner', 'diagonal', 'mixed'], step: 0.35 },
      { key: 'punches', label: 'Punches', levels: [1, 2, 3], step: 0.3 },
    ],
    base: -2.4,
  },
  {
    id: 'nets', code: 'EX-05', name: 'Nets', abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'train', answer: 'yesno',
    variants: ['opposite', 'edges', 'fold'],
    dims: [
      { key: 'squares', label: 'Squares carried', levels: [1, 2, 3, 4, 5, 6], step: 0.4 },
      { key: 'shape', label: 'Net shape', levels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], step: 0.15 },
      { key: 'marks', label: 'Marked faces', levels: [1, 2, 3], step: 0.3 },
    ],
    base: -2.2,
  },
  {
    id: 'slice', code: 'EX-06', name: 'Cross-sections', short: 'Slice', abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'train', answer: 'choice', nOptions: 4,
    dims: [
      { key: 'structure', label: 'Structure', levels: ['simple', 'joined', 'embedded'], step: 0.4 },
      { key: 'cut', label: 'Cut', levels: ['orthogonal', 'oblique', 'double oblique'], step: 1.3 },
      { key: 'curved', label: 'Curved solid', levels: ['no', 'yes'], step: 0.75 },
    ],
    base: SLICE.base,
    difficulty(p) {
      const s = p.structure || 0, c = p.cut || 0, k = p.curved || 0;
      return SLICE.base + SLICE.cut[c] + SLICE.structure[s] + (s === 2 ? SLICE.embXcut[c] : 0) + (k ? SLICE.curved + SLICE.curvedXcut[c] : 0);
    },
  },
  {
    id: 'views', code: 'EX-07', name: 'Views', abilities: ['Vz'], cell: 'intrinsic-static', role: 'train', answer: 'choice', nOptions: 4,
    variants: ['toView', 'toObject', 'count'],
    dims: [
      { key: 'cubes', label: 'Cubes', levels: [4, 6, 8, 10, 12], step: 0.55 },
      { key: 'grid', label: 'Grid', levels: [3, 4], step: 0.6 },
      { key: 'direction', label: 'View direction', levels: ['front', 'side', 'top'], step: 0.6 },
    ],
    base: -2.2,
  },
  {
    id: 'orient', code: 'EX-08', name: 'Orient', abilities: ['PT'], cell: 'extrinsic-dynamic', role: 'train', answer: 'angle',
    dims: [
      { key: 'shift', label: 'Perspective shift', levels: [0, 30, 60, 90, 120, 150, 180], step: 0.45 },
      { key: 'objects', label: 'Objects', levels: [5, 6, 7, 8, 9], step: 0.15 },
      { key: 'tolerance', label: 'Tolerance', levels: [30, 20, 15], step: 0.35 },
    ],
    base: -2.0,
    chance(p) { return 2 * [30, 20, 15][p.tolerance || 0] / 360; },
  },
  {
    id: 'span', code: 'EX-09', name: 'Span', abilities: ['MV', 'WM'], cell: null, role: 'train', answer: 'sequence', chance: 0,
    variants: ['forward', 'backward'],
    dims: [
      { key: 'len', label: 'Length', levels: [2, 3, 4, 5, 6, 7, 8, 9], step: 0.71 },
      { key: 'cross', label: 'Path crossings', levels: [0, 1, 2, 3], step: 0.35 },
      { key: 'turn', label: 'Board turn', levels: [0, 90, 180], step: 0.4 },
    ],
    base: -2.6,
    estMs(p) { const n = [2, 3, 4, 5, 6, 7, 8, 9][p.len || 0]; return 700 + 300 * n + 800 * n; }, // show the blocks, then recall
  },
  {
    id: 'hidden', code: 'EX-10', name: 'Hidden', abilities: ['CF'], cell: 'intrinsic-static', role: 'train', answer: 'choice', nOptions: 4,
    dims: [
      { key: 'complexity', label: 'Segments', levels: [10, 15, 20, 25, 30, 35, 40], step: 0.45 },
      { key: 'similarity', label: 'Candidate similarity', levels: ['low', 'medium', 'high'], step: 0.65 },
    ],
    base: -2.0,
  },
  {
    id: 'homing', code: 'EX-11', name: 'Homing', abilities: ['NAV'], cell: 'extrinsic-dynamic', role: 'train', answer: 'angle', perDisplay: true,
    dims: [
      { key: 'legs', label: 'Legs', levels: [2, 3, 4], step: 0.9 },
      { key: 'turns', label: 'Turn sizes', levels: ['small', 'mixed', 'large'], step: 0.6 },
      { key: 'landmarks', label: 'Landmarks', levels: ['rich', 'few', 'none'], step: 0.5 },
    ],
    base: -2.0, chance: 0.1,
    estMs(p) { return 3000 * [2, 3, 4][p.legs || 0] + 4000; }, // the route, then facing the start
  },
];

export const PROBES = [
  { id: 'wordlinks', code: 'PR-0', name: 'Word Links', abilities: ['VB'], cell: null, role: 'probe', answer: 'choice', nOptions: 4,
    dims: [{ key: 'rarity', levels: [0, 1, 2, 3, 4, 5], step: 0.56 }, { key: 'relation', levels: [0, 1, 2], step: 0.6 }], base: -2.1 },
  { id: 'cubematch', code: 'PR-1', name: 'Cube Match', abilities: ['Vz'], cell: 'intrinsic-dynamic', role: 'probe', answer: 'yesno',
    dims: [{ key: 'turns', levels: [1, 2], step: 1.0 }, { key: 'shared', levels: [3, 2, 1], step: 0.8 }, { key: 'glyphs', levels: [0, 1, 2, 3], step: 0.55 }], base: -2.1 },
  { id: 'viewmatch', code: 'PR-2', name: 'View Match', abilities: ['PT'], cell: 'extrinsic-dynamic', role: 'probe', answer: 'choice', nOptions: 4,
    dims: [{ key: 'azimuth', levels: [45, 90, 135, 180], step: 0.8 }, { key: 'objects', levels: [3, 4, 5], step: 0.5 }, { key: 'elev', levels: [0, 1], step: 0.6 }], base: -2.0 },
  { id: 'mechanisms', code: 'PR-3', name: 'Mechanisms', abilities: ['MA'], cell: 'intrinsic-dynamic', role: 'probe', answer: 'choice', nOptions: 3,
    dims: [{ key: 'parts', levels: [3, 4, 5, 6, 7], step: 0.6 }, { key: 'kind', levels: ['gears', 'belts', 'mixed'], step: 0.5 }, { key: 'jam', levels: [0, 1], step: 0.6 }], base: -2.2,
    // like the real PR-3: two-way direction questions below the belts level, three options above
    chance(p) { return (p.kind || 0) === 0 ? 1 / 2 : 1 / 3; } },
  { id: 'patterns', code: 'PR-4', name: 'Pattern Memory', abilities: ['MV'], cell: null, role: 'probe', answer: 'sequence', chance: 0.02,
    dims: [{ key: 'size', levels: [4, 6, 9, 12, 16, 20, 25, 30], step: 0.58 }], base: -2.0 },
  { id: 'level', code: 'PR-5', name: 'Level', abilities: ['Vz'], cell: 'extrinsic-static', role: 'probe', answer: 'angle', chance: 0.1,
    dims: [{ key: 'tilt', levels: [10, 20, 30, 40, 50], step: 0.7 }, { key: 'frame', levels: ['none', 'tilted'], step: 0.8 }, { key: 'kind', levels: ['water', 'plumb'], step: 0.4 }], base: -2.0 },
];

export function defineFixtures(PX, opts = {}) {
  const only = opts.only ? new Set(opts.only) : null;
  const list = [...TRAIN, ...(opts.probes === false ? [] : PROBES)].filter((d) => !only || only.has(d.id));
  for (const d of list) PX.ex.define({ version: 1, ...d, ...stub(d.id) });
  return list.map((d) => d.id);
}
