# C1 spike results: Central Point

Mode: full. Node v22.23.5. Every number is a percentage of items unless marked.
Chance = the expected hit rate of a uniformly random tap on the answer points (mean over items of |band| / points).
Shortcut picks are snapped to the nearest answer point. Seeds are strings: "<stage>|<level>|<index>" (see the code).

## A. Baseline: random items, no constraints, targets and answers on a 7×7 grid

4000 items per row (mixture of uniform, one group plus spread, two groups). "right" = total distance within the band of the best grid point.

Band 2 %:

| targets | band pts | chance | gridCentre | mean | bbox | cwm | circle | hull | medoid | nearCentre | nearMean | dense | trim1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | 1.3 | 2.7 | 7 | 31 | 15 | 75 | 11 | 30 | 80 | 46 | 80 | 30 | 31 |
| 4 | 1.9 | 3.9 | 14 | 48 | 27 | 52 | 25 | 35 | 72 | 44 | 66 | 30 | 47 |
| 5 | 1.6 | 3.3 | 15 | 48 | 21 | 75 | 19 | 33 | 69 | 40 | 65 | 27 | 50 |
| 6 | 1.7 | 3.5 | 19 | 58 | 27 | 61 | 25 | 37 | 70 | 39 | 65 | 25 | 61 |
| 7 | 1.7 | 3.5 | 19 | 60 | 27 | 74 | 25 | 38 | 68 | 37 | 63 | 22 | 63 |
| 8 | 1.7 | 3.5 | 23 | 65 | 30 | 65 | 29 | 39 | 69 | 39 | 63 | 20 | 69 |
| 9 | 1.8 | 3.6 | 25 | 69 | 31 | 76 | 31 | 41 | 69 | 36 | 63 | 22 | 73 |

Band 8 %:

| targets | band pts | chance | gridCentre | mean | bbox | cwm | circle | hull | medoid | nearCentre | nearMean | dense | trim1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | 2.8 | 5.7 | 15 | 49 | 28 | 94 | 22 | 48 | 94 | 56 | 94 | 45 | 49 |
| 4 | 4.5 | 9.2 | 33 | 82 | 53 | 85 | 49 | 69 | 95 | 61 | 90 | 48 | 78 |
| 5 | 4.2 | 8.5 | 38 | 84 | 50 | 96 | 47 | 66 | 94 | 58 | 90 | 46 | 84 |
| 6 | 4.3 | 8.8 | 41 | 88 | 55 | 92 | 53 | 70 | 95 | 60 | 91 | 46 | 91 |
| 7 | 4.5 | 9.3 | 47 | 92 | 58 | 98 | 56 | 73 | 95 | 59 | 92 | 44 | 94 |
| 8 | 4.6 | 9.4 | 51 | 94 | 61 | 95 | 61 | 74 | 96 | 63 | 92 | 44 | 97 |
| 9 | 4.7 | 9.7 | 53 | 95 | 63 | 99 | 62 | 75 | 97 | 61 | 93 | 44 | 97 |

Same items: the runner-up grid point's excess over the best (median and 10th–90th percentiles), and the share of items whose best grid point is a target.

| targets | runner-up excess, median | p10 | p90 | best point on a target |
|---|---|---|---|---|
| 3 | 6.81 % | 0.70 % | 20.30 % | 72 % |
| 4 | 2.13 % | 0.40 % | 8.96 % | 58 % |
| 5 | 2.32 % | 0.37 % | 8.65 % | 56 % |
| 6 | 2.05 % | 0.35 % | 7.36 % | 56 % |
| 7 | 2.03 % | 0.34 % | 6.65 % | 54 % |
| 8 | 1.93 % | 0.34 % | 6.04 % | 55 % |
| 9 | 1.84 % | 0.30 % | 5.71 % | 54 % |

## B. Strict policy on a 7×7 answer grid ("best point only")

60000 candidates per row. Accepted if: the best grid point is unique, no target, no pick of the 11 shortcuts, and lies within 0.3 steps of the continuous geometric median (a clean key). Then: right = the best point.

| targets | accepted | mean→key (steps) | key next to the average's pick | fixed best point | neighbour of average | average +1 step to the densest group | average +1 step away from the farthest | one Weiszfeld step | observer σ 0.3 | observer σ 0.5 | average-user σ 0.3 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | 1.86 % (1114) | 1.11 | 85 | 9 | 11 | 54 | 11 | 30 | 75 | 42 | 12 |
| 5 | 1.27 % (764) | 0.85 | 99 | 10 | 12 | 56 | 14 | 64 | 75 | 43 | 19 |
| 6 | 1.08 % (648) | 0.90 | 99 | 11 | 12 | 71 | 4 | 48 | 74 | 43 | 16 |
| 7 | 0.69 % (416) | 0.84 | 100 | 10 | 12 | 65 | 11 | 56 | 71 | 42 | 20 |
| 8 | 0.71 % (426) | 0.88 | 100 | 12 | 13 | 80 | 19 | 53 | 74 | 42 | 15 |
| 9 | 0.54 % (323) | 0.82 | 100 | 12 | 13 | 73 | 19 | 53 | 70 | 43 | 21 |

Chance here is 1/49 = 2.0 %, so the bound of standing rule 5 is 12 %.

## C. Proposed format: targets on the 7×7 dot lattice, answers on the 13×13 half-step lattice, strict policy

Per level: candidates are drawn until 10000 (rated) or 3000 (practice, excluded) are accepted under the strict policy, or 1500000 / 400000 have been tried. Sets: rated = the proposed ladder; practice = tutorial and practice cells (unrated, bounds not required); excluded = cells left out of the ladder, shown for the reason. Strict = no target and none of the 11 shortcut picks inside the band. Hard = strict, and also no corrected average (1–4 half-steps towards the densest group or away from the farthest target) and no one-step Weiszfeld point inside the band. trap = distance from the average to the continuous geometric median, in dot spacings.

| set | targets | trap ≥ | band | accepted (strict) | n | tries per item p95 | CPU ms per item mean / p95 | band pts | chance | max first-order shortcut | fixed best point | neighbour of average | ring 2 round average | average→densest +1 dot | one Weiszfeld step | hard: share of strict | observer σ 0.3 (strict / hard) | observer σ 0.5 (strict / hard) | average-user σ 0.3 | credit: observer σ 0.5 / average-user / random tap |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| rated | 4 | 1 | 1 % | 4.46 % | 10000 | 66 | 1.5 / 4.5 | 3.0 | 1.8 | 0 | 5 | 5 | 8 | 57 | 15 | 12 | 61 / 57 | 34 / 28 | 3 | 0.58 / 0.21 / 0.04 |
| rated | 5 | 1 | 1 % | 2.44 % | 10000 | 121 | 0.7 / 2.2 | 2.2 | 1.3 | 0 | 4 | 4 | 7 | 48 | 13 | 15 | 52 / 47 | 27 / 22 | 3 | 0.54 / 0.11 / 0.04 |
| rated | 6 | 1 | 1 % | 1.36 % | 10000 | 220 | 1.8 / 5.7 | 2.7 | 1.6 | 0 | 5 | 6 | 9 | 67 | 15 | 12 | 57 / 47 | 31 / 24 | 3 | 0.58 / 0.23 / 0.04 |
| rated | 7 | 1 | 1 % | 1.28 % | 10000 | 236 | 1.2 / 3.6 | 2.3 | 1.4 | 0 | 6 | 4 | 9 | 71 | 12 | 10 | 54 / 49 | 28 / 24 | 2 | 0.57 / 0.15 / 0.04 |
| rated | 8 | 1 | 1 % | 0.51 % | 7612 | 599 | 3.5 / 10.6 | 2.6 | 1.5 | 0 | 6 | 6 | 10 | 76 | 14 | 7 | 57 / 49 | 30 / 26 | 3 | 0.61 / 0.23 / 0.04 |
| rated | 4 | 1 | 0.5 % | 7.65 % | 10000 | 38 | 0.8 / 2.4 | 2.0 | 1.2 | 0 | 3 | 3 | 6 | 46 | 3 | 21 | 47 / 43 | 24 / 21 | 1 | 0.40 / 0.11 / 0.03 |
| rated | 5 | 1 | 0.5 % | 4.30 % | 10000 | 70 | 0.4 / 1.1 | 1.5 | 0.9 | 0 | 3 | 1 | 6 | 38 | 4 | 26 | 41 / 38 | 20 / 17 | 1 | 0.36 / 0.01 / 0.02 |
| rated | 6 | 1 | 0.5 % | 2.96 % | 10000 | 101 | 0.9 / 2.8 | 1.7 | 1.0 | 0 | 4 | 2 | 7 | 52 | 3 | 21 | 44 / 40 | 21 / 18 | 1 | 0.39 / 0.06 / 0.02 |
| rated | 7 | 1 | 0.5 % | 2.69 % | 10000 | 109 | 0.6 / 1.8 | 1.5 | 0.9 | 0 | 5 | 2 | 7 | 58 | 3 | 19 | 42 / 38 | 20 / 18 | 1 | 0.37 / 0.02 / 0.02 |
| rated | 8 | 1 | 0.5 % | 1.34 % | 10000 | 227 | 1.3 / 3.9 | 1.7 | 1.0 | 0 | 4 | 3 | 7 | 63 | 2 | 15 | 44 / 38 | 21 / 17 | 1 | 0.40 / 0.06 / 0.02 |
| rated | 4 | 1 | 0.25 % | 9.22 % | 10000 | 31 | 0.7 / 2.2 | 1.5 | 0.9 | 0 | 2 | 2 | 5 | 38 | 1 | 27 | 39 / 36 | 19 / 18 | 1 | 0.29 / 0.04 / 0.02 |
| rated | 5 | 1 | 0.25 % | 5.39 % | 10000 | 55 | 0.3 / 1.0 | 1.2 | 0.7 | 0 | 3 | 1 | 5 | 33 | 2 | 34 | 35 / 33 | 17 / 15 | 0 | 0.25 / 0.00 / 0.01 |
| rated | 6 | 1 | 0.25 % | 3.95 % | 10000 | 75 | 0.6 / 1.9 | 1.3 | 0.8 | 0 | 3 | 1 | 6 | 44 | 1 | 28 | 37 / 33 | 18 / 17 | 1 | 0.27 / 0.02 / 0.01 |
| rated | 7 | 1 | 0.25 % | 3.50 % | 10000 | 85 | 0.5 / 1.4 | 1.2 | 0.7 | 0 | 4 | 1 | 6 | 52 | 1 | 24 | 35 / 35 | 17 / 16 | 0 | 0.25 / 0.00 / 0.01 |
| rated | 8 | 1 | 0.25 % | 1.91 % | 10000 | 154 | 0.9 / 2.9 | 1.3 | 0.8 | 0 | 4 | 1 | 6 | 56 | 1 | 20 | 37 / 32 | 17 / 15 | 1 | 0.27 / 0.01 / 0.01 |
| practice | 3 | 0.5 | 2 % | 8.25 % | 3000 | 35 | 0.5 / 1.5 | 4.3 | 2.5 | 0 | 6 | 20 | 13 | 30 | 75 | 0 | 70 / 0 | 43 / 0 | 15 | 0.70 / 0.52 / 0.06 |
| practice | 4 | 0.5 | 2 % | 2.37 % | 3000 | 129 | 3.3 / 10.2 | 4.7 | 2.8 | 0 | 7 | 12 | 12 | 78 | 49 | 1 | 73 / 71 | 46 / 53 | 10 | 0.74 / 0.56 / 0.07 |
| practice | 5 | 0.5 | 2 % | 1.56 % | 3000 | 186 | 2.5 / 7.7 | 4.0 | 2.4 | 0 | 7 | 22 | 10 | 57 | 73 | 3 | 69 / 40 | 41 / 18 | 20 | 0.72 / 0.70 / 0.07 |
| excluded | 4 | 0.5 | 1 % | 8.60 % | 3000 | 34 | 0.9 / 2.8 | 2.6 | 1.6 | 0 | 5 | 9 | 7 | 45 | 28 | 15 | 56 / 49 | 29 / 26 | 7 | 0.55 / 0.30 / 0.04 |
| excluded | 6 | 0.5 | 1 % | 4.90 % | 3000 | 59 | 0.9 / 2.8 | 2.4 | 1.4 | 0 | 4 | 14 | 6 | 43 | 47 | 12 | 53 / 40 | 27 / 20 | 12 | 0.56 / 0.45 / 0.04 |
| excluded | 8 | 0.5 | 1 % | 2.77 % | 3000 | 107 | 1.7 / 5.4 | 2.3 | 1.4 | 0 | 6 | 14 | 7 | 48 | 48 | 10 | 55 / 44 | 29 / 18 | 11 | 0.58 / 0.48 / 0.04 |
| excluded | 4 | 1.5 | 1 % | 1.13 % | 3000 | 262 | 4.4 / 13.3 | 3.6 | 2.1 | 0 | 7 | 1 | 6 | 44 | 0 | 7 | 66 / 63 | 38 / 33 | 1 | 0.62 / 0.13 / 0.05 |
| excluded | 6 | 1.5 | 1 % | 0.12 % | 490 | 2552 | 14.7 / 45.0 | 3.4 | 2.0 | 0 | 9 | 2 | 8 | 51 | 2 | 4 | 64 / 45 | 34 / 18 | 1 | 0.59 / 0.14 / 0.05 |
| excluded | 8 | 1.5 | 1 % | 0.01 % | 26 | 34049 | 196.8 / 404.2 | 3.5 | 2.0 | 0 | 19 | 1 | 9 | 54 | 0 | 0 | 69 / 0 | 35 / 0 | 0 | 0.60 / 0.12 / 0.05 |
| excluded | 4 | 1 | 2 % | 1.59 % | 3000 | 191 | 3.9 / 12.3 | 5.3 | 3.1 | 0 | 9 | 11 | 13 | 80 | 36 | 2 | 77 / 60 | 48 / 40 | 8 | 0.76 / 0.56 / 0.08 |
| excluded | 6 | 1 | 2 % | 0.18 % | 724 | 1619 | 13.5 / 41.2 | 4.9 | 2.9 | 0 | 10 | 14 | 14 | 89 | 56 | 1 | 76 / 29 | 48 / 57 | 12 | 0.80 / 0.63 / 0.08 |
| excluded | 8 | 1 | 2 % | 0.04 % | 149 | 7690 | 46.0 / 147.8 | 5.0 | 3.0 | 0 | 14 | 14 | 15 | 88 | 48 | 0 | 83 / 0 | 48 / 0 | 8 | 0.83 / 0.63 / 0.08 |

Checks over every accepted item (independent of the acceptance rules):

| set | targets | trap ≥ | band | n | continuous median worse than the best lattice point | best point more than half a dot from the continuous median | largest distance (dots) | empty band |
|---|---|---|---|---|---|---|---|---|
| rated | 4 | 1 | 1 % | 10000 | 0 | 0 | 0.45 | 0 |
| rated | 5 | 1 | 1 % | 10000 | 0 | 0 | 0.41 | 0 |
| rated | 6 | 1 | 1 % | 10000 | 0 | 2 | 0.50 | 0 |
| rated | 7 | 1 | 1 % | 10000 | 0 | 0 | 0.42 | 0 |
| rated | 8 | 1 | 1 % | 7612 | 0 | 0 | 0.45 | 0 |
| rated | 4 | 1 | 0.5 % | 10000 | 0 | 83 | 0.58 | 0 |
| rated | 5 | 1 | 0.5 % | 10000 | 0 | 0 | 0.44 | 0 |
| rated | 6 | 1 | 0.5 % | 10000 | 0 | 8 | 0.62 | 0 |
| rated | 7 | 1 | 0.5 % | 10000 | 0 | 0 | 0.46 | 0 |
| rated | 8 | 1 | 0.5 % | 10000 | 0 | 1 | 0.50 | 0 |
| rated | 4 | 1 | 0.25 % | 10000 | 0 | 99 | 0.58 | 0 |
| rated | 5 | 1 | 0.25 % | 10000 | 0 | 0 | 0.46 | 0 |
| rated | 6 | 1 | 0.25 % | 10000 | 0 | 34 | 0.62 | 0 |
| rated | 7 | 1 | 0.25 % | 10000 | 0 | 0 | 0.47 | 0 |
| rated | 8 | 1 | 0.25 % | 10000 | 0 | 11 | 0.55 | 0 |
| practice | 3 | 0.5 | 2 % | 3000 | 0 | 0 | 0.32 | 0 |
| practice | 4 | 0.5 | 2 % | 3000 | 0 | 0 | 0.36 | 0 |
| practice | 5 | 0.5 | 2 % | 3000 | 0 | 0 | 0.42 | 0 |
| excluded | 4 | 0.5 | 1 % | 3000 | 0 | 0 | 0.45 | 0 |
| excluded | 6 | 0.5 | 1 % | 3000 | 0 | 1 | 0.52 | 0 |
| excluded | 8 | 0.5 | 1 % | 3000 | 0 | 0 | 0.41 | 0 |
| excluded | 4 | 1.5 | 1 % | 3000 | 0 | 0 | 0.36 | 0 |
| excluded | 6 | 1.5 | 1 % | 490 | 0 | 0 | 0.42 | 0 |
| excluded | 8 | 1.5 | 1 % | 26 | 0 | 0 | 0.38 | 0 |
| excluded | 4 | 1 | 2 % | 3000 | 0 | 0 | 0.35 | 0 |
| excluded | 6 | 1 | 2 % | 724 | 0 | 0 | 0.41 | 0 |
| excluded | 8 | 1 | 2 % | 149 | 0 | 0 | 0.36 | 0 |

Keys on half-step positions (between dots), per level: 4/1/1%: 79 %; 5/1/1%: 90 %; 6/1/1%: 83 %; 7/1/1%: 92 %; 8/1/1%: 81 %; 4/1/0.5%: 81 %; 5/1/0.5%: 92 %; 6/1/0.5%: 85 %; 7/1/0.5%: 94 %; 8/1/0.5%: 85 %; 4/1/0.25%: 81 %; 5/1/0.25%: 92 %; 6/1/0.25%: 85 %; 7/1/0.25%: 95 %; 8/1/0.25%: 87 %; 3/0.5/2%: 64 %; 4/0.5/2%: 83 %; 5/0.5/2%: 80 %; 4/0.5/1%: 83 %; 6/0.5/1%: 83 %; 8/0.5/1%: 81 %; 4/1.5/1%: 70 %; 6/1.5/1%: 80 %; 8/1.5/1%: 69 %; 4/1/2%: 82 %; 6/1/2%: 76 %; 8/1/2%: 72 %.

## D. Minimax over item pools: which acceptance policy bounds the shortcuts at each level

One pool of 150000 candidates per level (half-step answers); each policy accepts a subset. Bounded set = the 11 shortcuts, the fixed best point and "a neighbour of the average's pick". Advantage = hit rate − chance, in points; the standing rule allows 10.

| targets | trap ≥ | band | policy | accepted | chance | worst shortcut (advantage) | neighbour of average (adv.) | fixed point (adv.) | max advantage | within 10? |
|---|---|---|---|---|---|---|---|---|---|---|
| 4 | 0.5 | 0.5 % | trapOnly | 72.00 % | 1.0 | medoid (56) | 7 | 3 | 56 | no |
| 4 | 0.5 | 0.5 % | outlierOnly | 51.69 % | 0.9 | medoid (55) | 6 | 3 | 55 | no |
| 4 | 0.5 | 0.5 % | strict | 15.56 % | 1.1 | gridCentre (-1) | 6 | 2 | 6 | yes |
| 4 | 0.5 | 0.5 % | hard | 4.09 % | 0.9 | gridCentre (-1) | 5 | 2 | 5 | yes |
| 6 | 0.5 | 0.5 % | trapOnly | 58.54 % | 1.0 | medoid (47) | 10 | 3 | 47 | no |
| 6 | 0.5 | 0.5 % | outlierOnly | 35.15 % | 0.9 | medoid (51) | 8 | 3 | 51 | no |
| 6 | 0.5 | 0.5 % | strict | 11.21 % | 0.9 | gridCentre (-1) | 9 | 2 | 9 | yes |
| 6 | 0.5 | 0.5 % | hard | 2.68 % | 0.8 | gridCentre (-1) | 8 | 2 | 8 | yes |
| 8 | 0.5 | 0.5 % | trapOnly | 49.41 % | 1.0 | medoid (48) | 11 | 4 | 48 | no |
| 8 | 0.5 | 0.5 % | outlierOnly | 29.72 % | 0.9 | medoid (56) | 8 | 4 | 56 | no |
| 8 | 0.5 | 0.5 % | strict | 7.62 % | 0.9 | gridCentre (-1) | 9 | 2 | 9 | yes |
| 8 | 0.5 | 0.5 % | hard | 1.67 % | 0.7 | gridCentre (-1) | 8 | 3 | 8 | yes |
| 4 | 1 | 0.5 % | trapOnly | 33.11 % | 1.1 | medoid (65) | 2 | 2 | 65 | no |
| 4 | 1 | 0.5 % | outlierOnly | 24.02 % | 1.0 | medoid (62) | 1 | 2 | 62 | no |
| 4 | 1 | 0.5 % | strict | 7.57 % | 1.2 | gridCentre (-1) | 2 | 2 | 2 | yes |
| 4 | 1 | 0.5 % | hard | 1.58 % | 1.0 | gridCentre (-1) | 1 | 3 | 3 | yes |
| 6 | 1 | 0.5 % | trapOnly | 13.73 % | 1.0 | medoid (59) | 2 | 3 | 59 | no |
| 6 | 1 | 0.5 % | outlierOnly | 10.66 % | 0.9 | medoid (62) | 1 | 3 | 62 | no |
| 6 | 1 | 0.5 % | strict | 2.99 % | 1.0 | gridCentre (-1) | 1 | 3 | 3 | yes |
| 6 | 1 | 0.5 % | hard | 0.63 % | 0.8 | gridCentre (-1) | 0 | 3 | 3 | yes |
| 8 | 1 | 0.5 % | trapOnly | 7.72 % | 0.9 | medoid (67) | 2 | 5 | 67 | no |
| 8 | 1 | 0.5 % | outlierOnly | 6.64 % | 0.9 | medoid (68) | 1 | 5 | 68 | no |
| 8 | 1 | 0.5 % | strict | 1.31 % | 1.0 | gridCentre (-1) | 2 | 4 | 4 | yes |
| 8 | 1 | 0.5 % | hard | 0.19 % | 0.8 | gridCentre (-1) | 0 | 4 | 4 | yes |
| 4 | 0.5 | 1 % | trapOnly | 72.05 % | 1.6 | medoid (61) | 11 | 5 | 61 | no |
| 4 | 0.5 | 1 % | outlierOnly | 43.66 % | 1.2 | medoid (63) | 8 | 4 | 63 | no |
| 4 | 0.5 | 1 % | strict | 8.53 % | 1.6 | gridCentre (-2) | 8 | 3 | 8 | yes |
| 4 | 0.5 | 1 % | hard | 1.28 % | 1.2 | gridCentre (-1) | 6 | 3 | 6 | yes |
| 6 | 0.5 | 1 % | trapOnly | 58.63 % | 1.5 | medoid (55) | 14 | 4 | 55 | no |
| 6 | 0.5 | 1 % | outlierOnly | 27.31 % | 1.2 | medoid (64) | 10 | 4 | 64 | no |
| 6 | 0.5 | 1 % | strict | 4.90 % | 1.4 | gridCentre (-1) | 12 | 3 | 12 | no |
| 6 | 0.5 | 1 % | hard | 0.56 % | 1.0 | gridCentre (-1) | 9 | 2 | 9 | yes |
| 8 | 0.5 | 1 % | trapOnly | 49.37 % | 1.5 | medoid (55) | 15 | 5 | 55 | no |
| 8 | 0.5 | 1 % | outlierOnly | 21.99 % | 1.1 | medoid (70) | 10 | 5 | 70 | no |
| 8 | 0.5 | 1 % | strict | 2.81 % | 1.4 | gridCentre (-1) | 13 | 4 | 13 | no |
| 8 | 0.5 | 1 % | hard | 0.26 % | 0.9 | gridCentre (-1) | 10 | 4 | 10 | no |
| 4 | 1 | 1 % | trapOnly | 33.18 % | 1.6 | medoid (71) | 6 | 3 | 71 | no |
| 4 | 1 | 1 % | outlierOnly | 21.40 % | 1.3 | medoid (70) | 3 | 3 | 70 | no |
| 4 | 1 | 1 % | strict | 4.51 % | 1.8 | gridCentre (-2) | 3 | 3 | 3 | yes |
| 4 | 1 | 1 % | hard | 0.55 % | 1.5 | gridCentre (-1) | 3 | 6 | 6 | yes |
| 6 | 1 | 1 % | trapOnly | 13.37 % | 1.5 | medoid (65) | 4 | 3 | 65 | no |
| 6 | 1 | 1 % | outlierOnly | 8.52 % | 1.2 | medoid (72) | 2 | 4 | 72 | no |
| 6 | 1 | 1 % | strict | 1.38 % | 1.6 | gridCentre (-2) | 4 | 4 | 4 | yes |
| 6 | 1 | 1 % | hard | 0.15 % | 1.1 | gridCentre (-1) | 3 | 5 | 5 | yes |
| 8 | 1 | 1 % | trapOnly | 7.74 % | 1.4 | medoid (76) | 4 | 6 | 76 | no |
| 8 | 1 | 1 % | outlierOnly | 5.60 % | 1.2 | medoid (79) | 2 | 6 | 79 | no |
| 8 | 1 | 1 % | strict | 0.48 % | 1.5 | gridCentre (-1) | 4 | 5 | 5 | yes |
| 8 | 1 | 1 % | hard | 0.04 % | 1.0 | gridCentre (-1) | 2 | 8 | 8 | yes |
| 4 | 0.5 | 2 % | trapOnly | 71.79 % | 2.7 | medoid (69) | 20 | 7 | 69 | no |
| 4 | 0.5 | 2 % | outlierOnly | 30.93 % | 1.6 | medoid (79) | 10 | 4 | 79 | no |
| 4 | 0.5 | 2 % | strict | 2.42 % | 2.7 | gridCentre (-3) | 10 | 5 | 10 | yes |
| 4 | 0.5 | 2 % | hard | 0.02 % | 2.7 | gridCentre (-3) | 4 | 15 | 15 | no |
| 6 | 0.5 | 2 % | trapOnly | 58.72 % | 2.5 | medoid (65) | 22 | 7 | 65 | no |
| 6 | 0.5 | 2 % | outlierOnly | 15.08 % | 1.6 | medoid (85) | 13 | 4 | 85 | no |
| 6 | 0.5 | 2 % | strict | 0.62 % | 2.3 | gridCentre (-2) | 18 | 6 | 18 | no |
| 6 | 0.5 | 2 % | hard | 0.01 % | 1.1 | gridCentre (-1) | 11 | 20 | 20 | no |
| 8 | 0.5 | 2 % | trapOnly | 49.52 % | 2.6 | cwm (75) | 24 | 7 | 75 | no |
| 8 | 0.5 | 2 % | outlierOnly | 10.68 % | 1.6 | medoid (90) | 12 | 5 | 90 | no |
| 8 | 0.5 | 2 % | strict | 0.18 % | 2.6 | gridCentre (-3) | 19 | 10 | 19 | no |
| 8 | 0.5 | 2 % | hard | 0.00 % | 2.4 | gridCentre (-2) | 10 | 64 | 64 | no |
| 4 | 1 | 2 % | trapOnly | 32.90 % | 2.9 | medoid (78) | 15 | 5 | 78 | no |
| 4 | 1 | 2 % | outlierOnly | 15.61 % | 1.8 | medoid (81) | 5 | 4 | 81 | no |
| 4 | 1 | 2 % | strict | 1.55 % | 3.2 | gridCentre (-3) | 8 | 6 | 8 | yes |
| 4 | 1 | 2 % | hard | 0.02 % | 2.7 | gridCentre (-3) | 4 | 23 | 23 | no |
| 6 | 1 | 2 % | trapOnly | 13.65 % | 2.6 | medoid (77) | 12 | 4 | 77 | no |
| 6 | 1 | 2 % | outlierOnly | 5.28 % | 1.7 | medoid (88) | 6 | 5 | 88 | no |
| 6 | 1 | 2 % | strict | 0.19 % | 2.9 | gridCentre (-3) | 11 | 7 | 11 | no |
| 6 | 1 | 2 % | hard | 0.00 % | 2.5 | gridCentre (-2) | 6 | 14 | 14 | no |
| 8 | 1 | 2 % | trapOnly | 7.88 % | 2.4 | medoid (85) | 12 | 6 | 85 | no |
| 8 | 1 | 2 % | outlierOnly | 3.31 % | 1.8 | medoid (92) | 6 | 7 | 92 | no |
| 8 | 1 | 2 % | strict | 0.04 % | 2.9 | gridCentre (-3) | 11 | 21 | 21 | no |
| 8 | 1 | 2 % | hard | 0 | – | – | – | – | – | no items |

Minimax per level (policy with the smallest worst-case advantage among those accepting at least 0.2 % of candidates):

| targets | trap ≥ | band | minimax policy | worst-case advantage (points) |
|---|---|---|---|---|
| 4 | 0.5 | 0.5 % | hard | 5 |
| 6 | 0.5 | 0.5 % | hard | 8 |
| 8 | 0.5 | 0.5 % | hard | 8 |
| 4 | 1 | 0.5 % | strict | 2 |
| 6 | 1 | 0.5 % | strict | 3 |
| 8 | 1 | 0.5 % | strict | 4 |
| 4 | 0.5 | 1 % | hard | 6 |
| 6 | 0.5 | 1 % | hard | 9 |
| 8 | 0.5 | 1 % | hard | 10 |
| 4 | 1 | 1 % | strict | 3 |
| 6 | 1 | 1 % | strict | 4 |
| 8 | 1 | 1 % | strict | 5 |
| 4 | 0.5 | 2 % | strict | 10 |
| 6 | 0.5 | 2 % | strict | 18 |
| 8 | 0.5 | 2 % | trapOnly | 75 |
| 4 | 1 | 2 % | strict | 8 |
| 6 | 1 | 2 % | trapOnly | 77 |
| 8 | 1 | 2 % | trapOnly | 85 |

## F. What each dim does to each shortcut on its own (no exclusion, half-step answers)

30000 candidates per row; only the trap minimum filters items. Cells: hit rate in % (chance in the first column). A dim "bounds" a shortcut when its hit rate falls to within 10 points of chance.

Sweep: trap minimum (6 targets, band 1 %)

| level | items | chance | gridCentre | mean | bbox | cwm | circle | hull | medoid | nearCentre | nearMean | dense | trim1 | neighbour of average |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| trap ≥ 0 | 30000 | 1.5 | 10 | 36 | 14 | 50 | 12 | 19 | 50 | 29 | 46 | 6 | 38 | 18 |
| trap ≥ 0.5 | 17448 | 1.5 | 5 | 13 | 4 | 44 | 4 | 4 | 55 | 31 | 50 | 5 | 44 | 15 |
| trap ≥ 1 | 4001 | 1.5 | 1 | 4 | 1 | 36 | 1 | 1 | 67 | 35 | 58 | 4 | 33 | 6 |
| trap ≥ 1.5 | 373 | 1.4 | 0 | 2 | 1 | 16 | 1 | 1 | 83 | 47 | 73 | 2 | 12 | 2 |
| trap ≥ 2 | 14 | 2.1 | 0 | 0 | 0 | 0 | 0 | 0 | 100 | 43 | 79 | 0 | 50 | 3 |

Sweep: band (6 targets, trap ≥ 1)

| level | items | chance | gridCentre | mean | bbox | cwm | circle | hull | medoid | nearCentre | nearMean | dense | trim1 | neighbour of average |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| band 0.25 % | 4065 | 0.8 | 0 | 0 | 0 | 21 | 0 | 0 | 56 | 30 | 49 | 3 | 14 | 1 |
| band 0.5 % | 3962 | 1.0 | 0 | 1 | 0 | 25 | 0 | 0 | 59 | 32 | 52 | 3 | 20 | 3 |
| band 1 % | 4001 | 1.5 | 1 | 4 | 1 | 36 | 1 | 1 | 67 | 35 | 58 | 4 | 33 | 6 |
| band 2 % | 4021 | 2.5 | 4 | 13 | 4 | 57 | 3 | 4 | 79 | 41 | 68 | 7 | 54 | 15 |
| band 4 % | 4018 | 4.9 | 11 | 40 | 13 | 85 | 12 | 16 | 93 | 48 | 80 | 18 | 81 | 34 |

Sweep: targets (band 1 %, trap ≥ 1)

| level | items | chance | gridCentre | mean | bbox | cwm | circle | hull | medoid | nearCentre | nearMean | dense | trim1 | neighbour of average |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 targets | 9956 | 1.6 | 3 | 10 | 5 | 22 | 4 | 5 | 73 | 43 | 63 | 12 | 23 | 8 |
| 5 targets | 5226 | 1.3 | 1 | 0 | 0 | 62 | 0 | 0 | 65 | 38 | 62 | 6 | 30 | 4 |
| 6 targets | 4001 | 1.5 | 1 | 4 | 1 | 36 | 1 | 1 | 67 | 35 | 58 | 4 | 33 | 6 |
| 7 targets | 3296 | 1.3 | 0 | 0 | 0 | 70 | 0 | 0 | 73 | 35 | 65 | 2 | 22 | 4 |
| 8 targets | 2400 | 1.4 | 0 | 1 | 0 | 57 | 0 | 0 | 77 | 29 | 62 | 5 | 23 | 6 |

## E. Checks of the mathematics used in the teaching texts, and of the solver

- Pulls cancel: over 7838 interior medians of random sets (3–9 points; medians at a target are recognised by the subgradient condition and left out), the largest |sum of unit vectors| after Weiszfeld and Newton refinement was 7.3e-8.
- Slide the outlier: moving every target along its ray from the median by a factor 0.3–3 moved the median by at most 1.2e-9 (7838 sets).
- Half or more in one place: a target with weight k against k−1 targets of weight 1 (more than half of the total) was the median in 10000 of 10000 sets.
- Cross the pairs: for 10000 four-point sets on two crossing segments, the median was at the crossing within 6.2e-10.
- Three targets: 6013 triangles with all angles under 120° had 120° angles at the median within 1.1e-8°; 3985 of 3985 triangles with an angle of 120° or more had the median at that corner.

Run time: 395 s.
