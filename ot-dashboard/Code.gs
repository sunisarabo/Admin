/**
 * OT Dashboard — Apps Script backend  (REV 2)
 *
 * ดึงข้อมูลจาก 3 Google Sheets อัตโนมัติเมื่อ Web App ถูกเปิด:
 *   1) OT LL ย้อนหลัง  — sheets "2025", "2026"   → เดือน × code A1–A8 (LL/Porter/Admin split)
 *   2) OT Yearly (PSA) — ชีต 5                    → ทีม A1–A8 × สัปดาห์ (W1–W4)
 *   3) PSA-HKT Flight Feed (API) — tabs JAN2026..DEC2026 (active flights, excl. Cancelled)
 *
 * REV 2 — สิ่งที่เปลี่ยนจากของเดิม:
 *   • LL parser เขียนใหม่ทั้งหมด: layout จริงเป็น เดือน × A1–A8 (ไม่มีมิติรายสัปดาห์)
 *     ของเดิมหา label "JAN 2026" ใน col B + อ่านราย Week ซึ่งไม่ตรง → คืน {} ตลอด
 *   • LL output แนบ discrepancy (summary − codeTotal) ให้เห็น gap ในชีตอัตโนมัติ
 *     (เช่น ก.พ. 2026: summary LL 1171:10 แต่ code รวม 1187:10 → −16h)
 *   • PSA parser เปลี่ยนจาก preview → parse จริง: ทีม A1–A8 × สัปดาห์
 *   • cache key bump เป็น OT_ALL_V3 (กัน payload เก่าค้าง)
 *
 * ⚠️ output shape ของ LL และ PSA เปลี่ยนไปจากเดิม → ฝั่ง Index.html ต้องปรับตาม
 *    (ดู block หมายเหตุท้าย getLLData_ / getPSAData_)
 */

// ============= Config =============
const OT_LL_FILE_ID      = '1hUzdm-CPbGrotU_CwG86C5004dCSV_Gguv_cHfLOLDA';
const OT_YEARLY_FILE_ID  = '1zESOKHDpNqbkXxd3YV0EqVHv6JDeyPjKKpjwJsOMVQ0';
const OT_WEEKLY_FILE_ID  = '1EcONsdNUiy73ZfEAU978eKOMBN3u0qDmyYrRBlEm8EU';  // recent (un-archived) weeks live here
const FLIGHT_FEED_FILE_ID= '1Y3ft-vkHQ5Rm2LVmq1Zz_2j8n5T8wLgCJtdBKhqfBAA';
const MANPOWER_FILE_ID   = '1oqKI1lbXDow6JCHCOqRIhT7o7dI9U9zfpyV8CJGOUJ8';  // Pax Manpower roster
const PSA_SHEET_INDEX    = 4;       // "ชีต 5" = index 4 (0-based) — แก้ถ้าไม่ตรง
const CACHE_TTL_SEC      = 600;     // cache 10 นาที ลด Sheets API calls
const CACHE_KEY          = 'OT_ALL_V3';

// Airline → Team mapping (PSA dashboard team codes)
const TEAM_MAP = {
  EK:'EK', UO:'EK', FY:'EK', '6B':'EK', BY:'EK',
  SQ:'SQ', CX:'SQ', LY:'SQ',
  EY:'EY', AY:'EY', DV:'EY',
  TR:'TR', QP:'TR', '6E':'TR',
  WY:'WY', G9:'WY', '9C':'WY', DK:'WY',
  JQ:'JQ', IT:'JQ', IX:'JQ', AI:'JQ', N0:'JQ',
  TK:'TK', VJ:'TK', SG:'TK', HY:'TK', OD:'TK',
  KC:'KC', LJ:'KC', KE:'KC', OZ:'KC', NO:'KC', AF:'KC',
  QR:'QR', MH:'QR', OM:'QR', DE:'QR',
  AK:'AK', QZ:'AK', '8M':'AK',
  SU:'SU', W5:'SU', B2:'SU',
  '3U':'CHN', '9H':'CHN', AQ:'CHN', CA:'CHN', CZ:'CHN', FM:'CHN',
  HU:'CHN', HO:'CHN', HX:'CHN', MU:'CHN',
  ZF:'CHARTER', EO:'CHARTER', WZ:'CHARTER', N4:'CHARTER', G2:'CHARTER',
  LO:'CHARTER', HH:'CHARTER', H4:'CHARTER', S7:'CHARTER', C6:'CHARTER',
  SV:'SV', WK:'SV', KA:'SV',
  PG:'PG',
  PVT:'PVT', PRIVATE:'PVT'
};
const MONTH_NUM_TO_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_ABBR_UPPER = { JAN:'Jan', FEB:'Feb', MAR:'Mar', APR:'Apr', MAY:'May', JUN:'Jun',
                           JUL:'Jul', AUG:'Aug', SEP:'Sep', OCT:'Oct', NOV:'Nov', DEC:'Dec' };

// month name (full or 3-letter, any case) → 0..11, else -1
const MONTH_NAME_TO_NUM = (function () {
  const full = ['january','february','march','april','may','june','july',
                'august','september','october','november','december'];
  const map = {};
  full.forEach((m, i) => { map[m] = i; map[m.slice(0, 3)] = i; });
  return map;
})();
function monthIndexFromName_(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return -1;
  if (s in MONTH_NAME_TO_NUM) return MONTH_NAME_TO_NUM[s];
  const m = s.match(/^([a-z]{3,9})/);
  return (m && m[1] in MONTH_NAME_TO_NUM) ? MONTH_NAME_TO_NUM[m[1]] : -1;
}

// "1-7 May 2026" / "8-14 May  2026" → capture day1, day2, month, year
const WEEK_RANGE_RE = /(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-zก-ฮ.]{2,9})\s+(\d{4})/;

// ============= doGet =============
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('OT Dashboard — PSA & LL')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============= Client API =============
function getAllData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    try {
      const obj = JSON.parse(cached);
      obj.cached = true;
      return obj;
    } catch (e) {}
  }
  const data = {
    LL:       getLLData_(),
    PSA:      getPSAData_(),
    Flights:  getFlightData_(),
    Manpower: getManpowerData_(),
    fetchedAt: new Date().toISOString(),
    cached:  false,
  };
  try { cache.put(CACHE_KEY, JSON.stringify(data), CACHE_TTL_SEC); } catch (e) {}
  return data;
}

function clearCache() {
  CacheService.getScriptCache().remove(CACHE_KEY);
  return { ok: true };
}

// ============= Manpower (headcount) =============
// Map a roster "ทีม" label to the dashboard headcount key. Returns a
// MANPOWER_TEAM key (EK, SQ, …, PORTER, PVT, PORTERSIGN, ADMINDOC, OFFICE) or a
// MANPOWER_LL_TEAM key ('Lost & Found', 'Porter LL', 'Admin LL'), else null.
function manpowerTeamKey_(label) {
  const s = String(label || '').trim();
  if (!s) return null;
  const up = s.toUpperCase().replace(/\s+/g, ' ');
  if (up.indexOf('LOST') >= 0 && up.indexOf('FOUND') >= 0) return 'Lost & Found';
  if (up === 'PORTER LL') return 'Porter LL';
  if (up === 'ADMIN LL')  return 'Admin LL';
  if (up === 'ADMIN PORTER') return null;                 // not a dashboard team
  if (up.indexOf('CHINA') >= 0)   return 'CHN';
  if (up.indexOf('CHARTER') >= 0) return 'CHARTER';
  if (up === 'PVT') return 'PVT';
  if (up === 'PG')  return 'PG';
  if (up === 'PORTER') return 'PORTER';
  if (up.indexOf('CREWSIGN') >= 0 || (up.indexOf('PORTER') >= 0 && up.indexOf('CREW') >= 0)) return 'PORTERSIGN';
  if (up.indexOf('ADMIN') >= 0 && up.indexOf('DOC') >= 0) return 'ADMINDOC';
  if (up === 'OFFICE') return 'OFFICE';
  if (s.indexOf('/') >= 0) {
    const first = s.split('/')[0].trim().toUpperCase();
    if (['EK','SQ','EY','TR','WY','JQ','TK','KC','QR','AK','SU','SV'].indexOf(first) >= 0) return first;
  }
  return null;
}

// Count active employees per team across the whole Pax Manpower roster
// (layout-agnostic: any row with a 6-digit employee ID + a recognisable team
// label counts once; rows flagged resign/inactive are skipped; IDs are
// de-duplicated per team so repeated sections/tabs don't double-count).
function getManpowerData_() {
  try {
    const ss = SpreadsheetApp.openById(MANPOWER_FILE_ID);
    const perTeam = {};   // teamKey -> { empId: 1 }
    ss.getSheets().forEach(sh => {
      let vals;
      try { vals = sh.getDataRange().getValues(); } catch (e) { return; }
      vals.forEach(row => {
        let empId = null, team = null;
        for (let c = 0; c < row.length; c++) {
          const v = String(row[c] == null ? '' : row[c]).trim();
          if (!empId && /^\d{6,}$/.test(v)) empId = v;
          if (!team) { const k = manpowerTeamKey_(v); if (k) team = k; }
        }
        if (!empId || !team) return;
        const rowStr = row.map(x => String(x == null ? '' : x)).join('|').toLowerCase();
        if (/resign|inactive|ลาออก|terminat|พ้นสภาพ/.test(rowStr)) return;
        if (!perTeam[team]) perTeam[team] = {};
        perTeam[team][empId] = 1;
      });
    });
    const teams = {};
    Object.keys(perTeam).forEach(t => { teams[t] = Object.keys(perTeam[t]).length; });
    if (Object.keys(teams).length === 0) return { _error: 'Manpower: ไม่พบ roster (รหัสพนักงาน + ทีม)' };
    return { teams: teams, at: new Date().toISOString() };
  } catch (e) {
    return { _error: String(e) };
  }
}

// ============= Helpers =============
function hmsToMin_(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Math.round(v * 24 * 60); // Excel time fraction (days)
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  const s = String(v).trim();
  if (!s) return 0;
  const m = s.match(/^(\d+):(\d+)(?::(\d+))?$/);   // "1146:30" หรือ "1050:02:00"
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 60);
}

function getDayOfMonth_(v) {
  if (v instanceof Date) return v.getDate();
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.getUTCDate();
  }
  const s = String(v || '').trim();
  if (!s) return 0;
  const thM = s.match(/^(\d{1,2})\s+[ก-ฮ]/);
  if (thM) return parseInt(thM[1]);
  const dt = new Date(s);
  if (!isNaN(dt)) return dt.getDate();
  const numM = s.match(/^(\d{1,2})/);
  return numM ? parseInt(numM[1]) : 0;
}

function getMonthYear_(v) {
  if (v instanceof Date) return [v.getMonth(), v.getFullYear()];
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return [d.getUTCMonth(), d.getUTCFullYear()];
  }
  const dt = new Date(String(v || ''));
  return isNaN(dt) ? [-1, 0] : [dt.getMonth(), dt.getFullYear()];
}

function weekIndexFromDay_(day) {
  if (day <= 7)  return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  return 3;
}

// ============= LL Parser (REV 2 — month × code A1–A8) =============
/**
 * โครงสร้างชีตจริง (tab "2026"):
 *   row0 : [ "2026", LL, Porter, Admin, Total, '', "January", ...blank..., "February", ... ]
 *           ^A=year                              ^month label ของ code-block (cols 6,12,18,24,30)
 *   row1 : [ "January", 1050:02, 922:00, 35:00, 2007:02, '', "Code", LL, Porter, Admin, Total, '', "Code", ... ]
 *           ^left-block summary เริ่ม                       ^code-block header
 *   row2.. : left col A = "February".. , right = A1..A8 ของแต่ละ code-block
 *   ...    : code-block ปิดท้ายด้วยแถว "Total"
 *
 * Output: {
 *   'Jan 2026': {
 *     summary:    { LL_min, Porter_min, Admin_min, Total_min },   // จาก left summary block
 *     codes:      { A1:{LL_min,Porter_min,Admin_min,Total_min}, ... A8 },
 *     codeTotal:  { LL_min, Porter_min, Admin_min, Total_min },   // แถว Total ของ code-block
 *     discrepancy:{ LL_min, Porter_min, Admin_min, Total_min }    // summary − codeTotal (0 = ตรงกัน)
 *   }, ...
 * }
 * NB: codeTotal = ผลรวม A1–A8 ภายในตัวเอง → internally consistent กว่า summary
 *
 * ⚠️ FRONT-END: เดิม getLLData_ คืน { weeks:[...], codes:{Week01:{...}} } (รายสัปดาห์)
 *    ของใหม่ไม่มี weeks แล้ว — โค้ดใน Index.html ที่วน weeks/Week01 ต้องเปลี่ยนเป็น codes(A1–A8)/summary
 */
function getLLData_() {
  const result = {};
  try {
    const ss = SpreadsheetApp.openById(OT_LL_FILE_ID);
    ['2025', '2026'].forEach(yr => {
      const sh = ss.getSheetByName(yr);
      if (sh) Object.assign(result, parseLLYearSheet_(sh, yr));
    });
  } catch (e) {
    return { _error: String(e) };
  }
  if (Object.keys(result).length === 0) {
    result._error = 'LL: ไม่พบ layout เดือน×code ใน tab "2025"/"2026" — ตรวจว่า col A มีปี (เช่น "2026")';
  }
  return result;
}

function readQuad_(row, c) {
  return {
    LL_min:     hmsToMin_(row[c]),
    Porter_min: hmsToMin_(row[c + 1]),
    Admin_min:  hmsToMin_(row[c + 2]),
    Total_min:  hmsToMin_(row[c + 3]),
  };
}

// Parse an OT_LL year tab in the current weekly-block layout. Each month is a
// block whose header row is  [ (A empty), "JUN 2026", "Week 01".."Week 04",
// "Total", … ]  with category rows LL/Porter/Admin/Total (weekly values in cols
// C-F) on the left, and an A1–A8 × week × category code block on the right
// (label at col I, per-week LL/Porter/Admin at cols 9/11/13, 15/17/19, …).
// Returns the weekly shape the front-end LL_DATA uses:
//   { "Jun 2026": { weeks:[{week,LL_min,Porter_min,Admin_min,Total_min}],
//                   codes:{ "Week 01":{ A1:{LL_min,Porter_min,Admin_min},… } } } }
function parseLLYearSheet_(sheet, year) {
  const values = sheet.getDataRange().getValues();
  const data = {};
  const WK = ['Week 01', 'Week 02', 'Week 03', 'Week 04'];
  const catWkCol  = [2, 3, 4, 5];                    // C-F : weekly category totals
  const codeWkCol = [[9, 11, 13], [15, 17, 19], [21, 23, 25], [27, 29, 31]]; // LL/Porter/Admin per week

  for (let r = 0; r < values.length; r++) {
    const label = String(values[r][1] || '').trim();
    const mIdx = monthIndexFromName_(label);
    const ym = label.match(/(20\d{2})/);
    // month-block header: col B is "<Month> <Year>" and col C is a "Week …" label
    if (mIdx < 0 || !ym) continue;
    if (String(values[r][2] || '').toLowerCase().indexOf('week') < 0) continue;
    const key = MONTH_NUM_TO_ABBR[mIdx] + ' ' + ym[1];

    // left category rows (LL / Porter / Admin) in the next few rows
    const catRow = { LL: null, Porter: null, Admin: null };
    for (let rr = r + 1; rr < r + 6 && rr < values.length; rr++) {
      const l = String(values[rr][1] || '').trim().toLowerCase();
      if (l === 'll') catRow.LL = rr;
      else if (l === 'porter') catRow.Porter = rr;
      else if (l === 'admin') catRow.Admin = rr;
      else if (l === 'total') break;
    }
    const cm = (row, w) => row == null ? 0 : hmsToMin_(values[row][catWkCol[w]]);
    const weeks = WK.map((wl, w) => {
      const ll = cm(catRow.LL, w), po = cm(catRow.Porter, w), ad = cm(catRow.Admin, w);
      return { week: wl, LL_min: ll, Porter_min: po, Admin_min: ad, Total_min: ll + po + ad };
    });

    // right code block: A1-A8 rows, label at col I (index 8)
    const codes = { 'Week 01': {}, 'Week 02': {}, 'Week 03': {}, 'Week 04': {} };
    for (let rr = r + 1; rr < r + 12 && rr < values.length; rr++) {
      const c = String(values[rr][8] || '').trim().toUpperCase();
      if (!/^A[1-8]$/.test(c)) continue;
      for (let w = 0; w < 4; w++) {
        const cc = codeWkCol[w];
        codes[WK[w]][c] = {
          LL_min:     hmsToMin_(values[rr][cc[0]]),
          Porter_min: hmsToMin_(values[rr][cc[1]]),
          Admin_min:  hmsToMin_(values[rr][cc[2]]),
        };
      }
    }

    if (weeks.reduce((a, x) => a + x.Total_min, 0) > 0) data[key] = { weeks: weeks, codes: codes };
  }
  return data;
}

// ============= PSA/KP OT Parser (REV 4 — "สรุป" summary sheet) =============
// OT Yearly has a "สรุป" sheet holding the authoritative monthly rollups —
// complete for every week and retained (unlike the per-employee detail tabs,
// which get overwritten weekly). It is a grid of month blocks tiled left to
// right; each block is:
//     Team/Week | 1-7 Jun 2026 | 8-14 Jun 2026 | 15-21 Jun 2026 | 22-30 Jun 2026 | รวม
//     EK/UO/…   | 285:30       | 139:30        | 24:00          | 50:00          | 499:00
//     …  (airline groups = KP;  PORTER / PVT = LP)                              …
//     รวม       | …
// plus a matching "Code / Week" block (A1–A8) for the same month. Reading this
// one small sheet is fast (no fetch timeout) and always complete.
//
// Output per month (shape applyLivePSA consumes):
//   { "Jun 2026": { teams:{EK:[w1..w4] min,…}, codes:{A1:[w1..w4] min,…},
//                   weekLabels:[…], monthTotal }, … }

// Map a "Team/Week" row label ("EK/UO/FY/6B/BY", "CHINA", "Porter Crewsign") to
// the dashboard team code. Airline groups → first token; named rows have aliases.
function teamCodeFromLabel_(label) {
  const s = String(label || '').trim();
  if (!s) return null;
  const up = s.toUpperCase().replace(/\s+/g, ' ');
  const ALIAS = {
    'CHINA': 'CHN', 'CHARTER': 'CHARTER', 'PVT': 'PVT', 'PG': 'PG',
    'PORTER': 'PORTER', 'PORTER CREWSIGN': 'PORTERSIGN',
    'ADMIN DOC': 'ADMINDOC', 'OFFICE': 'OFFICE',
  };
  if (ALIAS[up]) return ALIAS[up];
  if (s.indexOf('/') >= 0) return s.split('/')[0].trim().toUpperCase();  // airline group
  return null;
}

// Parse the tiled "สรุป" grid. For every header cell ("Team/Week" or "Code /
// Week") whose next column is a week range, read the block beneath it (label in
// the header's column, four week columns to the right) down to its "รวม" footer.
// The row label decides the bucket: A1–A8 → codes, anything else → a team; the
// team block and the code block feed the same month key.
function parseSummarySheet_(values) {
  const out = {};
  const HDR = /(?:team|code)\s*\/\s*week/i;
  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    if (!row) continue;
    for (let c = 0; c < row.length - 4; c++) {
      if (!HDR.test(String(row[c] || ''))) continue;
      const wm = String(row[c + 1] || '').match(WEEK_RANGE_RE);
      if (!wm) continue;
      const mIdx = monthIndexFromName_(wm[3].replace(/\./g, ''));
      if (mIdx < 0) continue;
      const key = MONTH_NUM_TO_ABBR[mIdx] + ' ' + wm[4];
      const wCols = [c + 1, c + 2, c + 3, c + 4];
      const rec = out[key] || (out[key] = {
        teams: {}, codes: {}, monthTotal: 0,
        weekLabels: wCols.map(x => String(row[x]).replace(/\s+/g, ' ').trim()),
      });
      for (let rr = r + 1; rr < values.length; rr++) {
        const label = String(values[rr][c] || '').trim();
        if (!label) break;                                   // block ended
        if (/^(รวม|total)$/i.test(label)) break;             // footer
        if (/^A[1-8]$/i.test(label)) {
          rec.codes[label.toUpperCase()] = wCols.map(x => hmsToMin_(values[rr][x]));
        } else {
          const tc = teamCodeFromLabel_(label);
          if (tc) rec.teams[tc] = wCols.map(x => hmsToMin_(values[rr][x]));
        }
      }
    }
  }
  // Drop empty (future / unfilled) month blocks; finalise totals.
  Object.keys(out).forEach(key => {
    const rec = out[key];
    const tot = Object.keys(rec.teams).reduce(
      (s, t) => s + rec.teams[t].reduce((a, b) => a + b, 0), 0);
    if (tot <= 0) { delete out[key]; return; }
    rec.monthTotal = tot;
  });
  return out;
}

function getPSAData_() {
  try {
    const ss = SpreadsheetApp.openById(OT_YEARLY_FILE_ID);
    // Scan the SMALL sheets only (summary tables are tiny; the per-employee
    // detail tabs are hundreds of rows — skipping them keeps this fast and
    // avoids a Spreadsheet timeout). Parse any Team/Week grid found and, per
    // month, keep the block with the LARGEST total — so a stray small/old copy
    // of a month can't shadow the complete "สรุป" grid, wherever it lives.
    const merged = {};
    ss.getSheets().forEach(sh => {
      try {
        const lr = sh.getLastRow();
        if (lr < 2 || lr > 200) return;            // summary grids are ~70 rows; detail tabs are ~400
        const lc = Math.min(sh.getLastColumn(), 300);
        if (lc < 5) return;
        const vals = sh.getRange(1, 1, lr, lc).getValues();
        if (!vals.some(row => row.some(c => /(?:team|code)\s*\/\s*week/i.test(String(c || ''))))) return;
        const part = parseSummarySheet_(vals);
        Object.keys(part).forEach(mk => {
          if (!merged[mk] || (part[mk].monthTotal || 0) > (merged[mk].monthTotal || 0)) merged[mk] = part[mk];
        });
      } catch (e) { /* skip a bad sheet, keep the rest */ }
    });
    if (!Object.keys(merged).length) throw new Error('ไม่พบตารางสรุป Team/Week ใน OT Yearly');
    // Diagnostic: month totals (hours) so a wrong/partial read is visible.
    merged._weeks = Object.keys(merged).sort().map(mk =>
      mk.replace(/ 20\d\d$/, '') + ':' + Math.round((merged[mk].monthTotal || 0) / 60) + 'h').join(' ');
    try { PropertiesService.getScriptProperties().setProperty('PSA_LAST_GOOD', JSON.stringify(merged)); } catch (e) {}
    return merged;
  } catch (e) {
    try {
      const s = PropertiesService.getScriptProperties().getProperty('PSA_LAST_GOOD');
      if (s) { const d = JSON.parse(s); d._stale = String(e).slice(0, 90); return d; }
    } catch (e2) {}
    return { _error: String(e) };
  }
}

// ============= Flight Feed Parser (ไม่เปลี่ยน) =============
function getFlightData_() {
  const result = {};
  const debug = { sheetsFound: [], sheetsParsed: 0, totalRowsRead: 0 };
  try {
    const ss = SpreadsheetApp.openById(FLIGHT_FEED_FILE_ID);
    const monthSheets = ss.getSheets().filter(s => /^[A-Z]{3}\d{4}$/.test(s.getName().replace(/\s/g, '')));
    debug.sheetsFound = monthSheets.map(s => s.getName());

    monthSheets.forEach(sh => {
      const name = sh.getName().replace(/\s/g, '').toUpperCase();
      const mm = name.match(/^([A-Z]{3})(\d{4})$/);
      if (!mm) return;
      const monthAbbr = MONTH_ABBR_UPPER[mm[1]];
      if (!monthAbbr) return;
      const mk = monthAbbr + ' ' + mm[2];

      const values = sh.getDataRange().getValues();
      if (values.length < 2) return;
      debug.totalRowsRead += values.length;
      debug.sheetsParsed++;

      const hdr = values[0].map(c => String(c || '').toLowerCase());
      let dateCol = 0, airlineCol = 1, statusCol = -1, typeCol = -1;
      hdr.forEach((h, i) => {
        if (h.indexOf('date') >= 0 || h === 'วันที่') dateCol = i;
        if (h.indexOf('airline') >= 0) airlineCol = i;
        if (h === 'status' || h.indexOf('status ') === 0) statusCol = i;
        if (h.indexOf('type of flight') >= 0) typeCol = i;
      });
      if (statusCol < 0) statusCol = 20;
      if (typeCol < 0)   typeCol = 21;

      const teams = {};
      const flightCounts = [0,0,0,0];
      let cancelledCount = 0, validRows = 0;

      for (let r = 1; r < values.length; r++) {
        const row = values[r];
        if (!row || row.length < 2) continue;
        const dateCell = row[dateCol];
        const airline  = String(row[airlineCol] || '').trim().toUpperCase();
        if (!airline) continue;
        const status   = String(row[statusCol] || '').trim().toLowerCase();
        const flType   = String(row[typeCol]   || '').trim().toLowerCase();
        const day      = getDayOfMonth_(dateCell);
        if (day < 1 || day > 31) continue;
        validRows++;
        if (status === 'cancelled' || flType === 'cancelled') { cancelledCount++; continue; }
        const wIdx = weekIndexFromDay_(day);
        flightCounts[wIdx]++;
        const team = TEAM_MAP[airline];
        if (team) {
          if (!teams[team]) teams[team] = [0,0,0,0];
          teams[team][wIdx]++;
        }
      }
      result[mk] = {
        flightCounts: flightCounts,
        teams: teams,
        cancelled: cancelledCount,
        _diag: { validRows: validRows, dateCol: dateCol, statusCol: statusCol, typeCol: typeCol }
      };
    });
  } catch (e) {
    return { _error: String(e), _debug: debug };
  }
  result._debug = debug;
  return result;
}

// ============= Inspect / Test =============
function inspectSheets() {
  ['LL', 'Yearly', 'Flight Feed'].forEach((label, i) => {
    const id = [OT_LL_FILE_ID, OT_YEARLY_FILE_ID, FLIGHT_FEED_FILE_ID][i];
    try {
      const ss = SpreadsheetApp.openById(id);
      console.log('=== ' + label + ' (' + ss.getName() + ') ===');
      ss.getSheets().forEach((s, idx) => {
        console.log('  [' + idx + '] ' + s.getName() + ' — ' + s.getLastRow() + ' rows × ' + s.getLastColumn() + ' cols');
      });
    } catch (e) {
      console.log('=== ' + label + ' ERROR ===\n  ' + e);
    }
  });
}

function testGetAllData() {
  const data = getAllData();
  const real = obj => Object.keys(obj || {}).filter(k => !k.startsWith('_') && k !== 'cached');

  // ---- LL ----
  const llMonths = real(data.LL);
  console.log('LL months: ' + llMonths.length + (data.LL._error ? '  (' + data.LL._error + ')' : ''));
  llMonths.forEach(mk => {
    const d = data.LL[mk];
    const ct = d.codeTotal, dc = d.discrepancy;
    const gap = dc && (dc.LL_min || dc.Porter_min || dc.Admin_min)
      ? '  ⚠ summary≠codes (LL ' + (dc.LL_min / 60).toFixed(2) + 'h)' : '';
    console.log('  ' + mk + ': codeTotal LL ' + (ct ? (ct.LL_min / 60).toFixed(2) : '-') + 'h' + gap);
  });

  // ---- PSA ----
  const psaMonths = real(data.PSA);
  console.log('PSA months: ' + (data.PSA._error ? data.PSA._error : psaMonths.join(', ')));
  psaMonths.forEach(mk => {
    const p = data.PSA[mk];
    console.log('  ' + mk + ': total ' + (p.monthTotal / 60).toFixed(1) + 'h, teams ' + Object.keys(p.teams).join('/'));
  });

  // ---- Flights ----
  console.log('Flight months: ' + (data.Flights._error ? data.Flights._error : real(data.Flights).length));
}
