import React from 'react';
import {ClipboardList,Camera,Star,Trophy,RefreshCw,BarChart3,ArrowRight} from 'lucide-react';
const features=[
 [ClipboardList,'Record what happened','Log violations with cited rules, match details, notes, and photos so your referee crew can review the same information.'],
 [Camera,'Know the robot','Keep robot photos and inspection follow-ups together as a shared visual reference.'],
 [Star,'Keep your crew informed','Use team history and watch notes to share observations that need attention throughout the event.'],
 [Trophy,'Recognize great teams','Capture Sportsmanship and Energy nominations with specific examples of what volunteers observed.'],
 [BarChart3,'Follow event progress','Review qualification rankings, Skills results, and the configured Excellence ranking cutoffs as data updates.'],
 [RefreshCw,'Connect your event data','Import Tournament Manager exports, or connect through the Windows connector or Chrome extension for supported live updates.']
];
export default function RefOsWelcome({onEvents,onDemo}){
 return <main className="refos-welcome" aria-label="About Ref-OS">
 <section className="refos-welcome-hero"><p className="refos-welcome-kicker">FOR VEX ROBOTICS EVENTS</p><h2>Your referee crew.<br/>One shared workspace.</h2><p>Ref-OS brings match information, violation logs, robot references, and award nominations together so volunteers can stay organized and informed.</p><div className="refos-welcome-actions"><button onClick={onEvents}>Choose an event <ArrowRight size={17} aria-hidden="true"/></button><button onClick={onDemo}>Explore the demo</button></div><p className="refos-welcome-note">Try the public V5 demo with fictional teams before using Ref-OS at your event. Demo code: <strong>DEMOV5</strong>.</p></section>
 <section className="refos-welcome-features" aria-label="Features">{features.map(([Icon,title,description])=><article key={title}><Icon size={22} aria-hidden="true"/><h3>{title}</h3><p>{description}</p></article>)}</section>
 <section className="refos-welcome-start"><h3>Ready for your next event?</h3><p>Open Events in the sidebar to find your event by state, then use the access code provided by event leadership. Organizers can create a new event from the sidebar.</p><p>Ref-OS supports event recordkeeping. Official rules, rulings, and award decisions remain with the event’s officials.</p></section>
 </main>;
}
