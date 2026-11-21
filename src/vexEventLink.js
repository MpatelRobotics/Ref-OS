import { eventCodeProgram } from '../supabase/functions/_shared/competitionProgram.js';

// Build only official event URLs from a complete, recognized event code.
export function vexEventLink(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^(RE|VE)-[A-Z0-9]{1,12}-\d{2}-\d{3,8}$/.test(code)) return '';
  const paths = { iq: 'vex-iq-competition', v5: 'vex-robotics-competition', vexu: 'college-competition' };
  const path = paths[eventCodeProgram(code)];
  return path ? `https://events.vex.com/robot-competitions/${path}/${code}.html` : '';
}
