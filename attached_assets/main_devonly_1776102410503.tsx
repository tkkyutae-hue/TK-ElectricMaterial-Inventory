import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Suppress benign ResizeObserver loop warnings in development only.
// Radix UI Select/Popover triggers these on every dropdown open.
// The Replit dev overlay catches them as "(unknown runtime error)".
// This is dev-only — has zero effect in production builds.
if (import.meta.env.DEV) {
  window.addEventListener("error", (e) => {
    if (
      !e.message ||
      e.message === "" ||
      e.message.includes("ResizeObserver") ||
      e.error === null
    ) {
      console.warn("[dev] suppressed benign overlay error:", e.message || "(no message)");
      e.stopImmediatePropagation();
      e.preventDefault();
      return;
    }
  }, true);

  window.onerror = function(msg) {
    if (!msg || msg === "" || String(msg).includes("ResizeObserver")) {
      console.warn("[dev] suppressed benign onerror:", msg);
      return true;
    }
    return false;
  };
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("VoltStock Service Worker registered:", reg.scope);
      })
      .catch((err) => {
        console.warn("Service Worker registration failed:", err);
      });
  });
}
