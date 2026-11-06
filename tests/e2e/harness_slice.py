"""E2E: the dev harness with Slice (EX-06, cross-sections).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_slice.py   (two browser slots per machine)

1. desktop 1366 x 768 and phone 412 x 880 (DPR 2, touch), light and dark, every structure (simple,
   joined, embedded) with each kind of cut: the stage has non-blank pixels, the four options are
   outlines (nested loops drawn as an inner region); a right answer by keyboard and a wrong one by
   pointer (tap on the phone) score as expected and are marked; show me runs to the end (key S and
   the Show me button) and lands its outline on the right option; no horizontal scroll
2. show me at normal speed: planned 2-4 s per movement, shorter with reduced motion; Pause, Step,
   Replay; the tutorial demo plays to the end with captions; a context loss voids the trial
3. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard
4. no console errors anywhere
Screenshots: tests/e2e/out/slice/slice_<case>_<viewport>_<theme>[_reveal|_wrong|_showme].png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_slice')
DIR = OUT / 'slice'
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
# (name, params, seed): every structure, every cut, curved and straight solids
CASES = [
    ('simple', 'structure:0,cut:0,curved:0', 1),
    ('joined', 'structure:1,cut:1,curved:0', 1502),  # the barn the item-validity review misread
    ('embedded', 'structure:2,cut:2,curved:1', 3),
]


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def stage_ok(target, tag):
    ok, s = non_blank(target.locator('.ex-slice-stage').screenshot(), min_distinct=6, max_top=0.97)
    C.ok(ok, f'{tag}: the stage shows the solid and the plane ({s})')
    # The solid's edges are drawn after the translucent plane (never washed out under it), and the
    # line where the plane meets the solid's visible faces is drawn (review: seed 1502, joined).
    pic = target.evaluate("() => PX.ex.view('slice').inspect()")
    C.ok(bool(pic) and pic['meet'] > 0 and pic['edges'] > 0 and pic['edgeOrder'] > pic['planeOrder'],
         f'{tag}: edges above the plane and the line where the plane meets the solid ({pic})')


def options_ok(target, tag):
    """Four outline drawings; nested loops (embedded solids) come with an inner region."""
    o = target.evaluate("""() => {
        const it = __harness.item;
        return Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b, i) => ({
            regions: b.querySelectorAll('.ex-slice-region').length,
            inner: b.querySelectorAll('.ex-slice-region--inner').length,
            d: (b.querySelector('.ex-slice-outline') || { getAttribute: () => '' }).getAttribute('d').length,
            loops: it.options[i].loops.length,
            w: Math.round(b.querySelector('svg').getBoundingClientRect().width),
        })); }""")
    C.ok(len(o) == 4 and all(x['d'] > 20 and x['regions'] >= 1 and x['w'] >= 60 for x in o), f'{tag}: four outline options, each at least 60 px wide ({o})')
    nested = target.evaluate("() => __harness.item.solid.structure === 'embedded'")
    if nested:
        C.ok(any(x['inner'] for x in o), f'{tag}: nested loops are drawn as an inner region ({o})')


def answer_keyboard(page, frame, tag):
    key = frame.evaluate('() => __harness.key')
    page.keyboard.press(str(key + 1))
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['source'] == 'key', f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')
    C.ok(r['rtMs'] >= 0, f'{tag}: the answer clock ran from the paint ({r["rtMs"]} ms)')
    tags = frame.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .ex-tag')).map((t) => [t.hidden, t.textContent, t.dataset.kind])")
    C.ok(len(tags) == 4 and all(not t[0] and t[1] for t in tags) and sum(t[2] == 'key' for t in tags) == 1,
         f'{tag}: reveal names every option, one of them the cut face ({tags})')


def answer_pointer(page, frame, tag, tap=False):
    key = frame.evaluate('() => __harness.key')
    wrong = (key + 1) % 4
    cell = frame.locator('.hx-grid .px-choice').nth(wrong)
    cell.tap() if tap else cell.click()
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['source'] == 'pointer', f'{tag}: a wrong answer by pointer scores wrong ({r["result"]}, {r["source"]})')
    marks = frame.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => b.className)")
    C.ok(any('is-wrong' in m for m in marks) and any('is-missed' in m for m in marks), f'{tag}: the grid marks the wrong pick and the missed answer')


def show_me(frame, tag, key='s', page=None, click=None):
    before = frame.evaluate('() => __harness.played.finished')
    if click is not None:
        click.click()
    elif page is not None:
        page.keyboard.press(key)
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=40000)
    ms = frame.evaluate('() => __harness.played.ms')
    landed = frame.evaluate("""() => { const b = document.querySelectorAll('.hx-grid .px-choice')[__harness.key];
        return { ghost: !!b.querySelector('.ex-slice-ghost'), stray: document.querySelectorAll('body > svg').length }; }""")
    C.ok(landed['ghost'] and landed['stray'] == 0, f'{tag}: show me ran to the end ({ms} ms) and left the cut face on the right option ({landed})')
    return ms


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for case, params, seed in CASES:
            for theme in ('light', 'dark'):
                name = f'slice_{case}_{tag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex='slice', seed=seed, p=params, fast=1, theme=theme))
                page.wait_for_function(READY, timeout=40000)
                stage_ok(page, name)
                options_ok(page, name)
                shot(page, name + '.png')
                if phone:
                    sw = page.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
                    C.ok(sw[0] <= sw[1], f'{name}: no horizontal scroll ({sw})')
                if theme == 'light':
                    answer_keyboard(page, page, name)
                    shot(page, name + '_reveal.png')
                    show_me(page, name, page=page)
                    shot(page, name + '_showme.png')
                    page.keyboard.press('Space')  # next
                    page.wait_for_function(READY, timeout=10000)
                    answer_pointer(page, page, name, tap=phone)
                    shot(page, name + '_wrong.png')
                    show_me(page, name + ' (Show me button)', click=page.locator('.hx-feedback-actions .px-btn').first)
                    shot(page, name + '_wrong_showme.png')
                else:
                    page.evaluate('() => __harness.answer(false)')
                    page.wait_for_function(STATE, arg='reveal', timeout=10000)
                    show_me(page, name)
                    shot(page, name + '_showme.png')
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    times = {}
    for name, rm in (('normal', 0), ('reduced', 1)):
        page.goto(file_url('tests/dev/harness.html', ex='slice', seed=3, p='structure:2,cut:1,curved:1', rm=rm))
        page.wait_for_function(READY, timeout=40000)
        page.evaluate('() => __harness.answer(true)')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(2500)
        shot(page, f'slice_embedded_1366_light_showme_mid{"_rm" if rm else ""}.png')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=90000)
        page.wait_for_timeout(200)
        shot(page, f'slice_embedded_1366_light_showme_end{"_rm" if rm else ""}.png')
        pl = page.evaluate('() => __harness.played')
        n = page.evaluate('() => PX.ex.view("slice").steps(__harness.item, __harness.last.response).length')
        times[name] = {'planned': round(pl['plannedMs'] / 1000, 2), 'wall': round(pl['ms'] / 1000, 2), 'steps': n}
    # Movements: the sweep, the lift, the turn and the flight (2-4 s each, the lift shorter), plus
    # one still step about the slanted view.
    C.ok(6.0 <= times['normal']['planned'] <= 14.0, f'show me plans 6-14 s for four movements and one still step ({times["normal"]})')
    C.ok(times['reduced']['planned'] < times['normal']['planned'], f'reduced motion makes show me shorter ({times})')
    # Pause, Step and Replay work and the run still ends.
    page.goto(file_url('tests/dev/harness.html', ex='slice', seed=6, p='structure:0,cut:1,curved:0'))
    page.wait_for_function(READY, timeout=40000)
    page.evaluate('() => __harness.answer(false)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    page.keyboard.press('s')
    page.wait_for_function(STATE, arg='showme', timeout=5000)
    page.keyboard.press('Space')  # pause
    page.wait_for_timeout(600)
    paused = page.locator('.hx-player-buttons .px-btn').first.inner_text()
    C.ok('Resume' in paused, f'Space pauses show me ({paused!r})')
    page.keyboard.press('ArrowRight')  # step
    page.keyboard.press('r')           # replay (plays again)
    page.wait_for_function(STATE, arg='reveal', timeout=60000)
    C.ok(True, 'pause, step and replay, then show me ends')
    # The tutorial demo plays to the end with captions (fast).
    page.goto(file_url('tests/dev/harness.html', ex='slice', seed=1, fast=1))
    page.wait_for_function(READY, timeout=40000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=40000)
    cap = page.locator('.hx-caption').inner_text()
    C.ok(len(cap) > 10, f'the demo plays to the end with captions ({cap!r})')
    shot(page, 'slice_demo_end.png')
    # A lost WebGL context voids the trial; the view comes back after the restore.
    page.goto(file_url('tests/dev/harness.html', ex='slice', seed=8, p='structure:1,cut:0,curved:1', fast=1))
    page.wait_for_function(READY, timeout=40000)
    page.evaluate('() => { const r = PX.core.stage3d.renderer(); r.forceContextLoss(); setTimeout(() => r.forceContextRestore(), 400); }')
    page.wait_for_timeout(1500)
    lost = page.evaluate('() => PX.core.stage3d.isLost()')
    stage_ok(page, 'after a context loss and restore')
    page.evaluate('() => __harness.answer(true)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    last = page.evaluate('() => __harness.last')
    C.ok(not lost and last.get('void') is True, f'a context loss voids the trial and the 3D view is restored (lost now {lost}, void {last.get("void")})')
    ctx.close()
    return times


def sandboxed(b, cons):
    doc = harness_single('slice', {'seed': 21, 'p': 'structure:2,cut:0,curved:1', 'fast': True})
    host = srcdoc_host('harness_slice', doc)
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=60000)
    env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href, css: !!getComputedStyle(document.querySelector(".ex-slice-stage")).height })')
    C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc: runs in a sandboxed srcdoc frame ({env})')
    stage_ok(fr, 'srcdoc')
    options_ok(fr, 'srcdoc')
    fr.locator('.hx-goal').click()  # focus inside the frame, so keys reach it
    answer_keyboard(page, fr, 'srcdoc')
    show_me(fr, 'srcdoc', page=page)
    shot(page, 'slice_srcdoc.png')
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
    warnings = [w for c in cons for w in c.warnings()]
    return C.summary({'showMeSeconds': times, 'warnings': warnings[:10], 'screenshots': sorted(p.name for p in DIR.glob('slice_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
