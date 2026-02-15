import { describe, test, expect, afterEach, beforeEach } from "bun:test";
import { init, quit, window, graphics } from "../src/jove/index.ts";
import { _createRenderer, _destroyRenderer, newFont, setFont, getFont } from "../src/jove/graphics.ts";
import { loadTTF } from "../src/sdl/ffi_ttf.ts";

const ttfAvailable = loadTTF() !== null;

function setupWindowAndRenderer() {
  init();
  window.setMode(320, 240);
  _createRenderer();
}

describe("jove.graphics font (TTF)", () => {
  if (!ttfAvailable) {
    test.skip("SDL_ttf not available", () => {});
    return;
  }

  afterEach(() => {
    quit();
  });

  test("default font is loaded", () => {
    setupWindowAndRenderer();
    const font = getFont();
    expect(font).not.toBeNull();
    expect(font!.getHeight()).toBeGreaterThan(0);
  });

  test("newFont with default size", () => {
    setupWindowAndRenderer();
    const font = newFont();
    expect(font).not.toBeNull();
    expect(font!.getHeight()).toBeGreaterThan(0);
    font!.release();
  });

  test("newFont with custom size", () => {
    setupWindowAndRenderer();
    const font12 = newFont(12);
    const font24 = newFont(24);
    expect(font12).not.toBeNull();
    expect(font24).not.toBeNull();
    expect(font24!.getHeight()).toBeGreaterThan(font12!.getHeight());
    font12!.release();
    font24!.release();
  });

  test("newFont with file path", () => {
    setupWindowAndRenderer();
    const font = newFont("assets/Vera.ttf", 16);
    expect(font).not.toBeNull();
    expect(font!.getHeight()).toBeGreaterThan(0);
    font!.release();
  });

  test("newFont with invalid path returns null", () => {
    setupWindowAndRenderer();
    const font = newFont("/nonexistent/font.ttf", 12);
    expect(font).toBeNull();
  });

  test("getWidth returns positive for non-empty text", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    expect(font.getWidth("Hello")).toBeGreaterThan(0);
    expect(font.getWidth("")).toBe(0);
  });

  test("getHeight returns consistent value", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const h1 = font.getHeight();
    const h2 = font.getHeight();
    expect(h1).toBe(h2);
    expect(h1).toBeGreaterThan(0);
  });

  test("getAscent and getDescent", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    expect(font.getAscent()).toBeGreaterThan(0);
    // descent is typically negative or zero
    expect(typeof font.getDescent()).toBe("number");
  });

  test("getBaseline equals getAscent", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    expect(font.getBaseline()).toBe(font.getAscent());
  });

  test("lineHeight round-trip", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    expect(font.getLineHeight()).toBe(1.0);
    font.setLineHeight(1.5);
    expect(font.getLineHeight()).toBe(1.5);
    font.setLineHeight(1.0); // restore
  });

  test("getWrap returns split lines", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const [maxWidth, lines] = font.getWrap("Hello World this is a long test", 50);
    expect(lines.length).toBeGreaterThan(1);
    expect(maxWidth).toBeGreaterThan(0);
    expect(maxWidth).toBeLessThanOrEqual(50);
  });

  test("setFont/getFont round-trip", () => {
    setupWindowAndRenderer();
    const original = getFont()!;
    const custom = newFont(24)!;
    setFont(custom);
    expect(getFont()).toBe(custom);
    setFont(original);
    expect(getFont()).toBe(original);
    custom.release();
  });

  test("print does not throw", () => {
    setupWindowAndRenderer();
    expect(() => graphics.print("Hello TTF!", 10, 10)).not.toThrow();
  });

  test("printf does not throw", () => {
    setupWindowAndRenderer();
    expect(() => graphics.printf("Hello wrapped text", 10, 10, 100, "center")).not.toThrow();
  });

  test("print with newlines does not throw", () => {
    setupWindowAndRenderer();
    expect(() => graphics.print("Line 1\nLine 2\nLine 3", 10, 10)).not.toThrow();
  });
});
