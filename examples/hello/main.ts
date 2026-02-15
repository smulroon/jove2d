// jove2d hello example — basic game loop with timer and system info

import jove from "../../src/index.ts";

let frameCount = 0;

await jove.run({
  load() {
    jove.window.setTitle("Hello jove2d!");
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
