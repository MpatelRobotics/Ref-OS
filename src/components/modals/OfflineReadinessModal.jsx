import React, { useEffect, useState } from "react";
import { Check, CloudOff, X } from "lucide-react";

export default function OfflineReadinessModal({ onClose }) {
  const [result, setResult] = useState(null);
  const run = async () => {
    const checks = [];
    checks.push({ label: "Browser storage", ok: (()=>{ try { localStorage.setItem("refosOfflineTest","1"); localStorage.removeItem("refosOfflineTest"); return true; } catch { return false; } })() });
    checks.push({ label: "Service worker support", ok: "serviceWorker" in navigator });
    let controller = false;
    try { controller = !!navigator.serviceWorker?.controller; } catch {}
    checks.push({ label: "App controlled by service worker", ok: controller });
    let cacheOk = false;
    try { cacheOk = "caches" in window && (await caches.keys()).length > 0; } catch {}
    checks.push({ label: "Offline cache present", ok: cacheOk });
    setResult(checks);
  };
  useEffect(()=>{ run(); },[]);
  return (
    <div className="fixed inset-0 z-[70] bg-black/45 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl p-4">
        <div className="flex items-center gap-2"><CloudOff size={19}/><h2 className="font-bold text-lg">Offline readiness test</h2><button onClick={onClose} className="ml-auto text-slate-400"><X size={21}/></button></div>
        <p className="text-xs text-slate-500 mt-1 mb-4">Checks whether this device has the browser capabilities and cached app resources needed for offline use.</p>
        <div className="space-y-2">{(result||[]).map((r)=><div key={r.label} className="flex items-center gap-2 rounded-lg border p-3">{r.ok?<Check size={17} className="text-emerald-600"/>:<X size={17} className="text-red-600"/>}<span className="text-sm font-medium">{r.label}</span><span className={`ml-auto text-xs font-bold ${r.ok?"text-emerald-600":"text-red-600"}`}>{r.ok?"PASS":"CHECK"}</span></div>)}</div>
        {result && <div className={`mt-4 rounded-lg p-3 text-sm font-bold ${result.every(r=>r.ok)?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800"}`}>{result.every(r=>r.ok) ? "This device is ready for Ref OS offline mode." : "One or more offline readiness checks need attention."}</div>}
        <div className="flex gap-2 mt-4"><button onClick={run} className="flex-1 py-2.5 rounded-lg border font-semibold">Run again</button><button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-[#0D0F32] text-white font-semibold">Done</button></div>
      </div>
    </div>
  );
}
