import mongoose from 'mongoose';
import { MATERIAL_REQUEST_STATUS } from '../constants/statuses.js';

const requestItemSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    quantityRequested: { type: Number, required: true, min: 1 },
    quantityApproved: { type: Number, default: 0, min: 0 },
    warehouseNote: String,
  },
  { _id: false }
);

const materialRequestSchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    ticketTask: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketTask' },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    items: [requestItemSchema],
    status: {
      type: String,
      enum: Object.values(MATERIAL_REQUEST_STATUS),
      default: MATERIAL_REQUEST_STATUS.PENDING,
    },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
    warehouseNotes: String,
    rejectionReason: String,
    approvedAt: Date,
    rejectedAt: Date,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

materialRequestSchema.index({ ticket: 1, status: 1 });
materialRequestSchema.index({ worker: 1, status: 1 });

const MaterialRequest = mongoose.model('MaterialRequest', materialRequestSchema);
export default MaterialRequest;
