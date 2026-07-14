import mongoose from 'mongoose';
import {
  inventoryRepository,
  materialRequestRepository,
} from '../repositories/index.js';
import { InventoryItem, InventoryTransaction, MaterialRequest } from '../models/index.js';
import { MATERIAL_REQUEST_STATUS, INVENTORY_TX_TYPE, TASK_STATUS } from '../constants/statuses.js';
import { NotFoundError, AppError } from '../utils/AppError.js';
import auditService from './auditService.js';
import notificationService from './notificationService.js';
import ticketTaskRepository from '../repositories/ticketTaskRepository.js';
import { ROLES } from '../constants/roles.js';
import { buildPagination, buildSort, buildSearchFilter, pickQueryFilters } from '../utils/pagination.js';
import { AuthorizationError } from '../utils/AppError.js';

class InventoryService {
  async createItem(data, user, req) {
    const item = await inventoryRepository.create(data);
    await auditService.log({
      user: user._id,
      action: 'CREATE',
      entityType: 'InventoryItem',
      entityId: item._id,
      req,
    });
    return item;
  }

  async listItems(query) {
    const pagination = buildPagination(query.page, query.limit);
    const filter = {
      isActive: true,
      ...(query.region && { region: query.region }),
      ...(query.category && { category: query.category }),
      ...buildSearchFilter(query.search, ['name', 'sku']),
    };
    const [data, total] = await Promise.all([
      inventoryRepository.findAll(filter, {
        skip: pagination.skip,
        limit: pagination.limit,
        sort: buildSort(query.sort),
      }),
      inventoryRepository.count(filter),
    ]);
    return { data, pagination: { ...pagination, total } };
  }

  async listItemOptions(query) {
    const pagination = buildPagination(query.page, query.limit || 50);
    const filter = {
      isActive: true,
      ...(query.region && { region: query.region }),
      ...buildSearchFilter(query.search, ['name', 'sku']),
    };
    const [data, total] = await Promise.all([
      InventoryItem.find(filter)
        .select('sku name unit quantity category region')
        .skip(pagination.skip)
        .limit(pagination.limit)
        .sort(buildSort(query.sort || 'name'))
        .lean(),
      InventoryItem.countDocuments(filter),
    ]);
    return { data, pagination: { ...pagination, total } };
  }

  async createMaterialRequest(data, user, req) {
    const workerId = data.worker || user.workerProfile;
    if (!workerId) throw new AppError('Worker is required for material request', 400);

    const request = await materialRequestRepository.create({
      ticket: data.ticket,
      ticketTask: data.ticketTask,
      worker: workerId,
      items: data.items,
      notes: data.notes,
      status: MATERIAL_REQUEST_STATUS.PENDING,
    });

    const { User } = await import('../models/index.js');
    const warehouseKeepers = await User.find({
      roles: 'warehouse_keeper',
      isActive: true,
    });

    await notificationService.notifyMany(
      warehouseKeepers.map((u) => u._id),
      {
        type: 'material_request',
        title: 'New Material Request',
        message: 'A worker has requested materials',
        entityType: 'MaterialRequest',
        entityId: request._id,
      }
    );

    await auditService.log({
      user: user._id,
      action: 'CREATE',
      entityType: 'MaterialRequest',
      entityId: request._id,
      req,
    });

    return request;
  }

  async approveMaterialRequest(requestId, approvals, user, req, warehouseNotes = '') {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await MaterialRequest.findById(requestId).session(session);
      if (!request) throw new NotFoundError('Material request');
      if (request.status !== MATERIAL_REQUEST_STATUS.PENDING) {
        throw new AppError('Request already processed', 400);
      }

      const { Worker, MaintenanceTeam, InventoryCustody } = await import('../models/index.js');
      const workerDoc = await Worker.findById(request.worker).session(session);
      let teamLeader = null;
      if (workerDoc?.team) {
        const team = await MaintenanceTeam.findById(workerDoc.team).session(session);
        teamLeader = team?.leader;
      }

      const custodyRecords = [];

      for (const approval of approvals) {
        const item = await InventoryItem.findById(approval.itemId).session(session);
        if (!item) throw new NotFoundError('Inventory item');

        const qty = approval.quantityApproved;
        if (item.quantity < qty) {
          throw new AppError(`Insufficient stock for ${item.name}`, 400);
        }

        item.quantity -= qty;
        await item.save({ session });

        const transaction = new InventoryTransaction({
          ticket: request.ticket,
          worker: request.worker,
          warehouse: user._id,
          item: item._id,
          quantity: qty,
          unitCost: item.unitCost,
          type: INVENTORY_TX_TYPE.ISSUE,
          materialRequest: request._id,
        });
        await transaction.save({ session });

        const reqItem = request.items.find((i) => i.item.toString() === approval.itemId);
        if (reqItem) {
          reqItem.quantityApproved = qty;
          if (approval.note) reqItem.warehouseNote = approval.note;
          else if (qty !== reqItem.quantityRequested) {
            reqItem.warehouseNote = `Adjusted from ${reqItem.quantityRequested} to ${qty}`;
          }
        }

        if (teamLeader) {
          custodyRecords.push({
            item: item._id,
            quantity: qty,
            team: workerDoc?.team,
            teamLeader,
            worker: request.worker,
            materialRequest: request._id,
            ticket: request.ticket,
            status: 'with_leader',
          });
        }
      }

      if (custodyRecords.length) {
        for (const record of custodyRecords) {
          await new InventoryCustody(record).save({ session });
        }
      }

      request.status = MATERIAL_REQUEST_STATUS.APPROVED;
      request.warehouse = user._id;
      request.approvedAt = new Date();
      if (warehouseNotes) request.warehouseNotes = warehouseNotes;
      await request.save({ session });

      if (request.ticketTask) {
        const { TicketTask } = await import('../models/index.js');
        const task = await TicketTask.findById(request.ticketTask).session(session);
        if (task?.status === TASK_STATUS.WAITING_MATERIALS) {
          task.status = TASK_STATUS.IN_PROGRESS;
          await task.save({ session });
        }
      }

      await session.commitTransaction();

      const worker = await import('../models/index.js').then((m) =>
        m.Worker.findById(request.worker).populate('user')
      );
      if (worker?.user) {
        await notificationService.create({
          userId: worker.user._id,
          type: 'material_approved',
          title: 'Material Request Approved',
          message: 'Your material request has been approved',
          entityType: 'MaterialRequest',
          entityId: requestId,
        });
      }

      await auditService.log({
        user: user._id,
        action: 'APPROVE',
        entityType: 'MaterialRequest',
        entityId: requestId,
        req,
      });

      return request;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async rejectMaterialRequest(requestId, reason, user, req) {
    const request = await MaterialRequest.findById(requestId);
    if (!request) throw new NotFoundError('Material request');
    if (request.status !== MATERIAL_REQUEST_STATUS.PENDING) {
      throw new AppError('Request already processed', 400);
    }
    if (!reason?.trim()) throw new AppError('Rejection reason is required', 400);

    request.status = MATERIAL_REQUEST_STATUS.REJECTED;
    request.rejectionReason = reason.trim();
    request.rejectedAt = new Date();
    request.rejectedBy = user._id;
    request.warehouse = user._id;
    await request.save();

    const worker = await import('../models/index.js').then((m) =>
      m.Worker.findById(request.worker).populate('user')
    );
    if (worker?.user) {
      await notificationService.create({
        userId: worker.user._id,
        type: 'material_rejected',
        title: 'Material Request Rejected',
        message: reason.trim(),
        entityType: 'MaterialRequest',
        entityId: requestId,
      });
    }

    await auditService.log({
      user: user._id,
      action: 'REJECT',
      entityType: 'MaterialRequest',
      entityId: requestId,
      changes: { reason },
      req,
    });

    return materialRequestRepository.findById(requestId, [
      'ticket',
      { path: 'worker', populate: { path: 'user', select: 'firstName lastName' } },
      'items.item',
    ]);
  }

  async listMaterialRequests(query, user) {
    const pagination = buildPagination(query.page, query.limit);
    const filter = pickQueryFilters(query, ['status', 'ticket']);

    const isWarehouse = user.roles.some((r) =>
      [ROLES.SUPER_ADMIN, ROLES.MAINTENANCE_MANAGER, ROLES.WAREHOUSE_KEEPER].includes(r)
    );
    const isLeader = user.roles.includes(ROLES.TEAM_LEADER);
    const isWorker = user.roles.includes(ROLES.WORKER);

    if (isWorker && user.workerProfile) {
      filter.worker = user.workerProfile;
    } else if (isLeader) {
      const { MaintenanceTeam } = await import('../models/index.js');
      const teams = await MaintenanceTeam.find({ leader: user._id, isDeleted: { $ne: true } });
      const memberIds = [...new Set(teams.flatMap((t) => (t.members || []).map((m) => m.toString())))];
      filter.worker = memberIds.length ? { $in: memberIds } : { $in: [] };
    } else if (!isWarehouse) {
      throw new AuthorizationError('Access denied');
    }

    const [data, total] = await Promise.all([
      materialRequestRepository.findAll(filter, {
        skip: pagination.skip,
        limit: pagination.limit,
        sort: buildSort(query.sort),
        populate: [
          { path: 'ticket', select: 'ticketNumber title status' },
          { path: 'worker', populate: { path: 'user', select: 'firstName lastName employeeId' } },
          'items.item',
        ],
      }),
      materialRequestRepository.count(filter),
    ]);
    return { data, pagination: { ...pagination, total } };
  }

  async getLowStockItems(regionId) {
    return InventoryItem.find({
      region: regionId,
      isActive: true,
      $expr: { $lte: ['$quantity', '$minStock'] },
    });
  }

  async listCustody(query, user) {
    const filter = { status: { $in: ['with_leader', 'with_worker'] } };
    if (user.roles.includes('team_leader')) {
      filter.teamLeader = user._id;
    } else if (user.workerProfile) {
      filter.worker = user.workerProfile;
      filter.status = 'with_worker';
    } else if (query.teamLeader) {
      filter.teamLeader = query.teamLeader;
    }
    const records = await import('../models/index.js').then((m) =>
      m.InventoryCustody.find(filter)
        .populate('item', 'sku name unit category')
        .populate({ path: 'worker', populate: { path: 'user', select: 'firstName lastName' } })
        .sort('-createdAt')
    );
    return records;
  }
}

export default new InventoryService();
