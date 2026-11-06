/* EX-03 Spin: tutorial data (pure, data only; ARCHITECTURE.md §2, PLAN.md §8; shapes as in
   js/ex/rotate/learn.js). Watch–Try–Go: goal and labelled parts → demo (view.demo plays it with
   `captions`) → practice items (not logged) with just-in-time tips → an easy scored start.
   Wording rules (CLAUDE.md 2, 12): about the task, never the person; no IQ or "mastered". */
(function (PX) {
  'use strict';

  PX.ex.learn('spin', {
    goal: 'Is it the same flat shape turned on the screen, or its mirror image?',
    goals: {
      samediff: 'Is the right shape the left one turned, or its mirror image?',
      pick: 'Two options are the reference turned and two are mirror images: pick the two turned copies.',
    },
    parts: [
      { id: 'reference', label: 'Reference', text: 'The shape to compare with. It stays as it is.' },
      { id: 'compare', label: 'Compare', variant: 'samediff', text: 'The same shape turned flat on the screen, or its mirror image turned. Same squares either way.' },
      { id: 'options', label: 'Options', variant: 'pick', text: 'Four shapes: two are the reference turned, two are its mirror image turned.' },
      { id: 'answer', label: 'Answer', text: 'Tap Same or Mirror, or press 1 or 2. For “pick two”, choose two options (tap, or keys 1–4), then Confirm or press Enter.' },
    ],
    // A 30° band, 5 squares: seed 2 is a copy turned 34° clockwise, seed 9 a mirror turned 30° back.
    demo: [
      { params: { angle: 1, cells: 0, variant: 'samediff' }, seed: 2, kind: 'same' },
      { params: { angle: 1, cells: 0, variant: 'samediff' }, seed: 9, kind: 'mirror' },
    ],
    practice: [
      { angle: 0, cells: 0, variant: 'samediff' },
      { angle: 1, cells: 0, variant: 'samediff' },
      { angle: 2, cells: 1, variant: 'samediff' },
      { angle: 1, cells: 0, variant: 'pick' },
    ],
    tips: [
      { id: 'flat', when: { dim: 'angle', levels: [0, 1, 2] }, text: 'The shape only turns flat on the screen, like a clock hand. Turn it back in your mind and compare.' },
      { id: 'pick', when: { variant: 'pick' }, text: 'Two options are turned copies and two are mirror images. Pick the two copies; the angles do not tell them apart.' },
      { id: 'large', when: { dim: 'angle', levels: [6, 7, 8] }, text: 'Big turns take longer for everyone: after a half turn, top and bottom have swapped. Accuracy first, then speed.' },
      { id: 'cells', when: { dim: 'cells', levels: [3, 4] }, text: 'More squares, same idea: find one part you can recognise, then check which side the next part is on.' },
    ],
    // Mental rotation of flat shapes is fast and holistic for simple shapes, piecemeal for complex
    // ones (Cooper & Shepard 1973; Khooshabeh et al. 2013); using and switching between both kinds of
    // strategy goes with better scores (Hegarty 2010; Stieff et al. 2014). research/B §2.
    strategies: [
      {
        id: 'imagery', title: 'Turn it as one piece',
        text: 'Picture the reference as a cut-out card and turn it on the table, all of it at once, until it lines up with the other shape.',
        steps: [
          'Pick the turn that brings the longest part into line.',
          'Turn the whole card smoothly; do not lift it off the table.',
          'Compare: everything in place means same; one part on the wrong side means mirror.',
        ],
        when: 'Quick for small turns and simple shapes.',
      },
      {
        id: 'analytic', title: 'Check one feature, then its side',
        text: 'Find a part you can recognise in both shapes, such as a notch or the longest arm, then check which side of it a second part sits on.',
        steps: [
          'Find the same distinctive part in both shapes.',
          'Walk round the outline from that part the same way (say clockwise) in both shapes.',
          'If the next notch or arm comes on the other side, it is the mirror image.',
        ],
        when: 'Steady for big turns and shapes with many corners.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Neither way is always better. People who use both, and switch, tend to do better on rotation tasks.',
        steps: [
          'If the turned picture blurs or you lose your place, switch to checking one feature.',
          'If checking features gets slow, step back and turn the whole shape for a quick look.',
          'Do not count squares: a mirror image has exactly the same squares. Compare sides instead.',
        ],
        when: 'After two misses in a row, try the other way on the next item.',
      },
    ],
    captions: {
      reference: 'This is the reference shape.',
      compare: 'The right shape is either the reference turned, or its mirror image turned.',
      options: 'Two options are the reference turned; two are its mirror image.',
      turn: 'Watch the reference turn {deg}° {dir}, like the right shape.',
      turnTo: 'Turning the reference {deg}° {dir}, like option {n}.',
      turnNone: 'The right shape is not turned: compare it with the reference as it is.',
      turnToNone: 'Option {n} is not turned: compare it with the reference as it is.',
      same: 'Laid over the right shape, it matches exactly: the same shape.',
      sameOption: 'Laid over option {n}, it matches: a turned copy.',
      notYet: 'Laid over the right shape, it does not match: one part is on the other side.',
      notYetOption: 'Laid over option {n}, it does not match: one part is on the other side.',
      mirror: 'Flipped over the dotted line, it matches: the right shape is the mirror image.',
      mirrorOption: 'Flipped over the dotted line, it matches option {n}: a mirror image.',
    },
    bridge: 'Chemists check whether two drawings show the same molecule or its mirror image, and map readers turn plans in their heads. Practising here improves this task and often similar ones; it has not been shown to improve grades or job performance.',
  });
})(window.PX);
