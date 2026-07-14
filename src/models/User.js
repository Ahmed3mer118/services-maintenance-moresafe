import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../constants/roles.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    roles: {
      type: [String],
      enum: Object.values(ROLES),
      default: [ROLES.WORKER],
    },
    permissions: [{ type: String }],
    region: { type: mongoose.Schema.Types.ObjectId, ref: 'Region' },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    workerProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
    refreshToken: { type: String, select: false },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ region: 1 });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.getFullName = function getFullName() {
  return `${this.firstName} ${this.lastName}`;
};

userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.refreshToken;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);
export default User;
