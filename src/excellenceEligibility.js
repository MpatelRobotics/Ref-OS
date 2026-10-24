export const EXCELLENCE_CHECKS=[
 ['interview','High-quality Team Interview'],
 ['notebook','Notebook at or near the top; strong Design Award candidate'],
 ['inquiry','Interview and notebook demonstrate independent inquiry throughout the design process'],
 ['otherAwards','Nominated or ranked for multiple other Judged Awards'],
 ['conduct','Positive, student-centered conduct, sportsmanship, and professionalism'],
];
export const excellenceSnapshot=(teams,skills)=>JSON.stringify({teams:teams.map(t=>[t.number,t.rank??null]).sort(),skills:skills.map(s=>[s.number,s.total??0,s.programming??0]).sort()});
export function excellenceEligibility(teams,skills,review={}){
 const unique=[...new Map(teams.map(t=>[t.number,t])).values()];
 const scores=new Map(skills.map(s=>[s.number,s]));
 const allAssigned=!review.splitLevels||unique.every(t=>['elementary','middle','high'].includes(review.levels?.[t.number]));
 const currentFinal=review.final===true&&review.snapshot===excellenceSnapshot(teams,skills);
 const groups=review.splitLevels?['elementary','middle','high']:['all'];
 const results=[];
 for(const group of groups){
  const roster=unique.filter(t=>!review.splitLevels||review.levels?.[t.number]===group);
  const cutoff=Math.max(1,Math.round(roster.length*0.4));
  const rankBy=(value)=>new Map(roster.map(t=>[t.number,value(t)]).filter(([,v])=>v!=null).map(([n,v],_,all)=>[n,1+all.filter(([,other])=>other>v).length]));
  const auto=rankBy(t=>Number(scores.get(t.number)?.programming)||0);
  const total=rankBy(t=>Number(scores.get(t.number)?.total)||0);
  const quals=rankBy(t=>Number(t.rank)>0?-Number(t.rank):null);
  for(const team of roster){
   const r={qualification:quals.get(team.number),skills:total.get(team.number),autonomous:auto.get(team.number)};
   const hasQualifications=roster.every(t=>Number(t.rank)>0);
   const hasSkills=skills.length>0;
   const performance=allAssigned&&hasQualifications&&hasSkills&&r.qualification<=cutoff&&r.skills<=cutoff&&r.autonomous<=cutoff&&Number(scores.get(team.number)?.programming)>0;
   const checks=review.teams?.[team.number]||{};
   results.push({team,group,cutoff,ranks:r,performance,eligible:performance&&currentFinal&&EXCELLENCE_CHECKS.every(([key])=>checks[key]===true),checks,pending:!allAssigned||!hasQualifications||!hasSkills});
  }
 }
 for(const team of unique.filter(t=>review.splitLevels&&!review.levels?.[t.number]))results.push({team,group:'unassigned',pending:true,performance:false,eligible:false,checks:review.teams?.[team.number]||{},ranks:{}});
 return results.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||Number(b.performance)-Number(a.performance)||a.team.number.localeCompare(b.team.number,undefined,{numeric:true}));
}
