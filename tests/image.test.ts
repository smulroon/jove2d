import { describe, test, expect, afterAll, beforeAll } from "bun:test";
import sdl from "../src/sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../src/sdl/types.ts";
import * as window from "../src/jove/window.ts";
import * as graphics from "../src/jove/graphics.ts";
import { loadImage } from "../src/sdl/ffi_image.ts";
import { resolve } from "path";
import { existsSync } from "fs";

const imgAvailable = loadImage() !== null;
const testDir = resolve(import.meta.dir, "assets");
const hasPng = existsSync(resolve(testDir, "test.png"));
const hasJpg = existsSync(resolve(testDir, "test.jpg"));
const hasBmp = existsSync(resolve(testDir, "test.bmp"));

describe("jove.graphics — image loading", () => {
  beforeAll(() => {
    sdl.SDL_Init(SDL_INIT_VIDEO);
    window.setMode(320, 240);
    graphics._createRenderer();
  });

  afterAll(() => {
    graphics._destroyRenderer();
    window.close();
    sdl.SDL_Quit();
  });

  // --- BMP loading (always works, no SDL_image needed) ---

  test("newImage loads BMP", () => {
    if (!hasBmp) return;
    const img = graphics.newImage(resolve(testDir, "test.bmp"));
    expect(img).not.toBeNull();
    expect(img!.getWidth()).toBe(4);
    expect(img!.getHeight()).toBe(4);
    img!.release();
  });

  test("newImage returns null for nonexistent file", () => {
    const img = graphics.newImage("/nonexistent/image.png");
    expect(img).toBeNull();
  });

  // --- PNG loading (requires SDL_image) ---

  describe("SDL_image formats", () => {
    if (!imgAvailable) {
      test.skip("SDL_image not available", () => {});
      return;
    }

    test("newImage loads PNG", () => {
      if (!hasPng) return;
      const img = graphics.newImage(resolve(testDir, "test.png"));
      expect(img).not.toBeNull();
      expect(img!.getWidth()).toBe(4);
      expect(img!.getHeight()).toBe(4);
      img!.release();
    });

    test("newImage loads JPG", () => {
      if (!hasJpg) return;
      const img = graphics.newImage(resolve(testDir, "test.jpg"));
      expect(img).not.toBeNull();
      expect(img!.getWidth()).toBe(4);
      expect(img!.getHeight()).toBe(4);
      img!.release();
    });

    test("PNG image has correct getDimensions", () => {
      if (!hasPng) return;
      const img = graphics.newImage(resolve(testDir, "test.png"));
      expect(img).not.toBeNull();
      const [w, h] = img!.getDimensions();
      expect(w).toBe(4);
      expect(h).toBe(4);
      img!.release();
    });

    test("draw loaded PNG does not throw", () => {
      if (!hasPng) return;
      const img = graphics.newImage(resolve(testDir, "test.png"));
      expect(img).not.toBeNull();
      expect(() => graphics.draw(img!, 0, 0)).not.toThrow();
      img!.release();
    });

    test("Image filter can be set", () => {
      if (!hasPng) return;
      const img = graphics.newImage(resolve(testDir, "test.png"));
      expect(img).not.toBeNull();
      img!.setFilter("linear", "linear");
      expect(img!.getFilter()).toEqual(["linear", "linear"]);
      img!.setFilter("nearest", "nearest");
      expect(img!.getFilter()).toEqual(["nearest", "nearest"]);
      img!.release();
    });
  });
});
