# W1-band-A progress: the taught first band for Views, Angles and Painted Cubes

Owns (docs/dev/CONTRACT-v1.2.md): js/ex/{views,angles,cubes}/*, css/ex/{views,angles,cubes}.css, their tests
(tests/node/{views,angles,cubes}.test.mjs, tests/e2e/harness_{views,angles,cubes}.py). views/gen.js's export block
stays non-breaking for Missing View. Design source: docs/research/v1.2/D2-first-band.md §3.0–3.3, §3.8–3.9, §4.

## Plan
1. Spikes (scratch, outside the repository): band generators and shortcut solvers on the band's own pool.
2. gen.js per exercise: band level(s) in front (`at` / custom difficulty with Δ), `starter`, version 1 → 2,
   generator and independent-validator changes.
3. Node tests: ≥ 10 000 seeds incl. the band; shortcuts on the band's pool; θ = 0 check at the pre-1.2 floor;
   demo at the band; practice band, band, level 0, first hard feature; Try foil kinds ⊆ Watch foil kinds.
4. learn.js: rules (with figures), strategyFirst, four practice objects (Try 1 `assist`), tips, demo at the band.
5. view.js: assist drawing, drawRule, Show-me changes (note D2 §3.1–3.3), Views' band tint.
6. Harness checks at 360 × 640 (pwslot); fresh-player check by one subagent (note D2 §4); fix once.

## Log
- 15:33 UTC: started; read CLAUDE.md, CONTRACT-v1.2, PLAN milestone 1, EXERCISE-GUIDE, note D2 §2–§4, the three
  exercises' code and tests, registry (a5482c2). Requests filed (requests.md 15:34 lines).

## Next
- Spikes for the three bands.

## Open problems
- Fresh-player surface: the harness has no Watch–Try–Go (W1-band-B asked W1-core at 15:45; I joined).
