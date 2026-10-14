import {PDFDocument,StandardFonts} from 'pdf-lib';
import {formatInterviewDisplay,interviewTimeToUTC} from './interviewSchedule';
import {interviewMatchWindow,interviewMatchLabel,groupOptimizerEntries} from './interviewMatchWindow';
export async function optimizerSchedulePDF(plan){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);let page=pdf.addPage([612,792]),y=750;
 const line=value=>{const words=String(value).replace(/[^\x20-\x7e]/g,'?').split(/\s+/);let text='';const draw=()=>{if(y<42){page=pdf.addPage([612,792]);y=750;}page.drawText(text,{x:36,y,size:10,font});y-=16;text='';};for(const word of words){if(text&&font.widthOfTextAtSize(`${text} ${word}`,10)>540)draw();for(const ch of (text?' ':'')+word){if(font.widthOfTextAtSize(text+ch,10)>540)draw();text+=ch;}}draw();};
 line('Ref OS - Optimized interview schedule');line(`Event: ${plan.eventName||'Event'}${plan.sessionName?` | ${plan.sessionName}`:''}`);line(`Generated: ${formatInterviewDisplay(new Date().toISOString(),plan.zone)}`);line(`Timezone: ${plan.zone}`);line(`Interview window: ${formatInterviewDisplay(interviewTimeToUTC(plan.start,plan.zone),plan.zone)} to ${formatInterviewDisplay(interviewTimeToUTC(plan.end,plan.zone),plan.zone)}`);
 line(`Lunch: ${plan.useLunch?(plan.lunchOnly?'Interview during lunch only':'No interviews during lunch')+' | '+formatInterviewDisplay(interviewTimeToUTC(plan.lunchStart,plan.zone),plan.zone)+' to '+formatInterviewDisplay(interviewTimeToUTC(plan.lunchEnd,plan.zone),plan.zone):'No lunch restriction'}`);line('Suggested order; review match delays and team travel. Existing interviews are not included in this optimizer export.');line('');
 line('Match references are this team\'s scheduled matches, not live completion. Confirm delays with the team.');line('');
 if(plan.groups){line('GROUP ASSIGNMENTS');for(const g of plan.groups){line(`${g.name} (${g.teams.length} teams): ${g.teams.join(', ')||'No teams'}`);if(g.unplaced?.length)line(`Not fitted in this group: ${g.unplaced.join(', ')}`);}line('');}
 for(const section of groupOptimizerEntries(plan.entries)){
 line(`JUDGE GROUP: ${section.name}`);line(`Teams: ${section.entries.map(r=>r.team).join(', ')}`);line('');
 section.entries.forEach((r,i)=>{line(`${i+1}. Team ${r.team}${plan.teamNames?.[r.team]?` - ${plan.teamNames[r.team]}`:''}`);line(`${formatInterviewDisplay(r.start,plan.zone)} to ${formatInterviewDisplay(new Date(Date.parse(r.start)+r.minutes*60000).toISOString(),plan.zone)}`);line(`Interview: ${r.minutes} min | Buffer: ${r.buffer||0} min`);
 const window=interviewMatchWindow(r,plan.matches||[]);const ref=m=>`${interviewMatchLabel(m)} (scheduled ${formatInterviewDisplay(m.scheduledAt,plan.zone)})`;
 line(`After match: ${window.after?ref(window.after):window.known?'No earlier scheduled match':'Unknown - match times unavailable'}`);
 line(`Before match: ${window.before?ref(window.before):window.known?'No later scheduled match':'Unknown - match times unavailable'}`);
 if(window.unknown)line('Some team match times are unavailable; this window may be incomplete.');if(window.overlapping.length)line('Match overlaps interview - review this slot.');line('');});
 }
 if(plan.conflictUnassigned?.length)line(`No conflict-free group: ${plan.conflictUnassigned.join(', ')}`);
 line(`Teams not fitted: ${plan.unplaced.length?plan.unplaced.join(', '):'None'}`);line(`${plan.teamsWithTimes} selected teams have known match times. Match avoidance uses a ten-minute margin either side.`);
 return pdf.save();
}
