# W1-core progress (lead builder of wave 1)

Owns: see docs/dev/CONTRACT-v1.2.md "File ownership". Requests: docs/dev/v1.2/requests.md.

## Done
- 2026-11-18 ~15:40 UTC: Part 1. docs/dev/CONTRACT-v1.2.md (wave 1), docs/dev/v1.2/requests.md, PENDING lines in index.html
  for rebase.js, pace.js, centralpoint/*, playtest.js and css. Pre-1.2 ranges computed from 196b942 (for rebase.js V11).

## Next (Part 2, in order)
1. registry.js: starter, dim `at`, trainVariants, pace, roundScore, bet, answer 'point' (+ tests).
2. engine: σ0 1.5; no stretch in an exercise's first 10 rated answers; est.starter; rebase.js (V11, stamps, store
   upgrade hook, store format 3); pace.js (deadline staircase) + modes hooks; trainVariants filters; modes.suggest; O15.
3. store.js: format 3, upgrade hooks, nickname/exportDevice/gentleMotion settings, exportJSON(opts), pooled(opts),
   exportRule; tests (1.1-shaped saves, pooled export has no local day keys).
4. play.js: teaching template, O6, O8, O52 runner hold, Quick deadline + atDeadline + round score, motion cards,
   playtest events, invite slots, O4, O5 (util.fmtSecs), O7, levelText; progress.js/log.js labels.
5. firstband.test.mjs, sim.mjs coverage, full node suite, browser tests touching the player (pwslot).

## Open problems
- none yet
