/* PX.ui.share: share cards, the share sheet and same-seed friend challenges (PLAN §7, §9).

   card(opts) → Promise<HTMLCanvasElement>   a card drawn on a 2D canvas in the app's look
     opts: { title, lines: [..], footer, kind: 'session' | 'daily' | 'check' | 'level' | 'challenge',
             size: 'wide' (1200 × 630, default) | 'square' (1080 × 1080), theme: 'light' | 'dark'
             (default: what the app shows), label (replaces the kind's label, e.g. 'Daily #12'),
             marks: [1, 0, …] (a row of right/wrong squares, Daily), ruler: { value, lo, hi } (level) }
     Every card carries "Parallax" and "Built by the Chimera community · discord.gg/chmr".
   open(opts) → close    the share sheet: the card as a picture, the size, Download PNG (blocked
     in sandboxed previews, which then say how to save the picture), Copy text, and the Chimera
     Discord link with its address and Copy. opts as card(), plus text (the text to copy; default
     title, lines, footer and the Chimera line) and filename.
   text(opts) → the text a card stands for (cards are pictures; the sheet always offers the text).

   challenge: codes for "play the same items as me" (a seed and the settings, never a score)
     create({ exId, params, n }) → { code, exId, params, seed, n }   n items (4–20, default 8)
     decode(text) → { ok: true, code, exId, def, params, seed, n } or { ok: false, error }
     seedAt(ch | code, i) → the seed of item i (shared seeds ≥ 2^31: never a training seed)
     route(ch) → the play route params { mode: 'free', exId, params, trials, challenge: code }
     play(text) → true when it started (router.go('play', route)), else false
     share(opts) → close   create() + the share sheet
     box(opts) → element   "Play a challenge": a field for a friend's code and a Play button
   Code format: PXC-<exercise number>[v<version>]-<settings>-<seed>-<items><check>, in Crockford
   base 32 (case-insensitive; O, I and L read as 0, 1, 1), e.g. PXC-02-3M-9F2K7QA-8T. */
(function (PX) {
  'use strict';

  var ui = PX.ui;
  var h = ui.h;
  var doc = window.document;
  var CHIMERA_LINE = 'Built by the Chimera community · discord.gg/chmr';
  var SIZES = { wide: [1200, 630], square: [1080, 1080] };
  var KIND = { session: 'Session', daily: 'Daily Challenge', check: 'Spatial Check', level: 'Level', challenge: 'Challenge' };

  // The tokens of css/base.css, so a card looks the same whatever the page shows.
  var PAL = {
    light: { paper: '#F2F4F3', surface: '#FFFFFF', surface2: '#E9ECEA', ink: '#1A1D21', ink2: '#454B52', ink3: '#5D646C', rule: '#D3D8D5', ruleStrong: '#7B838A', signal: '#0B6A86', signalInk: '#FFFFFF', wash: '#E0EEF2', gridMinor: 'rgba(11,106,134,0.05)', gridMajor: 'rgba(11,106,134,0.11)', wrong: '#B33A2F' },
    dark: { paper: '#1B1F23', surface: '#23282D', surface2: '#2C3237', ink: '#E6E8EA', ink2: '#B4BBC1', ink3: '#99A0A7', rule: '#394047', ruleStrong: '#79818A', signal: '#5CC6E0', signalInk: '#0B1A1F', wash: '#1B3B45', gridMinor: 'rgba(92,198,224,0.04)', gridMajor: 'rgba(92,198,224,0.09)', wrong: '#F48777' },
  };
  var SANS = '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var MONO = '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';

  function isDark() { try { return !!(PX.ui.app && PX.ui.app.isDark()); } catch (e) { return false; } }
  function sandboxed() { try { return !!(PX.ui.app && PX.ui.app.env && PX.ui.app.env.sandboxed); } catch (e) { return false; } }

  /* ---------- drawing ---------- */

  function fontsReady() {
    var f = doc.fonts;
    if (!f || typeof f.load !== 'function') return Promise.resolve();
    var all = ['600 64px "IBM Plex Sans"', '400 32px "IBM Plex Sans"', '500 24px "IBM Plex Mono"', '400 24px "IBM Plex Mono"'].map(function (x) {
      try { return f.load(x).then(null, function () { return null; }); } catch (e) { return Promise.resolve(); }
    });
    return Promise.race([Promise.all(all), new Promise(function (r) { window.setTimeout(r, 1500); })]);
  }

  // Lines of text that fit maxW, at most max lines (the last one shortened with an ellipsis).
  function wrap(ctx, text, maxW, max) {
    var words = String(text == null ? '' : text).split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (!cur || ctx.measureText(t).width <= maxW) cur = t;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (lines.length > max) {
      lines = lines.slice(0, max);
      lines[max - 1] += ' …';
    }
    return lines.map(function (l) {
      while (l.length > 2 && ctx.measureText(l).width > maxW) l = l.slice(0, -2) + '…';
      return l;
    });
  }

  function grid(ctx, W, H, c) {
    var x, y;
    ctx.fillStyle = c.gridMinor;
    for (x = 0; x < W; x += 8) ctx.fillRect(x, 0, 1, H);
    for (y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = c.gridMajor;
    for (x = 0; x < W; x += 40) ctx.fillRect(x, 0, 1, H);
    for (y = 0; y < H; y += 40) ctx.fillRect(0, y, W, 1);
  }

  function regMarks(ctx, W, H, inset, len, c) {
    ctx.strokeStyle = c.ink3;
    ctx.lineWidth = 2;
    [[inset, inset, 1, 1], [W - inset, inset, -1, 1], [inset, H - inset, 1, -1], [W - inset, H - inset, -1, -1]].forEach(function (m) {
      ctx.beginPath();
      ctx.moveTo(m[0] + m[2] * len, m[1]);
      ctx.lineTo(m[0], m[1]);
      ctx.lineTo(m[0], m[1] + m[3] * len);
      ctx.stroke();
    });
  }

  // The Parallax mark (app.js): a wire cube whose dashed back face is the front face seen again.
  function mark(ctx, x, y, s, c) {
    var k = s / 24;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.lineCap = 'round';
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(3.5, 8.5); ctx.lineTo(9.5, 3.5); ctx.moveTo(14.5, 8.5); ctx.lineTo(20.5, 3.5); ctx.moveTo(14.5, 19.5); ctx.lineTo(20.5, 14.5); ctx.stroke();
    ctx.strokeStyle = c.signal; ctx.lineWidth = 1.6;
    if (ctx.setLineDash) ctx.setLineDash([2.2, 1.8]);
    ctx.strokeRect(9.5, 3.5, 11, 11);
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.fillStyle = c.paper; ctx.fillRect(3.5, 8.5, 11, 11);
    ctx.strokeStyle = c.ink; ctx.strokeRect(3.5, 8.5, 11, 11);
    ctx.restore();
  }

  // A row of squares: ✓ on signal for right, ✗ on an outline for wrong (shape, not colour alone).
  function marks(ctx, x, y, list, size, c) {
    var gap = Math.round(size * 0.28);
    list.forEach(function (v, i) {
      var x0 = x + i * (size + gap);
      ctx.lineWidth = 3;
      if (v) { ctx.fillStyle = c.signal; ctx.fillRect(x0, y, size, size); ctx.strokeStyle = c.signalInk; }
      else { ctx.fillStyle = c.surface; ctx.fillRect(x0, y, size, size); ctx.strokeStyle = c.ruleStrong; ctx.strokeRect(x0 + 1.5, y + 1.5, size - 3, size - 3); ctx.strokeStyle = c.ink2; }
      ctx.beginPath();
      if (v) { ctx.moveTo(x0 + size * 0.24, y + size * 0.53); ctx.lineTo(x0 + size * 0.43, y + size * 0.71); ctx.lineTo(x0 + size * 0.77, y + size * 0.31); }
      else { ctx.moveTo(x0 + size * 0.3, y + size * 0.3); ctx.lineTo(x0 + size * 0.7, y + size * 0.7); ctx.moveTo(x0 + size * 0.7, y + size * 0.3); ctx.lineTo(x0 + size * 0.3, y + size * 0.7); }
      ctx.stroke();
    });
    return list.length * (size + gap) - gap;
  }

  // The level ruler of the app: ticks every tenth, the value, and the likely range as brackets.
  function ruler(ctx, x, y, w, r, c, fs) {
    var hgt = 16, v = Math.max(0, Math.min(100, +r.value || 0));
    ctx.fillStyle = c.surface2; ctx.fillRect(x, y, w, hgt);
    ctx.fillStyle = c.rule;
    for (var i = 1; i < 10; i++) ctx.fillRect(Math.round(x + w * i / 10), y, 2, hgt);
    ctx.fillStyle = c.signal; ctx.fillRect(x, y, w * v / 100, hgt);
    if (isFinite(r.lo) && isFinite(r.hi)) {
      var a = x + w * Math.max(0, r.lo) / 100, b = x + w * Math.min(100, r.hi) / 100;
      ctx.strokeStyle = c.ink2; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a, y - 6); ctx.lineTo(a, y + hgt + 6); ctx.moveTo(b, y - 6); ctx.lineTo(b, y + hgt + 6);
      ctx.moveTo(a, y + hgt / 2); ctx.lineTo(b, y + hgt / 2); ctx.stroke();
    }
    ctx.fillStyle = c.ink3; ctx.font = '400 ' + fs + 'px ' + MONO; ctx.textBaseline = 'top';
    ctx.fillText('1', x, y + hgt + 12);
    ctx.textAlign = 'right'; ctx.fillText('100', x + w, y + hgt + 12); ctx.textAlign = 'left';
    return hgt + 12 + fs;
  }

  function draw(canvas, o) {
    var size = SIZES[o.size] || SIZES.wide, W = size[0], H = size[1], sq = o.size === 'square';
    var c = PAL[o.theme === 'dark' || (o.theme !== 'light' && isDark()) ? 'dark' : 'light'];
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var M = sq ? 96 : 72, maxW = W - 2 * M;
    ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H);
    grid(ctx, W, H, c);
    regMarks(ctx, W, H, 28, 28, c);
    ctx.textBaseline = 'alphabetic';
    // header: the mark, "Parallax", and what the card is
    mark(ctx, M - 4, M - 6, 52, c);
    ctx.fillStyle = c.ink; ctx.font = '600 38px ' + SANS;
    ctx.fillText('Parallax', M + 60, M + 32);
    var label = o.label || KIND[o.kind] || '';
    if (label) {
      ctx.font = '500 26px ' + MONO; ctx.fillStyle = c.ink3; ctx.textAlign = 'right';
      ctx.fillText(label, W - M, M + 30); ctx.textAlign = 'left';
    }
    // footer: a hairline, the Chimera line, and the card's own footer
    var footY = H - M;
    ctx.fillStyle = c.ruleStrong; ctx.fillRect(M, footY - (sq ? 92 : 62), maxW, 2);
    ctx.font = '500 ' + (sq ? 30 : 27) + 'px ' + SANS; ctx.fillStyle = c.ink2;
    ctx.fillText(CHIMERA_LINE, M, footY - (sq ? 44 : 14));
    if (o.footer) {
      ctx.font = '400 24px ' + MONO; ctx.fillStyle = c.ink3;
      if (sq) ctx.fillText(wrap(ctx, o.footer, maxW, 1)[0] || '', M, footY);
      else { ctx.textAlign = 'right'; ctx.fillText(wrap(ctx, o.footer, maxW * 0.32, 1)[0] || '', W - M, footY - 14); ctx.textAlign = 'left'; }
    }
    // body: title, an optional picture (marks or ruler), the lines
    var y = M + (sq ? 170 : 128), bottom = footY - (sq ? 120 : 90);
    var tSize = sq ? 76 : 62;
    ctx.font = '600 ' + tSize + 'px ' + SANS; ctx.fillStyle = c.ink;
    wrap(ctx, o.title || 'Parallax', maxW, 2).forEach(function (l) { ctx.fillText(l, M, y + tSize * 0.8); y += tSize * 1.12; });
    y += sq ? 30 : 18;
    if (o.marks && o.marks.length) {
      var ms = Math.min(sq ? 96 : 64, Math.floor(maxW / (o.marks.length * 1.28)));
      marks(ctx, M, y, o.marks.slice(0, 20), ms, c);
      y += ms + (sq ? 44 : 30);
    } else if (o.ruler) {
      y += 6;
      y += ruler(ctx, M, y, maxW, o.ruler, c, sq ? 24 : 22) + (sq ? 40 : 26);
    }
    var lSize = sq ? 38 : 32, lh = lSize * 1.34;
    ctx.font = '400 ' + lSize + 'px ' + SANS; ctx.fillStyle = c.ink2;
    (o.lines || []).some(function (line) {
      var parts = wrap(ctx, line, maxW, 2);
      for (var i = 0; i < parts.length; i++) {
        if (y + lh > bottom + lSize * 0.3) return true;
        ctx.fillText(parts[i], M, y + lSize * 0.8);
        y += lh;
      }
      y += sq ? 10 : 4;
      return false;
    });
    return canvas;
  }

  function card(opts) {
    var o = opts || {};
    return fontsReady().then(function () { return draw(doc.createElement('canvas'), o); });
  }

  function text(o) {
    if (o && typeof o.text === 'string' && o.text) return o.text;
    var out = [o && o.title ? o.title : 'Parallax'].concat((o && o.lines) || []);
    if (o && o.footer) out.push(o.footer);
    out.push(CHIMERA_LINE);
    return out.join('\n');
  }

  /* ---------- the share sheet ---------- */

  function savePng(canvas, filename) {
    return new Promise(function (resolve) {
      function go(url, revoke) {
        var a = h('a', { href: url, download: filename, style: 'display:none' });
        doc.body.appendChild(a);
        a.click();
        window.setTimeout(function () {
          if (revoke) { try { window.URL.revokeObjectURL(url); } catch (e) { /* ignore */ } }
          if (a.parentNode) a.parentNode.removeChild(a);
        }, 1500);
        resolve(true);
      }
      try {
        if (canvas.toBlob && window.URL && window.URL.createObjectURL) {
          canvas.toBlob(function (blob) {
            if (!blob) { resolve(false); return; }
            try { go(window.URL.createObjectURL(blob), true); } catch (e) { resolve(false); }
          }, 'image/png');
        } else go(canvas.toDataURL('image/png'), false);
      } catch (e) { resolve(false); }
    });
  }

  function open(opts) {
    var o = opts || {}, K = PX.ui.kit, C = PX.ui.chimera;
    var size = o.size === 'square' ? 'square' : 'wide', canvas = null, close = null;
    var body = text(o);
    var filename = o.filename || ('parallax-' + (o.kind || 'card') + '-' + PX.util.fmtDate(Date.now()) + '.png');
    var img = h('img.px-share-img', { alt: body.replace(/\n/g, '. '), width: SIZES[size][0], height: SIZES[size][1] });
    var fig = h('div.px-share-fig', { 'data-size': size, 'aria-busy': 'true' }, img);
    var status = h('p.px-meta.px-share-status', { role: 'status', 'aria-live': 'polite' });

    function render() {
      fig.setAttribute('aria-busy', 'true');
      fig.setAttribute('data-size', size);
      return card({ title: o.title, lines: o.lines, footer: o.footer, kind: o.kind, size: size, theme: o.theme, label: o.label, marks: o.marks, ruler: o.ruler })
        .then(function (cv) {
          canvas = cv;
          try { img.src = cv.toDataURL('image/png'); } catch (e) { img.removeAttribute('src'); }
          img.width = cv.width; img.height = cv.height;
          fig.setAttribute('aria-busy', 'false');
          fig.setAttribute('data-ready', '1');
          return cv;
        }, function (e) {
          fig.setAttribute('aria-busy', 'false');
          status.textContent = 'The picture could not be drawn here. The text below says the same.';
          if (window.console) console.warn('PX.ui.share: card failed', e);
          return null;
        });
    }

    var sizes = K.segmented({
      key: 'share-size', legend: 'Picture size', value: size,
      options: [{ value: 'wide', label: 'Wide 1200 × 630' }, { value: 'square', label: 'Square 1080 × 1080' }],
      onChange: function (v) { size = v; status.textContent = ''; render(); },
    });
    var parts = [fig, sizes];
    if (!sandboxed()) {
      var dl = ui.button('Download PNG', { kind: 'primary' });
      dl.setAttribute('data-share', 'download');
      dl.addEventListener('click', function () {
        (canvas ? Promise.resolve(canvas) : render()).then(function (cv) { return savePng(cv, filename.replace(/\.png$/, '') + (size === 'square' ? '-square' : '') + '.png'); })
          .then(function (ok) {
            status.textContent = ok ? 'Downloading the picture. Check your downloads folder.' :
              'The download was refused here. Right-click or long-press the picture to save it, or copy the text below.';
          });
      });
      parts.push(h('div.px-data-row.px-share-actions', dl, status));
    } else {
      parts.push(h('div.px-notice.px-notice--warn', K.icon('warn'),
        h('span', 'Downloads are blocked in this preview. Right-click or long-press the picture to save it, or copy the text below.')));
    }
    var field = K.copyField(body, { rows: Math.min(6, body.split('\n').length + 1), label: 'Copy text', ariaLabel: 'Text of the share card' });
    field.button.setAttribute('data-share', 'copy');
    parts.push(h('div.px-share-text', h('p.px-setting-label', 'The text'), field));
    var copy = C.linkCopy({ label: 'Chimera Discord address' });
    parts.push(h('div.px-share-chimera',
      h('p', 'Share it in the Chimera Discord, where Parallax was built.'),
      C.joinLink({ kind: 'secondary', onClick: function () { C.nudgeIfBlocked(copy); } }),
      copy));
    close = ui.modal({ title: o.sheetTitle || 'Share', className: 'px-share', body: parts, actions: [{ label: 'Done', kind: 'secondary' }] });
    if (close.el) close.el.setAttribute('data-share-sheet', o.kind || '');
    render();
    return close;
  }

  /* ---------- friend challenges ---------- */

  var B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function b32(n) {
    n = Math.floor(n);
    if (!(n >= 0)) return '0';
    var s = '';
    do { s = B32.charAt(n % 32) + s; n = Math.floor(n / 32); } while (n > 0);
    return s;
  }
  function unb32(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var k = B32.indexOf(s.charAt(i));
      if (k < 0) return NaN;
      n = n * 32 + k;
    }
    return n;
  }
  function check(body) { return B32.charAt(PX.rng.hash('px-challenge-check', body) % 32); }
  function exNum(def) { var m = /(\d+)$/.exec(def.code || ''); return m ? ('0' + (+m[1])).slice(-2) : null; }

  function encode(ch) {
    var def = PX.ex.get(ch.exId);
    if (!def) throw new Error('PX.ui.share.challenge: unknown exercise ' + ch.exId);
    var v = def.version && def.version !== 1 ? 'V' + def.version : '';
    var body = 'PXC-' + exNum(def) + v + '-' + b32(PX.ex.paramsCode(def, ch.params)) + '-' + b32(ch.seed >>> 0) + '-' + ch.n;
    return body + check(body);
  }

  // Crockford reading: O is 0, I and L are 1.
  function norm(s) { return s.replace(/O/g, '0').replace(/[IL]/g, '1'); }

  function decode(textIn) {
    var t = String(textIn || '').toUpperCase();
    var m = /PXC\s*-\s*(\d{2})(?:V(\d+))?\s*-\s*([0-9A-Z]{1,12})\s*-\s*([0-9A-Z]{1,7})\s*-\s*(\d{1,2})([0-9A-Z])(?![0-9A-Z])/.exec(t);
    if (!m) return { ok: false, error: 'This does not look like a challenge code. Codes start with PXC-, like PXC-02-3M-9F2K7QA-8T.' };
    m[3] = norm(m[3]); m[4] = norm(m[4]); m[6] = norm(m[6]);
    var body = 'PXC-' + m[1] + (m[2] ? 'V' + m[2] : '') + '-' + m[3] + '-' + m[4] + '-' + m[5];
    if (check(body) !== m[6]) return { ok: false, error: 'This code has a typo: one of its letters or digits does not match. Copy it again.' };
    var def = null;
    PX.ex.list('train').forEach(function (d) { if (exNum(d) === m[1]) def = d; });
    if (!def) return { ok: false, error: 'This challenge uses an exercise that this version of Parallax does not have.' };
    if ((+m[2] || 1) !== (def.version || 1)) return { ok: false, error: 'This challenge was made with another version of ' + def.short + ', so its items would differ.' };
    var params, seed = unb32(m[4]), n = +m[5];
    try { params = PX.ex.decodeParams(def, unb32(m[3])); } catch (e) { params = null; }
    if (!params || PX.ex.validParams(def, params) !== true || !(seed >= 0 && seed <= 4294967295) || !(n >= 4 && n <= 20)) {
      return { ok: false, error: 'This code does not hold valid settings. Ask your friend to copy it again.' };
    }
    return { ok: true, code: body + m[6], exId: def.id, def: def, params: params, seed: seed, n: n };
  }

  function create(o) {
    var def = PX.ex.get(o && o.exId);
    if (!def) throw new Error('PX.ui.share.challenge.create: unknown exercise');
    var params = PX.util.deepCopy(o.params || {});
    def.dims.forEach(function (d) { if (typeof params[d.key] !== 'number') params[d.key] = 0; });
    if (def.variants && def.variants.indexOf(params.variant) < 0) params.variant = def.variants[0];
    Object.keys(params).forEach(function (k) { if (k !== 'variant' && !def.dims.some(function (d) { return d.key === k; })) delete params[k]; });
    var seed = 0;
    try {
      var a = new Uint32Array(1);
      window.crypto.getRandomValues(a);
      seed = a[0];
    } catch (e) { seed = Math.floor(Math.random() * 4294967296) >>> 0; }
    var n = Math.max(4, Math.min(20, Math.round(o.n || 8)));
    var ch = { exId: def.id, params: params, seed: seed >>> 0, n: n };
    ch.code = encode(ch);
    return ch;
  }

  function seedAt(ch, i) {
    var c = typeof ch === 'string' ? decode(ch) : ch;
    if (!c || c.ok === false) return null;
    return PX.engine.select.sharedSeed(PX.rng.hash('px-challenge', c.seed >>> 0, i));
  }

  function route(ch) { return { mode: 'free', exId: ch.exId, params: PX.util.deepCopy(ch.params), trials: ch.n, challenge: ch.code }; }

  // Coming soon / unavailable: the Library's notice when it is loaded, else a toast.
  function blocked(def) {
    var X = PX.ui.exinfo;
    var why = X && X.unavailable ? X.unavailable(def) : (PX.ex.view(def.id) ? null : 'coming soon');
    if (!why) return false;
    if (X && X.explain) X.explain(def, why);
    else ui.toast(def.short + ' is coming soon: its screen is still being built.', { kind: 'info' });
    return true;
  }

  function play(textIn) {
    var c = decode(textIn);
    if (!c.ok || blocked(c.def)) return false;
    PX.core.router.go('play', route(c));
    return true;
  }

  function settingsLine(def, params) {
    var X = PX.ui.exinfo;
    if (X && X.paramsText) return X.paramsText(def, params);
    return def.dims.map(function (d) { return d.label + ' ' + d.levels[params[d.key]]; }).join(', ');
  }

  function shareChallenge(o) {
    var ch = create(o), def = PX.ex.get(ch.exId);
    return open({
      kind: 'challenge', label: 'Challenge', sheetTitle: 'Challenge a friend',
      title: 'Same ' + ch.n + ' ' + def.short + ' items, your turn',
      lines: [settingsLine(def, ch.params), 'Code: ' + ch.code, 'Paste it into “Play a challenge” in the Parallax Library.'],
      text: 'Parallax challenge: the same ' + ch.n + ' ' + def.short + ' items I played. Paste this code into “Play a challenge” in the Library: ' + ch.code + '\n' + CHIMERA_LINE,
      filename: 'parallax-challenge-' + def.id + '.png',
    });
  }

  function box(opts) {
    var o = opts || {};
    var id = 'px-challenge-' + Math.floor(Math.random() * 1e9);
    var input = h('input.px-input.px-challenge-input', { id: id, type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'PXC-…', 'aria-describedby': id + '-hint' });
    var msg = h('p.px-challenge-msg', { role: 'status', 'aria-live': 'polite' });
    var btn = ui.button('Play', { kind: 'secondary' });
    btn.setAttribute('data-challenge', 'play');
    function go() {
      var c = decode(input.value);
      if (!c.ok) { msg.textContent = c.error; msg.className = 'px-challenge-msg is-error'; input.focus(); return; }
      msg.textContent = c.n + ' ' + c.def.short + ' items: ' + settingsLine(c.def, c.params) + '.';
      msg.className = 'px-challenge-msg';
      play(c.code);
    }
    btn.addEventListener('click', go);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    return h('div', { class: ['px-challenge', o.className], 'data-challenge-box': '' },
      h('label.px-setting-label', { for: id }, o.title || 'Play a challenge'),
      h('p.px-field-hint', { id: id + '-hint' }, o.hint || 'Paste a code a friend shared to get exactly the items they played. It changes no level.'),
      h('div.px-challenge-row', input, btn), msg);
  }

  PX.ui.share = {
    card: card, open: open, text: text, CHIMERA_LINE: CHIMERA_LINE, SIZES: SIZES,
    challenge: { create: create, encode: encode, decode: decode, seedAt: seedAt, route: route, play: play, share: shareChallenge, box: box },
  };
})(window.PX);
