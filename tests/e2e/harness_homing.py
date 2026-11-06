"""E2E: the dev harness with Homing (EX-11, experimental; first person through stage3d + arrow circle).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_homing.py   (two browser slots per machine)

1. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark: the 3D view and the circle show
   (non-blank pixels); the larger-screen notice shows on the phone only; no horizontal scroll; on the
   phone the view, the circle and Confirm fit one screen
2. a right answer by keyboard (← → 5°, Shift 1°, Enter) and a wrong one by pointer (tap on the phone)
   score as expected; the view turns with the arrow; reveal shows the start flag, turns the view to it
   and draws the right arrow, the tolerance wedge and the error in degrees
3. the walk at normal speed: the answer phase starts after LEAD_MS + item.duration (never sooner), on
   the item's end pose; Esc during the walk pauses it and voids the trial
4. show me ends on the grading geometry (the map turned so the final heading is up, the arrow at the
   key); 6–20 s at normal speed, shorter with reduced motion; pause, step, replay end; Hide the map
5. the demo plays to the end and leaves its item in the answer state; the sandboxed srcdoc harness
   renders and plays by keyboard; no console errors
Screenshots: tests/e2e/out/homing/homing_<viewport>_<theme>[_reveal|_wrong|_showme|_walk].png """
import math
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_homing')
DIR = OUT / 'homing'
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
PARAMS = 'route:3,landmarks:0,tolerance:1'   # 3 legs, medium turns, several landmarks, 30°
NONE = 'route:7,landmarks:2,tolerance:2'     # the hardest cell: 4 legs, large turns, no landmarks


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def adiff(a, b):
    return abs((a - b + 540) % 360 - 180)


def dial_point(target, deg, frac=0.8):
    g = target.evaluate("""() => { const r = document.querySelector('.ex-homing-dial').getBoundingClientRect();
        const d = PX.ex.view('homing').dial; return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: Math.min(r.width, r.height) / (2 * d.box), R: d.radius }; }""")
    r = g['s'] * g['R'] * frac
    a = math.radians(deg)
    return g['x'] + r * math.sin(a), g['y'] - r * math.cos(a)


def pose(target):
    return target.evaluate("() => PX.ex.view('homing').pose()")


VOIDS = []


def note_void(target, tag):
    s = target.evaluate("() => PX.ex.view('homing').state()")
    if s and s.get('voided'):
        VOIDS.append({'where': tag, 'reason': s['voided'], 'stats': s.get('voidStats')})


def drawn_ok(target, tag, phone=None):
    ok, s = non_blank(target.locator('.ex-homing-stage').screenshot(), min_distinct=6, max_top=0.9)
    C.ok(ok, f'{tag}: the 3D view shows the plain (and landmarks) ({s})')
    ok, s = non_blank(target.locator('.ex-homing-dialbox').screenshot(), min_distinct=4, max_top=0.99)
    C.ok(ok, f'{tag}: the arrow circle shows ({s})')
    d = target.evaluate("""() => { const it = __harness.item, p = PX.ex.view('homing').pose(), E = it.path[it.path.length - 1];
        return { gap: Math.hypot(p.x - E[0], p.y - E[1]), dh: Math.abs(((p.h - it.heading) % 360 + 540) % 360 - 180),
            notice: !document.querySelector('.ex-homing-notice').hidden, phase: document.querySelector('.ex-homing-phase').textContent }; }""")
    C.ok(d['gap'] < 1e-6 and d['dh'] < 1e-6, f'{tag}: the answer phase starts on the end of the route, facing its final heading ({d["gap"]:.2g} m, {d["dh"]:.2g}°)')
    if phone is not None:
        C.ok(d['notice'] == phone, f'{tag}: the larger-screen notice shows {"on the phone" if phone else "only on small screens"} ({d["notice"]})')
    note_void(target, tag)


def press_to(page, deg):
    t = round(deg) % 360
    key, n = ('ArrowRight', t) if t <= 180 else ('ArrowLeft', 360 - t)
    for _ in range(n // 5):
        page.keyboard.press(key)
    for _ in range(n % 5):
        page.keyboard.press('Shift+' + key)
    return t


def answer_keyboard(page, frame, tag):
    key = frame.evaluate('() => __harness.key')
    t = press_to(page, key)
    frame.wait_for_timeout(250)
    d = frame.evaluate("() => ({ v: Number(document.querySelector('.ex-homing-dial').getAttribute('aria-valuenow')), h: PX.ex.view('homing').pose().h, heading: __harness.item.heading })")
    C.ok(d['v'] == t, f'{tag}: ← → (5°) and Shift (1°) set the arrow ({d["v"]} vs {t})')
    C.ok(adiff(d['h'], d['heading'] + t) < 0.5, f'{tag}: the view turns with the arrow ({d["h"]:.1f} vs {d["heading"] + t:.1f})')
    page.keyboard.press('Enter')
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['source'] == 'view' and r['result']['value'] <= 1, f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')
    reveal_ok(frame, tag, True)


def answer_pointer(page, frame, tag, tap=False):
    key = frame.evaluate('() => __harness.key')
    x, y = dial_point(frame, key + 180)
    if tap:
        page.touchscreen.tap(x, y)
        frame.locator('.ex-homing-confirm').tap()
    else:
        page.mouse.click(x, y)
        frame.locator('.ex-homing-confirm').click()
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['result']['value'] >= 170, f'{tag}: a wrong answer by pointer scores wrong ({r["result"]})')
    reveal_ok(frame, tag, False)


def reveal_ok(frame, tag, right):
    frame.wait_for_timeout(750)  # the view turns to the start within 600 ms
    d = frame.evaluate("""() => {
        const rot = (el) => { const m = /rotate\\(([-\\d.]+)/.exec(el.getAttribute('transform') || ''); return m ? Number(m[1]) : null; };
        const key = document.querySelector('.ex-homing-key'), w = document.querySelector('.ex-homing-wedge'), v = document.querySelector('.ex-homing-verdict');
        const it = __harness.item, p = PX.ex.view('homing').pose(), s = PX.ex.view('homing').state();
        return { key: rot(key), keyVis: key.getAttribute('visibility'), wedge: w.getAttribute('visibility'), verdict: v.hidden ? '' : v.textContent,
            flag: s.flag, face: Math.abs(((p.h - it.heading - it.key) % 360 + 540) % 360 - 180), itemKey: it.key,
            arrowCls: document.querySelector('.ex-homing-arrow').getAttribute('class') };
    }""")
    C.ok(d['keyVis'] == 'visible' and d['key'] is not None and adiff(d['key'], d['itemKey']) < 0.01 and d['wedge'] == 'visible', f'{tag}: reveal draws the way back and the tolerance wedge ({d["key"]} vs {d["itemKey"]})')
    C.ok(d['verdict'].startswith('✓' if right else '✗') and '°' in d['verdict'], f'{tag}: the error in degrees with an icon ({d["verdict"]!r})')
    C.ok(d['flag'] and d['face'] < 0.5, f'{tag}: the start flag appears and the view turns to face it ({d["face"]:.2f}°)')
    C.ok(('is-right' if right else 'is-wrong') in d['arrowCls'], f'{tag}: the answer arrow is marked {"right" if right else "wrong"}')


def show_me(frame, tag, page=None, click=None):
    before = frame.evaluate('() => __harness.played.finished')
    if click is not None:
        click.click()
    elif page is not None:
        page.keyboard.press('s')
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=60000)
    C.ok(True, f'{tag}: show me ran to the end ({frame.evaluate("() => __harness.played.ms")} ms)')


def final_map(frame, tag):
    d = frame.evaluate("""() => {
        const it = __harness.item, map = document.querySelector('.ex-homing-map'), w = map && map.querySelector(':scope > g');
        const m = w ? /rotate\\(([-\\d.]+)/.exec(w.getAttribute('transform') || '') : null;
        const k = /rotate\\(([-\\d.]+)/.exec(document.querySelector('.ex-homing-key').getAttribute('transform') || '');
        const want = -(((it.heading - it.startHeading) % 360 + 540) % 360 - 180);
        return { shown: PX.ex.view('homing').state().map, rot: m ? Number(m[1]) : 0, want, key: k ? Number(k[1]) : null, itemKey: it.key,
            legs: map ? map.querySelectorAll('.ex-homing-leg').length : 0, n: it.legs.length, back: map ? map.querySelectorAll('.ex-homing-back').length : 0 };
    }""")
    C.ok(d['shown'] and abs(d['rot'] - d['want']) < 0.02 and d['key'] is not None and adiff(d['key'], d['itemKey']) < 0.05,
         f'{tag}: show me ends on the route map turned so the final heading is up, the arrow at the key ({d})')
    C.ok(d['legs'] == d['n'] and d['back'] == 1, f'{tag}: every leg and the way back are drawn ({d["legs"]} of {d["n"]})')


def phone_fit(page, tag):
    d = page.evaluate("""() => { const b = document.querySelector('.ex-homing-body').getBoundingClientRect();
        const c = document.querySelector('.ex-homing-confirm').getBoundingClientRect(), dial = document.querySelector('.ex-homing-dialbox').getBoundingClientRect();
        return { h: b.height, vh: innerHeight, confirm: [c.width, c.height], dial: dial.width, sw: [document.documentElement.scrollWidth, innerWidth] }; }""")
    C.ok(d['sw'][0] <= d['sw'][1], f'{tag}: no horizontal scroll ({d["sw"]})')
    C.ok(d['h'] <= d['vh'] * 0.8, f'{tag}: the view, the circle and Confirm fit one screen ({d["h"]:.0f} of {d["vh"]} px)')
    C.ok(d['confirm'][1] >= 44 and d['dial'] >= 150, f'{tag}: targets are large enough (Confirm {d["confirm"]}, circle {d["dial"]:.0f} px)')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for theme in ('light', 'dark'):
            name = f'homing_{tag}_{theme}'
            page.goto(file_url('tests/dev/harness.html', ex='homing', seed=11, p=PARAMS, fast=1, theme=theme))
            page.wait_for_function(READY, timeout=60000)
            drawn_ok(page, name, phone)
            shot(page, name + '.png')
            if phone:
                phone_fit(page, name)
            if theme == 'light':
                answer_keyboard(page, page, name)
                shot(page, name + '_reveal.png')
                show_me(page, name, page=page)
                final_map(page, name)
                shot(page, name + '_showme.png')
                page.locator('.ex-homing-hide').click()
                C.ok(not page.evaluate("() => PX.ex.view('homing').state().map"), f'{name}: Hide the map shows the 3D view again')
                page.keyboard.press('Space')  # next
                page.wait_for_function(READY, timeout=30000)
                answer_pointer(page, page, name, tap=phone)
                shot(page, name + '_wrong.png')
                show_me(page, name + ' (Show me button)', click=page.locator('.hx-feedback-actions .px-btn').first)
                final_map(page, name + ' (2)')
            else:
                x, y = dial_point(page, 200)
                (page.touchscreen.tap(x, y) if phone else page.mouse.click(x, y))
                page.locator('.ex-homing-confirm').click()
                page.wait_for_function(STATE, arg='reveal', timeout=10000)
                page.wait_for_timeout(700)
                shot(page, name + '_reveal.png')
            # the hardest cell: no landmarks, four legs
            page.goto(file_url('tests/dev/harness.html', ex='homing', seed=5, p=NONE, fast=1, theme=theme))
            page.wait_for_function(READY, timeout=60000)
            drawn_ok(page, name + ' no landmarks')
            shot(page, name + '_none.png')
            errs = page.evaluate('() => __harness.errors')
            C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    # the walk: answer phase after LEAD_MS + duration, never sooner
    page.goto(file_url('tests/dev/harness.html', ex='homing', seed=7, p='route:0,landmarks:0,tolerance:0'))
    page.wait_for_function(STATE, arg='ready', timeout=60000)
    t0 = page.evaluate('() => performance.now()')
    page.wait_for_timeout(2500)
    shot(page, 'homing_1366_light_walk.png')
    mid = pose(page)
    page.wait_for_function(READY, timeout=60000)
    t1 = page.evaluate('() => performance.now()')
    plan = page.evaluate("() => PX.ex.get('homing').lib.LEAD_MS + 1000 * __harness.item.duration")
    C.ok(0.97 * plan <= t1 - t0 <= 2.5 * plan, f'the walk takes LEAD_MS + item.duration ({(t1 - t0) / 1000:.2f} s for {plan / 1000:.2f} s)')
    C.ok(mid is not None, f'the view moves during the walk (pose at 2.5 s: {mid})')
    drawn_ok(page, 'normal speed')
    # Esc during the walk pauses it and voids the trial
    page.goto(file_url('tests/dev/harness.html', ex='homing', seed=8, p='route:0,landmarks:1,tolerance:0'))
    page.wait_for_function(STATE, arg='ready', timeout=60000)
    page.wait_for_timeout(1500)
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    s1 = page.evaluate("() => PX.ex.view('homing').state()")
    p1 = pose(page)
    page.wait_for_timeout(600)
    p2 = pose(page)
    shot(page, 'homing_1366_light_paused.png')
    page.keyboard.press('Escape')
    page.wait_for_function(READY, timeout=60000)
    C.ok(s1['paused'] and s1['voided'] == 'paused' and p1 == p2, f'Esc pauses the walk and voids the trial ({s1})')
    x, y = dial_point(page, 90)
    page.mouse.click(x, y)
    page.keyboard.press('Enter')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    last = page.evaluate('() => __harness.last')
    C.ok(last.get('void') is True, f'the paused trial is marked void ({last.get("void")}, {last.get("voidReason")})')
    # show me at normal speed and with reduced motion
    times = {}
    for rm in (0, 1):
        page.goto(file_url('tests/dev/harness.html', ex='homing', seed=9, p=PARAMS, fast=1, rm=rm))
        page.wait_for_function(READY, timeout=60000)
        page.evaluate('() => { __harness.config.fast = false; PX.debug.fast(false); }')
        x, y = dial_point(page, 120)
        page.mouse.click(x, y)
        page.keyboard.press('Enter')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(4000)
        shot(page, f'homing_1366_light_showme_mid{"_rm" if rm else ""}.png')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
        pl = page.evaluate('() => __harness.played')
        times['rm' if rm else 'normal'] = {'planned': round(pl['plannedMs'] / 1000, 2), 'wall': round(pl['ms'] / 1000, 2)}
    C.ok(6.0 <= times['normal']['planned'] <= 20.0, f'show me takes 6–20 s ({times["normal"]})')
    C.ok(times['rm']['planned'] < times['normal']['planned'], f'reduced motion makes show me shorter ({times})')
    page.keyboard.press('s')
    page.wait_for_function(STATE, arg='showme', timeout=5000)
    page.keyboard.press('Space')  # pause
    page.wait_for_timeout(400)
    paused = page.locator('.hx-player-buttons .px-btn').first.inner_text()
    C.ok('Resume' in paused, f'Space pauses show me ({paused!r})')
    page.keyboard.press('ArrowRight')  # step
    page.keyboard.press('r')           # replay
    page.keyboard.press('Escape')      # close
    page.wait_for_function(STATE, arg='reveal', timeout=30000)
    C.ok(True, 'pause, step, replay and close, then show me ends')
    # the demo plays to the end and leaves its item in the answer state
    page.goto(file_url('tests/dev/harness.html', ex='homing', seed=3, p=PARAMS, fast=1))
    page.wait_for_function(READY, timeout=60000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
    page.wait_for_timeout(150)
    d = page.evaluate("""() => { const it = __harness.item, p = PX.ex.view('homing').pose(), s = PX.ex.view('homing').state();
        return { seed: it.seed, flag: s.flag, map: s.map, arrow: document.querySelector('.ex-homing-arrow').getAttribute('visibility'),
            dh: Math.abs(((p.h - it.heading) % 360 + 540) % 360 - 180), disabled: document.querySelector('.ex-homing-confirm').disabled }; }""")
    C.ok(not d['flag'] and not d['map'] and d['arrow'] == 'hidden' and d['dh'] < 1e-6 and d['disabled'], f'the demo ends with its item in the answer state ({d})')
    errs = page.evaluate('() => __harness.errors')
    C.ok(not errs, f'normal speed: no harness errors ({errs})')
    ctx.close()
    return times


CLEAR_JS = """() => {
    // Every show-me step (half-way and at its end): movable labels (start, landmarks) must not overlap any label.
    const it = __harness.item, steps = PX.ex.view('homing').mapSteps(it), bad = [], fixed = [];
    const texts = () => Array.from(document.querySelectorAll('.ex-homing-map text')).filter((t) => t.textContent.trim()).map((t) => ({
        r: t.getBoundingClientRect(), txt: t.textContent,
        moves: t.classList.contains('ex-homing-maplabel') }));
    steps.forEach((s, i) => {
        if (s.enter) s.enter();
        [0.5, 1].forEach((k) => {
            if (s.update) s.update(k);
            const T = texts();
            for (let a = 0; a < T.length; a++) for (let b = a + 1; b < T.length; b++) {
                const w = Math.min(T[a].r.right, T[b].r.right) - Math.max(T[a].r.left, T[b].r.left);
                const h = Math.min(T[a].r.bottom, T[b].r.bottom) - Math.max(T[a].r.top, T[b].r.top);
                if (w > 1.5 && h > 1.5) (T[a].moves || T[b].moves ? bad : fixed).push(i + ':' + T[a].txt + '/' + T[b].txt);
            }
        });
        if (s.exit) s.exit();
    });
    return { bad, fixed, steps: steps.length };
}"""


def label_clearance(b, cons):
    """Show me keeps the start and landmark labels clear of every other label (review: seed 2602)."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(file_url('tests/dev/harness.html', ex='homing', seed=2602, p='route:3,landmarks:1,tolerance:1', fast=1))
    page.wait_for_function(READY, timeout=60000)
    cases = [(2602, {'route': 3, 'landmarks': 1, 'tolerance': 1})]
    cases += [(sd, {'route': r, 'landmarks': l, 'tolerance': 1}) for r in (0, 2, 3, 5, 7) for l in (0, 1) for sd in (1, 2, 3, 4)]
    bad, fixed, steps = [], 0, 0
    for i, (sd, p) in enumerate(cases):
        if i:
            page.evaluate('([p, s]) => __harness.next(p, s)', [p, sd])
            page.wait_for_function(READY, timeout=60000)
        x, y = dial_point(page, 90)
        page.mouse.click(x, y)
        page.keyboard.press('Enter')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        r = page.evaluate(CLEAR_JS)
        steps += r['steps']
        fixed += len(r['fixed'])
        bad += [f'seed {sd} {p}: {x}' for x in r['bad']]
        if sd == 2602:
            shot(page, 'homing_1366_light_showme_2602.png')
    C.ok(not bad, f'show me keeps start and landmark labels clear of other labels ({len(cases)} items, {steps} steps; {bad[:4]})')
    C.ok(fixed <= 2, f'turn and angle sizes stay clear of each other ({fixed} touching in {steps} step states)')
    errs = page.evaluate('() => __harness.errors')
    C.ok(not errs, f'label clearance: no harness errors ({errs})')
    ctx.close()


def sandboxed(b, cons):
    doc = harness_single('homing', {'seed': 21, 'p': PARAMS, 'fast': True})
    host = srcdoc_host('harness_homing', doc)
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=90000)
    env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
    C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc: runs in a sandboxed srcdoc frame ({env})')
    drawn_ok(fr, 'srcdoc')
    fr.locator('.hx-goal').click()
    answer_keyboard(page, fr, 'srcdoc')
    show_me(fr, 'srcdoc', page=page)
    shot(page, 'homing_srcdoc.png')
    errs = fr.evaluate('() => __harness.errors')
    C.ok(not errs, f'srcdoc: no harness errors ({errs})')
    ctx.close()


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        desktop_and_phone(b, cons)
        label_clearance(b, cons)
        times = normal_speed(b, cons)
        sandboxed(b, cons)
        b.close()
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    return C.summary({'showMeSeconds': times, 'voidedInThisEnvironment': VOIDS, 'screenshots': sorted(p.name for p in DIR.glob('homing_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
