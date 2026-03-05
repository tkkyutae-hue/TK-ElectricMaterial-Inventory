import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

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
