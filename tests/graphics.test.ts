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

describe("jove.graphics.defaultFilter", () => {
  afterEach(() => { quit(); });

  test("round-trip get/set", () => {
    setupWindowAndRenderer();
    expect(graphics.getDefaultFilter()).toEqual(["nearest", "nearest"]);

    graphics.setDefaultFilter("linear", "linear");
    expect(graphics.getDefaultFilter()).toEqual(["linear", "linear"]);

    graphics.setDefaultFilter("nearest");
    expect(graphics.getDefaultFilter()).toEqual(["nearest", "nearest"]);
  });

  test("mag defaults to min when omitted", () => {
    setupWindowAndRenderer();
    graphics.setDefaultFilter("linear");
    expect(graphics.getDefaultFilter()).toEqual(["linear", "linear"]);
  });

  test("newImage respects default filter", () => {
    setupWindowAndRenderer();
    graphics.setDefaultFilter("linear", "linear");
    // Create a 1x1 BMP in memory for testing
    const img = graphics.newCanvas(8, 8);
    expect(img).not.toBeNull();
    expect(img!.getFilter()).toEqual(["linear", "linear"]);
  });
});

describe("jove.graphics.colorMask", () => {
  afterEach(() => { quit(); });

  test("default is all true", () => {
    setupWindowAndRenderer();
    expect(graphics.getColorMask()).toEqual([true, true, true, true]);
  });

  test("round-trip set/get", () => {
    setupWindowAndRenderer();
    graphics.setColorMask(true, false, true, false);
    expect(graphics.getColorMask()).toEqual([true, false, true, false]);
  });

  test("no-arg reset to all true", () => {
    setupWindowAndRenderer();
    graphics.setColorMask(false, false, false, false);
    graphics.setColorMask();
    expect(graphics.getColorMask()).toEqual([true, true, true, true]);
  });
});

describe("jove.graphics.transformPoint", () => {
  afterEach(() => { quit(); });

  test("identity transform returns same point", () => {
    setupWindowAndRenderer();
    expect(graphics.transformPoint(10, 20)).toEqual([10, 20]);
  });

  test("after translate", () => {
    setupWindowAndRenderer();
    graphics.translate(100, 50);
    const [x, y] = graphics.transformPoint(10, 20);
    expect(x).toBeCloseTo(110);
    expect(y).toBeCloseTo(70);
  });
});

describe("jove.graphics.inverseTransformPoint", () => {
  afterEach(() => { quit(); });

  test("identity transform returns same point", () => {
    setupWindowAndRenderer();
    expect(graphics.inverseTransformPoint(10, 20)).toEqual([10, 20]);
  });

  test("round-trip with translate", () => {
    setupWindowAndRenderer();
    graphics.translate(100, 50);
    const [sx, sy] = graphics.transformPoint(10, 20);
    const [rx, ry] = graphics.inverseTransformPoint(sx, sy);
    expect(rx).toBeCloseTo(10);
    expect(ry).toBeCloseTo(20);
  });

  test("round-trip with scale and rotate", () => {
    setupWindowAndRenderer();
    graphics.translate(50, 30);
    graphics.scale(2);
    graphics.rotate(Math.PI / 4);
    const [sx, sy] = graphics.transformPoint(10, 20);
    const [rx, ry] = graphics.inverseTransformPoint(sx, sy);
    expect(rx).toBeCloseTo(10);
    expect(ry).toBeCloseTo(20);
  });
});

describe("jove.graphics.intersectScissor", () => {
  afterEach(() => { quit(); });

  test("sets scissor when none exists", () => {
    setupWindowAndRenderer();
    graphics.intersectScissor(10, 20, 100, 50);
    expect(graphics.getScissor()).toEqual([10, 20, 100, 50]);
  });

  test("intersects with existing scissor", () => {
    setupWindowAndRenderer();
    graphics.setScissor(10, 10, 100, 100);
    graphics.intersectScissor(50, 50, 100, 100);
    expect(graphics.getScissor()).toEqual([50, 50, 60, 60]);
  });

  test("non-overlapping results in zero-size scissor", () => {
    setupWindowAndRenderer();
    graphics.setScissor(0, 0, 50, 50);
    graphics.intersectScissor(100, 100, 50, 50);
    const s = graphics.getScissor()!;
    expect(s[2]).toBe(0);
    expect(s[3]).toBe(0);
  });
});

describe("jove.graphics.getStackDepth", () => {
  afterEach(() => { quit(); });

  test("starts at 0", () => {
    setupWindowAndRenderer();
    expect(graphics.getStackDepth()).toBe(0);
  });

  test("increments on push, decrements on pop", () => {
    setupWindowAndRenderer();
    graphics.push();
    expect(graphics.getStackDepth()).toBe(1);
    graphics.push();
    expect(graphics.getStackDepth()).toBe(2);
    graphics.pop();
    expect(graphics.getStackDepth()).toBe(1);
    graphics.pop();
    expect(graphics.getStackDepth()).toBe(0);
  });
});

describe("jove.graphics.reset", () => {
  afterEach(() => { quit(); });

  test("restores all defaults", () => {
    setupWindowAndRenderer();

    // Change everything
    graphics.setBackgroundColor(100, 100, 100, 100);
    graphics.setColor(50, 50, 50, 50);
    graphics.setBlendMode("add");
    graphics.setLineWidth(5);
    graphics.setPointSize(3);
    graphics.setScissor(10, 10, 100, 100);
    graphics.translate(50, 50);
    graphics.push();
    graphics.setDefaultFilter("linear", "linear");
    graphics.setColorMask(false, false, false, false);
    graphics.setLineStyle("smooth");

    graphics.reset();

    expect(graphics.getBackgroundColor()).toEqual([0, 0, 0, 255]);
    expect(graphics.getColor()).toEqual([255, 255, 255, 255]);
    expect(graphics.getBlendMode()).toBe("alpha");
    expect(graphics.getLineWidth()).toBe(1);
    expect(graphics.getPointSize()).toBe(1);
    expect(graphics.getScissor()).toBeNull();
    expect(graphics.getStackDepth()).toBe(0);
    expect(graphics.getCanvas()).toBeNull();
    expect(graphics.getDefaultFilter()).toEqual(["nearest", "nearest"]);
    expect(graphics.getColorMask()).toEqual([true, true, true, true]);
    expect(graphics.getLineStyle()).toBe("rough");
  });
});

describe("jove.graphics.lineStyle", () => {
  afterEach(() => { quit(); });

  test("default is rough", () => {
    setupWindowAndRenderer();
    expect(graphics.getLineStyle()).toBe("rough");
  });

  test("round-trip set/get", () => {
    setupWindowAndRenderer();
    graphics.setLineStyle("smooth");
    expect(graphics.getLineStyle()).toBe("smooth");
    graphics.setLineStyle("rough");
    expect(graphics.getLineStyle()).toBe("rough");
  });

  test("reset restores rough", () => {
    setupWindowAndRenderer();
    graphics.setLineStyle("smooth");
    graphics.reset();
    expect(graphics.getLineStyle()).toBe("rough");
  });
});
