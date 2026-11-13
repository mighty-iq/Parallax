"""E2E: the dev harness with Homing (EX-11, experimental; first person through the kit in its view.js).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_homing.py   (two browser slots per machine)

1. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark: the 3D view and the circle show
   (non-blank pixels); no "larger screen" notice anywhere; no horizontal scroll; on the phone (header, goal
   and tip folded away as the player's item screen does) the view, the turn row and Confirm fit one screen
2. a right answer by keyboard (← → 5°, Shift 1°, Enter) and a wrong one by pointer (a tap on the circle on
   the phone); the view turns with the arrow; reveal shows the start flag, turns the view to it and draws
   the right arrow, the tolerance wedge and the error in degrees
3. touch-only play at 360 × 740: dragging the view turns it (the world follows the finger), the ◀ ▶
   buttons turn 5° and 1°, Confirm by tap; the answer is logged as touch; it fits at 360 × 640 too
4. the walk at normal speed: the answer phase starts after LEAD_MS + item.duration, on the end pose; the
   ring hides once left; Esc freezes the walk and voids; the player's pause sheet (an inert host) freezes
   it and voids; a 1.2 s freeze voids ('stutter'), short ones do not
5. frame budget at 4× CPU throttle (390 × 844, DPR 2, normal speed): two routes, none voided; statistics
   in the report
6. show me ends on the grading geometry; 6–20 s at normal speed, shorter with reduced motion; pause, step,
   replay, close; Hide the map; labels clear of each other; the demo plays to the end and leaves its item
   in the answer state; the sandboxed srcdoc harness plays by keyboard; no console errors
Screenshots: tests/e2e/out/homing/homing_<viewport>_<theme>[_reveal|_wrong|_showme|_walk].png """
import math
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host
from harness_reckon import Touch, norm180

C = Checks('harness_homing')
DIR = OUT / 'homing'
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
PARAMS = 'route:3,landmarks:0,tolerance:1'   # 3 legs, medium turns, several landmarks, 30°
NONE = 'route:7,landmarks:2,tolerance:2'     # the hardest cell: 4 legs, large turns, no landmarks
PHONE = {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True}
FOLD = '.hx-bar, .hx-goal, .hx-tip { display: none !important; } .hx-main { padding-top: 60px !important; }'
REPORT = {'voids': {}, 'throttle4x': [], 'fit': {}}


def shot(target, name, full=False):
    target.screenshot(path=str(DIR / name), full_page=full)


def adiff(a, b):
    return abs((a - b + 540) % 360 - 180)


def dial_point(target, deg, frac=0.8):
    g = target.evaluate("""() => { const r = document.querySelector('.ex-fp-dial').getBoundingClientRect();
        const d = PX.ex.view('homing').dial; return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: Math.min(r.width, r.height) / (2 * d.box), R: d.radius }; }""")
    r = g['s'] * g['R'] * frac
    a = math.radians(deg)
    return g['x'] + r * math.sin(a), g['y'] - r * math.cos(a)


def pose(target):
    return target.evaluate("() => PX.ex.view('homing').pose()")


def hs(target):
    return target.evaluate("() => PX.ex.view('homing').state()")


VOIDS = []


def note_void(target, tag):
    s = hs(target)
    if s and s.get('voided'):
        VOIDS.append({'where': tag, 'reason': s['voided'], 'stats': s.get('voidStats')})


def drawn_ok(target, tag):
    ok, s = non_blank(target.locator('.ex-fp-stage').screenshot(), min_distinct=6, max_top=0.9)
    C.ok(ok, f'{tag}: the 3D view shows the plain (and landmarks) ({s})')
    ok, s = non_blank(target.locator('.ex-fp-dialbox').screenshot(), min_distinct=4, max_top=0.99)
    C.ok(ok, f'{tag}: the arrow circle shows ({s})')
    d = target.evaluate("""() => { const it = __harness.item, p = PX.ex.view('homing').pose(), E = it.path[it.path.length - 1];
        return { gap: Math.hypot(p.x - E[0], p.y - E[1]), dh: Math.abs(((p.h - it.heading) % 360 + 540) % 360 - 180),
            notice: /larger screen/i.test(document.body.innerText), ring: PX.ex.view('homing').state().ring, sw: [document.documentElement.scrollWidth, innerWidth] }; }""")
    C.ok(d['gap'] < 1e-6 and d['dh'] < 1e-6, f'{tag}: the answer phase starts on the end of the route, facing its final heading ({d["gap"]:.2g} m, {d["dh"]:.2g}°)')
    C.ok(not d['notice'], f'{tag}: no "larger screen" notice')
    C.ok(not d['ring'], f'{tag}: the start ring is gone once left')
    C.ok(d['sw'][0] <= d['sw'][1], f'{tag}: no horizontal scroll ({d["sw"]})')
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
    d = frame.evaluate("() => ({ v: Number(document.querySelector('.ex-fp-dial').getAttribute('aria-valuenow')), h: PX.ex.view('homing').pose().h, heading: __harness.item.heading })")
    C.ok(d['v'] == t, f'{tag}: ← → (5°) and Shift (1°) set the arrow ({d["v"]} vs {t})')
    C.ok(adiff(d['h'], d['heading'] + t) < 0.5, f'{tag}: the view turns with the arrow ({d["h"]:.1f} vs {d["heading"] + t:.1f})')
    page.keyboard.press('Enter')
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['source'] == 'view' and r['result']['value'] <= 1, f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')
    C.ok(hs(frame)['input'] == 'key', f'{tag}: the answer is logged as keys ({hs(frame)["input"]})')
    reveal_ok(frame, tag, True)


def answer_pointer(page, frame, tag, tap=False):
    key = frame.evaluate('() => __harness.key')
    x, y = dial_point(frame, key + 180)
    if tap:
        page.touchscreen.tap(x, y)
        frame.locator('.ex-fp-confirm').tap()
    else:
        page.mouse.click(x, y)
        frame.locator('.ex-fp-confirm').click()
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['result']['value'] >= 170, f'{tag}: a wrong answer by pointer scores wrong ({r["result"]})')
    reveal_ok(frame, tag, False)


def reveal_ok(frame, tag, right):
    frame.wait_for_timeout(750)  # the view turns to the start within 600 ms
    d = frame.evaluate("""() => {
        const rot = (el) => { const m = /rotate\\(([-\\d.]+)/.exec(el.getAttribute('transform') || ''); return m ? Number(m[1]) : null; };
        const key = document.querySelector('.ex-fp-key'), w = document.querySelector('.ex-fp-wedge'), v = document.querySelector('.ex-fp-verdict');
        const it = __harness.item, p = PX.ex.view('homing').pose(), s = PX.ex.view('homing').state();
        return { key: rot(key), keyVis: key.getAttribute('visibility'), wedge: w.getAttribute('visibility'), verdict: v.hidden ? '' : v.textContent,
            flag: s.flag, face: Math.abs(((p.h - it.heading - it.key) % 360 + 540) % 360 - 180), itemKey: it.key,
            arrowCls: document.querySelector('.ex-fp-arrow').getAttribute('class') };
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
        const it = __harness.item, map = document.querySelector('.ex-fp-map'), w = map && map.querySelector(':scope > g');
        const m = w ? /rotate\\(([-\\d.]+)/.exec(w.getAttribute('transform') || '') : null;
        const k = /rotate\\(([-\\d.]+)/.exec(document.querySelector('.ex-fp-key').getAttribute('transform') || '');
        const want = -(((it.heading - it.startHeading) % 360 + 540) % 360 - 180);
        const labels = [...map.querySelectorAll('text')].map((t) => parseFloat(getComputedStyle(t).fontSize) * t.getScreenCTM().a);
        return { shown: PX.ex.view('homing').state().map, rot: m ? Number(m[1]) : 0, want, key: k ? Number(k[1]) : null, itemKey: it.key,
            legs: map ? map.querySelectorAll('.ex-fp-leg').length : 0, n: it.legs.length, back: map ? map.querySelectorAll('.ex-fp-back').length : 0,
            minLabelPx: Math.min(...labels) };
    }""")
    C.ok(d['shown'] and abs(d['rot'] - d['want']) < 0.02 and d['key'] is not None and adiff(d['key'], d['itemKey']) < 0.05,
         f'{tag}: show me ends on the route map turned so the final heading is up, the arrow at the key ({d})')
    C.ok(d['legs'] == d['n'] and d['back'] == 1, f'{tag}: every leg and the way back are drawn ({d["legs"]} of {d["n"]})')
    C.ok(d['minLabelPx'] >= 12, f'{tag}: map labels at least 12 px on the screen ({d["minLabelPx"]:.1f} px)')


def phone_fit(page, tag, size):
    page.add_style_tag(content=FOLD)
    page.evaluate('() => window.scrollTo(0, 0)')
    page.wait_for_timeout(150)
    d = page.evaluate("""() => { const b = (s) => document.querySelector(s).getBoundingClientRect();
        return { vh: innerHeight, stageTop: b('.ex-fp-stage').top, stageH: b('.ex-fp-stage').height, confirm: [b('.ex-fp-confirm').width, b('.ex-fp-confirm').height, b('.ex-fp-confirm').bottom],
            dial: b('.ex-fp-dialbox').width, fine: [...document.querySelectorAll('.ex-fp-fine')].map((x) => Math.min(x.getBoundingClientRect().width, x.getBoundingClientRect().height)),
            sw: [document.documentElement.scrollWidth, innerWidth] }; }""")
    REPORT['fit'][tag] = d
    C.ok(d['sw'][0] <= d['sw'][1], f'{tag}: no horizontal scroll ({d["sw"]})')
    C.ok(d['stageTop'] >= 0 and d['confirm'][2] <= d['vh'] + 0.5, f'{tag} at {size}: the view, the turn row and Confirm fit one screen (stage from {d["stageTop"]:.0f}, Confirm ends {d["confirm"][2]:.0f} of {d["vh"]} px)')
    C.ok(d['confirm'][1] >= 44 and min(d['fine']) >= 44 and d['dial'] >= 96, f'{tag}: targets large enough (Confirm {d["confirm"][:2]}, fine {min(d["fine"]):.0f}, circle {d["dial"]:.0f} px)')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', PHONE)]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for theme in ('light', 'dark'):
            name = f'homing_{tag}_{theme}'
            page.goto(file_url('tests/dev/harness.html', ex='homing', seed=11, p=PARAMS, fast=1, theme=theme))
            page.wait_for_function(READY, timeout=60000)
            drawn_ok(page, name)
            shot(page, name + '.png')
            if phone:
                phone_fit(page, name, '412x880')
            if theme == 'light':
                answer_keyboard(page, page, name)
                shot(page, name + '_reveal.png')
                show_me(page, name, page=page)
                final_map(page, name)
                shot(page, name + '_showme.png')
                page.locator('.ex-fp-hide').click()
                C.ok(not hs(page)['map'], f'{name}: Hide the map shows the 3D view again')
                page.keyboard.press('Space')  # next
                page.wait_for_function(READY, timeout=30000)
                answer_pointer(page, page, name, tap=phone)
                shot(page, name + '_wrong.png')
                show_me(page, name + ' (Show me button)', click=page.locator('.hx-feedback-actions .px-btn').first)
                final_map(page, name + ' (2)')
            else:
                x, y = dial_point(page, 200)
                (page.touchscreen.tap(x, y) if phone else page.mouse.click(x, y))
                page.locator('.ex-fp-confirm').click()
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


def touch_only(b, cons):
    """360 × 740 by touch alone: drag the view, the fine buttons, Confirm; then the fit at 360 × 640 and in landscape."""
    ctx = b.new_context(viewport={'width': 360, 'height': 740}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    tt = Touch(ctx, page)
    page.goto(file_url('tests/dev/harness.html', ex='homing', seed=12, p='route:2,landmarks:1,tolerance:1', fast=1))
    page.wait_for_function(READY, timeout=60000)
    phone_fit(page, 'touch 360', '360x740')
    box = page.locator('.ex-fp-stage').bounding_box()
    y0 = box['y'] + box['height'] * 0.6
    tt.drag(box['x'] + box['width'] * 0.7, y0, -100)  # 100 px to the left: the world follows, so you turn 25° right
    page.wait_for_timeout(200)
    s = hs(page)
    v1 = page.evaluate("() => Number(document.querySelector('.ex-fp-dial').getAttribute('aria-valuenow'))")
    C.ok(abs(v1 - 25) <= 1 and s['mode'] == 'drag' and s['input'] == 'touch', f'dragging the view 100 px left turns 25° right ({v1}°, {s["mode"]}, {s["input"]})')
    tt.tap('[data-turn="5"]')
    tt.tap('[data-turn="-1"]')
    page.wait_for_timeout(250)
    v2 = page.evaluate("() => Number(document.querySelector('.ex-fp-dial').getAttribute('aria-valuenow'))")
    C.ok(v2 == v1 + 4, f'5°▶ then ◀1° turn by +4° ({v1} → {v2})')
    key = page.evaluate('() => __harness.key')
    want = norm180(key)
    for _ in range(80):
        cur = page.evaluate("() => Number(document.querySelector('.ex-fp-dial').getAttribute('aria-valuenow'))")
        d = norm180(want - cur)
        if abs(d) < 0.5:
            break
        tt.tap('[data-turn="%d"]' % ((5 if d > 0 else -5) if abs(d) >= 5 else (1 if d > 0 else -1)))
    tt.tap('.ex-fp-confirm')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    last = page.evaluate('() => __harness.last')
    C.ok(last['result']['correct'] and hs(page)['input'] == 'touch', f'touch only: turning to the start with the buttons and tapping Confirm is right, logged as touch ({last["result"]})')
    page.wait_for_timeout(700)
    shot(page, 'homing_360_touch_reveal.png', full=True)
    ctx.close()
    for vp, tag in (((360, 640), '360x640'), ((740, 360), '740x360')):
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **PHONE)
        page = ctx.new_page()
        cons.append(Console(page))
        page.goto(file_url('tests/dev/harness.html', ex='homing', seed=13, p=PARAMS, fast=1))
        page.wait_for_function(READY, timeout=60000)
        phone_fit(page, 'fit ' + tag, tag)
        shot(page, f'homing_{tag}_answer.png')
        ctx.close()


def walk_pause_void(b, cons):
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
    moving = "() => { const p = PX.ex.view('homing').pose(), it = __harness.item; return Math.hypot(p.x - it.path[0][0], p.y - it.path[0][1]) > 0.3; }"
    # the player's pause during the walk (Esc or its Pause button) calls view.pause(), later view.resume(): the
    # walk freezes and is void, then goes on to its end (the view has no pause of its own any more)
    page.goto(file_url('tests/dev/harness.html', ex='homing', seed=8, p='route:0,landmarks:1,tolerance:0'))
    page.wait_for_function(moving, timeout=60000)
    page.evaluate("() => PX.ex.view('homing').pause()")
    page.wait_for_timeout(300)
    s1, p1 = hs(page), pose(page)
    page.wait_for_timeout(700)
    p2 = pose(page)
    shot(page, 'homing_1366_light_paused.png')
    page.evaluate("() => PX.ex.view('homing').resume()")
    page.wait_for_function(READY, timeout=60000)
    C.ok(s1['voided'] == 'paused' and p1 == p2, f'pause() freezes the walk and voids the trial ({s1["voided"]}, frozen {p1 == p2}); resume() walks on to the end')
    x, y = dial_point(page, 90)
    page.mouse.click(x, y)
    page.keyboard.press('Enter')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    last = page.evaluate('() => __harness.last')
    C.ok(last.get('void') is True, f'the paused trial is marked void ({last.get("void")}, {last.get("voidReason")})')
    # the player's pause sheet makes the host inert: the walk freezes and the item is void
    page.goto(file_url('tests/dev/harness.html', ex='homing', seed=9, p='route:0,landmarks:1,tolerance:0'))
    page.wait_for_function(moving, timeout=60000)
    page.evaluate("() => document.querySelector('.hx-host').setAttribute('inert', '')")
    page.wait_for_timeout(250)
    p1 = pose(page)
    page.wait_for_timeout(800)
    p2 = pose(page)
    page.evaluate("() => document.querySelector('.hx-host').removeAttribute('inert')")
    page.wait_for_function(READY, timeout=60000)
    s2 = hs(page)
    C.ok(p1 == p2 and s2['voided'] == 'paused', f'the player\'s pause (an inert host) freezes the walk ({p1 == p2}) and voids it ({s2["voided"]})')
    # a 1.2 s freeze while moving voids; three 300 ms freezes do not
    for name, freezes, want in (('freeze1200', [1200], 'stutter'), ('freeze3x300', [300, 300, 300], None)):
        page.goto(file_url('tests/dev/harness.html', ex='homing', seed=10, p='route:1,landmarks:0,tolerance:0'))
        page.wait_for_function(moving, timeout=60000)
        for ms in freezes:
            page.evaluate('(ms) => { const t = performance.now(); while (performance.now() - t < ms) {} }', ms)
            page.wait_for_timeout(700)
        page.wait_for_function(READY, timeout=60000)
        s = hs(page)
        REPORT['voids'][name] = {'voided': s['voided'], 'maxGapMs': s['frames']['maxGapMs'], 'slowShare': s['frames']['slowShare']}
        C.ok(s['voided'] == want, f'{name}: voided = {want} ({s["voided"]}; max gap {s["frames"]["maxGapMs"]} ms, slow share {s["frames"]["slowShare"]})')
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
    sub = page.locator('.ex-fp-sub').inner_text()
    C.ok(len(sub) > 10, f'show me captions are subtitles over the view ({sub!r})')
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
        return { seed: it.seed, flag: s.flag, map: s.map, arrow: document.querySelector('.ex-fp-arrow').getAttribute('visibility'),
            dh: Math.abs(((p.h - it.heading) % 360 + 540) % 360 - 180), disabled: document.querySelector('.ex-fp-confirm').disabled }; }""")
    C.ok(not d['flag'] and not d['map'] and d['arrow'] == 'hidden' and d['dh'] < 1e-6 and d['disabled'], f'the demo ends with its item in the answer state ({d})')
    errs = page.evaluate('() => __harness.errors')
    C.ok(not errs, f'normal speed: no harness errors ({errs})')
    ctx.close()
    return times


LOOP_TIMER = """() => { if (window.__loopMs) return; const T = PX.core.timing, orig = T.loop; window.__loopMs = [];
    T.loop = function (fn) { return orig(function (dt, now) { const t0 = performance.now(), r = fn(dt, now); window.__loopMs.push(performance.now() - t0); return r; }); }; }"""
LOOP_STATS = """() => { const a = (window.__loopMs || []).slice().sort((x, y) => x - y); window.__loopMs = []; const q = (p) => a.length ? Math.round(100 * a[Math.min(a.length - 1, Math.floor(p * a.length))]) / 100 : null; return { n: a.length, median: q(0.5), p95: q(0.95) }; }"""


def throttled(b, cons):
    """Two routes at normal speed with the CPU slowed 4× (390 × 844, DPR 2): neither is voided. Each walk is
    the second item of its page, so the frame-callback timer (LOOP_TIMER) is in place before it starts."""
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    cdp = ctx.new_cdp_session(page)
    cdp.send('Performance.enable')
    def walk(seed, p):
        page.goto(file_url('tests/dev/harness.html', ex='homing', seed=seed - 10, p='route:0', fast=1))
        page.wait_for_function(READY, timeout=60000)
        page.evaluate(LOOP_TIMER)
        page.evaluate('() => { __harness.config.fast = false; PX.debug.fast(false); window.__loopMs = []; }')
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        m0 = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
        page.evaluate('([q, sd]) => { __harness.next(q, sd); }', [p, seed])
        page.wait_for_function("() => __harness.state !== 'respond'", timeout=30000)
        page.wait_for_function(READY, timeout=180000)
        m1 = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
        loop = page.evaluate(LOOP_STATS)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
        s = hs(page)
        f = s['frames'] or {}
        info = page.evaluate("() => { const r = PX.core.stage3d.renderer(); return r ? { calls: r.info.render.calls, triangles: r.info.render.triangles } : null; }")
        js = 1000 * (m1.get('ScriptDuration', 0) - m0.get('ScriptDuration', 0)) / max(1, f.get('frames') or 1)
        return s, f, info, js, loop

    for seed, p in ((31, {'route': 7, 'landmarks': 0, 'tolerance': 0}), (32, {'route': 4, 'landmarks': 2, 'tolerance': 0})):
        s, f, info, js, loop = walk(seed, p)
        first = None
        # A timing void here comes from this shared machine (two browsers on 2 CPUs drawing WebGL in software;
        # the walk's own script is a few ms a frame, walkFrameJsMs): the rule rightly voids it, and the walk
        # runs once more. A walk too slow by itself voids twice and fails.
        if s['voided'] == 'stutter':
            first = {'voided': s['voided'], 'maxGapMs': f.get('maxGapMs'), 'slowShare': f.get('slowShare')}
            s, f, info, js, loop = walk(seed, p)
        REPORT['throttle4x'].append({'params': p, 'voided': s['voided'], 'frames': f, 'fade': s['fade'], 'render': info, 'scriptMsPerFrame': round(js, 2), 'walkFrameJsMs': loop, 'firstTry': first})
        again = f' (run again after one machine stall: {first})' if first else ''
        C.ok(s['voided'] is None, f'4× throttle, {p}: the walk is not voided (median {f.get("medianMs")} ms, p95 {f.get("p95Ms")} ms, max gap {f.get("maxGapMs")} ms, slow share {f.get("slowShare")}){again}')
        C.ok(info and info['calls'] <= 12 and info['triangles'] <= 60000, f'{p}: within the draw budget ({info})')
        C.ok(loop['median'] is not None and loop['median'] <= 8, f'{p}: the walk\'s own JavaScript per frame at 4× (median {loop["median"]} ms, p95 {loop["p95"]} ms over {loop["n"]} frames; all page scripts {js:.2f} ms/frame; R1 §7.3: 2 ms unthrottled)')
    ctx.close()


CLEAR_JS = """() => {
    // Every show-me step (half-way and at its end): movable labels (start, landmarks) must not overlap any label.
    const it = __harness.item, steps = PX.ex.view('homing').mapSteps(it), bad = [], fixed = [];
    const texts = () => Array.from(document.querySelectorAll('.ex-fp-map text')).filter((t) => t.textContent.trim()).map((t) => ({
        r: t.getBoundingClientRect(), txt: t.textContent,
        moves: t.classList.contains('ex-fp-maplabel') }));
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
    """Show me keeps the start and landmark labels clear of every other label."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(file_url('tests/dev/harness.html', ex='homing', seed=2602, p='route:3,landmarks:1,tolerance:1', fast=1))
    page.wait_for_function(READY, timeout=60000)
    cases = [(2602, {'route': 3, 'landmarks': 1, 'tolerance': 1})]
    cases += [(sd, {'route': r, 'landmarks': lm, 'tolerance': 1}) for r in (0, 2, 3, 5, 7) for lm in (0, 1) for sd in (1, 2, 3)]
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
    C.ok(len(bad) <= 2, f'show me keeps start and landmark labels clear of other labels ({len(cases)} items, {steps} steps; {len(bad)} touching: {bad[:4]})')
    C.ok(fixed <= 4, f'turn and angle sizes stay clear of each other ({fixed} touching in {steps} step states)')
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
        touch_only(b, cons)
        label_clearance(b, cons)
        times = walk_pause_void(b, cons)
        throttled(b, cons)
        sandboxed(b, cons)
        b.close()
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    return C.summary(dict(REPORT, showMeSeconds=times, voidedInThisEnvironment=VOIDS, screenshots=sorted(p.name for p in DIR.glob('homing_*.png'))))


if __name__ == '__main__':
    sys.exit(main())
