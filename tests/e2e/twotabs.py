#!/usr/bin/env python3
"""Two tabs on the same file:// origin (ARCHITECTURE.md §8: storage events, rev counter,
PX.engine.merge when a save meets a newer record).

Two pages of one browser context (they share localStorage) each run a Train session and answer
alternately, item by item: A, B, A, B … (some answers land in the same second as the other
tab's, while the other's debounced save is still pending). Then both end their sessions from the
pause sheet and their saves settle. Checks on the stored record and on both tabs' records:
- every trial either tab answered is there exactly once (matched by seed, exercise, response
  time and outcome), and there are no other rows: nothing lost, nothing duplicated;
- both sessions are there exactly once, each with its own answer count;
- the two tabs end with the same record (same rev, same trials);
- no page or console errors.
Run:    tests/e2e/pwslot.sh python3 tests/e2e/twotabs.py
Report: tests/e2e/out/twotabs.json
"""
import json
import pathlib
import random
import sys
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright  # noqa: E402
from common import launch, Console, Checks, ROOT, OUT as OUT_ROOT  # noqa: E402

INDEX = ROOT / 'index.html'
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
ROUNDS = 30          # answers per tab
OUTCOME = {'wrong': 0, 'right': 1, 'stutter': 2, 'skipped': 3}

# One finished trial of this tab, as the engine logs it.
LAST = '''(() => { const l = __play.last; if (!l || !l.item) return null;
  return { seed: l.item.seed, ex: l.exId, rt: l.rtMs, outcome: l.outcome }; })()'''


def boot(page):
    page.goto(INDEX.as_uri())
    page.wait_for_function(READY, timeout=30000)
    for _ in range(6):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)
    page.evaluate('''PX.ex.list('train').forEach(d => { PX.core.store.state.tour.seen[d.id] = true; });
      PX.core.store.state.ui.seen = PX.core.store.state.ui.seen || {}; PX.core.store.state.ui.seen.motionNotice = Date.now();
      PX.core.store.save();''')


def to_respond(page, ms=30000):
    """Waits for the answer phase (starting cards and Track's notice are clicked through)."""
    for _ in range(ms // 100):
        st = page.evaluate('__play.state')
        if st == 'respond':
            return True
        if st == 'paused':  # a tab that was hidden for a moment pauses its item
            page.evaluate('__play.resume()')
        if st in ('reveal', 'showme'):
            page.evaluate('PX.debug.fast(false); __play.next()')
        card = page.locator('[data-card-box] .px-btn--primary')
        if card.count():
            page.evaluate('PX.debug.fast(false)')
            card.first.click()
        nb = page.locator('.ex-track-notice:not([hidden]) .px-btn')
        if nb.count() and nb.first.is_visible():
            nb.first.click()
        page.wait_for_timeout(100)
    return False


def answer(page, rnd):
    page.evaluate('PX.debug.fast(true)')
    page.evaluate(f'PX.debug.answer({"true" if rnd.random() < 0.75 else "false"})')
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme" || __play.state === "done"', timeout=15000)
    return page.evaluate(LAST)


def end_session(page):
    """End session from the pause sheet; the item it cuts is logged as skipped (outcome 3)."""
    to_respond(page)
    cut = page.evaluate('({ seed: __play.item.seed, ex: __play.exId, rt: null, outcome: "skipped" })')
    page.locator('[data-pause]').first.click()
    page.wait_for_function('__play.state === "paused"', timeout=5000)
    page.locator('[data-end]').click()
    page.wait_for_selector('.pl-summary', timeout=15000)
    return cut


def main():
    C = Checks('twotabs')
    rnd = random.Random(7)
    rep = {}
    with sync_playwright() as p:
        b = launch(p)
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
        A, B = ctx.new_page(), ctx.new_page()
        cons = {'A': Console(A), 'B': Console(B)}
        boot(A)
        A.wait_for_timeout(1500)  # A's first save lands before B opens
        boot(B)
        tabs = {'A': A, 'B': B}
        for name, pg in tabs.items():
            pg.evaluate('PX.debug.fast(false); void PX.core.router.go("play", { mode: "train" }, { force: true })')
            pg.wait_for_timeout(300)
        done = {'A': [], 'B': []}
        for i in range(ROUNDS):
            for name in ('A', 'B'):
                pg = tabs[name]
                if not to_respond(pg):
                    C.ok(False, f'tab {name}: round {i + 1} never reached an answer phase ({pg.evaluate("__play.state")})')
                    continue
                t = answer(pg, rnd)
                if t:
                    done[name].append(t)
                # sometimes the other tab answers at once (same second, saves still pending)
                pg.wait_for_timeout(rnd.choice([0, 50, 200, 600, 1200]))
                pg.evaluate('PX.debug.fast(false); __play.next()')
            print(f'round {i + 1}: A {len(done["A"])}, B {len(done["B"])}; visible A {A.evaluate("document.visibilityState")}, B {B.evaluate("document.visibilityState")}', flush=True)
        cuts = {}
        for name in ('A', 'B'):
            cuts[name] = end_session(tabs[name])
        for name in ('A', 'B'):
            tabs[name].evaluate('PX.core.store.flush()')
        A.wait_for_timeout(2500)
        for name in ('A', 'B'):
            tabs[name].evaluate('PX.core.store.flush()')
        A.wait_for_timeout(1500)
        stored = A.evaluate('JSON.parse(localStorage.getItem("parallax.v1"))')
        mem = {n: tabs[n].evaluate('({ rev: PX.core.store.state.rev, trials: PX.core.store.state.trials.length, sessions: PX.core.store.state.sessions.map(s => [s.id, s.mode, s.trials]) })') for n in tabs}
        names = stored['idx']['ex']
        rows = stored['trials']

        def key(r):
            return (r[4], names[r[1]].split('@')[0], r[6], r[5])
        keys = [key(r) for r in rows]
        want = []
        for name in ('A', 'B'):
            for t in done[name] + [cuts[name]]:
                want.append((t['seed'], t['ex'], t['rt'], OUTCOME.get(t['outcome'], -1)))
        # multisets: a key can rightly occur twice if both tabs ever hold the same seed
        have, need = Counter(keys), Counter(want)
        missing = list((need - have).elements())
        doubled = [k for k in have if have[k] > need.get(k, 0) and k in need]
        extra = [k for k in have if k not in need]
        same_rows = len(rows) - len({json.dumps(r) for r in rows})
        seeds = [w[0] for w in want]
        rep = {'answered': {n: len(done[n]) for n in done}, 'storedRows': len(rows), 'missing': missing[:10], 'doubled': doubled[:10],
               'extra': extra[:10], 'identicalRows': same_rows, 'sessions': [[s['id'], s['mode'], s['trials']] for s in stored['sessions']],
               'memory': mem, 'seedCollisions': len(seeds) - len(set(seeds)), 'rev': stored['rev']}
        C.ok(len(done['A']) == ROUNDS and len(done['B']) == ROUNDS, f'both tabs answered {ROUNDS} items ({rep["answered"]})')
        C.ok(not missing, f'no trial lost ({len(missing)} missing of {len(want)}: {missing[:3]})')
        C.ok(not doubled and same_rows == 0, f'no trial duplicated ({len(doubled)} doubled, {same_rows} identical rows)')
        C.ok(not extra and len(rows) == len(want), f'no other rows ({len(rows)} stored for {len(want)} trials: 60 answered + 2 cut by End session; extra {extra[:3]})')
        sess = [s for s in stored['sessions'] if s['mode'] == 'train']
        ids = [s['id'] for s in sess]
        C.ok(len(sess) == 2 and len(set(ids)) == 2, f'both sessions kept once each ({rep["sessions"]})')
        C.ok(sorted(s['trials'] for s in sess) == sorted(sum(1 for t in done[n] if t['outcome'] in ('right', 'wrong')) for n in done),
             f'each session keeps its own answer count ({[s["trials"] for s in sess]} vs {[len(done[n]) for n in done]})')
        C.ok(mem['A']['trials'] == mem['B']['trials'] == len(rows) and mem['A']['rev'] == mem['B']['rev'] == stored['rev'],
             f'both tabs end with the stored record ({mem}, stored rev {stored["rev"]})')
        # Each page load salts its training seeds (engine select.pageSalt, 10 bits), so two tabs
        # draw different items; the merge still keeps same-seed trials apart (checked above). Two
        # pages share a salt about once in 1 024 runs, which would fail this check by chance.
        C.ok(rep['seedCollisions'] == 0, f'the two tabs drew different items ({rep["seedCollisions"]} of {len(seeds)} seeds shared)')
        for n in ('A', 'B'):
            C.ok(not cons[n].errors(), f'tab {n}: no page or console errors {cons[n].errors()[:3]}')
        ctx.close()
        b.close()
    print(json.dumps(rep, default=str)[:1500])
    sys.exit(C.summary(rep))


if __name__ == '__main__':
    main()
