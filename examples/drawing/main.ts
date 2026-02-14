// jove2d drawing example — colored shapes and text

import jove from "../../src/index.ts";

let t = 0;

await jove.run({
  load() {
    jove.window.setTitle("Drawing Primitives");
    jove.graphics.setBackgroundColor(40, 44, 52);
  },

  update(dt) {
    t += dt;
  },

  draw() {
    // Red filled rectangle
    jove.graphics.setColor(220, 50, 50);
    jove.graphics.rectangle("fill", 50, 50, 150, 100);

    // Green outlined rectangle
    jove.graphics.setColor(50, 220, 50);
    jove.graphics.rectangle("line", 250, 50, 150, 100);

    // Blue filled circle (pulsing)
    const radius = 50 + Math.sin(t * 2) * 10;
    jove.graphics.setColor(50, 100, 220);
    jove.graphics.circle("fill", 400, 350, radius);

    // Yellow outlined circle
    jove.graphics.setColor(220, 220, 50);
    jove.graphics.circle("line", 200, 350, 60);

    // White diagonal line
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.line(0, 0, 800, 600);

    // Cyan multi-segment line
    jove.graphics.setColor(50, 220, 220);
    jove.graphics.line(600, 50, 700, 150, 650, 250, 750, 200);

    // Magenta points
    jove.graphics.setColor(220, 50, 220);
    for (let i = 0; i < 20; i++) {
      jove.graphics.point(500 + i * 10, 500);
    }

    // White text
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("jove2d drawing primitives!", 10, 10);
    jove.graphics.print(`time: ${t.toFixed(1)}s`, 10, 580);
  },
});
