# OT Dashboard — PSA & LL

Overtime dashboard for HKT (การโดยสาร + ติดตามสัมภาระ ภูเก็ต).

## Files
| File | Purpose |
|------|---------|
| `Code.gs` | Apps Script backend (REV 2). Live-fetches LL, PSA OT, and Flight Feed from Google Sheets. Deploy as a Web App; `doGet` serves `Index.html`. |
| `may-2026-data.js` | **May 2026 data** — verified drop-in blocks for `PSA_DATA` and `LL_DATA` in `Index.html`. |
| `Index.html` | Front-end (served by `Code.gs`). The hardcoded `PSA_DATA` / `LL_DATA` are the offline baseline; the live fetch overrides them at runtime. |

## Adding May 2026 (or any new month)

May 2026 is provided in `may-2026-data.js`. To apply it to `Index.html`:

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
- **LL May** is monthly-by-code only (no weekly split was provided), so it uses the *flat* shape `{ LL_min, Porter_min, Admin_min, Total_min, codes:{ A1…A8 } }`. The helper functions (`llCatMonth`, `llTotalMonth`, `llCodeMonth`, `llCodeCatMonth`) already handle both the flat and the weekly shapes. The LL weekly chart for May will be empty (data not available); category and code charts work normally.
- **Flight counts** — only W1 (577) is kept as the offline fallback. W2–W4 auto-populate from the live **PSA-HKT Flight Feed** sheet via `getFlightData_()`, which excludes `Cancelled` / `Postponed` rows. So the deployed dashboard shows real flight counts even though the static baseline only has W1.
