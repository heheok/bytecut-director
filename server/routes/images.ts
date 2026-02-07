import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const IMAGES_DIR = path.join(ROOT, 'data', 'images');
const THUMBS_DIR = path.join(IMAGES_DIR, 'thumbs');

const THUMB_WIDTH = 384; // ~2x the largest card display size for retina

async function generateThumbnail(filename: string): Promise<boolean> {
  const src = path.join(IMAGES_DIR, filename);
  const dst = path.join(THUMBS_DIR, filename);
  if (!fs.existsSync(src)) return false;
  if (fs.existsSync(dst)) return true; // already exists
  try {
    await sharp(src)
      .resize(THUMB_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(dst.replace(/\.png$/, '.jpg'));
    return true;
  } catch (e) {
    console.warn(`Thumbnail generation failed for ${filename}:`, e);
    return false;
  }
}

function getThumbFilename(filename: string): string {
  return filename.replace(/\.png$/, '.jpg');
}

// Use memory storage so we can process images before saving
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const router = Router();

// Upload images
router.post('/upload', upload.array('images', 50), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const results = [];

    for (const f of files) {
      // Always ensure RGB (no alpha) and save as PNG — LTX-2 needs 3-channel images
      const buffer = await sharp(f.buffer).removeAlpha().png().toBuffer();
      const filename = `${uuid()}.png`;
      const filePath = path.join(IMAGES_DIR, filename);
      fs.writeFileSync(filePath, buffer);

      // Generate thumbnail
      await generateThumbnail(filename);

      results.push({
        filename,
        originalName: f.originalname,
        path: `/api/images/${filename}`,
      });
    }

    res.json({ files: results });
  } catch (e: any) {
    console.error('Upload error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Generate thumbnails for all existing images (migration endpoint)
router.post('/generate-thumbnails', async (_req, res) => {
  try {
    const entries = fs.readdirSync(IMAGES_DIR);
    const imageExts = ['.png', '.jpg', '.jpeg', '.webp'];
    const images = entries.filter(
      (e) => imageExts.includes(path.extname(e).toLowerCase()) && !fs.statSync(path.join(IMAGES_DIR, e)).isDirectory()
    );

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const filename of images) {
      const thumbName = getThumbFilename(filename);
      const thumbPath = path.join(THUMBS_DIR, thumbName);
      if (fs.existsSync(thumbPath)) {
        skipped++;
        continue;
      }
      const ok = await generateThumbnail(filename);
      if (ok) generated++;
      else failed++;
    }

    res.json({ total: images.length, generated, skipped, failed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Browse images in data/images or an external folder
router.get('/browse', (req, res) => {
  const dir = (req.query.dir as string) || IMAGES_DIR;
  const targetDir = path.resolve(dir);
  const isProjectDir = targetDir === path.resolve(IMAGES_DIR);

  try {
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    const entries = fs.readdirSync(targetDir);
    const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];

    const files = entries
      .filter((e) => {
        const ext = path.extname(e).toLowerCase();
        return imageExts.includes(ext);
      })
      .map((e) => {
        const fullPath = path.join(targetDir, e);
        const mtime = fs.statSync(fullPath).mtimeMs;
        return {
          filename: e,
          path: fullPath,
          // Project images use the direct /:filename route (enables thumbnails);
          // external images use the external?path= route
          url: isProjectDir ? '' : `/api/images/external?path=${encodeURIComponent(fullPath)}`,
          mtime,
        };
      })
      .sort((a, b) => a.mtime - b.mtime);

    const dirs = entries
      .filter((e) => {
        try {
          const stat = fs.statSync(path.join(targetDir, e));
          return stat.isDirectory() && e !== 'thumbs';
        } catch {
          return false;
        }
      })
      .map((e) => ({
        name: e,
        path: path.join(targetDir, e),
      }));

    res.json({ files, dirs, currentDir: targetDir });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Serve external image by path
router.get('/external', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.resolve(filePath));
});

// Copy an external image into the project
router.post('/import-external', async (req, res) => {
  const { sourcePath } = req.body;
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return res.status(404).json({ error: 'Source file not found' });
  }

  try {
    const buffer = fs.readFileSync(sourcePath);
    const filename = `${uuid()}.png`;
    fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);

    // Generate thumbnail
    await generateThumbnail(filename);

    res.json({
      filename,
      path: `/api/images/${filename}`,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Serve thumbnail — falls back to full image if thumb doesn't exist
router.get('/thumb/:filename', (req, res) => {
  const thumbName = getThumbFilename(req.params.filename);
  const thumbPath = path.join(THUMBS_DIR, thumbName);
  if (fs.existsSync(thumbPath)) {
    return res.sendFile(thumbPath);
  }
  // Fallback to full image
  const fullPath = path.join(IMAGES_DIR, req.params.filename);
  if (fs.existsSync(fullPath)) {
    return res.sendFile(fullPath);
  }
  res.status(404).send('Not found');
});

// Serve image from data/images
router.get('/:filename', (req, res) => {
  const filePath = path.join(IMAGES_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(filePath);
});

export default router;
