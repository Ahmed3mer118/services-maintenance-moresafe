import mongoose from 'mongoose';

const workerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    specialty: { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceTeam' },
    employeeId: { type: String, required: true, unique: true, trim: true },
    skills: [{ type: String }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalTasksCompleted: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

workerSchema.index({ team: 1, specialty: 1 });
workerSchema.index({ isAvailable: 1, isActive: 1 });

const Worker = mongoose.model('Worker', workerSchema);
export default Worker;
