# CONTRACT v1.1: who owns what, and the interfaces between builders

Read with docs/dev/PLAN.md (what to build, acceptance checks), CLAUDE.md (standing rules), docs/dev/ARCHITECTURE.md and docs/dev/EXERCISE-GUIDE.md (how an exercise is built). Research notes: docs/research/v1.1/.

## Rules for every builder
- One owner per file. Edit only what you own. Function-level ownership (marked "fn") means you may edit only the named functions in that file; add new functions at the end of your own section. The Edit tool refuses stale writes: re-read and retry.
- Requests to another owner: append one line to docs/dev/REQUESTS-v1.1.md: `- [from Bx to By] what, why, by when`. Check that file when you start and every hour; do what is asked of you; mention open requests in your report.
- No git commands (the lead commits). Write files in chunks of ≤ 400 lines per call.
- Browser runs only through `tests/e2e/pwslot.sh` (2 browsers for the whole machine). Node: `node tests/node/run.mjs <filter>`.
- New files: their index.html lines already sit in PENDING blocks; activate yours with `python3 tools/sync-index.py --only '<your paths regex>'` once its node tests pass. Never activate someone else's.
- Keep a progress log at docs/dev/progress/<Bx>.md (what is done, what is next, open problems), updated at least every hour, so the work survives an interruption.
- Every number in a user-facing text matches the code. CLAUDE.md rules bind: honesty (rule 2), test hygiene (3), solver-verified items with ≥ 10 000 seeds (4), shortcut solvers ≤ chance + 10 points (5), runs everywhere (6), timing validity (7), accessibility (8), measurement (10), gamification (11).

## Ids and codes (registry entries)
Codes changed on 13 Nov (lead): no code may use the mark (R3 §6), so the DAT-style exercises are EX-14…EX-19 in PAT order (they were PAT-1…PAT-6).
| id | code | name / short | answer | flags |
|---|---|---|---|---|
| reckon | EX-12 | Reckon (experimental) / Reckon | angle (point) or position (return), per variant | experimental, perDisplay, abilities ['NAV'] |
| knots | EX-13 | Knots | yesno or choice, per variant (item.answer) | abilities ['Vz'] |
| openings | EX-14 | Openings | choice (5) | pat |
| patviews | EX-15 | Missing View | choice (4) | pat |
| angles | EX-16 | Angles | choice (4 orderings) | pat, perDisplay, abilities ['LE'] |
| patfold | EX-17 | Hole Punch | choice | pat |
| cubes | EX-18 | Painted Cubes | choice (counts 1–5) | pat |
| form | EX-19 | Form | choice (4) | pat |

Registry (done by the lead): answer type `position` = `{ x, z }` in metres in the item's frame (chance(params) required); flags `pat` (bool) and `experimental` (bool), default false. Per-variant answer types use the existing `answers: { variant: type }` map or `item.answer`; per-item option counts use `item.options` / `item.nOptions` (see play.js answerType/nOptions). three.js subset now also exports TubeGeometry, CatmullRomCurve3, CurvePath, Curve.

## Builders and ownership

### B1: clock, engine, store and player logic (PLAN M1)
- Owns: js/core/store.js, js/core/clock.js (new), js/core/timing.js, js/core/router.js; js/engine/* except section.js; js/ui/home.js, progress.js, log.js, lab.js; js/ui/settings.js (fn: everything except B7's two new sections); js/ui/app.js (fn: everything except B2's new phone functions); js/ui/play.js (fn: makeRunner, createPlayer, answerType, nOptions, nCorrect, safeScore, responseFor, sessionScreen, startOpts, introFor, levelNote, pathNote, nextSuggestion, weekDots, resultRow, renderSummary, modeExtras, shareSession, renderDailyEnd, homePlan, homeLevels, slowMs, the PX.ui.play export block). Tests: tests/node/engine*, store*, core*, sim.mjs; tests/e2e/play.py, flows.py, longrun.py, twotabs.py, clock.py (new).
- Hooks B1 provides to others (do these FIRST, then log them in docs/dev/progress/B1.md):
  - H1 body classes: `px-item` on document.body while any player has an item mounted (sessions, watch, check, daily, free, section), `px-stim` from the start of present() until the answer controls are live and during any timed display; removed on unmount, pause sheet open keeps px-item.
  - H2 the guide: the goal and tip move into one container `div.pl-guide` (inside P.el.root); a HUD button `.pl-hud-guide` (label "Help", data-guide) toggles class `pl-guide-open` on P.el.root; the existing Keys button keeps class `.pl-hud-keys`. B2 decides by CSS when the guide is hidden.
  - H3 a change of orientation or screen class while `px-stim` is set voids the trial with voidReason 'turned' (CLAUDE.md rule 7).
  - H4 data: trial rows gain optional columns 11 (display class: 0 unknown, 1 small, 2 large, matching est.displayClass) and 12 (input: 0 unknown, 1 mouse, 2 touch, 3 pen, 4 key); the player records the pointerType or key of the answering event. Session summaries store `display`, `viewport` ('390x844'), `input`. CSV gains both columns. Old rows stay valid.
  - H5 schedule filters: automatic choices (Train, Today's plan, beginner order, Daily excluded) skip defs with `pat: true` unless `rec.settings.patFocus === true`, and skip ids in `rec.settings.testPause.ids` while today (local date) ≤ `testPause.until`. Explicit picks (Library, Free play, Path chosen by the player, Section) are never filtered. B7 registers both settings with store.setting(); B1 reads them defensively (missing = off).
  - H6 schedule lists: add reckon after homing and knots after nets in the beginner order and similarity groups (reckon with homing; knots with nets, fold).
  - H7 `PX.core.clock`: the active-time clock (see "Clock API" below), exported for the player and for B7's Section mode.
- Owns the version bump to 1.1.0 (px.js, package.json) and the save migration (new fields default safely; old saves load unchanged; export/import round-trip).

### B2: phones (PLAN M2, except Homing and Reckon)
- Owns: css/base.css, app.css, screens.css, play.css, ex.css; css/ex/*.css of the existing exercises and probes except homing.css; js/ex/<id>/view.js of rotate, spin, fold, nets, slice, views, orient, span, hidden, track, cubematch, viewmatch, mechanisms, patterns, level, wordlinks (phone fit only: sizes, label sizes, option grids; no change to what an item shows or how it is scored); js/ui/play.js (fn: setChrome, showCard, closeCards, wtg, freeSetup, watchScreen, howTo, renderUnavailable, screenHead, strategyCards, strategyOffer, checkinFits, checkinNote, openShare); js/ui/check.js (fn: everything except B7's question function); js/ui/welcome.js, share.js, tour.js; js/ui/app.js (fn: new functions for the manifest link on https only, navigator.storage.persist(), the iOS / in-app storage hint); new files manifest.webmanifest and icons/ (linked only on https). Tests: tests/e2e/fit.py (new: every scored item of every exercise and probe at 360×640 shows its stimulus and every answer control without scrolling), screens.py, shell.py, single.py, the existing harness_*.py of the views you own.
- Provides: exports of drawing helpers from fold/view.js or views/view.js when B5/B6 ask (REQUESTS file).
- Calls `PX.ui.overlap && PX.ui.overlap.noteFor(exId)` in howTo to show B7's "Also in tests" note (render nothing when it returns null).
- Spatial Check: store `display`, `viewport`, `input` on each check record (check.js), so results compare like with like.

### B3: Homing and Reckon (PLAN M2 Homing part, M3)
- Owns: js/ex/homing/*, css/ex/homing.css, js/ex/reckon/* (new), css/ex/reckon.css (new); tests/node/homing*.test.mjs, reckon*.test.mjs (new); tests/e2e/harness_homing.py, harness_reckon.py (new).
- Homing: phone layout (view fixed on top, drag-to-turn plus a larger dial with ±1° and ±5°, captions as subtitles, landscape split), Pause freezes the walk, speeds ≤ 2 m/s and ≤ 45°/s, ground without shimmer, a void rule based on measured harm, the "larger screens" notices removed. Keep Homing's landmarks: it is the easier stage before Reckon. Bump Homing's version only if dims or levels change.
- Reckon: as PLAN M3 and docs/research/v1.1/R1-path-integration.md §8. Reuse Homing's route model through exports on Homing's definition (as Homing already exposes route, steer, build…); no copy-paste of shared logic.

### B4: Knots (PLAN M4)
- Owns: js/ex/knots/* (new), css/ex/knots.css (new); tests/node/knots*.test.mjs (new); tests/e2e/harness_knots.py (new). Design: docs/research/v1.1/R2-knots.md (the throwaway prototype is in the scratchpad's r2/ folder named there; reimplement cleanly, no GPL code).

### B5: PAT A: Angles, Hole Punch, Painted Cubes (PLAN M5)
- Owns: js/ex/{angles,patfold,cubes}/* (new), css/ex/{angles,patfold,cubes}.css (new); tests for them (node + harness_*.py); a clearly marked export block at the end of js/ex/fold/gen.js (non-breaking additions only: Fold's ratings, ids and items must not change). Design: docs/research/v1.1/R3-dat-pat.md §8.1, §8.3, §8.4.

### B6: PAT B: Openings, Missing View, Form (PLAN M5)
- Owns: js/ex/{openings,patviews,form}/* (new), css/ex/{openings,patviews,form}.css (new); tests for them; clearly marked export blocks at the end of js/ex/views/gen.js and js/ex/nets/gen.js (non-breaking). Design: R3 §8.2, §8.5, §8.6.

### B7: Section mode, PAT focus, test-overlap notes (PLAN M5 Section and focus, M6)
- Owns: js/engine/section.js (new), js/ui/section.js (new), css/section.css (new), js/ui/overlap.js (new), js/ui/about.js, js/ui/library.js; js/ui/settings.js (fn: two new sections, PAT focus and "Taking a test soon?"); js/ui/check.js (fn: one new function that asks the one-tap question at the start of later checks and stores the answer on the check record). Tests: tests/node/section*.test.mjs, overlap*.test.mjs; tests/e2e/section.py, overlap.py (new).
- Registers its own settings and fields with store.setting()/store.field() at script load: `patFocus` (bool, default false), `testPause` ({ ids, until, what } or null), and a `section` container for Section runs.
- Section mode runs PAT-format items through `PX.ui.play.player(opts)` with `feedback: false` (as check.js does), timed by `PX.core.clock`; full (90 items, 60 min) or mini (30 items, 20 min); review at the end; no rating change; Section trials logged with their own mode name 'section' (store.modeIndex).

## Clock API (B1 implements; B1 and B7 use)
`PX.core.clock.create(opts) → C` with `C.start(now?)`, `C.pause(reason)`, `C.resume(reason)` (reasons stack: 'sheet', 'modal', 'hidden', 'idle', 'user'; the clock runs only when none is active), `C.activeMs(now?)`, `C.running()`, `C.on('tick'|'idle'|'resume', fn)`, `C.destroy()`. It listens for visibilitychange itself and for idle (no input for opts.idleMs, default 60 000 ms; input resumes it). One minutes formatter: `PX.core.clock.fmtMinutes(ms)`, used by every screen that shows practice time.

## Shared data written by more than one builder
- Trial rows: B1 alone writes the row format; others log through the existing store API.
- Check records: B2 adds display/viewport/input; B7 adds `overlapAnswer`; assess.js (B1) keeps unknown extras.
- Settings: B7's `patFocus`, `testPause`; B1's clock and sound settings.

## Order
B1's hooks H1–H7 and the store fields first (target: within the first two hours). B2 builds CSS and screens meanwhile and switches to the hooks when they land. B3–B6 build their exercises independently. B7 starts with overlap notes and settings, then Section mode once one PAT exercise exists.
