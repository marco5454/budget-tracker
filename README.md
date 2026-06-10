# Ward Budget Tracker (Unofficial)

> ## ⚠ Important — Read first
>
> This app is a **personal, unofficial** tracking tool. It is **NOT** an official application of The Church of Jesus Christ of Latter-day Saints, and it is **not affiliated with, endorsed by, or sponsored by** the Church.
>
> The official system of record for ward finances is **MLS / LCR**. Always reconcile any data in this app against MLS/LCR. Do not use this app's exports, screenshots, or printouts as official Church documents.
>
> Built for the personal convenience of an individual bishopric/clerk on their own device. Treat all backup files and exports as confidential financial records.

An offline-first web app to help a ward bishop or clerk privately track quarterly/annual budget allocations and expenses, alongside the official MLS/LCR system.

**Current version: v1.0.0**

---

## Release Notes

### v1.0.0 — Initial Release

Feature-complete first version. Highlights:

- Dashboard, Transactions, Budget, Templates, Reports, Audit Log, Trash, Settings, Help.
- PHP-default currency, calendar fiscal year, quarterly + annual budgeting.
- Year close + carry-over, per-category soft limits, allotment quick-add.
- CSV import/export, JSON backup/restore (plain and AES-256-GCM encrypted), SHA-256 integrity check.
- Auto-backup to a chosen folder with read-back verification and retention.
- Optional PIN/passphrase lock with idle auto-lock and progressive failed-attempt lockout.
- Audit log (365-day retention), Trash (30-day auto-purge) with 8s undo.
- Multi-tab safety via BroadcastChannel.
- Dark mode (auto/light/dark), receipt viewer (image zoom + PDF embed), advanced search with saved searches, keyboard shortcuts, onboarding checklist.
- PWA installable, fully offline once loaded.

---

## Features

- **Dashboard** with KPIs, budget-vs-spent per organization, category breakdown, monthly trend, alerts, recent transactions, and a *Needs attention* widget (over-budget orgs, stuck workflow, missing receipts, unusually large expenses, **over/near per-category limits**).
- **Transactions** page with search/filter (year, quarter, organization, type, status), CSV export, **CSV import** with preview, edit/delete, and optional receipt attachment.
- **Templates** for recurring transactions — pre-fill everything except date and amount; save from the Add Transaction form, manage on the Templates page.
- **Quarterly allotment quick-add** on the Dashboard — one click to record the stake allotment with last-used amount/org/category pre-filled.
- **Budget** page to set annual or quarterly allocations per organization, with helper to split annual into quarters.
- **Year Management** — close a year to lock all edits (with optional per-org carry-over to the next year's annual allocation), reopen anytime.
- **Per-org category limits** — set yearly caps per (organization, category); soft warning when a transaction would exceed the cap; usage table on Reports.
- **Reports** page with annual breakdown by organization (per-quarter spent), category totals, monthly summary, and **category-limits usage** — each exportable to CSV.
- **Print / Save as PDF** on Dashboard and Reports — produces a clean, official-looking document via the browser print dialog.
- **Audit Log** of every create/update/delete on transactions, allocations, organizations, categories, templates, category limits, year close/reopen, and key settings — filterable by entity/action/actor and exportable to CSV.
- **Trash** with 30-day auto-purge for deleted transactions and allocations, plus an 8-second Undo on delete.
- **Multi-tab safety** — when another tab edits data, this tab refreshes automatically and shows a banner.
- **Dark mode** — auto / light / dark, with a header toggle and a Settings panel.
- **Receipt viewer** — built-in image zoom + PDF embed, no leaving the app.
- **Advanced search** with free-text + date range + amount range + multi-select org/category/status, plus **saved searches**.
- **Keyboard shortcuts** for navigation, new transaction, lock, and help (press `?`).
- **Onboarding checklist** on the Dashboard guides first-time setup.
- **Settings** to manage organizations, categories, ward name, currency, active actor, year management, category limits, security, and backups.
- **Backup & Restore** as JSON files (manual download/import; merge or replace) — includes the audit log, templates, and category limits.
- **Income tracking** for quarterly allotments, inter-ward transfers, refunds.
- **PWA** — installable, works fully offline once loaded.
- **Default currency**: PHP (₱). Configurable.

## Default Organizations

Bishopric, Elders Quorum, Relief Society, Young Men, Young Women, Primary, Sunday School, Ward Activities, Music, Other. All editable.

## Default Categories

Activities, Supplies, Materials/Manuals, Food, Service Projects, Camps & Youth Conferences, Quorum/Class Activities, Ministering, Quarterly Allotment, Inter-Ward Transfer, Refund/Reimbursement, Other.

---

## Tech Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** for styling
- **Dexie.js** (IndexedDB) for local, offline storage
- **Recharts** for charts
- **vite-plugin-pwa** (Workbox) for offline caching and installability
- **React Router** (HashRouter) for navigation

All data is stored only in the browser's IndexedDB on the device running the app. Nothing is sent to any server.

---

## Getting Started

### Prerequisites

- **Node.js 18+** and **npm 9+** ([download](https://nodejs.org/))

### One-click start (recommended for everyday use)

After cloning/copying the project folder onto the machine that will run the app:

- **Windows:** double-click `start.bat`.
- **Linux / macOS:** run `./start.sh` from a terminal in the project folder.

The script will (on first run) install dependencies, build the production bundle, start a local server at **http://localhost:4173**, and open the browser. Subsequent runs reuse the existing build, so it starts almost instantly. Press `Ctrl+C` in the window to stop the server.

> Tip: once it's open in Chrome / Edge, click **Install app** in the address bar (or browser menu) to install the PWA. From then on it appears like a normal desktop app and continues to work even if the local server is not running, as long as the same browser profile is used.

### Manual commands

```bash
npm install              # first time only
npm run dev              # development server (hot reload, http://localhost:5173)
npm run build            # production build into dist/
npm run serve            # serve the existing dist/ on http://localhost:4173
npm start                # build + serve in one step
npm run icons            # regenerate PWA icons from public/favicon.svg
npm run package-portable # build + create a USB-ready portable folder & zip
```

---

## Portable / On-the-Go Setup (USB stick)

If you want to carry the app between the bishop's PC and a laptop without installing anything, use the portable bundle:

```bash
npm run package-portable
```

This produces `dist-portable/WardBudgetTracker-Portable/` (about 1 MB) and a matching `.zip` (~300 KB) containing:

- The built app (`app/` folder, ~900 KB total)
- Cross-platform launchers (`Launch-Windows.bat`, `Launch-Linux.sh`, `Launch-macOS.command`)
- A README and DISCLAIMER.txt

Copy the folder to a USB stick and double-click the launcher for that OS — the app opens in the default browser, fully offline, no Node.js, no installer, no internet required.

**On-the-go essentials:**

1. Drop the `WardBudgetTracker-Portable\` folder on the stick, plus an empty `Backups\` folder next to it.
2. On every computer where you launch the app, point **Settings → Auto-Backup** at that `Backups\` folder (Chrome / Edge only). The app will write a fresh, integrity-checked backup there each day.
3. **Important:** the database lives in *each computer's browser profile*, not on the stick. Auto-Backup is how data travels between machines. Use **Settings → Backup & Restore → Import** on a new computer to load the latest backup from `Backups\`.
4. Set a **PIN** (Settings → App Lock) on every computer for an extra access barrier.
5. For maximum privacy, use the **encrypted backup (.wbtbak)** export with a passphrase before moving the stick.

**See [`PORTABLE-SETUP.md`](./PORTABLE-SETUP.md)** for the full step-by-step walkthrough including layout diagrams, multi-computer workflow, and troubleshooting.

---

## Hosting Options

This app is a static site. Pick whatever fits your situation.

### Option A — One-click `start.bat` / `start.sh` (recommended)

See above. Builds + serves locally on the device that runs the app.

### Option B — Open the built `dist/` directly from disk

After running `npm run build`:

1. Copy the `dist/` folder anywhere (USB, Documents, network share).
2. Open `dist/index.html` in a modern browser.

PWA install and full offline caching work best when served over HTTP, so prefer Option A. `file://` still runs fine for casual use.

### Option C — Self-host on the home / chapel network

Run `npm run serve` (or `npx serve -s dist -l 4173`) on one machine, then on the other machine open `http://<that-machine-ip>:4173`. Both devices share the *same app code*, but each browser has its own local IndexedDB, so transactions entered on one device do **not** appear on the other. To move data between devices, use the JSON backup/restore (or move on to a multi-user online setup later).

### Option D — Free online hosting (later, if needed)

Drop the `dist/` folder onto Netlify, Vercel, Cloudflare Pages, or GitHub Pages. Same data-isolation caveat as Option C.

---

## Backups (READ THIS)

All your data is stored only in the browser of the device running the app. **You must back up regularly** — clearing site data, browser reinstall, or disk failure will erase everything.

How to back up:

1. **Settings → Backup & Restore → Download backup (JSON)**.
2. Save the downloaded file somewhere safe (cloud drive, USB, network folder).
3. Suggested cadence: weekly and before any major change.

How to restore:

1. **Settings → Backup & Restore**.
2. Choose **Replace** (wipe and import — you will be asked to type `REPLACE` to confirm) or **Merge** (combine with existing).
3. Select the JSON or `.wbtbak` file. If it's encrypted, you'll be prompted for the passphrase.

Backup integrity: every backup contains a SHA-256 hash of its contents. Import recomputes the hash and refuses any tampered or corrupted file.

If you have changed data and have not backed up in over 7 days (or have never backed up), the app will show an amber **Backup reminder banner** at the top until you download a fresh backup.

### Encrypted backup (optional)

For sensitive ward data, use **Settings → Backup & Restore → Export encrypted backup**. Choose a passphrase (4+ characters) and the app produces a `.wbtbak` file encrypted with AES-256-GCM (key derived via PBKDF2-SHA256, 250,000 iterations). Import on another device requires the same passphrase. **There is no recovery if you forget it.**

---

## Optional Auto-Backup (Chrome / Edge)

In **Settings → Auto-Backup to Folder** you can pick a folder once. The app will then write a fresh JSON backup into that folder automatically — by default once per day, the next time the app opens after the cadence is due. You can also click **Backup now** at any point.

- This requires the File System Access API, which is currently supported in Chrome, Edge, and other Chromium-based desktop browsers. Firefox and Safari users should keep using the manual download flow above.
- The chosen folder is remembered across sessions (the browser stores the directory handle in IndexedDB). The browser may re-prompt for permission after a long time without use; just click **Backup now** to re-grant.
- **Read-back verification:** after writing, the app reads the file back and recomputes its SHA-256. A mismatch is reported as an error.
- **Retention:** by default the last 30 backup files are kept; older ones are pruned automatically. Configurable 1–180 in Settings.
- Best practice: choose a folder that is itself synced to a cloud drive (OneDrive / iCloud / Google Drive / Dropbox / Syncthing). That way a fresh backup is automatically replicated off-device.

## Templates

For recurring transactions you can save a **template** that pre-fills everything except date and amount.

- From the **Add Transaction** modal, fill the form and click **Save as template**, give it a name.
- Next time, pick the template from the *Use a template* selector at the top of the Add Transaction form. Date and amount stay blank for you to fill in.
- The dedicated **Templates** page lets you rename, edit, duplicate or delete templates.

## CSV Import

On the **Transactions** page, click **Import CSV** to bulk-add transactions.

- Click **Download CSV template** in the dialog for a ready-to-fill spreadsheet with the correct headers.
- Required columns: `date, type, amount, organization`.
- Optional columns: `category, payee, description, reference, status, notes`.
- Organization and category are matched **by name (case-insensitive)** against the entries on this device — make sure they exist before importing.
- A preview is shown before commit. Invalid rows are listed with reasons and skipped (valid rows still import).

## Ward Budget Pool (how the money flows)

LDS wards receive a single quarterly **allotment** from the stake/headquarters. The bishopric then **allocates** portions of that pool to each organization (Elders Quorum, Relief Society, Primary, etc). The app models this with a top-of-list organization called **"Ward Budget"** — the shared pool.

- **Allotment** = income the ward receives. Record it against **Ward Budget** (this is the default in **+ Allotment**).
- **Allocation** = the planning cap each organization gets out of the pool. Set these on the **Budget** page per organization.
- Both the **Dashboard** and the **Budget** page show a **Ward Budget Pool** card with: *Pool received · Allocated to orgs · Unallocated · Coverage %*. A green/amber/red indicator shows the % of the pool already allocated. The Budget page version is **scope-aware** — it changes with your Year/Period selector so you see exactly the period you're planning.
- If total allocations to other orgs exceed the pool's income, the app shows an **Over-allocated** warning (red) plus a high-severity item in the **Needs attention** widget.
- The **Ward Budget** row in the Budget table is highlighted in light blue and tagged with a **"Pool"** badge so it's easy to spot.

> Setting an EQ allocation does **not** automatically subtract from a Bishopric income — those are independent organizations. Allocations are *plans*, not transfers. Always record allotments on **Ward Budget**, and use allocations to cap how much each organization may spend.

### Budget page views

The Budget page has two viewing modes via the **Period** dropdown:

- **All quarters (overview)** — wide table with one row per organization and columns *Q1 · Q2 · Q3 · Q4 · Annual · Spent (year) · Income (year)*. Click any cell to edit; **Enter** saves, **Esc** cancels. Best for end-of-quarter planning across the whole year.
- **Annual / Q1 / Q2 / Q3 / Q4** — focused single-period view with extra columns: Allocation, Spent (in period), Income (in period), Remaining, Annual rollup. Best for entering one period at a time.

> **Annual is a separate rollup, not a sum of Q1–Q4.** It's a stand-alone "yearly cap" line. Use whichever style fits how you plan.

## Quarterly Allotment Quick-Add

On the **Dashboard**, click **+ Allotment** to record the quarterly stake allotment as an income transaction. It defaults to the **Ward Budget** pool. The amount, organization and category from the last allotment are pre-filled, so subsequent quarters take a single click + confirm.

## Print / Save as PDF

The **Dashboard** and **Reports** pages have a **Print / PDF** button. It opens the browser's print dialog with a clean stylesheet (navigation, toolbars and form chrome are hidden, charts and tables stretch to full width). Choose **Save as PDF** as the destination to produce a shareable file for the bishopric/auditor.

## Active Actor

Open **Settings → Active Actor** and pick **Bishop**, **Clerk**, **Asst. Clerk**, or **Other** (with a free-form name). This name is stamped onto every audit-log entry. Update it whenever a different person is using the app on this device.

## Year Management & Carry-Over

Open **Settings → Year Management** to see every year that has data. Each year shows an **Open** or **Closed** badge.

- **Close** a year (with **CLOSE** confirmation) to lock all edits for that year. Closed-year transactions, allocations, allotment quick-adds, and CSV imports are rejected with a clear message. The Dashboard and Reports show a yellow **Year YYYY closed** badge.
- **Carry-over** — when closing, a preview lists each organization's *remaining = allocated + income − spent*. Tick the orgs you want to carry forward and edit the per-org amount; on confirm the app creates (or augments) Q0 (annual) allocations for the next year, with one audit entry summarising the action.
- **Reopen** any year with one click to allow edits again. Reopening does **not** reverse prior carry-overs; remove or edit those manually if needed.

## Category Limits

Open **Settings → Category Limits** to set a yearly cap per **(organization, category)** for a chosen year. The card shows current spend, percent used and remaining, with colour cues (red over the cap, amber ≥ 80 %, green otherwise).

- When a new transaction would push that category over its cap, the app shows a non-blocking **Save anyway / Review** confirmation — the limit is a *guidance*, not a hard block.
- The **Needs attention** widget on the Dashboard surfaces any category that is over (high) or near (medium) its cap.
- The **Reports** page includes a **Category Limits Usage** table, exportable to CSV.

## Audit Log

Every create / update / delete on transactions, allocations, organizations, categories, and key settings is recorded.

- Open **Audit Log** in the nav. Filter by entity (transaction / allocation / organization / category / setting), action (create / update / delete / restore / purge), or actor; full-text search on the summary text.
- Export the filtered view to CSV.
- Entries older than **365 days** are pruned automatically at startup.
- The audit log is included in JSON backups (encrypted or plain) and is restored by Import.

## Trash & Undo

Deleting a transaction or allocation moves it to **Trash** (a soft delete) instead of permanently removing it.

- An 8-second **Undo** toast appears immediately after delete.
- Open **Trash** to **Restore** items or **Delete forever**.
- Trash items are auto-purged after **30 days**.
- "Empty Trash" requires typing **EMPTY** to confirm.

## Multi-Tab Safety

If you open the app in more than one tab/window, edits made in one tab are pushed to the others via a BroadcastChannel. A small **"Updated from another tab"** banner appears for a few seconds; the lists already refresh automatically.

## Dark Mode

Three modes are available:

- **Auto** — follows your operating system theme (default).
- **Light** — always light.
- **Dark** — always dark.

Toggle from the small sun/moon button in the header, or pick a specific mode in **Settings → Appearance**. The choice is remembered per-device.

## Advanced Search & Saved Searches (Transactions page)

The Transactions page has a **Show advanced filters** section with:

- Free-text search on description, payee, reference, and notes.
- Date range (from / to) and amount range (min / max).
- Multi-select organizations, categories, and statuses.
- *Has receipt / no receipt* filter.

Save the current filter set as a **named saved search** (chip below the advanced panel). Apply it with one click, or delete it with the × button. Saved searches are stored in your browser's local storage on this device.

## Receipt Viewer

When a transaction has an attached receipt, click **View** in the Receipt column on the Transactions page (or **View attached receipt** inside the form). Images can be zoomed (+ / − keys, Ctrl + scroll wheel, or the on-screen buttons) and PDFs are embedded inline. Use the **Download** or **Open** buttons to save or open the file in a new tab.

## Keyboard Shortcuts

Click the **?** button in the header (or press **Shift + /**) for the cheatsheet. Highlights:

- `G` then `D / T / B / R / S / H` — Go to Dashboard / Transactions / Budget / Reports / Settings / Help.
- `N` — Add a new transaction (on Dashboard or Transactions).
- `L` — Lock the app (if a PIN is set).
- `Esc` — Close dialogs.

Shortcuts are ignored while you're typing in a form field.

## Onboarding Checklist

First-time users see a small checklist on the Dashboard with the four setup steps (ward name, active actor, auto-backup folder, first allocation). It auto-ticks as you complete each step and disappears when finished. **Hide checklist** dismisses it permanently for this device.

## Optional App Lock (PIN/Passphrase)

You can require a PIN or passphrase before the app opens.

- **Settings → App Lock → Enable lock**. Choose any PIN/passphrase (4+ characters).
- The next time the app loads, it will prompt for the PIN.
- **Auto-lock after idle**: default 10 minutes; configurable 0–60 in Settings (0 disables idle lock).
- **Lock on tab hide**: enabled by default. Switching tabs or backgrounding the app re-locks it.
- **Lockout policy**: failed attempts add a growing cooldown (1s, 2s, 5s, 10s, 30s, 60s). After 10 failed attempts the app is blocked for 15 minutes.
- This is an **access gate**, not encryption. It hashes the PIN with PBKDF2 and stores only the hash. Anyone with full access to the browser's storage could still read the underlying data, so keep the device itself secured. For confidential backups, also use the **Export encrypted backup** option above.
- If you forget the PIN, there is no recovery path. You'll need to clear the site's data and restore from a backup file. **Always keep an up-to-date backup.**

---

## Daily Workflow

1. **At the start of the year/quarter**: enter allocations under **Budget**.
2. **As expenses are processed**: add a transaction (Dashboard or Transactions page). Pick the right Organization, set Status, attach receipt if desired.
3. **When the ward receives a quarterly allotment**: add an *Income* transaction (e.g., to "Bishopric" or any org you use as the holding/general budget).
4. **At any time**: review the Dashboard for spend vs budget and over-budget alerts.
5. **Monthly / Quarterly**: open **Reports**, export CSV for bishopric/stake meetings, and download a fresh backup.

---

## Privacy

- 100% local. No server, no analytics, no telemetry.
- Only you (and anyone with access to the device/browser profile) can see the data.
- Lock your laptop. Use a device password.
- When sharing CSV exports or backup files, treat them as confidential financial records.

## Disclaimer

This is **not** an official Church product. It does not connect to MLS or LCR. It cannot submit reimbursements or transfer funds. It is a personal tracking aid only.

---

## Project Structure

```
src/
  components/     # Layout, Modal, TransactionForm
  db/             # Dexie schema and seed data
  hooks/          # useSetting hook
  pages/          # Dashboard, Transactions, Budget, Reports, Settings, Help
  utils/          # backup (JSON/CSV), formatting
  App.tsx
  main.tsx
  index.css
public/
  favicon.svg
  icons/icon-192.png
  icons/icon-512.png
```

## License

For internal ward use. Customize freely.
