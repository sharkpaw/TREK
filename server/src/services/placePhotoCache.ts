import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import crypto from 'node:crypto';
import { Jimp } from 'jimp';
import { db } from '../db/database';

const PLACE_PHOTO_THUMB_PX = 96;

const GOOGLE_PHOTO_DIR = path.join(__dirname, '../../uploads/photos/google');
const ERROR_TTL = 5 * 60 * 1000;

// In-flight dedup — prevents stampedes when multiple requests hit the same uncached placeId simultaneously
const inFlight = new Map<string, Promise<{ filePath: string; attribution: string | null } | null>>();

// In-memory set of placeIds whose file is confirmed on disk this session.
// Avoids a synchronous fs.existsSync() call on every cache hit after the first verification.
const knownOnDisk = new Set<string>();

// Ensure upload dir exists once at startup — avoids sync FS calls inside put() on every write.
try {
  fs.mkdirSync(GOOGLE_PHOTO_DIR, { recursive: true });
} catch { /* already exists */ }

function filePath(placeId: string): string {
  // Hash to avoid filename collisions — coords:lat:lng pseudo-IDs contain characters that
  // collapse identically under sanitization (e.g. ':' and '.' both → '_')
  const hash = crypto.createHash('sha1').update(placeId).digest('hex');
  return path.join(GOOGLE_PHOTO_DIR, `${hash}.jpg`);
}

function proxyUrl(placeId: string): string {
  return `/api/maps/place-photo/${encodeURIComponent(placeId)}/bytes`;
}

function thumbProxyUrl(placeId: string): string {
  return `/api/maps/place-photo/${encodeURIComponent(placeId)}/thumb`;
}

function thumbFilePath(placeId: string): string {
  const hash = crypto.createHash('sha1').update(placeId).digest('hex');
  return path.join(GOOGLE_PHOTO_DIR, `${hash}_thumb.jpg`);
}

function thumbDiskKey(placeId: string): string {
  return `thumb:${placeId}`;
}

interface CachedPhoto {
  photoUrl: string;
  thumbUrl: string;
  filePath: string;
  attribution: string | null;
}

export async function ensureThumbFile(placeId: string): Promise<string | null> {
  const main = serveFilePath(placeId);
  if (!main) return null;

  const tfp = thumbFilePath(placeId);
  const diskKey = thumbDiskKey(placeId);

  if (knownOnDisk.has(diskKey) || fs.existsSync(tfp)) {
    knownOnDisk.add(diskKey);
    return tfp;
  }

  try {
    const img = await Jimp.read(main);
    const w = img.bitmap.width;
    const h = img.bitmap.height;
    const s = Math.min(w, h);
    img.crop({
      x: Math.floor((w - s) / 2),
      y: Math.floor((h - s) / 2),
      w: s,
      h: s,
    });
    img.scaleToFit({ w: PLACE_PHOTO_THUMB_PX, h: PLACE_PHOTO_THUMB_PX });
    await img.write(tfp as `${string}.jpg`, { quality: 72 });
    knownOnDisk.add(diskKey);
    return tfp;
  } catch (err) {
    console.error('Failed to generate place photo thumb:', placeId, err);
    return null;
  }
}

export function get(placeId: string): CachedPhoto | null {
  const row = db.prepare(
    'SELECT attribution FROM google_place_photo_meta WHERE place_id = ? AND error_at IS NULL'
  ).get(placeId) as { attribution: string | null } | undefined;

  if (!row) return null;

  const fp = filePath(placeId);

  if (!knownOnDisk.has(placeId)) {
    // First time this placeId is checked this session — verify the file exists on disk.
    // (Guards against volume wipes or manual deletion between server restarts.)
    if (!fs.existsSync(fp)) {
      db.prepare('DELETE FROM google_place_photo_meta WHERE place_id = ?').run(placeId);
      return null;
    }
    knownOnDisk.add(placeId);
  }

  return {
    photoUrl: proxyUrl(placeId),
    thumbUrl: thumbProxyUrl(placeId),
    filePath: fp,
    attribution: row.attribution,
  };
}

export function getErrored(placeId: string): boolean {
  const row = db.prepare(
    'SELECT error_at FROM google_place_photo_meta WHERE place_id = ? AND error_at IS NOT NULL'
  ).get(placeId) as { error_at: number } | undefined;

  if (!row) return false;
  return Date.now() - row.error_at < ERROR_TTL;
}

export function markError(placeId: string): void {
  knownOnDisk.delete(placeId);
  db.prepare(
    'INSERT OR REPLACE INTO google_place_photo_meta (place_id, attribution, fetched_at, error_at) VALUES (?, NULL, ?, ?)'
  ).run(placeId, Date.now(), Date.now());
}

export async function put(placeId: string, bytes: Buffer, attribution: string | null): Promise<CachedPhoto> {
  const fp = filePath(placeId);
  const tmp = fp + '.tmp';

  await fsPromises.writeFile(tmp, bytes);
  await fsPromises.rename(tmp, fp);

  knownOnDisk.add(placeId);

  db.prepare(
    'INSERT OR REPLACE INTO google_place_photo_meta (place_id, attribution, fetched_at, error_at) VALUES (?, ?, ?, NULL)'
  ).run(placeId, attribution, Date.now());

  await ensureThumbFile(placeId);

  return { photoUrl: proxyUrl(placeId), thumbUrl: thumbProxyUrl(placeId), filePath: fp, attribution };
}

export function getInFlight(placeId: string): Promise<{ filePath: string; attribution: string | null } | null> | undefined {
  return inFlight.get(placeId);
}

export function setInFlight(placeId: string, promise: Promise<{ filePath: string; attribution: string | null } | null>): void {
  inFlight.set(placeId, promise);
  promise
    .finally(() => inFlight.delete(placeId))
    .catch(() => { /* awaiter logs; this .catch only prevents unhandledRejection */ });
}

export function serveFilePath(placeId: string): string | null {
  if (knownOnDisk.has(placeId)) return filePath(placeId);
  const fp = filePath(placeId);
  if (!fs.existsSync(fp)) return null;
  knownOnDisk.add(placeId);
  return fp;
}

export function serveThumbFilePath(placeId: string): string | null {
  const diskKey = thumbDiskKey(placeId);
  const tfp = thumbFilePath(placeId);
  if (knownOnDisk.has(diskKey)) return tfp;
  if (!fs.existsSync(tfp)) return null;
  knownOnDisk.add(diskKey);
  return tfp;
}
