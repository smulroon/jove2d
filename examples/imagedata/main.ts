// jove2d ImageData example — procedural textures, pixel manipulation, paste
//
// Demonstrates: jove.image.newImageData, getPixel, setPixel, mapPixel, paste,
// jove.graphics.newImage(imageData), replacePixels
// Press R to toggle between replacePixels and recreate-each-frame for plasma

import jove from "../../src/index.ts";
import type { ImageData } from "../../src/index.ts";

let t = 0;

// Static images (created once in load)
let gradientImg: ReturnType<typeof jove.graphics.newImage>;
let checkerImg: ReturnType<typeof jove.graphics.newImage>;
let compositeImg: ReturnType<typeof jove.graphics.newImage>;

// Dynamic plasma
let plasmaData: ImageData;
let plasmaImg: ReturnType<typeof jove.graphics.newImage>;
let useReplacePixels = true;

const PLASMA_W = 128;
const PLASMA_H = 128;

await jove.run({
  load() {
    jove.window.setTitle("ImageData Example — jove2d");
    jove.graphics.setBackgroundColor(20, 20, 30);

    // --- 1. Gradient ImageData ---
    const gradData = jove.image.newImageData(128, 128)!;
    gradData.mapPixel((x, y) => {
      const r = Math.floor((x / 127) * 255);
      const g = Math.floor((y / 127) * 255);
      return [r, g, 128, 255];
    });
    gradientImg = jove.graphics.newImage(gradData);

    // --- 2. Checkerboard ImageData ---
    const checkData = jove.image.newImageData(128, 128)!;
    checkData.mapPixel((x, y) => {
      const isWhite = ((Math.floor(x / 16) + Math.floor(y / 16)) % 2) === 0;
      return isWhite ? [220, 220, 220, 255] : [40, 40, 40, 255];
    });
    checkerImg = jove.graphics.newImage(checkData);

    // --- 3. Composite: paste checkerboard onto gradient ---
    const compData = jove.image.newImageData(128, 128)!;
    // Start with gradient
    compData.paste(gradData, 0, 0);
    // Paste checkerboard in center (64x64 region from center of checker)
    compData.paste(checkData, 32, 32, 32, 32, 64, 64);
    compositeImg = jove.graphics.newImage(compData);

    // --- 4. Plasma (dynamic — will be updated each frame) ---
    plasmaData = jove.image.newImageData(PLASMA_W, PLASMA_H)!;
    plasmaImg = jove.graphics.newImage(plasmaData);
  },

  update(dt) {
    t += dt;

    // Update plasma pixels
    plasmaData.mapPixel((x, y) => {
      const cx = x / PLASMA_W;
      const cy = y / PLASMA_H;
      const v1 = Math.sin(cx * 10 + t * 2);
      const v2 = Math.sin(cy * 8 - t * 1.5);
      const v3 = Math.sin((cx + cy) * 6 + t);
      const v4 = Math.sin(Math.sqrt((cx - 0.5) ** 2 + (cy - 0.5) ** 2) * 12 - t * 3);
      const v = (v1 + v2 + v3 + v4) / 4;

      const r = Math.floor((Math.sin(v * Math.PI) * 0.5 + 0.5) * 255);
      const g = Math.floor((Math.sin(v * Math.PI + 2.094) * 0.5 + 0.5) * 255);
      const b = Math.floor((Math.sin(v * Math.PI + 4.189) * 0.5 + 0.5) * 255);
      return [r, g, b, 255];
    });

    // Update GPU texture
    if (useReplacePixels) {
      // replacePixels: update existing texture in-place (no alloc/free)
      if (plasmaImg) plasmaImg.replacePixels(plasmaData);
    } else {
      // Recreate: destroy + create new texture each frame
      if (plasmaImg) plasmaImg.release();
      plasmaImg = jove.graphics.newImage(plasmaData);
    }
  },

  draw() {
    // --- Labels ---
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("ImageData — procedural textures & pixel manipulation", 10, 10);

    // --- Row 1: Static procedural textures ---
    const y1 = 50;

    // Gradient
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("mapPixel: gradient", 10, y1);
    if (gradientImg) jove.graphics.draw(gradientImg, 10, y1 + 18);

    // Checkerboard
    jove.graphics.print("mapPixel: checker", 160, y1);
    if (checkerImg) jove.graphics.draw(checkerImg, 160, y1 + 18);

    // Composite (paste)
    jove.graphics.print("paste: gradient + checker", 310, y1);
    if (compositeImg) jove.graphics.draw(compositeImg, 310, y1 + 18);

    // --- Row 2: Dynamic plasma (updated every frame) ---
    const y2 = 220;
    jove.graphics.setColor(255, 255, 255);
    const method = useReplacePixels ? "replacePixels" : "recreate";
    jove.graphics.print(`Dynamic plasma — ${method} (R to toggle)`, 10, y2);
    if (plasmaImg) {
      // Draw at 2x scale
      jove.graphics.draw(plasmaImg, 10, y2 + 18, 0, 2, 2);
    }

    // --- Row 3: Pixel info readback ---
    const y3 = 420;
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("Pixel readback from plasma center:", 10, y3);
    if (plasmaData) {
      const cx = Math.floor(PLASMA_W / 2);
      const cy = Math.floor(PLASMA_H / 2);
      const [r, g, b, a] = plasmaData.getPixel(cx, cy);
      jove.graphics.print(`  getPixel(${cx}, ${cy}) = [${r}, ${g}, ${b}, ${a}]`, 10, y3 + 18);

      // Draw a large swatch of that color
      jove.graphics.setColor(r, g, b, a);
      jove.graphics.rectangle("fill", 10, y3 + 40, 60, 60);

      // Show corner pixels
      jove.graphics.setColor(200, 200, 200);
      const corners = [
        [0, 0, "top-left"],
        [PLASMA_W - 1, 0, "top-right"],
        [0, PLASMA_H - 1, "bot-left"],
        [PLASMA_W - 1, PLASMA_H - 1, "bot-right"],
      ] as const;
      let cx2 = 90;
      for (const [px, py, label] of corners) {
        const [cr, cg, cb] = plasmaData.getPixel(px, py);
        jove.graphics.setColor(cr, cg, cb);
        jove.graphics.rectangle("fill", cx2, y3 + 40, 30, 30);
        jove.graphics.setColor(200, 200, 200);
        jove.graphics.print(label, cx2, y3 + 72);
        cx2 += 80;
      }
    }

    // --- HUD ---
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 570);
  },

  keypressed(key) {
    if (key === "r") useReplacePixels = !useReplacePixels;
    if (key === "escape") jove.window.close();
  },
});
