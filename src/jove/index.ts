// jove2d public API

import sdl from "../sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../sdl/types.ts";
import * as window from "./window.ts";
import * as graphics from "./graphics.ts";
import * as keyboard from "./keyboard.ts";
import * as mouse from "./mouse.ts";
import * as timer from "./timer.ts";
import * as filesystem from "./filesystem.ts";
import * as math from "./math.ts";
import * as system from "./system.ts";
import * as audio from "./audio.ts";
import * as event from "./event.ts";
import { pollEvents } from "./event.ts";
import type { GameCallbacks } from "./types.ts";

export { window, graphics, keyboard, mouse, timer, filesystem, math, system, audio, event };
export type { GameCallbacks, WindowFlags, WindowMode, JoveEvent, ImageData } from "./types.ts";
export type { Font } from "./font.ts";
export type { Cursor } from "./mouse.ts";
export type { BezierCurve } from "./math.ts";
export type { SpriteBatch } from "./graphics.ts";
export type { ParticleSystem } from "./particles.ts";
export type { Shader } from "./shader.ts";

let _initialized = false;

/** Detect WSL2 and force X11 — SDL3's Wayland backend hangs on WSLg. */
function _applyPlatformWorkarounds(): void {
  if (process.env.SDL_VIDEODRIVER) return; // user already set it
  try {
    const release = require("fs").readFileSync("/proc/version", "utf8");
    if (/microsoft|wsl/i.test(release)) {
      process.env.SDL_VIDEODRIVER = "x11";
    }
  } catch {}
}

export function init(flags: number = SDL_INIT_VIDEO): boolean {
  if (_initialized) return true;
  _applyPlatformWorkarounds();
  const ok = sdl.SDL_Init(flags);
  if (!ok) {
    throw new Error(`SDL_Init failed: ${sdl.SDL_GetError()}`);
  }
  _initialized = true;
  return ok;
}

export function quit(): void {
  mouse._destroyCursors();
  audio._quit();
  graphics._destroyRenderer();
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

  // Create renderer
  graphics._createRenderer();

  // Initialize timer
  timer._init();

  // Initialize audio (non-fatal if it fails)
  audio._init();

  // Call load() once
  if (callbacks.load) {
    await callbacks.load();
  }

  let running = true;

  while (running && window.isOpen()) {
    // Step the timer (updates dt, FPS)
    const dt = timer.step();

    // Poll and dispatch events
    const events = pollEvents();
    for (const ev of events) {
      switch (ev.type) {
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
          callbacks.focus?.(ev.hasFocus);
          break;
        case "resize":
          callbacks.resize?.(ev.width, ev.height);
          break;
        case "keypressed":
          if (!keyboard._shouldFilterRepeat(ev.isRepeat)) {
            callbacks.keypressed?.(ev.key, ev.scancode, ev.isRepeat);
          }
          break;
        case "keyreleased":
          callbacks.keyreleased?.(ev.key, ev.scancode);
          break;
        case "mousepressed":
          callbacks.mousepressed?.(ev.x, ev.y, ev.button, false);
          break;
        case "mousereleased":
          callbacks.mousereleased?.(ev.x, ev.y, ev.button, false);
          break;
        case "mousemoved":
          callbacks.mousemoved?.(ev.x, ev.y, ev.dx, ev.dy);
          break;
        case "wheelmoved":
          callbacks.wheelmoved?.(ev.x, ev.y);
          break;
        case "textinput":
          callbacks.textinput?.(ev.text);
          break;
        case "filedropped":
          callbacks.filedropped?.(ev.path);
          break;
        case "shown":
          callbacks.visible?.(true);
          break;
        case "hidden":
          callbacks.visible?.(false);
          break;
      }
    }

    if (!running) break;

    // Begin frame (clear with background color)
    graphics._beginFrame();

    // Update and draw
    callbacks.update?.(dt);
    callbacks.draw?.();

    // End frame (flush captures + present)
    graphics._endFrame();

    // Yield to event loop (~1ms sleep to prevent CPU spin)
    await Bun.sleep(1);
  }

  // Cleanup
  quit();
}
