/* The node runner's shards (v1.2 O33): node tests/node/run.mjs --shard k/n deals the test files so that the
   shards together run every file exactly once and take about the same time; CI runs four of them. */
import fs from 'node:fs';
import { shardFiles, parseShard, weightOf, WEIGHTS } from './run.mjs';

const HERE = new URL('.', import.meta.url);

export async function run(t) {
  const files = fs.readdirSync(HERE).filter((f) => f.endsWith('.test.mjs')).sort();
  t.section('shards: every file once');
  for (let n = 1; n <= 6; n++) {
    const seen = new Map();
    let worst = 0;
    for (let k = 1; k <= n; k++) {
      const s = shardFiles(files, k, n);
      s.files.forEach((f) => seen.set(f, (seen.get(f) || 0) + 1));
      worst = Math.max(worst, s.load);
      t.eq(s.files, [...s.files].sort(), `n = ${n}, shard ${k}: its files in name order`);
    }
    t.eq([...seen.keys()].sort(), files, `n = ${n}: the shards together hold every test file`);
    t.ok([...seen.values()].every((c) => c === 1), `n = ${n}: no file runs in two shards`);
    const total = files.reduce((a, f) => a + weightOf(f), 0), heaviest = Math.max(...files.map(weightOf));
    t.ok(worst <= total / n + heaviest + 1e-9, `n = ${n}: the busiest shard is within one file of an even split (${Math.round(worst)} s of ${Math.round(total)} s)`);
  }
  t.section('shards: CI');
  const ci = fs.readFileSync(new URL('../../.github/workflows/tests.yml', import.meta.url), 'utf8');
  t.ok(/shard: \[1, 2, 3, 4\]/.test(ci) && /run\.mjs --shard \$\{\{ matrix\.shard \}\}\/4/.test(ci), 'CI runs four shards');
  const loads = [1, 2, 3, 4].map((k) => shardFiles(files, k, 4).load);
  t.ok(Math.max(...loads) <= 15 * 60, `each of CI's four shards expects at most half its 30 minutes (${loads.map(Math.round).join(', ')} s)`);
  t.ok(Object.keys(WEIGHTS).every((f) => files.indexOf(f) >= 0), 'every weighed file exists');
  t.section('shards: the --shard argument');
  t.eq(parseShard(['--shard', '2/4', 'knots']), { shard: { k: 2, n: 4 }, rest: ['knots'] }, '--shard 2/4 with a name filter');
  t.eq(parseShard(['--shard=1/1']), { shard: { k: 1, n: 1 }, rest: [] }, '--shard=1/1');
  t.eq(parseShard(['knots']), { shard: null, rest: ['knots'] }, 'no shard');
  t.throws(() => parseShard(['--shard', '5/4']), /k\/n/, 'k above n is refused');
  t.throws(() => parseShard(['--shard', 'x']), /k\/n/, 'a malformed shard is refused');
}
