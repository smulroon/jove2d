// jove2d joystick/gamepad example
// Demonstrates: joystick detection, axes, buttons, hats, gamepad mapping, vibration

import jove from "../../src/index.ts";
import type { Joystick } from "../../src/index.ts";

const messages: string[] = [];
let selectedJoystick: Joystick | null = null;

function log(msg: string) {
  messages.push(msg);
  if (messages.length > 25) messages.shift();
}

await jove.run({
  load() {
    jove.window.setTitle("Joystick / Gamepad Example");
    jove.graphics.setBackgroundColor(20, 25, 35);

    const count = jove.joystick.getJoystickCount();
    log("=== Joystick/Gamepad Example ===");
    log("Connected joysticks: " + count);

    const joysticks = jove.joystick.getJoysticks();
    for (const joy of joysticks) {
      const [id] = joy.getID();
      log("  [" + id + "] " + joy.getName() + " (gamepad: " + joy.isGamepad() + ")");
      log("      axes: " + joy.getAxisCount() + ", buttons: " + joy.getButtonCount() + ", hats: " + joy.getHatCount());
      if (!selectedJoystick) selectedJoystick = joy;
    }

    if (count === 0) {
      log("");
      log("No joystick detected. Connect a controller and restart.");
    }
    log("");
    log("Press buttons / move sticks to see events.");
    log("Press V to test vibration (if supported).");
    log("Press ESC to quit.");
  },

  draw() {
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("Joystick / Gamepad", 10, 10);
    jove.graphics.print("FPS: " + jove.timer.getFPS(), 700, 10);

    // Draw event log
    jove.graphics.setColor(200, 220, 200);
    let y = 40;
    for (const msg of messages) {
      jove.graphics.print(msg, 10, y);
      y += 18;
    }

    // Draw live joystick state if one is selected
    if (selectedJoystick && selectedJoystick.isConnected()) {
      const joy = selectedJoystick;
      const baseX = 450;
      const baseY = 200;

      jove.graphics.setColor(255, 255, 255);
      jove.graphics.print("Live: " + joy.getName(), baseX, baseY - 30);

      // Draw axes
      const axisCount = joy.getAxisCount();
      for (let i = 0; i < Math.min(axisCount, 6); i++) {
        const val = joy.getAxis(i);
        const barY = baseY + i * 25;
        jove.graphics.setColor(77, 77, 77);
        jove.graphics.rectangle("fill", baseX, barY, 200, 18);
        jove.graphics.setColor(51, 179, 77);
        const barW = val * 100;
        jove.graphics.rectangle("fill", baseX + 100, barY, barW, 18);
        jove.graphics.setColor(255, 255, 255);
        jove.graphics.print("Axis " + i + ": " + val.toFixed(2), baseX + 210, barY);
      }

      // Draw buttons
      const btnY = baseY + Math.min(axisCount, 6) * 25 + 10;
      const btnCount = joy.getButtonCount();
      for (let i = 0; i < Math.min(btnCount, 16); i++) {
        const row = Math.floor(i / 8);
        const col = i % 8;
        const bx = baseX + col * 40;
        const by = btnY + row * 30;
        const pressed = joy.isDown(i + 1);
        jove.graphics.setColor(pressed ? 51 : 77, pressed ? 204 : 77, pressed ? 51 : 77);
        jove.graphics.rectangle("fill", bx, by, 30, 22);
        jove.graphics.setColor(255, 255, 255);
        jove.graphics.print("" + (i + 1), bx + 8, by + 3);
      }

      // Draw hats
      const hatY = btnY + Math.ceil(Math.min(btnCount, 16) / 8) * 30 + 10;
      const hatCount = joy.getHatCount();
      for (let i = 0; i < hatCount; i++) {
        const dir = joy.getHat(i);
        jove.graphics.setColor(255, 255, 255);
        jove.graphics.print("Hat " + (i + 1) + ": " + dir, baseX, hatY + i * 20);
      }

      // Gamepad info
      if (joy.isGamepad()) {
        const gpY = hatY + hatCount * 20 + 10;
        jove.graphics.setColor(179, 179, 255);
        jove.graphics.print("Gamepad mapped:", baseX, gpY);
        const gpAxes = ["leftx", "lefty", "rightx", "righty", "triggerleft", "triggerright"];
        for (let i = 0; i < gpAxes.length; i++) {
          const val = joy.getGamepadAxis(gpAxes[i]);
          jove.graphics.print("  " + gpAxes[i] + ": " + val.toFixed(2), baseX, gpY + 18 + i * 16);
        }
      }
    }
  },

  joystickadded(joy) {
    const [id] = joy.getID();
    log("+ Joystick added: [" + id + "] " + joy.getName());
    log("  gamepad: " + joy.isGamepad() + ", axes: " + joy.getAxisCount() + ", buttons: " + joy.getButtonCount());
    if (!selectedJoystick) selectedJoystick = joy;
  },

  joystickremoved(joy) {
    const [id] = joy.getID();
    log("- Joystick removed: [" + id + "] " + joy.getName());
    if (selectedJoystick === joy) selectedJoystick = null;
  },

  joystickpressed(joy, button) {
    log("Button pressed: " + button);
  },

  joystickreleased(joy, button) {
    log("Button released: " + button);
  },

  joystickaxis(joy, axis, value) {
    if (Math.abs(value) > 0.1) {
      log("Axis " + axis + ": " + value.toFixed(3));
    }
  },

  joystickhat(joy, hat, direction) {
    log("Hat " + hat + ": " + direction);
  },

  gamepadpressed(joy, button) {
    log("Gamepad button: " + button);
  },

  gamepadreleased(joy, button) {
    log("Gamepad released: " + button);
  },

  gamepadaxis(joy, axis, value) {
    if (Math.abs(value) > 0.1) {
      log("Gamepad axis " + axis + ": " + value.toFixed(3));
    }
  },

  keypressed(key) {
    if (key === "escape") {
      jove.event.quit();
    }
    if (key === "v" && selectedJoystick) {
      const supported = selectedJoystick.isVibrationSupported();
      if (supported) {
        selectedJoystick.setVibration(0.5, 0.5, 0.5);
        log("Vibration: 0.5s pulse");
      } else {
        log("Vibration not supported on this device");
      }
    }
  },
});
