# Portable Setup — On-the-Go Bishop / Clerk Use

This guide explains how to take **Ward Budget Tracker** with you on a USB stick and run it on any Windows / macOS / Linux laptop without installing anything.

> ⚠ **Reminder:** This is an unofficial personal/internal tool. It is not affiliated with The Church of Jesus Christ of Latter-day Saints, and it is not a replacement for MLS/LCR. Always reconcile with the official record.

---

## 1. Build the portable bundle (one-time, on the developer machine)

From the project root:

```bash
npm install
npm run package-portable
```

This produces:

- `dist-portable/WardBudgetTracker-Portable/` — the runnable folder
- `dist-portable/WardBudgetTracker-Portable.zip` — single-file zip for sharing

The folder is **about 1 MB**. The zip is **about 300 KB**.

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

Recommended layout on the stick:

```
USB:\
  WardBudgetTracker-Portable\
    Launch-Windows.bat
    Launch-Linux.sh
    Launch-macOS.command
    app\
    README.md
    DISCLAIMER.txt
  Backups\                 <-- create this empty folder
```

Just drag-copy the `WardBudgetTracker-Portable` folder onto the stick, then create an empty `Backups` folder next to it.

---

## 4. First run on a new computer

1. Plug in the stick.
2. Double-click the launcher for that OS:
   - **Windows:** `Launch-Windows.bat`
   - **macOS:** `Launch-macOS.command` (first time, right-click → Open and confirm "Run anyway")
   - **Linux:** `./Launch-Linux.sh`
3. Your default browser opens the app.
4. The first-run **Disclaimer** screen appears. Read it, tick the box, click **Continue**.
5. Optional but strongly recommended:
   - Go to **Settings → Auto-Backup** (Chrome / Edge only) and pick the `Backups\` folder on the same USB stick. Backups will then live on the stick automatically.
   - Go to **Settings → App Lock** and set a PIN.

---

## 5. Important: how data moves between computers

Your data lives in **the browser profile of whatever computer you're using**, not on the USB stick by default. So:

- If you launch the app on Computer A, work on it, and then later launch it from the same stick on Computer B, **Computer B starts empty** unless you import a backup.
- Use **Settings → Backup & Restore → Download backup** on Computer A → save the `.json` (or encrypted `.wbtbak`) into `USB:\Backups\`.
- On Computer B, **Settings → Backup & Restore → Import backup** → pick the file from `USB:\Backups\`.
- Even simpler: enable **Auto-Backup** on every computer pointing at `USB:\Backups\`. Each computer will write fresh backups there, and you can cherry-pick the latest when moving.

> If you only ever use one computer (the bishop's), this caveat does not affect you — the data stays put on that computer.

---

## 6. Best practice for the bishop

For a bishop who works **mainly on one PC** (the bishop's PC) but occasionally on a laptop:

1. **Bishop PC** — the source of truth. All data entered here.
2. **Portable folder + USB stick** — kept in the bishop's drawer for occasional use on the laptop.
3. **Auto-Backup folder = USB stick `Backups\`** on both computers.
4. **Workflow** when switching to the laptop:
   - Plug in stick on PC. Settings → Backup & Restore → **Download backup**. Save to `USB:\Backups\`.
   - Move stick to laptop. Launch the app. Settings → Backup & Restore → **Import** the latest file.
   - (Optionally encrypted with `.wbtbak` for extra safety.)

---

## 7. Sharing limits

- **Do not** distribute this app under any branding that could imply Church endorsement.
- **Do not** post the app, exports, or screenshots publicly.
- Treat backup files and CSV exports as confidential financial records.

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| macOS says "cannot be opened because it is from an unidentified developer" | Right-click `Launch-macOS.command` → Open → Open. Once approved, double-click works. |
| Windows SmartScreen warning | Click **More info** → **Run anyway**. |
| Browser shows blank page | Make sure you used the launcher and not opened a random file. The launcher opens `app/index.html`, which is the right entry point. |
| "Auto-Backup not supported" | Use Chrome or Edge; Firefox and Safari can't auto-write to a folder. You can still use the manual Download/Import flow. |
| Data unexpectedly gone | Check **Settings → Trash** (30-day soft-delete). If still missing, restore the most recent backup from `Backups\`. |

---

## 9. Updating to a new version later

When a new version of the app is built:

1. Run `npm run package-portable` again on the developer machine.
2. Copy the new `WardBudgetTracker-Portable/` folder over the old one on the USB stick.
3. Your data on each computer is unaffected — it lives in the browser profile, not the folder.

The first time you launch the new version, you may be re-prompted for the disclaimer if its wording was updated. Otherwise nothing changes.
