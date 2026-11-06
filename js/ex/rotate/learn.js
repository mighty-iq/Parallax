/* EX-02 Rotate: tutorial data (pure, data only; ARCHITECTURE.md §2, PLAN.md §8).
   Watch–Try–Go: goal and labelled parts → demo (view.demo plays it with `captions`) →
   practice items (not logged) with just-in-time tips → an easy scored start.
   Shapes:
     goal, goals[variant]       one line each
     parts[]                    { id, label, text, variant? } labels for the parts of the screen
     demo[]                     { params, seed, kind } kind = what the seed gives (tested)
     practice[]                 params (3–5), easiest first; the tutorial draws its own seeds
     tips[]                     { id, when: { dim, levels } | { variant }, text } shown once, the
                                first time an item matching `when` appears
     strategies[]               { id, title, text, steps[], when } (imagery, analytic, switch)
     captions                   texts that view.demo and view.showMe put on screen
     bridge                     where the skill shows up (honest wording; no claims of transfer)
   Wording rules (CLAUDE.md 2, 12): about the task, never the person; no IQ or "mastered". */
(function (PX) {
  'use strict';

  PX.ex.learn('rotate', {
    goal: 'Is it the same figure turned around, or its mirror image?',
    goals: {
      samediff: 'Is the right figure the left one turned around, or its mirror image?',
      pick: 'Two options are the reference turned around and two are mirror images: pick the two turned copies.',
    },
    parts: [
      { id: 'reference', label: 'Reference', text: 'The figure to compare with. It stays as it is.' },
      { id: 'compare', label: 'Compare', variant: 'samediff', text: 'The same figure turned in space, or its mirror image turned. Same number of cubes either way.' },
      { id: 'options', label: 'Options', variant: 'pick', text: 'Four figures: two are the reference turned, two are its mirror image turned.' },
      { id: 'answer', label: 'Answer', text: 'Tap Same or Mirror, or press 1 or 2. For “pick two”, choose two options (tap, or keys 1–4), then Confirm or press Enter.' },
    ],
    // Easy and clearly visible: a 40° turn about the vertical axis, 8 cubes.
    demo: [
      { params: { angle: 1, axis: 0, cubes: 1, variant: 'samediff' }, seed: 4, kind: 'same' },
      { params: { angle: 1, axis: 0, cubes: 1, variant: 'samediff' }, seed: 7, kind: 'mirror' }, // the last arm (3 cubes) differs
    ],
    practice: [
      { angle: 0, axis: 0, cubes: 1, variant: 'samediff' },
      { angle: 1, axis: 0, cubes: 1, variant: 'samediff' },
      { angle: 2, axis: 1, cubes: 1, variant: 'samediff' },
      { angle: 1, axis: 0, cubes: 1, variant: 'pick' },
    ],
    tips: [
      { id: 'depth', when: { dim: 'axis', levels: [0, 1] }, text: 'This turn goes in depth: parts of the figure swing towards you or away. Watch where the end arms go.' },
      { id: 'picture', when: { dim: 'axis', levels: [2] }, text: 'This turn stays flat on the screen, like a clock hand. Turn it back in your mind and compare.' },
      { id: 'oblique', when: { dim: 'axis', levels: [3] }, text: 'This turn is about a slanted axis. Line up one arm first, then check where the others point.' },
      { id: 'pick', when: { variant: 'pick' }, text: 'Two options are turned copies and two are mirror images. Pick the two copies.' },
      { id: 'large', when: { dim: 'angle', levels: [6, 7, 8] }, text: 'Big turns take longer for everyone. Accuracy matters more than speed here.' },
      { id: 'cubes', when: { dim: 'cubes', levels: [3] }, text: 'More cubes, same idea: compare where the arms point, not how many cubes there are.' },
    ],
    // Hegarty 2010 and Stieff et al. 2014: people who use both kinds of strategy, and switch,
    // tend to do better. Counting cubes went with more errors (Hegarty 2018). research/B §2.
    strategies: [
      {
        id: 'imagery', title: 'Turn it as one piece',
        text: 'Picture the reference as one solid object and turn it, all of it at once, until it lines up with the other figure.',
        steps: [
          'Choose the turn that brings the longest arm into line.',
          'Turn the whole figure smoothly, every cube together.',
          'Compare the end arms: all in place means same; one pointing the other way means mirror.',
        ],
        when: 'Quick for small and medium turns.',
      },
      {
        id: 'analytic', title: 'Follow one arm, then the next',
        text: 'Start at one end. Find the same end in the other figure, then walk along the figure arm by arm.',
        steps: [
          'Find an end arm you can recognise in both figures: its length and the arm it joins.',
          'From there, check each bend: does the next arm turn the same way in both figures?',
          'The first bend that turns the other way means a mirror image.',
        ],
        when: 'Steady for big or slanted turns, or when the picture in your head gets blurry.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Neither way is always better. People who can use both tend to score higher on rotation tasks.',
        steps: [
          'If turning the whole figure gets blurry or you lose track, switch to following arms.',
          'If following arms gets slow, step back and turn the whole figure for a quick check.',
          'Don’t count cubes: a mirror image has exactly the same cubes. Compare directions instead.',
        ],
        when: 'After two misses in a row, try the other way on the next item.',
      },
    ],
    captions: {
      reference: 'This is the reference figure.',
      compare: 'The right figure is either the same figure turned, or its mirror image turned.',
      options: 'Two options are the reference turned around; two are its mirror image.',
      turn: 'Watch the reference turn the way the other figure is turned.',
      turnTo: 'Turning the reference like option {n}.',
      back: 'Back to the start.',
      same: 'Now they match exactly: it is the same figure.',
      sameOption: 'Option {n} matches: it is a turned copy.',
      mirror: 'Turned like this, the highlighted arm points the other way. No turn can fix that: it is the mirror image.',
      mirrorOption: 'Option {n} is a mirror image: turned like this, the highlighted arm points the other way.',
    },
    bridge: 'Chemists ask the same question about molecules (is this drawing the same molecule or its mirror image?). Engineers turn objects in their heads too. Practice here improves this kind of task and often similar ones; it has not been shown to improve grades or job performance.',
  });
})(window.PX);
