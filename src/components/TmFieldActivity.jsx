import React, { useEffect, useState } from 'react';
const rounds = { QUAL: 'Qualifier', PRACTICE: 'Practice', QF: 'Quarterfinal', SF: 'Semifinal', F: 'Final', FINAL: 'Final', R16: 'Round of 16' };
export default function TmFieldActivity({ value }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  if (!value?.fieldSets?.length) return null;
  const stale = !value.updatedAt || now - value.updatedAt > 90000;
  return <details aria-label="Live TM fields" className="mb-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 p-3">
    <summary className="min-h-[44px] cursor-pointer font-semibold rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">Live fields <span className="text-sm text-amber-700 dark:text-amber-300">Experimental</span>{stale && <span className="ml-2 text-sm text-amber-700 dark:text-amber-300">Updates unavailable</span>}</summary>
    {stale && <p className="text-sm text-amber-700 dark:text-amber-300">Live updates unavailable. Showing last observed field activity.</p>}
    <div className="mt-2 grid gap-2 sm:grid-cols-2">{value.fieldSets.flatMap(set => set.fields.map(field => {
      const live = set.connected && !stale;
      const status = live ? { playing: 'Playing now', queued: 'Queued', stopped: 'Stopped', unknown: 'Waiting for field event' }[field.status] : 'Connection unavailable';
      return <div key={`${set.id}-${field.id}`} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="font-semibold">{field.name}{live && field.active ? ' · Active field' : ''}</p><p className="text-sm">{field.match ? `${rounds[field.match.round] || field.match.round} #${field.match.match}` : 'Match identity not received'} · {status}</p><p className="text-sm text-slate-500">{set.name}</p></div>;
    }))}</div>
    <p className="mt-2 text-sm text-slate-500">TM reports assignments and match starts/stops. When connecting mid-match, the identity is unknown until TM sends an assignment event.</p>
  </details>;
}
