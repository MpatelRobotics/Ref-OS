import {PDFDocument,StandardFonts} from 'pdf-lib';
import {localInterviewTime} from './interviewSchedule';
export async function optimizerSchedulePDF(plan){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);let page=pdf.addPage([612,792]),y=750;
 const line=value=>{const words=String(value).replace(/[^\x20-\x7e]/g,'?').split(/\s+/);let text='';const draw=()=>{if(y<42){page=pdf.addPage([612,792]);y=750;}page.drawText(text,{x:36,y,size:10,font});y-=16;text='';};for(const word of words){if(text&&font.widthOfTextAtSize(`${text} ${word}`,10)>540)draw();for(const ch of (text?' ':'')+word){if(font.widthOfTextAtSize(text+ch,10)>540)draw();text+=ch;}}draw();};
 line('Ref OS - Optimized interview schedule');line(`Event: ${plan.eventName||'Event'}${plan.sessionName?` | ${plan.sessionName}`:''}`);line(`Generated: ${new Date().toISOString()}`);line(`Timezone: ${plan.zone}`);line(`Interview window: ${plan.start.replace('T',' ')} to ${plan.end.replace('T',' ')}`);
 line(`Lunch: ${plan.useLunch?(plan.lunchOnly?'Interview during lunch only':'No interviews during lunch')+' | '+plan.lunchStart.replace('T',' ')+' to '+plan.lunchEnd.replace('T',' '):'No lunch restriction'}`);line('Suggested order; review match delays and team travel. Existing interviews are not included in this optimizer export.');line('');
 plan.entries.forEach((r,i)=>{line(`${i+1}. Team ${r.team}${plan.teamNames?.[r.team]?` - ${plan.teamNames[r.team]}`:''}`);line(`${localInterviewTime(r.start,plan.zone).replace('T',' ')} to ${localInterviewTime(new Date(Date.parse(r.start)+r.minutes*60000).toISOString(),plan.zone).replace('T',' ')} | ${r.panel}`);line(`Interview: ${r.minutes} min | Buffer: ${r.buffer||0} min${r.group?` | Judge group: ${r.group}`:''}`);line('');});
 line(`Teams not fitted: ${plan.unplaced.length?plan.unplaced.join(', '):'None'}`);line(`${plan.teamsWithTimes} selected teams have known match times. Match avoidance uses a ten-minute margin either side.`);
 return pdf.save();
}
