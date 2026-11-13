# RV-code-core: the v1.1 shared code (independent review)

Reviewer: an agent that did not write this code. Date: 2026-11-13. No file under js/, css/, tests/ or
index.html was changed; only read-only git commands were run (diff, log, show, archive into the
scratchpad). No browser was launched.

**Scope.** `git diff f10f7db..HEAD -- js/core js/engine js/ui js/ex/registry.js index.html`, without
the exercise folders. HEAD moved from 2140061 to 37f1024 during the review; nothing in this scope
changed between the two (`git diff --stat 2140061..37f1024` on these paths is empty). Fingerprints
(md5, first 8): clock.js 5cd191dc, store.js 3207f84f, modes.js a32c4c5c, merge.js 5e2bdf68,
stats.js 9ccda819, play.js 014e655c.

**Measured against.** docs/dev/PLAN.md (M1, M2 hooks, M5–M7 data), docs/dev/CONTRACT-v1.1.md (H1–H7,
clock API), docs/research/v1.1/I1-timing-bugs.md (every repro), docs/dev/ARCHITECTURE.md, the
builders' logs (docs/dev/progress/B1.md especially).

**Own checks.** Scripts and outputs in
`/tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad/rv-code/` (each `cN-*.mjs`
writes `cN-*.out`). They load the code the way tests/node/run.mjs does (`createContext({ store: true })`
with its FakeClock and SharedStorage). The v1.0 code comes from `git archive f10f7db` in `v10/`.
- `make-v1-record.mjs`: a real v1.0 record, made by the **v1.0 code** with the test learner: 12
  sessions over 6 days (Train, Free, Path, Daily, a baseline check, a complete and a stopped
  Threshold run), 630 trials, a strategy check-in, non-default settings → `v1-record.json` (53 KB).
- `c1-migration.mjs`: v1 → v2 load, export → import, the one CSV, a 1.0 tab against a v2 record (21/21 ok).
- `c2-merge.mjs`: two v1.1 tabs on one storage, both saving with new v1.1 data (8 ok, 4 FAIL).
- `c3-clock.mjs`: PX.core.clock with a scripted document, window timers and time (7 ok, 5 FAIL).
- `c4-timebox.mjs`: Train, Path, Speed and Free sessions on active time through modes.next/answer/finish (7 ok, 2 FAIL).
- `c5-totals.mjs`: practice totals with a Spatial Check; the Daily partial attempt and its resume (5 ok, 2 FAIL).
- Project suites: `node tests/node/run.mjs core-clock core engine-v11` 540 checks pass;
  `node tests/node/run.mjs section overlap engine` 983 checks pass. One load warning in that run
  (js/ex/form/gen.js:599) was another builder's file in mid-edit; a reload a minute later was clean.

## Findings, ranked

No blockers found. Four should-fix items and nine smaller ones.

### Should fix

**S1. A time-boxed session never ends while its closing item keeps being voided (regression).**
- Where: js/engine/modes.js:138-147 (`atEnd`, boxed branch) and 218-222 (`answer`: a voided or
  skipped `last` item sets `plan.lastServed = false`).
- Why: the boxed branch returns `'last'` whenever `activeMs + pace >= budgetMs`, before it looks at
  the item count. So a voided closing item is replaced by another closing item with no cap. In v1.0
  the item-count check came first and bounded replacements at +25 % (`effTotal`).
- Failure scenario: a phone that stutters on the session's exercise (Track, Homing or Reckon under
  load; the v1.0 lessons say generic rules void many trials on slow devices). The same applies to a
  player who keeps turning the phone during the stimulus ('turned'). Once the budget is reached,
  every closing item is voided and replaced. The HUD says "last item" forever, and the session runs
  past its budget until the player presses End session. Each voided item also adds active time.
- Confirmed: c4 C4.4. In a 2-minute Train session where every item from 110 s on is voided, the
  harness stopped at its 5,000-item guard: 4,980 items after the budget, ended at 30,000 s active.
  With only the closing items voided, also 5,000 items. The same harness ends normal sessions
  within one item of the budget (C4.1: +1 s, +1 s, +15 s at 1.4, 7 and 21 s per item).
- Fix: cap the replacement closing items. For example, count `plan.lastVoids` in `answer()` and
  return `'over'` from `atEnd` after 2, or return `'over'` once `activeMs >= budgetMs + 2·pace`.
  The player could also end the session after VOID_NOTICE voids in a row past the budget.

**S2. Progress counts Spatial Check time as practice; the weekly minutes and practice days do not.**
- Where: js/engine/modes.js:293 adds every session's `practiceMs` to `rec.practiceMs`, mode
  'check' included. js/engine/stats.js:192 returns it as `totals().practiceMs`. js/ui/progress.js:625
  shows it in the header ("N answers on D days · X of practice · K checks"), and progress.js:543
  shows it as "so far". Beside them, `answers`, `practiceDays` (stats.js:185-187) and `week.ms`
  (streak.js:98) all leave checks out.
- Failure scenario: Baseline 1 (about 12 minutes), then one 5-minute Train session. Progress shows
  "Practice this week: 5 min · so far: 17 min on 1 day". The same panel says "a Spatial Check is a
  measurement and does not count". The I1 goal of one number for practice is broken on this one
  screen.
- Aggravating detail: js/ui/check.js:194 touches the clock at every item, and in the Check a time-out
  goes to the next item by itself (feedback is off, so `waitNext` resolves after 300 ms). An
  unattended check therefore keeps its clock running until it ends, and all of that time lands in
  this total.
- Confirmed: c5 C5.1. A check alone gives `totals().practiceMs` 720 000, `week.ms` 0, `answers` 0
  and `practiceDays` 0. After one Train session: 1 020 385 against 300 385.
- Fix: in `stats.totals()`, sum `practiceMs` over sessions with `mode !== 'check'`. Fall back to
  `rec.practiceMs` minus check sessions when sessions were pruned. Keep `merge.js:151-154`
  consistent with it. Alternatively, stop adding check sessions to `rec.practiceMs` in
  `modes.finish`, and make merge's sum skip them too.

**S3. A two-tab merge drops one side's Section runs, Reckon history and test-hygiene log.**
- Where: js/engine/merge.js:63-65. `out = cp(newer)` takes every top-level field that merge does not
  handle itself from the newer side. merge has no rule for v1.1's `section`, `reckon` or `hygiene`.
  "Newer" is decided by `updated`, and in the store's conflict path (js/core/store.js:677-680) the
  side with unsaved changes (`mine`) is always the older one, because `updated` is set only at
  write. So the tab whose save meets the other tab's newer record loses all of these fields.
- Failure scenario: a Section run finishes in tab B while tab A, also open, has written in the last
  moment (B is dirty when A's record arrives). B's run summary disappears from
  `rec.section.runs`: from its history and from the 'full-section' achievement. Its session stays in
  `sessions`, which merge unions. The same happens to Reckon's last-routes history, which feeds
  "your bias over the last 20 routes", and to `hygiene.tests` and `hygiene.focus`, the Lab's record
  of noted tests and PAT-focus switches. The player's settings change in that tab (patFocus,
  testPause) is lost too. That part is v1.0 behaviour for every setting, now reaching the new ones.
- Confirmed: c2. Both tabs keep their sessions, new session fields, trial columns 11-12 and
  practiceMs (sum 5 271 096 = both totals). But `reckon.hist` keeps only tab A's route,
  `section.runs` only 'run-A', and in the reverse case (C2.3) tab B's noted test, focus switch and
  `patFocus: true` are all gone.
- Fix: union `section.runs` by `id` and take the max of `section.next`. Keep `section.live` from the
  side with more answers, or from `mine`. Union `reckon.hist` by its full entry (entry[0] is the
  time in seconds) and keep the last 40. Union `hygiene.tests` by `at` and `hygiene.focus` by
  `[t, v]`. Optional, for settings: in `conflict()`, stamp `mine.updated = Date.now()` before
  merging, so the side with fresh changes counts as newer.

**S4. The 60 s idle cap is applied only when the clock's own timer fires.**
- Where: js/core/clock.js:115-129. `poll` is the only place that stops for idle. `touch` (148-152),
  `activeMs` (110-113) and `stop` (173) never check how long ago the last input was.
- Failure scenario: timers are late while the page stays "visible". Example: a laptop sleeps
  mid-session and wakes. A pointermove that is handled before the overdue timer calls `touch()`,
  so the whole quiet stretch counts as active time. If the tab is then closed, pagehide →
  finishPlan → `stop()` stores the same stretch. Hours can land in practiceMs, the weekly minutes,
  the session's end (it ends at once, over budget) and Speed's "a minute" rate. Browsers do schedule
  input before overdue timers. Whether `performance.now()` advances during system sleep depends on
  the platform.
- Confirmed (clock level): c3 C3.4. With no timer run during an hour of quiet: `activeMs()` reads
  3 600 s. An input before the late timer gives 3 601 s, and `stop()` gives 3 600 s. With timers on
  time the same clock caps at 60 s (C3.2). Browser trigger: **unconfirmed**.
- Fix: one helper, `capIdle(t)`, called first in `touch`, `activeMs`, `stop`, `pause` and `poll`.
  When the clock is running and `t - lastInput >= idleMs`, it applies the idle stop at
  `lastInput + idleMs`, as `poll` does now.

### Nice to have

**N1. "about N min left" rounds up and can claim time that is gone.**
- Where: js/core/clock.js:57-59. `fmtLeft` uses `fmtMinutes`, which rounds.
- Example: 150 s left reads "about 3 min left", and 90 s reads "about 2 min left". PLAN M1 says the
  HUD "never claims time that is gone".
- Confirmed: c3 C3.5.
- Fix: use `Math.floor(ms / 60000)` for the countdown, keeping "less than 1 min left" under 60 s.

**N2. `start()` after `stop()` stays paused when the clock had gone idle.**
- Where: js/core/clock.js:172. `start` does not clear the 'idle' reason.
- Confirmed: c3 C3.3 (`reasons()` stays `['idle']`).
- No caller restarts a stopped clock today, and play.js:1507 touches right after starting, so this
  is latent. The header comment promises "starts counting (again after stop())".
- Fix: `delete reasons.idle` in `start()`.

**N3. A restored Daily summary after midnight offers "Go on now" for yesterday's attempt.**
- Where: js/ui/play.js:1754-1762. `bootRoute` restores any kept summary of the same mode that is
  under 12 h old, with no check of the day. play.js:2112-2117 then shows "Today's attempt so far" and
  "Go on now", which routes to `play?mode=daily`: today's new challenge, not the stopped one.
- Scenario: a Daily left at 3/8 at 23:00 and reopened at 08:00. The card says the attempt "goes on
  where it stopped whenever you open it today", but yesterday's attempt can never be finished.
- Confirmed by trace (daily.start keys the attempt by `day(now)`, daily.js:78).
- Fix: in `bootRoute`, require `L.daily.day === E.daily.day(now())` for the Daily, or drop the
  "Go on" button when the day differs.

**N4. Back or forward to a `#/play` hash still starts a session by itself (pre-existing).**
- Where: js/core/router.js:144-150. `onHashChange` calls `go()` straight away, without
  `PX.ui.play.bootRoute`.
- Scenario: a session ends on its summary (`#/play?mode=train`), the player taps Back to Today
  (`#/home`), then uses the browser's or Android's back. A new Train session starts at once: Train
  has no intro card.
- Confirmed by trace (app.js:617 `onRoute` renders the route with no guard). v1.0 did the same;
  T4's fix covers only boot.
- Fix: route `play` hashes from `onHashChange` through `bootRoute`, or mirror a finished session's
  summary as `#/play?mode=…&restore=1`.

**N5. A crash without pagehide restores the previous session's summary.**
- Where: js/ui/play.js:1665, 1699, 1722. `ui.lastSummary` is written only at an end. A new session
  never clears it, so a tab killed without pagehide reopens on the earlier session's summary (same
  mode, under 12 h). That session's own answers are in the Log, but it has no session entry.
- Confirmed by trace.
- Fix: set `lastSummary = { id: plan.id, live: true }` when a session starts, and restore only a
  finished entry whose id matches.

**N6. Path on a fresh exercise misplaces the intro card's demo answer.**
- Where: js/ui/play.js:1524-1526, with the intro at 1850-1858.
- What happens: the intro offers "Watch the demo". Stage 1's `step.watch` is then taken by the
  Watch, Try, Go offer branch, so `S.introDemo` stays set. The player's answer then decides,
  without asking, the next new stage's card later in the same session: a demo plays by itself, or
  the card is skipped.
- Confirmed by trace (modes.js:551-552 marks the stage watched when it is served).
- Fix: clear `S.introDemo` whenever the Watch, Try, Go branch runs, or do not offer the demo on the
  intro when Watch, Try, Go is still unseen.

**N7. Folded-day answers subtract voided probe rows.**
- Where: js/engine/stats.js:182-183.
- What happens: `foldedAns = right + wrong − probeRows`, but `probeRows` counts every probe row of
  the day, voided and skipped ones too. So a folded check day undercounts training answers by its
  voided probes. It only matters past 20 000 trials.
- Confirmed by trace.
- Fix: count `right + wrong` per probe exercise (fixDay keeps `n` and `right` per exercise, so
  store the wrong count too, or accept the small bias).

**N8. Answer times still have two formats.**
- Where: the verdict and summary use `fmtRt`, two decimals under 10 s (play.js:140). The Log and
  Progress use `exinfo.secs`, one decimal (library.js:192).
- I1 §6.4 asked for one rule. B1 lists this as open.

**N9. Section's countdown writes the HUD every second during px-stim.**
- Where: js/ui/section.js:265-269. Toasts are held back during a stimulus, but the text is not.
- The Section's items are static, so the only effect is rule-7 strictness.
- Fix: skip the text update while `body.px-stim`, as play.js:1448 does.

## I1 repros, one by one (code trace; numbers from the c-scripts where noted)

| I1 | What | Status in code |
|---|---|---|
| T1 | Session ends by a hidden item count; the HUD counts minutes and freezes | Fixed. Boxed plans end on the clock (modes.js:138-147; C4.1 within one item). The HUD reads the live clock and ticks every 5 s outside stimuli (play.js:1448, 1468-1476). After the budget the HUD says "less than 1 min left", then "last item". Rounding: N1. |
| T2 | Pause, hidden tab and idle run the session down; "The clock is stopped" untrue | Fixed. Reasons 'sheet', 'modal', 'hidden' (any phase) and 'idle' (C3.1, C3.2; play.js:1440-1446). The sheet's sentence is now true. Late-timer hole: S4. |
| T3 | Practice minutes drop work over 90 s and count idle gaps | Fixed. `practiceMs` is the clock (modes.js:205-206, 262, 284). Tutorials and the last feedback count. Check time inside the total: S2. |
| T4 | Reload splits a sitting; reopening starts a session | Fixed for boot: pagehide saves the session 'closed' with its kept summary, and `bootRoute` restores it or opens Today (play.js:1716-1762, app.js boot). Back/forward: N4. Crash: N5. |
| T5 | Four minute formats; no totals | Fixed. `fmtMinutes` on Today, the intro line, the summary, the share card, the Log and Progress; totals and week minutes are shown. Answer-time decimals: N8. |
| T6 | Daily: a reload or End now spends the attempt; ✗ for unanswered; UTC vs local; NaN number | Fixed. Partial attempts resume (C5.2), unanswered items show '–', one local day, Today uses `daily.status()`. After midnight: N3. |
| T7 | Speed sized from untimed estimates; deadline vs paint stamp | Fixed. `avgMs` = min(untimed, deadline + overhead) (C4.3: 120 items in 300 s). The limit runs from `P.paintTs` (play.js:478, 489-493). |
| T8 | Check time estimate; silent bars | Fixed. "3 to 5 minutes each" is computed from the probe count, "15 to 25" elsewhere (5 probes). Each task's limit is stated in words (check.js `limitRange`). |
| B1 | Progress counts skipped, voided and probe rows | Fixed (`totals().answers`). Folded edge: N7. |
| B2 | HUD counter one ahead during feedback | Fixed (`S.itemNo`). |
| B3 | Sounds setting did nothing | Implemented with Web Audio. Off by default, never during px-stim, unlocked by a tap. |
| B4 | Two different CSVs | Fixed. One 17-column header, and store.exportCSV goes through log.js (C1.3). |
| B5 | Today's "in order" | Fixed (an unnumbered mix). |
| B6 | Pause label while paused | Fixed ("Resume"). |
| B7 | Threshold and Speed achievements for stopped runs | Fixed. Stopped runs are not saved; the achievements count complete runs only, and v1.0 records use `n >= trials` (the v1.0 stopped run in v1-record.json no longer counts). |
| B8 | Threshold units | Fixed (`thresholdText`: seconds, cw/s, items). |
| B10 | A check counts for the weekly goal | Fixed (`streak.counts`, "Twelve days"). |
| B11 | Deadline bar refills after an answer | Fixed (`animationPlayState: paused`). |
| B12 | Path asks twice | Fixed for seen exercises (one card). Fresh exercises: N6. |

## Checked and found sound

- **Store migration (C1).** The real v1.0 record loads into v1.1 with every field unchanged except
  `v`. `guard()` repairs nothing but the five new defaults (patFocus, testPause, hygiene, reckon,
  section), and loading alone writes nothing. The first save writes `{"v":2,"rev":…` with all v1
  data. Export → import of a record holding every v1.1 addition is clean and identical: trial
  columns 11-12, session display/viewport/input/ended/budgetMs, hygiene, reckon, testPause,
  patFocus and `ui.lastSummary`. `fixSession`, `fixTrial` and `fixAssess` keep every field the v1.1
  code writes, and assess extras are filtered by key and type.
- **A 1.0 tab against v2 (C1.4).** A 1.0 tab opened on a v2 record runs from memory
  ('newer-version'), never writes, and refuses a v2 backup. A 1.0 tab that was open before the
  upgrade, with a pending save, switches to memory on the storage event and leaves the v2 text
  byte-identical. This rests on v1.0's own `v > VERSION` guards, which v2 triggers.
- **Merge (C2).** Sessions (with their new fields), trial rows (with columns 11-12), practiceMs
  (sum of merged sessions, never below either side), and a complete Daily over a partial one all
  come through. The gaps are in S3.
- **Clock (C3).** Pause sheet, modal, hidden tab and stacked reasons: exact (only the time with no
  reason counts). Idle stops at the cap and backdates to it; input resumes. A resume after a long
  sheet counts as someone coming back. `destroy()` removes all 6 document listeners and the timer.
  Every clock owner destroys its clock: play.js `end`, cleanup, intro Back and free-setup, and
  pagehide; check.js finish, stop and cleanup; section.js leaveScreen.
- **Time box (C4).** Train, Path, Speed and Free without a length end within one item of the budget
  at fast, medium and slow paces. A 100 s pause moves wall time but not the end (C4.2).
  `extend()` grows the plan when the player is fast (215 items at 1.4 s per item).
  `ended`: complete, early or closed, as specified.
- **Daily (C5.2).** A closed attempt is partial, not done. Resuming shows only the unanswered items,
  and then the attempt is complete.
- **Rule 6.** No ES modules, `fetch`, workers, `localStorage` outside store.js, `history.*` or
  clipboard calls in the diff. New browser APIs are each feature-checked and inside try:
  matchMedia, AudioContext, `navigator.storage.persist` (not when framed), `navigator.share`
  (not when sandboxed), `location.protocol`, scrollBy. The manifest and icons are linked only on
  https and only for the multi-file build (the files exist). Boot's `router.go('home')` mirrors
  through the same guarded `writeHash` as every later route. In-app buttons use `go:`/data-go.
- **Rule 7.**
  - px-stim covers 'present' and a timed 'respond' (H1). The HUD tick, sounds and `askPersist`
    skip it, and the store is held during present.
  - A turn or a change of screen class during px-stim voids with 'turned' (H3). Pausing a moving
    view freezes and voids it.
  - Voided items never count: Train, Path and Speed log outcome 2 and replace it, with no rating
    and no `answered`; the Daily redoes it; the Check replaces it; Section replaces it (RV-B covers
    its cap).
- **Numbers in texts.** These match the code: "a minute without input" (idleMs 60 000); "10 answers
  or 5 minutes" (minTrials 10, minMs 300 000); "about N min of practice" (budgetMs); "N items"
  (config.daily.items); "3 to 5 minutes each" (computed); "15 to 25 minutes" (5 default probes; no
  UI starts the optional sixth); Section "about 40 seconds an item" (PACE_MS); the Sounds hint
  (660/880 Hz pair against 220 Hz); "full section: at least half" (`2·answered ≥ n`).
- **H4 data.** Rows carry display and input codes (0 = unknown). Sessions and checks store display,
  viewport and input. The CSV writes names. `likeNote` compares only known classes.
- **H5 filters.** PAT and test-paused exercises stay out of Train, Today's plan, the beginner order
  and automatic Path. Pins, Library, Free play, chosen Path, Speed (needs exId) and Section are
  never filtered. The Daily pool always excludes `pat`.
