# v1.2 Phase 1 spikes

Small read-only Node scripts behind the numbers in the v1.2 research notes. None of them changes app code. Run them from the repository root with `node docs/research/v1.2/spikes/<folder>/<script>.mjs` after `npm ci`.

| Folder | Note | What the scripts do |
|---|---|---|
| C1 | C1-central-point.md | Central Point items: exhaustive grid solver, Weiszfeld cross-check, shortcut heuristics per level (`spike.mjs`; results in `results.md`). |
| M1 | M1-measurement.md | Power of the Spatial Check designs: analytic minimal detectable gain and an item-level simulation (`power.mjs`). |
| P1 | P1-plateaus-progress.md | Plateau detector and per-dimension offsets against the real engine (`detector.mjs`, `dims.mjs`, `ranges.mjs`); `analyze*.mjs` summarise runs. Run outputs go to the scratch folder `/tmp/p1sim/` and are not kept. |
| D2 | D2-first-band.md | First items a beginner meets today (`firstitems.mjs`, `firstparams*.mjs`), the proposed first bands against the item model (`bands*.mjs`), the Angles gap spike (`angles-spike*.mjs`), sample items (`items.mjs`, `sample.mjs`, `peek.mjs`, `foils.mjs`). |
| N1 | N1-reckon.md | Reckon shortcut strategies on current and proposed routes (`base.mjs`, `cand.mjs`, `combo*.mjs`, `kmax*.mjs`, `rot*.mjs`, `tfirst.mjs`, `numbers.mjs`, `stats.mjs`; shared code in `lib.mjs`). |

The scripts were written during research and copied here with their paths made relative to the repository; some expect long run times or arguments described in their note.
