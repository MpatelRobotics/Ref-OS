import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, ChevronLeft, Flag, LogOut, Pencil, Play, Plus, RotateCcw, Trash2, Trophy, Users, X } from "lucide-react";
import * as api from "../api";
import {
  SESSION_STATUS_LABELS, activeSessionOf, nextSessionOf, sortSessions,
  formatSessionDate, sessionTimeRange,
} from "./leagueFormat";

const STATUS_STYLE = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800",
  completed: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600",
  upcoming: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800",
};
const RECORD_LABELS = {
  matches: "matches", violations: "violations", field_log: "field log entries", nominations: "award nominations",
  alliances: "alliances", attendance: "attendance records", robot_photos: "robot photos", snapshots: "imported ranking or skills snapshots",
};
const blankForm = (sessions) => ({
  name: `Session ${sessions.filter((s) => s.type === "session").length + 1}`,
  type: "session", date: "", startTime: "", endTime: "",
});

function SessionForm({ initial, busy, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (e) => setForm((cur) => ({ ...cur, [key]: e.target.value }));
  const input = "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white";
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Name
          <input value={form.name} onChange={set("name")} maxLength={80} required className={`${input} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Type
          <select value={form.type} onChange={set("type")} className={`${input} mt-1`}>
            <option value="session">League Session</option>
            <option value="finals">League Finals</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Date
          <input type="date" value={form.date} onChange={set("date")} className={`${input} mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Start <span className="font-normal text-slate-400">(optional)</span>
            <input type="time" value={form.startTime} onChange={set("startTime")} className={`${input} mt-1`} />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">End <span className="font-normal text-slate-400">(optional)</span>
            <input type="time" value={form.endTime} onChange={set("endTime")} className={`${input} mt-1`} />
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} disabled={busy} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm font-semibold">Cancel</button>}
        <button type="submit" disabled={busy || !form.name.trim()} className="flex-1 rounded-lg bg-[#0D0F32] text-white px-3 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}

export default function LeagueOverview({
  eventId, eventName, sessions = [], workingSessionId = "", isAdmin = false, teamCount = null,
  mode = "modal", onOpenSession, onReload, onClose, onChooseEvent, onLock,
}) {
  const ordered = useMemo(() => sortSessions(sessions), [sessions]);
  const active = activeSessionOf(ordered);
  const next = nextSessionOf(ordered);
  const working = ordered.find((s) => s.id === workingSessionId) || null;
  const completedCount = ordered.filter((s) => s.status === "completed").length;
  const [attendance, setAttendance] = useState({});
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null); // { session, counts, typed }

  useEffect(() => {
    let live = true;
    api.listLeagueAttendance(eventId).then((rows) => {
      if (!live) return;
      const counts = {};
      for (const row of rows) if (row.status === "present") counts[row.sessionId] = (counts[row.sessionId] || 0) + 1;
      setAttendance(counts);
    }).catch(() => {});
    return () => { live = false; };
  }, [eventId, sessions]);

  const run = async (key, action) => {
    setBusy(key);
    setError("");
    try { await action(); await onReload?.(); }
    catch (e) { setError(e?.message || "That change could not be saved."); }
    finally { setBusy(""); }
  };
  const create = (form) => run("create", async () => {
    const created = await api.createLeagueSession(eventId, form);
    setCreating(false);
    // The first session of a new league is offered as the one to start.
    if (!ordered.length && created && confirm(`Start ${created.name} now? Volunteers will work in ${created.name}.`)) {
      await api.setLeagueSessionStatus(created.id, "active");
    }
  });
  const save = (session, form) => run(`edit:${session.id}`, async () => { await api.updateLeagueSession(session.id, form); setEditingId(""); });
  const move = (session, delta) => run(`move:${session.id}`, async () => {
    const ids = ordered.map((s) => s.id);
    const from = ids.indexOf(session.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await api.reorderLeagueSessions(eventId, ids);
  });
  const start = (session) => {
    const note = active && active.id !== session.id ? `\n\n${active.name} is Active now and will be marked Completed.` : "";
    if (!confirm(`Start ${session.name}?\n\nVolunteers who open this league will work in ${session.name}.${note}`)) return;
    run(`status:${session.id}`, () => api.setLeagueSessionStatus(session.id, "active"));
  };
  const complete = (session) => {
    if (!confirm(`Complete ${session.name}?\n\nIts records are kept. No session will be Active until you start the next one.`)) return;
    run(`status:${session.id}`, () => api.setLeagueSessionStatus(session.id, "completed"));
  };
  const reopen = (session) => {
    if (!confirm(`Mark ${session.name} as Upcoming again? Its records are kept.`)) return;
    run(`status:${session.id}`, () => api.setLeagueSessionStatus(session.id, "upcoming"));
  };
  const askDelete = (session) => run(`delete:${session.id}`, async () => {
    const result = await api.deleteLeagueSession(session.id, null);
    if (result.status === "confirm_required") setDeleting({ session, counts: result.counts || {}, typed: "" });
  });
  const confirmDelete = () => run(`delete:${deleting.session.id}`, async () => {
    const result = await api.deleteLeagueSession(deleting.session.id, deleting.typed);
    if (result.status === "deleted") setDeleting(null);
    else setError("The session name did not match. Nothing was deleted.");
  });

  const stat = (label, value, sub = "") => (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">{label}</div>
      <div className="text-lg font-bold text-slate-900 dark:text-white truncate">{value}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{sub}</div>}
    </div>
  );
  const smallButton = "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50";

  const body = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stat("Active session", active ? active.name : "None", active ? formatSessionDate(active.date, { long: false }) : "")}
        {stat("Next session", next ? next.name : "—", next ? formatSessionDate(next.date, { long: false }) : "")}
        {stat("Teams", teamCount == null ? "—" : teamCount, "League-wide")}
        {stat("Sessions", ordered.length)}
        {stat("Completed", completedCount)}
        {working && stat("This device", working.name, working.id === active?.id ? "Active session" : SESSION_STATUS_LABELS[working.status])}
      </div>

      {!active && ordered.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {isAdmin ? "No session is Active. Start a session so volunteers know where their records belong." : "No session is Active right now. An Admin will start the next session."}
        </div>
      )}
      {error && <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">{error}</div>}

      {ordered.length === 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <h3 className="font-bold text-slate-900 dark:text-white">{isAdmin ? "Create First Session" : "No sessions yet"}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-3">{isAdmin ? "Add the first league session now. Later sessions can be added any time." : "An Admin will add the first league session."}</p>
          {isAdmin && <SessionForm initial={{ ...blankForm([]), name: "Session 1" }} busy={busy === "create"} submitLabel="Create Session" onSubmit={create} />}
        </div>
      )}

      {ordered.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">Sessions</h3>
          <ol className="space-y-2">
            {ordered.map((session, index) => {
              const isWorking = session.id === workingSessionId;
              const range = sessionTimeRange(session);
              return (
                <li key={session.id} className={`rounded-xl border bg-white dark:bg-slate-800 p-3 ${session.status === "active" ? "border-emerald-400 dark:border-emerald-700 ring-1 ring-emerald-300/60" : "border-slate-200 dark:border-slate-700"}`}>
                  {editingId === session.id ? (
                    <SessionForm initial={{ name: session.name, type: session.type, date: session.date, startTime: session.startTime, endTime: session.endTime }}
                      busy={busy === `edit:${session.id}`} submitLabel="Save Session" onSubmit={(form) => save(session, form)} onCancel={() => setEditingId("")} />
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[session.status]}`}>{SESSION_STATUS_LABELS[session.status]}</span>
                            {session.type === "finals" && <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><Trophy size={10} /> League Finals</span>}
                            {isWorking && <span className="rounded-md bg-[#0D0F32] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-white dark:text-slate-900">This device</span>}
                          </div>
                          <div className="mt-1 font-bold text-slate-900 dark:text-white">{session.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-wrap">
                            <CalendarDays size={12} /> {session.date ? formatSessionDate(session.date) : "Date not set"}{range ? ` · ${range}` : ""}
                            {attendance[session.id] ? <span className="inline-flex items-center gap-1 ml-1"><Users size={12} /> {attendance[session.id]} present</span> : null}
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex flex-col gap-1 shrink-0">
                            <button type="button" aria-label={`Move ${session.name} up`} disabled={!!busy || index === 0} onClick={() => move(session, -1)} className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp size={16} /></button>
                            <button type="button" aria-label={`Move ${session.name} down`} disabled={!!busy || index === ordered.length - 1} onClick={() => move(session, 1)} className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown size={16} /></button>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {onOpenSession && (isAdmin || session.status === "active") && !isWorking && (
                          <button type="button" onClick={() => onOpenSession(session.id)} className={`${smallButton} border-slate-300 dark:border-slate-600`}><Flag size={13} /> Work in {session.name}</button>
                        )}
                        {isAdmin && session.status !== "active" && <button type="button" disabled={!!busy} onClick={() => start(session)} className={`${smallButton} border-emerald-400 text-emerald-700 dark:text-emerald-300`}><Play size={13} /> Start Session</button>}
                        {isAdmin && session.status === "active" && <button type="button" disabled={!!busy} onClick={() => complete(session)} className={`${smallButton} border-slate-300 dark:border-slate-600`}><CheckCircle2 size={13} /> Complete Session</button>}
                        {isAdmin && session.status === "completed" && <button type="button" disabled={!!busy} onClick={() => reopen(session)} className={`${smallButton} border-slate-300 dark:border-slate-600`}><RotateCcw size={13} /> Mark Upcoming</button>}
                        {isAdmin && <button type="button" disabled={!!busy} onClick={() => setEditingId(session.id)} className={`${smallButton} border-slate-300 dark:border-slate-600`}><Pencil size={13} /> Edit</button>}
                        {isAdmin && session.status !== "active" && <button type="button" disabled={!!busy} onClick={() => askDelete(session)} className={`${smallButton} border-red-300 text-red-700 dark:border-red-800 dark:text-red-300`}><Trash2 size={13} /> Delete</button>}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {isAdmin && ordered.length > 0 && (
        creating ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-bold text-slate-900 dark:text-white mb-3">Create Session</h3>
            <SessionForm initial={blankForm(ordered)} busy={busy === "create"} submitLabel="Create Session" onSubmit={create} onCancel={() => setCreating(false)} />
          </div>
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="w-full rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2"><Plus size={16} /> Create Session</button>
        )
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">Teams, rules, access codes, and volunteer profiles are shared by the whole league. Matches, violations, field log entries, inspection photos, judging, and imported rankings belong to the session they were recorded in.</p>

      {deleting && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !busy && setDeleting(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="league-delete-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-2xl">
            <h2 id="league-delete-title" className="text-lg font-bold text-red-700 dark:text-red-300">Permanently delete {deleting.session.name}?</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">This session holds records. Deleting it permanently removes them. Other sessions and the league's teams are not affected. This cannot be undone.</p>
            <ul className="mt-3 text-sm text-slate-700 dark:text-slate-200 list-disc pl-5">
              {Object.entries(deleting.counts).filter(([, n]) => Number(n) > 0).map(([key, n]) => <li key={key}>{n} {RECORD_LABELS[key] || key}</li>)}
              {!Object.values(deleting.counts).some((n) => Number(n) > 0) && <li>This session was started (no records remain).</li>}
            </ul>
            <label className="block mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">Type <b>{deleting.session.name}</b> to confirm
              <input value={deleting.typed} onChange={(e) => setDeleting((cur) => ({ ...cur, typed: e.target.value }))} autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm" />
            </label>
            <div className="flex gap-2 mt-4">
              <button type="button" disabled={!!busy} onClick={() => setDeleting(null)} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm font-semibold">Cancel</button>
              <button type="button" disabled={!!busy || deleting.typed !== deleting.session.name} onClick={confirmDelete} className="flex-1 rounded-lg bg-red-600 text-white px-3 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Deleting…" : "Delete Session"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (mode === "page") {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            {onChooseEvent && <button type="button" onClick={onChooseEvent} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300"><ChevronLeft size={18} /> Events</button>}
            {onLock && <button type="button" onClick={onLock} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300"><LogOut size={16} /> Lock This Device</button>}
          </div>
          <div className="mb-4">
            <span className="rounded-full bg-[#0D0F32] text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">League</span>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{eventName}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">League Overview</p>
          </div>
          {body}
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="league-overview-title" onClick={(e) => e.stopPropagation()}
        className="bg-slate-50 dark:bg-slate-900 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
          <div className="min-w-0">
            <h2 id="league-overview-title" className="font-bold text-slate-900 dark:text-white truncate">{eventName}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{isAdmin ? "League Sessions" : "League Overview"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100"><X size={22} /></button>
        </div>
        <div className="p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>{body}</div>
      </div>
    </div>
  );
}
