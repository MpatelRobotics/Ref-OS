import {tmPairingNumber,tmGameNumber} from './tmMatchIdentity.js';
export const eliminationPairingKey = match => ['r16','qf','sf','final'].includes(match.phase)?`${match.phase}:${match.phase==='final'?1:tmPairingNumber(match.phase,match.num)}`:null;
export const eliminationPairingLabel = match => match.phase==='final'?'Final':`${{r16:'R16',qf:'QF',sf:'SF'}[match.phase]}-${tmPairingNumber(match.phase,match.num)}`;
export const eliminationResultLabel = match => match.winner==='double_dq'?'Double DQ':match.redScore===0&&match.blueScore===0?'0–0 · Tie / DQ unconfirmed':(match.winner==='tie'||match.redScore!=null&&match.blueScore!=null&&match.redScore===match.blueScore)?'Tie':'';

export function eliminationGameLabel(match, matches) {
 if(!['practice','qual','r16','qf','sf','final'].includes(match?.phase))return null;
 const pair=tmPairingNumber(match.phase,match.num),game=tmGameNumber(match.phase,match.num);
 const replay=game>1||Object.values(matches||{}).some(m=>m.phase===match.phase&&tmPairingNumber(m.phase,m.num)===pair&&tmGameNumber(m.phase,m.num)>1);
 if(!replay&&['practice','qual','final'].includes(match.phase))return null;
 return `${{practice:'P',qual:'Q',r16:'R16-',qf:'QF-',sf:'SF-',final:'F'}[match.phase]}${pair}${replay?'-'+game:''}`;
}
