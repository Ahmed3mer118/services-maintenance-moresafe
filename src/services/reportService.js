import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { reportRepository } from '../repositories/index.js';
import { collectReportData } from './report/collectReportData.js';
import { buildWorkOrderPdf } from './report/buildWorkOrderPdf.js';

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
      return reportRepository.updateById(existing._id, payload);
    }

    return reportRepository.create({
      ticket: ticketId,
      language: lang,
      ...payload,
    });
  }

  async getReportByTicket(ticketId) {
    return reportRepository.findOne({ ticket: ticketId });
  }
}

export default new ReportService();
