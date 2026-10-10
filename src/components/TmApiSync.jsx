import TmMultiServerSync from './TmMultiServerSync.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { normalizeTmSnapshot } from '../tmSnapshot.js';
import { matchTmDivision } from '../tmDivisionMapping.js';
import { scopeTmFieldActivity } from '../tmFieldActivity.js';

export default function TmApiSync({ open, onClose, target, onFetch, onApply, onActivity, onPublishActivity, onDisconnect, expectedCode = '', refosDivisions=[], refosDivisionId=0, savedDivisionMappings={}, onSaveDivisionMapping }) {
  const androidBrowser = /Android/i.test(navigator.userAgent);
  const androidDownload = import.meta.env.VITE_TM_ANDROID_DOWNLOAD_URL || 'https://github.com/MpatelRobotics/Ref-OS/releases/download/tm-connect-android/Ref-OS-TM-Connect.apk';
  const desktop = Boolean(window.refosTmDesktop), mobile = Boolean(window.Capacitor?.isNativePlatform?.());
  const [address, setAddress] = useState(mobile ? '' : 'http://localhost:8080');
  const [pairing, setPairing] = useState(''), [apiKey, setApiKey] = useState('');
  const [divisions, setDivisions] = useState([]), [division, setDivision] = useState('');
  const [remoteEvent, setRemoteEvent] = useState(null), [raw, setRaw] = useState(null), [session, setSession] = useState('');
  const [running, setRunning] = useState(false);
  const [multiple,setMultiple]=useState(false);
  useEffect(() => { window.refosTmDesktop?.setSyncActive(running).catch(() => {}); return () => { window.refosTmDesktop?.setSyncActive(false).catch(() => {}); }; }, [running]);
  const [connectionId, setConnectionId] = useState(''), [liveError, setLiveError] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const alive = useRef(true), version = useRef(0), inFlight = useRef(false), hashes = useRef({});
  const lastActivity = useRef(null);
  const activeConnection = useRef('');
  const delayedSync = useRef(null);
  const reviewedEvent = useRef(null);
  const latest = useRef({ onFetch, onApply, onActivity, onPublishActivity, onDisconnect }); latest.current = { onFetch, onApply, onActivity, onPublishActivity, onDisconnect };
  useEffect(() => { alive.current = true; return () => {
    alive.current = false; version.current++;
    latest.current.onDisconnect?.(activeConnection.current, '').catch(() => {});
  }; }, []);
  let preview = null, previewError = '';
  try { if (raw) preview = normalizeTmSnapshot(raw, session === '' ? undefined : Number(session)); }
  catch (e) { previewError = e.message; }
  const hasEliminations = Boolean(preview?.matches.some(match => ['r16', 'qf', 'sf', 'final'].includes(match.phase)));
  const syncInterval = hasEliminations ? 15000 : 30000;
  const mismatched = expectedCode && remoteEvent?.code && expectedCode.trim().toUpperCase() !== remoteEvent.code.trim().toUpperCase();
  const validPreview = preview && !mismatched && (!preview.sessions.length || preview.selectedSession != null);
  const stop = () => {
    const ticket = ++version.current; setRunning(false); setStatus('TM sync stopped.');
    if (lastActivity.current) {
      const value = { ...lastActivity.current, updatedAt: Date.now(), fieldSets: lastActivity.current.fieldSets.map(set => ({ ...set, connected: false })) };
      latest.current.onPublishActivity?.(value, () => alive.current && ticket === version.current).catch(() => {});
    }
  };
  const reset = setter => value => { setter(value); setRaw(null); setRemoteEvent(null); setDivisions([]); setDivision(''); setSession(''); setError(''); hashes.current = {}; reviewedEvent.current = null; };
  const settings = () => ({ address: address.trim(), apiKey: apiKey.trim(), pairingCode: pairing.trim(), division: division === '' ? null : Number(division), liveFields: true });
  const load = async () => {
    const ticket = ++version.current;
    setBusy(true); setError(''); setRaw(null);
    try {
      const data = await latest.current.onFetch({ ...settings(), division: null, liveFields: false });
      if (!alive.current || ticket !== version.current) return;
      if (!data.event || typeof data.event.name !== 'string' || data.event.code != null && typeof data.event.code !== 'string' || !Array.isArray(data.divisions) || !data.divisions.length || data.divisions.some(d => !Number.isSafeInteger(d.id) || d.id < 1 || typeof d.name !== 'string')) throw Error('TM returned no valid event or divisions.');
      const mapped=matchTmDivision(data.divisions,refosDivisions,refosDivisionId,savedDivisionMappings);
      setRemoteEvent(data.event); setDivisions(data.divisions); setDivision(mapped?String(mapped.id):'');
      setStatus(mapped?`${mapped.reason}: ${data.divisions.find(d=>d.id===mapped.id).name}`:'Choose the TM division for the selected Ref OS division.');
    } catch (e) { if (alive.current && ticket === version.current) setError(e.message || 'Could not connect to TM.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const review = async () => {
    if(refosDivisions.length>1 && !refosDivisionId){setError('Select a Ref OS division first, then connect its TM division.');return;}
    const ticket = ++version.current;
    setBusy(true); setError(''); setRaw(null);
    try {
      const data = await latest.current.onFetch({ ...settings(), liveFields: false });
      if (!alive.current || ticket !== version.current) return;
      normalizeTmSnapshot(data);
      await onSaveDivisionMapping?.(Number(division),data.divisions?.find(d=>d.id===Number(division))?.name || divisions.find(d=>d.id===Number(division))?.name);
      if (!alive.current || ticket !== version.current) return;
      reviewedEvent.current = data.event.code || data.event.name; setRemoteEvent(data.event); setRaw(data); setSession('');
    } catch (e) { if (alive.current && ticket === version.current) setError(e.message || 'Could not review TM data.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const apply = async (data, ticket) => {
    const current = () => alive.current && ticket === version.current;
    if (expectedCode && data.event?.code && expectedCode.trim().toUpperCase() !== data.event.code.trim().toUpperCase()) throw Error('TM is serving a different event code. Sync stopped.');
    if (reviewedEvent.current && reviewedEvent.current !== (data.event?.code || data.event?.name)) throw Error('TM is serving a different event from the reviewed snapshot. Sync stopped.');
    const snapshot = normalizeTmSnapshot(data, session === '' ? undefined : Number(session));
    if (snapshot.sessions.length && snapshot.selectedSession == null) throw Error('Choose the TM session to sync.');
    const applied = await latest.current.onApply(snapshot, { includeSchedule: true, hashes: hashes.current, current });
    if (current()) { setRemoteEvent(data.event); setRaw(data); setStatus(applied || 'TM data checked; no changes.'); activeConnection.current = data.connectionId || ''; setConnectionId(data.connectionId || ''); setLiveError(data.fieldError || ''); }
  };
  delayedSync.current = async ticket => {
    inFlight.current = true;
    try { const data = await latest.current.onFetch({ ...settings(), forceScores: true }); if (alive.current && ticket === version.current) await apply(data, ticket); }
    catch (e) { if (alive.current && ticket === version.current) { setError(e.message || 'TM score sync failed.'); stop(); } }
    finally { inFlight.current = false; }
  };
  const start = async () => {
    if (!validPreview || inFlight.current) return;
    const ticket = ++version.current; inFlight.current = true;
    setBusy(true); setError('');
    try { const data = await latest.current.onFetch(settings()); if (alive.current && ticket === version.current) await apply(data, ticket); if (alive.current && ticket === version.current) { setRunning(true); onClose(); } }
    catch (e) { if (alive.current && ticket === version.current) setError(e.message || 'TM sync failed.'); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  useEffect(() => {
    if (!running) return;
    const ticket = version.current;
    const timer = setInterval(async () => {
      if ((!desktop && document.hidden) || !navigator.onLine || inFlight.current) return;
      inFlight.current = true;
      try { const data = await latest.current.onFetch({ ...settings(), forceScores: true }); if (alive.current && ticket === version.current) await apply(data, ticket); }
      catch (e) { if (alive.current && ticket === version.current) { setError(e.message || 'TM sync failed.'); stop(); } }
      finally { inFlight.current = false; }
    }, syncInterval);
    return () => clearInterval(timer);
  }, [running, address, apiKey, pairing, division, session, expectedCode, syncInterval]);
  useEffect(() => {
    if (!running || !connectionId || !latest.current.onActivity) return;
    let active = true, pending = false, previous = '', publishedAt = 0;
    const observed = new Map(), scoreTimers = new Set();
    const ticket = version.current;
    const current = () => active && alive.current && ticket === version.current;
    const poll = async () => {
      if (!current() || pending || (!desktop && document.hidden) || !navigator.onLine) return;
      pending = true;
      try {
        const data = await latest.current.onActivity(connectionId, pairing.trim());
        if (!current()) return;
        const fieldSets = scopeTmFieldActivity(data, Number(division), preview?.selectedSession);
        for (const set of fieldSets) for (const field of set.fields) {
          const key = `${set.id}:${field.id}`;
          const playing = set.connected && field.status === 'playing' && field.match ? JSON.stringify(field.match) : '';
          if (playing && observed.get(key) !== playing) {
            const refresh = () => {
              scoreTimers.delete(timer);
              if (!current()) return;
              if (inFlight.current || !navigator.onLine) { timer = setTimeout(refresh, 1000); scoreTimers.add(timer); return; }
              delayedSync.current(ticket);
            };
            let timer = setTimeout(refresh, 30000); scoreTimers.add(timer);
          }
          observed.set(key, playing);
        }
        const fingerprint = JSON.stringify(fieldSets);
        if (fingerprint !== previous || Date.now() - publishedAt >= 30000) {
          await latest.current.onPublishActivity?.({ fieldSets, updatedAt: Date.now(), source: 'TM WebSocket' }, current);
          if (current()) { lastActivity.current = { fieldSets, updatedAt: Date.now(), source: 'TM WebSocket' }; previous = fingerprint; publishedAt = Date.now(); setLiveError(''); }
        }
      } catch {
        if (current()) {
          setLiveError('Live fields are disconnected; score and ranking sync continues.');
          if (lastActivity.current) {
            const fieldSets = lastActivity.current.fieldSets.map(set => ({ ...set, connected: false }));
            const fingerprint = JSON.stringify(fieldSets);
            if (fingerprint !== previous) {
              try { await latest.current.onPublishActivity?.({ fieldSets, updatedAt: Date.now(), source: 'TM WebSocket' }, current); if (current()) previous = fingerprint; } catch { /* Shared snapshot expires if Cloud is unavailable. */ }
            }
          }
        }
      }
      finally { pending = false; }
    };
    poll(); const timer = setInterval(poll, 1000);
    return () => { active = false; clearInterval(timer); for (const scoreTimer of scoreTimers) clearTimeout(scoreTimer); latest.current.onDisconnect?.(connectionId, pairing.trim()).catch(() => {}); };
  }, [running, connectionId, pairing, division, preview?.selectedSession]);
  const inputClass = 'w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2';
  const buttonClass = 'min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 font-semibold disabled:opacity-50';
  if(multiple)return <TmMultiServerSync open={open} onClose={onClose} onExit={()=>setMultiple(false)} refosDivisions={refosDivisions} expectedCode={expectedCode} onFetch={onFetch} onApply={onApply} onActivity={onActivity} onPublishActivity={onPublishActivity} onDisconnect={onDisconnect}/>;
  return <>
    {(running || status || error) && <div role="status" className="mx-4 mb-[calc(100px+env(safe-area-inset-bottom))] sm:mb-4 rounded-lg border border-blue-200 p-3 text-sm flex flex-wrap items-center gap-2"><span className="flex-1">{running ? `TM sync active · every ${hasEliminations ? '15' : '30'} seconds` : 'TM sync inactive'}{error ? ` · ${error}` : status ? ` · ${status}` : ''}{liveError && ` · ${liveError}`}</span>{running && <button className={buttonClass} onClick={stop}>Stop TM sync</button>}</div>}
    {open && <div className="fixed inset-0 z-[60] bg-black/40 p-3 flex items-center justify-center"><section role="dialog" aria-modal="true" aria-label="Tournament Manager API sync" className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Tournament Manager API <span className="text-sm text-amber-700 dark:text-amber-300">Experimental</span></h2><button className={buttonClass} onClick={onClose}>Close</button></div>
      <p className="text-sm">Target: {target}. {mobile ? 'Connect this device to the event Wi-Fi, then enter the TM address and event key.' : 'Open Ref OS TM Connect on a computer on the TM network.'} Other users receive the synced data through Ref OS Cloud.</p>
      <div className="rounded-lg border p-3 text-sm space-y-2"><p>In TM, open Tools, Options, then Web Publishing. Enable Local TM API and copy the event API key.</p>{!desktop && !mobile && (androidBrowser ? <>{androidDownload ? <a href={androidDownload} className="inline-flex items-center min-h-[44px] underline font-semibold">Download Ref OS TM Connect for Android</a> : <p>Android connector download is being prepared.</p>}<p>Install the APK on one Android device on the TM network. Sign in, select the event, then enter the TM IP address and API key. Keep the app open while syncing.</p></> : <><a href={import.meta.env.VITE_TM_DESKTOP_DOWNLOAD_URL || 'https://github.com/MpatelRobotics/Ref-OS/releases/download/tm-connect/Ref-OS-TM-Connect.exe'} download className="inline-flex items-center min-h-[44px] underline font-semibold">Download Ref OS TM Connect for Windows</a><p>Double-click the app, enter this website address: <b className="break-all">{window.location.origin}</b>, then sign in and select this event. No commands or Node.js installation needed.</p></>)}<p>The connecting device needs access to TM and the internet. Other users receive updates through Ref OS Cloud.</p></div>
      {refosDivisions.length>1&&<button className={buttonClass} disabled={busy||running||(!desktop&&!mobile)} onClick={()=>setMultiple(true)}>Sync both TM divisions</button>}
      <fieldset disabled={busy || running} className="space-y-3 disabled:opacity-70">
        <label className="block">TM server address<input className={inputClass} value={address} onChange={e => reset(setAddress)(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>

        <label className="block">Event TM API key<input className={inputClass} type="password" value={apiKey} onChange={e => reset(setApiKey)(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
        <p className="text-sm text-slate-500">The event key is kept in memory and cleared when you leave this event or reload.</p>
        <button className={buttonClass} disabled={(!desktop && !mobile) || !apiKey.trim() || !address.trim()} onClick={load}>Connect to TM</button>
        {remoteEvent && <p className="text-sm">Connected event: <b>{remoteEvent.name}</b>{remoteEvent.code && ` · ${remoteEvent.code}`}</p>}
        {!!divisions.length && <><p className="text-sm">Ref OS division: <b>{refosDivisions.find(d=>Number(d.id)===Number(refosDivisionId))?.name || 'Current event'}</b>. Review confirms this mapping.</p><label className="block">TM division<select className={inputClass} value={division} onChange={e => { setDivision(e.target.value); setRaw(null); setSession(''); hashes.current = {}; }}><option value="">Choose a division</option>{divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><button className={buttonClass} disabled={!division} onClick={review}>Review TM data</button></>}
        {preview && <><p className="text-sm">Missing matches are added automatically. Live fields show TM's assigned match and start/stop events in Matches for all event users. Sync teams, qualification rankings, skills, and scores. Scores only update matches with matching round, number, and teams. Existing fields and team assignments are kept. Empty lists do not clear data.</p>
          {preview.sessions.length > 1 && <label className="block">TM session<select className={inputClass} value={session} onChange={e => { setSession(e.target.value); hashes.current = {}; }}><option value="">Choose a TM session</option>{preview.sessions.map(id => <option key={id} value={id}>TM session {id}</option>)}</select></label>}
          <p className="text-sm">{preview.teams.length} teams · {preview.matches.length} matches · {preview.scores.length} scored matches · {preview.rankings.length} rankings · {preview.skills.length} skills results</p>
          {preview.warnings.map(w => <p key={w} className="text-sm text-amber-700 dark:text-amber-300">{w}</p>)}
        </>}
      </fieldset>
      {(error || previewError || mismatched) && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error || previewError || 'TM event code differs from this Ref OS event. Check that the correct TM event is open.'}</p>}
      {busy && <p role="status">Working…</p>}
      {!running && <button className="w-full min-h-[44px] rounded-lg bg-red-700 text-white px-3 py-2 font-semibold disabled:opacity-50" disabled={!validPreview || busy} onClick={start}>Start TM syncing</button>}
      {running && <button className={buttonClass} onClick={stop}>Stop TM sync</button>}
      <p className="text-sm text-slate-500">{desktop ? 'Checks run every 15 seconds when elimination matches exist, otherwise every 30 seconds, including when minimized. Closing its window while syncing keeps it in the system tray. Choose Quit and stop syncing from the tray to exit.' : mobile ? 'Keep Ref OS open on the event Wi-Fi while syncing. Switching apps or locking your device can pause sync. On iPhone/iPad, allow Local Network access when prompted.' : 'Start TM sync in the Ref OS mobile app or Windows desktop app.'} Closing this dialog keeps sync running. Errors stop TM sync; leaving the event, signing out, or reloading clears the connection.</p>
    </section></div>}
  </>;
}
