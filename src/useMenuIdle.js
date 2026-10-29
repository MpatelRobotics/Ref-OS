
import {useEffect} from 'react';

// Gear menus close after three seconds without interaction on every device.
export default function useMenuIdle(menuRef,open,setOpen){
 useEffect(()=>{
  if(!open)return;
  const menu=menuRef.current;
  let timer;
  const restart=()=>{
   clearTimeout(timer);
   timer=setTimeout(()=>setOpen(false),3000);
  };
  const events=['pointerdown','keydown','input','scroll','touchmove'];
  events.forEach(event=>menu?.addEventListener(event,restart,{passive:true,capture:true}));
  restart();
  return()=>{
   clearTimeout(timer);
   events.forEach(event=>menu?.removeEventListener(event,restart,{capture:true}));
  };
 },[menuRef,open,setOpen]);
}
