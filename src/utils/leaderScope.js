import { MaintenanceTeam } from '../models/index.js';
import { ROLES } from '../constants/roles.js';
import { AuthorizationError } from '../utils/AppError.js';

export function isTeamLeaderOnly(user) {
  if (!user?.roles?.includes(ROLES.TEAM_LEADER)) return false;
  return !user.roles.some((r) =>
    [ROLES.SUPER_ADMIN, ROLES.MAINTENANCE_MANAGER].includes(r)
  );
}

export async function getLeaderTeamIds(user) {
  if (!user?.roles?.includes(ROLES.TEAM_LEADER)) return [];
  const teams = await MaintenanceTeam.find({
    leader: user._id,
    isDeleted: { $ne: true },
  }).select('_id');
  return teams.map((t) => t._id);
}

export async function assertLeaderTeamAccess(user, teamId) {
  if (!isTeamLeaderOnly(user) || !teamId) return;
  const teamIds = await getLeaderTeamIds(user);
  const allowed = teamIds.some((id) => id.toString() === teamId.toString());
  if (!allowed) throw new AuthorizationError('Access denied to this team');
}
