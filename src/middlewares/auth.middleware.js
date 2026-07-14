import { verifyAccessToken } from '../config/jwt.js';
import { userRepository } from '../repositories/index.js';
import { AuthenticationError, AuthorizationError } from '../utils/AppError.js';
import { getPermissionsForRoles } from '../constants/permissions.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Access token required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await userRepository.findById(decoded.id);
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Always resolve permissions from current roles (JWT may be stale after permission changes)
    const permissions = [
      ...getPermissionsForRoles(user.roles),
      ...(user.permissions || []),
    ];

    req.user = {
      _id: user._id,
      id: user._id,
      email: user.email,
      roles: user.roles,
      permissions: [...new Set(permissions)],
      region: user.region,
      school: user.school,
      workerProfile: user.workerProfile,
    };
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Invalid or expired token'));
    }
    next(err);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    await authenticate(req, res, next);
  } catch {
    next();
  }
};

export default authenticate;
