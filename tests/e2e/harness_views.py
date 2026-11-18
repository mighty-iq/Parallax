"""E2E: the dev harness with Views (EX-07, orthographic views).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_views.py   (two browser slots per machine)

1. desktop 1366 x 768 and phone 412 x 880 (DPR 2, touch), light and dark, every variant (toview,
   toobject, count): the stage has non-blank pixels; toview options are line drawings, toobject
   options non-blank 3D thumbnails under the three views (top, front, right), count options numbers;
   a right answer by keyboard and a wrong one by pointer (tap on the phone) score as expected and
   are marked; show me runs to the end (key S and the Show me button) and ends on the model's
   answer (toview: the traced view laid on the right drawing; toobject: the three views laid on the
   stem drawings, the differing view marked; count: one height tag per column); no horizontal scroll
2. show me at normal speed: planned 2-4 s per movement, shorter with reduced motion; Pause, Step,
   Replay; the tutorial demo plays to the end with captions; a context loss voids the trial
3. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard (every variant)
4. no console errors anywhere
5. the v1.2 starter level (tests/e2e/band_a.py): top and front items at 360 x 640, Try 1 with the
   asked view's outline drawn (w x h cells, as the key), the rules card; show me after a wrong pick
   of each foil kind ends with the key's drawing laid on it
Screenshots: tests/e2e/out/views/views_<variant>_<viewport>_<theme>[_reveal|_wrong|_showme].png """
import sys

from playwright.sync_api import sync_playwright

from band_a import band_checks, reveal_stable, wtg_checks
from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_views')
DIR = OUT / 'views'
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
CASES = {  # variant: (params, seed); cubes level 0 is the v1.2 starter level, so 1.1's levels are one up
    'toview': ('cubes:3,grid:0,view:1', 1),
    'toobject': ('cubes:3,grid:1', 2),
    'count': ('cubes:4,grid:1', 3),
}


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def stage_ok(target, tag):
    ok, s = non_blank(target.locator('.ex-views-stage').screenshot(), min_distinct=6, max_top=0.97)
    C.ok(ok, f'{tag}: the stage shows the structure or its views ({s})')


def thumbs(target):
    return target.evaluate("""() => Array.from(document.querySelectorAll('.hx-grid .ex-thumb')).map((c) => {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let fig = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { n++; if (d[i + 3] > 0) fig++; }
        return Math.round(1000 * fig / n) / 1000; })""")


def options_ok(target, variant, tag):
    if variant == 'toview':
        o = target.evaluate("""() => Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => ({
            d: (b.querySelector('.ex-views-line') || { getAttribute: () => '' }).getAttribute('d').length,
            w: Math.round(b.querySelector('svg').getBoundingClientRect().width) }))""")
        C.ok(len(o) == 4 and all(x['d'] > 10 and x['w'] >= 60 for x in o), f'{tag}: four line drawings, each at least 60 px wide ({o})')
        sizes = target.evaluate("() => Array.from(document.querySelectorAll('.hx-grid svg')).map((s) => s.getAttribute('viewBox'))")
        C.ok(len(set(sizes)) == 1, f'{tag}: the drawings share one scale ({sizes})')
    elif variant == 'toobject':
        t = thumbs(target)
        C.ok(len(t) == 4 and all(x >= 0.05 for x in t), f'{tag}: four non-blank structure thumbnails ({t})')
        labels = target.evaluate("() => Array.from(document.querySelectorAll('.ex-views-draw .ex-views-dlabel')).map((x) => x.textContent)")
        C.ok(labels == ['Top', 'Front', 'Right'], f'{tag}: the stem shows the top, front and right views ({labels})')
    else:
        nums = target.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .ex-answer-text')).map((x) => +x.textContent)")
        C.ok(len(nums) == 4 and nums == sorted(nums) and len(set(nums)) == 4, f'{tag}: four different numbers, ascending ({nums})')


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


def end_state(frame):
    return frame.evaluate("""() => {
        const it = __harness.item, b = document.querySelectorAll('.hx-grid .px-choice')[it.key];
        return { variant: it.variant, ghost: !!b.querySelector('.ex-views-ghost'), ok: document.querySelectorAll('.ex-views-ok').length,
                 bad: document.querySelectorAll('.ex-views-bad').length, tags: document.querySelectorAll('.ex-views-tag--n').length,
                 cols: it.heights.flat().filter((h) => h > 0).length, focus: !!document.querySelector('.px-choice.ex-focus'),
                 stray: document.querySelectorAll('body > svg').length, wrong: !__harness.last.result.correct }; }""")


def show_me(frame, tag, key='s', page=None, click=None):
    before = frame.evaluate('() => __harness.played.finished')
    if click is not None:
        click.click()
    elif page is not None:
        page.keyboard.press(key)
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=60000)
    ms = frame.evaluate('() => __harness.played.ms')
    e = end_state(frame)
    if e['variant'] == 'toview':
        good = e['ghost']
    elif e['variant'] == 'toobject':
        good = (e['bad'] == 1) if e['wrong'] else (e['ok'] == 3)
    else:
        good = e['tags'] == e['cols'] and e['focus']
    C.ok(good and e['stray'] == 0, f'{tag}: show me ran to the end ({ms} ms) and ends on the model\'s answer ({e})')
    return ms


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for variant, (params, seed) in CASES.items():
            for theme in ('light', 'dark'):
                name = f'views_{variant}_{tag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex='views', seed=seed, v=variant, p=params, fast=1, theme=theme))
                page.wait_for_function(READY, timeout=40000)
                stage_ok(page, name)
                options_ok(page, variant, name)
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
    for variant, rm in (('toview', 0), ('toview', 1), ('toobject', 0), ('count', 0)):
        params, seed = CASES[variant]
        page.goto(file_url('tests/dev/harness.html', ex='views', seed=seed, v=variant, p=params, rm=rm))
        page.wait_for_function(READY, timeout=40000)
        page.evaluate('() => __harness.answer(true)')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(2600)
        shot(page, f'views_{variant}_1366_light_showme_mid{"_rm" if rm else ""}.png')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=120000)
        page.wait_for_timeout(200)
        shot(page, f'views_{variant}_1366_light_showme_end{"_rm" if rm else ""}.png')
        pl = page.evaluate('() => __harness.played')
        times[f'{variant}{"_rm" if rm else ""}'] = {'planned': round(pl['plannedMs'] / 1000, 2), 'wall': round(pl['ms'] / 1000, 2)}
    # toview: look, move, outline, inner lines, land (five steps of 1.4-2.5 s, v1.2); toobject: three
    # views of the key, each moved to, traced and laid on its drawing; count: one short step per column.
    C.ok(6.0 <= times['toview']['planned'] <= 12.0, f'show me for a view takes 6-12 s ({times["toview"]})')
    C.ok(times['toview_rm']['planned'] < times['toview']['planned'], f'reduced motion makes show me shorter ({times})')
    C.ok(times['toobject']['planned'] <= 4.0 * 4, f'show me for three views takes at most 4 s per view and the intro ({times["toobject"]})')
    C.ok(times['count']['planned'] <= 14.0, f'show me for a count takes at most 14 s ({times["count"]})')
    # Pause, Step and Replay work and the run still ends.
    page.goto(file_url('tests/dev/harness.html', ex='views', seed=6, v='toview', p='cubes:2,grid:0,view:2'))
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
    page.goto(file_url('tests/dev/harness.html', ex='views', seed=1, fast=1))
    page.wait_for_function(READY, timeout=40000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=40000)
    cap = page.locator('.hx-caption').inner_text()
    C.ok(len(cap) > 10, f'the demo plays to the end with captions ({cap!r})')
    shot(page, 'views_demo_end.png')
    # A lost WebGL context voids the trial; the view comes back after the restore.
    page.goto(file_url('tests/dev/harness.html', ex='views', seed=8, v='count', p='cubes:2,grid:0', fast=1))
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
    for variant, (params, seed) in CASES.items():
        doc = harness_single('views', {'seed': seed + 20, 'v': variant, 'p': params, 'fast': True})
        host = srcdoc_host(f'harness_views_{variant}', doc)
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
        page = ctx.new_page()
        cons.append(Console(page))
        page.goto(host.as_uri())
        fr = child_frame(page)
        fr.wait_for_function(READY, timeout=60000)
        env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
        C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc {variant}: runs in a sandboxed srcdoc frame ({env})')
        stage_ok(fr, f'srcdoc {variant}')
        options_ok(fr, variant, f'srcdoc {variant}')
        fr.locator('.hx-goal').click()  # focus inside the frame, so keys reach it
        answer_keyboard(page, fr, f'srcdoc {variant}')
        show_me(fr, f'srcdoc {variant}', page=page)
        shot(page, f'views_{variant}_srcdoc.png')
        errs = fr.evaluate('() => __harness.errors')
        C.ok(not errs, f'srcdoc {variant}: no harness errors ({errs})')
        ctx.close()


def outline_frame(C, page, tag):
    d = page.evaluate("""() => {
        const a = document.querySelector('.ex-views-assist'), it = __harness.item, k = it.options[it.key].drawing;
        const r = a ? a.getBoundingClientRect() : null, s = document.querySelector('.ex-views-stage').getBoundingClientRect();
        const t = document.querySelector('.ex-views-tag--ask'), tr = t && !t.hidden ? t.getBoundingClientRect() : null;
        const clear = !r || !tr || r.right <= tr.left || r.left >= tr.right || r.bottom <= tr.top || r.top >= tr.bottom;
        return { on: !!a, label: a ? a.textContent : '', want: k.w + ' × ' + k.h + ' cells', clear,
                 inside: !!r && r.left >= s.left - 1 && r.right <= s.right + 1 && r.top >= s.top - 1 && r.bottom <= s.bottom + 1,
                 lines: a ? a.querySelectorAll('.ex-views-assist-line').length : 0 };
    }""")
    C.ok(d['on'] and d['want'] in d['label'] and 'Step 2 done' in d['label'] and d['inside'] and d['lines'] == 1, f'{tag}: the asked view\'s outline is drawn in the stage, {d["want"]} cells as the key ({d})')
    C.ok(d['clear'], f'{tag}: the outline box leaves the view\'s tag ("TOP VIEW") clear ({d})')


def why_steps(b, cons):
    """Show me after a wrong pick of each foil kind ends with the key's drawing laid on the key."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    seen = set()
    for seed in range(50, 120):
        if len(seen) == 3:
            break
        page.goto(file_url('tests/dev/harness.html', ex='views', seed=seed, v='toview', p='cubes:3,grid:1,view:1', fast=1))  # all three foil kinds from seed 50
        page.wait_for_function(READY, timeout=40000)
        kinds = page.evaluate('() => __harness.item.options.map((o) => o.kind)')
        key = page.evaluate('() => __harness.key')
        todo = [i for i, k in enumerate(kinds) if i != key and k not in seen]
        if not todo:
            continue
        i = todo[0]
        page.locator('.hx-grid .px-choice').nth(i).click()
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        show_me(page, f'views wrong pick ({kinds[i]}, seed {seed})')
        shot(page, f'views_why_{kinds[i]}.png')
        seen.add(kinds[i])
    C.ok(seen == {'direction', 'mirror', 'neighbour'}, f'show me explained a wrong pick of every foil kind ({sorted(seen)})')
    ctx.close()


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        desktop_and_phone(b, cons)
        times = normal_speed(b, cons)
        sandboxed(b, cons)
        why_steps(b, cons)
        band_checks(b, cons, C, 'views', DIR, [('top', 'cubes:0,grid:0,view:0', 56), ('front', 'cubes:0,grid:0,view:1', 3), ('right4', 'cubes:0,grid:1,view:2', 7)],
                    assist_check=outline_frame, try1=('cubes:0,grid:0,view:0', 73), extra_q={'v': 'toview'})
        wtg_checks(b, cons, C, 'views', DIR, '.ex-views-assist')
        reveal_stable(b, cons, C, 'views', DIR)
        b.close()
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    warnings = [w for c in cons for w in c.warnings()]
    return C.summary({'showMeSeconds': times, 'warnings': warnings[:10], 'screenshots': sorted(p.name for p in DIR.glob('views_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
