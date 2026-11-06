"""E2E: the dev harness with Fold (EX-04, SVG).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_fold.py   (two browser slots per machine)

1. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark, three level settings
   (one fold; three folds with a corner and two punches; five mixed folds, three punches, five
   options): the stage is non-blank; the strip has one panel per fold plus the punch panel, and
   only the punch panel shows holes; every option sheet shows exactly its item.options holes;
   a right answer by keyboard and a wrong one by pointer (tap on the phone) score as expected;
   the truth is shown with words; show me runs to the end and ends on the key's holes; no
   horizontal scroll on the phone
2. show me at normal speed: about 2.5 s per unfold; shorter with reduced motion; pause, step and
   replay still end; the demo plays to the end with captions
3. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard
4. no console errors
Screenshots: tests/e2e/out/fold/fold_<set>_<viewport>_<theme>[_reveal|_wrong|_showme].png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_fold')
DIR = OUT / 'fold'
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
SETS = [('one', 'folds:0', 4), ('corner', 'folds:2,type:1,punches:1', 4), ('hard', 'folds:4,type:3,punches:2,idle:1', 7)]

# Hole centres drawn in an SVG, as cells [i, j], sorted.
CELLS_JS = """(sel) => Array.from(document.querySelectorAll(sel)).map((c) => [Math.round(+c.getAttribute('cx') - 0.5), Math.round(+c.getAttribute('cy') - 0.5)]).sort((a, b) => a[0] - b[0] || a[1] - b[1])"""


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def sort_cells(cells):
    return sorted([list(c) for c in cells], key=lambda c: (c[0], c[1]))


def stage_ok(target, tag):
    ok, s = non_blank(target.locator('.ex-fold-stage').screenshot(), min_distinct=4, max_top=0.97)
    C.ok(ok, f'{tag}: the stage shows the folds ({s})')


def stem_ok(target, tag):
    d = target.evaluate("""() => {
        const it = __harness.item, panels = Array.from(document.querySelectorAll('.ex-fold-strip .ex-fold-panel'));
        return { folds: it.folds.length, panels: panels.length,
                 holes: panels.map((p) => p.querySelectorAll('.ex-fold-hole').length), punches: it.punches.length,
                 labels: panels.map((p) => p.querySelector('.ex-label').textContent) };
    }""")
    C.ok(d['panels'] == d['folds'] + 1 and d['labels'][-1] == 'Punch', f'{tag}: one panel per fold and the punch panel ({d["labels"]})')
    C.ok(all(h == 0 for h in d['holes'][:-1]) and d['holes'][-1] == d['punches'], f'{tag}: holes only in the punch panel, one per punch ({d["holes"]})')


def options_ok(target, tag):
    item = target.evaluate('() => __harness.item')
    n = len(item['options'])
    cells = target.locator('.hx-grid .px-choice')
    C.ok(cells.count() == n, f'{tag}: the grid has one cell per option ({cells.count()} of {n})')
    drawn = [target.evaluate(CELLS_JS, f'.hx-grid .px-choice:nth-child({i + 1}) .ex-fold-hole') for i in range(n)]
    C.ok(all(drawn[i] == sort_cells(item['options'][i]) for i in range(n)), f'{tag}: every option sheet shows exactly its holes')
    creases = target.evaluate("() => document.querySelectorAll('.hx-grid .ex-fold-crease, .hx-grid .ex-fold-flap').length")
    C.ok(creases == 0, f'{tag}: option sheets carry no creases ({creases})')
    pix = [non_blank(cells.nth(i).screenshot(), min_distinct=3, max_top=0.99)[0] for i in range(n)]
    C.ok(all(pix), f'{tag}: every option shows a sheet ({pix})')


def answer_keyboard(page, frame, tag):
    key = frame.evaluate('() => __harness.key')
    page.keyboard.press(str(key + 1))
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['source'] == 'key', f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')
    C.ok(r['rtMs'] >= 0, f'{tag}: the answer clock ran from the paint ({r["rtMs"]} ms)')


def answer_pointer(page, frame, tag, tap=False):
    h = frame.evaluate('() => ({ key: __harness.key, n: __harness.item.options.length })')
    cells = frame.locator('.hx-grid .px-choice')
    wrong = (h['key'] + 1) % h['n']
    (cells.nth(wrong).tap() if tap else cells.nth(wrong).click())
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['source'] == 'pointer', f'{tag}: a wrong answer by pointer scores wrong ({r["result"]}, {r["source"]})')
    marks = frame.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => b.className)")
    C.ok(any('is-wrong' in m for m in marks) and any('is-missed' in m for m in marks), f'{tag}: the grid marks the wrong pick and the missed answer')
    tags = frame.evaluate("() => Array.from(document.querySelectorAll('.ex-fold-verdict:not([hidden]), .ex-fold-opt .ex-tag:not([hidden])')).map((e) => e.textContent)")
    C.ok(len(tags) == h['n'] + 1 and sum('✓' in t for t in tags) == 2 and all(len(t) >= 6 for t in tags), f'{tag}: the truth in words under every sheet and in the verdict ({tags})')


def show_me(frame, tag, page=None, click=None):
    before = frame.evaluate('() => __harness.played.finished')
    if click is not None:
        click.click()
    elif page is not None:
        page.keyboard.press('s')
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=40000)
    C.ok(True, f'{tag}: show me ran to the end ({frame.evaluate("() => __harness.played.ms")} ms)')
    end = frame.evaluate(CELLS_JS, '.ex-fold-svg--big .ex-fold-hole')
    key = frame.evaluate('() => __harness.item.options[__harness.key]')
    C.ok(end == sort_cells(key), f'{tag}: show me ends on the flat sheet with exactly the key\'s holes ({len(end)} holes)')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for name0, params, seed in SETS:
            for theme in ('light', 'dark'):
                name = f'fold_{name0}_{tag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex='fold', seed=seed, p=params, fast=1, theme=theme))
                page.wait_for_function(READY, timeout=30000)
                stage_ok(page, name)
                stem_ok(page, name)
                options_ok(page, name)
                shot(page, name + '.png')
                if phone:
                    sw = page.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
                    C.ok(sw[0] <= sw[1], f'{name}: no horizontal scroll ({sw})')
                if theme == 'light':
                    answer_keyboard(page, page, name)
                    shot(page, name + '_reveal.png')
                    show_me(page, name, page=page)
                    page.keyboard.press('Space')  # next
                    page.wait_for_function(READY, timeout=10000)
                    answer_pointer(page, page, name, tap=phone)
                    shot(page, name + '_wrong.png')
                    show_me(page, name + ' (Show me button)', click=page.locator('.hx-feedback-actions .px-btn').first)
                    shot(page, name + '_showme_end.png')
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
    for name0, params, seed, rm in (('corner', SETS[1][1], 4, 0), ('corner', SETS[1][1], 4, 1)):
        page.goto(file_url('tests/dev/harness.html', ex='fold', seed=seed, p=params, rm=rm))
        page.wait_for_function(READY, timeout=30000)
        page.evaluate('() => __harness.answer(false)')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(2600)
        shot(page, f'fold_{name0}_1366_light_showme{"_rm" if rm else ""}.png')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
        page.wait_for_timeout(200)
        shot(page, f'fold_{name0}_1366_light_showme_end{"_rm" if rm else ""}.png')
        pl = page.evaluate('() => __harness.played')
        f = page.evaluate('() => __harness.item.folds.length')
        times[f'{name0}{"_rm" if rm else ""}'] = {'planned': round(pl['plannedMs'] / 1000, 2), 'wall': round(pl['ms'] / 1000, 2), 'folds': f}
    t = times['corner']
    # punched (1.6 s) + per fold an unfold and a hold (≤ 2.5 s) + flat sheet (1.8 s) + the chosen sheet (2.4 s)
    C.ok(1.6 + 1.2 * t['folds'] + 4.2 <= t['planned'] <= 1.6 + 2.5 * t['folds'] + 4.2 + 0.01, f'show me takes 1.2–2.5 s per unfold plus the start and the end ({times})')
    C.ok(times['corner_rm']['planned'] < t['planned'], f'reduced motion makes show me shorter ({times})')
    page.goto(file_url('tests/dev/harness.html', ex='fold', seed=6, p='folds:1,type:0'))
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
    page.wait_for_function(STATE, arg='reveal', timeout=60000)
    C.ok(True, 'pause, step and replay, then show me ends')
    # The tutorial demo plays to the end with captions (fast).
    page.goto(file_url('tests/dev/harness.html', ex='fold', seed=1, fast=1))
    page.wait_for_function(READY, timeout=30000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=30000)
    cap = page.locator('.hx-caption').inner_text()
    C.ok(len(cap) > 10, f'the demo plays to the end with captions ({cap!r})')
    demo = page.evaluate('() => ({ folds: __harness.item.folds.length, holes: __harness.item.holes })')
    C.ok(demo['folds'] == 1 and demo['holes'] == 2, f'the demo item is one fold with two holes ({demo})')
    ctx.close()
    return times


def sandboxed(b, cons):
    doc = harness_single('fold', {'seed': 21, 'p': SETS[1][1], 'fast': True})
    host = srcdoc_host('harness_fold', doc)
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=60000)
    env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href, css: !!Array.from(document.styleSheets).find((s) => { try { return Array.from(s.cssRules).some((r) => (r.selectorText || "").indexOf(".ex-fold-strip") >= 0); } catch (e) { return false; } }) })')
    C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc: runs in a sandboxed srcdoc frame ({env})')
    C.ok(env['css'], 'srcdoc: css/ex/fold.css is inlined')
    stage_ok(fr, 'srcdoc')
    options_ok(fr, 'srcdoc')
    fr.locator('.hx-goal').click()
    answer_keyboard(page, fr, 'srcdoc')
    show_me(fr, 'srcdoc', page=page)
    shot(page, 'fold_srcdoc.png')
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
    return C.summary({'showMeSeconds': times, 'screenshots': sorted(p.name for p in DIR.glob('fold_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
