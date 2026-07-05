/* ============================================================
   May 2026 data — drop-in replacements for Index.html
   All values verified against the source totals:
     PSA week totals : 8424:30 / 3296:00 / 2673:00 / 4723:00  (grand 19116:30)
     LL  month totals: LL 1202:30 · Porter 525:00 · Admin 2:00 · Total 1729:30
   ------------------------------------------------------------
   HOW TO APPLY
   1) In PSA_DATA, replace the whole  "May 2026": { ... }  entry
      with PSA_MAY_2026 below.
   2) In LL_DATA, replace the whole   "May 2026": { ... }  entry
      with LL_MAY_2026 below.
   Flight counts: all 4 weeks [560, 517, 504, 732] are counted from the
   May 2026 schedule using the SAME logic as Code.gs getFlightData_()
   (Cancelled rows excluded, airline→team via TEAM_MAP). The offline
   baseline therefore matches the live Flight Feed exactly.
   ============================================================ */

const PSA_MAY_2026 = {
  "weeks": ["W1: 1-7 May", "W2: 8-14 May", "W3: 15-21 May", "W4: 22-31 May"],
  "flightCounts": [560, 517, 504, 732],
  "teams": {
    "EK":         {"hours": ["363:00", "126:00", "111:00", "232:30"], "flights": [25, 24, 23, 36]},
    "SQ":         {"hours": ["669:00", "332:00", "291:00", "533:30"], "flights": [50, 49, 47, 71]},
    "EY":         {"hours": ["737:00", "681:00", "441:30", "764:30"], "flights": [27, 28, 27, 36]},
    "TR":         {"hours": ["747:30", "328:30", "312:30", "717:00"], "flights": [76, 74, 75, 108]},
    "WY":         {"hours": ["491:00", "112:30", "15:30",  "64:00"],  "flights": [37, 19, 11, 32]},
    "JQ":         {"hours": ["459:00", "233:00", "221:30", "491:00"], "flights": [31, 29, 29, 44]},
    "TK":         {"hours": ["323:30", "101:30", "137:30", "178:30"], "flights": [17, 16, 16, 29]},
    "KC":         {"hours": ["492:00", "101:30", "39:00",  "136:30"], "flights": [21, 21, 21, 28]},
    "QR":         {"hours": ["200:30", "15:00",  "12:00",  "32:30"],  "flights": [31, 29, 27, 40]},
    "AK":         {"hours": ["329:30", "154:00", "155:30", "249:00"], "flights": [47, 50, 49, 73]},
    "SU":         {"hours": ["166:00", "24:00",  "15:00",  "24:00"],  "flights": [25, 26, 23, 29]},
    "CHN":        {"hours": ["582:30", "59:30",  "70:30",  "24:00"],  "flights": [41, 28, 26, 30]},
    "CHARTER":    {"hours": ["299:30", "15:00",  "8:30",   "10:00"],  "flights": [11, 10, 12, 15]},
    "PVT":        {"hours": ["133:30", "18:00",  "12:00",  "0:30"],   "flights": [6, 5, 9, 6]},
    "PG":         {"hours": ["478:30", "247:00", "187:00", "346:00"], "flights": [110, 109, 109, 155]},
    "SV":         {"hours": ["155:00", "2:30",   "0:30",   "10:30"],  "flights": [1, 0, 0, 0]},
    "PORTER":     {"hours": ["1385:00", "599:00", "530:30", "696:00"], "flights": [0, 0, 0, 0]},
    "PORTERSIGN": {"hours": ["251:30", "94:30",  "49:30",  "169:00"], "flights": [0, 0, 0, 0]},
    "ADMINDOC":   {"hours": ["152:00", "50:00",  "62:30",  "44:00"],  "flights": [0, 0, 0, 0]},
    "OFFICE":     {"hours": ["9:00",   "1:30",   "0:00",   "0:00"],   "flights": [0, 0, 0, 0]}
  },
  "codes": {
    "A1": {"mins": [68790, 62280, 43590, 75630]},
    "A2": {"mins": [163680, 129120, 111540, 198630]},
    "A3": {"mins": [5760, 720, 900, 2010]},
    "A4": {"mins": [0, 0, 720, 0]},
    "A5": {"mins": [1020, 2010, 3030, 2970]},
    "A6": {"mins": [10710, 3630, 0, 4140]},
    "A7": {"mins": [255510, 0, 600, 0]},
    "A8": {"mins": [0, 0, 0, 0]}
  }
};

/* LL May = full weekly breakdown (W1–W4) with per-week code split (A1–A8),
   same shape as Oct–Apr. Weekly LL/Porter/Admin drive the Weekly OT chart and
   the per-week A7 draws the red Holiday bar (all 511:00 falls in W1 — Labour
   Day, 1 May). Reconciles to the month: LL 1202:30 · Porter 525:00 ·
   Admin 2:00 · Total 1729:30 (A7 511:00). */
const LL_MAY_2026 = {
  "weeks": [
    {"week": "Week 01", "LL_min": 37020, "Porter_min": 14400, "Admin_min": 120, "Total_min": 51540},
    {"week": "Week 02", "LL_min": 11370, "Porter_min": 6960,  "Admin_min": 0,   "Total_min": 18330},
    {"week": "Week 03", "LL_min": 14520, "Porter_min": 5040,  "Admin_min": 0,   "Total_min": 19560},
    {"week": "Week 04", "LL_min": 9240,  "Porter_min": 5100,  "Admin_min": 0,   "Total_min": 14340}
  ],
  "codes": {
    "Week 01": {
      "A1": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A2": {"LL_min": 14820, "Porter_min": 5940, "Admin_min": 120},
      "A3": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A4": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A5": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A6": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A7": {"LL_min": 22200, "Porter_min": 8460, "Admin_min": 0},
      "A8": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0}
    },
    "Week 02": {
      "A1": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A2": {"LL_min": 11250, "Porter_min": 6360, "Admin_min": 0},
      "A3": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A4": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A5": {"LL_min": 0,     "Porter_min": 600,  "Admin_min": 0},
      "A6": {"LL_min": 120,   "Porter_min": 0,    "Admin_min": 0},
      "A7": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A8": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0}
    },
    "Week 03": {
      "A1": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A2": {"LL_min": 14190, "Porter_min": 4920, "Admin_min": 0},
      "A3": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A4": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A5": {"LL_min": 330,   "Porter_min": 120,  "Admin_min": 0},
      "A6": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A7": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0},
      "A8": {"LL_min": 0,     "Porter_min": 0,    "Admin_min": 0}
    },
    "Week 04": {
      "A1": {"LL_min": 0,    "Porter_min": 0,    "Admin_min": 0},
      "A2": {"LL_min": 9240, "Porter_min": 5100, "Admin_min": 0},
      "A3": {"LL_min": 0,    "Porter_min": 0,    "Admin_min": 0},
      "A4": {"LL_min": 0,    "Porter_min": 0,    "Admin_min": 0},
      "A5": {"LL_min": 0,    "Porter_min": 0,    "Admin_min": 0},
      "A6": {"LL_min": 0,    "Porter_min": 0,    "Admin_min": 0},
      "A7": {"LL_min": 0,    "Porter_min": 0,    "Admin_min": 0},
      "A8": {"LL_min": 0,    "Porter_min": 0,    "Admin_min": 0}
    }
  }
};
