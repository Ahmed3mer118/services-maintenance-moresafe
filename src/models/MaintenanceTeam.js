import mongoose from 'mongoose';

const maintenanceTeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    region: { type: mongoose.Schema.Types.ObjectId, ref: 'Region', required: true },
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }],
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

maintenanceTeamSchema.index({ region: 1 });
maintenanceTeamSchema.index({ leader: 1 });

const MaintenanceTeam = mongoose.model('MaintenanceTeam', maintenanceTeamSchema);
export default MaintenanceTeam;
