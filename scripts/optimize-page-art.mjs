// Keep the approved PNG sources; ship only these cropped/compressed derivatives.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

await mkdir(new URL('../public/page-art/', import.meta.url), { recursive: true });
const assets = [
  ['gallery-decoration', 'gallery/design-reference.png', { left: 1266, top: 0, width: 270, height: 230 }],
  ['quest-background', 'quest/bouncy-background.png'],
  ['mascot', 'checkboard/mascot.png'],
  ['glass-bubbles', 'checkboard/glass-bubbles.png'],
];
for (const [name, source, crop] of assets) {
  let image = sharp(fileURLToPath(new URL(`../public/${source}`, import.meta.url)));
  if (crop) image = image.extract(crop);
  const bytes = await image.webp({ quality: 85 }).toBuffer();
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const filename = `${name}.${hash}.webp`;
  await writeFile(new URL(`../public/page-art/${filename}`, import.meta.url), bytes);
  console.log(`${filename}: ${Math.round(bytes.length / 1024)} KB`);
}
