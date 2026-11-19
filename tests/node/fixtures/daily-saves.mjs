/* Daily results as each version wrote them, for the O14 migration (tests/node/daily.test.mjs; PLAN milestone 9:
   "the Daily migration is tested on 1.1 saves"). The entries were made by playing Dailies with each version's own
   engine (Parallax 1.1.0 at the v1.1 release commit; 1.2's test builds before O14) through modes.start, next,
   answer and finish: a whole Daily, one left part-way after three answers ("End now"), and one left part-way
   after two answers on a device that could not show the second item's exercise. The 1.2 ramp set comes from a
   context with the ramp started on 2026-11-19 (game.test.mjs's RAMP). Simulated players only; times are UTC.
     v11Daily(T0)   a format-2 record (records.mjs v2Record) holding 1.1's three results
     v12Daily(T0)   a format-4 record (records.mjs v4Filled) holding the test builds' results, epoch 1 and the ramp
     ANSWERED       per date: which entry it is, the seeds of the items its attempt answered (in order) and the
                    exercise a short device could not show */
import { v2Record, v4Filled } from './records.mjs';

export const V11 = {"2026-11-12": {"n": 8, "answered": 8, "right": 6, "t": 1794477660000, "number": 12, "outcomes": [1, 1, 0, 1, 1, 0, 1, 1]}, "2026-11-13": {"n": 8, "answered": 3, "right": 2, "t": 1794567660000, "number": 13, "outcomes": [1, 0, 1, null, null, null, null, null], "partial": true}, "2026-11-14": {"n": 7, "answered": 2, "right": 2, "t": 1794657660000, "number": 14, "outcomes": [1, 1, null, null, null, null, null], "partial": true}};
export const V12 = {"2026-11-12": {"n": 8, "answered": 8, "right": 6, "t": 1794477660000, "number": 12, "outcomes": [1, 1, 0, 1, 1, 0, 1, 1], "ep": 1}, "2026-11-13": {"n": 8, "answered": 3, "right": 2, "t": 1794567660000, "number": 13, "outcomes": [1, 0, 1, null, null, null, null, null], "ep": 1, "partial": true}, "2026-11-14": {"n": 7, "answered": 2, "right": 2, "t": 1794657660000, "number": 14, "outcomes": [1, 1, null, null, null, null, null], "ep": 1, "partial": true}};
export const V12_RAMP = {"2026-11-20": {"n": 8, "answered": 8, "right": 6, "t": 1795168860000, "number": 20, "outcomes": [1, 1, 0, 1, 1, 0, 1, 1], "ep": 2, "points": 27}, "2026-11-21": {"n": 8, "answered": 3, "right": 2, "t": 1795258860000, "number": 21, "outcomes": [1, 0, 1, null, null, null, null, null], "ep": 2, "points": 4, "partial": true}, "2026-11-22": {"n": 7, "answered": 2, "right": 2, "t": 1795348860000, "number": 22, "outcomes": [1, 1, null, null, null, null, null], "ep": 2, "points": 4, "partial": true}};
export const ANSWERED = {"2026-11-12": {"kind": "complete", "answered": [2268146108, 2350947275, 3210721586, 2365433197, 3137061320, 4278589270, 3333022926, 3002350842], "gone": null}, "2026-11-13": {"kind": "partial", "answered": [2364663681, 3502012080, 3570982902], "gone": null}, "2026-11-14": {"kind": "shortPartial", "answered": [3763625891, 3626985555], "gone": "rotate"}, "2026-11-20": {"kind": "complete", "answered": [3954387310, 3852300679, 3866043827, 4119777660, 3991878969, 3113139051, 3193842700, 2257578285], "gone": null}, "2026-11-21": {"kind": "partial", "answered": [2246450750, 2929566715, 2736079638], "gone": null}, "2026-11-22": {"kind": "shortPartial", "answered": [3527250068, 4223952079], "gone": "knots"}};

export function v11Daily(T0) {
  const r = v2Record(T0);
  r.daily = JSON.parse(JSON.stringify(V11));
  return r;
}

export function v12Daily(T0) {
  const r = v4Filled(T0);
  r.daily = JSON.parse(JSON.stringify(Object.assign({}, V12, V12_RAMP)));
  return r;
}
