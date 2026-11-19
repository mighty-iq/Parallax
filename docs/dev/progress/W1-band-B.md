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

## Fix round after the fresh-player tests (lead's nine findings and W1-core's requests)
- 20:45 UTC: resumed. Form's Watch: 14 captions to 3 (each waits for a tap), its worked example 15 to 3, show me
  from the card's first step. Openings: any face may go in first (rules, card, Watch's first caption), the
  Watch goes in side first, 9 captions to 5, ends on the answer. Missing View 9 to 5; Hole Punch 9 to 7, its
  wrong sheets before the right one. Every demo ends on the answer with the view's caption cleared.
- Reveals on phones: the verdict line read out only, a tag strip under each drawing, Openings, Form and
  Missing View sized to the screen less the reading strip outside the tutorial; Openings three a row on
  phones up to 700 px tall. Probe (Free play, band, 390 × 844 and 360 × 640): tiles move 0 px, no scroll,
  no tag over a drawing, the last tile above the strip.
- Tutorial items (params.task 'tutorial') never come back as rated items: before, 14.6 % of Missing View's and
  6.1 % of Hole Punch's items at the tutorial's settings repeated a tutorial stem; now 0.
- 21:00 UTC: the session server restarted mid-work; background runs rerun.
- 21:13 UTC: Form committed (d2dbb54) and the lead told, for its fresh-player rerun. Decisions f2ebd64;
  request to W2-core for Openings' starter level in the summary line (4d1e983).
- 21:14 UTC: the other three exercises' browser checks and fit.py running.
- 21:19 UTC: Hole Punch (06d0d32), Missing View (e168611), Openings (2759bd1) committed; W1-core's four lines
  answered. Node 635/635 (my four suites, ≥ 10 000 items each, the tutorial-repeat checks included);
  harness_starter_b 66/0 (the app's Watch, Try, Go for all four), harness_form 138, openings 154, patviews
  145, patfold 228; fit.py 360 × 640 and 390 × 844 for my four 20/20. Watch lengths (captions, each a tap;
  timed pace with Auto-play): Form 3 / 14.6 s, Openings 5 / 16.3 s, Missing View 5 / 17.4 s, Hole Punch
  7 / 22.7 s.

## Milestone 8: the DAT-style rebuild toward the real formats (19 Nov)
- 09:35–10:50 UTC: Form version 3 (c29d655, 73adbbf, 83cf4b3, 5bcc8ef): the test's kinds (plain, shaded, half
  shaded), bevelled boxes, L-, T- and U-prisms with real visibility, the net distance and the net-adjacency lure,
  letters A–D and the format's look (Wave 3). Cube nets left out (DECISIONS).
- 11:13 UTC: Openings version 3 (10afcf1): a turn dim (as seen, turned, turned or flipped), a test-range start at
  two features, the plain look. 11:25 UTC: Hole Punch version 3 (3e1ebfb): wrong sheets whose hole count may
  differ, the same-count level kept beyond, the format's look. 11:31 UTC: Missing View lettered (7c0f142).
- 11:39 UTC: "always the same letter" in every per-level shortcut run (6846afc). The key's letter is uniform per
  level in all four (10 000+ items per level, every share within 1 point of chance, smallest p above the
  Bonferroni line; Missing View rerun at version 3 below).
- 12:21 UTC: Missing View phase B step 1 (8135ac4): profile solids built and validated (dormant).

## Next
- Form's fresh-player rerun (the lead's); fix what it finds once.

## Open problems
- none
