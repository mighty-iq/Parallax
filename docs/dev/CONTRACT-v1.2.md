# CONTRACT v1.2: who owns what, and the interfaces between builders

Read with docs/dev/PLAN.md (what to build, acceptance), CLAUDE.md (standing rules), docs/dev/ARCHITECTURE.md, docs/dev/EXERCISE-GUIDE.md and docs/dev/ENGINE.md. Sources: docs/research/v1.2/ (cited "note D2 §3.0"), docs/dev/v1.2/deferred-sweep.md (O1–O61). Precedent: docs/dev/CONTRACT-v1.1.md.

## Wave 1 (PLAN milestones 1 and 2, and Central Point: milestone 8, first bullet)

### Rules for every builder
- One owner per file. "fn:" ownership means only the named functions; add new functions at the end of your own section. The Edit tool refuses stale writes: re-read and retry.
- A change in a file you do not own: append a dated line to docs/dev/v1.2/requests.md, `- [YYYY-MM-DD HH:MM UTC, from X to Y] what, why, by when`; the owner answers by appending ` — DONE (Y, time: what was done)` or ` — NO (Y: why)` to that line. Read the file when you start and about every hour. Unowned files: ask W1-core.
- Git: never switch branches, push or rewrite history. Commit only your own files with explicit paths, `TZ=UTC git commit`, author `Claude <noreply@anthropic.com>`, message ending with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; no session-link line, no link to a chat, session or private page. Index locked: wait and retry. Commit after every working step.
- Decisions: append one line to docs/dev/DECISIONS.md (`- 2026-11-18 (W1-x): decision. Reason: …`), then commit that file alone at once.
- Progress log: docs/dev/progress/W1-<name>.md (done, next, open problems), updated at least hourly. Write files in chunks of ≤ 400 lines.
- New files: W1-core puts their lines into index.html PENDING blocks (below). Activate yours with `python3 tools/sync-index.py --only '<your paths regex>'` once its node tests pass; never activate someone else's.
- Tests: `node tests/node/run.mjs <filter>`; browsers only through `tests/e2e/pwslot.sh python3 tests/e2e/<file>.py` (two slots for five builders: short runs with timeouts; never hold a slot while thinking).
- CLAUDE.md rules bind (honesty, test hygiene, ≥ 10 000 seeds, shortcut solvers ≤ chance + 10, runs everywhere, timing validity, accessibility, measurement, privacy). Every number in a text matches the code. No personal data of anyone; never name community members; never quote the owner; times in UTC; repository-relative paths.

### File ownership
| Builder | Owns |
|---|---|
| W1-core | js/engine/* except section.js; js/core/store.js; js/core/util.js (fn: new `fmtSecs` only); js/ex/registry.js; js/ui/play.js; js/ui/progress.js and js/ui/log.js (fn: level labels and answer-time formatting only); css/play.css; index.html; tests/node/run.mjs (MANIFEST), engine*, store*, core*, rebase*, firstband*, pooled* tests, sim.mjs, fixtures/; tests/dev/harness.js; tests/e2e/play.py, flows.py, longrun.py, twotabs.py, clock.py; docs/dev/ENGINE.md; this contract and docs/dev/v1.2/requests.md |
| W1-central | js/ex/centralpoint/*, css/ex/centralpoint.css, tests/node/centralpoint*.test.mjs, tests/e2e/harness_centralpoint.py |
| W1-band-A | js/ex/{views,angles,cubes}/*, css/ex/{views,angles,cubes}.css, their tests (node, harness_*.py). views/gen.js's export block stays non-breaking for Missing View |
| W1-band-B | js/ex/{openings,form,patfold,patviews}/*, css/ex/{openings,form,patfold,patviews}.css, their tests; the marked export blocks at the end of js/ex/fold/gen.js and js/ex/nets/gen.js (non-breaking additions only) |
| W1-fixes | js/ex/{homing,reckon}/*, css/ex/{homing,reckon}.css, their tests; js/ui/section.js, js/engine/section.js, css/section.css, tests/node/section*.test.mjs, tests/e2e/section.py |
| W1-rules | js/ui/{app,welcome,about,settings,lab,share,home,library,overlap,tour}.js; js/ui/check.js (fn: the result screen's invite only); js/ui/playtest.js and css/playtest.css (new); css/app.css, css/screens.css; README.md, LICENSE, LICENSE-GUIDE.md, CLAUDE.md, docs/guide/* source texts, docs/dev/ARCHITECTURE.md, docs/dev/EXERCISE-GUIDE.md; tests/e2e/shell.py, screens.py, overlap.py; tests/node/overlap*, chimera*, playtest* tests |

### Who does which plan item
| Item | Owner and part |
|---|---|
| First band, Views and the six DAT-style (note D2 §3.1–3.7) | Band levels with Δ (note D2 §3.8), `starter`, version bump, generator and validator changes, shortcut balance on the band's pool, learn.js teaching data, Show-me changes (O53 Openings, Form's fold part of O51), the demo at the band, the tests of note D2 §3.9 item 1: W1-band-A (views, angles, cubes), W1-band-B (openings, form, patfold, patviews) |
| Engine for the band: σ0 1.5, no early stretch, starter display, re-basing | W1-core |
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
- `starter: { dim: '<key>', levels: n }`: the first n levels of that dim are the starter band below the pre-1.2 floor (1 ≤ n < levels). Display only (Library tags, "starter items"); the engine needs nothing else.
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
- Runner steps for `ctx.play`: `{ hold: true, caption }` waits for a tap on "Continue" in the show-me bar before the next step (O52). Show-me per exercise as note D2 §3.0 D and §3.1–3.7.

**E. Quick deadline and round score (W1-core hooks; W1-central uses them; PLAN milestone 8).** Central Point declares `variants: ['quick', 'exact']`, `trainVariants: ['quick']`, `pace` for 'quick', `roundScore`. The engine sets `step.deadlineMs` (and `step.paced`); the player shows the countdown bar as for Speed. A custom view may implement `atDeadline(item, ctx) → response | null`: at the deadline the player takes that response (a placed marker), scores it with `def.score`, and logs a time-out (wrong for the rating, `timeout: true`, `result.late = true`); `roundScore` still credits closeness with `info.timeout = true`. The player shows the round score in the verdict ("Round +86"), passes `result.round` to `view.reveal`, and sums rounds per exercise into the session summary (`rounds: { n, total }`) and its card.

**F. Motion exposure (W1-fixes reports, W1-core counts; note N1 §5.4).** View flag `motion: true`. The view calls `ctx.addMotion(ms)` for motion it has shown (route playback, the walk back, the Watch demo walk). `ctx.gentleMotion` is true when setting `gentleMotion` is 'on', or 'auto' with reduced motion on (setting registered in store.js, default 'auto'; the Settings control is W1-rules'). The player: before the first rated item of a motion exercise outside Watch, Try, Go, a one-time card with `learn.motionNotice` (key `rec.ui.seen.walkNotice`); at the next item boundary after 3 min of motion in a session and then every 5 min, a card "Go on · Gentle motion · End session"; for a person with under 10 min of motion before (`rec.ui.motionMs`), after 5 min of motion in the session, a card that offers to end there. Sessions with the gentle profile store `gentle: true`.

**G. Playtest hooks (W1-core emits on PX.bus; W1-rules listens).** `play:screen { screen, mode, exId }` (screen: session, summary, daily-end, free-setup, watch-end, wtg-rules, wtg-watch, wtg-try, card:<id>); `play:trial { mode, exId, practice, outcome, rtMs, timeout, voidReason, display, input, frames, presentMs }` (frames: the monitor's { frames, medianMs, p95Ms, maxGapMs, dropped, stutter } or null); `play:summary { mode, exIds, res, slot, wrap }` after a session's summary renders (slot: an empty `div.pl-playtest-slot` at its top for the three taps per exercise); `play:wtg { exId, result, slot }` when a Watch, Try, Go ends (slot null inside a session); `play:session { mode, ended, practiceMs, answered, right, exIds }` at finish; `play:error { where, message }` from the player's error log. The router's `route` event marks screen changes. Window errors and frame sampling are the module's own; it samples nothing while `body.px-stim` is set and stores its data in a field with `store.exportRule(key, { private: true, pooled: false })`. Default on in test builds (a constant in playtest.js), off at release.

**H. Chimera invites (W1-rules provides; callers place).** `PX.ui.chimera.invite(kind, opts) → Element | null`; kinds `tutorial, best, achievement, path, check, grade, plateau, export, backup, milestone`. One line in the fixed wording, the link https://discord.gg/chmr (new tab) and a Copy button; null when it should not show. At most one per screen (the caller passes its highest kind: best > path > grade > achievement > check), never during a block of items. Callers: W1-core (standalone Watch, Try, Go end; session summary), W1-rules (tour end, check results, export and backup dialogs), later waves (grades, plateau cards). Share texts carry the link (W1-rules).

**I. Export privacy (W1-core; callers W1-rules).** Settings registered in store.js: `nickname` (text ≤ 24, ''), `exportDevice` (bool, false). `store.exportJSON(opts)`: the backup, without fields marked private unless `opts.device` or `exportDevice`. `store.pooled(opts)` → a plain object for the community export: trials (UTC epoch seconds) and sessions as kept; check records (UTC ISO dates); ratings without day keys; every structure keyed by or holding a local day (`hist`, `daily`, `trialDays`, `streak`, Speed's day column) dropped or reduced to undated totals; settings and `ui` dropped; the nickname only with `opts.nickname`; `device: { ua, lang, tz, screen }` only with `opts.device` or `exportDevice`. Fields registered by others appear only through `store.exportRule(key, { pooled: fn(value, ctx) | false, private: bool })`; fn must drop or convert local day keys (`ctx.utcDay(ms)`). Result cards: no name but the typed nickname.

**J. Mode suggestion (W1-core).** `E.modes.suggest(rec, now)` → `{ key, mode, exId, why }` or null: Path for an exercise with 1–39 rated answers and no Path started; Speed for one whose Speed is open, never played, with a settled level. Keys hidden in `rec.ui.hiddenTips[key] > now` are skipped; the UI writes `now + 14 days` on dismiss.

**K. Pause and End during feedback (O4; W1-core).** Pause works while feedback shows: the sheet offers Resume and End session; End finishes the session as the pause sheet's End does today. `P.waitNext()` may resolve `'end'`.

**L. Index.** PENDING lines exist for js/engine/rebase.js, js/engine/pace.js, js/ex/centralpoint/{gen,learn,view}.js, css/ex/centralpoint.css, js/ui/playtest.js, css/playtest.css.
