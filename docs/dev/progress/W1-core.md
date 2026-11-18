# W1-core progress (lead builder of wave 1)

Owns: see docs/dev/CONTRACT-v1.2.md "File ownership". Requests: docs/dev/v1.2/requests.md.

## Done (commits on build)
- 0f77538 (15:19 UTC): Part 1. docs/dev/CONTRACT-v1.2.md (wave 1), docs/dev/v1.2/requests.md, PENDING index lines.
- a5482c2, 78e01bc: registry fields (starter/starters, dim at, trainVariants, pace, roundScore, bet, 'point'); σ0 1.5;
  est.starter; pace.js; rebase.js (V11, rec.scales stamps, store upgrade hooks, record format 3); settings nickname,
  exportDevice, gentleMotion; exportJSON(opts), pooled(opts), exportRule; engine pooled rules; modes.suggest; O15.
- 9263dff: early stretch items move one setting only (kind stretch1, aimed at g + (1 − g)·0.65): with no early stretch
  Painted Cubes' strong beginners reached the old floor only at item 12 (median).
- 899e55a … a19ebeb: play.js (teaching template, worked examples, Try deadlines, ctx.playCmd, O4, O5, O6, O7, O8, O52,
  Quick deadline hand-in and round scores, motion cards, playtest events, invite slots, level text, note button in
  pause sheets); progress.js/log.js labels; util.fmtSecs; harness (assist, setAssist, rules card, gentle, point,
  hold steps, playCmd); fit.py taps the template's cards.
- Tests: engine-v12, rebase, pooled, firstband (new); core/engine updated; play.py run_v12; flows/play/clock follow
  the one-tap card, the full Discord link and the one time format; clock.py paces quick answers (f2e1435).
- b78e08b: Watch, Try, Go tools 44 px; Parts reads "Hide parts" and its list ends with Close on phones; clock.py
  rounds like Math.round.
- a9ced74 and the next commit (lead's fresh-player findings, 17:20–18:30 UTC): Watch captions wait for Next (Enter,
  or a tap on the figure) with an Auto-play switch kept in rec.ui.autoplay; captions during motion keep 3 s and the
  motion ends with a Next; a tap in the gap between answer tiles answers nothing (pointerdown's point checked); the
  tutorial's Go step shows as a step (stepper kept, screen opens at its top); the title row's meta shortens to fit;
  on phones the reading strip is pinned to the bottom after an answer and a show-me after an answer has Next as its
  bar's last button; card screens open at the stepper; Try items keep the strip's room and the stepper scrolls away
  first; the reveal never scrolls the Pause row off. play.py run_captions (11 checks). Requests to band-A/B: the
  reveal's verdict line and tags move the tiles 30–47 px; Openings' options end under the strip at 390 × 844.
- ENGINE.md §18; DECISIONS lines; requests answered (band-A, band-B, W1-rules, W1-central, R-reader).

- c4fc1a2, 2eab603, c7cff8b (18:45–19:30 UTC): Try items keep the strip's room without scrolling the stepper away first
  (fit.py at 360 × 640); a view's own board tap is not a second Next; a backup's missing private field (the playtest
  log) is no repair on import (the long run's re-import check).

- 19:45 UTC: on a short phone (≤ 700 px tall) the Your turn strip has two rows (word, buttons): fit.py 360 × 640 for
  Homing, Reckon, Openings, Cubes, Angles, Views, Form, Missing View, Rotate 21/22 (Hole Punch's worked example
  item is 590 px tall: request to band-B).

## Verified (final round, 18:28–19:45 UTC)
- node: full suite 4760/4760 (38 files, 18:28 code); after c7cff8b pooled, core, store, rebase, engine 1258/1258.
- browser: play.py 138/0 (incl. run_captions 11/11; rerun 19:38 138/0), flows 73/0, clock.py full 74/0, twotabs
  10/0, fit.py all sizes 217/5 (19:36, before the two-row strip; the 5 at 360 × 640 then re-checked); the Go screen,
  the answer-gap taps, real Watch demos tapped through (Angles, Cubes, Views: no caption changes without a tap;
  Reckon: only during motion, ≥ 3.02 s) by probes in /tmp; long run (100 per mode) desktop: train, path, speed,
  threshold, free, daily, check clean but the backup re-import (fixed in c7cff8b).

## Verified (earlier)
- node: full suite (16:05 UTC code) 4741/4745: firstband cubes reach (fixed by stretch1 since), knots CPU timing
  under load (22 ms vs 20), patviews learn ×2 (band-B in progress). Latest code: core, engine*, rebase, pooled,
  firstband (all seven bands: A=0 70–80 %, reach by item 4–9), section, chimera, playtest, overlap: 1801/1801.
- sim.mjs 200 learners: Balanced +0.7, coverage 96.8 %; misspec 92.8 %; Path 98.7 %; all hard checks.
- browser: play.py v12 24/24, review 22/22, full play 123/124 before the card fix; flows 71/73 (Daily link expectation
  fixed; Hole Punch starter PHRASE requested from W1-rules); twotabs 10/10; clock 26/28 before the pacing fix.

## Open
- Openings' A = 0 sits at 74.4 % against the 74–84 % bound (band-B's Δ); Angles 71.8 % and Hole Punch 70.3 % pass (≥ 66).
