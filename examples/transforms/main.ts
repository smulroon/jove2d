// jove2d transform example — nested push/pop, translate, rotate, scale, shear
//
// Demonstrates the full transform stack with hierarchical (parent-child) transforms,
// like a simple scene graph.

import jove from "../../src/index.ts";

let t = 0;

await jove.run({
  load() {
    jove.window.setTitle("Transform Stack");
    jove.graphics.setBackgroundColor(25, 25, 40);
  },

  update(dt) {
    t += dt;
  },

  draw() {
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("Nested transforms: solar system model", 10, 10);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 10);
    jove.graphics.print(`Stack depth: ${jove.graphics.getStackDepth()}`, 700, 30);

    // --- Solar system: nested rotations ---

    // Sun at center
    jove.graphics.push();
    jove.graphics.translate(400, 280);

    // Sun body (slowly rotating)
    jove.graphics.push();
    jove.graphics.rotate(t * 0.2);
    jove.graphics.setColor(255, 200, 50);
    jove.graphics.circle("fill", 0, 0, 40);
    // Sun rays
    jove.graphics.setColor(255, 220, 100);
    for (let i = 0; i < 8; i++) {
      jove.graphics.push();
      jove.graphics.rotate(i * Math.PI / 4);
      jove.graphics.line(45, 0, 55, 0);
      jove.graphics.pop();
    }
    jove.graphics.pop();

    // Earth orbit
    jove.graphics.setColor(60, 60, 80);
    jove.graphics.circle("line", 0, 0, 120);

    // Earth
    jove.graphics.push();
    jove.graphics.rotate(t * 0.5); // Orbit speed
    jove.graphics.translate(120, 0); // Orbit radius

    // Earth body — show screen position via transformPoint
    jove.graphics.setColor(50, 130, 255);
    jove.graphics.circle("fill", 0, 0, 15);
    const [ex, ey] = jove.graphics.transformPoint(0, 0);

    // Moon orbit
    jove.graphics.setColor(50, 50, 70);
    jove.graphics.circle("line", 0, 0, 30);

    // Moon
    jove.graphics.push();
    jove.graphics.rotate(t * 2.0); // Moon orbits faster
    jove.graphics.translate(30, 0);
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.circle("fill", 0, 0, 5);
    jove.graphics.pop(); // moon

    jove.graphics.pop(); // earth

    // Mars orbit
    jove.graphics.setColor(60, 60, 80);
    jove.graphics.circle("line", 0, 0, 200);

    // Mars
    jove.graphics.push();
    jove.graphics.rotate(t * 0.3);
    jove.graphics.translate(200, 0);
    jove.graphics.setColor(220, 100, 50);
    jove.graphics.circle("fill", 0, 0, 10);

    // Mars moons
    jove.graphics.push();
    jove.graphics.rotate(t * 3.0);
    jove.graphics.translate(18, 0);
    jove.graphics.setColor(180, 150, 130);
    jove.graphics.circle("fill", 0, 0, 3);
    jove.graphics.pop();

    jove.graphics.push();
    jove.graphics.rotate(-t * 2.5);
    jove.graphics.translate(25, 0);
    jove.graphics.setColor(160, 140, 120);
    jove.graphics.circle("fill", 0, 0, 2);
    jove.graphics.pop();

    jove.graphics.pop(); // mars

    jove.graphics.pop(); // sun center

    // Show Earth's screen coords (computed via transformPoint above)
    jove.graphics.setColor(150, 200, 255);
    jove.graphics.print(`Earth screen pos: ${ex.toFixed(0)}, ${ey.toFixed(0)}`, 10, 30);

    // --- Shear demo ---
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("Shear:", 10, 520);

    for (let i = 0; i < 5; i++) {
      jove.graphics.push();
      jove.graphics.translate(80 + i * 80, 550);
      jove.graphics.shear(Math.sin(t + i * 0.5) * 0.5, 0);
      const hue = (i / 5) * 255;
      jove.graphics.setColor(255, hue, 255 - hue);
      jove.graphics.rectangle("fill", -15, -15, 30, 30);
      jove.graphics.pop();
    }

    // --- Scale animation ---
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("Scale:", 500, 520);

    for (let i = 0; i < 4; i++) {
      jove.graphics.push();
      jove.graphics.translate(560 + i * 60, 555);
      const s = 0.5 + Math.abs(Math.sin(t * 2 + i * 0.8)) * 0.8;
      jove.graphics.scale(s);
      jove.graphics.setColor(100 + i * 40, 200, 255 - i * 40);
      jove.graphics.circle("fill", 0, 0, 12);
      jove.graphics.pop();
    }
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
