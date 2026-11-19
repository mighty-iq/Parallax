# W3-misc: progress log (v1.2, PLAN milestone 9)

Builder W3-misc. Files: sw.js (new), the registration block in js/ui/app.js, js/engine/dims.js, the tests below.
Times are UTC.

## 2026-11-19 14:05: leading items off the scoped cells (dims.js)
- Found: 22cd8e3 already keeps the lead's own filter (frontier and item) and the fluent zone off E.dims.scoped. Two
  paths still let a leading or fluency item land in a scoped cell: a plateau change ordered after dims (order 20:
  wider mix, variant swap) replaces `o.filter`, and modes' fallback (an empty filter) drops every filter.
- Done: a last pick hook `dims.scoped` (order 90, scopedPick) re-applies the exclusion to the final filter and keeps a
  candidate off the cells (the fallback's steps, taken here off the cells); fluencyPick's bail-out sets `o.kind`
  'easy' too, so the hook reads the item's kind; E.dims.lead() uses the leads' filter.
- Test: tests/node/dims-scoped.test.mjs (29 checks, about 9 s): Train sessions of simulated learners on Nets, Slice,
  Fold, Painted Cubes (PAT focus on) and Homing: 0 of 2,039 leading and 0 of 834 fluency items in a cell; the same
  sessions deal identical items without the hook; under wider mix and a Nets variant swap 0 with the hook, 900
  without it; a later hook that steers leads into the cells still gets none. Cube Match and Pattern Memory are
  probes (no Train).
- Reruns: node dims engine hooks plateau bets wave3 game firstband section trend + dims-scoped: 2,376/0.
  sim-progress --learners 60 --days 60 --profiles even,uneven --conds est --wave2: the scoped gate passes (0 of
  39,168 and 0 of 37,113 leading, 0 fluency); the other gates as reported before (coverage 97.3–97.8 %, uneven
  93.2 % and Track speed 19, the known misses of docs/dev/v1.2/progress-sim.md).
