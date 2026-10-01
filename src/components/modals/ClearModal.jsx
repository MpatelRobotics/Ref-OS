import React, { useState } from "react";
import { Check, Trash2, X } from "lucide-react";

export default function ClearModal({ counts, onClear, onClose, protectedKeys = [], leagueSessionName = "" }) {
  const [sel, setSel] = useState({ violations: false, robotPhotos: false, teams: false, schedule: false, replays: false, judging: false, alliances: false, watchlist: false, quadrants: false });
  const opts = [
    { key: "violations", label: "Violations", desc: `${counts.violations} logged`, note: "Clears every violation and its photos." },
    { key: "robotPhotos", label: "Robot pictures", desc: `${counts.robotPhotos || 0} pictures`, note: "Removes inspection pictures from every team, including pictures queued on this device. Keeps violation photos." },
    { key: "replays", label: "Match replays", desc: `${counts.replays} flagged`, note: "Clears all matches marked to re-run (does not delete the matches)." },
    { key: "quadrants", label: "Quadrant checks", desc: `${counts.quadrantChecks || 0} verified`, note: "Clears shared Q1–Q4 progress and Field Ready status for every match." },
    { key: "teams", label: "Teams", desc: `${counts.teams} teams`, note: "Removes the team roster and its inspection pictures. Keeps violation attachments unless Violations is also selected." },
    { key: "schedule", label: "Match schedule", desc: `${counts.schedule} matches`, note: "Removes the imported matches. Also clears team rankings and W-L-T (both come from the schedule)." },
    { key: "judging", label: "Judging", desc: `${counts.judging} nominations`, note: "Clears all award nominations and finalist selections." },
    { key: "alliances", label: "Alliances", desc: `${counts.alliances} alliances`, note: "Clears all alliance captain and first-pick assignments." },
    { key: "watchlist", label: "Watchlist", desc: `${counts.watchlist} entries`, note: "Removes all teams and notes from the watchlist." },
  ];
  // League events: everything except Teams and Watchlist belongs to the current session only.
  if (leagueSessionName) {
    const S = leagueSessionName;
    const leagueNotes = {
      violations: `Clears every violation logged in ${S}, and its photos. Other sessions are not changed.`,
      robotPhotos: `Removes ${S}'s inspection pictures, including pictures queued on this device. Other sessions keep theirs.`,
      replays: `Clears ${S}'s matches marked to re-run (does not delete the matches).`,
      quadrants: `Clears ${S}'s Q1–Q4 progress and Field Ready status.`,
      teams: "Removes the LEAGUE team roster (every session) and inspection pictures from every session.",
      schedule: `Removes ${S}'s matches, its imported ranking snapshot, and W-L-T. Other sessions are not changed.`,
      judging: `Clears ${S}'s award nominations and finalist selections.`,
      alliances: `Clears ${S}'s alliance captain and first-pick assignments.`,
      watchlist: "Removes watchlist notes for the whole league (watch notes are league-wide).",
    };
    for (const o of opts) if (leagueNotes[o.key]) o.note = leagueNotes[o.key];
  }
  const any = opts.some((o) => sel[o.key] && !protectedKeys.includes(o.key));
  const toggle = (k) => { if (!protectedKeys.includes(k)) setSel((s) => ({ ...s, [k]: !s[k] })); };
  const doClear = () => {
    const names = opts.filter((o) => sel[o.key]).map((o) => o.label.toLowerCase()).join(", ");
    if (confirm(`Permanently delete: ${names}?\nThis cannot be undone.`)) onClear(sel);
  };
  return (
    <div className="refos-modal-backdrop fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center">
      <div className="refos-modal-panel bg-white dark:bg-slate-800 w-full max-h-[100dvh] sm:max-w-sm sm:max-h-[90vh] sm:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Trash2 size={18} /> Clear Data</h2>
          <button onClick={onClose} className="text-slate-400"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-2 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Choose what to delete. Anything you leave unchecked is kept.</p>
          {leagueSessionName && <p className="text-xs rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 px-3 py-2 mb-1">League: session data is cleared for <b>{leagueSessionName}</b> only. Earlier sessions are not changed.</p>}
          {opts.map((o) => {
            const on = sel[o.key];
            return (
              <button key={o.key} onClick={() => toggle(o.key)} disabled={protectedKeys.includes(o.key)}
                className={`w-full flex items-start gap-3 text-left rounded-xl border-2 p-3 transition ${protectedKeys.includes(o.key) ? "opacity-55 cursor-not-allowed border-slate-200 dark:border-slate-700" : on ? "border-red-400 bg-red-50" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600"}`}>
                <span className={`mt-0.5 w-5 h-5 rounded-md grid place-items-center shrink-0 border-2 ${on ? "bg-red-600 border-red-600 text-white" : "border-slate-300 dark:border-slate-600"}`}>{on && <Check size={13} />}</span>
                <span className="flex-1">
                  <span className="flex items-center gap-2"><b className="text-slate-800 dark:text-slate-100">{o.label}</b><span className="text-xs text-slate-400">{o.desc}</span></span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{protectedKeys.includes(o.key) ? "Protected for the Highlander demo." : o.note}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="p-4 flex gap-2 border-t border-slate-200 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-medium text-slate-600 dark:text-slate-300">Cancel</button>
          <button onClick={doClear} disabled={!any}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-white ${any ? "bg-red-600 hover:bg-red-700" : "bg-slate-300"}`}>Delete Selected</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ ONLINE (presence) ============================ */
