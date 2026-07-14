import { TICKET_STATUS, TASK_STATUS } from '../../constants/statuses.js';
import { AppError } from '../../utils/AppError.js';

export const TICKET_TRANSITIONS = {
  [TICKET_STATUS.NEW]: [TICKET_STATUS.ASSIGNED, TICKET_STATUS.CANCELLED],
  [TICKET_STATUS.ASSIGNED]: [TICKET_STATUS.ACCEPTED, TICKET_STATUS.CANCELLED],
  [TICKET_STATUS.ACCEPTED]: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.CANCELLED],
  [TICKET_STATUS.IN_PROGRESS]: [
    TICKET_STATUS.WAITING_MATERIALS,
    TICKET_STATUS.UNDER_REVIEW,
    TICKET_STATUS.CANCELLED,
  ],
  [TICKET_STATUS.WAITING_MATERIALS]: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.CANCELLED],
  [TICKET_STATUS.UNDER_REVIEW]: [
    TICKET_STATUS.APPROVED,
    TICKET_STATUS.REJECTED,
    TICKET_STATUS.NEEDS_REWORK,
  ],
  [TICKET_STATUS.APPROVED]: [TICKET_STATUS.CLOSED],
  [TICKET_STATUS.NEEDS_REWORK]: [TICKET_STATUS.IN_PROGRESS],
  [TICKET_STATUS.REJECTED]: [TICKET_STATUS.ASSIGNED],
  [TICKET_STATUS.CLOSED]: [],
  [TICKET_STATUS.CANCELLED]: [],
};

export const TASK_TRANSITIONS = {
  [TASK_STATUS.NOT_STARTED]: [TASK_STATUS.ASSIGNED],
  [TASK_STATUS.ASSIGNED]: [TASK_STATUS.ACCEPTED, TASK_STATUS.REJECTED, TASK_STATUS.IN_PROGRESS],
  [TASK_STATUS.ACCEPTED]: [TASK_STATUS.IN_PROGRESS],
  [TASK_STATUS.IN_PROGRESS]: [TASK_STATUS.WAITING_MATERIALS, TASK_STATUS.COMPLETED],
  [TASK_STATUS.WAITING_MATERIALS]: [TASK_STATUS.IN_PROGRESS],
  [TASK_STATUS.COMPLETED]: [TASK_STATUS.UNDER_REVIEW],
  [TASK_STATUS.UNDER_REVIEW]: [TASK_STATUS.APPROVED, TASK_STATUS.REJECTED, TASK_STATUS.NEEDS_REWORK],
  [TASK_STATUS.NEEDS_REWORK]: [TASK_STATUS.IN_PROGRESS, TASK_STATUS.COMPLETED],
  [TASK_STATUS.APPROVED]: [],
  [TASK_STATUS.REJECTED]: [TASK_STATUS.ASSIGNED, TASK_STATUS.IN_PROGRESS, TASK_STATUS.NEEDS_REWORK, TASK_STATUS.COMPLETED],
};

export function canTransition(currentStatus, newStatus, transitions) {
  const allowed = transitions[currentStatus] || [];
  return allowed.includes(newStatus);
}

export function validateTicketTransition(currentStatus, newStatus) {
  if (!canTransition(currentStatus, newStatus, TICKET_TRANSITIONS)) {
    throw new AppError(
      `Invalid ticket status transition from '${currentStatus}' to '${newStatus}'`,
      400
    );
  }
}

export function validateTaskTransition(currentStatus, newStatus) {
  if (!canTransition(currentStatus, newStatus, TASK_TRANSITIONS)) {
    throw new AppError(
      `Invalid task status transition from '${currentStatus}' to '${newStatus}'`,
      400
    );
  }
}

/**
 * Computes aggregate ticket status from all task statuses.
 * Priority order: any waiting_materials > any in_progress > all under_review > all approved
 */
export function computeTicketStatusFromTasks(tasks, currentTicketStatus) {
  if (!tasks.length) return currentTicketStatus;

  const statuses = tasks.map((t) => t.status);

  if (statuses.every((s) => s === TASK_STATUS.APPROVED)) {
    return TICKET_STATUS.APPROVED;
  }
  if (statuses.some((s) => s === TASK_STATUS.WAITING_MATERIALS)) {
    return TICKET_STATUS.WAITING_MATERIALS;
  }
  if (statuses.some((s) => [TASK_STATUS.IN_PROGRESS, TASK_STATUS.NEEDS_REWORK].includes(s))) {
    return TICKET_STATUS.IN_PROGRESS;
  }
  if (statuses.every((s) => [TASK_STATUS.COMPLETED, TASK_STATUS.UNDER_REVIEW, TASK_STATUS.APPROVED].includes(s))) {
    return TICKET_STATUS.UNDER_REVIEW;
  }
  if (statuses.every((s) => s === TASK_STATUS.ACCEPTED)) {
    return TICKET_STATUS.ACCEPTED;
  }
  if (statuses.some((s) => s === TASK_STATUS.ACCEPTED)) {
    return TICKET_STATUS.ACCEPTED;
  }
  if (statuses.every((s) => s === TASK_STATUS.ASSIGNED || s === TASK_STATUS.NOT_STARTED)) {
    return TICKET_STATUS.ASSIGNED;
  }

  return currentTicketStatus;
}

export function createStatusHistoryEntry(status, userId, note = '') {
  return {
    status,
    changedBy: userId,
    changedAt: new Date(),
    note,
  };
}
