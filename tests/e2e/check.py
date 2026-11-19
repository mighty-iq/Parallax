"""E2E: Design A's measurement in the app (PLAN milestone 6; js/ui/measure.js, js/ui/check.js, js/engine/assess.js).

- Today, fresh: the Spatial Check slot (in place of 1.1's) names the starting point and offers it now.
- A first Train session: after the first exercise's Watch, Try, Go offer, B1 is offered before the first item
  (item:before), with the session clock paused; the expectation question once; per task its card (and worked
  example on first contact); no feedback; the done card; B1 saved with its items, probe versions and the
  session kind 'baseline'; its time is not practice time.
- 13 hours later: Today says Baseline 2 opens the next session; the session start offers it (session:start), with
  the outside-practice question; then, after counted training and 9 more hours, a short check opens the session
  (8 items while Other Way Round and Motion Graphs are not built), and the session summary shows the meter.
- Progress: the measurement panel in place of 1.1's check section (its id kept for the jump links), with the meter
  and the rung rows; Settings: Measurement week after Training (the setting and its event); the Lab: the ladder.
- The check screen on its own (play?mode=check&kind=week): its intro card and Later.
- Phones (390 x 844 and 360 x 640): Today's slot and the Progress panel, no horizontal scroll.
Screenshots: tests/e2e/out/check/. Run: tests/e2e/pwslot.sh python3 tests/e2e/check.py
"""
import json, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import launch, Console, Checks, OUT as OUT_ROOT
from play import boot, go, card, click_card, drive, wait_state, seen_all

OUT = OUT_ROOT / 'check'
OUT.mkdir(parents=True, exist_ok=True)
HOUR = 3600 * 1000

SHIFT_JS = '''(ms) => {
  if (!window.__realNow) { window.__realNow = Date.now.bind(Date); window.__shift = 0; Date.now = () => window.__realNow() + window.__shift; }
  window.__shift += ms;
  return Date.now();
}'''
TRAIN_JS = '''(min) => {
  const r = PX.core.store.state, t = Date.now() - (min + 1) * 60000;
  r.sessions.push({ id: 'e2e-' + t, start: t, end: t + min * 60000, mode: 'train', trials: 60, right: 45, practiceMs: min * 60000, exs: ['rotate'] });
  PX.core.store.save();
  return r.sessions.length;
}'''


def until_card(page, cid, ms=15000):
    page.wait_for_selector(f'[data-card-box="{cid}"]', timeout=ms)


def play_measurement(page, done='measure-done'):
    """Plays a measurement to its done card (or the check screen's end): skips the questions, shows examples."""
    return drive(page, f'!!document.querySelector(\'[data-card-box="{done}"]\') || !!document.querySelector(".pl-summary")',
                 cards={'expect': 'skip', 'overlap': 'skip'}, limit=900, right=0.65)


def to_item(page, ms=30000):
    """Goes on to the session's next item: skips a Watch, Try, Go offer, takes any other card's primary button."""
    for _ in range(ms // 150):
        if page.evaluate('__play.state') == 'respond' and not card(page):
            return True
        cid = card(page)
        if cid == 'wtg-offer':
            click_card(page, 'skip')
        elif cid:
            prim = page.locator('[data-card-box] .px-btn--primary')
            if prim.count():
                prim.first.click()
        nb = page.locator('.ex-track-notice:not([hidden]) .px-btn')
        if nb.count() and nb.first.is_visible():
            nb.first.click()
        page.wait_for_timeout(150)
    return False


def show_check_tab(page):
    """Progress may show one section at a time (phones, W3-phones' O20 tabs): pick the Spatial Check's."""
    page.wait_for_selector('.px-ms-progress', state='attached', timeout=8000)
    jump = page.locator('[data-jump="check"]')
    if not page.locator('.px-ms-progress').is_visible() and jump.count():
        jump.first.click()
    page.wait_for_selector('.px-ms-progress', timeout=8000)


def no_hscroll(page):
    return page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')


def desktop(b, C):
    tag = 'desktop'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    page.evaluate('PX.ui.hooks.mute(false)')  # play.boot mutes every builder's hooks; this suite tests them
    # Motion Graphs' background question, whenever its first card shows: tap "A little" (drive then takes the card's primary)
    page.evaluate('''new MutationObserver(() => { const b = document.querySelector('[data-background-answer="some"][aria-pressed="false"]');
      if (b && !window.__bgTapped) { window.__bgTapped = 1; b.click(); } }).observe(document.body, { childList: true, subtree: true })''')
    page.evaluate('void PX.core.router.go("home")')
    page.wait_for_selector('.px-today', timeout=8000)
    slot = page.locator('.px-today > [data-measure]')
    C.ok(slot.count() == 1 and slot.get_attribute('data-measure') == 'B1' and slot.get_attribute('data-slot') == 'check'
         and page.locator('.px-today > .px-slot--check').count() == 1, f'{tag}: Today\'s Spatial Check slot is the measurement\'s, in place of 1.1\'s')
    C.ok('Starting point' in slot.inner_text() and 'Take baseline 1 now' in slot.inner_text(), f'{tag}: it names the starting point and offers it now')
    page.screenshot(path=str(OUT / 'today_b1_1366.png'))

    # the first Train session: Watch, Try, Go offer skipped, then B1 before the first item
    go(page, {'mode': 'train'})
    page.wait_for_function('!!document.querySelector("[data-card-box]")', timeout=10000)
    if card(page) == 'wtg-offer':
        click_card(page, 'skip')
    until_card(page, 'measure-offer')
    txt = page.locator('[data-card-box="measure-offer"]').inner_text()
    C.ok('Baseline 1' in txt and 'minutes' in txt, f'{tag}: B1 is offered before the first item ({txt[:80]!r})')
    page.screenshot(path=str(OUT / 'b1_offer_1366.png'))
    practice0 = page.evaluate('PX.core.store.state.practiceMs || 0')
    click_card(page, 'start')
    until_card(page, 'expect')
    C.ok(page.locator('[data-card-box="expect"] [data-expect]').count() == 5, f'{tag}: the expectation question once, five taps')
    page.locator('[data-card-box="expect"] [data-expect="3"]').click()
    page.wait_for_timeout(150)
    C.ok(page.evaluate('PX.core.store.state.spatial.expect && PX.core.store.state.spatial.expect.value') == 3, f'{tag}: the answer is kept')
    ok = play_measurement(page)
    C.ok(ok and card(page) == 'measure-done', f'{tag}: B1 played to its done card')
    page.screenshot(path=str(OUT / 'b1_done_1366.png'))
    a = page.evaluate('''(() => { const r = PX.core.store.state, e = r.assess[0] || {}, s = r.sessions[r.sessions.length - 1] || {};
      return { n: r.assess.length, kind: e.kind, form: e.form, form0: r.measure.form0, items: Object.keys(e.items || {}).length, results: Object.keys(e.results || {}).length,
        pv: Object.keys(e.pv || {}).length, rows: Object.values(e.items || {}).every((x) => x.every((y) => y.length === 4)), skind: s.kind, smode: s.mode, late: !!e.late,
        practice: r.practiceMs || 0 }; })()''')
    C.ok(a['n'] == 1 and a['kind'] == 'B1' and a['form'] == a['form0'] and a['form0'] in ('A', 'B', 'C'), f'{tag}: B1 saved on the record\'s first form ({a})')
    C.ok(a['items'] == a['results'] == a['pv'] and a['items'] >= 5 and a['rows'], f'{tag}: items [b, g, ok, rtMs] and the version of every probe')
    C.ok(a['skind'] == 'baseline' and a['smode'] == 'check' and not a['late'], f'{tag}: its session is marked baseline; not late')
    C.ok(a['practice'] == practice0, f'{tag}: the measurement is not practice time')
    click_card(page, 'go')
    to_item(page)
    C.ok(page.evaluate('PX.core.store.state.assess.length') == 1, f'{tag}: back to the session\'s first item')
    page.evaluate('__play.end()')
    page.wait_for_function('!!document.querySelector(".pl-summary")', timeout=10000)
    C.ok(page.locator('.px-ms-summary').count() == 1, f'{tag}: the summary names the measurement')

    # 13 hours later: B2 opens the next session
    page.evaluate(SHIFT_JS, 13 * HOUR)
    page.evaluate('void PX.core.router.go("home", null, { force: true })')
    page.wait_for_selector('.px-today', timeout=8000)
    slot = page.locator('.px-today > [data-measure]')
    C.ok(slot.get_attribute('data-measure') == 'B2' and 'Baseline 2 opens your next session' in slot.inner_text(), f'{tag}: Today: Baseline 2 opens the next session')
    line = page.locator('.px-slot--session').inner_text()
    C.ok('second starting point' in line, f'{tag}: today:session says why the session opens with it')
    go(page, {'mode': 'train'})
    until_card(page, 'measure-offer')
    C.ok('Baseline 2' in page.locator('[data-card-box="measure-offer"]').inner_text(), f'{tag}: session:start offers B2')
    click_card(page, 'start')
    until_card(page, 'overlap')
    C.ok(page.locator('[data-card-box="overlap"] [data-overlap-answer]').count() == 3, f'{tag}: the outside-practice question before a later full check')
    page.locator('[data-card-box="overlap"] [data-overlap-answer="no"]').click()
    ok = play_measurement(page)
    e2 = page.evaluate('(() => { const e = PX.core.store.state.assess[1] || {}; return { kind: e.kind, ov: e.overlapAnswer || null }; })()')
    C.ok(ok and e2 == {'kind': 'B2', 'ov': 'no'}, f'{tag}: B2 saved with the answer ({e2})')
    bg = page.evaluate("PX.engine.events.list(PX.core.store.state, { kind: 'background', exId: 'motiongraphs' }).map((e) => e.data)")
    C.ok(bg == [{'q': 'motion-graphs', 'a': 'some'}], f'{tag}: Motion Graphs\' background question asked once, its tap kept ({bg})')
    click_card(page, 'go')
    to_item(page)
    page.evaluate('__play.end()')
    page.wait_for_function('!!document.querySelector(".pl-summary")', timeout=10000)

    # counted training, 9 hours on: a short check opens the session; the summary shows the meter
    page.evaluate(TRAIN_JS, 30)
    page.evaluate(SHIFT_JS, 9 * HOUR)
    go(page, {'mode': 'train'})
    until_card(page, 'measure-offer')
    off = page.locator('[data-card-box="measure-offer"]')
    C.ok('Short check' in off.inner_text() and off.locator('[data-card="skip"]').count() == 1, f'{tag}: a short check opens the session, with Skip this time')
    page.screenshot(path=str(OUT / 'block_offer_1366.png'))
    click_card(page, 'start')
    ok = play_measurement(page)
    blk = page.evaluate('''(() => { const r = PX.core.store.state, e = r.assess[2] || {}, n = Object.values(e.results || {}).reduce((s, x) => s + x.n, 0);
      return { kind: e.kind, n, bi: e.bi, skind: (r.sessions[r.sessions.length - 1] || {}).kind }; })()''')
    C.ok(ok and blk['kind'] == 'block' and blk['bi'] == 0 and blk['skind'] == 'block' and blk['n'] in (8, 14), f'{tag}: the short check saved ({blk})')
    done = page.locator('[data-card-box="measure-done"]').inner_text()
    C.ok('Chance that your probe results rose' in done, f'{tag}: its done card gives the meter\'s line')
    click_card(page, 'go')
    to_item(page)
    page.evaluate('__play.end()')
    page.wait_for_function('!!document.querySelector(".pl-summary")', timeout=10000)
    sm = page.locator('.px-ms-summary')
    C.ok(sm.count() == 1 and sm.locator('.px-ms-meter').count() == 1, f'{tag}: the summary shows the meter after a short check')
    page.screenshot(path=str(OUT / 'summary_meter_1366.png'), full_page=True)

    # Progress, Settings, the Lab
    page.evaluate('void PX.core.router.go("progress")')
    show_check_tab(page)
    pg = page.evaluate('''(() => { const x = document.querySelector('.px-ms-progress'); return [x.id, x.getAttribute('data-section'), document.querySelectorAll('[data-section="check"]').length,
      x.querySelector('[data-status]').getAttribute('data-status'), x.querySelectorAll('.px-fp-row[data-rung]').length, !!x.querySelector('.px-ms-meter')]; })()''')
    C.ok(pg[:3] == ['px-prog-check', 'check', 1] and pg[3] == 'trend' and pg[4] >= 3 and pg[5], f'{tag}: Progress: the panel in place of the check section, the meter and the rung rows ({pg})')
    txt = page.locator('.px-ms-progress').inner_text()
    C.ok('No verdict yet' in txt and 'IQ' not in txt and 'percentile' not in txt.lower(), f'{tag}: no verdict words before day 14, no IQ or percentile')
    page.locator('.px-ms-progress').screenshot(path=str(OUT / 'progress_1366.png'))
    page.evaluate('void PX.core.router.go("settings")')
    page.wait_for_selector('[data-section="measureweek"]', timeout=8000)
    prev = page.evaluate('(() => { const x = document.querySelector("[data-section=measureweek]").previousElementSibling; return x ? x.getAttribute("data-section") : null; })()')
    C.ok(prev == 'training', f'{tag}: Settings: Measurement week after Training ({prev})')
    page.locator('[data-section="measureweek"] .px-switch, [data-section="measureweek"] input[type=checkbox]').first.click()
    page.wait_for_timeout(200)
    st = page.evaluate("[PX.core.store.state.settings.measureWeek, PX.engine.events.list(PX.core.store.state, { kind: 'measure' }).map((e) => e.data.what)]")
    C.ok(st[0] is True and 'week-on' in st[1], f'{tag}: the setting and its event ({st})')
    page.evaluate('void PX.core.router.go("lab")')
    page.wait_for_selector('[data-section="ladder"]', timeout=8000)
    C.ok(page.locator('[data-section="ladder"] .px-fp-row[data-rung]').count() >= 3, f'{tag}: the Lab: the transfer ladder with its rungs')
    page.locator('[data-section="ladder"]').screenshot(path=str(OUT / 'lab_ladder_1366.png'))
    cv = page.locator('[data-section="curves"]')
    C.ok(cv.count() == 1 and 'Central Point' in cv.inner_text() and 'Exploratory' in cv.inner_text(), f'{tag}: the Lab: learning curves on new exercises (none yet: what brings one)')
    order = page.evaluate('[...document.querySelectorAll("[data-section]")].map((e) => e.getAttribute("data-section"))')
    C.ok(order.index('curves') == order.index('ladder') + 1, f'{tag}: right after the ladder ({order})')

    # the check screen on its own
    go(page, {'mode': 'check', 'kind': 'week'})
    until_card(page, 'check-intro')
    C.ok('Measurement week' in page.locator('[data-card-box="check-intro"]').inner_text(), f'{tag}: the check screen names the occasion')
    click_card(page, 'later')
    page.wait_for_selector('.px-today', timeout=8000)
    C.ok(True, f'{tag}: Later goes back to Today')
    errs = [e for e in con.errors() if 'favicon' not in e]
    C.ok(not errs, f'{tag}: no console errors {errs[:3]}')
    state = page.evaluate('JSON.stringify(PX.core.store.state)')
    ctx.close()
    return state


def phones(b, C, state):
    for w, hgt in ((390, 844), (360, 640)):
        tag = f'phone {w}x{hgt}'
        ctx = b.new_context(viewport={'width': w, 'height': hgt}, device_scale_factor=2, has_touch=True, is_mobile=True)
        page = ctx.new_page()
        con = Console(page)
        boot(page)
        page.evaluate('PX.ui.hooks.mute(false)')
        page.evaluate('(s) => { const r = JSON.parse(s); Object.assign(PX.core.store.state, r); PX.core.store.save(); }', state)
        page.evaluate('void PX.core.router.go("home", null, { force: true })')
        page.wait_for_selector('.px-today > [data-measure]', timeout=8000)
        page.locator('.px-today > [data-measure]').scroll_into_view_if_needed()
        page.locator('.px-today > [data-measure]').screenshot(path=str(OUT / f'today_slot_{w}.png'))
        C.ok(no_hscroll(page), f'{tag}: Today: no horizontal scroll')
        page.evaluate('void PX.core.router.go("progress")')
        show_check_tab(page)
        page.locator('.px-ms-progress').screenshot(path=str(OUT / f'progress_{w}.png'))
        C.ok(no_hscroll(page), f'{tag}: Progress: no horizontal scroll')
        errs = [e for e in con.errors() if 'favicon' not in e]
        C.ok(not errs, f'{tag}: no console errors {errs[:3]}')
        ctx.close()


BAL_FIT_JS = r"""() => {
  const W = innerWidth, H = innerHeight, root = document.querySelector('.ex-balance-stem');
  if (!root) return null;
  const r = (el) => el ? el.getBoundingClientRect() : null, svg = r(root.querySelector('.bl-svg')), btn = r(root.querySelector('.bl-actions .px-btn'));
  const small = [...root.querySelectorAll('p, span, b, button, li, text')].filter((e) => e.offsetParent !== null && e.textContent.trim()
    && parseFloat(getComputedStyle(e).fontSize) < 12.95).map((e) => e.className || e.tagName);
  return { kind: root.getAttribute('data-kind'), hscroll: document.documentElement.scrollWidth > W + 1,
    svgIn: !!svg && svg.top >= 0 && svg.bottom <= H + 1 && svg.width >= 200, btnIn: !!btn && btn.bottom <= H + 1 && btn.height >= 44, small };
}"""


def balance_lab(b, C, w, hgt, n_items):
    """The Lab's Balance check at one size: it starts from the Lab, every item fits (the figure and Confirm on the
    screen, no horizontal scroll, text 13 px or more), a tap places the marker, and the run is kept."""
    tag = f'balance {w}x{hgt}'
    mobile = w < 900
    ctx = b.new_context(viewport={'width': w, 'height': hgt}, device_scale_factor=2, has_touch=mobile, is_mobile=mobile)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    page.evaluate('PX.ui.hooks.mute(false)')
    page.evaluate('void PX.core.router.go("lab", null, { force: true })')
    page.wait_for_selector('[data-section="balance"]', timeout=8000)
    sec = page.locator('[data-section="balance"]')
    txt = sec.inner_text()
    C.ok('No run yet' in txt and not any(w in txt for w in ('middle house', 'far dots', 'mean', '%')), f'{tag}: the Lab section, no run yet, and no answers in its words')
    sec.locator('[data-balance-start]').click()
    until_card(page, 'check-intro')
    C.ok('Balance check' in page.locator('[data-card-box="check-intro"]').inner_text(), f'{tag}: its intro card')
    click_card(page, 'start')
    fits, seen, t0 = [], {}, time.time()
    while time.time() - t0 < 240 and len(fits) < n_items:
        cid = card(page)
        if cid:
            if cid == 'probe-format' and 'bus stop' in page.locator('[data-card-box]').inner_text() and 'New kind of question' in page.locator('[data-card-box]').inner_text():
                seen['median-card'] = True
            if cid == 'probe-intro' and 'balance point' in page.locator('[data-card-box]').inner_text():
                seen['centroid-card'] = True
            page.locator('[data-card-box] .px-btn--primary').first.click()
            page.wait_for_timeout(150)
            continue
        if page.evaluate('__play.state') != 'respond':
            page.wait_for_timeout(100)
            continue
        m = page.evaluate(BAL_FIT_JS)
        if m:
            fits.append(m)
            if len(fits) <= 2:
                page.screenshot(path=str(OUT / f'balance_{m["kind"]}_{w}x{hgt}.png'))
        if len(fits) == 1:  # one real tap: the marker lands where the finger does
            box = page.locator('.bl-svg').bounding_box()
            x, y = box['x'] + box['width'] * 0.3, box['y'] + box['height'] * 0.6
            if mobile:
                page.touchscreen.tap(x, y)
            else:
                page.mouse.click(x, y)
            mk = page.evaluate("!!document.querySelector('.bl-marker')")
            C.ok(mk and page.locator('.bl-actions .px-btn').is_enabled(), f'{tag}: a tap places the marker and enables Confirm')
            page.locator('.bl-actions .px-btn').click()
        else:
            page.evaluate('__play.answer(Math.random() < 0.6).catch(() => 0)')
        page.wait_for_timeout(150)
    bad = [f for f in fits if f['hscroll'] or not f['svgIn'] or not f['btnIn'] or f['small']]
    C.ok(len(fits) >= n_items and not bad, f'{tag}: {len(fits)} items fit (figure and Confirm on the screen, no sideways scroll, text 13 px or more) {bad[:2]}')
    C.ok(seen.get('centroid-card') and seen.get('median-card'), f'{tag}: the first kind on the task card, the second on a light "New kind of question" card ({seen})')
    if n_items >= 12:
        page.wait_for_selector('.px-ms-balance-end', timeout=20000)
        end = page.locator('.px-ms-balance-end').inner_text()
        C.ok('Saved' in end and 'no results' in end and not any(w in end for w in ('%', 'within', 'middle house', 'far dots')), f'{tag}: the end screen saves and shows no result ({end[:120]})')
        n = page.evaluate('(PX.core.store.state.measure.balance || []).length')
        C.ok(n == 1 and page.evaluate('PX.core.store.state.assess.length') == 0, f'{tag}: the run is kept in the Lab, not in the Spatial Check ({n})')
        page.evaluate('void PX.core.router.go("lab", null, { force: true })')
        page.wait_for_selector('[data-section="balance"]', timeout=8000)
        lab = page.locator('[data-section="balance"]').inner_text()
        C.ok('One run kept' in lab and '%' not in lab, f'{tag}: the Lab counts the run and shows no result')
        rows = page.evaluate('(PX.core.store.state.measure.balance[0].items || []).filter((r) => r.length === 9 && typeof r[4] === "number").length')
        C.ok(rows == 12, f'{tag}: the record keeps every answer with its distance and pull ({rows})')
        page.locator('[data-section="balance"]').screenshot(path=str(OUT / f'lab_balance_{w}.png'))
    errs = [e for e in con.errors() if 'favicon' not in e]
    C.ok(not errs, f'{tag}: no console errors {errs[:3]}')
    ctx.close()


def main():
    C = Checks('check')
    with sync_playwright() as p:
        b = launch(p)
        state = desktop(b, C)
        phones(b, C, state)
        balance_lab(b, C, 360, 640, 12)
        balance_lab(b, C, 844, 390, 4)
        balance_lab(b, C, 1366, 768, 2)
        b.close()
    sys.exit(C.summary())


if __name__ == '__main__':
    main()
