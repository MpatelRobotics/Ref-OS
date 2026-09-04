import React, { useState } from "react";
import { Flag, X } from "lucide-react";

export default function AnnouncementModal({ onClose, onSend }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!message.trim() || busy) return;
    setBusy(true);
    try { await onSend(message.trim()); onClose(); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black/45 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Flag size={18} className="text-[#D7212B]" /><h2 className="font-bold">Send referee announcement</h2>
          <button onClick={onClose} className="ml-auto p-1 text-slate-400"><X size={20}/></button>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Everyone using this event will see this until they acknowledge it.</p>
          <textarea autoFocus value={message} onChange={(e)=>setMessage(e.target.value)} rows={5} placeholder="Type announcement…"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm resize-none"/>
        </div>
        <div className="p-4 pt-0 flex gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border">Cancel</button>
          <button onClick={send} disabled={!message.trim() || busy} className="flex-1 px-4 py-2.5 rounded-lg bg-[#0D0F32] text-white font-semibold disabled:bg-slate-300">{busy ? "Sending…" : "Send announcement"}</button>
        </div>
      </div>
    </div>
  );
}
