import mongoose from 'mongoose';

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    region: { type: mongoose.Schema.Types.ObjectId, ref: 'Region', required: true },
    address: { type: String, trim: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    phone: { type: String, trim: true },
    maintenanceTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceTeam' },
    adminUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

schoolSchema.index({ region: 1, code: 1 });
schoolSchema.index({ maintenanceTeam: 1 });
schoolSchema.index({ location: '2dsphere' });
schoolSchema.index({ name: 'text', code: 'text' });

const School = mongoose.model('School', schoolSchema);
export default School;
