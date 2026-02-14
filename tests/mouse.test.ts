import { describe, test, expect, afterEach } from "bun:test";
import { init, quit, window, mouse } from "../src/jove/index.ts";

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
});
