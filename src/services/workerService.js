import { workerRepository, userRepository } from '../repositories/index.js';
import { Worker, MaintenanceTeam } from '../models/index.js';
import { ROLES } from '../constants/roles.js';
import { ConflictError, NotFoundError } from '../utils/AppError.js';
import auditService from './auditService.js';

async function generateEmployeeId() {
  const count = await Worker.countDocuments();
  return `EMP-${String(count + 1).padStart(4, '0')}`;
}

class WorkerService {
  async create(data, actor, req) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new ConflictError('Email already in use');

    const employeeId = await generateEmployeeId();

    const user = await userRepository.create({
      email: data.email.toLowerCase(),
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || '',
      roles: [ROLES.WORKER],
      isActive: true,
    });

    const worker = await workerRepository.create({
      user: user._id,
      employeeId,
      specialty: data.specialty,
      team: data.team || undefined,
      isActive: true,
      isAvailable: true,
    });

    user.workerProfile = worker._id;
    await user.save();

    if (data.team) {
      await MaintenanceTeam.findByIdAndUpdate(data.team, {
        $addToSet: { members: worker._id },
      });
    }

    await auditService.log({
      user: actor._id,
      action: 'CREATE',
      entityType: 'Worker',
      entityId: worker._id,
      changes: { employeeId, email: data.email },
      req,
    });

    return workerRepository.findById(worker._id, [
      { path: 'user', select: 'firstName lastName email phone' },
      'specialty',
      'team',
    ]);
  }

  async update(id, data, actor, req) {
    const worker = await workerRepository.findById(id);
    if (!worker) throw new NotFoundError('Worker');

    const { employeeId, ...updateData } = data;
    Object.assign(worker, updateData);
    await worker.save();

    await auditService.log({
      user: actor._id,
      action: 'UPDATE',
      entityType: 'Worker',
      entityId: id,
      changes: updateData,
      req,
    });

    return workerRepository.findById(id, [
      { path: 'user', select: 'firstName lastName email phone' },
      'specialty',
      'team',
    ]);
  }
}

export default new WorkerService();
