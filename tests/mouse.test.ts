import { describe, test, expect, afterEach } from "bun:test";
import { init, quit, window, mouse } from "../src/jove/index.ts";

// Cursor creation requires a real video driver (not dummy)
const isDummy = process.env.SDL_VIDEODRIVER === "dummy";
const cursorTest = isDummy ? test.skip : test;

describe("jove.mouse", () => {
  afterEach(() => {
    quit();
  });

  test("getPosition returns two numbers", () => {
    init();
    window.setMode(320, 240);
    const [x, y] = mouse.getPosition();
    expect(typeof x).toBe("number");
    expect(typeof y).toBe("number");
  });

  test("getX returns a number", () => {
    init();
    window.setMode(320, 240);
    expect(typeof mouse.getX()).toBe("number");
  });

  test("getY returns a number", () => {
    init();
    window.setMode(320, 240);
    expect(typeof mouse.getY()).toBe("number");
  });

  test("isDown returns boolean", () => {
    init();
    window.setMode(320, 240);
    const result = mouse.isDown(1);
    expect(typeof result).toBe("boolean");
  });

  test("functions safe to call with no window", () => {
    init();
    // No window created — these should not throw
    expect(() => mouse.getPosition()).not.toThrow();
    expect(() => mouse.getX()).not.toThrow();
    expect(() => mouse.getY()).not.toThrow();
    expect(() => mouse.isDown(1)).not.toThrow();
    expect(() => mouse.setPosition(0, 0)).not.toThrow();
  });

  test("setX does not throw", () => {
    init();
    window.setMode(320, 240);
    expect(() => mouse.setX(100)).not.toThrow();
  });

  test("setY does not throw", () => {
    init();
    window.setMode(320, 240);
    expect(() => mouse.setY(100)).not.toThrow();
  });

  test("isCursorSupported returns true", () => {
    init();
    expect(mouse.isCursorSupported()).toBe(true);
  });

  cursorTest("getSystemCursor returns a Cursor with valid _ptr", () => {
    init();
    const cursor = mouse.getSystemCursor("arrow");
    expect(cursor._ptr).toBeTruthy();
    expect(cursor._type).toBe("system");
  });

  cursorTest("getSystemCursor caches — same object both calls", () => {
    init();
    const a = mouse.getSystemCursor("hand");
    const b = mouse.getSystemCursor("hand");
    expect(a).toBe(b);
  });

  cursorTest("setCursor / getCursor round-trip", () => {
    init();
    const cursor = mouse.getSystemCursor("crosshair");
    mouse.setCursor(cursor);
    expect(mouse.getCursor()).toBe(cursor);
  });

  cursorTest("setCursor() with no args resets to null", () => {
    init();
    const cursor = mouse.getSystemCursor("hand");
    mouse.setCursor(cursor);
    mouse.setCursor();
    expect(mouse.getCursor()).toBeNull();
  });

  cursorTest("newCursor creates image cursor from RGBA data", () => {
    init();
    // Create a tiny 2x2 red cursor
    const data = new Uint8Array(2 * 2 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;     // R
      data[i + 1] = 0;   // G
      data[i + 2] = 0;   // B
      data[i + 3] = 255; // A
    }
    const cursor = mouse.newCursor({ data, width: 2, height: 2, format: "rgba8888" });
    expect(cursor._ptr).toBeTruthy();
    expect(cursor._type).toBe("image");
    cursor.release();
  });
});
