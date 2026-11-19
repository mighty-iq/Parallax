"""E2E, short: the v1.2 starter band of Openings, Form, Hole Punch and Missing View in the dev harness at
360 x 640 (DPR 2, touch). Per exercise: Try 1's item with its first step done (ctx.assist) shows that
step; the band's items fit one screen with every answer target at least 44 px and no horizontal
scroll; a wrong tap and show me run to the end (Form ends on the folded pattern); the Watch item plays
to the end; the rules card lists 2-4 rules; no console or harness errors. Mid-animation screenshots
at normal speed for the new show-me steps (Openings' turn and flip, Form's fold-up, Missing View's
turn to the missing side). Then the app's own Watch, Try, Go (index.html, fast) at 360 x 640: the rules
card, the Watch to its end, the strategy card, Try 1-4 with the worked example right before the Try item
that brings the first hard feature, and the end screen, with no console errors. Then (v1.2, fresh-player run of
19 Nov: one session dealt the same Missing View item twice) a Free play session in the app at 390 x 844 on the
smallest pool of Missing View's starter band and of Hole Punch: the session guard is mounted at item:before,
no stem comes twice, and every logged seed rebuilds the item shown.
Screenshots: tests/e2e/out/starter_b/.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_starter_b.py [openings form patfold patviews]"""
import sys

from playwright.sync_api import sync_playwright

from common import OUT, ROOT, Checks, Console, launch, non_blank
from patb_common import PHONE, READY, STATE, fits, no_hscroll, page_url, report

C = Checks('harness_starter_b')
DIR = OUT / 'starter_b'
DIR.mkdir(parents=True, exist_ok=True)

SPECS = {  # ex: deps, stem, band params, Try 1 (seed, assist, selector), Try 2 (params, seed), Watch seed, mid-show-me wait (ms)
    'openings': dict(deps=(), stem='.op-stage', band='features:0,edges:0,keyview:0,pose:0,foils:0', try1=(104, {'trace': True}, '.op-ink .op-assist'),
                     try2=('features:0,edges:0,keyview:0,pose:0,foils:0', 239), demo=4, mid=('features:1,edges:0,keyview:0,pose:0,foils:0', 301, 6900)),
    'form': dict(deps=(), stem='.fm-stage', band='solid:0,marks:0,view:0,foil:0', try1=(12, {'letters': True}, '.fm-svg .fm-labels .fm-tag'),
                 try2=('solid:0,marks:0,view:0,foil:0', 207), demo=5, mid=('solid:0,marks:1,view:0,foil:0', 303, 12800)),
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
        f = page.evaluate("() => { const s = document.querySelector('svg.fm-foldup'); return { shown: s && s.style.display !== 'none', faces: s ? s.querySelectorAll('path.px-fig-face').length : 0 }; }")
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


APP_READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
EXAMPLE_BEFORE = {'openings': 3, 'form': 3, 'patviews': 3, 'patfold': 4}  # the Try item with the worked example


def wtg_app(b, cons, ex):
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, **PHONE)
    page = ctx.new_page()
    con = Console(page)
    cons.append(con)
    page.goto((ROOT / 'index.html').as_uri())
    page.wait_for_function(APP_READY, timeout=20000)
    for _ in range(4):  # the Chimera welcome, then the first-run tour offer
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(120)
    page.evaluate('PX.debug.fast(true)')
    page.evaluate('(id) => { void PX.core.router.go("play", { mode: "watch", exId: id }, { force: true }); }', ex)
    page.wait_for_selector('[data-card-box="wtg-rules"]', timeout=8000)
    n = page.locator('[data-card-box="wtg-rules"] .pl-rule').count()
    C.ok(2 <= n <= 4, f'{ex} app: Watch, Try, Go opens with the rules card ({n} rules)')
    page.screenshot(path=str(DIR / f'{ex}_app_rules_360.png'))
    page.locator('[data-card-box="wtg-rules"] [data-card="watch"]').tap()
    texts, strategy, idle = [], False, 0
    for _ in range(900):
        if page.locator('[data-card="session"]').count():
            break
        box = page.locator('[data-card-box]')
        cid = box.first.get_attribute('data-card-box') if box.count() else None
        t = page.evaluate("() => (document.querySelector('.pl-wtg-text') || {}).textContent || ''")
        if t and (not texts or texts[-1] != t):
            texts.append(t)
        if cid == 'wtg-strategy':
            if not strategy:
                page.screenshot(path=str(DIR / f'{ex}_app_strategy_360.png'))
            strategy = True
            page.locator('[data-card-box="wtg-strategy"] [data-card="try"]').tap()
        elif cid:
            page.locator(f'[data-card-box="{cid}"] [data-card]').first.tap()
        else:
            s = page.evaluate('__play.state')
            if s == 'respond':
                page.evaluate('() => __play.answer(true).catch(() => 0)')
                idle = 0
            elif s in ('reveal', 'showme'):
                page.evaluate('() => __play.next()')
                idle = 0
            else:
                nx = page.locator('[data-next]:visible')
                if nx.count():
                    nx.first.tap()
                    idle = 0
                else:
                    idle += 1
                    if idle > 150:  # 15 s with nothing to do: skip the running demo
                        sk = page.locator('[data-turn-skip]:visible')
                        if sk.count():
                            sk.first.tap()
                        idle = 0
        page.wait_for_timeout(100)
    end = page.locator('[data-card="session"]').count() == 1
    body = page.evaluate('() => document.body.innerText')
    C.ok(end and 'That was the tutorial' in body, f'{ex} app: Watch, Try, Go runs to its end screen, not skipped ({texts[-3:]})')
    tries = [x for x in texts if x.startswith('Try: practice item')]
    C.ok(strategy and len({x[:30] for x in tries}) == 4, f'{ex} app: the strategy card, then four Try items ({[x[:30] for x in tries]})')
    k = EXAMPLE_BEFORE[ex]
    pos = [i for i, x in enumerate(texts) if x.startswith('Try: first one more item')]
    C.ok(len(pos) == 1 and any(x.startswith(f'Try: practice item {k} of') for x in texts[pos[0] + 1:pos[0] + 4]) and not any(x.startswith(f'Try: practice item {k} of') for x in texts[:pos[0]]),
         f'{ex} app: one worked example, right before Try {k} ({[x[:34] for x in texts]})')
    page.screenshot(path=str(DIR / f'{ex}_app_end_360.png'))
    C.ok(not con.errors(), f'{ex} app: no console errors {con.errors()[:3]}')
    ctx.close()


# Free play at fixed settings with few stems (js/ex/patviews/gen.js fewStems): settings, items
SESSION = {'patviews': ({'cubes': 0, 'grid': 0, 'missing': 1, 'foil': 1}, 8), 'patfold': ({'folds': 1, 'idle': 0, 'sheets': 0, 'type': 3}, 6)}


def session_app(b, cons, ex):
    params, n = SESSION[ex]
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, **PHONE)
    page = ctx.new_page()
    con = Console(page)
    cons.append(con)
    page.goto((ROOT / 'index.html').as_uri())
    page.wait_for_function(APP_READY, timeout=20000)
    for _ in range(4):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(120)
    page.evaluate("""() => { const r = PX.core.store.state; r.tour = r.tour || { seen: {} }; r.tour.seen = r.tour.seen || {};
        PX.ex.list().forEach((d) => { r.tour.seen[d.id] = true; }); }""")
    ids = page.evaluate("PX.ui.hooks.list('item:before').map((h) => h.id)")
    C.ok('ex.session-fresh' in ids, f'{ex} session: the guard is mounted at item:before ({ids})')
    page.evaluate('PX.debug.fast(true)')
    page.evaluate("(a) => { void PX.core.router.go('play', { mode: 'free', exId: a.ex, run: '1', trials: a.n, params: a.p }, { force: true }); }", {'ex': ex, 'n': n, 'p': params})
    seen, idle = {}, 0
    for _ in range(600):
        st = page.evaluate('() => window.__play ? __play.state : "idle"')
        if st == 'respond':
            k = page.evaluate('() => __play.session ? __play.session.answered : -1')
            if k not in seen:
                seen[k] = page.evaluate('(id) => PX.ex.get(id).lib.stemSig(__play.item)', ex)
            page.evaluate('() => __play.answer(true).catch(() => 0)')
            idle = 0
        elif st in ('reveal', 'showme'):
            page.evaluate('() => __play.next()')
            idle = 0
        else:
            if page.locator('[data-card="session"]').count() or (page.evaluate('() => !!(__play.session && __play.session.done)') if st != 'idle' else False):
                break
            btn = page.locator('[data-card-box] .px-btn--primary:visible')
            if btn.count():
                btn.first.tap()
                idle = 0
            else:
                idle += 1
                if idle > 100 and len(seen) >= n:
                    break
        page.wait_for_timeout(80)
    stems = [seen[k] for k in sorted(seen)]
    C.ok(len(stems) == n and len(set(stems)) == n, f'{ex} session: {len(stems)} items of {n}, {len(set(stems))} different stems')
    rows = page.evaluate("""(a) => { const L = PX.ex.get(a.ex).lib, def = PX.ex.get(a.ex);
        const rec = PX.core.store.state; // rows: [tSec, exIndex, modeIndex, paramsCode, seed, …]; idx.ex holds 'id@version'
        const at = rec.idx.ex.map((e, i) => (String(e).split('@')[0] === a.ex ? i : -1)).filter((i) => i >= 0);
        return rec.trials.filter((r) => at.includes(r[1])).map((r) => L.stemSig(def.generate(PX.rng(r[4]), Object.assign({}, a.p)))); }""", {'ex': ex, 'p': params})
    C.ok(sorted(rows) == sorted(stems), f'{ex} session: every logged seed rebuilds the item shown ({len(rows)} rows)')
    page.screenshot(path=str(DIR / f'{ex}_session_end_390.png'))
    C.ok(not con.errors(), f'{ex} session: no console errors {con.errors()[:3]}')
    ctx.close()


def main(which):
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        for ex in which:
            check(b, cons, ex)
            wtg_app(b, cons, ex)
            if ex in SESSION:
                session_app(b, cons, ex)
        b.close()
    return report(C, cons, {'screenshots': sorted(x.name for x in DIR.glob('*.png'))})


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:] or list(SPECS)))
