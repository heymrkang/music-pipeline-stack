import path from 'node:path';

export const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.flac',
  '.m4a',
  '.mp4',
  '.ogg',
  '.opus',
  '.wav',
  '.aiff',
  '.ape',
  '.wma'
]);

export function isAudioFile(filePath) {
  const lower = path.basename(filePath).toLowerCase();
  if (lower.startsWith('.') || lower.endsWith('.part') || lower.endsWith('.tmp') || lower.endsWith('.ytdl')) return false;
  return AUDIO_EXTENSIONS.has(path.extname(lower));
}

export function sanitizeSegment(value, fallback = 'Unknown') {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

export function assertInside(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Invalid path');
  }
  return resolvedCandidate;
}
