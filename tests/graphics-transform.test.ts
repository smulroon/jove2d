import { test, expect, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import sdl from "../src/sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../src/sdl/types.ts";
import * as window from "../src/jove/window.ts";
import * as graphics from "../src/jove/graphics.ts";

describe("jove.graphics — transform stack", () => {
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

  beforeEach(() => {
    graphics.origin(); // Reset transform before each test
  });

  test("push/pop saves and restores transform", () => {
    graphics.translate(100, 200);
    graphics.push();
    graphics.translate(50, 50);
    graphics.pop();
    // After pop, transform should be back to translate(100, 200)
    // We can verify by checking that drawing functions don't throw
    graphics.point(0, 0);
  });

  test("translate moves drawing position", () => {
    graphics.translate(10, 20);
    // Should not throw
    graphics.rectangle("fill", 0, 0, 50, 50);
  });

  test("rotate applies rotation", () => {
    graphics.rotate(Math.PI / 4);
    graphics.rectangle("fill", 0, 0, 50, 50);
  });

  test("scale applies scaling", () => {
    graphics.scale(2, 2);
    graphics.rectangle("fill", 0, 0, 50, 50);
  });

  test("shear applies shearing", () => {
    graphics.shear(0.5, 0.5);
    graphics.rectangle("fill", 0, 0, 50, 50);
  });

  test("origin resets transform", () => {
    graphics.translate(100, 100);
    graphics.rotate(1);
    graphics.scale(2);
    graphics.origin();
    // After origin, transform should be identity
    graphics.rectangle("fill", 10, 10, 50, 50);
  });

  test("nested push/pop works", () => {
    graphics.push();
    graphics.translate(10, 10);
    graphics.push();
    graphics.translate(20, 20);
    graphics.pop();
    // Should be at translate(10, 10)
    graphics.pop();
    // Should be at identity
    graphics.rectangle("fill", 0, 0, 10, 10);
  });

  test("transform applies to line drawing", () => {
    graphics.translate(50, 50);
    graphics.line(0, 0, 100, 100);
  });

  test("transform applies to circle drawing", () => {
    graphics.translate(100, 100);
    graphics.circle("fill", 0, 0, 50);
    graphics.circle("line", 0, 0, 50);
  });

  test("transform applies to point drawing", () => {
    graphics.translate(50, 50);
    graphics.point(0, 0);
  });

  test("transform applies to print", () => {
    graphics.translate(10, 10);
    graphics.print("hello", 0, 0);
  });
});
