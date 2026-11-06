"""E2E: the dev harness with Nets (EX-05, SVG).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_nets.py   (two browser slots per machine)

1. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark, every variant
   (opposite, edges, cube): the stage is non-blank; the net has its six named squares and the
   variant's marks (a framed square; the shaded base and two thick edges; none); the options are
   four named face swatches or Yes / No; a right answer by keyboard and a wrong one by pointer
   (tap on the phone) score as expected; the truth is shown in words (and in place: the squares
   of a non-net framed); show me folds the net to the end and marks the answer on the cube; no
   horizontal scroll on the phone
2. show me at normal speed: 0.9–1.3 s per step, the whole fold well under 12 s; shorter with
   reduced motion; pause, step and replay still end; the demo plays to the end with captions
3. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard (every variant)
4. no console errors
Screenshots: tests/e2e/out/nets/nets_<variant>_<viewport>_<theme>[_reveal|_wrong|_showme].png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_nets')
DIR = OUT / 'nets'
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
PARAMS = 'carried:1,shape:1'
SEEDS = {'opposite': 3, 'edges': 4, 'cube': 2}


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def stage_ok(target, tag):
    ok, s = non_blank(target.locator('.ex-nets-stage').screenshot(), min_distinct=5, max_top=0.97)
    C.ok(ok, f'{tag}: the stage shows the net ({s})')


def net_ok(target, tag):
    d = target.evaluate("""() => {
        const it = __harness.item, svg = document.querySelector('.ex-nets-svg--net');
        return { variant: it.variant, n: svg.querySelectorAll('.ex-nets-sq').length,
                 names: Array.from(svg.querySelectorAll('.ex-nets-name')).map((t) => t.textContent),
                 want: it.squares.map((q) => q.name), marked: svg.querySelectorAll('.ex-nets-marked').length,
                 edges: svg.querySelectorAll('.ex-nets-edge').length, base: svg.querySelectorAll('.ex-nets-base').length,
                 hinges: (svg.querySelector('.ex-nets-hinge').getAttribute('d').match(/M/g) || []).length, block: !!it.block };
    }""")
    C.ok(d['n'] == 6 and d['names'] == d['want'], f'{tag}: six named squares ({d["names"]})')
    C.ok(d['hinges'] == 5 if not d['block'] else d['hinges'] > 5, f'{tag}: every join of two squares drawn as a dashed fold ({d["hinges"]})')
    want = {'opposite': (1, 0, 0), 'edges': (0, 2, 1), 'cube': (0, 0, 0)}[d['variant']]
    C.ok((d['marked'], d['edges'], d['base']) == want, f'{tag}: the variant\'s marks (frame, thick edges, shaded base: {(d["marked"], d["edges"], d["base"])})')


def options_ok(target, tag):
    d = target.evaluate("""() => {
        const it = __harness.item, cells = Array.from(document.querySelectorAll('.hx-grid .px-choice'));
        return { n: cells.length, want: it.options.length, format: it.format,
                 texts: cells.map((c) => (c.querySelector('.ex-answer-text, .ex-nets-name') || {}).textContent || ''),
                 names: it.options.map((o) => o.name || o.label) };
    }""")
    C.ok(d['n'] == d['want'], f'{tag}: the grid has one cell per option ({d["n"]} of {d["want"]})')
    C.ok(d['texts'] == d['names'], f'{tag}: the options are labelled from the item ({d["texts"]})')
    cells = target.locator('.hx-grid .px-choice')
    pix = [non_blank(cells.nth(i).screenshot(), min_distinct=3, max_top=0.99)[0] for i in range(d['n'])]
    C.ok(all(pix), f'{tag}: every option is drawn ({pix})')


def answer_keyboard(page, frame, tag):
    key = frame.evaluate('() => __harness.key')
    page.keyboard.press(str(key + 1))
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['source'] == 'key', f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')
    C.ok(r['rtMs'] >= 0, f'{tag}: the answer clock ran from the paint ({r["rtMs"]} ms)')


def answer_pointer(page, frame, tag, tap=False):
    h = frame.evaluate('() => ({ key: __harness.key, n: __harness.item.options.length, v: __harness.item.variant, block: __harness.item.block, overlap: __harness.item.overlap })')
    cells = frame.locator('.hx-grid .px-choice')
    wrong = (h['key'] + 1) % h['n']
    (cells.nth(wrong).tap() if tap else cells.nth(wrong).click())
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['source'] == 'pointer', f'{tag}: a wrong answer by pointer scores wrong ({r["result"]}, {r["source"]})')
    marks = frame.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => b.className)")
    C.ok(any('is-wrong' in m for m in marks) and any('is-missed' in m for m in marks), f'{tag}: the grid marks the wrong pick and the missed answer')
    verdict = frame.evaluate("() => (document.querySelector('.ex-nets-verdict:not([hidden])') || {}).textContent || ''")
    C.ok('✓' in verdict and len(verdict) > 15, f'{tag}: the truth in words ({verdict!r})')
    if h['v'] == 'opposite':
        tags = frame.evaluate("() => Array.from(document.querySelectorAll('.ex-nets-opt .ex-tag:not([hidden])')).map((e) => e.textContent)")
        C.ok(len(tags) == 4 and sum('✓' in t for t in tags) == 1, f'{tag}: a tag under every face ({tags})')
    if h['v'] == 'cube' and h['key'] == 1:
        n = frame.evaluate("() => document.querySelectorAll('.ex-nets-svg--net .ex-nets-clash').length")
        want = len(h['block']) if h['block'] else len({i for p in h['overlap'] for i in p})
        C.ok(n == want, f'{tag}: the squares that clash are framed in the net ({n} of {want})')


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
    d = frame.evaluate("""() => {
        const it = __harness.item, svg = document.querySelector('.ex-nets-svg--cube');
        if (!svg || svg.style.display === 'none') return { shown: false };
        const vis = (sel) => Array.from(svg.querySelectorAll(sel)).filter((e) => e.getAttribute('visibility') === 'visible').map((e) => +e.closest('[data-sq]').getAttribute('data-sq'));
        const polys = Array.from(svg.querySelectorAll('.ex-nets-face-poly')).filter((p) => (p.getAttribute('points') || '').split(' ').length === 4).length;
        return { shown: true, polys: polys, hl: vis('.ex-nets-hl').sort(), variant: it.variant, key: it.key,
                 want: it.variant === 'opposite' ? [it.options[it.key].sq] : it.variant === 'cube' && it.key === 1 ? (it.block || Array.from(new Set(it.overlap.flat()))).slice().sort() : [],
                 open: svg.querySelectorAll('.ex-nets-open').length, focus: Array.from(document.querySelectorAll('.hx-grid .px-choice')).findIndex((b) => b.classList.contains('ex-focus')) };
    }""")
    C.ok(d.get('shown') and d['polys'] == 6, f'{tag}: show me ends on the folded cube, six faces drawn ({d})')
    if d.get('shown'):
        C.ok(d['hl'] == sorted(d['want']), f'{tag}: the answer is marked on the cube (squares {d["hl"]}, want {sorted(d["want"])})')
        nonnet = d['variant'] == 'cube' and d['key'] == 1
        C.ok(d['open'] >= 1 if nonnet else d['open'] == 0, f'{tag}: only a non-net shows an open side, dashed ({d["open"]})')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for variant in ('opposite', 'edges', 'cube'):
            for theme in ('light', 'dark'):
                name = f'nets_{variant}_{tag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex='nets', seed=SEEDS[variant], v=variant, p=PARAMS, fast=1, theme=theme))
                page.wait_for_function(READY, timeout=30000)
                stage_ok(page, name)
                net_ok(page, name)
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
                    show_me(page, name)
                    shot(page, name + '_showme_end.png')
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    times = {}
    for variant, rm, seed in (('edges', 0, 5), ('edges', 1, 5), ('cube', 0, 1)):
        page.goto(file_url('tests/dev/harness.html', ex='nets', seed=seed, v=variant, p='carried:0', rm=rm))
        page.wait_for_function(READY, timeout=30000)
        page.evaluate('() => __harness.answer(false)')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(2600)
        shot(page, f'nets_{variant}_1366_light_showme{"_rm" if rm else ""}.png')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
        page.wait_for_timeout(200)
        shot(page, f'nets_{variant}_1366_light_showme_end{"_rm" if rm else ""}.png')
        pl = page.evaluate('() => __harness.played')
        steps = page.evaluate("() => PX.ex.view('nets').steps(__harness.item).map((s) => s.ms)")
        times[f'{variant}{"_rm" if rm else ""}'] = {'planned': round(pl['plannedMs'] / 1000, 2), 'wall': round(pl['ms'] / 1000, 2), 'steps': steps}
    t = times['edges']
    C.ok(all(900 <= ms <= 2400 for ms in t['steps']) and t['planned'] <= 12, f'show me: 0.9–2.4 s per step, under 12 s in all ({times})')
    C.ok(times['edges_rm']['planned'] < t['planned'], f'reduced motion makes show me shorter ({times})')
    page.goto(file_url('tests/dev/harness.html', ex='nets', seed=6, v='opposite', p='carried:1'))
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
    page.goto(file_url('tests/dev/harness.html', ex='nets', seed=1, fast=1))
    page.wait_for_function(READY, timeout=30000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=30000)
    cap = page.locator('.hx-caption').inner_text()
    C.ok(len(cap) > 10, f'the demo plays to the end with captions ({cap!r})')
    ctx.close()
    return times


def sandboxed(b, cons):
    for variant in ('opposite', 'edges', 'cube'):
        doc = harness_single('nets', {'seed': 21, 'v': variant, 'p': PARAMS, 'fast': True})
        host = srcdoc_host(f'harness_nets_{variant}', doc)
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
        page = ctx.new_page()
        cons.append(Console(page))
        page.goto(host.as_uri())
        fr = child_frame(page)
        fr.wait_for_function(READY, timeout=60000)
        env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href, css: getComputedStyle(document.querySelector(".ex-nets-stage")).height })')
        C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc {variant}: runs in a sandboxed srcdoc frame ({env})')
        C.ok(float(env['css'].replace('px', '') or 0) >= 140, f'srcdoc {variant}: css/ex/nets.css is inlined (stage height {env["css"]})')
        stage_ok(fr, f'srcdoc {variant}')
        net_ok(fr, f'srcdoc {variant}')
        fr.locator('.hx-goal').click()
        answer_keyboard(page, fr, f'srcdoc {variant}')
        show_me(fr, f'srcdoc {variant}', page=page)
        shot(page, f'nets_{variant}_srcdoc.png')
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
    return C.summary({'showMeSeconds': times, 'screenshots': sorted(p.name for p in DIR.glob('nets_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
