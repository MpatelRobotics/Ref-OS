import React, { useState } from "react";
import { AlertTriangle, LifeBuoy, X } from "lucide-react";

const CATEGORIES = [
  "Need an Admin",
  "Field issue",
  "Rules question",
  "Medical assistance",
  "Volunteer replacement needed",
];

export default function HelpRequestModal({ onSend, onClose }) {
  const [category, setCategory] = useState("Need an Admin");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSending(true);
    setError("");
    try {
      await onSend({ category, details: details.trim() });
      onClose();
    } catch (requestError) {
      setError(requestError?.message || "Could not send the help request.");
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 flex flex-col overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 shrink-0">
          <LifeBuoy size={19} className="text-[#D7212B]" />
          <h2 className="font-bold text-slate-900 dark:text-slate-100">Request Help</h2>
          <button onClick={onClose} className="ml-auto text-slate-400" aria-label="Close"><X size={22} /></button>
        </div>
        <div className="p-4 overflow-y-auto overscroll-contain touch-pan-y">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Send an alert to every subscribed key volunteer. An Admin can acknowledge the request for the whole crew.</p>
          <div className="space-y-2">
            {CATEGORIES.map((item) => (
              <button key={item} onClick={() => setCategory(item)} className={`w-full px-3 py-3 rounded-xl border-2 text-left font-semibold ${category === item ? "border-[#D7212B] bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200" : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"}`}>
                {item}
              </button>
            ))}
          </div>
          <label className="block mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Details optional</label>
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={240} rows={3} placeholder="Field, match, location, or what you need"
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100" />
          {category === "Medical assistance" && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2"><AlertTriangle size={16} className="shrink-0" />For an emergency, contact venue emergency services immediately. Do not rely only on Ref OS.</div>}
          {error && <div className="mt-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-2 shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold">Cancel</button>
          <button onClick={submit} disabled={sending} className="flex-1 rounded-lg bg-[#D7212B] text-white py-2.5 font-bold disabled:opacity-60">{sending ? "Sending…" : "Send Help Request"}</button>
        </div>
      </div>
    </div>
  );
}
