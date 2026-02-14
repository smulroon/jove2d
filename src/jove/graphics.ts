// jove2d graphics module — renderer lifecycle, drawing primitives, screenshot capture

import { ptr, read, toArrayBuffer } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import {
  SDL_SURFACE_OFFSET_W,
  SDL_SURFACE_OFFSET_H,
  SDL_SURFACE_OFFSET_PITCH,
  SDL_SURFACE_OFFSET_PIXELS,
  SDL_SURFACE_OFFSET_FORMAT,
  SDL_BLENDMODE_BLEND,
} from "../sdl/types.ts";
import type { SDLRenderer } from "../sdl/types.ts";
import { _getSDLWindow, getMode } from "./window.ts";
import type { ImageData } from "./types.ts";

// --- Internal renderer state ---

let _renderer: SDLRenderer | null = null;
let _bgColor: [number, number, number, number] = [0, 0, 0, 255];
let _drawColor: [number, number, number, number] = [255, 255, 255, 255];

// Reusable SDL_FRect buffer (x, y, w, h as f32).
// IMPORTANT: We must call ptr() fresh each time after writing to the buffer,
// because ptr() returns a pointer to bun's internal copy — stale after JS-side writes.
const _rectBuf = new Float32Array(4);

/** SDL_PixelFormat enum → string mapping (common formats) */
const PIXEL_FORMAT_NAMES: Record<number, string> = {
  0x16161804: "xrgb8888",
  0x16261804: "xbgr8888",
  0x16362004: "rgba8888",
  0x16462004: "abgr8888",
  0x16762004: "bgra8888",
  0x16862004: "argb8888",
};

// --- Renderer lifecycle (internal, called by index.ts) ---

/** Create the SDL renderer for the current window. */
export function _createRenderer(): void {
  const win = _getSDLWindow();
  if (!win) return;
  _renderer = sdl.SDL_CreateRenderer(win, null) as SDLRenderer | null;
  if (!_renderer) {
    throw new Error(`SDL_CreateRenderer failed: ${sdl.SDL_GetError()}`);
  }
  sdl.SDL_SetRenderDrawBlendMode(_renderer, SDL_BLENDMODE_BLEND);
}

/** Destroy the renderer. */
export function _destroyRenderer(): void {
  if (_renderer) {
    sdl.SDL_DestroyRenderer(_renderer);
    _renderer = null;
  }
}

/** Begin a frame: clear with background color. */
export function _beginFrame(): void {
  if (!_renderer) return;
  const [br, bg, bb, ba] = _bgColor;
  sdl.SDL_SetRenderDrawColor(_renderer, br, bg, bb, ba);
  sdl.SDL_RenderClear(_renderer);
  // Restore draw color
  const [dr, dg, db, da] = _drawColor;
  sdl.SDL_SetRenderDrawColor(_renderer, dr, dg, db, da);
}

/** End a frame: flush captures, present. */
export function _endFrame(): void {
  if (!_renderer) return;
  _flushCaptures();
  sdl.SDL_RenderPresent(_renderer);
}

/** Get the renderer pointer (for internal use). */
export function _getRenderer(): SDLRenderer | null {
  return _renderer;
}

// --- Public API (mirrors love.graphics) ---

/** Set the background clear color (0–255 range). */
export function setBackgroundColor(r: number, g: number, b: number, a: number = 255): void {
  _bgColor = [r, g, b, a];
}

/** Get the background clear color. */
export function getBackgroundColor(): [number, number, number, number] {
  return [..._bgColor] as [number, number, number, number];
}

/** Set the current drawing color (0–255 range). */
export function setColor(r: number, g: number, b: number, a: number = 255): void {
  _drawColor = [r, g, b, a];
  if (_renderer) {
    sdl.SDL_SetRenderDrawColor(_renderer, r, g, b, a);
  }
}

/** Get the current drawing color. */
export function getColor(): [number, number, number, number] {
  return [..._drawColor] as [number, number, number, number];
}

/** Clear the screen with the background color. */
export function clear(): void {
  if (!_renderer) return;
  const [r, g, b, a] = _bgColor;
  sdl.SDL_SetRenderDrawColor(_renderer, r, g, b, a);
  sdl.SDL_RenderClear(_renderer);
  // Restore draw color
  const [dr, dg, db, da] = _drawColor;
  sdl.SDL_SetRenderDrawColor(_renderer, dr, dg, db, da);
}

/** Draw a rectangle. */
export function rectangle(mode: "fill" | "line", x: number, y: number, w: number, h: number): void {
  if (!_renderer) return;
  _rectBuf[0] = x;
  _rectBuf[1] = y;
  _rectBuf[2] = w;
  _rectBuf[3] = h;
  const p = ptr(_rectBuf);
  if (mode === "fill") {
    sdl.SDL_RenderFillRect(_renderer, p);
  } else {
    sdl.SDL_RenderRect(_renderer, p);
  }
}

/** Draw line(s). Variadic: line(x1, y1, x2, y2, ...) like love2d. */
export function line(...coords: number[]): void {
  if (!_renderer || coords.length < 4) return;
  if (coords.length === 4) {
    sdl.SDL_RenderLine(_renderer, coords[0], coords[1], coords[2], coords[3]);
    return;
  }
  // Multiple segments — use SDL_RenderLines
  const numPoints = coords.length / 2;
  const buf = new Float32Array(numPoints * 2);
  for (let i = 0; i < coords.length; i++) {
    buf[i] = coords[i];
  }
  sdl.SDL_RenderLines(_renderer, ptr(buf), numPoints);
}

/** Draw a circle approximated with line segments. */
export function circle(mode: "fill" | "line", cx: number, cy: number, radius: number, segments?: number): void {
  if (!_renderer) return;
  const n = segments ?? Math.min(256, Math.max(16, Math.ceil(radius * 2)));
  const angleStep = (Math.PI * 2) / n;

  if (mode === "line") {
    // n+1 points to close the circle
    const buf = new Float32Array((n + 1) * 2);
    for (let i = 0; i <= n; i++) {
      const angle = i * angleStep;
      buf[i * 2] = cx + Math.cos(angle) * radius;
      buf[i * 2 + 1] = cy + Math.sin(angle) * radius;
    }
    sdl.SDL_RenderLines(_renderer, ptr(buf), n + 1);
  } else {
    // Triangle fan from center using SDL_RenderGeometry.
    // SDL_Vertex: float x, float y, float r, float g, float b, float a, float tex_u, float tex_v
    // = 8 floats = 32 bytes per vertex
    const numTris = n;
    const numVerts = numTris * 3;
    const vertBuf = new Float32Array(numVerts * 8);
    const [dr, dg, db, da] = _drawColor;
    const cr = dr / 255;
    const cg = dg / 255;
    const cb = db / 255;
    const ca = da / 255;

    for (let i = 0; i < numTris; i++) {
      const a1 = i * angleStep;
      const a2 = (i + 1) * angleStep;
      const base = i * 3 * 8;

      // Center vertex
      vertBuf[base + 0] = cx;
      vertBuf[base + 1] = cy;
      vertBuf[base + 2] = cr;
      vertBuf[base + 3] = cg;
      vertBuf[base + 4] = cb;
      vertBuf[base + 5] = ca;
      vertBuf[base + 6] = 0;
      vertBuf[base + 7] = 0;

      // Edge vertex 1
      vertBuf[base + 8] = cx + Math.cos(a1) * radius;
      vertBuf[base + 9] = cy + Math.sin(a1) * radius;
      vertBuf[base + 10] = cr;
      vertBuf[base + 11] = cg;
      vertBuf[base + 12] = cb;
      vertBuf[base + 13] = ca;
      vertBuf[base + 14] = 0;
      vertBuf[base + 15] = 0;

      // Edge vertex 2
      vertBuf[base + 16] = cx + Math.cos(a2) * radius;
      vertBuf[base + 17] = cy + Math.sin(a2) * radius;
      vertBuf[base + 18] = cr;
      vertBuf[base + 19] = cg;
      vertBuf[base + 20] = cb;
      vertBuf[base + 21] = ca;
      vertBuf[base + 22] = 0;
      vertBuf[base + 23] = 0;
    }

    sdl.SDL_RenderGeometry(_renderer, null, ptr(vertBuf), numVerts, null, 0);
  }
}

/** Draw a single pixel. */
export function point(x: number, y: number): void {
  if (!_renderer) return;
  sdl.SDL_RenderPoint(_renderer, x, y);
}

/** Draw text using SDL's built-in 8x8 debug font. */
export function print(text: string, x: number, y: number): void {
  if (!_renderer) return;
  sdl.SDL_RenderDebugText(_renderer, x, y, Buffer.from(text + "\0"));
}

/** Get the window width. */
export function getWidth(): number {
  return getMode().width;
}

/** Get the window height. */
export function getHeight(): number {
  return getMode().height;
}

/** Get the window dimensions. */
export function getDimensions(): [number, number] {
  const mode = getMode();
  return [mode.width, mode.height];
}

// --- Screenshot capture ---

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
 * Flush all pending screenshot captures. Called internally by _endFrame()
 * — do not call directly.
 */
export function _flushCaptures(): void {
  if (_pendingCaptures.length === 0) return;

  if (!_renderer) {
    _pendingCaptures.length = 0;
    return;
  }

  // SDL_RenderReadPixels returns a new SDL_Surface* (caller must free it)
  const surface = sdl.SDL_RenderReadPixels(_renderer, null) as Pointer | null;
  if (!surface) {
    _pendingCaptures.length = 0;
    return;
  }

  while (_pendingCaptures.length > 0) {
    const req = _pendingCaptures.shift()!;

    if (req.kind === "file") {
      const pathBuf = Buffer.from(req.path + "\0");
      const ext = req.path.toLowerCase();
      if (ext.endsWith(".bmp")) {
        sdl.SDL_SaveBMP(surface, pathBuf);
      } else {
        sdl.SDL_SavePNG(surface, pathBuf);
      }
    } else {
      if (!sdl.SDL_LockSurface(surface)) continue;

      const w = read.i32(surface, SDL_SURFACE_OFFSET_W);
      const h = read.i32(surface, SDL_SURFACE_OFFSET_H);
      const pitch = read.i32(surface, SDL_SURFACE_OFFSET_PITCH);
      const pixelsPtr = read.ptr(surface, SDL_SURFACE_OFFSET_PIXELS);
      const formatVal = read.u32(surface, SDL_SURFACE_OFFSET_FORMAT);

      const format = PIXEL_FORMAT_NAMES[formatVal] ?? `unknown(0x${formatVal.toString(16)})`;

      if (pixelsPtr) {
        const size = pitch * h;
        const rawBuf = toArrayBuffer(pixelsPtr, 0, size);
        const data = new Uint8Array(rawBuf.slice(0));
        req.fn({ data, width: w, height: h, format });
      }

      sdl.SDL_UnlockSurface(surface);
    }
  }

  sdl.SDL_DestroySurface(surface);
}
