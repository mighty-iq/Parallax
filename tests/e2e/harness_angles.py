"""E2E: the dev harness with Angles (EX-16, SVG). Shared flow in tests/e2e/pat_harness.py.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_angles.py
Own checks: four cells lettered A–D, each drawing exactly the item's endpoints; options read as
lists of the four letters (the answers keep their keys 1–4); reveal shows every angle's size;
show me ends on the cells with the sizes in view and no answer crossed out. The v1.2 starter band
(tests/e2e/band_a.py): 9° items at 360 × 640, Try 1 with the smallest angle marked and the
answers that do not start with it greyed, the rules card. Screenshots: tests/e2e/out/angles/. """
import sys

from playwright.sync_api import sync_playwright

from band_a import band_checks, wtg_checks
from common import launch
from pat_harness import Pat


def stem(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, cells = Array.from(document.querySelectorAll('.ex-angles-cells .ex-angles-cell'));
        const close = (a, b) => Math.abs(a - b) < 1e-4;
        const drawn = cells.map((c, i) => {
            const nums = (c.querySelector('.ex-angles-arms').getAttribute('d').match(/-?[0-9.e-]+/g) || []).map(Number);
            const g = it.angles[i];
            return nums.length === 6 && close(nums[0], g.a[0]) && close(nums[1], g.a[1]) && close(nums[2], g.v[0]) && close(nums[3], g.v[1]) && close(nums[4], g.b[0]) && close(nums[5], g.b[1]);
        });
        const box = cells.map((c) => c.getBoundingClientRect().width);
        return { n: cells.length, labels: cells.map((c) => c.querySelector('.ex-angles-n').textContent), drawn, minCell: Math.round(Math.min(...box)) };
    }""")
    C.ok(d['n'] == 4 and d['labels'] == ['A', 'B', 'C', 'D'], f'{tag}: four cells lettered A–D ({d["labels"]})')
    C.ok(all(d['drawn']), f'{tag}: every cell draws exactly the item\'s vertex and arm ends ({d["drawn"]})')
    C.ok(d['minCell'] >= 150, f'{tag}: cells at least 150 px wide ({d["minCell"]} px)')


def options(C, page, tag):
    d = page.evaluate("""() => ({ texts: Array.from(document.querySelectorAll('.hx-grid .ex-angles-opt .ex-answer-text')).map((e) => e.textContent.replace(/\u00a0/g, ' ')),
        want: __harness.item.options.map((o) => o.map((c) => 'ABCD'[c]).join(' – ')) })""")
    C.ok(d['texts'] == d['want'], f'{tag}: the options read as the item\'s orderings ({d["texts"]})')


def showme(C, frame, tag):
    d = frame.evaluate("""() => Array.from(document.querySelectorAll('.ex-angles-size')).map((e) => e.hidden ? '' : e.textContent)""")
    C.ok(len(d) == 4 and all(x.endswith('°') for x in d), f'{tag}: show me leaves every angle\'s size in view ({d})')
    out = frame.evaluate("() => document.querySelectorAll('.px-choice.ex-angles-out').length")
    C.ok(out == 0, f'{tag}: show me leaves no answer crossed out ({out})')


def assist(C, page, tag):
    d = page.evaluate("""() => {
        const it = __harness.item, small = it.order[0], cells = Array.from(document.querySelectorAll('.ex-angles-cell'));
        const out = Array.from(document.querySelectorAll('.hx-grid .px-choice')).map((b) => b.classList.contains('ex-angles-out'));
        return { marked: cells.map((c) => c.classList.contains('is-assist')), small, flag: !!cells[small].querySelector('.ex-angles-flag'),
                 out, want: it.options.map((o) => o[0] !== small) };
    }""")
    marked_ok = d['marked'][d['small']] and sum(d['marked']) == 1 and d['flag']
    C.ok(marked_ok and d['out'] == d['want'], f'{tag}: the smallest angle marked, the answers that do not start with it greyed ({d})')


class Band(Pat):
    def run(self, demo, sandbox):
        cons = []
        with sync_playwright() as p:
            b = launch(p)
            self.views(b, cons)
            self.fit(b, cons)
            self.demo(b, cons, *demo)
            self.sandboxed(b, cons, *sandbox)
            band_checks(b, cons, self.C, 'angles', self.dir,
                        [('right', 'gap:0,size:0,resolve:0,pose:0', 16), ('middle', 'gap:0,size:2,resolve:1,pose:1', 7)],
                        assist_check=assist, try1=('gap:0,size:0,resolve:0,pose:0', 28))
            wtg_checks(b, cons, self.C, 'angles', self.dir, '.ex-angles-cell.is-assist .ex-angles-flag')
            b.close()
        errors = [e for c in cons for e in c.errors()]
        self.C.ok(not errors, f'no console errors ({errors[:5]})')
        for f in self.dir.glob('_page_*.html'):
            f.unlink()
        return self.C.summary({'screenshots': sorted(p.name for p in self.dir.glob('angles_*.png'))})


if __name__ == '__main__':
    P = Band('angles', [('easy', 'gap:0', 5), ('close', 'gap:5,size:2,resolve:2,pose:1', 9), ('acute', 'gap:3,size:1,resolve:1,pose:1', 3)],
             stem_check=stem, option_check=options, showme_check=showme)
    sys.exit(P.run(demo=('gap:0', 16), sandbox=('gap:4,size:1,resolve:2,pose:1', 21)))
