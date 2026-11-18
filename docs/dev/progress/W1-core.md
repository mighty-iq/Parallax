# W1-core progress (lead builder of wave 1)

Owns: see docs/dev/CONTRACT-v1.2.md "File ownership". Requests: docs/dev/v1.2/requests.md.

## Done (commits on build)
- 0f77538 (15:19 UTC): Part 1. docs/dev/CONTRACT-v1.2.md (wave 1), docs/dev/v1.2/requests.md, PENDING index lines.
- a5482c2: registry fields (starter/starters, dim at, trainVariants, pace, roundScore, bet, 'point'); σ0 1.5; no
  stretch among the first 10 rated answers (Train, Path); est.starter; pace.js; rebase.js (V11, rec.scales stamps,
  store upgrade hooks, record format 3); settings nickname/exportDevice/gentleMotion; exportJSON(opts), pooled(opts),
  exportRule; engine pooled rules; modes.suggest; O15. Tests engine-v12, rebase; core/engine updated.
- 78e01bc: pooled.test.mjs (export privacy).
- 899e55a, f39f0fc, 19d311c, 6e45411: play.js (teaching template, O4, O5, O6, O7, O8, O52 runner, Quick deadline
  hand-in and round scores, motion cards, playtest events, invite slots, level text, note button in pause sheets);
  progress.js/log.js labels; util.fmtSecs; harness (assist, setAssist, rules card, gentle, point, hold steps);
  firstband.test.mjs; play.py run_v12 and the one-tap card.
- 371d61f ENGINE.md §18; 9dd5d49 DECISIONS lines.
- Requests answered: band-B (harness assist; fresh-player surface = the app), band-A (rules card, starter list),
  W1-rules (share link, invites, note button).

## Verified
- node: engine, engine-v12, rebase, pooled, core, firstband (Openings' band in: A=0 74.9 %, +1.75 reaches the old floor
  at item 8; the other six pending), section.
- sim.mjs --learners 200 (12 min): Balanced +0.6 points, coverage 96.7 %; misspec 92.9 % (1.1: 92.2); all hard checks.
- browser: play.py v12 21/21. Full play/flows/clock/twotabs/longrun and the full node suite: running.

## Open
- firstband (a)–(c) become real as each band lands (they report "pending" until then).
- The first full play.py run had 4 failures: 3 from another builder's half-written file at that moment (DEMO_SEED), 1 the
  pop-up check (now follows the one-tap card).
