"""E2E: the dev harness with Mechanisms (PR-3).
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_mechanisms.py   (two browser slots per machine)

1. desktop 1366 × 768 and phone 412 × 880 (DPR 2, touch), light and dark, each question type and a
   jam: the drawing has non-blank pixels, every gear has teeth, meshing teeth interleave at every
   contact point (loop-closing meshes excepted), the DRIVER and MARKED labels are there and cover
   no mesh contact point; a right answer by keyboard and a wrong one by pointer (tap on the phone)
   score as expected; show me runs to the end; the time limit runs as a bar; no horizontal scroll
2. show me at normal speed: every step ≤ 4 s, shorter with reduced motion; pause, step, replay
3. the worked example (learn.demo) plays to the end with captions
4. the harness inlined into a sandboxed srcdoc iframe renders and plays by keyboard
5. no console errors anywhere
Screenshots: tests/e2e/out/mechanisms/<name>.png """
import sys

from playwright.sync_api import sync_playwright

from common import OUT, Checks, Console, child_frame, file_url, harness_single, launch, non_blank, srcdoc_host

C = Checks('harness_mechanisms')
EX = 'mechanisms'
DIR = OUT / EX
DIR.mkdir(parents=True, exist_ok=True)
READY = "() => window.__harness && __harness.state === 'respond'"
STATE = "(s) => window.__harness && __harness.state === s"
LEVELS = [('chain_dir', 'gears:0,structure:0,question:0', 3), ('branches_lift', 'gears:1,structure:1,question:1', 11),
          ('belts_speed', 'gears:2,structure:2,question:2', 4), ('jams_dir', 'gears:3,structure:3,question:0', 12)]

# Teeth interleave: tooth phase u (0 = tooth centre facing the other gear) of A and B sum to 1/2;
# labels never cover a mesh contact point.
GEOMETRY = """() => {
  const v = PX.ex.view('mechanisms'), m = v.model(), it = __harness.item, TAU = 2 * Math.PI;
  const frac = (x) => ((x % 1) + 1) % 1;
  let off = 0, n = 0;
  const contacts = [];
  for (const [a, b] of m.res.meshes) {
    const A = m.wheels[a], B = m.wheels[b], ca = m.axles[A.axle], cb = m.axles[B.axle];
    const th = Math.atan2(cb.y - ca.y, cb.x - ca.x);
    const ua = frac((th - m.phase[a]) / (TAU / A.teeth)), ub = frac((th + Math.PI - m.phase[b]) / (TAU / B.teeth));
    const err = Math.abs(frac(ua + ub) - 0.5);
    n++; if (err > 0.02) off++;
    const d = Math.hypot(cb.x - ca.x, cb.y - ca.y);
    contacts.push([ca.x + (cb.x - ca.x) * A.r / d, ca.y + (cb.y - ca.y) * A.r / d]);
  }
  const rects = Array.from(document.querySelectorAll('.mx-label rect')).map((r) => r.getBBox());
  const covered = contacts.filter(([x, y]) => rects.some((r) => x > r.x - 0.5 && x < r.x + r.width + 0.5 && y > r.y - 0.5 && y < r.y + r.height + 0.5)).length;
  const gears = it.wheels.filter((w) => w.kind === 'gear').length;
  return { meshes: n, misaligned: off, loops: m.res.loops, covered, gears, drawnGears: document.querySelectorAll('.mx-gear .mx-teeth').length,
    labels: Array.from(document.querySelectorAll('.mx-label text')).map((t) => t.textContent) };
}"""


def shot(target, name):
    target.screenshot(path=str(DIR / name))


def stage_ok(target, tag):
    ok, s = non_blank(target.locator('.mx-stage').screenshot(), min_distinct=8, max_top=0.97)
    C.ok(ok, f'{tag}: the drawing shows a mechanism ({s})')
    g = target.evaluate(GEOMETRY)
    C.ok(g['drawnGears'] == g['gears'] and g['gears'] > 0, f'{tag}: every gear is drawn with teeth ({g["drawnGears"]}/{g["gears"]})')
    C.ok(g['misaligned'] <= g['loops'], f'{tag}: meshing teeth interleave ({g["misaligned"]} of {g["meshes"]} off, {g["loops"]} loops)')
    C.ok(g['covered'] == 0, f'{tag}: labels cover no mesh contact point ({g["covered"]})')
    C.ok('DRIVER' in g['labels'] and ('MARKED' in g['labels'] or 'DRUM' in g['labels']), f'{tag}: driver and marked part are labelled ({g["labels"]})')


def timer_ok(target, tag, running):
    t = target.evaluate("() => { const e = document.querySelector('.ex-mechanisms .pr-timer'); const f = e && e.firstChild; "
                        "return e ? { hidden: e.hidden, cls: e.className, dur: f.style.animationDuration, limit: PX.ex.get('mechanisms').timeLimit(__harness.item.params) } : null; }")
    if running:
        C.ok(t and not t['hidden'] and 'is-running' in t['cls'] and t['dur'] == f"{t['limit']}ms", f'{tag}: the time limit runs as a bar ({t})')
    else:
        C.ok(t and 'is-stopped' in t['cls'], f'{tag}: the bar stops at reveal ({t})')


def answer_keyboard(page, frame, tag):
    page.keyboard.press(str(frame.evaluate('() => __harness.key') + 1))
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is True and r['source'] == 'key', f'{tag}: a right answer by keyboard scores right ({r["result"]}, {r["source"]})')


def answer_pointer(page, frame, tag, tap=False):
    key = frame.evaluate('() => __harness.key')
    cell = frame.locator('.hx-grid .px-choice').nth((key + 1) % 3)
    cell.tap() if tap else cell.click()
    frame.wait_for_function(STATE, arg='reveal', timeout=10000)
    r = frame.evaluate('() => __harness.last')
    C.ok(r['result']['correct'] is False and r['source'] == 'pointer', f'{tag}: a wrong answer by pointer scores wrong ({r["result"]}, {r["source"]})')
    marks = frame.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => b.className)")
    C.ok(any('is-wrong' in m for m in marks) and any('is-missed' in m for m in marks), f'{tag}: the grid marks the wrong pick and the missed answer')


def show_me(frame, tag, page=None):
    before = frame.evaluate('() => __harness.played.finished')
    if page is not None:
        page.keyboard.press('s')
    else:
        frame.evaluate('() => { __harness.showMe(); }')
    frame.wait_for_function('(n) => __harness.played.finished > n && __harness.state === "reveal"', arg=before, timeout=90000)
    C.ok(True, f'{tag}: show me ran to the end ({frame.evaluate("() => __harness.played.ms")} ms)')


def desktop_and_phone(b, cons):
    for vp, tag, kw in [((1366, 768), '1366', {}), ((412, 880), '412', {'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True})]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, **kw)
        page = ctx.new_page()
        cons.append(Console(page))
        phone = tag == '412'
        for lv, p, seed in LEVELS:
            for theme in ('light', 'dark'):
                name = f'{EX}_{lv}_{tag}_{theme}'
                page.goto(file_url('tests/dev/harness.html', ex=EX, seed=seed, p=p, fast=1, theme=theme))
                page.wait_for_function(READY, timeout=60000)
                stage_ok(page, name)
                timer_ok(page, name, True)
                shot(page, name + '.png')
                if phone:
                    sw = page.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
                    C.ok(sw[0] <= sw[1], f'{name}: no horizontal scroll ({sw})')
                if theme == 'light':
                    answer_keyboard(page, page, name)
                    timer_ok(page, name, False)
                    shot(page, name + '_reveal.png')
                    show_me(page, name, page=page)
                    page.keyboard.press('Space')
                    page.wait_for_function(READY, timeout=10000)
                    answer_pointer(page, page, name, tap=phone)
                    shot(page, name + '_wrong.png')
                else:
                    page.evaluate('() => __harness.answer(false)')
                    page.wait_for_function(STATE, arg='reveal', timeout=10000)
                    shot(page, name + '_reveal.png')
                errs = page.evaluate('() => __harness.errors')
                C.ok(not errs, f'{name}: no harness errors ({errs})')
        ctx.close()


def normal_speed(b, cons):
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    times = {}
    for lv, p, seed, rm in (('lift', 'gears:1,structure:1,question:1', 11, 0), ('lift', 'gears:1,structure:1,question:1', 11, 1),
                            ('jam', 'gears:3,structure:3,question:0', 12, 0)):
        page.goto(file_url('tests/dev/harness.html', ex=EX, seed=seed, p=p, rm=rm))
        page.wait_for_function(READY, timeout=60000)
        page.evaluate('() => __harness.answer(false)')
        page.wait_for_function(STATE, arg='reveal', timeout=10000)
        steps = page.evaluate('() => PX.ex.view("mechanisms").steps(__harness.item).map((s) => s.ms)')
        before = page.evaluate('() => __harness.played.finished')
        page.evaluate('() => { __harness.showMe(); }')
        page.wait_for_timeout(1500)
        page.keyboard.press('Space')  # pause for a steady screenshot, then resume
        page.wait_for_timeout(300)
        shot(page, f'{EX}_{lv}_showme{"_rm" if rm else ""}.png')
        page.keyboard.press('Space')
        page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=90000)
        pl = page.evaluate('() => __harness.played')
        times[f'{lv}{"_rm" if rm else ""}'] = {'planned': round(pl['plannedMs'] / 1000, 2), 'steps': len(steps), 'longest': max(steps)}
        C.ok(steps and max(steps) <= 4000 and sum(steps) >= 2000, f'show me ({lv}): every step ≤ 4 s ({steps})')
    C.ok(times['lift_rm']['planned'] < times['lift']['planned'], f'reduced motion makes show me shorter ({times})')
    page.goto(file_url('tests/dev/harness.html', ex=EX, seed=6, p='gears:2,structure:1,question:0'))
    page.wait_for_function(READY, timeout=60000)
    page.evaluate('() => __harness.answer(true)')
    page.wait_for_function(STATE, arg='reveal', timeout=10000)
    page.keyboard.press('s')
    page.wait_for_function(STATE, arg='showme', timeout=5000)
    page.keyboard.press('Space')
    page.wait_for_timeout(500)
    C.ok('Resume' in page.locator('.hx-player-buttons .px-btn').first.inner_text(), 'Space pauses show me')
    page.keyboard.press('ArrowRight')
    page.keyboard.press('r')
    page.wait_for_function(STATE, arg='reveal', timeout=60000)
    C.ok(True, 'pause, step and replay, then show me ends')
    page.goto(file_url('tests/dev/harness.html', ex=EX, seed=1, fast=1))
    page.wait_for_function(READY, timeout=60000)
    before = page.evaluate('() => __harness.played.finished')
    page.evaluate('() => { __harness.demo(); }')
    page.wait_for_function('(n) => __harness.played.finished > n', arg=before, timeout=90000)
    d = page.evaluate("() => ({ seed: __harness.item.seed, want: PX.ex.learn('mechanisms').demo[0].seed, caption: document.querySelector('.hx-caption').textContent })")
    C.ok(d['seed'] == d['want'] and d['caption'], f'the worked example plays the fixed seed with captions ({d})')
    ctx.close()
    return times


def sandboxed(b, cons):
    doc = harness_single(EX, {'seed': 21, 'p': 'gears:1,structure:2,question:1', 'fast': True})
    host = srcdoc_host(f'harness_{EX}', doc)
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    page = ctx.new_page()
    cons.append(Console(page))
    page.goto(host.as_uri())
    fr = child_frame(page)
    fr.wait_for_function(READY, timeout=60000)
    env = fr.evaluate('() => ({ origin: String(self.origin), href: location.href })')
    C.ok(env['origin'] == 'null' and env['href'] == 'about:srcdoc', f'srcdoc: runs in a sandboxed srcdoc frame ({env})')
    stage_ok(fr, 'srcdoc')
    fr.locator('.hx-goal').click()
    answer_keyboard(page, fr, 'srcdoc')
    show_me(fr, 'srcdoc', page=page)
    shot(page, f'{EX}_srcdoc.png')
    C.ok(not fr.evaluate('() => __harness.errors'), 'srcdoc: no harness errors')
    ctx.close()


def main():
    cons = []
    with sync_playwright() as p:
        b = launch(p)
        desktop_and_phone(b, cons)
        times = normal_speed(b, cons)
        sandboxed(b, cons)
        b.close()
    errors = [e for c in cons for e in c.errors()]
    C.ok(not errors, f'no console errors ({errors[:5]})')
    return C.summary({'showMe': times, 'screenshots': sorted(p.name for p in DIR.glob('*.png'))})


if __name__ == '__main__':
    sys.exit(main())
