import React, { useState } from "react";
import { Check, Trash2, X } from "lucide-react";

export default function ClearModal({ counts, onClear, onClose }) {
  const [sel, setSel] = useState({ violations: false, teams: false, schedule: false, replays: false, awp: false, judging: false, alliances: false, watchlist: false });
  const opts = [
    { key: "violations", label: "Violations", desc: `${counts.violations} logged`, note: "Clears every violation and its photos." },
    { key: "replays", label: "Match replays", desc: `${counts.replays} flagged`, note: "Clears all matches marked to re-run (does not delete the matches)." },
    { key: "awp", label: "AWP checks", desc: `${counts.awp} saved`, note: "Clears all saved qualification AWP checks and AWP analytics history." },
    { key: "teams", label: "Teams", desc: `${counts.teams} teams`, note: "Removes the team roster." },
    { key: "schedule", label: "Match schedule", desc: `${counts.schedule} matches`, note: "Removes the imported matches. Also clears team rankings and W-L-T (both come from the schedule)." },
    { key: "judging", label: "Judging", desc: `${counts.judging} nominations`, note: "Clears all award nominations and finalist selections." },
    { key: "alliances", label: "Alliances", desc: `${counts.alliances} alliances`, note: "Clears all alliance captain and first-pick assignments." },
    { key: "watchlist", label: "Watchlist", desc: `${counts.watchlist} entries`, note: "Removes all teams and notes from the watchlist." },
  ];
  const any = opts.some((o) => sel[o.key]);
  const toggle = (k) => setSel((s) => ({ ...s, [k]: !s[k] }));
  const doClear = () => {
    const names = opts.filter((o) => sel[o.key]).map((o) => o.label.toLowerCase()).join(", ");
    if (confirm(`Permanently delete: ${names}?\nThis cannot be undone.`)) onClear(sel);
  };
  return (
    <div className="refos-modal-backdrop fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="refos-modal-panel bg-white dark:bg-slate-800 w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Trash2 size={18} /> Clear Data</h2>
          <button onClick={onClose} className="text-slate-400"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Choose what to delete. Anything you leave unchecked is kept.</p>
          {opts.map((o) => {
            const on = sel[o.key];
            return (
              <button key={o.key} onClick={() => toggle(o.key)}
                className={`w-full flex items-start gap-3 text-left rounded-xl border-2 p-3 transition ${on ? "border-red-400 bg-red-50" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600"}`}>
                <span className={`mt-0.5 w-5 h-5 rounded-md grid place-items-center shrink-0 border-2 ${on ? "bg-red-600 border-red-600 text-white" : "border-slate-300 dark:border-slate-600"}`}>{on && <Check size={13} />}</span>
                <span className="flex-1">
                  <span className="flex items-center gap-2"><b className="text-slate-800 dark:text-slate-100">{o.label}</b><span className="text-xs text-slate-400">{o.desc}</span></span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{o.note}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="p-4 pt-0 flex gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-medium text-slate-600 dark:text-slate-300">Cancel</button>
          <button onClick={doClear} disabled={!any}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-white ${any ? "bg-red-600 hover:bg-red-700" : "bg-slate-300"}`}>Delete Selected</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ ONLINE (presence) ============================ */