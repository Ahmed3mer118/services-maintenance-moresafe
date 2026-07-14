import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema(
  {
    item: { type: String, required: true },
    required: { type: Boolean, default: true },
  },
  { _id: true }
);

const preventiveMaintenanceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceCategory' },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      required: true,
    },
    nextDueDate: { type: Date, required: true },
    assignedTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceTeam' },
    checklist: [checklistItemSchema],
    lastGeneratedTicket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

preventiveMaintenanceSchema.index({ nextDueDate: 1, isActive: 1 });

const PreventiveMaintenance = mongoose.model('PreventiveMaintenance', preventiveMaintenanceSchema);
export default PreventiveMaintenance;
