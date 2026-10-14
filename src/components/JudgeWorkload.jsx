import React from 'react';
import {workloadEstimate} from '../judgingInsights';
import {formatInterviewDisplay} from '../interviewSchedule';
export default function JudgeWorkload({entries,completions,duration,buffer,now=Date.now(),end,zone='UTC'}){
 const estimate=workloadEstimate(entries,completions,duration,buffer,now,end);
 return <div className="my-2 rounded border p-3"><p>{estimate.pending} pending · {estimate.minutes} minutes of interviews and buffers remaining</p><p>Estimated finish: {formatInterviewDisplay(new Date(estimate.finish).toISOString(),zone)}</p>{estimate.behind&&<p role="status" className="font-semibold text-amber-800">Running behind the planned finish</p>}<p className="text-sm">Assumes interviews continue from now; travel, unavailable teams and breaks can extend this estimate.</p></div>;
}
