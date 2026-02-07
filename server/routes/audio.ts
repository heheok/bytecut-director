import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { v4 as uuid } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const AUDIO_DIR = path.join(ROOT, 'data', 'audio');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AUDIO_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = ['.wav', '.mp3', '.ogg', '.flac'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const router = Router();

// Upload audio files
router.post('/upload', upload.array('audio', 50), (req, res) => {
  const files = req.files as Express.Multer.File[];
  res.json({
    files: files.map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      path: `/api/audio/${f.filename}`,
    })),
  });
});

// List audio files
router.get('/browse', (_req, res) => {
  try {
    const entries = fs.readdirSync(AUDIO_DIR);
    const audioExts = ['.wav', '.mp3', '.ogg', '.flac'];
    const files = entries
      .filter((e) => audioExts.includes(path.extname(e).toLowerCase()))
      .map((e) => ({
        filename: e,
        path: `/api/audio/${e}`,
      }));
    res.json({ files });
  } catch {
    res.json({ files: [] });
  }
});

// Serve audio file
router.get('/:filename', (req, res) => {
  const filePath = path.join(AUDIO_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(filePath);
});

export default router;
