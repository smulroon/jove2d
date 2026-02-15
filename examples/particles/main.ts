// jove2d ParticleSystem example — fire + smoke
//
// Fire particles rise upward with orange→red→black fade.
// Smoke particles drift up slowly with gray→transparent fade.
// Both systems follow the mouse. Click to burst 50 fire particles.

import jove from "../../src/index.ts";
import type { ParticleSystem } from "../../src/jove/particles.ts";

let fire: ParticleSystem | null = null;
let smoke: ParticleSystem | null = null;
let mouseX = 400;
let mouseY = 400;

await jove.run({
  load() {
    jove.window.setTitle("ParticleSystem Example — Fire & Smoke");
    jove.graphics.setBackgroundColor(20, 20, 30);

    // Create a small white particle texture (canvas)
    const particleImg = jove.graphics.newCanvas(8, 8);
    if (!particleImg) return;
    jove.graphics.setCanvas(particleImg);
    jove.graphics.clear(0, 0, 0, 0);
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.circle("fill", 4, 4, 4);
    jove.graphics.setCanvas(null);

    // --- Fire system ---
    fire = jove.graphics.newParticleSystem(particleImg, 500);
    if (!fire) return;
    fire.setParticleLifetime(0.3, 0.8);
    fire.setEmissionRate(200);
    fire.setSpeed(80, 150);
    fire.setDirection(-Math.PI / 2); // upward
    fire.setSpread(Math.PI / 4);
    fire.setLinearAcceleration(-20, -100, 20, -50); // slight upward + horizontal drift
    fire.setSizes(1.5, 1, 0.3);
    fire.setSizeVariation(0.5);
    fire.setColors(
      255, 220, 80, 255,    // bright yellow
      255, 120, 20, 255,    // orange
      200, 40, 10, 200,     // dark red
      80, 20, 10, 0,        // fade out
    );
    fire.setSpin(-3, 3);
    fire.setPosition(mouseX, mouseY);
    fire.setEmissionArea("normal", 10, 3);
    fire.start();

    // --- Smoke system ---
    smoke = jove.graphics.newParticleSystem(particleImg, 300);
    if (!smoke) return;
    smoke.setParticleLifetime(1, 2.5);
    smoke.setEmissionRate(30);
    smoke.setSpeed(20, 50);
    smoke.setDirection(-Math.PI / 2);
    smoke.setSpread(Math.PI / 6);
    smoke.setLinearAcceleration(-10, -30, 10, -10);
    smoke.setSizes(0.5, 1.5, 2.5);
    smoke.setSizeVariation(0.3);
    smoke.setColors(
      120, 120, 120, 100,   // medium gray
      80, 80, 80, 60,       // darker gray
      50, 50, 50, 0,        // fade out
    );
    smoke.setSpin(-1, 1);
    smoke.setPosition(mouseX, mouseY - 20);
    smoke.setEmissionArea("normal", 5, 2);
    smoke.start();
  },

  update(dt) {
    if (fire) {
      fire.moveTo(mouseX, mouseY);
      fire.update(dt);
    }
    if (smoke) {
      smoke.moveTo(mouseX, mouseY - 20);
      smoke.update(dt);
    }
  },

  draw() {
    // Draw smoke behind fire
    if (smoke) {
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.setBlendMode("add");
      jove.graphics.draw(smoke);
    }

    if (fire) {
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.setBlendMode("add");
      jove.graphics.draw(fire);
    }

    jove.graphics.setBlendMode("alpha");

    // Info text
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("ParticleSystem Demo — Move mouse, click for burst", 10, 5);
    jove.graphics.print(`Fire: ${fire?.getCount() ?? 0} | Smoke: ${smoke?.getCount() ?? 0} | FPS: ${jove.timer.getFPS()}`, 10, 20);
  },

  mousemoved(x, y) {
    mouseX = x;
    mouseY = y;
  },

  mousepressed(x, y, button) {
    if (button === 1 && fire) {
      fire.emit(50);
    }
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
    if (key === "space") {
      if (fire) {
        if (fire.isActive()) {
          fire.pause();
          smoke?.pause();
        } else {
          fire.start();
          smoke?.start();
        }
      }
    }
  },
});
