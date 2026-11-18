"""E2E: the dev harness with Central Point (EX-20, SVG board, custom layout, answer type 'point').
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_centralpoint.py   (two browser slots per machine)

1. desktop 1366 x 768, phones 360 x 640 and 412 x 880 (DPR 2, touch), light and dark: the board shows
   49 dots and the targets (non-blank pixels), the plate is square, no horizontal scroll; Confirm and
   the four nudge buttons (exact form) are at least 44 px; on the phones the plate and the controls fit
2. quick form: a tap places the marker on the nearest answer point, a second tap on it answers (right at
   the key); a tap far away and Confirm answers wrong; exact form: the arrow keys move the marker half a
   dot and Enter answers; atDeadline hands in a placed marker
3. reveal: a line and a length label per target, the best answer point ringed and labelled, totals, the
   band's other points; Map draws labelled level lines (the band bold); nothing marks the average
4. Why? (show me) runs to the end, its last frames balance the pulls (a closed chain at the best spot)
   and it leaves the reveal as it was; the Watch demo runs to the end and leaves the item answerable,
   with no average mark left; Try 1's assist draws the kite's two diagonals
5. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard; no console errors
Screenshots: tests/e2e/out/centralpoint/cp_<viewport>_<theme>[_reveal|_map|_exact|_why|_assist].png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_centralpoint')
DIR = OUT / 'centralpoint'
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
M, VBS = 1.3, 14.6


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def pt(target, x, y):
    """Client coordinates of the answer point (x, y) in half-steps."""
    r = target.evaluate("() => { const b = document.querySelector('.ex-cp-board').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; }")
    return r['l'] + (x + M) / VBS * r['w'], r['t'] + (y + M) / VBS * r['h']


def tap(page, touch, x, y):
    cx, cy = pt(page, x, y)
    if touch:
        page.touchscreen.tap(cx, cy)
    else:
        page.mouse.click(cx, cy)


def marker(target):
    return target.evaluate("() => PX.ex.view('centralpoint').marker()")


def far_point(key):
    return {'x': 12 if key['x'] < 6 else 0, 'y': 12 if key['y'] < 6 else 0}


def layout_ok(page, tag, phone):
    m = page.evaluate("""() => {
        const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, b: r.bottom, r: r.right, l: r.left, t: r.top, shown: !!(e.offsetWidth || e.offsetHeight) }; };
        return { stage: q('.ex-cp-stage'), confirm: q('.ex-cp-confirm'), nudges: Array.from(document.querySelectorAll('.ex-cp-nudge')).map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, shown: !!(b.offsetWidth || b.offsetHeight) }; }),
          dots: document.querySelectorAll('.ex-cp-dot').length, targets: document.querySelectorAll('.ex-cp-targets .ex-cp-target').length, k: __harness.item.targets.length,
          scrollX: document.documentElement.scrollWidth > window.innerWidth + 1, vw: window.innerWidth, vh: window.innerHeight };
    }""")
    C.ok(m['dots'] == 49 and m['targets'] == m['k'], f"{tag}: 49 dots and {m['k']} targets drawn ({m['dots']}, {m['targets']})")
    C.ok(abs(m['stage']['w'] - m['stage']['h']) <= 1.5, f"{tag}: the plate is square ({m['stage']['w']:.0f} x {m['stage']['h']:.0f})")
    C.ok(not m['scrollX'], f'{tag}: no horizontal scroll')
    C.ok(m['confirm']['h'] >= 44 and m['confirm']['w'] >= 44, f"{tag}: Confirm is at least 44 px ({m['confirm']['w']:.0f} x {m['confirm']['h']:.0f})")
    shown = [n for n in m['nudges'] if n['shown']]
    if shown:
        C.ok(len(shown) == 4 and all(n['w'] >= 44 and n['h'] >= 44 for n in shown), f'{tag}: four nudge buttons of at least 44 px ({shown})')
    if phone:
        dot = m['stage']['w'] / VBS * 2
        C.ok(dot >= 44, f'{tag}: a dot spacing of at least 44 px ({dot:.1f})')
    ok, s = non_blank(page.locator('.ex-cp-stage').screenshot(), min_distinct=4, max_top=0.99)
    C.ok(ok, f'{tag}: the board shows ({s})')
    return m


def reveal_ok(page, tag, k):
    r = page.evaluate("""() => ({ lines: document.querySelectorAll('.ex-cp-lines line').length, lens: document.querySelectorAll('.ex-cp-labels .ex-cp-len').length,
        best: document.querySelectorAll('.ex-cp-bestring').length, bestLabel: (document.querySelector('.ex-cp-bestlabel') || {}).textContent || '',
        totals: (document.querySelector('.ex-cp-totals') || {}).textContent || '', note: (document.querySelector('.ex-cp-note') || {}).textContent || '',
        avg: document.querySelectorAll('.ex-cp-avgmark, .ex-cp-avgline, .ex-cp-avglabel').length, result: !document.querySelector('.ex-cp-result').hidden })""")
    C.ok(r['lines'] >= k - 1 and r['lens'] == r['lines'], f"{tag}: a line and a length label per target ({r['lines']} lines, {r['lens']} labels)")
    C.ok(r['best'] == 1 and r['bestLabel'] == 'best', f"{tag}: the best answer point ringed and labelled")
    C.ok(len(r['totals']) > 8 and r['result'], f"{tag}: totals shown ({r['totals']!r}; {r['note']!r})")
    C.ok(r['avg'] == 0, f'{tag}: nothing marks the average position')
    return r


def run_viewport(b, name, vp, touch, themes):
    for theme in themes:
        ctx = b.new_context(viewport=vp, device_scale_factor=2 if touch else 1, has_touch=touch, is_mobile=touch)
        page = ctx.new_page()
        con = Console(page)
        page.goto(file_url('tests/dev/harness.html', ex='centralpoint', seed=11, p='targets:2,band:0', v='quick', fast=1, theme=theme))
        page.wait_for_function(READY, timeout=20000)
        tag = f'{name} {theme}'
        layout_ok(page, tag + ' quick', touch)
        shot(page, f'cp_{name}_{theme}.png')
        key = page.evaluate('() => __harness.key')
        tap(page, touch, key['x'], key['y'])
        C.ok(marker(page) == key, f'{tag}: a tap places the marker on the nearest answer point ({marker(page)} vs {key})')
        tap(page, touch, key['x'] + 0.4, key['y'] - 0.3)
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        last = page.evaluate('() => __harness.last.result')
        C.ok(last['correct'] is True, f'{tag}: a second tap on the marker answers, right at the key ({last.get("value")} %)')
        reveal_ok(page, tag + ' reveal', len(page.evaluate('() => __harness.item.targets')))
        shot(page, f'cp_{name}_{theme}_reveal.png')
        page.locator('.ex-cp-mapbtn').click()
        mp = page.evaluate("() => ({ n: document.querySelectorAll('.ex-cp-map path').length, band: document.querySelectorAll('.ex-cp-map path.is-band').length, labels: Array.from(document.querySelectorAll('.ex-cp-maplabel')).map((t) => t.textContent) })")
        C.ok(mp['n'] >= 3 and mp['band'] == 1 and 'band' in mp['labels'], f'{tag}: Map draws labelled level lines with the band bold ({mp})')
        shot(page, f'cp_{name}_{theme}_map.png')
        # Why? (show me): fast mode runs it in a few frames
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => __harness.showMe()')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=20000)
        after = page.evaluate("() => ({ over: document.querySelectorAll('.ex-cp-over > *').length, why: document.querySelector('.ex-cp').classList.contains('is-why'), lines: document.querySelectorAll('.ex-cp-lines line').length })")
        C.ok(after['over'] == 0 and not after['why'] and after['lines'] >= 3, f'{tag}: Why? runs to the end and leaves the reveal as it was ({after})')
        # the exact form: keys
        page.evaluate("() => __harness.next({ variant: 'exact', targets: 0, band: 2 }, 23)")
        page.wait_for_function(READY, timeout=20000)
        layout_ok(page, tag + ' exact', touch)
        k2 = page.evaluate('() => __harness.key')
        page.keyboard.press('ArrowLeft')
        m0 = marker(page)
        C.ok(m0 == {'x': 6, 'y': 6}, f'{tag}: the first arrow key puts the marker in the middle ({m0})')
        for _ in range(abs(k2['x'] - 6)):
            page.keyboard.press('ArrowRight' if k2['x'] > 6 else 'ArrowLeft')
        for _ in range(abs(k2['y'] - 6)):
            page.keyboard.press('ArrowDown' if k2['y'] > 6 else 'ArrowUp')
        C.ok(marker(page) == k2, f'{tag}: arrow keys move the marker half a dot at a time ({marker(page)} vs {k2})')
        shot(page, f'cp_{name}_{theme}_exact.png')
        page.keyboard.press('Enter')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        C.ok(page.evaluate('() => __harness.last.result.correct') is True, f'{tag}: Enter answers (exact, right at the key)')
        # a wrong answer by a tap far away and Confirm
        page.evaluate("() => __harness.next({ variant: 'exact', targets: 3, band: 1 }, 31)")
        page.wait_for_function(READY, timeout=20000)
        k3 = page.evaluate('() => __harness.key')
        fp = far_point(k3)
        tap(page, touch, fp['x'], fp['y'])
        page.locator('.ex-cp-confirm').click()
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        res = page.evaluate('() => __harness.last.result')
        C.ok(res['correct'] is False and res['detail']['credit'] < 1, f'{tag}: a far tap and Confirm answer wrong ({res["value"]} %)')
        C.ok('farther' in page.evaluate("() => document.querySelector('.ex-cp-note').textContent"), f'{tag}: the note says how much farther')
        if name == '360x640' or name == 'desktop':
            # Try 1's assist: the kite's diagonals
            page.evaluate("() => { __harness.setAssist('diagonals'); return __harness.next({ variant: 'quick', targets: 0, band: 0, task: 'kite' }, 2); }")
            page.wait_for_function(READY, timeout=20000)
            C.ok(page.evaluate("() => document.querySelectorAll('.ex-cp-assist line').length") == 2, f'{tag}: Try 1 draws the two diagonals of the kite')
            shot(page, f'cp_{name}_{theme}_assist.png')
            page.evaluate("() => __harness.setAssist(null)")
            # atDeadline hands in the placed marker
            kk = page.evaluate('() => __harness.key')
            tap(page, touch, kk['x'], kk['y'])
            got = page.evaluate("() => PX.ex.view('centralpoint').atDeadline(__harness.item)")
            C.ok(got == kk, f'{tag}: atDeadline hands in the placed marker ({got})')
            # the Watch: plays to the end, leaves the item answerable without a marker or an average mark
            page.evaluate("() => __harness.next({ variant: 'quick', targets: 0, band: 0, task: 'watch' }, 261)")
            page.wait_for_function(READY, timeout=20000)
            d0 = page.evaluate('() => __harness.played.finished')
            page.evaluate('() => __harness.demo()')
            page.wait_for_function('(n) => __harness.played.finished > n', arg=d0, timeout=30000)
            page.wait_for_function(READY, timeout=10000)
            w = page.evaluate("() => ({ avg: document.querySelectorAll('.ex-cp-avgmark, .ex-cp-avgline').length, over: document.querySelectorAll('.ex-cp-over > *').length, marker: PX.ex.view('centralpoint').marker() })")
            C.ok(w['avg'] == 0 and w['over'] == 0 and w['marker'] is None, f'{tag}: the Watch ends clean: answerable, no marker, no average mark ({w})')
            kw = page.evaluate('() => __harness.key')
            tap(page, touch, kw['x'], kw['y'])
            tap(page, touch, kw['x'], kw['y'])
            page.wait_for_function(STATE, arg='reveal', timeout=10000)
            C.ok(page.evaluate('() => __harness.last.result.correct') is True, f'{tag}: the Watch item can be answered after the demo')
        errs = con.errors()
        C.ok(not errs, f'{tag}: no console errors ({errs[:3]})')
        ctx.close()


def run_slow_why(b):
    """Why? at normal speed on a phone: sample its frames for a closed chain, take a picture mid-way."""
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    page.goto(file_url('tests/dev/harness.html', ex='centralpoint', seed=5, p='targets:1,band:0', v='quick', theme='light'))
    page.wait_for_function(READY, timeout=20000)
    k = page.evaluate('() => __harness.key')
    tap(page, True, 0 if k['x'] > 6 else 12, k['y'])
    page.locator('.ex-cp-confirm').tap()
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.showMe(); }')  # not awaited: the frames are sampled while it plays
    seen = {'pull': 0, 'leftover': 0, 'closed': 0}
    took = False
    for i in range(80):
        page.wait_for_timeout(200)
        s = page.evaluate("() => ({ pull: document.querySelectorAll('.ex-cp-pull').length, leftover: document.querySelectorAll('.ex-cp-leftover').length, closed: document.querySelectorAll('.ex-cp-closed').length, done: __harness.played.finished })")
        for key in seen:
            seen[key] = max(seen[key], s[key])
        if s['leftover'] and not took and i > 8:
            shot(page, 'cp_360x640_why.png')
            took = True
        if s['done'] > before:
            break
    C.ok(seen['pull'] >= 3 and seen['leftover'] >= 1 and seen['closed'] >= 1, f'360x640 Why?: equal pulls, a leftover pull, then a closed chain at the best spot ({seen})')
    C.ok(not con.errors(), f'360x640 Why?: no console errors ({con.errors()[:3]})')
    ctx.close()


def run_srcdoc(b):
    page = b.new_page(viewport={'width': 900, 'height': 900})
    con = Console(page)
    host = srcdoc_host('harness_centralpoint', harness_single('centralpoint', {'seed': 7, 'p': {'targets': 1, 'band': 0}, 'v': 'exact', 'fast': True}))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=20000)
    k = fr.evaluate('() => __harness.key')
    page.locator('iframe').focus()
    page.keyboard.press('ArrowUp')
    for _ in range(abs(k['x'] - 6)):
        page.keyboard.press('ArrowRight' if k['x'] > 6 else 'ArrowLeft')
    for _ in range(abs(k['y'] - 6)):
        page.keyboard.press('ArrowDown' if k['y'] > 6 else 'ArrowUp')
    page.keyboard.press('Enter')
    fr.wait_for_function(STATE, arg='reveal', timeout=10000)
    C.ok(fr.evaluate('() => __harness.last.result.correct') is True, 'srcdoc: renders and plays by keyboard (right at the key)')
    C.ok(not con.errors(), f'srcdoc: no console errors ({con.errors()[:3]})')
    page.close()


with sync_playwright() as p:
    b = launch(p)
    run_viewport(b, 'desktop', {'width': 1366, 'height': 768}, False, ['light', 'dark'])
    run_viewport(b, '360x640', {'width': 360, 'height': 640}, True, ['light', 'dark'])
    run_viewport(b, '412x880', {'width': 412, 'height': 880}, True, ['light'])
    run_slow_why(b)
    run_srcdoc(b)
    b.close()
sys.exit(C.summary())
