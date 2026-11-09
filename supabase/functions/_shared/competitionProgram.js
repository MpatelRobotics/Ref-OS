export function eventCodeProgram(value) {
 const program=String(value||'').trim().toUpperCase().match(/^(?:RE|VE)-([A-Z0-9]+)-/)?.[1];
 if(['U','VURC','VEXU'].includes(program))return 'vexu';
 if(['IQ','VIQRC','VIQC','IQRC'].includes(program))return 'iq';
 if(['V5','V5RC','VRC'].includes(program))return 'v5';
 return '';
}
export function detectCompetitionProgram(details) {
 const code=eventCodeProgram(details?.code||details?.sku);if(code)return code;
 const text=typeof details?.program==='string'?details.program:details?.program?.name||'';
 if(/VEX\s*U|VURC|VEXU/i.test(text))return 'vexu';
 if(/\bIQ\b|VIQRC|VIQC/i.test(text))return 'iq';
 if(/V5|VRC/i.test(text))return 'v5';
 return '';
}
export function assertEventCodeProgram(code,expected) {
 if(!expected)return;
 if(!['iq','v5','vexu'].includes(expected))throw Error('Choose VEX IQ, V5RC or VEX U.');
 if(eventCodeProgram(code)!==expected)throw Error(expected==='vexu'?'VEX U events require a VEX U code, such as VE-U-26-66279 or RE-VURC-26-1234. V5 and IQ codes are not accepted.':`Use a ${expected==='iq'?'VEX IQ':'V5RC'} event code for this category.`);
}
