// jove2d window module — mirrors love.window API

import { ptr, read } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import type { SDLWindow } from "../sdl/types.ts";
import {
  SDL_WINDOW_FULLSCREEN,
  SDL_WINDOW_RESIZABLE,
  SDL_WINDOW_BORDERLESS,
  SDL_WINDOW_HIGH_PIXEL_DENSITY,
  SDL_WINDOW_HIDDEN,
  SDL_WINDOW_MINIMIZED,
  SDL_WINDOW_MAXIMIZED,
  SDL_WINDOW_INPUT_FOCUS,
} from "../sdl/types.ts";
import type { WindowFlags, WindowMode } from "./types.ts";

// Pre-allocated out-param buffers to avoid per-call allocation.
// IMPORTANT: After SDL writes to these via ptr(), we must use read.i32()
// from bun:ffi to read the values — the JS-side typed array sees stale data.
const _bufA = new Int32Array(1);
const _bufB = new Int32Array(1);
const _ptrA = ptr(_bufA);
const _ptrB = ptr(_bufB);

// SDL_Rect buffer for display bounds (x, y, w, h — 4 × int32)
const _rectBuf = new Int32Array(4);
const _rectPtr = ptr(_rectBuf);

// Internal state
let _window: SDLWindow | null = null;
let _isOpen = false;

/** Get the raw SDL window pointer (for internal use) */
export function _getSDLWindow(): SDLWindow | null {
  return _window;
}

/** Set the internal window reference (for internal use) */
export function _setSDLWindow(win: SDLWindow | null): void {
  _window = win;
  _isOpen = win !== null;
}

/** Create/resize the window. Matches love.window.setMode(). */
export function setMode(
  width: number,
  height: number,
  flags: WindowFlags = {}
): boolean {
  // If window already exists, destroy it first
  if (_window) {
    sdl.SDL_DestroyWindow(_window);
    _window = null;
    _isOpen = false;
  }

  // Build SDL window flags
  let sdlFlags = 0n;
  if (flags.fullscreen) sdlFlags |= SDL_WINDOW_FULLSCREEN;
  if (flags.resizable !== false) sdlFlags |= SDL_WINDOW_RESIZABLE; // default: resizable
  if (flags.borderless) sdlFlags |= SDL_WINDOW_BORDERLESS;
  if (flags.highdpi) sdlFlags |= SDL_WINDOW_HIGH_PIXEL_DENSITY;

  const win = sdl.SDL_CreateWindow(
    Buffer.from("jove2d\0"),
    width,
    height,
    sdlFlags
  );

  if (!win) {
    return false;
  }

  _window = win;
  _isOpen = true;

  // Apply minimum size if specified
  if (flags.minwidth || flags.minheight) {
    sdl.SDL_SetWindowMinimumSize(
      win,
      flags.minwidth ?? 1,
      flags.minheight ?? 1
    );
  }

  return true;
}

/** Get the current window mode. Matches love.window.getMode(). */
export function getMode(): WindowMode {
  if (!_window) {
    return { width: 0, height: 0, flags: {} };
  }

  sdl.SDL_GetWindowSize(_window, _ptrA, _ptrB);
  const width = read.i32(_ptrA, 0);
  const height = read.i32(_ptrB, 0);

  const sdlFlags = BigInt(sdl.SDL_GetWindowFlags(_window));

  const flags: WindowFlags = {
    fullscreen: (sdlFlags & SDL_WINDOW_FULLSCREEN) !== 0n,
    resizable: (sdlFlags & SDL_WINDOW_RESIZABLE) !== 0n,
    borderless: (sdlFlags & SDL_WINDOW_BORDERLESS) !== 0n,
    highdpi: (sdlFlags & SDL_WINDOW_HIGH_PIXEL_DENSITY) !== 0n,
  };

  return { width, height, flags };
}

/** Set the window title. */
export function setTitle(title: string): void {
  if (_window) {
    sdl.SDL_SetWindowTitle(_window, Buffer.from(title + "\0"));
  }
}

/** Get the window title. */
export function getTitle(): string {
  if (!_window) return "";
  const result = sdl.SDL_GetWindowTitle(_window);
  if (!result) return "";
  return String(result);
}

/** Returns true if a window is currently open. */
export function isOpen(): boolean {
  return _isOpen;
}

/** Close and destroy the window. */
export function close(): void {
  if (_window) {
    sdl.SDL_DestroyWindow(_window);
    _window = null;
    _isOpen = false;
  }
}

/** Set fullscreen mode. */
export function setFullscreen(fullscreen: boolean): boolean {
  if (!_window) return false;
  return sdl.SDL_SetWindowFullscreen(_window, fullscreen);
}

/** Check if window is in fullscreen mode. */
export function isFullscreen(): boolean {
  if (!_window) return false;
  const flags = BigInt(sdl.SDL_GetWindowFlags(_window));
  return (flags & SDL_WINDOW_FULLSCREEN) !== 0n;
}

/** Get the desktop dimensions for the primary display. */
export function getDesktopDimensions(): { width: number; height: number } {
  const displayId = sdl.SDL_GetPrimaryDisplay();
  if (!displayId) {
    return { width: 0, height: 0 };
  }

  const ok = sdl.SDL_GetDisplayBounds(displayId, _rectPtr);
  if (!ok) {
    return { width: 0, height: 0 };
  }

  // SDL_Rect: x(0), y(4), w(8), h(12) — offsets in bytes
  return {
    width: read.i32(_rectPtr, 8),
    height: read.i32(_rectPtr, 12),
  };
}

/** Get the DPI scale of the window's display. */
export function getDPIScale(): number {
  if (!_window) return 1.0;
  return sdl.SDL_GetWindowDisplayScale(_window);
}

/** Set window position. */
export function setPosition(x: number, y: number): void {
  if (_window) {
    sdl.SDL_SetWindowPosition(_window, x, y);
  }
}

/** Get window position. */
export function getPosition(): { x: number; y: number } {
  if (!_window) return { x: 0, y: 0 };
  sdl.SDL_GetWindowPosition(_window, _ptrA, _ptrB);
  return { x: read.i32(_ptrA, 0), y: read.i32(_ptrB, 0) };
}

/** Check if the window is visible. */
export function isVisible(): boolean {
  if (!_window) return false;
  const flags = BigInt(sdl.SDL_GetWindowFlags(_window));
  return (flags & SDL_WINDOW_HIDDEN) === 0n;
}

/** Check if the window is minimized. */
export function isMinimized(): boolean {
  if (!_window) return false;
  const flags = BigInt(sdl.SDL_GetWindowFlags(_window));
  return (flags & SDL_WINDOW_MINIMIZED) !== 0n;
}

/** Check if the window is maximized. */
export function isMaximized(): boolean {
  if (!_window) return false;
  const flags = BigInt(sdl.SDL_GetWindowFlags(_window));
  return (flags & SDL_WINDOW_MAXIMIZED) !== 0n;
}

/** Minimize the window. */
export function minimize(): void {
  if (_window) {
    sdl.SDL_MinimizeWindow(_window);
  }
}

/** Maximize the window. */
export function maximize(): void {
  if (_window) {
    sdl.SDL_MaximizeWindow(_window);
  }
}

/** Restore the window from minimized/maximized state. */
export function restore(): void {
  if (_window) {
    sdl.SDL_RestoreWindow(_window);
  }
}

/** Check if the window has input focus. */
export function hasFocus(): boolean {
  if (!_window) return false;
  const flags = BigInt(sdl.SDL_GetWindowFlags(_window));
  return (flags & SDL_WINDOW_INPUT_FOCUS) !== 0n;
}
