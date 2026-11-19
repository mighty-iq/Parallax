# RV-code-1.2: independent code review of Parallax v1.2 (snapshot a434e64)

2026-11-19 15:23 UTC. Reviewer: an agent that did not build v1.2. Snapshot: commit a434e64 (1.2.0-test.4), read only;
diff b5ead08..a434e64 over js/, sw.js, index.html and tools/. Focus: the record and its upgrades, two tabs, backups,
the session flow and rule 7, measurement, the hook systems, sw.js, export privacy (rule 13) and portability (rule 6).
Every finding below was reproduced, either by a script outside the repository (named with its result) or by tracing
the exact lines. Severity: high = loses data or counts void trials for most players; medium = loses or corrupts data,
or shows wrong numbers, in a path real players reach; low = narrow, cosmetic, or a latent risk.

Counts: 0 high, 2 medium, 6 low.

## Findings

### M1 (medium). The Atlas counts every answer twice after a two-tab merge

- Where: js/engine/game.js:498 (`delete out.seeded` in the game container's merge), js/engine/game.js:233-242
  (`seedAtlas` tallies every trial row onto the existing cells; it never resets them), js/engine/game.js:553 (the
  start hook re-seeds when `seeded !== 1`), js/engine/game.js:351-355 (the same re-seed in the finish hook).
- Scenario: two tabs are open; one saves while the other has unsaved changes (after any answer the record is dirty
  for about a second, and held through the next item), so js/core/store.js `conflict()` calls `PX.engine.merge`,
  which calls the game merge. It keeps each cell's larger counts and deletes `seeded` ("the rows are read again").
  The next session's start hook then runs `seedAtlas`, which adds every stored row to the merged counts.
- Evidence (/tmp/rv_code/t/atlas_merge.mjs, atlas_merge2.mjs, on the snapshot's engine and the learner fixture):
  Fold's Atlas after 3 sessions: 193 answers, 149 right; merged with an identical copy and a new session started
  (no answer given): 386 answers, 298 right. On short records, cells became "handled" with no new answer (Rotate
  0 → 2 handled cells, Fold 2 → 7; firsts 2 → 9). A merge in the middle of a session takes the finish-hook path
  instead, where firsts reached on doubled counts are announced on the summary as this session's.
- Shows wrong: the Atlas screen's counts and handled cells, firsts and their `first` events, "within reach", the
  Atlas share card, and the pooled export's `gameSummary.atlas`.
- Fix: make the re-seed idempotent: tally the rows into a fresh atlas and merge it cell by cell into the stored one
  (larger counts, handled on either side), so rows folded by the trial cap keep their counts; or keep `seeded` in
  the merge, since the per-cell maximum is already the union's lower bound. Add a test: merge a played record with
  itself, start a session, and expect the Atlas unchanged.

### M2 (medium; also in 1.1). A session or Daily attempt is stored only by its end or by `pagehide`

- Where: js/ui/play.js:2641-2651 (the only path that finishes a running session when the page goes away),
  js/engine/daily.js:316-321 (`answer` writes nothing to `rec.daily`) and 330-344 (`finish` writes the entry),
  js/engine/modes.js:470-541 (`finish` pushes the session and runs every finish hook).
- Scenario: on a phone the player leaves mid-session (a call, a switch to Discord) and the OS later discards the
  backgrounded tab. Android Chrome's discard and iOS Safari's background kill fire no `pagehide`; the store's
  `visibilitychange` flush saves the trial rows and ratings, but `modes.finish` never runs. On return the page
  reloads to Today (no kept summary).
- Lost: the session record (weekly goal, the Log's session list, practice days, the practice total), personal
  bests and stage-ups from its blocks, review dates, the game layer's tallies of that session's answers (the Atlas
  reads the plan log at finish, so they are never counted), Reach and grades, the bets' period counting, and
  achievements. The Daily is worse: with no `rec.daily[day]` entry, `status()` offers a fresh scored attempt over
  the same eight seeds, so the player re-answers items already seen (the "one scored attempt a day" and O14's
  part-way resume both rely on an entry that only `finish` writes). The Climb is not affected: it writes each
  answer through (js/engine/climb.js:131-140).
- Fix: write the Daily's part-way entry in `daily.answer`, as the Climb does (`partial: true`, outcomes, seeds,
  points so far). For sessions, keep a small live marker in `rec.ui` (plan id, mode, start, exercises), written
  between items with the save that follows each answer, and at boot finish an orphaned plan from its rows as
  `ended: 'closed'`; or finish on `visibilitychange` → hidden and let the next visible item continue the same
  session id as a Keep-going part (`continueOf` already joins parts).

### L1 (low). Daily epoch 1 in 1.2 deals other items than 1.1 for the same date

- Where: js/engine/daily.js:96-100 and 125-137.
- Cause: Fold and Slice gained variants `['choose', 'mark']` (the produce layer). `nearestV1` now draws a variant
  for them (`rng.int(0, 0)` still consumes a draw), which 1.1 never did, so every later item of the date gets a
  different variant draw; and Views' range moved with its starter band (version 2), so the middle of its range picks
  other settings.
- Evidence (/tmp/rv_code/daily_cmp.mjs, 1.1 at b5ead08 against the snapshot, epoch 2 off as shipped): 119 of 480
  items differ over 1 Nov to 30 Dec 2026 (54 of 60 dates), after ignoring Fold's and Slice's added
  `variant: 'choose'`. The epoch comment promises that a live 1.1 and 1.2 deal one challenge per number. After
  release this leaves the archive: a past Daily #N played in 1.2 is not the set the community played on day N, and
  a 1.1 part-way attempt resumed there by seed is matched to items with other settings.
- The same cause will move epoch 2: items are computed from live definitions (ranges, variants, trainVariants), so
  any later range or variant change re-deals every past and current ramp Daily.
- Fix: freeze each epoch's derivation in its config: per exercise the range ends and the variant list the epoch
  began with (epoch 1 from `E.rebase.V11` and 1.1's variant lists, no draw where 1.1 had no variants), and use
  those instead of `M.range(def)` and `variantsOf(def)`.

### L2 (low). The pooled export carries screen sizes with device details off

- Where: js/core/store.js:917 (sessions kept as they are), 921 (check entries: only `date` is touched),
  js/ui/measure.js:113 and 325-326 (each check stores `viewport`), js/engine/modes.js:500 (each session stores it).
- Evidence (/tmp/rv_code/t/pooled_viewport.mjs): `store.pooled({ device: false })` has no `device` block but every
  session and check still says `viewport: "384x832"`, with `display` and `input`. The Lab's tick reads "Add device
  details: browser, language, time zone and screen size" (js/ui/lab.js:278), so the player is told that screen
  size stays out unless ticked.
- Fix: drop `viewport` from sessions and check entries in the pooled rules unless device details are on (the
  display class 0-2 in each trial row already carries what the analysis needs), or change the tick's words.

### L3 (low). A two-tab merge drops the kept Section review (`rec.section.last`)

- Where: js/engine/merge.js:81 rebuilds `section` as `{ runs, next, live }`; v1.2's `last` (O10: the finished
  run kept so that a reload during its review reopens it) is not carried, and the section repair then sets it to
  null. Seen in the self-merge diff (/tmp/rv_code/t/merge_self.mjs).
- Fix: carry `last` from the side with the later `end` (or the one with `open: true`).

### L4 (low). The events table counts folded rows twice when two full tables merge

- Where: js/engine/events.js:227-242: the union of both tabs' rows plus the larger fold counts, then `cap()` folds
  the oldest rows again, although one side had already folded them.
- Evidence (/tmp/rv_code/t/events_cap.mjs): two tabs sharing 5,000 rows, one adds 10: 5,010 events become 5,020
  (rows plus folded counts). Only `events.count` and the export's folded counts are affected, and only past 5,000
  rows.
- Fix: before the union, drop from each side the rows older than the other side's oldest kept row when that side
  folded them (or fold by time: keep the newest 5,000 of the union and add only the fold counts of rows neither side
  still holds).

### L5 (low, latent). Two builds of one record format convert each other's levels back and forth

- Where: js/engine/rebase.js:116-131: any stamp that differs from this build's range is converted to this build's
  range, including a newer build's stamp.
- Scenario: a later 1.2.x adds a starter band (an exercise version bump, no record-format bump). sw.js keeps an
  open page on the files it loaded (no `clients.claim`), so an old tab and a new tab can run together; each adopts
  the other's writes through the store guard and converts the stored levels (bests, Path stages, summaries, Reach,
  plateau events) to its own range. Round trips are lossy by rounding (/tmp/rv_code/t/rebase_pingpong.mjs: 15 of
  100 levels move by 1 after five round trips), and Path's current stage restarts its moving average whenever the
  stage number changes.
- Fix: stamp each range with its exercise version (`[min, max, version]`) and never convert from a higher version
  than the definition's: run from memory (as for a newer record format) or leave those levels alone.

### L6 (low, risk). The service worker cannot tell a copy gathered across two deploys

- Where: sw.js:89-125 (`gather`), 196-206 (`check`).
- Scenario: the update check fetches about 170 files in one pass with `cache: 'no-cache'`. If the CDN in front of
  Pages answers some files from the old deploy and some from the new one while a deploy propagates, the pass
  writes a complete-looking copy of mixed versions and marks it, and the next launch runs on it (the launch after
  that heals it). The header comment says "nothing half-updated is ever served"; the code has no check that the
  files belong together.
- Fix: accept a copy only when the version in js/core/px.js equals a version marker in index.html (for example a
  `<meta name="px-version">` that the release bumps with px.js), and otherwise keep the current copy and check
  again at the next launch.

## Checked and found clean

- Record format 4 and upgrades. store.js `guard` repairs field by field, keeps unknown fields for late
  registration, caps trials, and runs the upgrade hooks on load, import, another tab's record and merges;
  record.js stamps `measure.form0` and probe versions only for formats below 4; rebase.js uses V11 for formats
  below 3 and stamps every exercise; daily.js gives older results their seeds only when their outcomes cover all
  eight items (idempotent). A newer-format record sends an older tab to memory, and import refuses newer files. A
  fuzz of single-value corruptions in the game, bets, measure, plateau and events containers (/tmp/rv_code/t/
  fuzz_repair.mjs) never made a repair throw or reset a whole container.
- Two tabs. Trial rows re-indexed into merged name lists and deduplicated by whole row; sessions by id with the
  longer Keep-going record; the practice total from merged sessions without checks; the plateau, bets, measure,
  events and game merges registered. A merge of a played record with itself changes only `streak.goals` (benign),
  `section.last` (L3) and `game.seeded` (M1).
- Backups. `exportJSON` leaves out only private fields (the playtest log) unless device details are on; import
  validates, keeps an undo slot and wins over every tab's revision.
- Session flow and rule 7. The store is held from ready to the answer; the answer clock runs from the painted frame
  minus pauses; a pause or modal during `present` voids the item; a turn or a change of screen class during a
  stimulus or a timed item voids it; the frame monitor's verdict covers presents over 400 ms; fallback, stuttered
  and skipped items never reach a rating (modes.answer rates outcomes 0 and 1 only). The Quick deadline runs from
  the paint and its staircase moves only on rated Train and Path answers; figure-set questions are logged, never
  rated or paced; fluency items rate the timed rating only and never come to a paced exercise. Kind and pick hooks
  change only target and easy items, so the closing item keeps its kind. B1, B2 and blocks pause the session clock
  with 'measure'. Sounds, playtest sampling and game effects stop under `body.px-stim`.
- Keep going. `continuable` limits it to a same-mode session of the local day that does not count yet; `finish`
  joins answers, practice time and rounds, adds only the new part to the practice total, and the summary's Again
  and Keep going never repeat the tutorial's baseline choice.
- Hooks. Engine hooks that throw are skipped and listed in `plan.errors`; UI hooks that throw or reject are skipped
  and reported as `play:error`; the player wraps every hook call; item:before cannot re-seed rechecks, probes,
  Daily, Threshold or set items.
- Measurement. `checks()` returns full checks only and `occasions()` every entry; incomplete occasions are never
  stored (their rows stay in the Log); voided probe items are dealt again with new seeds; time-outs score wrong;
  stored posteriors use the standard prior; form0 is drawn at B1; each milestone's verdict is stored once; the
  meter stays empty before two full checks and training; the measure container and its export carry no local day.
- sw.js and its registration. Registered only from the hosted multi-file index over https (or localhost): never
  from file:, a frame, a srcdoc preview, the single-file build or a non-index page. It answers only same-origin
  files inside its scope, leaves dist/, docs/ and tests/ navigations to the network, uses a copy only once its
  mark is written, and deletes a copy that failed. The install prompt is held and offered once from Settings.
- Privacy (rule 13). User agent, language and time zone are read only in `deviceFacts` (behind the setting or the
  tick) and in the playtest report; the playtest field is private and never pooled; the pooled export drops
  settings, `ui`, the Daily, the streak, rating histories, folded days' dates, Speed's day column and the game
  container (its summary header has Climb numbers, no weeks); share texts name only the typed nickname.
- Portability (rule 6). js/ has no ES modules, `fetch`, workers, `importScripts`, `eval`, direct storage access,
  history API calls or relative `href`s; sw.js is the only worker.
- Tests run on the snapshot: `node tests/node/run.mjs core record4 pooled events hooks daily rebase engine-w2 wave3
  sw playtest chimera core-clock`: 1,371 checks, 0 failures. Scripts used for the findings: /tmp/rv_code/
  daily_cmp.mjs and /tmp/rv_code/t/*.mjs (outside the repository).
