/* EX-05 Nets: tutorial data (pure, data only; ARCHITECTURE.md §2, PLAN.md §8).
   Watch–Try–Go: a goal per variant and labelled parts → demo (view.demo plays it with
   `captions`) → practice items (not logged) with just-in-time tips → an easy scored start.
   Shapes as in js/ex/rotate/learn.js, plus `offscreen`: an optional challenge with real paper.
   Wording rules (CLAUDE.md 2, 12): about the task, never the person; no IQ or "mastered". */
(function (PX) {
  'use strict';

  PX.ex.learn('nets', {
    goal: 'Fold the net into a cube in your mind and answer the question about it.',
    goals: {
      opposite: 'Fold the net into a cube in your mind. Which face ends up opposite the marked face?',
      edges: 'Fold the net into a cube in your mind. Do the two thick edges meet?',
      cube: 'Does this net fold into a closed cube, with every square on a side of its own?',
    },
    parts: [
      { id: 'net', label: 'Net', text: 'Six squares joined at their edges. Dashed lines are folds: the paper bends there.' },
      { id: 'marked', label: 'Marked face', variant: 'opposite', text: 'The square with the thick frame stays on the table while the others fold up around it.' },
      { id: 'base', label: 'Shaded square', variant: 'edges', text: 'The shaded square stays on the table while the others fold up around it.' },
      { id: 'edges', label: 'Thick edges', variant: 'edges', text: 'Two edges drawn thick. They meet when they become the same edge of the cube.' },
      { id: 'options', label: 'Answers', text: 'Four faces to choose from, or Yes and No.' },
      { id: 'answer', label: 'Answer', text: 'Pick with the number keys (1 = Yes, 2 = No), or tap.' },
    ],
    // Easiest levels: few squares carried, nets with a long row.
    demo: [
      { params: { variant: 'opposite', carried: 0, shape: 0, between: 0 }, seed: 1, kind: 'opposite' },
      { params: { variant: 'edges', carried: 0, shape: 0, between: 0 }, seed: 5, kind: 'meet' },
      { params: { variant: 'cube', carried: 0, shape: 0, between: 0 }, seed: 5, kind: 'net' },
    ],
    practice: [
      { variant: 'opposite', carried: 0, shape: 0, between: 0 },
      { variant: 'edges', carried: 0, shape: 0, between: 0 },
      { variant: 'cube', carried: 0, shape: 0, between: 0 },
      { variant: 'opposite', carried: 1, shape: 1, between: 0 },
      { variant: 'edges', carried: 1, shape: 1, between: 0 },
    ],
    tips: [
      { id: 'opposite', when: { variant: 'opposite' }, text: 'A square that touches the marked square in the net is never opposite it. Fold the others step by step.' },
      { id: 'edges', when: { variant: 'edges' }, text: 'Keep the shaded square still and fold the others up one at a time; watch where each thick edge goes.' },
      { id: 'cube', when: { variant: 'cube' }, text: 'A net folds into a cube only when every square gets a side of its own: look for two squares that land on the same side.' },
      { id: 'carried', when: { dim: 'carried', levels: [2, 3, 4] }, text: 'Many squares move together here. Fold one hinge at a time and carry the attached squares along.' },
      { id: 'stairs', when: { dim: 'shape', levels: [2] }, text: 'Staircase nets have no long row, so the row rules do not help: fold one step at a time.' },
      { id: 'between', when: { dim: 'between', levels: [1] }, text: 'The square farthest from the marked one is not always opposite it. Fold to check.' },
    ],
    // Shepard & Feng 1972: the time to decide whether two marked edges meet rises with the
    // number of squares carried during folding, so solvers fold mentally step by step. Burte et al.
    // 2019 (Make-A-Dice): nets with long rows allow shortcuts, hence the rule card and the
    // staircase level (research/B §3).
    strategies: [
      {
        id: 'imagery', title: 'Fold it in your mind',
        text: 'Keep one square flat on the table and fold the others up around it, one hinge at a time, carrying the squares attached to each one.',
        steps: [
          'Start from the square that stays down (the marked or shaded one).',
          'Fold its neighbours up one at a time; the squares attached to them come along.',
          'Check where the face or the edges you need end up.',
        ],
        when: 'Works on every net; slower when many squares are carried.',
      },
      {
        id: 'analytic', title: 'Use what nets always do',
        text: 'A few facts about nets settle part of the question without folding everything.',
        steps: [
          'Two squares joined in the net are never opposite on the cube.',
          'In a straight row of three squares, the two ends are opposite.',
          'Two edges that form an inside corner of the net always meet.',
        ],
        when: 'Fast where the net has rows and inside corners; fold the rest.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Use a fact when one fits, and fold when none does.',
        steps: [
          'If no fact fits, fold step by step from the base.',
          'If folding gets crowded, look for a row of three or an inside corner.',
          'After a miss, use Show me to see where the squares go.',
        ],
        when: 'After two misses in a row, try the other way on the next net.',
      },
    ],
    captions: {
      net: 'The net: six squares joined at folds (the dashed lines).',
      marked: 'The marked square stays on the table.',
      base: 'The shaded square stays on the table.',
      edges: 'Two thick edges: do they meet once the net is folded?',
      options: 'Four faces to choose from.',
      question: 'Does it fold into a closed cube?',
      tilt: 'Tilt the view to watch the folds.',
      fold: 'Fold up the next squares ({n} of {m}).',
      opposite: 'Face {n} ends up on top, opposite the marked face.',
      meet: 'The two thick edges come together: they meet.',
      apart: 'The two thick edges end up on different edges of the cube: they do not meet.',
      closes: 'All six squares close the cube, so it is a net.',
      overlap: 'Squares {n} land on the same side and one side stays open: not a net of a cube.',
      block: 'Four squares meet at one corner, but a corner of a cube has only three faces.',
      answer: 'Answer: {n}.',
    },
    bridge: 'Packaging designers, architects and sheet-metal workers picture how flat patterns fold into boxes. Practice here improves this kind of task and often similar ones; it has not been shown to improve grades or job performance.',
    offscreen: {
      title: 'Cut out and fold a net',
      text: 'Copy a net onto squared paper, predict the answer, then cut it out and fold it.',
      steps: [
        'Copy one of the nets onto squared paper or card, about 3 cm per square, with its letters or thick edges.',
        'Write down your prediction: which face is opposite, which edges meet, or whether it closes.',
        'Cut it out, fold along the lines and hold it together with tape.',
        'Try a shape you think does not fold into a cube, and see where it fails.',
      ],
      note: 'In a study of 182 children, practice with paper and with screens both improved spatial skill; hands-on materials gave larger maths gains (Gilligan-Lee et al. 2023).',
    },
  });
})(window.PX);
