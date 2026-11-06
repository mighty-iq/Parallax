#!/usr/bin/env python3
"""Track performance on a phone (PLAN.md §12.5): 412 × 880, device pixel ratio 2, touch, with the
CPU throttled 4× through the Chrome DevTools Protocol (Emulation.setCPUThrottlingRate).

Two runs of 5 real-speed trials each, played in the app (index.html from file://):
- 'standard': the Threshold protocol Track Standard (8 spheres, 4 targets, 8 s, still camera),
  started from the Lab;
- 'heavy':    Free play with fixed settings at the heavy end (10 spheres, 5 targets, 8 s, orbit
  camera, a fast speed), started from the Library.
Per trial, from the tracking phase's frame monitor (the meta Track sends with its answer): frames,
mean / median / p95 / longest frame gap, frames per second, the share of late frames, the
largest jump against Track's void limit, and the void verdict. Per run: the void rate and the
3D quality step-down. Checks: every trial ends, no page or console errors.
This machine renders WebGL in software (SwiftShader), so the numbers are a worst case.

Run:    tests/e2e/pwslot.sh python3 tests/e2e/perf_track.py
Report: tests/e2e/out/perf_track.json (+ screenshots in tests/e2e/out/perf/)
"""
import json
import pathlib
import statistics
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright  # noqa: E402
from common import launch, Console, Checks, ROOT, OUT as OUT_ROOT  # noqa: E402

OUT = OUT_ROOT / 'perf'
OUT.mkdir(parents=True, exist_ok=True)
INDEX = ROOT / 'index.html'
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
TRIALS = 5
THROTTLE = 4

LAST = '''(() => {
  const l = __play.last; if (!l) return null;
  const m = l.meta || {}, f = m.frames || {};
  return { outcome: l.outcome, voidReason: l.voidReason, rt: l.rtMs, frames: f.frames, meanMs: f.meanMs, medianMs: f.medianMs,
           p95Ms: f.p95Ms, maxGapMs: f.maxGapMs, dropped: f.dropped, stutter: f.stutter, lost: f.contextLost,
           jump: m.jump, late: m.late, void: m.void, limit: (() => { try { return PX.ex.view('track').trialInfo().judge.limit; } catch (e) { return null; } })(),
           n: __play.item && __play.item.n, k: __play.item && __play.item.k, speed: __play.item && __play.item.speed,
           variant: __play.item && __play.item.params && __play.item.params.variant };
})()'''


def boot(page):
    page.goto(INDEX.as_uri())
    page.wait_for_function(READY, timeout=30000)
    for _ in range(6):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)
    # Track's tutorial offer and motion notice belong to the first run; here they are seen
    page.evaluate('''PX.core.store.state.tour.seen.track = true;
      PX.core.store.state.ui.seen = PX.core.store.state.ui.seen || {}; PX.core.store.state.ui.seen.motionNotice = Date.now();''')


def play(page, C, tag, n):
    """Plays n Track trials at real speed; returns the per-trial stats."""
    out = []
    for i in range(n):
        for _ in range(1200):  # up to 120 s for one trial on a throttled software renderer
            st = page.evaluate('__play.state')
            if st == 'respond':
                break
            card = page.locator('[data-card-box] .px-btn--primary')
            if card.count():
                card.first.tap()
            nb = page.locator('.ex-track-notice:not([hidden]) .px-btn')
            if nb.count() and nb.first.is_visible():
                nb.first.tap()
            page.wait_for_timeout(100)
        else:
            C.ok(False, f'{tag}: trial {i + 1} never reached its answer phase ({page.evaluate("__play.state")})')
            break
        if i == 0:
            page.screenshot(path=str(OUT / f'{tag}_respond.png'))
        # fast mode only for the reveal and show me (animations), off again before the next stimulus
        page.evaluate('PX.debug.fast(true); PX.debug.answer(Math.random() < 0.75)')
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme" || __play.state === "done"', timeout=15000)
        t = page.evaluate(LAST)
        out.append(t)
        if t and t['meanMs']:
            print(f"  {tag} {i + 1}: {t['frames']} frames, mean {t['meanMs']:.1f} ms, p95 {t['p95Ms']:.1f} ms, max {t['maxGapMs']:.0f} ms, "
                  f"jump {t['jump'] or 0:.3f}/{t['limit'] or 0:.3f}, void {t['void']}", flush=True)
        for _ in range(50):
            page.evaluate('PX.debug.fast(false); __play.next()')
            page.wait_for_timeout(150)
            if page.evaluate('__play.state') not in ('reveal', 'showme'):
                break
    return out


def summarize(trials):
    ok = [t for t in trials if t and t.get('frames')]
    if not ok:
        return {'trials': len(trials)}
    fps = [1000.0 / t['meanMs'] for t in ok if t['meanMs']]
    return {
        'trials': len(trials),
        'voided': sum(1 for t in trials if t and t.get('outcome') == 'stutter'),
        'voidRate': round(sum(1 for t in trials if t and t.get('outcome') == 'stutter') / len(trials), 2),
        'fpsMedian': round(statistics.median(fps), 1), 'fpsMin': round(min(fps), 1),
        'frameMeanMs': round(statistics.mean(t['meanMs'] for t in ok), 1),
        'frameMedianMs': round(statistics.median(t['medianMs'] for t in ok), 1),
        'frameP95Ms': round(max(t['p95Ms'] for t in ok), 1),
        'maxGapMs': round(max(t['maxGapMs'] for t in ok), 1),
        'lateShare': round(statistics.mean((t['late'] or 0) for t in ok), 3),
        'jumpMax': round(max((t['jump'] or 0) for t in ok), 3), 'jumpLimit': ok[0].get('limit'),
        'reasons': [t.get('void') or t.get('voidReason') for t in trials if t and t.get('outcome') == 'stutter'],
    }


def run(b, C, rep, tag):
    ctx = b.new_context(viewport={'width': 412, 'height': 880}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    cdp = ctx.new_cdp_session(page)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': THROTTLE})
    if tag == 'standard':
        page.evaluate('void PX.core.router.go("lab")')
        page.wait_for_timeout(600)
        page.locator('[data-protocol="track-standard"]').first.scroll_into_view_if_needed()
        page.locator('[data-protocol="track-standard"]').first.tap()
    else:
        page.evaluate('void PX.core.router.go("play", { mode: "free", exId: "track", run: "1", trials: 10, params: { speed: 30, targets: 3, spheres: 2, time: 1, variant: "orbit" } }, { force: true })')
    page.wait_for_timeout(800)
    trials = play(page, C, tag, TRIALS)
    q = page.evaluate('(() => { try { return PX.core.stage3d.quality ? PX.core.stage3d.quality() : null; } catch (e) { return String(e); } })()')
    page.screenshot(path=str(OUT / f'{tag}_last.png'))
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
    s = summarize(trials)
    s['quality'] = q
    s['perTrial'] = trials
    rep[tag] = s
    C.ok(len([t for t in trials if t]) == TRIALS, f'{tag}: {TRIALS} trials played ({len(trials)})')
    C.ok(not con.errors(), f'{tag}: no page or console errors {con.errors()[:3]}')
    ctx.close()


def main():
    C = Checks('perf_track')
    rep = {'viewport': '412x880', 'dpr': 2, 'cpuThrottle': THROTTLE, 'renderer': 'software WebGL (SwiftShader): a worst case'}
    with sync_playwright() as p:
        b = launch(p)
        for tag in ('standard', 'heavy'):
            try:
                run(b, C, rep, tag)
            except Exception as e:
                C.ok(False, f'{tag} crashed: {str(e)[:300]}')
        b.close()
    for tag in ('standard', 'heavy'):
        s = rep.get(tag, {})
        print(f"{tag}: {json.dumps({k: v for k, v in s.items() if k != 'perTrial'})}")
    sys.exit(C.summary(rep))


if __name__ == '__main__':
    main()
