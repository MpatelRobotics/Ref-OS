import React, { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import EventLogo from "../EventLogo.jsx";

const INCLUDED_DATA = [
  "Teams",
  "Matches",
  "Violations",
  "Rankings",
  "Skills",
  "Alliances",
  "Judging data",
  "Field logs",
  "Event settings",
  "Branding",
  "Volunteer/event access configuration",
];

// Permanent deletion of an ARCHIVED event. Requires the exact event name (protects against mistakes)
// and an authorized code (this event's Admin code or a Ref OS override code), verified by the server.
// mode "archived" (Archived Events screen): Admin code or override. mode "emergency" (event login
// screen, forgotten Admin code): override only; the server archives and deletes in one step.
export default function DeleteEventModal({ event, profile, onDelete, onClose, mode = "archived" }) {
  const emergency = mode === "emergency";
  const eventName = String(event?.name || "").trim();
  const [typedName, setTypedName] = useState("");
  const [code, setCode] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const nameMatches = eventName !== "" && typedName.trim() === eventName;
  const codeReady = /^\d[A-Z]\d\d$/.test(code.trim().toUpperCase());
  const canDelete = nameMatches && codeReady && !deleting;

  const submit = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError("");
    try {
      const result = await onDelete(typedName, code.trim().toUpperCase());
      if (result === "deleted") return; // parent closes the modal
      if (result === "locked") setError("Too many incorrect codes. Try again in a few minutes.");
      else if (result === "name_mismatch") setError("The event name does not match exactly.");
      else setError(emergency ? "That override code is not authorized." : "That code is not authorized to delete this event.");
      setDeleting(false);
    } catch (deleteError) {
      setError(deleteError?.message || "Could not delete this event.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-end sm:items-center justify-center" onClick={deleting ? undefined : onClose}>
      <div className="w-full sm:max-w-lg h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-2xl bg-white dark:bg-slate-800 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 shrink-0" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <Trash2 size={19} className="text-red-600 dark:text-red-400" />
          <h2 className="font-bold text-slate-900 dark:text-slate-100">Permanently Delete Event</h2>
          <button onClick={onClose} disabled={deleting} className="ml-auto text-slate-400 disabled:opacity-40" aria-label="Close"><X size={22} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 space-y-4">
          <div className="flex items-center gap-3">
            <EventLogo src={profile?.logo} fallback="/refos-logo.svg" className="w-12 h-12 object-contain rounded-lg shrink-0 opacity-80" />
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{eventName || "Event"}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{emergency ? "Selected event" : "Archived event"}</div>
            </div>
          </div>

          <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4 text-sm text-red-900 dark:text-red-100">
            <div className="font-bold flex items-center gap-2 mb-1"><AlertTriangle size={17} /> This cannot be undone</div>
            <p>{emergency
              ? "This will permanently delete this event and all Ref OS data associated with it. This cannot be undone."
              : "This permanently deletes this event and all Ref OS data associated with it. This cannot be undone."}</p>
            <p className="mt-2 font-semibold">This includes:</p>
            <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 list-disc pl-5">
              {INCLUDED_DATA.map((item) => <li key={item}>{item}</li>)}
            </ul>
            {emergency && <p className="mt-2">If this event is still active, Ref OS archives it and deletes it in one step.</p>}
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">To permanently delete this event, type:</span>
            <span className="mt-1 block rounded-lg bg-slate-100 dark:bg-slate-900 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100 break-all select-all">{eventName}</span>
            <input value={typedName} onChange={(e) => { setTypedName(e.target.value); setError(""); }} disabled={deleting}
              autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="Event name"
              className={`mt-2 w-full rounded-xl border bg-white dark:bg-slate-900 px-3 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600 ${typedName && !nameMatches ? "border-red-400 dark:border-red-500" : "border-slate-300 dark:border-slate-600"}`} />
            {typedName && !nameMatches && <span className="mt-1 block text-xs font-semibold text-red-700 dark:text-red-300">The name must match exactly, including capitalization.</span>}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{emergency ? "Override Code" : "Admin / Override Code"}</span>
            <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }} disabled={deleting} maxLength={4}
              autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="3S23" inputMode="text"
              className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-3 font-mono tracking-widest text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600" />
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{emergency
              ? "Enter an authorized Ref OS override code. Event access codes are not accepted here."
              : "Enter this event's Admin code or an authorized Ref OS override code."}</span>
          </label>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {error && <p className="mb-2 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={deleting} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold disabled:opacity-50">Cancel</button>
            <button onClick={submit} disabled={!canDelete} className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 text-white py-2.5 font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-red-600">
              <Trash2 size={16} /> {deleting ? "Deleting…" : "Delete Event Permanently"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
