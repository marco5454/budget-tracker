# Ward Budget Tracker — Portable (Unofficial)

> ⚠ **PERSONAL/INTERNAL USE ONLY.** This is an unofficial tool. It is **not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints**, and it is **not** a replacement for MLS / LCR.
>
> Always reconcile against the official MLS/LCR record. Treat backup files as confidential.

## How to launch

- **Windows:** double-click `Launch-Windows.bat`.
- **macOS:** double-click `Launch-macOS.command` (first time, you may need to right-click → Open and confirm).
- **Linux:** run `./Launch-Linux.sh` from a terminal, or right-click → Run.

The app opens in your default browser, fully offline. There is no installation, no Node.js, and no internet connection required after the first launch.

## Where is my data?

Your data lives **inside the browser profile on whichever computer you opened the app on**. It is *not* stored on this USB stick automatically.

That means:
- If you open it on Computer A and again on Computer B, each computer has its own separate database.
- To move your data between computers, use **Settings → Backup & Restore → Download backup** on the source computer, then **Import** on the target computer.
- It is highly recommended to also enable **Settings → Auto-Backup** and point it at a folder on this same USB stick (Chrome / Edge required) so backups travel with you.

## Recommended USB layout

```
USB:\
  WardBudgetTracker-Portable\
    Launch-Windows.bat
    Launch-Linux.sh
    Launch-macOS.command
    app\
    README.md
  Backups\          <-- point Auto-Backup here
```

## Tips for the bishop / clerk

1. **First time on a new computer** — the disclaimer acknowledgment screen will appear. Read it, tick the box, and Continue.
2. **Always set up Auto-Backup** to the USB `Backups` folder so you never lose data.
3. **Set a PIN** in Settings → App Lock for an extra access barrier on shared computers.
4. **Reconcile with MLS/LCR** monthly — this app is not the source of truth.

## Troubleshooting

- *Browser warns "Insecure"*: that's normal for `file://` paths. Click through.
- *Auto-Backup option is missing*: only Chrome and Edge support automatic folder backups. Use Chrome or Edge.
- *Browser blocks the launcher script (macOS)*: right-click → Open the .command file once to whitelist it.
