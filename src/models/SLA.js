import mongoose from 'mongoose';
import { PRIORITY } from '../constants/statuses.js';

const slaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    priority: { type: String, enum: Object.values(PRIORITY), required: true },
    region: { type: mongoose.Schema.Types.ObjectId, ref: 'Region', required: true },
    responseTimeHours: { type: Number, required: true, min: 1 },
    resolutionTimeHours: { type: Number, required: true, min: 1 },
    escalationRules: [
      {
        afterHours: Number,
        notifyRoles: [String],
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

slaSchema.index({ region: 1, priority: 1 }, { unique: true });

const SLA = mongoose.model('SLA', slaSchema);
export default SLA;
