// Composite the Omni gold/silver mark onto an opaque dark-gray square → app icon (1024×1024).
// iOS icons must be fully opaque (no alpha), so the transparent mark is placed on a solid background.
// Run: node scripts/make-app-icon.mjs
import Jimp from 'jimp';

// Cleanly re-encoded copy of omni-hockey/public/omni-hockey-new-white-gold-transp.png (the original
// has trailing bytes jimp's parser rejects): `sips -s format png <src> --out /tmp/omni-mark-clean.png`.
const SRC = '/tmp/omni-mark-clean.png';
const OUT = new URL('../assets/images/icon.png', import.meta.url).pathname;

const SIZE = 1024;
const BG = 0x2f2f34ff; // dark gray, opaque
const PAD = Math.round(SIZE * 0.13);
const INNER = SIZE - PAD * 2;

const logo = await Jimp.read(SRC);
logo.contain(INNER, INNER);

const canvas = new Jimp(SIZE, SIZE, BG);
canvas.composite(logo, Math.round((SIZE - logo.getWidth()) / 2), Math.round((SIZE - logo.getHeight()) / 2));

await canvas.writeAsync(OUT);
console.log('wrote', OUT, `(${SIZE}x${SIZE}, dark-gray)`);
