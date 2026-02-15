// Compare two images pixel by pixel using SDL3 surface loading.
// Usage: bun tools/compare-images.ts <image1> <image2> [--threshold <0-255>]
//
// --threshold: per-channel tolerance for anti-aliasing differences (default: 0)

import sdl from "../src/sdl/ffi.ts";
import { read, toArrayBuffer } from "bun:ffi";
import {
  SDL_SURFACE_OFFSET_W,
  SDL_SURFACE_OFFSET_H,
  SDL_SURFACE_OFFSET_PITCH,
  SDL_SURFACE_OFFSET_PIXELS,
  SDL_SURFACE_OFFSET_FORMAT,
} from "../src/sdl/types.ts";
import type { Pointer } from "bun:ffi";

const args = process.argv.slice(2);
let threshold = 0;
const files: string[] = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--threshold" && args[i + 1]) {
    threshold = parseInt(args[++i], 10);
  } else {
    files.push(args[i]);
  }
}

const [file1, file2] = files;

if (!file1 || !file2) {
  console.error("Usage: bun tools/compare-images.ts <image1> <image2> [--threshold <0-255>]");
  process.exit(1);
}

function loadSurface(path: string): Pointer {
  const buf = Buffer.from(path + "\0");
  const surface = sdl.SDL_LoadSurface(buf) as Pointer | null;
  if (!surface) {
    console.error(`Failed to load: ${path}`);
    process.exit(1);
  }
  return surface;
}

function getSurfaceInfo(surface: Pointer) {
  const w = read.i32(surface, SDL_SURFACE_OFFSET_W);
  const h = read.i32(surface, SDL_SURFACE_OFFSET_H);
  const pitch = read.i32(surface, SDL_SURFACE_OFFSET_PITCH);
  const format = read.u32(surface, SDL_SURFACE_OFFSET_FORMAT);
  return { w, h, pitch, format };
}

function getPixels(surface: Pointer, h: number, pitch: number): Uint8Array {
  sdl.SDL_LockSurface(surface);
  const pixelsPtr = read.ptr(surface, SDL_SURFACE_OFFSET_PIXELS);
  const size = pitch * h;
  const raw = toArrayBuffer(pixelsPtr!, 0, size);
  const pixels = new Uint8Array(raw.slice(0));
  sdl.SDL_UnlockSurface(surface);
  return pixels;
}

// Convert surface to RGBA8888 for consistent comparison
const SDL_PIXELFORMAT_RGBA8888 = 0x16462004;

function convertSurface(surface: Pointer): Pointer {
  const converted = sdl.SDL_ConvertSurface(surface, SDL_PIXELFORMAT_RGBA8888) as Pointer | null;
  if (!converted) {
    console.error("Failed to convert surface format");
    process.exit(1);
  }
  return converted;
}

const s1 = loadSurface(file1);
const s2 = loadSurface(file2);

const info1 = getSurfaceInfo(s1);
const info2 = getSurfaceInfo(s2);

console.log(`Image 1: ${file1} — ${info1.w}x${info1.h}, format=0x${info1.format.toString(16)}`);
console.log(`Image 2: ${file2} — ${info2.w}x${info2.h}, format=0x${info2.format.toString(16)}`);
if (threshold > 0) console.log(`Threshold: ${threshold}`);

if (info1.w !== info2.w || info1.h !== info2.h) {
  console.error(`FAIL: dimensions differ (${info1.w}x${info1.h} vs ${info2.w}x${info2.h})`);
  sdl.SDL_DestroySurface(s1);
  sdl.SDL_DestroySurface(s2);
  process.exit(1);
}

// Convert both to same pixel format for comparison
const c1 = convertSurface(s1);
const c2 = convertSurface(s2);
const ci1 = getSurfaceInfo(c1);
const ci2 = getSurfaceInfo(c2);

const pixels1 = getPixels(c1, ci1.h, ci1.pitch);
const pixels2 = getPixels(c2, ci2.h, ci2.pitch);

let exactDiffs = 0;
let overThreshold = 0;
let maxDiff = 0;
let diffPixels = 0;
const w = ci1.w;
const h = ci1.h;
const bpp = 4; // RGBA

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const off1 = y * ci1.pitch + x * bpp;
    const off2 = y * ci2.pitch + x * bpp;
    let pixelDiff = false;
    for (let c = 0; c < bpp; c++) {
      const d = Math.abs(pixels1[off1 + c] - pixels2[off2 + c]);
      if (d > 0) {
        exactDiffs++;
        maxDiff = Math.max(maxDiff, d);
        pixelDiff = true;
        if (d > threshold) overThreshold++;
      }
    }
    if (pixelDiff) diffPixels++;
  }
}

const totalPixels = w * h;
const totalChannels = totalPixels * bpp;

sdl.SDL_DestroySurface(c1);
sdl.SDL_DestroySurface(c2);
sdl.SDL_DestroySurface(s1);
sdl.SDL_DestroySurface(s2);

if (exactDiffs === 0) {
  console.log("PASS: images are pixel-identical");
  process.exit(0);
} else {
  const pct = ((diffPixels / totalPixels) * 100).toFixed(3);
  console.log(`Pixels differ: ${diffPixels}/${totalPixels} (${pct}%)`);
  console.log(`Channels differ: ${exactDiffs}/${totalChannels}, max diff=${maxDiff}`);

  if (overThreshold === 0) {
    console.log(`PASS: all differences within threshold (${threshold})`);
    process.exit(0);
  } else {
    console.error(`FAIL: ${overThreshold} channels exceed threshold (${threshold})`);
    process.exit(1);
  }
}
