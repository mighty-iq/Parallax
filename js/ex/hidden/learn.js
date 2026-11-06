/* EX-10 Hidden Shapes: tutorial data (pure, data only; ARCHITECTURE.md §2, PLAN.md §8; shapes as in
   js/ex/rotate/learn.js). Watch–Try–Go: goal and labelled parts → demo (view.demo walks through
   the item with `captions`) → practice items (not logged) with just-in-time tips → an easy scored
   start. demo[].kind says what the seed gives (tested in tests/node/hidden.test.mjs): 'low' means
   low similarity (the options differ in arrangement only).
   Wording rules (CLAUDE.md 2, 12): about the task, never the person; no IQ or "mastered". */
(function (PX) {
  'use strict';

  PX.ex.learn('hidden', {
    goal: 'Which of the five shapes is hidden in the figure? Same size, same way up.',
    parts: [
      { id: 'figure', label: 'Figure', text: 'A drawing made of short straight lines between the dots of a grid.' },
      { id: 'shapes', label: 'Shapes', text: 'Five small shapes, drawn at the same size as the figure. Exactly one of them is hidden in it, the same way up.' },
      { id: 'rule', label: 'The rule', text: 'Every line of the shape must be a line of the figure. The figure’s lines may run on past the shape’s ends, and other lines may touch it.' },
      { id: 'answer', label: 'Answer', text: 'Tap the shape, or press its number (1–5).' },
    ],
    // The easiest setting: few extra lines, shapes that differ in arrangement only.
    demo: [
      { params: { extra: 0, sim: 0, size: 0 }, seed: 2, kind: 'low' },
    ],
    practice: [
      { extra: 0, sim: 0, size: 0 },
      { extra: 1, sim: 0, size: 0 },
      { extra: 0, sim: 1, size: 0 },
      { extra: 1, sim: 1, size: 1 },
    ],
    tips: [
      { id: 'medium', when: { dim: 'sim', levels: [1] }, text: 'These shapes look alike: two neighbouring lines are swapped. Compare the corners.' },
      { id: 'similar', when: { dim: 'sim', levels: [2] }, text: 'These shapes differ by one line. Check every line of a shape, the last one too.' },
      { id: 'busy', when: { dim: 'extra', levels: [3, 4, 5] }, text: 'A busy figure: find one unusual part of a shape first, such as a slant or a tight corner, then check the rest from there.' },
      { id: 'large', when: { dim: 'size', levels: [2] }, text: 'A bigger figure: scan it in strips, so no corner is left out.' },
    ],
    // Disembedding means seeing a part apart from the whole it belongs to (research/B-tasks.md
    // §8). Both ways below are described in embedded-figures work: holding the simple figure as a
    // whole, or searching for a distinctive feature and verifying [DJ: the switching rule].
    strategies: [
      {
        id: 'imagery', title: 'Slide the shape over the figure',
        text: 'Hold the shape in mind as one picture and move it over the figure, place by place, until every one of its lines sits on a line.',
        steps: [
          'Look at the shape until you can see it with your eyes closed.',
          'Move it over the figure in your mind, one grid step at a time.',
          'Stop where all its lines land on lines; check once more, line by line.',
        ],
        when: 'Quick when the figure is small or not too busy.',
      },
      {
        id: 'analytic', title: 'Anchor on one part',
        text: 'Pick the most unusual part of a shape (a slant, a tight corner) and find every place where that part occurs in the figure. Check the remaining lines there one by one.',
        steps: [
          'Choose one distinctive part of the shape.',
          'Find each place in the figure where that part appears.',
          'At each place, check every other line; one missing line rules the place out.',
        ],
        when: 'Steady for busy figures and for shapes that differ by one line.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Neither way is always better: when one stalls, try the other.',
        steps: [
          'If sliding the whole shape keeps getting lost in the lines, anchor on one part.',
          'If checking part by part gets slow, step back and look for the whole shape.',
          'Lines that run on past a shape are allowed: do not let them hide it.',
        ],
        when: 'After two misses in a row, try the other way on the next item.',
      },
    ],
    captions: {
      figure: 'This is the figure: short lines between the dots of a grid.',
      shapes: 'One of these five shapes is hidden in it: same size, same way up.',
      found: 'Shape {n} is here: every one of its lines is a line of the figure.',
      runOn: 'Lines of the figure may run on past the shape and touch it: it still counts.',
      notFit: 'Shape {n} does not fit: at its best place, the dashed line is missing.',
      notFitMany: 'Shape {n} does not fit: at its best place, the dashed lines are missing.',
      only: 'Only shape {n} fits everywhere.',
    },
    bridge: 'Picking one part out of a busy picture is part of reading technical drawings, maps and diagrams. Practising here improves this task and often similar ones; it has not been shown to improve grades or job performance.',
  });
})(window.PX);
