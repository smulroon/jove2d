// jove2d hello example — basic game loop with timer and system info

import jove from "../../src/index.ts";

let frameCount = 0;

await jove.run({
  load() {
    jove.window.setTitle("Hello jove2d!");

    // Set a simple procedural window icon (32x32 "J" on purple)
    const icon = jove.image.newImageData(32, 32)!;
    icon.mapPixel((x, y) => {
      // Purple background with rounded corners
      const cx = x - 15.5, cy = y - 15.5;
      const dist = Math.max(Math.abs(cx), Math.abs(cy));
      if (dist > 14.5) return [0, 0, 0, 0];
      if (dist > 13.5) return [80, 40, 140, 255]; // border

      // "J" shape: top bar (y 6-9), vertical bar (x 16-21, y 6-24), bottom curve (y 21-26, x 8-21)
      const inTopBar = y >= 6 && y <= 9 && x >= 8 && x <= 24;
      const inStem = x >= 16 && x <= 21 && y >= 6 && y <= 23;
      const inCurve = y >= 21 && y <= 26 && x >= 8 && x <= 21 &&
        Math.sqrt((x - 14) ** 2 + (y - 21) ** 2) <= 9 &&
        Math.sqrt((x - 14) ** 2 + (y - 21) ** 2) >= 3;
      if (inTopBar || inStem || inCurve) return [255, 255, 255, 255];

      return [120, 60, 200, 255]; // purple fill
    });
    jove.window.setIcon(icon);

    console.log(`jove2d ${jove.getVersion()}`);
    console.log(`Platform: ${jove.system.getOS()}`);
    console.log(`CPU cores: ${jove.system.getProcessorCount()}`);
  },

  update(dt) {
    frameCount++;
  },

  draw() {
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`Hello jove2d!`, 10, 10);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 10, 30);
    jove.graphics.print(`Time: ${jove.timer.getTime().toFixed(1)}s`, 10, 50);
    jove.graphics.print(`Frames: ${frameCount}`, 10, 70);
    jove.graphics.print(`Avg dt: ${(jove.timer.getAverageDelta() * 1000).toFixed(1)}ms`, 10, 90);
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
