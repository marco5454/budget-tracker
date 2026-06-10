import { useSetting } from "../hooks/useSetting";

interface Props {
  title: string;
  subtitle?: string;
}

/**
 * Block that's hidden on screen and shown on print, providing an
 * official-looking header for printed/PDF reports.
 */
export default function PrintHeader({ title, subtitle }: Props) {
  const wardName = useSetting<string>("wardName", "");
  const now = new Date().toLocaleString();
  return (
    <div className="print-only mb-4">
      <div style={{ borderBottom: "2px solid #000", paddingBottom: 6 }}>
        <div style={{ fontSize: "16pt", fontWeight: 700 }}>
          {wardName ? wardName : "Ward Budget Tracker"}
        </div>
        <div style={{ fontSize: "13pt", marginTop: 2 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: "11pt", color: "#333", marginTop: 2 }}>
            {subtitle}
          </div>
        )}
        <div style={{ fontSize: "9pt", color: "#666", marginTop: 4 }}>
          Generated {now}
        </div>
        <div
          style={{
            marginTop: 6,
            padding: "4px 6px",
            border: "1px solid #999",
            fontSize: "8.5pt",
            fontWeight: 600,
            color: "#000",
            background: "#fff7cc",
          }}
        >
          UNOFFICIAL · Personal/internal tracker. Not affiliated with The Church
          of Jesus Christ of Latter-day Saints. Not a replacement for MLS/LCR.
          Always reconcile with the official record.
        </div>
      </div>
    </div>
  );
}
