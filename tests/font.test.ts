import { describe, test, expect, afterEach, beforeEach } from "bun:test";
import { init, quit, window, graphics } from "../src/jove/index.ts";
import { _createRenderer, _destroyRenderer, newFont, setFont, getFont, newText, draw, setColor } from "../src/jove/graphics.ts";
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

  // ============================================================
  // newText tests
  // ============================================================

  test("newText creates a text object", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const text = newText(font, "Hello");
    expect(text).not.toBeNull();
    expect(text!._isText).toBe(true);
    text!.release();
  });

  test("newText with no initial text", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const text = newText(font)!;
    expect(text).not.toBeNull();
    expect(text.getWidth()).toBe(0);
    expect(text.getHeight()).toBe(0);
    text.release();
  });

  test("set() replaces text", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const text = newText(font, "Hello")!;
    const w1 = text.getWidth();
    text.set("Hello World");
    const w2 = text.getWidth();
    expect(w2).toBeGreaterThan(w1);
    text.release();
  });

  test("setf() sets wrapped text", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const text = newText(font)!;
    text.setf("The quick brown fox jumps over the lazy dog", 100, "center");
    expect(text.getWidth()).toBeGreaterThan(0);
    expect(text.getHeight()).toBeGreaterThan(0);
    text.release();
  });

  test("add() appends segments", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const text = newText(font, "Line 1")!;
    const h1 = text.getHeight();
    const idx = text.add("Line 2", 0, h1);
    expect(idx).toBe(2);
    expect(text.getHeight()).toBeGreaterThan(h1);
    text.release();
  });

  test("addf() appends wrapped segments", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const text = newText(font)!;
    const idx = text.addf("Wrapped text here", 80, "right", 0, 0);
    expect(idx).toBe(1);
    expect(text.getWidth()).toBeGreaterThan(0);
    text.release();
  });

  test("clear() removes all segments", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const text = newText(font, "Hello")!;
    expect(text.getWidth()).toBeGreaterThan(0);
    text.clear();
    expect(text.getWidth()).toBe(0);
    expect(text.getHeight()).toBe(0);
    text.release();
  });

  test("getDimensions() returns [width, height]", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const text = newText(font, "Test")!;
    const [w, h] = text.getDimensions();
    expect(w).toBe(text.getWidth());
    expect(h).toBe(text.getHeight());
    text.release();
  });

  test("getFont() / setFont() round-trip", () => {
    setupWindowAndRenderer();
    const font1 = getFont()!;
    const font2 = newFont(24)!;
    const text = newText(font1, "Test")!;
    expect(text.getFont()).toBe(font1);
    const w1 = text.getWidth();
    text.setFont(font2);
    expect(text.getFont()).toBe(font2);
    // Larger font → wider text
    expect(text.getWidth()).toBeGreaterThan(w1);
    text.release();
    font2.release();
  });

  test("release() does not crash", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const text = newText(font, "Hello")!;
    text.getWidth(); // force flush
    expect(() => text.release()).not.toThrow();
  });

  test("draw() with Text does not throw", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const text = newText(font, "Hello draw")!;
    expect(() => draw(text, 10, 20)).not.toThrow();
    expect(() => draw(text, 50, 50, Math.PI / 4, 2, 2)).not.toThrow();
    text.release();
  });

  test("draw() with empty Text does not throw", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const text = newText(font)!;
    expect(() => draw(text, 0, 0)).not.toThrow();
    text.release();
  });

  test("set() with colored segments captures current color", () => {
    setupWindowAndRenderer();
    const font = getFont()!;
    const text = newText(font)!;
    setColor(255, 0, 0);
    text.set("Red text");
    setColor(0, 255, 0);
    text.add("Green text", 0, 20);
    // Should not throw — colors are captured at add time
    expect(() => draw(text, 10, 10)).not.toThrow();
    text.release();
    setColor(255, 255, 255); // restore
  });
});
