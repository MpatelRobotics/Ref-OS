import React, { useMemo, useState } from "react";
import { Check, ChevronDown, Trash2, X } from "lucide-react";

export default function ClearModal({ counts, onClear, onClose }) {
  const [sel, setSel] = useState({ violations: false, teams: false, schedule: false, replays: false, awp: false, judging: false, alliances: false, watchlist: false });
  const [open, setOpen] = useState(false);

  const opts = [
    { key: "violations", label: "Violations", desc: `${counts.violations} logged`, note: "Clears every violation and its photos." },
    { key: "replays", label: "Match replays", desc: `${counts.replays} flagged`, note: "Clears matches marked to re-run without deleting the matches." },
    { key: "awp", label: "AWP checks", desc: `${counts.awp} saved`, note: "Clears saved qualification AWP checks, shared in-progress AWP status, and AWP analytics history." },
    { key: "teams", label: "Teams", desc: `${counts.teams} teams`, note: "Removes the team roster." },
    { key: "schedule", label: "Match schedule", desc: `${counts.schedule} matches`, note: "Removes imported matches and clears rankings and W-L-T." },
    { key: "judging", label: "Judging", desc: `${counts.judging} nominations`, note: "Clears award nominations and finalist selections." },
    { key: "alliances", label: "Alliances", desc: `${counts.alliances} alliances`, note: "Clears alliance captain and first-pick assignments." },
    { key: "watchlist", label: "Watchlist", desc: `${counts.watchlist} entries`, note: "Removes all teams and notes from the watchlist." },
  ];

  const selected = useMemo(() => opts.filter((o) => sel[o.key]), [sel]);
  const any = selected.length > 0;
  const toggle = (k) => setSel((s) => ({ ...s, [k]: !s[k] }));

  const doClear = () => {
    const names = selected.map((o) => o.label.toLowerCase()).join(", ");
    if (confirm(`Permanently delete: ${names}?\nThis cannot be undone.`)) onClear(sel);
  };

  return (
    <div className="refos-modal-backdrop fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="refos-modal-panel bg-white dark:bg-slate-800 w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Trash2 size={18} /> Clear Data</h2>
          <button onClick={onClose} className="text-slate-400"><X size={22} /></button>
        </div>

        <div className="p-4 flex-1 min-h-0 overflow-y-auto">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Choose the data you want to permanently delete.</p>

          <div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={`w-full min-h-12 px-3 py-2.5 rounded-lg border flex items-center justify-between gap-3 text-left ${open ? "border-slate-400 dark:border-slate-500" : "border-slate-300 dark:border-slate-600"} bg-white dark:bg-slate-900`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {any ? `${selected.length} ${selected.length === 1 ? "item" : "items"} selected` : "Select data to clear"}
                </span>
                {any && <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{selected.map((o) => o.label).join(", ")}</span>}
              </span>
              <ChevronDown size={18} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
              <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="max-h-[34vh] overflow-y-auto overscroll-contain py-1">
                  {opts.map((o) => {
                    const on = sel[o.key];
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => toggle(o.key)}
                        className="w-full px-3 py-2.5 flex items-start gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-b last:border-b-0 border-slate-100 dark:border-slate-800"
                      >
                        <span className={`mt-0.5 w-5 h-5 rounded grid place-items-center shrink-0 border ${on ? "bg-red-600 border-red-600 text-white" : "border-slate-300 dark:border-slate-600"}`}>
                          {on && <Check size={13} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <b className="text-sm text-slate-800 dark:text-slate-100">{o.label}</b>
                            <span className="text-xs text-slate-400 shrink-0">{o.desc}</span>
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-4">{o.note}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="p-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <button type="button" onClick={() => setOpen(false)} className="w-full py-2 rounded-md text-sm font-semibold text-slate-700 dark:text-slate-200">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 flex gap-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-medium text-slate-600 dark:text-slate-300">Cancel</button>
          <button onClick={doClear} disabled={!any}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-white ${any ? "bg-red-600 hover:bg-red-700" : "bg-slate-300 dark:bg-slate-700"}`}>Delete Selected</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ ONLINE (presence) ============================ */
