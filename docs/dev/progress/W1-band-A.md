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

- 16:24 UTC: Painted Cubes view (53856ee): rule figures, Try 1 numbers, show me in the card's three steps.
- 16:40 UTC: Angles view (b38a50e): Try 1 mark and greyed answers, rule figures, elimination show me.
- 16:45 UTC: Views view written (tint scaffold, Try 1 outline frame, rule figures, show me in the card's steps,
  wrong-pick explanations per foil kind); waiting for a browser slot to look at it. E2E: tests/e2e/band_a.py
  (shared band checks) wired into harness_{views,angles,cubes}.py, not run yet.

- 16:52 UTC: Views view committed (65c0dda). That commit lost the trial-picture function (trialState): every
  Views item threw on present until c6b3903 (17:37 UTC), so the Views Watch was skipped and Try ended the
  session in the fresh-player run. Lesson: run the harness before committing a view, not only node tests.
- 17:00–17:30 UTC: fresh-player checks (testers run by the lead, my scratch driver): Painted Cubes
  practice 4/4, scored 5/5; Angles practice 3/4 (a mis-tap), scored 5/5 at 5–7 s; Views stopped
  (the broken Watch, then the driver's 30-minute cap). Driver now takes a browser slot per action,
  no cap (17:39 UTC).
- 17:30–17:41 UTC: fixes from the testers: Watch captions timed for reading in all three (1 s + 0.27 s a
  word, ≤ 8 s); Painted Cubes Try 3 draws its hidden cube dashed (faded step), its reveal numbers it;
  Angles' Watch without degrees, a method in the turned-angles tip; one-line help captions; four
  player items filed to W1-core (requests 17:39 UTC). DECISIONS cdfcf9c.

- 17:59 UTC: browser checks pass: harness_views 158/0, then its starter-band part 24/0 after the help box moved
  into the stage; harness_cubes and harness_angles pass apart from the app-flow step that met the new
  end screen (fixed; the app flow alone 15/0 for both); node 1009/0 (views, angles, cubes, firstband,
  rebase, engine-v12). Commits 22f636a, 156dad0, DECISIONS cdfcf9c and ca2003b.

- 20:40–21:25 UTC: fix round 2 (Views fresh test 4/4 Try, 5/5 scored; W1-core's reveal lines): reveal room kept
  from the start in all three (0 tile moves at 360 × 640, 390 × 844, 1366 × 768, right and wrong answers);
  Views: no cube bars while tracing, seamless whole shaded faces, shading on Try items, Try 3 = right view,
  floor labels kept, arrow short of the faces, tag clear of arrow and labels. d3e0973, d378972, 9d097c0.
  Checks: node 910/0; harness_views 180/0, harness_cubes 217/0, harness_angles 219/0 (with reveal_stable).
  The session restarted at about 21:00 UTC mid-round; edits were intact, checks rerun after it.

- 21:57–22:23 UTC: fix round 3 (Views fresh rerun 4/4, 5/5): Try 4 seed 41 and a fitting tip; outline step with
  dotted cells, no bars; the drawing lands without a flight; shorter top-view arrow; front tip reworded; help
  named without step numbers in all three. 72fe915, 3595651. Checks: node 893/0 and views 415/0;
  harness_cubes 217/0, harness_angles 219/0, harness_views 179/1 then its starter-band part 24/0 after
  the box label fix.

## Next
- none of mine; the trial's own shift at the reveal is with W1-core (requests, 21:24 UTC).

## Open problems
- On the smallest stages Views' FRONT VIEW tag can touch a corner of the structure (no free spot there).
