export { default as ticketRepository } from './ticketRepository.js';
export { default as ticketTaskRepository } from './ticketTaskRepository.js';
export { default as userRepository } from './userRepository.js';
export { default as workerRepository } from './workerRepository.js';
export { BaseRepository } from './BaseRepository.js';

import { Region, School, MaintenanceTeam, MaintenanceCategory, InventoryItem, MaterialRequest, AuditLog, Notification, SLA, Asset, PreventiveMaintenance, Report } from '../models/index.js';
import BaseRepository from './BaseRepository.js';

export const regionRepository = new BaseRepository(Region);
export const schoolRepository = new BaseRepository(School);
export const teamRepository = new BaseRepository(MaintenanceTeam);
export const categoryRepository = new BaseRepository(MaintenanceCategory);
export const inventoryRepository = new BaseRepository(InventoryItem);
export const materialRequestRepository = new BaseRepository(MaterialRequest);
export const auditRepository = new BaseRepository(AuditLog);
export const notificationRepository = new BaseRepository(Notification);
export const slaRepository = new BaseRepository(SLA);
export const assetRepository = new BaseRepository(Asset);
export const preventiveRepository = new BaseRepository(PreventiveMaintenance);
export const reportRepository = new BaseRepository(Report);
