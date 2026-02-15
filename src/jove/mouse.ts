// jove2d mouse module — mirrors love.mouse API

import { ptr, read } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
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
