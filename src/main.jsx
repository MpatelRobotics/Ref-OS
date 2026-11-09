import { Capacitor } from '@capacitor/core';
import React from "react";
import ReactDOM from "react-dom/client";
const App=React.lazy(()=>import('./App.jsx'));
const JudgingConnector=React.lazy(()=>import('./components/JudgingConnector.jsx'));
const MainJudgeLogin=React.lazy(()=>import('./components/MainJudgeLogin.jsx'));
const params=new URLSearchParams(window.location.search);
const Root=params.get('app')==='judging'?JudgingConnector:params.get('page')==='judge'?MainJudgeLogin:App;
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import UpdateBanner from "./components/UpdateBanner.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <React.Suspense fallback={<p className="p-6">Opening Ref-OS…</p>}><Root /></React.Suspense>
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
