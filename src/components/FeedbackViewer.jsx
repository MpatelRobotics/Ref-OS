import React, { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

export default function FeedbackViewer({ isDeveloper = false, entries = [], eventName = '', sessionName = '', onClose }) {
  const [query, setQuery] = useState('');
  const feedback = useMemo(() => entries.filter(entry => entry.kind === 'feedback').sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)), [entries]);
  const filtered = feedback.filter(entry => `${entry.note || ''} ${entry.by || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  if (!isDeveloper) return null;
  return <section aria-label="Feedback submissions" className="space-y-4">
    <button onClick={onClose} className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold"><ChevronLeft size={18}/> Back to Features & Help</button>
    <div><h2 className="text-xl font-bold">View Feedback</h2><p className="text-sm text-slate-500 dark:text-slate-400">Developer view · {eventName}{sessionName ? ` · ${sessionName}` : ''}</p><p className="text-sm mt-1">{feedback.length} submission{feedback.length === 1 ? '' : 's'} in the current event or session. New submissions appear when event data syncs.</p></div>
    <label className="block"><span className="block text-sm font-semibold mb-1">Search feedback</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Message or sender" className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"/></label>
    {!filtered.length && <p role="status" className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm">{feedback.length ? 'No feedback matches your search.' : 'No feedback submissions in this event or session yet. Check the event/session or connection if you expected a submission.'}</p>}
    <div className="space-y-3">{filtered.map(entry => <article key={entry.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">{entry.by || 'Unknown sender'}</span>{Number.isFinite(entry.createdAt) && <time dateTime={new Date(entry.createdAt).toISOString()} className="text-slate-500 dark:text-slate-400">{new Date(entry.createdAt).toLocaleString()}</time>}</div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm">{entry.note || 'No message recorded.'}</p>
    </article>)}</div>
  </section>;
}

