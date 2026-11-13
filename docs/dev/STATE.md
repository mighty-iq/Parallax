# STATE: Parallax v1.1 update (rewritten at every milestone; under 100 lines)

Updated 2026-11-13 12:10 UTC.

## Phase
1. Research and plan. The plan gate follows: send the plan message, then stop for the owner's go.

## The brief in one line each (BRIEF.md is the word-for-word source)
1. Time counting looks bugged; fix it and other bugs.
2. Path integration without landmarks (dead reckoning).
3. Knotting and deknotting.
4. DAT PAT question types as training.
5. A better phone experience; Homing usable on phones.
6. Check whether Parallax practises the "analogical assessment test"; if so, warn.

## Done
- Restored the work: mighty-iq/Parallax cloned at /home/claude/parallax; main = f10f7db (v1.0.0); GitHub Pages is on; no issues or pull requests.
- Branch `build` created. BRIEF.md (git-ignored) holds every instruction. /home/claude/RULES.md and /home/claude/CLAUDE.md set up for root memory.
- The v1.0 research notes (A–D) copied to docs/research/v1.0/.

## In progress
- Phase 1 research and audits by subagents (see below).

## Next three steps
1. Collect the research notes and audits; write docs/dev/PLAN.md (milestones, acceptance checks).
2. Send the plan message (five parts), then stop for the go.
3. After the go: build on `build` with parallel builders against a written contract.

## Open questions for the owner
- Which test is the "analogical assessment test"? (name or link)
- Dragon's dead-reckoning notes did not arrive; asked for them as pasted text.
- Which time display looked wrong, on which device?
- Parallax predates the standing rules: switch to them (more game layer, lighter repeat pop-up) or keep its own?

## Last verified
- v1.0.0 (f10f7db): tests/run_all.sh 25 files, 5,117 checks, 0 failed (6 Nov); GitHub Actions green.

## Running subagents and the files they write (launched 2026-11-13 ~12:15 UTC)
- R1 path integration: a5466bc6d9b282c45, docs/research/v1.1/R1-path-integration.md
- R2 knots: a075373df78a5034c, docs/research/v1.1/R2-knots.md
- R3 DAT PAT: a5755f23e92ae406f, docs/research/v1.1/R3-dat-pat.md — DONE: 90 items/60 min, six parts (15 each per prep sites), IRT 200–600 since 3/2025; overlap: Fold high, Views medium, Nets low–medium, cube counting low, apertures/angles none. Recommends adaptive exercises + timed Section mode; build order Fold variant, Angles, Painted Cubes, Views 'complete the views', Openings, Form. ADA guide diagrams not seen (proxy) → option counts etc. from prep sites; DAT trademark line drafted.
- R4 test overlap: ae90e4ec9093266e3, docs/research/v1.1/R4-test-overlap.md — DONE: test not identified (likeliest CORE/VISA verbal Analogies or a figural-analogies test; lead: CognitiveMetrics 'ATAT'); no exercise uses analogy format; near overlap with published spatial subtests (Fold, Hidden, Views count, Nets, Span); recommends About + per-exercise notes + one-tap check-in + optional 'Taking a test soon?' helper. Web-search budget ran out near its end.
- I1 timing and bugs: a1e82da82a641e395, docs/research/v1.1/I1-timing-bugs.md (scratch: scratchpad/v11-audit/timing/)
- I2 mobile audit: aa400bfb901d22ad1, docs/research/v1.1/I2-mobile-audit.md (scratch: scratchpad/v11-audit/mobile/)
- The frozen v1.0 copy for browser audits: scratchpad/frozen-v1.0/ (scratchpad = /tmp/claude-0/-home-claude/145ff06a-4b5d-5025-8cb7-e87b9d56923b/scratchpad)

## Dead ends
(none yet)
