// jove2d system module — mirrors love.system API

import sdl from "../sdl/ffi.ts";
import { ptr, read } from "bun:ffi";
import {
  SDL_POWERSTATE_ON_BATTERY,
  SDL_POWERSTATE_NO_BATTERY,
  SDL_POWERSTATE_CHARGING,
  SDL_POWERSTATE_CHARGED,
} from "../sdl/types.ts";

/** Get the operating system name. */
export function getOS(): string {
  const platform = String(sdl.SDL_GetPlatform());
  return platform;
}

/** Get the number of logical CPU cores. */
export function getProcessorCount(): number {
  return sdl.SDL_GetNumLogicalCPUCores();
}

/** Open a URL in the user's default browser. Returns true on success. */
export function openURL(url: string): boolean {
  return sdl.SDL_OpenURL(Buffer.from(url + "\0"));
}

/** Set the clipboard text. */
export function setClipboardText(text: string): boolean {
  return sdl.SDL_SetClipboardText(Buffer.from(text + "\0"));
}

/** Get the clipboard text. Returns empty string if clipboard is empty. */
export function getClipboardText(): string {
  if (!sdl.SDL_HasClipboardText()) return "";
  const result = sdl.SDL_GetClipboardText();
  if (!result) return "";
  return String(result);
}

export interface PowerInfo {
  state: "unknown" | "battery" | "nobattery" | "charging" | "charged";
  percent: number; // -1 if unknown
  seconds: number; // -1 if unknown
}

// Pre-allocated out-param buffers
const _secBuf = new Int32Array(1);
const _pctBuf = new Int32Array(1);
const _secPtr = ptr(_secBuf);
const _pctPtr = ptr(_pctBuf);

/** Get battery/power information. */
export function getPowerInfo(): PowerInfo {
  const state = sdl.SDL_GetPowerInfo(_secPtr, _pctPtr);
  const seconds = read.i32(_secPtr, 0);
  const percent = read.i32(_pctPtr, 0);

  let stateName: PowerInfo["state"] = "unknown";
  if (state === SDL_POWERSTATE_ON_BATTERY) stateName = "battery";
  else if (state === SDL_POWERSTATE_NO_BATTERY) stateName = "nobattery";
  else if (state === SDL_POWERSTATE_CHARGING) stateName = "charging";
  else if (state === SDL_POWERSTATE_CHARGED) stateName = "charged";

  return { state: stateName, percent, seconds };
}
