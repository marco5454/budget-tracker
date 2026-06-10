import { NavLink, Outlet } from "react-router-dom";
import { useSetting } from "../hooks/useSetting";
import BackupReminderBanner from "./BackupReminderBanner";
import MultiTabBanner from "./MultiTabBanner";

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

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-brand-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-white/15 grid place-items-center font-bold">
              W
            </div>
            <div>
              <div className="font-semibold leading-tight">
                Ward Budget Tracker
              </div>
              <div className="text-xs text-brand-100 leading-tight">
                {wardName ? wardName : "Supplementary tracker (not MLS/LCR)"}
              </div>
            </div>
          </div>
          <div className="text-xs text-brand-100 hidden sm:block">
            Offline-first · Local data only
          </div>
        </div>
        <nav className="bg-brand-800">
          <div className="max-w-7xl mx-auto px-2 flex flex-wrap gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
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
    </div>
  );
}
