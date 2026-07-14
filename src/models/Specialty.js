import mongoose from 'mongoose';

const specialtySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, trim: true },
    icon: { type: String, default: 'wrench' },
    color: { type: String, default: '#3B82F6' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Specialty = mongoose.model('Specialty', specialtySchema);
export default Specialty;
