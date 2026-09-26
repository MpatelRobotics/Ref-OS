import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  RotateCcw,
  ShieldCheck,
  MapPin,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Cloud,
} from "lucide-react";

const CROP_BASE = "/field-setup/quadrant-crops";

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

function fmtStamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function blankChecklist() {
  return QUADRANTS.map((q) => Array(q.items.length).fill(false));
}

export default function QuadrantFieldReset({
  checks = [],
  meName = "Ref",
  matchLabel = "",
  onVerify,
  onReset,
  onClose,
}) {
  const [active, setActive] = useState(0);
  const [showReference, setShowReference] = useState(false);
  const [showQuadrantOverview, setShowQuadrantOverview] = useState(false);
  const [referenceZoom, setReferenceZoom] = useState(1);
  const [busy, setBusy] = useState(null);
  const contentRef = useRef(null);
  const [localChecks, setLocalChecks] = useState(blankChecklist);

  const byQuadrant = useMemo(() => {
    const map = new Map();
    for (const row of checks) map.set(Number(row.quadrant), row);
    return map;
  }, [checks]);

  useEffect(() => {
    setLocalChecks((prev) =>
      prev.map((list, i) => (byQuadrant.has(i + 1) ? list.map(() => true) : list))
    );
  }, [byQuadrant]);

  const verifiedCount = QUADRANTS.filter((q) => byQuadrant.has(q.id)).length;
  const fieldReady = verifiedCount === 4;
  const def = QUADRANTS[active];
  const row = byQuadrant.get(def.id);
  const qChecks = localChecks[active] || [];
  const allChecks = qChecks.length > 0 && qChecks.every(Boolean);
  const checkedCount = qChecks.filter(Boolean).length;

  const toggleCheck = (idx) => {
    if (row || busy) return;
    setLocalChecks((prev) => prev.map((list, qi) =>
      qi !== active ? list : list.map((value, ci) => ci === idx ? !value : value)
    ));
  };

  const setAllChecks = (value) => {
    if (row || busy) return;
    setLocalChecks((prev) => prev.map((list, qi) => qi !== active ? list : list.map(() => value)));
  };

  const verify = async () => {
    if (!allChecks || row || busy) return;
    setBusy(def.id);
    try {
      await onVerify(def.id);
      if (active < QUADRANTS.length - 1) setActive(active + 1);
      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    if (busy || verifiedCount === 0) return;
    const warning = fieldReady
      ? "This match is currently marked FIELD READY. Reset all four shared quadrant checks for the next field reset?"
      : "Reset all shared quadrant checks for this match?";
    if (!window.confirm(`${warning}\n\nVerifier names and timestamps for Q1 through Q4 will be cleared.`)) return;
    setBusy("reset");
    try {
      await onReset();
      setLocalChecks(blankChecklist());
      setActive(0);
    } finally {
      setBusy(null);
    }
  };

  const latest = useMemo(() => {
    if (!fieldReady) return null;
    return checks.slice().sort((a, b) => new Date(b.verifiedAt || 0) - new Date(a.verifiedAt || 0))[0] || null;
  }, [checks, fieldReady]);

  return createPortal(
    <div className="fixed inset-0 z-[70] h-[100dvh] min-h-0 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white flex flex-col overflow-hidden">
      <div className="px-3 py-3 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 flex items-center gap-2 shrink-0">
        <button onClick={onClose} className="refos-back-button" aria-label="Back">
          <ChevronLeft size={24} /> Back
        </button>
        <div className="min-w-0">
          <div className="font-bold leading-tight">Quadrant Field Reset Check{matchLabel ? ` • ${matchLabel}` : ""}</div>
          <div className="text-[11px] text-amber-700 dark:text-amber-300">EXPERIMENTAL • Position verification • Field oriented from Head Ref side</div>
          <div className="text-[10px] flex items-center gap-1 mt-0.5 text-emerald-700 dark:text-emerald-400">
            <Cloud size={11} /> Shared across event devices
          </div>
        </div>
        <button onClick={reset} disabled={verifiedCount === 0 || !!busy} className="ml-auto px-3 py-2 border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 bg-white dark:bg-transparent disabled:opacity-40">
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50 dark:bg-slate-950">
        <div className={`border px-3 py-3 ${fieldReady ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-amber-500 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20"}`}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className={fieldReady ? "text-emerald-500" : "text-amber-500"} />
            <div>
              <div className={`font-black tracking-wide ${fieldReady ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>{fieldReady ? "FIELD READY" : "FIELD NOT READY"}</div>
              <div className="text-xs text-slate-600 dark:text-slate-300">{verifiedCount}/4 quadrants verified{fieldReady ? "" : ` • ${4 - verifiedCount} remaining`}</div>
              {fieldReady && latest && <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">Verified by {latest.verifiedBy || "Ref"}{latest.verifiedAt ? ` • ${fmtStamp(latest.verifiedAt)}` : ""}</div>}
            </div>
          </div>
        </div>

        <button onClick={() => setShowReference((v) => !v)} className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 bg-white dark:bg-slate-900">
          <MapPin size={16} /> {showReference ? "Hide full field reference" : "Show full field reference"}
        </button>

        {showReference && (
          <div className="border border-slate-700 bg-white">
            <div className="flex items-center justify-center gap-2 p-2 border-b border-slate-300 bg-slate-100 text-slate-900">
              <button onClick={() => setReferenceZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} disabled={referenceZoom <= 1} className="p-2 border border-slate-300 bg-white disabled:opacity-40" aria-label="Zoom out full field reference"><ZoomOut size={18} /></button>
              <div className="min-w-16 text-center text-xs font-bold">{Math.round(referenceZoom * 100)}%</div>
              <button onClick={() => setReferenceZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} disabled={referenceZoom >= 3} className="p-2 border border-slate-300 bg-white disabled:opacity-40" aria-label="Zoom in full field reference"><ZoomIn size={18} /></button>
              <button onClick={() => setReferenceZoom(1)} className="p-2 border border-slate-300 bg-white" aria-label="Reset full field reference zoom"><Maximize2 size={18} /></button>
            </div>
            <div className="max-h-[45vh] overflow-auto bg-white">
              <div className="min-w-full min-h-full flex items-center justify-center p-2">
                <img src="/field-setup/quadrant-reference.png" alt="Field reference labeled with quadrants 1 through 4" className="block max-w-none origin-center select-none" draggable="false" style={{ width: `${referenceZoom * 100}%`, height: "auto" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {QUADRANTS.map((quadrant, i) => (
          <button key={quadrant.id} onClick={() => setActive(i)} className={`py-3 text-sm font-bold border-r last:border-r-0 border-slate-200 dark:border-slate-800 ${active === i ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
            Q{quadrant.id} {byQuadrant.has(quadrant.id) ? "✓" : ""}
          </button>
        ))}
      </div>

      <div className="shrink-0 p-3 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <button onClick={verify} disabled={!allChecks || !!row || !!busy} className={`w-full py-3.5 font-bold ${row ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100" : allChecks ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500"}`}>
          {row ? `Quadrant ${def.id} Verified ✓` : allChecks ? (busy === def.id ? "Saving…" : `Verify Quadrant ${def.id}`) : `${def.items.length - checkedCount} positions remaining`}
        </button>
      </div>

      <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-bold">Quadrant {def.id} • {def.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Compare each screenshot to the field, then tap the position when it matches.</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAllChecks(!allChecks)} disabled={!!row || !!busy} className="px-3 py-2 border border-slate-300 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-900 active:bg-slate-100 dark:active:bg-slate-800 disabled:opacity-40">
              {allChecks ? "Uncheck All" : "Check All"}
            </button>
            <button onClick={() => setShowQuadrantOverview(true)} className="flex items-center gap-2 p-1 -m-1 active:bg-slate-100 dark:active:bg-slate-800" aria-label={`Expand Quadrant ${def.id} reference`}>
              <img src={`/field-setup/quadrant-overviews/q${def.id}.jpg`} alt={`Quadrant ${def.id} reference`} className="w-20 h-16 object-cover border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-black" />
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{checkedCount}/{def.items.length}</div>
            </button>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900/60">
          {def.items.map((item, idx) => (
            <button key={item.label} onClick={() => toggleCheck(idx)} disabled={!!row || !!busy} className={`w-full p-3 text-left flex items-center gap-3 active:bg-slate-100 dark:active:bg-slate-800 disabled:cursor-default ${qChecks[idx] ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}`}>
              <div className="w-28 h-20 sm:w-36 sm:h-24 shrink-0 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-black overflow-hidden">
                <img src={`${CROP_BASE}/${item.image}`} alt={`${item.label} field reference`} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  {qChecks[idx] ? <CheckCircle2 size={24} className="text-emerald-500 shrink-0 mt-0.5" /> : <Circle size={24} className="text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <div className={qChecks[idx] ? "text-slate-900 dark:text-white font-semibold" : "text-slate-700 dark:text-slate-200"}>{item.label}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">{qChecks[idx] ? "Correct position confirmed" : "Tap when field matches screenshot"}</div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {row && <div className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">Quadrant {def.id} verified by {row.verifiedBy || "Ref"}{row.verifiedAt ? ` at ${fmtStamp(row.verifiedAt)}` : ""}.</div>}
      </div>

      {showQuadrantOverview && (
        <div className="fixed inset-0 z-[90] bg-black/70 dark:bg-black/95 flex flex-col" onClick={() => setShowQuadrantOverview(false)}>
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="font-bold">Quadrant {def.id} • {def.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Tap outside the image or close to return</div>
            </div>
            <button onClick={() => setShowQuadrantOverview(false)} className="p-2 border border-slate-300 dark:border-slate-700" aria-label="Close expanded quadrant"><X size={22} /></button>
          </div>
          <div className="flex-1 min-h-0 p-3 flex items-center justify-center" onClick={() => setShowQuadrantOverview(false)}>
            <img src={`/field-setup/quadrant-overviews/q${def.id}.jpg`} alt={`Expanded Quadrant ${def.id} reference`} className="max-w-full max-h-full object-contain bg-white dark:bg-black border border-slate-300 dark:border-slate-700" />
          </div>
        </div>
      )}

    </div>, document.body
  );
}
