"""E2E: the dev harness with Track (EX-01, attention practice).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_track.py   (two browser slots per machine)

1. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark, both variants: the motion
   notice before the first trial; non-blank stage pixels at the response; numbers 1–N on the
   spheres; a right answer by keyboard (numbers, Enter) and a wrong one by pointer (tap on the
   phone, then Confirm) score as expected; the reveal marks found, wrong and missed; show me runs to
   the end; no horizontal scroll on the phone
2. normal speed: the cue lasts about 2 s and the motion about the tracking time (wall clock);
   screenshots of the cue and the motion (still and orbit); show me steps last 0.6–4 s and the run
   finishes, shorter with reduced motion; pause, step and replay
3. Track's void rule: a 400 ms stall at 0.84 cw/s voids the trial as a jump (one frame moves the
   spheres more than min(3r, 0.75 d_min); the stage says so, PX.bus 'trial:void',
   __harness.last.void); a 250 ms stall at 0.15 cw/s is no jump and the trial counts (late frames
   are logged, never voided); Esc during the motion pauses it, Resume finishes it, and the trial
   is void ('paused'); the frame statistics go with every response; every other trial's verdict
   is tallied and printed (how many trials this machine voids)
4. the Threshold Standard preset by params (8 spheres, 4 targets, 8 s, still camera), and a
   continuous speedValue through __harness.next() and through the URL
5. the harness test API on this custom layout: __harness.answer(true) answers with the key,
   answer(false) swaps one target for another sphere, both through the respond path; after the
   tutorial demo (run to its end, or paused and closed with Esc) the demo item is answerable
   again (state 'respond', answer clock restarted), and picks wait while the demo plays
6. the tutorial demo ends the way a right answer ends: every target in its colour and marked ✓
   with its number, the others numbered, the caption naming the targets; that end holds at least
   2 s at normal speed and with reduced motion (the demo plans ≥ 5 s in all); the first pick
   then clears it and the demo item can be answered
7. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard
8. no console errors anywhere
Screenshots: tests/e2e/out/track/<variant>_<viewport>_<theme>[_notice|_respond|_reveal|_wrong].png and
cue, motion, paused, void and show me shots. """
import sys
import time

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_track')
SHOTS = OUT / 'track'
SHOTS.mkdir(parents=True, exist_ok=True)
V = "PX.ex.view('track')"
RESPOND = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
PHASE = "(p) => window.PX && PX.ex && PX.ex.view && PX.ex.view('track') && PX.ex.view('track').phase() === p"
PARAMS = 'speed:10,targets:2,spheres:1,time:0'  # 4 of 8, 5 s, 0.27 cw/s: readable shots
TRIALS = []  # every natural trial's verdict under Track's void rule: (tag, fast, reason or None)


def note(frame, tag, fast):
    """Records whether Track's rule voided this trial (no stall injected, no pause)."""
    info = frame.evaluate(f'() => {V}.trialInfo()')
    j = info.get('judge') or {}
    TRIALS.append({'tag': tag, 'fast': fast, 'reason': (info.get('void') or {}).get('reason'),
                   'jump': round(j.get('jump') or 0, 3), 'limit': round(j.get('limit') or 0, 5), 'late': round(j.get('late') or 0, 3),
                   'generic': bool((info.get('frames') or {}).get('stutter'))})


def shot(target, name):
    target.screenshot(path=str(SHOTS / name))


def phase(frame):
    return frame.evaluate(f'() => {V}.phase()')


def start(frame, page, tap=False):
    """The motion notice is shown before the first trial of a page load: Start (Enter or tap)."""
    frame.wait_for_function(PHASE, arg='notice', timeout=30000)
    if tap:
        frame.locator('.ex-track-notice .px-btn').tap()
    else:
        page.keyboard.press('Enter')
    frame.wait_for_function("() => PX.ex.view('track').phase() !== 'notice'", timeout=10000)


def stage_ok(frame, tag):
    ok, s = non_blank(frame.locator('.ex-track-stage').screenshot(), min_distinct=12, max_top=0.97)
    C.ok(ok, f'{tag}: the stage shows the cube and the spheres ({s})')
    return s


def numbers_ok(frame, tag):
    n = frame.evaluate('() => __harness.item.n')
    labels = frame.evaluate("() => Array.from(document.querySelectorAll('.ex-track-mark .ex-track-num')).map((e) => +e.textContent).sort((a, b) => a - b)")
    C.ok(labels == list(range(1, n + 1)), f'{tag}: the spheres carry the numbers 1–{n} ({labels})')


def number_of(frame, sphere_id):
    pts = frame.evaluate(f'() => {V}.points()')
    return [p['n'] for p in pts if p['id'] == sphere_id][0]


def answer_keyboard(page, frame, tag, right=True):
    """Pick by number keys (0 = 10), then Enter."""
    item = frame.evaluate('() => ({ key: __harness.key, n: __harness.item.n })')
    ids = list(item['key'])
    if not right:
        others = [i for i in range(item['n']) if i not in ids]
        ids = ids[1:] + others[:1]
    for i in ids:
        page.keyboard.press(str(number_of(frame, i) % 10))
    picked = frame.evaluate(f'() => {V}.picks()')
    C.ok(picked == sorted(ids), f'{tag}: number keys pick the spheres ({picked} vs {sorted(ids)})')
    page.keyboard.press('Enter')
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    info = frame.evaluate(f'() => {V}.trialInfo()')
    C.ok(r['result']['correct'] is right and info['input'] == 'key', f'{tag}: a {"right" if right else "wrong"} answer by keyboard scores {"right" if right else "wrong"} ({r["result"]["correct"]}, {info["input"]})')
    C.ok(r['rtMs'] >= 0, f'{tag}: the answer clock ran from the response frame ({r["rtMs"]} ms)')
    meta = r.get('meta') or {}
    C.ok(isinstance(meta.get('frames'), dict) and 'maxGapMs' in meta['frames'] and 'jump' in meta and (meta.get('void') is None) == (not r['void']),
         f'{tag}: the frame statistics go with the response, void or not ({ {k: meta.get(k) for k in ("jump", "late", "void")} }, harness void {r["void"]})')
    return r


def answer_pointer(page, frame, tag, tap=False):
    """Wrong answer by pointer: K − 1 targets and one other sphere, then Confirm."""
    frame.locator('.ex-track-stage').scroll_into_view_if_needed()
    item = frame.evaluate('() => ({ key: __harness.key, n: __harness.item.n })')
    others = [i for i in range(item['n']) if i not in item['key']]
    want = item['key'][1:] + others[:1]
    pts = {p['id']: p for p in frame.evaluate(f'() => {V}.points()')}
    for i in want:
        x, y = pts[i]['x'], pts[i]['y']
        if tap:
            page.touchscreen.tap(x, y)
        else:
            page.mouse.click(x, y)
    picked = frame.evaluate(f'() => {V}.picks()')
    C.ok(picked == sorted(want), f'{tag}: taps pick the nearest spheres ({picked} vs {sorted(want)})')
    btn = frame.locator('.ex-track-confirm')
    btn.tap() if tap else btn.click()
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    info = frame.evaluate(f'() => {V}.trialInfo()')
    C.ok(r['result']['correct'] is False and r['result']['value'] == len(item['key']) - 1 and info['input'] == 'pointer',
         f'{tag}: a wrong answer by pointer scores wrong, K − 1 found ({r["result"]["correct"]}, {r["result"]["value"]}, {info["input"]})')
    kinds = frame.evaluate("() => Array.from(document.querySelectorAll('.ex-track-mark')).map((m) => m.dataset.kind)")
    C.ok(kinds.count('wrong') == 1 and kinds.count('missed') == 1 and kinds.count('found') == len(item['key']) - 1,
         f'{tag}: the reveal marks the found targets, the wrong pick and the missed target ({kinds})')
    badges = frame.evaluate("() => Array.from(document.querySelectorAll('.ex-track-badge')).map((b) => b.textContent).sort()")
    C.ok(sorted(badges) == sorted(['✓'] * (len(item['key']) - 1) + ['✗', '○']), f'{tag}: ✓, ✗ and ○ badges, not colour alone ({badges})')
    return r


def show_me(frame, tag, page=None, click=None):
    before = frame.evaluate('() => __harness.played.finished')
    if click is not None:
        click.click()
    elif page is not None:
        page.keyboard.press('s')
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=60000)
    ms = frame.evaluate('() => __harness.played.ms')
    C.ok(True, f'{tag}: show me ran to the end ({ms} ms)')
    return ms


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for variant in ('still', 'orbit'):
            for theme in ('light', 'dark'):
                name = f'{variant}_{tag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex='track', seed=11, v=variant, p=PARAMS, fast=1, theme=theme))
                page.wait_for_function(PHASE, arg='notice', timeout=30000)
                text = page.locator('.ex-track-notice-text').inner_text()
                C.ok('move' in text and 'Esc' in text and 'not count' in text, f'{name}: the motion notice says what moves and how to pause ({text!r})')
                if variant == 'still' and theme == 'light':
                    shot(page, name + '_notice.png')
                start(page, page, tap=phone)
                page.wait_for_function(RESPOND, timeout=30000)
                note(page, name, True)
                item = page.evaluate('() => ({ v: __harness.item.params.variant, dir: __harness.item.cam.dir })')
                C.ok(item['v'] == variant and (item['dir'] != 0) == (variant == 'orbit'), f'{name}: the item has the variant ({item})')
                stage_ok(page, name)
                numbers_ok(page, name)
                shot(page, name + '_respond.png')
                if phone:
                    sw = page.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
                    C.ok(sw[0] <= sw[1], f'{name}: no horizontal scroll ({sw})')
                    h = page.evaluate("() => { const b = document.querySelector('.ex-track-confirm').getBoundingClientRect(); return [b.width, b.height]; }")
                    C.ok(h[1] >= 44, f'{name}: Confirm is at least 44 px tall ({h})')
                if theme == 'light':
                    answer_keyboard(page, page, name, right=True)
                    shot(page, name + '_reveal.png')
                    show_me(page, name, page=page)
                    page.keyboard.press('Space')  # next trial: no notice this time
                    page.wait_for_function(RESPOND, timeout=30000)
                    note(page, name + ' next', True)
                    C.ok(page.evaluate(f'() => {V}.trialInfo().noticeSeen') is True, f'{name}: the notice shows once per page load')
                    answer_pointer(page, page, name, tap=phone)
                    shot(page, name + '_wrong.png')
                    show_me(page, name + ' (Show me button)', click=page.locator('.hx-feedback-actions .px-btn').first)
                else:
                    answer_pointer(page, page, name, tap=phone)
                    shot(page, name + '_reveal.png')
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def timed_trial(page, url, tag, cue_shot=None, motion_shot=None):
    """One trial at normal speed: wall-clock lengths of the cue and the motion."""
    page.goto(url)
    start(page, page)
    page.wait_for_function(PHASE, arg='cue', timeout=10000)
    t0 = time.time()
    if cue_shot:
        page.wait_for_timeout(700)
        shot(page, cue_shot)
    page.wait_for_function(PHASE, arg='track', timeout=15000)
    t1 = time.time()
    if motion_shot:
        page.wait_for_timeout(1500)
        shot(page, motion_shot)
    page.wait_for_function(RESPOND, timeout=60000)
    t2 = time.time()
    note(page, tag + ' normal speed', False)
    return t1 - t0, t2 - t1


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    out = {}
    cue, motion = timed_trial(page, file_url('tests/dev/harness.html', ex='track', seed=5, v='still', p='speed:10,targets:1,spheres:1,time:0'),
                              'still', 'still_1366_light_cue.png', 'still_1366_light_motion.png')
    dur = page.evaluate('() => __harness.item.dur')
    out['still'] = {'cue': round(cue, 2), 'motion': round(motion, 2), 'dur': dur}
    # The cue is 2 s and the motion item.dur of rAF time; a loaded machine with software WebGL
    # can only stretch them (dt is clamped to 100 ms per frame), never shorten them.
    C.ok(1.8 <= cue <= 6.0, f'the cue lasts about 2 s ({cue:.2f} s)')
    C.ok(dur - 0.2 <= motion <= 3 * dur, f'the motion lasts about the tracking time ({motion:.2f} s for {dur} s)')
    # Show me at its own speed, after a wrong answer (so it has a swap to show).
    answer_keyboard(page, page, 'normal speed', right=False)
    steps = page.evaluate(f"() => {V}.steps(__harness.item, __harness.last.response).map((s) => ({{ ms: s.ms, caption: s.caption }}))")
    C.ok(3 <= len(steps) <= 6 and all(600 <= s['ms'] <= 4000 for s in steps), f'show me has 3–6 steps of 0.6–4 s ({[s["ms"] for s in steps]})')
    C.ok(any('Slow motion' in s['caption'] for s in steps), 'show me has a slow-motion step at the closest call')
    before = page.evaluate('() => __harness.played.finished')
    page.keyboard.press('s')
    page.wait_for_timeout(2600)
    shot(page, 'still_1366_light_showme.png')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
    page.wait_for_timeout(200)
    shot(page, 'still_1366_light_showme_end.png')
    pl = page.evaluate('() => __harness.played')
    out['showme'] = {'planned': round(pl['plannedMs'] / 1000, 2), 'wall': round(pl['ms'] / 1000, 2)}
    # Pause, step and replay, then the run still ends.
    page.keyboard.press('s')
    page.wait_for_function(STATE, arg='showme', timeout=5000)
    page.keyboard.press('Space')
    page.wait_for_timeout(500)
    paused = page.locator('.hx-player-buttons .px-btn').first.inner_text()
    C.ok('Resume' in paused, f'Space pauses show me ({paused!r})')
    page.keyboard.press('ArrowRight')
    page.keyboard.press('r')
    page.wait_for_function(STATE, arg='reveal', timeout=60000)
    C.ok(True, 'pause, step and replay, then show me ends')
    # Reduced motion: the same show me in fewer, shorter keyframes.
    page.goto(file_url('tests/dev/harness.html', ex='track', seed=5, v='still', p='speed:10,targets:1,spheres:1,time:0', rm=1, fast=1))
    start(page, page)
    page.wait_for_function(RESPOND, timeout=30000)
    note(page, 'reduced motion', True)
    answer_keyboard(page, page, 'reduced motion', right=False)
    page.evaluate('() => { __harness.config.fast = false; }')
    before = page.evaluate('() => __harness.played.finished')
    page.keyboard.press('s')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=60000)
    rm = page.evaluate('() => __harness.played')
    out['showme_rm'] = {'planned': round(rm['plannedMs'] / 1000, 2), 'wall': round(rm['ms'] / 1000, 2)}
    C.ok(rm['plannedMs'] < pl['plannedMs'], f'reduced motion makes show me shorter ({out["showme_rm"]} vs {out["showme"]})')
    # The orbit variant at its own speed: the view turns during the motion.
    cue, motion = timed_trial(page, file_url('tests/dev/harness.html', ex='track', seed=8, v='orbit', p='speed:14,targets:1,spheres:1,time:0'),
                              'orbit', 'orbit_1366_light_cue.png', 'orbit_1366_light_motion.png')
    out['orbit'] = {'cue': round(cue, 2), 'motion': round(motion, 2)}
    cam = page.evaluate('() => __harness.item.cam')
    C.ok(cam['dir'] in (1, -1) and cam['rate'] == 6, f'the orbit item turns the camera at 6°/s ({cam})')
    ctx.close()
    return out


def stalled_trial(page, url, ms):
    """A trial with a main-thread block of `ms` during the motion; returns the view's verdict."""
    page.goto(url)
    page.wait_for_function(PHASE, arg='notice', timeout=30000)
    page.evaluate("() => { window.__voids = []; PX.bus.on('trial:void', (e) => __voids.push(e)); }")
    start(page, page)
    page.wait_for_function(PHASE, arg='track', timeout=15000)
    page.wait_for_timeout(600)
    page.evaluate('(ms) => { const t = performance.now(); while (performance.now() - t < ms) {} }', ms)
    page.wait_for_function(RESPOND, timeout=60000)
    return page.evaluate(f'() => {V}.trialInfo()'), page.evaluate('() => window.__voids')


def void_trials(b, cons):
    """Track's rule: a jump of more than min(3r, 0.75 d_min) in one frame voids; a slow frame
    without one does not, and late frames alone never void."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    jmax = min(3 * 0.055, 0.75 * 0.182)  # 8 spheres (spheres:1): d_min 0.182, so 0.1365 cube widths
    # 0.84 cw/s and a 400 ms block: the spheres would jump about 0.25–0.34 cube widths.
    fast_url = file_url('tests/dev/harness.html', ex='track', seed=31, v='still', p='speed:30,targets:1,spheres:1,time:0')
    info, voids = stalled_trial(page, fast_url, 400)
    j = info['judge'] or {}
    C.ok(abs(j.get('limit', 0) - jmax) < 1e-9, f'the jump limit is min(3r, 0.75 d_min) for 8 spheres ({j.get("limit")} vs {jmax:.4f})')
    C.ok(info['void'] and info['void']['reason'] == 'jump' and j.get('jump', 0) > jmax,
         f'a stall at 0.84 cw/s voids the trial as a jump ({info["void"] and info["void"]["reason"]}, jump {round(j.get("jump", 0), 3)} cw > {jmax:.4f}, gap {round(info["frames"]["maxGapMs"])} ms)')
    C.ok(any(v['reason'] == 'jump' and v['ex'] == 'track' for v in voids), f"PX.bus 'trial:void' reports it ({[v['reason'] for v in voids]})")
    txt = page.locator('.ex-track-void').inner_text() if page.locator('.ex-track-void').is_visible() else ''
    C.ok('does not count' in txt and 'jumped' in txt, f'the stage says the trial does not count and why ({txt!r})')
    shot(page, 'still_1366_light_void.png')
    answer_keyboard(page, page, 'jump-voided trial', right=True)
    last = page.evaluate('() => __harness.last')
    C.ok(last['void'] is True and last['voidReason'] == 'jump', f'the harness marks it void ({last["void"]}, {last["voidReason"]})')
    # 0.15 cw/s and a 250 ms block: at most a 0.04 cw jump, so the trial counts, however many
    # frames came late (their share is logged with the response).
    slow_url = file_url('tests/dev/harness.html', ex='track', seed=33, v='still', p='speed:0,targets:1,spheres:1,time:0')
    info, voids = stalled_trial(page, slow_url, 250)
    j = info['judge'] or {}
    reason = info['void'] and info['void']['reason']
    C.ok(j.get('jump', 1) < jmax and reason is None and not voids,
         f'a slow frame at 0.15 cw/s is no jump: the trial counts ({reason}, jump {round(j.get("jump", 0), 3)} cw, late {round(j.get("late", 0), 2)}, generic stutter {info["frames"]["stutter"]})')
    r = answer_keyboard(page, page, 'slow-frame trial', right=True)
    C.ok(r['void'] is False and isinstance((r.get('meta') or {}).get('late'), (int, float)),
         f'it counts in the harness and its late share goes with the response ({r["void"]}, late {(r.get("meta") or {}).get("late")})')
    # Esc during the motion pauses; Resume finishes the trial, which no longer counts.
    page.goto(file_url('tests/dev/harness.html', ex='track', seed=32, v='still', p='speed:10,targets:1,spheres:1,time:0'))
    start(page, page)
    page.wait_for_function(PHASE, arg='track', timeout=15000)
    page.wait_for_timeout(500)
    page.keyboard.press('Escape')
    page.wait_for_function("() => !document.querySelector('.ex-track-paused').hidden", timeout=5000)
    shot(page, 'still_1366_light_paused.png')
    t_paused = page.evaluate(f'() => {V}.phase()')
    page.wait_for_timeout(1200)
    C.ok(t_paused == 'track' and page.evaluate(f'() => {V}.phase()') == 'track', 'the motion holds while paused')
    page.locator('.ex-track-paused .px-btn').click()
    page.wait_for_function(RESPOND, timeout=60000)
    info = page.evaluate(f'() => {V}.trialInfo()')
    C.ok(info['void'] and info['void']['reason'] == 'paused', f'a paused trial is void ({info["void"] and info["void"]["reason"]})')
    ctx.close()


def standard_preset(b, cons):
    """Threshold mode's Standard preset by params (8 spheres, 4 targets, 8 s, still), and continuous
    speeds through the harness (def.extraParams: speedValue via __harness.next and the URL)."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(file_url('tests/dev/harness.html', ex='track', seed=3, v='still', p='speed:12,targets:2,spheres:1,time:1', fast=1))
    start(page, page)
    page.wait_for_function(RESPOND, timeout=30000)
    note(page, 'Standard preset', True)
    it = page.evaluate("() => { const i = __harness.item, S = PX.ex.track.STANDARD; return { n: i.n, k: i.k, dur: i.dur, cue: i.cue, dir: i.cam.dir, same: JSON.stringify(i.params) === JSON.stringify(S.params) }; }")
    C.ok(it == {'n': 8, 'k': 4, 'dur': 8, 'cue': 2, 'dir': 0, 'same': True}, f'the Standard preset by params: 8 spheres, 4 targets, 8 s, 2 s cue, still ({it})')
    answer_keyboard(page, page, 'Standard preset', right=True)
    shot(page, 'standard_1366_light_reveal.png')
    page.evaluate("() => { __harness.next(Object.assign({}, PX.ex.track.STANDARD.params, { speedValue: 0.4321 }), 77); }")
    page.wait_for_function("() => __harness.state === 'respond' && __harness.item.seed === 77", timeout=30000)
    note(page, 'Standard at 0.4321 cw/s', True)
    sv = page.evaluate('() => ({ speed: __harness.item.speed, sv: __harness.item.speedValue, nearest: __harness.item.params.speed === PX.ex.track.nearestLevel(0.4321), inParams: "speedValue" in __harness.item.params })')
    C.ok(sv == {'speed': 0.4321, 'sv': 0.4321, 'nearest': True, 'inParams': False}, f'__harness.next keeps speedValue: the item moves at 0.4321 cw/s, params keep the nearest level ({sv})')
    answer_keyboard(page, page, 'Standard at a continuous speed', right=True)
    page.goto(file_url('tests/dev/harness.html', ex='track', seed=4, v='still', p='speed:12,targets:2,spheres:1,time:1,speedValue:0.37', fast=1))
    start(page, page)
    page.wait_for_function(RESPOND, timeout=30000)
    note(page, 'Standard at 0.37 cw/s (URL)', True)
    sv = page.evaluate('() => __harness.item.speedValue')
    C.ok(sv == 0.37, f'a decimal speedValue in the URL reaches the item ({sv})')
    ctx.close()


def harness_api(b, cons):
    """__harness.answer() on a custom layout, and the demo's hand-back to the answer step."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(file_url('tests/dev/harness.html', ex='track', seed=41, v='still', p=PARAMS, fast=1))
    start(page, page)
    page.wait_for_function(RESPOND, timeout=30000)
    note(page, 'api right', True)
    key = page.evaluate('() => __harness.key')
    res = page.evaluate('() => __harness.answer(true)')
    last = page.evaluate('() => __harness.last')
    C.ok(res['correct'] is True and last['source'] == 'api' and last['response'] == key and last['meta'] == {'input': 'api'},
         f'__harness.answer(true) answers the custom layout with the key ({res["correct"]}, {last["source"]}, {last["response"]} vs {key}, {last["meta"]})')
    err = page.evaluate('() => __harness.answer(true).then(() => "resolved", (e) => e.message)')
    C.ok('not answering now' in err, f'__harness.answer outside the answer step is refused ({err!r})')
    page.evaluate('() => { __harness.next(); }')
    page.wait_for_function(RESPOND, timeout=30000)
    note(page, 'api wrong', True)
    key = page.evaluate('() => __harness.key')
    res = page.evaluate('() => __harness.answer(false)')
    resp = page.evaluate('() => __harness.last.response')
    kinds = page.evaluate("() => Array.from(document.querySelectorAll('.ex-track-mark')).map((m) => m.dataset.kind)")
    C.ok(res['correct'] is False and res['value'] == len(key) - 1 and len(resp) == len(key) and resp == sorted(resp) and len(set(resp) & set(key)) == len(key) - 1,
         f'__harness.answer(false) swaps one target for another sphere ({resp} vs {key}; {res["value"]} found)')
    C.ok(kinds.count('wrong') == 1 and kinds.count('missed') == 1, f'the reveal of an API answer marks the swapped pick and the missed target ({kinds})')
    # The demo run to its end (fast): its item is answerable afterwards.
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n && __harness.state !== "showme"', arg=before, timeout=60000)
    d = page.evaluate(f"() => ({{ state: __harness.state, seed: __harness.item.seed, want: PX.ex.learn('track').demo[0].seed, phase: {V}.phase(), caption: document.querySelector('.hx-caption').textContent }})")
    C.ok(d['state'] == 'respond' and d['seed'] == d['want'] and d['phase'] == 'respond' and len(d['caption']) > 10,
         f'after the demo the harness is back at the answer step on the demo item ({d})')
    note(page, 'demo item', True)
    res = page.evaluate('() => __harness.answer(true)')
    C.ok(res is not None and res['correct'] is True, f'after the demo its item can be answered ({res})')
    # At normal speed, paused: picks and Enter wait while the demo plays; Esc closes it and the
    # answer clock restarts there (held 4 s, then answered at once).
    page.evaluate('() => { PX.debug.fast(false); __harness.demo(); }')
    page.wait_for_function(STATE, arg='showme', timeout=60000)
    page.keyboard.press('Space')  # pause the demo
    for k in ('1', '2', '3', '4', 'Enter'):
        page.keyboard.press(k)
    held = page.evaluate(f'() => ({{ state: __harness.state, picks: {V}.picks(), disabled: document.querySelector(".ex-track-confirm").disabled }})')
    C.ok(held == {'state': 'showme', 'picks': [], 'disabled': True}, f'while the demo plays, number keys, Enter and Confirm wait ({held})')
    page.wait_for_timeout(4000)
    page.keyboard.press('Escape')
    page.wait_for_function(RESPOND, timeout=10000)
    note(page, 'demo item (normal speed)', False)
    r = answer_keyboard(page, page, 'after a closed demo', right=True)
    C.ok(r['rtMs'] < 4000, f'the answer clock restarts when the demo ends ({r["rtMs"]} ms after a 4 s hold)')
    errs = page.evaluate('() => __harness.errors')
    C.ok(not errs, f'harness API: no harness errors ({errs})')
    ctx.close()


def spoken(nums):
    """'2, 4, 5 and 7', as the view lists numbers."""
    nums = [str(n) for n in nums]
    return nums[0] if len(nums) < 2 else ', '.join(nums[:-1]) + ' and ' + nums[-1]


def demo_end(b, cons):
    """The demo ends on the answer, as a right answer does, and holds it ≥ 2 s (normal speed and
    reduced motion); the first pick afterwards starts the answer on a plain stage."""
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    holds = {}
    for tag, extra in (('normal speed', {}), ('reduced motion', {'rm': 1})):
        page.goto(file_url('tests/dev/harness.html', ex='track', seed=51, v='still', p=PARAMS, fast=1, **extra))
        start(page, page)
        page.wait_for_function(RESPOND, timeout=30000)
        note(page, f'before the demo ({tag})', True)
        # The demo item is presented fast (ctx.fast); the demo's steps run at their own speed.
        page.evaluate('() => { __harness.config.fast = false; __harness.demo(); }')
        page.wait_for_function(STATE, arg='showme', timeout=30000)
        note(page, f'demo item ({tag})', True)
        # Step (→) to the last step, which waits paused; Space plays it from its start.
        for _ in range(8):
            if page.evaluate(f'() => {V}.trialInfo().shown'):
                break
            page.keyboard.press('ArrowRight')
        page.evaluate("""() => { window.__hold = { t0: 0, t1: 0 };
            document.addEventListener('keydown', (e) => { if (e.key === ' ' && !__hold.t0) __hold.t0 = performance.now(); }, true);
            __harness.when('respond').then(() => { __hold.t1 = performance.now(); }); }""")
        page.keyboard.press('Space')
        page.wait_for_function(RESPOND, timeout=20000)
        hold = page.evaluate('() => (__hold.t1 - __hold.t0) / 1000')
        planned = page.evaluate('() => __harness.played.plannedMs')
        holds[tag] = {'hold': round(hold, 2), 'planned': round(planned / 1000, 2)}
        C.ok(2.0 <= hold <= 8.0 and planned >= 5000, f'{tag}: the demo ends on the answer and holds it at least 2 s ({hold:.2f} s; the demo plans {planned / 1000:.2f} s)')
        end = page.evaluate(f"""() => ({{ marks: Array.from(document.querySelectorAll('.ex-track-mark')).map((m) => ({{ id: +m.dataset.id, kind: m.dataset.kind,
            badge: (m.querySelector('.ex-track-badge') || {{}}).textContent || '', num: +((m.querySelector('.ex-track-num') || {{}}).textContent || 0) }})),
            key: __harness.key, n: __harness.item.n, info: {V}.trialInfo(), caption: document.querySelector('.hx-caption').textContent }})""")
        key = end['key']
        found = sorted(m['id'] for m in end['marks'] if m['kind'] == 'found' and m['badge'] == '✓' and m['num'] > 0)
        others = [m for m in end['marks'] if m['id'] not in key]
        C.ok(found == sorted(key) and len(end['marks']) == end['n'] and all(m['kind'] == 'label' and not m['badge'] and m['num'] > 0 for m in others)
             and end['info']['coloured'] == len(key) and end['info']['shown'],
             f'{tag}: the demo ends with every target in its colour and marked ✓ with its number, the others numbered ({found} vs {sorted(key)}, coloured {end["info"]["coloured"]})')
        nums = sorted(m['num'] for m in end['marks'] if m['id'] in key)
        C.ok(spoken(nums) in end['caption'], f'{tag}: the caption names the targets by their numbers ({spoken(nums)!r} in {end["caption"]!r})')
        if not extra:
            shot(page, 'still_1366_light_demo_end.png')
        # The first pick clears the answer: the demo item is then answered on a plain stage.
        page.keyboard.press(str(number_of(page, key[0]) % 10))
        after = page.evaluate(f"() => ({{ kinds: Array.from(document.querySelectorAll('.ex-track-mark')).map((m) => m.dataset.kind), info: {V}.trialInfo(), picks: {V}.picks() }})")
        C.ok(after['info']['coloured'] == 0 and not after['info']['shown'] and set(after['kinds']) <= {'pick', 'label'} and after['picks'] == [key[0]],
             f'{tag}: the first pick clears the answer and starts the answer on a plain stage ({after["info"]["coloured"]} coloured, {sorted(set(after["kinds"]))}, picks {after["picks"]})')
        page.keyboard.press('Backspace')
        answer_keyboard(page, page, f'after the demo ({tag})', right=True)
    errs = page.evaluate('() => __harness.errors')
    C.ok(not errs, f'demo end: no harness errors ({errs})')
    ctx.close()
    return holds


def sandboxed(b, cons):
    for variant in ('still', 'orbit'):
        doc = harness_single('track', {'seed': 21, 'v': variant, 'p': PARAMS, 'fast': True})
        host = srcdoc_host(f'harness_track_{variant}', doc)
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
        page = ctx.new_page()
        cons.append(Console(page))
        page.goto(host.as_uri())
        fr = child_frame(page)
        fr.wait_for_function(PHASE, arg='notice', timeout=60000)
        env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
        C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc {variant}: runs in a sandboxed srcdoc frame ({env})')
        fr.locator('.hx-goal').click()  # focus inside the frame, so keys reach it
        start(fr, page)
        fr.wait_for_function(RESPOND, timeout=30000)
        note(fr, f'srcdoc {variant}', True)
        stage_ok(fr, f'srcdoc {variant}')
        answer_keyboard(page, fr, f'srcdoc {variant}', right=True)
        show_me(fr, f'srcdoc {variant}', page=page)
        shot(page, f'{variant}_srcdoc.png')
        errs = fr.evaluate('() => __harness.errors')
        C.ok(not errs, f'srcdoc {variant}: no harness errors ({errs})')
        ctx.close()


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        desktop_and_phone(b, cons)
        times = normal_speed(b, cons)
        void_trials(b, cons)
        standard_preset(b, cons)
        harness_api(b, cons)
        times['demo_end'] = demo_end(b, cons)
        sandboxed(b, cons)
        b.close()
    natural = [t for t in TRIALS]
    voided = [t for t in natural if t['reason']]
    by = {}
    for t in voided:
        by[t['reason']] = by.get(t['reason'], 0) + 1
    generic = sum(1 for t in natural if t['generic'])
    normal = [t for t in natural if not t['fast']]
    late = sum(1 for t in natural if t['late'] > 0.25)
    print(f"Track void rule on this machine: {len(voided)} of {len(natural)} trials voided {by} "
          f"({sum(1 for t in normal if t['reason'])} of {len(normal)} at normal speed); more than 25 % late frames on {late} "
          f"(logged, not voided); the generic stutter flag was set on {generic}", flush=True)
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    warnings = [w for c in cons for w in c.warnings()]
    return C.summary({'seconds': times, 'trials': TRIALS, 'warnings': warnings[:10], 'screenshots': sorted(p.name for p in SHOTS.glob('*.png'))})


if __name__ == '__main__':
    sys.exit(main())
