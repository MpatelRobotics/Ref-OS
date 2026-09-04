import React, { useState } from "react";
import { AlertTriangle, Check, Copy, Share2, X } from "lucide-react";
import Label from "./FormLabel.jsx";

export default function ShareModal({ event, onClose }) {
  const [copied, setCopied] = useState("");
  const url = window.location.origin;
  const copy = (text, which) => { navigator.clipboard?.writeText(text); setCopied(which); setTimeout(() => setCopied(""), 1500); };
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Share2 size={18} /> Invite other refs</h2>
          <button onClick={onClose} className="text-slate-400"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p>Everyone works from the same live Highlander Summit log and sees each other's entries within seconds.</p>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <div>
              <Label>Send your crew the site</Label>
              <div className="flex gap-2">
                <input readOnly value={url} className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm" />
                <button onClick={() => copy(url, "url")} className="px-3 rounded-lg bg-slate-900 text-white flex items-center gap-1 text-sm">{copied === "url" ? <Check size={15} /> : <Copy size={15} />}</button>
              </div>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">They open the link, enter the crew password, set a ref name, and they're in.</p>
          </div>
          <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <span>Share the password only with your officiating crew — anyone who has it can view, add, and delete entries.</span>
          </div>
        </div>
        <div className="p-4 pt-0"><button onClick={onClose} className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 flex items-center justify-center gap-2"><Check size={16} /> Done</button></div>
      </div>
    </div>
  );
}

/* ============================ EVENT MODAL ============================ */