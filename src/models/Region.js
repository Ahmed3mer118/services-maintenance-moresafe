import mongoose from 'mongoose';

const regionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

regionSchema.index({ name: 1 });
regionSchema.index({ isDeleted: 1, isActive: 1 });

const Region = mongoose.model('Region', regionSchema);
export default Region;
