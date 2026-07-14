import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../config/jwt.js';
import { userRepository } from '../repositories/index.js';
import { getPermissionsForRoles } from '../constants/permissions.js';
import { AuthenticationError, ConflictError, NotFoundError } from '../utils/AppError.js';
import auditService from './auditService.js';

class AuthService {
  async register(data, req) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new ConflictError('Email already registered');

    const user = await userRepository.create(data);
    await auditService.log({
      user: user._id,
      action: 'CREATE',
      entityType: 'User',
      entityId: user._id,
      req,
    });
    return this.generateTokens(user);
  }

  async login(email, password, req) {
    const user = await userRepository.findByEmailWithProfile(email);
    if (!user || !user.isActive) throw new AuthenticationError('Invalid credentials');

    const valid = await user.comparePassword(password);
    if (!valid) throw new AuthenticationError('Invalid credentials');

    user.lastLogin = new Date();
    await user.save();

    await auditService.log({
      user: user._id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user._id,
      req,
    });

    return this.generateTokens(user);
  }

  async refresh(refreshToken) {
    if (!refreshToken) throw new AuthenticationError('Refresh token required');

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new AuthenticationError('Invalid refresh token');
    }

    const user = await userRepository.findById(decoded.id);
    if (!user || !user.isActive) throw new AuthenticationError('User not found');

    return this.generateTokens(user);
  }

  async logout(userId, req) {
    await userRepository.updateById(userId, { refreshToken: null });
    await auditService.log({
      user: userId,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: userId,
      req,
    });
  }

  async getProfile(userId) {
    const user = await userRepository.findById(userId, [
      { path: 'region', select: 'name code' },
      { path: 'school', select: 'name code' },
      { path: 'workerProfile', populate: { path: 'specialty team' } },
    ]);
    if (!user) throw new NotFoundError('User');
    return user;
  }

  generateTokens(user) {
    const permissions = [
      ...getPermissionsForRoles(user.roles),
      ...(user.permissions || []),
    ];
    const payload = {
      id: user._id,
      email: user.email,
      roles: user.roles,
      permissions: [...new Set(permissions)],
      region: user.region,
      school: user.school,
      workerProfile: user.workerProfile,
    };

    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions: payload.permissions,
        region: user.region,
        school: user.school,
        workerProfile: user.workerProfile,
      },
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken({ id: user._id }),
    };
  }
}

export default new AuthService();
