/* EX-12 Reckon (experimental): tutorial data (pure, data only; ARCHITECTURE.md §2, EXERCISE-GUIDE §7;
   design: docs/research/v1.1/R1-path-integration.md §8.5). Watch–Try–Go: goal and labelled parts (with
   the "why no landmarks" card) → demo (view.demo replays a 2-leg route with captions and the map from
   above) → Try: the heading rung, the distance rung, a 2-leg point and a 2-leg return route (not
   logged) → an easy scored start. Captions are read by js/ex/reckon/view.js and by the shared kit in
   js/ex/homing/view.js (keys the kit asks for: the tests check both). Wording rules (CLAUDE.md 2, 12):
   about the task, never the person; no IQ or "mastered"; no promise of real-world gains. */
(function (PX) {
  'use strict';

  PX.ex.learn('reckon', {
    goal: 'Watch a walk with nothing to steer by, then point to where you started.',
    goals: {
      point: 'Watch a walk with nothing to steer by, then turn to face where you started.',
      return: 'Watch a walk with nothing to steer by, then turn and walk back to where you started.',
      heading: 'Watch yourself turn on the spot, then turn back to the way you faced at the start.',
      distance: 'Watch a straight walk, then walk the same distance again at another speed.',
    },
    parts: [
      { id: 'why', label: 'No landmarks', text: 'Navigators correct dead-reckoning errors with fixes: a landmark, a star, a satellite. Here there are none, so the errors of every turn and every metre add up. The skill is to keep them small.' },
      { id: 'view', label: 'View', text: 'You see the walk through your own eyes: straight legs, with turns on the spot between them.' },
      { id: 'start', label: 'Start ring', text: 'You begin inside a ring on the ground. It disappears once you step out of it, for good.' },
      { id: 'ground', label: 'Ground', text: 'Its marks slide past as you move, so they show how far and how fast you turn and walk. Nothing on it marks a place, and speeds change, so count what you see, not seconds.' },
      { id: 'turn', label: 'Turn', text: 'At the end, drag the view sideways, drag the arrow circle, or use the ◀ ▶ buttons (keys: ← and →, Shift for 1°). The top of the circle is the way you face now.' },
      { id: 'walk', label: 'Walk back', text: 'On return items: turn first, then hold Walk (key ↑) and let go to stop; Back (↓) steps back. Tap Here (Enter) where you think the start is.', variant: 'return' },
      { id: 'comfort', label: 'Comfort', text: 'The view moves on its own during the walk. Pause, or stop the session, if it makes you feel unwell.' },
    ],
    // 2 legs, medium turn, textured ground, steady speed, 40°: seed 34 walks 8.0 m, turns 100.6° right,
    // walks 10.2 m; the start is 138° to the right, 11.7 m away.
    demo: [
      { params: { variant: 'point', route: 0, flow: 0, speed: 0, tolerance: 0 }, seed: 34, kind: 'right' },
    ],
    practice: [
      { variant: 'point', task: 'heading', route: 0, flow: 2, speed: 0, tolerance: 0 }, // short-lived dots: no ground pattern to match
      { variant: 'return', task: 'distance', route: 0, flow: 0, speed: 0, tolerance: 1 },
      { variant: 'point', route: 0, flow: 0, speed: 0, tolerance: 0 },
      { variant: 'return', route: 0, flow: 0, speed: 0, tolerance: 0 },
    ],
    tips: [
      { id: 'update', when: { dim: 'route', levels: [0, 1, 2] }, text: 'After each turn, say to yourself where the start is now: behind, behind-left, left…' },
      { id: 'walkback', when: { variant: 'return' }, text: 'Turn first, then hold Walk. The ground slides past at your walking speed, which changes from item to item: judge the distance by the ground, not by counting.' },
      { id: 'speeds', when: { dim: 'speed', levels: [1] }, text: 'Speeds change from leg to leg now: watch the ground flow, not the seconds.' },
      { id: 'speedsWithin', when: { dim: 'speed', levels: [2] }, text: 'Speeds now change even within a leg: watch the ground flow, not the seconds.' },
      { id: 'sparse', when: { dim: 'flow', levels: [1] }, text: 'Fewer marks on the ground now. They still slide past at your speed.' },
      { id: 'dots', when: { dim: 'flow', levels: [2] }, text: 'The marks now fade after a moment, so no single one can be followed. Their flow still shows each turn and each metre.' },
      { id: 'legs', when: { dim: 'route', levels: [4, 5, 6, 7] }, text: 'Long routes: keep updating where the start is after every leg, or picture the shape from above as it grows.' },
      { id: 'tight', when: { dim: 'tolerance', levels: [2] }, text: 'Only 20° (or a quarter of the way back) counts now. ◀ 1° and 1° ▶ (Shift with the arrow keys) make fine turns.' },
    ],
    // Continuous updating (keep the start as a direction from you) is the faster, online mode and a
    // configural picture the more accurate one on long paths (Wiener, Berthoz & Wolbers 2011, abstract;
    // He & McNamara 2018b): R1 §8.1(b). No training study of either strategy was found [gap]: the cards
    // describe ways to do the task, not a proven method.
    strategies: [
      {
        id: 'imagery', title: 'Picture the shape from above',
        text: 'Draw the route on an imagined map as it happens, with yourself as a moving arrow. At the end, find the start on that picture.',
        steps: [
          'At the start, mark the spot on your picture.',
          'Add each leg and each turn to the picture as it happens.',
          'At the end, turn so your arrow points at the mark.',
        ],
        when: 'Most accurate on longer routes, when the picture stays sharp.',
      },
      {
        id: 'analytic', title: 'Keep the start as a direction from you',
        text: 'Hold one direction in mind, from your own point of view: where the start is. Update it with every turn and every leg.',
        steps: [
          'After the first leg, the start is straight behind you.',
          'A turn of 90° to the right swings it 90° round the other way: from straight behind you to your right.',
          'Walking on swings it further round behind you; once it is beside or behind you, it also gets further away.',
        ],
        when: 'Quick and steady when there is nothing to steer by and the turns come fast.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Use both: the direction as you go, the picture to check it at the end.',
        steps: [
          'If the picture blurs after several turns, fall back on the direction of the start.',
          'If you lose the direction, rebuild it from the picture.',
          'After two misses in a row, watch the next route with the other method.',
        ],
        when: 'After two misses in a row, try the other way on the next route.',
      },
    ],
    captions: {
      // the arrow circle, readouts and fine turns (shared kit keys first)
      ahead: 'straight ahead',
      behind: 'straight behind',
      aheadLabel: 'ahead',
      left: 'left',
      right: 'right',
      notSet: 'not turned yet',
      dialLabel: 'Arrow circle: you stand in the middle; the top is the way you face at the end of the route',
      fineLabel: 'Turn {deg}° to the {side}',
      readout: 'Facing {dir}',
      readoutNone: 'Facing straight ahead (not turned yet)',
      readoutWatch: 'Watch the walk first',
      readoutYours: 'You faced {dir}',
      readoutLocked: "Set: {dir}. To turn again, hold Back to the route's end.",
      setFirst: 'Turn first: drag the view or the circle, or use ◀ ▶.',
      walkFirst: 'Walk first: hold Walk (or ↑), then Here (Enter).',
      hintTouch: 'Drag the view or the circle to turn; ◀ ▶ for fine steps.',
      hintKeys: '← → turn 5°, with Shift 1°.',
      hintKeysWalk: '↑ hold to walk, ↓ to step back, Enter: Here.',
      confirm: 'Confirm',
      walk: 'Walk',
      back: 'Back',
      here: 'Here',
      experimental: 'Experimental',
      // the walk: pause and void
      voidPaused: 'The walk was paused, so this answer will not count.',
      voidStutter: 'The view froze during the walk, so this answer will not count.',
      voidTurned: 'The screen changed shape during the walk, so this answer will not count.',
      voidTurnedAnswer: 'The screen changed shape while you answered, so this answer will not count.',
      voidLost: 'The 3D view was interrupted, so this answer will not count.',
      describe: 'A first-person view of a walk across an empty plain with nothing to steer by: {legs} straight legs with turns between them. Then turn to face where you started with the left and right arrow keys (5°, with Shift 1°){walk}, and confirm with Enter. The top of the circle is the way you face.',
      describeWalk: ', walk back by holding the up arrow (the down arrow steps back)',
      describeHeading: 'A first-person view: you stand in a ring and turn on the spot. Then turn back to the way you faced at the start with the left and right arrow keys, and confirm with Enter.',
      describeDistance: 'A first-person view: you walk straight across an empty plain. Then walk the same distance again by holding the up arrow, and confirm with Enter.',
      // phases
      phaseWatch: 'You start in the ring. Watch the walk: nothing out there marks the way.',
      phaseTurn: 'Turn to face the start, then confirm.',
      phaseReturnTurn: 'Turn to face the start, then hold Walk to walk back to it.',
      phaseWalk: 'Hold Walk to go on, Back to step back. Tap Here where the start is.',
      phaseHeading: 'Turn back to the way you faced at the start, then confirm.',
      phaseDistance: 'Hold Walk: walk the same distance again, then tap Here.',
      phaseReveal: 'The flag marks the start.',
      phaseRevealDistance: 'The flag marks the end of the same distance.',
      phaseRevealHeading: 'The view turns to the way you faced at the start.',
      // after the answer
      noAnswer: 'No answer',
      verdictRight: '{err}° off: within {tol}°',
      verdictWrong: '{err}° off: more than {tol}°',
      posRight: '{err} m from the start: within {pct} % of the way back ({lim} m)',
      posWrong: '{err} m from the start: more than {pct} % of the way back ({lim} m)',
      posRightDistance: '{err} m off: within {pct} % of the distance ({lim} m)',
      posWrongDistance: '{err} m off: more than {pct} % of the distance ({lim} m)',
      answerWas: 'The start was {deg}° to your {side}, {dist} m away.',
      walkedWas: 'You turned {deg}° {side} and walked {r} m: {aerr}° off in direction, {dpct} % {dword} in distance.',
      walkedNone: 'You did not walk back, so only your direction counts as a miss.',
      drift: 'Drift: {ep} m off after {path} m walked, about {cm} cm per metre.',
      headingWas: 'You turned {deg}° {side} in all; turning back by as much faces the way you started.',
      distanceWas: 'The first walk was {L} m; you walked {r} m ({dpct} % {dword}).',
      short: 'short',
      long: 'too far',
      legend: 'Filled arrow: the way to the start; shaded: ± {tol}°.',
      legendReturn: 'Filled arrow: the way to the start; open arrow: the way you walked.',
      hintReversed: 'Your answer points back as if the whole walk had been straight: the turns moved the start to one side.',
      hintAround: 'Turning straight round points back along the last leg only: the earlier legs moved the start to one side.',
      hintSides: 'Left and right were swapped: the start is on the other side.',
      hintNotUpdated: 'Your answer points where the start would be if you had never turned. Keep each turn as it happens: it moves the start round you.',
      // the player's own errors over the last routes
      biasHead: 'Your last {n} routes:',
      biasTurnFar: 'you turned about {deg}° too far',
      biasTurnShort: 'you turned about {deg}° too little',
      biasTurnEven: 'your turns were about right on average',
      biasWalkShort: 'you walked about {pct} % short',
      biasWalkLong: 'you walked about {pct} % too far',
      biasWalkEven: 'your distances were about right on average',
      biasSwaps: '{k} answers on the wrong side',
      chartLabel: 'Your last routes: how far round you turned, one dot each, above the line too far and below too little, filled when right, against the current tolerance (band).',
      chartNote: 'Above the line: turned too far round; below: too little. Filled: right; shaded: the current tolerance.',
      // show me: the route from above (shared kit keys) and Reckon's extra steps
      hideMap: 'Hide the map',
      mapStart: 'start',
      mapIntro: 'Your route from above. You started at the dot, facing up.',
      mapLeg: '{m} m straight ahead.',
      mapLegThen: 'Then {m} m straight on.',
      mapTurn: 'Turn {deg}° to the {dir}: everything round you turns the other way.',
      mapEnd: 'You end here, facing this way.',
      mapBack: 'The start is {dist} m away, along the dashed line.',
      mapRotate: 'Turn the map so that you face up again.',
      mapAngle: 'The start is {deg}° to your {side}: that is the arrow on the circle.',
      mapYours: 'Your answer: {deg}° to the {side} (the open arrow).',
      mapYoursLine: 'Your answer: {deg}° to the {side} (the solid line).',
      mapYoursWalk: 'You walked {r} m that way and stopped at the ring: {ep} m from the start.',
      mapYou: 'you',
      // the demo
      demoStart: 'You start here, inside the ring. Nothing else will ever mark this spot.',
      demoWalk: 'Watch the walk: straight legs with turns on the spot between them. The ground shows every metre and every degree.',
      demoEnd: 'The walk ends here. The start is somewhere off the screen, and nothing points to it.',
      demoTurn: 'Turn {deg}° to the {side}: now you face the start.',
      demoTurnHeading: 'Turn {deg}° to the {side}: now you face the way you faced at the start.',
      demoAnswer: 'To answer, drag the view or the circle, or use ◀ ▶ (keys ← →). Then Confirm (Enter).',
    },
    bridge: 'Pilots and sailors use dead reckoning to stay oriented between fixes. Practising here improves this task; whether it helps real wayfinding has not been tested in any study we found, and walking adds body senses that a screen cannot give.',
  });
})(window.PX);
