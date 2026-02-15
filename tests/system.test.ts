import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import sdl from "../src/sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../src/sdl/types.ts";
import * as system from "../src/jove/system.ts";

describe("jove.system", () => {
  beforeAll(() => {
    sdl.SDL_Init(SDL_INIT_VIDEO);
  });

  afterAll(() => {
    sdl.SDL_Quit();
  });

  test("getOS returns a string", () => {
    const os = system.getOS();
    expect(typeof os).toBe("string");
    expect(os.length).toBeGreaterThan(0);
  });

  test("getProcessorCount returns positive number", () => {
    const count = system.getProcessorCount();
    expect(count).toBeGreaterThan(0);
  });

  test("setClipboardText and getClipboardText round-trip", () => {
    const ok = system.setClipboardText("jove2d test");
    expect(ok).toBe(true);
    const text = system.getClipboardText();
    expect(text).toBe("jove2d test");
  });

  test("getPowerInfo returns valid state", () => {
    const info = system.getPowerInfo();
    expect(["unknown", "battery", "nobattery", "charging", "charged"]).toContain(info.state);
    expect(typeof info.percent).toBe("number");
    expect(typeof info.seconds).toBe("number");
  });
});
