/* PX.ui.app: boot and the app shell. PX.ui.kit: small pieces the screens share.
   ARCHITECTURE.md §1, §3, §8–§10; PLAN.md §7–§10. Loads last; boots on DOMContentLoaded.

   Screens. Every ui/<name>.js registers (screen files load before this one, so they create
   the map themselves):
       PX.ui.screens = PX.ui.screens || {};
       PX.ui.screens.<name> = { title: 'Library' | fn(route), render(host, route, ctx) → cleanup? }
   <name> is a router name: home, play, library, exercise, progress, log, lab, settings, about.
   host is an empty .px-wrap inside <main>; route is router.current(); ctx is
   { app, store, router, kit, ui }. A returned cleanup function runs before the next render.
   Use PX.ui.kit inside render functions only (it is defined here, after the screen files).
   A screen without an owner yet gets a placeholder that says what it will hold.
   In-app navigation: elements with data-go="<route>" (router.js), never href.

   Boot: engine fields registered with the store (PX.engine.fields()), record loaded, settings
   applied, shell built, route from the URL hash or Today, then the Chimera pop-up (every
   open) and, on the first run, the tour offer.

   PX.ui.app
     ready                     true after boot
     rerender()                renders the current screen again (after imports, resets…)
     applySettings()           theme, text size, reduced motion and key hints from the record
     isDark(), motionReduced() what the screen shows now ('auto' follows the system)
     env                       { framed, opaque, sandboxed }: sandboxed = framed with an opaque
                               origin (srcdoc previews), where new tabs and downloads are blocked
     backup()                  the Back up now dialog: download when allowed, Copy always; a
                               success sets settings.lastBackup and emits 'backup' { at }
     exportDialog(opts)        the same dialog for any text: { title, intro, text, filename,
                               type, onDone(how) }
     showWelcome()             the Chimera pop-up (shown at boot)
     offerTour()               the first-run offer; "Watch, Try, Go" calls PX.ui.tour.start()
     openMore()                the More sheet (Lab, Settings, About, the Chimera link)
   Events on PX.bus: 'theme' { dark }, 'settings' { key, value } (settings.js), 'backup' { at },
   'app:ready'. <html> gets data-theme, data-motion, data-keyhints and data-px-ready="1". */
(function (PX) {
  'use strict';

  var ui = PX.ui;
  var h = ui.h;
  var S = PX.core.svg;
  var U = PX.util;
  var bus = PX.bus;
  var store = PX.core.store;
  var router = PX.core.router;
  var doc = window.document;

  PX.ui.screens = PX.ui.screens || {};
  var seq = 0;

  /* =====================================================================================
     PX.ui.kit
     ===================================================================================== */

  // Stroke icons on a 24-unit grid (currentColor). Labels always sit next to them.
  var ICONS = {
    today: 'M4 6h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4M8 14.5h3v3H8z',
    library: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    progress: 'M4 4v16h16M7.5 15.5l3.5-4 3 2.5 5-6.5',
    log: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h1M4.5 12h1M4.5 17.5h1',
    lab: 'M9.5 3.5h5M10.5 3.5v6L5.2 18.4A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.6-2.6L13.5 9.5v-6M7.4 15.5h9.2',
    settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
    about: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5.5M12 7.8v.2',
    warn: 'M12 3.8 21.5 20H2.5zM12 10v4.5M12 17.2v.3',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    backup: 'M12 4v10.5M7.5 10l4.5 4.5 4.5-4.5M5 19.5h14',
    award: 'M12 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8.7 13.4 7 20.5l5-2.6 5 2.6-1.7-7.1',
    play: 'M7 4.5v15l12-7.5z',
  };

  function icon(name, cls) {
    if (name === 'external') return PX.ui.chimera.icon();
    var root = S.el('svg', { viewBox: '0 0 24 24', class: 'px-icon' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true', focusable: 'false' });
    if (name === 'more') {
      [5.5, 12, 18.5].forEach(function (x) { root.appendChild(S.el('circle', { cx: x, cy: 12, r: 1.7, class: 'px-icon-fill' })); });
      return root;
    }
    root.appendChild(S.el('path', { d: ICONS[name] || '' }));
    return root;
  }

  // The Parallax mark: a wire cube whose back face (dashed, signal ink) is the front face
  // seen from a second viewpoint.
  function mark() {
    var r = S.el('svg', { viewBox: '0 0 24 24', class: 'px-mark', 'aria-hidden': 'true', focusable: 'false' });
    r.appendChild(S.el('path', { class: 'px-mark-c', d: 'M3.5 8.5 9.5 3.5M14.5 8.5l6-5M14.5 19.5l6-5' }));
    r.appendChild(S.el('rect', { class: 'px-mark-b', x: 9.5, y: 3.5, width: 11, height: 11 }));
    r.appendChild(S.el('rect', { class: 'px-mark-a', x: 3.5, y: 8.5, width: 11, height: 11 }));
    return r;
  }

  // Specimen label: code · name · ability codes. x: an exercise definition or a list of parts.
  function spec(x, extra) {
    var parts = Array.isArray(x) ? x.slice() : [x.code, x.name, (x.abilities || []).join(' ')];
    if (extra) parts = parts.concat(extra);
    var el = h('span.px-spec');
    parts.filter(function (p) { return p !== null && p !== undefined && p !== ''; }).forEach(function (p, i) {
      if (i) el.appendChild(h('span.px-spec-sep', { 'aria-hidden': 'true' }, '·'));
      el.appendChild(h('span', { class: i === 0 ? 'px-spec-code' : null }, String(p)));
    });
    return el;
  }

  // A panel: { title, aside (text or node), className, tag, level } → { el, head, body }. No panel
  // shows sample data (v1.1, RV-play-dat): an empty record gets empty states, never placeholders.
  function panel(o) {
    o = o || {};
    var headId = o.title ? 'px-panel-' + (++seq) : null;
    var asideKids = [];
    if (o.aside) asideKids.push(o.aside);
    var head = o.title || asideKids.length ? h('div.px-panel-head',
      o.title ? h(o.level || 'h2', { class: 'px-panel-title', id: headId }, o.title) : null,
      asideKids.length ? h('span.px-panel-aside', asideKids) : null) : null;
    var body = h('div.px-panel-body');
    var el = h(o.tag || 'section', {
      class: ['px-panel', o.className], 'aria-labelledby': headId,
    }, head, body);
    return { el: el, head: head, body: body };
  }

  // Segmented choice from radio inputs: { key, legend, options: [{ value, label }], value,
  // onChange(value), hint, num } → <fieldset>. Arrow keys move between options (native).
  function segmented(o) {
    var name = 'px-seg-' + (o.key || '') + '-' + (++seq);
    var hintId = o.hint ? name + '-hint' : null;
    var seg = h('div', { class: ['px-seg', o.num ? 'px-seg--num' : null] });
    o.options.forEach(function (opt, i) {
      var id = name + '-' + i;
      var input = h('input', {
        type: 'radio', name: name, id: id, value: String(opt.value),
        checked: opt.value === o.value, 'aria-describedby': hintId,
        'aria-label': opt.aria || null,
      });
      input.addEventListener('change', function () { if (input.checked && typeof o.onChange === 'function') o.onChange(opt.value); });
      seg.appendChild(h('label.px-seg-item', { for: id }, input, h('span', opt.label)));
    });
    // The wrapper carries the separator line: a fieldset would draw it through its legend.
    return h('div.px-setting', { 'data-setting': o.key || null },
      h('fieldset.px-field',
        h('legend.px-field-label.px-setting-label', o.legend),
        seg,
        o.hint ? h('p.px-field-hint', { id: hintId }, o.hint) : null));
  }

  // Switch: { key, label, checked, onChange(bool), hint } → element. Space toggles (native).
  function toggle(o) {
    var id = 'px-switch-' + (o.key || '') + '-' + (++seq);
    var hintId = o.hint ? id + '-hint' : null;
    var input = h('input', { type: 'checkbox', role: 'switch', id: id, checked: !!o.checked, 'aria-describedby': hintId });
    var state = h('span.px-switch-state', { 'aria-hidden': 'true' }, o.checked ? 'On' : 'Off');
    input.addEventListener('change', function () {
      state.textContent = input.checked ? 'On' : 'Off';
      if (typeof o.onChange === 'function') o.onChange(input.checked);
    });
    return h('div.px-setting', { 'data-setting': o.key || null },
      h('label.px-switch', { for: id }, input, h('span.px-switch-track', { 'aria-hidden': 'true' }),
        h('span.px-switch-label', o.label), state),
      o.hint ? h('p.px-field-hint', { id: hintId }, o.hint) : null);
  }

  // Read-only text with a Copy button that reports success (copyText: async clipboard, then
  // execCommand). A manual copy from the field counts too. { rows, ariaLabel, onCopied, label }
  function copyField(text, o) {
    o = o || {};
    var ta = h('textarea.px-copybox-text', {
      readonly: true, rows: String(o.rows || 6), spellcheck: 'false', autocomplete: 'off',
      'aria-label': o.ariaLabel || 'Text to copy',
    });
    ta.value = text;
    var status = h('span.px-copybox-status', { role: 'status', 'aria-live': 'polite' });
    var btn = ui.button(o.label || 'Copy', { kind: o.kind || 'secondary' });
    btn.setAttribute('data-copy', '');
    function copied() { if (typeof o.onCopied === 'function') o.onCopied(); }
    btn.addEventListener('click', function () {
      ui.copyText(ta.value, ta).then(function (ok) {
        if (ok) {
          status.textContent = o.copiedText || 'Copied.';
          if (doc.activeElement === ta) btn.focus();
          try { ta.setSelectionRange(0, 0); } catch (e) { /* ignore */ }
          copied();
        } else {
          try { ta.focus(); ta.select(); } catch (e) { /* ignore */ }
          status.textContent = 'Copying is blocked here. The text is selected: press Ctrl+C (Cmd+C on a Mac), or long-press it and choose Copy.';
        }
      });
    });
    ta.addEventListener('copy', copied);
    ta.addEventListener('focus', function () { try { ta.select(); } catch (e) { /* ignore */ } });
    var root = h('div.px-copybox', ta, h('div.px-copybox-actions', btn, status));
    root.textarea = ta;
    root.button = btn;
    return root;
  }

  // Starts a download of text. Returns false when the browser refuses up front.
  function download(text, filename, type) {
    try {
      var blob = new Blob([text], { type: type || 'application/octet-stream' });
      var url = window.URL.createObjectURL(blob);
      var a = h('a', { href: url, download: filename, style: 'display:none' });
      doc.body.appendChild(a);
      a.click();
      window.setTimeout(function () {
        try { window.URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 1500);
      return true;
    } catch (e) {
      return false;
    }
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // '30 Oct 2026, 14:05'
  function fmtWhen(t) {
    var d = new Date(t);
    if (!isFinite(d.getTime())) return '–';
    return U.fmtDate(t, 'long') + ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function lastBackupText() {
    var t = store.state.settings.lastBackup;
    return t > 0 ? fmtWhen(t) : 'never';
  }

  // Keeps el up to date: update() now and on each event while el is in the document.
  function live(el, events, update) {
    update();
    var offs = events.map(function (ev) {
      return bus.on(ev, function () {
        if (!doc.contains(el)) { offs.forEach(function (off) { off(); }); return; }
        update();
      });
    });
    return el;
  }

  // "Last backup: never" that updates itself after a backup or an import.
  function backupLine() {
    var v = h('span.px-num');
    var el = h('span.px-backup-line', 'Last backup: ', v);
    return live(el, ['backup', 'store:reload'], function () { v.textContent = lastBackupText(); });
  }

  // Where the record is kept, in one sentence.
  function storageText() {
    if (!store.volatile) return 'Saved in this browser on this device.';
    if (store.volatileReason === 'newer-version') return 'A newer version of Parallax saved this record, so this version does not change it.';
    return 'Not saved in this view: back up before you close it.';
  }

  var env = (function () {
    var framed = false, opaque = false;
    try { framed = window.self !== window.top; } catch (e) { framed = true; }
    try { opaque = String(window.origin) === 'null'; } catch (e) { opaque = false; }
    return { framed: framed, opaque: opaque, sandboxed: framed && opaque };
  })();

  var kit = {
    icon: icon, mark: mark, spec: spec, panel: panel,
    segmented: segmented, toggle: toggle, copyField: copyField, download: download,
    fmtWhen: fmtWhen, lastBackupText: lastBackupText, backupLine: backupLine, live: live,
    storageText: storageText,
  };
  PX.ui.kit = kit;

  /* =====================================================================================
     Settings on the page
     ===================================================================================== */

  function mq(q) { try { return window.matchMedia ? window.matchMedia(q) : null; } catch (e) { return null; } }
  var mqDark = mq('(prefers-color-scheme: dark)');
  var mqMotion = mq('(prefers-reduced-motion: reduce)');
  function onMq(m, fn) {
    if (!m) return;
    if (m.addEventListener) m.addEventListener('change', fn);
    else if (m.addListener) m.addListener(fn);
  }

  function settings() { return store.state.settings; }
  function isDark() {
    var t = settings().theme;
    return t === 'dark' || (t !== 'light' && !!(mqDark && mqDark.matches));
  }
  function motionReduced() {
    var m = settings().reducedMotion;
    return m === 'on' || (m !== 'off' && !!(mqMotion && mqMotion.matches));
  }

  function attr(el, name, value) {
    if (value === null || value === undefined) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }

  var lastDark = null;
  function applySettings() {
    var s = settings(), root = doc.documentElement;
    attr(root, 'data-theme', s.theme === 'light' || s.theme === 'dark' ? s.theme : null);
    attr(root, 'data-motion', s.reducedMotion === 'on' ? 'reduce' : s.reducedMotion === 'off' ? 'full' : null);
    attr(root, 'data-keyhints', s.keyHints === false ? 'off' : null);
    var scale = typeof s.textScale === 'number' && isFinite(s.textScale) ? s.textScale : 1;
    root.style.fontSize = Math.abs(scale - 1) > 0.001 ? (scale * 100).toFixed(1) + '%' : '';
    themeColor();
    var dark = isDark();
    if (dark !== lastDark) {
      lastDark = dark;
      bus.emit('theme', { dark: dark });
    }
  }

  function themeColor() {
    try {
      var paper = window.getComputedStyle(doc.documentElement).getPropertyValue('--paper').trim();
      var meta = doc.querySelector('meta[name="theme-color"]');
      if (meta && paper) meta.setAttribute('content', paper);
    } catch (e) { /* cosmetic */ }
  }

  onMq(mqDark, function () { if (api.ready) applySettings(); });
  onMq(mqMotion, function () { if (api.ready) bus.emit('settings', { key: 'reducedMotion', value: settings().reducedMotion }); });

  /* =====================================================================================
     Shell: header, phone tab bar, More sheet, footer, storage banner
     ===================================================================================== */

  var NAV = [
    { route: 'home', label: 'Today', icon: 'today', main: true },
    { route: 'library', label: 'Library', icon: 'library', main: true },
    { route: 'progress', label: 'Progress', icon: 'progress', main: true },
    { route: 'log', label: 'Log', icon: 'log', main: true },
    { route: 'lab', label: 'Lab', icon: 'lab', desc: 'Protocols, data and how the engine works' },
    { route: 'settings', label: 'Settings', icon: 'settings', desc: 'Theme, text size, sessions and backups' },
    { route: 'about', label: 'About', icon: 'about', desc: 'Credits, licences, and what training can and cannot do' },
  ];
  // Which nav item a route belongs to.
  var NAV_OF = { home: 'home', play: 'home', library: 'library', exercise: 'library', section: 'library', progress: 'progress', log: 'log', lab: 'lab', settings: 'settings', about: 'about' };

  var shell = {};

  // When the page still has focus a moment after the click, no tab opened (sandboxed
  // previews block new tabs), so offer the address with Copy instead.
  function discordFallback() {
    window.setTimeout(function () {
      var here = false;
      try { here = doc.hasFocus() && doc.visibilityState !== 'hidden'; } catch (e) { here = false; }
      if (!here) return;
      var url = PX.ui.chimera.URL;
      ui.toast('No new tab opened? The address is ' + url, {
        kind: 'info', ms: 10000,
        action: { label: 'Copy', onClick: function () {
          ui.copyText(url).then(function (ok) {
            ui.toast(ok ? 'Copied ' + url : 'Copying is blocked here. The address is ' + url, { kind: ok ? 'ok' : 'warn' });
          });
        } },
      });
    }, 900);
  }

  function discordLink(cls) {
    var a = h('a', {
      class: ['px-discord', cls], href: PX.ui.chimera.URL, target: '_blank', rel: 'noopener',
      'data-chimera': 'header', 'aria-label': 'Chimera Discord (opens in a new tab)',
    }, h('span', 'Chimera Discord'), PX.ui.chimera.icon());
    a.addEventListener('click', discordFallback);
    return a;
  }

  function buildHeader() {
    var nav = h('nav.px-nav', { 'aria-label': 'Main' });
    NAV.forEach(function (n) {
      nav.appendChild(h('button', {
        type: 'button', 'data-go': n.route, 'data-nav': n.route,
        class: ['px-nav-item', n.main ? null : 'is-more', n.route === 'settings' ? 'px-nav-item--push' : null],
      }, n.label));
    });
    var more = h('button.px-btn.px-btn--ghost.px-btn--small.px-more-btn', {
      type: 'button', 'aria-haspopup': 'dialog', 'data-more': 'header',
    }, icon('more'), h('span', 'More'));
    more.addEventListener('click', openMore);
    return h('header.px-header', h('div.px-wrap',
      h('button.px-brand', { type: 'button', 'data-go': 'home', 'aria-label': 'Parallax, go to Today' }, mark(), h('span', 'Parallax')),
      nav,
      h('div.px-header-tools', discordLink(), more)));
  }

  function buildTabbar() {
    var row = h('div.px-tabbar-in');
    NAV.forEach(function (n) {
      if (!n.main) return;
      row.appendChild(h('button.px-tab', { type: 'button', 'data-go': n.route, 'data-nav': n.route }, icon(n.icon), h('span', n.label)));
    });
    var more = h('button.px-tab', { type: 'button', 'aria-haspopup': 'dialog', 'data-more': 'tabbar' }, icon('more'), h('span', 'More'));
    more.addEventListener('click', openMore);
    row.appendChild(more);
    return h('nav.px-tabbar', { 'aria-label': 'Main' }, row);
  }

  function openMore() {
    var curNav = navOf(router.current().name);
    var close = null;
    var list = h('ul.px-more-list');
    NAV.forEach(function (n) {
      if (n.main) return;
      var b = h('button.px-more-item', { type: 'button', 'data-more-go': n.route, 'aria-current': curNav === n.route ? 'page' : null },
        h('b', n.label), h('span', n.desc));
      b.addEventListener('click', function () { if (close) close(); router.go(n.route); });
      list.appendChild(h('li', b));
    });
    var copy = PX.ui.chimera.linkCopy();
    var chim = h('div.px-more-chimera',
      h('p.px-muted', 'Parallax was built by the Chimera community on Discord.'),
      PX.ui.chimera.joinLink({ kind: 'secondary', className: 'px-btn--block', onClick: function () { PX.ui.chimera.nudgeIfBlocked(copy); } }),
      copy);
    close = ui.modal({ title: 'More', className: 'px-sheet px-more', body: [list, chim] });
    if (close.el && close.el.parentNode) close.el.parentNode.classList.add('px-modal-backdrop--sheet');
    return close;
  }

  function buildFooter() {
    var about = ui.button('About Parallax', { kind: 'ghost', small: true, go: 'about' });
    var set = ui.button('Settings', { kind: 'ghost', small: true, go: 'settings' });
    return h('footer.px-footer', h('div.px-wrap',
      h('div.px-footer-col',
        h('p.px-footer-title', 'Parallax ', h('span.px-num.px-meta', 'v' + PX.version)),
        h('p', 'A free, open-source trainer for visuospatial ability. Everything you do stays on this device.')),
      h('div.px-footer-col',
        h('p.px-footer-title', 'Built by the Chimera community on Discord'),
        PX.ui.chimera.linkCopy({ label: 'Chimera Discord address' }),
        discordLink('px-footer-discord')),
      h('div.px-footer-col',
        h('p', 'Code under the MIT licence; guide text CC BY-SA 4.0; fonts SIL OFL 1.1; three.js MIT.'),
        h('p.px-footer-links', about, set))));
  }

  var bannerHidden = false;
  function bannerMessage() {
    if (store.volatileReason === 'newer-version') return 'A newer version of Parallax saved progress in this browser, so this version will not change it. Your work here is kept until you close the page.';
    if (store.volatileReason === 'write-failed') return 'Progress could not be saved: storage is full or blocked. Back up to keep it.';
    return store.MESSAGE;
  }
  function renderBanner() {
    var slot = shell.banner;
    if (!slot) return;
    ui.clear(slot);
    if (!store.volatile || bannerHidden) return;
    var bk = ui.button('Back up now', { kind: 'secondary', small: true });
    bk.addEventListener('click', backup);
    var hide = ui.button('Hide', { kind: 'ghost', small: true, ariaLabel: 'Hide this message until Parallax is opened again' });
    hide.addEventListener('click', function () { bannerHidden = true; renderBanner(); focusMain(); });
    slot.appendChild(h('div.px-banner', { role: 'status', 'data-banner': store.volatileReason || 'volatile' },
      h('div.px-wrap',
        h('p.px-banner-text', icon('warn'), h('span', bannerMessage())),
        h('div.px-banner-actions', bk, hide))));
  }

  function buildShell() {
    var skip = h('button.px-skip', { type: 'button' }, 'Skip to content');
    skip.addEventListener('click', focusMain);
    shell.banner = h('div.px-banner-slot');
    shell.main = h('main.px-main#px-main', { tabindex: '-1' });
    shell.root = h('div.px-app',
      skip, buildHeader(), shell.banner, shell.main, buildFooter(), buildTabbar());
    doc.body.insertBefore(shell.root, doc.body.firstChild);
    var boot = doc.getElementById('px-boot');
    if (boot && boot.parentNode) boot.parentNode.removeChild(boot);
  }

  // A session or tutorial (play) belongs to the screen it was opened from: started from the Library
  // (or an exercise's page) it keeps the Library lit, from Progress Progress, else Today (RV-play-dat).
  var navFrom = 'home';
  function navOf(name) {
    if (name === 'play') return navFrom || 'home';
    return NAV_OF[name] || null;
  }
  function updateNav(name) {
    var cur = navOf(name);
    if (name !== 'play' && cur) navFrom = cur;
    var els = shell.root.querySelectorAll('[data-nav]');
    for (var i = 0; i < els.length; i++) attr(els[i], 'aria-current', els[i].getAttribute('data-nav') === cur ? 'page' : null);
    var inMore = cur === 'lab' || cur === 'settings' || cur === 'about';
    var mores = shell.root.querySelectorAll('[data-more]');
    for (var j = 0; j < mores.length; j++) mores[j].classList.toggle('is-active', inMore);
  }

  /* =====================================================================================
     Screens
     ===================================================================================== */

  // Placeholders for screens whose owners have not registered them yet (Phase 3).
  var PLACEHOLDERS = {
    library: {
      title: 'Library',
      lead: 'Every exercise, with your level, a short How to play and free practice.',
      items: [
        'Each exercise with its level from 1 to 100, the likely range, and the settings you handle now',
        'How to play: Watch, Try, Go, about a minute for each exercise',
        'Strategy cards: picture the object, or reason it out step by step',
        'Free play: choose the variant, the settings and a timer; logged but never rated',
      ],
      specimens: true,
    },
    exercise: {
      title: 'Exercise',
      lead: 'One exercise: what it trains, how to play, your level and its history.',
      items: ['What it trains, and what the research says about it', 'How to play: Watch, Try, Go', 'Your level with its likely range, and personal bests', 'Practise this exercise on its own'],
    },
    progress: {
      title: 'Progress',
      lead: 'Your levels with their likely ranges, the Spatial Check, personal bests and achievements.',
      items: [
        'Levels by exercise and by ability, each with a likely range',
        'Learning curves with a band that shows normal day-to-day noise',
        'Spatial Check results: change since your baselines, next to what familiarity alone would give',
        'Weekly goal calendar, personal bests and achievements',
      ],
      backup: true,
    },
    log: {
      title: 'Log',
      lead: 'Every session and trial you have played, with exports for your own analysis.',
      items: ['Sessions with their exercises, accuracy and time', 'Trials with settings, response times and outcomes', 'Export trials as CSV and your whole record as JSON'],
      backup: true,
    },
    lab: {
      title: 'Lab',
      lead: 'Research protocols, your data, and how the engine chooses what you practise.',
      items: [
        'Threshold protocols, such as Track Standard: 8 spheres, 4 targets, 8 seconds',
        'A self-experiment: two groups of exercises, three weeks each, with checks before, between and after',
        'How levels, item difficulty and session plans are computed',
        'Data export for pooling results with the community',
      ],
    },
    play: {
      title: function (route) {
        var m = route && route.params && route.params.mode;
        return m === 'daily' ? 'Daily Challenge' : m === 'check' ? 'Spatial Check' : 'Session';
      },
      lead: 'The trial player: one item at a time, an answer clock that starts when the item is shown, feedback that explains why, and a summary at the end.',
      items: ['Keyboard: 1–9 pick, Enter confirms, Space goes on, Esc pauses, S shows the solution', 'Stuttered or skipped trials never count against you', 'A session summary against your own past, with an honest note about noise'],
      back: true,
    },
  };

  function catalog() {
    try { if (PX.ui.home && typeof PX.ui.home.catalog === 'function') return PX.ui.home.catalog(); } catch (e) { /* fall through */ }
    return [];
  }

  function placeholder(name) {
    var p = PLACEHOLDERS[name] || { title: name.charAt(0).toUpperCase() + name.slice(1), lead: '', items: [] };
    return {
      title: p.title,
      placeholder: true,
      render: function (host, route) {
        var title = typeof p.title === 'function' ? p.title(route) : p.title;
        if (name === 'exercise' && route.arg) {
          var def = PX.ex && PX.ex.get ? PX.ex.get(route.arg) : null;
          title = def ? def.name : route.arg;
        }
        host.appendChild(h('div.px-placeholder',
          h('div.px-screen-head', h('h1', title), p.lead ? h('p.px-lead', p.lead) : null),
          h('p.px-meta', 'This screen is still being built. It will show:'),
          h('ul.px-placeholder-list', p.items.map(function (t) { return h('li', h('span.px-skel', { 'aria-hidden': 'true' }), h('span', t)); })),
          p.backup ? h('p.px-slot-foot', backupLine(), ui.button('Back up now', { kind: 'secondary', small: true, onClick: backup })) : null,
          p.back ? h('p.px-slot-foot', ui.button('Back to Today', { kind: 'secondary', go: 'home' })) : null));
        if (p.specimens) {
          var grid = h('div.px-specimens');
          catalog().forEach(function (x) {
            grid.appendChild(h('article.px-panel.px-specimen', spec([x.code, (x.abilities || []).join(' ')].concat(x.note ? [x.note] : [])),
              h('b', x.name), h('p', x.blurb)));
          });
          if (grid.firstChild) host.appendChild(grid);
        }
      },
    };
  }

  function screenFor(name) {
    var s = PX.ui.screens[name];
    return s && typeof s.render === 'function' ? s : placeholder(name);
  }

  var cleanupFn = null;
  function ctx() { return { app: api, store: store, router: router, kit: kit, ui: ui }; }

  function render(cur) {
    cur = cur || router.current();
    if (typeof cleanupFn === 'function') {
      try { cleanupFn(); } catch (e) { if (window.console) console.error('PX.ui.app: cleanup of the previous screen failed:', e); }
    }
    cleanupFn = null;
    ui.clear(shell.main);
    var host = h('div.px-wrap', { 'data-screen': cur.name });
    shell.main.appendChild(host);
    var scr = screenFor(cur.name);
    try {
      var r = scr.render(host, cur, ctx());
      if (typeof r === 'function') cleanupFn = r;
    } catch (e) {
      if (window.console) console.error('PX.ui.app: the "' + cur.name + '" screen failed to render:', e);
      ui.clear(host);
      host.appendChild(h('div.px-placeholder', h('div.px-screen-head', h('h1', 'This screen could not be shown')),
        h('p.px-lead', 'Something went wrong while drawing it. Your progress is not affected.'),
        h('p.px-slot-foot', ui.button('Back to Today', { kind: 'secondary', go: 'home' }))));
    }
    var t = typeof scr.title === 'function' ? scr.title(cur) : scr.title;
    try { doc.title = cur.name === 'home' || !t ? 'Parallax' : t + ' · Parallax'; } catch (e) { /* ignore */ }
    updateNav(cur.name);
  }

  function rerender() { if (api.ready) render(router.current()); }

  function focusEl(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { /* ignore */ } }
  }
  function focusMain() {
    var hd = shell.main && shell.main.querySelector('h1');
    if (hd) { hd.setAttribute('tabindex', '-1'); focusEl(hd); } else focusEl(shell.main);
  }

  function onRoute(cur) {
    render(cur);
    if (!api.ready) return;
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
    if (!ui.modalOpen()) focusMain();
    try { store.state.ui.lastRoute = cur.route; store.save(); } catch (e) { /* not essential */ }
  }

  /* =====================================================================================
     Welcome, first-run tour offer, backup
     ===================================================================================== */

  function firstRun() {
    var R = store.state;
    return !(R.tour && R.tour.done) && !(R.ui && R.ui.tourOffered) &&
      !(R.sessions && R.sessions.length) && !(R.trials && R.trials.length);
  }

  // After the pop-ups: Start training puts focus on Today's start button; otherwise the heading.
  function afterWelcome(reason) {
    var start = reason === 'start' && shell.main.querySelector('[data-primary]');
    if (start) focusEl(start); else focusMain();
  }

  function showWelcome() {
    return PX.ui.welcome.show({
      onClose: function (reason) {
        if (firstRun()) offerTour(reason);
        else afterWelcome(reason);
      },
    });
  }

  function offerTour(reason) {
    var R = store.state;
    R.ui.tourOffered = Date.now();
    store.save();
    store.flush();
    function step(n, name, text) { return h('li.px-offer-step', h('span.px-num', n), h('b', name), h('span', text)); }
    return ui.modal({
      title: 'New here?',
      className: 'px-offer',
      body: [
        h('p', 'Watch, Try, Go walks you through Rotate, Fold and Track in about 3 minutes. You can skip any step.'),
        h('ol.px-offer-steps', step('1', 'Watch', 'A slow demo of the solution'), step('2', 'Try', 'Practice items that don’t count'), step('3', 'Go', 'Your sessions start with easy items that count')),
      ],
      actions: [
        { label: 'Skip', value: 'skip', kind: 'secondary', className: 'px-offer-skip' },
        { label: 'Watch, Try, Go (3 min)', value: 'tour', kind: 'primary', autofocus: true, className: 'px-offer-go' },
      ],
      onClose: function (v) {
        if (v === 'tour') startTour();
        else afterWelcome(reason);
      },
    });
  }

  // Stub until ui/tour.js exists: the tour agent registers PX.ui.tour = { start() }.
  function startTour() {
    var T = PX.ui.tour;
    if (T && typeof T.start === 'function') {
      try { T.start(); return; } catch (e) { if (window.console) console.error('PX.ui.tour.start failed:', e); }
    }
    ui.toast('The guided tour is not in this build yet. Each exercise will have its own How to play.', { kind: 'info' });
    afterWelcome('dismiss');
  }

  function exportDialog(o) {
    var done = false;
    function success(how) {
      if (done) return;
      done = true;
      if (typeof o.onDone === 'function') o.onDone(how);
    }
    var status = h('p.px-meta', { role: 'status', 'aria-live': 'polite' });
    var parts = [h('p', o.intro)];
    var field = copyField(o.text, { rows: 5, ariaLabel: o.title + ': file contents', onCopied: function () { success('copy'); } });
    // In any frame a download can be blocked without an error (a sandbox without allow-downloads),
    // and a blocked file must never count as a backup: there, Copy only.
    if (!env.framed) {
      var dl = ui.button('Download the file', { kind: 'primary' });
      dl.setAttribute('data-download', '');
      dl.setAttribute('data-autofocus', '');
      dl.addEventListener('click', function () {
        if (download(o.text, o.filename, o.type)) {
          status.textContent = 'Downloading ' + o.filename + '. Check your downloads folder.';
          success('download');
        } else status.textContent = 'The download was refused here. Copy the text below instead.';
      });
      parts.push(h('div.px-data-row', dl, h('span.px-meta.px-num', o.filename)), status, h('p.px-meta', 'Or copy the text and keep it in a note or a file:'));
    } else {
      parts.push(h('div.px-notice.px-notice--warn', icon('warn'), h('span', 'Downloads can be blocked in this preview. Copy the text and keep it in a note or a file.')));
      field.button.setAttribute('data-autofocus', ''); // not the text: focusing it selects it all
    }
    parts.push(field);
    return ui.modal({ title: o.title, body: parts, className: 'px-export', actions: [{ label: 'Done', kind: 'secondary' }] });
  }

  function markBackedUp() {
    var at = Date.now();
    store.state.settings.lastBackup = at;
    store.save();
    bus.emit('backup', { at: at });
  }

  function backup() {
    return exportDialog({
      title: 'Back up your progress',
      intro: 'Keep this file somewhere safe. To restore it, here or on another device, use Import in Settings.',
      text: store.exportJSON(),
      filename: 'parallax-backup-' + U.fmtDate(Date.now()) + '.json',
      type: 'application/json',
      onDone: markBackedUp,
    });
  }

  /* =====================================================================================
     Store events and boot
     ===================================================================================== */

  function onReload(e) {
    applySettings();
    renderBanner();
    var reason = e && e.reason;
    // import, undo and reset are started by a screen, which updates itself
    if ((reason === 'tab' || reason === 'conflict' || reason === 'merge') && router.current().name !== 'play') render();
    if (reason === 'conflict' && e.discarded) ui.toast('Another tab saved newer progress, so this view shows it now. Your last change here was not kept.', { kind: 'warn' });
  }

  function registerEngineFields() {
    var E = PX.engine;
    if (!E || typeof E.fields !== 'function') return;
    var list = [];
    try { list = E.fields() || []; } catch (e) { if (window.console) console.error('PX.engine.fields failed:', e); }
    list.forEach(function (f) {
      try { store.field(f.key, f.def, f.fix); } catch (e) {
        if (window.console) console.warn('PX.ui.app: engine field "' + (f && f.key) + '" not registered: ' + (e && e.message));
      }
    });
    // Two tabs: when a save meets a newer record, merge instead of discarding (ARCHITECTURE §8).
    if (typeof E.merge === 'function' && typeof store.merge !== 'function') store.merge = E.merge;
  }

  function boot() {
    if (api.ready || shell.root) return;
    registerEngineFields();
    var R = store.state; // first read of the record
    applySettings();
    buildShell();
    bus.on('store:volatile', renderBanner);
    bus.on('store:reload', onReload);
    router.on(onRoute);
    // A #/play hash (a reload, a restored tab, a home-screen icon, back or forward) never starts a
    // session by itself (I1 T4): it shows that session's kept summary when it is recent, else Today.
    function playGuard(rt) {
      if (!rt || rt.name !== 'play') return rt;
      try { return PX.ui.play && typeof PX.ui.play.bootRoute === 'function' ? PX.ui.play.bootRoute(rt) : null; } catch (e) { return null; }
    }
    router.guard = playGuard;
    var r = router.fromHash();
    if (r && r.name === 'play') {
      r = playGuard(r);
      if (!r) { router.go('home', null, { force: true }); r = false; }
    }
    if (r !== false) router.go(r ? r.route : 'home', r ? r.params : null, { force: true, mirror: false });
    renderBanner();
    api.ready = true;
    doc.documentElement.setAttribute('data-px-ready', '1');
    if (store.corrupt) ui.toast('The saved progress could not be read, so Parallax started fresh. A copy of the old data was kept in this browser.', { kind: 'warn', ms: 0 });
    bus.emit('app:ready', { first: firstRun(), sessions: R.sessions.length });
    showWelcome();
  }

  /* =====================================================================================
     Phones (B2, PLAN M2; I2 §9): the home-screen app and keeping the record
     ===================================================================================== */

  // The web manifest and the touch icon, only on https (GitHub Pages) and only for the app's own
  // files: on file:// Chrome logs a CORS error for a manifest, and the single-file build (styles
  // inlined) has no manifest next to it.
  function homeScreenLinks() {
    try {
      if (window.location.protocol !== 'https:' || env.framed || !doc.querySelector('link[rel="stylesheet"][href$="css/base.css"]')) return false;
      if (doc.querySelector('link[rel="manifest"]')) return true;
      var head = doc.head;
      [['link', { rel: 'manifest', href: 'manifest.webmanifest' }],
        ['link', { rel: 'apple-touch-icon', href: 'icons/apple-touch-icon.png' }],
        ['meta', { name: 'apple-mobile-web-app-title', content: 'Parallax' }],
        ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
        ['meta', { name: 'mobile-web-app-capable', content: 'yes' }]].forEach(function (x) {
        var el = doc.createElement(x[0]);
        Object.keys(x[1]).forEach(function (k) { el.setAttribute(k, x[1][k]); });
        head.appendChild(el);
      });
      return true;
    } catch (e) { return false; }
  }

  // Ask the browser to keep this site's storage (it may still say no). Once per page, as soon as the
  // record holds a session (at the start, or after the first session is saved), never while a
  // stimulus plays, and not on desktop Firefox, which asks the person with a prompt.
  var persistAsked = false;
  function askPersist() {
    try {
      var st = window.navigator && window.navigator.storage, R = store.state;
      if (persistAsked || !st || typeof st.persist !== 'function' || store.volatile || env.framed) return;
      if (!(R.sessions && R.sessions.length) || (doc.body && doc.body.classList.contains('px-stim'))) return;
      persistAsked = true;
      var ua = String(window.navigator.userAgent || ''), touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (/Firefox\//.test(ua) && !touch) return;
      Promise.resolve(typeof st.persisted === 'function' ? st.persisted() : false).then(function (yes) {
        if (!yes) return st.persist();
        return true;
      }).then(null, function () { /* refused or not allowed here: nothing to do */ });
    } catch (e) { /* not available */ }
  }

  // Chart labels (Progress and Lab curves) keep 13 px on a phone: each chart gets its drawing units
  // per CSS px as --px-u once it is laid out, and css/screens.css sizes the labels from it.
  function chartUnits() {
    try {
      Array.prototype.forEach.call(doc.querySelectorAll('svg.px-curve-svg, svg.px-lab-svg'), function (svg) {
        var r = svg.getBoundingClientRect(), vb = svg.viewBox && svg.viewBox.baseVal;
        if (r.width && r.height && vb && vb.width && vb.height) svg.style.setProperty('--px-u', String(Math.max(vb.width / r.width, vb.height / r.height)));
      });
    } catch (e) { /* the labels keep their drawing size */ }
  }
  function chartUnitsSoon() { try { window.requestAnimationFrame(chartUnits); } catch (e) { chartUnits(); } }
  var chartTimer = 0;

  bus.on('app:ready', function () { homeScreenLinks(); askPersist(); chartUnitsSoon(); });
  bus.on('store:saved', function () { if (!persistAsked && api && api.ready) askPersist(); });
  bus.on('route', chartUnitsSoon);
  window.addEventListener('resize', function () { window.clearTimeout(chartTimer); chartTimer = window.setTimeout(chartUnits, 200); });

  var api = {
    ready: false,
    env: env,
    rerender: rerender,
    applySettings: applySettings,
    isDark: isDark,
    motionReduced: motionReduced,
    backup: backup,
    exportDialog: exportDialog,
    markBackedUp: markBackedUp,
    showWelcome: showWelcome,
    offerTour: offerTour,
    openMore: openMore,
    focusMain: focusMain,
    firstRun: firstRun,
    NAV: NAV,
  };
  PX.ui.app = api;

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.PX);
