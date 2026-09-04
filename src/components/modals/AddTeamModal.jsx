import React, { useState } from "react";
import { X } from "lucide-react";
import Label from "./FormLabel.jsx";

export default function AddTeamModal({ onClose, onSave }) {
  const [num, setNum] = useState(""); const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700"><h2 className="font-bold text-slate-900 dark:text-slate-100">Add team</h2><button onClick={onClose} className="text-slate-400"><X size={22} /></button></div>
        <div className="p-4 space-y-3">
          <div><Label>Team number</Label><input autoFocus value={num} onChange={(e) => setNum(e.target.value)} placeholder="e.g. 1234A" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-slate-300" /></div>
          <div><Label>Team name (optional)</Label><input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" /></div>
        </div>
        <div className="p-4 pt-0 flex gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-medium text-slate-600 dark:text-slate-300">Cancel</button>
          <button onClick={() => num.trim() && onSave(num, name)} disabled={!num.trim()} className={`flex-1 py-2.5 rounded-lg font-semibold text-white ${num.trim() ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300"}`}>Add team</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ IDENTITY MODAL ============================ */



