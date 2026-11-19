"""Shared E2E checks of the v1.2 starter band for Views, Angles and Painted Cubes (builder W1-band-A;
docs/research/v1.2/D2-first-band.md §3.1–3.3, CONTRACT-v1.2 D). Imported by tests/e2e/harness_views.py,
harness_angles.py and harness_cubes.py; run those, not this file.

At 360 × 640 (touch, DPR 2), on the dev harness:
- every starter-band item given fits: the stem and every answer within 568 px from the top of the
  stem (the player's --pl-avail at that size), every answer target at least 44 × 44 px, nothing past
  the right edge, no horizontal scroll; the stage shows the item;
- Try 1's first step done (`assist=1`: the first learn.practice entry's assist) draws what the
  exercise says (the caller's check) and the item still answers right by a tap on the key;
- the rules card (`rules=1`) shows every rule with a drawn figure (an SVG with marks);
- show me runs to the end on a starter-band item after a wrong tap;
- other Try items with a drawn help (`assists`: e.g. Painted Cubes' Try 3, its hidden cube dashed):
  what they draw before the answer and after it.
Screenshots: tests/e2e/out/<id>/<id>_band_*.png """
from common import Console, file_url, non_blank

READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
PHONE = {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True}


def band_checks(b, cons, C, ex, out_dir, items, assist_check=None, try1=None, extra_q=None, assists=None):
    """items: [(name, params, seed)] starter-band items; try1: (params, seed) of learn.practice[0];
    assist_check(C, page, tag): what Try 1's drawn step must show; extra_q: query fields (e.g. v);
    assists: [(name, params, seed, assist_json, before(C, page, tag), after(C, page, tag) or None)]."""
    q0 = dict(extra_q or {})
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, **PHONE)
    page = ctx.new_page()
    cons.append(Console(page))

    def goto(params, seed, **q):
        page.goto(file_url('tests/dev/harness.html', ex=ex, seed=seed, p=params, fast=1, **dict(q0, **q)))
        page.wait_for_function(READY, timeout=60000)

    def fit(tag):
        page.add_style_tag(content='.ex-caption:empty { display: none; }')
        d = page.evaluate(f"""() => {{
            const stem = document.querySelector('.ex-{ex}-stem').getBoundingClientRect();
            const opts = Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((e) => e.getBoundingClientRect());
            return {{ span: Math.round(Math.max(...opts.map((r) => r.bottom)) - stem.top),
                     minW: Math.round(Math.min(...opts.map((r) => r.width))), minH: Math.round(Math.min(...opts.map((r) => r.height))),
                     right: Math.round(Math.max(...opts.map((r) => r.right))), sw: document.documentElement.scrollWidth, iw: innerWidth }};
        }}""")
        C.ok(d['span'] <= 568, f'{tag} at 360×640: stem and answers within 568 px ({d})')
        C.ok(d['minW'] >= 44 and d['minH'] >= 44 and d['right'] <= 360 and d['sw'] <= d['iw'], f'{tag} at 360×640: answer targets ≥ 44 px, inside the screen, no horizontal scroll ({d})')
        ok, s = non_blank(page.locator(f'.ex-{ex}-stage').screenshot(), min_distinct=4, max_top=0.985)
        C.ok(ok, f'{tag}: the stage shows the item ({s})')
        page.evaluate("() => { const s = document.querySelector('.ex-%s-stem'); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 8); }" % ex)

    for name, params, seed in items:
        tag = f'{ex} starter band {name}'
        goto(params, seed)
        fit(tag)
        page.screenshot(path=str(out_dir / f'{ex}_band_{name}_360x640.png'))
        # a wrong tap, then show me to the end
        h = page.evaluate('() => ({ key: __harness.key, n: __harness.item.options.length })')
        page.locator('.hx-grid .px-choice').nth((h['key'] + 1) % h['n']).tap()
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=60000)
        C.ok(True, f'{tag}: show me runs to the end after a wrong tap')
        page.screenshot(path=str(out_dir / f'{ex}_band_{name}_showme.png'))
        errs = page.evaluate('() => __harness.errors')
        C.ok(not errs, f'{tag}: no harness errors ({errs})')

    if try1:
        params, seed = try1
        tag = f'{ex} Try 1 (first step done)'
        goto(params, seed, assist='1')
        if assist_check:
            assist_check(C, page, tag)
        fit(tag)
        page.screenshot(path=str(out_dir / f'{ex}_band_try1_assist_360x640.png'))
        key = page.evaluate('() => __harness.key')
        page.locator('.hx-grid .px-choice').nth(key).tap()
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        r = page.evaluate('() => __harness.last')
        C.ok(r['result']['correct'] is True, f'{tag}: a tap on the key still scores right ({r["result"]})')
        page.screenshot(path=str(out_dir / f'{ex}_band_try1_reveal.png'))

    for name, params, seed, assist_json, before, after in (assists or []):
        tag = f'{ex} {name} (help drawn: {assist_json})'
        goto(params, seed, assist=assist_json)
        before(C, page, tag)
        fit(tag)
        page.screenshot(path=str(out_dir / f'{ex}_band_{name}_assist_360x640.png'))
        key = page.evaluate('() => __harness.key')
        page.locator('.hx-grid .px-choice').nth(key).tap()
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        if after:
            after(C, page, tag)
        page.screenshot(path=str(out_dir / f'{ex}_band_{name}_reveal.png'))

    goto(items[0][1], items[0][2], rules='1')
    d = page.evaluate("""() => {
        const card = document.querySelector('.hx-rules');
        const li = card ? Array.from(card.querySelectorAll('.pl-rule')) : [];
        return { hidden: !card || card.hidden, n: li.length, want: (PX.ex.learn(__harness.item.ex) || {}).rules.length,
                 figs: li.map((x) => { const s = x.querySelector('svg'); return s ? s.querySelectorAll('path, line, circle, text').length : 0; }),
                 sizes: li.map((x) => { const f = x.querySelector('.pl-rule-fig'); return f ? Math.round(f.getBoundingClientRect().width) : 0; }) };
    }""")
    C.ok(not d['hidden'] and d['n'] == d['want'] and all(f >= 2 for f in d['figs']), f'{ex}: the rules card shows every rule with a drawn figure ({d})')
    page.locator('.hx-rules').screenshot(path=str(out_dir / f'{ex}_band_rules_360x640.png'))
    errs = page.evaluate('() => __harness.errors')
    C.ok(not errs, f'{ex} rules card: no harness errors ({errs})')
    ctx.close()


INDEX_READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'


def wtg_checks(b, cons, C, ex, out_dir, assist_selector, n_rated=5, try_marks=None):
    """The app's Watch, Try, Go for one exercise, scripted end to end at 390 × 844 (touch): the rules
    card with every rule's figure, the Watch, the strategy card (strategyFirst), Try 1 with its first
    step done (assist_selector is on screen), every Try item (and a worked example where learn.js asks
    for one), the end screen (Go, with the Chimera link), then a session's first n_rated scored items,
    every answer right; screenshots at each stage; no errors."""
    from common import ROOT
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, **PHONE)
    page = ctx.new_page()
    con = Console(page)
    cons.append(con)
    page.goto((ROOT / 'index.html').as_uri())
    page.wait_for_function(INDEX_READY, timeout=30000)
    for _ in range(4):  # the Chimera welcome, then the tour offer
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
    page.evaluate('PX.debug.fast(true)')
    page.evaluate('PX.core.store.state.settings.patFocus = true')  # the DAT-style formats are opt-in
    # wave 2's hooks (the baseline after a first tutorial, bets, plateau cards) have their own tests: muted here
    page.evaluate('PX.ui.hooks && PX.ui.hooks.mute(true)')
    page.evaluate(f'void PX.core.router.go("play", {{ mode: "watch", exId: "{ex}" }}, {{ force: true }})')
    tag = f'{ex} Watch, Try, Go (app, 390×844)'
    page.wait_for_selector('[data-card-box="wtg-rules"]', timeout=15000)
    d = page.evaluate(f"""() => ({{ rules: document.querySelectorAll('[data-card-box="wtg-rules"] .pl-rule').length, want: PX.ex.learn('{ex}').rules.length,
        figs: Array.from(document.querySelectorAll('[data-card-box="wtg-rules"] .pl-rule-fig')).map((f) => f.querySelectorAll('svg path, svg line, svg circle').length) }})""")
    C.ok(d['rules'] == d['want'] and len(d['figs']) == d['want'] and all(f >= 2 for f in d['figs']), f'{tag}: the rules card shows every rule with its figure ({d})')
    page.screenshot(path=str(out_dir / f'{ex}_wtg_1_rules.png'))
    page.locator('[data-card-box="wtg-rules"] [data-card="watch"]').tap()
    page.wait_for_function('document.querySelector("[data-turn-skip]") || __play.state === "respond"', timeout=30000)
    page.screenshot(path=str(out_dir / f'{ex}_wtg_2_watch_end.png'))
    page.evaluate('__play.answer(true)')
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=10000)
    page.evaluate('PX.ui.play.current().goNext()')
    page.wait_for_selector('[data-card-box="wtg-strategy"]', timeout=10000)
    title = page.evaluate(f"""() => {{ const L = PX.ex.learn('{ex}'), c = L.strategies.find((s) => s.id === L.strategyFirst);
        return [document.querySelector('[data-card-box="wtg-strategy"]').textContent, c.title]; }}""")
    C.ok(title[1] in title[0], f'{tag}: the strategy card before Try 1 is "{title[1]}"')
    page.screenshot(path=str(out_dir / f'{ex}_wtg_3_strategy.png'))
    page.locator('[data-card-box="wtg-strategy"] [data-card="try"]').tap()
    page.wait_for_function('__play.state === "respond"', timeout=15000)
    on = page.evaluate(f'() => !!document.querySelector({assist_selector!r})')
    C.ok(on, f'{tag}: Try 1 shows its first step done ({assist_selector})')
    page.screenshot(path=str(out_dir / f'{ex}_wtg_4_try1.png'))
    tries, examples, rated, guard, ended = 0, 0, 0, 0, False
    while rated < n_rated and guard < 80:
        guard += 1
        txt = page.evaluate('(document.querySelector(".pl-wtg-text") || {}).textContent || ""')
        if not ended and page.locator('[data-card="session"]').count() and page.locator('[data-card="session"]').first.is_visible():
            # Go: the tutorial's end screen (step 3), with the Chimera invitation; then a session
            ended = True
            end = page.evaluate("""() => ({ head: (document.querySelector('h1') || {}).textContent || '',
                link: Array.from(document.querySelectorAll('a[href="https://discord.gg/chmr"]')).some((a) => a.getClientRects().length > 0) })""")
            C.ok(tries == 4 and end['link'], f'{tag}: after the four Try items the end screen ("{end["head"]}") invites to Chimera with the link ({end})')
            page.screenshot(path=str(out_dir / f'{ex}_wtg_6_end.png'))
            page.locator('[data-card="session"]').first.tap()
            page.wait_for_timeout(400)
            continue
        if page.evaluate('!!document.querySelector("[data-turn-skip]")') and page.locator('[data-turn-skip]').first.is_visible():
            examples += 1 if 'one more item' in txt else 0
            page.locator('[data-turn-skip]').first.tap()
            page.wait_for_timeout(200)
            continue
        st = page.evaluate('__play.state')
        if st == 'respond':
            if txt.startswith('Try: practice item'):
                tries += 1
                page.screenshot(path=str(out_dir / f'{ex}_wtg_try{tries}.png'))
                sel = (try_marks or {}).get(tries)
                if sel:
                    C.ok(page.evaluate(f'() => !!document.querySelector({sel!r})'), f'{tag}: Try {tries} draws its help ({sel})')
            else:
                rated += 1
            page.evaluate('__play.answer(true)')
            page.wait_for_function('__play.state === "reveal" || __play.state === "showme" || __play.state === "idle"', timeout=10000)
            if tries == 4 and rated == 0:
                page.screenshot(path=str(out_dir / f'{ex}_wtg_5_try4.png'))
            page.evaluate('PX.ui.play.current() && PX.ui.play.current().goNext()')
            page.wait_for_timeout(250)
            continue
        cards = page.evaluate('Array.from(document.querySelectorAll("[data-card-box] [data-card]")).filter((e) => e.offsetParent).map((e) => e.getAttribute("data-card"))')
        if cards:
            pick = next((c for c in ('go', 'start', 'try', 'continue', 'next') if c in cards), cards[0])
            page.locator(f'[data-card-box] [data-card="{pick}"]').first.tap()
            page.wait_for_timeout(250)
            continue
        page.wait_for_timeout(300)
    C.ok(tries == 4, f'{tag}: four Try items ({tries}; worked examples {examples})')
    C.ok(ended and rated >= n_rated, f'{tag}: then a session from the end screen, {n_rated} scored items answered ({rated})')
    page.screenshot(path=str(out_dir / f'{ex}_wtg_7_go.png'))
    page.evaluate('__play.end()')
    page.wait_for_timeout(500)
    C.ok(not con.errors(), f'{tag}: no console errors ({con.errors()[:3]})')
    ctx.close()


TILE_GEOM = """(ex) => {
    // positions relative to the top of the trial (the exercise's own layout; what moves the trial
    // itself is the player's)
    const tr = document.querySelector('.pl-trial'), t0 = tr ? tr.getBoundingClientRect().top : 0, y = -t0;
    const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top + y), Math.round(b.right), Math.round(b.bottom + y)]; };
    const tiles = Array.from(document.querySelectorAll('.pl-trial .px-choice')).map(r);
    const stage = document.querySelector('.pl-trial .ex-' + ex + '-stage, .pl-trial .ex-angles-cells');
    const cover = [];
    document.querySelectorAll('.pl-trial .px-choice').forEach((c, i) => {
        const t = c.querySelector('.ex-tag:not([hidden]):not(.is-pending)'), d = c.querySelector('.ex-views-svg, .ex-thumb');
        if (!t || !d) return;
        const a = t.getBoundingClientRect(), b = d.getBoundingClientRect();
        // the drawn part of a drawing: its svg's content box (the drawing is centred in it)
        const ov = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (ov > 4) cover.push([i, Math.round(ov)]);
    });
    return { tiles, stage: stage ? r(stage) : null, scrollY: Math.round(scrollY), trialTop: Math.round(t0 + scrollY), cover };
}"""


def reveal_stable(b, cons, C, ex, out_dir, sizes=((360, 640), (390, 844), (1366, 768))):
    """The reveal reserves its room from the start (W1-core's 18:15 requests, the Views fresh test): in
    the app's Train, after a right and after a wrong answer, every answer tile keeps its top and
    bottom (page coordinates, ±1 px) and no tag covers a drawing."""
    from common import ROOT
    for w, hgt in sizes:
        phone = w < 720
        ctx = b.new_context(viewport={'width': w, 'height': hgt}, **(PHONE if phone else {}))
        page = ctx.new_page()
        con = Console(page)
        cons.append(con)
        page.goto((ROOT / 'index.html').as_uri())
        page.wait_for_function(INDEX_READY, timeout=30000)
        for _ in range(4):
            if not page.evaluate('PX.ui.modalOpen()'):
                break
            page.keyboard.press('Escape')
            page.wait_for_timeout(150)
        page.evaluate('PX.core.store.state.settings.patFocus = true')
        page.evaluate('PX.debug.fast(true)')
        # wave 2's hooks (baselines, bets, plateau cards) have their own tests: muted here, as play.py does
        page.evaluate('PX.ui.hooks && PX.ui.hooks.mute(true)')
        page.evaluate(f'void PX.core.router.go("play", {{ mode: "train", exId: "{ex}" }}, {{ force: true }})')
        page.wait_for_timeout(600)
        if page.locator('[data-card="skip"]').count() and page.locator('[data-card="skip"]').first.is_visible():
            page.locator('[data-card="skip"]').first.click()  # a new player is offered the tutorial first
        for k, right in enumerate((True, False, True)):
            page.wait_for_function('window.__play && __play.state === "respond"', timeout=30000)
            page.wait_for_timeout(250)
            before = page.evaluate(TILE_GEOM, ex)
            page.evaluate(f'__play.answer({"true" if right else "false"})')
            page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=10000)
            page.wait_for_timeout(300)
            after = page.evaluate(TILE_GEOM, ex)
            tag = f'{ex} at {w}×{hgt}, item {k + 1} ({"right" if right else "wrong"} answer)'
            moved = [(i, a, z) for i, (a, z) in enumerate(zip(before['tiles'], after['tiles'])) if abs(a[1] - z[1]) > 1 or abs(a[3] - z[3]) > 1]
            C.ok(len(before['tiles']) > 0 and not moved, f'{tag}: the reveal keeps every answer tile in place in the trial ({moved[:2] or "same"}; the trial itself {before["trialTop"]}→{after["trialTop"]}, scroll {before["scrollY"]}→{after["scrollY"]})')
            if before['trialTop'] != after['trialTop']:
                print(f'  note: {tag}: the trial itself moved {before["trialTop"]}→{after["trialTop"]} (the player)', flush=True)
            C.ok(not after['cover'], f'{tag}: no tag covers a drawing ({after["cover"]})')
            if k == 1:
                page.screenshot(path=str(out_dir / f'{ex}_reveal_{w}x{hgt}.png'))
            page.evaluate('PX.ui.play.current() && PX.ui.play.current().goNext()')
            page.wait_for_timeout(300)
        page.evaluate('__play.end()')
        page.wait_for_timeout(300)
        C.ok(not con.errors(), f'{ex} reveal checks at {w}×{hgt}: no console errors ({con.errors()[:3]})')
        ctx.close()
