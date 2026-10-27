// Metadata-first reads avoid retransmitting large unchanged setting values.
export function createSettingsReadCache({metadata,values,maxEntries=8}){
 const cache=new Map(),pending=new Map();
 async function read(scope,eventId){
  const key=scope+':'+eventId;
  if(pending.has(key))return pending.get(key);
  const request=(async()=>{
   const previous=cache.get(key);
   let rows;
   if(!previous)rows=await values(eventId,null);
   else{
    const versions=await metadata(eventId);
    const changed=versions.filter(r=>!previous.has(r.key)||r.updated_at==null||previous.get(r.key).updated_at!==r.updated_at).map(r=>r.key);
    const fresh=changed.length?await values(eventId,changed):[];
    const merged=new Map(previous);
    const have=new Set(versions.map(r=>r.key));
    for(const name of merged.keys())if(!have.has(name))merged.delete(name);
    for(const row of fresh)merged.set(row.key,row);
    rows=[...merged.values()];
   }
   cache.delete(key);cache.set(key,new Map(rows.map(r=>[r.key,r])));
   while(cache.size>maxEntries)cache.delete(cache.keys().next().value);
   return rows;
  })();
  pending.set(key,request);
  try{return await request;}finally{if(pending.get(key)===request)pending.delete(key);}
 }
 return {read};
}
