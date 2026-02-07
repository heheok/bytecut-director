import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();

const VIDEO_EXTS = ['.mp4', '.webm'];

// Browse a folder for video files + list subdirectories for navigation
router.get('/browse', (req, res) => {
  const dir = (req.query.dir as string) || '';
  if (!dir) {
    return res.status(400).json({ error: 'dir query parameter required' });
  }

  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  try {
    const entries = fs.readdirSync(resolved);
    const files = entries
      .filter((e) => VIDEO_EXTS.includes(path.extname(e).toLowerCase()))
      .map((e) => ({
        filename: e,
        path: path.join(resolved, e),
        stem: path.basename(e, path.extname(e)),
      }));

    const dirs = entries
      .filter((e) => {
        try {
          return fs.statSync(path.join(resolved, e)).isDirectory();
        } catch {
          return false;
        }
      })
      .sort()
      .map((e) => ({
        name: e,
        path: path.join(resolved, e),
      }));

    const parentDir = path.dirname(resolved);
    res.json({
      files,
      dirs,
      currentDir: resolved,
      parentDir: parentDir !== resolved ? parentDir : null,
    });
  } catch {
    res.json({ files: [], dirs: [], currentDir: resolved, parentDir: null });
  }
});

// List drive roots (Windows) or filesystem root
router.get('/roots', (_req, res) => {
  if (process.platform === 'win32') {
    // List available drive letters
    const drives: string[] = [];
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const drive = `${letter}:\\`;
      try {
        fs.accessSync(drive);
        drives.push(drive);
      } catch {
        // drive doesn't exist
      }
    }
    res.json({ roots: drives, home: os.homedir() });
  } else {
    res.json({ roots: ['/'], home: os.homedir() });
  }
});

// Serve an external video file by absolute path (supports Range for seeking)
router.get('/external', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).send('path query parameter required');
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return res.status(404).send('Not found');
  }

  const stat = fs.statSync(resolved);
  const fileSize = stat.size;
  const ext = path.extname(resolved).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
  };
  const contentType = mimeMap[ext] || 'video/mp4';

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(resolved, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(resolved).pipe(res);
  }
});

export default router;
