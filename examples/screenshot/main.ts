// jove2d screenshot example — captures a screenshot on the first frame

import jove from "../../src/index.ts";

let captured = false;

await jove.run({
  load() {
    jove.window.setTitle("Screenshot Example");
    console.log("Will capture screenshot on first frame...");
  },

  draw() {
    if (!captured) {
      captured = true;

      // Save as PNG file
      jove.graphics.captureScreenshot("screenshot.png");

      // Also get raw pixel data via callback
      jove.graphics.captureScreenshot((imageData) => {
        console.log(
          `Captured ${imageData.width}x${imageData.height} (${imageData.format}), ${imageData.data.length} bytes`
        );
      });

      console.log("Screenshot queued — will be saved after this frame.");

      // Quit after capture
      setTimeout(() => process.exit(0), 100);
    }
  },
});
