/* PX.ui.screens.log: the Log (PHASE-3 "Builder B" 3; ARCHITECTURE §8; ENGINE.md §15).
   Sessions, newest first, each with its trials (built when opened, so 20 000 rows stay cheap);
   trial rows that belong to no finished session are grouped as "not finished". Filters by
   exercise and mode (route params ex=<id>, mode=<name>). Exports: the whole record as JSON
   (the backup) and the trials as CSV (download, and Copy because downloads may be blocked);
   import a backup with one-step undo, all through PX.core.store.

   PX.ui.log
     rows(rec)                 every trial row decoded: { i, t, exId, ver, mode, code, seed,
                               outcome, rt, value, p, stage, session }
     sessions(rec, rows)       finished sessions plus "not finished" groups, newest first
     csv(rows, opts)           CSV text (RFC 4180, CRLF); opts.research adds the item model's
                               difficulty b and guessing rate g for each row of the current version
     exportCSV(rows, opts)     the export dialog for csv() */
(function (PX) {
  'use strict';

  var ui = PX.ui;
  var h = ui.h;
  var U = PX.util;
  var PAGE = 25;
  var OUT = ['wrong', 'right', 'stutter', 'skipped'];
  var OUT_TEXT = { 0: 'wrong', 1: 'right', 2: 'not counted', 3: 'skipped' };

  function E() { return PX.engine; }
  function X() { return PX.ui.exinfo; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  /* ---------- data ---------- */

  function rows(rec) {
    var out = [], nm = E().log.names(rec), t = Array.isArray(rec.trials) ? rec.trials : [];
    for (var i = 0; i < t.length; i++) {
      var r = t[i];
      if (!Array.isArray(r) || r.length < 7) continue;
      out.push({
        i: i, t: r[0], exId: nm.ex[r[1]] || null, ver: nm.ver[r[1]] || 1, mode: nm.mode[r[2]] || null, code: r[3], seed: r[4],
        outcome: r[5], rt: isNum(r[6]) ? r[6] : null, value: isNum(r[7]) ? r[7] : null,
        p: isNum(r[8]) ? r[8] / 1000 : null, stage: isNum(r[9]) ? r[9] : null, session: null, raw: r,
        display: isNum(r[10]) ? r[10] : 0, input: isNum(r[11]) ? r[11] : 0, // v1.1 columns 11-12 (codes; 0 unknown)
        value2: isNum(r[12]) ? r[12] : null, // v1.1 column 13: an exercise's second number
      });
    }
    return out;
  }

  // Assigns rows to the session whose time window and mode hold them (both lists are in time
  // order); rows left over are grouped by mode and closeness in time as unfinished sessions.
  function sessions(rec, rs) {
    var list = (Array.isArray(rec.sessions) ? rec.sessions : []).filter(function (s) { return s && isNum(s.start); })
      .map(function (s) {
        return { id: s.id, start: s.start, end: isNum(s.end) ? s.end : s.start, mode: s.mode, trials: s.trials, right: s.right, practiceMs: s.practiceMs,
          exs: (s.exs || []).slice(), summary: s.summary, rows: [], done: true };
      }).sort(function (a, b) { return a.start - b.start; });
    var j = 0, orphans = [];
    rs.forEach(function (r) {
      var ms = r.t * 1000;
      while (j < list.length && list[j].end + 2000 < ms) j++;
      var hit = null;
      for (var k = j; k < list.length && list[k].start - 2000 <= ms; k++) {
        if (list[k].end + 2000 >= ms && list[k].mode === r.mode) { hit = list[k]; break; }
      }
      if (hit) { hit.rows.push(r); r.session = hit.id; } else orphans.push(r);
    });
    var cur = null;
    orphans.forEach(function (r) {
      if (!cur || cur.mode !== r.mode || r.t * 1000 - cur.end > 30 * 60000) {
        cur = { id: 'open-' + r.i, start: r.t * 1000, end: r.t * 1000, mode: r.mode, rows: [], exs: [], done: false };
        list.push(cur);
      }
      cur.rows.push(r);
      cur.end = r.t * 1000;
      if (r.exId && cur.exs.indexOf(r.exId) < 0) cur.exs.push(r.exId);
    });
    list.forEach(function (s) {
      if (s.done) return;
      var ans = s.rows.filter(function (r) { return r.outcome === 0 || r.outcome === 1; });
      s.trials = ans.length;
      s.right = ans.filter(function (r) { return r.outcome === 1; }).length;
    });
    return list.sort(function (a, b) { return b.start - a.start; });
  }

  // Sessions are counted one way everywhere (Log, Settings): finished sessions, plus the groups of
  // trial rows that belong to none ("not finished", such as a stopped Spatial Check).
  function tally(rs, ss) {
    var open = ss.filter(function (s) { return !s.done; }).length;
    return { trials: rs.length, finished: ss.length - open, unfinished: open };
  }
  function counts(rec) { var rs = rows(rec); return tally(rs, sessions(rec, rs)); }
  function countText(c) {
    return c.finished + (c.finished === 1 ? ' session finished' : ' sessions finished') + (c.unfinished ? ' · ' + c.unfinished + ' not finished' : '') +
      ' · ' + c.trials + (c.trials === 1 ? ' trial' : ' trials');
  }

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    // A text cell that a spreadsheet would run as a formula (an imported record can hold any
    // string) gets a leading apostrophe; numbers stay numbers.
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function paramsOf(r) {
    var def = r.exId ? PX.ex.get(r.exId) : null;
    return def ? E().log.rowParams(def, r.raw, r.ver) : null;
  }

  function paramsCsv(def, p) {
    if (!def || !p) return '';
    var parts = def.dims.map(function (d) { var v = d.levels[p[d.key]]; return d.key + '=' + (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v)); });
    if (p.variant !== undefined) parts.push('variant=' + p.variant);
    return parts.join(';');
  }

  // The one trial CSV (Settings, the Log and the Lab's research export; store.exportCSV() writes
  // it through store.csv below): the header is PX.core.store.CSV_HEADER, plus b, g and answer for
  // the research export.
  var HEAD = ['time_iso', 't_sec', 'exercise', 'version', 'mode', 'session', 'params_code', 'params', 'seed', 'outcome', 'outcome_label', 'rt_ms', 'value', 'p_pred', 'stage', 'display', 'input', 'value2'];
  function csv(rs, opts) {
    var research = !!(opts && opts.research), S = PX.core.store;
    var head = (S && Array.isArray(S.CSV_HEADER) ? S.CSV_HEADER : HEAD).slice();
    var DISP = S && S.DISPLAYS ? S.DISPLAYS : ['', 'small', 'large'], INP = S && S.INPUTS ? S.INPUTS : ['', 'mouse', 'touch', 'pen', 'key'];
    if (research) head = head.concat(['b', 'g', 'answer']);
    var lines = [head.join(',')];
    rs.forEach(function (r) {
      var def = r.exId ? PX.ex.get(r.exId) : null, p = paramsOf(r), d = new Date(r.t * 1000);
      var row = [isFinite(d.getTime()) ? d.toISOString() : '', r.t, r.exId || '', r.ver, r.mode || '', r.session || '', r.code, paramsCsv(def, p), r.seed,
        r.outcome, OUT[r.outcome], r.rt, r.value, r.p === null ? '' : U.round(r.p, 3), r.stage, DISP[r.display] || '', INP[r.input] || '', r.value2];
      if (research) {
        var b = '', g = '', ans = '';
        if (def && p) {
          try { b = U.round(def.difficulty(p), 4); g = U.round(def.chance(p), 4); } catch (e) { b = ''; g = ''; }
          ans = (def.answers && p.variant !== undefined && def.answers[p.variant]) || def.answer;
        }
        row.push(b, g, ans);
      }
      lines.push(row.map(csvCell).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  function exportCSV(rs, opts) {
    var o = opts || {};
    return PX.ui.app.exportDialog({
      title: o.title || 'Export trials',
      intro: o.intro || ('One row per trial (' + rs.length + ' rows): time, exercise and its item-model version, mode, session, settings, seed, outcome, response time, the predicted chance of a right answer, the interleaving stage, the screen class and the input. A CSV file cannot be imported; Back up keeps your whole record.'),
      text: csv(rs, o),
      filename: o.filename || ('parallax-trials-' + U.fmtDate(Date.now()) + '.csv'),
      type: 'text/csv',
    });
  }

  /* ---------- pieces ---------- */

  function exName(id) { var d = id && PX.ex.get(id); return d ? d.short : id ? id : 'unknown exercise'; }

  function outcomeCell(o) {
    var mark = o === 1 ? '✓' : o === 0 ? '✗' : o === 2 ? '–' : '↷';
    return h('td', { class: ['px-log-out', 'is-' + OUT[o]], 'data-label': 'Answer' }, h('span', { 'aria-hidden': 'true' }, mark + ' '), OUT_TEXT[o]);
  }

  function timeOfDay(t) { var d = new Date(t * 1000); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2); }

  function trialTable(s, exFilter) {
    var list = exFilter ? s.rows.filter(function (r) { return r.exId === exFilter; }) : s.rows;
    if (!list.length) return h('p.px-meta', 'No trials of this exercise in this session.');
    var body = list.map(function (r, k) {
      var def = r.exId ? PX.ex.get(r.exId) : null, p = paramsOf(r);
      return h('tr', { 'data-outcome': OUT[r.outcome] },
        h('td.px-num', { 'data-label': '#' }, String(k + 1)),
        h('td.px-num', { 'data-label': 'Time' }, timeOfDay(r.t)),
        h('th', { scope: 'row', 'data-label': 'Exercise' }, exName(r.exId)),
        h('td.px-log-set', { 'data-label': 'Settings' }, def && p ? X().paramsText(def, p) : 'code ' + r.code + (def ? ' (older version)' : '')),
        outcomeCell(r.outcome),
        h('td.px-num', { 'data-label': 'Response time' }, X().secs(r.rt)),
        h('td.px-num', { 'data-label': 'Predicted' }, r.p === null ? '–' : Math.round(r.p * 100) + ' %'));
    });
    return h('div.px-table-wrap', h('table.px-table.px-table--stack.px-log-table',
      h('caption.px-sr', 'Trials of this session in order'),
      h('thead', h('tr', ['#', 'Time', 'Exercise', 'Settings', 'Answer', 'Response time', 'Predicted'].map(function (c) { return h('th', { scope: 'col' }, c); }))),
      h('tbody', body)));
  }

  function levelLine(s) {
    var ex = s.summary && Array.isArray(s.summary.ex) ? s.summary.ex : [];
    var parts = ex.filter(function (e) { return Array.isArray(e) && isNum(e[3]) && isNum(e[4]); }).map(function (e) { return exName(e[0]) + ' ' + e[3] + ' → ' + e[4]; });
    return parts.length ? h('p.px-meta', 'Levels at the start and end: ' + parts.join(', ') + '.') : null;
  }

  function sessionItem(s, exFilter) {
    var nRows = exFilter ? s.rows.filter(function (r) { return r.exId === exFilter; }).length : s.rows.length;
    var not = s.rows.filter(function (r) { return r.outcome >= 2; }).length;
    // practice time in the one format of every screen (PX.core.clock.fmtMinutes)
    var mins = isNum(s.practiceMs) && s.practiceMs > 0 ? PX.core.clock.fmtMinutes(s.practiceMs) : null;
    var body = h('div.px-sess-body');
    var d = h('details.px-sess', { 'data-session': s.id, 'data-mode': s.mode || '' },
      h('summary.px-sess-sum',
        h('span.px-sess-when.px-num', X().when(s.start)),
        h('span.px-sess-mode', X().modeName(s.mode), s.done ? null : h('span.px-tag', 'not finished')),
        h('span.px-sess-exs', s.exs.map(exName).join(', ') || '–'),
        h('span.px-sess-score.px-num', (s.right || 0) + ' of ' + (s.trials || 0) + ' right'),
        h('span.px-sess-len.px-num', mins || nRows + (nRows === 1 ? ' trial' : ' trials'))),
      body);
    var built = false;
    d.addEventListener('toggle', function () {
      if (!d.open || built) return;
      built = true;
      body.appendChild(levelLine(s) || h('span'));
      if (!s.done && s.mode === 'check') body.appendChild(h('p.px-meta', 'Stopped before the end. A check counts only when it is complete, so these answers are not used for your results; they stay here.'));
      body.appendChild(h('p.px-meta', nRows + (nRows === 1 ? ' trial' : ' trials') + (not ? ', ' + not + ' of them not counted or skipped (they never change a level)' : '') + '.'));
      body.appendChild(trialTable(s, exFilter));
    });
    return h('li', d);
  }

  /* ---------- import ---------- */

  function importPanel(onDone) {
    var store = PX.core.store;
    var msg = h('p.px-import-msg', { role: 'status', 'aria-live': 'polite' });
    function say(t, k) { msg.textContent = t; msg.className = 'px-import-msg' + (k ? ' is-' + k : ''); }
    function undo() {
      // Never under a running session: the record would change under its items.
      if (PX.core.router.current().name === 'play') { ui.toast('Finish or end the session first; Undo is in the Log.', { kind: 'info' }); return; }
      if (!store.undo()) { ui.toast('There is nothing to undo.', { kind: 'info' }); return; }
      onDone();
      ui.toast('Restored your progress from before the last import.', { kind: 'ok' });
    }
    function doImport(text) {
      var r = store.importJSON(text);
      if (!r.ok) { say(r.error + ' Nothing was changed.', 'error'); return; }
      var n = r.repairs ? r.repairs.length : 0;
      onDone();
      // Undo belongs to this screen: the toast goes when the route changes.
      var dismiss = ui.toast('Backup imported.' + (n ? ' ' + n + (n === 1 ? ' field was' : ' fields were') + ' repaired or left out.' : ''), { kind: 'ok', ms: 9000, action: { label: 'Undo', onClick: undo } });
      var off = PX.core.router.on(function () { off(); if (typeof dismiss === 'function') dismiss(); });
    }
    var fileId = 'px-log-import-file';
    var file = h('input.px-file', { type: 'file', id: fileId, accept: 'application/json,.json,text/plain', 'data-action': 'log-import-file' });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () { doImport(String(reader.result || '')); try { file.value = ''; } catch (e) { /* ignore */ } };
      reader.onerror = function () { say('The file could not be read. Nothing was changed.', 'error'); };
      reader.readAsText(f);
    });
    var paste = h('textarea.px-textarea', { rows: '2', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Backup text to import', placeholder: 'Or paste the text of a backup here', 'data-action': 'log-import-text' });
    var go = ui.button('Import pasted text', { kind: 'secondary', onClick: function () { doImport(paste.value); } });
    go.setAttribute('data-action', 'log-import-paste');
    var un = ui.button('Undo last import', { kind: 'ghost', disabled: !store.canUndo(), onClick: undo });
    un.setAttribute('data-action', 'log-undo');
    return h('div.px-log-import',
      h('label.px-setting-label', { for: fileId }, 'Import a backup'),
      h('p.px-field-hint', 'Replaces the record in this browser with the backup’s. You can undo it once, until you close Parallax.'),
      h('div.px-import', file, paste, h('div.px-data-row', go, un), msg));
  }

  /* ---------- the screen ---------- */

  function selectEl(id, label, options, value, onChange) {
    var sel = h('select.px-select', { id: id });
    options.forEach(function (o) { sel.appendChild(h('option', { value: o.value, selected: o.value === value }, o.label)); });
    sel.addEventListener('change', function () { onChange(sel.value); });
    return h('div.px-log-filter', h('label.px-field-label', { for: id }, label), sel);
  }

  function render(host, route) {
    var rec = PX.core.store.state, params = (route && route.params) || {};
    var all = rows(rec), sess = sessions(rec, all);
    var folded = 0;
    Object.keys(rec.trialDays || {}).forEach(function (k) { folded += (rec.trialDays[k] && rec.trialDays[k].n) || 0; });
    var exIds = [], modes = [];
    all.forEach(function (r) {
      if (r.exId && exIds.indexOf(r.exId) < 0) exIds.push(r.exId);
      if (r.mode && modes.indexOf(r.mode) < 0) modes.push(r.mode);
    });
    sess.forEach(function (s) { if (s.mode && modes.indexOf(s.mode) < 0) modes.push(s.mode); });
    exIds.sort(function (a, b) { var A = PX.ex.get(a), B = PX.ex.get(b); return String(A ? A.code : a).localeCompare(String(B ? B.code : b)); });
    var st = { ex: exIds.indexOf(params.ex) >= 0 ? params.ex : '', mode: modes.indexOf(params.mode) >= 0 ? params.mode : '', shown: PAGE };

    host.appendChild(h('div.px-screen-head',
      h('p.px-screen-meta', countText(tally(all, sess))),
      h('h1', 'Log'),
      h('p.px-lead', 'Every session and trial you have played, newest first, with exports for your own analysis. Nothing here ever leaves this device unless you export it.')));

    var K = PX.ui.kit;
    var bk = ui.button('Back up (JSON)', { kind: 'primary', onClick: function () { PX.ui.app.backup(); } });
    bk.setAttribute('data-action', 'log-backup');
    var ex = ui.button('Export trials (CSV)', { kind: 'secondary', onClick: function () {
      var rs = filtered();
      exportCSV(rs, { intro: (st.ex || st.mode ? 'The trials shown with your filters: ' : 'Every trial: ') + rs.length + ' rows with time, exercise and its version, mode, session, settings, seed, outcome, response time, the predicted chance of a right answer and the interleaving stage. A CSV file cannot be imported; the JSON backup keeps your whole record.' });
    } });
    ex.setAttribute('data-action', 'log-csv');
    var dataPanel = K.panel({ title: 'Export and import', className: 'px-log-data' });
    dataPanel.body.appendChild(h('div.px-data-row', bk, ex, h('span.px-meta', K.backupLine())));
    dataPanel.body.appendChild(importPanel(function () { PX.ui.app.applySettings(); PX.ui.app.rerender(); }));

    var listHost = h('div.px-log-list');
    function filtered() {
      var out = [];
      sess.forEach(function (s) {
        if (st.mode && s.mode !== st.mode) return;
        s.rows.forEach(function (r) { if (!st.ex || r.exId === st.ex) out.push(r); });
      });
      return out.sort(function (a, b) { return a.t - b.t || a.i - b.i; });
    }
    function draw() {
      ui.clear(listHost);
      var shown = sess.filter(function (s) {
        if (st.mode && s.mode !== st.mode) return false;
        if (st.ex && !s.rows.some(function (r) { return r.exId === st.ex; }) && s.exs.indexOf(st.ex) < 0) return false;
        return true;
      });
      if (!sess.length) {
        listHost.appendChild(h('div.px-log-empty',
          h('p', h('b', 'No sessions yet. '), 'Each session will be listed here with its trials: the settings of every item, your answer, the response time and the chance the engine predicted.'),
          h('div.px-data-row', ui.button('Start today’s session', { kind: 'primary', go: 'play?mode=train' }), h('span.px-meta', 'Moving from another device? Import its backup below.'))));
        return;
      }
      if (!shown.length) { listHost.appendChild(h('p.px-meta.px-log-none', 'No sessions match these filters.')); return; }
      var open = shown.filter(function (s) { return !s.done; }).length;
      listHost.appendChild(h('p.px-meta.px-log-count', { role: 'status' }, shown.length + (shown.length === 1 ? ' session' : ' sessions') + (open ? ' (' + open + ' not finished)' : '') + (st.ex || st.mode ? ' match' + (shown.length === 1 ? 'es' : '') + ' the filters.' : '.')));
      var ol = h('ol.px-sessions');
      shown.slice(0, st.shown).forEach(function (s) { ol.appendChild(sessionItem(s, st.ex)); });
      listHost.appendChild(ol);
      if (shown.length > st.shown) {
        var more = ui.button('Show ' + Math.min(PAGE, shown.length - st.shown) + ' more', { kind: 'secondary', onClick: function () { st.shown += PAGE; draw(); } });
        more.setAttribute('data-action', 'log-more');
        listHost.appendChild(h('p.px-log-more', more, h('span.px-meta', ' of ' + shown.length)));
      }
    }

    var filters = h('div.px-log-filters',
      selectEl('px-log-ex', 'Exercise', [{ value: '', label: 'All exercises' }].concat(exIds.map(function (id) { return { value: id, label: exName(id) }; })), st.ex, function (v) { st.ex = v; st.shown = PAGE; draw(); }),
      selectEl('px-log-mode', 'Mode', [{ value: '', label: 'All modes' }].concat(modes.map(function (m) { return { value: m, label: X().modeName(m) }; })), st.mode, function (v) { st.mode = v; st.shown = PAGE; draw(); }));

    var listPanel = K.panel({ title: 'Sessions', className: 'px-log-sessions', aside: folded ? h('span.px-num', folded + ' older trials kept as daily totals') : null });
    if (sess.length) listPanel.body.appendChild(filters);
    listPanel.body.appendChild(listHost);
    draw();
    host.appendChild(h('div.px-log', listPanel.el, dataPanel.el));
  }

  // The whole record's trials with their sessions: what store.exportCSV() (Settings) writes, so
  // both exports are the same file.
  function csvText(rec) { var rs = rows(rec); sessions(rec, rs); return csv(rs); }
  if (PX.core.store) PX.core.store.csv = csvText;

  PX.ui.log = { rows: rows, sessions: sessions, counts: counts, countText: countText, csv: csv, csvText: csvText, exportCSV: exportCSV };
  PX.ui.screens = PX.ui.screens || {};
  PX.ui.screens.log = { title: 'Log', render: render };
})(window.PX);
