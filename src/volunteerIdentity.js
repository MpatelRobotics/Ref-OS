// Shared display names (especially Demo Ref) must never identify signed-in users.
export function volunteerMember(members, userId, name) {
  if (userId) return members.find(member => member.user_id === userId) || null;
  const matches = members.filter(member => String(member.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase());
  return matches.length === 1 ? matches[0] : null;
}
export function volunteerLocation(assignments, userId, name) {
  if (userId) return assignments[userId]?.location || '';
  const matches = Object.values(assignments).filter(row => String(row?.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase());
  return matches.length === 1 ? matches[0]?.location || '' : '';
}
