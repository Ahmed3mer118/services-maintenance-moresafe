import ticketTaskRepository from '../repositories/ticketTaskRepository.js';
import ticketService from './ticketService.js';
import { TASK_STATUS, TICKET_STATUS } from '../constants/statuses.js';
import {
  validateTaskTransition,
  createStatusHistoryEntry,
} from './workflow/stateMachine.js';
import { NotFoundError, AuthorizationError } from '../utils/AppError.js';
import auditService from './auditService.js';
import notificationService from './notificationService.js';
import { MaintenanceTeam } from '../models/index.js';
import workerRepository from '../repositories/workerRepository.js';
import { ROLES } from '../constants/roles.js';
import { AppError } from '../utils/AppError.js';
import { toObjectId } from '../utils/idHelper.js';

function computeWorkingHours(task) {
  if (!task.startedAt) return 0;
  const end = task.completedAt || new Date();
  const hours = (new Date(end) - new Date(task.startedAt)) / 3600000;
  return Math.max(0, Math.round(hours * 10) / 10);
}

class TaskService {
  async acceptTask(taskId, user, req) {
    return this._transition(taskId, TASK_STATUS.ACCEPTED, user, req, { acceptedAt: new Date() });
  }

  async rejectTask(taskId, note, user, req) {
    return this._transition(taskId, TASK_STATUS.REJECTED, user, req, { reviewNote: note });
  }

  async startTask(taskId, user, req) {
    const task = await this._getTaskForWorker(taskId, user);
    validateTaskTransition(task.status, TASK_STATUS.IN_PROGRESS);
    task.status = TASK_STATUS.IN_PROGRESS;
    task.startedAt = new Date();
    task.statusHistory.push(createStatusHistoryEntry(TASK_STATUS.IN_PROGRESS, user._id));
    await task.save();
    await ticketService.syncTicketStatusFromTasks(task.ticket, user._id);
    await auditService.log({
      user: user._id,
      action: 'STATUS_CHANGE',
      entityType: 'TicketTask',
      entityId: taskId,
      changes: { status: TASK_STATUS.IN_PROGRESS, startedAt: task.startedAt },
      req,
    });
    return task;
  }

  async completeTask(taskId, data, user, req) {
    const task = await this._getTaskForWorker(taskId, user);
    validateTaskTransition(task.status, TASK_STATUS.COMPLETED);

    task.status = TASK_STATUS.COMPLETED;
    task.completedAt = new Date();
    if (data.notes) task.notes = data.notes;
    task.workingHours = computeWorkingHours(task);
    if (data.beforeImages) task.beforeImages.push(...data.beforeImages);
    if (data.duringImages) task.duringImages.push(...data.duringImages);
    if (data.afterImages) task.afterImages.push(...data.afterImages);
    task.statusHistory.push(createStatusHistoryEntry(TASK_STATUS.COMPLETED, user._id));

    await task.save();
    await ticketService.syncTicketStatusFromTasks(task.ticket, user._id);

    const ticket = await ticketService.getById(task.ticket);
    await this._notifyLeaderForReview(task.ticket, ticket.ticket.ticketNumber);

    await auditService.log({
      user: user._id,
      action: 'TASK_COMPLETE',
      entityType: 'TicketTask',
      entityId: taskId,
      req,
    });

    return task;
  }

  async reviewTask(taskId, action, note, user, req) {
    const task = await ticketTaskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');

    const statusMap = {
      approve: TASK_STATUS.APPROVED,
      reject: TASK_STATUS.NEEDS_REWORK,
      rework: TASK_STATUS.NEEDS_REWORK,
    };
    const newStatus = statusMap[action];
    if (!newStatus) throw new AppError('Invalid review action', 400);

    // Already in target state — idempotent (avoid approved→approved error)
    if (task.status === newStatus) {
      return ticketTaskRepository.findByIdDetailed(taskId);
    }

    const reviewable = [
      TASK_STATUS.COMPLETED,
      TASK_STATUS.UNDER_REVIEW,
      TASK_STATUS.NEEDS_REWORK,
    ];
    if (!reviewable.includes(task.status)) {
      throw new AppError(`Task cannot be reviewed in status: ${task.status}`, 400);
    }

    if (task.status === TASK_STATUS.COMPLETED) {
      task.status = TASK_STATUS.UNDER_REVIEW;
      task.statusHistory.push(createStatusHistoryEntry(TASK_STATUS.UNDER_REVIEW, user._id, 'Submitted for review'));
    }

    validateTaskTransition(task.status, newStatus);

    task.status = newStatus;
    task.reviewedBy = user._id;
    task.reviewNote = note;
    task.statusHistory.push(createStatusHistoryEntry(newStatus, user._id, note));
    await task.save();

    await ticketService.syncTicketStatusFromTasks(task.ticket, user._id);

    const workerDoc = await workerRepository.findById(task.worker, [
      { path: 'user', select: '_id' },
    ]);
    if (workerDoc?.user) {
      const messages = {
        approve: { title: 'Work Approved', message: 'Your work has been approved by the team leader' },
        reject: {
          title: 'Work Rejected',
          message: note ? `Rejected: ${note}` : 'Your work was rejected — contact your leader',
        },
        rework: {
          title: 'Rework Required',
          message: note ? `Rework needed: ${note}` : 'Please redo the work and resubmit',
        },
      };
      const msg = messages[action];
      if (msg) {
        await notificationService.create({
          userId: workerDoc.user._id || workerDoc.user,
          type: 'task_review',
          ...msg,
          entityType: 'TicketTask',
          entityId: taskId,
        });
      }
    }

    if (action === 'approve') {
      const ticket = await import('../repositories/ticketRepository.js').then((m) =>
        m.default.findById(task.ticket)
      );
      if (ticket) {
        await notificationService.notifyUsersByRoles(
          [ROLES.MAINTENANCE_MANAGER],
          {
            type: 'task_approved',
            title: 'Task Approved by Leader',
            message: `Work approved on ticket ${ticket.ticketNumber}`,
            entityType: 'Ticket',
            entityId: ticket._id,
          },
          { region: ticket.region }
        );
      }
    }

    await auditService.log({
      user: user._id,
      action: 'TASK_REVIEW',
      entityType: 'TicketTask',
      entityId: taskId,
      changes: { action, note },
      req,
    });

    return ticketTaskRepository.findByIdDetailed(taskId);
  }

  async submitForReview(taskId, user, req) {
    return this._transition(taskId, TASK_STATUS.UNDER_REVIEW, user, req);
  }

  async getMyTasks(workerId, query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    return ticketTaskRepository.findByWorker(toObjectId(workerId), filter);
  }

  async getTaskById(taskId, user) {
    const task = await ticketTaskRepository.findByIdDetailed(taskId);
    if (!task) throw new NotFoundError('Task');

    const isWorker = user.workerProfile && task.worker?._id?.toString() === toObjectId(user.workerProfile);
    const isLeaderOrAdmin = user.roles?.some((r) =>
      ['super_admin', 'maintenance_manager', 'team_leader'].includes(r)
    );
    if (!isWorker && !isLeaderOrAdmin) {
      throw new AuthorizationError('Access denied');
    }
    return task;
  }

  async uploadTaskImages(taskId, phase, images, user, req) {
    const task = await this._getTaskForWorker(taskId, user);
    const fieldMap = {
      before: 'beforeImages',
      during: 'duringImages',
      after: 'afterImages',
    };
    const field = fieldMap[phase];
    if (!field) throw new Error('Invalid phase');

    task[field].push(...images);
    await task.save();

    await auditService.log({
      user: user._id,
      action: 'UPLOAD',
      entityType: 'TicketTask',
      entityId: taskId,
      changes: { phase, count: images.length },
      req,
    });

    return ticketTaskRepository.findByIdDetailed(taskId);
  }

  async updateTaskNotes(taskId, notes, user, req) {
    const task = await this._getTaskForWorker(taskId, user);
    task.notes = notes;
    await task.save();
    await auditService.log({
      user: user._id,
      action: 'UPDATE',
      entityType: 'TicketTask',
      entityId: taskId,
      req,
    });
    return task;
  }

  async getWorkerTasks(workerId, query) {
    const filter = {};
    if (query.status) filter.status = query.status;
    return ticketTaskRepository.findByWorker(workerId, filter);
  }

  async _transition(taskId, newStatus, user, req, extra = {}) {
    const task = await this._getTaskForWorker(taskId, user);
    validateTaskTransition(task.status, newStatus);

    task.status = newStatus;
    Object.assign(task, extra);
    task.statusHistory.push(createStatusHistoryEntry(newStatus, user._id));
    await task.save();

    await ticketService.syncTicketStatusFromTasks(task.ticket, user._id);

    await auditService.log({
      user: user._id,
      action: 'STATUS_CHANGE',
      entityType: 'TicketTask',
      entityId: taskId,
      changes: { status: newStatus },
      req,
    });

    return task;
  }

  async _getTaskForWorker(taskId, user) {
    const task = await ticketTaskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');
    const workerId = toObjectId(user.workerProfile);
    if (workerId && task.worker.toString() !== workerId) {
      throw new AuthorizationError('Not your task');
    }
    return task;
  }

  async _notifyLeaderForReview(ticketId, ticketNumber) {
    const ticket = await import('../repositories/ticketRepository.js').then((m) => m.default.findById(ticketId));
    if (!ticket?.team) return;
    const team = await MaintenanceTeam.findById(ticket.team);
    if (team?.leader) {
      await notificationService.create({
        userId: team.leader,
        type: 'task_review',
        title: 'Task Ready for Review',
        message: `Task completed for ticket ${ticketNumber}`,
        entityType: 'Ticket',
        entityId: ticketId,
      });
    }
  }
}

export default new TaskService();
