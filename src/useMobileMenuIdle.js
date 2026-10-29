
import {useEffect} from 'react';

// Only small-screen or touch-oriented devices use the short gear-menu timeout.
export default function useMobileMenuIdle(menuRef,open,setOpen){
 useEffect(()=>{
  if(!open)return;
  const media=window.matchMedia('(max-width: 639px), (pointer: coarse)');
  const menu=menuRef.current;
  let timer;
  const restart=()=>{
   clearTimeout(timer);
   if(media.matches)timer=setTimeout(()=>setOpen(false),3000);
  };
  const events=['pointerdown','keydown','input','scroll','touchmove'];
  events.forEach(event=>menu?.addEventListener(event,restart,{passive:true,capture:true}));
  media.addEventListener('change',restart);
  restart();
  return()=>{
   clearTimeout(timer);
   events.forEach(event=>menu?.removeEventListener(event,restart,{capture:true}));
   media.removeEventListener('change',restart);
  };
 },[menuRef,open,setOpen]);
}
