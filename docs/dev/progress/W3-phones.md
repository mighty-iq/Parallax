# W3-phones: progress log (PLAN milestone 9, phones, data and tooling: part)

Items, in order: O41, O54, O56, O55, O48, O20, O22, O27, O28, O33. Each owner is idle tonight; for these
items W3-phones owns the files they need, and every file touched is listed here.

## Files touched
- tests/e2e/phones.py (new; W3-phones): one part per item (`dial`, ...), run with pwslot.
- css/ex/homing.css (W1-fixes' file; the first-person kit): the circle's words only (O41).
- js/ex/form/view.js, css/ex/form.css (W1-band-B): the letters on the solids in show me (O54).
- js/ex/cubes/view.js, css/ex/cubes.css (W1-band-A): the hidden cubes' ghosts and badges (O56).
- css/ex/patfold.css (W1-band-B): the panels on tall and sideways phones (O55).
- css/ex/knots.css (B4's v1.1 file): the sideways margins (O48).
- tests/e2e/band_a.py (W1-band-A): reveal_stable and wtg_checks mute wave 2's hooks, as play.py does (both
  timed out in Train for every band-A and band-B exercise since the hooks: a baseline card after the first
  tutorial; harness_cubes 217/0 after, and the same holds for Angles).

## Done
- 2026-11-19 02:00 UTC, O41: the circle's words (ahead, left, right) in Homing and Reckon are 12 px or more on the
  screen at any circle size: their size in dial units steps with the circle's width (a container query on the
  circle's box: 7.4 units from 220 px, 9.2 from 176 px, 11.9 from 136 px, none under 136 px); before, a tall phone
  of 360 x 700 drew them at 9.7 px and desktop drew left and right at 11.8 px. tests/e2e/phones.py dial: Homing
  and Reckon at 12 sizes (360 x 640 to 1366 x 768, both orientations) 96/0; screenshots looked at (360 x 740,
  1366 x 768).

- 2026-11-19 02:20 UTC, O54: Form's See solution letters on the solids carry a halo and no disc, 13-15 px, moved
  clear of each other on thin faces; 3 letters cover 4-6 % of a 360 x 640 solid's box (discs: about 35 %).
- O56: Painted Cubes' hidden cubes drawn with 9 edges (no far corner), lighter dashes, smaller badges (numbers
  15-20 px). phones.py dat 33/0 at 360 x 640, 390 x 844, 1366 x 768; harness_form 138/0; harness_cubes 217/0.
- O55: Hole Punch panels 171 px for 3 panels at 390 x 844 (were 111); sideways 180/116/119 px (were 0/0/84) and
  the item fits (it scrolled); show me's large sheet 270 px sideways (was 0). 360 x 640 unchanged (88-112 px).
  phones.py holes 48/0; harness_patfold 228/0.
- O48: Knots plate measured 318 / 303 / 288 px at 844 x 390 / 667 x 375 / 740 x 360; now 330 / 310 / 300
  (4 px margins sideways); 328+ upright. phones.py knots.

## Next
O20, O22, O27, O28, O33.
