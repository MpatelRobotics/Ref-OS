import React, {useState} from 'react';
import UserGuide from './UserGuide.jsx';
import {ROLES} from '../guide/articles.js';

// Public documentation only; choosing a role here never changes event access.
export default function MainUserGuide({onClose}) {
 const [role,setRole]=useState('Referee');
 return <main aria-label="User Guide" className="space-y-4">
  <label className="block font-semibold">Read guidance for
   <select className="mt-2 block w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800" value={role} onChange={event=>setRole(event.target.value)}>
    {ROLES.filter(value=>value!=='Developer').map(value=><option key={value}>{value}</option>)}
   </select>
  </label>
  <p className="text-sm text-slate-600 dark:text-slate-300">No event code is needed to read the guide. Your event login determines which tools you can use.</p>
  <UserGuide key={role} role={role} onClose={onClose} publicView/>
 </main>;
}
