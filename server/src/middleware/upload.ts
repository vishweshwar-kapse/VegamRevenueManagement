import multer from 'multer';
import path from 'path';
import fs from 'fs';

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// ─── Contract upload ──────────────────────────────────────────────────────────

const contractStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '../../uploads/contracts');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `contract-${unique}${path.extname(file.originalname)}`);
  },
});

const contractFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF (.pdf) and Word (.doc, .docx) files are allowed'));
  }
};

export const uploadContract = multer({
  storage: contractStorage,
  fileFilter: contractFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
}).single('file');

// ─── SOW document upload ──────────────────────────────────────────────────────

const sowStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '../../uploads/sows');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `sow-${unique}${path.extname(file.originalname)}`);
  },
});

export const uploadSOW = multer({
  storage: sowStorage,
  fileFilter: contractFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
}).single('file');

// ─── PO document upload ───────────────────────────────────────────────────────

const poStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '../../uploads/pos');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `po-${unique}${path.extname(file.originalname)}`);
  },
});

// A single PO may carry several documents (PO copy, amendments, annexures).
export const uploadPO = multer({
  storage: poStorage,
  fileFilter: contractFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
}).array('files', 10);
