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


def walk_back(page, dist, speed, touch=None):
    """Hold Walk about dist / speed seconds, then correct with short holds of Walk or Back (closed loop)."""
    def hold(sel, ms):
        if touch:
            touch.hold(sel, ms)
        else:
            b = page.locator(sel).bounding_box()
            page.mouse.move(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2)
            page.mouse.down()
            page.wait_for_timeout(ms)
            page.mouse.up()
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


def app_item(page, params, until):
    """A Free play run of Reckon with these settings, until the player reaches state `until` (an intro or
    offer card may come first, as in fit.py)."""
    cfg = {'mode': 'free', 'exId': 'reckon', 'run': '1', 'trials': 2, 'params': params}
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
        page.evaluate('void __play.end()')
    REPORT['touch']['app'] = {'items': out, 'nextClicks': page.evaluate('window.__nextClicks')}
    C.ok(all(o[1] == 'reveal' for o in out) and page.evaluate('window.__nextClicks') == 0,
         f'the real player by touch: the answer shows its reveal and keeps it, no click reaches Next ({REPORT["touch"]["app"]})')
    shot(page, 'app_touch_end')
    ctx.close()


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
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(url('demo', seed=34, p='route:0,flow:0,speed:0,tolerance:0', v='point', fast=True))
    page.wait_for_function(READY, timeout=90000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=90000)
    page.wait_for_timeout(200)
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


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        phone_play(b, cons)
        app_touch(b, cons)
        app_pause(b, cons)
        app_wtg(b, cons)
        desktop_keys(b, cons)
        pauses_and_voids(b, cons)
        throttled(b, cons)
        demo_bias_srcdoc(b, cons)
        b.close()
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    return C.summary(dict(REPORT, screenshots=sorted(p.name for p in DIR.glob('reckon_*.png'))))


if __name__ == '__main__':
    sys.exit(main())
