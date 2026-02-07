import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildQueueZip } from '../utils/zipBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');

const router = Router();

router.post('/queue', (req, res) => {
  try {
    const { shots, defaultParams } = req.body;

    if (!shots || !Array.isArray(shots) || shots.length === 0) {
      return res.status(400).json({ error: 'No shots provided' });
    }

    const exportShots = shots.map((shot: any, index: number) => ({
      taskId: index + 1,
      prompt: shot.prompt,
      refImagePath: shot.refImagePath || null,
      endRefImagePath: shot.endRefImagePath || null,
      audioPath: shot.audioPath || null,
      params: {
        ...defaultParams,
        ...shot.params,
        prompt: shot.prompt,
      },
    }));

    const stream = buildQueueZip(exportShots, DATA_DIR);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=queue.zip');
    stream.pipe(res);
  } catch (e: any) {
    console.error('Export error:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
