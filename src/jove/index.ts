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
import * as data from "./data.ts";
import * as event from "./event.ts";
import * as joystick from "./joystick.ts";
import * as physics from "./physics.ts";
import * as image from "./image.ts";
import { pollEvents } from "./event.ts";
import type { GameCallbacks } from "./types.ts";

export { window, graphics, keyboard, mouse, timer, filesystem, math, system, audio, data, event, joystick, physics, image };
export type { GameCallbacks, WindowFlags, WindowMode, JoveEvent } from "./types.ts";
export type { ImageData } from "./image.ts";
export type { Font } from "./font.ts";
export type { Cursor } from "./mouse.ts";
export type { BezierCurve } from "./math.ts";
export type { SpriteBatch, Mesh, Text } from "./graphics.ts";
export type { ParticleSystem } from "./particles.ts";
export type { Shader } from "./shader.ts";
export type { Source } from "./audio.ts";
export type { ByteData } from "./data.ts";
export type { File, FileData } from "./filesystem.ts";
export type { Joystick } from "./joystick.ts";
export type { World, Body, Fixture, Shape, Joint, Contact, DistanceJoint, RevoluteJoint, PrismaticJoint, WeldJoint, MouseJoint, WheelJoint, MotorJoint } from "./physics.ts";

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
  joystick._quit();
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

// Custom error handler override — set via setErrorHandler() for custom behavior
let _customErrorHandler: ((error: unknown) => void) | null = null;

/** Override the default error display. Pass null to restore the blue screen. */
export function setErrorHandler(handler: ((error: unknown) => void) | null): void {
  _customErrorHandler = handler;
}

/**
 * Error display loop — shows a love2d-style blue screen with the error message.
 * Keeps the window open so the user can read the error, copy it, or quit.
 */
function _errorLoop(error: unknown): void {
  const errMsg = error instanceof Error
    ? error.message + "\n\n" + (error.stack ?? "")
    : String(error);

  // Log to console as well
  console.error("\njove2d error:\n" + errMsg);

  // If a custom handler is set, call it and return
  if (_customErrorHandler) {
    _customErrorHandler(error);
    return;
  }

  // Try to copy to clipboard on entry
  try { system.setClipboardText(errMsg); } catch {}

  while (window.isOpen()) {
    const events = pollEvents();
    for (const ev of events) {
      if (ev.type === "quit" || ev.type === "close") return;
      if (ev.type === "keypressed") {
        if (ev.key === "escape") return;
        // Ctrl+C copies error to clipboard
        if (ev.key === "c" && keyboard.isDown("lctrl", "rctrl")) {
          try { system.setClipboardText(errMsg); } catch {}
        }
      }
    }

    try {
      // Reset graphics state so we can draw reliably
      graphics.reset();
      graphics._beginFrame();

      // Blue background (love2d style)
      graphics.setBackgroundColor(29, 43, 83, 255);
      sdl.SDL_SetRenderDrawColor(
        graphics._getRenderer()!, 29, 43, 83, 255,
      );
      sdl.SDL_RenderClear(graphics._getRenderer()!);

      // White text
      graphics.setColor(255, 255, 255, 255);
      graphics.print("Error", 70, 70);
      graphics.print(errMsg, 70, 100);

      // Footer
      graphics.setColor(160, 160, 160, 255);
      graphics.print("Press Escape to quit.  Error copied to clipboard.", 70, 570);

      graphics._endFrame();
    } catch {
      // If rendering the error screen itself fails, just wait
    }

    sdl.SDL_Delay(16);
  }
}

/**
 * Synchronous game loop — extracted from run() so the JIT can fully optimize
 * the hot while-loop without async state machine overhead.
 */
function _gameLoop(callbacks: GameCallbacks): void {
  let running = true;

  while (running && window.isOpen()) {
    // Step the timer (updates dt, FPS)
    const dt = timer.step();

    // Poll and dispatch events
    const events = pollEvents();
    for (const ev of events) {
      try {
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

          // --- Joystick events ---
          case "joystickadded": {
            const joy = joystick._onJoystickAdded(ev.instanceId);
            if (joy) callbacks.joystickadded?.(joy);
            break;
          }
          case "joystickremoved": {
            const joy = joystick._onJoystickRemoved(ev.instanceId);
            if (joy) callbacks.joystickremoved?.(joy);
            break;
          }
          case "joystickpressed": {
            const joy = joystick._getByInstanceId(ev.instanceId);
            if (joy) callbacks.joystickpressed?.(joy, ev.button);
            break;
          }
          case "joystickreleased": {
            const joy = joystick._getByInstanceId(ev.instanceId);
            if (joy) callbacks.joystickreleased?.(joy, ev.button);
            break;
          }
          case "joystickaxis": {
            const joy = joystick._getByInstanceId(ev.instanceId);
            if (joy) callbacks.joystickaxis?.(joy, ev.axis, ev.value);
            break;
          }
          case "joystickhat": {
            const joy = joystick._getByInstanceId(ev.instanceId);
            if (joy) callbacks.joystickhat?.(joy, ev.hat, ev.direction);
            break;
          }
          case "gamepadpressed": {
            const joy = joystick._getByInstanceId(ev.instanceId);
            if (joy) callbacks.gamepadpressed?.(joy, ev.button);
            break;
          }
          case "gamepadreleased": {
            const joy = joystick._getByInstanceId(ev.instanceId);
            if (joy) callbacks.gamepadreleased?.(joy, ev.button);
            break;
          }
          case "gamepadaxis": {
            const joy = joystick._getByInstanceId(ev.instanceId);
            if (joy) callbacks.gamepadaxis?.(joy, ev.axis, ev.value);
            break;
          }
        }
      } catch (err) {
        _errorLoop(err);
        return;
      }
    }

    if (!running) break;

    // Begin frame (clear with background color)
    graphics._beginFrame();

    // Poll audio sources (looping, auto-stop)
    audio._updateSources();

    // Update and draw
    try {
      callbacks.update?.(dt);
      callbacks.draw?.();
    } catch (err) {
      graphics._endFrame();
      _errorLoop(err);
      return;
    }

    // End frame (flush captures + present)
    graphics._endFrame();

    // Match love2d: SDL_Delay(1) — native nanosleep, prevents CPU spin
    sdl.SDL_Delay(1);
  }
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

  // Initialize joystick (enumerate already-connected devices)
  joystick._init();

  // Initialize physics (lazy — just checks if Box2D lib is available)
  physics._init();

  // Call load() once (may be async)
  if (callbacks.load) {
    try {
      await callbacks.load();
    } catch (err) {
      _errorLoop(err);
      quit();
      return;
    }
  }

  // Run the synchronous game loop (JIT-friendly — no async overhead)
  _gameLoop(callbacks);

  // Cleanup
  quit();
}
