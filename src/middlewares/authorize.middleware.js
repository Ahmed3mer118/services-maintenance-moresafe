import { AuthorizationError } from '../utils/AppError.js';
import { ROLES } from '../constants/roles.js';

export const authorize = (...requiredPermissions) => (req, res, next) => {
  if (!req.user) return next(new AuthorizationError());

  if (req.user.roles.includes(ROLES.SUPER_ADMIN)) {
    return next();
  }

  const hasPermission = requiredPermissions.some((p) =>
    req.user.permissions.includes(p)
  );

  if (!hasPermission) {
    return next(new AuthorizationError(`Required: ${requiredPermissions.join(' or ')}`));
  }
  next();
};

export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AuthorizationError());

  if (req.user.roles.includes(ROLES.SUPER_ADMIN)) {
    return next();
  }

  const hasRole = roles.some((r) => req.user.roles.includes(r));
  if (!hasRole) {
    return next(new AuthorizationError());
  }
  next();
};

export default authorize;
