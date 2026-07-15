/**
 * Reconcile.gs — MASTER-based OFF counting + MANPOWER/Crewsign overrides
 * =============================================================================
 * Ports the legacy v3.1 bot's strengths onto the SHARED reader layer.
 *
 * The shared reader (RosterReader.gs) only sees people who appear in today's
 * assignment file, so it cannot tell that someone is OFF (they simply aren't a
 * row). The legacy bot solved this by reconciling against the MASTER
 * establishment: every operational employee who is NOT found in today's file
 * counts as OFF. This module reproduces that, but instead of re-parsing each
 * team sheet it consumes the records already produced by
 * readRosterFromSpreadsheet() — matching employees by ID first, then by a
 * unique first name.
 *
 * It produces the "old-shape" aggregates the legacy Chat + PDF report expects:
 *   bucket = { Working, OT_OFF, Off, Sick, Vac, OT_PRE, OT_PRE_HRS,
 *              OT_POST, OT_POST_HRS, total }
 * where Working ALWAYS INCLUDES the OT_OFF people (people working on a day off).
 *
 * Public:
 *   reconcilePSA_(res, master)              -> { byPos, byTeam, totals, sickByTeamPos }
 *   reconManpowerOverride_(recon, ss, m)    -> mutate recon.byPos from MANPOWER tab
 *   reconCrewsignOverride_(recon, res, m)   -> mutate recon.byPos['Crewsign']
 *   reconRecomputeTotals_(recon)            -> recompute recon.totals from byPos
 *   reconAdaptLL_(ll)                       -> { byPos, totals, sickByPos } old-shape
 */

function reconNewBucket_() {
  return { Working: 0, OT_OFF: 0, Off: 0, Sick: 0, Vac: 0,
           OT_PRE: 0, OT_PRE_HRS: 0, OT_POST: 0, OT_POST_HRS: 0, total: 0 };
}

/** Translate a shared-reader record's bucket into the legacy classification. */
function reconBucketFromRecord_(rec) {
  var ot = rec.ot || 0;
  switch (rec.bucket) {
    case 'working': return { bucket: 'Working', otHrs: ot, otType: rec.otType || (ot > 0 ? 'POST' : null) };
    case 'ot_off':  return { bucket: 'OT_OFF',  otHrs: ot, otType: 'POST' };
    case 'sick':    return { bucket: 'Sick',    otHrs: 0,  otType: null };
    case 'vac':     return { bucket: 'Vac',     otHrs: 0,  otType: null };
    default:        return { bucket: 'Off',     otHrs: 0,  otType: null };
  }
}

/** Add one classified person to a bucket (Working always includes OT_OFF). */
function reconAddToBucket_(b, cls) {
  if (cls.bucket === 'Working') {
    b.Working++;
    if (cls.otHrs > 0) {
      if (cls.otType === 'PRE') { b.OT_PRE++; b.OT_PRE_HRS += cls.otHrs; }
      else                      { b.OT_POST++; b.OT_POST_HRS += cls.otHrs; }
    }
  } else if (cls.bucket === 'OT_OFF') {
    b.OT_OFF++; b.Working++;
    if (cls.otHrs > 0) { b.OT_POST++; b.OT_POST_HRS += cls.otHrs; }
  } else if (cls.bucket === 'Sick') {
    b.Sick++;
  } else if (cls.bucket === 'Vac') {
    b.Vac++;
  } else {
    b.Off++;
  }
}

function reconFirstName_(name) {
  var t = String(name || '').trim().split(/\s+/)[0] || '';
  return t.replace(/[.\-]+$/, '').toUpperCase();
}

/** Index the shared reader records by numeric ID and by (first) name. */
function reconIndexRecords_(res) {
  var byId = {}, byFirst = {};
  Object.keys(res.teams).forEach(function (t) {
    res.teams[t].records.forEach(function (r) {
      var digits = String(r.id || '').replace(/\D/g, '');
      if (digits.length >= 6 && digits.length <= 8 && !byId[digits]) byId[digits] = r;
      var fn = reconFirstName_(r.name);
      if (fn && fn.length >= 2 && !byFirst[fn]) byFirst[fn] = r;
    });
  });
  return { byId: byId, byFirst: byFirst };
}

function reconBucketTotal_(b) { b.total = b.Working + b.Sick + b.Off + b.Vac; return b; }

/**
 * MASTER-based reconciliation: walk every operational PSA employee, find their
 * record in today's file (ID → unique first name), classify, and tally. Absent
 * employees count as OFF.
 */
function reconcilePSA_(res, master) {
  var idx = reconIndexRecords_(res);
  var byPos = {}, byTeam = {}, sick = [];

  // first-name uniqueness within operational PSA master (avoid wrong matches)
  var fnCount = {};
  master.employees.forEach(function (e) {
    if (e.dept === 'PSA' && e.operational && e.firstName) fnCount[e.firstName] = (fnCount[e.firstName] || 0) + 1;
  });

  master.employees.forEach(function (e) {
    if (e.dept !== 'PSA' || !e.operational) return;
    var rec = idx.byId[e.id];
    if (!rec && e.firstName && fnCount[e.firstName] === 1 && idx.byFirst[e.firstName]) {
      rec = idx.byFirst[e.firstName];
    }
    var cls = rec ? reconBucketFromRecord_(rec) : { bucket: 'Off', otHrs: 0, otType: null };

    var pg = e.posGroup;
    if (!byPos[pg]) byPos[pg] = reconNewBucket_();
    reconAddToBucket_(byPos[pg], cls);
    var teamKey = e.team || '(no team)';
    if (!byTeam[teamKey]) byTeam[teamKey] = reconNewBucket_();
    reconAddToBucket_(byTeam[teamKey], cls);
    if (cls.bucket === 'Sick') sick.push({ team: e.team, pos: e.posGroup });
  });

  Object.keys(byPos).forEach(function (p) { reconBucketTotal_(byPos[p]); });
  Object.keys(byTeam).forEach(function (t) { reconBucketTotal_(byTeam[t]); });

  var recon = { byPos: byPos, byTeam: byTeam, totals: reconNewBucket_(), sickByTeamPos: sick };
  reconRecomputeTotals_(recon);
  return recon;
}

/** Sum byPos back into recon.totals (call after any override). */
function reconRecomputeTotals_(recon) {
  var T = reconNewBucket_();
  Object.keys(recon.byPos).forEach(function (p) {
    var b = recon.byPos[p];
    T.Working += b.Working; T.OT_OFF += b.OT_OFF; T.Off += b.Off; T.Sick += b.Sick; T.Vac += b.Vac;
    T.OT_PRE += b.OT_PRE; T.OT_PRE_HRS += b.OT_PRE_HRS; T.OT_POST += b.OT_POST; T.OT_POST_HRS += b.OT_POST_HRS;
  });
  reconBucketTotal_(T);
  recon.totals = T;
  return recon;
}

/**
 * Crewsign override — recount the Crewsign group straight from the shared
 * reader's crewsign records (which the master ID match usually misses, because
 * crewsign rows carry names not IDs). Absent crewsign staff (master count minus
 * matched) become OFF.
 */
function reconCrewsignOverride_(recon, res, master) {
  var counts = reconNewBucket_(), found = 0;
  Object.keys(res.teams).forEach(function (t) {
    if (t.toUpperCase().indexOf('CREW') < 0) return;
    res.teams[t].records.forEach(function (r) {
      reconAddToBucket_(counts, reconBucketFromRecord_(r));
      found++;
    });
  });
  if (found === 0) return;                                  // no crewsign sheet → keep reconciled value

  var masterCrew = master.employees.filter(function (e) {
    return e.dept === 'PSA' && e.operational && e.posGroup === 'Crewsign';
  }).length;
  var active = counts.Working + counts.Vac + counts.Sick;    // Working already includes OT_OFF
  counts.Off = Math.max(0, masterCrew - active);
  reconBucketTotal_(counts);
  recon.byPos['Crewsign'] = counts;
  Logger.log('  📋 Crewsign override: W=%s OT_OFF=%s Vac=%s Sick=%s Off=%s (master %s)',
             counts.Working, counts.OT_OFF, counts.Vac, counts.Sick, counts.Off, masterCrew);
}

/**
 * MANPOWER tab override — the assignment file's MANPOWER summary tab carries
 * authoritative ทำจริง / ลาป่วย / ลาพักร้อน counts per team grouping. Use those
 * numbers (they are HR ground truth) for the groups they cover.
 * (The shared reader SKIPS the MANPOWER sheet, so we read it here directly.)
 */
function reconManpowerOverride_(recon, ss, master) {
  var ws = ss.getSheetByName('MANPOWER');
  if (!ws) { Logger.log('  ⚠️ MANPOWER sheet ไม่พบ → ข้าม override'); return; }
  var rows = ws.getDataRange().getValues();
  if (rows.length < 5) return;

  var teamToGroup = [
    { match: /^\s*(team\s*)?\(?\s*PORTER\s*CREW(SIGN)?\s*\)?\s*$/i, posKey: 'Crewsign' },
    { match: /CREWSIGN/i,                                            posKey: 'Crewsign' },
    { match: /^\s*ADMIN\s*DOC/i,                                     posKey: 'AdminD' },
    { match: /^\s*ADMIN\s*PORTER\s*\/?\s*PORTER/i,                   posKey: 'Porter' },
    { match: /^\s*ADMIN\s*PORTER\s*$/i,                              posKey: 'Porter' },
    { match: /^\s*PORTER\s*$/i,                                      posKey: 'Porter' },
  ];

  var headerRowIdx = -1;
  for (var r = 0; r < Math.min(5, rows.length); r++) {
    var rowJoined = (rows[r] || []).map(String).join(' ');
    if (rowJoined.indexOf('ทำจริง') >= 0 || rowJoined.indexOf('On Roster') >= 0) { headerRowIdx = r; break; }
  }
  var dataStart = (headerRowIdx >= 0) ? headerRowIdx + 1 : 4;

  var col = { team: 0, total: 1, onRoster: 2, sick: 3, personal: 4,
              vacation: 5, maternity: 6, otherLeave: 7, training: 8, working: 9 };
  if (headerRowIdx >= 0) {
    var hdr = rows[headerRowIdx].map(function (v) { return String(v || '').trim(); });
    hdr.forEach(function (h, i) {
      if (h.indexOf('ทำจริง') >= 0)        col.working = i;
      else if (h.indexOf('ลาป่วย') >= 0)    col.sick = i;
      else if (h.indexOf('ลากิจ') >= 0)     col.personal = i;
      else if (h.indexOf('ลาพักร้อน') >= 0) col.vacation = i;
      else if (h.indexOf('ลาคลอด') >= 0)    col.maternity = i;
      else if (h.indexOf('ลาอื่น') >= 0)    col.otherLeave = i;
      else if (h.indexOf('อบรม') >= 0)      col.training = i;
      else if (h.indexOf('On Roster') >= 0 || h.indexOf('on roster') >= 0) col.onRoster = i;
      else if (h === 'ทั้งหมด' || h.indexOf('Total') >= 0) col.total = i;
    });
  }

  for (var r2 = dataStart; r2 < rows.length; r2++) {
    var row = rows[r2];
    var teamRaw = String(row[col.team] || '').trim();
    if (!teamRaw || teamRaw === 'รวม' || teamRaw.toUpperCase() === 'TOTAL') continue;

    var posKey = null;
    for (var i = 0; i < teamToGroup.length; i++) {
      if (teamToGroup[i].match.test(teamRaw)) { posKey = teamToGroup[i].posKey; break; }
    }
    if (!posKey) continue;

    var totalCount = parseInt(row[col.total], 10) || 0;
    var working    = parseInt(row[col.working], 10) || 0;
    var sick       = parseInt(row[col.sick], 10) || 0;
    var personal   = parseInt(row[col.personal] || 0, 10) || 0;
    var vacation   = parseInt(row[col.vacation] || 0, 10) || 0;
    var maternity  = parseInt(row[col.maternity] || 0, 10) || 0;
    var otherLeave = parseInt(row[col.otherLeave] || 0, 10) || 0;
    var totalLeave = personal + vacation + maternity + otherLeave;

    if (working === 0 && sick === 0 && totalLeave === 0 && totalCount === 0) continue;

    var groupTotal = totalCount;
    if (groupTotal === 0) {
      groupTotal = master.employees.filter(function (e) {
        return e.dept === 'PSA' && e.operational && e.posGroup === posKey;
      }).length;
    }

    var nc = reconNewBucket_();
    nc.Working = working;
    nc.Sick    = sick;
    nc.Vac     = totalLeave;
    nc.Off     = Math.max(0, groupTotal - working - sick - totalLeave);
    reconBucketTotal_(nc);

    Logger.log('  📋 MANPOWER override %s ("%s"): Total=%s W=%s Sick=%s Vac=%s Off=%s',
               posKey, teamRaw, groupTotal, working, sick, totalLeave, nc.Off);
    recon.byPos[posKey] = nc;
  }
}

/**
 * Adapt the shared LL reader output ({positions, totals, sections}) into the
 * legacy old-shape aggregates ({byPos, totals, sickByPos}). Trainees are
 * excluded (the legacy report does not count LL trainees), matching v3.1.
 */
function reconAdaptLL_(ll) {
  var byPos = {}, sick = [];
  if (!ll || !ll.positions) return { byPos: byPos, totals: reconNewBucket_(), sickByPos: sick };

  Object.keys(ll.positions).forEach(function (p) {
    if (p === 'Trainee') return;
    var a = ll.positions[p];
    var b = reconNewBucket_();
    b.Working = a.working + a.ot_off;          // Working includes OT_OFF
    b.OT_OFF = a.ot_off;
    b.Off = a.off; b.Sick = a.sick; b.Vac = a.leave;
    b.OT_PRE = a.otPre; b.OT_PRE_HRS = a.otPreHrs;
    b.OT_POST = a.otPost; b.OT_POST_HRS = a.otPostHrs;
    reconBucketTotal_(b);
    byPos[p] = b;
  });

  if (ll.sections) {
    Object.keys(ll.sections).forEach(function (s) {
      ll.sections[s].records.forEach(function (r) {
        if (r.bucket === 'sick' && r.posGroup !== 'Trainee') sick.push({ pos: r.posGroup, name: r.name });
      });
    });
  }

  var recon = { byPos: byPos, totals: reconNewBucket_(), sickByPos: sick };
  reconRecomputeTotals_(recon);
  return recon;
}
