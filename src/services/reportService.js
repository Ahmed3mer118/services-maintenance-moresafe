import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { reportRepository } from '../repositories/index.js';
import { collectReportData } from './report/collectReportData.js';
import { buildWorkOrderPdf } from './report/buildWorkOrderPdf.js';
import notificationService from './notificationService.js';
import { ROLES } from '../constants/roles.js';
import ticketRepository from '../repositories/ticketRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportsDir = path.join(__dirname, '../../uploads/reports');

class ReportService {
  async generateTicketReport(ticketId, options = {}) {
    const lang = options.lang === 'ar' ? 'ar' : 'en';
    const data = await collectReportData(ticketId, { ...options, lang });

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filename = `${data.ticket.number}_WO_${lang}_${Date.now()}.pdf`;
    const filepath = path.join(reportsDir, filename);
    const pdfUrl = `/uploads/reports/${filename}`;

    await buildWorkOrderPdf(data, filepath);

    const metadata = {
      reportId: data.reportId,
      ticketNumber: data.ticket.number,
      version: '2.0',
      totalCost: parseFloat(data.materials.grandTotal),
      totalWorkingHours: parseFloat(data.ticket.actualHours) || 0,
      tasksCount: data.assignment.workers.length,
      materialsCount: data.materials.rows.length,
      [`generatedAt${lang === 'ar' ? 'Ar' : 'En'}`]: new Date(),
    };

    const existing = await reportRepository.findOne({ ticket: ticketId });
    const payload = {
      pdfUrl,
      reportId: data.reportId,
      version: '2.0',
      generatedBy: options.generatedBy,
      generatedAt: new Date(),
      metadata: {
        ...(existing?.metadata || {}),
        ...metadata,
      },
    };

    if (lang === 'ar') {
      payload.pdfUrlAr = pdfUrl;
    } else {
      payload.pdfUrlEn = pdfUrl;
    }

    if (existing) {
      const report = await reportRepository.updateById(existing._id, payload);
      await this._notifyReportReady(ticketId, data.ticket.number, lang);
      return report;
    }

    const report = await reportRepository.create({
      ticket: ticketId,
      language: lang,
      ...payload,
    });
    await this._notifyReportReady(ticketId, data.ticket.number, lang);
    return report;
  }

  async _notifyReportReady(ticketId, ticketNumber, lang) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) return;

    const { User } = await import('../models/index.js');
    const schoolAdmins = await User.find({
      school: ticket.school,
      roles: ROLES.SCHOOL_ADMIN,
      isActive: true,
    }).select('_id');

    const payload = {
      type: 'report_ready',
      title: lang === 'ar' ? 'التقرير جاهز' : 'Maintenance Report Ready',
      message: `${ticketNumber} — ${lang === 'ar' ? 'تقرير PDF جاهز للتحميل' : 'PDF report is ready'}`,
      entityType: 'Ticket',
      entityId: ticketId,
    };

    if (schoolAdmins.length) {
      await notificationService.notifyMany(schoolAdmins.map((u) => u._id), payload);
    }

    await notificationService.notifyUsersByRoles([ROLES.MAINTENANCE_MANAGER], payload, {
      region: ticket.region,
    });

    const { MaintenanceTeam } = await import('../models/index.js');
    const team = ticket.team ? await MaintenanceTeam.findById(ticket.team).select('leader') : null;
    if (team?.leader) {
      await notificationService.create({ ...payload, userId: team.leader });
    }
  }

  async getReportByTicket(ticketId) {
    return reportRepository.findOne({ ticket: ticketId });
  }
}

export default new ReportService();
