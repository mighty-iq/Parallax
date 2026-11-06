"""E2E: the dev harness with the probe Cube Match (PR-1), and the probe suite that
harness_viewmatch.py and harness_level.py reuse (run_probe).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_cubematch.py   (two browser slots per machine)

For each probe (cfg below):
1. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark, two level settings:
   the stage and the options have non-blank pixels; the countdown bar runs (its scale falls);
   a right answer by keyboard and a wrong one by pointer (tap on the phone) score as expected and
   stop the bar; show me runs to the end (key and button); no horizontal scroll on the phone
2. show me at normal speed takes 2–5 s and finishes, shorter with reduced motion; pause, step and
   replay; the bar stands still while the trial is paused
3. the worked example (Demo: learn.demo[0], its fixed seed) plays to the end
4. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard
5. no console errors anywhere
Screenshots: tests/e2e/out/<id>/<id>_<run>_<viewport>_<theme>[_reveal|_wrong|_showme|_demo].png """
import re
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
PHONE = {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True}

CUBEMATCH = {
    'ex': 'cubematch', 'stage': '.ex-cubematch-stage', 'options': 'text',
    'runs': [('quarter', 'rotation:1,change:0,glyphs:1', 1), ('hardest', 'rotation:3,change:1,glyphs:2', 3)],
    'normal': ('rotation:3,change:1,glyphs:0', 2),
}


def shot(C, target, ex, name):
    folder = OUT / ex
    folder.mkdir(parents=True, exist_ok=True)
    target.screenshot(path=str(folder / name))
    return folder / name


def stage_ok(C, target, sel, tag):
    ok, s = non_blank(target.locator(sel).screenshot(), min_distinct=5, max_top=0.97)
    C.ok(ok, f'{tag}: the stage shows the stimulus ({s})')


def options_ok(C, frame, kind, tag):
    cells = frame.locator('.hx-grid .px-choice')
    n = cells.count()
    if kind == 'text':
        texts = [cells.nth(i).inner_text() for i in range(n)]
        C.ok(n == 2 and 'Same' in texts[0] and 'Different' in texts[1], f'{tag}: two answers, Same then Different ({texts})')
        return
    if kind == 'canvas':
        t = frame.evaluate("""() => Array.from(document.querySelectorAll('.ex-thumb')).map((c) => {
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, s = new Set();
            const bg = (d[0] << 16) | (d[1] << 8) | d[2];
            let fig = 0, k = 0;
            for (let i = 0; i < d.length; i += 4) { const v = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; s.add(v); k++; if (v !== bg) fig++; }
            return { colours: s.size, cover: Math.round(1000 * fig / k) / 1000, blank: c.getAttribute('data-blank') }; })""")
        C.ok(len(t) == 4 and all(x['colours'] >= 8 and x['cover'] >= 0.05 and not x['blank'] for x in t), f'{tag}: four non-blank pictures ({t})')
        return
    stats = [non_blank(cells.nth(i).locator('svg').screenshot(), min_distinct=3, max_top=0.995) for i in range(n)]
    C.ok(n == 4 and all(ok for ok, _ in stats), f'{tag}: four non-blank pictures ({[s for _, s in stats]})')


def bar_scale(frame):
    """scaleX of the countdown bar's fill (1 = full), from its computed transform matrix."""
    m = frame.evaluate("() => { const f = document.querySelector('.pr-timer-fill'); return f ? getComputedStyle(f).transform : null; }")
    if not m or m == 'none':
        return 1.0
    nums = re.findall(r'-?[\d.]+(?:e-?\d+)?', m)
    return float(nums[0]) if nums else 1.0


def bar_model(frame):
    """The bar's own clock, read in one page call (so a slow machine cannot skew it): its duration
    (s), the time it has run (s) and its scaleX."""
    return frame.evaluate("""() => { const f = document.querySelector('.pr-timer-fill'); if (!f) return null;
      const cs = getComputedStyle(f), a = f.getAnimations()[0], m = cs.transform.match(/-?[\\d.]+(?:e-?\\d+)?/g);
      return { dur: parseFloat(cs.animationDuration), t: a ? a.currentTime / 1000 : null, s: m ? parseFloat(m[0]) : 1 }; }""")


def bar_runs(C, page, frame, tag):
    a = bar_scale(frame)
    page.wait_for_timeout(900)
    b = bar_scale(frame)
    C.ok(b < a <= 1.0 and frame.evaluate("() => document.querySelector('.pr-timer').classList.contains('is-running')"), f'{tag}: the countdown bar runs ({a:.3f} → {b:.3f})')


def answer_keyboard(C, page, frame, tag):
    h = frame.evaluate('() => ({ key: __harness.key, answer: __harness.item.answer || null, yesno: typeof __harness.key === "boolean" })')
    page.keyboard.press(('1' if h['key'] else '2') if h['yesno'] else str(h['key'] + 1))
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['source'] == 'key', f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')
    C.ok(r['rtMs'] >= 0, f'{tag}: the answer clock ran from the paint ({r["rtMs"]} ms)')
    C.ok(frame.evaluate("() => document.querySelector('.pr-timer').classList.contains('is-stopped')"), f'{tag}: the bar stops at the answer')


def answer_pointer(C, page, frame, tag, tap=False):
    h = frame.evaluate('() => ({ key: __harness.key, yesno: typeof __harness.key === "boolean" })')
    cells = frame.locator('.hx-grid .px-choice')
    i = (1 if h['key'] else 0) if h['yesno'] else (h['key'] + 1) % 4
    (cells.nth(i).tap() if tap else cells.nth(i).click())
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['source'] == 'pointer', f'{tag}: a wrong answer by pointer scores wrong ({r["result"]}, {r["source"]})')
    marks = frame.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => b.className)")
    C.ok(any('is-wrong' in m for m in marks) and any('is-missed' in m for m in marks), f'{tag}: the grid marks the wrong pick and the missed answer')


def show_me(C, frame, tag, page=None, click=None):
    before = frame.evaluate('() => __harness.played.finished')
    if click is not None:
        click.click()
    elif page is not None:
        page.keyboard.press('s')
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=30000)
    C.ok(True, f'{tag}: show me ran to the end ({frame.evaluate("() => __harness.played.ms")} ms)')


def viewports(C, b, cons, cfg):
    ex = cfg['ex']
    for vp, vtag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', PHONE)]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = vtag == '412'
        for run, params, seed in cfg['runs']:
            for theme in ('light', 'dark'):
                name = f'{ex}_{run}_{vtag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex=ex, seed=seed, p=params, fast=1, theme=theme))
                page.wait_for_function(READY, timeout=60000)
                stage_ok(C, page, cfg['stage'], name)
                options_ok(C, page, cfg['options'], name)
                bar_runs(C, page, page, name)
                shot(C, page, ex, name + '.png')
                if phone:
                    sw = page.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
                    C.ok(sw[0] <= sw[1], f'{name}: no horizontal scroll ({sw})')
                if theme == 'light':
                    answer_keyboard(C, page, page, name)
                    shot(C, page, ex, name + '_reveal.png')
                    show_me(C, page, name, page=page)
                    shot(C, page, ex, name + '_showme.png')
                    page.keyboard.press('Space')
                    page.wait_for_function(READY, timeout=20000)
                    answer_pointer(C, page, page, name, tap=phone)
                    shot(C, page, ex, name + '_wrong.png')
                    show_me(C, page, name + ' (Show me button)', click=page.locator('.hx-feedback-actions .px-btn').first)
                else:
                    page.evaluate('() => __harness.answer(false)')
                    page.wait_for_function(STATE, arg='reveal', timeout=10000)
                    shot(C, page, ex, name + '_reveal.png')
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def normal_speed(C, b, cons, cfg):
    ex, (params, seed) = cfg['ex'], cfg['normal']
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    times = {}
    for rm in (0, 1):
        page.goto(file_url('tests/dev/harness.html', ex=ex, seed=seed, p=params, rm=rm))
        page.wait_for_function(READY, timeout=60000)
        if rm:   # base.css's reduced-motion rule must not cut the countdown short
            bar_runs(C, page, page, 'reduced motion')
            m = bar_model(page)
            C.ok(m and m['dur'] >= 5 and m['t'] is not None and abs(m['s'] - (1 - m['t'] / m['dur'])) < 0.05,
                 f'reduced motion: the bar keeps its full duration ({m})')
        page.evaluate('() => __harness.answer(false)')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(1300)
        shot(C, page, ex, f'{ex}_1366_light_showme_mid{"_rm" if rm else ""}.png')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=40000)
        pl = page.evaluate('() => __harness.played')
        times['rm' if rm else 'normal'] = {'planned': round(pl['plannedMs'] / 1000, 2), 'wall': round(pl['ms'] / 1000, 2)}
    C.ok(2.0 <= times['normal']['planned'] <= 5.0, f'show me takes 2–5 s ({times["normal"]})')
    C.ok(times['rm']['planned'] < times['normal']['planned'], f'reduced motion makes show me shorter ({times})')
    # The bar stands still while the trial is paused, and runs on after.
    page.goto(file_url('tests/dev/harness.html', ex=ex, seed=seed + 1, p=params))
    page.wait_for_function(READY, timeout=60000)
    page.keyboard.press('Escape')
    page.wait_for_function(STATE, arg='paused', timeout=5000)
    a = bar_scale(page)
    page.wait_for_timeout(900)
    b2 = bar_scale(page)
    C.ok(abs(a - b2) < 1e-3, f'the bar stands still while paused ({a:.4f} → {b2:.4f})')
    page.keyboard.press('Escape')
    page.wait_for_function(READY, timeout=5000)
    page.wait_for_timeout(700)
    C.ok(bar_scale(page) < b2, 'the bar runs on after the pause')
    # Pause, step and replay in show me, then it still ends.
    page.evaluate('() => __harness.answer(true)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    page.keyboard.press('s')
    page.wait_for_function(STATE, arg='showme', timeout=5000)
    page.keyboard.press('Space')
    page.wait_for_timeout(500)
    paused = page.locator('.hx-player-buttons .px-btn').first.inner_text()
    C.ok('Resume' in paused, f'Space pauses show me ({paused!r})')
    page.keyboard.press('ArrowRight')
    page.keyboard.press('r')
    page.wait_for_function(STATE, arg='reveal', timeout=40000)
    C.ok(True, 'pause, step and replay, then show me ends')
    ctx.close()
    return times


def worked_example(C, b, cons, cfg):
    ex = cfg['ex']
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(file_url('tests/dev/harness.html', ex=ex, seed=99, p=cfg['runs'][0][1], fast=1))
    page.wait_for_function(READY, timeout=60000)
    want = page.evaluate(f"() => PX.ex.learn('{ex}').demo[0]")
    before = page.evaluate('() => __harness.played.finished')
    page.locator('.hx-controls .px-btn', has_text='Demo').click()
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=40000)
    got = page.evaluate('() => ({ seed: __harness.item.seed, params: __harness.item.params })')
    C.ok(got['seed'] == want['seed'] and all(got['params'].get(k) == v for k, v in want['params'].items()), f'Demo plays the worked example (seed {got["seed"]}, {got["params"]})')
    shot(C, page, ex, f'{ex}_1366_light_demo.png')
    C.ok(not page.evaluate('() => __harness.errors'), 'the worked example plays without harness errors')
    ctx.close()


def sandboxed(C, b, cons, cfg):
    ex, (run, params, seed) = cfg['ex'], cfg['runs'][0]
    host = srcdoc_host(f'harness_{ex}', harness_single(ex, {'seed': seed, 'p': params, 'fast': True}))
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=90000)
    env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
    C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc: runs in a sandboxed srcdoc frame ({env})')
    stage_ok(C, fr, cfg['stage'], 'srcdoc')
    options_ok(C, fr, cfg['options'], 'srcdoc')
    fr.locator('.hx-goal').click()  # focus inside the frame, so keys reach it
    answer_keyboard(C, page, fr, 'srcdoc')
    show_me(C, fr, 'srcdoc', page=page)
    shot(C, page, ex, f'{ex}_srcdoc.png')
    C.ok(not fr.evaluate('() => __harness.errors'), 'srcdoc: no harness errors')
    ctx.close()


def run_probe(cfg):
    C = Checks('harness_' + cfg['ex'])
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        viewports(C, b, cons, cfg)
        times = normal_speed(C, b, cons, cfg)
        worked_example(C, b, cons, cfg)
        sandboxed(C, b, cons, cfg)
        b.close()
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    warnings = [w for c in cons for w in c.warnings()]
    return C.summary({'showMeSeconds': times, 'warnings': warnings[:10], 'screenshots': sorted(x.name for x in (OUT / cfg['ex']).glob('*.png'))})


if __name__ == '__main__':
    sys.exit(run_probe(CUBEMATCH))
