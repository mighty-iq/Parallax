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
      heading: 'Watch yourself turn on the spot, then turn back until you face the same way as at the start.',
      distance: 'Watch a straight walk, then walk the same distance again at another speed.',
    },
    parts: [
      { id: 'why', label: 'No landmarks', text: 'Navigators correct dead-reckoning errors with fixes: a landmark, a star, a satellite. Here there are none, so the errors of every turn and every metre add up. The skill is to keep them small.' },
      { id: 'view', label: 'View', text: 'You see the walk through your own eyes: straight legs, with turns on the spot between them and one more turn on the spot at the end.' },
      { id: 'start', label: 'Start ring', text: 'You begin inside a ring on the ground. It disappears once you step out of it, for good.' },
      { id: 'ground', label: 'Ground', text: 'Its marks slide past as you move, so they show how far and how fast you turn and walk. Nothing on it marks a place, and speeds change, so count what you see, not seconds.' },
      { id: 'turn', label: 'Turn', text: 'At the end, drag the view sideways, drag the arrow circle, or use the ◀ ▶ buttons (keys: ← and →, Shift for 1°). The top of the circle is the way you face now.' },
      { id: 'walk', label: 'Walk back', text: 'On return items: turn first, then hold Walk (key ↑) and let go to stop; Back (↓) steps back. Tap Here (Enter) where you think the start is.', variant: 'return' },
      { id: 'comfort', label: 'Comfort', text: 'The view moves on its own during the walk. Pause, or stop the session, if it makes you feel unwell. Gentle motion, in Settings, slows the walk and adds a still dot to look at.' },
    ],
    // v1.2 O36: the one-time notice before the first route outside Watch, Try, Go (the player shows it once,
    // rec.ui.seen.walkNotice; docs/research/v1.2/N1-reckon.md §5.4 #1)
    motionNotice: 'The view moves on its own. If you feel unwell, pause or stop. Gentle motion is in Settings.',
    // 2 legs, medium turn, textured ground, steady speed, 40° (v1.2, version 2: every route ends with a turn on
    // the spot): seed 44 walks 8.6 m, turns 96° right, walks 8.1 m, turns 57.6° right on the spot; the start is
    // 72.5° to the right, 11.2 m away.
    demo: [
      { params: { variant: 'point', route: 0, flow: 0, speed: 0, tolerance: 0, legs: 0 }, seed: 44, kind: 'right' },
    ],
    practice: [
      { variant: 'point', task: 'heading', route: 0, flow: 2, speed: 0, tolerance: 0, legs: 0 }, // short-lived dots: no ground pattern to match
      { variant: 'return', task: 'distance', route: 0, flow: 0, speed: 0, tolerance: 1, legs: 0 },
      { variant: 'point', route: 0, flow: 0, speed: 0, tolerance: 0, legs: 0 },
      { variant: 'return', route: 0, flow: 0, speed: 0, tolerance: 0, legs: 0 },
    ],
    // The player shows the first tip whose `when` fits the item. The two tutorial rungs come first (their items
    // carry params.task): a turn on the spot has no start to point at, and a straight walk no turn to keep
    // (v1.2 O39: "After each turn…" showed on the straight walk). Then the walk back before route tips, so
    // Try 4 explains Walk and Here.
    tips: [
      { id: 'headingTurn', when: { dim: 'task', levels: ['heading'] }, text: 'Watch the ground slide past as you turn: it shows how far round you go, even with nothing else to see.' },
      { id: 'distanceFlow', when: { dim: 'task', levels: ['distance'] }, text: 'The second walk goes at another speed: judge the distance by how much ground slides past, not by counting seconds.' },
      { id: 'walkback', when: { variant: 'return' }, text: 'Turn first, then hold Walk. Your speed changes from item to item, so judge the distance by the ground, not by counting.' },
      // v1.2 (version 2): the legs level, where the same turns can end in places far apart (gen.js LEG_CELLS)
      { id: 'legsDecide', when: { dim: 'legs', levels: [1] }, text: 'Watch the length of every leg too: here the same turns can end in places far apart.' },
      { id: 'update', when: { dim: 'route', levels: [0, 1, 2] }, text: 'After each turn, say to yourself where the start is now: behind, behind-left, left…' },
      { id: 'speeds', when: { dim: 'speed', levels: [1] }, text: 'Speeds change from leg to leg now: watch the ground flow, not the seconds.' },
      { id: 'speedsWithin', when: { dim: 'speed', levels: [2] }, text: 'Speeds may now change within a leg too: watch the ground flow, not the seconds.' },
      { id: 'sparse', when: { dim: 'flow', levels: [1] }, text: 'Fewer marks on the ground now. They still slide past at your speed.' },
      { id: 'dots', when: { dim: 'flow', levels: [2] }, text: 'The marks now fade after a moment, so no single one can be followed. Their flow still shows each turn and each metre.' },
      { id: 'legs', when: { dim: 'route', levels: [4, 5, 6, 7] }, text: 'Long routes: keep updating where the start is after every leg, or picture the shape from above as it grows.' },
      { id: 'tight', when: { dim: 'tolerance', levels: [2] }, text: 'Only 20° (or a quarter of the way back) counts now. ◀ 1° and 1° ▶ (Shift with the arrow keys) make fine turns.' },
    ],
    // Continuous updating (keep the start as a direction from you) is the faster, online mode and a
    // configural picture the more accurate one on long paths (Wiener, Berthoz & Wolbers 2011, abstract;
    // He & McNamara 2018b): R1 §8.1(b). No training study of either strategy was found [gap]: the cards
    // describe ways to do the task, not a proven method.
    // v1.2 (note docs/research/v1.2/N1-reckon.md §2.5, §6 #10): the analytic card's `when` says what was found
    // (quicker answers; the picture more accurate on the longer path of one walking study); switching is marked
    // as our suggestion.
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
        when: 'Quicker to answer; on longer routes, the picture was more accurate in one walking study.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Use both: the direction as you go, the picture to check it at the end.',
        steps: [
          'If the picture blurs after several turns, fall back on the direction of the start.',
          'If you lose the direction, rebuild it from the picture.',
          'After two misses in a row, watch the next route with the other method.',
        ],
        when: 'Our suggestion, not a finding: after two misses in a row, try the other way on the next route.',
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
      describe: 'A first-person view of a walk across an empty plain with nothing to steer by: {legs} straight legs with turns between them and a last turn on the spot. Then turn to face where you started with the left and right arrow keys (5°, with Shift 1°){walk}, and confirm with Enter. The top of the circle is the way you face.',
      describeWalk: ', walk back by holding the up arrow (the down arrow steps back)',
      describeHeading: 'A first-person view: you stand in a ring and turn on the spot. Then turn back until you face the same way as at the start, with the left and right arrow keys, and confirm with Enter.',
      describeDistance: 'A first-person view: you walk straight across an empty plain. Then walk the same distance again by holding the up arrow, and confirm with Enter.',
      // phases
      phaseWatch: 'You start in the ring. Watch the walk: nothing out there marks the way.',
      phaseTurn: 'Turn to face the start, then confirm.',
      phaseReturnTurn: 'Turn to face the start, then hold Walk to walk back to it.',
      phaseWalk: 'Hold Walk to go on, Back to step back. Tap Here where the start is.',
      phaseHeading: 'Turn back until you face the same way as at the start, then confirm.',
      phaseDemo: 'Watch the demo: it walks this route and finds the way back. Then it is your turn.',
      phaseDistance: 'Hold Walk: walk the same distance again, then tap Here.',
      phaseReveal: 'The flag marks the start.',
      phaseRevealDistance: 'The flag marks the end of the same distance.',
      phaseRevealHeading: 'The view turns back to the way you faced at the start.',
      // after the answer
      noAnswer: 'No answer',
      verdictRight: '{err}° off: within {tol}°',
      verdictWrong: '{err}° off: more than {tol}°',
      posRight: '{err} m from the start: within {pct} % of the way back ({lim} m)',
      posWrong: '{err} m from the start: more than {pct} % of the way back ({lim} m)',
      posRightDistance: '{err} m off: within {pct} % of the distance ({lim} m)',
      posWrongDistance: '{err} m off: more than {pct} % of the distance ({lim} m)',
      answerWas: 'The start was {deg}° to your {side}, {dist} m away.',
      walkedWas: 'You turned {deg}° {side} and walked {r} m: {aerr}° off in direction, {dist} in distance.',
      walkedNone: 'You did not walk back, so only your direction counts as a miss.',
      // the drift: the route and the walk back together, against this item's own limit in the same unit (v1.2 O40)
      drift: 'Drift: {ep} m off after {path} m walked in all (the route and your walk back), {per}; the limit for this item was about {lim} cm per metre.',
      perMetre: 'about {cm} cm per metre',
      perMetreUnder: 'under 1 cm per metre',
      headingWas: 'You turned {deg}° {side} in all; turning back by as much faces the same way as at the start.',
      distanceWas: 'The first walk was {L} m; you walked {r} m ({dist}).',
      // a distance off by less than 1 % reads "under 1 % off", never "0 % too far" (v1.2 O40)
      distOff: '{dpct} % {dword}',
      distEven: 'under 1 % off',
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
      // the chart has axis words and says solid and hollow, not "filled: right", which read as a direction (v1.2 O40)
      chartLabel: 'Your last routes, oldest first: how far round you turned, one dot each, above the line too far and below it too little, solid when right and hollow when missed, against the current tolerance (the shaded band).',
      chartNote: 'One dot per route, oldest on the left. Above the line you turned too far round, below it too little; the shaded band is the current tolerance. Solid dots were right, hollow dots missed.',
      chartFar: 'too far',
      chartShort: 'too little',
      chartOld: 'older',
      chartNew: 'latest',
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
      mapYou: 'your answer', // the arrow of your answer, not where you are (v1.2 O40)
      // the demo
      demoStart: 'You start here, inside the ring. Nothing else will ever mark this spot.',
      demoWalk: 'Watch the walk: straight legs with turns on the spot between them, and one last turn on the spot at the end. The ground shows every metre and every degree.',
      demoEnd: 'The walk ends here, after the last turn. The start is somewhere off the screen, and nothing points to it.',
      demoTurn: 'Turn {deg}° to the {side}: now you face the start.',
      demoTurnHeading: 'Turn {deg}° to the {side}: now you face the same way as at the start.',
      demoAnswer: 'To answer, drag the view or the circle, or use ◀ ▶ (keys ← →). Then Confirm (Enter).',
    },
    bridge: 'Pilots and sailors use dead reckoning to stay oriented between fixes. Practising here improves this task; whether it helps real wayfinding has not been tested in any study we found, and walking adds body senses that a screen cannot give.',
  });
})(window.PX);
