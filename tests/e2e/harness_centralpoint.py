"""E2E: the dev harness with Central Point (EX-20, SVG board, custom layout, answer type 'point').
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_centralpoint.py   (two browser slots per machine)

1. desktop 1366 x 768, phones 360 x 640 and 412 x 880 (DPR 2, touch), light and dark: the board shows
   49 dots and the targets (non-blank pixels), the plate is square, no horizontal scroll; Confirm and
   the four nudge buttons (exact form) are at least 44 px; on the phones the plate and the controls fit
2. quick form: a tap places the marker on the nearest answer point, a second tap on it answers (right at
   the key); a tap far away and Confirm answers wrong; exact form: the arrow keys move the marker half a
   dot and Enter answers; atDeadline hands in a placed marker
3. reveal: a line and a length label per target, the best answer point ringed and labelled ("you · best"
   when they are one point), totals; the band's other points only with Map, which draws labelled level
   lines (the band bold); nothing marks the average; over 45 reveals at 360 x 640 no two labels overlap,
   and labels on a ring or past the plate stay under 1 % (fresh-player test, 18 Nov)
4. Why? (show me) runs to the end, its last frames balance the pulls (a closed chain at the best spot)
   and it leaves the reveal as it was; step by step: with no answer it starts by counting to the first
   guess, the fan starts outside the marker, the line of pulls is laid before its gap shows, and it ends
   on the best answer point; the Watch demo runs to the end and leaves the item answerable, with no
   average mark left; Try 1's assist draws the kite's two diagonals
5. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard; no console errors
6. the app at 360 x 640: the rules card with pictures, the Watch (each caption tapped on with Next; the
   line of pulls, its gap and the step to the answer point pictured; the average once), the strategy
   card, Try 1 with the diagonals, three Try items answered by taps with a round score in the verdict;
   a quick item in Free play whose deadline passes with the marker placed (a late time-out, a quarter round)
Screenshots: tests/e2e/out/centralpoint/cp_<viewport>_<theme>[_reveal|_map|_exact|_why|_assist].png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_centralpoint')
DIR = OUT / 'centralpoint'
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
M, VBS = 1.3, 14.6


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def pt(target, x, y):
    """Client coordinates of the answer point (x, y) in half-steps."""
    r = target.evaluate("() => { const b = document.querySelector('.ex-cp-board').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; }")
    return r['l'] + (x + M) / VBS * r['w'], r['t'] + (y + M) / VBS * r['h']


def tap(page, touch, x, y):
    cx, cy = pt(page, x, y)
    if touch:
        page.touchscreen.tap(cx, cy)
    else:
        page.mouse.click(cx, cy)


def marker(target):
    return target.evaluate("() => PX.ex.view('centralpoint').marker()")


def far_point(key):
    return {'x': 12 if key['x'] < 6 else 0, 'y': 12 if key['y'] < 6 else 0}


def layout_ok(page, tag, phone):
    m = page.evaluate("""() => {
        const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, b: r.bottom, r: r.right, l: r.left, t: r.top, shown: !!(e.offsetWidth || e.offsetHeight) }; };
        return { stage: q('.ex-cp-stage'), confirm: q('.ex-cp-confirm'), nudges: Array.from(document.querySelectorAll('.ex-cp-nudge')).map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, shown: !!(b.offsetWidth || b.offsetHeight) }; }),
          dots: document.querySelectorAll('.ex-cp-dot').length, targets: document.querySelectorAll('.ex-cp-targets .ex-cp-target').length, k: __harness.item.targets.length,
          scrollX: document.documentElement.scrollWidth > window.innerWidth + 1, vw: window.innerWidth, vh: window.innerHeight };
    }""")
    C.ok(m['dots'] == 49 and m['targets'] == m['k'], f"{tag}: 49 dots and {m['k']} targets drawn ({m['dots']}, {m['targets']})")
    C.ok(abs(m['stage']['w'] - m['stage']['h']) <= 1.5, f"{tag}: the plate is square ({m['stage']['w']:.0f} x {m['stage']['h']:.0f})")
    C.ok(not m['scrollX'], f'{tag}: no horizontal scroll')
    C.ok(m['confirm']['h'] >= 44 and m['confirm']['w'] >= 44, f"{tag}: Confirm is at least 44 px ({m['confirm']['w']:.0f} x {m['confirm']['h']:.0f})")
    shown = [n for n in m['nudges'] if n['shown']]
    if shown:
        C.ok(len(shown) == 4 and all(n['w'] >= 44 and n['h'] >= 44 for n in shown), f'{tag}: four nudge buttons of at least 44 px ({shown})')
    if phone:
        dot = m['stage']['w'] / VBS * 2
        C.ok(dot >= 44, f'{tag}: a dot spacing of at least 44 px ({dot:.1f})')
    ok, s = non_blank(page.locator('.ex-cp-stage').screenshot(), min_distinct=4, max_top=0.99)
    C.ok(ok, f'{tag}: the board shows ({s})')
    return m


def reveal_ok(page, tag, k):
    r = page.evaluate("""() => ({ lines: document.querySelectorAll('.ex-cp-lines line').length, lens: document.querySelectorAll('.ex-cp-labels .ex-cp-len').length,
        best: document.querySelectorAll('.ex-cp-bestring').length, bestLabel: (document.querySelector('.ex-cp-bestlabel') || {}).textContent || '',
        totals: (document.querySelector('.ex-cp-totals') || {}).textContent || '', note: (document.querySelector('.ex-cp-note') || {}).textContent || '',
        avg: document.querySelectorAll('.ex-cp-avgmark, .ex-cp-avgline, .ex-cp-avglabel').length, result: !document.querySelector('.ex-cp-result').hidden,
        bandPts: document.querySelectorAll('.ex-cp-band .ex-cp-bandpt').length })""")
    C.ok(r['lines'] >= k - 1 and r['lens'] == r['lines'], f"{tag}: a line and a length label per target ({r['lines']} lines, {r['lens']} labels)")
    C.ok(r['best'] == 1 and r['bestLabel'] in ('best', 'you · best'), f"{tag}: the best answer point ringed and labelled ({r['bestLabel']!r}; one label when your spot is the best)")
    C.ok(r['bandPts'] == 0, f"{tag}: the band's other answer points wait for the map ({r['bandPts']})")
    C.ok(len(r['totals']) > 8 and r['result'], f"{tag}: totals shown ({r['totals']!r}; {r['note']!r})")
    C.ok(r['avg'] == 0, f'{tag}: nothing marks the average position')
    return r


WHY_STEPS = """async (resp) => {
    const v = PX.ex.view('centralpoint'), out = [];
    const where = () => { const m = document.querySelector('.ex-cp-marker .ex-cp-mark'); if (!m) return null;
      const t = /translate\\(([-\\d.e]+)[ ,]+([-\\d.e]+)\\)/.exec(m.getAttribute('transform') || ''); return t ? [+t[1], +t[2]] : null; };
    const fan = () => Array.from(document.querySelectorAll('.ex-cp-over .ex-cp-pull')).map((a) => { const d = /^M([-\\d.e]+) ([-\\d.e]+)/.exec(a.getAttribute('d') || ''); return d ? [+d[1], +d[2]] : null; });
    await v.showMe(__harness.item, resp, { play: (steps) => { steps.forEach((s) => {
      if (s.enter) s.enter(); if (s.update) s.update(1);
      out.push({ cap: s.caption || '', count: document.querySelectorAll('.ex-cp-over .ex-cp-countline').length, at: where(), starts: fan(),
        leftover: document.querySelectorAll('.ex-cp-over .ex-cp-leftover').length, closed: document.querySelectorAll('.ex-cp-over .ex-cp-closed').length });
      if (s.exit) s.exit(); }); return Promise.resolve(); } });
    return out; }"""


def median(v):
    s = sorted(v)
    n = len(s)
    return s[(n - 1) // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def why_steps_ok(page, tag):
    """Why? step by step (a recording runner): with no answer it starts from the counted first guess, the
    fan starts outside the marker, the line of pulls is laid before its gap shows, and it ends on the key."""
    item = page.evaluate('() => __harness.item')
    T, key = item['targets'], item['key']
    c = [median([t[0] for t in T]), median([t[1] for t in T])]
    for resp in (None, page.evaluate('() => __harness.last.response')):
        st = page.evaluate(WHY_STEPS, resp)
        start = c if resp is None else [resp['x'], resp['y']]
        first = st[0]
        if resp is None:
            C.ok(first['count'] == 2 and first['at'] == start and 'first guess' in first['cap'], f'{tag}: Why? with no answer starts by counting to the first guess {start} ({first})')
        fan = next((x for x in st if x['starts'] and x['leftover'] == 0 and x['count'] == 0), None)
        d = min(((p[0] - start[0]) ** 2 + (p[1] - start[1]) ** 2) ** 0.5 for p in fan['starts']) if fan else 0
        C.ok(fan is not None and d >= 0.6, f'{tag}: the fan of pulls starts outside the marker ({d:.2f} half-steps)')
        laid = [i for i, x in enumerate(st) if x['cap'].startswith('Line the pulls')]
        C.ok(len(laid) == 1 and st[laid[0]]['leftover'] == 0 and st[laid[0]]['closed'] == 0, f'{tag}: the pulls are laid end to end before any gap shows')
        gap = [i for i, x in enumerate(st) if x['leftover'] or x['closed']]
        C.ok(gap and gap[0] > laid[0], f'{tag}: the gap (or the closed line) comes after the line is laid')
        between = abs(item['gm'][0] - key['x']) + abs(item['gm'][1] - key['y']) > 0.08
        C.ok(st[-1]['at'] == [key['x'], key['y']] if between else True, f"{tag}: Why? ends on the best answer point beside the balance point ({st[-1]['at']} vs {key}; {st[-1]['cap'][:40]!r})")


def run_viewport(b, name, vp, touch, themes):
    for theme in themes:
        ctx = b.new_context(viewport=vp, device_scale_factor=2 if touch else 1, has_touch=touch, is_mobile=touch)
        page = ctx.new_page()
        con = Console(page)
        page.goto(file_url('tests/dev/harness.html', ex='centralpoint', seed=11, p='targets:2,band:0', v='quick', fast=1, theme=theme))
        page.wait_for_function(READY, timeout=20000)
        tag = f'{name} {theme}'
        layout_ok(page, tag + ' quick', touch)
        shot(page, f'cp_{name}_{theme}.png')
        key = page.evaluate('() => __harness.key')
        tap(page, touch, key['x'], key['y'])
        C.ok(marker(page) == key, f'{tag}: a tap places the marker on the nearest answer point ({marker(page)} vs {key})')
        tap(page, touch, key['x'] + 0.4, key['y'] - 0.3)
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        last = page.evaluate('() => __harness.last.result')
        C.ok(last['correct'] is True, f'{tag}: a second tap on the marker answers, right at the key ({last.get("value")} %)')
        reveal_ok(page, tag + ' reveal', len(page.evaluate('() => __harness.item.targets')))
        shot(page, f'cp_{name}_{theme}_reveal.png')
        page.locator('.ex-cp-mapbtn').click()
        mp = page.evaluate("() => ({ n: document.querySelectorAll('.ex-cp-map path').length, band: document.querySelectorAll('.ex-cp-map path.is-band').length, labels: Array.from(document.querySelectorAll('.ex-cp-maplabel')).map((t) => t.textContent) })")
        C.ok(mp['n'] >= 3 and mp['band'] == 1 and 'band' in mp['labels'], f'{tag}: Map draws labelled level lines with the band bold ({mp})')
        shot(page, f'cp_{name}_{theme}_map.png')
        if theme == themes[0]:
            why_steps_ok(page, tag)
        # Why? (show me): fast mode runs it in a few frames
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => __harness.showMe()')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=20000)
        after = page.evaluate("() => ({ over: document.querySelectorAll('.ex-cp-over > *').length, why: document.querySelector('.ex-cp').classList.contains('is-why'), lines: document.querySelectorAll('.ex-cp-lines line').length })")
        C.ok(after['over'] == 0 and not after['why'] and after['lines'] >= 3, f'{tag}: Why? runs to the end and leaves the reveal as it was ({after})')
        # the exact form: keys
        page.evaluate("() => __harness.next({ variant: 'exact', targets: 0, band: 2 }, 23)")
        page.wait_for_function(READY, timeout=20000)
        layout_ok(page, tag + ' exact', touch)
        k2 = page.evaluate('() => __harness.key')
        page.keyboard.press('ArrowLeft')
        m0 = marker(page)
        C.ok(m0 == {'x': 6, 'y': 6}, f'{tag}: the first arrow key puts the marker in the middle ({m0})')
        for _ in range(abs(k2['x'] - 6)):
            page.keyboard.press('ArrowRight' if k2['x'] > 6 else 'ArrowLeft')
        for _ in range(abs(k2['y'] - 6)):
            page.keyboard.press('ArrowDown' if k2['y'] > 6 else 'ArrowUp')
        C.ok(marker(page) == k2, f'{tag}: arrow keys move the marker half a dot at a time ({marker(page)} vs {k2})')
        shot(page, f'cp_{name}_{theme}_exact.png')
        page.keyboard.press('Enter')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        C.ok(page.evaluate('() => __harness.last.result.correct') is True, f'{tag}: Enter answers (exact, right at the key)')
        # a wrong answer by a tap far away and Confirm
        page.evaluate("() => __harness.next({ variant: 'exact', targets: 3, band: 1 }, 31)")
        page.wait_for_function(READY, timeout=20000)
        k3 = page.evaluate('() => __harness.key')
        fp = far_point(k3)
        tap(page, touch, fp['x'], fp['y'])
        page.locator('.ex-cp-confirm').click()
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        res = page.evaluate('() => __harness.last.result')
        C.ok(res['correct'] is False and res['detail']['credit'] < 1, f'{tag}: a far tap and Confirm answer wrong ({res["value"]} %)')
        C.ok('farther' in page.evaluate("() => document.querySelector('.ex-cp-note').textContent"), f'{tag}: the note says how much farther')
        if name == '360x640' or name == 'desktop':
            # Try 1's assist: the kite's diagonals
            page.evaluate("() => { __harness.setAssist('diagonals'); return __harness.next({ variant: 'quick', targets: 0, band: 0, task: 'kite' }, 2); }")
            page.wait_for_function(READY, timeout=20000)
            C.ok(page.evaluate("() => document.querySelectorAll('.ex-cp-assist line').length") == 2, f'{tag}: Try 1 draws the two diagonals of the kite')
            shot(page, f'cp_{name}_{theme}_assist.png')
            page.evaluate("() => __harness.setAssist(null)")
            # atDeadline hands in the placed marker
            kk = page.evaluate('() => __harness.key')
            tap(page, touch, kk['x'], kk['y'])
            got = page.evaluate("() => PX.ex.view('centralpoint').atDeadline(__harness.item)")
            C.ok(got == kk, f'{tag}: atDeadline hands in the placed marker ({got})')
            # the Watch: plays to the end, leaves the item answerable without a marker or an average mark
            page.evaluate("() => __harness.next({ variant: 'quick', targets: 0, band: 0, task: 'watch' }, 261)")
            page.wait_for_function(READY, timeout=20000)
            d0 = page.evaluate('() => __harness.played.finished')
            page.evaluate('() => __harness.demo()')
            page.wait_for_function('(n) => __harness.played.finished > n', arg=d0, timeout=30000)
            page.wait_for_function(READY, timeout=10000)
            w = page.evaluate("() => ({ avg: document.querySelectorAll('.ex-cp-avgmark, .ex-cp-avgline').length, over: document.querySelectorAll('.ex-cp-over > *').length, marker: PX.ex.view('centralpoint').marker() })")
            C.ok(w['avg'] == 0 and w['over'] == 0 and w['marker'] is None, f'{tag}: the Watch ends clean: answerable, no marker, no average mark ({w})')
            kw = page.evaluate('() => __harness.key')
            tap(page, touch, kw['x'], kw['y'])
            tap(page, touch, kw['x'], kw['y'])
            page.wait_for_function(STATE, arg='reveal', timeout=10000)
            C.ok(page.evaluate('() => __harness.last.result.correct') is True, f'{tag}: the Watch item can be answered after the demo')
        errs = con.errors()
        C.ok(not errs, f'{tag}: no console errors ({errs[:3]})')
        ctx.close()


LABELS = """() => {
  const svg = document.querySelector('.ex-cp-board').getBoundingClientRect(), s = 1.5;
  const labs = Array.from(document.querySelectorAll('.ex-cp-labels text')).filter((t) => getComputedStyle(t).display !== 'none').map((t) => { const r = t.getBoundingClientRect(); return { x0: r.left, x1: r.right, y0: r.top, y1: r.bottom, s: t.textContent }; });
  const rings = Array.from(document.querySelectorAll('.ex-cp-targets .ex-cp-ring, .ex-cp-bestring, .ex-cp-marker .ex-cp-disc')).map((c) => { const r = c.getBoundingClientRect(); return { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, r: r.width / 2 }; });
  let ll = 0, lr = 0, out = 0;
  labs.forEach((a, i) => {
    if (a.x0 < svg.left - 0.5 || a.x1 > svg.right + 0.5 || a.y0 < svg.top - 0.5 || a.y1 > svg.bottom + 0.5) out++;
    labs.slice(i + 1).forEach((b) => { if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > s && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > s) ll++; });
    rings.forEach((c) => { const dx = Math.max(a.x0 + s - c.cx, 0, c.cx - (a.x1 - s)), dy = Math.max(a.y0 + s - c.cy, 0, c.cy - (a.y1 - s)); if (dx * dx + dy * dy < c.r * c.r) lr++; });
  });
  return { n: labs.length, ll, lr, out };
}"""


def run_labels(b):
    """45 reveals at 360 x 640 over all 15 rated cells, answered at the key, beside it and anywhere:
    no label covers another; labels on a ring or past the plate stay rare (a crowded corner)."""
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    page.goto(file_url('tests/dev/harness.html', ex='centralpoint', seed=11, p='targets:2,band:0', v='quick', fast=1, theme='light'))
    page.wait_for_function(READY, timeout=20000)
    tot = {'n': 0, 'll': 0, 'lr': 0, 'out': 0}
    for i in range(45):
        page.evaluate('([p, s]) => __harness.next(p, s)', [{'variant': 'quick', 'targets': i % 5, 'band': (i // 5) % 3}, 900 + i])
        page.wait_for_function(READY, timeout=20000)
        k = page.evaluate('() => __harness.key')
        x, y = [(k['x'], k['y']), ((k['x'] + 1) % 13, k['y']), ((i * 5) % 13, (i * 7) % 13)][i % 3]
        tap(page, True, x, y)
        tap(page, True, x, y)
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        m = page.evaluate(LABELS)
        for key in tot:
            tot[key] += m[key]
    C.ok(tot['ll'] == 0, f"360x640 labels: no label covers another over 45 reveals ({tot})")
    C.ok(tot['lr'] + tot['out'] <= max(1, tot['n'] // 100), f"360x640 labels: on a ring or past the plate at most 1 % ({tot['lr'] + tot['out']} of {tot['n']})")
    C.ok(not con.errors(), f'360x640 labels: no console errors ({con.errors()[:3]})')
    ctx.close()


def run_slow_why(b):
    """Why? at normal speed on a phone: sample its frames for a closed chain, take a picture mid-way."""
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    con = Console(page)
    page.goto(file_url('tests/dev/harness.html', ex='centralpoint', seed=5, p='targets:1,band:0', v='quick', theme='light'))
    page.wait_for_function(READY, timeout=20000)
    k = page.evaluate('() => __harness.key')
    tap(page, True, 0 if k['x'] > 6 else 12, k['y'])
    page.locator('.ex-cp-confirm').tap()
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.showMe(); }')  # not awaited: the frames are sampled while it plays
    seen = {'pull': 0, 'leftover': 0, 'closed': 0}
    took = False
    for i in range(80):
        page.wait_for_timeout(200)
        s = page.evaluate("() => ({ pull: document.querySelectorAll('.ex-cp-pull').length, leftover: document.querySelectorAll('.ex-cp-leftover').length, closed: document.querySelectorAll('.ex-cp-closed').length, done: __harness.played.finished })")
        for key in seen:
            seen[key] = max(seen[key], s[key])
        if s['leftover'] and not took and i > 8:
            shot(page, 'cp_360x640_why.png')
            took = True
        if s['done'] > before:
            break
    C.ok(seen['pull'] >= 3 and seen['leftover'] >= 1 and seen['closed'] >= 1, f'360x640 Why?: equal pulls, a leftover pull, then a closed chain at the best spot ({seen})')
    C.ok(not con.errors(), f'360x640 Why?: no console errors ({con.errors()[:3]})')
    ctx.close()


def card(page, box, value, timeout=20000):
    sel = f'[data-card-box="{box}"] [data-card="{value}"]'
    page.wait_for_selector(sel, state='visible', timeout=timeout)
    return sel


def in_view(page, sel):
    return page.evaluate("""(s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, ok: r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5 }; }""", sel)


def run_app_wtg(b):
    """The real player at 360 x 640 (touch): the rules card with its pictures, the Watch at normal speed (the
    caption on screen, the average shown once), Your turn, the strategy card, Try 1 with the kite's diagonals,
    Try 2 and 3 answered by taps, then Go; the verdict carries the round score; the page never scrolls."""
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    con = Console(page)
    page.goto(file_url('index.html'))
    page.wait_for_function('document.documentElement.getAttribute("data-px-ready") === "1"', timeout=30000)
    for _ in range(4):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
    page.evaluate("""() => { const r = PX.core.store.state; r.tour = r.tour || { seen: {} }; r.tour.seen = r.tour.seen || {};
        PX.ex.list().forEach(d => { r.tour.seen[d.id] = true; }); r.tour.seen.centralpoint = false; r.ui = r.ui || {}; r.ui.seen = r.ui.seen || {}; }""")
    page.evaluate('void PX.core.router.go("play", { mode: "watch", exId: "centralpoint" }, { force: true })')
    sel = card(page, 'wtg-rules', 'watch')
    rules = page.evaluate("() => ({ n: document.querySelectorAll('.pl-rule').length, figs: document.querySelectorAll('.pl-rule .ex-cp-rulefig').length })")
    C.ok(rules['n'] == 4 and rules['figs'] == 4, f'app 360x640: the rules card shows four rules, each with its picture ({rules})')
    shot(page, 'app_360_rules.png')
    page.locator(sel).click()
    page.wait_for_function("() => window.__play && __play.state === 'showme'", timeout=20000)
    # each Watch caption waits for Next (tap mode): tap it once the caption's steps have played, and keep
    # pictures of the line laid end to end, the gap, and the step to the answer point
    saw_avg, caps, taken = False, set(), set()
    pics = (('Line the pulls', 'app_360_watch_line.png'), ('They do not come back', 'app_360_watch_gap.png'), ('Answers sit on dots', 'app_360_watch_snap.png'))
    for _ in range(400):
        s = page.evaluate("""() => ({ st: __play.state, cap: (document.querySelector('.pl-caption') || {}).textContent || '',
            avg: document.querySelectorAll('.ex-cp-avgmark').length, turn: ((document.querySelector('.pl-wtg-text') || {}).textContent || '').startsWith('Your turn'),
            waiting: !!document.querySelector('[data-showme-next].is-waiting:not([hidden])') })""")
        if s['cap']:
            caps.add(s['cap'][:40])
        if s['avg'] and not saw_avg:
            saw_avg = True
            page.wait_for_timeout(700)
            shot(page, 'app_360_watch_average.png')
        if s['st'] == 'respond' and s['turn']:
            break
        if s['waiting']:
            for pre, name in pics:
                if s['cap'].startswith(pre) and name not in taken:
                    taken.add(name)
                    shot(page, name)
            page.locator('[data-showme-next]').click()
            page.wait_for_timeout(120)
            continue
        page.wait_for_timeout(150)
    C.ok(len(taken) == 3, f'app 360x640: the Watch lays the pulls end to end, shows the gap, then steps to the answer point ({sorted(taken)})')
    C.ok(len(caps) >= 7, f'app 360x640: the Watch shows its captions one by one ({len(caps)} seen)')
    C.ok(saw_avg, 'app 360x640: the Watch shows the average position once (its declared exception)')
    st = page.evaluate("() => ({ st: __play.state, avg: document.querySelectorAll('.ex-cp-avgmark').length, marker: PX.ex.view('centralpoint').marker() })")
    C.ok(st['st'] == 'respond' and st['avg'] == 0 and st['marker'] is None, f'app 360x640: after the Watch the item is answerable and clean ({st})')
    k = page.evaluate('() => __play.key')
    tap(page, True, k['x'], k['y'])
    tap(page, True, k['x'], k['y'])
    page.wait_for_function("() => __play.state === 'reveal'", timeout=10000)
    page.evaluate('() => __play.next()')
    sel = card(page, 'wtg-strategy', 'try')
    title = page.evaluate("() => (document.querySelector('[data-card-box=\"wtg-strategy\"] h2, [data-card-box=\"wtg-strategy\"] h3') || {}).textContent || ''")
    C.ok('First count, then balance' in title, f'app 360x640: the strategy card before Try 1 is "First count, then balance" ({title!r})')
    shot(page, 'app_360_strategy.png')
    page.locator(sel).click()
    page.wait_for_function("() => __play.state === 'respond'", timeout=20000)
    diag = page.evaluate("() => ({ task: __play.item.task, lines: document.querySelectorAll('.ex-cp-assist line').length })")
    C.ok(diag == {'task': 'kite', 'lines': 2}, f'app 360x640: Try 1 is the kite with its two diagonals drawn ({diag})')
    fit = page.evaluate("""() => { const ids = ['.ex-cp-stage', '.ex-cp-confirm']; return { rows: ids.map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [s, Math.round(r.top), Math.round(r.bottom)]; }),
        h: window.innerHeight, scroll: document.documentElement.scrollHeight - window.innerHeight }; }""")
    C.ok(all(r[1] >= -1 and r[2] <= fit['h'] + 1 for r in fit['rows']), f'app 360x640: Try 1 shows the plate and Confirm on the screen ({fit})')
    shot(page, 'app_360_try1.png')
    for i in range(3):
        k = page.evaluate('() => __play.key')
        tap(page, True, k['x'], k['y'])
        tap(page, True, k['x'], k['y'])
        page.wait_for_function("() => __play.state === 'reveal'", timeout=10000)
        v = page.evaluate("() => ({ right: __play.last.result.correct, round: __play.last.result.round, verdict: (document.querySelector('.pl-verdict') || {}).textContent || '' })")
        C.ok(v['right'] is True and isinstance(v['round'], int) and 'Round score' in v['verdict'], f'app 360x640: Try {i + 1} answered by two taps, with a round score in the verdict ({v})')
        if i == 0:
            shot(page, 'app_360_try1_reveal.png')
        page.evaluate('() => __play.next()')
        page.wait_for_timeout(300)
        if i < 2:
            page.wait_for_function("() => __play.state === 'respond'", timeout=20000)
    C.ok(not con.errors(), f'app 360x640: no console errors ({con.errors()[:3]})')
    ctx.close()


def run_app_deadline(b):
    """Free play in the real player with the Quick deadline cut to its minimum: the countdown bar runs; a
    marker left unconfirmed is handed in at the deadline (a time-out for the rating, late: true), earns a
    quarter of its closeness as round score, and the note says time ran out."""
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    con = Console(page)
    page.goto(file_url('index.html'))
    page.wait_for_function('document.documentElement.getAttribute("data-px-ready") === "1"', timeout=30000)
    for _ in range(4):
        if not page.evaluate('PX.ui.modalOpen()'):
            break
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
    page.evaluate("""() => { const r = PX.core.store.state; r.tour = r.tour || { seen: {} }; r.tour.seen = r.tour.seen || {};
        PX.ex.list().forEach(d => { r.tour.seen[d.id] = true; }); r.ex = r.ex || {}; r.ex.centralpoint = r.ex.centralpoint || {};
        r.ex.centralpoint.pace = { ms: PX.ex.get('centralpoint').pace.minMs, n: 0 }; }""")
    page.evaluate("""void PX.core.router.go('play', { mode: 'free', exId: 'centralpoint', run: '1', trials: 3, params: { variant: 'quick', targets: 1, band: 0 } }, { force: true })""")
    for _ in range(200):
        if page.evaluate("() => window.__play && __play.state === 'respond'"):
            break
        for sel in ('[data-card-box] [data-card="skip"]', '[data-card-box] .px-btn--primary'):
            loc = page.locator(sel)
            if loc.count() and loc.first.is_visible():
                loc.first.click()
                page.wait_for_timeout(150)
        page.wait_for_timeout(100)
    bar = page.evaluate("() => { const e = document.querySelector('.pl-limit'); return !!e && e.offsetHeight > 0 && e.classList.contains('is-running'); }")
    C.ok(bar, 'app deadline: the countdown bar runs on a quick item')
    k = page.evaluate('() => __play.key')
    tap(page, True, k['x'] + 1 if k['x'] < 12 else k['x'] - 1, k['y'])
    # after a miss the player plays Why? at once, so the state may already be 'showme'
    page.wait_for_function("() => ['reveal', 'showme'].includes(__play.state) && !!__play.last", timeout=15000)
    r = page.evaluate("""() => ({ timeout: __play.last.timeout, late: __play.last.result.late, correct: __play.last.result.correct, credit: __play.last.result.credit,
        round: __play.last.result.round, note: (document.querySelector('.ex-cp-note') || {}).textContent || '', marker: document.querySelectorAll('.ex-cp-marker .ex-cp-mark').length })""")
    want = round(100 * r['credit'] * 0.25) if isinstance(r.get('credit'), (int, float)) else None
    C.ok(r['timeout'] is True and r['late'] is True and r['correct'] is False and r['marker'] == 1, f'app deadline: the placed marker is handed in at the deadline as a time-out ({r})')
    C.ok(r['round'] == want and 'Time ran out' in r['note'], f'app deadline: a quarter of its closeness as round score ({r["round"]} vs {want}) and the note says so')
    shot(page, 'app_360_deadline.png')
    C.ok(not con.errors(), f'app deadline: no console errors ({con.errors()[:3]})')
    ctx.close()


def run_srcdoc(b):
    page = b.new_page(viewport={'width': 900, 'height': 900})
    con = Console(page)
    host = srcdoc_host('harness_centralpoint', harness_single('centralpoint', {'seed': 7, 'p': {'targets': 1, 'band': 0}, 'v': 'exact', 'fast': True}))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=20000)
    k = fr.evaluate('() => __harness.key')
    page.locator('iframe').focus()
    page.keyboard.press('ArrowUp')
    for _ in range(abs(k['x'] - 6)):
        page.keyboard.press('ArrowRight' if k['x'] > 6 else 'ArrowLeft')
    for _ in range(abs(k['y'] - 6)):
        page.keyboard.press('ArrowDown' if k['y'] > 6 else 'ArrowUp')
    page.keyboard.press('Enter')
    fr.wait_for_function(STATE, arg='reveal', timeout=10000)
    C.ok(fr.evaluate('() => __harness.last.result.correct') is True, 'srcdoc: renders and plays by keyboard (right at the key)')
    C.ok(not con.errors(), f'srcdoc: no console errors ({con.errors()[:3]})')
    page.close()


with sync_playwright() as p:
    b = launch(p)
    run_viewport(b, 'desktop', {'width': 1366, 'height': 768}, False, ['light', 'dark'])
    run_viewport(b, '360x640', {'width': 360, 'height': 640}, True, ['light', 'dark'])
    run_viewport(b, '412x880', {'width': 412, 'height': 880}, True, ['light'])
    run_labels(b)
    run_slow_why(b)
    run_app_wtg(b)
    run_app_deadline(b)
    run_srcdoc(b)
    b.close()
sys.exit(C.summary())
