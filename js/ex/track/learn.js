/* EX-01 Track: tutorial data (pure, data only; ARCHITECTURE.md §2, PLAN.md §8, research/B-tasks.md §1).
   Attention practice (multiple-object tracking), not visuospatial training (CLAUDE.md rule 10).
   Watch–Try–Go: goal and labelled parts → demo (view.demo plays it with `captions`) → practice
   items (not logged) with just-in-time tips → an easy scored start.
   Shapes as in js/ex/rotate/learn.js: goal, goals[variant], parts[], demo[] ({ params, seed, kind }),
   practice[] (params), tips[] ({ id, when: { dim, levels } | { variant }, text }), strategies[]
   ({ id, title, text, steps[], when }), captions (every text the view puts on screen), bridge.
   Wording rules (CLAUDE.md 2, 12): about the task, never the person; no IQ or "mastered". */
(function (PX) {
  'use strict';

  PX.ex.learn('track', {
    goal: 'Follow the marked spheres while everything moves, then pick them out. Attention practice.',
    goals: {
      still: 'Follow the marked spheres while everything moves, then pick them out. Attention practice.',
      orbit: 'Follow the marked spheres while everything moves and the view turns slowly, then pick them out.',
    },
    parts: [
      { id: 'cube', label: 'Cube', text: 'The spheres move inside this cube, bouncing off its walls and off each other.' },
      { id: 'targets', label: 'Targets', text: 'At the start some spheres are coloured and ringed for 2 seconds: these are the targets.' },
      { id: 'motion', label: 'Motion', text: 'Then the marks go away and every sphere moves, all at the same speed.' },
      { id: 'orbit', label: 'Turning view', variant: 'orbit', text: 'In this version the view also turns slowly around the cube while the spheres move.' },
      { id: 'answer', label: 'Answer', text: 'When they stop, every sphere gets a number. Pick exactly the targets: tap them or press their numbers (0 is 10), then Confirm or press Enter.' },
      { id: 'pause', label: 'Pause', text: 'Esc or Pause stops everything at any time; that trial does not count.' },
    ],
    // The easiest level: 2 of 6 spheres, slowest speed, 5 s, still camera.
    demo: [
      { params: { speed: 0, targets: 0, spheres: 0, time: 0, variant: 'still' }, seed: 1, kind: 'still' },
    ],
    practice: [
      { speed: 0, targets: 0, spheres: 0, time: 0, variant: 'still' },
      { speed: 4, targets: 0, spheres: 0, time: 0, variant: 'still' },
      { speed: 4, targets: 1, spheres: 1, time: 0, variant: 'still' },
      { speed: 6, targets: 1, spheres: 1, time: 1, variant: 'orbit' },
    ],
    tips: [
      { id: 'orbit', when: { variant: 'orbit' }, text: 'The view turns slowly while the spheres move. Keep following the targets, not the cube.' },
      { id: 'shape', when: { dim: 'targets', levels: [2] }, text: 'Four targets: try seeing them as the corners of one shape that stretches and turns as they move.' },
      { id: 'others', when: { dim: 'targets', levels: [3] }, text: 'Five targets: when fewer spheres are not targets, follow those instead and pick everything else.' },
      { id: 'crowd', when: { dim: 'spheres', levels: [2] }, text: 'Ten spheres: close passes happen more often. When a sphere comes near a target, watch both until they part.' },
      { id: 'fast', when: { dim: 'speed', levels: [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45] }, text: 'Fast spheres: rest your eyes near the middle of the targets and follow them with your attention, not your eyes.' },
      { id: 'long', when: { dim: 'time', levels: [2] }, text: 'Twelve seconds of motion: if a target feels lost, keep going and pick your best guess at the end.' },
    ],
    // research/B-tasks.md §1: looking at the targets' centre predicted success (Harris et al.
    // 2020b), the basis of "one shape" (joining the targets into a shape is our framing of it);
    // errors follow close target–distractor encounters (Franconeri et al. 2010), so the close
    // passes are where a one-at-a-time check pays off.
    strategies: [
      {
        id: 'imagery', title: 'One shape',
        text: 'See the targets as the corners of one shape (a line, a triangle, a square) and watch that shape stretch, turn and slide as a whole.',
        steps: [
          'During the 2 seconds of marking, join the targets into a shape in your mind.',
          'Rest your eyes near the middle of that shape while it moves.',
          'At the end, pick the spheres at its corners.',
        ],
        when: 'Good for 2 to 4 targets that stay spread out.',
      },
      {
        id: 'analytic', title: 'Watch the close passes',
        text: 'Mistakes happen when a target passes close to another sphere. Check those moments one at a time: which sphere was the target, and which way did it go?',
        steps: [
          'When a sphere comes near a target, look at the two of them until they part.',
          'Note which one is your target as they separate.',
          'Then go back to the others.',
        ],
        when: 'Helps with fast spheres, with many spheres, and when targets get close to each other.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Neither way works every time. Switch when the one you are using breaks down.',
        steps: [
          'If the shape falls apart because targets drift to opposite corners, switch to watching the close passes.',
          'If close passes come so often that you lose the overall picture, step back to the shape.',
          'If most spheres are targets (4 or 5 of 6, 5 of 8), follow the others instead and pick everything else.',
        ],
        when: 'After two misses in a row, try the other way on the next trial; Show me replays the moment a target was lost.',
      },
    ],
    captions: {
      notice: 'Many spheres move at once, for up to 12 seconds. Press Esc or Pause to stop at any time; that trial will not count.',
      cue: 'Watch the {k} marked spheres.',
      track: 'Follow them.',
      pick: 'Pick the {k} targets · {p} of {k} picked.',
      full: 'Already {k} picked: tap a picked sphere (or press its number) to unpick it.',
      keys: 'Keys 1–{n} pick · Enter confirms · Backspace undoes',
      keys10: 'Keys 1–9 and 0 (= 10) pick · Enter confirms · Backspace undoes',
      keysStim: 'Esc pauses (that trial then does not count)',
      right: '✓ All {k} targets found.',
      wrong: '✗ {found} of {k} targets found.',
      legend: '✓ found · ✗ picked, not a target · ○ missed target',
      paused: 'Paused. This trial will not count; resume to finish it as practice.',
      voidJump: '⚠ This trial does not count: the spheres jumped (one frame took {ms} ms). Answer anyway as practice.',
      voidLost: '⚠ This trial does not count: the 3D view was interrupted. Answer anyway as practice.',
      voidPaused: '⚠ This trial does not count because it was paused. Answer anyway as practice.',
      voidFallback: '⚠ This trial does not count: a simplified layout had to be used.',
      smStart: 'These {k} were the targets.',
      smForward: 'Fast-forward to the closest call…',
      smSwap: 'Slow motion: target {a} and sphere {b} pass close here; {b} was picked instead.',
      smClose: 'Slow motion: the closest pass, target {a} and sphere {b}.',
      smToEnd: 'On to the end.',
      smAll: 'All {k} targets were picked.',
      smCompare: '✓ {found} found · ✗ {wrong} picked, not targets · ○ {missed} missed.',
      dSpheres: 'These {n} spheres all look the same.',
      dTargets: 'For 2 seconds, {k} of them are coloured and ringed: these are the targets.',
      dFollow: 'Then the marks go away and everything moves. Follow the targets with your eyes.',
      dPick: 'When they stop, every sphere gets a number. Pick the {k} targets: tap them or press their numbers, then Confirm.',
      dAnswer: 'The answer: spheres {list} were the targets (✓). Trials start slow; the speed follows your results.',
    },
    bridge: 'Keeping track of several moving things at once is part of driving, team sports and watching a busy scene. Practising here improves this task; studies of this kind of training found little or no improvement in other tasks, driving, sport or everyday attention.',
  });
})(window.PX);
