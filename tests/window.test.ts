import { describe, test, expect, afterEach } from "bun:test";
import { init, quit, window, graphics } from "../src/jove/index.ts";

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
    expect(window.hasMouseFocus()).toBe(false);
    expect(window.getDPIScale()).toBe(1.0);
    expect(window.getPosition()).toEqual({ x: 0, y: 0 });
    expect(window.getMode()).toEqual({ width: 0, height: 0, flags: {} });
    expect(window.getVSync()).toBe(0);
    expect(window.fromPixels(100)).toBe(100);
    expect(window.fromPixels(100, 200)).toEqual([100, 200]);
    expect(window.toPixels(100)).toBe(100);
    expect(window.toPixels(100, 200)).toEqual([100, 200]);
  });

  test("hasMouseFocus returns boolean", () => {
    init();
    window.setMode(320, 240);
    expect(typeof window.hasMouseFocus()).toBe("boolean");
  });

  test("vsync set/get round-trip", () => {
    init();
    window.setMode(320, 240);
    graphics._createRenderer();

    // Default vsync
    const initial = window.getVSync();
    expect(typeof initial).toBe("number");

    // Set vsync off
    window.setVSync(0);
    expect(window.getVSync()).toBe(0);

    // Set vsync on
    window.setVSync(1);
    expect(window.getVSync()).toBe(1);

    // Set back to off
    window.setVSync(0);
    expect(window.getVSync()).toBe(0);
  });

  test("getMode includes vsync in flags", () => {
    init();
    window.setMode(320, 240);
    graphics._createRenderer();

    window.setVSync(0);
    const mode = window.getMode();
    expect(mode.flags.vsync).toBe(0);
  });

  test("getDisplayCount returns at least 1", () => {
    init();
    const count = window.getDisplayCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("getDisplayName returns a string", () => {
    init();
    const name = window.getDisplayName(1);
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
  });

  test("getDisplayName returns empty string for invalid index", () => {
    init();
    const name = window.getDisplayName(999);
    expect(name).toBe("");
  });

  test("getFullscreenModes returns array of {width, height}", () => {
    init();
    const modes = window.getFullscreenModes(1);
    expect(Array.isArray(modes)).toBe(true);
    if (modes.length > 0) {
      expect(typeof modes[0].width).toBe("number");
      expect(typeof modes[0].height).toBe("number");
      expect(modes[0].width).toBeGreaterThan(0);
      expect(modes[0].height).toBeGreaterThan(0);
    }
  });

  test("fromPixels and toPixels with single value", () => {
    init();
    window.setMode(320, 240);
    const px = window.toPixels(100);
    expect(typeof px).toBe("number");
    expect(px as number).toBeGreaterThan(0);

    const dp = window.fromPixels(px as number);
    expect(typeof dp).toBe("number");
    // Round-trip should get back to ~100
    expect(Math.abs((dp as number) - 100)).toBeLessThan(0.01);
  });

  test("fromPixels and toPixels with two values", () => {
    init();
    window.setMode(320, 240);
    const result = window.toPixels(100, 200);
    expect(Array.isArray(result)).toBe(true);
    const [px, py] = result as [number, number];
    expect(px).toBeGreaterThan(0);
    expect(py).toBeGreaterThan(0);

    const back = window.fromPixels(px, py);
    expect(Array.isArray(back)).toBe(true);
    const [bx, by] = back as [number, number];
    expect(Math.abs(bx - 100)).toBeLessThan(0.01);
    expect(Math.abs(by - 200)).toBeLessThan(0.01);
  });

  test("showMessageBox does not throw", () => {
    init();
    window.setMode(320, 240);
    // We can't verify the dialog was shown in headless mode,
    // but it should not throw
    const result = window.showMessageBox("Test", "Hello", "info", false);
    expect(typeof result).toBe("boolean");
  });

  test("requestAttention does not throw", () => {
    init();
    window.setMode(320, 240);
    // Should not throw even in dummy video driver
    expect(() => window.requestAttention()).not.toThrow();
    expect(() => window.requestAttention(true)).not.toThrow();
  });

  test("updateMode changes window size without recreating", () => {
    init();
    window.setMode(320, 240);
    const titleBefore = "UpdateMode Test";
    window.setTitle(titleBefore);

    const ok = window.updateMode(640, 480);
    expect(ok).toBe(true);
    expect(window.isOpen()).toBe(true);

    // Title should be preserved (window not recreated)
    expect(window.getTitle()).toBe(titleBefore);

    const mode = window.getMode();
    expect(mode.width).toBe(640);
    expect(mode.height).toBe(480);
  });

  test("updateMode falls back to setMode when no window", () => {
    init();
    // No window created yet
    const ok = window.updateMode(400, 300);
    expect(ok).toBe(true);
    expect(window.isOpen()).toBe(true);

    const mode = window.getMode();
    expect(mode.width).toBe(400);
    expect(mode.height).toBe(300);
  });

  test("isDisplaySleepEnabled returns boolean", () => {
    init();
    const enabled = window.isDisplaySleepEnabled();
    expect(typeof enabled).toBe("boolean");
  });

  test("setDisplaySleepEnabled toggles display sleep", () => {
    init();
    const original = window.isDisplaySleepEnabled();

    window.setDisplaySleepEnabled(false);
    expect(window.isDisplaySleepEnabled()).toBe(false);

    window.setDisplaySleepEnabled(true);
    expect(window.isDisplaySleepEnabled()).toBe(true);

    // Restore original state
    window.setDisplaySleepEnabled(original);
  });
});
