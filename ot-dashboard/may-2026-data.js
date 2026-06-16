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
   Flight counts: only W1 (577) is kept as the offline fallback —
   W2–W4 auto-populate from the live Flight Feed via Code.gs
   getFlightData_() (Cancelled/Postponed excluded).
   ============================================================ */

const PSA_MAY_2026 = {
  "weeks": ["W1: 1-7 May", "W2: 8-14 May", "W3: 15-21 May", "W4: 22-31 May"],
  "flightCounts": [577, 0, 0, 0],
  "teams": {
    "EK":         {"hours": ["363:00", "126:00", "111:00", "232:30"], "flights": [25, 0, 0, 0]},
    "SQ":         {"hours": ["669:00", "332:00", "291:00", "533:30"], "flights": [50, 0, 0, 0]},
    "EY":         {"hours": ["737:00", "681:00", "441:30", "764:30"], "flights": [27, 0, 0, 0]},
    "TR":         {"hours": ["747:30", "328:30", "312:30", "717:00"], "flights": [76, 0, 0, 0]},
    "WY":         {"hours": ["491:00", "112:30", "15:30",  "64:00"],  "flights": [37, 0, 0, 0]},
    "JQ":         {"hours": ["459:00", "233:00", "221:30", "491:00"], "flights": [31, 0, 0, 0]},
    "TK":         {"hours": ["323:30", "101:30", "137:30", "178:30"], "flights": [17, 0, 0, 0]},
    "KC":         {"hours": ["492:00", "101:30", "39:00",  "136:30"], "flights": [21, 0, 0, 0]},
    "QR":         {"hours": ["200:30", "15:00",  "12:00",  "32:30"],  "flights": [31, 0, 0, 0]},
    "AK":         {"hours": ["329:30", "154:00", "155:30", "249:00"], "flights": [47, 0, 0, 0]},
    "SU":         {"hours": ["166:00", "24:00",  "15:00",  "24:00"],  "flights": [25, 0, 0, 0]},
    "CHN":        {"hours": ["582:30", "59:30",  "70:30",  "24:00"],  "flights": [62, 0, 0, 0]},
    "CHARTER":    {"hours": ["299:30", "15:00",  "8:30",   "10:00"],  "flights": [11, 0, 0, 0]},
    "PVT":        {"hours": ["133:30", "18:00",  "12:00",  "0:30"],   "flights": [6, 0, 0, 0]},
    "PG":         {"hours": ["478:30", "247:00", "187:00", "346:00"], "flights": [110, 0, 0, 0]},
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

/* LL May = monthly totals by code only (no weekly split available).
   Flat structure — llCatMonth / llTotalMonth / llCodeMonth / llCodeCatMonth
   all already handle this shape. */
const LL_MAY_2026 = {
  "LL_min": 72150, "Porter_min": 31500, "Admin_min": 120, "Total_min": 103770,
  "codes": {
    "A1": {"LL_min": 0,     "Porter_min": 0,     "Admin_min": 0},
    "A2": {"LL_min": 49500, "Porter_min": 22320, "Admin_min": 120},
    "A3": {"LL_min": 0,     "Porter_min": 0,     "Admin_min": 0},
    "A4": {"LL_min": 0,     "Porter_min": 0,     "Admin_min": 0},
    "A5": {"LL_min": 330,   "Porter_min": 720,   "Admin_min": 0},
    "A6": {"LL_min": 120,   "Porter_min": 0,     "Admin_min": 0},
    "A7": {"LL_min": 22200, "Porter_min": 8460,  "Admin_min": 0},
    "A8": {"LL_min": 0,     "Porter_min": 0,     "Admin_min": 0}
  }
};
