// Generates Stocky app icon + all Android mipmap sizes using jimp (pure JS)
import { Jimp } from "jimp";
import { mkdir } from "fs/promises";

const SIZE = 1024;

// Colors as 0xRRGGBBAA — passed directly to setPixelColor
const NAVY   = 0x0f172aff;
const DARK   = 0x1e293bff;
const SLATE  = 0x475569ff;
const INDIGO = 0x6366f1ff;
const VIOLET = 0x8b5cf6ff;
const GREEN  = 0x10b981ff;
const WHITE  = 0xffffffff;

function fillRect(img, x, y, w, h, color) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
        img.setPixelColor(color, px, py);
      }
    }
  }
}

function fillCircle(img, cx, cy, radius, color) {
  for (let py = cy - radius; py <= cy + radius; py++) {
    for (let px = cx - radius; px <= cx + radius; px++) {
      if ((px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2) {
        if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
          img.setPixelColor(color, px, py);
        }
      }
    }
  }
}

function drawLine(img, x1, y1, x2, y2, thickness, color) {
  const dx = x2 - x1, dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const half = Math.floor(thickness / 2);
  for (let i = 0; i <= steps; i++) {
    const px = Math.round(x1 + (dx * i) / steps);
    const py = Math.round(y1 + (dy * i) / steps);
    for (let oy = -half; oy <= half; oy++) {
      for (let ox = -half; ox <= half; ox++) {
        const fx = px + ox, fy = py + oy;
        if (fx >= 0 && fx < SIZE && fy >= 0 && fy < SIZE) {
          img.setPixelColor(color, fx, fy);
        }
      }
    }
  }
}

async function buildIcon() {
  const img = new Jimp({ width: SIZE, height: SIZE, color: NAVY });

  // Subtle dark band in lower half
  fillRect(img, 0, Math.round(SIZE * 0.55), SIZE, Math.round(SIZE * 0.45), DARK);

  // 4 ascending bars
  const barW   = 115;
  const gap    = 38;
  const bottom = 760;
  const bars = [
    { h: 210, color: SLATE  },
    { h: 330, color: INDIGO },
    { h: 460, color: VIOLET },
    { h: 600, color: GREEN  },
  ];
  const totalW = bars.length * barW + (bars.length - 1) * gap;
  let bx = Math.round((SIZE - totalW) / 2);

  const barTops = [];
  for (const bar of bars) {
    const by = bottom - bar.h;
    barTops.push({ cx: Math.round(bx + barW / 2), cy: by });
    fillRect(img, bx, by, barW, bar.h, bar.color);
    fillRect(img, bx, by, barW, 14, WHITE);  // bright top cap
    bx += barW + gap;
  }

  // Trend line connecting bar tops
  for (let i = 0; i < barTops.length - 1; i++) {
    drawLine(img,
      barTops[i].cx, barTops[i].cy,
      barTops[i + 1].cx, barTops[i + 1].cy,
      12, WHITE
    );
  }

  // Dot at each bar top
  for (const t of barTops) fillCircle(img, t.cx, t.cy, 18, WHITE);

  // Upward arrow above tallest bar
  const tip = barTops[3];
  const arrowTip = { x: tip.cx + 55, y: tip.cy - 85 };
  drawLine(img, tip.cx, tip.cy, arrowTip.x, arrowTip.y, 14, GREEN);
  fillCircle(img, arrowTip.x, arrowTip.y, 22, GREEN);

  // Baseline rule
  fillRect(img, 120, bottom + 14, SIZE - 240, 10, 0x334155ff);

  // Save master
  await mkdir("resources", { recursive: true });
  await img.write("resources/icon.png");
  console.log("✓ resources/icon.png (1024×1024)");

  // Play Store 512×512
  await img.clone().resize({ w: 512, h: 512 }).write("resources/icon-512.png");
  console.log("✓ resources/icon-512.png (512×512 — Play Store upload)");

  // Android mipmap sizes
  const densities = [
    { name: "mipmap-mdpi",    size: 48  },
    { name: "mipmap-hdpi",    size: 72  },
    { name: "mipmap-xhdpi",   size: 96  },
    { name: "mipmap-xxhdpi",  size: 144 },
    { name: "mipmap-xxxhdpi", size: 192 },
  ];
  for (const d of densities) {
    const dir = `android/app/src/main/res/${d.name}`;
    await mkdir(dir, { recursive: true });
    const resized = img.clone().resize({ w: d.size, h: d.size });
    await resized.write(`${dir}/ic_launcher.png`);
    await resized.clone().write(`${dir}/ic_launcher_round.png`);
    console.log(`✓ ${dir}/ic_launcher.png (${d.size}×${d.size})`);
  }

  console.log("\nAll Stocky icons generated successfully!");
}

buildIcon().catch(err => { console.error(err); process.exit(1); });
