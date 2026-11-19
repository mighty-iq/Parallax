/* PX.ui.screens.settings: Settings (ARCHITECTURE §8–§9; PLAN §7, §10).
   A change writes PX.core.store.state.settings, saves, applies it to the page with
   PX.ui.app.applySettings() and emits 'settings' { key, value } on PX.bus.
   Data, all through PX.core.store: Back up now (JSON; sets settings.lastBackup), Export trials
   (CSV), Import (a file or pasted text; undoable once), Undo, Reset (settings stay; undoable
   once). Every export also offers Copy, because downloads are blocked in sandboxed previews.
   v1.2: gentle motion (Homing and Reckon), Sharing and privacy (the nickname, the only name a card
   or an export may carry; device details in exports, off by default) and Playtest mode (its
   switch, Copy playtest report, Clear the log). Your data has "Install Parallax on this device" while the
   browser offers it (PX.ui.app.install; W3-misc).
   Test hooks: [data-setting="<key>"] on each control, [data-action="…"] on each data button. */
(function (PX) {
  'use strict';

  var ui = PX.ui;
  var h = ui.h;
  var U = PX.util;

  var SCALES = [0.9, 1, 1.15, 1.3, 1.5];
  var SESSION_MIN = [10, 15, 20, 30];
  var WEEKLY = [2, 3, 4, 5, 6];

  // The listed values, plus the current one when an import brought another.
  function withCurrent(list, cur) {
    var out = list.slice();
    if (typeof cur === 'number' && out.indexOf(cur) < 0) { out.push(cur); out.sort(function (a, b) { return a - b; }); }
    return out;
  }

  function set(key) {
    return function (value) {
      var store = PX.core.store;
      store.state.settings[key] = value;
      store.save();
      PX.ui.app.applySettings();
      PX.bus.emit('settings', { key: key, value: value });
    };
  }

  // The weekly goal keeps its history (PX.engine.streak.setGoal), so past weeks are judged
  // against the goal they had.
  function setWeeklyGoal(value) {
    var store = PX.core.store, S = PX.engine && PX.engine.streak;
    if (S && typeof S.setGoal === 'function') S.setGoal(store.state, value, Date.now());
    else store.state.settings.weeklyGoal = value;
    store.save();
    PX.ui.app.applySettings();
    PX.bus.emit('settings', { key: 'weeklyGoal', value: store.state.settings.weeklyGoal });
  }

  function focusSection(name) {
    var hd = document.querySelector('[data-section="' + name + '"] .px-panel-title');
    if (!hd) return;
    hd.setAttribute('tabindex', '-1');
    try { hd.focus({ preventScroll: false }); } catch (e) { hd.focus(); }
  }

  // Re-renders Settings after the record changed underneath it, keeping the place.
  function refresh(section) {
    PX.ui.app.applySettings();
    PX.ui.app.rerender();
    if (section) focusSection(section);
  }

  function undo() {
    var store = PX.core.store;
    // Never under a running session: the record would change under its items.
    if (PX.core.router.current().name === 'play') { ui.toast('Finish or end the session first; Undo is in Settings.', { kind: 'info' }); return; }
    if (!store.undo()) { ui.toast('There is nothing to undo.', { kind: 'info' }); return; }
    refresh('data');
    ui.toast('Restored your progress from before the last import or reset.', { kind: 'ok' });
  }

  // The import and reset toasts offer Undo on this screen only: they go when the route changes.
  function undoToast(text) {
    var dismiss = ui.toast(text, { kind: 'ok', ms: 8000, action: { label: 'Undo', onClick: undo } });
    var off = PX.core.router.on(function () { off(); if (typeof dismiss === 'function') dismiss(); });
  }

  function appearance(s) {
    var K = PX.ui.kit;
    var p = K.panel({ title: 'Appearance', className: 'px-settings-section' });
    p.el.setAttribute('data-section', 'appearance');
    p.body.appendChild(K.segmented({
      key: 'theme', legend: 'Theme', value: s.theme,
      options: [{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }],
      hint: 'Auto follows the light or dark setting of your device.', onChange: set('theme'),
    }));
    p.body.appendChild(K.segmented({
      key: 'textScale', legend: 'Text size', num: true, value: s.textScale,
      options: withCurrent(SCALES, s.textScale).map(function (v) { return { value: v, label: Math.round(v * 100) + '%' }; }),
      hint: 'Scales all text and controls.', onChange: set('textScale'),
    }));
    p.body.appendChild(K.segmented({
      key: 'reducedMotion', legend: 'Motion', value: s.reducedMotion,
      options: [{ value: 'auto', label: 'Follow device' }, { value: 'on', label: 'Reduce' }, { value: 'off', label: 'Full' }],
      hint: 'Reduce shortens animations around the exercises. Moving stimuli, such as the spheres in Track, still move.',
      onChange: set('reducedMotion'),
    }));
    // v1.2 (CONTRACT-v1.2 F): the gentle motion profile of the walking exercises
    if (s.gentleMotion !== undefined) {
      p.body.appendChild(K.segmented({
        key: 'gentleMotion', legend: 'Gentle motion', value: s.gentleMotion,
        options: [{ value: 'auto', label: 'Auto' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }],
        hint: 'Slower, steadier walks and turns in Homing and Reckon, with a still dot to look at, for anyone who feels queasy watching the walks. Auto: on when Motion above is set to reduce, or your device asks for less motion.',
        onChange: set('gentleMotion'),
      }));
    }
    return p.el;
  }

  /* ---------- v1.2: what exports carry (CONTRACT-v1.2 I; the owner's standing rules, Privacy) ---------- */

  function privacy(s) {
    var K = PX.ui.kit, store = PX.core.store;
    var p = K.panel({ title: 'Sharing and privacy', className: 'px-settings-section' });
    p.el.setAttribute('data-section', 'privacy');
    var id = 'px-nickname', hintId = id + '-hint';
    var input = h('input.px-input.px-nickname', {
      id: id, type: 'text', maxlength: '24', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      placeholder: 'No nickname', 'aria-describedby': hintId,
    });
    input.value = typeof s.nickname === 'string' ? s.nickname : '';
    input.setAttribute('data-setting-input', 'nickname');
    var msg = h('span.px-field-hint.px-nickname-msg', { role: 'status', 'aria-live': 'polite' });
    function commit() {
      var v = String(input.value || '').replace(/\s+/g, ' ').trim().slice(0, 24);
      if (v === (store.state.settings.nickname || '')) return;
      set('nickname')(v);
      msg.textContent = v ? 'Saved: your cards show “' + v + '”.' : 'Saved: no nickname.';
    }
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    p.body.appendChild(h('div.px-setting', { 'data-setting': 'nickname' },
      h('label.px-setting-label', { for: id }, 'Nickname'),
      input,
      h('p.px-field-hint', { id: hintId }, 'Up to 24 characters, shown on your share cards and, only when you tick it there, in the Lab’s community export. Leave it empty to stay anonymous: Parallax never puts any other name in a card or a file.'),
      msg));
    p.body.appendChild(K.toggle({
      key: 'exportDevice', label: 'Device details in exports', checked: s.exportDevice === true,
      hint: 'Adds this browser’s name and version, its language, your time zone and the screen size to the Lab’s community export, and keeps the playtest log in backups. Off by default: exports then carry none of these.',
      onChange: set('exportDevice'),
    }));
    return p.el;
  }

  /* ---------- v1.2: playtest mode (js/ui/playtest.js) ---------- */

  function playtestPanel() {
    var K = PX.ui.kit, T = PX.ui.playtest;
    if (!T) return null;
    var p = K.panel({ title: 'Playtest mode', className: 'px-settings-section', aside: T.BUILD === 'test' ? 'test build' : null });
    p.el.setAttribute('data-section', 'playtest');
    var count = h('p.px-field-hint.px-playtest-count');
    function showCount() {
      var c = T.counts();
      count.textContent = c.ratings + (c.ratings === 1 ? ' rating, ' : ' ratings, ') + c.notes + (c.notes === 1 ? ' note, ' : ' notes, ') + c.errors + (c.errors === 1 ? ' error' : ' errors') + ' and ' + c.visits + (c.visits === 1 ? ' visit' : ' visits') + ' in the log.';
    }
    p.body.appendChild(K.toggle({
      key: 'playtest', label: 'Playtest mode', checked: T.on(),
      hint: 'For testing a build: three taps after each exercise (fun, clarity, difficulty), a Note button on every screen, and a report to copy with your ratings and notes, this device, frame timings, errors, your results, time played and where you stopped. ' +
        (T.BUILD === 'test' ? 'On by default in this test build.' : 'Off by default.') + ' The log stays on this device: it is never in the community export, and in backups only with device details on.',
      onChange: function (v) { T.set(v); showCount(); },
    }));
    var copy = ui.button('Copy playtest report', { kind: 'primary', onClick: function () { T.copyReport(); } });
    copy.setAttribute('data-action', 'playtest-copy');
    var show = ui.button('Show the report', { kind: 'secondary', onClick: function () { T.showReport(); } });
    show.setAttribute('data-action', 'playtest-show');
    var clear = ui.button('Clear the playtest log', { kind: 'secondary', onClick: function () {
      ui.confirm('This removes the ratings, notes, errors and timings of playtest mode. Your progress stays.', { title: 'Clear the playtest log?', ok: 'Clear the log', cancel: 'Keep it' })
        .then(function (yes) { if (yes) { T.clear(); showCount(); ui.toast('The playtest log is empty.', { kind: 'ok' }); } });
    } });
    clear.setAttribute('data-action', 'playtest-clear');
    showCount();
    p.body.appendChild(h('div.px-setting', h('div.px-data-row', copy, show, clear), count));
    return p.el;
  }

  function training(s) {
    var K = PX.ui.kit;
    var p = K.panel({ title: 'Training', className: 'px-settings-section' });
    p.el.setAttribute('data-section', 'training');
    p.body.appendChild(K.segmented({
      key: 'sessionMin', legend: 'Session length, in minutes', num: true, value: s.sessionMin,
      options: withCurrent(SESSION_MIN, s.sessionMin).map(function (v) { return { value: v, label: String(v), aria: v + ' minutes' }; }),
      hint: 'Twenty minutes is the default. Several effective programmes ran about 10 to 20 hours in all; more hours have not been shown to help more.',
      onChange: set('sessionMin'),
    }));
    p.body.appendChild(K.segmented({
      key: 'weeklyGoal', legend: 'Weekly goal, in sessions', num: true, value: s.weeklyGoal,
      options: withCurrent(WEEKLY, s.weeklyGoal).map(function (v) { return { value: v, label: String(v), aria: v + ' sessions a week' }; }),
      hint: 'Three a week is the default. In studies of older adults, more than three sessions a week brought no extra benefit.',
      onChange: setWeeklyGoal,
    }));
    return p.el;
  }

  function soundKeys(s) {
    var K = PX.ui.kit;
    var p = K.panel({ title: 'Sound and keys', className: 'px-settings-section' });
    p.el.setAttribute('data-section', 'sound');
    // Turning sounds on is a tap, which also lets the browser play them; a short sample confirms it.
    p.body.appendChild(K.toggle({ key: 'sound', label: 'Sounds', checked: !!s.sound,
      hint: 'A short tone after each answer: a high one when right, a low one when not. Never while an item plays. Off by default.',
      onChange: function (on) {
        set('sound')(on);
        var snd = PX.ui.play && PX.ui.play.sound;
        if (on && snd) { try { snd.unlock(); snd.play('right'); } catch (e) { /* no audio here: the setting stays */ } }
      } }));
    p.body.appendChild(K.toggle({ key: 'keyHints', label: 'Show key hints', checked: s.keyHints !== false, hint: 'Shows the keyboard shortcut on buttons and answer options.', onChange: set('keyHints') }));
    // v1.2 O22 (W3-phones; registered in js/ui/play.js)
    p.body.appendChild(K.toggle({ key: 'confirmTaps', label: 'Confirm taps', checked: s.confirmTaps === true,
      hint: 'On a touch screen, a first tap on an answer marks it and a second tap on the same answer gives it, so a scroll that ends on an answer never answers. Answer times then include the second tap. Keys and a mouse answer at once. Off by default.',
      onChange: set('confirmTaps') }));
    return p.el;
  }

  function dataPanel() {
    var K = PX.ui.kit, store = PX.core.store;
    var p = K.panel({ title: 'Your data', className: 'px-settings-section' });
    p.el.setAttribute('data-section', 'data');
    // Counted as the Log counts them: finished sessions, and unfinished ones (a stopped check) apart.
    var c = null;
    try { c = PX.ui.log.counts(store.state); } catch (e) { c = null; }
    if (!c) c = { trials: store.state.trials.length, finished: store.state.sessions.length, unfinished: 0 };

    var status = h('div.px-data-status',
      h('p', K.storageText()),
      h('p', K.backupLine()),
      !c.trials && !c.finished ? h('p', 'No trials recorded yet.') :
        h('p', h('span.px-num', String(c.trials)), c.trials === 1 ? ' trial recorded, in ' : ' trials recorded, in ',
          h('span.px-num', String(c.finished)), c.finished === 1 ? ' session finished' : ' sessions finished',
          c.unfinished ? [' and ', h('span.px-num', String(c.unfinished)), ' not finished'] : null, ' (all listed in the Log).'));

    var bk = ui.button('Back up now', { kind: 'primary', onClick: function () { PX.ui.app.backup(); } });
    bk.setAttribute('data-action', 'backup');
    var csv = ui.button('Export trials (CSV)', {
      kind: 'secondary',
      onClick: function () {
        PX.ui.app.exportDialog({
          title: 'Export trials',
          intro: 'One row per trial: time, exercise, session, settings, outcome, response time, screen class, input and any second value an exercise records, for a spreadsheet or your own analysis (the same file as the Log’s export). A CSV file cannot be imported; use Back up now to keep your progress.',
          text: store.exportCSV(),
          filename: 'parallax-trials-' + U.fmtDate(Date.now()) + '.csv',
          type: 'text/csv',
        });
      },
    });
    csv.setAttribute('data-action', 'export-csv');
    p.body.appendChild(h('div.px-setting', status, h('div.px-data-row', bk, csv),
      h('p.px-field-hint', 'On iPhone and iPad, Safari may clear site data after 7 days without a visit. Adding Parallax to your home screen, or backing up, avoids losing progress.')));

    // Installing on this device (W3-misc, after O21): shown only while the browser offers it (PX.ui.app.install
    // in js/ui/app.js, which holds the browser's own install bar so that it never covers an item)
    var inst = ui.button('Install Parallax on this device', {
      kind: 'secondary',
      onClick: function () { var I = PX.ui.app && PX.ui.app.install; if (I) I.prompt(); },
    });
    inst.setAttribute('data-action', 'install');
    var instRow = h('div.px-setting.px-install', inst,
      h('p.px-field-hint', 'Puts Parallax on your home screen or app list. It opens in its own window and keeps the same progress.'));
    p.body.appendChild(K.live(instRow, ['install:change'], function () {
      var I = PX.ui.app && PX.ui.app.install;
      instRow.hidden = !(I && I.available);
    }));

    // import
    var msg = h('p.px-import-msg', { role: 'status', 'aria-live': 'polite' });
    function say(text, kind) { msg.textContent = text; msg.className = 'px-import-msg' + (kind ? ' is-' + kind : ''); }
    function doImport(text) {
      var r = store.importJSON(text);
      if (!r.ok) { say(r.error + ' Nothing was changed.', 'error'); return; }
      var n = r.repairs ? r.repairs.length : 0;
      refresh('data');
      undoToast('Progress imported.' + (n ? ' ' + n + (n === 1 ? ' field was' : ' fields were') + ' repaired or left out.' : ''));
    }
    var fileId = 'px-import-file';
    var file = h('input.px-file', { type: 'file', id: fileId, accept: 'application/json,.json,text/plain' });
    file.setAttribute('data-action', 'import-file');
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () { doImport(String(reader.result || '')); try { file.value = ''; } catch (e) { /* ignore */ } };
      reader.onerror = function () { say('The file could not be read. Nothing was changed.', 'error'); };
      reader.readAsText(f);
    });
    var paste = h('textarea.px-textarea', { rows: '3', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Backup text to import', placeholder: 'Or paste the text of a backup here' });
    paste.setAttribute('data-action', 'import-text');
    var go = ui.button('Import pasted text', { kind: 'secondary', onClick: function () { doImport(paste.value); } });
    go.setAttribute('data-action', 'import-paste');
    p.body.appendChild(h('div.px-setting',
      h('label.px-setting-label', { for: fileId }, 'Import a backup'),
      h('p.px-field-hint', 'Replaces the progress in this browser with the file’s. You can undo it once, until you close Parallax.'),
      h('div.px-import', file, paste, h('div.px-data-row', go), msg)));

    // undo and reset
    var un = ui.button('Undo last import or reset', { kind: 'secondary', disabled: !store.canUndo(), onClick: undo });
    un.setAttribute('data-action', 'undo');
    var rs = ui.button('Reset progress', {
      kind: 'danger',
      onClick: function () {
        ui.confirm('This clears your levels, sessions, trials, checks and achievements. Your settings stay. You can undo it once, until you close Parallax.', {
          title: 'Reset all progress?', ok: 'Reset progress', cancel: 'Keep my progress', danger: true,
        }).then(function (yes) {
          if (!yes) return;
          store.reset({ keepSettings: true });
          refresh('data');
          undoToast('Progress reset.');
        });
      },
    });
    rs.setAttribute('data-action', 'reset');
    p.body.appendChild(h('div.px-setting', h('p.px-setting-label', 'Undo and reset'), h('div.px-data-row', un, rs)));
    return p.el;
  }

  function render(host) {
    var s = PX.core.store.state.settings;
    host.appendChild(h('div.px-screen-head', h('h1', 'Settings'),
      h('p.px-lead', 'Changes apply at once and are saved with your progress.')));
    var foot = h('p.px-settings-foot', 'Parallax ', h('span.px-num', 'v' + PX.version), '. Your data stays in this browser; nothing is sent anywhere. ',
      ui.button('About Parallax', { kind: 'ghost', small: true, go: 'about' }));
    var box = h('div.px-settings',
      appearance(s), training(s),
      typeof patFocusSection === 'function' ? patFocusSection(s) : null, // B7's (v1.1)
      typeof testSoonSection === 'function' ? testSoonSection(s) : null, // B7's (v1.1)
      soundKeys(s), privacy(s), dataPanel(), playtestPanel(), foot);
    // v1.2 wave 2 (CONTRACT-v1.2 R): sections other modules add, after the section they name
    if (PX.ui.hooks && typeof PX.ui.hooks.screen === 'function') PX.ui.hooks.screen('settings:sections', box, { rec: PX.core.store.state }, { before: foot });
    host.appendChild(box);
  }

  /* ---------- B7: PAT focus and "Taking a test soon?" (v1.1 PLAN M5, M6; R4 §6.4) ----------
     patFocusSection(s) and testSoonSection(s) return panels (or null when js/ui/overlap.js is not
     loaded); render() places them after training(s). The settings themselves are registered in
     js/ui/overlap.js; js/engine/schedule.js applies them to Train and Today's plan. */

  function names(ids) {
    return ids.map(function (id) { var d = PX.ex.get(id); return d ? d.short || d.name : id; });
  }
  function andList(list) { return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }

  function patFocusSection(s) {
    var K = PX.ui.kit, O = PX.ui.overlap, store = PX.core.store;
    if (!O) return null;
    var ids = O.patIds();
    var p = K.panel({ title: 'DAT-style formats', className: 'px-settings-section' });
    p.el.setAttribute('data-section', 'patfocus');
    p.body.appendChild(K.toggle({
      key: 'patFocus', label: 'DAT-style focus', checked: s.patFocus === true,
      hint: (ids.length ? 'Adds the DAT-style formats (' + andList(names(ids)) + ') to Train and Today’s plan.' : 'Adds the DAT-style formats to Train and Today’s plan once they are in this version.') +
        ' Off, they stay in the Library, Free play and Section practice. Use it when you are preparing for the Perceptual Ability Test of the Dental Admission Test.',
      onChange: function (on) {
        O.setFocus(store.state, on, Date.now());
        store.save();
        PX.bus.emit('settings', { key: 'patFocus', value: !!on });
      },
    }));
    p.body.appendChild(h('p.px-meta.px-overlap-legal', O.ADA));
    return p.el;
  }

  function testSoonSection(s, open) {
    var K = PX.ui.kit, O = PX.ui.overlap, store = PX.core.store, now = Date.now();
    if (!O) return null;
    var rec = store.state, linked = false;
    if (open === undefined) {
      // About's "Taking a test soon?" opens Settings at this section (route settings?section=testsoon).
      try { linked = PX.core.router.current().params.section === 'testsoon'; } catch (e) { linked = false; }
      open = linked;
    }
    var st = O.pauseState(rec, now);
    if (st.ended) { O.clearPause(rec); store.save(); st = O.pauseState(rec, now); } // the test day has passed
    var p = K.panel({ title: 'Taking a test soon?', className: 'px-settings-section px-testsoon' });
    p.el.setAttribute('data-section', 'testsoon');
    function redraw(keepOpen) {
      var fresh = testSoonSection(store.state.settings, keepOpen);
      if (fresh && p.el.parentNode) p.el.parentNode.replaceChild(fresh, p.el);
      return fresh;
    }
    p.body.appendChild(h('p.px-field-hint.px-testsoon-intro', 'Practising a kind of puzzle raises scores on tests that use it. Tick what your test contains to see which exercises practise the same kind of puzzle, and leave them out of Train until the day of the test. Nothing changes unless you use it.'));

    if (st.on) {
      var end = ui.button('End the pause now', { kind: 'secondary', small: true, onClick: function () {
        O.clearPause(store.state);
        store.save();
        PX.bus.emit('settings', { key: 'testPause', value: null });
        ui.toast('The pause has ended: these exercises can come up in Train again.', { kind: 'ok' });
        var f = redraw(false);
        var hd = f && f.querySelector('.px-panel-title');
        if (hd) { hd.setAttribute('tabindex', '-1'); try { hd.focus(); } catch (e) { /* ignore */ } }
      } });
      end.setAttribute('data-action', 'testpause-end');
      p.body.appendChild(h('div.px-setting.px-testsoon-active', { 'data-testpause': 'on' },
        h('p', h('b', 'Left out of Train until ' + U.fmtDate(st.until, 'long') + ': '), andList(names(st.ids)) + '.'),
        h('p.px-field-hint', 'Today’s plan leaves them out too. Free play, Path, Section practice and the Library still have them, and so does the Daily Challenge, which is the same for everyone.'),
        h('div.px-data-row', end)));
    } else {
      var body = h('div.px-testsoon-body', { hidden: !open });
      var start = ui.button(open ? 'Hide the helper' : 'Open the helper', { kind: 'secondary', small: true });
      start.setAttribute('data-action', 'testsoon-open');
      start.setAttribute('aria-expanded', open ? 'true' : 'false');
      start.addEventListener('click', function () {
        body.hidden = !body.hidden;
        start.setAttribute('aria-expanded', body.hidden ? 'false' : 'true');
        start.firstChild.textContent = body.hidden ? 'Open the helper' : 'Hide the helper';
      });
      p.body.appendChild(h('div.px-data-row', start));
      p.body.appendChild(body);
      fillHelper(body, function () { return redraw(false); });
    }
    noted(p.body, rec, function () { redraw(!st.on); });
    if (linked) {
      win.setTimeout(function () {
        var hd = p.el.querySelector('.px-panel-title');
        if (!hd || !p.el.isConnected) return;
        hd.setAttribute('tabindex', '-1');
        try { hd.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        try { p.el.scrollIntoView({ block: 'start' }); } catch (e) { /* ignore */ }
      }, 0);
    }
    return p.el;
  }
  var win = window;

  // The checklist, the three-line answer and the two actions.
  function fillHelper(body, done) {
    var O = PX.ui.overlap, store = PX.core.store, picked = [];
    var boxes = h('div.px-testsoon-kinds', { role: 'group', 'aria-label': 'What your test contains' });
    O.KINDS.forEach(function (k, i) {
      var id = 'px-ts-kind-' + i;
      var cb = h('input', { type: 'checkbox', id: id, value: k.id });
      cb.setAttribute('data-kind', k.id);
      cb.addEventListener('change', function () {
        var at = picked.indexOf(k.id);
        if (cb.checked && at < 0) picked.push(k.id);
        if (!cb.checked && at >= 0) picked.splice(at, 1);
        update();
      });
      boxes.appendChild(h('label.px-tick', { for: id }, cb, h('span', k.label)));
    });
    var answer = h('div.px-testsoon-answer', { 'aria-live': 'polite' });
    var dateId = 'px-ts-date-' + Date.now().toString(36);
    var date = h('input.px-input', { type: 'date', id: dateId, min: O.today(Date.now()) });
    date.setAttribute('data-action', 'testsoon-date');
    date.addEventListener('input', update);
    date.addEventListener('change', update);
    var msg = h('p.px-field-hint.px-testsoon-msg', { role: 'status' });
    var pauseBtn = ui.button('Leave them out of Train until the test', { kind: 'primary', small: true, onClick: function () { act(true); } });
    pauseBtn.setAttribute('data-action', 'testsoon-pause');
    var noteBtn = ui.button('Only note the test', { kind: 'secondary', small: true, onClick: function () { act(false); } });
    noteBtn.setAttribute('data-action', 'testsoon-note');

    function line(label, text, kind) { return h('p', { class: 'px-testsoon-line', 'data-line': kind }, h('b', label + ': '), text); }
    function update() {
      var m = O.match(picked);
      ui.clear(answer);
      if (!picked.length) answer.appendChild(h('p.px-meta', 'Tick at least one kind of puzzle.'));
      if (m.same.length) answer.appendChild(line('Same kind of puzzle', andList(names(m.same)) + ': practice here will likely raise your score on these parts.', 'same'));
      if (m.related.length) answer.appendChild(line('Related', andList(names(m.related)) + ': a small or unknown effect.', 'related'));
      m.untrained.forEach(function (u) { answer.appendChild(line(u.label, u.text, 'untrained')); });
      (m.notes || []).forEach(function (u) { answer.appendChild(h('p', { class: 'px-testsoon-line', 'data-line': 'note' }, u.text)); });
      if (picked.length && !m.same.length && !m.related.length && !m.untrained.length) answer.appendChild(h('p.px-meta', 'No exercise in this version matches.'));
      if (picked.indexOf('dat') >= 0) {
        // leaving formats out keeps a result free of fresh practice; preparing is what the focus is for
        answer.appendChild(h('p.px-testsoon-line', { 'data-line': 'focus' }, 'Preparing for this test rather than keeping its result free of practice? Turn on DAT-style focus above instead: it adds these formats to Train.'));
        answer.appendChild(h('p.px-overlap-legal', O.ADA)); // the DAT is named: the ADA line goes with it
      }
      var okDate = /^\d{4}-\d{2}-\d{2}$/.test(date.value) && date.value >= O.today(Date.now());
      pauseBtn.disabled = !(okDate && m.same.length);
      noteBtn.disabled = !(okDate && picked.length);
      msg.textContent = !picked.length ? '' : !okDate ? 'Choose the day of the test (today or later).' : !m.same.length ? 'Nothing to leave out: no exercise practises the same kind of puzzle.' : '';
    }
    function act(withPause) {
      var rec = store.state, now = Date.now(), m = O.match(picked), pz = null;
      if (withPause) {
        pz = O.pause(rec, picked, date.value, now);
        if (!pz) { update(); return; }
      }
      O.noteTest(rec, { date: date.value, kinds: picked.slice(), paused: pz ? pz.ids : [] }, now);
      store.save();
      if (pz) PX.bus.emit('settings', { key: 'testPause', value: pz });
      ui.toast(pz ? andList(names(pz.ids)) + (pz.ids.length === 1 ? ' stays' : ' stay') + ' out of Train until ' + U.fmtDate(pz.until, 'long') + '. Free play, the Library and the Daily Challenge (the same for everyone) still have ' + (pz.ids.length === 1 ? 'it.' : 'them.') : 'Noted: your test on ' + U.fmtDate(date.value, 'long') + '.', { kind: 'ok' });
      void m;
      done();
    }
    body.appendChild(h('fieldset.px-field', h('legend.px-field-label.px-setting-label', 'What does the test contain?'), boxes));
    body.appendChild(answer);
    body.appendChild(h('div.px-setting', h('label.px-setting-label', { for: dateId }, 'Day of the test'), date));
    body.appendChild(h('div.px-data-row', pauseBtn, noteBtn));
    body.appendChild(msg);
    update();
  }

  // Tests the player noted: kept in the record (and the backup) so pooled data can allow for them.
  function noted(parent, rec, changed) {
    var O = PX.ui.overlap, store = PX.core.store;
    var list = rec.hygiene && Array.isArray(rec.hygiene.tests) ? rec.hygiene.tests.slice(-5).reverse() : [];
    if (!list.length) return;
    var ul = h('ul.px-testsoon-noted');
    list.forEach(function (t) {
      var kinds = t.kinds.map(function (k) { var K = O.kind(k); return K ? K.label.charAt(0).toLowerCase() + K.label.slice(1) : k; });
      var rm = ui.button('Remove', { kind: 'ghost', small: true, ariaLabel: 'Remove the test noted for ' + (t.date ? U.fmtDate(t.date, 'long') : 'an unknown day'), onClick: function () {
        O.removeTest(store.state, t.at);
        store.save();
        changed();
      } });
      rm.setAttribute('data-action', 'testsoon-remove');
      ul.appendChild(h('li', h('span', h('b.px-num', t.date ? U.fmtDate(t.date, 'long') : 'Day not given'), ': ' + (kinds.join('; ') || 'kinds not given') + (t.paused.length ? ' (' + t.paused.length + ' left out of Train)' : '') + '.'), rm));
    });
    parent.appendChild(h('div.px-setting.px-testsoon-list', h('p.px-setting-label', 'Tests you noted'), ul,
      h('p.px-field-hint', 'Kept in your record and backups, so data pooled from many people can allow for outside tests.')));
  }

  PX.ui.settingsSections = { patFocus: patFocusSection, testSoon: testSoonSection };

  PX.ui.screens = PX.ui.screens || {};
  PX.ui.screens.settings = { title: 'Settings', render: render };
})(window.PX);
