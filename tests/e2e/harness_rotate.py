"""E2E: the dev harness with Rotate (EX-02).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_rotate.py   (two browser slots per machine)

1. harness.html loads the same core, stage3d, engine and registry scripts as index.html
2. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark, both variants:
   the stage and every thumbnail have non-blank pixels; a right answer by keyboard and a wrong
   one by pointer (tap on the phone) score as expected; show me runs to the end; no
   horizontal scroll on the phone
3. show me at normal speed takes 2–4 s per turn and finishes (also with reduced motion)
4. the harness inlined into a sandboxed srcdoc iframe (opaque origin, storage blocked) renders
   and plays by keyboard
5. the hardest level at both sizes (items an item-validity review flagged): the pictures fill
   their frames (the largest option ≥ 85 % of its thumbnail, every option centred; the stage
   figures ≥ 85 % of the frame under the labels and never under a label)
6. no console errors anywhere
Screenshots: tests/e2e/out/rotate_<variant>_<viewport>_<theme>[_reveal|_showme].png,
rotate_hard_<variant>_<seed>_<viewport>.png """
import io
import re
import sys
import time

from playwright.sync_api import sync_playwright

from common import (OUT, ROOT, Checks, Console, active_scripts, child_frame, file_url, harness_single,
                    launch, non_blank, srcdoc_host)

C = Checks('harness_rotate')
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
PARAMS = 'angle:2,axis:0,cubes:1'  # 60°, vertical, 8 cubes: readable shots


def shot(target, name):
    target.screenshot(path=str(OUT / name))
    return OUT / name


def check_scripts():
    """Every core/engine/registry script of index.html, in the same order, in harness.html."""
    idx = [s for s in active_scripts((ROOT / 'index.html').read_text()) if re.match(r'(vendor|js/core|js/engine)/|js/ex/registry\.js$', s)]
    har = [s.replace('../../', '', 1) for s in active_scripts((ROOT / 'tests/dev/harness.html').read_text()) if s.startswith('../../')]
    want = [s for s in idx]
    if 'js/core/stage3d.js' not in want:  # index.html may still list stage3d as pending
        want.insert(want.index('js/core/ui.js') + 1, 'js/core/stage3d.js')
    C.ok(har == want, f'harness.html loads index.html\'s core/engine scripts in order (harness {len(har)}, index {len(want)}; '
         f'missing {sorted(set(want) - set(har))}, extra {sorted(set(har) - set(want))})')


def thumbs_ok(page):
    """Per option thumbnail (read back from its 2D canvas): distinct colours and the share of
    pixels that differ from the corner (the figure). Flat shading without antialiasing has
    only about five colours (ground, three face tones, outline), so coverage is the test."""
    return page.evaluate("""() => Array.from(document.querySelectorAll('.ex-thumb')).map((c) => {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, s = new Set();
        const bg = (d[0] << 16) | (d[1] << 8) | d[2];
        let fig = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { const v = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; s.add(v); n++; if (v !== bg) fig++; }
        return { colours: s.size, cover: Math.round(1000 * fig / n) / 1000 }; })""")


def thumbs_good(t):
    return len(t) == 4 and all(x['colours'] >= 4 and x['cover'] >= 0.05 for x in t)


def stage_ok(target, tag):
    ok, s = non_blank(target.locator('.ex-rotate-stage').screenshot(), min_distinct=5, max_top=0.97)
    C.ok(ok, f'{tag}: the stage shows a figure ({s})')
    return s


def answer_keyboard(page, frame, tag):
    """Right answer by keyboard: digits (and Enter for pick-two)."""
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
    """Wrong answer by pointer: click (or tap) the options, then Confirm for pick-two."""
    h = frame.evaluate('() => ({ key: __harness.key, answer: __harness.item.answer, n: __harness.item.nOptions })')
    cells = frame.locator('.hx-grid .px-choice')
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


def show_me(frame, tag, key='s', page=None, click=None):
    """Starts show me (key, button or API) and waits until it has finished; returns its ms."""
    before = frame.evaluate('() => __harness.played.finished')
    if click is not None:
        click.click()
    elif page is not None:
        page.keyboard.press(key)
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=30000)
    ms = frame.evaluate('() => __harness.played.ms')
    C.ok(True, f'{tag}: show me ran to the end ({ms} ms)')
    return ms


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for variant in ('samediff', 'pick'):
            for theme in ('light', 'dark'):
                name = f'rotate_{variant}_{tag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex='rotate', seed=11, v=variant, p=PARAMS, fast=1, theme=theme))
                page.wait_for_function(READY, timeout=30000)
                stage_ok(page, name)
                if variant == 'pick':
                    t = thumbs_ok(page)
                    C.ok(thumbs_good(t), f'{name}: four non-blank option thumbnails ({t})')
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
                else:
                    page.evaluate('() => __harness.answer(false)')
                    page.wait_for_function(STATE, arg='reveal', timeout=10000)
                    shot(page, name + '_reveal.png')
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def normal_speed(b, cons):
    """Show me at its real speed (fast off), normal and reduced motion."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    times = {}
    for variant, rm in (('samediff', 0), ('samediff', 1), ('pick', 0)):
        page.goto(file_url('tests/dev/harness.html', ex='rotate', seed=5, v=variant, p='angle:5,axis:1,cubes:2', rm=rm))
        page.wait_for_function(READY, timeout=30000)
        page.evaluate('() => __harness.answer(false)')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(1200)
        shot(page, f'rotate_{variant}_1366_light_showme{"_rm" if rm else ""}.png')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=30000)
        page.wait_for_timeout(200)
        shot(page, f'rotate_{variant}_1366_light_showme_end{"_rm" if rm else ""}.png')
        pl = page.evaluate('() => __harness.played')
        times[f'{variant}{"_rm" if rm else ""}'] = {'planned': round(pl['plannedMs'] / 1000, 2), 'wall': round(pl['ms'] / 1000, 2)}
    n_turns = page.evaluate('() => __harness.item.key.length')  # pick explains up to 3 options
    # Planned durations (the animation's own clock); wall time is reported, since a loaded
    # machine with software WebGL stretches it (dt is clamped to 100 ms per frame).
    C.ok(2.0 <= times['samediff']['planned'] <= 4.0, f'show me for a same/mirror pair takes 2–4 s ({times["samediff"]})')
    C.ok(times['samediff_rm']['planned'] < times['samediff']['planned'], f'reduced motion makes show me shorter ({times})')
    C.ok(times['pick']['planned'] <= 4.0 * 3, f'show me for pick-two takes ≤ 4 s per explained option ({times["pick"]}, up to {n_turns + 1} options)')
    # Pause, Step and Replay work and the run still ends.
    page.goto(file_url('tests/dev/harness.html', ex='rotate', seed=6, v='samediff', p='angle:4,axis:0,cubes:1'))
    page.wait_for_function(READY, timeout=30000)
    page.evaluate('() => __harness.answer(true)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    page.keyboard.press('s')
    page.wait_for_function(STATE, arg='showme', timeout=5000)  # normal speed: lasts seconds
    page.keyboard.press('Space')  # pause
    page.wait_for_timeout(600)
    paused = page.locator('.hx-player-buttons .px-btn').first.inner_text()
    C.ok('Resume' in paused, f'Space pauses show me ({paused!r})')
    page.keyboard.press('ArrowRight')  # step
    page.keyboard.press('r')           # replay (plays again)
    page.wait_for_function(STATE, arg='reveal', timeout=30000)
    C.ok(True, 'pause, step and replay, then show me ends')
    # The tutorial demo plays to the end with captions (fast).
    page.goto(file_url('tests/dev/harness.html', ex='rotate', seed=1, fast=1))
    page.wait_for_function(READY, timeout=30000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=30000)
    cap = page.locator('.hx-caption').inner_text()
    C.ok(len(cap) > 10, f'the demo plays to the end with captions ({cap!r})')
    # A lost WebGL context voids the trial, the view comes back after the restore.
    page.goto(file_url('tests/dev/harness.html', ex='rotate', seed=8, v='samediff', p=PARAMS, fast=1))
    page.wait_for_function(READY, timeout=30000)
    page.evaluate('() => { const r = PX.core.stage3d.renderer(); r.forceContextLoss(); setTimeout(() => r.forceContextRestore(), 400); }')
    page.wait_for_timeout(1500)
    lost = page.evaluate('() => PX.core.stage3d.isLost()')
    stage_ok(page, 'after a context loss and restore')
    page.evaluate('() => __harness.answer(true)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    last = page.evaluate('() => __harness.last')
    C.ok(not lost and last['void'] is True, f'a context loss voids the trial and the 3D view is restored (lost now {lost}, void {last["void"]})')
    ctx.close()
    return times


def framing(page, variant):
    """How the pictures sit in their frames. Thumbnails (read back from their canvases): the
    share of the canvas the figure's box covers and how far its centre is off the canvas centre.
    Stage (screenshot with the labels hidden): per tile, the figure's box in CSS px, whether it
    stays below the labels and the share of the frame under them that it fills."""
    import numpy as np
    from PIL import Image
    thumbs = page.evaluate("""() => Array.from(document.querySelectorAll('.ex-thumb')).map((c) => {
        const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 32) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        return { fill: Math.round(100 * Math.max(x1 - x0 + 1, y1 - y0 + 1) / Math.max(W, H)) / 100,
          off: Math.round(100 * Math.max(Math.abs((x0 + x1 + 1) / 2 - W / 2) / W, Math.abs((y0 + y1 + 1) / 2 - H / 2) / H)) / 100 }; })""")
    geo = page.evaluate("""() => { const s = document.querySelector('.ex-rotate-stage'), r = s.getBoundingClientRect();
        const l = s.querySelector('.ex-rotate-label--ref').getBoundingClientRect();
        s.querySelectorAll('.ex-label, .ex-rotate-divider').forEach((e) => { e.style.visibility = 'hidden'; });
        return { w: r.width, h: r.height, label: l.bottom - r.top }; }""")
    png = page.locator('.ex-rotate-stage').screenshot()
    page.evaluate("() => document.querySelectorAll('.ex-rotate-stage .ex-label, .ex-rotate-divider').forEach((e) => { e.style.visibility = ''; })")
    a = np.asarray(Image.open(io.BytesIO(png)).convert('RGB')).astype(np.int32)
    k = a.shape[1] / geo['w']  # device px per CSS px
    m = 3 * int(round(k))      # leave out the stage border
    a = a[m:-m, m:-m]
    bg = a[a.shape[0] // 2, 2]
    mask = np.abs(a - bg).sum(axis=2) > 40
    tiles = [mask] if variant == 'pick' else [mask[:, :mask.shape[1] // 2 - m], mask[:, mask.shape[1] // 2 + m:]]
    usable = geo['h'] - geo['label'] - 4  # the frame under the labels (view.js), CSS px
    stage = []
    for t in tiles:
        ys, xs = np.nonzero(t)
        top = (ys.min() + m) / k
        fill = max((ys.max() - ys.min()) / k / usable, (xs.max() - xs.min()) / k / (t.shape[1] / k))
        stage.append({'top': round(float(top), 1), 'fill': round(float(fill), 2)})
    return {'thumbs': thumbs, 'stage': stage, 'label': round(geo['label'], 1)}


def hardest(b, cons):
    """The hardest level (180° / 160°, oblique, 12 cubes) at both sizes, with the seeds an
    item-validity review flagged (1105, 1107): screenshots to judge readability."""
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        for variant, seed, p in (('pick', 1105, 'angle:8,axis:3,cubes:3'), ('pick', 1107, 'angle:6,axis:3,cubes:3'), ('samediff', 1105, 'angle:8,axis:3,cubes:3')):
            name = f'rotate_hard_{variant}_{seed}_{tag}'
            page.goto(file_url('tests/dev/harness.html', ex='rotate', seed=seed, v=variant, p=p, fast=1))
            page.wait_for_function(READY, timeout=30000)
            stage_ok(page, name)
            if variant == 'pick':
                t = thumbs_ok(page)
                C.ok(thumbs_good(t), f'{name}: four non-blank option thumbnails ({t})')
            f = framing(page, variant)
            if variant == 'pick':
                C.ok(max(x['fill'] for x in f['thumbs']) >= 0.85 and all(x['off'] <= 0.03 for x in f['thumbs']),
                     f'{name}: the options share one scale, the largest fills its thumbnail, each is centred ({f["thumbs"]})')
            C.ok(all(x['top'] >= f['label'] for x in f['stage']) and max(x['fill'] for x in f['stage']) >= 0.85,
                 f'{name}: the stage figures fill the frame under the labels and stay clear of them ({f["stage"]}, labels end at {f["label"]} px)')
            shot(page, name + '.png')
        ctx.close()


def sandboxed(b, cons):
    for variant in ('samediff', 'pick'):
        doc = harness_single('rotate', {'seed': 21, 'v': variant, 'p': PARAMS, 'fast': True})
        host = srcdoc_host(f'harness_rotate_{variant}', doc)
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
        page = ctx.new_page()
        cons.append(Console(page))
        page.goto(host.as_uri())
        fr = child_frame(page)
        fr.wait_for_function(READY, timeout=60000)
        env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href, volatile: PX.core.store ? PX.core.store.volatile : null })')
        C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc {variant}: runs in a sandboxed srcdoc frame ({env})')
        stage_ok(fr, f'srcdoc {variant}')
        if variant == 'pick':
            t = thumbs_ok(fr)
            C.ok(thumbs_good(t), f'srcdoc pick: four non-blank thumbnails ({t})')
        fr.locator('.hx-goal').click()  # focus inside the frame, so keys reach it
        answer_keyboard(page, fr, f'srcdoc {variant}')
        show_me(fr, f'srcdoc {variant}', page=page)
        shot(page, f'rotate_{variant}_srcdoc.png')
        errs = fr.evaluate('() => __harness.errors')
        C.ok(not errs, f'srcdoc {variant}: no harness errors ({errs})')
        ctx.close()


def main():
    check_scripts()
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        desktop_and_phone(b, cons)
        times = normal_speed(b, cons)
        hardest(b, cons)
        sandboxed(b, cons)
        b.close()
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    warnings = [w for c in cons for w in c.warnings()]
    return C.summary({'showMeSeconds': times, 'warnings': warnings[:10], 'screenshots': sorted(p.name for p in OUT.glob('rotate_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
