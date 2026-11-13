"""E2E: the dev harness with Painted Cubes (EX-18, SVG). Shared flow in tests/e2e/pat_harness.py.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_cubes.py
Own checks: one drawn face per exposed top, front and right face of the model (lib.facesOf);
the question shows the item's N; options read 1–5; after show me, one numbered badge per cube with
N painted sides, hidden ones as dashed ghosts. Screenshots: tests/e2e/out/cubes/. """
import sys

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
        const hidden = rr.cubes.filter((q, i) => q.painted === it.ask && rr.perCube[i].any === 0).length;
        return { badges: document.querySelectorAll('.ex-cubes-marks .ex-cubes-badge').length, ghosts: document.querySelectorAll('.ex-cubes-marks .ex-cubes-ghost').length,
                 count: it.count, hidden };
    }""")
    C.ok(d['badges'] == d['count'] and d['ghosts'] == d['hidden'], f'{tag}: show me ends with one badge per counted cube, hidden ones as ghosts ({d})')


if __name__ == '__main__':
    P = Pat('cubes', [('easy', 'cubes:0', 2), ('mid', 'cubes:1,height:1,asked:1', 7), ('big', 'cubes:3,height:2,asked:1', 4)],
            stem_check=stem, option_check=options, showme_check=showme)
    sys.exit(P.run(demo=('cubes:0', 2), sandbox=('cubes:2,height:2', 21)))
