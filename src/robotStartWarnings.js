// Only the dedicated zip-tie photo slot triggers the starting-position reminder.
export function zipTiePhotoTeams(teams = []) {
 return Object.fromEntries(teams.filter(team =>
  (team.photoKeys || []).some(path => /\/ziptie-[^/]+\.(?:jpe?g|webp)$/i.test(String(path))) ||
  (team._pendingRobotPhotos || []).some(photo => photo.angle === 'ziptie')
 ).map(team => [team.number,true]));
}
