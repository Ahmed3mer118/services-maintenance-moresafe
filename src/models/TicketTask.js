import mongoose from 'mongoose';

const mediaRefSchema = new mongoose.Schema(
  {
    url: String,
    publicId: String,
    filename: String,
    mimeType: String,
    size: Number,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const materialUsedSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
    name: String,
    quantity: { type: Number, default: 0 },
    unitCost: { type: Number, default: 0 },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    note: String,
  },
  { _id: false }
);

const ticketTaskSchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    specialty: { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty', required: true },
    status: { type: String, default: 'not_started', index: true },
    notes: String,
    beforeImages: [mediaRefSchema],
    duringImages: [mediaRefSchema],
    afterImages: [mediaRefSchema],
    materialsUsed: [materialUsedSchema],
    workingHours: { type: Number, default: 0 },
    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote: String,
    statusHistory: [statusHistorySchema],
  },
  { timestamps: true }
);

ticketTaskSchema.index({ ticket: 1, worker: 1 }, { unique: true });
ticketTaskSchema.index({ worker: 1, status: 1 });

const TicketTask = mongoose.model('TicketTask', ticketTaskSchema);
export default TicketTask;
