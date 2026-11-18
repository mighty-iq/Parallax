"""E2E, short: the v1.2 starter band of Openings, Form, Hole Punch and Missing View in the dev harness at
360 x 640 (DPR 2, touch). Per exercise: Try 1's item with its first step done (ctx.assist) shows that
step; the band's items fit one screen with every answer target at least 44 px and no horizontal
scroll; a wrong tap and show me run to the end (Form ends on the folded pattern); the Watch item plays
to the end; the rules card lists 2-4 rules; no console or harness errors. Mid-animation screenshots
at normal speed for the new show-me steps (Openings' turn and flip, Form's fold-up, Missing View's
turn to the missing side). Screenshots: tests/e2e/out/starter_b/.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_starter_b.py [openings form patfold patviews]"""
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, launch, non_blank
from patb_common import PHONE, READY, STATE, fits, no_hscroll, page_url, report

C = Checks('harness_starter_b')
DIR = OUT / 'starter_b'
DIR.mkdir(parents=True, exist_ok=True)

SPECS = {  # ex: deps, stem, band params, Try 1 (seed, assist, selector), Try 2 (params, seed), Watch seed, mid-show-me wait (ms)
    'openings': dict(deps=(), stem='.op-stage', band='features:0,edges:0,keyview:0,pose:0,foils:0', try1=(104, {'trace': True}, '.op-ink .op-assist'),
                     try2=('features:0,edges:0,keyview:0,pose:0,foils:0', 239), demo=4, mid=('features:1,edges:0,keyview:0,pose:0,foils:0', 301, 6900)),
    'form': dict(deps=(), stem='.fm-stage', band='solid:0,marks:0,view:0,foil:0', try1=(12, {'letters': True}, '.fm-svg .fm-labels .fm-tag'),
                 try2=('solid:0,marks:0,view:0,foil:0', 207), demo=5, mid=('solid:0,marks:1,view:0,foil:0', 303, 15200)),
    'patfold': dict(deps=('fold',), stem='.ex-patfold-stage', band='folds:0,type:0,idle:0', try1=(1, {'twin': True}, '.ex-patfold-twin'),
                    try2=('folds:0,type:0,idle:0', 13), demo=14, mid=None),
    'patviews': dict(deps=('views',), stem='.pv-stage', band='cubes:0,grid:0,missing:0,foil:0', try1=(100, {'proj': True}, '.pv-proj--assist'),
                     try2=('cubes:0,grid:0,missing:1,foil:0', 202), demo=13, mid=('cubes:0,grid:0,missing:0,foil:0', 100, 5400)),
}


def open_cfg(page, ex, spec, cfg, name):
    page.goto(page_url(ex, cfg, spec['deps'], name))
    page.wait_for_function(READY, timeout=60000)


def check(b, cons, ex):
    spec = SPECS[ex]
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))
    # Try 1, its first step done
    seed, assist, sel = spec['try1']
    open_cfg(page, ex, spec, {'seed': seed, 'p': spec['band'], 'fast': True, 'assist': assist}, 'try1')
    n = page.evaluate('(s) => document.querySelectorAll(s).length', sel)
    C.ok(n >= 1, f'{ex} Try 1: the first step is drawn ({sel}: {n})')
    cap = page.evaluate("() => (document.querySelector('.ex-caption') || {}).textContent || ''")
    C.ok(len(cap) > 20, f'{ex} Try 1: the caption says what was done ({cap!r})')
    page.evaluate("(s) => document.querySelector(s).scrollIntoView({ block: 'start' })", spec['stem'])
    fits(C, page, spec['stem'].replace('-stage', '-stem') if ex == 'patfold' else spec['stem'], f'{ex} Try 1 at 360×640')
    no_hscroll(C, page, f'{ex} Try 1')
    page.screenshot(path=str(DIR / f'{ex}_try1_360.png'))
    # Try 2, unaided: fit, a wrong tap, show me to the end
    params, seed2 = spec['try2']
    open_cfg(page, ex, spec, {'seed': seed2, 'p': params, 'fast': True}, 'try2')
    ok, st = non_blank(page.locator(spec['stem']).screenshot(), min_distinct=4, max_top=0.99)
    C.ok(ok, f'{ex} Try 2: the stem is drawn ({st})')
    page.evaluate("(s) => document.querySelector(s).scrollIntoView({ block: 'start' })", spec['stem'])
    fits(C, page, spec['stem'], f'{ex} Try 2 at 360×640')
    no_hscroll(C, page, f'{ex} Try 2')
    page.screenshot(path=str(DIR / f'{ex}_try2_360.png'))
    h = page.evaluate('() => ({ key: __harness.key, n: __harness.item.options.length })')
    page.locator('.hx-grid .px-choice').nth((h['key'] + 1) % h['n']).tap()
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.showMe(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
    C.ok(True, f'{ex} Try 2: show me after a wrong tap ran to the end')
    if ex == 'form':
        f = page.evaluate("() => { const s = document.querySelector('.fm-fold'); return { shown: s && s.style.display !== 'none', faces: s ? s.querySelectorAll('path.px-fig-face').length : 0 }; }")
        C.ok(f['faces'] >= 3, f'form: the fold-up drew the folded pattern ({f})')
    page.screenshot(path=str(DIR / f'{ex}_try2_showme_360.png'))
    # The Watch item plays to the end (fast: a hold never waits)
    open_cfg(page, ex, spec, {'seed': spec['demo'], 'p': spec['band'], 'fast': True}, 'demo')
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
    C.ok(True, f'{ex} Watch: the demo plays to the end')
    page.screenshot(path=str(DIR / f'{ex}_watch_end_360.png'))
    # The rules card
    open_cfg(page, ex, spec, {'seed': spec['demo'], 'p': spec['band'], 'fast': True, 'rules': True}, 'rules')
    r = page.evaluate("() => document.querySelectorAll('.hx-rules:not([hidden]) li').length")
    C.ok(2 <= r <= 4, f'{ex}: the rules card lists {r} rules')
    page.screenshot(path=str(DIR / f'{ex}_rules_360.png'))
    errs = page.evaluate('() => __harness.errors')
    C.ok(not errs, f'{ex}: no harness errors ({errs})')
    # Normal speed, a frame in the middle of the new show-me steps
    if spec['mid']:
        params, seed3, wait = spec['mid']
        open_cfg(page, ex, spec, {'seed': seed3, 'p': params}, 'mid')
        page.evaluate('() => __harness.answer(true)')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        page.evaluate("(s) => document.querySelector(s).scrollIntoView({ block: 'start' })", spec['stem'])
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(wait)
        page.screenshot(path=str(DIR / f'{ex}_showme_mid_360.png'))
        page.wait_for_timeout(1200)
        page.screenshot(path=str(DIR / f'{ex}_showme_mid2_360.png'))
    ctx.close()


def main(which):
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        for ex in which:
            check(b, cons, ex)
        b.close()
    return report(C, cons, {'screenshots': sorted(x.name for x in DIR.glob('*.png'))})


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:] or list(SPECS)))
