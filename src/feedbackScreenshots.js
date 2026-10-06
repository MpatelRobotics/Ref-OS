import { sendRoleCodeRequestPush } from './api';
import { supabase } from './supabaseClient';
import { compressRobotPhoto } from './photoCompression';
const BUCKET = 'feedback-screenshots';
export async function prepareFeedbackScreenshot(file) {
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)) throw Error('Choose a PNG, JPEG, or WebP screenshot.');
 if(file.size > 10*1024*1024) throw Error('Each screenshot must be 10 MB or smaller.');
 const result = await compressRobotPhoto(file);
 const blob = await (await fetch(result.dataUrl)).blob();
 return {blob,preview:result.dataUrl,mime:result.mime};
}
export async function submitFeedbackScreenshots({eventId,id,note,by,sessionId=null,screenshots=[]}) {
 if(screenshots.length>3)throw Error('Attach up to three screenshots.');
 const {data:auth,error:authError}=await supabase.auth.getUser();
 if(authError || !auth?.user)throw Error('Sign in to this event before sending feedback.');
 const {error}=await supabase.rpc('submit_feedback_with_screenshots',{p_event:eventId,p_id:id,p_note:note,p_by:by,p_session:sessionId});
 if(error)throw Error('Could not save feedback. Check your connection and ensure feedback-attachments.sql has been run.');
 await sendRoleCodeRequestPush(id).catch(()=>{});
 try {
  const {data:registered,error:readError}=await supabase.from('feedback_attachments').select('slot,path').eq('feedback_id',id);
  if(readError)throw readError;
  for(let slot=0;slot<screenshots.length;slot++){
   if(registered?.some(row=>row.slot===slot))continue;
   const shot=screenshots[slot];const ext=shot.mime==='image/webp'?'webp':'jpg';
   const path=`${eventId}/${auth.user.id}/${id}/${slot}.${ext}`;
   const {error:uploadError}=await supabase.storage.from(BUCKET).upload(path,shot.blob,{contentType:shot.mime,upsert:false});
   // A previous upload can have completed before registration failed. Register that same path on retry.
   if(uploadError && !['409','Duplicate'].includes(String(uploadError.statusCode || uploadError.error)) && !/already exists|duplicate/i.test(uploadError.message || ''))throw uploadError;
   const {error:linkError}=await supabase.rpc('register_feedback_screenshot',{p_feedback:id,p_slot:slot,p_path:path});
   if(linkError)throw linkError;
  }
 } catch {throw Error('Your message was saved, but a screenshot could not be attached. Keep this window open and press Send Feedback again to retry without duplicating the message.');}
}
export async function loadFeedbackScreenshots(feedbackId) {
 const {data,error}=await supabase.from('feedback_attachments').select('slot,path').eq('feedback_id',feedbackId).order('slot');
 if(error)throw Error('Could not load screenshots. Check your connection and screenshot setup.');
 return await Promise.all((data || []).map(async row=>{
  const {data:signed,error:signError}=await supabase.storage.from(BUCKET).createSignedUrl(row.path,600);
  if(signError)throw Error('Could not open this screenshot. Try again after checking your connection.');
  return {slot:row.slot,url:signed.signedUrl};
 }));
}
