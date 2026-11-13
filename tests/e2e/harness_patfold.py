"""E2E: the dev harness with Hole Punch (PAT-4, SVG). Shared flow in tests/e2e/pat_harness.py.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_patfold.py
Hole Punch runs Fold's model (js/ex/fold/gen.js), so the harness is inlined with it (until the
harness loads `def.requires`). Own checks: one panel per fold plus the punch panel, each fold panel
with the paper's position before the fold dashed, holes only in the punch panel; every option
sheet shows all 16 positions with exactly its item.options holes filled; show me ends on the flat
sheet with exactly the key's holes. Screenshots: tests/e2e/out/patfold/. """
import sys

from pat_harness import Pat

CELLS_JS = """(sel) => Array.from(document.querySelectorAll(sel)).map((c) => [Math.round(+c.getAttribute('cx') - 0.5), Math.round(+c.getAttribute('cy') - 0.5)]).sort((a, b) => a[0] - b[0] || a[1] - b[1])"""


def sort_cells(cells):
    return sorted([list(c) for c in cells], key=lambda c: (c[0], c[1]))


def stem(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, panels = Array.from(document.querySelectorAll('.ex-patfold-strip .ex-patfold-panel'));
        return { folds: it.folds.length, panels: panels.length, labels: panels.map((p) => p.querySelector('.ex-label').textContent),
                 holes: panels.map((p) => p.querySelectorAll('.ex-patfold-hole').length), was: panels.map((p) => p.querySelectorAll('.ex-patfold-was').length) };
    }""")
    C.ok(d['panels'] == d['folds'] + 1 and d['labels'][-1] == 'Punch', f'{tag}: one panel per fold and the punch panel ({d["labels"]})')
    C.ok(all(h == 0 for h in d['holes'][:-1]) and d['holes'][-1] == 1, f'{tag}: holes only in the punch panel, one punch ({d["holes"]})')
    C.ok(all(w == 1 for w in d['was']), f'{tag}: every panel shows where the paper was, dashed ({d["was"]})')


def options(C, page, tag):
    item = page.evaluate('() => __harness.item')
    n = len(item['options'])
    drawn = [page.evaluate(CELLS_JS, f'.hx-grid .px-choice:nth-child({i + 1}) .ex-patfold-hole') for i in range(n)]
    pos = [page.evaluate(f"() => document.querySelectorAll('.hx-grid .px-choice:nth-child({i + 1}) .ex-patfold-hole, .hx-grid .px-choice:nth-child({i + 1}) .ex-patfold-pos').length") for i in range(n)]
    C.ok(all(drawn[i] == sort_cells(item['options'][i]) for i in range(n)), f'{tag}: every option sheet shows exactly its holes')
    C.ok(all(p == 16 for p in pos), f'{tag}: every option shows all 16 positions ({pos})')


def showme(C, frame, tag):
    end = frame.evaluate(CELLS_JS, '.ex-patfold-svg--big .ex-patfold-hole')
    key = frame.evaluate('() => __harness.item.options[__harness.key]')
    C.ok(end == sort_cells(key), f'{tag}: show me ends on the flat sheet with exactly the key\'s holes ({len(end)} holes)')


if __name__ == '__main__':
    P = Pat('patfold', [('easy', 'idle:1', 3), ('three', 'folds:1,type:3', 6), ('corner', 'folds:1,type:1,idle:1', 11)], deps=['js/ex/fold/gen.js'],
            stem_check=stem, option_check=options, showme_check=showme)
    sys.exit(P.run(demo=('idle:1', 3), sandbox=('folds:1,type:2', 21)))
