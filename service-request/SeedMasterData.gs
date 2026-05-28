/**
 * ============================================================================
 * Seed Master Data — Sheets 01-13
 * ----------------------------------------------------------------------------
 * เรียก seedAllMasterSheets() เพื่อสร้าง + เติมข้อมูลเริ่มต้นทุก master sheet
 * ปลอดภัยที่จะเรียกซ้ำ: ถ้า sheet มีอยู่แล้วและมี data อยู่จะข้าม (idempotent)
 *
 * เพิ่ม/แก้ master data ได้ที่ Sheet โดยตรงหลังจาก seed แล้ว ไม่ต้องแก้โค้ด
 * ============================================================================
 */

const SEED = {
  '01_Departments': {
    columns: ['Dept_Code', 'Name_TH', 'Name_EN', 'Active'],
    rows: [
      ['KP', 'การโดยสาร',     'Passenger Services', 'yes'],
      ['LP', 'บริการพิเศษ',   'Special Services',   'yes'],
      ['LL', 'ติดตามสัมภาระ', 'Baggage Services',   'yes']
    ]
  },

  '02_Main_Categories': {
    columns: ['Cat_Code', 'Name_TH', 'Name_EN', 'Icon', 'Description', 'Active'],
    rows: [
      ['HR',  'บริหารงานบุคคล',        'HR & Manpower',     'users',       'พนักงาน OT เอกสารบุคคล',           'yes'],
      ['FIN', 'การเงิน บัญชี',          'Finance',           'wallet',      'จ่ายเงิน เงินทดรอง บัญชี',         'yes'],
      ['PRC', 'พัสดุ จัดซื้อ',           'Procurement',       'package',     'ซื้อของใหม่ Outsource เบิกพัสดุ',  'yes'],
      ['MNT', 'ซ่อมบำรุง อาคาร',        'Maintenance',       'wrench',      'แจ้งซ่อม PM ตรวจความปลอดภัย',      'yes'],
      ['AST', 'ทรัพย์สิน โอนย้าย',      'Asset / IT',        'monitor',     'โอนย้าย ตรวจนับ ประสาน IT',        'yes'],
      ['DOC', 'เอกสาร / Ramp Pass',    'Document & Pass',   'file-text',   'หนังสือราชการ บัตรเข้าพื้นที่',     'yes'],
      ['COR', 'ประชุม / ประสานงาน',     'Coordination',      'calendar',    'จัดประชุม Business Trip',          'yes'],
      ['OTH', 'งานอื่นๆ / กรณีพิเศษ',   'Other / Special',   'help-circle', 'งานนอกหมวด / Incident / ข้อเสนอแนะ','yes']
    ]
  },

  '03_Sub_Categories': {
    columns: ['Cat_Code', 'Sub_Code', 'Sub_Name_TH', 'Sub_Name_EN', 'Active'],
    rows: [
      ['HR',  'HR-1.1',  'สัญญาจ้าง / อัตรากำลัง',                'Employment Contract',           'yes'],
      ['HR',  'HR-1.2',  'ตารางกะและเวลาทำงาน',                  'Shift Roster',                  'yes'],
      ['HR',  'HR-1.3',  'ค่าล่วงเวลา (OT)',                      'Overtime',                       'yes'],
      ['HR',  'HR-1.4',  'สวัสดิการ / ทะเบียนประวัติ',             'Benefits & Records',             'yes'],
      ['FIN', 'FIN-2.1', 'เงินทดรองจ่าย / บัตรเครดิตบริษัท',       'Petty Cash / Corp Card',         'yes'],
      ['FIN', 'FIN-2.2', 'เบิกจ่ายงบประมาณ / เบี้ยเลี้ยง',          'Budget / Per Diem',              'yes'],
      ['FIN', 'FIN-2.3', 'บัญชี / ปรับปรุงงบประมาณ',                'Accounting / Budget Adjustment', 'yes'],
      ['PRC', 'PRC-3.1', 'จัดซื้อครุภัณฑ์สำนักงาน',                 'Office Equipment Purchase',      'yes'],
      ['PRC', 'PRC-3.2', 'วัสดุสิ้นเปลือง (Baggage Tag, etc.)',     'Consumables',                    'yes'],
      ['PRC', 'PRC-3.3', 'จัดจ้างและเช่าบริการ',                    'Outsource / Rental',             'yes'],
      ['PRC', 'PRC-3.4', 'ระบบ ERP / คลังพัสดุ',                    'ERP / Inventory',                'yes'],
      ['MNT', 'MNT-4.1', 'แจ้งซ่อมด่วน',                            'Urgent Repair',                  'yes'],
      ['MNT', 'MNT-4.2', 'PM / ตรวจความปลอดภัย',                   'PM / Safety Check',              'yes'],
      ['AST', 'AST-5.1', 'โอนย้ายทรัพย์สิน',                        'Asset Transfer',                 'yes'],
      ['AST', 'AST-5.2', 'โอนย้ายอุปกรณ์ IT',                       'IT Equipment Transfer',          'yes'],
      ['AST', 'AST-5.3', 'ตรวจนับทรัพย์สิน',                        'Asset Audit',                    'yes'],
      ['AST', 'AST-5.4', 'ระบบ IT / เครื่องพิมพ์',                  'IT / Printer',                   'yes'],
      ['DOC', 'DOC-6.1', 'Ramp Pass / สิทธิ์เข้าพื้นที่',            'Ramp Pass / Area Access',        'yes'],
      ['DOC', 'DOC-6.2', 'หนังสือติดต่อราชการ',                     'Government Correspondence',      'yes'],
      ['DOC', 'DOC-6.3', 'หนังสือภายใน / BeeECM',                  'Internal Memo / BeeECM',         'yes'],
      ['DOC', 'DOC-6.4', 'ทำลายเอกสาร',                            'Document Destruction',           'yes'],
      ['COR', 'COR-7.1', 'จัดประชุมภายในสถานี',                    'Internal Meeting',               'yes'],
      ['COR', 'COR-7.2', 'ประสานหน่วยงานสนับสนุน',                 'Coordinate Support Units',       'yes'],
      ['COR', 'COR-7.3', 'Business Trip ต่างประเทศ',                'Overseas Business Trip',         'yes'],
      ['OTH', 'OTH-8.1', 'คำร้องอื่นๆ ที่ไม่อยู่ในหมวด 1-7',         'Other Requests',                 'yes'],
      ['OTH', 'OTH-8.2', 'รายงานเหตุการณ์ / Incident Report',       'Incident Report',                'yes'],
      ['OTH', 'OTH-8.3', 'ข้อเสนอแนะ / ปรับปรุงระบบ',                'Suggestions / Improvement',      'yes']
    ]
  },

  // Dynamic_Fields: Options ใช้ ; เป็น separator (frontend split เอง)
  // Type: text | textarea | select | number | date
  '04_Dynamic_Fields': {
    columns: ['Cat_Code', 'Field_Order', 'Label_TH', 'Label_EN', 'Type', 'Options', 'Required'],
    rows: [
      ['FIN', 1, 'ชื่อสายการบิน',            'Airline',     'select', SEED_AIRLINES_(), 'yes'],
      ['FIN', 2, 'เลขเที่ยวบิน',              'Flight No.',  'text',   '',                'no'],
      ['FIN', 3, 'จำนวนเงิน (บาท)',          'Amount',      'number', '',                'yes'],
      ['FIN', 4, 'ช่องทางจ่าย',                'Payment',     'select', 'เงินสดทดรอง;บัตรเครดิตบริษัท;โอนเข้าบัญชี', 'yes'],
      ['MNT', 1, 'หมายเลขห้อง',                'Room',        'text',   '',                'yes'],
      ['MNT', 2, 'ประเภทอุปกรณ์',              'Equipment',   'select', 'แอร์;หลอดไฟ;ประตู;โต๊ะ/เก้าอี้;Wheelchair;วิทยุสื่อสาร;อื่นๆ', 'yes'],
      ['MNT', 3, 'หมายเลขครุภัณฑ์',            'Asset Number','text',   '',                'no'],
      ['MNT', 4, 'อาการเสีย',                  'Symptom',     'textarea','',               'yes'],
      ['HR',  1, 'รหัสพนักงาน',                'EMP ID',      'text',   '',                'yes'],
      ['HR',  2, 'ประเภทคำร้อง',                'Request Type','select', 'ยูนิฟอร์ม;ใบรับรองแพทย์;ใบรับรองเงินเดือน;หนังสือเตือน;อื่นๆ', 'yes'],
      ['PRC', 1, 'ชื่อรายการพัสดุ',             'Item Name',   'text',   '',                'yes'],
      ['PRC', 2, 'จำนวน',                       'Quantity',    'number', '',                'yes'],
      ['PRC', 3, 'งบที่ใช้',                     'Budget',      'text',   '',                'yes'],
      ['OTH', 1, 'ประเภทเหตุการณ์',             'Event Type',  'select', 'ผู้โดยสารร้องเรียน;อุบัติเหตุ (บุคลากร);อุบัติเหตุ (ผู้โดยสาร);ทรัพย์สินเสียหาย;ทุจริต;ความปลอดภัย Airside;อื่นๆ', 'no'],
      ['OTH', 2, 'วัน-เวลาที่เกิดเหตุ',           'Event Date',  'date',   '',                'no'],
      ['OTH', 3, 'สถานที่เกิดเหตุ',              'Location',    'text',   '',                'no'],
      ['OTH', 4, 'ทีมที่คาดว่าจะรับ',             'Expected Team','select', 'HR;FIN;PRC;MNT;AST;DOC;COR;ไม่แน่ใจ — Admin คัด', 'no']
    ]
  },

  '05_Routing_Matrix': {
    columns: ['Cat_Code', 'Sub_Code', 'Owner_Team', 'Email', 'CC', 'Webhook_Key'],
    rows: [
      ['HR',  'HR-1.1',  'HR Team',          '', '', 'WEBHOOK_HR'],
      ['HR',  'HR-1.2',  'HR Team',          '', '', 'WEBHOOK_HR'],
      ['HR',  'HR-1.3',  'HR Team',          '', '', 'WEBHOOK_HR'],
      ['HR',  'HR-1.4',  'HR Team',          '', '', 'WEBHOOK_HR'],
      ['FIN', 'FIN-2.1', 'Finance Team',     '', '', 'WEBHOOK_FIN'],
      ['FIN', 'FIN-2.2', 'Finance Team',     '', '', 'WEBHOOK_FIN'],
      ['FIN', 'FIN-2.3', 'Finance Team',     '', '', 'WEBHOOK_FIN'],
      ['PRC', 'PRC-3.1', 'Procurement Team', '', '', 'WEBHOOK_PRC'],
      ['PRC', 'PRC-3.2', 'Procurement Team', '', '', 'WEBHOOK_PRC'],
      ['PRC', 'PRC-3.3', 'Procurement Team', '', '', 'WEBHOOK_PRC'],
      ['PRC', 'PRC-3.4', 'Procurement Team', '', '', 'WEBHOOK_PRC'],
      ['MNT', 'MNT-4.1', 'Maintenance Team', '', '', 'WEBHOOK_MNT'],
      ['MNT', 'MNT-4.2', 'Maintenance Team', '', '', 'WEBHOOK_MNT'],
      ['AST', 'AST-5.1', 'Asset Team',       '', '', 'WEBHOOK_AST'],
      ['AST', 'AST-5.2', 'IT / Asset Team',  '', '', 'WEBHOOK_IT'],
      ['AST', 'AST-5.3', 'Asset Team',       '', '', 'WEBHOOK_AST'],
      ['AST', 'AST-5.4', 'IT Team',          '', '', 'WEBHOOK_IT'],
      ['DOC', 'DOC-6.1', 'Document Team',    '', '', 'WEBHOOK_DOC'],
      ['DOC', 'DOC-6.2', 'Document Team',    '', '', 'WEBHOOK_DOC'],
      ['DOC', 'DOC-6.3', 'Document Team',    '', '', 'WEBHOOK_DOC'],
      ['DOC', 'DOC-6.4', 'Document Team',    '', '', 'WEBHOOK_DOC'],
      ['COR', 'COR-7.1', 'Coordination',     '', '', 'WEBHOOK_COR'],
      ['COR', 'COR-7.2', 'Coordination',     '', '', 'WEBHOOK_COR'],
      ['COR', 'COR-7.3', 'Coordination',     '', '', 'WEBHOOK_COR'],
      ['OTH', 'OTH-8.1', 'Admin',            '', '', 'WEBHOOK_ADMIN'],
      ['OTH', 'OTH-8.2', 'Admin',            '', '', 'WEBHOOK_ADMIN'],
      ['OTH', 'OTH-8.3', 'Admin',            '', '', 'WEBHOOK_ADMIN']
    ]
  },

  '06_Priority': {
    columns: ['Code', 'Name_TH', 'Name_EN', 'SLA_Days', 'Color', 'Description'],
    rows: [
      ['Normal',   'ปกติ',     'Normal',   3,   '#10B981', 'งานทั่วไป — เสร็จภายใน 3 วันทำการ'],
      ['Urgent',   'เร่งด่วน',  'Urgent',   1,   '#F59E0B', 'เร่งด่วน — เสร็จภายใน 24 ชั่วโมง'],
      ['Critical', 'ฉุกเฉิน',   'Critical', 0.2, '#EF4444', 'ฉุกเฉิน — เสร็จภายใน 1-2 ชั่วโมง']
    ]
  },

  '07_Attachment_Rules': {
    columns: ['Cat_Code', 'Required', 'Max_Size_MB', 'Allowed_Types', 'Note'],
    rows: [
      ['*',   'no',  10, 'pdf;jpg;jpeg;png;xlsx;xls;docx;doc', 'Default — แนบไฟล์ทั่วไป'],
      ['FIN', 'yes', 10, 'pdf;jpg;jpeg;png',                    'ต้องแนบใบเสร็จ / ใบกำกับภาษี'],
      ['PRC', 'yes', 10, 'pdf;xlsx;xls;jpg;png',                'ต้องแนบใบเสนอราคา / สเปก'],
      ['DOC', 'yes', 10, 'pdf;docx;doc;jpg;png',                'ต้องแนบเอกสารต้นฉบับ'],
      ['MNT', 'no',  10, 'jpg;jpeg;png;mp4',                    'แนะนำให้แนบรูป / video อาการเสีย']
    ]
  },

  '08_Status_Lifecycle': {
    columns: ['Status_Code', 'Name_TH', 'Name_EN', 'Description', 'Is_Final'],
    rows: [
      ['OPEN',      'เปิด',    'Open',      'Ticket ที่ยังอยู่ในขั้นตอนใดๆ ระหว่าง S1-S5', 'no'],
      ['CLOSED',    'ปิด',     'Closed',    'งานเสร็จสมบูรณ์ ผู้ร้องได้รับผลลัพธ์',         'yes'],
      ['CANCELLED', 'ยกเลิก',  'Cancelled', 'ผู้ร้องยกเลิกคำร้องเอง',                       'yes'],
      ['REJECTED',  'ปฏิเสธ',  'Rejected',  'Admin ปฏิเสธคำร้อง พร้อมระบุเหตุผล',           'yes']
    ]
  },

  // 09_Staff_Roster ถูก seed โดย createStaffSheet_() ใน Code.gs

  // 10_Admins = ผู้ที่มีสิทธิ์เข้า Admin Dashboard / กระจายงาน
  //   - ไอซ์ login ด้วย sunisara.bo@aotga.com เพื่อ assign งานให้พนักงานในทีม
  //   - hktadminpsa@aotga.com เป็น shared inbox + fallback admin
  '10_Admins': {
    columns: ['Admin_ID', 'Display_Name', 'Email', 'Department_Focus', 'Max_Active_Tickets', 'Active'],
    rows: [
      ['ADM-01', 'ไอซ์ (Supervisor)',     'sunisara.bo@aotga.com', 'ทุกหมวด — กระจายงาน', 30, 'yes'],
      ['ADM-02', 'Admin-PSA (Shared)',    'hktadminpsa@aotga.com', 'Shared inbox',         50, 'yes']
    ]
  },

  '11_Workflow_Stages': {
    columns: ['Stage_Code', 'Name_TH', 'Name_EN', 'Order', 'Color', 'Description'],
    rows: [
      ['S1_Received',   'รับเรื่อง',         'Received',   1,  '#3B82F6', 'รับคำร้องเข้าระบบ'],
      ['S2_Reviewing',  'ตรวจสอบ',           'Reviewing',  2,  '#F59E0B', 'Admin ตรวจความครบถ้วน'],
      ['S3_Assigned',   'มอบหมายแล้ว',       'Assigned',   3,  '#6366F1', 'มอบหมายให้ Admin เจ้าของเรื่อง'],
      ['S4_Processing', 'กำลังดำเนินการ',    'Processing', 4,  '#0EA5E9', 'อยู่ระหว่างดำเนินการกับทีมที่เกี่ยวข้อง'],
      ['S5_Sent',       'ส่งออก',            'Sent',       5,  '#10B981', 'ส่งผลลัพธ์ให้ผู้ร้องแล้ว รอ confirm'],
      ['S6_Closed',     'ปิดเคส',            'Closed',     6,  '#059669', 'ปิด ticket สมบูรณ์'],
      ['X_Cancelled',   'ยกเลิก',            'Cancelled',  99, '#94A3B8', 'ยกเลิกโดยผู้ร้อง'],
      ['X_Rejected',    'ปฏิเสธ',            'Rejected',   99, '#DC2626', 'ปฏิเสธคำร้อง']
    ]
  },

  // Assignment Rules: ทุกหมวด default ไปที่ไอซ์ (supervisor) เพื่อ triage แล้วกระจายให้
  // พนักงานในทีมต่อด้วย assignTicketToStaff(ticketId, empCode) — notification เด้งไป
  // shared inbox (hktadminpsa@aotga.com) ที่ทีมรับร่วมกัน
  '12_Assignment_Rules': {
    columns: ['Cat_Code', 'Auto_Assign', 'Preferred_Admin_Emails', 'Fallback_Admin_Email', 'Note'],
    rows: [
      ['HR',  'yes', 'sunisara.bo@aotga.com', 'hktadminpsa@aotga.com', 'ไอซ์ triage → กระจายในทีม'],
      ['FIN', 'yes', 'sunisara.bo@aotga.com', 'hktadminpsa@aotga.com', 'ไอซ์ triage → กระจายในทีม'],
      ['PRC', 'yes', 'sunisara.bo@aotga.com', 'hktadminpsa@aotga.com', 'ไอซ์ triage → กระจายในทีม'],
      ['MNT', 'yes', 'sunisara.bo@aotga.com', 'hktadminpsa@aotga.com', 'ไอซ์ triage → กระจายในทีม'],
      ['AST', 'yes', 'sunisara.bo@aotga.com', 'hktadminpsa@aotga.com', 'ไอซ์ triage → กระจายในทีม'],
      ['DOC', 'yes', 'sunisara.bo@aotga.com', 'hktadminpsa@aotga.com', 'ไอซ์ triage → กระจายในทีม'],
      ['COR', 'yes', 'sunisara.bo@aotga.com', 'hktadminpsa@aotga.com', 'ไอซ์ triage → กระจายในทีม'],
      ['OTH', 'yes', 'sunisara.bo@aotga.com', 'hktadminpsa@aotga.com', 'ไอซ์ triage → กระจายในทีม']
    ]
  },

  '13_Checklist_Templates': {
    columns: ['Cat_Code', 'Stage_Code', 'Order', 'Item_TH', 'Item_EN', 'Required'],
    rows: [
      // Default (apply to all categories)
      ['*',   'S1_Received',  1, 'ตรวจ ticket ใหม่ใน Inbox',            'Check new ticket',            'yes'],
      ['*',   'S1_Received',  2, 'ตอบรับใน Email/Chat ภายใน 15 นาที',    'Acknowledge within 15 min',    'yes'],
      ['*',   'S2_Reviewing', 1, 'อ่านรายละเอียดและเอกสารแนบ',          'Read details & attachments',  'yes'],
      ['*',   'S2_Reviewing', 2, 'ตรวจความครบถ้วนของข้อมูล',            'Verify completeness',          'yes'],
      ['*',   'S3_Assigned',  1, 'เลือก Admin ผู้รับผิดชอบและ Assign',  'Assign responsible admin',    'yes'],
      ['*',   'S5_Sent',      1, 'ส่งหลักฐานให้ผู้ขอคำร้อง',             'Send proof to requester',     'yes'],
      ['*',   'S6_Closed',    1, 'บันทึก Resolution Note + Filing',     'Record resolution + filing',  'yes'],

      // FIN
      ['FIN', 'S3_Assigned',  2, 'แจ้งทีม Finance ผ่าน Chat/Email',     'Notify Finance team',          'yes'],
      ['FIN', 'S4_Processing',1, 'ตรวจใบเสร็จ/ใบกำกับภาษีถูกต้อง',      'Verify receipt/tax invoice',  'yes'],
      ['FIN', 'S4_Processing',2, 'ขออนุมัติจาก Station Manager',       'Get Station Manager approval','yes'],
      ['FIN', 'S4_Processing',3, 'จ่ายเงิน / บันทึกบัญชี',               'Disburse / record accounting','yes'],

      // MNT
      ['MNT', 'S3_Assigned',  2, 'แจ้งช่างเทคนิคที่เกี่ยวข้อง',          'Notify technician',            'yes'],
      ['MNT', 'S4_Processing',1, 'ตรวจสอบ ณ จุดเกิดเหตุ',                'On-site inspection',          'yes'],
      ['MNT', 'S4_Processing',2, 'ดำเนินการซ่อม / แทนที่อุปกรณ์',         'Perform repair / replacement','yes'],

      // HR
      ['HR',  'S4_Processing',1, 'ตรวจสิทธิ์/เอกสารพนักงาน',              'Verify employee eligibility', 'yes'],
      ['HR',  'S4_Processing',2, 'อนุมัติคำร้อง / Update ระบบบุคคล',       'Approve / update HR system',  'yes'],

      // PRC
      ['PRC', 'S4_Processing',1, 'ตรวจสเปก/ราคา + เปรียบเทียบ',           'Verify spec / price comparison','yes'],
      ['PRC', 'S4_Processing',2, 'ดำเนินการสั่งซื้อ',                      'Place order',                 'yes'],

      // AST
      ['AST', 'S4_Processing',1, 'ตรวจสอบทรัพย์สินที่จะโอนย้าย',            'Verify asset for transfer',   'yes'],
      ['AST', 'S4_Processing',2, 'Update ทะเบียนทรัพย์สิน',                'Update asset register',       'yes'],

      // DOC
      ['DOC', 'S4_Processing',1, 'จัดทำ/ตรวจเอกสาร',                       'Prepare / verify document',   'yes'],
      ['DOC', 'S4_Processing',2, 'ขอลงนามผู้มีอำนาจ',                       'Get authorized signature',    'yes'],

      // COR
      ['COR', 'S4_Processing',1, 'ประสานหน่วยงาน + ยืนยันกำหนดการ',         'Coordinate + confirm schedule','yes']
    ]
  }
};

// 77 รหัสสายการบินที่ Phuket Ground Handling ให้บริการ — ใช้เป็น Options ของ field "ชื่อสายการบิน"
function SEED_AIRLINES_() {
  return [
    'QR — Qatar Airways','MH — Malaysia Airlines','SQ — Singapore Airlines','LY — El Al',
    'CX — Cathay Pacific','KC — Air Astana','OV — SalamAir','EY — Etihad','PG — Bangkok Airways',
    'EK — Emirates','JQ — Jetstar','TR — Scoot','3K — Jetstar Asia','AK — AirAsia Malaysia',
    '6E — IndiGo','VJ — VietJet','LJ — Jin Air','OD — Batik Air Malaysia','FY — Firefly',
    'KE — Korean Air','TK — Turkish','SU — Aeroflot','UO — HK Express','DV — SCAT',
    'EO — Pegas Fly','HH — Taban Air','WY — Oman Air','FM — Shanghai Airlines','MU — China Eastern',
    'HO — Juneyao','9C — Spring Airlines','PN — China West Air','3U — Sichuan Airlines',
    'CA — Air China','CZ — China Southern','HU — Hainan','OQ — Chongqing','ZH — Shenzhen Airlines',
    'W5 — Mahan Air','9H — Changan Airlines','HX — Hong Kong Airlines','IT — Tigerair Taiwan',
    'WZ — Red Wings','ZF — Azur Air','G2 — GullivAir','G9 — Air Arabia','AI — Air India',
    'BK — Okay Airways','GX — GX Airlines','S7 — S7 Airlines','DE — Condor','QZ — Indonesia AirAsia',
    '8M — Myanmar Airways Intl','WK — Edelweiss','XJ — Thai AirAsia X','SG — SpiceJet','NO — Neos',
    'HY — Uzbekistan','AY — Finnair','BY — TUI Airways','KA — Cathay Dragon','SV — Saudia',
    'DK — Eastar Jet','OM — MIAT Mongolian','6B — TUIfly Nordic','H4 — HiSky','IX — Air India Express',
    'QP — Akasa Air','OZ — Asiana','AF — Air France','N4 — Nordwind','LO — LOT Polish',
    'C6 — SaudiGulf','AQ — Aloha Air Cargo','B2 — Belavia','JD — Beijing Capital','HB — Greater Bay Airlines',
    'อื่นๆ / Other'
  ].join(';');
}

/**
 * Generic seeder — สร้าง sheet ถ้ายังไม่มี + เติม header + rows
 *   - ถ้า sheet มีอยู่แล้วและมี data row > 0 → ข้าม (preserve user edits)
 *   - ถ้า sheet มี header แต่ไม่มี data → เติม rows
 */
function seedSheet_(ss, name, columns, rows) {
  let sh = ss.getSheetByName(name);
  let created = false;
  if (!sh) {
    sh = ss.insertSheet(name);
    created = true;
  }
  const existing = sh.getDataRange().getValues();
  if (existing.length >= 2 && existing[1].some(v => v !== '')) {
    return { sheet: name, status: 'skipped (has data)', added: 0 };
  }
  // (re)write header
  sh.clear();
  sh.appendRow(columns);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, columns.length)
    .setFontWeight('bold').setBackground('#0F2A4F').setFontColor('#FFFFFF');
  // bulk append rows
  if (rows && rows.length) {
    sh.getRange(2, 1, rows.length, columns.length).setValues(rows);
  }
  return { sheet: name, status: created ? 'created' : 'seeded existing', added: rows.length };
}

/**
 * Seed master sheets ทั้งหมด (01-13)
 * เรียกได้หลายครั้ง — ปลอดภัย ไม่ทับ data ที่ user แก้แล้ว
 */
function seedAllMasterSheets() {
  const ss = openSS_();
  const results = [];
  Object.keys(SEED).forEach(name => {
    const def = SEED[name];
    results.push(seedSheet_(ss, name, def.columns, def.rows));
  });
  // Staff Roster เรียกผ่าน createStaffSheet_ (logic เฉพาะ + idempotent re-seed)
  if (!ss.getSheetByName(CFG.SH.STAFF)) {
    createStaffSheet_(ss);
    results.push({ sheet: CFG.SH.STAFF, status: 'created', added: CFG.STAFF_SEED.length });
  } else {
    const added = seedStaffRoster();
    results.push({ sheet: CFG.SH.STAFF, status: added ? 'topped up' : 'skipped (has data)', added: added });
  }
  Logger.log('seedAllMasterSheets results:');
  results.forEach(r => Logger.log('  ' + r.sheet + ' → ' + r.status + ' (+' + r.added + ' rows)'));
  return results;
}
