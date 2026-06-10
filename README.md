# Ward Budget Tracker

An offline-first web app to help LDS ward bishopric and clerks track quarterly/annual budget allocations and expenses.

> **Important:** This app is **supplementary** to the official **MLS / LCR** financial system, which remains the system of record. Always reconcile this tracker with official church records.

---

## Features

- **Dashboard** with KPIs, budget-vs-spent per organization, category breakdown, monthly trend, alerts, and recent transactions.
- **Transactions** page with search/filter (year, quarter, organization, type, status), CSV export, edit/delete, and optional receipt attachment.
- **Budget** page to set annual or quarterly allocations per organization, with helper to split annual into quarters.
- **Reports** page with annual breakdown by organization (per-quarter spent), category totals, and monthly summary — each exportable to CSV.
- **Settings** to manage organizations, categories, ward name, currency, and backups.
- **Backup & Restore** as JSON files (manual download/import; merge or replace).
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
npm install         # first time only
npm run dev         # development server (hot reload, http://localhost:5173)
npm run build       # production build into dist/
npm run serve       # serve the existing dist/ on http://localhost:4173
npm start           # build + serve in one step
npm run icons       # regenerate PWA icons from public/favicon.svg
```

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
3. Select the JSON file. Done.

If you have changed data and have not backed up in over 7 days (or have never backed up), the app will show an amber **Backup reminder banner** at the top until you download a fresh backup.

---

## Optional Auto-Backup (Chrome / Edge)

In **Settings → Auto-Backup to Folder** you can pick a folder once. The app will then write a fresh JSON backup into that folder automatically — by default once per day, the next time the app opens after the cadence is due. You can also click **Backup now** at any point.

- This requires the File System Access API, which is currently supported in Chrome, Edge, and other Chromium-based desktop browsers. Firefox and Safari users should keep using the manual download flow above.
- The chosen folder is remembered across sessions (the browser stores the directory handle in IndexedDB). The browser may re-prompt for permission after a long time without use; just click **Backup now** to re-grant.
- Best practice: choose a folder that is itself synced to a cloud drive (OneDrive / iCloud / Google Drive / Dropbox / Syncthing). That way a fresh backup is automatically replicated off-device.

## Optional App Lock (PIN/Passphrase)

You can require a PIN or passphrase before the app opens.

- **Settings → App Lock → Enable lock**. Choose any PIN/passphrase (4+ characters).
- The next time the app loads, it will prompt for the PIN.
- This is an **access gate**, not encryption. It hashes the PIN with PBKDF2 and stores only the hash. Anyone with full access to the browser's storage could still read the underlying data, so keep the device itself secured.
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
