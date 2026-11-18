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

## Next
- Commit Missing View once its full node run passes; e2e short checks (tests/e2e/harness_starter_b.py) for all
  four through pwslot; look at the screenshots; fresh-player check through the app (W1-core's answer: (b)).
- R-reader change 4 (a second worked example before the first hard feature) waits for W1-core's `example` entry.

## Open problems
- none yet
