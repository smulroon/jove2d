// jove2d image module — ImageData pixel manipulation
// Mirrors love.image: newImageData, getPixel, setPixel, mapPixel, encode, paste

import { ptr, read, toArrayBuffer } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import { loadImage } from "../sdl/ffi_image.ts";
import {
  SDL_PIXELFORMAT_ABGR8888,
  SDL_SURFACE_OFFSET_W,
  SDL_SURFACE_OFFSET_H,
  SDL_SURFACE_OFFSET_PITCH,
  SDL_SURFACE_OFFSET_PIXELS,
  SDL_SURFACE_OFFSET_FORMAT,
} from "../sdl/types.ts";

export interface ImageData {
  /** Raw RGBA pixel data (4 bytes per pixel, row-major). */
  readonly data: Uint8Array;
  /** Width in pixels. */
  readonly width: number;
  /** Height in pixels. */
  readonly height: number;
  /** Pixel format string (always "rgba8888"). */
  readonly format: string;

  /** Get pixel at (x, y) as [r, g, b, a] (0-255). */
  getPixel(x: number, y: number): [number, number, number, number];
  /** Set pixel at (x, y) from r, g, b, a (0-255). */
  setPixel(x: number, y: number, r: number, g: number, b: number, a: number): void;
  /** Get width. */
  getWidth(): number;
  /** Get height. */
  getHeight(): number;
  /** Get [width, height]. */
  getDimensions(): [number, number];
  /**
   * Apply a function to every pixel. The function receives (x, y, r, g, b, a)
   * and must return [r, g, b, a].
   */
  mapPixel(fn: (x: number, y: number, r: number, g: number, b: number, a: number) => [number, number, number, number]): void;
  /** Copy a rectangular region from another ImageData. */
  paste(source: ImageData, dx: number, dy: number, sx?: number, sy?: number, sw?: number, sh?: number): void;
  /** Encode to PNG or BMP format. Returns the encoded bytes, or saves to file if path given. */
  encode(format: "png" | "bmp", filepath?: string): Uint8Array | null;
  /** Get the pixel format string (always "rgba8"). */
  getFormat(): string;
  /** Get a copy of the raw pixel data as a string (for hashing, etc.). */
  getString(): string;
}

/**
 * Create a new ImageData.
 *
 * Overloads:
 * - newImageData(width, height) — blank (transparent) RGBA image
 * - newImageData(filepath) — load from image file (PNG/JPG/BMP/etc.)
 */
export function newImageData(width: number, height: number): ImageData;
export function newImageData(filepath: string): ImageData | null;
export function newImageData(widthOrPath: number | string, height?: number): ImageData | null {
  if (typeof widthOrPath === "string") {
    return _loadImageData(widthOrPath);
  }
  const w = widthOrPath;
  const h = height!;
  if (w <= 0 || h <= 0) return null;
  const data = new Uint8Array(w * h * 4);
  return _createImageData(data, w, h);
}

function _loadImageData(filepath: string): ImageData | null {
  const pathBuf = Buffer.from(filepath + "\0");
  let surface: Pointer | null = null;

  // Try SDL_image first (PNG, JPG, WebP, etc.)
  const img = loadImage();
  if (img) {
    surface = img.IMG_Load(pathBuf) as Pointer | null;
  }

  // Fallback to SDL_LoadBMP
  if (!surface) {
    surface = sdl.SDL_LoadBMP(pathBuf) as Pointer | null;
  }
  if (!surface) return null;

  // Convert to RGBA8888 if needed
  const formatVal = read.u32(surface, SDL_SURFACE_OFFSET_FORMAT);
  let rgba = surface;
  let needsFree = false;
  if (formatVal !== SDL_PIXELFORMAT_ABGR8888) {
    rgba = sdl.SDL_ConvertSurface(surface, SDL_PIXELFORMAT_ABGR8888) as Pointer | null;
    if (!rgba) {
      sdl.SDL_DestroySurface(surface);
      return null;
    }
    needsFree = true;
  }

  // Read pixel data
  if (!sdl.SDL_LockSurface(rgba)) {
    if (needsFree) sdl.SDL_DestroySurface(rgba);
    sdl.SDL_DestroySurface(surface);
    return null;
  }

  const w = read.i32(rgba, SDL_SURFACE_OFFSET_W);
  const h = read.i32(rgba, SDL_SURFACE_OFFSET_H);
  const pitch = read.i32(rgba, SDL_SURFACE_OFFSET_PITCH);
  const pixelsPtr = read.ptr(rgba, SDL_SURFACE_OFFSET_PIXELS);

  let data: Uint8Array;
  if (pixelsPtr) {
    const rowBytes = w * 4;
    if (pitch === rowBytes) {
      // Tightly packed — single copy
      const rawBuf = toArrayBuffer(pixelsPtr, 0, rowBytes * h);
      data = new Uint8Array(rawBuf.slice(0));
    } else {
      // Pitch differs — copy row by row
      data = new Uint8Array(rowBytes * h);
      for (let row = 0; row < h; row++) {
        const rowBuf = toArrayBuffer(pixelsPtr, row * pitch, rowBytes);
        data.set(new Uint8Array(rowBuf), row * rowBytes);
      }
    }
  } else {
    data = new Uint8Array(w * h * 4);
  }

  sdl.SDL_UnlockSurface(rgba);
  if (needsFree) sdl.SDL_DestroySurface(rgba);
  sdl.SDL_DestroySurface(surface);

  return _createImageData(data, w, h);
}

function _createImageData(data: Uint8Array, width: number, height: number): ImageData {
  return {
    data,
    width,
    height,
    format: "rgba8888",

    getPixel(x: number, y: number): [number, number, number, number] {
      const i = (y * width + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    },

    setPixel(x: number, y: number, r: number, g: number, b: number, a: number): void {
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    },

    getWidth() { return width; },
    getHeight() { return height; },
    getDimensions() { return [width, height]; },

    mapPixel(fn) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const [r, g, b, a] = fn(x, y, data[i], data[i + 1], data[i + 2], data[i + 3]);
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = a;
        }
      }
    },

    paste(source: ImageData, dx: number, dy: number, sx = 0, sy = 0, sw?: number, sh?: number) {
      const srcW = sw ?? source.width;
      const srcH = sh ?? source.height;
      for (let row = 0; row < srcH; row++) {
        const dstY = dy + row;
        const srcY = sy + row;
        if (dstY < 0 || dstY >= height || srcY < 0 || srcY >= source.height) continue;
        for (let col = 0; col < srcW; col++) {
          const dstX = dx + col;
          const srcX = sx + col;
          if (dstX < 0 || dstX >= width || srcX < 0 || srcX >= source.width) continue;
          const si = (srcY * source.width + srcX) * 4;
          const di = (dstY * width + dstX) * 4;
          data[di] = source.data[si];
          data[di + 1] = source.data[si + 1];
          data[di + 2] = source.data[si + 2];
          data[di + 3] = source.data[si + 3];
        }
      }
    },

    encode(format: "png" | "bmp", filepath?: string): Uint8Array | null {
      // Create surface from pixel data
      const surface = sdl.SDL_CreateSurfaceFrom(
        width, height, SDL_PIXELFORMAT_ABGR8888, ptr(data), width * 4
      ) as Pointer | null;
      if (!surface) return null;

      if (filepath) {
        const pathBuf = Buffer.from(filepath + "\0");
        if (format === "bmp") {
          sdl.SDL_SaveBMP(surface, pathBuf);
        } else {
          sdl.SDL_SavePNG(surface, pathBuf);
        }
        sdl.SDL_DestroySurface(surface);
        return null;
      }

      // Encode to temp file and read back
      const tmp = `/tmp/jove2d-encode-${Date.now()}.${format}`;
      const pathBuf = Buffer.from(tmp + "\0");
      const ok = format === "bmp"
        ? sdl.SDL_SaveBMP(surface, pathBuf)
        : sdl.SDL_SavePNG(surface, pathBuf);
      sdl.SDL_DestroySurface(surface);

      if (!ok) return null;

      try {
        const file = Bun.file(tmp);
        const buf = new Uint8Array(file.size);
        const fd = require("fs").openSync(tmp, "r");
        require("fs").readSync(fd, buf, 0, file.size, 0);
        require("fs").closeSync(fd);
        require("fs").unlinkSync(tmp);
        return buf;
      } catch {
        return null;
      }
    },

    getFormat(): string {
      return "rgba8";
    },

    getString(): string {
      return String.fromCharCode(...data);
    },
  };
}
