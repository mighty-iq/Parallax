# RV-claims-1.2: claims against code (independent review)

Reviewed 2026-11-19, finished 15:27 UTC, by a reviewer who built none of it and wrote none of its texts.
Snapshot: commit a434e64 (`1.2.0-test.4`), checked out read-only; nothing in it was changed.
Scope: README.md, CHANGELOG.md, LICENSE, LICENSE-GUIDE.md, the player-facing texts of js/ui/ (about, library,
bets, tour, welcome, home, measure, check, section, overlap, game, climb, share, settings, play) and of every
js/ex/<id>/learn.js, and the guide (docs/guide/guide.html, docs/Parallax-Guide.pdf with its metadata).
Rules applied: CLAUDE.md rules 1, 2, 3, 10, 11, 12, 13 (and rule 9's "no commercial trainer's name"), the
standing rules' "The bar", "Stance on transfer" and "Fixed for every new tool".

Method. Every number checked was traced to the constant or computation behind it (cited as file:line, or the
config key). Exercise settings were dumped from the registry through `tests/node/run.mjs`'s `createContext`;
the guide was read in full as text with its source lines; the PDF was read page by page (`pdftotext`) and its
raw metadata parsed. Research claims were checked against docs/research (v1.0–v1.2) and their read levels.
Guide line numbers are lines of docs/guide/guide.html; PDF pages are pages of docs/Parallax-Guide.pdf. The PDF
was built from guide.html at 8d0ea13 (13:17 UTC) and its text matches guide.html; the app code changed after
that until a434e64 (15:01 UTC), which is where most of the drift below comes from.

Severity. High: a published text breaks a hard rule (privacy, Chimera, IQ/norm, promised outcome, a DAT score
claim) or misstates what the app does in a way a player would act on. Medium: a text contradicts the code or
another text on what the app does, or a voice rule is broken on a player-facing screen. Low: precision,
stale detail, wording.

**Counts: high 0, medium 5, low 18.**

## Findings

### Medium

**M1. The guide says Train is untimed; the code (and the guide elsewhere) puts Speed's deadline on easy
items inside Train.**
- Text: guide.html:409 (PDF p. 11) "Training items are untimed, except Central Point's quick form.";
  guide.html:517 (p. 14, Spin) "Time: none in Train; Speed mode and a deadline staircase in Threshold add it
  later"; guide.html:1089 (p. 26) "Train is untimed, except Central Point's quick form, whose clock is part of
  the task."
- Code and other texts: js/engine/dims.js:82 (`fluency: 0.1`, "fluency items per dealt item once Speed is
  open"), dims.js:560–640 (fluency items carry Speed's deadline in Train); plateau row 3 adds "more items with
  Speed's deadline inside Train" (guide.html:1187, js/engine/plateau.js change ids). The guide's own
  guide.html:90 (p. 3) and guide.html:1169 (p. 28), and CHANGELOG.md:22–23, say so.
- Rewrite (guide.html:409): "Training items are untimed, except Central Point's quick form and, once Speed
  opens for an exercise, its fluency items, which carry Speed's deadline." guide.html:517: "Time: none at
  first; once Speed opens, Train's easy items carry its deadline, and Threshold has a deadline staircase."
  guide.html:1089: "Train is untimed until Speed opens for an exercise; then its easy items carry Speed's
  deadline and update only the timed rating. Central Point's quick form has a clock of its own."

**M2. The guide's account of Section practice forms predates 4b0af60.**
- Text: guide.html:1302 (p. 31) "Its items sit in the middle of each exercise's difficulty range, 35 to 65 %
  of the way up."
- Code: js/engine/section.js:141–156 `band()`: where an exercise declares a test range, forms come only from
  the settings tagged test range, and the 35–65 % band is taken within those (commit 4b0af60, 14:07 UTC; so
  Missing View's cube stacks and every level tagged below or beyond the format stay out).
- Rewrite: "Its items come from each format's test-range settings only, from the middle of their difficulty
  span (35 to 65 % of the way up), so starter levels and features beyond the format never appear."

**M3. The guide's colophon gives the wrong version.**
- Text: guide.html:2043 (PDF p. 52) "Version 1.1.0, 13 November 2026 (first published for 1.0.0, 6 November
  2026)."
- Same document: guide.html:19, 33, 77 (cover and contents: "Parallax 1.2.0 · user guide", "Version 1.2.0");
  PDF /Subject "… Version 1.2.0."; js/core/px.js is 1.2.0-test.4.
- Rewrite: "Version 1.2.0, November 2026 (first published for 1.0.0, 6 November 2026; updated for 1.1.0, 13
  November 2026)." Set the date at release.

**M4. Three exercise pages stack a second limit under a bridge that already has one.**
- Code: js/ui/library.js:685 adds the generic LIMIT paragraph (library.js:592: "Practice improves the
  practised task and often similar spatial tests. Effects on grades, work, sport or IQ have not been shown.")
  unless the bridge matches `/not been shown|not been studied|little or no|not established/`. The bridges of
  Homing (js/ex/homing/learn.js:137), Reckon (reckon/learn.js:213) and Central Point (centralpoint/learn.js:151)
  say "has not been tested", which the pattern misses, so each page shows two limits in a row; on Central
  Point's page the generic line also adds "often similar spatial tests", which its own note and bet line
  ("new, transfer untested") do not support.
- Confirmed by evaluating the pattern on every bridge: exactly these three get the extra paragraph.
- Fix: add `not been tested` to the pattern at library.js:685 (no text change needed).

**M5. The DAT-style bridges of Openings, Missing View and Form stack three limits.**
- Text: js/ex/openings/learn.js:97, patviews/learn.js:122, form/learn.js:119: "Practising here improves this
  task and often similar ones; it has not been shown to improve grades or job performance. The format also
  appears in the Perceptual Ability Test of the Dental Admission Test (DAT®). Parallax has not measured any
  effect on DAT scores, and PAT scores relate only modestly to dental-school grades." + the ADA line.
  Hole Punch (patfold/learn.js:103), Painted Cubes (cubes/learn.js:131) and Angles (angles/learn.js:105) carry
  two.
- Rule: CLAUDE.md rule 2 ("one accurate limit where a claim needs it, never stacked"); the negation about
  DAT scores with the ADA line is the one that rule 2 asks for.
- Rewrite (Openings; the same pattern for the others): "Matching an object to an opening means finding its
  outline along each axis, as in reading a part's views. The format also appears in the Perceptual Ability
  Test of the Dental Admission Test (DAT®); practising it here improves this task, and Parallax has not
  measured any effect on DAT scores." + ADA line. The PAT validity figure stays in the guide (guide.html:926),
  where it is context, not a stacked limit.

### Low

**L1. "A new player's first block of walks ends after about 5 minutes": the app offers to end.** Text:
guide.html:125 (p. 4) and guide.html:773 (p. 19). Code: js/ui/play.js:2271–2277 shows a card after 5 minutes
of motion (MOTION.newLimit 300000) with "End the session" as the primary button and "Go on". Rewrite: "and
after about 5 minutes of motion offer a new player the end of the session (Go on stays one tap away)."

**L2. The research table's off-screen row lists three exercises.** Text: guide.html:1631 (p. 41) "Off-screen
challenges for Fold, Nets, Views". Code: seven (Fold, Nets, Slice, Views, Orient, Knots, Central Point:
`offscreen` in their learn.js or layers.js); the guide's own guide.html:1379 and CHANGELOG.md:32–33 say seven.
Rewrite: "Off-screen challenges on seven exercises, logged; untested, no maths claim".

**L3. One dose claim, two different sources.** guide.html:240 (p. 7) cites Miller & Halpern (2013) for
"Several programmes that worked in studies ran about 10 to 20 hours in all … and more hours have not been
shown to help more"; guide.html:1380 (p. 33) and 1658 cite Hawes et al. (2022) for the same. Note
docs/research/v1.0/A-evidence.md:118: the 10–20 h range comes from several programmes (Feng 10 h, Miller &
Halpern 12 h, Lowrie 12–20 h); no dose–response in Hawes (n.s.), Uttal (untested) or Bediou. Rewrite:
"Programmes that worked ran about 10 to 20 hours (12 in Miller & Halpern, 2013), and no meta-analysis found
that more hours helped more (Hawes et al., 2022)."

**L4. "Expect roughly 6 to 8 in 10 right" does not hold for Pattern Memory, which now opens every full
check.** Text: js/ui/check.js:69, 148; js/ui/measure.js:490, 491; guide.html:1473 (p. 36). Code: every
other probe aims at g + (1 − g)·0.6 (68–70 % right, js/engine/assess.js:78), but Pattern Memory counts an
item right only when the whole pattern is exact (js/ex/patterns/gen.js:217) and aims at k 0.35
(patterns/gen.js:257), and `fullOrder` puts it first (assess.js:71). Rewrite: "expect roughly 6 to 8 in 10
right on most tasks; Pattern Memory is scored square by square, so few patterns come out exact".

**L5. The meter is described without "beyond familiarity".** Text: README.md:35 "the chance that your probe
composite has gone up"; js/ui/about.js:78 "how likely it is that your probe scores have risen";
guide.html:102 (p. 3) the same. Code: the meter is P(D > 0) for the gain beyond the familiarity model
(js/engine/trend.js:39–42), as guide.html:1438 says; rule 10: change is judged against familiarity, never
against zero. Rewrite: "the chance that your probe composite rose beyond what familiarity predicts".

**L6. "Day 1 · about 15 min, or more" understates the code's own estimates.** Text: guide.html:246 (p. 7).
Code: the tutorial is about 2 minutes (play.js:1655–1660: 110 s for Spin), Baseline 1 is 11.5 minutes (46
items × 15 s, assess.js:66–67, 85), and the Train session that follows lasts 20 active minutes by default
(model.js `session.minutes: 20`); Day 2 (Baseline 2 + training) is given as about 30. Rewrite: "Day 1 · about
35 min: the welcome, the tutorial and Baseline 1, then a Train session; End stops it whenever you like."

**L7. A causal claim the guide itself calls weak.** Text: js/ex/views/learn.js:165 "was part of a
spatial-skills course that raised spatial test scores in first-year engineering students (Sorby 2009)".
Guide.html:617 (p. 16): before-and-after numbers, students selected for low scores, self-selected comparison
groups, "so causal claims are weak". Rewrite: "was part of a spatial-skills course after which first-year
engineering students scored higher on spatial tests (Sorby 2009; before and after, without a randomised
comparison)."

**L8. The Baseline card presumes a change.** Text: js/ui/tour.js:135 "so you can see what practice changes
beyond familiarity with the tasks." Rewrite: "so you can see whether practice changes anything beyond
familiarity with the tasks."

**L9. A range note uses a difficulty word.** Text: js/ex/openings/gen.js:1262 (test-range note, shown on the
exercise page): "Two features, on two faces, is the easy end of the format". Rule: range tags and notes
describe format features, never the test's difficulty. Rewrite: "Two features, on two faces, is the fewest
the format shows; the official sample spreads a few over more than one face."

**L10. Section practice names the DAT on a screen without the ADA line.** js/ui/section.js:662 shows GUESS
(section.js:227, "The Dental Admission Test has no penalty for guessing either.") after the last item, on the
run screen; the ADA line is placed only on the setup, instructions and review screens (section.js:139, 185,
370, 880). Fix: on the run screen use the first sentence of GUESS alone, or add `ada()` there.

**L11. The guide's reference list names a commercial tracking trainer.** guide.html:2191 (p. 56) gives Vater
et al.'s title in full, which names the product; js/ui/about.js:21 paraphrases the same reference ("a
commercial 3D multiple-object tracking trainer"). Rule 9 and the standing rules ("no names or units of
commercial trainers"); no DECISIONS line covers a citation exception. It was already in the released 1.1
guide. Either paraphrase the title as About does, or log the exception (exact titles in references only).

**L12. "A ring only for a right stretch item" holds at the default only.** Text: guide.html:1539 (p. 38);
guide.html:1565 "a ring on a right stretch answer". Code: js/ui/game.js:560 rings every right answer when
`celebrate` is Strong (game.js:528 says so). Rewrite: "… a ring for a right stretch item (at Strong, for
every right answer), a stamp only for a new grade."

**L13. "Four add-ons put the bets to work between items".** Text: README.md:26. Comparison rounds and bridge
sets come between items (play.js hooks `item:before`); draw-the-answer items are items, and detailed
feedback follows an answer (`item:notes`, js/ui/bets.js:9). Rewrite: "Four add-ons put the bets to work:
comparison rounds and bridge sets between items, draw-the-answer items in place of a choice, and detailed
feedback on your estimates after an answer."

**L14. Release texts lag the snapshot.** The service worker that lets the GitHub Pages copy start offline
(sw.js, dc630b1) and Settings' "Install Parallax on this device" (js/ui/settings.js:262, 37ba451) are in no
release text: CHANGELOG.md's 1.2.0 entry, the guide's "Also in 1.2" (guide.html:120–131) and README.md's
layout (116–134, no sw.js). Settings' CSV line (settings.js:243) lists 1.1's columns only, while the file has
26 (js/core/store.js:84–88; guide.html:1865). Add one line each to the CHANGELOG and the guide's table, sw.js
to the README layout, and "and since 1.2 each item's kind, add-on, answer mode, orientation, deadline and
offset" to settings.js:243.

**L15. Three Evidence rows in the guide stack limits.** Track, guide.html:472 (p. 13): four null findings in
a row; Views, guide.html:617 (p. 16): three caveats before "causal claims are weak"; Homing, guide.html:713
(p. 18): opens with a limit and adds a second. Rule 2 and the standing rules' voice. Rewrite (Track): "Gains
on the trained task are large (d = 1.6–2.0); transfer beyond it has not been found so far, in the lab or on
the pitch (Harris et al., 2020; Vater et al., 2021; Romeas et al., 2025). Track's bet is attention control,
and the pooled exports test it." Views: "Scores on a rotation test rose from about 50 % to 74–82 % in
students selected for low scores, before and after, without a randomised comparison (Sorby, 2009)."

**L16. "+1 point is about the step from 50 % to 73 % right on the same item" holds only without guessing.**
Text: js/ui/measure.js:749; guide.html:1508 (p. 37). Model: P = g + (1 − g − 0.03)·σ(θ − b) (model.js
`lapse: 0.03`; guide.html:1122); on a four-option probe item +1 point goes from about 61 % to 78 % right.
Rewrite: "+1 point is about the step from 50 % to 73 % of the way from chance to certain on the same item."

**L17. About's credits name fewer texts than the licence.** js/ui/about.js:97 "The guide, the README and the
notes: CC BY-SA 4.0"; LICENSE-GUIDE.md:10–13 and README.md:143 also cover the CHANGELOG and the guide's
figures. Rewrite: "The guide and its figures, the README, the CHANGELOG and the notes: Creative Commons
Attribution-ShareAlike 4.0 (CC BY-SA 4.0)."

**L18. The fallback How to play sheet gives digit keys for every exercise.** js/ui/library.js:331 "Keys: 1–9
pick an option"; the DAT-style formats letter their options and Angles takes letters only
(js/ui/play.js:86–90; js/ex/registry.js:466–473). Shown only when the player module is missing. Use
`PX.ui.play`'s `pickKeys` wording or drop the keys line from the fallback.

## Checked and found clean

### Numbers against the code
| Text (where) | Code |
|---|---|
| 20 exercises: 14 training + 6 DAT-style; 9 probes (README:15–18; guide:170) | registry dump (`role`, `pat`) |
| Bets per exercise, nine bets, calibration new (README:24; About bets; guide:1394–1407) | each gen.js `bet`; js/engine/bets.js:48–86 |
| Add-ons per exercise; periods ≥ 4 weeks and 8 sessions (README:26; bets.js:100, 121; guide:1410) | `def.layers`; bets.js:114 `periodDays 28, periodSessions 8` |
| Baseline 1: 46 items, 11.5 min; blocks 14 items, 3.5 min; ≤ 4 a week; B2 ≥ 12 h; 4-weekly; week 7 min; gap 8 h; break 56 d (README:32–34; CHANGELOG:17–18, 34–35; guide:1426–1429; home.js:298) | assess.js:59–95 (`full`, `block`, `week`, `secPerItem 15`, `blocksPerWeek 4`, `b2Hours 12`, `everyDays 28`, `gapHours 8`); trend.js:91 |
| Milestones 2 / 4 / every 4 weeks; bars 97.5 % / 95 %; "likely no change" from week 8 at P ≥ 0.90 of < 0.2 SD; 90 % ranges (README:35; guide:1438–1441) | trend.js:91–94, 638–640 |
| 1.3 SD for 6 in 10 at week 8 (1.0 optimistic), 1.6 at week 4, false "likely gain" ≤ 5.9 % (README:35; guide:1444, 1819) | docs/dev/v1.2/measure-sim.md §0 (MDG = 60 % at P ≥ 0.95: 1.64 / 1.27; 1.26 / 0.97; 5.9 %) |
| Per-setting fit from 100 answers, window 400, cap 0.75 logit, one in five leads, fluency 1 in 10 (README:42; CHANGELOG:21–23; guide:1168–1172) | dims.js:65–82 |
| Plateaus: 640 answers, 8 sessions on 8 days, gap 14 d, trial 3 sessions and 120 answers, rest 3.5 d, three words, 3.7 levels per 100 answers on a 4-logit range (README:43; CHANGELOG:24–27; guide:1181–1200) | plateau.js:64–85; js/ui/plateau.js:115–119; 0.15 × 99/4 = 3.7 |
| Plateau simulation 87–88 % within 800, false alarms < 5 % (guide:1200) | docs/dev/v1.2/plateau-sim.md (86.9 / 87.9 %; 4.8 / 4.5 %) |
| Target ≈ 3 in 4 on four options; style table 89/93/85, 78/85/70, 66/78/55 % (README:42; guide:1125–1131) | model.js:47–49 (`styles`, default `balanced`) |
| Session: 3 exercises, 2 warm-ups, 15 % random, shares 20–50 %; weak spot 15 answers → a fifth; runs 20/10/5/2/random (≈ 70 % switch); up after 40; back at −10 points; stretch from S3; stretch 1 in 10; early stretch rule; no repeat of last 3 (guide:1136–1154) | model.js:54–74 (`mix`, `select.avoid`, `weak`, `stages`, `session`) |
| Levels at g + (1 − g)·0.75, 95 % ranges, grades = tenths = Path stage bands (guide:1140; game.js:316, 468) | model.js:50–51 (`levelRef`, `z`); estimator.js:116–123; game.js:73–80; modes.js:707–710 |
| Path: 10 items, weight 15 %, 80 % above chance (0.85 / 0.90), rechecks 3/7/14/30/60 then 90 d, hold 70 % (guide:1212–1213; play.js:3047) | model.js `path` (`decay 0.85`, `gateK 0.80`, `recheckDays`, `holdK 0.70`, `minItems 10`) |
| Speed after 60 answers, 85 % above chance, 1.5 × median (guide:1215) | model.js `speed` (`unlockTrials 60`, `fluentK 0.85`, `startFactor 1.5`) |
| Track Standard: 20 trials, 0.05 log₁₀ (≈ 12 %), last 4 reversals; Span 70.7 % (guide:1221–1222) | model.js `staircase.standard` |
| Simulations: 77.7 vs 77.0 %, within 2.4 points, coverage 96.8 / 98.7 / 92.8 %, Path S1 96, S5 53, S10 5 % (guide:1243, 1825) | docs/dev/ENGINE.md:204 (Comfortable −2.4) |
| Per-setting simulation 93.8 % (86.5), 96.0 % (97.3) (guide:1175) | docs/dev/v1.2/progress-sim.md:9, 33 |
| Daily: 8 items, k points, 36, ramp from release, 11-exercise pool, one attempt resumed, share line (README:49; CHANGELOG:42–43; guide:1103, 1272) | daily.js:12–20, 55–60, 184–190; model.js `daily.items 8` |
| Climb: 20 rungs, one spare, three seeded attempts, untimed, same pool, Summit (README:49; guide:1104, 1561; climb.js:112) | game.js:48; climb.js:36–48; modes.js:47–50 (`PACED`: Train, Path, Free play only) |
| Field notes 3 offered / 2 kept; fresh start after 7 days; Reach 14 exercises, 0–1,400; Atlas p < 0.1; within 3 levels; effects ≤ 0.7 s; 22 achievements (guide:1556–1565, 1592) | game.js:43–49, 57, 334; js/ui/game.js:14, 81; achievements.js (22 ids) |
| Weekly goal: 10 answers or 5 min; grace 1 in 4; 2–6, default 3; sessions 10/15/20/30 (home.js:255; guide:240, 1274, 1590) | model.js:106; streak.js:8–9, 35–36; settings.js:20–21 |
| Section: 5 / 15 a part, 30 / 90 items, 20 / 60 min, 40 s an item, idle 5 min, warnings at 5 and 1 min (README:18; library.js:549; section.js:172; guide:1296–1306) | js/engine/section.js:68–69, 101–106; js/ui/section.js:36, 251 |
| Central Point: 7 × 7 dots, half-steps, 4–8 targets, 1 / 0.5 / 0.25 %, credit to 0 at 4 bands, 20 s start, 2.5–30 s, 85 % in time, pace ½ at the deadline, 60 / 33 / 20 % model players (CHANGELOG:10–16; guide:869–889; centralpoint/learn.js) | centralpoint/gen.js:82–111, 544, 552–560 |
| Reckon v2: final turn 30–150°, legs level, ±15° / 20 %, walks back 3–20 m, routes 10–28 m, ≤ 30 s (40 s gentle); motion check-ins 3 then 5 min (CHANGELOG:55–58; guide:124–125, 732, 769) | reckon/gen.js:78–112, 92–93, 298; homing/view.js:25; play.js:60 |
| Every "Difficulty grows with" list in guide ch. 3 (Track 46 steps ≈ 6 %, 0.15–2.0; Rotate; Spin; Fold; Nets; Slice; Views; Orient; Span; Hidden; Homing "three" = `several` n 3; Reckon; Knots 10 steps, untie/tie from 7; the six DAT-style formats and their test-range rows) | registry dump of `dims`/`testRange`; track/gen.js:87; homing/gen.js:116; knots/gen.js:1153 |
| Exercises with a rules card, a strategy card first and a first step done (README:20; CHANGELOG:18–19) | exactly Views, Central Point and the six DAT-style formats (`rules`, `strategyFirst`, `practice[0].assist`) |
| Tutorial "two or three minutes"; Spin "two minutes" | play.js:1655–1664 (Spin 110 s; DAT formats `minutes: 3`) |
| Record format 4, six new trial columns, 26 CSV columns (CHANGELOG:66–67; guide:137, 1865) | store.js:61, 72–88 |
| Off-screen challenges on seven exercises (CHANGELOG:32–33; guide:1379, 1410) | `offscreen` in seven learn.js/layers.js |
| Pattern Memory 3 s, 3 × 3 to 6 × 6, about half filled; Track cue 2 s, up to 12 s | patterns/gen.js:32–34; track/gen.js:87 |
| Scoped shortcut exceptions listed in guide:1755 | dims.js:96–110 (`SCOPED`) |
| Test durations in README/guide (longrun 300 trials, clock ≈ 30 min, sim 200 learners × 60 days) | tests/e2e/longrun.py:2, 25; tests/e2e/clock.py:14; tests/node/sim.mjs:2, 31 |

### Research claims against the notes
Uttal et al. 2013 (206 studies analysed, g 0.47, transfer 0.51 / 0.55, trained task 0.45, delayed 0.44,
controls 0.45, 0.33, 0.56 / 0.39, 4 of 206 after a month; "for at least several weeks" is the note's own
approved summary, A-evidence.md:104): A-evidence.md:13–30, M1-measurement.md:79 (full text). Hawes et al.
2022 (g 0.28, 29 studies, N 3,765, ages 3–20): A-evidence.md:40. Scharfen 2018 (0.33 / 0.50; 0.23 / 0.37),
Schneider 2020 (d ≥ 1.19), Levacher 2022, Hausknecht 2007 (.70 / .24), te Nijenhuis 2007, Sommer & Arendasy
2025 ("can last for years"): R4-test-overlap.md:24–26, 258–278, 538. The nine bets' evidence lines
(Gathercole 2019; Alfieri 2013; Johnson & Mayer 2010; Gagnier 2017; Noel 2020; Stieff 2014; Hegarty 2018;
Bediou 2023): T1-transfer-portfolio.md:79–145, 165–175. Nazareth et al. (r = .50), Wright 2008 (3,132 →
1,480 ms), Burte 2017 ("no control group"), Gilligan-Lee 2023 (N 182), ADA validity .16–.36, no guessing
penalty on the DAT (R3-dat-pat.md:39, 78; D1-pat-formats.md:911), Klatzky 1998, Wiener & Mallot 2006,
Riecke & Wiener 2007, McLaren 2022: present in A-evidence, B-tasks, C-progression, R1, R3, N1 and P1 with
their read levels. Citations inside learn.js are code comments except Fold, Nets and Views (checked above).

### Voice
No section of README, About, the Library, the bet texts or the guide opens with what training cannot do; the
openings lead with what Parallax trains, bets on and measures. "Unclear yet" is always paired with "not the
same as no progress" (README:35; About:78; measure.js:29; guide:1441; plateau words in js/ui/plateau.js:115–119).
Levels carry ranges everywhere they are shown. No promised outcome: a sweep for "will improve/raise/boost",
"makes you", "smarter", "guarantee", "proven" finds only the motion-comfort line ("if it makes you feel
unwell"). The training bridges (Track to Knots) carry one limit each, Span, Reckon and Knots two short ones.

### IQ, index, percentile, norm, brain age
Every occurrence is a negation: README:38; about.js:46, 79; check.js:148; library.js:592; lab.js:310;
guide:183, 1340, 1509, 1575, 1748. No study effect is turned into IQ points anywhere.

### DAT-style
"DAT score(s)" appears only in negations, each with the ADA line beside it (CHANGELOG:129–132;
library.js:579–580; overlap.js:63 with `noteNode`'s legal line; the six bridges; guide:926–930). The marks
say only what a format follows (README:18; library.js:586; section.js:129; settings.js:354–361; guide:900),
each screen with the ADA line except L10. "Closer to the real ones" is about formats, never difficulty;
range tags and notes describe format features (RANGE_NOTE library.js:204–205; guide:915) except L9. No
score forecast: section.js:176, 830; README:18; guide:1320.

### Chimera (rule 1)
The full welcome on the first launch only (welcome.js:356–404, 417–423: "Parallax was built by the Chimera
community on Discord.", Join opens a new tab, the address with Copy, "Continue to Parallax"); later launches
the one-tap card (welcome.js:447–490: the same line, Join, close; never during a session). The link in the
header, More sheet and footer (app.js:362–386, 412–415, 430–431), About (about.js:67–72), the README's first
line, the guide (cover, guide:212, 1605, 2030–2034, back cover), both tutorial end screens (tour.js:116,
play.js:3354, `invite('tutorial')`), every share text with the full https address (share.js:356–378,
`CHIMERA_LINE`; daily.js:184–190 `C.daily.link`); cards draw the short form by design (share.js:40–43). The
invitations (welcome.js:142–154) say nothing more than "built by the Chimera community on Discord" and an
invitation in, at most one per screen and never during a stimulus (welcome.js:163–167).

### Privacy (rule 13)
- Six-consecutive-word scan of every tracked text file at a434e64 and the PDF's text against the private
  brief (normalised words; the brief's text is not reproduced here). In the scope: the fixed Chimera line only
  (README.md:1; CHANGELOG.md:5, 72, 156; about.js:69, 95; welcome.js:7, 67, 144, 153, 374, 477; play.js:1669;
  share.js:42; guide.html:30, 212, 2030, 2038, 2207; the PDF's cover, chapter 2, chapter 12 and back cover),
  which rule 1 requires; guide.html:2056, the ADA's public instruction sheet's title in its reference; and
  play.js:3009, the app's own weeks-in-a-row wording since 1.0, which a question in the brief had quoted. Out
  of the scope, the remaining hits are file paths, exercise-id lists, timestamps and question texts written by
  the lead, plus two short attributed quotations of a public reference article in
  docs/research/v1.1/R1-path-integration.md:86; none is the owner's words.
- No owner name, handle, time zone, place, device or home-folder path in any in-scope text, and none in any
  tracked file outside tools/privacy_check.py's generic container defaults. The repository's own Pages address
  appears only in docs/dev (out of scope). Community members are never named ("a community member pointed
  out", guide:754; CHANGELOG:115).
- PDF metadata: /Author "the Chimera community (https://discord.gg/chmr)", /Title, /Subject "… Version 1.2.0.",
  /Keywords, /Creator tools/build-pdf.py; CreationDate and ModDate D:20261119131605+00'00' (UTC; pdfinfo prints
  them in the container's local zone); no XMP stream; no paths. The 73 figures in docs/shots carry no
  tEXt/iTXt/zTXt/eXIf/tIME chunks; the share-card figure shows no nickname or device detail. guide.html's
  meta author is the Chimera community.
- Exports and cards: settings.js:138, 142 (nickname only; device details off by default) agree with about.js:89,
  README:55 and guide:1867, 1881.

### Licences (rule 12)
LICENSE: MIT, © 2026 the Chimera community, with the third-party list. LICENSE-GUIDE.md: CC BY-SA 4.0 for the
guide's text and figures, README, CHANGELOG and the prose in docs/; code, guide.css and the tools MIT; Plex OFL;
three.js MIT. vendor/LICENSE-three.txt (© 2010–2026) matches About's line; three.min.js's header says MIT;
fonts/OFL.txt is present. dist/Parallax.html's header names MIT, MIT and OFL. guide.html's and guide.css's
headers name CC BY-SA 4.0 for the text. The PDF's copyright page and back cover state CC BY-SA 4.0 (text), MIT
(code), OFL (Plex), MIT (three.js). No GPL, AGPL or non-commercial notice anywhere in js/, css/, tools/,
tests/ or the guide (the only "GPL" hits are inside the word "clippingPlanes" in an untracked test output).

### Texts against each other
README against About: the same Uttal and Hawes lines, the same probe ladder, the same "no IQ, index,
percentile" line; they differ only in About's licence wording (L17). Guide against app: the "right when" lines
(library.js:65–71 = guide:1233–1238), the bets table (bets.js INFO = guide:1396–1404), the add-on line
(bets.js `addonsLine` = guide:1410), the ADA line, the Daily share line and the measurement words agree;
the disagreements are M1, M2, M3, L1, L2, L12, L14.

## Not checked
The app was not run; texts built only at run time from data not in the registry (for example plateau cards
for every change row) were read in code, not on screen. The PDF's filled-in page references were not
verified page by page. Research numbers in the guide's chapter 7 table were spot-checked (each one is present
in a note), not re-derived from the papers.
