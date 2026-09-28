import React, { useState } from "react";
import { AlertTriangle, Archive, ChevronLeft, Copy, ShieldCheck, X } from "lucide-react";
import EventLogo from "../EventLogo.jsx";

const CONFIRM_WORD = "ARCHIVE";

const fmtDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-b-0">
      <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 text-right min-w-0 break-all">{children}</span>
    </div>
  );
}

// Phase 7: Event Management (lifecycle/administration). Separate from Event Settings (branding).
export default function EventManagementModal({ event, eventId, brand, roleLabel = "Admin", isProtected = false, onArchive, onClose }) {
  const [requestedStep, setStep] = useState("details"); // details | confirm
  // A protected event (Highlander) can never reach the archive confirmation.
  const step = isProtected ? "details" : requestedStep;
  const [confirmText, setConfirmText] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const confirmed = confirmText.trim() === CONFIRM_WORD;
  const status = event?.archivedAt ? "ARCHIVED" : "ACTIVE";

  const copyId = async () => {
    try { await navigator.clipboard.writeText(eventId); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const archive = async () => {
    if (!confirmed || archiving || isProtected) return;
    setArchiving(true);
    setError("");
    try {
      await onArchive();
    } catch (archiveError) {
      setError(archiveError?.message || "Could not archive this event.");
      setArchiving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-end sm:items-center justify-center" onClick={archiving ? undefined : onClose}>
      <div className="w-full sm:max-w-lg h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-2xl bg-white dark:bg-slate-800 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 shrink-0" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          {step === "confirm"
            ? <button onClick={() => { setStep("details"); setConfirmText(""); setError(""); }} disabled={archiving} className="text-slate-500 dark:text-slate-300 disabled:opacity-40" aria-label="Back"><ChevronLeft size={22} /></button>
            : <Archive size={19} className="text-slate-600 dark:text-slate-300" />}
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">{step === "confirm" ? "Archive Event" : "Event Management"}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Event lifecycle · Admin only</p>
          </div>
          <button onClick={onClose} disabled={archiving} className="ml-auto text-slate-400 disabled:opacity-40" aria-label="Close"><X size={22} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="h-1.5" style={{ backgroundColor: brand?.accent || "#94A3B8" }} />
            <div className="p-3 flex items-center gap-3">
              <EventLogo src={brand?.logo} fallback={brand?.highlander ? "/logo.svg" : "/refos-logo.svg"} className="w-12 h-12 object-contain rounded-lg shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{event?.name || brand?.name || "Event"}</div>
                {brand?.shortName && <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{brand.shortName}</div>}
              </div>
            </div>
          </div>

          {step === "details" ? (
            <>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-3">
                <InfoRow label="Event name">{event?.name || brand?.name || "—"}</InfoRow>
                <InfoRow label="Event ID">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                    {eventId}
                    <button type="button" onClick={copyId} className="text-slate-400 hover:text-slate-600 shrink-0" aria-label="Copy event ID"><Copy size={13} /></button>
                  </span>
                  {copied && <span className="block text-[11px] font-normal text-slate-500">Copied</span>}
                </InfoRow>
                <InfoRow label="Status">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{status}</span>
                </InfoRow>
                <InfoRow label="Created">{fmtDate(event?.createdAt)}</InfoRow>
                <InfoRow label="Your role">{roleLabel}</InfoRow>
              </div>

              {isProtected ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><ShieldCheck size={18} /> Protected Event</div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">This event is a protected production event and cannot be archived. Its data and settings stay available as they are.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Archive size={17} /> Archive Event</div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Move this event out of the active event list. All of its data is kept, and it can be restored later from Archived Events.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-100">
                <div className="font-bold flex items-center gap-2 mb-1"><AlertTriangle size={17} /> Before you archive</div>
                <p>Archiving this event will remove it from the active event list. Event data, matches, violations, rankings, judging data, field logs, and settings will NOT be deleted.</p>
                <p className="mt-2">This device will leave the event and return to Choose VEX Event. An Admin can restore the event from Archived Events with this event's Admin access code.</p>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Type {CONFIRM_WORD} to confirm</span>
                <input value={confirmText} onChange={(e) => setConfirmText(e.target.value.toUpperCase())} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                  placeholder={CONFIRM_WORD} disabled={archiving}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-3 font-mono tracking-widest text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600" />
              </label>
            </>
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {error && <p className="mb-2 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={archiving} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold disabled:opacity-50">
              {step === "confirm" ? "Cancel" : "Close"}
            </button>
            {!isProtected && step === "details" && (
              <button onClick={() => setStep("confirm")} className="flex-1 rounded-lg bg-[#0D0F32] text-white py-2.5 font-bold flex items-center justify-center gap-2">
                <Archive size={16} /> Archive Event
              </button>
            )}
            {!isProtected && step === "confirm" && (
              <button onClick={archive} disabled={!confirmed || archiving} className="flex-1 rounded-lg bg-[#0D0F32] text-white py-2.5 font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                <Archive size={16} /> {archiving ? "Archiving…" : "Archive Event"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
