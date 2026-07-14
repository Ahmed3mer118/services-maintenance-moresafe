import authService from '../services/authService.js';
import { sendSuccess, sendCreated } from '../utils/responseHelper.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password, req);
  sendSuccess(res, result, 'Login successful');
});

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, req);
  sendCreated(res, result, 'Registration successful');
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  const result = await authService.refresh(token);
  sendSuccess(res, result);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id, req);
  sendSuccess(res, null, 'Logged out');
});

export const getProfile = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user._id);
  sendSuccess(res, user);
});
