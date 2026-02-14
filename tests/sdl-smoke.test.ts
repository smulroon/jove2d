import { describe, test, expect } from "bun:test";
import sdl from "../src/sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../src/sdl/types.ts";

describe("SDL3 smoke test", () => {
  test("SDL3 library loads and SDL_GetVersion returns valid version", () => {
    const version = sdl.SDL_GetVersion();
    expect(version).toBeGreaterThan(0);
    const major = Math.floor(version / 1000000);
    expect(major).toBe(3);
  });

  test("SDL_Init succeeds with VIDEO flag", () => {
    const ok = sdl.SDL_Init(SDL_INIT_VIDEO);
    expect(ok).toBe(true);
    sdl.SDL_Quit();
  });
});
