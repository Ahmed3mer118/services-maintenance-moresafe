import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { cloudinary } from '../config/cloudinary.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

async function saveLocally(buffer, options = {}) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(options.filename || '') || '.jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(UPLOAD_DIR, name);
  await fs.writeFile(filePath, buffer);
  return {
    url: `/uploads/${name}`,
    publicId: null,
    filename: options.filename || name,
    mimeType: options.mimeType || 'image/jpeg',
    size: buffer.length,
  };
}

export async function uploadToCloudinary(buffer, options = {}) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return saveLocally(buffer, options);
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'maintenance_erp', resource_type: 'auto', ...options },
        (err, uploadResult) => {
          if (err) return reject(err);
          resolve(uploadResult);
        }
      );
      stream.end(buffer);
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      filename: options.filename,
      mimeType: result.resource_type,
      size: result.bytes,
    };
  } catch (err) {
    logger.warn('Cloudinary upload failed, saving locally', err?.message || err);
    return saveLocally(buffer, options);
  }
}

export async function uploadMultipleFiles(files, userId) {
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const uploaded = await uploadToCloudinary(file.buffer, {
          filename: file.originalname,
          mimeType: file.mimetype,
        });
        return { ...uploaded, uploadedBy: userId, uploadedAt: new Date() };
      } catch (err) {
        logger.error('File upload error', err);
        return null;
      }
    })
  );
  const successful = results.filter(Boolean);
  if (files.length && !successful.length) {
    throw new AppError('Upload failed', 500);
  }
  return successful;
}
