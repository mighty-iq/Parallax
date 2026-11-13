"""Shared E2E flow for the PAT-format exercises of builder B5 (Angles, Hole Punch, Painted Cubes).
Each tests/e2e/harness_<id>.py passes its own settings and checks; run those, not this file.

For every exercise: desktop 1366 × 768 and phone 390 × 844 (DPR 2, touch), light and dark, its
level settings: the stage is non-blank; its own stem checks; every option is drawn; a right answer
by keyboard and a wrong one by pointer (tap on the phone) score as expected and the truth shows in
words; show me runs to the end (keyboard S and the Show me button); no horizontal scroll on the
phone. At 360 × 640 (touch) the stem and every answer control fit in 560 px from the top of the
stem (the app's status strip takes the rest) and every answer target is at least 44 px. The demo
plays to the end with captions. The harness inlined into a sandboxed srcdoc iframe renders and
plays by keyboard. No console errors. Screenshots: tests/e2e/out/<id>/. """
from playwright.sync_api import sync_playwright

from common import OUT, ROOT, Checks, Console, child_frame, file_url, inline_page, launch, non_blank, srcdoc_host

READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
PHONE = {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True}


class Pat:
    def __init__(self, ex, sets, deps=(), stem_check=None, option_check=None, showme_check=None):
        self.ex, self.sets, self.deps = ex, sets, list(deps)
        self.stem_check, self.option_check, self.showme_check = stem_check, option_check, showme_check
        self.C = Checks(f'harness_{ex}')
        self.dir = OUT / ex
        self.dir.mkdir(parents=True, exist_ok=True)

    # The page: the dev harness on file://; with dependencies (Hole Punch needs Fold's gen.js) the
    # harness is inlined with them into one file under tests/e2e/out/<id>/ and opened from disk.
    def url(self, seed, params, **extra):
        q = dict(seed=seed, p=params, fast=1, **extra)
        if not self.deps:
            return file_url('tests/dev/harness.html', ex=self.ex, **q)
        files = self.deps + [f'js/ex/{self.ex}/{f}' for f in ('gen.js', 'learn.js', 'view.js')]
        cfg = dict(q, ex=self.ex, inlinedCss=True)
        cfg['fast'] = bool(cfg.get('fast'))
        html = inline_page('tests/dev/harness.html', extra_scripts=files, cfg=cfg, extra_css=[f'css/ex/{self.ex}.css'])
        name = f'_page_{seed}_{abs(hash(str(sorted(q.items())))) % 100000}.html'
        path = self.dir / name
        path.write_text(html, encoding='utf-8')
        return path.as_uri()

    def single(self, seed, params):
        files = self.deps + [f'js/ex/{self.ex}/{f}' for f in ('gen.js', 'learn.js', 'view.js')]
        cfg = dict(seed=seed, p=params, fast=True, ex=self.ex, inlinedCss=True)
        return inline_page('tests/dev/harness.html', extra_scripts=files, cfg=cfg, extra_css=[f'css/ex/{self.ex}.css'])

    def shot(self, target, name):
        target.screenshot(path=str(self.dir / name))

    def stage_ok(self, target, tag):
        ok, s = non_blank(target.locator(f'.ex-{self.ex}-stage').screenshot(), min_distinct=4, max_top=0.985)
        self.C.ok(ok, f'{tag}: the stage shows the item ({s})')

    def options_ok(self, target, tag):
        n = target.evaluate('() => __harness.item.options.length')
        cells = target.locator('.hx-grid .px-choice')
        self.C.ok(cells.count() == n, f'{tag}: one answer per option ({cells.count()} of {n})')
        pix = [non_blank(cells.nth(i).screenshot(), min_distinct=3, max_top=0.995)[0] for i in range(n)]
        self.C.ok(all(pix), f'{tag}: every option is drawn ({pix})')
        if self.option_check:
            self.option_check(self.C, target, tag)

    def answer_keyboard(self, page, frame, tag):
        key = frame.evaluate('() => __harness.key')
        page.keyboard.press(str(key + 1))
        frame.wait_for_function(STATE, arg='reveal', timeout=10000)
        r = frame.evaluate('() => __harness.last')
        self.C.ok(r['result']['correct'] is True and r['source'] == 'key', f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')

    def answer_pointer(self, frame, tag, tap=False):
        h = frame.evaluate('() => ({ key: __harness.key, n: __harness.item.options.length })')
        cells = frame.locator('.hx-grid .px-choice')
        wrong = (h['key'] + 1) % h['n']
        (cells.nth(wrong).tap() if tap else cells.nth(wrong).click())
        frame.wait_for_function(STATE, arg='reveal', timeout=10000)
        r = frame.evaluate('() => __harness.last')
        self.C.ok(r['result']['correct'] is False and r['source'] == 'pointer', f'{tag}: a wrong answer by pointer scores wrong ({r["result"]}, {r["source"]})')
        verdict = frame.evaluate(f"() => (document.querySelector('.ex-{self.ex}-verdict:not([hidden])') || {{}}).textContent || ''")
        self.C.ok('✓' in verdict and len(verdict) > 12, f'{tag}: the truth in words ({verdict!r})')

    def show_me(self, frame, tag, page=None, click=None):
        before = frame.evaluate('() => __harness.played.finished')
        if click is not None:
            click.click()
        elif page is not None:
            page.keyboard.press('s')
        else:
            frame.evaluate('() => { __harness.showMe(); }')
        frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=40000)
        self.C.ok(True, f'{tag}: show me ran to the end ({frame.evaluate("() => __harness.played.ms")} ms)')
        if self.showme_check:
            self.showme_check(self.C, frame, tag)

    def views(self, b, cons):
        for vp, tag, kw in [((1366, 768), '1366', {}), ((390, 844), '390', PHONE)]:
            ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
            page = ctx.new_page()
            cons.append(Console(page))
            phone = tag == '390'
            for name0, params, seed in self.sets:
                for theme in ('light', 'dark'):
                    name = f'{self.ex}_{name0}_{tag}_{theme}'
                    page.goto(self.url(seed, params, theme=theme))
                    page.wait_for_function(READY, timeout=30000)
                    self.stage_ok(page, name)
                    if self.stem_check:
                        self.stem_check(self.C, page, name)
                    self.options_ok(page, name)
                    self.shot(page, name + '.png')
                    if phone:
                        sw = page.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
                        self.C.ok(sw[0] <= sw[1], f'{name}: no horizontal scroll ({sw})')
                    if theme == 'light':
                        self.answer_keyboard(page, page, name)
                        self.shot(page, name + '_reveal.png')
                        self.show_me(page, name, page=page)
                        page.keyboard.press('Space')
                        page.wait_for_function(READY, timeout=10000)
                        self.answer_pointer(page, name, tap=phone)
                        self.shot(page, name + '_wrong.png')
                        self.show_me(page, name + ' (Show me button)', click=page.locator('.hx-feedback-actions .px-btn').first)
                    else:
                        page.evaluate('() => __harness.answer(false)')
                        page.wait_for_function(STATE, arg='reveal', timeout=10000)
                        self.shot(page, name + '_reveal.png')
                    errs = page.evaluate('() => __harness.errors')
                    self.C.ok(not errs, f'{name}: no harness errors ({errs})')
            ctx.close()

    # At 360 × 640 the stem and every answer fit within 568 px from the top of the stem (the player's
    # --pl-avail at that size: 640 − the 48 px status strip − three 8 px gaps), with empty captions
    # hidden as the player hides them, and every answer target is at least 44 × 44 px (rule 8).
    # The app-level check is tests/e2e/fit.py (B2), which plays these exercises in the player.
    def fit(self, b, cons):
        ctx = b.new_context(viewport={'width': 360, 'height': 640}, **PHONE)
        page = ctx.new_page()
        cons.append(Console(page))
        for name0, params, seed in self.sets:
            page.goto(self.url(seed, params))
            page.wait_for_function(READY, timeout=30000)
            page.add_style_tag(content='.ex-caption:empty { display: none; }')
            d = page.evaluate(f"""() => {{
                const stem = document.querySelector('.ex-{self.ex}-stem').getBoundingClientRect();
                const opts = Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((e) => e.getBoundingClientRect());
                const bottom = Math.max(...opts.map((r) => r.bottom)), stage = document.querySelector('.ex-{self.ex}-stage').getBoundingClientRect();
                return {{ span: Math.round(bottom - stem.top), stage: [Math.round(stage.width), Math.round(stage.height)],
                         minW: Math.round(Math.min(...opts.map((r) => r.width))), minH: Math.round(Math.min(...opts.map((r) => r.height))),
                         right: Math.round(Math.max(...opts.map((r) => r.right))) }};
            }}""")
            self.C.ok(d['span'] <= 568, f'{self.ex} {name0} at 360×640: stem and answers within 568 px ({d})')
            self.C.ok(d['minW'] >= 44 and d['minH'] >= 44 and d['right'] <= 360, f'{self.ex} {name0} at 360×640: answer targets ≥ 44 px, inside the screen ({d})')
            page.evaluate("() => { const s = document.querySelector('.ex-%s-stem'); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 8); }" % self.ex)
            self.shot(page, f'{self.ex}_{name0}_360x640.png')
        ctx.close()

    def demo(self, b, cons, params, seed):
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
        page = ctx.new_page()
        cons.append(Console(page))
        page.goto(self.url(seed, params))
        page.wait_for_function(READY, timeout=30000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.demo(); }')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=30000)
        cap = page.locator('.hx-caption').inner_text()
        self.C.ok(len(cap) > 10, f'the demo plays to the end with captions ({cap!r})')
        ctx.close()

    def sandboxed(self, b, cons, params, seed):
        host = srcdoc_host(f'harness_{self.ex}', self.single(seed, params))
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
        page = ctx.new_page()
        cons.append(Console(page))
        page.goto(host.as_uri())
        fr = child_frame(page)
        fr.wait_for_function(READY, timeout=60000)
        env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
        self.C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc: runs in a sandboxed srcdoc frame ({env})')
        self.stage_ok(fr, 'srcdoc')
        self.options_ok(fr, 'srcdoc')
        fr.locator('.hx-goal').click()
        self.answer_keyboard(page, fr, 'srcdoc')
        self.show_me(fr, 'srcdoc', page=page)
        self.shot(page, f'{self.ex}_srcdoc.png')
        errs = fr.evaluate('() => __harness.errors')
        self.C.ok(not errs, f'srcdoc: no harness errors ({errs})')
        ctx.close()

    def run(self, demo, sandbox):
        cons = []
        with sync_playwright() as p:
            b = launch(p)
            self.views(b, cons)
            self.fit(b, cons)
            self.demo(b, cons, *demo)
            self.sandboxed(b, cons, *sandbox)
            b.close()
        errors = [e for c in cons for e in c.errors()]
        self.C.ok(not errors, f'no console errors ({errors[:5]})')
        for f in self.dir.glob('_page_*.html'):
            f.unlink()
        return self.C.summary({'screenshots': sorted(p.name for p in self.dir.glob(f'{self.ex}_*.png'))})
