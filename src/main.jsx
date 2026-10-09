import { Capacitor } from '@capacitor/core';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import UpdateBanner from "./components/UpdateBanner.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <UpdateBanner />
    </ErrorBoundary>
  </React.StrictMode>,
);

if (!Capacitor.isNativePlatform() && "serviceWorker" in navigator && import.meta.env.VITE_E2E_MOCK !== "1") {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const notify = () => {
        if (registration.waiting) window.dispatchEvent(new CustomEvent("refos:update-available", { detail: { registration } }));
      };
      notify();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) notify();
        });
      });
      setInterval(() => registration.update().catch(() => {}), 15 * 60 * 1000);
    } catch {}
  });
}
