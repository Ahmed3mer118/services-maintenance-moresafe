import { schoolRepository, userRepository } from '../repositories/index.js';
import { ROLES } from '../constants/roles.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/AppError.js';
import auditService from './auditService.js';

const schoolPopulate = [
  'region',
  'maintenanceTeam',
  { path: 'adminUsers', select: 'firstName lastName email phone isActive' },
];

class SchoolService {
  async createAdminUser(school, { adminEmail, adminPassword, adminFirstName, adminLastName }) {
    if (!adminEmail || !adminPassword || !adminFirstName || !adminLastName) {
      throw new ValidationError('Admin name, email, and password are required');
    }

    const existing = await userRepository.findByEmail(adminEmail);
    if (existing) throw new ConflictError('Email already in use');

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

    return adminUser;
  }

  async create(data, actor, req) {
    const {
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      ...schoolData
    } = data;

    const school = await schoolRepository.create(schoolData);

    try {
      await this.createAdminUser(school, {
        adminEmail,
        adminPassword,
        adminFirstName,
        adminLastName,
      });
    } catch (err) {
      await schoolRepository.deleteById(school._id);
      throw err;
    }

    await auditService.log({
      user: actor._id,
      action: 'CREATE',
      entityType: 'School',
      entityId: school._id,
      changes: { code: school.code, adminEmail },
      req,
    });

    return schoolRepository.findById(school._id, schoolPopulate);
  }

  async updateAdminUser(school, { adminEmail, adminPassword, adminFirstName, adminLastName }) {
    const adminId = school.adminUsers[0];
    const admin = await userRepository.findById(adminId);
    if (!admin) {
      school.adminUsers = [];
      await school.save();
      return this.createAdminUser(school, {
        adminEmail,
        adminPassword,
        adminFirstName,
        adminLastName,
      });
    }

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
    return admin;
  }

  async update(id, data, actor, req) {
    const school = await schoolRepository.findById(id);
    if (!school) throw new NotFoundError('School');

    const { adminEmail, adminPassword, adminFirstName, adminLastName, ...schoolData } = data;

    Object.assign(school, schoolData);
    await school.save();

    const hasAdminFields = adminEmail || adminPassword || adminFirstName || adminLastName;
    if (hasAdminFields) {
      if (school.adminUsers?.length) {
        await this.updateAdminUser(school, {
          adminEmail,
          adminPassword,
          adminFirstName,
          adminLastName,
        });
      } else {
        await this.createAdminUser(school, {
          adminEmail,
          adminPassword,
          adminFirstName,
          adminLastName,
        });
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

    return schoolRepository.findById(id, schoolPopulate);
  }
}

export default new SchoolService();
