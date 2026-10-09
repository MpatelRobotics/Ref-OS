import {tmPairingNumber} from './tmMatchIdentity.js';
export const eliminationPairingKey = match => ['r16','qf','sf','final'].includes(match.phase)?`${match.phase}:${match.phase==='final'?1:tmPairingNumber(match.phase,match.num)}`:null;
export const eliminationPairingLabel = match => match.phase==='final'?'Final':`${{r16:'R16',qf:'QF',sf:'SF'}[match.phase]}${tmPairingNumber(match.phase,match.num)}`;
export const eliminationResultLabel = match => match.winner==='double_dq'?'Double DQ':match.redScore===0&&match.blueScore===0?'0–0 · Tie / DQ unconfirmed':match.winner==='tie'?'Tie':'';
