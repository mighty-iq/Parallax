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
    if knobs:
        page.evaluate('PX.debug.fast(true); PX.core.store.state.settings.sessionMin = 1;')


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
    page.evaluate('''PX.core.store.state.settings.sessionMin = 10;
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
        for _ in range(80):
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
    fr.evaluate('PX.debug.fast(true); PX.core.store.state.settings.sessionMin = 1;')
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
    # 3: a reload on a #/play route: the first item waits for the Chimera pop-up
    page.goto('about:blank')
    page.goto(INDEX.as_uri() + '#/play?mode=free&exId=spin&run=1&trials=5')
    page.wait_for_function(READY, timeout=20000)
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
    wait_state(page, 'respond')
    page.keyboard.press('Escape')
    wait_state(page, 'paused')
    label2 = page.locator('[data-skip]').inner_text()
    page.locator('[data-skip]').click()
    wait_state(page, 'respond')
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
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def main():
    C = Checks('play')
    with sync_playwright() as p:
        b = launch(p)
        for fn in (run_train, run_custom, run_phone, run_sandbox, shots, run_review, run_reload):
            try:
                fn(b, C)
            except Exception as e:  # a crash in one part is a failure, the rest still runs
                C.ok(False, f'{fn.__name__} crashed: {str(e)[:300]}')
        b.close()
    sys.exit(C.summary({'screenshots': str(OUT)}))


if __name__ == '__main__':
    main()
