/* EX-04 Fold: tutorial data (pure, data only; ARCHITECTURE.md §2, PLAN.md §8).
   Watch–Try–Go: goal and labelled parts → demo (view.demo plays it with `captions`) →
   practice items (not logged) with just-in-time tips → an easy scored start. Shapes as in
   js/ex/rotate/learn.js, plus `offscreen`: an optional challenge with real paper.
   Wording rules (CLAUDE.md 2, 12): about the task, never the person; no IQ or "mastered". */
(function (PX) {
  'use strict';

  PX.ex.learn('fold', {
    goal: 'The sheet is folded, then punched through every layer. Which sheet do you get when you unfold it?',
    parts: [
      { id: 'folds', label: 'Folds', text: 'One panel per fold: the dashed line is the crease, the shaded part is the flap and the arrow shows where it goes.' },
      { id: 'punch', label: 'Punch', text: 'The last panel shows the folded paper and the punch. A punch goes through every layer under it.' },
      { id: 'options', label: 'Unfolded sheets', text: 'Four or five sheets, all with the same number of holes. Exactly one is the sheet you get.' },
      { id: 'answer', label: 'Answer', text: 'Pick a sheet with keys 1–5, or tap it.' },
    ],
    // The easiest level: one fold through the middle, one punch, two holes.
    demo: [
      { params: { folds: 0, type: 0, punches: 0, idle: 0 }, seed: 4, kind: 'half' },
      { params: { folds: 0, type: 0, punches: 0, idle: 0 }, seed: 9, kind: 'half' },
    ],
    practice: [
      { folds: 0, type: 0, punches: 0, idle: 0 },
      { folds: 0, type: 1, punches: 0, idle: 0 },
      { folds: 1, type: 0, punches: 0, idle: 0 },
      { folds: 0, type: 2, punches: 0, idle: 0 },
      { folds: 1, type: 0, punches: 1, idle: 0 },
    ],
    tips: [
      { id: 'corner', when: { dim: 'type', levels: [1] }, text: 'A corner fold covers only part of the paper: only holes punched through the corner flap get a twin.' },
      { id: 'diagonal', when: { dim: 'type', levels: [2, 3] }, text: 'A diagonal crease mirrors on the slant: a hole moves straight across the crease to the same distance on the other side.' },
      { id: 'many', when: { dim: 'folds', levels: [1, 2, 3, 4] }, text: 'Unfold in reverse order, the last fold first. Each unfold copies the holes on its flap across its crease.' },
      { id: 'punches', when: { dim: 'punches', levels: [1, 2] }, text: 'Each punch makes its own group of holes. Unfold one punch at a time.' },
      { id: 'idle', when: { dim: 'idle', levels: [1, 2] }, text: 'Not every fold adds holes: when no punch goes through a flap, unfolding it changes nothing.' },
      { id: 'five', when: { dim: 'folds', levels: [3, 4] }, text: 'Five sheets now. They all have the same number of holes, so check where the holes are, not how many.' },
    ],
    // Burte et al. 2018: a "count folds × 2 holes" heuristic fit behaviour best; only about 22 %
    // of solvers mainly unfolded, and the number of folds relevant to the answer predicts
    // accuracy better than the total. Wright et al. 2008: paper-folding and mental-rotation
    // practice transferred to each other more than to a verbal control (research/B §2, §3).
    strategies: [
      {
        id: 'imagery', title: 'Unfold it in your mind',
        text: 'Start from the punched paper and undo the folds one by one, the last fold first, watching the holes travel with the paper.',
        steps: [
          'Picture the punched paper as it is in the last panel.',
          'Lift the last flap back over its crease: every hole on the flap now has a twin on the other side.',
          'Keep unfolding until the sheet is flat, then find the sheet with exactly those holes.',
        ],
        when: 'Quick when there are few folds and the flaps are large.',
      },
      {
        id: 'analytic', title: 'Follow one hole at a time',
        text: 'Pick one punch and work out every place it reaches, one crease at a time, before you look at the options.',
        steps: [
          'Which flaps lie under this punch? Only those folds add holes for it.',
          'Mirror the hole across each of those creases, the last fold first: same distance from the crease, on the other side.',
          'Do the same for the other punches, then check one option hole by hole.',
        ],
        when: 'Steady for corner and diagonal folds, and when several punches overlap.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Both ways work. The count of holes never decides here: every sheet has the same number.',
        steps: [
          'If the picture of the flaps gets crowded, switch to following one hole.',
          'If following holes gets slow, unfold the whole sheet in your mind for a quick check.',
          'Check the options that look almost alike hole by hole.',
        ],
        when: 'After two misses in a row, try the other way on the next sheet.',
      },
    ],
    captions: {
      folds: 'These panels show the folds, one at a time: crease dashed, flap shaded.',
      punch: 'The last panel shows where the folded paper is punched.',
      options: 'Every sheet below has the same number of holes. One of them is right.',
      punched: 'The punch goes through {n} layers of paper.',
      punchedMany: 'The punches go through {n} layers of paper in all.',
      unfold: 'Unfold fold {n}: each hole on the flap gets a twin across the crease.',
      unfoldIdle: 'Unfold fold {n}: no punch went through this flap, so no new holes.',
      done: 'Flat again. Sheet {n} has exactly these holes.',
      chosen: 'Sheet {n}: the dashed rings are holes these folds do not make ({why}).',
    },
    bridge: 'Designers of packaging, sheet-metal parts and folding structures picture flat patterns folding and unfolding. Practice here improves this kind of task and often similar ones; it has not been shown to improve grades or job performance.',
    offscreen: {
      title: 'Fold and punch a real sheet',
      text: 'Take a square of paper, fold it like one of the items, punch it, and predict the holes before you open it.',
      steps: [
        'Fold a square sheet in half, then fold a corner over.',
        'Punch one hole through all the layers with a hole punch, a pen or a pin.',
        'Draw the holes you expect on a second square, then unfold the sheet and compare.',
        'Try again with a diagonal fold, or with two punches.',
      ],
      note: 'Hands-on folding came with gains on paper-folding tests in a classroom programme (Burte et al. 2017, no control group).',
    },
  });
})(window.PX);
