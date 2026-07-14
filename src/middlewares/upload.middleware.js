import multer from 'multer';
import path from 'path';
import { AppError } from '../utils/AppError.js';

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|pdf/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type', 400), false);
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

export const uploadImages = upload.array('images', 10);
export const uploadSingle = upload.single('file');
