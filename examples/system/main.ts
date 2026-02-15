// jove2d system example — OS info, clipboard, power, and math utilities
//
// Demonstrates: jove.system.getOS, getProcessorCount, setClipboardText,
// getClipboardText, getPowerInfo, jove.math.gammaToLinear/linearToGamma

import jove from "../../src/index.ts";

let clipboardContent = "";
let messages: string[] = [];

function log(msg: string) {
  messages.push(msg);
  if (messages.length > 20) messages.shift();
}

await jove.run({
  load() {
    jove.window.setTitle("System Info Example");
    jove.graphics.setBackgroundColor(25, 30, 40);

    // System info
    log(`OS: ${jove.system.getOS()}`);
    log(`CPU cores: ${jove.system.getProcessorCount()}`);
    log(`SDL version: ${jove.getVersion()}`);
    log("");

    // Power info
    const power = jove.system.getPowerInfo();
    log(`Power state: ${power.state}`);
    log(`Battery: ${power.percent}%`);
    log(`Time remaining: ${power.seconds}s`);
    log("");

    // Clipboard
    jove.system.setClipboardText("Hello from jove2d!");
    clipboardContent = jove.system.getClipboardText();
    log(`Clipboard set to: "${clipboardContent}"`);
    log("");

    // Color space conversion demo
    const gamma = 0.5;
    const linear = jove.math.gammaToLinear(gamma);
    const back = jove.math.linearToGamma(linear);
    log(`Color: gamma(${gamma}) -> linear(${linear.toFixed(4)}) -> gamma(${back.toFixed(4)})`);
    log("");
    log("Press C to copy FPS to clipboard");
    log("Press O to open jove2d GitHub (if supported)");
  },

  draw() {
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("System Info", 10, 10);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 10);

    // Display system info
    jove.graphics.setColor(200, 220, 200);
    for (let i = 0; i < messages.length; i++) {
      jove.graphics.print(messages[i], 10, 40 + i * 18);
    }

    // Gamma/linear color ramp visualization
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("Gamma ramp (top) vs Linear ramp (bottom)", 10, 420);

    for (let x = 0; x < 256; x++) {
      const norm = x / 255;

      // Gamma space (perceptually uniform)
      const gv = Math.floor(norm * 255);
      jove.graphics.setColor(gv, gv, gv);
      jove.graphics.point(10 + x * 3, 440);
      jove.graphics.point(10 + x * 3, 441);
      jove.graphics.point(10 + x * 3, 442);
      jove.graphics.point(10 + x * 3, 443);

      // Linear space
      const lv = Math.floor(jove.math.gammaToLinear(norm) * 255);
      jove.graphics.setColor(lv, lv, lv);
      jove.graphics.point(10 + x * 3, 455);
      jove.graphics.point(10 + x * 3, 456);
      jove.graphics.point(10 + x * 3, 457);
      jove.graphics.point(10 + x * 3, 458);
    }

    // Clipboard display
    jove.graphics.setColor(255, 255, 200);
    jove.graphics.print(`Clipboard: "${clipboardContent}"`, 10, 480);
  },

  keypressed(key) {
    if (key === "escape") {
      jove.window.close();
    } else if (key === "c") {
      const fps = `FPS: ${jove.timer.getFPS()}`;
      jove.system.setClipboardText(fps);
      clipboardContent = fps;
      log(`Copied "${fps}" to clipboard`);
    } else if (key === "o") {
      jove.system.openURL("https://github.com");
      log("Opened URL in browser");
    }
  },
});
