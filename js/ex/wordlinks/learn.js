/* PR-0 Word Links: instruction data (pure, data only; PHASE-B.md "Probes", PLAN.md §4 and §6).
   The non-spatial control probe: never trained, no practice, tips or strategy cards. The
   one-screen instruction plays one worked example (view.demo) at the easiest level with a fixed
   seed that the Spatial Check never scores. Sentences per relation explain a pair in show me and
   the example: {a}/{b} a word, {a*}/{b*} with "a"/"an", {A…} the same with a capital letter. */
(function (PX) {
  'use strict';

  PX.ex.learn('wordlinks', {
    goal: 'A is to B as C is to …? Pick the word that goes with C the way B goes with A.',
    instruction: [
      'Each question reads “A is to B as C is to …?”. First see how the first two words are linked.',
      'Then pick the word that is linked to the third word in the same way. One of the four words fits.',
      'The bar shows the time left. This check is about words, not space: it helps tell apart what comes from practice with tests in general.',
    ],
    parts: [
      { id: 'pair', label: 'First pair', text: 'Two words with a link between them.' },
      { id: 'third', label: 'Third word', text: 'Find its partner with the same link.' },
      { id: 'answer', label: 'Words', text: 'Four words: keys 1 to 4, or tap one.' },
    ],
    // The worked example: concrete relation, common words, loose foils. Seed 1931:
    // dog : puppy :: pig : ?  (piglet; the other words are linked to pigs in other ways).
    demo: [{ params: { relation: 0, words: 0, foils: 0 }, seed: 1931, kind: 'young' }],
    practice: [],
    tips: [],
    captions: {
      first: 'Look at the first pair: {a} and {b}.',
      link: '{ab}',
      second: 'Now find the word that goes with {c} in the same way.',
      answer: '{cd} The answer is “{d}”.',
      others: 'The other words go with {c} in other ways, or not at all.',
      keys: 'Answer with the keys 1 to 4, or tap a word.',
      verdict: '{d}: {cd}',
    },
    sentences: {
      young: 'A young {a} is called {b*}.',
      sound: '{A*} makes the sound “{b}”.',
      part: '{A*} is part of {b*}.',
      material: '{A*} is made of {b}.',
      home: '{A*} lives in {b*}.',
      source: '{A} comes from {b*}.',
      tool: '{A*} is used to {b}.',
      kind: '{A*} is a kind of {b}.',
      action: 'What {a*} does: {b}.',
      place: 'The place where {a*} works: {b}.',
      opposite: '{A} is the opposite of {b}.',
      degree: '{B} is a stronger form of {a}.',
      measure: '{A*} measures {b}.',
      symbol: '{A*} stands for {b}.',
    },
  });
})(window.PX);
