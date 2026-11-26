# RV-guide-1.2: last independent check of the guide and release texts

Reviewed 2026-11-26, finished 15:13 UTC, by a reviewer who built none of it and wrote none of its texts.
Snapshot: release candidate 1, commit b228b60, read-only. Scope: `git diff a434e64 b228b60` of docs/guide/guide.html,
README.md and CHANGELOG.md, the built PDF (docs/Parallax-Guide.pdf, 57 pages, built 14:56 UTC at a029c4d), and the
earlier review RV-claims-1.2.md (M1 to M5). Rules applied: CLAUDE.md rules 1, 2, 3, 10, 11, 12, 13.
Guide line numbers are lines of docs/guide/guide.html at b228b60.

**Counts: high 0, medium 2, low 6.** RV-claims-1.2 M1 to M5 are all fixed (see the end).

## Findings

### Medium

**M1. The guide's list of scoped shortcut exceptions is out of date: Hole Punch has 16 scoped cells, not "ten
combinations", and Missing View's nine "the middle" cells are not named.**
- Text: guide.html:1757 "ten combinations of two or three diagonal or mixed folds in Hole Punch, where the creases
  cross the sheet's centre and the true holes gather there, each held at its measured share plus 3 points";
  CHANGELOG.md:64 "with ten combinations of diagonal or mixed folds in Hole Punch kept as scoped exceptions for now"
  and CHANGELOG.md:62-64 "held near chance in Hole Punch, Missing View, Openings, Form ...". The guide's list has no
  Missing View entry.
- Code: tests/node/patfold.test.mjs:270-291 `SCOPED_CELLS` holds 16 cells: the ten of 22 Nov plus six of 26 Nov in
  the one-fold band (half fold with differing counts: "least one-coloured sheet" 34.9 % at three idle levels;
  corner fold with all sheets at the key's count: "most spread out" 37.0 % and 36.9 %; three half folds: "nearest
  the centre" 34.8 %). DECISIONS.md:447 (26 Nov) says so, and gives a different reason for these six (a half fold
  sends a cell to the other checkerboard colour; a corner fold mirrors the punch). DECISIONS.md:446 (26 Nov): Missing
  View keeps "the middle" as a scoped exception in nine cells (37 % to 50 % against chance 25 %, each bounded at its
  measured share plus 3 points; tests/node/patviews.test.mjs).
- Why it matters: rule 5 says a scoped exception needs a DECISIONS line and a per-level test; the guide's text on
  "within 10 points of chance, level by level" plus a closed list of exceptions is the claim a reader will rely on.
  Both decisions landed in the last commits (29356b9) after the guide text was written.
- Rewrite (guide.html:1757, the Hole Punch clause): "sixteen cells in Hole Punch, each held at its measured share plus
  3 points: ten full combinations of two or three diagonal or mixed folds, where the creases cross the sheet's centre
  and the true holes gather there, and six in the one-fold band, where a half fold always makes the true pair of holes
  two-coloured and a corner fold tends to make it the most spread out;" and add "Missing View's pick of 'the middle'
  option in nine cells, 37 to 50 % against 25 % by chance;" before "Painted Cubes' ...". CHANGELOG.md:60-65: "... held
  near chance in Openings, Form, Angles (version 4) and Painted Cubes (version 4), and in Hole Punch and Missing View
  apart from scoped cells (sixteen in Hole Punch, nine in Missing View) that are bounded by test and planned for 1.3."
  Also the sentence at guide.html:1756 "(Views is tested over its levels together ...)" can stay.

**M2. "No review found that more hours helped more" is a universal claim, and the guide's own notes contradict it.**
- Text: guide.html:242 (twice more at 1382 and 1660): "Programmes that worked in studies ran about 10 to 20 hours
  in all (12 in Miller & Halpern, 2013), and no review found that more hours helped more (Hawes et al., 2022)".
- Notes: docs/research/v1.0/A-evidence.md:118 (dose row): "No reliable dose-response. Uttal could not test it; Hawes
  n.s.; Bediou 2018 slope vanished once lab was controlled; Bediou 2023 n.s. Di & Zheng: 3-6-month VR/AR programmes
  larger" (A-evidence.md:41, CI not retrieved). So one cited review (Hawes) found dosage not significant; one could
  not test it; one found longer programmes larger. The 12 h for Miller & Halpern matches D2-first-band.md:245.
- Rewrite (all three places): "... and the review that tested dose (Hawes et al., 2022) found no gain from more
  hours; more than three sessions a week added nothing in older adults (Lampit et al., 2014)." The table cell at 1660:
  "dose: n.s. in Hawes 2022; older adults: more than 3 sessions a week no extra benefit".

### Low

**L1. RV-claims-1.2 L12 is still open: "a ring only for a right stretch item".** guide.html:1541 "a ring only for a
right stretch item, a stamp only for a new grade"; guide.html:1567 "a ring on a right stretch answer". js/ui/game.js:
528-531 and 560-561: at Strong a ring marks every right answer (`stretch || celebrate() === 'strong'`).
Rewrite: "a ring for a right stretch item (at Strong, for every right answer), a stamp only for a new grade."

**L2. "No part shows an item twice" (guide.html:1304; CHANGELOG.md:67) is stronger than the code.**
js/engine/section.js:186-209 gives every item its own seed (never repeated in a part) and redraws a repeated stem
only where the exercise's `lib.fewStems` says a setting allows few (Hole Punch, Openings' starter level, Form's
wedges and pyramids, Missing View's cube stacks); elsewhere two seeds can give the same-looking item.
Rewrite: "and a part never repeats an item, nor a drawing where a setting has few."

**L3. README.md:33 "none comes back across your checks" has no qualifier; the guide has one.** README:
"Items are generated, and none comes back across your checks." Code: js/engine/assess.js:584 `REPEAT_TRIES = 8`,
`PAST_ROWS = 60`, and assess.js:610-625: the generator redraws up to 8 times against the last 60 rows of the same
settings; the guide (guide.html:1434, "until a probe's pool is used up") is closer. CHANGELOG.md:45 "No check
item comes back across your checks until a pool is used up" is right. Rewrite README: "Items are generated, and a
check does not repeat one you have met until a task's pool is used up."

**L4. The Vater et al. (2021) reference title was edited.** guide.html reference list: "A critical systematic review of
[a commercial 3D multiple-object tracking] perceptual-cognitive training tool." This keeps the commercial name out
(rule 9) but alters a bibliographic title in brackets that a reader cannot match to the DOI. Suggest: "A critical
systematic review of a 3D multiple-object tracking perceptual-cognitive training tool" (no brackets; the DOI and
journal stay as they are).

**L5. CHANGELOG.md's list of new versions is partial.** CHANGELOG.md:102 "trials of rebuilt exercises and probes under
new versions (Views 3, Angles 4, Painted Cubes 4; Mechanisms 3, Motion Graphs 2, Other Way Round 2)". The registry also
holds Missing View 3 (js/ex/patviews/gen.js:1956), Cube Match 2 (cubematch/gen.js:513) and Pattern Memory 2
(patterns/gen.js:249), which the guide names as upgraded. All six listed values match the code
(views:1105, angles:549, cubes:966, mechanisms:828, motiongraphs:200, otherway:835). Add "Missing View 3, Cube Match 2,
Pattern Memory 2".

**L6. The guide says View Match is "unchanged" (guide.html:139) and also that checks leave out some of its
settings.** Both are true (items stay version 1: js/ex/viewmatch/gen.js:44-48, `checkCell` at :579), but a reader may
take them as a contradiction. Rewrite: "View Match, Level and Word Links keep their items (View Match's checks leave
out a few settings)."

## What I checked and found right

Numbers and behaviours, each against the code (guide text in the diff a434e64..b228b60):
- Motion comfort: first check-in 3 min, then every 5, a new player (under 10 min of earlier motion) offered the end
  of the session at 5 min: js/ui/play.js:60 `MOTION = { first: 180000, every: 300000, newLimit: 300000, newPlayer:
  600000 }`, used at :2439. Text fixed from "ends" to "offers", as the code does.
- After an answer: Space goes on to the next item, Enter too after a scored answer, → steps, R replays, Esc closes
  (play.js:1581, 1591-1612). In a Watch demo Space pauses (play.js:1602); the guide's sentence is about solutions.
- "Still settling" above a 30-level range: play.js:191-194 `SETTLING_WIDTH = 30`. Keep going for train, path, speed,
  free: play.js:64-65, 3271-3279. Sessions saved when the page is hidden and recovered once at boot: play.js:2349-2358,
  app.js:815-816.
- Daily: 36 points, item k worth k (daily.js:18-19, 67); epoch 2 from 2026-11-26 (daily.js:62-66); answers written
  through per item is described in CHANGELOG and matches DECISIONS.
- Section practice: test-range settings only, 35 to 65 % band within them, starter levels out (section.js:138-160);
  mini 5 per part and full 15 per part, 40 s per item (section.js:10, 68).
- Service worker and install row: sw.js:1-33 (own files only, never the record, from a launch plus CHECK_DELAY 3000 ms,
  new copy runs at the next launch, kept only when px-version agrees: index.html meta and js/core/px.js '1.2.0'),
  registration only from the multi-file app at the top of a secure page; Settings row js/ui/settings.js:256, app.js:938.
- Community export: screen size only with device details (store.js:917-925); without them, sessions keep only
  display 'small'/'large' and input (store.js:323-325, lab.js:130).
- Central Point: Near miss when the round score is above 0 on a miss that is not a time-out (play.js:1157-1162); credit
  1 inside the band and 0 at four times it (centralpoint/gen.js:544); pace factor 1 down to 1/2 (gen.js:556-565); Move
  button with half-dot arrows (centralpoint/view.js:85-89).
- Reckon: Walk and Back toggle on a tap under 250 ms and hold otherwise (reckon/view.js:14-15, 36); the "top of the
  circle is the way you face now" line (homing/learn.js:94, 136).
- Track: the tutorial teaches following the few unmarked spheres; the cue line offers it (track/learn.js:43, 87-88).
  Spin: no same-or-mirror turn within 6 degrees of a quarter turn (spin/gen.js:20, 306). Nets: "shaded square" in
  How to play and tips (nets/learn.js:12-44).
- Probes: Pattern Memory then Cube Match first in a full check (assess.js:68-71); Pattern Memory aims at an exact
  pattern 35 % of the time (measure.js:476), so "a third to a half exact" fits; the meter's "+1 point ... of the way from
  chance to certain" matches measure.js:737 (RV-claims L16). Off-screen challenges on seven exercises (fold, nets, views,
  centralpoint, slice, knots, orient).
- Format 4 record, forward-only level conversion, two builds aligned before a merge: rebase.js:16-36, 141.
- Day 1 "about 35 min" is the sum of a two-minute tutorial, Baseline 1 (46 items, 11.5 minutes: assess.js:66), the welcome
  and a 20-minute session; Day 2 "about 30 min" fits a second baseline plus 20 minutes (RV-claims L6 fixed).
- Voice: no promised outcome, IQ, norm or score forecast in the changed text; no section opens with a limit; "DAT
  score(s)" appears once in the guide (guide.html:928) in a negation with the ADA line beside it, and nowhere in README
  or CHANGELOG; no commercial trainer's name in the guide, README, CHANGELOG or js/ (grep). Track's Evidence now leads
  with the finding and holds one limit (L15 of RV-claims fixed), and Views' Evidence no longer stacks caveats.
- Licences and privacy (rules 12, 13): the guide and CHANGELOG sections say CC BY-SA 4.0 for the guide, figures, README
  and CHANGELOG; no names, emails, paths or links to private pages in the three files' diff.
- PDF metadata (pypdf): Title "Parallax: user guide"; Author "the Chimera community (https://discord.gg/chmr)"; Subject
  "... Version 1.2.0."; Creator tools/build-pdf.py (Chromium via Playwright); CreationDate and ModDate
  D:20261126145622+00'00' (UTC). No other personal fields. The PDF text matches guide.html for the changed passages
  (colophon "Version 1.2.0, November 2026"; "Near miss"; "ten combinations", which M1 will change); a paragraph-start
  match of guide.html against the PDF text finds only table-of-contents and cover differences. Rebuild the PDF after
  M1, M2 and L1 to L6 (`tests/e2e/pwslot.sh python3 tools/build-pdf.py`).

RV-claims-1.2 findings, status at b228b60: M1 fixed (guide.html:411, the Spin Time row, 1091 now say Train is untimed until Speed
opens). M2 fixed (guide.html:1304, test-range settings). M3 fixed (guide.html:2046, "Version 1.2.0, November 2026").
M4 fixed (js/ui/library.js:699 pattern now includes "not been tested"). M5 fixed (the bridges of Openings, Missing
View, Form, Hole Punch, Painted Cubes and Angles each carry one limit; openings/learn.js:102, patviews/learn.js:130,
form/learn.js:123, patfold:104, cubes:134, angles:105). Of the lows, L1, L4, L5, L6, L11, L13, L14, L15 and L16 are fixed
in the three files; L12 is still open (L1 above).
