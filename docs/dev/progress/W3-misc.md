# W3-misc: progress log (v1.2, PLAN milestone 9)

Builder W3-misc. Files: sw.js (new), the registration block in js/ui/app.js, js/engine/dims.js, the tests below.
Times are UTC.

## 2026-11-19 14:02: leading items off the scoped cells (dims.js)
- Found: 22cd8e3 already keeps the lead's own filter (frontier and item) and the fluent zone off E.dims.scoped. Two
  paths still let a leading or fluency item land in a scoped cell: a plateau change ordered after dims (order 20:
  wider mix, variant swap) replaces `o.filter`, and modes' fallback (an empty filter) drops every filter.
- Done: a last pick hook `dims.scoped` (order 90, scopedPick) re-applies the exclusion to the final filter and keeps a
  candidate off the cells (the fallback's steps, taken here off the cells); fluencyPick's bail-out sets `o.kind`
  'easy' too, so the hook reads the item's kind; E.dims.lead() uses the leads' filter.
- Test: tests/node/dims-scoped.test.mjs (29 checks, about 9 s): Train sessions of simulated learners on Nets, Slice,
  Fold, Painted Cubes (PAT focus on) and Homing: 0 of 2,039 leading and 0 of 834 fluency items in a cell; the same
  sessions deal identical items without the hook; under wider mix and a Nets variant swap 0 with the hook, 900
  without it; a later hook that steers leads into the cells still gets none. Cube Match and Pattern Memory are
  probes (no Train).
- Reruns: node dims engine hooks plateau bets wave3 game firstband section trend + dims-scoped: 2,376/0.
  sim-progress --learners 60 --days 60 --profiles even,uneven --conds est --wave2: the scoped gate passes (0 of
  39,168 and 0 of 37,113 leading, 0 fluency); the other gates as reported before (coverage 97.3–97.8 %, uneven
  93.2 % and Track speed 19, the known misses of docs/dev/v1.2/progress-sim.md).

## 2026-11-19 14:25: O21, the service worker of the GitHub Pages copy
- Found: manifest.webmanifest and icons/ exist (B2), and js/ui/app.js links them on https only (homeScreenLinks), so
  the home-screen icon was offered but failed offline. No worker existed.
- Done: sw.js at the root (one complete copy per scope, cache first, a check about 3 s after each launch that writes a
  new copy when anything changed, old copies dropped; DECISIONS line); the registration block in js/ui/app.js
  (registerSw on app:ready: a secure http(s) top-level page, the app's index, the multi-file app only; state in
  PX.ui.app.sw). Nothing else in app.js changed.
- Found while testing: a reload in the same tab may run a script from the browser's memory cache while the server's
  max-age (600 s on Pages) holds; that is the browser, not the worker (a new page, no-cache or the cache disabled
  show the update), so the browser test launches each time in a new page with the browser cache off.
- Tests: tests/e2e/sw.py 52/0 (offline launch with the server stopped, then a same-tab reload: boot, the saved record, a Rotate item played
  and logged; the copy's 213 files and names; updates with and without a new version number; a new sw.js keeps the
  copy; never registered from file://, a same-origin frame, srcdoc frames, the single-file build at the top or from
  file://; no console errors anywhere). tests/node/sw.test.mjs 29/0 (the same rules on fakes, for CI: what it answers,
  ETag and byte comparison, a host failing part-way, a full disk, other tools' caches kept). shell.py 274/0.
- Other runs: single.py 15/2: both failures count the exercises of the tracked dist/Parallax.html (built 18 Nov, 25
  exercises) against today's index.html (29); the build is redone at release, and sw.py builds its own.

## 2026-11-19 14:37: the install bar (the lead's follow-up)
- Done: js/ui/app.js holds beforeinstallprompt (preventDefault, kept) and exposes PX.ui.app.install { available, prompt() },
  cleared after its one prompt, on a dismissal and on appinstalled; js/ui/settings.js (the granted row) shows "Install
  Parallax on this device" in Your data only while available. Nothing in the player.
- Tests: tests/e2e/sw.py 71/0: a synthetic offer is held and the row shows (44 px, no sideways scroll at 360 px), a tap
  prompts once and the row goes, dismissed and appinstalled clear it, an offer during an item shows nothing in the
  player; in every never-register case an offer is held without an error.
