import React, { useState } from "react";
import { KeyRound } from "lucide-react";

export default function AdminPasswordModal({ onUnlock, onClose }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e?.preventDefault();
    setErr("");
    const result = await onUnlock(pw);
    if (!result?.ok) setErr(result?.message || "Incorrect admin credential.");
  };
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 grid place-items-center p-4" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 rounded-full bg-[#0D0F32] text-white grid place-items-center"><KeyRound size={19} /></span>
          <div><h2 className="font-bold text-slate-900 dark:text-slate-100">Admin access required</h2><p className="text-xs text-slate-500 dark:text-slate-400">Event editing and CSV export are admin only.</p></div>
        </div>
        <input autoFocus type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="Admin password"
          className="w-full mt-4 px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" />
        {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">Cancel</button>
          <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-[#0D0F32] text-white font-semibold">Unlock admin</button>
        </div>
      </form>
    </div>
  );
}
