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
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">Your name</h2>
          <button onClick={onClose} className="text-slate-400"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-3">
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
        <div className="p-4 pt-0"><button onClick={submit} disabled={!valid} className={`w-full py-2.5 rounded-lg font-semibold text-white ${valid ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300"}`}>Save</button></div>
      </div>
    </div>
  );
}

/* ============================ SHARE / INVITE MODAL ============================ */