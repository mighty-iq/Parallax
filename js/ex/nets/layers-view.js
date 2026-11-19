/* EX-05 Nets: drawing for the add-on layers (v1.2 wave 2, W2-bets; js/ex/nets/layers.js).
   PX.ui.betsViews.nets.solved(host, item, opts) draws a solved 'opposite' net: six named squares, the
   shaded square shaded, its opposite ringed and ticked; mark(true) draws the Z of four squares from one to
   the other. Ink and green only (never the accent). */
(function (PX) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var V = PX.ui.betsViews = PX.ui.betsViews || {};
  function E(tag, attrs, kids) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function label(x, y, s, cls) { var t = E('text', { x: x, y: y, class: cls, 'text-anchor': 'middle', 'dominant-baseline': 'central' }); t.textContent = s; return t; }

  V.nets = {
    solved: function (host, item) {
      var F = PX.engine.bets.content('nets').facts, sq = item.squares, opp = F.opposite(item);
      var xs = sq.map(function (q) { return q.x; }), ys = sq.map(function (q) { return q.y; });
      var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys), w = Math.max.apply(null, xs) - x0 + 1, hgt = Math.max.apply(null, ys) - y0 + 1;
      var side = Math.max(w, hgt) + 0.6;
      var vb = [x0 - (side - w) / 2, y0 - (side - hgt) / 2, side, side].map(function (v) { return v.toFixed(3); }).join(' ');
      var svg = E('svg', { viewBox: vb, class: 'px-bets-fig bets-nets', role: 'img',
        'aria-label': 'A net of six squares: the shaded square ' + sq[item.marked].name + ' and its opposite square ' + (opp >= 0 ? sq[opp].name : '') + ', ticked' });
      sq.forEach(function (q, i) { svg.appendChild(E('rect', { x: q.x, y: q.y, width: 1, height: 1, class: 'bets-nets-sq' + (i === item.marked ? ' is-marked' : '') })); });
      // the rule under the names: the Z of four squares
      var markG = E('g', { class: 'bets-nets-markg' });
      markG.style.display = 'none';
      var path = opp >= 0 ? F.zPath(sq, item.marked, opp) : null;
      if (path) markG.appendChild(E('polyline', { points: path.map(function (i) { return (sq[i].x + 0.5) + ',' + (sq[i].y + 0.5); }).join(' '), class: 'bets-nets-z' }));
      svg.appendChild(markG);
      if (opp >= 0) svg.appendChild(E('rect', { x: sq[opp].x + 0.1, y: sq[opp].y + 0.1, width: 0.8, height: 0.8, class: 'bets-nets-opp' }));
      sq.forEach(function (q) { svg.appendChild(label(q.x + 0.5, q.y + 0.5, q.name, 'bets-nets-name')); });
      if (opp >= 0) svg.appendChild(label(sq[opp].x + 0.8, sq[opp].y + 0.22, '✓', 'bets-nets-tick'));
      host.appendChild(svg);
      return { mark: function (on) { markG.style.display = on ? '' : 'none'; } };
    },
  };
})(window.PX);
