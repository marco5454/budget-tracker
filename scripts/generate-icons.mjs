// Generates PWA icons from public/favicon.svg
// Run with: node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const svgPath = resolve(root, "public/favicon.svg");
const outDir = resolve(root, "public/icons");
mkdirSync(outDir, { recursive: true });

const svg = readFileSync(svgPath);

// Standard any-purpose icons
const sizes = [192, 512];
for (const size of sizes) {
  const out = resolve(outDir, `icon-${size}.png`);
  await sharp(svg)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log("wrote", out);
}

// Maskable icon (extra padding so it survives circular/rounded masks)
// Render the SVG smaller inside a 512 canvas with brand-colored background.
{
  const inner = await sharp(svg).resize(360, 360).png().toBuffer();
  const out = resolve(outDir, "icon-maskable-512.png");
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 29, g: 140, b: 217, alpha: 1 }, // brand-500-ish
    },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

// Apple touch icon
{
  const out = resolve(outDir, "apple-touch-icon.png");
  await sharp(svg).resize(180, 180).png().toFile(out);
  console.log("wrote", out);
}

// favicon.ico via a 32x32 PNG (browsers accept PNG favicon.ico in modern setups; .ico still preferred — write 32 PNG too)
{
  const out = resolve(root, "public/favicon-32.png");
  await sharp(svg).resize(32, 32).png().toFile(out);
  console.log("wrote", out);
}

console.log("Done.");
