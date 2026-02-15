// jove2d input example — keyboard, mouse, text input, cursor control

import jove from "../../src/index.ts";

let rectX = 400;
let rectY = 300;
const speed = 200;
let lastKey = "(none)";
let mouseLabel = "";
let typedText = "";
let cursorVisible = true;
let mouseGrabbed = false;
const cursorTypes = ["arrow", "ibeam", "hand", "crosshair", "wait", "no"] as const;
let cursorIndex = 0;

await jove.run({
  load() {
    jove.window.setTitle("Input Example");
    jove.graphics.setBackgroundColor(30, 30, 40);
    // Enable text input for textinput callback
    jove.keyboard.setTextInput(true);
    // Disable key repeat so keypressed only fires on initial press
    jove.keyboard.setKeyRepeat(false);
  },

  update(dt) {
    // Move rectangle with arrow keys (isDown queries live state, unaffected by keyRepeat)
    if (jove.keyboard.isDown("up")) rectY -= speed * dt;
    if (jove.keyboard.isDown("down")) rectY += speed * dt;
    if (jove.keyboard.isDown("left")) rectX -= speed * dt;
    if (jove.keyboard.isDown("right")) rectX += speed * dt;

    // Update mouse label
    const [mx, my] = jove.mouse.getPosition();
    mouseLabel = `mouse: ${mx.toFixed(0)}, ${my.toFixed(0)}`;
  },

  draw() {
    // Draw the movable rectangle in a local coordinate space
    jove.graphics.push();
    jove.graphics.translate(rectX, rectY);
    jove.graphics.setColor(100, 180, 255);
    jove.graphics.rectangle("fill", -25, -25, 50, 50);

    // Show mouse position in local (rectangle) coords
    const [mx, my] = jove.mouse.getPosition();
    const [lx, ly] = jove.graphics.inverseTransformPoint(mx, my);
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print(`local: ${lx.toFixed(0)},${ly.toFixed(0)}`, -25, 30);
    jove.graphics.pop();

    // Draw crosshair at mouse position
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.line(mx - 10, my, mx + 10, my);
    jove.graphics.line(mx, my - 10, mx, my + 10);

    // HUD text
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("Arrow keys: move | ESC: quit", 10, 10);
    jove.graphics.print(`Last key: ${lastKey}`, 10, 30);
    jove.graphics.print(mouseLabel, 10, 50);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 10);

    // Text input display
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("Type something (textinput):", 10, 80);
    jove.graphics.setColor(100, 255, 100);
    jove.graphics.print(typedText + "_", 10, 100);

    // Mouse state info
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print(`Cursor visible: ${cursorVisible} (V to toggle)`, 10, 520);
    jove.graphics.print(`Mouse grabbed: ${mouseGrabbed} (G to toggle)`, 10, 540);
    jove.graphics.print(`Cursor type: ${cursorTypes[cursorIndex]} (C to cycle)`, 10, 560);
    jove.graphics.print("Key repeat: OFF (only initial presses shown)", 10, 580);
  },

  keypressed(key, _scancode, isRepeat) {
    lastKey = key;

    if (key === "escape") {
      jove.window.close();
    } else if (key === "v") {
      cursorVisible = !cursorVisible;
      jove.mouse.setVisible(cursorVisible);
    } else if (key === "g") {
      mouseGrabbed = !mouseGrabbed;
      jove.mouse.setGrabbed(mouseGrabbed);
    } else if (key === "c") {
      cursorIndex = (cursorIndex + 1) % cursorTypes.length;
      jove.mouse.setCursor(jove.mouse.getSystemCursor(cursorTypes[cursorIndex]));
    } else if (key === "backspace") {
      typedText = typedText.slice(0, -1);
    }
  },

  textinput(text) {
    typedText += text;
  },

  mousepressed(x, y, button) {
    console.log(`Mouse button ${button} pressed at ${x.toFixed(0)}, ${y.toFixed(0)}`);
  },
});
