import React, { useEffect } from "react";
import { LayoutGrid, LogIn, LogOut } from "lucide-react";

// Lock This Device: both destinations sign this device out of its event role.
//   Main Screen      -> Choose VEX Event (clears the selected event).
//   Event Main Page  -> this event's login screen (keeps the selected event and its branding).
// Cancel closes the dialog and changes nothing.
export default function LockDeviceModal({ eventName, busy = false, onMainScreen, onEventMainPage, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const name = String(eventName || "").trim() || "this event";
  const option = "w-full text-left rounded-xl border-2 px-4 py-3.5 flex items-center gap-3 transition disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => { if (!busy) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="lock-device-title"
        className="bg-white dark:bg-slate-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}>
        <h2 id="lock-device-title" className="font-bold text-slate-900 dark:text-slate-100 text-lg flex items-center gap-2"><LogOut size={18} /> Lock This Device</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Where would you like to go?</p>

        <div className="mt-4 space-y-2.5">
          <button type="button" disabled={busy} onClick={onMainScreen}
            className={`${option} border-slate-200 dark:border-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700`}>
            <span className="w-10 h-10 shrink-0 rounded-lg grid place-items-center bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"><LayoutGrid size={20} /></span>
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900 dark:text-slate-100">Main Screen</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Choose another VEX event</span>
            </span>
          </button>

          <button type="button" disabled={busy} onClick={onEventMainPage}
            className={`${option} border-slate-200 dark:border-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700`}>
            <span className="w-10 h-10 shrink-0 rounded-lg grid place-items-center bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"><LogIn size={20} /></span>
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900 dark:text-slate-100">Event Main Page</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">Return to {name}</span>
            </span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400 mt-3">Either choice signs this device out. An access code is needed to sign in again.</p>

        <button type="button" disabled={busy} onClick={onCancel}
          className="w-full mt-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-medium text-slate-600 dark:text-slate-300 disabled:opacity-60">
          {busy ? "Locking…" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
