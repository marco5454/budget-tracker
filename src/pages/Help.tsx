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
            To restore on another device, use <strong>Import</strong> with mode
            "Replace" (start fresh — you will be asked to type{" "}
            <code>REPLACE</code> to confirm) or "Merge" (combine with existing).
          </li>
        </ol>
        <p>Suggested cadence: at least weekly, plus before any major change.</p>
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
          <em>access gate</em>, not encryption — anyone with full access to the
          device's browser data could still read the underlying records, so
          continue to keep the device itself secured.
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
            From now on, the app will prompt for the PIN before showing any
            data.
          </li>
        </ol>
        <p>
          <strong>Important:</strong> if you forget the PIN, there is no
          recovery. You will need to clear the app's site data and restore from
          a backup file. Always keep an up-to-date backup.
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
