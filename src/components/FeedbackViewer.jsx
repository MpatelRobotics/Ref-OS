import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { listFeedbackManagement, setFeedbackStatus } from '../api';
const STATUSES = { new: 'New', in_progress: 'In progress', resolved: 'Resolved' };
export default function FeedbackViewer({ isDeveloper = false, entries = [], eventId, eventName = '', sessionName = '', universal = false, onClose, loadStatuses = listFeedbackManagement, saveStatus = setFeedbackStatus }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const saving = useRef(false);
  useEffect(() => {
    if (!isDeveloper) return;
    let active = true;
    setLoading(true); setError('');
    loadStatuses(eventId).then(rows => { if(active) { setStatuses(Object.fromEntries(rows.map(r => [r.feedback_id, r.status]))); setLoading(false); } })
      .catch(() => { if(active) { setLoading(false); setError("Could not load feedback statuses. Check your connection and Developer access, and ensure " + (universal ? "universal-feedback.sql" : "feedback-management.sql") + " has been run."); } });
    return () => { active = false; };
  }, [eventId, isDeveloper, loadStatuses, refresh, universal]);
  const feedback = useMemo(() => entries.filter(e => e.kind === 'feedback').sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)), [entries]);
  const statusOf = e => STATUSES[statuses[e.id]] ? statuses[e.id] : 'new';
  const filtered = feedback.filter(e => (eventFilter === 'all' || e.eventId === eventFilter) && (filter === 'all' || statusOf(e) === filter) && `${e.note || ''} ${e.by || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const update = async (entry, status) => {
    if (saving.current || loading || error || !isDeveloper) return;
    saving.current = true; setBusy(entry.id); setNotice('');
    try { await saveStatus(eventId, entry.id, status); setStatuses(old => ({...old,[entry.id]:status})); setNotice(`Feedback marked ${STATUSES[status]}.`); }
    catch { setNotice('Status was not saved. Check your connection and Developer access, then try again.'); }
    finally { saving.current = false; setBusy(null); }
  };
  if (!isDeveloper) return null;
  const control = 'w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2';
  return <section aria-label="Feedback submissions" className="space-y-4">
    <button type="button" onClick={onClose} className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold"><ChevronLeft size={18}/> {universal ? 'Back to Choose VEX Event' : 'Back to Features & Help'}</button>
    <div><h2 className="text-xl font-bold">{universal ? 'Universal Feedback' : 'View Feedback'}</h2><p className="text-sm text-slate-500 dark:text-slate-400">Developer view · {universal ? 'All events and League sessions' : eventName}{sessionName ? ` · ${sessionName}` : ''}</p><p className="text-sm mt-1">{feedback.length} submissions {universal ? 'across all events and League sessions' : 'in the current event or session'}. New submissions appear when event data syncs. Status changes require a cloud connection.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><label><span className="block text-sm font-semibold mb-1">Search feedback</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Message or sender" className={control}/></label>
    <label><span className="block text-sm font-semibold mb-1">Filter by status</span><select value={filter} onChange={e=>setFilter(e.target.value)} disabled={loading || !!error} className={control}><option value="all">All ({feedback.length})</option>{Object.entries(STATUSES).map(([key,label])=><option key={key} value={key}>{label} ({feedback.filter(e=>statusOf(e)===key).length})</option>)}</select></label></div>
    {universal && <label className="block"><span className="block text-sm font-semibold mb-1">Filter by event</span><select className={control} value={eventFilter} onChange={e=>setEventFilter(e.target.value)}><option value="all">All events</option>{Array.from(new Map(feedback.map(e=>[e.eventId,e.eventName])).entries()).sort((a,b)=>a[1].localeCompare(b[1])).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}
    <button type="button" disabled={loading || !!busy} onClick={()=>{setNotice('');setRefresh(n=>n+1);}} className="min-h-[44px] rounded-lg border px-3 disabled:opacity-50">Refresh statuses</button>
    {loading && <p role="status">Loading statuses…</p>}{error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!filtered.length && <p role="status">{feedback.length ? 'No feedback matches your search or status filter.' : 'No feedback submissions in this event or session yet.'}</p>}
    <div className="space-y-3">{filtered.map(entry => <article key={entry.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">{entry.by || 'Unknown sender'}</span>{Number.isFinite(entry.createdAt) && <time dateTime={new Date(entry.createdAt).toISOString()} className="text-slate-500 dark:text-slate-400">{new Date(entry.createdAt).toLocaleString()}</time>}</div>
      {universal && <p className="mt-2 text-sm font-semibold">{entry.eventName}{entry.sessionName ? ` · ${entry.sessionName}` : ""}</p>}
      <p className="my-3 whitespace-pre-wrap break-words text-sm">{entry.note || 'No message recorded.'}</p>
      <label className="block sm:max-w-xs"><span className="block text-sm font-semibold mb-1">Status for {entry.by || 'Unknown sender'}</span><select aria-label={`Status for ${entry.by || 'Unknown sender'}`} value={statusOf(entry)} disabled={loading || !!error || !!busy} onChange={e=>update(entry,e.target.value)} className={control}>{Object.entries(STATUSES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>{busy===entry.id && <p role="status">Saving…</p>}
    </article>)}</div>
  </section>;
}
