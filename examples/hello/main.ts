// jove2d hello example — uses the game loop API

import jove from "../../src/index.ts";

let frameCount = 0;

await jove.run({
  load() {
    jove.window.setTitle("Hello jove2d!");
    console.log(`jove2d ${jove.getVersion()} — window opened!`);
  },

  update(dt) {
    frameCount++;
  },

  draw() {
    // Rendering will come later — for now the window just stays open
  },
});
