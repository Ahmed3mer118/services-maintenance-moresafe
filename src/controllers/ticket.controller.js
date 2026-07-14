import ticketService from '../services/ticketService.js';
import taskService from '../services/taskService.js';
import reportService from '../services/reportService.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/responseHelper.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadMultipleFiles } from '../helpers/uploadHelper.js';

export const createTicket = asyncHandler(async (req, res) => {
  const ticket = await ticketService.create(req.body, req.user, req);
  sendCreated(res, ticket);
});

export const listTickets = asyncHandler(async (req, res) => {
  const { data, pagination } = await ticketService.list(req.query, req.user);
  sendPaginated(res, data, pagination);
});

export const getTicket = asyncHandler(async (req, res) => {
  const result = await ticketService.getById(req.params.id, req.user);
  sendSuccess(res, result);
});

export const updateTicket = asyncHandler(async (req, res) => {
  const result = await ticketService.update(req.params.id, req.body, req.user, req);
  sendSuccess(res, result, 'Ticket updated');
});

export const assignWorkers = asyncHandler(async (req, res) => {
  const ticket = await ticketService.assignWorkers(
    req.params.id,
    req.body.workerIds,
    req.user,
    req,
    req.body
  );
  sendSuccess(res, ticket, 'Workers assigned');
});

export const updateTicketStatus = asyncHandler(async (req, res) => {
  const ticket = await ticketService.updateStatus(
    req.params.id,
    req.body.status,
    req.user,
    req.body.note,
    req
  );
  sendSuccess(res, ticket);
});

export const schoolConfirm = asyncHandler(async (req, res) => {
  const ticket = await ticketService.schoolConfirm(
    req.params.id,
    req.body.confirmed,
    req.user,
    req
  );
  sendSuccess(res, ticket);
});

export const rateTicket = asyncHandler(async (req, res) => {
  const ticket = await ticketService.rate(
    req.params.id,
    req.body.score,
    req.body.comment,
    req.user,
    req
  );
  sendSuccess(res, ticket);
});

export const addComment = asyncHandler(async (req, res) => {
  const ticket = await ticketService.addComment(req.params.id, req.body.text, req.user, req);
  sendSuccess(res, ticket);
});

export const uploadTicketImages = asyncHandler(async (req, res) => {
  const { phase = 'before' } = req.body;
  const files = req.files || [];
  if (!files.length) {
    const { AppError } = await import('../utils/AppError.js');
    throw new AppError('No files provided', 400);
  }
  const uploaded = await uploadMultipleFiles(files, req.user._id);

  const { ticketRepository } = await import('../repositories/index.js');
  const ticket = await ticketRepository.findById(req.params.id);
  if (!ticket.attachments) ticket.attachments = { before: [], during: [], after: [] };
  ticket.attachments[phase] = [...(ticket.attachments[phase] || []), ...uploaded];
  await ticket.save();

  const populated = await ticketRepository.findById(req.params.id, ticketRepository.defaultPopulate);
  sendSuccess(res, populated, 'Images uploaded');
});

export const acceptTask = asyncHandler(async (req, res) => {
  const task = await taskService.acceptTask(req.params.taskId, req.user, req);
  sendSuccess(res, task);
});

export const rejectTask = asyncHandler(async (req, res) => {
  const task = await taskService.rejectTask(req.params.taskId, req.body.note, req.user, req);
  sendSuccess(res, task);
});

export const startTask = asyncHandler(async (req, res) => {
  const task = await taskService.startTask(req.params.taskId, req.user, req);
  sendSuccess(res, task);
});

export const completeTask = asyncHandler(async (req, res) => {
  const task = await taskService.completeTask(req.params.taskId, req.body, req.user, req);
  sendSuccess(res, task);
});

export const reviewTask = asyncHandler(async (req, res) => {
  const task = await taskService.reviewTask(
    req.params.taskId,
    req.body.action,
    req.body.note,
    req.user,
    req
  );
  sendSuccess(res, task);
});

export const getMyTasks = asyncHandler(async (req, res) => {
  if (!req.user.workerProfile) {
    return sendSuccess(res, []);
  }
  const workerId = req.user.workerProfile?._id || req.user.workerProfile;
  const tasks = await taskService.getMyTasks(workerId, req.query);
  sendSuccess(res, tasks);
});

export const getTask = asyncHandler(async (req, res) => {
  const task = await taskService.getTaskById(req.params.taskId, req.user);
  sendSuccess(res, task);
});

export const uploadTaskImages = asyncHandler(async (req, res) => {
  const { phase = 'before' } = req.body;
  const files = req.files || [];
  const uploaded = await uploadMultipleFiles(files, req.user._id);
  const task = await taskService.uploadTaskImages(
    req.params.taskId,
    phase,
    uploaded,
    req.user,
    req
  );
  sendSuccess(res, task, 'Images uploaded');
});

export const updateTaskNotes = asyncHandler(async (req, res) => {
  const task = await taskService.updateTaskNotes(
    req.params.taskId,
    req.body.notes,
    req.user,
    req
  );
  sendSuccess(res, task);
});

export const generateReport = asyncHandler(async (req, res) => {
  const lang = req.query.lang === 'ar' ? 'ar' : 'en';
  const report = await reportService.generateTicketReport(req.params.id, {
    lang,
    generatedBy: req.user._id,
  });
  sendSuccess(res, report, lang === 'ar' ? 'تم توليد التقرير' : 'Report generated');
});

export const getReport = asyncHandler(async (req, res) => {
  const report = await reportService.getReportByTicket(req.params.id);
  if (!report) {
    return sendSuccess(res, null, 'No report yet');
  }
  sendSuccess(res, report);
});
