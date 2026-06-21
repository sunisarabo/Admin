/**
 * LegacyReport.gs — "Bot B": detailed Google Chat tables + A4 PDF report
 * =============================================================================
 * The second report pipeline. Where RosterBot.gs (Bot A) writes the visual
 * dashboard / timetable / SLA tabs and a short Chat summary, this one produces
 * the legacy v3.1 deliverables HR relies on:
 *   • a detailed monospaced Google Chat message (per-position W/OT-Off/Vac/
 *     Sick/Off tables for PSA & LL, OT summary, per-team OT, active headcount)
 *   • an A4 PDF report uploaded to Drive, with a shareable link in the message
 *
 * It SHARES the reader layer with Bot A — it does NOT re-parse sheets:
 *   rbOpenTodayRoster_  (RosterBot.gs)     → today's PSA assignment file
 *   readRosterFromSpreadsheet (RosterReader)→ per-person records
 *   reconcilePSA_ (+ overrides, Reconcile)  → MASTER-based OFF counting
 *   readLLForDate (LLReader) + reconAdaptLL_→ LL old-shape aggregates
 *   readMaster_ (MasterReader)              → establishment headcount + roster
 *
 * Entry points:
 *   runLegacyToday()           — today, for the time trigger
 *   runLegacyReport(y, m, d)   — a specific date
 *   setupLegacyTriggers()      — daily 08:05 / 14:05 (5 min after Bot A)
 *
 * The Chat webhook is read from the same Script Property as Bot A
 * (CONFIG_RB.CHAT_WEBHOOK_PROP) — no secret in source.
 */

// position-group display labels + ordering (legacy)
var POSITION_GROUPS = {
  PSS:      { label: 'PSS' },      SNR:      { label: 'SNR' },
  PSA:      { label: 'PSA' },      Globlex:  { label: 'Globlex' },
  AdminD:   { label: 'Admin Doc' }, Porter:  { label: 'Porter' },
  Crewsign: { label: 'Crewsign' },
};
var LL_POSITION_GROUPS = {
  PSS:    { label: 'PSS' },    SNR:   { label: 'SNR' },
  PSA:    { label: 'PSA' },    Porter:{ label: 'PORTER' }, Admin: { label: 'ADMIN' },
};
var POSITION_GROUPS_ORDER_    = ['PSS', 'SNR', 'PSA', 'Globlex', 'AdminD', 'Porter', 'Crewsign'];
var LL_POSITION_GROUPS_ORDER_ = ['PSS', 'SNR', 'PSA', 'Porter', 'Admin'];

var DAY_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
var MONTH_FULL_TH = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

function formatThaiDate_(d) {
  return d.getDate() + ' ' + MONTH_FULL_TH[d.getMonth() + 1] + ' ' + d.getFullYear() +
    ' (วัน' + DAY_TH[d.getDay()] + ')';
}

// ─── ENTRY POINTS ───────────────────────────────────────────────────────────
function runLegacyToday()        { legacyRunForDate_(new Date()); }
function runLegacyReport(y, m, d) {
  legacyRunForDate_((y && m && d) ? new Date(y, m - 1, d) : new Date());
}

function setupLegacyTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runLegacyToday') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runLegacyToday').timeBased().atHour(8).nearMinute(5).everyDays(1).create();
  ScriptApp.newTrigger('runLegacyToday').timeBased().atHour(14).nearMinute(5).everyDays(1).create();
  Logger.log('✅ ตั้ง trigger รายงานละเอียด (Bot B) ทุกวัน 08:05 และ 14:05 แล้ว');
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
function legacyRunForDate_(date) {
  var now = new Date();
  var slotLabel = (now.getHours() < 12) ? 'เช้า' : 'บ่าย';
  var timeStr = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Bangkok', 'HH:mm');

  // MASTER (required for OFF counting) — fail loudly only if missing
  var master;
  try { master = readMaster_(MASTER_FILE_ID_RB); }
  catch (e) { Logger.log('❌ Legacy: master เข้าไม่ได้ (' + e.message + ') — ยกเลิก (Bot B ต้องใช้ master)'); return; }

  // PSA — shared reader → master reconciliation → overrides
  var psa;
  try {
    var roster = rbOpenTodayRoster_(date);
    var res = readRosterFromSpreadsheet(roster.ss);
    psa = reconcilePSA_(res, master);
    try { reconCrewsignOverride_(psa, res, master); } catch (e1) { Logger.log('⚠️ Crewsign override: ' + e1.message); }
    try { reconManpowerOverride_(psa, roster.ss, master); } catch (e2) { Logger.log('⚠️ MANPOWER override: ' + e2.message); }
    reconRecomputeTotals_(psa);
    psa.fileName = roster.fileName || '';
    if (roster.tempId) { try { DriveApp.getFileById(roster.tempId).setTrashed(true); } catch (e3) {} }
  } catch (e) {
    Logger.log('⚠️ PSA: ' + e.message);
    psa = { byPos: {}, byTeam: {}, totals: reconNewBucket_(), sickByTeamPos: [], fileName: '(error: ' + e.message + ')' };
  }

  // LL — shared reader → old-shape adapter
  var ll;
  try {
    var llRes = readLLForDate(CONFIG_RB.LL_FILE_ID, date);
    ll = reconAdaptLL_(llRes);
    ll.tabName = llRes.tabName || '';
  } catch (e) {
    Logger.log('⚠️ LL: ' + e.message);
    ll = { byPos: {}, totals: reconNewBucket_(), sickByPos: [], tabName: '(error: ' + e.message + ')' };
  }

  // PDF (non-fatal)
  var pdfUrl = null;
  try { pdfUrl = generatePDFReport_(master, psa, ll, date, slotLabel, timeStr); Logger.log('📄 PDF: ' + pdfUrl); }
  catch (e) { Logger.log('⚠️ PDF FAILED: ' + e.message + '\n' + (e.stack || '')); }

  // Chat
  var dateThai = formatThaiDate_(date);
  var webhook = PropertiesService.getScriptProperties().getProperty(CONFIG_RB.CHAT_WEBHOOK_PROP);
  if (!webhook) { Logger.log('⚠️ Legacy: ไม่มี webhook ใน Script Property %s', CONFIG_RB.CHAT_WEBHOOK_PROP); return; }
  var msg = formatChatMessage_(master, psa, ll, dateThai, slotLabel, timeStr, pdfUrl);
  postToChat_(webhook, msg);
  Logger.log('✅ Legacy report sent');
}

// ─── CHAT MESSAGE FORMATTER ──────────────────────────────────────────────────
function formatChatMessage_(master, psa, ll, dateThai, slotLabel, timeStr, pdfUrl) {
  var L = [];
  L.push('*📋 PSA + LL Roster — ' + dateThai + '*');
  L.push('_รอบ' + slotLabel + ' • ' + timeStr + '_');
  if (psa.fileName) L.push('  PSA file: `' + psa.fileName + '`');
  if (ll.tabName)   L.push('  LL tab: `' + ll.tabName + '`');
  L.push('');

  L.push('━━━━━━━━━━━━━━━━━━━━━━');
  L.push('*🔵 PSA — Roster: ' + psa.totals.total + ' คน*');
  L.push('Pos         W   OT-Off  Vac  Sick  Off');
  POSITION_GROUPS_ORDER_.forEach(function (key) {
    var b = psa.byPos[key];
    if (!b || b.total === 0) return;
    L.push('• ' + padRight_(POSITION_GROUPS[key].label, 12) +
           padLeft_(b.Working, 4) + padLeft_(b.OT_OFF, 6) +
           padLeft_(b.Vac, 5) + padLeft_(b.Sick, 6) + padLeft_(b.Off, 5));
  });
  L.push('TOTAL       ' + padLeft_(psa.totals.Working, 4) +
         padLeft_(psa.totals.OT_OFF, 6) + padLeft_(psa.totals.Vac, 5) +
         padLeft_(psa.totals.Sick, 6)   + padLeft_(psa.totals.Off, 5));
  L.push('⏱️ OT_B: *' + psa.totals.OT_PRE + '* (' + fmt1_(psa.totals.OT_PRE_HRS) + 'h)' +
         '  |  OT_A: *' + psa.totals.OT_POST + '* (' + fmt1_(psa.totals.OT_POST_HRS) + 'h)');
  if (psa.sickByTeamPos.length > 0) {
    L.push('🤒 ลาป่วย PSA: ' + groupSick_(psa.sickByTeamPos).join(' | '));
  }

  L.push('');
  L.push('━━━━━━━━━━━━━━━━━━━━━━');
  L.push('*🟡 LL — Roster: ' + ll.totals.total + ' คน*');
  L.push('Pos         W   OT-Off  Vac  Sick  Off');
  LL_POSITION_GROUPS_ORDER_.forEach(function (key) {
    var b = ll.byPos[key];
    if (!b || b.total === 0) return;
    L.push('• ' + padRight_(LL_POSITION_GROUPS[key].label, 12) +
           padLeft_(b.Working, 4) + padLeft_(b.OT_OFF, 6) +
           padLeft_(b.Vac, 5) + padLeft_(b.Sick, 6) + padLeft_(b.Off, 5));
  });
  L.push('TOTAL       ' + padLeft_(ll.totals.Working, 4) +
         padLeft_(ll.totals.OT_OFF, 6) + padLeft_(ll.totals.Vac, 5) +
         padLeft_(ll.totals.Sick, 6)   + padLeft_(ll.totals.Off, 5));
  L.push('⏱️ OT_B: *' + ll.totals.OT_PRE + '* (' + fmt1_(ll.totals.OT_PRE_HRS) + 'h)' +
         '  |  OT_A: *' + ll.totals.OT_POST + '* (' + fmt1_(ll.totals.OT_POST_HRS) + 'h)');
  if (ll.sickByPos.length > 0) {
    var sickByPosGrouped = {};
    ll.sickByPos.forEach(function (s) { sickByPosGrouped[s.pos] = (sickByPosGrouped[s.pos] || 0) + 1; });
    var sickLines = [];
    Object.keys(sickByPosGrouped).forEach(function (p) {
      sickLines.push((LL_POSITION_GROUPS[p] ? LL_POSITION_GROUPS[p].label : p) + ': ' + sickByPosGrouped[p] + ' คน');
    });
    L.push('🤒 ลาป่วย LL: ' + sickLines.join(' | '));
  }

  L.push('');
  L.push('━━━━━━━━━━━━━━━━━━━━━━');
  L.push('*📊 OT Summary*');
  L.push('🔵 PSA: OFF *' + psa.totals.OT_OFF + '* | PRE *' + psa.totals.OT_PRE +
         '* (' + fmt1_(psa.totals.OT_PRE_HRS) + 'h) | POST *' + psa.totals.OT_POST +
         '* (' + fmt1_(psa.totals.OT_POST_HRS) + 'h)');
  L.push('🟡 LL: OFF *' + ll.totals.OT_OFF + '* | PRE *' + ll.totals.OT_PRE +
         '* (' + fmt1_(ll.totals.OT_PRE_HRS) + 'h) | POST *' + ll.totals.OT_POST +
         '* (' + fmt1_(ll.totals.OT_POST_HRS) + 'h)');

  if (psa.byTeam && Object.keys(psa.byTeam).length > 0) {
    L.push('');
    L.push('━━━━━━━━━━━━━━━━━━━━━━');
    L.push('*🔵 PSA แยกทีม + OT*');
    L.push('Team             W  Off  Sick  OT_B  OT_A');
    var seenTeams = {};
    var renderTeamOT = function (t, b) {
      var otB = b.OT_PRE > 0 ? (b.OT_PRE + '(' + fmt1_(b.OT_PRE_HRS) + 'h)') : '-';
      var otA = b.OT_POST > 0 ? (b.OT_POST + '(' + fmt1_(b.OT_POST_HRS) + 'h)') : '-';
      L.push('• ' + padRight_(t, 16) +
             padLeft_(b.Working, 3) + padLeft_(b.Off + b.Vac, 5) +
             padLeft_(b.Sick, 5) + padLeft_(otB, 8) + padLeft_(otA, 8));
    };
    LEGACY_TEAM_ORDER_.forEach(function (t) {
      var b = psa.byTeam[t];
      if (b && b.total > 0) { seenTeams[t] = true; renderTeamOT(t, b); }
    });
    Object.keys(psa.byTeam).sort().forEach(function (t) {
      if (seenTeams[t]) return;
      var b = psa.byTeam[t];
      if (b && b.total > 0) renderTeamOT(t, b);
    });
  }

  L.push('');
  L.push('━━━━━━━━━━━━━━━━━━━━━━');
  L.push('*👥 Headcount (Active ทั้งหมด)*');
  L.push('PSA: *' + master.headcount.PSA.total + '* | LL: *' + master.headcount.LL.total +
         '* | รวม: *' + (master.headcount.PSA.total + master.headcount.LL.total) + '* คน');
  var psaBreakdown = formatHeadcountBreakdown_(master.headcount.PSA.byPos);
  var llBreakdown  = formatHeadcountBreakdown_(master.headcount.LL.byPos);
  if (psaBreakdown) L.push('PSA: ' + psaBreakdown);
  if (llBreakdown)  L.push('LL:  ' + llBreakdown);

  if (pdfUrl) {
    L.push('');
    L.push('━━━━━━━━━━━━━━━━━━━━━━');
    L.push('📎 *PDF Report:* <' + pdfUrl + '|เปิดดู PDF>');
    L.push('   ' + pdfUrl);
  } else {
    L.push('');
    L.push('_⚠️ PDF ไม่ได้สร้าง — ดู Executions log_');
  }

  return { text: L.join('\n') };
}

// Preferred team ordering for the per-team block (actual master team names).
var LEGACY_TEAM_ORDER_ = ['EK/UO/6B/BY/FY', 'SQ/CX/LY', 'EY/DV/AY', 'TR/6E/QP', 'WY/DK/G9/9C',
  'JQ/IT/IX/AI/N0', 'TK/VJ/SG/HY/OD', 'KC/LJ/KE/OZ/NO/AF', 'QR/MH/OM/DE',
  'AK/QZ/8M', 'SU/B2/W5', 'CHINA TEAM', 'PG', 'SV/KA/WK', 'PVT', 'Charter',
  'PORTER', 'ADMIN PORTER', 'ADMIN DOC', 'Porter Crewsign'];

function formatHeadcountBreakdown_(byPos) {
  var order = ['DIR', 'MGR', 'Assist', 'PSS', 'SNR', 'PSA', 'Globlex', 'AdminD', 'AdminP', 'Admin',
               'Porter', 'Crewsign', 'OFFICE', 'LL_ADMIN'];
  var displayNames = { AdminD: 'AdminDoc', AdminP: 'AdminPort', OFFICE: 'OFFICE', LL_ADMIN: 'AdminLL' };
  var parts = [];
  order.forEach(function (p) {
    if (byPos[p] && byPos[p] > 0) parts.push((displayNames[p] || p) + ':' + byPos[p]);
  });
  Object.keys(byPos).sort().forEach(function (p) {
    if (order.indexOf(p) < 0 && byPos[p] > 0) parts.push(p + ':' + byPos[p]);
  });
  return parts.join(' | ');
}

function groupSick_(arr) {
  var byTeam = {};
  arr.forEach(function (s) {
    if (!byTeam[s.team]) byTeam[s.team] = {};
    byTeam[s.team][s.pos] = (byTeam[s.team][s.pos] || 0) + 1;
  });
  var lines = [];
  Object.keys(byTeam).forEach(function (t) {
    var posLines = [];
    Object.keys(byTeam[t]).forEach(function (p) {
      posLines.push((POSITION_GROUPS[p] ? POSITION_GROUPS[p].label : p) + ' ' + byTeam[t][p]);
    });
    lines.push(t + '→' + posLines.join(','));
  });
  return lines;
}

function fmt1_(n) { return (Math.round((n || 0) * 10) / 10).toFixed(1); }
function padLeft_(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
function padRight_(s, w) { s = String(s); while (s.length < w) s = s + ' '; return s; }

// ─── HTTP POST ────────────────────────────────────────────────────────────
function postToChat_(webhookUrl, payload) {
  var res = UrlFetchApp.fetch(webhookUrl, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('Chat error ' + res.getResponseCode() + ': ' + res.getContentText());
  }
}

// ─── PDF GENERATOR ────────────────────────────────────────────────────────────
function generatePDFReport_(master, psa, ll, date, slotLabel, timeStr) {
  // Build in a throwaway spreadsheet (standalone-safe — never touches MASTER).
  var temp = SpreadsheetApp.create('_PDF_TMP_' + Utilities.formatDate(date, 'Asia/Bangkok', 'yyyyMMdd') + '_' + Date.now());
  var sh = temp.getSheets()[0];
  try {
    writePDFLayout_(sh, master, psa, ll, date, slotLabel, timeStr);
    SpreadsheetApp.flush();
    var pdfBlob = exportSheetAsPDF_(temp, sh);
    var fileName = 'Roster_' + Utilities.formatDate(date, 'Asia/Bangkok', 'ddMMMyy') +
                   '_' + slotLabel + '_' + Utilities.formatDate(date, 'Asia/Bangkok', 'HHmm') + '.pdf';
    pdfBlob.setName(fileName);
    var folder = legacyPdfFolder_();
    var file = folder.createFile(pdfBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } finally {
    try { DriveApp.getFileById(temp.getId()).setTrashed(true); } catch (e) {}
  }
}

function legacyPdfFolder_() {
  if (CONFIG_RB.OUTPUT_FOLDER_ID) {
    try { return DriveApp.getFolderById(CONFIG_RB.OUTPUT_FOLDER_ID); } catch (e) {}
  }
  var name = 'SmartShift PDF Reports';
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function exportSheetAsPDF_(ss, sh) {
  var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export'
          + '?format=pdf&size=A4&portrait=true&fitw=true'
          + '&gridlines=false&printtitle=false&sheetnames=false&pagenumbers=false'
          + '&fzr=false&gid=' + sh.getSheetId();
  return UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  }).getBlob();
}

function writePDFLayout_(sh, master, psa, ll, date, slotLabel, timeStr) {
  // Col 8 is the gap between the PSA (1-7) and LL (9-15) halves at the top, but
  // the per-team table below spans cols 1-9 — so cols 7 & 8 carry OT_B/OT_A and
  // must be wide enough not to truncate "N (XX.Xh)".
  [110, 60, 60, 65, 50, 50, 72, 72, 110, 60, 60, 65, 50, 50, 60].forEach(function (w, i) {
    sh.setColumnWidth(i + 1, w);
  });

  var dateThai = formatThaiDate_(date);
  var R = 1;

  sh.setRowHeight(R, 36);
  sh.getRange(R, 1, 1, 15).merge()
    .setValue('📊 PSA + LL Manpower — Daily Roster Report')
    .setBackground('#0d2137').setFontColor('#fff').setFontWeight('bold')
    .setFontSize(14).setHorizontalAlignment('center').setVerticalAlignment('middle');
  R++;

  sh.setRowHeight(R, 22);
  sh.getRange(R, 1, 1, 15).merge()
    .setValue('📅 ' + dateThai + ' · รอบ' + slotLabel + ' · ' + timeStr)
    .setBackground('#1a3c5a').setFontColor('#cdf').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  R += 2;

  sh.setRowHeight(R, 24);
  sh.getRange(R, 1, 1, 7).merge()
    .setValue('🔵 PSA — Roster: ' + psa.totals.total + ' คน')
    .setBackground('#1f4e79').setFontColor('#fff').setFontWeight('bold')
    .setFontSize(11).setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false);
  sh.getRange(R, 9, 1, 7).merge()
    .setValue('🟡 LL — Roster: ' + ll.totals.total + ' คน')
    .setBackground('#7f6000').setFontColor('#fff').setFontWeight('bold')
    .setFontSize(11).setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false);
  R++;

  sh.setRowHeight(R, 16);
  sh.getRange(R, 1, 1, 7).merge()
    .setValue('นับจาก Roster + MASTER establishment (คนไม่อยู่ในไฟล์ = Off)')
    .setFontColor('#666').setFontSize(8).setFontStyle('italic').setHorizontalAlignment('left');
  sh.getRange(R, 9, 1, 7).merge()
    .setValue('นับจาก LL daily tab — Working + OT วันหยุด + Sick + Off')
    .setFontColor('#666').setFontSize(8).setFontStyle('italic').setHorizontalAlignment('left');
  R++;

  sh.setRowHeight(R, 20);
  ['Position', 'Working', 'OT วันหยุด', 'OT (ชม.)', 'Sick', 'Off', 'Total'].forEach(function (h, i) {
    sh.getRange(R, 1 + i).setValue(h).setBackground('#2e75b6').setFontColor('#fff').setFontWeight('bold')
      .setFontSize(9).setHorizontalAlignment(i === 0 ? 'left' : 'center').setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false);
  });
  ['Team', 'Working', 'OT วันหยุด', 'OT (ชม.)', 'Sick', 'Off', 'Total'].forEach(function (h, i) {
    sh.getRange(R, 9 + i).setValue(h).setBackground('#bf8f00').setFontColor('#fff').setFontWeight('bold')
      .setFontSize(9).setHorizontalAlignment(i === 0 ? 'left' : 'center').setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false);
  });
  R++;

  var psaR = R, llR = R;
  var psaBg = ['#dceef9', '#ebf5fc'], llBg = ['#fff9e6', '#fef3cd'];
  var psaIdx = 0, llIdx = 0;

  POSITION_GROUPS_ORDER_.forEach(function (key) {
    var b = psa.byPos[key];
    if (!b || b.total === 0) return;
    sh.setRowHeight(psaR, 18);
    var bg = psaBg[psaIdx++ % 2];
    var totalOTHrs = b.OT_PRE_HRS + b.OT_POST_HRS;
    [POSITION_GROUPS[key].label, b.Working, b.OT_OFF, fmt1_(totalOTHrs) + 'h',
     b.Sick, b.Off + b.Vac, b.total].forEach(function (v, i) {
      sh.getRange(psaR, 1 + i).setValue(v).setBackground(bg).setFontSize(9)
        .setHorizontalAlignment(i === 0 ? 'left' : 'center').setVerticalAlignment('middle')
        .setBorder(false, true, true, true, false, false)
        .setFontWeight(i === 0 || i === 6 ? 'bold' : 'normal');
    });
    psaR++;
  });

  LL_POSITION_GROUPS_ORDER_.forEach(function (key) {
    var b = ll.byPos[key];
    if (!b || b.total === 0) return;
    sh.setRowHeight(llR, 18);
    var bg = llBg[llIdx++ % 2];
    var totalOTHrs = b.OT_PRE_HRS + b.OT_POST_HRS;
    [LL_POSITION_GROUPS[key].label, b.Working, b.OT_OFF, fmt1_(totalOTHrs) + 'h',
     b.Sick, b.Off + b.Vac, b.total].forEach(function (v, i) {
      sh.getRange(llR, 9 + i).setValue(v).setBackground(bg).setFontSize(9)
        .setHorizontalAlignment(i === 0 ? 'left' : 'center').setVerticalAlignment('middle')
        .setBorder(false, true, true, true, false, false)
        .setFontWeight(i === 0 || i === 6 ? 'bold' : 'normal');
    });
    llR++;
  });

  sh.setRowHeight(psaR, 22);
  ['GRAND TOTAL', psa.totals.Working, psa.totals.OT_OFF,
   fmt1_(psa.totals.OT_PRE_HRS + psa.totals.OT_POST_HRS) + 'h',
   psa.totals.Sick, psa.totals.Off + psa.totals.Vac, psa.totals.total].forEach(function (v, i) {
    sh.getRange(psaR, 1 + i).setValue(v).setBackground('#1f4e79').setFontColor('#fff')
      .setFontWeight('bold').setFontSize(10).setHorizontalAlignment(i === 0 ? 'left' : 'center').setVerticalAlignment('middle');
  });
  psaR++;

  sh.setRowHeight(llR, 22);
  ['GRAND TOTAL', ll.totals.Working, ll.totals.OT_OFF,
   fmt1_(ll.totals.OT_PRE_HRS + ll.totals.OT_POST_HRS) + 'h',
   ll.totals.Sick, ll.totals.Off + ll.totals.Vac, ll.totals.total].forEach(function (v, i) {
    sh.getRange(llR, 9 + i).setValue(v).setBackground('#7f6000').setFontColor('#fff')
      .setFontWeight('bold').setFontSize(10).setHorizontalAlignment(i === 0 ? 'left' : 'center').setVerticalAlignment('middle');
  });
  llR++;

  sh.getRange(psaR, 1, 1, 7).merge()
    .setValue('⏱️ PRE: ' + psa.totals.OT_PRE + ' (' + fmt1_(psa.totals.OT_PRE_HRS) + 'h) | POST: ' + psa.totals.OT_POST + ' (' + fmt1_(psa.totals.OT_POST_HRS) + 'h)')
    .setBackground('#f0f4fa').setFontSize(8).setFontStyle('italic').setHorizontalAlignment('left');
  psaR++;

  sh.getRange(llR, 9, 1, 7).merge()
    .setValue('⏱️ PRE: ' + ll.totals.OT_PRE + ' (' + fmt1_(ll.totals.OT_PRE_HRS) + 'h) | POST: ' + ll.totals.OT_POST + ' (' + fmt1_(ll.totals.OT_POST_HRS) + 'h)')
    .setBackground('#fffbeb').setFontSize(8).setFontStyle('italic').setHorizontalAlignment('left');
  llR++;

  if (psa.sickByTeamPos.length > 0) {
    sh.getRange(psaR, 1, 1, 7).merge()
      .setValue('🤒 ลาป่วย PSA: ' + groupSick_(psa.sickByTeamPos).join(' | '))
      .setBackground('#fff3f3').setFontSize(8)
      .setBorder(true, true, true, true, false, false, '#e57373', SpreadsheetApp.BorderStyle.SOLID)
      .setHorizontalAlignment('left');
  } else {
    sh.getRange(psaR, 1, 1, 7).merge().setValue('🤒 ไม่มีลาป่วย')
      .setBackground('#f0f4fa').setFontSize(8).setFontStyle('italic').setHorizontalAlignment('left');
  }
  psaR++;

  if (ll.sickByPos.length > 0) {
    var llSickByPos = {};
    ll.sickByPos.forEach(function (s) { llSickByPos[s.pos] = (llSickByPos[s.pos] || 0) + 1; });
    var sickStr = Object.keys(llSickByPos).map(function (p) {
      return (LL_POSITION_GROUPS[p] ? LL_POSITION_GROUPS[p].label : p) + ': ' + llSickByPos[p] + ' คน';
    }).join(' | ');
    sh.getRange(llR, 9, 1, 7).merge().setValue('🤒 ลาป่วย LL: ' + sickStr)
      .setBackground('#fff3f3').setFontSize(8).setHorizontalAlignment('left');
  } else {
    sh.getRange(llR, 9, 1, 7).merge().setValue('🤒 ไม่มีลาป่วย')
      .setBackground('#fffbeb').setFontSize(8).setFontStyle('italic').setHorizontalAlignment('left');
  }
  llR++;

  R = Math.max(psaR, llR) + 2;

  sh.setRowHeight(R, 28);
  sh.getRange(R, 1, 1, 15).merge()
    .setValue('📊 OT Summary  |  🔵 PSA: OFF ' + psa.totals.OT_OFF +
              ' | OT_B ' + psa.totals.OT_PRE + ' (' + fmt1_(psa.totals.OT_PRE_HRS) + 'h) | OT_A ' + psa.totals.OT_POST + ' (' + fmt1_(psa.totals.OT_POST_HRS) + 'h)' +
              '  •  🟡 LL: OFF ' + ll.totals.OT_OFF +
              ' | OT_B ' + ll.totals.OT_PRE + ' (' + fmt1_(ll.totals.OT_PRE_HRS) + 'h) | OT_A ' + ll.totals.OT_POST + ' (' + fmt1_(ll.totals.OT_POST_HRS) + 'h)')
    .setBackground('#1a3c5a').setFontColor('#fff').setFontWeight('bold')
    .setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle');
  R += 2;

  if (psa.byTeam && Object.keys(psa.byTeam).length > 0) {
    sh.setRowHeight(R, 22);
    sh.getRange(R, 1, 1, 15).merge()
      .setValue('🔵 PSA แยกทีม + OT (master-reconciled)')
      .setBackground('#1f4e79').setFontColor('#fff').setFontWeight('bold')
      .setFontSize(10).setHorizontalAlignment('left').setVerticalAlignment('middle');
    R++;

    sh.setRowHeight(R, 18);
    ['Team', 'Working', 'OT-Off', 'Vac', 'Sick', 'Off', 'OT_B (h)', 'OT_A (h)', 'Total'].forEach(function (h, i) {
      sh.getRange(R, 1 + i).setValue(h).setBackground('#2e75b6').setFontColor('#fff')
        .setFontWeight('bold').setFontSize(9).setHorizontalAlignment(i === 0 ? 'left' : 'center');
    });
    R++;

    var rowBg = ['#dceef9', '#ebf5fc'], idx = 0, seenT = {};
    var renderTeam = function (t, b) {
      sh.setRowHeight(R, 17);
      var bg = rowBg[idx++ % 2];
      var otB = b.OT_PRE > 0 ? (b.OT_PRE + ' (' + fmt1_(b.OT_PRE_HRS) + 'h)') : '-';
      var otA = b.OT_POST > 0 ? (b.OT_POST + ' (' + fmt1_(b.OT_POST_HRS) + 'h)') : '-';
      [t, b.Working, b.OT_OFF, b.Vac, b.Sick, b.Off, otB, otA, b.total].forEach(function (v, i) {
        sh.getRange(R, 1 + i).setValue(v).setBackground(bg).setFontSize(9)
          .setHorizontalAlignment(i === 0 ? 'left' : 'center');
      });
      R++;
    };
    LEGACY_TEAM_ORDER_.forEach(function (t) { var b = psa.byTeam[t]; if (b && b.total > 0) { seenT[t] = true; renderTeam(t, b); } });
    Object.keys(psa.byTeam).sort().forEach(function (t) { if (seenT[t]) return; var b = psa.byTeam[t]; if (b && b.total > 0) renderTeam(t, b); });
    R++;
  }

  sh.setRowHeight(R, 22);
  sh.getRange(R, 1, 1, 15).merge()
    .setValue('👥 จำนวนพนักงานปัจจุบันตามตำแหน่ง  ⚠️ นับจาก Manpower File — รวมทุกสถานะ ≠ จำนวนที่มาทำงานวันนี้')
    .setBackground('#444').setFontColor('#fff').setFontWeight('bold')
    .setFontSize(9).setHorizontalAlignment('left').setVerticalAlignment('middle');
  R++;

  writeHeadcountTable_(sh, R, 1, 'PSA', master.headcount.PSA);
  writeHeadcountTable_(sh, R, 9, 'LL', master.headcount.LL);
  R += Math.max(headcountRowCount_(master.headcount.PSA), headcountRowCount_(master.headcount.LL)) + 4;

  sh.setRowHeight(R, 22);
  sh.getRange(R, 1, 1, 15).merge()
    .setValue('🏢 รวมพนักงานทั้ง 2 แผนก : PSA ' + master.headcount.PSA.total +
              ' + LL ' + master.headcount.LL.total +
              ' = ' + (master.headcount.PSA.total + master.headcount.LL.total) + ' คน')
    .setBackground('#0d2137').setFontColor('#fff').setFontWeight('bold')
    .setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle');
  R++;

  sh.getRange(R, 1, 1, 15).merge()
    .setValue('สร้างอัตโนมัติ · ' + timeStr)
    .setFontColor('#999').setFontSize(7).setFontStyle('italic').setHorizontalAlignment('right');
}

function writeHeadcountTable_(sh, startRow, startCol, label, hc) {
  var bg = label === 'PSA' ? '#1f4e79' : '#7f6000';
  var rowBg = label === 'PSA' ? ['#dceef9', '#ebf5fc'] : ['#fff9e6', '#fef3cd'];
  var R = startRow;

  sh.getRange(R, startCol, 1, 7).merge()
    .setValue((label === 'PSA' ? '🔵' : '🟡') + ' ' + label + ' — รวม: ' + hc.total + ' คน')
    .setBackground(bg).setFontColor('#fff').setFontWeight('bold')
    .setFontSize(10).setHorizontalAlignment('left').setVerticalAlignment('middle');
  R++;

  sh.getRange(R, startCol, 1, 7).merge()
    .setValue('ตำแหน่ง                                                  จำนวน')
    .setBackground('#888').setFontColor('#fff').setFontWeight('bold').setFontSize(8);
  R++;

  var posOrder = ['DIR', 'MGR', 'Assist', 'PSS', 'SNR', 'PSA', 'Globlex',
                  'AdminP', 'AdminD', 'Admin', 'Porter', 'Crewsign', 'OFFICE', 'LL_ADMIN'];
  var displayNames = { OFFICE: 'OFFICE (non-op)', LL_ADMIN: 'ADMIN LL (non-op)' };
  var idx = 0;
  posOrder.forEach(function (p) {
    var n = hc.byPos[p];
    if (!n || n === 0) return;
    var displayName = displayNames[p] || (POSITION_GROUPS[p] ? POSITION_GROUPS[p].label : p);
    sh.setRowHeight(R, 16);
    sh.getRange(R, startCol, 1, 5).merge().setValue(displayName)
      .setBackground(rowBg[idx % 2]).setFontSize(9).setHorizontalAlignment('left');
    sh.getRange(R, startCol + 5, 1, 2).merge().setValue(n)
      .setBackground(rowBg[idx % 2]).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
    R++; idx++;
  });
  Object.keys(hc.byPos).sort().forEach(function (p) {
    if (posOrder.indexOf(p) >= 0) return;
    var n = hc.byPos[p];
    if (!n || n === 0) return;
    sh.setRowHeight(R, 16);
    sh.getRange(R, startCol, 1, 5).merge().setValue(p).setBackground(rowBg[idx % 2]).setFontSize(9).setHorizontalAlignment('left');
    sh.getRange(R, startCol + 5, 1, 2).merge().setValue(n).setBackground(rowBg[idx % 2]).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
    R++; idx++;
  });

  sh.setRowHeight(R, 18);
  sh.getRange(R, startCol, 1, 5).merge().setValue('TOTAL')
    .setBackground(bg).setFontColor('#fff').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('left');
  sh.getRange(R, startCol + 5, 1, 2).merge().setValue(hc.total)
    .setBackground(bg).setFontColor('#fff').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');
}

function headcountRowCount_(hc) {
  var c = 0;
  Object.keys(hc.byPos).forEach(function (p) { if (hc.byPos[p] > 0) c++; });
  return c + 3;
}
