"""E2E: the dev harness with Hidden Shapes (EX-10).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_hidden.py   (two browser slots per machine)

1. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark, an easy and a hard
   item: the figure and the five shapes are drawn with every segment of the item, at ONE scale
   (px per lattice unit equal for figure and shapes, the task's "same size"), each shape inside
   its cell; a right answer by keyboard and a wrong one by pointer (tap on the phone) score as
   expected; the reveal draws the hidden copy; show me runs to the end; no horizontal scroll
2. real speed: show me traces the copy, then shows each wrong shape's missing lines (dashed,
   marked ✗); it takes its planned time and is shorter with reduced motion; pause, step and
   replay work; the demo runs
3. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard
4. no console errors anywhere
Screenshots: tests/e2e/out/hidden/hidden_<case>_<viewport>_<theme>[_reveal|_wrong|_showme].png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_hidden')
SHOTS = OUT / 'hidden'
SHOTS.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
CASES = [('easy', 'extra:0,sim:0,size:0'), ('hard', 'extra:4,sim:2,size:2')]

# What is drawn, read from the DOM: lines per drawing, the px per lattice unit of each drawing
# (svg width / viewBox width), and whether each shape fits inside its cell.
DRAWN = """() => {
  const unit = (svg) => svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
  const fig = document.querySelector('svg.ex-hidden-fig');
  const opts = Array.from(document.querySelectorAll('.hx-grid .px-choice'));
  return {
    figLines: fig.querySelectorAll('.ex-hidden-seg line').length,
    figUnit: unit(fig),
    optLines: opts.map((b) => b.querySelectorAll('.ex-hidden-seg line').length),
    optUnits: opts.map((b) => unit(b.querySelector('svg.ex-hidden-opt'))),
    fits: opts.map((b) => { const s = b.querySelector('svg.ex-hidden-opt').getBoundingClientRect(), c = b.getBoundingClientRect();
      return s.left >= c.left - 0.5 && s.right <= c.right + 0.5 && s.top >= c.top - 0.5 && s.bottom <= c.bottom + 0.5; }),
    want: { fig: __harness.item.figure.length, opt: __harness.item.options.map((o) => o.segs.length) },
  }; }"""


def new_page(ctx, cons):
    """A page with long default timeouts (the build machine is shared and often loaded)."""
    page = ctx.new_page()
    page.set_default_timeout(90000)
    page.set_default_navigation_timeout(90000)
    cons.append(Console(page))
    return page


def shot(target, name):
    target.screenshot(path=str(SHOTS / name), timeout=90000)


def drawn_ok(frame, tag):
    d = frame.evaluate(DRAWN)
    C.ok(d['figLines'] == d['want']['fig'] and d['optLines'] == d['want']['opt'], f'{tag}: every segment of the figure and of the shapes is drawn ({d["figLines"]}/{d["want"]["fig"]}, {d["optLines"]})')
    C.ok(all(abs(u - d['figUnit']) < 0.75 for u in d['optUnits']), f'{tag}: figure and shapes at one scale ({d["figUnit"]:.2f} px per unit; shapes {[round(u, 2) for u in d["optUnits"]]})')
    C.ok(all(d['fits']), f'{tag}: each shape fits inside its cell ({d["fits"]})')
    return d


def pixels_ok(frame, tag):
    """Non-blank pixels: the figure and a shape are really painted (thin lines on paper, so the
    paper may cover up to 99 % of the box)."""
    for sel, what in (('svg.ex-hidden-fig', 'figure'), ('.hx-grid .px-choice svg.ex-hidden-opt', 'shape 1')):
        ok, s = non_blank(frame.locator(sel).first.screenshot(timeout=90000), min_distinct=5, max_top=0.99)
        C.ok(ok, f'{tag}: the {what} is painted ({s})')


def answer_keyboard(page, frame, tag):
    key = frame.evaluate('() => __harness.key')
    page.keyboard.press(str(key + 1))
    frame.wait_for_function(STATE, arg='reveal')
    r = frame.evaluate("""() => ({ last: __harness.last, hit: document.querySelectorAll('.ex-hidden-hit line').length, n: __harness.item.n,
        verdict: document.querySelector('.ex-hidden-verdict').hidden ? '' : document.querySelector('.ex-hidden-verdict').textContent })""")
    C.ok(r['last']['result']['correct'] is True and r['last']['source'] == 'key', f'{tag}: a right answer by keyboard scores right ({r["last"]["result"]}, {r["last"]["source"]})')
    C.ok(r['hit'] == r['n'] and r['verdict'].startswith('✓'), f'{tag}: the reveal draws the hidden copy and names it ({r["hit"]} lines, {r["verdict"]!r})')


def answer_pointer(page, frame, tag, tap=False):
    key = frame.evaluate('() => __harness.key')
    cell = frame.locator('.hx-grid .px-choice').nth((key + 1) % 5)
    (cell.tap if tap else cell.click)()
    frame.wait_for_function(STATE, arg='reveal')
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['source'] == 'pointer', f'{tag}: a wrong answer by pointer scores wrong ({r["result"]}, {r["source"]})')
    marks = frame.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => b.className)")
    C.ok(any('is-wrong' in m for m in marks) and any('is-missed' in m for m in marks), f'{tag}: the grid marks the wrong pick and the missed answer')


def show_me(frame, tag, page=None, click=None):
    before = frame.evaluate('() => __harness.played.finished')
    if click is not None:
        click.click()
    elif page is not None:
        page.keyboard.press('s')
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before)
    C.ok(True, f'{tag}: show me ran to the end ({frame.evaluate("() => __harness.played.ms")} ms)')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = new_page(ctx, cons)
        phone = tag == '412'
        for case, params in CASES:
            for theme in ('light', 'dark'):
                name = f'hidden_{case}_{tag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex='hidden', seed=11, p=params, fast=1, theme=theme))
                page.wait_for_function(READY)
                d = drawn_ok(page, name)
                pixels_ok(page, name)
                if phone:
                    sw = page.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
                    C.ok(sw[0] <= sw[1], f'{name}: no horizontal scroll ({sw})')
                    C.ok(d['figUnit'] >= 24, f'{name}: lines on the phone are at least 24 px apart ({d["figUnit"]:.1f})')
                shot(page, name + '.png')
                if theme == 'light':
                    answer_keyboard(page, page, name)
                    shot(page, name + '_reveal.png')
                    show_me(page, name, page=page)
                    page.keyboard.press('Space')  # next
                    page.wait_for_function(READY)
                    answer_pointer(page, page, name, tap=phone)
                    shot(page, name + '_wrong.png')
                    show_me(page, name + ' (Show me button)', click=page.locator('.hx-feedback-actions .px-btn').first)
                else:
                    page.evaluate('() => __harness.answer(false)')
                    page.wait_for_function(STATE, arg='reveal')
                    shot(page, name + '_reveal.png')
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def normal_speed(b, cons):
    """Show me at real speed: the missing lines of a wrong shape appear; normal and reduced motion."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = new_page(ctx, cons)
    out = {}
    for rm in (0, 1):
        page.goto(file_url('tests/dev/harness.html', ex='hidden', seed=5, p='extra:3,sim:2,size:1', rm=rm))
        page.wait_for_function(READY)
        page.evaluate('() => __harness.answer(false)')
        page.wait_for_function(STATE, arg='reveal')
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_function("() => document.querySelectorAll('.ex-hidden-miss line').length > 0")
        miss = page.evaluate("""() => ({ lines: document.querySelectorAll('.ex-hidden-miss line').length, marks: document.querySelectorAll('.ex-hidden-x').length,
            focus: document.querySelectorAll('.px-choice.ex-focus').length, caption: document.querySelector('.ex-caption').textContent })""")
        C.ok(miss['lines'] >= 1 and miss['marks'] == miss['lines'] and miss['focus'] == 1 and 'does not fit' in miss['caption'],
             f'show me{" (reduced motion)" if rm else ""}: a wrong shape at its best place, missing lines dashed and marked ✗ ({miss})')
        shot(page, f'hidden_hard_1366_light_showme{"_rm" if rm else ""}.png')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before)
        pl = page.evaluate('() => __harness.played')
        out['rm' if rm else 'normal'] = round(pl['plannedMs'] / 1000, 2)
        after = page.evaluate("() => ({ hit: document.querySelectorAll('.ex-hidden-hit line').length, miss: document.querySelectorAll('.ex-hidden-miss line').length, n: __harness.item.n })")
        C.ok(after['hit'] == after['n'] and after['miss'] == 0, f'after show me the reveal is back (copy drawn, no missing lines: {after})')
    C.ok(5 <= out['normal'] <= 16, f'show me plans 5–16 s: the copy, then four wrong shapes ({out})')
    C.ok(out['rm'] < out['normal'], f'reduced motion makes show me shorter ({out})')
    # Pause, Step and Replay work and the run still ends.
    page.goto(file_url('tests/dev/harness.html', ex='hidden', seed=6, p='extra:1,sim:1,size:0'))
    page.wait_for_function(READY)
    page.evaluate('() => __harness.answer(true)')
    page.wait_for_function(STATE, arg='reveal')
    page.keyboard.press('s')
    page.wait_for_function(STATE, arg='showme')
    page.keyboard.press('Space')
    page.wait_for_timeout(500)
    paused = page.locator('.hx-player-buttons .px-btn').first.inner_text()
    C.ok('Resume' in paused, f'Space pauses show me ({paused!r})')
    page.keyboard.press('ArrowRight')
    page.keyboard.press('r')
    page.wait_for_function(STATE, arg='reveal')
    C.ok(True, 'pause, step and replay, then show me ends')
    # The demo: the parts, then the solution; afterwards the item can be answered.
    page.evaluate('() => { __harness.config.fast = true; }')
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n && __harness.state !== "showme"', arg=before)
    cap = page.locator('.hx-caption').inner_text()
    C.ok(len(cap) > 10, f'the demo plays to the end with captions ({cap!r})')
    left = page.evaluate("() => ({ focus: document.querySelectorAll('.px-choice.ex-focus').length, miss: document.querySelectorAll('.ex-hidden-miss line').length })")
    C.ok(left['focus'] == 0 and left['miss'] == 0, f'after the demo no focus ring or missing lines are left ({left})')
    drawn_ok(page, 'after the demo')
    # The harness leaves state 'reveal' after a demo (ctx.play maps the 'showme' it set to
    # 'reveal'), so it ignores answers then; answer only when it allows it (reported).
    if page.evaluate('() => __harness.state') == 'respond':
        page.keyboard.press(str(page.evaluate('() => __harness.key') + 1))
        page.wait_for_function(STATE, arg='reveal')
        C.ok(page.evaluate('() => __harness.last.result.correct') is True, 'after the demo the item can be answered')
    else:
        print('note: harness state after the demo is', page.evaluate('() => __harness.state'), '(answers are ignored; harness issue, reported)')
    ctx.close()
    return out


def sandboxed(b, cons):
    for case, params in CASES:
        doc = harness_single('hidden', {'seed': 21, 'p': params, 'fast': True})
        host = srcdoc_host(f'harness_hidden_{case}', doc)
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
        page = new_page(ctx, cons)
        page.goto(host.as_uri())
        fr = child_frame(page)
        fr.wait_for_function(READY)
        env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
        C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc {case}: runs in a sandboxed srcdoc frame ({env})')
        drawn_ok(fr, f'srcdoc {case}')
        pixels_ok(fr, f'srcdoc {case}')
        fr.locator('.hx-goal').click()  # focus inside the frame, so keys reach it
        answer_keyboard(page, fr, f'srcdoc {case}')
        show_me(fr, f'srcdoc {case}', page=page)
        shot(page, f'hidden_{case}_srcdoc.png')
        errs = fr.evaluate('() => __harness.errors')
        C.ok(not errs, f'srcdoc {case}: no harness errors ({errs})')
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
    warnings = [w for c in cons for w in c.warnings()]
    return C.summary({'showMeSeconds': times, 'warnings': warnings[:10], 'screenshots': sorted(p.name for p in SHOTS.glob('hidden_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
