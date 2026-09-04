import React, { useEffect, useState } from "react";
import { APP_VERSION } from "../appVersion";

export default function UpdateBanner() {
  const [registration, setRegistration] = useState(null);
  useEffect(() => {
    const handler = (event) => setRegistration(event.detail?.registration || null);
    window.addEventListener("refos:update-available", handler);
    return () => window.removeEventListener("refos:update-available", handler);
  }, []);
  if (!registration) return null;
  const updateNow = () => {
    const worker = registration.waiting;
    if (!worker) { location.reload(); return; }
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
    worker.postMessage({ type: "SKIP_WAITING" });
  };
  return (
    <div className="fixed left-3 right-3 bottom-3 z-[120] max-w-xl mx-auto rounded-xl bg-[#0D0F32] text-white shadow-2xl p-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm">Ref OS update available</div>
        <div className="text-xs text-slate-300">Current version {APP_VERSION}. Update when you are between calls.</div>
      </div>
      <button onClick={updateNow} className="shrink-0 rounded-lg bg-white text-[#0D0F32] px-3 py-2 text-sm font-bold">Update</button>
    </div>
  );
}
