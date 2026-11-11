import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { tmPairingNumber, tmGameNumber, tmMatchOrder } from "../tmMatchIdentity";
import ScheduledMatchTime from "./ScheduledMatchTime";

export async function fetchPublicSchedule(eventId, preview = false) {
  const { data, error } = await supabase.rpc("get_public_event_schedule", { p_event: eventId, p_preview: preview });
  if (error) throw error;
  return data;
}

const control = "min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900";
const phases = { practice: "Practice", qual: "Qualification", r16: "Round of 16", qf: "Quarterfinal", sf: "Semifinal", final: "Final" };
const scopeKey = scope => `${scope.session || ""}:${scope.division}`;

function matchTitle(match) {
  if (match.label) return match.label;
  const phase = phases[match.phase] || match.phase;
  const attempt = tmGameNumber(match.phase, match.num);
  const pairing = tmPairingNumber(match.phase, match.num);
  return `${phase} ${pairing}${attempt > 1 ? `-${attempt}` : ""}`;
}

function MatchScore({ match, iq }) {
  if (iq) return match.redScore == null ? "Awaiting score" : `Shared score: ${match.redScore}`;
  if (match.redScore == null || match.blueScore == null) return "Awaiting score";
  return `${match.redScore} – ${match.blueScore}`;
}

export default function PublicEventSchedule({ eventId, eventName, onBack, fetchSchedule = fetchPublicSchedule }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState("matches");
  const [query, setQuery] = useState("");
  const [scopeId, setScopeId] = useState("");

  useEffect(() => {
    let active = true;
    let loading = false;
    async function refresh() {
      if (loading) return;
      loading = true;
      try {
        const result = await fetchSchedule(eventId);
        if (active) {
          setData(result);
          setError("");
        }
      } catch {
        if (active) setError("Could not refresh the schedule. Try again.");
      } finally {
        loading = false;
      }
    }
    void refresh();
    const interval = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(interval); };
  }, [eventId, fetchSchedule, retry]);

  const schedules = data?.schedules || [];
  const scope = schedules.find(item => scopeKey(item) === scopeId) || schedules[0];
  const search = query.trim().toLowerCase();
  const teamMatches = number => !search || [number, data?.teams?.[number]].some(value => String(value || "").toLowerCase().includes(search));
  const matches = scope?.matches
    .filter(match => !search || [...match.red, ...match.blue].some(teamMatches))
    .sort((a, b) => a.phase === b.phase ? tmMatchOrder(a, b) : 0) || [];
  const ranks = Object.entries(scope?.ranks || {}).filter(([number]) => teamMatches(number)).sort((a, b) => a[1] - b[1]);
  const iq = data?.program === "iq";

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl space-y-4">
        <button type="button" className={control} onClick={onBack}>Back to event</button>
        <h1 className="text-2xl font-bold">{eventName || "Event schedule"}</h1>
        {error && <p role="alert">{error} <button type="button" className={control} onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
        {!data && !error && <p role="status">Loading schedule…</p>}
        {data && !data.available && <p>No public match schedule is available for this event.</p>}
        {scope && <>
          {schedules.length > 1 && <label className="block font-semibold">Session and division
            <select className={control + " mt-1 block w-full"} value={scopeKey(scope)} onChange={e => setScopeId(e.target.value)}>
              {schedules.map(item => <option key={scopeKey(item)} value={scopeKey(item)}>
                {item.sessionName || "Event schedule"} · {item.division ? `Division ${item.division}` : "Main division"}
              </option>)}
            </select>
          </label>}
          <label className="block font-semibold">Search by team
            <input type="search" className={control + " mt-1 block w-full"} placeholder="Team number or name" value={query} onChange={e => setQuery(e.target.value)} />
          </label>
          <nav aria-label="Public schedule views" className="flex flex-wrap gap-2">
            {[["matches", "Matches & scores"], ["rankings", "Rankings"]].map(([value, label]) =>
              <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={control + " aria-pressed:bg-indigo-700 aria-pressed:text-white"}>{label}</button>
            )}
          </nav>
          {tab === "matches" ? (
            matches.length ? <ul className="space-y-2">{matches.map(match =>
              <li key={`${match.phase}:${match.num}`} className={control}>
                <p className="font-bold">{matchTitle(match)}</p>
                {match.field && <p className="text-sm">{match.field}</p>}
                <ScheduledMatchTime match={match} times={[...(scope.times || []), { ...match, scheduledAt: match.scheduled }]} zone={data.timezone} />
                <p className="break-words">{[match.red.join(", "), match.blue.join(", ")].filter(Boolean).join(iq ? " + " : " vs ")}</p>
                <p className="font-semibold"><MatchScore match={match} iq={iq} /></p>
              </li>
            )}</ul> : <p>No matches found for this team.</p>
          ) : (
            ranks.length ? <table className="w-full text-left">
              <thead><tr><th scope="col" className="p-2">Rank</th><th scope="col" className="p-2">Team</th></tr></thead>
              <tbody>{ranks.map(([number, rank]) => <tr key={number} className="border-t border-slate-300 dark:border-slate-700">
                <td className="p-2">{rank}</td><td className="p-2"><b>{number}</b>{data.teams[number] && ` · ${data.teams[number]}`}</td>
              </tr>)}</tbody>
            </table> : <p>{search ? "No rankings found for this team." : "Rankings have not been posted yet."}</p>
          )}
        </>}
      </div>
    </main>
  );
}
