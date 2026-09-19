import React, { useEffect, useState } from "react";
import { MapPin, RotateCcw, Save, X } from "lucide-react";

const FIELDS = ["Field 1", "Field 2", "Field 3"];

export default function FieldNameConfiguratorModal({ current = {}, onSave, onClose }) {
  const [names, setNames] = useState(() => Object.fromEntries(FIELDS.map((field) => [field, current[field] || field])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNames(Object.fromEntries(FIELDS.map((field) => [field, current[field] || field])));
  }, [current["Field 1"], current["Field 2"], current["Field 3"]]);

  const save = async () => {
    const cleaned = Object.fromEntries(FIELDS.map((field) => [field, String(names[field] || "").trim()]));
    if (FIELDS.some((field) => !cleaned[field])) {
      setError("Enter a name for all three fields.");
      return;
    }
    if (new Set(Object.values(cleaned).map((name) => name.toLowerCase())).size !== FIELDS.length) {
      setError("Each field needs a different name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(cleaned);
    } catch (saveError) {
      setError(saveError?.message || "Could not save the field names.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 flex flex-col overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 shrink-0">
          <MapPin size={19} className="text-[#D7212B]" />
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Field Name Configurator</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Names update for everyone at this event</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-400" aria-label="Close"><X size={22} /></button>
        </div>
        <div className="p-4 overflow-y-auto overscroll-contain touch-pan-y space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Enter the names printed on the competition fields. Match assignments remain connected to their original field numbers.</p>
          {FIELDS.map((field) => (
            <label key={field} className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{field}</span>
              <input
                value={names[field] || ""}
                onChange={(event) => setNames((currentNames) => ({ ...currentNames, [field]: event.target.value.slice(0, 40) }))}
                placeholder={`Name for ${field}`}
                maxLength={40}
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-3 text-slate-900 dark:text-slate-100"
              />
            </label>
          ))}
          <button type="button" onClick={() => { setNames(Object.fromEntries(FIELDS.map((field) => [field, field]))); setError(""); }} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <RotateCcw size={15} /> Restore Field 1, Field 2, and Field 3
          </button>
          {error && <div className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-2 shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-[#0D0F32] text-white py-2.5 font-bold flex items-center justify-center gap-2 disabled:opacity-60"><Save size={16} />{saving ? "Saving…" : "Save field names"}</button>
        </div>
      </div>
    </div>
  );
}
