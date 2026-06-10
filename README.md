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

- **Node.js 18+** and **npm 9+**

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

Open the URL printed in the terminal (default `http://localhost:5173`).

### Build for production

```bash
npm run build
```

The optimized site is generated in `dist/`.

### Preview the production build

```bash
npm run preview
```

---

## Hosting Options

This app is a static site. Pick whatever fits your situation.

### Option A — Open directly from disk (simplest, no server)

After running `npm run build`:

1. Copy the `dist/` folder anywhere you like (e.g., a USB drive or Documents folder).
2. Open `dist/index.html` in a modern browser.

> Note: PWA install and service-worker offline caching work best when served over HTTP(S). Opening via `file://` still works for normal use, but for the best experience use Option B.

### Option B — Local self-hosting on the church laptop/PC (recommended)

After `npm run build`:

```bash
npx serve dist
```

Or any other static server (Python, Caddy, nginx). Visit `http://localhost:3000` (or whichever port). This is great for the offline-first PWA experience.

### Option C — Free online hosting (later, if needed)

Drop the `dist/` folder onto Netlify, Vercel, Cloudflare Pages, or GitHub Pages. Each device that opens it has its own local copy of data — to sync between devices, use the JSON backup/restore.

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
