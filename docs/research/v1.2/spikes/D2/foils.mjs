// Read-only: foil kinds at the easiest levels (Missing View reasons, Views kinds, Form kinds).
import { createContext } from '../../../../../tests/node/run.mjs';
const { PX } = createContext();
const n = 400;
function tally(id, p, f) { const def = PX.ex.get(id), c = {}; let items = 0; for (let i = 0; i < n; i++) { const it = def.generate(PX.rng(PX.rng.hash('d2-foil', id, i)), p); items++; f(it).forEach((k) => { c[k] = (c[k] || 0) + 1; }); } return { items, c }; }
const pv = tally('patviews', { cubes: 0, grid: 0, missing: 0, foil: 0 }, (it) => it.options.filter((o, i) => i !== it.key).map((o) => o.why || o.kind));
const pvItems = tally('patviews', { cubes: 0, grid: 0, missing: 0, foil: 0 }, (it) => [it.options.some((o, i) => i !== it.key && o.why === 'search') ? 'has a search-only foil' : 'no search-only foil']);
console.log('patviews L0 foil reasons', JSON.stringify(pv.c), JSON.stringify(pvItems.c));
const pvDot = tally('patviews', { cubes: 0, grid: 0, missing: 0, foil: 0 }, (it) => [it.options[it.key].drawing.segs.some((s) => s[4] === 2) ? 'key has dotted' : 'key no dotted']);
console.log('patviews L0 key dotted', JSON.stringify(pvDot.c));
const v = tally('views', { cubes: 0, grid: 0, view: 0, variant: 'toview' }, (it) => it.options.filter((o, i) => i !== it.key).map((o) => o.kind));
console.log('views toview L0 foil kinds', JSON.stringify(v.c));
const vs = tally('views', { cubes: 0, grid: 0, view: 0, variant: 'toview' }, (it) => { const k = it.options[it.key].drawing; return [it.options.filter((o, i) => i !== it.key && o.drawing.w === k.w && o.drawing.h === k.h).length + ' foils same size as key']; });
console.log('views toview L0 same-size foils', JSON.stringify(vs.c));
const fm = tally('form', { solid: 0, marks: 0, view: 0, foil: 0 }, (it) => it.options.filter((o, i) => i !== it.key).map((o) => o.kind));
console.log('form L0 foil kinds', JSON.stringify(fm.c));
const fk = tally('form', { solid: 0, marks: 0, view: 0, foil: 0 }, (it) => [it.solid.kind]);
console.log('form L0 solids', JSON.stringify(fk.c));
const op = tally('openings', { features: 0, edges: 0, keyview: 0, pose: 0, foils: 0 }, (it) => [it.keyAxis + ' axis', 'key tf ' + (it.options[it.key].tf === 0 ? 'identity' : 'turned/flipped')]);
console.log('openings L0 key axis and transform', JSON.stringify(op.c));
const pf = tally('patfold', { folds: 0, type: 0, idle: 1 }, (it) => it.options.filter((o, i) => i !== it.key).map((o) => (it.why && it.why[it.options.indexOf(o)]) || o.kind || 'foil'));
console.log('patfold L0 foil whys', JSON.stringify(pf.c).slice(0, 400));
