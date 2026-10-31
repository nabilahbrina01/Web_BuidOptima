const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { UPLOAD_PATH, MAX_FILE_SIZE_MB } = require('../config/constants');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '..', UPLOAD_PATH, 'images');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    const err = new Error('Only image files are allowed (jpg, jpeg, png, webp)');
    err.status = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

module.exports = upload;
