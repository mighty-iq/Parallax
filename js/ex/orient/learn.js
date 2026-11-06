/* EX-08 Orient: tutorial data (pure, data only; ARCHITECTURE.md §2, PLAN.md §8; shapes as in
   js/ex/rotate/learn.js). Watch–Try–Go: goal and labelled parts → demo (view.demo plays it with
   `captions`) → practice items (not logged) with just-in-time tips → an easy scored start.
   Wording rules (CLAUDE.md 2, 12): about the task, never the person; no IQ or "mastered". */
(function (PX) {
  'use strict';

  PX.ex.learn('orient', {
    goal: 'Imagine standing at one object, facing another: which way is the third?',
    parts: [
      { id: 'question', label: 'Question', text: 'Where you stand, what you face, and what to point to. Each name has its map symbol beside it.' },
      { id: 'map', label: 'Map', text: 'The objects seen from above. The top of the map is not ahead of you: the object you face is.' },
      { id: 'circle', label: 'Arrow circle', text: 'You stand in the middle, facing the object named at the top. Left and right are marked.' },
      { id: 'answer', label: 'Answer', text: 'Drag or tap the circle, or turn the arrow with ← and → (Shift: 1°). Confirm with Enter.' },
    ],
    // The easiest levels (0–45° shift, 5 objects, 40°): seed 21 faces 42° left of map-up; the target is
    // 118° to the right, behind (on the map, read with up as ahead, it looks ahead-right at 76°).
    demo: [
      { params: { shift: 0, objects: 0, tolerance: 0 }, seed: 21, kind: 'right' },
    ],
    practice: [
      { shift: 0, objects: 0, tolerance: 0 },
      { shift: 1, objects: 0, tolerance: 0 },
      { shift: 2, objects: 0, tolerance: 0 },
      { shift: 1, objects: 1, tolerance: 1 },
    ],
    tips: [
      { id: 'ahead', when: { dim: 'shift', levels: [0] }, text: 'The top of the circle is always the object you face. Here you face roughly up the map.' },
      { id: 'turned', when: { dim: 'shift', levels: [1, 2] }, text: 'Now you face across the map. Turn the map in your mind until the object you face is straight up, then point.' },
      { id: 'behind', when: { dim: 'shift', levels: [3] }, text: 'You face down the map, so left and right are swapped compared with the screen. Take your time.' },
      { id: 'crowd', when: { dim: 'objects', levels: [2] }, text: 'Nine objects: find the three named ones first; the symbols in the question help.' },
      { id: 'tight', when: { dim: 'tolerance', levels: [2] }, text: 'Only 20° either side counts now. With Shift, ← and → turn the arrow 1°.' },
    ],
    // Perspective taking is separable from mental rotation (Hegarty & Waller 2004). Beyond about 90° of
    // imagined shift, errors suggest people fall back on coding the array relative to their own body
    // (Kozhevnikov & Hegarty 2001), and targets on the front/back or left/right axes are easier (He,
    // Chrastil & Hegarty 2022). research/B §5. No trial training these strategies was found [gap], so
    // the cards describe ways to do the task, not a proven method.
    strategies: [
      {
        id: 'imagery', title: 'Step into the map',
        text: 'Imagine standing at the first object, looking at the second. Turn on the spot in your mind until you face it, then point.',
        steps: [
          'Find where you stand and what you face.',
          'Imagine turning on the spot until that object is straight ahead.',
          'Point to the third object: in front or behind, left or right?',
        ],
        when: 'Natural for small turns; it keeps left and right the right way round.',
      },
      {
        id: 'analytic', title: 'Measure the angle',
        text: 'Where you stand, two lines meet: one to the object you face and one to the target. The angle between them is the answer.',
        steps: [
          'Picture the line to what you face and the line to the target.',
          'Estimate the angle between them: a right angle is 90°, a straight line 180°.',
          'Find the side: turning from the first line to the second clockwise is right, counter-clockwise is left.',
        ],
        when: 'Steady when you face down the map and imagined turning gets confusing.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Use both: picture the view first, then check it with the angle.',
        steps: [
          'If you catch yourself pointing as if the top of the screen were ahead, step into the map again.',
          'If the imagined turn is large (facing down the map), measure the angle instead.',
          'Check the side last: facing that way, is the target on your left or your right?',
        ],
        when: 'After a miss of more than 90°, decide in front or behind first.',
      },
    ],
    captions: {
      // the arrow circle and the answer
      ahead: 'straight ahead',
      behind: 'straight behind',
      left: 'left',
      right: 'right',
      notSet: 'not set',
      dialLabel: 'Arrow circle: you stand in the middle, at the {at}; the top is straight ahead, towards the {facing}',
      readout: 'Arrow: {dir}',
      readoutNone: 'Arrow: not set yet',
      readoutYours: 'Your arrow: {dir}',
      setFirst: 'Set the arrow first: drag or tap the circle, or use ← →.',
      confirm: 'Confirm',
      hintPointer: 'Drag or tap the circle.',
      hintKeys: '← → turn the arrow 5°, with Shift 1°.',
      describe: 'A map of {n} objects seen from above, and an arrow circle. You stand in the middle of the circle, at the {at}; its top is straight ahead, towards the {facing}. Set the arrow with the left and right arrow keys (5°, with Shift 1°) and confirm with Enter.',
      // after the answer
      noAnswer: 'No answer',
      verdictRight: '{err}° off: within {tol}°',
      verdictWrong: '{err}° off: more than {tol}°',
      answerWas: 'From where you stand, the {target} is {deg}° to the {side}, {where}.',
      legend: 'Filled arrow: the right direction; shaded: ± {tol}°.',
      whereFront: 'in front of you',
      whereBehind: 'behind you',
      whereSide: 'roughly level with you',
      hintMapUp: 'Your arrow matches the map as drawn, with its top as ahead. Turn the map in your mind first, until the {facing} is straight up.',
      hintSides: 'Left and right were swapped: the right direction is on the other side.',
      hintFrontBack: 'The arrow points the other way round: decide first whether the target is in front of you or behind you.',
      voidRotated: 'The screen turned, so this item doesn’t count; keep the phone still while you answer.',
      // badges on the map
      badgeAt: 'you',
      badgeFacing: 'facing',
      badgeTarget: 'point to',
      // show me and the demo
      stand: 'You stand at the {at}, facing the {facing}.',
      turn: 'Turn the map {deg}° {dir} about the {at}, until the {facing} is straight up: ahead of you.',
      turnNone: 'The {facing} is already straight up the map: ahead of you.',
      read: 'Now the {target} is {deg}° to the {side}, {where}.',
      circle: 'On the circle the top is ahead, so the arrow goes {deg}° to the {side}.',
      demoMap: 'A map seen from above. The names say which object is which.',
      demoAt: 'Imagine you stand at the {at}…',
      demoFacing: '…looking towards the {facing}.',
      demoTarget: 'Which way is the {target} from there?',
      demoAnswer: 'To answer, set the arrow: drag or tap the circle, or use ← → (Shift: 1°). Then Confirm or press Enter.',
    },
    bridge: 'Reading a map that is not turned the way you face, or giving directions from where someone else stands, uses this skill. Practising here improves this task and often similar ones; it has not been shown to improve grades or job performance.',
  });
})(window.PX);
