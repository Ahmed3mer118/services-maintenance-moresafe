import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, unique: true },
    reportId: { type: String, unique: true, sparse: true },
    pdfUrl: String,
    pdfUrlEn: String,
    pdfUrlAr: String,
    language: { type: String, enum: ['en', 'ar', 'bilingual'], default: 'bilingual' },
    version: { type: String, default: '2.0' },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    generatedAt: { type: Date, default: Date.now },
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

const Report = mongoose.model('Report', reportSchema);
export default Report;
