import React, { useState } from 'react';
import { claimEventAccess } from '../api';

export default function DeveloperPageLock({ events, onUnlock }) {
  const [event, setEvent] = useState(events.find(row => !row.archivedAt)?.id || '');
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <form className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3" onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { const access = await claimEventAccess(event, code); if (!access.developer || access.serverRole !== 'admin') throw Error(); setCode(''); onUnlock(); }
    catch { setCode(''); setError('Developer access could not be verified. Check your code and connection.'); }
    finally { setBusy(false); }
  }}>
    <h2 className="font-bold text-lg">Developer sign-in</h2>
    <label className="block text-sm font-semibold">Sign-in event<select value={event} onChange={e => setEvent(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-lg border bg-transparent p-2"><option value="">Select event</option>{events.filter(row => !row.archivedAt).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    <label className="block text-sm font-semibold">Developer code<input type="password" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-lg border bg-transparent p-2" /></label>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <button disabled={busy || !event || !code.trim()} className="min-h-[44px] w-full rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold p-3 disabled:opacity-50">{busy ? 'Checking access…' : 'Open developer page'}</button>
  </form>;
}
