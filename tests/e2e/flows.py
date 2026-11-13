"""E2E tests of the flows around the player (Phase 3, Builder A: js/ui/tour.js, check.js, play.js).

- First run: the shell's offer → the tour (Watch, Try, Go for Rotate, Fold and Track; one
  exercise skipped) → "Measure your starting point" or Later; tour flags; the motion notice is
  remembered per person (after a reload Track starts without it).
- The Spatial Check from Today: intro, the expectations question once, per probe the instruction
  and its worked example (never logged), items with no feedback, a pause that stops the probe's
  own time bar, a time-out scored wrong with rt = the limit, the end note; Stop the check asks
  first, and a check stopped part-way is not used for results (its answers stay in the Log).
- The Daily Challenge: one scored attempt, the share line and its Copy, the share card; a replay
  is practice and leaves the score as it was.
- Path (stage card with its demo, level change at a block end, the strategy check-in), Speed
  (deadline bar; unavailable until unlocked), Threshold (Span length), Free play setup, Watch,
  Try, Go from How to play, and a Train session from it with the exercise pinned.
- Today on a fresh phone profile (RV-play-dat): no sample data (empty states instead), the
  exercise count agrees with the Library's, and the DAT-style focus switched on in the Library
  puts the formats into Today's plan with a line saying so, after a reload too; off again, the
  usual plan is back. The settings read as plain words (the Library's phrases, Free play).
Screenshots go to tests/e2e/out/play/flows_*.png. Run: tests/e2e/pwslot.sh python3 tests/e2e/flows.py
"""
import json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import launch, Console, Checks
from play import (OUT, INDEX, READY, boot, go, state, wait_state, card, click_card, drive, last_row,
                  row_count, seen_all, last_outcome)


def shot(page, name, full=False):
    """A screenshot that never fails the test: under machine load they can time out."""
    try:
        page.screenshot(path=str(OUT / name), full_page=full, timeout=10000)
    except Exception as e:
        print('  (screenshot skipped:', name, str(e)[:60], ')', flush=True)


def run_tour(b, C):
    tag = 'tour'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    con = Console(page)
    page.goto(INDEX.as_uri())
    page.wait_for_function(READY, timeout=20000)
    page.keyboard.press('Escape')  # the Chimera pop-up
    page.wait_for_timeout(150)
    C.ok(page.locator('.px-modal.px-offer').count() == 1, f'{tag}: the first-run offer appears')
    page.evaluate('PX.debug.fast(true)')
    page.locator('.px-offer-go').click()
    page.wait_for_timeout(200)
    C.ok(page.evaluate('PX.core.router.current().params.mode') == 'tour' and page.locator('[data-wtg="rotate"]').count() == 1, f'{tag}: Watch, Try, Go starts with Rotate')
    page.wait_for_function('__play.played && __play.played.demos >= 1', timeout=10000)
    C.ok(True, f'{tag}: the Watch demo played')
    shot(page, 'flows_tour_watch.png')
    # Rotate: answer the demo item and the practice items; then skip Fold
    ok = drive(page, '!!document.querySelector("[data-wtg=fold]")', limit=200)
    C.ok(ok, f'{tag}: Rotate done, Fold next')
    C.ok(page.evaluate('PX.core.store.state.trials.length') == 0, f'{tag}: practice items are never logged')
    page.locator('[data-wtg-skip]').click()
    page.wait_for_timeout(200)
    C.ok(page.locator('[data-wtg="track"]').count() == 1, f'{tag}: Skip this exercise moves on to Track')
    nb = page.locator('.ex-track-notice:not([hidden]) .px-btn')
    page.wait_for_timeout(300)
    C.ok(nb.count() == 1 and nb.first.is_visible(), f'{tag}: Track shows the motion notice the first time')
    ok = drive(page, '!!document.querySelector("[data-card-box=baseline]")', limit=300)
    C.ok(ok, f'{tag}: the tour ends with the baseline offer')
    shot(page, 'flows_tour_end.png')
    t = page.evaluate('({ tour: PX.core.store.state.tour, ui: PX.core.store.state.ui.tour, notice: !!PX.core.store.state.ui.seen.motionNotice })')
    C.ok(t['tour']['done'] is True and t['ui']['done'] == ['rotate', 'track'] and t['ui']['skipped'] == ['fold'], f'{tag}: tour flags {t["ui"]}')
    C.ok(t['notice'] is True, f'{tag}: the motion notice is remembered')
    click_card(page, 'later')
    C.ok(page.evaluate('PX.core.router.current().name') == 'home', f'{tag}: Later goes to Today')
    page.wait_for_timeout(1200)  # the debounced save
    page.reload()
    page.wait_for_function(READY, timeout=20000)
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    C.ok(page.locator('.px-offer').count() == 0, f'{tag}: no offer on the next open')
    page.evaluate('PX.debug.fast(true)')
    go(page, {'mode': 'free', 'exId': 'track', 'trials': 2, 'run': '1'})
    page.wait_for_timeout(400)
    C.ok(page.locator('.ex-track-notice:not([hidden])').count() == 0 and state(page) in ('present', 'respond'), f'{tag}: after a reload Track starts without the notice')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def run_check(b, C):
    tag = 'check'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    page.locator('.px-slot--check [data-go="play?mode=check"]').click()
    page.wait_for_timeout(200)
    C.ok(card(page) == 'check-intro' and 'Baseline 1' in page.locator('[data-card-box]').inner_text(), f'{tag}: intro for baseline 1')
    click_card(page, 'start')
    C.ok(card(page) == 'expect', f'{tag}: the expectations question at baseline')
    page.locator('[data-expect="3"]').click()
    page.wait_for_timeout(150)
    C.ok(page.evaluate('PX.core.store.state.spatial.expect.value') == 3, f'{tag}: the expectation is recorded')
    C.ok(card(page) == 'probe-intro', f'{tag}: the first probe’s instruction screen')
    shot(page, 'flows_check_instruction.png')
    rows0 = page.evaluate('PX.core.store.state.trials.length')
    click_card(page, 'example')
    page.wait_for_function('__play.played.demos >= 1', timeout=10000)
    C.ok(page.locator('.pl-grid .px-choice.is-right').count() >= 1 and 'answer is marked' in page.locator('.pl-note').last.inner_text(),
         f'{tag}: the worked example ends with its answer marked')
    page.locator('.pl-note [data-card="start"]').click()
    wait_state(page, 'respond')
    C.ok(page.evaluate('PX.core.store.state.trials.length') == rows0, f'{tag}: the worked example is never logged')
    C.ok(page.evaluate('__play.item.seed') != page.evaluate('PX.ex.learn(__play.exId).demo[0].seed'), f'{tag}: items never use the example seed')
    # no feedback
    page.evaluate('__play.answer(false)')
    page.wait_for_function('__play.state === "done" || __play.state === "respond"')
    C.ok(page.locator('.pl-verdict[data-kind]').count() == 0 and page.locator('.pl-grid .px-choice.is-right, .pl-grid .px-choice.is-wrong').count() == 0, f'{tag}: no feedback and no reveal')
    wait_state(page, 'respond')
    # pause stops the probe's own bar
    page.keyboard.press('Escape')
    wait_state(page, 'paused')
    ps = page.evaluate('(() => { const f = document.querySelector(".pr-timer-fill"); return f ? getComputedStyle(f).animationPlayState : null; })()')
    C.ok(page.evaluate('document.querySelector(".pl-trial").hasAttribute("data-paused")') and ps in ('paused', None), f'{tag}: a pause stops the time bar ({ps})')
    page.keyboard.press('Escape')
    wait_state(page, 'respond')
    # a time-out: scored wrong, rt = the limit
    page.evaluate('PX.ui.play.config.limitScale = 0.01')  # the next item's limit: 1 % of it
    page.evaluate('__play.answer(true)')
    page.wait_for_function('(__play.history.slice(-1)[0] || {}).timeout === true', timeout=8000)
    page.evaluate('PX.ui.play.config.limitScale = 1')
    lim = page.evaluate('(() => { const r = PX.core.store.state, t = r.trials[r.trials.length - 1], id = r.idx.ex[t[1]].split("@")[0], d = PX.ex.get(id); return d.timeLimit(PX.ex.decodeParams(d, t[3])); })()')
    row = last_row(page)
    C.ok(row[5] == 0 and row[6] == lim, f'{tag}: a time-out is scored wrong with rt = the limit ({row[5]}, {row[6]} vs {lim})')
    ok = drive(page, '!!document.querySelector(".pl-summary")', cards={'probe-intro': 'example'}, limit=900)
    C.ok(ok, f'{tag}: the check runs to its end')
    a = page.evaluate('PX.core.store.state.assess')
    C.ok(len(a) == 1 and a[0]['kind'] == 'B1' and len(a[0]['results']) >= 5, f'{tag}: saved with every probe ({len(a)} checks, {len(a[0]["results"]) if a else 0} probes)')
    txt = page.locator('.pl-summary').inner_text()
    C.ok('What the numbers mean' in txt and 'Baseline 2 is next' in txt and 'IQ' in txt, f'{tag}: the end note says what the numbers mean and what comes next')
    shot(page, 'flows_check_end.png', True)
    # a second check stopped part-way is not used for results
    go(page, {'mode': 'check'})
    click_card(page, 'start')
    # v1.1 (M6): later checks ask one unscored question about other tests first (B7's card)
    C.ok(card(page) == 'overlap', f'{tag}: a later check asks the one-tap question about other tests ({card(page)})')
    if card(page) == 'overlap':
        page.locator('[data-overlap-answer]').first.click()
        page.wait_for_timeout(150)
    C.ok(card(page) == 'probe-intro', f'{tag}: the expectations question is asked once only')
    click_card(page, 'skip')
    wait_state(page, 'respond')
    page.evaluate('__play.answer(true)'); wait_state(page, 'respond')
    page.keyboard.press('Escape'); wait_state(page, 'paused')
    # Stop the check asks first and says what happens; Keep going leaves it paused
    page.locator('[data-end]').click()
    page.wait_for_selector('.px-modal .px-btn--danger', timeout=4000)
    msg = page.locator('.px-modal').last.inner_text()
    C.ok('counts only when it is complete' in msg and 'stay in the Log' in msg, f'{tag}: stopping asks first and says what is kept ({msg[:90]!r})')
    page.keyboard.press('Escape')
    page.wait_for_timeout(200)
    C.ok(page.evaluate('__play.state') == 'paused' and page.locator('.px-modal').count() == 0, f'{tag}: Keep going (Esc) leaves the check paused')
    page.locator('[data-end]').click()
    page.locator('.px-modal .px-btn--danger').click()
    page.wait_for_timeout(250)
    head = page.locator('.pl-screen').first.inner_text()
    C.ok('Check stopped' in page.locator('h1').first.inner_text() and 'stay in the Log' in head and len(page.evaluate('PX.core.store.state.assess')) == 1, f'{tag}: a check stopped part-way is not used for results; its answers stay in the Log')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def run_daily(b, C):
    tag = 'daily'
    ctx = b.new_context(viewport={'width': 412, 'height': 880}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme='dark', permissions=['clipboard-read', 'clipboard-write'])
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    page.locator('.px-slot--daily [data-go="play?mode=daily"]').click()
    page.wait_for_timeout(200)
    C.ok(card(page) == 'intro' and 'One scored attempt' in page.locator('[data-card-box]').inner_text(), f'{tag}: intro says one scored attempt')
    ok = drive(page, '!!document.querySelector(".pl-daily")', limit=300)
    C.ok(ok, f'{tag}: the challenge runs to its result')
    line = page.locator('.pl-daily .px-copybox-text').input_value()
    C.ok(re.fullmatch(r'Parallax Daily #\d+ · \d/\d+ · discord\.gg/chmr', line) is not None, f'{tag}: share line {line!r}')
    page.locator('.pl-daily [data-copy]').first.click()
    page.wait_for_timeout(300)
    C.ok('Cop' in page.locator('.pl-daily .px-copybox-status').first.inner_text(), f'{tag}: Copy reports back')
    shot(page, 'flows_daily_412_dark.png', True)
    page.locator('.pl-daily [data-share]').click()
    page.wait_for_timeout(400)
    C.ok(page.evaluate('PX.ui.modalOpen()') >= 1, f'{tag}: the share card sheet opens')
    page.keyboard.press('Escape')
    day = page.evaluate('PX.engine.daily.day(Date.now())')
    first = page.evaluate(f'PX.core.store.state.daily["{day}"]')
    page.locator('.pl-daily [data-again]').click()
    page.wait_for_timeout(200)
    C.ok(card(page) == 'intro' and 'practice' in page.locator('[data-card-box]').inner_text(), f'{tag}: a replay is practice')
    drive(page, '!!document.querySelector(".pl-daily")', limit=300)
    C.ok(page.evaluate(f'PX.core.store.state.daily["{day}"].right') == first['right'] and 'Practice round' in page.locator('.pl-daily').inner_text(), f'{tag}: the scored result stays as it was')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def run_modes(b, C):
    tag = 'modes'
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    # v1.1: sessions are time-boxed on active time; 20 s keeps this test quick
    page.evaluate('PX.core.store.state.settings.sessionMin = 3; PX.ui.play.config.budgetMs = 20000;')
    # Path: the intro card names the stage and offers its demo (one card, I1 B12); a block end
    # shows the level; the check-in comes once
    go(page, {'mode': 'path', 'exId': 'hidden'})
    C.ok(card(page) == 'intro' and 'stage 1 of 10' in page.locator('[data-card-box]').inner_text(), f'{tag}: Path intro names the stage')
    C.ok(page.locator('[data-card-box="intro"] [data-card="watch"]').count() == 1 and page.locator('[data-card-box="intro"] [data-card="start"]').count() == 1, f'{tag}: the intro offers the stage demo itself')
    shot(page, 'flows_path_stage.png')
    click_card(page, 'watch')
    C.ok(card(page) is None, f'{tag}: no second stage card')
    page.wait_for_function('__play.played.demos >= 1', timeout=10000)
    page.wait_for_function('__play.state === "respond"', timeout=10000)
    C.ok(page.evaluate('PX.core.store.state.trials.length') == 0, f'{tag}: the stage demo is never logged')
    seen = {'level': False, 'checkin': False}
    for _ in range(400):
        if page.locator('[data-note="level"]').count():
            seen['level'] = True
        if page.locator('[data-note="checkin"] [data-checkin="parts"]').count():
            seen['checkin'] = True
            page.locator('[data-checkin="parts"]').click()
        if seen['level'] and seen['checkin']:
            break
        st = state(page)
        if st == 'respond':
            page.evaluate('__play.answer(Math.random() < 0.75).catch(() => 0)')
        elif st in ('reveal', 'showme'):
            if not page.locator('[data-note="checkin"]').count() or seen['checkin']:
                page.evaluate('__play.next()')
        elif page.locator('.pl-summary').count():
            break
        page.wait_for_timeout(40)
    C.ok(seen['level'], f'{tag}: a block end shows the level change')
    C.ok(seen['checkin'] and page.evaluate('PX.core.store.state.strategies.length') == 1 and page.evaluate('PX.core.store.state.strategies[0].strategy') == 'parts', f'{tag}: the strategy check-in is recorded')
    shot(page, 'flows_path_notes.png')
    page.evaluate('__play.end()')
    page.wait_for_selector('.pl-summary', timeout=8000)
    C.ok('Path' in page.locator('.pl-summary').inner_text(), f'{tag}: the Path summary shows the stage')
    # Speed: unavailable until unlocked; then a deadline per item and the Speed results
    go(page, {'mode': 'speed', 'exId': 'spin', 'variant': 'samediff'})
    C.ok('Not available' in page.locator('h1').first.inner_text() and 'Path stage' in page.locator('.px-lead').inner_text(), f'{tag}: Speed says why it is not open yet')
    page.evaluate('''(() => { const now = Date.now(), ps = PX.engine.path.state(PX.core.store.state, 'spin');
      ps.passed['1'] = { at: now, iv: 0, next: now + 3 * 864e5, held: true, maxHeld: 0, last: null }; })()''')
    go(page, {'mode': 'speed', 'exId': 'spin', 'variant': 'samediff'})
    C.ok(card(page) == 'intro', f'{tag}: Speed intro')
    click_card(page, 'start')
    wait_state(page, 'respond')
    C.ok(page.locator('.pl-limit.is-running').is_visible() and page.evaluate('__play.item.params.variant') == 'samediff', f'{tag}: Speed items carry a deadline, in the chosen variant')
    drive(page, '!!document.querySelector(".pl-summary")', limit=400)
    C.ok('Right answers in time' in page.locator('.pl-summary').inner_text(), f'{tag}: the Speed results')
    # Threshold: Span length
    go(page, {'mode': 'threshold', 'protocol': 'span-length'})
    drive(page, '!!document.querySelector(".pl-summary")', limit=400)
    C.ok('Threshold:' in page.locator('.pl-summary').inner_text() and len(page.evaluate('PX.core.store.state.mot["span-length"] || []')) == 1, f'{tag}: a Threshold run is saved')
    # Free play setup: fixed settings, a timer, a length
    go(page, {'mode': 'free', 'exId': 'hidden'})
    C.ok(page.locator('.pl-free').count() == 1, f'{tag}: Free play opens its setup')
    page.locator('[data-setting="free-mode"] label:has-text("Fixed settings")').click()
    page.locator('select[data-free="extra"]').select_option('1')
    page.locator('[data-setting="free-timer"] label:has-text("10 s")').click()
    page.locator('[data-setting="free-items"] label:has-text("10 items")').click()
    shot(page, 'flows_free_setup.png', True)
    page.locator('[data-free-start]').click()
    wait_state(page, 'respond')
    C.ok(page.evaluate('__play.item.params.extra') == 1 and page.locator('.pl-limit.is-running').is_visible(), f'{tag}: Free play uses the chosen settings and timer')
    drive(page, '!!document.querySelector(".pl-summary")', limit=300)
    C.ok('Free play is logged' in page.locator('.pl-summary').inner_text(), f'{tag}: Free play summary says it is never rated')
    # How to play → Watch, Try, Go → a Train session with the exercise pinned
    page.evaluate('void PX.ui.play.howTo("span")')
    page.wait_for_timeout(150)
    C.ok(page.locator('.px-modal.pl-howto').count() == 1, f'{tag}: How to play opens')
    page.locator('.px-modal.pl-howto .px-btn--primary').click()
    page.wait_for_timeout(200)
    C.ok(page.locator('[data-wtg="span"]').count() == 1, f'{tag}: it starts Watch, Try, Go')
    ok = drive(page, '!!document.querySelector("[data-card=session]")', limit=200)
    C.ok(ok and page.evaluate('PX.core.store.state.trials.length') == page.evaluate('PX.core.store.state.trials.length'), f'{tag}: Watch, Try, Go ends with a way to start')
    page.locator('[data-card="session"]').click()
    wait_state(page, 'respond')
    C.ok('EX-09' in page.locator('.pl-hud-id').inner_text(), f'{tag}: the session starts with the exercise pinned')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


NEW_IDS = ['openings', 'patviews', 'angles', 'patfold', 'cubes', 'form', 'knots', 'reckon']
# The plan Today should show: the first three of the beginner order in force that this browser
# can draw (play.js plans with the cheap capability check).
EXPECT = '''(focus) => {
  const C = PX.engine.config.session, can = (id) => { const d = PX.ex.get(id); return !!d && PX.ui.play.canRun(d, true); };
  const order = focus ? C.patOrder.concat(C.beginner.filter((id) => !C.patOrder.includes(id))) : C.beginner.filter((id) => !PX.ex.get(id) || !PX.ex.get(id).pat);
  return order.filter(can).slice(0, 3).map((id) => PX.ex.get(id).short);
}'''
# Every level of the new exercises' settings in the Library's words: none may read as the raw
# "label value" fallback (RV-play-dat item 4: "Features 2 + 1 + 1, edges straight, ...").
PHRASES = '''(ids) => {
  const X = PX.ui.exinfo, out = [], bad = [];
  ids.forEach((id) => {
    const d = PX.ex.get(id);
    if (!d) return;
    d.dims.forEach((dim) => dim.levels.forEach((v) => {
      const s = X.dimText(d, dim, v), low = (dim.label || dim.key).toLowerCase();
      out.push(id + '.' + dim.key + ' = ' + s);
      if (s.toLowerCase() === low + ' ' + X.valueText(dim, v).toLowerCase()) bad.push(id + '.' + dim.key + ': ' + s);
    }));
  });
  return { out, bad };
}'''


def today_names(page):
    return page.evaluate('[...document.querySelectorAll(".px-slot--session .px-protocol-name")].map((e) => e.textContent.trim())')


def to_today(page):
    page.evaluate('void PX.core.router.go("home", {}, { force: true })')
    page.wait_for_selector('.px-slot--session', timeout=10000)
    page.wait_for_timeout(150)


def lib_switch(page):
    page.evaluate('void PX.core.router.go("library", {}, { force: true })')
    page.wait_for_selector('.px-excards', timeout=10000)
    sw = page.locator('[data-setting="patFocus"] label').first
    sw.scroll_into_view_if_needed()
    sw.tap()
    page.wait_for_timeout(250)


def run_today(b, C):
    tag = 'today'
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    boot(page, knobs=False)
    to_today(page)
    body = page.locator('body').inner_text()
    C.ok(page.locator('.px-tag--sample, [data-sample]').count() == 0 and 'Sample data' not in body, f'{tag}: a fresh profile shows no sample data')
    ach, lv = page.locator('.px-slot--achievements [data-empty]'), page.locator('.px-slot--levels [data-empty]')
    C.ok(ach.count() == 1 and 'No achievements yet' in ach.inner_text() and lv.count() == 1 and 'No levels yet' in lv.inner_text(),
         f'{tag}: achievements and levels show empty states')
    shot(page, 'flows_today_fresh.png', full=True)
    off = page.evaluate(EXPECT, False)
    names = today_names(page)
    C.ok(names == off and page.locator('[data-patfocus]').count() == 0, f'{tag}: focus off: {names} (expected {off}), no focus line')
    n_today = int(page.locator('[data-count]').first.get_attribute('data-count'))
    page.evaluate('void PX.core.router.go("library", {}, { force: true })')
    page.wait_for_selector('.px-excards', timeout=10000)
    m = re.match(r'(\d+) training exercises', page.locator('.px-screen-head .px-screen-meta').first.inner_text())
    n_lib = int(m.group(1)) if m else -1
    C.ok(n_today == n_lib == page.evaluate('PX.ex.list("train").length'), f'{tag}: Today and the Library count the same exercises ({n_today}, {n_lib})')
    # on, from the Library's switch: the formats lead Today's plan, which says so; also after a reload
    lib_switch(page)
    C.ok(page.evaluate('PX.core.store.state.settings.patFocus') is True, f'{tag}: the Library switch turns the DAT-style focus on')
    on = page.evaluate(EXPECT, True)
    for when in ('at once', 'after a reload'):
        if when == 'after a reload':
            page.wait_for_timeout(400)  # the save
            boot(page, knobs=False)
        to_today(page)
        names, line = today_names(page), page.locator('[data-patfocus="on"]')
        C.ok(names == on and line.count() == 1 and 'DAT-style focus is on' in line.inner_text(), f'{tag}: focus on, {when}: {names} (expected {on}) with the focus line')
    # the line is on the first screen and nothing covers it (on phones Start sticks above the tab bar)
    seen = page.evaluate('''() => { const el = document.querySelector('[data-patfocus="on"]'); if (!el) return 'missing';
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, ys = [r.top + 2, r.bottom - 2];
      if (r.bottom > innerHeight) return 'below the fold (' + Math.round(r.bottom) + ' > ' + innerHeight + ')';
      return ys.every((y) => el.contains(document.elementFromPoint(x, y))) ? 'ok' : 'covered'; }''')
    C.ok(seen == 'ok', f'{tag}: the focus line is visible on the first screen ({seen})')
    shot(page, 'flows_today_focus.png')
    lib_switch(page)
    to_today(page)
    names = today_names(page)
    C.ok(page.evaluate('PX.core.store.state.settings.patFocus') is False and names == off and page.locator('[data-patfocus]').count() == 0,
         f'{tag}: focus off again: {names} (expected {off}), no focus line')
    # the settings in plain words (summaries and Free play use the Library's phrases)
    ph = page.evaluate(PHRASES, NEW_IDS)
    C.ok(len(ph['out']) > 50 and not ph['bad'], f'{tag}: every setting of the new exercises reads as words ({len(ph["out"])} levels; raw: {ph["bad"][:4]})')
    (OUT / 'flows_today_phrases.txt').write_text('\n'.join(ph['out']) + '\n', encoding='utf-8')
    go(page, {'mode': 'free', 'exId': 'openings'})
    page.wait_for_selector('select[data-free="exercise"]', timeout=10000)
    page.locator('[data-setting="free-mode"] label:has-text("Fixed settings")').tap()
    page.wait_for_timeout(150)
    opts = page.locator('select[data-free="keyview"] option').all_inner_texts()
    C.ok(bool(opts) and opts[0] == 'mostly the front outline fits (sometimes the side)', f'{tag}: Free play lists Openings settings in words ({opts})')
    C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:3]}')
    ctx.close()


def main():
    C = Checks('flows')
    with sync_playwright() as p:
        b = launch(p)
        for fn in (run_tour, run_check, run_daily, run_modes, run_today):
            try:
                fn(b, C)
            except Exception as e:
                C.ok(False, f'{fn.__name__} crashed: {str(e)[:300]}')
        b.close()
    sys.exit(C.summary({'screenshots': str(OUT)}))


if __name__ == '__main__':
    main()
