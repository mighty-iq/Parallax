/* PX.engine.streak: weekly goal and weekly streak (PLAN §7; D §2 and §b).
   No daily chain and no loss framing. Weeks run Monday to Sunday (local days). A session
   counts when it has at least 10 answers or 5 minutes of practice.
   - Goal: 2–6 sessions a week (default 3), from settings.weeklyGoal; changes are kept in
     rec.streak.goals as [weekKey, goal] so past weeks keep the goal they had.
   - Grace: one missed week in any four is forgiven automatically (the run continues).
   - Repair: a missed week that grace cannot cover is repaired for free by practising: goal + 1
     sessions in the following week carry the run on. While that week is open, the repair is
     offered as information, never as a warning.
   Everything is derived from rec.sessions, so it cannot drift from the log.

     status(rec, now) → { goal, week, current, best, weeks, repair, hidden, text }
     setGoal(rec, goal, now)       clamps to 2–6, writes settings.weeklyGoal and the history
     weekKey(dayKey) / days(rec)   Monday of a day's week; { dayKey: sessions } calendar */
(function (PX) {
  'use strict';

  // Local references (globals are slow to look up inside Node's vm contexts used by the tests).
  var isArray = Array.isArray, isFin = isFinite, hasOwn = Object.prototype.hasOwnProperty;

  var U = PX.util;
  var E = PX.engine;
  var C = E.config;

  function isNum(x) { return typeof x === 'number' && isFin(x); }
  function isObj(x) { return !!x && typeof x === 'object' && !isArray(x); }

  function weekKey(day) {
    var n = U.dayNum(day);
    return U.addDays(day, -((n + 3) % 7)); // 1970-01-01 was a Thursday
  }

  function counts(s) {
    return isObj(s) && isNum(s.start) && ((s.trials || 0) >= C.streak.minTrials || (s.practiceMs || 0) >= C.streak.minMs);
  }

  function clampGoal(g) {
    var S = C.streak;
    return isNum(g) ? U.clamp(Math.round(g), S.min, S.max) : S.goal;
  }

  function goalNow(rec) { return clampGoal(rec.settings && rec.settings.weeklyGoal); }

  function goalHistory(rec) {
    var st = isObj(rec.streak) ? rec.streak : {}, list = isArray(st.goals) ? st.goals : [];
    return list.filter(function (x) { return isArray(x) && typeof x[0] === 'string' && isNum(x[1]); })
      .sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  }

  function goalFor(hist, wk, fallback) {
    var g = null;
    for (var i = 0; i < hist.length; i++) { if (hist[i][0] <= wk) g = hist[i][1]; else break; }
    if (g === null) g = hist.length ? hist[0][1] : fallback;
    return clampGoal(g);
  }

  function setGoal(rec, goal, now) {
    var g = clampGoal(goal);
    if (!isObj(rec.settings)) rec.settings = {};
    if (!isObj(rec.streak)) rec.streak = {};
    var hist = goalHistory(rec), wk = weekKey(E.day(now));
    // The first change also records the goal the earlier weeks had.
    if (!hist.length) hist.push(['0000-00-00', goalNow(rec)]);
    hist = hist.filter(function (x) { return x[0] !== wk; });
    hist.push([wk, g]);
    rec.streak.goals = hist.slice(-200);
    rec.settings.weeklyGoal = g;
    return g;
  }

  function days(rec) {
    var out = {};
    (isArray(rec.sessions) ? rec.sessions : []).forEach(function (s) {
      if (!counts(s)) return;
      var d = E.day(s.start);
      out[d] = (out[d] || 0) + 1;
    });
    return out;
  }

  function status(rec, now) {
    var S = C.streak, perDay = days(rec), hist = goalHistory(rec), goal = goalNow(rec);
    var today = E.day(now), cur = weekKey(today);
    var perWeek = {}, first = null;
    Object.keys(perDay).forEach(function (d) {
      if (d > today) return;
      var w = weekKey(d);
      perWeek[w] = (perWeek[w] || 0) + perDay[d];
      if (first === null || w < first) first = w;
    });
    var dots = [];
    for (var i = 0; i < 7; i++) dots.push(!!perDay[U.addDays(cur, i)]);
    var thisN = perWeek[cur] || 0;
    var week = { key: cur, sessions: thisN, goal: goal, met: thisN >= goal, left: Math.max(0, goal - thisN), days: dots };
    var out = { goal: goal, week: week, current: 0, best: 0, weeks: [], repair: null, hidden: isObj(rec.streak) && rec.streak.hidden === true, text: '' };
    if (first === null) { out.text = '0 of ' + goal + ' sessions this week.'; return out; }
    var run = 0, best = 0, lastGrace = -Infinity, idx = 0;
    for (var w = first; w <= cur; w = U.addDays(w, 7), idx++) {
      var n = perWeek[w] || 0, g = w === cur ? goal : goalFor(hist, w, goal);
      var row = { key: w, sessions: n, goal: g, met: n >= g, graced: false, repaired: false, open: w === cur };
      if (w === cur) { out.weeks.push(row); break; }
      if (row.met) run += 1;
      else if (idx - lastGrace >= S.graceWeeks) { row.graced = true; lastGrace = idx; }
      else {
        var nw = U.addDays(w, 7), nn = perWeek[nw] || 0, ng = nw === cur ? goal : goalFor(hist, nw, goal);
        if (nn >= ng + 1) row.repaired = true;
        else if (nw === cur && run > 0) {
          row.repairOpen = true;
          out.repair = { week: w, need: ng + 1, have: nn, left: ng + 1 - nn, run: run };
        } else run = 0;
      }
      best = Math.max(best, run);
      out.weeks.push(row);
    }
    out.current = run + (week.met ? 1 : 0);
    out.best = Math.max(best, out.current);
    out.text = thisN + ' of ' + goal + ' sessions this week' + (week.met ? ': goal met.' : '.') +
      (out.repair ? ' ' + out.repair.left + ' more this week carry your run of ' + out.repair.run + ' weeks on.' : '');
    return out;
  }

  E.streak = { status: status, setGoal: setGoal, weekKey: weekKey, days: days, counts: counts, goalNow: goalNow };
})(window.PX);
