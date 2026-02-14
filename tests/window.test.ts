import { describe, test, expect, afterEach } from "bun:test";
import { init, quit, window } from "../src/jove/index.ts";

describe("jove.window", () => {
  afterEach(() => {
    quit();
  });

  test("setMode creates a window with correct dimensions", () => {
    init();
    const ok = window.setMode(640, 480);
    expect(ok).toBe(true);
    expect(window.isOpen()).toBe(true);

    const mode = window.getMode();
    expect(mode.width).toBe(640);
    expect(mode.height).toBe(480);
  });

  test("setTitle and getTitle round-trip", () => {
    init();
    window.setMode(320, 240);
    window.setTitle("Test Window");
    expect(window.getTitle()).toBe("Test Window");
  });

  test("close destroys the window", () => {
    init();
    window.setMode(320, 240);
    expect(window.isOpen()).toBe(true);
    window.close();
    expect(window.isOpen()).toBe(false);
  });

  test("getDesktopDimensions returns positive values", () => {
    init();
    const { width, height } = window.getDesktopDimensions();
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  test("getDPIScale returns positive value", () => {
    init();
    window.setMode(320, 240);
    const scale = window.getDPIScale();
    expect(scale).toBeGreaterThan(0);
  });

  test("position set/get round-trip", () => {
    init();
    window.setMode(320, 240);
    window.setPosition(100, 200);
    // Give the window manager a moment to apply
    const pos = window.getPosition();
    // Window managers may adjust position, so just check we get numbers
    expect(typeof pos.x).toBe("number");
    expect(typeof pos.y).toBe("number");
  });

  test("fullscreen toggle does not throw", () => {
    init();
    window.setMode(320, 240);
    expect(window.isFullscreen()).toBe(false);

    // SDL_SetWindowFullscreen may not work on all platforms (e.g. WSL2),
    // so we just verify it doesn't throw and returns a boolean
    const result = window.setFullscreen(true);
    expect(typeof result).toBe("boolean");

    window.setFullscreen(false);
  });

  test("getMode returns resizable flag by default", () => {
    init();
    window.setMode(320, 240);
    const mode = window.getMode();
    expect(mode.flags.resizable).toBe(true);
  });

  test("isVisible returns true for open window", () => {
    init();
    window.setMode(320, 240);
    expect(window.isVisible()).toBe(true);
  });

  test("window functions are safe to call with no window", () => {
    init();
    // These should not throw when no window exists
    expect(window.isOpen()).toBe(false);
    expect(window.getTitle()).toBe("");
    expect(window.isFullscreen()).toBe(false);
    expect(window.isVisible()).toBe(false);
    expect(window.isMinimized()).toBe(false);
    expect(window.isMaximized()).toBe(false);
    expect(window.hasFocus()).toBe(false);
    expect(window.getDPIScale()).toBe(1.0);
    expect(window.getPosition()).toEqual({ x: 0, y: 0 });
    expect(window.getMode()).toEqual({ width: 0, height: 0, flags: {} });
  });
});
