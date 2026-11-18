/* EX-20 Central Point: drawing for the add-on layers (v1.2 wave 2, W2-bets; js/ex/centralpoint/layers.js).
   PX.ui.betsViews.centralpoint.solved(host, item, opts) draws a solved board (dots, targets, the best spot
   and the lines to it) into host and returns { mark(on) }: mark(true) shows the principle on it (equal pull
   arrows; the two lines joining opposite targets). Never the average position (PLAN Defaults). Colours:
   ink and green, never the accent. Geometry in half-steps (0–12). */
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
  function facts() { var c = PX.engine.bets.content('centralpoint'); return c && c.facts; }

  function arrow(x0, y0, dx, dy, len, cls) {
    var x1 = x0 + dx * len, y1 = y0 + dy * len, hx = -dy, hy = dx, a = 0.32, w = 0.18;
    return E('g', { class: cls }, [
      E('line', { x1: x0, y1: y0, x2: x1 - dx * a * 0.6, y2: y1 - dy * a * 0.6 }),
      E('path', { d: 'M' + x1 + ' ' + y1 + ' L' + (x1 - dx * a + hx * w) + ' ' + (y1 - dy * a + hy * w) + ' L' + (x1 - dx * a - hx * w) + ' ' + (y1 - dy * a - hy * w) + ' Z' }),
    ]);
  }

  V.centralpoint = {
    solved: function (host, item, opts) {
      opts = opts || {};
      var g = item.gm, k = item.key, T = item.targets;
      var svg = E('svg', { viewBox: '-1 -1 14 14', class: 'px-bets-fig bets-cp', role: 'img',
        'aria-label': T.length + ' targets with the best spot marked and a line from it to each target' });
      var grid = E('g', { class: 'bets-cp-grid' });
      for (var y = 0; y <= 12; y += 2) for (var x = 0; x <= 12; x += 2) grid.appendChild(E('circle', { cx: x, cy: y, r: 0.13, class: 'bets-cp-dot' }));
      svg.appendChild(grid);
      var lines = E('g', { class: 'bets-cp-lines' });
      T.forEach(function (t) { lines.appendChild(E('line', { x1: k.x, y1: k.y, x2: t[0], y2: t[1], class: 'bets-cp-line' })); });
      svg.appendChild(lines);
      var markG = E('g', { class: 'bets-cp-markg' });
      markG.style.display = 'none';
      svg.appendChild(markG);
      T.forEach(function (t) {
        svg.appendChild(E('g', { transform: 'translate(' + t[0] + ' ' + t[1] + ')' }, [E('circle', { r: 0.44, class: 'bets-cp-ring' }), E('circle', { r: 0.1, class: 'bets-cp-pip' })]));
      });
      svg.appendChild(E('circle', { cx: k.x, cy: k.y, r: 0.62, class: 'bets-cp-best' }));
      svg.appendChild(E('circle', { cx: k.x, cy: k.y, r: 0.14, class: 'bets-cp-bestpip' }));
      // the principle: equal pulls from the continuous best spot, or the two lines across
      var F = facts();
      if (opts.principle === 'crossing' && F) {
        var x = F.crossPoint(T);
        if (x) {
          [x.pairs[0], x.pairs[1]].forEach(function (pr) {
            var a = T[pr[0]], b = T[pr[1]];
            markG.appendChild(E('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'bets-cp-diag' }));
          });
        }
      } else {
        T.forEach(function (t) {
          var dx = t[0] - g[0], dy = t[1] - g[1], d = Math.sqrt(dx * dx + dy * dy);
          if (d > 1e-9) markG.appendChild(arrow(g[0], g[1], dx / d, dy / d, 1.25, "bets-cp-pull"));
        });
      }
      host.appendChild(svg);
      return {
        mark: function (on) {
          markG.style.display = on ? '' : 'none';
          lines.style.opacity = on ? '0.35' : '';
          svg.setAttribute('aria-label', T.length + ' targets with the best spot marked' + (on ? (opts.principle === 'crossing' ? '; the lines joining opposite targets cross at it' : '; equal arrows from it point to every target') : ' and a line from it to each target'));
        },
      };
    },
  };
})(window.PX);
