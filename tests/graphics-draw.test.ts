import { describe, test, expect, afterEach } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { init, quit, window, graphics } from "../src/jove/index.ts";
import {
  _createRenderer,
  _flushCaptures,
  _getRenderer,
} from "../src/jove/graphics.ts";
import type { ImageData } from "../src/jove/types.ts";

function setupWindowAndRenderer() {
  init();
  window.setMode(320, 240);
  _createRenderer();
}

describe("jove.graphics renderer + drawing", () => {
  afterEach(() => {
    quit();
  });

  test("renderer is created when window opens", () => {
    setupWindowAndRenderer();
    expect(_getRenderer()).not.toBeNull();
  });

  test("setColor / getColor round-trip", () => {
    setupWindowAndRenderer();
    graphics.setColor(100, 150, 200, 128);
    expect(graphics.getColor()).toEqual([100, 150, 200, 128]);
  });

  test("setColor defaults alpha to 255", () => {
    setupWindowAndRenderer();
    graphics.setColor(10, 20, 30);
    expect(graphics.getColor()).toEqual([10, 20, 30, 255]);
  });

  test("setBackgroundColor / getBackgroundColor round-trip", () => {
    setupWindowAndRenderer();
    graphics.setBackgroundColor(40, 80, 120, 200);
    expect(graphics.getBackgroundColor()).toEqual([40, 80, 120, 200]);
  });

  test("rectangle fill does not throw", () => {
    setupWindowAndRenderer();
    expect(() => graphics.rectangle("fill", 10, 10, 100, 50)).not.toThrow();
  });

  test("rectangle line does not throw", () => {
    setupWindowAndRenderer();
    expect(() => graphics.rectangle("line", 10, 10, 100, 50)).not.toThrow();
  });

  test("line does not throw", () => {
    setupWindowAndRenderer();
    expect(() => graphics.line(0, 0, 100, 100)).not.toThrow();
  });

  test("line with multiple segments does not throw", () => {
    setupWindowAndRenderer();
    expect(() => graphics.line(0, 0, 50, 50, 100, 0)).not.toThrow();
  });

  test("circle fill does not throw", () => {
    setupWindowAndRenderer();
    expect(() => graphics.circle("fill", 160, 120, 50)).not.toThrow();
  });

  test("circle line does not throw", () => {
    setupWindowAndRenderer();
    expect(() => graphics.circle("line", 160, 120, 50)).not.toThrow();
  });

  test("point does not throw", () => {
    setupWindowAndRenderer();
    expect(() => graphics.point(100, 100)).not.toThrow();
  });

  test("print does not throw", () => {
    setupWindowAndRenderer();
    expect(() => graphics.print("Hello", 10, 10)).not.toThrow();
  });

  test("getWidth / getHeight / getDimensions match window size", () => {
    setupWindowAndRenderer();
    expect(graphics.getWidth()).toBe(320);
    expect(graphics.getHeight()).toBe(240);
    expect(graphics.getDimensions()).toEqual([320, 240]);
  });

  test("captureScreenshot still works with renderer", () => {
    setupWindowAndRenderer();
    const path = "/tmp/jove2d-draw-test-screenshot.png";
    if (existsSync(path)) unlinkSync(path);

    graphics.captureScreenshot(path);
    _flushCaptures();

    expect(existsSync(path)).toBe(true);
    unlinkSync(path);
  });

  test("drawing functions safe to call with no renderer", () => {
    init();
    // No window or renderer
    expect(() => graphics.rectangle("fill", 0, 0, 10, 10)).not.toThrow();
    expect(() => graphics.line(0, 0, 10, 10)).not.toThrow();
    expect(() => graphics.circle("fill", 5, 5, 5)).not.toThrow();
    expect(() => graphics.circle("line", 5, 5, 5)).not.toThrow();
    expect(() => graphics.point(5, 5)).not.toThrow();
    expect(() => graphics.print("test", 0, 0)).not.toThrow();
    expect(() => graphics.clear()).not.toThrow();
  });
});
