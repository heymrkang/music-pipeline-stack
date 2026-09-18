import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { isAudioFile } from './paths.js';

const RAW_DIR = process.env.RAW_DIR || '/media/downloads-raw';
const STAGING_DIR = process.env.STAGING_DIR || '/media/staging';
const FAILED_DIR = process.env.FAILED_DIR || '/media/failed';
const SCAN_INTERVAL_SECONDS = Number(process.env.SCAN_INTERVAL_SECONDS || 20);
const STABLE_SECONDS = Number(process.env.STABLE_SECONDS || 20);

async function ensureDirs() {
  await Promise.all([RAW_DIR, STAGING_DIR, FAILED_DIR].map((dir) => fs.mkdir(dir, { recursive: true })));
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.tmp') continue;
      files.push(...await walk(fullPath));
    } else if (entry.isFile() && isAudioFile(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function isStable(filePath) {
  const first = await fs.stat(filePath);
  const ageMs = Date.now() - first.mtimeMs;
  if (ageMs < STABLE_SECONDS * 1000) return false;
  await sleep(1000);
  const second = await fs.stat(filePath);
  return first.size === second.size && first.mtimeMs === second.mtimeMs;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runFfmpeg(input, output) {
  return new Promise((resolve, reject) => {
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-map', '0:a', '-c', 'copy', '-map_metadata', '-1', '-vn', output];
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

async function nextAvailable(dir, baseName) {
  const parsed = path.parse(baseName);
  let candidate = path.join(dir, baseName);
  let index = 1;
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(dir, `${parsed.name} (${index})${parsed.ext}`);
      index += 1;
    } catch {
      return candidate;
    }
  }
}

async function moveFailed(filePath, reason) {
  const target = await nextAvailable(FAILED_DIR, path.basename(filePath));
  await fs.rename(filePath, target).catch(async () => {
    await fs.copyFile(filePath, target);
    await fs.unlink(filePath);
  });
  console.error(`[worker] failed: ${filePath} -> ${target}: ${reason}`);
}

async function processFile(filePath) {
  if (!await isStable(filePath)) return;

  const target = await nextAvailable(STAGING_DIR, path.basename(filePath));
  const parsed = path.parse(target);
  const temp = path.join(parsed.dir, `.${parsed.name}.tmp${parsed.ext}`);
  try {
    await runFfmpeg(filePath, temp);
    await fs.rename(temp, target);
    await fs.unlink(filePath);
    console.log(`[worker] cleaned: ${filePath} -> ${target}`);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    await moveFailed(filePath, error.message);
  }
}

async function scanOnce() {
  const files = await walk(RAW_DIR);
  for (const file of files) {
    await processFile(file);
  }
}

await ensureDirs();
console.log(`[worker] watching raw=${RAW_DIR} staging=${STAGING_DIR}`);

while (true) {
  await scanOnce().catch((error) => console.error(`[worker] scan failed: ${error.message}`));
  await sleep(Math.max(5, SCAN_INTERVAL_SECONDS) * 1000);
}
