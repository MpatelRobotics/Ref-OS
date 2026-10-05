export const ROBOT_PHOTO_SLOTS = [{key:'front',label:'Front'},{key:'side',label:'Side'},{key:'back',label:'Back'},{key:'tag',label:'Inspection Tag'},{key:'lexan',label:'Lexan Diagram'}];
export const DEFAULT_REQUIRED_ROBOT_PHOTOS = ['front','side','back','tag'];
export function normalizeRequiredRobotPhotos(value){return Array.isArray(value)?ROBOT_PHOTO_SLOTS.filter(s=>value.includes(s.key)).map(s=>s.key):[...DEFAULT_REQUIRED_ROBOT_PHOTOS];}
export function robotPhotoSlots(required,isIQ=false){const keys=normalizeRequiredRobotPhotos(required);return ROBOT_PHOTO_SLOTS.filter(s=>!isIQ||s.key!=='lexan'||keys.includes('lexan')).map(s=>({...s,required:keys.includes(s.key)})).sort((a,b)=>Number(b.required)-Number(a.required));}
