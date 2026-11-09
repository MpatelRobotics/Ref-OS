import React, { useEffect, useState } from 'react';
import * as api from '../api';

export default function InitialAdminSetup({ eventId, onUnlock, onChooseEvent, children, accessApi = api }) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setPending(null); setError(''); setCode(''); setConfirm('');
    accessApi.eventRequiresAdminSetup(eventId).then(value => {
      if (!cancelled) setPending(value);
    }).catch(() => { if (!cancelled) setError('Could not check event setup. Try again.'); });
    return () => { cancelled = true; };
  }, [eventId, retry, accessApi]);
  const submit = async e => {
    e.preventDefault();
    if (saving) return;
    if (!/^\d[A-Z]\d\d$/.test(code)) return setError('Use number, letter, number, number. For example: 3S23.');
    if (code !== confirm) return setError('The admin codes do not match.');
    setSaving(true); setError('');
    try {
      await accessApi.completeInitialAdminSetup(eventId, code);
      setCode(''); setConfirm('');
      onUnlock('ref', true, 'admin', '', false);
    } catch (err) {
      setError(err.message || 'Could not save the admin code. Try again.');
      // Another user may have finished setup while this form was open.
      try { if (!await accessApi.eventRequiresAdminSetup(eventId)) setPending(false); } catch {}
    } finally { setSaving(false); }
  };
  if (pending === false) return children;
  return <div className="refos-safe-login min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100 grid place-items-center p-6">
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <h1 className="text-2xl font-bold">{pending ? 'Create an admin code' : 'Checking event setup…'}</h1>
      {pending && <form onSubmit={submit} className="mt-4 space-y-4">
        <p>This event needs an admin code before anyone can enter. Create one for event leadership and keep it safe.</p>
        <p id="admin-code-format" className="text-sm text-slate-600 dark:text-slate-300">Format: number, letter, number, number. For example: 3S23.</p>
        {[['New admin code',code,setCode],['Confirm admin code',confirm,setConfirm]].map(([label,value,setValue],i)=><label key={label} className="block font-medium">{label}
          <input type="password" autoComplete="new-password" autoCapitalize="characters" spellCheck={false} maxLength={4} value={value} disabled={saving} aria-describedby="admin-code-format" autoFocus={i===0}
            onChange={e=>{setValue(e.target.value.toUpperCase());setError('');}} className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-400 bg-white p-3 text-slate-900 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"/>
        </label>)}
        <button disabled={saving} className="min-h-[44px] w-full rounded-xl bg-indigo-700 p-3 font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Create code and enter event'}</button>
      </form>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {pending === null && error && <button onClick={()=>setRetry(x=>x+1)} className="mt-3 min-h-[44px] underline">Try again</button>}
      <button type="button" disabled={saving} onClick={onChooseEvent} className="mt-4 min-h-[44px] w-full underline">Back to events</button>
    </div>
  </div>;
}
