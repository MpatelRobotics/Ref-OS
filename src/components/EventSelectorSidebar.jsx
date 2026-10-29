import React,{useState} from 'react';
import {Home,CalendarDays,Play,Archive,Plus,Sun,Moon,Code2} from 'lucide-react';
export default function EventSelectorSidebar({active,theme,onToggleTheme,onSelect,developerPage=false}){
 const [dismissed,setDismissed]=useState(false);
 const choose=(key,event)=>{onSelect(key);setDismissed(true);if(event.detail>0)event.currentTarget.blur();};
 return <nav aria-label="Event selection navigation" onMouseEnter={()=>setDismissed(false)} onFocusCapture={()=>setDismissed(false)} className={`refos-selector-sidebar ${dismissed?'is-dismissed':''}`}>
 <a href="/" className="refos-selector-brand" aria-label="Ref-OS home"><img src="/refos-logo.svg" alt=""/><span>REF-OS</span></a>
 {developerPage ? <a href="/" title="Events"><CalendarDays size={18} aria-hidden="true"/><span>Events</span></a> : [["about","About Ref-OS",Home],["active","Events",CalendarDays],["demo","Try the demo",Play],["archived","Archived events",Archive],["create","Create event",Plus]].map(([key,label,Icon])=><button key={key} type="button" aria-label={label} title={label} aria-current={active===key?'page':undefined} onClick={event=>choose(key,event)}><Icon size={18} aria-hidden="true"/><span>{label}</span></button>)}
 <div className="refos-selector-nav-bottom"><button type="button" title={theme==='dark'?'Light mode':'Dark mode'} onClick={onToggleTheme}>{theme==='dark'?<Sun size={18} aria-hidden="true"/>:<Moon size={18} aria-hidden="true"/>}<span>{theme==='dark'?'Light mode':'Dark mode'}</span></button>
 <a href={developerPage?'/':'/?page=developer'} title={developerPage?'Back to events':'Developer login'}><Code2 size={18} aria-hidden="true"/><span>{developerPage?'Back to events':'Developer login'}</span></a></div>
 </nav>;
}
