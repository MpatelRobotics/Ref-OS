import {supabase} from './supabaseClient';
import {ensureAnonymousSession} from './api';
async function rpc(name,args){await ensureAnonymousSession();const {data,error}=await supabase.rpc(name,args);if(error)throw Error(error.message);return data;}
export const createJudgeGroupCode=(event,group)=>rpc('create_judge_group_code',{p_event:event,p_group:group});
export const listJudgeGroupCodes=event=>rpc('list_judge_group_codes',{p_event:event});
export const disableJudgeGroupCode=(event,group)=>rpc('disable_judge_group_code',{p_event:event,p_group:group});
export const loginJudgeGroup=(event,code)=>rpc('login_judge_group',{p_event:event,p_code:code});
export const loadJudgeGroupDashboard=event=>rpc('judge_group_dashboard',{p_event:event});
export const logoutJudgeGroup=event=>rpc('logout_judge_group',{p_event:event});
export const rescheduleJudgeInterview=args=>rpc('reschedule_judge_group_interview',args);
export const markJudgeInterview=args=>rpc('mark_judge_group_interview',args);
export const listJudgeGroupConflicts=event=>rpc('list_judge_group_conflicts',{p_event:event});
export const myJudgeGroupConflicts=event=>rpc('my_judge_group_conflicts',{p_event:event});
export const saveJudgeGroupConflicts=args=>rpc('save_judge_group_conflicts',args);
export const reassignJudgeTeam=args=>rpc('reassign_judge_team',args);
