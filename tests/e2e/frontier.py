"""E2E test of PLAN milestone 7's screens (W2-progress; js/ui/frontier.js through PX.ui.hooks):
  page    after simulated practice with an uneven profile (the engine itself plays eight Train sessions on
          one exercise), the exercise page shows "Settings you handle": one row per dimension with its
          frontier in words and a ruler, how the settings are found (fitted from 100 answers on), the leading
          line and, with Speed open, the timed-items line; How to play shows the shorter panel
  notes   the item:notes after a fluency item: right in time, ran out, not right, with the next deadline,
          and the explanation once a session
At 360 x 640, 390 x 844 and 1366 x 768; no console errors, no horizontal scroll. Other suites mute the
builders' hooks, so this one unmutes them (PX.ui.hooks.mute(false)). Screenshots: tests/e2e/out/frontier/.

Run: tests/e2e/pwslot.sh python3 tests/e2e/frontier.py   (exit 1 when a check fails)
"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright
from common import Checks, Console
from shell_common import INDEX, READY

OUT = pathlib.Path(__file__).resolve().parent / 'out' / 'frontier'
OUT.mkdir(parents=True, exist_ok=True)
C = Checks('frontier')
SIZES = [(360, 640), (390, 844), (1366, 768)]
EX = 'rotate'

PRACTISE = '''(a) => {
  const E = PX.engine, M = E.model, rec = PX.core.store.state, def = PX.ex.get(a.ex);
  const r = PX.rng(42), disp = E.est.displayClass(innerWidth, innerHeight);
  const mid = def.dims.map((d) => (d.levels.length - 1) / 2), z = [-0.12, 0.25, 0, 0, 0];
  let t = Date.now() - a.days * 86400000;
  for (let d = 0; d < a.days; d++) {
    const plan = E.modes.start(rec, 'train', { now: t, display: disp, minutes: 15, can: (x) => x.id === a.ex });
    for (let i = 0; i < 400; i++) {
      const s = E.modes.next(plan, rec, t);
      if (s.done) break;
      let b = def.difficulty(s.params);
      def.dims.forEach((dm, j) => { b += z[j] * (s.params[dm.key] - mid[j]); });
      const th = 0.6 + 0.004 * d * 40;
      const ok = r.chance(M.p(th, b, s.g));
      t += 5000;
      E.modes.answer(plan, rec, s, { correct: ok, rt: s.deadlineMs ? Math.min(1500, s.deadlineMs / 2) : 2500 }, t);
    }
    E.modes.finish(plan, rec, t + 1000);
    t += 86400000;
  }
  PX.core.store.save();
  return { n: rec.ex[a.ex].n, dims: E.dims.state(rec, def, disp) };
}'''

NOTE = '''(a) => {
  const def = PX.ex.get(a.ex), plan = { mode: 'train' };
  const make = (inTime, timeout) => PX.ui.hooks.collect('item:notes', { mode: 'train', plan, rec: PX.core.store.state, now: Date.now(),
    step: { kind: 'fluency', deadlineMs: 3200, exId: a.ex }, def, item: {}, tr: { outcome: inTime ? 'right' : 'wrong', timeout },
    out: { timed: true, inTime, rated: false, fluency: { inTime, deadlineMs: 3200, next: inTime ? 3054 : 3700 } } });
  const box = document.createElement('div');
  box.setAttribute('data-test', 'fluency-notes');
  box.style.cssText = 'padding:12px;max-width:42rem';
  [make(true, false), make(false, true), make(false, false)].forEach((list) => list.forEach((el) => box.appendChild(el)));
  const host = document.querySelector('main') || document.body;
  host.prepend(box);
  return box.children.length;
}'''


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for (w, h) in SIZES:
            phone = w < 700
            ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if phone else 1, has_touch=phone, is_mobile=phone)
            page = ctx.new_page()
            con = Console(page)
            page.goto(INDEX.as_uri())
            page.wait_for_function(READY, timeout=30000)
            for _ in range(4):
                if not page.evaluate('PX.ui.modalOpen()'):
                    break
                page.keyboard.press('Escape')
                page.wait_for_timeout(120)
            tag = f'{w}x{h}'
            page.evaluate('PX.ui.hooks && PX.ui.hooks.mute && PX.ui.hooks.mute(false)')
            res = page.evaluate(PRACTISE, {'ex': EX, 'days': 8})
            C.ok(res['dims'] and res['dims']['active'], f'{tag}: practice gives an active per-dimension state ({res["n"]} answers)')
            page.evaluate(f'void PX.core.router.go("exercise/{EX}")')
            page.wait_for_timeout(400)
            fr = page.locator('.px-frontier[data-where="page"]')
            C.ok(fr.count() == 1, f'{tag}: the exercise page shows "Settings you handle"')
            if fr.count():
                txt = fr.first.inner_text()
                C.ok('Fitted to your own answers' in txt and 'three times out of four above chance' in txt, f'{tag}: it says how the settings are found')
                rows = fr.locator('[data-dim]').count()
                want = page.evaluate(f"PX.engine.dims.frontier(PX.core.store.state, PX.ex.get('{EX}'), PX.ui.exinfo.display()).length")
                C.ok(rows == want and rows >= 2, f'{tag}: one row per dimension ({rows})')
                C.ok('every fifth item aimed at your level' in txt, f'{tag}: the leading line says every fifth')
                fr.first.scroll_into_view_if_needed()
                fr.first.screenshot(path=str(OUT / f'frontier_page_{w}.png'))
                sw = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
                C.ok(sw <= 0, f'{tag}: no horizontal scroll ({sw})')
            page.locator('[data-ex-action="howto"]').first.click()
            page.wait_for_timeout(400)
            hf = page.locator('.px-frontier[data-where="howto"]')
            C.ok(hf.count() == 1, f'{tag}: How to play shows the panel')
            if hf.count():
                hf.first.scroll_into_view_if_needed()
                hf.first.screenshot(path=str(OUT / f'frontier_howto_{w}.png'))
            page.keyboard.press('Escape')
            page.wait_for_timeout(200)
            n = page.evaluate(NOTE, {'ex': EX})
            C.ok(n == 3, f'{tag}: three fluency notes render ({n})')
            box = page.locator('[data-test="fluency-notes"]')
            t2 = box.inner_text()
            C.ok('right within its 3.2 s' in t2 and 'ran out' in t2 and 'not right this time' in t2 and 'The next timed item gets 3.1 s' in t2, f'{tag}: the notes read in time, ran out and not right, with the next deadline')
            C.ok(t2.count('Timed items come now and then') == 1, f'{tag}: the explanation comes once per session')
            box.screenshot(path=str(OUT / f'fluency_notes_{w}.png'))
            C.ok(not con.errors(), f'{tag}: no console errors {con.errors()[:2]}')
            ctx.close()
        b.close()
    sys.exit(C.summary())


main()
