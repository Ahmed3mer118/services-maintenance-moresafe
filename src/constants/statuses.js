export const TICKET_STATUS = {
  NEW: 'new',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  WAITING_MATERIALS: 'waiting_materials',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  NEEDS_REWORK: 'needs_rework',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

export const TASK_STATUS = {
  NOT_STARTED: 'not_started',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  WAITING_MATERIALS: 'waiting_materials',
  COMPLETED: 'completed',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  NEEDS_REWORK: 'needs_rework',
};

export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const MATERIAL_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FULFILLED: 'fulfilled',
};

export const INVENTORY_TX_TYPE = {
  ISSUE: 'issue',
  RETURN: 'return',
  ADJUSTMENT: 'adjustment',
};

export const STATUS_COLORS = {
  [TICKET_STATUS.NEW]: '#000000',
  [TICKET_STATUS.ASSIGNED]: '#6B7280',
  [TICKET_STATUS.ACCEPTED]: '#3B82F6',
  [TICKET_STATUS.IN_PROGRESS]: '#EAB308',
  [TICKET_STATUS.WAITING_MATERIALS]: '#F97316',
  [TICKET_STATUS.UNDER_REVIEW]: '#A855F7',
  [TICKET_STATUS.APPROVED]: '#22C55E',
  [TICKET_STATUS.CLOSED]: '#15803D',
  [TICKET_STATUS.REJECTED]: '#EF4444',
  [TICKET_STATUS.NEEDS_REWORK]: '#EF4444',
  [TICKET_STATUS.CANCELLED]: '#6B7280',
  [TASK_STATUS.NOT_STARTED]: '#000000',
  [TASK_STATUS.ASSIGNED]: '#6B7280',
  [TASK_STATUS.ACCEPTED]: '#3B82F6',
  [TASK_STATUS.IN_PROGRESS]: '#EAB308',
  [TASK_STATUS.WAITING_MATERIALS]: '#F97316',
  [TASK_STATUS.COMPLETED]: '#22C55E',
  [TASK_STATUS.UNDER_REVIEW]: '#A855F7',
  [TASK_STATUS.APPROVED]: '#22C55E',
  [TASK_STATUS.REJECTED]: '#EF4444',
  [TASK_STATUS.NEEDS_REWORK]: '#EF4444',
};
