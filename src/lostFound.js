import { supabase } from './supabaseClient';
import { prepareFeedbackScreenshot } from './feedbackScreenshots';

export const prepareItemPhoto = prepareFeedbackScreenshot;
const bucket = 'lost-found-photos';
export async function listLostFound(eventId) {
  const {data,error} = await supabase.from('lost_found_items').select('*').eq('event_id',eventId).order('created_at',{ascending:false});
  if(error) throw Error('Could not load lost-and-found. Check your connection and lost-found.sql setup.');
  return data || [];
}
export async function saveLostFound({eventId,id,description,location,by,photo}) {
  const {data,error} = await supabase.auth.getUser();
  if(error || !data?.user) throw Error('Sign in to the event before adding an item.');
  let path = null;
  if(photo) {
    path = `${eventId}/${data.user.id}/${id}.${photo.mime === 'image/webp' ? 'webp' : 'jpg'}`;
    const {error:uploadError} = await supabase.storage.from(bucket).upload(path,photo.blob,{contentType:photo.mime,upsert:true});
    if(uploadError) throw Error('Photo upload failed. Keep this form open and retry.');
  }
  // Stable form ID makes a retry safe if the first response was lost.
  const {error:saveError} = await supabase.from('lost_found_items').upsert({id,event_id:eventId,description:description.trim(),pickup_location:location.trim(),photo_path:path,created_by:data.user.id,logged_by:by || ''},{onConflict:'id',ignoreDuplicates:true});
  if(saveError) throw Error('Item could not be saved. Keep this form open and retry.');
}
export async function setLostFoundReturned(id,returned) {
  const {data,error} = await supabase.from('lost_found_items').update({returned}).eq('id',id).select('id');
  if(error || !data?.length) throw Error('Could not update this item. Admin access and a connection are required.');
}
export async function lostFoundPhoto(path) {
  const {data,error} = await supabase.storage.from(bucket).createSignedUrl(path,600);
  if(error) throw error;
  if(!data?.signedUrl) throw Error('Picture could not load.');
  return data.signedUrl;
}
