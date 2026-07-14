/**
 * Specialty Registry — Open/Closed Principle
 * New worker types register here without modifying ticket/task models.
 */
class SpecialtyRegistry {
  constructor() {
    this.handlers = new Map();
  }

  register(key, handler = {}) {
    this.handlers.set(key, {
      displayName: handler.displayName || key,
      icon: handler.icon || 'wrench',
      color: handler.color || '#3B82F6',
      onTaskAssigned: handler.onTaskAssigned || null,
      onTaskCompleted: handler.onTaskCompleted || null,
    });
  }

  get(key) {
    return this.handlers.get(key) || {
      displayName: key,
      icon: 'wrench',
      color: '#3B82F6',
    };
  }

  has(key) {
    return this.handlers.has(key);
  }

  async runHook(key, hookName, ...args) {
    const handler = this.handlers.get(key);
    if (handler?.[hookName]) {
      await handler[hookName](...args);
    }
  }
}

export const specialtyRegistry = new SpecialtyRegistry();

export function registerSpecialtyFromDb(specialty) {
  specialtyRegistry.register(specialty.key, {
    displayName: specialty.name,
    icon: specialty.icon,
    color: specialty.color,
  });
}

export async function loadSpecialtiesFromDb(SpecialtyModel) {
  const specialties = await SpecialtyModel.find({ isActive: true });
  for (const s of specialties) {
    registerSpecialtyFromDb(s);
  }
  return specialties;
}

export default specialtyRegistry;
