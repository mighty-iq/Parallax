"""E2E: the dev harness with Openings (EX-14, a DAT-style format). Owner B6.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_openings.py

1. desktop 1366 x 768 and phone 390 x 844 (DPR 2, touch), light and dark: the solid is drawn
   (non-blank stage); five openings at one scale; a right answer by keyboard, a wrong one by pointer
   or tap; show me turns to the fitting face and ends with the outline on the right opening (after a
   wrong pick: the nearest true outline laid over the chosen one); no horizontal scroll
2. 360 x 640: the stem and all five openings within one screen, targets >= 44 px
3. show me at normal speed, the tutorial demo with captions, a lost WebGL context voids the trial
4. the harness inlined into a sandboxed srcdoc frame; no console errors
Screenshots: tests/e2e/out/openings/openings_<case>_<viewport>_<theme>[_reveal|_showme|_wrong_showme].png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, file_url, launch
from patb_common import PHONE, READY, STATE, answer_keyboard, answer_pointer, fits, no_hscroll, report, sandboxed, show_me, stage_ok

C = Checks('harness_openings')
EX, DIR, STEM = 'openings', OUT / 'openings', '.op-stage'
DIR.mkdir(parents=True, exist_ok=True)
CASES = {  # name: (params, seed)
    'easy': ('features:0,edges:0,keyview:0,pose:0,foils:0', 7),
    'side': ('features:2,edges:1,keyview:1,pose:0,foils:0', 4),
    'lying': ('features:3,edges:1,keyview:2,pose:1,foils:1', 9),
}
DONE = """() => {
    const it = __harness.item, cells = document.querySelectorAll('.hx-grid .px-choice'), wrong = !__harness.last.result.correct;
    const ghost = !!cells[it.key].querySelector('.op-ghost'), truth = document.querySelectorAll('.hx-grid .op-true').length;
    const traced = document.querySelectorAll('.op-ink .op-trace').length, stray = document.querySelectorAll('body > svg.op-fly').length;
    return { ok: ghost && traced === 1 && stray === 0 && (!wrong || truth === 1), ghost, truth, traced, stray, wrong }; }"""


def go(page, case, theme='light', fast=True, seed_add=0, extra=None):
    params, seed = CASES[case]
    page.goto(file_url('tests/dev/harness.html', ex=EX, seed=seed + seed_add, p=params, fast=1 if fast else None, theme=theme, **(extra or {})))
    page.wait_for_function(READY, timeout=60000)


def opts_ok(page, tag):
    o = page.evaluate("""() => Array.from(document.querySelectorAll('.hx-grid .op-opt-svg')).map((s) => ({ vb: s.getAttribute('viewBox'),
        w: Math.round(s.getBoundingClientRect().width), d: (s.querySelector('.op-hole') || { getAttribute: () => '' }).getAttribute('d').length }))""")
    C.ok(len(o) == 5 and len({x['vb'] for x in o}) == 1 and all(x['w'] >= 48 and x['d'] > 10 for x in o), f'{tag}: five openings at one scale, each at least 48 px ({o})')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((390, 844), '390', PHONE)]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '390'
        for case in CASES:
            for theme in ('light', 'dark'):
                name = f'openings_{case}_{tag}_{theme}'
                go(page, case, theme)
                stage_ok(C, page, STEM, name)
                opts_ok(page, name)
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
                    answer_pointer(C, page, 5, name, tap=phone)
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
        name = f'openings_{case}_360'
        go(page, case, seed_add=1)
        page.evaluate("() => document.querySelector('.op-stage').scrollIntoView({ block: 'start' })")
        fits(C, page, STEM, name)
        no_hscroll(C, page, name)
        page.screenshot(path=str(DIR / f'{name}.png'))
    ctx.close()


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    go(page, 'side', fast=False)
    page.evaluate('() => __harness.answer(false)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.showMe(); }')
    page.wait_for_timeout(4200)
    page.screenshot(path=str(DIR / 'openings_showme_mid.png'))
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=120000)
    pl = page.evaluate('() => __harness.played')
    C.ok(6000 <= pl['plannedMs'] <= 16000, f'show me plans 6-16 s at normal speed ({pl})')
    go(page, 'easy')
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=40000)
    cap = page.locator('.hx-caption').inner_text()
    C.ok(len(cap) > 10, f'the demo plays to the end with captions ({cap!r})')
    # A lost WebGL context voids the trial; the solid comes back after the restore.
    go(page, 'easy', seed_add=3)
    page.evaluate('() => { const r = PX.core.stage3d.renderer(); r.forceContextLoss(); setTimeout(() => r.forceContextRestore(), 400); }')
    page.wait_for_timeout(1500)
    stage_ok(C, page, STEM, 'after a context loss and restore')
    page.evaluate('() => __harness.answer(true)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    last = page.evaluate('() => __harness.last')
    C.ok(last.get('void') is True, f'a context loss voids the trial (void {last.get("void")})')
    ctx.close()
    return pl


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        desktop_and_phone(b, cons)
        small_phone(b, cons)
        pl = normal_speed(b, cons)
        sandboxed(C, b, cons, EX, {'seed': 31, 'p': CASES['side'][0], 'fast': True}, (), STEM, DONE, DIR / 'openings_srcdoc.png')
        b.close()
    return report(C, cons, {'showMe': pl, 'screenshots': sorted(x.name for x in DIR.glob('openings_*.png'))})


if __name__ == '__main__':
    sys.exit(main())
