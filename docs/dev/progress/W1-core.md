# W1-core progress (lead builder of wave 1)

Owns: see docs/dev/CONTRACT-v1.2.md "File ownership". Requests: docs/dev/v1.2/requests.md.

## Done
- 2026-11-18 15:19 UTC (0f77538): Part 1. docs/dev/CONTRACT-v1.2.md (wave 1), docs/dev/v1.2/requests.md, PENDING lines in index.html
  for rebase.js, pace.js, centralpoint/*, playtest.js and css. Pre-1.2 ranges computed from 196b942 (for rebase.js V11).

- a5482c2: registry fields (starter, dim at, trainVariants, pace, roundScore, bet, 'point'); σ0 1.5; no stretch in the
  first 10 rated answers (Train, Path); est.starter; pace.js; rebase.js (V11 table, stamps rec.scales, store upgrade
  hooks, record format 3); store settings nickname/exportDevice/gentleMotion, exportJSON(opts), pooled(opts),
  exportRule; engine pooled rules; modes.suggest; O15 (folded `a`). Tests: engine-v12 (60), rebase (52), core/engine updated.

## Next (Part 2, in order)
3. pooled.test.mjs (no local day keys, nickname, device, private fields).
4. play.js: teaching template, O6, O8, O52 runner hold, Quick deadline + atDeadline + round score, motion cards,
   playtest events, invite slots, O4, O5 (util.fmtSecs), O7, levelText; progress.js/log.js labels.
5. firstband.test.mjs, sim.mjs coverage, full node suite, browser tests touching the player (pwslot).

## Open problems
- none yet
