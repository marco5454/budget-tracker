import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useSetting } from "../hooks/useSetting";
import BackupReminderBanner from "./BackupReminderBanner";
import MultiTabBanner from "./MultiTabBanner";
import HeaderThemeToggle from "./HeaderThemeToggle";
import ShortcutsDialog from "./ShortcutsDialog";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/transactions", label: "Transactions" },
  { to: "/budget", label: "Budget" },
  { to: "/templates", label: "Templates" },
  { to: "/reports", label: "Reports" },
  { to: "/audit", label: "Audit Log" },
  { to: "/trash", label: "Trash" },
  { to: "/settings", label: "Settings" },
  { to: "/help", label: "Help" },
];

export default function Layout() {
  const wardName = useSetting<string>("wardName", "");
  const [navOpen, setNavOpen] = useState(false);
  const { shortcutsOpen, openShortcuts, closeShortcuts } = useKeyboardShortcuts();

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-brand-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-md bg-white/15 grid place-items-center font-bold flex-shrink-0">
              W
            </div>
            <div className="min-w-0">
              <div className="font-semibold leading-tight truncate">
                Ward Budget Tracker
              </div>
              <div className="text-xs text-brand-100 leading-tight truncate">
                {wardName ? wardName : "Supplementary tracker (not MLS/LCR)"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-brand-100 hidden md:block">
              Offline-first · Local data only
            </div>
            <HeaderThemeToggle />
            <button
              type="button"
              className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-md bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 text-white text-sm font-bold"
              aria-label="Show keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              onClick={openShortcuts}
            >
              ?
            </button>
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
              aria-label="Toggle navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((o) => !o)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {navOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M3 6h18M3 12h18M3 18h18" />
                )}
              </svg>
            </button>
          </div>
        </div>
        <nav className={`bg-brand-800 ${navOpen ? "block" : "hidden"} md:block`}>
          <div className="max-w-7xl mx-auto px-2 flex flex-col md:flex-row md:flex-wrap gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setNavOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-medium rounded-t ${
                    isActive
                      ? "bg-slate-50 text-brand-800"
                      : "text-brand-50 hover:bg-brand-700"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <BackupReminderBanner />
      <MultiTabBanner />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 py-3 text-xs text-slate-500 flex flex-wrap gap-2 justify-between">
          <div>
            Ward Budget Tracker · Supplementary to the official MLS/LCR system.
          </div>
          <div>Data is stored only on this device.</div>
        </div>
      </footer>
      <ShortcutsDialog open={shortcutsOpen} onClose={closeShortcuts} />
    </div>
  );
}
