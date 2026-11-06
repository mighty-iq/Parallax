"""E2E: the dev harness with Spin (EX-03, SVG).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_spin.py   (two browser slots per machine)

1. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark, both variants: the stage and
   every option show a figure (non-blank pixels, polygons with points); a right answer by keyboard and
   a wrong one by pointer (tap on the phone) score as expected; show me runs to the end; no horizontal
   scroll on the phone
2. show me ends on exactly the drawn figure (the reference outline turned and flipped by the item's
   own model equals the probe's polygon)
3. show me at normal speed: 2–4 s for a same/mirror pair, ≤ 4 s per explained option; shorter with
   reduced motion; pause, step and replay still end
4. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard
5. no console errors
Screenshots: tests/e2e/out/spin/spin_<variant>_<viewport>_<theme>[_reveal|_wrong|_showme].png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_spin')
DIR = OUT / 'spin'
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
PARAMS = 'angle:2,cells:1'  # 50° band, 6 squares


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def stage_ok(target, tag):
    # pick: one reference figure on a wide plate, so the plate is mostly ground
    pick = target.evaluate("() => __harness.item.variant === 'pick'")
    ok, s = non_blank(target.locator('.ex-spin-stage').screenshot(), min_distinct=4, max_top=0.992 if pick else 0.97)
    C.ok(ok, f'{tag}: the stage shows the figure(s) ({s})')


def options_ok(target, tag):
    n = target.evaluate("() => Array.from(document.querySelectorAll('.ex-spin-opt .ex-spin-fig')).filter((p) => (p.getAttribute('points') || '').split(' ').length >= 6).length")
    C.ok(n == 4, f'{tag}: four option figures drawn ({n})')
    shots = [non_blank(target.locator('.hx-grid .px-choice').nth(i).screenshot(), min_distinct=4, max_top=0.985)[0] for i in range(4)]
    C.ok(all(shots), f'{tag}: every option shows a figure ({shots})')


def answer_keyboard(page, frame, tag):
    h = frame.evaluate('() => ({ key: __harness.key, answer: __harness.item.answer })')
    if h['answer'] == 'yesno':
        page.keyboard.press('1' if h['key'] else '2')
    else:
        for k in h['key']:
            page.keyboard.press(str(k + 1))
        page.keyboard.press('Enter')
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['source'] == 'key', f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')
    C.ok(r['rtMs'] >= 0, f'{tag}: the answer clock ran from the paint ({r["rtMs"]} ms)')


def answer_pointer(page, frame, tag, tap=False):
    h = frame.evaluate('() => ({ key: __harness.key, answer: __harness.item.answer, n: __harness.item.nOptions })')
    cells = frame.locator('.hx-grid .px-choice')
    C.ok(cells.count() == h['n'], f'{tag}: the grid has item.nOptions cells ({cells.count()} vs {h["n"]})')
    act = (lambda loc: loc.tap()) if tap else (lambda loc: loc.click())
    if h['answer'] == 'yesno':
        act(cells.nth(1 if h['key'] else 0))
    else:
        wrong = [i for i in range(h['n']) if i not in h['key']]
        act(cells.nth(h['key'][0]))
        act(cells.nth(wrong[0]))
        act(frame.locator('.hx-actions .px-btn'))
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['source'] == 'pointer', f'{tag}: a wrong answer by pointer scores wrong ({r["result"]}, {r["source"]})')
    marks = frame.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => b.className)")
    C.ok(any('is-wrong' in m for m in marks) and any('is-missed' in m for m in marks), f'{tag}: the grid marks the wrong pick and the missed answer')
    tags = frame.evaluate("() => Array.from(document.querySelectorAll('.ex-spin-verdict:not([hidden]), .ex-spin-opt .ex-tag:not([hidden])')).map((e) => e.textContent)")
    C.ok(len(tags) >= 1 and all(('✓' in t or '⇋' in t) for t in tags), f'{tag}: the truth is shown with an icon and a word ({tags})')


def show_me(frame, tag, page=None, click=None):
    before = frame.evaluate('() => __harness.played.finished')
    if click is not None:
        click.click()
    elif page is not None:
        page.keyboard.press('s')
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=30000)
    C.ok(True, f'{tag}: show me ran to the end ({frame.evaluate("() => __harness.played.ms")} ms)')


def final_matches(frame, tag):
    """After show me on a same/mirror pair, the animated reference equals the probe's polygon."""
    d = frame.evaluate("""() => {
        const pts = (sel) => (document.querySelector(sel).getAttribute('points') || '').trim().split(/\\s+/).map((q) => q.split(',').map(Number));
        const a = pts('.ex-spin-svg--ref .ex-spin-fig'), b = __harness.item.probe.poly;
        if (a.length !== b.length) return 99;
        return Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1])));
    }""")
    C.ok(d < 0.01, f'{tag}: show me ends on exactly the drawn figure (max vertex gap {d:.4f} cells)')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for variant in ('samediff', 'pick'):
            for theme in ('light', 'dark'):
                name = f'spin_{variant}_{tag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex='spin', seed=11, v=variant, p=PARAMS, fast=1, theme=theme))
                page.wait_for_function(READY, timeout=30000)
                stage_ok(page, name)
                if variant == 'pick':
                    options_ok(page, name)
                shot(page, name + '.png')
                if phone:
                    sw = page.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
                    C.ok(sw[0] <= sw[1], f'{name}: no horizontal scroll ({sw})')
                if theme == 'light':
                    answer_keyboard(page, page, name)
                    shot(page, name + '_reveal.png')
                    show_me(page, name, page=page)
                    if variant == 'samediff':
                        final_matches(page, name)
                    page.keyboard.press('Space')  # next
                    page.wait_for_function(READY, timeout=10000)
                    answer_pointer(page, page, name, tap=phone)
                    shot(page, name + '_wrong.png')
                    show_me(page, name + ' (Show me button)', click=page.locator('.hx-feedback-actions .px-btn').first)
                    if variant == 'samediff':
                        final_matches(page, name + ' (2)')
                else:
                    page.evaluate('() => __harness.answer(false)')
                    page.wait_for_function(STATE, arg='reveal', timeout=10000)
                    shot(page, name + '_reveal.png')
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    times = {}
    for variant, rm, seed in (('samediff', 0, 9), ('samediff', 1, 9), ('pick', 0, 5)):
        page.goto(file_url('tests/dev/harness.html', ex='spin', seed=seed, v=variant, p='angle:4,cells:2', rm=rm))
        page.wait_for_function(READY, timeout=30000)
        page.evaluate('() => __harness.answer(false)')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(1200)
        shot(page, f'spin_{variant}_1366_light_showme{"_rm" if rm else ""}.png')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=40000)
        page.wait_for_timeout(200)
        shot(page, f'spin_{variant}_1366_light_showme_end{"_rm" if rm else ""}.png')
        pl = page.evaluate('() => __harness.played')
        mirror = page.evaluate('() => __harness.item.variant === "samediff" ? !__harness.item.key : null')
        times[f'{variant}{"_rm" if rm else ""}'] = {'planned': round(pl['plannedMs'] / 1000, 2), 'wall': round(pl['ms'] / 1000, 2), 'mirror': mirror}
    C.ok(2.0 <= times['samediff']['planned'] <= 4.2, f'show me for a same/mirror pair takes 2–4 s ({times["samediff"]})')
    C.ok(times['samediff_rm']['planned'] < times['samediff']['planned'], f'reduced motion makes show me shorter ({times})')
    C.ok(times['pick']['planned'] <= 4.2 * 3, f'show me for pick-two takes ≤ 4 s per explained option ({times["pick"]})')
    page.goto(file_url('tests/dev/harness.html', ex='spin', seed=6, v='samediff', p='angle:5,cells:1'))
    page.wait_for_function(READY, timeout=30000)
    page.evaluate('() => __harness.answer(true)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    page.keyboard.press('s')
    page.wait_for_function(STATE, arg='showme', timeout=5000)
    page.keyboard.press('Space')  # pause
    page.wait_for_timeout(500)
    paused = page.locator('.hx-player-buttons .px-btn').first.inner_text()
    C.ok('Resume' in paused, f'Space pauses show me ({paused!r})')
    page.keyboard.press('ArrowRight')  # step
    page.keyboard.press('r')           # replay
    page.wait_for_function(STATE, arg='reveal', timeout=30000)
    C.ok(True, 'pause, step and replay, then show me ends')
    ctx.close()
    return times


def sandboxed(b, cons):
    for variant in ('samediff', 'pick'):
        doc = harness_single('spin', {'seed': 21, 'v': variant, 'p': PARAMS, 'fast': True})
        host = srcdoc_host(f'harness_spin_{variant}', doc)
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
        page = ctx.new_page()
        cons.append(Console(page))
        page.goto(host.as_uri())
        fr = child_frame(page)
        fr.wait_for_function(READY, timeout=60000)
        env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
        C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc {variant}: runs in a sandboxed srcdoc frame ({env})')
        stage_ok(fr, f'srcdoc {variant}')
        fr.locator('.hx-goal').click()
        answer_keyboard(page, fr, f'srcdoc {variant}')
        show_me(fr, f'srcdoc {variant}', page=page)
        shot(page, f'spin_{variant}_srcdoc.png')
        errs = fr.evaluate('() => __harness.errors')
        C.ok(not errs, f'srcdoc {variant}: no harness errors ({errs})')
        ctx.close()


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        desktop_and_phone(b, cons)
        times = normal_speed(b, cons)
        sandboxed(b, cons)
        b.close()
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    return C.summary({'showMeSeconds': times, 'screenshots': sorted(p.name for p in DIR.glob('spin_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
