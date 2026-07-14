import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import {
  Ticket,
  TicketTask,
  InventoryTransaction,
  Asset,
  MaintenanceTeam,
  User,
} from '../../models/index.js';
import { STATUS_ACTIONS } from './labels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../../uploads');

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDateAr(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('ar-SA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hoursBetween(start, end) {
  if (!start || !end) return null;
  return ((new Date(end) - new Date(start)) / 3600000).toFixed(1);
}

function userName(user) {
  if (!user) return '-';
  if (typeof user === 'string') return user;
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '-';
}

function roleLabel(user) {
  if (!user?.roles?.length) return '-';
  return user.roles.join(', ');
}

function loadImageBase64(urlPath) {
  if (!urlPath) return null;
  const relative = urlPath.replace(/^\/uploads\//, '');
  const fullPath = path.join(uploadsDir, relative);
  if (!fs.existsSync(fullPath)) return null;
  try {
    const buf = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).slice(1).toLowerCase() || 'jpeg';
    const mime = ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg';
    return `data:image/${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function buildTimeline(ticket, tasks) {
  const entries = [];

  for (const h of ticket.statusHistory || []) {
    const action = STATUS_ACTIONS[h.status] || { en: h.status, ar: h.status };
    let changedBy = h.changedBy;
    if (changedBy && typeof changedBy === 'object') {
      changedBy = userName(changedBy);
    } else if (changedBy) {
      const u = await User.findById(changedBy).select('firstName lastName roles').lean();
      changedBy = u ? userName(u) : 'System';
    } else {
      changedBy = 'System';
    }
    entries.push({
      date: h.changedAt,
      user: changedBy,
      actionEn: action.en,
      actionAr: action.ar,
      note: h.note,
    });
  }

  for (const task of tasks) {
    for (const h of task.statusHistory || []) {
      const action = STATUS_ACTIONS[h.status] || { en: h.status, ar: h.status };
      entries.push({
        date: h.changedAt,
        user: userName(task.worker?.user) || 'Worker',
        actionEn: action.en,
        actionAr: action.ar,
        note: h.note,
      });
    }
    const imgCount =
      (task.beforeImages?.length || 0) +
      (task.duringImages?.length || 0) +
      (task.afterImages?.length || 0);
    if (imgCount > 0 && task.completedAt) {
      entries.push({
        date: task.completedAt,
        user: userName(task.worker?.user) || 'Worker',
        actionEn: 'Uploaded Images',
        actionAr: 'رفع صور',
        note: `${imgCount} photo(s)`,
      });
    }
  }

  entries.sort((a, b) => new Date(a.date) - new Date(b.date));
  return entries;
}

function computeChecklist(ticket, tasks) {
  const c = ticket.checklist || {};
  const hasPhotos =
    (ticket.attachments?.before?.length || 0) +
      (ticket.attachments?.during?.length || 0) +
      (ticket.attachments?.after?.length || 0) +
      tasks.reduce(
        (s, t) =>
          s +
          (t.beforeImages?.length || 0) +
          (t.duringImages?.length || 0) +
          (t.afterImages?.length || 0),
        0
      ) >
    0;

  const catKey = ticket.category?.key || ticket.subcategory?.key || '';
  return {
    electricalTest: c.electricalTest ?? /elect/i.test(catKey),
    safetyInspection: c.safetyInspection ?? ['approved', 'closed'].includes(ticket.status),
    areaCleaned: c.areaCleaned ?? false,
    equipmentTested: c.equipmentTested ?? tasks.some((t) => t.status === 'approved'),
    customerConfirmed: c.customerConfirmed ?? ticket.schoolConfirmed ?? false,
    photosUploaded: c.photosUploaded ?? hasPhotos,
  };
}

export async function collectReportData(ticketId, options = {}) {
  const ticket = await Ticket.findById(ticketId)
    .populate('school', 'name code address phone region')
    .populate('region', 'name code')
    .populate('team', 'name code')
    .populate('category', 'name key')
    .populate('createdBy', 'firstName lastName email phone roles')
    .populate('closedBy', 'firstName lastName email')
    .populate('sla')
    .populate('asset')
    .populate({ path: 'statusHistory.changedBy', select: 'firstName lastName roles' })
    .lean();

  if (!ticket) throw new Error('Ticket not found');

  let teamLeader = null;
  if (ticket.team?._id) {
    const team = await MaintenanceTeam.findById(ticket.team._id)
      .populate('leader', 'firstName lastName email phone')
      .lean();
    teamLeader = team?.leader || null;
  }

  const tasks = await TicketTask.find({ ticket: ticketId })
    .populate('specialty', 'name key')
    .populate({ path: 'worker', populate: { path: 'user', select: 'firstName lastName phone email' } })
    .populate('reviewedBy', 'firstName lastName')
    .lean();

  const transactions = await InventoryTransaction.find({ ticket: ticketId })
    .populate('item', 'name sku unit')
    .lean();

  let asset = ticket.asset;
  if (!asset) {
    asset = await Asset.findOne({ school: ticket.school?._id || ticket.school, isActive: true })
      .sort('-updatedAt')
      .lean();
  }

  const totalWorkingHours =
    ticket.totalWorkingHours ||
    tasks.reduce((s, t) => s + (t.workingHours || 0), 0);

  const materialsTotal = transactions.reduce(
    (s, tx) => s + tx.quantity * (tx.unitCost || 0),
    0
  );
  const laborCost = ticket.costs?.laborCost || 0;
  const transportCost = ticket.costs?.transportationCost || 0;
  const additionalCost = ticket.costs?.additionalCost || 0;
  const grandTotal = materialsTotal + laborCost + transportCost + additionalCost;

  const approvedEntry = (ticket.statusHistory || []).find((h) => h.status === 'approved');
  const approvedAt = ticket.approvedAt || approvedEntry?.changedAt;
  const completionDate = ticket.closedAt || tasks.find((t) => t.completedAt)?.completedAt;

  const slaTargetHours = ticket.sla?.resolutionTimeHours;
  const slaResponseHours = ticket.sla?.responseTimeHours;
  const actualResolutionHours = hoursBetween(ticket.createdAt, completionDate || approvedAt);

  const timeline = await buildTimeline(ticket, tasks);
  const checklist = computeChecklist(ticket, tasks);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const ticketUrl = `${frontendUrl}/tickets/${ticketId}`;
  const qrCode = await QRCode.toDataURL(ticketUrl, { width: 140, margin: 1 });

  const workReport = ticket.workReport || {};
  const workerNotes = tasks.map((t) => t.notes).filter(Boolean).join('\n\n');
  const correctiveFromTasks = tasks
    .filter((t) => t.notes)
    .map((t) => `[${t.specialty?.name}]: ${t.notes}`)
    .join('\n');

  const imageSections = [];
  const addImages = (label, images) => {
    if (!images?.length) return;
    imageSections.push({
      label,
      items: images
        .map((img) => ({
          base64: loadImageBase64(img.url),
          url: img.url,
        }))
        .filter((i) => i.base64),
    });
  };

  addImages('Before Repair / قبل الإصلاح', ticket.attachments?.before);
  addImages('During Work / أثناء العمل', ticket.attachments?.during);
  addImages('After Repair / بعد الإصلاح', ticket.attachments?.after);
  for (const task of tasks) {
    const wName = userName(task.worker?.user);
    addImages(`Worker ${wName} - Before`, task.beforeImages);
    addImages(`Worker ${wName} - During`, task.duringImages);
    addImages(`Worker ${wName} - After`, task.afterImages);
  }

  const reportId = `RPT-${ticket.ticketNumber}-${Date.now()}`;

  return {
    reportId,
    ticketId,
    ticketUrl,
    qrCode,
    language: options.lang === 'ar' ? 'ar' : 'en',
    generatedAt: new Date(),
    generatedBy: options.generatedBy,
    ticket: {
      id: ticket._id.toString(),
      number: ticket.ticketNumber,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category?.name,
      subcategory: ticket.subcategory?.name,
      priority: ticket.priority,
      status: ticket.status,
      slaStatus: ticket.slaBreached ? 'Breached' : 'On Track',
      slaStatusAr: ticket.slaBreached ? 'متجاوز' : 'ضمن الوقت',
      createdAt: fmtDate(ticket.createdAt),
      createdAtAr: fmtDateAr(ticket.createdAt),
      dueDate: fmtDate(ticket.slaDeadline),
      completionDate: fmtDate(completionDate),
      approvalDate: fmtDate(approvedAt),
      estimatedHours: slaTargetHours ? `${slaTargetHours}h` : '-',
      actualHours: `${totalWorkingHours}h`,
    },
    school: {
      name: ticket.school?.name,
      code: ticket.school?.code,
      region: ticket.region?.name,
      address: ticket.school?.address,
      contactPerson: userName(ticket.createdBy),
      phone: ticket.school?.phone,
    },
    asset: asset
      ? {
          name: asset.name,
          code: asset.code || '-',
          type: asset.assetType || asset.category || '-',
          serial: asset.serialNumber,
          location: asset.location || '-',
          installDate: fmtDate(asset.installDate),
          warrantyEn: asset.warrantyExpiry
            ? new Date(asset.warrantyExpiry) > new Date()
              ? 'Active'
              : 'Expired'
            : '-',
          warrantyAr: asset.warrantyExpiry
            ? new Date(asset.warrantyExpiry) > new Date()
              ? 'ساري'
              : 'منتهي'
            : '-',
          manufacturer: asset.manufacturer || '-',
        }
      : null,
    reporter: {
      name: userName(ticket.createdBy),
      position: roleLabel(ticket.createdBy),
      phone: ticket.createdBy?.phone || ticket.school?.phone,
      email: ticket.createdBy?.email,
      date: fmtDate(ticket.createdAt),
    },
    assignment: {
      team: ticket.team?.name,
      teamCode: ticket.team?.code,
      leader: userName(teamLeader),
      leaderPhone: teamLeader?.phone,
      workers: tasks.map((t) => ({
        name: userName(t.worker?.user),
        specialty: t.specialty?.name,
        assigned: fmtDate(t.acceptedAt || t.createdAt),
        started: fmtDate(t.startedAt),
        finished: fmtDate(t.completedAt),
        hours: t.workingHours || 0,
      })),
    },
    timeline: timeline.map((e) => ({
      date: fmtDate(e.date),
      dateAr: fmtDateAr(e.date),
      user: e.user,
      actionEn: e.actionEn,
      actionAr: e.actionAr,
      note: e.note,
    })),
    workPerformed: {
      rootCause: workReport.rootCause || ticket.description?.slice(0, 200) || '-',
      inspection: workReport.inspectionDetails || '-',
      diagnostic: workReport.diagnosticResult || '-',
      corrective: workReport.correctiveActions || correctiveFromTasks || '-',
      recommendation: workReport.preventiveRecommendation || '-',
    },
    materials: {
      rows: transactions.map((tx) => ({
        name: tx.item?.name || 'Item',
        sku: tx.item?.sku,
        quantity: tx.quantity,
        unit: tx.item?.unit || 'pcs',
        unitCost: tx.unitCost || 0,
        total: (tx.quantity * (tx.unitCost || 0)).toFixed(2),
      })),
      materialsTotal: materialsTotal.toFixed(2),
      laborCost: laborCost.toFixed(2),
      transportCost: transportCost.toFixed(2),
      additionalCost: additionalCost.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
    },
    imageSections,
    notes: {
      worker: workerNotes || '-',
      leader: ticket.leaderNotes || '-',
      school: ticket.schoolNote || ticket.rating?.comment || '-',
    },
    sla: {
      responseTarget: slaResponseHours ? `${slaResponseHours}h` : '-',
      resolutionTarget: slaTargetHours ? `${slaTargetHours}h` : '-',
      actual: actualResolutionHours ? `${actualResolutionHours}h` : '-',
      breachedEn: ticket.slaBreached ? 'Yes' : 'No',
      breachedAr: ticket.slaBreached ? 'نعم' : 'لا',
      penaltyEn: ticket.slaBreached ? 'Applied per SLA policy' : '-',
      penaltyAr: ticket.slaBreached ? 'حسب سياسة SLA' : '-',
    },
    checklist,
    signatures: {
      worker: userName(tasks[0]?.worker?.user),
      leader: userName(teamLeader),
      schoolAdmin: userName(ticket.createdBy),
      manager: '-',
      date: fmtDate(new Date()),
    },
    rating: ticket.rating,
  };
}
