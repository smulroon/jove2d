// jove2d public API

import sdl from "../sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../sdl/types.ts";
import * as window from "./window.ts";
import { pollEvents } from "./event.ts";
import type { GameCallbacks } from "./types.ts";

export { window };
export type { GameCallbacks, WindowFlags, WindowMode, JoveEvent } from "./types.ts";

let _initialized = false;

export function init(flags: number = SDL_INIT_VIDEO): boolean {
  if (_initialized) return true;
  const ok = sdl.SDL_Init(flags);
  if (!ok) {
    throw new Error(`SDL_Init failed: ${sdl.SDL_GetError()}`);
  }
  _initialized = true;
  return ok;
}

export function quit(): void {
  window.close();
  sdl.SDL_Quit();
  _initialized = false;
}

export function getVersion(): string {
  const version = sdl.SDL_GetVersion();
  const major = Math.floor(version / 1000000);
  const minor = Math.floor((version % 1000000) / 1000);
  const micro = version % 1000;
  return `${major}.${minor}.${micro}`;
}

/**
 * Main game loop — mirrors love.run().
 * Auto-initializes SDL and creates a default 800x600 window if none is open.
 */
export async function run(callbacks: GameCallbacks): Promise<void> {
  // Auto-init SDL if needed
  init();

  // Create default window if none is open (matches love2d defaults)
  if (!window.isOpen()) {
    const ok = window.setMode(800, 600, { resizable: true });
    if (!ok) {
      throw new Error(`Failed to create window: ${sdl.SDL_GetError()}`);
    }
  }

  // Call load() once
  if (callbacks.load) {
    await callbacks.load();
  }

  let lastTime = performance.now();
  let running = true;

  while (running && window.isOpen()) {
    // Poll and dispatch events
    const events = pollEvents();
    for (const event of events) {
      switch (event.type) {
        case "quit":
        case "close": {
          let shouldQuit = true;
          if (callbacks.quit) {
            const result = callbacks.quit();
            // If quit callback returns true, abort the quit
            if (result === true) {
              shouldQuit = false;
            }
          }
          if (shouldQuit) {
            running = false;
          }
          break;
        }
        case "focus":
          callbacks.focus?.(event.hasFocus);
          break;
        case "resize":
          callbacks.resize?.(event.width, event.height);
          break;
      }
    }

    if (!running) break;

    // Calculate delta time
    const now = performance.now();
    const dt = (now - lastTime) / 1000; // seconds
    lastTime = now;

    // Update and draw
    callbacks.update?.(dt);
    callbacks.draw?.();

    // Yield to event loop (~1ms sleep to prevent CPU spin)
    await Bun.sleep(1);
  }

  // Cleanup
  quit();
}
