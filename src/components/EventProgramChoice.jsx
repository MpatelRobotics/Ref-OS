import React from 'react';
export function detectEventProgram(details) {
 const text=String(details?.program||'')+' '+String(details?.code||'');
 if(/\bIQ\b|VIQRC|VIQC|VE-IQ/i.test(text))return 'iq';
 if(/V5|VEX\s*U|VURC|VRC/i.test(text))return 'v5';
 return '';
}
export const programLabel=value=>value==='iq'?'VEX IQ':'V5RC / VEX U';
export default function EventProgramChoice({value,onChange,disabled=false}) {
 return <fieldset className="mb-4"><legend className="font-semibold mb-2">Competition program (required)</legend><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{[['iq','VEX IQ','IQ event · Level Up manual'],['v5','V5RC / VEX U','V5 and university events']].map(([key,label,hint])=><label key={key} className={`flex gap-2 min-h-[44px] border-2 rounded-xl p-3 ${value===key?'border-blue-600 bg-blue-50 dark:bg-blue-950/30':'border-slate-200 dark:border-slate-700'}`}><input type="radio" name="competition-program" value={key} checked={value===key} disabled={disabled} onChange={()=>onChange(key)}/><span><span className="block font-semibold">{label}</span><span className="text-sm text-slate-500">{hint}</span></span></label>)}</div>{value==='iq'&&<p className="mt-2 text-sm text-slate-500">IQ support currently includes event identification and the Level Up manual. IQ-specific match, finals and scoring workflows are not yet implemented.</p>}</fieldset>;
}
