/**
 * Client-side audio processing utilities using Web Audio API.
 * Handles decode, waveform extraction, cropping, and WAV encoding.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** Decode an audio File into an AudioBuffer */
export async function decodeAudio(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = getAudioContext();
  return ctx.decodeAudioData(arrayBuffer);
}

/** Downsample an AudioBuffer's first channel into `numBins` peak values (0-1) */
export function extractPeaks(buffer: AudioBuffer, numBins: number): number[] {
  const data = buffer.getChannelData(0);
  const samplesPerBin = Math.floor(data.length / numBins);
  const peaks: number[] = new Array(numBins);

  for (let i = 0; i < numBins; i++) {
    let max = 0;
    const start = i * samplesPerBin;
    const end = Math.min(start + samplesPerBin, data.length);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(data[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }

  return peaks;
}

/** Crop a region from an AudioBuffer using OfflineAudioContext */
export async function cropAudioBuffer(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number
): Promise<AudioBuffer> {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.min(Math.floor(endSec * sampleRate), buffer.length);
  const length = endSample - startSample;

  if (length <= 0) {
    throw new Error('Invalid crop region');
  }

  const numChannels = buffer.numberOfChannels;
  const offline = new OfflineAudioContext(numChannels, length, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0, startSec, endSec - startSec);

  return offline.startRendering();
}

/** Encode an AudioBuffer as a WAV Blob (PCM 16-bit) */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = buffer.length;
  const dataSize = numSamples * blockAlign;

  // Interleave channels
  const interleaved = new Float32Array(numSamples * numChannels);
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < numSamples; i++) {
      interleaved[i * numChannels + ch] = channelData[i];
    }
  }

  // Build WAV file
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** Format seconds as M:SS.s */
export function formatAudioTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
