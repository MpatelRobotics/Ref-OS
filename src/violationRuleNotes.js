const actions=['Touch','Descore','Cover','Push'];
const positiveCount=value=>/^[1-9]\d*$/.test(String(value))&&Number.isSafeInteger(Number(value));
export function parseViolationRuleNotes(notes=''){
 const details={sg9Action:'',sg9Count:'',sg10Count:''};
 const remaining=String(notes).split('\n').filter(line=>{
  const sg9=line.match(/^\[SG9\] (Touch|Descore|Cover|Push)(?:; count: ([1-9]\d*))?$/);
  if(sg9){details.sg9Action=sg9[1];details.sg9Count=sg9[2]||'';return false;}
  const sg10=line.match(/^\[SG10\] Descored: ([1-9]\d*)$/);
  if(sg10){details.sg10Count=sg10[1];return false;}
  return true;
 });
 return {details,notes:remaining.join('\n')};
}
export function validViolationRuleDetails(codes,details){
 return (!codes.includes('SG9')||!details.sg9Action||(actions.includes(details.sg9Action)&&(!['Touch','Descore'].includes(details.sg9Action)||!details.sg9Count||positiveCount(details.sg9Count))))&&(!codes.includes('SG10')||!details.sg10Count||positiveCount(details.sg10Count));
}
export function formatViolationRuleNotes(notes,codes,details){
 const lines=[];
 if(codes.includes('SG9')&&details.sg9Action)lines.push(`[SG9] ${details.sg9Action}${['Touch','Descore'].includes(details.sg9Action)&&details.sg9Count?`; count: ${Number(details.sg9Count)}`:''}`);
 if(codes.includes('SG10')&&details.sg10Count)lines.push(`[SG10] Descored: ${Number(details.sg10Count)}`);
 return [notes,...lines].filter(Boolean).join('\n');
}
