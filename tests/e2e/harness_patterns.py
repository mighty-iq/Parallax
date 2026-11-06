"""E2E: the dev harness with Pattern Memory (PR-4).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_patterns.py   (two browser slots per machine)

1. the exposure: the filled squares show as a steady display for 3 s (timed by the view from the
   paint timestamp; checked on the view's own measurement), then the grid is empty and the answer
   clock starts; the marking time runs as a bar, hidden during the exposure
2. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark, three grid sizes: a
   right answer by keyboard (arrow keys, Space, Enter) and a wrong one by pointer (taps on the
   phone, then Confirm) score as expected; squares are ≥ 44 px; reveal marks found, missed and
   extra squares; show me runs to the end; no horizontal scroll on the phone
3. show me at normal speed: 2–4 s, shorter with reduced motion; the worked example plays
4. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard
5. no console errors anywhere
Screenshots: tests/e2e/out/patterns/<name>.png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_patterns')
EX = 'patterns'
DIR = OUT / EX
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
LEVELS = [('3x3', 'size:0,regularity:0'), ('4x5', 'size:3,regularity:1'), ('6x6', 'size:6,regularity:2')]


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def grid_state(frame):
    return frame.evaluate("""() => ({ filled: document.querySelectorAll('.pm-cell.is-filled').length, marked: document.querySelectorAll('.pm-cell.is-marked').length,
        k: __harness.item ? __harness.item.k : null, cell: (() => { const r = document.querySelector('.pm-sq'); const b = r && r.getBoundingClientRect(); return b ? Math.round(Math.min(b.width, b.height)) : 0; })(),
        timer: (() => { const e = document.querySelector('.ex-patterns .pr-timer'); return e ? { hidden: e.hidden, cls: e.className, dur: e.firstChild.style.animationDuration } : null; })() })""")


def mark_by_keys(page, frame, ids):
    """Move the cursor (it starts at square 0) to each id and press Space."""
    cols = frame.evaluate('() => __harness.item.cols')
    r = c = 0
    for i in ids:
        tr, tc = divmod(i, cols)
        for _ in range(abs(tr - r)):
            page.keyboard.press('ArrowDown' if tr > r else 'ArrowUp')
        for _ in range(abs(tc - c)):
            page.keyboard.press('ArrowRight' if tc > c else 'ArrowLeft')
        r, c = tr, tc
        page.keyboard.press('Space')


def answer_keyboard(page, frame, tag):
    key = frame.evaluate('() => __harness.key')
    mark_by_keys(page, frame, key)
    g = grid_state(frame)
    C.ok(g['marked'] == len(key), f'{tag}: the arrow keys and Space mark squares ({g["marked"]} of {len(key)})')
    page.keyboard.press('Enter')
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['response'] == key, f'{tag}: a right answer by keyboard scores right ({r["result"]})')
    C.ok(r['rtMs'] >= 0, f'{tag}: the answer clock ran from the empty grid ({r["rtMs"]} ms)')


def answer_pointer(page, frame, tag, tap=False):
    it = frame.evaluate('() => ({ key: __harness.key, n: __harness.item.rows * __harness.item.cols })')
    extra = next(i for i in range(it['n']) if i not in it['key'])
    cells = frame.locator('.pm-cell')
    act = (lambda loc: loc.tap()) if tap else (lambda loc: loc.click())
    for i in it['key'][1:] + [extra]:
        act(cells.nth(i))
    act(frame.locator('.pm-actions .px-btn'))
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['result']['detail']['misses'] == 1 and r['result']['detail']['falseAlarms'] == 1,
         f'{tag}: a wrong answer by pointer scores wrong ({r["result"]})')
    marks = frame.evaluate("() => ({ miss: document.querySelectorAll('.pm-cell.is-miss').length, extra: document.querySelectorAll('.pm-cell.is-extra').length, hit: document.querySelectorAll('.pm-cell.is-hit').length })")
    C.ok(marks['miss'] == 1 and marks['extra'] == 1 and marks['hit'] == len(it['key']) - 1, f'{tag}: reveal marks found, missed and extra squares ({marks})')


def show_me(frame, tag, page):
    before = frame.evaluate('() => __harness.played.finished')
    page.keyboard.press('s')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=90000)
    C.ok(True, f'{tag}: show me ran to the end ({frame.evaluate("() => __harness.played.ms")} ms)')


def exposure_check(b, cons):
    """The exposure, checked without screenshots during it (they would stall frames)."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    for seed in (2, 3):
        page.goto(file_url('tests/dev/harness.html', ex=EX, seed=seed, p='size:2,regularity:1', fast=1))
        page.wait_for_function(STATE, arg='ready', timeout=30000)
        page.wait_for_timeout(400)
        g = grid_state(page)
        C.ok(g['filled'] == g['k'] and g['timer']['hidden'], f'exposure {seed}: the {g["k"]} filled squares show, no bar yet ({g})')
        page.wait_for_function(READY, timeout=10000)
        g = grid_state(page)
        ex = page.evaluate("() => PX.ex.view('patterns').exposure()")
        C.ok(g['filled'] == 0 and g['timer'] and not g['timer']['hidden'] and 'is-running' in g['timer']['cls'], f'exposure {seed}: then the grid is empty and the marking bar runs ({g})')
        C.ok(ex and 2990 <= ex['swapMs'] <= 3060, f'exposure {seed}: the pattern shows for 3 s (swap at {ex})')
        # A frame gap over 100 ms during the exposure (a stall, a hidden tab) marks the trial as
        # stuttered (void). On a loaded build machine gaps happen; the flag must match the gap.
        C.ok(ex and ex['stutter'] == (ex['maxGapMs'] > 100), f'exposure {seed}: the stutter flag matches the largest frame gap ({ex})')
    ctx.close()


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for lv, p in LEVELS:
            for theme in ('light', 'dark'):
                name = f'{EX}_{lv}_{tag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex=EX, seed=9, p=p, fast=1, theme=theme))
                page.wait_for_function(STATE, arg='ready', timeout=30000)
                page.wait_for_timeout(300)
                shot(page, name + '_look.png')  # (a screenshot may stall a frame: not used for timing)
                ok, s = non_blank(page.locator('.pm-stage').screenshot(), min_distinct=5, max_top=0.97)
                C.ok(ok, f'{name}: the pattern shows ({s})')
                page.wait_for_function(READY, timeout=10000)
                g = grid_state(page)
                C.ok(g['cell'] >= 44, f'{name}: squares are at least 44 px ({g["cell"]} px)')
                shot(page, name + '.png')
                if phone:
                    sw = page.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
                    C.ok(sw[0] <= sw[1], f'{name}: no horizontal scroll ({sw})')
                if theme == 'light':
                    answer_keyboard(page, page, name)
                    g = grid_state(page)
                    C.ok(g['timer'] and 'is-stopped' in g['timer']['cls'], f'{name}: the bar stops at reveal ({g["timer"]})')
                    shot(page, name + '_reveal.png')
                    show_me(page, name, page)
                    page.keyboard.press('Space')
                    page.wait_for_function(READY, timeout=15000)
                    answer_pointer(page, page, name, tap=phone)
                    shot(page, name + '_wrong.png')
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    times = {}
    for rm in (0, 1):
        page.goto(file_url('tests/dev/harness.html', ex=EX, seed=5, p='size:3,regularity:1', rm=rm))
        page.wait_for_function(READY, timeout=60000)
        page.keyboard.press('Enter')  # nothing marked: wrong
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.keyboard.press('s')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=90000)
        times['rm' if rm else 'normal'] = round(page.evaluate('() => __harness.played.plannedMs') / 1000, 2)
    C.ok(2.0 <= times['normal'] <= 4.0, f'show me takes 2–4 s ({times})')
    C.ok(times['rm'] < times['normal'], f'reduced motion makes show me shorter ({times})')
    page.goto(file_url('tests/dev/harness.html', ex=EX, seed=1, fast=1))
    page.wait_for_function(READY, timeout=60000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=90000)
    d = page.evaluate("() => ({ seed: __harness.item.seed, want: PX.ex.learn('patterns').demo[0].seed, caption: document.querySelector('.hx-caption').textContent, state: __harness.state })")
    C.ok(d['seed'] == d['want'] and d['caption'], f'the worked example plays the fixed seed with captions ({d})')
    g = grid_state(page)
    C.ok(g['filled'] == 0 and g['marked'] == 0, f'after the worked example the grid is empty again ({g})')
    shot(page, f'{EX}_demo_after.png')
    ctx.close()
    return times


def sandboxed(b, cons):
    doc = harness_single(EX, {'seed': 21, 'p': 'size:1,regularity:0', 'fast': True})
    host = srcdoc_host(f'harness_{EX}', doc)
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=60000)
    env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
    C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc: runs in a sandboxed srcdoc frame ({env})')
    fr.locator('.hx-goal').click()
    answer_keyboard(page, fr, 'srcdoc')
    shot(page, f'{EX}_srcdoc.png')
    C.ok(not fr.evaluate('() => __harness.errors'), 'srcdoc: no harness errors')
    ctx.close()


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        exposure_check(b, cons)
        desktop_and_phone(b, cons)
        times = normal_speed(b, cons)
        sandboxed(b, cons)
        b.close()
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    return C.summary({'showMeSeconds': times, 'screenshots': sorted(p.name for p in DIR.glob('*.png'))})


if __name__ == '__main__':
    sys.exit(main())
