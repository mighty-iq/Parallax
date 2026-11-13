"""The M1 acceptance test (docs/dev/PLAN.md M1; docs/research/v1.1/I1-timing-bugs.md).

Part 1, real time (no fake clock): Train, Path and Speed sessions of MIN minutes each, played with
fast answers, a 100 s pause, 100 s in a hidden tab, 70 s idle on an item and slow (20 s) answers.
Each must end within one item of MIN:00 of active time; the pause sheet's "The clock is stopped"
must hold; the HUD, the summary, the Log, the share card and the weekly goal must show the same
minutes (PX.core.clock.fmtMinutes of the session's practiceMs).
Part 2, the I1 repros, fast (PX.debug.fast, short sessions): reloads (T4), the Daily Challenge
(T6), Progress counts (B1), the HUD counter (B2), Sounds (B3), one CSV (B4), the Pause label
(B6), stopped Threshold runs (B7), Threshold units (B8), the deadline bar (B11), Path's one card
(B12), Speed sizing (T7), and the v1.1 hooks H1-H4 (body classes, the guide, void on a turn, the
input column).

Run:  tests/e2e/pwslot.sh python3 tests/e2e/clock.py            full: 5-minute sessions (~30 min)
      tests/e2e/pwslot.sh python3 tests/e2e/clock.py quick      3-minute sessions, shorter breaks (~15 min)
      tests/e2e/pwslot.sh python3 tests/e2e/clock.py repro      part 2 only (~3 min)
Report: tests/e2e/out/clock/report.json; screenshots in the same folder. Hidden tabs are simulated
by overriding document.hidden and firing visibilitychange (headless Chromium never hides its
only page), as the I1 audit did, so the app's own listeners run as in a real browser. """
import json, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import launch, Console, Checks, ROOT, OUT as OUT_ROOT

OUT = OUT_ROOT / 'clock'
OUT.mkdir(parents=True, exist_ok=True)
INDEX = ROOT / 'index.html'
READY = 'document.documentElement.getAttribute("data-px-ready") === "1"'
ARG = sys.argv[1] if len(sys.argv) > 1 else 'full'
PLAN = {
    'full': {'min': 5, 'pause': 100, 'hidden': 100, 'idle': 70, 'slow': 20, 'modes': ['train', 'path', 'speed']},
    'quick': {'min': 3, 'pause': 25, 'hidden': 25, 'idle': 65, 'slow': 12, 'modes': ['train', 'path', 'speed']},
}.get(ARG)
C = Checks('clock ' + ARG)
REPORT = {'arg': ARG, 'runs': {}, 'repro': {}}

HIDE_JS = '''(on) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => on });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => on ? 'hidden' : 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
}'''


def boot(page, fresh=True):
    page.goto(INDEX.as_uri())
    page.wait_for_function(READY, timeout=20000)
    for _ in range(4):  # the Chimera pop-up, then the first-run tour offer
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)


def seen_all(page):
    """No Watch, Try, Go offers: every training exercise counts as introduced."""
    page.evaluate('''(() => { const r = PX.core.store.state; r.tour = r.tour || { done: false, seen: {} };
      PX.ex.list('train').forEach(d => { r.tour.seen[d.id] = true; }); r.ui.tourOffered = 1; PX.core.store.save(); })()''')


def unlock_speed(page, ex):
    page.evaluate(f'''(() => {{ const r = PX.core.store.state, ps = PX.engine.path.state(r, {json.dumps(ex)});
      ps.passed[1] = {{ at: Date.now() - 864e5, iv: 0, next: Date.now() + 864e5, held: true, maxHeld: 0, last: null }}; PX.core.store.save(); }})()''')


def shot(page, name, full=False):
    try:
        page.screenshot(path=str(OUT / name), full_page=full, timeout=10000)
    except Exception as e:  # a slow screenshot on a loaded machine is not a failure of the app
        print('  (screenshot skipped:', name, str(e)[:60], ')', flush=True)


def go(page, params):
    page.evaluate(f'void PX.core.router.go("play", {json.dumps(params)}, {{ force: true }})')
    page.wait_for_timeout(250)


def sess(page):
    return page.evaluate('__play.session')


def wiggle(page, k=[0]):
    """A real input event (pointermove), as a person's hand gives one."""
    k[0] += 1
    page.mouse.move(40 + (k[0] * 7) % 200, 40 + (k[0] * 13) % 120)


def card(page):
    box = page.locator('[data-card-box]')
    return box.first.get_attribute('data-card-box') if box.count() else None


def handle_card(page):
    cid = card(page)
    if not cid:
        return False
    if page.locator('[data-card-box] [data-card="start"]').count():
        page.locator('[data-card-box] [data-card="start"]').first.click()
    else:
        page.locator('[data-card-box] .px-btn--primary').first.click()
    page.wait_for_timeout(120)
    return True


def wait_respond(page, ms=30000):
    t0 = time.time()
    while time.time() - t0 < ms / 1000:
        s = page.evaluate('__play.state')
        if s == 'respond':
            return True
        if (sess(page) or {}).get('done'):
            return False
        if handle_card(page):
            continue
        if s in ('reveal', 'showme'):
            page.keyboard.press('Space')
        page.wait_for_timeout(60)
    return False


def answer(page, right=0.75):
    wiggle(page)
    page.evaluate(f'__play.answer(Math.random() < {right}).catch(() => 0)')
    page.wait_for_timeout(40)
    page.keyboard.press('Space')  # Next (a real key: input, as a person gives it)


def hud(page):
    return page.evaluate('(document.querySelector(".pl-hud-meta") || {}).textContent || ""')


def hud_ok(page, budget):
    """The HUD's countdown equals fmtLeft(budget - activeMs), allowing the 5 s tick. None when no
    session is on screen any more."""
    h = hud(page)
    ok = page.evaluate(f'''(() => {{ const m = document.querySelector(".pl-hud-meta"), S = __play.session;
      if (!m || !S || S.done) return null;
      const a = S.activeMs, K = PX.core.clock, t = m.textContent;
      return [0, 2500, 5100].some(d => t.indexOf(K.fmtLeft({budget} - a + d)) >= 0) || /last item/.test(t); }})()''')
    return ok, h


def play_session(page, mode, P):
    """One real-time session: returns the run's measurements."""
    budget = P['min'] * 60000
    # the idle phase adds 60 s of active time; the slow phase follows it, then quick answers to the end
    marks = {'pause': budget * 0.1, 'hidden': budget * 0.2, 'idle': budget * 0.3, 'slow': budget * 0.3 + 60000}
    done_marks, items, hud_checks, ev = set(), [], [], {}
    last_a = 0
    t_start = time.time()
    while time.time() - t_start < budget / 1000 * 4 + 900:
        if not wait_respond(page):
            break
        s = sess(page)
        a = s['activeMs']
        for name in ('pause', 'hidden', 'idle', 'slow'):
            if name in done_marks or a < marks[name]:
                continue
            done_marks.add(name)
            if name == 'pause':
                wiggle(page)
                page.keyboard.press('Escape')
                page.wait_for_timeout(300)
                a0 = sess(page)['activeMs']
                label = page.evaluate('document.querySelector("[data-pause]").firstChild.textContent')
                sheet = page.evaluate('document.querySelector(".pl-pause-text").textContent')
                page.wait_for_timeout(P['pause'] * 1000)
                a1 = sess(page)['activeMs']
                ev['pause'] = {'delta': a1 - a0, 'label': label, 'sheet': sheet, 'reasons': sess(page)['clock']}
                shot(page, f'{mode}_pause.png')
                page.locator('[data-resume]').click()
                page.wait_for_timeout(200)
                hud_checks.append(hud_ok(page, budget))
            elif name == 'hidden':
                a0 = sess(page)['activeMs']
                page.evaluate(f'({HIDE_JS})(true)')
                page.wait_for_timeout(P['hidden'] * 1000)
                a1 = sess(page)['activeMs']
                page.evaluate(f'({HIDE_JS})(false)')
                ev['hidden'] = {'delta': a1 - a0, 'state': page.evaluate('__play.state')}
                page.wait_for_timeout(200)
                if page.evaluate('__play.state') == 'paused':
                    page.locator('[data-resume]').click()  # a hidden tab pauses the item
                    page.wait_for_timeout(200)
                hud_checks.append(hud_ok(page, budget))
            elif name == 'idle':
                wiggle(page)  # the last input: from here on nobody touches anything for P['idle'] s
                s0 = page.evaluate('({ a: __play.session.activeMs, st: __play.state, r: __play.session.clock, t: performance.now() })')
                trace = []
                for _ in range(P['idle'] // 5):  # look, never touch: no input reaches the page
                    page.wait_for_timeout(5000)
                    trace.append(page.evaluate('[Math.round(__play.session.activeMs), __play.state, __play.session.clock.join("+"), Math.round(performance.now())]'))
                page.wait_for_timeout((P['idle'] % 5) * 1000)
                a1 = sess(page)['activeMs']
                ev['idle'] = {'delta': a1 - s0['a'], 'reasons': sess(page)['clock'], 'start': s0, 'trace': trace}
                hud_checks.append(hud_ok(page, budget))
            elif name == 'slow':
                ev['slow'] = []
                for _ in range(3):
                    if not wait_respond(page):
                        break
                    wiggle(page)
                    page.wait_for_timeout(P['slow'] * 1000)
                    a1 = sess(page)['activeMs']
                    answer(page)
                    items.append(a1 - last_a)
                    ev['slow'].append(a1 - last_a)
                    last_a = a1
                hud_checks.append(hud_ok(page, budget))
            break
        if not wait_respond(page):
            break
        a = sess(page)['activeMs']
        answer(page)
        page.wait_for_timeout(60)
        s2 = sess(page)
        items.append(s2['activeMs'] - last_a)
        last_a = s2['activeMs']
        if len(items) % 15 == 0:
            hud_checks.append(hud_ok(page, budget))
    page.wait_for_function('__play.session && __play.session.done', timeout=60000)
    s = sess(page)
    res = s['res'] or {}
    session = res.get('session') or {}
    return {'budget': budget, 'items': len(items), 'activeMs': s['activeMs'], 'practiceMs': session.get('practiceMs'), 'ended': session.get('ended'),
            'wall': round(time.time() - t_start, 1), 'ev': ev, 'hud': hud_checks, 'maxLast': max(items[-3:]) if items else 0,
            'id': session.get('id'), 'summaryMs': (res.get('summary') or {}).get('ms')}


def same_minutes(page, run, mode):
    """The summary, share card, Log, Progress and Today show fmtMinutes(practiceMs)."""
    ms = run['practiceMs']
    fmt = page.evaluate(f'PX.core.clock.fmtMinutes({ms})')
    meta = page.evaluate('(document.querySelector(".px-screen-meta") || {}).textContent || ""')
    C.ok(fmt in meta, f'{mode}: the summary says {fmt} ({meta!r})')
    page.evaluate('window.__shared = null; PX.ui.share.open = function (o) { window.__shared = o; return function () {}; }')
    page.locator('[data-share]').first.click()
    page.wait_for_timeout(200)
    shared = page.evaluate('window.__shared && (window.__shared.lines || [])[0]')
    C.ok(bool(shared) and ('in ' + fmt) in shared, f'{mode}: the share card says {fmt} ({shared!r})')
    page.evaluate('void PX.core.router.go("log")')
    page.wait_for_timeout(400)
    log_len = page.evaluate(f'''(() => {{ const d = document.querySelector('[data-session="{run['id']}"] .px-sess-len'); return d ? d.textContent : null; }})()''')
    C.ok(log_len == fmt, f'{mode}: the Log says {fmt} ({log_len!r})')
    page.evaluate('void PX.core.router.go("progress")')
    page.wait_for_timeout(500)
    prog = page.evaluate('(document.querySelector(".px-goal-time") || {}).textContent || ""')
    C.ok(('this week: ' + fmt) in prog, f'{mode}: Progress (weekly goal) says {fmt} this week ({prog!r})')
    page.evaluate('void PX.core.router.go("home")')
    page.wait_for_timeout(400)
    today = page.evaluate('(document.querySelector(".px-slot--goal [data-practice]") || {}).textContent || ""')
    C.ok(fmt in today, f'{mode}: Today (weekly goal) says {fmt} ({today!r})')
    REPORT['runs'][mode]['shown'] = {'fmt': fmt, 'summary': meta, 'share': shared, 'log': log_len, 'progress': prog, 'today': today}


def realtime(b):
    for mode in PLAN['modes']:
        ctx = b.new_context(viewport={'width': 1280, 'height': 800})
        page = ctx.new_page()
        con = Console(page)
        boot(page)
        seen_all(page)
        page.evaluate(f'PX.core.store.state.settings.sessionMin = {PLAN["min"]}; PX.core.store.save();')
        params = {'mode': mode}
        if mode in ('path', 'speed'):
            params['exId'] = 'fold'
        if mode == 'speed':
            unlock_speed(page, 'fold')
        go(page, params)
        run = play_session(page, mode, PLAN)
        REPORT['runs'][mode] = run
        shot(page, f'{mode}_summary.png', True)
        b_ms, a = run['budget'], run['practiceMs'] or 0
        tol = max(run['maxLast'], 1500) + 1500
        C.ok(abs(a - b_ms) <= tol, f'{mode}: ends within one item of {PLAN["min"]}:00 active ({a / 1000:.1f} s; last items up to {run["maxLast"] / 1000:.1f} s; {run["items"]} items; wall {run["wall"]} s)')
        C.ok(run['ended'] == 'complete', f'{mode}: the session ran to its end ({run["ended"]})')
        C.ok(round(run['activeMs']) == a and run['summaryMs'] == a, f'{mode}: one number: the clock {run["activeMs"]:.0f}, stored {a}, summary {run["summaryMs"]}')
        ev = run['ev']
        if 'pause' in ev:
            C.ok(abs(ev['pause']['delta']) < 600, f'{mode}: the pause sheet stops the clock ({ev["pause"]["delta"]} ms in {PLAN["pause"]} s)')
            C.ok('clock is stopped' in ev['pause']['sheet'] and ev['pause']['label'] == 'Resume', f'{mode}: the sheet says the clock is stopped; the HUD button says Resume ({ev["pause"]["label"]!r})')
        else:
            C.ok(False, f'{mode}: the pause phase did not run')
        if 'hidden' in ev:
            C.ok(abs(ev['hidden']['delta']) < 600, f'{mode}: a hidden tab stops the clock ({ev["hidden"]["delta"]} ms in {PLAN["hidden"]} s)')
        else:
            C.ok(False, f'{mode}: the hidden phase did not run')
        if 'idle' in ev:
            d = ev['idle']['delta']
            C.ok(55000 <= d <= 61500, f'{mode}: {PLAN["idle"]} s idle on an item counts 60 s at most ({d} ms)')
        else:
            C.ok(False, f'{mode}: the idle phase did not run')
        samples = [x for x in run['hud'] if x[0] is not None]
        bad = [x[1] for x in samples if not x[0]]
        C.ok(len(samples) >= 4 and not bad, f'{mode}: the HUD shows the clock\'s minutes ({len(samples)} samples; wrong: {bad[:3]})')
        same_minutes(page, run, mode)
        C.ok(not con.errors(), f'{mode}: no console errors {con.errors()[:3]}')
        ctx.close()


def answer_n(page, n, right=True):
    for _ in range(n):
        if not wait_respond(page, 20000):
            return False
        wiggle(page)
        page.evaluate(f'__play.answer({json.dumps(right)}).catch(() => 0)')
        page.wait_for_function('__play.state === "reveal" || __play.state === "showme" || __play.state === "done" || !__play.session || __play.session.done', timeout=8000)
        page.keyboard.press('Space')
        page.wait_for_timeout(80)
    return True


def repro(b):
    R = REPORT['repro']
    ctx = b.new_context(viewport={'width': 1280, 'height': 800})
    page = ctx.new_page()
    con = Console(page)
    boot(page)
    seen_all(page)
    page.evaluate('PX.debug.fast(true);')

    # H1, H2, H4, B2, B6: a Free play run of 4 items
    go(page, {'mode': 'free', 'exId': 'fold', 'run': '1', 'trials': 4})
    wait_respond(page)
    C.ok(page.evaluate('document.body.classList.contains("px-item") && !document.body.classList.contains("px-stim")'), 'H1: px-item on <body> during an item; px-stim off once the answer controls are live')
    C.ok(page.locator('.pl-player > .pl-guide .pl-goal').count() == 1 and page.locator('.pl-hud .pl-hud-guide[data-guide]').count() == 1 and page.locator('.pl-hud .pl-hud-keys').count() == 1, 'H2: the goal sits in .pl-guide; the HUD has Help (.pl-hud-guide) and Keys (.pl-hud-keys)')
    page.evaluate('document.querySelector(".pl-hud-guide").click()')  # css shows Help on phones only
    C.ok(page.evaluate('document.querySelector(".pl-player").classList.contains("pl-guide-open")') and page.get_attribute('.pl-hud-guide', 'aria-expanded') == 'true', 'H2: Help toggles pl-guide-open')
    page.evaluate('document.querySelector(".pl-hud-guide").click()')
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    C.ok(page.evaluate('document.querySelector("[data-pause]").firstChild.textContent') == 'Resume' and page.evaluate('document.body.classList.contains("px-item")'), 'B6: the HUD button says Resume while paused; px-item stays under the pause sheet')
    page.locator('[data-resume]').click()
    wait_respond(page)
    page.locator('.pl-grid .px-choice').first.click()
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"')
    C.ok('item 1 of 4' in hud(page), f'B2: the HUD counter stays on the answered item during its feedback ({hud(page)!r})')
    row = page.evaluate('PX.core.store.state.trials.slice(-1)[0]')
    C.ok(len(row) == 12 and row[10] == 2 and row[11] == 1, f'H4: the row has the display class (2 large) and the input (1 mouse): {row[8:]}')
    answer_n(page, 3)
    page.wait_for_selector('.pl-summary', timeout=10000)
    C.ok(not page.evaluate('document.body.classList.contains("px-item")'), 'H1: px-item off on the summary')
    ses = page.evaluate('PX.core.store.state.sessions.slice(-1)[0]')
    C.ok(ses.get('display') == 'large' and ses.get('viewport') == '1280x800' and ses.get('input') in ('mouse', 'key'), f'H4: the session keeps display, viewport and input ({ses.get("display")}, {ses.get("viewport")}, {ses.get("input")})')

    # H3: turning the screen while Span's sequence plays voids the trial
    page.evaluate('PX.debug.fast(false)')  # the sequence plays at its real speed
    go(page, {'mode': 'free', 'exId': 'span', 'run': '1', 'trials': 2})
    page.wait_for_function('__play.state === "present"', timeout=15000)
    C.ok(page.evaluate('document.body.classList.contains("px-stim")'), 'H1: px-stim while the stimulus plays')
    page.set_viewport_size({'width': 800, 'height': 1280})
    page.wait_for_function('__play.state === "respond"', timeout=20000)
    page.set_viewport_size({'width': 1280, 'height': 800})
    page.evaluate('__play.answer(true).catch(() => 0)')
    page.wait_for_timeout(300)
    last = page.evaluate('__play.last')
    C.ok(last and last.get('outcome') == 'stutter' and last.get('voidReason') == 'turned', f'H3: a turn during the stimulus voids the trial ({last and last.get("voidReason")})')
    C.ok('turned' in page.locator('.pl-verdict').inner_text(), 'H3: the verdict says why')
    page.evaluate('__play.end(); PX.debug.fast(true);')
    page.wait_for_timeout(300)

    # B3: Sounds: off by default; on, a tap unlocks them and an answer plays a tone
    C.ok(page.evaluate('PX.core.store.state.settings.sound') is False, 'B3: sounds are off by default')
    page.evaluate('PX.core.store.state.settings.sound = true')
    go(page, {'mode': 'free', 'exId': 'fold', 'run': '1', 'trials': 2})
    wait_respond(page)
    page.locator('.pl-grid .px-choice').first.click()
    page.wait_for_timeout(200)
    snd = page.evaluate('__play.sound')
    C.ok(snd['ready'] and snd['played'] >= 1, f'B3: a tap unlocks Web Audio and the answer plays a tone ({snd})')
    page.evaluate('PX.core.store.state.settings.sound = false; __play.end()')
    page.wait_for_timeout(300)

    # B11: the deadline bar stays empty after a time-out (it no longer refills)
    go(page, {'mode': 'free', 'exId': 'rotate', 'params': {'angle': 0, 'axis': 0, 'cubes': 0, 'variant': 'samediff'}, 'trials': 2, 'deadlineMs': 900})
    wait_respond(page)
    page.wait_for_function('__play.state === "reveal" || __play.state === "showme"', timeout=10000)
    page.wait_for_timeout(200)
    tf = page.evaluate('getComputedStyle(document.querySelector(".pl-limit-fill")).transform')
    C.ok(page.evaluate('__play.last.timeout') and (tf.startswith('matrix(0,') or tf.startswith('matrix(0.0')), f'B11: after "Time is up" the bar stays empty ({tf})')
    page.evaluate('__play.end()')
    page.wait_for_timeout(300)

    # B8 units; B7 a stopped Threshold run earns nothing and is not saved
    C.ok(page.evaluate('PX.ui.play.thresholdText({ threshold: 6810.06, unit: "ms" })') == '6.81 s' and 'cw/s' in page.evaluate('PX.ui.play.thresholdText({ threshold: 0.34, unit: "speed" })'), 'B8: thresholds in seconds and cw/s')
    go(page, {'mode': 'threshold', 'protocol': 'span-length'})
    handle_card(page)
    answer_n(page, 3)
    wait_respond(page)
    page.evaluate('__play.end()')
    page.wait_for_selector('.pl-summary', timeout=10000)
    txt = page.locator('.pl-summary').inner_text()
    C.ok('no threshold was saved' in txt and 'Measured' not in txt and not page.evaluate('(PX.core.store.state.mot["span-length"] || []).length'), 'B7: a stopped Threshold run is reported, not saved, and earns no achievement')

    # B12 Path: one card with the demo choice; T7 Speed sized from the deadline
    go(page, {'mode': 'path', 'exId': 'nets'})
    cards = page.locator('[data-card-box="intro"] [data-card]').evaluate_all('els => els.map(e => e.dataset.card)')
    C.ok('watch' in cards and 'start' in cards, f'B12: the Path intro offers the demo itself ({cards})')
    page.locator('[data-card-box="intro"] [data-card="start"]').click()
    page.wait_for_timeout(400)
    C.ok(card(page) is None and wait_respond(page), 'B12: no second stage card')
    page.evaluate('__play.end()')
    page.wait_for_timeout(300)
    unlock_speed(page, 'fold')
    sp = page.evaluate('''(() => { const p = PX.engine.modes.start(JSON.parse(JSON.stringify(PX.core.store.state)), 'speed', { now: Date.now(), exId: 'fold', minutes: 5 });
      return { avg: p.avgMs, d: Math.pow(10, PX.engine.staircase.value(p.sc)) }; })()''')
    C.ok(sp['avg'] <= sp['d'] + 2501, f'T7: Speed sizes its plan from the deadline ({sp})')

    # B4: one CSV
    a = page.evaluate('PX.core.store.exportCSV().split("\\r\\n")[0]')
    b2 = page.evaluate('PX.ui.log.csv(PX.ui.log.rows(PX.core.store.state)).split("\\r\\n")[0]')
    C.ok(a == b2 and a.endswith('display,input') and 'session' in a, f'B4: Settings and the Log write one CSV format ({a})')

    # B1: Progress counts answered training items only
    n_ans = page.evaluate('''(() => { const r = PX.core.store.state; return r.trials.filter(t => (t[5] === 0 || t[5] === 1) && r.idx.mode[t[2]] !== 'check').length; })()''')
    page.evaluate('void PX.core.router.go("progress")')
    page.wait_for_timeout(400)
    meta = page.locator('.px-screen-meta').first.inner_text()
    C.ok(meta.startswith(f'{n_ans} answer'), f'B1: Progress counts {n_ans} answered items, not every row ({meta!r}; rows {page.evaluate("PX.core.store.state.trials.length")})')
    R['progress'] = meta

    # T6: the Daily Challenge: End now keeps the attempt; Today numbers it; it goes on later
    go(page, {'mode': 'daily'})
    handle_card(page)
    answer_n(page, 3)
    wait_respond(page)
    page.keyboard.press('Escape')
    page.locator('[data-end]').click()
    page.wait_for_selector('.pl-daily', timeout=10000)
    day = page.evaluate('PX.engine.daily.day(Date.now())')
    entry = page.evaluate(f'PX.core.store.state.daily[{json.dumps(day)}]')
    C.ok(entry and entry.get('partial') is True and entry.get('answered') == 3, f'T6: End now keeps the scored attempt open ({entry})')
    C.ok(page.locator('.pl-marks li.is-open').count() == 5 and page.locator('.pl-marks li.is-wrong').count() <= 3, 'T6: unanswered items are drawn as not answered, never wrong')
    shot(page, 'daily_partial.png', True)
    page.evaluate('void PX.core.router.go("home")')
    page.wait_for_timeout(400)
    dtxt = page.locator('.px-slot--daily').inner_text()
    num = page.evaluate('PX.engine.daily.status(PX.core.store.state, Date.now()).number')
    C.ok(f'#{num}' in dtxt and 'NaN' not in dtxt and '3 of 8 answered' in dtxt, f'T6: Today shows the number and the attempt so far ({dtxt[:120]!r})')
    page.locator('.px-slot--daily .px-btn').first.click()
    page.wait_for_timeout(300)
    C.ok('goes on where it stopped' in page.locator('[data-card-box="intro"]').inner_text(), 'T6: the next start says the attempt goes on')
    handle_card(page)
    wait_respond(page)
    C.ok('item 4 of 8' in hud(page), f'T6: it goes on at item 4 ({hud(page)!r})')
    page.evaluate('__play.end()')
    page.wait_for_timeout(300)

    # T4: a reload mid-session saves it once and shows its summary; Today stays clean
    page.evaluate('PX.ui.play.config.budgetMs = null')
    go(page, {'mode': 'train'})
    answer_n(page, 4)
    wait_respond(page)
    n0 = page.evaluate('PX.core.store.state.sessions.length')
    page.reload()
    page.wait_for_function(READY, timeout=20000)
    for _ in range(4):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
    s = page.evaluate('PX.core.store.state.sessions')
    C.ok(len(s) == n0 + 1 and s[-1]['ended'] == 'closed' and s[-1]['trials'] >= 3, f'T4: the cut session is saved once, as closed ({len(s) - n0}, {s[-1].get("ended")})')
    C.ok(page.locator('[data-restored] .pl-summary').count() == 1 and page.evaluate('__play.state') == 'idle', 'T4: the reopened page shows its summary and starts nothing')
    page.reload()
    page.wait_for_function(READY, timeout=20000)
    C.ok(page.evaluate('PX.core.store.state.sessions.length') == n0 + 1, 'T4: reopening on the summary adds no session')
    page.evaluate('PX.core.store.state.ui.lastSummary.at = Date.now() - 13 * 3600e3; PX.core.store.flush && PX.core.store.save();')
    page.wait_for_timeout(1300)
    page.reload()
    page.wait_for_function(READY, timeout=20000)
    C.ok(page.evaluate('PX.core.router.current().name') == 'home', 'T4: an old #/play hash opens Today')
    C.ok(not con.errors(), f'repro: no console errors {con.errors()[:3]}')
    ctx.close()


def main():
    with sync_playwright() as p:
        b = launch(p)
        parts = [repro] if ARG == 'repro' else [realtime, repro]
        for fn in parts:
            try:
                fn(b)
            except Exception as e:  # a crash in one part is a failure; the rest still runs
                C.ok(False, f'{fn.__name__} crashed: {str(e)[:400]}')
        b.close()
    (OUT / 'report.json').write_text(json.dumps(REPORT, indent=1, default=str))
    sys.exit(C.summary({'report': str(OUT / 'report.json')}))


if __name__ == '__main__':
    if ARG not in ('full', 'quick', 'repro'):
        print('usage: clock.py [full|quick|repro]')
        sys.exit(2)
    main()
