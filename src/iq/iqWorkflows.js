// Level Up v2.0: SC1-SC5, T10-T14. TM remains the official standings authority.
export const IQ_LEVELS = [{key:'floor',label:'Floor Goal',points:1},{key:'l1',label:'L1 Goal',points:3},{key:'l2',label:'L2 Goal',points:6},{key:'l3',label:'L3 Goal',points:12},{key:'l4',label:'L4 Goal (yellow only)',points:16}];
export function iqScore(counts) {
  let total=0,bags=0;
  for(const level of IQ_LEVELS){const n=Number(counts[level.key]||0);if(!Number.isInteger(n)||n<0)throw new Error('Enter whole, non-negative bag counts.');if(level.key==='l4'&&n>6)throw new Error('L4 can contain at most the six yellow bags.');bags+=n;total+=n*level.points;}
  if(bags>38)throw new Error('The field has 38 bags. Count each bag only once.');
  return total;
}
export const iqTeams=m=>[...new Set([...(m.red||[]),...(m.blue||[])])];
export const iqMatchName=m=>`${m.phase==='qual'?'Q':m.phase==='practice'?'P':'F'}${m.num}`;
export function iqFinalPairs(teams,count) {
  const n=Number(count);if(!Number.isInteger(n)||n<1)throw new Error('Enter a positive whole number of finals matches.');
  const ranked=teams.filter(t=>Number(t.rank)>0).sort((a,b)=>Number(a.rank)-Number(b.rank));
  if(ranked.length<n*2)throw new Error('Import enough official ranked teams for the requested finals.');
  if(ranked.some((t,i)=>Number(t.rank)!==i+1))throw new Error('Official ranks must be unique and consecutive before forming finals.');
  // Lowest seed plays first. Each partnership plays once; no elimination bracket.
  return Array.from({length:n},(_,i)=>{const seed=n-i;return {phase:'final',num:i+1,red:[ranked[(seed-1)*2].number,ranked[(seed-1)*2+1].number],blue:[],label:`Finals seed ${seed}`};});
}
export function parseIQMatches(text, filename, parseCSV) {
  const trimmed=text.trim();let raw;
  if(/\.json$/i.test(filename)||/^[{[]/.test(trimmed)){const data=JSON.parse(trimmed);raw=Array.isArray(data)?data:data.matches||data.items;if(!Array.isArray(raw))throw new Error('Expected a matches array.');}
  else {const table=parseCSV(text);const headers=(table.shift()||[]).map(x=>String(x).toLowerCase().replace(/[^a-z0-9]/g,''));raw=table.filter(r=>r.some(x=>String(x).trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));}
  const keys=new Set();
  const rows=raw.map((entry,i)=>{
    const m=Object.fromEntries(Object.entries(entry).map(([k,v])=>[k.toLowerCase().replace(/[^a-z0-9]/g,''),v]));
    const match=String(m.matchnum??m.matchnumber??m.match??m.num??'').trim();
    const round=String(m.phase??m.round??m.type??match).toLowerCase();
    let phase;if(/practice|^p\d/.test(round)||round==='1')phase='practice';else if(/final|^f\d/.test(round)||round==='5')phase='final';else if(/qual|^q\d/.test(round)||round==='2')phase='qual';else throw new Error(`Row ${i+1}: use Qualification, Practice or Finals in Round.`);
    const num=Number(match.match(/\d+/)?.[0]);if(!Number.isInteger(num)||num<1)throw new Error(`Row ${i+1}: invalid match number.`);
    const teamSlots=Array.isArray(m.teams)?m.teams:Array.isArray(m.red)?[...m.red,...(m.blue||[])]:Object.entries(m).filter(([k])=>/^(?:team|red|blue)(?:team)?[12]$/.test(k)).map(([,v])=>v);
    const members=teamSlots.map(v=>String(v?.number??v??'').trim().toUpperCase()).filter(Boolean);
    if(!members.length||members.length>2||new Set(members).size!==members.length||members.some(t=>!/^\d{1,6}[A-Z]{1,3}$/.test(t)))throw new Error(`Row ${i+1}: IQ matches require one or two distinct team numbers, not opposing alliances.`);
    const key=phase+':'+num;if(keys.has(key))throw new Error(`Duplicate match ${key}. Give tiebreaker matches their own number.`);keys.add(key);
    const rawScore=m.score??m.teamworkscore??m.alliancescore??m.redscore;
    const state=String(m.scored??m.state??m.status??'').toLowerCase();
    const scored=rawScore!=null&&String(rawScore).trim()!==''&&!/^(false|0|unscored|scheduled|pending)$/.test(state);
    const score=scored?Number(rawScore):null;
    if(scored&&(!Number.isInteger(score)||score<0))throw new Error(`Row ${i+1}: invalid shared score.`);
    if(m.bluescore!=null&&String(m.bluescore).trim()!==''&&Number(m.bluescore)!==0)throw new Error(`Row ${i+1}: two opposing scores are not an IQ teamwork result.`);
    return {phase,num,red:members,blue:[],field:String(m.field??''),label:String(m.label??''),...(scored?{redScore:score,blueScore:null,winner:null}: {})};
  });
  if(!rows.length)throw new Error('No IQ matches found. Include Round, Match, Team1, Team2 and optional Score columns.');
  return rows;
}
