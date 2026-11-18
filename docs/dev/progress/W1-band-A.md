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

- 15:50 UTC: Painted Cubes v2 (3f6524a): flat level and a small level (4–6 cubes, see DECISIONS), measured count
  ranges (KRANGE_FLAT, KRANGE_SMALL, NAT_FLAT), band-pool shortcuts ≤ 26.3 %; teaching data.
- 15:52 UTC: Angles v2 (d81b0c3): 9° near-right band, band-weighted arm search, band pool worst cue 31.8 %.
- 16:04 UTC: Views v2 (f58c9a2): toview starter level (3–4 cubes, ≤ 2 high, no mirror foils), extra stem-blind
  solvers balanced on the band (worst 31.0 %); teaching data with a fourth card "Outline first".
- 16:07 UTC: R-reader's requests: Painted Cubes Try 3/4 reordered, Angles texts label-neutral (f21aa95).
- 16:12 UTC: Painted Cubes offsets flat −0.85 / small −0.7 (floor −3.85): firstband passes for all three
  (views 78.0 % / item 8, cubes 76.8 % / 8, angles 72.4 % / 6).

## Next
- view.js for the three: drawRule figures, ctx.assist (Try 1's step done), Show-me per note D2 §3.1–3.3 with
  step-numbered captions (R-reader's request), Views' band tint. Then harness checks at 360 × 640 (pwslot) and
  the fresh-player check through the app (W1-core: route (b)).

## Open problems
- none
