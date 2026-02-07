import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { PassThrough } from 'stream';

interface QueueTask {
  id: number;
  params: Record<string, any>;
}

interface ExportShot {
  taskId: number;
  prompt: string;
  refImagePath?: string;
  endRefImagePath?: string;
  audioPath?: string;
  params: Record<string, any>;
}

export function buildQueueZip(
  shots: ExportShot[],
  dataDir: string
): PassThrough {
  const passthrough = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 5 } });

  archive.pipe(passthrough);

  const queue: QueueTask[] = [];

  for (const shot of shots) {
    const imageFilename = shot.refImagePath
      ? `task${shot.taskId}_image_start_0${path.extname(shot.refImagePath)}`
      : null;
    const endImageFilename = shot.endRefImagePath
      ? `task${shot.taskId}_image_end_0${path.extname(shot.endRefImagePath)}`
      : null;
    const audioFilename = shot.audioPath
      ? `task${shot.taskId}_audio_guide_0${path.extname(shot.audioPath)}`
      : null;

    const hasStart = !!shot.refImagePath;
    const hasEnd = !!shot.endRefImagePath;

    const taskParams: Record<string, any> = {
      ...shot.params,
      prompt: shot.prompt,
      image_start: imageFilename,
      image_end: endImageFilename,
      image_prompt_type: hasStart && hasEnd ? 'SE' : hasStart ? 'S' : shot.params.image_prompt_type,
      audio_guide: audioFilename,
    };

    queue.push({ id: shot.taskId, params: taskParams });

    // Add start image file if it exists
    if (shot.refImagePath) {
      const fullImagePath = path.isAbsolute(shot.refImagePath)
        ? shot.refImagePath
        : path.join(dataDir, 'images', shot.refImagePath);

      if (fs.existsSync(fullImagePath)) {
        archive.file(fullImagePath, { name: imageFilename! });
      }
    }

    // Add end image file if it exists
    if (shot.endRefImagePath) {
      const fullEndImagePath = path.isAbsolute(shot.endRefImagePath)
        ? shot.endRefImagePath
        : path.join(dataDir, 'images', shot.endRefImagePath);

      if (fs.existsSync(fullEndImagePath)) {
        archive.file(fullEndImagePath, { name: endImageFilename! });
      }
    }

    // Add audio file if it exists
    if (shot.audioPath) {
      const fullAudioPath = path.isAbsolute(shot.audioPath)
        ? shot.audioPath
        : path.join(dataDir, 'audio', shot.audioPath);

      if (fs.existsSync(fullAudioPath)) {
        archive.file(fullAudioPath, { name: audioFilename! });
      }
    }
  }

  // Add queue.json
  archive.append(JSON.stringify(queue, null, 4), { name: 'queue.json' });

  archive.finalize();

  return passthrough;
}
