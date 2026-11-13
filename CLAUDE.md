# Parallax: notes for contributors (people and AI assistants)

Parallax is a free, open-source, offline web app that trains visuospatial ability: 11 procedurally generated exercises, 6 held-out probes for the Spatial Check, five progression modes plus the Check on one learner record, and play-to-learn tutorials. It was built by the Chimera community on Discord (https://discord.gg/chmr).

Read before changing anything: docs/dev/ARCHITECTURE.md (contracts), docs/dev/EXERCISE-GUIDE.md (how an exercise is built, with Rotate as the worked example), docs/dev/ENGINE.md (ratings, item choice, modes, the Spatial Check, simulations), docs/dev/DESIGN-PLAN.md (what was decided and why), and the user guide docs/Parallax-Guide.pdf (research and references).

## Map of the code
- `index.html` loads every stylesheet and classic script in order (PENDING comment blocks mark files being built; `tools/sync-index.py` activates them). No build step is needed to run.
- `js/core/`: `px.js` (namespace, version), `util.js`, `rng.js` (seeded PRNG), `bus.js` (events), `timing.js` (frame clock, stutter monitor), `keys.js` (key layers), `store.js` (versioned local storage, memory fallback, export/import, trial rows), `router.js` (in-memory routes, hash mirror), `svg.js`, `ui.js` (sheets, toasts, cards), `stage3d.js` (the one shared three.js renderer).
- `js/engine/` (pure, Node-tested): `model.js` (item-response model), `estimator.js` (Gaussian rating, `est.shown` level), `select.js` (item choice, seeds, page salt), `staircase.js`, `bandit.js` (learning-progress round-robin), `schedule.js` (interleaving stages), `modes.js` (Train, Path, Threshold, Speed, Free play plans), `assess.js` (Spatial Check), `daily.js`, `achievements.js`, `streak.js` (weekly goal), `stats.js` (summaries, bests), `merge.js` (two-tab merge).
- `js/ex/registry.js`: the exercise contract (`PX.ex.define`). Each `js/ex/<id>/` has `gen.js` (pure generator + validator + shortcut solvers), `learn.js` (Watch-Try-Go texts, tips, strategies) and `view.js` (rendering and input); styles in `css/ex/<id>.css`.
  - Exercises: track, rotate, spin, fold, nets, slice, views, orient, span, hidden, homing. Probes (Spatial Check only): cubematch, viewmatch, mechanisms, patterns, level, wordlinks.
- `js/ui/`: `app.js` (boot, header, Chimera pop-up, offers), `welcome.js`, `home.js` (Today), `library.js`, `play.js` (the player: trials, pauses, show-me, summaries, Watch-Try-Go), `check.js`, `progress.js`, `log.js`, `lab.js`, `settings.js`, `about.js`, `share.js`, `tour.js`.
- `css/`: `base.css` (tokens, themes), `app.css`, `screens.css`, `play.css`, `ex.css`.
- `tests/node/` (run.mjs + *.test.mjs, sim.mjs), `tests/e2e/` (Python Playwright; `pwslot.sh` lock), `tests/dev/harness.html`; `tools/` (build-single, sync-index, shots, build-pdf, vendor-three); `docs/dev/` (ARCHITECTURE, EXERCISE-GUIDE, ENGINE, DESIGN-PLAN, PLAN, STATE, DECISIONS); `docs/research/`; `docs/guide/` (guide source) and `docs/Parallax-Guide.pdf`; `dist/Parallax.html` (single-file build).

## Standing rules (they bind every change)
1. **Chimera**: the welcome pop-up appears on every app open ("built by the Chimera community on Discord" with a clickable https://discord.gg/chmr, also shown as text with a Copy button). The link also stays in the header or More sheet, footer, About, the guide and share cards.
2. **Honesty**: never claim the app raises IQ or makes anyone smarter, or improves grades, work, sport, driving, focus or health, stated or implied. Near transfer is shown; mid transfer is measured on held-out probes; far transfer is cited from research, never promised. Levels carry ranges. "Unclear yet" is not "no progress". Any "where this is used" text carries its limitation line beside it.
3. **Test hygiene**: no clones of standard IQ subtests (Wechsler Block Design, Visual Puzzles), no packing tasks, no copyrighted test items. Every item is procedurally generated.
4. **Solver-verified items**: every generator has an independent validator. Exactly one right answer; distractors visibly different; the distinguishing feature visible; mirror distractors chirality-checked. Node tests run at least 10 000 seeds per exercise.
5. **Shortcut solvers**: cheap heuristics (counting, parity, silhouette, odd one out, most like the others) must stay within chance + 10 points on every item pool.
6. **Runs everywhere**: file://, GitHub Pages, the single-file build, sandboxed srcdoc previews, phones. Classic scripts on window.PX only (no ES modules, no fetch of local files, no workers from files); routing in memory; storage through PX.core.store with a memory fallback; in-app navigation via data-go, never relative hrefs.
7. **Timing validity**: motion from elapsed time; the answer clock starts at the painted frame; no saves or extra work during stimulus phases; voided trials (stutter, pause during a stimulus, device turned, fallback item) never count.
8. **Accessibility**: keyboard play everywhere; touch targets ≥ 44 px; nothing flashes faster than 3 Hz; colour never the only cue; reduced motion respected outside the stimulus itself.
9. **Track (3D multiple-object tracking)** is labelled attention practice, not visuospatial training: no stereo, no commercial trainer's name in the app, its own speed unit.
10. **Measurement**: probes are never trained and give no feedback; two baselines; change is judged against the familiarity estimate and the word-task control, never against zero. No IQ, VSI index, percentile or brain age anywhere.
11. **Gamification**: no points, no leaderboards, no daily loss-framed streaks; honest levels, a weekly goal with grace, skill and good-practice achievements that never say "mastered".
12. **Licences**: code MIT; guide CC BY-SA 4.0; three.js MIT; IBM Plex OFL.

## Working on the code
- `npm install` once (three.js and esbuild, pinned), then `npm test` (= `node tests/node/run.mjs`; filter with names, e.g. `node tests/node/run.mjs rotate engine`).
- Browser tests are Python Playwright: `tests/e2e/pwslot.sh python3 tests/e2e/<file>.py` (pwslot limits concurrent browsers); `tests/run_all.sh` runs everything. The dev harness `tests/dev/harness.html?ex=<id>&seed=<n>&p=<dim:level,…>&v=<variant>` mounts one exercise.
- New script or stylesheet: add it to index.html (PENDING blocks + `python3 tools/sync-index.py`).
- `node tools/build-single.mjs` writes dist/Parallax.html (everything inlined); `python3 tools/shots.py` and `python3 tools/build-pdf.py` rebuild the guide's figures and PDF; `node tools/vendor-three.mjs` rebuilds the three.js subset.
- Changing an exercise's dims or levels incompatibly: bump its `version` (trial logs index exercises as "id@version").

## Lessons from building it
- Sandboxed previews: history.replaceState throws, relative hash links navigate the frame away, new tabs and the async clipboard are blocked; always offer Copy.
- One WebGL context for the whole app (the 17th context silently kills the first); thumbnails are snapshots taken in the ready phase.
- Generic frame-drop rules void too many trials on slow devices; judge what harms the task (Track: sphere jumps larger than about 1.5 diameters).
- A pause during a stimulus must cover the item and make it inert; modals and sheets pause the trial.
- Hand-set item difficulties are a known limit: the engine's simulations under misspecified difficulty still hold targeting, but the community's pooled exports (Lab → research export) are how the steps should be refitted.
