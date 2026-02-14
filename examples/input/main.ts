// jove2d input example — keyboard and mouse

import jove from "../../src/index.ts";

let rectX = 400;
let rectY = 300;
const speed = 200;
let lastKey = "(none)";
let mouseLabel = "";

await jove.run({
  load() {
    jove.window.setTitle("Input Example");
    jove.graphics.setBackgroundColor(30, 30, 40);
  },

  update(dt) {
    // Move rectangle with arrow keys
    if (jove.keyboard.isDown("up")) rectY -= speed * dt;
    if (jove.keyboard.isDown("down")) rectY += speed * dt;
    if (jove.keyboard.isDown("left")) rectX -= speed * dt;
    if (jove.keyboard.isDown("right")) rectX += speed * dt;

    // Update mouse label
    const [mx, my] = jove.mouse.getPosition();
    mouseLabel = `mouse: ${mx.toFixed(0)}, ${my.toFixed(0)}`;
  },

  draw() {
    // Draw the movable rectangle
    jove.graphics.setColor(100, 180, 255);
    jove.graphics.rectangle("fill", rectX - 25, rectY - 25, 50, 50);

    // Draw crosshair at mouse position
    const [mx, my] = jove.mouse.getPosition();
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.line(mx - 10, my, mx + 10, my);
    jove.graphics.line(mx, my - 10, mx, my + 10);

    // HUD text
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("Arrow keys to move, ESC to quit", 10, 10);
    jove.graphics.print(`Last key: ${lastKey}`, 10, 30);
    jove.graphics.print(mouseLabel, 10, 50);
  },

  keypressed(key, _scancode, isRepeat) {
    lastKey = key + (isRepeat ? " (repeat)" : "");
    if (key === "escape") {
      jove.window.close();
    }
  },

  mousepressed(x, y, button) {
    console.log(`Mouse button ${button} pressed at ${x.toFixed(0)}, ${y.toFixed(0)}`);
  },
});
