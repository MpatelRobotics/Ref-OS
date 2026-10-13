import React, { useState } from 'react';
import { claimEventAccess } from '../api';
import { developerPasskey, passkeysSupported } from '../developerPasskey';

export default function DeveloperPageLock({ events, onUnlock }) {
  const event = events.find(row => !row.archivedAt)?.id || '';
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const usePasskey = async register => {
    if(busy)return;setBusy(true);setError('');
    try { await developerPasskey(event,register?code:undefined);setCode('');onUnlock('passkey'); }
    catch(err) {setError(err.name==='NotAllowedError'?'Passkey request cancelled. Try again or use your Developer code.':err.message || 'Passkey unavailable. Use your Developer code.');}
    finally{setCode('');setBusy(false);}
  };
  return <form className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3" onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { const access = await claimEventAccess(event, code); if (!access.developer || access.serverRole !== 'admin') throw Error(); setCode(''); onUnlock(); }
    catch { setCode(''); setError('Developer access could not be verified. Check your code and connection.'); }
    finally { setBusy(false); }
  }}>
    <h2 className="font-bold text-lg">Developer sign-in</h2>
    <label className="block text-sm font-semibold">Developer code<input type="password" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-lg border bg-transparent p-2" /></label>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <button disabled={busy || !event || !code.trim()} className="min-h-[44px] w-full rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold p-3 disabled:opacity-50">{busy ? 'Checking access…' : 'Open developer page'}</button>
    {passkeysSupported() && <>
      <button type="button" disabled={busy||!event} onClick={()=>usePasskey(false)} className="min-h-[44px] w-full rounded-xl border border-slate-300 dark:border-slate-600 p-3 font-semibold disabled:opacity-50">Sign in with passkey</button>
      <button type="button" disabled={busy||!event||!code.trim()} onClick={()=>usePasskey(true)} className="min-h-[44px] w-full rounded-xl border border-slate-300 dark:border-slate-600 p-3 text-sm font-semibold disabled:opacity-50">Set up fingerprint / passkey</button>
      <p className="text-xs text-slate-500 dark:text-slate-400">For first-time setup, enter your Developer code and choose Set up fingerprint / passkey. Windows Hello may use your fingerprint, face or PIN. Your fingerprint stays on your device. Keep your Developer code as a fallback.</p>
    </>}
  </form>;
}
