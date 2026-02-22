import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { init, quit, window, graphics } from "../src/jove/index.ts";
import { _createRenderer, _destroyRenderer, _getEffectiveBlendModeSDL } from "../src/jove/graphics.ts";
import { SDL_BLENDMODE_BLEND, SDL_BLENDMODE_NONE, SDL_BLENDMODE_ADD } from "../src/sdl/types.ts";

function setup() {
  init();
  window.setMode(320, 240);
  _createRenderer();
}

describe("jove.graphics.colorMask", () => {
  afterEach(() => {
    quit();
  });

  test("getColorMask defaults to all true", () => {
    setup();
    expect(graphics.getColorMask()).toEqual([true, true, true, true]);
  });

  test("setColorMask/getColorMask round-trip", () => {
    setup();
    graphics.setColorMask(false, false, false, true);
    expect(graphics.getColorMask()).toEqual([false, false, false, true]);
  });

  test("setColorMask no args resets to all true", () => {
    setup();
    graphics.setColorMask(false, false, false, false);
    expect(graphics.getColorMask()).toEqual([false, false, false, false]);
    graphics.setColorMask();
    expect(graphics.getColorMask()).toEqual([true, true, true, true]);
  });

  test("all-true colorMask uses predefined blend mode", () => {
    setup();
    graphics.setColorMask(true, true, true, true);
    expect(_getEffectiveBlendModeSDL()).toBe(SDL_BLENDMODE_BLEND);
  });

  test("masking RGB produces custom blend mode (not predefined)", () => {
    setup();
    graphics.setColorMask(false, false, false, true);
    const mode = _getEffectiveBlendModeSDL();
    // Custom composed blend mode — not any of the predefined constants
    expect(mode).not.toBe(SDL_BLENDMODE_BLEND);
    expect(mode).not.toBe(SDL_BLENDMODE_NONE);
    expect(mode).not.toBe(SDL_BLENDMODE_ADD);
  });

  test("masking alpha produces custom blend mode", () => {
    setup();
    graphics.setColorMask(true, true, true, false);
    const mode = _getEffectiveBlendModeSDL();
    expect(mode).not.toBe(SDL_BLENDMODE_BLEND);
  });

  test("all-false colorMask produces custom blend mode", () => {
    setup();
    graphics.setColorMask(false, false, false, false);
    const mode = _getEffectiveBlendModeSDL();
    expect(mode).not.toBe(SDL_BLENDMODE_BLEND);
    expect(mode).not.toBe(SDL_BLENDMODE_NONE);
  });

  test("changing blend mode while mask active recomputes", () => {
    setup();
    graphics.setColorMask(false, false, false, true);
    const modeAlpha = _getEffectiveBlendModeSDL();
    graphics.setBlendMode("add");
    const modeAdd = _getEffectiveBlendModeSDL();
    // Both are custom but should differ (different base blend factors)
    expect(modeAlpha).not.toBe(modeAdd);
  });

  test("restoring mask to all-true returns to predefined blend", () => {
    setup();
    graphics.setColorMask(false, false, false, false);
    expect(_getEffectiveBlendModeSDL()).not.toBe(SDL_BLENDMODE_BLEND);
    graphics.setColorMask(true, true, true, true);
    expect(_getEffectiveBlendModeSDL()).toBe(SDL_BLENDMODE_BLEND);
  });

  test("reset() restores colorMask to all true", () => {
    setup();
    graphics.setColorMask(false, false, false, false);
    graphics.reset();
    expect(graphics.getColorMask()).toEqual([true, true, true, true]);
    expect(_getEffectiveBlendModeSDL()).toBe(SDL_BLENDMODE_BLEND);
  });

  test("setBlendMode replace with all-true mask gives NONE", () => {
    setup();
    graphics.setBlendMode("replace");
    expect(_getEffectiveBlendModeSDL()).toBe(SDL_BLENDMODE_NONE);
  });

  test("getColorMask returns a copy", () => {
    setup();
    const mask = graphics.getColorMask();
    mask[0] = false;
    expect(graphics.getColorMask()).toEqual([true, true, true, true]);
  });
});
