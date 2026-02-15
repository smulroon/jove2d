// jove2d mouse module — mirrors love.mouse API

import { ptr, read, type Pointer } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import { CURSOR_TYPE_TO_SDL, SDL_PIXELFORMAT_RGBA8888 } from "../sdl/types.ts";
import type { CursorType } from "../sdl/types.ts";
import type { ImageData } from "./types.ts";
import { _getSDLWindow } from "./window.ts";

// Pre-allocated out-param buffers for x/y (float)
const _xBuf = new Float32Array(1);
const _yBuf = new Float32Array(1);
const _xPtr = ptr(_xBuf);
const _yPtr = ptr(_yBuf);

function _getState(): { x: number; y: number; buttons: number } {
  const buttons = sdl.SDL_GetMouseState(_xPtr, _yPtr);
  return {
    x: read.f32(_xPtr, 0),
    y: read.f32(_yPtr, 0),
    buttons,
  };
}

/** Get the current mouse position. */
export function getPosition(): [number, number] {
  const { x, y } = _getState();
  return [x, y];
}

/** Get the current mouse X coordinate. */
export function getX(): number {
  return _getState().x;
}

/** Get the current mouse Y coordinate. */
export function getY(): number {
  return _getState().y;
}

/**
 * Check if a mouse button is currently pressed.
 * 1 = left, 2 = middle, 3 = right (matches love2d).
 */
export function isDown(button: number): boolean {
  const { buttons } = _getState();
  // SDL_BUTTON(x) = 1 << (x - 1)
  return (buttons & (1 << (button - 1))) !== 0;
}

/** Warp the mouse cursor to the given position within the window. */
export function setPosition(x: number, y: number): void {
  const win = _getSDLWindow();
  if (!win) return;
  sdl.SDL_WarpMouseInWindow(win, x, y);
}

/** Show or hide the mouse cursor. */
export function setVisible(visible: boolean): void {
  if (visible) {
    sdl.SDL_ShowCursor();
  } else {
    sdl.SDL_HideCursor();
  }
}

/** Check if the mouse cursor is visible. */
export function isVisible(): boolean {
  return sdl.SDL_CursorVisible();
}

/** Set whether the mouse is grabbed (confined to the window). */
export function setGrabbed(grabbed: boolean): void {
  const win = _getSDLWindow();
  if (!win) return;
  sdl.SDL_SetWindowMouseGrab(win, grabbed);
}

/** Check if the mouse is grabbed. */
export function isGrabbed(): boolean {
  const win = _getSDLWindow();
  if (!win) return false;
  return sdl.SDL_GetWindowMouseGrab(win);
}

/** Set relative mouse mode (infinite mouse movement, for FPS-style controls). */
export function setRelativeMode(enable: boolean): void {
  const win = _getSDLWindow();
  if (!win) return;
  sdl.SDL_SetWindowRelativeMouseMode(win, enable);
}

/** Check if relative mouse mode is enabled. */
export function getRelativeMode(): boolean {
  const win = _getSDLWindow();
  if (!win) return false;
  return sdl.SDL_GetWindowRelativeMouseMode(win);
}

// --- Cursor support ---

/** A mouse cursor (system or custom image). */
export interface Cursor {
  _ptr: Pointer;
  _type: "system" | "image";
  release(): void;
}

let _currentCursor: Cursor | null = null;
const _systemCursorCache = new Map<string, Cursor>();

/** Set the mouse X coordinate (keeps current Y). */
export function setX(x: number): void {
  setPosition(x, getY());
}

/** Set the mouse Y coordinate (keeps current X). */
export function setY(y: number): void {
  setPosition(getX(), y);
}

/** Check if cursor functionality is supported (always true on desktop). */
export function isCursorSupported(): boolean {
  return true;
}

/** Get a system cursor by love2d name. Cached — same object returned for same type. */
export function getSystemCursor(cursorType: CursorType): Cursor {
  const cached = _systemCursorCache.get(cursorType);
  if (cached) return cached;

  const sdlId = CURSOR_TYPE_TO_SDL[cursorType];
  if (sdlId === undefined) {
    throw new Error(`Unknown cursor type: ${cursorType}`);
  }

  const cursorPtr = sdl.SDL_CreateSystemCursor(sdlId);
  if (!cursorPtr) {
    throw new Error(`SDL_CreateSystemCursor failed: ${sdl.SDL_GetError()}`);
  }

  const cursor: Cursor = {
    _ptr: cursorPtr,
    _type: "system",
    release() {
      sdl.SDL_DestroyCursor(this._ptr);
    },
  };
  _systemCursorCache.set(cursorType, cursor);
  return cursor;
}

/**
 * Set the active mouse cursor.
 * Call with no arguments to reset to the default arrow cursor.
 */
export function setCursor(cursor?: Cursor): void {
  if (!cursor) {
    // Reset to default
    const arrow = getSystemCursor("arrow");
    sdl.SDL_SetCursor(arrow._ptr);
    _currentCursor = null;
    return;
  }
  sdl.SDL_SetCursor(cursor._ptr);
  _currentCursor = cursor;
}

/** Get the currently active cursor, or null if using the default. */
export function getCursor(): Cursor | null {
  return _currentCursor;
}

/**
 * Create a custom cursor from ImageData.
 * @param imageData — RGBA pixel data with width/height
 * @param hotX — hotspot X offset (default 0)
 * @param hotY — hotspot Y offset (default 0)
 */
export function newCursor(imageData: ImageData, hotX: number = 0, hotY: number = 0): Cursor {
  const { data, width, height } = imageData;
  const pitch = width * 4;

  // Create a temporary surface from the pixel data
  // ptr() must be called fresh since data is a JS-written buffer
  const surface = sdl.SDL_CreateSurfaceFrom(width, height, SDL_PIXELFORMAT_RGBA8888, ptr(data), pitch);
  if (!surface) {
    throw new Error(`SDL_CreateSurfaceFrom failed: ${sdl.SDL_GetError()}`);
  }

  const cursorPtr = sdl.SDL_CreateColorCursor(surface, hotX, hotY);
  sdl.SDL_DestroySurface(surface); // SDL copies the surface data

  if (!cursorPtr) {
    throw new Error(`SDL_CreateColorCursor failed: ${sdl.SDL_GetError()}`);
  }

  return {
    _ptr: cursorPtr,
    _type: "image",
    release() {
      sdl.SDL_DestroyCursor(this._ptr);
    },
  };
}

/** Internal: destroy all cached cursors. Called from quit(). */
export function _destroyCursors(): void {
  // Reset to default first
  const defaultCursor = _systemCursorCache.get("arrow");
  if (defaultCursor) {
    sdl.SDL_SetCursor(defaultCursor._ptr);
  }
  _currentCursor = null;

  // Destroy all cached system cursors
  for (const cursor of _systemCursorCache.values()) {
    sdl.SDL_DestroyCursor(cursor._ptr);
  }
  _systemCursorCache.clear();
}
