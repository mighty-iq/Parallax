"""E2E: the dev harness with Missing View (EX-15, a DAT-style format). Owner B6.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_patviews.py

1. desktop 1366 x 768 and phone 390 x 844 (DPR 2, touch), light and dark, each missing view (end,
   front, top): the stem shows two drawn views and the "?" slot in the third-angle places; four
   option drawings share one scale; a right answer by keyboard, a wrong one by pointer or tap; show
   me ends with the key traced in the slot and its drawing on the right option (after a wrong pick:
   the picked drawing laid over the slot with its differences marked, on the picked option too); the
   feedback marks where each wrong drawing differs; no horizontal scroll
2. 360 x 640: the stem and all four options within one screen, targets >= 44 px
3. show me at normal speed (planned time), the tutorial demo with captions, its dotted-line step
4. the harness inlined into a sandboxed srcdoc frame; no console errors
Screenshots: tests/e2e/out/patviews/patviews_<case>_<viewport>_<theme>[_reveal|_showme|_wrong].png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, launch
from patb_common import (PHONE, READY, STATE, Checks, Console, answer_keyboard, answer_pointer, fits, no_hscroll, open_item,
                         report, sandboxed, show_me, stage_ok)

C = Checks('harness_patviews')
EX, DEPS, DIR = 'patviews', ('views',), OUT / 'patviews'
DIR.mkdir(parents=True, exist_ok=True)
STEM = '.pv-stage'
CASES = {  # name: (params, seed)
    'end': ('cubes:1,grid:0,missing:0,foil:0', 3),
    'front': ('cubes:2,grid:1,missing:1,foil:2', 5),
    'top': ('cubes:3,grid:1,missing:2,foil:1', 7),
}
DONE = """() => {
    const it = __harness.item, cells = document.querySelectorAll('.hx-grid .px-choice'), wrong = !__harness.last.result.correct;
    const traced = document.querySelectorAll('.pv-over .pv-trace').length, picked = document.querySelectorAll('.pv-over .pv-picked').length;
    const ghost = !!cells[it.key].querySelector('.pv-ghost');
    // feedback points to the decisive lines: every wrong drawing carries its difference marks
    const marked = Array.from(cells).filter((c, i) => i !== it.key && c.querySelector('.pv-diff')).length;
    const pk = __harness.last.response, pickMarked = wrong ? !!cells[pk].querySelector('.pv-diff--show') : true;
    return { ok: ghost && marked === 3 && pickMarked && (wrong ? picked === 1 : traced >= 1), traced, ghost, picked, wrong, marked, pickMarked }; }"""


def shot(page, name):
    page.screenshot(path=str(DIR / name), full_page=True)


def stem_ok(page, tag, missing):
    r = page.evaluate("""() => ({ labels: Array.from(document.querySelectorAll('.pv-label')).map((x) => x.textContent),
        given: document.querySelectorAll('.pv-given').length, slot: document.querySelectorAll('.pv-slot .pv-q').length,
        missLabel: (document.querySelector('.pv-label--miss') || {}).textContent,
        boxes: Object.fromEntries(['top', 'front', 'end'].map((v, i) => [v, null])) })""")
    C.ok(r['given'] == 2 and r['slot'] == 1 and r['missLabel'] == missing.capitalize(), f'{tag}: two given views and the "?" slot for the {missing} view ({r})')
    pos = page.evaluate("""() => { const g = Array.from(document.querySelectorAll('.pv-given, .pv-slot')).map((e) => {
        const b = e.getBBox(); return { name: e.querySelector('.pv-label').textContent, x: b.x, y: b.y, w: b.width, h: b.height }; });
        return g; }""")
    by = {p['name']: p for p in pos}
    ok = by['Top']['y'] < by['Front']['y'] and by['End']['x'] > by['Front']['x'] and abs(by['Top']['x'] - by['Front']['x']) < 2
    C.ok(ok, f'{tag}: third-angle places (top above front, end right of front)')
    o = page.evaluate("""() => Array.from(document.querySelectorAll('.hx-grid .pv-opt-svg')).map((s) => ({ vb: s.getAttribute('viewBox'), w: Math.round(s.getBoundingClientRect().width) }))""")
    C.ok(len(o) == 4 and len({x['vb'] for x in o}) == 1 and all(x['w'] >= 50 for x in o), f'{tag}: four drawings at one scale, each at least 50 px wide ({o})')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((390, 844), '390', PHONE)]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '390'
        for case, (params, seed) in CASES.items():
            for theme in ('light', 'dark'):
                name = f'patviews_{case}_{tag}_{theme}'
                open_item(page, EX, {'seed': seed, 'p': params, 'fast': True, 'theme': theme}, DEPS, name)
                stage_ok(C, page, STEM, name)
                stem_ok(page, name, case)
                shot(page, name + '.png')
                if phone:
                    no_hscroll(C, page, name)
                if theme == 'light':
                    answer_keyboard(C, page, page, name)
                    shot(page, name + '_reveal.png')
                    show_me(C, page, name, DONE, page=page)
                    shot(page, name + '_showme.png')
                    page.keyboard.press('Space')
                    page.wait_for_function(READY, timeout=10000)
                    answer_pointer(C, page, 4, name, tap=phone)
                    show_me(C, page, name + ' (after a wrong pick)', DONE)
                    picked = page.evaluate("() => document.querySelectorAll('.pv-over .pv-picked').length")
                    C.ok(picked == 1, f'{name}: after a wrong pick, show me lays that drawing over the slot ({picked})')
                    shot(page, name + '_wrong_showme.png')
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def small_phone(b, cons):
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    for case, (params, seed) in CASES.items():
        name = f'patviews_{case}_360'
        open_item(page, EX, {'seed': seed + 1, 'p': params, 'fast': True}, DEPS, name)
        page.evaluate("() => document.querySelector('.pv-stage').scrollIntoView({ block: 'start' })")
        fits(C, page, STEM, name)
        no_hscroll(C, page, name)
        page.screenshot(path=str(DIR / (name + '.png')))
    ctx.close()


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    params, seed = CASES['front']
    open_item(page, EX, {'seed': seed, 'p': params}, DEPS, 'speed')
    page.evaluate('() => __harness.answer(false)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.showMe(); }')
    page.wait_for_timeout(3500)
    page.screenshot(path=str(DIR / 'patviews_showme_mid.png'))
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=120000)
    pl = page.evaluate('() => __harness.played')
    C.ok(6000 <= pl['plannedMs'] <= 22000, f'show me plans 6-22 s at normal speed ({pl})')
    open_item(page, EX, {'seed': 11, 'p': 'cubes:0,grid:0,missing:0,foil:0', 'fast': True}, DEPS, 'demo')
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=40000)
    cap = page.locator('.hx-caption').inner_text()
    C.ok(len(cap) > 10, f'the demo plays to the end with captions ({cap!r})')
    page.screenshot(path=str(DIR / 'patviews_demo_end.png'))
    # The Watch's dotted-line step: long, after the structure is shown, every dotted line marked.
    d = page.evaluate("""() => { const v = PX.ex.view('patviews'), L = PX.ex.learn('patviews'), list = v.steps(__harness.item, null);
        const i = list.findIndex((s) => s.caption === L.captions.dotted); if (i < 0) return { found: false };
        list[i].enter();
        return { found: true, ms: list[i].ms, hl: document.querySelectorAll('.pv-over .pv-hl').length, obj: document.querySelectorAll('.pv-over .pv-cover').length,
          after: !!(list[i - 1] && list[i - 1].caption === L.captions.object) }; }""")
    C.ok(d.get('found') and d['ms'] >= 4000 and d['hl'] >= 3 and d['obj'] == 1 and d['after'], f"the Watch's dotted-line step is long, follows the structure and marks every dotted line ({d})")
    page.screenshot(path=str(DIR / 'patviews_demo_dotted.png'))
    ctx.close()
    return pl


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        desktop_and_phone(b, cons)
        small_phone(b, cons)
        pl = normal_speed(b, cons)
        sandboxed(C, b, cons, EX, {'seed': 21, 'p': CASES['end'][0], 'fast': True}, DEPS, STEM, DONE, DIR / 'patviews_srcdoc.png')
        b.close()
    return report(C, cons, {'showMe': pl, 'screenshots': sorted(x.name for x in DIR.glob('patviews_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
