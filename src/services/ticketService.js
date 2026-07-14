import {
  ticketRepository,
  ticketTaskRepository,
  schoolRepository,
  slaRepository,
  workerRepository,
} from '../repositories/index.js';
import { Ticket, TicketTask, MaintenanceCategory, generateTicketNumber } from '../models/index.js';
import { TICKET_STATUS, TASK_STATUS } from '../constants/statuses.js';
import {
  validateTicketTransition,
  validateTaskTransition,
  computeTicketStatusFromTasks,
  createStatusHistoryEntry,
} from './workflow/stateMachine.js';
import { NotFoundError, AuthorizationError, AppError } from '../utils/AppError.js';
import auditService from './auditService.js';
import notificationService from './notificationService.js';
import { ROLES } from '../constants/roles.js';
import { buildPagination, buildSort, buildSearchFilter, pickQueryFilters } from '../utils/pagination.js';
import { toObjectId } from '../utils/idHelper.js';
import { getLeaderTeamIds, isTeamLeaderOnly, assertLeaderTeamAccess } from '../utils/leaderScope.js';

class TicketService {
  async create(data, user, req) {
    if (user.roles.includes(ROLES.SCHOOL_ADMIN)) {
      const schoolId = toObjectId(user.school);
      if (!schoolId) throw new AuthorizationError('School not linked to user');
      data.school = schoolId;
    }

    const school = await schoolRepository.findById(data.school, ['region', 'maintenanceTeam']);
    if (!school) throw new NotFoundError('School');

    const category = await MaintenanceCategory.findById(data.category);
    if (!category) throw new NotFoundError('Category');

    const sub = category.subcategories.id(data.subcategoryId);
    if (!sub) throw new AppError('Invalid subcategory', 400);

    const sla = await slaRepository.findOne({
      region: school.region._id || school.region,
      priority: data.priority,
      isActive: true,
    });

    const slaDeadline = sla
      ? new Date(Date.now() + sla.resolutionTimeHours * 60 * 60 * 1000)
      : null;

    const ticketNumber = await generateTicketNumber();

    const ticket = await ticketRepository.create({
      ticketNumber,
      school: school._id,
      region: school.region._id || school.region,
      team: school.maintenanceTeam,
      category: category._id,
      subcategory: { id: sub._id, name: sub.name, key: sub.key },
      priority: data.priority,
      title: data.title,
      description: data.description,
      status: school.maintenanceTeam ? TICKET_STATUS.ASSIGNED : TICKET_STATUS.NEW,
      sla: sla?._id,
      slaDeadline,
      createdBy: user._id,
      attachments: data.attachments || { before: [], during: [], after: [] },
      statusHistory: [
        createStatusHistoryEntry(
          school.maintenanceTeam ? TICKET_STATUS.ASSIGNED : TICKET_STATUS.NEW,
          user._id,
          'Ticket created'
        ),
      ],
    });

    const populated = await ticketRepository.findById(ticket._id, ticketRepository.defaultPopulate);

    const regionId = school.region._id || school.region;
    await notificationService.notifyUsersByRoles(
      [ROLES.MAINTENANCE_MANAGER],
      {
        type: 'new_ticket',
        title: 'New Maintenance Ticket / بلاغ جديد',
        message: `${ticketNumber}: ${data.title} — ${school.name}`,
        entityType: 'Ticket',
        entityId: ticket._id,
      },
      { region: regionId }
    );

    if (school.maintenanceTeam) {
      await this._notifyTeamLeader(school.maintenanceTeam, populated);
    }

    await auditService.log({
      user: user._id,
      action: 'CREATE',
      entityType: 'Ticket',
      entityId: ticket._id,
      changes: { ticketNumber },
      req,
    });

    return populated;
  }

  async assignWorkers(ticketId, workerIds, user, req, options = {}) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');

    const workers = await workerRepository.findAll({ _id: { $in: workerIds }, isActive: true });
    if (workers.length !== workerIds.length) throw new AppError('One or more workers not found', 400);

    const assignableStatuses = [
      TICKET_STATUS.NEW,
      TICKET_STATUS.ASSIGNED,
      TICKET_STATUS.ACCEPTED,
      TICKET_STATUS.IN_PROGRESS,
    ];
    if (!assignableStatuses.includes(ticket.status)) {
      throw new AppError('Cannot assign workers in current ticket status', 400);
    }

    const category = await MaintenanceCategory.findById(ticket.category).populate('requiredSpecialties');

    for (const worker of workers) {
      const existing = await TicketTask.findOne({ ticket: ticketId, worker: worker._id });
      if (existing) continue;

      await ticketTaskRepository.create({
        ticket: ticketId,
        worker: worker._id,
        specialty: worker.specialty,
        status: TASK_STATUS.ACCEPTED,
        acceptedAt: new Date(),
        statusHistory: [createStatusHistoryEntry(TASK_STATUS.ACCEPTED, user._id, 'Assigned to worker')],
      });

      const workerDoc = await workerRepository.findById(worker._id, [{ path: 'user', select: 'firstName lastName' }]);
      if (workerDoc?.user) {
        await notificationService.create({
          userId: workerDoc.user._id || workerDoc.user,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `You have been assigned to ticket ${ticket.ticketNumber}`,
          entityType: 'Ticket',
          entityId: ticketId,
        });
      }
    }

    ticket.assignedWorkers = [...new Set([...ticket.assignedWorkers.map(String), ...workerIds.map(String)])];
    if (ticket.status === TICKET_STATUS.NEW) {
      validateTicketTransition(ticket.status, TICKET_STATUS.ASSIGNED);
      ticket.status = TICKET_STATUS.ASSIGNED;
      ticket.statusHistory.push(createStatusHistoryEntry(TICKET_STATUS.ASSIGNED, user._id, 'Workers assigned'));
    }
    if (options.scheduledVisit) ticket.scheduledVisit = options.scheduledVisit;
    if (options.priority) ticket.priority = options.priority;
    if (options.leaderNotes) ticket.leaderNotes = options.leaderNotes;
    await ticket.save();

    await this.syncTicketStatusFromTasks(ticketId, user._id);

    await auditService.log({
      user: user._id,
      action: 'ASSIGN',
      entityType: 'Ticket',
      entityId: ticketId,
      changes: { workerIds },
      req,
    });

    return ticketRepository.findById(ticketId, ticketRepository.defaultPopulate);
  }

  async updateStatus(ticketId, newStatus, user, note, req) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');

    validateTicketTransition(ticket.status, newStatus);

    ticket.status = newStatus;
    ticket.statusHistory.push(createStatusHistoryEntry(newStatus, user._id, note));
    if (newStatus === TICKET_STATUS.CLOSED) {
      ticket.closedAt = new Date();
      ticket.closedBy = user._id;
    }
    await ticket.save();

    await auditService.log({
      user: user._id,
      action: 'STATUS_CHANGE',
      entityType: 'Ticket',
      entityId: ticketId,
      changes: { status: newStatus, note },
      req,
    });

    return ticketRepository.findById(ticketId, ticketRepository.defaultPopulate);
  }

  async schoolConfirm(ticketId, confirmed, user, req) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');
    if (ticket.status !== TICKET_STATUS.APPROVED) {
      throw new AppError('Ticket must be approved before school confirmation', 400);
    }

    ticket.schoolConfirmed = confirmed;
    if (confirmed) {
      return this.updateStatus(ticketId, TICKET_STATUS.CLOSED, user, 'School confirmed resolution', req);
    }
    return this.updateStatus(ticketId, TICKET_STATUS.NEEDS_REWORK, user, 'School rejected resolution', req);
  }

  async rate(ticketId, score, comment, user, req) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');
    ticket.rating = { score, comment, ratedAt: new Date() };
    await ticket.save();
    await auditService.log({
      user: user._id,
      action: 'RATE',
      entityType: 'Ticket',
      entityId: ticketId,
      changes: { score },
      req,
    });
    return ticket;
  }

  async list(query, user) {
    const { page, limit, sort, search, ...rest } = query;
    const pagination = buildPagination(page, limit);
    const filter = {
      isDeleted: false,
      ...pickQueryFilters(rest, ['status', 'priority', 'region', 'team', 'school']),
      ...buildSearchFilter(search, ['title', 'ticketNumber', 'description']),
    };

    if (user.roles.includes(ROLES.SCHOOL_ADMIN) && user.school) {
      filter.school = toObjectId(user.school);
    } else if (user.roles.includes(ROLES.TEAM_LEADER)) {
      const teamIds = await getLeaderTeamIds(user);
      if (teamIds.length) {
        filter.team = { $in: teamIds };
      } else {
        filter.team = { $in: [] };
      }
    } else if (user.roles.includes(ROLES.WORKER) && user.workerProfile) {
      const workerId = toObjectId(user.workerProfile);
      const taskTicketIds = await TicketTask.find({ worker: workerId }).distinct('ticket');
      filter._id = { $in: taskTicketIds };
    }

    const [data, total] = await Promise.all([
      ticketRepository.findWithFilters(filter, {
        skip: pagination.skip,
        limit: pagination.limit,
        sort: buildSort(sort),
      }),
      ticketRepository.count(filter),
    ]);

    return { data, pagination: { ...pagination, total } };
  }

  async getById(id, user = null) {
    const ticket = await ticketRepository.findById(id, ticketRepository.defaultPopulate);
    if (!ticket) throw new NotFoundError('Ticket');
    if (user?.roles?.includes(ROLES.TEAM_LEADER) && isTeamLeaderOnly(user)) {
      await assertLeaderTeamAccess(user, ticket.team?._id || ticket.team);
    }
    let tasks = await ticketTaskRepository.findByTicket(id);

    if (user?.roles?.includes(ROLES.WORKER) && user.workerProfile) {
      const workerId = toObjectId(user.workerProfile);
      tasks = tasks.filter((t) => t.worker?._id?.toString() === workerId || t.worker?.toString() === workerId);
    }

    return { ticket, tasks };
  }

  async update(ticketId, data, user, req) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');

    const allowed = ['title', 'description', 'priority', 'leaderNotes', 'scheduledVisit'];
    for (const key of allowed) {
      if (data[key] !== undefined) ticket[key] = data[key];
    }

    if (data.status && data.status !== ticket.status) {
      validateTicketTransition(ticket.status, data.status);
      ticket.status = data.status;
      ticket.statusHistory.push(createStatusHistoryEntry(data.status, user._id, 'Ticket updated'));
    }

    await ticket.save();
    await auditService.log({
      user: user._id,
      action: 'UPDATE',
      entityType: 'Ticket',
      entityId: ticketId,
      changes: data,
      req,
    });
    return this.getById(ticketId);
  }

  async addComment(ticketId, text, user, req) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');
    ticket.comments.push({ user: user._id, text });
    await ticket.save();
    await auditService.log({
      user: user._id,
      action: 'COMMENT',
      entityType: 'Ticket',
      entityId: ticketId,
      req,
    });
    return ticketRepository.findById(ticketId, ticketRepository.defaultPopulate);
  }

  async _notifyTeamLeader(teamId, ticket) {
    const { MaintenanceTeam } = await import('../models/index.js');
    const team = await MaintenanceTeam.findById(teamId).populate('leader');
    if (team?.leader) {
      await notificationService.create({
        userId: team.leader._id,
        type: 'ticket_assigned',
        title: 'New Ticket Assigned',
        message: `Ticket ${ticket.ticketNumber}: ${ticket.title}`,
        entityType: 'Ticket',
        entityId: ticket._id,
      });
    }
  }

  async syncTicketStatusFromTasks(ticketId, userId) {
    const ticket = await ticketRepository.findById(ticketId);
    const tasks = await ticketTaskRepository.findByTicket(ticketId);
    const newStatus = computeTicketStatusFromTasks(tasks, ticket.status);
    if (newStatus !== ticket.status) {
      ticket.status = newStatus;
      const note =
        newStatus === TICKET_STATUS.APPROVED
          ? 'All tasks approved — work completed'
          : newStatus === TICKET_STATUS.UNDER_REVIEW
            ? 'All tasks submitted — awaiting leader review'
            : 'Auto-sync from tasks';
      ticket.statusHistory.push(createStatusHistoryEntry(newStatus, userId, note));
      if (newStatus === TICKET_STATUS.APPROVED && !ticket.approvedAt) {
        ticket.approvedAt = new Date();
      }
      await ticket.save();

      if (newStatus === TICKET_STATUS.APPROVED) {
        const schoolAdmins = await import('../models/index.js').then((m) =>
          m.User.find({ school: ticket.school, roles: ROLES.SCHOOL_ADMIN, isActive: true })
        );
        if (schoolAdmins.length) {
          await notificationService.notifyMany(
            schoolAdmins.map((u) => u._id),
            {
              type: 'ticket_approved',
              title: 'Maintenance Work Approved',
              message: `Ticket ${ticket.ticketNumber} — all work approved, please confirm closure`,
              entityType: 'Ticket',
              entityId: ticketId,
            }
          );
        }

        await notificationService.notifyUsersByRoles(
          [ROLES.MAINTENANCE_MANAGER],
          {
            type: 'ticket_approved',
            title: 'Ticket Fully Approved',
            message: `All work approved on ${ticket.ticketNumber} — report can be generated`,
            entityType: 'Ticket',
            entityId: ticketId,
          },
          { region: ticket.region }
        );

        try {
          const reportService = (await import('./reportService.js')).default;
          await reportService.generateTicketReport(ticketId);
        } catch (err) {
          // non-blocking — report can be generated manually
        }
      }
    }
    return newStatus;
  }
}

export default new TicketService();
