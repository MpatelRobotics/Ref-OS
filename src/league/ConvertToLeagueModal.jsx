import React, { useEffect, useState } from "react";
import { AlertTriangle, Repeat, X } from "lucide-react";
import * as api from "../api";

// One-way Tournament -> League conversion. The counts come from the database
// (tournament_conversion_preview); categories that cannot be counted are not shown. The conversion
// itself is one server-side transaction (convert_refos_tournament_to_league).
const MOVE_ROWS = [
  ["matches", "Matches"],
  ["scored_matches", "Matches with scores"],
  ["violations", "Violations"],
  ["violation_photos", "Violation photos"],
  ["field_log", "Field log entries (timeouts, faults, replays, AWP, help requests, announcements)"],
  ["field_reset_checks", "Field reset checks"],
  ["alliances", "Alliances"],
  ["nominations", "Award nominations"],
  ["finalists", "Award finalists"],
  ["inspection_photos", "Robot inspection photos"],
];
const KEEP_ROWS = [
  ["teams", "Teams"],
  ["rules", "Rules"],
  ["access_codes", "Access codes"],
  ["members", "Signed-in volunteers and roles"],
  ["volunteer_profiles", "Volunteer profiles"],
  ["settings", "Branding, field names, and other event settings"],
];

export default function ConvertToLeagueModal({ eventId, eventName, onConverted, onClose }) {
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [sessionName, setSessionName] = useState("Session 1");
  const [sessionDate, setSessionDate] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api.tournamentConversionPreview(eventId)
      .then((data) => { if (live) setPreview(data); })
      .catch((e) => { if (live) setLoadError(e?.message || "Could not load this event's data."); });
    return () => { live = false; };
  }, [eventId]);

  const exactName = preview?.event_name ?? eventName ?? "";
  const matches = typed === exactName && exactName !== "";
  const move = preview?.move || {};
  const keep = preview?.keep || {};
  const first = sessionName.trim() || "Session 1";

  const convert = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.convertTournamentToLeague(eventId, { confirmName: typed, sessionName: first, sessionDate: sessionDate || null });
      if (result.status === "converted" || result.status === "already_league") {
        onConverted?.(result);
        return;
      }
      setError(result.status === "name_mismatch" ? "The event name did not match. Nothing was changed." : "The event could not be converted. Nothing was changed.");
    } catch (e) {
      setError(`${e?.message || "The event could not be converted."} Nothing was changed.`);
    } finally {
      setBusy(false);
    }
  };

  const row = (label, value) => (
    <li key={label} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <b className="tabular-nums text-slate-900 dark:text-slate-100">{value}</b>
    </li>
  );

  return (
    <div className="fixed inset-0 z-[95] bg-black/50 flex items-end sm:items-center justify-center" onClick={busy ? undefined : onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="convert-league-title" onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 shadow-2xl">
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Repeat size={19} className="text-slate-600 dark:text-slate-300" />
          <h2 id="convert-league-title" className="font-bold text-slate-900 dark:text-slate-100">Convert Tournament to League</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="ml-auto text-slate-400 disabled:opacity-40"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-amber-900 dark:text-amber-100 space-y-2">
            <p className="flex gap-2 font-semibold"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> This will permanently convert this Tournament into a League.</p>
            <p>Your existing event data will become the first League session. Teams, rules, access codes, volunteers, branding and other event-wide settings will remain shared across the League.</p>
            <p className="font-semibold">This conversion cannot be undone.</p>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Current Event</div>
            <div className="font-bold text-slate-900 dark:text-white">{exactName || "…"}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block font-medium text-slate-700 dark:text-slate-200">First Session
              <input value={sessionName} onChange={(e) => setSessionName(e.target.value)} maxLength={80} disabled={busy}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5" />
            </label>
            <label className="block font-medium text-slate-700 dark:text-slate-200">Session Date <span className="font-normal text-slate-400">(optional)</span>
              <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} disabled={busy}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5" />
            </label>
          </div>

          {loadError ? <p className="text-red-700 dark:text-red-300 font-semibold">{loadError}</p> : !preview ? <p className="text-slate-500">Counting this event's data…</p> : (
            <>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-1">Existing data to move into {first}</h3>
                <ul>
                  {MOVE_ROWS.filter(([key]) => Number.isFinite(Number(move[key]))).map(([key, label]) => row(label, Number(move[key])))}
                  {Number.isFinite(Number(move.ranked_teams)) && row("Ranking snapshot", Number(move.ranked_teams) ? `Available (${move.ranked_teams} ranked teams)` : "None")}
                  {Number.isFinite(Number(move.qualification_records)) && Number(move.qualification_records) > 0 && row("Imported W-L-T records", Number(move.qualification_records))}
                  {Number.isFinite(Number(move.skills_rows)) && row("Skills snapshot", Number(move.skills_rows) ? `Available (${move.skills_rows} teams)` : "None")}
                  {move.judging_rank_order === true && row("Judging rank order", "Available")}
                </ul>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-1">League-wide data retained</h3>
                <ul>{KEEP_ROWS.filter(([key]) => Number.isFinite(Number(keep[key]))).map(([key, label]) => row(label, Number(keep[key])))}</ul>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Nothing is copied. These stay attached to the event and are shared by every session.</p>
              </section>
            </>
          )}

          <label className="block font-medium text-slate-700 dark:text-slate-200">Type <b className="select-all">{exactName}</b> to confirm conversion.
            <input value={typed} onChange={(e) => { setTyped(e.target.value); setError(""); }} disabled={busy || !preview} autoComplete="off" autoCapitalize="off" spellCheck={false}
              aria-label="Type the event name to confirm"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5" />
          </label>
          {error && <p className="text-red-700 dark:text-red-300 font-semibold">{error}</p>}
          <div className="flex gap-2 pb-[env(safe-area-inset-bottom)]">
            <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">Cancel</button>
            <button type="button" onClick={convert} disabled={!matches || busy || !preview}
              className="flex-1 rounded-lg bg-red-600 text-white px-3 py-2.5 font-semibold disabled:opacity-50">{busy ? "Converting…" : "Convert to League"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
