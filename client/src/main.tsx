import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// The narrowly scoped development ResizeObserver notice filter is installed
// in index.html, before deferred overlay modules can report it as an exception.

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
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
