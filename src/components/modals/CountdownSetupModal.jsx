import React, { useState } from "react";
import { Clock, X } from "lucide-react";
import Label from "./FormLabel.jsx";

export default function CountdownSetupModal({ current, onSave, onClear, onClose }) {
  const [label, setLabel] = useState(current?.label || "");
  const [target, setTarget] = useState(current?.target ? new Date(current.target).toISOString().slice(0,16) : "");
  return (
    <div className="fixed inset-0 z-[70] bg-black/45 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4"><Clock size={19}/><h2 className="font-bold text-lg">Countdown banner</h2><button onClick={onClose} className="ml-auto text-slate-400"><X size={21}/></button></div>
        <Label>Milestone</Label>
        <input value={label} onChange={(e)=>setLabel(e.target.value)} placeholder="Alliance Selection" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 mb-3"/>
        <Label>Date and time</Label>
        <input type="datetime-local" value={target} onChange={(e)=>setTarget(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600"/>
        <div className="flex gap-2 mt-4">
          {current && <button onClick={onClear} className="px-4 py-2.5 rounded-lg border border-red-200 text-red-600">Remove</button>}
          <button onClick={onClose} className="ml-auto px-4 py-2.5 rounded-lg border">Cancel</button>
          <button disabled={!label.trim() || !target} onClick={()=>onSave({label:label.trim(),target:new Date(target).toISOString()})} className="px-4 py-2.5 rounded-lg bg-[#0D0F32] text-white font-semibold disabled:bg-slate-300">Set countdown</button>
        </div>
      </div>
    </div>
  );
}
