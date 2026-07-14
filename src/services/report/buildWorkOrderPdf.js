import pdfMake from 'pdfmake';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SECTIONS } from './labels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(__dirname, '../../../assets/fonts');

let fontsReady = false;

function ensureFonts() {
  if (fontsReady) return;

  const files = {
    'Roboto-Regular.ttf': path.join(fontsDir, 'Roboto-Regular.ttf'),
    'Roboto-Medium.ttf': path.join(fontsDir, 'Roboto-Medium.ttf'),
    'NotoSansArabic-Regular.ttf': path.join(fontsDir, 'NotoSansArabic-Regular.ttf'),
    'NotoSansArabic-Bold.ttf': path.join(fontsDir, 'NotoSansArabic-Bold.ttf'),
  };

  for (const [name, filePath] of Object.entries(files)) {
    pdfMake.virtualfs.writeFileSync(name, fs.readFileSync(filePath));
  }

  pdfMake.setFonts({
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Regular.ttf',
      bolditalics: 'Roboto-Medium.ttf',
    },
    Arabic: {
      normal: 'NotoSansArabic-Regular.ttf',
      bold: 'NotoSansArabic-Bold.ttf',
      italics: 'NotoSansArabic-Regular.ttf',
      bolditalics: 'NotoSansArabic-Bold.ttf',
    },
  });

  pdfMake.setLocalAccessPolicy(() => true);
  pdfMake.setUrlAccessPolicy(() => false);
  fontsReady = true;
}

function pickFont(text, lang) {
  if (lang === 'ar') return 'Arabic';
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(text || '')) ? 'Arabic' : 'Roboto';
}

function t(en, ar, lang) {
  return lang === 'ar' ? ar : en;
}

function txt(val, lang, opts = {}) {
  const s = String(val ?? '-');
  return {
    text: s,
    font: pickFont(s, lang),
    fontSize: opts.size || 9,
    alignment: lang === 'ar' ? 'right' : 'left',
    ...opts,
  };
}

function sectionTitle(section, lang) {
  return {
    text: t(section.en, section.ar, lang),
    style: 'sectionTitle',
    alignment: lang === 'ar' ? 'right' : 'left',
    margin: [0, 14, 0, 6],
  };
}

function kvTable(rows, lang) {
  return {
    table: {
      widths: lang === 'ar' ? ['62%', '38%'] : ['38%', '62%'],
      body: rows.map(([labelEn, labelAr, value]) => [
        {
          text: t(labelEn, labelAr, lang),
          fontSize: 8,
          color: '#444',
          font: lang === 'ar' ? 'Arabic' : 'Roboto',
          alignment: lang === 'ar' ? 'right' : 'left',
        },
        txt(value, lang),
      ]),
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 8],
  };
}

function buildChecklist(data, lang) {
  const items = [
    ['Electrical Test', 'اختبار كهربائي', data.checklist.electricalTest],
    ['Safety Inspection', 'فحص السلامة', data.checklist.safetyInspection],
    ['Area Cleaned', 'تنظيف المنطقة', data.checklist.areaCleaned],
    ['Equipment Tested', 'اختبار المعدات', data.checklist.equipmentTested],
    ['Customer Confirmed', 'تأكيد العميل', data.checklist.customerConfirmed],
    ['Photos Uploaded', 'رفع الصور', data.checklist.photosUploaded],
  ];
  return items.map(([en, ar, ok]) => ({
    text: `${ok ? '✔' : '✘'} ${t(en, ar, lang)}`,
    font: lang === 'ar' ? 'Arabic' : 'Roboto',
    fontSize: 10,
    alignment: lang === 'ar' ? 'right' : 'left',
    margin: [0, 2, 0, 2],
  }));
}

function buildDocDefinition(data) {
  const lang = data.language === 'ar' ? 'ar' : 'en';
  const tr = (en, ar) => t(en, ar, lang);
  const tkt = data.ticket;
  const s = data.school;
  const content = [];
  const defaultFont = lang === 'ar' ? 'Arabic' : 'Roboto';

  content.push({
    text: tr(SECTIONS.title.en, SECTIONS.title.ar),
    style: 'mainTitle',
    alignment: 'center',
    font: defaultFont,
  });
  content.push({
    columns: [
      { text: `${tr('Report ID', 'رقم التقرير')}: ${data.reportId}`, fontSize: 8, font: defaultFont },
      {
        text: `${tr('Ticket', 'البلاغ')}: ${tkt.number}`,
        fontSize: 8,
        alignment: lang === 'ar' ? 'left' : 'right',
        font: defaultFont,
      },
    ],
    margin: [0, 4, 0, 12],
  });

  // 1. Ticket Information
  content.push(sectionTitle(SECTIONS.ticketInfo, lang));
  content.push(
    kvTable(
      [
        ['Ticket Number', 'رقم البلاغ', tkt.number],
        ['Ticket ID', 'معرف البلاغ', tkt.id],
        ['Title', 'العنوان', tkt.title],
        ['Description', 'الوصف', tkt.description],
        ['Category', 'الفئة', tkt.category],
        ['Sub Category', 'النوع الفرعي', tkt.subcategory],
        ['Priority', 'الأولوية', tkt.priority],
        ['Status', 'الحالة', tkt.status],
        ['SLA Status', 'حالة SLA', lang === 'ar' ? tkt.slaStatusAr : tkt.slaStatus],
        ['Created Date', 'تاريخ الإنشاء', lang === 'ar' ? tkt.createdAtAr : tkt.createdAt],
        ['Due Date', 'تاريخ الاستحقاق', tkt.dueDate],
        ['Completion Date', 'تاريخ الإنجاز', tkt.completionDate],
        ['Approval Date', 'تاريخ الموافقة', tkt.approvalDate],
        ['Estimated Time', 'الوقت المقدر', tkt.estimatedHours],
        ['Actual Working Time', 'وقت العمل الفعلي', tkt.actualHours],
      ],
      lang
    )
  );

  // 2. School
  content.push(sectionTitle(SECTIONS.schoolInfo, lang));
  content.push(
    kvTable(
      [
        ['School Name', 'اسم المدرسة', s.name],
        ['School Code', 'كود المدرسة', s.code],
        ['Region', 'المنطقة', s.region],
        ['Address', 'العنوان', s.address],
        ['Contact Person', 'جهة الاتصال', s.contactPerson],
        ['Contact Phone', 'الهاتف', s.phone],
      ],
      lang
    )
  );

  // 3. Asset
  content.push(sectionTitle(SECTIONS.assetInfo, lang));
  if (data.asset) {
    content.push(
      kvTable(
        [
          ['Asset Name', 'اسم الأصل', data.asset.name],
          ['Asset Code', 'كود الأصل', data.asset.code],
          ['Asset Type', 'نوع الأصل', data.asset.type],
          ['Serial Number', 'الرقم التسلسلي', data.asset.serial],
          ['Location', 'الموقع', data.asset.location],
          ['Installation Date', 'تاريخ التركيب', data.asset.installDate],
          ['Warranty Status', 'حالة الضمان', lang === 'ar' ? data.asset.warrantyAr : data.asset.warrantyEn],
          ['Manufacturer', 'الشركة المصنعة', data.asset.manufacturer],
        ],
        lang
      )
    );
  } else {
    content.push(txt(tr('No asset linked', 'لا يوجد أصل مرتبط'), lang, { italics: true }));
  }

  // 4. Reporter
  content.push(sectionTitle(SECTIONS.reporterInfo, lang));
  content.push(
    kvTable(
      [
        ['Reported By', 'المُبلِّغ', data.reporter.name],
        ['Position', 'المنصب', data.reporter.position],
        ['Phone', 'الهاتف', data.reporter.phone],
        ['Email', 'البريد', data.reporter.email],
        ['Report Date', 'تاريخ البلاغ', data.reporter.date],
      ],
      lang
    )
  );

  // 5. Assignment
  content.push(sectionTitle(SECTIONS.assignmentInfo, lang));
  content.push(
    kvTable(
      [
        ['Assigned Team', 'الفريق', data.assignment.team],
        ['Team Code', 'كود الفريق', data.assignment.teamCode],
        ['Team Leader', 'قائد الفريق', data.assignment.leader],
      ],
      lang
    )
  );
  if (data.assignment.workers.length) {
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', '*', 'auto', 'auto', 'auto', 'auto'],
        body: [
          [
            txt(tr('Worker', 'العامل'), lang, { bold: true }),
            txt(tr('Specialty', 'التخصص'), lang, { bold: true }),
            txt(tr('Assigned', 'تعيين'), lang, { bold: true }),
            txt(tr('Started', 'بدء'), lang, { bold: true }),
            txt(tr('Finished', 'انتهاء'), lang, { bold: true }),
            txt(tr('Hours', 'ساعات'), lang, { bold: true }),
          ],
          ...data.assignment.workers.map((w) => [
            txt(w.name, lang),
            txt(w.specialty, lang),
            txt(w.assigned, lang),
            txt(w.started, lang),
            txt(w.finished, lang),
            txt(String(w.hours), lang),
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
      fontSize: 8,
      margin: [0, 0, 0, 8],
    });
  }

  // 6. Timeline
  content.push(sectionTitle(SECTIONS.timeline, lang));
  if (data.timeline.length) {
    content.push({
      table: {
        headerRows: 1,
        widths: ['auto', '*', '*'],
        body: [
          [
            txt(tr('Date', 'التاريخ'), lang, { bold: true }),
            txt(tr('User', 'المستخدم'), lang, { bold: true }),
            txt(tr('Action', 'الإجراء'), lang, { bold: true }),
          ],
          ...data.timeline.map((e) => [
            txt(lang === 'ar' ? e.dateAr : e.date, lang),
            txt(e.user, lang),
            txt(lang === 'ar' ? e.actionAr : e.actionEn, lang),
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
      fontSize: 8,
    });
  }

  // 7. Work Performed
  content.push(sectionTitle(SECTIONS.workPerformed, lang));
  const wp = data.workPerformed;
  const workBlocks = [
    ['Root Cause', 'السبب الجذري', wp.rootCause],
    ['Inspection', 'الفحص', wp.inspection],
    ['Diagnostic Result', 'نتيجة التشخيص', wp.diagnostic],
    ['Corrective Actions', 'الإجراءات التصحيحية', wp.corrective],
    ['Preventive Recommendation', 'التوصيات الوقائية', wp.recommendation],
  ];
  for (const [titleEn, titleAr, body] of workBlocks) {
    content.push({
      text: tr(titleEn, titleAr),
      style: 'subHeading',
      alignment: lang === 'ar' ? 'right' : 'left',
      font: defaultFont,
      margin: [0, 6, 0, 2],
    });
    content.push(txt(body, lang, { margin: [0, 0, 0, 4] }));
  }

  // 8. Materials
  content.push(sectionTitle(SECTIONS.materials, lang));
  if (data.materials.rows.length) {
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto', 'auto'],
        body: [
          [
            txt(tr('Material', 'المادة'), lang, { bold: true }),
            txt(tr('Qty', 'الكمية'), lang, { bold: true }),
            txt(tr('Unit Cost', 'سعر الوحدة'), lang, { bold: true }),
            txt(tr('Total', 'الإجمالي'), lang, { bold: true }),
            txt('SKU', lang, { bold: true }),
          ],
          ...data.materials.rows.map((r) => [
            txt(r.name, lang),
            txt(`${r.quantity} ${r.unit}`, lang),
            txt(r.unitCost.toFixed(2), lang),
            txt(r.total, lang),
            txt(r.sku, lang),
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
      fontSize: 8,
    });
  } else {
    content.push(txt(tr('No materials recorded', 'لا توجد مواد'), lang));
  }
  content.push({
    margin: [0, 8, 0, 0],
    stack: [
      txt(`${tr('Total Materials Cost', 'إجمالي المواد')}: ${data.materials.materialsTotal}`, lang),
      txt(`${tr('Labor Cost', 'تكلفة العمالة')}: ${data.materials.laborCost}`, lang),
      txt(`${tr('Transportation Cost', 'تكلفة النقل')}: ${data.materials.transportCost}`, lang),
      txt(`${tr('Additional Cost', 'تكاليف إضافية')}: ${data.materials.additionalCost}`, lang),
      {
        text: `${tr('Grand Total', 'الإجمالي الكلي')}: ${data.materials.grandTotal}`,
        bold: true,
        fontSize: 11,
        font: defaultFont,
        alignment: lang === 'ar' ? 'right' : 'left',
        margin: [0, 4, 0, 0],
      },
    ],
  });

  // 9. Images
  content.push(sectionTitle(SECTIONS.images, lang));
  for (const section of data.imageSections) {
    if (!section.items.length) continue;
    content.push({
      text: section.label,
      style: 'subHeading',
      font: defaultFont,
      alignment: lang === 'ar' ? 'right' : 'left',
      margin: [0, 4, 0, 4],
    });
    const row = [];
    for (const img of section.items.slice(0, 6)) {
      row.push({ image: img.base64, width: 80, height: 80, margin: [0, 0, 4, 4] });
    }
    content.push({ columns: row, columnGap: 4, margin: [0, 0, 0, 8] });
  }
  if (!data.imageSections.some((sec) => sec.items.length)) {
    content.push(txt(tr('No images attached', 'لا توجد صور'), lang));
  }

  // 10. Notes
  content.push(sectionTitle(SECTIONS.notes, lang));
  content.push(
    kvTable(
      [
        ['Worker Notes', 'ملاحظات العامل', data.notes.worker],
        ['Leader Notes', 'ملاحظات القائد', data.notes.leader],
        ['School Note', 'ملاحظات المدرسة', data.notes.school],
      ],
      lang
    )
  );

  // 11. SLA
  content.push(sectionTitle(SECTIONS.sla, lang));
  content.push(
    kvTable(
      [
        ['Response Time Target', 'هدف وقت الاستجابة', data.sla.responseTarget],
        ['Resolution Time Target', 'هدف وقت الحل', data.sla.resolutionTarget],
        ['Actual Time', 'الوقت الفعلي', data.sla.actual],
        ['Breached', 'تجاوز SLA', lang === 'ar' ? data.sla.breachedAr : data.sla.breachedEn],
        ['Penalty', 'الغرامة', lang === 'ar' ? data.sla.penaltyAr : data.sla.penaltyEn],
      ],
      lang
    )
  );

  // 12. Checklist
  content.push(sectionTitle(SECTIONS.checklist, lang));
  content.push(...buildChecklist(data, lang));

  // 13. Signatures
  content.push(sectionTitle(SECTIONS.signatures, lang));
  content.push(
    kvTable(
      [
        ['Worker Signature', 'توقيع العامل', data.signatures.worker],
        ['Team Leader Signature', 'توقيع القائد', data.signatures.leader],
        ['School Admin Signature', 'توقيع المدرسة', data.signatures.schoolAdmin],
        ['Maintenance Manager', 'مدير الصيانة', data.signatures.manager],
        ['Date', 'التاريخ', data.signatures.date],
      ],
      lang
    )
  );

  // 14. QR Code
  content.push(sectionTitle(SECTIONS.qr, lang));
  content.push({
    columns: [
      { image: data.qrCode, width: 100, height: 100 },
      {
        width: '*',
        stack: [
          txt(tr('Scan to open ticket in ERP', 'امسح لفتح البلاغ في النظام'), lang),
          txt(data.ticketUrl, lang, { size: 8, color: '#2563eb' }),
        ],
        margin: [12, 20, 0, 0],
      },
    ],
  });

  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 60],
    defaultStyle: { font: defaultFont, fontSize: 10, alignment: lang === 'ar' ? 'right' : 'left' },
    styles: {
      mainTitle: { fontSize: 16, bold: true, font: defaultFont, color: '#1e40af' },
      sectionTitle: { fontSize: 12, bold: true, color: '#1e3a8a', font: defaultFont },
      subHeading: { fontSize: 10, bold: true, font: defaultFont },
    },
    footer: (currentPage, pageCount) => ({
      margin: [40, 0, 40, 20],
      columns: [
        {
          text: `${tr('Generated by Maintenance ERP', 'تم التوليد بواسطة نظام الصيانة')} | ${data.reportId}\nVersion 2.0`,
          fontSize: 7,
          color: '#666',
          font: defaultFont,
          alignment: lang === 'ar' ? 'right' : 'left',
        },
        {
          text: tr(`Page ${currentPage} of ${pageCount}`, `صفحة ${currentPage} من ${pageCount}`),
          alignment: lang === 'ar' ? 'left' : 'right',
          fontSize: 7,
          color: '#666',
          font: defaultFont,
        },
      ],
    }),
    content,
  };
}

export async function buildWorkOrderPdf(data, filepath) {
  ensureFonts();
  const docDefinition = buildDocDefinition(data);
  const pdf = pdfMake.createPdf(docDefinition);
  await pdf.write(filepath);
}
