import {test,expect} from '@playwright/test';
test('division schedules, standings and alliance seeds stay isolated; Skills stays shared',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {createDivisionApi}=await import('/src/divisionApi.js');
  const rows=[],settings={};
  const client={from:()=>{
   let action='read',value,filters=[];
   const q={select:()=>q,order:()=>q,eq:(k,v)=>{filters.push(r=>r[k]===v);return q;},is:(k,v)=>{filters.push(r=>r[k]===v);return q;},contains:()=>q,containedBy:()=>q,
    upsert:v=>{action='upsert';value=v;return q;},insert:v=>{action='upsert';value=v;return q;},update:v=>{action='update';value=v;return q;},delete:()=>{action='delete';return q;},
    then:resolve=>{if(action==='upsert'){const old=rows.find(r=>r.division_id===value.division_id&&r.num===value.num&&r.phase===value.phase);if(old)Object.assign(old,value);else rows.push(value);}
     const found=rows.filter(r=>filters.every(f=>f(r)));if(action==='update')found.forEach(r=>Object.assign(r,value));if(action==='delete')found.forEach(r=>rows.splice(rows.indexOf(r),1));return Promise.resolve({data:found,error:null}).then(resolve);}};return q;}};
  const base={leagueSessionFor:()=>null,listTeams:async()=>[{number:'1A',name:'Team',rank:99}],listEventSettings:async()=>({...settings}),upsertEventSetting:async(e,k,value)=>settings[k]={key:k,value},deleteEventSetting:async(e,k)=>delete settings[k]};
  const a=createDivisionApi(base,'event',1,client),b=createDivisionApi(base,'event',2,client);
  await a.addMatch('event',{num:1,red:['1A'],blue:['2A']});await b.addMatch('event',{num:1,red:['3A'],blue:['4A']});
  await a.updateMatchScore('event','qual',1,10,3,'red');
  await a.bulkUpsertRankings('event',[{number:'1A',rank:1}]);await b.bulkUpsertRankings('event',[{number:'1A',rank:4}]);
  await a.upsertAlliance('event',1,['1A']);await b.upsertAlliance('event',1,['3A']);
  await a.upsertEventSetting('event','skills_rankings',{rows:[{number:'1A',total:40}]});
  const before={a:await a.listMatches(),b:await b.listMatches(),rankA:(await a.listTeams())[0].rank,rankB:(await b.listTeams())[0].rank,alliancesA:await a.listAlliances(),alliancesB:await b.listAlliances(),skills:(await b.listEventSettings()).skills_rankings.value};
  await a.clearMatches();return {...before,remainingB:(await b.listMatches()).length,legacy:createDivisionApi(base,'event',0,client)===base};
 });
 expect(result.a[0].redScore).toBe(10);expect(result.b[0].redScore).toBeUndefined();expect(result.rankA).toBe(1);expect(result.rankB).toBe(4);expect(result.alliancesA[0].teams).toEqual(['1A']);expect(result.alliancesB[0].teams).toEqual(['3A']);expect(result.skills.rows[0].total).toBe(40);expect(result.remainingB).toBe(1);expect(result.legacy).toBe(true);
});
