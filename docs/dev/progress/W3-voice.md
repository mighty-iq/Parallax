# W3-voice: progress log (PLAN milestone 10, voice; the guide brought to 1.2)

Started 2026-11-19 12:15 UTC. Task from the lead: About, the README, the Library notes and guide chapters 1, 5
and 8 in the "test the bets with us" voice (CLAUDE.md rules 1-3, 10-13; RULES "The bar", "Stance on
transfer"); every other chapter of the guide brought to 1.2's facts; figures and the PDF last; a 1.2.0
CHANGELOG entry (dated by the lead at release); `--shard` in CLAUDE.md's commands. Then a self-check: the
six-word quote scan against BRIEF.md, and a list of claims with the code behind each.

## Files
- Mine: README.md, CHANGELOG.md, js/ui/about.js (texts), docs/guide/guide.html, docs/guide/guide.css,
  CLAUDE.md (commands section only), this log.
- js/ui/library.js: texts only (W2-core owns the code); each edit is listed in docs/dev/v1.2/requests.md.
- tools/shots.py and tools/build-pdf.py: the guide's figures and the PDF's metadata (unowned since wave 1;
  the lead gave me the figures and the PDF); listed in requests.md as FYI.

## Intent (before the multi-file change)
1. README, About, Library notes: what Parallax trains, bets on and measures in 1.2; one accurate limit
   where a claim needs it; no section opening with what training cannot do. Keep the hooks' anchors
   (About's data-section values 'claims', 'hygiene', 'refs'; overlap.py's phrases; bets.py's order).
2. The guide: "What's new in 1.2"; chapters 1, 5, 8 rewritten; the rest to 1.2's facts; Missing View last.
3. Figures (shots.py) and the PDF (build-pdf.py), pages looked at.
4. Self-check: quote scan; claims with code.

## Log
- 2026-11-19 12:20 UTC, step 1: README rewritten (what it trains, bets on, measures; the game; test hygiene in
  one paragraph; `--shard` in the commands; game.py and bets.py in the browser list), About (lead names the bets and
  the check; 'claims' retitled "What practice does, and how Parallax measures it", three bullets instead of five, the
  limit once; Track: one label line, the evidence through the bet; the tool line folded into Test hygiene; Your data:
  the community export without a name or device details unless ticked), the Library notes (requests.md line to
  W2-core), CLAUDE.md's commands (`--shard k/n`). Anchors kept: About's data-section values (claims, hygiene, refs;
  bets.js places "Test the bets with us" after claims), overlap.py's phrases, O.ANALOGY, data-about="testsoon".
- 2026-11-19 12:25 UTC, the coordinator's two items (PLAN milestone 9, O24 and O26): O26, the guide's ADA
  reference links the DAT Validity Study (March 2026): its address is not in the research notes (R3 line 851 gives
  "ada.org/…/education/dat_validity_study.pdf"); found on the ADA's "newsletters and resources" page of the DAT
  section (one search, one fetch, 19 Nov): https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/education/dat_validity_study.pdf
  (the page adds a cache query, rev=…&hash=…, left out). O24: no effect size is converted into IQ points anywhere in
  the guide; checked by a scan at the end (see Self-check).
- 2026-11-19 12:26 UTC, the coordinator's spot check of fa49a67: calibration is "a bet whose transfer no study
  has tested yet" (note T1 lines 21, 175: the bias is corrected within a session, Noel et al. 2020). README fixed;
  js/ui/bets.js (W2-bets stopped; FYI to the lead in requests.md): About's sentence and the exercise page's tag
  ("new, transfer untested"); the guide's marked page. node bets 589/0.
- 2026-11-19 12:26 UTC, guide step 1: cover and contents for 1.2.0 (date "November 2026": the lead adjusts at
  release if it slips), "What's new in 1.2" (two pages replace 1.1's: eight panels, "Also in 1.2", the record),
  chapter 1 rewritten as "What Parallax is" (trains, bets, measures; what the numbers and labels mean; how we word
  claims). The run head reads 1.2.0. Page references to pages still to write (ex-centralpoint, dims, plateaus,
  check) read "?" until those pages exist.
- 2026-11-19 12:34 UTC, guide step 2: chapter 2 (the first session: one tutorial, then Baseline 1 or
  Later, then Train; Baseline 2 and the blocks; a first week; a session with the stretch ring, cards between items
  and the 1.2 summary; phones: Progress tabs, the pinned reading strip, Confirm taps; Settings as the app's
  sections). Chapter 3: the ability codes (LE for Central Point, MA for both far probes), the 2 × 2 now reaches all
  four cells (Central Point's def.cell is extrinsic-static; Pattern Memory and Level stay untrained there), a
  "Bet" line on every card (def.bet and the hosted layers), Views' starter level, Homing's map from the start,
  Reckon version 2 and motion comfort on the navigation page (play.js MOTION 180 000 / 300 000 ms; gentle 2/3 speed,
  0.6 s ramps, 40 s), Central Point's page (new: card, the method, why the average is not the answer, what is known),
  the DAT-style section (range tags; the focus; one limit with the validity study as context) with the six formats as
  full cards, two a page (version 3 of Openings, Angles, Hole Punch, Painted Cubes and Form from the definitions'
  dims and testRange; Missing View drafted from the working copy's version 3, to be checked last).
- 2026-11-19 12:36 UTC, guide step 3: chapter 4. The modes table (Train on every setting and plateaus;
  Daily v2's ramp and points from release day, share line from daily.js; the weekly Climb; Section practice under
  test conditions); the engine page (set questions unrated, stretch1 before 10 answers, starter items at level 1,
  Angles and Central Point in no similar group: model.js groups); a new page "Your edge on every setting" and
  "Plateaus get a change" (ENGINE §19, §20; progress-sim.md §0, §2; plateau-sim numbers); "Which mode, when" in
  the app's MODE_WHEN words; the simulation panel with 1.2's runs (ENGINE §18, §24).
- 2026-11-19 12:39 UTC, guide step 4: chapter 5 rewritten in the voice. The lead treats transfer as an
  open engineering problem; the ladder has practice, near (Other Way Round), mid (Cube Match, View Match, Pattern
  Memory), far (Motion Graphs, Mechanisms; another domain inside the app) and "beyond" (cited, never promised);
  Uttal's caveats are read as design responses (familiarity model and control; delayed check). "How Parallax trains
  for transfer" updated (four cells, logged show-me, named bets and add-ons, exact feedback on estimates, seven
  off-screen challenges). The W2-bets page kept (its tested lines). Three new pages replace 1.1's check pages:
  Design A (occasions, the model, the meter and milestone words, how soon a change can show: measure-sim.md §0,
  1.64/1.27 SD central and 1.26/0.97 optimistic, false "likely gain" 5.9 % ever through week 8), the eight probes
  (gallery: pr6 and pr7 new; pr1, pr3, pr4 to retake), and reading the measure (an illustrative record whose
  numbers are marked invented; the panel; one person and many). No effect size in IQ points (O24).
- 2026-11-19 12:41 UTC, guide step 5: chapter 6, "Motivation and the game" (three pages): the research
  (note G1 §1: Vermeir 2020, Sailer & Homner 2020, Katz 2014, Anderson 2011, Deci 1999, Kluger & DeNisi 1996, Ryan
  2006, Ginns 2018, Kao 2024 [abstract], Rodrigues 2022, Dai 2014, Silverman & Barasch 2023, Milkman 2021); the game
  layer table with the harm each element avoids (ENGINE §24; DECISIONS W3-game 18-19 Nov); what it leaves out; the
  weekly goal (the owner's kept weeks-in-a-row count), 22 achievements (achievements.js), feedback after an answer.
- 2026-11-19 12:49 UTC, guide step 6: chapter 7 gains a 1.2 page (teaching, measurement, bets, Central
  Point, dead reckoning, the game layer; numbers from notes D2 addendum, P1 addendum, M1 addendum A.1-A.2, T1 §3,
  C1 §2.1 and addendum, N1 addendum A1-A2, G1 §1). Chapter 8 rewritten as "Playing fair: test hygiene and precision"
  (opens with the formats tests share; scoped shortcut exceptions from E.dims.scoped and DECISIONS; precision with
  the meter; hand-set steps refitted together; open questions; accessibility with motion comfort). Chapters 9 to 11
  brought to 1.2 (format 4, the trial CSV's 26 columns, the community, events and dose exports; the Lab's bets,
  ladder, learning curves and Balance; contributors: engine files, hooks, shards, the game and bets browser tests).
  References: 25 added from the notes, the validity study linked (O26), the ADA instruction sheet and candidate
  guide cited; three no longer cited dropped (Kivetz 2006, Perkins & Salomon 1988, Sailer et al. 2017); 119 in all,
  over four pages. Morgan & Glennerster 1991 has no link (its DOI in C1 is marked unchecked).
- 2026-11-19 12:50 UTC, CHANGELOG: the 1.2.0 entry ("unreleased": the lead dates it at release). Its
  Missing View line ("moves to profile solids") assumes W1-band-B's phase B lands before release.

## Self-check 1: claims and the code behind each (guide, README, About, Library notes, CHANGELOG)
Numbers are the code's at HEAD (19 Nov) unless a note is named; "sim" = the simulation report named.
- 20 training exercises, 9 probes (8 in the Check, Balance in the Lab): js/ex/*/gen.js `role`; single.py counts.
- Nine bets, labels and lines; calibration new (grade D), its transfer the untested part: js/engine/bets.js INFO,
  GRADES; note T1 lines 21, 175. Bet per exercise: each gen.js `bet` (registry dump, scripts/dims.mjs).
- Add-ons per exercise (comparison: Spin, Nets, Orient, Central Point; bridge: Central Point; produce: Fold,
  Slice, Views; calib: Homing, Reckon, Central Point): def.layers; bets.js addonsLine (bets.test checks the guide).
- Period of at least 4 weeks and 8 sessions: config.bets periodDays 28, periodSessions 8 (bets.test).
- First session: tour.js LIST ['spin']; Baseline 1 46 items, 11.5 min: assess.js config.measure.full
  (16 + 3×5 + 2×5 + 5) × secPerItem 15 s; B2 from b2Hours 12; blocks 14 items (6 + 2×2 + 1×2 + 2), 3.5 min;
  blocksPerWeek 4; gapHours 8; everyDays 28; weekDays 4; the week block 28 items, about 7 min (measure.js hint).
- Probe ladder (near otherway; mid cubematch, viewmatch, patterns; far mechanisms, motiongraphs; level alone;
  wordlinks control): config.measure.rungs. Items aim at k 0.6 (Pattern Memory measureK 0.35); first two of a new
  version at 0.85 (easyFirst 2, easyK 0.85); one free skip per probe (measure.js); "6 to 8 in 10 right" (measure.js).
- Meter and words: assess.js meter() line; trend.js milestones (days 14, 28, every 28); 0.975 / 0.95; "likely no
  change" from day 56 at P(gain < 0.2 SD) ≥ 0.90 (ENGINE §21; measure-sim.md §1); ranges 90 % (measure.js units line).
- How soon (1.64 / 1.27 SD central, 1.26 / 0.97 optimistic; false "likely gain" 5.9 % ever by week 8):
  docs/dev/v1.2/measure-sim.md §0. Familiarity: plateau prior 0.65 SD, tail 0.045 SD / 16 items, state 0.5 SD
  half shared, 55 % kept after > 56 days: trend.js config, ENGINE §21.
- Per-setting offsets from 100 answers, window 400, cap 0.75 logit, lead every fifth target item: dims.js config
  (ENGINE §19); 93.8 % (86.5) and 96.0 % (97.3): progress-sim.md §2.
- Plateaus: window 640, z 1.645, δ 0.15 logit / 100 answers, 8 sessions on 8 days, gap 14 days, trial 3 sessions
  and 120 answers, rest 3.5 days, eight rows: plateau.js config, ENGINE §20; detection 86.9 / 87.9 % within 800,
  false alarms 4.8 / 4.5 % at 0.20: plateau-sim.md.
- Styles k 0.85 / 0.70 / 0.55; mix easy 0.10, stretch 0.10, noStretchBefore 10: model.js config. Similar groups
  (Angles and Central Point in none): model.js groups.
- Simulations of the engine for 1.2 (77.7 vs 77.0 %, coverage 96.8 / 98.7 / 92.8 %, Path S1 about 96 %, S5 about
  53 %, S10 about 5 %): ENGINE §18 and §24.
- Central Point: board 7 × 7, answers on 13 × 13, bands 1 / 0.5 / 0.25 %, credit to 0 at four bands, targets 4–8,
  pace startMs 20 000, minMs 2 500, maxMs 30 000, target 0.85, round score pace 1 → ½: centralpoint/gen.js (BANDS,
  PACE, roundScore); 60 / 33 / 20 % floor: gen.js comment (C1 addendum); cell extrinsic-static, LE Vz: gen.js.
- Game layer: Reach over 14 exercises (0–1,400), grades by tenths, Atlas p 0.1, Daily ramp k points (36),
  Climb 20 rungs, second miss ends, three attempts, sounds while Sound is on, Summit; field notes keep 2 of 3; fresh
  start after 7 days; effects ≤ 700 ms, medium by default: game.js, climb.js, fieldnotes.js, daily.js config,
  ENGINE §24, game.js settings (celebrate medium, climbSound on, rankTitles off). 22 achievements:
  achievements.js (Summit new; Top tenth outside the Daily, DECISIONS 19 Nov).
- Daily pool of 11 (Track, Homing, Reckon and the six DAT-style out): daily.js epochs[1].pool; share line text:
  ENGINE §24 / daily.js.
- DAT-style: letters (optionKeys in the six views), nOptions (Openings 5, Hole Punch 5, Painted Cubes 5, others 4),
  range tags and notes: def.testRange (scripts/range.mjs dump); Painted Cubes sets 2–4, five painted sides on a
  quarter of figures from 10 cubes, tally pad: DECISIONS 19 Nov (W3-bandA); Section mini 30 / 20 min, full 90 / 60:
  section.js SIZES and PACE_MS 40 000; Back, Mark, Strike, Next/Skip: ui/section.js buttons.
- Validity correlations .16–.36: note R3 §4.1 (ADA 2026), unchanged from 1.1.
- Reckon v2 (final turn 30–150°, legs level, 15° / 20 % tolerance, walks back 3–20 m, 40 s with Gentle motion):
  reckon/gen.js dims, DECISIONS 19 Nov (W1-fixes), plan Defaults. Motion comfort 3 / 5 / 5 minutes: play.js MOTION;
  gentle 2/3 speed, 0.6 s ramps: homing/view.js lib.gentle comment.
- Shortcut check level by level on 19 of 20 exercises: tests/node/shortcut-levels.test.mjs (16 exports + hidden,
  span built in) and centralpoint.test.mjs per cell; Views pooled plus its starter level (views.test.mjs).
  Scoped exceptions: E.dims.scoped (ENGINE §19) and DECISIONS (Cube Match, Pattern Memory cap + 25).
- Record format 4, six trial columns, 26 CSV columns: store.VERSION, ENGINE §23. Community export contents and
  ticks: lab.js pooledDialog. Events and dose CSVs: bets.js. Learning curves first 60 answers: config.measure.curves.
  Balance 12 items, no results shown: config.measure.lab.balance, DECISIONS 19 Nov. Self-experiment groups:
  model.js lab; its checks as the app says them (lab.js).
- Modes "right when" lines: library.js MODE_WHEN, quoted word for word; suggestion hidden 14 days: ENGINE §18.
- Settings sections: settings.js, game.js, measure.js, bets.js panels; Confirm taps (O22): settings.js.
- No IQ-point conversion anywhere (O24): scan below.

## Figures and the PDF (2026-11-19 13:09 UTC)
- tools/shots.py run in four passes (every exercise and probe, every app screen; failures fixed: the player's
  hooks, Section's 1.2 end, Reckon's phone item). New: ex20-centralpoint(-feedback), pr6-otherway, pr7-motiongraphs.
  Looked at: ex20 (both), ex14, ex15, ex18, pr6, pr7, app-progress (the meter panel), app-summary, app-today,
  app-homing-phone, app-reckon-phone. Unused by the guide now: app-check, app-lab, app-settings (still made).
- tools/build-pdf.py: 57 sheets, no overflow after trims (pages 5-8, 11-12, 18, 21-22, 26-29, 32-36, 46-50); a
  long citation span (white-space: nowrap) had squeezed Central Point's panels; split. Pages looked at: 3, 20,
  21, 23, 28, 32, 35, 36, 39, 45, 46. PDF metadata: /Author "the Chimera community (https://discord.gg/chmr)",
  /Subject "… Version 1.2.0.", dates in UTC.

## Self-check 2: quote scan (scripts outside the repository, /tmp/w3voice/scripts/quotescan.py)
- Six-word runs shared with BRIEF.md: README 2, CHANGELOG 1.2.0 entry 2, about.js 3, library.js 0, bets.js 0,
  guide 3; every one is the fixed Chimera line ("built by the Chimera community on Discord"), which rule 1
  requires. Two guide phrases that matched the lead's own question texts in BRIEF (one on Central Point's
  deadline, one on the weekly goal's count) were reworded. O24: no "IQ point" anywhere (grep).

## After the session restart (19 Nov ~13:10 UTC)
- 13:12 UTC: 5496958, Missing View's card says that Show me draws the solid beside the views (W1-band-B's 13:05
  request), PDF rebuilt. 13:15 UTC: the contents' chapter 5 line gives the bets page's number (W2-bets' 22:50
  request asked for it in the contents); PDF rebuilt, 57 sheets, no overflow; pages 2, 23 and 34 looked at.
- Rechecked on the working copy: node bets, overlap, chimera 851/0, then bets 589/0 after the contents line;
  tests/e2e/overlap.py 58/0; quote scan again (only the fixed Chimera line, in README, CHANGELOG, about.js and the
  guide); calibration says "its transfer is untested" in README, About (bets.js), the Library's bet tag ("new,
  transfer untested") and the guide; O24 (no IQ figure) and O26 (validity study linked) still hold; pdfinfo:
  /Author the Chimera community only.
- Request lines to the guide's owner marked DONE in requests.md: 15:52 (W1-central), 22:50 (W2-bets), 01:30
  (W2-measure), 10:58 and 12:03 (W3-bandA), 13:05 (W1-band-B).

## Final round before the release candidate (resumed 2026-11-22 14:39 UTC)
- Intent: RV-claims-1.2 M1-M4 and the lows in my files (L1-L3, L4's guide line, L5, L6, L11-L18 where they touch
  README, CHANGELOG, About, the Library notes or the guide); every open requests.md line to the guide or to me; the
  changes since 8d0ea13 (79 commits; DECISIONS lines since then) in the README, CHANGELOG 1.2.0 (still "unreleased"),
  About, the Library notes and the guide; then the figures (Missing View's last) and the PDF; then the self-check.
- Not mine, left to their owners: M5 and L9 (done by W1-band-B, f2528b9), L7 (Views' learn.js), L8 (tour.js), L10
  (section.js), L16's measure.js line, settings.js:243's CSV line (L14).
- Commits: a6e6b42 (README, About, the Library notes), faa7786 (guide text, CHANGELOG, DECISIONS line on L11),
  then the figures and the PDF (below). requests.md: FYI to W2-core on library.js (M4's pattern, the fallback keys
  line, the Section note).
- Done from RV-claims-1.2: M1 (guide p. 11, Spin's Time row, the modes table), M2 (Section page, modes table, README,
  Library note), M3 (colophon "Version 1.2.0, November 2026 (first published for 1.0.0 ...; updated for 1.1.0 ...)":
  the lead sets the day at release), M4 (library.js pattern), L1, L2, L3 (three places), L4 (guide line), L5
  (README, About, guide p. 3), L6, L11 (DECISIONS), L12 (two places), L13 (README), L14 (CHANGELOG, guide's Also in
  1.2, chapters 2, 9, 11, README layout and tests), L15 (Track, Views, Homing), L16 (guide line), L17 (About, and the
  guide's licence table), L18 (library.js text).
- Requests answered: W3-misc 14:25 (README Runs everywhere and layout, CHANGELOG; CLAUDE.md's map and rule 6 are not
  in my brief: left to the lead), W3-exfix 15:17 (Nets) and 13:58 (Spin's figures and captions; Central Point's Move
  and the miss line), W2-core 16:15 and 13:22 (keys after an answer, the export without screen sizes, Near miss, the
  stretch tag's "above your level" already matches "a stretch, set above your level"), W2-measure 14:23 (L4; probe
  versions; no item back across checks), W3-bandA 14:32 (items changed; figures reshot), W3-misc 14:33 (the guide's
  note on updates: a copy kept only when its files belong to one version; conversions only forward).

## Self-check 1, round 2: the claims added and the code behind each
- Train untimed until Speed opens, then easy items carry its deadline: js/engine/dims.js config `fluency: 0.1`
  (fluency items once Speed is open). Central Point's quick form: its own pace staircase (js/engine/pace.js).
- Section forms from test-range settings, 35–65 % within them: js/engine/section.js band() (4b0af60); no item twice
  in a part: lib.fewStems seed skipping (DECISIONS 19 Nov, W1-band-B).
- Motion offer after about 5 min of motion, "End the session" and "Go on": js/ui/play.js MOTION.newLimit 300000.
- Off-screen challenges on seven exercises: `offscreen` in Fold, Nets, Slice, Views, Orient, Knots, Central Point.
- Dose: note A-evidence.md line 118 (Miller & Halpern 12 h; no dose-response in Hawes, n.s.).
- Pattern Memory: "a third to a half of the patterns exact": DECISIONS 22 Nov (W2-measure, L4), js/ui/check.js.
- Meter beyond familiarity: js/engine/trend.js (P(D > 0) for the gain beyond the familiarity model).
- Day 1 about 35 min: Spin tutorial 110 s (play.js), Baseline 1 46 × 15 s = 11.5 min (assess.js), session 20 min
  (model.js `session.minutes`), plus the welcome.
- Rings: js/ui/game.js reveal() (a ring when stretch or celebrate() === 'strong').
- Offline copy, updates at the next launch, one version per copy: sw.js header; DECISIONS 19 and 22 Nov (W3-misc,
  O21 and RV-code L6); the install row: js/ui/settings.js and app.js's held beforeinstallprompt (37ba451).
- +1 point "from chance to certain": model.js `lapse: 0.03`; σ(1) = 0.731.
- "still settling" above a 30-level range: js/ui/play.js SETTLING_WIDTH 30; "for example" settings: play.js and
  game.js's stamp line.
- Keep going: DECISIONS 19 Nov (W2-core, round 8). Session saved on hide and finished once at boot: rec.ui.live,
  PX.ui.play.recover (6e1336b). Screen sizes only with device details: the pooled export (6e1336b); the Lab's line,
  js/ui/lab.js:280.
- Near miss within four times the band, Move with half-dot arrows, the miss line: js/ex/centralpoint (0e413e9,
  22b3a03); keys after an answer: js/ui/play.js keys and the Keys sheet's line.
- Homing and Reckon: a tap beside the circle, Walk and Back toggles, "The top of the circle is the way you face
  now." (c75ad08). Openings' turn in the Watch and Try 2, Missing View's help line: DECISIONS 22 Nov (W1-band-B).
- No item back across checks: assess.js freshItem (7bab4ac); View Match's check settings: def.checkCell; the full
  check's order: config.measure.fullOrder (b885384); time left from measure.secPerItem 15.
- Versions (registry dump, 22 Nov): views@3, angles@4, cubes@4, patviews@3, openings@3, patfold@3, form@3;
  cubematch@2, patterns@2, mechanisms@3, otherway@2, motiongraphs@2, viewmatch@1, level@1, wordlinks@1.
- Forward-only conversions and the merge's alignment: js/engine/rebase.js scalev (bcadf71).
- Chapter 8: Missing View's starter stacks, "most line pieces" about 60 % over the band (DECISIONS 22 Nov,
  W1-band-B, H2); Cube Match's quarter turns with swapped symbols (DECISIONS 22 Nov, W2-measure, L6); Central Point's
  "half-way to the most central target" reported, not bounded (DECISIONS 22 Nov, W3-exfix, L3); Views' view
  questions measured level by level once (DECISIONS 22 Nov, W3-bandA, M3; views.test.mjs still pools its levels).
- Painted Cubes: counting only the cubes in view finds 62.3 % of first answers on stacked, test-range figures
  (1,920 items, 80 per setting, measured 22 Nov with a script outside the repository; 60.0 / 64.1 / 63.0 % at two,
  three and four high; 100 % on the starter figures, where every cube shows); five painted sides on a quarter of
  stacked figures from 10 cubes: gen.js FIVE_SHARE 0.25, FIVE_FROM 2.
- Hole Punch, "where the holes sit" near chance at every dimension level: DECISIONS 22 Nov (W1-band-B, H1).
- Spin: same-or-mirror items keep 6° clear of a quarter turn (DECISIONS 22 Nov, W3-exfix, H6); the figure's item
  (seed 7, angle level 4) turns 97.4° clockwise, shown as 97°.

## Figures and the PDF, round 2 (22 Nov)
- Privacy slip found and reported to the lead at once (15:12 UTC): tools/shots.py ran Chromium in the container's
  own time zone, so three figures showed its clock: app-summary.png and app-settings.png (on build since 8000b84)
  and app-section-review.png (on main since 1.1, and on build); the PDFs embed the first and the last (Fig. 2.6,
  Fig. 4.2). tools/shots.py and tools/build-pdf.py now set TZ=UTC before the browser starts (checked: the page's
  Date then reads UTC; without it, the container's zone). Every app figure was shot again under UTC, and the three
  were looked at; no other figure shows a time of day (app-today, app-lab, app-check, app-progress: dates only or
  none). The old versions stay in history: the owner's call, as with the 18 Nov stamps.
- tools/shots.py's Section capture now clicks through the instructions screen (mode 'instructions').
- Reshot: every exercise and probe (Missing View last, after W1-band-B's 29431d1), every app screen. Looked at:
  ex03 (both: the item turns 97°), ex05 (both: the shaded square), ex07-feedback, ex12, ex15, ex16, ex18, ex20
  (both: Move beside Confirm; the miss line), app-section-review, app-summary, app-settings.
- build-pdf.py: 57 sheets, no overflow after trims (chapter 3's first note, Homing's and Reckon's cards, the modes
  table's page, the engine page, the clock page, the probes page, chapter 9, chapter 11); chapter 9's iPhone panel
  became one line pointing to chapter 2's "Where your progress lives". Pages looked at: 4, 11, 18, 21, 36, 48.
  Metadata: /Author "the Chimera community (https://discord.gg/chmr)", /Subject "… Version 1.2.0.", dates
  D:…+00'00', no XMP.
- 15:32 UTC: Missing View's card adds its help line (a line says when the drawn structure stops); the PDF rebuilt, 57 sheets, no overflow; page 23 looked at. Checks after the round: node bets, overlap, chimera 851/0; tests/e2e/overlap.py 58/0; tools/privacy_check.py clean on what the push would publish; the six-word scan shares only the fixed Chimera line with BRIEF.md (and a file path in this log).
