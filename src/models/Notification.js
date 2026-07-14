import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
    isRead: { type: Boolean, default: false },
    channels: [{ type: String, enum: ['socket', 'email', 'push'] }],
    readAt: Date,
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
