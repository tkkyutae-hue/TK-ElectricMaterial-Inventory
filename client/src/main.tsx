import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Suppress benign ResizeObserver loop warnings
// These trigger the Replit dev overlay but are not real app errors
// Radix UI Select/Popover components cause this on every dropdown open
window.addEventListener("error", (e) => {
  if (
    !e.message ||
    e.message === "" ||
    e.message.includes("ResizeObserver") ||
    e.error === null
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
}, true);

window.onerror = function(msg) {
  if (!msg || msg === "" || String(msg).includes("ResizeObserver")) {
    return true; // suppressed
  }
  return false;
};

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
