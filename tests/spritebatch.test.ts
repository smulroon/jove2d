import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import sdl from "../src/sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../src/sdl/types.ts";
import * as window from "../src/jove/window.ts";
import * as graphics from "../src/jove/graphics.ts";
import type { SpriteBatch } from "../src/jove/graphics.ts";

describe("jove.graphics — SpriteBatch", () => {
  let img: ReturnType<typeof graphics.newCanvas>;

  beforeAll(() => {
    sdl.SDL_Init(SDL_INIT_VIDEO);
    window.setMode(640, 480);
    graphics._createRenderer();
    // Use a canvas as a texture source (always available)
    img = graphics.newCanvas(64, 64);
  });

  afterAll(() => {
    if (img) img.release();
    graphics._destroyRenderer();
    window.close();
    sdl.SDL_Quit();
  });

  // --- Creation ---

  test("newSpriteBatch creates a batch with default capacity", () => {
    const batch = graphics.newSpriteBatch(img!);
    expect(batch).not.toBeNull();
    expect(batch!.getBufferSize()).toBe(1000);
    expect(batch!.getCount()).toBe(0);
    expect(batch!._isSpriteBatch).toBe(true);
  });

  test("newSpriteBatch with custom capacity", () => {
    const batch = graphics.newSpriteBatch(img!, 50);
    expect(batch).not.toBeNull();
    expect(batch!.getBufferSize()).toBe(50);
  });

  test("newSpriteBatch returns null without renderer", () => {
    graphics._destroyRenderer();
    const batch = graphics.newSpriteBatch(img!);
    expect(batch).toBeNull();
    graphics._createRenderer();
  });

  test("getTexture returns the source image", () => {
    const batch = graphics.newSpriteBatch(img!);
    expect(batch!.getTexture()).toBe(img);
  });

  // --- add() ---

  test("add() returns sequential 1-based IDs", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    expect(batch!.add(0, 0)).toBe(1);
    expect(batch!.add(10, 10)).toBe(2);
    expect(batch!.add(20, 20)).toBe(3);
    expect(batch!.getCount()).toBe(3);
  });

  test("add() with quad", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    const quad = graphics.newQuad(0, 0, 32, 32, 64, 64);
    const id = batch!.add(quad, 100, 200);
    expect(id).toBe(1);
    expect(batch!.getCount()).toBe(1);
  });

  test("add() with full transform params", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    const id = batch!.add(100, 200, Math.PI / 4, 2, 2, 32, 32);
    expect(id).toBe(1);
    expect(batch!.getCount()).toBe(1);
  });

  test("add() auto-grows buffer when full", () => {
    const batch = graphics.newSpriteBatch(img!, 2);
    expect(batch!.getBufferSize()).toBe(2);
    batch!.add(0, 0);
    batch!.add(10, 10);
    // This should trigger a grow
    batch!.add(20, 20);
    expect(batch!.getCount()).toBe(3);
    expect(batch!.getBufferSize()).toBe(4); // doubled
  });

  // --- set() ---

  test("set() updates an existing sprite", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    batch!.add(0, 0);
    batch!.add(10, 10);
    // Update sprite 1 to new position — should not throw
    batch!.set(1, 50, 50);
    expect(batch!.getCount()).toBe(2); // count unchanged
  });

  test("set() with quad updates sprite", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    batch!.add(0, 0);
    const quad = graphics.newQuad(0, 0, 32, 32, 64, 64);
    batch!.set(1, quad, 100, 200);
    expect(batch!.getCount()).toBe(1);
  });

  test("set() with out-of-range id is no-op", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    batch!.add(0, 0);
    // ID 5 doesn't exist, should silently no-op
    batch!.set(5, 100, 100);
    expect(batch!.getCount()).toBe(1);
  });

  test("set() with id 0 is no-op (1-based)", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    batch!.add(0, 0);
    batch!.set(0, 100, 100);
    expect(batch!.getCount()).toBe(1);
  });

  // --- clear() ---

  test("clear() resets count to 0", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    batch!.add(0, 0);
    batch!.add(10, 10);
    expect(batch!.getCount()).toBe(2);
    batch!.clear();
    expect(batch!.getCount()).toBe(0);
  });

  // --- flush() ---

  test("flush() is callable (no-op)", () => {
    const batch = graphics.newSpriteBatch(img!);
    batch!.flush(); // Should not throw
  });

  // --- setColor / getColor ---

  test("getColor returns null by default", () => {
    const batch = graphics.newSpriteBatch(img!);
    expect(batch!.getColor()).toBeNull();
  });

  test("setColor/getColor round-trip", () => {
    const batch = graphics.newSpriteBatch(img!);
    batch!.setColor(255, 128, 64, 200);
    expect(batch!.getColor()).toEqual([255, 128, 64, 200]);
  });

  test("setColor() with no args clears color", () => {
    const batch = graphics.newSpriteBatch(img!);
    batch!.setColor(255, 0, 0);
    expect(batch!.getColor()).not.toBeNull();
    batch!.setColor();
    expect(batch!.getColor()).toBeNull();
  });

  // --- setTexture ---

  test("setTexture changes the texture", () => {
    const batch = graphics.newSpriteBatch(img!);
    const img2 = graphics.newCanvas(32, 32);
    batch!.setTexture(img2!);
    expect(batch!.getTexture()).toBe(img2);
    img2!.release();
  });

  // --- setBufferSize ---

  test("setBufferSize grows buffer", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    batch!.setBufferSize(100);
    expect(batch!.getBufferSize()).toBe(100);
  });

  test("setBufferSize shrinks buffer and clamps count", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    batch!.add(0, 0);
    batch!.add(10, 10);
    batch!.add(20, 20);
    expect(batch!.getCount()).toBe(3);
    batch!.setBufferSize(2);
    expect(batch!.getBufferSize()).toBe(2);
    expect(batch!.getCount()).toBe(2);
  });

  // --- draw() integration ---

  test("draw() with empty batch is no-op", () => {
    const batch = graphics.newSpriteBatch(img!);
    expect(() => graphics.draw(batch!, 0, 0)).not.toThrow();
  });

  test("draw() with populated batch does not throw", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    batch!.add(0, 0);
    batch!.add(32, 0);
    batch!.add(64, 0);
    expect(() => graphics.draw(batch!)).not.toThrow();
  });

  test("draw() with batch transform does not throw", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    batch!.add(0, 0);
    expect(() => graphics.draw(batch!, 100, 200, Math.PI / 4, 2, 2, 32, 32)).not.toThrow();
  });

  test("draw() with global transform does not throw", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    batch!.add(0, 0);
    graphics.push();
    graphics.translate(100, 100);
    graphics.rotate(0.5);
    expect(() => graphics.draw(batch!)).not.toThrow();
    graphics.pop();
  });

  test("draw() with batch color applies per-sprite tint", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    batch!.setColor(255, 0, 0);
    batch!.add(0, 0);
    batch!.setColor(0, 255, 0);
    batch!.add(32, 0);
    expect(() => graphics.draw(batch!)).not.toThrow();
  });

  test("draw() with quad sprites does not throw", () => {
    const batch = graphics.newSpriteBatch(img!, 10);
    const q1 = graphics.newQuad(0, 0, 32, 32, 64, 64);
    const q2 = graphics.newQuad(32, 0, 32, 32, 64, 64);
    batch!.add(q1, 0, 0);
    batch!.add(q2, 32, 0);
    expect(() => graphics.draw(batch!)).not.toThrow();
  });
});
