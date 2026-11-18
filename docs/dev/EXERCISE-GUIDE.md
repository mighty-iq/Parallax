# Building an exercise in Parallax

This guide shows how to add an exercise, using **Rotate (EX-02)** as the worked example: copy its
structure, not its geometry. The contracts live in `ARCHITECTURE.md` (§3 load order, §4 core APIs,
§5 definition, §6 view, §12 tests). If something here disagrees with ARCHITECTURE.md, the
architecture file wins; report the difference. Fields added in 1.1 and 1.2 are marked so; while
several builders work at once, docs/dev/CONTRACT-v1.2.md says who owns what.

## 1. Files

| File | Kind | What it holds | Rotate |
|---|---|---|---|
| `js/ex/<id>/gen.js` | pure | definition, generator, **independent** validator, scorer, shared model (`lib`) | `js/ex/rotate/gen.js` |
| `js/ex/<id>/learn.js` | pure, data only | Watch–Try–Go: goal, labelled parts, demo, practice, tips, strategy cards, captions | `js/ex/rotate/learn.js` |
| `js/ex/<id>/view.js` | DOM / 3D | drawing, options, reveal, show me, demo | `js/ex/rotate/view.js` |
| `css/ex/<id>.css` | CSS | your styles, every rule under `.ex-<id>`; phone sizes under `.pl-trial.ex-<id>` from `--pl-avail` (§5) | Rotate is the exception: it lives in `css/ex.css` |
| `tests/node/<id>.test.mjs` | node | ≥ 10 000 seeds, key/other options, determinism, shortcut solvers, timing, learn data | `tests/node/rotate.test.mjs` |
| `tests/e2e/harness_<id>.py` | Playwright | the harness on file:// and in a sandboxed srcdoc, both input methods, screenshots | `tests/e2e/harness_rotate.py` |

Every JS file is a classic script: `(function (PX) { 'use strict'; … })(window.PX);`, no other
globals, no `import`, no `fetch`, no `Math.random` in pure files (use the `rng` you are given).
Pure files (gen, learn) must not touch the DOM, THREE or timers: they load in node.

`css/ex.css` holds the shared pieces you should reuse instead of restyling: `.ex-stage` (framed
stimulus plate), `.ex-label` (specimen label on the stage; `.is-pointed` during a demo),
`.ex-caption` (reserved line for captions), `.ex-verdict` / `.ex-tag` (the truth after an answer,
with `data-kind`), `.ex-opt` + `.ex-thumb` (picture options), `.ex-answer` + `.ex-glyph` (word
answers), `.ex-focus` (the option show-me talks about), `.ex-unavailable`. Use the tokens of
`css/base.css` with fallbacks (`var(--ink, #1A1D21)`), and the stimulus tokens `--stim-*` for
figures. The screen-reader-only class is `.px-sr`.

## 2. Loading and the harness

The app loads scripts in this order (ARCHITECTURE §3): vendor/three → core (… ui, **stage3d**) →
engine → `js/ex/registry.js` → every `gen.js` → every `learn.js` → every `view.js` → ui. So
`gen.js` runs before your view and learn data, and can export a model for them (see `lib` below).

The dev harness mounts one exercise without the app shell:

```
tests/dev/harness.html?ex=rotate&seed=123&p=angle:3,axis:1&v=pick&fast=1&theme=dark&rm=1
```

- It loads the core, stage3d, engine and registry statically (the same lines as `index.html`;
  `harness_rotate.py` checks that they match), then **appends `js/ex/<id>/gen.js`, `learn.js`
  and `view.js` dynamically, in that order**. You never edit the harness to add an exercise.
- **Stylesheet:** if your view definition says `css: true`, the harness then loads
  `css/ex/<id>.css` (it cannot test for a file on disk without logging an error, so the view
  declares it). Load errors of any file are shown on the page and collected in `__harness.errors`.
- `p` takes level **indices** (`angle:3` is the fourth angle level); `v` the variant; `seed` the
  item seed (N adds 1). Controls on the page set variant, every dim and the seed.
- Keys: 1–9 options · Enter confirm (multi) or next · Space next · Esc pause · S show me ·
  N new item · T theme · in show me: Space pause, → step, R replay, Esc close.
- `window.__harness = { item, key, state, last, errors, played, answer(correct), next(params, seed),
  showMe(), demo(), setTheme(name), config }`. `state` is one of loading, mounted, ready,
  respond, paused, reveal, showme, error, unavailable. `answer(true|false)` submits a right or a
  wrong response through the same respond path as a click (grid layouts) or as the view's own
  input (custom layouts: targets swap one id, sequences swap two positions, angles add the
  tolerance + 20°); `played` counts show-me/demo runs
  (`started`, `finished`, last run's `ms` and `plannedMs`).
- In a sandboxed srcdoc frame nothing loads from disk: `tests/e2e/common.py: harness_single(ex,
  cfg)` inlines the page, your three files and `css/ex/<id>.css`, and passes the query as
  `window.PX_HARNESS_CFG`.

The harness is the reference for the player (ui/play.js): ready → present → respond → reveal →
show me / next, the answer clock from present's paint timestamp, pause that keeps the first
start time, and `ctx.play` (§6).

## 3. The definition (gen.js)

```js
PX.ex.define({
  id: 'rotate', version: 1, code: 'EX-02', name: 'Mental Rotation', short: 'Rotate',
  abilities: ['Vz', 'SR'], cell: 'intrinsic-dynamic', role: 'train',
  answer: 'multi', nOptions: 4, nCorrect: 2,          // the main format ('pick')
  answers: { samediff: 'yesno', pick: 'multi' },     // variants that answer differently
  dims: [ { key: 'angle', label: 'Angle', levels: [20, 40, …, 180], step: 0.30, unit: '°' }, … ],
  base: -1.75, variants: ['samediff', 'pick'],
  chance: function (params) { return params.variant === 'pick' ? 1 / 6 : 0.5; },
  generate: generate, validate: validate, score: score,
  lib: { … },                                         // the shared model (see below)
});
```

- **Variants with different answer types** (ARCHITECTURE §6): declare the main `answer` plus
  `answers: { <variant>: <type> }`; **every item carries `item.answer`** (and `nOptions`,
  `nCorrect` when they differ); `chance(params)` depends on `params.variant`; players, engine and
  scorer use `item.answer || def.answer`. yesno items are shown as a two-option grid: option 1 =
  yes (true), option 2 = no (false).
- **Difficulty:** dims combine additively (`base + Σ step × level index`). Justify each step in
  a comment with the source (Rotate: G&K 2015 error rates give ≈ 0.016 logit/°, so 0.30 per 20°).
  The range max − min must span **≥ 4 logits** (levels 1–100 are mapped onto it). Choose `base`
  so the easiest item is about 90 % right for a beginner at θ = 0: for chance g and lapse 0.03,
  P = g + (1 − g − 0.03)·σ(−b). Dims and levels are append-only; a breaking change bumps `version`.
- `lib` is where you put the model shared by the validator, the view and the tests (camera,
  geometry, rasteriser, feature functions). Show-me must be drawn from the same model that grades
  the answer, so the view reads `PX.ex.get(id).lib` instead of re-deriving anything.
- **Labels and loading (1.1):** `pat: true` for a DAT-style format (trained only under the DAT-style
  focus, in the Library's own group and in Section practice; its learn.js bridge carries the ADA
  line, CLAUDE.md rules 2 and 3); `experimental: true` (the Library says so and explains it under How
  to play); `practice: 'attention' | 'perception'` (Track; Angles); `requires: ['<id>']` on the
  definition and the view when you reuse another exercise's model or kit (Reckon → Homing).
- **The transfer bet (1.2):** `bet` names the one mechanism the exercise bets on (attention, load,
  variety, strategy, compare, bridge, produce, calibrate, format; CLAUDE.md rule 15).
- **A starter band (1.2; CONTRACT-v1.2 A, B):** a new easiest level goes in front of a dim with
  `at: [Δ, 0, step, 2·step, …]` (base unchanged, so every old combination keeps its difficulty),
  `starter: { dim, levels: 1 }` and `version` + 1; js/engine/rebase.js converts stored levels
  once. The Library and the player then say "level 1 · starter items".
- **A deadline and a round score (1.2):** `trainVariants: ['quick']` limits the variants that
  automatic choices use; `pace: { variants, startMs, minMs, maxMs, target, step }` gives those
  items a deadline that a staircase moves (js/engine/pace.js); `roundScore(item, result, info)`
  returns 0–100 for one item (Central Point Quick: closeness and speed), never a lifetime total.
- **Answer types (1.1, 1.2):** `position` (`{ x, z }` on the ground plane) and `point` (`{ x, y }`
  on the item's lattice) need `chance(params)`; `score` judges the distance.
- **Format, layers and atlas (1.2 wave 2; CONTRACT-v1.2 S):** `format` is a token, or one per
  variant (`{ pick: 'mr-choice', '*': 'mr-other' }`, '*' for the rest); `layers` is
  `{ compare: [principle ids], produce: '<variant>', bridge: '<set id>', calib: true }`, and a
  produce variant is appended to `variants`, left out of `trainVariants` and kept out of the level
  scale (range and reference guessing rate); `atlas: [dimA, dimB]` is reserved for milestone 5.
  `PX.ex.check` validates and freezes all three.

## 4. Generator, validator, scorer

**generate(rng, params) → item**, JSON-serialisable and fully determined by seed and params:

- Normalise params (missing dims → level 0, missing variant → the first one).
- One `build(rng, p)` attempt returns an item or null. Retry with `rng.fork('retry' + i)` until
  `validate(item) === true`, at most 50 times, then fall back to a construction known to be
  valid (Rotate: a fixed-seed search that the node test runs for every params combination).
  **generate never throws.**
- Keep it under 20 ms per item at the hardest level (the test measures CPU time). Profile by
  failure stage (Rotate counts them in `lib.STATS`) and spend work only on candidates that can
  still pass: cheap checks first (structure, arm directions, projected centres), the raster last.
- Draw every random choice from the given `rng`; when the choices of one role must not be
  biased against another, decide the roles first (Rotate shuffles `[copy, copy, mirror, mirror]`
  before filling the slots, so neither role gets the "exact angle" turns more often).
- Literal constants instead of `Math.sin` at runtime keep items bit-identical across engines
  (Rotate's `TRIG10`); `+ − × ÷` and `Math.sqrt` are exact everywhere.

**validate(item) → true | reason**, independent of the generator's bookkeeping:

- Re-derive the key from the geometry by brute force (Rotate: canonical forms under the 24 cube
  rotations decide which options are turned copies; the stored `s` flags are not trusted).
- Exactly the keyed options are right; options are pairwise visibly different; no "structural"
  distractor (each wrong option is a mirror image, never a different shape: those can be rejected
  without the skill being trained); mirror foils are chiral (not equal to any rotation).
- The distinguishing feature is visible from the shown viewpoint: Rotate rasterises every
  shown figure into a 96 × 96 software z-buffer (every cube ≥ 12 px and ≥ 10 % visible, end cubes
  ≥ 30 %; every arm at least 50 % of its true length on screen and every bend at least 40° from
  parallel on screen, after Shepard and Metzler).
- Wrap the check in try/catch and return the message: `validate` never throws either.

**score(item, response) → { correct, value?, detail? }**: malformed responses are wrong, never a
throw. Response shapes: choice → index; multi → sorted indices (right only if exactly the key);
yesno → boolean; angle, targets, sequence as in ARCHITECTURE §5.

### Rotate's model in one paragraph

A figure is 4 straight arms on the cube lattice (90° turns, spanning 3D, no face contact between
non-neighbours), chiral and without rotational symmetry. World = camera frame; the reference is a
lattice orientation seen from slightly above (elevation 20–30°, azimuth ±30/40°). Turns are about
the scene's vertical (a turntable), the screen's horizontal, the line of sight, or an oblique axis.
A mirror option is the **left–right flip of a correctly turned copy** (stored as the reflected
cells at a proper rotation), so silhouette area, visible cubes and bounding-box shape are
identical in distribution for copies and mirrors: cheap 2D features cannot separate them. The
reflection kept with the item is the one that leaves the most cubes in place (`item.diff`): after
turning the reference to a mirror's orientation, exactly those cubes point the other way, which
is what show-me highlights.

## 5. The view (view.js)

```js
PX.ex.view('rotate', {
  layout: 'stem+options',  // the player draws a PX.ui.choiceGrid; or 'custom' with collect()
  needs: 'webgl',          // the player shows "unavailable: <reason>" instead of mounting
  css: false,              // true: the harness loads css/ex/<id>.css
  mount(ctx), present(item, ctx) → Promise<paintTs>, drawOption(el, item, i, ctx),
  optionLabel(item, i), gridCols(item), reveal(item, response, result, ctx),
  showMe(item, response, ctx), demo(item, ctx, caption), unmount(ctx),
});
```

- **ctx** = `{ host, stage3d, svg, ui, keys, timing, theme, settings, fast, reducedMotion, play }`,
  plus `practice` (a Try item: not logged) and `demo` (a Watch demo) from 1.1, and from 1.2
  `assist` (the Try item's first step, done by the app: draw it when it is not null),
  `addMotion(ms)` and `gentleMotion` (views with `motion: true` report the motion they show; the
  gentle profile slows walks and turns). The player wraps the trial (your `host` and the choice
  grid) in an element with class `ex-<id>`, so your CSS can style the grid cells too.
- **Phones (1.1):** while an item is up (`body.px-item`) a phone shows it alone on one screen
  that does not scroll. Size the figure and the options from `--pl-avail` (the height left for
  the item), `--pl-w` (its width) and, held sideways, `--pl-col` (one of two columns), under
  `.pl-trial.ex-<id>`; `tests/e2e/fit.py` checks every scored item at 360 × 640 and 844 × 390.
- **Optional view functions (1.2):** `drawRule(el, fig, ctx)` draws a small picture on the rules
  card; `atDeadline(item, ctx) → response | null` hands the player a placed answer when a Quick
  deadline runs out.
- **Order of calls in a trial:** generate → the grid is built **laid out but invisible**
  (`visibility: hidden`) → `drawOption(el, item, i)` for every option (**ready phase**: put
  heavy work here, e.g. `stage3d.snapshot` thumbnails; `el.clientWidth` is valid) → `present`
  (draw the stem, return `PX.core.timing.nextPaint()`) → the grid becomes visible in the same
  frame → the answer clock starts at the paint timestamp present resolved with → respond.
  Nothing heavy after present: no snapshots, saves or DOM observers while the clock runs.
- **drawOption may run before present** for a new item: set up per-item state on the first call
  (Rotate's `newItem(item)`).
- **reveal** marks the stem in place (Rotate: "✓ Same figure, turned 60°", tags under thumbnails)
  and resolves within 700 ms; the player marks its own grid (right, wrong, missed, dim; icon +
  word + colour, never colour alone).
- **showMe / demo** build a list of steps from the item's model and call `ctx.play(steps, opts)`:

```js
// step: { ms, caption?, enter?(), update?(k ∈ [0, 1]), exit?() }
ctx.play([
  { ms: turnMs, caption: 'Watch the reference turn…', enter: reset, update: slerpTo, exit: snap },
  { ms: 1500, caption: 'Now they match…', enter: highlightTheDifference },
], { caption: fn }) → Promise   // resolves when the last step ends or the user closes it
```

  The player's runner (reference implementation in `tests/dev/harness.js`, `play()`) owns
  **Pause, Step, Replay, Close**, honours `fast` (2 % of the time) and reduced motion (75 % of the
  time, keyframes about 400 ms apart instead of smooth motion, ≤ 2.5 Hz), and takes time from rAF
  `dt`. Make every `enter()` set the full starting state of its step, so Replay and Step work
  from anywhere. Show me runs 2–4 s per solution movement and is drawn from the same model as the
  key (Rotate slerps the reference's quaternion to the option's and highlights `item.diff`). If
  `ctx.play` is missing, Rotate falls back to a minimal runner without controls.
- **1.2 wave 2:** before `present` the player sets `ctx.layer` to the item's add-on layer ('' when
  none; 'calib-detail' asks for the detailed feedback). A custom view names the control an answer
  came through in its respond meta, `respond(r, { amode: 'drag' | 'dial' | 'fine' | 'keys' | 'place'
  | 'draw' })` (trial column 16; the answer grid is 'option'). After an answer, a walkthrough waits
  for Next at each caption as Watch does; taps on the board reach it through `ctx.playCmd('step')`
  only after its first 1.5 s.
- **Keyboard:** stem+options needs nothing more (the grid takes 1–9). Custom layouts register
  keys through `ctx.keys.push(map, { through: true })` and show key hints.
- **Accessibility:** canvases are `aria-hidden`; describe the task in text (`.px-sr`), give
  options accessible names (`optionLabel`), keep targets ≥ 44 px, never flash faster than 3 Hz.

## 6. 3D through PX.core.stage3d

There is **one WebGLRenderer for the whole app** (a page gets 16 contexts; the 17th kills the
oldest). Never create another one.

- `available()` / `reason()`; `attach(container) → view` moves the one canvas into your stage
  (`view.resize()`, `view.render(scene, camera)`, `view.renderTiles([{scene, camera, x, y, w, h}])`
  for side-by-side figures, `view.redraw = fn` is called after a theme change, a resize or a
  context restore, `view.detach()`).
- `snapshot(scene, camera, w, h, { fluid, canvas }) → 2D canvas`: offscreen MSAA render read
  back synchronously (7–21 ms in software rendering), so only in drawOption, reveal or show-me.
- Builders with shared, theme-aware materials: `cubeGroup(cells, { highlight })` (unit cubes with
  outline bars; `group.setHighlight(indices)`), `sphere`, `wireBox`, `lights(scene)`,
  `colors()`, `disposeTree(obj)`; `refreshTheme()` re-reads the `--stim-*` tokens.
- Picking small objects: `pickNearest(view, items, clientX, clientY, 36)`.
- Robustness: `stage3d:lost` on PX.bus makes `timing.monitor()` mark the phase as stuttered
  and the harness mark the trial void (`__harness.last.void`; it never counts);
  `stage3d:restored` redraws through `view.redraw`; `noteTrial(stuttered)` steps quality down
  (DPR 1, no antialiasing) after two stuttered trials. Highlights: `setHighlight(cells, { fade:
  true })` turns the rest of the figure into a pale line drawing, so the cue is not colour alone.
- Camera framing that a validator can reproduce: Rotate's camera sits on +z with a 30° vertical
  field of view at `lib.distance(radius)`; tall tiles move it back to fit the width.

## 7. learn.js (data only)

```js
PX.ex.learn('rotate', {
  goal: 'one line', goals: { <variant>: 'one line' },
  parts: [{ id, label, text, variant? }],                       // labelled parts of the screen
  demo: [{ params, seed, kind }],                               // easiest levels; kind is tested
  practice: [params, …],                                        // 3–5, easiest first, not logged
  tips: [{ id, when: { dim, levels } | { variant }, text }],    // just in time, once each
  strategies: [{ id: 'imagery' | 'analytic' | 'switch', title, text, steps: [], when }],
  captions: { key: 'text with {n}' },                           // read by view.demo / showMe
  bridge: 'where the skill shows up, honestly worded',
  // 1.2, the teaching template (CONTRACT-v1.2 D; the player renders it):
  rules: [text | { text, fig }],                                 // 2–4 lines: the rules card, Watch's first screen
  strategyFirst: '<strategy id>',                                // the card that opens before Try 1
  // practice entries may be { params, assist, tip, seed }: Try 1 at the band with its first step
  // done (assist), Try 2 at the band, Try 3 at today's level 0, Try 4 the first hard feature
  minutes: 2,                                                    // the offer card's estimate
  motionNotice: 'text',                                          // views with motion: the one-time notice
});
```

Wording is about the task, never the person; no IQ, "smarter" or "mastered" (CLAUDE.md rules 2
and 11; the node test greps for them). Strategy cards cite the research behind them in a comment.
A show-me or demo step `{ hold: true, caption }` waits for a tap on Continue (1.2).

## 8. Tests

**Node** (`tests/node/<id>.test.mjs`, run with `node tests/node/run.mjs <id>`):

- Build your own context with only the files you need, so other exercises' work in progress
  cannot break your test: `t.context({ files: [...MANIFEST, 'js/ex/<id>/gen.js', 'js/ex/<id>/learn.js'] })`.
- ≥ 10 000 seeds across every level combination and variant (`PX.ex.enumerate(def)` × seeds):
  generate never throws, validate passes, the key scores right, **every other response** scores
  wrong (Rotate: the other 5 pairs; the opposite yes/no), malformed responses score wrong,
  determinism, JSON round trip, no fallbacks.
- The fallback is valid for every params combination.
- Timing: p95 of **CPU time** (`process.cpuUsage`) at the hardest level < 20 ms; report wall time
  too (the build machine is shared, so wall time is not asserted).
- **Shortcut solvers** (CLAUDE.md rule 5), each ≤ chance + 10 points over ≥ 2 000 items:
  stem-based (the option most like the reference by each cheap feature) and **stem-blind** (odd
  ones out, the options most like the others, the most alike pair), with the best possible
  threshold for yes/no formats. Print the accuracies on one line.
- Balance: keys spread evenly over positions; yes/no keys ≈ 50 %; distractors not separable by a
  bookkeeping variable (Rotate: copies and mirrors have the same mean turn angle).

**E2E** (`tests/e2e/harness_<id>.py`, copy `harness_rotate.py`). Run it through the slot
wrapper, which allows two headless Chromiums on the machine at a time (more make every test slow
and flaky): `tests/e2e/pwslot.sh python3 tests/e2e/harness_<id>.py`. It covers file:// at 1366 × 768 and
412 × 880 (DPR 2, touch), light and dark, every variant; non-blank stimulus pixels; a right
answer by keyboard and a wrong one by pointer (tap on the phone); show me runs to the end; the
harness inlined into `<iframe sandbox="allow-scripts" srcdoc>`; no console errors; no horizontal
scroll. Helpers in `tests/e2e/common.py`: `launch`, `file_url`, `Console`, `non_blank`,
`harness_single`, `srcdoc_host`, `child_frame`, `Checks`. Screenshots go to `tests/e2e/out/`.
**Look at them** and fix what is clipped, unreadable or ambiguous. Wait on `__harness.played`
counters rather than on transient states (with `fast=1` show me finishes within a frame or two).

## 9. Checklist

- [ ] gen.js: definition with `version`, abilities (primary first), cell, role, answer(s), dims
      with justified steps, base for ≈ 90 % at θ = 0, range ≥ 4 logits, chance per variant, `bet`
- [ ] a new easiest band: `at` steps, `starter`, `version` + 1 (stored levels are re-based)
- [ ] generate never throws; 50 forked retries; fallback valid everywhere; < 20 ms CPU (p95)
- [ ] validate re-derives the key by brute force; visibility of the deciding feature; options
      pairwise different; no structural distractors; chirality / symmetry where it matters
- [ ] score: exact key only; malformed → wrong
- [ ] shortcut solvers (stem-based and stem-blind) ≤ chance + 10 on ≥ 2 000 items
- [ ] view: drawOption does the heavy work in the ready phase; present returns the paint
      timestamp; reveal ≤ 700 ms; show me and demo through `ctx.play`, from the grading model
- [ ] keyboard and pointer both play; ≥ 44 px targets; colour never alone; reduced motion
- [ ] learn.js: goal, parts, demo (tested seeds), 3–5 practice params, tips, strategy cards;
      for a taught first band also rules, strategyFirst, practice with assist, minutes
- [ ] phones: the item fits 360 × 640 and 844 × 390 (`--pl-avail`, `tests/e2e/fit.py`)
- [ ] CSS under `.ex-<id>` in `css/ex/<id>.css` (and `css: true` in the view), tokens with
      fallbacks; light and dark checked in screenshots
- [ ] node and e2e tests pass; screenshots reviewed (desktop and phone, light and dark)
- [ ] index.html: move your gen/learn/view (and css) lines out of the PENDING blocks
