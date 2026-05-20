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

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("VoltStock Service Worker registered:", registration.scope);
      })
      .catch((error) => {
        console.warn("VoltStock Service Worker registration failed:", error);
      });
  });
}

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    })
    .catch((error) => {
      console.warn("VoltStock DEV: failed to unregister service workers", error);
    });

  if ("caches" in window) {
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key.startsWith("voltstock"))
            .map((key) => caches.delete(key))
        );
      })
      .catch((error) => {
        console.warn("VoltStock DEV: failed to clear caches", error);
      });
  }

  console.log("VoltStock DEV mode: service worker disabled and VoltStock caches cleared.");
}
