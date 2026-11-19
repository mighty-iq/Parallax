# W3-phones: progress log (PLAN milestone 9, phones, data and tooling: part)

Items, in order: O41, O54, O56, O55, O48, O20, O22, O27, O28, O33. Each owner is idle tonight; for these
items W3-phones owns the files they need, and every file touched is listed here.

## Files touched
- tests/e2e/phones.py (new; W3-phones): one part per item (`dial`, ...), run with pwslot.
- css/ex/homing.css (W1-fixes' file; the first-person kit): the circle's words only (O41).

## Done
- 2026-11-19 02:00 UTC, O41: the circle's words (ahead, left, right) in Homing and Reckon are 12 px or more on the
  screen at any circle size: their size in dial units steps with the circle's width (a container query on the
  circle's box: 7.4 units from 220 px, 9.2 from 176 px, 11.9 from 136 px, none under 136 px); before, a tall phone
  of 360 x 700 drew them at 9.7 px and desktop drew left and right at 11.8 px. tests/e2e/phones.py dial: Homing
  and Reckon at 12 sizes (360 x 640 to 1366 x 768, both orientations) 96/0; screenshots looked at (360 x 740,
  1366 x 768).

## Next
O54, O56, O55 (DAT-style solution overlays and Hole Punch's panels), O48, O20, O22, O27, O28, O33.
