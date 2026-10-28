// Only the server's verified Developer session may promote an event sign-in.
export async function resolveDeveloperEventAccess(eventId,access,{hasDeveloperSession,openDeveloperEvent}){
 if(access?.role==='admin'&&access.developer===true)return access;
 if(!await hasDeveloperSession())return access;
 await openDeveloperEvent(eventId);
 return {...access,role:'admin',developer:true};
}
