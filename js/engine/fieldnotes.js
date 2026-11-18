/* PX.engine.notes: weekly field notes (v1.2, PLAN milestone 5; note G1 §2.7; ENGINE.md §24). Pure.
   Each Monday (local weeks) the app offers three notes drawn for the week from the templates that apply
   to the record; the player keeps up to two (a small, real choice: Patall et al. 2008). A kept note is
   done when the record shows it, checked at the end of each session. Notes ask for skill or good practice
   only: never minutes, sessions, days in a row, logins or numbers of items (Lehtivuori 2023). Unfinished
   notes go on Sunday night without a message; nothing is lost and nothing is counted across weeks.

   Templates (id: what it asks · done when):
     first     a first on a named exercise (a cell it has not handled) · a new first there
     best      beat your best block on any exercise · a new best block
     review    the Path recheck that is due on an exercise · the stage's recheck is no longer due
     variant   the least-played version of an exercise · an answer on that version
     path      pass the Path stage an exercise is on · that stage passed
     climb     one rung higher than last week's best Climb · this week's best above it
     strategy  report a strategy after a session (the check-in) · a check-in this week
     check     the Spatial Check that is due · a check taken this week

     state(rec, now) → { week, offer: [note], kept: [i], done: { i: ms } }   (the week's offer is made once)
     keep(rec, now, i, on) → true when the choice changed (at most config.game.notes.keep kept)
     check(rec, now, plan, res) → [{ i, note }] newly done kept notes (the finish hook) */
(function (PX) {
  'use strict';

  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;
  var E = PX.engine;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }
  function C() { return E.config.game.notes; }
  function defOf(id) { return PX.ex.get(id); }
  var IDS = ['first', 'best', 'review', 'variant', 'path', 'climb', 'strategy', 'check'];

  function tried(rec) {
    return PX.ex.list('train').filter(function (d) { var t = E.schedule.totals(rec, d); return t && t.n > 0; });
  }
  function lastExercises(rec) {
    var ss = isArray(rec.sessions) ? rec.sessions : [], out = [];
    for (var i = ss.length - 1; i >= 0 && out.length < 6; i--) {
      var s = ss[i];
      if (isObj(s) && s.mode !== 'check' && isArray(s.exs)) s.exs.forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
    }
    return out;
  }
  // Answers per variant of each exercise (current version), from the latest 3,000 trial rows (recent play
  // decides which version is the least played; the scan stays short on a long record).
  function variantCounts(rec) {
    var out = {}, rows = isArray(rec.trials) ? rec.trials.length : 0;
    E.log.scan(rec, function (row, id, mode, ver) {
      if (!id || (row[5] !== 0 && row[5] !== 1)) return;
      var def = defOf(id);
      if (!def || !def.variants || (def.version || 1) !== ver) return;
      var p = E.log.rowParams(def, row, ver);
      if (!p) return;
      var m = out[id] || (out[id] = {});
      m[p.variant] = (m[p.variant] || 0) + 1;
    }, Math.max(0, rows - 3000));
    return out;
  }

  // What each template would ask this week, or null when it does not apply.
  function candidates(rec, now, wk) {
    var out = [], tr = tried(rec), recent = lastExercises(rec);
    // first: the latest exercise with an unhandled cell within reach
    for (var i = 0; i < recent.length; i++) {
      var wr = E.game.withinReach(rec, now, recent[i]);
      if (wr) { out.push({ id: 'first', ex: wr.exId }); break; }
    }
    if (tr.some(function (d) { return !!E.game.bestOf(rec, d.id); })) out.push({ id: 'best' });
    var due = null;
    tr.some(function (d) { var s = E.path.due(rec, d, now); if (s.length) { due = { id: 'review', ex: d.id, s: s[0] }; return true; } return false; });
    if (due) out.push(due);
    var vc = null;
    tr.forEach(function (d) {
      var tv = isArray(d.trainVariants) && d.trainVariants.length ? d.trainVariants : d.variants;
      if (!isArray(tv) || tv.length < 2) return;
      vc = vc || variantCounts(rec);
      var m = vc[d.id] || {}, least = null;
      tv.forEach(function (v) { if (least === null || (m[v] || 0) < (m[least] || 0)) least = v; });
      if (!out.some(function (x) { return x.id === 'variant'; }) && least !== null) out.push({ id: 'variant', ex: d.id, v: least });
    });
    var ps = null;
    tr.some(function (d) {
      var p = isObj(rec.path) ? rec.path[d.id] : null;
      if (isObj(p) && isNum(p.stage) && p.stage >= 1 && !(isObj(p.passed) && isObj(p.passed[p.stage]))) { ps = { id: 'path', ex: d.id, s: p.stage }; return true; }
      return false;
    });
    if (ps) out.push(ps);
    var cs = E.climb.state(rec, now);
    if (isNum(cs.last) && cs.last < cs.rungs) out.push({ id: 'climb', h: cs.last });
    if (tr.some(function (d) { var t = E.schedule.totals(rec, d); return t.n >= 10; })) out.push({ id: 'strategy' });
    try { var nc = E.assess.nextCheck(rec, now); if (nc && nc.ready) out.push({ id: 'check' }); } catch (e) { /* no check this week */ }
    void wk;
    return out;
  }

  function slot(rec) {
    var g = E.game.game(rec), n = g.notes;
    return n;
  }
  function state(rec, now) {
    var wk = E.streak.weekKey(E.day(now)), n = slot(rec);
    if (n.week !== wk || !isArray(n.offer)) {
      var cand = candidates(rec, now, wk);
      var rng = PX.rng(PX.rng.hash('px-notes', wk, String(rec.created || '')));
      var pick = rng.shuffle(cand).slice(0, C().offer).sort(function (a, b) { return IDS.indexOf(a.id) - IDS.indexOf(b.id); });
      n.week = wk; n.offer = pick; n.kept = []; n.done = {};
    }
    if (!isArray(n.kept)) n.kept = [];
    if (!isObj(n.done)) n.done = {};
    return { week: n.week, offer: n.offer, kept: n.kept, done: n.done };
  }
  function keep(rec, now, i, on) {
    var st = state(rec, now), n = slot(rec);
    if (!isNum(i) || i < 0 || i >= st.offer.length) return false;
    var at = n.kept.indexOf(i);
    if (on === false || (on === undefined && at >= 0)) { if (at < 0 || hasOwn.call(n.done, String(i))) return false; n.kept.splice(at, 1); return true; }
    if (at >= 0 || n.kept.length >= C().keep) return false;
    n.kept.push(i);
    n.kept.sort();
    return true;
  }

  function dayOf(ms) { return isNum(ms) ? E.day(ms) : null; }
  function doneNow(rec, now, note, plan, res) {
    var wk = E.streak.weekKey(E.day(now)), gm = res && res.game;
    switch (note.id) {
      case 'first': return !!(gm && isArray(gm.firsts) && gm.firsts.some(function (f) { return f.ex === note.ex && !f.old; }));
      case 'best': return !!(res && isArray(res.bests) && res.bests.length);
      case 'review': { var d = defOf(note.ex); return !!d && E.path.due(rec, d, now).indexOf(note.s) < 0; }
      case 'variant': {
        var dv = defOf(note.ex);
        return !!(dv && plan && isArray(plan.log) && plan.log.some(function (x) {
          if (x.exId !== note.ex || (x.oc !== 0 && x.oc !== 1)) return false;
          try { var p = PX.ex.decodeParams(dv, x.code); return p && p.variant === note.v; } catch (e) { return false; }
        }));
      }
      case 'path': { var p = isObj(rec.path) ? rec.path[note.ex] : null; return isObj(p) && isObj(p.passed) && isObj(p.passed[note.s]); }
      case 'climb': { var cs = E.climb.state(rec, now); return isNum(cs.best) && cs.best > note.h; }
      case 'strategy': return (isArray(rec.strategies) ? rec.strategies : []).some(function (x) { return isObj(x) && dayOf(x.t) !== null && dayOf(x.t) >= wk && x.t <= now; });
      case 'check': {
        var chs = [];
        try { chs = E.assess.checks(rec); } catch (e) { chs = []; }
        return chs.some(function (c) { var t = Date.parse(c.date); return isNum(t) && E.day(t) >= wk && t <= now; });
      }
    }
    return false;
  }
  function check(rec, now, plan, res) {
    var st = state(rec, now), n = slot(rec), out = [];
    st.kept.forEach(function (i) {
      if (hasOwn.call(n.done, String(i))) return;
      var note = st.offer[i];
      if (!isObj(note)) return;
      var ok = false;
      try { ok = doneNow(rec, now, note, plan, res); } catch (e) { ok = false; }
      if (ok) { n.done[String(i)] = Math.round(now); out.push({ i: i, note: note }); }
    });
    return out;
  }

  E.notes = { IDS: IDS, state: state, keep: keep, check: check, candidates: candidates, _: { doneNow: doneNow } };
})(window.PX);
