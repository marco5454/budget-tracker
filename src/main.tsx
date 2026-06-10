import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { seedIfEmpty } from "./db/seed";
import { ToastProvider } from "./components/Toast";
import { ConfirmProvider } from "./components/Confirm";
import ErrorBoundary from "./components/ErrorBoundary";
import LockGate from "./components/LockGate";
import { LockStateProvider } from "./hooks/useLockState";
import { maybeRunAutoBackup } from "./utils/autoBackup";
import { pruneAuditLog } from "./utils/audit";
import { autoPurgeOldTrash } from "./utils/trash";

async function startupTasks() {
  await seedIfEmpty();
  // Run housekeeping tasks in parallel; failures are non-fatal.
  await Promise.allSettled([
    pruneAuditLog(),
    autoPurgeOldTrash(),
    maybeRunAutoBackup(),
  ]);
}

startupTasks().catch((err) => console.error("Startup task failed:", err));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <LockStateProvider>
            <LockGate>
              <HashRouter>
                <App />
              </HashRouter>
            </LockGate>
          </LockStateProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
