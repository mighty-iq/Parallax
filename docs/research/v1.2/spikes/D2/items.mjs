// Read-only: generate easiest-level items and print their features. Writes nothing.
import { createContext } from '../../../../../tests/node/run.mjs';
const { PX } = createContext();
const N = +(process.argv[2] || 6);
const ex = (process.argv[3] || 'views,angles,cubes,openings,form,patfold,patviews').split(',');
const seeds = Array.from({ length: N }, (_, i) => PX.rng.hash('d2-sample', i));
function gen(id, params, s) { const def = PX.ex.get(id); return def.generate(PX.rng(s), params); }
const tot = (h) => h.flat().reduce((a, b) => a + b, 0);
const out = {
  views(p) {
    for (const s of seeds) {
      const it = gen('views', p, s);
      const n = tot(it.heights), cols = it.heights.flat().filter((x) => x > 0).length, hmax = Math.max(...it.heights.flat());
      const extra = it.variant === 'toview' ? `view ${it.view}; options ${it.options.map((o) => o.kind + (o.from ? '(' + o.from + ')' : '') + ':' + o.drawing.w + 'x' + o.drawing.h + '/' + o.drawing.lines.length + 'ln').join(', ')}` : it.variant === 'count' ? `options ${it.options.join(',')}` : `options ${it.options.map((o) => o.kind + '[' + (o.matches || []).join('+') + ']').join(', ')}`;
      console.log(`  ${it.variant} key ${it.key}: ${n} cubes, ${cols} columns, tallest ${hmax}, grid ${it.grid}; ${extra}`);
    }
  },
  angles(p) {
    for (const s of seeds) {
      const it = gen('angles', p, s);
      console.log(`  key ${it.key}: deg ${it.deg.map((d) => d.toFixed(1)).join(', ')}; gaps by rank ${it.gaps.map((g) => g.toFixed(1)).join(', ')}; span ${(Math.max(...it.deg) - Math.min(...it.deg)).toFixed(1)}`);
    }
  },
  cubes(p) {
    for (const s of seeds) {
      const it = gen('cubes', p, s);
      const n = tot(it.heights), hist = PX.ex.get('cubes').lib.histogram(it.heights);
      console.log(`  key ${it.key}: ${n} cubes on ${it.heights.length}x${it.heights.length}, tallest ${Math.max(...it.heights.flat())}, hidden ${it.hidden}; asks N=${it.ask} → ${it.count}; painted-sides histogram 0..5 ${hist.join(',')}`);
    }
  },
  openings(p) {
    for (const s of seeds) {
      const it = gen('openings', p, s);
      const f = it.feats, fc = ['F', 'T', 'S'].map((k) => k + ':' + f[k].map((x) => x.t).join('+')).join(' ');
      console.log(`  key ${it.key}: box ${it.W}x${it.H}x${it.D} steps, pose ${it.pose}, key axis ${it.keyAxis}; feats ${fc}; options ${it.options.map((o) => o.kind + '/' + (o.tf !== undefined ? 'tf' + JSON.stringify(o.tf) : '')).join(', ')}`);
    }
  },
  form(p) {
    for (const s of seeds) {
      const it = gen('form', p, s);
      const marks = it.marks.map((m) => (m === 0 ? '.' : m === 1 ? 'F' : 'H')).join('');
      console.log(`  key ${it.key}: ${it.solid.kind} ${JSON.stringify(it.solid.dims)}, ${it.solid.faces.length} faces, net pieces ${it.net.length}; marks ${marks}; options ${it.options.map((o) => o.kind).join(', ')}`);
    }
  },
  patfold(p) {
    for (const s of seeds) {
      const it = gen('patfold', p, s);
      const holes = Array.isArray(it.holes) ? it.holes.length : it.holes;
      console.log(`  key ${it.key}: folds ${it.folds.map((f) => f.type || f.k || JSON.stringify(f)).join(' | ')}; holes ${holes}; punch ${JSON.stringify(it.punches)}`);
    }
  },
  patviews(p) {
    for (const s of seeds) {
      const it = gen('patviews', p, s);
      const n = it.heights.flat().reduce((a, b) => a + b, 0);
      const dotted = (d) => d.segs.filter((x) => x[4] === 2).length;
      const given = Object.keys(it.given);
      console.log(`  key ${it.key}: ${n} cubes, box ${it.W}x${it.H}x${it.D}; missing ${it.missing} (given ${given.join('+')}); key segs ${it.options[it.key].drawing.segs.length} (${dotted(it.options[it.key].drawing)} dotted); options ${it.options.map((o) => o.kind + (o.why ? '/' + o.why : '')).join(', ')}`);
    }
  },
};
const P = {
  views: [{ cubes: 0, grid: 0, view: 0, variant: 'toview' }, { cubes: 0, grid: 0, view: 0, variant: 'count' }, { cubes: 0, grid: 0, view: 0, variant: 'toobject' }],
  angles: [{ gap: 0, size: 0, resolve: 0, pose: 0 }],
  cubes: [{ cubes: 0, height: 0, asked: 0 }],
  openings: [{ features: 0, edges: 0, keyview: 0, pose: 0, foils: 0 }],
  form: [{ solid: 0, marks: 0, view: 0, foil: 0 }],
  patfold: [{ folds: 0, type: 0, idle: 1 }],
  patviews: [{ cubes: 0, grid: 0, missing: 0, foil: 0 }],
};
for (const id of ex) for (const p of P[id]) { console.log(`\n## ${id} ${JSON.stringify(p)}`); out[id](p); }
