import { notificationRepository } from '../repositories/index.js';
import logger from '../utils/logger.js';

let ioInstance = null;

export function setSocketIO(io) {
  ioInstance = io;
}

class NotificationService {
  async create({ userId, type, title, message, entityType, entityId, channels = ['socket'] }) {
    const notification = await notificationRepository.create({
      user: userId,
      type,
      title,
      message,
      entityType,
      entityId,
      channels,
    });

    if (channels.includes('socket') && ioInstance) {
      ioInstance.to(`user:${userId}`).emit('notification', notification);
    }

    if (channels.includes('email')) {
      this.sendEmail(userId, title, message).catch((e) => logger.error('Email notification failed', e));
    }

    return notification;
  }

  async notifyMany(userIds, payload) {
    return Promise.all(userIds.map((userId) => this.create({ ...payload, userId })));
  }

  async notifyUsersByRoles(roles, payload, { region = null } = {}) {
    const { User } = await import('../models/index.js');
    const roleList = Array.isArray(roles) ? roles : [roles];
    const filter = { isActive: true, roles: { $in: roleList } };
    if (region) filter.region = region;
    const users = await User.find(filter).select('_id');
    if (users.length) {
      await this.notifyMany(
        users.map((u) => u._id),
        payload
      );
    }
  }

  async markAsRead(id, userId) {
    return notificationRepository.updateById(id, { isRead: true, readAt: new Date() });
  }

  async markAllAsRead(userId) {
    const { Notification } = await import('../models/index.js');
    return Notification.updateMany({ user: userId, isRead: false }, { isRead: true, readAt: new Date() });
  }

  async getUserNotifications(userId, options) {
    const { skip, limit } = options;
    const filter = { user: userId };
    const [data, total, unreadCount] = await Promise.all([
      notificationRepository.findAll(filter, { skip, limit, sort: { createdAt: -1 } }),
      notificationRepository.count(filter),
      notificationRepository.count({ ...filter, isRead: false }),
    ]);
    return { data, total, unreadCount };
  }

  async sendEmail(userId, subject, body) {
    const nodemailer = await import('nodemailer');
    if (!process.env.SMTP_HOST) return;

    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const { User } = await import('../models/index.js');
    const user = await User.findById(userId);
    if (!user?.email) return;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject,
      text: body,
      html: `<p>${body}</p>`,
    });
  }
}

export default new NotificationService();
