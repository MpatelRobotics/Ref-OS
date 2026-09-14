import React, { useMemo, useState } from "react";
import { Check, RotateCcw, ShieldCheck } from "lucide-react";

const QUADRANTS = [1, 2, 3, 4];

function fmtStamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function QuadrantFieldReset({ checks = [], meName = "Ref", onVerify, onReset }) {
  const [busy, setBusy] = useState(null);
  const byQuadrant = useMemo(() => {
    const map = new Map();
    for (const row of checks) map.set(Number(row.quadrant), row);
    return map;
  }, [checks]);
  const doneCount = QUADRANTS.filter((q) => byQuadrant.has(q)).length;
  const fieldReady = doneCount === 4;

  const verify = async (quadrant) => {
    if (busy) return;
    setBusy(quadrant);
    try { await onVerify(quadrant); }
    finally { setBusy(null); }
  };

  const reset = async () => {
    if (busy || doneCount === 0) return;
    const extra = fieldReady ? " This match is currently marked FIELD READY." : "";
    if (!confirm(`Reset all shared quadrant checks for this match?${extra}\n\nVerifier names and timestamps for Q1 through Q4 will be cleared.`)) return;
    setBusy("reset");
    try { await onReset(); }
    finally { setBusy(null); }
  };

  return (
    <section className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3" aria-label="Quadrant field reset check">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} className={fieldReady ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"} />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Quadrant field reset</h3>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Shared Q1 through Q4 progress for this match.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-md border px-2 py-1 text-xs font-bold ${fieldReady ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300"}`}>
            {fieldReady ? "FIELD READY" : `${doneCount}/4 verified`}
          </span>
          <button type="button" onClick={reset} disabled={doneCount === 0 || !!busy}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700">
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        {QUADRANTS.map((quadrant) => {
          const row = byQuadrant.get(quadrant);
          const done = !!row;
          return (
            <button key={quadrant} type="button" onClick={() => verify(quadrant)} disabled={done || !!busy}
              className={`min-h-[76px] rounded-lg border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${done ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30" : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Q{quadrant}</span>
                {done ? <Check size={17} className="text-emerald-600 dark:text-emerald-400" /> : <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Verify</span>}
              </div>
              {done ? (
                <div className="mt-1.5 text-[11px] leading-4 text-slate-600 dark:text-slate-300">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-300">Verified</div>
                  <div className="truncate">{row.verifiedBy || "Ref"}{row.verifiedAt ? ` · ${fmtStamp(row.verifiedAt)}` : ""}</div>
                </div>
              ) : (
                <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">Tap after this quadrant is reset and checked.</div>
              )}
            </button>
          );
        })}
      </div>

      {fieldReady && (
        <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          Field Ready. All four quadrants are verified for this match.
        </div>
      )}
    </section>
  );
}
