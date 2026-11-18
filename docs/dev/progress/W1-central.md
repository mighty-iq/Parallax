# W1-central progress: Central Point (EX-20, id `centralpoint`; PLAN.md milestone 8, first bullet)

Updated 2026-11-18 15:10 UTC.

Owns: js/ex/centralpoint/ (gen.js, learn.js, view.js), css/ex/centralpoint.css, tests/node/centralpoint*.test.mjs.
Shared needs go to docs/dev/v1.2/requests.md (append only). Design source: docs/research/v1.2/C1-central-point.md and its spike
docs/research/v1.2/spikes/C1/.

## Plan
1. gen.js: definition, item model (7 x 7 target dots, 13 x 13 half-step answers), generator (key-first proposals, trap pre-filter),
   independent exhaustive validator with a Weiszfeld cross-check, the eleven shortcut picks, scorer (band, credit, excess, correction ratio).
2. tests/node/centralpoint.test.mjs: 10 000 seeds per cell, shortcut table, p95 generation time per cell, fallbacks, determinism.
3. learn.js: goal, parts, demo (Watch), Try items, tips, strategy cards "Balance the pulls" and "Count the sides", captions, bridge.
4. view.js + css: board (SVG), tap / drag / nudge / keys / Confirm, Quick deadline adapter, reveal (lines, lengths, best spot, contours),
   "Why?" (equal pulls head to tail, farthest target slides out), demo, 360 x 640 layout.
5. Browser check through the harness (pwslot), screenshots desktop and phone.

## Log
- 15:10 UTC: read CLAUDE.md, PLAN.md (milestone 8, Defaults), C1 note §2.5–§9, spike lib, EXERCISE-GUIDE, ARCHITECTURE, registry.
  CONTRACT-v1.2.md not written yet: building against the v1.1 contract.
