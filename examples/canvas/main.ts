// jove2d canvas example — off-screen render targets
//
// Demonstrates newCanvas, setCanvas/getCanvas, and drawing a canvas as an image.
// A scene is rendered to a canvas, then the canvas is drawn multiple times
// with different transforms.

import jove from "../../src/index.ts";
import type { Canvas } from "../../src/jove/graphics.ts";

let miniScene: Canvas | null = null;
let t = 0;

await jove.run({
  load() {
    jove.window.setTitle("Canvas Example");
    jove.graphics.setBackgroundColor(20, 20, 30);

    // Create a small off-screen canvas
    miniScene = jove.graphics.newCanvas(200, 200);
  },

  update(dt) {
    t += dt;

    // Render the mini scene to the canvas
    if (miniScene) {
      jove.graphics.setCanvas(miniScene);
      jove.graphics.clear(0, 0, 0, 0); // Clear canvas with transparency

      // Draw some shapes into the canvas
      jove.graphics.setColor(255, 100, 50);
      jove.graphics.rectangle("fill", 10, 10, 80, 80);

      jove.graphics.setColor(50, 200, 255);
      jove.graphics.circle("fill", 150, 50, 40);

      jove.graphics.setColor(100, 255, 100);
      jove.graphics.ellipse("fill", 100, 150, 60, 30);

      jove.graphics.setColor(255, 255, 255);
      jove.graphics.print("Canvas!", 60, 90);

      // Switch back to screen rendering
      jove.graphics.setCanvas(null);
    }
  },

  draw() {
    if (!miniScene) return;

    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("Off-screen canvas drawn 3 times with transforms", 10, 10);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 10);

    // Draw the canvas at its original size (top-left)
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.draw(miniScene, 20, 40);

    // Draw it again, rotated
    jove.graphics.draw(miniScene, 400, 200, t * 0.5, 1, 1, 100, 100);

    // Draw it scaled down
    jove.graphics.draw(miniScene, 600, 400, 0, 0.5, 0.5);

    // Outline where the canvases are drawn
    jove.graphics.setColor(80, 80, 80);
    jove.graphics.rectangle("line", 20, 40, 200, 200);
    jove.graphics.print("1:1", 20, 250);
    jove.graphics.print("rotated", 370, 350);
    jove.graphics.print("0.5x scale", 590, 510);
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
