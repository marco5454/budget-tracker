export default function Help() {
  return (
    <div className="prose prose-slate max-w-none space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Help &amp; Instructions</h1>
        <p className="text-sm text-slate-500">
          A quick guide for clerks and bishopric members using this tracker.
        </p>
      </div>

      <div className="bg-amber-100 dark:bg-amber-900/30 border-l-4 border-amber-500 px-4 py-3 rounded">
        <h2 className="text-base font-bold text-amber-900 dark:text-amber-100 m-0">
          ⚠ Personal use only — Read first
        </h2>
        <p className="text-sm text-amber-900 dark:text-amber-100 mt-2 mb-1">
          This app is a <strong>personal, unofficial</strong> tracking tool. It
          is <strong>NOT</strong> an official application of The Church of Jesus
          Christ of Latter-day Saints, and it is <strong>not affiliated with,
          endorsed by, or sponsored by</strong> the Church.
        </p>
        <p className="text-sm text-amber-900 dark:text-amber-100">
          The official system of record for ward finances is{" "}
          <strong>MLS / LCR</strong>. Always reconcile this tracker against
          MLS/LCR. Do not use this app's exports, screenshots, or printouts as
          official Church documents.
        </p>
      </div>

      <Section title="Important: Disclaimer">
        <p>
          This app is a <strong>personal/internal tracker</strong>, not an
          official Church system, not affiliated with the Church, and not a
          replacement for MLS/LCR. Always reconcile with official church
          records.
        </p>
        <p>
          All data is stored <strong>only on this device</strong>, inside the
          browser's local database (IndexedDB). Clearing browser data will
          erase your records, so back up regularly.
        </p>
      </Section>

      <Section title="First-Time Setup">
        <ol className="list-decimal pl-6 space-y-1">
          <li>
            Go to <strong>Settings</strong> and set your ward name and currency.
          </li>
          <li>
            Review default <strong>Organizations</strong> (Bishopric, EQ, RS,
            YM, YW, Primary, Sunday School, Ward Activities, Music, Other).
            Add, rename, deactivate, or delete as needed.
          </li>
          <li>
            Review default <strong>Categories</strong> (Activities, Supplies,
            Food, etc.). Add custom ones if helpful.
          </li>
          <li>
            Go to <strong>Budget</strong> and enter the annual or quarterly
            allocations from the stake.
          </li>
          <li>
            Start adding transactions on the <strong>Dashboard</strong> or{" "}
            <strong>Transactions</strong> page.
          </li>
        </ol>
      </Section>

      <Section title="Adding a Transaction">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Use <strong>Expense</strong> for outgoing payments (reimbursements,
            invoices, supplies).
          </li>
          <li>
            Use <strong>Income</strong> for quarterly allotments received,
            inter-ward transfers, refunds, or other budget additions.
          </li>
          <li>
            Always pick the correct <strong>Organization</strong> so the budget
            charges the right group.
          </li>
          <li>
            Enter a <strong>Reference #</strong> (check number, MLS reference,
            receipt #) for easier reconciliation.
          </li>
          <li>
            Set <strong>Status</strong> to track approval/payment workflow:
            Pending → Approved → Paid → Reimbursed.
          </li>
          <li>
            Optionally attach a <strong>Receipt</strong> (image or PDF). It is
            stored locally in this browser only.
          </li>
        </ul>
      </Section>

      <Section title="Budget Allocations">
        <p>
          The Church typically distributes ward budgets per quarter. You can:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Set an <strong>Annual</strong> allocation per organization, OR
          </li>
          <li>
            Set <strong>Quarterly (Q1–Q4)</strong> allocations directly.
          </li>
          <li>
            On a quarter view, click <em>"Split annual / 4"</em> to evenly
            distribute the annual numbers across that quarter.
          </li>
        </ul>
        <p>
          The Dashboard's "Total Budget" combines{" "}
          <em>allocations + income transactions</em> for the selected period.
        </p>
      </Section>

      <Section title="Dashboard">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>KPI cards</strong>: Total Budget, Spent, Remaining, Income.
          </li>
          <li>
            <strong>Alerts</strong>: organizations at ≥80% used or over budget.
          </li>
          <li>
            <strong>Budget vs Spent</strong> bar chart per organization.
          </li>
          <li>
            <strong>Spending by Category</strong> donut.
          </li>
          <li>
            <strong>Monthly Trend</strong> line chart of income vs expense for
            the year.
          </li>
          <li>
            <strong>Recent Transactions</strong> and{" "}
            <strong>Per-Organization Detail</strong> table.
          </li>
          <li>
            <strong>Needs attention</strong> widget surfaces over-budget
            organizations, transactions stuck in <em>pending</em>/<em>approved</em> for
            more than 14 days, expenses ≥ ₱1,000 with no attached receipt, and
            unusually large expenses (top 5% year-to-date).
          </li>
          <li>
            <strong>+ Allotment</strong> button records the quarterly stake
            allotment as an income transaction. The amount, organization and
            category from the last allotment are pre-filled.
          </li>
          <li>
            <strong>Print / PDF</strong> button opens the browser's print
            dialog. Choose <em>Save as PDF</em> as the destination to produce a
            clean, printable statement (nav and toolbars are hidden).
          </li>
        </ul>
      </Section>

      <Section title="Templates">
        <p>
          For recurring transactions (monthly utility, weekly supplies, etc.)
          you can save a template that pre-fills everything except the date and
          amount.
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            From <strong>Add Transaction</strong>, fill the form, then click{" "}
            <em>Save as template</em> at the bottom.
          </li>
          <li>
            Next time, pick a template from the <em>Use a template</em> bar at
            the top of the Add Transaction form.
          </li>
          <li>
            Manage templates from the <strong>Templates</strong> page (rename,
            duplicate, edit, delete).
          </li>
        </ul>
      </Section>

      <Section title="CSV Import">
        <p>
          On the <strong>Transactions</strong> page, click <em>Import CSV</em>{" "}
          to bulk-add transactions from a spreadsheet (Excel, Google Sheets).
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Click <em>Download CSV template</em> in the import dialog for a
            ready-to-fill file with the correct headers.
          </li>
          <li>
            Required columns: <code>date, type, amount, organization</code>.
            Optional: <code>category, payee, description, reference, status, notes</code>.
          </li>
          <li>
            Organization and category are matched by name (case-insensitive)
            against the entries you have on this device, so make sure they
            exist before importing.
          </li>
          <li>
            A preview is shown before commit; invalid rows are listed with
            their reasons and skipped.
          </li>
        </ul>
      </Section>

      <Section title="Backups (Important!)">
        <p>
          Browser data can be lost (clearing site data, reinstalling OS, disk
          failure). <strong>Back up regularly.</strong>
        </p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>
            Go to <strong>Settings → Backup &amp; Restore</strong>.
          </li>
          <li>
            Click <strong>Download backup (JSON)</strong>. Save the file to a
            safe location (cloud drive, USB, or a folder you back up).
          </li>
          <li>
            For sensitive data, use <strong>Export encrypted backup</strong>{" "}
            instead. You will choose a passphrase; the resulting{" "}
            <code>.wbtbak</code> file is encrypted with AES-GCM and cannot be
            opened without it.
          </li>
          <li>
            To restore on another device, use <strong>Import</strong> with mode
            "Replace" (start fresh — you will be asked to type{" "}
            <code>REPLACE</code> to confirm) or "Merge" (combine with existing).
            For encrypted files you will be prompted for the passphrase.
          </li>
        </ol>
        <p>
          Each backup file includes a SHA-256 integrity hash. Import will
          refuse a file whose contents have been altered.
        </p>
        <p>Suggested cadence: at least weekly, plus before any major change.</p>
      </Section>

      <Section title="Auto-Backup Folder (Chrome / Edge)">
        <p>
          In Chrome / Edge / Opera you can pick a folder once and the app
          will write a fresh backup there automatically when due. Each backup
          is verified by reading the file back and recomputing its hash.
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Default cadence: daily; configurable 1–30 days.</li>
          <li>
            Default retention: keep the last 30 backups; older files are
            pruned automatically. Configurable 1–180.
          </li>
          <li>
            Pick a cloud-synced folder (OneDrive, iCloud, Google Drive,
            Dropbox, Syncthing) so your backups replicate off-device.
          </li>
        </ul>
      </Section>

      <Section title="Reports &amp; CSV Export">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Reports</strong> page shows annual totals, quarterly
            breakdowns, by category, and monthly summary.
          </li>
          <li>Each report has its own CSV export.</li>
          <li>
            CSVs can be opened in Excel, Google Sheets, or LibreOffice for
            sharing in bishopric meetings or with the stake.
          </li>
        </ul>
      </Section>

      <Section title="Privacy &amp; Security Notes">
        <ul className="list-disc pl-6 space-y-1">
          <li>Data never leaves this device unless you export it manually.</li>
          <li>Use a device lock/password on the laptop or PC running this app.</li>
          <li>
            Avoid storing highly sensitive PII (e.g., full bank info) — keep
            transaction notes minimal.
          </li>
          <li>
            Receipts are embedded in your local database. Be mindful when
            sharing backup files. Receipt files are limited to{" "}
            <strong>2 MB</strong> each (PNG, JPG, GIF, WEBP, HEIC, or PDF).
          </li>
        </ul>
      </Section>

      <Section title="App Lock (Optional PIN/Passphrase)">
        <p>
          You can require a PIN or passphrase before the app opens. This is an{" "}
          <em>access gate</em> against casual browser snooping — it is{" "}
          <strong>not</strong> full-disk encryption. The underlying browser
          data could still be read by someone with full device access, so
          continue to keep the device itself secured. For confidential
          backups, also use the <em>Export encrypted backup</em> option.
        </p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>
            Go to <strong>Settings → App Lock</strong>.
          </li>
          <li>
            Enter a PIN or passphrase (minimum 4 characters) twice and click{" "}
            <strong>Enable lock</strong>.
          </li>
          <li>
            Adjust <strong>Auto-lock after idle</strong> (default 10 minutes;
            0 disables) and <strong>Lock when this tab is hidden</strong> as
            you prefer.
          </li>
        </ol>
        <p>
          After 10 failed unlock attempts the app blocks all attempts for{" "}
          <strong>15 minutes</strong>. There is no recovery from a forgotten
          PIN — you will need to clear the app's site data and restore from a
          backup file. Always keep an up-to-date backup.
        </p>
      </Section>

      <Section title="Active Actor">
        <p>
          Open <strong>Settings → Active Actor</strong> and choose
          <strong> Bishop</strong>, <strong> Clerk</strong>,{" "}
          <strong>Asst. Clerk</strong>, or <strong>Other</strong> (with a
          free-form name). The chosen name is stamped onto every entry in
          the Audit Log. Update it whenever a different person uses the app
          on this device.
        </p>
      </Section>

      <Section title="Year Management & Carry-Over">
        <p>
          Open <strong>Settings → Year Management</strong> to see every
          year that has data. Each year is either <strong>Open</strong> or{" "}
          <strong>Closed</strong>.
        </p>
        <ul className="list-disc ml-6 space-y-1">
          <li>
            <strong>Close a year</strong> (with the <code>CLOSE</code>{" "}
            confirmation) to lock all edits for that year. Closed-year
            transactions, allocations, allotment quick-adds, and CSV
            imports are rejected with a clear message. The Dashboard and
            Reports show a <em>Year YYYY closed</em> badge.
          </li>
          <li>
            <strong>Carry-over</strong> — when closing, a preview lists
            each organization's remaining balance (allocated + income −
            spent). Tick the orgs you want to carry forward and edit the
            per-org amount; on confirm the app creates (or augments) the
            next year's annual (Q0) allocations and writes a single audit
            entry.
          </li>
          <li>
            <strong>Reopen</strong> any year with one click to allow edits
            again. Reopening does not reverse prior carry-overs.
          </li>
        </ul>
      </Section>

      <Section title="Category Limits">
        <p>
          Open <strong>Settings → Category Limits</strong> to set a
          yearly cap per <strong>(organization, category)</strong>. The
          card shows the current spend, percent used, and remaining for
          each limit you've configured.
        </p>
        <ul className="list-disc ml-6 space-y-1">
          <li>
            When a transaction would push a category over its cap, the
            app shows a soft <em>Save anyway / Review</em> confirmation —
            it's guidance, not a hard block.
          </li>
          <li>
            The <strong>Needs attention</strong> widget on the Dashboard
            highlights categories that are over (high) or near (medium)
            their limit.
          </li>
          <li>
            The <strong>Reports</strong> page includes a{" "}
            <em>Category Limits Usage</em> table for the chosen year,
            exportable to CSV.
          </li>
        </ul>
      </Section>

      <Section title="Audit Log">
        <p>
          Every create, update, and delete on transactions, allocations,
          organizations, categories, and key settings is recorded in the
          <strong> Audit Log</strong>. Open it from the navigation bar.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Filter by entity, action (create / update / delete / restore / purge), or actor.</li>
          <li>Search the summary text.</li>
          <li>Export the filtered view to CSV.</li>
          <li>Entries older than 365 days are pruned automatically at startup.</li>
          <li>The audit log is included in JSON backups (encrypted or plain).</li>
        </ul>
      </Section>

      <Section title="Trash & Undo">
        <p>
          Deleting a transaction or allocation moves it to <strong>Trash</strong>{" "}
          rather than removing it permanently. An 8-second{" "}
          <strong>Undo</strong> toast appears immediately after each delete.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Open <strong>Trash</strong> from the navigation to <strong>Restore</strong> or <strong>Delete forever</strong>.</li>
          <li>Trash items auto-purge after 30 days.</li>
          <li>"Empty Trash" requires typing <strong>EMPTY</strong> to confirm.</li>
          <li>Trashed rows are excluded from Dashboard, Reports, and the regular Transactions/Budget pages.</li>
        </ul>
      </Section>

      <Section title="Multi-Tab Safety">
        <p>
          If you happen to open the app in more than one tab or window, edits in
          one tab are pushed to the others through the browser. A small{" "}
          <em>"Updated from another tab"</em> banner appears for a few
          seconds; the lists already refresh on their own.
        </p>
      </Section>

      <Section title="Dark Mode">
        <p>
          Three modes are available — <strong>Auto</strong> (follow OS),{" "}
          <strong>Light</strong>, and <strong>Dark</strong>. Toggle from the
          sun/moon button in the header, or pick a specific mode under{" "}
          <strong>Settings → Appearance</strong>. Your choice is remembered on
          this device.
        </p>
      </Section>

      <Section title="Advanced Search & Saved Searches">
        <p>
          On the Transactions page, click <strong>Show advanced filters</strong>
          {" "}
          for date range, amount range, multi-select organizations / categories
          / statuses, and a "has receipt" filter. Save the current filter set
          as a named <strong>saved search</strong> and apply it later with one
          click. Saved searches live on this device only.
        </p>
      </Section>

      <Section title="Receipt Viewer">
        <p>
          When a transaction has an attached receipt, click <strong>View</strong>
          {" "}
          in the Receipt column. Images can be zoomed (+ / − keys, Ctrl + scroll
          wheel, or the on-screen buttons) and PDFs are embedded inline. The
          viewer also has Download and Open buttons for opening the file in a
          new tab.
        </p>
      </Section>

      <Section title="Keyboard Shortcuts">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Press <kbd>?</kbd> (Shift + /) any time for the full cheatsheet.
          </li>
          <li>
            <kbd>G</kbd> then <kbd>D</kbd> / <kbd>T</kbd> / <kbd>B</kbd> /{" "}
            <kbd>R</kbd> / <kbd>S</kbd> / <kbd>H</kbd> — go to Dashboard /
            Transactions / Budget / Reports / Settings / Help.
          </li>
          <li>
            <kbd>N</kbd> — Add a new transaction (on Dashboard or Transactions).
          </li>
          <li>
            <kbd>L</kbd> — Lock the app immediately (when a PIN is set).
          </li>
          <li>
            <kbd>Esc</kbd> — Close the current dialog.
          </li>
        </ul>
        <p className="mt-2">
          Shortcuts are ignored while you are typing inside a form field.
        </p>
      </Section>

      <Section title="Onboarding Checklist">
        <p>
          A short setup checklist appears on the Dashboard the first time you
          open the app: ward name, active actor, auto-backup folder, and your
          first allocation. It ticks itself off as you complete each step and
          disappears when everything is done. You can dismiss it manually with
          <strong> Hide checklist</strong>.
        </p>
      </Section>

      <Section title="Backup Reminders">
        <p>
          When you make changes and have not backed up in over 7 days (or
          ever), an amber <strong>"Backup reminder"</strong> banner appears at
          the top of the app. Clicking it takes you to Settings to download a
          fresh backup. You can dismiss the banner for the current session.
        </p>
      </Section>

      <Section title="Installing as an App (PWA)">
        <ol className="list-decimal pl-6 space-y-1">
          <li>
            Open this site in Chrome, Edge, or another modern browser.
          </li>
          <li>
            In the address bar, click the <strong>Install</strong> icon (or use
            browser menu → "Install app" / "Add to Home screen").
          </li>
          <li>
            The app will work offline once loaded, even without internet.
          </li>
        </ol>
      </Section>

      <Section title="Troubleshooting">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Data missing?</strong> Make sure you're using the same
            browser profile on the same device. Use Import to restore a
            backup.
          </li>
          <li>
            <strong>Charts empty?</strong> Add some allocations and
            transactions for the selected year/quarter.
          </li>
          <li>
            <strong>Need to reset?</strong> Settings → "Wipe all data" (back up
            first — you will be asked to type <code>WIPE</code> to confirm).
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-lg font-semibold text-slate-800 mb-2">{title}</h2>
      <div className="text-sm text-slate-700 space-y-2">{children}</div>
    </section>
  );
}
