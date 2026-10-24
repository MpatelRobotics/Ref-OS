const sockets=new Map();
const emit=(id,type,data)=>parent.postMessage({id,type,...(data?{data}:{})},'*');
window.addEventListener('message',event=>{
 if(event.source!==parent)return;
 const message=event.data;
 if(message.type==='open'){
  const socket=new WebSocket(message.url);sockets.set(message.id,socket);
  socket.onopen=()=>emit(message.id,'open');
  socket.onmessage=e=>{if(typeof e.data==='string'&&e.data.length<=100000)emit(message.id,'message',e.data);};
  socket.onerror=()=>emit(message.id,'error');
  socket.onclose=()=>{sockets.delete(message.id);emit(message.id,'close');};
 }else if(message.type==='close'){sockets.get(message.id)?.close();sockets.delete(message.id);}
});
parent.postMessage({type:'ready'},'*');
setInterval(()=>{if(sockets.size)parent.postMessage({type:'heartbeat'},'*');},20000);
