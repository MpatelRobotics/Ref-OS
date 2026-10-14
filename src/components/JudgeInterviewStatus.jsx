import React,{useState} from 'react';
import {markJudgeInterview} from '../judgeGroupApi';
export default function JudgeInterviewStatus({eventId,entry,onSaved}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const mark=async()=>{if(entry.interviewed&&!confirm(`Mark team ${entry.team} as pending interview again?`))return;setBusy(true);try{await markJudgeInterview({p_event:eventId,p_session:entry.session_id||null,p_team:entry.team,p_version:entry.schedule_version,p_done:!entry.interviewed});await onSaved();setError('');}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div><p className="font-semibold">{entry.interviewed?'Interviewed':'Pending interview'}</p><button disabled={busy} className="min-h-[44px] rounded border px-3" onClick={mark}>{busy?'Saving…':entry.interviewed?'Mark as not interviewed':'Mark team interviewed'}</button>{error&&<p role="alert" className="text-red-700">{error}</p>}</div>;
}
