# Portable Setup — On-the-Go Bishop / Clerk Use

This guide explains how to take **Ward Budget Tracker** with you on a USB stick and run it on any Windows / macOS / Linux laptop without installing anything. Total footprint on the stick: about **1 MB**.

> ⚠ **Reminder:** This is an unofficial personal/internal tool. It is **not** affiliated with The Church of Jesus Christ of Latter-day Saints, and it is **not** a replacement for MLS / LCR. Always reconcile with the official record. Treat backup files and CSV exports as confidential financial records.

---

## Quick reference

| You want to… | Do this |
|---|---|
| Build the portable bundle | `npm run package-portable` (one-time, on a developer machine) |
| Launch on Windows | Double-click `Launch-Windows.bat` |
| Launch on macOS | Right-click `Launch-macOS.command` → Open (first time) |
| Launch on Linux | `./Launch-Linux.sh` |
| Move data between computers | Auto-Backup → USB `Backups\` → Import on the other machine |
| Encrypt before moving | Settings → Backup & Restore → **Export encrypted backup** (`.wbtbak`) |

---

## 1. Build the portable bundle (one-time, on the developer machine)

From the project root:

```bash
npm install
npm run package-portable
```

This produces:

- `dist-portable/WardBudgetTracker-Portable/` — the runnable folder (~1 MB)
- `dist-portable/WardBudgetTracker-Portable.zip` — single-file zip for sharing (~300 KB)

You only need to do this once per release. After that, just copy the folder around.

---

## 2. What's inside the portable folder

```
WardBudgetTracker-Portable/
  Launch-Windows.bat       <-- double-click on Windows
  Launch-Linux.sh          <-- run on Linux
  Launch-macOS.command     <-- double-click on macOS
  app/                     <-- the built web app (HTML, JS, CSS, icons, service worker)
  README.md
  DISCLAIMER.txt
```

No Node.js, no installer, no internet required. The launchers just open `app/index.html` in your default browser.

---

## 3. Copy to a USB stick

**Recommended layout** on the stick:

```
USB:\
  WardBudgetTracker-Portable\
    Launch-Windows.bat
    Launch-Linux.sh
    Launch-macOS.command
    app\
    README.md
    DISCLAIMER.txt
  Backups\                 <-- create this empty folder; Auto-Backup writes here
```

Steps:

1. Plug in the stick.
2. Drag-copy the entire `WardBudgetTracker-Portable\` folder onto the stick.
3. Right-click → New Folder → name it exactly **`Backups`** next to the app folder.
4. Eject safely. The stick is ready.

> Keep the stick clean — don't co-mingle other random documents in the same folder. A purpose-built stick (or partition) reduces the chance of accidentally deleting something.

---

## 4. First run on a new computer

1. Plug in the stick.
2. Double-click the launcher for that OS:
   - **Windows:** `Launch-Windows.bat`
   - **macOS:** `Launch-macOS.command` (the **very first time only**, right-click → Open and confirm "Run anyway")
   - **Linux:** `./Launch-Linux.sh` (you may need to mark it executable: `chmod +x Launch-Linux.sh`)
3. Your default browser opens the app from a `file://` URL.
4. The first-run **Disclaimer** screen appears. Read it carefully, tick the box, click **Continue**.
5. Set up the essentials (do this **once per computer**):
   - **Settings → Ward Information** — type your ward name + Save.
   - **Settings → Active Actor** — pick Bishop / Clerk / Asst. Clerk + Save.
   - **Settings → Auto-Backup** (Chrome / Edge only) — click "Choose backup folder…" and pick `Backups\` on the same USB stick. Set the frequency (default daily) and retention (default 30 backups).
   - **Settings → App Lock** — set a 4+ char PIN. The app will idle-lock after 10 min by default.
6. **If this is a brand-new computer with no data yet** and you're moving from another computer, go to **Settings → Backup & Restore → Import backup** and pick the most recent file from `Backups\`.

---

## 5. CRITICAL: how data actually moves between computers

This is the most-misunderstood part of the portable setup. **Read this carefully.**

> Your data lives in **the browser profile of whatever computer you're using right now.** The USB stick only carries the *app code* and any backup files you put in `Backups\`. It does **not** carry the database itself.

Practical consequences:

- If you launch the app on **Computer A**, work on it for a week, then plug the same stick into **Computer B**, **Computer B starts empty.** The data is not "on the stick".
- To get Computer A's data onto Computer B, you must **export a backup from A**, save it on the stick, and **import it on B**.
- **Auto-Backup automates the export step.** If you've enabled Auto-Backup on Computer A pointing at `Backups\`, then `Backups\` already has the latest data — you just need to *import it on B*.

### The recommended workflow

1. **One source of truth.** Pick the bishop's PC as the primary machine. All transactions are entered there.
2. **Auto-Backup on the primary** writes daily snapshots into `USB:\Backups\` (e.g. `ward-budget-backup-2026-06-10T09-30-00.json`).
3. **Other computers (laptop)** are *read-only mirrors*. When you need to use the laptop:
   - Plug in stick.
   - Launch the app.
   - **Settings → Backup & Restore → Import backup** → pick the latest file in `Backups\`.
   - **Replace** mode if you want a clean mirror; **Merge** if you've added new data on the laptop you don't want to lose. (Replace is safer if the primary is the source of truth.)
4. **If you make changes on the laptop**, export a fresh backup before unplugging, then import it back on the primary.

### Why not auto-sync?

Browsers cannot read/write across browser profiles. The File System Access API (used by Auto-Backup) only writes to the folder you picked, on the device you authorized. There's no built-in sync — that would require an online server, which would defeat the offline-first design.

If you want true multi-device sync without manual import/export, the answer is to upgrade to an online deployment with a shared database. That's a future feature, not a current one.

---

## 6. Best practice checklist (for the bishop)

Use this as your portable-setup checklist:

- [ ] Built the portable folder (`npm run package-portable`).
- [ ] Copied `WardBudgetTracker-Portable\` and an empty `Backups\` folder to the USB stick.
- [ ] Launched on the bishop's PC. Acknowledged disclaimer.
- [ ] Set ward name + active actor in Settings.
- [ ] Enabled Auto-Backup pointing at `USB:\Backups\` (Chrome / Edge).
- [ ] Set a PIN under Settings → App Lock.
- [ ] (Optional) Use **Export encrypted backup (.wbtbak)** with a passphrase before moving the stick to a less-trusted machine.
- [ ] Reconciled monthly with MLS/LCR. Always.
- [ ] Stored the stick in a secure drawer when not in use.

---

## 7. Encryption: when to use it

Plain `.json` backups are unencrypted — anyone with the stick can read them. For higher safety:

- **Settings → Backup & Restore → Encrypted backup** → enter a passphrase twice → **Export encrypted backup** → file is `ward-budget-backup-<date>.wbtbak` (AES-256-GCM, PBKDF2-SHA256 250,000 iterations).
- Keep the encrypted file *and* the passphrase separate (e.g. passphrase memorized; file on stick).
- To restore, **Import** the `.wbtbak` and the app prompts for the passphrase.
- **There is no recovery** if you forget the passphrase. Write it down somewhere safe.

The Auto-Backup feature currently writes plain `.json` for usability; use manual encrypted exports for highly sensitive snapshots before transit.

---

## 8. Sharing limits

- **Do not** distribute this app under any branding that could imply Church endorsement.
- **Do not** post the app, exports, screenshots, or source code publicly.
- **Do not** share your encrypted backup passphrase by the same channel as the file.
- Treat backup files and CSV exports as confidential financial records.

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| macOS says "cannot be opened because it is from an unidentified developer" | Right-click `Launch-macOS.command` → Open → Open. Once approved, double-click works. |
| Linux launcher won't run | `chmod +x Launch-Linux.sh` once, then `./Launch-Linux.sh`. Ensure `xdg-open` (Linux) or `gio` is installed. |
| Windows SmartScreen warning | Click **More info** → **Run anyway**. The launcher is just a `.bat` that opens HTML. |
| Browser shows blank page | Make sure you used the launcher and not opened a random file. The launcher opens `app/index.html`, which is the right entry point. Clear browser cache and reload. |
| "Auto-Backup not supported" | Use Chrome or Edge; Firefox and Safari can't auto-write to a folder. You can still use the manual Download/Import flow. |
| Auto-Backup says "Permission revoked" | Go back to Settings → Auto-Backup → click "Choose backup folder…" and re-select the same folder. Browsers may revoke folder permission across sessions. |
| Data unexpectedly gone | (a) Check **Settings → Trash** (30-day soft-delete). (b) If still missing, restore the most recent backup from `Backups\`. (c) If you're on a different computer than where the data was entered, that's expected — see section 5. |
| App lock screen won't accept my PIN | After 10 wrong attempts the app blocks for 15 minutes. Wait, then try again. If you forgot the PIN entirely, clear the browser site data for the file (DevTools → Application → Clear storage) and import a backup. |
| "Cannot import backup — integrity check failed" | The file was modified or corrupted. Use a different backup. The SHA-256 integrity check is intentional; never bypass it. |
| Backup file shows up but disappears later | Auto-Backup retention pruning (default keeps 30 newest) may have deleted older ones. Increase **Settings → Auto-Backup → Keep last N** (max 180). |
| Switching computers feels confusing | See section 5. Treat one computer as primary, others as mirrors. Always **import** before working on a non-primary. |

---

## 10. Updating to a new version later

When a new version of the app is built:

1. Run `npm run package-portable` again on the developer machine.
2. **Back up first** from the old version on each computer (Settings → Backup & Restore → Download backup) — keep these in case the new version has a migration issue.
3. Copy the new `WardBudgetTracker-Portable\` folder over the old one on the USB stick.
4. Launch the new version on each computer. Your data on each computer is unaffected — it lives in the browser profile, not the folder. The Dexie schema migrates automatically.
5. The first time you launch the new version, you may be re-prompted for the disclaimer if its wording was updated.

If anything goes wrong after an update, use the backup you took in step 2 to restore the previous state (Settings → Backup & Restore → Import → Replace).

---

## 11. Going beyond the USB workflow

The portable setup is great for one bishop with one or two devices. If your situation changes:

- **Multiple clerks needing live access** → upgrade to an online deployment (future feature, would require a server + auth + sync).
- **Just want it on the bishop's PC permanently** → run `npm run start` once and install it as a PWA from the browser. No USB needed; no portable folder needed.
- **Want the data on the stick instead of the browser profile** → not currently supported by browsers' security model. The closest you can get is enabling Auto-Backup to the stick, which makes the stick the *backup* destination but the live database still lives in the browser.

For now, the USB + Auto-Backup pattern is the cleanest portable workflow that respects the offline-first, no-server design.
