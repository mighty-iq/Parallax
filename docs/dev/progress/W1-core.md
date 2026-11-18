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
- ENGINE.md §18; DECISIONS lines; requests answered (band-A, band-B, W1-rules, W1-central, R-reader).

## Verified
- node: full suite (16:05 UTC code) 4741/4745: firstband cubes reach (fixed by stretch1 since), knots CPU timing
  under load (22 ms vs 20), patviews learn ×2 (band-B in progress). Latest code: core, engine*, rebase, pooled,
  firstband (all seven bands: A=0 70–80 %, reach by item 4–9), section, chimera, playtest, overlap: 1801/1801.
- sim.mjs 200 learners: Balanced +0.7, coverage 96.8 %; misspec 92.8 %; Path 98.7 %; all hard checks.
- browser: play.py v12 24/24, review 22/22, full play 123/124 before the card fix; flows 71/73 (Daily link expectation
  fixed; Hole Punch starter PHRASE requested from W1-rules); twotabs 10/10; clock 26/28 before the pacing fix.

## Open
- Openings' A = 0 sits at 74.4 % against the 74–84 % bound (band-B's Δ); Angles 71.8 % and Hole Punch 70.3 % pass (≥ 66).
