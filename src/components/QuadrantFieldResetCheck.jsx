import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, CheckCircle2, Circle, RotateCcw, ShieldCheck, MapPin, X } from "lucide-react";

const STORAGE_KEY = "refos.experimental.quadrant-reset.v4";
const CROP_BASE = "/field-setup/quadrant-crops";

// Each entry is an expected field position. Every checklist row includes a
// cropped field reference so the resetter can compare the exact location.
const QUADRANTS = [
  {
    id: 1,
    name: "Bottom",
    items: [
      { label: "Left diagonal Pin", image: "q1-left-diagonal-pin.jpg" },
      { label: "Left blue Goal", image: "q1-left-blue-goal.jpg" },
      { label: "Lower blue Goal", image: "q1-lower-blue-goal.jpg" },
      { label: "Center black Cup / Pin assembly", image: "q1-center-black-cup-pin.jpg" },
      { label: "Right black Cup / Pin assembly", image: "q1-right-black-cup-pin.jpg" },
      { label: "Right Pin cluster", image: "q1-right-pin-cluster.jpg" },
      { label: "Lower-right Pin cluster", image: "q1-lower-right-pin-cluster.jpg" },
      { label: "Bottom wall positions", image: "q1-bottom-wall.jpg" },
    ],
  },
  {
    id: 2,
    name: "Right",
    items: [
      { label: "Upper-left Pin cluster", image: "q2-upper-left-pin-cluster.jpg" },
      { label: "Mid-left black Cup / Pin assembly", image: "q2-mid-left-black-cup-pin.jpg" },
      { label: "Center-left Pin cluster", image: "q2-center-left-pin-cluster.jpg" },
      { label: "Left wall positions", image: "q2-left-wall.jpg" },
      { label: "Blue-side diagonal positions", image: "q2-blue-diagonal.jpg" },
    ],
  },
  {
    id: 3,
    name: "Top",
    items: [
      { label: "Top wall Toggle", image: "q3-top-wall-toggle.jpg" },
      { label: "Upper-left black Cup / Pin assembly", image: "q3-upper-left-black-cup-pin.jpg" },
      { label: "Upper-right red Goal", image: "q3-upper-right-red-goal.jpg" },
      { label: "Upper-right diagonal Pin", image: "q3-upper-right-diagonal-pin.jpg" },
      { label: "Top wall positions", image: "q3-top-wall.jpg" },
      { label: "Red-side diagonal positions", image: "q3-red-diagonal.jpg" },
    ],
  },
  {
    id: 4,
    name: "Left",
    items: [
      { label: "Upper-right red Goal", image: "q4-upper-right-red-goal.jpg" },
      { label: "Center-right red Goal", image: "q4-center-right-red-goal.jpg" },
      { label: "Right wall positions", image: "q4-right-wall.jpg" },
      { label: "Right Pin cluster", image: "q4-right-pin-cluster.jpg" },
      { label: "Lower-right black Cup / Pin assembly", image: "q4-lower-right-black-cup-pin.jpg" },
      { label: "Red-side diagonal positions", image: "q4-red-diagonal.jpg" },
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
  const [showQuadrantOverview, setShowQuadrantOverview] = useState(false);
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
          <MapPin size={16} /> {showReference ? "Hide full field reference" : "Show full field reference"}
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
            <div className="text-xs text-slate-400">Compare each screenshot to the field, then tap the position when it matches.</div>
          </div>
          <button onClick={() => setShowQuadrantOverview(true)} className="flex items-center gap-2 p-1 -m-1 active:bg-slate-800" aria-label={`Expand Quadrant ${def.id} reference`}>
            <img src={`/field-setup/quadrant-overviews/q${def.id}.jpg`} alt={`Quadrant ${def.id} reference`} className="w-20 h-16 object-cover border border-slate-700 bg-black" />
            <div className="text-xs font-bold text-slate-300 whitespace-nowrap">{checkedCount}/{def.items.length}</div>
          </button>
        </div>

        <div className="border border-slate-800 divide-y divide-slate-800 bg-slate-900/60">
          {def.items.map((item, idx) => (
            <button key={item.label} onClick={() => toggleCheck(idx)} className={`w-full p-3 text-left flex items-center gap-3 active:bg-slate-800 ${q.checks[idx] ? "bg-emerald-950/20" : ""}`}>
              <div className="w-28 h-20 sm:w-36 sm:h-24 shrink-0 border border-slate-700 bg-black overflow-hidden">
                <img src={`${CROP_BASE}/${item.image}`} alt={`${item.label} field reference`} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  {q.checks[idx] ? <CheckCircle2 size={24} className="text-emerald-400 shrink-0 mt-0.5" /> : <Circle size={24} className="text-slate-500 shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <div className={q.checks[idx] ? "text-white font-semibold" : "text-slate-200"}>{item.label}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{q.checks[idx] ? "Correct position confirmed" : "Tap when field matches screenshot"}</div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {q.verifiedAt && <div className="mt-3 text-xs text-emerald-300">Quadrant {def.id} verified at {new Date(q.verifiedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.</div>}
      </div>

      {showQuadrantOverview && (
        <div className="fixed inset-0 z-[90] bg-black/95 flex flex-col" onClick={() => setShowQuadrantOverview(false)}>
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800 bg-slate-950" onClick={e => e.stopPropagation()}>
            <div>
              <div className="font-bold">Quadrant {def.id} • {def.name}</div>
              <div className="text-xs text-slate-400">Tap outside the image or close to return</div>
            </div>
            <button onClick={() => setShowQuadrantOverview(false)} className="p-2 border border-slate-700" aria-label="Close expanded quadrant"><X size={22} /></button>
          </div>
          <div className="flex-1 min-h-0 p-3 flex items-center justify-center" onClick={() => setShowQuadrantOverview(false)}>
            <img src={`/field-setup/quadrant-overviews/q${def.id}.jpg`} alt={`Expanded Quadrant ${def.id} reference`} className="max-w-full max-h-full object-contain bg-black border border-slate-700" />
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-3 border-t border-slate-800 bg-slate-950">
        <button onClick={verify} disabled={!allChecks || !!q.verifiedAt} className={`w-full py-3.5 font-bold ${q.verifiedAt ? "bg-emerald-800 text-emerald-100" : allChecks ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-500"}`}>
          {q.verifiedAt ? `Quadrant ${def.id} Verified ✓` : allChecks ? `Verify Quadrant ${def.id}` : `${def.items.length - checkedCount} positions remaining`}
        </button>
      </div>
    </div>
  );
}
