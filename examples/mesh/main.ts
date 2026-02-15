// jove2d mesh example — demonstrates custom vertex geometry
// Shows: colored triangle, textured quad, vertex map, draw modes, transforms

import jove from "../../src/index.ts";
import type { Mesh } from "../../src/index.ts";

let triMesh: Mesh | null = null;
let quadMesh: Mesh | null = null;
let starMesh: Mesh | null = null;
let stripMesh: Mesh | null = null;
let time = 0;

await jove.run({
  load() {
    jove.window.setTitle("Mesh Example");
    jove.graphics.setBackgroundColor(25, 25, 35);

    // 1. Colored triangle (untextured, fan mode)
    triMesh = jove.graphics.newMesh([
      [0,   -80, 0, 0, 1, 0.2, 0.2, 1],   // top — red
      [80,   60, 0, 0, 0.2, 1, 0.2, 1],   // bottom-right — green
      [-80,  60, 0, 0, 0.2, 0.2, 1, 1],   // bottom-left — blue
    ], "fan");

    // 2. Textured quad with vertex map (triangles mode)
    // Create a canvas as texture
    const canvas = jove.graphics.newCanvas(64, 64)!;
    jove.graphics.setCanvas(canvas);
    // Draw a checkerboard pattern
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if ((x + y) % 2 === 0) {
          jove.graphics.setColor(200, 100, 50);
        } else {
          jove.graphics.setColor(50, 100, 200);
        }
        jove.graphics.rectangle("fill", x * 16, y * 16, 16, 16);
      }
    }
    jove.graphics.setCanvas(null);

    quadMesh = jove.graphics.newMesh(4, "triangles")!;
    quadMesh.setVertex(1, 0, 0, 0, 0, 1, 1, 1, 1);
    quadMesh.setVertex(2, 120, 0, 1, 0, 1, 1, 1, 1);
    quadMesh.setVertex(3, 120, 120, 1, 1, 1, 1, 1, 1);
    quadMesh.setVertex(4, 0, 120, 0, 1, 1, 1, 1, 1);
    quadMesh.setVertexMap(1, 2, 3, 1, 3, 4);
    quadMesh.setTexture(canvas);

    // 3. Star shape (fan mode, 10 vertices)
    starMesh = jove.graphics.newMesh(11, "fan")!;
    // Center vertex
    starMesh.setVertex(1, 0, 0, 0, 0, 1, 1, 0.5, 1);
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const radius = i % 2 === 0 ? 70 : 35;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const r = i % 2 === 0 ? 1 : 0.8;
      const g = i % 2 === 0 ? 0.8 : 0.4;
      const b = 0.1;
      starMesh.setVertex(i + 2, x, y, 0, 0, r, g, b, 1);
    }

    // 4. Triangle strip — wavy ribbon
    const stripVerts: Array<[number, number, number?, number?, number?, number?, number?, number?]> = [];
    for (let i = 0; i < 20; i++) {
      const x = i * 15;
      const yOff = i % 2 === 0 ? 0 : 30;
      const t = i / 19;
      stripVerts.push([x, yOff, 0, 0, t, 0.5 + t * 0.5, 1 - t, 1]);
    }
    stripMesh = jove.graphics.newMesh(stripVerts, "strip");
  },

  update(dt) {
    time += dt;
  },

  draw() {
    jove.graphics.setColor(255, 255, 255);

    // Title
    jove.graphics.print("=== Mesh Example ===", 20, 10);

    // 1. Colored triangle with rotation
    jove.graphics.print("Colored Triangle (fan)", 20, 40);
    jove.graphics.push();
    jove.graphics.translate(150, 180);
    jove.graphics.rotate(time * 0.5);
    if (triMesh) jove.graphics.draw(triMesh);
    jove.graphics.pop();

    // 2. Textured quad
    jove.graphics.print("Textured Quad (vertex map)", 320, 40);
    if (quadMesh) jove.graphics.draw(quadMesh, 350, 60);

    // 3. Star (fan)
    jove.graphics.print("Star (fan)", 550, 40);
    jove.graphics.push();
    jove.graphics.translate(630, 150);
    jove.graphics.rotate(-time * 0.3);
    const s = 1 + Math.sin(time * 2) * 0.15;
    jove.graphics.scale(s, s);
    if (starMesh) jove.graphics.draw(starMesh);
    jove.graphics.pop();

    // 4. Triangle strip
    jove.graphics.print("Triangle Strip", 20, 290);
    if (stripMesh) jove.graphics.draw(stripMesh, 20, 320);

    // 5. Dynamic mesh — sine wave
    jove.graphics.print("Dynamic Sine Wave (strip)", 20, 400);
    const dynMesh = jove.graphics.newMesh(40, "strip")!;
    for (let i = 0; i < 20; i++) {
      const x = i * 18;
      const yBase = Math.sin(time * 3 + i * 0.4) * 30;
      dynMesh.setVertex(i * 2 + 1, x, 460 + yBase - 15, 0, 0, 0.3, 0.8, 1, 1);
      dynMesh.setVertex(i * 2 + 2, x, 460 + yBase + 15, 0, 0, 0.1, 0.3, 0.8, 1);
    }
    jove.graphics.draw(dynMesh);
    dynMesh.release();

    // Info
    jove.graphics.setColor(150, 150, 150);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 20, 560);
    jove.graphics.print("ESC to quit", 20, 580);
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
