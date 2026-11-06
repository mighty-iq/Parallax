/* EX-06 Slice: tutorial data (pure, data only; ARCHITECTURE.md §2, PLAN.md §8).
   Watch–Try–Go: goal and labelled parts → demo (view.demo plays it with `captions`) → practice
   items (not logged) with just-in-time tips → an easy scored start. Shapes as in
   js/ex/rotate/learn.js. Wording (CLAUDE.md 2, 12): about the task, never the person. */
(function (PX) {
  'use strict';

  PX.ex.learn('slice', {
    goal: 'A flat plane cuts through the solid: which outline is the cut face, seen straight on?',
    parts: [
      { id: 'solid', label: 'Solid', text: 'One solid, two solids joined into one, or a solid inside a see-through one.' },
      { id: 'plane', label: 'Cutting plane', text: 'The tinted sheet. It slices right through the solid; the cut face lies in this sheet.' },
      { id: 'options', label: 'Options', text: 'Four outlines. One is the cut face turned to face you; a grey region inside another is the inner solid’s part of the cut.' },
      { id: 'answer', label: 'Answer', text: 'Tap an outline or press its key (1–4).' },
    ],
    // Easiest level: one straight-sided solid, a cut parallel to a face.
    demo: [
      { params: { structure: 0, cut: 0, curved: 0 }, seed: 1, kind: 'box' },
      { params: { structure: 0, cut: 0, curved: 1 }, seed: 2, kind: 'cylinder' },
    ],
    practice: [ // easiest first
      { structure: 0, cut: 0, curved: 0 },
      { structure: 1, cut: 0, curved: 0 },
      { structure: 0, cut: 0, curved: 1 },
      { structure: 2, cut: 0, curved: 1 },
      { structure: 0, cut: 1, curved: 0 },
    ],
    tips: [
      { id: 'facing', when: { dim: 'cut', levels: [0] }, text: 'The cut face is seen at a slant, so on the screen it looks squashed. Picture it turned to face you before you choose.' },
      { id: 'oblique', when: { dim: 'cut', levels: [1] }, text: 'This plane is tilted: the cut face stretches along the tilt. A tilted cut through a box can give a long rectangle, through a cylinder an ellipse.' },
      { id: 'double', when: { dim: 'cut', levels: [2] }, text: 'Tilted two ways: the plane can meet extra faces. Count the faces it crosses: each one adds an edge to the outline.' },
      { id: 'joined', when: { dim: 'structure', levels: [1] }, text: 'Two solids joined into one: the cut may cross both (one outline with a step where they meet) or only one of them.' },
      { id: 'embedded', when: { dim: 'structure', levels: [2] }, text: 'A solid inside a see-through one: if the plane cuts both, the cut face is an outline inside an outline.' },
      { id: 'curved', when: { dim: 'curved', levels: [1] }, text: 'Curved surfaces give curved edges. Where the plane runs along the curve, the outline is round; where it crosses flat ends, it is straight.' },
    ],
    // Cohen & Hegarty 2012: the most common error is the egocentric one (choosing the section as it
    // appears from the viewpoint); visualising the cut, then the turn, helped. Analytic edge-tracing
    // as in Tsutsumi 2013 (MCT). Using both, and switching, goes with better scores (Hegarty 2010).
    strategies: [
      {
        id: 'imagery', title: 'Slice it and turn the face',
        text: 'Picture the solid cut along the plane, lift the front piece away, and turn the cut face until it faces you.',
        steps: [
          'Picture the plane going all the way through the solid.',
          'Lift away the piece in front of the plane: the cut face is left.',
          'Turn that face toward you, then compare its shape with the outlines.',
        ],
        when: 'Quick for single solids and straight cuts.',
      },
      {
        id: 'analytic', title: 'Walk around the cut',
        text: 'Follow the line where the plane meets the surface, one face at a time.',
        steps: [
          'Every flat face the plane crosses adds one straight edge; a curved surface adds a curve.',
          'Count the edges and note which ones are curved.',
          'Compare lengths: the cut is longest along the plane’s tilt. An inner solid adds an outline inside.',
        ],
        when: 'Steady for tilted cuts, joined solids and solids inside solids.',
      },
      {
        id: 'switch', title: 'When to switch',
        text: 'Neither way is always better: when one stalls, try the other.',
        steps: [
          'If the picture of the cut gets blurry, walk around it edge by edge.',
          'If counting edges gets slow, picture the cut face turning toward you for a quick check.',
          'Don’t choose the shape as it looks from here: seen at a slant, the face looks squashed.',
        ],
        when: 'After two misses in a row, try the other way on the next item.',
      },
    ],
    captions: {
      solid: 'This is the solid.',
      plane: 'The tinted sheet is the cutting plane: it slices right through the solid.',
      options: 'Four outlines: one is the cut face, turned to face you.',
      sweep: 'Watch the plane slide into the solid. The tinted face is where it cuts.',
      lift: 'Lift away the front piece: the cut face is left.',
      slant: 'From here the cut face is seen at a slant, so it looks squashed, like outline {n}. That is not its true shape.',
      slantPicked: 'Outline {n}, the one chosen, is the cut face seen at a slant, squashed. Its true shape shows when it faces you.',
      turn: 'Turn the cut face until it faces you.',
      land: 'Seen straight on, the cut face is outline {n}.',
      whyCut: 'Outline {n} is a cut through the same solid at another angle.',
      whySolid: 'Outline {n} is what the same plane would cut from a different solid.',
      whyProj: 'Outline {n} is the outline of the whole solid as seen from here, not a cut.',
    },
    bridge: 'Doctors read CT and MRI scans as slices like these, and geologists and engineers picture cuts through rock and machine parts. Practising here improves this task and often similar ones; it has not been shown to improve grades or job performance.',
  });
})(window.PX);
