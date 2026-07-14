import teamLeaderService from '../services/teamLeaderService.js';
import { sendSuccess, sendCreated } from '../utils/responseHelper.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const leaders = await teamLeaderService.list(req.query);
  sendSuccess(res, leaders);
});

export const get = asyncHandler(async (req, res) => {
  const leader = await teamLeaderService.getById(req.params.id);
  sendSuccess(res, leader);
});

export const create = asyncHandler(async (req, res) => {
  const leader = await teamLeaderService.create(req.body, req.user, req);
  sendCreated(res, leader);
});

export const update = asyncHandler(async (req, res) => {
  const leader = await teamLeaderService.update(req.params.id, req.body, req.user, req);
  sendSuccess(res, leader);
});

export const assignTeams = asyncHandler(async (req, res) => {
  const leader = await teamLeaderService.assignTeams(req.params.id, req.body.teamIds, {
    actor: req.user,
    req,
  });
  sendSuccess(res, leader, 'Teams assigned');
});
