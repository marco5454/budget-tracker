// Build the app, then assemble a self-contained portable folder
// (and zip) that runs by simply opening dist/index.html in a browser.
//
// Output: dist-portable/WardBudgetTracker-Portable/
//         dist-portable/WardBudgetTracker-Portable.zip
//
// The portable folder works on Windows, Linux, macOS — copy to a USB
// stick (or laptop) and double-click the launcher for your OS.

import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const outRoot = path.join(repoRoot, "dist-portable");
const folderName = "WardBudgetTracker-Portable";
const portableDir = path.join(outRoot, folderName);

async function rmrf(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

async function writeFile(p, content, mode) {
  await fs.writeFile(p, content);
  if (mode != null) await fs.chmod(p, mode);
}

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: repoRoot, ...opts });
}

async function main() {
  // 1. Fresh build.
  console.log("Building production bundle…");
  run("npm run build");

  // 2. Reset output folder.
  await rmrf(outRoot);
  await fs.mkdir(portableDir, { recursive: true });

  // 3. Copy dist/ contents.
  console.log("Copying dist/ into portable folder…");
  await copyDir(distDir, path.join(portableDir, "app"));

  // 4. Launcher scripts that open index.html in the default browser.
  // Windows
  await writeFile(
    path.join(portableDir, "Launch-Windows.bat"),
    [
      "@echo off",
      "REM Ward Budget Tracker — portable launcher (Windows)",
      "REM Opens the app in your default browser. Fully offline.",
      "cd /d %~dp0",
      'start "" "%~dp0app\\index.html"',
      "exit",
      "",
    ].join("\r\n"),
  );

  // Linux
  await writeFile(
    path.join(portableDir, "Launch-Linux.sh"),
    [
      "#!/usr/bin/env bash",
      "# Ward Budget Tracker — portable launcher (Linux)",
      "# Opens the app in your default browser. Fully offline.",
      'DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
      'URL="file://$DIR/app/index.html"',
      'if command -v xdg-open >/dev/null 2>&1; then',
      '  xdg-open "$URL"',
      'elif command -v gio >/dev/null 2>&1; then',
      '  gio open "$URL"',
      "else",
      '  echo "Could not detect a browser opener. Open this URL manually:"',
      '  echo "$URL"',
      "fi",
      "",
    ].join("\n"),
    0o755,
  );

  // macOS — uses .command extension so Finder treats it as runnable
  await writeFile(
    path.join(portableDir, "Launch-macOS.command"),
    [
      "#!/usr/bin/env bash",
      "# Ward Budget Tracker — portable launcher (macOS)",
      'DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
      'open "$DIR/app/index.html"',
      "",
    ].join("\n"),
    0o755,
  );

  // 5. README inside the portable folder.
  const portableReadme = `# Ward Budget Tracker — Portable (Unofficial)

> ⚠ **PERSONAL/INTERNAL USE ONLY.** This is an unofficial tool. It is **not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints**, and it is **not** a replacement for MLS / LCR.
>
> Always reconcile against the official MLS/LCR record. Treat backup files as confidential.

## How to launch

- **Windows:** double-click \`Launch-Windows.bat\`.
- **macOS:** double-click \`Launch-macOS.command\` (first time, you may need to right-click → Open and confirm).
- **Linux:** run \`./Launch-Linux.sh\` from a terminal, or right-click → Run.

The app opens in your default browser, fully offline. There is no installation, no Node.js, and no internet connection required after the first launch.

## Where is my data?

Your data lives **inside the browser profile on whichever computer you opened the app on**. It is *not* stored on this USB stick automatically.

That means:
- If you open it on Computer A and again on Computer B, each computer has its own separate database.
- To move your data between computers, use **Settings → Backup & Restore → Download backup** on the source computer, then **Import** on the target computer.
- It is highly recommended to also enable **Settings → Auto-Backup** and point it at a folder on this same USB stick (Chrome / Edge required) so backups travel with you.

## Recommended USB layout

\`\`\`
USB:\\
  WardBudgetTracker-Portable\\
    Launch-Windows.bat
    Launch-Linux.sh
    Launch-macOS.command
    app\\
    README.md
  Backups\\          <-- point Auto-Backup here
\`\`\`

## Tips for the bishop / clerk

1. **First time on a new computer** — the disclaimer acknowledgment screen will appear. Read it, tick the box, and Continue.
2. **Always set up Auto-Backup** to the USB \`Backups\` folder so you never lose data.
3. **Set a PIN** in Settings → App Lock for an extra access barrier on shared computers.
4. **Reconcile with MLS/LCR** monthly — this app is not the source of truth.

## Troubleshooting

- *Browser warns "Insecure"*: that's normal for \`file://\` paths. Click through.
- *Auto-Backup option is missing*: only Chrome and Edge support automatic folder backups. Use Chrome or Edge.
- *Browser blocks the launcher script (macOS)*: right-click → Open the .command file once to whitelist it.
`;
  await writeFile(path.join(portableDir, "README.md"), portableReadme);

  // 6. Disclaimer file (extra emphasis).
  const disclaimerText = `WARD BUDGET TRACKER — UNOFFICIAL DISCLAIMER

This software is a personal, unofficial tracking tool. It is NOT an official
application of The Church of Jesus Christ of Latter-day Saints, and it is
NOT affiliated with, endorsed by, or sponsored by the Church.

The official system of record for ward finances is MLS / LCR. Always
reconcile any data in this app against MLS/LCR. Do not use this app's
exports, screenshots, or printouts as official Church documents.

All data is stored locally on the device. Treat backup files and exports
as confidential financial records. Keep the device secured.

Please do not redistribute this app under any branding that could imply
Church endorsement.
`;
  await writeFile(path.join(portableDir, "DISCLAIMER.txt"), disclaimerText);

  // 7. Zip everything up.
  console.log("Creating ZIP…");
  // Cross-platform zip via node — use 'archiver' if available, else fall back to system zip.
  try {
    // Prefer the `zip` binary (works on Linux/macOS; rarely on Windows shells).
    run(`zip -rq ${folderName}.zip ${folderName}`, { cwd: outRoot });
  } catch {
    console.warn(
      "  zip command not available; skipping .zip creation. The folder is still ready at:",
    );
  }

  console.log("");
  console.log(`Portable folder ready: ${path.relative(repoRoot, portableDir)}`);
  console.log(
    `Zip:                ${path.relative(repoRoot, path.join(outRoot, folderName + ".zip"))} (if zip was available)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
