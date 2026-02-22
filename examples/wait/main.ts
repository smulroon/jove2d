// jove2d event.wait example — animation only advances when events arrive
//
// Demonstrates: jove.event.wait() blocks until input, so the spinning
// shapes only animate while you're moving the mouse or pressing keys.
// Stop interacting and the animation freezes.
//
// Uses a custom loop instead of jove.run() to replace pollEvents with wait().

import jove from "../../src/index.ts";

// Init SDL + window + renderer manually
jove.init();
jove.window.setMode(800, 600, { resizable: true });
jove.window.setTitle("event.wait — move mouse to animate");
jove.graphics._createRenderer();
jove.timer._init();
jove.graphics.setBackgroundColor(15, 15, 30);

let angle = 0;
let eventCount = 0;
let lastEventType = "none";
let running = true;

while (running && jove.window.isOpen()) {
  const dt = jove.timer.step();

  // event.wait() blocks here until input arrives
  const events = jove.event.wait();

  for (const ev of events) {
    eventCount++;
    lastEventType = ev.type;

    if (ev.type === "quit" || ev.type === "close") {
      running = false;
    }
    if (ev.type === "keypressed" && (ev as any).key === "escape") {
      running = false;
    }
  }

  // Animation advances only when events arrived
  angle += dt * 2;

  // Draw
  jove.graphics._beginFrame();

  const [w, h] = jove.graphics.getDimensions();
  const cx = w / 2;
  const cy = h / 2;

  // Spinning ring of circles
  for (let i = 0; i < 12; i++) {
    const a = angle + (i * Math.PI * 2) / 12;
    const r = 120;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const shade = Math.floor(128 + 127 * Math.sin(a + angle));
    jove.graphics.setColor(shade, 100, 255 - shade);
    jove.graphics.circle("fill", x, y, 20);
  }

  // Inner spinning triangle
  jove.graphics.push();
  jove.graphics.translate(cx, cy);
  jove.graphics.rotate(angle * -1.5);
  jove.graphics.setColor(255, 220, 80);
  jove.graphics.polygon("fill", -40, 30, 40, 30, 0, -40);
  jove.graphics.pop();

  // Info text
  jove.graphics.setColor(255, 255, 255);
  jove.graphics.print("event.wait() demo", 10, 10);
  jove.graphics.print("Animation only plays while you interact", 10, 30);
  jove.graphics.print("Move mouse / press keys to animate. Stop to freeze.", 10, 50);

  jove.graphics.setColor(180, 180, 180);
  jove.graphics.print(`Events received: ${eventCount}`, 10, 80);
  jove.graphics.print(`Last event: ${lastEventType}`, 10, 100);
  jove.graphics.print(`Angle: ${angle.toFixed(2)}`, 10, 120);

  jove.graphics._endFrame();
}

jove.quit();
