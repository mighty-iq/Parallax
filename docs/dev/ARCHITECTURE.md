> The contract between the parts of Parallax: runtime constraints, file layout, APIs and conventions. Every exercise, engine module and screen follows it. Paths are relative to the repository root.

# Parallax: architecture and contracts (for everyone who writes code)

Parallax is a static, offline web app that trains visuospatial ability. This file is the contract between the parts. If something here is unclear or wrong, report it instead of inventing a different convention.

## 1. Runtime constraints (non-negotiable)
- Must run from disk (`file://`), on GitHub Pages, as a single inlined HTML, and inside a sandboxed iframe (`srcdoc`, `sandbox="allow-scripts"`: opaque origin; `localStorage`, `history.replaceState` and downloads may throw or be blocked). Desktop and phones (Chrome, Firefox, Safari).
- Classic scripts only, on the `window.PX` namespace. No ES modules, no `import`, no `fetch` of local files, no Web Workers from files, no external network at runtime.
- `vendor/three.min.js` defines `window.THREE` (IIFE bundle of three.js, MIT).
- One WebGL context for the whole app (`PX.core.stage3d`). Option thumbnails are rendered through it and copied to 2D canvases. Never create a second WebGLRenderer.
- No routing through `history`; the route lives in memory (`PX.core.router`) and the URL hash is only a mirror inside try/catch.
- In a sandboxed srcdoc a relative `href="#x"` navigates the frame away, a link without a target replaces the app, and `target=_blank`, `window.open` and the async clipboard API are blocked (`execCommand('copy')` works). So: in-app navigation never uses `href`, only `data-go` handled by one click listener; external links (Discord) use `target="_blank" rel="noopener"` and are always shown as visible text with a Copy button next to them.
- Every storage access goes through `PX.core.store` (try/catch, memory fallback, visible warning).

## 2. Files
```
parallax/
  index.html                  links css, then scripts in the order of §3
  css/base.css                design tokens (light + dark), type, layout, components
  css/app.css                 screens
  css/ex.css                  exercise styles, each under .ex-<id>
  fonts/                      IBM Plex Sans 400/600, IBM Plex Mono 400/500 (woff2, OFL.txt)
  vendor/three.min.js         + vendor/LICENSE-three.txt
  js/core/                    px.js util.js rng.js bus.js timing.js keys.js store.js router.js svg.js ui.js stage3d.js
  js/engine/                  model.js estimator.js select.js staircase.js bandit.js schedule.js modes.js assess.js achievements.js streak.js daily.js stats.js merge.js (no XP: PLAN §7)
  js/ex/registry.js           PX.ex.define / PX.ex.view / PX.ex.list
  js/ex/<id>/gen.js           pure: generator, validator, scorer, difficulty dims
  js/ex/<id>/view.js          DOM / 3D: drawing, input, reveal, show-me, demo
  js/ex/<id>/learn.js         tutorial steps, strategy cards, captions (data only)
  js/ui/                      app.js welcome.js tour.js home.js play.js library.js progress.js log.js lab.js settings.js about.js share.js
  tools/                      vendor-three.mjs build-single.mjs build-pdf.py shots.py
  tests/node/                 run.mjs (vm loader) + *.test.mjs + sim.mjs
  tests/e2e/                  *.py (Playwright)
  tests/dev/harness.html      loads one exercise without the app shell, for development and tests
  docs/guide/                 guide.html + guide.css -> docs/Parallax-Guide.pdf
  README.md CHANGELOG.md LICENSE (MIT) LICENSE-GUIDE.md (CC BY-SA 4.0) CLAUDE.md
```

## 3. Namespace and load order
- `js/core/px.js` creates `window.PX = { version, core:{}, engine:{}, ex:{}, ui:{}, debug:{} }`.
- Every file is `(function (PX) { 'use strict'; /* … */ })(window.PX);` and attaches its API to PX. No other globals.
- **Pure files** (no DOM, no THREE, no timers): core/util, core/rng, engine/*, ex/registry, ex/*/gen.js, ex/*/learn.js. They must load in Node through `tests/node/run.mjs` (a `vm` context whose `window` is a plain object).
- Script order: vendor/three → core (px, util, rng, bus, timing, keys, store, router, svg, ui, stage3d) → engine/* → ex/registry → every ex/*/gen.js → every ex/*/learn.js → every ex/*/view.js → ui/* → ui/app.js last (boots on DOMContentLoaded).

## 4. Core APIs
- `PX.util`: clamp, lerp, round(n, dp), mean, sd, median, quantile, logit, sigmoid, deg/rad, deepCopy, fmtTime, fmtDate, uid().
- `PX.rng(seed)` → `{ next(), int(a,b) /*inclusive*/, float(a,b), pick(arr), shuffle(arr) /*copy*/, chance(p), normal(), fork(label) }`. Seeds are uint32; `PX.rng.hash(...parts)` makes a seed from strings and numbers (cyrb53 or xmur3 → sfc32). Same seed → same sequence on every platform. Never use Math.random in pure files.
- `PX.bus`: `on(evt, fn) → off`, `emit(evt, data)`.
- `PX.core.timing`: `nextPaint() → Promise<DOMHighResTimeStamp>` (resolves in the rAF after the DOM change is committed, i.e. double rAF); `loop(fn(dtMs, now)) → stop` (pauses when the tab is hidden; dt is clamped to 100 ms); `monitor() → { stop() → {frames, medianMs, p95Ms, dropped, maxGapMs, stutter:boolean} }`. A frame is "dropped" when it is longer than 1.5 × the median frame time (do not use a fixed 16.7 ms: a quarter of smooth 60 Hz frames measure 16.8 ms). stutter = maxGap > 150 ms, or dropped > 15 % of frames, or a WebGL context loss during the phase (relaxed on 30 Oct: motion is time-based, so dropped frames never misplace objects, and the stricter rule voided most trials on slow devices). Exercises with fast motion add their own rule (Track: void when speed × maxGap exceeds 1.5 sphere diameters).
- `PX.core.keys`: layered handlers. `push({ '1': fn, Enter: fn, Escape: fn, … }) → pop`. Only the top layer receives keys. Inputs and textareas are ignored except Escape.
- `PX.core.store`: see §8.
- `PX.core.router`: `go(route, params)`, `current()`, `on(fn)`. Routes: home, play, library, exercise/<id>, progress, log, lab, settings, about. One delegated click listener handles `[data-go]` elements.
- `PX.core.svg`: `el(tag, attrs, children?)`, `svg(w, h, attrs)` (viewBox-based, scales to its box), `path(points, closed)`, `text(...)`.
- `PX.ui`: `h(tag, attrs, ...children)` hyperscript; `modal({title, body, actions, onClose, dismissable}) → close` (focus trap, Esc, returns focus); `toast(msg)`; `confirm(msg) → Promise<boolean>`; `button(label, opts)`; `bar(value, max, opts)` progress bar; `ring(value, max)`; `choiceGrid(n, layout) → {cells, select(i), mark(i, state), onPick(fn)}`; `copyBox(text)` (export fallback).
- `PX.core.stage3d`: `available()`; `renderer()` (lazy, the only WebGLRenderer; DPR capped at 2); `attach(container) → view {scene, camera, resize(), render(), detach()}`; `snapshot(scene, camera, w, h) → HTMLCanvasElement` (copies the rendered image to a 2D canvas synchronously); `loop` from timing; shared materials and builders: `cubeGroup(cells, opts)` (unit cubes with outline edges, Shepard–Metzler look), `sphere(radius, color)`, `wireBox(size)`; theme colours from CSS tokens. If WebGL is unavailable, `available()` is false and 3D exercises are shown as unavailable with a reason, never as a crash.
  - Spike facts (spike/RESULTS.md): three r186 needs WebGL 2. A page gets 16 WebGL contexts and the 17th silently kills the oldest, so there is exactly one renderer. `snapshot` renders offscreen and copies to a 2D canvas (7–21 ms each in software rendering): render option thumbnails during the ready phase, never during a stimulus phase. Cap DPR at 2 and turn antialiasing off when DPR ≥ 2 or the screen is phone-sized. Handle `webglcontextlost` / `restored`: the current trial is voided (stutter) and the scene is rebuilt. Quality steps down automatically (DPR 1, no antialiasing) after two stuttered trials, and the Settings screen shows it. A live WebGL canvas prints blank, so screenshots for the guide are PNG files.
  - Pointer picking of small objects (Track spheres are 26–31 px on phones): choose the nearest object within 36 px of the tap, not only exact hits.

## 5. Exercise definition (`js/ex/<id>/gen.js`, pure)
```js
PX.ex.define({
  id: 'rotate', version: 1, code: 'EX-02', name: 'Mental Rotation', short: 'Rotate',
  abilities: ['Vz', 'SR'],          // ability codes (§11), first = primary
  cell: 'intrinsic-dynamic',        // Uttal/Newcombe-Shipley cell, or null when the task is outside the 2×2 (Track, Span); a checklist label only
  role: 'train',                    // 'train' or 'probe' (probes appear only in the Spatial Check)
  answer: 'choice',                 // choice | multi | yesno | angle | targets | sequence
  nOptions: 4,                      // choice and multi
  nCorrect: 1,                      // multi: how many options must be picked (Rotate/Spin "pick the two that match" = 2; right only if exactly those)
  perDisplay: false,                // true for Track and Homing: ratings kept per screen class ('small' < 600 CSS px short side, else 'large')
  extraParams: [],                  // params keys that are not dims (Track: 'speedValue' for staircases); allowed, ignored by paramsCode
  practice: undefined,              // 'attention' for Track: the UI labels it attention practice, not visuospatial training
  lib: {},                          // optional pure helpers shared with the view and tests (geometry, simulation, glyphs)
  dims: [                           // difficulty dimensions; each level index adds `step` logits
    { key: 'angle', label: 'Angle', levels: [30, 60, 90, 120, 150, 180], step: 0.25 },
    { key: 'axis',  label: 'Axis',  levels: ['picture', 'depth', 'oblique'], step: 0.45 },
  ],
  base: -2.0,                       // difficulty (logits) with every dim at level 0
  difficulty(params) { },           // optional override; default base + Σ step·index
  variants: ['pick1', 'samediff'],  // optional formats that vary the task without changing difficulty much
  chance(params) { return 0.25; },  // guessing probability for the estimator
  timeLimit(params) { return null; },// ms or null (untimed); Speed mode imposes its own deadlines
  generate(rng, params) { },        // → item (JSON-serialisable, fully determined by seed + params)
  validate(item) { },               // → true or a string reason; independent solver check
  score(item, response) { },        // → { correct: boolean, value?: number, detail?: any }
});
```
- `params` is `{ <dimKey>: levelIndex, variant?: string }`. Items carry `{ ex, seed, params, key, … }`, where `key` is the correct response in the same shape `score` expects.
- `generate` never throws for any valid params. It retries internally with `rng.fork('retry'+i)` until the item is valid (at most 50 tries), then falls back to a construction known to be valid and marks the item `fallback: true` (the engine voids such trials). When the full `validate` is expensive, `generate` may use its own equivalent checks instead of calling it, provided the node tests run the full `validate` on every one of the ≥ 10 000 seeds.
- Items may carry extra values the log needs (Track: `item.speedValue`, the exact continuous speed); Threshold runs record them per trial, since paramsCode keeps only the nearest level.
- While writing a gen.js, write it outside the repository and move it into place once it loads (the runner now tolerates other exercises' broken files, but the app does not). Run your own tests with a filter: `node tests/node/run.mjs <id>`.
- `validate` re-derives the answer independently of the generator's bookkeeping (brute force where possible): exactly one correct option; options pairwise different in a way a person can see; the distinguishing feature visible from the shown viewpoint; mirror distractors not equal to any rotation of the original.
- Responses by answer type: choice → option index; multi → sorted array of indices; yesno → true/false; angle → degrees (0–360, clockwise from the reference); targets → sorted array of object ids; sequence → array of cell ids.

## 6. Exercise view (`js/ex/<id>/view.js`, DOM)
```js
PX.ex.view('rotate', {
  layout: 'stem+options',          // the player draws a choice grid and calls drawOption; or 'custom'
  mount(ctx) { },                  // ctx: { host, stage3d, svg, ui, theme, settings, fast }
  present(item, ctx) { },          // draw the question; return Promise<paintTimestamp> (use timing.nextPaint)
  drawOption(el, item, i, ctx) { },// stem+options only: draw option i inside el
  collect(item, ctx, respond) { }, // custom layout only: wire input; call respond(response) exactly once
  reveal(item, response, result, ctx) { },  // mark right/wrong in place; Promise, ≤ 700 ms
  showMe(item, response, ctx) { }, // animated worked solution from the same model as the key; skippable; Promise
  demo(item, ctx, caption) { },    // tutorial: play the solution with caption(text) calls; Promise
  unmount(ctx) { },
});
```
- More view conventions (details in docs/dev/EXERCISE-GUIDE.md): `ctx.play(steps, opts)` runs show-me and demo (step = `{ ms, caption, enter, update(k), exit }`, with Pause/Step/Replay/Close, fast and reduced motion; the harness's play() is the reference that ui/play.js copies); `drawOption` runs in the ready phase (grid laid out but hidden) before `present`, so snapshots go there; optional view fields `needs` (e.g. ['webgl']), `css` (true loads css/ex/<id>.css), `optionLabel(item, i)`, `gridCols`; `stage3d.snapshot(…, { transparent })`. A `stage3d:lost` bus event voids the current trial.
- index.html: `python3 tools/sync-index.py` activates PENDING lines whose files exist (`--only REGEX` to limit, `--check` to verify).
- Variants may answer differently (Spin and Rotate: 'samediff' is yesno, 'pick' is multi): the definition declares its main `answer` plus `answers: { <variant>: <type> }`, every item carries `item.answer`, `chance(params)` depends on `params.variant`, and the player, engine and scorer always use `item.answer || def.answer`.
- The number of options can vary per item: the player sizes the choice grid from `item.options.length` (`nOptions` is the maximum; Fold has 4 or 5, Nets 4 or 2). Yes/no questions may be 2-option choices with `item.format` naming the labels.
- The player (ui/play.js) owns phases (ready → present → respond → reveal → next), the answer clock (starts at the timestamp `present` resolves with), keyboard (1–9 pick, Enter confirm, Space next, Esc pause, S show me, ? help), pause, the frame monitor for dynamic exercises, the emergency skip, and logging.
- Views must be keyboard-playable: for custom layouts, register keys through `ctx.keys` (provided by the player) and show the key hints.
- Animations honour `ctx.fast` (tests) and the reduced-motion setting (shorter, never skipped when the motion *is* the stimulus).
- No work during stimulus phases beyond drawing the stimulus: no saves, no DOM observers, no layout thrash.

## 7. Engine (pure; parameters in PLAN.md §Progression)
- `PX.engine.model.p(theta, b, chance, lapse=0.03, a=1)` = chance + (1 − chance − lapse) · σ(a(θ − b)).
- `PX.engine.est`: per-exercise ability as a Gaussian `{mu, sd, n, last}` (per screen class when `perDisplay`); `update(st, b, chance, correct)` by moment matching on a grid (−8..+8 logits); `drift(st, trials, days)` widens sd (learning and forgetting); `level(exDef, st)` → `{ level 1–100, lo, hi, settings }`, where level is the difficulty answered right at the fixed reference g + (1 − g) × 0.75 (independent of the style), mapped onto the exercise's difficulty range, and settings describes the real dimension levels at that difficulty. The UI shows level changes at block ends, not per trial.
- `PX.engine.select.params(exDef, st, targetP, policy, recent)` → params whose predicted success is near targetP, choosing among near-equal candidates by the policy's variability (low: change one dimension from the last item; high: least-recently-used levels and variants).
- `PX.engine.staircase`: Kaernbach weighted up-down on one continuous parameter, the transformed 1-up/1-down (Track Standard), and a discrete version (Span length).
- Speed mode keeps a separate timed rating per exercise; Free play never updates ratings.
- `PX.engine.fields()` returns the defaults of every engine-owned record field (path stages, timed ratings, thresholds, style, weekly goal, interleaving stage, pins, baseline expectations, lab arm, strategy check-ins); app.js registers them with `store.field()` so the schema guard keeps them.
- `PX.engine.bandit`: learning progress per exercise (recent improvement of mu), for choosing exercises.
- `PX.engine.schedule / modes`: build a session plan from the learner record and the mode. `assess`: the Spatial Check. `xp`, `achievements`, `streak`, `daily`: gamification. `stats`: summaries for the Progress and Log screens.
- Trials marked `stutter` or `skipped` never update the estimator, staircases, XP for correctness, or achievements based on correctness.

## 8. Learner record (store)
- One key `parallax.v1` in localStorage (the key never changes; the record's `v` is the format: 1 in 1.0.x, 2 from 1.1.0). Shape (1.0; the 1.1 additions are listed after the decisions below):
```js
{ v: 1, rev: 0, created, updated,
  settings: { sessionMin: 20, weeklyGoal: 3, theme: 'auto', reducedMotion: 'auto', sound: false, keyHints: true, textScale: 1, lastBackup: 0 },   // lastBackup: ms timestamp, 0 = never
  ex: { <id>: { mu, sd, n, nRight, last, seen: {<paramsKey>: count}, best: {...}, hist: [[day, mu, sd]] } },
  mot: { core: [{date, threshold}], … },          // Lab staircase results
  sessions: [{ id, start, end, mode, trials, right, xp, exs: [ids], summary }],
  trials: [[tSec, exIndex, modeIndex, paramsCode, seed, outcome, rtMs, value, pPredMilli?, stage?]],   // outcome 1 right, 0 wrong, 2 stutter/void, 3 skipped; the last two optional: predicted P × 1000 and interleaving stage
  achievements: { <id>: dateISO }, streak: { … }, daily: { <YYYY-MM-DD>: result },   // no xp field, no stereo setting
  assess: [{ date, form, results: { <probeId>: { right, n, theta, se } } }],
  tour: { done: false, seen: { <exId>: true } }, ui: { lastRoute } }
```
- `PX.core.store`: `load()` (schema guard: unknown or broken fields are repaired from defaults, never crash), `save()` (debounced, but never during stimulus phases: the player calls `store.hold()` / `store.release()`), `exportJSON()`, `importJSON(text)` (validates, keeps the previous record for one-step undo), `exportCSV()` (trials), `reset()`. Two tabs: a `storage` event with a higher `rev` reloads; a save never overwrites a newer `rev` without merging.
- If storage throws, the app runs from memory and shows a one-line warning ("Progress can't be saved in this view; download the file or open it from disk").
- Trials are capped (keep the latest 20 000; older ones fold into daily summaries).
- **Decided while building the core (30 Oct):**
  - Trial rows index into `idx: { ex: [], mode: [] }` (append-only name lists); ex entries are `"<id>@<version>"`, where `version` is an integer in the exercise definition (default 1). Dims and levels are append-only; a breaking change to dims bumps `version`, so old paramsCodes stay decodable against the old version. Folded trials live in `trialDays: { 'YYYY-MM-DD': { n, right, wrong, stutter, skipped, rtSum, rtN, ex } }`. `tSec` is Unix seconds.
  - Two tabs: a tab that finds a newer `rev` reloads it and emits `store:reload { reason, discarded }`. The engine registers `store.merge(theirs, mine)`: union of trials (a trial matches only an identical whole row, because two tabs can share a second, a seed and an exercise), sessions (by id), achievements, daily and assess results; for each exercise rating keep the side with more trials; settings from the newer side.
  - `PX.bus` is also `PX.core.bus`. `keys.push(map, { through: true })` makes a pass-through layer (the choice grid owns 1–9 while the player keeps Enter, Space, Esc).
  - New fields and settings are registered with `store.field()` / `store.setting()`; `store.exDefaults` gives mu 0, sd 2 until the engine sets its prior.
- **1.1.0 (13 Nov), record format v2:**
  - `v: 2`. A v1 record upgrades silently on load (new fields take their defaults). A 1.0 tab that meets a v2 record runs from memory instead of overwriting it, so 1.1 data is never stripped.
  - Trial rows gain two optional columns: `[..., pPredMilli?, stage?, display?, input?]`, display class 0 unknown, 1 small, 2 large (as `est.displayClass`) and input 0 unknown, 1 mouse, 2 touch, 3 pen, 4 key. Rows of 1.0 stay valid. The CSV export is one 17-column format for every export (`store.csv`, registered by js/ui/log.js).
  - Sessions keep `display`, `viewport` ('390x844'), `input`, `ended` and `budgetMs`; `practiceMs` (top level) is active time from `PX.core.clock` (pause, sheets, modals, a hidden tab and 60 s without input stop it).
  - Check records may carry `display`, `viewport`, `input` (js/ui/check.js) and `overlapAnswer` ('no' | 'little' | 'lot', from the one-tap question on later checks), copied from `plan.check.extra` by `assess.finish`.
  - Fields registered by v1.1 modules: `hygiene` ({ tests, focus }, js/ui/overlap.js), `section` ({ runs, next, live }, js/engine/section.js), `reckon` ({ v, hist }, js/ex/reckon/view.js); settings `patFocus` (bool, "DAT-style focus") and `testPause` ({ ids, until, what } or null, the json setting type).

## 9. Screens (ui/*)
- **Screen contract (from the shell, 30 Oct):** each screen file does `PX.ui.screens = PX.ui.screens || {}; PX.ui.screens.<name> = { title, render(host, route, ctx) → cleanup }`. app.js loads last and shows a placeholder for screens nobody has registered. Shared pieces live in `PX.ui.kit` (icons, spec labels, panels, segmented controls, switches, copy field, "Last backup" line); kit is defined in app.js, so use it inside render only.
- Hooks the shell already calls: `PX.ui.tour.start()` (first-run offer; flag `store.state.ui.tourOffered`); `PX.ui.home.plan(rec, now)` and `PX.ui.home.levels(rec)` (Today shows sample data while they return null); `PX.engine.achievements.get(id) → {name, desc}`; `PX.engine.daily.number(now)`.
- Theme: app.js emits `'theme' { dark }` on PX.bus when it changes; stimulus colours are the `--stim-*` CSS tokens (stage3d reads them).
- index.html: exercise gen/learn/view files sit in commented PENDING blocks; enable each when its node tests pass (tests/e2e/shell.py lists pending files that exist).
- Playwright tip: `page.evaluate` on an expression that returns a function calls it; prefix with `void`.
- welcome (every app open: built by the Chimera community, Discord link, start), tour (first run), home (today), play (trial player + session summary), library (all exercises with levels, learn, practise), progress (profile, levels with bands, Spatial Check and transfer, personal bests, achievements), log (sessions, trials, export), lab (protocols, data, how the engine works), settings, about.
- Phones first: everything works at 360 × 640; no horizontal scroll; touch targets ≥ 44 px.

## 10. Visual design
- "Lab instrument": calm paper-white (light) or graphite (dark) ground, a faint measurement grid, hairline rules, IBM Plex Sans for text and IBM Plex Mono for numbers and labels (tabular figures), one signal accent, specimen-style labels (`EX-02 · Mental rotation · SR`).
- Stimuli follow research conventions: light grey cubes with dark outlines, neutral spheres, high contrast. Colour is never the only cue (shape, outline, label too). Tokens are CSS variables in css/base.css; 3D colours read from them.

## 11. Codes
- CHC Gv narrow abilities: Vz visualization, SR speeded rotation, CS closure speed, CF flexibility of closure, MV visual memory, SS spatial scanning, PI serial perceptual integration, LE length estimation, IL perceptual illusions, PN perceptual alternations, IM imagery. LE is used for Angles (EX-16, the nearest narrow ability for judging angles by eye; labelled perceptual-judgement practice).
- Exercise codes: EX-01…EX-19 (EX-14…EX-19 are the DAT-style formats in PAT order; no code uses the mark, R3 §6); probes PR-0…PR-5.
- Other codes used here (not Gv narrow abilities, labelled as such in the UI): AT attentional tracking (Track), WM working memory (Span), PT perspective taking / spatial orientation (Orient, PR-2), NAV navigation and path integration (Homing, Reckon), MA mental animation (PR-3), VB verbal reasoning (the control probe PR-0).
- Uttal cells: intrinsic-static, intrinsic-dynamic, extrinsic-static, extrinsic-dynamic, or null. Used as a coverage checklist, never as a score (Mix et al. 2018 found the 2×2 does not hold as a factor structure).

## 12. Tests
- `node tests/node/run.mjs` runs every `*.test.mjs`: engine unit checks and, for every exercise, at least 10 000 seeds across all dimension levels and variants: `generate` never throws, `validate` passes, `score(item, item.key).correct === true`, every wrong option scores false, generation is deterministic (same seed → same item), and the generation time stays under 20 ms per item at the hardest level.
- Timing checks measure CPU time (`process.cpuUsage()`; `threadCpuUsage` moves only in scheduler ticks, so per-item figures from it are coarse), best of a few rounds, because wall time is 3–5× higher while agents share the machine. `PX_TEST_ITEMS=<n>` shortens the big seed loops for quick local runs; the full count runs at integration.
- `tests/dev/harness.html?ex=<id>&seed=<n>&p=<dim:level,…>` mounts one exercise view without the app shell and exposes `window.__harness = { item, key, answer(correct), next(params) }` for Playwright.
- Playwright (Python, headless Chromium with the launch arguments from spike/RESULTS.md): e2e flows, every exercise played by keyboard and by pointer, file://, sandboxed srcdoc, storage blocked, phone viewport, the single-file build.
- `PX.debug` (always present, harmless): `current()` → `{exId, item, key}`, `answer(correct)` submits through the same path as a click, `fast(true)` shortens animations.
