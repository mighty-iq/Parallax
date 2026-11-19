"""E2E: the dev harness with Reckon (EX-12, experimental; first person through Homing's kit, walk back).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_reckon.py   (two browser slots per machine)

Reckon reuses Homing's route model and 3D kit, so until the harness loads `def.requires` this test opens an
inlined harness page with Homing's gen/learn/view.js and both stylesheets (written to out/reckon/).
1. desktop 1366 × 768 and phone 360 × 740 (DPR 2, touch only), light and dark: the view shows; the start
   ring hides once left; no horizontal scroll; on the phone (header, goal and tip folded away, as the
   player's item screen does) the view, the turn row and the actions fit one screen, at 360 × 640 too
2. touch-only play at 360 × 740: point (drag the view to the start, Confirm) is right; return (drag, hold
   Walk, Here) is right; a wrong turn is wrong; desktop keyboard play (← → with Shift, ↑ held, Enter)
3. the tutorial items by touch: heading (turn back by the turn) and distance (walk the same distance)
4. pause: Esc freezes the walk and voids; the player's pause sheet (an inert host) freezes it and voids;
   after resuming the walk ends where the route ends
5. void rules: a 1.2 s freeze while moving voids ('stutter'); three 300 ms freezes do not; the view
   changing shape mid-walk voids ('turned')
6. frame budget at 4× CPU throttle (390 × 844, DPR 2, normal speed): one route per flow level; none is
   voided; the walk's frame statistics go to the report
7. show me draws your believed home vector and stop; the demo plays to the end and leaves the answer
   state; after 5+ answers the bias line and the error chart show; the record field 'reckon' fills
8. a sandboxed srcdoc page plays by keyboard; no console errors
9. the real player by touch: the reveal comes and stays, no click reaches Next
10. v1.2 (`python3 tests/e2e/harness_reckon.py v12` runs only this): gentle motion (O36), the feedback words
   (O40), the Try tips (O39) and the motion the player hears of
Screenshots: tests/e2e/out/reckon/reckon_<case>.png """
import json
import math
import sys

from playwright.sync_api import sync_playwright

from common import OUT, ROOT, Checks, Console, child_frame, inline_page, launch, non_blank, srcdoc_host

C = Checks('harness_reckon')
DIR = OUT / 'reckon'
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
FILES = [f'js/ex/{x}/{f}' for x in ('homing', 'reckon') for f in ('gen.js', 'learn.js', 'view.js')]
CSS = ['css/ex/homing.css', 'css/ex/reckon.css']
PHONE = {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True}
# the player's phone item screen: no header, goal or tip above the item (B2's layout), one ~60 px strip
FOLD = '.hx-bar, .hx-goal, .hx-tip { display: none !important; } .hx-main { padding-top: 60px !important; }'
REPORT = {'touch': {}, 'voids': {}, 'throttle4x': {}, 'fit': {}}


def url(name, **cfg):
    cfg = dict(cfg, ex='reckon', inlinedCss=True)
    doc = inline_page('tests/dev/harness.html', extra_scripts=FILES, cfg=cfg, extra_css=CSS)
    p = DIR / f'{name}.html'
    p.write_text(doc, encoding='utf-8')
    return p.as_uri()


def shot(target, name, full=False):
    target.screenshot(path=str(DIR / f'reckon_{name}.png'), full_page=full)


def st(target):
    return target.evaluate("() => PX.ex.view('reckon').state()")


def norm180(a):
    return (a + 540) % 360 - 180


class Touch:
    """Touch input through CDP (pointerType 'touch'), for touch-only play."""

    def __init__(self, ctx, page):
        self.page, self.cdp = page, ctx.new_cdp_session(page)

    def ev(self, kind, x=None, y=None):
        pts = [] if x is None else [{'x': x, 'y': y}]
        self.cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': pts})

    def drag(self, x0, y0, dx, steps=10):
        # One move per 16 ms, as a finger on a 60 Hz screen. A burst of moves (100 px in a few ms) reads as a
        # fling, and Chrome then drops the click of a tap that follows within ~30 ms (seen in testing; a
        # finger-paced drag followed by a tap 30 ms later clicks normally).
        self.ev('touchStart', x0, y0)
        for i in range(1, steps + 1):
            self.page.wait_for_timeout(16)
            self.ev('touchMove', x0 + dx * i / steps, y0)
        self.ev('touchEnd')

    def hold(self, sel, ms):
        b = self.page.locator(sel).bounding_box()
        self.ev('touchStart', b['x'] + b['width'] / 2, b['y'] + b['height'] / 2)
        self.page.wait_for_timeout(ms)
        self.ev('touchEnd')

    def tap(self, sel):
        b = self.page.locator(sel).bounding_box()
        x, y = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
        self.ev('touchStart', x, y)
        self.ev('touchEnd')


def turn_to(page, deg, touch=None):
    """Drag the view (touch or mouse) to about deg (° clockwise from ahead), then fine buttons to exactly deg."""
    want = norm180(deg)
    box = page.locator('.ex-fp-stage').bounding_box()
    y0 = box['y'] + box['height'] * 0.6
    cur = st(page)['value']
    remaining = -(want - norm180(cur or 0)) / 0.25   # the world follows the finger: drag left to turn right
    while abs(remaining) > 2:
        seg = max(-0.4 * box['width'], min(0.4 * box['width'], remaining))
        x0 = box['x'] + box['width'] / 2 - seg / 2
        if touch:
            touch.drag(x0, y0, seg)
        else:
            page.mouse.move(x0, y0)
            page.mouse.down()
            page.mouse.move(x0 + seg, y0, steps=8)
            page.mouse.up()
        remaining -= seg
    for _ in range(40):
        v = st(page)['value']
        d = norm180(want - (v if v is not None else 0))
        if abs(d) < 0.5:
            break
        sel = '[data-turn="%d"]' % ((5 if d > 0 else -5) if abs(d) >= 5 else (1 if d > 0 else -1))
        touch.tap(sel) if touch else page.locator(sel).click()
        page.wait_for_timeout(60)
    return st(page)['value']


TOGGLE_MS = 250  # js/ex/reckon/view.js: a shorter press of Walk or Back is a tap, which leaves the walk going


def walk_back(page, dist, speed, touch=None):
    """Hold Walk about dist / speed seconds, then correct with short moves of Walk or Back (closed loop). A move
    shorter than a hold (v1.2: a tap leaves the walk going) is a tap to start and another to stop."""
    def press(sel, ms):
        if touch:
            touch.hold(sel, ms)
        else:
            b = page.locator(sel).bounding_box()
            page.mouse.move(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2)
            page.mouse.down()
            page.wait_for_timeout(ms)
            page.mouse.up()

    def hold(sel, ms):
        if ms >= TOGGLE_MS + 50:
            press(sel, ms)
        else:
            press(sel, 20)
            page.wait_for_timeout(ms)
            press(sel, 20)
        page.wait_for_timeout(350)
    hold('.ex-reckon-walk', int(1000 * dist / speed))
    for _ in range(6):
        got = st(page)['dist']
        err = dist - got
        if abs(err) < 0.08 * dist:
            break
        hold('.ex-reckon-walk' if err > 0 else '.ex-reckon-back', max(80, int(1000 * abs(err) / (speed if err > 0 else 0.6 * speed))))
    return st(page)['dist']


def drawn_ok(page, tag):
    ok, s = non_blank(page.locator('.ex-fp-stage').screenshot(), min_distinct=6, max_top=0.92)
    C.ok(ok, f'{tag}: the 3D view shows the plain and its marks ({s})')
    d = page.evaluate("""() => { const it = __harness.item, p = PX.ex.view('reckon').pose(), E = it.path[it.path.length - 1];
        return { gap: Math.hypot(p.x - E[0], p.y - E[1]), dh: Math.abs(((p.h - it.heading) % 360 + 540) % 360 - 180), sw: [document.documentElement.scrollWidth, innerWidth],
            ring: PX.ex.view('reckon').state().ring, task: it.task || null, lm: document.querySelectorAll('.ex-fp-maplandmark').length }; }""")
    C.ok(d['gap'] < 1e-6 and d['dh'] < 1e-6, f'{tag}: the answer phase starts on the end of the route, facing its final heading ({d["gap"]:.2g} m, {d["dh"]:.2g}°)')
    C.ok(d['task'] == 'heading' or not d['ring'], f'{tag}: the start ring is gone once left (no fix after the start)')
    C.ok(d['sw'][0] <= d['sw'][1], f'{tag}: no horizontal scroll ({d["sw"]})')


def fits(page, tag, size):
    page.add_style_tag(content=FOLD)
    page.evaluate('() => window.scrollTo(0, 0)')
    page.wait_for_timeout(150)
    d = page.evaluate("""() => { const r = (s) => { const e = document.querySelector(s); if (!e || e.hidden || !e.offsetParent) return null; const b = e.getBoundingClientRect(); return [b.top, b.bottom, b.left, b.right, b.width, b.height]; };
        const acts = [...document.querySelectorAll('.ex-fp-actions > .px-btn')].filter((b) => !b.hidden).map((b) => b.getBoundingClientRect());
        return { vh: innerHeight, vw: innerWidth, stage: r('.ex-fp-stage'), dial: r('.ex-fp-dialbox'), fine: [...document.querySelectorAll('.ex-fp-fine')].map((b) => b.getBoundingClientRect().width),
            bottom: Math.max(...acts.map((b) => b.bottom)), minBtn: Math.min(...acts.map((b) => Math.min(b.width, b.height))) }; }""")
    REPORT['fit'][tag] = d
    C.ok(d['stage'] and d['stage'][0] >= 0 and d['bottom'] <= d['vh'] + 0.5, f'{tag} at {size}: the view and every answer control fit one screen without scrolling (stage top {d["stage"] and round(d["stage"][0])}, actions end {round(d["bottom"])} of {d["vh"]})')
    C.ok(d['minBtn'] >= 44 and min(d['fine']) >= 44, f'{tag}: touch targets ≥ 44 px (actions {d["minBtn"]:.0f}, fine {min(d["fine"]):.0f})')


def phone_play(b, cons):
    """Touch-only play at 360 × 740: point, return, the two tutorial items; fit at 360 × 740 and 360 × 640."""
    ctx = b.new_context(viewport={'width': 360, 'height': 740}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    tt = Touch(ctx, page)
    # point: drag the view to the start, Confirm
    page.goto(url('phone_point', seed=21, p='route:0,flow:0,speed:0,tolerance:0', v='point', fast=True))
    page.wait_for_function(READY, timeout=90000)
    drawn_ok(page, 'phone point')
    fits(page, 'phone point', '360x740')
    shot(page, 'p360_point_answer')
    # a vertical swipe that starts on ◀5° scrolls the page and turns nothing; a tap still turns 5°
    # (RV-play-nav-knots 1: the swipe used to turn the answer and block the scroll)
    page.evaluate('() => window.scrollTo(0, 0)')
    v0, can_scroll = st(page)['value'], page.evaluate('() => document.documentElement.scrollHeight > innerHeight + 4')
    b5 = page.locator('[data-turn="-5"]').bounding_box()
    sx, sy = b5['x'] + b5['width'] / 2, b5['y'] + b5['height'] / 2
    tt.ev('touchStart', sx, sy)
    for i in range(1, 11):
        page.wait_for_timeout(16)
        tt.ev('touchMove', sx, sy - 12 * i)
    tt.ev('touchEnd')
    page.wait_for_timeout(400)
    v1, y1 = st(page)['value'], page.evaluate('() => scrollY')
    page.evaluate('() => window.scrollTo(0, 0)')
    page.wait_for_timeout(100)
    tt.tap('[data-turn="-5"]')
    page.wait_for_timeout(150)
    v2 = st(page)['value']
    C.ok(v1 == v0 and (y1 > 0 or not can_scroll) and v2 is not None and norm180(v2 - (v0 or 0)) == -5,
         f'phone: a swipe from ◀5° scrolls ({y1} px; page scrolls: {can_scroll}) and leaves the answer ({v0} → {v1}); a tap turns 5° ({v2})')
    key = page.evaluate('() => __harness.item.keyDeg')
    v = turn_to(page, key, tt)
    tt.tap('.ex-fp-confirm')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    last = page.evaluate('() => __harness.last')
    C.ok(last['result']['correct'] and last['response'] == v, f'phone: a point answer by dragging the view and tapping Confirm is right ({last["response"]} vs key {key}, {last["result"]})')
    C.ok(st(page)['input'] == 'touch', f'phone: the answer is logged as touch ({st(page)["input"]}, mode {st(page)["mode"]})')
    page.wait_for_timeout(700)
    shot(page, 'p360_point_reveal', full=True)
    # return: drag, hold Walk, Here
    page.evaluate("() => __harness.next({ variant: 'return', route: 0, flow: 0, speed: 0, tolerance: 0 }, 33)")
    page.wait_for_function(READY, timeout=90000)
    fits(page, 'phone return', '360x740')
    shot(page, 'p360_return_answer')
    it = page.evaluate('() => ({ key: __harness.item.keyDeg, d: __harness.item.distance, v: __harness.item.walkSpeed })')
    turn_to(page, it['key'], tt)
    locked0 = page.evaluate("() => document.querySelector('[data-turn=\"5\"]').disabled")
    WALK_BOX = "() => { const b = document.querySelector('.ex-reckon-walk').getBoundingClientRect(), h = document.querySelector('.ex-reckon-here').getBoundingClientRect(); return [b.top, Math.max(b.bottom, h.bottom), innerHeight]; }"
    box0 = page.evaluate(WALK_BOX)
    walked = walk_back(page, it['d'], it['v'], tt)
    box1 = page.evaluate(WALK_BOX)
    locked = page.evaluate("() => ({ fine: document.querySelector('[data-turn=\"5\"]').disabled, walked: document.querySelector('.ex-fp').classList.contains('is-walked') })")
    C.ok(not locked0 and locked['fine'] and locked['walked'], f'phone: turning locks while away from the route\'s end ({locked})')
    C.ok(abs(box1[0] - box0[0]) < 1 and box1[1] <= box1[2] + 0.5, f'phone: Walk, Back and Here stay put once walking starts and stay on screen (Walk top {box0[0]:.0f} → {box1[0]:.0f}, row bottom {box1[1]:.0f} of {box1[2]})')
    shot(page, 'p360_return_walked')
    tt.tap('.ex-reckon-here')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    last = page.evaluate('() => __harness.last')
    REPORT['touch']['return'] = {'walked': walked, 'd': it['d'], 'result': last['result']}
    C.ok(last['result']['correct'] and abs(last['result']['detail']['dist'] - it['d']) < 0.2 * it['d'],
         f'phone: a return by dragging, holding Walk and tapping Here is right (walked {walked:.2f} of {it["d"]:.2f} m; {last["result"]["detail"]})')
    page.wait_for_timeout(700)
    shot(page, 'p360_return_reveal', full=True)
    notes = page.locator('.ex-fp-notes').inner_text()
    C.ok('Drift' in notes and 'cm per metre' in notes and 'm from the start' in page.locator('.ex-fp-verdict').inner_text(), f'phone: the reveal names the position error and the drift ({notes[:160]!r})')
    # show me: the believed vector and the stop
    page.evaluate("() => { __harness.config.fast = true; PX.debug.fast(true); }")
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.showMe(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
    m = page.evaluate("() => ({ yours: document.querySelectorAll('.ex-fp-map .ex-fp-yours').length, stop: document.querySelectorAll('.ex-fp-map .ex-fp-stop').length, back: document.querySelectorAll('.ex-fp-map .ex-fp-back').length })")
    C.ok(m['yours'] == 1 and m['stop'] == 1 and m['back'] == 1, f'show me draws the true way back, your walked vector and your stop ({m})')
    shot(page, 'p360_return_showme')
    # a wrong answer: turned 90° off
    page.evaluate("() => __harness.next({ variant: 'point', route: 1, flow: 1, speed: 1, tolerance: 1 }, 34)")
    page.wait_for_function(READY, timeout=90000)
    key = page.evaluate('() => __harness.item.keyDeg')
    turn_to(page, key + 90, tt)
    tt.tap('.ex-fp-confirm')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    C.ok(not page.evaluate('() => __harness.last.result.correct'), 'phone: a turn 90° off is wrong')
    # the tutorial items
    page.evaluate("() => __harness.next({ variant: 'point', task: 'heading', route: 0, flow: 0, speed: 0, tolerance: 0 }, 35)")
    page.wait_for_function(READY, timeout=90000)
    T = page.evaluate('() => __harness.item.turns[0]')
    turn_to(page, -T, tt)
    tt.tap('.ex-fp-confirm')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    C.ok(page.evaluate('() => __harness.last.result.correct'), f'phone: the heading item (turned {T}°, turn back) is right by touch')
    page.evaluate("() => __harness.next({ variant: 'return', task: 'distance', route: 0, flow: 0, speed: 0, tolerance: 1 }, 36)")
    page.wait_for_function(READY, timeout=90000)
    it = page.evaluate('() => ({ L: __harness.item.legs[0], v: __harness.item.walkSpeed, fine: getComputedStyle(document.querySelector(\'[data-turn="5"]\')).visibility })')
    walk_back(page, it['L'], it['v'], tt)
    tt.tap('.ex-reckon-here')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    C.ok(page.evaluate('() => __harness.last.result.correct') and it['fine'] == 'hidden', f'phone: the distance item (walk {it["L"]} m again) is right by touch; no turning on it ({it["fine"]})')
    shot(page, 'p360_distance_reveal', full=True)
    errs = page.evaluate('() => __harness.errors')
    C.ok(not errs, f'phone: no harness errors ({errs})')
    ctx.close()
    # 360 × 640 (B2's fit size) and landscape
    for vp, tag in (((360, 640), 'p640'), ((740, 360), 'l740')):
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **PHONE)
        page = ctx.new_page()
        cons.append(Console(page))
        page.goto(url('fit_' + tag, seed=41, p='route:3,flow:2,speed:2,tolerance:2', v='return', fast=True))
        page.wait_for_function(READY, timeout=90000)
        fits(page, 'return ' + tag, '%dx%d' % vp)
        shot(page, tag + '_return_answer')
        ctx.close()


def open_app(page):
    """The app itself, its welcome closed and every tutorial marked seen."""
    page.goto((ROOT / 'index.html').resolve().as_uri())
    page.wait_for_function('document.documentElement.getAttribute("data-px-ready") === "1"', timeout=30000)
    for _ in range(4):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
    page.evaluate("""() => { const r = PX.core.store.state; r.tour = r.tour || { seen: {} }; r.tour.seen = r.tour.seen || {};
        PX.ex.list().forEach(d => { r.tour.seen[d.id] = true; }); }""")


def app_item(page, params, until, ex='reckon'):
    """A Free play run of Reckon (or `ex`) with these settings, until the player reaches state `until` (an
    intro or offer card may come first, as in fit.py)."""
    if ex == 'reckon' and 'legs' not in params:
        params = dict(params, legs=0)  # v1.2, version 2: the player's Free play asks for every dim
    cfg = {'mode': 'free', 'exId': ex, 'run': '1', 'trials': 2, 'params': params}
    page.evaluate(f'void PX.core.router.go("play", {json.dumps(cfg)}, {{ force: true }})')
    for _ in range(900):
        if page.evaluate('window.__play ? __play.state : null') == until:
            return
        for sel in ('[data-card-box] [data-card="skip"]', '[data-card-box] .px-btn--primary'):
            loc = page.locator(sel)
            if loc.count() and loc.first.is_visible():
                loc.first.click()
                page.wait_for_timeout(200)
        page.wait_for_timeout(100)


def app_wtg(b, cons):
    """Watch and Try in the real player at 390 × 844 (the player's ctx.demo and ctx.practice flags): Reckon's
    Watch runs no silent walk (the demo's captioned replay is the only one), Homing's Watch reaches its
    captions within seconds at normal speed, and Try answers stay out of Reckon's bias record."""
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    open_app(page)
    page.evaluate("() => { const K = PX.ex.view('homing').kit, w = K.walker; window.__walks = 0; K.walker = function () { __walks++; return w.apply(this, arguments); }; }")
    state = lambda: page.evaluate('window.__play ? __play.state : null')
    hist = lambda: page.evaluate("() => ((PX.core.store.state.reckon || {}).hist || []).length")
    # Reckon: Watch, then two Try items, fast
    page.evaluate('PX.debug.fast(true)')
    page.evaluate("PX.core.store.state.tour.seen['reckon'] = false")
    h0 = hist()
    page.evaluate('void PX.core.router.go("play", { mode: "watch", exId: "reckon" }, { force: true })')
    page.wait_for_function("() => window.__play && __play.state === 'showme'", timeout=30000)
    walks_watch = page.evaluate('window.__walks')
    tries, seen_next = 0, False
    for _ in range(1500):
        s_ = state()
        if s_ == 'respond':
            page.evaluate('__play.answer(true).catch(() => 0)')
            if seen_next:
                tries += 1
            page.wait_for_timeout(150)
        elif s_ == 'reveal':
            page.evaluate('__play.next()')
            seen_next = True
            if tries >= 4:  # items 3 and 4 are a regular point and return item (1 and 2 are tasks, never kept)
                break
            page.wait_for_timeout(150)
        page.wait_for_timeout(40)
    walks_all, h1 = page.evaluate('window.__walks'), hist()
    page.evaluate('void __play.end()')
    C.ok(walks_watch == 0 and tries >= 4 and walks_all >= tries and h1 == h0,
         f'Reckon Watch, Try: no silent walk before the demo (walks at the demo {walks_watch}); {tries} Try items walked ({walks_all} walks) and left the bias record alone ({h0} → {h1} entries)')
    # Homing: Watch at normal speed reaches its captions within seconds (no silent first walk)
    page.evaluate('PX.debug.fast(false)')
    page.evaluate("PX.core.store.state.tour.seen['homing'] = false")
    t0 = page.evaluate('performance.now()')
    page.evaluate('void PX.core.router.go("play", { mode: "watch", exId: "homing" }, { force: true })')
    page.wait_for_function("() => window.__play && __play.state === 'showme'", timeout=60000)
    secs = (page.evaluate('performance.now()') - t0) / 1000
    page.evaluate('void __play.end()')
    C.ok(secs < 6, f'Homing Watch: the captioned demo starts {secs:.1f} s after Watch opens (a silent walk first would take 15–28 s)')
    ctx.close()


def app_pause(b, cons):
    """The real player's pause mid-walk (RV S4): Esc opens its sheet, the walk freezes and the item is void;
    Resume goes on with the walk to its end, and the answer is logged as void."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    open_app(page)
    page.evaluate('PX.debug.fast(false)')
    app_item(page, {'variant': 'point', 'route': 1, 'flow': 0, 'speed': 0, 'tolerance': 0}, 'present')
    page.wait_for_function("() => { const p = PX.ex.view('reckon').pose(), it = __play.item; return p && it && Math.hypot(p.x - it.path[0][0], p.y - it.path[0][1]) > 0.5; }", timeout=60000)
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    p1 = page.evaluate("() => PX.ex.view('reckon').pose()")
    page.wait_for_timeout(800)
    p2 = page.evaluate("() => PX.ex.view('reckon').pose()")
    sheet = page.evaluate("() => ({ state: __play.state, shown: !document.querySelector('.pl-pause').hidden })")
    shot(page, 'app_pause_sheet')
    page.locator('.pl-pause .px-btn--primary').click()
    page.wait_for_function("() => __play.state === 'respond'", timeout=90000)
    end = page.evaluate("() => { const p = PX.ex.view('reckon').pose(), E = __play.item.path.at(-1); return Math.hypot(p.x - E[0], p.y - E[1]); }")
    page.evaluate('__play.answer(true).catch(() => 0)')
    page.wait_for_function("() => __play.state === 'reveal'", timeout=10000)
    void = page.evaluate("() => { const l = __play.last || {}; return l.voidReason || l.void || null; }")
    C.ok(sheet['state'] == 'paused' and sheet['shown'] and p1 == p2 and end < 1e-6 and bool(void),
         f'the real player: Esc mid-walk opens its pause sheet and freezes the walk ({sheet}, frozen {p1 == p2}); Resume walks on to the end (gap {end:.2g} m); the answer is void ({void})')
    ctx.close()


def app_touch(b, cons):
    """The real player at 360 × 740 by touch: drag, then Confirm 40 ms later (point); drag, hold Walk, Here
    (return). The reveal must come and stay, and no click may reach the player's Next (kit.tapAct cancels
    the tap's touchend, so the answer changing the screen never clicks what is under the finger)."""
    ctx = b.new_context(viewport={'width': 360, 'height': 740}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    open_app(page)
    page.evaluate("() => { window.__nextClicks = 0; document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-next]')) __nextClicks++; }, true); }")
    tt = Touch(ctx, page)
    play = lambda: page.evaluate('window.__play ? __play.state : null')
    out = []
    for v in ('point', 'point', 'return'):
        page.evaluate('PX.debug.fast(true)')
        app_item(page, {'variant': v, 'route': 0, 'flow': 0, 'speed': 0, 'tolerance': 0}, 'respond')
        it = page.evaluate('() => ({ key: __play.item.keyDeg, d: __play.item.distance, v: __play.item.walkSpeed })')
        turn_to(page, it['key'], tt)
        if v == 'return':
            walk_back(page, it['d'], it['v'], tt)
        page.wait_for_timeout(40)
        tt.tap('.pl-trial ' + ('.ex-reckon-here' if v == 'return' else '.ex-fp-confirm'))
        page.wait_for_timeout(1500)
        out.append([v, play(), page.evaluate("() => __play.last && __play.last.input")])
        if v == 'return':  # RV-play-nav-knots 4: the explanation ends above the player's result bar
            vis = page.evaluate("""() => { const bar = document.querySelector('.pl-feedback'), n = document.querySelector('.pl-trial .ex-fp-notes'), c = document.querySelector('.pl-trial .ex-reckon-chart'), v = document.querySelector('.pl-trial .ex-fp-verdict');
                const last = c && !c.hidden ? c : n, b = bar.getBoundingClientRect(), l = last.getBoundingClientRect(), f = v.getBoundingClientRect();
                return { barTop: Math.round(b.top), lastBottom: Math.round(l.bottom), verdictTop: Math.round(f.top), scrollY: Math.round(scrollY) }; }""")
            shot(page, 'app_return_reveal')
        page.evaluate('void __play.end()')
    REPORT['touch']['app'] = {'items': out, 'nextClicks': page.evaluate('window.__nextClicks')}
    C.ok(vis['lastBottom'] <= vis['barTop'] + 1 and vis['verdictTop'] >= 0, f'the real player at 360 × 740: after a walk back the explanation ends above the result bar, the verdict in view ({vis})')
    C.ok(all(o[1] == 'reveal' for o in out) and page.evaluate('window.__nextClicks') == 0,
         f'the real player by touch: the answer shows its reveal and keeps it, no click reaches Next ({REPORT["touch"]["app"]})')
    shot(page, 'app_touch_end')
    ctx.close()


REVEAL_VIS = """(ex) => { const q = s => document.querySelector('.pl-trial ' + s), bar = document.querySelector('.pl-feedback');
    const v = q('.ex-fp-verdict'), n = q('.ex-fp-notes'), c = ex === 'reckon' ? q('.ex-reckon-chart') : null, last = c && !c.hidden ? c : n;
    const r = e => e.getBoundingClientRect();
    return { barTop: Math.round(r(bar).top), notesBottom: Math.round(r(n).bottom), lastBottom: Math.round(r(last).bottom), verdictTop: Math.round(r(v).top),
             block: Math.round(r(last).bottom - r(v).top), chart: !!(c && !c.hidden), habit: !!q('.ex-reckon-bias'), words: n.textContent.split(/\\s+/).length,
             scrollY: Math.round(scrollY) }; }"""


def reveal_sizes(b, cons):
    """RV-play-nav-knots 4 at the fit check's two phone sizes: in the real player, after a wrong answer the
    view brings its whole explanation above the sticky result bar (kit.showAboveBar) with the verdict in
    view. The longest texts: Reckon after five wrong answers (drift chart and habit line), a point item
    turned as if the heading never updated (its hint), a return item walked that way too far (split,
    drift and hint); Homing on its longest route."""
    rows = []
    for vp in ((360, 640), (390, 844)):
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **PHONE)
        page = ctx.new_page()
        cons.append(Console(page))
        open_app(page)
        page.evaluate('PX.debug.fast(true)')
        tt = Touch(ctx, page)
        plan = [('reckon', 'point')] * 3 + [('reckon', 'return'), ('reckon', 'point'), ('reckon', 'point'), ('reckon', 'return'), ('homing', None)]
        for i, (ex, v) in enumerate(plan):
            params = {'route': 7, 'flow': 1, 'speed': 1, 'tolerance': 2} if ex == 'reckon' else {'route': 7, 'landmarks': 0, 'tolerance': 2}
            if v:
                params['variant'] = v
            app_item(page, params, 'respond', ex)
            if i >= 5 and ex == 'reckon':
                it = page.evaluate('() => ({ key: __play.item.keyDeg, S: __play.item.turns.reduce((a, b) => a + b, 0), d: __play.item.distance, v: __play.item.walkSpeed })')
                turn_to(page, it['key'] + it['S'], tt)
                if v == 'return':
                    walk_back(page, 1.3 * it['d'], it['v'], tt)
                tt.tap('.pl-trial ' + ('.ex-reckon-here' if v == 'return' else '.ex-fp-confirm'))
            else:
                page.evaluate('__play.answer(false).catch(() => __play.answer(true)).catch(() => 0)')
            page.wait_for_function("() => __play.state === 'reveal'", timeout=60000)
            page.wait_for_timeout(1400)
            if i >= 5:
                vis = page.evaluate(REVEAL_VIS, ex)
                vis.update(size='%dx%d' % vp, ex=ex, v=v or 'point')
                rows.append(vis)
                shot(page, 'reveal_%dx%d_%s_%s' % (vp[0], vp[1], ex, v or 'point'))
            page.evaluate('void __play.end()')
        ctx.close()
    REPORT['reveal'] = rows
    # v1.2 (W2-bets' request; CONTRACT-v1.2 conflict 9): the habit line and the chart are the calibration-detail arm,
    # which the engine's pick hook sets in Train and Path only; Free play passes no layer, so they stay away here
    # (the harness, which passes none at all, still shows them: demo_bias_srcdoc, v12)
    for r in rows:
        C.ok(r['lastBottom'] <= r['barTop'] + 1 and r['verdictTop'] >= 0 and (r['ex'] == 'homing' or (not r['chart'] and not r['habit'])),
             f"the real player at {r['size']}, {r['ex']} {r['v']}: the explanation{' (Free play: no habit line or chart, the detail arm is Train and Path only)' if r['ex'] == 'reckon' else ''} ends above the result bar, the verdict in view ({r})")


def desktop_keys(b, cons):
    for theme in ('light', 'dark'):
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
        page = ctx.new_page()
        cons.append(Console(page))
        page.goto(url('desk_' + theme, seed=51, p='route:3,flow:1,speed:1,tolerance:1', v='point', fast=True, theme=theme))
        page.wait_for_function(READY, timeout=90000)
        drawn_ok(page, 'desktop ' + theme)
        shot(page, f'd1366_{theme}_answer')
        key = round(page.evaluate('() => __harness.item.keyDeg'))
        t = key if key <= 180 else key - 360
        k, n = ('ArrowRight', t) if t >= 0 else ('ArrowLeft', -t)
        for _ in range(n // 5):
            page.keyboard.press(k)
        for _ in range(n % 5):
            page.keyboard.press('Shift+' + k)
        page.wait_for_timeout(250)
        page.keyboard.press('Enter')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        last = page.evaluate('() => __harness.last')
        C.ok(last['result']['correct'] and abs(last['result']['value']) <= 1 and st(page)['input'] == 'key', f'desktop {theme}: ← → (5°) and Shift (1°), Enter: right, logged as keys ({last["result"]}, {st(page)["input"]})')
        page.wait_for_timeout(700)
        shot(page, f'd1366_{theme}_reveal')
        if theme == 'light':
            # return by keys: ↑ held walks, ↓ steps back, Enter is Here
            page.evaluate("() => __harness.next({ variant: 'return', route: 2, flow: 0, speed: 2, tolerance: 0 }, 52)")
            page.wait_for_function(READY, timeout=90000)
            it = page.evaluate('() => ({ key: __harness.item.keyDeg, d: __harness.item.distance, v: __harness.item.walkSpeed })')
            turn_to(page, it['key'])
            page.keyboard.down('ArrowUp')
            page.wait_for_timeout(int(1000 * it['d'] / it['v']))
            page.keyboard.up('ArrowUp')
            page.wait_for_timeout(400)
            got = st(page)['dist']
            page.keyboard.down('ArrowDown')
            page.wait_for_timeout(300)
            page.keyboard.up('ArrowDown')
            page.wait_for_timeout(400)
            back = st(page)['dist']
            C.ok(got > 0.5 * it['d'] and back < got, f'desktop: ↑ held walks back ({got:.2f} m of {it["d"]:.2f}), ↓ steps back ({back:.2f} m)')
            page.keyboard.press('Enter')
            page.wait_for_function(STATE, arg='reveal', timeout=10000)
            C.ok(page.evaluate('() => __harness.last.response.z !== undefined'), 'desktop: Enter sends the stop as a position')
            shot(page, 'd1366_light_return_reveal', full=True)
        errs = page.evaluate('() => __harness.errors')
        C.ok(not errs, f'desktop {theme}: no harness errors ({errs})')
        ctx.close()


def wait_moving(page, after_ms=0):
    """Until the walk has left the lead-in (the pose moved), plus after_ms."""
    page.wait_for_function("() => { const s = PX.ex.view('reckon').state(); const p = PX.ex.view('reckon').pose(), it = __harness.item; return s && s.walking && p && Math.hypot(p.x - it.path[0][0], p.y - it.path[0][1]) > 0.3; }", timeout=60000)
    if after_ms:
        page.wait_for_timeout(after_ms)


def pauses_and_voids(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    P = 'route:1,flow:0,speed:0,tolerance:0'
    # the player's pause during the walk (Esc or its Pause button) calls view.pause(), later view.resume(): the
    # walk freezes, then goes on to its end (the view has no pause of its own; app_pause checks the real player)
    page.goto(url('pause_esc', seed=61, p=P, v='point'))
    wait_moving(page, 500)
    page.evaluate("() => PX.ex.view('reckon').pause()")
    page.wait_for_timeout(200)
    p1 = page.evaluate("() => PX.ex.view('reckon').pose()")
    page.wait_for_timeout(700)
    p2 = page.evaluate("() => PX.ex.view('reckon').pose()")
    s1 = st(page)
    shot(page, 'pause_esc')
    page.evaluate("() => PX.ex.view('reckon').resume()")
    page.wait_for_function(READY, timeout=90000)
    end = page.evaluate("() => { const p = PX.ex.view('reckon').pose(), E = __harness.item.path.at(-1); return Math.hypot(p.x - E[0], p.y - E[1]); }")
    C.ok(s1['voided'] == 'paused' and p1 == p2 and end < 1e-6, f'pause() freezes the walk ({p1 == p2}) and voids it ({s1["voided"]}); resume() finishes the route (end gap {end:.2g} m)')
    page.keyboard.press('ArrowRight')
    page.keyboard.press('Enter')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    C.ok(page.evaluate('() => __harness.last.void') is True, 'the paused item is marked void')
    # the player's pause sheet makes the host inert: the walk freezes, and the item is void
    page.goto(url('pause_host', seed=62, p=P, v='point'))
    wait_moving(page, 400)
    page.evaluate("() => document.querySelector('.hx-host').setAttribute('inert', '')")
    page.wait_for_timeout(200)
    p1 = page.evaluate("() => PX.ex.view('reckon').pose()")
    page.wait_for_timeout(800)
    p2 = page.evaluate("() => PX.ex.view('reckon').pose()")
    page.evaluate("() => document.querySelector('.hx-host').removeAttribute('inert')")
    page.wait_for_function(READY, timeout=90000)
    s2 = st(page)
    C.ok(p1 == p2 and s2['voided'] == 'paused', f'the player\'s pause (an inert host) freezes the walk ({p1 == p2}) and voids it ({s2["voided"]})')
    REPORT['voids']['pause'] = {'esc': s1['voided'], 'host': s2['voided']}
    # a pause during the walk back with the button still held: the walk stops at once and stays put
    page.evaluate("() => { __harness.config.fast = true; PX.debug.fast(true); }")
    page.evaluate("() => __harness.next({ variant: 'return', route: 0, flow: 0, speed: 0, tolerance: 0 }, 64)")
    page.wait_for_function(READY, timeout=90000)
    wb = page.locator('.ex-reckon-walk').bounding_box()
    page.mouse.move(wb['x'] + wb['width'] / 2, wb['y'] + wb['height'] / 2)
    page.mouse.down()
    page.wait_for_timeout(600)
    page.evaluate("() => document.querySelector('.hx-host').setAttribute('inert', '')")
    page.wait_for_timeout(100)
    d1 = st(page)['dist']
    page.wait_for_timeout(700)
    d2 = st(page)['dist']
    page.evaluate("() => document.querySelector('.hx-host').removeAttribute('inert')")
    page.mouse.up()
    page.wait_for_timeout(300)
    d3 = st(page)['dist']
    C.ok(d1 > 0.3 and d1 == d2 == d3, f'a pause during the walk back (button still held) stops it at once; it stays put ({d1:.2f}, {d2:.2f}, {d3:.2f} m)')
    # a 1.2 s freeze while moving voids; three 300 ms freezes do not
    for name, freezes, want in (('freeze1200', [1200], 'stutter'), ('freeze3x300', [300, 300, 300], None)):
        page.goto(url(name, seed=63, p=P, v='point'))
        wait_moving(page, 300)
        for ms in freezes:
            page.evaluate('(ms) => { const t = performance.now(); while (performance.now() - t < ms) {} }', ms)
            page.wait_for_timeout(700)
        page.wait_for_function(READY, timeout=90000)
        s = st(page)
        REPORT['voids'][name] = {'voided': s['voided'], 'frames': s['frames']}
        C.ok(s['voided'] == want, f'{name}: voided = {want} ({s["voided"]}; max gap {s["frames"]["maxGapMs"]} ms, slow share {s["frames"]["slowShare"]})')
    # the view changes shape mid-walk (the phone turned, a window resized): void. 600 px switches to the
    # phone layout, so the view itself changes size (a resize that leaves the view alone harms nothing).
    page.goto(url('turned', seed=64, p=P, v='point'))
    wait_moving(page, 300)
    w0 = page.evaluate("() => document.querySelector('.ex-fp-stage').getBoundingClientRect().width")
    page.set_viewport_size({'width': 600, 'height': 768})
    page.wait_for_function(READY, timeout=90000)
    s = st(page)
    REPORT['voids']['turned'] = s['voided']
    w1 = page.evaluate("() => document.querySelector('.ex-fp-stage').getBoundingClientRect().width")
    C.ok(s['voided'] == 'turned', f'a change of the view\'s shape mid-walk voids the item ({s["voided"]}; view {w0:.0f} → {w1:.0f} px wide)')
    page.set_viewport_size({'width': 1366, 'height': 768})
    # the screen changes shape while answering, here mid-walk back: void at once (R1 §7.4)
    page.goto(url('turned_answer', seed=65, p=P, v='return', fast=True))
    page.wait_for_function(READY, timeout=90000)
    wb = page.locator('.ex-reckon-walk').bounding_box()
    page.mouse.move(wb['x'] + wb['width'] / 2, wb['y'] + wb['height'] / 2)
    page.mouse.down()
    page.wait_for_timeout(500)
    page.set_viewport_size({'width': 600, 'height': 768})
    page.wait_for_timeout(300)
    page.mouse.up()
    s = st(page)
    note = page.locator('.ex-fp-void').inner_text()
    C.ok(s['voided'] == 'turned' and 'while you answered' in note, f'a change of shape while walking back voids the item ({s["voided"]}; note {note!r})')
    page.set_viewport_size({'width': 1366, 'height': 768})
    errs = page.evaluate('() => __harness.errors')
    C.ok(not errs, f'pause and void: no harness errors ({errs})')
    ctx.close()


LOOP_TIMER = """() => { if (window.__loopMs) return; const T = PX.core.timing, orig = T.loop; window.__loopMs = [];
    T.loop = function (fn) { return orig(function (dt, now) { const t0 = performance.now(), r = fn(dt, now); window.__loopMs.push(performance.now() - t0); return r; }); }; }"""
LOOP_STATS = """() => { const a = (window.__loopMs || []).slice().sort((x, y) => x - y); window.__loopMs = []; const q = (p) => a.length ? Math.round(100 * a[Math.min(a.length - 1, Math.floor(p * a.length))]) / 100 : null; return { n: a.length, median: q(0.5), p95: q(0.95) }; }"""


def throttled(b, cons):
    """One route per flow level at normal speed with the CPU slowed 4× (390 × 844, DPR 2). Each walk is the
    second item of its page, so the frame-callback timer (LOOP_TIMER) is in place before it starts."""
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    cdp = ctx.new_cdp_session(page)
    cdp.send('Performance.enable')
    def walk(flow, name):
        page.goto(url(f'throttle_{name}', seed=60 + flow, p='route:0', v='point', fast=True))
        page.wait_for_function(READY, timeout=90000)
        page.evaluate(LOOP_TIMER)
        page.evaluate('() => { __harness.config.fast = false; PX.debug.fast(false); window.__loopMs = []; }')
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        m0 = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
        page.evaluate('([q, sd]) => { __harness.next(q, sd); }', [{'variant': 'return', 'route': 6, 'flow': flow, 'speed': 1, 'tolerance': 0}, 70 + flow])
        page.wait_for_function("() => __harness.state !== 'respond'", timeout=30000)
        page.wait_for_function(READY, timeout=180000)
        m1 = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
        loop = page.evaluate(LOOP_STATS)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
        s = st(page)
        f = s['frames'] or {}
        info = page.evaluate("() => { const r = PX.core.stage3d.renderer(); return r ? { calls: r.info.render.calls, triangles: r.info.render.triangles } : null; }")
        js = 1000 * (m1.get('ScriptDuration', 0) - m0.get('ScriptDuration', 0)) / max(1, f.get('frames') or 1)
        return s, f, info, js, loop

    for flow, name in ((0, 'textured'), (1, 'sparse'), (2, 'dots')):
        s, f, info, js, loop = walk(flow, name)
        first = None
        # a timing void here comes from this shared machine (two browsers on 2 CPUs drawing WebGL in software;
        # the walk's own script is a few ms a frame, walkFrameJsMs): the rule rightly voids it, and the walk
        # runs once more; a walk too slow by itself voids twice and fails
        if s['voided'] == 'stutter':
            first = {'voided': s['voided'], 'maxGapMs': f.get('maxGapMs'), 'slowShare': f.get('slowShare')}
            s, f, info, js, loop = walk(flow, name)
        REPORT['throttle4x'][name] = {'voided': s['voided'], 'frames': f, 'dots': s['dots'], 'fade': s['fade'], 'render': info, 'scriptMsPerFrame': round(js, 2), 'walkFrameJsMs': loop, 'firstTry': first}
        again = f' (run again after one machine stall: {first})' if first else ''
        C.ok(s['voided'] is None, f'4× throttle, {name}: the walk is not voided (median {f.get("medianMs")} ms, p95 {f.get("p95Ms")} ms, max gap {f.get("maxGapMs")} ms, slow share {f.get("slowShare")}){again}')
        C.ok(info and info['calls'] <= 10 and info['triangles'] <= 50000, f'{name}: within the draw budget (≤ 10 draw calls, ≤ 50 000 triangles: {info})')
        C.ok(loop['median'] is not None and loop['median'] <= 8, f'{name}: the walk\'s own JavaScript per frame at 4× (median {loop["median"]} ms, p95 {loop["p95"]} ms over {loop["n"]} frames; all page scripts {js:.2f} ms/frame; R1 §7.3: 2 ms unthrottled)')
    shot(page, 'throttle_dots_answer')
    ctx.close()


def demo_bias_srcdoc(b, cons):
    from harness_homing import DEMO_STEPS
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(url('demo', seed=34, p='route:0,flow:0,speed:0,tolerance:0', v='point', fast=True))
    page.wait_for_function(READY, timeout=90000)
    page.evaluate(DEMO_STEPS, 'reckon')
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=90000)
    page.wait_for_timeout(200)
    r = page.evaluate("() => ({ steps: window.__steps, during: window.__phaseDuring, after: document.querySelector('.ex-fp-phase').textContent })")
    short = [x for x in (r['steps'] or []) if x[1] and x[0] < 3000]
    C.ok(r['steps'] and not short, f'the Watch: every caption step lasts at least 3 s ({len(r["steps"] or [])} steps; shorter: {short[:3]})')
    C.ok(r['during'] and r['during'].startswith('Watch the demo') and r['after'] == 'Turn to face the start, then confirm.',
         f'the phase line says the demo plays, then asks for the answer ({r["during"]!r} → {r["after"]!r})')
    d = page.evaluate("""() => { const s = PX.ex.view('reckon').state(), p = PX.ex.view('reckon').pose(), it = __harness.item;
        return { flag: s.flag, map: s.map, value: s.value, dist: s.dist, dh: Math.abs(((p.h - it.heading) % 360 + 540) % 360 - 180), confirm: document.querySelector('.ex-fp-confirm').disabled, sub: document.querySelector('.ex-fp-sub').textContent }; }""")
    C.ok(not d['flag'] and not d['map'] and d['value'] is None and d['dist'] == 0 and d['dh'] < 1e-6 and d['confirm'] and d['sub'] == '', f'the demo plays to the end and leaves the item in its answer state ({d})')
    # five quick answers (point items): the bias line and the chart, and the record field
    for i in range(6):
        page.evaluate('(s) => __harness.next({ variant: "point", route: 3, flow: 0, speed: 0, tolerance: 0 }, s)', 80 + i)
        page.wait_for_function(READY, timeout=90000)
        key = page.evaluate('() => __harness.item.keyDeg')
        turn_to(page, key + (15 if key < 180 else -15))  # always 15° too far round (|key| ≤ 160°, so never past 180°)
        page.keyboard.press('Enter')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
    page.wait_for_timeout(700)
    bias = page.locator('.ex-reckon-bias').inner_text() if page.locator('.ex-reckon-bias').count() else ''
    dots = page.locator('.ex-reckon-chart circle').count()
    above = page.evaluate("() => [...document.querySelectorAll('.ex-reckon-chart circle')].filter((c) => +c.getAttribute('cy') < 32).length")
    C.ok(dots >= 5 and above == dots, f'the chart puts every "too far" answer above the line, whichever side the start was on ({above} of {dots})')
    hist = page.evaluate("() => (PX.core.store.state.reckon || {}).hist || []")
    C.ok('15° too far' in bias and dots >= 5 and len(hist) >= 6, f'after 6 answers 15° too far round: the bias line ({bias!r}), {dots} dots in the chart, {len(hist)} entries in the record field')
    shot(page, 'd1366_bias', full=True)
    ctx.close()
    # the sandboxed srcdoc page
    doc = inline_page('tests/dev/harness.html', extra_scripts=FILES, cfg={'ex': 'reckon', 'seed': 91, 'p': 'route:0', 'v': 'point', 'fast': True, 'inlinedCss': True}, extra_css=CSS)
    host = srcdoc_host('harness_reckon', doc)
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=90000)
    env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
    C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc: runs in a sandboxed srcdoc frame ({env})')
    fr.locator('.hx-goal').click()
    key = round(fr.evaluate('() => __harness.item.keyDeg'))
    t = key if key <= 180 else key - 360
    for _ in range(abs(t) // 5):
        page.keyboard.press('ArrowRight' if t > 0 else 'ArrowLeft')
    page.keyboard.press('Enter')
    fr.wait_for_function(STATE, arg='reveal', timeout=10000)
    C.ok(fr.evaluate('() => __harness.last.result.correct'), 'srcdoc: plays by keyboard (within 5° of the start: right)')
    shot(page, 'srcdoc')
    errs = fr.evaluate('() => __harness.errors')
    C.ok(not errs, f'srcdoc: no harness errors ({errs})')
    ctx.close()


def v12(b, cons):
    """v1.2 (W1-fixes; `python3 tests/e2e/harness_reckon.py v12` runs only this):
    O36 gentle motion: the dot, one speed per leg, the walk back at 2/3 of its speed, the motion reported;
    O40 feedback words: exact walks read "under 1 % off", the drift names the route and the walk back and the
    item's limit, the chart has axis words, the map labels "your answer";
    O39 Try tips in the player: no "After each turn" on the straight walk, a walking tip on the first return."""
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    tt = Touch(ctx, page)
    page.goto(url('v12_gentle', seed=33, p='route:0,flow:0,speed:2,tolerance:0', v='return', fast=True, gentle=True))
    page.wait_for_function(READY, timeout=90000)
    s = st(page)
    g = page.evaluate('''() => { const L = PX.ex.get('reckon').lib, it = __harness.item, g = L.gentle(it), tl = PX.ex.view('reckon').timeline(it);
        return { speeds: g.speeds, ramp: g.ramp, dur: g.duration, tl: tl.motion, walk: g.walkSpeed, walk0: it.walkSpeed, normal: it.duration, two: it.speeds.every((v) => v.length === 2) }; }''')
    C.ok(s['gentle'] and s['fix'] and g['two'] and all(len(v) == 1 for v in g['speeds']) and g['ramp'] == 0.6 and abs(g['tl'] - g['dur']) < 0.01 and g['dur'] <= 40,
         f'gentle: a "varied within legs" route plays one speed per leg with 0.6 s ramps, at most 40 s, and the dot shows ({g}; state gentle {s["gentle"]}, dot {s["fix"]})')
    m0 = page.evaluate('() => __harness.played.motionMs || 0')
    C.ok(m0 > 0 and s['motionMs'] >= m0 - 1, f'the route\'s motion goes to ctx.addMotion ({m0} ms in fast mode)')
    shot(page, 'v12_gentle_answer')
    turn_to(page, page.evaluate('() => __harness.item.keyDeg'), tt)
    page.locator('.ex-reckon-walk').scroll_into_view_if_needed()
    page.wait_for_timeout(150)
    box = page.locator('.ex-reckon-walk').bounding_box()
    tt.ev('touchStart', box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    page.wait_for_timeout(1000)
    v_mid = st(page)['speed']
    page.wait_for_timeout(300)
    tt.ev('touchEnd')
    page.wait_for_timeout(600)
    m1 = page.evaluate('() => __harness.played.motionMs || 0')
    C.ok(abs(v_mid - g['walk']) < 0.03 and abs(g['walk'] - round(g['walk0'] * 2 / 3, 2)) < 1e-9, f'gentle: the walk back runs at 2/3 of the item\'s speed ({v_mid:.3f} m/s; item {g["walk0"]}, gentle {g["walk"]})')
    C.ok(1100 <= m1 - m0 <= 2500, f'the walk back\'s motion goes to ctx.addMotion when it stops ({m1 - m0:.0f} ms for a 1.3 s hold)')
    meta = page.evaluate("() => PX.ex.view('reckon').answerMeta()")
    C.ok(meta.get('gentle') is True, f'the answer carries gentle: true ({meta})')
    ctx.close()

    # O40: the words after exact answers, the drift line, the chart's axes, the map label (phone, fast)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(url('v12_words', seed=33, p='route:0,flow:0,speed:0,tolerance:0', v='return', fast=True))
    page.wait_for_function(READY, timeout=90000)
    C.ok(st(page)['fix'] is False, 'without gentle motion there is no dot')
    page.evaluate('() => __harness.answer(true)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    notes = page.locator('.ex-fp-notes').inner_text()
    C.ok('under 1 % off in distance' in notes and '0 %' not in notes, f'an exact walk back reads "under 1 % off in distance", never "0 %" ({notes[:200]!r})')
    C.ok('the route and your walk back' in notes and 'the limit for this item was about' in notes and 'cm per metre' in notes, f'the drift says what it counts and gives the item\'s limit ({notes[:400]!r})')
    page.evaluate("() => __harness.next({ variant: 'return', task: 'distance', route: 0, flow: 0, speed: 0, tolerance: 1 }, 36)")
    page.wait_for_function(READY, timeout=90000)
    page.evaluate('() => __harness.answer(true)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    dn = page.locator('.ex-fp-notes').inner_text()
    C.ok('under 1 % off' in dn and '0 %' not in dn, f'the distance task walked exactly reads "under 1 % off" ({dn!r})')
    for i in range(4):
        page.evaluate('(s) => __harness.next({ variant: "point", route: 1, flow: 0, speed: 0, tolerance: 0 }, s)', 60 + i)
        page.wait_for_function(READY, timeout=90000)
        page.evaluate(f'() => __harness.answer({"true" if i % 2 == 0 else "false"})')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
    page.wait_for_timeout(600)
    ax = page.evaluate('''() => { const y = document.querySelector('.ex-reckon-yax'), x = document.querySelector('.ex-reckon-xax'), n = document.querySelector('.ex-reckon-chartnote');
        const cs = [...document.querySelectorAll('.ex-reckon-chart circle')].map((c) => +c.getAttribute('cx'));
        return { y: y ? y.innerText : '', x: x ? x.innerText : '', note: n ? n.innerText : '', dots: cs.length, lastX: cs.length ? cs[cs.length - 1] : 0,
          px: y ? parseFloat(getComputedStyle(y).fontSize) : 0 }; }''')
    C.ok('too far' in ax['y'] and 'too little' in ax['y'] and 'older' in ax['x'] and 'latest' in ax['x'] and 'Solid dots' in ax['note'] and 'Filled: right' not in ax['note'] and ax['dots'] >= 3 and ax['px'] >= 12
         and ax['lastX'] > 0.9 * 240,
         f'the habit chart has axis words, says solid and hollow, and ends at the right with the latest route ({ax})')
    shot(page, 'v12_chart', full=True)
    page.evaluate("() => { __harness.config.fast = true; PX.debug.fast(true); }")
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.showMe(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
    page.wait_for_timeout(200)
    lab = page.evaluate("() => [...document.querySelectorAll('.ex-fp-maplabel--you')].map((e) => e.textContent)")
    C.ok(lab == ['your answer'], f'the map labels your answer "your answer" ({lab})')
    ctx.close()

    # O39 and O36 in the player: Watch, Try at 390 × 844 (fast); each Try item's tip; the demo's motion
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    open_app(page)
    page.evaluate('PX.debug.fast(true)')
    page.evaluate("PX.core.store.state.tour.seen['reckon'] = false")
    # count what the view hands to ctx.addMotion (the player's own count is internal)
    page.evaluate('''() => { const v = PX.ex.view('reckon'); window.__motion = 0;
        const wrap = (ctx) => { if (ctx && !ctx.__w12 && typeof ctx.addMotion === 'function') { const f = ctx.addMotion; ctx.addMotion = (ms) => { window.__motion += ms; return f(ms); }; ctx.__w12 = true; } };
        ['present', 'demo'].forEach((k) => { const f = v[k]; v[k] = function (item, ctx) { wrap(ctx); return f.apply(this, arguments); }; }); }''')
    page.evaluate('void PX.core.router.go("play", { mode: "watch", exId: "reckon" }, { force: true })')
    tips, seen = [], set()
    for _ in range(2500):
        stt = page.evaluate('window.__play ? __play.state : null')
        if stt == 'respond':
            it = page.evaluate('() => { const i = __play.item; return i ? { seed: i.seed, task: i.task || null, turns: i.turns.length, legs: i.legs.length, ret: i.answer === "position" } : null; }')
            if it and it['seed'] not in seen:
                seen.add(it['seed'])
                tip = page.evaluate("() => { const t = document.querySelector('.pl-tip'); return t && !t.hidden ? t.innerText : ''; }")
                tips.append(dict(it, tip=tip))
            page.evaluate('__play.answer(true).catch(() => 0)')
            page.wait_for_timeout(120)
        elif stt == 'reveal':
            page.evaluate('__play.next()')
            page.wait_for_timeout(120)
        else:
            for sel in ('[data-card-box] [data-card="skip"]', '[data-card-box] .px-btn--primary'):
                loc = page.locator(sel)
                if loc.count() and loc.first.is_visible():
                    loc.first.click()
                    page.wait_for_timeout(150)
                    break
        if len(tips) >= 5:
            break
        page.wait_for_timeout(40)
    straight = [t for t in tips if t['task'] == 'distance']
    C.ok(straight and all('turn' not in t['tip'].lower() for t in straight) and all(t['tip'] for t in straight),
         f'Try: the straight walk shows a tip about distance, not "After each turn" ({straight})')
    heading = [t for t in tips if t['task'] == 'heading']
    C.ok(heading and all(t['tip'] and 'walk' not in t['tip'].lower() for t in heading), f'Try: the turn on the spot shows a tip about turning ({heading})')
    first_ret = [t for t in tips if t['ret'] and not t['task']]
    C.ok(first_ret and 'Walk' in first_ret[0]['tip'], f'Try: the first return route explains Walk ({first_ret[:1]})')
    mot = page.evaluate('() => window.__motion')
    C.ok(mot and mot > 0, f'the Watch demo and the Try walks report their motion to the player\'s ctx.addMotion ({mot} ms in fast mode)')
    page.evaluate('void __play.end()')
    ctx.close()


def v12_shots(b, cons):
    """Reckon version 2 (PLAN milestone 8) at 360 × 640 and 390 × 844 (touch) and 1366 × 768: a route where the legs
    decide (two alternatives, one shown) and a walk back of the new range; the walk ends with the turn on the spot
    (the pose faces the item's final heading), the answer is right when turned to the key, the reveal and Show me
    draw; screenshots at the answer, the reveal and the map. The Watch demo (seed 44 at the easiest level) shows
    its final turn in the walk caption."""
    rows = []
    for vp, extra in (((360, 640), PHONE), ((390, 844), PHONE), ((1366, 768), {})):
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **extra)
        page = ctx.new_page()
        cons.append(Console(page))
        tag = '%dx%d' % vp
        page.goto(url('v2_' + tag, seed=301, p='route:3,flow:0,speed:1,tolerance:1,legs:1', v='point', fast=True))
        page.wait_for_function(READY, timeout=90000)
        for case, q, sd in (('legs', {'variant': 'point', 'route': 3, 'flow': 0, 'speed': 1, 'tolerance': 1, 'legs': 1}, 301),
                            ('return', {'variant': 'return', 'route': 5, 'flow': 1, 'speed': 2, 'tolerance': 3, 'legs': 1}, 302)):
            if case != 'legs':
                page.evaluate('([q, s]) => __harness.next(q, s)', [q, sd])
                page.wait_for_function(READY, timeout=90000)
            it = page.evaluate("""() => { const it = __harness.item, p = PX.ex.view('reckon').pose();
                return { key: it.keyDeg, d: it.distance, v: it.walkSpeed, n: it.legs.length, turns: it.turns.length, R: it.turns[it.turns.length - 1],
                         alts: (it.alts || []).length, alt: it.alt, dh: Math.abs(((p.h - it.heading) % 360 + 540) % 360 - 180), valid: PX.ex.get('reckon').validate(it) === true }; }""")
            shot(page, f'v2_{tag}_{case}_answer')
            tt = Touch(ctx, page) if extra else None
            turn_to(page, it['key'], tt)
            if case == 'return':
                page.locator('.ex-reckon-walk').scroll_into_view_if_needed()
                walk_back(page, it['d'], it['v'], tt)
            sel = '.ex-reckon-here' if case == 'return' else '.ex-fp-confirm'
            page.locator(sel).scroll_into_view_if_needed()
            tt.tap(sel) if tt else page.locator(sel).click()
            page.wait_for_function(STATE, arg='reveal', timeout=15000)
            page.wait_for_timeout(700)
            right = page.evaluate('() => __harness.last.result.correct')
            shot(page, f'v2_{tag}_{case}_reveal', full=True)
            before = page.evaluate('() => __harness.played.finished')
            page.evaluate('() => { __harness.showMe(); }')
            page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
            page.wait_for_timeout(300)
            shot(page, f'v2_{tag}_{case}_showme')
            it.update(size=tag, case=case, right=right)
            rows.append(it)
        ctx.close()
    REPORT['v2'] = rows
    C.ok(all(r['valid'] and r['turns'] == r['n'] and 30 <= abs(r['R']) <= 150 and r['dh'] < 0.5 for r in rows),
         f'version 2: every route ends with a turn on the spot of 30–150° and the walk leaves you facing the final heading ({[(r["size"], r["case"], r["R"], round(r["dh"], 3)) for r in rows]})')
    C.ok(all(r['alts'] == 2 and r['alt'] in (0, 1) for r in rows if r['case'] == 'legs'), 'where the legs decide, the item carries two alternatives and shows one')
    C.ok(all(r['right'] for r in rows), f'turned to the key (and walked the home distance) is right at every size ({[(r["size"], r["case"], r["right"]) for r in rows]})')
    # the Watch demo's walk caption names the final turn
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(url('v2_demo', seed=44, p='route:0,flow:0,speed:0,tolerance:0,legs:0', v='point', fast=True))
    page.wait_for_function(READY, timeout=90000)
    page.evaluate("() => { window.__subs = []; const o = new MutationObserver(() => { const t = (document.querySelector('.ex-fp-sub') || {}).textContent; if (t && __subs[__subs.length - 1] !== t) __subs.push(t); }); o.observe(document.body, { subtree: true, childList: true, characterData: true }); }")
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_timeout(2500)
    shot(page, 'v2_demo_390x844_walk')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=120000)
    subs = page.evaluate('() => window.__subs')
    it = page.evaluate('() => ({ key: __harness.item.keyDeg, R: __harness.item.turns[__harness.item.turns.length - 1] })')
    C.ok(any('one last turn on the spot' in t for t in subs) and it['key'] < 180, f'the Watch demo (seed 44) is a right-hand item and its walk caption names the last turn on the spot ({it}; {[t[:60] for t in subs][:6]})')
    ctx.close()


def exfix(b, cons):
    """v1.2 (W3-exfix): Walk and Back are toggles as well as holds (desktop fresh run d1: a click and single ↑
    presses moved nothing); the heading item's show me keeps one frame (fresh-player test g3: it swept the
    player's own arrow through the turn made, from the top); the line where turning starts states the frame."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(url('exfix', seed=52, p='route:0,flow:0,speed:0,tolerance:0', v='return', fast=True))
    page.wait_for_function(READY, timeout=90000)
    hint = page.locator('.ex-fp-hint').inner_text()
    C.ok('top of the circle is the way you face now' in hint and 'Tap or drag the circle' in hint, f'the hint under the controls states the frame and the tap ({hint!r})')
    phase = page.locator('.ex-fp-phase').inner_text()
    C.ok('tap it to start and stop' in phase, f'the return item\'s line says Walk can be tapped ({phase!r})')
    wb = page.locator('.ex-reckon-walk').bounding_box()
    cx, cy = wb['x'] + wb['width'] / 2, wb['y'] + wb['height'] / 2
    page.mouse.click(cx, cy)  # a tap: the walk starts and goes on
    page.wait_for_timeout(700)
    s1 = st(page)
    page.wait_for_timeout(500)
    s2 = st(page)
    pressed = page.locator('.ex-reckon-walk').get_attribute('aria-pressed')
    C.ok(s1['dist'] > 0.4 and s2['dist'] > s1['dist'] + 0.3 and s2['latch'] == 1 and pressed == 'true',
         f'a click on Walk starts the walk and it goes on ({s1["dist"]:.2f} → {s2["dist"]:.2f} m, latch {s2["latch"]}, aria-pressed {pressed})')
    page.mouse.click(cx, cy)  # the second tap stops it
    page.wait_for_timeout(700)
    s3 = st(page)
    page.wait_for_timeout(400)
    s4 = st(page)
    C.ok(s3['dir'] == 0 and s4['dist'] == s3['dist'] and s4['latch'] == 0 and page.locator('.ex-reckon-walk').get_attribute('aria-pressed') == 'false',
         f'a second click stops it ({s3["dist"]:.2f} m, then {s4["dist"]:.2f} m)')
    page.keyboard.press('ArrowUp')  # a short key press: the same toggle
    page.wait_for_timeout(700)
    k1 = st(page)
    page.keyboard.press('ArrowUp')
    page.wait_for_timeout(700)
    k2 = st(page)
    page.wait_for_timeout(300)
    k3 = st(page)
    C.ok(k1['dist'] > s4['dist'] + 0.4 and k1['dir'] == 1 and k2['dir'] == 0 and k3['dist'] == k2['dist'],
         f'one ↑ press starts the walk and the next stops it ({s4["dist"]:.2f} → {k1["dist"]:.2f} → {k2["dist"]:.2f} m)')
    page.keyboard.down('ArrowUp')  # a hold still walks while held and stops at the release
    page.wait_for_timeout(700)
    page.keyboard.up('ArrowUp')
    page.wait_for_timeout(600)
    h1 = st(page)
    page.wait_for_timeout(300)
    h2 = st(page)
    C.ok(h1['dist'] > k3['dist'] + 0.4 and h1['dir'] == 0 and h2['dist'] == h1['dist'] and h1['latch'] == 0, f'a held ↑ walks and stops at the release ({k3["dist"]:.2f} → {h1["dist"]:.2f} m)')
    bb = page.locator('.ex-reckon-back').bounding_box()
    page.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)  # Back toggles too
    page.wait_for_timeout(600)
    g1 = st(page)
    page.mouse.click(cx, cy)  # Walk while Back is on: the walk turns round
    page.wait_for_timeout(600)
    g2 = st(page)
    page.mouse.click(cx, cy)
    page.wait_for_timeout(600)
    C.ok(g1['dist'] < h2['dist'] and g1['latch'] == -1 and g2['latch'] == 1 and g2['dist'] > g1['dist'] and st(page)['dir'] == 0,
         f'Back toggles, and Walk while Back is on turns the walk round ({h2["dist"]:.2f} → {g1["dist"]:.2f} → {g2["dist"]:.2f} m)')
    page.keyboard.press('Enter')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    C.ok(page.evaluate('() => __harness.last.response.z !== undefined') and st(page)['latch'] == 0, 'Enter is Here after toggled walking')
    # the heading item's show me: your arrow stays where you answered; the filled arrow sweeps to the turn back
    page.evaluate("() => __harness.next({ variant: 'point', task: 'heading', route: 0, flow: 0, speed: 0, tolerance: 0 }, 35)")
    page.wait_for_function(READY, timeout=90000)
    T = page.evaluate('() => __harness.item.turns[0]')
    turn_to(page, 60 if T < 0 else -60)  # the wrong way, as the fresh player did
    page.keyboard.press('Enter')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    ARROWS = "() => ({ yours: document.querySelector('.ex-fp-arrow').getAttribute('transform'), yv: document.querySelector('.ex-fp-arrow').getAttribute('visibility'), key: document.querySelector('.ex-fp-key').getAttribute('transform'), h: PX.ex.view('reckon').pose().h, h0: __harness.item.startHeading })"
    a0 = page.evaluate(ARROWS)
    page.evaluate('() => { __harness.config.fast = false; PX.debug.fast(false); }')
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.showMe(); }')
    page.wait_for_timeout(900)
    a1 = page.evaluate(ARROWS)
    page.evaluate('() => { __harness.config.fast = true; PX.debug.fast(true); }')
    for _ in range(12):
        if page.evaluate('(n) => __harness.played.finished > n', before):
            break
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(400)
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
    a2 = page.evaluate(ARROWS)
    back = (-T) % 360
    kr = float(a2['key'].replace('rotate(', '').replace(')', '')) if a2['key'] else None
    C.ok(a1['yours'] == a0['yours'] and a1['yv'] == 'visible' and a2['yours'] == a0['yours'],
         f'heading show me: your arrow stays where you answered ({a0["yours"]} → {a1["yours"]} → {a2["yours"]})')
    C.ok(kr is not None and abs(((kr - back) + 540) % 360 - 180) < 1 and abs(((a2['h'] - a2['h0']) + 540) % 360 - 180) < 1,
         f'heading show me: the filled arrow ends at the turn back ({kr} vs {back}) and the view faces as at the start ({a2["h"]:.1f} vs {a2["h0"]:.1f})')
    errs = page.evaluate('() => __harness.errors')
    C.ok(not errs, f'exfix: no harness errors ({errs})')
    ctx.close()


def main():
    cons = []
    only = set(sys.argv[1:])
    with sync_playwright() as p:
        b = launch(p)
        if only:
            if 'v12' in only:
                v12(b, cons)
            if 'demo' in only:
                demo_bias_srcdoc(b, cons)
            if 'reveal' in only:
                reveal_sizes(b, cons)
            if 'shots' in only:
                v12_shots(b, cons)
            if 'exfix' in only:
                exfix(b, cons)
            b.close()
            errors = [e for c in cons for e in c.errors()]
            C.ok(not errors, f'no console errors ({errors[:5]})')
            return C.summary(REPORT)
        phone_play(b, cons)
        app_touch(b, cons)
        reveal_sizes(b, cons)
        app_pause(b, cons)
        app_wtg(b, cons)
        desktop_keys(b, cons)
        pauses_and_voids(b, cons)
        throttled(b, cons)
        demo_bias_srcdoc(b, cons)
        v12(b, cons)
        v12_shots(b, cons)
        exfix(b, cons)
        b.close()
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    return C.summary(dict(REPORT, screenshots=sorted(p.name for p in DIR.glob('reckon_*.png'))))


if __name__ == '__main__':
    sys.exit(main())
