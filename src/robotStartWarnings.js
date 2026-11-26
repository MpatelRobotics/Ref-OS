// Either the saved starting-position toggle or its reference picture triggers a reminder.
export function zipTiePhotoTeams(teams = [], references = [], sessionId = null) {
 const warnings = Object.fromEntries(teams.filter(team =>
  (team.photoKeys || []).some(path => /\/ziptie-[^/]+\.(?:jpe?g|webp)$/i.test(String(path))) ||
  (team._pendingRobotPhotos || []).some(photo => photo.angle === 'ziptie')
 ).map(team => [team.number,true]));
 for (const row of references) {
  if ((row.session_id || null)===(sessionId || null) && row.payload?.recordType==='robot-reference' && row.payload.zipTieWall===true && row.payload.team) warnings[row.payload.team]=true;
 }
 return warnings;
}

export function multiConfigurationTeams(teams = [], references = [], sessionId = null) {
 const warnings = Object.fromEntries(teams.filter(team =>
  (team.photoKeys || []).some(path => /\/configuration-[^/]+\.(?:jpe?g|webp)$/i.test(String(path))) ||
  (team._pendingRobotPhotos || []).some(photo => photo.angle === 'configuration')
 ).map(team => [team.number,true]));
 for (const row of references) {
  if ((row.session_id || null)===(sessionId || null) && row.payload?.recordType==='robot-reference' && row.payload.multiConfiguration===true && row.payload.team) warnings[row.payload.team]=true;
 }
 return warnings;
}
