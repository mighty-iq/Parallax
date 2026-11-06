/* PX.ui.screens.settings: Settings (ARCHITECTURE §8–§9; PLAN §7, §10).
   A change writes PX.core.store.state.settings, saves, applies it to the page with
   PX.ui.app.applySettings() and emits 'settings' { key, value } on PX.bus.
   Data, all through PX.core.store: Back up now (JSON; sets settings.lastBackup), Export trials
   (CSV), Import (a file or pasted text; undoable once), Undo, Reset (settings stay; undoable
   once). Every export also offers Copy, because downloads are blocked in sandboxed previews.
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
    p.body.appendChild(K.toggle({ key: 'sound', label: 'Sounds', checked: !!s.sound, hint: 'Short tones after answers. Off by default.', onChange: set('sound') }));
    p.body.appendChild(K.toggle({ key: 'keyHints', label: 'Show key hints', checked: s.keyHints !== false, hint: 'Shows the keyboard shortcut on buttons and answer options.', onChange: set('keyHints') }));
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
          intro: 'One row per trial: time, exercise, settings, outcome and response time, for a spreadsheet or your own analysis. A CSV file cannot be imported; use Back up now to keep your progress.',
          text: store.exportCSV(),
          filename: 'parallax-trials-' + U.fmtDate(Date.now()) + '.csv',
          type: 'text/csv',
        });
      },
    });
    csv.setAttribute('data-action', 'export-csv');
    p.body.appendChild(h('div.px-setting', status, h('div.px-data-row', bk, csv),
      h('p.px-field-hint', 'On iPhone and iPad, Safari may clear site data after 7 days without a visit. Adding Parallax to your home screen, or backing up, avoids losing progress.')));

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
    host.appendChild(h('div.px-settings',
      appearance(s), training(s), soundKeys(s), dataPanel(),
      h('p.px-settings-foot', 'Parallax ', h('span.px-num', 'v' + PX.version), '. Your data stays in this browser; nothing is sent anywhere. ',
        ui.button('About Parallax', { kind: 'ghost', small: true, go: 'about' }))));
  }

  PX.ui.screens = PX.ui.screens || {};
  PX.ui.screens.settings = { title: 'Settings', render: render };
})(window.PX);
