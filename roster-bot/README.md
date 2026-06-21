# SmartShift Roster Bot — merged (AOTGA)

Apps Script project that turns the daily PSA assignment file (+ LL daily tab and
the Pax Manpower MASTER file) into manpower reports. It combines two previously
separate codebases:

- the **All-in-One web app** (header-driven reader, SLA flight check, live web
  dashboard, weekly OT) — *Bot A*
- the **v3.1 detailed report** (MASTER-based OFF counting, MANPOWER/Crewsign
  overrides, monospaced Chat tables, A4 PDF) — *Bot B*

Both bots now run on **one shared reader layer** — the sheets are parsed once;
each bot just formats the result differently.

## Architecture

```
                 ┌─────────────────── shared reader layer ───────────────────┐
                 │  RosterReader.gs   header-driven PSA assignment parser     │
                 │  LLReader.gs       LL daily-tab parser                     │
                 │  MasterReader.gs   establishment headcount + employee list │
                 └───────────────┬───────────────────────────┬───────────────┘
                                 │                           │
          ┌──────────────────────┘                           └──────────────────────┐
   Bot A (web / dashboard)                               Bot B (detailed / HR)
   ─────────────────────────                             ─────────────────────────
   RosterBot.gs   dashboard / timetable / chat / weekly  Reconcile.gs   MASTER-based OFF
   SLA.gs         per-flight SLA staffing check                         counting + MANPOWER
   WebDashboard.gs doGet() live web app                                 / Crewsign overrides
                                                         LegacyReport.gs detailed Chat + PDF
```

| File | Layer | Purpose |
|------|-------|---------|
| `RosterReader.gs` | shared | Header-driven PSA parser → per-person records (`readRosterFromSpreadsheet`). |
| `LLReader.gs` | shared | LL daily-tab parser (`readLLForDate`). |
| `MasterReader.gs` | shared | `readMasterHeadcount` (Bot A) + `readMaster_` full roster (Bot B). |
| `SLA.gs` | Bot A | Airline SLA requirements + per-flight shortage check. |
| `RosterBot.gs` | Bot A | Drive navigation, Dashboard/Timetable tabs, weekly OT, short Chat summary, triggers. |
| `Validation.gs` | Bot A | Flight-conflict + OT-missing checks → `🚨 Issues` tab + alert webhook. |
| `WebDashboard.gs` | Bot A | `doGet()` server-rendered live dashboard. |
| `Reconcile.gs` | Bot B | MASTER reconciliation (absent staff = OFF) + MANPOWER/Crewsign overrides, on shared records. |
| `LegacyReport.gs` | Bot B | Detailed monospaced Chat tables + A4 PDF + triggers. |

## Auto-sync to Apps Script (clasp + GitHub Action)

Pushes to `main` that touch `roster-bot/**` are synced to the Apps Script project
by `.github/workflows/clasp-sync.yml` (job `sync-roster`), using the same
`CLASPRC_JSON` secret as `service-request`.

One-time setup:
1. Open your roster-bot Apps Script project → **Project Settings (⚙️) → IDs →
   Script ID**, copy it.
2. Paste it into `roster-bot/.clasp.json` (replace `PUT_YOUR_ROSTER_BOT_SCRIPT_ID_HERE`).
3. Commit. From then on, merging roster-bot changes to `main` auto-pushes them.

Notes:
- The action runs on **push to `main`** — so changes on a feature branch/PR only
  sync after merge. To sync a branch before merging, use GitHub → **Actions →
  "Sync to Apps Script" → Run workflow** and pick your branch (`workflow_dispatch`).
- `.claspignore` makes clasp push **only the split `.gs` + `appsscript.json`** —
  the `single-file/` build is excluded (pushing both would define every function
  twice and break the project).

## Single-file build

`single-file/SmartShiftRosterBot.gs` is the entire project concatenated into one
`.gs` — paste it into a single Apps Script file if you prefer one file over the
split layout. Use `single-file/appsscript.json` alongside it.

> ⚠️ Use **either** the single file **or** the split `.gs` files — never both in
> the same Apps Script project (the functions would be defined twice).

## Configuration (constants, not a BotConfig sheet)

| Where | Constant | Meaning |
|-------|----------|---------|
| `RosterBot.gs` | `CONFIG_RB.ROOT_FOLDER_ID` | PSA year folder (drill month → day file). |
| `RosterBot.gs` | `CONFIG_RB.LL_FILE_ID` | LL monthly file. Blank = skip LL. |
| `RosterBot.gs` | `CONFIG_RB.OUTPUT_FOLDER_ID` | Where monthly report / PDF live. Blank = My Drive. |
| `MasterReader.gs` | `MASTER_FILE_ID_RB` | Pax Manpower MASTER. **Required for Bot B** OFF counting. |
| Script Property | `GCHAT_WEBHOOK_REPORT` | Google Chat webhook URL — daily report (secret — not in source). |
| Script Property | `GCHAT_WEBHOOK_ALERT` | Google Chat webhook URL — flight-conflict / OT-missing alerts (optional, separate room). |

Set the webhook once: Project Settings → Script Properties → add
`GCHAT_WEBHOOK_REPORT`, **or** run `setupChatWebhook()` after pasting the URL in
that function (then remove it again).

## Running

| Goal | Function |
|------|----------|
| Bot A — daily dashboard + short Chat | `runDailyRosterReport()` |
| Bot A — a specific date | `runRosterForDate(2026, 6, 8)` |
| Bot A — smoke test one file by id | `testRosterFromId('<psaId>', '<llId>', 2026, 6, 8)` |
| Bot A — install 08:00 / 14:00 triggers | `setupTriggers()` |
| Bot B — detailed Chat + PDF (today) | `runLegacyToday()` |
| Bot B — a specific date | `runLegacyReport(2026, 6, 8)` |
| Bot B — install 08:05 / 14:05 triggers | `setupLegacyTriggers()` |
| Web app | deploy → Web app, open `/exec` (self-test `/exec?ping=1`) |

Bot A and Bot B are independent — run one, the other, or both. Bot B's triggers
fire 5 minutes after Bot A's so the messages don't interleave.

## Notes

- Requires the **Drive advanced service (v2)** — already declared in
  `appsscript.json` — to convert uploaded `.xlsx` assignment files to Sheets.
- The web app `access` is set to `DOMAIN`; change to `ANYONE` /
  `ANYONE_ANONYMOUS` in `appsscript.json` if you need public links.
- File IDs in source are Drive IDs (not secrets); only the Chat webhook is kept
  out of source, in a Script Property.
- **MASTER-based OFF counting**: Bot B walks every operational PSA employee in
  the MASTER file and matches them to today's assignment rows (by ID, then a
  unique first name). Anyone not found counts as OFF — so the Off figure is the
  full establishment minus who actually showed up, not just rows in the file.
