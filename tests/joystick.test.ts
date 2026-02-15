import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import * as jove from "../src/index.ts";

beforeAll(() => {
  jove.init();
});

afterAll(() => {
  jove.quit();
});

describe("jove.joystick module", () => {
  test("getJoysticks returns array", () => {
    const joysticks = jove.joystick.getJoysticks();
    expect(Array.isArray(joysticks)).toBe(true);
  });

  test("getJoystickCount returns number", () => {
    const count = jove.joystick.getJoystickCount();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("getJoystickCount matches getJoysticks length", () => {
    const joysticks = jove.joystick.getJoysticks();
    const count = jove.joystick.getJoystickCount();
    expect(joysticks.length).toBe(count);
  });

  test("_getByInstanceId returns null for invalid ID", () => {
    const joy = jove.joystick._getByInstanceId(999999);
    expect(joy).toBeNull();
  });
});

describe("jove.joystick — connected device tests", () => {
  // These tests only run if a joystick is connected
  const joysticks = jove.joystick.getJoysticks();

  test.skipIf(joysticks.length === 0)("joystick has valid name", () => {
    const joy = joysticks[0];
    expect(typeof joy.getName()).toBe("string");
    expect(joy.getName().length).toBeGreaterThan(0);
  });

  test.skipIf(joysticks.length === 0)("joystick getID returns [number, number]", () => {
    const joy = joysticks[0];
    const [id, instanceId] = joy.getID();
    expect(typeof id).toBe("number");
    expect(typeof instanceId).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  test.skipIf(joysticks.length === 0)("joystick isConnected returns true", () => {
    const joy = joysticks[0];
    expect(joy.isConnected()).toBe(true);
  });

  test.skipIf(joysticks.length === 0)("joystick getAxisCount returns non-negative", () => {
    const joy = joysticks[0];
    expect(joy.getAxisCount()).toBeGreaterThanOrEqual(0);
  });

  test.skipIf(joysticks.length === 0)("joystick getButtonCount returns non-negative", () => {
    const joy = joysticks[0];
    expect(joy.getButtonCount()).toBeGreaterThanOrEqual(0);
  });

  test.skipIf(joysticks.length === 0)("joystick getHatCount returns non-negative", () => {
    const joy = joysticks[0];
    expect(joy.getHatCount()).toBeGreaterThanOrEqual(0);
  });

  test.skipIf(joysticks.length === 0)("joystick isGamepad returns boolean", () => {
    const joy = joysticks[0];
    expect(typeof joy.isGamepad()).toBe("boolean");
  });

  test.skipIf(joysticks.length === 0)("joystick getDeviceInfo returns [number, number, number]", () => {
    const joy = joysticks[0];
    const [vendor, product, version] = joy.getDeviceInfo();
    expect(typeof vendor).toBe("number");
    expect(typeof product).toBe("number");
    expect(typeof version).toBe("number");
  });

  test.skipIf(joysticks.length === 0)("joystick isVibrationSupported returns boolean", () => {
    const joy = joysticks[0];
    expect(typeof joy.isVibrationSupported()).toBe("boolean");
  });

  test.skipIf(joysticks.length === 0)("joystick getAxis returns -1 to 1", () => {
    const joy = joysticks[0];
    if (joy.getAxisCount() > 0) {
      const val = joy.getAxis(0);
      expect(val).toBeGreaterThanOrEqual(-1);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  test.skipIf(joysticks.length === 0)("joystick isDown returns boolean", () => {
    const joy = joysticks[0];
    if (joy.getButtonCount() > 0) {
      expect(typeof joy.isDown(1)).toBe("boolean");
    }
  });

  test.skipIf(joysticks.length === 0)("joystick getHat returns direction string", () => {
    const joy = joysticks[0];
    if (joy.getHatCount() > 0) {
      const dir = joy.getHat(0);
      expect(["c", "u", "r", "d", "l", "ru", "rd", "lu", "ld"]).toContain(dir);
    }
  });
});

describe("SDL type constants", () => {
  // Verify the mapping tables are consistent
  const { GAMEPAD_BUTTON_NAMES, GAMEPAD_BUTTON_FROM_NAME, GAMEPAD_AXIS_NAMES, GAMEPAD_AXIS_FROM_NAME, HAT_DIRECTION_NAMES } = require("../src/sdl/types.ts");

  test("gamepad button name mappings are bidirectional", () => {
    for (const [idx, name] of Object.entries(GAMEPAD_BUTTON_NAMES)) {
      expect(GAMEPAD_BUTTON_FROM_NAME[name as string]).toBe(Number(idx));
    }
  });

  test("gamepad axis name mappings are bidirectional", () => {
    for (const [idx, name] of Object.entries(GAMEPAD_AXIS_NAMES)) {
      expect(GAMEPAD_AXIS_FROM_NAME[name as string]).toBe(Number(idx));
    }
  });

  test("hat direction names cover all standard values", () => {
    expect(HAT_DIRECTION_NAMES[0x00]).toBe("c");
    expect(HAT_DIRECTION_NAMES[0x01]).toBe("u");
    expect(HAT_DIRECTION_NAMES[0x02]).toBe("r");
    expect(HAT_DIRECTION_NAMES[0x04]).toBe("d");
    expect(HAT_DIRECTION_NAMES[0x08]).toBe("l");
    expect(HAT_DIRECTION_NAMES[0x03]).toBe("ru");
    expect(HAT_DIRECTION_NAMES[0x06]).toBe("rd");
    expect(HAT_DIRECTION_NAMES[0x09]).toBe("lu");
    expect(HAT_DIRECTION_NAMES[0x0c]).toBe("ld");
  });

  test("15 gamepad buttons defined", () => {
    expect(Object.keys(GAMEPAD_BUTTON_NAMES).length).toBe(15);
    expect(Object.keys(GAMEPAD_BUTTON_FROM_NAME).length).toBe(15);
  });

  test("6 gamepad axes defined", () => {
    expect(Object.keys(GAMEPAD_AXIS_NAMES).length).toBe(6);
    expect(Object.keys(GAMEPAD_AXIS_FROM_NAME).length).toBe(6);
  });
});
