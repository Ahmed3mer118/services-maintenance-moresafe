import auditService from './auditService.js';
import { AuditLog } from '../models/index.js';

class AuditService {
  async log({ user, action, entityType, entityId, changes, req }) {
    try {
      await AuditLog.create({
        user: user?._id || user,
        action,
        entityType,
        entityId,
        changes,
        ip: req?.ip || req?.headers?.['x-forwarded-for'],
        userAgent: req?.headers?.['user-agent'],
      });
    } catch (err) {
      console.error('Audit log failed:', err.message);
    }
  }

  async getLogs(filter, options) {
    const { skip, limit, sort } = options;
    const [data, total] = await Promise.all([
      AuditLog.find(filter).skip(skip).limit(limit).sort(sort).populate('user', 'firstName lastName email'),
      AuditLog.countDocuments(filter),
    ]);
    return { data, total };
  }
}

export default new AuditService();
