if(window===window.top){
 window.addEventListener('message',event=>{
  const m=event.data;
  if(event.source!==window||event.origin!==location.origin||m?.source!=='refos-tm-page'||typeof m.id!=='string'||m.id.length>100)return;
  if(!['ping','credentials','snapshot','activity','disconnect'].includes(m.route))return;
  if(JSON.stringify(m.body||{}).length>25000)return;
  chrome.runtime.sendMessage({target:'refos-tm',route:m.route,body:m.body||{}}).then(result=>window.postMessage({source:'refos-tm-extension',id:m.id,...result},location.origin)).catch(()=>window.postMessage({source:'refos-tm-extension',id:m.id,ok:false,error:'The TM extension restarted. Reload Ref OS and reconnect.'},location.origin));
 });
}
