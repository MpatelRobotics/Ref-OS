import React, { useState } from "react";
import { X } from "lucide-react";
import Label from "./FormLabel.jsx";

export default function IdentityModal({ me, onSave, onClose }) {
  const existingParts = String(me?.name || "").trim().split(/\s+/).filter(Boolean);
  const [firstName, setFirstName] = useState(existingParts[0] || "");
  const [lastName, setLastName] = useState(existingParts.slice(1).join(" ") || "");
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const valid = !!firstName.trim() && !!lastName.trim();
  const submit = () => valid && onSave(fullName);
  return (
    <div className="fixed inset-0 z-[150] bg-black/40 flex items-stretch sm:items-center justify-center">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white dark:bg-slate-800 sm:h-auto sm:max-h-[90dvh] sm:max-w-sm sm:rounded-2xl">
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-slate-700">
          <h2 className="min-w-0 flex-1 truncate font-bold text-slate-900 dark:text-slate-100">Edit name</h2>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close edit name"><X size={22} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div>
            <Label>First name</Label>
            <input autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Alex"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <div>
            <Label>Last name</Label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Rodriguez"
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
        </div>
        <div className="shrink-0 border-t border-slate-200 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-slate-700"><button onClick={submit} disabled={!valid} className={`w-full py-2.5 rounded-lg font-semibold text-white ${valid ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300"}`}>Save</button></div>
      </div>
    </div>
  );
}

/* ============================ SHARE / INVITE MODAL ============================ */
