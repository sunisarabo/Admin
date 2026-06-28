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
const FLIGHT_FEED_FILE_ID= '1Y3ft-vkHQ5Rm2LVmq1Zz_2j8n5T8wLgCJtdBKhqfBAA';
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
    LL:      getLLData_(),
    PSA:     getPSAData_(),
    Flights: getFlightData_(),
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

function parseLLYearSheet_(sheet, year) {
  const values = sheet.getDataRange().getValues();
  const data = {};

  // 1) หาแถว header: col A === ปี
  let hdrRow = -1;
  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0] || '').trim() === String(year)) { hdrRow = r; break; }
  }
  if (hdrRow < 0) return data;   // tab นี้ไม่ใช่ layout เดือน×code (เช่น 2025 อาจ layout ต่าง)

  // 2) LEFT block — สรุปรายเดือน: col A = ชื่อเดือน, cols B-E = LL/Porter/Admin/Total
  const summaryByMonth = {};
  for (let r = hdrRow + 1; r < values.length; r++) {
    const mIdx = monthIndexFromName_(values[r][0]);
    if (mIdx < 0) continue;
    const key = MONTH_NUM_TO_ABBR[mIdx] + ' ' + year;
    summaryByMonth[key] = readQuad_(values[r], 1);
  }

  // 3) RIGHT blocks — month label อยู่ในแถว hdrRow ที่ cols >= 5 → เก็บ codes/codeTotal รายเดือน
  const codeBlocks = {};
  const hdr = values[hdrRow] || [];
  const codeHdrRow = hdrRow + 1;
  for (let c = 5; c < hdr.length; c++) {
    const mIdx = monthIndexFromName_(hdr[c]);
    if (mIdx < 0) continue;
    const key = MONTH_NUM_TO_ABBR[mIdx] + ' ' + year;

    // หา column ของ "Code" (แถวถัดจาก month label) — ปกติตรงคอลัมน์เดียวกับ label
    let codeCol = c;
    for (let cc = c; cc < c + 3 && cc < (values[codeHdrRow] || []).length; cc++) {
      if (String(values[codeHdrRow][cc] || '').trim().toLowerCase() === 'code') { codeCol = cc; break; }
    }

    const codes = {};
    let codeTotal = null;
    for (let r = codeHdrRow + 1; r < values.length; r++) {
      const label = String(values[r][codeCol] || '').trim();
      if (/^A[1-8]$/i.test(label)) {
        codes[label.toUpperCase()] = readQuad_(values[r], codeCol + 1);
      } else if (/^total$/i.test(label)) {
        codeTotal = readQuad_(values[r], codeCol + 1);
        break;                                   // code-block จบที่แถว Total
      } else if (label === '' && Object.keys(codes).length >= 8) {
        break;
      }
    }
    codeBlocks[key] = { codes: codes, codeTotal: codeTotal };
  }

  // 4) MERGE — รวมทุกเดือนที่มียอดสรุป หรือ มี code-block (เดือนที่มีแต่ summary เช่น June จะไม่ตกหล่น)
  const keys = Object.keys(summaryByMonth);
  Object.keys(codeBlocks).forEach(k => { if (keys.indexOf(k) < 0) keys.push(k); });
  keys.forEach(key => {
    const summary   = summaryByMonth[key] || null;
    const cb        = codeBlocks[key] || {};
    const codes     = cb.codes || {};
    const codeTotal = cb.codeTotal || null;
    const hasCodes  = Object.keys(codes).length > 0;
    if (!hasCodes && (!summary || summary.Total_min <= 0)) return;   // ข้ามเดือนว่าง (Jul–Dec = 0)

    const disc = (summary && codeTotal) ? {
      LL_min:     summary.LL_min     - codeTotal.LL_min,
      Porter_min: summary.Porter_min - codeTotal.Porter_min,
      Admin_min:  summary.Admin_min  - codeTotal.Admin_min,
      Total_min:  summary.Total_min  - codeTotal.Total_min,
    } : null;

    data[key] = { summary: summary, codes: codes, codeTotal: codeTotal, discrepancy: disc };
  });
  return data;
}

// ============= PSA OT Parser (REV 2 — team A1–A8 × week) =============
/**
 * โครงสร้างชีตจริง (ชีต 5) — หนึ่งตารางต่อหนึ่งเดือน, อาจมีหลายตารางต่อกัน:
 *   header : [ "Team/Week", "1-7 May 2026", "8-14 May 2026", "15-21 May 2026", "22-30 May 2026", "รวม" ]
 *   A1..A8 : [ "A1", 1146:30, 1038:00, 726:30, 1260:30, 4171:30 ]
 *   รวม    : [ "รวม", 8424:30, 3296:00, 2673:00, 4723:00, 19116:30 ]
 *
 * Output: {
 *   'May 2026': {
 *     teams:      { A1:[w1,w2,w3,w4], ... A8 },   // นาที, เรียงตามสัปดาห์ W1..W4
 *     weekTotals: [w1,w2,w3,w4],                  // แถว "รวม"
 *     monthTotal: <นาที>,
 *     weekLabels: ["1-7 May 2026", ...],
 *     _rowTotals: { A1:<นาที>, ... }              // ช่อง "รวม" ของแต่ละทีม (ไว้ cross-check)
 *   }, ...
 * }
 * week bucket ตรงกับ weekIndexFromDay_ (1-7→W1 ... 22-31→W4) → join กับ Flight feed รายสัปดาห์ได้ตรง
 *
 * ⚠️ FRONT-END: เดิม getPSAData_ คืน { _meta, _preview } (preview mode)
 *    ของใหม่คืน month → teams/weekTotals — ฝั่ง PSA ใน Index.html ต้องเขียน render ใหม่
 */
function getPSAData_() {
  try {
    const ss = SpreadsheetApp.openById(OT_YEARLY_FILE_ID);
    const sheets = ss.getSheets();
    const merged = {};
    let found = false;
    const tryParse = (sh) => {
      if (!sh) return;
      const res = parsePSASheet_(sh);
      if (res && !res._error) {
        Object.keys(res).forEach(k => { if (k[0] !== '_') merged[k] = res[k]; });
        found = true;
      }
    };
    tryParse(sheets[PSA_SHEET_INDEX]);        // configured tab first
    if (!found) sheets.forEach(tryParse);     // else scan every tab so order can change
    return found ? merged
                 : { _error: 'PSA: ไม่พบตาราง Team/Week หรือ Code/Week (' + sheets.length + ' tabs)' };
  } catch (e) {
    return { _error: String(e) };
  }
}

// Map a PSA "Team/Week" row label (e.g. "EK/UO/FY/6B/BY", "CHINA",
// "Porter Crewsign") to the dashboard team code. Airline groups → first token;
// the named rows have explicit aliases. Returns null for unrecognised labels.
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

// Parse one OT-Yearly sheet. Per month it holds a "Team/Week" table (airline
// groups × week) and a "Code / Week" table (A1–A8 × week). Both feed the same
// month key. Returns
//   { "May 2026": { teams:{EK:[m,m,m,m],…}, codes:{A1:[m,m,m,m],…},
//                   weekTotals:[…], weekLabels:[…], monthTotal } , … }
function parsePSASheet_(sheet) {
  const values = sheet.getDataRange().getValues();
  const out = {};

  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    if (!row) continue;

    // header detection — "Team/Week" or "Code / Week" + week-range columns
    let labelCol = -1;
    const weekCols = [];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '');
      if (labelCol < 0 && /\/\s*week/i.test(cell)) labelCol = c;
      if (WEEK_RANGE_RE.test(cell)) weekCols.push(c);
    }
    const isHeader = (labelCol >= 0 && weekCols.length >= 2) || weekCols.length >= 3;
    if (!isHeader) continue;

    const wm = String(row[weekCols[0]]).match(WEEK_RANGE_RE);
    const mIdx = wm ? monthIndexFromName_(wm[3].replace(/\./g, '')) : -1;
    if (mIdx < 0) continue;
    const key = MONTH_NUM_TO_ABBR[mIdx] + ' ' + wm[4];

    const codeCol  = labelCol >= 0 ? labelCol : 0;
    const totalCol = row.findIndex(c => /^(รวม|total)$/i.test(String(c || '').trim()));

    const rec = out[key] || (out[key] = {
      teams: {}, codes: {}, weekTotals: null, monthTotal: 0,
      weekLabels: weekCols.map(c => String(row[c]).replace(/\s+/g, ' ').trim()),
    });

    for (let rr = r + 1; rr < values.length; rr++) {
      const label = String(values[rr][codeCol] || '').trim();
      if (/\/\s*week/i.test(label)) break;                          // next table header
      if (/^A\d+$/i.test(label)) {                                  // code row
        rec.codes[label.toUpperCase()] = weekCols.map(c => hmsToMin_(values[rr][c]));
      } else if (/^(รวม|total)$/i.test(label)) {                    // footer
        const wt = weekCols.map(c => hmsToMin_(values[rr][c]));
        if (!rec.weekTotals || wt.reduce((a, b) => a + b, 0) > 0) rec.weekTotals = wt;
        if (totalCol >= 0) { const mt = hmsToMin_(values[rr][totalCol]); if (mt) rec.monthTotal = mt; }
        break;
      } else if (label === '') {                                   // blank → table ends
        if (Object.keys(rec.teams).length || Object.keys(rec.codes).length) break;
      } else {                                                     // team row
        const tc = teamCodeFromLabel_(label);
        if (tc) rec.teams[tc] = weekCols.map(c => hmsToMin_(values[rr][c]));
      }
    }
  }

  Object.keys(out).forEach(key => {
    const rec = out[key];
    if (!rec.weekTotals) {
      const src = Object.keys(rec.teams).length ? rec.teams : rec.codes;
      rec.weekTotals = rec.weekLabels.map((_, i) =>
        Object.keys(src).reduce((s, t) => s + (src[t][i] || 0), 0));
    }
    if (!rec.monthTotal) rec.monthTotal = rec.weekTotals.reduce((a, b) => a + b, 0);
  });

  if (Object.keys(out).length === 0) {
    return { _error: 'ไม่พบตาราง PSA บนชีต "' + sheet.getName() + '"' };
  }
  return out;
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
