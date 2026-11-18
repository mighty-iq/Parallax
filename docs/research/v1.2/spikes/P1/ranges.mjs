import { createContext } from '../../../../../tests/node/run.mjs';
const { PX } = createContext({});
const E = PX.engine;
for (const d of PX.ex.list('train')) {
  const r = E.model.range(d);
  const pool = E.model.pool(d);
  const dims = d.dims.map(x => `${x.key}:${x.levels.length}`).join(' ');
  const gs = [...new Set(pool.map(c => +c.g.toFixed(3)))].join('/');
  console.log(d.id.padEnd(9), 'min', r.min.toFixed(2), 'max', r.max.toFixed(2), 'span', (r.max - r.min).toFixed(2), 'lv/logit', (99 / (r.max - r.min)).toFixed(1), 'pool', pool.length, 'g', gs, '|', dims, '| answer', d.answer, d.variants ? 'variants ' + d.variants.join(',') : '');
}
