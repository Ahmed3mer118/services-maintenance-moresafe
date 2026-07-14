import BaseRepository from './BaseRepository.js';
import { Ticket } from '../models/index.js';

class TicketRepository extends BaseRepository {
  constructor() {
    super(Ticket);
  }

  get defaultPopulate() {
    return [
      { path: 'school', select: 'name code address phone' },
      { path: 'region', select: 'name code' },
      { path: 'team', select: 'name code' },
      { path: 'category', select: 'name key icon color' },
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'assignedWorkers', populate: { path: 'user specialty', select: 'firstName lastName key name' } },
      { path: 'sla' },
    ];
  }

  async findWithFilters(filter, options) {
    const { skip, limit, sort } = options;
    return Ticket.find(filter)
      .skip(skip)
      .limit(limit)
      .sort(sort)
      .populate(this.defaultPopulate);
  }

  async findByTicketNumber(ticketNumber) {
    return Ticket.findOne({ ticketNumber }).populate(this.defaultPopulate);
  }
}

export default new TicketRepository();
