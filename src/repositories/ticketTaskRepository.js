import BaseRepository from './BaseRepository.js';
import { TicketTask } from '../models/index.js';

class TicketTaskRepository extends BaseRepository {
  constructor() {
    super(TicketTask);
  }

  async findByTicket(ticketId) {
    return TicketTask.find({ ticket: ticketId })
      .populate('worker', 'employeeId rating')
      .populate('specialty', 'key name icon color')
      .populate({
        path: 'worker',
        populate: { path: 'user', select: 'firstName lastName phone' },
      });
  }

  async findByWorker(workerId, filter = {}) {
    return TicketTask.find({ worker: workerId, ...filter })
      .sort('-updatedAt')
      .populate('specialty', 'key name icon color')
      .populate({
        path: 'ticket',
        select: 'ticketNumber title status priority school scheduledVisit createdAt',
        populate: { path: 'school', select: 'name address phone' },
      });
  }

  async findByIdDetailed(id) {
    return TicketTask.findById(id)
      .populate('specialty', 'key name icon color')
      .populate({
        path: 'ticket',
        select: 'ticketNumber title status priority description school category subcategory scheduledVisit createdAt attachments',
        populate: [
          { path: 'school', select: 'name address phone' },
          { path: 'category', select: 'name key' },
        ],
      })
      .populate({ path: 'worker', populate: { path: 'user', select: 'firstName lastName' }, select: 'employeeId user' });
  }
}

export default new TicketTaskRepository();
