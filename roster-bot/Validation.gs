/**
 * Validation.gs — flight-conflict + OT-missing checks (adapted from Roster v2.0)
 * =============================================================================
 * Adds the two operational sanity checks from the "ROSTER DAILY ASSIGNMENT →
 * GOOGLE SHEET v2.0" script, built on the SHARED reader records (no bespoke
 * per-team parsing — RosterReader already extracts each assignment's
 * STA/STD/OP/CL):
 *
 *   • Flight conflict — one person assigned to 2+ flights whose times overlap.
 *   • OT missing      — a flight's STD/CL runs past the person's shift end but
 *                       no OT is recorded.
 *
 * Output: an "🚨 Issues" tab in the monthly file + an optional alert posted to a
 * SECOND Google Chat room (Script Property CONFIG_RB.CHAT_ALERT_PROP). The main
 * dashboard / chat (Bot A) is unchanged; this is purely additive.
 *
 * Requires RosterReader.gs (rrClean_/rrMin_/rrRangeStr_/rrFmtMin_) + RosterBot.gs.
 */

// minutes-of-day from a single time cell ('HH:MM' / '0740' / Date) — reuse rrMin_
function valMin_(t) { return rrMin_(t); }
function valFmt_(m) { return m == null ? '?' : rrFmtMin_(m); }

/** Flatten the day's working records (PSA teams + LL sections) for validation. */
function valCollect_(res, ll) {
  var recs = [];
  Object.keys(res.teams).forEach(function (t) {
    res.teams[t].records.forEach(function (r) { if (r.bucket === 'working' || r.bucket === 'ot_off') recs.push(r); });
  });
  if (ll && ll.totals.staff > 0) {
    Object.keys(ll.sections).forEach(function (s) {
      ll.sections[s].records.forEach(function (r) { if (r.bucket === 'working' || r.bucket === 'ot_off') recs.push(r); });
    });
  }
  return recs;
}

/** One person on 2+ flights with overlapping open→close (or STA→STD) windows. */
function valFlightConflicts_(recs) {
  var issues = [];
  recs.forEach(function (rec) {
    if (!rec.assignments || rec.assignments.length < 2) return;
    var times = rec.assignments.map(function (a) {
      return { flight: a.flight, start: valMin_(a.OP || a.STA), end: valMin_(a.CL || a.STD) };
    }).filter(function (f) { return f.start != null && f.end != null; });
    times.sort(function (a, b) { return a.start - b.start; });
    for (var i = 0; i < times.length - 1; i++) {
      if (times[i].end > times[i + 1].start) {
        issues.push({
          type: 'CONFLICT', team: rec.team, name: rec.name,
          msg: '⚡ ' + rec.name + ' [' + rec.team + '] ไฟลท์ชนกัน: ' +
               times[i].flight + ' (ปิด ' + valFmt_(times[i].end) + ') กับ ' +
               times[i + 1].flight + ' (เปิด ' + valFmt_(times[i + 1].start) + ')',
        });
      }
    }
  });
  return issues;
}

/** A flight ends after the shift end but the person has no OT recorded. */
function valOtMissing_(recs) {
  var issues = [];
  recs.forEach(function (rec) {
    if (!rec.assignments || !rec.assignments.length) return;
    if (rec.ot > 0 || rec.bucket === 'ot_off') return;        // OT present → fine
    var srng = rrRangeStr_(rec.shiftTime || rec.shift);
    if (srng[1] == null) return;
    var shiftEnd = srng[1];
    for (var i = 0; i < rec.assignments.length; i++) {
      var a = rec.assignments[i];
      var endWork = Math.max(valMin_(a.STD) || 0, valMin_(a.CL) || 0);
      if (endWork > 0 && endWork > shiftEnd) {
        issues.push({
          type: 'OT_MISSING', team: rec.team, name: rec.name,
          msg: '⚠️ ' + rec.name + ' [' + rec.team + '] ไฟลท์ ' + a.flight +
               ' (STD/CL ' + (a.STD || a.CL) + ') เกินกะ ' + valFmt_(shiftEnd) + ' แต่ไม่มี OT',
        });
        break;                                                // one issue per person
      }
    }
  });
  return issues;
}

/** Compute both checks for a day. */
function valRun_(res, ll) {
  var recs = valCollect_(res, ll);
  return { conflicts: valFlightConflicts_(recs), otIssues: valOtMissing_(recs) };
}

/** Sheet tab: 🚨 Issues — flight conflicts + OT-missing rows. */
function rbWriteIssues_(ss, res, ll, dateStr, tabName) {
  tabName = tabName || '🚨 Issues';
  var old = ss.getSheetByName(tabName);
  if (old) ss.deleteSheet(old);
  var sh = ss.insertSheet(tabName);
  var v = valRun_(res, ll);
  var all = v.conflicts.concat(v.otIssues);

  sh.getRange(1, 1, 1, 4).merge()
    .setValue('🚨 ตรวจความถูกต้องตาราง — ' + dateStr + '  •  ไฟลท์ชน ' + v.conflicts.length +
              ' · OT ขาด ' + v.otIssues.length)
    .setBackground('#b71c1c').setFontColor('#fff').setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center');
  sh.setRowHeight(1, 28);
  sh.getRange(2, 1, 1, 4).setValues([['ประเภท', 'ทีม', 'ชื่อ', 'รายละเอียด']])
    .setBackground('#d32f2f').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');

  if (!all.length) {
    sh.getRange(3, 1, 1, 4).merge().setValue('✅ ไม่พบไฟลท์ชนกัน และไม่พบ OT ที่ขาด')
      .setBackground('#e8f5e9').setFontWeight('bold').setFontColor('#1b5e20').setHorizontalAlignment('center');
  } else {
    var rows = all.map(function (i) {
      return [i.type === 'CONFLICT' ? '⚡ ไฟลท์ชน' : '⚠️ OT ขาด', i.team, i.name, i.msg];
    });
    sh.getRange(3, 1, rows.length, 4).setValues(rows).setFontSize(9);
    for (var i = 0; i < all.length; i++) {
      sh.getRange(3 + i, 1, 1, 4).setBackground(all[i].type === 'CONFLICT' ? '#ffebee' : '#fff8e1');
    }
  }
  [100, 110, 160, 560].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setFrozenRows(2);
  return v;
}

/** Build the alert Chat message (null if nothing to report). */
function rbBuildAlert_(v, dateStr) {
  var all = v.conflicts.slice(0, 15).concat(v.otIssues.slice(0, 15));
  if (!all.length) return null;
  var lines = all.map(function (i) { return '• ' + i.msg; });
  return { text: '🚨 *Roster Alert* — ' + dateStr + '\n(ไฟลท์ชน ' + v.conflicts.length +
                 ' · OT ขาด ' + v.otIssues.length + ')\n\n' + lines.join('\n') };
}

/** Post conflicts/OT issues to the ALERT webhook (separate room). */
function rbPostAlerts_(res, ll, dateStr) {
  var webhook = rbResolveWebhook_(CONFIG_RB.CHAT_ALERT_PROP);
  if (!webhook) { Logger.log('ℹ️ alert webhook (%s) ยังไม่ตั้ง → ข้าม', CONFIG_RB.CHAT_ALERT_PROP); return; }
  var msg = rbBuildAlert_(valRun_(res, ll), dateStr);
  if (!msg) { Logger.log('✅ ไม่มี issue → ไม่ส่ง alert'); return; }
  UrlFetchApp.fetch(webhook, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(msg), muteHttpExceptions: true,
  });
  Logger.log('🚨 ส่ง alert แล้ว');
}
