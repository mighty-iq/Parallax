/* PX.ui.welcome, PX.ui.chimera, PX.ui.figures (PLAN.md §9, CLAUDE.md rule 1).

   PX.ui.chimera: the Chimera Discord link, used by the welcome pop-up, the header, the
   footer, the More sheet and About.
     URL                        'https://discord.gg/chmr'
     joinLink(opts) → <a>       target=_blank rel=noopener, styled as a button.
                                opts: { label, kind: 'primary' | 'secondary', className, onClick }
     linkCopy(opts) → element   the address as visible, selectable text with a Copy button.
                                Copy tries the async clipboard and falls back to execCommand
                                (the async API and new tabs are blocked in sandboxed previews).
                                opts: { label (aria), className }
   PX.ui.figures: specimen drawings (SVG, decorative, no text that matters).
     polycube(cells, opts) → { g, w, h }   isometric line drawing of unit cubes [[x, y, z], …]:
                                visible faces only, painter's order, faces .px-fig-top/-side/-far
     plate(opts) → element      a specimen plate: one figure seen from two viewpoints (B is A turned
                                90° about the vertical axis through its tall arm, AXIS: same scale,
                                same camera, the axis drawn as a dotted line in both), the turn
                                drawn as an arc, registration marks at the corners. Every cube
                                shows a whole face in both drawings (tests/e2e/shell.py checks it).
                                opts: { className, label }
   PX.ui.welcome: the pop-up on every app open.
     show({ onClose(reason) }) → close     reason: 'start' (Start training) or 'dismiss'
                                           (✕, Esc, backdrop). Focus is trapped (PX.ui.modal);
                                           app.js decides where focus goes afterwards. On iPhones,
                                           iPads and recognisable in-app browsers (not from the
                                           home screen) it ends with the storage hint and, when a
                                           backup is due, a Back up button. It opens at its top.
     isOpen()
     device() → { ios, standalone, inApp, touch }   where the app runs (the hint, app.js) */
(function (PX) {
  'use strict';

  var ui = PX.ui;
  var h = ui.h;
  var S = PX.core.svg;

  var URL = 'https://discord.gg/chmr';
  var seq = 0;

  /* ---------- icons used here (stroke icons on a 24 grid, currentColor) ---------- */

  function svgIcon(d, cls) {
    var root = S.el('svg', { viewBox: '0 0 24 24', class: 'px-icon' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true', focusable: 'false' });
    root.appendChild(S.el('path', { d: d }));
    return root;
  }
  var EXTERNAL = 'M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5';

  /* ---------- Chimera link ---------- */

  function joinLink(opts) {
    opts = opts || {};
    var a = h('a', {
      class: ['px-btn', 'px-btn--' + (opts.kind || 'primary'), opts.className],
      href: URL, target: '_blank', rel: 'noopener',
      'data-chimera': 'join',
    }, h('span', opts.label || 'Join the Chimera Discord'), svgIcon(EXTERNAL));
    a.setAttribute('aria-label', (opts.label || 'Join the Chimera Discord') + ' (opens in a new tab)');
    if (typeof opts.onClick === 'function') a.addEventListener('click', opts.onClick);
    return a;
  }

  function linkCopy(opts) {
    opts = opts || {};
    var id = 'px-linkcopy-' + (++seq);
    var input = h('input.px-linkcopy-url', {
      id: id, type: 'text', readonly: true, value: URL, spellcheck: 'false', autocomplete: 'off',
      autocapitalize: 'off', 'aria-label': opts.label || 'Chimera Discord address',
    });
    var status = h('span.px-linkcopy-status', { role: 'status', 'aria-live': 'polite' });
    var btn = ui.button('Copy', { kind: 'secondary', className: 'px-linkcopy-btn', ariaLabel: 'Copy the Chimera Discord address' });

    function say(text, kind) {
      status.textContent = text;
      status.className = 'px-linkcopy-status' + (kind ? ' is-' + kind : '');
    }
    btn.addEventListener('click', function () {
      ui.copyText(URL, input).then(function (ok) {
        if (ok) {
          say('Copied. Paste it into your browser or the Discord app.', 'ok');
          if (document.activeElement === input) btn.focus(); // execCommand moved focus to the field
          try { input.setSelectionRange(0, 0); } catch (e) { /* not selectable */ }
        } else {
          try { input.focus(); input.select(); } catch (e) { /* ignore */ }
          say('Copying is blocked here. The address is selected: press Ctrl+C (Cmd+C on a Mac), or long-press it and choose Copy.', 'warn');
        }
      });
    });
    input.addEventListener('focus', function () { try { input.select(); } catch (e) { /* ignore */ } });
    var root = h('div', { class: ['px-linkcopy-wrap', opts.className] },
      h('div.px-linkcopy', input, btn), status);
    root.say = say;
    return root;
  }

  // After a click on the join link: when the page still has focus a moment later, no new tab
  // took over (blocked in sandboxed previews), so point at the address. Harmless otherwise.
  function nudgeIfBlocked(copyEl) {
    window.setTimeout(function () {
      var stillHere = false;
      try { stillHere = document.hasFocus() && document.visibilityState !== 'hidden'; } catch (e) { stillHere = false; }
      if (stillHere && copyEl && copyEl.say && document.contains(copyEl)) {
        copyEl.say('If no new tab opened, copy the address above and open it yourself.', null);
      }
    }, 900);
  }

  /* ---------- figures ---------- */

  var C30 = Math.cos(Math.PI / 6);

  function proj(x, y, z, u) { return [(x - y) * u * C30, (x + y) * u * 0.5 - z * u]; }

  function keyOf(x, y, z) { return x + ',' + y + ',' + z; }

  // Isometric drawing, viewer at (+1, +1, +1): faces +z (top), +x (side), +y (far side) show.
  // Painter's order by x + y + z (cubes with equal sums never overlap in this view). Each face
  // carries data-cube (its cell's index in `cells`), so tests can measure what stays visible.
  // → { g, w, h, x0, y0 } (x0, y0: the shift applied to the projected points, in drawing units)
  function polycube(cells, opts) {
    opts = opts || {};
    var u = opts.unit || 20;
    var set = {}, i, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (i = 0; i < cells.length; i++) set[keyOf(cells[i][0], cells[i][1], cells[i][2])] = true;
    var order = cells.map(function (c, n) { return [c, n]; }).sort(function (A, B) {
      var a = A[0], b = B[0];
      return (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]) || a[2] - b[2] || a[0] - b[0];
    });
    var faces = [];
    order.forEach(function (cn) {
      var c = cn[0], x = c[0], y = c[1], z = c[2];
      if (!set[keyOf(x, y, z + 1)]) faces.push(['px-fig-top', [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], cn[1]]);
      if (!set[keyOf(x + 1, y, z)]) faces.push(['px-fig-side', [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]], cn[1]]);
      if (!set[keyOf(x, y + 1, z)]) faces.push(['px-fig-far', [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], cn[1]]);
    });
    var pts = faces.map(function (f) {
      return f[1].map(function (p) {
        var q = proj(p[0], p[1], p[2], u);
        if (q[0] < minX) minX = q[0];
        if (q[0] > maxX) maxX = q[0];
        if (q[1] < minY) minY = q[1];
        if (q[1] > maxY) maxY = q[1];
        return q;
      });
    });
    var g = S.el('g', { class: opts.className || 'px-fig', 'data-cells': JSON.stringify(cells) });
    for (i = 0; i < faces.length; i++) {
      var shifted = pts[i].map(function (q) { return [q[0] - minX, q[1] - minY]; });
      g.appendChild(S.path(shifted, true, { class: 'px-fig-face ' + faces[i][0], 'data-cube': faces[i][2] }));
    }
    return { g: g, w: maxX - minX, h: maxY - minY, x0: minX, y0: minY };
  }

  // Turns cells 90° about the vertical axis: (x, y, z) → (−y, x, z), moved back to x, y ≥ 0.
  function turnZ(cells) {
    var out = cells.map(function (c) { return [-c[1], c[0], c[2]]; });
    var mx = Math.min.apply(null, out.map(function (c) { return c[0]; }));
    var my = Math.min.apply(null, out.map(function (c) { return c[1]; }));
    return out.map(function (c) { return [c[0] - mx, c[1] - my, c[2]]; });
  }
  // Turns cells 90° about the vertical line through (ax, ay) (a column's centre): each cube's
  // centre (x, y) goes to (ax − (y − ay), ay + (x − ax)); the cubes on the axis stay put.
  function turnAbout(cells, ax, ay) {
    return cells.map(function (c) {
      return [Math.round(ax - (c[1] + 0.5 - ay) - 0.5), Math.round(ay + (c[0] + 0.5 - ax) - 0.5), c[2]];
    });
  }

  // A chiral ten-cube figure in the Shepard–Metzler style: four arms, three bends. Chosen so that
  // every cube shows at least one whole face in both drawings (no two cubes differ by k·(1, 1, 1),
  // which would put one exactly behind the other). B turns it 90° about the vertical axis through
  // its tall arm (AXIS, cell centres), drawn as the dotted line in both views.
  var FIGURE = [[2, 0, 2], [2, 0, 1], [2, 0, 0], [2, 1, 0], [2, 2, 0], [2, 2, 1], [2, 2, 2], [2, 2, 3], [1, 2, 3], [0, 2, 3]];
  var AXIS = [2.5, 2.5];

  // The axis foot (AXIS at z = 0) in a polycube drawing's own coordinates (unit u).
  function axisIn(fig, u) { var p = proj(AXIS[0], AXIS[1], 0, u); return { x: p[0] - fig.x0, y: p[1] - fig.y0 }; }

  function regMarks(w, h, inset, len) {
    var d = '';
    [[inset, inset, 1, 1], [w - inset, inset, -1, 1], [inset, h - inset, 1, -1], [w - inset, h - inset, -1, -1]].forEach(function (m) {
      d += 'M' + (m[0] + m[2] * len) + ' ' + m[1] + 'H' + m[0] + 'V' + (m[1] + m[3] * len);
    });
    return S.el('path', { class: 'px-plate-reg', d: d });
  }

  function plate(opts) {
    opts = opts || {};
    var W = 520, H = 210, U = 20, TOP = 16, BOTTOM = 184, HALF = 110, AT = [130, 390];
    var root = S.svg(W, H, { class: 'px-plate-fig' });
    root.appendChild(regMarks(W, H, 10, 12));
    // the vertical axis B turns about, drawn behind both views
    root.appendChild(S.el('path', { class: 'px-plate-axis', d: 'M' + AT[0] + ' 6V189M' + AT[1] + ' 6V189' }));
    // One scale for both drawings, each placed with the axis foot on its dotted line at the same
    // height: B is A after a quarter turn about that axis, seen by the same camera.
    var A = polycube(FIGURE, { unit: U }), B = polycube(turnAbout(FIGURE, AXIS[0], AXIS[1]), { unit: U });
    var a = axisIn(A, U), b = axisIn(B, U);
    var up = Math.max(a.y, b.y), down = Math.max(A.h - a.y, B.h - b.y), side = Math.max(a.x, A.w - a.x, b.x, B.w - b.x);
    var k = Math.min((BOTTOM - TOP) / (up + down), HALF / side);
    var footY = TOP + up * k + ((BOTTOM - TOP) - (up + down) * k) / 2;
    [[A, a, AT[0]], [B, b, AT[1]]].forEach(function (v) {
      v[0].g.setAttribute('transform', 'translate(' + (v[2] - v[1].x * k).toFixed(2) + ' ' + (footY - v[1].y * k).toFixed(2) + ') scale(' + k.toFixed(4) + ')');
      root.appendChild(v[0].g);
    });
    // the turn: a dashed arc from A to B with an arrowhead and the angle
    root.appendChild(S.el('path', { class: 'px-plate-arc', d: 'M206 46Q260 6 314 46' }));
    root.appendChild(S.el('path', { class: 'px-plate-head', d: 'M318.5 49.5L306.8 46.6L312.6 39.4Z' }));
    root.appendChild(S.text(260, 14, '90°', { class: 'px-plate-angle' }));
    root.appendChild(S.text(130, 197, 'A', { class: 'px-plate-label' }));
    root.appendChild(S.text(390, 197, 'B', { class: 'px-plate-label' }));
    var wrap = h('div', { class: ['px-plate', opts.className] }, root);
    if (opts.label) {
      root.removeAttribute('aria-hidden');
      root.setAttribute('role', 'img');
      root.setAttribute('aria-label', opts.label);
    }
    return wrap;
  }

  /* ---------- where the app runs (phones; I2 §9) ---------- */

  // ios: an iPhone or iPad (iPadOS reports a Mac with touch); standalone: opened from the home
  // screen; inApp: a browser built into another app that says so in its user agent (Android
  // WebViews and some apps; Discord's iOS browser cannot be told apart from Safari).
  function device() {
    var n = window.navigator || {}, ua = String(n.userAgent || ''), plat = String(n.platform || '');
    function mq(q) { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } }
    var ios = /iPad|iPhone|iPod/.test(ua) || (plat === 'MacIntel' && (n.maxTouchPoints || 0) > 1);
    var standalone = n.standalone === true || mq('(display-mode: standalone)') || mq('(display-mode: fullscreen)');
    var inApp = /; wv\)|\bFBA[NV]\b|Instagram|\bLine\/|Discord|Twitter|Snapchat|\bGSA\//.test(ua);
    return { ios: ios, standalone: standalone, inApp: inApp, touch: mq('(pointer: coarse)') };
  }

  // The storage hint: where a phone can lose a record (iOS clears a site's storage after seven days
  // of Safari use without a visit; an app's built-in browser keeps its own copy). Shown in the
  // welcome on iPhones and iPads and in recognisable in-app browsers, not from the home screen; with
  // a Back up button once there is something to back up and no backup in the last 14 days.
  function storageHint() {
    var d = device(), st = PX.core.store, rec = st && st.state;
    var framed = false;
    try { framed = !!(PX.ui.app && PX.ui.app.env && (PX.ui.app.env.framed || PX.ui.app.env.sandboxed)); } catch (e) { framed = false; }
    if (framed || d.standalone || !(d.ios || d.inApp) || !rec) return null;
    var text = d.ios
      ? 'Your progress is saved in this browser only, and Safari can clear it after seven days of use without a visit. Opened from Discord or another app? That app keeps its own copy. To keep your progress, add Parallax to your home screen (Share, then Add to Home Screen) and back up from Settings now and then.'
      : 'Your progress is saved in this browser only. Opened from Discord or another app? That app may keep its own copy. To keep your progress, open Parallax in your browser or add it to your home screen, and back up from Settings now and then.';
    var box = h('div.px-welcome-store', { 'data-welcome': 'storage' }, h('p', text));
    var last = rec.settings && rec.settings.lastBackup || 0, has = (rec.sessions && rec.sessions.length) || (rec.trials && rec.trials.length);
    if (has && Date.now() - last > 14 * 864e5 && PX.ui.app && typeof PX.ui.app.backup === 'function') {
      var b = ui.button(last ? 'Back up now' : 'Back up now (never backed up)', { kind: 'secondary', small: true, onClick: function () { PX.ui.app.backup(); } });
      b.setAttribute('data-welcome', 'backup');
      box.appendChild(b);
    }
    return box;
  }

  /* ---------- the welcome pop-up ---------- */

  var current = null;

  function show(opts) {
    opts = opts || {};
    if (current && !current.closed) return current;
    var reason = 'dismiss';
    var n = ++seq;
    var titleId = 'px-welcome-title-' + n, textId = 'px-welcome-text-' + n;

    var copy = linkCopy({ label: 'Chimera Discord address' });
    var join = joinLink({ className: 'px-welcome-join', onClick: function () { nudgeIfBlocked(copy); } });
    var start = ui.button('Start training', { kind: 'secondary', className: 'px-welcome-start' });
    start.setAttribute('data-autofocus', '');
    start.setAttribute('data-welcome', 'start');

    var body = h('div.px-welcome-inner',
      plate({ className: 'px-welcome-plate' }),
      h('div.px-welcome-body',
        h('h2.px-welcome-title', { id: titleId }, 'Parallax was built by the Chimera community on Discord.'),
        h('p.px-welcome-text', { id: textId }, 'Come say hi, share your results and suggest exercises you would like to train.'),
        h('div.px-welcome-actions',
          join,
          h('div.px-welcome-addr', copy, h('p.px-welcome-hint', 'The button opens a new tab. Some previews block that, so the address is here to copy.')),
          start),
        storageHint()));

    var close = ui.modal({
      body: body,
      className: 'px-welcome',
      label: 'Welcome',
      onClose: function () {
        current = null;
        if (typeof opts.onClose === 'function') opts.onClose(reason);
      },
    });
    close.el.setAttribute('aria-labelledby', titleId);
    close.el.setAttribute('aria-describedby', textId);
    close.el.removeAttribute('aria-label');
    close.el.setAttribute('data-welcome', '');
    start.addEventListener('click', function () { reason = 'start'; close('start'); });
    current = close;
    // Open at the top, so its first line ("built by the Chimera community") is on the screen even
    // when focusing Start scrolled a short (landscape) dialog down.
    function toTop() { try { close.el.scrollTop = 0; if (close.el.parentNode) close.el.parentNode.scrollTop = 0; } catch (e) { /* cosmetic */ } }
    toTop();
    try { window.requestAnimationFrame(function () { toTop(); window.requestAnimationFrame(toTop); }); } catch (e) { /* ignore */ }
    return close;
  }

  function isOpen() { return !!(current && !current.closed); }

  PX.ui.chimera = { URL: URL, joinLink: joinLink, linkCopy: linkCopy, nudgeIfBlocked: nudgeIfBlocked, icon: function () { return svgIcon(EXTERNAL); } };
  PX.ui.figures = { polycube: polycube, plate: plate, turnZ: turnZ, turnAbout: turnAbout, FIGURE: FIGURE, AXIS: AXIS };
  PX.ui.welcome = { show: show, isOpen: isOpen, device: device };
})(window.PX);
