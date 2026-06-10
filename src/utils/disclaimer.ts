// Single source of truth for all disclaimer copy across the app.
// If you change wording, change it here.

export const DISCLAIMER_SHORT =
  "Personal/internal tool · Not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints · Not a replacement for MLS/LCR.";

export const DISCLAIMER_TITLE = "Important: Personal use only";

export const DISCLAIMER_PARAGRAPHS: string[] = [
  "This app is a personal, unofficial tracking tool built for the convenience of a ward bishopric or clerk. It is NOT an official application of The Church of Jesus Christ of Latter-day Saints, and it is NOT affiliated with, endorsed by, or sponsored by the Church.",
  "The official system of record for ward finances is MLS / LCR. Always reconcile any data in this app against MLS/LCR. Do not use this app's exports or printouts as official Church documents.",
  "All data stays on this device. Treat backup files and exports as confidential financial records. Keep the device itself secured.",
  "The app's name, icons, and content are intentionally neutral. Please do not redistribute it under any branding that could imply Church endorsement.",
];

// Used as the very first row of every CSV export.
// Prefixed with "# " so most spreadsheet apps treat it as a comment-like note.
export const DISCLAIMER_CSV_LINE = `# ${DISCLAIMER_SHORT}`;
