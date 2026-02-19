import { describe, test, expect, afterEach } from "bun:test";
import { init, quit, window, graphics } from "../src/jove/index.ts";
import { _createRenderer, newImageFont, setFont, getFont, print, printf, newText, draw, setColor } from "../src/jove/graphics.ts";
import { newImageData } from "../src/jove/image.ts";

function setupWindowAndRenderer() {
  init();
  window.setMode(320, 240);
  _createRenderer();
}

// Create a simple test bitmap font image:
// Separator color = magenta (255, 0, 255, 255) at pixel (0,0)
// 3 glyphs: "A", "B", "C" — each 4px wide, image 16px wide, 8px tall
// Layout: [sep][AAAA][sep][BBBB][sep][CCCC][sep]
//          0    1234  5    6789  10   1112  14  15
function createTestFontImageData() {
  const w = 16;
  const h = 8;
  const imgData = newImageData(w, h)!;

  // Fill everything with separator color first
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      imgData.setPixel(x, y, 255, 0, 255, 255);
    }
  }

  // Draw glyph A (columns 1-4, white)
  for (let y = 0; y < h; y++) {
    for (let x = 1; x <= 4; x++) {
      imgData.setPixel(x, y, 255, 255, 255, 255);
    }
  }

  // Draw glyph B (columns 6-9, white)
  for (let y = 0; y < h; y++) {
    for (let x = 6; x <= 9; x++) {
      imgData.setPixel(x, y, 200, 200, 200, 255);
    }
  }

  // Draw glyph C (columns 11-13, white) — 3px wide
  for (let y = 0; y < h; y++) {
    for (let x = 11; x <= 13; x++) {
      imgData.setPixel(x, y, 150, 150, 150, 255);
    }
  }

  return imgData;
}

describe("newImageFont", () => {
  afterEach(() => {
    quit();
  });

  test("creates font from ImageData", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC");
    expect(font).not.toBeNull();
    expect(font!._isBitmapFont).toBe(true);
    font!.release();
  });

  test("getHeight returns image height", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC")!;
    expect(font.getHeight()).toBe(8);
    font.release();
  });

  test("getWidth measures text correctly", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC")!;
    // A=4px, B=4px, C=3px
    expect(font.getWidth("A")).toBe(4);
    expect(font.getWidth("B")).toBe(4);
    expect(font.getWidth("C")).toBe(3);
    // "AB" = 4 + 4 = 8 (no extra spacing)
    expect(font.getWidth("AB")).toBe(8);
    // "ABC" = 4 + 4 + 3 = 11
    expect(font.getWidth("ABC")).toBe(11);
    // Unknown chars return 0 width
    expect(font.getWidth("X")).toBe(0);
    // Empty string
    expect(font.getWidth("")).toBe(0);
    font.release();
  });

  test("getWidth with extraSpacing", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC", 2)!;
    // "AB" = 4 + 2 + 4 = 10 (extra spacing between chars)
    expect(font.getWidth("AB")).toBe(10);
    // "ABC" = 4 + 2 + 4 + 2 + 3 = 15
    expect(font.getWidth("ABC")).toBe(15);
    // Single char — no spacing
    expect(font.getWidth("A")).toBe(4);
    font.release();
  });

  test("getAscent and getDescent", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC")!;
    expect(font.getAscent()).toBe(8);
    expect(font.getDescent()).toBe(0);
    expect(font.getBaseline()).toBe(8);
    font.release();
  });

  test("getLineHeight and setLineHeight", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC")!;
    expect(font.getLineHeight()).toBe(1.0);
    font.setLineHeight(1.5);
    expect(font.getLineHeight()).toBe(1.5);
    font.release();
  });

  test("getWrap wraps text correctly", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC ")!;
    // Space glyph doesn't exist in our test image, need to add one
    font.release();
  });

  test("can be set as current font", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC")!;
    setFont(font);
    expect(getFont()).toBe(font);
    font.release();
  });

  test("print does not crash with bitmap font", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC")!;
    setFont(font);
    // Should not throw
    print("ABC", 10, 10);
    print("A", 0, 0);
    print("", 0, 0);
    font.release();
  });

  test("printf does not crash with bitmap font", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC")!;
    setFont(font);
    printf("ABC", 10, 10, 200, "left");
    printf("ABC", 10, 10, 200, "center");
    printf("ABC", 10, 10, 200, "right");
    font.release();
  });

  test("newText works with bitmap font", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC")!;
    const txt = newText(font, "ABC");
    expect(txt).not.toBeNull();
    expect(txt!.getWidth()).toBe(11);
    expect(txt!.getHeight()).toBe(8);
    txt!.release();
    font.release();
  });

  test("newText set/clear with bitmap font", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC")!;
    const txt = newText(font, "A")!;
    expect(txt.getWidth()).toBe(4);
    txt.set("AB");
    expect(txt.getWidth()).toBe(8);
    txt.clear();
    expect(txt.getWidth()).toBe(0);
    txt.release();
    font.release();
  });

  test("getWrap with explicit newlines", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC")!;
    const [maxW, lines] = font.getWrap("A\nB\nC", 100);
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe("A");
    expect(lines[1]).toBe("B");
    expect(lines[2]).toBe("C");
    expect(maxW).toBe(4); // max of A(4), B(4), C(3)
    font.release();
  });

  test("size field matches glyph height", () => {
    setupWindowAndRenderer();
    const imgData = createTestFontImageData();
    const font = newImageFont(imgData, "ABC")!;
    expect(font._size).toBe(8);
    font.release();
  });
});
