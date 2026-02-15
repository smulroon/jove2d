// jove2d system example — OS info, display info, clipboard, power, and math utilities
//
// Demonstrates: jove.system.getOS, getProcessorCount, setClipboardText,
// getClipboardText, getPowerInfo, jove.math.gammaToLinear/linearToGamma,
// jove.window.getDisplayCount, getDisplayName, getFullscreenModes,
// getVSync, setVSync, fromPixels, toPixels, requestAttention

import jove from "../../src/index.ts";

let clipboardContent = "";
let messages: string[] = [];

function log(msg: string) {
  messages.push(msg);
  if (messages.length > 24) messages.shift();
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

    // Display info
    const displayCount = jove.window.getDisplayCount();
    log(`Displays: ${displayCount}`);
    for (let i = 1; i <= displayCount; i++) {
      log(`  Display ${i}: ${jove.window.getDisplayName(i)}`);
    }
    const modes = jove.window.getFullscreenModes(1);
    if (modes.length > 0) {
      const top3 = modes.slice(0, 3).map(m => `${m.width}x${m.height}`).join(", ");
      log(`  Fullscreen modes: ${top3}${modes.length > 3 ? ` ... (${modes.length} total)` : ""}`);
    }
    log(`  VSync: ${jove.window.getVSync()}`);
    log(`  DPI scale: ${jove.window.getDPIScale()}`);
    log(`  100px from pixels: ${jove.window.fromPixels(100)}`);
    log(`  100 units to pixels: ${jove.window.toPixels(100)}`);
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
    log("C=copy FPS  O=open URL  F=flash window  V=toggle vsync");
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
    const rampY = 480;
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("Gamma ramp (top) vs Linear ramp (bottom)", 10, rampY);

    for (let x = 0; x < 256; x++) {
      const norm = x / 255;

      // Gamma space (perceptually uniform)
      const gv = Math.floor(norm * 255);
      jove.graphics.setColor(gv, gv, gv);
      jove.graphics.point(10 + x * 3, rampY + 20);
      jove.graphics.point(10 + x * 3, rampY + 21);
      jove.graphics.point(10 + x * 3, rampY + 22);
      jove.graphics.point(10 + x * 3, rampY + 23);

      // Linear space
      const lv = Math.floor(jove.math.gammaToLinear(norm) * 255);
      jove.graphics.setColor(lv, lv, lv);
      jove.graphics.point(10 + x * 3, rampY + 35);
      jove.graphics.point(10 + x * 3, rampY + 36);
      jove.graphics.point(10 + x * 3, rampY + 37);
      jove.graphics.point(10 + x * 3, rampY + 38);
    }

    // Clipboard display
    jove.graphics.setColor(255, 255, 200);
    jove.graphics.print(`Clipboard: "${clipboardContent}"`, 10, rampY + 55);
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
    } else if (key === "f") {
      jove.window.requestAttention(false);
      log("Flashed window (briefly)");
    } else if (key === "v") {
      const current = jove.window.getVSync();
      const next = current === 0 ? 1 : 0;
      jove.window.setVSync(next);
      log(`VSync: ${jove.window.getVSync() === 1 ? "on" : "off"}`);
    }
  },
});
