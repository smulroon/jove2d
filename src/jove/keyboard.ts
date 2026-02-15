// jove2d keyboard module — mirrors love.keyboard API

import { read } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import { SCANCODE_NAMES } from "../sdl/types.ts";
import { _getSDLWindow } from "./window.ts";

// Build reverse lookup: key name → scancode number
const NAME_TO_SCANCODE: Record<string, number> = {};
for (const [code, name] of Object.entries(SCANCODE_NAMES)) {
  NAME_TO_SCANCODE[name] = Number(code);
}

let _keyRepeat = true;

/**
 * Check if any of the given keys are currently pressed.
 * Uses SDL_GetKeyboardState to read the live scancode array.
 */
export function isDown(...keys: string[]): boolean {
  const statePtr = sdl.SDL_GetKeyboardState(null) as Pointer | null;
  if (!statePtr) return false;

  for (const key of keys) {
    const scancode = NAME_TO_SCANCODE[key];
    if (scancode === undefined) continue;
    if (read.u8(statePtr, scancode) !== 0) return true;
  }
  return false;
}

/**
 * Check if any of the given scancodes (by name) are currently pressed.
 */
export function isScancodeDown(...scancodes: string[]): boolean {
  const statePtr = sdl.SDL_GetKeyboardState(null) as Pointer | null;
  if (!statePtr) return false;

  for (const name of scancodes) {
    const scancode = NAME_TO_SCANCODE[name];
    if (scancode === undefined) continue;
    if (read.u8(statePtr, scancode) !== 0) return true;
  }
  return false;
}

/** Map a scancode name to a key name. */
export function getKeyFromScancode(scancode: string): string {
  const code = NAME_TO_SCANCODE[scancode];
  if (code === undefined) return scancode;
  return SCANCODE_NAMES[code] ?? scancode;
}

/** Map a key name to a scancode name. */
export function getScancodeFromKey(key: string): string {
  const code = NAME_TO_SCANCODE[key];
  if (code === undefined) return key;
  return SCANCODE_NAMES[code] ?? key;
}

/** Enable or disable key repeat for keypressed events. */
export function setKeyRepeat(enable: boolean): void {
  _keyRepeat = enable;
}

/** Check if key repeat is enabled. */
export function hasKeyRepeat(): boolean {
  return _keyRepeat;
}

/** Check if key repeat should be filtered for a given event. Used internally. */
export function _shouldFilterRepeat(isRepeat: boolean): boolean {
  return !_keyRepeat && isRepeat;
}

/** Enable text input mode (for IME). */
export function setTextInput(enable: boolean): void {
  const win = _getSDLWindow();
  if (!win) return;
  if (enable) {
    sdl.SDL_StartTextInput(win);
  } else {
    sdl.SDL_StopTextInput(win);
  }
}

/** Check if text input mode is active. */
export function hasTextInput(): boolean {
  const win = _getSDLWindow();
  if (!win) return false;
  return sdl.SDL_TextInputActive(win);
}
