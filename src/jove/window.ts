// jove2d window module — mirrors love.window API

import { ptr, read } from "bun:ffi";
import type { Pointer } from "bun:ffi";
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
  SDL_WINDOW_MOUSE_FOCUS,
  SDL_FLASH_BRIEFLY,
  SDL_FLASH_UNTIL_FOCUSED,
  SDL_MESSAGEBOX_ERROR,
  SDL_MESSAGEBOX_WARNING,
  SDL_MESSAGEBOX_INFORMATION,
  SDL_LOGICAL_PRESENTATION_LETTERBOX,
} from "../sdl/types.ts";
import type { WindowFlags, WindowMode } from "./types.ts";
import { _getRenderer } from "./graphics.ts";
import { SDL_PIXELFORMAT_RGBA8888 } from "../sdl/types.ts";

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

// VSync out-param buffer
const _vsyncBuf = new Int32Array(1);
const _vsyncPtr = ptr(_vsyncBuf);

// Internal state
let _window: SDLWindow | null = null;
let _isOpen = false;
let _currentIcon: any = null; // cached ImageData for getIcon()
let _logicalWidth = 0;
let _logicalHeight = 0;

/** Get display content scale (DPI factor) before window creation. */
function _getDisplayScale(): number {
  const displayId = sdl.SDL_GetPrimaryDisplay();
  if (!displayId) return 1.0;
  return sdl.SDL_GetDisplayContentScale(displayId) || 1.0;
}

/** Get the logical window size (pre-DPI-scaling). Used by renderer for logical presentation. */
export function _getLogicalSize(): { width: number; height: number } {
  return { width: _logicalWidth, height: _logicalHeight };
}

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
  // Always enable high pixel density for sharp rendering on high-DPI displays.
  // SDL_SetRenderLogicalPresentation in _createRenderer() keeps coordinates consistent.
  sdlFlags |= SDL_WINDOW_HIGH_PIXEL_DENSITY;

  // Scale window size by display DPI factor so the window appears at the same
  // physical size as on a 1x display. SDL3 is DPI-aware (unlike SDL2/love2d),
  // so without scaling, windows appear smaller on high-DPI displays.
  const dpiScale = _getDisplayScale();
  const scaledW = Math.round(width * dpiScale);
  const scaledH = Math.round(height * dpiScale);

  const win = sdl.SDL_CreateWindow(
    Buffer.from("jove2d\0"),
    scaledW,
    scaledH,
    sdlFlags
  );

  if (!win) {
    return false;
  }

  _window = win;
  _isOpen = true;
  _logicalWidth = width;
  _logicalHeight = height;

  // Apply minimum size if specified (also scaled by DPI)
  if (flags.minwidth || flags.minheight) {
    sdl.SDL_SetWindowMinimumSize(
      win,
      Math.round((flags.minwidth ?? 1) * dpiScale),
      Math.round((flags.minheight ?? 1) * dpiScale),
    );
  }

  return true;
}

/** Get the current window mode. Matches love.window.getMode(). */
export function getMode(): WindowMode {
  if (!_window) {
    return { width: 0, height: 0, flags: {} };
  }

  // Return logical size (pre-DPI-scaling) so it matches drawing coordinates.
  // The actual SDL window may be larger on high-DPI displays.
  const width = _logicalWidth || (() => {
    sdl.SDL_GetWindowSize(_window!, _ptrA, _ptrB);
    return read.i32(_ptrA, 0);
  })();
  const height = _logicalHeight || (() => {
    sdl.SDL_GetWindowSize(_window!, _ptrA, _ptrB);
    return read.i32(_ptrB, 0);
  })();

  const sdlFlags = BigInt(sdl.SDL_GetWindowFlags(_window));

  // Read vsync from renderer if available
  let vsync = 0;
  const renderer = _getRenderer();
  if (renderer) {
    sdl.SDL_GetRenderVSync(renderer, _vsyncPtr);
    vsync = read.i32(_vsyncPtr, 0);
  }

  const flags: WindowFlags = {
    fullscreen: (sdlFlags & SDL_WINDOW_FULLSCREEN) !== 0n,
    resizable: (sdlFlags & SDL_WINDOW_RESIZABLE) !== 0n,
    borderless: (sdlFlags & SDL_WINDOW_BORDERLESS) !== 0n,
    highdpi: (sdlFlags & SDL_WINDOW_HIGH_PIXEL_DENSITY) !== 0n,
    vsync,
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

/** Set the window icon from an ImageData. Returns true on success. */
export function setIcon(imagedata: any): boolean {
  if (!_window || !imagedata) return false;
  const { data, width, height } = imagedata;
  if (!data || !width || !height) return false;

  const surface = sdl.SDL_CreateSurfaceFrom(
    width, height, SDL_PIXELFORMAT_RGBA8888, ptr(data), width * 4
  );
  if (!surface) return false;

  const ok = sdl.SDL_SetWindowIcon(_window, surface);
  sdl.SDL_DestroySurface(surface);
  if (ok) _currentIcon = imagedata;
  return ok;
}

/** Get the current window icon as ImageData, or null if none set. */
export function getIcon(): any {
  return _currentIcon;
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

/** Check if the window has mouse focus. */
export function hasMouseFocus(): boolean {
  if (!_window) return false;
  const flags = BigInt(sdl.SDL_GetWindowFlags(_window));
  return (flags & SDL_WINDOW_MOUSE_FOCUS) !== 0n;
}

/** Set vsync mode. 0 = off, 1 = on, -1 = adaptive. */
export function setVSync(vsync: number): void {
  const renderer = _getRenderer();
  if (renderer) {
    sdl.SDL_SetRenderVSync(renderer, vsync);
  }
}

/** Get current vsync mode. 0 = off, 1 = on, -1 = adaptive. */
export function getVSync(): number {
  const renderer = _getRenderer();
  if (!renderer) return 0;
  sdl.SDL_GetRenderVSync(renderer, _vsyncPtr);
  return read.i32(_vsyncPtr, 0);
}

/** Get the number of connected displays. */
export function getDisplayCount(): number {
  sdl.SDL_GetDisplays(_ptrA);
  const count = read.i32(_ptrA, 0);
  return count;
}

/** Helper: get the display ID array from SDL. Caller must SDL_free the returned pointer. */
function _getDisplayIds(): { ids: Pointer | null; count: number } {
  const idsPtr = sdl.SDL_GetDisplays(_ptrA);
  const count = read.i32(_ptrA, 0);
  return { ids: idsPtr as Pointer | null, count };
}

/** Get the name of a display. displayIndex is 1-based (love2d convention). Default is 1. */
export function getDisplayName(displayIndex: number = 1): string {
  const { ids, count } = _getDisplayIds();
  if (!ids || count <= 0) return "";
  const idx = displayIndex - 1; // convert to 0-based
  if (idx < 0 || idx >= count) {
    sdl.SDL_free(ids);
    return "";
  }
  // Display IDs are u32 (4 bytes each)
  const displayId = read.u32(ids, idx * 4);
  sdl.SDL_free(ids);
  const name = sdl.SDL_GetDisplayName(displayId);
  return name ? String(name) : "";
}

/** Get available fullscreen modes for a display. displayIndex is 1-based. Default is 1. */
export function getFullscreenModes(displayIndex: number = 1): { width: number; height: number }[] {
  const { ids, count: displayCount } = _getDisplayIds();
  if (!ids || displayCount <= 0) return [];
  const idx = displayIndex - 1;
  if (idx < 0 || idx >= displayCount) {
    sdl.SDL_free(ids);
    return [];
  }
  const displayId = read.u32(ids, idx * 4);
  sdl.SDL_free(ids);

  // SDL_GetFullscreenDisplayModes returns pointer to array of SDL_DisplayMode pointers
  const modesPtr = sdl.SDL_GetFullscreenDisplayModes(displayId, _ptrA);
  const modeCount = read.i32(_ptrA, 0);
  if (!modesPtr || modeCount <= 0) return [];

  const modes: { width: number; height: number }[] = [];
  // modesPtr is an array of pointers to SDL_DisplayMode structs
  // Each pointer is 8 bytes (64-bit)
  // SDL_DisplayMode struct: displayID(u32,0) format(u32,4) w(i32,8) h(i32,12) ...
  for (let i = 0; i < modeCount; i++) {
    const modeStructPtr = read.ptr(modesPtr, i * 8);
    if (!modeStructPtr) continue;
    const w = read.i32(modeStructPtr, 8);
    const h = read.i32(modeStructPtr, 12);
    modes.push({ width: w, height: h });
  }

  sdl.SDL_free(modesPtr);
  return modes;
}

/** Convert pixel coordinates to density-independent units. */
export function fromPixels(x: number, y?: number): number | [number, number] {
  if (!_window) {
    return y !== undefined ? [x, y] : x;
  }
  const density = sdl.SDL_GetWindowPixelDensity(_window);
  if (y !== undefined) {
    return [x / density, y / density];
  }
  return x / density;
}

/** Convert density-independent units to pixel coordinates. */
export function toPixels(x: number, y?: number): number | [number, number] {
  if (!_window) {
    return y !== undefined ? [x, y] : x;
  }
  const density = sdl.SDL_GetWindowPixelDensity(_window);
  if (y !== undefined) {
    return [x * density, y * density];
  }
  return x * density;
}

/** Show a simple message box. type: "info" (default), "warning", "error". */
export function showMessageBox(
  title: string,
  message: string,
  type: "info" | "warning" | "error" = "info",
  attachToWindow: boolean = true,
): boolean {
  const flagMap = {
    info: SDL_MESSAGEBOX_INFORMATION,
    warning: SDL_MESSAGEBOX_WARNING,
    error: SDL_MESSAGEBOX_ERROR,
  };
  return sdl.SDL_ShowSimpleMessageBox(
    flagMap[type],
    Buffer.from(title + "\0"),
    Buffer.from(message + "\0"),
    attachToWindow && _window ? _window : null,
  );
}

/** Request user attention (flash the taskbar/window). continuous=true flashes until focused. */
export function requestAttention(continuous: boolean = false): void {
  if (!_window) return;
  sdl.SDL_FlashWindow(_window, continuous ? SDL_FLASH_UNTIL_FOCUSED : SDL_FLASH_BRIEFLY);
}

/** Update window size and flags without destroying the window. Falls back to setMode if no window exists. */
export function updateMode(
  width: number,
  height: number,
  flags: WindowFlags = {},
): boolean {
  if (!_window) {
    return setMode(width, height, flags);
  }

  // Scale by DPI factor (same as setMode)
  const dpiScale = _getDisplayScale();
  const scaledW = Math.round(width * dpiScale);
  const scaledH = Math.round(height * dpiScale);

  sdl.SDL_SetWindowSize(_window, scaledW, scaledH);
  _logicalWidth = width;
  _logicalHeight = height;

  // Update logical presentation to match new logical size
  const renderer = _getRenderer();
  if (renderer) {
    sdl.SDL_SetRenderLogicalPresentation(renderer, width, height, SDL_LOGICAL_PRESENTATION_LETTERBOX);
  }

  // Apply fullscreen
  if (flags.fullscreen !== undefined) {
    sdl.SDL_SetWindowFullscreen(_window, flags.fullscreen);
  }

  // Apply resizable — SDL3 doesn't have a direct "set resizable" but we can check if it changed
  // SDL_WINDOW_RESIZABLE is set at creation; no runtime toggle API in SDL3 for this.

  // Apply borderless — similarly set at creation time only in SDL3

  // Apply minimum size (also scaled by DPI)
  if (flags.minwidth || flags.minheight) {
    sdl.SDL_SetWindowMinimumSize(
      _window,
      Math.round((flags.minwidth ?? 1) * dpiScale),
      Math.round((flags.minheight ?? 1) * dpiScale),
    );
  }

  // Apply vsync if specified
  if (flags.vsync !== undefined) {
    setVSync(flags.vsync);
  }

  return true;
}
