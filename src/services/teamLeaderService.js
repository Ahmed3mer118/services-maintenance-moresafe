import { User, MaintenanceTeam } from '../models/index.js';
import { userRepository } from '../repositories/index.js';
import { ROLES } from '../constants/roles.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/AppError.js';
import auditService from './auditService.js';

class TeamLeaderService {
  async list(query = {}) {
    const filter = { roles: ROLES.TEAM_LEADER };
    if (query.region) filter.region = query.region;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.search) {
      const re = new RegExp(query.search, 'i');
      filter.$or = [{ firstName: re }, { lastName: re }, { email: re }];
    }

    const leaders = await User.find(filter)
      .select('firstName lastName email phone region isActive createdAt')
      .populate('region', 'name code')
      .sort('firstName lastName')
      .lean();

    if (!leaders.length) return [];

    const leaderIds = leaders.map((l) => l._id);
    const teams = await MaintenanceTeam.find({
      leader: { $in: leaderIds },
      isDeleted: { $ne: true },
    })
      .select('name code region leader isActive')
      .populate('region', 'name code')
      .lean();

    const teamsByLeader = {};
    for (const team of teams) {
      const lid = team.leader.toString();
      if (!teamsByLeader[lid]) teamsByLeader[lid] = [];
      teamsByLeader[lid].push(team);
    }

    return leaders.map((leader) => ({
      ...leader,
      teams: teamsByLeader[leader._id.toString()] || [],
    }));
  }

  async getById(id) {
    const leader = await User.findOne({ _id: id, roles: ROLES.TEAM_LEADER })
      .select('firstName lastName email phone region isActive createdAt')
      .populate('region', 'name code');
    if (!leader) throw new NotFoundError('Team leader');

    const teams = await MaintenanceTeam.find({ leader: id, isDeleted: { $ne: true } })
      .select('name code region isActive')
      .populate('region', 'name code')
      .lean();

    return { ...leader.toObject(), teams };
  }

  async create(data, actor, req) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new ConflictError('Email already in use');

    const leader = await userRepository.create({
      email: data.email.toLowerCase(),
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || '',
      roles: [ROLES.TEAM_LEADER],
      region: data.region,
      isActive: data.isActive !== false,
    });

    if (data.teamIds?.length) {
      await this.assignTeams(leader._id, data.teamIds, { skipAudit: true });
    }

    await auditService.log({
      user: actor._id,
      action: 'CREATE',
      entityType: 'TeamLeader',
      entityId: leader._id,
      changes: { email: data.email, teamIds: data.teamIds },
      req,
    });

    return this.getById(leader._id);
  }

  async update(id, data, actor, req) {
    const leader = await User.findOne({ _id: id, roles: ROLES.TEAM_LEADER });
    if (!leader) throw new NotFoundError('Team leader');

    if (data.email && data.email.toLowerCase() !== leader.email) {
      const dup = await userRepository.findByEmail(data.email);
      if (dup && dup._id.toString() !== leader._id.toString()) {
        throw new ConflictError('Email already in use');
      }
      leader.email = data.email.toLowerCase();
    }
    if (data.password) leader.password = data.password;
    if (data.firstName) leader.firstName = data.firstName;
    if (data.lastName) leader.lastName = data.lastName;
    if (data.phone !== undefined) leader.phone = data.phone;
    if (data.region) leader.region = data.region;
    if (data.isActive !== undefined) leader.isActive = data.isActive;
    await leader.save();

    if (data.teamIds !== undefined) {
      await this.assignTeams(id, data.teamIds, { skipAudit: true });
    }

    await auditService.log({
      user: actor._id,
      action: 'UPDATE',
      entityType: 'TeamLeader',
      entityId: id,
      changes: data,
      req,
    });

    return this.getById(id);
  }

  async assignTeams(leaderId, teamIds = [], options = {}) {
    const leader = await User.findOne({ _id: leaderId, roles: ROLES.TEAM_LEADER });
    if (!leader) throw new NotFoundError('Team leader');

    const uniqueTeamIds = [...new Set((teamIds || []).map(String))].filter(Boolean);

    if (uniqueTeamIds.length) {
      const teams = await MaintenanceTeam.find({
        _id: { $in: uniqueTeamIds },
        isDeleted: { $ne: true },
      });
      if (teams.length !== uniqueTeamIds.length) {
        throw new NotFoundError('One or more teams not found');
      }

      await MaintenanceTeam.updateMany(
        { _id: { $in: uniqueTeamIds } },
        { $set: { leader: leaderId } }
      );
    }

    await MaintenanceTeam.updateMany(
      { leader: leaderId, ...(uniqueTeamIds.length ? { _id: { $nin: uniqueTeamIds } } : {}) },
      { $unset: { leader: 1 } }
    );

    if (!options.skipAudit) {
      await auditService.log({
        user: options.actor?._id,
        action: 'UPDATE',
        entityType: 'TeamLeader',
        entityId: leaderId,
        changes: { teamIds: uniqueTeamIds },
        req: options.req,
      });
    }

    return this.getById(leaderId);
  }
}

export default new TeamLeaderService();
