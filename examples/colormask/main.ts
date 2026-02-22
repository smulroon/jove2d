// jove2d colorMask example — GPU-enforced color channel masking via custom blend modes

import jove from "../../src/index.ts";

const W = 800;
const H = 600;
const HALF_W = W / 2;
const HALF_H = H / 2;
const PAD = 10;
const HEADER = 25;

// Panel regions (2x2 grid with padding)
const panels: { x: number; y: number; w: number; h: number; label: string; mask: [boolean, boolean, boolean, boolean] }[] = [
  { x: PAD, y: PAD + HEADER, w: HALF_W - PAD * 1.5, h: HALF_H - PAD * 1.5 - HEADER, label: "No mask (all channels)", mask: [true, true, true, true] },
  { x: HALF_W + PAD * 0.5, y: PAD + HEADER, w: HALF_W - PAD * 1.5, h: HALF_H - PAD * 1.5 - HEADER, label: "Red only", mask: [true, false, false, true] },
  { x: PAD, y: HALF_H + PAD * 0.5, w: HALF_W - PAD * 1.5, h: HALF_H - PAD * 1.5 - HEADER, label: "Alpha only (RGB masked)", mask: [false, false, false, true] },
  { x: HALF_W + PAD * 0.5, y: HALF_H + PAD * 0.5, w: HALF_W - PAD * 1.5, h: HALF_H - PAD * 1.5 - HEADER, label: "No red (GB only)", mask: [false, true, true, true] },
];

function drawShapes(x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const sz = Math.min(w, h) * 0.2;

  // Red rectangle (top-left)
  jove.graphics.setColor(220, 50, 50);
  jove.graphics.rectangle("fill", x + w * 0.1, y + h * 0.1, sz * 1.5, sz);

  // Green circle (top-right)
  jove.graphics.setColor(50, 220, 50);
  jove.graphics.circle("fill", x + w * 0.75, y + h * 0.25, sz * 0.6);

  // Blue circle (bottom-left)
  jove.graphics.setColor(50, 80, 220);
  jove.graphics.circle("fill", x + w * 0.25, y + h * 0.7, sz * 0.6);

  // White rectangle (center)
  jove.graphics.setColor(255, 255, 255);
  jove.graphics.rectangle("fill", cx - sz * 0.4, cy - sz * 0.3, sz * 0.8, sz * 0.6);

  // Yellow ellipse (bottom-right)
  jove.graphics.setColor(255, 220, 50);
  jove.graphics.ellipse("fill", x + w * 0.75, y + h * 0.7, sz * 0.7, sz * 0.4);
}

await jove.run({
  load() {
    jove.window.setTitle("colorMask Example");
    jove.graphics.setBackgroundColor(40, 44, 52);
  },

  draw() {
    for (const panel of panels) {
      // Panel background
      jove.graphics.setColorMask();
      jove.graphics.setColor(30, 33, 40);
      jove.graphics.rectangle("fill", panel.x, panel.y, panel.w, panel.h);

      // Panel border
      jove.graphics.setColor(80, 80, 80);
      jove.graphics.rectangle("line", panel.x, panel.y, panel.w, panel.h);

      // Apply mask and draw shapes
      jove.graphics.setColorMask(...panel.mask);
      drawShapes(panel.x, panel.y, panel.w, panel.h);

      // Reset mask for label
      jove.graphics.setColorMask();
      jove.graphics.setColor(200, 200, 200);
      const maskStr = `[${panel.mask.map(b => b ? "T" : "F").join(",")}]`;
      jove.graphics.print(`${panel.label}  ${maskStr}`, panel.x + 5, panel.y + panel.h + 3);
    }

    // HUD
    jove.graphics.setColorMask();
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("colorMask GPU enforcement — compare panels", 10, 5);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, W - 80, 5);
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
