import React from 'react';
import {BookOpen,ExternalLink} from 'lucide-react';
import {OFFICIAL_MANUALS_URL} from '../officialResources';
export default function OfficialManualsLink(){
 return <a href={OFFICIAL_MANUALS_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-left transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-700 text-white"><BookOpen size={21}/></span><span className="min-w-0 flex-1"><span className="block font-bold text-slate-900 dark:text-white">Official VEX game manuals</span><span className="block text-xs text-slate-600 dark:text-slate-300">Read and search the official online manuals at manuals.vex.com. Opens in a new tab; internet required.</span></span><ExternalLink size={18} className="shrink-0 text-indigo-700 dark:text-indigo-300"/></a>;
}
