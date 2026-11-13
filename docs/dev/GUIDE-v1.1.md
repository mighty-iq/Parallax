# GUIDE v1.1: what the guide (docs/guide/guide.html → docs/Parallax-Guide.pdf) needs for 1.1

Written by the lead on 13 Nov while the builders finish; the guide writer starts after B1–B4 and B6 are done, so every number comes from the final code. Sources: docs/research/v1.1/ (R1–R4, I1, I2) and the code; never from memory. Wording: Parallax's CLAUDE.md rule 2 (honesty) and R3 §6 (DAT wording, the ADA line).

## New or changed pages
1. Cover and contents: "Parallax 1.1.0"; contents list the new pages.
2. What's new in 1.1 (one page, after the contents): one active-time clock; phones (items fit a 360×640 screen, Homing by touch); Reckon; Knots; six DAT-style formats with Section practice; test-overlap notes and "Taking a test soon?".
3. Ch 02 Quick start, "On a phone, and sharing": the Help button (goal and tips behind it on phones), turning the phone mid-item voids the trial, storage on iOS and in-app browsers (back up), Web Share where available.
4. Ch 03 Exercises:
   - EX-11 Homing card: now the landmark-aided stage before Reckon; touch controls; speeds (≤ 2 m/s, ≤ 45°/s); no "larger screens" note.
   - EX-12 Reckon card (R1 §8): dead reckoning with no fixes; point home or walk home; error, drift and bias feedback; why no landmarks (the community member's point, in our words; no names).
   - EX-13 Knots card (R2): pull / untie / tie / link (mirror if built); how items are proved (simplify, determinant, Jones polynomial); the three moves in plain words.
   - DAT-style formats (one spread): EX-14 Openings, EX-15 Missing View, EX-16 Angles, EX-17 Hole Punch, EX-18 Painted Cubes, EX-19 Form; opt-in "DAT-style focus"; the ADA line; no score claims; Angles is perceptual-judgement practice.
   - Ability codes table: add LE (Angles) if it is new to the guide.
5. Ch 04 Modes: Section practice (mini 30 items / 20 min, full 90 / 60, 40 s per item, review at the end, alternate forms, no rating change); the active-time clock (what stops it: pause, sheets, hidden tab, 60 s idle) and how sessions end on active time.
6. Ch 05 Transfer: Reckon's bet (path integration without fixes; error minimisation) tagged like the other exercises; Angles → Level probe note (compare with care).
7. Ch 08 Honest limits and test hygiene: the test-overlap notes, the one-tap Check question, the helper; practice-effect sizes from R4 (0.33 SD retest, about 1 SD when a puzzle type's rules are taught) with references.
8. Ch 07 research table and References: R1–R4 sources actually used in the app's texts and the guide (read levels as in the notes).

## Figures (tools/shots.py → docs/shots/)
Reckon (point and return, phone), Knots (pull and untie), each DAT-style format (phone or desktop), Section review, Homing on a phone, the Help button on a phone item, About "Test hygiene".

## Checks
tools/build-pdf.py page bounds (28–40) will need raising; every external link clickable; claims-vs-code review of the guide before release.
