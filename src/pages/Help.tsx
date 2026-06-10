export default function Help() {
  return (
    <div className="prose prose-slate max-w-none space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Help &amp; Instructions</h1>
        <p className="text-sm text-slate-500">
          A quick guide for clerks and bishopric members using this tracker.
        </p>
      </div>

      <Section title="Important: Disclaimer">
        <p>
          This app is a <strong>supplementary tracker</strong>. It is{" "}
          <strong>not</strong> a replacement for the official Church
          Membership/Leader/Local Church (MLS / LCR) financial system, which
          remains the system of record. Always reconcile with official church
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
