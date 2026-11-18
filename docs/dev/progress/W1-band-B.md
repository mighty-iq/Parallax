# W1-band-B progress: the taught first band for Openings, Form, Hole Punch, Missing View

Owns (docs/dev/CONTRACT-v1.2.md): js/ex/{openings,form,patfold,patviews}/*, css/ex/{openings,form,patfold,patviews}.css,
their tests (node, harness_*.py); the marked export blocks at the end of js/ex/fold/gen.js and js/ex/nets/gen.js.
Design source: docs/research/v1.2/D2-first-band.md §3.0, §3.4–3.9, §4. Requests: docs/dev/v1.2/requests.md.

## Plan
1. Read the four exercises (gen, learn, view, tests) and the registry's new fields (W1-core).
2. Per exercise: the band level in front (`at` with Δ, `starter`, version + 1), generator and validator changes,
   shortcut balance on the band's pool, learn.js teaching data (rules, strategyFirst, four practice objects with
   `assist` on Try 1, demo at the band), view: assist drawing, Show-me changes (O53 Openings, Form fold-up,
   Missing View turn-to-side with dotted hidden edges, O52 Watch hold).
3. Node tests (≥ 10 000 seeds incl. the band; shortcut table on the band's pool; demo/practice/foil-kind checks).
4. Harness checks at 360 × 640 through pwslot; fresh-player check by one subagent (note D2 §4).

## Log
- 15:27 UTC: started; read CONTRACT-v1.2, PLAN milestone 1, EXERCISE-GUIDE, note D2 §3.0, §3.4–3.9, §4.
- 15:31 UTC: requests to W1-core (harness `assist` parameter; which surface the fresh-player check plays).
- 15:47 UTC: Openings v2 committed (36ffdf2): band (Δ −1.5), validator, shortcut balance on the band's
  2 016 items, learn data (rules, first card, four Try items with seeds, Try 1 traced), O53 show-me, Watch
  foil tour. Node: 268 checks pass (248 s). Decisions logged.
- 15:53 UTC: Hole Punch v2 committed (39ef838): one-fold band (Δ −1.3), band foil choice, two larger
  panels with faint position dots, twin-ring assist, learn data, Watch tour. Node: 242 checks pass.

- 16:12 UTC: the lead's rule: every time from `date -u`. Corrected my two request stamps (15:45 → 15:31, the
  commit's time) in 1160b26; that commit also carried other builders' pending stamp corrections in the file.
- 16:13 UTC: Form v2 committed (3c82fa4): band (one shade, 2 × 2 foils, Δ −1.5), fold-up show-me (O51),
  lettered-neighbours and half-corner assists. Node: 265 checks pass. Decisions logged (84b5aac).
- 16:40 UTC: card-step captions (R-reader's request) for Openings, Form, Hole Punch (27d76a4).
- 16:45 UTC: Missing View band rebuilt for balance (enumerated boxes, chooser at 1/4 per rule, wide count
  windows above the band); full node run in progress; seeds re-chosen.
- 16:47 UTC: Missing View v2 committed (2df084b): band (Δ −1.6), turn-to-side show-me, Watch hold on dotted
  lines (O52), learn data. Node: 270 checks pass.
- 16:55 UTC: Try 1's assist captions shortened to one line (a6ddae9): Openings' Try 1 now fits 360 × 640.
- 17:00 UTC: Openings' band at Δ −1.6 (W1-core's firstband line: 74.4 % sat on the 74 % bound; now 75.4 %);
  worked examples before the first hard feature (addendum C change 4) in all four learn.js; Form's show-me
  starts at the card's steps, with a half-mark corner step; decisions logged (a8c3100).
- 17:03 UTC: fixes from the 360 × 640 screenshots: Form's fold-up layer shared the class of the pattern's dashed
  fold lines, so the folded faces were drawn dashed (renamed fm-foldup); Missing View's turn covered the
  structure's label (the cover now starts below it). The fresh-player check needs a subagent, which I cannot
  start: brief and driver are ready outside the repository, and the lead has the request.
- 17:05–17:15 UTC: committed Form (265c0fd), Openings (4609419), Hole Punch (574d0e3), Missing View (b746e47);
  answered W1-core's firstband line (c939f8d). Full node suites: 608 checks pass; firstband passes for all four.
- 17:28 UTC: tests/e2e/harness_starter_b.py also runs the app's own Watch, Try, Go for each of the four at
  360 × 640 (rules card, Watch, strategy card, Try 1–4 with the worked example in its place, end screen):
  66 pass. Browser slots were the bottleneck (both held for about half an hour by long-lived servers).
- 17:38 UTC: screenshots of the four worked examples: Form's seed 8 showed its half mark edge-on, so seed 54
  (75a7791, decision cc93265); Openings' turn in show me now runs at the guide's 2–4 s a movement (1.3 s
  a turn plus a hold, was 0.9 s); Missing View's browser check reads the v1.2 step order (the dotted step
  after the turn and the laid drawing).

## Next
- Commit Openings' view and the browser checks once harness_openings and harness_patviews pass.
- The fresh-player check, if the lead starts it: fix what it finds once.

## Open problems
- The fresh-player check (note D2 §4) is not run: no subagent tool in this session. Brief and driver are
  ready outside the repository (named in the handback).
