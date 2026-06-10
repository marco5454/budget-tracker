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

seedIfEmpty().catch((err) => console.error("Seed failed:", err));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <LockGate>
            <HashRouter>
              <App />
            </HashRouter>
          </LockGate>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
