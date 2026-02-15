// jove2d stencil example — masking operations
//
// Demonstrates stencil(), setStencilTest(), getStencilTest().
// Shows circular mask, inverted mask, and multiple stencil regions.

import jove from "../../src/index.ts";

let t = 0;
let mode = 0; // 0=normal mask, 1=inverted mask, 2=multiple regions
const modeNames = ["Circle Mask (greater > 0)", "Inverted Mask (equal = 0)", "Multiple Regions"];

await jove.run({
  load() {
    jove.window.setTitle("Stencil Example");
    jove.graphics.setBackgroundColor(30, 30, 40);
  },

  update(dt) {
    t += dt;
  },

  draw() {
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`Mode: ${modeNames[mode]}  (Press 1/2/3 to switch)`, 10, 10);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 10);

    if (mode === 0) {
      // --- Normal mask: draw only inside a circle ---

      // Define the stencil shape (a moving circle)
      const cx = 400 + Math.cos(t) * 100;
      const cy = 300 + Math.sin(t * 0.7) * 80;
      jove.graphics.stencil(() => {
        jove.graphics.circle("fill", cx, cy, 120);
      });

      // Only draw where the stencil was drawn (value > 0)
      jove.graphics.setStencilTest("greater", 0);

      // Draw a colorful scene — only visible inside the circle
      jove.graphics.setColor(255, 80, 80);
      jove.graphics.rectangle("fill", 100, 100, 250, 200);

      jove.graphics.setColor(80, 255, 80);
      jove.graphics.rectangle("fill", 300, 200, 250, 200);

      jove.graphics.setColor(80, 80, 255);
      jove.graphics.rectangle("fill", 200, 300, 250, 200);

      // Checkerboard pattern
      for (let x = 0; x < 800; x += 40) {
        for (let y = 50; y < 600; y += 40) {
          if ((x / 40 + y / 40) % 2 === 0) {
            jove.graphics.setColor(200, 200, 50, 100);
            jove.graphics.rectangle("fill", x, y, 40, 40);
          }
        }
      }

      // Disable stencil test
      jove.graphics.setStencilTest();

      // Draw circle outline to show mask boundary
      jove.graphics.setColor(255, 255, 255, 120);
      jove.graphics.circle("line", cx, cy, 120);
    } else if (mode === 1) {
      // --- Inverted mask: draw everywhere EXCEPT inside a circle ---

      const cx = 400;
      const cy = 300;
      const r = 100 + Math.sin(t * 2) * 30;

      jove.graphics.stencil(() => {
        jove.graphics.circle("fill", cx, cy, r);
      });

      // Draw everywhere the stencil was NOT drawn (value == 0)
      jove.graphics.setStencilTest("equal", 0);

      // Gradient-like colored background
      for (let y = 50; y < 600; y += 4) {
        const f = (y - 50) / 550;
        jove.graphics.setColor(
          Math.floor(255 * (1 - f)),
          Math.floor(100 + 155 * f),
          Math.floor(255 * f),
        );
        jove.graphics.rectangle("fill", 0, y, 800, 4);
      }

      jove.graphics.setStencilTest();

      // Show the hole
      jove.graphics.setColor(255, 255, 255, 120);
      jove.graphics.circle("line", cx, cy, r);
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.print("Everything outside the circle", cx - 100, cy - 10);
    } else if (mode === 2) {
      // --- Multiple stencil regions ---

      // First stencil + draw: left circle (red)
      jove.graphics.stencil(() => {
        jove.graphics.circle("fill", 250, 300, 100);
      });
      jove.graphics.setStencilTest("greater", 0);
      jove.graphics.setColor(255, 60, 60);
      jove.graphics.rectangle("fill", 0, 0, 800, 600);
      jove.graphics.setStencilTest();

      // Second stencil + draw: right circle (blue)
      jove.graphics.stencil(() => {
        jove.graphics.circle("fill", 550, 300, 100);
      });
      jove.graphics.setStencilTest("greater", 0);
      jove.graphics.setColor(60, 60, 255);
      jove.graphics.rectangle("fill", 0, 0, 800, 600);
      jove.graphics.setStencilTest();

      // Third stencil + draw: top rectangle (green)
      jove.graphics.stencil(() => {
        jove.graphics.rectangle("fill", 300, 100, 200, 100);
      });
      jove.graphics.setStencilTest("greater", 0);
      jove.graphics.setColor(60, 255, 60);
      jove.graphics.rectangle("fill", 0, 0, 800, 600);
      jove.graphics.setStencilTest();

      // Outlines
      jove.graphics.setColor(255, 255, 255, 120);
      jove.graphics.circle("line", 250, 300, 100);
      jove.graphics.circle("line", 550, 300, 100);
      jove.graphics.rectangle("line", 300, 100, 200, 100);
    }

    jove.graphics.setColor(255, 255, 255);
    const [cmp, val] = jove.graphics.getStencilTest();
    jove.graphics.print(`Stencil state: ${cmp}, ${val}`, 10, 580);
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
    if (key === "1") mode = 0;
    if (key === "2") mode = 1;
    if (key === "3") mode = 2;
  },
});
