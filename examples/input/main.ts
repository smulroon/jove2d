// jove2d input example — keyboard, mouse, text input, cursor control

import jove from "../../src/index.ts";

let rectX = 400;
let rectY = 300;
const speed = 200;
let lastKey = "(none)";
let mouseLabel = "";
let typedText = "";
let compositionText = "";
let compositionStart = 0;
let compositionLength = 0;
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
    jove.graphics.print("Type something (textinput + IME):", 10, 80);
    jove.graphics.setColor(100, 255, 100);
    // Show typed text with composition inline
    if (compositionText.length > 0) {
      // Draw committed text, then composition with underline
      jove.graphics.print(typedText, 10, 100);
      const committedWidth = jove.graphics.getFont().getWidth(typedText);
      // Draw composition text in yellow with underline
      jove.graphics.setColor(255, 255, 100);
      jove.graphics.print(compositionText, 10 + committedWidth, 100);
      const compWidth = jove.graphics.getFont().getWidth(compositionText);
      jove.graphics.line(10 + committedWidth, 114, 10 + committedWidth + compWidth, 114);
      // Draw cursor within composition
      const cursorOffset = jove.graphics.getFont().getWidth(compositionText.substring(0, compositionStart));
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.line(10 + committedWidth + cursorOffset, 100, 10 + committedWidth + cursorOffset, 114);
      // Draw trailing cursor after composition
      jove.graphics.setColor(100, 255, 100);
      jove.graphics.print("_", 10 + committedWidth + compWidth, 100);
    } else {
      jove.graphics.print(typedText + "_", 10, 100);
    }

    // IME status
    jove.graphics.setColor(150, 150, 150);
    if (compositionText.length > 0) {
      jove.graphics.print(`IME composing: "${compositionText}" cursor=${compositionStart} sel=${compositionLength}`, 10, 120);
    } else {
      jove.graphics.print("IME: idle (use an IME to see composition events)", 10, 120);
    }

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
    // Clear composition when text is committed
    compositionText = "";
    compositionStart = 0;
    compositionLength = 0;
  },

  textedited(text, start, length) {
    compositionText = text;
    compositionStart = start;
    compositionLength = length;
  },

  mousepressed(x, y, button) {
    console.log(`Mouse button ${button} pressed at ${x.toFixed(0)}, ${y.toFixed(0)}`);
  },
});
