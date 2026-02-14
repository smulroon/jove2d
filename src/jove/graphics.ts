// jove2d graphics module — screenshot capture (mirrors love.graphics.captureScreenshot)

import { read, toArrayBuffer } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import {
  SDL_SURFACE_OFFSET_W,
  SDL_SURFACE_OFFSET_H,
  SDL_SURFACE_OFFSET_PITCH,
  SDL_SURFACE_OFFSET_PIXELS,
  SDL_SURFACE_OFFSET_FORMAT,
} from "../sdl/types.ts";
import { _getSDLWindow } from "./window.ts";
import type { ImageData } from "./types.ts";

/** SDL_PixelFormat enum → string mapping (common formats) */
const PIXEL_FORMAT_NAMES: Record<number, string> = {
  0x16161804: "xrgb8888",
  0x16261804: "xbgr8888",
  0x16362004: "rgba8888",
  0x16462004: "abgr8888",
  0x16762004: "bgra8888",
  0x16862004: "argb8888",
};

type CaptureRequest =
  | { kind: "file"; path: string }
  | { kind: "callback"; fn: (imageData: ImageData) => void };

const _pendingCaptures: CaptureRequest[] = [];

/**
 * Queue a screenshot capture. Matches love.graphics.captureScreenshot().
 *
 * - `captureScreenshot("path.png")` — saves to file (PNG or BMP based on extension)
 * - `captureScreenshot(callback)` — calls back with raw pixel data
 *
 * The actual capture happens at the end of the current frame (after draw()).
 */
export function captureScreenshot(target: string | ((imageData: ImageData) => void)): void {
  if (typeof target === "string") {
    _pendingCaptures.push({ kind: "file", path: target });
  } else {
    _pendingCaptures.push({ kind: "callback", fn: target });
  }
}

/**
 * Flush all pending screenshot captures. Called internally by the run loop
 * after draw() — do not call directly.
 */
export function _flushCaptures(): void {
  if (_pendingCaptures.length === 0) return;

  const win = _getSDLWindow();
  if (!win) {
    // No window — silently discard captures
    _pendingCaptures.length = 0;
    return;
  }

  const surface = sdl.SDL_GetWindowSurface(win) as Pointer | null;
  if (!surface) {
    _pendingCaptures.length = 0;
    return;
  }

  // Drain the queue
  while (_pendingCaptures.length > 0) {
    const req = _pendingCaptures.shift()!;

    if (req.kind === "file") {
      const pathBuf = Buffer.from(req.path + "\0");
      const ext = req.path.toLowerCase();
      if (ext.endsWith(".bmp")) {
        sdl.SDL_SaveBMP(surface, pathBuf);
      } else {
        // Default to PNG for .png and any other extension
        sdl.SDL_SavePNG(surface, pathBuf);
      }
    } else {
      // Callback path — duplicate, lock, read pixels, unlock, destroy
      const dup = sdl.SDL_DuplicateSurface(surface) as Pointer | null;
      if (!dup) continue;

      if (!sdl.SDL_LockSurface(dup)) {
        sdl.SDL_DestroySurface(dup);
        continue;
      }

      const w = read.i32(dup, SDL_SURFACE_OFFSET_W);
      const h = read.i32(dup, SDL_SURFACE_OFFSET_H);
      const pitch = read.i32(dup, SDL_SURFACE_OFFSET_PITCH);
      const pixelsPtr = read.ptr(dup, SDL_SURFACE_OFFSET_PIXELS);
      const formatVal = read.u32(dup, SDL_SURFACE_OFFSET_FORMAT);

      const format = PIXEL_FORMAT_NAMES[formatVal] ?? `unknown(0x${formatVal.toString(16)})`;

      if (pixelsPtr) {
        const size = pitch * h;
        // toArrayBuffer gives us a view into native memory; slice(0) makes a defensive copy
        const rawBuf = toArrayBuffer(pixelsPtr, 0, size);
        const data = new Uint8Array(rawBuf.slice(0));

        req.fn({ data, width: w, height: h, format });
      }

      sdl.SDL_UnlockSurface(dup);
      sdl.SDL_DestroySurface(dup);
    }
  }
}
