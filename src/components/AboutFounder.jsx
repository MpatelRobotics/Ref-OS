import React from 'react';
import { FOUNDER } from '../guide/founder.js';

export default function AboutFounder() {
  return (
    <section aria-label={FOUNDER.title} className="mt-5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-4 text-slate-900 dark:text-slate-100 leading-relaxed break-words">
      <h3 className="text-lg font-bold">{FOUNDER.title}</h3>
      <div className="mt-3 flex items-center gap-4">
        <img src="/founder-maharshi.jpg" alt="Maharshi Patel, founder of REF-OS" width="96" height="96" loading="lazy" className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
        <div className="min-w-0">
          <p className="font-semibold">{FOUNDER.name}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{FOUNDER.role}</p>
        </div>
      </div>
      <div className="mt-3 space-y-3">{FOUNDER.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
    </section>
  );
}
