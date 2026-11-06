"""E2E: the dev harness with Word Links (PR-0, the non-spatial control probe).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_wordlinks.py   (two browser slots per machine)

1. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark, every relation tier:
   the stem shows the analogy and four words; a right answer by keyboard and a wrong one by
   pointer (tap on the phone) score as expected; the grid marks them; show me runs to the end;
   the time limit runs as a bar and stops at reveal; no horizontal scroll on the phone
2. show me at normal speed: 2–4 s per step, shorter with reduced motion; pause, step, replay
3. the worked example (learn.demo) plays to the end with captions
4. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard
5. no console errors anywhere
Screenshots: tests/e2e/out/wordlinks/<name>.png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_wordlinks')
EX = 'wordlinks'
DIR = OUT / EX
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
LEVELS = [('concrete', 'relation:0,words:0,foils:0'), ('functional', 'relation:1,words:1,foils:1'), ('abstract', 'relation:2,words:2,foils:2')]


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def stem_ok(target, tag):
    ok, s = non_blank(target.locator('.wl-stage').screenshot(), min_distinct=5, max_top=0.97)
    C.ok(ok, f'{tag}: the stem shows text ({s})')
    words = target.evaluate("() => ({ a: document.querySelector('.wl-a').textContent, c: document.querySelector('.wl-c').textContent, "
                            "opts: Array.from(document.querySelectorAll('.hx-grid .wl-opt')).map((e) => e.textContent), item: __harness.item.options })")
    C.ok(len(words['opts']) == 4 and words['opts'] == words['item'] and words['a'] and words['c'], f'{tag}: four words as in the item ({words})')


def timer_ok(target, tag, running):
    t = target.evaluate("() => { const e = document.querySelector('.ex-wordlinks .pr-timer'); const f = e && e.firstChild; "
                        "return e ? { hidden: e.hidden, cls: e.className, dur: f.style.animationDuration, limit: PX.ex.get('wordlinks').timeLimit(__harness.item.params) } : null; }")
    if running:
        C.ok(t and not t['hidden'] and 'is-running' in t['cls'] and t['dur'] == f"{t['limit']}ms", f'{tag}: the time limit runs as a bar ({t})')
    else:
        C.ok(t and 'is-stopped' in t['cls'], f'{tag}: the bar stops at reveal ({t})')


def answer_keyboard(page, frame, tag):
    key = frame.evaluate('() => __harness.key')
    page.keyboard.press(str(key + 1))
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['source'] == 'key', f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')
    C.ok(r['rtMs'] >= 0, f'{tag}: the answer clock ran from the paint ({r["rtMs"]} ms)')


def answer_pointer(page, frame, tag, tap=False):
    key = frame.evaluate('() => __harness.key')
    cell = frame.locator('.hx-grid .px-choice').nth((key + 1) % 4)
    cell.tap() if tap else cell.click()
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['source'] == 'pointer', f'{tag}: a wrong answer by pointer scores wrong ({r["result"]}, {r["source"]})')
    marks = frame.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => b.className)")
    C.ok(any('is-wrong' in m for m in marks) and any('is-missed' in m for m in marks), f'{tag}: the grid marks the wrong pick and the missed answer')


def show_me(frame, tag, page=None):
    before = frame.evaluate('() => __harness.played.finished')
    if page is not None:
        page.keyboard.press('s')
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=90000)
    C.ok(True, f'{tag}: show me ran to the end ({frame.evaluate("() => __harness.played.ms")} ms)')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for lv, p in LEVELS:
            for theme in ('light', 'dark'):
                name = f'{EX}_{lv}_{tag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex=EX, seed=7, p=p, fast=1, theme=theme))
                page.wait_for_function(READY, timeout=60000)
                stem_ok(page, name)
                timer_ok(page, name, True)
                shot(page, name + '.png')
                if phone:
                    sw = page.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
                    C.ok(sw[0] <= sw[1], f'{name}: no horizontal scroll ({sw})')
                if theme == 'light':
                    answer_keyboard(page, page, name)
                    timer_ok(page, name, False)
                    shot(page, name + '_reveal.png')
                    show_me(page, name, page=page)
                    page.keyboard.press('Space')
                    page.wait_for_function(READY, timeout=10000)
                    answer_pointer(page, page, name, tap=phone)
                    shot(page, name + '_wrong.png')
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
    for rm in (0, 1):
        page.goto(file_url('tests/dev/harness.html', ex=EX, seed=5, p='relation:1,words:0,foils:2', rm=rm))
        page.wait_for_function(READY, timeout=60000)
        page.evaluate('() => __harness.answer(false)')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(700)
        page.keyboard.press('Space')  # pause for a steady screenshot, then resume
        page.wait_for_timeout(300)
        shot(page, f'{EX}_showme{"_rm" if rm else ""}.png')
        page.keyboard.press('Space')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=90000)
        pl = page.evaluate('() => __harness.played')
        times['rm' if rm else 'normal'] = round(pl['plannedMs'] / 1000, 2)
    C.ok(2.0 <= times['normal'] <= 4.0, f'show me takes 2–4 s ({times})')
    C.ok(times['rm'] < times['normal'], f'reduced motion makes show me shorter ({times})')
    page.goto(file_url('tests/dev/harness.html', ex=EX, seed=6, p='relation:0,words:0,foils:1'))
    page.wait_for_function(READY, timeout=60000)
    page.evaluate('() => __harness.answer(true)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    page.keyboard.press('s')
    page.wait_for_function(STATE, arg='showme', timeout=5000)
    page.keyboard.press('Space')
    page.wait_for_timeout(500)
    C.ok('Resume' in page.locator('.hx-player-buttons .px-btn').first.inner_text(), 'Space pauses show me')
    page.keyboard.press('ArrowRight')
    page.keyboard.press('r')
    page.wait_for_function(STATE, arg='reveal', timeout=30000)
    C.ok(True, 'pause, step and replay, then show me ends')
    # The worked example of the instruction screen: learn.demo's fixed seed, with captions.
    page.goto(file_url('tests/dev/harness.html', ex=EX, seed=1, fast=1))
    page.wait_for_function(READY, timeout=60000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=90000)
    d = page.evaluate("() => ({ seed: __harness.item.seed, want: PX.ex.learn('wordlinks').demo[0].seed, rel: __harness.item.relation, "
                      "caption: document.querySelector('.hx-caption').textContent })")
    C.ok(d['seed'] == d['want'] and d['caption'], f'the worked example plays the fixed seed with captions ({d})')
    shot(page, f'{EX}_demo_end.png')
    ctx.close()
    return times


def sandboxed(b, cons):
    doc = harness_single(EX, {'seed': 21, 'p': 'relation:2,words:1,foils:1', 'fast': True})
    host = srcdoc_host(f'harness_{EX}', doc)
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=60000)
    env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
    C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc: runs in a sandboxed srcdoc frame ({env})')
    stem_ok(fr, 'srcdoc')
    fr.locator('.hx-goal').click()
    answer_keyboard(page, fr, 'srcdoc')
    show_me(fr, 'srcdoc', page=page)
    shot(page, f'{EX}_srcdoc.png')
    errs = fr.evaluate('() => __harness.errors')
    C.ok(not errs, f'srcdoc: no harness errors ({errs})')
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
    return C.summary({'showMeSeconds': times, 'screenshots': sorted(p.name for p in DIR.glob('*.png'))})


if __name__ == '__main__':
    sys.exit(main())
