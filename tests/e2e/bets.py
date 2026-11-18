"""E2E tests of PLAN milestone 4 (W2-bets): the transfer bets on the screens and the add-on layers in sessions.

  screens   the bet line on the exercise page and in How to play, "Test the bets with us" in About and the
            Lab (with the events and dose exports), "Join the bet trials" in Settings (a join event when
            switched), the off-screen challenge (viewed, "I did it"), at 360 x 640, 390 x 844 and 1366 x 768
  round     a comparison round between items (Central Point): two solved boards, four statements, a pick by
            key or tap, the rule, the apply item (its row logs layer compare-apply), the compare event, the
            apply note; the round shows nothing while an item is on screen
  expect    the expectation rating on the summary (an expect event)
Screenshots: tests/e2e/out/bets/. No console errors, no horizontal scroll, 44 px targets on the new controls.

Run: tests/e2e/pwslot.sh python3 tests/e2e/bets.py [screens|round|expect ...]   (exit 1 when a check fails)
"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import Checks, Console, non_blank
from shell_common import INDEX, READY

OUT = pathlib.Path(__file__).resolve().parent / 'out' / 'bets'
OUT.mkdir(parents=True, exist_ok=True)
C = Checks('bets')
SIZES = [(360, 640), (390, 844), (1366, 768)]
LAUNCH = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']


def boot(page):
    page.goto(INDEX.as_uri())
    page.wait_for_function(READY, timeout=30000)
    page.evaluate('document.fonts.ready.then(() => 1)')
    for _ in range(4):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(120)
    page.evaluate("PX.debug.fast(true); PX.ex.list('train').forEach(d => { PX.core.store.state.tour.seen[d.id] = true; });")


def go(page, route, params=None):
    if params is None:
        page.evaluate(f'void PX.core.router.go({json.dumps(route)})')
    else:
        page.evaluate(f'void PX.core.router.go({json.dumps(route)}, {json.dumps(params)}, {{ force: true }})')
    page.wait_for_timeout(200)


def ctx_for(b, w, h):
    phone = w < 700
    return b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if phone else 1, has_touch=phone, is_mobile=phone)


SMALL_JS = '''(sel) => {
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect(), st = getComputedStyle(el);
    if (!r.width || st.display === 'none' || st.visibility === 'hidden') continue;
    if (r.width < 43.5 || r.height < 43.5) out.push(el.textContent.trim().slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  return out;
}'''


def no_scroll(page, tag):
    sw = page.evaluate('document.documentElement.scrollWidth')
    w = page.evaluate('window.innerWidth')
    C.ok(sw <= w, f'{tag}: no horizontal scroll ({sw} <= {w})')


def run_screens(b):
    for (w, h) in SIZES:
        tag = f'screens {w}x{h}'
        ctx = ctx_for(b, w, h)
        page = ctx.new_page()
        con = Console(page)
        boot(page)
        # the exercise page: the bet line, its link, the off-screen challenge
        for ex in ('views', 'centralpoint', 'fold'):
            go(page, f'exercise/{ex}')
            line = page.locator('.px-bet-line[data-where="page"]')
            bet = page.evaluate(f"PX.ex.get('{ex}').bet")
            C.ok(line.count() == 1 and line.first.get_attribute('data-bet') == bet, f'{tag} {ex}: the bet line ({bet}) on the exercise page')
            txt = line.first.inner_text() if line.count() else ''
            want = page.evaluate(f"PX.engine.bets.INFO['{bet}'].line")
            C.ok(want in txt, f'{tag} {ex}: it says the bet in the code’s words')
            no_scroll(page, f'{tag} {ex} page')
            if ex == 'centralpoint':
                off = page.locator('details.px-bets-off')
                C.ok(off.count() == 1, f'{tag} centralpoint: the off-screen challenge')
                off.first.scroll_into_view_if_needed()
                off.locator('summary').first.click()
                page.wait_for_timeout(150)
                seen = page.evaluate("PX.engine.events.list(PX.core.store.state, { kind: 'offscreen', exId: 'centralpoint' }).length")
                C.ok(seen >= 1, f'{tag} centralpoint: opening it logs a viewed event ({seen})')
                off.locator('[data-bets="offscreen-did"]').first.click()
                page.wait_for_timeout(150)
                did = page.evaluate("PX.engine.events.list(PX.core.store.state, { kind: 'offscreen', exId: 'centralpoint' }).filter(e => e.data.did === 1).length")
                C.ok(did == 1 and 'Done 1 time' in off.first.inner_text(), f'{tag} centralpoint: "I did it" logs a did event and says so')
                small = page.evaluate(SMALL_JS, '.px-bets-off summary, .px-bets-off .px-btn, .px-bet-go .px-btn')
                C.ok(not small, f'{tag}: 44 px targets on the bet line and the challenge ({small})')
                page.locator('.px-bet-line[data-where="page"]').first.screenshot(path=str(OUT / f'line_{w}.png'))
                off.first.screenshot(path=str(OUT / f'offscreen_{w}.png'))
        # How to play
        go(page, 'exercise/rotate')
        page.locator('[data-ex-action="howto"]').first.click()
        page.wait_for_timeout(300)
        hl = page.locator('.px-bet-line[data-where="howto"]')
        C.ok(hl.count() == 1 and 'Named strategies' in hl.first.inner_text(), f'{tag}: How to play shows the bet line')
        page.keyboard.press('Escape'); page.wait_for_timeout(150)
        # About
        go(page, 'about')
        sec = page.locator('[data-section="bets"]')
        C.ok(sec.count() == 1, f'{tag}: About has "Test the bets with us"')
        lines = page.evaluate("PX.engine.bets.IDS.map(id => PX.engine.bets.INFO[id].line)")
        about = sec.first.inner_text() if sec.count() else ''
        C.ok(all(x in about for x in lines), f'{tag}: About states every bet in the code’s words')
        order = page.evaluate("[...document.querySelectorAll('.px-about > [data-section]')].map(x => x.getAttribute('data-section'))")
        C.ok('claims' in order and order.index('bets') == order.index('claims') + 1, f'{tag}: About places it after the claims ({order})')
        no_scroll(page, f'{tag} about')
        sec.first.screenshot(path=str(OUT / f'about_{w}.png'))
        # the Lab
        go(page, 'lab')
        lab = page.locator('.px-bets-lab')
        C.ok(lab.count() == 1 and all(x in lab.first.inner_text() for x in lines), f'{tag}: the Lab panel lists the nine bets')
        page.locator('[data-action="bets-events"]').first.click()
        page.wait_for_timeout(250)
        txt = page.evaluate("(document.querySelector('.px-modal textarea') || {}).value || ''")
        C.ok(txt.startswith('time_iso,t_sec,kind,exercise,data') and 'offscreen' in txt, f'{tag}: the events CSV ({txt[:60]!r})')
        page.keyboard.press('Escape'); page.wait_for_timeout(150)
        page.locator('[data-action="bets-dose"]').first.click()
        page.wait_for_timeout(250)
        txt = page.evaluate("(document.querySelector('.px-modal textarea') || {}).value || ''")
        C.ok(txt.startswith('week,exercise,bet,trials,rated,minutes,sessions'), f'{tag}: the dose CSV')
        page.keyboard.press('Escape'); page.wait_for_timeout(150)
        small = page.evaluate(SMALL_JS, '.px-bets-lab .px-btn')
        C.ok(not small, f'{tag}: 44 px targets in the Lab panel ({small})')
        no_scroll(page, f'{tag} lab')
        lab.first.screenshot(path=str(OUT / f'lab_{w}.png'))
        # Settings: the switch
        go(page, 'settings')
        sw = page.locator('[data-section="bettrials"] input[type=checkbox]')
        C.ok(sw.count() == 1 and sw.first.is_checked(), f'{tag}: "Join the bet trials" is on by default')
        page.locator('[data-section="bettrials"] .px-switch').first.click()
        page.wait_for_timeout(150)
        st = page.evaluate("[PX.core.store.state.settings.betTrials, PX.engine.events.list(PX.core.store.state, { kind: 'join' }).map(e => e.data.on)]")
        C.ok(st[0] is False and st[1] == [0], f'{tag}: switching it off saves and logs a join event ({st})')
        page.locator('[data-section="bettrials"] .px-switch').first.click()
        page.wait_for_timeout(150)
        C.ok(page.evaluate('PX.core.store.state.settings.betTrials') is True, f'{tag}: and back on')
        page.locator('[data-section="bettrials"]').first.screenshot(path=str(OUT / f'settings_{w}.png'))
        C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
        ctx.close()


PREP = '''(id) => {
  const S = PX.core.store, rec = S.state, st = S.exState(id);
  st.n = 14; st.nRight = 9; st.mu = PX.ex.minDifficulty(id) + 1; st.sd = 0.9; st.last = Date.now();
  rec.settings.betTrials = false;   // out of the trials: every add-on runs
  S.save();
  return true;
}'''

CARD_JS = "(() => { const c = document.querySelector('[data-card-box]'); return c ? c.getAttribute('data-card-box') : null; })()"


def other_card(page):
    """Answers another module's card (a baseline offer, a motion notice): Later when it has one, else its primary."""
    later = page.locator('[data-card-box] [data-card="later"]')
    if later.count():
        later.first.click()
    else:
        page.locator('[data-card-box] .px-btn--primary').first.click()
    page.wait_for_timeout(120)


def wait_card(page, cid, ms=20000):
    for _ in range(ms // 150):
        got = page.evaluate(CARD_JS)
        if got == cid:
            return True
        if got:
            other_card(page)
            continue
        page.wait_for_timeout(150)
    raise TimeoutError(f'card {cid} did not open')


def round_for(b, ex, w, h, calib=False):
    tag = f'round {ex} {w}x{h}'
    ctx = ctx_for(b, w, h)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    page.evaluate(PREP, ex)
    page.evaluate('PX.core.store.state.settings.sessionMin = 2; PX.ui.play.config.budgetMs = 60000;')
    go(page, 'play', {'mode': 'train', 'exId': ex})
    try:
        wait_card(page, 'bets-compare')
        ok = True
    except Exception:
        ok = False
    C.ok(ok, f'{tag}: a comparison round opens the run')
    if not ok:
        page.screenshot(path=str(OUT / f'round_missing_{ex}_{w}.png'))
        ctx.close()
        return
    st = page.evaluate('__play.state')
    C.ok(st not in ('present', 'respond'), f'{tag}: no item is on screen under the round ({st})')
    figs = page.locator('[data-card-box="bets-compare"] .px-bets-fig')
    C.ok(figs.count() == 2, f'{tag}: two solved items')
    for k in range(min(2, figs.count())):
        C.ok(non_blank(figs.nth(k).screenshot()), f'{tag}: item {k + 1} is drawn')
    opts = page.locator('[data-card-box="bets-compare"] .px-bets-opt')
    C.ok(opts.count() == 4, f'{tag}: four statements')
    small = page.evaluate(SMALL_JS, '[data-card-box="bets-compare"] .px-btn')
    C.ok(not small, f'{tag}: 44 px targets ({small})')
    no_scroll(page, tag)
    page.locator('[data-card-box="bets-compare"]').first.screenshot(path=str(OUT / f'round_{ex}_{w}.png'))
    if w >= 700:
        page.keyboard.press('2')
    else:
        opts.nth(1).click()
    page.wait_for_timeout(200)
    after = page.locator('[data-card-box="bets-compare"] .px-bets-after')
    C.ok(after.count() == 1 and after.first.is_visible() and 'The rule:' in after.first.inner_text(), f'{tag}: the rule shows after the pick')
    page.locator('[data-card-box="bets-compare"]').first.screenshot(path=str(OUT / f'round_after_{ex}_{w}.png'))
    page.locator('[data-bets="round-next"]').first.click()
    page.wait_for_function('__play.state === "respond"', timeout=15000)
    ev = page.evaluate("PX.engine.events.list(PX.core.store.state, { kind: 'compare' })")
    C.ok(len(ev) == 1 and ev[0]['data']['opts'] and ev[0]['data']['choice'] == ev[0]['data']['opts'][1], f'{tag}: the compare event records the pair, the menu and the choice')
    layer = page.evaluate('PX.ui.play.current() && PX.ui.play.current().ctx ? PX.ui.play.current().ctx.layer : null')
    applied = ev and ev[0]['data']['apply']
    C.ok(layer == 'compare-apply' or not applied, f'{tag}: the next item is the apply item (layer {layer})')
    page.evaluate('__play.answer(true).catch(() => 0)')
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=15000)
    row = page.evaluate('PX.core.store.state.trials[PX.core.store.state.trials.length - 1]')
    if applied:
        C.ok(len(row) > 14 and row[14] == 1 and row[4] == applied, f'{tag}: its row logs layer compare-apply (1) and the apply seed ({row[:5]}…{row[13:17]})')
        page.wait_for_timeout(200)
        C.ok(page.locator('[data-bets="apply-note"]').count() >= 1, f'{tag}: the apply note names the rule')
    page.screenshot(path=str(OUT / f'apply_{ex}_{w}.png'))
    if calib:
        seen_note = False
        for _ in range(80):
            if page.locator('[data-bets="calib-note"]').count():
                seen_note = True
                break
            if page.evaluate(CARD_JS):
                other_card(page)
                continue
            st = page.evaluate('__play.state')
            if st == 'respond':
                page.evaluate('__play.answer(Math.random() < 0.6).catch(() => 0)')
            elif st in ('reveal', 'showme'):
                page.evaluate('__play.next()')
            page.wait_for_timeout(120)
        n = page.evaluate(f"(PX.core.store.state.bets.cal || {{}})[{json.dumps(ex)}] ? PX.core.store.state.bets.cal[{json.dumps(ex)}].length : 0")
        C.ok(seen_note and n >= 5, f'{tag}: the calibration note shows after 5 answers ({n} kept)')
        if seen_note:
            page.locator('[data-bets="calib-note"]').first.screenshot(path=str(OUT / f'calib_{ex}_{w}.png'))
        rows = page.evaluate("PX.core.store.state.trials.filter(r => r[14] === 3).length")
        C.ok(rows >= 4, f'{tag}: the calib-detail items log layer 3 ({rows})')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


ROUND_EX = ['centralpoint', 'spin']


def run_round(b, only=None):
    for ex in (only or ROUND_EX):
        for (w, h) in SIZES:
            round_for(b, ex, w, h, calib=(ex == 'centralpoint' and w == 390))


def run_expect(b):
    tag = 'expect 390x844'
    ctx = ctx_for(b, 390, 844)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    page.evaluate('PX.core.store.state.settings.sessionMin = 1; PX.ui.play.config.budgetMs = 6000;')
    go(page, 'play', {'mode': 'train', 'exId': 'rotate'})
    for _ in range(60):
        if page.evaluate('!!document.querySelector(".pl-summary")'):
            break
        if page.evaluate(CARD_JS):
            other_card(page)
            continue
        st = page.evaluate('__play.state')
        if st == 'respond':
            page.evaluate('__play.answer(Math.random() < 0.7).catch(() => 0)')
        elif st in ('reveal', 'showme'):
            page.evaluate('__play.next()')
        page.wait_for_timeout(120)
    panel = page.locator('[data-bets="expect"]')
    C.ok(panel.count() == 1, f'{tag}: the summary asks for one expectation rating')
    if panel.count():
        panel.first.scroll_into_view_if_needed()
        panel.first.screenshot(path=str(OUT / 'expect_390.png'))
        small = page.evaluate(SMALL_JS, '[data-bets="expect"] .px-btn')
        C.ok(not small, f'{tag}: 44 px targets ({small})')
        panel.locator('[data-rating="3"]').first.click()
        page.wait_for_timeout(150)
        ev = page.evaluate("PX.engine.events.list(PX.core.store.state, { kind: 'expect' }).map(e => [e.data.bet, e.data.rating, e.data.when])")
        C.ok(ev == [['strategy', 3, 'baseline']], f'{tag}: a tap stores an expect event ({ev})')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


if __name__ == '__main__':
    which = sys.argv[1:] or ['screens', 'round', 'expect']
    if any(x.startswith('round:') for x in which):
        which.append('round')
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=LAUNCH)
        if 'screens' in which:
            run_screens(b)
        if 'round' in which:
            run_round(b, [x[6:] for x in which if x.startswith('round:')] or None)
        if 'expect' in which:
            run_expect(b)
        b.close()
    sys.exit(C.summary())
