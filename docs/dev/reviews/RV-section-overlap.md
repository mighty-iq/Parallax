# RV: Section practice and test-overlap notes (independent review)

Reviewer: an agent that did not build these files. Date: 2026-11-13. No file under js/, css/, tests/ or
index.html was changed and no git command was run. No browser was launched (as instructed); every UI
check below is from reading the code or from a DOM-free harness that runs the real `js/ui/section.js`.

Files reviewed (md5 at review time): js/engine/section.js (f87811ff), js/ui/section.js (2d6f0a8a),
css/section.css (477da1ad), js/ui/overlap.js (8ab4b73e), js/ui/about.js (3ff1cf90), js/ui/library.js
(ba500aac), js/ui/settings.js (7510d49a), js/ui/check.js (3ce0620b), tests/node/section.test.mjs,
tests/node/overlap.test.mjs, tests/e2e/section.py (read, not run). Sources: docs/dev/PLAN.md M5–M6,
docs/dev/CONTRACT-v1.1.md (B7, H5), docs/research/v1.1/R3-dat-pat.md §2, §5, §6, §9, §10,
docs/research/v1.1/R4-test-overlap.md, docs/dev/progress/B7.md.

Own checks (scratchpad `/tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad/rv-b/`,
files loaded as tests/node/run.mjs loads them; outputs in the matching `.out` files):
- `c1-shape-forms.mjs`: shape and budget, alternate forms with the six real DAT-style exercises.
- `c2-run.mjs`: a run's life cycle: ratings, logging, voids, `fixLive` repairs, review lists.
- `c3-filters.mjs`: focus and test-pause filters against the real registry; date boundary under
  TZ = UTC, America/Los_Angeles, Asia/Kolkata, Pacific/Kiritimati.
- `c4-ui.mjs`: js/ui/section.js with a fake DOM, a stub trial player, the real engine, store and clock.
- `node tests/node/run.mjs section overlap`: 373 checks passed (`nodetests.out`).

## Findings, ranked

No blockers found.

### Should fix

**S1. A part that cannot be shown loops forever: voids are replaced without any cap.**
- Where: js/engine/section.js:230-240 (`answer()` with `voided` always pushes a replacement);
  js/ui/section.js:410-412 (`show()` voids the item when `P.use()` fails or `generate()` throws or
  returns null), 456-461 (`voidItem` → `goOn`), 464-467 (`goOn` → `show`). `begin()` (206-240) never
  re-checks `can(def)` for a resumed run.
- Confirmed: c4, flow A. A live mini run is resumed with part 1 (Openings, WebGL) unable to mount.
  After "Start part 1" the screen recursed synchronously until `RangeError: Maximum call stack size
  exceeded`. Part 1 then held 2,100 items, with 2,095 toasts and 2,095 mount attempts. The bloated
  run is the object in `rec.section.live`, so the next debounced save stores it, and every resume
  repeats the loop. c2 shows the engine half: 500 consecutive voids gave 505 items and a 171 KB run,
  and the field repair accepts it.
- A failure that only shows up after presenting the item (`failTrial`, outcome 'stutter') makes the
  same loop asynchronous: one more item and one more toast for every failed attempt, until the clock
  runs out. Confirmed by reading only.
- Fix:
  - Cap replacements per part, for example at most `perPart`, and never more than 2 in a row for
    'error' voids. Past the cap, end the part with a notice ("This part could not be shown here").
  - In `begin()`, re-check `can(def)` for every remaining part of a resumed run, and mark parts that
    can no longer run as missing.
  - Optionally, have `fixLive` reject runs whose parts hold more than about 3 × `perPart` items.

**S2. The helper understates Fold for the DAT.**
- Where: js/ui/overlap.js:72. The `dat` kind has `related: ['fold', 'views', 'nets']`, so Settings
  (settings.js:360) says "Fold, Views and Nets: a small or unknown effect", and the pause leaves Fold
  in Train.
- Research says otherwise:
  - R3 §5.2 (line 391): "Paper Folding | Fold | High: Fold is a superset".
  - R4 §3.4 (line 235) and §6.2 (line 480): Fold is **near** for "DAT PAT" paper folding.
- Confirmed: c3. `match(['dat'])` lists Fold as related, and ticking only the DAT pauses the six
  DAT-style exercises but not Fold.
- Fix: move `fold` to `same` for `dat`, and keep Views and Nets as related (R3 rates them "Medium"
  and "Low–medium").

**S3. Screens disagree on which exercises share formats with tests.**
- The helper's kinds call Rotate and Spin (overlap.js:65 `rotation`) and Slice (overlap.js:64
  `sections`) "Same kind of puzzle: practice here will likely raise your score on these parts"
  (settings.js:359).
- About's list of shared formats (about.js:37) omits them, and so do the "Also in tests" notes
  (overlap.js:44-50).
- The helper's own `unsure` kind (overlap.js:73) lists the same three only as related.
- R4 rates Slice "mid" and Rotate and Spin "mid / far" (§6.2, lines 485-486). Its helper example
  (§6.4, lines 559-560) shows "Rotate, Spin: a small or unknown effect".
- Confirmed: c3 output and reading.
- Fix: pick one position and log it in DECISIONS.md. Either:
  - demote these exercises to `related` in their kinds, as R4 has it; or
  - keep them as `same`, because Rotate's "pick 2 of 4" is the MRT format, and then add rotation and
    cross-sections to About's list and give Rotate, Spin and Slice an "Also in tests" note.

**S4. The paused-exercises text leaves out the Daily Challenge, which still has them.**
- Where: settings.js:296, "Free play, Path, Section practice and the Library still have them.
  Today's plan leaves them out too." The toast at settings.js:378 has the same gap.
- `daily.pool()` filters only `pat` (js/engine/daily.js:41), so a paused Fold, Hidden or Views still
  comes up in the Daily. That is right, because the Daily must be the same for everyone, but the text
  should say so.
- Confirmed: c3, "Daily pool includes a paused exercise (fold): true".
- Fix: "Free play, Path, the Daily Challenge, Section practice and the Library still have them."

**S5. The Section screens use "DAT" before spelling out "Dental Admission Test".**
- R3 §6 (line 440): spell out "Dental Admission Test" at first mention, because "DAT" is also
  Pearson's Differential Aptitude Tests.
- The setup lead (section.js:107) reads "The DAT-style formats in the order of the Perceptual Ability
  Test, …". The review (section.js:617) reads "… a DAT score …". On both screens the full name appears
  only inside the ADA line at the bottom (157, 667).
- Confirmed: reading.
- Fix, for the lead: "Formats in the style of the Perceptual Ability Test of the Dental Admission
  Test (DAT®), in the test's order, against one clock, …".

**S6. A second section on the same screen gets no time warnings.**
- `X.warned` is created once in `render()` (section.js:80). `begin()` (206-213) does not reset it,
  and "Another section" (664) reuses the same X.
- Confirmed: c4, flow B. The first run showed "Five minutes left" once and "One minute left" once;
  the second run showed neither.
- The two toasts are also the non-colour cue for the low-time state: `.is-low` changes only colour,
  css/section.css:70.
- Fix: in `begin()`, set `X.warned = {}` and `X.result = null` (the stale result also makes
  `state().usedMs` report the old run, section.js:731).

**S7. One key press can close a part for good.**
- The part-end card (section.js:504-509) makes "Next part" or "Finish the section" its primary
  action.
- `showCard` focuses the primary and binds Enter and Space to it (js/ui/play.js:1231, 1235).
- The card appears on its own 220 ms after the last answer. A keyboard player used to "Space = next"
  from Train can therefore skip the card's list of unanswered and flagged items, and the part cannot
  be reopened (section.js:146, 503).
- Confirmed: reading.
- Fix: when items are open or flagged, make "Go to item N" the focused default. Alternatively, do not
  bind Space and ask for a second press.

**S8. In the item strip, "answered" is shown by colour alone (rule 8).**
- `.sec-chip.is-answered` (css/section.css:94) changes only the fill and the border colour. In dark
  mode the fill is #1B3B45 against #23282D. Seen-but-unanswered chips get a dashed border, the current
  chip a ring and a flagged chip ⚑, but answered and new chips show the same shape and text
  (section.js:304-306).
- The aria-label carries the state, so screen readers are covered.
- Confirmed: reading.
- Fix: add a mark to answered chips, such as a small ✓ or a filled dot, as the review chips already
  do with ✓/✗/– (section.js:589).

### Nice to have

- **N1. "DAT score(s)" appears in negations.**
  - Where: section.js:148 ("does not predict a DAT score"), 617; overlap.js:51 ("its effect on DAT
    scores"); library.js:423. The same phrase is in the six learn.js bridges (B5/B6).
  - R3 §6 puts "DAT score" on its avoid list, but R3 §10.1 recommends exactly this content ("not
    measured").
  - If the literal rule is meant, rephrase, e.g. "Parallax does not predict a score on that test" or
    "has not measured its effect on that test's scores".
- **N2. No ADA line when no part can run.** `draw()` returns at section.js:114-118, before `ada()`
  (157), while the head (107) still names the DAT. Append `ada()` there too.
- **N3. How to play shows the ADA line twice for DAT-style exercises.**
  - js/ui/play.js `howTo` (B2's function, about lines 2251-2265) calls `noteNode(exId, …)` with the
    default `legal`, then appends `learn.bridge`, which already ends with the ADA line.
  - Pass `{ legal: !/American Dental Association/.test(learn.bridge) }`, as library.js:477-478 does.
- **N4. The Lab text names the DAT without the line.** js/ui/lab.js:256 (B1) says "DAT-style focus"
  with neither the ADA line nor the spelled-out name. A short "(Dental Admission Test-style formats)"
  would do.
- **N5. "Items to look at again" fills with items the player never saw.**
  - The 'again' list includes status `new`: unreached parts and unseen replacements. c2 shows 75 of
    82 entries never shown after ending in part 2, and 16 unseen replacements listed as "not reached".
  - Show "not reached" as a separate group, or leave `new` out of 'again'
    (js/engine/section.js:348).
- **N6. A part left during its instructions counts as reached.**
  - `reached` is `p <= run.part` (js/engine/section.js:313), and `session.exs` uses the same test
    (330). A part ended during its instructions (leave, then "End it and see the review") counts as
    reached, and its exercise is listed in the session (c2: `exs` included `patviews`).
  - Use "any item seen" instead.
- **N7. Resuming a run with no time left throws.**
  - Confirmed: c4, flow C. `begin()` → `tick()` → `timeUp()` → review; then `begin()` goes on to
    `partIntro()`/`resumeAt()`, which set the state to 'intro' on the review screen and throw
    `TypeError: Cannot read properties of null (reading 'pause')` (section.js:236-239, 358).
  - It can be reached through a run saved in the ≤ 1 s between the end of the budget and the next
    tick, or through an imported backup; `fixLive` keeps such runs (c2).
  - Fix: return from `begin()` when `X.done` after `tick(X)`, or end the run in `resumeCard` when no
    time is left.
- **N8. `fixLive` accepts a few damaged runs.** (js/engine/section.js:382-402; c2)
  - A part with zero items: `partIntro`'s start then reads `items[0].status` and throws (374).
  - `budgetMs` −5 becomes 1 ms.
  - `correct: "yes"` is kept and counts as right.
  - Fix: recompute the budget from the parts × `PACE_MS`, drop runs with an empty part, and coerce
    `correct` to a boolean.
- **N9. "Time used" can exceed the budget.** The resume card's "End it" passes `live.usedMs`
  uncapped (section.js:181), while `finish()` caps it at the budget (540). c2: "Time used 20:50 of
  20:00". Cap it in both places.
- **N10. Ending a section from the pause sheet records 0 ms for the open item.** `onTrial` sets
  `X.visitAt = 0` (440) and then calls `visitMs(X)` (442), which returns 0. No visible effect today,
  because item `timeMs` is not displayed. Use the `ms` computed at 439.
- **N11. The input column is not taken from the answering event.**
  - section.js:449 passes `input: tr.source`, while H4 records the input of the answering event in
    `tr.input` (play.js `inputName`).
  - As a result, a pen answer is logged as mouse, and a click made with Enter as mouse.
  - Use `tr.input || tr.source`, and `tr.display` for the display column if the screen class can
    change mid-run.
- **N12. A reload gives back the time spent on the current item.**
  - The section clock is saved only between items (`persist`), so after a reload the time since the
    last save is not counted.
  - The resume card's "no time was lost" (section.js:189) holds, but a reload is a way to win time.
  - Optional: on `visibilitychange`→hidden, update `run.usedMs` in memory, with no write during a
    stimulus.
- **N13. The clock does a little work during stimuli.**
  - `tick()` (249-262) rewrites the timer every second and can raise the 5- and 1-minute toasts
    during `body.px-stim`. Train skips its HUD work there (play.js:1441).
  - The formats are static, so the cost is tiny. Still, defer toasts while `px-stim` is set.
- **N14. A reload during the review loses it.** Only the summary survives, in `rec.section.runs`.
  Optional: keep the last finished run (items and answers) so the review can be reopened.
- **N15. "Full section" can be earned without answering anything.**
  - js/engine/achievements.js:126 (B1) counts full runs that ended 'done' or 'time'.
  - "End this part" → "Next part", six times, ends a run as 'done' with no answers.
  - Require answers, for example in every part, before the achievement counts (rule 11: good
    practice).
- **N16. Undocumented departures from R3 §9.**
  - Navigation is locked per part, while R3 §9 says "free navigation … within the section"; the text
    is honest about it (section.js:146).
  - Forms are open-ended numbers, where R3 §9 proposed A–C.
  - Log both in DECISIONS.md.
- **N17. The Painted Cubes card does not say that up to three questions share one figure.** Players
  may take a repeated figure for a bug. Add a line, as is done for Angles (section.js:364).
- **N18. One hint does not adapt to missing parts.** The full-size hint "Fifteen items a part, the
  length of the real test's perceptual section" (section.js:122) is shown even when parts are
  missing. Make it conditional on `sh.parts.length === 6`.
- **N19. The helper offers a DAT taker the opposite of what they want.**
  - Ticking the DAT in the helper offers to "Leave them out of Train until the test", which works
    against the DAT-style focus.
  - Explain in one line that the pause keeps a result free of practice, while the focus is for
    preparing. Or offer only "Note the test" for `dat`.
- **N20. Two items go to the JSON backup, not to the research export.**
  - Noted tests and the Check's overlap answer reach the JSON backup but not the Lab research CSV,
    while PLAN M6 says "log the test for the Lab export".
  - The texts are honest about this (settings.js:407; lab.js:256).
  - Decide whether the CSV should carry them.
- **N21. Persistent pins skip the test pause (latent).**
  - `rec.train.pins` bypass the pause (js/engine/schedule.js:214-216). c3: Fold pinned and paused
    was still Train's focus. That would make "Left out of Train" false for a pinned exercise.
  - Nothing in v1.1 writes `rec.train.pins`, so this matters only if Library pins return. In that
    case apply `testPaused` to stored pins, and keep `opts.pin` explicit.
- **N22. Details of the Check question.**
  - It is also asked at Baseline 2 and 3: check.js:354 asks whenever `rec.assess` is non-empty,
    while R4 §6.3 c says "non-baseline check". Both readings work.
  - The card has no primary action, so keyboard focus is not placed on the answers. Focus "No".
- **N23. Item numbers shift after a void.** `numberOf` skips voids (section.js:320-324), so a
  flagged "item 4" becomes "item 3". Voids are rare; stable numbers would be clearer.
- **N24. Forms may not stay comparable across app versions.** A form is chosen from the model's `b`
  band. A refit of step values without a version bump would change form k, and run summaries do not
  store the app version. Store `PX.version` in the summary.
- **N25. The About citation does not back the sentence it follows.**
  - about.js:47 cites Scharfen 2018 and Schneider 2020 after "These gains stay mostly with that kind
    of puzzle".
  - That claim's support in R4 is te Nijenhuis et al. 2007 and Sommer & Arendasy 2025 (R4 §4.1,
    lines 273-278 and 302-306). Schneider & Sparfeldt 2021 [SR] found transfer to other fluid tests
    (R4 line 329).
  - The wording is R4's own draft (§6.3 a). Consider citing te Nijenhuis 2007 there and adding it to
    REFS.

### Unconfirmed
- **U1. A phone held sideways.** No browser was run; tests/e2e/section.py covers 390×844 portrait
  and 1280×860 only.
  - From the CSS (css/section.css:128-141 with css/play.css:273-279 and 385-399): at max-height
    500 px the item gets `100dvh − 2×44 − 4 − 48 px − insets`, about 220 px on a 360 px tall phone.
  - The item uses B2's two-column landscape grid; the strip stays closed on small screens (a turn
    keeps the screen class); the four controls take one row.
  - A turn during `px-stim` voids the item ('turned' → outcome 'stutter'), which is then replaced.
  - Whether the six formats are legible at that height is untested.
- **U2. Today's plan may lag a focus change.**
  - Today's plan cache key (js/ui/play.js `homePlan`, about line 2289) does not include
    `settings.patFocus` or `testPause`. It changes only with `rev`, which the debounced save bumps
    after 1 s.
  - A plan computed within that second after the focus is switched could therefore show the old
    exercises until the next change. Not reproduced.

## Claims checked against code and notes

| Where | Claim (short) | Checked against | Verdict |
|---|---|---|---|
| section.js:107 | formats "in the order of the Perceptual Ability Test" | engine/section.js:44 PARTS = R3 §2.1 line 73 (Apertures, View Recognition, Angle Discrimination, Paper Folding, Cube Counting, Spatial Relations) | true (wording S5) |
| section.js:121 | Mini 30 items in 20 minutes, Full 90 in 60 | engine/section.js:45-46, 75-84; c1 | true |
| section.js:122 | five / fifteen items a part; full = "the length of the real test's perceptual section" | SIZES; R3 §2.1 lines 72, 74 (90 items) | true with all six parts (N18) |
| section.js:131 | "A form has the same items for everyone" | c1: identical in two fresh contexts, for two learners with different ratings, on small and large displays; order identical | true (same build; N24) |
| section.js:131 | "An earlier form repeats items you have seen" | seeds hash (size, form, part, j) | true |
| section.js:143 | missing parts: "N of the 6 parts: K items in M, the same pace" | c1: 75 items in 50 min, 60 in 40, 15 in 10 (40 s each) | true |
| section.js:145 | "about 40 seconds an item, the real test's average pace" | PACE_MS 40000; R3 §2.1 line 76 | true |
| section.js:146 | skip, flag, go back within the part; no return after it | engine `go()` 200-205; `endPart` | true (N16) |
| section.js:147 | pause and instructions stop the clock; review reports pauses | section.js:244, 358, 382; 605 | true |
| section.js:148, 598 | "Your levels do not change" | c2: rec.ex, timed, path, train, settings identical after a full run; est.get reads only (estimator.js:254) | true |
| section.js:148, library.js:419 | "a show-me for every item" | all six views export showMe (e.g. openings/view.js:368); section.js:704-707 | true (unanswered items need an answer first, as 631 says) |
| section.js:189 | "Its clock stopped when you left, so no time was lost" | `persist` in `leaveScreen` 564-570 | true (N12) |
| section.js:362 | "The clock is stopped while you read this" | `C.pause('intro')` 358; clock.js accepts any reason | true |
| section.js:364 | rulers and measuring tools not allowed in the real test | R3 §2.1 line 77 | true |
| section.js:459 | an interrupted item does not count and a new one joins the end of the part | engine 230-240; c2 | true (S1: no cap) |
| section.js:503 | "The clock is running" on the part-end card | `showCard` emits no `modal:open` (play.js:1201-1238); `partEnd` does not pause | true |
| section.js:522 | "The clock is stopped while you decide" | `ui.confirm` → `modal:open` (ui.js:270) → 228 | true |
| section.js:616 | per item = the part's time over the items looked at; test ≈ 40 s | 607 formula; R3 line 76 | true |
| section.js:631 | each item opens with your answer and the right one marked, and its show-me | 693-707; all six are `stem+options` choice | true |
| library.js:401-402, settings.js:250-252 | focus on: Train and Today's plan; off: Library, Free play, Section | c3: 25 days of Train plans, no DAT-style with focus off, all six with it on; Today's plan = `modes.start('train')` (play.js `homePlan`) | true (U2) |
| library.js:419 | 30 items in 20 minutes / 90 in 60 | `sectionText` 387-394 from `shape()` | true |
| library.js:422-423, overlap.js:51 | practice raises scores on that format; not measured for the DAT; PAT relates modestly to grades | R4 §4.1-4.2; R3 §1 lines 42-45 (corrected r .16-.36) | true (wording N1) |
| library.js:430 | six question formats of the PAT of the DAT® | R3 §6 safe wording lines 432-433 | true |
| about.js:45 | shared formats: paper folding, hidden shapes, counting cubes, cube nets, block tapping | R4 §6.3 a lines 495-496 | true (S3 inconsistency) |
| about.js:46 | DAT-style formats follow the PAT of the Dental Admission Test | registry `pat` flags; R3 §2.2 | true |
| about.js:47 | retest ≈ a third of an SD; rule teaching ≈ one SD | R4 §4.1 line 260 (0.33); §4.2 lines 316-322 (d ≥ 1.19; .92) | true (citation N25) |
| about.js:48, overlap.js:68-69 | analogy tests not trained; Word Links a few minutes per check, no feedback | R4 §2 lines 151-155; assess.js:3 (16 items) | true |
| about.js:49, settings.js:281 | leave them out of Train until the day of the test | c3: paused through the local test day, back the next day, in 4 time zones | true (N21 pins) |
| settings.js:295-296 | Free play, Path, Section and Library keep them; Today's plan leaves them out | c3: Free play and chosen Path open; automatic Path skips them; Daily keeps them | incomplete (S4) |
| settings.js:359 | Same kind: "practice here will likely raise your score on these parts" | R4 §4.5 (1) | true for near formats (S2, S3) |
| settings.js:360 | Related: "a small or unknown effect" | R4 §6.4 | false for Fold + DAT (S2) |
| overlap.js:45-49 | Fold, Hidden, Views, Nets, Span notes | R4 §6.3 b lines 508-521; Span note as R4 line 436 | true |
| overlap.js:70-71 | figure matrices: no exercise teaches their rules | R4 §3.3 lines 219-226 | true |
| settings.js:407 | noted tests kept in record and backups for pooling | `hygiene` field (overlap.js:163); lab.js:256 | true (N20) |
| check.js:370-371 | the outside-practice question, never scored | R4 §6.3 c lines 532-534; PLAN M6; assess.js:262-271 stores it; nothing in assess reads it | true (N22) |

## Wording rules (R3 §6)
- **ADA line beside every DAT mention.** Present on the Section setup (157) and review (667), the
  Library group (library.js:424) and exercise pages (bridge or note, 477-479), How to play (twice,
  N3), Settings (259; and 363 when the DAT is ticked) and About (51).
  - Missing in the no-part branch (N2) and in the Lab (N4).
- **"official", "simulator", "predicted score".** None in user-facing text.
- **"DAT score(s)".** Only in negations (N1).
- **"Dental Admission Test" spelled out at first mention.**
  - OK in overlap notes, the Library lead, About and the Settings hint.
  - On the Library and Settings, a heading reading "DAT-style formats" comes first; R3 lists that
    phrase as safe.
  - Not OK on the Section screens (S5).
- **Exercise codes.** EX-14…EX-19 in the registry, and no user-facing "PAT-1"…"PAT-6". Remaining
  strings: an HTML comment at index.html:112 and test fixtures (section.test.mjs:21,
  overlap.test.mjs:17), none of them shown.
- **The focus is called "DAT-style focus" everywhere a user sees it:** library.js:401, settings.js:250,
  lab.js:256. Code comments keep "PAT focus".

## Checked and fine
- **Budget with missing parts.** Items × 40 s; the missing parts are named with their reason; with
  zero parts, `start()` refuses and the setup says so (c1).
- **Alternate forms.**
  - Deterministic across contexts, and independent of ratings, display and record.
  - Consecutive forms share no seed, and no item content repeats across forms 1–6 of either size.
  - All 720 items of forms 1–6 generate and validate, none a fallback.
  - Every item sits in the 35–65 % band (c1).
  - Painted Cubes questions stay with their figure. A replacement's `ask` wraps around safely
    (cubes/gen.js:269, 294).
- **No rating change.** None from a run, the review player or the record (c2). Achievements are read
  only from the run summaries.
- **Logging.**
  - Every row has mode 'section' (one index in `idx.mode`), outcome codes 1/0/2/3, and rows are in
    time order.
  - Never-shown items get no row; the display and input columns are filled (c2).
  - A session is pushed only with ≥ 1 answer; `practiceMs` is added once; finishing twice changes
    nothing.
- **Review list.**
  - `review()` matches the stored items exactly: status, correct, response, flag (c2: 0 mismatches).
  - 'again' = all − (right and unflagged).
- **Resume after reload.**
  - The clock restarts from the saved `usedMs`, the budget is kept, and the part and item are
    restored.
  - A part ended in its instructions shows the instructions again.
  - `fixLive` clamps a part index past the end (c2) and drops finished or damaged runs (tests).
- **Clock stops** for the pause sheet (244), any modal (228-229), a part's instructions (358, 382), a
  hidden tab (clock.js `onVisibility`; the player also pauses in respond) and 5 idle minutes. Time-up
  cannot fire while paused or during instructions.
- **No storage writes during a trial.** The player holds the store from 'ready' to the answer
  (play.js `holdStore`/`releaseStore`). `persist` runs between items, on flag (under the hold) and on
  leaving.
- **Keys.**
  - ← and → step through items, `f` flags, 1–9 answer and Esc pauses.
  - The pause layer is not pass-through, so no section key acts while paused.
  - The DAT-style views take no keys of their own.
  - Chips and controls are buttons, in DOM order after the item.
- **Touch targets** (`--tap`, at least 44 px): every `.px-btn`, `.sec-chip` and `.px-tick`.
- **Review chips** carry ✓/✗/– and an aria-label.
- **Date boundary.** The pause is inclusive through the local test day, ends at local midnight, and
  refuses yesterday. Day keys parse as local midnight (util.js:93-97). Checked in 4 time zones (c3).
- **Removing the pause** is clean: "End the pause now" sets `testPause` to null and emits `settings`.
  An ended pause is cleared when Settings opens, and the schedule ignores it anyway.
- **H5 filters.**
  - Train, Today's plan, the beginner order and automatic Path skip DAT-style exercises unless the
    focus is on, and skip paused ids.
  - Free play, a chosen Path, "Train with X as focus" (`opts.pin`) and Section are never filtered.
  - The Daily never includes DAT-style formats (c3; B1's engine-v11 tests).
- **Check question.** Stored as `overlapAnswer` on the check record (assess.js copies `extra`). Skip
  stores nothing.
- **Load order.** index.html has every reviewed file active; overlap.js registers its settings before
  app.js boots.
- **Builder's tests.** `node tests/node/run.mjs section overlap` passes all 373 checks.
