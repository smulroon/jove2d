// jove2d public API

import sdl from "../sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../sdl/types.ts";
import type { SDLWindow } from "../sdl/types.ts";

export { SDL_INIT_VIDEO } from "../sdl/types.ts";

export function init(flags: number = SDL_INIT_VIDEO): boolean {
  const ok = sdl.SDL_Init(flags);
  if (!ok) {
    throw new Error(`SDL_Init failed: ${sdl.SDL_GetError()}`);
  }
  return ok;
}

export function quit(): void {
  sdl.SDL_Quit();
}

export function getVersion(): string {
  const version = sdl.SDL_GetVersion();
  const major = Math.floor(version / 1000000);
  const minor = Math.floor((version % 1000000) / 1000);
  const micro = version % 1000;
  return `${major}.${minor}.${micro}`;
}

export function createWindow(
  title: string,
  width: number,
  height: number,
  flags: bigint = 0n
): SDLWindow {
  const window = sdl.SDL_CreateWindow(
    Buffer.from(title + "\0"),
    width,
    height,
    flags
  );
  if (!window) {
    throw new Error(`SDL_CreateWindow failed: ${sdl.SDL_GetError()}`);
  }
  return window;
}

export function destroyWindow(window: SDLWindow): void {
  sdl.SDL_DestroyWindow(window);
}
