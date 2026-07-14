import mongoose from 'mongoose';

const mediaRefSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: String,
    filename: String,
    mimeType: String,
    size: Number,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    note: String,
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ratingSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 1, max: 5 },
    comment: String,
    ratedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    region: { type: mongoose.Schema.Types.ObjectId, ref: 'Region', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceTeam' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceCategory', required: true },
    subcategory: {
      id: mongoose.Schema.Types.ObjectId,
      name: String,
      key: String,
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    status: { type: String, default: 'new', index: true },
    assignedWorkers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }],
    sla: { type: mongoose.Schema.Types.ObjectId, ref: 'SLA' },
    slaDeadline: Date,
    slaBreached: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    closedAt: Date,
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: ratingSchema,
    attachments: {
      before: [mediaRefSchema],
      during: [mediaRefSchema],
      after: [mediaRefSchema],
    },
    videos: [mediaRefSchema],
    scheduledVisit: Date,
    leaderNotes: String,
    schoolConfirmed: { type: Boolean, default: false },
    statusHistory: [statusHistorySchema],
    comments: [commentSchema],
    totalCost: { type: Number, default: 0 },
    totalWorkingHours: { type: Number, default: 0 },
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    approvedAt: Date,
    schoolNote: String,
    workReport: {
      rootCause: String,
      inspectionDetails: String,
      diagnosticResult: String,
      correctiveActions: String,
      preventiveRecommendation: String,
    },
    costs: {
      laborCost: { type: Number, default: 0 },
      transportationCost: { type: Number, default: 0 },
      additionalCost: { type: Number, default: 0 },
    },
    checklist: {
      electricalTest: { type: Boolean, default: false },
      safetyInspection: { type: Boolean, default: false },
      areaCleaned: { type: Boolean, default: false },
      equipmentTested: { type: Boolean, default: false },
      customerConfirmed: { type: Boolean, default: false },
      photosUploaded: { type: Boolean, default: false },
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ticketSchema.index({ region: 1, status: 1, createdAt: -1 });
ticketSchema.index({ team: 1, status: 1 });
ticketSchema.index({ school: 1, createdAt: -1 });
ticketSchema.index({ title: 'text', description: 'text', ticketNumber: 'text' });
ticketSchema.index({ slaDeadline: 1, slaBreached: 1 });

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
