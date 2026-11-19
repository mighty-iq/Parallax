"""E2E: the dev harness with Painted Cubes (EX-18, SVG). Shared flow in tests/e2e/pat_harness.py.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_cubes.py
Own checks: one drawn face per exposed top, front and right face of the model (lib.facesOf);
the question shows the item's N; options read 1–5; after show me, every cube carries its number of
painted sides, the counted ones ringed, hidden ones as dashed ghosts. The v1.2 starter band
(tests/e2e/band_a.py): flat and 4–6-cube items at 360 × 640, Try 1 with every number but two, the
rules card, Try 3 with its hidden cube dashed (and numbered in the reveal). Version 3 (PLAN milestone 8):
answers lettered A–E (a letter key answers); the plain line drawing in the test range and the face tones
on the starter band and while show me plays; the set row and the tally pad on a figure with several
questions (the harness: Section-style params.ask); in the app's Free play at 360 x 640, 390 x 844 and
1366 x 768: "Question i of n", the answers keep their place when the pad opens and at the reveal, the
tally and the drawing stay for the figure's next question, a new figure empties the pad, nothing
scrolls. Screenshots: tests/e2e/out/cubes/. """
import sys

from playwright.sync_api import sync_playwright

import time

from band_a import band_checks, reveal_stable, wtg_checks, READY, PHONE
from common import Console, ROOT, file_url, launch
from pat_harness import Pat

APP_READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'


def stem(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, L = PX.ex.get('cubes').lib;
        return { faces: document.querySelectorAll('.ex-cubes-figure .ex-cubes-face').length,
                 want: L.facesOf(L.cubesOf(it.heights)).length,
                 n: document.querySelector('.ex-cubes-n').textContent, ask: it.ask,
                 w: Math.round(document.querySelector('.ex-cubes-svg').getBoundingClientRect().width) };
    }""")
    C.ok(d['faces'] == d['want'], f'{tag}: one drawn face per exposed top, front and right face ({d["faces"]} of {d["want"]})')
    C.ok(d['n'] == str(d['ask']), f'{tag}: the question shows N = {d["ask"]} ({d["n"]!r})')
    C.ok(d['w'] >= 200, f'{tag}: the figure is at least 200 px wide ({d["w"]} px)')


def options(C, page, tag):
    t = page.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .ex-cubes-opt .ex-answer-text')).map((e) => e.textContent)")
    C.ok(t == ['1', '2', '3', '4', '5'], f'{tag}: the options are 1–5 cubes ({t})')


def showme(C, frame, tag):
    d = frame.evaluate("""() => {
        const it = __harness.item, L = PX.ex.get('cubes').lib, rr = L.render(it.heights);
        const nums = Array.from(document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge')).map((g) => g.querySelector('.ex-cubes-badge-n').textContent);
        return { badges: nums.length, cubes: rr.cubes.length, ringed: document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge--count').length,
                 ghosts: document.querySelectorAll('.ex-cubes-marks .ex-cubes-ghost').length, hidden: rr.perCube.filter((pc) => pc.any === 0).length,
                 count: it.count, numbers: nums.sort().join(''), want: rr.cubes.map((q) => q.painted).sort().join('') };
    }""")
    C.ok(d['badges'] == d['cubes'] and d['numbers'] == d['want'] and d['ringed'] == d['count'] and d['ghosts'] == d['hidden'],
         f'{tag}: show me ends with every cube\'s number of painted sides, the counted ones ringed, hidden ones as ghosts ({d})')


def assist(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, n = PX.ex.get('cubes').lib.total(it.heights);
        return { unknown: document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge--unknown').length,
                 numbers: document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge--number').length, n,
                 caption: (document.querySelector('.ex-cubes-under .ex-caption') || {}).textContent || '' };
    }""")
    C.ok(d['unknown'] == 2 and d['numbers'] == d['n'] - 2 and 'two' in d['caption'], f'{tag}: every cube\'s number but two, which show ? ({d})')


def hidden_before(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, rr = PX.ex.get('cubes').lib.render(it.heights);
        return { ghosts: document.querySelectorAll('.ex-cubes-marks .ex-cubes-ghost').length, hidden: rr.perCube.filter((pc) => pc.any === 0).length,
                 badges: document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge').length,
                 caption: (document.querySelector('.ex-cubes-under .ex-caption') || {}).textContent || '' };
    }""")
    C.ok(d['hidden'] == 1 and d['ghosts'] == 1 and d['badges'] == 0 and 'dashed' in d['caption'],
         f'{tag}: the hidden cube drawn dashed, no number on any cube, the caption says so ({d})')


def hidden_after(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, rr = PX.ex.get('cubes').lib.render(it.heights);
        const hid = rr.cubes.filter((q, i) => rr.perCube[i].any === 0).map((q) => String(q.painted));
        return { ghosts: document.querySelectorAll('.ex-cubes-marks .ex-cubes-ghost').length, hidden: hid,
                 onHidden: Array.from(document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge.is-hidden .ex-cubes-badge-n')).map((e) => e.textContent),
                 ringed: document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge--count').length, count: it.count };
    }""")
    C.ok(d['ghosts'] == 1 and d['onHidden'] == d['hidden'] and d['ringed'] == d['count'],
         f'{tag}: the reveal keeps the hidden cube dashed with its number, and rings the counted cubes ({d})')


def letters_look(b, cons, C, out_dir):
    """Letters A–E, the plain look in the test range, tones on the starter band and during show me."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))

    def goto(params, seed, **q):
        page.goto(file_url('tests/dev/harness.html', ex='cubes', seed=seed, p=params, fast=1, **q))
        page.wait_for_function(READY, timeout=60000)

    goto('cubes:2,height:1,asked:0', 31)
    d = page.evaluate("""() => ({ keys: Array.from(document.querySelectorAll('.hx-grid .px-choice .px-choice-key')).map((e) => e.textContent),
        aria: Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((e) => e.getAttribute('aria-label')),
        plain: document.querySelector('.ex-cubes-figure-box').classList.contains('is-plain'),
        plate: getComputedStyle(document.querySelector('.ex-cubes-figure-box')).backgroundColor,
        fill: getComputedStyle(document.querySelector('.ex-cubes-face--front')).fill })""")
    C.ok(d['keys'] == ['A', 'B', 'C', 'D', 'E'] and d['aria'][1] == 'Option B: 2 cubes', f'cubes: answers lettered A–E, named "Option B: 2 cubes" ({d["keys"]}, {d["aria"][1]!r})')
    C.ok(d['plain'] and d['plate'] == 'rgb(255, 255, 255)' and d['fill'] == 'rgb(255, 255, 255)', f'cubes: the test range drawn plain, white faces on a white plate ({d})')
    page.screenshot(path=str(out_dir / 'cubes_v3_plain_1366x768.png'))
    key = page.evaluate('() => __harness.key')
    page.keyboard.press('ABCDE'[key].lower())
    page.wait_for_function("(s) => __harness.state === s", arg='reveal', timeout=10000)
    C.ok(page.evaluate("() => !!__harness.last && __harness.last.source === 'key' && __harness.last.result.correct === true"), f'cubes: the letter key {"ABCDE"[key]} answers the item right')
    page.evaluate('() => { window.__toned = []; const box = document.querySelector(".ex-cubes-figure-box"); new MutationObserver(() => __toned.push(box.classList.contains("is-plain"))).observe(box, { attributes: true }); }')
    page.evaluate('() => __harness.showMe()')
    page.wait_for_function('() => __harness.played.finished >= 1', timeout=30000)
    t = page.evaluate('() => ({ log: __toned, now: document.querySelector(".ex-cubes-figure-box").classList.contains("is-plain") })')
    C.ok(False in t['log'] and t['now'], f'cubes: show me draws the face tones and the plain look returns after it ({t})')
    goto('cubes:0,height:0,asked:0', 1)
    plain = page.evaluate("() => document.querySelector('.ex-cubes-figure-box').classList.contains('is-plain')")
    C.ok(not plain, 'cubes: the starter band keeps the face tones')
    ctx.close()


def tally_harness(b, cons, C, out_dir):
    """A figure's later question in the harness (Section-style params.ask): the set row, the pad."""
    for (w, h, phone) in [(360, 640, True), (1366, 768, False)]:
        ctx = b.new_context(viewport={'width': w, 'height': h}, **(PHONE if phone else {}))
        page = ctx.new_page()
        cons.append(Console(page))
        page.goto(file_url('tests/dev/harness.html', ex='cubes', seed=44, p='cubes:2,height:1,asked:0,ask:1', fast=1))
        page.wait_for_function(READY, timeout=60000)
        d = page.evaluate("""() => ({ row: !document.querySelector('.ex-cubes-set').hidden, label: (document.querySelector('.ex-cubes-set-n') || {}).textContent,
            pos: __harness.item.pos, n: __harness.item.asks.length })""")
        C.ok(d['row'] and d['label'] == f'Question {d["pos"] + 1} about this figure', f'cubes {w}x{h}: a later question shows the set row ({d})')

        def tap(loc):
            if phone:
                loc.tap()
            else:
                loc.click()

        tap(page.locator('.ex-cubes-tally-toggle'))
        sz = page.evaluate("""() => Array.from(document.querySelectorAll('.ex-cubes-tally button')).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.right)]; })""")
        C.ok(len(sz) == 7 and all(x[0] >= 44 and x[1] >= 44 and x[2] <= w for x in sz), f'cubes {w}x{h}: the open pad has six counters and Clear, each at least 44 px, inside the screen ({sz})')
        for _ in range(2):
            tap(page.locator('.ex-cubes-tally-c').nth(3))
        tap(page.locator('.ex-cubes-tally-c').nth(1))
        v = page.evaluate("() => Array.from(document.querySelectorAll('.ex-cubes-tally-v')).map((e) => e.textContent)")
        C.ok(v == ['·', '1', '·', '2', '·', '·'], f'cubes {w}x{h}: taps add to the counters ({v})')
        page.screenshot(path=str(out_dir / f'cubes_v3_tally_{w}x{h}.png'))
        page.evaluate("() => __harness.next(Object.assign({}, __harness.item.params, { ask: 2 }), __harness.item.seed)")
        page.wait_for_function(READY, timeout=60000)
        v2 = page.evaluate("() => ({ v: Array.from(document.querySelectorAll('.ex-cubes-tally-v')).map((e) => e.textContent), label: document.querySelector('.ex-cubes-set-n').textContent })")
        C.ok(v2['v'] == v and v2['label'].startswith('Question 3'), f'cubes {w}x{h}: the next question about the same figure keeps the open pad and its counts ({v2})')
        tap(page.locator('.ex-cubes-tally-clear'))
        v3 = page.evaluate("() => Array.from(document.querySelectorAll('.ex-cubes-tally-v')).map((e) => e.textContent)")
        C.ok(v3 == ['·'] * 6, f'cubes {w}x{h}: Clear empties the pad ({v3})')
        tap(page.locator('.ex-cubes-tally-c').nth(4))
        page.evaluate("() => __harness.next(Object.assign({}, __harness.item.params, { ask: 1 }), 45)")
        page.wait_for_function(READY, timeout=60000)
        v4 = page.evaluate("() => Array.from(document.querySelectorAll('.ex-cubes-tally-v')).map((e) => e.textContent)")
        C.ok(v4 == ['·'] * 6, f'cubes {w}x{h}: a new figure starts with an empty pad ({v4})')
        ctx.close()


# Answer tiles relative to the trial (as band_a.reveal_stable measures: the player may scroll the page itself),
# the figure's height, the lowest control on the screen and whether the page scrolls.
GEO = """() => { const g = document.querySelector('.pl-trial .px-choices'), svg = document.querySelector('.ex-cubes-figure-box svg'), trial = document.querySelector('.pl-trial');
    const r = g.getBoundingClientRect(), t = trial.getBoundingClientRect();
    const ctl = Array.from(document.querySelectorAll('.pl-trial .px-choice, .ex-cubes-set button')).map((e) => e.getBoundingClientRect());
    return { top: Math.round(r.top - t.top), svgH: Math.round(svg.getBoundingClientRect().height), low: Math.round(Math.max(...ctl.map((x) => x.bottom))),
             H: innerHeight, scrolls: document.documentElement.scrollHeight > innerHeight + 1, wide: document.documentElement.scrollWidth > innerWidth }; }"""
SEEN = """() => { const r = PX.core.store.state; r.tour = r.tour || { seen: {} }; r.tour.seen = r.tour.seen || {};
    PX.ex.list().forEach(d => { r.tour.seen[d.id] = true; }); r.ui = r.ui || {}; r.ui.seen = r.ui.seen || {}; }"""


def tally_app(b, cons, C, out_dir):
    """Free play in the app: a set's questions, "Question i of n", the pad without moving the answers."""
    for (w, h, phone) in [(360, 640, True), (390, 844, True), (1366, 768, False)]:
        tag = f'cubes app {w}x{h}'
        ctx = b.new_context(viewport={'width': w, 'height': h}, **(PHONE if phone else {}))
        page = ctx.new_page()
        cons.append(Console(page))
        page.goto((ROOT / 'index.html').as_uri())
        page.wait_for_function(APP_READY, timeout=30000)
        for _ in range(4):
            if not page.evaluate('PX.ui.modalOpen()'):
                break
            page.keyboard.press('Escape')
            page.wait_for_timeout(150)
        page.evaluate(SEEN)
        page.evaluate('PX.debug.fast(true)')
        page.evaluate('void PX.core.router.go("play", { mode: "free", exId: "cubes", run: "1", trials: 12, params: { cubes: 2, height: 1, asked: 0 } }, { force: true })')

        def tap(loc):
            if phone:
                loc.tap()
            else:
                loc.click()

        def respond(ms=60000):
            t0 = time.time()
            while time.time() - t0 < ms / 1000:
                s = page.evaluate('window.__play ? __play.state : null')
                if s == 'respond':
                    return True
                for sel in ('[data-card-box] [data-card="skip"]', '[data-card-box] .px-btn--primary'):
                    loc = page.locator(sel)
                    if loc.count() and loc.first.is_visible():
                        loc.first.click()
                        page.wait_for_timeout(200)
                page.wait_for_timeout(120)
            return False

        found = None
        for k in range(8):
            if not respond():
                C.ok(False, f'{tag}: the item reached its answer state ({k})')
                break
            d = page.evaluate("""() => ({ row: !document.querySelector('.ex-cubes-set').hidden, label: (document.querySelector('.ex-cubes-set-n') || {}).textContent || '' })""")
            if d['row'] and d['label'].startswith('Question 1 of'):
                found = d
                break
            page.evaluate('__play.answer(true).catch(() => 0)')
            page.wait_for_timeout(150)
            page.evaluate('__play.next()')
        C.ok(found is not None, f'{tag}: a figure with several questions shows "Question 1 of n" ({found})')
        if not found:
            ctx.close()
            continue
        n = int(found['label'].split(' of ')[1])
        g0 = page.evaluate(GEO)
        tap(page.locator('.ex-cubes-tally-toggle'))
        page.wait_for_timeout(200)
        g1 = page.evaluate(GEO)
        fits = (g1['low'] <= g1['H'] and not g1['scrolls']) if phone else not g1['wide']
        C.ok(abs(g1['top'] - g0['top']) <= 1 and fits, f'{tag}: opening the pad keeps the answers in place{" and everything on the screen" if phone else ""} ({g0} → {g1})')
        C.ok(g1['svgH'] < g0['svgH'], f'{tag}: the figure gives the pad its room ({g0["svgH"]} → {g1["svgH"]} px)')
        tap(page.locator('.ex-cubes-tally-c').nth(3))
        page.screenshot(path=str(out_dir / f'cubes_v3_app_{w}x{h}.png'))
        page.evaluate('__play.answer(true).catch(() => 0)')
        page.wait_for_timeout(250)
        g2 = page.evaluate(GEO)
        C.ok(abs(g2['top'] - g1['top']) <= 1, f'{tag}: the reveal keeps the answers in place with the pad open ({g1["top"]} → {g2["top"]})')
        page.screenshot(path=str(out_dir / f'cubes_v3_app_reveal_{w}x{h}.png'))
        page.evaluate('__play.next()')
        ok = respond()
        d = page.evaluate("""() => ({ label: (document.querySelector('.ex-cubes-set-n') || {}).textContent || '', v: Array.from(document.querySelectorAll('.ex-cubes-tally-v')).map((e) => e.textContent) })""")
        C.ok(ok and d['label'] == f'Question 2 of {n}' and len(d['v']) == 6 and d['v'][3] == '1', f'{tag}: the next step is the same figure\'s second question, the pad still open with its count ({d})')
        page.screenshot(path=str(out_dir / f'cubes_v3_app_q2_{w}x{h}.png'))
        page.evaluate('void __play.end()')
        ctx.close()


class Band(Pat):
    def run(self, demo, sandbox):
        cons = []
        with sync_playwright() as p:
            b = launch(p)
            self.views(b, cons)
            self.fit(b, cons)
            self.demo(b, cons, *demo)
            self.sandboxed(b, cons, *sandbox)
            band_checks(b, cons, self.C, 'cubes', self.dir,
                        [('flat', 'cubes:0,height:0,asked:0', 1), ('flat9', 'cubes:1,height:0,asked:1', 5), ('small', 'cubes:0,height:1,asked:0', 18)],
                        assist_check=assist, try1=('cubes:0,height:0,asked:0', 13),
                        assists=[('try3', 'cubes:0,height:1,asked:0', 18, '{"hidden":true}', hidden_before, hidden_after)])
            wtg_checks(b, cons, self.C, 'cubes', self.dir, '.ex-cubes-marks .ex-cubes-badge--unknown', try_marks={3: '.ex-cubes-marks .ex-cubes-ghost'})
            reveal_stable(b, cons, self.C, 'cubes', self.dir)
            letters_look(b, cons, self.C, self.dir)
            tally_harness(b, cons, self.C, self.dir)
            tally_app(b, cons, self.C, self.dir)
            b.close()
        errors = [e for c in cons for e in c.errors()]
        self.C.ok(not errors, f'no console errors ({errors[:5]})')
        for f in self.dir.glob('_page_*.html'):
            f.unlink()
        return self.C.summary({'screenshots': sorted(p.name for p in self.dir.glob('cubes_*.png'))})


if __name__ == '__main__':
    P = Band('cubes', [('band', 'cubes:0,height:0', 2), ('floor', 'cubes:1,height:1,asked:1', 7), ('big', 'cubes:4,height:3,asked:1', 4)],
             stem_check=stem, option_check=options, showme_check=showme)
    sys.exit(P.run(demo=('cubes:0,height:0', 1), sandbox=('cubes:3,height:2', 21)))
