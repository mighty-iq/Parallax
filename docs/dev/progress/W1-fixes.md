# W1-fixes progress (wave 1 of v1.2)

Owns (docs/dev/CONTRACT-v1.2.md): js/ex/{homing,reckon}/*, css/ex/{homing,reckon}.css, their tests; js/ui/section.js,
js/engine/section.js, css/section.css, tests/node/section*.test.mjs, tests/e2e/section.py.

Items: O36 motion comfort in Homing and Reckon (note N1 §5.4, §6 #1–5; contract interface F); Section practice O9, O10,
O11; Reckon texts O39, O40. Not in wave 1: Reckon's rated-level changes (final rotations, two-key construction, legs).

## Done (times UTC, from `date -u`)
- ~15:40: read CLAUDE.md, CONTRACT-v1.2.md, PLAN.md milestone 1, deferred-sweep O9–O11, O36, O39, O40, note N1 §5–§6
  and the reviews behind them.
- 15:47–15:49 (89e4463, cf93dfe, 40e5bc4, f84a2aa):
  - O36: `lib.gentle` in js/ex/homing/gen.js (shared with Reckon): rates × 2/3 (1.8 → 1.2 m/s, 45 → 30°/s), 0.6 s
    ramps, one speed per leg, walk back × 2/3, at most 40 s (a common factor ≤ 1.5 for longer routes; 3.8 % of Homing
    and 37.5 % of Reckon routes in the node tests); the views play it when `ctx.gentleMotion`, show a fixation dot at
    the view's centre, report motion to `ctx.addMotion` (route, walk back, Watch demo), carry `gentle` in answerMeta,
    declare `motion: true`; `learn.motionNotice` (a string) and the Comfort part name Gentle motion.
  - O39: Reckon's tutorial items keep `params.task`; task tips first, the walk-back tip before "After each turn".
  - O40: `lib.feedback` (Reckon gen): "under 1 % off" for exact walks, the drift line names the route and the walk
    back and gives the item's own limit per metre, chart axis words and solid/hollow, map label "your answer".
  - O9: Section writes its clock on pagehide / hidden. O10: the finished run kept in rec.section.last; a reload in
    the review reopens it (2 h), later "Open its review" on setup. O11: item numbers j + 1, replacements keep the
    number. Section forms leave starter levels out (W1-band-A's request).
- 16:07 (5c47d63): the habit chart ends at the right with the latest route; browser checks: harness_homing 167/0,
  harness_reckon 89/0 (both full runs, through pwslot), including the new `gentle` and `v12` cases.
- Node: homing 105, reckon 126, section 186 checks pass.

- 16:27–16:55: section.py 116/0 (stand-ins; the new pop-up, O9, O10, O11); answered W1-band-A's and W1-rules' lines;
  the new node checks fail on v1.1 (every new check) and pass now (homing 106, reckon 127, section 186).
- 16:14–16:24 the fresh-player retest (lead-run tester, my brief); fixes after it (a6f88f1, d7a7b7d): Watch captions
  ≥ 3 s and a demo phase line (Homing, Reckon), slower tutorial rungs, "face the same way as at the start", a shorter
  walk-back tip; requests to W1-rules (Practise sheet → Watch, Try, Go) and W1-core (Your turn strip, Replay, Show me
  after right answers). Record: docs/dev/reviews/RV-reckon-retest-v1.2.md.

## In progress
- Nothing. Scored items of the retest were not played (the driver, not the app, stalled); the flow did not change,
  so a rerun is the lead's call. The driver stays running (bounded slot wait).

## Open problems
- Section's kept review is dropped when an exercise's version changes between the run and the reload (by design);
  during this wave versions change under running tests, so section.py can use `SECTION_PARTS=stand-ins`.
