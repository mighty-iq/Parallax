"""E2E: the dev harness with Angles (EX-16, SVG). Shared flow in tests/e2e/pat_harness.py.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_angles.py
Own checks: four numbered cells, each drawing exactly the item's endpoints; options read as
lists of the four numbers; reveal shows every angle's size; show me ends on the cells with the
sizes in view. Screenshots: tests/e2e/out/angles/. """
import sys

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
    C.ok(d['n'] == 4 and d['labels'] == ['1', '2', '3', '4'], f'{tag}: four cells numbered 1–4 ({d["labels"]})')
    C.ok(all(d['drawn']), f'{tag}: every cell draws exactly the item\'s vertex and arm ends ({d["drawn"]})')
    C.ok(d['minCell'] >= 150, f'{tag}: cells at least 150 px wide ({d["minCell"]} px)')


def options(C, page, tag):
    d = page.evaluate("""() => ({ texts: Array.from(document.querySelectorAll('.hx-grid .ex-angles-opt .ex-answer-text')).map((e) => e.textContent.replace(/\u00a0/g, ' ')),
        want: __harness.item.options.map((o) => o.map((c) => c + 1).join(' – ')) })""")
    C.ok(d['texts'] == d['want'], f'{tag}: the options read as the item\'s orderings ({d["texts"]})')


def showme(C, frame, tag):
    d = frame.evaluate("""() => Array.from(document.querySelectorAll('.ex-angles-size')).map((e) => e.hidden ? '' : e.textContent)""")
    C.ok(len(d) == 4 and all(x.endswith('°') for x in d), f'{tag}: show me leaves every angle\'s size in view ({d})')


if __name__ == '__main__':
    P = Pat('angles', [('easy', 'gap:0', 5), ('close', 'gap:4,size:2,resolve:2,pose:1', 9), ('acute', 'gap:2,size:1,resolve:1,pose:1', 3)],
            stem_check=stem, option_check=options, showme_check=showme)
    sys.exit(P.run(demo=('gap:0', 5), sandbox=('gap:3,size:1,resolve:2,pose:1', 21)))
