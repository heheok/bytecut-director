import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import projectRoutes from './routes/project.js';
import imageRoutes from './routes/images.js';
import audioRoutes from './routes/audio.js';
import exportRoutes from './routes/export.js';
import videoRoutes from './routes/videos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Ensure data directories exist
mkdirSync(path.join(ROOT, 'data', 'projects'), { recursive: true });
mkdirSync(path.join(ROOT, 'data', 'images'), { recursive: true });
mkdirSync(path.join(ROOT, 'data', 'images', 'thumbs'), { recursive: true });
mkdirSync(path.join(ROOT, 'data', 'audio'), { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/project', projectRoutes);
app.use('/api/import', projectRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/videos', videoRoutes);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
});
