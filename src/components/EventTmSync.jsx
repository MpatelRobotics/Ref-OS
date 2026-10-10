import React,{createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import TmApiSync from './TmApiSync.jsx';
const Context=createContext(null);
const callbacks=['onFetch','onApply','onActivity','onPublishActivity','onDisconnect','onSaveDivisionMapping','onDiscoverDivisions'];
export function EventTmSync({children}){
 const latest=useRef(null),signature=useRef(''),[config,setConfig]=useState(null);
 const [open,setOpen]=useState(()=>Boolean(window.refosTmDesktop));
 const register=useCallback(value=>{latest.current=value;const next=JSON.stringify(value,(_key,item)=>typeof item==='function'?undefined:item);if(next!==signature.current){signature.current=next;setConfig(value);}},[]);
 const handlers=useRef(Object.fromEntries(callbacks.map(name=>[name,(...args)=>latest.current?.[name]?.(...args)])));
 const control=React.useMemo(()=>({register,open,setOpen}),[register,open]);
 return <Context.Provider value={control}>{children}{config?.enabled&&<div className="refos-event-tm-sync"><TmApiSync {...config} {...handlers.current} open={open} onClose={()=>setOpen(false)}/></div>}</Context.Provider>;
}
export function EventTmSyncRegistration({config}){const control=useContext(Context);useEffect(()=>{control.register(config);});return null;}
export function useEventTmSync(){return useContext(Context);}
