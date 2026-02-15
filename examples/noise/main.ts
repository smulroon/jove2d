// jove2d noise & math example — simplex noise visualization, RNG, and triangulation
//
// Demonstrates: jove.math.noise, jove.math.random, jove.math.setRandomSeed,
// jove.math.newRandomGenerator, jove.math.triangulate, jove.math.isConvex

import jove from "../../src/index.ts";

let t = 0;
let seed = 42;

// Pre-generate random polygon for triangulation demo
const polyVerts = [200, 420, 280, 390, 340, 430, 320, 490, 240, 510, 180, 470];

await jove.run({
  load() {
    jove.window.setTitle("Math & Noise Example");
    jove.graphics.setBackgroundColor(10, 10, 20);
    jove.math.setRandomSeed(seed);
  },

  update(dt) {
    t += dt;
  },

  draw() {
    // --- 2D Simplex noise field (scrolling) ---
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("2D Simplex noise (scrolling)", 10, 10);

    const scale = 0.04;
    const cellSize = 4;
    const cols = 180;
    const rows = 80;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const n = jove.math.noise(x * scale + t * 0.3, y * scale + t * 0.1);
        // Map noise from [-1,1] to [0,255]
        const v = Math.floor((n + 1) * 0.5 * 255);
        jove.graphics.setColor(v, v * 0.7, v * 0.4);
        jove.graphics.point(10 + x * cellSize, 30 + y * cellSize);
      }
    }

    // --- 1D noise wave ---
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("1D noise wave", 10, 365);

    jove.graphics.setColor(100, 200, 255);
    for (let x = 0; x < 350; x++) {
      const n = jove.math.noise((x + t * 50) * 0.02);
      const y = 400 + n * 30;
      jove.graphics.point(10 + x, y);
    }

    // --- Random distribution visualization ---
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print(`RNG (seed: ${seed}, R to re-seed)`, 400, 365);

    // Use an independent random generator for the visualization
    const rng = jove.math.newRandomGenerator(seed);
    jove.graphics.setColor(255, 100, 100, 180);
    for (let i = 0; i < 200; i++) {
      const x = rng.random() * 350;
      const y = rng.random() * 100;
      jove.graphics.point(400 + x, 385 + y);
    }

    // Normal distribution dots
    jove.graphics.setColor(100, 255, 100, 180);
    for (let i = 0; i < 200; i++) {
      const x = rng.randomNormal(50, 175);
      const y = rng.randomNormal(15, 50);
      if (x >= 0 && x <= 350 && y >= 0 && y <= 100) {
        jove.graphics.point(400 + x, 385 + y);
      }
    }

    // --- Polygon triangulation demo ---
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("triangulate + isConvex", 400, 30);

    const isConvex = jove.math.isConvex(polyVerts);
    jove.graphics.print(`Convex: ${isConvex}`, 400, 50);

    // Draw the polygon outline
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.polygon("line", ...polyVerts);

    // Draw the triangulation
    const triangles = jove.math.triangulate(polyVerts);
    const colors: [number, number, number][] = [
      [255, 100, 100], [100, 255, 100], [100, 100, 255],
      [255, 255, 100], [255, 100, 255], [100, 255, 255],
    ];

    for (let i = 0; i < triangles.length; i++) {
      const [a, b, c] = triangles[i];
      const [cr, cg, cb] = colors[i % colors.length];
      jove.graphics.setColor(cr, cg, cb, 80);
      jove.graphics.polygon("fill",
        polyVerts[a * 2], polyVerts[a * 2 + 1],
        polyVerts[b * 2], polyVerts[b * 2 + 1],
        polyVerts[c * 2], polyVerts[c * 2 + 1],
      );
    }

    // --- 3D noise time slice ---
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("3D noise (z = time)", 400, 170);

    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 90; x++) {
        const n = jove.math.noise(x * 0.08, y * 0.08, t * 0.2);
        const v = Math.floor((n + 1) * 0.5 * 255);
        jove.graphics.setColor(v * 0.3, v * 0.6, v);
        jove.graphics.point(400 + x * 4, 190 + y * 4);
      }
    }

    // --- HUD ---
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 570);
    jove.graphics.print(`time: ${t.toFixed(1)}s`, 10, 570);
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
    if (key === "r") {
      seed = Math.floor(Math.random() * 10000);
      jove.math.setRandomSeed(seed);
    }
  },
});
