import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import sdl from "../src/sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../src/sdl/types.ts";
import * as window from "../src/jove/window.ts";
import * as graphics from "../src/jove/graphics.ts";

describe("jove.graphics — new primitives & features", () => {
  beforeAll(() => {
    sdl.SDL_Init(SDL_INIT_VIDEO);
    window.setMode(640, 480);
    graphics._createRenderer();
  });

  afterAll(() => {
    graphics._destroyRenderer();
    window.close();
    sdl.SDL_Quit();
  });

  // --- Ellipse ---

  test("ellipse fill draws without error", () => {
    graphics.ellipse("fill", 100, 100, 50, 30);
  });

  test("ellipse line draws without error", () => {
    graphics.ellipse("line", 100, 100, 50, 30);
  });

  // --- Arc ---

  test("arc fill draws without error", () => {
    graphics.arc("fill", 200, 200, 50, 0, Math.PI);
  });

  test("arc line draws without error", () => {
    graphics.arc("line", 200, 200, 50, 0, Math.PI / 2);
  });

  // --- Polygon ---

  test("polygon fill draws without error", () => {
    graphics.polygon("fill", 100, 100, 150, 50, 200, 100, 150, 150);
  });

  test("polygon line draws without error", () => {
    graphics.polygon("line", 100, 100, 150, 50, 200, 100, 150, 150);
  });

  test("polygon with too few points is no-op", () => {
    graphics.polygon("fill", 100, 100, 150, 50); // Only 2 points
  });

  // --- Points ---

  test("points draws multiple points", () => {
    graphics.points(10, 10, 20, 20, 30, 30);
  });

  // --- Blend modes ---

  test("setBlendMode/getBlendMode round-trip", () => {
    graphics.setBlendMode("add");
    expect(graphics.getBlendMode()).toBe("add");
    graphics.setBlendMode("alpha");
    expect(graphics.getBlendMode()).toBe("alpha");
    graphics.setBlendMode("multiply");
    expect(graphics.getBlendMode()).toBe("multiply");
    graphics.setBlendMode("replace");
    expect(graphics.getBlendMode()).toBe("replace");
  });

  // --- Scissor ---

  test("setScissor/getScissor round-trip", () => {
    graphics.setScissor(10, 20, 100, 200);
    const s = graphics.getScissor();
    expect(s).toEqual([10, 20, 100, 200]);

    graphics.setScissor(); // Disable
    expect(graphics.getScissor()).toBeNull();
  });

  // --- Line width ---

  test("setLineWidth/getLineWidth round-trip", () => {
    graphics.setLineWidth(3);
    expect(graphics.getLineWidth()).toBe(3);
    graphics.setLineWidth(1); // Reset
  });

  // --- Point size ---

  test("setPointSize/getPointSize round-trip", () => {
    graphics.setPointSize(5);
    expect(graphics.getPointSize()).toBe(5);
    graphics.setPointSize(1); // Reset
  });

  // --- Wrap mode ---

  test("image setWrap/getWrap defaults to clamp", () => {
    const canvas = graphics.newCanvas(64, 64);
    expect(canvas).not.toBeNull();
    expect(canvas!.getWrap()).toEqual(["clamp", "clamp"]);
    canvas!.release();
  });

  test("image setWrap/getWrap round-trip", () => {
    const canvas = graphics.newCanvas(64, 64);
    expect(canvas).not.toBeNull();

    canvas!.setWrap("repeat");
    expect(canvas!.getWrap()).toEqual(["repeat", "repeat"]);

    canvas!.setWrap("clamp", "repeat");
    expect(canvas!.getWrap()).toEqual(["clamp", "repeat"]);

    canvas!.setWrap("mirroredrepeat", "clampzero");
    expect(canvas!.getWrap()).toEqual(["mirroredrepeat", "clampzero"]);

    canvas!.setWrap("clamp");
    expect(canvas!.getWrap()).toEqual(["clamp", "clamp"]);
    canvas!.release();
  });

  // --- replacePixels ---

  test("replacePixels updates texture without error", () => {
    const canvas = graphics.newCanvas(64, 64);
    expect(canvas).not.toBeNull();

    // Create a simple ImageData-like object
    const data = new Uint8Array(64 * 64 * 4);
    data.fill(255); // all white
    canvas!.replacePixels({ data, width: 64, height: 64 });
    canvas!.release();
  });

  test("replacePixels with sub-region", () => {
    const canvas = graphics.newCanvas(64, 64);
    expect(canvas).not.toBeNull();

    // Update a 16x16 region at offset (8, 8)
    const data = new Uint8Array(16 * 16 * 4);
    data.fill(128);
    canvas!.replacePixels({ data, width: 16, height: 16 }, 8, 8);
    canvas!.release();
  });

  // --- Clear with color ---

  test("clear with color args doesn't throw", () => {
    graphics.clear(128, 0, 0, 255);
    graphics.clear(); // Also test no-arg clear
  });

  // --- Canvas ---

  test("newCanvas creates a canvas", () => {
    const canvas = graphics.newCanvas(256, 256);
    expect(canvas).not.toBeNull();
    expect(canvas!.getWidth()).toBe(256);
    expect(canvas!.getHeight()).toBe(256);
    expect(canvas!._isCanvas).toBe(true);
    canvas!.release();
  });

  test("setCanvas/getCanvas round-trip", () => {
    const canvas = graphics.newCanvas(128, 128);
    expect(canvas).not.toBeNull();

    graphics.setCanvas(canvas);
    expect(graphics.getCanvas()).toBe(canvas);

    // Draw to canvas
    graphics.setColor(255, 0, 0);
    graphics.rectangle("fill", 0, 0, 128, 128);

    graphics.setCanvas(null);
    expect(graphics.getCanvas()).toBeNull();

    graphics.setColor(255, 255, 255); // Reset
    canvas!.release();
  });

  test("canvas renderTo sets and restores canvas", () => {
    const canvas = graphics.newCanvas(64, 64);
    expect(canvas).not.toBeNull();

    // No active canvas initially
    expect(graphics.getCanvas()).toBeNull();

    let insideCalled = false;
    canvas!.renderTo(() => {
      // Inside renderTo, this canvas should be active
      expect(graphics.getCanvas()).toBe(canvas);
      insideCalled = true;
    });

    // After renderTo, canvas should be restored to null
    expect(insideCalled).toBe(true);
    expect(graphics.getCanvas()).toBeNull();

    canvas!.release();
  });

  test("canvas renderTo restores previous canvas", () => {
    const canvas1 = graphics.newCanvas(64, 64)!;
    const canvas2 = graphics.newCanvas(32, 32)!;

    graphics.setCanvas(canvas1);
    expect(graphics.getCanvas()).toBe(canvas1);

    canvas2.renderTo(() => {
      expect(graphics.getCanvas()).toBe(canvas2);
    });

    // Should restore canvas1, not null
    expect(graphics.getCanvas()).toBe(canvas1);

    graphics.setCanvas(null);
    canvas1.release();
    canvas2.release();
  });

  // --- Quad ---

  test("newQuad creates a quad", () => {
    const quad = graphics.newQuad(0, 0, 32, 32, 128, 128);
    expect(quad.getViewport()).toEqual([0, 0, 32, 32]);
    expect(quad._sw).toBe(128);
    expect(quad._sh).toBe(128);
  });

  test("quad setViewport updates viewport", () => {
    const quad = graphics.newQuad(0, 0, 32, 32, 128, 128);
    quad.setViewport(16, 16, 48, 48);
    expect(quad.getViewport()).toEqual([16, 16, 48, 48]);
  });

  // --- Safe with no renderer ---

  test("drawing functions safe with no renderer", () => {
    const renderer = graphics._getRenderer();
    graphics._destroyRenderer();

    // These should all be no-ops, not throw
    graphics.ellipse("fill", 100, 100, 50, 30);
    graphics.arc("fill", 100, 100, 50, 0, Math.PI);
    graphics.polygon("fill", 100, 100, 150, 50, 200, 100);
    graphics.points(10, 10, 20, 20);
    graphics.setScissor(0, 0, 100, 100);
    expect(graphics.newCanvas(100, 100)).toBeNull();
    expect(graphics.newImage("nonexistent.bmp")).toBeNull();

    // Restore renderer
    graphics._createRenderer();
  });
});
