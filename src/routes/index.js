import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as ticketController from '../controllers/ticket.controller.js';
import * as resourceController from '../controllers/resource.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { validate } from '../validators/schemas.js';
import {
  loginSchema,
  registerSchema,
  regionSchema,
  regionUpdateSchema,
  schoolSchema,
  schoolCreateSchema,
  schoolUpdateSchema,
  teamSchema,
  teamUpdateSchema,
  workerSchema,
  workerCreateSchema,
  workerUpdateSchema,
  categorySchema,
  categoryUpdateSchema,
  ticketCreateSchema,
  ticketAssignSchema,
  ticketStatusSchema,
  taskCompleteSchema,
  materialRequestSchema,
  materialRequestApproveSchema,
  materialRequestRejectSchema,
  inventoryItemSchema,
  ratingSchema,
  slaSchema,
  ticketUpdateSchema,
  paginationSchema,
} from '../validators/schemas.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { uploadImages } from '../middlewares/upload.middleware.js';

const router = Router();

// Auth
router.post('/auth/login', validate(loginSchema), authController.login);
router.post('/auth/register', validate(registerSchema), authController.register);
router.post('/auth/refresh', authController.refresh);
router.post('/auth/logout', authenticate, authController.logout);
router.get('/auth/me', authenticate, authController.getProfile);

// Dashboard
router.get('/dashboard', authenticate, resourceController.dashboardController.get);

// Regions
router.get('/regions', authenticate, authorize(PERMISSIONS.REGIONS_READ), validate(paginationSchema, 'query'), resourceController.regionController.list);
router.post('/regions', authenticate, authorize(PERMISSIONS.REGIONS_WRITE), validate(regionSchema), resourceController.regionController.create);
router.get('/regions/:id', authenticate, authorize(PERMISSIONS.REGIONS_READ), resourceController.regionController.get);
router.put('/regions/:id', authenticate, authorize(PERMISSIONS.REGIONS_WRITE), validate(regionUpdateSchema), resourceController.regionController.update);
router.delete('/regions/:id', authenticate, authorize(PERMISSIONS.REGIONS_DELETE), resourceController.regionController.remove);

// Schools
router.get('/schools', authenticate, authorize(PERMISSIONS.SCHOOLS_READ), validate(paginationSchema, 'query'), resourceController.schoolController.list);
router.post('/schools', authenticate, authorize(PERMISSIONS.SCHOOLS_WRITE), validate(schoolCreateSchema), resourceController.schoolController.create);
router.get('/schools/:id', authenticate, authorize(PERMISSIONS.SCHOOLS_READ), resourceController.schoolController.getDetail);
router.put('/schools/:id', authenticate, authorize(PERMISSIONS.SCHOOLS_WRITE), validate(schoolUpdateSchema), resourceController.schoolController.update);
router.delete('/schools/:id', authenticate, authorize(PERMISSIONS.SCHOOLS_DELETE), resourceController.schoolController.remove);

// Teams
router.get('/teams', authenticate, authorize(PERMISSIONS.TEAMS_READ), validate(paginationSchema, 'query'), resourceController.teamController.list);
router.post('/teams', authenticate, authorize(PERMISSIONS.TEAMS_WRITE), validate(teamSchema), resourceController.teamController.create);
router.get('/teams/:id', authenticate, authorize(PERMISSIONS.TEAMS_READ), resourceController.teamController.getDetail);
router.put('/teams/:id', authenticate, authorize(PERMISSIONS.TEAMS_WRITE), validate(teamUpdateSchema), resourceController.teamController.update);
router.delete('/teams/:id', authenticate, authorize(PERMISSIONS.TEAMS_DELETE), resourceController.teamController.remove);

// Workers
router.get('/workers', authenticate, authorize(PERMISSIONS.WORKERS_READ), validate(paginationSchema, 'query'), resourceController.workerController.list);
router.post('/workers', authenticate, authorize(PERMISSIONS.WORKERS_WRITE), validate(workerCreateSchema), resourceController.workerController.create);
router.get('/workers/:id', authenticate, authorize(PERMISSIONS.WORKERS_READ), resourceController.workerController.getProfile);
router.put('/workers/:id', authenticate, authorize(PERMISSIONS.WORKERS_WRITE), validate(workerUpdateSchema), resourceController.workerController.update);
router.delete('/workers/:id', authenticate, authorize(PERMISSIONS.WORKERS_DELETE), resourceController.workerController.remove);

// Specialties
router.get('/specialties', authenticate, resourceController.specialtyController.list);

// Categories
router.get('/categories', authenticate, authorize(PERMISSIONS.CATEGORIES_READ, PERMISSIONS.TICKETS_CREATE), validate(paginationSchema, 'query'), resourceController.categoryController.list);
router.post('/categories', authenticate, authorize(PERMISSIONS.CATEGORIES_WRITE), validate(categorySchema), resourceController.categoryController.create);
router.get('/categories/:id', authenticate, authorize(PERMISSIONS.CATEGORIES_READ), resourceController.categoryController.get);
router.put('/categories/:id', authenticate, authorize(PERMISSIONS.CATEGORIES_WRITE), validate(categoryUpdateSchema), resourceController.categoryController.update);

// SLA
router.get('/slas', authenticate, authorize(PERMISSIONS.SLA_READ), validate(paginationSchema, 'query'), resourceController.slaController.list);
router.post('/slas', authenticate, authorize(PERMISSIONS.SLA_WRITE), validate(slaSchema), resourceController.slaController.create);
router.put('/slas/:id', authenticate, authorize(PERMISSIONS.SLA_WRITE), validate(slaSchema), resourceController.slaController.update);

// Tickets
router.get('/tickets', authenticate, authorize(PERMISSIONS.TICKETS_READ), validate(paginationSchema, 'query'), ticketController.listTickets);
router.post('/tickets', authenticate, authorize(PERMISSIONS.TICKETS_CREATE), validate(ticketCreateSchema), ticketController.createTicket);
router.get('/tickets/:id', authenticate, authorize(PERMISSIONS.TICKETS_READ), ticketController.getTicket);
router.put('/tickets/:id', authenticate, authorize(PERMISSIONS.TICKETS_UPDATE), validate(ticketUpdateSchema), ticketController.updateTicket);
router.post('/tickets/:id/assign', authenticate, authorize(PERMISSIONS.TICKETS_ASSIGN), validate(ticketAssignSchema), ticketController.assignWorkers);
router.patch('/tickets/:id/status', authenticate, authorize(PERMISSIONS.TICKETS_UPDATE), validate(ticketStatusSchema), ticketController.updateTicketStatus);
router.post('/tickets/:id/confirm', authenticate, authorize(PERMISSIONS.TICKETS_CLOSE), ticketController.schoolConfirm);
router.post('/tickets/:id/rate', authenticate, authorize(PERMISSIONS.TICKETS_CLOSE), validate(ratingSchema), ticketController.rateTicket);
router.post('/tickets/:id/comments', authenticate, authorize(PERMISSIONS.TICKETS_READ), ticketController.addComment);
router.post(
  '/tickets/:id/images',
  authenticate,
  authorize(PERMISSIONS.TASKS_WORK, PERMISSIONS.TICKETS_CREATE),
  uploadImages,
  ticketController.uploadTicketImages
);
router.post('/tickets/:id/report', authenticate, authorize(PERMISSIONS.REPORTS_GENERATE, PERMISSIONS.TICKETS_REVIEW), ticketController.generateReport);
router.get('/tickets/:id/report', authenticate, authorize(PERMISSIONS.REPORTS_READ), ticketController.getReport);

// Tasks
router.get('/tasks/my', authenticate, authorize(PERMISSIONS.TASKS_READ), ticketController.getMyTasks);
router.get('/tasks/:taskId', authenticate, authorize(PERMISSIONS.TASKS_READ), ticketController.getTask);
router.post('/tasks/:taskId/images', authenticate, authorize(PERMISSIONS.TASKS_WORK), uploadImages, ticketController.uploadTaskImages);
router.patch('/tasks/:taskId/notes', authenticate, authorize(PERMISSIONS.TASKS_WORK), ticketController.updateTaskNotes);
router.post('/tasks/:taskId/accept', authenticate, authorize(PERMISSIONS.TASKS_ACCEPT), ticketController.acceptTask);
router.post('/tasks/:taskId/reject', authenticate, authorize(PERMISSIONS.TASKS_ACCEPT), ticketController.rejectTask);
router.post('/tasks/:taskId/start', authenticate, authorize(PERMISSIONS.TASKS_WORK), ticketController.startTask);
router.post('/tasks/:taskId/complete', authenticate, authorize(PERMISSIONS.TASKS_COMPLETE), validate(taskCompleteSchema), ticketController.completeTask);
router.post('/tasks/:taskId/review', authenticate, authorize(PERMISSIONS.TICKETS_REVIEW), ticketController.reviewTask);

// Inventory
router.get('/inventory', authenticate, authorize(PERMISSIONS.INVENTORY_READ), validate(paginationSchema, 'query'), resourceController.inventoryController.list);
router.get('/inventory/options', authenticate, authorize(PERMISSIONS.MATERIAL_REQUESTS_READ, PERMISSIONS.MATERIAL_REQUESTS_CREATE, PERMISSIONS.TASKS_WORK, PERMISSIONS.TICKETS_ASSIGN), validate(paginationSchema, 'query'), resourceController.inventoryController.listOptions);
router.post('/inventory', authenticate, authorize(PERMISSIONS.INVENTORY_WRITE), validate(inventoryItemSchema), resourceController.inventoryController.create);
router.put('/inventory/:id', authenticate, authorize(PERMISSIONS.INVENTORY_WRITE), validate(inventoryItemSchema), resourceController.inventoryController.update);
router.get('/inventory/low-stock/:regionId', authenticate, authorize(PERMISSIONS.INVENTORY_READ), resourceController.inventoryController.getLowStock);
router.get('/inventory/custody', authenticate, authorize(PERMISSIONS.INVENTORY_READ), resourceController.inventoryController.listCustody);

// Material Requests
router.get('/material-requests', authenticate, authorize(PERMISSIONS.MATERIAL_REQUESTS_READ, PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_APPROVE), validate(paginationSchema, 'query'), resourceController.materialRequestController.list);
router.post('/material-requests', authenticate, authorize(PERMISSIONS.MATERIAL_REQUESTS_CREATE, PERMISSIONS.TASKS_WORK, PERMISSIONS.TICKETS_ASSIGN), validate(materialRequestSchema), resourceController.materialRequestController.create);
router.post('/material-requests/:id/approve', authenticate, authorize(PERMISSIONS.INVENTORY_APPROVE), validate(materialRequestApproveSchema), resourceController.materialRequestController.approve);
router.post('/material-requests/:id/reject', authenticate, authorize(PERMISSIONS.INVENTORY_APPROVE), validate(materialRequestRejectSchema), resourceController.materialRequestController.reject);

// Notifications
router.get('/notifications', authenticate, validate(paginationSchema, 'query'), resourceController.notificationController.list);
router.patch('/notifications/:id/read', authenticate, resourceController.notificationController.markRead);
router.patch('/notifications/read-all', authenticate, resourceController.notificationController.markAllRead);

// Settings
router.get('/settings/roles', authenticate, authorize(PERMISSIONS.USERS_READ), resourceController.settingsController.getRoles);

// Reports
router.get('/reports', authenticate, authorize(PERMISSIONS.REPORTS_READ), validate(paginationSchema, 'query'), resourceController.reportController.list);

// Audit
router.get('/audit-logs', authenticate, authorize(PERMISSIONS.AUDIT_READ), validate(paginationSchema, 'query'), resourceController.auditController.list);

export default router;
