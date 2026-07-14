import { Ticket, TicketTask, MaterialRequest, MaintenanceTeam, Worker, InventoryItem, Notification } from '../models/index.js';
import { TICKET_STATUS, TASK_STATUS } from '../constants/statuses.js';
import { ROLES } from '../constants/roles.js';
import { toObjectId } from '../utils/idHelper.js';
import teamLeaderService from './teamLeaderService.js';

class DashboardService {
  async getAdminDashboard(regionFilter) {
    const match = regionFilter ? { region: regionFilter } : {};

    const [
      statusCounts,
      avgResolution,
      slaCompliance,
      topProblems,
      inventoryCost,
      workerProductivity,
    ] = await Promise.all([
      Ticket.aggregate([
        { $match: { isDeleted: false, ...match } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Ticket.aggregate([
        {
          $match: {
            status: TICKET_STATUS.CLOSED,
            closedAt: { $exists: true },
            ...match,
          },
        },
        {
          $project: {
            resolutionHours: {
              $divide: [{ $subtract: ['$closedAt', '$createdAt'] }, 3600000],
            },
          },
        },
        { $group: { _id: null, avg: { $avg: '$resolutionHours' } } },
      ]),
      Ticket.aggregate([
        { $match: { status: TICKET_STATUS.CLOSED, ...match } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            breached: { $sum: { $cond: ['$slaBreached', 1, 0] } },
          },
        },
      ]),
      Ticket.aggregate([
        { $match: { isDeleted: false, ...match } },
        { $group: { _id: '$subcategory.key', name: { $first: '$subcategory.name' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      import('../models/index.js').then((m) =>
        m.InventoryTransaction.aggregate([
          { $match: { type: 'issue' } },
          { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', '$unitCost'] } } } },
        ])
      ),
      TicketTask.aggregate([
        { $match: { status: TASK_STATUS.APPROVED } },
        {
          $group: {
            _id: '$worker',
            tasksCompleted: { $sum: 1 },
            totalHours: { $sum: '$workingHours' },
          },
        },
        { $sort: { tasksCompleted: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const openTickets = statusCounts
      .filter((s) => ![TICKET_STATUS.CLOSED, TICKET_STATUS.CANCELLED].includes(s._id))
      .reduce((sum, s) => sum + s.count, 0);
    const closedTickets = statusCounts.find((s) => s._id === TICKET_STATUS.CLOSED)?.count || 0;

    const sla = slaCompliance[0];
    const slaRate = sla?.total ? ((sla.total - sla.breached) / sla.total) * 100 : 100;

    const teamLeaders = await teamLeaderService.list();

    return {
      kpis: {
        openTickets,
        closedTickets,
        averageResolutionHours: Math.round(avgResolution[0]?.avg || 0),
        slaComplianceRate: Math.round(slaRate),
        inventoryCost: inventoryCost[0]?.total || 0,
      },
      statusBreakdown: statusCounts,
      topProblems,
      workerProductivity,
      teamLeaders,
    };
  }

  async getLeaderDashboard(teamIds = [], teamsMeta = []) {
    if (!teamIds.length) {
      return {
        kpis: { assignedTickets: 0, pendingReviews: 0, waitingMaterials: 0, slaAlerts: 0 },
        teams: [],
        team: null,
        activeTickets: [],
        pendingReviewTasks: [],
        teamWorkers: [],
        slaAlertTickets: [],
      };
    }

    const teams =
      teamsMeta.length > 0
        ? teamsMeta
        : await MaintenanceTeam.find({ _id: { $in: teamIds } })
            .populate('leader', 'firstName lastName email phone')
            .populate({
              path: 'members',
              populate: [{ path: 'user', select: 'firstName lastName phone' }, 'specialty'],
            });

    const filter = { team: { $in: teamIds }, isDeleted: false };
    const teamTicketIds = await Ticket.find(filter).distinct('_id');

    const [
      assignedTickets,
      pendingReviews,
      waitingMaterials,
      slaAlerts,
      activeTickets,
      pendingReviewTasks,
      slaAlertTickets,
    ] = await Promise.all([
      Ticket.countDocuments({ ...filter, status: { $nin: [TICKET_STATUS.CLOSED, TICKET_STATUS.CANCELLED] } }),
      TicketTask.countDocuments({
        ticket: { $in: teamTicketIds },
        status: { $in: [TASK_STATUS.UNDER_REVIEW, TASK_STATUS.COMPLETED] },
      }),
      Ticket.countDocuments({ ...filter, status: TICKET_STATUS.WAITING_MATERIALS }),
      Ticket.countDocuments({
        ...filter,
        slaDeadline: { $lt: new Date() },
        status: { $nin: [TICKET_STATUS.CLOSED, TICKET_STATUS.CANCELLED] },
      }),
      Ticket.find({ ...filter, status: { $nin: [TICKET_STATUS.CLOSED, TICKET_STATUS.CANCELLED] } })
        .sort('-priority -createdAt')
        .limit(15)
        .populate('school', 'name code')
        .populate('category', 'name key icon')
        .populate('assignedWorkers', 'employeeId'),
      TicketTask.find({
        ticket: { $in: teamTicketIds },
        status: { $in: [TASK_STATUS.UNDER_REVIEW, TASK_STATUS.COMPLETED] },
      })
        .sort('-updatedAt')
        .limit(10)
        .populate({ path: 'worker', populate: { path: 'user', select: 'firstName lastName employeeId' } })
        .populate('specialty', 'name key icon color')
        .populate({ path: 'ticket', select: 'ticketNumber title school priority', populate: { path: 'school', select: 'name' } })
        .select('ticket worker specialty status notes workingHours beforeImages duringImages afterImages acceptedAt startedAt completedAt createdAt updatedAt'),
      Ticket.find({
        ...filter,
        slaDeadline: { $lt: new Date() },
        status: { $nin: [TICKET_STATUS.CLOSED, TICKET_STATUS.CANCELLED] },
      })
        .sort('slaDeadline')
        .limit(8)
        .populate('school', 'name')
        .select('ticketNumber title priority status slaDeadline school'),
    ]);

    const memberMap = new Map();
    for (const team of teams) {
      for (const member of team.members || []) {
        memberMap.set(member._id.toString(), member);
      }
    }

    const primaryTeam = teams[0];

    return {
      kpis: { assignedTickets, pendingReviews, waitingMaterials, slaAlerts },
      teams: teams.map((t) => ({ _id: t._id, name: t.name, code: t.code, region: t.region })),
      team: primaryTeam
        ? { _id: primaryTeam._id, name: primaryTeam.name, code: primaryTeam.code, leader: primaryTeam.leader }
        : null,
      activeTickets,
      pendingReviewTasks,
      teamWorkers: [...memberMap.values()],
      slaAlertTickets,
    };
  }

  async getWorkerDashboard(workerId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeStatuses = [
      TASK_STATUS.ASSIGNED,
      TASK_STATUS.ACCEPTED,
      TASK_STATUS.IN_PROGRESS,
      TASK_STATUS.WAITING_MATERIALS,
      TASK_STATUS.NEEDS_REWORK,
      TASK_STATUS.REJECTED,
    ];

    const [
      todayTasks,
      pendingTasks,
      completedTasks,
      materialRequestsCount,
      tasks,
      materialRequests,
    ] = await Promise.all([
      TicketTask.countDocuments({
        worker: workerId,
        status: { $in: [TASK_STATUS.ACCEPTED, TASK_STATUS.IN_PROGRESS, TASK_STATUS.NEEDS_REWORK] },
        updatedAt: { $gte: today },
      }),
      TicketTask.countDocuments({ worker: workerId, status: { $in: activeStatuses } }),
      TicketTask.countDocuments({ worker: workerId, status: TASK_STATUS.APPROVED }),
      MaterialRequest.countDocuments({ worker: workerId, status: 'pending' }),
      TicketTask.find({
        worker: workerId,
        status: {
          $in: [
            ...activeStatuses,
            TASK_STATUS.UNDER_REVIEW,
            TASK_STATUS.COMPLETED,
            TASK_STATUS.APPROVED,
          ],
        },
      })
        .sort('-updatedAt')
        .limit(20)
        .populate('specialty', 'name key icon color')
        .populate({
          path: 'ticket',
          select: 'ticketNumber title status priority school scheduledVisit',
          populate: { path: 'school', select: 'name address phone' },
        }),
      MaterialRequest.find({ worker: workerId })
        .sort('-createdAt')
        .limit(5)
        .populate('ticket', 'ticketNumber title')
        .populate('items.item', 'name sku unit'),
    ]);

    const grouped = {
      assigned: tasks.filter((t) => t.status === TASK_STATUS.ASSIGNED),
      accepted: tasks.filter((t) => t.status === TASK_STATUS.ACCEPTED),
      inProgress: tasks.filter((t) =>
        [TASK_STATUS.IN_PROGRESS, TASK_STATUS.NEEDS_REWORK].includes(t.status)
      ),
      waitingMaterials: tasks.filter((t) => t.status === TASK_STATUS.WAITING_MATERIALS),
      underReview: tasks.filter((t) => t.status === TASK_STATUS.UNDER_REVIEW),
      completed: tasks.filter((t) => t.status === TASK_STATUS.COMPLETED),
      approved: tasks.filter((t) => t.status === TASK_STATUS.APPROVED),
    };

    return {
      kpis: { todayTasks, pendingTasks, completedTasks, materialRequests: materialRequestsCount },
      tasks: grouped,
      allTasks: tasks,
      materialRequests,
    };
  }

  async getSchoolDashboard(schoolId) {
    const [openTickets, closedTickets, avgRating, recentTickets, pendingConfirmation] = await Promise.all([
      Ticket.countDocuments({ school: schoolId, status: { $ne: TICKET_STATUS.CLOSED }, isDeleted: false }),
      Ticket.countDocuments({ school: schoolId, status: TICKET_STATUS.CLOSED }),
      Ticket.aggregate([
        { $match: { school: schoolId, 'rating.score': { $exists: true } } },
        { $group: { _id: null, avg: { $avg: '$rating.score' } } },
      ]),
      Ticket.find({ school: schoolId, isDeleted: false })
        .sort('-createdAt')
        .limit(10)
        .populate('category', 'name')
        .select('ticketNumber title status priority createdAt category'),
      Ticket.find({
        school: schoolId,
        status: TICKET_STATUS.APPROVED,
        schoolConfirmed: false,
        isDeleted: false,
      })
        .sort('-updatedAt')
        .limit(5)
        .select('ticketNumber title status'),
    ]);

    return {
      openTickets,
      closedTickets,
      averageRating: avgRating[0]?.avg || 0,
      recentTickets,
      pendingConfirmation,
    };
  }

  async getWarehouseDashboard(regionId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const regionFilter = regionId ? { region: regionId } : {};

    const [pendingRequests, approvedToday, lowStockItems, totalItems, pendingList] = await Promise.all([
      MaterialRequest.countDocuments({ status: 'pending' }),
      MaterialRequest.countDocuments({ status: 'approved', approvedAt: { $gte: today } }),
      InventoryItem.find({
        ...regionFilter,
        isActive: true,
        $expr: { $lte: ['$quantity', '$minStock'] },
      }).limit(10),
      InventoryItem.countDocuments({ ...regionFilter, isActive: true }),
      MaterialRequest.find({ status: 'pending' })
        .sort('-createdAt')
        .limit(10)
        .populate('ticket', 'ticketNumber title')
        .populate({ path: 'worker', populate: { path: 'user', select: 'firstName lastName' } })
        .populate('items.item', 'name sku unit'),
    ]);

    return {
      kpis: {
        pendingRequests,
        approvedToday,
        lowStockCount: lowStockItems.length,
        totalItems,
      },
      pendingRequests: pendingList,
      lowStockItems,
    };
  }

  async getDashboard(user) {
    if (user.roles.includes(ROLES.SUPER_ADMIN) || user.roles.includes(ROLES.MAINTENANCE_MANAGER)) {
      return { type: 'admin', data: await this.getAdminDashboard(user.region) };
    }
    if (user.roles.includes(ROLES.TEAM_LEADER)) {
      const teams = await MaintenanceTeam.find({ leader: user._id, isDeleted: { $ne: true } })
        .populate('leader', 'firstName lastName email phone')
        .populate({
          path: 'members',
          populate: [{ path: 'user', select: 'firstName lastName phone' }, 'specialty'],
        });
      const teamIds = teams.map((t) => t._id);
      return { type: 'leader', data: await this.getLeaderDashboard(teamIds, teams) };
    }
    if (user.roles.includes(ROLES.WORKER) && user.workerProfile) {
      return { type: 'worker', data: await this.getWorkerDashboard(toObjectId(user.workerProfile)) };
    }
    if (user.roles.includes(ROLES.SCHOOL_ADMIN) && user.school) {
      return { type: 'school', data: await this.getSchoolDashboard(toObjectId(user.school)) };
    }
    if (user.roles.includes(ROLES.WAREHOUSE_KEEPER)) {
      return { type: 'warehouse', data: await this.getWarehouseDashboard(user.region) };
    }
    return { type: 'default', data: {} };
  }
}

export default new DashboardService();
