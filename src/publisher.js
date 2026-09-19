import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import { assertInside, isAudioFile } from './paths.js';

const PORT = Number(process.env.PORT || 8080);
const STAGING_DIR = process.env.STAGING_DIR || '/media/staging';
const LIBRARY_DIR = process.env.LIBRARY_DIR || '/media/library';
const REQUIRE_ALBUM = String(process.env.REQUIRE_ALBUM || 'false').toLowerCase() === 'true';

async function ensureDirs() {
  await Promise.all([STAGING_DIR, LIBRARY_DIR].map((dir) => fs.mkdir(dir, { recursive: true })));
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.isFile() && isAudioFile(fullPath)) files.push(fullPath);
  }
  return files;
}

async function readInfo(filePath) {
  const stat = await fs.stat(filePath);
  let metadata = {};
  try {
    const parsed = await parseFile(filePath, { duration: false, skipCovers: true });
    metadata = parsed.common || {};
  } catch {}
  const rel = path.relative(STAGING_DIR, filePath);
  const title = metadata.title || '';
  const artist = Array.isArray(metadata.artists) && metadata.artists.length ? metadata.artists.join(', ') : metadata.artist || '';
  const album = metadata.album || '';
  const ready = Boolean(title && artist && (!REQUIRE_ALBUM || album));
  return {
    path: rel,
    name: path.basename(filePath),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    title,
    artist,
    album,
    track: metadata.track?.no || null,
    ready
  };
}

async function nextAvailable(targetPath) {
  const parsed = path.parse(targetPath);
  let candidate = targetPath;
  let index = 1;
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
      index += 1;
    } catch {
      return candidate;
    }
  }
}

function destinationFor(sourcePath) {
  return path.join(LIBRARY_DIR, path.basename(sourcePath));
}

async function publishOne(relativePath) {
  const source = assertInside(STAGING_DIR, path.join(STAGING_DIR, relativePath));
  const info = await readInfo(source);
  if (!info.ready) {
    throw new Error(`${relativePath}: required metadata missing`);
  }

  const target = await nextAvailable(destinationFor(source));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rename(source, target).catch(async () => {
    await fs.copyFile(source, target);
    await fs.unlink(source);
  });

  return {
    source: relativePath,
    target: path.relative(LIBRARY_DIR, target)
  };
}

await ensureDirs();

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static('public'));

app.get('/api/files', async (_req, res, next) => {
  try {
    const files = await walk(STAGING_DIR);
    const result = await Promise.all(files.map(readInfo));
    result.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    res.json({ files: result });
  } catch (error) {
    next(error);
  }
});

app.post('/api/publish', async (req, res, next) => {
  try {
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    if (!files.length) return res.status(400).json({ error: 'No files selected' });
    const published = [];
    for (const file of files) {
      published.push(await publishOne(String(file)));
    }
    res.json({ published });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  res.status(400).json({ error: error.message || 'Request failed' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[publisher] listening on :${PORT} staging=${STAGING_DIR} library=${LIBRARY_DIR}`);
});
