import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, Search } from 'lucide-react';
import { searchArticles, visibleArticles } from '../guide/articles.js';
import AboutFounder from './AboutFounder.jsx';
import { FOUNDER } from '../guide/founder.js';

export default function UserGuide({ role, onClose, initialArticleId = null }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [articleId, setArticleId] = useState(initialArticleId);
  const heading = useRef(null);
  const available = visibleArticles(role);
  const article = available.find((a) => a.id === articleId);
  const results = searchArticles(role, query, category);
  const categories = [...new Set(available.map((a) => a.category)), 'About REF-OS'];
  const founderText = [FOUNDER.title, FOUNDER.name, FOUNDER.role, ...FOUNDER.paragraphs].join(' ').toLocaleLowerCase();
  const showFounder = (!category || category === 'About REF-OS') && query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean).every((word) => founderText.includes(word));
  const resultCount = results.length + (showFounder ? 1 : 0);
  useEffect(() => { heading.current?.focus(); }, [articleId, role]);
  const button = 'min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600';
  const section = (title, content) => <section className="mt-5"><h3 className="font-bold mb-2">{title}</h3>{content}</section>;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-4 text-slate-900 dark:text-slate-100 leading-relaxed break-words">
      <button type="button" className={`${button} flex items-center gap-2 mb-4`} onClick={article ? () => setArticleId(null) : onClose}>
        <ChevronLeft size={18} aria-hidden="true" />{article ? 'Back to User Guide' : 'Back to Features & Help'}
      </button>
      <h2 tabIndex={-1} ref={heading} className="text-xl font-bold focus:outline-none flex items-center gap-2"><BookOpen size={22} aria-hidden="true" />{article?.title || 'Ref OS User Guide'}</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Showing guidance for {role}. Bundled with Ref OS for local search and offline reading after the app has been cached.</p>
      {article ? (
        <article key={article.id}>
          <p className="mt-4">{article.summary}</p>
          {section('Available to', <p>{article.roles.join(' · ')}</p>)}
          {section('When to use it', <p>{article.when}</p>)}
          {section('How to use it', <ol className="list-decimal pl-6 space-y-2">{article.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>)}
          {section('What you’ll see', <p>{article.seen}</p>)}
          {section('Important', <p className="border-l-4 border-amber-500 pl-3">{article.important}</p>)}
          {section('Related guides', <div className="grid gap-2">{available.filter((a) => article.related.includes(a.id)).map((a) => <button type="button" key={a.id} className={button} onClick={() => setArticleId(a.id)}>{a.title}</button>)}</div>)}
        </article>
      ) : (
        <>
          <label htmlFor="refos-guide-search" className="block mt-5 font-semibold">Search the guide</label>
          <div className="relative mt-2"><Search className="absolute left-3 top-3 text-slate-500" size={20} aria-hidden="true" /><input id="refos-guide-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the guide…" type="search" className="w-full min-h-[44px] rounded-lg border border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900 pl-10 pr-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600" /></div>
          <label htmlFor="refos-guide-category" className="block mt-4 font-semibold">Category</label>
          <select id="refos-guide-category" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 w-full min-h-[44px] rounded-lg border border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900 px-3 py-2"><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          <p role="status" aria-live="polite" className="mt-4 text-sm text-slate-600 dark:text-slate-300">{resultCount} {resultCount === 1 ? 'result' : 'results'}</p>
          {!resultCount && <p className="mt-3">No matching articles for your role. Try a shorter term or choose All categories.</p>}
          {categories.filter((c) => results.some((a) => a.category === c)).map((c) => <section key={c} className="mt-5"><h3 className="font-bold mb-2">{c}</h3><div className="grid gap-2">{results.filter((a) => a.category === c).map((a) => <button type="button" key={a.id} className={button} onClick={() => setArticleId(a.id)}><span className="block font-semibold">{a.title}</span><span className="block text-sm text-slate-600 dark:text-slate-300">{a.summary}</span></button>)}</div></section>)}
          {showFounder && <AboutFounder />}
        </>
      )}
    </div>
  );
}
