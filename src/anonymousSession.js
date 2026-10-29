// Concurrent startup effects must share one anonymous sign-in. Otherwise the
// second sign-in can replace the account that just claimed event access.
export function createSessionEnsurer(auth){
 let pending=null;
 return ()=>{
  if(pending)return pending;
  pending=(async()=>{
   const {data:existing,error:readError}=await auth.getSession();
   if(readError)throw readError;
   if(existing?.session?.user)return existing.session;
   const {data,error}=await auth.signInAnonymously();
   if(error)throw error;
   if(!data?.session)throw Error('Could not start a sign-in session. Try again.');
   return data.session;
  })().finally(()=>{pending=null;});
  return pending;
 };
}
