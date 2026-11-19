# CONTRACT v1.2: who owns what, and the interfaces between builders

Read with docs/dev/PLAN.md (what to build, acceptance), CLAUDE.md (standing rules), docs/dev/ARCHITECTURE.md, docs/dev/EXERCISE-GUIDE.md and docs/dev/ENGINE.md. Sources: docs/research/v1.2/ (cited "note D2 §3.0"), docs/dev/v1.2/deferred-sweep.md (O1–O61). Precedent: docs/dev/CONTRACT-v1.1.md.

## Wave 1 (PLAN milestones 1 and 2, and Central Point: milestone 8, first bullet)

### Rules for every builder
- One owner per file. "fn:" ownership means only the named functions; add new functions at the end of your own section. The Edit tool refuses stale writes: re-read and retry.
- A change in a file you do not own: append a dated line to docs/dev/v1.2/requests.md, `- [YYYY-MM-DD HH:MM UTC, from X to Y] what, why, by when`; the owner answers by appending ` — DONE (Y, time: what was done)` or ` — NO (Y: why)` to that line. Read the file when you start and about every hour. Unowned files: ask W1-core.
- Git: never switch branches, push or rewrite history. Commit only your own files with explicit paths, `TZ=UTC git commit`, author `Claude <noreply@anthropic.com>`, message ending with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; no session-link line, no link to a chat, session or private page. Index locked: wait and retry. Commit after every working step.
- Decisions: append one line to docs/dev/DECISIONS.md (`- 2026-11-18 (W1-x): decision. Reason: …`), then commit that file alone at once.
- Progress log: docs/dev/progress/W1-<name>.md (done, next, open problems), updated at least hourly. Write files in chunks of ≤ 400 lines.
- Times: this container's clock is not UTC. Write every time in a file from `date -u` (e.g. `date -u +'%Y-%m-%d %H:%M UTC'`), never from plain `date`; the pre-push check fails any time labelled UTC that lies after its commit.
- New files: W1-core puts their lines into index.html PENDING blocks (below). Activate yours with `python3 tools/sync-index.py --only '<your paths regex>'` once its node tests pass; never activate someone else's.
- Tests: `node tests/node/run.mjs <filter>`; browsers only through `tests/e2e/pwslot.sh python3 tests/e2e/<file>.py` (two slots for five builders: short runs with timeouts; never hold a slot while thinking).
- CLAUDE.md rules bind (honesty, test hygiene, ≥ 10 000 seeds, shortcut solvers ≤ chance + 10, runs everywhere, timing validity, accessibility, measurement, privacy). Every number in a text matches the code. No personal data of anyone; never name community members; never quote the owner; times in UTC; repository-relative paths.

### File ownership
| Builder | Owns |
|---|---|
| W1-core | js/engine/* except section.js; js/core/store.js; js/core/util.js (fn: new `fmtSecs` only); js/ex/registry.js; js/ui/play.js; js/ui/progress.js and js/ui/log.js (fn: level labels and answer-time formatting only); css/play.css; index.html; tests/node/run.mjs (MANIFEST), engine*, store*, core*, rebase*, firstband*, pooled* tests, sim.mjs, fixtures/; tests/dev/harness.js and harness.css; tests/e2e/fit.py; tests/e2e/play.py, flows.py, longrun.py, twotabs.py, clock.py; docs/dev/ENGINE.md; this contract and docs/dev/v1.2/requests.md |
| W1-central | js/ex/centralpoint/*, css/ex/centralpoint.css, tests/node/centralpoint*.test.mjs, tests/e2e/harness_centralpoint.py |
| W1-band-A | js/ex/{views,angles,cubes}/*, css/ex/{views,angles,cubes}.css, their tests (node, harness_*.py). views/gen.js's export block stays non-breaking for Missing View |
| W1-band-B | js/ex/{openings,form,patfold,patviews}/*, css/ex/{openings,form,patfold,patviews}.css, their tests; the marked export blocks at the end of js/ex/fold/gen.js and js/ex/nets/gen.js (non-breaking additions only) |
| W1-fixes | js/ex/{homing,reckon}/*, css/ex/{homing,reckon}.css, their tests; js/ui/section.js, js/engine/section.js, css/section.css, tests/node/section*.test.mjs, tests/e2e/section.py |
| W1-rules | js/ui/{app,welcome,about,settings,lab,share,home,library,overlap,tour}.js; js/ui/check.js (fn: the result screen's invite only); js/ui/playtest.js and css/playtest.css (new); css/app.css, css/screens.css; README.md, LICENSE, LICENSE-GUIDE.md, CLAUDE.md, docs/guide/* source texts, tools/build-pdf.py (metadata), docs/dev/ARCHITECTURE.md, docs/dev/EXERCISE-GUIDE.md; tests/e2e/shell.py, screens.py, overlap.py; tests/node/overlap*, chimera*, playtest* tests |

### Who does which plan item
| Item | Owner and part |
|---|---|
| First band, Views and the six DAT-style (note D2 §3.1–3.7) | Band levels with Δ (note D2 §3.8), `starter`, version bump, generator and validator changes, shortcut balance on the band's pool, learn.js teaching data, Show-me changes (O53 Openings, Form's fold part of O51), the demo at the band, the tests of note D2 §3.9 item 1: W1-band-A (views, angles, cubes), W1-band-B (openings, form, patfold, patviews) |
| Engine for the band: σ0 1.5, early stretch items that move one setting only (`stretch1`), starter display, re-basing | W1-core |
| Teaching template in the player (rules card, strategy card before Try 1, faded Try 1, "How to solve" chip, O6 "about two minutes") | W1-core (player); exercise data: band builders |
| firstband.test.mjs, sim.mjs coverage | W1-core |
| Motion comfort O36 (note N1 §5.4, §6 #1–5) | W1-fixes: gentle profile in Homing and Reckon (1.2 m/s, 30°/s, 0.6 s ramps, no speed change within a leg, screen-fixed fixation dot, up to 40 s per route), motion reporting, notice text. W1-core: notice, check-in and new-player cards in the player |
| O4 Pause and End during feedback; O8 Parts during a Watch; O52 runner part (a step that waits for a tap); O5 one answer-time format; O6; O7; O15 | W1-core (O5: also library.js through `PX.util.fmtSecs`: W1-rules) |
| O52 Missing View's Watch step | W1-band-B |
| O9, O10, O11 Section practice | W1-fixes |
| O39, O40 Reckon texts | W1-fixes |
| O25 (the ADA line beside every "DAT scores" negation: card, bridges, overlap note), O43, O59, the analogy line in the "Taking a test soon?" helper and About | W1-rules |
| Milestone 2: CLAUDE.md rewrite (gaps R1, S1), O32 (ARCHITECTURE.md, EXERCISE-GUIDE.md describe 1.1 and this contract) | W1-rules; ENGINE.md: W1-core |
| Chimera C2/O2 (full welcome first launch, one-tap card later), C4, C6 (tour end card), C10 (export and backup dialogs), C13, L1, the invite component | W1-rules |
| Chimera invite slots in the player (standalone Watch, Try, Go end; summary: personal bests, achievements, Path passes) | W1-core; check results: W1-rules (check.js fn) |
| Privacy in exports: filter and test | W1-core (store.js); callers and Settings controls: W1-rules |
| Modes "right when" lines (texts) and the Today suggestion card | W1-rules; the suggestion logic `E.modes.suggest`: W1-core |
| Playtest mode | W1-rules (module, report, note button, Settings); hooks: W1-core |
| Central Point (EX-20) | W1-central; registry, engine and player hooks: W1-core |
| Milestone 2 acceptance: shell.py and the node test for the link in share texts and tutorial ends | W1-rules; longrun.py, play.py, flows.py with the new pop-up: W1-core; section.py: W1-fixes |

### Interfaces

**A. Registry (js/ex/registry.js; W1-core).** New optional definition fields, validated by `PX.ex.check`:
- `starter: { dim: '<key>', levels: n }` or a list of them: the first n levels of that dim are the starter band below the pre-1.2 floor (1 ≤ n < levels). Normalised `def.starters` (list, [] when none) and `def.starter` (its first entry or null). Display only (Library tags, "starter items"); the engine needs nothing else.
- Dim `at: [b0, b1, …]` (length = levels): per-level difficulty contributions used instead of `step × index` by the default difficulty and `range`. A band level in front: `at: [Δ, 0, step, 2·step, …]` with `base` unchanged keeps every old combination's difficulty exact. Custom `difficulty` functions add Δ themselves. Keep `step` (the mean step, for refits).
- `trainVariants: ['quick']`: the variants that automatic choices use (Train, Path, Today's plan, the Daily). Free play, the Library and Speed may use any variant. Default: all.
- `pace: { variants: ['quick'], startMs, minMs, maxMs, target: 0.85, step: 0.03 }`: items of these variants (absent: all) carry a deadline in Train, Path, Free play and the Daily; Speed keeps its own. The engine keeps one deadline per exercise in `rec.ex[id].pace = { ms, n }`, a weighted up/down staircase on log10(ms) (step `step` down after an answer given before the deadline, `step·target/(1 − target)` up after a time-out), so about `target` of answers come in time; only rated Train and Path answers move it. "In time" counts any answer before the deadline, right or wrong: the rating handles accuracy.
- `roundScore(item, result, info) → number 0–100`: a per-item round score (Central Point Quick: closeness and speed). info: `{ rtMs, deadlineMs, timeout, practice }`. Never a lifetime total.
- `bet: '<id>'`: one of `attention, load, variety, strategy, compare, bridge, produce, calibrate, format` (milestone 4 makes it required; declare it now if you know it).
- Answer type `point`: `{ x, y }` numbers in the item's own lattice units; `chance(params)` required; `score` judges it.

**B. Starter band and re-basing (W1-core; note D2 §3.0 A).** An exercise declares its band only through A (new level(s) in front, Δ, `starter`, `version` + 1). Re-basing is automatic:
- `js/engine/rebase.js` holds `V11`, the pre-1.2 range [min, max] of every 1.1 exercise (computed from 1.1 at 196b942). Stored level numbers carry a stamp `rec.scales[id] = [min, max]`, the range they were written on.
- On load, import and another tab's record, a store upgrade hook converts every stored level of an exercise whose stamp (or, in a record of format < 3, `V11`) differs from the current range: `levelOf(new, bOfLevel(old, L))`, rounded. Converted: personal bests `rec.ex[id].best.block.level`; Path (`rec.path[id]`: stage s passed on the old range ⇒ every new stage whose top is at or below the old stage's top is passed, keeping that stage's recheck data; the current stage follows; ema and items reset if its number changes); session summaries' `[exId, n, right, before, after]` levels. Then it stamps the current range. Idempotent.
- New stored level numbers elsewhere (grades, Reach, Atlas, later waves) register a converter: `E.rebase.register(function (rec, id, conv) { … conv(level) … })`.
- Store format 3: a 1.1 tab meeting it runs from memory instead of overwriting it.
- Ratings stay in logits and need no conversion. Shown levels of re-based exercises rise (note D2 §3.0 A).

**C. Level display (W1-core).** `E.est.starter(def, st)` → null when the shown level is above 1, else `{ toNext (0–1, from the prior to level 2), needOf5 (right answers out of 5 on starter items that level 2 asks for) }`. `PX.ui.play.levelText(lv)` → `'level 1 · starter items'` or `'level 12'`; every screen that names a level uses it (Today, Library, Progress, the player). At block ends on level 1 the player adds "k of your last 5 right; level 2 comes at about N of 5 over a block".

**D. Teaching template (learn.js; band builders write the data, W1-core renders it; note D2 §3.0 C).** New or newly used learn.js fields:
- `rules: [text | { text, fig }]` (2–4): the rules card, the first screen of Watch, on phones too ("Watch it solved" closes it). A view may draw a small picture per rule: `view.drawRule(el, fig, ctx)` (SVG, about 96 px; optional).
- `strategyFirst: '<strategy id>'`: that card from `strategies` opens before Try 1 (three steps, one tap to close); afterwards a "How to solve" button in the HUD reopens it through Try and while the exercise has fewer than 20 rated answers. Without it, the first analytic strategy.
- `practice` entries may be objects `{ params: {…}, assist: <JSON>, tip: '<tip id>', seed: n }` (plain params objects still work). Four items (note D2 §3.0 C 4): Try 1 band with `assist` (the first step done), Try 2 band, Try 3 today's level 0, Try 4 the first hard feature. The player sets `ctx.assist` (null otherwise) before `present`; the view draws the step done (Views: the outline frame; Angles: smallest marked, others greyed; Painted Cubes: numbers on all but two cubes; Openings: the key outline traced; Form: neighbours lettered; Hole Punch: the twin cell ringed; Missing View: projection lines in the slot). `tip` forces that tip on the item.
- `demo` at the band, showing every foil kind Try uses (test it: note D2 §3.9 item 1).
- `minutes`: the offer card's estimate (default 2 when `rules` exist, else 1).
- A practice entry may carry `example: { seed, params? }`: the player plays view.demo on that item as a worked example right before the Try item. A Try item with `item.deadlineMs > 0` runs with that deadline.
- Runner steps for `ctx.play`: `{ hold: true, caption }` waits for a tap on "Continue" in the show-me bar before the next step (O52); `ctx.playCmd('step' | 'pause' | 'replay' | 'close')` lets a view drive the runner (a tap on the board steps a Watch). Show-me per exercise as note D2 §3.0 D and §3.1–3.7.
- Watch captions (lead's decision, 18 Nov after the Angles fresh test; DECISIONS): in a demo (Watch, worked example) the runner groups steps by caption (a captioned step and the steps after it up to the next caption) and waits at the end of each group for Next (Enter, a tap on the figure, or `ctx.playCmd('step')`). A group in motion keeps the timed pace (each caption at least 3 s) and only the last group of a run of moving groups waits. A step is in motion when it says `motion: true`, or when it animates (`update`) in a view with `motion: true` or in Track; `motion: false` makes it a still step. The bar's Auto-play switch (`rec.ui.autoplay`) brings back the timed pace. Show-me after an answer keeps its pace; fast mode never waits.

**E. Quick deadline and round score (W1-core hooks; W1-central uses them; PLAN milestone 8).** Central Point declares `variants: ['quick', 'exact']`, `trainVariants: ['quick']`, `pace` for 'quick', `roundScore`. The engine sets `step.deadlineMs` (and `step.paced`); the player shows the countdown bar as for Speed. A custom view may implement `atDeadline(item, ctx) → response | null`: at the deadline the player takes that response (a placed marker), scores it with `def.score`, and logs a time-out (wrong for the rating, `timeout: true`, `result.late = true`); `roundScore` still credits closeness with `info.timeout = true`. The player shows the round score in the verdict ("Round +86"), passes `result.round` to `view.reveal`, and sums rounds per exercise into the session summary (`rounds: { n, total }`) and its card.

**F. Motion exposure (W1-fixes reports, W1-core counts; note N1 §5.4).** View flag `motion: true`. The view calls `ctx.addMotion(ms)` for motion it has shown (route playback, the walk back, the Watch demo walk). `ctx.gentleMotion` is true when setting `gentleMotion` is 'on', or 'auto' with reduced motion on (setting registered in store.js, default 'auto'; the Settings control is W1-rules'). The player: before the first rated item of a motion exercise outside Watch, Try, Go, a one-time card with `learn.motionNotice` (key `rec.ui.seen.walkNotice`); at the next item boundary after 3 min of motion in a session and then every 5 min, a card "Go on · Gentle motion · End session"; for a person with under 10 min of motion before (`rec.ui.motionMs`), after 5 min of motion in the session, a card that offers to end there. Sessions with the gentle profile store `gentle: true`.

**G. Playtest hooks (W1-core emits on PX.bus; W1-rules listens).** `play:screen { screen, mode, exId }` (screen: session, summary, daily-end, free-setup, watch-end, wtg-rules, wtg-watch, wtg-try, card:<id>); `play:trial { mode, exId, practice, outcome, rtMs, timeout, voidReason, display, input, frames, presentMs }` (frames: the monitor's { frames, medianMs, p95Ms, maxGapMs, dropped, stutter } or null); `play:summary { mode, exIds, res, slot, wrap }` after a session's summary renders (slot: an empty `div.pl-playtest-slot` at its top for the three taps per exercise); `play:wtg { exId, result, slot }` when a Watch, Try, Go ends (slot null inside a session); `play:session { mode, ended, practiceMs, answered, right, exIds }` at finish; `play:error { where, message }` from the player's error log. The router's `route` event marks screen changes. Window errors and frame sampling are the module's own; it samples nothing while `body.px-stim` is set and stores its data in a field with `store.exportRule(key, { private: true, pooled: false })`. Default on in test builds (a constant in playtest.js), off at release.

**H. Chimera invites (W1-rules provides; callers place).** `PX.ui.chimera.invite(kind, opts) → Element | null`; kinds `tutorial, best, achievement, path, check, grade, plateau, export, backup, milestone`. One line in the fixed wording, the link https://discord.gg/chmr (new tab) and a Copy button; null when it should not show. At most one per screen (the caller passes its highest kind: best > path > grade > achievement > check), never during a block of items. Callers: W1-core (standalone Watch, Try, Go end; session summary), W1-rules (tour end, check results, export and backup dialogs), later waves (grades, plateau cards). Share texts carry the link (W1-rules).

**I. Export privacy (W1-core; callers W1-rules).** Settings registered in store.js: `nickname` (text ≤ 24, ''), `exportDevice` (bool, false). `store.exportJSON(opts)`: the backup, without fields marked private unless `opts.device` or `exportDevice`. `store.pooled(opts)` → a plain object for the community export: trials (UTC epoch seconds) and sessions as kept; check records (UTC ISO dates); ratings without day keys; every structure keyed by or holding a local day (`hist`, `daily`, `trialDays`, `streak`, Speed's day column) dropped or reduced to undated totals; settings and `ui` dropped; the nickname only with `opts.nickname`; `device: { ua, lang, tz, screen }` only with `opts.device` or `exportDevice`. Fields registered by others appear only through `store.exportRule(key, { pooled: fn(value, ctx) | false, private: bool })`; fn must drop or convert local day keys (`ctx.utcDay(ms)`). Result cards: no name but the typed nickname.

**J. Mode suggestion (W1-core).** `E.modes.suggest(rec, now)` → `{ key, mode, exId, why }` or null: Path for an exercise with 1–39 rated answers and no Path started; Speed for one whose Speed is open, never played, with a settled level. Keys hidden in `rec.ui.hiddenTips[key] > now` are skipped; the UI writes `now + 14 days` on dismiss.

**K. Pause and End during feedback (O4; W1-core).** Pause works while feedback shows: the sheet offers Resume and End session; End finishes the session as the pause sheet's End does today. `P.waitNext()` may resolve `'end'`.

**L. Index.** PENDING lines exist for js/engine/rebase.js, js/engine/pace.js, js/ex/centralpoint/{gen,learn,view}.js, css/ex/centralpoint.css, js/ui/playtest.js, css/playtest.css.

## Wave 2 (PLAN milestones 7, 3, 6 and 4; written by W2-core, 2026-11-18 20:29 UTC)

Wave 1's rules above still hold, with the additions below. The interfaces continue wave 1's letters (M to V). The plan's acceptance lines are each builder's done-criteria ("Done criteria" below). Sources: PLAN.md milestones 3–7; notes P1 §2.4, §3.9–3.10, §4.3–4.4, §6 and Addendum; T1 §3–§5; M1 §4.1, §7, §8 and Addendum; G1 §2 (only to reserve milestone 5's fields).

### Builders and order
| Builder | Milestone | Starts | Notes |
|---|---|---|---|
| W2-core | shared hooks (M to V) | now | Inherits W1-core's files and its open requests. Hooks first, each with a test; then requests.md about every hour. |
| W2-measure | 6, the probes, and milestone 4's crossover power | running | The simulation first (new files only); the build once W2-core's hooks are committed. |
| W2-progress | 7 | when W2-core's hooks are committed (the lead starts it) | First in the owner's priority order. |
| W2-plateau | 3 | same | Detection and most changes need nothing from W2-progress; "Speed inside Train" uses its fluency items (Q). |
| W2-bets | 4 | same | Tags, bet lines, logging and the crossover at once; the layers' build waits for W2-measure's power result (milestone 4 acceptance). |

### Rules for every wave-2 builder
- Requests: as in wave 1. Lines meant for W1-core now go to W2-core; a file no one owns in wave 2 goes to the lead, who assigns it.
- Exercise files (js/ex/<id>/*, css/ex/<id>.css) keep their wave-1 owners, who fix their own findings (band-A and band-B may be resumed). A wave-2 builder adds only what this section names, where it names it: a definition field (`bet`, `format`, `layers`) or a marked block at the end of a file (`/* v1.2 wave 2 (W2-x): … */`). It notes each such edit in requests.md (file and what) and asks the owner for anything else.
- The player and the screens are extended only through the hooks (R): no wave-2 builder but W2-core edits js/ui/play.js, home.js, library.js, settings.js, lab.js, progress.js or about.js.
- Engine code stays pure: it takes `now` and the record, never reads the clock, storage or the DOM, and draws randomness from PX.rng only. A config block comes from `E.defaults(key, block)` in its owner's file; nobody but W2-core edits model.js's DEFAULTS.
- Nothing new during a stimulus: hooks run between items; nothing writes the record or the DOM while `body.px-stim` is set; the store is never held while a hook runs.
- No free text leaves the device: exported fields and event data hold numbers, booleans, ids and tokens; a typed text stays in `rec.ui` (never exported) or is not stored.
- Simulations: the plan's "in sim.mjs" means the simulation suite. Each builder's acceptance runs live in its own script on the shared fixtures (tests/node/sim-progress.mjs, tests/node/sim-plateau.mjs, W2-measure's measure-sim.mjs) and subclass `Learner` in its own fixture file (tests/node/fixtures/learner-<topic>.mjs). A change inside tests/node/fixtures/learner.mjs or sim.mjs goes through W2-core. Before calling a milestone done, its builder runs `nice -n 10 node tests/node/sim.mjs --learners 200` and reports that nothing else moved (ENGINE.md §16 and §18).
- Progress logs: docs/dev/progress/W2-<name>.md. DECISIONS lines: `- 2026-11-18 (W2-x): …`.
- ENGINE.md: each builder writes its own section at the end and never edits another's: §19 Progress on every dimension (W2-progress), §20 Plateaus (W2-plateau), §21 Measurement, which supersedes §10's schedule and words (W2-measure), §22 Bets and layers (W2-bets), §23 Record format 4, trial columns, events and hooks (W2-core).

### File ownership (wave 2)
| Builder | Owns |
|---|---|
| W2-core | Everything W1-core owned (js/engine/* except section.js and the files named below; js/core/store.js; js/ex/registry.js; js/ui/play.js; index.html; tests/node/run.mjs, sim.mjs, fixtures/learner.mjs and fixtures/exercises.mjs; the wave-1 node tests; tests/e2e/play.py, flows.py, longrun.py, twotabs.py, clock.py, fit.py), and now js/ui/home.js, js/ui/log.js and the hook call sites in js/ui/{library,settings,lab,progress,about}.js. New: js/engine/events.js, js/engine/record.js, js/ui/hooks.js, tests/node/{record4,events,hooks,engine-w2}.test.mjs, tests/node/fixtures/records.mjs. In model.js: E.log, E.defaults. In modes.js (fn): start, next, answer, finish, makeStep, the session-length functions (clockIn, paceOf, extend, atEnd, timeLeft), autoFilter, the hook registry (new), MODES.speed, MODES.threshold, the MODES.daily wrapper, checkin, checkinDue, available, suggest, the field registrations. In select.js (fn): the seed functions (mix31, unmix31, inv, unshift, engState, pageSalt, seed, syncSeeds, sharedSeed, rngFor) and the `eng` field. schedule.js and merge.js whole. ARCHITECTURE.md and EXERCISE-GUIDE.md (wave-2 parts), ENGINE.md §23, this contract, requests.md. |
| W2-progress | New: js/engine/dims.js, js/ui/frontier.js, tests/node/dims.test.mjs, tests/node/shortcut-levels.test.mjs, tests/node/sim-progress.mjs, tests/node/fixtures/learner-progress.mjs, docs/dev/v1.2/progress-sim.md. select.js (fn): pick, fixed, params, note, recent, residual, weak, freshness, hamming, and new functions. modes.js (fn): kindFor, early, earlyKind, oneStep, both, earlyStretch, MODES.train.next, MODES.train.answer, MODES.path.next, the rating lines of MODES.path.answer (rate and residual), MODES.free.next. The hook call sites W2-core puts in those functions stay. ENGINE.md §19. |
| W2-plateau | New: js/engine/plateau.js, js/ui/plateau.js, css/plateau.css, tests/node/plateau.test.mjs, tests/node/sim-plateau.mjs, tests/node/fixtures/learner-plateau.mjs, tests/e2e/plateau.py, docs/dev/v1.2/plateau-sim.md. ENGINE.md §20. |
| W2-measure | js/engine/trend.js; js/engine/assess.js (whole, with the MODES.check wrapper in modes.js); js/ui/check.js (whole; keeps W1-rules' invite); the probes js/ex/{cubematch,viewmatch,mechanisms,patterns,level,wordlinks}/* and css/ex/<probe>.css (upgrades as new versions). New: js/ui/measure.js, css/measure.css, the probes js/ex/{otherway,motiongraphs,balance}/* (ids provisional) with css/ex/<id>.css and their tests, tests/node/formats.test.mjs, tests/e2e/check.py. tests/node/trend.test.mjs, tests/node/measure-*.mjs, docs/dev/v1.2/measure-sim.md. ENGINE.md §21. |
| W2-bets | New: js/engine/bets.js, js/ui/bets.js, css/bets.css, tests/node/bets.test.mjs, tests/node/layers-*.test.mjs, tests/e2e/bets.py, and js/ex/<id>/layers.js (pure) and layers-view.js where a layer needs them. In every training exercise's gen.js: the `bet`, `format` and `layers` fields and one marked block at the end. The produce variants of Views, Fold and Slice: the variant appended to `variants`, and its generator, scorer, validator and view code in marked blocks. docs/guide/guide.html (fn: one marked section on the bets). ENGINE.md §22. |

### Who does which plan item
| Item | Owner |
|---|---|
| Record format 4, its migration and fixture test; every wave-2 field registered, milestone 5's reserved | W2-core |
| Trial-row fields, the CSV columns, the pooled export's header | W2-core; the values: each milestone's builder |
| The events table and its API; the showme, card, wtg and suggest events | W2-core; the other kinds: their emitters (O) |
| Hook points: engine (Q), player and screens (R) | W2-core; mounting: each builder |
| Milestone 7: per-dimension offsets, items on the player's own difficulties, the leading dimension, fluency items, the per-dimension frontier on the exercise page, each dimension's spread prior, the share of offsets at the cap, the acceptance runs | W2-progress |
| Milestone 3: the detector with its preconditions and response-time channel, the decision table, changes with trial periods and verdicts, the card on the summary and Today with its invite, plateau events in the record and the export, the acceptance runs | W2-plateau (stage changes and rest through W2-core's hooks; Speed inside Train through W2-progress's fluency share) |
| Milestone 6: the simulation, the trend model, Design A's baselines and blocks with their why-now lines, the meter and verdict words, the measurement week, the randomised starting form, the probe upgrades, Other Way Round, Motion Graphs and the far composite, the reserved-formats test, the Balance and learning-curve checks in the Lab, and milestone 4's crossover power | W2-measure |
| Milestone 4: a bet on every training exercise, bet lines on the exercise page and How to play, "Test the bets with us" in About, the Lab and the guide, BETS_VERSION in exports; comparison rounds, bridge sets, off-screen challenges, draw-the-answer variants, the calibration-detail arm; the crossover and "Join the bet trials"; layer and event logging; dose summaries and the events CSV | W2-bets (the detail switch in the Homing, Reckon and Central Point reveals: requests to those views' owners) |
| Answer-mode meta from custom views (Central Point, Orient, Track, Span, Homing, Reckon) | W2-core asks the views' owners |

### Interfaces

**M. Record format 4 (W2-core; `store.VERSION` 4).**
- A record of format 1–3 upgrades on load, import and another tab's record (guard, then the upgrade hooks), as format 3 did. A format-3 tab (1.2.0-test.1) that meets a format-4 record runs from memory.
- The upgrade hook for `from < 4` (js/engine/record.js; idempotent; nothing else converts): (a) `measure.form0` becomes 'A' when the record holds a check (its baselines were form A), else it stays null and W2-measure draws it at B1 from a seeded hash of `created`; (b) each `rec.assess` entry without `pv` gets `pv: { <probe id>: 1 }` for the probes in its results (every probe was version 1 in format 3: table `P3` in record.js, like rebase.V11). Trial rows of formats 1–3 stay valid as they are.
- New top-level fields. Their repairs never throw and keep what passes:

| Field | Owner | Default | Repair | Pooled export | Two tabs | Stored levels |
|---|---|---|---|---|---|---|
| `events` | W2-core | `{ v: 1, rows: [], folded: {} }` | rows `[tSec, kind, exId \| null, data \| null]`, kind defined (O), data checked against its kind's fields; sorted; beyond 5,000 rows the oldest fold into `folded['<kind>\|<exId or ->']` counts | as is (UTC seconds; tokens and numbers only) | union of rows (whole-row identity), sorted, capped; folded: the larger count per key | none |
| `plateau` | W2-plateau | `{ v: 1, list: [] }` | open container until W2-plateau adds its check (`E.record.check`); `list` holds plateau events (P) | as is (epoch ms, no day keys) | union of `list` by `id`; for one id the entry with a verdict, else the later | `level` in each event: W2-plateau registers a converter (E.rebase.register) |
| `bets` | W2-bets | `{ v: 1 }` | open container until W2-bets adds its check | as is (W2-bets keeps it free of day keys and text) | W2-bets registers (E.merge.register); until then the newer side | none |
| `measure` | W2-measure | `{ v: 1, form0: null }` | open container until W2-measure adds its check | as is | W2-measure registers; until then the newer side | none |
| `game` (milestone 5, reserved) | W2-core now; milestone 5's builder later | `{ v: 1, reach: { high: 0 }, grades: {}, records: {}, firsts: [], atlas: {}, climb: {}, notes: {} }` | open container: the named sub-keys keep their types (objects stay objects, `firsts` a list), unknown sub-keys are kept | left out until milestone 5 gives a rule (the Climb's weeks and field notes are local weeks) | `reach.high`: the larger; the rest the newer side until milestone 5 registers | grades and records: milestone 5 registers a converter |

- Challenge points (milestone 5): the Daily's points go into its `rec.daily[day]` result (open JSON, left out of the pooled export as today; milestone 5 adds a summary without days), the Climb's heights into `game.climb`. No lifetime points anywhere (CLAUDE.md rule 11).
- Inside existing containers (their repairs keep extra keys):
  - `rec.ex[id].dims` (and `rec.ex[id].small.dims`), W2-progress: `{ v: <exercise version>, n: <rated answers at the fit>, at: ms, o: [offset per dim in logits, or null for a one-level dim], cap: [0 or 1 per dim], lead: <next leading dim index> }`; it resets when `v` is not the definition's version. Exported and merged with its exercise entry (the side with more trials wins).
  - `rec.timed[id]`: fluency items update this timed rating (W2-progress); no new key is required.
  - `rec.assess[]`, W2-measure: `kind` gains 'block' and 'week' (an embedded block; a measurement-week block) beside B1, B2, B3, regular and delayed; every new entry carries `items: { <probe id>: [[b, g, ok, rtMs], …] }` (b and g to 3 decimals, ok 0 or 1, rtMs or null) and `pv: { <probe id>: version }`; `late: true` marks a baseline taken after rated training began. `E.assess.checks(rec)` returns full checks only (never 'block' or 'week'), so achievements, Today's count and Progress keep their meaning; `E.assess.occasions(rec)` returns every entry for the trend model.
  - `rec.sessions[]`, W2-core adds two optional keys to the store's session repair: `kind` (a token; W2-measure marks its check sessions 'block', 'week', 'baseline' or 'check') and `ext` (an open JSON object of at most 4 KB, one key per owner: `measure`, `bets`, `dims`, `plateau`, `game`; no day keys, no text).
  - `rec.ui`: UI-only flags under the owner's key (`ui.plateau`, `ui.measure`, `ui.bets`); never exported.
- New settings, registered by the owner's file with `store.setting` (settings are never pooled; the export header states what an analysis needs): `betTrials` bool, default true (W2-bets: "Join the bet trials"); `measureWeek` bool, default false (W2-measure: the opt-in measurement week). Reserved for milestone 5: `celebrate` ('quiet' | 'medium' | 'strong', default 'medium'), `climbSound` (bool, default true; it plays only while the global `sound` switch is on, which stays off by default), `rankTitles` (bool, default false).
- No new private field: the playtest log stays the only one.
- `E.record.check(key, fn(value) → repaired | undefined)`: an owner's stricter repair for its container, run inside the registered one. It never throws and keeps keys it does not own.

**N. Trial rows (W2-core: E.log in model.js; the store's trial repair, addTrial and CSV).**
- Columns: 0 tSec, 1 exIndex, 2 modeIndex, 3 paramsCode, 4 seed, 5 outcome, 6 rtMs, 7 value, 8 pPredMilli, 9 stage, 10 display, 11 input, 12 value2 (null when absent and a later column follows), **13 kind, 14 layer, 15 amode, 16 orient, 17 dl** (always written from now on), **18 bOff** (only when not 0). Rows of formats 1–3 (10–13 columns) stay valid; a missing column reads as 0 (value2 as null). Each code list is append-only, and an unknown name logs 0:
  - kind (`E.log.KINDS`): '' 0, warmup 1, target 2, easy 3, stretch 4, stretch1 5, last 6, weak 7 (a weak-spot item: select.pick's weak hit), recheck 8 (Path), lead 9, fluency 10, drill 11, fixed 12, timed 13 (Speed), threshold 14, probe 15, daily 16, climb 17.
  - layer (`LAYERS`): '' 0, compare-apply 1, produce 2, calib-detail 3, bridge 4 (reserved: bridge items are not rows, O).
  - amode (`AMODES`), the control the answer came through: '' 0, option 1 (an answer tile, by tap, click or digit key), drag 2, dial 3, fine 4 (± or nudge buttons), keys 5 (arrow keys move the answer), place 6 (a tap places a marker or picks objects), draw 7.
  - orient (`ORIENTS`): '' 0, portrait 1, landscape 2: the window's shape when the stimulus painted (the player's `P.shape0`).
  - dl (`DEADLINES`): '' 0, pace 1 (an exercise's Quick deadline), speed 2 (Speed mode, fluency items, the Spin deadline protocol), limit 3 (Free play's set deadline, `def.timeLimit`).
  - bOff: milli-logits, `step.b − def.difficulty(params)` (milestone 7's person-specific offset), computed by `E.log.row` from the step.
- Who sets what (nobody writes rows by hand): `E.log.row(rec, def, mode, step, oc, result, now)` reads `step.kind`, `step.layer` (or `def.layers.produce === params.variant` → produce), `step.paced`, `step.timed`, `step.deadlineMs` and `def.timeLimit(params)` (for dl), `step.b`, `result.amode` and `result.orient`; a caller whose step has no kind (Section practice) logs kind 0. The player sets `result.amode` ('option' for the answer grid; a custom view's respond meta `amode`, or Homing's and Reckon's `mode`) and `result.orient`. `store.addTrial({ …, kind, layer, amode, orient, dl, bOff })` takes the names too.
- Reading: `E.log.read(rec, row) → { t, ex, ver, mode, code, seed, outcome, rt, value, pp, stage, display, input, value2, kind, layer, amode, orient, dl, bOff }` (names, not codes); `E.log.bUsed(def, row, ver) → b + bOff / 1000`, or null when the row's version is not the definition's. The store's DISPLAYS and INPUTS stay equal to E.log's (a test).
- Bet and format are not columns: both follow from exercise@version and the variant (S), and the exports carry the lookup tables (T).
- What each milestone logs: 7: kind lead or fluency, dl speed on fluency items, bOff; 3: kind drill (a change's period comes from its plateau event, P); 6: probe items as mode 'check' rows with kind probe, embedded blocks included, and the items in their rec.assess entry (M); 4: layer on every row; bridge outcomes in their events (O).

**O. Events table (W2-core: js/engine/events.js; pure).**
- `E.events.define(kind, { owner, fields: { <name>: type } })`. Types: 'int', 'num', 'bool' (stored 0 or 1), 'token' (/^[A-Za-z0-9_.:@-]{1,64}$/), 'seed' (uint32), 'ms' (epoch ms), 'list' (at most 20 items, each a number, a token or such a list). Unknown fields are dropped, so no free text can be stored.
- `E.events.add(rec, kind, exId, data, now) → row | null` (null for an unknown kind or an invalid exId). Callers add events between items and then call `store.save()`.
- `E.events.list(rec, { kind, exId, since, until }) → [{ t (ms), kind, exId, data }]`; `E.events.count(rec, kind, exId?)` (folded rows included).
- `E.events.source(kind, fn(rec) → [{ t, exId, data }])`: rows built from other fields for the export (W2-core: checkins from `rec.strategies`; W2-plateau: plateau rows from `rec.plateau`). `E.events.table(rec)` → every row, sorted by time: what the events CSV writes.
- Kinds (each owner defines its own in its own file; names below are fixed):

| kind | data fields | emitted by | when |
|---|---|---|---|
| showme | seed, auto, ms, steps, replays, closed | W2-core (play.js) | a show-me after an answer ends (automatic, Show me, Why?) |
| card | card (strategy id; 'all' for the sheet of every card the two-miss offer opens), src (misses, howto, wtg, plateau; the Library shows its cards inline, so none from it), ms | W2-core (play.js) | a strategy card closes |
| wtg | result (done, skipped, end), ms, tries, right | W2-core | Watch, Try, Go ends |
| suggest | key, mode, act (go, hide) | W2-core (home.js) | a tap on a mode suggestion |
| checkin | answer | W2-core (source: rec.strategies) | export only |
| compare | a, aSeed, b, bSeed (exercise keys and seeds of the pair), principle, stage, choice, correct, rt, apply (the apply item's seed, or 0) | W2-bets | a comparison round ends |
| bridge | set, map, mapOk, items (a list of [seed, code, outcome, rt]), use, other (1 when a text was typed; never the text) | W2-bets | a bridge set ends |
| offscreen | challenge, did | W2-bets | a challenge viewed; "I did it" |
| assign | layer, arm (on, off), period, from, until, seed | W2-bets | a crossover period starts |
| expect | bet, rating (1–5), when (baseline, w4) | W2-bets | an expectation rating |
| background | q, a | W2-measure, W2-bets | a one-tap background question (e.g. q 'motion-graphs') |
| measure | what (block-skip, baseline-later, week-on, week-off), kind | W2-measure | a measurement choice |
| plateau | id, phase (fire, verdict), change, words | W2-plateau (source: rec.plateau) | export only |

  Reserved for milestone 5: grade, first, climb, note.

**P. Plateau events (W2-plateau; `rec.plateau.list`).** One entry per event, with at least these fields (the card, Today, the Library line and the export read nothing else):
```
{ id: '<exId>:<at>', exId, disp: 'large' | 'small' | null, at: ms (the session's end), session: '<session id>',
  kind: 'plateau' | 'ceiling' | 'faster',
  n: [n0, n1] (the exercise's rated answers at the window's ends), sessions, days,
  beta, se (logit per 100 rated answers), rt: { slope, se } | null,
  level: { lv, lo, hi } (the shown level; converted by rebase),
  row: 1–8, reason: '<signal id>', change: '<change id>', detail: { dim, level, strategy, variant, k, days } (the keys that apply),
  eligible: ['<change id>', …], drawn: 0 | 1, seed,
  trial: { sessions: 3, answers: 120, s0, n0, end: ms | null, restUntil: ms | null },
  verdict: null | { at: ms, words: 'up' | 'unclear' | 'none', diff, se },
  shown: { summary: 0 | 1, today: ms } }
```
- `kind` 'ceiling' (the rating predicts more than the target on the pool's hardest settings: "top of the range", Speed or another variant suggested) and 'faster' (a steady level with faster answers: Speed suggested) are not plateaus: no change, no trial period. A gap of more than 14 days restarts the window and makes no event.
- Signal ids, the rows of note P1 §3.9: switch-deficit 1, weak-frontier 2, slow-accurate 3, massed 4, strategy 5, narrow-mix 6, stretch-beaten 7, otherwise 8. Change ids: stage-back, drill, speed-in-train, rest, other-strategy, wider-mix, variant-swap, aim-higher, stage-forward, new-variant. Rows 1–4 answer their signal first (`drawn: 0`); among eligible rows 5–8 the change is drawn at random with a logged seed (`drawn: 1`).
- The detector's rows: the exercise's Train and Path rows (per display class where ratings are) with outcome 0 or 1, dl 0 or pace (conflict 1), kind not fluency; b from `E.log.bUsed` (the difficulty the rating used), g from `def.chance(params)`; a switch is a row whose previous row in the same session (rec.sessions start to end) is another exercise.

**Q. Engine modules and hook points (pure).**
- W2-core, delivered first:
  - `E.modes.hook(point, fn, { id, order }) → off` and `E.modes.hooks(point) → [{ id, order }]`. Lower `order` runs first (ties: registration order). A hook that throws is skipped and logged in `plan.errors`; tests fail on any. Points:
    - `start` fn(plan, rec, opts, now): after the mode's own start (plan.unavailable already set).
    - `kind` fn(plan, rec, def, kind, ctx) → a new kind or null: in MODES.train.next and MODES.path.next, after the deck deals `kind`, before the select options are built; ctx `{ st, now, run, recent, deck (the kinds left), share: { fluency, lead } }`.
    - `pick` fn(plan, rec, def, o, ctx) → extra step fields or null: right before `E.select.pick` in Train, Path and Free play's adaptive items; `o` is the select options (k, kind, filter, weak, policy, pool, target: mutable); ctx `{ kind, st, now, run, runFilter (the run's variant filter before trainVariants), share }`; the extra fields may set kind, deadlineMs, timed, layer, bTimed.
    - `answer` fn(plan, rec, step, result, out, now): at the end of `modes.answer`, for every outcome (`out.outcome`).
    - `finish` fn(plan, rec, now, res): after the session is pushed (`res.session` when there were answers), before the streak and achievements.
  - `E.schedule.hook('exclude', fn(rec, def, now) → { why, until } | null, { id, order })`: automatic choices (`E.schedule.auto`: Train, Today's plan, the beginner order) skip an excluded exercise; explicit picks never do. `E.schedule.excluded(rec, def, now)` gives the Library and Today the reason. `E.schedule.setStage(rec, exId, stage)` (1–5) moves an interleaving stage.
  - `E.merge.register(key, fn(theirs, mine) → value)`: a field's own two-tab merge (an unregistered field takes the newer side).
  - `E.defaults(key, block)`: a config block (`E.config[key]`, restored by `configure('reset')`); it throws on a key in use.
  - `E.record.check` (M), E.log (N), E.events (O).
- W2-progress (js/engine/dims.js; config block 'dims'):
  - `E.dims.state(rec, def, display) → { o, cap, n, active } | null`; `E.dims.fit(rec, def, display, now)` from the finish hook (order 10): ridge logistic regression on the last 400 rated untimed answers, prior SD `config.dims.prior` × |step| per dim, cap `config.dims.cap` logit at a dim's top level, active from 100 answers.
  - `E.dims.b(rec, def, display, params) → logits` and `E.dims.pool(rec, def, display)` → the pool with person-specific b (select.pick's `o.pool`).
  - `E.dims.lead(rec, def, display) → { dim, level }` (the rotation); `E.dims.frontier(rec, def, display) → [{ dim, level, value }]` (settings handled per dimension: the exercise page; the plateau card's drill).
  - Kind hook (order 10): one target item in five becomes lead; the easy item becomes fluency once Speed is open (`ctx.share.fluency`: 0.1 of a deck by default; a plateau change may raise it). Pick hook (order 10): the person pool; fluency items from the fluent zone with the Speed deadline (`extra { kind: 'fluency', deadlineMs, timed: true }`). MODES.train.answer rates a fluency answer on the timed rating only (conflict 2).
- W2-plateau (js/engine/plateau.js; config block 'plateau'):
  - `E.plateau.detect(rec, def, opts, now) → { ready, why (the failed precondition), fire, beta, se, n: [n0, n1], sessions, days, rt }`; `E.plateau.signals(rec, def, det, now) → { <signal id>: value }`; `E.plateau.choose(signals, rng) → { row, change, detail, eligible, drawn }`.
  - `E.plateau.active(rec, exId, now) → event | null` (in its trial period); `E.plateau.card(rec, now) → event | null` (the one Today shows); `E.plateau.list(rec, exId?)`.
  - Finish hook (order 20): follow-ups first (trial periods that end, verdicts), then detection for each exercise with at least 10 rated answers in a Train or Path session → `res.plateau = { fired: [events], ended: [events] }`.
  - Kind and pick hooks (order 20): drill, aim higher (`o.k`), wider mix or variant swap (`o.filter`, `o.policy`), Speed inside Train (`ctx.share.fluency`). The exclude hook (rest); `E.schedule.setStage` (stage back or forward); a level converter (`E.rebase.register`); the 'plateau' events source.
- W2-measure (js/engine/trend.js and assess.js; config `E.trend.config` and `config.assess`):
  - E.trend as committed (fit, track, milestoneAt, verdict, predict, familiarity, configure).
  - `modes.start(rec, 'check', { kind })`: kind 'block' (W2-measure's mix of 18 Nov: 14 items, about 3.5 minutes, probes rotating within each rung), 'week', B1, B2, B3, regular, delayed.
  - `E.assess.nextMeasure(rec, now) → { due, kind, when: 'session-start' | 'after-tutorial' | 'check', minutes, why, optional }`: the one answer for the session hooks and Today's why-now line.
  - `E.assess.meter(rec, now) → { p, mean, lo, hi, unit, milestone: { day, words } | null, line }`; `E.assess.checks(rec)` (full checks only); `E.assess.occasions(rec)` (every entry); `report` and `nextCheck` follow Design A; form0 drawn at B1.
- W2-bets (js/engine/bets.js; config block 'bets'):
  - `E.bets.INFO` ({ <bet id>: { label, line, mechanism, grade } }) and `E.bets.VERSION` (BETS_VERSION).
  - `E.bets.arm(rec, exId, layer, now) → 'on' | 'off' | null` (null: not eligible, or the player left the bet trials).
  - `E.bets.due(rec, plan, exId, now, ctx) → { kind: 'compare' | 'bridge', principle, stage, set } | null` (the dose rules of note T1 §4.1–4.2).
  - Finish hook (order 30: periods and assign events); pick hook (order 30: the produce variant and the calib-detail arm → `extra.layer`); `E.bets.dose(rec)` (per exercise and week, per bet and layer, for the research export).

**R. Player and screen hooks (W2-core: js/ui/hooks.js, the first file of js/ui).**
- `PX.ui.hooks.on(point, fn, { id, order }) → off` (a unique id such as 'plateau.card'; order 50 by default); `PX.ui.hooks.run(point, ctx) → Promise<value | null>` for async points (handlers in order; the first non-null result ends the run); `PX.ui.hooks.collect(point, ctx) → [values]` for sync points (every non-null result, in order); `PX.ui.hooks.list(point)`. A handler that throws or rejects is skipped and reported as `play:error`.
- A builder mounts from its own file at load, e.g. `PX.ui.hooks.on('summary:panels', fn, { id: 'plateau.card', order: 20 })`, and never edits the screen's file.
- Player ctx members: `card(o) → Promise<value>` (the player's card above the item; o: id, title, def, lines, actions [{ label, value, primary }]; it emits `play:screen` 'card:<id>' for playtest mode), `P` (the session's player: run, demo, use, setMeta), `wrap`, `clock` ({ pause(reason), resume(reason) }: a measurement pauses it with 'measure', so its time is never practice time), `end(msg)`, `params` (the route's plain params as the session started; the first-run tutorial's end card, js/ui/tour.js, opens Train with `baseline: 'now' | 'later'`, which js/ui/measure.js reads; "Again" never repeats it; added 19 Nov).
- Views: before `present` the player sets `ctx.layer` to the step's layer ('' when none), so a view can switch its feedback (calib-detail).

| Point | Kind | Where and when | ctx (besides the shared members) | Result | Mounted by |
|---|---|---|---|---|---|
| session:start | async | A session screen (train, path, speed, free), after its intro card, before the first item. The session clock has not started. | mode, plan, rec, now | null; 'end' ends the session | W2-measure (10): baselines B2 and B3 when due, a B1 put off earlier, a B1 chosen on the first-run tutorial's end card (params.baseline 'now': no second ask; 'later': none this session), the embedded block, the 4-weekly check |
| item:before | async | Before each item is shown, after Watch, Try, Go, the stage demo and the motion cards; when a handler changes `step.seed`, the item is generated again from it. The clock runs. | mode, plan, rec, now, step (`seed` and `layer` may be set), def, last ({ step, tr, out } or null), afterTutorial, first (the exercise's first item this session), blockEnd, misses | null; 'end' | W2-measure (10): B1 right after the first tutorial, clock paused; W2-plateau (20): the other strategy's card and demo; W2-bets (30): a comparison round (its apply item: sets `step.seed` and `step.layer`), a bridge set |
| item:notes | sync | After an answer, where the level note and the strategy offer go | mode, plan, rec, step, def, item, tr, out | an element, or a function that returns one (queued: one panel per reveal) | W2-progress (fluency notes), W2-bets (apply-item notes) |
| summary:panels | sync | The session summary, after Results and the mode's panel | mode, res, plan, rec, now | { el, order (below 50: before Personal bests; 50 or more: after Achievements), invite (kind), inviteOpts } | W2-plateau (the card, invite 'plateau'), W2-measure (the meter after a block), milestone 5 later |
| today:slots | sync | Today | rec, now, plan | { el, after: '<slot>', replace: '<slot>', order } | W2-plateau (after 'session'; it replaces 'suggest' while its change is a mode), W2-measure (replaces 'check') |
| today:session | sync | Under Today's plan, in the session slot | rec, now, plan | a line (text or element) | W2-measure (why a baseline or block opens the next session), W2-plateau (a change or rest running) |
| exercise:lines | sync | The Library's exercise page (first section) and How to play | def, rec, now, where ('page' or 'howto') | { el, order } | W2-bets (the bet line), W2-progress (settings handled per dimension), W2-plateau (the last change and its verdict) |
| settings:sections | sync | Settings | rec | { el, after: '<section title>' } | W2-bets (Join the bet trials), W2-measure (Measurement week) |
| lab:panels | sync | The Lab | rec, now | { el, after: '<panel title>' } | W2-bets (Test the bets with us, dose, the events export), W2-measure (Balance, the ladder) |
| progress:panels | sync | Progress | rec, now | { el, after, replace: 'check' } | W2-measure (the meter and the ladder), W2-plateau (plateau history) |
| about:sections | sync | About | rec | { el, after } | W2-bets (Test the bets with us) |
| item:reveal | sync | Reserved for milestone 5's game feel after a verdict | | | |

- Today's slot names: session, suggest, goal, daily, levels, check, achievements, data. `replace` takes a slot's place, `after` follows it; several results for one place go by order.
- One Chimera invite per screen: the summary keeps the highest kind among its own and the panels' requests, best > path > grade > plateau > achievement > check, and W2-core places it (CONTRACT H gains 'plateau').
- As built (W2-core, Phase B, 22:02 UTC; commits 7ab13ab, 0845f20): the player hooks run in Train, Path, Speed and Free play only (never the Daily, Threshold or a friend challenge); a seed change at item:before is ignored on a recheck, probe, daily or threshold step; the player resumes the clock's 'measure' reason when an async point's run ends; summary:panels also runs for a summary brought back after a reload (ctx.restored true). `PX.ui.hooks.place(container, results, opts)` and `screen(point, container, ctx, opts)` place screen results: after or in place of a part named by its data-slot, data-section or title (a replacement takes the part's data-slot, data-section and id), the rest at the end (opts.before). Today's slots carry data-slot; with no suggestion a hidden placeholder keeps 'suggest'; a slot that replaces another takes its px-slot--<name> class (the wide layout places slots by class: a slot added *after* one brings its grid placement in its owner's CSS). A view sets the answer mode with its respond meta `amode` (Homing's and Reckon's `mode` also count); the answer grid gives 'option'.

**S. Exercise definitions (W2-core validates in `PX.ex.check`; owners fill).**
- `bet`: required for role 'train' and forbidden for probes once W2-bets has added it to every training exercise (W2-bets asks W2-core to switch the check on; until then bets.test.mjs guards it).
- `format`: a token, or `{ <variant>: token }`, on every exercise and probe (W2-bets for training exercises, W2-measure for probes); the reserved list lives in tests/node/formats.test.mjs (W2-measure), which fails when training material uses a reserved id.
- `layers`: `{ compare: [principle ids], produce: '<variant id>', bridge: '<set id>', calib: true }` (W2-bets).
- `atlas`: `[dimA, dimB]`, two dim keys, reserved for milestone 5.
- A produce variant is appended at the end of `variants` (old params codes stay valid; no version bump) and left out of `trainVariants`; the bets pick hook admits it where the arm is on. Its items get their own input (W2-core, 2026-11-18 23:20 UTC, W2-bets' request): a stem+options view may define `layoutFor(item) → 'custom' | 'stem+options'`; for an item it gives 'custom', the player draws no answer grid and runs the view's `collect(item, ctx, respond)` and `reveal`, as for a custom view (the registry then requires both); the item's answer type is `item.answer` (or `def.answers[variant]`), `def.score` scores it, and the view sends `respond(r, { amode: 'draw' })` (or 'place'). Timing is unchanged: the answer clock runs from the painted frame and nothing extra runs during a stimulus. The player marks the trial `data-item-layout`. It never moves the level scale: the exercise's range and reference guessing rate (`PX.ex.minDifficulty`/`maxDifficulty`, `model.refChance`, and through them levels, Path stages and re-basing) leave out the variant named in `layers.produce` (W2-core; conflict 12).

**T. Exports (W2-core, unless named).**
- Pooled export: `formatVersion` 2. Header keys through `store.header(key, fn(ctx) → value)`: `trialColumns` (the names of N) and `codes` (KINDS, LAYERS, AMODES, ORIENTS, DEADLINES, DISPLAYS, INPUTS, OUTCOMES) by W2-core; `bets` ({ version, byExercise, joined }) and `formats` ({ 'id@v': { <variant or *>: id } }) by W2-bets; `probes` ({ 'id@v': rung }) by W2-measure.
- Trial CSV: `store.CSV_HEADER` grows from 18 to 26 columns, the eight new ones after value2: kind, layer, answer_mode, orientation, deadline, b_offset (logits, 3 decimals), bet, format. The research CSV adds b, g and answer after them, as today. The export dialogs' texts and ARCHITECTURE §8 change with it.
- Events CSV (W2-bets, in the Lab's research export): time_iso, t_sec, kind, exercise, then the kind's fields as one JSON cell.
- The backup (exportJSON) is the record itself: nothing new is private.

**U. Tests that guard each interface.**
| Interface | Test (owner) | Checks |
|---|---|---|
| M | tests/node/record4.test.mjs, with tests/node/fixtures/records.mjs holding format-1, 2 and 3 records (W2-core) | the format becomes 4; new fields take their defaults; old data unchanged except the two conversions; the upgrade is idempotent; a filled format-4 record survives guard, import of its backup and a merge with itself unchanged; broken values are repaired and listed; the pooled export of the filled record has no local day key and no free text anywhere, and leaves `game` out |
| N | tests/node/engine-w2.test.mjs (W2-core) | E.log.row writes columns 13–18 from the step and the result; the trial repair fixes each column; value2's null placeholder; rows of formats 1–3 unchanged; E.log.read round trip; the CSV's 26 columns in order; the store's code lists equal E.log's |
| O | tests/node/events.test.mjs (W2-core) | define and add (free text refused, unknown fields dropped), the cap and folded counts, list and count, table with sources, the two-tab union |
| Q | tests/node/engine-w2.test.mjs (W2-core) | each point is called with its arguments and in order; errors are isolated and reported; kind and pick hooks change a step and its row; the exclude hook removes an exercise from Train and Today's plan but not from explicit picks; setStage; merge.register; E.defaults with reset |
| R | tests/node/hooks.test.mjs (Node, fake DOM) and tests/e2e/play.py `run_hooks` (W2-core) | run and collect semantics; in a browser: a session:start card shows before the first item with the clock at 0; item:before sets the next item's seed and layer and the row logs them; item:notes queues; summary:panels places a panel and keeps one invite (plateau below best); today:slots inserts and replaces; exercise:lines, settings:sections, lab:panels, progress:panels and about:sections place their element |
| S | tests/node/bets.test.mjs (W2-bets), tests/node/formats.test.mjs (W2-measure), registry tests in core.test.mjs (W2-core) | every training exercise has one bet from the list and probes none; each bet is some exercise's main bet; formats declared and none reserved in training material; layers and atlas validated |
| T | tests/node/pooled.test.mjs (W2-core), bets.test.mjs (W2-bets) | the header keys; the export carries every field the plan names (BETS_VERSION, bets and formats per exercise, layer per trial, events) |
| Milestones | their owners (Done criteria) | the plan's acceptance |
- The existing suites stay green: the node suite, sim.mjs's hard checks, play.py, flows.py, longrun.py, twotabs.py (now also merging the new fields), clock.py, fit.py, single.py.

**V. Index and load order (W2-core).**
- Engine, after pace.js: trend.js, events.js, record.js, dims.js, plateau.js, bets.js. js/ui: hooks.js first; frontier.js, plateau.js, measure.js and bets.js after check.js and before playtest.js. CSS: plateau.css, measure.css and bets.css after section.css. New probes: the usual gen, learn and view blocks.
- W2-core adds a PENDING line for every file named here and puts the new engine files into tests/node/run.mjs (a pending list that loads a file once it exists, so nobody waits). Each builder activates its own lines with `python3 tools/sync-index.py --only '<its paths>'` once its node tests pass.

### Done criteria (the plan's acceptance, per builder)
Every builder also: its tests in U pass; the node suite and the browser suites it touches stay green; sim.mjs shows that nothing else moved; its ENGINE.md section and DECISIONS lines are written; requests addressed to it are answered.
- **W2-progress (milestone 7):** "(note P1 §4.4, §6.4 and its Addendum; sim.mjs with uneven learners, f = 0.5, and even learners, f = 0, with no level more than 5 points off; f = 0.9 and a sparse profile reported): ≥ 94 % of target items within ±0.10 of the true edge; no dimension level more than 5 points off and the overall within ±1 point; about 95 % coverage; shortcut solvers within chance + 10 at every dimension level; fluency items within ±2 points of their deadline target; nothing else moves."
- **W2-plateau (milestone 3):** "(note P1 §2.5–2.6; simulated learners in sim.mjs, Train and Path, 120 days): ≤ 5 % false alarms at ≥ 0.25 logit per 100 answers and about 5 % at 0.20; ≥ 65 % of plateaus caught within 600 answers and ≥ 90 % within 800; no flag in the first 640 answers, at the ceiling, inside a trial period or across a break of more than 14 days; "clearly up" for ≤ 5 % of non-responders; the card shows in a longrun."
- **W2-measure (milestone 6):** "(in the simulation, before the build is merged; note M1 §8.4–8.5): false "likely gain" ≤ 5 % at each report (central) and ≤ 6 % ever through week 8, ≤ 10 % under misspecified familiarity (plateau 0.8, or a tail twice the prior), interval coverage 92–98 %; reported against the target the owner chose in decision 2: the share reading "likely gain" and the detectable gain at weeks 4 and 8, and the near rung's at weeks 4 and 6; the real probe reliability substituted as soon as pooled baselines give it." For the new and upgraded probes, CLAUDE.md rules 4 and 5 (validators over 10 000 seeds; shortcut solvers within chance + 10) and rule 10 (no feedback, alternate forms).
- **W2-bets (milestone 4):** "the crossover's power is simulated in sim.mjs together with milestone 6's design before the layers are built (note T1 §5.3); every training exercise has a bet; the assignment is balanced in simulation; the export carries every field (a node test); the guide and About describe each bet in the same words as the code." For layer items: CLAUDE.md rules 4 and 5 (bridge items solver-checked over 10 000 seeds; the comparison rounds' shortcut solvers within chance + 10, note T1 §4.1).
- **W2-core:** M to V delivered with the tests of U before the other builders start; then requests answered about every hour.

### Conflicts between the plan and the code (W2-core's recommendations; the lead decides)
1. **Untimed answers and Central Point.** Milestone 3 detects on "untimed Train and Path answers", but every Train item of Central Point carries its Quick deadline, so it would never be checked. Recommendation: count Quick-paced items (dl pace: the deadline belongs to the format and holds about 85 % in time; a time-out is a wrong answer) and leave out only Speed deadlines (dl speed: fluency items, Speed mode).
2. **Fluency items are Train rows on the timed rating.** Every reader of Train rows assumes untimed answers today: blocks of 10 and personal bests, the rating history, `schedule.trialTimes`, weak-spot residuals, the bandit, Path's gate, the detector. Recommendation: kind fluency and dl speed on the row, `out.rated` false for the untimed rating, and W2-progress lists and tests every reader (a session with fluency items leaves them unchanged).
3. **Bet and format per trial.** Both follow from exercise@version and the variant. Recommendation: lookup tables in the export (BETS_VERSION, bets and formats per exercise), as note T1 §5.3 allows; layer, answer mode and orientation are columns (N).
4. **Bridge items' own key `<id>.bridge`** (note T1 §4.2). Exercise keys allow no dot, and rows under the exercise's own key would put foreign params codes before every scanner of that exercise. Recommendation: a bridge set's item outcomes live in its `bridge` event (O), never in rec.trials.
5. **Blocks beside full checks in rec.assess.** Achievements ("two baselines", "three checks"), Today's count and Progress read every entry as a check. Recommendation: kinds 'block' and 'week', `E.assess.checks()` for full checks only, `E.assess.occasions()` for the trend (M); block items are mode 'check' rows, so "a check is not practice" (weekly goal, practice time, practice days) holds unchanged.
6. **The trial cap.** rec.trials keeps 20 000 rows, then folds them into day totals, which would erase the item data the trend model fits for life. Recommendation: every check, baseline and block entry keeps its own items and probe versions (M).
7. **One invite and one suggestion per screen.** CONTRACT H's priority has no plateau kind, and Today could show a plateau card that suggests a mode beside the mode suggestion (note P1 §5: one at a time). Recommendation: best > path > grade > plateau > achievement > check; on Today the plateau card takes the suggestion slot while its change is a mode (R).
8. **Views' main bet and the crossover.** The produce layer is assigned by the crossover (note T1 §5.3), so Views, whose bet is `produce`, draws in only half the periods. Recommendation: accept it (a tag names the design centre, the crossover tests the layer, note T1 §3.2) and say so in Views' bet line.
9. **The calibration-detail arm** changes what the Homing, Reckon and Central Point reveals show; those views belong to wave 1's builders (and Reckon's rebuild to milestone 8). Recommendation: views read `ctx.layer === 'calib-detail'` (W2-core passes it); W2-bets asks their owners for the switch, and the lead reassigns if they are idle.
10. **Deck crowding.** Milestone 7 turns one target item in five into a leading-dimension item and the easy item into a fluency item, the weak-spot drill takes 20 % of target picks, and plateau changes add drill, fluency and aim-higher items. Recommendation: at most 3 of a deck's 8 target items change kind, and a plateau drill uses the weak-spot share instead of adding to it.
11. **B1 in the first session.** Design A puts B1 (46 items without feedback, about 11.5 minutes in W2-measure's mix) right after the first tutorial, inside a session with a 20-minute budget. Recommendation: it runs from item:before with the session clock paused, so the budget stays training time; "Later" moves it to the next session's start (the plan's put-off baseline, marked `late`).
12. **Draw-the-answer variants and the level scale.** Views, Fold and Slice have no variants today. A produce variant with a guessing rate near 0 would move the median guessing rate (`model.refChance`, the level reference g + (1 − g)·0.75), and a harder offset would widen the range, so every stored and shown level of those exercises would shift for every player, drawing or not. Recommendation: the range and the reference guessing rate leave out `layers.produce` (S); the produce variant's items are rated on the same θ with their own difficulty offset.
