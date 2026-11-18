# W1-central progress: Central Point (EX-20, id `centralpoint`; PLAN.md milestone 8, first bullet)

Updated 2026-11-18 16:13 UTC.

Owns: js/ex/centralpoint/ (gen.js, learn.js, view.js), css/ex/centralpoint.css, tests/node/centralpoint.test.mjs,
tests/e2e/harness_centralpoint.py. Shared needs: docs/dev/v1.2/requests.md. Design source: docs/research/v1.2/C1-central-point.md
and docs/research/v1.2/spikes/C1/. Interfaces: docs/dev/CONTRACT-v1.2.md A (point answers, trainVariants, pace, roundScore, bet),
D (rules, strategyFirst, practice objects with assist and seed, drawRule), E (atDeadline, the round score in the verdict).

## Done
- gen.js: 7 x 7 target dots, 13 x 13 half-step answers, response { x, y }; dims targets 4-8 x band 1 / 0.5 / 0.25 %; strict policy
  (trap >= 1 dot, no target and none of the eleven picks in the band; ties and half steps count both ways; band-edge margin; band
  in one piece). Generator: the mixture, cheapest tests first (vertex median, Newton from the average for the trap, lattice by a
  sqrt table, picks, margin), rescue through the lattice when Newton does not settle; fallback per cell. Independent validator
  (reverse-order sums, Welzl circle, gift-wrapped hull, selection medians, own Weiszfeld, cross-checks). Scorer: band, credit,
  value = excess %, value2 = correction ratio. Forms quick (trainVariants, pace 15 s, 2.5-30 s, step 0.03, 85 % in time) and
  exact (0.6 logit easier). roundScore = 100 x credit x pace (1 to 1/2; 1/4 of the credit for a marker left at the deadline).
  Tutorial tasks watch (trap >= 3/4 dot), kite, group (trap >= 1), loose (strict, 2 %, 20 s in quick).
- learn.js: goal(s), rules card (4 rules with pictures), parts, Watch seed 261 for both forms, Try kite seed 2 (assist
  'diagonals'), group seed 15, loose seed 14, strategyFirst 'switch' ("First count, then balance"), cards "Balance the pulls"
  and "Count the sides", tips, check-in wording, captions, bridge with its limitation line.
- view.js + css: SVG plate (geometry in half-steps under scale(20); labels unscale so font sizes stay 12-14 px), quick tap/tap,
  exact drag + 44 px nudges + keys, Confirm, atDeadline, reveal (lines, lengths, best ring, cross at the continuous best spot,
  band points, totals, a greedy label placer), Map (band bold over a pale fill, +2/+5/+10 %, labelled), Why? (equal pulls, head
  to tail, the leftover pull, the walk to the best spot, the farthest target slides, best spot stays), the Watch (count column and
  row, pulls, and once the average: the only WATCH-ONLY block), drawRule pictures, phone sizing from --pl-avail.
- Tests: node 117+ checks (10 000 items per rated cell in the full run: 92 s); harness_centralpoint.py 151 checks (desktop,
  360 x 640, 412 x 880, light and dark, srcdoc, slow Why?). index.html: my four lines activated (sync-index --only).
- DECISIONS: four W1-central lines (item policy, difficulty, Quick deadline and round score, partial-skill guesses).
- Requests filed (15:52 UTC): overlap row and helper line (W1-rules), ctx.playCmd for a tap that steps a show-me (W1-core), Try
  item deadline (W1-core), guide section (W1-rules).

## Full run, 10 000 items per rated cell (quick), 18 Nov
- Chance by cell 0.70-1.76 %; every first-order pick 0 % by construction; second-order guesses within chance + 10 (worst: ring 2
  round the average 9.8 % at 8 targets and 1 %, chance 1.5 %; fixed point at most 6.8 %); dense group at 1.5 / 2 dots <= 2.6 %.
- Partial skill (reported): one Weiszfeld step 12-16 % at 1 %, <= 3.5 % tighter; the average moved one dot towards the densest
  group 28-73 %.
- CPU p95 per item: 0.09-3.14 ms (slowest 8 targets at 1 %: 3.14 ms, about 12.5 ms on a phone 4x slower); no fallbacks.
- Keys between dots 79-95 %; value2 at the key: median 0.97-1.00.

## Difficulty steps (provisional; refit from pooled exports)
base 0; +0.25 logit per extra target; +0.6 per band level; exact -0.6. Span 2.2 per form (the guide asks for 4).

## Open
- fit.py at 360 x 640 and 844 x 390 (running).
- The player hooks for "a tap skips" (ctx.playCmd) and the Try deadline are requests; until then Step / -> and no Try clock.
- For the lead: commit 6a0c3d0 wrote my request lines with a wrong time (the container's local clock, not UTC); 837fc5a fixes it.
  Neither is pushed; folding the two before a push keeps the wrong stamps out of the history.
