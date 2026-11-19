/* EX-13 Knots, part B (v1.2 O33): the item checks of the tie and link variants (10 000 items each), their
   shortcut solvers and their show-me replays, split from knots.test.mjs (which checks everything else and the
   pull and untie items) so that no test file holds up a CI shard. Run through tests/node/run.mjs (filter: knots). */
import { runPart, PART_B } from './knots.test.mjs';

export async function run(t) {
  await runPart(t, PART_B);
}
