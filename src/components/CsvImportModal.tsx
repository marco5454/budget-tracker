import { useState } from "react";
import Modal from "./Modal";
import { useToast } from "./Toast";
import {
  commitCsvImport,
  CSV_HEADERS,
  CSV_TEMPLATE_EXAMPLE,
  validateCsvText,
  type CsvParseResult,
} from "../utils/csvImport";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function CsvImportModal({ open, onClose, onImported }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const [result, setResult] = useState<CsvParseResult | null>(null);
  const [showInvalidOnly, setShowInvalidOnly] = useState(false);

  const reset = () => {
    setFilename(null);
    setResult(null);
    setShowInvalidOnly(false);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("CSV file is too large (max 5 MB).");
      return;
    }
    setBusy(true);
    setFilename(file.name);
    try {
      const text = await file.text();
      const r = await validateCsvText(text);
      setResult(r);
      if (r.headerErrors.length) {
        toast.error("CSV header is invalid. See details in the preview.");
      } else if (r.validCount === 0) {
        toast.warning("No valid rows found. Fix errors and re-upload.");
      } else if (r.invalidCount > 0) {
        toast.warning(
          `${r.validCount} valid, ${r.invalidCount} invalid. Only valid rows will be imported.`,
        );
      } else {
        toast.success(`${r.validCount} valid row(s) ready to import.`);
      }
    } catch (err) {
      toast.error(`Failed to read CSV: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + CSV_TEMPLATE_EXAMPLE], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ward-budget-csv-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const commit = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const n = await commitCsvImport(result);
      toast.success(`Imported ${n} transaction(s).`);
      reset();
      onImported();
      onClose();
    } catch (err) {
      toast.error(`Import failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const visibleRows =
    result && showInvalidOnly
      ? result.rows.filter((r) => r.errors.length > 0)
      : result?.rows ?? [];

  return (
    <Modal open={open} title="Import transactions from CSV" onClose={handleClose} widthClass="max-w-5xl">
      <div className="space-y-4">
        {!result && (
          <div className="space-y-3">
            <div className="text-sm text-slate-700">
              Upload a CSV with these column headers (header row required):
            </div>
            <div className="rounded bg-slate-50 border px-3 py-2 text-xs font-mono break-all">
              {CSV_HEADERS.join(",")}
            </div>
            <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
              <li>
                <strong>date</strong>: YYYY-MM-DD. <strong>type</strong>: expense or income.
                <strong> amount</strong>: positive number. <strong>organization</strong>: must
                match an existing org name.
              </li>
              <li>
                <strong>category</strong> is optional but if given must match an existing
                category. <strong>status</strong> defaults to <code>paid</code>.
              </li>
              <li>
                The other columns (payee, description, reference, notes) are optional free-text.
              </li>
              <li>
                Org/category names are matched case-insensitively. Add missing orgs in{" "}
                <em>Settings</em> first.
              </li>
            </ul>
            <div className="flex flex-wrap gap-2 items-center">
              <button type="button" className="btn-secondary" onClick={downloadTemplate}>
                Download CSV template
              </button>
              <label className="btn-primary cursor-pointer">
                Choose CSV file…
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {busy && <span className="text-sm text-slate-500">Reading…</span>}
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <strong>{filename}</strong> ·{" "}
                <span className="text-green-700">{result.validCount} valid</span> ·{" "}
                <span className="text-red-700">{result.invalidCount} invalid</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={showInvalidOnly}
                    onChange={(e) => setShowInvalidOnly(e.target.checked)}
                  />
                  Show invalid only
                </label>
                <button type="button" className="text-sm text-slate-600 underline" onClick={reset}>
                  Choose different file
                </button>
              </div>
            </div>

            {result.headerErrors.length > 0 && (
              <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                <div className="font-semibold mb-1">Header errors:</div>
                <ul className="list-disc pl-5 space-y-1">
                  {result.headerErrors.map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.rows.length > 0 && (
              <div className="overflow-x-auto max-h-[50vh] border rounded">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr className="text-left">
                      <th className="py-1 px-2">Row</th>
                      <th className="py-1 px-2">Status</th>
                      <th className="py-1 px-2">Date</th>
                      <th className="py-1 px-2">Type</th>
                      <th className="py-1 px-2 text-right">Amount</th>
                      <th className="py-1 px-2">Org</th>
                      <th className="py-1 px-2">Category</th>
                      <th className="py-1 px-2">Payee</th>
                      <th className="py-1 px-2">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={`border-b ${
                          row.errors.length > 0 ? "bg-red-50" : ""
                        }`}
                      >
                        <td className="py-1 px-2">{row.rowNumber}</td>
                        <td className="py-1 px-2">
                          {row.errors.length > 0 ? (
                            <span className="badge bg-red-100 text-red-700 border-red-200">
                              skip
                            </span>
                          ) : (
                            <span className="badge bg-green-100 text-green-700 border-green-200">
                              ok
                            </span>
                          )}
                        </td>
                        <td className="py-1 px-2 whitespace-nowrap">{row.raw.date}</td>
                        <td className="py-1 px-2">{row.raw.type}</td>
                        <td className="py-1 px-2 text-right whitespace-nowrap">{row.raw.amount}</td>
                        <td className="py-1 px-2">{row.raw.organization}</td>
                        <td className="py-1 px-2">{row.raw.category || "—"}</td>
                        <td className="py-1 px-2">{row.raw.payee || "—"}</td>
                        <td className="py-1 px-2 text-red-700">
                          {row.errors.map((e, i) => (
                            <div key={i}>
                              {e.field ? <strong>{e.field}: </strong> : null}
                              {e.message}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={commit}
                disabled={busy || result.headerErrors.length > 0 || result.validCount === 0}
              >
                {busy ? "Importing…" : `Import ${result.validCount} valid row(s)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
