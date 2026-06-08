/**
 * MasterReader.gs — establishment headcount + employee roster from the MASTER file
 * =============================================================================
 * The Pax Manpower master ("Total" sheet) lists every employee with their team,
 * department and status. This gives the *establishment* headcount (all active
 * staff) for PSA (การโดยสาร) and LL (ติดตามสัมภาระ) — independent of who is on
 * duty today.
 *
 * Two consumers, ONE read pass (readMaster_):
 *   • readMasterHeadcount(id)  -> { PSA:{total,byPos}, LL:{total,byPos}, active }
 *     Used by the web dashboard bot (RosterBot.gs / WebDashboard.gs) to show the
 *     "จำนวนพนักงานทั้งหมด (Active)" line.
 *   • readMaster_(id)          -> { employees, byId, headcount, activeCount, ... }
 *     Used by the legacy report (Reconcile.gs) for MASTER-based OFF counting:
 *     every operational employee not found in today's assignment file counts as
 *     OFF, so the daily Off figure is accurate (not just "people in the file").
 *
 * Master "Total" sheet columns (0-indexed):
 *   1 ID | 2 Team | 4 NameTH | 6 Dept | 7 Position | 10 NameEN | 12 ResignDate | 13 Status
 */

// ID ไฟล์ Pax Manpower master — ต้องเข้าได้จึงจะนับ OFF จาก establishment ได้
var MASTER_FILE_ID_RB = '1oqKI1lbXDow6JCHCOqRIhT7o7dI9U9zfpyV8CJGOUJ8';
var DEPT_PSA_TH = 'การโดยสาร';
var DEPT_LL_TH  = 'ติดตามสัมภาระ';

// Operational position groups (the ones that appear on daily assignment sheets).
// Non-operational groups (DIR/MGR/Assist/OFFICE/LL_ADMIN) are counted in the
// establishment headcount but excluded from the daily on-duty reconciliation.
var MR_OPERATIONAL_GROUPS = ['PSS', 'SNR', 'PSA', 'Globlex', 'AdminD', 'Porter', 'Crewsign'];

/**
 * Rich position mapper (ported from the legacy v3.1 bot). Distinguishes the
 * management / admin / borrowed-desk groups the legacy Chat + PDF report needs.
 * RosterReader.rrPosGroup_ is the lean operational mapper used by the daily
 * reader; this one is for the MASTER establishment breakdown.
 */
function mapPosition_(rawPos, team) {
  var s = String(rawPos || '').trim();
  if (!s) return 'PSA';
  var up = s.toUpperCase();
  var teamUp = String(team || '').trim().toUpperCase();
  if (up.indexOf('DIRECTOR') >= 0) return 'DIR';
  var core = up.replace(/^ACT(?:\.|ING)?\.?\s+/, '').replace(/^ACT\./, '');
  if (core.indexOf('ASSISTANT MANAGER') >= 0 || core.indexOf('ASSIST MANAGER') >= 0) return 'Assist';
  if (core.indexOf('MANAGER') >= 0) return 'MGR';
  if (core.indexOf('SUPERVISOR') >= 0)     return 'PSS';
  if (core.indexOf('SENIOR ADMIN') >= 0)   return teamUp.indexOf('PORTER') >= 0 ? 'AdminP' : 'AdminD';
  if (core.indexOf('SENIOR') >= 0)         return 'SNR';
  if (core.indexOf('ADMINISTRATIVE') >= 0) return teamUp.indexOf('PORTER') >= 0 ? 'AdminP' : 'AdminD';
  if (core.indexOf('PORTER') >= 0)         return 'Porter';
  if (core.indexOf('AGENT') >= 0)          return 'PSA';
  return 'PSA';
}

/** First name (upper) from EN name (preferred) or TH name, for fuzzy matching. */
function mrFirstName_(nameEN, nameTH) {
  var firstName = '';
  if (nameEN) {
    var parts = String(nameEN).replace(/^(MR|MRS|MS|MISS|MS\.|MR\.|MRS\.)\.?\s+/i, '').split(/\s+/);
    if (parts[0]) firstName = parts[0].toUpperCase();
  }
  if (!firstName && nameTH) {
    var thParts = String(nameTH).split(/\s+/);
    firstName = (thParts[1] || thParts[0] || '').toUpperCase();
  }
  return firstName;
}

/**
 * Full single-pass read of the MASTER "Total" sheet.
 * Returns { employees, byId, headcount:{PSA,LL,active}, activeCount, operationalCount }.
 */
function readMaster_(masterFileId) {
  var ss = SpreadsheetApp.openById(masterFileId || MASTER_FILE_ID_RB);
  var ws = ss.getSheetByName('Total');
  if (!ws) throw new Error('Master: ไม่พบชีต "Total"');
  var data = ws.getDataRange().getValues();

  var employees = [], byId = {};
  var headcount = { PSA: { total: 0, byPos: {} }, LL: { total: 0, byPos: {} }, active: 0 };
  var now = new Date();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var idStr = String(row[1] == null ? '' : row[1]).replace(/\.0*$/, '').trim();
    if (!/^\d{6,8}$/.test(idStr.replace(/\D/g, ''))) continue;

    var status = String(row[13] || '').trim();
    if (status === 'Resigned') continue;
    if (status !== 'Active') {
      var rd = row[12];
      if (rd instanceof Date && rd < now) continue;          // already left
    }

    var dept = String(row[6] || '');
    var deptKey = dept.indexOf(DEPT_PSA_TH) >= 0 ? 'PSA' : (dept.indexOf(DEPT_LL_TH) >= 0 ? 'LL' : null);
    if (!deptKey) continue;

    var team = String(row[2] || '');
    var posRaw = String(row[7] || '').trim();
    var posGroup = (deptKey === 'LL') ? mapPositionLL_(posRaw) : mapPosition_(posRaw, team);

    // team-based posGroup adjustments (matches legacy bot grouping)
    if (deptKey === 'PSA') {
      var teamUp = team.toUpperCase();
      if (teamUp.indexOf('CREWSIGN') >= 0) posGroup = 'Crewsign';
      else if (teamUp.indexOf('GLOBLEX') >= 0 || teamUp.indexOf('GLOBEX') >= 0) posGroup = 'Globlex';
      else if (teamUp === 'ADMIN DOC') posGroup = 'AdminD';
      else if (teamUp.indexOf('ADMIN PORTER') >= 0) posGroup = 'Porter';
      else if (teamUp === 'OFFICE' && ['DIR', 'MGR', 'Assist'].indexOf(posGroup) < 0) posGroup = 'OFFICE';
    } else {
      var teamUpLL = team.toUpperCase();
      if (teamUpLL.indexOf('ADMIN') >= 0 && ['DIR', 'MGR', 'Assist'].indexOf(posGroup) < 0) posGroup = 'LL_ADMIN';
    }
    if (!posGroup) posGroup = 'PSA';

    var operational = MR_OPERATIONAL_GROUPS.indexOf(posGroup) >= 0;
    var emp = {
      id: idStr, team: team, dept: deptKey,
      position: posRaw, posGroup: posGroup,
      firstName: mrFirstName_(row[10], row[4]),
      operational: operational,
    };
    employees.push(emp);
    byId[idStr] = emp;

    headcount[deptKey].total++;
    headcount[deptKey].byPos[posGroup] = (headcount[deptKey].byPos[posGroup] || 0) + 1;
    headcount.active++;
  }

  var operationalCount = employees.filter(function (e) { return e.operational; }).length;
  return {
    employees: employees, byId: byId, headcount: headcount,
    activeCount: headcount.active, operationalCount: operationalCount,
  };
}

/** LL position mapper (ported from the legacy bot) — only operational LL groups. */
function mapPositionLL_(rawPos) {
  var s = String(rawPos || '').trim();
  if (!s) return 'PSA';
  var up = s.toUpperCase();
  if (up.indexOf('DIRECTOR') >= 0) return 'LL_ADMIN';
  if (up.indexOf('MANAGER') >= 0) return 'LL_ADMIN';
  if (up.indexOf('ADMIN') >= 0) return 'Admin';
  if (up === 'PSS' || up.indexOf('SUPERVISOR') >= 0) return 'PSS';
  if (up === 'SNR' || up.indexOf('SENIOR') >= 0) return 'SNR';
  if (up.indexOf('PORTER') >= 0) return 'Porter';
  if (up === 'PSA' || up === 'NEW PSA' || up.indexOf('AGENT') >= 0) return 'PSA';
  return 'PSA';
}

/**
 * Thin wrapper for the web dashboard bot — returns just the establishment
 * headcount in the shape RosterBot.gs / WebDashboard.gs expect. Returns null
 * (and logs) if the master file can't be opened, so the report still runs.
 */
function readMasterHeadcount(masterFileId) {
  try {
    return readMaster_(masterFileId || MASTER_FILE_ID_RB).headcount;
  } catch (e) {
    Logger.log('⚠️ Master: เข้าไฟล์ไม่ได้ (' + e.message + ') → ข้าม (รายงานยังออกได้)');
    return null;
  }
}

function debugDumpMaster(masterFileId) {
  var hc = readMasterHeadcount(masterFileId);
  if (!hc) { Logger.log('Master: not available'); return null; }
  Logger.log('Active: %s  |  PSA %s  LL %s  รวม %s',
    hc.active, hc.PSA.total, hc.LL.total, hc.PSA.total + hc.LL.total);
  Logger.log('PSA byPos: %s', JSON.stringify(hc.PSA.byPos));
  Logger.log('LL  byPos: %s', JSON.stringify(hc.LL.byPos));
  return hc;
}
