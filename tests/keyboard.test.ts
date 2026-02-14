import { describe, test, expect, afterEach } from "bun:test";
import { init, quit, window, keyboard } from "../src/jove/index.ts";

describe("jove.keyboard", () => {
  afterEach(() => {
    quit();
  });

  test("isDown returns boolean without throwing", () => {
    init();
    window.setMode(320, 240);
    const result = keyboard.isDown("a");
    expect(typeof result).toBe("boolean");
  });

  test("isDown with unknown key returns false", () => {
    init();
    window.setMode(320, 240);
    expect(keyboard.isDown("nonexistentkey")).toBe(false);
  });

  test("isDown with multiple keys returns boolean", () => {
    init();
    window.setMode(320, 240);
    const result = keyboard.isDown("a", "b", "c");
    expect(typeof result).toBe("boolean");
  });

  test("isScancodeDown returns boolean", () => {
    init();
    window.setMode(320, 240);
    const result = keyboard.isScancodeDown("space");
    expect(typeof result).toBe("boolean");
  });

  test("getKeyFromScancode / getScancodeFromKey round-trip", () => {
    init();
    const key = keyboard.getKeyFromScancode("a");
    expect(key).toBe("a");
    const scancode = keyboard.getScancodeFromKey("a");
    expect(scancode).toBe("a");
  });

  test("getKeyFromScancode with unknown returns input", () => {
    init();
    expect(keyboard.getKeyFromScancode("unknownkey")).toBe("unknownkey");
  });

  test("functions safe to call with no window", () => {
    init();
    expect(() => keyboard.isDown("a")).not.toThrow();
    expect(() => keyboard.isScancodeDown("space")).not.toThrow();
  });
});
