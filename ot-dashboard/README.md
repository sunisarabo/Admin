# OT Dashboard — PSA & LL

Overtime dashboard for HKT (การโดยสาร + ติดตามสัมภาระ ภูเก็ต).

## Files
| File | Purpose |
|------|---------|
| `Code.gs` | Apps Script backend (REV 2). Live-fetches LL, PSA OT, and Flight Feed from Google Sheets. Deploy as a Web App; `doGet` serves `Index.html`. |
| `Index.html` | Full front-end (served by `Code.gs`). **May 2026 is already applied** in `PSA_DATA` + `LL_DATA`. The hardcoded data is the offline baseline; the live fetch overrides it at runtime. Copy-paste / deploy as-is. |
| `may-2026-data.js` | Standalone reference of the May 2026 blocks (same values as in `Index.html`), in case you maintain the file elsewhere. |

## Adding a future month

For May 2026 nothing to do — it's already in `Index.html`. To add a later month, edit the two objects in `Index.html` the same way (or use `may-2026-data.js` as the shape reference):

1. **PSA** — replace the whole `"May 2026": { … }` entry inside the `PSA_DATA = {…}` object with `PSA_MAY_2026`.
2. **LL** — replace the whole `"May 2026": { … }` entry inside the `LL_DATA = {…}` object with `LL_MAY_2026`.

(Strip the `const PSA_MAY_2026 =` / `const LL_MAY_2026 =` wrapper and the trailing `;` — paste just the `{ … }` object as the value of the `"May 2026"` key.)

### Verified totals
```
PSA week totals : 8424:30 / 3296:00 / 2673:00 / 4723:00   (grand 19116:30)
PSA codes A1–A8 : sum per week matches the team week totals exactly
LL  month       : LL 1202:30 · Porter 525:00 · Admin 2:00 · Total 1729:30
```

### Notes
- **LL May** is monthly-by-code only (no weekly split was provided), so it uses the *flat* shape `{ LL_min, Porter_min, Admin_min, Total_min, codes:{ A1…A8 } }`. The helper functions (`llCatMonth`, `llTotalMonth`, `llCodeMonth`, `llCodeCatMonth`) already handle both the flat and the weekly shapes. On the May month page the weekly chart collapses to a single **Monthly** bar (Regular + A7), so it is no longer blank.
- **LL "ไม่ขึ้น" fix** — the Apps Script `getLLData_()` returns each month as `{ summary, codes, codeTotal, discrepancy }`, which the front-end didn't understand (every LL month disappeared after a live refresh). `applyServerData()` now runs each month through `normalizeLLRecord()`, flattening `summary` into the top-level `{ LL_min, Porter_min, Admin_min, Total_min }` the helpers expect.
- **Flight counts** — all 4 weeks `[560, 517, 504, 732]` are counted directly from the May 2026 schedule using the **same logic as `getFlightData_()`** (`Cancelled` rows excluded, airline→team via `TEAM_MAP`). 15 of 16 teams reproduce the original W1 numbers exactly; only `CHN` was corrected (62 → 41 — the old value couldn't be reproduced from the schedule). Because the offline baseline now uses the identical method, it matches the live **PSA-HKT Flight Feed** sheet, so the numbers don't change on refresh.
