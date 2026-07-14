import Joi from 'joi';
import { ValidationError } from '../utils/AppError.js';

export const validate = (schema, property = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[property], {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    const errors = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    return next(new ValidationError('Validation failed', errors));
  }
  req[property] = value;
  next();
};

export const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ID');

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().default('-createdAt'),
  search: Joi.string().allow(''),
  status: Joi.string().allow(''),
  priority: Joi.string().allow(''),
  region: objectId.allow(''),
  team: objectId.allow(''),
  school: objectId.allow(''),
  category: Joi.string().allow(''),
  specialty: objectId.allow(''),
  isActive: Joi.boolean(),
});

export const ticketUpdateSchema = Joi.object({
  title: Joi.string().min(3),
  description: Joi.string().min(10),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  status: Joi.string(),
  leaderNotes: Joi.string().allow(''),
  scheduledVisit: Joi.date().allow(null),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phone: Joi.string().allow(''),
  roles: Joi.array().items(Joi.string()),
});

export const regionSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().required(),
  description: Joi.string().allow(''),
  isActive: Joi.boolean().truthy('true', '1').falsy('false', '0', ''),
});

export const regionUpdateSchema = Joi.object({
  name: Joi.string(),
  code: Joi.string(),
  description: Joi.string().allow(''),
  isActive: Joi.boolean().truthy('true', '1').falsy('false', '0', ''),
}).min(1);

export const schoolUpdateSchema = Joi.object({
  name: Joi.string(),
  code: Joi.string(),
  region: objectId,
  address: Joi.string().allow(''),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  phone: Joi.string().allow(''),
  maintenanceTeam: objectId.allow(null, ''),
  isActive: Joi.boolean().truthy('true', '1').falsy('false', '0', ''),
  adminEmail: Joi.string().email(),
  adminPassword: Joi.string().min(6),
  adminFirstName: Joi.string(),
  adminLastName: Joi.string(),
}).min(1);

export const teamUpdateSchema = Joi.object({
  name: Joi.string(),
  code: Joi.string(),
  region: objectId,
  leader: objectId.allow(null, ''),
  members: Joi.array().items(objectId),
  isActive: Joi.boolean().truthy('true', '1').falsy('false', '0', ''),
}).min(1);

export const categoryUpdateSchema = Joi.object({
  name: Joi.string(),
  key: Joi.string(),
  icon: Joi.string(),
  color: Joi.string(),
  requiredSpecialties: Joi.array().items(objectId),
  subcategories: Joi.array().items(
    Joi.object({
      _id: objectId,
      name: Joi.string().required(),
      key: Joi.string().required(),
    })
  ),
  isActive: Joi.boolean().truthy('true', '1').falsy('false', '0', ''),
}).min(1);

export const schoolSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().required(),
  region: objectId.required(),
  address: Joi.string().allow(''),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  phone: Joi.string().allow(''),
  maintenanceTeam: objectId,
  isActive: Joi.boolean().truthy('true', '1').falsy('false', '0', ''),
  adminEmail: Joi.string().email(),
  adminPassword: Joi.string().min(6),
  adminFirstName: Joi.string(),
  adminLastName: Joi.string(),
});

export const schoolCreateSchema = schoolSchema.keys({
  adminEmail: Joi.string().email().required(),
  adminPassword: Joi.string().min(6).required(),
  adminFirstName: Joi.string().required(),
  adminLastName: Joi.string().required(),
});

export const workerCreateSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phone: Joi.string().allow(''),
  specialty: objectId.required(),
  team: objectId.allow(null, ''),
});

export const teamSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().required(),
  region: objectId.required(),
  leader: objectId,
  members: Joi.array().items(objectId),
  isActive: Joi.boolean().truthy('true', '1').falsy('false', '0', ''),
});

export const workerSchema = Joi.object({
  user: objectId.required(),
  specialty: objectId.required(),
  team: objectId,
  employeeId: Joi.string().required(),
  skills: Joi.array().items(Joi.string()),
});

export const workerUpdateSchema = Joi.object({
  specialty: objectId,
  team: objectId.allow(null, ''),
  employeeId: Joi.string(),
  skills: Joi.array().items(Joi.string()),
  isActive: Joi.boolean().truthy('true', '1').falsy('false', '0', ''),
  isAvailable: Joi.boolean().truthy('true', '1').falsy('false', '0', ''),
}).min(1);

export const categorySchema = Joi.object({
  name: Joi.string().required(),
  key: Joi.string().required(),
  icon: Joi.string(),
  color: Joi.string(),
  requiredSpecialties: Joi.array().items(objectId),
  subcategories: Joi.array().items(
    Joi.object({
      _id: objectId,
      name: Joi.string().required(),
      key: Joi.string().required(),
    })
  ),
});

export const ticketCreateSchema = Joi.object({
  school: objectId.required(),
  category: objectId.required(),
  subcategoryId: objectId.required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  title: Joi.string().required().max(200),
  description: Joi.string().required(),
  attachments: Joi.object({
    before: Joi.array(),
    during: Joi.array(),
    after: Joi.array(),
  }),
});

export const ticketAssignSchema = Joi.object({
  workerIds: Joi.array().items(objectId).min(1).required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  scheduledVisit: Joi.date(),
  leaderNotes: Joi.string().allow(''),
});

export const ticketStatusSchema = Joi.object({
  status: Joi.string().required(),
  note: Joi.string().allow(''),
});

export const taskCompleteSchema = Joi.object({
  notes: Joi.string().allow(''),
  workingHours: Joi.number().min(0),
  beforeImages: Joi.array(),
  duringImages: Joi.array(),
  afterImages: Joi.array(),
});

export const materialRequestSchema = Joi.object({
  ticket: objectId.required(),
  ticketTask: objectId,
  worker: objectId,
  items: Joi.array()
    .items(
      Joi.object({
        item: objectId.required(),
        quantityRequested: Joi.number().min(1).required(),
      })
    )
    .min(1)
    .required(),
  notes: Joi.string().allow(''),
});

export const materialRequestApproveSchema = Joi.object({
  approvals: Joi.array()
    .items(
      Joi.object({
        itemId: objectId.required(),
        quantityApproved: Joi.number().min(0).required(),
        note: Joi.string().allow(''),
      })
    )
    .min(1)
    .required(),
  warehouseNotes: Joi.string().allow(''),
});

export const materialRequestRejectSchema = Joi.object({
  reason: Joi.string().trim().min(3).required(),
});

export const inventoryItemSchema = Joi.object({
  sku: Joi.string().required(),
  name: Joi.string().required(),
  category: Joi.string().allow(''),
  unit: Joi.string().default('pcs'),
  quantity: Joi.number().min(0).default(0),
  minStock: Joi.number().min(0).default(0),
  unitCost: Joi.number().min(0).default(0),
  region: objectId.required(),
});

export const ratingSchema = Joi.object({
  score: Joi.number().min(1).max(5).required(),
  comment: Joi.string().allow(''),
});

export const slaSchema = Joi.object({
  name: Joi.string().required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  region: objectId.required(),
  responseTimeHours: Joi.number().min(1).required(),
  resolutionTimeHours: Joi.number().min(1).required(),
});

export const teamLeaderCreateSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phone: Joi.string().allow(''),
  region: objectId.required(),
  teamIds: Joi.array().items(objectId).default([]),
  isActive: Joi.boolean().truthy('true', '1').falsy('false', '0', ''),
});

export const teamLeaderUpdateSchema = Joi.object({
  email: Joi.string().email(),
  password: Joi.string().min(6),
  firstName: Joi.string(),
  lastName: Joi.string(),
  phone: Joi.string().allow(''),
  region: objectId,
  teamIds: Joi.array().items(objectId),
  isActive: Joi.boolean().truthy('true', '1').falsy('false', '0', ''),
}).min(1);

export const teamLeaderAssignTeamsSchema = Joi.object({
  teamIds: Joi.array().items(objectId).required(),
});
