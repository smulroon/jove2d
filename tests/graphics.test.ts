import { describe, test, expect, afterEach } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { init, quit, window, graphics } from "../src/jove/index.ts";
import { _flushCaptures, _createRenderer, _destroyRenderer } from "../src/jove/graphics.ts";
import type { ImageData } from "../src/jove/types.ts";

const TMP_PNG = "/tmp/jove2d-test-screenshot.png";
const TMP_BMP = "/tmp/jove2d-test-screenshot.bmp";

function cleanup(...paths: string[]) {
  for (const p of paths) {
    if (existsSync(p)) unlinkSync(p);
  }
}

function setupWindowAndRenderer() {
  init();
  window.setMode(320, 240);
  _createRenderer();
}

describe("jove.graphics.captureScreenshot", () => {
  afterEach(() => {
    cleanup(TMP_PNG, TMP_BMP);
    quit();
  });

  test("saves PNG file", () => {
    setupWindowAndRenderer();
    cleanup(TMP_PNG);

    graphics.captureScreenshot(TMP_PNG);
    _flushCaptures();

    expect(existsSync(TMP_PNG)).toBe(true);
  });

  test("saves BMP file", () => {
    setupWindowAndRenderer();
    cleanup(TMP_BMP);

    graphics.captureScreenshot(TMP_BMP);
    _flushCaptures();

    expect(existsSync(TMP_BMP)).toBe(true);
  });

  test("callback receives valid ImageData", () => {
    setupWindowAndRenderer();

    let received: ImageData | null = null;
    graphics.captureScreenshot((img) => {
      received = img;
    });
    _flushCaptures();

    expect(received).not.toBeNull();
    expect(received!.width).toBe(320);
    expect(received!.height).toBe(240);
    expect(received!.data.length).toBeGreaterThan(0);
    expect(typeof received!.format).toBe("string");
  });

  test("multiple captures execute in order", () => {
    setupWindowAndRenderer();

    const results: number[] = [];
    graphics.captureScreenshot(() => results.push(1));
    graphics.captureScreenshot(() => results.push(2));
    _flushCaptures();

    expect(results).toEqual([1, 2]);
  });

  test("no window does not throw", () => {
    init();
    // No window/renderer created
    graphics.captureScreenshot("/tmp/jove2d-should-not-exist.png");
    expect(() => _flushCaptures()).not.toThrow();
    expect(existsSync("/tmp/jove2d-should-not-exist.png")).toBe(false);
  });

  test("file capture defaults to PNG for unknown extension", () => {
    setupWindowAndRenderer();
    const path = "/tmp/jove2d-test-screenshot.xyz";
    cleanup(path);

    graphics.captureScreenshot(path);
    _flushCaptures();

    // SDL_SavePNG saves to whatever path given, so file should exist
    expect(existsSync(path)).toBe(true);
    cleanup(path);
  });
});
