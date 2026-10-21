/**
 * Generates the RecallLC extension icons (pure Node, no image dependencies).
 *
 *   node scripts/generate-icons.mjs
 *
 * Draws a rounded-square "R" mark: an accent ring with a stem and a leg,
 * evoking both "recall" (a circular arrow) and the letter R.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'icons');

/* ---------------------------------------------------------------- PNG codec */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ drawing */

const BG = [0x0b, 0x0d, 0x12];
const ACCENT = [0x7c, 0x5c, 0xff];
const ACCENT_SOFT = [0x9d, 0x86, 0xff];

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const s = size / 128; // design grid is 128x128
  const radius = 28 * s;

  const put = (x, y, rgb, alpha) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const a = Math.max(0, Math.min(1, alpha));
    px[i] = mix([px[i], px[i + 1], px[i + 2]], rgb, a)[0];
    px[i + 1] = mix([px[i], px[i + 1], px[i + 2]], rgb, a)[1];
    px[i + 2] = mix([px[i], px[i + 1], px[i + 2]], rgb, a)[2];
    px[i + 3] = Math.max(px[i + 3], Math.round(255 * a));
  };

  // --- rounded-square background ------------------------------------------
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      let alpha = 1;
      if (cx < radius && cy < radius) {
        const dx = radius - cx;
        const dy = radius - cy;
        const dist = Math.hypot(dx, dy);
        alpha = dist <= radius ? 1 : 0;
      }
      if (alpha > 0) {
        const i = (y * size + x) * 4;
        px[i] = BG[0];
        px[i + 1] = BG[1];
        px[i + 2] = BG[2];
        px[i + 3] = 255;
      }
    }
  }

  const strokeWidth = 13 * s;
  const ringR = 38 * s;
  const cx = size / 2;
  const cy = size / 2;

  // --- recall ring (open on the lower-right, like a circular arrow) ---------
  const gapStart = Math.PI * 0.28;
  const gapEnd = Math.PI * 1.28;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.hypot(dx, dy);
      const edge = Math.abs(dist - ringR);
      if (edge > strokeWidth / 2) continue;
      let ang = Math.atan2(dy, dx);
      if (ang < 0) ang += Math.PI * 2;
      const inGap = ang > gapStart && ang < gapEnd;
      if (inGap) continue;
      const alpha = Math.min(1, (strokeWidth / 2 - edge) * 1.6 + 0.35);
      put(x, y, ACCENT, alpha);
    }
  }

  // --- arrow head at the ring's open end -----------------------------------
  const ah = 13 * s;
  const ax = cx + Math.cos(gapEnd) * ringR;
  const ay = cy + Math.sin(gapEnd) * ringR;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - ax;
      const dy = y + 0.5 - ay;
      if (Math.abs(dx) > ah || Math.abs(dy) > ah) continue;
      const t = (dx + ah) / (2 * ah); // 0..1 across the arrow head
      if (Math.abs(dy) / ah <= 1 - t) put(x, y, ACCENT_SOFT, 1);
    }
  }

  // --- "R" stem + bowl + leg ----------------------------------------------
  const stemX = cx - 16 * s;
  const stemTop = cy - 20 * s;
  const stemBottom = cy + 22 * s;
  const stemW = 11 * s;
  for (let y = Math.floor(stemTop); y < stemBottom; y++) {
    for (let x = Math.floor(stemX - stemW / 2); x < stemX + stemW / 2; x++) {
      put(x, y, ACCENT_SOFT, 1);
    }
  }

  // bowl: half-ring to the right of the stem
  const bowlR = 13 * s;
  const bowlCx = stemX;
  const bowlCy = cy - 8 * s;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - bowlCx;
      const dy = y + 0.5 - bowlCy;
      const dist = Math.hypot(dx, dy);
      const edge = Math.abs(dist - bowlR);
      if (edge > 5 * s) continue;
      if (dx < -1) continue; // only the right half
      put(x, y, ACCENT_SOFT, 1);
    }
  }

  // leg
  for (let i = 0; i <= 20 * s; i++) {
    const x = stemX + i;
    const y = cy + 4 * s + i;
    for (let w = -5 * s; w <= 5 * s; w++) put(x + w, y, ACCENT_SOFT, 1);
  }

  return encodePng(size, size, px);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const file = join(OUT_DIR, `icon${size}.png`);
  writeFileSync(file, drawIcon(size));
  console.log(`wrote ${file}`);
}
