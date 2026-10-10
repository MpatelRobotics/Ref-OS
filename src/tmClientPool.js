export function createTmClientPool(createClient, {http,sockets,cloudUrl}) {
 const clients=new Map(), connections=new Map();
 const make=channel=>{
  const ids=new Set(), prefix=channel+':';
  const scoped={
   sign:options=>sockets.sign(options),
   open:async options=>{ids.add(options.id);return sockets.open({...options,id:prefix+options.id});},
   closeAll:async()=>{for(const id of ids)await sockets.close({id:prefix+id});ids.clear();},
   addListener:async(name,listener)=>sockets.addListener(name,event=>{if(event.id?.startsWith(prefix))listener({...event,id:event.id.slice(prefix.length)});}),
  };
  return createClient({http,sockets:scoped,cloudUrl});
 };
 return async(route,body)=>{
  const channel=route==='snapshot'?(body.channelId||'default'):connections.get(body.connectionId)||'default';
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(channel))throw Error('Invalid TM connection.');
  if(!clients.has(channel)){if(clients.size>=3)throw Error('Too many TM connections. Reopen the app.');clients.set(channel,make(channel));}
  const result=await clients.get(channel).request(route,body);
  if(result.connectionId){for(const [id,value] of connections)if(value===channel)connections.delete(id);connections.set(result.connectionId,channel);}
  if(route==='disconnect'){for(const [id,value] of connections)if(value===channel)connections.delete(id);}
  return route==='snapshot'?{...result,multiServer:true}:result;
 };
}
