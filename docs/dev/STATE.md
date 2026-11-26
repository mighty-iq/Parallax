# STATE: Parallax (rewritten at every milestone; under 100 lines)

Updated 2026-11-26 18:15 UTC. **v1.2 is at the release gate:** release candidate 2 (b2b2eed) waits for the owner's checklist and his yes to merge.

## Phase
- **v1.1 is RELEASED** (14 Nov): `main` = b5ead08, GitHub Pages serves 1.1.0.
- **v1.2: Phase 3 (review, fix, release), at the gate.** The approved plan is docs/dev/PLAN.md; deferrals in PLAN-v1.3.md; research in docs/research/v1.2/; the release table is docs/dev/VERIFY-v1.2.md.
  - Owner's answers: every board recommendation; priorities progress > proof > transfer > fun > start > phone > community > PAT; Central Point Quick by default; Climb sounds, new-best sound, Summit; first session = one tutorial, then Baseline 1, then training (19 Nov); the guide figures' history rewritten at the merge (26 Nov).

Owner decisions:
- D1: the standing rules and the game layer came in v1.2. D2: the DAT-style focus is opt-in. D3: closed on 17 Nov (DECISIONS).
- 14 Nov: no Duolingo-style streaks (a standing rule for every tool); the weekly goal keeps its forgiving weeks-in-a-row count.

## Privacy (standing rules, binding since 17 Nov)
- Every push runs tools/privacy_check.py through the pre-push hook (`git config core.hooksPath tools/githooks`; private values in the git-ignored `.privacy.local`, recreated in a new container from the script's header). Commit with `TZ=UTC`, no session-link line, keep `Co-Authored-By`.
- Tools that render the app (tools/shots.py, tools/build-pdf.py) run the browser in UTC since 22 Nov: earlier guide figures showed the container's local clock. With the owner's yes, those figures and PDFs leave the history of build and main right before the merge; the old commit IDs go to his GitHub Support list. Commit IDs cited in docs from before the merge refer to the history before that rewrite (their messages are unchanged).

## Release candidate 2 (b2b2eed)
- **Built:** milestones 1–10; 11 at its gate. Version 1.2.0, playtest mode behind its Settings switch, Daily v2 from 2026-11-26 (UTC; confirm it is the merge day, else edit js/engine/daily.js's epoch 2 `from`, rebuild dist, commit), guide 57 pages, dist/Parallax.html 5,416 KiB.
- **Verified:** node 7,858/0 on RC1; RC1's full browser suite (46 files) and RC2's reruns of the 17 files its fixes touch (3,333/0); long runs on RC2 (see VERIFY); fresh-player runs of every exercise but Track, phone and desktop; independent reviews of code, items, claims, accessibility and the guide, all fixed or logged.
- **Published privately:** the test page carries RC2; the owner's release checklist page is out (his answers save to its database; links in BRIEF.md and the project status note).

## Next three steps
1. The owner's checklist answers (db document checklist/owner on the checklist page) and his yes. Fix anything he fails, then a short rerun.
2. With his yes: run the figure-history rewrite (the lead's runbook outside the repository), push build and main together (main fast-forwards to build), check the Pages deploy (px.js reads 1.2.0) and CI.
3. Then: the build log and playbook lessons in the project; the status note; the Discord post is his to send (docs/dev/DISCORD-v1.2.md); tags v1.1.0 and v1.2.0 are his taps under Releases.

Open owner items: papers he may send (ACCESS.md); GitHub Support purges for the 17 Nov, 18 Nov and release rewrites; the tags. Not run: the O45 search (Reckon's wording about training effects stays as in 1.1).

## Last verified
- **Live site** serves 1.1.0 (14 Nov). CI passed on the v1.1 release commit.
- **v1.2:** see VERIFY-v1.2.md (suites, fresh players, reviews, known misses).

## Dead ends
- **Browser slots** are the bottleneck (two). Timing-sensitive browser files fail under full CPU load (a Climb run with 9 of 15 items voided beside the long run; harness_views once): rerun alone before calling a failure real.
- **A container restart** stops background runs; their logs survive.
- **Tags, and the GitHub refs and Pages write APIs,** are blocked through the proxy. Branch pushes work.
- **A tappable question blocks the lead's turn** until the owner answers: on 22 Nov it held the build for four days. Ask in a message when other work can go on.
