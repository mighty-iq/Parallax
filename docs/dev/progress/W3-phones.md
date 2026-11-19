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
- js/ui/progress.js, css/screens.css, tests/e2e/screens.py (O20); js/ui/play.js, js/ui/settings.js (O22).
- tests/e2e/fit.py (W2-core; O27), tests/e2e/section.py (O28).
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

- 02:25 UTC, O20: Progress in tabs on phones (phones.py progress 51/0; screens.py 374/0 with its text checks
  reading every section). O22: Confirm taps (phones.py taps 15/0).
- 02:36 UTC, O27: fit.py's Watch and "Your turn" checks measure at once and again once the page stops scrolling
  (settle): openings 21/21, patfold 17/17, homing 16/16 at 360 x 640; patfold and knots pass at 844 x 390 and
  390 x 844 (the open 844 x 390 failure is gone with O55). O28: section.py sideways (844 x 390, 740 x 360) 14/0;
  at 740 x 360 the part card's Start ends 11 px under the screen (a scroll brings it up; noted, not fixed).

## Found, not mine (for the lead)
- fit.py at 360 x 640: Fold's draw-the-answer items put Clear and Check below the screen (lowest 656-755 of 640;
  W2-bets' variant), and Fold's Watch caption covers its item (fold 18/31).
- Hole Punch's Watch at 360 x 640 (seen once before the settle fix): the floating Pause button covers the end of
  the stem's first line.

## Next
O33.
