"""E2E: the dev harness with Orient (EX-08, SVG map + arrow circle, custom layout).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_orient.py   (two browser slots per machine)

1. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark: the map and the circle show
   (non-blank pixels); every object has a symbol and a name; names stay inside the map and do not
   overlap; no horizontal scroll; on the phone the map, the circle and Confirm fit one screen
2. a right answer by keyboard (← → in 5° steps, Shift for 1°, Enter) and a wrong one by pointer (click,
   tap on the phone) score as expected; reveal shows the right arrow, the tolerance wedge, the error
   in degrees and the answer on the map; drag sets the arrow; Enter before any arrow does not answer
3. show me ends on the grading geometry: the map turned by −heading with A centred, the right arrow
   at the key; at normal speed it takes 4–9 s, less with reduced motion; pause, step, replay end
4. the demo plays to the end and leaves the item answerable; a Confirm during pause is ignored and
   the circle stays live; turning the phone during an item voids it (notice, trial:void 'rotated'),
   and reveal stops listening
5. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard; no console errors
Screenshots: tests/e2e/out/orient/orient_<viewport>_<theme>[_reveal|_wrong|_showme].png """
import math
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_orient')
DIR = OUT / 'orient'
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
PARAMS = 'shift:2,objects:1,tolerance:1'   # 90–135° shift, 7 objects, 30° tolerance
BIG = 'shift:3,objects:2,tolerance:2'      # the hardest cell: 9 objects


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def dial_point(target, deg, frac=0.8):
    """Client coordinates on the arrow circle at `deg` clockwise from its top."""
    g = target.evaluate("""() => { const r = document.querySelector('.ex-orient-dial').getBoundingClientRect();
        const d = PX.ex.view('orient').dial; return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: Math.min(r.width, r.height) / (2 * d.box), R: d.radius }; }""")
    r = g['s'] * g['R'] * frac
    a = math.radians(deg)
    return g['x'] + r * math.sin(a), g['y'] - r * math.cos(a)


def drawn_ok(target, tag, n_expected=None):
    ok, s = non_blank(target.locator('.ex-orient-stage').screenshot(), min_distinct=4, max_top=0.97)
    C.ok(ok, f'{tag}: the map shows objects ({s})')
    ok, s = non_blank(target.locator('.ex-orient-dialbox').screenshot(), min_distinct=4, max_top=0.99)
    C.ok(ok, f'{tag}: the arrow circle shows ({s})')
    info = target.evaluate("""() => {
        const it = __harness.item, map = document.querySelector('.ex-orient-map').getBoundingClientRect();
        const names = Array.from(document.querySelectorAll('.ex-orient-name')).map((t) => t.getBoundingClientRect());
        let overlaps = 0, outside = 0;
        names.forEach((a, i) => {
            if (a.left < map.left - 0.5 || a.right > map.right + 0.5 || a.top < map.top - 0.5 || a.bottom > map.bottom + 0.5) outside++;
            names.forEach((b, j) => { if (j > i) { const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (w > 1 && h > 1) overlaps++; } });
        });
        const glyphs = document.querySelectorAll('.ex-orient-obj .ex-orient-glyph').length;
        const q = document.querySelector('.ex-orient-q');
        const chips = Array.from(document.querySelectorAll('.ex-orient-chip')).map((c) => c.textContent);
        const want = [it.objects[it.at].name, it.objects[it.facing].name, it.objects[it.target].name];
        const fs = parseFloat(getComputedStyle(document.querySelector('.ex-orient-name')).fontSize) * map.width / it.map.w;
        return { n: it.objects.length, labels: names.length, glyphs, overlaps, outside, q: q && q.textContent, text: it.text, chips, want, px: fs };
    }""")
    C.ok(info['labels'] == info['n'] and info['glyphs'] == info['n'], f'{tag}: every object has a symbol and a name ({info["glyphs"]}, {info["labels"]} of {info["n"]})')
    C.ok(info['outside'] == 0, f'{tag}: names stay inside the map ({info["outside"]} outside)')
    C.ok(info['overlaps'] == 0, f'{tag}: names do not overlap ({info["overlaps"]})')
    C.ok(info['q'] == info['text'] and info['chips'] == info['want'], f'{tag}: the question is the item text with the three symbols ({info["chips"]})')
    C.ok(info['px'] >= 11.5, f'{tag}: map names are readable ({info["px"]:.1f} px)')
    if n_expected is not None:
        C.ok(info['n'] == n_expected, f'{tag}: {n_expected} objects')


def press_to(page, deg):
    """From an unset arrow (straight ahead), turn to the nearest whole degree of `deg` by keys."""
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
    now = frame.evaluate("() => Number(document.querySelector('.ex-orient-dial').getAttribute('aria-valuenow'))")
    C.ok(now == t, f'{tag}: ← → (5°) and Shift (1°) set the arrow ({now} vs {t})')
    page.keyboard.press('Enter')
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['source'] == 'view' and r['result']['value'] <= 1, f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')
    C.ok(r['rtMs'] >= 0, f'{tag}: the answer clock ran from the paint ({r["rtMs"]} ms)')
    reveal_ok(frame, tag, True)


def answer_pointer(page, frame, tag, tap=False):
    key = frame.evaluate('() => __harness.key')
    x, y = dial_point(frame, key + 180)
    if tap:
        page.touchscreen.tap(x, y)
        frame.locator('.ex-orient-confirm').tap()
    else:
        page.mouse.click(x, y)
        frame.locator('.ex-orient-confirm').click()
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['result']['value'] >= 170, f'{tag}: a wrong answer by pointer scores wrong ({r["result"]})')
    reveal_ok(frame, tag, False)


def reveal_ok(frame, tag, right):
    d = frame.evaluate("""() => {
        const rot = (el) => { const m = /rotate\\(([-\\d.]+)/.exec(el.getAttribute('transform') || ''); return m ? Number(m[1]) : null; };
        const key = document.querySelector('.ex-orient-key'), w = document.querySelector('.ex-orient-wedge');
        const v = document.querySelector('.ex-orient-verdict');
        return { key: rot(key), keyVis: key.getAttribute('visibility'), wedge: w.getAttribute('visibility'), verdict: v.hidden ? '' : v.textContent,
            ray: document.querySelectorAll('.ex-orient-ray').length, ac: document.querySelectorAll('.ex-orient-ac').length,
            marked: ['is-at', 'is-facing', 'is-target'].map((c) => document.querySelectorAll('.ex-orient-obj.' + c).length),
            arrowCls: document.querySelector('.ex-orient-arrow').getAttribute('class'), itemKey: __harness.item.key };
    }""")
    gap = abs((d['key'] - d['itemKey'] + 540) % 360 - 180) if d['key'] is not None else 999
    C.ok(d['keyVis'] == 'visible' and gap < 0.01 and d['wedge'] == 'visible', f'{tag}: reveal draws the right direction and the tolerance wedge ({d["key"]} vs {d["itemKey"]})')
    icon = '✓' if right else '✗'
    C.ok(d['verdict'].startswith(icon) and '°' in d['verdict'], f'{tag}: the error in degrees with an icon ({d["verdict"]!r})')
    C.ok(d['ray'] == 1 and d['ac'] == 1 and d['marked'] == [1, 1, 1], f'{tag}: the map shows the answer, the sight line and you / facing / target ({d})')
    C.ok(('is-right' if right else 'is-wrong') in d['arrowCls'], f'{tag}: the answer arrow is marked {"right" if right else "wrong"}')


def show_me(frame, tag, page=None, click=None):
    before = frame.evaluate('() => __harness.played.finished')
    if click is not None:
        click.click()
    elif page is not None:
        page.keyboard.press('s')
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=30000)
    C.ok(True, f'{tag}: show me ran to the end ({frame.evaluate("() => __harness.played.ms")} ms)')


def final_geometry(frame, tag):
    """Show me ends on the grading model: world turned by −heading about A, A at the centre, key arrow at the key."""
    d = frame.evaluate("""() => {
        const it = __harness.item, A = it.objects[it.at], B = it.objects[it.facing];
        const world = document.querySelector('.ex-orient-world');
        const svg = document.querySelector('.ex-orient-map');
        const toMap = (p) => { const pt = svg.createSVGPoint(); pt.x = p.x; pt.y = p.y; const sc = pt.matrixTransform(world.getCTM()); const back = sc.matrixTransform(svg.getCTM().inverse()); return [back.x, back.y]; };
        const a = toMap(A), b = toMap(B);
        const up = Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180 / Math.PI;
        const m2 = /rotate\\(([-\\d.]+)/.exec(document.querySelector('.ex-orient-key').getAttribute('transform') || '');
        return { a, upErr: Math.abs(up), key: m2 ? Number(m2[1]) : null, itemKey: it.key };
    }""")
    centred = abs(d['a'][0] - 50) < 0.05 and abs(d['a'][1] - 50) < 0.05
    gap = abs((d['key'] - d['itemKey'] + 540) % 360 - 180) if d['key'] is not None else 999
    C.ok(centred and d['upErr'] < 0.05 and gap < 0.05, f'{tag}: show me ends with A centred, B straight up and the arrow at the key ({d})')


def phone_fit(page, tag):
    d = page.evaluate("""() => { const b = document.querySelector('.ex-orient-body').getBoundingClientRect();
        const c = document.querySelector('.ex-orient-confirm').getBoundingClientRect(), dial = document.querySelector('.ex-orient-dialbox').getBoundingClientRect();
        return { h: b.height, vh: innerHeight, confirm: [c.width, c.height], dial: dial.width, sw: [document.documentElement.scrollWidth, innerWidth] }; }""")
    C.ok(d['sw'][0] <= d['sw'][1], f'{tag}: no horizontal scroll ({d["sw"]})')
    C.ok(d['h'] <= d['vh'] * 0.9, f'{tag}: question, map, circle and Confirm fit one screen ({d["h"]:.0f} of {d["vh"]} px)')
    C.ok(d['confirm'][1] >= 44 and d['dial'] >= 150, f'{tag}: targets are large enough (Confirm {d["confirm"]}, circle {d["dial"]:.0f} px)')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for theme in ('light', 'dark'):
            name = f'orient_{tag}_{theme}'
            page.goto(file_url('tests/dev/harness.html', ex='orient', seed=11, p=PARAMS, fast=1, theme=theme))
            page.wait_for_function(READY, timeout=30000)
            drawn_ok(page, name, 7)
            shot(page, name + '.png')
            if phone:
                phone_fit(page, name)
            if theme == 'light':
                answer_keyboard(page, page, name)
                shot(page, name + '_reveal.png')
                show_me(page, name, page=page)
                final_geometry(page, name)
                shot(page, name + '_showme_end.png')
                page.keyboard.press('Space')  # next
                page.wait_for_function(READY, timeout=10000)
                answer_pointer(page, page, name, tap=phone)
                shot(page, name + '_wrong.png')
                show_me(page, name + ' (Show me button)', click=page.locator('.hx-feedback-actions .px-btn').first)
                final_geometry(page, name + ' (2)')
            else:
                x, y = dial_point(page, 200)
                (page.touchscreen.tap(x, y) if phone else page.mouse.click(x, y))
                page.locator('.ex-orient-confirm').click()
                page.wait_for_function(STATE, arg='reveal', timeout=10000)
                shot(page, name + '_reveal.png')
            # the hardest cell: nine objects, labels still clear
            page.goto(file_url('tests/dev/harness.html', ex='orient', seed=5, p=BIG, fast=1, theme=theme))
            page.wait_for_function(READY, timeout=30000)
            drawn_ok(page, name + ' 9 objects', 9)
            shot(page, name + '_9.png')
            errs = page.evaluate('() => __harness.errors')
            C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def input_details(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(file_url('tests/dev/harness.html', ex='orient', seed=3, p=PARAMS, fast=1))
    page.wait_for_function(READY, timeout=30000)
    page.keyboard.press('Enter')
    page.wait_for_timeout(150)
    st = page.evaluate("() => ({ state: __harness.state, readout: document.querySelector('.ex-orient-readout').textContent, disabled: document.querySelector('.ex-orient-confirm').disabled })")
    C.ok(st['state'] == 'respond' and st['disabled'] and 'first' in st['readout'], f'Enter before any arrow does not answer ({st})')
    x1, y1 = dial_point(page, 30)
    x2, y2 = dial_point(page, 100)
    page.mouse.move(x1, y1)
    page.mouse.down()
    page.mouse.move(x2, y2, steps=6)
    page.mouse.up()
    v = page.evaluate("() => [Number(document.querySelector('.ex-orient-dial').getAttribute('aria-valuenow')), document.querySelector('.ex-orient-readout').textContent]")
    C.ok(abs(v[0] - 100) <= 1 and '100° right' in v[1], f'dragging on the circle sets the arrow ({v})')
    page.keyboard.press('Shift+ArrowLeft')
    page.keyboard.press('ArrowLeft')
    v2 = page.evaluate("() => Number(document.querySelector('.ex-orient-dial').getAttribute('aria-valuenow'))")
    C.ok(v2 == v[0] - 6, f'Shift+← turns 1°, ← 5° ({v[0]} → {v2})')
    x3, y3 = dial_point(page, 0, frac=0.05)
    page.mouse.click(x3, y3)
    v3 = page.evaluate("() => Number(document.querySelector('.ex-orient-dial').getAttribute('aria-valuenow'))")
    C.ok(v3 == v2, f'a tap on the hub does not move the arrow ({v3})')
    # pause: Enter is ignored by the harness, the circle stays live, and after resuming Enter answers
    page.keyboard.press('Escape')
    page.wait_for_function(STATE, arg='paused', timeout=5000)
    page.keyboard.press('Enter')
    page.wait_for_timeout(150)
    s1 = page.evaluate('() => __harness.state')
    page.keyboard.press('Escape')
    page.wait_for_function(READY, timeout=5000)
    page.keyboard.press('ArrowRight')
    page.keyboard.press('Enter')
    page.wait_for_function(STATE, arg='reveal', timeout=5000)
    last = page.evaluate('() => __harness.last')
    C.ok(s1 == 'paused' and last['response'] == (v2 + 5) % 360, f'a Confirm during pause is ignored; the circle stays live ({s1}, {last["response"]})')
    # the demo plays to the end and leaves its item answerable
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=30000)
    page.wait_for_timeout(100)
    after = page.evaluate('() => __harness.state')
    d = page.evaluate("""() => ({ vis: document.querySelector('.ex-orient-arrow').getAttribute('visibility'),
        key: document.querySelector('.ex-orient-key').getAttribute('visibility'), disabled: document.querySelector('.ex-orient-confirm').disabled,
        world: document.querySelector('.ex-orient-world').getAttribute('transform') || '' })""")
    C.ok(d['vis'] == 'hidden' and d['key'] == 'hidden' and d['disabled'] and d['world'] == '', f'the demo ends with its item ready to answer (harness state {after}; {d})')
    page.evaluate('() => __harness.next()')
    page.wait_for_function(READY, timeout=10000)
    answer_keyboard(page, page, 'after the demo')
    errs = page.evaluate('() => __harness.errors')
    C.ok(not errs, f'input details: no harness errors ({errs})')
    ctx.close()


DISPATCH = "() => { const so = screen.orientation; if (so && so.dispatchEvent) so.dispatchEvent(new Event('change')); else window.dispatchEvent(new Event('orientationchange')); }"


def rotation_void(b, cons):
    """Turning the phone during an item voids it (trial:void 'rotated' + notice); reveal stops listening."""
    ctx = b.new_context(viewport={'width': 412, 'height': 880}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(file_url('tests/dev/harness.html', ex='orient', seed=13, p=PARAMS, fast=1))
    page.wait_for_function(READY, timeout=30000)
    C.ok(page.evaluate("() => PX.ex.view('orient').watching()"), 'the item listens for device orientation changes while it is answered')
    page.set_viewport_size({'width': 880, 'height': 412})  # the phone turns to landscape
    page.wait_for_timeout(400)
    via = 'turning the emulated phone'
    if not page.evaluate("() => PX.ex.view('orient').voided()"):
        via = 'a dispatched change event'
        page.evaluate(DISPATCH)
        page.wait_for_timeout(100)
    d = page.evaluate("() => { const n = document.querySelector('.ex-orient-void'); return { voided: PX.ex.view('orient').voided(), note: n.hidden ? '' : n.textContent }; }")
    C.ok(d['voided'] == 'rotated' and 'turned' in d['note'], f'turning the device voids the item, with a notice ({d}; via {via})')
    shot(page, 'orient_rotated.png')
    page.set_viewport_size({'width': 412, 'height': 880})
    page.wait_for_timeout(200)
    answer_keyboard(page, page, 'rotated item')
    last = page.evaluate('() => __harness.last')
    C.ok(last.get('void') is True and last.get('voidReason') == 'rotated', f'the turned item is marked void ({last.get("void")}, {last.get("voidReason")})')
    C.ok(not page.evaluate("() => PX.ex.view('orient').watching()"), 'reveal stops listening for orientation changes')
    page.evaluate(DISPATCH)  # a turn between items counts for nothing
    page.keyboard.press('Space')
    page.wait_for_function(READY, timeout=30000)
    d = page.evaluate("() => ({ voided: PX.ex.view('orient').voided(), hidden: document.querySelector('.ex-orient-void').hidden, watching: PX.ex.view('orient').watching() })")
    C.ok(d['voided'] is None and d['hidden'] and d['watching'], f'the next item starts clean and listens again ({d})')
    answer_keyboard(page, page, 'next item')
    last = page.evaluate('() => __harness.last')
    C.ok(not last.get('void'), f'an item without a turn counts ({last.get("void")})')
    errs = page.evaluate('() => __harness.errors')
    C.ok(not errs, f'rotation: no harness errors ({errs})')
    ctx.close()


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    times = {}
    for rm in (0, 1):
        page.goto(file_url('tests/dev/harness.html', ex='orient', seed=9, p=PARAMS, rm=rm))
        page.wait_for_function(READY, timeout=30000)
        x, y = dial_point(page, 90)
        page.mouse.click(x, y)
        page.keyboard.press('Enter')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(2600)
        shot(page, f'orient_1366_light_showme{"_rm" if rm else ""}.png')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=40000)
        pl = page.evaluate('() => __harness.played')
        times['rm' if rm else 'normal'] = {'planned': round(pl['plannedMs'] / 1000, 2), 'wall': round(pl['ms'] / 1000, 2)}
    C.ok(4.0 <= times['normal']['planned'] <= 9.0, f'show me takes 4–9 s ({times["normal"]})')
    C.ok(times['rm']['planned'] < times['normal']['planned'], f'reduced motion makes show me shorter ({times})')
    page.keyboard.press('s')
    page.wait_for_function(STATE, arg='showme', timeout=5000)
    page.keyboard.press('Space')  # pause
    page.wait_for_timeout(400)
    paused = page.locator('.hx-player-buttons .px-btn').first.inner_text()
    C.ok('Resume' in paused, f'Space pauses show me ({paused!r})')
    page.keyboard.press('ArrowRight')  # step
    page.keyboard.press('r')           # replay
    page.wait_for_function(STATE, arg='reveal', timeout=30000)
    C.ok(True, 'pause, step and replay, then show me ends')
    ctx.close()
    return times


def sandboxed(b, cons):
    doc = harness_single('orient', {'seed': 21, 'p': PARAMS, 'fast': True})
    host = srcdoc_host('harness_orient', doc)
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=60000)
    env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
    C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc: runs in a sandboxed srcdoc frame ({env})')
    drawn_ok(fr, 'srcdoc')
    fr.locator('.hx-goal').click()
    answer_keyboard(page, fr, 'srcdoc')
    show_me(fr, 'srcdoc', page=page)
    shot(page, 'orient_srcdoc.png')
    errs = fr.evaluate('() => __harness.errors')
    C.ok(not errs, f'srcdoc: no harness errors ({errs})')
    ctx.close()


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        desktop_and_phone(b, cons)
        input_details(b, cons)
        rotation_void(b, cons)
        times = normal_speed(b, cons)
        sandboxed(b, cons)
        b.close()
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    return C.summary({'showMeSeconds': times, 'screenshots': sorted(p.name for p in DIR.glob('orient_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
