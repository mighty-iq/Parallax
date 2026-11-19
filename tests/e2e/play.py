"""E2E tests of the trial player and Train sessions (Phase 3, Builder A: js/ui/play.js).

Checks, in the app (index.html) on file:// and in a sandboxed srcdoc frame:
- a Train session end to end: the Watch, Try, Go offer for a new exercise (Skip), answers by
  keyboard and by pointer, feedback within 0.5 s (icon + word + colour), the right answer marked,
  automatic show-me after errors that fades to a "Why?" button, "See solution" after a slow right
  answer, pause (the item hidden, a second pause keeps the first start, paused time excluded),
  the emergency skip (logged as skipped), voiding on 'trial:void' and 'stage3d:lost' (logged as
  stutters), the calm device notice after three voids in a row, the keys sheet, the summary
  (results, noise line, week, Share) and the trial log (one row per answer, never added twice);
- pick-two answers (Enter confirms only two), a custom layout (Block Span by its own keys and by
  pointer, the input source logged), a timed item that ends as a time-out;
- phones (412 × 880 touch, 360 × 640): no horizontal scroll, 44 px targets; light and dark;
- regressions from the code review of 6 Nov (run_review): a pause during Span's sequence (the
  item inert, keys ignored, the answer taken after Resume), no frame monitor left by skips, the
  keys sheet and the Chimera pop-up pause items, Pattern Memory unmounted mid-exposure, Esc on
  Track's notice voids nothing, a card's key layer goes with its screen, End session inside
  Watch, Try, Go, one free skip per Spatial Check task; and a reload mid-session saves it.
Screenshots go to tests/e2e/out/play/. Run: tests/e2e/pwslot.sh python3 tests/e2e/play.py
"""
import json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import launch, Console, Checks, ROOT, OUT as OUT_ROOT
from shell_common import inline_single, write_host, child_frame

OUT = OUT_ROOT / 'play'
OUT.mkdir(parents=True, exist_ok=True)
INDEX = ROOT / 'index.html'
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
TARGETS_JS = '''() => {
  const out = [];
  const sel = 'button, a[href], select, textarea, input:not([type=radio]):not([type=checkbox]), .px-seg-item, .px-switch';
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden],[inert]') || el.matches('.px-refs a, .px-skip')) continue;
    const st = getComputedStyle(el), r = el.getBoundingClientRect();
    if (!r.width || !r.height || st.display === 'none' || st.visibility === 'hidden') continue;
    if (r.width < 43.5 || r.height < 43.5) out.push(`${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || '').trim().slice(0, 24)}"`);
  }
  return out;
}'''


def boot(page, url=None, knobs=True):
    page.goto(url or INDEX.as_uri())
    page.wait_for_function(READY, timeout=20000)
    page.evaluate('document.fonts.ready.then(() => 1)')
    for _ in range(4):  # the Chimera pop-up, then the first-run tour offer
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(120)
    # v1.2 wave 2: these tests check the player itself; the builders' cards and panels (measurement,
    # plateau, bets) have their own browser tests, so their hooks are muted here (run_hooks runs its own)
    page.evaluate('PX.ui.hooks && PX.ui.hooks.mute(true)')
    if knobs:
        # v1.1: sessions are time-boxed on active time; the test knob gives them 8 s
        page.evaluate('PX.debug.fast(true); PX.core.store.state.settings.sessionMin = 1; PX.ui.play.config.budgetMs = 8000;')


def go(page, params):
    page.evaluate(f'void PX.core.router.go("play", {json.dumps(params)}, {{ force: true }})')
    page.wait_for_timeout(150)


def state(page):
    return page.evaluate('__play.state')


def wait_state(page, s, ms=15000):
    if s == 'respond':  # Track shows its motion notice before its first trial: start it
        for _ in range(ms // 100):
            if state(page) == 'respond':
                return
            nb = page.locator('.ex-track-notice:not([hidden]) .px-btn')
            if nb.count() and nb.first.is_visible():
                nb.first.click()
            page.wait_for_timeout(100)
    page.wait_for_function(f'__play.state === {json.dumps(s)}', timeout=ms)


def last_outcome(page):
    return page.evaluate('(__play.history.slice(-1)[0] || {}).outcome')


def card(page):
    box = page.locator('[data-card-box]')
    return box.first.get_attribute('data-card-box') if box.count() else None


def past_cards(page, ms=15000):
    """Goes on to the next item: a card between items (W2-measure: a change of format inside a probe) takes its
    primary button."""
    for _ in range(ms // 100):
        if page.evaluate('__play.state') == 'respond' and not card(page):
            return
        if card(page):
            page.locator('[data-card-box] .px-btn--primary').first.click()
        page.wait_for_timeout(100)
    wait_state(page, 'respond')


def click_card(page, value):
    page.locator(f'[data-card-box] [data-card="{value}"]').first.click()
    page.wait_for_timeout(100)


def drive(page, until_js, cards=None, limit=500, right=0.7, notice=True):
    """Plays until until_js is true. cards: data-card-box id -> data-card value (default: primary)."""
    cards = cards or {}
    for _ in range(limit):
        if page.evaluate(until_js):
            return True
        cid = card(page)
        if cid:
            val = cards.get(cid)
            if val:
                click_card(page, val)
            else:
                page.locator('[data-card-box] .px-btn--primary').first.click()
                page.wait_for_timeout(80)
            continue
        st = state(page)
        nb = page.locator('.ex-track-notice:not([hidden]) .px-btn')
        if notice and st == 'present' and nb.count() and nb.first.is_visible():
            nb.first.click()
        elif st in ('present', 'ready'):  # a timed display plays (Pattern Memory shows its grid 3 s)
            try:
                page.wait_for_function('__play.state !== "present" && __play.state !== "ready" || !!document.querySelector(".ex-track-notice:not([hidden])")', timeout=20000)
            except Exception:
                pass
            continue
        elif st == 'respond':
            if page.locator('.pl-note [data-card="start"]').count():
                page.locator('.pl-note [data-card="start"]').click()
            else:
                page.evaluate(f'__play.answer(Math.random() < {right}).catch(() => 0)')
        elif st in ('reveal', 'showme'):
            page.evaluate('__play.next()')
        page.wait_for_timeout(50)
    return page.evaluate(until_js)


def row_count(page, mode):
    return page.evaluate(f'''(() => {{ const r = PX.core.store.state, mi = r.idx.mode.indexOf({json.dumps(mode)});
      return r.trials.filter(t => t[2] === mi).length; }})()''')


def last_row(page):
    return page.evaluate('PX.core.store.state.trials[PX.core.store.state.trials.length - 1]')


def key_presses(page):
    """Keys that answer the current stem+options item right: yes/no 1 or 2; pick-two the digits."""
    it = page.evaluate('({ key: __play.key, answer: __play.item.answer || PX.ex.get(__play.exId).answer })')
    if it['answer'] == 'yesno':
        return ['1' if it['key'] else '2']
    if it['answer'] == 'multi':
        return [str(i + 1) for i in it['key']] + ['Enter']
    return [str(it['key'] + 1)]


def wrong_click(page):
    """Clicks a wrong answer through the grid like a person (pick-two: one right + one wrong, Confirm)."""
    it = page.evaluate('({ key: __play.key, answer: __play.item.answer || PX.ex.get(__play.exId).answer, n: document.querySelectorAll(".pl-grid .px-choice").length })')
    opts = page.locator('.pl-grid .px-choice')
    if it['answer'] == 'yesno':
        opts.nth(1 if it['key'] else 0).click()
    elif it['answer'] == 'multi':
        wrong = [i for i in range(it['n']) if i not in it['key']]
        opts.nth(it['key'][0]).click(); opts.nth(wrong[0]).click()
        page.locator('[data-confirm]').click()
    else:
        opts.nth((it['key'] + 1) % it['n']).click()


VERDICT_TIMER = '''(() => {
  window.__vt = null; window.__kt = null;
  document.addEventListener('keydown', () => { if (window.__kt === null) window.__kt = performance.now(); }, { capture: true, once: true });
  document.addEventListener('pointerdown', () => { if (window.__kt === null) window.__kt = performance.now(); }, { capture: true, once: true });
  const mo = new MutationObserver(() => { if (window.__vt === null && document.querySelector('.pl-verdict[data-kind]')) { window.__vt = performance.now(); mo.disconnect(); } });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true });
})()'''


def run_train(b, C):
    tag = 'train 1366'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768}, color_scheme='light')
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    # a long first run of Rotate (S1 runs are 20 items), and no tutorial offers for the others
    page.evaluate('''PX.core.store.state.settings.sessionMin = 10; PX.ui.play.config.budgetMs = null;
      PX.ex.list('train').forEach(d => { if (d.id !== 'rotate') PX.core.store.state.tour.seen[d.id] = true; });''')
    go(page, {'mode': 'train', 'exId': 'rotate', 'count': 1})
    C.ok(card(page) == 'wtg-offer' and 'New: Rotate' in page.locator('[data-card-box]').inner_text(), f'{tag}: Watch, Try, Go offered for a new exercise')
    page.screenshot(path=str(OUT / 'offer_1366_light.png'))
    click_card(page, 'skip')
    wait_state(page, 'respond')
    C.ok(page.evaluate('PX.core.store.state.tour.seen.rotate === true'), f'{tag}: Skip marks the tutorial as seen')
    C.ok('EX-02' in page.locator('.pl-hud-id').inner_text(), f'{tag}: the banner names the exercise')
    C.ok(page.evaluate('PX.core.store.isHeld()') is True, f'{tag}: no saves while the item is up (store held)')
    # a right answer by keyboard: feedback within 0.5 s
    page.evaluate(VERDICT_TIMER)
    for k in key_presses(page):
        page.keyboard.press(k)
    wait_state(page, 'reveal')
    dt = page.evaluate('window.__vt - window.__kt')
    C.ok(dt is not None and dt < 500, f'{tag}: feedback within 0.5 s ({dt} ms)')
    v = page.evaluate('({ kind: document.querySelector(".pl-verdict").dataset.kind, word: document.querySelector(".pl-verdict-word").textContent, icon: document.querySelector(".pl-verdict-icon").textContent })')
    C.ok(v == {'kind': 'right', 'word': 'Correct', 'icon': '✓'}, f'{tag}: right answer: icon, word and colour ({v})')
    C.ok(page.evaluate('__play.last.source') == 'key', f'{tag}: input source key')
    C.ok(page.evaluate('PX.core.store.isHeld()') is False, f'{tag}: store released at reveal')
    page.screenshot(path=str(OUT / 'reveal_right_1366_light.png'))
    page.keyboard.press('Space')
    wait_state(page, 'respond')
    # a wrong answer by pointer: the right answer marked, show me plays on its own
    p0 = page.evaluate('__play.played.started')
    wrong_click(page)
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"')
    C.ok(page.evaluate('document.querySelector(".pl-verdict").dataset.kind') == 'wrong' and page.locator('.pl-verdict-word').inner_text() == 'Incorrect', f'{tag}: wrong answer: Incorrect')
    C.ok(page.locator('.pl-grid .px-choice.is-right, .pl-grid .px-choice.is-missed').count() >= 1, f'{tag}: the right answer is marked')
    C.ok(page.evaluate('__play.last.source') in ('pointer', 'touch'), f'{tag}: input source pointer')
    page.wait_for_function(f'__play.played.started > {p0}', timeout=5000)
    page.wait_for_function('__play.played.finished === __play.played.started && __play.state === "reveal"', timeout=10000)
    C.ok(True, f'{tag}: show me ran after the error')
    page.screenshot(path=str(OUT / 'reveal_wrong_1366_light.png'))
    # after three automatic replays, a "Why?" button instead
    for _ in range(3):
        page.evaluate('__play.next()'); wait_state(page, 'respond')
        page.evaluate('__play.answer(false)')
        page.wait_for_function('__play.state === "reveal" && __play.played.finished === __play.played.started', timeout=10000)
    btn = page.locator('[data-showme]')
    C.ok(btn.is_visible() and btn.inner_text().startswith('Why?'), f'{tag}: replays fade to a Why? button ({btn.inner_text()!r})')
    started = page.evaluate('__play.played.started')
    page.keyboard.press('s')
    page.wait_for_function(f'__play.played.started > {started}', timeout=5000)
    C.ok(True, f'{tag}: S plays show me')
    page.wait_for_function('__play.state === "reveal"', timeout=10000)
    # a slow right answer: See solution
    page.evaluate('PX.ui.play.config.slowMs = 1; __play.next()'); wait_state(page, 'respond')
    page.evaluate('__play.answer(true)'); wait_state(page, 'reveal')
    C.ok(btn.is_visible() and btn.inner_text().startswith('See solution'), f'{tag}: See solution after a slow right answer')
    page.evaluate('PX.ui.play.config.slowMs = null')
    # pause: item hidden, a second pause keeps the first start, paused time excluded
    page.evaluate('__play.next()'); wait_state(page, 'respond')
    page.keyboard.press('Escape')
    wait_state(page, 'paused')
    st0 = page.evaluate('__play.paused.start')
    C.ok(page.evaluate('document.querySelector(".pl-trial").hasAttribute("data-paused") && !document.querySelector(".pl-pause").hidden'), f'{tag}: pause covers the item')
    C.ok(page.evaluate('__play.pause()') is False and page.evaluate('__play.paused.start') == st0, f'{tag}: a second pause keeps the first start')
    page.screenshot(path=str(OUT / 'pause_1366_light.png'))
    page.wait_for_timeout(450)
    page.keyboard.press('Escape')
    wait_state(page, 'respond')
    page.evaluate('__play.answer(true)'); wait_state(page, 'reveal')
    C.ok(page.evaluate('__play.last.pausedMs') >= 400, f'{tag}: paused time excluded from the answer time ({page.evaluate("__play.last.pausedMs")} ms)')
    # emergency skip: logged as skipped (outcome 3), the next item comes
    page.evaluate('__play.next()'); wait_state(page, 'respond')
    page.keyboard.press('Escape'); wait_state(page, 'paused')
    page.locator('[data-skip]').click()
    wait_state(page, 'respond')
    C.ok(last_outcome(page) == 'skipped' and last_row(page)[5] == 3, f'{tag}: emergency skip counts nowhere (row outcome {last_row(page)[5]})')
    # voids: trial:void and stage3d:lost are logged as stutters; three in a row bring the device notice
    for i, how in enumerate(['PX.bus.emit("trial:void", { seed: __play.item.seed, reason: "jump" })', 'PX.bus.emit("stage3d:lost", {})', 'PX.bus.emit("trial:void", { reason: "late" })']):
        if i:
            page.evaluate('__play.next()'); wait_state(page, 'respond')
        page.evaluate(how)
        page.evaluate('__play.answer(true)'); wait_state(page, 'reveal')
        C.ok(page.evaluate('__play.last.outcome') == 'stutter' and last_row(page)[5] == 2 and page.locator('.pl-verdict-void').count() == 1, f'{tag}: void {i + 1} logged as a stutter')
    C.ok('interrupted' in page.locator('.pl-notice').inner_text(), f'{tag}: device notice after three voids')
    page.keyboard.press('?')
    page.wait_for_timeout(150)
    C.ok(page.locator('.px-modal.pl-keys').count() == 1, f'{tag}: ? opens the keys sheet')
    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    # End session from the pause sheet: the item counts nowhere, the summary follows
    page.evaluate('__play.next()'); wait_state(page, 'respond')
    answered = page.evaluate('__play.session.answered')
    page.keyboard.press('Escape'); wait_state(page, 'paused')
    page.locator('[data-end]').click()
    page.wait_for_selector('.pl-summary', timeout=10000)
    C.ok(True, f'{tag}: End session leads to the summary')
    rows = row_count(page, 'train')
    sess = page.evaluate('PX.core.store.state.sessions[PX.core.store.state.sessions.length - 1]')
    C.ok(sess and sess['mode'] == 'train' and sess['trials'] == answered, f'{tag}: the session is saved ({sess and sess["trials"]} of {answered} answered)')
    C.ok(rows == answered + 5, f'{tag}: one trial row per item, never added twice ({rows} rows = {answered} answered + 1 skip + 3 voids + 1 ended)')
    C.ok(page.locator('h1').first.inner_text() == 'Session summary' and page.locator('.pl-res').count() >= 1, f'{tag}: summary with results by exercise')
    C.ok('Success is kept near your target' in page.locator('.pl-summary').inner_text(), f'{tag}: summary carries the noise line')
    C.ok(page.locator('.pl-week li').count() == 7, f'{tag}: summary shows the week')
    page.screenshot(path=str(OUT / 'summary_1366_light.png'), full_page=True)
    page.locator('[data-share]').click()
    page.wait_for_timeout(300)
    C.ok(page.evaluate('PX.ui.modalOpen()') >= 1, f'{tag}: Share opens the share sheet')
    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    page.evaluate('void PX.core.router.go("home")')
    page.wait_for_timeout(200)
    C.ok(page.locator('.px-slot--session[data-sample]').count() == 0 and page.locator('.px-slot--levels [data-ex]').count() >= 1, f'{tag}: Today shows the real plan and levels')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def seen_all(page):
    page.evaluate("PX.ex.list('train').forEach(d => { PX.core.store.state.tour.seen[d.id] = true; })")


def run_custom(b, C):
    tag = 'answers 1366'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    # pick two: Enter confirms only with exactly two picked
    go(page, {'mode': 'free', 'exId': 'rotate', 'params': {'angle': 0, 'axis': 0, 'cubes': 0, 'variant': 'pick'}, 'trials': 3})
    wait_state(page, 'respond')
    keys = key_presses(page)
    page.keyboard.press(keys[0])
    C.ok(page.locator('[data-confirm]').is_disabled(), f'{tag}: Confirm waits for two picks')
    page.keyboard.press('Enter')
    C.ok(state(page) == 'respond', f'{tag}: Enter with one pick does nothing')
    page.keyboard.press(keys[1])
    C.ok(not page.locator('[data-confirm]').is_disabled(), f'{tag}: Confirm ready with two picks')
    page.keyboard.press('Enter')
    wait_state(page, 'reveal')
    C.ok(page.evaluate('__play.last.result.correct') is True, f'{tag}: pick two answered right by keys')
    page.screenshot(path=str(OUT / 'pick_reveal_1366.png'))
    # a custom layout: Block Span by its own number keys, then by pointer
    go(page, {'mode': 'free', 'exId': 'span', 'params': {'len': 0, 'cross': 0, 'turn': 0, 'variant': 'forward'}, 'trials': 3})
    wait_state(page, 'respond')
    labels = page.evaluate('__play.key.map(id => document.querySelector(`.ex-span-tag[data-id="${id}"]`).getAttribute("data-label"))')
    for d in labels:
        page.keyboard.press(d)
    wait_state(page, 'reveal')
    C.ok(page.evaluate('__play.last.result.correct') is True and page.evaluate('__play.last.source') == 'key', f'{tag}: Span by number keys, source key ({page.evaluate("__play.last.source")})')
    page.keyboard.press('Space')
    wait_state(page, 'respond')
    for bid in page.evaluate('__play.key'):
        r = page.evaluate(f'(() => {{ const r = document.querySelector(\'.ex-span-block[data-id="{bid}"]\').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }})()')
        page.mouse.click(r[0], r[1])
        page.wait_for_timeout(60)
    wait_state(page, 'reveal')
    C.ok(page.evaluate('__play.last.result.correct') is True and page.evaluate('__play.last.source') == 'pointer', f'{tag}: Span by pointer, source pointer ({page.evaluate("__play.last.source")})')
    # a timed item: the countdown runs, and the item ends as a time-out (scored wrong, rt = the limit)
    go(page, {'mode': 'free', 'exId': 'rotate', 'params': {'angle': 0, 'axis': 0, 'cubes': 0, 'variant': 'samediff'}, 'trials': 2, 'deadlineMs': 800})
    wait_state(page, 'respond')
    C.ok(page.locator('.pl-limit.is-running').is_visible(), f'{tag}: the deadline bar runs')
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=4000)
    row = last_row(page)
    C.ok(page.evaluate('__play.last.timeout') is True and page.locator('.pl-verdict-word').inner_text() == 'Time is up', f'{tag}: time-out shown as Time is up')
    C.ok(row[5] == 0 and row[6] == 800, f'{tag}: time-out logged as wrong with rt = the limit ({row[5]}, {row[6]})')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def layout_checks(page, C, tag, w):
    sw = page.evaluate('document.documentElement.scrollWidth')
    C.ok(sw <= w, f'{tag}: no horizontal scroll ({sw})')
    small = page.evaluate(TARGETS_JS)
    C.ok(not small, f'{tag}: targets ≥ 44 px {small[:4]}')


def run_phone(b, C):
    for (w, hgt, theme) in [(412, 880, 'dark'), (360, 640, 'light')]:
        tag = f'phone {w}'
        ctx = b.new_context(viewport={'width': w, 'height': hgt}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme=theme)
        page = ctx.new_page()
        con = Console(page)
        boot(page)
        seen_all(page)
        go(page, {'mode': 'train'})
        wait_state(page, 'respond')
        layout_checks(page, C, f'{tag} item', w)
        C.ok(page.evaluate('getComputedStyle(document.querySelector(".px-tabbar")).display') == 'none', f'{tag}: the tab bar steps aside during items')
        tapped = False
        for _ in range(400):
            if page.locator('.pl-summary').count():
                break
            st = state(page)
            if st == 'respond':
                if not tapped and page.locator('.pl-grid .px-choice').count():
                    page.locator('.pl-grid .px-choice').first.tap()
                    if page.evaluate('__play.item && (__play.item.answer || PX.ex.get(__play.exId).answer) === "multi"'):
                        page.locator('.pl-grid .px-choice').nth(1).tap(); page.locator('[data-confirm]').tap()
                    page.wait_for_function('__play.state !== "respond"', timeout=5000)
                    tapped = True
                    C.ok(page.evaluate('__play.last.source') == 'touch', f'{tag}: a tap is logged as touch ({page.evaluate("__play.last.source")})')
                    page.wait_for_timeout(200)
                    layout_checks(page, C, f'{tag} reveal', w)
                    page.screenshot(path=str(OUT / f'reveal_{w}_{theme}.png'))
                else:
                    page.evaluate('__play.answer(Math.random() < 0.7).catch(() => 0)')
            elif st in ('reveal', 'showme'):
                page.evaluate('__play.next()')
            elif page.locator('.ex-track-notice:not([hidden]) .px-btn').count():
                page.locator('.ex-track-notice .px-btn').first.tap()
            page.wait_for_timeout(60)
        C.ok(page.locator('.pl-summary').count() == 1, f'{tag}: the session reaches its summary')
        layout_checks(page, C, f'{tag} summary', w)
        C.ok(page.evaluate('document.documentElement.hasAttribute("data-chrome")') is False, f'{tag}: the tab bar is back after the session')
        page.screenshot(path=str(OUT / f'summary_{w}_{theme}.png'), full_page=True)
        C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
        ctx.close()


def run_sandbox(b, C):
    tag = 'srcdoc'
    host = write_host(inline_single(), OUT / 'host.html')
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    con = Console(page)
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=20000)
    fr.evaluate('window.__bootMark = "b1"')
    for sel in ['.px-modal[data-welcome] .px-modal-close', '.px-offer-skip']:
        if fr.locator(sel).count():
            fr.locator(sel).first.click(); fr.wait_for_timeout(120)
    C.ok(fr.evaluate('PX.core.store.volatile') is True, f'{tag}: storage blocked, the record lives in memory')
    fr.evaluate('PX.debug.fast(true); PX.core.store.state.settings.sessionMin = 1; PX.ui.play.config.budgetMs = 8000; PX.ui.hooks && PX.ui.hooks.mute(true);')
    seen_all(fr)
    go(fr, {'mode': 'train'})
    ok = drive(fr, '!!document.querySelector(".pl-summary")')
    C.ok(ok, f'{tag}: a Train session runs to its summary')
    f2 = page.main_frame.child_frames[0]
    C.ok(f2.url.startswith('about:srcdoc') and f2.evaluate('window.__bootMark') == 'b1', f'{tag}: the frame never navigated away')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def shots(b, C):
    for (w, hgt) in [(1366, 768), (412, 880)]:
        for theme in ['light', 'dark']:
            ctx = b.new_context(viewport={'width': w, 'height': hgt}, color_scheme=theme, device_scale_factor=1 if w > 800 else 2)
            page = ctx.new_page()
            con = Console(page)
            boot(page)
            seen_all(page)
            name = f'{w}_{theme}'
            go(page, {'mode': 'free', 'exId': 'rotate', 'params': {'angle': 3, 'axis': 1, 'cubes': 1, 'variant': 'pick'}, 'trials': 2})
            wait_state(page, 'respond')
            page.wait_for_timeout(250)
            page.screenshot(path=str(OUT / f'item_{name}.png'))
            page.evaluate('PX.debug.fast(false)')
            page.evaluate('__play.answer(false)')
            page.wait_for_function('__play.state === "showme"', timeout=5000)
            page.wait_for_timeout(900)
            page.screenshot(path=str(OUT / f'showme_{name}.png'))
            page.evaluate('PX.debug.fast(true)')
            page.keyboard.press('Escape')
            ok = drive(page, '!!document.querySelector(".pl-summary")')
            page.screenshot(path=str(OUT / f'summary_free_{name}.png'), full_page=True)
            C.ok(ok and not con.errors(), f'shots {name}: no console errors {con.errors()[:3]}')
            ctx.close()


# ---------- regression checks for the code review of 6 Nov 2026 ----------

def fresh(b):
    ctx = b.new_context(viewport={'width': 1366, 'height': 900})
    page = ctx.new_page()
    return ctx, page, Console(page)


def run_review(b, C):
    tag = 'review'
    ctx, page, con = fresh(b)
    boot(page, knobs=False)
    seen_all(page)
    page.evaluate('PX.core.store.state.ui.seen = Object.assign(PX.core.store.state.ui.seen || {}, { motionNotice: Date.now() })')
    # 1, 13: a pause during Span's sequence: the item is inert, keys typed meanwhile do nothing, and
    # after Resume the answer goes through (collect() waits for the resume)
    go(page, {'mode': 'free', 'exId': 'span', 'run': '1', 'trials': 5})
    page.wait_for_function('__play.state === "present"', timeout=15000)
    page.keyboard.press('Escape')
    wait_state(page, 'paused')
    C.ok(page.evaluate('document.querySelector(".pl-host").hasAttribute("inert") && document.querySelector(".pl-grid").hasAttribute("inert")'), f'{tag} 13: the item under the pause sheet is inert')
    page.wait_for_function('(document.querySelector(".ex-span-stem") || { getAttribute: () => null }).getAttribute("data-phase") === "recall"', timeout=30000)
    for _ in range(page.evaluate('__play.item.len')):
        page.keyboard.press('1')
        page.wait_for_timeout(40)
    C.ok(page.evaluate('__play.state') == 'paused' and page.evaluate('__play.last') is None, f'{tag} 1: digits typed while paused do nothing')
    page.keyboard.press('Escape')
    wait_state(page, 'respond')
    labels = page.evaluate('__play.key.map(id => document.querySelector(`.ex-span-tag[data-id="${id}"]`).getAttribute("data-label"))')
    for d in labels:
        page.keyboard.press(d)
        page.wait_for_timeout(40)
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
    C.ok(page.evaluate('__play.last.source') == 'key' and page.evaluate('__play.last.voidReason') == 'paused', f'{tag} 1: after Resume Span takes the answer (void: paused while it played)')
    # 4: Pause → Skip during the stimulus never leaves a frame monitor running
    page.evaluate('PX.debug.fast(false)')
    go(page, {'mode': 'free', 'exId': 'span', 'run': '1', 'trials': 10})
    counts = []
    for _ in range(3):
        page.wait_for_function('__play.state === "present"', timeout=15000)
        counts.append(page.evaluate('PX.bus.count("stage3d:lost")'))
        page.keyboard.press('Escape')
        wait_state(page, 'paused')
        page.locator('[data-skip]').click()
    page.wait_for_function('__play.state === "present"', timeout=15000)
    counts.append(page.evaluate('PX.bus.count("stage3d:lost")'))
    C.ok(len(set(counts)) == 1, f'{tag} 4: no frame monitor left behind by skips ({counts})')
    # 3: the keys sheet pauses the item: its clock and time limit stop until it closes
    page.evaluate('PX.debug.fast(true)')
    go(page, {'mode': 'free', 'exId': 'spin', 'run': '1', 'trials': 5})
    wait_state(page, 'respond')
    page.keyboard.press('?')
    page.wait_for_timeout(150)
    C.ok(page.evaluate('PX.ui.modalOpen()') == 1 and page.evaluate('__play.state') == 'paused', f'{tag} 3: the keys sheet pauses the item ({page.evaluate("__play.state")})')
    page.wait_for_timeout(1500)
    page.keyboard.press('Escape')
    wait_state(page, 'respond')
    page.evaluate('__play.answer(true)')
    wait_state(page, 'reveal')
    C.ok(page.evaluate('__play.last.rtMs') < 1200, f'{tag} 3: time under the sheet is not answer time ({page.evaluate("__play.last.rtMs")} ms)')
    # 5: Pattern Memory unmounted during its exposure: present resolves, nothing throws
    n0 = len(con.errors())
    res = page.evaluate('''async () => {
      const v = PX.ex.view('patterns'), def = PX.ex.get('patterns');
      const host = document.createElement('div'); document.body.appendChild(host);
      const ctx = { host, keys: PX.core.keys, fast: false, settings: {}, stage3d: PX.core.stage3d, svg: PX.core.svg, ui: PX.ui, timing: PX.core.timing };
      v.mount(ctx);
      const item = def.generate(PX.rng(7), PX.ui.play.fillParams(def, {}));
      let resolved = false;
      v.present(item, ctx).then(() => { resolved = true; });
      await new Promise(r => setTimeout(r, 400));
      v.unmount();
      await new Promise(r => setTimeout(r, 1500));
      host.remove();
      return resolved;
    }''')
    C.ok(res is True and len(con.errors()) == n0, f'{tag} 5: Pattern Memory unmounted mid-exposure resolves without errors ({res}, {con.errors()[n0:][:2]})')
    # 3 (v1.1, I1 T4): a reload on a #/play route never starts a session by itself: Today opens
    page.goto('about:blank')
    page.goto(INDEX.as_uri() + '#/play?mode=free&exId=spin&run=1&trials=5')
    page.wait_for_function(READY, timeout=20000)
    page.evaluate('PX.ui.hooks && PX.ui.hooks.mute(true)')  # as boot() does: a reload brings every builder's hook back
    page.wait_for_timeout(1200)
    st = page.evaluate('__play.state')
    # v1.2 (gap C2): a later launch shows the one-tap Chimera card (not a modal), and on a play route it waits
    # until the person leaves it; either way nothing starts by itself
    C.ok(st not in ('present', 'respond') and page.evaluate('!document.querySelector(".px-modal[data-welcome]")'), f'{tag} 3: after a reload no item runs and the full welcome stays closed ({st})')
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    # the session the reload cut shows its kept summary; nothing starts by itself
    C.ok(page.locator('[data-restored] .pl-summary').count() == 1 and page.evaluate('__play.state') == 'idle', f'{tag} 3: a #/play hash at boot shows the cut session\'s summary, no new session')
    # a session started while a modal is open: the first item waits for it to close
    page.evaluate('''PX.core.router.go("play", { mode: "free", exId: "spin", run: "1", trials: 5 }, { force: true });
      void PX.ui.modal({ title: "Test", body: [], actions: [{ label: "Close", kind: "secondary" }] });''')
    page.wait_for_timeout(1200)
    st = page.evaluate('__play.state')
    C.ok(page.evaluate('PX.ui.modalOpen()') >= 1 and st not in ('present', 'respond'), f'{tag} 3: under the pop-up no item runs ({st})')
    page.keyboard.press('Escape')
    wait_state(page, 'respond')
    page.evaluate('PX.debug.fast(true); __play.answer(true)')
    wait_state(page, 'reveal')
    C.ok(page.evaluate('__play.last.rtMs') < 1200, f'{tag} 3: its clock starts after the pop-up ({page.evaluate("__play.last.rtMs")} ms)')
    # 10: Esc on Track's motion notice (first Track trial of this page load) voids nothing
    page.evaluate('PX.debug.fast(true); delete PX.core.store.state.ui.seen.motionNotice')
    go(page, {'mode': 'free', 'exId': 'track', 'run': '1', 'trials': 3})
    page.wait_for_function('__play.state === "present" && PX.ex.view("track").phase() === "notice"', timeout=20000)
    page.keyboard.press('Escape')
    wait_state(page, 'paused')
    voided = page.evaluate('PX.ui.play.current().voided')
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    page.locator('.ex-track-notice .px-btn').first.click()
    wait_state(page, 'respond', 30000)
    page.evaluate('__play.answer(true)')
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
    C.ok(voided is False and page.evaluate('__play.last.voidReason') != 'paused', f'{tag} 10: a pause on the motion notice voids nothing ({voided}, {page.evaluate("__play.last.voidReason")})')
    # QA 2: Space during show me pauses it (the focused Next waits until it ends or is closed)
    page.evaluate('PX.debug.fast(false)')
    go(page, {'mode': 'free', 'exId': 'rotate', 'params': {'angle': 1, 'axis': 0, 'cubes': 0, 'variant': 'samediff'}, 'trials': 3})
    wait_state(page, 'respond')
    page.evaluate('__play.answer(false)')
    page.wait_for_function('__play.state === "showme"', timeout=8000)
    page.keyboard.press('Space')
    page.wait_for_timeout(200)
    C.ok(page.evaluate('__play.state') == 'showme' and page.locator('.pl-showme-buttons .px-btn').first.inner_text().startswith('Resume'), f'{tag} QA2: Space pauses show me ({page.evaluate("__play.state")})')
    page.keyboard.press('Escape')
    wait_state(page, 'reveal')
    page.evaluate('PX.debug.fast(true)')
    # QA 17: How to play opens at its title
    page.evaluate('void PX.ui.play.howTo("rotate")')
    page.wait_for_timeout(300)
    top = page.evaluate('(() => { const d = document.querySelector(".px-modal.pl-howto"); return [d.scrollTop, d.parentNode.scrollTop, d.getBoundingClientRect().top >= 0]; })()')
    C.ok(top[0] == 0 and top[1] == 0 and top[2], f'{tag} QA17: How to play opens at the top ({top})')
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    # QA 32: Train counts down minutes and names its exercises
    go(page, {'mode': 'train'})
    wait_state(page, 'respond')
    meta = page.locator('.pl-hud-meta').inner_text()
    C.ok('min left' in meta and page.locator('.pl-session-line').count() == 1, f'{tag} QA32: minutes left and the session line ({meta!r})')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()

    # 9, 6: a fresh profile, where Watch, Try, Go is offered
    ctx, page, con = fresh(b)
    boot(page)
    depth0 = page.evaluate('PX.core.keys.depth()')
    go(page, {'mode': 'free', 'exId': 'fold', 'run': '1', 'trials': 5})
    page.wait_for_selector('[data-card-box=wtg-offer]', timeout=8000)
    page.locator('.px-header [data-nav="library"]').click()
    page.wait_for_timeout(300)
    d1 = page.evaluate('PX.core.keys.depth()')
    n0 = len(con.errors())
    page.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur()')
    page.keyboard.press('Space')
    page.wait_for_timeout(300)
    C.ok(d1 == depth0 and len(con.errors()) == n0 and page.evaluate('PX.core.store.state.tour.seen.fold') is not True,
         f'{tag} 9: leaving with a card open drops its key layer (depth {depth0} → {d1}; errors {con.errors()[n0:][:1]})')
    go(page, {'mode': 'free', 'exId': 'rotate', 'run': '1', 'trials': 5})
    page.wait_for_selector('[data-card-box=wtg-offer]', timeout=8000)
    page.locator('[data-card-box] [data-card="go"]').click()
    page.wait_for_function('__play.state === "respond" && !!document.querySelector("[data-wtg]") && __play.played.demos >= 1', timeout=30000)
    page.keyboard.press('Escape')
    wait_state(page, 'paused')
    page.locator('[data-end]').click()
    page.wait_for_selector('.pl-summary', timeout=8000)
    C.ok(page.evaluate('__play.session === null || __play.session.done !== false'), f'{tag} 6: End session during Watch, Try, Go ends the session')
    C.ok(not con.errors(), f'{tag} fresh: no console errors {con.errors()[:3]}')
    ctx.close()

    # 15: the Spatial Check: one free skip per task, later skips count as wrong
    ctx, page, con = fresh(b)
    boot(page)
    seen_all(page)
    go(page, {'mode': 'check'})
    click_card(page, 'start')
    if card(page) == 'expect':
        page.locator('[data-expect="3"]').click()
        page.wait_for_timeout(150)
    click_card(page, 'skip' if page.locator('[data-card-box] [data-card="skip"]').count() else 'start')
    wait_state(page, 'respond')
    rows0 = page.evaluate('PX.core.store.state.trials.length')
    page.keyboard.press('Escape')
    wait_state(page, 'paused')
    free_label = page.locator('[data-skip]').inner_text()
    page.locator('[data-skip]').click()
    past_cards(page)
    page.keyboard.press('Escape')
    wait_state(page, 'paused')
    label2 = page.locator('[data-skip]').inner_text()
    page.locator('[data-skip]').click()
    past_cards(page)
    rows = page.evaluate(f'PX.core.store.state.trials.slice({rows0}).map(r => r[5])')
    C.ok(free_label.startswith('Skip this item') and label2.startswith('Skip (counts as wrong)'), f'{tag} 15: the skip button says when a skip counts ({free_label!r}, {label2!r})')
    C.ok(rows == [3, 0], f'{tag} 15: the first skip is free, the second is scored wrong (outcomes {rows})')
    C.ok(not con.errors(), f'{tag} check: no console errors {con.errors()[:3]}')
    ctx.close()


def run_reload(b, C):
    """A reload (or a closed tab) in the middle of a session saves it, as leaving its screen does."""
    tag = 'reload'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    go(page, {'mode': 'train'})
    for _ in range(3):
        wait_state(page, 'respond')
        page.evaluate('__play.answer(true)')
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme"')
        page.evaluate('__play.next()')
    wait_state(page, 'respond')
    n0 = page.evaluate('PX.core.store.state.sessions.length')
    page.reload()
    page.wait_for_function(READY, timeout=20000)
    s = page.evaluate('PX.core.store.state.sessions')
    # a session counts right and wrong answers; a trial voided by a stutter (a loaded machine) is logged but not counted
    scored = page.evaluate('''(() => { const r = PX.core.store.state, mi = r.idx.mode.indexOf("train");
      return r.trials.filter(t => t[2] === mi && (t[5] === 0 || t[5] === 1)).length; })()''')
    C.ok(len(s) == n0 + 1 and s[-1]['mode'] == 'train' and scored >= 1 and s[-1]['trials'] == scored, f'{tag}: the session cut by a reload is saved ({len(s) - n0} new, {s[-1]["trials"] if s else None} answered, {scored} scored rows)')
    C.ok(row_count(page, 'train') == 3, f'{tag}: its trials are logged once ({row_count(page, "train")} rows)')
    C.ok(page.evaluate('PX.core.router.current().name') == 'play', f'{tag}: the app opens on the play screen again')
    # v1.1 (I1 T4): the reopened page shows that session's summary; it never starts a new session
    for _ in range(4):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
    C.ok(s[-1].get('ended') == 'closed', f'{tag}: the cut session is marked as closed ({s[-1].get("ended")})')
    C.ok(page.locator('[data-restored] .pl-summary').count() == 1 and page.evaluate('__play.state') == 'idle', f'{tag}: the reopened page shows its summary, no new session')
    C.ok('page closed' in page.locator('.px-screen-head').first.inner_text(), f'{tag}: the summary says the page closed during it')
    page.reload()
    page.wait_for_function(READY, timeout=20000)
    page.wait_for_timeout(300)
    C.ok(page.evaluate('PX.core.store.state.sessions.length') == n0 + 1 and page.locator('[data-restored] .pl-summary').count() == 1, f'{tag}: a second reload shows the summary again and adds nothing')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


# v1.2 wave 1 (docs/dev/CONTRACT-v1.2.md D, E, F, G, K): two stub exercises defined in the page:
# 'qtest' (Quick deadline from def.pace, round scores) and 'mtest' (a view that moves on its own).
STUBS_JS = """() => {
  if (PX.ex.get('qtest')) return true;
  const base = { abilities: ['Vz'], role: 'train', answer: 'choice', nOptions: 4, dims: [{ key: 'a', levels: [0, 1], step: 0.5 }], base: -1,
    validate: () => true, score: (item, r) => ({ correct: r === item.key }) };
  PX.ex.define(Object.assign({ id: 'qtest', code: 'EX-97', name: 'Quick stub', variants: ['quick', 'exact'], trainVariants: ['quick'],
    pace: { variants: ['quick'], startMs: 4000, minMs: 1000, maxMs: 8000 },
    roundScore: (item, result, info) => (result.correct ? 90 : info.timeout ? 5 : 10),
    generate: (rng, params) => ({ ex: 'qtest', seed: rng.seed, params, key: rng.seed % 4 }) }, base));
  PX.ex.define(Object.assign({ id: 'mtest', code: 'EX-96', name: 'Motion stub', generate: (rng, params) => ({ ex: 'mtest', seed: rng.seed, params, key: rng.seed % 4 }) }, base));
  const view = (id, motion) => ({ layout: 'stem+options', motion,
    present: (item, ctx) => { ctx.host.textContent = id + ' item'; if (motion && ctx.addMotion) ctx.addMotion(100000); return PX.core.timing.nextPaint(); },
    drawOption: (el, item, i) => { el.textContent = 'ABCD'[i]; } });
  PX.ex.define(Object.assign({ id: 'dtest', code: 'EX-95', name: 'Deadline stub', generate: (rng, params) => ({ ex: 'dtest', seed: rng.seed, params, key: rng.seed % 4, deadlineMs: 3000 }) }, base));
  PX.ex.view('qtest', view('qtest', false));
  PX.ex.view('mtest', view('mtest', true));
  PX.ex.view('dtest', view('dtest', false));
  PX.ex.learn('dtest', { goal: 'Pick the letter.', practice: [{ a: 0 }] });
  ['qtest', 'mtest'].forEach((id) => { PX.core.store.state.tour.seen[id] = true; });
  window.__ev = { trial: 0, screen: [], summary: 0, slot: false, session: 0 };
  PX.bus.on('play:trial', () => { __ev.trial++; });
  PX.bus.on('play:screen', (e) => { __ev.screen.push(e.screen); });
  PX.bus.on('play:summary', (e) => { __ev.summary++; __ev.slot = !!(e.slot && e.slot.classList.contains('pl-playtest-slot')); });
  PX.bus.on('play:session', () => { __ev.session++; });
  return true;
}"""


def run_v12(b, C):
    tag = 'v1.2'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    page.evaluate(STUBS_JS)
    # E: the Quick deadline and round scores (Free play on the Quick variant: the current deadline, never moved)
    go(page, {'mode': 'free', 'exId': 'qtest', 'params': {'a': 0, 'variant': 'quick'}, 'trials': 3})
    wait_state(page, 'respond')
    C.ok(page.evaluate('!document.querySelector(".pl-limit").hidden'), f'{tag} E: a Quick item shows its countdown')
    page.evaluate('__play.answer(true)')
    wait_state(page, 'reveal')
    C.ok(page.locator('.pl-verdict-round[data-round="90"]').count() == 1, f'{tag} E: the verdict shows the round score')
    page.evaluate('PX.ui.play.config.limitScale = 0.05')  # the next deadline passes in about 0.2 s
    page.evaluate('PX.ui.play.current().goNext()')
    page.wait_for_function('__play.state === "reveal" && __play.last && __play.last.timeout === true', timeout=8000)
    C.ok(page.locator('.pl-verdict-round[data-round="5"]').count() == 1, f'{tag} E: a time-out still gets its round score')
    page.evaluate('PX.ui.play.config.limitScale = 1')
    # K (O4): Pause while feedback shows: Resume puts it back; End ends the session
    page.keyboard.press('Escape')
    wait_state(page, 'paused')
    C.ok(page.locator('[data-skip]').is_hidden() and page.locator('[data-end]').is_visible(), f'{tag} K: the pause between items offers End, not Skip')
    page.locator('[data-resume]').click()
    wait_state(page, 'reveal')
    page.locator('[data-pause]').click()
    wait_state(page, 'paused')
    page.locator('[data-end]').click()
    page.wait_for_function('!!document.querySelector(".pl-summary")', timeout=8000)
    C.ok(page.locator('.pl-res-stats', has_text='round score 95 over 2 rounds').count() == 1, f'{tag} E: the summary sums the round scores ({page.locator(".pl-res-stats").first.inner_text()[:90]})')
    C.ok(page.evaluate('__ev.summary === 1 && __ev.slot && __ev.trial >= 2 && __ev.session === 1'), f'{tag} G: playtest events (trial, summary with its slot, session) {page.evaluate("JSON.stringify(__ev)")[:160]}')
    C.ok(page.evaluate('(() => { const s = PX.core.store.state.sessions; const x = s[s.length - 1]; return !!(x && x.rounds && x.rounds.qtest && x.rounds.qtest[0] === 2 && x.ended === "early"); })()'), f'{tag} E: the session keeps its round scores and ended early')
    # F: motion comfort: the one-time notice, then a check-in after 3 minutes of motion
    page.evaluate('delete PX.core.store.state.ui.seen.walkNotice; PX.core.store.state.ui.motionMs = 3600000')
    go(page, {'mode': 'free', 'exId': 'mtest', 'params': {'a': 0}, 'trials': 4})
    page.wait_for_selector('[data-card-box="motion-notice"]', timeout=8000)
    C.ok(state(page) not in ('present', 'respond'), f'{tag} F: the motion notice comes before the item')
    page.locator('[data-card-box="motion-notice"] [data-card="start"]').click()
    wait_state(page, 'respond')
    page.evaluate('__play.answer(true)')
    wait_state(page, 'reveal')
    page.evaluate('PX.ui.play.current().goNext()')
    wait_state(page, 'respond')
    page.evaluate('__play.answer(true)')
    wait_state(page, 'reveal')
    page.evaluate('PX.ui.play.current().goNext()')
    page.wait_for_selector('[data-card-box="motion-checkin"]', timeout=8000)
    C.ok(state(page) not in ('present', 'respond'), f'{tag} F: the check-in card comes between items after 3 minutes of motion')
    page.locator('[data-card-box="motion-checkin"] [data-card="gentle"]').click()
    wait_state(page, 'respond')
    C.ok(page.evaluate('PX.core.store.state.settings.gentleMotion === "on" && PX.ui.play.current().ctx.gentleMotion === true'), f'{tag} F: "Gentle motion" turns the profile on')
    page.evaluate('PX.ui.play.current().skip(true)')
    page.wait_for_function('!!document.querySelector(".pl-summary")', timeout=8000)
    C.ok(page.evaluate('(() => { const s = PX.core.store.state.sessions; return s[s.length - 1].gentle === true; })()'), f'{tag} F: the session notes the gentle profile')
    # D: the teaching template on an exercise with learn.rules (Angles): rules card, Watch, strategy card, Try 1
    page.evaluate('PX.core.store.state.settings.gentleMotion = "auto"')
    # a worked example before Angles' second Try item (checked below)
    page.evaluate('''() => { const L = PX.ex.learn('angles'), p = L.practice[1];
      L.practice[1] = Object.assign({}, p && p.params ? p : { params: p }, { example: { seed: 77 } }); }''')
    page.evaluate('void PX.core.router.go("play", { mode: "watch", exId: "angles" }, { force: true })')
    page.wait_for_selector('[data-card-box="wtg-rules"]', timeout=8000)
    n_rules = page.locator('[data-card-box="wtg-rules"] .pl-rule').count()
    C.ok(n_rules >= 2 and page.locator('[data-wtg]').count() == 1, f'{tag} D: the rules card opens Watch, Try, Go ({n_rules} rules)')
    page.screenshot(path=str(OUT / 'v12_rules_1366.png'))
    page.locator('[data-card-box="wtg-rules"] [data-card="watch"]').click()
    page.wait_for_function('document.querySelector("[data-turn-skip]") || __play.state === "respond"', timeout=20000)
    page.wait_for_selector('[data-turn-skip], [data-next]:not([hidden])', timeout=20000)
    page.evaluate('__play.answer(true)')
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
    page.evaluate('PX.ui.play.current().goNext()')
    page.wait_for_selector('[data-card-box="wtg-strategy"]', timeout=8000)
    C.ok(page.locator('[data-card-box="wtg-strategy"] ol li').count() >= 2, f'{tag} D: the strategy card comes before Try 1')
    page.locator('[data-card-box="wtg-strategy"] [data-card="try"]').click()
    wait_state(page, 'respond')
    C.ok(page.locator('[data-howto]').is_visible(), f'{tag} D: "How to solve" is in the HUD during Try')
    page.locator('[data-howto]').click()
    page.wait_for_timeout(200)
    C.ok(page.evaluate('PX.ui.modalOpen()') >= 1 and state(page) == 'paused', f'{tag} D: "How to solve" opens the card and pauses the item')
    page.keyboard.press('Escape')
    wait_state(page, 'respond')
    C.ok('wtg-rules' in page.evaluate('__ev.screen') and 'wtg-try' in page.evaluate('__ev.screen'), f'{tag} G: screen events for the tutorial {page.evaluate("__ev.screen")[-6:]}')
    # D: a worked example before a Try item (practice entry `example`), Angles' second Try item
    page.evaluate('__play.answer(true)')
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
    page.evaluate('PX.ui.play.current().goNext()')
    page.wait_for_function('(document.querySelector(".pl-wtg-text") || {}).textContent.startsWith("Try: first one more item")', timeout=8000)
    C.ok(True, f'{tag} D: a worked example plays before the Try item it belongs to')
    page.wait_for_selector('[data-turn-skip]', timeout=20000)
    page.locator('[data-turn-skip]').click()
    wait_state(page, 'respond')
    C.ok(page.evaluate('(document.querySelector(".pl-wtg-text") || {}).textContent').startswith('Try: practice item 2'), f'{tag} D: then the Try item comes ({page.evaluate("(document.querySelector(\".pl-wtg-text\") || {}).textContent")!r})')
    # D: a Try item with its own deadline runs with the countdown
    page.evaluate('void PX.core.router.go("play", { mode: "watch", exId: "dtest" }, { force: true })')
    wait_state(page, 'respond')
    C.ok(page.evaluate('!document.querySelector(".pl-limit").hidden && PX.ui.play.current().cfg.limitMs === 3000'), f'{tag} D: a Try item with item.deadlineMs runs with that deadline')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()
    # D on a phone (360 × 640): the rules card and the strategy card are on screen, with 44 px buttons
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    page.evaluate('void PX.core.router.go("play", { mode: "watch", exId: "angles" }, { force: true })')
    page.wait_for_selector('[data-card-box="wtg-rules"]', timeout=8000)
    page.wait_for_timeout(200)
    box = page.locator('[data-card-box="wtg-rules"] [data-card="watch"]').bounding_box()
    C.ok(box is not None and box['y'] + box['height'] <= 640 and box['height'] >= 43.5, f'{tag} D phone: the rules card and its button fit 360 × 640 ({box})')
    C.ok(page.evaluate('document.documentElement.scrollWidth <= 360'), f'{tag} D phone: no horizontal scroll')
    page.screenshot(path=str(OUT / 'v12_rules_360.png'))
    page.locator('[data-card-box="wtg-rules"] [data-card="watch"]').tap()
    page.wait_for_function('__play.state === "respond"', timeout=20000)
    page.evaluate('__play.answer(true)')
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
    page.evaluate('PX.ui.play.current().goNext()')
    page.wait_for_selector('[data-card-box="wtg-strategy"]', timeout=8000)
    page.wait_for_timeout(200)
    box = page.locator('[data-card-box="wtg-strategy"] [data-card="try"]').bounding_box()
    C.ok(box is not None and box['y'] + box['height'] <= 640, f'{tag} D phone: the strategy card fits ({box})')
    page.screenshot(path=str(OUT / 'v12_strategy_360.png'))
    C.ok(not con.errors(), f'{tag} phone: no console errors {con.errors()[:3]}')
    ctx.close()


def run_captions(b, C):
    """v1.2 decision (fresh-player tests): a Watch caption waits for a tap (Next, Enter or a tap on the
    figure); captions during motion keep the timed pace (at least 3 s) and the motion ends with a
    Next; Auto-play brings back the timed pace. Driven on the runner with steps of known shape."""
    tag = 'captions'
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    go(page, {'mode': 'free', 'exId': 'rotate', 'params': {'angle': 0, 'axis': 0, 'cubes': 0, 'variant': 'pick'}, 'trials': 3})
    wait_state(page, 'respond')
    page.evaluate('PX.debug.fast(false); PX.core.store.state.ui.autoplay = false')
    start = """(steps) => { const P = PX.ui.play.current(); P.demoing = true; window.__log = []; window.__done = false;
      const mk = (s) => Object.assign({ ms: s.ms || 300, enter() { __log.push(s.name); } }, s.cap ? { caption: s.cap } : {},
        s.motion !== undefined ? { motion: s.motion } : {}, s.anim ? { update() {} } : {});
      P.ctx.play(steps.map(mk)).then(() => { __done = true; P.demoing = false; }); }"""
    probe = """() => ({ cap: document.querySelector('.pl-caption').textContent, waiting: document.querySelector('.pl-showme').hasAttribute('data-waiting'),
      log: __log.join(' '), done: __done, next: !document.querySelector('[data-showme-next]').hidden, step: !document.querySelector('.pl-showme-buttons .px-btn:nth-child(2)').hidden,
      auto: document.querySelector('[data-showme-auto]').getAttribute('aria-pressed'), pause: document.querySelector('.pl-showme-buttons .px-btn').hidden })"""
    page.evaluate(start, [{'name': 'a', 'cap': 'A'}, {'name': 'a2', 'anim': True}, {'name': 'b', 'cap': 'B', 'motion': True}, {'name': 'c', 'cap': 'C', 'motion': True}, {'name': 'd', 'cap': 'D'}])
    page.wait_for_timeout(4200)
    s1 = page.evaluate(probe)
    C.ok(s1['cap'] == 'A' and s1['waiting'] and s1['log'] == 'a a2' and s1['next'] and not s1['step'] and s1['pause'], f'{tag}: a still caption waits for Next after its steps; the bar has no Pause of its own, the header\'s is the one (round 3) ({s1})')
    page.locator('[data-showme-next]').tap()
    page.wait_for_timeout(1500)
    s2 = page.evaluate(probe)
    C.ok(s2['cap'] == 'B' and not s2['waiting'], f'{tag}: Next goes on; a caption during motion plays on its own ({s2})')
    page.wait_for_timeout(2300)
    s3 = page.evaluate(probe)
    C.ok(s3['cap'] in ('B', 'C') and not s3['waiting'], f'{tag}: the motion goes on from caption to caption without a tap ({s3})')
    page.wait_for_function('document.querySelector(".pl-showme").hasAttribute("data-waiting")', timeout=12000)
    s4 = page.evaluate(probe)
    C.ok(s4['cap'] == 'C' and s4['log'] == 'a a2 b c', f'{tag}: the motion ends with a wait for Next ({s4})')
    page.locator('.pl-host').tap()
    page.wait_for_timeout(600)
    s5 = page.evaluate(probe)
    C.ok(s5['cap'] == 'D' and s5['log'] == 'a a2 b c d', f'{tag}: a tap on the figure is Next while a caption waits ({s5})')
    page.wait_for_function('document.querySelector(".pl-showme").hasAttribute("data-waiting")', timeout=8000)
    C.ok(page.locator('[data-showme-next]').inner_text().startswith('Your turn'), f'{tag}: at the last caption Next reads "Your turn" ({page.locator("[data-showme-next]").inner_text()!r})')
    page.keyboard.press('Enter')
    page.wait_for_function('__done === true', timeout=5000)
    C.ok(True, f'{tag}: Enter is Next, and the last caption ends the demo')
    # round 5: Next while a caption's steps still play finishes them and shows the next caption at once (one tap,
    # one new caption, as the line says), and so does a tap on the figure
    page.evaluate(start, [{'name': 'e', 'cap': 'E', 'ms': 4000, 'anim': True}, {'name': 'f', 'cap': 'F', 'ms': 4000, 'anim': True}, {'name': 'g0', 'cap': 'G0'}])
    page.wait_for_timeout(500)
    lab = page.locator('[data-showme-next]').inner_text()
    C.ok(lab.startswith('Next step'), f'{tag}: while a caption\'s steps play, Next reads "Next step" ({lab!r})')
    page.locator('[data-showme-next]').tap()
    page.wait_for_timeout(300)
    s6 = page.evaluate(probe)
    C.ok(s6['cap'] == 'F' and not s6['waiting'] and s6['log'] == 'e f', f'{tag}: Next during the animation of a caption finishes it and shows the next one ({s6})')
    page.wait_for_timeout(400)
    page.locator('.pl-host').tap()
    page.wait_for_timeout(300)
    s6b = page.evaluate(probe)
    lab2 = page.locator('[data-showme-next]').inner_text()
    C.ok(s6b['cap'] == 'G0' and lab2.startswith('Your turn'), f'{tag}: a tap on the figure does the same; the last caption says Your turn at once ({s6b["cap"]}, {lab2!r})')
    page.locator('.pl-showme-buttons .px-btn:nth-child(4)').tap()  # Close
    page.wait_for_function('__done === true', timeout=5000)
    # Auto-play: the timed pace, kept as the player's choice
    page.evaluate(start, [{'name': 'g', 'cap': 'G'}, {'name': 'h', 'cap': 'H'}])
    page.wait_for_timeout(500)
    page.locator('[data-showme-auto]').tap()
    t0 = page.evaluate('performance.now()')
    page.wait_for_function('__done === true', timeout=12000)
    s7 = page.evaluate(probe)
    dt = page.evaluate('performance.now()') - t0
    C.ok(s7['log'] == 'g h' and page.evaluate('PX.core.store.state.ui.autoplay === true'), f'{tag}: Auto-play plays the captions without taps, and is kept ({s7}, {dt:.0f} ms)')
    page.evaluate(start, [{'name': 'i', 'cap': 'I'}, {'name': 'j', 'cap': 'J'}])
    page.wait_for_timeout(2000)
    s8 = page.evaluate(probe)
    C.ok(s8['cap'] == 'I' and not s8['waiting'] and s8['auto'] == 'true', f'{tag}: with Auto-play each caption still stays at least 3 s ({s8})')
    page.locator('[data-showme-auto]').tap()  # back to taps: the caption now waits
    page.wait_for_timeout(1500)
    s9 = page.evaluate(probe)
    C.ok(s9['waiting'] and s9['auto'] == 'false' and page.evaluate('PX.core.store.state.ui.autoplay === false'), f'{tag}: Auto-play off makes the current caption wait ({s9})')
    page.locator('.pl-showme-buttons .px-btn:nth-child(4)').tap()
    page.wait_for_function('__done === true', timeout=5000)
    page.evaluate('PX.ui.play.current().demoing = false')
    # round 2: after a wrong answer the show-me's Next is "next caption" (as in Watch), never the next item
    page.evaluate('PX.core.store.state.ui.autoplay = false')
    page.evaluate('__play.answer(false)')
    page.wait_for_function('__play.state === "showme"', timeout=8000)
    seed0 = page.evaluate('__play.last && __play.last.item && __play.last.item.seed')
    page.wait_for_timeout(300)
    nx = page.locator('[data-showme-next]')
    C.ok(nx.is_visible() and not page.locator('.pl-showme-buttons .px-btn:nth-child(2)').is_visible(), f'{tag}: a show-me after an answer has Next in its bar and no Step')
    nx.tap()
    page.wait_for_timeout(400)
    st = page.evaluate('[__play.state, __play.last && __play.last.item && __play.last.item.seed]')
    C.ok(st[0] in ('showme', 'reveal') and st[1] == seed0, f'{tag}: that Next shows the next caption and stays on the item ({st}, seed {seed0})')
    page.locator('.pl-showme-buttons .px-btn:nth-child(4)').tap()  # Close
    page.wait_for_function('__play.state === "reveal"', timeout=8000)
    # round 2: a pause between items hides the strip under its card
    page.keyboard.press('Escape')
    page.wait_for_function('__play.state === "paused"', timeout=5000)
    vis = page.evaluate('getComputedStyle(document.querySelector(".pl-feedback")).visibility')
    C.ok(vis == 'hidden' and page.locator('.pl-pause-note').is_hidden(), f'{tag}: under a pause between items the strip is hidden ({vis})')
    page.locator('[data-end]').click()
    page.wait_for_selector('.pl-summary', timeout=8000)
    short = page.locator('.pl-week-short')
    C.ok(short.count() == 1 and '10 answers or 5 minutes' in short.inner_text(), f'{tag}: a session too short to count says why ({short.inner_text() if short.count() else None!r})')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


HOOKS_JS = """() => {
  if (window.__hk) return true;
  const H = PX.ui.hooks, base = { abilities: ['Vz'], role: 'train', answer: 'choice', nOptions: 4, dims: [{ key: 'a', levels: [0, 1], step: 0.5 }], base: -1,
    validate: () => true, score: (item, r) => ({ correct: r === item.key }) };
  PX.ex.define(Object.assign({ id: 'htest', code: 'EX-94', name: 'Hook stub', generate: (rng, params) => ({ ex: 'htest', seed: rng.seed, params, key: rng.seed % 4 }) }, base));
  PX.ex.view('htest', { layout: 'stem+options', present: (item, ctx) => { ctx.host.textContent = 'htest item ' + item.seed; return PX.core.timing.nextPaint(); },
    drawOption: (el, item, i) => { el.textContent = 'ABCD'[i]; } });
  PX.core.store.state.tour.seen.htest = true;
  const el = (tag, attr, text) => { const x = document.createElement(tag); x.setAttribute(attr, '1'); x.textContent = text; return x; };
  window.__hk = { start: [], before: [], notes: 0 };
  H.on('session:start', (ctx) => {
    if (ctx.plan.exs[0] !== 'htest') return null;
    __hk.start.push({ mode: ctx.mode, active: __play.session.activeMs, running: __play.session.running });
    return ctx.card({ id: 'hk-start', title: 'A test card', lines: ['Before the first item.'], actions: [{ label: 'Go on', value: 'go', primary: true }] }).then(() => null);
  }, { id: 'test.start' });
  H.on('item:before', (ctx) => {
    if (ctx.def.id !== 'htest') return null;
    __hk.before.push({ first: ctx.first, seed: ctx.step.seed, last: !!ctx.last, running: __play.session.running });
    if (__hk.before.length === 2) { ctx.step.seed = 4242; ctx.step.layer = 'calib-detail'; }
    return null;
  }, { id: 'test.before' });
  H.on('item:notes', (ctx) => (ctx.def.id === 'htest' ? (__hk.notes++, el('p', 'data-hk-note', 'A test note')) : null), { id: 'test.notes' });
  H.on('summary:panels', (ctx) => (ctx.plan && ctx.plan.exs && ctx.plan.exs[0] === 'htest' ? { el: el('section', 'data-hk-panel', 'A test panel'), order: 20, invite: 'plateau' } : null), { id: 'test.panel' });
  H.on('today:slots', () => [{ el: el('section', 'data-hk-after', 'After the session'), after: 'session' }, { el: el('section', 'data-hk-check', 'In place of the check'), replace: 'check' }], { id: 'test.slots' });
  H.on('today:session', () => 'A test line under the plan.', { id: 'test.line' });
  H.on('exercise:lines', (ctx) => ({ el: el('p', 'data-hk-line', 'A test line (' + ctx.where + ')') }), { id: 'test.lines' });
  H.on('settings:sections', () => ({ el: el('section', 'data-hk-set', 'A test section'), after: 'Training' }), { id: 'test.settings' });
  H.on('lab:panels', () => ({ el: el('section', 'data-hk-lab', 'A test panel'), after: 'Research export' }), { id: 'test.lab' });
  H.on('progress:panels', () => ({ el: el('section', 'data-hk-prog', 'A test meter'), replace: 'check' }), { id: 'test.progress' });
  H.on('about:sections', () => ({ el: el('section', 'data-hk-about', 'A test section'), after: 'hygiene' }), { id: 'test.about' });
  return true;
}"""


def prev_title(page, sel):
    return page.evaluate(f"""(() => {{ const x = document.querySelector({json.dumps(sel)}); const p = x && x.previousElementSibling;
      const t = p && p.querySelector('.px-panel-title, h2'); return p ? (p.getAttribute('data-slot') || p.getAttribute('data-section') || (t ? t.textContent.trim() : p.tagName)) : null; }})()""")


def run_hooks(b, C):
    """CONTRACT-v1.2 R (W2-core): the player and screen hooks in the app, and the phone check of the
    copy of Pause that stays at the top corner when an answer's scroll hides the title row."""
    tag = 'hooks'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    page.evaluate(HOOKS_JS)
    page.evaluate("PX.ui.hooks.mute((id) => id.startsWith('test.'))")  # only this test's own handlers
    go(page, {'mode': 'free', 'exId': 'htest', 'params': {'a': 0}, 'trials': 3})
    page.wait_for_selector('[data-card-box="hk-start"]', timeout=8000)
    st = page.evaluate('__hk.start[0]')
    C.ok(st == {'mode': 'free', 'active': 0, 'running': False} and state(page) not in ('present', 'respond'), f'{tag} session:start: its card shows before the first item, the clock not started ({st})')
    click_card(page, 'go')
    wait_state(page, 'respond')
    bf = page.evaluate('__hk.before')
    C.ok(len(bf) == 1 and bf[0]['first'] is True and bf[0]['last'] is False and bf[0]['running'] is True, f'{tag} item:before: before the first item, first true, the clock running ({bf})')
    page.evaluate('__play.answer(true)')
    wait_state(page, 'reveal')
    C.ok(page.locator('.pl-notes [data-hk-note]').count() == 1, f'{tag} item:notes: the note shows under the verdict')
    page.evaluate('__play.next()')
    wait_state(page, 'respond')
    it = page.evaluate('({ seed: __play.item.seed, layer: PX.ui.play.current().ctx.layer, before: __hk.before[1] })')
    C.ok(it['seed'] == 4242 and it['layer'] == 'calib-detail' and it['before']['first'] is False and it['before']['last'] is True,
         f'{tag} item:before: a new seed regenerates the item, the layer reaches the view ({it})')
    page.evaluate('__play.answer(false)')
    wait_state(page, 'reveal')
    row = last_row(page)
    C.ok(len(row) >= 18 and row[4] == 4242 and row[14] == 3 and row[15] == 1 and row[16] == 2,
         f'{tag} the row logs the seed, the layer (calib-detail 3), the answer mode (option 1) and the orientation (landscape 2): {row}')
    page.evaluate('__play.end()')
    page.wait_for_function('!!document.querySelector(".pl-summary")', timeout=8000)
    order = page.evaluate("""[...document.querySelectorAll('.pl-summary > *')].map((x) => x.hasAttribute('data-hk-panel') ? 'panel'
      : x.hasAttribute('data-invite') ? 'invite:' + x.getAttribute('data-invite') : (x.querySelector('.px-panel-title') || {}).textContent || x.className)""")
    C.ok('panel' in order and order[order.index('panel') + 1] == 'invite:plateau' and len([x for x in order if str(x).startswith('invite:')]) == 1,
         f'{tag} summary:panels: the panel is placed with the one invite of the screen ({order})')
    page.screenshot(path=str(OUT / 'hooks_summary_1366.png'))
    # Today: a slot after the session, one in place of the Spatial Check, a line under the plan
    page.evaluate('void PX.core.router.go("home")')
    page.wait_for_selector('.px-today', timeout=8000)
    t_after = prev_title(page, '[data-hk-after]')
    t_check = page.evaluate("""(() => { const x = document.querySelector('[data-hk-check]'); return x ? [x.getAttribute('data-slot'), x.classList.contains('px-slot--check'),
      document.querySelectorAll('.px-today > .px-slot--check').length] : null; })()""")
    C.ok(t_after == 'session' and t_check == ['check', True, 1], f'{tag} today:slots: after the session slot ({t_after}); in place of the check slot ({t_check})')
    C.ok(page.locator('.px-slot--session .px-session-note', has_text='A test line under the plan.').count() == 1, f'{tag} today:session: the line under the plan')
    page.screenshot(path=str(OUT / 'hooks_today_1366.png'))
    # the screens
    page.evaluate('void PX.core.router.go("exercise/rotate")')
    page.wait_for_selector('[data-section="level"]', timeout=8000)
    C.ok(page.locator('[data-section="level"] [data-hk-line]', has_text='(page)').count() == 1, f'{tag} exercise:lines: in the page\'s first section')
    page.evaluate('void PX.ui.play.howTo("rotate")')  # (without void, Playwright would call the close function it returns)
    page.wait_for_selector('.px-modal.pl-howto', timeout=8000)
    C.ok(page.locator('.pl-howto [data-hk-line]', has_text='(howto)').count() == 1, f'{tag} exercise:lines: in How to play')
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    page.evaluate('void PX.core.router.go("settings")')
    page.wait_for_selector('[data-hk-set]', timeout=8000)
    C.ok(prev_title(page, '[data-hk-set]') in ('training', 'Training'), f'{tag} settings:sections: after Training ({prev_title(page, "[data-hk-set]")})')
    page.evaluate('void PX.core.router.go("lab")')
    page.wait_for_selector('[data-hk-lab]', timeout=8000)
    C.ok(prev_title(page, '[data-hk-lab]') in ('export', 'Research export'), f'{tag} lab:panels: after Research export ({prev_title(page, "[data-hk-lab]")})')
    page.evaluate('void PX.core.router.go("progress")')
    page.wait_for_selector('[data-hk-prog]', timeout=8000)
    pg = page.evaluate("""(() => { const x = document.querySelector('[data-hk-prog]'); return [x.id, x.getAttribute('data-section'), document.querySelectorAll('[data-section="check"]').length]; })()""")
    C.ok(pg == ['px-prog-check', 'check', 1], f'{tag} progress:panels: in place of the check section, keeping its id ({pg})')
    page.evaluate('void PX.core.router.go("about")')
    page.wait_for_selector('[data-hk-about]', timeout=8000)
    C.ok(prev_title(page, '[data-hk-about]') == 'hygiene', f'{tag} about:sections: after Test hygiene ({prev_title(page, "[data-hk-about]")})')
    # events: Watch, Try, Go ends (wtg), with its Try item
    page.evaluate(STUBS_JS)
    page.evaluate('void PX.core.router.go("play", { mode: "watch", exId: "dtest" }, { force: true })')
    wait_state(page, 'respond')
    page.evaluate('__play.answer(true)')
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
    page.evaluate('PX.ui.play.current().goNext()')
    page.wait_for_function("PX.engine.events.list(PX.core.store.state, { kind: 'wtg', exId: 'dtest' }).length === 1", timeout=8000)
    ev = page.evaluate("PX.engine.events.list(PX.core.store.state, { kind: 'wtg', exId: 'dtest' })[0].data")
    C.ok(ev.get('result') == 'done' and ev.get('tries') == 1 and ev.get('right') == 1 and isinstance(ev.get('ms'), int), f'{tag} events: wtg when Watch, Try, Go ends ({ev})')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()
    # Phone (360 x 640, touch): the copy of Pause at the top corner once the title row has scrolled away
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    prm = page.evaluate("(() => { const d = PX.ex.get('openings'), p = {}; d.dims.forEach((x) => { p[x.key] = Math.floor((x.levels.length - 1) / 2); }); if (d.variants) p.variant = d.variants[0]; return p; })()")
    go(page, {'mode': 'free', 'exId': 'openings', 'params': prm, 'trials': 4})
    drive(page, '__play.state === "respond"', limit=60)  # through the intro card
    page.evaluate('__play.answer(false)')
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
    page.wait_for_timeout(400)
    # the answer's own scroll, then (if the page is short) a scroll by hand until the title row is gone
    page.evaluate("""(() => { const hud = document.querySelector('.pl-player .pl-hud') || document.querySelector('.pl-hud');
      const r = hud.getBoundingClientRect(); if (r.bottom > 0) { document.body.style.paddingBottom = '1200px'; window.scrollBy(0, r.bottom + 40); } })()""")
    page.wait_for_timeout(400)
    fp = page.evaluate("""(() => { const b = document.querySelector('[data-float-pause]'); const r = b.getBoundingClientRect(), st = getComputedStyle(b);
      return { off: document.querySelector('.pl-player').hasAttribute('data-hud-off'), display: st.display, top: Math.round(r.top), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) }; })()""")
    C.ok(fp['off'] and fp['display'] != 'none' and 0 <= fp['top'] <= 40 and fp['right'] <= 360 and fp['w'] >= 43.5 and fp['h'] >= 43.5,
         f'{tag} phone: the copy of Pause shows at the top corner, a 44 px target, while the title row is out of view ({fp})')
    page.screenshot(path=str(OUT / 'hooks_float_pause_360.png'))
    page.locator('[data-float-pause]').tap()
    page.wait_for_timeout(200)
    C.ok(state(page) == 'paused', f'{tag} phone: a tap on it pauses ({state(page)})')
    page.locator('[data-resume]').first.tap()
    page.wait_for_timeout(200)
    page.evaluate("document.body.style.paddingBottom = ''; window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    hid = page.evaluate("getComputedStyle(document.querySelector('[data-float-pause]')).display")
    C.ok(hid == 'none', f'{tag} phone: hidden again once the title row is back ({hid})')
    C.ok(not con.errors(), f'{tag} phone: no console errors {con.errors()[:3]}')
    ctx.close()


TRIAL_TOP = "(() => { const t = document.querySelector('.pl-trial').getBoundingClientRect(); return Math.round(t.top + window.scrollY); })()"


def run_round3(b, C):
    """Fresh-player round 3 (W2-core, 18 Nov): the trial stays put at the first answer (Train's session
    line leaves with the next item), the limit's label, the pause sheet hides the time bar, a walkthrough
    after a time-out starts after the verdict and ignores taps from the item at first, the feedback's
    Next takes no tap right after a walkthrough, and the labels Finish step, Next step and Next item."""
    tag = 'round 3'
    for w, h, mobile in ((1366, 768, False), (360, 640, True)):
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if mobile else 1, has_touch=mobile, is_mobile=mobile)
        page = ctx.new_page()
        con = Console(page)
        boot(page)
        seen_all(page)
        page.evaluate('PX.ui.play.config.budgetMs = 60000')
        # Angles (SVG): a 3D item can be voided by the headless renderer's stalls, and a voided answer
        # is not an answer (the line waits for the first counted one)
        go(page, {'mode': 'train', 'exId': 'angles', 'count': 1})
        drive(page, '__play.state === "respond"', limit=80)
        page.wait_for_timeout(300)
        line = page.evaluate("!!document.querySelector('.pl-session-line')")
        y0 = page.evaluate(TRIAL_TOP)
        page.evaluate('__play.answer(true)')
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
        page.wait_for_timeout(400)
        y1 = page.evaluate(TRIAL_TOP)
        C.ok(line and abs(y1 - y0) <= 1, f'{tag} {w}: the trial stays put at the first answer (the session line waits for the next item): {y0} -> {y1}')
        C.ok(page.locator('[data-next]').inner_text().strip().startswith('Next item'), f'{tag} {w}: the feedback\'s Next reads "Next item" ({page.locator("[data-next]").inner_text()!r})')
        counted = page.evaluate('__play.session.answered')
        page.evaluate('__play.next()')
        wait_state(page, 'respond')
        C.ok(counted == 1 and page.locator('.pl-session-line').count() == 0, f'{tag} {w}: the session line is gone with the next item (answers counted: {counted})')
        C.ok(not con.errors(), f'{tag} {w}: no console errors {con.errors()[:3]}')
        ctx.close()
    # the limit's label, inside the margin; hidden under the pause sheet (phone)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    page.evaluate(STUBS_JS)
    go(page, {'mode': 'free', 'exId': 'qtest', 'params': {'a': 0, 'variant': 'quick'}, 'trials': 3})
    wait_state(page, 'respond')
    lim = page.evaluate("""(() => { const l = document.querySelector('.pl-limit'), cs = getComputedStyle(l, '::before'), r = l.getBoundingClientRect();
      const sp = document.createElement('span'); sp.style.cssText = 'position:absolute;white-space:nowrap;font:' + cs.font + ';letter-spacing:' + cs.letterSpacing;
      sp.textContent = l.getAttribute('data-label'); document.body.appendChild(sp); const w = sp.getBoundingClientRect().width; sp.remove();
      const gap = parseFloat(cs.right) - r.width; const wrap = document.querySelector('.pl-trial').getBoundingClientRect();
      return { label: l.getAttribute('data-label'), left: Math.round(r.left - gap - w), trialLeft: Math.round(wrap.left) }; })()""")
    C.ok(lim['label'] == 'Limit · 4 s' and lim['left'] >= lim['trialLeft'] - 1, f'{tag}: the bar\'s label is the limit, inside the page margin ({lim})')
    page.locator('[data-pause]').click()
    wait_state(page, 'paused')
    vis = page.evaluate("getComputedStyle(document.querySelector('.pl-limit')).visibility")
    C.ok(vis == 'hidden', f'{tag}: the time bar and its label hide under the pause sheet ({vis})')
    page.locator('[data-resume]').first.click()
    wait_state(page, 'respond')
    C.ok(not con.errors(), f'{tag} limit: no console errors {con.errors()[:3]}')
    ctx.close()
    # a walkthrough after a time-out (Central Point's Quick form, real pace): after the verdict; taps from the item ignored at first
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    prm = page.evaluate("(() => { const d = PX.ex.get('centralpoint'), p = {}; d.dims.forEach((x) => { p[x.key] = 0; }); p.variant = 'quick'; return p; })()")
    page.evaluate('PX.ui.play.config.limitScale = 0.05')
    go(page, {'mode': 'free', 'exId': 'centralpoint', 'params': prm, 'trials': 3})
    drive(page, '__play.state === "respond"', limit=60)
    page.evaluate('PX.debug.fast(false)')
    page.wait_for_function('__play.last && __play.last.timeout === true', timeout=15000)
    page.wait_for_timeout(450)
    st0 = state(page)
    C.ok(st0 == 'reveal', f'{tag}: after a time-out the verdict shows first; the walkthrough waits ({st0})')
    page.wait_for_function('__play.state === "showme"', timeout=8000)
    cap0 = page.evaluate("document.querySelector('.pl-caption').textContent")
    page.evaluate("PX.ui.play.current().ctx.playCmd('step'); PX.ui.play.current().ctx.playCmd('step')")
    page.wait_for_timeout(200)
    cap1 = page.evaluate("[document.querySelector('.pl-caption').textContent, !!document.querySelector('.pl-showme[data-waiting]'), document.querySelector('[data-showme] .px-btn, .pl-showme-buttons .px-btn').textContent]")
    C.ok(cap1[0] == cap0 and 'Resume' not in cap1[2], f'{tag}: taps from the item at the start of the walkthrough do not move it ({cap0!r} -> {cap1})')
    C.ok(page.locator('[data-showme-next]').inner_text().strip().startswith(('Next step', 'Finish step')), f'{tag}: the walkthrough\'s Next reads "Next step" or "Finish step" ({page.locator("[data-showme-next]").inner_text()!r})')
    # round 3 (Form): after an answer the walkthrough waits at each caption for Next, as Watch does
    page.wait_for_timeout(3500)
    cap2 = page.evaluate("[document.querySelector('.pl-caption').textContent, !!document.querySelector('.pl-showme[data-waiting]'), document.querySelector('[data-showme-next]').textContent.trim()]")
    C.ok(cap2[0] == cap0 and cap2[1] and cap2[2].startswith(('Next step', 'Done')), f'{tag}: the walkthrough waits at its first caption ({cap2})')
    page.locator('[data-showme-next]').tap()
    page.wait_for_timeout(400)
    cap3 = page.evaluate("document.querySelector('.pl-caption').textContent")
    C.ok(cap3 != cap0 or state(page) == 'reveal', f'{tag}: Next step shows the next caption ({cap0!r} -> {cap3!r})')
    # round 3: a title row half cut at the top edge steps aside for the copy of Pause
    hud = page.evaluate("(() => { const r = document.querySelector('.pl-hud').getBoundingClientRect(); return Math.round(r.top + window.scrollY); })()")
    page.evaluate(f"document.body.style.paddingBottom = '1500px'; window.scrollTo(0, {hud} + 22)")
    page.wait_for_timeout(400)
    cut = page.evaluate("[document.querySelector('.pl-player').hasAttribute('data-hud-off'), getComputedStyle(document.querySelector('.pl-hud')).visibility, getComputedStyle(document.querySelector('[data-float-pause]')).display]")
    C.ok(cut[0] and cut[1] == 'hidden' and cut[2] != 'none', f'{tag}: a half-cut title row hides and the copy of Pause shows ({cut})')
    page.evaluate("document.body.style.paddingBottom = ''; window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    if state(page) != 'showme':  # the walkthrough ended: play it again, to close it
        page.locator('[data-showme]').tap()
        page.wait_for_function('__play.state === "showme"', timeout=8000)
    page.locator('.pl-showme-buttons .px-btn:nth-child(4)').tap()  # Close: the walkthrough ends
    page.wait_for_function('__play.state === "reveal"', timeout=8000)
    seed0 = page.evaluate('__play.item && __play.item.seed')
    page.locator('[data-next]').tap()  # at once: meant for the walkthrough's Next
    page.wait_for_timeout(150)
    C.ok(state(page) == 'reveal' and page.evaluate('__play.item && __play.item.seed') == seed0, f'{tag}: a tap right after the walkthrough ends does not start the next item ({state(page)})')
    page.wait_for_timeout(800)
    page.locator('[data-next]').tap()
    page.wait_for_function('__play.state === "respond" || __play.state === "present" || __play.state === "ready"', timeout=8000)
    C.ok(True, f'{tag}: a moment later Next item goes on')
    page.evaluate('PX.debug.fast(true); PX.ui.play.config.limitScale = 1')
    C.ok(not con.errors(), f'{tag} walkthrough: no console errors {con.errors()[:3]}')
    ctx.close()


PRODUCE_JS = """() => {
  if (PX.ex.get('ptest')) return true;
  PX.ex.define({ id: 'ptest', code: 'EX-93', name: 'Produce stub', abilities: ['Vz'], role: 'train', answer: 'choice', nOptions: 4,
    variants: ['pick', 'draw'], trainVariants: ['pick'], layers: { produce: 'draw' }, dims: [{ key: 'a', levels: [0, 1], step: 0.5 }], base: -1,
    validate: () => true,
    generate: (rng, params) => (params.variant === 'draw' ? { ex: 'ptest', seed: rng.seed, params, answer: 'sequence', key: [rng.seed % 3, 3] }
      : { ex: 'ptest', seed: rng.seed, params, key: rng.seed % 4 }),
    score: (item, r) => ({ correct: Array.isArray(item.key) ? Array.isArray(r) && r.join() === item.key.join() : r === item.key }) });
  PX.ex.view('ptest', { layout: 'stem+options',
    present: (item, ctx) => { ctx.host.textContent = 'ptest ' + item.params.variant; return PX.core.timing.nextPaint(); },
    drawOption: (el, item, i) => { el.textContent = 'ABCD'[i]; },
    layoutFor: (item) => (item.params.variant === 'draw' ? 'custom' : 'stem+options'),
    collect: (item, ctx, respond) => { const b = document.createElement('button'); b.setAttribute('data-draw', ''); b.className = 'px-btn';
      b.textContent = 'Draw it'; b.onclick = () => respond(item.key.slice(), { amode: 'draw' }); ctx.host.appendChild(b); },
    reveal: () => null });
  PX.core.store.state.tour.seen.ptest = true;
  return true;
}"""


def run_produce(b, C):
    """A draw-the-answer item of a stem+options exercise (CONTRACT-v1.2 S, W2-bets' request): view.layoutFor
    gives it its own input in place of the answer grid; its answer type is the item's; the row logs 'draw'."""
    tag = 'produce'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    page.evaluate(PRODUCE_JS)
    go(page, {'mode': 'free', 'exId': 'ptest', 'params': {'a': 0, 'variant': 'draw'}, 'trials': 3})
    wait_state(page, 'respond')
    st = page.evaluate("({ choices: document.querySelectorAll('.pl-grid .px-choice').length, draw: !!document.querySelector('[data-draw]'), layout: document.querySelector('.pl-trial').getAttribute('data-item-layout'), confirm: document.querySelector('.pl-confirm').hidden })")
    C.ok(st == {'choices': 0, 'draw': True, 'layout': 'custom', 'confirm': True}, f'{tag}: a draw item gets the view\'s own input, no answer grid ({st})')
    page.locator('[data-draw]').click()
    wait_state(page, 'reveal')
    row = last_row(page)
    C.ok(row[5] == 1 and isinstance(row[6], int) and row[6] >= 0 and row[15] == 7, f'{tag}: its answer is scored as the item\'s own type, timed from the painted frame, and logged as drawn (answer mode 7): {row}')
    page.evaluate('__play.next()')
    wait_state(page, 'respond')
    page.evaluate('__play.answer(false)')
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
    C.ok(last_row(page)[5] == 0, f'{tag}: the test answer path gives a draw item a wrong answer of its own type')
    page.evaluate('__play.end()')
    page.wait_for_selector('.pl-summary', timeout=8000)
    go(page, {'mode': 'free', 'exId': 'ptest', 'params': {'a': 0, 'variant': 'pick'}, 'trials': 2})
    wait_state(page, 'respond')
    st2 = page.evaluate("({ choices: document.querySelectorAll('.pl-grid .px-choice').length, draw: !!document.querySelector('[data-draw]'), layout: document.querySelector('.pl-trial').getAttribute('data-item-layout') })")
    C.ok(st2 == {'choices': 4, 'draw': False, 'layout': 'stem+options'}, f'{tag}: the exercise\'s other items keep the answer grid ({st2})')
    page.locator('.pl-grid .px-choice').first.click()
    wait_state(page, 'reveal')
    C.ok(last_row(page)[15] == 1, f'{tag}: and log the option answer mode (1)')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def run_gamefeel(b, C):
    """PLAN milestone 5's call sites (W3-game's requests): item:reveal after each verdict, with the step, the
    logged outcome and the verdict element; the needle sweep where a level moves (the block's level note and
    the summary row), called once the bar is in the page."""
    tag = 'game feel'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    page.evaluate(HOOKS_JS)
    page.evaluate("PX.ui.hooks.mute((id) => id === 'test.reveal'); PX.ui.play.config.budgetMs = 60000;")
    page.evaluate("""() => { window.__rv = []; window.__sw = [];
      PX.ui.hooks.on('item:reveal', (c) => { __rv.push({ mode: c.mode, ex: c.def.id, outcome: c.tr.outcome, oc: c.out ? c.out.outcome : null,
        verdict: !!(c.verdict && c.verdict.querySelector('.pl-verdict-word')), step: !!(c.step && c.step.exId), P: !!c.P }); return null; }, { id: 'test.reveal' });
      PX.ui.game = PX.ui.game || {};
      PX.ui.game.sweep = (bar, before, after) => { __sw.push({ before, after, inPage: bar.isConnected,
        where: bar.closest('.pl-note--level') ? 'note' : bar.closest('.pl-res') ? 'summary' : '?' }); };
      PX.core.store.state.ex.htest = { mu: 0.3, sd: 0.35, n: 30, nRight: 18, last: Date.now() - 86400000, seen: {}, best: {}, hist: [] }; }""")  # mid-range: a level that moves
    go(page, {'mode': 'train', 'exId': 'htest', 'count': 1})
    ok = drive(page, '!!document.querySelector(".pl-summary") || __rv.length >= 12', right=1.0, limit=400)
    if not page.evaluate('!!document.querySelector(".pl-summary")'):
        page.evaluate('__play.end()')
        page.wait_for_selector('.pl-summary', timeout=8000)
    rv = page.evaluate('__rv')
    C.ok(ok and len(rv) >= 10 and all(x['verdict'] and x['step'] and x['P'] and x['mode'] == 'train' and x['oc'] in (0, 1) for x in rv),
         f'{tag}: item:reveal runs after each verdict with the step, the logged outcome and the verdict ({len(rv)} items; {rv[:1]})')
    sw = page.evaluate('__sw')
    note = [x for x in sw if x['where'] == 'note']
    summ = [x for x in sw if x['where'] == 'summary']
    C.ok(note and all(x['inPage'] and x['before'] != x['after'] for x in note), f'{tag}: the needle sweeps the block\'s level note where the level moved ({note[:2]})')
    C.ok(summ and all(x['inPage'] and x['before'] != x['after'] for x in summ), f'{tag}: and the summary row ({summ[:2]})')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def run_round4(b, C):
    """Fresh-player round 4 (a new player's first session, phone 390 x 844): the step indicator whole, one
    Pause during Track, Track's label on a chip (in Track's own Watch, Try, Go since the first-run tutorial is
    one exercise: run_firstrun); the walkthrough button's words follow what a tap does and Close leaves no
    caption."""
    tag = 'round 4'
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    go(page, {'mode': 'watch', 'exId': 'track'})
    page.wait_for_selector('[data-wtg="track"]', timeout=15000)
    page.wait_for_timeout(300)
    steps = page.evaluate("""(() => { const ol = document.querySelector('.pl-wtg-steps'), r = ol.getBoundingClientRect();
      return { over: ol.scrollWidth - ol.clientWidth, pills: [...ol.children].map((li) => Math.round(li.getBoundingClientRect().right - r.right)) }; })()""")
    C.ok(steps['over'] <= 1 and all(x <= 1 for x in steps['pills']), f'{tag}: the step indicator shows its three steps whole at 390 px ({steps})')
    tries = []
    for _ in range(400):
        if page.evaluate("!document.querySelector('[data-wtg=\"track\"]')"):
            break
        st = state(page)
        nb = page.locator('.ex-track-notice:not([hidden]) .px-btn')
        if nb.count() and nb.first.is_visible():
            nb.first.click()
        elif st == 'present':
            vis = page.evaluate("""(() => { const own = document.querySelector('.pl-host .ex-track-pause'); if (!own || own.hidden) return null;
              return [getComputedStyle(document.querySelector('.pl-hud [data-pause]')).visibility, getComputedStyle(document.querySelector('.pl-trial.ex-track .pl-host .ex-label')).backgroundColor]; })()""")
            if vis:
                tries.append(('pause', vis))
        elif st == 'respond':
            page.evaluate('__play.answer(true).catch(() => 0)')
        elif st in ('reveal', 'showme'):
            page.evaluate('__play.next()')
        cb = page.locator('[data-card-box] .px-btn--primary')
        if cb.count():
            cb.first.click()
        page.wait_for_timeout(60)
    pv = [x[1] for x in tries if x[0] == 'pause']
    C.ok(pv and all(v[0] == 'hidden' and v[1] not in ('rgba(0, 0, 0, 0)', 'transparent') for v in pv), f'{tag}: during Track\'s stimulus one Pause shows (the title row\'s steps aside) and its label sits on a chip ({pv[:1]})')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()
    # the walkthrough button's words, and Close (the runner with steps of known shape, as run_captions)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    go(page, {'mode': 'free', 'exId': 'rotate', 'params': {'angle': 0, 'axis': 0, 'cubes': 0, 'variant': 'pick'}, 'trials': 3})
    wait_state(page, 'respond')
    page.evaluate('PX.debug.fast(false); PX.core.store.state.ui.autoplay = false')
    start = """(steps) => { const P = PX.ui.play.current(); P.demoing = true; window.__done = false;
      const mk = (s) => Object.assign({ ms: s.ms || 300 }, s.cap ? { caption: s.cap } : {}, s.motion !== undefined ? { motion: s.motion } : {}, s.anim ? { update() {} } : {});
      P.ctx.play(steps.map(mk)).then(() => { __done = true; P.demoing = false; }); }"""
    page.evaluate(start, [{'cap': 'M1', 'ms': 4000, 'motion': True}, {'cap': 'M2', 'ms': 4000, 'motion': True}, {'cap': 'S3', 'ms': 4000, 'anim': True}, {'cap': 'S4'}])
    page.wait_for_timeout(400)
    l1 = page.locator('[data-showme-next]').inner_text().strip()
    page.locator('[data-showme-next]').tap()
    page.wait_for_timeout(300)
    c2 = page.evaluate("document.querySelector('.pl-caption').textContent")
    C.ok(l1.startswith('Next step') and c2 == 'M2', f'{tag}: on a moving caption the button says Next step, and a tap shows the next caption ({l1!r} -> {c2!r})')
    page.locator('[data-showme-next]').tap()
    page.wait_for_timeout(300)
    l3 = page.locator('[data-showme-next]').inner_text().strip()
    c3 = page.evaluate("document.querySelector('.pl-caption').textContent")
    C.ok(c3 == 'S3' and l3.startswith('Next step'), f'{tag}: on a still caption whose steps play it says Next step too (round 5) ({c3!r}, {l3!r})')
    page.locator('[data-showme-next]').tap()
    page.wait_for_timeout(300)
    s4 = page.evaluate("[document.querySelector('.pl-caption').textContent, !!document.querySelector('.pl-showme[data-waiting]'), document.querySelector('[data-showme-next]').textContent.trim()]")
    C.ok(s4[0] == 'S4' and s4[2].startswith('Your turn'), f'{tag}: that tap shows the next caption, the last one, which says Your turn ({s4})')
    page.locator('.pl-showme-buttons .px-btn:nth-child(4)').tap()  # Close
    page.wait_for_function('__done === true', timeout=5000)
    cap = page.evaluate("document.querySelector('.pl-caption').textContent")
    C.ok(cap == '', f'{tag}: Close leaves no caption behind ({cap!r})')
    C.ok(not con.errors(), f'{tag} words: no console errors {con.errors()[:3]}')
    ctx.close()


STEPBAR_JS = '''() => { const s = document.querySelector('.pl-wtg-top'), g = document.querySelector('.pl-grid .px-choices'),
  f = document.querySelector('.pl-feedback'), r = s ? s.getBoundingClientRect() : null, gr = g ? g.getBoundingClientRect() : null,
  fr = f && !f.hidden ? f.getBoundingClientRect() : null;
  return { top: r ? Math.round(r.top) : null, bottom: r ? Math.round(r.bottom) : null, H: innerHeight,
    gridBottom: gr ? Math.round(gr.bottom) : null, stripTop: fr ? Math.round(fr.top) : null }; }'''


def bar_whole(m):
    """The step bar is on the screen whole, and the options end above the reading strip."""
    return m['top'] is not None and m['top'] >= -0.5 and m['bottom'] <= m['H'] and (m['stripTop'] is None or m['gridBottom'] <= m['stripTop'] + 2)


def run_round5(b, C):
    """Fresh-player round 5 (Angles on a phone, 390 x 844): during Watch the line, the button and a tap on the figure
    agree at every moment (each tap shows the next caption; from the start of the last caption the button and the
    line both say Your turn); Your turn and a Try item's answer strip leave the step bar whole, on the screen; the
    Go screen says when the starting point comes first, and its Later trains at once; a stretch tag says what it
    is the first time. Screenshots out/play/round5_*.png."""
    tag = 'round 5'
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    page.evaluate('PX.debug.fast(false); PX.core.store.state.ui.autoplay = false')
    go(page, {'mode': 'watch', 'exId': 'angles'})
    for _ in range(100):  # the rules card first (the teaching template)
        if page.evaluate('window.__play && __play.state === "showme"'):
            break
        rc = page.locator('[data-card-box="wtg-rules"] [data-card="watch"]')
        if rc.count():
            rc.first.tap()
        page.wait_for_timeout(100)
    page.wait_for_timeout(400)
    # the caption on screen: the view's own line (Angles: .ex-caption) or the player's
    page.evaluate("window.CAP = () => { const v = document.querySelector('.pl-host .ex-caption'); return (v && v.textContent) || document.querySelector('.pl-caption').textContent; }")
    seen, agree, moved, shot = [], True, True, False
    for _ in range(30):
        if page.evaluate('__play.state') != 'showme':
            break
        m = page.evaluate("""() => ({ cap: CAP(), btn: document.querySelector('[data-showme-next]').textContent.trim(),
          line: document.querySelector('.pl-wtg-text').textContent, waiting: document.querySelector('.pl-showme').hasAttribute('data-waiting') })""")
        seen.append(m)
        last = m['btn'].startswith('Your turn')
        if last != m['line'].startswith('Watch: the last step') or not (last or m['btn'].startswith('Next step')) or (not last and 'Tap Next, or the figure' not in m['line']):
            agree = False
        if not shot and not m['waiting']:
            page.screenshot(path=str(OUT / 'round5_watch_playing.png'))
            shot = True
        if last:
            page.locator('[data-showme-next]').tap()
            break
        page.locator('.pl-host').tap(position={'x': 60, 'y': 60})  # a tap on the figure, often while the caption's steps play
        page.wait_for_timeout(350)
        if page.evaluate('CAP()') == m['cap'] and page.evaluate('__play.state') == 'showme':
            moved = False
    C.ok(len(seen) >= 3 and agree, f'{tag}: during Watch the button says Next step and the line "Tap Next, or the figure", and from the last caption both say Your turn ({[(s["btn"], s["line"][:24]) for s in seen]})')
    C.ok(moved, f'{tag}: every tap on the figure showed the next caption, also while a caption\'s steps played ({len(seen)} captions)')
    wait_state(page, 'respond')
    page.wait_for_timeout(500)
    turn = page.evaluate(STEPBAR_JS)
    page.screenshot(path=str(OUT / 'round5_turn.png'))
    C.ok(page.evaluate("document.querySelector('.pl-wtg-text').textContent").startswith('Your turn') and bar_whole(turn), f'{tag}: at Your turn the step bar is whole on the screen and the options clear the strip ({turn})')
    page.evaluate('PX.debug.fast(true)')
    k = page.evaluate('__play.key')
    page.locator('.pl-grid .px-choice').nth(k).tap()
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
    page.evaluate('__play.next()')
    tries = []
    for _ in range(6):
        for _ in range(100):
            sc = page.locator('[data-card-box="wtg-strategy"] [data-card="try"]')
            if sc.count():
                sc.first.tap()
            if page.evaluate('__play.state') == 'respond' and not card(page):
                break
            page.wait_for_timeout(100)
        if not page.evaluate("(document.querySelector('.pl-wtg-text') || { textContent: '' }).textContent").startswith('Try'):
            break
        k = page.evaluate('__play.key')
        page.locator('.pl-grid .px-choice').nth((k + 1) % 4 if len(tries) == 1 else k).tap()  # one wrong answer among them
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
        if page.evaluate('__play.state') == 'showme':
            page.locator('.pl-showme-buttons .px-btn:nth-child(4)').tap()  # Close the walkthrough
            page.wait_for_function('__play.state === "reveal"', timeout=8000)
        page.wait_for_timeout(300)
        tries.append(page.evaluate(STEPBAR_JS))
        if len(tries) == 1:
            page.screenshot(path=str(OUT / 'round5_try_answered.png'))
        page.evaluate('__play.next()')
        page.wait_for_timeout(200)
    C.ok(len(tries) >= 3 and all(bar_whole(m) for m in tries), f'{tag}: after each Try answer the step bar is whole on the screen and the options clear the strip ({tries})')
    # the Go screen while Baseline 1 is due
    page.wait_for_selector('[data-card="session"]', timeout=15000)
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / 'round5_go.png'))
    go_txt = page.locator('[data-card="session"]').inner_text().strip()
    later_txt = page.locator('[data-card="later"]').inner_text().strip() if page.locator('[data-card="later"]').count() else ''
    lead = page.locator('.px-screen-head .px-lead').inner_text()
    C.ok(go_txt == 'Go: the starting-point check first, then Angles' and later_txt == 'Angles now, the check later' and 'first comes your starting point' in lead,
         f'{tag}: the Go screen says the starting point comes first, before the tap ({go_txt!r}; {later_txt!r})')
    page.evaluate(FIRSTRUN_CARDS)
    page.evaluate('PX.ui.hooks.mute(false)')  # the measurement's hooks, as a new player has them
    page.locator('[data-card="later"]').tap()
    page.wait_for_timeout(400)
    rp = page.evaluate('PX.core.router.current().params')
    for _ in range(60):
        if page.evaluate('window.__play && __play.state === "respond"') and not card(page):
            break
        if card(page) and card(page) not in ('measure-offer', 'expect'):
            page.locator('[data-card-box] .px-btn--primary').first.tap()
        page.wait_for_timeout(100)
    st = page.evaluate("({ ex: __play.exId, st: __play.state, cards: __cards.slice(), later: PX.core.store.state.measure && PX.core.store.state.measure.later })")
    C.ok(rp.get('baseline') == 'later' and st['ex'] == 'angles' and st['st'] == 'respond' and 'measure-offer' not in st['cards'] and st['later'],
         f'{tag}: its Later trains Angles at once, with the put-off logged ({rp}; {st})')
    # a stretch tag says what it is, once
    sl = page.evaluate("""(() => { const seen = PX.core.store.state.ui.seen || (PX.core.store.state.ui.seen = {}); delete seen.stretchNote;
      const notes = [], mk = () => { const v = document.createElement('div'), i = document.createElement('span'); i.className = 'pl-verdict-icon'; v.appendChild(i); return v; };
      const P = { note: (n) => { notes.push(n.textContent); return n; } }, v1 = mk(), v2 = mk();
      PX.ui.hooks.collect('item:reveal', { step: { kind: 'stretch' }, tr: { result: { correct: true } }, verdict: v1, P: P });
      PX.ui.hooks.collect('item:reveal', { step: { kind: 'stretch1' }, tr: { result: { correct: true } }, verdict: v2, P: P });
      const t = v1.querySelector('.gm-stretch-tag');
      return { tag: t && t.textContent, title: t && t.getAttribute('title'), tag2: !!v2.querySelector('.gm-stretch-tag'), notes: notes, seen: seen.stretchNote }; })()""")
    C.ok(sl['tag'] == 'stretch' and (sl['title'] or '').startswith('Stretch: an item set above your level') and sl['tag2'] and sl['notes'] == [sl['title']] and sl['seen'] == 1,
         f'{tag}: a stretch tag carries its words, and the first one adds them as a line under the verdict, once ({sl})')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


FIRSTRUN_CARDS = '''(() => { window.__cards = []; const seen = new Set();
  new MutationObserver(() => { for (const el of document.querySelectorAll('[data-card-box]')) { const id = el.getAttribute('data-card-box');
    if (!seen.has(el)) { seen.add(el); __cards.push(id); } } }).observe(document.documentElement, { subtree: true, childList: true }); })()'''


def firstrun_start(b, C, tag, shots_on):
    """A fresh record at 390 x 844 with every builder's hook on (a new player's view): the welcome, then the offer."""
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    page.goto(INDEX.as_uri())
    page.wait_for_function(READY, timeout=20000)
    page.evaluate('document.fonts.ready.then(() => 1)')
    C.ok(page.locator('.px-modal[data-welcome]').count() == 1, f'{tag}: the full Chimera welcome opens first')
    page.keyboard.press('Escape')
    page.wait_for_selector('.px-modal.px-offer', timeout=4000)
    page.wait_for_timeout(250)
    if shots_on:
        page.screenshot(path=str(OUT / 'firstrun_1_offer.png'))
    return ctx, page, con


def run_firstrun(b, C):
    """The owner's first-session choice A (19 Nov), at 390 x 844 on a fresh record: the welcome → one tutorial
    (Spin's Watch, Try, Go; the offer gives its length and names the exercise) → the end screen offers the
    starting point with its time and Later → Train, both ways: Later trains at once (the put-off logged, no
    baseline card in that session, the session opens with Spin); Measure now plays Baseline 1 first with no
    second ask (the expectation question, then the probes), then trains. Screenshots: out/play/firstrun_*.png."""
    tag = 'first run'
    ctx, page, con = firstrun_start(b, C, tag, True)
    tm = page.evaluate('PX.ui.tour.minutes()')
    b1 = page.evaluate("PX.ui.measure.minutesOf('B1', PX.core.store.state)")
    b1t = (f'{b1:.1f}' if b1 % 1 else str(int(b1))) if b1 else None
    body = page.locator('.px-modal.px-offer').inner_text()
    go_txt = page.locator('.px-offer-go').inner_text().strip()
    C.ok(page.evaluate('PX.ui.tour.LIST') == ['spin'] and tm['names'] == 'Spin' and tm['minutes'] <= 3 and go_txt == f"Watch, Try, Go ({tm['minutes']} min)"
         and 'Spin' in body and f"about {tm['words']}" in body and b1t and f'about {b1t} minutes' in body,
         f'{tag}: the offer names the one exercise, its own length and the starting point\'s time ({go_txt!r}; {tm}; B1 {b1})')
    page.locator('.px-offer-go').tap()
    page.wait_for_selector('[data-wtg="spin"]', timeout=8000)
    page.evaluate(FIRSTRUN_CARDS)
    lead = page.locator('.pl-wtg-lead').inner_text().strip()
    tools = page.locator('.pl-wtg-tools .px-btn:visible').all_inner_texts()
    C.ok(page.evaluate('PX.core.router.current().params.mode') == 'tour' and lead == 'Your first exercise: Spin' and page.locator('[data-tour-end]').count() == 0
         and [t.strip() for t in tools if t.strip() != 'Parts'] == ['Skip the tutorial'], f'{tag}: one tutorial, Spin, with one way out ({lead!r}; {tools})')
    page.wait_for_function('__play.state === "showme"', timeout=15000)
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT / 'firstrun_2_watch.png'))
    page.evaluate('PX.debug.fast(true)')
    for _ in range(60):  # the walkthrough waits for a tap per caption
        if page.evaluate('__play.played && __play.played.demos >= 1'):
            break
        nx = page.locator('[data-showme-next]')
        if nx.count() and nx.first.is_visible():
            nx.first.tap()
        page.wait_for_timeout(150)
    C.ok(page.evaluate('__play.played && __play.played.demos >= 1'), f'{tag}: the Watch demo plays')
    ok = drive(page, '!!document.querySelector("[data-card-box=baseline]")', limit=300, right=1.0)
    C.ok(ok, f'{tag}: the tutorial ends with the starting-point card')
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / 'firstrun_3_end.png'))
    page.screenshot(path=str(OUT / 'firstrun_3_end_full.png'), full_page=True)
    end = page.evaluate("""(() => ({ h1: document.querySelector('.pl-screen h1:not(.px-sr)') ? document.querySelector('.pl-screen h1:not(.px-sr)').textContent : '',
      go: !!document.querySelector('.pl-go-steps .is-current'), card: document.querySelector('[data-card-box=baseline]').innerText,
      btns: [...document.querySelectorAll('[data-card-box=baseline] [data-card]')].map((x) => [x.getAttribute('data-card'), x.textContent.trim().replace(/Enter$/, '')]),
      invite: document.querySelectorAll('[data-invite="tutorial"]').length, over: document.documentElement.scrollWidth - innerWidth,
      rows: PX.core.store.state.trials.length, tour: PX.core.store.state.tour.done, ui: PX.core.store.state.ui.tour }))()""")
    C.ok(end['h1'] == 'Go: Spin for real' and end['go'] and end['rows'] == 0 and end['tour'] is True and end['ui']['done'] == ['spin'],
         f'{tag}: the end screen is Go, nothing logged, the flags set ({end["h1"]!r}; {end["ui"]})')
    C.ok(end['btns'] == [['later', 'Later'], ['now', f'Measure now ({b1t} min)']] and f'About {b1t} minutes, no feedback' in end['card'] and 'next session opens with the check' in end['card'],
         f'{tag}: the starting point with its honest time and Later ({end["btns"]})')
    small = page.evaluate(TARGETS_JS)
    C.ok(end['invite'] == 1 and end['over'] <= 0 and not small, f'{tag}: the Chimera invite at the tutorial\'s end; no sideways scroll; targets 44 px ({end["over"]}; {small[:3]})')
    # Later → Train at once: the put-off logged, no baseline card this session, Spin first
    page.locator('[data-card-box=baseline] [data-card="later"]').tap()
    page.wait_for_timeout(300)
    rp = page.evaluate('PX.core.router.current().params')
    for _ in range(80):
        st = state(page) if page.evaluate('!!window.__play') else None
        if st == 'respond':
            break
        if card(page):
            page.locator('[data-card-box] .px-btn--primary').first.tap()
        page.wait_for_timeout(100)
    page.wait_for_timeout(250)
    page.screenshot(path=str(OUT / 'firstrun_4_later_train.png'))
    lat = page.evaluate("""(() => { const r = PX.core.store.state, ev = PX.engine.events ? PX.engine.events.list(r, { kind: 'measure' }) : [];
      return { later: r.measure && r.measure.later, ev: ev.map((e) => e.data && e.data.what), ex: __play.exId, st: __play.state,
        next: PX.ui.measure.status(r, Date.now()), cards: __cards.slice() }; })()""")
    C.ok(rp.get('mode') == 'train' and rp.get('exId') == 'spin' and rp.get('baseline') == 'later' and isinstance(lat['later'], (int, float)) and 'baseline-later' in lat['ev'],
         f'{tag}: Later opens Train with Spin and logs the put-off ({rp}; {lat["ev"]})')
    C.ok(lat['st'] == 'respond' and lat['ex'] == 'spin' and 'measure-offer' not in lat['cards'] and 'expect' not in lat['cards'] and lat['next']['kind'] == 'B1' and lat['next']['when'] == 'session-start',
         f'{tag}: the session trains Spin at once; no baseline card in it; the next session opens with it ({lat["cards"]}; {lat["next"]["when"]})')
    for i in range(2):  # two scored Spin items
        page.evaluate('__play.answer(true).catch(() => 0)')
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
        page.evaluate('__play.next()')
        page.wait_for_timeout(200)
    rows = page.evaluate("(() => { const r = PX.core.store.state, mi = r.idx.mode.indexOf('train'); return r.trials.filter((t) => t[2] === mi).length; })()")
    C.ok(rows >= 2 and 'measure-offer' not in page.evaluate('__cards'), f'{tag}: training counts ({rows} Train rows) and still no baseline card')
    C.ok(not con.errors(), f'{tag} (Later): no console errors {con.errors()[:3]}')
    ctx.close()

    # Measure now (the tutorial skipped this time): Baseline 1 first, with no second ask, then Train
    tag = 'first run, measure now'
    ctx, page, con = firstrun_start(b, C, tag, False)
    page.locator('.px-offer-go').tap()
    page.wait_for_selector('[data-wtg="spin"]', timeout=8000)
    page.evaluate(FIRSTRUN_CARDS)
    page.locator('[data-wtg-skip]').tap()
    page.wait_for_selector('[data-card-box=baseline]', timeout=8000)
    h1 = page.locator('.pl-screen h1:not(.px-sr)').first.inner_text().strip()
    C.ok(h1 == 'Tutorial skipped' and page.evaluate('PX.core.store.state.ui.tour.skipped') == ['spin'], f'{tag}: a skipped tutorial still ends with the starting-point card ({h1!r})')
    page.evaluate('PX.debug.fast(true)')
    page.locator('[data-card-box=baseline] [data-card="now"]').tap()
    page.wait_for_selector('[data-card-box]', timeout=8000)
    rp = page.evaluate('PX.core.router.current().params')
    first = card(page)
    page.screenshot(path=str(OUT / 'firstrun_5_now_expect.png'))
    C.ok(rp.get('mode') == 'train' and rp.get('baseline') == 'now' and 'exId' not in rp and first == 'expect',
         f'{tag}: Measure now opens Train, whose first card is the expectation question, not a second offer ({rp}; {first})')
    page.locator('[data-expect="3"]').tap()
    page.wait_for_timeout(200)
    ok = drive(page, '!!document.querySelector("[data-card-box=measure-done]")', cards={'probe-intro': 'skip'}, limit=1200, right=0.7)
    page.wait_for_timeout(200)
    page.screenshot(path=str(OUT / 'firstrun_6_now_saved.png'))
    done = page.evaluate("""(() => { const r = PX.core.store.state; return { checks: (r.assess || []).map((a) => a.kind), cards: __cards.slice(),
      txt: (document.querySelector('[data-card-box=measure-done]') || {}).innerText || '', expect: r.spatial && r.spatial.expect && r.spatial.expect.value }; })()""")
    C.ok(ok and done['checks'] == ['B1'] and done['expect'] == 3 and 'measure-offer' not in done['cards'] and 'Your session starts now.' in done['txt'],
         f'{tag}: Baseline 1 saved inside the session, never offered twice ({done["checks"]}; {[c for c in done["cards"] if c != "probe-intro"][:6]})')
    page.locator('[data-card-box=measure-done] .px-btn--primary').tap()
    page.wait_for_timeout(300)
    nxt = None
    for _ in range(100):
        cid = card(page)
        if cid:
            nxt = nxt or cid
            if cid == 'wtg-offer':
                click_card(page, 'skip')
            else:
                page.locator('[data-card-box] .px-btn--primary').first.tap()
        elif page.evaluate('!!window.__play') and state(page) == 'respond':
            break
        page.wait_for_timeout(100)
    page.wait_for_timeout(250)
    page.screenshot(path=str(OUT / 'firstrun_7_now_train.png'))
    tr = page.evaluate("({ st: __play.state, ex: __play.exId, mode: PX.core.router.current().params.mode, kind: PX.ui.measure.status(PX.core.store.state, Date.now()).kind })")
    C.ok(tr['st'] == 'respond' and tr['mode'] == 'train' and tr['kind'] != 'B1' and (nxt in (None, 'wtg-offer')),
         f'{tag}: then training starts (a new exercise offers its own Watch, Try, Go first: {nxt}; {tr})')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


RANGE_CLONE_JS = '''(() => { // a copy of Angles with a test range on its gap levels (CONTRACT-v1.2 W3), for the browser check
  if (PX.ex.get('anglestr')) return;
  const a = PX.ex.get('angles');
  PX.ex.define(Object.assign({}, a, { id: 'anglestr', code: 'EX-99', name: 'Angles (range check)', short: 'Angles RC',
    testRange: { dims: { gap: ['below', 'test', 'test', 'test', 'test', 'beyond'] }, notes: { gap: 'Gap sizes on the test are not documented officially.' } } }));
  PX.ex.view('anglestr', PX.ex.view('angles'));
  PX.ex.learn('anglestr', PX.ex.learn('angles'));
  PX.core.store.state.tour.seen.anglestr = true;
})()'''


def run_wave3(b, C):
    """Shared support for PLAN milestone 8 (CONTRACT-v1.2 Wave 3): a view with optionKeys 'letters' shows A–D on
    its options, a letter key and a digit both answer, the keys sheet and the view context name letters (W1); Free
    play's "test range only" (W3) disables the levels outside the range in fixed settings, keeps adaptive items
    inside it, remembers the choice in rec.ex[id].tag, and the Library lists the levels against the test format."""
    tag = 'letters'
    ctx, page, con = fresh(b)
    boot(page)
    seen_all(page)
    page.evaluate("PX.ex.view('angles').optionKeys = 'letters'")
    go(page, {'mode': 'free', 'exId': 'angles', 'params': {'gap': 0, 'size': 0, 'resolve': 0, 'pose': 0}, 'trials': 4})
    wait_state(page, 'respond')
    g = page.evaluate("""(() => ({ keys: [...document.querySelectorAll('.pl-grid .px-choice-key')].map((x) => x.textContent),
      ks: [...document.querySelectorAll('.pl-grid .px-choice')].map((x) => x.getAttribute('aria-keyshortcuts')),
      grid: document.querySelector('.pl-grid .px-choices').classList.contains('px-choices--letters'),
      name: PX.ui.play.current().ctx.optionName(2), letters: PX.ui.play.current().ctx.letters }))()""")
    C.ok(g['keys'] == ['A', 'B', 'C', 'D'] and g['ks'][1] == 'B 2' and g['grid'] and g['name'] == 'C' and g['letters'] is True,
         f'{tag}: the options are lettered A–D, with keys A and 1 alike; the view context names option C ({g})')
    page.screenshot(path=str(OUT / 'wave3_letters.png'))
    k = page.evaluate('__play.key')
    page.keyboard.press('abcd'[k])
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
    C.ok(last_outcome(page) == 'right', f'{tag}: the letter key answers ({"abcd"[k]})')
    page.evaluate('__play.next()')
    wait_state(page, 'respond')
    k = page.evaluate('__play.key')
    page.keyboard.press(str(k + 1))
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
    C.ok(last_outcome(page) == 'right', f'{tag}: a digit still answers ({k + 1})')
    page.evaluate('__play.next()')
    wait_state(page, 'respond')
    page.keyboard.press('?')
    page.wait_for_selector('.pl-keys', timeout=4000)
    row = page.locator('.pl-keys .pl-keylist li').first.inner_text()
    C.ok('A–E, 1–5' in row, f'{tag}: the keys sheet names the letters ({row!r})')
    page.keyboard.press('Escape')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()

    tag = 'test range'
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    page.evaluate(RANGE_CLONE_JS)
    go(page, {'mode': 'free', 'exId': 'anglestr'})
    page.wait_for_selector('[data-setting="free-range"]', timeout=6000)
    seg = page.locator('[data-setting="free-range"] .px-seg-item').all_inner_texts()
    hint = page.locator('[data-setting="free-range"] .px-field-hint').inner_text()
    C.ok([s.strip() for s in seg] == ['All levels', 'Test range only'] and 'forecast no score' in hint, f'{tag}: Free play offers the range, with what the tags mean ({seg})')
    page.locator('[data-setting="free-range"] .px-seg-item').nth(1).click()
    page.locator('[data-setting="free-mode"] .px-seg-item').nth(1).click()
    page.wait_for_selector('[data-free="gap"]', timeout=4000)
    opts = page.evaluate("[...document.querySelectorAll('[data-free=gap] option')].map((o) => [o.textContent, o.disabled, o.selected])")
    sel = [i for i, o in enumerate(opts) if o[2]]
    C.ok(opts[0][1] and 'below the test' in opts[0][0] and opts[5][1] and 'beyond the test' in opts[5][0] and not any(o[1] for o in opts[1:5]) and sel and 1 <= sel[0] <= 4,
         f'{tag}: fixed settings outside the range are marked and cannot be chosen; the choice moved inside ({opts})')
    page.screenshot(path=str(OUT / 'wave3_free_range.png'), full_page=True)
    page.locator('[data-setting="free-mode"] .px-seg-item').nth(0).click()
    page.locator('[data-free-start]').click()
    page.wait_for_timeout(300)
    rp = page.evaluate('PX.core.router.current().params')
    tags = []
    for _ in range(6):
        wait_state(page, 'respond')
        tags.append(page.evaluate("PX.ex.rangeTag(PX.ex.get('anglestr'), __play.item.params)"))
        page.evaluate('__play.answer(Math.random() < 0.8).catch(() => 0)')
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=8000)
        page.evaluate('__play.next()')
    C.ok(rp.get('range') == 'test' and page.evaluate("PX.core.store.state.ex.anglestr.tag") == 'test' and tags == ['test'] * 6,
         f'{tag}: adaptive items stay inside the test range, and the choice is remembered ({rp.get("range")}; {tags})')
    go(page, {'mode': 'free', 'exId': 'anglestr'})
    page.wait_for_selector('[data-setting="free-range"]', timeout=6000)
    chk = page.evaluate("document.querySelector('[data-setting=\"free-range\"] input:checked').value")
    C.ok(chk == 'test', f'{tag}: the setup opens with the remembered choice ({chk})')
    page.evaluate('void PX.core.router.go("exercise/anglestr", null, { force: true })')
    page.wait_for_selector('.px-range', timeout=6000)
    txt = page.locator('[data-section="settings"]').inner_text()
    C.ok('Against the test format' in txt and 'Below the test: 9°' in txt and 'Test range: 6° to 3°' in txt and 'Beyond the test: 2°' in txt and 'not documented officially' in txt,
         f'{tag}: the Library lists the levels against the test format ({txt[-260:]!r})')
    page.locator('.px-range').scroll_into_view_if_needed()
    page.screenshot(path=str(OUT / 'wave3_library_range.png'))
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def main():
    C = Checks('play')
    only = sys.argv[1:]
    with sync_playwright() as p:
        b = launch(p)
        fns = (run_train, run_custom, run_phone, run_sandbox, shots, run_review, run_reload, run_v12, run_captions, run_hooks, run_round3, run_produce, run_gamefeel, run_round4, run_firstrun, run_wave3, run_round5)
        for fn in fns:
            if only and fn.__name__.replace('run_', '') not in only:
                continue
            try:
                fn(b, C)
            except Exception as e:  # a crash in one part is a failure, the rest still runs
                C.ok(False, f'{fn.__name__} crashed: {str(e)[:300]}')
        b.close()
    sys.exit(C.summary({'screenshots': str(OUT)}))


if __name__ == '__main__':
    main()
