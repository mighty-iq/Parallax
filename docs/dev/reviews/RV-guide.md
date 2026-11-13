# RV-guide: claims-vs-code review of the 1.1 guide, README and CHANGELOG

Reviewer: independent (did not write the guide). 13 Nov 2026, branch `build` as found on disk.
Scope: docs/guide/guide.html (the PDF's source), README.md, CHANGELOG.md (1.1.0 entry).
Method: read the whole guide; diffed it against the frozen v1.0 copy
(scratchpad/frozen-v1.0/docs/guide/guide.html) to find every new or changed line; checked each number
and claim against the code (gen.js headers and constants, learn.js, js/engine, js/core, js/ui), the
research notes (v1.1 R1–R4, I1, I2; v1.0 A) and DECISIONS.md. Exercise definitions printed through
`createContext({ files: pureFiles() })`. Shortcut rates re-measured with the Node tests' own reports:
`PX_REPORT=1 node tests/node/run.mjs cubes` (10,080 items) and `knots` (2,000 and 10,000 items per
variant). No git, no browser, no file in the repository changed except this one.

Line numbers are guide.html lines unless a file is named.

## Findings, ranked

### Must fix

**M1. Chapter 8, "Hand-set item difficulty": a stale simulation number (line 1618)**
- Text: "…still got items about half a percentage point from the target, and their 95 % ranges held
  the true ability 91.5 % of the time."
- Truth: the 1.1 run gives 92.2 % (docs/dev/ENGINE.md:162, "Train, misspecified items … 77.5 vs
  77.0 % (+0.6) … 92.2 %"); chapter 4 of the guide already says 92.2 % (line 1146). 91.5 % is the
  v1.0 figure (the diff shows line 1146 was updated, line 1618 was not).
- Corrected: "…still got items within about half a point of the target (+0.6), and their 95 % ranges
  held the true ability 92.2 % of the time."

**M2. Chapter 8, "Accessibility" panel: Homing has no motion warning in 1.1 (line 1715)**
- Text: "Track, Homing and Reckon are moving displays by nature: Parallax warns before them, and they
  pause at once."
- Truth: Track shows a motion notice before its first trial (js/ex/track/view.js:345–353,
  js/ui/play.js:605–621); Reckon has a "Comfort" part in Watch / How to play
  (js/ex/reckon/learn.js:26). Homing has none: its parts are View, Start, Landmarks, Turn
  (js/ex/homing/learn.js:14–19), and v1.0's only comfort sentence, inside the "larger screen" notice
  (frozen v1.0 js/ex/homing/learn.js:88), was removed in 1.1 (homing/learn.js:6 says so). No view
  phase 'notice' exists in homing/view.js.
- Corrected (text only): "Track, Homing and Reckon are moving displays by nature and pause at once;
  Track shows a motion notice before its first trial, and Reckon's How to play has a comfort note."
- Better (the lead's call, code): give Homing the same "Comfort" part as Reckon
  (reckon/learn.js:26); then the sentence is true as written. The nav page (line 775, "If the motion
  makes you feel unwell, pause or stop") already speaks for both exercises.

### Should fix

**S1. Painted Cubes card, "Checked": the Kurtuluş & Yolcu attribution (line 999)**
- Text: "…and the classic error, counting the painted faces in view (Kurtuluş & Yolcu, 2013), is held
  near chance."
- Truth: the notes record Kurtuluş & Yolcu's classic errors as "counting only visible cubes, counting
  faces as cubes, double counting, and missing hidden cubes", in counting cubes in drawn buildings,
  not painted sides (docs/research/v1.1/R3-dat-pat.md:194–197). Judging a cube by the painted faces
  the picture shows is the generator's painted-cube adaptation (js/ex/cubes/gen.js:26–31). The code
  does hold that adaptation near chance (my run: 12.6 %, tests/node/cubes.test.mjs:200), while the
  error the study names, counting only the cubes in view, is right on 60.8 % of items (reported, not
  bounded; DECISIONS.md:21; cubes.test.mjs:205–207).
- Corrected: "Judging each cube by the painted faces the picture shows (the painted-cube form of the
  classic error of counting only what is in view; Kurtuluş & Yolcu, 2013) is held near chance;
  counting only the cubes in view still finds about 6 answers in 10, because hidden cubes are where it
  fails (chapter 8)."

**S2. Research table, row "Classic cube-counting errors" (line 1590)**
- Text: Numbers "counting only visible cubes or faces; accuracy falls with more cubes and hidden faces";
  Design response "Painted Cubes: the visible-face count held near chance; the tally strategy card".
- Truth: as S1. "or faces" is not in the note (R3:195–196 says "counting faces as cubes"), and the
  row reads as if the named error were neutralised, though "visible cubes only" scores 60.8 %.
- Corrected: Numbers "counting only visible cubes, counting faces as cubes, missing hidden cubes;
  accuracy falls with more cubes and hidden faces". Design response "Painted Cubes: hidden cubes in
  most figures (89 %); judging cubes by the faces in view held near chance; the tally strategy card".
  (89 %: the cubes test report, "hidden in 89 %".)

**S3. Painted Cubes card, "Strategies" (line 998)**
- Text: "Know the common positions: a corner cube on the ground has 3."
- Truth: js/ex/cubes/learn.js:48 says "A top cube at a corner on the ground: top and two sides, so 3."
  A corner cube with a cube on it has 2, and every figure here has columns 2–4 high.
- Corrected: "a corner cube on the ground with nothing on top has 3."

**S4. Chapter 8, "Shortcuts": the navigation exceptions are missing (lines 1621–1622)**
- Text: "Each must score within 10 points of chance … A few partial strategies do better, and are kept
  because they are part of the skill: [Fold and Hole Punch symmetry; Knots' Link signed count; Painted
  Cubes, cubes in view; Openings, the most-featured face]."
- Truth: Homing and Reckon have the largest exceptions, and the list leaves them out:
  - turn-only answers (the legs taken as equal, "the start is on the side I turned") are reported,
    not bounded (decision (a): DECISIONS.md:47; js/ex/reckon/gen.js:37–41; js/ex/homing/gen.js:30–33);
  - a fixed answer is exempt in 11 easy route × tolerance cells, where it scores 28–52 %
    (DECISIONS.md:50);
  - on Reckon's walks back, "true direction + average distance" hits 52–97 % in every cell
    (docs/dev/progress/B3.md:110–113).
  The nav page (line 771) quotes the Library's line about turns, but chapter 8's general statement
  stays untrue for these two exercises.
- Corrected, appended to the list: "in Homing and Reckon, answers that follow every turn but treat the
  legs as equal, which the easier routes cannot hide (there one fixed answer also scores 28 to 52 %),
  and, on Reckon's walks back, the right direction with an average distance;". The first sentence
  could read "Each must score within 10 points of chance wherever the item rules allow it".

**S5. Reckon: the Noel et al. study is a related task, not "a lab version of the task" (lines 738, 1280)**
- Text (738): "In a lab version of the task with feedback after every trial, the overshoot of distance
  vanished within one session…"; (1280) "In a lab version of the task, feedback after every trial
  removed the overshoot of distance within one session".
- Truth: Noel et al. 2020 is the "firefly" task: steering with a joystick to a target shown before
  the move, over short-lived ground elements (R1-path-integration.md:102, 110, 128, 210). It is path
  integration from optic flow, but neither pointing home nor walking back after a passive route.
- Corrected (738): "In a related lab task (steering through optic flow to a spot shown beforehand),
  feedback after every trial removed the overshoot of distance within one session and shrank the
  angular bias, though practice and feedback were not separated (Noel et al., 2020)." (1280): "In a
  related lab task, feedback after every trial removed…".

**S6. README: "DAT" before "Dental Admission Test" (README.md:13–14)**
- Text: line 13 "…and six DAT-style formats: Openings, …"; the name is spelled out only in the next
  bullet (line 14).
- Truth: R3 §6, R3-dat-pat.md:440–441: spell out "Dental Admission Test" at first mention ("DAT"
  alone is also Pearson's Differential Aptitude Tests).
- Corrected (line 13): "…and six formats of the Perceptual Ability Test in the Dental Admission Test
  (DAT-style formats): Openings, Missing View, …".

### Nice to have

- **N0. Knots shortcut rates are one sample's maxima** (line 852): "paired, no cheap rule tested beat
  52.3 % on Pull, where guessing scores 50 %, or 33 % on Untie and Tie, where it scores 25 %." True of
  the test's default report: `PX_REPORT=1 node tests/node/run.mjs knots` (10,000 items per variant,
  all 463 checks pass) gives Pull at most 52.3 % (slide-over triangles), Untie at most 31.5 %, Tie at
  most 32.9 %. But other samples go higher: the reviewer's measures reached 53.6 % on Pull
  (docs/dev/reviews/RV-knots.md:189–196) and a 2,000-item run gives 52.5 % (bigons); the test bounds
  are ≤ 60 % and ≤ 35 % (tests/node/knots.test.mjs:368, 397, 416). Sturdier wording: "paired, no cheap
  rule tested scored more than about 54 % on Pull, where guessing scores 50 %, or about a third on
  Untie and Tie, where it scores 25 %."
- **N1. Heading before the full name** (guide line 97 h3 "Six DAT-style formats", spelled out in the
  same panel at line 98; guide line 862 h2 likewise; CHANGELOG.md:55 bullet title). R3:440. Option:
  "Six admissions-test formats" in the What's new heading; elsewhere acceptable as is.
- **N2. "Five ways to practise and one to measure"** (line 1030; README.md:15) while the modes table
  lists Section practice (line 1052). Chapter 1 handles it (line 174: "…and Section practice for the
  six test formats"). Add the same tail to line 1030 and README.md:15.
- **N3. Contents panel, "The phone pictures … start from a fresh record"** (line 62). Fig. 2.11
  (app-today-phone) and Fig. 3.1 (app-library-phone) use the simulated record (tools/shots.py:103–105,
  489–498; caption line 342 says so). Corrected: "The new phone pictures and screens of 1.1 start
  from a fresh record."
- **N4. Where paused or opt-in exercises stay.** Line 1665: "Free play, Path, Section practice, the
  Library and the Daily Challenge keep them" — a Path without a chosen exercise leaves paused
  exercises out (js/engine/schedule.js:139–152). Corrected: "Free play, a Path you choose, Section
  practice, the Library and the Daily Challenge keep them." Line 878: with the focus off the six
  formats are also open in a chosen Path and in Speed from their Library card; "stay in the Library,
  Free play and Section practice" is incomplete, not false.
- **N5. "Free play without a set length"** (line 1167; CHANGELOG.md:10–11) — Free play is time-boxed
  unless a number of items is set (js/engine/modes.js:401–402). Corrected: "Free play without a set
  number of items".
- **N6. Export columns** (line 1744): the list omits the first value column (`value`,
  js/core/store.js:68–69). Add "a value the exercise reports (Reckon: the signed angle error)". Line
  1745 (and 1775): the research export also adds each row's answer type (js/ui/log.js:125, 135).
- **N7. Angles, "the gains tend to stay with this kind of figure"** (line 882): in the notes this is a
  design judgement without a source (R3-dat-pat.md:482 "all DJ unless a source is named", :612–613).
  Option: "…improves with practice; Parallax expects the gains to stay with this kind of figure and
  claims nothing beyond the format."
- **N8. CHANGELOG.md:27, "turning the phone during an item voids the trial"**: the player voids a turn
  while the stimulus plays or a timed item runs (js/ui/play.js:397, 1053–1062), plus Homing and
  Reckon while answering. Corrected: "turning the phone while an item plays voids the trial" (the
  guide's wording).
- **N9. CHANGELOG.md:63–67, Section practice**: "Numbered forms hold the same items for everyone" →
  "…for everyone with the same exercise versions" (js/engine/section.js:14–15); "A full section earns
  …" → "A full section with every part reached and at least half its items answered earns …"
  (js/engine/achievements.js:55, 126–133), as the guide says at line 1223.
- **N10. Nav page, "Answers that need no tracking (… the mirror image) always miss"** (line 771): true
  of Reckon (reckon/gen.js:29–33); Homing forces only "turns reversed" and "heading not updated" to
  miss and holds the mirror near chance (homing/gen.js:25–28; DECISIONS.md:50). Start the sentence
  "In Reckon, …".
- **N11. Missing View, "Wrong ones … → one edge solid instead of dotted, or the reverse"** (line 932):
  that level gives solid/dotted foils for front and end views; a missing top view gets the closest
  one-line foils (js/ex/patviews/gen.js:30–33). Option: "… → one line changed (solid for dotted, or the
  reverse)".
- **N12. ADA reference** (line 1929): it links the DAT page only; the study is
  ada.org/…/education/dat_validity_study.pdf (R3-dat-pat.md:851). Optional.
- **N13. Levacher et al. title** (line 1983): the notes give "…without knowing the rules – but you're
  better off knowing them" (R4-test-overlap.md:651–652); the guide has a comma.
- **N14. README layout** (README.md:80–99) omits icons/, manifest.webmanifest and docs/research/.
- **N15. README.md:14 and CHANGELOG.md:55–61 name the DAT without a limitation line.** The guide and the
  app carry one beside every DAT-style text (guide line 889; e.g. js/ex/patfold/learn.js:91). Optional
  for these two files: "Parallax has not measured any effect on DAT scores and predicts none."
- **N16. "the real test's average pace"** (line 1203): "the test's average pace" says the same without
  the "real test" phrasing R3 §6 steers away from (R3:437).
- **N17. README.md:36, "Safari may clear site data after 7 days without a visit"**: the note and the
  guide say seven days *of use* without a visit (I2-mobile-audit.md:40; guide lines 325, 1758).
  Corrected: "after seven days of use without a visit".

## Side notes for the lead (outside the reviewed files)
- The default Knots run passes (463 of 463, 10,000 items per variant, 878 s), but
  `PX_REPORT=1 PX_TEST_ITEMS=2000 node tests/node/run.mjs knots` fails 1 check on another seed:
  "[knots: show me] pull: no frame inside a move passes a strand through another (14793 frames) (pull
  seed 530622980: step 4 (R2) at k = 0.5137)". It bears on the guide's and CHANGELOG's "Show me …
  checks every move" (lines 94, 846; CHANGELOG.md:52–53). It may be the near-k = ½ projection case B4
  describes (docs/dev/progress/B4.md:37–39), or a real pass-through that the default seeds miss; B4
  should look at that seed.
- js/ex/reckon/gen.js:20 (header) still says "varied between legs, 1.2–2.0 m/s"; the code uses 0.5–2.0
  (line 74), as the guide and CHANGELOG say.
- js/ui/check.js:3 (header) says "about 15 minutes"; the screen computes 15 to 25 (line 95).

## Checked and found right
- **Counts and names**: 19 training exercises and 6 probes (registry ids); codes EX-12 Reckon … EX-19
  Form in PAT order; abilities (Reckon NAV, Knots Vz, Angles LE, the other five Vz); cells (Angles
  null = outside the 2 × 2); "Eight more in version 1.1"; 21 achievements; contents and chapter counts.
- **Homing v2** (homing/gen.js:8–10, 120–125; learn.js): 1.8 m/s, 45°/s, 0.4 s ramps, routes 12–28 m,
  longest ≈ 29 s, 8 route steps with turn bands 30–60/60–120/120–160°, landmarks 3 / 1 / none,
  tolerances 40/30/20°, version 2, drag / dial / 1° and 5° buttons / ← → with Shift, void rules
  (DECISIONS.md:38), Library wording; the card's show-me caption "122° turn and three landmarks"
  (shot viewed).
- **Reckon** (reckon/gen.js, view.js, learn.js): 2–4 legs; ground textured / sparse / dots living
  0.8–1.4 s; steady 1.8 m/s ± 10 %, varied 0.5–2.0 m/s, turns 30–45°/s; tolerances ±40/30/20° or
  50/35/25 %; home 5–20 m; motion ≤ 30 s; feedback (angle error, distance %, drift cm per metre on walks
  back, four named slips, habit line after 5 of the last 20, chart); value = signed angle error, value2 =
  distance ratio; strategy cards and "switch after two misses"; the bridge's limitation line quoted
  exactly; the Library quote on the nav page matches library.js:51; Keys Walk ↑, Back ↓, Here Enter.
- **Knots** (knots/gen.js header, RUNGS, LINK_RUNGS, V_OFFSET; learn.js): pull / untie / tie / link,
  mirror not built; 5–12 crossings in 10 steps, slide-over rungs; spacing open / close / tight; untie and
  tie from 7 crossings; link 8–11 with 6 crossings between the loops; validator chain (moves →
  Fox-colouring determinant → slide-overs → Jones, ≤ 24 crossings); pairing on alternation, writhe and
  visible slides; keys 1/2 and 1–4; Fig. "8 crossings" (shot viewed, 8 crossings counted).
- **DAT-style cards** against gen.js headers and dims: Openings (5 options; features 1+1+1 … 2+2+2;
  45° chamfers; fitting face levels; pose; proportion foil; twelfth-unit ray casting, 8 turns and flips,
  exactly one match); Missing View (4 options; cubes 4–5 … 10–12; 3 × 3 or 4 × 4; end → front → top;
  layout, end = right side; exhaustive search plus a second search); Angles (4 orderings; gaps 6→2°;
  sizes 70–110 / 25–72 / 108–155°, all < 180°; resolve levels; pose; arm-length cue control; perDisplay);
  Hole Punch (4 × 4, 2–3 folds, one punch, 5 options, idle folds 0–2 easier, never turned over, equal
  hole counts, symmetry method 89 % as information); Painted Cubes (5 options 1–5; cubes 6–9 … 18–22;
  tallest 2–4; N 3–4 then 1–2, never 5; every column's top in view; up to 3 questions per figure,
  section.js:111); Form (4 options; solid levels; mark levels; picture poses; foils; two independent
  checks; never a cube).
- **DAT wording**: "DAT-style" throughout; no "official", "simulator", "DAT score" or score claim in the
  guide; the ADA line word for word on every guide page that names the DAT (6 pages: What's new, the
  DAT-style page, Section practice, the 1.1 research table, Test hygiene, References 1) and once in
  README and CHANGELOG (matches after line-wrapping); codes avoid the mark; the Library figure shows the
  focus switch, Section practice, the limitation line and the ADA line (shot viewed).
- **Section practice** (engine/section.js, ui/section.js): parts in PAT order; 15 or 5 a part = 90 or 30
  items, 60 or 20 minutes, 40 s an item (R3: 90 items in 60 minutes); 35–65 % band; numbered forms;
  "new to you"; part-only navigation (DECISIONS.md:33); Back, Flag, Skip, Items; rules card pauses the
  clock; 5-minute idle; warnings at 5 and 1 minutes; voided items replaced at the end of their part;
  resume after reload; review contents; no rating change, no score, mode 'section'; "Full section".
- **Clock and sessions** (core/clock.js, engine/modes.js, ui/play.js): stop reasons; 60-s idle counted,
  nothing after; inputs include mouse movement (pointermove); "under 1 min", "7 min", "1 h 05 min"
  rounded; HUD rounded down, refreshed every 5 s outside the stimulus, "last item"; closing item and
  plan extension; summary restored for up to 12 hours (play.js:1740); Daily (8 items, local date, #1 =
  1 Nov 2026, share line, partial resume; pool leaves out Track, Homing, Reckon, Angles and the
  DAT-style six); weekly goal 10 answers or 5 minutes, Checks excluded (streak.js:36); Check time not
  practice; clock.py full run 73 passed, 0 failed (tests/e2e/out/clock full.json).
- **Fixed in 1.1 table** against I1 T1–T7 and B1–B12.
- **Phones and storage**: per-display ratings for Track, Homing, Reckon, Angles, small = short side
  < 600 px (estimator.js:202–205); 844 × 390 checks (DECISIONS.md:31); Help strip; the iOS / in-app
  welcome and the 14-day backup offer (welcome.js:242–251); storage.persist (app.js:815–831); manifest
  on https (app.js:794–802); text size 90–150 % (settings.js:15); tones high/low (play.js:1168–1169);
  Safari's seven days (I2:40).
- **Record and exports**: format 2 and the 1.0-tab rule (store.js:55, 634, 654); 18-column CSV with
  display, input, value2; JSON backup contents incl. one-tap answers, Section runs, tests noted, focus
  switches; research export b and g.
- **Engine texts**: similar-exercise groups and Lab group B (model.js:64–65, 98); achievements and the
  "every exercise" exclusions (achievements.js:31–61); the Angles → Level and screen-class notes in
  Progress (progress.js:319–351); chapter 4's simulation panel and chapter 5's 1,600 / 96.5 % match
  ENGINE.md §16; 1.10 MB records.
- **Test hygiene**: "Also in tests" list (overlap.js NEAR: Fold, Hidden, Views count, Nets, Span, Knots,
  plus the six); related-only list; helper kinds and the "not trained" lines; the Check question's
  wording and its No / A little / A lot / Skip (check.js:381–401); About's section.
- **Research claims and references**: Uttal 206 studies (A-evidence:14: 217 in the abstract, 206
  analysed); Noel 1.10 → 0.97 and 1.49 → 1.09, practice and feedback confounded (R1:210); Lövdén 42
  sessions, +1.42 SD, +0.29 SD p = .072 (R1:220); Embodied Navigation 22.5 → 10.6 m (R1:223); Riecke &
  Wiener 37.5 % (R1:185); McLaren 6 trials r < .5 (R1:213); Bennett-Pierre r = .54 / .59, R² ≈ .40
  (R2:96–97); Croom & Firestone 36.9–49.6 % and 92.5 % (R2:144–149); Brandt & Davies r = .42–.45
  (R2:117–120); Tuzun & Sikora ≤ 24 crossings (R2:455–462); ADA .16–.36, 38 schools, Year 2 technique
  highest (R3:227–240); Dillon 5.4° / 8.9° / 11.2° (R3:170–171); Scharfen, Hausknecht .70 vs .24 and
  .46 vs .24, Schneider d ≥ 1.19, Levacher d = .92, te Nijenhuis ρ ≈ −.95 (64 studies), Sommer &
  Arendasy "years", Wright 19.4 → 19.2 % (R4:259–306, 316–323, 360–365). DOIs and links of the 1.1
  references match the notes (R1:486–506, R2:890–923, R3:849–885, R4:621–700); read levels noted there
  (several R4 numbers rest on abstracts: Schneider, Levacher).
- **Honesty and Chimera**: every "where it is used" text quoted or described carries its limitation;
  far transfer cited, not promised; no IQ, index, percentile or brain age. Chimera wording unchanged
  from 1.0 apart from version lines; nothing new speaks for the community; the community member behind
  Reckon is never named ("a community member", guide lines 90 and 756, CHANGELOG.md:47).
- **Not re-verified here** (needs a browser): that every scored item fits 360 × 640 in the final build
  (the fit runs on disk are partial runs from the build), the PDF's page layout and the remaining
  figures' captions.
