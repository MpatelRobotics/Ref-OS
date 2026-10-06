import React,{useCallback,useRef} from 'react';
import VexLiveSync from './VexLiveSync';
export default function VexSyncManager({visible,onOpen,onClose,onFetch,...props}){
 const tail=useRef(Promise.resolve());
 const latest=useRef(onFetch);latest.current=onFetch;
 const fetchQueued=useCallback((...args)=>{
  const task=tail.current.then(()=>latest.current(...args));
  tail.current=task.catch(()=>{});
  return task;
 },[]);
 return <div aria-label="Independent VEX syncs">{['rankings','skills','scores'].map(category=><VexLiveSync key={category} category={category} {...props} visible={visible[category]} onFetch={fetchQueued} onOpen={()=>onOpen(category)} onClose={()=>onClose(category)}/>)}</div>;
}
