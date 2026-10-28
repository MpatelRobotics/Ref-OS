import {useCallback,useEffect,useState} from 'react';
import * as api from './api';

// Supabase persists and refreshes the auth session. Re-check the server's Developer
// membership on mount; a local flag is never sufficient to unlock the developer page.
export default function useDeveloperSession(enabled,service=api){
 const [unlocked,setUnlocked]=useState(false),[checking,setChecking]=useState(!!enabled),[signingOut,setSigningOut]=useState(false),[error,setError]=useState('');
 const lock=useCallback(()=>setUnlocked(false),[]);
 const unlock=useCallback(()=>{setUnlocked(true);setChecking(false);setError('');},[]);
 useEffect(()=>{if(!enabled){setChecking(false);return;}let active=true;
  setChecking(true);service.hasDeveloperSession().then(ok=>{if(active)setUnlocked(ok);}).catch(e=>{if(active){setUnlocked(false);setError(e.message);}}).finally(()=>{if(active)setChecking(false);});
  const listener=service.onAuth?.(session=>{if(active&&!session)setUnlocked(false);});
  return()=>{active=false;listener?.data?.subscription?.unsubscribe();};
 },[enabled,service]);
 const signOut=useCallback(async()=>{setSigningOut(true);setError('');try{await service.signOutDeveloperSession();setUnlocked(false);}catch(e){setError(e.message||'Could not sign out. Try again.');}finally{setSigningOut(false);}},[service]);
 return {unlocked,checking,signingOut,error,lock,unlock,signOut};
}
