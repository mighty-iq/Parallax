/* EX-05 Nets: its add-on layers (v1.2 wave 2, W2-bets; PLAN milestone 4; note T1 §4.1, §4.2). Pure: the facts
   a comparison round states about a solved net, from the squares' grid positions. Drawing: layers-view.js.

   Principles (each sentence proved on the model, tests/node/layers-nets.test.mjs: whenever the pattern is
   there, the rolled faces agree, over every net of 10,000 items):
     z-ends       two squares at the two ends of a Z of four squares (a step, a turn, a step the same way)
                  end up opposite. Scored 'opposite' items with two faces between are all such pairs
                  (a pair at net distance 3 is opposite only as a Z), so the rule decides them.
     (corner-meet, two edges along a concave corner always meet, is proved too but not offered: on a yes/no
     item an apply item chosen to show it would always be a "yes", which gives the answer away.)
   Off-screen: the learn.js challenge (cut out and fold a net) stays; the exercise page adds "I did it". */
(function (PX) {
  'use strict';

  var B = PX.engine && PX.engine.bets, def = PX.ex.get('nets');
  if (!B || !def) return;
  var D = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

  function at(sq, x, y) { for (var i = 0; i < sq.length; i++) if (sq[i].x === x && sq[i].y === y) return i; return -1; }
  // The squares a, d are the ends of a Z of four squares a-b-c-d: a step, a perpendicular step, and a step
  // the same way as the first (both orientations), every square of the net.
  function zPath(sq, a, d) {
    var A = sq[a], Dd = sq[d];
    if (!A || !Dd) return null;
    var steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < 4; i++) {
      var s = steps[i], b = at(sq, A.x + s[0], A.y + s[1]);
      if (b < 0) continue;
      for (var j = 0; j < 4; j++) {
        var t = steps[j];
        if (t[0] * s[0] + t[1] * s[1] !== 0) continue; // perpendicular
        var c = at(sq, sq[b].x + t[0], sq[b].y + t[1]);
        if (c < 0) continue;
        if (sq[c].x + s[0] === Dd.x && sq[c].y + s[1] === Dd.y) return [a, b, c, d];
      }
    }
    return null;
  }
  function opposite(it) { return it && it.variant === 'opposite' ? it.options[it.key].sq : -1; }
  function zEnds(it) { return it.variant === 'opposite' && !!zPath(it.squares, it.marked, opposite(it)); }
  // Two marked edges on two squares of an L that both face its empty corner square.
  function cornerOf(it) {
    if (it.variant !== 'edges' || !it.edges || it.edges.length !== 2) return null;
    var e = it.edges, a = it.squares[e[0].sq], b = it.squares[e[1].sq];
    if (!a || !b || e[0].sq === e[1].sq) return null;
    var pa = [a.x + D[e[0].side][0], a.y + D[e[0].side][1]], pb = [b.x + D[e[1].side][0], b.y + D[e[1].side][1]];
    if (pa[0] !== pb[0] || pa[1] !== pb[1] || at(it.squares, pa[0], pa[1]) >= 0) return null;
    if (Math.abs(a.x - b.x) !== 1 || Math.abs(a.y - b.y) !== 1) return null; // diagonal neighbours around the gap
    var mid = at(it.squares, a.x + b.x - pa[0], a.y + b.y - pa[1]); // the L's corner square
    return mid >= 0 ? { gap: pa, mid: mid } : null;
  }
  function sameRow(it, a, b) { var A = it.squares[a], Bq = it.squares[b]; return !!A && !!Bq && (A.x === Bq.x || A.y === Bq.y); }
  function never() { return false; }

  function adjacent(A, Bq) { return Math.abs(A.x - Bq.x) + Math.abs(A.y - Bq.y) === 1; }
  // Statements about an 'opposite' item (the rounds take that variant only): the claim, wrong rules no
  // item makes true, and facts that some nets make true. Their words overlap the tips as the claim's do.
  var STATEMENTS = [
    { id: 'z-ends', text: 'The marked square and its opposite end a Z shape of four squares.', test: zEnds },
    { id: 'touch-opposite', text: 'A square that touches the marked square in the net ends up opposite it.', test: never },
    { id: 'farthest', text: 'The square farthest from the marked one in the flat net is the opposite one.', test: function (it) {
      if (it.variant !== 'opposite') return false;
      var m = it.squares[it.marked], best = -1, who = [];
      it.options.forEach(function (o) { var q = it.squares[o.sq], d = Math.abs(q.x - m.x) + Math.abs(q.y - m.y); if (d > best) { best = d; who = [o.sq]; } else if (d === best) who.push(o.sq); });
      return who.length === 1 && who[0] === opposite(it);
    } },
    { id: 'in-line', text: 'The marked square and its opposite lie in one straight row or column of the net.', test: function (it) { return it.variant === 'opposite' && sameRow(it, it.marked, opposite(it)); } },
    { id: 'shared-touch', text: 'The marked square and its opposite both touch one same square in the net.', test: function (it) {
      if (it.variant !== 'opposite') return false;
      var a = it.squares[it.marked], d = it.squares[opposite(it)];
      return it.squares.some(function (q) { return adjacent(q, a) && adjacent(q, d); });
    } },
    { id: 'same-colour', text: 'The marked square and its opposite have the same colour.', test: function (it) { return it.variant === 'opposite' && it.squares[it.marked].colour === it.squares[opposite(it)].colour; } },
    { id: 'corner-touch', text: 'The marked square and its opposite touch at a corner.', test: function (it) {
      if (it.variant !== 'opposite') return false;
      var a = it.squares[it.marked], d = it.squares[opposite(it)];
      return Math.abs(a.x - d.x) === 1 && Math.abs(a.y - d.y) === 1;
    } },
    { id: 'long-row', text: 'The net has a long row of four squares in a line.', test: function (it) {
      var sq = it.squares;
      return sq.some(function (q) { return [[1, 0], [0, 1]].some(function (st) { for (var k = 1; k < 4; k++) if (at(sq, q.x + st[0] * k, q.y + st[1] * k) < 0) return false; return true; }); });
    } },
  ];

  B.register('nets', {
    compare: {
      principles: [
        { id: 'z-ends', claim: 'z-ends', anyItem: true, applies: function (p) { return !p || (p.variant === 'opposite' && p.between === 0); },
          text: 'Two squares at the two ends of a Z of four squares (a step, a turn, then a step the same way) always end up opposite each other.' },
      ],
      statements: STATEMENTS,
    },
    facts: { zPath: zPath, opposite: opposite, cornerOf: cornerOf, at: at },
  });
})(window.PX);
