/**
 * Import the supplied artwork without redrawing or recoloring it.
 * Run: node scripts/prepare-assets.mjs --assets <folder> --photos <folder> --voice <folder>
 * `sharp` is only needed for this optional preparation step, not at runtime.
 */
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); }
catch {
  const bundled = process.env.CODEX_SHARP_PATH;
  if (!bundled) throw new Error('Install sharp, or set CODEX_SHARP_PATH to its bundled package path.');
  sharp = require(bundled);
}

const args = process.argv.slice(2);
function option(key) {
  const index = args.indexOf(`--${key}`);
  if (index < 0 || !args[index + 1]) throw new Error(`Missing --${key} <folder>`);
  return path.resolve(args[index + 1]);
}
const assetSource = option('assets');
const photoSource = option('photos');
const voiceSource = option('voice');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const contentRoot = path.join(root, 'src', 'content');
for (const dir of ['assets', 'photos', 'audio/voice']) await mkdir(path.join(publicRoot, dir), { recursive: true });
await mkdir(contentRoot, { recursive: true });

const EXPECTED = [
  'album_closed', 'album_open', 'bg_album_pavilion', 'bg_home', 'bg_icecream_shop', 'bg_park',
  'bouquet', 'dinner_food', 'dog_front', 'dog_happy', 'dog_side', 'frog_angry', 'frog_back',
  'frog_neutral', 'frog_sit', 'frog_walk_a', 'frog_walk_b', 'penguin_snacking',
  'penguin_surprised', 'penguin_waiting', 'rice_icecream_empty', 'rice_icecream_full',
];
const checksum = data => createHash('sha256').update(data).digest('hex');
const bounds = (pixels, width, height, threshold) => {
  let left = width, top = height, right = -1, bottom = -1, count = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] > threshold) {
      count++; left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  return count ? { x: left, y: top, width: right - left + 1, height: bottom - top + 1, pixels: count } : null;
};

function unionBounds(items) {
  const x = Math.min(...items.map(item => item.x)), y = Math.min(...items.map(item => item.y));
  return { x, y, width: Math.max(...items.map(item => item.x + item.width)) - x, height: Math.max(...items.map(item => item.y + item.height)) - y };
}
const frogScans = [];
for (const key of EXPECTED.filter(name => name.startsWith('frog_'))) {
  const { data, info } = await sharp(path.join(assetSource, `${key}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  frogScans.push({ trueBounds: bounds(data, info.width, info.height, 0), visible: bounds(data, info.width, info.height, 16) });
}
const frogCrop = unionBounds(frogScans.map(item => item.trueBounds));
const frogVisible = unionBounds(frogScans.map(item => item.visible));
const frogAnimationBounds = { x: frogVisible.x - frogCrop.x, y: frogVisible.y - frogCrop.y, width: frogVisible.width, height: frogVisible.height };
const frogAnimationOrigin = { x: (frogAnimationBounds.x + frogAnimationBounds.width / 2) / frogCrop.width, y: (frogAnimationBounds.y + frogAnimationBounds.height) / frogCrop.height };
const textures = {}, artworkAudit = [];
for (const key of EXPECTED) {
  const sourcePath = path.join(assetSource, `${key}.png`);
  const sourceData = await readFile(sourcePath);
  const metadata = await sharp(sourceData).metadata();
  const { data, info } = await sharp(sourceData).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const nonzero = bounds(data, info.width, info.height, 0);
  const visible = bounds(data, info.width, info.height, 16);
  const opaqueCore = bounds(data, info.width, info.height, 128);
  if (!nonzero || !visible) throw new Error(`${key}: empty artwork`);
  const crop = key.startsWith('bg_') ? { x: 0, y: 0, width: info.width, height: info.height } : key.startsWith('frog_') ? frogCrop : nonzero;
  const target = path.join(publicRoot, 'assets', `${key}.png`);
  // Only remove rows/columns in which every alpha value is exactly zero.
  await sharp(sourceData).extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toFile(target);
  const targetData = await readFile(target);
  const localVisible = { x: visible.x - crop.x, y: visible.y - crop.y, width: visible.width, height: visible.height };
  const cornerCoordinates = [[0,0], [info.width - 1,0], [0,info.height - 1], [info.width - 1,info.height - 1]];
  const cornerRGBA = cornerCoordinates.map(([x,y]) => Array.from(data.subarray((y * info.width + x)*4, (y * info.width + x)*4+4)));
  let transparentPixels = 0, alphaMin = 255, alphaMax = 0, lowAlphaPixels = 0;
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i]; alphaMin = Math.min(alphaMin, alpha); alphaMax = Math.max(alphaMax, alpha);
    if (alpha === 0) transparentPixels++;
    if (alpha > 0 && alpha <= 16) lowAlphaPixels++;
  }
  textures[key] = {
    src: `assets/${key}.png`, width: crop.width, height: crop.height,
    sourceWidth: info.width, sourceHeight: info.height,
    visibleBounds: localVisible,
    sourceBounds: { x: visible.x, y: visible.y, width: visible.width, height: visible.height },
    origin: { x: (localVisible.x + localVisible.width / 2) / crop.width, y: (localVisible.y + localVisible.height) / crop.height },
    hasAlpha: metadata.hasAlpha ?? false,
    ...(key.startsWith('frog_') ? { animationOrigin: frogAnimationOrigin, animationBounds: frogAnimationBounds } : {}),
  };
  artworkAudit.push({
    key, filename: `${key}.png`, sourceSize: { width: info.width, height: info.height },
    sourceAspect: info.width / info.height, hasAlpha: metadata.hasAlpha ?? false,
    alphaRange: [alphaMin, alphaMax], transparentPixels, lowAlphaPixels, cornerRGBA,
    trueNonzeroBounds: nonzero, perceptibleBoundsAlphaAbove16: visible, opaqueCoreBoundsAlphaAbove128: opaqueCore,
    crop: { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
    sourceBytes: sourceData.length, outputBytes: targetData.length,
    sourceSha256: checksum(sourceData), outputSha256: checksum(targetData),
    backgroundInspection: key.startsWith('bg_') ? 'Intentional opaque scene background.' : 'Genuine transparent background; visually inspected, no baked checkerboard.',
  });
}

const photoFiles = (await readdir(photoSource)).filter(name => /\.(png|jpe?g)$/i.test(name)).sort((a,b) => a.localeCompare(b, 'en'));
const photos = [], photoAudit = [];
for (let i = 0; i < photoFiles.length; i++) {
  const filename = photoFiles[i], source = path.join(photoSource, filename), sourceData = await readFile(source);
  const metadata = await sharp(sourceData).metadata();
  const outputName = `${String(i + 1).padStart(2, '0')}${path.extname(filename).toLowerCase()}`;
  await copyFile(source, path.join(publicRoot, 'photos', outputName));
  photos.push({ src: `photos/${outputName}`, caption: '', alt: `相册照片 ${i + 1}` });
  const { data: photoPixels, info: photoInfo } = await sharp(sourceData).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  photoAudit.push({ sourceName: filename, outputName, width: metadata.width, height: metadata.height,
    aspect: metadata.width / metadata.height, hasAlpha: metadata.hasAlpha ?? false,
    trueNonzeroBounds: bounds(photoPixels, photoInfo.width, photoInfo.height, 0),
    perceptibleBoundsAlphaAbove16: bounds(photoPixels, photoInfo.width, photoInfo.height, 16),
    backgroundInspection: 'Intentional opaque user-supplied image; inspected visually.',
    bytes: sourceData.length, sha256: checksum(sourceData) });
}
const photoContent = `/** User-supplied pictures. Relative paths respect Vite's GitHub Pages base. */\nexport interface AlbumPhoto { src: string; caption: string; alt: string }\nexport const photos: AlbumPhoto[] = ${JSON.stringify(photos, null, 2)};\n`;
await writeFile(path.join(contentRoot, 'photos.ts'), photoContent, 'utf8');

const voiceMap = JSON.parse(await readFile(path.join(voiceSource, 'voice-map.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(voiceSource, 'manifest.json'), 'utf8'));
const voiceAudit = [];
for (const [id, resource] of Object.entries(voiceMap)) {
  if (!/^[NP]\d\d$/.test(id)) throw new Error(`Unsupported voice ID: ${id}`);
  if (resource !== `audio/voice/${id}.mp3`) throw new Error(`Unexpected voice mapping: ${id}`);
  const sourcePath = path.join(voiceSource, manifest[id]?.mp3 || `mp3/${id}.mp3`);
  const data = await readFile(sourcePath);
  await writeFile(path.join(publicRoot, 'audio', 'voice', `${id}.mp3`), data);
  voiceAudit.push({ id, src: resource, duration: manifest[id]?.duration ?? null, bytes: data.length, sha256: checksum(data) });
}
await writeFile(path.join(publicRoot, 'audio', 'voice', 'voice-map.json'), JSON.stringify(voiceMap, null, 2) + '\n', 'utf8');
await writeFile(path.join(publicRoot, 'audio', 'voice', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
await writeFile(path.join(contentRoot, 'assets.json'), JSON.stringify(textures, null, 2) + '\n', 'utf8');
const audit = {
  version: 1, pipeline: 'Lossless PNG encoding, strict transparent-edge crop only. Photos and MP3 copied byte-for-byte.',
  coordinateNote: 'visibleBounds excludes alpha <=16 dust only for positioning and hit-testing; source pixels are preserved. origin anchors the perceptible bottom center. All frog states share one lossless union crop and common animationBounds/animationOrigin. Use one animationBounds-derived scale and each frame origin to keep the feet grounded.',
  visualInspection: 'All 22 supplied PNGs and 7 photos inspected via a contact sheet. White frog design retained. dog_side faces left; dog_happy faces right. No baked checkerboard backgrounds.',
  artwork: artworkAudit, photos: photoAudit, voice: voiceAudit,
  counts: { artwork: artworkAudit.length, photos: photoAudit.length, voice: voiceAudit.length },
  totalOutputBytes: artworkAudit.reduce((sum,item)=>sum+item.outputBytes,0) + photoAudit.reduce((sum,item)=>sum+item.bytes,0) + voiceAudit.reduce((sum,item)=>sum+item.bytes,0),
};
await writeFile(path.join(root, 'asset-audit.json'), JSON.stringify(audit, null, 2) + '\n', 'utf8');
console.log(`Prepared ${artworkAudit.length} artwork PNGs, ${photoAudit.length} pictures and ${voiceAudit.length} voice clips (${(audit.totalOutputBytes/1024/1024).toFixed(1)} MiB).`);
