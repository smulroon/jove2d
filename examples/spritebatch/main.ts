// jove2d SpriteBatch example — tilemap rendering
//
// Demonstrates newSpriteBatch for efficient tile-based rendering.
// Creates a 128x128 canvas tileset with 4 colored 32x32 tiles,
// then renders a 20x15 grid using a single SpriteBatch draw call.

import jove from "../../src/index.ts";
import type { SpriteBatch } from "../../src/jove/graphics.ts";
import type { Canvas, Quad } from "../../src/jove/graphics.ts";

let tileset: Canvas | null = null;
let batch: SpriteBatch | null = null;
let quads: Quad[] = [];
let t = 0;

const TILE_SIZE = 32;
const GRID_W = 20;
const GRID_H = 15;

await jove.run({
  load() {
    jove.window.setTitle("SpriteBatch Example — Tilemap");
    jove.graphics.setBackgroundColor(30, 30, 40);

    // Create a 128x128 canvas tileset with 4 colored tiles (2x2 grid)
    tileset = jove.graphics.newCanvas(128, 128);
    if (!tileset) return;

    jove.graphics.setCanvas(tileset);
    jove.graphics.clear(0, 0, 0, 0);

    // Tile 0: Red
    jove.graphics.setColor(200, 60, 60);
    jove.graphics.rectangle("fill", 0, 0, 32, 32);
    jove.graphics.setColor(160, 40, 40);
    jove.graphics.rectangle("line", 1, 1, 30, 30);

    // Tile 1: Green
    jove.graphics.setColor(60, 200, 60);
    jove.graphics.rectangle("fill", 32, 0, 32, 32);
    jove.graphics.setColor(40, 160, 40);
    jove.graphics.rectangle("line", 33, 1, 30, 30);

    // Tile 2: Blue
    jove.graphics.setColor(60, 60, 200);
    jove.graphics.rectangle("fill", 0, 32, 32, 32);
    jove.graphics.setColor(40, 40, 160);
    jove.graphics.rectangle("line", 1, 33, 30, 30);

    // Tile 3: Yellow
    jove.graphics.setColor(200, 200, 60);
    jove.graphics.rectangle("fill", 32, 32, 32, 32);
    jove.graphics.setColor(160, 160, 40);
    jove.graphics.rectangle("line", 33, 33, 30, 30);

    jove.graphics.setCanvas(null);

    // Create quads for each tile
    quads = [
      jove.graphics.newQuad(0, 0, 32, 32, 128, 128),
      jove.graphics.newQuad(32, 0, 32, 32, 128, 128),
      jove.graphics.newQuad(0, 32, 32, 32, 128, 128),
      jove.graphics.newQuad(32, 32, 32, 32, 128, 128),
    ];

    // Create SpriteBatch for the tilemap
    batch = jove.graphics.newSpriteBatch(tileset, GRID_W * GRID_H);
    if (!batch) return;

    // Fill the grid with a checkerboard-like pattern
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const tileIdx = (x + y) % 4;
        batch.add(quads[tileIdx], x * TILE_SIZE, y * TILE_SIZE + 60);
      }
    }
  },

  update(dt) {
    t += dt;
  },

  draw() {
    if (!batch || !tileset) return;

    // Draw the tilemap with a single draw call
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.draw(batch);

    // Draw info text
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("SpriteBatch Tilemap Demo", 10, 5);
    jove.graphics.print(`Tiles: ${batch.getCount()} | Buffer: ${batch.getBufferSize()} | FPS: ${jove.timer.getFPS()}`, 10, 20);
    jove.graphics.print(`All ${batch.getCount()} tiles rendered in 1 draw call`, 10, 35);

    // Draw the tileset preview in bottom-right
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.draw(tileset, 640, 450, 0, 1, 1);
    jove.graphics.setColor(150, 150, 150);
    jove.graphics.rectangle("line", 640, 450, 128, 128);
    jove.graphics.print("Tileset", 640, 440);
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
