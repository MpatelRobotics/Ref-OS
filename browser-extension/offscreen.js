const frame=document.querySelector('iframe');let ready;
const loaded=new Promise(resolve=>{ready=resolve;});
window.addEventListener('message',event=>{
 if(event.source!==frame.contentWindow)return;
 if(event.data?.type==='ready'){ready();return;}
 chrome.runtime.sendMessage({target:'refos-live-event',event:event.data}).catch(()=>{});
});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message?.target!=='refos-live-document'||sender.id!==chrome.runtime.id||sender.tab)return;
 loaded.then(()=>frame.contentWindow.postMessage(message,'*'));reply({ok:true});
});
