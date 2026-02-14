// jove2d keyboard module — mirrors love.keyboard API

import { read } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import { SCANCODE_NAMES } from "../sdl/types.ts";

// Build reverse lookup: key name → scancode number
const NAME_TO_SCANCODE: Record<string, number> = {};
for (const [code, name] of Object.entries(SCANCODE_NAMES)) {
  NAME_TO_SCANCODE[name] = Number(code);
}

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
  // For this implementation, scancode names and key names are the same
  // since we use the same SCANCODE_NAMES table for both
  return SCANCODE_NAMES[code] ?? scancode;
}

/** Map a key name to a scancode name. */
export function getScancodeFromKey(key: string): string {
  const code = NAME_TO_SCANCODE[key];
  if (code === undefined) return key;
  return SCANCODE_NAMES[code] ?? key;
}
