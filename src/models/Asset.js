import mongoose from 'mongoose';

const maintenanceHistorySchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    date: { type: Date, default: Date.now },
    notes: String,
  },
  { _id: true }
);

const assetSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    serialNumber: { type: String, required: true, unique: true, trim: true },
    code: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    assetType: { type: String, trim: true },
    manufacturer: { type: String, trim: true },
    location: { type: String, trim: true },
    installDate: Date,
    maintenanceHistory: [maintenanceHistorySchema],
    warrantyExpiry: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

assetSchema.index({ school: 1 });

const Asset = mongoose.model('Asset', assetSchema);
export default Asset;
