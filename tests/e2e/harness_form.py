"""E2E: the dev harness with Form (PAT-6). Owner B6.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_form.py

1. desktop 1366 x 768 and phone 390 x 844 (DPR 2, touch), light and dark: the pattern is drawn with
   cut edges and fold lines; four solids at one scale; a right answer by keyboard, a wrong one by
   pointer or tap; show me letters a landmark face in the pattern and in the right solid (after a
   wrong pick: the face that cannot be marked so, or the wrong size); no horizontal scroll
2. 360 x 640: the stem and all four solids within one screen, targets >= 44 px
3. show me at normal speed, the tutorial demo with captions
4. the harness inlined into a sandboxed srcdoc frame; no console errors
Screenshots: tests/e2e/out/form/form_<case>_<viewport>_<theme>[_reveal|_showme|_wrong_showme].png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, file_url, launch
from patb_common import PHONE, READY, STATE, answer_keyboard, answer_pointer, fits, no_hscroll, report, sandboxed, show_me, stage_ok

C = Checks('harness_form')
EX, DIR, STEM = 'form', OUT / 'form', '.fm-stage'
DIR.mkdir(parents=True, exist_ok=True)
CASES = {  # name: (params, seed)
    'box': ('solid:0,marks:0,view:0,foil:0', 5),
    'pyramid': ('solid:1,marks:1,view:1,foil:1', 6),
    'half': ('solid:2,marks:2,view:2,foil:1', 8),
}
DONE = """() => {
    const it = __harness.item, cells = document.querySelectorAll('.hx-grid .px-choice'), wrong = !__harness.last.result.correct;
    const netTags = document.querySelectorAll('.fm-svg .fm-tag').length, keyTags = cells[it.key].querySelectorAll('.fm-tag').length;
    const bad = document.querySelectorAll('.fm-tag--bad').length, pk = __harness.last.response, kind = typeof pk === 'number' ? it.options[pk].kind : '';
    const ok = wrong ? (kind === 'shape' ? cells[pk].classList.contains('ex-focus') : bad >= 1) : (netTags >= 1 && keyTags >= 1);
    return { ok, netTags, keyTags, bad, wrong, kind }; }"""


def go(page, case, theme='light', fast=True, seed_add=0):
    params, seed = CASES[case]
    page.goto(file_url('tests/dev/harness.html', ex=EX, seed=seed + seed_add, p=params, fast=1 if fast else None, theme=theme))
    page.wait_for_function(READY, timeout=60000)


def stem_ok(page, tag):
    r = page.evaluate("""() => ({ faces: document.querySelectorAll('.fm-netface').length, cut: (document.querySelector('.fm-cut') || { getAttribute: () => '' }).getAttribute('d').length,
        fold: (document.querySelector('.fm-fold') || { getAttribute: () => '' }).getAttribute('d').length, marks: document.querySelectorAll('.fm-svg .fm-mark').length,
        opts: Array.from(document.querySelectorAll('.hx-grid .fm-opt-svg')).map((s) => ({ vb: s.getAttribute('viewBox').split(' ')[2], w: Math.round(s.getBoundingClientRect().width), f: s.querySelectorAll('.px-fig-face').length })) })""")
    C.ok(r['faces'] >= 4 and r['cut'] > 10 and r['fold'] > 10 and r['marks'] >= 1, f'{tag}: the pattern shows faces, cut edges, fold lines and marks ({r["faces"]}, {r["marks"]})')
    o = r['opts']
    C.ok(len(o) == 4 and len({x['vb'] for x in o}) == 1 and all(x['w'] >= 60 and x['f'] >= 2 for x in o), f'{tag}: four solids at one scale, each at least 60 px with two or more faces ({o})')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((390, 844), '390', PHONE)]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '390'
        for case in CASES:
            for theme in ('light', 'dark'):
                name = f'form_{case}_{tag}_{theme}'
                go(page, case, theme)
                stage_ok(C, page, STEM, name)
                stem_ok(page, name)
                page.screenshot(path=str(DIR / f'{name}.png'), full_page=True)
                if phone:
                    no_hscroll(C, page, name)
                if theme == 'light':
                    answer_keyboard(C, page, page, name)
                    page.screenshot(path=str(DIR / f'{name}_reveal.png'), full_page=True)
                    show_me(C, page, name, DONE, page=page)
                    page.screenshot(path=str(DIR / f'{name}_showme.png'), full_page=True)
                    page.keyboard.press('Space')
                    page.wait_for_function(READY, timeout=10000)
                    answer_pointer(C, page, 4, name, tap=phone)
                    show_me(C, page, name + ' (after a wrong pick)', DONE)
                    page.screenshot(path=str(DIR / f'{name}_wrong_showme.png'), full_page=True)
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def small_phone(b, cons):
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    for case in CASES:
        name = f'form_{case}_360'
        go(page, case, seed_add=1)
        page.evaluate("() => document.querySelector('.fm-stage').scrollIntoView({ block: 'start' })")
        fits(C, page, STEM, name)
        no_hscroll(C, page, name)
        page.screenshot(path=str(DIR / f'{name}.png'))
    ctx.close()


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    go(page, 'pyramid', fast=False)
    page.evaluate('() => __harness.answer(false)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.showMe(); }')
    page.wait_for_timeout(5600)
    page.screenshot(path=str(DIR / 'form_showme_mid.png'))
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=120000)
    pl = page.evaluate('() => __harness.played')
    C.ok(6000 <= pl['plannedMs'] <= 16000, f'show me plans 6-16 s at normal speed ({pl})')
    go(page, 'box')
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=40000)
    cap = page.locator('.hx-caption').inner_text()
    C.ok(len(cap) > 10, f'the demo plays to the end with captions ({cap!r})')
    ctx.close()
    return pl


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        desktop_and_phone(b, cons)
        small_phone(b, cons)
        pl = normal_speed(b, cons)
        sandboxed(C, b, cons, EX, {'seed': 41, 'p': CASES['pyramid'][0], 'fast': True}, (), STEM, DONE, DIR / 'form_srcdoc.png')
        b.close()
    return report(C, cons, {'showMe': pl, 'screenshots': sorted(x.name for x in DIR.glob('form_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
