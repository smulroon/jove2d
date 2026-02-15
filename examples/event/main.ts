// jove2d event example — custom events, event.push/clear/quit, file drops
//
// Demonstrates: jove.event.push, jove.event.clear, jove.event.quit,
// textinput callback, filedropped callback, visible callback

import jove from "../../src/index.ts";

let log: string[] = [];
let eventCount = 0;

function addLog(msg: string) {
  log.push(`[${eventCount}] ${msg}`);
  eventCount++;
  if (log.length > 25) log.shift();
}

await jove.run({
  load() {
    jove.window.setTitle("Event System Example");
    jove.graphics.setBackgroundColor(25, 20, 35);
    jove.keyboard.setTextInput(true);

    addLog("Event system ready.");
    addLog("Press 1: push custom focus event");
    addLog("Press 2: push custom textinput event");
    addLog("Press 3: clear all events");
    addLog("Press Q: push quit event (via event.quit())");
    addLog("Drop a file onto the window to see filedropped");
    addLog("Minimize/restore to see visible callback");
    addLog("---");
  },

  update(dt) {
    // nothing
  },

  draw() {
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("Event System Demo", 10, 10);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 10);

    // Controls
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("1=push focus | 2=push textinput | 3=clear | Q=quit | ESC=close", 10, 30);

    // Event log
    jove.graphics.setColor(160, 220, 160);
    for (let i = 0; i < log.length; i++) {
      jove.graphics.print(log[i], 10, 60 + i * 18);
    }
  },

  keypressed(key) {
    addLog(`keypressed: "${key}"`);

    if (key === "escape") {
      jove.window.close();
    } else if (key === "1") {
      // Inject a custom focus event
      jove.event.push({ type: "focus", hasFocus: false });
      jove.event.push({ type: "focus", hasFocus: true });
      addLog("  -> pushed 2 focus events");
    } else if (key === "2") {
      // Inject a custom textinput event
      jove.event.push({ type: "textinput", text: "injected!" });
      addLog("  -> pushed textinput event");
    } else if (key === "3") {
      jove.event.clear();
      addLog("  -> cleared all events");
    } else if (key === "q") {
      // This will push a quit event, triggering the quit callback
      addLog("  -> calling event.quit()...");
      jove.event.quit();
    }
  },

  textinput(text) {
    addLog(`textinput: "${text}"`);
  },

  focus(hasFocus) {
    addLog(`focus: ${hasFocus}`);
  },

  filedropped(path) {
    addLog(`filedropped: ${path}`);
  },

  visible(vis) {
    addLog(`visible: ${vis}`);
  },

  quit() {
    addLog("quit callback fired!");
    // Return true to cancel the quit (first time only for demo)
    if (eventCount < 50) {
      addLog("  -> cancelled quit (press Q again or ESC to really quit)");
      return true;
    }
  },
});
