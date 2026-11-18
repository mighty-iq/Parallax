"""E2E: the dev harness with Painted Cubes (EX-18, SVG). Shared flow in tests/e2e/pat_harness.py.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_cubes.py
Own checks: one drawn face per exposed top, front and right face of the model (lib.facesOf);
the question shows the item's N; options read 1–5; after show me, every cube carries its number of
painted sides, the counted ones ringed, hidden ones as dashed ghosts. The v1.2 starter band
(tests/e2e/band_a.py): flat and 4–6-cube items at 360 × 640, Try 1 with every number but two, the
rules card, Try 3 with its hidden cube dashed (and numbered in the reveal). Screenshots:
tests/e2e/out/cubes/. """
import sys

from playwright.sync_api import sync_playwright

from band_a import band_checks, wtg_checks
from common import launch
from pat_harness import Pat


def stem(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, L = PX.ex.get('cubes').lib;
        return { faces: document.querySelectorAll('.ex-cubes-figure .ex-cubes-face').length,
                 want: L.facesOf(L.cubesOf(it.heights)).length,
                 n: document.querySelector('.ex-cubes-n').textContent, ask: it.ask,
                 w: Math.round(document.querySelector('.ex-cubes-svg').getBoundingClientRect().width) };
    }""")
    C.ok(d['faces'] == d['want'], f'{tag}: one drawn face per exposed top, front and right face ({d["faces"]} of {d["want"]})')
    C.ok(d['n'] == str(d['ask']), f'{tag}: the question shows N = {d["ask"]} ({d["n"]!r})')
    C.ok(d['w'] >= 200, f'{tag}: the figure is at least 200 px wide ({d["w"]} px)')


def options(C, page, tag):
    t = page.evaluate("() => Array.from(document.querySelectorAll('.hx-grid .ex-cubes-opt .ex-answer-text')).map((e) => e.textContent)")
    C.ok(t == ['1', '2', '3', '4', '5'], f'{tag}: the options are 1–5 cubes ({t})')


def showme(C, frame, tag):
    d = frame.evaluate("""() => {
        const it = __harness.item, L = PX.ex.get('cubes').lib, rr = L.render(it.heights);
        const nums = Array.from(document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge')).map((g) => g.querySelector('.ex-cubes-badge-n').textContent);
        return { badges: nums.length, cubes: rr.cubes.length, ringed: document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge--count').length,
                 ghosts: document.querySelectorAll('.ex-cubes-marks .ex-cubes-ghost').length, hidden: rr.perCube.filter((pc) => pc.any === 0).length,
                 count: it.count, numbers: nums.sort().join(''), want: rr.cubes.map((q) => q.painted).sort().join('') };
    }""")
    C.ok(d['badges'] == d['cubes'] and d['numbers'] == d['want'] and d['ringed'] == d['count'] and d['ghosts'] == d['hidden'],
         f'{tag}: show me ends with every cube\'s number of painted sides, the counted ones ringed, hidden ones as ghosts ({d})')


def assist(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, n = PX.ex.get('cubes').lib.total(it.heights);
        return { unknown: document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge--unknown').length,
                 numbers: document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge--number').length, n,
                 caption: (document.querySelector('.ex-cubes-under .ex-caption') || {}).textContent || '' };
    }""")
    C.ok(d['unknown'] == 2 and d['numbers'] == d['n'] - 2 and 'two' in d['caption'], f'{tag}: every cube\'s number but two, which show ? ({d})')


def hidden_before(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, rr = PX.ex.get('cubes').lib.render(it.heights);
        return { ghosts: document.querySelectorAll('.ex-cubes-marks .ex-cubes-ghost').length, hidden: rr.perCube.filter((pc) => pc.any === 0).length,
                 badges: document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge').length,
                 caption: (document.querySelector('.ex-cubes-under .ex-caption') || {}).textContent || '' };
    }""")
    C.ok(d['hidden'] == 1 and d['ghosts'] == 1 and d['badges'] == 0 and 'dashed' in d['caption'],
         f'{tag}: the hidden cube drawn dashed, no number on any cube, the caption says so ({d})')


def hidden_after(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, rr = PX.ex.get('cubes').lib.render(it.heights);
        const hid = rr.cubes.filter((q, i) => rr.perCube[i].any === 0).map((q) => String(q.painted));
        return { ghosts: document.querySelectorAll('.ex-cubes-marks .ex-cubes-ghost').length, hidden: hid,
                 onHidden: Array.from(document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge.is-hidden .ex-cubes-badge-n')).map((e) => e.textContent),
                 ringed: document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge--count').length, count: it.count };
    }""")
    C.ok(d['ghosts'] == 1 and d['onHidden'] == d['hidden'] and d['ringed'] == d['count'],
         f'{tag}: the reveal keeps the hidden cube dashed with its number, and rings the counted cubes ({d})')


class Band(Pat):
    def run(self, demo, sandbox):
        cons = []
        with sync_playwright() as p:
            b = launch(p)
            self.views(b, cons)
            self.fit(b, cons)
            self.demo(b, cons, *demo)
            self.sandboxed(b, cons, *sandbox)
            band_checks(b, cons, self.C, 'cubes', self.dir,
                        [('flat', 'cubes:0,height:0,asked:0', 1), ('flat9', 'cubes:1,height:0,asked:1', 5), ('small', 'cubes:0,height:1,asked:0', 18)],
                        assist_check=assist, try1=('cubes:0,height:0,asked:0', 13),
                        assists=[('try3', 'cubes:0,height:1,asked:0', 18, '{"hidden":true}', hidden_before, hidden_after)])
            wtg_checks(b, cons, self.C, 'cubes', self.dir, '.ex-cubes-marks .ex-cubes-badge--unknown', try_marks={3: '.ex-cubes-marks .ex-cubes-ghost'})
            b.close()
        errors = [e for c in cons for e in c.errors()]
        self.C.ok(not errors, f'no console errors ({errors[:5]})')
        for f in self.dir.glob('_page_*.html'):
            f.unlink()
        return self.C.summary({'screenshots': sorted(p.name for p in self.dir.glob('cubes_*.png'))})


if __name__ == '__main__':
    P = Band('cubes', [('band', 'cubes:0,height:0', 2), ('floor', 'cubes:1,height:1,asked:1', 7), ('big', 'cubes:4,height:3,asked:1', 4)],
             stem_check=stem, option_check=options, showme_check=showme)
    sys.exit(P.run(demo=('cubes:0,height:0', 1), sandbox=('cubes:3,height:2', 21)))
