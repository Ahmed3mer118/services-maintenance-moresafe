import { schoolRepository, userRepository } from '../repositories/index.js';
import { ROLES } from '../constants/roles.js';
import { ConflictError, NotFoundError } from '../utils/AppError.js';
import auditService from './auditService.js';

class SchoolService {
  async create(data, actor, req) {
    const existing = await userRepository.findByEmail(data.adminEmail);
    if (existing) throw new ConflictError('Email already in use');

    const {
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      ...schoolData
    } = data;

    const school = await schoolRepository.create(schoolData);

    const adminUser = await userRepository.create({
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      firstName: adminFirstName,
      lastName: adminLastName,
      roles: [ROLES.SCHOOL_ADMIN],
      school: school._id,
      region: school.region,
      isActive: true,
    });

    school.adminUsers = [adminUser._id];
    await school.save();

    await auditService.log({
      user: actor._id,
      action: 'CREATE',
      entityType: 'School',
      entityId: school._id,
      changes: { code: school.code, adminEmail },
      req,
    });

    return schoolRepository.findById(school._id, ['region', 'maintenanceTeam']);
  }

  async update(id, data, actor, req) {
    const school = await schoolRepository.findById(id);
    if (!school) throw new NotFoundError('School');

    const { adminEmail, adminPassword, adminFirstName, adminLastName, ...schoolData } = data;

    Object.assign(school, schoolData);
    await school.save();

    if (school.adminUsers?.length && (adminEmail || adminPassword || adminFirstName || adminLastName)) {
      const adminId = school.adminUsers[0];
      const admin = await userRepository.findById(adminId);
      if (admin) {
        if (adminEmail && adminEmail.toLowerCase() !== admin.email) {
          const dup = await userRepository.findByEmail(adminEmail);
          if (dup && dup._id.toString() !== admin._id.toString()) {
            throw new ConflictError('Email already in use');
          }
          admin.email = adminEmail.toLowerCase();
        }
        if (adminPassword) admin.password = adminPassword;
        if (adminFirstName) admin.firstName = adminFirstName;
        if (adminLastName) admin.lastName = adminLastName;
        await admin.save();
      }
    }

    await auditService.log({
      user: actor._id,
      action: 'UPDATE',
      entityType: 'School',
      entityId: id,
      changes: data,
      req,
    });

    return schoolRepository.findById(id, ['region', 'maintenanceTeam']);
  }
}

export default new SchoolService();
