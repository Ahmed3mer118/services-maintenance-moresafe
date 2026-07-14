import mongoose from 'mongoose';

const subcategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const maintenanceCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    icon: { type: String, default: 'folder' },
    color: { type: String, default: '#6366F1' },
    subcategories: [subcategorySchema],
    requiredSpecialties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Specialty' }],
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const MaintenanceCategory = mongoose.model('MaintenanceCategory', maintenanceCategorySchema);
export default MaintenanceCategory;
