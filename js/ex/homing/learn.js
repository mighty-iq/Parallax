/* EX-11 Homing (experimental): tutorial data (pure, data only; ARCHITECTURE.md §2, PLAN.md §8; shapes
   as in js/ex/rotate/learn.js). Watch–Try–Go: goal and labelled parts → demo (view.demo replays the
   route with `captions`) → practice items (not logged) with just-in-time tips → an easy scored start.
   v1.1: Homing is the landmark-aided stage before Reckon (EX-12): its texts say that landmarks act as
   fixes that correct dead-reckoning errors (R1 §8.1(d)); the phone controls (drag the view, ◀ ▶) are
   named; the "larger screen" notice is gone (ratings stay per screen class). Captions are read by
   js/ex/homing/view.js and its kit (the tests check both). Wording rules (CLAUDE.md 2, 12): about the
   task, never the person; no IQ or "mastered". */
(function (PX) {
  'use strict';

  PX.ex.learn('homing', {
    goal: 'Watch a short walk, then turn to face where you started.',
    parts: [
      { id: 'view', label: 'View', text: 'You see the walk through your own eyes: straight legs with turns on the spot between them.' },
      { id: 'start', label: 'Start', text: 'You begin inside a ring on the ground. It disappears once you walk away.' },
      { id: 'landmarks', label: 'Landmarks', text: 'Far-off shapes on the horizon (on some levels). They barely move as you walk, so like a navigator\'s fix they correct the errors of each turn. Reckon, the next stage, has none.' },
      { id: 'circle', label: 'Turn', text: 'At the end, drag the view sideways, drag or tap the arrow circle, or use the ◀ ▶ buttons (keys: ← and →, Shift for 1°). The top of the circle is the way you face; the view turns with the arrow.' },
      { id: 'comfort', label: 'Comfort', text: 'The view moves on its own during the walk. Pause, or stop the session, if it makes you feel unwell.' },
    ],
    // 2 legs, medium turn, three landmarks, 40° (version 2): seed 1 walks 11.3 m, turns 120° right, walks 8.2 m; the start is 105° to the right.
    demo: [
      { params: { route: 0, landmarks: 0, tolerance: 0 }, seed: 1, kind: 'right' },
    ],
    practice: [
      { route: 0, landmarks: 0, tolerance: 0 },
      { route: 1, landmarks: 0, tolerance: 0 },
      { route: 2, landmarks: 1, tolerance: 0 },
      { route: 3, landmarks: 1, tolerance: 1 },
    ],
    tips: [
      { id: 'track', when: { dim: 'route', levels: [0, 1] }, text: 'Keep track as you go: after each turn, update where the start is (behind you, to the left, …).' },
      { id: 'landmarks', when: { dim: 'landmarks', levels: [0, 1] }, text: 'The far landmarks stay put while you walk: use them as a fix, like a compass, to see how far you have turned.' },
      { id: 'nolandmarks', when: { dim: 'landmarks', levels: [2] }, text: 'No landmarks now: only the turns tell you which way you face. Notice each one as it happens (Reckon trains exactly this).' },
      { id: 'legs', when: { dim: 'route', levels: [4, 5, 6, 7] }, text: 'More legs: picture the route from above as it grows, one leg at a time.' },
      { id: 'tight', when: { dim: 'tolerance', levels: [2] }, text: 'Only 20° either side counts now. ◀ 1° and 1° ▶ (or Shift with ← →) make fine turns.' },
    ],
    // Visual triangle completion (Loomis et al. 1993 [unverified]) without body-based cues measures visual
    // path integration (research/B §10); in a browser body-based cues are missing, which is why Homing is
    // experimental. No training study of these strategies was found [gap]: the cards describe ways to do
    // the task, not a proven method.
    strategies: [
      {
        id: 'imagery', title: 'Draw the map in your head',
        text: 'Picture the walk from above as it happens, with yourself as a moving arrow. At the end, look on that picture for the start.',
        steps: [
          'At the start, picture a flag where you stand.',
          'Draw each leg and each turn onto your picture as you go.',
          'At the end, turn towards the flag in your picture.',
        ],
        when: 'Natural for short routes; it keeps the whole shape in view.',
      },
      {
        id: 'analytic', title: 'Track the start like a compass needle',
        text: 'Keep one direction in mind: where the start is from you. Update it after every leg and every turn.',
        steps: [
          'After the first leg, the start is straight behind you.',
          'A turn of 90° to the right swings it 90° round the other way: from straight behind you to your right.',
          'Walking on pulls the start further behind you; a short leg leaves it more to the side.',
        ],
        when: 'Steady when there are no landmarks and the route has many turns.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Use both: the picture for the shape, the needle for the direction.',
        steps: [
          'If the picture blurs after several turns, fall back on tracking the direction of the start.',
          'If there are landmarks, check your picture against them: they stay put as you walk.',
          'After a miss, watch the next route with the other method.',
        ],
        when: 'After two misses in a row, try the other way on the next route.',
      },
    ],
    captions: {
      // the arrow circle and the answer
      ahead: 'straight ahead',
      behind: 'straight behind',
      aheadLabel: 'ahead',
      left: 'left',
      right: 'right',
      notSet: 'not set',
      dialLabel: 'Arrow circle: you stand in the middle; the top is the way you face at the end of the route',
      fineLabel: 'Turn {deg}° to the {side}',
      readout: 'Facing {dir}',
      readoutNone: 'Facing straight ahead (not turned yet)',
      readoutWatch: 'Watch the route first',
      readoutYours: 'You faced {dir}',
      setFirst: 'Turn first: drag the view or the circle, or use ◀ ▶.',
      confirm: 'Confirm',
      hintTouch: 'Drag the view or the circle to turn; ◀ ▶ for fine steps.',
      hintKeys: '← → turn 5°, with Shift 1°; Enter confirms.',
      describe: 'A first-person view of a walk across a plain: {legs} straight legs with turns between them{landmarks}. Then turn to face where you started: set the arrow with the left and right arrow keys (5°, with Shift 1°) and confirm with Enter. The top of the circle is the way you face.',
      withLandmarks: ', with far-off landmarks on the horizon',
      experimental: 'Experimental',
      hideMap: 'Hide the map',
      voidPaused: 'The route was paused, so this answer will not count.',
      voidStutter: 'The view froze during the route, so this answer will not count.',
      voidTurned: 'The screen changed shape during the route, so this answer will not count.',
      voidTurnedAnswer: 'The screen changed shape while you answered, so this answer will not count.',
      voidLost: 'The 3D view was interrupted, so this answer will not count.',
      phaseWatch: 'You start in the ring. Watch the route and keep track of the start.',
      phaseTurn: 'Turn to face the start, then confirm.',
      phaseReveal: 'The flag marks the start.',
      // after the answer
      noAnswer: 'No answer',
      verdictRight: '{err}° off: within {tol}°',
      verdictWrong: '{err}° off: more than {tol}°',
      answerWas: 'The start was {deg}° to your {side}, {dist} m away.',
      legend: 'Filled arrow: the way to the start; shaded: ± {tol}°.',
      hintReversed: 'Your arrow points back as if the whole walk had been straight; the turns moved the start to one side.',
      hintAround: 'Turning straight round points back along the last leg only; the earlier legs moved the start to one side.',
      hintSides: 'Left and right were swapped: the start is on the other side.',
      // show me: the route from above
      mapStart: 'start',
      mapIntro: 'Your route from above. You started at the dot, facing up.',
      mapLeg: '{m} m straight ahead.',
      mapLegThen: 'Then {m} m straight on.',
      mapTurn: 'Turn {deg}° to the {dir}.',
      mapEnd: 'You end here, facing this way.',
      mapBack: 'The start is {dist} m away, along the dashed line.',
      mapRotate: 'Turn the map so that you face up again.',
      mapAngle: 'The start is {deg}° to your {side}: that is the arrow on the circle.',
      mapYou: 'you',
      mapYours: 'Your answer: {deg}° to the {side}.',
      mapYoursWalk: 'You walked {r} m that way: {ep} m from the start.',
      // the demo
      demoStart: 'You start here, inside the ring. Remember where it is.',
      demoWalk: 'Watch the route: straight legs, with turns on the spot between them.',
      demoEnd: 'The route ends here. The start is somewhere off the screen.',
      demoTurn: 'Turn {deg}° to the {side}: now you face the start.',
      demoAnswer: 'To answer, drag the view or the circle, or use ◀ ▶ (keys ← →, Shift for 1°). Then Confirm (Enter).',
    },
    bridge: 'Finding the way back to a car or a trailhead without a map uses the same kind of tracking. Practising here improves this task; whether it helps real wayfinding has not been tested in any study we found.',
  });
})(window.PX);
