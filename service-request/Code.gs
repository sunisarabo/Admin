/**
 * ============================================================================
 * Service Request Ticketing — Production Backend (Web App)
 * ----------------------------------------------------------------------------
 * Single source of truth — แทนที่ AppsScript_Code.gs และ WebApp_Backend.gs เก่า
 *
 * Owner   : Admin-PSA (hktadminpsa@aotga.com)
 * Version : v3.1  (2026-05-28)
 *   - ลบขั้นตอน "Requester Information" ออกจากฟอร์ม
 *   - ดึงข้อมูลผู้ส่งคำร้องจาก Session (Google login) + Staff Roster อัตโนมัติ
 *   - เพิ่ม Sheet "09_Staff_Roster" + seed 6 รายชื่อเริ่มต้น (แก้ไขเพิ่มเติมได้)
 * ============================================================================
 */

const CFG = {
  SPREADSHEET_ID: 'PUT_YOUR_SHEET_ID_HERE',  // ← แก้ก่อน deploy
  ADMIN_EMAILS_FALLBACK: ['hktadminpsa@aotga.com'],
  APP_NAME: 'Service Request Ticketing',
  APP_NAME_TH: 'ระบบคำร้องส่วนกลาง',
  TIME_ZONE: 'Asia/Bangkok',
  WEB_APP_URL: '',  // ใส่ URL หลัง Deploy → ใช้ใน Email reply ของ EmailIntake

  WEBHOOKS: {
    WEBHOOK_HR: '', WEBHOOK_FIN: '', WEBHOOK_PRC: '',
    WEBHOOK_MNT: '', WEBHOOK_AST: '', WEBHOOK_IT: '',
    WEBHOOK_DOC: '', WEBHOOK_COR: '', WEBHOOK_ADMIN: ''
  },

  SH: {
    DEPARTMENTS:    '01_Departments',
    CATEGORIES:     '02_Main_Categories',
    SUBCATS:        '03_Sub_Categories',
    DYNAMIC:        '04_Dynamic_Fields',
    ROUTING:        '05_Routing_Matrix',
    PRIORITY:       '06_Priority',
    ATTACHMENT:     '07_Attachment_Rules',
    STATUS:         '08_Status_Lifecycle',
    STAFF:          '09_Staff_Roster',
    ADMINS:         '10_Admins',
    STAGES:         '11_Workflow_Stages',
    ASSIGNMENT:     '12_Assignment_Rules',
    CHECKLIST_TMPL: '13_Checklist_Templates',
    TICKETS:        'Tickets',
    AUDIT:          'AuditLog'
  },

  // mapping จากชื่อแผนกภาษาไทย (ใน Staff Roster) → Dept_Code ใน routing
  DEPT_TH_TO_CODE: {
    'การโดยสาร ภูเก็ต': 'KP',
    'บริการพิเศษ ภูเก็ต': 'LP',
    'ติดตามสัมภาระ ภูเก็ต': 'LL'
  },

  STAFF_COLUMNS: [
    'Emp_Code', 'Title_TH', 'First_TH', 'Last_TH',
    'Department_TH', 'Dept_Code', 'Position', 'Nickname',
    'Email', 'Active'
  ],

  // seed รายชื่อพนักงานเริ่มต้น (แก้ Email เพิ่มเติมได้ใน Sheet โดยตรง)
  // ทุกคนใช้ hktadminpsa@aotga.com เป็น shared inbox สำหรับรับ notification
  // ส่วนไอซ์มี admin email แยก (sunisara.bo@aotga.com) — ดูใน 10_Admins
  STAFF_SEED: [
    ['2100935', 'นางสาว', 'พัชรินทร์',  'กริชสั้น',      'การโดยสาร ภูเก็ต',     'KP', 'Senior Administrative Officer', 'นัตตี้', 'hktadminpsa@aotga.com', 'yes'],
    ['2202011', 'นางสาว', 'สุนิศรา',    'บุญยัง',        'การโดยสาร ภูเก็ต',     'KP', 'Administrative Supervisor',     'ไอซ์',   'hktadminpsa@aotga.com', 'yes'],
    ['2506243', 'นาย',    'พุฒิพงษ์',  'ทิพย์เขต',      'การโดยสาร ภูเก็ต',     'KP', 'Administrative Officer',        'แม็ค',   'hktadminpsa@aotga.com', 'yes'],
    ['2506762', 'นางสาว', 'กาญจนาพร',  'เภรินทวงค์',    'การโดยสาร ภูเก็ต',     'KP', 'Administrative Officer',        'ฟลุ๊ค',  'hktadminpsa@aotga.com', 'yes'],
    ['2302860', 'นางสาว', 'ศิโรรัตน์',  'สุวรรณรัตน์',   'ติดตามสัมภาระ ภูเก็ต', 'LL', 'Administrative Officer',        'บีม',    'hktadminpsa@aotga.com', 'yes'],
    ['2506761', 'นาย',    'พัทธพล',    'พานิช',         'ติดตามสัมภาระ ภูเก็ต', 'LL', 'Administrative Officer',        'ออย',    'hktadminpsa@aotga.com', 'yes']
  ],

  TICKET_COLUMNS: [
    'Ticket_ID', 'Created_At', 'Requester_Email', 'Requester_Name',
    'Requester_Emp_Code', 'Requester_Nickname',
    'Dept_Code', 'Cat_Code', 'Sub_Code', 'Sub_Name_TH',
    'Priority', 'Subject', 'Detail',
    'Dynamic_Payload_JSON', 'Attachment_URLs',
    'Stage', 'Owner_Team', 'Assigned_To_Email', 'Assigned_To_Name',
    'Assigned_At', 'Stages_History_JSON', 'Checklist_JSON',
    'Internal_Notes', 'Updated_At', 'Closed_At', 'Resolution_Note'
  ],

  AUDIT_COLUMNS: ['Time', 'User_Email', 'Ticket_ID', 'Action', 'Details']
};

// ============================================================================
// WEB APP ENTRY
// ============================================================================
function doGet(e) {
  const tpl = HtmlService.createTemplateFromFile('Index');
  const userEmail = Session.getActiveUser().getEmail() || '';
  tpl.userEmail = userEmail;
  tpl.isAdmin = isAdmin_(userEmail);
  tpl.appName = CFG.APP_NAME;
  tpl.appNameTH = CFG.APP_NAME_TH;
  tpl.initialPage = (e && e.parameter && e.parameter.page) || 'form';
  return tpl.evaluate()
    .setTitle(CFG.APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================================
// MASTER DATA
// ============================================================================
function getMasterData() {
  const ss = openSS_();
  const me = Session.getActiveUser().getEmail() || '';
  return {
    departments:    readSheet_(ss, CFG.SH.DEPARTMENTS),
    categories:     readSheet_(ss, CFG.SH.CATEGORIES),
    subCategories:  readSheet_(ss, CFG.SH.SUBCATS),
    dynamicFields:  readSheet_(ss, CFG.SH.DYNAMIC),
    priorities:     readSheet_(ss, CFG.SH.PRIORITY),
    attachmentRules:readSheet_(ss, CFG.SH.ATTACHMENT),
    statuses:       readSheet_(ss, CFG.SH.STATUS),
    admins:         readSheet_(ss, CFG.SH.ADMINS).filter(a => String(a.Active).toLowerCase()==='yes'),
    stages:         readSheet_(ss, CFG.SH.STAGES),
    assignmentRules:readSheet_(ss, CFG.SH.ASSIGNMENT),
    checklistTmpl:  readSheet_(ss, CFG.SH.CHECKLIST_TMPL),
    userEmail:      me,
    isAdmin:        isAdmin_(me),
    currentUser:    getCurrentUserProfile_(ss, me)
  };
}

/**
 * คืน profile ของ user ปัจจุบันจาก Staff Roster
 *   - matches: รายการ staff record ทุกตัวที่ Email ตรงกัน (อาจมีหลายคนใช้อีเมลร่วมกัน)
 *   - default: record แรก (ใช้เป็นค่าเริ่มต้น frontend สามารถให้ผู้ใช้เลือกเปลี่ยนได้)
 */
function getCurrentUserProfile_(ss, email) {
  if (!email) return { email: '', matches: [], default: null };
  const all = readSheet_(ss, CFG.SH.STAFF).filter(s => String(s.Active).toLowerCase()==='yes');
  const matches = all.filter(s => String(s.Email).toLowerCase() === email.toLowerCase());
  return {
    email: email,
    matches: matches,
    default: matches.length ? matches[0] : null
  };
}

// web-callable wrapper สำหรับ frontend refresh profile หลัง login
function getCurrentUserProfile() {
  const ss = openSS_();
  const me = Session.getActiveUser().getEmail() || '';
  return getCurrentUserProfile_(ss, me);
}

// ============================================================================
// SUBMIT TICKET
// ============================================================================
/**
 * รับ payload จาก frontend:
 *   - empCode (optional, ใช้กรณีหลายคนใช้อีเมลร่วมกัน — frontend ส่งมาให้รู้ว่าใครเป็นคนกรอก)
 *   - catCode, subCode, priority, subject, detail (required)
 *   - dynamicFields, attachmentLinks (optional)
 *
 * Requester (name/email/dept) จะถูก resolve จาก Session + Staff Roster อัตโนมัติ
 */
function submitTicket(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = openSS_();
    let sh = ss.getSheetByName(CFG.SH.TICKETS);
    if (!sh) sh = createTicketsSheet_(ss);

    // resolve requester from session + staff roster
    const requesterEmail = Session.getActiveUser().getEmail() || '';
    if (!requesterEmail) return { ok: false, error: 'ไม่พบอีเมลผู้ใช้ — กรุณา login ก่อน / Cannot resolve signed-in email' };

    const profile = getCurrentUserProfile_(ss, requesterEmail);
    let staff = null;
    if (payload.empCode) {
      staff = profile.matches.find(m => String(m.Emp_Code) === String(payload.empCode)) || profile.default;
    } else {
      staff = profile.default;
    }
    if (!staff) return { ok: false, error: 'ไม่พบรายชื่อพนักงานใน Staff Roster สำหรับ: ' + requesterEmail };

    const requesterName = (staff.Title_TH || '') + staff.First_TH + ' ' + staff.Last_TH;
    const deptCode = staff.Dept_Code || CFG.DEPT_TH_TO_CODE[staff.Department_TH] || '';

    // validate required (ลด requesterName/Email/Dept ออก เพราะมาจาก roster)
    const required = ['catCode', 'subCode', 'priority', 'subject', 'detail'];
    for (const k of required) {
      if (!payload[k]) return { ok: false, error: 'ขาดข้อมูล / Missing field: ' + k };
    }
    if (!deptCode) return { ok: false, error: 'ไม่สามารถระบุ Dept_Code จากแผนกของพนักงาน: ' + staff.Department_TH };

    const ticketId = generateTicketId_(deptCode, payload.catCode);
    const now = new Date();
    const subName = lookupSubName_(ss, payload.subCode);

    // initial stage = S1
    const stagesHistory = [{
      stage: 'S1_Received',
      at: now.toISOString(),
      by: requesterEmail,
      note: 'Ticket submitted via Web App'
    }];

    // build initial checklist from template
    const checklist = buildInitialChecklist_(ss, payload.catCode);

    // auto-assign
    const assignee = autoAssignAdmin_(ss, payload.catCode);

    sh.appendRow([
      ticketId, now, requesterEmail, requesterName,
      staff.Emp_Code || '', staff.Nickname || '',
      deptCode, payload.catCode, payload.subCode, subName,
      payload.priority, payload.subject, payload.detail,
      JSON.stringify(payload.dynamicFields || {}),
      (payload.attachmentLinks || []).join('\n'),
      'S1_Received',
      lookupOwnerTeam_(ss, payload.subCode),
      assignee ? assignee.email : '',
      assignee ? assignee.name : '',
      assignee ? now : '',
      JSON.stringify(stagesHistory),
      JSON.stringify(checklist),
      '', now, '', ''
    ]);

    audit_(requesterEmail, ticketId, 'CREATE', 'Cat=' + payload.catCode + ' Sub=' + payload.subCode + ' Prio=' + payload.priority + ' Emp=' + (staff.Emp_Code || ''));

    // build resolved payload สำหรับ notification helpers (ใช้ key เดิม)
    const resolved = Object.assign({}, payload, {
      requesterEmail: requesterEmail,
      requesterName: requesterName,
      deptCode: deptCode
    });

    // notifications (silent fail)
    safeCall_(() => notifyAdmin_(ticketId, resolved, subName, assignee));
    safeCall_(() => notifyAssignee_(ticketId, resolved, subName, assignee));
    safeCall_(() => notifyOwnerTeam_(ss, ticketId, resolved, subName));
    safeCall_(() => sendAck_(resolved, ticketId, subName));

    return {
      ok: true,
      ticketId: ticketId,
      assignedTo: assignee ? assignee.name : 'Unassigned',
      requester: { name: requesterName, email: requesterEmail, dept: deptCode, empCode: staff.Emp_Code }
    };
  } catch (err) {
    Logger.log('submitTicket error: ' + err.stack);
    return { ok: false, error: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ============================================================================
// LOOKUP TICKET (Track Status)
// ============================================================================
function lookupTicket(query) {
  const ss = openSS_();
  const sh = ss.getSheetByName(CFG.SH.TICKETS);
  if (!sh) return { ok: false, error: 'ยังไม่มี ticket ในระบบ / No tickets yet' };
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return { ok: false, error: 'ยังไม่มี ticket / No tickets' };

  const headers = v[0];
  const q = String(query || '').trim().toUpperCase();
  if (!q) return { ok: false, error: 'กรุณาใส่ Ticket ID หรือ Email' };

  const matched = v.slice(1).filter(r => {
    if (!r[0]) return false;
    const id = String(r[0]).toUpperCase();
    const email = String(r[2] || '').toUpperCase();
    return id === q || email === q || id.indexOf(q) >= 0;
  });

  if (!matched.length) return { ok: false, error: 'ไม่พบ ticket / Ticket not found' };

  const tickets = matched.slice(0, 50).map(r => rowToObject_(headers, r));
  return { ok: true, tickets: tickets };
}

// ============================================================================
// ADMIN DASHBOARD
// ============================================================================
function getDashboardData(filter) {
  const me = Session.getActiveUser().getEmail();
  if (!isAdmin_(me)) return { ok: false, error: 'Unauthorized — admin only' };

  filter = filter || {};
  const ss = openSS_();
  const sh = ss.getSheetByName(CFG.SH.TICKETS);
  if (!sh) return { ok: true, total: 0, byStage: {}, byCat: {}, workload: [], tickets: [] };
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return { ok: true, total: 0, byStage: {}, byCat: {}, workload: [], tickets: [] };

  const headers = v[0];
  let rows = v.slice(1).map(r => rowToObject_(headers, r));

  // filter
  if (filter.assignedToMe) rows = rows.filter(r => String(r.Assigned_To_Email).toLowerCase() === me.toLowerCase());
  if (filter.catCode)      rows = rows.filter(r => r.Cat_Code === filter.catCode);
  if (filter.deptCode)     rows = rows.filter(r => r.Dept_Code === filter.deptCode);
  if (filter.stage)        rows = rows.filter(r => r.Stage === filter.stage);

  // aggregations
  const openStages = ['S1_Received', 'S2_Reviewing', 'S3_Assigned', 'S4_Processing', 'S5_Sent'];
  const closingStages = ['S6_Closed', 'X_Cancelled', 'X_Rejected'];

  const byStage = {}, byCat = {}, byPriority = {}, workload = {};
  let openCount = 0, closedCount = 0, myOpen = 0, overdue = 0;
  const now = Date.now();
  const SLA_DAYS = { 'Normal': 3, 'Urgent': 1, 'Critical': 0.2 }; // 0.2d ~ 5 hrs

  rows.forEach(r => {
    byStage[r.Stage] = (byStage[r.Stage] || 0) + 1;
    byCat[r.Cat_Code] = (byCat[r.Cat_Code] || 0) + 1;
    byPriority[r.Priority] = (byPriority[r.Priority] || 0) + 1;
    if (r.Assigned_To_Email) workload[r.Assigned_To_Email] = (workload[r.Assigned_To_Email] || 0) + 1;

    const isOpen = openStages.indexOf(r.Stage) >= 0;
    if (isOpen) {
      openCount++;
      if (String(r.Assigned_To_Email).toLowerCase() === me.toLowerCase()) myOpen++;
      // overdue?
      const created = new Date(r.Created_At).getTime();
      const ageDays = (now - created) / (1000 * 60 * 60 * 24);
      const sla = SLA_DAYS[r.Priority] || 3;
      if (ageDays > sla) overdue++;
    }
    if (closingStages.indexOf(r.Stage) >= 0) closedCount++;
  });

  // workload → join with admins
  const admins = readSheet_(ss, CFG.SH.ADMINS).filter(a => String(a.Active).toLowerCase()==='yes');
  const workloadArr = admins.map(a => ({
    admin_id: a.Admin_ID,
    name: a.Display_Name,
    email: a.Email,
    focus: a.Department_Focus,
    load: workload[a.Email] || 0,
    max: parseInt(a.Max_Active_Tickets, 10) || 20
  }));

  // recent tickets sorted by created desc
  const recent = rows.slice().sort((a, b) => new Date(b.Created_At) - new Date(a.Created_At));

  return {
    ok: true,
    total: rows.length,
    open: openCount,
    closed: closedCount,
    myOpen: myOpen,
    overdue: overdue,
    byStage: byStage,
    byCat: byCat,
    byPriority: byPriority,
    workload: workloadArr,
    tickets: recent.slice(0, 200),
    me: me
  };
}

// ============================================================================
// OPERATIONS QUEUES (Distribution / Tracking / Handoff / Closing)
// ============================================================================
function getDistributionQueue() {
  if (!isAdmin_(Session.getActiveUser().getEmail())) return { ok: false, error: 'Unauthorized' };
  const ss = openSS_();
  const sh = ss.getSheetByName(CFG.SH.TICKETS);
  if (!sh) return { ok: true, tickets: [] };
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return { ok: true, tickets: [] };
  const headers = v[0];
  const tickets = v.slice(1).map(r => rowToObject_(headers, r))
    .filter(t => t.Stage === 'S1_Received' || !t.Assigned_To_Email)
    .sort((a, b) => new Date(a.Created_At) - new Date(b.Created_At));
  return { ok: true, tickets: tickets };
}

function getTrackingQueue() {
  if (!isAdmin_(Session.getActiveUser().getEmail())) return { ok: false, error: 'Unauthorized' };
  const ss = openSS_();
  const sh = ss.getSheetByName(CFG.SH.TICKETS);
  if (!sh) return { ok: true, tickets: [] };
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return { ok: true, tickets: [] };
  const headers = v[0];
  const active = ['S2_Reviewing', 'S3_Assigned', 'S4_Processing'];
  const tickets = v.slice(1).map(r => rowToObject_(headers, r))
    .filter(t => active.indexOf(t.Stage) >= 0);
  return { ok: true, tickets: tickets };
}

function getHandoffQueue() {
  if (!isAdmin_(Session.getActiveUser().getEmail())) return { ok: false, error: 'Unauthorized' };
  const ss = openSS_();
  const sh = ss.getSheetByName(CFG.SH.TICKETS);
  if (!sh) return { ok: true, tickets: [] };
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return { ok: true, tickets: [] };
  const headers = v[0];
  const tickets = v.slice(1).map(r => rowToObject_(headers, r))
    .filter(t => t.Stage === 'S5_Sent');
  return { ok: true, tickets: tickets };
}

function getClosingQueue() {
  if (!isAdmin_(Session.getActiveUser().getEmail())) return { ok: false, error: 'Unauthorized' };
  const ss = openSS_();
  const sh = ss.getSheetByName(CFG.SH.TICKETS);
  if (!sh) return { ok: true, readyToClose: [], closedRecent: [] };
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return { ok: true, readyToClose: [], closedRecent: [] };
  const headers = v[0];
  const all = v.slice(1).map(r => rowToObject_(headers, r));

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const readyToClose = all.filter(t => {
    if (t.Stage !== 'S5_Sent') return false;
    try {
      const cl = JSON.parse(t.Checklist_JSON || '[]');
      const req = cl.filter(c => c.required);
      if (!req.length) return false;
      return req.every(c => c.done);
    } catch (e) { return false; }
  });
  const closedRecent = all.filter(t =>
    ['S6_Closed', 'X_Cancelled', 'X_Rejected'].indexOf(t.Stage) >= 0
    && new Date(t.Closed_At || t.Updated_At || 0).getTime() > sevenDaysAgo
  ).sort((a, b) => new Date(b.Closed_At || b.Updated_At) - new Date(a.Closed_At || a.Updated_At));

  return { ok: true, readyToClose: readyToClose, closedRecent: closedRecent };
}

// ============================================================================
// ASSIGNMENT
// ============================================================================
function assignTicket(ticketId, adminEmail) {
  if (!isAdmin_(Session.getActiveUser().getEmail())) return { ok: false, error: 'Unauthorized' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = openSS_();
    const sh = ss.getSheetByName(CFG.SH.TICKETS);
    const v = sh.getDataRange().getValues();
    const headers = v[0];
    const idCol = headers.indexOf('Ticket_ID');
    const emailCol = headers.indexOf('Assigned_To_Email');
    const nameCol = headers.indexOf('Assigned_To_Name');
    const atCol = headers.indexOf('Assigned_At');
    const stageCol = headers.indexOf('Stage');
    const historyCol = headers.indexOf('Stages_History_JSON');
    const updCol = headers.indexOf('Updated_At');

    const admins = readSheet_(ss, CFG.SH.ADMINS);
    const admin = admins.find(a => String(a.Email).toLowerCase() === String(adminEmail).toLowerCase());
    if (!admin) return { ok: false, error: 'Admin not found: ' + adminEmail };

    for (let i = 1; i < v.length; i++) {
      if (v[i][idCol] === ticketId) {
        const row = i + 1;
        sh.getRange(row, emailCol + 1).setValue(admin.Email);
        sh.getRange(row, nameCol + 1).setValue(admin.Display_Name);
        sh.getRange(row, atCol + 1).setValue(new Date());
        sh.getRange(row, updCol + 1).setValue(new Date());

        const curStage = v[i][stageCol];
        if (curStage === 'S1_Received' || curStage === 'S2_Reviewing') {
          sh.getRange(row, stageCol + 1).setValue('S3_Assigned');
          const history = JSON.parse(v[i][historyCol] || '[]');
          history.push({ stage: 'S3_Assigned', at: new Date().toISOString(), by: Session.getActiveUser().getEmail(), note: 'Assigned to ' + admin.Display_Name });
          sh.getRange(row, historyCol + 1).setValue(JSON.stringify(history));
        }

        audit_(Session.getActiveUser().getEmail(), ticketId, 'ASSIGN', 'To=' + admin.Email);
        safeCall_(() => sendAssignmentEmail_(ticketId, admin, v[i], headers));
        return { ok: true, assignedTo: admin.Display_Name };
      }
    }
    return { ok: false, error: 'Ticket not found' };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/**
 * Assign ticket ให้พนักงานในทีม (ไม่ใช่ admin) — lookup จาก Staff Roster ด้วย Emp_Code
 *   - Assigned_To_Email = staff.Email (shared inbox)
 *   - Assigned_To_Name = "ชื่อเล่น — ชื่อ สกุล"
 *   - notification ส่งไปที่ staff.Email
 *
 * ใช้สำหรับ workflow: ไอซ์ (supervisor) login → กด "Assign to นัตตี้" →
 * ระบบบันทึกชื่อ + เด้ง email ไป shared inbox
 */
function assignTicketToStaff(ticketId, empCode) {
  if (!isAdmin_(Session.getActiveUser().getEmail())) return { ok: false, error: 'Unauthorized' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = openSS_();
    const sh = ss.getSheetByName(CFG.SH.TICKETS);
    const v = sh.getDataRange().getValues();
    const headers = v[0];
    const idCol = headers.indexOf('Ticket_ID');
    const emailCol = headers.indexOf('Assigned_To_Email');
    const nameCol = headers.indexOf('Assigned_To_Name');
    const atCol = headers.indexOf('Assigned_At');
    const stageCol = headers.indexOf('Stage');
    const historyCol = headers.indexOf('Stages_History_JSON');
    const updCol = headers.indexOf('Updated_At');

    const staff = readSheet_(ss, CFG.SH.STAFF).find(s => String(s.Emp_Code) === String(empCode));
    if (!staff) return { ok: false, error: 'Staff not found: ' + empCode };
    const displayName = (staff.Nickname ? staff.Nickname + ' — ' : '') + staff.First_TH + ' ' + staff.Last_TH;

    for (let i = 1; i < v.length; i++) {
      if (v[i][idCol] === ticketId) {
        const row = i + 1;
        sh.getRange(row, emailCol + 1).setValue(staff.Email);
        sh.getRange(row, nameCol + 1).setValue(displayName);
        sh.getRange(row, atCol + 1).setValue(new Date());
        sh.getRange(row, updCol + 1).setValue(new Date());

        const curStage = v[i][stageCol];
        if (curStage === 'S1_Received' || curStage === 'S2_Reviewing') {
          sh.getRange(row, stageCol + 1).setValue('S3_Assigned');
          const history = JSON.parse(v[i][historyCol] || '[]');
          history.push({ stage: 'S3_Assigned', at: new Date().toISOString(), by: Session.getActiveUser().getEmail(), note: 'Assigned to ' + displayName + ' (' + empCode + ')' });
          sh.getRange(row, historyCol + 1).setValue(JSON.stringify(history));
        }

        audit_(Session.getActiveUser().getEmail(), ticketId, 'ASSIGN_STAFF', 'Emp=' + empCode + ' Name=' + displayName + ' To=' + staff.Email);
        safeCall_(() => sendStaffAssignmentEmail_(ticketId, staff, displayName, v[i], headers));
        return { ok: true, assignedTo: displayName, email: staff.Email };
      }
    }
    return { ok: false, error: 'Ticket not found' };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

// ============================================================================
// ADVANCE STAGE
// ============================================================================
function advanceStage(ticketId, newStage, note) {
  if (!isAdmin_(Session.getActiveUser().getEmail())) return { ok: false, error: 'Unauthorized' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = openSS_();
    const sh = ss.getSheetByName(CFG.SH.TICKETS);
    const v = sh.getDataRange().getValues();
    const headers = v[0];
    const idCol = headers.indexOf('Ticket_ID');
    const stageCol = headers.indexOf('Stage');
    const historyCol = headers.indexOf('Stages_History_JSON');
    const updCol = headers.indexOf('Updated_At');
    const closedCol = headers.indexOf('Closed_At');
    const resCol = headers.indexOf('Resolution_Note');

    for (let i = 1; i < v.length; i++) {
      if (v[i][idCol] === ticketId) {
        const row = i + 1;
        sh.getRange(row, stageCol + 1).setValue(newStage);
        sh.getRange(row, updCol + 1).setValue(new Date());
        const history = JSON.parse(v[i][historyCol] || '[]');
        history.push({ stage: newStage, at: new Date().toISOString(), by: Session.getActiveUser().getEmail(), note: note || '' });
        sh.getRange(row, historyCol + 1).setValue(JSON.stringify(history));

        if (['S6_Closed', 'X_Cancelled', 'X_Rejected'].indexOf(newStage) >= 0) {
          sh.getRange(row, closedCol + 1).setValue(new Date());
          if (note) sh.getRange(row, resCol + 1).setValue(note);
        }
        audit_(Session.getActiveUser().getEmail(), ticketId, 'STAGE', 'To=' + newStage + ' Note=' + (note || ''));
        return { ok: true, stage: newStage };
      }
    }
    return { ok: false, error: 'Ticket not found' };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

// ============================================================================
// CHECKLIST
// ============================================================================
function toggleChecklistItem(ticketId, itemIndex, done) {
  if (!isAdmin_(Session.getActiveUser().getEmail())) return { ok: false, error: 'Unauthorized' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = openSS_();
    const sh = ss.getSheetByName(CFG.SH.TICKETS);
    const v = sh.getDataRange().getValues();
    const headers = v[0];
    const idCol = headers.indexOf('Ticket_ID');
    const ckCol = headers.indexOf('Checklist_JSON');
    const updCol = headers.indexOf('Updated_At');

    for (let i = 1; i < v.length; i++) {
      if (v[i][idCol] === ticketId) {
        const row = i + 1;
        const list = JSON.parse(v[i][ckCol] || '[]');
        if (itemIndex < 0 || itemIndex >= list.length) return { ok: false, error: 'Invalid index' };
        list[itemIndex].done = !!done;
        list[itemIndex].done_at = done ? new Date().toISOString() : '';
        list[itemIndex].done_by = done ? Session.getActiveUser().getEmail() : '';
        sh.getRange(row, ckCol + 1).setValue(JSON.stringify(list));
        sh.getRange(row, updCol + 1).setValue(new Date());
        audit_(Session.getActiveUser().getEmail(), ticketId, 'CHECKLIST', 'Item=' + itemIndex + ' Done=' + done);
        return { ok: true, checklist: list };
      }
    }
    return { ok: false, error: 'Ticket not found' };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

// ============================================================================
// INTERNAL NOTE
// ============================================================================
function addInternalNote(ticketId, note) {
  if (!isAdmin_(Session.getActiveUser().getEmail())) return { ok: false, error: 'Unauthorized' };
  const ss = openSS_();
  const sh = ss.getSheetByName(CFG.SH.TICKETS);
  const v = sh.getDataRange().getValues();
  const headers = v[0];
  const idCol = headers.indexOf('Ticket_ID');
  const noteCol = headers.indexOf('Internal_Notes');
  const updCol = headers.indexOf('Updated_At');

  for (let i = 1; i < v.length; i++) {
    if (v[i][idCol] === ticketId) {
      const row = i + 1;
      const prev = v[i][noteCol] || '';
      const stamp = '[' + Utilities.formatDate(new Date(), CFG.TIME_ZONE, 'yyyy-MM-dd HH:mm') + ' ' + Session.getActiveUser().getEmail() + ']';
      const next = prev + (prev ? '\n' : '') + stamp + ' ' + note;
      sh.getRange(row, noteCol + 1).setValue(next);
      sh.getRange(row, updCol + 1).setValue(new Date());
      audit_(Session.getActiveUser().getEmail(), ticketId, 'NOTE', note.substring(0, 80));
      return { ok: true };
    }
  }
  return { ok: false, error: 'Ticket not found' };
}

// ============================================================================
// INIT / UTILITY
// ============================================================================
function initSystem() {
  const ss = openSS_();
  if (!ss.getSheetByName(CFG.SH.TICKETS)) createTicketsSheet_(ss);
  if (!ss.getSheetByName(CFG.SH.AUDIT))   createAuditSheet_(ss);
  // seed master sheets 01-13 (รวม 09_Staff_Roster) — idempotent
  seedAllMasterSheets();
  Logger.log('✓ Init complete. Sheets ready (Tickets / AuditLog + master 01-13).');
  Logger.log('Web App URL: เปิดได้หลัง Deploy → New deployment');
}

function createTicketsSheet_(ss) {
  const sh = ss.insertSheet(CFG.SH.TICKETS);
  sh.appendRow(CFG.TICKET_COLUMNS);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, CFG.TICKET_COLUMNS.length)
    .setFontWeight('bold').setBackground('#0F2A4F').setFontColor('#FFFFFF');
  sh.setColumnWidth(1, 180); // Ticket_ID
  return sh;
}

function createAuditSheet_(ss) {
  const sh = ss.insertSheet(CFG.SH.AUDIT);
  sh.appendRow(CFG.AUDIT_COLUMNS);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, CFG.AUDIT_COLUMNS.length)
    .setFontWeight('bold').setBackground('#0F2A4F').setFontColor('#FFFFFF');
  return sh;
}

function createStaffSheet_(ss) {
  const sh = ss.insertSheet(CFG.SH.STAFF);
  sh.appendRow(CFG.STAFF_COLUMNS);
  CFG.STAFF_SEED.forEach(row => sh.appendRow(row));
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, CFG.STAFF_COLUMNS.length)
    .setFontWeight('bold').setBackground('#0F2A4F').setFontColor('#FFFFFF');
  sh.setColumnWidth(1, 100);  // Emp_Code
  sh.setColumnWidth(9, 220);  // Email
  return sh;
}

/**
 * Re-seed staff roster (idempotent: ข้าม Emp_Code ที่มีอยู่แล้ว)
 * เรียกเมื่อต้องการเติมรายชื่อตั้งต้นโดยไม่ทับของเดิม
 */
function seedStaffRoster() {
  const ss = openSS_();
  let sh = ss.getSheetByName(CFG.SH.STAFF);
  if (!sh) sh = createStaffSheet_(ss);
  const v = sh.getDataRange().getValues();
  const existing = new Set(v.slice(1).map(r => String(r[0])));
  let added = 0;
  CFG.STAFF_SEED.forEach(row => {
    if (!existing.has(String(row[0]))) { sh.appendRow(row); added++; }
  });
  Logger.log('seedStaffRoster: added ' + added + ' staff records.');
  return added;
}

function openSS_() {
  return SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
}

function readSheet_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const headers = v[0];
  return v.slice(1).map(r => rowToObject_(headers, r));
}

function rowToObject_(headers, row) {
  const o = {};
  headers.forEach((h, i) => {
    const val = row[i];
    o[h] = val instanceof Date ? val.toISOString() : val;
  });
  return o;
}

function isAdmin_(email) {
  if (!email) return false;
  try {
    const ss = openSS_();
    const sh = ss.getSheetByName(CFG.SH.ADMINS);
    if (sh) {
      const v = sh.getDataRange().getValues();
      const eCol = v[0].indexOf('Email');
      const aCol = v[0].indexOf('Active');
      for (let i = 1; i < v.length; i++) {
        if (String(v[i][eCol]).toLowerCase() === email.toLowerCase()
            && String(v[i][aCol]).toLowerCase() === 'yes') return true;
      }
    }
  } catch (e) { /* fall through */ }
  return CFG.ADMIN_EMAILS_FALLBACK.indexOf(email) >= 0;
}

function lookupSubName_(ss, subCode) {
  const sh = ss.getSheetByName(CFG.SH.SUBCATS);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][1] === subCode) return v[i][2];
  return subCode;
}

function lookupOwnerTeam_(ss, subCode) {
  const sh = ss.getSheetByName(CFG.SH.ROUTING);
  if (!sh) return '';
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][1] === subCode) return v[i][2];
  return '';
}

function generateTicketId_(dept, cat) {
  const year = new Date().getFullYear();
  const key = 'RUN_' + dept + '_' + cat + '_' + year;
  const props = PropertiesService.getScriptProperties();
  const cur = parseInt(props.getProperty(key) || '0', 10);
  const next = cur + 1;
  props.setProperty(key, String(next));
  return dept + '-' + year + '-' + cat + '-' + String(next).padStart(5, '0');
}

function buildInitialChecklist_(ss, catCode) {
  const all = readSheet_(ss, CFG.SH.CHECKLIST_TMPL);
  const def = all.filter(c => c.Cat_Code === '*');
  const cat = all.filter(c => c.Cat_Code === catCode);
  const merged = def.concat(cat);
  const stages = readSheet_(ss, CFG.SH.STAGES);
  const stageOrder = {};
  stages.forEach(s => stageOrder[s.Stage_Code] = parseInt(s.Order, 10));
  merged.sort((a, b) => {
    const so = (stageOrder[a.Stage_Code] || 99) - (stageOrder[b.Stage_Code] || 99);
    if (so !== 0) return so;
    return (parseInt(a.Order, 10) || 0) - (parseInt(b.Order, 10) || 0);
  });
  return merged.map(c => ({
    stage: c.Stage_Code,
    text_th: c.Item_TH,
    text_en: c.Item_EN,
    required: String(c.Required).toLowerCase() === 'yes',
    done: false,
    done_at: '',
    done_by: ''
  }));
}

function autoAssignAdmin_(ss, catCode) {
  const rules = readSheet_(ss, CFG.SH.ASSIGNMENT);
  const admins = readSheet_(ss, CFG.SH.ADMINS).filter(a => String(a.Active).toLowerCase()==='yes');
  const rule = rules.find(r => r.Cat_Code === catCode);
  if (!rule || String(rule.Auto_Assign).toLowerCase() !== 'yes') return null;

  const preferred = String(rule.Preferred_Admin_Emails || '').split(';').map(s => s.trim()).filter(Boolean);
  if (!preferred.length) return null;

  const tickets = ss.getSheetByName(CFG.SH.TICKETS);
  const workload = {};
  if (tickets) {
    const v = tickets.getDataRange().getValues();
    const headers = v[0];
    const emailCol = headers.indexOf('Assigned_To_Email');
    const stageCol = headers.indexOf('Stage');
    const open = ['S1_Received','S2_Reviewing','S3_Assigned','S4_Processing','S5_Sent'];
    for (let i = 1; i < v.length; i++) {
      if (open.indexOf(v[i][stageCol]) >= 0 && v[i][emailCol]) {
        workload[v[i][emailCol]] = (workload[v[i][emailCol]] || 0) + 1;
      }
    }
  }

  let candidates = preferred.map(e => {
    const a = admins.find(ad => String(ad.Email).toLowerCase() === e.toLowerCase());
    if (!a) return null;
    return {
      id: a.Admin_ID, name: a.Display_Name, email: a.Email,
      load: workload[a.Email] || 0,
      max: parseInt(a.Max_Active_Tickets, 10) || 20
    };
  }).filter(Boolean).filter(c => c.load < c.max);

  if (!candidates.length) {
    if (rule.Fallback_Admin_Email) {
      const a = admins.find(ad => String(ad.Email).toLowerCase() === String(rule.Fallback_Admin_Email).toLowerCase());
      if (a) return { id: a.Admin_ID, name: a.Display_Name, email: a.Email };
    }
    return null;
  }

  candidates.sort((a, b) => a.load - b.load);
  return candidates[0];
}

function audit_(userEmail, ticketId, action, details) {
  try {
    const ss = openSS_();
    let sh = ss.getSheetByName(CFG.SH.AUDIT);
    if (!sh) sh = createAuditSheet_(ss);
    sh.appendRow([new Date(), userEmail || '', ticketId || '', action, details || '']);
  } catch (e) { Logger.log('audit error: ' + e); }
}

function safeCall_(fn) { try { fn(); } catch (e) { Logger.log('safeCall: ' + e); } }

// ============================================================================
// NOTIFICATIONS
// ============================================================================
function notifyAdmin_(ticketId, p, subName, assignee) {
  const url = CFG.WEBHOOKS.WEBHOOK_ADMIN;
  if (!url) return;
  const text = '*🎫 Ticket ใหม่* — ' + ticketId
    + '\n*แผนก:* ' + p.deptCode
    + '  *หมวด:* ' + p.subCode + ' (' + subName + ')'
    + '\n*Priority:* ' + p.priority
    + '\n*หัวเรื่อง:* ' + p.subject
    + '\n*ผู้ส่ง:* ' + p.requesterName + ' <' + p.requesterEmail + '>'
    + (assignee ? '\n*Auto-assigned to:* ' + assignee.name : '\n*Assignment:* ยังไม่มี (รอ Admin จัดสรร)');
  postWebhook_(url, text);
}

function notifyAssignee_(ticketId, p, subName, assignee) {
  if (!assignee) return;
  MailApp.sendEmail({
    to: assignee.email,
    subject: '[Assigned] ' + ticketId + ' — ' + p.subject,
    htmlBody: '<p>คุณได้รับมอบหมาย ticket ใหม่</p>'
      + '<ul>'
      + '<li>Ticket: <b>' + ticketId + '</b></li>'
      + '<li>แผนกผู้ส่ง: ' + p.deptCode + '</li>'
      + '<li>หมวด: ' + subName + '</li>'
      + '<li>Priority: <b>' + p.priority + '</b></li>'
      + '<li>หัวเรื่อง: ' + p.subject + '</li>'
      + '<li>ผู้ส่ง: ' + p.requesterName + '</li>'
      + '</ul>'
      + '<p>เปิดดูใน Web App → Admin Dashboard</p>'
  });
}

function notifyOwnerTeam_(ss, ticketId, p, subName) {
  const sh = ss.getSheetByName(CFG.SH.ROUTING);
  if (!sh) return;
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][1] === p.subCode) {
      const email = v[i][3];
      const cc = v[i][4];
      const webhookKey = v[i][5];
      const url = CFG.WEBHOOKS[webhookKey];
      if (url) postWebhook_(url, '*📨 ' + ticketId + ' — ' + p.subject + '*\nหมวด: ' + subName + '\nPriority: ' + p.priority);
      if (email) {
        MailApp.sendEmail({
          to: email, cc: cc || '',
          subject: '[' + p.priority + '] ' + ticketId + ' — ' + p.subject,
          htmlBody: '<p>มี ticket ใหม่ในขอบเขตของทีมคุณ</p><p>หมวด: ' + subName + '<br>ผู้ส่ง: ' + p.requesterName + '</p>'
        });
      }
      return;
    }
  }
}

function sendAck_(p, ticketId, subName) {
  if (!p.requesterEmail) return;
  MailApp.sendEmail({
    to: p.requesterEmail,
    subject: '[Service Request] รับคำร้องแล้ว — ' + ticketId,
    htmlBody: '<p>ระบบได้รับคำร้องของคุณเรียบร้อย / Your request has been received.</p>'
      + '<ul>'
      + '<li>Ticket: <b>' + ticketId + '</b></li>'
      + '<li>หมวด / Category: ' + subName + '</li>'
      + '<li>Priority: <b>' + p.priority + '</b></li>'
      + '</ul>'
      + '<p>ติดตามสถานะที่หน้า Track Status ของระบบ โดยใส่ Ticket ID ด้านบน</p>'
  });
}

function sendAssignmentEmail_(ticketId, admin, row, headers) {
  const subjCol = headers.indexOf('Subject');
  const prioCol = headers.indexOf('Priority');
  const reqCol = headers.indexOf('Requester_Name');
  MailApp.sendEmail({
    to: admin.Email,
    subject: '[Re-assigned] ' + ticketId + ' — ' + row[subjCol],
    htmlBody: '<p>มี ticket มอบหมายมาให้คุณ</p>'
      + '<ul>'
      + '<li>Ticket: <b>' + ticketId + '</b></li>'
      + '<li>Priority: <b>' + row[prioCol] + '</b></li>'
      + '<li>ผู้ส่ง: ' + row[reqCol] + '</li>'
      + '</ul>'
  });
}

function sendStaffAssignmentEmail_(ticketId, staff, displayName, row, headers) {
  const subjCol = headers.indexOf('Subject');
  const prioCol = headers.indexOf('Priority');
  const reqCol = headers.indexOf('Requester_Name');
  const subCol = headers.indexOf('Sub_Name_TH');
  MailApp.sendEmail({
    to: staff.Email,
    subject: '[Assigned · ' + (staff.Nickname || displayName) + '] ' + ticketId + ' — ' + row[subjCol],
    htmlBody: '<p>มี ticket มอบหมายให้ <b>' + displayName + '</b> (รหัส ' + staff.Emp_Code + ')</p>'
      + '<ul>'
      + '<li>Ticket: <b>' + ticketId + '</b></li>'
      + '<li>หมวด: ' + row[subCol] + '</li>'
      + '<li>Priority: <b>' + row[prioCol] + '</b></li>'
      + '<li>ผู้ส่ง: ' + row[reqCol] + '</li>'
      + '</ul>'
      + '<p>เปิดดูใน Web App → Track Status หรือ Admin Dashboard</p>'
  });
}

function postWebhook_(url, text) {
  UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ text: text }), muteHttpExceptions: true
  });
}

// ============================================================================
// DAILY DIGEST (Trigger: time-based 7am)
// ============================================================================
function dailyDigest() {
  const data = getDashboardData({});
  if (!data.ok) return;
  const date = Utilities.formatDate(new Date(), CFG.TIME_ZONE, 'yyyy-MM-dd');
  let html = '<h3>Daily Open Tickets — ' + date + '</h3>'
    + '<p>Total open: <b>' + data.open + '</b> · Overdue: <b style="color:#dc2626">' + data.overdue + '</b> · Closed today: ' + data.closed + '</p>'
    + '<h4>Workload by Admin</h4><table border="1" cellpadding="6" cellspacing="0">'
    + '<tr><th>Admin</th><th>Focus</th><th>Load</th><th>Max</th></tr>';
  data.workload.forEach(w => html += '<tr><td>' + w.name + '</td><td>' + w.focus + '</td><td>' + w.load + '</td><td>' + w.max + '</td></tr>');
  html += '</table>';
  MailApp.sendEmail({ to: CFG.ADMIN_EMAILS_FALLBACK.join(','), subject: '[Ticketing] Daily Digest ' + date, htmlBody: html });
}
