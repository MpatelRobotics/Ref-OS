import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, CheckCircle2, Circle, RotateCcw, ShieldCheck, MapPin } from "lucide-react";

const STORAGE_KEY = "refos.experimental.quadrant-reset.v2";

// Each entry is an expected field position. The resetter taps the position only
// after visually confirming that the correct game object is in that spot.
const QUADRANTS = [
  {
    id: 1,
    name: "Bottom",
    items: [
      "Left diagonal Pin",
      "Left blue Goal",
      "Lower blue Goal",
      "Center black Cup / Pin assembly",
      "Right black Cup / Pin assembly",
      "Right Pin cluster",
      "Lower-right Pin cluster",
      "Bottom wall positions",
    ],
  },
  {
    id: 2,
    name: "Left",
    items: [
      "Upper-left Pin cluster",
      "Mid-left black Cup / Pin assembly",
      "Center-left Pin cluster",
      "Left wall positions",
      "Blue-side diagonal positions",
    ],
  },
  {
    id: 3,
    name: "Top",
    items: [
      "Top wall Toggle",
      "Upper-left black Cup / Pin assembly",
      "Upper-right red Goal",
      "Upper-right diagonal Pin",
      "Top wall positions",
      "Red-side diagonal positions",
    ],
  },
  {
    id: 4,
    name: "Right",
    items: [
      "Upper-right red Goal",
      "Center-right red Goal",
      "Right wall positions",
      "Right Pin cluster",
      "Lower-right black Cup / Pin assembly",
      "Red-side diagonal positions",
    ],
  },
];

const freshState = () => ({
  quadrants: QUADRANTS.map(q => ({ checks: Array(q.items.length).fill(false), verifiedAt: null })),
  startedAt: Date.now(),
});

export default function QuadrantFieldResetCheck({ onClose }) {
  const [active, setActive] = useState(0);
  const [showReference, setShowReference] = useState(false);
  const [state, setState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.quadrants?.length === 4 && saved.quadrants.every((q, i) => q?.checks?.length === QUADRANTS[i].items.length)) return saved;
    } catch {}
    return freshState();
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const verifiedCount = useMemo(() => state.quadrants.filter(q => q.verifiedAt).length, [state]);
  const allReady = verifiedCount === 4;
  const q = state.quadrants[active];
  const def = QUADRANTS[active];
  const allChecks = q.checks.every(Boolean);
  const checkedCount = q.checks.filter(Boolean).length;

  const toggleCheck = (idx) => {
    setState(prev => ({
      ...prev,
      quadrants: prev.quadrants.map((item, qi) => qi !== active ? item : {
        ...item,
        checks: item.checks.map((v, ci) => ci === idx ? !v : v),
        verifiedAt: null,
      }),
    }));
  };

  const verify = () => {
    if (!allChecks) return;
    setState(prev => ({
      ...prev,
      quadrants: prev.quadrants.map((item, qi) => qi === active ? { ...item, verifiedAt: Date.now() } : item),
    }));
  };

  const reset = () => {
    if (!window.confirm("Reset all four quadrant checks for the next field reset?")) return;
    setState(freshState());
    setActive(0);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950 text-white flex flex-col">
      <div className="px-3 py-3 border-b border-slate-800 bg-slate-950 flex items-center gap-2 shrink-0">
        <button onClick={onClose} className="p-1 text-slate-300" aria-label="Back"><ChevronLeft size={24} /></button>
        <div className="min-w-0">
          <div className="font-bold leading-tight">Quadrant Field Reset Check</div>
          <div className="text-[11px] text-amber-300">EXPERIMENTAL • Position verification</div>
        </div>
        <button onClick={reset} className="ml-auto px-3 py-2 border border-slate-700 text-xs font-semibold flex items-center gap-1.5">
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <div className="p-3 border-b border-slate-800 space-y-2">
        <div className={`border px-3 py-3 ${allReady ? "border-emerald-500 bg-emerald-950/40" : "border-amber-700 bg-amber-950/20"}`}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className={allReady ? "text-emerald-400" : "text-amber-400"} />
            <div>
              <div className={`font-black tracking-wide ${allReady ? "text-emerald-300" : "text-amber-300"}`}>{allReady ? "FIELD READY" : "FIELD NOT READY"}</div>
              <div className="text-xs text-slate-300">{verifiedCount}/4 quadrants verified{allReady ? "" : ` • ${4 - verifiedCount} remaining`}</div>
            </div>
          </div>
        </div>
        <button onClick={() => setShowReference(v => !v)} className="w-full border border-slate-700 px-3 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 bg-slate-900">
          <MapPin size={16} /> {showReference ? "Hide field reference" : "Show labeled field reference"}
        </button>
        {showReference && <img src="/field-setup/quadrant-reference.png" alt="Field reference labeled with quadrants 1 through 4" className="w-full max-h-[38vh] object-contain bg-white border border-slate-700" />}
      </div>

      <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-900">
        {state.quadrants.map((item, i) => (
          <button key={i} onClick={() => setActive(i)} className={`py-3 text-sm font-bold border-r last:border-r-0 border-slate-800 ${active === i ? "bg-slate-700 text-white" : "text-slate-400"}`}>
            Q{i + 1} {item.verifiedAt ? "✓" : ""}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-28">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-bold">Quadrant {def.id} • {def.name}</div>
            <div className="text-xs text-slate-400">Tap each position after the correct object is physically in that spot.</div>
          </div>
          <div className="text-xs font-bold text-slate-300 whitespace-nowrap">{checkedCount}/{def.items.length}</div>
        </div>

        <div className="border border-slate-800 divide-y divide-slate-800 bg-slate-900/60">
          {def.items.map((label, idx) => (
            <button key={label} onClick={() => toggleCheck(idx)} className={`w-full px-3 py-4 text-left flex items-center gap-3 active:bg-slate-800 ${q.checks[idx] ? "bg-emerald-950/20" : ""}`}>
              {q.checks[idx] ? <CheckCircle2 size={24} className="text-emerald-400 shrink-0" /> : <Circle size={24} className="text-slate-500 shrink-0" />}
              <div className="min-w-0">
                <div className={q.checks[idx] ? "text-white font-semibold" : "text-slate-200"}>{label}</div>
                <div className="text-[11px] text-slate-500">{q.checks[idx] ? "Correct position confirmed" : "Tap when correct"}</div>
              </div>
            </button>
          ))}
        </div>

        {q.verifiedAt && <div className="mt-3 text-xs text-emerald-300">Quadrant {def.id} verified at {new Date(q.verifiedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.</div>}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-3 border-t border-slate-800 bg-slate-950">
        <button onClick={verify} disabled={!allChecks || !!q.verifiedAt} className={`w-full py-3.5 font-bold ${q.verifiedAt ? "bg-emerald-800 text-emerald-100" : allChecks ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-500"}`}>
          {q.verifiedAt ? `Quadrant ${def.id} Verified ✓` : allChecks ? `Verify Quadrant ${def.id}` : `${def.items.length - checkedCount} positions remaining`}
        </button>
      </div>
    </div>
  );
}
