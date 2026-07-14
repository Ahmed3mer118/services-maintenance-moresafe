import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './database.js';
import {
  User,
  Region,
  Specialty,
  MaintenanceCategory,
  SLA,
  MaintenanceTeam,
  School,
  Worker,
  InventoryItem,
  Ticket,
  TicketTask,
  MaterialRequest,
  Notification,
} from '../models/index.js';
import { ROLES } from '../constants/roles.js';
import { PRIORITY, TICKET_STATUS, TASK_STATUS } from '../constants/statuses.js';

const TEST_PASSWORD = 'Test@123';

async function upsertUser(data, password = TEST_PASSWORD) {
  let user = await User.findOne({ email: data.email.toLowerCase() }).select('+password');
  if (!user) {
    user = await User.create({ ...data, email: data.email.toLowerCase(), password });
  } else {
    Object.assign(user, { ...data, email: data.email.toLowerCase() });
    user.password = password;
    user.isActive = true;
    await user.save();
  }
  return user;
}

async function upsertWorker(user, w, specMap, teamMap) {
  const worker = await Worker.findOneAndUpdate(
    { employeeId: w.employeeId },
    {
      user: user._id,
      specialty: specMap[w.specialty],
      team: teamMap[w.team]._id,
      employeeId: w.employeeId,
      isAvailable: w.isAvailable !== false,
      isActive: true,
      rating: w.rating ?? 4.2,
      totalTasksCompleted: w.totalTasksCompleted ?? 0,
    },
    { upsert: true, new: true }
  );
  user.workerProfile = worker._id;
  await user.save();
  return worker;
}

async function upsertTicket(payload, slaDoc) {
  const doc = {
    ...payload,
    isDeleted: false,
    sla: slaDoc?._id,
    slaDeadline:
      payload.slaDeadline ??
      (slaDoc ? new Date(Date.now() + slaDoc.resolutionTimeHours * 3600000) : null),
    statusHistory: payload.statusHistory ?? [
      { status: payload.status, changedAt: new Date(), note: 'Demo seed data' },
    ],
  };
  return Ticket.findOneAndUpdate({ ticketNumber: payload.ticketNumber }, doc, {
    upsert: true,
    new: true,
  });
}

async function upsertTask(ticketId, worker, specialtyId, taskData) {
  const task = await TicketTask.findOneAndUpdate(
    { ticket: ticketId, worker: worker._id },
    {
      ticket: ticketId,
      worker: worker._id,
      specialty: specialtyId,
      statusHistory: taskData.statusHistory ?? [
        { status: taskData.status, changedAt: new Date(), note: 'Demo task' },
      ],
      ...taskData,
    },
    { upsert: true, new: true }
  );
  await Ticket.findByIdAndUpdate(ticketId, {
    $addToSet: { assignedWorkers: worker._id },
  });
  return task;
}

async function upsertMaterialRequest(payload) {
  return MaterialRequest.findOneAndUpdate(
    { ticket: payload.ticket, worker: payload.worker, status: payload.status },
    payload,
    { upsert: true, new: true }
  );
}

async function seedDemoData(ctx) {
  const {
    regions,
    schools,
    teamCentral,
    teamNorth,
    catMap,
    specMap,
    workerByKey,
    schoolAdminMap,
    admin,
    leaderCentral,
    warehouse,
    inventoryBySku,
  } = ctx;

  const plumbingCat = catMap.plumbing;
  const elecCat = catMap.electricity;
  const acCat = catMap.air_conditioning;
  const waterLeak = plumbingCat.subcategories.find((s) => s.key === 'water_leak');
  const powerOut = elecCat.subcategories.find((s) => s.key === 'power_outage');
  const blockedDrain = plumbingCat.subcategories.find((s) => s.key === 'blocked_drain');
  const notCooling = acCat.subcategories.find((s) => s.key === 'not_cooling');
  const lighting = elecCat.subcategories.find((s) => s.key === 'lighting');

  const slaHigh = await SLA.findOne({ region: regions.CENTRAL._id, priority: PRIORITY.HIGH });
  const slaCritical = await SLA.findOne({ region: regions.CENTRAL._id, priority: PRIORITY.CRITICAL });
  const slaMedium = await SLA.findOne({ region: regions.CENTRAL._id, priority: PRIORITY.MEDIUM });

  const wPlumber = workerByKey.plumber;
  const wElectric = workerByKey.electrician;
  const wAc = workerByKey.ac;
  const wElectricNorth = workerByKey.electricianNorth;

  const pastSla = new Date(Date.now() - 2 * 24 * 3600000);

  const tickets = [
    {
      ticketNumber: 'TKT-SEED-001',
      school: schools.ALNOOR,
      team: teamCentral._id,
      category: plumbingCat,
      subcategory: waterLeak,
      priority: PRIORITY.HIGH,
      status: TICKET_STATUS.ASSIGNED,
      title: 'Water leak — boys restroom floor 2',
      description: 'Active leak under sink. Floor is wet and slippery.',
      createdBy: schoolAdminMap.ALNOOR._id,
      sla: slaHigh,
    },
    {
      ticketNumber: 'TKT-SEED-002',
      school: schools.ALAMIR,
      team: teamCentral._id,
      category: elecCat,
      subcategory: powerOut,
      priority: PRIORITY.CRITICAL,
      status: TICKET_STATUS.IN_PROGRESS,
      title: 'Power outage — Block B classrooms',
      description: '8 classrooms without power. Main breaker tripping.',
      createdBy: schoolAdminMap.ALAMIR._id,
      sla: slaCritical,
    },
    {
      ticketNumber: 'TKT-SEED-003',
      school: schools.FUTURE,
      team: teamCentral._id,
      category: plumbingCat,
      subcategory: blockedDrain,
      priority: PRIORITY.MEDIUM,
      status: TICKET_STATUS.WAITING_MATERIALS,
      title: 'Blocked drain — cafeteria kitchen',
      description: 'Kitchen drain completely blocked. Needs PVC parts.',
      createdBy: admin._id,
      sla: slaMedium,
    },
    {
      ticketNumber: 'TKT-SEED-004',
      school: schools.ALNOOR,
      team: teamCentral._id,
      category: acCat,
      subcategory: notCooling,
      priority: PRIORITY.HIGH,
      status: TICKET_STATUS.UNDER_REVIEW,
      title: 'AC not cooling — admin office',
      description: 'Split unit runs but no cold air. Filter replaced, still issue.',
      createdBy: schoolAdminMap.ALNOOR._id,
      sla: slaHigh,
    },
    {
      ticketNumber: 'TKT-SEED-005',
      school: schools.ALAMIR,
      team: teamCentral._id,
      category: elecCat,
      subcategory: lighting,
      priority: PRIORITY.HIGH,
      status: TICKET_STATUS.ASSIGNED,
      title: 'Emergency lighting failure — parking',
      description: 'Parking lot lights out. Safety concern.',
      createdBy: schoolAdminMap.ALAMIR._id,
      sla: slaHigh,
      slaDeadline: pastSla,
      slaBreached: true,
    },
    {
      ticketNumber: 'TKT-SEED-006',
      school: schools.ALNOOR,
      team: teamCentral._id,
      category: plumbingCat,
      subcategory: waterLeak,
      priority: PRIORITY.MEDIUM,
      status: TICKET_STATUS.APPROVED,
      title: 'Fixed leak — girls restroom',
      description: 'Previously reported leak — work completed.',
      createdBy: schoolAdminMap.ALNOOR._id,
      schoolConfirmed: false,
      sla: slaMedium,
    },
    {
      ticketNumber: 'TKT-SEED-007',
      school: schools.ALNOOR,
      team: teamCentral._id,
      category: elecCat,
      subcategory: lighting,
      priority: PRIORITY.LOW,
      status: TICKET_STATUS.CLOSED,
      title: 'Classroom lights repaired',
      description: 'Replaced ballast in room 204.',
      createdBy: schoolAdminMap.ALNOOR._id,
      closedAt: new Date(Date.now() - 3 * 24 * 3600000),
      rating: { score: 5, comment: 'Fast and professional', ratedAt: new Date() },
      sla: slaMedium,
    },
    {
      ticketNumber: 'TKT-SEED-008',
      school: schools.FUTURE,
      team: teamCentral._id,
      category: elecCat,
      subcategory: powerOut,
      priority: PRIORITY.MEDIUM,
      status: TICKET_STATUS.ASSIGNED,
      title: 'Partial power loss — lab building',
      description: 'Science lab lost power on east wing.',
      createdBy: admin._id,
      sla: slaMedium,
    },
    {
      ticketNumber: 'TKT-SEED-009',
      school: schools.ALAMIR,
      team: teamCentral._id,
      category: acCat,
      subcategory: notCooling,
      priority: PRIORITY.MEDIUM,
      status: TICKET_STATUS.ACCEPTED,
      title: 'Library AC weak cooling',
      description: 'Library AC running but temperature stays at 28°C.',
      createdBy: schoolAdminMap.ALAMIR._id,
      sla: slaMedium,
    },
    {
      ticketNumber: 'TKT-SEED-N01',
      school: schools.NSTAR,
      team: teamNorth._id,
      category: elecCat,
      subcategory: powerOut,
      priority: PRIORITY.HIGH,
      status: TICKET_STATUS.ASSIGNED,
      title: 'Power fluctuation — computer lab',
      description: 'Voltage drops damaging equipment.',
      createdBy: schoolAdminMap.NSTAR._id,
      sla: slaHigh,
    },
  ];

  const ticketDocs = {};
  for (const t of tickets) {
    const school = t.school;
    ticketDocs[t.ticketNumber] = await upsertTicket(
      {
        ticketNumber: t.ticketNumber,
        school: school._id,
        region: school.region,
        team: t.team,
        category: t.category._id,
        subcategory: { id: t.subcategory._id, name: t.subcategory.name, key: t.subcategory.key },
        priority: t.priority,
        title: t.title,
        description: t.description,
        status: t.status,
        createdBy: t.createdBy,
        closedAt: t.closedAt,
        closedBy: t.closedAt ? admin._id : undefined,
        rating: t.rating,
        schoolConfirmed: t.schoolConfirmed ?? false,
        slaDeadline: t.slaDeadline,
        slaBreached: t.slaBreached ?? false,
      },
      t.sla
    );
  }

  // ── Tasks per worker (each role sees data on dashboard) ──
  await upsertTask(ticketDocs['TKT-SEED-001']._id, wPlumber, specMap.plumber, {
    status: TASK_STATUS.ASSIGNED,
    notes: 'Inspect leak source and shut off valve',
  });

  await upsertTask(ticketDocs['TKT-SEED-002']._id, wElectric, specMap.electrician, {
    status: TASK_STATUS.IN_PROGRESS,
    notes: 'Checking main panel — breaker 3 faulty',
    workingHours: 2,
    startedAt: new Date(),
  });

  await upsertTask(ticketDocs['TKT-SEED-003']._id, wPlumber, specMap.plumber, {
    status: TASK_STATUS.WAITING_MATERIALS,
    notes: 'Need PVC pipe and valve',
    workingHours: 1,
  });

  await upsertTask(ticketDocs['TKT-SEED-004']._id, wAc, specMap.ac_technician, {
    status: TASK_STATUS.COMPLETED,
    notes: 'Replaced capacitor — ready for leader review',
    workingHours: 3,
    completedAt: new Date(),
  });

  await upsertTask(ticketDocs['TKT-SEED-005']._id, wElectric, specMap.electrician, {
    status: TASK_STATUS.ASSIGNED,
    notes: 'Urgent — SLA breached',
  });

  await upsertTask(ticketDocs['TKT-SEED-006']._id, wPlumber, specMap.plumber, {
    status: TASK_STATUS.APPROVED,
    notes: 'Leak sealed successfully',
    workingHours: 2.5,
  });

  await upsertTask(ticketDocs['TKT-SEED-007']._id, wElectric, specMap.electrician, {
    status: TASK_STATUS.APPROVED,
    notes: 'Ballast replaced',
    workingHours: 1.5,
  });

  await upsertTask(ticketDocs['TKT-SEED-008']._id, wElectric, specMap.electrician, {
    status: TASK_STATUS.ASSIGNED,
    notes: 'New assignment — check east wing panel',
  });

  await upsertTask(ticketDocs['TKT-SEED-009']._id, wAc, specMap.ac_technician, {
    status: TASK_STATUS.ACCEPTED,
    notes: 'Will visit tomorrow morning',
    acceptedAt: new Date(),
  });

  await upsertTask(ticketDocs['TKT-SEED-N01']._id, wElectricNorth, specMap.electrician, {
    status: TASK_STATUS.ASSIGNED,
    notes: 'North region — voltage check needed',
  });

  // ── Material requests (warehouse dashboard) ──
  const pipeItem = inventoryBySku['PLB-PIPE-PVC'];
  const breakerItem = inventoryBySku['ELC-BCB-20'];
  const acFilter = inventoryBySku['AC-FILTER'];

  await upsertMaterialRequest({
    ticket: ticketDocs['TKT-SEED-003']._id,
    worker: wPlumber._id,
    status: 'pending',
    notes: 'Urgent — kitchen closed until fixed',
    items: [{ item: pipeItem._id, quantityRequested: 10, quantityApproved: 0 }],
  });

  await upsertMaterialRequest({
    ticket: ticketDocs['TKT-SEED-002']._id,
    worker: wElectric._id,
    status: 'pending',
    notes: 'Need replacement breakers',
    items: [{ item: breakerItem._id, quantityRequested: 2, quantityApproved: 0 }],
  });

  await MaterialRequest.findOneAndUpdate(
    { ticket: ticketDocs['TKT-SEED-004']._id, worker: wAc._id },
    {
      ticket: ticketDocs['TKT-SEED-004']._id,
      worker: wAc._id,
      status: 'approved',
      warehouse: warehouse._id,
      approvedAt: new Date(Date.now() - 86400000),
      items: [{ item: acFilter._id, quantityRequested: 2, quantityApproved: 2 }],
    },
    { upsert: true }
  );

  // ── Notifications per role ──
  const notifs = [
    { user: leaderCentral._id, type: 'task_review', title: 'Task Ready for Review', message: 'AC repair TKT-SEED-004 awaiting your approval', entityType: 'Ticket', entityId: ticketDocs['TKT-SEED-004']._id },
    { user: wElectric.user, type: 'task_assigned', title: 'New Task', message: 'TKT-SEED-008 assigned to you', entityType: 'Ticket', entityId: ticketDocs['TKT-SEED-008']._id },
    { user: wPlumber.user, type: 'task_assigned', title: 'New Task', message: 'TKT-SEED-001 — water leak', entityType: 'Ticket', entityId: ticketDocs['TKT-SEED-001']._id },
    { user: warehouse._id, type: 'material_request', title: 'Material Request', message: '2 pending requests need approval', entityType: 'MaterialRequest', entityId: ticketDocs['TKT-SEED-003']._id },
    { user: schoolAdminMap.ALNOOR._id, type: 'ticket_approved', title: 'Work Completed', message: 'TKT-SEED-006 ready for your confirmation', entityType: 'Ticket', entityId: ticketDocs['TKT-SEED-006']._id },
  ];

  for (const n of notifs) {
    await Notification.findOneAndUpdate(
      { user: n.user, type: n.type, title: n.title },
      { ...n, isRead: false, channels: ['socket', 'email'] },
      { upsert: true }
    );
  }

  return ticketDocs;
}

async function seed() {
  await connectDB();
  console.log('Seeding database...');

  // ── Specialties ──
  const specialties = [
    { key: 'electrician', name: 'Electrician', nameAr: 'كهربائي', icon: 'zap', color: '#EAB308', sortOrder: 1 },
    { key: 'plumber', name: 'Plumber', nameAr: 'سباك', icon: 'droplet', color: '#3B82F6', sortOrder: 2 },
    { key: 'ac_technician', name: 'AC Technician', nameAr: 'فني تكييف', icon: 'wind', color: '#06B6D4', sortOrder: 3 },
  ];
  for (const s of specialties) {
    await Specialty.findOneAndUpdate({ key: s.key }, s, { upsert: true, new: true });
  }
  const specDocs = await Specialty.find();
  const specMap = Object.fromEntries(specDocs.map((s) => [s.key, s._id]));

  // ── Categories ──
  const categories = [
    {
      name: 'Electricity',
      key: 'electricity',
      icon: 'zap',
      color: '#EAB308',
      requiredSpecialties: [specMap.electrician],
      subcategories: [
        { name: 'Power Outage', key: 'power_outage' },
        { name: 'Wiring Issue', key: 'wiring_issue' },
        { name: 'Lighting', key: 'lighting' },
        { name: 'Panel/DB Issue', key: 'panel_issue' },
      ],
    },
    {
      name: 'Plumbing',
      key: 'plumbing',
      icon: 'droplet',
      color: '#3B82F6',
      requiredSpecialties: [specMap.plumber],
      subcategories: [
        { name: 'Water Leak', key: 'water_leak' },
        { name: 'Blocked Drain', key: 'blocked_drain' },
        { name: 'Toilet Issue', key: 'toilet_issue' },
        { name: 'Water Heater', key: 'water_heater' },
      ],
    },
    {
      name: 'Air Conditioning',
      key: 'air_conditioning',
      icon: 'wind',
      color: '#06B6D4',
      requiredSpecialties: [specMap.ac_technician],
      subcategories: [
        { name: 'Not Cooling', key: 'not_cooling' },
        { name: 'Gas Refill', key: 'gas_refill' },
        { name: 'Unit Noise', key: 'unit_noise' },
        { name: 'Maintenance', key: 'ac_maintenance' },
      ],
    },
  ];
  for (const c of categories) {
    await MaintenanceCategory.findOneAndUpdate({ key: c.key }, c, { upsert: true, new: true });
  }
  const categoryDocs = await MaintenanceCategory.find();
  const catMap = Object.fromEntries(categoryDocs.map((c) => [c.key, c]));

  // ── Regions ──
  const regionData = [
    { name: 'Central Region', code: 'CENTRAL', description: 'Capital district schools' },
    { name: 'Northern Region', code: 'NORTH', description: 'Northern province schools' },
    { name: 'Southern Region', code: 'SOUTH', description: 'Southern province schools' },
  ];
  const regions = {};
  for (const r of regionData) {
    regions[r.code] = await Region.findOneAndUpdate({ code: r.code }, r, { upsert: true, new: true });
  }

  // ── SLAs per region ──
  for (const region of Object.values(regions)) {
    for (const p of Object.values(PRIORITY)) {
      await SLA.findOneAndUpdate(
        { region: region._id, priority: p },
        {
          name: `${p.charAt(0).toUpperCase() + p.slice(1)} SLA`,
          priority: p,
          region: region._id,
          responseTimeHours: p === 'critical' ? 1 : p === 'high' ? 4 : p === 'medium' ? 24 : 48,
          resolutionTimeHours: p === 'critical' ? 4 : p === 'high' ? 24 : p === 'medium' ? 72 : 168,
        },
        { upsert: true }
      );
    }
  }

  // ── Users ──
  const admin = await upsertUser({
    email: 'admin@erp.com',
    firstName: 'Super',
    lastName: 'Admin',
    roles: [ROLES.SUPER_ADMIN],
    region: regions.CENTRAL._id,
  }, 'Admin@123');

  const manager = await upsertUser({
    email: 'manager@erp.com',
    firstName: 'Ahmed',
    lastName: 'Manager',
    phone: '+966500000001',
    roles: [ROLES.MAINTENANCE_MANAGER],
    region: regions.CENTRAL._id,
  });

  const leaderCentral = await upsertUser({
    email: 'leader.central@erp.com',
    firstName: 'Khalid',
    lastName: 'Al-Rashid',
    phone: '+966500000002',
    roles: [ROLES.TEAM_LEADER],
    region: regions.CENTRAL._id,
  });

  const leaderNorth = await upsertUser({
    email: 'leader.north@erp.com',
    firstName: 'Omar',
    lastName: 'Al-Farsi',
    phone: '+966500000003',
    roles: [ROLES.TEAM_LEADER],
    region: regions.NORTH._id,
  });

  const warehouse = await upsertUser({
    email: 'warehouse@erp.com',
    firstName: 'Fahad',
    lastName: 'Storekeeper',
    roles: [ROLES.WAREHOUSE_KEEPER],
    region: regions.CENTRAL._id,
  });

  const workerUsers = [
    { email: 'electrician@erp.com', firstName: 'Saeed', lastName: 'Electric', specialty: 'electrician', employeeId: 'EMP-E001', team: 'CENTRAL' },
    { email: 'plumber@erp.com', firstName: 'Hassan', lastName: 'Plumber', specialty: 'plumber', employeeId: 'EMP-P001', team: 'CENTRAL' },
    { email: 'ac.tech@erp.com', firstName: 'Youssef', lastName: 'AC Tech', specialty: 'ac_technician', employeeId: 'EMP-A001', team: 'CENTRAL' },
    { email: 'electrician.north@erp.com', firstName: 'Nasser', lastName: 'Electric', specialty: 'electrician', employeeId: 'EMP-E002', team: 'NORTH' },
    { email: 'plumber.north@erp.com', firstName: 'Waleed', lastName: 'Plumber', specialty: 'plumber', employeeId: 'EMP-P002', team: 'NORTH' },
  ];

  const schoolAdminUsers = [
    { email: 'school.alnoor@erp.com', firstName: 'Layla', lastName: 'Admin', schoolCode: 'ALNOOR' },
    { email: 'school.alamir@erp.com', firstName: 'Mona', lastName: 'Admin', schoolCode: 'ALAMIR' },
    { email: 'school.northstar@erp.com', firstName: 'Sara', lastName: 'Admin', schoolCode: 'NSTAR' },
  ];

  // ── Teams ──
  const teamCentral = await MaintenanceTeam.findOneAndUpdate(
    { code: 'TEAM-CENTRAL' },
    {
      name: 'Central Maintenance Team',
      code: 'TEAM-CENTRAL',
      region: regions.CENTRAL._id,
      leader: leaderCentral._id,
      members: [],
    },
    { upsert: true, new: true }
  );

  const teamNorth = await MaintenanceTeam.findOneAndUpdate(
    { code: 'TEAM-NORTH' },
    {
      name: 'Northern Maintenance Team',
      code: 'TEAM-NORTH',
      region: regions.NORTH._id,
      leader: leaderNorth._id,
      members: [],
    },
    { upsert: true, new: true }
  );

  const teamMap = { CENTRAL: teamCentral, NORTH: teamNorth };

  // ── Workers ──
  const workerByKey = {};
  const workerDocs = [];
  for (const w of workerUsers) {
    const user = await upsertUser({
      email: w.email,
      firstName: w.firstName,
      lastName: w.lastName,
      roles: [ROLES.WORKER],
      region: regions[w.team === 'CENTRAL' ? 'CENTRAL' : 'NORTH']._id,
    });

    const worker = await upsertWorker(user, w, specMap, teamMap);
    workerDocs.push(worker);

    if (w.email === 'electrician@erp.com') workerByKey.electrician = worker;
    if (w.email === 'plumber@erp.com') workerByKey.plumber = worker;
    if (w.email === 'ac.tech@erp.com') workerByKey.ac = worker;
    if (w.email === 'electrician.north@erp.com') workerByKey.electricianNorth = worker;
    if (w.email === 'plumber.north@erp.com') workerByKey.plumberNorth = worker;
  }

  await MaintenanceTeam.findByIdAndUpdate(teamCentral._id, {
    members: workerDocs.filter((w) => w.team.equals(teamCentral._id)).map((w) => w._id),
  });
  await MaintenanceTeam.findByIdAndUpdate(teamNorth._id, {
    members: workerDocs.filter((w) => w.team.equals(teamNorth._id)).map((w) => w._id),
  });

  // ── Schools ──
  const schoolData = [
    { name: 'Al-Noor International School', code: 'ALNOOR', region: 'CENTRAL', address: '123 King Fahd Rd, Riyadh', phone: '+966112345001', lat: 24.7136, lng: 46.6753, team: teamCentral },
    { name: 'Al-Amir Academy', code: 'ALAMIR', region: 'CENTRAL', address: '45 Olaya St, Riyadh', phone: '+966112345002', lat: 24.6877, lng: 46.7219, team: teamCentral },
    { name: 'Future Leaders School', code: 'FUTURE', region: 'CENTRAL', address: '78 Tahlia St, Riyadh', phone: '+966112345003', lat: 24.6928, lng: 46.6850, team: teamCentral },
    { name: 'North Star School', code: 'NSTAR', region: 'NORTH', address: '12 Prince Sultan Rd, Tabuk', phone: '+966143456001', lat: 28.3838, lng: 36.5550, team: teamNorth },
    { name: 'Green Valley School', code: 'GVALLEY', region: 'NORTH', address: '34 University Blvd, Tabuk', phone: '+966143456002', lat: 28.3996, lng: 36.5785, team: teamNorth },
    { name: 'Southern Horizon School', code: 'SHORIZON', region: 'SOUTH', address: '56 Corniche Rd, Abha', phone: '+966172345001', lat: 18.2164, lng: 42.5053, team: null },
  ];

  const schools = {};
  for (const s of schoolData) {
    schools[s.code] = await School.findOneAndUpdate(
      { code: s.code },
      {
        name: s.name,
        code: s.code,
        region: regions[s.region]._id,
        address: s.address,
        phone: s.phone,
        location: { type: 'Point', coordinates: [s.lng, s.lat] },
        maintenanceTeam: s.team?._id,
      },
      { upsert: true, new: true }
    );
  }

  // ── School admins ──
  const schoolAdminMap = {};
  for (const sa of schoolAdminUsers) {
    const school = schools[sa.schoolCode];
    const user = await upsertUser({
      email: sa.email,
      firstName: sa.firstName,
      lastName: sa.lastName,
      roles: [ROLES.SCHOOL_ADMIN],
      region: school.region,
      school: school._id,
    });
    schoolAdminMap[sa.schoolCode] = user;
    await School.findByIdAndUpdate(school._id, { $addToSet: { adminUsers: user._id } });
  }

  // ── Inventory ──
  const inventoryItems = [
    { sku: 'ELC-CBL-2.5', name: 'Electrical Cable 2.5mm', category: 'Electrical', unit: 'm', quantity: 500, minStock: 50, unitCost: 3.5 },
    { sku: 'ELC-BCB-20', name: 'Circuit Breaker 20A', category: 'Electrical', unit: 'pcs', quantity: 5, minStock: 10, unitCost: 45 },
    { sku: 'PLB-PIPE-PVC', name: 'PVC Pipe 1 inch', category: 'Plumbing', unit: 'm', quantity: 200, minStock: 30, unitCost: 8 },
    { sku: 'PLB-VALVE', name: 'Water Valve', category: 'Plumbing', unit: 'pcs', quantity: 60, minStock: 15, unitCost: 25 },
    { sku: 'AC-FILTER', name: 'AC Filter', category: 'HVAC', unit: 'pcs', quantity: 100, minStock: 20, unitCost: 35 },
    { sku: 'AC-GAS-R410', name: 'Refrigerant R410A', category: 'HVAC', unit: 'kg', quantity: 40, minStock: 5, unitCost: 120 },
    { sku: 'GEN-SEAL-TAPE', name: 'Teflon Seal Tape', category: 'General', unit: 'roll', quantity: 150, minStock: 25, unitCost: 2 },
  ];
  const inventoryBySku = {};
  for (const item of inventoryItems) {
    inventoryBySku[item.sku] = await InventoryItem.findOneAndUpdate(
      { sku: item.sku },
      { ...item, region: regions.CENTRAL._id, isActive: true },
      { upsert: true, new: true }
    );
  }

  // ── Demo tickets, tasks, material requests, notifications ──
  await seedDemoData({
    regions,
    schools,
    teamCentral,
    teamNorth,
    catMap,
    specMap,
    workerByKey,
    schoolAdminMap,
    admin,
    leaderCentral,
    warehouse,
    inventoryBySku,
  });

  console.log('\n✅ Seed completed successfully\n');
  console.log('── Demo data per role ──');
  console.log('  Admin/Manager:     KPIs + 10 tickets (all statuses)');
  console.log('  Team Leader:       8 active tickets, 1 review, 1 SLA alert, 3 workers');
  console.log('  Electrician:       3 tasks (assigned + in_progress + assigned)');
  console.log('  Plumber:           2 tasks (assigned + waiting materials)');
  console.log('  AC Technician:     2 tasks (completed review + accepted)');
  console.log('  School Admin:      school tickets + 1 awaiting confirmation');
  console.log('  Warehouse:         2 pending material requests + low stock alert');
  console.log('\n── Login (password Test@123, admin Admin@123) ──');
  console.log('  admin@erp.com | manager@erp.com | leader.central@erp.com');
  console.log('  electrician@erp.com | plumber@erp.com | ac.tech@erp.com');
  console.log('  school.alnoor@erp.com | warehouse@erp.com');
  console.log('──────────────────────────────────────────────────────────────────────\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
