/* PR-6 Other Way Round: instruction data (pure, data only; PLAN milestone 6; note T1 §5.1).
   A probe is never trained: no practice items, no tips, no strategy cards and no feedback. Before the first item the
   Check shows `instruction`; before each strand's first item on first contact, that strand's worked example
   (`demo` with params.variant, played by view.demo with `explain`), from fixed seeds the Check never scores.
   Wording: about the task, never the person. */
(function (PX) {
  'use strict';

  PX.ex.learn('otherway', {
    goal: 'Six kinds of question that ask familiar skills the other way round.',
    instruction: {
      title: 'Other Way Round',
      lines: [
        'The kinds: turn a figure, unfold a sheet, find a cut, fold a net, name a side, find your place on a map.',
        'Each asks a skill you may know from the training the other way round, so read each question line first.',
        'There is no feedback in this check. Answer as well as you can; a guess is fine when you are unsure.',
      ],
    },
    // one worked example per strand, at the easiest level
    demo: [
      { params: { variant: 'turn', level: 0 }, seed: 11, kind: 'turn' },
      { params: { variant: 'foldback', level: 0 }, seed: 12, kind: 'foldback' },
      { params: { variant: 'cutback', level: 0 }, seed: 13, kind: 'cutback' },
      { params: { variant: 'netback', level: 0 }, seed: 14, kind: 'netback' },
      { params: { variant: 'viewfrom', level: 0 }, seed: 15, kind: 'viewfrom' },
      { params: { variant: 'whereami', level: 0 }, seed: 16, kind: 'whereami' },
    ],
    explain: {
      turn: ['The line is the axis; the curved arrow shows which way the figure turns about it, and how far.', 'Picture the turn, then look for the arm that moves the most: only one picture has every arm where the turn puts it.'],
      foldback: ['Each plan folds along its dashed creases in order (one tick marks the first, two ticks the second), the arrows showing which part goes over, and punches once where the big dot is.', 'Unfold the plan in your head: every fold that the punch goes through mirrors the hole across its crease. One plan gives exactly these holes.'],
      cutback: ['The face is drawn at true size. Each solid shows one flat cut as a shaded shape.', 'Compare the cut\'s corners and side lengths with the face: one cut matches it, the others have other proportions.'],
      netback: ['The first picture shows three faces of the cube; turned over, the second shows the other three.', 'Faces opposite each other on the cube are never next to each other on a net, and the order of faces around a corner must match.'],
      viewfrom: ['The flat drawing shows how tall the cubes stand when you look from one side, column by column.', 'Walk round the cubes in your head: from the back, left and right swap; only one side gives these columns in this order.'],
      whereami: ['The circle shows a few numbered landmarks at their directions from you, with ahead at the top.', 'Stand on each lettered spot and turn until the landmarks lie in those directions: only one spot works.'],
    },
  });
})(window.PX);
