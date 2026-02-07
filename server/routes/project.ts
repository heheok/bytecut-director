import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { parseAllMarkdown } from '../utils/markdownParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const PROJECTS_DIR = path.join(ROOT, 'data', 'projects');

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// List all projects
router.get('/', (_req, res) => {
  try {
    const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.json'));
    const projects = files.map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8'));
      return { id: data.id, name: data.name };
    });
    res.json(projects);
  } catch {
    res.json([]);
  }
});

// Load project
router.get('/:id', (req, res) => {
  const filePath = path.join(PROJECTS_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Project not found' });
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  res.json(data);
});

// Save project
router.post('/', (req, res) => {
  const project = req.body;
  if (!project.id) {
    return res.status(400).json({ error: 'Project must have an id' });
  }
  const filePath = path.join(PROJECTS_DIR, `${project.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
  res.json({ ok: true, id: project.id });
});

// Delete project
router.delete('/:id', (req, res) => {
  const filePath = path.join(PROJECTS_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Project not found' });
  }
  fs.unlinkSync(filePath);
  res.json({ ok: true });
});

// Import markdown files
router.post('/markdown', upload.array('files', 10), (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    let shotlistContent = '';
    let characterContent = '';

    for (const file of files) {
      const content = file.buffer.toString('utf-8');
      const name = file.originalname.toLowerCase();

      if (name.includes('shotlist') || name.includes('shot_list') || name.includes('shot-list')) {
        shotlistContent = content;
      } else if (name.includes('character') || name.includes('establishment')) {
        characterContent = content;
      } else {
        // If only one file, treat it as shot list
        if (files.length === 1) {
          shotlistContent = content;
        }
      }
    }

    if (!shotlistContent && !characterContent) {
      // Try the first file as shotlist
      shotlistContent = files[0].buffer.toString('utf-8');
    }

    const project = parseAllMarkdown(shotlistContent, characterContent || undefined);

    // Auto-save the imported project
    const filePath = path.join(PROJECTS_DIR, `${project.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');

    res.json(project);
  } catch (e: any) {
    console.error('Markdown import error:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
