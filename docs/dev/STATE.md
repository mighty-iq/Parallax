# STATE: Parallax (rewritten at every milestone; under 100 lines)

Updated 2026-11-27 12:35 UTC. **v1.2 is RELEASED** (27 Nov 2026, 12:21 UTC): `main` = `build`, GitHub Pages serves 1.2.0.

## Phase
- **v1.2: released.** The owner gave the go on 27 Nov without tapping through the release checklist (DECISIONS 27 Nov). `build` and `main` were pushed together after the release rewrite (below); the Pages deployment of the release commit succeeded at 12:21 UTC.
- **Next: v1.3**, which waits for the owner's go. Its backlog is docs/dev/PLAN-v1.3.md (deferrals and known misses from 1.2); the approved 1.2 plan stays in docs/dev/PLAN.md; research in docs/research/v1.2/; the release table is docs/dev/VERIFY-v1.2.md.
  - Owner's answers in 1.2: every board recommendation; priorities progress > proof > transfer > fun > start > phone > community > PAT; Central Point Quick by default; Climb sounds, new-best sound, Summit; first session = one tutorial, then Baseline 1, then training; the history rewrite at the merge.

Owner decisions:
- D1: the standing rules and the game layer came in v1.2. D2: the DAT-style focus is opt-in. D3: closed on 17 Nov (DECISIONS).
- 14 Nov: no Duolingo-style streaks (a standing rule for every tool); the weekly goal keeps its forgiving weeks-in-a-row count.

## Privacy (standing rules, binding since 17 Nov)
- Every push runs tools/privacy_check.py through the pre-push hook (`git config core.hooksPath tools/githooks`; private values in the git-ignored `.privacy.local`, recreated in a new container from the script's header). Commit with `TZ=UTC`, no session-link line, keep `Co-Authored-By`.
- **The release rewrite (27 Nov, the owner's yes of 26 Nov):** every old version of four guide files (docs/shots/app-summary.png, app-settings.png, app-section-review.png, docs/Parallax-Guide.pdf) that showed the container's local clock now holds the release copy, and 41 old versions of docs/dev/STATE.md and docs/dev/progress/B4.md (13, 14 and 17 Nov) whose "Updated … UTC" line lay after its own commit now carry that commit's time. All 712 commits got new IDs; authors, dates and file contents elsewhere are unchanged. `python3 tools/privacy_check.py --history build main` is clean over the whole history (commit data included), as are `--tree` and the release zip.
- Commit IDs cited in docs from before 27 Nov refer to the history before that rewrite (their messages are unchanged). Clones made before 27 Nov 12:21 UTC must not push.
- Tools that render the app (tools/shots.py, tools/build-pdf.py) run the browser in UTC.

## Release 1.2.0
- **Shipped:** milestones 1–11. Version 1.2.0; playtest mode behind its Settings switch; Daily v2 from 2026-11-27 (UTC); guide 57 pages (docs/Parallax-Guide.pdf); dist/Parallax.html 5,416 KiB; docs/dev/DISCORD-v1.2.md (1,993 characters) for the owner to post.
- **Verified:** node 7,858/0 on both release candidates; RC1's full browser suite (46 files) and RC2's reruns of the 17 files its fixes touched (3,333/0); long runs on RC2 in every mode (phone 24/0, desktop and srcdoc 33/0); on the release commit the Daily-related node files, single.py 17/0 and game.py 158/0; fresh-player runs of every exercise but Track; independent reviews of code, items, claims, accessibility and the guide. Known misses: VERIFY-v1.2.md "For the owner".

## Next three steps
1. When the owner says go: plan v1.3 from docs/dev/PLAN-v1.3.md and the community's first reports on 1.2 (the release checklist page still takes his answers).
2. His taps: tags v1.1.0 and v1.2.0 under Releases (the proxy refuses tags); the Discord post; a GitHub Support request to purge the old commits of the 17 Nov, 18 Nov and 27 Nov rewrites (the IDs are in the project status note).
3. Keep `main` = `build` for docs-only commits after the release; app changes wait for v1.3 on `build`.

Open owner items: papers he may send (ACCESS.md); the Support purges; the tags. Not run: the O45 search (Reckon's wording about training effects stays as in 1.1).

## Last verified
- **Live site:** the GitHub Pages deployment of 8e5ef43 (the release commit) succeeded on 27 Nov 12:21 UTC; px.js and index.html's px-version read 1.2.0 at that commit. CI passed on both branches for the release push (the rewritten history).
- **v1.2:** see VERIFY-v1.2.md (suites, fresh players, reviews, known misses).

## Dead ends
- **Browser slots** are the bottleneck (two). Timing-sensitive browser files fail under full CPU load (a Climb run with 9 of 15 items voided beside the long run; harness_views once): rerun alone before calling a failure real.
- **A container restart** stops background runs; their logs survive.
- **Tags, the GitHub refs and Pages write APIs, and fetching github.io from the shell** are blocked through the proxy. Branch pushes and `gh run`/deployment reads work.
- **A tappable question blocks the lead's turn** until the owner answers: on 22 Nov it held the build for four days. Ask in a message when other work can go on.
- **A history pass belongs in every rewrite:** the 27 Nov dry run checked the figures only; `privacy_check.py --history` on the rewritten clone found the late stamps before the push.
