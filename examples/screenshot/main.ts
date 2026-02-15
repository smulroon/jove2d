// jove2d screenshot example — draws content then captures a screenshot

import jove from "../../src/index.ts";

let captured = false;

await jove.run({
  load() {
    jove.window.setTitle("Screenshot Example");
    jove.graphics.setBackgroundColor(25, 50, 80);
  },

  draw() {

    jove.graphics.setColor(255, 200, 50);
    jove.graphics.rectangle("fill", 100, 100, 200, 150);

    jove.graphics.setColor(50, 200, 100);
    jove.graphics.circle("fill", 500, 300, 80);

    jove.graphics.setColor(200, 80, 80);
    jove.graphics.polygon("fill", 350, 50, 450, 150, 250, 150);

    if (!captured) {
      captured = true;
      jove.graphics.captureScreenshot("examples/screenshot/screenshot_jove.png");
      console.log("Screenshot saved to examples/screenshot/screenshot_jove.png");
      setTimeout(() => process.exit(0), 100);
    }
  },
});
