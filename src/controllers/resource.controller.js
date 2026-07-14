import {
  regionRepository,
  schoolRepository,
  teamRepository,
  workerRepository,
  categoryRepository,
  inventoryRepository,
  materialRequestRepository,
  auditRepository,
  slaRepository,
} from '../repositories/index.js';
import schoolService from '../services/schoolService.js';
import workerService from '../services/workerService.js';
import dashboardService from '../services/dashboardService.js';
import notificationService from '../services/notificationService.js';
import auditService from '../services/auditService.js';
import inventoryService from '../services/inventoryService.js';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../utils/responseHelper.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildPagination, buildSort, buildSearchFilter, pickQueryFilters } from '../utils/pagination.js';
import { NotFoundError } from '../utils/AppError.js';

const crudController = (repository, entityName, populate = []) => ({
  list: asyncHandler(async (req, res) => {
    const pagination = buildPagination(req.query.page, req.query.limit);
    const filter = {
      isDeleted: { $ne: true },
      ...pickQueryFilters(req.query, ['region', 'isActive', 'team', 'specialty']),
      ...buildSearchFilter(req.query.search, ['name', 'code']),
    };
    const [data, total] = await Promise.all([
      repository.findAll(filter, {
        skip: pagination.skip,
        limit: pagination.limit,
        sort: buildSort(req.query.sort),
        populate,
      }),
      repository.count(filter),
    ]);
    sendPaginated(res, data, { ...pagination, total });
  }),

  get: asyncHandler(async (req, res) => {
    const item = await repository.findById(req.params.id, populate);
    if (!item) throw new NotFoundError(entityName);
    sendSuccess(res, item);
  }),

  create: asyncHandler(async (req, res) => {
    const item = await repository.create(req.body);
    await auditService.log({
      user: req.user._id,
      action: 'CREATE',
      entityType: entityName,
      entityId: item._id,
      req,
    });
    sendCreated(res, item);
  }),

  update: asyncHandler(async (req, res) => {
    const item = await repository.updateById(req.params.id, req.body);
    if (!item) throw new NotFoundError(entityName);
    await auditService.log({
      user: req.user._id,
      action: 'UPDATE',
      entityType: entityName,
      entityId: item._id,
      changes: req.body,
      req,
    });
    sendSuccess(res, item);
  }),

  remove: asyncHandler(async (req, res) => {
    await repository.softDelete(req.params.id, req.user._id);
    await auditService.log({
      user: req.user._id,
      action: 'DELETE',
      entityType: entityName,
      entityId: req.params.id,
      req,
    });
    sendNoContent(res);
  }),
});

export const regionController = crudController(regionRepository, 'Region');
export const schoolController = {
  get: crudController(schoolRepository, 'School', ['region', 'maintenanceTeam']).get,
  list: crudController(schoolRepository, 'School', ['region', 'maintenanceTeam']).list,
  remove: crudController(schoolRepository, 'School', ['region', 'maintenanceTeam']).remove,
  create: asyncHandler(async (req, res) => {
    const school = await schoolService.create(req.body, req.user, req);
    sendCreated(res, school);
  }),
  update: asyncHandler(async (req, res) => {
    const school = await schoolService.update(req.params.id, req.body, req.user, req);
    sendSuccess(res, school);
  }),
  getDetail: asyncHandler(async (req, res) => {
    const { School, Ticket, Report } = await import('../models/index.js');
    const school = await School.findById(req.params.id)
      .populate('region', 'name code')
      .populate('maintenanceTeam', 'name code')
      .populate('adminUsers', 'firstName lastName email phone isActive');
    if (!school) throw new NotFoundError('School');

    const tickets = await Ticket.find({ school: school._id, isDeleted: { $ne: true } })
      .populate('category', 'name')
      .populate('team', 'name code')
      .sort('-createdAt')
      .limit(50)
      .lean();

    const ticketIds = tickets.map((t) => t._id);
    const reports = ticketIds.length
      ? await Report.find({ ticket: { $in: ticketIds } }).lean()
      : [];
    const reportByTicket = Object.fromEntries(reports.map((r) => [r.ticket.toString(), r]));

    sendSuccess(res, {
      school,
      tickets: tickets.map((t) => ({
        ...t,
        report: reportByTicket[t._id.toString()] || null,
      })),
    });
  }),
};
export const teamController = {
  ...crudController(teamRepository, 'MaintenanceTeam', ['region', 'leader', 'members']),
  getDetail: asyncHandler(async (req, res) => {
    const { MaintenanceTeam, Ticket, Report } = await import('../models/index.js');
    const team = await MaintenanceTeam.findById(req.params.id)
      .populate('region', 'name code')
      .populate('leader', 'firstName lastName email phone')
      .populate({
        path: 'members',
        populate: [
          { path: 'user', select: 'firstName lastName email phone' },
          { path: 'specialty', select: 'name key icon color' },
        ],
      });
    if (!team) throw new NotFoundError('MaintenanceTeam');

    const tickets = await Ticket.find({ team: team._id, isDeleted: { $ne: true } })
      .populate('school', 'name code')
      .populate('category', 'name')
      .sort('-createdAt')
      .limit(50)
      .lean();

    const ticketIds = tickets.map((t) => t._id);
    const reports = ticketIds.length
      ? await Report.find({ ticket: { $in: ticketIds } }).lean()
      : [];
    const reportByTicket = Object.fromEntries(reports.map((r) => [r.ticket.toString(), r]));

    sendSuccess(res, {
      ...team.toObject(),
      tickets: tickets.map((t) => ({
        ...t,
        report: reportByTicket[t._id.toString()] || null,
      })),
    });
  }),
};

const workerCrud = crudController(workerRepository, 'Worker', [
  { path: 'user', select: 'firstName lastName email phone' },
  'specialty',
  'team',
]);

export const workerController = {
  get: workerCrud.get,
  remove: workerCrud.remove,
  list: asyncHandler(async (req, res) => {
    const pagination = buildPagination(req.query.page, req.query.limit);
    const filter = {
      isDeleted: { $ne: true },
      ...pickQueryFilters(req.query, ['region', 'isActive', 'team', 'specialty']),
      ...buildSearchFilter(req.query.search, ['employeeId']),
    };
    const [data, total] = await Promise.all([
      workerRepository.findAll(filter, {
        skip: pagination.skip,
        limit: pagination.limit,
        sort: buildSort(req.query.sort),
        populate: [
          { path: 'user', select: 'firstName lastName email phone' },
          'specialty',
          'team',
        ],
      }),
      workerRepository.count(filter),
    ]);
    sendPaginated(res, data, { ...pagination, total });
  }),
  create: asyncHandler(async (req, res) => {
    const worker = await workerService.create(req.body, req.user, req);
    sendCreated(res, worker);
  }),
  update: asyncHandler(async (req, res) => {
    const worker = await workerService.update(req.params.id, req.body, req.user, req);
    sendSuccess(res, worker);
  }),
  getProfile: asyncHandler(async (req, res) => {
    const { TicketTask } = await import('../models/index.js');
    const worker = await workerRepository.findById(req.params.id, [
      { path: 'user', select: 'firstName lastName email phone' },
      'specialty',
      'team',
    ]);
    if (!worker) throw new NotFoundError('Worker');

    const [tasks, stats] = await Promise.all([
      TicketTask.find({ worker: worker._id })
        .sort('-updatedAt')
        .limit(20)
        .populate('specialty', 'name')
        .populate({ path: 'ticket', select: 'ticketNumber title status school', populate: { path: 'school', select: 'name' } }),
      TicketTask.aggregate([
        { $match: { worker: worker._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalHours: { $sum: '$workingHours' },
          },
        },
      ]),
    ]);

    sendSuccess(res, { worker, recentTasks: tasks, stats });
  }),
};
export const categoryController = crudController(categoryRepository, 'MaintenanceCategory', ['requiredSpecialties']);
export const slaController = crudController(slaRepository, 'SLA', ['region']);

export const inventoryController = {
  list: asyncHandler(async (req, res) => {
    const { data, pagination } = await inventoryService.listItems(req.query);
    sendPaginated(res, data, pagination);
  }),
  listOptions: asyncHandler(async (req, res) => {
    const { data, pagination } = await inventoryService.listItemOptions(req.query);
    sendPaginated(res, data, pagination);
  }),
  create: asyncHandler(async (req, res) => {
    const item = await inventoryService.createItem(req.body, req.user, req);
    sendCreated(res, item);
  }),
  update: asyncHandler(async (req, res) => {
    const item = await inventoryRepository.updateById(req.params.id, req.body);
    if (!item) throw new NotFoundError('Inventory item');
    await auditService.log({
      user: req.user._id,
      action: 'UPDATE',
      entityType: 'InventoryItem',
      entityId: item._id,
      changes: req.body,
      req,
    });
    sendSuccess(res, item);
  }),
  getLowStock: asyncHandler(async (req, res) => {
    const items = await inventoryService.getLowStockItems(req.params.regionId);
    sendSuccess(res, items);
  }),
  listCustody: asyncHandler(async (req, res) => {
    const records = await inventoryService.listCustody(req.query, req.user);
    sendSuccess(res, records);
  }),
};

export const materialRequestController = {
  create: asyncHandler(async (req, res) => {
    const request = await inventoryService.createMaterialRequest(req.body, req.user, req);
    sendCreated(res, request);
  }),
  approve: asyncHandler(async (req, res) => {
    const request = await inventoryService.approveMaterialRequest(
      req.params.id,
      req.body.approvals,
      req.user,
      req,
      req.body.warehouseNotes
    );
    sendSuccess(res, request, 'Request approved');
  }),
  reject: asyncHandler(async (req, res) => {
    const request = await inventoryService.rejectMaterialRequest(
      req.params.id,
      req.body.reason,
      req.user,
      req
    );
    sendSuccess(res, request, 'Request rejected');
  }),
  list: asyncHandler(async (req, res) => {
    const { data, pagination } = await inventoryService.listMaterialRequests(req.query, req.user);
    sendPaginated(res, data, pagination);
  }),
};

export const dashboardController = {
  get: asyncHandler(async (req, res) => {
    const dashboard = await dashboardService.getDashboard(req.user);
    sendSuccess(res, dashboard);
  }),
};

export const notificationController = {
  list: asyncHandler(async (req, res) => {
    const pagination = buildPagination(req.query.page, req.query.limit);
    const result = await notificationService.getUserNotifications(req.user._id, pagination);
    sendPaginated(res, result.data, { ...pagination, total: result.total, unreadCount: result.unreadCount });
  }),
  markRead: asyncHandler(async (req, res) => {
    await notificationService.markAsRead(req.params.id, req.user._id);
    sendSuccess(res, null, 'Marked as read');
  }),
  markAllRead: asyncHandler(async (req, res) => {
    await notificationService.markAllAsRead(req.user._id);
    sendSuccess(res, null, 'All marked as read');
  }),
};

export const auditController = {
  list: asyncHandler(async (req, res) => {
    const pagination = buildPagination(req.query.page, req.query.limit);
    const filter = pickQueryFilters(req.query, ['entityType', 'action']);
    if (req.query.entityId) filter.entityId = req.query.entityId;
    const result = await auditService.getLogs(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: buildSort(req.query.sort || '-createdAt'),
    });
    sendPaginated(res, result.data, { ...pagination, total: result.total });
  }),
};

export const specialtyController = {
  list: asyncHandler(async (req, res) => {
    const { Specialty } = await import('../models/index.js');
    const specialties = await Specialty.find({ isActive: true }).sort('sortOrder');
    sendSuccess(res, specialties);
  }),
};

export const settingsController = {
  getRoles: asyncHandler(async (_req, res) => {
    const { ROLE_PERMISSIONS, PERMISSIONS } = await import('../constants/permissions.js');
    const { ROLES } = await import('../constants/roles.js');
    sendSuccess(res, {
      roles: ROLES,
      rolePermissions: ROLE_PERMISSIONS,
      allPermissions: Object.values(PERMISSIONS),
    });
  }),
};

export const reportController = {
  list: asyncHandler(async (req, res) => {
    const { Report } = await import('../models/index.js');
    const pagination = buildPagination(req.query.page, req.query.limit);
    const filter = {};
    if (req.query.search) {
      filter['metadata.ticketNumber'] = { $regex: req.query.search, $options: 'i' };
    }
    const [data, total] = await Promise.all([
      Report.find(filter)
        .populate({ path: 'ticket', select: 'ticketNumber title status school priority', populate: { path: 'school', select: 'name' } })
        .sort('-generatedAt')
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Report.countDocuments(filter),
    ]);
    sendPaginated(res, data, { ...pagination, total });
  }),
};
